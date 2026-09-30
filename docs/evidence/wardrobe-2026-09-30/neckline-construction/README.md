# Raised crew-neck: reject and preserve the boundary counterexample

One deliberately simple shape candidate improves the front view but fails the obliques and body fit. Keep accepted44 as default. Do not retune the 12/4/80 values or add lining to this closed study.

![Candidate front](../../../../captures/neckline-shape-2026-09-30-v2/candidate-0.png)
![Candidate oblique retains foundation exposure and hollow side opening](../../../../captures/neckline-shape-2026-09-30-v2/candidate-45.png)

## Shape and actual images

The [predeclared contract](PLAN.md) replaces the old 34-group support with a continuous 80 mm annulus. Its 20-point rim and 30-point outer boundary include the previously fixed rear faces. It moves 112 welded groups / 124 vertices, affects 234 complete triangles and recomputes 156 vertex normals. The single construction applies 12 mm upward plus 4 mm mean-normal displacement with quintic falloff. Maximum actual displacement is 15.9513 mm; affected face area ratios are 1.0008–1.3328 and minimum orientation dot is 0.9372. All topology, UVs, joints, weights, masks, materials, skeleton and trousers remain unchanged.

Exact candidate SHA256: `9ba24c2fa72499e3e29f10850c147bfc5a174cd4b38ec8f8eacea1865cd62e35`. This is an isolated shape observation, not an installed asset.

The native comparison contains front, both 45-degree obliques and rear for accepted/candidate. Both arms use Original materials because the qualified Ecru loader correctly rejects unknown asset bytes. All eight actual responses match the pinned expected GLB, all recorded non-cloth physical state agrees per view, and the clocks match. Eight disposals report no leaks; no recorded page/console/HTTP errors. Root inspected all originals; the [independent critic](CRITIQUE.md) gives the separate verdict and alternatives.

The front chips disappear. Both obliques retain a narrow grey foundation island, while new black side openings make the collar appear detached from the neck. The rear transition alone is insufficient to accept the shape. This observation does not establish every black pixel's cause, and no DoubleSide or lining intervention was performed on this candidate.

## Exact saved-pose geometry

An independent whole-triangle comparison uses all 234 affected triangles in the actual recorded zero-time CPU-skinned pose, full body triangles and the 327 actually retained bra triangles. The body's positional-weld topology has no boundary, nonmanifold or orientation edges. Signed nearest-surface samples support diagnostics; whole-triangle predicates and separate containment checks govern these results.

| Recorded shape | Body crossing faces | Body-inside triangle centroids | Retained-bra crossing faces |
| --- | --- | --- | --- |
| Accepted44 | 27 | 11 | 5 |
| Candidate | 11 | 1 | 0 |

Candidate minimum separation from the retained bra is 11.6509 mm in this pose. This illustrates the distinction between clearance and coverage: separated foundation geometry can still be visible through the opening. The body still intersects faces 578, 579, 662, 663, 1447, 1496, 1497, 1515, 1516, 1517 and 1521. A centroid inside the body does not imply that its entire triangle is contained.

### Immutable boundary conflict

The separate boundary check retains all 32 protected raw vertices incident to the patch. Vertex **312**, incident to faces **578/579**, is unchanged between accepted and candidate at world position `[0.0246194154, 1.2751214504, 0.1302341372]`. Its closed-body winding number is **1**, and all five declared parity rays report one nonambiguous crossing/inside.

This is a concrete obstruction to making the entire patch body-exterior while preserving this boundary and pose. It is not general garment infeasibility, an interval-arithmetic proof or authorization to grow the support repeatedly.

## Decision and next direction

Close this deformation study. A future collar repair needs an intentionally chosen attachment boundary outside the body, an explicit neck-opening shape and freshly qualified connecting surface; a separately authored compatible foundation remains a distinct alternative. Each requires its own fit, masks/coverage and motion evidence. Switching to another product slice now avoids turning this into repeated offset or support-width trials. No vest, complete-garment, motion or all-view appearance acceptance was earned.

## Jobs, failures and recovery

```sh
node tools/figure-pipeline/neckline_construct.mjs
node tools/figure-pipeline/neckline_shape_capture.mjs
node tools/figure-pipeline/neckline_shape_audit.mjs
node tools/figure-pipeline/neckline_boundary_check.mjs
```

- First construction invocation failed parsing before execution. Exact failed source is retained; the missing parenthesis was repaired before the single export. Construction PID 10107 completed 16:06:21.562 UTC.
- Native V1 PID 11752 / exec 16845 retained four Ecru accepted views, then failed the intentional qualified-colourway guard. No bypass. Fresh V2 changed both arms to Original.
- Native V2 PID 12364 / exec 32660 completed eight views; temporary server/browser closed.
- Geometry audit PID 13812 / exec 71159 completed 16:13:04.098 UTC.
- Boundary check PID 15038 completed 16:15:19.372 UTC.

[Summary](summary.json) binds the reports; [archive manifest](archive-manifest.json) binds original assets, sources, snapshots, images, failures and results. This is local evidence, not an off-machine backup. No job from this packet is live. Preserve the port-5173 review service and every earlier frozen packet.
