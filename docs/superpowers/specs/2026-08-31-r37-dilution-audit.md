# R37 pre-registration — the dilution audit: who pays for the mud, term by term

**Date:** 2026-08-31 · **Registered before any arm is rendered** · **Owner direction:** "Run the
dilution audit." **Predecessor:** R36, which closed every chroma-pump route and left one suspect
standing: **achromatic dilution** — R (~35% of the direct groom, achromatic by construction) and the
indirect composite (~10%, grey) pouring unsaturated light over a warm base.
**Tool (to build):** `tools/critic/hair-dilution.mjs`. No shader change; every arm is a shipped-path
URL toggle (`?hairlobes=`, `?hairscatter=`, `?gtao=`).

## 1. The question, precisely

Decompose the shipped hair pixel's **saturation budget**: for each term — R, TRT, the
multiple-scattering pedestal, and the indirect/GTAO composite — measure (a) its own chroma, in
isolation, and (b) its **marginal effect on the aggregate** warm saturation, by leave-one-out. The
output is a ranked dilution ledger: which terms buy warmth, which dilute it, and by how much.

## 2. Arms — all plate algebra on the shipped path

Base query `bare&freeze&seed=1&capture&aa=msaa&grade=0`, portrait, plus:

| arm | query tail | role |
|---|---|---|
| `full` | `hair=1` | the shipped pixel |
| `full-2` | `hair=1&hairscatter=1` | drift control (identical config, second spelling, captured last) |
| `floor` | `hair=1&hairlobes=&hairscatter=0` | indirect-only: every forward term off |
| `only-r` | `hair=1&hairlobes=r&hairscatter=0` | R over the floor |
| `only-trt` | `hair=1&hairlobes=trt&hairscatter=0` | TRT over the floor |
| `only-scatter` | `hair=1&hairlobes=&hairscatter=1` | the pedestal over the floor |
| `no-r` | `hair=1&hairlobes=trt` | leave-R-out |
| `no-trt` | `hair=1&hairlobes=r` | leave-TRT-out |
| `no-scatter` | `hair=1&hairscatter=0` | leave-pedestal-out |
| `no-indirect` | `hair=1&gtao=0` | leave-composite-out — ⚠️ `gtao=0` removes AO *and* the ambient split-sum together; the leave-one-out is of that bundle and is labelled so |

TT ships off and has no arm. Term isolation `term_i = linear(only-i) − linear(floor)` per pixel,
clamped at 0; its chroma is the term's own. Marginal effect `Δ_i = sat(full) − sat(no-i)` —
**negative Δ_i means removing the term RAISES warm saturation, i.e. the term dilutes.**

## 3. Statistics

The R35/R36 signed operator, unchanged: fibre-axis-projected saturation
(`saturationTowardFibre`, violet scores negative), scene linear, over the gated hair mask,
mass-weighted; R/B and luma beside it. Per-term: isolation sat, isolation mass share, marginal
Δ_i, and marginal luma share.

## 4. Gates — instrument quality only; this round makes no ship decision

```
G-MASK        the R33/R36 mask gate as always: eroded groom mask, floor-gated, separating band
G-DRIFT       |sat(full) − sat(full-2)| ≤ 0.005   (R36 measured 0.0000 on the same operator)
G-ADDITIVITY  mass-weighted | luma(full) − luma(floor + Σ only-i terms) | / luma(full) ≤ 5% —
              the decomposition must actually decompose; temporal-hash AA noise is the allowance
G-POSITIVITY  each isolation term's mass ≥ 0 within the drift floor
```

Any gate failing → the ledger is not read; the instrument is repaired or the round is void.

## 5. The reference half — STANDS DOWN, and says so

The dilution ledger's final clause — "does removing the achromatic dilution close the measured gap
to the reference?" — requires `overview_character.reference.png`, which is SHIFT UP / Sony
copyright, lives outside the repository by rule, and **is not on this machine today** (searched:
`reference/`, the session scratchpad, Downloads). That clause therefore stands down rather than
being approximated. The recorded 38% collapse (REQ-078's rejection, `docs/OPEN-REQUESTS.md:3054`)
is quoted as context only. If the owner places the reference beside the repo again, the clause runs
with: `node tools/critic/hair-dilution.mjs --reference <dir>` against the same registered operator.

## 6. Disclosure

I have seen R36's plate numbers (full-pixel sat 0.829, R/B 1.771, rim worth +7%) and the recorded
term energy shares (65.4 / 35.0 / 9.7). The gates above are instrument gates, not outcome gates,
and no outcome threshold is registered — this round RANKS, it does not pass/fail a hypothesis. The
one prediction on record, from R36 §3: R and the indirect composite will rank as the diluters. If
the ledger says otherwise, the ledger wins.

## 7. Change clause

Arms, operators, or gate constants moving after the first capture → void. A failed additivity gate
is reported as the finding (the decomposition model is wrong), not patched silently.
