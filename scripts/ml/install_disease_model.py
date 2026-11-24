"""Put a training run's output where the app reads it, or record why it was not installed.

Reads the run's out/ folder (plant-disease.onnx, manifest.json, MODEL_CARD.md) and updates
ag-extension-dashboard/src/frontend/models. A model that meets the field gate replaces the
listed model; one that does not leaves the folder's model alone and is recorded as
lastCandidate, which the app shows as the reason no disease model runs. The same gate is
checked again in the app (src/services/edgeModelManifest.ts, FIELD_EVALUATION_FLOOR).

Usage: python scripts/ml/install_disease_model.py out ag-extension-dashboard/src/frontend/models
"""
from __future__ import annotations

import json
import shutil
import sys
from pathlib import Path

# Keep in step with FIELD_EVALUATION_FLOOR in edgeModelManifest.ts.
FLOOR = {"images": 300, "top3Accuracy": 0.7, "cropTop1Accuracy": 0.6}


def passes(evaluation: dict) -> bool:
    return (
        not evaluation.get("smoke")
        and evaluation.get("images", 0) >= FLOOR["images"]
        and evaluation.get("top3Accuracy", 0) >= FLOOR["top3Accuracy"]
        and evaluation.get("cropTop1Accuracy", 0) >= FLOOR["cropTop1Accuracy"]
    )


def main(out: Path, models: Path) -> int:
    entry = json.loads((out / "manifest.json").read_text())["models"][0]
    evaluation = entry["fieldEvaluation"]
    manifest_path = models / "manifest.json"
    manifest = json.loads(manifest_path.read_text()) if manifest_path.exists() else {"models": []}
    if passes(evaluation):
        shutil.copyfile(out / entry["file"], models / entry["file"])
        shutil.copyfile(out / "MODEL_CARD.md", models / "MODEL_CARD.md")
        manifest = {"models": [entry]}
        verdict = "installed"
    else:
        manifest["lastCandidate"] = {"name": entry["name"], "fieldEvaluation": evaluation}
        verdict = "not installed: below the field gate"
    manifest_path.write_text(json.dumps(manifest, indent=2) + "\n")
    print(f"{entry['name']}: {verdict} (top-3 {evaluation['top3Accuracy']:.1%}, crop top-1 {evaluation['cropTop1Accuracy']:.1%}, {evaluation['images']} photos)")
    return 0


if __name__ == "__main__":
    sys.exit(main(Path(sys.argv[1]), Path(sys.argv[2])))
