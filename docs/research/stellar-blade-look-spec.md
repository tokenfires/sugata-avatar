# The Stellar Blade look — measured parameter spec

Researched 2026-08-06. Confidence markers used throughout:

- **[V]** Verified — Digital Foundry, dev interview, official source
- **[M]** Measured — pixel analysis of official 4K assets (sRGB display values from
  compressed JPEGs; material params back-solved, not read from the engine)
- **[I]** Inference — visual/technical reasoning, explicitly flagged
- **[✗]** Negative finding — searched for, does not exist publicly

---

## 0. The three findings that matter most

### 🎯 1. The face is deliberately flat-lit — key:fill ≈ 1.25:1 **[M]**

Measured across two independent official assets: 3/4 close-up 0.793 → 0.633 (**1.25:1**);
cutscene 0.577 → 0.489 (**1.18:1**).

**Western photoreal cinematics run 4:1–8:1 on faces. This runs under 2:1.**

Form is carried by **rim/kicker lights and a warm/cool hue split**, not by shadow density.

> **Light a Stellar Blade avatar with a conventional three-point ratio and it will read wrong
> no matter how good the shader is. This is the single highest-leverage parameter in the spec.**

### 🎯 2. Skin micro-detail is ~3–5× *lower* amplitude than photoreal **[M]**

High-pass σ on flat lit cheek: **1.44–2.11 / 255**. Photoreal scan-based skin at equivalent
sampling is ~6–12 / 255.

Present but subtle — real fine texture, yet **no individual pores resolve even at 4K on a face
filling half the frame**. The high-frequency signal is **achromatic** (per-channel σ within 3%),
so it's a normal/cavity detail map, not albedo noise.

This is the most reproducible single "Stellar Blade skin" parameter.

### 🎯 3. The engine is UE 4.26 with baked lightmaps and SSR only **[V]**

No ray tracing on any platform, in any mode. No realtime GI. Cascaded shadow maps. Card-based hair.

> **Excellent news for a browser target: the reference look requires nothing we cannot do in
> WebGL/WebGPU.** We are not chasing Lumen or Nanite. We are chasing art direction.

---

## 1. Engine and tech **[V]**

**Unreal Engine 4.26.2** — engine build confirmed via PCGamingWiki and the `SB//UE4/Release-4-26`
version string in the PC binary. SHIFT UP deliberately did *not* move to UE5 for the 2025 PC port.

| Feature | Implementation |
|---|---|
| GI | **Baked lightmaps** (stock UE4). DF: areas without direct light "lack nuance without convincing indirect lighting." |
| Ray tracing | **None** |
| Reflections | **SSR only**, even in 4K mode |
| Shadows | Cascaded shadow maps; some handled in screen space; artifacts on hair |
| Volumetrics | Stock UE4 volumetric fog / light shafts |
| Skin | DF: "supremely high-quality skin shaders" |
| Hair | Card/alpha-based **[I]**; DF notes shimmer and breakup, and a short-hair option shipped as mitigation |
| AA | PS5: TAA + temporal reconstruction. PC: TAA/DLAA/FSR Native AA, DLSS 4, FSR 3.1 |
| Post | Bokeh DOF (resolution-scaled), **film grain (non-toggleable on PS5)**, per-object motion blur, bloom, lens flare |

**Modes:** Resolution 4K/30 (DRS to 2070p); Performance 1440p/60; Balanced ~1296p/60; PS5 Pro adds PSSR.
Apart from resolution, DF confirms *all* settings are identical across modes — only film grain and
bokeh DOF scale with pixel count.

**[✗] No GDC/KGC/Unite talk exists.** The only conference material is two Unreal Fest 2024 Seoul
sessions, neither on character rendering.

---

## 2. Art direction

### Where it sits on the realism axis

**The load-bearing primary quote [V]** — Kim Hyung-tae, Famitsu (Mar 2024), on why moles and
freckles are rendered:

> *"Blade & Soul, which I worked on before, was strongly deformed, and for manga-like expression
> we omitted such details. Now the precision of detail we can render has increased, and we use
> realistic light sources, lighting and objects — so we matched the character depiction to that."*

> **The correct label: idealised *design* executed inside a physically-based *render*.** The
> lighting, materials and post are photoreal-grade UE4. The proportions and features are
> illustration. The idealisation lives in **geometry and albedo**, never in the shading model.
> **Nothing about the render path is stylised.**
>
> For us: build a fully PBR pipeline, then idealise the asset. Not the reverse.

**[V] The scan question, settled.** Kim to Push Square: *"we did base the character of Eve on the
model Shin Jae-eun… **But the face was created originally in-house — it's just the body of the
model that we scanned.**"* So: **body = scanned then idealised, face = 100% authored.**

### Facial proportions **[M]**

Measured from the official 4K frontal portrait, face ~435 px at cheekbones, vs classical canon:

| Metric | EVE | Canon | Delta |
|---|---|---|---|
| Eye width ÷ face width | **0.269** | 0.20 | **+35% larger eyes** |
| IPD ÷ face width | 0.513 | 0.46–0.48 | eyes ~8% wider apart |
| Eye aperture height ÷ width | ~0.40 | 0.33–0.36 | rounder, taller |
| Nose alar width ÷ eye width | **0.77** | 1.00 | **nose ~23% narrower** |
| Mouth width ÷ eye width | 1.20 | 1.50 | narrow relative to eyes |
| Lip vermillion height ÷ face width | 0.138 | 0.10–0.12 | fuller lips |

**[I]** Pronounced V-line jaw taper, undefined jaw angle, small rounded chin, no gonial flare.
Low-to-medium narrow straight nose bridge — the strongest single "Korean idealised" tell.
Full soft cheeks, minimal nasolabial fold, no under-eye hollow. Reads late teens/early 20s.

🚩 **Facial asymmetry is deliberately ABSENT.** The face is near-symmetric; asymmetry is delegated
entirely to hair, fringe and lighting. **Do not add facial asymmetry** — the usual realism advice
is wrong for this target. Blemish noise is near-zero, plus 1–3 hand-placed decorative marks
(**[V]** Kim confirms freckles/moles are *charm features*, not skin realism).

### Skin measurements **[M]**

| Sample | sRGB | HSV S | Luma |
|---|---|---|---|
| Lit cheek, warm key | `#E5BBAB` | 0.23–0.25 | 0.76–0.77 |
| Lit cheek, cool key | `#E5C3C3` | 0.150 | 0.793 |
| Shadow-side cheek | `#C29997` | **0.234** | 0.633 |
| Shoulder, shade | `#977670` | **0.256** | 0.489 |
| **Ear (transmission)** | `#755052` | **0.414** | 0.344 |
| Nose tip specular | `#A08A8E` | 0.161 | 0.561 (p99 0.743) |
| Lower lip | `#794B57` | **0.395** | 0.335 (p99 0.714) |

🎯 **Saturation RISES into shadow** — 0.15 lit → 0.23–0.26 shadow → 0.41 in transmission — and
hue shifts red. That is the pre-integrated-skin red-shifted terminator, and it is strong.
**This gives us an objective SSS validation test** (see §6).

**Gloss [V]:** Kim, asked directly why skin and clothing are so glossy, cites expressing "the
different material qualities of the two worlds" plus "part of it reflects my own preference."
He also explains the skinsuit: *"designed as flesh-coloured **fabric** covering bare skin. The
real skin and the flesh-coloured fabric reflect light differently — that's what creates the
distinctive texture."*

> Not matte porcelain — **K-beauty "glass skin."** Broad, soft, low-intensity highlights across
> T-zone, cheekbones, philtrum, chin. No tight glints, no oily hot spots.

### Hair **[M/I]**

**Card-based, high confidence.** 1:1 crops show flat ribbons with painted strand alphas and
hard alpha-clipped tips; DF notes shimmer/breakup; UE4.26 Groom was beta and not viable at this
perf target; and **[V]** the DLC grooms were outsourced to Airship Interactive, whose published
pipeline is explicitly hair-cards with flow maps and anisotropic shading.

🎯 **Base albedo is essentially black — luma 0.067 (`#150F17`), slightly violet. Anisotropic
highlight bands peak at luma 0.60–0.75. Specular-to-albedo contrast ≈ 10:1.**

> **Do not author brown hair as brown albedo.** It is near-black albedo whose apparent colour
> comes almost entirely from the specular lobes. That ratio, not the albedo, is what makes the
> hair read.

Highlights are **broad, soft, dual-band** — not a tight Kajiya-Kay streak. Very strong
translucency/rim. Heavy root AO (0.35–0.5 multiplier).

**[V]** Kim on the ponytail: *"if it weren't for that hairstyle, we might have cut about a year
off development."* The team repeatedly asked him to shorten it.

### Eyes **[M]**

| Sample | sRGB | Luma | vs cheek |
|---|---|---|---|
| Cheek (reference) | `#96767D` | 0.492 | 1.00× |
| **Sclera** | `#9D7274` | **0.483** | **0.98×** |
| Iris | `#4D2F33` | 0.211 | 0.43× |
| Lid crease / socket | `#352327` | 0.152 | 0.31× |
| Catchlight (p99) | — | 0.651 | 1.32× |

🎯 **The sclera is NOT white.** It measures the same luminance as the surrounding cheek and is
*more* saturated than skin (0.275 vs 0.215), pink-tinted. **A white eyeball instantly breaks the
look.** This comes from heavy lid AO plus sclera SSS.

**[I]** Warm amber-brown iris with radial fibre detail and a bright inner ring. Strong dark
limbal ring, 6–9% of iris radius. **Single dominant catchlight**, small (2–4% of iris diameter),
upper-outer, plus soft ambient wash — not a multi-light array. Iris sits behind a corneal bulge
(parallax present). Bright specular on the lower waterline. Dense eyelash cards. Liner and
warm-brown/mauve shadow **baked into albedo**. Socket occlusion ~3× darker than cheek — heavier
than physically-derived AO would give.

### Body **[V/I]**

Body from a real scan (Shin Jae-eun), then idealised. **[V]** Design priority, verbatim:
*"we put special attention on the back of the character because the player is always facing the
back… That's what they see the most of."* **[I]** ~7.5–8 heads tall, small head, long legs,
narrow waist, athletic-not-muscular, unbroken silhouette curve.

🚩 **[✗] Cite no specific proportion numbers.** All circulating figures are forum comments.
SHIFT UP has never published proportion data — Kim declined to disclose even Eve's age.

---

## 3. Grade **[M/V]**

**Tonemapping [V]:** UE 4.26 ships the ACES-derived filmic tonemapper. Epic's documented defaults —
**Slope 0.88, Toe 0.55, Shoulder 0.26, BlackClip 0, WhiteClip 0.04.**

Measured output:

| Asset | % pixels >0.99 | luma p0.1 | luma p50 | HSV S mean |
|---|---|---|---|---|
| Frontal portrait | **0.017%** | 0.0042 | 0.302 | 0.35 |
| 3/4 face close-up | 1.30% (bg practicals) | 0.0163 | 0.663 | 0.26 |
| Cutscene close-up | **0.036%** | 0.0028 | 0.339 | — |
| Neon action | **0.001%** | 0.0042 | 0.175 | 0.575 |

🎯 **Two engineer-actionable conclusions:**

1. **Highlight rolloff is very soft.** Essentially nothing hard-clips — even a frame full of
   emissive neon puts 0.001% of pixels at white.
2. 🚩 **Blacks are NOT lifted.** p0.1 luma sits at 0.004–0.016. There is **no faded/milky-black
   film grade. Do not add shadow lift** — the commonest mistake when people try to make a render
   look "cinematic."

**Colour cast [M]:** shadows blue-dominant with a magenta lean, RGB (0.042, 0.026, 0.071) — B > R > G.
Midtones near-neutral, faintly magenta. Skin under warm key R:G:B = 1 : 0.83 : 0.75.

Global saturation is **modest in portraits (S ≈ 0.26–0.35)** and **high in neon action (0.58)** —
**the grade doesn't push chroma, the art does.** Chroma lives on the character and the practicals;
the environment is drained.

**Grain [V/M]:** present, non-toggleable on PS5, resolution-scaled, **achromatic (luminance-only)**,
σ ≈ 0.4–0.7/255 on compressed press assets → likely ~1–2/255 in-game. Subtle.

**Chromatic aberration [I]:** not detectable; UE4's `SceneFringeIntensity` defaults to 0. **Treat as off.**

**Bloom [I]:** soft and wide, low/no threshold (everything blooms a little), moderate intensity.

**Vignette [I]:** subtle at most, 0.1–0.2 normalised. ⚠️ Could not be isolated from scene falloff — unmeasured.

---

## 4. Materials **[I/V]**

| Material | Est. roughness | Notes |
|---|---|---|
| Black suit panels | **0.12–0.22** | Latex/PVC. Tight primary highlight **plus** broad secondary sheen → a **clearcoat layer** (0.4–0.7 weight, cc roughness 0.15–0.25) reads correctly |
| White/cream panels | 0.30–0.40 | Satin/coated fabric. Broad soft highlight, no glints. Not matte |
| Flesh-toned "skinsuit" | ~0.38–0.48 | **[V]** Deliberately fabric-over-skin so the two reflect differently — that contrast *is* the design |
| Metal hardware | 0.15–0.35 | **Anisotropic** brushed highlights on cylindrical parts; metalness 1.0 |
| Leather / shearling | 0.55–0.70 | Shearling reads as a **sheen/fuzz lobe**, not diffuse |
| Emissive trim | — | Drives most of the rim lighting in interiors |

> **Everything is wet-adjacent. There are no true Lambertian surfaces on the character.**

---

## 5. Implementable spec

### Skin

```
baseColor (sRGB)      #E3BCA8     // keep albedo HSV S in 0.20–0.26.
                                  // Photoreal scan albedo runs 0.30–0.40 — that gap
                                  // IS the difference between "real" and "Stellar Blade".
roughness  T-zone     0.32 – 0.40
           cheeks     0.42 – 0.50
           limbs      0.45 – 0.55
           lips       0.18 – 0.28
ior                   1.40 – 1.45   (F0 ≈ 0.045–0.05)
clearcoat             0.06 – 0.12   // dual-lobe approximation
clearcoatRoughness    0.22 – 0.30

detail normal map     tiled 8–12× across the face at 2K
normalScale (detail)  0.15 – 0.25   // target high-pass σ 1.5–2.1/255 at 4K.
                                    // Photoreal equivalent is 0.7–1.0 / 6–12 σ.
                                    // We aim for ~one quarter of photoreal pore amplitude.
blemish layer         OFF. 1–3 hand-placed decorative marks only.
facial asymmetry      NONE.

SSS tint (sRGB)       #FF8C73  ≈ (1.00, 0.55, 0.45)
scatter distance      1.0 – 1.5 mm at head scale, R:G:B ≈ 1.00 : 0.35 : 0.22
wrap                  0.45 – 0.55
transmission          strong at ears/alae/fingers — target #755052 @ S 0.41
```

### Hair

```
representation        alpha-blended sorted cards; strand grooms baked to cards
baseColor (sRGB)      #150F17 → #1A1218    // near-black, faint violet
spec:albedo contrast  ~10 : 1

Primary (R) lobe      shift +0.02…+0.05 toward root, roughness 0.25, tint = light colour
Secondary (TRT)       shift −0.05…−0.10 toward tip, roughness 0.45, tint = hair colour ×1.6 chroma
                      // Bands must be BROAD and SOFT — not a tight streak.
backlight wrap        0.5, tint ≈ #8A5A3C for brown
root AO               0.35 – 0.50
flyaways              a few thin single-strand cards at the silhouette
```

### Eyes

```
sclera                must RENDER at ~0.98× cheek luma, NOT white.
                      Achieve via heavy lid AO + sclera SSS, not by darkening albedo.
lid/socket occlusion  ~0.31× cheek luma
iris                  ~0.43× cheek luma; warm amber-brown, radial fibre, bright inner ring
iris diameter         +10–20% vs anatomical
limbal ring           width 6–9% of iris radius, darken ×0.25
cornea                ior 1.376, roughness 0.02–0.05, separate refracting layer, parallax ON
catchlight            ONE dominant, 2–4% of iris diameter, upper-outer, peak ≈1.32× cheek luma
waterline             thin lower-lid specular strip, roughness 0.05
makeup                liner + shadow BAKED INTO ALBEDO
```

### Lighting rig

```
KEY : FILL on face    1.2:1 to 2.0:1   (0.3–1.0 stop)   *** highest-leverage parameter ***
KEY                   broad soft, ~45° off-axis, slightly above eyeline.
                      Warm 4500–6500K OR cool blue — the constant is that key and rim
                      are COMPLEMENTARY, not that either is warm.
FILL                  large, very strong. Ambient/IBL doing most of the work.
RIM/KICKER            1–2 lights, hue-opposed to key. ≈1.0–1.5× key-lit skin luma but
                      MUCH higher chroma. The rim wins on saturation, not brightness —
                      do not blow it out.
BACKGROUND            1.5–2.0 stops below subject, cooler and desaturated (3.8:1 measured)
CAST SHADOW           cool, blue-dominant with slight magenta lean (B > R > G)
```

### Post

```
toneMapping           ACESFilmic. If implementing the parametric curve:
                      Slope 0.88 · Toe 0.55 · Shoulder 0.26 · BlackClip 0 · WhiteClip 0.04
                      // three.js ACESFilmic is slightly more contrasty and desaturates
                      // highlights more than UE's — compensate +3–5% saturation.
highlight clipping    TARGET < 0.5% of pixels above 0.99 luma
black point           NO LIFT. p0.1 luma must land 0.004–0.016.
saturation            global 1.00–1.05, then split: character +8%, environment −15%
bloom                 threshold low/none, intensity 0.25–0.40, WIDE radius
film grain            LUMINANCE-ONLY, σ ≈ 1–2/255, scale with resolution
chromatic aberration  0.0
vignette              0.10–0.20  [unmeasured estimate]
```

### Camera

```
gameplay/orbit FOV    65 – 75° horizontal
portrait FOV          24 – 40° horizontal (≈50–85 mm full-frame equivalent)
DOF                   f/2.8 – f/5.6 @ 50 mm equiv, bokeh not gaussian, resolution-scaled
showcase framing      3/4 rear or profile, LOW camera height, subject at 55–70% of frame
                      height, on a third, silhouette edge as the compositional line
```

---

## 6. 🎯 Objective validation checklist

**These six properties are measurable, so the critic loop gets objective gates rather than
purely subjective critique.** Automate them in `tools/critic`.

1. Face key:shadow luma ratio **< 2:1**
2. Sclera renders at **~0.98× cheek luma**, not white
3. Skin shadow terminator gets **more saturated and redder**, not bluer
4. Flat-skin high-pass σ ≈ **1.5–2.1 / 255** at 4K — not smoother, not sharper
5. **< 0.5%** of pixels clipped above 0.99 luma
6. Black point at **p0.1 luma ≈ 0.004–0.016** — no lift

Reference targets: `overview_character.jpg` and `post_ms7/01.jpg`.

---

## 7. Reference assets

⚠️ **All official Stellar Blade imagery is copyrighted by SHIFT UP / Sony Interactive
Entertainment. For internal visual comparison reference only. Never redistribute, republish,
or ship as part of any product. Do not commit these files to the repository.**

Best sources, all verified by download plus dimension check:

- **Official site** `stellar-blade.com/resources/front/images/` — 24 gallery images at 3840×2160
  plus `overview_character.jpg` (3200×1841, the frontal-face reference used for the proportion
  measurements). Highest value: `overview_character.jpg`, `post_ms7/01.jpg` (3/4 face close-up),
  `post_ms7/14.jpg` (Lily — best skin/blemish/eye reference), `post_ms7/06.jpg` (suit material),
  `post_ms7/08.jpg` (rim light + hair).
- **PlayStation CDN** `image.api.playstation.com` — 4K. 🚩 **Omit the `?w=` query parameter** or
  you get a 304 KB downscale instead of the 3840×2160 original.
- **PlayStation Blog** — 1920×1080 at higher bitrate than Steam.
- 🚩 **Skip Steam CDN** — the "original" is byte-identical to the 1080p version, and 0.4–0.9 MB
  JPEG at 1080p destroys exactly the pore/strand/specular detail needed.

## 8. Dead ends — do not spend more time

**[✗]** No GDC/KGC/Unite talk. **[✗]** No SHIFT UP character-artist ArtStation breakdown — every
wireframe/topology asset online is fan recreation. **[✗]** No published data on the eye shader,
SSS profile, roughness authoring, face topology, blendshape counts, hair card counts, or suit
shader stack. **[✗]** No credible proportion measurements.

One unmined avenue: SHIFT UP's official *"Making Stellar Blade"* and *"The Journey"* video series
may contain character-pipeline footage; transcripts could not be pulled.
