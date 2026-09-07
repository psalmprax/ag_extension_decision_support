# Edge Agri-Vision ONNX Models — Two-Stage On-Device Diagnosis

This directory houses the on-device Edge AI models running via `onnxruntime-web` (single-thread WASM) inside the browser and Capacitor webview.

## Architecture: Two-Stage Pipeline

```
[User Camera / Foliage Photo]
            │
            ▼
┌───────────────────────────────────────────────┐
│ Stage 1: YOLO Detector (yolo-detector.onnx)   │
│ • Detects: crop_leaf, foliar_lesion,          │
│   pest_damage, non_plant_background           │
│ • "Not a leaf" Rejection Guard                │
│ • Foliar Saliency & Bounding Box Overlays     │
└──────────────────────┬────────────────────────┘
                       │ Valid Foliage
                       ▼
┌───────────────────────────────────────────────┐
│ Stage 2: MobileViT (mobilevit-classifier.onnx)│
│ • Hybrid ViT Transformer + Inverted Residual  │
│ • High accuracy on complex crop textures      │
│ • 38 PlantVillage + Regional Crop Classes     │
└──────────────────────┬────────────────────────┘
                       │
                       ▼
[Ranked Diagnostics + Agronomic Treatments]
```

### 1. Stage 1 Detector: `yolo-detector.onnx`
- **Architecture:** YOLOv8n / YOLOv11n Agri-Vision
- **Input:** `1x3x320x320` float32 NCHW, normalized `[0, 1]`
- **Output:** `output0` `[1, 8, num_anchors]` (4 box coordinates + 4 class probabilities)
- **Classes:** `crop_leaf` (0), `foliar_lesion` (1), `pest_damage` (2), `non_plant_background` (3)
- **Role:** Localizes lesions, isolates leaf lamina from background, rejects non-foliar photos.
- **Export script:** `python3 scripts/ml/export_yolo_onnx.py --imgsz 320 --int8`

### 2. Stage 2 Classifier: `mobilevit-classifier.onnx`
- **Architecture:** MobileViT-XXS (~1.3M parameters, ~5.2MB FP32 / ~1.8MB INT8)
- **Input:** `1x3x224x224` float32 NCHW, ImageNet normalized `mean=[0.485,0.456,0.406] std=[0.229,0.224,0.225]`
- **Output:** `logits` `[1, 38]` softmax probabilities (PlantVillage 38 classes)
- **Role:** High-accuracy disease classification leveraging self-attention and CNN blocks.
- **Export script:** `python3 scripts/ml/export_mobilevit_onnx.py --model mobilevit_xxs --int8`

### 3. Legacy / Fallback Classifier: `plant-disease.onnx`
- **Architecture:** EfficientNet-Lite0 (4.2MB float32, 1.1MB INT8)
- **Role:** Fast lightweight fallback if MobileViT is not present.

## Runtime & Offline Caching
- **Runtime:** `onnxruntime-web@1.19` WASM `numThreads: 1`, `simd: true`
- **Cache:** Workbox `CacheFirst` on `/\/models\/.*\.onnx$/i` for 30 days. Never precached during install to prevent APK/PWA bloat; downloaded on first use and cached permanently for offline field operations.
- **Safety Gate:** `ONNX_MIN_PROBABILITY = 0.55`. Candidates below threshold fall back to calibrated heuristic triage (HSV/LAB + Sobel edge density) with an invitation to verify via Cloud Multimodal Vision AI when online.
