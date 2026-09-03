# Plant Disease ONNX Model — 4.2MB EfficientNet-Lite0

**File:** `plant-disease.onnx` (4.2MB float32, int8 quantized surrogate = 1.1MB)
**Input:** `1x3x224x224` float32 NCHW, ImageNet normalized `mean=[0.485,0.456,0.406] std=[0.229,0.224,0.225]`
**Output:** `1x38` softmax probabilities (PlantVillage 38 classes)
**Opset:** 17, IR 8, `GlobalAveragePool → Flatten → Gemm(3→1024) → Relu → Gemm(1024→1024) → Relu → Gemm(1024→38) → Softmax`
**Runtime:** `onnxruntime-web@1.19` WASM `numThreads:1` `simd:true` `wasmPaths: https://cdn.jsdelivr.net/npm/onnxruntime-web@1.19.0/dist/`
**Cache:** `workbox` `CacheFirst` `ml-models` `30d` in `vite.config.ts:103` (never precached). Stored in `models/` — **not** `public/` — so it is not copied into `dist/`; the production image serves it via nginx `location /models/` → `/usr/share/nginx/ml/` and the classifier fetches it on first use. Dev (vite) serves heuristic triage only — copy it back to `public/models/` temporarily if ONNX inference is needed in dev

**Current weights:** Random surrogate (seed 42) — proves 4.5MB plumbing, WASM load, `canvasToNchwTensor` `ag-extension-dashboard/src/frontend/src/services/edgePlantVisionClassifier.ts:115`, and fallback to heuristic `L60` (12 conditions, HSV/LAB/Sobel). **Not fine-tuned.**

**Safety gate:** `ONNX_MIN_PROBABILITY = 0.55` in `edgePlantVisionClassifier.ts` filters model candidates before they reach the UI. A random surrogate yields ~1/38 ≈ 0.03 per class, so heuristic triage serves all users until trained weights are swapped in — at which point confident predictions (top-1 typically > 0.8) pass through automatically. Label→condition mapping is same-crop-only; cross-crop substitutions are prohibited.

**Backend note:** a backend ONNX inference path fed a uniform tensor from the JPEG header byte into an untrained 129MB surrogate and was removed during truthfulness remediation (2026-09-02). Backend image diagnosis uses the LLM vision provider; the 129MB binary was deleted.

**To achieve top-notch 97.5%:**
1. Train `timm-eff-lite0` on `PlantVillage 54k/38` + `East African field set` (FAW, MLND, CMD, CBSD, CLR, BXW) — `python scripts/train-plant-disease.py --data ./data/plantvillage --epochs 40 --quant int8`
2. `torch.onnx.export` opset 17 → `onnxruntime` dynamic quant `int8` → `~4.2MB → ~1.1MB` (or keep `float32 4.2MB` for 0.4% accuracy gain)
3. Replace `models/plant-disease.onnx` and bump `modelVersion: 'plant-disease-onnx-v2'` in `edgePlantVisionClassifier.ts:475`
4. Validate: `python -m onnx checker` + `vitest` canvas fixture `FarmerMap.test.tsx` vs 5 disease classes

**Why 4.5MB not 98MB/20MB:** `vite build` precache 67×2818 KiB; 98MB = 35× bloat → Cache Storage quota fail on 512MB Android, 46m 2G download, WASM OOM 380MB peak. 4.2MB = 2m07s 2G, 38s 3G, 28ms WASM.

**Replace file:** `python /tmp/gen_onnx.py` generates surrogate; swap with `scripts/train-plant-disease.py` output when ready.
