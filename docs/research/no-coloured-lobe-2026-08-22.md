# The renderer has no active colour-carrying lobe, and that is "muddy"

**2026-08-22, material sha256 `09f748639e...` (byte-identical to `5bba1bb`).**

Reproduce every number here with:

```
node tools/critic/hair-af.selftest.mjs     # 14 of 14 clauses, expected values printed first
node tools/critic/hair-af.mjs              # the ā_f, ā_b, T_f and β̄_f tables
```

---

## 0. 🎯 The finding

The owner's word **"muddy"** — six blind judges across five rounds said *"it desaturates toward grey
as it lightens instead of warming toward copper"* — has been chased through slide 39's `sqrt(colour)`
for three rounds. It was never there.

**Our BSDF has three lobes and not one of them is currently carrying colour into the picture:**

| lobe | colour? | state |
|---|---|---|
| **R** | **cannot, by construction** | shipped, and it is 62% of the brightest luminance decile |
| **TT** | **yes — the coloured forward lobe** | 🔴 **`weightTT = 0`. SHIPPED OFF.** |
| **TRT** | yes — `C^(0.8/cosθd)`, the hair's own hue | 0.10% of the mass; retroreflective, and no light is near the view axis |

So the only thing tinting our hair is **slide 39's multiple-scattering hack** — and §3 below shows
physics says that term should be approximately zero. Every previous round tried to fix the colour by
adjusting the one term that had no business carrying it, because it was the only colour in the frame.

---

## 1. Each leg, verified against the source rather than inferred

**R is achromatic by construction.** `azimuthalValues( cosPhi, cosThetaD, dotIncidentView, colour )`
computes

```js
const r = 0.25 * cosHalfPhi * fresnelValue( Math.sqrt( Math.max( 0, 0.5 + 0.5 * dotIncidentView ) ) );
```

**`colour` does not appear.** This is not a defect — hair.md §1.3 read it off Karis slide 20:
*"The attenuation of R is pure Fresnel: it is achromatic and takes the light's colour."* Confirmed on
pixels too: R's per-term mean over 230,277 hair px is `(0.033135, 0.027239, 0.032148)`, **R/B =
1.0307**, saturation 0.1779.

**TRT is not in the forward hemisphere at all.** `distributionTRT = exp( 17·cosφ − 16.78 )`:

| direction | value |
|---|---:|
| straight-through transmission, `cosφ = −1` | **2.136e-15** |
| retro, `cosφ = +1` | 1.246 |

**TT is the forward lobe, and it is the coloured one.** `absorbTT = pow( colour, … )`, and
`distributionTT = exp( −3.65·cosφ − 3.98 )` evaluates to **0.719 at `cosφ = −1`** — it peaks exactly
where TRT vanishes.

🎯 **Therefore, with `weightTT = 0`, the forward hemisphere contains R and nothing else, and R has no
colour.** The quadrature confirms it independently: under reading B the shipped `ā_f` prints
**identically in all three channels to twelve digits**.

---

## 2. What that costs, in the units the round cares about

`ā_f` per channel at `θ_d = 0`, and the chromaticity sharpening `T_f.R / T_f.B` at `d_f = 0.7`
(⚠️ read all tables to **three significant digits**; `W_B` is a step function in Δ so midpoint
convergence is O(h) across it, and the selftest's V8 bar is deliberately 1e-3, not tighter):

| arm | `ā_f` (R, G, B) | R/B | `T_f` ratio at n = 7.55 |
|---|---|---:|---:|
| **shipped** (`weightTT = 0`) | 3.2047e-2 / 3.2010e-2 / 3.2006e-2 | **1.0013** | **1.0096×** |
| **tt-on** (`weightTT = 1`) | 1.1662e-1 / 8.7474e-2 / 8.4170e-2 | **1.3855** | **11.72×** |

**As the frame ships, Zinke's Eq. 5 delivers essentially no chromatic sharpening — 1.0096× — because
there is nothing chromatic in the integrand.** With TT on it delivers 11.72×.

Stated so it cannot be misread: the ratio is 11.6× larger on tt-on, and its *departure from neutral*
— the part that IS the effect — is **1112×** larger.

---

## 3. 🔴 And the pedestal should be approximately zero, which is a problem as well as an answer

`ā_f ≤ 0.131` everywhere, on every arm, at every `θ_d`, under both readings of `Ω_f`. So
`T_f = d_f · ā_f^n`:

| n | T_f (shipped arm) |
|---:|---|
| 1.189 — the shipped sheet input's recovered mean | 1.17e-2 |
| 4.751 — the envelope chord toward the key | 5.55e-8 |
| 7.55 — the card-crossing rate over five lights | **3.66e-12** |

**Zinke Eq. 5, evaluated over this project's own `f_s`, says the multiple-scattering term should be
twelve orders of magnitude below the smallest number in the frame.** `HAIR_DEFAULTS.scatter` ships at
1 and carries a measured **65.4%** of the groom's rise above its indirect floor.

🚩 **THIS IS NOT A LICENCE TO SHIP.** Replacing slide 39 with Eq. 5 does not dim the groom slightly —
**it deletes 65% of it**, and because `ā_f` is achromatic with TT off, it deletes the only coloured
thing in the picture while adding no colour back. That is the trap this document exists to prevent
somebody walking into next round.

---

## 4. ⏭️ Which fixes the ordering: TT comes BEFORE the pedestal

**The pedestal form change cannot be first.** On its own it removes 65% of the groom's energy and all
of its chroma. TT must be live before Eq. 5 has anything chromatic to sharpen.

### Why TT was switched off, and it was a measurement

`HAIR_DEFAULTS.weightTT`'s own comment: the rim is a `RectAreaLight` at **irradiance 16**, colour
**`#0f30ff`**, `shadowFraction 0`; three has had no rect-area shadow since issue #14161; so the rim
reaches cards in FRONT of the head at full strength, TT transmits it straight at the camera, and on a
near-black fibre the groom **renders blue** — frame mean 0.4195, *"a visibly violet-blue head of
hair."* Slide 47's `sideVisibility` cannot help: **it deliberately exempts TT.**

⚠️ **Verified still live at HEAD**: `LightingRig.js:611-613` is `irradiance: 16`, `colour: 0x0f30ff`,
`shadowFraction: 0`. §14's rim repair (`scales.rim.irradiance = 0.05`) applied to the **exterior
scenes only**, not to the base rig.

### 🎯 The machinery to fix it properly already exists, and R28 built it

R27 measured how deep each light sits behind the groom — card crossings between the fragment and the
light, per light:

| light | p10 | p50 | p90 | mean | pixels with a CLEAR path |
|---|---:|---:|---:|---:|---:|
| key | 0 | **0** | 1 | 0.76 | **76.66%** |
| fill | 0 | 1 | 5 | 1.99 | 49.45% |
| **rim** | 17 | **30** | 58 | **34.42** | **0.04%** |
| kicker | 5 | 17 | 52 | 22.65 | 0.33% |

**The rim is the most occluded direction in the groom by an enormous margin** — 0.04% of pixels have
a clear path to it, against the key's 76.66%.

And R28 built exactly the input this needs: a per-fragment, **per-light** geometric chord through a
fitted groom envelope, proven directional on pixels (71.36% of gated pixels move against a noise
floor of exactly zero) and against ground truth (Spearman **0.6118** versus the baked sheet's 0.0598).
It is reachable today at `?hairdefect=envelope-*` and is NOT shipped.

🎯 **So attenuating TT by `ā_f^n` along the envelope chord annihilates rim-lit TT (`n ≈ 34`) while
leaving key-lit TT (`n ≈ 0.76`) almost untouched.** That is the physically correct answer to the exact
defect TT was disabled for, it introduces no new constant, and every piece of it is already in the
tree.

### The ordering, therefore

1. **TT on, attenuated by the envelope chord per light.** Kills the blue at its cause rather than by
   switching off a lobe. Restores the only coloured forward lobe.
2. **Then Eq. 5 replaces slide 39**, with `ā_f` now chromatic, sharpening 11.72× with depth.
3. **Then** whatever fills the energy hole — REQ-064's near-axis light is the standing candidate,
   because it is also the only way to light TRT, the *other* coloured lobe.

Each step is one arm, A/B-able against the last, with a null control. **Do not collapse them.**

---

## 5. ⚠️ Two bounding properties of our BSDF, found in passing and both real

1. **`HAIR_DEFAULTS.weightTT = 0` means the shipped `ā_f` is an `ā_f` with the dominant forward lobe
   deleted.** Every "shipped" figure above is that, not a general property of hair.
2. 🔴 **The shipped BSDF has no `1/cos²θ_d`.** Marschner 2003 §4 writes `S = M_p N_p / cos²θ_d`;
   neither the CPU mirror nor the TSL twin carries the divisor. Priced as
   `ā_f(with divisor) / ā_f(as shipped)`, reading B: **1.02 / 1.70 / 5.58** at `θ_d` = 0 / 30 / 60°.
   A 2% question head-on, a factor of 5.6 at 60°. §3's verdict survives it comfortably (`ā_f` stays
   far below 0.6 at every angle), but it is an open defect and it is not this document's to fix.

---

## 6. What is NOT established

- **No plate.** Every number here is CPU quadrature over the mirror. `HairMaterial.selftest.mjs`
  holds that mirror to the shader's properties, which is not the same as being the shader.
- **`Ω_f`'s reading is bounded, not resolved.** Zinke never says whether the front hemisphere is
  fixed in the fibre frame (reading A) or relative to each incident azimuth (reading B). They differ
  by up to 12% on tt-on's `ā_f`. Both are reported everywhere. B is preferred **[I]** only because
  Zinke's own `s̃_f` is unambiguously relative.
- **`β̄_f`'s weighting is ours.** The paper has no defining equation for it (searched, absent). The
  `Σ_p ā_f,p β_p² / Σ_p ā_f,p` weighting is **[D]** and anything consuming it inherits that.
- **The four `n` values were taken as given** from the round's brief and not re-derived here. If any
  is wrong the whole `T_f` table moves.
- **No behavioural check against Zinke Fig. 8/13**, and there is no published `ā_f` magnitude
  anywhere to validate against — the validation is against arithmetic (V1–V8), because no literature
  value exists.
