# Visual work window — 2026-09-08

The user authorized autonomous visual progress through **01:46 UTC September 9 / 6:46 PM Pacific**.
Heartbeat `advance-sugata-avatar-visual-quality` runs every 15 minutes in this task. At the deadline,
stop new experiments, checkpoint results and pause that heartbeat. Its schedule expires shortly after.

Working repository: `/Users/robault/GitHub/sugata-avatar`, branch `codex/local-restart`.
Starting commit: `735b734`. Read [restart context](RESTART-2026-09-08.md) for architecture and recovery.
The old iCloud checkout remains untouched. R36/R38 shader hypotheses remain refuted; later missing
shader/tool history must be reconciled before resuming that material research.

## Accepted milestone: hair falls past the cheek

Installed `assets/hair/bob02/g050.glb` releases the lower front curtains into downward fall.
The original groom's corners could clear the skin while the wide triangles between them sliced
through the cheek. Twelve guides even crossed the head midline. This was an authored shape defect;
the accepted correction changes neither springs nor collision settings, preserving the shake.

The calibrated `tools/figure-pipeline/hair_fall.mjs` post-export step corrects 170 long cards while
preserving all vertex heights, roots, scalp/crown/fringe, topology, UVs, joints, weights and materials.
Moved card normals are recomputed. Median guide arc shortens 2.90 mm by removing inward detours;
maximum growth is 0.0095 mm. It refuses an uncalibrated bake and is byte-idempotent on its stamped
output. Blender is unavailable locally; no Blender installation or untested authoring-script edit.
Future bob02 regeneration requires the explicit post-export command in the figure-pipeline README.

Installed SHA-256: `5a9ef270a1caed23868510cc089d5b6d7732c49430abe8b896b1fc353fb399fd`.
Its position/normal buffers exactly match the unstamped v2 used for the main motion comparisons.

## Evidence and limits

The [tracked evidence summary](evidence/hair-fall-2026-09-08.json) preserves hashes, per-pose counts,
runtime metrics, calibration and test scope. Raw geometry/images/reports live locally under
`captures/hair-fall-2026-09-08/`; these ignored artifacts do not arrive in a new clone.

| Check | Original | Accepted v2 |
|---|---:|---:|
| Rest face triangle crossing pairs | 855 across 16 cards | 0 |
| 13 natural poses across 12 seconds | 841–872 in every pose | 0 in each pose |
| 17 controlled shake poses across 8 seconds | Not captured with this stimulus | 0 in each pose |
| Peak natural-motion mean tip lag | 11.815 mm | 11.825 mm |

The independent triangle-prism gate tests full triangle intersections, with boundary contact
included at a numeric tolerance of 1e-9 m. It does not certify positive clearance everywhere,
wholly embedded triangles, or every possible pose. Signed GPU-surface samples and actual rendered
views supplement it: the accepted natural sequence's minimum face sample is about 3.00 mm.
There are still 165 head-region crossing pairs / 21 hair triangles outside the face box at rest.

Validation: hair-fall 9 groups pass (original and installed corrected input); surface instrument
12 analytic groups including 1,000 seeded independent-reference pairs pass; HairDynamics quick
mode 24/24 passes. That quick run omits rejection proofs. All 17 pages build. The production build
renders the installed bob on real Chromium/WebGPU, with no page/network errors during a 2-second
probe. The user's existing portrait tab was refreshed and visibly shows the installed groom.
The full gate suite was not rerun; existing red declarations remain.

`HairDynamics.readVertices()` is opt-in debugging readback of actual rebuilt GPU card vertices in
world space. It adds no solver buffers or per-frame work until called. `portrait-clearance.mjs`
replays the same figure and reads its morphed/skinned body alongside those vertices.

## Rejected or superseded experiments

- v1 missed three cards beginning behind the temple and swinging forward; 71 face crossing pairs
  remained. V2 includes those cards and passed the complete test.
- Early baseline-pilot, baseline-surface and baseline-motion recomputed body normals; seam signs
  were misleading. Their signed classifications are superseded by baseline-final, which follows
  the renderer's morph/skin normal path. The triangle-intersection defect was independently valid.
- Raising rendering quality did not materially improve the patchy hair. A neutral rim produced
  an orange face glow. Neither lighting nor quality experiment was accepted.

## Next work and ownership

Root: commit this verified milestone, keep production/live preview working, review visual candidates.
`continuity_audit`: isolated geometry candidate for dangling front strands below the main bob hem;
no changes to installed asset or calibrated tool until review.
`visual_next_step`: diagnose crown/back faceting with a bounded, falsifiable geometry/normal test;
no shipping shader edits. Remaining quality gaps include patchy card surfaces and an uneven hem.

Dev server: port 5197, exec session 26208. Production check: port 5198, exec session 25823,
output `/tmp/sugata-facefall-build`. Check ports before restarting. The dev server remains for the user.
