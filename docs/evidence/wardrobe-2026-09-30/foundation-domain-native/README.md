# Continuous foundation boundary — September 30

## Current result

The isolated band has substantially cleaner exposed outlines than the frozen whole-face prototype. The large upper steps and lower sawteeth are absent in actual front, oblique and rear views. Both sides of the casual neckline remain clear of the grey foundation islands visible with the shipped original. Small repeated dark notches remain along the close-view lower hem; their cause is not established. **Keep experimental; independent numerical and visual review is complete.** Moving fit is unassessed. The full rest-body audit passed on all 15,401 triangles, with no crossings, inside centroids, ambiguous parity rays or negative vertex samples; minimum triangle separation is 0.302902339 mm at band triangle15006/body triangle20664. The 12 analytical controls pass.

Read the [construction contract](PLAN.md), [qualification protocol](QUALIFICATION.md), [source review](SOURCE-REVIEW.md) and [completed jobs](completed-jobs.json). This changes the isolated foundation boundary representation; accepted assets and product defaults are unchanged.

## What changed

Two fixed height planes and a continuous torso-versus-arm weight boundary replace whole-face inclusion at the edge. Homogeneous native polygons remain intact. Only mixed polygons and directly affected neighbours are split, with shared edge points and full group, mask and corner-UV interpolation. Added diagonals deliberately change the support graph seen by the otherwise unchanged offset/relaxation pipeline. No unchanged final interior shape, normal or shading claim is made.

The native patch adds 267 domain vertices. Reconstruction retains all 204 vertex-group definitions and complete rows; source positions, masks and UVs survive exactly, with new data checked against explicit interpolation receipts. The support adjacency inventory records 824 added and 140 removed edges, including subdivided source edges.

## Finite observations

- Final band: 8,209 native / 8,244 exported vertices, 15,401 triangles. One oriented connected annulus, Euler zero, boundary loops of 625 and 392 vertices; no invalid links, degenerate triangles or nonmanifold edges. Smallest triangle area is 4.252628245e-9 square metres; positivity alone is not a broader quality claim.
- Native/export rest positions, custom masks and mapped corner UVs are exact. Maximum corner-normal component residual is 0.00006133318 and is recorded separately.
- All 110 required chest rays and 3,780 supplementary fan samples retain coverage. This sampled set is not continuous coverage proof.
- Actual loader-normalized four-weight positions stay within the unchanged strict 0.342 mm bar against full native in the three declared poses. Maximum band error is 0.123485236 mm; whole-face control maximum is 0.123488117 mm. This is not moving fit or general skinning acceptance.
- Rebuilt whole-face control has exact mapped geometry, weights, masks and UVs relative to its native parent. Its exact-normal gate remains failed, with maximum component difference 1.192092896e-7. Actual visual comparison therefore uses the exact frozen parent GLB.

## Actual images

Compare [shipped neckline](../../../../captures/foundation-domain-visual-2026-09-30-v1/shipped-casual-portrait-0.png) and [new neckline](../../../../captures/foundation-domain-visual-2026-09-30-v1/band-casual-portrait-0.png). Both [left](../../../../captures/foundation-domain-visual-2026-09-30-v1/band-casual-portrait--45.png) and [right](../../../../captures/foundation-domain-visual-2026-09-30-v1/band-casual-portrait-45.png) obliques retain the improvement.

The [frozen whole-face front](../../../../captures/foundation-domain-visual-2026-09-30-v1/whole-face-band-foundation-torso-0.png) and [new front](../../../../captures/foundation-domain-visual-2026-09-30-v1/band-foundation-torso-0.png) show the contour change. Inspect the new [rear](../../../../captures/foundation-domain-visual-2026-09-30-v1/band-foundation-torso-180.png) and [oblique](../../../../captures/foundation-domain-visual-2026-09-30-v1/band-foundation-torso--45.png) for the remaining fine hem marks.

All 30 fixed views completed with clean owner disposal. Root inspected every new-band original and relevant shipped/frozen comparisons. Matching non-foundation scene state and served asset hashes are recorded. The portrait obliques crop parts of the face, and the front body view reaches the foot-frame limit; those images cannot qualify complete face/hair or foot appearance. Static coverage and appearance do not establish motion, all outfits, body range, self-intersection or exact-image reproduction.

## Preserved failures and recovery

V1 stopped on three Blender UV editor selection attributes. The [editor-state clarification](EDITOR-STATE-RECOVERY.md) admits only those exact tuples, records their actual values, and permits selection reset on this isolated reconstruction. V1 omitted those boolean values; they remain unknown. V2 observed all false before reconstruction; texture UV coordinates remain a separately preserved channel. Read the [independent critique](EDITOR-STATE-CRITIQUE.md).

V2 then stopped because assigning a new mesh emptied the vertex-group collection. Intended emission was already preserved. V3 explicitly restores all original group names and indices before adding weights and requires exact readback. Read the [group recovery](GROUP-RECOVERY.md) and [independent reconstruction critique](RECONSTRUCTION-CRITIQUE.md). No geometry or threshold changed in these repairs.

The first sandbox V3 launch exited 139 before Python or output creation. Identical source completed under approved native execution. The sandbox log/crash and runtime mount/detach receipts are retained. The owned read-only Blender image was verified and detached at 22:13:40.520677 UTC; it is not installed into the user's application profile.

## Commands and jobs

- Native versions: `tmp/wardrobe-sep30/blender-isolated.sh --background --python-exit-code 1 --python tools/critic/foundation-domain-native.py > tmp/foundation-domain-native-sep30/native-vN.log 2>&1`. Raw roots preserve each executed source. V1 PID34274/session71566; V2 PID39248/session6943; V3 PID51679/session40428.
- Native V3: 22:12:56.592699–22:13:11.296039 UTC, report `1fe19dbc023d78e4ee0eb73d04fccf823eeb51251f044bb8a83b644a52d24582`, band GLB `3793206f8f7a95a632705b02756bff9c35c5a934f266dc6bd790d076278671cd`.
- Comparator: `node tools/critic/foundation-domain-compare.mjs > tmp/foundation-domain-native-sep30/comparison-v1.log 2>&1`, PID52855/session14590, finished22:13:42.905UTC, report `452c05c2df7927f9173bf948f5aad1fb9ceeb79530fa32f152656e524c0f255e`.
- Visuals: `node tools/critic/foundation-domain-capture.mjs > tmp/foundation-domain-native-sep30/capture-v1.log 2>&1`, PID54801/session9106, 22:14:57.045–22:16:40.588UTC, report `72adba1d6e7179d1137cef80c46551c8c565c8783abaf1bdec18f05aabc2266d`.
- Full rest audit: `node tools/critic/foundation-domain-clearance.mjs > tmp/foundation-domain-native-sep30/clearance-v1.log 2>&1`, PID54650/session44370, 22:14:52.340–22:19:51.924UTC. Completed, report `8bca6b1cf782aeccf83d49724f0b1530dd9b06dcb38e73e88f90b4d4e974a6f6`.

The existing review server remains available. No purchase, subscription/model change, reset credit, push or publication occurred. Latest account check: ordinary use allowed, 45% weekly allowance used, all 62,500 granted credits intact.

## Frozen evidence

All jobs have exited; the probe browser/server closed and the verified native runtime is detached. The [archive manifest](archive-manifest.json) preserves 576 files / 432,725,399 bytes, SHA256 `8971c8d5209f80715e8b3b1d7587046f459677ac7d646c5a73f787851a311f92`. Native failures, intended emission, full source/pose data, exact experimental GLBs, 30 originals, runtime receipts and logs remain read-only under the local ignored capture roots. This is a local archive, not an off-machine backup.

## Independent verdict and next decision

The [numerical critique](COMPARISON-CRITIQUE.md) independently reproduces finite skinning, coverage, topology and the full-rest closest witness. The [visual critique](VISUAL-CRITIQUE.md) inspects all 30 originals and accepts the substantial contour and neckline improvements while preserving the small lower-hem marks as a close-view finish limitation. No geometry retuning follows.

Root selects exact-candidate ordinary motion in the exposed foundation and both outfits next. The alternative is a read-only roll/normal/shadow attribution for the marks; that could inform close-up polish but would delay the larger unqualified deformation/coverage question. Casual draws zero band faces in this static set, so casual-only motion cannot qualify the hidden band. See the separate [motion plan](../foundation-domain-motion/PLAN.md). Moving coverage, continuous collision and general promotion remain open.

Critique SHA256s: numerical `762ccd7f12f5c614786bd98e86c45bf9eb88d30a1e5aa889643d8f4e62489d50`; visual `e595c8a6602b977878bf3eb974fa92dfea9d67b1f8dd436bb6301bf7d2608828`.

Today's review gallery now presents the experimental neckline and exposed-edge comparison. Gallery PID75096/session68392 completed22:28:24.424UTC with13 loaded images, four desktop/mobile captures, no horizontal overflow and no browser/HTTP errors. Root inspected all four original screenshots. Exact gallery report is saved separately under `captures/foundation-domain-gallery-2026-09-30-v1`; no product foundation is switched by the page.
