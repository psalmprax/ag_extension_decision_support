#!/usr/bin/env bash
# gsd-scan with fallow integration
# Runs gsd-scan and augments with fallow code health analysis

set -euo pipefail

FOCUS="${1:-tech+arch}"
PROJECT_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
PLANNING_DIR="$PROJECT_ROOT/.planning"
CODEBASE_DIR="$PLANNING_DIR/codebase"
INTEL_DIR="$PLANNING_DIR/intel"

mkdir -p "$CODEBASE_DIR" "$INTEL_DIR"

echo "🔍 Running gsd-scan (focus: $FOCUS)..."

# Run original gsd-scan
npx gsd-scan --focus "$FOCUS"

echo "📊 Running fallow health analysis..."

# Run fallow and save JSON output
if command -v npx &> /dev/null && npx fallow --version &> /dev/null; then
    npx fallow health --format json > "$INTEL_DIR/code-health.json" 2>/dev/null || true
    npx fallow dead-code --format json > "$INTEL_DIR/dead-code.json" 2>/dev/null || true
    npx fallow dupes --format json > "$INTEL_DIR/duplicates.json" 2>/dev/null || true
    npx fallow --format json > "$INTEL_DIR/full-report.json" 2>/dev/null || true
    
    echo "✅ Fallow metrics saved to $INTEL_DIR/"
    
    # Generate summary
    if [[ -f "$INTEL_DIR/code-health.json" ]]; then
        HEALTH_SCORE=$(jq -r '.score // "N/A"' "$INTEL_DIR/code-health.json" 2>/dev/null || echo "N/A")
        DEAD_COUNT=$(jq -r '.deadCode?.length // 0' "$INTEL_DIR/dead-code.json" 2>/dev/null || echo "0")
        DUPE_COUNT=$(jq -r '.duplicates?.length // 0' "$INTEL_DIR/duplicates.json" 2>/dev/null || echo "0")
        
        echo ""
        echo "┌─ Code Health Summary ────────────────────┐"
        echo "│ Health Score:  $HEALTH_SCORE"
        echo "│ Dead code:     $DEAD_COUNT items"
        echo "│ Duplicates:    $DUPE_COUNT clusters"
        echo "└──────────────────────────────────────────┘"
    fi
else
    echo "⚠️  fallow not installed. Run: npm i -D fallow && npx fallow init"
fi

echo ""
echo "📁 Scan complete. Documents in $CODEBASE_DIR/"
echo "📊 Fallow metrics in $INTEL_DIR/"