# Crop layer attribution and rejected root cut

This evidence belongs to the fifth September 24 checkpoint in
`../../../PROGRESS-2026-09-24.md`. It diagnoses the shipped crop01/g050 without changing its
geometry. The root-cut GLB is an isolated, rejected candidate; no asset is promoted.

`tag-layers.py` intercepts assembly and the final clearance clamp in an otherwise unchanged
Blender build. It hashes each card's final position triples, sorted independently of vertex
order, and records the originating layer. `map.mjs` re-derives those hashes from the shipping GLB
and requires a unique match for all 384 cards. Every triangle must carry one layer; unmapped and
duplicate provenance records are deliberately rejected. `preservation.json` confirms that all
card attributes and local indices of the baseline rebuild match shipping.

The first attribution pass retained normal MSAA. Its colors leave mixed edge pixels, so the
final **measurement** pass disables antialiasing and counts one visible fragment per pixel.
`report.json` contains these final counts; `msaa-report.json` preserves the initial diagnosis.
Each final view has zero unclassified nonblack pixels, and the union of all layer identities
equals an independently rendered white hair mask at every pixel. Removing all layers produces
black; restoring the index/material state reproduces the original PBR image exactly. The body
is a black occluder in diagnostic views. Texture alpha, cutoff, triangle positions and camera
remain in use; diagnostic colors replace lighting and albedo RGB. Percentages are visible
image area in five fixed rest views, not card counts, world area or material-quality scores.

| Layer | Color |
| --- | --- |
| cap | gray `#999999` |
| root | red `#ff0044` |
| mass | green `#00ff44` |
| underlayer | blue `#0088ff` |
| body | yellow `#ffff00` |
| surface | magenta `#ff00ff` |
| flyaway | cyan `#00ffff` |
| veil | orange `#ff8800` |
| fringe | violet `#8800ff` |

The retained ordinary PBR removal plates use normal antialiasing. Colors, masks and removals
are diagnostics, not candidate hairstyles. `capture-image-hashes.json` binds additional native
images retained locally under `tmp/`.

`root-cut.py` changes only crop01's root-layer cut from `None` to its existing underlayer's
`-0.80` field. `root-cut-preservation.json` verifies unchanged complete payloads for 314 other
cards and both cap shells; precisely the 70 root cards change. The asset verifier still fails
four clauses, with worse bald patches and coherence. It shortens the ear/nape silhouette but
retains the plate-like appearance. **Rejected.**

`root-cut-gpu.json` records the candidate's exact hash and 41 sampled states across four seconds
of real WebGPU shake using the preceding checkpoint's capture helper. Segment-length and
fitted-skull limits pass, and independently detached-hair body images match shipping at all
five captured states. This does not qualify full-body contact, all motion or public HairMaterial.
An initial attribution job briefly overlapped the initial motion capture. Both were repeated
serially for final evidence; `repeat-control.json` confirms the reports match exactly. No GPU
performance claim is made from either run.

All builds and captures used the generator at `b48350c`. The only subsequent generator edit
corrects its misleading comment that the root layer can never be visible. The recorded raw
source hash therefore differs from that comment-only revision; `source-equivalence.json`
confirms that its parsed Python AST is unchanged. Rebuild provenance before
replaying against a changed source; do not bypass the source or geometry checks.

Replay from the repository root, using the isolated Blender mount/profile in the progress note:

```sh
mkdir -p tmp/hair-sep24/layer-attribution
cp docs/evidence/hair-2026-09-24/layer-attribution/*.py tmp/hair-sep24/layer-attribution/
cp docs/evidence/hair-2026-09-24/layer-attribution/*.mjs tmp/hair-sep24/layer-attribution/

BLENDER_USER_RESOURCES="$PWD/tmp/hair-sep24/blender-profile" \
  LAYER_PROVENANCE="$PWD/tmp/hair-sep24/layer-attribution/provenance.json" \
  tmp/hair-sep24/blender-volume/Blender.app/Contents/MacOS/Blender --background \
  --python-exit-code 1 --python tmp/hair-sep24/layer-attribution/tag-layers.py -- \
  --gender 0.5 --output "$PWD/tmp/hair-sep24/layer-attribution/baseline/figure_g050.glb" \
  --hair crop01 --hair-dir "$PWD/tmp/hair-sep24/layer-attribution/baseline/hair"

LAYER_ABLATIONS=1 node tmp/hair-sep24/layer-attribution/capture.mjs
LAYER_NO_AA=1 LAYER_ABLATIONS=1 node tmp/hair-sep24/layer-attribution/capture.mjs
```

For the candidate build, use `root-cut.py`, `root-cut-provenance.json`, and replace both output
directory occurrences of `baseline` with `root-cut`. Then run `check-boundary.mjs` and the asset
verifier on `tmp/hair-sep24/layer-attribution/root-cut/hair/crop01/g050.glb` (expected exit 1).
For motion, use the previous `ribbon-shape/capture.mjs` with that GLB and
`RIBBON_CAPTURE_OUT=tmp/hair-sep24/layer-attribution/root-cut-capture`. Wait for each GPU command
to finish before starting another. The earlier evidence README explains restoring that helper.
`manifest.json` hashes the tracked evidence. No files should be generated into `assets/`.
