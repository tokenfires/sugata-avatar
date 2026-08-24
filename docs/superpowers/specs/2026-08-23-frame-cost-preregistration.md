# Pre-registration — `frame-cost.mjs`, and the calibration gate that decides whether it may speak

**Date:** 2026-08-23 · **Registered at:** `511b9fb` · **Tool:** `tools/critic/frame-cost.mjs`
**Supersedes as the primitive-decision instrument:** `captures/hair-r31-ladder-ours/tools/frame-budget.mjs`

This round does not measure a groom. It builds an instrument and then tries to prove the instrument
is unfit. Only if that attempt fails is any groom cost reported.

**The reason is a five-item list.** Every one of these was stated as a measured finding, in this
repo, in the last two days, and every one was wrong:

| claimed | actual |
|---|---|
| "cards cost −3.974 ms" | non-physical; a mixture of two clock states |
| "P0 is a DVFS problem" | withdrawn on a defect, then reinstated — the withdrawal was the error |
| "the hair arm attaches no groom" | it attaches a full groom; the guard read a field that does not exist |
| "P0 has a 404" | every asset serves 200 |
| "the cards arm closes at +0.461 ms" | one draw from a swing that reads −1.570 / +1.191 / +0.501 |

An instrument with that record does not get to report a number on its own say-so.

---

## 1. What changes: the cost of a groom becomes a SELF-difference

Every figure above came from **differencing two pages**. That confounds *what is drawn* with *which
page is asked*, and the confound is not small — it produced a sign error.

The primitive here is a **within-page `visible` toggle**. One page, loaded once, warmed once. Inside
a single tick it is sampled twice: with `session.hair.meshes` visible, and with them hidden. The
page, the context, the pipeline cache, the resident set and the clock state are all held identical
by construction, because they are literally the same page one frame apart.

`visible = false` is the right knob and not an approximation of one: the groom's meshes carry
`castShadow = true` (`alive.js:2560-2566`), and three.js culls an invisible mesh from **every** pass,
so the toggle removes the G-buffer draw and the shadow draw together. That is the whole groom.

**Cross-page differencing is removed from the instrument.** It is not improved, corrected, or
conditioned — it is gone.

## 2. 🔴 The calibration gate: the instrument must measure ZERO before it may report NON-ZERO

Four nulls. Each is a pair of conditions that draw the **provably identical picture** and must
therefore differ by nothing. They run in the same ticks as the real arms, from the same samples.

| null | the two conditions | what a failure would mean |
|---|---|---|
| **N1 · toggle-is-absence** | groom hidden on a hair page **vs** a page with no groom at all | `visible = false` leaves cost behind; the primitive is invalid and the round is void |
| **N2 · page identity** | groom hidden on hair page A **vs** hidden on hair page B | cost is a property of *which page is asked*, which is the artefact that broke every prior figure |
| **N3 · within-page repeat** | the hidden condition sampled twice in one tick | pure instrument noise, with nothing physical between the two reads |
| **N4 · run drift** | hidden p50 over the first third of ticks **vs** the last third | the machine moved mid-run and the arms are not on one yardstick |

### The two ways a null fails, and both are gated

A null can be too **noisy** (cannot resolve the effect) or too **biased** (small but consistently
signed — a systematic order effect that will contaminate the real arms with the same sign). Gating
only the magnitude would pass a 0.05 ms bias that lands on 100% of ticks, which is exactly the shape
of a position effect.

```
NULL_MAX_MS   = 0.25    paired |p50| of every null
NULL_SIGN_Z   = 3.0     |p̂ − 0.5| ÷ (0.5/√n) for every null's sign test
```

**Derivation, from the decision and not from the data.** The rule this instrument serves is
"parity with today's cards", and today's cards are a ~1.2–2.4 ms object. An instrument whose null is
a quarter of the smallest effect it must resolve cannot adjudicate parity; 0.25 ms is ~10–20% of the
effect and leaves the parity call meaningful. `NULL_SIGN_Z = 3.0` is three standard errors of a fair
coin at the run's own n, so a genuine null passes >99.7% of the time and a one-sided artefact does
not.

⚠️ **DISCLOSURE, because `pre-registration-binds-the-registrant` requires it.** I have already seen
three null runs from the verification workflow, reading |p50| ≤ 0.099 ms and sign 43.5–53.7%. The
thresholds above are derived from the decision, not fitted to those numbers, but I saw them first
and that must be on the record rather than implied away. What binds is this: **these constants are
in the tool as named exports before the first new sample is taken, and the round is void if they
move afterwards** — in either direction.

## 3. 🎯 The clock is not fought. It is measured, for free

Three prior runs of the identical toggle measured the identical groom at **1.233, 2.337 and
2.390 ms**. Not noise — a 94% spread. Their bald frames were **8.424, 13.062 and 13.087 ms**.

The cost of fixed work, in milliseconds, scales with the clock the work runs at. **So a groom cost
quoted without its clock state is not a number.** But the hidden condition *is* a clock probe, and it
is already being sampled, so the yardstick is free:

```
REFERENCE_TOLERANCE = 0.02   two costs are COMPARABLE only if their hidden-frame p50s
                             agree within 2%
REPLICATE_TOLERANCE = 0.10   when they are comparable, the costs must agree within 10%
```

Against the prior runs this rule is testable now, before it is used: runs 2 and 3 have reference
frames **0.19% apart** and costs **2.3% apart** — comparable, and they agree. Run 1's reference is
**35% away**, so the rule refuses to compare it rather than averaging it in. That is the correct
call and it is the one every prior figure got wrong.

**Every reported cost carries its reference frame.** A cost without one is refused at print time.

## 4. The stimulus gate, restated because reading the wrong field cost a diagnosis

`assertArmRenders` was written to catch "nothing asserted the stimulus" and asserted it against
`report().hair`, a key that does not exist. It reported a fully attached groom as absent.

So the census here is read from the **live frame**, not from a page field:

```
CENSUS_FROM = renderer.info.render   drawCalls and triangles, DIFFERENCED across one step
```

- **Shown minus hidden** must be strictly positive in both draws and triangles. A toggle that
  changes no draw is not a toggle, and it would time as a perfect null.
- **Every null pair** must differ by exactly **0 draws and 0 triangles**. This is what makes N1–N3
  nulls rather than assertions: the identity of the picture is measured, not assumed.

⚠️ `info.render.drawCalls` and `.triangles` are **cumulative** on this page — under `?capture`,
`takeOverFrameLoop` stops the animation loop and `Animation.js:75` is the only caller of
`info.reset()`, so nothing ever clears them. They are read before and after one step and differenced.
The same freeze is why `info.frame` is constant and a burst's passes all land in one timestamp group.

## 5. The statistic, and why it is immune to the thing that broke the last one

Samples are **paired by tick**. The reported cost is the **median of per-tick differences**, not the
difference of medians.

That distinction is the whole repair. The prior failure was a bimodal clock-state mixture whose
proportions differed per arm, so two medians came from different states. Inside one tick both
members of a pair sit at the same clock, so the difference is taken *within* the state and the
mixture cancels rather than being conditioned on.

Reported beside it, and load-bearing:

- **Sign test** — the fraction of ticks where shown > hidden. This is mode-free: it does not care
  what the distribution looks like, only that the groom is on the expensive side of its own pair.
- **Bootstrap 95% CI** on the paired median, 10,000 resamples, seeded and recorded.

**A cost whose CI spans zero is reported as NOT RESOLVED**, never as its point estimate.

## 6. Bias controls

- **Within-tick order alternates by tick parity**, so `shown` and `hidden` each occupy the
  first-after-the-gap slot exactly half the time. The prior harness's fixed order was worth +1.77 ms
  of position effect between two captures of one configuration.
- **Arm rotation across ticks**, so no arm permanently owns a position in the cycle.
- **The bald page is a real arm**, not a reference constant, so N1 is measured every run.
- **Two hair pages at the same URL**, so N2 is measured every run.

## 7. What this round will and will not claim

**Will:** whether the instrument passes its own calibration; and if it does, the cost of the card
groom and of each ribbon density, each with its reference frame, its sign test and its CI.

**Will not:** a primitive decision. The decision rule is "parity with today's cards" and this
supplies the two numbers it needs; applying it is a separate step with its own registration.

⚠️ **And it will not claim the absolute frame cost is the shipped one.** The toggle measures a
*difference* honestly. The absolute figures are on a page under `?capture` with the animation loop
stopped, at whatever clock the machine offered, in headless Chromium — every one of which is a
reason the absolute is not the product's frame. **The delta is the deliverable; the absolute is a
yardstick.**

## 8. Change clause

- Any null failing §2 → **the round is void**. Not "flagged": the tool refuses to print costs.
- N1 failing specifically → **the primitive is invalid**, and §1's whole design is withdrawn rather
  than patched.
- Reference frames outside `REFERENCE_TOLERANCE` between two arms → those two arms are reported as
  **NOT COMPARABLE**, and no delta between them is printed.
- CI spanning zero → **NOT RESOLVED**.
- The five constants in §2–§3 moving after the first new sample → **the round is void.**

---

# Amendment 1 — a specification defect in §2's drift gate, and the rule that decides it

**Written at `e7e02c7`, BEFORE the deciding measurement is taken.** Ordering is checkable in git:
this amendment is committed on its own, and the analysis it authorises lands in a later commit.

## What happened

The first calibrated run (200 ticks, `cards` arm set) **voided itself**. All four nulls passed —
N1 reads +0.081 and −0.151 ms, so `visible = false` is measurably indistinguishable from a page that
never had a groom, and the primitive is licensed on hardware. N4 failed: `cardsA-`'s hidden p50 ran
13.078 → 12.821 across the run, a **2.00%** drift against a 2% ceiling.

## The defect

`REFERENCE_TOLERANCE` was registered for one job and then used for two:

1. **Cross-arm comparability.** Two arms measured against different clock states cannot be
   differenced. 2% is the right ceiling and it stays.
2. **Within-run drift, gating the PAIRED cost.** This is the misuse. **A paired statistic is
   drift-immune by construction** — both members of a pair are one frame apart, so a slow wander in
   the machine's clock is common-mode and cancels in the subtraction. Gating the paired cost on the
   reference's stability re-imports the very confound the pairing was built to remove.

Conflating them means the instrument refuses runs it is designed to survive.

## 🔴 The rule, fixed before the numbers are read

The claim "drift is common-mode, so the paired cost survives it" is testable **on the run that
already voided**, and it decides the amendment:

> Split the completed run into first, middle and last third. Compute the paired cost separately in
> each. The reference is known to have moved 2.00% across those thirds.
>
> - **If the three thirds agree within `REPLICATE_TOLERANCE` (10%)** — drift is demonstrably
>   common-mode, the paired cost is shown to be immune to it on real data, and the gate SPLITS:
>   `REFERENCE_TOLERANCE` continues to gate cross-arm comparability, and within-run drift becomes
>   **reported but not disqualifying** for a paired cost.
> - **If they disagree by more than 10%** — drift is NOT common-mode, the gate was right, and the
>   answer is a shorter run or a heavier warm-up. **The threshold does not move in this branch
>   either.**

Either way `NULL_MAX_MS`, `NULL_SIGN_Z`, `REFERENCE_TOLERANCE` and `REPLICATE_TOLERANCE` keep the
values registered above. This amendment changes **what the drift number disqualifies**, not what
counts as drift, and it is decided by a measurement rather than by preference.

⚠️ **Disclosure.** I have seen that the run voided and on which gate. I have **not** looked at any
cost from it — the tool computes costs into the JSON but refuses to print them when calibration
fails, and I have not opened that file. The rule above is written against that ignorance on purpose.
