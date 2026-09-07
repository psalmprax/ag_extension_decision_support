# Decision Memo: On-Device Offline Crop-Disease Diagnosis (Phase 2.1)

**Status:** Implementation active — Two-Stage On-Device Architecture adopted
**Decision needed from:** Product owner (accuracy gate acceptance, model license sign-off)

## Adopted Architecture: Two-Stage On-Device Edge Pipeline

```
[Camera / Leaf Specimen]
           │
           ▼
Stage 1: YOLOv8n Agri-Detector (320x320 ONNX)
├── Detects: crop_leaf, foliar_lesion, pest_damage, non_plant_background
├── "Not a leaf" Rejection Guard (rejects non-foliar photos)
└── Bounding Box & Foliar Saliency Overlays
           │ (Foliage Confirmed)
           ▼
Stage 2: MobileViT-XXS Classifier (224x224 ONNX)
├── Hybrid Vision Transformer + Inverted Residual CNN
├── 38 PlantVillage + Regional Crop Disease Classes
└── Cultural, Biological & Chemical Action Protocols
```

| Factor | Value | Evidence |
|---|---|---|
| Model size | Stage 1 YOLOv8n (~3MB INT8) + Stage 2 MobileViT-XXS (~1.8MB INT8) | Total on-device footprint < 5MB; within mobile PWA cache budget |
| Classes | 38 diseases / 14 crops (PlantVillage), localized African pathogens (FAW, MLND, CMD, CBSD, CLR, BXW) | Frontiers / Nature / CIMMYT benchmarks |
| Inference | Stage 1 ~20ms + Stage 2 ~35ms on mid-range mobile CPU | Single-thread WASM via onnxruntime-web |
| Runtime | onnxruntime-web (MIT) — works in Capacitor webview; `@cantoo/capacitor-onnx` available for native acceleration | ORT-Web is the consensus standard for browser/PWA inference |
| Precedent & Scripts | `scripts/ml/export_yolo_onnx.py` & `scripts/ml/export_mobilevit_onnx.py` | Reproducible PyTorch/Timm/Ultralytics export pipeline with quantization |

## The honest number that matters

Lab-vs-field collapse: leafwise measured **94.0% top-1 on PlantVillage but 18.5% top-1 on PlantDoc field photography** (crop-only correctness 52%). PlantVillage is studio leaf photography; fields are not. Every vendor claiming "99%" is quoting lab numbers.

## Mitigations (all adopted)

1. Present **top-3 with probabilities**, never a single answer
2. Flag **<45% confidence as "low confidence — guidance only"**
3. Always show **"Sync for AI confirmation"** — on-device result is preliminary; the existing backend multimodal pipeline confirms when online (feeds diagnosis_events → outbreak intelligence)
4. **"Not a leaf" rejection** implemented via Stage 1 YOLO detector guard
5. Publish both accuracy numbers in-app (honesty as a feature)

## Acceptance gate before enabling beyond "guidance mode"

Collect ≥300 field photos via officers (existing upload pipeline), label with agronomist review (RecommendationReview flow exists), and require:
- Top-1 crop correctness ≥ 60%
- Top-3 disease correctness ≥ 70%
- Otherwise: keep offline mode as photo-capture + queued-confirmation only

## License check

- PlantVillage dataset: CC-BY-SA — attribution required, share-alike on derivatives
- Candidate models: verify model card licenses before shipping; fallback = train in-house weights using provided scripts

## Export & Build Pipeline

1. `python3 scripts/ml/export_yolo_onnx.py --imgsz 320 --int8`
2. `python3 scripts/ml/export_mobilevit_onnx.py --model mobilevit_xxs --int8`
3. Models cached via Workbox `CacheFirst` on `/\/models\/.*\.onnx$/i` for 30 days.
