# On-device plant disease models

This folder is served at `/models/` (nginx `location /models/`, copied by the Dockerfile) and
holds the disease classifier the app may run on a phone with no connection.

## What runs today

No model yet. `manifest.json` lists none, so every offline plant photo gets the colour and spot
check in `src/services/edgePlantVisionClassifier.ts`. That check finds the leaf, marks
discoloured areas and suggests what they may be; it is labelled as a colour check, always needs
confirming and never gives treatment advice. Photos can be queued for the cloud analysis.

A trained model is waiting to be installed. Training run 45370280118 (24 November 2026,
`mobilenetv3_small_100`, 33 labels, 8 epochs) scored on 2,246 held-out photos:

| Held-out photos | Photos | Top-1 | Top-3 |
|---|---:|---:|---:|
| PlantDoc test split (field photos, published split) | 236 | 61.0% | 80.1% |
| Cassava test split (published split) | 150 | 98.0% | 100% |
| Maize, random 15% of the training set | 1,860 | 95.4% | 100% |
| All | 2,246 | 92.0% | 97.9% (crop top-1 97.9%) |

That passes the gate below. Read the PlantDoc row as the honest estimate for photos from new
fields: the maize photos come from the same set the model trained on, so they score high. The
int8 file from the same run scored top-3 40%, so the float32 file (about 6 MB) is the one to ship.

Until November 2026 this folder held three files described as EfficientNet-Lite0, MobileViT-XXS
and YOLOv8n. They were scaffolds with random weights (a pooled colour average into a small
dense layer, 227 to 1.09M parameters) produced by `scripts/ml/export_*_onnx.py`, never trained
on plant photos. They and those scripts were removed; the YOLO "detections" shown to users were
in fact the colour check, and are now labelled as such.

## How a model gets here

1. Train it: the "Train disease model" workflow (it runs when `scripts/ml/train_disease_classifier.py`
   changes on stage), or the script itself. It fine-tunes an ImageNet MobileNetV3 on field photos
   (PlantDoc, handheld maize photos, Ugandan cassava), exports ONNX with softmax output, scores the
   float32 and int8 files on each source's held-out photos, and keeps int8 only within 2 points of
   float32 top-3.
2. Download the run's `plant-disease-model` artifact and read its `MODEL_CARD.md`: per-source and
   per-label results, a fit check on training photos, and the data licences (one source is CC-BY-SA).
3. Install it: `python scripts/ml/install_disease_model.py <unzipped artifact> ag-extension-dashboard/src/frontend/models`.
   A model that passes the gate replaces the listed one; one that does not is recorded as
   `lastCandidate`, which the photo scanner shows as the reason no disease model runs. It also
   records the file's SHA-256 in the manifest. Commit the folder.

Phones keep a downloaded model for up to 30 days. The app loads each model at an address that
carries its SHA-256 (or, without one, a hash of its name, labels and scores), so a new model is
downloaded fresh even under the same file name, and never runs with another model's labels.

The app loads a model only when its manifest entry passes the acceptance gate in
`docs/specs/PHASE2-OFFLINE-DIAGNOSIS-MODEL.md`, checked in `src/services/edgeModelManifest.ts`:

| Measure, on held-out field photos | Floor |
|---|---|
| Photos scored | 300 |
| Right label in the top three | 70% |
| Right crop as the first answer | 60% |

A score on lab photos such as PlantVillage does not count: a model that scores 94% there scored
18.5% on PlantDoc field photos in the study cited in the spec. Smoke runs of the training script
are marked and never load. Before widening use beyond guidance, also score photos taken by the
app's own officers, as the spec asks.

## Manifest entry

The shape of an entry (written by the training script; the numbers are run 45370280118's):

```json
{
  "file": "plant-disease.onnx",
  "name": "mobilenetv3_small_100, field photos 2026-11-24",
  "labels": ["cassava___brown_streak", "cassava___healthy", "corn___common_rust", "..."],
  "output": "probabilities",
  "inputSize": 224,
  "fieldEvaluation": {
    "dataset": "PlantDoc test split, maize random 15% holdout of the training set, cassava test split",
    "images": 2246,
    "top1Accuracy": 0.9199,
    "top3Accuracy": 0.9791,
    "cropTop1Accuracy": 0.9791,
    "evaluatedOn": "2026-11-24"
  }
}
```

The numbers are that run's real results (see the table above for what they mean). Labels are `<crop>___<disease>`;
the app maps the ones it knows to its conditions and ignores the rest. Input is 1x3xNxN float32,
ImageNet-normalised.

## Runtime

`onnxruntime-web` WASM, one thread, served from `/models/ort/`. The service worker keeps `.onnx`
files once downloaded (CacheFirst, 30 days) and the manifest's last copy for offline use
(NetworkFirst). Models are never precached, to keep the install small.
