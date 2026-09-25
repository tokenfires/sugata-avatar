# Narrower crop cards at double density — rejected

See [the overnight checkpoint](../../../PROGRESS-2026-09-24-OVERNIGHT.md) for interpretation,
numbers and the active work window. This is an isolated experiment from `872fb12`; no shipped
groom, production implementation, threshold or contact calibration changes.

`recipe.py` changes only crop01's layer card counts (×2) and half-widths (÷2). Its two JSON
records preserve all style fields and the 24 actual lock sites/random habits. `boundary.mjs`
requires exactly those recipe changes, matches the baseline rebuild's entire component payloads
to shipping, checks both unchanged caps, embedded images, material definitions and exported lock
metadata, and measures triangle area. Individual card roots/RNG draws are not kept fixed when
sampling more cards. A count-times-width equality does not conserve actual triangle area.

The candidate GLB SHA-256 is
`dc8cac9ab998c149b7f7eed282a0d53d541822e446a022d39bace027ec1df2e7`.
It remains local under `tmp/`; the recipe rebuilds it. Both baseline and candidate verifier logs
retain four failures. Five paired rest views and frame-120 plates are retained natively; all
additional captured images are hash-bound in `capture-image-hashes.json`.

`capture.mjs` reuses the prior ribbon-shape helper with added console-error capture. It routes
the exact GLB bytes, pins camera framing, advances the real renderer clock and samples 41 GPU
states per arm across four seconds of shake. Five separately captured body-only images must
match pixel-for-pixel. Geometry is intentionally different, so hair state equality is not
required. `motion.json` contains the results. This is the PBR hair testbed and fitted-skull
collision model, not public HairMaterial, full-body contact or all-motion qualification.

`cost.mjs` uses four independent pages in shipping/candidate/candidate/shipping order, with
60 warmup frames, 120 sampled frames and eight 64-frame dispatch batches on each. Single-frame
compute and render pools are recorded separately with substep/compute-call counts. Apple
Metal adapters and live timestamps are recorded. Compute p50 is compared with the existing
HairDynamics X-gate's 0.25 ms ceiling; the full raw samples and tails remain visible. Batched
dispatch arithmetic excludes per-pass overhead. Large disagreement between the opening and
closing shipping controls makes the **candidate cost difference inconclusive**. Do not describe
the candidate as cheaper or infer an overall performance guarantee from its passing p50.

Replay from the repository root with the isolated Blender mount/profile described in the
checkpoint. Copy scripts back into their tested scratch location to preserve relative imports:

```sh
mkdir -p tmp/hair-sep24/narrow-density
cp docs/evidence/hair-2026-09-24/narrow-density/*.py tmp/hair-sep24/narrow-density/
cp docs/evidence/hair-2026-09-24/narrow-density/*.mjs tmp/hair-sep24/narrow-density/

for arm in baseline double; do
  DENSITY_ARM="$arm" \
    DENSITY_RECORD="$PWD/tmp/hair-sep24/narrow-density/$arm-recipe.json" \
    BLENDER_USER_RESOURCES="$PWD/tmp/hair-sep24/blender-profile" \
    tmp/hair-sep24/blender-volume/Blender.app/Contents/MacOS/Blender --background \
    --python-exit-code 1 --python tmp/hair-sep24/narrow-density/recipe.py -- \
    --gender 0.5 --output "$PWD/tmp/hair-sep24/narrow-density/$arm/figure_g050.glb" \
    --hair crop01 --hair-dir "$PWD/tmp/hair-sep24/narrow-density/$arm/hair"
done

node tmp/hair-sep24/narrow-density/boundary.mjs
node tools/figure-pipeline/verify_glb.mjs assets/hair/crop01/g050.glb
node tools/figure-pipeline/verify_glb.mjs tmp/hair-sep24/narrow-density/double/hair/crop01/g050.glb
RIBBON_CAPTURE_OUT=tmp/hair-sep24/narrow-density/capture \
  node tmp/hair-sep24/narrow-density/capture.mjs tmp/hair-sep24/narrow-density/double/hair/crop01/g050.glb
node tmp/hair-sep24/narrow-density/cost.mjs
```

Both verifier commands are expected to exit 1. Wait for each GPU command to exit before starting
the next. The abnormal amortization batches use separate pages after visual/motion capture, so
they cannot contaminate its recorded states. No full runtime suite or production build was
necessary for this experiment-only change. `manifest.json` hashes the tracked evidence.
