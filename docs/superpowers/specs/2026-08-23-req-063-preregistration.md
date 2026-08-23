# REQ-063 — pre-registration, written before the first arm is rendered

**Date:** 2026-08-23 · **Filed at:** `9766b1f`, tree clean · **Status:** REGISTERED, UNMEASURED

Written **before any arm below is captured**. Everything here is fixed. If the measurement wants a
different threshold afterwards the answer is a new registration for the *next* decision, not a
substitution here — `pre-registration-binds-the-registrant`, and the precedent is `f5d50d8`, where
a decision agent refused my own downward revision and was right to.

---

## 1. What is being decided, and why the obvious framing is wrong

`captures/hair-r32-glint/rim-shadow.md` recorded a lead: `?ov=rim.shadowFraction:1` is worth
**+2.492 codes** of hair chroma over the gated 236,792-px mask, hair-specific (skin −0.837), with
luma *falling* 1.4%. That killed REQ-078 and revived this entry.

**It is not sufficient to ship, and the naive question is the wrong one.** Three things reframe it:

### 1a. 🔴 `shadowFraction > 0` CREATES A SECOND SHADOW CASTER, AND THIS REPO PRICES ONE AT 2.62 ms

`buildUnit` returns early with `shadowCaster: null` unless `shadowsEnabled && shadowFraction > 0`,
so any non-zero value builds a `SpotLight` with a 4096² shadow map. `LightingRig.selftest.mjs`
measures the existing one:

> 1 shadow-casting light(s): key. Measured **2.62 ms each** at 1920×1080 on the real figure; four
> would be 9.11 ms on top of the area lights' 3.61, i.e. 77% of a 16.6 ms frame.

**2.62 ms is more than the entire groom costs** (1.870 ms at 1080p, the figure branch (b) rests on).
So this is a lighting change whose cost is measured in *whole groom budgets*, bought for a
hair-specific chroma gain. That has to be a gate, not a footnote.

### 1b. 🎯 DIMMING THE RIM IS FREE, AND IT ALSO REMOVES THE BLUE WASH

The mechanism established in `rim-shadow.md` is that the rim is an unshadowed `RectAreaLight`
washing the *whole groom*. But **turning the rim down also removes a wash**, costs nothing, and
`?ov=rim.irradiance:0` is already known to buy the hair ~8–14% saturation.

So the question that decides this is **not** "does shadowing help?" — it is:

> **Does shadowing beat simply dimming the rim to the same luma cost?**

If it does not, REQ-063 closes REFUTED and the answer to the rim's wash is a free constant, not a
2.62 ms caster. This is the registered primary gate.

### 1c. ⚠️ REQ-063'S OWN CHANGE IS A PAIR, AND ONLY HALF OF IT HAS EVER BEEN TESTED

The entry says: *"With a rim shadow, `HAIR_DEFAULTS.sideVisibility` goes to 0 and the largest single
term the model has stops being unreachable"* — and `LightingRig.js` adds *"the two changes have to
land together or neither is measurable."* `sideVisibility` is Karis' `saturate(wi·wr + 1)`, which
exists purely to discard the unshadowed rim for R and TRT. With a real shadow it is redundant, and
removing it is what unlocks R's near-backlight Fresnel peak — the CPU mirror puts R at 0.1128 sr⁻¹
at grazing against 0.0178 at retro, a factor of **6.3**.

`?hairvis=0` removes it. **The 2×2 is therefore the experiment**, and the lead only measured one
cell of it.

---

## 2. The arms

Mask: `hair-lightpath.mjs`'s gated groom mask — the eroded shipped-minus-bald difference cut against
the lobes-off plate at a threshold sitting in a measured empty band. Held constant across arms.

| key | query | role |
|---|---|---|
| `base` | shipped | baseline |
| `base-2` | shipped, captured again | **drift control** |
| `sf025` / `sf050` / `sf075` / `sf100` | `ov=rim.shadowFraction:<f>` | the sweep |
| `vis0` | `hairvis=0` | REQ-063's other half, alone |
| `sf100-vis0` | `ov=rim.shadowFraction:1&hairvis=0` | **REQ-063's full ask** |
| `dim-matched` | `ov=rim.irradiance:<E>` | 🎯 **THE CONTROL THAT DECIDES IT** — see §3 |
| `rim0` | `ov=rim.irradiance:0` | the ceiling: what deleting the rim buys |
| `decoy` | `ov=kicker.shadowFraction:1` | 🚩 **THE NULL** — see §4 |

## 3. 🎯 The matched-luma dim, and how its E is chosen

`dim-matched` must cost the **same luma** as the winning `shadowFraction` arm, so the two are
compared at equal darkening and the only difference is *whether the darkening is geometric*.

**Registered procedure, fixed now so it cannot be tuned later:** take the best `shadowFraction` arm
by §5's primary statistic; read its gated-mask **p50 linear luma**; then bisect `rim.irradiance`
over [0, 16] until the dimmed arm's p50 linear luma is within **±0.5%** of it; report the E found.
If no E in [0, 16] lands inside that window, the arms are not comparable and the gate is **void**.

## 4. 🚩 The null, and why the kicker is the right one

`kicker.shadowFraction:1` builds a caster on a light authored at **irradiance 0.07** — 0.4% of the
rim's 16. It exercises the *identical* code path (a `SpotLight`, a 4096² map, the same energy split)
on a light that cannot be responsible for the blue wash.

**If the decoy moves the primary statistic by more than half what the winning arm does, the
measurement is void** — the statistic would be reading "a shadow map was added" rather than "the rim
stopped washing the groom."

## 5. The statistic

**PRIMARY: mass-mean `chromaInCodes` over the whole gated hair mask.**

Chroma, for the reason `pedestal-look-2026-08-22.md` §3 gives and this phase has now paid for three
times — REQ-064 was assessed on brightness twice and REQ-063 once, and all three were "correctly
found small" by an operator that could not see the property in the complaint.

**Mass-mean rather than REQ-064's top decile**, and the reason is mechanical rather than
preferential: the defect is a *wash over the whole groom*, not a highlight. A decile statistic would
be the wrong population for this mechanism in exactly the way a whole-face mean was the wrong
population for a local curtain shadow. Top-decile is reported beside it; where they disagree, that
is a finding.

**REPORTED, DECIDING NOTHING:** R/B ratio, p50 linear luma, top-decile chroma, CIELAB C\*, and the
skin-rect control from `hair-lightpath.mjs`'s own `RECTS`.

---

## 6. The registered gates — all four must pass to ship

1. 🎯 **BEATS THE FREE ALTERNATIVE — the winning `shadowFraction` arm's chroma gain must be
   ≥ 2.0× the `dim-matched` arm's gain.** The factor is 2.0 for consistency with REQ-064's
   registered attribution gate; the *clause* is the point. A caster costing 2.62 ms must do
   something a free constant cannot.
2. **VISIBILITY — mass-mean chroma gain ≥ 1.0 code.** The 8-bit quantisation floor, grounded rather
   than picked: below one code value of the plate the change cannot be seen. Same floor as REQ-064.
3. **HAIR-SPECIFIC — the skin rects must move less than half what hair moves**, in absolute codes.
   A frame that is simply warming is not a hair fix.
4. **COST — measured, with two clauses:**
   a. The added GPU frame time must be **≤ 2.62 ms**, the measured cost of the caster the rig
      already pays for. A second caster that costs more than the first is a regression, not a trade.
   b. The seven portrait gates stay green. G1, G2 and G7 have measured rim sensitivity.

### The decoy null
Read **before** the gates. If `decoy` moves the primary statistic by more than half the winning
arm's movement, everything above is void regardless of gates 1–4.

### The drift control
`base` against `base-2`, one configuration captured twice. Their difference is the run's noise
floor, and **any gate delta smaller than it is not a measurement.** Read before the gates.

---

## 7. Registered outcomes

- **All four gates pass** → the winning `shadowFraction` ships, `HAIR_DEFAULTS.sideVisibility` is
  re-solved if the 2×2 says the pair is needed, REQ-063 moves to APPLIED, and the nine-scene table
  is re-baselined in the same commit.
- **Gate 1 fails** → REQ-063 closes **REFUTED**: the rim's wash is real and the fix is a free
  constant, not a caster. The `dim-matched` E is then filed as a proposed rim value and becomes an
  art-constant look-dev item (`critic-and-process-2026-08-23.md` §8), not a physics round.
- **Gate 4a fails alone** → **CONFIRMED-BUT-UNAFFORDABLE.** Recorded with the measured cost, and the
  entry says so rather than leaving a successor to rediscover a 2.62 ms bill.
- **Gate 2 or 3 fails** → REFUTED; the lead was noise or a frame effect, and `rim-shadow.md`'s
  single capture is retracted.
- **The 2×2 says `vis0` carries the effect and `shadowFraction` does not** → the finding belongs to
  `HairMaterial.js`, not to the rig, and REQ-063 is re-targeted.
- **Decoy moves, or drift exceeds a gate delta** → void; fix the instrument and re-register.

## 8. ⚠️ What this round does NOT settle, stated in advance

The groom casts the shadow of its **card quads, not its strands** — `alive.js:2555-2566` records the
missing `alphaMap` on the depth material as a filed defect. So every shadowed arm here
**over-occludes**, and this round cannot separate "correct occlusion revealed the fibre" from "too
much occlusion killed the blue". Gate 1 partially covers it — a dim that matches luma also kills
blue — but only partially. **If this ships, it ships with that caveat attached to the number.**
