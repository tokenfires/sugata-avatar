#!/usr/bin/env bash
#
# prune-captures.sh — delete the transient plates under captures/ and keep the evidence.
#
# capture.mjs writes five things per clip: frames/ (the raw PNG sequence), capture.mp4,
# capture.gif, contact-sheet.png and capture.json (the manifest: seed, backend, per-frame
# digests, timings). The tool's own default DELETES frames/ once the clip is encoded and keeps
# it only under --keep-frames, because heatmap.mjs needs the PNG sequence. Every frames/
# directory on disk is therefore leftover heatmap input, and the gif is the mp4's content at
# roughly eight times the size. Together they were 122 of the 125 GiB under captures/ when this
# was written (2026-09-08); the manifests, clips, sheets, heatmaps, crops and every hair-r*
# evidence directory came to 3 GiB.
#
# The rule is deliberately narrow so the record survives:
#   - a frames/ (or "frames 2"/) directory goes ONLY if capture.mp4 AND capture.json sit beside
#     it, so the encoded clip and its manifest remain;
#   - a capture.gif goes ONLY if capture.mp4 sits beside it.
# Anything else is left alone and reported. Nothing under captures/ is git-tracked except the
# hair-r3x data, and that never matches either rule.
#
# Usage:
#   tools/prune-captures.sh            # dry run: list what would go and what it would free
#   tools/prune-captures.sh --delete   # delete it
#
# Refuses to run while a capture.mjs is writing frames.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CAPTURES="$ROOT/captures"
MODE="dry-run"
[[ "${1:-}" == "--delete" ]] && MODE="delete"

if [[ ! -d "$CAPTURES" ]]; then
  echo "no captures directory at $CAPTURES" >&2
  exit 2
fi

if pgrep -f 'node .*critic/capture\.mjs' >/dev/null 2>&1; then
  echo "refusing: a capture.mjs is running and may be writing frames" >&2
  exit 2
fi

targets=()
skipped=()

# Frames directories: only where the encoded clip and its manifest survive beside them.
while IFS= read -r -d '' dir; do
  parent="$(dirname "$dir")"
  if [[ -f "$parent/capture.mp4" && -f "$parent/capture.json" ]]; then
    targets+=("$dir")
  else
    skipped+=("$dir  (no capture.mp4 + capture.json beside it)")
  fi
done < <(find "$CAPTURES" -type d \( -name frames -o -name 'frames 2' \) -print0 | sort -z)

# GIFs: only where the mp4 of the same clip survives.
while IFS= read -r -d '' gif; do
  parent="$(dirname "$gif")"
  if [[ -f "$parent/capture.mp4" ]]; then
    targets+=("$gif")
  else
    skipped+=("$gif  (no capture.mp4 beside it)")
  fi
done < <(find "$CAPTURES" -type f -name capture.gif -print0 | sort -z)

echo "mode: $MODE"
echo "targets: ${#targets[@]}   skipped: ${#skipped[@]}"
echo

if (( ${#skipped[@]} )); then
  echo "kept (rule not satisfied):"
  printf '  %s\n' "${skipped[@]}"
  echo
fi

total_kb=0
total_files=0
for t in "${targets[@]}"; do
  if [[ -d "$t" ]]; then
    files=$(find "$t" -type f | wc -l | tr -d ' ')
  else
    files=1
  fi
  kb=$(du -sk "$t" | cut -f1)
  total_kb=$(( total_kb + kb ))
  total_files=$(( total_files + files ))
  printf '%8.2f GiB  %6d files  %s\n' "$(echo "$kb / 1048576" | bc -l)" "$files" "${t#"$CAPTURES"/}"
  if [[ "$MODE" == "delete" ]]; then
    rm -rf -- "$t"
  fi
done

echo
printf 'total on disk: %.2f GiB in %d files\n' "$(echo "$total_kb / 1048576" | bc -l)" "$total_files"
if [[ "$MODE" == "dry-run" ]]; then
  echo "dry run only. Re-run with --delete to remove them."
else
  echo "deleted. captures/ is now: $(du -sh "$CAPTURES" | cut -f1)"
fi
