# Live GPU follower hair — September 9, 2026

**Unshipped experiment.** Fine camera-facing bundles can follow the existing 496-guide simulation
without adding a simulation dispatch or a per-frame CPU readback. Natural motion and a head nod
preserve all saved physical values exactly. This is not an accepted final look or production mode.

## Implementation and actual GPU checks

A scratch copy of HairDynamics adds only a borrowed read-only card-edge accessor and retirement
callbacks. A source-splice test reconstructs production HairDynamics exactly after removing that
addition. The final rebuilt card edges remain owned and written by the original solver.

The renderer uses 31,050 bundles, 1.2 mm wide, with 993,600 triangles and 1,055,700 vertices. Each vertex
gathers the two source edges at its ring and neighboring rings, interpolates across their width,
and derives its tangent. An explicit varying carries that tangent to fragment shading. The
follower mesh shares the source groom's transform without skinning twice; authored rest positions
remain available for spatial lock albedo. Original alpha/depth/root textures are borrowed.
All 1,128 cap triangles remain on the source mesh. Coverage times atlas alpha is in color alpha
for both beauty and shadow masking. No production hair or solver source is changed.

Nine CPU groups cover source isolation, layout, read-only aliasing, texture/buffer lifetime,
construction failure, source retirement and ordinary transform behavior. Actual compiled WGSL
confirms one read-only edge-storage binding and six loads in beauty/shadow vertices, with no edge
storage reads in the beauty fragment. Fragment tangent normalization and the guarded scatter
normal are present. The actual compiled shadow fragment also thresholds analytic bundle coverage
times the original atlas alpha and has no storage binding; its exact source hash is in the follow-up.

Actual diagnostic GPU gathers were compared with CPU interpolation of the same saved card edges
for all 496 cards, five rings including endpoints, and five width fractions: 12,400 samples per
capture. The natural pose at 4 s was checked twice; the nod pose at 4 s was checked once. Worst position component
error was 0.143092 µm; worst raw tangent component 0.115858 µm; worst normalized tangent component
0.000138855. These are component errors, not Euclidean distances or clearance tolerances.

## Paired motion and lifetime

Two fresh actual Avatar pages per stimulus ran four seconds at 1/60 s, with temporal AA off in both
arms. Natural motion and a 0.5 rad sinusoidal head nod each saved nine complete poses per arm:
36 states total. Source geometry, body/rig, centers, velocities, rebuilt card vertices, normals,
clock and camera arrays remain bit-exact. Numeric arrays carry byte hashes made before JSON
serialization, preserving signed zero. Runtime readback count is zero, and compute submissions
match the original arm exactly. Sixteen final orientation views also preserve physical state.

Removing followers restores the original index and successfully draws the original hair without
changing its data. Reset remains identical to the original solver. Reinstallation followed by
direct solver retirement detaches followers before storage deletion; storage reaches zero before
Avatar retires its remaining hair objects. The probe does not attempt to draw an original mesh
whose solver the caller has manually disposed. Borrowed textures are never disposed by followers.

The first motion instrument attempt failed on JSON's signed-zero normalization in camera values;
it is retained as failed evidence. The retry adds the numeric byte hashes and initial draw-only
warm frames. A concurrent request-reference comment correction also occurred during the failed
attempt; executable code did not change. Both successful motion runs freeze the corrected source.

## Cost and visual status

One matched whole-Avatar cost pair used 64 warm and 360 measured fixed 60 Hz frames, two simulation
substeps each. Control submission through GPU completion measured 23.8 ms median / 34.2 ms p95;
followers measured 26.1 / 35.9 ms. The source simulation stayed bit-exact. This shared-machine,
temporal-off pair is not a production FPS certification or a precise isolated delta.

The prototype adds about 54.1 MB of geometry-related renderer resources. Solver storage remains
23 buffers / 4,237,664 bytes in both timed arms; texture count and size are unchanged. The separate
fixed-pose cost control is in [the earlier follower record](HAIR-FOLLOWERS-2026-09-09.md).

Sides and rear still read more continuous in the inspected nod poses, but crown patches and
separated ends persist. Temporal AA is deliberately off because held velocity omits both live
deformation and camera-facing expansion. The experiment therefore does not provide a finished
moving portrait. The bounded contact qualification below leaves full-body and higher-mip visibility
limits explicit; source card clearance does not transfer automatically. Density is fixed from one
posed width census, and resampled alpha does not preserve original coverage exactly.

The observed source transforms are identity/ordinary Avatar TRS. The scratch guard does not
explicitly reject a manually projective matrix bottom row. No arbitrary Matrix4 support or
exhaustive near-degenerate view/tangent test is claimed.

## Bounded follower contact qualification

CPU reconstruction checked natural/nod 0 and 4 seconds at the four final camera positions.
All 496 cards have **zero face-region triangle pairs** in all 16 combinations. Full-body scope is
limited to nine nape curtains: 188, 193, 198, 201, 202, 211, 217, 223, 272. Their full triangle pairs are:

| Saved pose | 0° | +90° | 180° | −90° |
| --- | ---: | ---: | ---: | ---: |
| Natural 0 s | 3 | 0 | 0 | 0 |
| Natural 4 s | 0 | 0 | 0 | 0 |
| Nod 0 s | 0 | 0 | 0 | 0 |
| Nod 4 s | 0 | 8 | 0 | 10 |

The 21 pairs involve card 272's terminal span at natural 0 s, and card 217 / span 0 plus card 272 / spans 1–2
near the posterior head in the held nod. Maximum sampled negative depth is 0.36599 mm. Separately,
samples with base alpha ≥ 0.5 remain at least 1.52051 mm clear. These samples do not certify continuous
opaque clearance. All complete crossing regions are zero in modeled base and CPU box-mip 1–2
bilinear footprints, but mip 3+ bleed/actual visibility remains unresolved; card 217's projected
LOD estimate reaches 3.87. No zero-finite-witness transparency inference is used.

The exact source-card reference has 5 pairs in the same held-nod family. An initial reference
shortcut used the follower diagonal; final attribution reads actual GLB indices. Counts remained 5,
but half-triangle IDs/endpoints changed. Follower checks always used the correct HairRibbons
topology. Removing follower width at crossing fractions leaves the interpolated centerline
locally 0.0903–0.5964 mm clear, so finite camera-facing width contributes to these contacts.

The check covers 298,496 nine-card triangle/views and 2,089,472 signed samples. The all-card face
check filters 15,897,600 triangle/views to 3,029,971 region candidates before exact clipping.
All four control/candidate endpoint snapshots independently match physical array hashes and
body/hair/velocity/head/clock/camera values. Scalar Float32 reconstruction does not prove exact
expanded GPU edges near view/tangent alignment; the prior 0.143 µm basis test covers centers only.
Only final-pose orientations were actually rendered. Caps, other cards' full-body contacts,
intermediate motion and actual mip/occlusion qualification remain outside this result.

## Evidence

[The ledger](evidence/hair-live-followers-2026-09-09.json) records hashes, samples, cost and limits.
`captures/hair-live-followers-2026-09-09/` retains instruments, source bytes, full poses, PNGs,
actual compiled WGSL, transformed routed source and the failed instrument attempt. The separate
[contact and shadow follow-up](../captures/hair-live-followers-contact-2026-09-09/README.md) preserves
all 16 results, source/input hashes, full intersection witnesses and the topology correction. It
does not mutate the primary archive or mark the strict body/visibility gate passed. All production
defaults remain the corrected card groom.
