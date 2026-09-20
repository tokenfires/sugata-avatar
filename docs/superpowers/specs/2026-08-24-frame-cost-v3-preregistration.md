# Pre-registration v3 — the narrowing

**Date:** 2026-08-24 · **Registered at:** `497acb3`, before any v3 sample · **Owner-approved:**
TK said yes to a v3 on 2026-08-24, after reading the plain-language summary of the three decisions.
**Tool:** `tools/critic/frame-cost.mjs` · **Supersedes:** v2 (`2026-08-24-frame-cost-v2-preregistration.md`, voided on G1)

v2 voided on G1 every time it ran. An adversarial pass over R34's own findings then proved G1
measures **effect size, not clock stability** — agreement falls monotonically as the real cost grows
(ρ = −0.835, p < 5×10⁻⁶ over 81 pairs), while identical-workload pairs hold 81–89% regardless. A gate
that grows more confident the measurement is invalid as the effect gets bigger is not a gate.

The same pass found the whole round's failures were **one defect in three places: a pooled statistic
used where a paired one was available.** §2's retracted headline (pooled p50 across pages), G1 (bins
a pooled quantity), and `REFERENCE_TOLERANCE` (pooled median of a mixture — across five identical
pictures the pooled spread is 29.7%, the slow-state spread 0.8%, and the ordering tracks fast share
exactly).

**v3 is therefore a narrowing, not a loosening: it deletes two uses of the pooled statistic and adds
nothing.** Every use of the paired statistic — which passed everywhere, every time — stands unchanged.

## 1. What is deleted, and what replaces it

### G1 (pair integrity by state binning) — DELETED as a gate

Replaced as a gate by nothing, because the thing it was guarding is already gated better: the nulls.
N1/N2/N3, adjudicated pooled **and inside each clock state** (v2's G0, kept), are an end-to-end proof
that the paired channel reads zero on pairs that are zero — including any contamination from pairs
that straddle a clock switch. If straddling mattered at the size G1 feared, the nulls would fail.
On the decorrelated schedule all twelve pass.

The quantity survives as a **reported diagnostic**: within-pair state agreement, plus the
workload-free version (`bald-bis` vs `bald`, identical picture). Reported so a reader can see the
machine's switching rate; deciding nothing.

### `REFERENCE_TOLERANCE` as a within-run comparability gate — DELETED

Two arms in one run are sampled on the **same ticks, interleaved, on one machine**. Their clock
context is shared by construction, and N2 — the *paired* test of exactly the question "are these two
pages' hidden frames the same" — passed 6 of 6. A pooled-reference rule refusing what the paired
null licenses is the defect, not a safeguard.

**Within one run, cross-arm deltas are licensed by N2 passing.** If any N2 fails, no cross-arm delta
is printed — that rule is stricter than the old one, because N2 carries a sign test the pooled gap
never had.

### Across runs — `REPLICATE_TOLERANCE = 0.10` KEPT, and it is the only cross-run rule

Two runs' figures for the same arm must agree within 10% to be quoted as one number. Otherwise the
**range** is quoted, never the mean. (Measured need: crop8832 moved −26% and bob11408 +19% between
the last two runs.)

## 2. The gates that decide (all carried over, none new)

```
NULL_MAX_MS   = 0.25      every null, pooled AND per clock state (G0)
NULL_SIGN_Z   = 3.0       likewise
STATE_MIN_PAIRS = 30      a state below this reports UNAVAILABLE, never a number
stimulus      shown-vs-hidden census strictly positive; every null pair exactly 0/0
physicality   a negative cost (pooled or per-state) whose CI excludes zero → the round is VOID
CI spanning zero → that cost is NOT RESOLVED, never its point estimate
```

Statistic unchanged: median of per-tick paired differences, sign test, seeded 10,000-resample
bootstrap. Schedule: the decorrelated (seeded-shuffle) schedule with `bald-bis`, already gated for
adjacency diversity in the selftest.

## 3. What a blessed run yields

Per arm: the paired cost, pooled and per clock state, each with CI, sign test, reference frame and n.
Cross-arm deltas within the run (the parity inputs). Nothing else — the parity *decision* remains a
separate step.

## 4. Change clause

- Any null failing, pooled or per state → **VOID**.
- Any census violation → **VOID**.
- Non-physical cost with CI excluding zero → **VOID**.
- Any constant in §2 moving after the first v3 sample → **VOID**.
- **If v3 voids, there is no v4.** The next move is a different instrument, not a fourth rulebook.

## 5. Disclosure

I have seen provisional numbers from every prior run, including the decorrelated-schedule run this
design is validated on. **v3 blesses only a fresh run.** The prior run's role is validation of the
*rules* (the nulls passed there), not a source of blessed numbers.
