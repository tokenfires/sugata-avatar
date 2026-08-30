# R35 pre-registration — the chromatic pedestal's CEILING, measured before any plumbing is built

**Date:** 2026-08-24 · **Registered before the probe runs** · **Owner direction:** "2 color"
**Tool (to build):** `tools/critic/hair-tf-ceiling.mjs`

## 1. Where the colour question actually stands, from the record

Every other route to "muddy" is closed by measurement: the rim (REQ-063/078: the muddiness is a
**38% saturation collapse that survives deleting the rim entirely** —
`req-063-refuted-2026-08-23.md` §8), the glint/TRT light (REQ-064 refuted: the slide-39 fake carries
88.8%), and TT (closed **geometrically**: 0.48% of visible fragments have a clear path to the rim, so
the transmission lobe has nothing to carry — `HAIR_DEFECTS['tt-envelope']`).

What remains is the **pedestal**: the multiple-scattering term carrying **65.4%** of the groom's
energy. The chromatic replacement already exists — `zinke-transmittance`,
`T_f = √C^(1+n)` per channel, which darkens as `ā_f^n` while its channel ratio sharpens
geometrically — and R27 refused it **for its input, not its form**: the shipped `n` comes from
`depth.png`, which is baked as `random.random()` per strand — *uncorrelated with truth, sign
backwards*. R28's geometric substitute (the ellipsoid chord) has the wrong *distribution* — smooth
where truth is bimodal — so everything saturates and the arm degenerates to a level-matched scalar.

**So the open question is not the form. It is: if the pedestal had a CORRECT per-light `n`, how much
of the 38% saturation collapse would the chromatic `T_f` recover?** A correct signal is expensive
(shadow-map path length, `render/**` plumbing, or a re-baked depth sheet). The ceiling is cheap:
the CPU ray cast that already adjudicated R28 produces the TRUE per-(pixel, light) card-crossing
count. Push the *true* `n` through the *existing* chromatic form on the CPU mirror and measure the
answer before building anything.

**If the ceiling is small, the pedestal line closes the way TT did — geometrically, for the cost of
a script — and "muddy" needs a different frame entirely.**

## 2. The probe

For a sampled set of visible hair pixels on the shipped portrait framing, per contributing light:

1. `n_true` = the CPU ray-cast card-crossing count from the fragment toward that light (the same
   cast R28/`tt-envelope` used; one card ≥ one event, so `n_true` is a floor and the ceiling errs
   **conservative**).
2. Pedestal contribution per channel, both ways, from the existing CPU mirror (`scatterValue`):
   - shipped: `√C · wrap · (C/luma)^(1−Shadow)` with the shipped sheet's `Shadow`
   - ceiling: `√C^(1+n_true) · wrap` (the `zinke-transmittance` branch, fed `Shadow = e^(−n_true)`)
3. Recompose the pixel's pedestal term under each and score the change.

No shader is modified. No plate is re-rendered. The lights' delivered irradiance comes from the
rig's own solved values, weighted per pixel exactly as the term weights them.

## 3. The statistic — SIGNED, because `pre-registration-binds-the-registrant` §6 of REQ-063 demands it

`chromaInCodes` is unsigned and scored a violet flood as the round's best arm. Registered here
instead:

- **Primary: saturation change projected onto the fibre's own hue axis** — 7.1° for
  `HAIR_BASE_COLOUR_HEX = 0x1A0E0C`. Positive = more saturated *toward the fibre's warm*; a gain in
  any other direction scores **negative**, not positive.
- Reported beside it, deciding nothing: R/B ratio, luma change (the form spends energy and chroma
  together — the level cost of the chroma gain must be visible), and the per-pixel `n_true`
  distribution per light.
- Mass-weighted over the hair-body mask (the muddiness lives in the body, not the highlight), p50
  and mass-mean both reported.

## 4. Gates, registered before the first number

```
G-BOUNDARY   with n_true ≡ 0 the ceiling branch reproduces the shipped branch exactly
             (hair-transmittance.selftest.mjs §B already asserts this to 1e-15 — reused, not rewritten)

G-DECOY      n_true SHUFFLED across pixels (white noise with the true marginal distribution — the
             shipped sheet's own failure mode) must yield a primary statistic ≤ 20% of the ordered
             signal's. If shuffled n buys what ordered n buys, the signal was never the blocker and
             R27's diagnosis is wrong — the probe must be able to find that.

G-CEILING    the decision floor: the primary statistic, mass-weighted over the body mask, must be
             ≥ ONE QUARTER of the named 38% collapse (≥ 9.5% relative saturation, toward the fibre)
             for the signal-plumbing round (shadow-map path length / re-baked sheet) to open.
             Below the floor → the pedestal line CLOSES, recorded like TT's closure, and the next
             frame for "muddy" is not a shading term at all.
```

**Derivation of the quarter:** the plumbing on the other side of this gate is a `render/**` round
plus a pipeline re-bake — the most expensive class of change left. A ceiling (which errs
conservative, see §2.1) that cannot promise even a quarter of the complaint does not buy that round;
a ceiling above it leaves the decision to the plates. The floor decides whether to *build*, never
whether it *worked* — that is a later, plate-judged round with its own registration.

## 5. What this round will not claim

No shipped-picture claim — this is arithmetic over a sampled subset with a perfect signal, i.e. an
upper bound. No `d_f` tuning (deliberately not applied; it is the one free variable R27 refused to
spend). No change to any shipped file.

## 6. Change clause

Gates move after the first probe run → the round is void. G-DECOY failing → the round reports
*that* as its finding (it would refute R27's own diagnosis, which is bigger news than any ceiling).
