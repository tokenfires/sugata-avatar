# Visual work window — 2026-09-08

The user authorized autonomous visual progress through **01:46 UTC September 9 / 6:46 PM Pacific**.
Heartbeat `advance-sugata-avatar-visual-quality` runs every 15 minutes in this task. At the deadline,
stop new experiments, checkpoint results and pause that heartbeat. Its schedule expires shortly after.

Working repository: `/Users/robault/GitHub/sugata-avatar`, branch `codex/local-restart`.
Starting commit: `735b734`; first face-wrap milestone: `5218c24`.
Read [restart context](RESTART-2026-09-08.md) for architecture and recovery boundaries. The old iCloud
checkout remains untouched. R36/R38 shader hypotheses remain refuted; reconcile missing later
shader/tool history before resuming that material research.

## Installed haircut

`assets/hair/bob02/g050.glb` now combines two calibrated post-export stages:

1. `hair_fall.mjs` releases 170 long cards below the temple. The original groom's corners could
   clear the skin while its connecting triangles sliced through the cheek; twelve guides crossed
   the head midline. The first correction preserved every vertex height, root, cap and crown.
2. `hair_hem.mjs` lifts 510 lower vertices across 52 forward cards by at most 17.934 mm. The front
   ends now follow the jaw-length cut with a little height variation. Roots, positions above
   y=1.50 m, x/z coordinates, ring widths, topology, UVs, textures and skin data stay fixed.

Both stages recompute the affected normal/tangent frames and enforce their own geometry/stamp
calibration. The historical fall stage deliberately refuses a later hem output. Rebuild from the
original export through both stages, or repeat only the last stage for its idempotence check.
The original 3.2 MB GLB is a resident Git LFS fixture, so full default tests work in a new clone
without Blender or ignored captures. See the [pipeline instructions](../tools/figure-pipeline/README.md).

Installed SHA-256: `dd00a39d8aaa02f71e0f91a43a4f4b07b51fd334e506117d25833735d686cae7`.
Its position/normal buffers exactly match the hem scratch candidate tested in motion.
No spring, collision, atlas, hair material, lighting or default-quality change is part of this haircut.

## Hair verification and limitations

Tracked evidence: [fall correction](evidence/hair-fall-2026-09-08.json),
[hem refinement](evidence/hair-hem-2026-09-08.json). Raw geometry, images and browser reports are in
`captures/hair-fall-2026-09-08/` and `captures/hair-hem-2026-09-08/` locally; ignored captures do not
arrive in a new clone. Original, fall-stage and candidate controls are preserved there.

| Check | Original groom | Installed fall + hem |
|---|---:|---:|
| Rest face triangle crossing pairs | 855 across 16 cards | 0 |
| 13 natural poses over 12 seconds | 841–872 in every pose | 0 in each pose |
| 17 controlled shake poses over 8 seconds | Not captured with this stimulus | 0 in each pose |
| Peak natural-motion mean tip lag | 11.815 mm | 11.793 mm |

The independent triangle-prism gate checks full triangle intersections with boundary contact
included at a numeric tolerance of 1e-9 m. Zero crossings does not certify positive clearance
at every point, wholly embedded triangles, or every possible animation. Signed GPU-surface samples
and rendered views supplement it: minimum sampled face clearance is 2.197 mm in natural motion and
3.447 mm during the controlled shake. There are still 165 head-region crossing pairs /21 triangles
outside the face box at rest; the natural sequence reaches 184 pairs in that larger region.

Validation on a **dirty working tree**: fall and hem default tests each pass nine groups from the
original LFS fixture; installed-hem idempotence/guards pass eight groups; surface geometry tests
pass 12 analytic groups including 1,000 seeded independent-reference triangle pairs; HairDynamics
quick mode passes 24/24, omitting its rejection proofs. All 17 pages build. The installed production
bob renders and moves on Chromium/WebGPU with no page, console or network errors during a
2-second check. Actual Chrome now works after the user's TCC approval: the installed bob renders,
expression and pause/resume controls respond, and captured console errors are empty. The existing
in-app portrait tab was refreshed. The full gate suite was not rerun; existing red declarations remain.

`HairDynamics.readVertices()` is opt-in world-space GPU card readback, adding no per-frame work
until called. `portrait-clearance.mjs` captures the same frame's rebuilt hair and morphed/skinned
body. `portrait-surface.mjs` replays the full triangle gate and rejects incomplete file sets,
clock/cadence mismatches, invalid metadata and empty calibrated comparisons. Its independent review
caught two false-pass cases (stopped clock and misplaced head matrix); seven self-contained
regression checks now cover those failures and real geometric crossing/clear controls.

## Verified renderer repair

With the high preset, orbiting beyond the studio backdrop could black out the entire canvas.
A full-resolution foreground pixel sampled a cleared zero bent direction in the lower-resolution
GTAO target. Normalizing it produced NaNs, which bloom spread across the frame. GTAO now chooses
the current surface normal before normalization when that sampled direction is degenerate.
Valid bent normals and occlusion remain active.

Five corrected angles have finite AO, composite and bloom targets and a visible figure. An isolated
old-code arm reproduces 2,520 invalid composite pixels and all 134,250 bloom pixels invalid at 90°.
The new orbit regression passes 12 checks; existing GTAO tests pass 27/27, including rendered AO,
specular occlusion and rejection proofs. These runs were on a dirty tree. The [tracked renderer
ledger](evidence/orbit-regression-2026-09-08.json) records source/asset/report hashes. Raw evidence:
`captures/orbit-regression-2026-09-08/`. Existing transparent-background restrictions remain.

## Visual experiments and rejected directions

- First fall candidate missed three forward-swinging cards and retained 71 face crossing pairs;
  the accepted second candidate includes them.
- Early baseline-pilot, baseline-surface and baseline-motion recomputed body normals, producing
  misleading seam signs. Their signed classifications are superseded by baseline-final, which
  follows the renderer's morph/skin normal path. The triangle-intersection defect was independently valid.
- The early high-preset experiment kept resolution scale at 0.66; it was not a full-resolution test.
  Its 90°/180°/−90° screenshots were blank because of the now-fixed GTAO bug and are not visual
  quality evidence. A later explicit scale1 comparison sharpened pixel detail but retained the
  coarse hair patches. The neutral-rim trial made the face glow orange and was rejected.
- Flipping only internal diagonals relocated the bright crown/back patches with matched poses and
  unchanged shader/atlas bytes. This demonstrates triangulation sensitivity, but that geometry
  was equally coarse and was not shipped. It does not isolate direction from UV/depth interpolation.
- A restrained 2 mm ribbon-frame correction preserved centerlines, roots, widths and silhouette,
  and reduced large direction jumps 586→400. Five matched views still looked coarse and patchy.
  That candidate was rejected; no motion testing or hem composition was done for it.

## Current continuation point

All accepted code is ready for local checkpoint commits: the two-stage bob, full default fixture
tests, pose-evidence integrity guards, and GTAO orbit repair. The third geometry experiment is also
closed: splitting 205 wide cards into three produced 906 chains, reducing direction-jump p90
71.36°→20.17° with zero static face crossings. Ten matched static images remained broadly patchy;
the visible improvement did not justify installing it. Motion and cost were never measured.
All three rejected candidates and renders are preserved locally under `captures/hair-facets-2026-09-08/`;
the [tracked experiment ledger](evidence/hair-facets-2026-09-08.json) records conclusions and hashes.

There are no active agent edits or browser capture jobs. Do not repeat frame smoothing or width
subdivision without a new prediction. A useful next visual probe is a fully neutral, balanced light
rig to separate the strong coloured lighting from the remaining broad hair patches; the earlier
single-rim edit was not that comparison. Keep this as a scratch comparison and review actual pixels
before proposing a new look. Missing shader history still blocks a safe continuation of R35–R38.

Root owns integration and runtime acceptance. `continuity_audit` delivered fixtures/tests;
`orbit_render_audit` delivered the GTAO fix and independent pose-checker review;
`visual_next_step` completed the three geometry experiments. No Blender installation or history transplant.

Dev server: port5197, exec session26208. Production server: port5198, exec session71084,
output `/tmp/sugata-hem-build`. Check ports before restarting. The dev server remains for the user.
