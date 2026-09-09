# Brow and lash coverage qualification — 2026-09-09

The g050 material-only candidate makes the brows and lashes visibly softer while keeping their
original texture color, face geometry and motion. Root and independent review find retained
brows, a more natural eye line and no obvious new detached trail in the sampled natural/blink
frames. It is not installed by this record: live rendering-mode transitions still need an owned
fallback before adoption.

The current binary cutoff renders every surviving atlas texel fully opaque. The candidate adds
one beauty alpha-test node, `max(0.1, existingStochasticThreshold)`, so the original atlas alpha
becomes coverage above the same background cutoff. It changes no albedo floor, specular value,
map, geometry, morph/skinning expression, lighting, hair or opacity multiplier. The numeric
shadow cutoff remains 0.1. Both meshes cast and receive shadows.

The original atlas predicts equivalent coverage of 40.58% of the binary retained brow area and
68.64% for lashes. These are atlas-domain values, not screen-area measurements or quality scores.
Six CPU groups check the coverage probability and original material/source constraints.

The qualified V3 comparison contains **152 images / 76 pairs**: converged 12° and 45° views,
three seconds of natural motion sampled every 15 frames, and two seconds of declared blink/brow
motion sampled every two frames. Full saved physical/morph/camera state matches in every pair.
The 3,264 actual card draw observations across 1,632 submitted frames also match in-pass jitter,
projection, frame IDs, bones and morph weights. Every candidate draw records the correct existing
stochastic offset. All 103 frozen source inputs remain exact; runtime errors are zero.

Stage's existing exact MorphVelocity patch stays installed. Brow/lash compiled vertex flow,
including previous morph and skinning expressions, remains identical in all four workloads.
Six shadow fragment programs are byte-identical in every pair. Eight shadow vertex programs
match after consistently renaming generated NodeBuffer identifiers; three raw hashes differ
because of those names. This proves preserved compiled expressions and inputs, not an independent
numeric velocity or all-shadow-texel result.

V1's four stills remain preliminary. V2 correctly stopped when actual observations showed that
Three's idle animation clock advanced between draw and readback. V3 follows the existing
capture takeover: stop the idle renderer animation loop, use unique monotonically increasing
frame IDs above a common 1,000,000 epoch, match shader time to simulation, and reset the existing
TAAU epoch once per arm. Boot IDs were 71–76, avoiding previous-morph frame-ID collisions.
This changes only the test clock; the material candidate is identical across the three probes.

Some moving-lid grain remains in both arms. Sampled still review is not full-speed playback,
all-expression qualification or a guarantee across identities, zooms and lighting. The existing
hair crown facets and other skin/eye artifacts remain visible. The next owned implementation
must use binary coverage whenever temporal AA is off, debug/custom output bypasses the resolve,
or the material is retired. The scratch helper checks only installation-time support.

Root independently rehashed all **208 files / 139,298,696 bytes** in the local ignored archive
`captures/card-coverage-2026-09-09/`. Its `archive-manifest.json` SHA-256 is
`1a3b05b279b31f68689edf17f3571117af147f2d24626595f9b2ae7b7be9beb5`.
It preserves preliminary/failed probes, qualified images, actual draw traces, source snapshots,
compiled programs and the exact helper. This record changes no production rendering or assets.
