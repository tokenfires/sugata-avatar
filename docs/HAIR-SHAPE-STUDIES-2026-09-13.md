# Hair shape studies — September 13, 2026

**All candidates in this checkpoint remain unshipped.** The accepted collision, render-history,
face-card and crown-root changes at `5e1b1cb` are preserved. These studies identify the exposed
rear backing and test localized coverage. They do not establish a finished hairstyle.

## What the images establish

The current g050 bobs contain 496 cards in eight authored groups. Broad surface/veil cards are
not the whole rear defect. A diagnostic that colors the original groups while preserving their
geometry and alpha shows a large central rear region belonging to the short cap/root layers.
Longer layers sweep around it, exposing that backing. It is not missing scalp geometry or a bald
skin hole. This is why a localized posterior layer is a better next coverage experiment than
more smoothing of the existing mesh normals.

| Study | Actual WebGPU samples | Result |
| --- | --- | --- |
| Sparse surface/veil followers | 18 PNGs; both bobs, baseline/additive/replacement, three angles | Additive fibers barely affect the broad panels. Replacing the selected 138 cards smooths some regions but retains broad joins and patchwork. No useful moving-avatar qualification earned. |
| Original layer identities | 6 PNGs; both bobs, three angles | Rear cap/root exposure is visible inside surrounding surface and veil layers. Source geometry and alpha preserved; diagnostic lighting/color intentionally differs. |
| Uniform posterior curtain | 12 PNGs; both bobs, baseline/candidate, three angles | Covers the rear opening with continuous fall, but creates a smooth panel with repeated comb-like ends. Front framing looks essentially preserved in sampled views. |
| Seven-lock refinement | 18 PNGs; both bobs, baseline/uniform/locks, three angles | Adds variation but reads as long separated panels with broad highlights. Some narrow slots expose the backing again. Front/side mostly unchanged. |

The critic independently checked all recorded PNG hashes and reviewed the new images; identical
controls were reused only after byte comparison. Its source and image reviews provide two alternatives
per actionable concern. See the archived `critic/` directory, including `curtain-review/REVIEW.md`
and `curtain-locks-review/REVIEW.md`.

## Implementation and limits

All studies use current production source without module routing, fixed clocks and 96 converged
zero-delta draws per 12°, 60° and 140° view. Original solver positions, velocities, vertex data,
face inputs and head state remain equal across paired arms. These are fixed-pose comparisons,
not motion, cost or contact qualification. Camera comparisons treat signed zero numerically.

Each authored curtain adds 64 narrow cards with 49 rings: 6,272 vertices and 6,144 triangles. It is
rigidly attached to the actual head joint. No new hair physics or temporal deformation owner is
implemented. Preserving the original solver is not proof that the added surface inherits its
collision clearance. The sparse followers likewise lack qualified dynamic temporal history.

The curtain changes geometry and shading together, so its gain is not attributed to one parameter.
The uniform study disables lock tilt; its copied atlas UV would be invalid as a nonzero lock-ID
field. The separate seven-lock version corrects that dormant problem with constant per-card lock
IDs. The critic's CPU geometry probes verify finite, nondegenerate triangles and unchanged source
positions for both variants. They do not replace moving visual evidence.

The first layer-ID harness failed on a signed-zero camera comparison before capturing a diagnostic
PNG. Its report is preserved separately in `layer-id-failed-v1/`; the corrected run is `layer-id-v2/`.
This is a harness failure, not an avatar defect.

## Next discriminating experiment

1. **Keep the inner curtain continuous and group only the outer layer.** This is the narrower next
   coverage-preserving trial: it predicts fewer exposed slots without flattening every visible
   lock into one continuous panel. Reject it if the broad artificial panels remain dominant.
2. **Vary each lock's bend and release height.** This targets the common horizontal transition and
   long straight panel lengths. It carries more silhouette risk and needs controlled comparison.

Do not expand motion/history/contact testing until an appearance gain earns it. Smooth guide-derived
shading tangents on the original groom remain a separate, untested mechanism for within-card
lighting facets; they cannot cover the exposed backing or change its silhouette.

## Recovery

Raw archive: `captures/hair-shape-studies-2026-09-13/`, **178 files /55,730,071 bytes**, each re-read
and verified. It contains all four completed studies, the failed harness, exact prototypes,
helper modules, referenced production source snapshots and independent critic records.

Tracked summary and manifest: `docs/evidence/hair-shape-studies-2026-09-13*.json`.
Manifest SHA-256: `2e02622e1bb58ac2f5bb026a04c0b21894bb6ef7cacc6ca5d0325dc52af4cd0e`.

The exact accepted GLBs stay in their normal asset paths, bound by the study hashes. Historical
follower/geometry experiments remain in their September 8–9 archives. Some scratch harness imports
retain absolute `/private/tmp` paths; restore the archived prototypes and helpers there, or explicitly
remap those imports before rerunning. This evidence checkpoint installs no hair candidate.
