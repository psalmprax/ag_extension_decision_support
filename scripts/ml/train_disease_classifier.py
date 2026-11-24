# /// script
# requires-python = ">=3.10"
# dependencies = [
#   "torch>=2.3",
#   "torchvision>=0.18",
#   "timm>=1.0",
#   "datasets>=3.0",
#   "pillow>=10",
#   "numpy>=1.26",
#   "onnx>=1.16",
#   "onnxruntime>=1.18",
#   "huggingface_hub>=0.24",
# ]
# ///
"""
Train the on-device plant disease classifier on field photos and export it for the app.

What it does, in order:
  1. Loads leaf photos taken in fields, not lab photos: PlantDoc (web photos of real plants),
     maize leaves photographed with a handheld camera, and cassava leaves from Uganda. Each
     source keeps a held-out test set; PlantDoc and cassava use their own test splits.
  2. Fine-tunes an ImageNet MobileNetV3 with timm.
  3. Exports ONNX with softmax on the output, quantises it to int8, and evaluates the
     quantised model with onnxruntime, since that is the file the phone runs.
  4. Writes plant-disease.onnx, manifest.json (the entry the app reads; see
     src/services/edgeModelManifest.ts) and MODEL_CARD.md with per-class results.

The app loads the model only when the field evaluation meets the acceptance gate in
docs/specs/PHASE2-OFFLINE-DIAGNOSIS-MODEL.md (>= 300 field photos, top-3 >= 70%, crop top-1
>= 60%). This script reports the numbers; it does not decide to ship.

Run on a GitHub runner (CPU, about an hour at the defaults) with the "Train disease model"
workflow, locally with `uv run scripts/ml/train_disease_classifier.py --out out/`, or on
Hugging Face Jobs (paid; needs the owner's approval):
  hf jobs uv run --flavor t4-small scripts/ml/train_disease_classifier.py --epochs 15 --out /data/out

`--smoke` trains for a few steps on generated images to check the pipeline end to end; its
numbers mean nothing and its manifest entry is marked as a smoke run.
"""
from __future__ import annotations

import argparse
import json
import random
import re
import sys
import time
from dataclasses import dataclass, field
from datetime import date
from pathlib import Path

import numpy as np

# Labels are "<crop>___<disease>" in snake case, the form the app maps to its known
# conditions (mapLabelToCondition in edgePlantVisionClassifier.ts).
MAIZE_LABELS = {
    "Common Rust": "corn___common_rust",
    "Corn Leaf Blight": "corn___leaf_blight",
    "Gray Leaf Spot": "corn___gray_leaf_spot",
    "Healthy": "corn___healthy",
    "Insects damage": "corn___insect_damage",
}
CASSAVA_LABELS = {"cbsd": "cassava___brown_streak", "cmd": "cassava___mosaic", "healthy": "cassava___healthy"}
SOURCES = {
    "plantdoc": ("geraldmc/plantdoc-full", "CC-BY-4.0", "Singh et al. 2020, PlantDoc"),
    "maize": ("InriaXagriscienceFM/maize_corn_corn_leaf_disease_detection", "CC-BY-4.0", "Mendeley hmkd6nbngr, via AgML"),
    "cassava": ("andrewkatumba/cassava_leaf_diseases_dsa_2023", "CC-BY-SA-4.0", "Data Science Africa 2023 cassava set"),
}
MEAN = (0.485, 0.456, 0.406)
STD = (0.229, 0.224, 0.225)


def snake(text: str) -> str:
    return re.sub(r"[^a-z0-9]+", "_", text.strip().lower()).strip("_")


def plantdoc_label(row: dict) -> str:
    disease = "healthy" if row["is_healthy"] else snake(row["disease"] or row["class_label"])
    return f"{snake(row['host'])}___{disease}"


@dataclass
class Sample:
    image: object  # PIL image
    label: str
    source: str


@dataclass
class Splits:
    train: list[Sample] = field(default_factory=list)
    test: list[Sample] = field(default_factory=list)


def holdout(samples: list[Sample], share: float, seed: int) -> tuple[list[Sample], list[Sample]]:
    """Stratified split by label, so every class has test photos."""
    by_label: dict[str, list[Sample]] = {}
    for sample in samples:
        by_label.setdefault(sample.label, []).append(sample)
    rng = random.Random(seed)
    train, test = [], []
    for group in by_label.values():
        rng.shuffle(group)
        cut = max(1, round(len(group) * share))
        test += group[:cut]
        train += group[cut:]
    return train, test


def load_sources(names: list[str], max_per_source: int | None, seed: int) -> Splits:
    from datasets import load_dataset

    splits = Splits()
    for name in names:
        repo = SOURCES[name][0]
        print(f"Loading {name} from {repo}", flush=True)
        if name == "plantdoc":
            data = load_dataset(repo, split="train")
            for row in data.select(range(min(len(data), max_per_source or len(data)))):
                sample = Sample(row["image"].convert("RGB"), plantdoc_label(row), name)
                (splits.test if row["split"] == "test" else splits.train).append(sample)
        elif name == "maize":
            data = load_dataset(repo, split="train")
            names_ = data.features["label"].names
            rows = data.select(range(min(len(data), max_per_source or len(data))))
            samples = [Sample(r["image"].convert("RGB"), MAIZE_LABELS[names_[r["label"]]], name) for r in rows]
            train, test = holdout(samples, 0.15, seed)
            splits.train += train
            splits.test += test
        elif name == "cassava":
            for split_name, target in (("train", splits.train), ("test", splits.test)):
                data = load_dataset(repo, split=split_name)
                names_ = data.features["label"].names
                for r in data.select(range(min(len(data), max_per_source or len(data)))):
                    target.append(Sample(r["image"].convert("RGB"), CASSAVA_LABELS[names_[r["label"]]], name))
    return splits


def smoke_sources(seed: int) -> Splits:
    """Generated images in two colours per class: enough to run every step, nothing more."""
    from PIL import Image

    rng = random.Random(seed)
    labels = ["corn___common_rust", "corn___healthy", "cassava___mosaic"]
    colours = {"corn___common_rust": (150, 80, 30), "corn___healthy": (40, 140, 40), "cassava___mosaic": (170, 170, 60)}
    splits = Splits()
    for label in labels:
        for i in range(24):
            base = colours[label]
            pixel = tuple(min(255, max(0, c + rng.randint(-20, 20))) for c in base)
            image = Image.new("RGB", (96, 96), pixel)
            (splits.test if i < 6 else splits.train).append(Sample(image, label, "smoke"))
    return splits


def build_model(arch: str, classes: int, pretrained: bool):
    import timm

    return timm.create_model(arch, pretrained=pretrained, num_classes=classes)


def transforms(size: int, train: bool):
    from torchvision import transforms as T

    if train:
        return T.Compose([
            T.RandomResizedCrop(size, scale=(0.5, 1.0)),
            T.RandomHorizontalFlip(),
            T.RandomVerticalFlip(),
            T.ColorJitter(0.3, 0.3, 0.3, 0.03),
            T.ToTensor(),
            T.Normalize(MEAN, STD),
        ])
    return T.Compose([T.Resize((size, size)), T.ToTensor(), T.Normalize(MEAN, STD)])


def train(model, samples: list[Sample], labels: list[str], args) -> None:
    import torch
    from torch.utils.data import DataLoader, Dataset, WeightedRandomSampler

    index = {label: i for i, label in enumerate(labels)}
    tf = transforms(args.size, train=True)

    class Photos(Dataset):
        def __len__(self):
            return len(samples)

        def __getitem__(self, i):
            return tf(samples[i].image), index[samples[i].label]

    # Rare classes are drawn as often as common ones, so the model does not learn "healthy".
    counts = {label: 0 for label in labels}
    for sample in samples:
        counts[sample.label] += 1
    weights = [1.0 / counts[sample.label] for sample in samples]
    loader = DataLoader(
        Photos(), batch_size=args.batch_size, num_workers=args.workers,
        sampler=WeightedRandomSampler(weights, num_samples=len(samples), replacement=True),
    )
    optimiser = torch.optim.AdamW(model.parameters(), lr=args.lr, weight_decay=0.05)
    steps = args.epochs * len(loader)
    schedule = torch.optim.lr_scheduler.OneCycleLR(optimiser, max_lr=args.lr, total_steps=max(1, steps))
    loss_fn = torch.nn.CrossEntropyLoss(label_smoothing=0.1)
    device = "cuda" if torch.cuda.is_available() else "cpu"
    model.to(device).train()
    for epoch in range(args.epochs):
        started, total, seen = time.time(), 0.0, 0
        for step, (images, targets) in enumerate(loader):
            images, targets = images.to(device), targets.to(device)
            loss = loss_fn(model(images), targets)
            optimiser.zero_grad()
            loss.backward()
            optimiser.step()
            schedule.step()
            total += loss.item() * len(targets)
            seen += len(targets)
            if args.smoke and step >= 2:
                break
        print(f"epoch {epoch + 1}/{args.epochs}: loss {total / max(1, seen):.3f} in {time.time() - started:.0f}s", flush=True)
    model.to("cpu").eval()


def export_onnx(model, labels: list[str], size: int, out: Path) -> Path:
    import torch
    from onnxruntime.quantization import QuantType, quantize_dynamic

    class WithSoftmax(torch.nn.Module):
        def __init__(self, inner):
            super().__init__()
            self.inner = inner

        def forward(self, x):
            return torch.softmax(self.inner(x), dim=1)

    float_path = out / "plant-disease.float.onnx"
    torch.onnx.export(
        WithSoftmax(model).eval(), torch.zeros(1, 3, size, size), float_path,
        input_names=["input"], output_names=["probabilities"], opset_version=17, dynamo=False,
    )
    quantised = out / "plant-disease.onnx"
    quantize_dynamic(float_path, quantised, weight_type=QuantType.QInt8)
    float_path.unlink()
    print(f"Exported {quantised} ({quantised.stat().st_size / 1e6:.1f} MB, {len(labels)} classes)", flush=True)
    return quantised


def crop_of(label: str) -> str:
    return label.split("___", 1)[0]


def evaluate(model_path: Path, samples: list[Sample], labels: list[str], size: int) -> dict:
    """Scores the quantised ONNX file the phone will run, on held-out field photos only."""
    import onnxruntime as ort

    session = ort.InferenceSession(str(model_path), providers=["CPUExecutionProvider"])
    tf = transforms(size, train=False)
    per_class: dict[str, dict[str, int]] = {label: {"images": 0, "top1": 0} for label in labels}
    per_source: dict[str, dict[str, int]] = {}
    top1 = top3 = crop_top1 = 0
    for sample in samples:
        x = tf(sample.image).unsqueeze(0).numpy()
        probabilities = session.run(None, {"input": x})[0][0]
        ranked = [labels[i] for i in np.argsort(-probabilities)]
        hit1, hit3 = ranked[0] == sample.label, sample.label in ranked[:3]
        top1 += hit1
        top3 += hit3
        crop_top1 += crop_of(ranked[0]) == crop_of(sample.label)
        per_class[sample.label]["images"] += 1
        per_class[sample.label]["top1"] += hit1
        source = per_source.setdefault(sample.source, {"images": 0, "top1": 0, "top3": 0})
        source["images"] += 1
        source["top1"] += hit1
        source["top3"] += hit3
    n = max(1, len(samples))
    return {
        "images": len(samples),
        "top1Accuracy": round(top1 / n, 4),
        "top3Accuracy": round(top3 / n, 4),
        "cropTop1Accuracy": round(crop_top1 / n, 4),
        "perClass": per_class,
        "perSource": per_source,
    }


def write_outputs(out: Path, labels: list[str], scores: dict, args, sources: list[str], counts: dict) -> None:
    dataset = "smoke run, generated images" if args.smoke else ", ".join(f"{s} test split" for s in sources)
    entry = {
        "file": "plant-disease.onnx",
        "name": f"{args.arch}, field photos {date.today().isoformat()}" + (" (smoke run, do not ship)" if args.smoke else ""),
        "labels": labels,
        "output": "probabilities",
        "inputSize": args.size,
        "fieldEvaluation": {
            "dataset": dataset,
            "images": scores["images"],
            "top1Accuracy": scores["top1Accuracy"],
            "top3Accuracy": scores["top3Accuracy"],
            "cropTop1Accuracy": scores["cropTop1Accuracy"],
            "evaluatedOn": date.today().isoformat(),
        },
    }
    if args.smoke:
        entry["fieldEvaluation"]["smoke"] = True
    (out / "manifest.json").write_text(json.dumps({"models": [entry]}, indent=2) + "\n")

    lines = [
        f"# Plant disease classifier: {entry['name']}",
        "",
        f"Architecture: `{args.arch}` from timm, ImageNet weights, fine-tuned {args.epochs} epochs at {args.size}px.",
        "Output: softmax probabilities over the labels in manifest.json. Quantised to int8; every number below is for the quantised file.",
        "",
        "## Field evaluation",
        "",
        f"Held-out photos: {scores['images']}. Top-1 {scores['top1Accuracy']:.1%}, top-3 {scores['top3Accuracy']:.1%}, crop top-1 {scores['cropTop1Accuracy']:.1%}.",
        "",
        "| Source | Photos | Top-1 | Top-3 |",
        "|---|---:|---:|---:|",
    ]
    for source, s in scores["perSource"].items():
        lines.append(f"| {source} | {s['images']} | {s['top1'] / max(1, s['images']):.1%} | {s['top3'] / max(1, s['images']):.1%} |")
    lines += ["", "| Label | Train photos | Test photos | Top-1 |", "|---|---:|---:|---:|"]
    for label in labels:
        c = scores["perClass"][label]
        lines.append(f"| {label} | {counts.get(label, 0)} | {c['images']} | {c['top1'] / max(1, c['images']):.1%} |")
    lines += ["", "## Data and licences", ""]
    for source in sources:
        repo, licence, credit = SOURCES.get(source, ("generated", "n/a", "smoke run"))
        lines.append(f"- {source}: [{repo}](https://huggingface.co/datasets/{repo}), {licence}, {credit}")
    lines += [
        "",
        "CC-BY-SA data obliges attribution and share-alike terms for derived works; check them before release.",
        "",
        "## Limits",
        "",
        "- Only the labels above. Anything else gets the nearest of them, so the app shows the top three and asks for confirmation.",
        "- These test photos are public sets. Before release, also score photos taken by the app's officers (the acceptance gate in docs/specs/PHASE2-OFFLINE-DIAGNOSIS-MODEL.md).",
    ]
    (out / "MODEL_CARD.md").write_text("\n".join(lines) + "\n")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--sources", default="plantdoc,maize,cassava")
    parser.add_argument("--arch", default="mobilenetv3_small_100")
    parser.add_argument("--size", type=int, default=224)
    parser.add_argument("--epochs", type=int, default=8)
    parser.add_argument("--batch-size", type=int, default=48)
    parser.add_argument("--lr", type=float, default=2e-3)
    parser.add_argument("--workers", type=int, default=2)
    parser.add_argument("--max-per-source", type=int, default=None, help="Cap photos per source, for a quicker run")
    parser.add_argument("--min-photos-per-label", type=int, default=20, help="Drop labels with fewer training photos")
    parser.add_argument("--seed", type=int, default=7)
    parser.add_argument("--out", type=Path, required=True)
    parser.add_argument("--push-to", help="Hugging Face model repo to upload the outputs to, e.g. org/plant-disease-edge")
    parser.add_argument("--smoke", action="store_true", help="Run every step on generated images; the numbers mean nothing")
    args = parser.parse_args()

    import torch

    random.seed(args.seed)
    np.random.seed(args.seed)
    torch.manual_seed(args.seed)
    args.out.mkdir(parents=True, exist_ok=True)

    sources = ["smoke"] if args.smoke else [s.strip() for s in args.sources.split(",") if s.strip()]
    splits = smoke_sources(args.seed) if args.smoke else load_sources(sources, args.max_per_source, args.seed)
    counts: dict[str, int] = {}
    for sample in splits.train:
        counts[sample.label] = counts.get(sample.label, 0) + 1
    floor = 1 if args.smoke else args.min_photos_per_label
    labels = sorted(label for label, n in counts.items() if n >= floor)
    dropped = sorted(set(counts) - set(labels))
    if dropped:
        print(f"Dropped labels with fewer than {floor} training photos: {', '.join(dropped)}", flush=True)
    keep = set(labels)
    splits.train = [s for s in splits.train if s.label in keep]
    splits.test = [s for s in splits.test if s.label in keep]
    print(f"{len(splits.train)} training and {len(splits.test)} test photos over {len(labels)} labels", flush=True)
    if len(labels) < 2 or not splits.test:
        print("Not enough labelled photos to train and evaluate.", file=sys.stderr)
        return 1

    model = build_model(args.arch, len(labels), pretrained=not args.smoke)
    train(model, splits.train, labels, args)
    model_path = export_onnx(model, labels, args.size, args.out)
    scores = evaluate(model_path, splits.test, labels, args.size)
    print(json.dumps({k: v for k, v in scores.items() if k not in ("perClass",)}, indent=2), flush=True)
    write_outputs(args.out, labels, scores, args, sources, counts)

    if args.push_to:
        from huggingface_hub import HfApi

        api = HfApi()
        api.create_repo(args.push_to, repo_type="model", exist_ok=True, private=True)
        api.upload_folder(folder_path=str(args.out), repo_id=args.push_to, repo_type="model")
        print(f"Uploaded to https://huggingface.co/{args.push_to}", flush=True)
    return 0


if __name__ == "__main__":
    sys.exit(main())
