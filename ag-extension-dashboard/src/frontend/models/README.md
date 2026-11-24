# On-device plant disease models

This folder is served at `/models/` (nginx `location /models/`, copied by the Dockerfile) and
holds the disease classifier the app may run on a phone with no connection.

## What runs today

No model. `manifest.json` lists none, so every offline plant photo gets the colour and spot
check in `src/services/edgePlantVisionClassifier.ts`. That check finds the leaf, marks
discoloured areas and suggests what they may be; it is labelled as a colour check, always needs
confirming and never gives treatment advice. Photos can be queued for the cloud analysis.

Until November 2026 this folder held three files described as EfficientNet-Lite0, MobileViT-XXS
and YOLOv8n. They were scaffolds with random weights (a pooled colour average into a small
dense layer, 227 to 1.09M parameters) produced by `scripts/ml/export_*_onnx.py`, never trained
on plant photos. They and those scripts were removed; the YOLO "detections" shown to users were
in fact the colour check, and are now labelled as such.

## How a model gets here

1. Train it: `scripts/ml/train_disease_classifier.py`, or the "Train disease model" workflow.
   It fine-tunes an ImageNet MobileNetV3 on field photos (PlantDoc, handheld maize photos,
   Ugandan cassava), exports ONNX with softmax output, quantises to int8 and scores the
   quantised file on each source's held-out field photos.
2. Read `MODEL_CARD.md` from the run: per-source and per-label results, and the data licences
   (one source is CC-BY-SA).
3. Copy `plant-disease.onnx` here and add its entry from the run's `manifest.json` to this
   folder's `manifest.json`.

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

```json
{
  "file": "plant-disease.onnx",
  "name": "mobilenetv3_small_100, field photos 2026-12-01",
  "labels": ["cassava___brown_streak", "cassava___healthy", "corn___common_rust", "..."],
  "output": "probabilities",
  "inputSize": 224,
  "fieldEvaluation": {
    "dataset": "plantdoc test split, maize test split, cassava test split",
    "images": 2100,
    "top1Accuracy": 0.61,
    "top3Accuracy": 0.83,
    "cropTop1Accuracy": 0.9,
    "evaluatedOn": "2026-12-01"
  }
}
```

The numbers above only show the shape; they are not results. Labels are `<crop>___<disease>`;
the app maps the ones it knows to its conditions and ignores the rest. Input is 1x3xNxN float32,
ImageNet-normalised.

## Runtime

`onnxruntime-web` WASM, one thread, served from `/models/ort/`. The service worker keeps `.onnx`
files once downloaded (CacheFirst, 30 days) and the manifest's last copy for offline use
(NetworkFirst). Models are never precached, to keep the install small.
