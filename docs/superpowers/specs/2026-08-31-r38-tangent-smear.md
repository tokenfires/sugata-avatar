# R38 pre-registration — the tangent-smear hypothesis: one defect behind the mud and the missing band

**Date:** 2026-08-31 · **Registered before any arm is rendered** · **Owner direction:** "Run R38."
**Predecessor:** R37, whose ledger measured R as the diluter (marginal −0.495, ~45% of the pixel's
light, own chroma 0.058). **Tool (to build):** `tools/critic/hair-band.mjs`. One page param is added
(`?hairjitter=`, the exact `?hairbeta=` pattern); no shader change.

## 1. The hypothesis, sharpened by what the record already closed

R37 §3 proposed "R's energy is spread flat instead of peaked." Recon against the record sharpens it,
because one reading is **already closed**: β_R ships at the **narrow end of Marschner's measured
band** (R26; `HAIR_BETA_R = 0.1745`, the green proof taking radiance p95/p50 from 1.872 → 6.030 with
the fake off). The longitudinal-width lever is exhausted within its sourced range — narrowing
further would invent a number, which this project refuses.

What is NOT closed: the **tangent field**. `strandTangentJitter = 0.2403 rad` (13.8° SD, per texel)
against a band whose own width is **5°** in Marschner's variable. A band narrow in *angle* is still
smeared across the *image* when the anisotropy axis itself scatters by ~2.8× the band width: every
card has some texels at band angle, so the band's image locus becomes a groom-wide speckle —
**an achromatic wash carrying ~45% of the light**, which is R37's measured diluter.

> **H: R's image-plane flatness is tangent smear.** Reduce the jitter and R's light re-concentrates
> into the band's locus — so the warm saturation of the body (R37's operator) and the dynamic range
> (the red gate's statistic) must **rise together**.

## 2. Arms

Base `bare&freeze&seed=1&capture&aa=msaa&grade=0`, portrait; the R37 mask machinery.

| arm | query tail | role |
|---|---|---|
| `full` | `hair=1` | shipped (jitter 0.2403) |
| `j000` | `hair=1&hairjitter=0` | smear removed entirely |
| `j006` | `hair=1&hairjitter=0.06` | quarter |
| `j012` | `hair=1&hairjitter=0.12` | half |
| `j036` | `hair=1&hairjitter=0.36` | 1.5× — the sweep must be able to move BOTH ways |
| `weight-half` | `hair=1&hairweightr=0.5` | 🚩 **decoy — the wrong lever.** The hypothesis says *shape*, not *weight* |
| `full-2` | `hair=1&hairscatter=1` | drift control, captured last |

## 3. Operators — all on the gated hair mask, scene linear

- **SAT** — the R35 signed fibre-axis saturation, mass-weighted (unchanged, fourth round running).
- **BAND** — radiance **p95/p50 of luma**: the red gate's statistic class, computed on THIS round's
  mask (the gate's own clause uses its own solid mask; the direction of movement is what this round
  registers, not the gate's absolute floor).
- **SCALE/SHAPE discriminator** (§9.4's, adopted): mass-mean luma. A *shape* change moves BAND while
  mass-mean stays within ±10%; a *scale* change moves mass-mean.

## 4. Registered predictions — falsifiable, both directions

```
P1 CO-MOVEMENT   over the five jitter arms (0, 0.06, 0.12, 0.2403, 0.36), SAT and BAND are both
                 monotone DECREASING in jitter (Spearman ρ = −1 on each, ties allowed only within
                 the drift floor). H is REFUTED if either breaks monotonicity beyond drift.
P2 DECOY         weight-half presents as SCALE, not shape: its mass-mean luma moves ≥ 10% while
                 every jitter arm's stays < 10%. If the decoy shows the joint SAT+BAND signature
                 at ~constant mass-mean, "shape" is the wrong frame and H is refuted by its control.
G-DRIFT          |Δsat| ≤ 0.005 and |Δ(p95/p50)| ≤ 2% between full and full-2.
G-MASK           the R33/R36/R37 mask gate.
```

## 5. Scope, provenance, and what this round may not do

`strandTangentJitter = 0.2403` is a **measured correction** — it restores strand-direction variance
the sheet's filter provably destroyed, and its docstring says "restoring it is a correction, not an
embellishment." **This sweep is a diagnostic that PRICES the correction's side-effect; it does not
license shipping a different value.** If H holds, the finding is a measured trade — decorrelation
bought at X saturation and Y contrast — and the *repair* (a jitter that decorrelates without
smearing the band axis, e.g. jitter applied off-band or per-strand rather than per-texel) is a
design question for its own round. No shipped constant moves in R38.

## 6. Disclosure

I have seen every number R36 and R37 produced, the β_R green proof (1.872 → 6.030), and the gate
texts quoted above. P1/P2 are registered before any R38 arm exists; the sweep values were chosen
from the band-width ratio (13.8°/5°), not from any captured plate.
