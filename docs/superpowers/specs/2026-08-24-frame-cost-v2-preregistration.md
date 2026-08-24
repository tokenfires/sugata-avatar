# Pre-registration v2 — pairing a machine whose clock will not sit still

**Date:** 2026-08-24 · **Registered at:** `d131046`, before any v2 sample is taken
**Tool:** `tools/critic/frame-cost.mjs` · **Supersedes:** `2026-08-23-frame-cost-preregistration.md` (closed VOID)

v1 was written before the machine was understood, and it closed void: three runs, three refusals, no
cost reported. v2 is written from the measurement v1 produced instead of from an assumption about
hardware.

**What carries over unchanged, because it passed every time and changing it would be loosening:**
the self-difference primitive, nulls N1–N3, and all four of `NULL_MAX_MS`, `NULL_SIGN_Z`,
`REFERENCE_TOLERANCE`, `REPLICATE_TOLERANCE`.

**What is discarded:** the reference-stability drift gate, in its original and its permutation form.
Not because it failed — because the machine it was gating does not have the property it tested for.

---

## 1. The measurement v1 produced, which v2 is built on

Over 240 ticks on the bald reference:

| property | measured |
|---|---|
| state changes | **41** in 240 ticks |
| fast-state run length | median **2** ticks, max 4 |
| fast share | **17.5%** |
| fast p50 / slow p50 | **7.212 / 13.059 ms** — a **1.81×** ratio |
| **within-pair state agreement** | **229/240 = 95.4%** |

The clock is not settling; it is **switching**, in bursts a few ticks long, indefinitely. No warm-up
prevents that and no run length averages it away.

## 2. 🎯 What actually threatens a paired measurement, named and gated directly

v1 gated **reference stability**, which is a proxy, and a proxy this machine can never satisfy. What
a paired design requires is narrower and is directly measurable: **that both members of a pair sit in
the same clock state.**

So state membership becomes a first-class quantity rather than something the median is quietly
relying on:

1. **Classify every sample** into a clock state, with **one boundary fitted once on all pooled
   samples of the run** — never per arm. Fitting per arm is what made a control read −0.353 / +0.449
   in `frame-budget.mjs`: k-means puts the cut wherever that arm's own samples fall, so each arm's
   "fast mode" is a different slice of the clock's range and the means cannot be differenced. The
   states belong to the machine, so the boundary does too.
2. **Drop straddling pairs.** A pair whose two members are in different states carries a
   contamination of roughly the state gap — **~6 ms against a ~2 ms effect**. A median survives it;
   nothing removes it. Detected exactly, dropped exactly.
3. **Report per state, and pooled.** Two costs at two clocks, each with its own reference — which is
   what §3 of v1 asked for and could not deliver, because it was trying to hold the clock still
   instead of measuring within it.

## 3. The gates

### Carried over unchanged

```
NULL_MAX_MS         = 0.25    paired |p50| of every null
NULL_SIGN_Z         = 3.0     |p̂ − 0.5| ÷ (0.5/√n) for every null
REFERENCE_TOLERANCE = 0.02    when two costs may be differenced
REPLICATE_TOLERANCE = 0.10    how well they must then agree
```

### 🔴 New, and the first one is the gate on the new machinery itself

**G0 · the nulls hold PER STATE.** N1, N2 and N3 are adjudicated inside the fast state and inside the
slow state separately, against the same `NULL_MAX_MS` and `NULL_SIGN_Z`. **This is the gate that can
catch a wrong state classification**: if the boundary is misplaced, or the states are an artefact of
fitting, a null conditioned on them will show a bias that the pooled null hides. A new mechanism that
cannot go red is a decoration, and this is where it can.

**G1 · pair integrity.**

```
PAIR_INTEGRITY_MIN = 0.85    the fraction of pairs whose members share a state
```

Measured at 95.4%, so 85% is a floor with genuine headroom, not a rubber stamp. It fails if the
sampling tick ever becomes slow relative to the switching rate — at which point the measurement is
not paired in practice, whatever the code says.

**G2 · state population.**

```
STATE_MIN_PAIRS = 30    retained pairs required before a state's cost is reported at all
```

Below this a state is reported as **unavailable**, never computed. This is the gate `frame-budget.mjs`
learned the hard way when it printed a "slow mode" mean from a single sample and then differenced it.

**G3 · physicality.** Adding geometry cannot make a frame cheaper.

- A per-state cost that is **negative with a CI excluding zero** → **the round is void.** That is
  non-physical, so the instrument is at fault, and it is precisely what −3.974 ms was.
- A per-state cost that is negative with a CI **including** zero → **NOT RESOLVED**. Reported, not
  refused: a point estimate inside the noise is not evidence of anything, in either direction.

⚠️ G3 does not assume the answer. It refuses an *impossible* answer, and only when the interval says
the instrument means it.

## 4. The statistic

Unchanged from v1 §5 and still the repair: **median of per-tick differences**, sign test, and a
seeded 10,000-resample bootstrap CI. Now computed three times — inside the fast state, inside the
slow state, and over all retained pairs.

**A cost is reported with its state, its state's reference frame, and its n.** The pooled figure is
reported last and explicitly labelled as a mixture, because the mixture is a property of this run's
17.5% fast share and not of the groom.

## 5. What v2 will claim

**Will:** whether the instrument passes G0–G3; and if it does, the card groom's cost **in each clock
state**, and the same for each ribbon density.

**Will not:** a primitive decision, and no absolute frame cost. The toggle measures a difference
honestly; the absolute is a page under `?capture` with the animation loop stopped, in headless
Chromium, at whatever clock the machine offered. **The delta is the deliverable.**

## 6. Change clause

- Any null failing §3, pooled **or per state** → **the round is void.**
- Pair integrity below 0.85 → **the round is void**; the tick is too slow for the machine's switching.
- A state below 30 retained pairs → that state is **unavailable**; the other state still reports.
- A negative per-state cost with a CI excluding zero → **the round is void.**
- Any of the four carried-over constants, or the three new ones, moving after the first v2 sample →
  **the round is void.**

## 7. Disclosure

I have seen paired costs from v1's three voided runs. **They are not carried into v2**, which draws
its numbers from fresh samples only. What v2 inherits is §1's machine characterisation, because that
is a property of the hardware and not a result about a groom.

**And v1's amendment history is the reason §3 is stricter rather than looser.** v2 adds four gates
and removes one; the one removed is removed because the machine provably lacks the property it
tested. If v2 also fails, the answer is not a v3 — it is that this machine cannot resolve a 2 ms
effect, which would itself be the finding.
