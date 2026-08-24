# Decision Memo: On-Device Offline Crop-Disease Diagnosis (Phase 2.1)

**Status:** Spike complete — recommendation ready for sign-off
**Decision needed from:** Product owner (accuracy gate acceptance, model license sign-off)

## Recommendation

**MobileNetV2/MobileNetV3-small, ONNX INT8-quantized, running via onnxruntime-web (single-thread WASM) inside the Capacitor webview.**

| Factor | Value | Evidence |
|---|---|---|
| Model size | 2.5–9 MB quantized (vs 9.25MB fp32 reference) | leafwise project ships 9.25MB fp32; INT8 ≈ 4× smaller |
| Classes | 38 diseases / 14 crops (PlantVillage), subset to top-10 regional crops | Frontiers 2023: MobileNetV3-small 99.5% in-distribution, 0.9M params quantized |
| Inference | ~6–50ms laptop; tens of ms mid-range phone, single-thread WASM | leafwise benchmarks; deliberate single-thread (no COOP/COEP headers needed — preserves PWA installability) |
| Runtime | onnxruntime-web (MIT) — works in Capacitor webview; `@cantoo/capacitor-onnx` available later for native NNAPI/CoreML acceleration | ORT-Web is the consensus for browser/PWA inference (2025–26) |
| Precedent | leafwise (open source) proves the exact architecture: ONNX + ORT-Web + SW-cached model + IndexedDB history | MIT license, reusable patterns |

## The honest number that matters

Lab-vs-field collapse: leafwise measured **94.0% top-1 on PlantVillage but 18.5% top-1 on PlantDoc field photography** (crop-only correctness 52%). PlantVillage is studio leaf photography; fields are not. Every vendor claiming "99%" is quoting lab numbers.

## Mitigations (all adopted)

1. Present **top-3 with probabilities**, never a single answer
2. Flag **<45% confidence as "low confidence — guidance only"**
3. Always show **"Sync for AI confirmation"** — on-device result is preliminary; the existing backend multimodal pipeline confirms when online (feeds diagnosis_events → outbreak intelligence)
4. **"Not a leaf" rejection** on the roadmap before general availability
5. Publish both accuracy numbers in-app (honesty as a feature)

## Acceptance gate before enabling beyond "guidance mode"

Collect ≥300 field photos via officers (existing upload pipeline), label with agronomist review (RecommendationReview flow exists), and require:
- Top-1 crop correctness ≥ 60%
- Top-3 disease correctness ≥ 70%
- Otherwise: keep offline mode as photo-capture + queued-confirmation only

## License check

- PlantVillage dataset: CC-BY-SA — attribution required, share-alike on derivatives
- Candidate model `linkanjarad/mobilenet_v2_1.0_224-plant-disease-identification` (HF): verify model card license before shipping; fallback = train our own MobileNetV3-small on PlantVillage (straightforward, documented)

## Build estimate after sign-off

Model conversion + quantization script (1d) → onnxruntime-web integration + SW model caching (2d) → capture-flow fallback UI + confidence gating (2d) → field-collection labeling loop (1d) → acceptance testing (ongoing with field data).
