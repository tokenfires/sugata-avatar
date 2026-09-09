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

- Root: bob01 correction integration, Three TSL surface-query prototype, browser review, motion
  acceptance, checkpoints and scheduling. No groom or runtime physics change has shipped overnight.
- `visual_next_step`: rest geometry/body diagnostics and actual card-ID render attribution of v9's
  residual rear strips. Scratch artifacts only. The CPU surface/BVH v2 prototype is complete.
- `continuity_audit`: coupled whole-chain collision feasibility, finite-width ribbon contact and
  exact triangle gates. Scratch artifacts only; fixed-predecessor controls are rejected below.
- `orbit_render_audit`: all-five-bake capture/replay calibration and portrait bake selection. Owns
  portrait.js/selection helper and critic capture/replay/calibration files; preserves root's new
  rig/inverseBind/collider capture metadata. Wardrobe integration is completed at6d36059.

The original long-bob assets are frozen under `captures/long-bob-2026-09-08/originals/`, with their
hashes below. The visible page is `/src/portrait.html?hair=bob01`. Capture/replay integrity support
for both bobs on g050 shipped at6fb3032; broader calibrated bake selection is now being implemented
and is not yet an accepted capture result. bob01 has five authored bakes; bob02 has g050 only.
Legacy evidence remains replayable with its actual provenance attestation level.

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
