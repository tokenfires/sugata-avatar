#!/usr/bin/env bash
#
# build-tfx.sh — regenerate the strand exports the ribbon spike and the frostbitten control consume.
#
# ## Why this exists rather than a committed payload
#
# R31's primitive decision rests on `.tfx` exports that lived only in a session scratchpad, and its
# own decision document filed that as a blocker: *"the .tfx exports are outside the repository (all
# eight, in the session scratchpad). Either commit them or make tfx_export.py a build step. Until
# then nothing here reproduces."*
#
# They are NOT committed, and the reason is measured rather than preferred:
#
#   - They are DERIVED and BYTE-REPRODUCIBLE. A fresh Blender run of `tfx_export.py` on `bob01` at
#     `g050` reproduces sha256 `a1dffb2429371da019b24e28ab594dfb78a45bf16e5b69a27c8c828dc169b1af`,
#     the same digest the exporter reported when the file was first written, in **21 s wall** on
#     this machine. A thing that is one deterministic command away is not an asset.
#   - The set is **14 MB** and `assets/` already sits at 276 MB against git-LFS's 1 GB tier and
#     1 GB/month of bandwidth. `docs/CHECKPOINT.md` §14 leaves the identical question — whether six
#     styles' GLBs join that payload — explicitly to the owner, and committing these would pre-empt
#     the same decision by the back door.
#
# ⚠️ So the reproduction guarantee here is "one command and 21 s a groom", not "in git". If that
# stops being true — if the export ever fails to reproduce its digest — this file is the wrong
# answer and the payload question has to go back to the owner.
#
# ## The densities, and why these ones
#
# `--strand-density` multiplies every layer's card count. The dart thrower has an attempt ceiling,
# so a request is not a guarantee, and the achieved count is printed per layer. Measured on `bob01`:
# 1 / 2 / 5 / 10 / 23 / 50 give 496 / 992 / 2,480 / 4,960 / 11,408 / 24,800 strands with ZERO
# shortfall in any of the eight layers at any density. Density 23 lands on 11,408 against
# frostbitten's shipped 11,400, which is what made the matched-count comparison possible.
#
# ## Usage
#
#   tools/figure-pipeline/build-tfx.sh [OUTDIR]        # default: ./tmp/tfx
#   BLENDER=/path/to/blender tools/figure-pipeline/build-tfx.sh
#   ONLY=crop tools/figure-pipeline/build-tfx.sh       # just the short style
#
set -euo pipefail

OUT="${1:-tmp/tfx}"
BLENDER="${BLENDER:-$(command -v blender || echo /Applications/Blender.app/Contents/MacOS/Blender)}"
REPO="$(cd "$(dirname "$0")/../.." && pwd)"
ONLY="${ONLY:-all}"

if [ ! -x "$BLENDER" ]; then
  echo "ERROR: Blender not found at $BLENDER. Set BLENDER=/path/to/blender and retry." >&2
  exit 1
fi

mkdir -p "$OUT"
cd "$REPO"

# style:gender:density — the set R31's ladder and separation arms consume. `d23` on crop01 lands on
# 8,832 strands, which is the count the primitive decision's parity figure was measured at.
ARMS="
bob01:0.5:1
bob01:0.5:10
bob01:0.5:23
crop01:0.5:10
crop01:0.5:23
"

for arm in $ARMS; do
  style="${arm%%:*}"; rest="${arm#*:}"
  gender="${rest%%:*}"; density="${rest##*:}"

  case "$ONLY" in
    all) ;;
    *) case "$style" in *"$ONLY"*) ;; *) continue ;; esac ;;
  esac

  suffix=""
  [ "$density" != "1" ] && suffix="_d${density}"
  file="$OUT/${style}_g$(printf '%03d' "$(echo "$gender * 100" | bc | cut -d. -f1)")${suffix}.tfx"

  echo "=== $style  gender $gender  density $density  ->  $file"
  "$BLENDER" --background --python tools/figure-pipeline/tfx_export.py --python-exit-code 1 -- \
    --hair "$style" --gender "$gender" --strand-density "$density" --tfx-output "$file" \
    2>&1 | grep -E "strands|points|sha256|SHORT|bounding box size" || true
done

echo
echo "done -> $OUT"
echo "consume with:  node tools/critic/strand-spike.mjs --tfx $OUT --out captures/strand-spike"
