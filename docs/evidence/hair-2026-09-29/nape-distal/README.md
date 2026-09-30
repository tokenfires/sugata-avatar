# Measured distal nape release

**Freeze this candidate for further qualification; keep the accepted groom as the default.** The short nape silhouette survives the reviewed views, and the prior neck intersection is absent at every sampled pose. The broader rear disorder remains.

## Visible result

| Accepted source, original dark material | Experimental release, same conditions |
| --- | --- |
| ![Source nape](../../../../captures/nape-distal-v1/baseline-motion-dark/frames/0000.png) | ![Experimental nape](../../../../captures/nape-distal-v1/motion-dark/frames/0000.png) |

The lateral hook disappears. This visible gain includes the earlier shortened guide. The additional release addresses a geometric contact beneath overlapping hair; these images do not establish visibly exposed clipping in the old guide.

Root and critic inspected actual brown, dark, rear and rear-oblique images at neutral, yaw, pitch and roll samples. The critic found no new visible gap, ledge, hook or crease. Continuous playback and ordinary combined procedural motion remain open.

## Intervention and controls

The frozen first guide crossed the neck at frame255, t4.25s, upward15° tilt. Three selected vertices lay inside the body, with consistent nearest outward directions. The new recipe translates both edges of each ring by `(ring/16)^3 × 7mm` along their mean direction, preserving the root and width vectors. Tip translation is approximately `[−0.0263,+3.4873,−6.0694]mm`. This is one measured intervention, with no parameter sweep.

- Recipe: `node tools/critic/bob-nape-distal-candidate.mjs`.
- Candidate: `captures/nape-distal-v1/candidate.glb`, SHA256 `b418d97eacd6edd4312fb198959b69f0cb6dbf0531abe17bda7f0791ef9d04e4`.
- Exactly32 positions and normals change relative to the first guide. Root, other cards, cap, UVs, weights and topology remain unchanged. Width-vector rounding is at most0.000002083mm.
- Rest: zero selected triangle/body pairs; minimum moved-vertex clearance14.906mm.
- Motion: the same9.25s head-only sequence at60Hz as [Slice6](../nape-motion/README.md). Each run has186 actual PNGs at20Hz and38 geometry samples at4Hz. Two seconds of final recovery is not a settling gate.
- Three appearance configurations: brown rear-oblique with neutral light chromaticity; original dark rear-oblique with Studio lighting; brown back view. Their candidate geometry trajectories are identical, so they add viewpoints/material observations, not independent motion coverage.
- All38 nonselected-card/body/rig/head/clock/collider samples match each corresponding control exactly. Whole-groom velocity hashes differ as expected because one card changed.
- Native owners dispose without recorded leaks. The harness monitors page errors and HTTP responses≥400; those arrays are empty. It does not record every console or failed-request event.

| Selected-card result | Accepted source | First short guide | Distal release |
| --- | ---: | ---: | ---: |
| Triangle/body pairs across38 samples | 26 | 13 | 0 |
| Minimum vertex clearance | −5.088mm | −3.864mm | +2.389mm |

These numbers exclude garments, hair-hair contact and times between readbacks. They do not qualify the whole groom or prove positive clearance at every point. The large root width-axis rotation remains substantially unchanged; its midpoint stays fixed and a visible crease has not been established. Do not tune that statistic without a new witness.

## Decision and recovery

The [independent critique](CRITIQUE.md) offers two next alternatives: a matched ordinary procedural-motion pair with denser readbacks and playback, or holding this successful local correction while tracing the wider authoring problem. Root selected the source-stage trace next because the Blender runtime has been recovered in an isolated profile. The distal recipe remains frozen; no accepted asset is replaced.

Exact commands, PIDs, times and scoped results are in [summary](summary.json), per-run reports and [the overnight checkpoint](../../../OVERNIGHT-2026-09-29.md). Raw local files and their source snapshots are inventoried in [archive manifest](archive-manifest.json). They are ignored by Git; the manifest is not a remote backup.
