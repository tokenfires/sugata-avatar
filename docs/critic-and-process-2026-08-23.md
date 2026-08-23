# The critic, and why the loop churns — a process note for Claude

**Written 2026-08-23, at HEAD `35ee6fc`.** This is not a hair round and it changes no gate. It is a
note about *how the loop evaluates*, written because the owner asked a specific question: is the
critic helping, or is it part of why thirty rounds produced findings and not a picture? The short
answer is that the critic's **descriptive half is the most valuable instrument in this repository**,
and the loop is wired to ignore that half and act on the two halves that don't work. This note says
what to change.

Nothing here overrides `docs/BRIEF.md`, `docs/CHECKPOINT.md`, `docs/RED-GATES.md` or the ledger.
It is a policy for the loop's evaluation layer, to be read alongside `tools/critic/JUDGE-BRIEF.md`.

---

## 1. The one-sentence diagnosis

The loop optimises for **attributable local truth** and the target is **global appearance**, and the
critic — as currently used — measures the first while being asked to certify the second. CHECKPOINT
§2 already names the signature: *"Every round produced a genuine, sourced, red-proven finding. The
picture did not move."* That is not weak execution. It is Goodhart at the meta level: the proxy the
loop rewards has come apart from the thing the owner wants, and the critic sits on the seam.

Every high-movement event in the whole phase has the same shape — an **external ground truth entered
the loop and a vague adjective became a number**: the frostbitten control bounding the primitive in a
day; the owner's jaw-plane sentence becoming bob02 in hours; the β_R solve taking one constant from a
source band instead of a taste default. Everything internally-derived since has refined machinery
without moving a judge. The fix is therefore not "measure harder." It is **put a ground truth in the
loop at every altitude, and let the critic's eye — not its arithmetic — steer.**

---

## 2. What the critic is good at, measured — and what it is not

This is established on pixels, not asserted. Keep all three columns in view; the loop currently acts
on the wrong two.

| the critic's output | reliability | evidence |
|---|---|---|
| **DESCRIPTION** — "blunt slabs", "per-pixel noise standing in for structure", "there is no band", "lavender/mauve", "desaturates to grey as it lightens" | **high — the best evidence in the repo** | control judges refused "slabs/card edges" about frostbitten which has neither, and said both about ours (CHECKPOINT §4) |
| **ATTRIBUTION TO MECHANISM** — "this is alpha dithering", "missing shadow maps", "no lock-scale albedo" | **low — confabulates confidently** | a control judge described "a diagonal cross-hatch checkerboard… alpha dithering" on a renderer with no dither and no alpha texture (CHECKPOINT §4, JUDGE-BRIEF.md:21-28) |
| **ABSOLUTE VERDICT** — "is this same-tier / AAA?" | **unusable — no resolution at this end** | six of six blind judges refused "same-tier" for the *published Frostbite reference implementation* (CHECKPOINT §4.3, LEARNINGS §1.25ah) |

The lesson `JUDGE-BRIEF.md` already draws is right and under-applied: **take what a judge SEES;
never what it says is CAUSING it, and never ask it whether the tier is met.** The costly rounds are
the ones where the loop appended a mechanism to a description — *therefore lock-scale albedo;
therefore missing RectAreaLights; therefore TAA disocclusion; therefore alpha dithering* — and then
commissioned a precise metric around the guess.

---

## 3. The five failure modes the loop keeps reproducing

Each is on the record, with a repair. These are the things a redesigned critic has to make
structurally hard, not merely discouraged.

1. **Observation is promoted to mechanism in the same breath.** The critic's first clause is gold;
   the diagnosis welded to it is a coin-flip. They must be *separate outputs from separate steps*,
   and no mechanism becomes work until a discriminator for it has been shown on a control.

2. **Metrics are commissioned from the hypothesis, not from the visual distinction.** Mean alpha
   couldn't tell a picket fence from a rectangle; a whole-face mean diluted a local curtain shadow
   from 18–28% to 1–3%; band-power and `coherentLock` rewarded incoherent noise; a fixed-denominator
   contrast gate rewarded a brighter floor. The standing rule (CHECKPOINT §5, LEARNINGS §1.25):
   **validate every operator against a shape whose answer is arithmetic, and against a crop you have
   actually looked at, before it is allowed to direct a round.** It is learned repeatedly and applied
   inconsistently.

3. **Local physical truth is treated as the acceptance objective.** Sourced equations, CPU mirrors,
   red proofs, energy accounting are excellent *guardrails*. R27–R28 are the clean cautionary case:
   the input became physically meaningful, Spearman rose 0.06→0.61, 71% of pixels moved — and the
   pedestal form moved 0.21% and no judge saw a thing. "Many pixels moved" is not "the picture moved."

4. **The stimulus is never asserted.** The Frostbite comparison first ran against our *geometry-only*
   page; runtime critics were shown a *bald* avatar and dutifully critiqued lighting; P0 twice timed
   an arm with *no groom attached* and reported confident milliseconds; some gate greenness depended
   on session-local plates and was silently red on a clean clone. The shape is always the same: **the
   measurement reported exactly what it was told to, and nothing proved the phenomenon was present.**

5. **The acceptance gate alternates between impossible and irrelevant.** "Same-tier" is impossible —
   a known-good asset fails it. Physics/selftest gates stay green while the output looks poor. Neither
   can *terminate* the loop toward the owner's actual target. Owner adjectives became the acceptance
   criterion only at R31, and only for hair.

---

## 4. What to change — split the critic into three roles

The single most useful move is to stop asking one agent to observe, diagnose, and certify. Give the
loop three distinct evaluation roles with non-overlapping outputs. This is a generalisation of what
`JUDGE-BRIEF.md` already started (demoting judges to describers); it just names the other two roles
and forbids them from leaking into each other.

### 4.1 The Observer (keep, and make primary)
- Reports **only visible facts**: region, scale, direction, comparison, confidence. "The crown reads
  grey rather than copper across this band." "The hem is a row of flat rectangles here \[crop]."
- **May not** name a shader, geometry, light, AA mode, or material cause. Every claim carries a
  nearest-neighbour crop. Every "real hair does X / AAA does Y" carries a citation or is demoted to
  an explicit impression. A "no difference" null is a first-class, valuable answer.
- This is the half that works. It is the steering signal. Mine its **vocabulary** — it has
  consistently beaten the hypotheses derived from it.

### 4.2 The Diagnostician (new, separated, and gated)
- Receives the Observer's description **cold**, without the round's hypothesis.
- Produces **two or three candidate mechanisms and, for each, the discriminator that would separate
  it from the others.** Its deliverable is not a cause; it is *an experiment that would reveal the
  cause.*
- **No mechanism graduates to a round until its discriminator has been demonstrated on a control.**
  This is the direct antidote to the "alpha dithering" confabulation: a mechanism you cannot
  discriminate is not yet knowledge.

### 4.3 The Verifier (new, cheap, runs first)
- Before any metric or judge sees a plate, it asserts the **stimulus** from the live frame: right
  page and renderer; groom attached and non-empty; expected material class; strand/card counts match
  the request; intended lighting/OIT/AA/motion/grade states; zero resource 404s; census taken after
  first draw; a non-trivial difference from the null/bald arm in the nominated region.
- Any failed assertion makes the plate or timing sample **void, loudly — not caveated.** This is
  `assertArmRenders` promoted from a post-hoc guard to a precondition on every sample.

---

## 5. Give the critic an aesthetic frame, not just numbers

The owner's real concern — the critic hands back mathematics where hair needs aesthetics — is
correct, and it is fixable without pretending an LLM can score beauty absolutely.

### 5.1 Rank, don't rate
Absolute quality ratings from an LLM judge are noise (six-of-six proved it). **Forced pairwise
comparison is robust** — this is the RLHF result, and it is the right instrument here. Every round's
plates go through many small A-vs-B trials — candidate vs current, candidate vs prior-best, and
candidate vs a licensed known-good anchor where one exists — aggregated by Bradley-Terry / Elo into a
ranking *with error bars*. Keep the decoy axes over provably bit-identical regions; they are the
instrument's proof-of-work and they tell you the judge's own noise floor.

### 5.2 Speak in the owner's adjectives, mapped after the fact
The owner's words — *wet, muddy, blocky, low-res* — are the acceptance criterion and **the last thing
that may appear in a judge's prompt** (leading the judge is exactly how confabulation gets
manufactured). The chain is fixed and one-directional: *Observer describes freely → the round author
maps that description onto the owner's adjective in the open, in the round note, where the mapping can
be argued → owner looks at the plates.* The aesthetic judgement lives in the description and the
ranking, not in a scalar the math produced.

### 5.3 Institutionalise the owner's eye as a primary instrument
BRIEF R19 records the measured fact: across nine rounds the human found what every gate missed. That
is not a courtesy tiebreaker; it is the most reliable aesthetic sensor the project has. **Every round
ends by showing the owner 2-3 plates (before / after / reference), capturing his verbatim reaction
into the round note, and letting that reaction nominate the next round's target adjective.** Gates
then guard whatever the eye nominated — the reverse of today's default, where gates nominate and the
eye arrives last.

---

## 6. Make "did the picture move?" a first-class, recorded quantity

The loop cannot see its own churn because the one ratio that matters is invisible: **findings per
picture-change.** Make it visible.

For every round, record: the target adjective; baseline plate; candidate plate; the pairwise-rank
change (with error bars); the localised metric change; and a one-word verdict — **improved / closed /
instrumented.** A round counts as progress only if it either (a) improves the ranked picture on the
nominated adjective, or (b) closes a hypothesis hard enough that it will not be revisited.
Infrastructure is valuable and allowed — but it is logged as `instrumented`, never reported as
aesthetic progress. Until the adjectives move, hold a soft quota: rounds that produce only new open
questions count against it. And keep the spec's own stopping rule: **iterate at most three times on a
line, then stop and report the frame problem rather than churn** (hair-frame-design §10).

---

## 7. Ground truth at every altitude — the through-line

The critic redesign only pays off if the loop has something true to compare against at each level.
The record says movement came from exactly these, and only these:

- **Appearance:** a reference image in the loop *every round* as anchor C for relative visual
  ranking, not as an automatic distance target. Region statistics may be reported as exploratory
  diagnostics only after their illumination sensitivity is measured; they are not gates. The prior
  `hair-reference.mjs` attempt retracted figures twice and stands down on a clean clone because its
  copyrighted plates are correctly `.gitignore`'d. Do not re-propose that harness under a new name.
- **The stack:** a **licence-checked** known-good groom through our renderer, by the fourth
  subjective round at the latest, so grooming / primitive / shading / lighting / evaluation failures
  are separable before rounds pile up. (Note: MakeHuman *community* assets are **not** CC0 — only the
  core `makehuman_system_assets` pack is; `docs/research/character-assets.md:38-39`. A control asset
  needs its licence verified per-file before import into this MIT repo.)
- **Cost:** a clock-stable, interleaved, single-page harness that asserts the stimulus after every
  toggle — but **name the actual blocker first** (P0's live blocker is an unnamed 404 on the attach
  path, not the timing method).
- **Direction:** the owner's eye, on a fixed cadence, as in §5.3.

---

## 8. Guardrails that keep an outside (or future) reader honest

The project's durable record lives in commit bodies and file headers, which means a reader with the
repo but not the sessions **cannot tell a live finding from a closed one.** The most recent outside
review ranked a refuted mechanism as move #1 for exactly this reason. So:

- **Every durable finding carries a machine-readable lifecycle state** — `live` / `provisional` /
  `closed` / `refuted` / `superseded` — with the introducing and closing commit, and the tree
  revision it was last verified at. Search should surface the latest state and show old prose only
  with its closure attached. This is the review's own §7 proposal, applied to findings as well as
  handoffs, and three of that review's six wrong verdicts were this one shape.
- **Treat art constants differently from physics claims.** Physics claims deserve derivation and
  gates. Art constants (light colour, irradiance, fibre tint within melanin-plausible bounds,
  proportions) deserve a reversible look-dev loop: propose two or three bounded alternatives → render
  matched A/B → rank by eye → keep or revert → *then* install regression bounds. Governing an art
  constant with the physics protocol is what produced the studio-rim deadlock (filed as REQ-078, an
  owner call — not a round).
- **Never compare across incommensurable populations, domains, sessions, or page classes.** Encoded
  vs radiance, whole-groom mask vs shadowed fringe rect, minima across GPU clock states — each
  produced a confident, unstable headline. State the mask, the domain, and the window beside every
  number.

---

## 9. The concrete asks, in priority order

1. **Rewire the evaluation layer into Observer / Diagnostician / Verifier (§4).** Highest leverage,
   and it is mostly a reorganisation of prompts and gates you already have.
2. **Add the Verifier stimulus-assertion as a precondition on every plate and timing sample (§4.3).**
   Cheapest, and it retires an entire class of false conclusions.
3. **Switch judging from rating to pairwise ranking with error bars, adjectives mapped after (§5).**
4. **Log findings-per-picture-change every round, with the improved/closed/instrumented verdict (§6).**
5. **Put a reference in the loop every round and a licensed known-good groom in by round four (§7).**
6. **Give every durable finding a lifecycle state; separate art constants from physics claims (§8).**

The critic was never broadly bad. Its eye is the best sensor here. The loop churned because it kept
asking that eye to also diagnose mechanisms and certify a tier it cannot see, then built ever-finer
mathematics on the guesses. Point the eye at ranked, ground-truthed comparisons; let the mathematics
guard the approach and prove each step did what it claimed; and let the owner's eye and a moving
picture — not a green gate — decide what "done" means.
