#!/usr/bin/env bash
#
# Sweeps the MPFB gender macro and bakes one GLB per point on the axis.
#
#   assets/figures/figure_g000.glb   gender 0.00  (fully female)
#   assets/figures/figure_g025.glb   gender 0.25
#   assets/figures/figure_g050.glb   gender 0.50  (the androgynous midpoint)
#   assets/figures/figure_g075.glb   gender 0.75
#   assets/figures/figure_g100.glb   gender 1.00  (fully male)
#
# Why discrete bakes rather than one figure with a live gender morph: glTF cannot morph a
# skeleton, and the head joints move up to ~17.5 mm across the full sweep (see
# docs/research/base-mesh-verification.md, Finding 4). Baking each shipping point keeps the
# bind pose honest; the continuous dial is a clamped runtime nicety layered on top.
#
# Any extra arguments are forwarded to build_figure.py, so a quick low-fidelity sweep is:
#   tools/figure-pipeline/build.sh --no-face-parts --skin none

set -euo pipefail

BLENDER="${BLENDER:-/Applications/Blender.app/Contents/MacOS/Blender}"
PIPELINE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$PIPELINE_DIR/../.." && pwd)"
OUTPUT_DIR="$REPO_ROOT/assets/figures"

GENDER_VALUES=(0.0 0.25 0.5 0.75 1.0)

if [ ! -x "$BLENDER" ]; then
  echo "ERROR: Blender not found at $BLENDER. Set BLENDER=/path/to/blender and retry." >&2
  exit 1
fi

mkdir -p "$OUTPUT_DIR"

for gender in "${GENDER_VALUES[@]}"; do
  # 0.25 -> "025", 1.0 -> "100". The filename sorts in axis order, which is the point.
  suffix="$(printf "%03d" "$(echo "$gender * 100" | bc | cut -d. -f1)")"
  output="$OUTPUT_DIR/figure_g${suffix}.glb"

  echo ""
  echo "----------------------------------------------------------------------"
  echo "Building gender=$gender -> $output"
  echo "----------------------------------------------------------------------"

  "$BLENDER" --background --python "$PIPELINE_DIR/build_figure.py" --python-exit-code 1 -- \
    --gender "$gender" --output "$output" "$@"
done

echo ""
echo "Sweep complete. Verify with:"
echo "  node $PIPELINE_DIR/verify_glb.mjs"
