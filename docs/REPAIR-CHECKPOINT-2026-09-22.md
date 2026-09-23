# Eleven-gate repair checkpoint — September 22, 2026

This work starts at `d54a6ce` (PR #2) on `codex/resolve-eleven-gates`.
Robert requested a stopping point before switching to Koselig. The work is therefore saved
as a partial repair, with the remaining appearance and groom work explicit. No geometry
candidate or collar fit has been promoted. Final suite evidence is recorded below when complete.

## Repairs and their focused evidence

Raw outputs are in [the evidence directory](evidence/eleven-gates-2026-09-22/).
These focused runs were made on the modified working tree during implementation, not a clean
committed tree. The later whole-suite run is the integration check.

| Original failing gate | Change | Focused result |
| --- | --- | --- |
| HairDynamics | Increase damping to settle held-head motion; unchanged settling ceiling | 35/35; 3.1262 mm becomes 0.0258 mm |
| Sway | Derive rear travel from the skinned heel footprint; retain it through reset | 285/285 before the additional optional affect-rail repair; final integration run verifies both |
| HairOIT | Measure reload noise against the smallest order signal and require separated uncertainty intervals | 33/33, including boundary controls |
| HairShadow | Reject low-alpha atlas texels in the shadow pass at cutoff 0.35 | 9/9; contact and negative controls remain enforced |
| Wardrobe shadow | Scale normal bias to four shadow texels for the current filter | 23/23; contact 1.128x and acne 4.323x against unchanged 1.12x/8x limits |
| Alive toggles | Share the real state inspector and classify the new Stage members | 197/197 |
| Hair alpha | Increase the wisp strip's strand duty from 0.126 to 0.220 | 43/43 across seven atlases |
| Quoted numbers | Withdraw four unsupported live historical claims to an explicitly unverified archive | 25/25; missing reference images remain missing |
| Request ledger | Adjudicate 22 old requests, advance the round, and make negative controls support an empty OPEN backlog | 27/27; 77 APPLIED, 14 REJECTED, zero OPEN |
| HairMaterial | Correct the camera-relative headlamp arm and the gain comparison | 76/80; four appearance failures remain |
| GLB verification | No groom geometry change accepted | Original 20 geometry problems remain to be rechecked by integration |

The request ledger repair includes real implementation work: hair startup capture determinism,
selected-mesh material assignment, capture subsystem reports, shadow ablation composition,
live light reporting, real scene setter tests, geometry-based subject masks, photometry Markdown
emission, and registration of the standalone hair diagnostics. Six requests were rejected with
written technical reasons; zero OPEN does not mean every proposed change was implemented.

The optional rear affect rail uses one eighth of the measured rear support. The earlier quarter
allocation failed its independent toe-parking check: 14.479 mm allowed versus a 12.62 mm cliff.
The default affect full scale remains zero. This is an engineering safety allocation, not a
literature-derived emotional movement amplitude. The main footprint repair independently gives
the g000 fear trace 1.349 mm minimum margin over the 900-second test window.

## Asset boundary and reproducibility

Only atlas pixels and their embedded PNG payloads changed in the eleven shipped hair GLBs.
The geometry, skinning, accessor content and non-image buffer views are preserved. The replacement
tool has an automated byte-preservation, alignment and idempotence test. The manifest records
before/after hashes. No body or garment GLB changed.

Generate the atlas with `python3 tools/figure-pipeline/hair_texture.py --out <directory>
--seed 20260812`. The installed bob01 albedo SHA-256 is
`567bf4513b056878aed83c8418446ec6e4fc262653680ab5815be8a6e7422da5`.
For each hair GLB, replace embedded images with
`node tools/figure-pipeline/hair_atlas.mjs <input.glb> <atlas-directory> <output.glb>`.
The atlas recipe is shared across the seven styles. Geometry candidates stayed under
`/tmp/sugata-eleven/`; radial lock deformation and the stronger Blender clump candidate were
rejected on visual inspection despite improvements to selected numerical metrics.

Blender was recovered from the existing Homebrew-cached 5.2.2 ARM64 DMG, SHA-256
`dc4125399b8bfefe283cc1624d6cfc7809d1cac20ace51072127eb371f31f210`, mounted read-only at
`/tmp/sugata-eleven/blender-volume`. Dependencies were installed only into the isolated
`BLENDER_USER_RESOURCES=/tmp/sugata-eleven/blender-profile`; no system app or normal user
profile was installed or changed. The mount can be detached at the checkpoint and remounted
from the cache on resumption. Temporary paths are conveniences, not durable evidence.

## Remaining work and next bounded step

1. HairMaterial's four appearance clauses still fail. No threshold was loosened, and speculative
   shader changes that produced blue hair or overexposed skin were discarded.
2. Accepted groom geometry still needs coherent locks, the bob01 clearance repair, and the
   recorded short-style gathering/coverage fixes. Author continuous guide curves and qualify
   their exact output against clearance, coverage, motion and oblique visual checks before promotion.
3. The newly registered opacity diagnostic exposes excessive side-curtain transmission. Its
   corrected outside-footprint liveness control now rejects the shifted-mask defect. Other
   historical liveness operators still need review; this checkpoint does not claim full opacity
   instrument independence.
4. The geometry-mask critic was exercised on studio, desk and kitchen. Kitchen's L3 lighting
   result remains red; the mask repair does not imply scene-quality acceptance. Photometry output
   was generated from live beach captures and included verbatim in the punch list.

Live lighting reports contain actual light-object parameters. Their derived irradiance assumes
the sources face the focus; arbitrary later rotations or cone edits invalidate that estimate.
It is not a measured pixel value.

## Integration validation

Pending the final suite and build on the checkpoint implementation commit. This section will
be updated with the observed result; the declared-red file does not suppress failures.
