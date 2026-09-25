# Crop ribbon diagnosis and rejected experiments

These are **isolated, unqualified crop01/g050 experiments** from the fourth September 24
checkpoint. No runtime, production generator, accepted groom or threshold changes are included.
See `../../../PROGRESS-2026-09-24.md` for the interpretation and remaining work.

`summary.json` defines the diagnostics, records per-layer results, preserves one illustrative
guide before/after correction, and binds source and asset hashes. The baseline rebuild's entire
card payload matches shipping, including normals, UV channels, joints, weights and local indices
(`baseline-preservation.json`). Full per-card point arrays remain under ignored `tmp/`; their
hashes are in the summary and the recipe regenerates them.

The four arms are baseline, `closest` (outside-point clearance direction only), `slender`
(width only), and `closest-slender` (both). Root and underlayer widths stay unchanged in both
width arms. All three candidates fail gathering, coherent relief, normal-ray bald-patch and
view-dependent bare-skin limits. They look like overlapping plates, not acceptable hair.

`projection-control.py` tests the exact production and candidate functions against an analytic
plane with aligned and tilted smooth normals. The tilted case reproduces sideways drift and
failure to attain the requested standoff; aligned outside/inside controls remain correct. It is
a mechanism control, not proof of arbitrary nonconvex-body safety. The first control invocation
omitted `apply_style` and raised `NameError`; the saved script/log contain the corrected run.
Put Blender's `--python-exit-code 1` **before** `--python` so a script failure propagates.

Each `*-gpu.json` records five still views and 41 sampled states of four seconds of real WebGPU
shake, with exact asset hashes. Camera framing is pinned to shipping. The existing 0.01 mm segment
error and 0.05 mm fitted-skull penetration limits pass; no sampled positions/velocities are
nonfinite. These are `hair.html` PBR and fitted-sphere checks, **not** public Avatar HairMaterial,
full-body contact, all-motion, or final appearance qualification.

The first capture reused a fixed face rectangle from the cap-only experiment. Candidate hair
changed 162 of its pixels at frame 120, so it was no longer a valid unchanged-region control.
`initial-face-roi-failure.json` preserves that failure. The corrected comparison physically
detaches the actual hair meshes after reparenting and compares the entire rendered body image:
all five paired states are pixel-identical. The fixed rectangle remains reported; its different-
pose control detects 9,797 changed pixels. This is a stronger independent body comparison, not a
relaxed image tolerance. Some native plates are retained; `capture-image-hashes.json` also binds
the other captures left under `tmp/`.

Replay from the repository root using the isolated Blender environment described in the progress
note. The scripts retain their tested relative imports:

```sh
mkdir -p tmp/hair-sep24/ribbon-shape
cp docs/evidence/hair-2026-09-24/ribbon-shape/*.py tmp/hair-sep24/ribbon-shape/
cp docs/evidence/hair-2026-09-24/ribbon-shape/capture.mjs tmp/hair-sep24/ribbon-shape/

BLENDER_USER_RESOURCES="$PWD/tmp/hair-sep24/blender-profile" \
  RIBBON_MODE=closest RIBBON_REPORT="$PWD/tmp/hair-sep24/ribbon-shape/closest.json" \
  tmp/hair-sep24/blender-volume/Blender.app/Contents/MacOS/Blender --background \
  --python-exit-code 1 --python tmp/hair-sep24/ribbon-shape/probe.py -- \
  --gender 0.5 --output "$PWD/tmp/hair-sep24/ribbon-shape/closest/figure_g050.glb" \
  --hair crop01 --hair-dir "$PWD/tmp/hair-sep24/ribbon-shape/closest/hair"

node tools/figure-pipeline/verify_glb.mjs tmp/hair-sep24/ribbon-shape/closest/hair/crop01/g050.glb
RIBBON_CAPTURE_OUT=tmp/hair-sep24/ribbon-shape/closest-capture \
  node tmp/hair-sep24/ribbon-shape/capture.mjs tmp/hair-sep24/ribbon-shape/closest/hair/crop01/g050.glb

BLENDER_USER_RESOURCES="$PWD/tmp/hair-sep24/blender-profile" \
  tmp/hair-sep24/blender-volume/Blender.app/Contents/MacOS/Blender --background \
  --python-exit-code 1 --python tmp/hair-sep24/ribbon-shape/projection-control.py
```

The verifier must exit 1 for each candidate's four remaining clauses. Change `RIBBON_MODE` and
all corresponding output paths for the other arms. After all four builds, run `summarize.py`.
Serialize GPU captures. Do not build into `assets/`. `manifest.json` binds the tracked evidence.
