# The pedestal sweep, LOOKED at — and the four adjectives split cleanly

> 🔴 **§1 OF THIS DOCUMENT WAS REFUTED THE SAME DAY IT WAS WRITTEN, BY A MEASUREMENT THIS ROUND
> COMMISSIONED. READ §1 AND §1a TOGETHER OR NOT AT ALL.** The "2.03× / 4.30× too bright" claim does
> not survive: `docs/research/hair-reference-2026-08-22.md` matched the masks and found our shipped
> median is **1.03×** the reference's, not 4.30×. §1 is kept whole rather than edited away, because
> the way it went wrong is the useful part — see §1a. Everything in §0 and §2–§6 is measured on our
> own plates alone and is untouched by the refutation.

**Measured 2026-08-22 at `49332d2`.** No new render, no new code, no GPU. Every plate and every
number below already existed on disk in `captures/hair-r27-pedestal/`.

Reproduce the whole of §2–§4 with one command:

```
node tools/critic/hair-pedestal.mjs --report --out captures/hair-r27-pedestal
```

---

## 0. 🎯 The finding, and it is a finding about METHOD before it is one about hair

R27 captured the scatter-scalar sweep on the **shipped graded path** — `trapg-s0` … `trapg-s4`,
full 720×900 plates, not debug arms — and reported it as percentile tables. **Nobody ever looked at
the pictures.** Every discussion of slide 39's pedestal across rounds 26–28 and CHECKPOINT §2, §9,
§10 and §11 is statistics: energy shares, p95/p50, Spearman, ceilings.

Looked at rather than tabulated, the sweep separates the owner's four words in one glance:

| his word | across the sweep |
|---|---|
| **wet** | moves **hard** — the pale milky wall becomes a mass with depth |
| **muddy** | moves **hard** — the mauve wash comes off |
| **blocky** | **does not move at all**, and becomes MORE obvious as the wash comes off |
| **low-res vs face** | **does not move at all** |

That is the primitive/pedestal split the round was designed around, arriving from a direction
nobody had used — and the plates cost nothing because they were already sitting in the tree.

⚠️ **This is NOT a recommendation to ship `hairscatter=0.25`.** hair.md §9.4 is right and stands:
a scalar *"moves the level and not the range"*, and `scatter` 1 → 0.25 is *"a brightness cut wearing
a contrast ratio."* The sweep is an **existence proof that the direction is right**, not the
mechanism for getting there. §4 is why the mechanism has to be a form change.

---

## 1. 🔴 The pedestal is necessary but NOT SUFFICIENT, and this corrects the round's opening premise

The design document opened on a comparison between hair.md §2.1's reference fringe and §9.2's
scatter sweep, concluding our median is 3.43× the reference's. **Re-run on the CURRENT tree** — the
sweep refreshed after `#1A0E0C` and after β_R shipped — the gap is worse, and the more important
number is what survives turning the term off:

| arm | p50 | p95 | p95/p50 | p50 vs reference |
|---|---:|---:|---:|---:|
| reference fringe (hair.md §2.1, n = 15,400) | 0.0532 | 0.2626 | **4.936** | 1.00× |
| ours, `scatter` 0 — pedestal ENTIRELY OFF | 0.1079 | 0.2859 | 2.650 | **2.03×** |
| ours, `scatter` 0.25 | 0.1419 | 0.3139 | 2.212 | 2.67× |
| **ours, shipped `scatter` 1** | **0.2288** | 0.3876 | **1.694** | **4.30×** |

Encoded luma, graded path, 230,277 solid hair px, one run.

🎯 **With the pedestal entirely removed we are still 2.03× too bright at the median and our dynamic
range is 2.65 against the reference's 4.94.** So the pedestal is roughly half the over-brightness
and roughly half the missing range, and something else is the other half. §3 and §4 name it.

⚠️ **The two caveats from the design document are NOT yet closed and this table does not close
them.** The reference figure is a fringe RECT against our whole-groom MASK, and a fringe is a
shadowed region while a groom includes the lit crown. Treat every "vs reference" cell as indicative
of direction and magnitude and not as a gate until the matched-mask re-measurement lands.

---

## 1a. 🔴 THE REFUTATION — the caveat above was the whole effect, and the rect is not even hair

The matched-mask re-measurement landed the same day (`tools/critic/hair-reference.mjs`,
`docs/research/hair-reference-2026-08-22.md`). It refutes §1's headline on two independent grounds.

**(i) hair.md §2.1's "fringe" rect is contaminated with SKIN.** Of the 771 pixels in the top 5% of
rect `[1480,540]-[1700,610]`, **616 lie in x ∈ [1520,1560]** and a further 141 in x ∈ [1660,1680] —
two tight blobs, not a distribution. The rect's own published p99 hex **`#96757e` (R150 G117 B126)
is lit forehead skin showing through the fringe tips**; the p99 pixel is at **(1544,591)**, inside
the left blob. Both the blob structure and the p99 identification were reproduced by an adversarial
verifier on an independent decode.

> 🔴 **TWO NUMBERS THAT FIRST APPEARED HERE ARE WITHDRAWN, AND ONE OF THEM WAS A CONCLUSION.**
>
> - *"769 of 771 lie below y = 570"* is **inverted**. The top-5% y-histogram is
>   `{550:2, 560:58, 570:97, 580:141, 590:192, 600:281}` — **711 of 771 lie at y ≥ 570**, and only
>   60 below it.
> - *"skin excluded, p95/p50 = 3.565"* is **not a skin-excluded number**. The contamination is
>   distributed in **X** (the two blobs above); that figure was obtained by cutting in **Y**, and a
>   6× crop shows the skin band running the full height of the rect. It is the same contaminated
>   rect with its bottom cropped off.
>
> 🎯 **So the reference fringe rect has no published hair-only dynamic range, and this document
> should not have implied one.** What the rect is worth is unknown until the mask is cut in the axis
> the contamination actually lives in.

**(ii) Fringe-versus-groom was the entire discrepancy.** The reference's OWN fringe-to-whole-hair
p50 ratio is **4.13**. On matched whole-hair masks:

| | reference | ours, shipped | ratio |
|---|---:|---:|---:|
| p50, encoded | 0.2195 | 0.2255 | **1.03×** |
| p50, encoded, conservative 25 px core | 0.2496 | 0.2255 | 0.90× |
| p95/p50, encoded | **2.965** | 1.716 | 0.58× |
| p95/p50, "as-if-ours" radiance | 4.65 – 5.17 | 1.977 | 0.38× |

🎯 **So our hair is approximately the RIGHT BRIGHTNESS at the median and roughly half the right
DYNAMIC RANGE.** "Too bright" is dead; "too flat" is real, and is the only half that ever mattered.

**What this does NOT touch, and it is most of the document:** §0's visual split, §2's saturation
deciles, §3's missing TRT, §4's level-down-chroma-up argument and §6's ordering are all measured on
our own plates against each other. None of them cites the reference. The refutation removes one
supporting number and leaves the thesis standing.

**And §9.2's real argument survives intact and is now better stated:** the reference's whole-hair
p95/p50 of **2.965 sits ABOVE every arm of our scatter sweep including `scatter` 0's 2.768.** No
setting of slide 39's scalar reaches the reference's dynamic range. That is hair.md §0.6's
floor-limited finding arriving with a matched denominator for the first time.

### 🚩 The mechanism of the error, which is worth more than the number

**The caveat was written and then the number was quoted in a commit headline anyway.** §1 states
plainly that a fringe rect and a whole-groom mask are different populations, marks every cell
"indicative … not a gate" — and `344e8f6` still led with "2.03x too bright". Writing a caveat is not
closing one. A number that needs a caveat to be read correctly will be quoted without it, including
by the person who wrote the caveat, inside a document about not doing that.

**Rule, for the round note:** a cross-artefact comparison is not quotable until its masks are
matched. Not "quotable with a caveat" — **not quotable.**

### ⚠️ A knock-on for hair.md §2.1a that is a correction, not a reversal

`#96757e` appears in §2.1a's table as one of **four** reference reads supporting the `#150F17` →
`#1A0E0C` rotation, on the argument that all four have R above B. **That one is skin.** The other
three (`#09040a`, `#120c10`, `#ab512f`) are hair and still carry R above B, and the physical
argument is independent and decisive: d'Eon et al. EGSR 2011 §6.1's melanin cross-sections make
`exp(−k·σa)` R > G > B at *every* concentration, so no melanin mixture produces `#150F17`.
**The albedo correction stands on three reads and a physical constant.** Its fourth citation should
be struck.

### ⚠️ And the reference's brightest hair is BLUE-dominant

Pixel (1530,410) on the reference's lit crown reads **R 78, G 82, B 111** — the brightest hair in
that frame is the same hue as the background behind it, which is why a colour-threshold hair mask
was impossible and the whole-hair mask had to be a hand-drawn polygon.

🎯 **That is R being achromatic and taking the LIGHT's colour, in the reference, exactly as §2 below
measures it in ours.** It also means "warming toward copper" is NOT a statement about the frontal
crown — §0.3's warm band is on the ponytail plate under teal practicals. Do not chase warmth in a
region the reference itself renders cool.

---

## 2. 🎯 What actually desaturates as it lightens — and it is not slide 39

Six blind judges across five rounds said the hair *"desaturates toward grey as it lightens instead
of warming toward copper."* R27 built the table that answers it and the answer is not the one the
complaint was filed against. Mass binned by its own luminance:

| decile | Y | sat(mass) | sat(pedestal) | **sat(R)** | pedestal share | **R share** |
|---:|---:|---:|---:|---:|---:|---:|
| 1 (darkest) | 2.693e-2 | **0.6171** | 0.7527 | **0.6393** | 81.32% | **8.96%** |
| 5 | 5.842e-2 | 0.5772 | 0.7735 | 0.2860 | 67.16% | 32.53% |
| 10 (brightest) | 1.246e-1 | **0.5072** | 0.7914 | **0.2039** | 35.60% | **62.42%** |

**The complaint reproduces exactly: 0.6171 → 0.5072.** And the mechanism is legible in the same
three columns:

- the **pedestal's** own saturation is flat-to-RISING across the range, 0.7527 → 0.7914. It is not
  the desaturating agent.
- the **R lobe's** own saturation COLLAPSES, 0.6393 → 0.2039, while its share of the pixel goes
  8.96% → 62.42%.

🎯 **A pixel is bright BECAUSE R dominates it, and R is achromatic by construction.** hair.md §1.3
read it off Karis' slide 20: *"The attenuation of R is pure Fresnel: it is achromatic and takes the
light's colour."* Measured on the plate, per-term mean linear RGB over the same pixel set:

| term | R | G | B | sat | R/B |
|---|---:|---:|---:|---:|---:|
| the pedestal alone | 0.084910 | 0.025174 | 0.018880 | **0.7776** | **4.4973** |
| the R lobe alone | 0.033135 | 0.027239 | 0.032148 | **0.1779** | **1.0307** |
| the shipped mass | 0.118247 | 0.054138 | 0.053792 | 0.5451 | 2.1982 |

**R/B = 1.0307 — R is achromatic on our plate to within 3%, exactly as the model says it must be.**

So "it desaturates as it lightens" is **the correct behaviour of the R lobe**, and the defect is not
that R greys out. The defect is what is missing beside it — §3.

🔴 **And this closes an open attribution.** CHECKPOINT §10 recorded hypothesis (B), *"`sqrt(albedo)`
is backwards"*, as REFUTED AS STATED, and the report confirms it from the other side: `√C` alone
does desaturate (0.4034 against the albedo's 0.6441), but the whole term at the measured median
exponent lands at **0.6763, ABOVE the albedo's own**. What `√C` does that nothing corrects is
**LEVEL** — its luminance is **13.1× the albedo's**. The pedestal's crime is brightness, not colour.

---

## 3. 🚩 The missing term is TRT, and it was downgraded under the wrong metric

The reference's highlight is **two lobes of different colours** — hair.md §0.3, measured on
`post_ms7/08.jpg`: the warm band peaks at saturation **0.373 in the HAIR's hue**, the cool band at
**0.182 in the PRACTICALS' hue**. That is Karis' model visible in a shipped frame: R is Fresnel and
takes the light, TRT is absorption `C^(0.8/cosθd)` and takes the hair.

hair.md §0.3's own conclusion, written before any of this: *"Author the two bands with different
tints or the hair will read as a plastic anisotropic surface."*

**"Plastic anisotropic surface" is the owner's word "wet", predicted in this repository five rounds
before he said it.**

Our TRT measures **0.10% of the mass** (CHECKPOINT §9), because `D_TRT = exp(17cosφ − 16.78)` is
retroreflective and the portrait rig has no light near the view axis. So we ship **only the
achromatic lobe**, and the one term that could put hair-coloured light into a highlight is absent.

🎯 **REQ-064 was assessed as a BRIGHTNESS lever and correctly found small. That was the wrong
metric.** R26 measured TRT reaching only 1.30% of a hair pixel even with the key on-axis and
concluded the gain "is NOT mostly TRT" — true, and irrelevant to this complaint. **The value of a
1.3% term that is the ONLY saturated hair-coloured highlight is not its energy share.** The
complaint is about colour, and it is the only term that carries any.

---

## 4. 🎯 Why the fix must be the FORM and cannot be the scalar — now visible on a plate

§2's per-term table has a consequence that the sweep makes visible: **the pedestal is currently the
only thing making our hair warm at all** (sat 0.7776, R/B 4.4973, against R's 0.1779 / 1.0307).

So a scalar cut takes the level down **and the chroma with it** — and that is exactly what the
plates show. `trapg-s0` reads neutral-to-cool black; `trapg-s0p25` reads warm dark brown. Turning
the pedestal off fixes the over-brightness and moves the warmth the WRONG WAY.

Zinke's per-channel transmittance does not have that trade-off, and the reason is arithmetic:

```
T_f = d_f · PRODUCT_{k=1..n} ā_f(θ_d^k),  stored PER RGB CHANNEL
  =>  T_f.R / T_f.B  =  (ā_f.R / ā_f.B)^n
```

Because `ā_f` is per-channel and blue is absorbed hardest at every melanin concentration (d'Eon
et al. EGSR 2011 §6.1, already load-bearing for the `#1A0E0C` correction), **the chromaticity
sharpens GEOMETRICALLY with depth while the level falls.** Level down, chroma UP — the one
combination a scalar cannot produce and the shipped form cannot either.

The report prints the endpoint of that direction on its own:

| | R | G | B | sat | R/B |
|---|---:|---:|---:|---:|---:|
| `√C`, what slide 39 uses | 0.101636 | 0.066268 | 0.060634 | 0.4034 | 1.6762 |
| `C²`, what Beer-Lambert does | 0.000107 | 0.000019 | 0.000014 | **0.8733** | **7.8943** |

**And that is "warming toward copper as it deepens", which is what six judges asked for.**

⚠️ Note the magnitudes in that second row. This is the annihilation R28 hit, and §5 is why it is
not obviously a refutation.

---

## 5. Where this leaves `ā_f`, stated as a live question and not an answer

R28 found Zinke's `√C^(1+n)` annihilates the pedestal at the card-crossing rate and named `ā_f` as
*"the next untested constant in this term… now the one that is obviously wrong."* Two readings
remain open and this document does not choose between them:

1. **`ā_f = √C` is simply the wrong quantity** — it is one TT path's attenuation at `h = 0`, not a
   forward-hemisphere average of the BCSDF — and the correct value is larger.
2. **The annihilation is right and the pedestal SHOULD be small for near-black hair**, which is what
   dual scattering exists to express, and it has been propped up by a gate that divides by a fixed
   albedo (hair.md §0.6, floor-limited with the floor in the numerator).

🔴 **§1's over-brightness evidence for (2) is WITHDRAWN — see §1a.** Our median is 1.03× the
reference's on matched masks, so there is no brightness surplus for a shrinking pedestal to explain
away. **Reading (2) loses its supporting measurement here** and now rests only on the physical
argument, which is genuinely strong but is not a plate.

⚠️ **And the annihilation itself is no longer evidence for either reading**, because it was computed
on a form that does not match the paper. Zinke Eq. 5 is `T_f = d_f · Π_{k=1..n} ā_f(θ_d^k)` —
exponent **`n`, with `d_f` outside the product** — while `HairMaterial.js` evaluated
`ā_f^(1+n)` at `ā_f = √C`. Both the base and the exponent were wrong. See
`docs/research/zinke-dual-scattering.md` and §7 below.

**The quadrature settles it, and it is running.** Both outcomes are useful; neither is assumed here.

---

## 7. 🎯 R28's annihilation was two errors stacked, and correcting them makes the term live

`HairMaterial.js:2274` argues the exponent is `1 + n` *"and the `1` is `Ψ^G`'s own scattering
event"*: `T_f` carries the light TO the shading point over `n` crossings, then it must scatter once
more to leave, and that exit traverse is Karis' own `√C`. **That reasoning is sound and it buys a
real design virtue** — at `n = 0` the probe returns `√C · wrap`, bit-for-bit what the shipped branch
returns, so the A/B is exactly zero on the lit boundary and every moved pixel is attributable.

🔴 **The error is narrower: it sets BOTH factors to `√C`.** That identification is the only thing
that collapses `√C · ā_f^n` into `ā_f^(1+n)`, and Zinke Eq. 6 refutes it — `ā_f` is a
front-hemisphere integral of the WHOLE BCSDF over 2π sr of outgoing directions and π rad of incident
azimuth, not one TT path at `h = 0`.

**So the corrected form keeps R27's entire argument and reads `√C · ā_f^n`.** Same `n = 0` boundary
property, the paper's exponent, and a derived `ā_f`. Evaluated with this repository's own stand-in
`ā_f = [0.9048, 0.8467, 0.7211]` (`hair-multiple-scattering.md`, Measurement C — flagged there as a
stand-in for Eq. 6, not Eq. 6):

| n | R28's `√C^(1+n)` | | corrected `√C · ā_f^n` | R/B |
|---:|---|---:|---|---:|
| 0 | 1.016e-1 / 6.63e-2 / 6.06e-2 | 1.68 | 1.016e-1 / 6.63e-2 / 6.06e-2 | 1.68 |
| 1.189 | 6.71e-3 / 2.63e-3 / 2.17e-3 | 3.10 | 9.02e-2 / 5.44e-2 / 4.11e-2 | 2.20 |
| 4.751 | 1.95e-6 / 1.67e-7 / 1.00e-7 | 19.5 | 6.32e-2 / 3.01e-2 / 1.28e-2 | 4.93 |
| **7.55** | **3.24e-9 / 8.36e-11 / 3.91e-11** | 82.8 | **4.78e-2 / 1.89e-2 / 5.14e-3** | **9.30** |

**R28's arm annihilates to 3e-9. The corrected arm is a live term** whose level falls 2.1× while its
channel ratio rises 5.5×, 1.68 → 9.30. **Level down, chroma up**, which is §4's requirement.

🎯 **And the DIRECTION is structurally guaranteed regardless of what the quadrature returns.** Any
correctly-derived `ā_f` inherits `ā_f,R > ā_f,G > ā_f,B` from the fibre it integrates, because
melanin absorbs blue hardest at every concentration (d'Eon §6.1). Only the RATE is in question.

⚠️ `d_f = 0.7` is still deliberately not applied, for R27's own stated reason: a constant multiplier
on the pedestal IS `HAIR_DEFAULTS.scatter`, and applying it would break the `n = 0` equality that
makes the A/B attributable. That decision survives the correction.

---

## 6. ⏭️ What this changes about the round's ordering

**Three of the four adjectives now point at the primitive, not at the shader.**

- **blocky** — the primitive. Three independent lines already (CHECKPOINT §4, §11, §14).
- **low-res** — the primitive. Alpha cannot carry a strand at this card size.
- **wet** — *half* the primitive. The pedestal drowns the lobe, but CHECKPOINT §9's forward finding
  is that **no width inside Marschner's band puts a single pixel above 4× R's own mean**, and R26
  measured removing the strand jitter, the flow sheet or the lock tilt as worth ≤0.02× each —
  *"which says the groom never turns into the lobe's peak rather than that the lobe is too wide."*
  🎯 **That is CHECKPOINT §2's eleven-millimetre cloud of cards at seven standoffs arriving on the
  specular side.** A narrow lobe integrated over a tangent distribution that wide comes out flat.
  A strand groom has coherent tangents along each fibre; a card cloud does not.
- **muddy** — the rig, via §3. The missing saturated lobe is TRT and TRT needs a near-axis light.

**So the spike is not one of two parallel tracks — it is the larger one**, and the pedestal work
buys the over-brightness and the warmth while the primitive buys the band, the hem and the
silhouette. Neither alone is the picture.

⚠️ The pre-registered decision rule in
`docs/superpowers/specs/2026-08-22-hair-frame-design.md` §2 is unchanged and must not be
renegotiated on the strength of this document. This shifts PRIORITY, not the rule.
