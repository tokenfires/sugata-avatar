> **Paused by Rob on September 9 at 06:30 PDT.** Read [the current pause checkpoint](PAUSED-2026-09-09.md) before resuming. The overnight automation is paused; pending rendering candidates are not installed. Next priority: cohesive, current testbed pages and accurate feature status.

# Sugata overnight work — September 8–9, 2026

The user explicitly resumed work after the afternoon pass. They confirmed that the chin-length
bob looks more like real hair, reported that the original long bob still collides with the face,
and authorized continuing overnight. They also described future attractive agent configurations
and clothing combinations for human users. Keep MLX as a separate project.

## Window and continuity

- Start: September 8 at about 7:40PM Pacific / September 9 02:40UTC.
- Checkpoint deadline: **September 9, 8AM Pacific / 15:00UTC**. Finish a safe checkpoint and pause
  the heartbeat then. Stop promptly if the user asks to pause.
- Existing heartbeat `advance-sugata-avatar-visual-quality` is ACTIVE, every 15 minutes, in this task.
  Do not create a duplicate. Notify for meaningful results, completion, failure or required input.
- Repository: `/Users/robault/GitHub/sugata-avatar`, branch `codex/local-restart`.
  Always pass this explicit working directory; inherited cwd/writable roots can still name iCloud.
- Starting commit: `75ee881`. Read [restart context](RESTART-2026-09-08.md), the
  [completed afternoon pass](WORK-SESSION-2026-09-08.md), and [original brief](BRIEF.md).
- Never read, hydrate or write the old iCloud checkout. Its recovery archive is partial.
  Missing later material/tool history and rejected experiments remain documented in the prior pass.
- Keep local commits and reproducible evidence; do not push. Generated captures are ignored local
  artifacts, so retain compact tracked findings and hashes for work worth inheriting.

## Priority order

1. Correct bob01's authored facial wrap and any remaining motion intersections. Preserve its long
   shape, part, crown and pleasing movement. Start with the visible g050 figure, then validate
   every supported bake against explicit anatomical calibration. Do not reuse bob02's card mask.
2. Preserve the accepted bob02/g050 asset (`d20d65452ae2761a78a3598f7d7bbbb7541bc047f9d63c6b422948ebd686d461`)
   and its previous 98-pose result. New runtime changes need relevant regression checks.
3. Choose the next substantial visual or wardrobe/identity integration slice based on evidence.
   Actual configuration/clothing showcases are useful; concept pictures do not prove an implemented
   feature. Own routine art decisions and retain ambitious quality targets.
4. Stop rejected controls rather than endlessly retuning them. No repeat of R36/R38, diagonal flips,
   constrained width frames/subdivision, shell compression or panel quadrature without a distinct
   mechanism and prediction. The latter improved numerical integration but not visible patchwork.

## Current work and ownership

Latest checkpoint is the 12:15 UTC section below. **The corrected g050 long bob is shipped** in
local commit `c871ed9`, with production forest contact. GLB SHA
`db3565bb7272dcc82a2892ce042886f23c1a09aed66ea563a9e33cfa7ee1b72b`, calibration
`bob01-g050-long-fall-nape-v2`. Live5197 loads it with zero routes and the correct actual owner.
Other four bob01 bakes and all bob02 bytes are unchanged. No push.

- Root: the long bob, real lookbook and PNG export are committed. The four g050 foundation
  masks are now applied and pass final built-lookbook, PNG and production wardrobe gates.
  Live follower motion/contact/shadow evidence is committed in `0d27454` and remains unshipped.
- `continuity_audit`: investigating the existing foundation-only seam-twin ray failure at
  vertices 4787/4788. CPU skinning attribution is complete; one targeted GPU visibility probe
  is pending. No foundation geometry or skin-weight change is authorized by a ray gap alone.
- `visual_next_step`: completed the mask calibration, portable tool, fixtures and 151-file study
  archive. The earlier outer-cloth fitting candidate remains rejected/unpromoted.
- `orbit_render_audit`: scratch card render history passes 19 CPU and 10 GPU scheduling checks.
  The independent per-pixel oracle is running after correcting readback stride and measuring
  half-float conversion independently. No production velocity/rendering replacement is accepted.

The original long-bob assets are frozen under `captures/long-bob-2026-09-08/originals/`, with their
hashes below. Visible page `/src/portrait.html?hair=bob01`; bob01 has five bakes, bob02 onlyg050.
Capture/calibrated replay tooling covers all bakes atbcd99fb; previous evidence retains its actual
provenance level. Optional wardrobe integration is committed6d36059.

## Live services

Development: port 5197, prior exec session 26208. Production: port 5198, prior session 23873,
output `/tmp/sugata-final-build` (afternoon build, not future overnight edits). Check ports before
starting replacements. Chrome is working after the user's TCC approval. New review tab 80916058.

## Original bob01 asset hashes

- `assets/hair/bob01/g000.glb`: `4c4c42b6f5f55fa1cb74525a19205938a926b512c0d7a0570ea05589183e0ed3`
- `assets/hair/bob01/g025.glb`: `cb9f1f61ca0d48c4cc367a460c6df61c4ecc7a4420c33380c5c4bdb9b61d5c99`
- `assets/hair/bob01/g050.glb`: `98ca6c23b9e0431b36437f386a39b961f1d4e296d58a5cab7cb519044caaea9c`
- `assets/hair/bob01/g075.glb`: `5d3b5f2c5eecfbc86da78f28d69d62024f4aacbeb836be4213bd9f4f7dde64f1`
- `assets/hair/bob01/g100.glb`: `ef1d8101f29cb6e604936e9a897c1779b9439c68d7d562680bee254d22b1a28c`

## First overnight baseline and current hypothesis

- Capture/replay selection and integrity tests: **9/9 and 14/14**, independently rerun.
- `captures/long-bob-2026-09-08/g050-baseline-natural`: original bob01, 13 actual GPU poses
  over 12 seconds, zero capture errors; calibrated replay reports **652–727 face crossing pairs
  in every pose**. Clear corner particles do not certify the broad triangle interiors.
- Full-body signed samples also expose substantial lower-hair penetration during motion; the
  existing face gate does not adjudicate neck/shoulder clearance. Static all-five-bake diagnoses
  are in `/tmp/sugata-bob01-diagnosis/` pending a compact tracked evidence ledger.
- A direct copy of the bob02 vertical fall recipe failed on long card 78 at the shoulder. After
  40mm radial XZ displacement its lower triangle sample remained 17.83mm inside the body; more
  lateral displacement worsened it. The pilot aborted without writing an asset.
- Next pilot preserves the long hem height and introduces a smooth front/back deflection below
  the jaw, testing whole-body signed samples before writing a scratch groom. This is an
  experiment, not a shipped correction. Card 171 needs inclusion despite its rearward anchor:
  its authored lower section wraps forward across the neck without crossing the midline.
- The existing clavicle-root capsule is deliberately limited and does not cover outer shoulders.
  Rig/body diagnosis is underway; do not silently move its endpoints or repeat the historical
  collider-fighting failure documented in HairDynamics.js.

## Rest correction and motion diagnosis — about 03:15UTC

- Scratch experiments and exact hashes are preserved in
  `captures/long-bob-2026-09-08/experiments/`; matched Chrome views are in adjacent
  `outward-v5-views` through `outward-v8-views` directories. **No groom asset is installed yet.**
- v5/v6 remove the inward shortcuts while retaining outward front profiles. Static full-body
  pairs fall from 990 to 67, all remaining on unchanged protected root card 68; all movable
  long-card/body and face crossings are zero. Both change 181 cards, preserve every Y, root,
  cap, fringe, high vertex and half-width vector, and retain exact original fitted collider radii.
- v6 is the current reasonable collision-prototype rest shape, SHA
  `e056abb311f04ccec94ba2da427b4b19fb7709db3a5e274efb81c92a06cec36a`. It still has visually
  awkward isolated rear strips, so it is not a final visual acceptance. Its solver median arc is
  1.893% shorter; individual changed-chain compliance can shift substantially (up to about94%).
- v5's 13-pose natural replay clears the face in the first12 poses, then fails with four pairs on
  previously untouched rear cards169/280 at the lower-face boundary. The completed replay is
  `g050-outward-v5-natural-surface.json`, not a successful motion gate.
- Applying vertical fall across337 curtains (v7) creates a broad flat rear ledge. A60mm posterior
  transition (v8) slopes the ledge but does not remove the bulky shape. Reject these as visible
  improvements; do not solve motion by further static inflation.
- The decisive dynamic defect is **head-carried hair versus body-carried shoulders**. At frame420,
  corrected card423's statically clear tip becomes34.403mm inside the posed shoulder under just
  the rigid head transform; the actual solver is33.231mm inside and only1.523mm from that target.
  At frame720/card424, rigid penetration is45.673mm and actual46.307mm. Width rotation and
  unstable tip sway are not the primary mechanism.
- The current capsule runs between clavicle roots only45.55mm apart. The outer shoulder origins
  are340.03mm apart. It was deliberately constrained after an earlier collider-fighting failure;
  simply changing endpoints without body coverage and solver-order checks is not justified.
- `visual_next_step` is investigating a small set of bone-following collision volumes fitted to
  actual neck/trapezius/shoulder geometry; `continuity_audit` is reviewing solver projection/length
  ordering and completing posed-body measurements. Both are diagnostic work, not installed code.
- Capture instrumentation now includes every real bone matrix, inverse-bind descriptors and live
  capsule endpoints/radius. The v6 natural capture with those fields is
  `g050-outward-v6-rig-natural`; inspect its completion report before using it.
- All-five-bake anatomy mapping is measured in `/tmp/sugata-anatomy-calibration/`. The conservative
  corresponding face patch preserves the exact g050 gate; corresponding neck/shoulder triangle IDs
  can be posed directly. Runtime all-bake capture support is still pending.

## Surface and coupled-contact feasibility — about04:06UTC

- Rejected six bone-following ellipsoids fitted from dominant skin influences: union coverage was
  incomplete, projection overshot up to51.10mm, and it displaced627 already-clear center particles,
  including protected roots. Blended shoulders require more faithful geometry for this construction.
- The measured neck/shoulder patch contains1,069 original body vertices and1,872 triangles across
  all five corresponding bakes. Exact live skinning including morphs, plus BVH refit, matches captured
  Float32 positions/normals/bounds bit-for-bit. It is an open patch with local signed orientation,
  not a global inside/outside field. Boundary vertices require upper mask bits even when a chosen
  incident triangle has no boundary edge; the frozen v2 module validates that topology.
- Independent raw WGSL evidence: `captures/body-surface-gpu-2026-09-09/`.75,888 nearest queries
  agree bit-for-bit between brute force and BVH. Timestamped8,432-center dispatch median0.404ms
  versus0.540ms brute force; exact live CPU skin/refit median0.803ms. These exclude integration,
  uploads and total frame cost. Far near-ties are qualified in its report.
- Actual Three TSL evidence: `captures/body-surface-tsl-2026-09-09/`.75,899 queries across three
  moving-body fixtures, triangle-region/degenerate controls and a boundary-vertex fan pass with
  zero browser/GPU errors. Worst signed error0.000149mm; all boundary flags agree. It fits the
  default eight-storage-binding limit using three packed surface buffers. No TSL timing claim yet.
- Fixed-predecessor endpoint projection is insufficient, even when exact segment lengths and clear
  centers are achieved. Norm-width padding fails a provable reachability bound in most failing
  links; directional support still leaves edge and triangle-interior intersections. Literal33-ring
  subdivision worsens the directional result and also changes transported midpoint geometry.
  The complete negative controls are in `/tmp/sugata-contact-feasibility-final/` pending archive.
- Coupled PBD now lets both adjacent particles move, fixing only the root. The first64-iteration
  width-aware control clears every center and ring vertex in poses0/420/720 with face pairs0.
  Maximum meaningful link error0.193%/1.281%/0.280%, absolute maxima0.0123/0.0671/0.0340mm.
  It still leaves6/29/183 movable neck triangle pairs. These are measured finite-width interiors,
  not hidden root exceptions: worst interpolated-width deficits0.814/2.343/3.373mm.
- The next single control keeps the same schedule and adds quarter/mid/three-quarter segment
  contact samples, distributing each correction to both endpoint centers. It introduces no new
  arbitrary padding; exact full-ribbon triangle gates will adjudicate unsampled residuals.
- Rest v9 avoids unnecessarily releasing clear posterior cards84/402 and six others. It changes173
  cards, preserves original Y/roots/caps/fringe/UV/skin/width, retains exact original fitted colliders,
  and reduces median arc1.246%. Static movable body/face pairs are zero; unchanged root68 retains67.
  Candidate SHA `3e742b5af408527f4002f111c3e6b3f84024399f556afcce4b02b4b92ed3123f`.
  A rear strip remains in the posed view; an actual card-ID render is being used to identify it.
  This candidate is not installed or visually accepted.

## Completed wardrobe integration

Local commit6d36059 adds optional clothed g050 avatars, atomic outfit changes and explicit ownership
of active/cached/pending wardrobe GPU resources. Existing Avatar137/137 and focused wardrobe/agency/
decency groups pass; actual development7/7 and production8/8 GPU integration checks report no errors.
Root independently reviewed the code and reran13 CPU integration groups. See
`docs/WARDROBE-AVATAR-2026-09-09.md` and the hash-bound captures for exact coverage and limitations.
The present garments are stand-ins, and foundation/sock fit artifacts still need geometry work.
Comparative foundation views do not establish geometric penetration merely by hiding a layer.
No final clothing-quality or broader-body fitting claim is made.

## Live prototype handoff —04:25UTC

- All-bake portrait/capture calibration is committed at `bcd99fb`; root reviewed it and independently
  reran12 capture/calibration +19 replay groups. Six actual WebGPU nod poses on g000/g050/g100
  validate selection/provenance, not corrected hair. Historical43-pose replay verdicts are retained.
  New strict gates include the actual posed neck/shoulder subset. The original bob01 layout ranges
  are diagnostic only; every crossing remains in the gate. Scalp caps are not captured ribbon cards.
- Actual card-ID rendering identifies101 as the dominant rear plank, with smaller171/449 tails.
  Rest-only support extrema were insufficient for this attribution. Restoring101's clear original
  prefix through ring11 and a same-Y cubic lower connector removes that upper plank in paired
  rear/side views. Every other card's GPU vertices and the head/camera/clock are bit-identical.
  Candidate `captures/bob01-rear-v9-2026-09-09/connector101/g050.glb`, SHA
  `110dfee561cd4ff627bb157986ff7001b69b75bb6e57a2e54f2b2d104523c876`; static face/movable
  body pairs0, unchanged67 full-body root68 pairs. Smaller tip flare remains. No shipping asset edit.
- Coupled endpoint + quarter/mid/three-quarter segment contacts give0/0/2 movable whole-body
  pairs at v6 natural frames0/420/720, with face pairs0. Remaining720 contact is card175/span14
  at fraction0.149582, between samples: interpolated tube overlap0.0212mm, or0.1212mm including
  the existing numerical clearance. Maximum meaningful link errors0.192%/1.290%/0.282%.
  This is a static feasibility control, not a complete collision certificate or live solver result.
- Reusing the last nearest triangle as an initial distance upper bound preserves the full BVH
  query while reducing triangle evaluations about85–90% on the same/moved fixtures. It is not
  a measured frame-time speedup. The valid nearest answer is still found by full bounded traversal.
- Root is preparing an isolated HairDynamics hook and body/history bridge in ignored captures.
  Shipping physics stays unchanged. Contact stages will sit after each old DFTL substep and before
  ribbon rebuild; their velocity delta correction, stability, cost and full-triangle result require
  actual persistent GPU testing. Four per-substep alpha closures share interpolated body buffers.
- `continuity_audit` now owns scratch `surface-contact.tsl.mjs` and its frozen GPU controls;
  `visual_next_step` owns scratch portable CPU `surface-patch-runtime.mjs`, atomic live updates and
  explicit previous/current history; root owns `surface-query-motion.tsl.mjs`, integration and live
  portrait probe. `orbit_render_audit` is making the g050 rest correction a reproducible portable
  pipeline tool; broader-bake groom correction remains uncalibrated and must not be inferred.

## Whole-span contact and live acceptance — about05:04UTC

- Portable g050 rest correction committed28e5b92. Root independently reviewed the tool and reran
  all11 preservation/reproducibility/path/tamper/rollback groups. The canonical geometry exactly
  matches connector101; shipping GLBs remain unchanged. Other four bakes are now being calibrated
  separately by visual_next_step, with measured body correspondence and no inferred g050 pushes.
- Fixed endpoint+quarter contacts fail actual live full triangles despite every sampled constraint
  being clear. Smoke nod frame6 has9 movable shoulder pairs; natural frame720 has6. Exact witnesses
  fall between samples. The failed inputs, stages and diagnosis are archived under
  `captures/body-surface-2026-09-09/contact-controls/` with62 hash-bound files. Protected-layer
  whole-body contacts remain separate evidence; they are not exempted from a strict pass.
- Adaptive contact queries the actual nearest point of the whole centerline span. Maximum endpoint
  half-width norm conservatively contains the ribbon but introduces0.142–1.058mm extra stand-off
  on the seven diagnosed spans. Coupled chain response can exceed this local amount; visual
  acceptance and whole-frame cost remain required. This is not an exact tapered-radius minimizer.
- GPU adaptive v1 clears all five frozen fixtures' movable neck/face pairs at16/64 iterations and
  clears both live residual fixtures' whole-body movable pairs. The earlier v6 frame420 retains2
  outside-patch pairs on card211/body14358/14363. Its domain remains an open local surface patch.
- Root's actual persistent adaptive-v1 bridge uses connector101,16 outer iterations, exact live
  body skinning, previous/current vertex interpolation and velocity correction (omitted on reset).
  `captures/body-contact-adaptive-live-2026-09-09/smoke-nod-16` passes the strict face/neck gate
  at frames0/6. Twelve-second natural capture completed13 poses with zero browser errors and
  clear face vertices/samples; full-triangle natural replay is running. No performance claim yet.
- The whole-span query passed20 primitive+576 interpolated-patch segment checks, then independent
  review found a real near-parallel Float32 cancellation counterexample missed by that first set.
  Actual v1 GPU error0.00725363mm is preserved. Separate query-v2 uses cross-product interior math
  plus four endpoint candidates and passes original20+576 and all15 added counterexamples with
  the original1-micrometre tolerance. Full-patch chosen-triangle distance excess is zero and
  seeded/unseeded distance agrees. Archive `captures/body-segment-query-2026-09-09/`,30files,
  manifest114e689331ca8f5562ad9584f5d49c5e359fd390a74dfa02573b00ce276c9a56.
- Review also found that a29.8nm coplanar witness residue becomes an invalid tangent contact normal
  under the old1e-20 squared-distance cutoff. Continuity_audit is making a separate v2 stage with
  a Float32-scale authored-normal fallback and actual emitted-plane controls. V1 sources are frozen;
  production HairDynamics/GLBs are still unchanged. Root owns v2 live integration/performance next.
- Root front-view review shows horizontal hair-like stripes across the throat. Orbit_render_audit
  is attributing them without assuming protected card68: authored68 is at side-head/ear height,
  not the throat. The visible stripes and smaller rear tip flare still need art/geometry review.
- The adaptive capture instrument now rechecks every recorded source, both actual assets and its
  own source at completion. The older fixed-quarter capture had rechecked only prototype modules;
  root manually rehashed all13 recorded files plus instrument after those two captures, with no drift.
- No changes to bob02 or MLX. Known four HairMaterial failures remain open; the full suite is not
  claimed green. Current work remains the long-bob geometry/runtime quality loop, with overnight
  heartbeat and morning checkpoint deadline unchanged.

## Core contact integration checkpoint — about06:25UTC

- Rest tool5aa979f adds the measured80/423 lower side-fall to the prior101 connector. Root reran
  all12 groups:175 changed cards/3,666 vertices, unchanged Y/width/skin/UV/topology and other
  geometry, sourceface667→0/movable-body923→0, unchanged full-body67 on side-head card68.
  Portable candidate `captures/bob01-necklace-2026-09-09/portable-g050.glb` SHA
  `db3565bb7272dcc82a2892ce042886f23c1a09aed66ea563a9e33cfa7ee1b72b`.
  The exact source correction is reproducible from the tracked original fixture; motion remains
  a separate gate. The throat-band revision is visually accepted for continued motion testing.
- Contact factoryea3856e adds synchronous owned prepare/nodes/dispose/report to HairDynamics.
  Default math/allocation block remains exact;17CPU+4GPU groups, existing24motion/21disposal
  checks pass. Review found a reentrant ComputeNode getter retirement gap;905eb84 adds the
  final pre-submit liveness check and the18th CPU group, without a shader change.
- HairSurface40a1558 extracts browser-safe CPU patch/skinning/history with canonical Wardrobe
  fullIndex support and transactional pose/bounds/history updates.17CPU groups pass, including
  all5 baked patches and real saved endpoints. See docs/HAIR-SURFACE.md.
- Query-v2 cross-product and stage-v2 Float32-scale normal fixes are retained. V3 whole-span
  root-AABB rejection preserves six fixtures bit-for-bit but reduces actual compute only about6%.
  Actual prototype frame-cost evidence is archived at `captures/body-contact-frame-cost-2026-09-09/`:
  v2-r3 contact compute median24.0693ms / complete wall27.90ms; v3 compute22.698946ms / wall25.80ms.
  Summed render timestamps are not whole-frame duration. Failed/raw-import and unfair fast-loop
  controls are retained; these timings do not describe the new core owner or latest groom.
- Frozen phase profiling identifies nearest queries as about96–97% of the16-pass stage cost.
  V4 ring-major invocation ordering preserves centers/vertices/velocities/planes/parameters/cache
  exactly in all6fixtures at16/64, with about13% isolated-stage savings. Bounds/phase/v4 evidence
  lives in `captures/body-surface-2026-09-09/contact-controls-v3` and `contact-controls-v4`.
- All496 contact improves nape coverage: all12 frozen checkpoints face/selected-neck0, all pinned
  roots exact, original384 chains unchanged. Full-body clearance still fails outside the patch,
  including16 new720 pair identities despite lower totals. Sixteen passes can leave0.538mm/
  10.74% error in one short link after a large pose change;64 reduce maxima below0.571%.
  Full evidence and root feasibility are in `contact-controls-all496`. Larger full/dominant-neck
  domains overcover fixed-root norm tubes and have not been installed. This is an open1872-triangle
  neck/shoulder domain, not a global body SDF or continuous collision detector.
- V5 refreshing queries every2 projections remains mixed/unaccepted: all face/selected-neck gates
  stay0, but outside-patch pair identities change and16-pass large-jump length error rises to0.707mm.
  At64 maximum relative error remains below0.612%. No timing claim or further interval sweep.
  Archive `contact-controls-refresh2`. The next comparison uses common full-query64 resets and
  actual persistent smooth motion before choosing the normal-frame schedule.
- Root new core HairSurfaceQuery/HairSurfaceContact preserve the accepted query/v4 shader math,
  with exception-safe cleanup. HairBodyContact owns one shared surface and4private substep stages,
  exact body skinning/history,16normal/64reset projections, no reset velocity finalizer, and
  explicit regular queryEvery1|2. Current default1. HairBodyContactCalibration hashes actual
  normalized body/groom attributes, canonical indices, bone order and inverse binds. It accepts
  only correctedbob01/figure_g050; unknown/original geometry gets an explicit disabled reason.
  Avatar's new imports/digests each have post-await token/disposal guards. Wardrobe masks cannot
  renumber the body domain. Existing shipping assets remain untouched, so preview behavior does
  not yet switch to this candidate.
- Root13 CPU calibration/owner groups pass, including masked-index refusal/acceptance, altered
  geometry, stage2 construction failure, all35owned storage releases, reentrant body getter
  retirement and delete-failure cleanup. Two additional tests execute actual pending Web Crypto
  digests and prove disposal/new identity cannot allocate or publish a stale solver. Existing
  Avatar137 and capture12 groups pass. Full suite is not claimed green.
- First real core Avatar smoke (`captures/body-contact-core-2026-09-09/smoke-nod`) has2actual
  nod poses, no errors, all recorded source/assets stable, explicit enabled496-chain contact and
  face/neck full-triangle passes. Root inspected the front image: strands now fall beside the
  face and the old lower80/423 throat sweep is removed. This is not full-motion/performance
  acceptance. Paired natural12s and nod4s core captures are underway; optional mid-capture camera
  detours changed head pose and were removed after their first integrity guard rejected the run.
- Independent review also exposed a pre-existing embedding-transform error: Avatar omitted
  attached-mode bindMatrixInverse when feeding HairDynamics, doubling common parent transforms.
  An unused HairSkinTransform helper matches native Three skinning and validates proper unit
  rigid full-head transforms. Integration waits until the current paired source freeze ends;
  scale/shear must not silently invalidate the contact radius/rest-length assumptions.
- Other bakes: all4 first rest candidates achieve authored face/movable0 but combined rear styles
  are rejected after40 matched views. g025131 local connector removes its isolated45-degree flap
  but adds4posed shoulder pairs, so is not shipped. Exact80/423 side-fall affects onlyg025/g075;
  g000/g100 are measured no-ops. Remaining visible bands were actually attributed to other cards,
  and a bounded local correction is underway. See bob01-all-bake-fall, bob01-g025-rear and
  bob01-sidefall archives; do not reuse a card mask as if it encoded one visual defect on allbakes.
- Correction to the earlier numeric provenance sentence: all recorded files were rehashed, but
  the exact count was not13. Use each archive's explicit source map rather than that old count.
  No bob02 asset or MLX changes. Four known HairMaterial failures remain open.

## Sustained schedule and transform findings — about06:40UTC

- Core integration checkpoint53a8ccc preserves the new owner/calibration/Avatar path; no shipping
  groom changed. Query/stage primitive tests281dc94 pass12 groups including35segment fixtures,
  144generated BVH/pose/seed queries,8normal cases,12bounds cases, stale-cache clearing,
  renderer resource return and both historical countercontrols. Max errors0.00006638mm primitive/
  0.00010726mm BVH; zero browser errors. See docs/evidence/hair-surface-primitives-2026-09-09.json.
- Paired actual core captures share exact64-pass full-query resets and exact body/head/rig/camera
  poses. Both natural arms clear face/selected-neck in13poses, but queryEvery2 changes hidden nape
  trajectories by55.83mm and produces different outside-patch intersections. Strong nod gives
 2.18250mm/43.519% link error versus0.33385mm/6.657% for full queries. The cheaper schedule is
  unaccepted and removed from the production owner; no timing benchmark was used to excuse it.
  Full-query motion still has outside-patch crossings and up to6.43% warm short-link error, so
  it is not a global-clearance certificate either. Exact paired sources/fixtures are retained
  under `captures/body-contact-core-2026-09-09/paired-query-refresh-evidence`.
- HairSkinTransform helper ef42374 is now integrated: exact M×bindInverse×boneWorld×inverseBind×bind
  rather than dropping the inverse bind. Proper unit-rigid full-H checks protect radius/length
  assumptions at selection, construction and preparation. Five helperCPU +15calibration/owner
  +2actual-pending-digest retirement +Avatar137 groups pass. Default identity-bind operands retain
  their exact grouping. Actual GPU embedding/lifetime and bob02 regressions are queued next.
- Next distinct performance hypothesis is one16-full-query contact stage after the final DFTL
  substep of each rendered frame, with velocity delta divided by the actual contacted interval.
  DFTL remains120Hz and common reset remains64full-query passes. This may avoid the live rAF
  cost feedback where slower frames earn more expensive contact substeps; it is a planned bounded
  experiment, not a new shipping schedule or accepted performance claim.

## Correctness, real frame cost and remaining geometry — about07:15UTC

- Actual Avatar regression is committedf32a20e: eight GPU groups pass, canonical g050 nod0/.1
  centers/ribbons/body/head inputs remain bit-identical, all496 transformed root centers and
  width lengths agree with native skinning within0.000167mm. Unsupported scale refuses before
  submission/history advance and resumes when restored. Same-renderer contact/bob02/off/identity
  switching returns35/8/0 storage attributes correctly; deferred digest disposal cannot publish.
  Existing bob02 quick24 and disposal21 pass. No new implementation defect was found.
- Once-per-rendered-frame contact is rejected too: natural short-link error0.347→0.960mm;
  nod0.334→1.415mm (6.66→28.22%). All44 retained arm poses clear face/selected-neck, but new
  outside-patch contacts appear. Eight CPU schedule groups and actual1/2/4-step reset parity
  pass. No timing or additional FPS sweep was used to excuse the motion regression. Archive
  `captures/body-contact-core-2026-09-09/frame-cadence-evidence`:43 local+104 sibling files,
  manifest66443624…. Production schedule remains contact after each120Hz substep.
- A different, behavior-preserving optimization guards each expensive exact triangle query with
  that triangle's interpolated AABB. Scratch SHAe3b680d… preserves strict ties, seeds, BVH and
  visited telemetry. Independent GPU review retains every field in the existing core tests and
  every Float32 bit across732 added point/segment queries; CPU3072 finite bounds cases pass.
  All six all496 body controls at16/64 preserve centers, vertices, velocities, planes, parameters
  and cache exactly. The8epsilon cushion is empirically checked, not a universal arithmetic proof.
- Frozen384-chain whole-stage GPU medians9.456→8.312ms and9.542→8.270ms. The actual496-chain core
  Avatar portrait over720 fixed60 natural frames improves compute median18.239→14.836ms and
  update-to-GPU wall median21.1→18.0ms,p9522.7→21.4ms. Same716×750 canvas and corrected groom,
  exactly two DFTL steps per frame. No-contact control wall median5.5ms. The60FPS target remains
  unmet; these serialized timings exclude compositor/rAF/timestamp-read overhead and do not
  certify interactive refresh rate. Summed render timestamps overlap and are not whole-frame time.
  Query promotion awaits portable adversarial tests; no shipping groom changed.
- Performance proof is archived as60 files/86,736,967 bytes under
  `captures/body-contact-query-performance-2026-09-09`, manifest2b61e3bd…. Tracked ledgers:
  `docs/evidence/hair-body-contact-performance-2026-09-09.json` and
  `docs/evidence/hair-triangle-bounds-review-2026-09-09.json`. One shared/tmp script-name collision
  caused a redundant primitive run; it was not counted as six-fixture proof. Root's uniquely named
  six-fixture harness produced the actual12 full-contact parity rows. Use per-agent scratch names.
- Visual's g075458 correction removes the last observed thin throat strand; both actual opaque
  witness pixels clear and matched rear outline stays stable. No new posed0 pairs; all60 remaining
  curtain pairs lie on nine other cards. g025 necklace similarly clears, but its separate131 rear
  connector needs contact composition. g000/g100 combined styles remain rejected. Three visual
  archives preserve130 files and per-bake status; all are scratch, not a shipped all-bake fix.
- Full-query g050 face/selected-neck clearance is not whole-body clearance. CPU residual diagnosis
  identifies upper-neck/nape curtains188/193/198/201/202/211/217/223/272. Some natural contacts
  involve opaque fragments and millimetres of penetration; front views hide them. Alpha/occlusion
  classification is still underway. Do not broaden the patch into infeasible fixed roots or declare
  these contacts harmless from the front image alone. Four known HairMaterial failures remain.

## Query optimization promoted — about07:30UTC

- Core HairSurfaceQuery now uses the accepted triangle-AABB guard, SHA
  `f19425b8208dcb15d22a8e1c5b348d008d478ba9eb31b00e48426850ab9770c1`.
  This differs from measured scratche3b680d only by trimming two whitespace-only lines.
  Portable predecessor-vs-core tests66d40ee pass eight CPU/GPU groups, including3072 finite
  bounds cases and every Float32 bit across732 additional queries. Missing/partial guards fail
  explicitly. The additional fixture contains18 records with17 unique named families; one
  zero-origin ULP control is repeated. Historical evidence has an appended clarification.
- LeafSize1 traversal was stopped at CPU accounting: about79.44% more node visits for only25/24
  fewer exact triangle evaluations. No GPU sweep. A single Morton centroid chain ordering had
  promising CPU scheduling estimates and exact six-fixture physical/canonical-record parity,
  but actual all496 whole-stage GPU medians increased7.891→8.314ms and8.034→8.449ms. It is
  rejected; existing chain order stays. No whole-portrait benchmark was run for that variant.
  Archive `captures/body-contact-morton-order-2026-09-09`, manifest49009821c95d644889ee993efbe3f178ef047b9bde2b6b7a0373369b85a4b061.
- Next bounded performance opportunity probe measures exact repeated query inputs between
  outer passes on two frozen fixtures. It does not yet add a cache or relax query frequency.
  Body-contact source and schedule remain frozen; orbit owns that isolated GPU probe.
- g025 original-to-composed rest replay now reproduces its full GLB exactly (SHA556f67a7…):
  authored face0/movable curtain0, unchanged251 root-layer pairs; adding131 changes only that
  card's arc by+22.781mm (+8.286%) and compliance by−7.652%. Portable tests/commit are being
  finished; live composed appearance/contact are not accepted yet.
- Root's remaining upper-neck diagnosis is real: natural420 inner-nape card201 tip is18.42mm
  inside actual neck (12.37mm even versus rigid-head body); natural720 card188 tip is9.91mm
  inside actual neck but3.03mm outside a rigid-head body. Both hair deflection and neck skin
  blending contribute. Some spans lie wholly inside, so triangle-crossing counts alone miss them.
  Continuity is assessing a bounded rest-support correction and outer-hair enclosure before any
  additional domain or solver changes. Shipping g050/bob01 still remains original.

## Exact input reuse promoted — about07:55UTC

- Frozen scratch contact93d538d passes six all496 input fixtures at16/64, eleven GPU invalidation
  cases (new snapshot/body/alpha, second write range, one ULP, signed zero and point-vs-span inputs)
  and nine actual Avatar transform/lifetime groups. Default-off parity is retained. Snapshot
  invalidation and fixed surface/alpha within each batch are required; there is no cross-frame
  reuse and no reduced solve/query schedule. Reused queries report zero actual traversal work
  plus an explicit reuse flag.35 buffers remain; four metadata buffers add2,031,616 bytes.
- Frozen whole-contact GPU medians improve8.098→4.794ms and8.021→4.575ms. Query-only repeated
  identical-input timing is deliberately excluded from whole-frame claims. Archive
  `captures/query-input-cache-2026-09-09`,63 entries, manifest3523b8b6f4da7c844e4d34f73204b6127aff70acf25a361083e16c387a291170.
- Actual Avatar portrait,32 warm+720 fixed60 frames,716×750 canvas, two substeps/frame:
  final positions, velocities, rebuilt vertices, head matrix and steps are exactly equal.
  Update-to-GPU wall median18.2→14.3ms,p9521.4→15.7; compute median14.876898→11.665822ms,
  p9518.529468→12.896095. Zero browser errors and exact body/groom response hashes. This is
  serialized timing excluding timestamp readback/rAF/compositor waits, not a general60FPS claim.
  Archive `captures/body-contact-input-cache-frame-cost-2026-09-09`,24 entries,
  manifest004b4f93962e501d5cc5687c734fc1cacff55193289649bebf86d3270bc86fbc.
- Promoted stage6fca962eeea50e1b93a678a150a0ee3c895fea20af7536a85bd506404dc97185 differs
  from scratch only in its first comment. Ownerfd0b528418dd11ef376b51922d47aadd7d3a2be6bbc684480628a8749dac73ce
  opts in with the validated snapshot ordering and reports a copied layout. CPU calibration/owner
  and Avatar gates are rerun; portable cache and actual promoted regression are underway.
- g025 portable compositione18dca3 reproduces full SHA556f67a7…. Separate exact calibration and
  prospective registry patch pass8 identity and16 CPU owner/integration groups. All496 roots/
  first spans clear its1872-triangle patch in authored and one actual posed0 configuration.
  Proposal remains unapplied pending cache source freeze. No composed motion/appearance acceptance.
- g050 nape support pilot changes only188/211/202, but fails posed enclosure on211. The same
  opaque texel requires at least5.969331mm outward at natural420 and at most5.449375mm at nod60.
  This disproves that fixed measured-direction support family, not every possible rest design.
  No second arbitrary tuning candidate. Next CPU check evaluates a calibrated upper-neck superset
  for the nine inner-nape curtains while keeping all original neck/shoulder coverage. Shipping
  bob01 and protected bob02 remain unchanged; four known HairMaterial failures remain.

## Nape partition proof and measured cost — about08:30UTC

- Cache integration66b6388 is followed by portable regression625323c:8 stage groups and8 actual
  Avatar groups pass on promoted stage6fca962e/ownerfd0b5284. Self-contained gzip fixture
  preserves Float64 authored offsets before CPU radius calculation; no regenerating goldens
  from the implementation under test. Archive `query-input-cache-portable-2026-09-09`,
  manifest7989e3bc142012a4646a662e9b17a92b2facb5a471257057ff6bc67d7bbeeb55.
- g025 registry32afd36 preserves g050 export identity and cache behavior; CPU16 calibration/owner,
  Avatar137 and4 actual-digest retirement cases pass. Actual g025 smoke has2 complete geometry/
  velocity states and8 orientation views, enabled cache/contact, zero errors and exact source
  freeze. At0.1s card44 spans14–15 have5 conservative face-crossing pairs, caused by transported
  width rotation, while centerlines remain14.7–15.6mm clear. All crossing UV rectangles plus halo
  are alpha0 at mip0. The preliminary display-pixel LOD4.30–4.77 estimate is superseded by the
  actual scene-resolution LOD4.89–5.37 qualification below. Keep geometric red and opacity
  classification separate; no new groom adjustment is justified yet. Focused record010d6e9.
- Original fixed-direction nape rest support is infeasible for one211 opaque witness across
  natural420/nod60. Instead, nine curtains188/193/198/201/202/211/217/223/272 can query the
  original1872 triangles plus204 positive dominant-neck additions. Across22 actual saved poses:
 198 roots min+5.706052mm;198 COMPLETE first spans min+3.671646mm; all74 opaque negative
  witnesses retain their true nearest triangle and all15 associated spans activate. No old
  coverage removed. Domain archive manifest2d4688e9e7686efcf574c043b9438e77f0ac41cb7824190cebd64b3b0e4dd2b2.
- Root's isolated owner uses complete sequential group batches so global snapshot/finalize does
  not double velocity correction.16 adapted CPU groups pass both default fallback and two-domain
  owner; orbit4 additional groups prove exact partition/order and second-skin failure retirement
  of62 owned targets with0 submissions. Review archive manifest0442a42d36609f10479cd700ab9d2a4c8dc4e094bf98473974a2b033937e59df.
- Actual three-arm720-frame comparison: partitioning onto two identical original domains keeps
  ALL496 centers/velocities/vertices exact. Expanding only nine preserves other487 and allroots,
  with finite arrays and no browser errors. Wall median/p95:single14.2/15.7ms, partition18.5/21,
  nape22.1/23.3. Compute medians11.5568/14.1923/18.3438ms. The current two-stage-per-step
  architecture fails the16.7ms target and is not promoted. Archive44 files under
  `captures/body-contact-two-domain-frame-cost-2026-09-09`, manifest3f6efd8e5af9df1e6e2959ff69c07df841382911756a2f9585543d97bd145699.
- Candidate owner `captures/body-surface-2026-09-09/HairBodyContact-two-domain.mjs` b1387c41…;
  nape calibration dataea4cce1a…, partition-control data4b9b0e41…. Real geometry validation stays
  active through data/owner response substitution. Core owner/calibration and allshipping GLBs
  remain unchanged by this experiment.3948triangles/2270vertices are summed storage, not union.
- Root copied visual's complete capture harness to `/tmp/sugata-root-nape-capture`. It supports
  explicit single/partition/nape modes, exact candidate hashes, full calibration-domain arrays,
  complete17516 hair vertices (GPU cards + renderer-equivalent CPU skinned caps), velocities,
  body positions/normals/canonical indices and served source snapshots. Each orientation draw
  now has its own GPU+double-rAF barrier. This corrects an earlier same-epoch screenshot
  limitation; original g025 smoke images/harness remain preserved, not overwritten. Root's
  g0500/.1s smoke passes2 states/8views with exact camera/simulation restoration andzeroerrors.
- Four full captures are running sequentially:baseline-natural12s, nape-natural12s, baseline-nod4s,
  nape-nod4s.13+13+9+9 samples, twelve orientation images each; exact geometry analysis follows.
  Baseline-natural already retains face0 at all13 saved poses, max link error.346813mm.
- Forest CPU packing retains each independent BVH's root/ranges/ordered IDs and boundary masks;
 54 shared triangles have DIFFERENT boundary flags, so recomputing one union mask is invalid.
 6 CPU groups pass6048 exact query comparisons and5400 root-tube decisions. Proposed shared
  arrays317280B include496 range headers; projected total35 solver buffers/7177952B, not yet
  observedGPU. Archive `body-surface-forest-cpu-2026-09-09`, manifest200b12a73beea867f7058ad13b522d6f55b5754279c236ba53c1dbc7ec2bfc3e.
  Isolated shader/stage/owner implementation proceeds CPU-only while motion evidence is reviewed.

## Full g050 motion proof and forest correctness in progress — about08:50UTC

- The complete four-arm capture has44 states/48 orientation views, zero errors, frozen sources
  and exact draw-only camera/physics restoration. Each state includes full17516 hair vertices,
  velocities, body/UV/topology and rig data. Sparse face samples/vertices are clear in all arms;
  maximum link errors remain exactly.346813mm natural and.333849mm nod in both controls.
  Archive `bob01-g050-nape-motion-2026-09-09`,431 entries, manifest
  fd7e218ce969f0837a9ea159dd601a43251053f7354b32f7c5c297b33cd9b30d.
- Independent full-triangle replay of22 widened poses finds face0, original-domain0 and nine-chain
  nape-superset0; natural curtain pairs0. All487 unchanged cards retain bit-exact centers, velocities
  and vertices; all non-card cap positions are also bit-exact. No new ribbon pair identities;
 136 old pair instances removed. All74 old negative opaque witnesses are now clear (+8.493 to
  +18.447mm); previous211 negative family now at least+9.610mm. Root, width, cut and full-first-span
  checks pass, global link-error maximum unchanged. Finished22-pose exhaustive opacity proof:
 20,354,620 evaluations clear, minimum+1.078904mm; acceptance archive manifest
 4c268e815510ef45359e9ce958012c3f0fc7574b84ee0df463d1ecdae94ec8db.
- Nod keeps5 outside-domain upper-root pair identities on217/272 in six poses; mip0 AABBs+halo
  are transparent, but272 higher-mip bounds contain nonzero alpha. Nod also retains20–30 cap
  pairs. These are preserved baseline limitations; this is not a whole-body zero-collision claim.
  Matched rear images show no obvious new broad ledge/silhouette change, but layered diagonal
  cards and uneven inner ends remain visible. No finished rear-style or AAA claim.
- Forest source review finds no issue: separate trees keep independent boundary masks/history;
  source IDs remain canonical while ordered IDs relocate globally. Chain headers share topology
  storage so query dispatch remains within8 bindings. Candidate files under body-surface-2026-09-09:
  query3f84ea4a…, contactc29e6859…, owner16f4ae6c…, packercd70967f…. Six CPU packing groups,
 19 owner/lifecycle groups and3 source-reversal groups pass. Direct GPU correctness is now running;
  actual Avatar cost/parity instrumentation is prepared but not launched. Do not promote yet.
- g025 actual loaded alpha GPU texture:72 explicit-LOD queries, rgba8unorm-srgb/11mips/repeat/
  linear/anisotropy1 verified; max CPU-vs-GPU alpha difference.002216. Four front clipped witnesses
  have2.67–18.38% alpha at inferred scene-resolution LOD4.89–5.37. None is opaque at.5, but actual
  raster derivatives/final stochastic compositing remain unverified; do not claim invisibility.
  Archive `bob01-g025-alpha-footprint-2026-09-09`,14 entries; findings994c7760….
- The new g02547-pose diagnostic capture has zero errors/frozen sources and36 restored orientation
  views. An early progress summary overgeneralized a zero-count log tail; the SAVED instruments
  consistently record nonzero face counts. Complete per-arm maxima (natural/nod+/nod−):
  face7/7/13, original-neck0/0/4, caps0/26/80, curtains21/14/47. Natural has face pairs at4/5/6/7s
  of5/5/7/5; moving curtain union212/224/422. Earlier natural all-clear claims are superseded.
  A few velocities peak at2.188m/s at12s(card31/ring9), median.046m/s,p99.127m/s. No acceptance.

## Forest performance passes; remaining directions underway — about09:00UTC

- Independent forest GPU proof:43,200 exact point/whole-span comparisons across moving surfaces,
  alpha0/.5/1 and cold/warm/cross-domain seeds;20 physical cases(two all496 fixtures×16regular/
 64reset×five arms) exact. Stock single-domain matches independent/forest identical-domain
  partitions; widened independent/forest matches centers, velocities, rebuilt vertices, planes,
  parameters, normalized cache IDs/counters and reuse flags. Actual8storage query bindings;
  every arm returns owned buffers/pipelines to baseline. Zero errors, frozen source hashes.
  Archive `body-surface-forest-gpu-2026-09-09`,25 entries, manifest
 6a2a3ca66dbd454057dfb74b0178e9dd2a23c752e411b23d225426741aeef21d.
- Root's actual720-frame same-nape comparison now passes ALL496 final positions/velocities/
  rebuilt vertices, head and steps exactly. Wall median22.0→15.1ms,p9523.3→16.7; compute median
 18.252638→11.344910ms,p9519.583368→12.580433. Same716x750 canvas and32 warm+720 fixed60
  frames, two substeps. Timings exclude timestamp/rAF/compositor waits, not a general60FPS claim.
  After saving final state AND screenshot, an untimed four-substep update allocates all slots:
  independent62buffers/7,709,664B/37compute pipelines; forest35/7,177,952B/21. Both disposeHair
  calls return buffers/bytes/compute pipelines to0. Archive37 entries,
  `body-contact-forest-frame-cost-2026-09-09`, manifest
  f160b23624aa6c6ea0446594aaecc3a3717c48569ffff5e641b52b8bfc63e063.
- Five broader g050 captures now run under the frozen forest candidate: nod−,yaw±,tilt±,8s each,
 17 samples and12 orientation images perarm. They preserve exact raw dependency source bytes/
  hashes and actual transformed owner/data responses. The response hook does not snapshot
  transformed forest query/stage/pack dependency bytes; that is an explicit provenance limit.
  A separate qualifying0/.1s smoke with an extended response hook is prepared, without mutating
  the live capture. Do not relabel current captures as having that additional served-byte proof.
- First nod− arm completes17states, zero errors/source drift, sparse face inside0. Max link error
  .927860mm is larger than prior natural/nod+; new mode has no matched old-domain baseline yet,
  so root has requested worst-chain/fixed-root analysis before attributing a regression.
- Intended integration keeps the existing single-domain query/owner for g025/default paths;
  only an exact validated calibration with explicit multiple contactDomains selects the forest.
  No production edits or shipping assets yet; portable regression is being prepared in scratch.
- g025 nod− four neck residuals are span0 of cards281/383/396, with exact closest segment t=0
  at fixed roots. Norm-tube deficits1.079/1.928/5.984mm; firstspan max-radius deficits2.497/
 1.928/5.984mm. Both root corners100%head; no neck-weight wiring mismatch. Root mass0 and
  beta0 leave no free endpoint to project, so more iterations cannot resolve these contacts.
  Crossing UV boxes+halo are transparent at mip0; higher-mip/opaque and velocity attribution
  remain separate work. Activation here is exact saved-state reevaluation, not GPU telemetry.

## Corrected g050 shipped and live verified — about09:30UTC

- Reviewed production copies preserve forest query/projection/cache math, with import/name/comment
  changes only. The primary owner delegates ONLY explicit validated multiple domains to the new
  forest owner; removing that branch/import exactly reproduces the old single-domain owner.
  g025 and legacy controls retain their old path. Data changes only add the measured487/9 domain
  map and version the g050 calibration. Frozen proposal manifest records six core/data hashes.
- Core CPU gates pass16 calibration/owner,137 Avatar and4 asynchronous digest retirement groups.
  Portable promotedGPU gate passes9groups including43,200direct queries and20 historical physical
  cases. Legacy Avatar passes8groups with immutable v1 data/golden; new productionforest Avatar
  passes8groups against independently captured two-domain canonical states INCLUDING velocities.
  At0/.1s the new nape hair differs from old single-domain hair; old body/head/time remains exact.
  No self-generated candidate golden replaces the historical contract. Test-onlycommit7068a0e.
- Actual forest transform/lifetime scratch probe passes10groups: four native-root/width transforms,
  scale refusal/resume, same-renderer35/7,177,952→bob028/980,096→off0, identities and pending-digest
  disposal. All owned buffers/bytes/compute pipelines return to0. Archive25entries,
  `body-surface-forest-avatar-2026-09-09`, manifest7cb755e22da3b866a515169f5b8a6c1d5ee616ba9403b21e8a8944ec6b3eb698.
- Additional85actual poses across nod−/yaw±/tilt±: exactface0, nine-card wholebody0, expanded-domain0,
  feasible selectedroots/completefirstspans; tightest first-span margin+2.429528mm on217,nod−60.
  Other curtains/caps/root layers still fail strict whole-body gates. Worst linksoutside nine:
  nod−395/span1 .927860mm,tilt+214/span1 1.370024mm,tilt−31/span1 1.124225mm. Selected-nine
  tilt errors stay.016303/.017352mm; nod−272 reaches.190363mm. Do not hide those different scopes.
- Matched original-domain nod−17poses proves ALL487 other centers/velocities/vertices and fullcaps
  bit-exact; outside-nine link metrics exactly equal. Forest removes392ribbon-pair instances and
  adds0. Thus that nod− outside-group deformation is inherited from the prior domain control.
  No matched tilt baseline claim. The separate0/.1source-qualified smoke snapshots allthree actual
  transformed forest dependency responses, with0errors and exact camera/simulation restoration.
- Combined motion archive has104states/80views/799entries (85new+17baseline+2smoke):
  `bob01-g050-forest-motion-2026-09-09`, manifestc307fee871278e419f4825531379635186b72fb652fce2602bac88bdc1aada68.
  Earlier85states retain raw-source+owner/data-response provenance; do not retroactively relabel
  them with the later smoke’s additional dependency response evidence. Exhaustive85-pose opacity
  is still running; first14prioritized states pass, including nod−360(+3.119mm) andtilt+450(+2.541mm).
- The exact portableg050 GLB is copied toassets/hair/bob01/g050.glb. Otherbob01/bob02 hashes checked
  unchanged. Real5197portrait loads newg050 with ZERO routes, reports newv2calibration/3surface
  buffers/4stages/487+9domains, advances120frames, and restores fullsimulation/camera across4views.
  Zero browsererrors. Livearchive `bob01-g050-shipped-2026-09-09`, manifest
  aa9987e2031f32c9d7ad1388c738df2ba6fa46ac6d080358a63736b5adcc9d36. Promotionarchive manifest
 425a17d697ac526c9d0b82bb9c779baaabb547cf69bd5a9b100b568b1793de2d. Tracked ledger
  `docs/evidence/bob01-g050-shipped-2026-09-09.json`. The app browser-open request is queued for
  this task; the live URL was independently verified, not proof the user’s existing tab refreshed.
- `npm run build:pages -- --outDir /tmp/sugata-forest-shipped-pages` compiles all17entries successfully,
  including the actual portrait/Avatar/contact chunks; existinglarge-chunk warning only. Plain
  `npm run build` covers onlyindex and is insufficient by itself. KnownHairMaterial failures persist.
- Rear appearance is visibly unfinished. Source review identified separate per-layer lock guides
  sampled by normalized ring index despite different lengths. One new bounded shared-height spine
  candidate targets60posterior surface/veil cards and preserves radialdepth, Y/cut, roots/firstspan,
  caps/fringe/flyaways/innernine. It tests guide organization, not rejectedframe/lighting/compression
  variants. Maxmovement15mm, max targetedarc change3.34%; globalmedian/compliance change must be
  measured. It remains unshipped; reject if patchwork relocates, coverage thins or a ledge appears.
- g025complete47-pose motion/opacity/velocity evidence committed936ed16; unshipped and fails.
  Archive391files `bob01-g025-avatar-motion-2026-09-09`, findings352d6c5e…. Root span281/383/396
  original-domain crossing footprints are transparent throughmip2, lowalpha at3, but EXCLUDED
  upperbody intersections on281/396 andnatural212 have realopaque witnesses acrossmips. Largest
  nod−velocity4.427m/s occurs on8/ring15, alreadyclear andmovingoutward; no false causal attribution.
- Showcase remains a separate presentation slice using realimplementedg050 outfits. No public
  skin/iris/hair-colour/sculpt API is invented, and no other-bake clothingfit is claimed. Current
  source identity axis is0feminine→1masculine; Avatar JSDoc’s reversedlabel is being corrected.


## 10:15UTC — showcase, rejected rear alignment, and distinct render preview

The collision correction is committed as`c871ed9`. The optional shared-height outer rear-lock
candidate is rejected: root and independent visual reviews see diagonal patches relocate without
an acceptance-worthy improvement. The changed global median compliance input was small
(−0.010495%) but protected geometry did not retain exact motion: settled root-layer pairs134→170
(59added/23removed), while face/curtain/nape pairs stayed0 at its two saved poses. This does not
prove those root contacts are visible or attribute every dynamic difference to one mechanism.
Archive203files/80.1MB:`captures/hair-shared-lock-2026-09-09`, manifest
`d7e0bbdb27f5d99f5ba6221eea0622810e5d82622a181466e4e49d033238aacb`;
[tracked findings](evidence/hair-shared-lock-2026-09-09.json). No production groom/data change.

A separate root prototype at`/tmp/sugata-root-follower-pilot` draws11904camera-facing bundles from
24across-width samples of each actual4s solved card. Width1.2mm,380928triangles,404736vertices;
all1128cap triangles retained. Original atlas alpha/depth/root and lock IDs are sampled at the
corresponding original UV; geometric tangent replaces card-derivative shading. All four fixed
views have32draws, GPU/paint barriers and exact physical/camera restoration; zero browser errors,
zero production-source routes. This is an explicitly fixed-pose render-only preview. It softens
broad rear/side planes but thins the fringe, retains a planar cap join and isolated low ends.
The24×1.2mm triangular profiles integrate14.4mm per unprojected card width before overlaps;
median posed card width is26.502mm, widest58.736mm. A single adaptive-density control is prepared
at`/tmp/sugata-root-follower-density`, plus a clearly separate cap-off front diagnostic. Neither
variant is shipped, and the control is not yet rendered at this checkpoint. No live follower,
new-clearance, cost or AAA claim follows from the stills.

The new wardrobe study uses actual`Avatar.create`/`dress` on g050: casual+bob02 and elegant+bob01,
with bra/brief foundations, editable clothes/framing/lighting, orbit/pause and actual attached
configuration export. No recoloring or unsupported body fitting is promised. Browser testing
corrected the post-attachment error path: a render failure after successful dress no longer says
the previous clothes were retained. Real foundation comparisons preserve known neckline/skirt/
sock protrusions. The source is uncommitted while the resize qualification finishes.

The apparent resize failure needs a precise scope. History clearing and temporal reconstruction
were tried separately and rejected/reverted. An unchanged page settles by80post-resize frames;
48still has residual streaking. Raw-G-buffer bypass followed by restored beauty had given extra
settling frames, so it does not establish cache repair. A trace independently shows the first
resized TAAU hook reading stale594×572scene dimensions after the canvas becomes343×625, forcing
camera aspect1.03846instead of0.5488. Scene pre-sizing alone does not eliminate the transient
streak. The authorized minimal Stage repair is to correct that first-frame ordering; validate
with exact dimensions/aspect and equal80-frame captures. Reconstruction also exposes a separate
matrix-identity hazard: compiled VelocityNode uniforms retain the old TAAU projection object.
Do not ship either rejected reset or claim a generic temporal fix.

A CPU wardrobe audit proves copied skin masks do not account for foundation thickness. Runtime
mask counts match the assets: elegant retains5990bra and1025brief triangles; the corresponding
foundations intersect cloth in588/185triangle pairs. At measured chest/hip examples, skin is inside
cloth while its2.4–2.7mm foundation offset is outside. Zero-mask cases rule out solving this by
changing the0.5mask threshold. Shoes01contains two252-triangle sock components without under-masks;
FOOTWEAR600would not let BASE300occlude them under the current layer rule anyway. Measured calf
protrusion reaches4.401mm while skin stays inside trousers. One bounded outer-garment fit control
is underway; no garment, mask or layer is removed to conceal the problem.

## Complete motion proof and showcase; finer rendering remains experimental — 10:50UTC

- The additional85-pose proof is complete:78,642,850 opacity-sample evaluations on the corrected
  nine-card nape group, zero negatives, minimum+2.428235mm. Original22-pose proof remains complete:
  20,354,620 evaluations, minimum+1.078904mm. Full limits and broader root/cap/curtain contacts are
  retained in [nape acceptance](HAIR-NAPE-ACCEPTANCE.md); this does not certify all-body clearance.
- The real g050 lookbook is shipped locally in `7ea6ea6`: two actual outfits/hair presets,
  camera/framing/light controls, truthful configuration export and fit-study labeling.
  The shared Stage fix sizes its existing scene pass before the first resized temporal jitter.
  Four CPU and six actual GPU groups pass. Temporal object identity stays stable; transient
  resize settling is not claimed cured. The earlier automatic review rejection was resolved:
  root supplied the exact patch, proof and user's broader overnight authorization; retry approved.
- PNG export is shipped in `20569f5`:13 actual browser groups verify same-task pixels, real outfit
  changes, body/portrait/side framing, exact camera/physical/clock preservation, motion restoration,
  failure handling and URL cleanup. JSON is explicitly labeled settings. Final18-page build passes.
  See [showcase](SHOWCASE-2026-09-09.md) and its image evidence. No core change in PNG commit.
- One fixed outer-cloth fitting experiment clears obvious front chest/hip/calf patches in24 actual
  images at rest and4s. It creates more collar-leaf self-intersections and leaves rear-cuff contacts,
  so it remains unpromoted. All foundations/masks/UV/weights/topology/openings remain unchanged.
  [Wardrobe fit evidence](WARDROBE-FIT-2026-09-09.md) in `929922d` keeps authored and posed counts
  distinct. Do not blindly expand bounds or call the visible improvement a full geometry pass.
- Three fixed-pose follower render comparisons are archived. The first11904-bundle pilot was too
  sparse and changed the lock-albedo coordinate basis. The31050-bundle control restored that basis,
  but both first variants put coverage only in opacityNode: the shadow override cast solid strips.
  A separate corrected control puts coverage times atlas alpha in colorNode.a. Its sides and rear
  still look smoother, but crown patchwork and disconnected hem strips remain. Temporarily removing
  caps did not remove broad upper patches; do not blame the caps alone.
- The corrected31050-bundle primitive costs more: two fixed-pose candidate draw medians7.7/7.1ms
  versus controls4.7/2.2ms, each32 warm+180 measured serialized draws. Control variance prevents a
  precise single delta; this excludes live motion, readback and compositor/rAF waits. All physical
  state and camera values remain exact. [Follower evidence](HAIR-FOLLOWERS-2026-09-09.md) records
  80 archived files, manifest `237f28e14a0440a45281cfb2d60a8ed7c9a0a0c47294ed9fe6ae13ef2ffd4386`.
  No production render replacement or follower-edge collision guarantee is established.
- The next bounded prototype borrows final GPU card edges, gathers neighboring interpolated edges
  for position/tangent and keeps existing guide physics unchanged. No extra solver dispatch is
  needed. It must detach before solver storage disposal, preserve raw rest-albedo coordinates,
  avoid double skinning and qualify camera-facing expansion. Existing held velocity omits real
  deformation; temporal-off moving observation is only a prototype step, not final motion support.


## Current checkpoint — about 11:50 UTC

- The corrected g050 long bob is committed in `c871ed9`; the real wardrobe lookbook is in
  `7ea6ea6`, and PNG export is in `20569f5`. Their scoped proofs and existing appearance/fit limits
  remain in force. Other hair bakes and the default corrected card renderer remain unchanged.
- The live GPU follower proof is complete and **unshipped**: natural/nod paired motion preserves
  all saved physical values, adds no simulation dispatch or runtime readback, and passes the
  removal/reset/retirement checks. Temporal AA stays off; cost and appearance do not establish a
  production mode. [The follower record](HAIR-LIVE-FOLLOWERS-2026-09-09.md) and ledger retain the
  180-file primary archive plus the separate 32-file contact/shadow qualification.
- All 16 reconstructed follower face checks are clear. The nine-card full-body scope has 21
  triangle pairs; maximum sampled negative depth is 0.36599 mm. Separately, sampled base-alpha
  ≥ 0.5 clearance is at least 1.52051 mm. The original held-nod cards already have five pairs in
  that family, verified with their actual GLB topology. Compiled shadow alpha is correct, but
  mip 3+ visibility, other body regions and unsampled motion remain unresolved. Do not collapse
  those different gates into an all-body or rendered-transparency pass.
- The **mask-only wardrobe candidate** passes its CPU checks and all 32 actual clothed states.
  Its eight foundation-only states retain the existing groin exposure IDs 4787/4788. This is
  distinct from the rejected outer-cloth fitting experiment and does not repair those baseline
  foundation exposures. Root promotion review is pending; no asset promotion is recorded here.
- The scratch card-history prototype passes **19 CPU and 10 actual GPU scheduling checks**.
  Its per-pixel velocity oracle is still pending, so scheduling/lifetime evidence does not yet
  prove correct moving-pixel velocity or temporal quality. Keep it unshipped and separate from
  the follower rendering proof; [the history contract](HAIR-RENDER-HISTORY-2026-09-09.md) records
  the design boundary. No new GPU run or parameter variation was made for this checkpoint.


## Mask correction verified — 12:15 UTC

The four original g050 foundations now carry the reviewed coverage-derived masks. Only their
selected mask bytes changed; all 310 other frozen core/testbed/asset files remain exact. The
portable tool reproduces the installed files from immutable original fixtures, with eight groups
covering exact bytes, environment refusal, collateral triangle sets and output ownership.
The measured local projection contract and two-pose limits remain in
[the mask record](WARDROBE-MASKS-2026-09-09.md). All 32 clothed states pass the ray checks;
two seam-duplicate normal rays at one foundation-only location remain an existing separate red.

Final verification passes: 18-page build, 19 built-lookbook groups, 13 PNG-export groups and
8 production default-wardrobe groups. All browser errors are empty. The emitted files have the
four final hashes; bra/brief HTTP response bytes are also attested. Default vest/boxer production
requests match their successful emitted URLs. Front/rear/portrait review retains the neckline
and removes the conspicuous blouse/skirt foundation patches; sock and collar fit remains open.
The separate final promotion archive has 46 files / 15,915,257 bytes, manifest
`5f9cc1775aaf64e0bc5165362a2ef46c26158023d63f3759994c2777de600741`.

The next research work remains bounded: prove actual original-card pixel velocity, and qualify
one existing foundation-only skinning gap on the GPU. Neither the live follower renderer nor the
card-history prototype is shipped. No core, hair or outer-garment geometry change in this slice.


## Follow-up qualification — about 12:45 UTC

The g050 mask correction is committed locally as `82b3e63`. The later wardrobe and authored-pose
coverage suites pass 50 and 25 assertions. A separate exterior camera proves one small
foundation-only sliver at 4 s: 58 matching target pixels, 56 robust interiors. The first camera
was inside the body and is explicitly disqualified as external-exposure evidence. A nearest-body
weight-transfer pilot recovers 0 s rays but still fails at 4 s and distorts small triangles. A
separate sock fit adds body/cuff contacts. Both are rejected and production assets remain exact.
[The follow-up record](WARDROBE-FOUNDATION-SKINNING-2026-09-09.md) preserves all four archives and
the independent rehashes.

The exact original-card history prototype now passes its bounded stable-raster pixel oracle,
resource teardown and matched uninstrumented natural/nod sequences. Root reviewed a clear
reduction in moving-hair noise. ABBA timing shows no consistent added whole-frame cost within
run variation, not a 60 FPS claim. It remains unshipped while actual showcase same-task PNG
behavior and an explicit Stage-owned integration contract are checked. Live followers remain
unshipped; no production hair rendering or physics changed in this checkpoint.
