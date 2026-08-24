# Stub Audit Remediation Plan

## Scope

Address the Moderate and Low findings from `stub_audit_report.md` that are present in the repository:

- AI video-analysis methods that currently throw as unsupported.
- The empty `FarmerMap` effect.
- Empty WebGL paint callbacks in `Liquid.tsx` and `ParticleReveal.tsx`.
- The crop-loss audit's fabricated Sentinel-2/NASA wording and default model behavior.
- The unused `PaymentService.isSimulated` state.

The demo data system is intentionally retained.

## Approved Video Decision

Implement real, bounded video analysis for the live `POST /api/ai/analyze-video` endpoint.

The implementation uses a local `ffmpeg` process to extract a small, bounded set of JPEG frames, then passes those frames through each provider's existing image-analysis capability. The service validates non-empty input, enforces a 50 MB input limit, extracts at most 12 frames, applies a bounded frame interval, and times out after 45 seconds. Providers without vision capability fail explicitly and are skipped by the fallback chain.

The backend Docker images install ffmpeg. Runtime failures are typed and descriptive when ffmpeg is unavailable or the video cannot be decoded.

## Crop-Loss Decision

The crop-loss audit now treats `observedCanopyScore` as caller-supplied evidence rather than pretending to fetch Sentinel-2 or NASA POWER data. Missing evidence requires supervisor review. Supplied scores are range-validated, and the response identifies the evidence source while preserving the fraud decision shape used by the UI.

## Implemented Changes

- Added `videoFrameService.ts` for bounded ffmpeg frame extraction.
- Centralized frame analysis and usage aggregation in `BaseAIProvider`.
- Removed provider-specific video throw stubs while preserving the shared capability contract.
- Added video payload validation and size checks to the AI route.
- Added ffmpeg to backend Docker runtime/build stages.
- Removed the unused payment simulation flag.
- Removed the empty FarmerMap effect.
- Replaced empty WebGL catches with error logging while retaining recovery behavior.
- Renamed crop-loss response fields from satellite/weather terminology to evidence terminology and updated the frontend consumer.

## Verification

- Backend build and lint pass.
- Backend full suite passes: 47 suites, 395 tests.
- Frontend typecheck and lint pass.
- Frontend full suite passes: 26 files, 123 tests.
- Focused video, crop-loss, and Freebuff tests pass: 35 tests.
- `git diff --check` passes.
- Final source search contains no empty catches, provider video throw stubs, or `isSimulated` references.

## Residual Notes

The frontend suite still emits pre-existing React `act(...)` warnings and a mocked-ref warning. They do not fail the suite and are outside this audit remediation scope.
