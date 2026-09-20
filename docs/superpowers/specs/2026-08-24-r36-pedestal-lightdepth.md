# R36 pre-registration — the four-constants pedestal, on plates, level-matched, blind-judged

**Date:** 2026-08-24 · **Registered before any arm is rendered** · **Owner direction:** "Yes, run R36."
**Predecessor:** R35 (`2026-08-24-r35-chromatic-pedestal-ceiling.md`), whose arithmetic this round
turns into pictures. **Tool (to build):** `tools/critic/hair-pedestal-depth.mjs` · **Arm (to build):**
`?hairdefect=pedestal-lightdepth` in `packages/core/src/material/HairMaterial.js`.

## 1. What ships into the frame under test

A **defect arm** — graph-build-gated like every arm before it, shipped path byte-identical — that
feeds the *existing* Zinke form (`√C^(1+n)`, the `zinke-transmittance` branch, untouched) a **third
input source**: per-light constant events, matched to the incoming light direction by max-dot against
a table of light world positions. The constants are **measured, not authored** — R35's per-light
median ray-cast crossings on the portrait rig:

```
key    n = 0     (0.840208, 1.815226,  0.610447)   [key-shadow co-located, same entry]
fill   n = 1     (−0.620555, 1.511492, 0.739548)
rim    n = 26    (−0.138186, 1.643483, −0.310372)
kicker n = 11    (0.012610, 1.439804, −0.361090)
```

⚠️ These are **portrait-rig, bob01 constants**. A different preset or groom re-derives them from its
own ray cast. They live beside the arm with that warning, and nothing on the shipped path reads them.

## 2. 🔴 Level-matching is the round's load-bearing discipline

R35 measured the chroma gain at a **0.68× luma cost on the term**. Judged raw, the A/B would be
"darker and warmer" against "brighter and muddy" — two variables, the recorded eight-round mistake.
So, registered:

- The arm is captured across a sweep of its own pedestal scalar (`?ov=scatter:X` — the same term
  being changed, ONE free variable), and the **matched arm** is the X at which the hair-mask p50
  linear luma equals the shipped plate's within **±0.5%** (REQ-063's registered window, reused).
- The bisection is on luma alone and is blind to every colour statistic, by construction of the
  order of operations: match first, then score.
- **Only the matched arm is judged or scored.** The unmatched arm is reported for completeness and
  decides nothing.

## 3. Arms

| arm | what it is | role |
|---|---|---|
| `shipped` | the shipped path, no defect | baseline |
| `shipped-2` | the identical configuration, captured again at the end | drift control |
| `depth` | `?hairdefect=pedestal-lightdepth` | the effect, pre-match |
| `depth-matched` | same, at the bisected `scatter` scalar | **the judged arm** |
| `flat` | the same defect with **all four constants forced to their weighted mean** — light-blind by construction, level-matched by the same procedure | 🎯 **decoy**: if this scores like `depth-matched`, the per-LIGHT differentiation is not the cause and R35's decomposition is wrong on plates |
| `rim0` | `?ov=rim.irradiance:0`, no defect | the known ceiling on rim-pollution removal (R33: bit-identical to a full shadow on hair) — context, decides nothing |

## 4. Statistics — signed, and registered before any plate exists

On the hair mask, in linear, mass-weighted and p50 both:

- **Primary: fibre-axis-projected saturation** (`saturationTowardFibre`, the R35 operator — a violet
  gain scores negative). Gain of `depth-matched` over `shipped`.
- **Guard: R/B ratio** — must move toward warm (>1 direction), reported.
- **Skin control:** the same statistic over the skin mask — the arm touches only the hair material,
  so skin must move ~0; a skin move ≥ 20% of the hair move voids the round (mask or pipeline leak).

### Gates

```
G-LEVEL   the matched arm's hair-mask p50 luma within ±0.5% of shipped, or nothing is scored
G-DRIFT   shipped vs shipped-2 primary |Δ| ≤ 10% of the depth-matched effect, or the round is void
G-EFFECT  depth-matched primary gain ≥ +10% relative — a quarter-ish of R35's term-level +77%
          surviving dilution by the pedestal's ~65% share and the grade; below it the arm is
          reported as NOT CONFIRMED on plates and does not proceed to judging
G-DECOY   flat (level-matched) primary gain ≤ 30% of depth-matched's, or the cause is not the
          per-light differentiation and R35's decomposition is re-opened
G-SKIN    as above
```

## 5. The blind panel, only if every gate passes

Per `JUDGE-BRIEF.md` and `blind_ab.mjs`: `depth-matched` against `shipped`, plus a **null pair**
(`shipped` against `shipped-2`) as the decoy axis; the hypothesis is not named in the prompt; judges
must return crops and cite coordinates, per `judges-must-show-the-bar`. The panel answers the only
question arithmetic cannot: *does it look better,* on the axes the reference plates define (depth,
richness, the "muddy" complaint) — not merely more saturated.

## 6. What this round will and will not claim

**Will:** whether R35's mechanism survives contact with the full pipeline, level-matched, on the
judged plate. **Will not:** a shipped-path change — that is a separate decision on the panel's
verdict, owned by the owner; and no claim about other presets or grooms.

## 7. Change clause

Gates or constants moving after the first captured arm → void. G-DECOY failing → the finding is the
re-opened decomposition, reported as such. The blind panel's verdict is reported as returned,
including if it prefers `shipped`.

---

# Amendment 1 — the decoy as written cannot be level-matched, measured twice, re-derived once

**Written after the depth arm matched (X=1.7183, luma gap −0.010%) and before the decoy was
re-rendered.** Disclosure: the raw (unmatched) saturation numbers have been seen — base 0.8290,
depth 0.3523, rim0 0.8866 — and are in the capture log. This amendment touches only the decoy's
LEVEL mechanics; no gate threshold moves.

## The defect

§3 defined the decoy as the constants "forced to their weighted mean." Resolved to the arithmetic
mean (9.5) before capture; **measured: the pedestal is annihilated** (√C^10.5 ≈ 10⁻¹¹) and the
level-match bisection found p50 bit-identical at every scalar — the tool's pin-guard refused, as
built. The registration's other reading, the delivery-weighted mean (computed from R35's cache:
key 40.9% + key-shadow 25.7% at n=0, fill 16.3% at n=1, rim 16.3% at n=26, kicker 0.9% at n=11 →
**4.487**), also annihilates (√C^5.5 ≈ 3×10⁻⁶). **No mean-flavoured constant yields a readable
G-DECOY**, because the form is exponential and the mean of exponents does not preserve the mass.

## The re-derivation, by the property the decoy must have

The decoy exists to be **light-blind at the same level**. The constant with that property is the
level-equivalent events:

```
n* = ln( Σᵢ wᵢ · a^{nᵢ} ) / ln(a),   a = luma(√C) = 0.0736,  wᵢ = delivery shares above
   = ln(0.6775) / ln(0.0736) = 0.1492
```

**Strictness direction: harder, not easier.** At n = 9.5 the decoy was a strawman — trivially
different from the real arm. At n* = 0.1492 it is nearly the same machinery at the same level,
differing only in per-light differentiation — precisely the property under test. G-DECOY's ≤30%
share threshold is unchanged.
