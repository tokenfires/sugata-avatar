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

- Root: visible bob01/g050 baseline capture, correction integration, real-browser review, motion
  acceptance, checkpoints and scheduling.
- `visual_next_step`: all-five-bake bob01 geometry/body diagnosis; diagnostic scripts/captures only
  until correction ownership is agreed. All bakes have 496×17 chains and 652 cap vertices, but head
  bind heights span about 128mm and card identities/roots shift across bakes.
- `continuity_audit`: necessary capture-tool generalization in `tools/critic/portrait-clearance.mjs`
  and focused tests. Explicit/inferred hair style, correct source/request hashes, verified attached
  style/bake, no silent unsupported body calibration. Initially only g050 is accepted.
- `orbit_render_audit`: opt-in clothed g050 Avatar integration, wardrobe ownership/disposal and focused tests. Owns Avatar.js and wardrobe code; coordinate before collider changes.
  Current g050 wardrobe body matches base geometry/skin data and adds hide/decency masks;
  manifest coverage and fitting beyond that bake must not be inferred from asset presence.

The original long-bob assets are frozen under `captures/long-bob-2026-09-08/originals/`, with their
hashes below. The visible page is `/src/portrait.html?hair=bob01`; it currently creates gender 0.5.
The capture/replay instruments now select and verify bob01 or bob02 on the calibrated g050 body.
Actual GLB responses, source hashes and every frame's live identity are checked. Other body bakes
remain refused until their anatomical calibration is established. Legacy evidence remains
replayable but is explicitly marked as lacking the new provenance attestation.

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
