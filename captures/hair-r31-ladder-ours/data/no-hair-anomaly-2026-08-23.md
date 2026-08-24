# Why `no-hair` reads slower than cards — named

**Date:** 2026-08-23 · **HEAD:** `8630156` · **Data:** `data/frame-budget.json`, 384 samples/arm

`no-hair` read **13.007 ms** at p50 against cards' **9.019** — cards 3.99 ms *faster* than an empty
head. Adding a groom cannot make a frame cheaper. The stimulus was already verified (every arm's
census asserted before its samples counted), so this is a statistic problem, and it has a name.

---

## 1. Every arm is BIMODAL, and the modes are two GPU clock states

Two clusters per arm, fitted by 1-D k-means on the 384 samples rather than by eye:

| arm | fast mode | n | slow mode | n | **% in fast** | slow/fast |
|---|---:|---:|---:|---:|---:|---:|
| `no-hair` | 6.613 | 129 | 13.473 | 255 | **33.6%** | 2.04× |
| `hair` (cards) | 6.860 | 226 | 15.201 | 158 | **58.9%** | 2.22× |
| `ribbons-crop-8832` | 9.353 | 160 | 16.710 | 224 | 41.7% | 1.79× |
| `ribbons-bob-4960` | 8.943 | 271 | 17.456 | 113 | 70.6% | 1.95× |
| `ribbons-bob-11408` | 13.903 | 133 | 18.537 | 251 | 34.6% | 1.33× |
| `no-hair-2` | 6.446 | 111 | 13.474 | 273 | 28.9% | 2.09× |

The 1.33–2.22× separation is the boost-versus-base ratio `strand-time.mjs` already recorded
("the ratios cluster near 1.5x across every arm").

## 2. 🎯 Within each mode the sign is PHYSICAL. It is the MIX that differs

| | `no-hair` | cards | cards costs |
|---|---:|---:|---:|
| **fast mode** | 6.613 | 6.860 | **+0.247 ms** |
| **slow mode** | 13.473 | 15.201 | **+1.728 ms** |
| naive p50 | 13.012 | 9.039 | **−3.974 ms** ← non-physical |

**Cards costs more than no hair in both modes.** The p50 inverts only because 58.9% of the cards
samples sit in the fast mode against 33.6% of no-hair's, so the two medians are drawn from
*different clock states*. A median across a bimodal distribution whose mixture varies per arm is not
a comparable statistic — it reports which state the arm happened to sit in, not what it cost.

🎯 **AND THE PER-MODE STATISTIC IS EXTREMELY REPRODUCIBLE.** The control — the same configuration
captured at both ends of a shuffled arm order:

| | `no-hair` | `no-hair-2` | agreement |
|---|---:|---:|---:|
| fast mode | 6.613 | 6.446 | 2.5% |
| **slow mode** | **13.473** | **13.474** | **0.0%** |

Three decimal places on the slow mode. The per-mode cost is stable; the *mixture* is what varies —
28.9% against 33.6% for two captures of one configuration.

## 3. 🔴 The mechanism is DUTY CYCLE, and this harness reintroduced a design the ladder had refuted

`captures/hair-r31-ladder-ours/tools/strand-time.mjs:321-325`, written **before** `frame-budget.mjs`:

> The cause is duty cycle. […] the old inner loop then awaited `resolveTimestampsAsync` — a
> `mapAsync` round trip — before submitting again. The GPU spent as much time idle as busy and sat
> at its base clock, with the boost as a rare accident. […] **a harness that idles between frames is
> measuring its own latency's effect on the clock.**

`frame-budget.mjs`'s `takeSample` for `step: 'alive'` does exactly that — `await __SUGATA_STEP__(0)`,
then `await renderer.resolveTimestampsAsync('render')`, **per frame**. A `mapAsync` round trip
between every submission.

**And a lighter arm idles more.** `no-hair` submits less work per frame, so a larger share of its
period is the round trip, so it drops to base clock more often — 33.6% fast against cards' 58.9%.
The lighter arm therefore reports the *longer* frame.

⚠️ The file chose per-frame resolve deliberately, and its comment says why: burst-then-resolve
reported 315 ms because `resolveQueriesAsync` groups by frame id and a burst's 24 steps landed in
ONE group. **It fixed one defect by reintroducing the one the ladder had already solved**, and it
even computed the right answer while rejecting it — *"315.686 / 24 = 13.15 ms, exactly the magnitude
`alive.js`'s own header records."*

## 4. Measured: bursting compresses the anomaly

Burst N frames with nothing between them, resolve once, divide by N. Median of 6 reps:

| N | `no-hair` /N | cards /N | cards − no-hair |
|---:|---:|---:|---:|
| **1** (the shipped design) | 10.311 | 7.514 | **−2.797** |
| 4 | 13.438 | 9.970 | −3.468 |
| 8 | 13.147 | 10.106 | −3.041 |
| **16** | 13.221 | 12.175 | **−1.046** |
| 24 | 12.243 | 11.027 | −1.216 |

**The gap narrows from 2.8 ms to about 1.0 ms as the burst lengthens**, which is the duty-cycle
mechanism doing exactly what it should: sustained submission holds both arms in one clock state and
the artefact shrinks. `value/N` also converges (13.1–13.4 for no-hair), confirming the group is the
whole burst and the division is a valid per-frame mean.

⚠️ **IT DOES NOT FULLY INVERT AT SIX REPS.** Cards still reads ~1 ms low at N=16. Either that needs
more samples, or a second mechanism remains. **The duty cycle is named and confirmed as *a* cause;
it is not yet demonstrated to be the *only* one**, and saying otherwise would be the third confident
diagnosis of this harness in a day.

## 5. What to do

1. **Report per-mode, not per-percentile.** The clusters are clean, the per-mode control agrees to
   0.0%, and the sign is already physical. This is a change to the *reporting*, needs no re-capture,
   and would have made the existing 384-sample run readable.
2. **Then burst.** `burst` frames back to back, one resolve, divide by the group size — the ladder's
   design, with the division the file's own comment already derived. Removes most of the artefact at
   source rather than correcting for it.
3. **Do not reach for a different percentile.** `strand-time.mjs:317` says minima across arms quote
   different clock states; this shows the median does too. No percentile of a mixture fixes a
   mixture.
