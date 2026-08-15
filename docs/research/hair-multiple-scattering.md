# The multiple-scattering term: what it depends on, read from the literature

**Round:** R27 literature read, 2026-08-14. **Owns nothing in the tree.** Follows the five-source
platform sweep of the same day (`docs/research/source-sweep-2026-08-14.md`), which returned five
clean zeros and concluded the blocker needed hair-fibre shading literature rather than platform
sources. This is that read.

**Question:** R26 measured the slide-39 fake at 59.03% of hair mass and 87.39% on the crown, with
R's p99 over 207,947 hair pixels at 6.80e-2 against a mass mean of 6.78e-2 — **a ratio of 1.00**
(`docs/CHECKPOINT.md` §9). A blind judge: *"there is no lobe"*. Two hypotheses were put: (A) the
pedestal is flat where physics says it must be depth-dependent; (B) `sqrt(albedo)` is qualitatively
backwards for saturation.

## 🎯 The headline: BOTH HYPOTHESES ARE WRONG AS STATED, AND THE REAL DEFECT IS SHARPER THAN EITHER

The literature says Karis' fake keeps the *colour* half of the physical global term and discards the
*energy* half. Measured on our own shipped sheets:

| | drives the LEVEL | drives the CHROMA | coupled? |
|---|---|---|---|
| Zinke Eq. 4–5 (physical) | `T_f = d_f · ∏ā_f` | `T_f`, same product, per channel | **YES — one variable, `n`** |
| Karis slide 39 (ours) | `wrap = (n̂·ω_i + 1)/4π` — geometry, achromatic | `(C/Luma)^(1−Shadow)` — a baked atlas texel | **NO — two independent inputs** |

🔴 **Hypothesis (A) is REFUTED for chroma.** The pedestal is *not* flat. Measured over the 501,440
texels the shader actually shades, the chromaticity exponent spans **0.5117 → 1.4324 at p05/p95 —
96.9% of the 0.9502 the term is built to traverse.** The depth machinery is present and working.

🔴 **Hypothesis (B) is REFUTED as stated.** `sqrt(C)` is not the term's colour model. It is the
**Shadow = 1 boundary value** of a term whose per-channel chromaticity exponent is `1.5 − Shadow`.
Reading `sqrt` in isolation reads one endpoint as the whole function.

🎯 **What is actually wrong: the term is ISOLUMINANT.** Swept over its entire Shadow range on the
shipped albedo, slide 39's term moves **C\* from 8.11 to 28.19 — a factor of 3.48 — while L\* moves
32.59 → 34.05, a rise of 1.46 (+4.5% of L\*, +9.3% in relative luma) and in the WRONG DIRECTION:
brighter as it deepens.** Zinke's `T_f` over a comparable depth range **darkens by a factor of
10.7** while chroma rises. Karis' fake has **no magnitude attenuation with depth at all** — the
`C/Luma` division is precisely what removes it.

**A floor that cannot get darker anywhere is a floor no lobe can peak through.** That is R26's
p99/mass = 1.00, stated as a mechanism.

---

## 1. What the global multiple-scattering term is a function of, physically

**Zinke, Yuksel, Weber & Keyser, "Dual Scattering Approximation for Fast Multiple Scattering in
Hair", ACM TOG 27(3) (SIGGRAPH 2008).** Section and equation numbers below are the paper's own;
page numbers are the preprint's (`cemyuksel.com/research/dualscattering/dualscattering.pdf`).

The multiple-scattering function splits (§3, Eq. 3, p. 3):

```
Ψ(x, ω_d, ω_i) = Ψ^G(x, ω_d, ω_i) · [ 1 + Ψ^L(x, ω_d, ω_i) ]
```

The **global** term (§3.1, Eq. 4, p. 4) is a product of a transmittance and a spread:

```
Ψ^G(x, ω_d, ω_i) ≈ T_f(x, ω_d) · S_f(x, ω_d, ω_i)
```

**The variables, named (§3.1.1, Eq. 5, p. 4):**

```
T_f(x, ω_d) = d_f(x, ω_d) · ∏_{k=1..n} ā_f(θ_d^k)
```

- **`n`** — the number of scattering events (fibres crossed) along the **shadow path** from `x`
  toward the light `ω_d`. This is the depth variable. Eq. 5's note: when `n = 0` the point is lit
  directly and `T_f = 1`.
- **`ā_f(θ_d)`** — the average forward-scattering attenuation, Eq. 6, p. 4: the front-hemisphere
  integral of the fibre BCSDF under isotropic irradiance along the specular cone. **Per channel**,
  and bounded by 1.
- **`θ_d^k`** — the longitudinal inclination at the *k*-th event.
- **`d_f`** — a density factor for the fact that `x` may not sit inside a dense cluster (Fig. 4,
  p. 4). §3.1.1 and §6 both state the shipped value: **0.7**, useful range 0.6–0.8, and §6 calls it
  the only user-adjustable term in the whole method.

The **spread** (§3.1.2, Eq. 7–8, p. 4) is also a function of `n`:

```
S_f = [ s̃_f(φ_d, φ_i) / cos θ_d ] · g( θ_d + θ_i , σ̄_f²(x, ω_d) )
σ̄_f²(x, ω_d) = Σ_{k=1..n} β̄_f²(θ_d^k)                              (Eq. 8)
```

`s̃_f` is `1/π` forward, zero backward — the azimuthal spread is treated as **constant**, because
forward-scattered radiance goes nearly isotropic azimuthally after a few events. The longitudinal
variance **accumulates linearly in `n`**: deeper fibres are lit by a *wider* lobe. At constant
`θ_d` this is one multiply, `σ̄_f² = n · β̄_f²`.

The **local** term (§3.2, Eq. 9–10, pp. 4–5) is deliberately *not* a function of `x`:

```
Ψ^L · f_s ≈ d_b(x, ω_d) · f_back(ω_i, ω_o)
f_back = (2/cos θ) · Ā_b(θ) · S̄_b(ω_i, ω_o)                        (Eq. 10)
Ā_b = Ā_1 + Ā_3,   Ā_1 = ā_b ā_f²/(1−ā_f²),   Ā_3 = ā_b³ā_f²/(1−ā_f²)³   (Eq. 11, 13, 14)
```

§3.2 states it plainly: `f_back` is **modelled as a material property**, a function of the
difference angle `θ` and the fibre's own `ā_f`, `ā_b` alone. So in dual scattering, **all spatial
variation lives in the global term, through `n`.** The local term is a constant lookup.

> **This is the answer to the question the round asked.** The global term is a function of the
> number of fibres between the shading point and the light, and of nothing else spatial. It is
> per-channel, multiplicative, and monotone decreasing in depth.

**Corroboration that this is the standard, not one paper's opinion:** d'Eon et al. EGSR 2011 §7
computes its multiple scattering with dual scattering; Frostbite 2019 slide 26 does the same; and
Chiang et al. EGSR 2016 uses it as the comparison baseline in Figure 1.

---

## 2. Is the multiply-scattered colour MORE or LESS saturated? — settled, three sources agree

**MORE saturated, and simultaneously DARKER, as depth increases.** Three independent primary
sources say so, and the arithmetic of Eq. 5 forces it.

**(a) Zinke, arithmetically.** §4.1.3, p. 6 states the GPU implementation stores `T_f` and `σ̄_f`
**for each RGB colour channel** (7 values per map pixel, with the direct-illumination fraction). So
`T_f = d_f · ā_f^n` is a per-channel product. Writing the channel ratio:

```
T_f,R / T_f,B = ( ā_f,R / ā_f,B )^n
```

The ratio is raised to the power `n`. **Chromaticity sharpens geometrically with depth** while luma
falls as `ā^n`. That is Beer–Lambert, and it is unbounded in both.

**(b) Chiang et al., EGSR 2016, §4.2 — the clearest statement in the literature.** Describing how
azimuthal roughness acts like a phase function: lower roughness means more forward scattering, and
the volume appears *more dark and saturated* with light absorbed deeper; higher roughness means
more back scattering, and the volume appears **"brighter and less saturated."**

That is the exact pairing. Brightness and saturation are **anti-correlated** and both are set by how
deep the light gets.

**(c) Frostbite 2019, slide 24 notes.** Multiple scattering is described as what produces realistic
colour saturation and a sense of depth and volume — and the A/B movie is described as looking *more
saturated* with it on.

### 🎯 So what does this say about our judges?

Six blind judges — three on our render, three on an unrelated renderer — said the same sentence:
*"it desaturates toward grey as it lightens instead of warming toward copper."* **That sentence
describes a real defect and the literature backs it.** But it is **not caused by the `sqrt`.** It is
caused by lightness and chroma being driven by two independent variables in our term, so they
cannot co-vary at all — where physics locks them together with one.

### Does Karis justify the `sqrt`? — NO. Read directly off the deck.

**Slide 39** (read as an image; `pdftotext` returns speaker notes only, as our own
`HairMaterial.js` header warns). The slide carries three lines and the attribution
**[Driancourt 2012]**:

- *Fake normal:* `n = (ω_r − u(u·ω_r)) / ‖ω_r − u(u·ω_r)‖`
- *Shadowing is exponential falloff from shadow map value*
- *Absorption over direct light path using shadow for path length:*

```
S_scattering = √C · ( (n·ω_i + 1) / 4π ) · ( C / Luma )^(1 − Shadow)
```

**The slide names what the third factor is for — absorption over the direct light path — and says
nothing whatever about the `√C`.** Nor do the speaker notes, which describe only "a wrapped
Lambert, and an absorption based on the direct light path length", derived from the exponential
shadow value, and then concede the whole thing is **"a giant artistic hack and not physically based
in the slightest"**, derived by looking at photos rather than ground-truth renders.

> **Verdict on hypothesis (B): `sqrt` is undefended in the source — Karis offers no energy argument
> and no colour argument. But it is also not the defect.** It is the `Shadow = 1` endpoint of a
> depth-dependent chromaticity ramp, and criticising it alone mistakes an endpoint for the function.

### ✅ Our citation IS faithful

`HairMaterial.js:1640-1649` writes the formula as
`S_scatter = √C · (n·ωi + 1)/4π · (C / Luma(C))^(1 − Shadow)` — **digit for digit slide 39**, and
the TSL at `:2296-2299` implements exactly that. The docstring's gloss — that as `Shadow` falls the
result is pushed toward the hair's own chromaticity — is correct, and it **already flags the
substitution**: that `Shadow` comes from the baked bundle-depth sheet rather than from a shadow map
we do not have. No correction is owed to the citation.

✅ **And `HAIR_DEFAULTS.scatter` is Karis', not ours.** Slide 43 ("Artist parameters") lists
**Scatter — scales multiple scattering term** alongside BaseColor as `C`, Specular scaling R, and
the roughness/shift conversions `β_R = Roughness²`, `β_TT = 0.5 Roughness²`, `β_TRT = 2 Roughness²`,
`α_R = −2 Shift`, `α_TT = Shift`, `α_TRT = 4 Shift`. So CHECKPOINT §9's remark that *"Karis gives no
such scalar"* is correct **about `weightR`** and should not be read as applying to `scatter`, which
he does give.

⚠️ **One upstream sentence should be narrowed, though.** `docs/CHECKPOINT.md` §2 says the fake
broadcasts the albedo *"because its colour is `sqrt(colour)`"*. The measured b\* deficit stands; the
**attributed mechanism does not** — the colour is `√C · (C/Luma)^(1−Shadow)`, and §5 below measures
the second factor doing 96.9% of its designed work. Naming the endpoint as the cause is the same
shape as the eight structurally-blind statistics: a true measurement with a wrong operator behind it.

---

## 3. The cheapest published approximation that keeps the depth dependence

Three tiers exist in the literature, all with published expressions.

**Tier 1 — the full dual-scattering global term (Zinke §4.1.1, p. 6).** `ā_f(θ_d)` comes from a
**one-dimensional lookup table** precomputed by numerical integration of Eq. 6. Then:

```
T_f    = d_f · ā_f(θ_d)^n          d_f = 0.7
σ̄_f²   = n · β̄_f²(θ_d)             (Eq. 8, constant θ_d)
```

At constant `θ_d` that is **one 1-D LUT fetch, one `pow`, one multiply** — plus `n`. The paper's
Fig. 5 pseudo-code (p. 7) shows the whole shader; it is a small extension to an existing BCSDF
evaluation and it needs four precomputed tables (Table 1, p. 7: `Ā_b`, `Δ̄_b`, `σ̄_b²`, `N^G`).

**Tier 2 — Frostbite's shipping version (slide 27).** Deep opacity maps, 4 layers, plus 4 layers to
accumulate hair transmittance; the attenuation is averaged and stored into a LUT; the same maps also
do the shadows. This is a shipping real-time engine on console budget.

**🎯 Tier 3 — the cheapest, and Frostbite states it explicitly as its own fallback (slide 27
notes).** Estimate the attenuation using **a hair-density constant and the Beer–Lambert law** —
with the stated limitation, in their words, that it *"will of course not adapt with the actual
changes of the hair volume."*

That is the published cheap expression, and it is essentially free:

```
T_f(x, ω_d) = d_f · exp( −σ_hair · ℓ(x, ω_d) )        per channel
```

where `ℓ` is a path length through the hair volume toward the light and `σ_hair` a per-channel
constant. **This is what our code is already shaped to accept**: `HAIR_DEFAULTS.shadowDensity`
already turns a depth into `exp(−density · depth)`. What is missing is (i) making it **per channel**
and (ii) multiplying the term's **magnitude** by it rather than only its chromaticity exponent.

⚠️ **A stated limit, so this is not sold as a plan.** Tier 3 buys the level–chroma coupling. It does
**not** buy `σ̄_f²`'s lobe widening with depth (Eq. 8), and it does not buy the local term's
`f_back`. Frostbite calls it a *lower-quality* fallback and means it.

---

## 4. What each source uses as its per-fragment depth signal — and can ours supply it?

| source | depth signal | detail |
|---|---|---|
| Zinke §4.1.1 | ray shooting along `ω_d` | accurate, needs many samples/px |
| Zinke §4.1.2 | **forward scattering maps** — a voxel grid | stores `T_f`, `σ̄_f²`, direct fraction; 0.5 cm cells |
| Zinke §4.1.3 | **deep opacity maps** [Yuksel & Keyser 2008] | 4 layers, 8 textures, 7 values/pixel per RGB |
| **Karis slide 39/44** | **a light-view shadow map** | *"Shadowing is exponential falloff from shadow map value"*; slide 44: PCF-filtered with exponential falloff |
| Frostbite slide 27 | **deep opacity maps**, 4 layers | *"also used for shadows"*; Beer–Lambert constant as fallback |
| d'Eon §7 | inherits Zinke (dual scattering) | Renderman implementation |
| Chiang | none — path tracer | multiple scattering is simulated, not proxied |

**Every real-time source in this table derives the signal from the LIGHT'S VIEW.** Not one uses a
texture-space bake.

### 🔴 Ours is not a light-view quantity at all, and that is the structural finding

`HairMaterial.js:2122-2123`:

```js
const depth = nodes.depthMap === null ? float( 0 ) : nodes.depthMap.sample( uv() ).r;
this.shadow = depth.mul( nodes.shadowDensity ).negate().exp().toVar( 'hairShadow' );
```

`depth.png` is sampled at **`uv()` — the card's own texture coordinate.** It is one baked number per
atlas texel, generated per-texel by `tools/figure-pipeline/hair_texture.py`, and **shared by all 462
cards**. It therefore cannot vary with light direction, with head orientation, or with how many
*other* cards lie between this fragment and a light.

**Zinke's `n` counts fibres along the shadow path. Ours counts depth within one card's bundle.**
The signal has roughly the right *histogram* (§5 measures it) and the wrong *spatial referent* — it
is tiled across the head at card frequency rather than varying across the mass. Karis' slide 44 A/B
is exactly this failure mode: the same asset with shadows reads as dark volumetric hair, and without
them reads **blown-out, flat and near-white**. His notes: shadows are *"absolutely vital to the
look."*

### ✅ Could a shadow map we already render supply it? — PARTLY, with a hard limit

**Yes, mechanically.** The groom already casts into the key SpotLight's shadow map with a
per-fragment coverage decision at `HAIR_SHADOW_ALPHA_CUTOFF = 0.05`
(`packages/core/src/render/HairOIT.js:933`, wired through `maskShadowNode` into
`Renderer._getShadowNodes`). A light-view depth of the groom from the key direction **already
exists in the pipeline** and is the correct shape for Karis' `Shadow`.

⚠️ **But `docs/CHECKPOINT.md` §7 bounds what that buys, and the bound is severe.** three.js
`RectAreaLight` has no shadow code. At the forehead the key rect carries 27.00%, the fill rect
50.01%, and the shadow-casting key SpotLight **17.55%** — and §9 measured that on *hair* pixels the
RectAreaLights carry **66–73%**. So a shadow-map-derived path length would be available for the key
direction only, and the **single largest contributor — the fill — has no shadow map and cannot get
one from three's RectAreaLight**.

🎯 **This is why Tier 3 (Frostbite's Beer–Lambert fallback) is the right shape for us and the deep
opacity map is not.** A per-channel `exp(−σ · ℓ)` needs *a* path length, not *the* shadow map, and a
geometric estimate can be formed for lights that cast nothing. That is a finding about which tier
fits this rig, not a plan — and it should be measured before it is built.

---

## 5. The measurements taken this round, and one error caught in the taking

### 🚩 An arithmetic error was made and caught before it reached prose

The first version of the sheet measurement divided `decodePng`'s output by 255. **`tools/critic/png.mjs`
returns `pixels` as a `Float32Array` already normalised to 0–1.** The wrong version reported a
`Shadow` range of 0.9883–1.0000 and a chromaticity-exponent span of 1.17% — which would have
"confirmed" hypothesis (A) as a flat pedestal, in a note, with a table. It was caught because a
follow-up histogram printed self-contradictory output (`min 0 max 0` beside `top: 0:53.9%`), which
was checked rather than filed.

**Recorded because that is the ninth instance of the project's signature failure and the first one
caught by disbelieving a statistic that agreed with the hypothesis.** Both scripts below now open
with a validation block that refuses to print a table if its own arithmetic endpoints are wrong.

### Measurement A — what `Shadow` actually is on the shipped sheets

Over the **501,440 texels with albedo alpha ≥ 0.5** (the `alphaMode: MASK` cutoff the groom ships —
the atlas gutter is 53.9% of `depth.png` at exactly zero and counting it would drag every quantile
to the unshadowed endpoint):

| quantity | min | p05 | p50 | p95 | max |
|---|---:|---:|---:|---:|---:|
| baked `depth` | 0.0000 | 0.0039 | 0.2824 | 0.8980 | 0.9961 |
| `Shadow = exp(−3·depth)` | 1.0000 | 0.9883 | 0.4287 | 0.0676 | 0.0504 |
| chromaticity exponent `1.5 − Shadow` | 0.5000 | 0.5117 | 1.0713 | 1.4324 | 1.4496 |

⚠️ **Quantiles only, no mean row, deliberately.** `depth` has mean 0.3463, but `Shadow` and the
exponent are non-linear in `depth`, so `exp(−3 · mean depth) = 0.3538` is *the shadow at the mean
depth*, **not the mean shadow** — two different numbers, and printing the first under a "mean"
header is precisely the kind of operator this project has been caught by eight times.

**p05→p95 span = 0.9207, which is 96.9% of the 0.9502 the term can traverse.** The depth ramp is
alive and nearly fully exercised. Hypothesis (A) is refuted for chroma on this evidence.

### Measurement B — 🎯 the term is isoluminant

Slide 39's term evaluated on the shipped linear albedo `(1.05058e-2, 4.36057e-3, 3.83671e-3)`
(`HAIR_BASE_COLOUR_HEX = 0x1A0E0C`), with the achromatic depth-free `wrap` factored out:

| `Shadow` | exponent | relative luma | L\* | C\* | hue |
|---:|---:|---:|---:|---:|---:|
| 1.0000 (outer fibre) | 0.5000 | 1.0000 | 32.59 | 8.11 | 30.7 |
| 0.4287 (sheet p50) | 1.0713 | 1.0278 | 33.04 | 19.03 | 30.9 |
| 0.0000 (infinite depth) | 1.5000 | 1.0927 | 34.05 | 28.19 | 31.5 |

**C\* × 3.48. L\* + 1.46. Relative luma + 9.3%, and upward.** The `C/Luma` division is what does
this: it is a chromaticity operator by construction, so the whole depth dependence lands in hue and
chroma and essentially none of it in level. Note also `C/luma = [1.8663, 0.7746, 0.6816]` — **the
red channel exceeds 1**, so deeper hair gets *brighter* in red, which is where the +9.3% comes from.

### Measurement C — what Zinke's `T_f` does over the same depth range

`T_f = d_f · ā_f^n` with `d_f = 0.7` and `ā_f` built from d'Eon et al. EGSR 2011 §6.1's measured
eumelanin cross-sections `σ_a,e = {0.419, 0.697, 1.37}` as `exp(−k σ_a,e)`, `k` solved so the
per-fibre forward attenuation has luma 0.85 → `ā_f = [0.9048, 0.8467, 0.7211]`:

| `n` | relative luma | L\* | C\* | R/B ratio |
|---:|---:|---:|---:|---:|
| 0 | 1.0000 | 87.00 | 0.00 | 1.00 |
| 4 | 0.5296 | 67.33 | 24.30 | 2.48 |
| 8 | 0.2897 | 52.16 | 35.43 | 6.15 |
| 16 | 0.0932 | 30.70 | 38.70 | 37.80 |

**Luma falls by a factor of 10.7 while C\* rises from 0 to 38.70.** One variable does both.

⚠️ **`ā_f` here is a STAND-IN for Eq. 6, not Eq. 6** — the real `ā_f` integrates the whole BCSDF
including the Fresnel-reflected R lobe. It is used only to show the *shape*, and the shape is
analytic and does not depend on the choice: `luma ∝ ā^n` and `ratio = (ā_R/ā_B)^n`, both monotone
and unbounded in `n`.

🚩 **An earlier version of Measurement C built `ā_f` by normalising the albedo by its own luma.**
That puts the red channel at 1.8663 — an "attenuation" above 1 — and the table ran to L\* 615 at
`n = 32`. The script now refuses to print unless `0 < ā_f < 1` in every channel and `R > G > B`.

---

## 6. Licences — stated per source, because a patent killed one already

| source | readable | code released | licence / terms |
|---|---|---|---|
| **Zinke et al. 2008** (dual scattering) | yes, author preprint | **NO** | Author's page offers paper + two AVI videos only. Preprint carries "© ACM, 2008 … posted here by permission of ACM for your personal use. **Not for redistribution.**" **Read-only. Reimplement from the equations; do not copy text or figures into the tree.** |
| **Karis / Epic 2016** (slides 39, 44) | yes, `blog.selfshadow.com` course notes | UE source only, under the **Unreal Engine EULA** — not an OSI licence, and not compatible with this tree | Equations are published in a course deck for exactly this purpose. Already cited in `HairMaterial.js`. **Do not vendor UE source.** |
| **d'Eon et al. 2011** (EGSR) | yes, `eugenedeon.com/pdfs/egsrhair.pdf` | **NO** | © 2011 The Eurographics Association and Blackwell. ⚠️ **A patent search for a Weta filing on this model returned nothing — that is absence of evidence, not evidence of absence.** We already use only §6.1's cross-sections, which are measured constants, not a mechanism. |
| **Chiang et al. 2016** (EGSR / Disney) | yes, Disney publications page | **YES, indirectly and this is the useful one** | The model is implemented as `src/materials/hair.cpp` in **`mmp/pbrt-v3`, BSD 2-Clause** — permissive, attribution-only, compatible. Pharr's implementation note `pbrt.org/hair.pdf` documents it. **This is the only source in this read with usable reference code.** |
| **Frostbite 2019** (Taillandier & Valdes) | yes, `advances.realtimerendering.com/s2019/` | **NO** (EA proprietary) | Slides only. ⚠️ `Scthe/frostbitten-hair-webgpu` (**MIT**, already assessed in `CHECKPOINT.md` §3) is a third-party re-implementation — usable, but note §7's finding that three judges called its groom a cheap wig, so it is a **mechanism** source, not a quality bar. |
| **Yuksel & Keyser 2008** (deep opacity maps) | yes, `cemyuksel.com/research/deepopacity/` | **NO** | Paper + slides only. |

**Net:** exactly one usable reference implementation, `pbrt-v3` under BSD-2-Clause, and it is for
Chiang's *single-fibre* model plus its albedo inversion — **not** for dual scattering. Every
real-time multiple-scattering source here is read-only and must be reimplemented from equations.

---

## 7. 🎯 Chiang's albedo inversion — the shape of fix that makes an authored colour survive

This is the piece the round asked for by name, and it is the most directly actionable result.

**Chiang et al. §4.2, Eq. 9.** Artists want to specify the *multiple-scattering* colour directly, as
they would a surface albedo — §4.2 notes that the apparent colour of the hair volume does not relate
intuitively to the single-fibre absorption coefficient or its transmission colour. The mapping is
established empirically: render dense hair cubes under a white dome across a range of scalar `σ_a`,
measure the resulting multiple-scattering albedo `C` at the cube centre, repeat over azimuthal
roughness `β_N`, then least-squares fit the inverse:

```
σ_a = ( ln C / ( 5.969 − 0.215 β_N + 2.532 β_N² − 10.73 β_N³ + 5.574 β_N⁴ + 0.245 β_N⁵ ) )²
```

**Read the shape, because it is the answer to "where does a legitimate square root live?":**
inverting gives `C = exp( −f(β_N) · √σ_a )`. **The square root is on the ABSORPTION COEFFICIENT,
inside the exponent — not on the albedo.** That is the only `sqrt` the multiple-scattering
literature endorses, and it sits in a completely different place from ours.

**Two further statements worth having:**
- §4.2: the mapping holds across hair densities different from the one used to build it, because
  density acts as the scattering coefficient of a semi-infinite medium and changing it only scales
  path lengths without changing the resulting albedo — citing Zinke's own density-invariance result.
- §4.2/§4.1: `β_N` genuinely changes perceived colour, which is why the fit is 2-D. A colour
  inversion that ignores roughness will not land.

### Why this matters to us specifically

`HairMaterial.js`'s `HAIR_BASE_COLOUR_HEX` derivation already records the exact failure Chiang's
inversion exists to prevent: the physically correct pure-pigment transmittance `#280500` renders as
**hue 29.8°, C\* 44.30 — "a vivid rust head of hair, three times the reference's recorded chroma,
and unusable"** — and the file correctly diagnoses the cause as the slide-39 fake broadcasting the
albedo's chromaticity across the mass. **That is an authored colour failing to survive the
pedestal, which is exactly the problem §4.2 solves, in the direction Chiang solves it.** The 70.2°
hue rotation currently shipped is a hand-solve of an inversion the literature publishes.

---

## 8. What this read establishes, and what it explicitly does not

**Established, with citations:**
1. The physical global term is a per-channel product over `n` fibres along the shadow path
   (Zinke Eq. 5), which locks level and chroma to one variable.
2. Multiply-scattered hair is **darker AND more saturated** with depth — Chiang §4.2, Frostbite
   slide 24, and Zinke's arithmetic, three independent agreements.
3. Karis' fake reproduces the chroma coupling and **discards the energy coupling**; measured, its
   full-range lightness swing is +4.5% and wrong-signed against Zinke's factor of 10.7.
4. Our `Shadow` is a texture-space bake indexed by `uv()`, not a light-view path length — right
   histogram, wrong spatial referent. Every real-time source in §4 uses the light's view.
5. The cheapest published depth-preserving approximation is Frostbite's stated Beer–Lambert
   fallback; the full version is deep opacity maps.
6. Chiang Eq. 9 is a published albedo inversion, with BSD-2-Clause reference code in `pbrt-v3` for
   the surrounding model.

**NOT established, and no round should quote these as findings:**
- ❌ **Nothing here was measured on a rendered plate.** Measurements A–C are on the shipped
  *sheets* and on the *closed-form term*, not on pixels from `alive.html?hair=1`. The claim that
  level and chroma are decoupled **in the image** is a reading of the code's dataflow
  (`wrap` and `Shadow` have disjoint inputs), not a pixel statistic. **It needs a plate.**
- ❌ **No claim that fixing the coupling produces a highlight.** CHECKPOINT §2's trap stands: the
  scatter scalar moves the contrast ratio 2.92→7.97 while the plate's dynamic range moves
  3.000→1.223, *monotone in opposite directions*. A per-channel depth attenuation is a different
  operator from a scalar, but **it has not been shown to escape that trap** and must be checked
  against both statistics and a crop.
- ❌ **No claim the fill light can be given a path length.** §4 states it cannot from a shadow map.
  A geometric estimate is a hypothesis, unmeasured.
- ❌ The `ā_f` in Measurement C is a stand-in for Eq. 6, not Eq. 6.

### ⏭️ The one experiment this read argues for, stated as a measurement not a build

Make `Shadow` per-channel and put it on the term's **magnitude** as well as its exponent — Zinke's
`T_f` shape at Frostbite's Tier-3 cost — **using the depth signal already present**, and measure
whether p99/mass moves *while the plate's dynamic range holds*. The baked sheet is the wrong
referent but it is free, and it is a valid **null control**: if a per-channel magnitude attenuation
does not move the ratio even on a depth signal that spans 96.9% of its range, the pedestal is not
the lever and this whole line closes. **That is worth running precisely because it can return a
clean negative cheaply.**

---

## Appendix — the measurement scripts, verbatim

⚠️ **These are not `@claim`-tagged.** The convention in `tools/quoted-numbers.mjs` requires a
repo-relative `.mjs` producer, and this round owns nothing in the tree, so a tag here would name a
producer that does not exist — worse than no tag. **Every number in §5 comes from one of the two
scripts below; a successor landing this work should move them into `tools/critic/` and tag the
numbers then.**

Both were run against `assets/hair/bob01/{depth,albedo}.png` at HEAD on 2026-08-14 with
`HAIR_DEFAULTS.shadowDensity = 3.0`.

### A/B — `measure-shadow.mjs`

```js
import { readFileSync } from 'node:fs';
import { decodePng } from '<repo>/tools/critic/png.mjs';

const ROOT = '<repo>/assets/hair/bob01';
const SHADOW_DENSITY = 3.0;                       // HAIR_DEFAULTS.shadowDensity

const depth  = decodePng( readFileSync( `${ROOT}/depth.png` ) );
const albedo = decodePng( readFileSync( `${ROOT}/albedo.png` ) );

const shadowOf   = ( d ) => Math.exp( -d * SHADOW_DENSITY );
const exponentOf = ( d ) => 1.5 - shadowOf( d );   // sqrt(C)*(C/luma)^(1-S) ∝ C^(1.5-S)

// VALIDATION — refuses to report if its own endpoints are wrong.
// 🚩 decodePng returns a Float32Array ALREADY NORMALISED 0..1, not bytes.
//    Dividing by 255 a second time is what produced the discarded 1.17% result.
//    shadow(0)=1, shadow(1)=exp(-3), exponent(0)=0.5, exponent(1)=1.5-exp(-3).

// Restricted to albedo alpha >= 0.5, the alphaMode:MASK cutoff the groom ships.
// 53.9% of depth.png is exactly 0 and is atlas gutter; counting it is a
// structurally-blind statistic that drags every quantile to the unshadowed endpoint.
const hair = [];
for ( let i = 0; i < depth.pixels.length; i += 4 ) {
    if ( albedo.pixels[ i + 3 ] >= 0.5 ) hair.push( depth.pixels[ i ] );
}
// ... quantiles of depth, shadowOf(depth), exponentOf(depth) over `hair`.
```

### C — `zinke-shape.mjs`

```js
const SIGMA_AE = [ 0.419, 0.697, 1.37 ];   // d'Eon et al. EGSR 2011 §6.1
const D_F = 0.7;                            // Zinke §3.1.1, the paper's shipped density factor

// a_f = exp(-k * sigma_a,e), k solved so luma(a_f) hits a chosen per-fibre attenuation.
// VALIDATION — refuses to print unless 0 < a_f < 1 in EVERY channel and R > G > B.
// 🚩 Normalising the albedo by its own luma puts red at 1.8663 — an attenuation above 1 —
//    and the table runs to L* 615 at n=32. That version is discarded.

for ( const n of [ 0, 1, 2, 4, 8, 16, 32 ] ) {
    const Tf = af.map( ( a ) => D_F * Math.pow( a, n ) );   // Zinke Eq. 5, constant theta_d
    // ... luma(Tf)/D_F, and CIELAB L*, C*, hue of Tf
}
```

---

## Sources

- [Zinke, Yuksel, Weber & Keyser, *Dual Scattering Approximation for Fast Multiple Scattering in Hair*, ACM TOG 27(3), SIGGRAPH 2008](http://www.cemyuksel.com/research/dualscattering/dualscattering.pdf)
- [Karis / Epic, *Physically Based Hair Shading in Unreal*, SIGGRAPH 2016 PBS course](https://blog.selfshadow.com/publications/s2016-shading-course/karis/s2016_pbs_epic_hair.pdf) — slides 39, 43, 44
- [d'Eon, François, Hill, Letteri & Aubry, *An Energy-Conserving Hair Reflectance Model*, EGSR 2011](https://eugenedeon.com/pdfs/egsrhair.pdf) — §6.1, §7
- [Chiang, Bitterli, Tappan & Burley, *A Practical and Controllable Hair and Fur Model for Production Path Tracing*, EGSR 2016](https://media.disneyanimation.com/uploads/production/publication_asset/152/asset/eurographics2016Fur_Smaller.pdf) — §4.1, §4.2, Eq. 9
- [Taillandier & Valdes, *Strand-based Hair Rendering in Frostbite* ("Every Strand Counts"), SIGGRAPH 2019 Advances in Real-Time Rendering](https://advances.realtimerendering.com/s2019/hair_presentation_final.pdf) — slides 24, 26, 27
- [Yuksel & Keyser, *Deep Opacity Maps*, Eurographics 2008](https://www.cemyuksel.com/research/deepopacity/deepopacitymaps.pdf)
- [Pharr, *The Implementation of a Hair Scattering Model*](https://www.pbrt.org/hair.pdf) and [`mmp/pbrt-v3`, BSD 2-Clause](https://github.com/mmp/pbrt-v3)
