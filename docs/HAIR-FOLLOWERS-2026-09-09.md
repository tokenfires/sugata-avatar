# Fixed-pose follower hair — September 9, 2026

The corrected follower preview smooths the broad facets through the long bob's sides and rear.
The crown and separated hem strips still need work. **This is an unshipped experiment, not a
replacement for the corrected production g050 groom.** All production hair bytes are unchanged.

## What was compared

The actual Avatar was stepped to four seconds, then its final GPU card edges were read once.
Camera-facing bundles interpolate across those solved cards. The guide simulation remains frozen
while each of four views is drawn 32 times. All 1,128 authored cap triangles remain present.
Every draw-only comparison restores the exact pose, full body, all hair vertices, velocities,
head/rig transforms, clock, contact frames and camera. All four runs share that same physical pose.

| Variant | Bundles | Ribbon triangles | Assessment |
| --- | ---: | ---: | --- |
| First pilot | 11,904 | 380,928 | Wide fringe under-covered; wrong lock-albedo coordinate basis |
| Density and basis correction | 31,050 | 993,600 | Denser fringe and smoother sides; shadow coverage bug remained |
| Corrected shadow coverage | 31,050 | 993,600 | Promising smoothing; crown and hem still visibly patchy |

All bundles are 1.2 mm wide. The denser version spaces centers by at most 0.6 mm at each card's
widest ring. Its geometry retains separate posed-world coordinates and authored rest-local
coordinates, so the existing spatial lock-albedo field uses the same basis as the original hair.
Original atlas alpha, depth and root attenuation are sampled at interpolated original UVs.
Geometric tangents bypass flow-map direction/jitter; copied lock IDs are dormant in this mode.
The density control also corrected the albedo basis, so those two effects are not isolated.

## Corrected prototype error

The first two variants placed analytic coverage times atlas alpha in `opacityNode`, with
`colorNode.a = 1`. Beauty saw that coverage; the installed hair shadow mask and Three's shadow
renderer read color alpha and cast solid strips. The separate corrected variant places the
product in `colorNode.a` and leaves `opacityNode` null. It keeps the denser geometry and other
material choices fixed. The earlier images must not be treated as correctly shadowed comparisons.

The density run also includes a front view with all cap triangles temporarily hidden. Broad
upper patches remain: this observation does not support blaming the cap alone.

## Rendering cost and practical limits

One actual browser ran control/candidate/candidate/control at the fixed pose. Each arm warmed
for 32 draws, then measured 180 serialized draws. Submission through GPU completion had control
medians **4.7 and 2.2 ms**, versus candidate **7.7 and 7.1 ms**. The candidate adds rendering cost;
the variable controls do not justify one precise delta. These values exclude animation, readback,
rAF and compositor waits. Summed render timestamps overlap and are not total GPU duration.

The candidate adds almost one million ribbon triangles. It does not prove live frame rate,
correct deformation velocity or body clearance of the expanded bundle edges. Resampling the
atlas across overlapping bundles does not preserve its original coverage exactly. All 496
rendered cards, including protected roots, change primitive even though their simulation is intact.

A next scratch experiment can gather final card edges directly in the vertex shader. It needs
an explicit borrowed-buffer lifetime, correct local/world and rest-albedo bases, finite geometric
tangents, exact guide-state parity, motion/clearance review and measured cost. Held temporal
velocity is only a prototype limitation, not an acceptable claim of correct live motion vectors.

## Evidence

The [compact ledger](evidence/hair-followers-2026-09-09.json) records hashes, measurements and
limits. `captures/hair-followers-2026-09-09/` retains the three visual runs, cost run, 25 images,
full physical snapshots, instruments and exact eight core/asset source bytes used by each run.
The first pilot used Stage before the separate viewport-size fix; that predecessor is retained.
Visual runs freeze raw sources and asset hashes but do not archive transformed served modules.
The cost run records its single timestamp-only Stage route. No claim upgrades that provenance.
