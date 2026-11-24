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

That passed the gate as it stood then. Read the PlantDoc row as the honest estimate for photos
from new fields: the maize photos come from the same set the model trained on, so they score high.
The int8 file from the same run scored top-3 40%, so the float32 file (about 6 MB) is the one to ship.

The training script now streams twelve sources, adding among others maize lethal necrosis and
streak virus, bean anthracnose and rust, banana Fusarium and Xanthomonas wilt, coffee leaf rust
and potato late blight, and the gate is scored on published test splits only. The run's model
card gives the photo counts. Install that run's model rather than run 45370280118's.

Until November 2026 this folder held three files described as EfficientNet-Lite0, MobileViT-XXS
and YOLOv8n. They were scaffolds with random weights (a pooled colour average into a small
dense layer, 227 to 1.09M parameters) produced by `scripts/ml/export_*_onnx.py`, never trained
on plant photos. They and those scripts were removed; the YOLO "detections" shown to users were
in fact the colour check, and are now labelled as such.

## How a model gets here

1. Train it: the "Train disease model" workflow (it runs when `scripts/ml/train_disease_classifier.py`
   changes on stage; two to three hours), or the script itself. It streams photos from the sources
   listed in `SOURCES` in the script (all CC0, CC-BY or CC-BY-SA; each source's licence and credit
   is in the model card), keeps at most 1,500 training photos per label and source, fine-tunes an
   ImageNet MobileNetV3, exports ONNX with softmax output, and keeps int8 only within 2 points of
   float32 top-3.
2. Download the run's `plant-disease-model` artifact and read its `MODEL_CARD.md`. It reports
   three things: the field evaluation on the sources' published test splits (the gate reads only
   this); a holdout evaluation on 15% of each other source, which flatters the model because those
   photos come from the same collections as the training photos; and a confidence table (below).
   One source is CC-BY-SA; check its terms before a public release.
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

## When the phone's answer replaces the online check

The photo check (Diagnose, photo tab) runs the phone's model before the online AI vision call.
Each online call costs an AI vision request and counts against the plan's vision allowance. The
phone's answer is shown instead, and the online call skipped, only when:

- a released model is installed (it passed the gate),
- the crop typed, if any, is one the model was trained on (otherwise the online check runs),
- the top answer's confidence is at least the manifest's `calibration.confidentAt`: the lowest
  confidence from which, on at least 50 published test photos, the top answer was right at least
  90% of the time. The app ignores a calibration measured on fewer than 300 photos or with a
  lower target, and never uses a value below 0.5. With no calibration, the online check always runs.

The person can still ask for the online check from the phone's answer, and treatment advice stays
withheld until an extension officer confirms. Offline, the photo is queued for the online check and
the phone's answer, if any, is shown meanwhile. How many online calls this saves depends on how
often field photos clear that confidence; the model card's confidence table gives the share for
the test photos.

## Manifest entry

The shape of an entry (written by the training script; the numbers are run 45370280118's, which
predates the calibration and holdout fields, so those show the shape only):

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
  },
  "holdoutEvaluation": { "dataset": "random 15% holdouts of maize, ...", "images": 0, "...": "..." },
  "calibration": {
    "basis": "published test splits",
    "target": 0.9,
    "confidentAt": 0.85,
    "points": [{ "minConfidence": 0.85, "share": 0.0, "top1Accuracy": 0.0, "images": 0 }]
  }
}
```

The `fieldEvaluation` numbers are that run's real results (see the table above for what they
mean). Labels are `<crop>___<disease>` (maize is `corn`, as in PlantDoc). The app names a label
after a known condition only when crop and disease both match (`src/services/edgeModelLabels.ts`);
other labels are shown by their own name, and a healthy label as a healthy leaf. Input is 1x3xNxN
float32, ImageNet-normalised.

## Runtime

`onnxruntime-web` WASM, one thread, served from `/models/ort/`. The service worker keeps `.onnx`
files once downloaded (CacheFirst, 30 days) and the manifest's last copy for offline use
(NetworkFirst). Models are never precached, to keep the install small.
