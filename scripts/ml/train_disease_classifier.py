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
  1. Streams leaf photos from the sources in SOURCES (all CC0, CC-BY or CC-BY-SA, so commercial
     use is allowed with credit). Streaming keeps multi-GB sets off the runner's disk; each label
     keeps a random --max-train-per-label photos per source, so no crop or source crowds out the
     rest.
  2. Holds out test photos. Sources with a published test split use it. The others hold out 15%
     per label, with copies of one picture (flipped, rotated or re-saved) kept on one side. Any
     training photo that is a copy of a test photo from another source is dropped.
  3. Fine-tunes an ImageNet MobileNetV3 with timm and exports ONNX with softmax output, as
     float32 and as int8; int8 ships only if it keeps its score.
  4. Scores the shipped file. The headline (fieldEvaluation, which the app's gate reads) uses
     only published test splits. The 15% holdouts are reported apart (holdoutEvaluation), since
     photos from the same collection as the training photos flatter the model. It also records
     how often the top answer is right at each confidence (calibration), which the app uses to
     decide when an answer is sure enough to show without asking the online model.
  5. Writes plant-disease.onnx, manifest.json (the entry the app reads; see
     src/services/edgeModelManifest.ts) and MODEL_CARD.md with per-source and per-label results.

The app loads the model only when the field evaluation meets the acceptance gate in
docs/specs/PHASE2-OFFLINE-DIAGNOSIS-MODEL.md (>= 300 field photos, top-3 >= 70%, crop top-1
>= 60%). This script reports the numbers; it does not decide to ship.

Run on a GitHub runner (CPU, four to five hours with every source; the workflow passes a time
budget and the epochs are cut to fit) with the "Train disease model"
workflow, locally with `uv run scripts/ml/train_disease_classifier.py --out out/`, or on
Hugging Face Jobs (paid; needs the owner's approval):
  hf jobs uv run --flavor t4-small scripts/ml/train_disease_classifier.py --epochs 15 --out /data/out

`--smoke` trains for a few steps on generated images to check the pipeline end to end; its
numbers mean nothing and its manifest entry is marked as a smoke run.
"""
from __future__ import annotations

import argparse
import io
import json
import random
import re
import sys
import time
from dataclasses import dataclass, field
from datetime import date
from pathlib import Path
from typing import Callable

import numpy as np

MEAN = (0.485, 0.456, 0.406)
STD = (0.229, 0.224, 0.225)


def snake(text: str) -> str:
    return re.sub(r"[^a-z0-9]+", "_", str(text).strip().lower()).strip("_")


# Labels are "<crop>___<disease>" in snake case, the form the app maps to its known conditions
# (mapLabelToCondition in edgePlantVisionClassifier.ts). A row maps to a label, or to None to skip it.
LabelFn = Callable[[dict, str], "str | None"]


def by_name(names: dict[str, str]) -> LabelFn:
    return lambda _row, label_name: names.get(label_name)


def plantdoc_label(row: dict, _label_name: str) -> str:
    disease = "healthy" if row["is_healthy"] else snake(row["disease"] or row["class_label"])
    return f"{snake(row['host'])}___{disease}"


def by_crop_column(names: dict[str, str]) -> LabelFn:
    def label(row: dict, label_name: str) -> str | None:
        disease, crop = names.get(label_name), snake(row.get("crop_type") or "")
        return f"{crop}___{disease}" if disease and crop else None
    return label


TOM2024_DISEASES = {
    "healthy-leaf": "healthy", "healthy-fruit": "healthy_fruit", "spodoptera-frugiperda": "fall_armyworm",
    "helminthosporiosis": "leaf_blight", "tomato-late-blight": "late_blight", "caterpillar": "caterpillar_damage",
    "abiotic-disease": "abiotic_damage",
}


def tom2024_label(row: dict, label_name: str) -> str | None:
    crop = snake(row.get("crop_type") or "")
    disease = re.sub(r"-(d|p|a)$", "", label_name)  # -d disease, -p pest, -a adult pest
    return f"{crop}___{TOM2024_DISEASES.get(disease, snake(disease))}" if crop else None


HEALTHY_NAMES = {"healthy", "normal", "fresh_leaf", "healthy_leaf", "healthy_leaves", "healthy_sample", "healthy_rice_leaf"}


def one_crop(crop: str, rename: dict[str, str] | None = None, skip: tuple[str, ...] = ()) -> LabelFn:
    """For a set of one crop: its class names in snake case, without the crop's own name or a
    trailing "disease" ("Rice Blast" → rice___blast, "Leaf Spot Disease" → leaf_spot), healthy
    classes as healthy, renames for the rest, and the classes in `skip` left out."""
    rename = rename or {}
    words = {snake(crop), snake(crop.replace("_", " ").split()[-1])}

    def label(_row: dict, label_name: str) -> str | None:
        name = snake(label_name)
        if name in skip:
            return None
        short = name
        for word in words:
            if short.startswith(word + "_"):
                short = short[len(word) + 1:]
        short = re.sub(r"_disease$", "", short)
        if name in rename or short in rename:
            return f"{crop}___{rename.get(name) or rename[short]}"
        if name in HEALTHY_NAMES or short in HEALTHY_NAMES or name.startswith("healthy"):
            return f"{crop}___healthy"
        return f"{crop}___{short}" if short else None
    return label


# Same crop or disease under different names in different sources. Maize is "corn" (PlantDoc's
# name). Rust is one label: several sources do not say which maize rust a photo shows.
CROP_ALIASES = {"maize": "corn", "soyabean": "soybean"}
DISEASE_ALIASES = {"common_rust": "rust"}


def canonical(label: str) -> str:
    crop, _, disease = label.partition("___")
    return f"{CROP_ALIASES.get(crop, crop)}___{DISEASE_ALIASES.get(disease, disease)}"


@dataclass(frozen=True)
class Source:
    repo: str
    licence: str
    credit: str
    label: LabelFn
    # How test photos are chosen: "splits" (the source's own test split), "column" (its own
    # train/test column) or "holdout" (15% of its photos, scored apart from the headline).
    test: str
    config: str | None = None
    splits: tuple[str, ...] = ("train",)
    test_splits: tuple[str, ...] = ()
    min_side: int = 0  # skip photos smaller than this many pixels on the short side
    # Detection sets: each box category that becomes a photo (cut out of the image), by label.
    boxes: dict[str, str] | None = None
    # A box category that marks the whole fruit or leaf, sick or not: it counts as healthy only
    # when no box of another category covers the same object.
    plain_box: str | None = None


SOURCES: dict[str, Source] = {
    "plantdoc": Source("geraldmc/plantdoc-full", "CC-BY-4.0", "Singh et al. 2020, PlantDoc (web photos, field conditions)",
                       plantdoc_label, "column"),
    "cassava": Source("andrewkatumba/cassava_leaf_diseases_dsa_2023", "CC-BY-SA-4.0", "Data Science Africa 2023 cassava set",
                      by_name({"cbsd": "cassava___brown_streak", "cmd": "cassava___mosaic", "healthy": "cassava___healthy"}),
                      "splits", splits=("train", "test"), test_splits=("test",)),
    "beans_ug": Source("Project-AgML/bean_disease_classification_uganda", "CC0-1.0",
                       "Makerere University BeanWatchNet set, phone photos from farmers' fields in Uganda",
                       # Its "unknown" class holds other crops among unrelated pictures, so it is left out.
                       by_name({"als": "bean___angular_leaf_spot", "bean_rust": "bean___rust", "healthy": "bean___healthy"}),
                       "column"),
    "maize": Source("InriaXagriscienceFM/maize_corn_corn_leaf_disease_detection", "CC-BY-4.0", "Mendeley hmkd6nbngr, via AgML",
                    by_name({"Common Rust": "corn___rust", "Corn Leaf Blight": "corn___leaf_blight", "Gray Leaf Spot": "corn___gray_leaf_spot",
                             "Healthy": "corn___healthy", "Insects damage": "corn___insect_damage"}), "holdout"),
    "maize_tz": Source("Project-AgML/maize_disease_classification", "CC-BY-4.0", "Mduma et al. 2024, maize imagery dataset, Tanzania",
                       by_name({"Healthy": "corn___healthy", "MLN": "corn___lethal_necrosis", "MSV": "corn___streak_virus"}), "holdout"),
    "beans_tz": Source("Project-AgML/bean_disease_classification_tanzania", "CC-BY-4.0", "Laizer et al. 2024, common bean rust and anthracnose",
                       by_name({"anthracnose": "bean___anthracnose", "healthy": "bean___healthy", "rust": "bean___rust"}), "holdout"),
    "bean_cowpea": Source("Project-AgML/bean_cowpea_leaf_disease_classification", "CC-BY-4.0", "Bean and cowpea leaf disease set, via AgML",
                          by_crop_column({"Bacterial wilt": "bacterial_wilt", "Blight": "blight", "Fresh Leaf": "healthy",
                                          "Mosaic Virus": "mosaic_virus", "Rust": "rust", "Septoria leaf spot": "septoria_leaf_spot"}), "holdout"),
    "coffee": Source("Project-AgML/arabica_coffee_leaf_disease_classification", "CC-BY-4.0", "Jepkoech et al. 2021, Arabica coffee leaves (JMuBEN)",
                     by_name({"Cerscospora": "coffee___cercospora_leaf_spot", "Healthy": "coffee___healthy", "Leaf_rust": "coffee___leaf_rust",
                              "Miner": "coffee___leaf_miner", "Phoma": "coffee___phoma_leaf_spot"}), "holdout"),
    "banana": Source("Project-AgML/banana_leaf_disease_classification", "CC-BY-4.0", "Genet et al. 2024, Sigatoka and Xanthomonas wilt",
                     by_name({"healthy": "banana___healthy", "segatoka": "banana___sigatoka", "xamthomonas": "banana___xanthomonas_wilt"}), "holdout"),
    "banana_tz": Source("Project-AgML/banana_disease_classification_tanzania", "CC0-1.0", "Mduma et al. 2023, banana leaves, Tanzania",
                        by_name({"black_sigatoka": "banana___sigatoka", "fusarium_wilt": "banana___fusarium_wilt", "healthy": "banana___healthy"}),
                        "holdout"),
    "potato": Source("Project-AgML/potato_leaf_disease_classification", "CC-BY-4.0", "Shabrina et al. 2024, potato leaves in uncontrolled conditions",
                     by_name({"Bacteria": "potato___bacterial_disease", "Fungi": "potato___fungal_disease", "Healthy": "potato___healthy",
                              "Nematode": "potato___nematode", "Pest": "potato___pest_damage", "Phytopthora": "potato___late_blight",
                              "Virus": "potato___virus"}), "holdout"),
    "tom2024": Source("Project-AgML/TOM2024_disease_classification", "CC-BY-4.0", "TOM2024 tomato, onion and maize set (original photos only)",
                      tom2024_label, "holdout", config="raw", min_side=96),
    # Single-crop sets, each with its original photos only (never a set's "augmented" copies).
    "rice": Source("Project-AgML/rice_disease_classification_bangladesh", "CC-BY-4.0", "Rice disease set, Bangladesh, original photos",
                   one_crop("rice", {"insect": "insect_damage", "leaffolder": "leaf_folder"}, skip=("rice",)), "holdout", config="raw"),
    "groundnut": Source("Project-AgML/groundnut_leaf_disease_classification", "CC-BY-4.0", "Sasmal et al. 2024, groundnut leaves",
                        one_crop("groundnut"), "holdout"),
    "cotton": Source("Project-AgML/cotton_leaf_disease_classification_bangladesh_2", "CC-BY-4.0", "Cotton leaf set, Bangladesh, original photos",
                     one_crop("cotton", {"leaf_redding": "leaf_reddening", "herbicide_growth_damage": "herbicide_damage",
                                         "leaf_hopper_jassids": "leafhopper_jassids"}), "holdout", config="raw"),
    "sugarcane": Source("Project-AgML/sugarcane_leaf_disease_classification", "CC-BY-4.0", "Sugarcane leaf disease set",
                        one_crop("sugarcane", {"brownrust": "brown_rust", "viral_disease": "viral"}), "holdout"),
    "soybean": Source("Project-AgML/soybean_leaf_disease_classification", "CC-BY-4.0", "Soybean leaf disease set",
                      one_crop("soybean", skip=("root_images",)), "holdout"),
    "soybean_mh": Source("Project-AgML/MH_SoyaHealthVision_disease_classification_leaf", "CC-BY-4.0", "MH SoyaHealthVision soybean leaves, India",
                         one_crop("soybean", {"spectoria_brown_spot": "septoria_brown_spot", "frog_leaf_eye": "frogeye_leaf_spot",
                                              "caterpillar_semilooper_pest": "semilooper"}), "holdout"),
    "sunflower": Source("Project-AgML/sunflower_disease_classification", "CC-BY-4.0", "Sara et al. 2022, sunflower leaves",
                        one_crop("sunflower"), "holdout"),
    "orange": Source("Project-AgML/citrusuat_disease_classification", "CC-BY-4.0", "CitrusUAT orange leaves, incl. nutrient deficiencies",
                     one_crop("orange", {"fe": "iron_deficiency", "mg": "magnesium_deficiency", "mn": "manganese_deficiency",
                                         "n": "nitrogen_deficiency", "zn": "zinc_deficiency", "hlb": "huanglongbing"}), "holdout"),
    "lemon": Source("Project-AgML/lemon_leaf_disease_classification", "CC-BY-4.0", "Lemon leaf set, original photos",
                    one_crop("lemon", {"deficiency_leaf": "nutrient_deficiency"}), "holdout", config="raw"),
    "papaya": Source("Project-AgML/papaya_leaf_disease_classification_bangladesh", "CC-BY-4.0", "Papaya leaf set, Bangladesh, original photos",
                     one_crop("papaya"), "holdout", config="raw"),
    "guava": Source("Project-AgML/guava_disease_classification", "CC-BY-4.0", "Guava leaves and fruit, original photos",
                    one_crop("guava", {"styler_end_root": "styler_end_rot"}), "holdout", config="raw"),
    "okra": Source("Project-AgML/OkraDiseaseNet_disease_classification", "CC-BY-4.0", "OkraDiseaseNet okra leaves",
                   one_crop("okra", {"leaf_curly_virus": "leaf_curl_virus"}), "holdout"),
    "chili": Source("Project-AgML/COLD_chili_leaf_disease_classification", "CC-BY-4.0", "COLD chili leaves, original photos",
                    one_crop("chili", {"mites_and_trips": "mites_and_thrips", "nutritional": "nutrient_deficiency"}), "holdout", config="raw"),
    "onion": Source("Project-AgML/COLD_onion_leaf_disease_classification", "CC-BY-4.0", "COLD onion leaves, original photos",
                    one_crop("onion", {"stemphylium_leaf_blight_and_collectrichum_leaf_blight": "leaf_blight"}), "holdout", config="raw"),
    "watermelon": Source("Project-AgML/watermelon_disease_classification", "CC-BY-4.0", "Watermelon set, original photos",
                         one_crop("watermelon"), "holdout", config="raw"),
    "pepper": Source("Project-AgML/pepper_disease_pest_classification", "CC-BY-4.0", "Pepper plants in the field, Shouguang, China",
                     one_crop("pepper", {"alternaria_boltch": "alternaria_blotch"}), "holdout"),
    "cauliflower": Source("Project-AgML/cauliflower_leaf_disease_classification", "CC-BY-4.0", "Durjoy et al. 2025, cauliflower leaves",
                          one_crop("cauliflower"), "holdout"),
    "date_palm": Source("Project-AgML/date_palm_leaf_disease_classification", "CC-BY-4.0", "Date palm leaves, incl. nutrient deficiencies",
                        one_crop("date_palm", {"parlatoria_blanchardi": "parlatoria_scale"}), "holdout"),
    "tea": Source("Project-AgML/teaLeafBD_disease_classification", "CC-BY-4.0", "TeaLeafBD tea leaves, Bangladesh",
                  one_crop("tea", {"tea_algal_leaf_spot": "algal_leaf_spot"}), "holdout"),
    "tea_bd": Source("Project-AgML/tea_leaf_disease_classification_bangladesh", "CC-BY-4.0", "Bormon et al. 2025, tea leaves, Bangladesh",
                     one_crop("tea"), "holdout"),
    "black_gram": Source("Project-AgML/blackgram_plant_leaf_disease_classification", "CC-BY-4.0", "Talasila et al. 2022, black gram leaves",
                         one_crop("black_gram", {"leaf_crinckle": "leaf_crinkle"}), "holdout"),
    "lentil": Source("Project-AgML/lentil_disease_classification", "CC-BY-4.0", "Mahamud et al. 2025, lentil plants",
                     one_crop("lentil"), "holdout"),
    "pomegranate": Source("Project-AgML/pomegranate_disease_classification_india", "CC-BY-4.0", "Pakruddin et al. 2024, pomegranate fruit, India",
                          one_crop("pomegranate"), "holdout"),
    "grape": Source("Project-AgML/grape_leaf_disease_classification", "CC-BY-4.0", "Dharrao et al. 2025, grape leaves",
                    one_crop("grape"), "holdout"),
    "eggplant": Source("Project-AgML/eggplant_disease_classification", "CC-BY-4.0", "Eggplant set, original photos",
                       one_crop("eggplant", {"insect_pest_disease": "insect_pest"}), "holdout", config="raw"),
    # More rice: field photos from India and Bangladesh.
    "rice_in": Source("Project-AgML/rice_leaf_disease_classification_india", "CC-BY-4.0", "Sethy et al. 2020, rice leaves, India",
                      one_crop("rice", {"bacterialblight": "bacterial_leaf_blight", "brownspot": "brown_spot"}), "holdout"),
    "rice_dhan": Source("Project-AgML/Dhan-Shomadhan_rice_leaf_disease_classification", "CC-BY-4.0",
                        "Dhan-Shomadhan rice leaves in the field, Bangladesh",
                        one_crop("rice", {"browon_spot": "brown_spot", "leaf_scaled": "leaf_scald", "turgro": "tungro",
                                          "shath_blight": "sheath_blight"}), "holdout"),
    "rice_2": Source("Project-AgML/rice_leaf_disease_classification_2", "CC-BY-4.0", "Rice leaves in the field (published split)",
                     one_crop("rice", {"leaf_blast": "blast"}), "column"),
    "rice_bd": Source("Project-AgML/rice_leaf_disease_classification_bd", "CC-BY-4.0", "Rice leaves, Aman 2025 season, Bangladesh, iPhone",
                      one_crop("rice", {"leaf_blast": "blast"}), "holdout"),
    # Cashew: the CCMT cashew photos (Mensah et al. 2023, Ghana, CC BY 4.0), re-shared on the Hub under MIT.
    "cashew": Source("pt-sk/Cashew_Dataset", "CC-BY-4.0 (CCMT; this copy MIT)", "Mensah et al. 2023, CCMT cashew leaves, Ghana",
                     one_crop("cashew", {"gumosis": "gummosis"}), "holdout"),
    # Cocoa pods from Ghanaian farms: a detection set, so each box is cut out as a photo.
    "cocoa": Source("Project-AgML/cocoa_pod_disease_gh_image_classification", "CC-BY-4.0",
                    "Techie-Menson et al. 2026, cocoa pods in the field, Ghana (boxes cut out)", by_name({}), "column",
                    boxes={"Cocoa": "cocoa___healthy_pod", "Pod Borer": "cocoa___pod_borer", "Black Pod Rot": "cocoa___black_pod_rot"},
                    plain_box="Cocoa"),
}
# Left out on purpose: Project-AgML/corn_maize_leaf_disease re-uses PlantDoc photos (it would put
# PlantDoc test photos into training); Project-AgML/bean_disease_uganda (iBean) comes from the
# same lab as beans_ug and may share photos with its test split; TOM2024's "augmented" config
# holds edited copies; the Kaggle cassava competition set is licensed for non-commercial use only.
# Also left out: sets marked non-commercial (cotton_leaf_disease_classification, tea_leaf_disease_classification,
# eggplant_leaf_disease_classification, MoringaLeafNet) and copies with no licence on record (rice_leaf_disease_classification,
# paddy_disease_classification, orange_leaf_disease_classification, mango_leaf_disease_classification,
# cucumber_disease_classification, coconut_tree_disease_classification, plant_village_classification). The CCMT set
# (cashew, cassava, maize, tomato from Ghanaian farms, CC BY 4.0, Mendeley bwh3zbpkpv) has no copy on the Hub with the
# crop of each photo, so it waits for a loader of its own. MangoLeafBD's Hub copy is CC BY-NC.
# Project-AgML/wheat_disease_detection (CC BY 4.0) names its seven box classes only "0" to "6";
# it waits until the class names are read from its Zenodo record (10.5281/zenodo.15621359).


@dataclass
class Sample:
    jpeg: bytes  # shrunk to a little over the training size, so tens of thousands fit in memory
    label: str
    source: str
    copy_id: int | None = None

    @property
    def image(self):
        from PIL import Image

        return Image.open(io.BytesIO(self.jpeg)).convert("RGB")


def compact(image, size: int) -> bytes:
    """RGB, shorter side at most 1.15 x the training size, stored as JPEG."""
    image = image.convert("RGB")
    short = round(size * 1.15)
    if min(image.size) > short:
        scale = short / min(image.size)
        image = image.resize((max(1, round(image.width * scale)), max(1, round(image.height * scale))))
    buffer = io.BytesIO()
    image.save(buffer, format="JPEG", quality=92)
    return buffer.getvalue()


@dataclass
class Splits:
    train: list[Sample] = field(default_factory=list)
    test: list[Sample] = field(default_factory=list)
    # Sources that could not be used, with the reason; the model card lists them.
    skipped: dict[str, str] = field(default_factory=dict)


def copy_id(sample: Sample) -> int:
    """A 64-bit difference hash taken over the eight turns and mirrors of the photo, so a copy
    that was flipped, rotated or re-saved gets the same number."""
    if sample.copy_id is not None:
        return sample.copy_id
    from PIL import Image

    grey = sample.image.convert("L").resize((36, 36))
    best = None
    for turn in (None, Image.Transpose.ROTATE_90, Image.Transpose.ROTATE_180, Image.Transpose.ROTATE_270):
        turned = grey if turn is None else grey.transpose(turn)
        for view in (turned, turned.transpose(Image.Transpose.FLIP_LEFT_RIGHT)):
            pixels = np.asarray(view.resize((9, 8)), dtype=np.int16)
            bits = (pixels[:, :-1] > pixels[:, 1:]).flatten()
            value = int("".join("1" if b else "0" for b in bits), 2)
            best = value if best is None else min(best, value)
    sample.copy_id = best or 0
    return sample.copy_id


def holdout(samples: list[Sample], share: float, seed: int) -> tuple[list[Sample], list[Sample]]:
    """Stratified split by label; copies of one picture stay on one side."""
    by_label: dict[str, dict[int, list[Sample]]] = {}
    for sample in samples:
        by_label.setdefault(sample.label, {}).setdefault(copy_id(sample), []).append(sample)
    rng = random.Random(seed)
    train, test = [], []
    for groups in by_label.values():
        keys = sorted(groups)
        rng.shuffle(keys)
        want, taken = max(1, round(sum(len(g) for g in groups.values()) * share)), 0
        for key in keys:
            if taken < want:
                test += groups[key]
                taken += len(groups[key])
            else:
                train += groups[key]
    return train, test


def label_names(source: Source, data) -> list[str] | None:
    features = getattr(data, "features", None)
    if features is None:
        from datasets import load_dataset_builder

        features = load_dataset_builder(source.repo, source.config).info.features
    label = features.get("label") if features else None
    return list(label.names) if label is not None and hasattr(label, "names") else None


def stream(source: Source, split: str):
    """Rows of one split, with images left encoded so skipped rows are never decoded."""
    from datasets import Image as HFImage, load_dataset

    data = load_dataset(source.repo, source.config, split=split, streaming=True)
    names = label_names(source, data)
    data = data.cast_column("image", HFImage(decode=False))
    for row in data:
        label = row.get("label")
        yield row, (names[label] if names is not None and isinstance(label, int) else str(label))


def decode(row: dict, size: int, min_side: int) -> bytes | None:
    from PIL import Image

    raw = (row.get("image") or {}).get("bytes")
    if not raw:
        return None
    try:
        image = Image.open(io.BytesIO(raw))
        if min(image.size) < min_side:
            return None
        # JPEGs decode at 1/2, 1/4 or 1/8 scale when that still covers the size kept: several
        # times faster on 10-megapixel field photos.
        short = round(size * 1.15)
        image.draft("RGB", (short, short))
        return compact(image, size)
    except Exception as error:  # a damaged file is skipped, not fatal
        print(f"  skipped an unreadable photo: {error}", flush=True)
        return None


def sample_rows(name: str, source: Source, side_of: Callable[[str, dict], str], caps: dict[str, int | None],
                size: int, rng: random.Random) -> dict[str, list[Sample]]:
    """Streams every row once and keeps, per side and label, a uniform random sample of at most
    caps[side] photos (reservoir sampling), so a 7 GB set needs no disk and little memory."""
    kept: dict[tuple[str, str], list[Sample]] = {}
    seen: dict[tuple[str, str], int] = {}
    for split in source.splits:
        for row, label_name in stream(source, split):
            label = source.label(row, label_name)
            if not label:
                continue
            side, label = side_of(split, row), canonical(label)
            key = (side, label)
            seen[key] = seen.get(key, 0) + 1
            bucket, cap = kept.setdefault(key, []), caps.get(side)
            slot = len(bucket) if cap is None or len(bucket) < cap else rng.randrange(seen[key])
            if cap is not None and slot >= cap:
                continue
            jpeg = decode(row, size, source.min_side)
            if jpeg is None:
                continue
            sample = Sample(jpeg, label, name)
            if slot >= len(bucket):
                bucket.append(sample)
            else:
                bucket[slot] = sample
    out: dict[str, list[Sample]] = {}
    for (side, _label), bucket in kept.items():
        out.setdefault(side, []).extend(bucket)
    return out


def load_source(name: str, args, rng: random.Random) -> tuple[list[Sample], list[Sample]]:
    source = SOURCES[name]
    train_cap, test_cap = args.max_train_per_label, args.max_test_per_label
    if source.boxes:
        train, test = load_box_source(name, source, args)
        if not test:
            HOLDOUT_FALLBACK.add(name)
            train, test = holdout(train, 0.15, args.seed)
            test = cap_per_label(test, test_cap, rng)
        return cap_per_label(train, train_cap, rng), test
    if source.test == "holdout":
        pool_cap = None if train_cap is None else round(train_cap / 0.85) + 1
        pool = sample_rows(name, source, lambda _split, _row: "pool", {"pool": pool_cap}, args.size, rng).get("pool", [])
        train, test = holdout(pool, 0.15, args.seed)
        return cap_per_label(train, train_cap, rng), cap_per_label(test, test_cap, rng)
    if source.test == "column":
        def side_of(_split, row):
            return "test" if row.get("split") == "test" else "train"
    else:
        def side_of(split, _row):
            return "test" if split in source.test_splits else "train"
    # A published test split is scored whole: it is the source's own choice of unseen photos.
    sides = sample_rows(name, source, side_of, {"train": train_cap, "test": None}, args.size, rng)
    train, test = sides.get("train", []), sides.get("test", [])
    if train and not test:
        # The split column or test split was empty: hold out 15% instead, scored with the holdouts.
        HOLDOUT_FALLBACK.add(name)
        train, test = holdout(train, 0.15, args.seed)
        test = cap_per_label(test, test_cap, rng)
    return train, test


def cap_per_label(samples: list[Sample], cap: int | None, rng: random.Random) -> list[Sample]:
    if cap is None:
        return samples
    by_label: dict[str, list[Sample]] = {}
    for sample in samples:
        by_label.setdefault(sample.label, []).append(sample)
    out = []
    for group in by_label.values():
        rng.shuffle(group)
        out += group[:cap]
    return out


# Sources whose published test split came back empty and fell back to a 15% holdout: their test
# photos are scored with the holdouts, never in the headline.
HOLDOUT_FALLBACK: set[str] = set()


def share_inside(inner: list[float], outer: list[float]) -> float:
    """How much of the `inner` [x, y, width, height] box lies inside `outer`, 0 to 1."""
    w = min(inner[0] + inner[2], outer[0] + outer[2]) - max(inner[0], outer[0])
    h = min(inner[1] + inner[3], outer[1] + outer[3]) - max(inner[1], outer[1])
    area = inner[2] * inner[3]
    return max(0.0, w) * max(0.0, h) / area if area > 0 else 0.0


def cut_box(image, box: list[float], min_side: int = 48, margin: float = 0.1):
    """The box with a little margin around it; None when it is too small to show anything."""
    x, y, w, h = box
    if min(w, h) < min_side:
        return None
    dx, dy = w * margin, h * margin
    left, top = max(0, int(x - dx)), max(0, int(y - dy))
    right, bottom = min(image.width, int(x + w + dx)), min(image.height, int(y + h + dy))
    return image.crop((left, top, right, bottom)) if right > left and bottom > top else None


def box_names(source: Source, data) -> list:
    features = getattr(data, "features", None)
    if features is None:
        from datasets import load_dataset_builder

        features = load_dataset_builder(source.repo, source.config).info.features
    categories = features["objects"]["categories"]
    return list(getattr(categories, "feature", categories).names)


def load_box_source(name: str, source: Source, args) -> tuple[list[Sample], list[Sample]]:
    """Each labelled box of a detection set as a photo; the set's own split column decides the side."""
    from datasets import load_dataset

    data = load_dataset(source.repo, source.config, split="train", streaming=True)
    names = box_names(source, data)
    train, test = [], []
    for row in data:
        boxes, categories = row["objects"]["bbox"], row["objects"]["categories"]
        image = row["image"].convert("RGB")
        for box, category in zip(boxes, categories):
            category_name = names[category] if category is not None and 0 <= category < len(names) else None
            label = (source.boxes or {}).get(category_name)
            if not label:
                continue
            # A pod or leaf with a disease box (mostly) inside it is not a healthy one.
            if category_name == source.plain_box and any(
                    other != category and share_inside(other_box, box) >= 0.5 for other_box, other in zip(boxes, categories)):
                continue
            crop = cut_box(image, box)
            if crop is not None:
                (test if row.get("split") == "test" else train).append(Sample(compact(crop, args.size), canonical(label), name))
    return train, test


def drop_copies_of_test_photos(splits: Splits) -> int:
    """Training photos that are copies of any test photo (sources sometimes share pictures)."""
    test_ids = {copy_id(sample) for sample in splits.test}
    before = len(splits.train)
    splits.train = [sample for sample in splits.train if copy_id(sample) not in test_ids]
    return before - len(splits.train)


def load_sources(names: list[str], args) -> Splits:
    rng = random.Random(args.seed)
    splits = Splits()
    for name in names:
        started = time.time()
        print(f"Loading {name} from {SOURCES[name].repo}", flush=True)
        # One source that cannot be read (moved, renamed labels, a network failure) is skipped and
        # reported, so a long run over many sources still produces a model.
        try:
            train, test = load_source(name, args, rng)
        except Exception as error:
            splits.skipped[name] = f"{type(error).__name__}: {error}"[:300]
            print(f"  WARNING: skipped {name}: {splits.skipped[name]}", flush=True)
            continue
        if not train or not test:
            splits.skipped[name] = f"{len(train)} training and {len(test)} test photos"
            print(f"  WARNING: skipped {name}: {splits.skipped[name]}; check its labels and splits", flush=True)
            continue
        splits.train += train
        splits.test += test
        print(f"  {name}: {len(train)} training and {len(test)} test photos in {time.time() - started:.0f}s", flush=True)
    dropped = drop_copies_of_test_photos(splits)
    print(f"Dropped {dropped} training photos that copy a test photo", flush=True)
    return splits


def smoke_sources(seed: int) -> Splits:
    """Generated images in two colours per class: enough to run every step, nothing more."""
    from PIL import Image

    rng = random.Random(seed)
    labels = ["corn___rust", "corn___healthy", "cassava___mosaic"]
    colours = {"corn___rust": (150, 80, 30), "corn___healthy": (40, 140, 40), "cassava___mosaic": (170, 170, 60)}
    splits = Splits()
    for label in labels:
        for i in range(24):
            base = colours[label]
            pixel = tuple(min(255, max(0, c + rng.randint(-20, 20))) for c in base)
            image = Image.new("RGB", (96, 96), pixel)
            (splits.test if i < 6 else splits.train).append(Sample(compact(image, 96), label, "smoke"))
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


def seconds_per_batch(model, loader, loss_fn, lr: float, device: str) -> float:
    """Times training steps on a copy of the model, so the real model is untouched."""
    import copy

    import torch

    probe = copy.deepcopy(model).to(device).train()
    optimiser = torch.optim.AdamW(probe.parameters(), lr=lr)
    timed, started = 0, None
    for step, (images, targets) in enumerate(loader):
        if step == 5:  # the first batches include starting the loader's workers
            started = time.time()
        loss = loss_fn(probe(images.to(device)), targets.to(device))
        optimiser.zero_grad()
        loss.backward()
        optimiser.step()
        if started is not None:
            timed += 1
        if timed >= 20:
            break
    del probe
    return (time.time() - started) / max(1, timed) if started else 0.0


def epochs_that_fit(args, batches_per_epoch: int, per_batch: float, test_photos: int) -> int:
    """As many of the requested epochs as fit before the deadline, keeping time to export and score."""
    if not getattr(args, "deadline", None) or per_batch <= 0:
        return args.epochs
    reserve = 300 + 0.03 * test_photos
    remaining = args.deadline - time.time() - reserve
    fit = int(remaining // (per_batch * batches_per_epoch * 1.05))
    return max(1, min(args.epochs, fit))


def train(model, samples: list[Sample], labels: list[str], args, test_photos: int = 0) -> int:
    """Trains in place and returns the number of epochs run."""
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
    loss_fn = torch.nn.CrossEntropyLoss(label_smoothing=0.1)
    device = "cuda" if torch.cuda.is_available() else "cpu"
    epochs = args.epochs
    if not args.smoke:
        per_batch = seconds_per_batch(model, loader, loss_fn, args.lr, device)
        epochs = epochs_that_fit(args, len(loader), per_batch, test_photos)
        print(f"{per_batch:.2f}s per batch, {len(loader)} batches per epoch: training {epochs} of {args.epochs} epochs "
              f"to finish within the time budget", flush=True)
    optimiser = torch.optim.AdamW(model.parameters(), lr=args.lr, weight_decay=0.05)
    steps = epochs * len(loader)
    schedule = torch.optim.lr_scheduler.OneCycleLR(optimiser, max_lr=args.lr, total_steps=max(1, steps))
    model.to(device).train()
    for epoch in range(epochs):
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
        print(f"epoch {epoch + 1}/{epochs}: loss {total / max(1, seen):.3f} in {time.time() - started:.0f}s", flush=True)
    model.to("cpu").eval()
    return epochs


def export_onnx(model, labels: list[str], size: int, out: Path) -> tuple[Path, Path]:
    """The float model and an int8 copy; which one ships is decided by their scores."""
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
    quantised = out / "plant-disease.int8.onnx"
    quantize_dynamic(float_path, quantised, weight_type=QuantType.QInt8)
    for path in (float_path, quantised):
        print(f"Exported {path} ({path.stat().st_size / 1e6:.1f} MB, {len(labels)} classes)", flush=True)
    return float_path, quantised


# int8 ships only if it keeps top-3 within this of the float model; MobileNet convolutions often do not.
QUANTISATION_TOLERANCE = 0.02


def choose_model(out: Path, float_path: Path, quantised: Path, float_scores: dict, int8_scores: dict) -> tuple[str, dict]:
    """Copies the chosen file to plant-disease.onnx and says which it was."""
    use_int8 = int8_scores["top3Accuracy"] >= float_scores["top3Accuracy"] - QUANTISATION_TOLERANCE
    chosen, scores = (quantised, int8_scores) if use_int8 else (float_path, float_scores)
    (out / "plant-disease.onnx").write_bytes(chosen.read_bytes())
    float_path.unlink()
    quantised.unlink()
    return ("int8" if use_int8 else "float32"), scores


def crop_of(label: str) -> str:
    return label.split("___", 1)[0]


def is_published(sample: Sample) -> bool:
    """Test photos from a split the source published (or the smoke run's), not a 15% holdout."""
    return sample.source == "smoke" or (SOURCES[sample.source].test != "holdout" and sample.source not in HOLDOUT_FALLBACK)


@dataclass
class Prediction:
    source: str
    label: str
    ranked: list[str]  # labels, most likely first
    confidence: float  # probability of the top label


def predict(model_path: Path, samples: list[Sample], labels: list[str], size: int) -> list[Prediction]:
    """Runs the exported ONNX file, the one the phone will run."""
    import onnxruntime as ort

    session = ort.InferenceSession(str(model_path), providers=["CPUExecutionProvider"])
    tf = transforms(size, train=False)
    out = []
    for sample in samples:
        probabilities = session.run(None, {"input": tf(sample.image).unsqueeze(0).numpy()})[0][0]
        order = np.argsort(-probabilities)[:3]
        out.append(Prediction(sample.source, sample.label, [labels[i] for i in order], float(probabilities[order[0]])))
    return out


def rate(hits: int, total: int) -> float:
    return round(hits / max(1, total), 4)


def summarise(predictions: list[Prediction], labels: list[str]) -> dict:
    per_class = {label: {"images": 0, "top1": 0} for label in labels}
    per_source: dict[str, dict[str, int]] = {}
    top1 = top3 = crop_top1 = 0
    for p in predictions:
        hit1, hit3 = p.ranked[0] == p.label, p.label in p.ranked
        top1 += hit1
        top3 += hit3
        crop_top1 += crop_of(p.ranked[0]) == crop_of(p.label)
        per_class[p.label]["images"] += 1
        per_class[p.label]["top1"] += hit1
        source = per_source.setdefault(p.source, {"images": 0, "top1": 0, "top3": 0})
        source["images"] += 1
        source["top1"] += hit1
        source["top3"] += hit3
    n = len(predictions)
    return {
        "images": n,
        "top1Accuracy": rate(top1, n),
        "top3Accuracy": rate(top3, n),
        "cropTop1Accuracy": rate(crop_top1, n),
        "perClass": per_class,
        "perSource": per_source,
    }


# The app treats an answer as sure enough to skip the online check when, on published test
# photos, answers at least that confident were right this often.
CONFIDENT_TARGET = 0.9
CALIBRATION_STEPS = (0.3, 0.4, 0.5, 0.55, 0.6, 0.7, 0.8, 0.85, 0.9, 0.95)


def calibrate(predictions: list[Prediction]) -> dict:
    points = []
    for threshold in CALIBRATION_STEPS:
        above = [p for p in predictions if p.confidence >= threshold]
        points.append({
            "minConfidence": threshold,
            "share": rate(len(above), len(predictions)),
            "top1Accuracy": rate(sum(p.ranked[0] == p.label for p in above), len(above)),
            "images": len(above),
        })
    # The lowest threshold from which every step up (with enough photos to mean something) meets the target.
    counted = [pt for pt in points if pt["images"] >= 50]
    sure = next((pt["minConfidence"] for i, pt in enumerate(counted)
                 if all(q["top1Accuracy"] >= CONFIDENT_TARGET for q in counted[i:])), None)
    return {"basis": "published test splits", "target": CONFIDENT_TARGET, "confidentAt": sure, "points": points}


# A crop counts as sure at confidentAt only with this many test photos at or above it.
MIN_CROP_PHOTOS = 20


def calibrate_crops(calibration: dict, predictions: list[Prediction]) -> None:
    """Adds, per crop, how the answers at or above confidentAt did on all test photos (published
    and holdout), and the crops where they met the target. Most crops have no published test
    split, so the overall threshold is checked crop by crop before the app relies on it."""
    sure_at = calibration["confidentAt"]
    by_crop: dict[str, list[Prediction]] = {}
    for p in predictions:
        by_crop.setdefault(crop_of(p.label), []).append(p)
    crops = {}
    for crop, preds in sorted(by_crop.items()):
        above = [p for p in preds if sure_at is not None and p.confidence >= sure_at]
        crops[crop] = {"images": len(preds), "imagesAtConfidentAt": len(above),
                       "top1AccuracyAtConfidentAt": rate(sum(p.ranked[0] == p.label for p in above), len(above))}
    calibration["crops"] = crops
    calibration["cropsMeetingTarget"] = sorted(
        crop for crop, c in crops.items()
        if c["imagesAtConfidentAt"] >= MIN_CROP_PHOTOS and c["top1AccuracyAtConfidentAt"] >= CONFIDENT_TARGET)


def evaluation_entry(scores: dict, dataset: str) -> dict:
    return {
        "dataset": dataset,
        "images": scores["images"],
        "top1Accuracy": scores["top1Accuracy"],
        "top3Accuracy": scores["top3Accuracy"],
        "cropTop1Accuracy": scores["cropTop1Accuracy"],
        "evaluatedOn": date.today().isoformat(),
        "perSource": {
            source: {"images": v["images"], "top1Accuracy": rate(v["top1"], v["images"]), "top3Accuracy": rate(v["top3"], v["images"])}
            for source, v in scores["perSource"].items()
        },
    }


def write_outputs(out: Path, labels: list[str], headline: dict, holdout_scores: dict | None, calibration: dict, args,
                  sources: list[str], counts: dict, precision: str, float_top3: float, int8_top3: float, train_scores: dict,
                  skipped: dict[str, str] | None = None) -> None:
    published = [s for s in sources if s == "smoke" or (SOURCES[s].test != "holdout" and s not in HOLDOUT_FALLBACK)]
    held = [s for s in sources if s not in published]
    entry = {
        "file": "plant-disease.onnx",
        "name": f"{args.arch}, field photos {date.today().isoformat()}" + (" (smoke run, do not ship)" if args.smoke else ""),
        "labels": labels,
        "output": "probabilities",
        "inputSize": args.size,
        "precision": precision,
        "fieldEvaluation": evaluation_entry(
            headline, "smoke run, generated images" if args.smoke else "published test splits of " + ", ".join(published)),
        "calibration": calibration,
    }
    if holdout_scores and holdout_scores["images"]:
        entry["holdoutEvaluation"] = evaluation_entry(holdout_scores, "random 15% holdouts of " + ", ".join(held))
    if args.smoke:
        entry["fieldEvaluation"]["smoke"] = True
    (out / "manifest.json").write_text(json.dumps({"models": [entry]}, indent=2) + "\n")

    def source_rows(scores: dict) -> list[str]:
        return [f"| {s} | {v['images']} | {v['top1'] / max(1, v['images']):.1%} | {v['top3'] / max(1, v['images']):.1%} |"
                for s, v in scores["perSource"].items()]

    lines = [
        f"# Plant disease classifier: {entry['name']}",
        "",
        f"Architecture: `{args.arch}` from timm, ImageNet weights, fine-tuned {getattr(args, 'epochs_run', args.epochs)} epochs "
        f"(of {args.epochs} asked) at {args.size}px.",
        f"Output: softmax probabilities over {len(labels)} labels on {len({crop_of(label) for label in labels})} crops (manifest.json).",
        f"Shipped as {precision}; every number below is for the shipped file. Float32 top-3 {float_top3:.1%}, int8 top-3 "
        f"{int8_top3:.1%}; int8 ships only within {QUANTISATION_TOLERANCE:.0%} of float.",
        f"Top-1 on {train_scores['images']} training photos (fit check): {train_scores['top1Accuracy']:.1%}.",
        "",
        "## Field evaluation (the app's gate)",
        "",
        "Test photos the sources published as their own test split, which none of the training photos come from.",
        "",
        f"Photos: {headline['images']}. Top-1 {headline['top1Accuracy']:.1%}, top-3 {headline['top3Accuracy']:.1%}, "
        f"crop top-1 {headline['cropTop1Accuracy']:.1%}.",
        "",
        "| Source | Photos | Top-1 | Top-3 |",
        "|---|---:|---:|---:|",
        *source_rows(headline),
    ]
    if holdout_scores and holdout_scores["images"]:
        lines += [
            "",
            "## Holdout evaluation (not used by the gate)",
            "",
            "15% of each remaining source, held out before training. These photos come from the same collections, often the",
            "same fields and days, as the training photos, so expect these numbers to be higher than on new photos.",
            "",
            f"Photos: {holdout_scores['images']}. Top-1 {holdout_scores['top1Accuracy']:.1%}, top-3 {holdout_scores['top3Accuracy']:.1%}, "
            f"crop top-1 {holdout_scores['cropTop1Accuracy']:.1%}.",
            "",
            "| Source | Photos | Top-1 | Top-3 |",
            "|---|---:|---:|---:|",
            *source_rows(holdout_scores),
        ]
    lines += [
        "",
        "## Confidence",
        "",
        "How often the top answer was right when the model was at least this sure, on the published test photos.",
        f"The app shows an answer without asking the online model only at {calibration['confidentAt']} or above"
        f" (top-1 at least {CONFIDENT_TARGET:.0%} here)." if calibration["confidentAt"] is not None else
        f"No confidence reached {CONFIDENT_TARGET:.0%} top-1 on at least 50 photos, so the app keeps asking the online model.",
        "",
        "| At least | Share of photos | Top-1 among them |",
        "|---:|---:|---:|",
        *[f"| {pt['minConfidence']:.2f} | {pt['share']:.1%} | {pt['top1Accuracy']:.1%} |" for pt in calibration["points"]],
        "",
        "Most crops have no published test split, so the same threshold is checked on each crop's test photos (published",
        f"and holdout). The app skips the online check only for crops where answers at that confidence were right at least",
        f"{CONFIDENT_TARGET:.0%} of the time on {MIN_CROP_PHOTOS}+ photos: "
        + (", ".join(calibration.get("cropsMeetingTarget") or []) or "none") + ".",
        "",
        "| Crop | Test photos | At or above the threshold | Top-1 among them |",
        "|---|---:|---:|---:|",
        *[f"| {crop} | {c['images']} | {c['imagesAtConfidentAt']} | {c['top1AccuracyAtConfidentAt']:.1%} |"
          for crop, c in (calibration.get("crops") or {}).items()],
        "",
        "## Per label",
        "",
        "| Label | Train photos | Test photos | Top-1 |",
        "|---|---:|---:|---:|",
    ]
    per_class = {label: {"images": 0, "top1": 0} for label in labels}
    for scores in (headline, holdout_scores or {"perClass": {}}):
        for label, c in scores["perClass"].items():
            per_class[label]["images"] += c["images"]
            per_class[label]["top1"] += c["top1"]
    for label in labels:
        c = per_class[label]
        lines.append(f"| {label} | {counts.get(label, 0)} | {c['images']} | {c['top1'] / max(1, c['images']):.1%} |")
    lines += ["", "## Data and licences", ""]
    if skipped:
        lines += ["Sources that could not be used in this run:", ""]
        lines += [f"- {name}: {reason}" for name, reason in skipped.items()]
        lines.append("")
    for name in sources:
        source = SOURCES.get(name)
        if source is None:
            lines.append(f"- {name}: generated images (smoke run)")
            continue
        config = f", config `{source.config}`" if source.config else ""
        lines.append(f"- {name}: [{source.repo}](https://huggingface.co/datasets/{source.repo}){config}, {source.licence}. {source.credit}.")
    lines += [
        "",
        "CC-BY data must be credited wherever the model is shown or shared; CC-BY-SA data adds share-alike terms",
        "for derived works. Check both before a public release.",
        "",
        "## Limits",
        "",
        "- Only the labels above. A photo of anything else still gets the nearest of them, so the app shows the top",
        "  three, withholds treatment advice for labels it has no checked advice for, and offers the online check.",
        "- Several labels are coarse (for example potato fungal disease, bean blight); they say what kind of problem it is,",
        "  not which pathogen.",
        "- The confidence table comes from public test sets. Photos taken by the app's officers may score lower; score",
        "  them before relying on it (the acceptance gate in docs/specs/PHASE2-OFFLINE-DIAGNOSIS-MODEL.md).",
    ]
    (out / "MODEL_CARD.md").write_text("\n".join(lines) + "\n")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--sources", default=",".join(SOURCES), help=f"Comma-separated, from: {', '.join(SOURCES)}")
    parser.add_argument("--arch", default="mobilenetv3_small_100")
    parser.add_argument("--size", type=int, default=224)
    parser.add_argument("--epochs", type=int, default=10, help="At most this many; fewer when the time budget needs it")
    parser.add_argument("--time-budget-minutes", type=float, default=None,
                        help="Finish within this many minutes of starting (the workflow sets it below the job's limit)")
    parser.add_argument("--batch-size", type=int, default=48)
    parser.add_argument("--lr", type=float, default=2e-3)
    parser.add_argument("--workers", type=int, default=2)
    parser.add_argument("--max-train-per-label", type=int, default=1000, help="Training photos kept per label and source")
    parser.add_argument("--max-test-per-label", type=int, default=200, help="Holdout test photos kept per label and source")
    parser.add_argument("--min-photos-per-label", type=int, default=20, help="Drop labels with fewer training photos")
    parser.add_argument("--seed", type=int, default=7)
    parser.add_argument("--out", type=Path, required=True)
    parser.add_argument("--push-to", help="Hugging Face model repo to upload the outputs to, e.g. org/plant-disease-edge")
    parser.add_argument("--smoke", action="store_true", help="Run every step on generated images; the numbers mean nothing")
    args = parser.parse_args()
    args.deadline = time.time() + args.time_budget_minutes * 60 if args.time_budget_minutes else None

    import torch

    random.seed(args.seed)
    np.random.seed(args.seed)
    torch.manual_seed(args.seed)
    args.out.mkdir(parents=True, exist_ok=True)

    sources = ["smoke"] if args.smoke else [s.strip() for s in args.sources.split(",") if s.strip()]
    unknown = [s for s in sources if s != "smoke" and s not in SOURCES]
    if unknown:
        print(f"Unknown sources: {', '.join(unknown)}. Choose from: {', '.join(SOURCES)}", file=sys.stderr)
        return 2
    splits = smoke_sources(args.seed) if args.smoke else load_sources(sources, args)
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
    published = [s for s in splits.test if is_published(s)]
    print(f"{len(splits.train)} training photos; {len(published)} published and {len(splits.test) - len(published)} holdout "
          f"test photos; {len(labels)} labels", flush=True)
    if len(labels) < 2 or not published:
        print("Not enough labelled photos to train and evaluate.", file=sys.stderr)
        return 1

    model = build_model(args.arch, len(labels), pretrained=not args.smoke)
    args.epochs_run = train(model, splits.train, labels, args, len(splits.test))
    float_path, quantised = export_onnx(model, labels, args.size, args.out)
    float_predictions = predict(float_path, splits.test, labels, args.size)
    int8_predictions = predict(quantised, splits.test, labels, args.size)
    float_all, int8_all = summarise(float_predictions, labels), summarise(int8_predictions, labels)
    fit_sample = random.Random(args.seed).sample(splits.train, min(500, len(splits.train)))
    train_scores = summarise(predict(float_path, fit_sample, labels, args.size), labels)
    print(f"All test photos, top-3: float32 {float_all['top3Accuracy']:.1%}, int8 {int8_all['top3Accuracy']:.1%}; "
          f"training photos top-1 {train_scores['top1Accuracy']:.1%}", flush=True)
    precision, _ = choose_model(args.out, float_path, quantised, float_all, int8_all)
    shipped = int8_predictions if precision == "int8" else float_predictions
    headline_predictions = [p for p, s in zip(shipped, splits.test) if is_published(s)]
    holdout_predictions = [p for p, s in zip(shipped, splits.test) if not is_published(s)]
    headline = summarise(headline_predictions, labels)
    holdout_scores = summarise(holdout_predictions, labels) if holdout_predictions else None
    calibration = calibrate(headline_predictions)
    calibrate_crops(calibration, shipped)
    print(f"Shipping the {precision} model", flush=True)
    for name, scores in (("published test splits", headline), ("holdouts", holdout_scores)):
        if scores:
            print(name, json.dumps({k: v for k, v in scores.items() if k != "perClass"}, indent=2), flush=True)
    print("calibration", json.dumps(calibration, indent=2), flush=True)
    used = [s for s in sources if s not in splits.skipped]
    write_outputs(args.out, labels, headline, holdout_scores, calibration, args, used, counts, precision,
                  float_all["top3Accuracy"], int8_all["top3Accuracy"], train_scores, splits.skipped)

    if args.push_to:
        from huggingface_hub import HfApi

        api = HfApi()
        api.create_repo(args.push_to, repo_type="model", exist_ok=True, private=True)
        api.upload_folder(folder_path=str(args.out), repo_id=args.push_to, repo_type="model")
        print(f"Uploaded to https://huggingface.co/{args.push_to}", flush=True)
    return 0


if __name__ == "__main__":
    sys.exit(main())
