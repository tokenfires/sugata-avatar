# Next collar-fit experiment — proposed, not executed

**Stop for this window at diagnosis.** No corrected geometry, mask, asset, or
runtime change was produced by this lane. The next experiment is one capped,
local, multi-pose cloth correction. It is not a broader cloth-solver project or
approval to promote an unqualified candidate.

## Evidence and cause

`inspection.json` (SHA256
`34412f8ce814ef99fd875cb2c87bb0db169bf58db9afac9a60fce606ec793629`)
binds the inspected solver, completed stress reports, exact assets, calibration,
snapshot, and diagnostic sources. It records the GPU capture's runtime source
hashes separately from files executed by this inspection. `manifest.json` binds
this plan and its reproduction. The authoritative stress report is
`../cpu-v1/report.json`, SHA256
`d27ee3be3b25c7603d79a84acc27d72aaf840c7ccf91f323707f60e8fd1d67aa`.

The frozen September 13 `solve-v2.mjs` creates obstacle grids only from the full
body, at authored rest and historical mild native steps 0 and 270. It never
loads or constrains the retained bra. Thus the new supported expressive bra
contacts are an omitted obstacle/pose constraint, not evidence for changing
body coverage. The solver's last sequential-update row still had 19 updates;
its 1.5 mm target was never a final simultaneous clearance certificate.

The exact `d81a6730…` asset has geometry `ca65319a…`, with the coincident 140-face
interior. At happy first beat, step 98, tee faces 1327/1328/1329/1331 cross the
retained bra. At the second beat, step 270, the opposite region adds 544/545
alongside 1328/1329/1331. Both accepted bobs reproduce these crossings.
The changed 180 faces stay outside the full body in all 38 sampled owned
states, but the smallest body gap is only **0.0468534245 mm**, tee 1515 versus
body 15580 at step 720. A fix confined to the first contact region is incomplete.

The supplemental local diagnostic samples the four step-98 contact faces at
order 16: 612 barycentric samples including shared-edge duplicates, 105 with a
negative local normal sign; the minimum is **−0.910440768 mm** on face 1328.
This is a sampled signed nearest-sheet distance, not volumetric penetration
depth or the required correction. The bra is open. Face 1327 actually crosses
despite every lattice sample having positive sign: sampled signs cannot replace
whole-triangle predicates. Pixel cause must still come from the separately
owned exact-frame ordinary/tag/ray witness, not these numbers alone.

## One bounded candidate

Start from the frozen d81 asset, retaining the same owner/interior treatment.
Before fitting, bind the completed exact-frame witness and establish the visible
bra contact; record any extra localized contacts without silently widening scope.
Use the explicit proposed raw-vertex and triangle lists in
`inspection.json.support`:

- Weld by the original accepted 44 source positions rounded to 1e-7 m, exactly
  as the old solver did. Move seam duplicates together; require identical skin
  weights and joints within every proposed moving group before solving.
- Seed both contact regions with faces 544, 545, 1327, 1328, 1329, 1331. Use
  their single welded adjacency ring, intersected with the original solver's
  45 mm geodesic collar band and original Y > 1.32 m. This gives **34 groups,
  43 raw vertices, 91 incident faces**. One group outside the old band is fixed.
  Do not expand support automatically.
- Freeze face 1515 and its complete welded one-ring guard. It is disjoint from
  the proposed moving support. Preserve those authored positions bit for bit,
  so its existing small posed body gap is not spent on the bra repair.
- Cap every group's additional Euclidean authored displacement from d81 at
  **3 mm**, including all smoothing/projection updates. Keep boundary vertices
  outside the allowed list fixed. Use body and retained-bra obstacles jointly
  at authored rest and all 19 expressive snapshots; retain the historical mild
  poses as constraints. The objective is local bra separation with minimal
  displacement and smooth transition. No global open-sheet signed-distance
  constraint is valid; use oriented local contact witnesses plus an independent
  final intersection/separation test.
- Preserve topology, triangle ordering, all 2,377 vertex slots, UVs, skinning,
  joints, skeleton/bind transforms, materials/textures, and the 140 interior
  source IDs. Positions may change only in the listed support; recompute only
  the resulting affected smoothing groups, preserving hard-edge partitions.
  Preserve all body/foundation masks and calibration bytes, accepted hair,
  foundations, trouser/shoe geometry and assets. Ten incident faces are outside
  the interior band and must remain in the checks.

Export at most **one** trial GLB from a deterministic recipe, with an exact hash,
delta list, support list, solver configuration and final residuals. An internal
bounded solve is allowed; parameter sweeps, support growth, skin-weight changes,
additional lining, mask changes, or a second exported candidate are outside this
experiment. Do not rerun the old script against the installed asset: its pinned
input and temporary output paths are historical.

## Qualification gates and stop rule

1. **Before export:** verify all byte/array invariants and <=3 mm displacement;
   no nonfinite values, inverted/degenerate triangles or new seam separation.
   Record normal and area changes relative to d81. Require normal dot >=0.95
   and area ratio in [0.8,1.25] on every affected authored face. These are
   proposed conservative rejection thresholds, not established visual quality.
2. **After export:** independently skin the exact bytes and verify parity with
   actual runtime captures. Recompute every affected incident triangle plus
   the original 180-face patch and rear guard against full body and retained
   bra in every stored pose. Require no crossings, no body containment, no
   ambiguous body classification, and strictly positive whole-surface distance.
   Proposed repair target: >=0.5 mm unsigned bra separation for the six seed
   faces in all checked poses. Elsewhere, do not reduce an existing positive
   per-pose minimum (allow 1e-9 m arithmetic tolerance); the body must retain
   each d81 per-pose minimum and the unchanged rear witness. Report actual
   margins even if all gates pass; the fixed 0.0469 mm rear gap remains fragile.
3. **Frozen coverage:** replay all 23,310 bra/vest additional-removal footprints
   against this exact new geometry, using the original calibration and masks.
   Preserve source replay parity and the existing negative controls. The d81
   full replay and older 44 unchanged-subset proof do not transfer to new bytes.
4. **Essential GPU evidence:** run the real owner/loader with exact asset-hash
   recording, both accepted bobs, ordinary and diagnostic foundation-tag views,
   front/back and elevated oblique cameras, the full happy/angry/fearful stress
   sequence and previous mild sequence. Capture the beat neighborhoods more
   densely, including rendered steps 98/99 and 270, and the rear guard at 720.
   Review actual motion for contact, flicker, seams, silhouette and collar form;
   tags/rays support attribution but ordinary rendered quality decides fit.
   Repeat wardrobe foundation combinations, styles and undress/redress, with
   owner stats/resource checks. Preserve accepted lower-body and hair views.
5. **Stop at the first failed invariant or final gate.** Archive the one candidate
   and its failure; do not promote it, hide failures with masks, enlarge support
   or soften thresholds. If the required support is insufficient or a conflict
   with body/bra clearance remains, the result is a useful bounded infeasibility
   diagnostic for a separately designed fit/skinning study. Passing discrete
   checks still does not establish all-motion or full AAA-quality qualification.

Reproduce the executed inspection only, from the repository root, with a fresh
output path (this does not solve or write a GLB):

```sh
node captures/collar-expression-stress-2026-09-16/fit-plan/inspect.mjs /private/tmp/sugata-fit-plan-inspection.json
```
