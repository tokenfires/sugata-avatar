# Hair — an outside review, and a way forward

<!-- status: reviewed-by docs/hair-way-forward-2026-08-23-review.md -->

> 🔴 **READ `hair-way-forward-2026-08-23-review.md` BEFORE ACTING ON ANYTHING HERE.** Every `[M]`
> citation below was checked against the tree: **24 CONFIRMED, 7 MISLEADING, 6 WRONG, 1
> UNVERIFIABLE**. The diagnosis largely survives and §2.3 is its best idea. **The §6 plan does not.**
> Four items would cost real time or worse:
> §5's *"apply it as written"* endorses a pre-registration renegotiation that was refused, and it
> flips branch (b) to (c); **move #1's premise is refuted** by `HairVelocity.js:59-81`, a file §0
> lists as read; §7's MakeHuman CC0 claim is **inverted** against this repo's own verified research,
> in a public MIT repo; and "58 commits" is **97** at the HEAD this file names.
> This status line is the doc's own §7 proposal, applied to itself.


**Written 2026-08-23, at HEAD `35ee6fc`.** An independent read of the hair phase by a reviewer who
was not part of any round. Scope: critical analysis of architecture, construction and approach.
No code accompanies this file; nothing here overrides CHECKPOINT, RED-GATES or the ledger.

Confidence tags follow the research convention: `[V]` verified in the tree this session,
`[M]` quoted from a committed measurement with its section named, `[I]` my inference — argued, not
proven.

---

## 0. What I read

CHECKPOINT §§1–17 in full; the hair-frame-design spec and its addendum; the REQ-064 pre-registration
and refutation commits (`5654c58`, `516a1eb`, `35ee6fc`); BRIEF; LEARNINGS headers and §1.25;
RED-GATES entries touching hair; the source sweeps of 08-14 and 08-17; and the implementation
itself — `HairMaterial.js`, `HairOIT.js`, `HairDynamics.js`, `HairRibbons.js`, `HairVelocity.js`,
`LightingRig.js`, `hair_cards.py`, `hair_texture.py`, `strand-spike.js`.

The record is extraordinary. Thirty rounds of negative results preserved in place, a control run
against a published reference renderer, pre-registration that an agent enforced against its own
author, retractions written louder than findings. Nothing below should be read as undervaluing
that. The question I was asked is why all of it has not moved the picture, and what would.

---

## 1. Executive summary

The phase is not stuck on hair. It is stuck on three things that sit *around* the hair:

1. **There is still no aesthetic objective function.** Every mechanism measures physics; the one
   instrument that points at "looks right" — the supplied reference plates — is used episodically
   and its tool has been retracted twice. Rounds therefore converge on provable local claims
   instead of global appearance. §3.
2. **The evaluation rig forecloses the shading tiers hair needs.** ~82% of forehead energy rides
   lights that cannot cast shadows `[M, §7]`; the rim that dominates edge definition is
   `#0f30ff` at irradiance 16 `[V, LightingRig.js:612]`; and `studio` is frozen as the calibration
   reference, so nobody may touch any of it. Several "hair defects" are properties of a rig solved
   for skin. §4.
3. **The harness keeps outranking the pixels.** P0 has now burned three sessions, twice timed a
   mis-rendered (bald) arm, and its blocker is a benchmarking-methodology problem other fields
   solved decades ago. §5.

Then five moves, in the order I would take them (§6): patch the temporal resolve's thin-feature
lock; close P0 by construction rather than by hygiene; give hair its own light; spend a round on
the generator's geometry; and build the perceptual loop that makes every later round steerable.
§7 holds smaller notes; §8 consolidates the don'ts.

---

## 2. Diagnosis — why eighteen rounds produced findings but not a picture

### 2.1 The process optimises for attributable findings, and findings are not the goal

CHECKPOINT §2 names the signature itself: *"Every round produced a genuine, sourced, red-proven
finding. The picture did not move."* That is not poor execution; it is what the incentive structure
selects for. A round is successful when it yields a claim that is sourced, red-proven, adversarially
verified and attributable. A round whose outcome is "the fringe reads warmer against the reference"
but which cannot say *which* term did it is, by the current standard, a failed round — even though
it is the only kind of round that moves the owner's four adjectives.

Goodhart at the meta level. The proxy (attributable local truth) has diverged from the target
(same-tier appearance). The record proves the divergence: the highest-movement events of the whole
phase were precisely the ones that broke attribution discipline productively —

- the frostbitten **control**, which bounded the primitive question in a day `[M, §4]`;
- the **owner's jaw-plane observation** on bob01, converted to arithmetic and shipped as bob02
  `[M, §14]`;
- the **β_R solve**, one constant taken from a source band instead of a taste default — the first
  non-null in three rounds `[M, §9]`.

All three share a shape: an external ground truth entered the loop, and a vague adjective became a
number. Everything internally-derived since has refined machinery without moving judges.

### 2.2 Shading rounds were spent where the leverage wasn't

R25–R31 built real machinery — lock ids plumbed end-to-end, envelope chords, ā_f quadrature,
lobe-width solves — and the picture did not move. The reason is on the record and worth stating
bluntly as arithmetic: the shipped BSDF has **no active colour-carrying lobe** (R is achromatic by
construction, TT ships off, TRT is retroreflective and tiny), so the only tint is a hack whose
ceiling was measured at 1.0927× `[M, §11]`. Meanwhile three independent lines converged on geometry
(cards read as facets/slabs/hems) before the primitive decision finally landed at R31.

Two of the four adjectives — **blocky** and **low-res** — are geometry and AA. Two — **wet** and
**muddy** — are shading *and* lighting. The week of R25→R31 inverted that ratio. `[I]`

### 2.3 Attribution discipline, applied to authored constants, produces deadlock

The clearest instance: R31 diagnosed that TT renders violet because the studio rim is
`#0f30ff` at irradiance 16, unshadowed `[M, §16/§17]`. The repair is a lighting value — but
`studio` is byte-identical by policy, the calibration anchor for nine scenes, so the rim cannot be
touched without re-opening the world. Result: a known cause, correctly attributed, left in place,
while rounds search for shader-side repairs to a light's colour. The exterior scenes got their rim
repaired (`36ba35d`) and improved immediately; studio's did not because it is load-bearing for
calibration.

The category error is treating **art constants** (light colours, irradiances, fibre colour) with
the same protocol as **physics claims**. Physics claims deserve derivation and gates. Art constants
deserve a look-development loop: propose, look, judge, keep or revert — the thing film and game
pipelines separate into a look-dev department precisely because attribution is the wrong tool for
it. §4 proposes the structural fix.

### 2.4 The harness failures are one recurring shape, not bad luck

Twice in three days, a timing arm silently rendered bald or wrong and produced confident numbers
(`5d2fc78`, `35ee6fc`). Three green-gate-blind-defect instances are in LEARNINGS. The shape is
always: **the measurement reported what it was told to measure, and nothing asserted the stimulus.**
`assertArmRenders` throwing is the right repair and arrived after the damage; §5 proposes making
this class impossible by construction.

---

## 3. The missing objective function, and how to install it

### 3.1 What exists today

- Owner adjectives (wet/muddy/blocky/low-res) as acceptance criterion `[M, spec §7]`.
- Blind judges as describers, with exemplar obligations `[M, JUDGE-BRIEF.md]`.
- Reference plates on disk (SHIFT UP, copyright-gitignored) and `tools/critic/hair-reference.mjs`
  — whose figures were retracted twice in R31 (inverted count; X/Y rect cut) `[M, §17]`.

### 3.2 What is missing

A **standing, automatic distance-to-reference measurement** that runs identically every round, so
that every experiment — including the messy artistic ones — lands somewhere on a continuum instead
of in verdict-noise. Concretely:

1. Pin one reference plate per style/framing as the target artefact (committed manifest, sha'd;
   the pixels stay ignored exactly as now).
2. A capture driver photographs ours at matched framing (the framing constants are shared with
   `lighting.html` already).
3. Emit, into every plate manifest automatically (REQ-091's own pattern): per-region ΔE2000
   heatmaps and percentile tables over named regions — fringe band, crown, silhouette band (the
   20–60 px halo zone hair.md §0.4 measured), hem, mass interior.
4. Track the numbers round-over-round in one table owned by the probe, never retyped.

This does not require solving the illumination-matching problem. Matched absolute lighting between
a game capture and the studio rig is not achievable and need not be: region-level *statistics*
(percentile ratios, chroma-vs-luma slope, silhouette transition widths, band-power at the three
bands band-power.mjs already validates) are comparatively illumination-tolerant, and where they
are not, the reference serves as **anchor C** in relative judgment rather than as an absolute
target.

### 3.3 Judges: go from verdicts to rankings

RLHF solved this exact instrument problem years ago: **absolute ratings from LLM judges are noisy;
forced pairwise comparisons are robust.** The control run demonstrated why — six of six refused
"same-tier" for a known-good asset, i.e. the absolute scale has no usable resolution. The rewritten
brief already demotes judges to describers; go one step further:

- Every round's plates are judged as a series of **pairwise forced choices** (A vs B, plus the
  reference as anchor C when useful), many small trials, aggregated by something like
  Bradley–Terry/Elo into a ranking with error bars.
- Descriptions remain free-form and are mined for vocabulary (they have been consistently the most
  valuable judge output — "per-pixel noise standing in for structure" outperformed the hypothesis
  derived from it `[M, §7]`).
- Decoy axes stay: they are the instrument's proof-of-work.

### 3.4 The owner's eye is a primary instrument, not a tiebreaker

BRIEF R19 records the measured fact: across nine rounds the human found what every gate missed.
bob01→bob02 happened in hours once his sentence entered the loop. Institutionalise it: every round
ends by showing the owner 2–3 plates (before/after/reference), capturing his verbatim reaction into
the round note, and letting that reaction nominate the next round's target adjective. Gates then
serve as guardrails on whatever the eye nominated — the reverse of today's default. `[I]` but
grounded in the project's own history.

---

## 4. Give hair its own light — the single highest-leverage architectural change

### 4.1 The problem stated as arithmetic

From the record `[M, §7]`: at the forehead, RectAreaLights carry ~77% of luminance and cannot cast
shadows in three at all; ambient is GTAO-composited; the entire shadowable budget is the key
SpotLight's 17.55%, of which the groom already removes 96–100%. Conclusion recorded there is
correct: no shadowing algorithm can matter under this rig.

Consequences cascade through everything measured since:

- **Lock hierarchy cannot form by shading.** Lock-scale coherent self-shadow is the mechanism
  real hair uses; with 18.5% ceiling and saturation reached, there is nothing for it to modulate.
  Judges' surviving complaint ("uniform shell, no lock hierarchy") is a property of the rig, not
  the groom or the BSDF.
- **Zinke/deep-opacity tiers are unreachable.** Light-view path length requires a shadow-casting
  dominant light; Frostbite's Tier-3 fallback was adopted precisely because the rig forecloses the
  higher tier `[M, §10]`.
- **TT transmits poison.** The one lobe that carries transmitted light colour faithfully
  (agreement to 5.7° with its source `[M, §17]`) faces a saturated blue rim at E16. Turning TT on
  under this rim is physically correct and perceptually violet. So a correct lobe stays shipped-off,
  and the pedestal fake keeps carrying 59–88% of the mass.
- **REQ-064's refutation points here.** Its own closing line: a near-axis light cannot make black
  hair coloured; *a lighter fibre would* `[M, 516a1eb]`. Fibre colour is an art constant — see
  §2.3.

### 4.2 The move

Declare a **hair-evaluation rig**: a portrait lighting variant designed for hair phenomena, the way
exterior scenes declare their own baselines (precedent: R20's calibrated-gates constraint and its
resolution).

- Dominant **shadow-casting key** (SpotLight, high shadowFraction), warm-neutral; modest neutral
  fill; near-axis low-intensity glint light (the REQ-064 placement survives as rig furniture even
  though its registered purpose died — hair.md §9.4 measured radiance p95/p50 1.872 → 4.291 with a
  near-axis source and the fake off `[M]`); rim repaired from `#0f30ff` toward the exterior-scene
  family.
- Skin/eye/gesture gates stay on `studio`. Only hair gates adopt the eval rig, declared in
  RED-GATES like any scene baseline. `studio` remains byte-frozen. The two-rig cost is one more
  baseline table, not a recalibration of the world.
- With a spot-dominant rig, the **deep opacity map tier becomes reachable for the light that
  matters** — layered opacity from the key's view, giving Zinke's n along the true shadow path,
  lock-coherent self-shadow, and the per-channel T_f form something real to eat. This flips §7's
  conclusion ("do not build a deep opacity map") from universal to rig-conditional. `[I]`
- Then TT turns **on** — possibly with no attenuation machinery at all, because transmitting a
  well-chosen rim colour is what TT is *for*. The violet failure was the rig speaking through a
  correct shader.
- Then fibre colour gets its art pass within melanin-plausible bounds (the refutation's own
  suggestion), judged on the eval rig against reference statistics.

Order matters and is forced by the dependencies above: **rig first, lobes second, forms third.**
The addendum's corrected ordering (TT, then pedestal form, then energy) is right *within* the old
rig; under a new rig the first two steps partially dissolve. `[I]`

### 4.3 What would change my mind

If matched-mask reference comparison showed our mass percentiles already inside the reference band
under the *current* studio rig, the rig argument weakens and the effort belongs entirely in
geometry + temporal resolve. The measurement to settle it is cheap and is §3's harness anyway.

---

## 5. Close P0 by construction, not by hygiene

P0 (ribbons inside `alive.html`, delta vs no-hair) has failed three ways: contention/DVFS suspicion
(withdrawn), three real harness bugs, and finally the discovery that the `hair` arm attached no
groom at all — a 404 somewhere on the attach path, census null, timings meaningless
`[M, 35ee6fc]`. Each failure has a fix committed or filed. The *design* still contains the trap:

**Cross-page, cross-arm wall-clock deltas are the wrong instrument on this hardware.** Apple-Silicon
GPU clocks are not controllable from the OS, so any A/B spread across pages, resolutions or time
compares different clock states; the strand ladder worked precisely because every arm shared one
page class `[M, §17]`. Benchmarking solved this long ago (SPEC-class practice: normalize against an
adjacent fixed reference workload; never compare minima across states — the repo's own
`strand-time.mjs:317` already says this). The redesign that makes the confound structurally
impossible:

1. **One page. One process. Interleave.** Toggle the groom attach/detach within the running page
   (A/B/A/B…), N cycles after M warm-up toggles. Both samples of a pair share the immediately
   preceding clock state by construction.
2. **Measure passes, not frames, where possible.** `renderer.trackTimestamp` render-pool timestamps
   (already proven in strand-spike.js) around the hair draws give the delta directly; whole-frame
   wall clock becomes the secondary confirmation, not the headline.
3. **Assert the stimulus after every toggle**: `report().hair` census non-null, strand/card counts
   match the request, material class as expected, zero 404s in the console buffer. Any assertion
   failure voids the pair, loudly. This is `assertArmRenders` promoted from post-hoc guard to
   per-sample precondition.
4. Report medians with dispersion *within* the interleaved sequence; never compare statistics taken
   from different sequences.

Expected cost: half a day to a day. It retires the DVFS question permanently — for this measurement
and every future perf gate — and unblocks branch (b)'s accept-half, which is currently the only
thing standing between the decided primitive and its adoption. Note the decision rule's clause
already updated to measured parity (+1.46/+1.71 ms) `[M, addendum]`; apply it as written.

While in there: the 4,960-vs-11,408 bob density fork (two documents disagree, neither notices
`[M, §17]`) should be resolved by the same harness — it is a curve, not a fork: strand-count → ms
is exactly what the spike delivered, and width-compensated decimation is the LOD story waiting on
it `[M, spec §2]`.

---

## 6. The five moves, sequenced

| # | move | size | what it unblocks |
|---|---|---|---|
| 1 | **Patch the temporal resolve for thin features** | ~1 day | perceived noise/"low-res" for *every* alpha-based arm, cards and ribbons alike |
| 2 | **P0 redesign** (§5) | ~1 day | primitive adoption; the LOD curve; ends the perf-confound class |
| 3 | **Hair-eval rig + TT-on + fibre art pass** (§4) | 1–2 days + gates | wet/muddy; lock-shading headroom; retires the violet line permanently |
| 4 | **Generator round** (§6.1) | 2–3 days | blocky (hem/facets), short-style regime, silhouette halo |
| 5 | **Perceptual harness** (§3) | 1–2 days | steering for every round after it; judge-ranking; owner-eye loop |

They are deliberately ordered cheapest-and-most-unblocking first, and 1–2 are independent enough to
parallelise under the disjoint-file-ownership discipline.

### 6.1 Notes on the generator round (move 4)

The style table exists; seven grooms from one generator; bakes reproduce byte-for-byte at 20 s
`[M, §13/§14]`. The gaps that matter, in priority order:

1. **Flyaway/wisp shell first.** hair.md measured the reference silhouette as a 20–60 px halo that
   is *not* card edges, with 40–60% of cards budgeted to that layer `[M, §0.4/§6.2, spec §2]`.
   For the bob (cards + shell), the shell *is* most of the perceived-quality delta. Build it
   before polishing interior card density.
2. **Tips and hem.** Arc lengths median 244 mm vs Sintel's 101 `[M, §16]`; the tfx tip-randomisation
   fix is already named. Length distributions (log-normal-ish variance per layer) plus taper are
   generator-side and measurable with the silhouette-IoU tools that already exist.
3. **Envelope-as-shell.** §3's own transferable idea — author the outer envelope explicitly and
   place contents barycentrically by construction. Kills the eleven-millimetre cloud class
   `[M, §2]` and is the natural substrate for the short-style regime (scalp-shell surface + strand
   detail — the candidate §14 says nobody has costed).
4. **Scalp clearance for short styles** (crop01's buried front third `[M, §17]`) — `HAIRLINE_LIFT`/
   `ATTACH_*` territory; blocks the parity figure's own subject, so it precedes final (b)-acceptance
   evidence.
5. Re-solve `hair_texture.py` lane counts against the corrected SAMPLED_LOD (flagged open in the
   file itself) — relevant while cards live, moot for ribbon strips.

### 6.2 Notes on move 1 (the TAAU patch)

The finding is precise and sits untouched since it was written `[M, §2]`: installed
`TAAUNode.js` gates the thin-feature lock behind a **two-sided** depth-change test
(`:743/:744`), invalid history resets the accumulator fully (`:751`), and dithered coverage changes
depth both directions every frame at exactly the pixels hair occupies — "our coverage mode and our
temporal resolve are in direct contradiction."

Three addons files are MIT; vendor the one node, patch narrowly (one-sided depth test, or
coverage-mask-aware locking driven by the OIT pass's existing mask), gate behind a toggle, and A/B
on the deterministic forward path `HairMaterial.selftest.mjs` already exercises. Risks to price:
ghosting on real disocclusions (keep the depth threshold for non-hair pixels), interaction with
RCAS sharpening, and the WebGL2/TRAA fallback path. This is the rare change that improves cards and
ribbons simultaneously and costs almost nothing — and it removes a systematic handicap that has
been taxing every dithered arm ever judged, including in the control comparison. `[I]` on that last
clause: frostbitten's analytic coverage needs less temporal convergence than any stochastic arm, so
part of the primitive gap the control measured may be this resolve defect wearing a primitive's
clothes. Worth knowing before the (b)/(a) adoption is finalised.

---

## 7. Smaller notes

- **A known-good-groom control cell that isn't Sintel.** The planned separation (our groom × their
  renderer etc.) isolates generator from renderer; it still answers neither "does OUR stack make a
  good bob look good?" A CC0 artist-made groom (MakeHuman community hair libraries are CC0; verify
  per-file) imported via `tfx_export.py` gives *artist groom × our renderer × our rig* — the
  cleanest test of the shading stack, decoupled from the generator entirely, and a permanent
  regression target for "how much of remaining gap is grooming".
- **Ribbons need motion eventually; two in-house options exist** before anyone writes a new solver:
  fold expansion into `HairDynamics`' compute output (its `skinKernel` already rebuilds ribbon
  vertices via minimal-rotation transport for cards — same pattern, one slot conflict removed by
  doing expansion in the kernel), or interim head-bone-driven analytic sway for a weight-one-bone
  groom. The silent-collapse failure mode (solver won the `positionNode` slot) is already guarded
  by refusal; keep that guard.
- **Alpha-to-coverage** (`kainino0x/alpha-to-coverage-emulator`, BSD-3, already swept) is the
  principled answer for MSAA tiers; Stage forbids MSAA+temporal AA, so its home is the `fallback`
  tier and spike pages. Low priority; noted so it doesn't get rediscovered.
- **Doc-status headers.** §13's HANDOFF paragraph was obeyed after §14 superseded it — "a
  superseded handoff is more dangerous than a stale number" `[M, §13]`. Extend REQ-091's principle:
  sections that carry instructions get machine-readable status lines (`status: superseded-by §14`)
  and a lint gate fails on instruction-bearing sections lacking one. Cheaper than another round
  spent obeying a ghost.
- **Re-declare the round fence.** 58 commits past a ceiling of 14 `[M, §14]`; the stale-ROUNDS red
  is declared, the expiry mechanism is idle, informal labels accumulate. One declaration clears it
  and forces adjudication of the expired entries — that is what the mechanism is for. Owner call,
  already flagged.
- **Finding-churn budget.** Consider a soft portfolio rule until the adjectives move: a round ships
  either a picture delta scored on the §3 harness or a closed line; rounds producing only new open
  questions count against a small quota. The point is not bureaucracy — it is making visible,
  numerically, the ratio that has been invisible: findings per picture-change.

---

## 8. Consolidated don'ts (theirs plus mine)

Everything in spec §8 stands. Added:

- Do not reopen TT or TRT under the *studio* rig; both closures are rig-relative facts
  (geometry of paths to a poisoned rim; absorption of a black fibre). Under the eval rig, TT
  especially deserves one clean re-test before its closure is treated as universal. `[I]`
- Do not run shading-form experiments ahead of move 1 — the resolve contradiction taxes every
  dithered pixel and will contaminate any A/B judged on temporal stability.
- Do not compare timing statistics taken from different page classes, session phases, or sequences
  ever again; the interleaved-pair design (§5) is the standing method.
- Do not treat judge mechanism-attributions, absolute tier verdicts, or hand-typed tables as inputs
  to decisions — all three have named failure classes in LEARNINGS.
- Do not "fix" bob01 (sha-anchored control) — but *do* stop letting the freeze extend to the rig it
  is photographed under. Freezing an asset is calibration hygiene; freezing its lighting forever is
  how a known-bad rim survived four rounds of correct diagnoses. `[I]`

---

## 9. Closing assessment

Nothing here argues the effort was wasted: the eliminations are real knowledge, several rounds
bought permanent infrastructure, and the discipline caught dozens of defects any other process
would have shipped. But the phase's own records show where movement came from — controls, spikes,
solved constants, the owner's eye — and all four are instances of *ground truth entering the loop*.
The five moves are, in the end, one recommendation stated five ways: **put a ground truth in the
loop at every altitude** — a reference image for appearance, a known-good groom for the stack, a
clock-stable interleaved harness for cost, the owner's eye for direction — and let the formidable
measurement apparatus do what it is uniquely good at: guarding the approach, and proving each step
did what it claimed.
