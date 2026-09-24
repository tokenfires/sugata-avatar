# Cap boundary and capture-clock evidence

The cap candidates are unqualified experiments. Shipped assets and the contact-calibrated bob
remain unchanged. The accepted implementation change is in the hair testbed's capture clock.
See `../../../PROGRESS-2026-09-24.md` for the findings and limits.

`crop-gpu-summary.json` preserves capture measurements, asset/source hashes and hashes of the
GPU arrays. The full arrays remain in the ignored `tmp/hair-sep24/cap-edge/crop01-gpu.json`.
`clock-report.json` is the independent regression's complete report. `capture-failure.json`
records the original mismatched images and the corrected audit of them. Text logs have only
trailing whitespace normalized; images are untouched. `manifest.json` hashes the evidence.

The experimental scripts retain their tested relative imports. From the repository root, copy
them back to their working locations before replaying:

```sh
mkdir -p tmp/hair-sep24/cap-edge
cp docs/evidence/hair-2026-09-24/cap-edge/candidate.py tmp/hair-sep24/cap-edge/
cp docs/evidence/hair-2026-09-24/cap-edge/diagnose.mjs tmp/hair-sep24/cap-edge/
cp docs/evidence/hair-2026-09-24/cap-edge/capture.mjs tmp/hair-sep24/cap-edge/
cp docs/evidence/hair-2026-09-24/cap-edge/check-card-payload.mjs tmp/hair-sep24/

BLENDER_USER_RESOURCES="$PWD/tmp/hair-sep24/blender-profile" CAP_EDGE_M=0.001 \
  tmp/hair-sep24/blender-volume/Blender.app/Contents/MacOS/Blender --background \
  --python tmp/hair-sep24/cap-edge/candidate.py --python-exit-code 1 -- \
  --gender 0.5 --output "$PWD/tmp/hair-sep24/cap-edge/one-mm/figure_g050.glb" \
  --hair crop01 --hair-dir "$PWD/tmp/hair-sep24/cap-edge/one-mm/hair"

node tools/figure-pipeline/verify_glb.mjs tmp/hair-sep24/cap-edge/one-mm/hair/crop01/g050.glb
node tmp/hair-sep24/check-card-payload.mjs assets/hair/crop01/g050.glb tmp/hair-sep24/cap-edge/one-mm/hair/crop01/g050.glb
node tmp/hair-sep24/cap-edge/capture.mjs tmp/hair-sep24/cap-edge/one-mm/hair/crop01/g050.glb
node packages/testbed/src/hair-capture-clock.selftest.mjs --out tmp/hair-sep24/cap-edge/clock-test
```

The verifier is expected to exit 1 for the 1 mm candidate's three remaining clauses. The last
two GPU commands run serially and close their own browser/server. To reproduce the rejected
2 mm candidate, use `CAP_EDGE_M=0.002` with separate `two-mm` output paths. Zero expansion
reproduces the one-ring experiment. The Blender mount/profile setup is described in the progress
note; the evening checkpoint will detach the mount. Never direct these builds into `assets/`.
