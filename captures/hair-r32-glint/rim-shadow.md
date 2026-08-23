# The rim's shadow, measured on chroma — evidence for REQ-078's rejection and REQ-063's revival

**Date:** 2026-08-23 · **HEAD:** `b267b84` · **Plates:** `captures/hair-r32-glint/tt-*.png`
**Mask:** `hair-lightpath.mjs`'s gated groom mask, 236,792 px, the same one REQ-064 was decided on.
**Statistic:** `chromaInCodes` — the norm of a pixel's departure from its own grey, in 8-bit code
values, so it is zero for any grey at any lightness and its unit is the plate's unit.

⚠️ **THIS IS A LEAD, NOT A VERDICT.** One capture per arm, no pre-registration, no decoy, and the
skin control below is the only control that ran. It is recorded because it decided REQ-078, not
because it is sufficient to ship a rig change. A registered round gets the treatment REQ-064 got.

---

## 1. The arm nobody had run: TT on, with the rim actually casting a shadow

`shadowFraction` puts f of a light's authored irradiance into a co-located shadow-casting
`SpotLight` and (1 − f) into the `RectAreaLight`. `LightingRig.js`'s header tested
`rim.shadowFraction:0.5` and found it worth 0.9% of the groom's median — **but with TT OFF**, where
`sideVisibility`'s `saturate(wi·wr + 1)` already discards the rim for R and TRT. Nobody had run it
with the one lobe that occlusion exempts.

| arm | mean RGB | R/B | chroma (codes) | p50 linear |
|---|---|---:|---:|---:|
| TT off, shipped rim | `#5d3535` | 1.771 | 33.506 | 6.467e-2 |
| **TT on, unshadowed rim** | `#613c6e` | **0.886** | 53.859 | 8.368e-2 |
| **TT on, rim shadowed** | `#5e362f` | **2.019** | 36.363 | 6.532e-2 |
| TT off, rim shadowed | `#5d352e` | 2.022 | 35.998 | 6.379e-2 |

Three readings, and the third is the one that matters.

1. 🎯 **SHADOWING THE RIM KILLS THE VIOLET COMPLETELY.** R/B 0.886 → 2.019. This is the physical
   repair for the unshadowed-ness leg working exactly as predicted, and it is worth recording that
   the modelled occlusion succeeds where the envelope chord failed — §17 diagnosed the chord's
   failure as *"truth is bimodal, an ellipsoid is smooth"*, and a shadow map is bimodal.
2. ⚪ **AND TT IS STILL WORTH ALMOST NOTHING.** +0.364 codes over the shadowed rim alone.
   **§17's TT closure is CONFIRMED, not overturned**: when the occlusion is modelled, 91.21% of TT
   necessarily dies whatever colour it was.
3. 🎯 **THE SHADOW ITSELF IS WORTH +2.492 CODES OF HAIR CHROMA** — 33.506 → 35.998, with TT off and
   nothing else changed. That is **2.5× the 1.0-code visibility floor** registered for REQ-064, and
   it arrives with **luma FALLING 1.4%** (6.467e-2 → 6.379e-2). Level down, chroma up, which
   `docs/research/pedestal-look-2026-08-22.md` §4 says a scalar cannot produce.

## 2. The control: is the warming hair-specific, or is the frame warming?

Same statistic, same plates, over the skin rects `hair-lightpath.mjs` already defines (S1/S2/S3):

| population | px | R/B shipped → shadowed | chroma shipped → shadowed | Δ |
|---|---:|---|---|---:|
| **hair** | 236,792 | 1.771 → **2.022** | 33.506 → **35.998** | **+2.492** |
| skin | 3,745 | 1.355 → 1.349 | 42.109 → 41.272 | **−0.837** |

**The effect is hair-specific.** Skin does not warm; it drifts very slightly the other way. A frame
that were simply getting warmer would move both.

## 3. 🎯 Why it works — the rim is NOT an edge light on the hair

This is the mechanism, and it is why three rounds looking for a *hue* fix were looking in the wrong
place. The rim is an unshadowed `RectAreaLight` (three has had no rect-area shadows since issue
#14161) firing through alpha-blended cards, so its contribution is **a broad low-amplitude wash over
the entire groom**, not a band at the silhouette.

`LightingRig.js`'s own note — *"a light the gates could not see"* — is true of the FACE gates and
**false of the hair**. Hair is the one surface in the frame that reads the rim across its whole area,
because it is the one surface made of thousands of alpha-blended layers with no occlusion between
them and the light.

Measured on plates already committed at R31 — `hair-r31-shipcheck/portrait.png` against
`hair-r31-norim-ttoff/portrait.png`, the same query with `?ov=rim.irradiance:0`:

| | shipped | rim OFF |
|---|---:|---:|
| cool `[150,330)` at S > 0.10 | 6.80% | **0.00%** |
| mean saturation | 0.4497 | **0.5106 (+13.6%)** |

So **deleting the rim entirely buys the hair ~8–14% saturation**, and shadowing it buys +7.4% —
most of the benefit, **without losing the rim's separation function**. That is the whole argument
for `shadowFraction` over any recolour.

## 4. 🔴 And this separates two problems REQ-078 had fused

- **THE VIOLET OUTLINE IS 100% THE RIM'S.** Cool pixels go to zero when the rim goes. Real,
  localised, and a rig property.
- **"MUDDY" IS NOT THE RIM.** With the rim **deleted**, hair saturation still collapses as it
  lightens — 0.5237 whole groom → 0.3763 top decile → 0.3250 top 1%, **a 38% fall**. That is ACES
  over an achromatic R lobe with no colour-carrying lobe active, exactly as
  `no-coloured-lobe-2026-08-22.md` records. **No rim change touches it.**

The rim owns the outline and roughly 8–14% of the hair's chroma. The other ~38% is the BSDF and the
fibre — which is where REQ-064's refutation already landed.

## 5. 🚩 The process finding, which cost three rounds

**The ceiling plate for every possible rim intervention was already on disk and nobody looked at
it.** `captures/hair-r31-norim-ttoff/portrait.png` is the shipped hair query with the rim deleted.
It bounds what ANY rim change can buy, it has been committed since R31, and three rounds argued
about hue without opening it.

That is adjacent to the Verifier in `docs/critic-and-process-2026-08-23.md` §4.3 but distinct. Not
*"assert the stimulus is present"* — **"check whether this experiment has already been run."**

## 6. What a registered round still has to settle

1. **`shadowFraction: 1` moves ALL the rim's irradiance into a `SpotLight`**, which changes its
   specular character. The right value is a sweep, not the endpoint used here.
2. **The groom casts the shadow of its CARD QUADS, not its strands** — `alive.js:2555-2566` records
   the missing `alphaMap` on the depth material as a filed defect. So this over-occludes, and some
   of the +2.492 may be "killing the blue by killing the light". The 1.4% luma fall against a 7.4%
   chroma rise argues against that being the whole story; it does not settle it.
3. **A decoy.** REQ-064's azimuth-180 arm is what made its 0.1141 codes trustworthy. This has none.
4. **The gate cost.** `shadowFraction` is a parameter the rig already implements, so it is far
   cheaper than a recolour — but it is not free, and G1/G2/G7 have measured rim sensitivity.
