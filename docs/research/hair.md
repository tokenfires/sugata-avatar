# Hair — verified research

Researched 2026-08-12. three.js claims checked against the **installed** source in
`node_modules/three` at **r185** (`three@0.185.1`, verified from its own `package.json`), not
against docs, memory or a blog post. Every shading equation below was read off the primary PDF
page, not a summariser — see §0.1 for why that sentence is in this document at all.

Confidence markers, same scheme as `stellar-blade-look-spec.md`:

- **[V]** Verified against a primary artefact, quoted with the page or file it came from
- **[M]** Measured **in this session**, with the rect, the file and the tool named
- **[D]** Derived here from two [V]/[M] facts, with the derivation shown
- **[I]** Inference, explicitly flagged
- **[✗]** Negative finding — looked for, not there

Nothing in this file is copied out of `PUNCHLIST.md`, `LEARNINGS.md` or a code comment and
presented as a result. Where a prior round's number is discussed it is labelled as that round's
number and either re-derived or marked unreproduced.

---

## 0. The five findings that decide this phase

### 🎯 0.1 The `~10:1` spec-to-albedo contrast is an **encoded-luma** ratio. In linear light it is **57:1 to 93:1**. [M]

`stellar-blade-look-spec.md` §5 tells a shader author `spec:albedo contrast ~10 : 1`. That number
is real, but it lives in the sRGB-**encoded** domain, because that is the domain the whole look
spec was measured in — `tools/critic/color.mjs`'s own header records the verification
(`#E5C3C3 → 0.793` reproduces under `encodedLuma` and not under `linearLuma`).

Re-derived here with that same module:

| quantity | encoded | linear |
|---|---:|---:|
| `#150F17` base albedo | **0.0661** | **0.005629** |
| band peak, spec's low end 0.60 | 0.60 | 0.3185 |
| band peak, spec's high end 0.75 | 0.75 | 0.5225 |
| **contrast** | **9.1 : 1 – 11.4 : 1** | **57 : 1 – 93 : 1** |

> **A build agent who writes `specular = albedo * 10` in a linear shader lands six to nine times
> too dim.** This is the single most expensive misreading available in punch-list 3.5, and the
> published number invites it. State the domain beside the number, every time.

### 🎯 0.2 The reference frame's clipped highlights are **hair**, and they are **tiny**. [M]

REQ-061 records that our frame reaches the bloom threshold in exactly one place — 84 px of eye
catchlight — and concludes that a face clips where it has hair specular. That conclusion had never
been checked against the reference. It is now.

Census of `overview_character.jpg` (3200×1841, the official-site asset the look spec's proportion
measurements were taken from), `encodedLuma > 0.99`, whole frame:

| statistic | value |
|---|---:|
| clipped pixels | **810** of 5,891,200 = **0.0137%** of frame |
| connected components (8-neighbour) | **188** |
| component size | min 1, **median 2 px**, p90 10 px, **max 34 px** |
| components with centroid in the head/hair box `[1150,250]-[1900,760]` | **129** |
| clipped pixels in that box | **606 = 74.8% of the clipped population** |

Three quarters of the reference's entire highlight budget is hair, spread over ~129 separate
glints whose median size is **two pixels**, and *nothing in the frame clips in a patch bigger than
34 px*. Rendered as an overlay the clipped set is a scatter of single-strand specular hits across
the crown and along the rim-lit silhouette.

> **The deliverable is not "a bright highlight". It is O(100) sub-10-px glints distributed over a
> groom.** No exposure change can manufacture that distribution, which is why REQ-061's
> "do not raise exposure" is correct and why 3.5 — not 3.13 — is the item that closes it.

⚠️ **The look spec's own `0.017%` for this frame does not reproduce.** Measured on the same file
under five plausible luma definitions: `encodedLuma > 0.99` → **0.0137%** (810 px), `≥ 0.99` →
identical 810 px, `linearLuma > 0.99` → 0.0040% (234 px), `max(r,g,b) > 0.99` → 0.0719% (4,237 px),
`mean(rgb) > 0.99` → 0.0088% (519 px). None is 0.017%. Recorded, not silently corrected: the
figure may have come from the 3840×2160 PlayStation-CDN copy of the same shot. **Quote 0.0137% with
its artefact, or re-measure.**

### 🎯 0.3 The dual band is not two shifted copies of one highlight. The two lobes carry **different colours**, and the reference proves it. [M]

Measured on `post_ms7/08.jpg` (3840×2160, the "rim light + hair" plate the look spec nominates),
on the flying ponytail under teal practicals:

| band | rect | p50 | p99 | p99 hue / sat |
|---|---|---|---|---|
| upper, warm | `[1930,1638]-[2070,1668]` | `#ab512f` (hue 16°, S 0.725) | `#ffd9a0` | **36° / 0.373** |
| upper-left, cool | `[1600,1643]-[1800,1667]` | `#27403c` (hue 170°) | `#cffdfa` | **176° / 0.182** |
| lower, cool | `[1930,1828]-[2150,1862]` | `#2e3629` (hue 97°) | `#85fff0` | **173° / 0.478** |

The cool band peaks at saturation **0.182** in the *practicals'* hue. The warm band peaks at
saturation **0.373** in the *hair's* hue. That is Karis' model visible in a shipped frame: the R
lobe's attenuation is Fresnel and therefore takes the **light** colour, and the TRT lobe's
attenuation is absorption `C^(0.8/cos θd)` and therefore takes the **hair** colour (§1.5, §1.6).

> **Author the two bands with different tints or the hair will read as a plastic anisotropic
> surface.** A single Kajiya-Kay streak cannot produce this and is the reason it looks wrong.

### 🎯 0.4 The reference's hair silhouette is **not made of card edges**, and this is the whole alpha problem. [M]

10–90% luma transition width crossing the crown silhouette on `overview_character.jpg`, columns
x ∈ [1400,1650], y ∈ [240,330]: 130 usable columns, min 1 px, p25 **2 px**, median **16 px**,
p75 **45 px**, max 90 px; only **21.5%** cross in a single pixel. On the ponytail
(`post_ms7/08.jpg`, x ∈ [1700,2200]) the median is **56 px** and only **1.7%** cross in one pixel.

The 1:1 crop says why the "transition width" statistic degenerates: **there is no card edge at the
silhouette to measure.** The outer boundary of the groom is a 20–60 px deep halo of individual
flyaway strands over the card mass. The same is true at the bottom of the fringe — the card tips
dissolve into single strands before the card's own outline is ever visible.

> The look spec's `flyaways: a few thin single-strand cards at the silhouette` **understates this
> by an order of magnitude**. The flyaway layer is not decoration; it *is* the silhouette, and it
> is the reason a card groom does not read as cut-out cardboard. Budget it as a first-class layer.

### 🎯 0.5 three r185 gives us the two hard parts of weighted-blended OIT and then takes one of them back with a one-word bug. [V/M]

Per-attachment blend state **is** plumbed into the WGPU pipeline descriptor
(`WebGPUPipelineUtils.js:147` reads `mrt.getBlendMode( texture.name )` and pushes a distinct
`blend` per target), and `BlendMode` carries full `CustomBlending` including separate alpha
factors. That is exactly what McGuire & Bavoil's Listing 3/4 require, and it means WBOIT does not
need a hand-rolled backend.

But `MRTNode.merge()` assigns the merged table to `mrtTarget.blendings`, and `getBlendMode()`
reads `this.blendModes`. **Nothing in three reads `blendings`** (grep over `src/`: two hits, both
inside `MRTNode.js`). Proven by running it against the installed source:

```
BEFORE merge, on hairMRT:   accum .blending = 5 (CustomBlending)
AFTER  passMRT.merge( hairMRT ):
  outputs         = [ 'output', 'normal', 'accum', 'reveal' ]
  blendModes keys = [ 'output' ]
  stray .blendings keys = [ 'output', 'accum', 'reveal' ]
  accum .blending = 0 (NoBlending)
```

`NodeMaterial.js:572` runs `mrt.merge( materialMRT )` for **every material that sets
`material.mrtNode`** — which is the mechanism `render/GBuffer.js` documents for the skin material's
`sssMask`. So: **set OIT blend modes on the pass-level MRT, never on `material.mrtNode`.** Full
consequences in §4.3.

---

## 1. The BSDF — Karis' closed-form Marschner

**Primary artefact:** Brian Karis, *Physically Based Hair Shading in Unreal*, SIGGRAPH 2016
Physically Based Shading in Theory and Practice course.
<https://blog.selfshadow.com/publications/s2016-shading-course/karis/s2016_pbs_epic_hair.pdf> —
66 pages, `Author: Brian Karis`, `CreationDate: 2016-08-22`, `Last-Modified: 2016-08-26`.
Equations below are read off the slide bodies; the speaker notes are quoted separately and
attributed by slide number. **[V]**

The deck's equations are vector art and do **not** come out of `pdftotext`; the notes do. Anyone
re-checking this section must read the slide images, not the extracted text. (§0's promise about
summarisers: `docs/LEARNINGS.md` §1.25s.)

### 1.1 The factorization (slide 13)

```
S(θi, θr, φ)   =  Σ_{p=0..∞}  S_p(θi, θr, φ)
S_p(θi, θr, φ) =  M_p(θi, θr) · N_p(θi, θr, φ)
```

`p` counts interior traversals: `p=0` is **R** (reflection off the cuticle), `p=1` is **TT**
(through the fibre and out the far side), `p=2` is **TRT** (in, off the far wall, out the front).
`M` is longitudinal — down the length of the fibre. `N` is azimuthal — around it. Karis models
R, TT and TRT and states plainly on slide 17: *"We don't handle eccentricity."*

Why the split matters visually, in Karis' own notes: *"The R path is white due to not passing
through the interior of the fiber. The TRT is colored due to passing through the fiber twice. They
are separated from one another due to the tilted cuticle scales"* (slide 11). §0.3 is that sentence
measured in a shipped frame.

### 1.2 M_p — longitudinal (slide 18)

Weta's energy-conserving form, given and rejected as too expensive:

```
M_p(θi,θr) = ( 1 / ( v·e^(2/v) − v ) ) · e^( (1 − sinθi·sinθr) / v ) · I0( cosθi·cosθr / v )
v = β_p²
```

What Epic ships instead — **this is the form to implement**:

```
M_p(θi,θr) ≈ ( 1 / ( β_p · √(2π) ) ) · exp( − (sinθi + sinθr − α_p)² / (2 β_p²) )
```

`β_p` is the fibre **roughness**; `α_p` is the **cuticle-scale tilt** for that lobe (slide 18
notes). Karis flags this as the weakest link he shipped: *"Having a cheaper but more accurate
alternative to d'Eon's function would be nice. This is one area in particular I'd like to
improve."*

⚠️ **The argument is `sinθi + sinθr`, not Marschner's `θh`.** That is a different variable and it
changes what `α_p` and `β_p` mean numerically — see §1.7, which is where every implementation of
this model goes wrong.

Slide 19: Weta's azimuthally-dependent modification to M is used **for the R path only** — *"For R
this is cheap enough and looks slightly better"*; other paths *"too complex and minor impact"*.

### 1.3 N_R — azimuthal, R lobe (slide 20)

```
N_R(θi,θr,φ) = ( 1/4 · cos(φ/2) ) · A(0,h)
A(0,h)       = F( η, √( 1/2 + 1/2 (ωi · ωr) ) )
```

with the trig identity that removes all inverse trig:

```
cos(φ/2) = √( 1/2 + 1/2 cos φ )
```

and Schlick's Fresnel:

```
F(η,x) = F0 + (1 − F0)(1 − x)^5
F0     = (1 − η)² / (1 + η)²
```

For η = 1.55, `F0 = 0.046521`. **[D]** — computed here from the slide's own formula, not quoted.

**The attenuation of R is pure Fresnel: it is achromatic and takes the light's colour.** §0.3
measured the consequence at saturation 0.182.

### 1.4 The general N_p, and the two subterms (slide 23)

Weta's exact azimuthal integral, given as the thing being approximated away:

```
N_p(θi,θr,φ) = 1/2 ∫_{-1}^{1} A(p,h) · D_p( φ − Φ(p,h) ) dh
A(p,h)       = (1 − f)² · f^(p−1) · T(μa, h)^p
f            = F( η, cos(θd) √(1 − h²) )
T(μa,h)      = exp( −2 μa · (1 + cos 2γt) / cos θt )
```

`h` is the offset of the path from the fibre centre. Karis' notes: *"It isn't important to
understand this integral … Just know this is too expensive to solve as is. We instead are going to
solve other paths as single lobes more in line with how Marschner originally did."*

### 1.5 N_TT (slides 24–29)

Exact offset, then the approximation:

```
a      = 1 / η′
h_TT   = sign(φ)·cos(φ/2) / √( 1 + a² − 2a·sign(φ)·sin(φ/2) )
h_TT²  = ( 1/2 + 1/2 cos φ ) / ( 1 + a² − 2a √( 1/2 − 1/2 cos φ ) )

h_TT  ≈  ( 1 + a(0.6 − 0.8 cos φ) ) · cos(φ/2)          ← implement this
```

*"Ignoring sign of h, which turns out to not be relevant for our use"* (slide 25 notes).

**Modified index of refraction** (slide 26) — needed by `a`:

```
η′       = √( η² − sin²θd ) / cos θd
η = 1.55 → η′ ≈ 1.19 / cos θd + 0.36 cos θd        error < 0.68%
```

**[M]** Re-derived rather than trusted: max relative error over θd ∈ {0°,15°,30°,45°,60°} is
**0.675%** at 45° (0.000% / 0.154% / 0.487% / 0.675% / 0.428%). The slide's claim holds exactly.

**Absorption** — Karis abandons Weta's for Pixar's *"Found the look more pleasant"* (slide 27):

```
T(θ,φ) = exp( −ζ(C) · cos γt / cos θd ),    γt = asin( h / η′ )
```

and then picks ζ so the artist parameter is literally the hair colour (slide 28) —
*"C is the BaseColor of hair"*:

```
T(θ,φ) = C ^ ( √(1 − h²a²) / (2 cos θd) )
```

**Distribution** (slide 29). Pixar's logistic:

```
D(φ, s, μ) = e^((φ−μ)/s) / ( s (1 + e^((φ−μ)/s))² )
```

`s_TT` dropped for the constant **0.35**, then the logistic replaced by a Gaussian in `cos φ`:

```
D_TT(φ) = D(φ, 0.35, π)  ≈  e^( −3.65 cos φ − 3.98 )
```

### 1.6 N_TRT (slide 32)

Karis' notes: *"For TRT we have to be brutal. Marschner solved this and glints with root finding
for h which has multiple solutions which means multiple lobes. Weta solved it with heavy numerical
integration. Pixar solved it with very large look up tables. I chose a single simple lobe."*

```
h_TRT        = √3 / 2                       (a constant, for Fresnel only)
T_TRT(θ,φ)   = C ^ ( 0.8 / cos θd )         (no h, no η′ — both replaced by constants)
D_TRT(φ)     = (3/4) · D(φ, 0.15, 0)  ≈  e^( 17 cos φ − 16.78 )
```

**No glints.** Marschner's caustic/root-finding machinery is gone entirely. **[V]**

> **TRT's attenuation is `C^(0.8/cos θd)` — the hair colour raised to a view-dependent power.**
> That is the whole reason near-black albedo produces a coloured highlight, and it is why the look
> spec's *"do not author brown hair as brown albedo"* is a shading statement, not a taste
> statement.

### 1.7 The shift and roughness per lobe — traced to Marschner, converted to Karis' variable [V/D]

Karis' deck gives no numeric `α_p` or `β_p`. **[✗]** Unreal's own `HairBxDF.ush` is behind Epic's
authenticated GitHub and could not be read; do not let anyone quote its constants from memory.

The ratios come from the model Karis is approximating. **Primary artefact:** Marschner, Jensen,
Cammarano, Worley & Hanrahan, *Light Scattering from Human Hair Fibers*, SIGGRAPH 2003,
<https://www.cs.cornell.edu/~srm/publications/SG03-hair.pdf>, **Table 1, page 8**, read off the
page:

| parameter | purpose | typical values |
|---|---|---|
| η | index of refraction | **1.55** |
| σa | absorption coefficient (R,G,B) | 0.2 to ∞ |
| a | eccentricity | 0.85 to 1 |
| α_R | longitudinal shift: R lobe | **−10° to −5°** |
| α_TT | longitudinal shift: TT lobe | **−α_R / 2** |
| α_TRT | longitudinal shift: TRT lobe | **−3 α_R / 2** |
| β_R | longitudinal width (stdev): R lobe | **5° to 10°** |
| β_TT | longitudinal width (stdev): TT lobe | **β_R / 2** |
| β_TRT | longitudinal width (stdev): TRT lobe | **2 β_R** |
| k_G, w_c, Δη′, Δh_M | glints | 0.5–5, 10°–25°, 0.2–0.4, 0.5 |

and on the same page, `M_p(θh) = g(β_p; θh − α_p)` with *"a normalized Gaussian function with
standard deviation β"*. Sign convention, from the body text: **R shifts toward the root, TT and
TRT shift toward the tip**, TRT furthest.

**[D] The conversion, which nobody writes down and everybody needs.** Marschner's Gaussian is in
`θh = (θi+θr)/2`; Karis' is in `sinθi + sinθr`. Exactly:

```
sinθi + sinθr = 2 cos θd · sin θh          (θd = (θr − θi)/2)
```

so at θd = 0 and small angles the Karis variable is `2 θh`, and matching the two exponents gives

```
α_p^Karis ≈ 2 sin( α_p^Marschner )
β_p^Karis ≈ 2 β_p^Marschner   (in radians)
```

Evaluated over Marschner's own bands:

| lobe | Marschner | **α in Karis' sine units** | Marschner | **β in Karis' sine units** |
|---|---|---:|---|---:|
| R | −10° … −5° | **−0.3473 … −0.1743** | 5° … 10° | **0.1745 … 0.3491** |
| TT | +2.5° … +5° | **+0.0873 … +0.1743** | 2.5° … 5° | **0.0873 … 0.1745** |
| TRT | +7.5° … +15° | **+0.2611 … +0.5176** | 10° … 20° | **0.3491 … 0.6981** |

Sanity check that costs nothing and is worth everything: **β_TRT lands at 0.35–0.70, two to four
times β_R.** That is the "broad soft band, not a tight streak" the look spec asks for, arriving
from the physics rather than from an art note. The two agree.

⚠️ These are *bands from a 2003 measurement of real fibres*, not Epic's shipped constants and not
Stellar Blade's. Treat `β_R` and `α_R` as the **two free parameters of 3.5** and solve them against
a measured band width on the reference, exactly as `SCLERA_BRIGHTNESS` was solved. Do not hard-code
a remembered number.

### 1.8 Multiple scattering — the fake normal (slides 38–39)

Karis, in the notes, about his own work: *"It feels wrong to present this part in a physically
based shading course but instead consider this a call to arms. This is the biggest opportunity for
others to improve this model."* And: *"This is all a giant artistic hack and not physically based
in the slightest. It was derived by looking at photos, not ground truth renders."*

```
n          = ( ωr − u(u · ωr) ) / ‖ ωr − u(u · ωr) ‖          u = the hair-fibre tangent
S_scatter  = √C · ( (n · ωi + 1) / 4π ) · ( C / Luma )^(1 − Shadow)
```

Slide 39: *"Shadowing is exponential falloff from shadow map value"* and *"Absorption over direct
light path using shadow for path length"*.

🚩 **`Shadow` is load-bearing and it is not a binary.** Slide 44: *"Shadow maps are PCF filtered
with an **exponential falloff** instead of a hard comparison. The result is volumetric looking
without any provided normals."* The exponential shadow value **is** the estimate of path length
through the hair volume, and it feeds the absorption exponent. A hard depth comparison makes
`(C/Luma)^(1−Shadow)` collapse to two values and the volume disappears. Slide 44's own A/B is
brutal: with shadows the hair reads as a solid dark volume, without them it is a bright fuzzy mess.

Karis skips authored normals entirely: *"In my tests I found little extra benefit from an authored
normal when filtered shadowing was applied. Skipping authoring nice normals both saves artist time
and gbuffer space."*

### 1.9 Environment lighting (slides 46–47)

Epic rejected analytic spherical-Gaussian integration (*"In the end we didn't need to be that
sophisticated"*) and ship this:

- Sample a **spherical harmonic of the environment in the fake-normal direction**, treat the result
  **as a directional light source**, multiply by **π**.
- Run the same BSDF with three modifications:
  - **R multiplied by `saturate(ωi · ωr + 1)`**
  - **TT removed**
  - **add 0.2 to each β_p**
- Rationale from the notes: *"Increase the roughness as an approximation of a wider area light
  source. We don't have shadowing from shadow maps so we need to artificially shadow paths that
  would likely be blocked by a volume of hair. These are primarily those that are coming from the
  opposite side."*

🎯 **This maps onto work this repository has already done.** 3.10 built bent normals and specular
occlusion from GTAO's horizon integral; Karis' own note is *"If you had some computed form of
directional occlusion such as bent cones we could make less assumptions about which paths are
blocked."* We have the bent cone. The `saturate(ωi·ωr + 1)` fudge is the thing our GTAO term
replaces, and that is a genuine upgrade over what UE4 shipped rather than a shortcut.

#### 🎯 1.9a `saturate(ωi·ωr + 1)` is also the right term for the DIRECT lights on a rig whose panels cast no shadow, and this was measured [M]

Read the rationale above once more without the word *environment* in it: *"We don't have shadowing
from shadow maps so we need to artificially shadow paths that would likely be blocked by a volume
of hair."* That sentence describes our four `RectAreaLight`s exactly — three r185 has had no
rect-area shadow since 2018 (issue #14161), so the portrait rig's rim at irradiance 16 reaches hair
on the **front** of the head at full strength and the R lobe, whose attenuation is achromatic, takes
its `#0f30ff`.

`material/HairMaterial.js` originally answered that with `saturate(fake normal · ωi)`, which is not
in the deck. Measured 2026-08-12 on `?bare&freeze&seed=1&aa=msaa&grade=0&hair=1` at 900×1200, over
260,402 solid hair pixels, with the scattering function inverted out of the plate by the
`?hairdefect=unit-bsdf` probe (so each figure is a BSDF, not a brightness):

| occlusion term over R, TRT and the slide-39 fake | S p95 sr⁻¹ | S peak sr⁻¹ | top 2% hue / sat |
|---|---:|---:|---|
| `saturate(n·ωi)` — invented | 0.00789 | 0.01473 | 341° / 0.247 |
| `saturate(ωi·ωr + 1)` — slide 47 | 0.01644 | 0.02794 | 332° / 0.233 |
| none (`?hairvis=0`) | 0.02011 | 0.03163 | **261° / 0.429** |
| none, rim irradiance forced to 0 | 0.01678 | 0.02858 | 321° / 0.232 |

Rows 2 and 4 agree to 2%: slide 47's form removes the rim from front-facing hair and **nothing
else**. Row 3 is the blue-hair defect at the rim's own hue. The cosine in row 1 was charging every
light in the frame 2.08× at p95 for a fault that belonged to one of them.

> **Karis applies it to R alone and only in the environment path.** Using it on the direct lights,
> and on TRT and the fake as well, is an EXTENSION — recorded as one. All three are reflective and
> all three take the rim at full strength without it. `saturate` is what keeps it honest: it clamps
> at 1, so it is an attenuator and can never be read as a way to add energy.

⚠️ **What it costs, and it is the largest single number in this section.** R's real peak is not at
retro. Swept over the sphere on a `#150F17` fibre with the mirrors in `HairMaterial.js`, R reaches
**0.1128 sr⁻¹ at near-backlight grazing** against **0.0178 at retro** — a factor of 6.3, and it is
just Schlick going to 1 as the half-angle opens. Both occlusion forms discard all of it, because
neither can tell a light behind the HEAD from a light behind the CARD. Only a shadow map can, which
is why the rim wanting one is filed as `docs/OPEN-REQUESTS.md` REQ-063 rather than argued around in
the shader.

### 1.10 🎯 Which lobes a CARD can carry — the question 3.5 has to answer before a line is written

The BSDF needs a **fibre tangent `u`** and a **fibre-relative geometry**, not a surface normal. A
card supplies `u` from the strand-flow direction baked into its texture; that part is fine. What a
card cannot supply is anything that depends on *where across the fibre's circular cross-section*
the path went — that is `h`, and a flat quad has no `h`.

| lobe | needs | on a CARD | verdict |
|---|---|---|---|
| **R** | tangent + Fresnel of `ωi·ωr` only. `A(0,h)` has **h = 0 by construction** (slide 20). | ✅ complete, no approximation lost | **implement in full** |
| **TRT** | `h_TRT = √3/2` **is already a constant** (slide 32); `T_TRT = C^(0.8/cosθd)` has no `h`. | ✅ complete | **implement in full** |
| **TT** | `h_TT` is a real function of φ, and `T = C^(√(1−h²a²)/(2cosθd))` needs it. | ⚠️ evaluable — φ comes from `ωi`,`ωr`,`u`, which a card has | **implement, but see below** |
| **glints** | root-finding for multiple `h` | ✗ absent from Karis at any resolution | not applicable |
| **multiple scattering** | tangent + an **exponential** shadow value | ✅ — and it is what makes cards read as volume | **implement; it is not optional** |

**All three lobes are card-computable.** The lobes Karis dropped were dropped for cost, not for
strand-vs-card, and nothing in the closed form reads a per-strand quantity a card lacks. The real
card-vs-strand difference is elsewhere:

1. **TT is a back-light lobe and a card is one-sided by default.** TT is what you see when the
   light is behind the hair. Epic *removes TT from the environment path* (slide 47) for exactly the
   reason that IBL has no direction to be behind. On a card groom TT only pays for itself where
   cards are double-sided or where the rim/kicker sits behind the head — which, on our rig, it
   does. **Keep TT; gate it on the direct lights, not the IBL, matching slide 47.**
2. **`Shadow` is where cards genuinely lose.** A strand groom self-shadows at fibre scale; a card
   groom self-shadows at card scale, so the exponential shadow value is coarser and the
   multiple-scattering absorption is smoother. Mitigation is a **per-card depth/thickness channel**
   in the strand texture (§6) feeding the exponent, which is the card equivalent of the path length
   Karis reads out of the shadow map.
3. **A card's geometric normal is a lie about a fibre bundle.** `PUNCHLIST.md` already records this
   observation against 3.5. The Karis path does not use a surface normal at all — it uses `u` and
   the synthesised `n` of §1.8 — so **the fix is to never sample the interpolated normal in the
   hair material.** That includes the G-buffer: hair must write the *fake* normal to `normal`, or
   GTAO will compute occlusion against a plane that does not exist.

---

## 2. The numbers punch-list 3.5 already asserts, each traced

3.5 reads: *"Karis closed-form BSDF, cards default. Near-black albedo (`#150F17`) with ~10:1
spec-to-albedo contrast, broad soft dual bands, root AO 0.35–0.5."* Four claims. Here is where each
came from and whether it survives.

### 2.1 `#150F17` — **traced, and it survives** [V/M]

Origin: `stellar-blade-look-spec.md` §2 *Hair* **[M/I]**, *"Base albedo is essentially black — luma
0.067 (`#150F17`), slightly violet"*, and §5's block `baseColor (sRGB) #150F17 → #1A1218`. It is
already in the shipped code as `CARD_ALBEDO_FLOOR = 0x150F17` in `packages/testbed/src/alive.js`,
where it exists because the eyelash and eyebrow cards were rendering at literal RGB(0,0,0).

Re-measured here with `tools/critic/color.mjs`:

- `#150F17` → `encodedLuma` **0.0661**, `linearLuma` 0.005629, hue **285°**, S 0.348, V 0.090.
  The spec says 0.067; the third decimal differs and the "slightly violet" is confirmed at 285°.
- `#1A1218` → encodedLuma 0.0790, hue 315°.

Independent check against the artefact rather than the doc — fringe mass on
`overview_character.jpg`, rect `[1480,540]-[1700,610]`, n = 15,400:

| percentile | encodedLuma | hex | hue / sat |
|---|---:|---|---|
| p05 | 0.0216 | `#09040a` | 290° / 0.600 |
| **p50** | **0.0532** | **`#120c10`** | **320° / 0.333** |
| p95 | 0.2626 | — | — |
| p99 | 0.4886 | `#96757e` | 344° / 0.220 |

`#120c10` at hue 320° against a published `#150F17` at hue 285°: same magnitude, same violet
family, measured on lit hair rather than as an albedo. **The published hex is defensible.** Ship it.

### 2.2 `~10:1 spec-to-albedo contrast` — **traced, and it needs the correction in §0.1** [M]

Origin: same paragraph — *"Anisotropic highlight bands peak at luma 0.60–0.75. Specular-to-albedo
contrast ≈ 10:1."* Arithmetic: 0.60/0.0661 = 9.08, 0.675/0.0661 = 10.21, 0.75/0.0661 = 11.35. The
published `≈10:1` is the midpoint of its own band and is internally consistent. **In encoded luma.**

Measured band levels on `overview_character.jpg`, crown, rect `[1400,380]-[1660,440]`:

| statistic | encodedLuma | vs `#150F17` (encoded) | achromatic linear | vs `#150F17` (linear) |
|---|---:|---:|---:|---:|
| band p50 | 0.3564 | 5.4 : 1 | — | — |
| band p95 | **0.7228** | **10.9 : 1** | 0.4811 | **85 : 1** |
| band p99 | 0.8609 | 13.0 : 1 | 0.7122 | 127 : 1 |
| band max | 0.9975 | — | — | — |

and the second, fainter band above it (`[1400,290]-[1660,350]`) peaks lower — p95 0.4102, p99
0.4995 — which is the *dual* in "dual band" showing up as two different peak levels, not two
copies.

> **Restatement for 3.5: the band's 95th percentile sits at ~10.9× the albedo in encoded luma and
> ~85× in linear radiance.** Both numbers are the same measurement. Write both into the item.

### 2.3 `broad soft dual bands` — **traced, and §0.3 upgrades it from adjective to spec** [V/M]

Origin: *"Highlights are broad, soft, dual-band — not a tight Kajiya-Kay streak"* and §5's
`Primary (R) … Secondary (TRT) … Bands must be BROAD and SOFT — not a tight streak.`

This is now three independent things agreeing:

1. The look spec's visual read.
2. **[M]** §0.3's measurement that the two bands carry different hues and saturations, and §2.2's
   that they peak at different levels.
3. **[D]** §1.7's `β_TRT = 2 β_R` straight out of Marschner Table 1, which *predicts* a broad
   secondary from fibre physics.

⚠️ **The look spec's §5 per-lobe numbers are the part that does NOT trace.** `Primary (R) shift
+0.02…+0.05 toward root, roughness 0.25` and `Secondary (TRT) shift −0.05…−0.10 toward tip,
roughness 0.45` appear in the implementable-spec block with no measurement behind them, no unit,
and a **sign convention inverted relative to Marschner's α** (Marschner's α_R is *negative* toward
the root). They are an order of magnitude below §1.7's sine-space α values and cannot be
reconciled with them under any reading I could construct.

**Proposal, with reasoning [D]:** discard the four numbers and author from §1.7's table instead.
Start at the centre of Marschner's own bands —

```
α_R   = −0.26   β_R   = 0.26     // Marschner α_R = −7.5°, β_R = 7.5°, doubled into sine space
α_TT  = +0.13   β_TT  = 0.13     // α_R/−2, β_R/2
α_TRT = +0.39   β_TRT = 0.52     // −3α_R/2, 2β_R
```

— and treat `α_R` and `β_R` as the two knobs, solved against a measured band width. One observation
does survive from the look spec: its TRT:R roughness ratio is 0.45/0.25 = **1.8×**, against
Marschner's **2×**. The two agree to 10% on the only thing they can be compared on, which is mild
evidence the original numbers were eyeballed off a render rather than invented.

### 2.4 `root AO 0.35–0.5` — **UNTRACEABLE as stated, and the domain matters** [✗/M]

Origin: `stellar-blade-look-spec.md` §2, one clause — *"Heavy root AO (0.35–0.5 multiplier)"* —
inside a section headed **[M/I]**, with no rect, no procedure and no artefact. §5 repeats it as
`root AO 0.35 – 0.50`. **There is no measurement behind it that I can find, and there could not
easily be one: a photograph cannot separate ambient occlusion from light falloff.**

What *can* be measured is the total darkening, which bounds it. On `post_ms7/08.jpg`, the ponytail
immediately below the hair tie versus the same tress mid-shaft:

| sample | rect | encodedLuma p50 | linearLuma p50 |
|---|---|---:|---:|
| root, under the tie | `[830,1290]-[960,1340]` | **0.0760** | **0.006886** |
| mid-shaft | `[900,1450]-[1030,1510]` | **0.2066** | **0.036647** |
| **ratio root : mid** | | **0.368** | **0.188** |

⚠️ **This is AO *plus* light falloff *plus* a clasp shadow — an upper bound on brightness, not an AO
measurement.** But it puts a number on the table, and the number is instructive:

- **0.368 encoded** falls squarely inside the published 0.35–0.50 band. That is a real
  corroboration and it strongly suggests the original figure was read off an image in the encoded
  domain, like every other number in the look spec.
- **0.188 linear** is not in that band at all. A build agent who applies `0.40` as a *linear*
  multiplier produces an **encoded** darkening of `0.40^(1/2.4) = 0.683` — roughly half the
  darkening the plate shows. To land at an encoded 0.40 you need a linear multiplier of
  **`0.40^2.4 = 0.111`**.

**Proposal [D]:** replace the bare number in 3.5 with

```
root AO   0.35 – 0.50 as an ENCODED darkening at the root, i.e. a LINEAR multiplier of 0.11 – 0.21,
          ramped over the first ~15% of strand length, from a baked root-tip mask (§6).
```

and gate it as a measured root:mid luma ratio on our own plate rather than as a material constant,
because the constant is not the thing anyone can check.

---

## 3. What Stellar Blade actually does with hair

`stellar-blade-look-spec.md` establishes the frame: **[V]** UE 4.26.2, no ray tracing, baked
lightmaps, cascaded shadow maps with *"artifacts on hair"*, card/alpha-based hair with DF noting
shimmer and breakup and a short-hair option shipped as mitigation, **[V]** DLC grooms outsourced to
Airship Interactive, and **[V]** Kim on the ponytail: *"if it weren't for that hairstyle, we might
have cut about a year off development."* What follows is what this session could add on the hair
specifically.

⚠️ **Rule-5 check on a cross-reference this repo carries.** The look spec's [V] on Airship's
published pipeline being *"explicitly hair-cards with flow maps and anisotropic shading"* could
**not** be verified here: `airshipinteractive.com/blog/categories_projects/hair/` times out to
`curl`, and the artist portfolio pages that a search surfaces (ArtStation) are a Cloudflare-gated
SPA that returns neither HTML content nor JSON to tooling. A web search does return an ArtStation
project titled *"Stellar Blade — Scarlet's Hairstyle"* attributed to Alejandro Angelone, and
Airship marketing copy describing card placement in Maya — **but I did not read either primary
page, so this stays [I] and the look spec's [V] is over-marked.**

### 3.1 Card layout, from the 1:1 crops [M/I]

- **[M]** The ponytail resolves into **broad overlapping ribbons**, each carrying many painted
  strands, with tapering ends. Ribbon width is large relative to strand width — dozens of strands
  per card, not two or three.
- **[M]** Individual strands resolve at ~1–1.5 px at 3200 px width, against a face ~435 px wide at
  the cheekbones (the look spec's own measurement of this asset). A strand is therefore **~0.3% of
  face width**. At our portrait framing that is 1–2 px; at 1080p full body it is **sub-pixel**,
  which is the whole aliasing problem and exactly what DF's "shimmer and breakup" describes.
- **[M]** No card boundary is visible anywhere at the silhouette (§0.4). Card edges are only
  inferable from *specular discontinuities* in the interior, never from the outline.
- **[I]** Shell count: the crown shows at least three distinguishable specular layers stacked
  between the parting and the fringe edge, so **≥3 shells over the scalp**, with more in the
  ponytail where ribbons visibly cross.
- **[✗]** No card count is publicly published for this game, and the look spec §8 already records
  that. Do not invent one; §6 gives a derived target instead.

### 3.2 Highlight character [M]

§0.2 and §0.3 are the findings. Restated as a spec the critic loop can gate:

- Hair is **~75% of the frame's clipped-highlight population**.
- The clipped features are **1–34 px**, median **2 px**, ~129 of them on a head.
- The R band peaks near-white in the **light's** hue (S ≈ 0.18); the TRT band peaks in the
  **hair's** hue (S ≈ 0.37–0.73).
- The two bands peak at **different levels** — crown p95 0.72 versus the secondary band's 0.41.

### 3.3 Silhouette treatment [M]

§0.4. The groom's outer boundary is a **20–60 px flyaway halo at 3200 px width** — proportionally
~5–14% of face width — not a card edge. Combined with §3.1's sub-pixel strand width this is the
reference telling us that the silhouette is *deliberately* built out of geometry that cannot be
resolved, and left to the temporal resolve to average.

---

## 4. OIT, concretely in three r185

### 4.1 What three r185 does **not** have [✗]

- **No OIT of any kind.** Grepping `src/` and `examples/jsm/` for `OIT`, `order-independent`,
  `WBOIT`, `weighted.blended`: zero hits outside `SMAANode.js`/`SMAAPass.js`, which match on an
  unrelated substring. There is no weighted-blended node, no depth-peel node, no per-pixel linked
  list, no transmittance buffer.
- **No per-triangle or per-fragment sorting.** `RenderList.js` sorts *objects* —
  `reversePainterSortStable` orders by `groupOrder`, `renderOrder`, then `a.z` (line 45–62), and
  `sort()` is called on the `transparent` array only (line 393). **A hair mesh containing 200 cards
  is one entry in that array.** Card order inside the mesh is index-buffer order, forever.
- **No dual-source blending API.** `WGSLNodeBuilder.js:1681` defines `enableDualSourceBlending()`
  and `WebGPUConstants.js:345` defines the feature name — and **nothing in three calls either**
  (grep: those two lines only). `WebGPUBackend.js:227–242` requests every adapter-supported feature,
  so the device may well have `dual-source-blending` enabled while there is no way to emit
  `@blend_src(1)`. Dead end; do not plan around it.

### 4.2 What it **does** have, and this is more than expected [V]

- **Per-MRT-attachment blend state, fully plumbed.** `WebGPUPipelineUtils.js:134–177` loops the
  render context's textures, calls `mrt.getBlendMode( texture.name )` per attachment, and pushes
  `{ format, blend, writeMask }` per target into `_renderPipelineDescriptor.fragment.targets`.
  `BlendMode` (`renderers/common/BlendMode.js`) carries `blending`, `blendSrc`, `blendDst`,
  `blendEquation`, **`blendSrcAlpha`, `blendDstAlpha`, `blendEquationAlpha`** and
  `premultiplyAlpha`. `MRTNode.setBlendMode( name, blendMode )` is the public setter.
  **This is exactly what WBOIT needs and it is the part everyone assumes is missing.**
- **The same path on the WebGL2 fallback**, via `WebGLState.setMRTBlending()`
  (`webgl-fallback/utils/WebGLState.js:276`), gated on **`OES_draw_buffers_indexed`**
  (`WebGLBackend.js:272`). Without the extension it `warnOnce`s and falls back to the material's
  single blend for all targets.
- **Hashed alpha testing (Wyman & McGuire 2017)** as a first-class material flag:
  `material.alphaHash = true` routes through
  `nodes/functions/material/getAlphaHashThreshold.js`, whose own header cites
  `casual-effects.com/research/Wyman2017Hashed/`, with `ALPHA_HASH_SCALE = 0.05` *"Derived from
  trials only, and may be changed."* Two-scale log-discretised hash, CDF-corrected to a uniform
  threshold, seeded from `positionLocal`.
- **Analytic coverage AA when `alphaToCoverage` is on.** `NodeMaterial.js:875–878`: with
  `alphaTest` **and** `alphaToCoverage`, the discard is replaced by
  `smoothstep( alphaTest, alphaTest + fwidth(alpha), alpha )`. That is a soft edge in the alpha
  channel and it is worth having *even when MSAA is off* — but note line 626 and
  `WebGPUPipelineUtils.js`'s `alphaToCoverageEnabled = material.alphaToCoverage && sampleCount > 1`:
  **the hardware coverage half needs MSAA; the smoothstep half does not.**
- **Automatic back-then-front double draw for double-sided transparents.**
  `Renderer.js:3620`: if `material.transparent && material.side === DoubleSide &&
  material.forceSinglePass === false`, the object is drawn twice, `BackSide` then `FrontSide`.
  `Material.js:418–430` documents it and names our exact case: *"There are scenarios however where
  this approach produces no quality gains but still doubles draw calls e.g. when rendering flat
  vegetation like grass sprites."* **A hair card is a grass sprite. Set `forceSinglePass = true`
  unless a measurement says otherwise, or pay 2× the draw calls for nothing.**
  (Distinct from `RenderList.js:79`'s `transparentDoublePass` bucket, which additionally requires
  `transmission > 0` and is about ordering the transmission pass.)

### 4.3 🚩 Two constraints that decide the implementation

**(a) `MRTNode.merge()` silently discards per-output blend modes.** Measured, §0.5. The merge is
performed by `NodeMaterial.js:571` for any material that sets `material.mrtNode`.
**Consequence: put `accum`/`reveal` on the pass-level MRT of a dedicated hair pass.** Never on the
hair material's own `mrtNode`. `render/GBuffer.js` documents `material.mrtNode` as the mechanism
for the skin `sssMask` — *"which `MRTNode.merge()` folds over the pass-level MRT per material"* —
and that use is safe today **only** because `sssMask` wants the default blending. The comment is
correct about the outputs and silently wrong about the blend modes, which is exactly the shape of
bug that survives review.

**(b) Only MRT attachment 0 can be cleared to a chosen value.** Verified in two independent code
paths in `WebGPUBackend.js` — `_getRenderPassDescriptor` (line 756: `let clearValue = {r:0,g:0,b:0,
a:1}; if ( i === 0 && colorAttachmentsConfig.clearValue )`) and the render-pass start (line 857–866:
`if ( i === 0 ) clearValue = renderContext.clearColorValue; else clearValue = {0,0,0,1}`). The
WebGL fallback matches (`WebGLBackend.js:819` vs `:823`, `clearBufferfv( gl.COLOR, i, [0,0,0,1] )`
for `i > 0`).

🎯 **This single constraint chooses which McGuire formulation we implement, and the answer is a
happy one.**

**Primary artefact:** Morgan McGuire & Louis Bavoil, *Weighted Blended Order-Independent
Transparency*, **JCGT Vol. 2 No. 2, 2013**, <https://jcgt.org/published/0002/02/09/paper.pdf>,
Listings 3 and 4 on page 131, equations (7)–(11) on page 129. Read off the pages. **[V]**

Listing 3 ("Our New Method") clears `accumTexture to vec4(0)` and **`revealageTexture to
float(1)`** — a non-default clear on attachment 1. **three r185 cannot express that.**

Listing 4 ("Our New Method for Platforms without Per-Render Target Blending") clears **both**
targets with `glColorClearValue(0,0,0,1)` — which is *precisely* three's fixed clear — and packs
revealage into the alpha channel of target A:

```
glColorClearValue(0,0,0,1); glClear();
glDepthMask(GL_FALSE); glEnable(GL_BLEND);
glBlendFuncSeparate(GL_ONE, GL_ONE, GL_ZERO, GL_ONE_MINUS_SRC_ALPHA);
  gl_FragData[0]   = vec4(Ci * w(zi,ai), ai);      // A.rgb += Ci·w ; A.a *= (1−ai)
  gl_FragData[1].r = ai * w(zi,ai);                // B.r   += ai·w
// composite
glBlendFunc(GL_ONE_MINUS_SRC_ALPHA, GL_SRC_ALPHA);
  vec4 accum = texelFetch(ATexture, ivec2(gl_FragCoord.xy), 0);
  float r = accum.a;
  accum.a = texelFetch(BTexture, ivec2(gl_FragCoord.xy), 0).r;
  gl_FragColor = vec4(accum.rgb / clamp(accum.a, 1e-4, 5e4), r);
```

**Implement Listing 4, not Listing 3.** In three r185 that is:

```js
const accum = new BlendMode( CustomBlending );   // A: RGBA16F
accum.blendSrc = OneFactor;  accum.blendDst = OneFactor;              // rgb: additive
accum.blendSrcAlpha = ZeroFactor;                                     // a: revealage product
accum.blendDstAlpha = OneMinusSrcAlphaFactor;
const weight = new BlendMode( CustomBlending );  // B: R16F
weight.blendSrc = OneFactor; weight.blendDst = OneFactor;
hairPassMRT.setBlendMode( 'hairAccum', accum ).setBlendMode( 'hairWeight', weight );
```

Both targets then want three's default `(0,0,0,1)` clear and neither needs a custom clear value.
It still requires per-attachment blending — so on WebGPU it works, and on the WebGL2 fallback it
needs `OES_draw_buffers_indexed` or it silently degrades to one blend for both targets, which
produces garbage rather than a downgrade. **Feature-detect and fall back to §5's alpha path, not
to a broken WBOIT.**

### 4.4 The weight function — verbatim, and the part that will bite [V]

Page 129, "We tuned these to work well for 16-bit floating point accumulation buffers with
0.1 ≤ |z| ≤ 500":

```
(7)  w(z,α) = α · max( 10⁻², min( 3×10³,  10   / ( 10⁻⁵ + (|z|/5)²  + (|z|/200)⁶ ) ) )
(8)  w(z,α) = α · max( 10⁻², min( 3×10³,  10   / ( 10⁻⁵ + (|z|/10)³ + (|z|/200)⁶ ) ) )
(9)  w(z,α) = α · max( 10⁻², min( 3×10³,  0.03 / ( 10⁻⁵ +            (|z|/200)⁴ ) ) )
(10) w(z,α) = α · max( 10⁻², 3×10³ · (1 − d(z))³ ),   d(z) = ((z_near·z_far)/z − z_far)/(z_near − z_far)
```

*"The exponents can all be evaluated with repeated products — true exponentiation is not
required."* Equation 10's `d(z)` is the value in `gl_FragCoord.z`, i.e. clip-space depth, and *"all
z values are negative in camera space."*

🚩 **Three things about applying this to hair on a head.**

1. **The tuning depth range is 0.1–500 world units.** Our subject occupies a few tenths of a unit
   at portrait framing. Every one of those curves is flat at its `3×10³` ceiling across our entire
   depth range, which makes `w ≈ 3000·α` for every fragment — that is *unweighted* weighted-blended
   OIT, i.e. a plain weighted average with no occlusion cue, and the classic milky result.
   **Equations 7–10 must be re-fitted to our depth range or (10) parameterised on `d(z)` which is
   scale-free by construction. Prefer (10).**
2. **Weight must fall off with α, not only with z.** From the paper: *"a surface very near the
   camera with so low coverage as to be imperceptible during ordered compositing can then
   undesirably color distant and more opaque surfaces … the product of the weight and coverage can
   still be too large unless weight explicitly falls off with very low α values."* Hair is a field
   of low-α fragments. **This paragraph is about us.**
3. **The `α` in `w(z,α)` is the card's alpha AFTER the strand texture, and hair stacks 10–50 of
   them.** McGuire notes the clamps saturate after about 20 layers close to the camera, and that
   the accumulated weight must be clamped at composite (`clamp(accum.a, 1e-4, 5e4)`).

### 4.5 The three options, ranked for this project

| option | verdict |
|---|---|
| **Weighted-blended (Listing 4 form)** | **The plan for the interior of the groom.** Order-free, one extra pass, two attachments, per-attachment blending exists in r185, and the clear constraint picks the formulation for us. Risk is entirely in the weight function (§4.4). |
| **Depth-sorted** | **Not available at the granularity we need.** three sorts objects only (§4.1). Getting card-level ordering means either one `Mesh` per card — hundreds of draw calls, and `Renderer.js:3620` would double them again — or re-sorting the index buffer per frame on the CPU. Viable only for a handful of large ribbons (a fringe, a ponytail tail), not for a groom. |
| **Dithered / stochastic** | **Viable and cheap, and r185 ships the good version.** `material.alphaHash` is Wyman & McGuire hashed alpha testing. It needs a temporal resolve to converge — which we have and which is the default (3.12). ⚠️ **The hash is seeded from `positionLocal`, and `Skinning.js:171` does `positionLocal.assign( skinPosition )` — so on a skinned mesh the seed is the *animated* position and the noise pattern moves with the hair.** Whether that helps TRAA (decorrelated noise) or produces crawl is **unmeasured**; probe it before relying on it. |

**Recommendation for 3.6:** a **hybrid**, and say so in the item.

- **Interior of the groom** → weighted-blended, Listing 4 form, equation (10) weight.
- **Silhouette flyaways** (§0.4/§3.3) → **alpha-hash + temporal resolve**, not WBOIT. They are
  sub-pixel, near-black, and there are thousands of them; running them through the accumulation
  buffer spends bandwidth to average a thing whose correct answer is a coverage fraction. §5 is the
  measurement that supports this.
- **A depth-sorted path is not worth building.** Record the reason (three sorts objects) so nobody
  re-derives it.

---

## 5. The alpha problem, which is the one that actually kills card hair

Alpha-tested cards give a chewed silhouette. Alpha-blended cards give sorting artefacts. That is
the standard framing, and this project has a measurement that changes it.

**Punch-list 3.12 records** — *not re-measured in this session; quoted as that round's result and
labelled* — the share of card-band silhouette transitions that jump in a single pixel on
`?bare&freeze` converged to frame 300 at 900×1200, grade on in every row:
**no AA 68.7%, MSAA + alpha-to-coverage 44.5%, TRAA 35.5%, TAAU 27.1%.** The temporal resolve
antialiases the existing eyelash and eyebrow cards **better than alpha-to-coverage does**, and 3.12
records that the opposite was asserted for a round on structural grounds before anyone measured it.

### What that implies for hair

1. **Do not build the groom around alpha-to-coverage.** It is 44.5% against TAAU's 27.1% on this
   project's own cards, it requires MSAA (`alphaToCoverageEnabled = material.alphaToCoverage &&
   sampleCount > 1`), and MSAA is not the shipped path. The `smoothstep(αT, αT + fwidth(α), α)`
   half of `alphaToCoverage` (§4.2) is free of MSAA and worth keeping on its own.
2. **The temporal resolve is the silhouette AA.** That is a *dependency*, not a nice-to-have: hair
   is the most aliasing-prone geometry in the project and 3.11's Toksvig term plus 3.12's TAAU is
   the entire defence. Any hair LOD or debug path that disables the resolve will look broken and
   the breakage will be blamed on the hair.
3. 🎯 **The reference agrees.** §0.4: on `overview_character.jpg` only **21.5%** of crown-silhouette
   columns cross in a single pixel, and on the ponytail only **1.7%**. Stellar Blade is a TAA title
   whose hair silhouette is, measurably, not a hard cut. **Our 27.1% on lash/brow cards is already
   in the same regime as the reference's 21.5%.** That is the first hair-adjacent number this
   project has that sits inside the reference band before any hair work has been done.
4. **Alpha-hash and the temporal resolve are the same strategy.** Hashed alpha testing converts
   coverage into noise and asks the resolve to integrate it. On a path that already runs TAAU at
   0.66 with RCAS recovery, that is the cheapest correct answer for the flyaway layer, and it needs
   no OIT buffer at all.
5. ⚠️ **The one thing the resolve does not fix is disocclusion.** A groom in motion reveals
   previously-hidden interior every frame, and a temporal history has nothing for those pixels.
   Hair is where TRAA's history rejection gets exercised hardest. **Gate hair motion, not hair
   stills.**

---

## 6. Groom authoring — what a Blender-side generator has to emit

### 6.1 Ribbon geometry

A card is a **ribbon**: a strip of quads following a guide curve, twisted so it faces outward from
the scalp, tapering in width toward the tip. Minimum viable spec, derived from what the shading
model reads:

- **Segments per card: 6–12.** The card must bend smoothly enough that the interpolated tangent `u`
  is credible along its length — `u` is the single most important input to §1's BSDF, and a
  4-segment ribbon shows faceted highlight breaks where the tangent steps.
- **Width taper**, not a constant-width strip: the reference's ribbons visibly narrow toward the
  tip (§3.1), and a constant-width card reads as a ribbon rather than as hair.
- **Tangent must be baked to a vertex attribute**, not derived from UV derivatives at runtime.
  three r185 computes tangents from UVs when asked, but a card's UV is axis-aligned by construction
  and the flow inside the card is *not* — which is what the flow-map channel is for (§6.3).
- **One mesh, not one mesh per card** (§4.1: per-object sorting makes hundreds of meshes both slow
  and no better ordered), with `forceSinglePass = true` (§4.2).

### 6.2 Card count — a derived target, not a quoted one [D]

No published card count exists for the reference (§3.1). Derive it from the two things we can
measure instead:

- **Silhouette layer.** §0.4 measures a flyaway halo 20–60 px deep at 3200 px width, i.e. ~5–14% of
  face width, continuous around the crown. That is not "a few cards"; at 1–2 strands per card-width
  it is the largest population in the groom. **Budget 40–60% of total cards to the silhouette
  layer**, as narrow (1–4 strand) cards.
- **Shells.** §3.1 infers ≥3 shells over the scalp.
- **Overdraw, which is the thing that actually costs.** At portrait framing hair covers roughly a
  sixth of the frame; at 1080p that is ~350 k pixels, and a 3-shell groom with a flyaway layer runs
  8–20 fragments deep. **2.8–7.0 M shaded fragments per frame** is the number the BSDF cost gets
  multiplied by, and it is what §7's budget has to buy.

**Target for a first groom: 250–450 cards for a full head**, split roughly 150–250 silhouette/
flyaway and 100–200 body/shell. ⚠️ **[D], from the coverage and overdraw arithmetic above and from
the measured silhouette depth — not from any published production figure.** Treat it as the
starting point of a sweep, and make card count a generator parameter so the sweep is one number.

### 6.3 The strand texture — channels a card needs

Per §1, and marked with which term consumes each:

| channel | fmt | consumed by | notes |
|---|---|---|---|
| **alpha** | R8 | alpha test / hash / WBOIT `α` | The most important channel in the groom. Must resolve individual strands to sub-pixel or §0.4's silhouette is unreachable. **Author at ≥2048 px along the strand direction.** |
| **albedo / root-tip tint** | RGB, KTX2 ETC1S | `C` in §1.5/§1.6 | Near-black (§2.1). Carries the root→tip lightening, not a colour map. |
| **tangent / flow** | RG8 | `u`, the fibre direction | Per-texel deviation of the strand from the card's own axis. Without it every strand in a card shares one highlight and the band reads as a painted stripe. **Airship's published pipeline is described as card+flow-map; §3's rule-5 note applies.** |
| **depth / thickness** | R8 | `Shadow` in §1.8 | How deep into the hair volume this texel sits. This is the card substitute for the fibre-scale self-shadowing a strand groom gets free, per §1.10(2). |
| **root-tip mask** | R8 | root AO (§2.4), tip alpha falloff | 0 at root, 1 at tip. One channel, two jobs. |
| **per-strand ID** | R8 | per-strand roughness/tint jitter, glint dithering | Randomises `β_p` and `C` slightly per strand so a card does not read as a single surface. Cheap; skipping it is visible. |

Pack: **albedo RGB + alpha in one ETC1S/UASTC KTX2; flow RG + depth + root-tip in a second UASTC
RGBA; strand ID can ride in the first texture's unused channel if albedo is authored as luminance.**
`rendering-stack.md` §5's rule holds — **UASTC for the data maps, ETC1S visibly degrades them.**

### 6.4 UV atlas

Strand textures are authored as a **vertical atlas**: each column band is one strand-clump variant,
running root-at-top to tip-at-bottom, so a card's UV is `u ∈ [column start, column end]`,
`v ∈ [0,1]` along its length. Consequences for the generator:

- **`v` is the root-tip parameter for free** — no second attribute needed for §6.3's mask.
- A card may take a **sub-range of `v`** to make a short card from a long strand texture, which is
  how you get a fringe and a tail out of one atlas.
- **Mirror `u` randomly per card** to break repetition; the strand texture must therefore be
  authored to tile-free horizontally within a variant band.
- **Do not rotate cards in UV space.** The flow channel is authored relative to `+v`, and a rotated
  card silently rotates every tangent in it.

### 6.5 Physics, and why it is not in this document

Hair motion is punch-list 6.8's problem (`Hair drag 0.4` against tissue's 0.05), and
`rendering-stack.md` §4 already identifies `webgpu_compute_cloth.html` as a complete in-core TSL
verlet spring solver with `instancedArray()` storage buffers — springs map to card spine segments
directly. **The shading work in 3.5/3.6 must not assume a static groom**, which mostly means the
tangent attribute has to be recomputed or skinned rather than baked into world space.

---

## 7. Performance

The frame budget is 16.6 ms. The round brief gives the shipped build at **12.995 ms p50 /
13.921 ms p95** at 1080p full body with GTAO low, leaving ~2.6 ms of p95 headroom.
⚠️ **Those two figures were not re-measured in this session and are quoted as the brief's, not as a
result.** Re-derive them before sizing anything against them.

Measure with `?gputime=1`, which sets `trackTimestamp` at renderer construction
(`packages/testbed/src/alive.js:605`); the backend gates it on the adapter actually having the
`timestamp-query` feature (`WebGPUBackend.js:294`). Wall-clock instrumentation on this page is a
non-measurement.

What the budget has to cover, in the order it will consume it:

1. **The extra geometry pass.** WBOIT is a second pass over hair geometry after the opaque
   G-buffer. Not free, and `forceSinglePass = true` (§4.2) is worth a check on its own — the
   default doubles it.
2. **Overdraw × BSDF.** §6.2's 2.8–7.0 M shaded fragments. The Karis path with all three lobes plus
   §1.8 is heavier per fragment than the skin shader, and it runs on more fragments.
3. **Two extra attachments** (RGBA16F + R16F) at full resolution for the accumulation pass, plus a
   composite. On the TAAU path at `resolutionScale ≈ 0.66` these are at reduced resolution too,
   which is a real saving and an argument for keeping hair inside the resolved pass rather than
   compositing after it.
4. **Shadow.** §1.8's exponential shadow value is not optional and it is what makes the groom read
   as a volume. 3.8 records that one shadow caster costs 2.62 ms at 1920×1080 on the real figure —
   **again, that is 3.8's number, not re-measured here.** Hair does not obviously need a second
   caster; it needs the existing one filtered exponentially rather than compared hard.

🚩 **The honest position: hair does not fit in 2.6 ms without a LOD story, and this document is not
in a position to prove otherwise because there is no hair to measure.** The lever this project
already owns is `PassNode.setResolutionScale()` — 3.12's TAAU at 0.66. **Do the perf spike before
the material** (punch-list 0.9 already asks for it, against the frostbitten-hair demo) and size the
groom to the measurement rather than sizing the measurement to the groom.

---

## 8. Explicitly unverified, and where the gaps are

- **Unreal's shipped `α_p`/`β_p` constants.** `HairBxDF.ush` is behind Epic's authenticated GitHub.
  §1.7 gives Marschner's bands and a derivation instead. **Anyone who writes a UE constant into
  3.5 must say which file and line they read it in.**
- **Airship Interactive's published hair pipeline.** The look spec marks it **[V]**; the site timed
  out and the ArtStation pages are Cloudflare-gated to tooling. Downgraded to **[I]** here (§3).
- **The look spec's `0.017%` clipped-pixel figure for the frontal portrait** does not reproduce from
  `overview_character.jpg` under five luma definitions; this session measures **0.0137%** (§0.2).
  Possibly measured on the 3840×2160 PlayStation-CDN copy — untested.
- **The look spec's per-lobe `shift`/`roughness` numbers** (`+0.02…+0.05`, `0.25`, `−0.05…−0.10`,
  `0.45`) have no traceable origin, no stated unit, and an inverted sign convention (§2.3).
- **`root AO 0.35–0.5`** has no traceable measurement (§2.4). The root:mid ratio measured here —
  0.368 encoded, 0.188 linear — is AO plus falloff plus a clasp shadow.
- **Alpha-hash seed stability under skinning.** `Skinning.js:171` overwrites `positionLocal`, so the
  hash seed is animated. Structural reading only; **not probed at runtime.**
- **Whether three's per-attachment blending survives `compatibilityMode`.** It does not —
  `WebGPUPipelineUtils.js` warns and uses material blending for all targets when
  `backend.compatibilityMode === true` (set at `WebGPUBackend.js:254` from the absence of
  `core-features-and-limits`). Untested on a real compatibility-mode device.
- **Card count.** §6.2 is derived arithmetic, not a production figure. No published count exists.
- **Every performance number in §7** is quoted from elsewhere and re-derivable in an hour with
  `?gputime=1`. None of it was measured here, because there is no hair to measure.

---

## Appendix — how the measurements in this file were taken

Reference plates are the official-site assets named in `stellar-blade-look-spec.md` §7:
`stellar-blade.com/resources/front/images/overview_character.jpg` (3200×1841, `sips` reports
`profile: sRGB IEC61966-2.1`) and `.../post_ms7/08.jpg` (3840×2160). Fetched to the session
scratchpad only, converted JPEG→PNG with macOS `sips` (an sRGB→sRGB identity given the embedded
profile), measured with this repository's own `tools/critic/png.mjs` and `tools/critic/color.mjs`
so "luma" means what the gates mean by it. **⚠️ These are copyrighted by SHIFT UP / Sony
Interactive Entertainment. Internal comparison reference only; `.gitignore` already carries
`/reference/` and `*.reference.jpg`. Nothing was written into the repository.**

Every rect is quoted in full-resolution pixel coordinates of the named file, so any statistic here
can be reproduced by re-fetching the asset and re-running the same two modules.
