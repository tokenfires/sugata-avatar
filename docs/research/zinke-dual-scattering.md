# Zinke et al. 2008, "Dual Scattering Approximation" — ā_f, ā_b, β̄_f extracted verbatim

**Owner:** this file only. **Pinned read revision for all other project files:** `5bba1bb`.
**Round:** literature extraction, 2026-08-22. Supersedes the `ā_f = sqrt(C)` guess recorded in an
earlier round — see §7.

## 0. Source provenance — read this before trusting a page number

| | |
|---|---|
| Paper | Zinke, Yuksel, Weber, Keyser, *Dual Scattering Approximation for Fast Multiple Scattering in Hair*, ACM TOG 27(3), SIGGRAPH 2008 |
| Artefact read | author preprint PDF, `http://www.cemyuksel.com/research/dualscattering/dualscattering.pdf` |
| sha256 | `68af8e05368aee8789d18f7b590a61726975c73ccd5a5e653bb7a9b87ae5d3ad` |
| Size / pages | 3,910,069 bytes, 10 pages, letter, header *"To appear in the ACM SIGGRAPH 2008 conference proceedings"* |
| Command | `curl -sL -o dualscattering.pdf http://www.cemyuksel.com/research/dualscattering/dualscattering.pdf && shasum -a 256 dualscattering.pdf && pdfinfo dualscattering.pdf` |

⚠️ **Page numbers below are PREPRINT pages 1–10, not ACM DL article pagination.** The ACM version is
Article 32, pages 32:1–32:10; the mapping is 1:1 but the printed folio differs.

**How the equations were read.** Every equation quoted with a `[V]` marker was rendered to PNG at
400 dpi (`pdftoppm -r 400 -f 4 -l 6 -png dualscattering.pdf pg`), cropped with ImageMagick, and read
off the rendered image. **No equation here came from `pdftotext`.** Prose sentences (not equations)
were taken from `pdftotext` and cross-checked against the rendered page.

Confidence markers: **[V]** verified against the rendered primary artefact · **[M]** measured this
session · **[D]** derived here · **[I]** inference, flagged · **[X]** looked for, not present.

---

## 1. 🎯 THE HEADLINE: THE HYPOTHESIS IS CONFIRMED BY THE PAPER'S OWN IMPLEMENTATION SECTION

**ā_f is NOT a constant of the paper. It is a property of whatever BCSDF you ship, obtained by
numerical quadrature.** The paper says so directly.

> **[V] §4.1.1 "Ray Shooting", p. 6, right column, verbatim:**
> "While computing the transmittance (Equation 5) we use a one dimensional lookup table for
> ā_f(θ_d), which is precomputed by numerical integration of Equation 6."

That sentence closes the question the previous round left open. Zinke does not state a magnitude for
ā_f **because there is no magnitude to state** — it is `∫ f_s`, and `f_s` is the renderer's own fibre
BCSDF. "Zinke does not state it" is not a blocker; it is a build instruction.

Corroborating the domain reading, independently: **[I]** Wu et al., *Real-time Level-of-Detail
Strand-based Hair Rendering* (EGSR 2025, arXiv:2405.10565), §3.2: "a_F sums the corresponding
outgoing radiance toward the front hemisphere, including contributions from R, TT, and D lobes of a
single hair." Read from `pdftotext`, so **[I]** not **[V]** — but it independently fixes which of the
two arguments of `f_s` the hemisphere integral runs over (the OUTGOING one).

---

## 2. ā_f — THE EXACT EQUATION. Eq. (6), p. 4, right column

**[V]** Rendered at 400 dpi and read off the image. Verbatim, every factor:

```
                  1     ⌠      ⌠ π/2
    ā_f(θ_d)  =  ───    ⎮      ⎮       f_s( (θ_d, φ), ω )  cos θ_d  dφ  dω ,          (6)
                  π     ⌡Ω_f   ⌡-π/2
```

**[V]** Lead-in sentence, same column, immediately above Eq. 6:
> "We compute the average attenuation ā_f(θ_d) directly from the fiber scattering function f_s as
> the total radiance on the front hemisphere due to isotropic irradiance along the specular cone:"

**[V]** Definition sentence, immediately below Eq. 6:
> "where Ω_f is all directions over the front hemisphere and θ_d is the inclination of direct
> illumination at the scattering event."

### 2.1 Every factor, itemised — this is the π-error section

| Factor | Value, as printed | Notes |
|---|---|---|
| Normalisation constant | **`1/π`. Exactly one.** | There is **no** `1/2`, no `1/2π`, no `1/4π`, and no second `1/π`. **[V]** |
| Outer integration domain | **`Ω_f`** = "all directions over the front hemisphere" | This is the **OUTGOING** direction `ω` — it is the second argument of `f_s`. Measure `dω` = solid angle. **NOT normalised.** **[V]** |
| Inner integration domain | **`φ` from `-π/2` to `+π/2`** | The **INCIDENT** azimuth, swept over the front half of the specular cone at fixed longitudinal inclination `θ_d`. Range length = `π`. **[V]** |
| Cosine weighting | **`cos θ_d`, and nothing else** | ⚠️ **`θ_d` is the function's own argument — it is CONSTANT with respect to BOTH integration variables and factors straight out of both integrals.** There is no `cos θ_i`, no `cos θ_o`, no `cos θ` inside either integral. **[V]** |
| Function of | **`θ_d` only** — one scalar | Hence "a one dimensional lookup table" (§4.1.1). Not a function of `x`, not of `φ_d`, not of `ω_o`. **[V]** |
| Channel count | RGB — one `ā_f` per channel | Not stated at Eq. 6; forced by §4.1.3 storing `T_f` per RGB channel (p. 7, left col: "we store 7 values: T_f and σ̄_f values for each RGB color channel and the direct illumination fraction"). **[V]** for the storage sentence, **[D]** for the implication on Eq. 6. |

### 2.2 The implementable form — [D], derived by pulling the constant out

Because `cos θ_d` does not depend on `φ` or `ω`:

```
    ā_f(θ_d)  =  (cos θ_d / π) · ∫_{Ω_f} ∫_{-π/2}^{π/2}  f_s( (θ_d, φ), ω )  dφ  dω
```

**Reading of the normalisation [D], stated so a build agent can sanity-check it:** the `1/π` divides
by the length of the `φ` sweep (`∫_{-π/2}^{π/2} dφ = π`), which turns the inner integral into an
**average** over the front half-cone — this is the "isotropic irradiance along the specular cone" of
the lead-in sentence. The **outer** `ω` integral over `Ω_f` is a genuine, un-normalised solid-angle
integral — this is the "total radiance on the front hemisphere". So: **average over incident
azimuth, integrate over outgoing hemisphere.** Only that asymmetry makes the result an *attenuation
fraction* rather than a radiance. **This is a derivation, not a quote — the paper does not explain
the `1/π`.** Flagged as **[D]**.

### 2.3 Quadrature recipe for a build agent

```
for theta_d in LUT_bins:                     # 1-D LUT, §4.1.1
    acc = 0
    for omega   in front_hemisphere_samples: # solid angle, un-normalised, weight = dω
        for phi in linspace(-pi/2, +pi/2):   # incident azimuth, weight = dφ
            acc += f_s( incident=(theta_d, phi), outgoing=omega ) * dphi * domega
    a_f[theta_d] = (cos(theta_d) / pi) * acc      # per RGB channel
```

`f_s` is **this project's shipped fibre BCSDF**, whatever it is. If it is a Marschner/Chiang-style
R+TT+TRT lobe stack, all lobes contribute — Eq. 6 integrates `f_s`, not one lobe. **[V]** that Eq. 6
takes `f_s` whole; **[V]** footnote 3, p. 7: "The BCSDF has three lobes, one for each component: R,
TT, and TRT."

### 2.4 Range of ā_f

**[X] The paper never states a numeric value, a range, or a bound for ā_f.** Searched all 10 pages.

**[D] `ā_f < 1` is forced, not stated.** Eq. 11 (p. 5) is `Ā_1 = ā_b ā_f² / (1 − ā_f²)` and Eq. 13 is
`Ā_3 = ā_b³ ā_f² / (1 − ā_f²)³`; both are closed forms of geometric series `Σ_{i=1}^{∞} ā_f^{2i}`,
which diverge at `ā_f = 1`. So `ā_f ∈ [0, 1)` strictly. That is a derivation from the paper's own
algebra, not a quoted claim.

---

## 3. ā_b — Eq. (12), p. 5, left column. IDENTICAL EXCEPT THE DOMAIN

**[V]** Rendered at 400 dpi and read off the image:

```
                  1     ⌠      ⌠ π/2
    ā_b(θ_d)  =  ───    ⎮      ⎮       f_s( (θ_d, φ), ω )  cos θ_d  dφ  dω ,          (12)
                  π     ⌡Ω_b   ⌡-π/2
```

**[V]** Lead-in, immediately above:
> "ā_b(θ) is the average backward scattering attenuation. It is computed similar to Equation 6 from
> fiber BCSDF for isotropic irradiance along the specular cone as"

**[V]** Definition, immediately below (p. 5, right column, first line):
> "where Ω_b is all directions over the back hemisphere."

**The only difference from Eq. 6 is `Ω_f → Ω_b`.** Same `1/π`, same `[-π/2, +π/2]` on `φ`, same
`cos θ_d`. Confirmed character-by-character against the rendered crop. **[V]**

### 3.1 Where ā_b and ā_f are consumed (local scattering, for completeness)

**[V]** p. 5, all read off the rendered page:

```
    Ā_1(θ)  =  ā_b Σ_{i=1..∞} ā_f^{2i}   =   ā_b ā_f² / (1 − ā_f²)                    (11)

    Ā_3(θ)  =  ā_b³ Σ_{i=1..∞} Σ_{j=0..i-1} Σ_{k=j+1..∞} ā_f^{2(i-j-1+k)}
            =  ā_b³ ā_f² / (1 − ā_f²)³                                                (13)

    Ā_b(θ)  =  Ā_1(θ) + Ā_3(θ)                                                        (14)

    f_back(ω_i, ω_o)  =  (2 / cos θ) · Ā_b(θ) · S̄_b(ω_i, ω_o)                         (10)
```

**[V]** p. 5, below Eq. 10: "where `θ = (θ_o − θ_i)/2` is the difference angle of incident and
outgoing inclinations and an additional `cos θ` factor accounts for the fact that light is roughly
scattered to a cone as in [Marschner et al. 2003]."

**[V]** p. 5, above Eq. 13: "Since ā_b(θ) is small for human hair fibers, we disregard the paths with
more than 3 backward scattering events."  ← *the paper's only qualitative statement about the
magnitude of either average attenuation, and it is about ā_b, not ā_f.*

---

## 4. β̄_f — Eq. (8), p. 4, right column. AND THE HONEST GAP

**[V]** Rendered and read off the image:

```
    σ̄_f²(x, ω_d)  =  Σ_{k=1..n}  β̄_f²( θ_d^k ) ,                                      (8)
```

**[V]** and the spread function it feeds, Eq. (7), p. 4, right column, rendered:

```
                            s̃_f(φ_d, φ_i)
    S_f(x, ω_d, ω_i)  =  ───────────────── · g( θ_d + θ_i , σ̄_f²(x, ω_d) ) ,          (7)
                              cos θ_d
```

**[V]** immediately below Eq. 7:
> "where s̃_f(φ_d, φ_i) is 1/π for forward scattering directions and zero for backward scattering,
> and σ̄_f²(x, ω_d) is the total variance of forward scattering in the longitudinal directions. Since
> the BCSDF of a fiber is represented by a Gaussian distribution (M) in longitudinal directions, we
> can compute the total variance as the sum of variances of all scattering events along the shadow
> path"

**[V]** the `g` convention — §2.2, p. 3, left column, and it matters for normalisation:
> "Note that in this paper, g(a, b) refers to a unit area Gaussian function defined in variable a
> with a zero mean and variance b."

⚠️ **`g` is UNIT AREA (integrates to 1 over its variable), not unit peak.** Its peak height is
therefore `1/(σ̄_f √(2π))`, which grows without bound as `n → 0`. **[D]**

**[V]** immediately below Eq. 8:
> "where β̄_f²(θ_d^k) is the average longitudinal forward scattering variance of the k-th scattering
> event, which is directly taken from the BCSDF of the hair fiber. Note that for a single directional
> light source when n = 0, i.e. when the fiber is being illuminated directly, the spread function
> becomes a delta function δ(ω_d − ω_i)."

### 4.1 🔴 THE GAP, STATED PLAINLY

**[X] The paper gives NO explicit integral, and no closed form, defining β̄_f.** It is defined only by
the phrase *"directly taken from the BCSDF of the hair fiber"*. Unlike ā_f (Eq. 6) and ā_b (Eq. 12),
β̄_f has **no equation number of its own anywhere in the 10 pages.** I searched all of them.

What the paper *does* give, all **[V]**:

- **§2.2, p. 3:** "M is modeled as a normalized Gaussian function `g(α_t, (β_t)²)` with mean `α_t` and
  standard deviation `β_t` specified according to measured properties of hairs" — for each of the
  three reflection types `t ∈ {R, TT, TRT}`.
- **Figure 5 caption, p. 7:** "α and β values are measured hair characteristics (part of the BCSDF)."
- **Footnote 3, p. 7:** "The BCSDF has three lobes, one for each component: R, TT, and TRT."
- **Eq. 23 lead-out, p. 7:** "where β²(θ) is the variance of the scattering lobe of the BCSDF."
- **Figure 9 caption, p. 8, concrete magnitudes:** "Comparison for varying longitudinal widths β_R,
  β_TT, and β_TRT of the BCSDF (from left to right) (4, 5, 7.5), (8, 10, 15), (16, 20, 30)."
  **[I] Units are not printed in the caption; Marschner's convention makes these DEGREES of standard
  deviation.** Flagged — do not treat as radians.
- **Table 1, p. 7** lists the precomputed tables and β̄_f is **not among them**: only `Ā_b(θ)` (Eq. 14),
  `Δ̄_b(θ)` (Eq. 16), `σ̄_b²(θ)` (Eq. 17), `N^G(θ, φ)` (Eq. 25). **[V]**

**[I] Implementation implication:** `β̄_f(θ_d)` must be an attenuation-weighted average of the
per-lobe widths `β_t` over the lobes landing in the FRONT hemisphere — the same weighting Eq. 6
applies to magnitude, applied to width. The paper does not write this down. Any build agent that
needs it is **deriving, not quoting**, and must say so.

### 4.2 The backward siblings, for the record (p. 5–6, all [V] off rendered pages)

```
    S̄_b(ω_i, ω_o) = [ s̃_b(φ_i, φ_o) / cos θ ] · g( θ_o + θ_i − Δ̄_b(θ) , σ̄_b²(θ) )       (15)

    Δ̄_b ≈ ᾱ_b ( 1 − 2ā_b²/(1 − ā_f²)² ) + ᾱ_f ( ( 2(1−ā_f²)² + 4ā_f²ā_b² ) / (1−ā_f²)³ )  (16)

              ā_b √(2β̄_f² + β̄_b²)  +  ā_b³ √(2β̄_f² + 3β̄_b²)
    σ̄_b ≈ (1 + 0.7ā_f²) ─────────────────────────────────────────                     (17)
                        ā_b + ā_b³ ( 2β̄_f + 3β̄_b )
```

**[V]** p. 5, above Eq. 16: "In practice, we use the following analytical approximations" with
footnote 2: "These analytical approximations are numerical fits based on a power series expansion
with respect to ā_b up to an order of three." **Note the `0.7` in Eq. 17 is a curve-fit constant and
is unrelated to `d_f = 0.7`.** **[D]**

**[V]** p. 5: `s̃_b(φ_i, φ_o)` "is 1/π for backward scattering directions and zero for forward
scattering".

---

## 5. RE-VERIFICATION of the equations this project already carried

All four were asked to be re-verified, not assumed. All four **[V]**, rendered at 400 dpi.

| Claim previously on record | Verdict | Evidence |
|---|---|---|
| `Ψ^G ≈ T_f · S_f` | ✅ **[V]** | Eq. 4, p. 4, left col: `Ψ^G(x, ω_d, ω_i) ≈ T_f(x, ω_d) S_f(x, ω_d, ω_i)` |
| `T_f = d_f · ∏_{k=1..n} ā_f(θ_d^k)` | ✅ **[V]** | Eq. 5, p. 4, left col, rendered — `T_f(x, ω_d) = d_f(x, ω_d) ∏_{k=1}^{n} ā_f(θ_d^k)` |
| `d_f = 0.7`, range `[0.6, 0.8]` | ✅ **[V]** | p. 4, right col: "we found that for realistic human hair models density factors between 0.6 and 0.8 give realistic results (as compared to a path tracing reference). For all examples in this paper, the density factor is set to 0.7." Restated Fig. 13 caption, p. 9. |
| `T_f = 1` when `n = 0` | ✅ **[V]** | p. 4, left col, below Eq. 5: "Note that if n = 0, the point x is illuminated directly and the transmittance function is set to 1." |
| `σ̄_f² = Σ β̄_f²` (Eq. 8) | ✅ **[V]** | Eq. 8, p. 4, right col, rendered — see §4 above |
| GPU form stores `T_f` and `σ̄_f` **per RGB channel** | ✅ **[V]** | §4.1.3, p. 7, left col: "Instead of keeping a single opacity value for each map pixel as suggested by the deep opacity maps method, we store 7 values: T_f and σ̄_f values for each RGB color channel and the direct illumination fraction." |

Also confirmed, **[V]**, the multiple-scattering split, Eq. 3, p. 3:
`Ψ(x, ω_d, ω_i) = Ψ^G(x, ω_d, ω_i) ( 1 + Ψ^L(x, ω_d, ω_i) )`.

⚠️ **Correction to an earlier project note.** A prior file described `ā_f` as "bounded by 1" as though
the paper said so. **The paper does not.** See §2.4 — that bound is derived from Eq. 11/13
convergence, and should carry **[D]**, not **[V]**.

---

## 6. THE FIVE ANSWERS THE TASK ASKED FOR

### Q1 — the exact ā_f equation, every factor
**§2 above. [V].** `1/π`, one of them. Outer `∫_{Ω_f} dω` over the **outgoing front hemisphere**,
un-normalised. Inner `∫_{-π/2}^{π/2} dφ` over the **incident azimuth** on the specular cone.
`cos θ_d` — a constant that factors out. Function of `θ_d` alone. Eq. (6), p. 4, right column.

### Q2 — ā_b and β̄_f
**ā_b: §3. [V].** Eq. (12), p. 5 — identical to Eq. 6 with `Ω_f → Ω_b`.
**β̄_f: §4. [X] for an equation** — the paper gives none. Only "directly taken from the BCSDF",
Gaussian `M` widths `β_R, β_TT, β_TRT` per §2.2, with worked magnitudes `(4, 5, 7.5)`, `(8, 10, 15)`,
`(16, 20, 30)` in Figure 9 (**[I]** degrees).

### Q3 — magnitude or plausible range for ā_f, dark/black hair specifically
🔴 **[X] ABSENT. The paper states no magnitude, no range, and no dark-hair value for ā_f anywhere in
its 10 pages.** Every parameter table and figure caption specifies hair by **absorption coefficient**,
not by ā_f. The only adjacent statement is about ā_b, p. 5: *"Since ā_b(θ) is small for human hair
fibers…"* — **that is ā_b, not ā_f, and "small" is not a number.** **[V]** that the sentence exists;
**[X]** that any number accompanies it.

**The darkest hair the paper actually renders**, and the closest thing to a dark-hair anchor in the
whole document: **[V]** Figure 8 caption, p. 8: "Comparison for various hair colors with RGB
absorption coefficients (from left to right) (0.03, 0.07, 0.15), (0.15, 0.2, 0.3), (0.2, 0.3, 0.5),
and (0.3, 0.6, 1.2)." **[I] Even the darkest of those four is a dark brown, not black. The paper
never renders black hair.**

### Q4 — what does `n` count?
**`n` counts fibre intersections along the SHADOW PATH, from the shading point `x` toward the light
direction `ω_d`. [V].** Three sentences, all quoted verbatim:

> **p. 3, §3.1:** "we simplify the computation of global multiple scattering by exploring the light
> scattering properties along only a single light path, namely the shadow path (in the direction
> ω_d), and use the information we gather for approximating the contributions of other possible
> paths (Figure 3)."

> **p. 4, §3.1.1, immediately above Eq. 5:** "the transmittance function depends on the number of
> scattering events n along the shadow path and the average attenuation ā_f(θ_d) caused by each
> forward scattering event as"

> **p. 6, §4.1.1 — the operational definition, and the one to implement against:** "To find the
> forward scattering transmittance and spread at point x due to illumination from direction ω_d, we
> shoot a ray from x in the direction ω_d. If the ray does not intersect with any hair strands, T_f
> is taken as 1, σ̄_f is set to zero, and the direct illumination fraction becomes 1. If there is an
> intersection with a hair strand, the direct illumination fraction becomes zero and we update the
> transmittance and variance values using equations 5 and 8."

`θ_d^k` is the longitudinal inclination at the k-th of those crossings (**[V]**, p. 4: "θ_d^k is the
longitudinal inclination at the k-th scattering event"). **[D]** In a shader where the fibre
direction is roughly constant through the shadow path, all `θ_d^k` collapse to one `θ_d` and Eq. 5
degenerates to `T_f = d_f · ā_f(θ_d)^n`, Eq. 8 to `σ̄_f² = n · β̄_f²(θ_d)`.

### Q5 — 🎯 what the paper says about LOW-ALBEDO / DARK hair. THIS IS THE LOAD-BEARING ONE.

**The paper contains FIVE statements pointing the same way, and ZERO pointing the other way.** All
**[V]**, quoted verbatim.

> **(1) §3.1 opening sentence, p. 3, right column bottom → p. 4 — the most direct one:**
> "Global multiple scattering is especially important for light colored hair types as they permit
> outside illumination to penetrate deeper into the hair volume."

> **(2) Abstract, p. 1:** "When rendering light colored hair, multiple fiber scattering is essential
> for the right perception of the overall hair color."

> **(3) §2.1 Prior Work, p. 2 — the sharpest one for our purposes, because it says what SINGLE
> scattering alone achieves:** "[Marschner et al. 2003] … their model was able to account for
> important single scattering effects, such as multiple highlights, and deliver realistic results
> **for dark colored hair**. Further work showed that multiple fiber scattering is essential for
> correct perception of hair color, **particularly for light colored hair**."

> **(4) §3.1, p. 4, left column:** "Note that the strong TT component of hair fiber scattering is
> included in the front half-cone. Therefore, for light colored hair models forward scattering is
> significantly stronger than backward scattering. … As a result, for light colored hair types only
> a very small portion of global multiple scattering includes backward scattering."

> **(5) §3.2, p. 5, left column:** "Because of this backward scattering, local multiple scattering is
> mostly smooth with subtle changes over the hair volume, yet it significantly affects the visible
> hair color **especially for light colored hair types**."

**And the paper's stated failure mode runs in the OPPOSITE direction from ours. [V], §6
Discussion, p. 9:**
> "if the mean path length is large (as in sparse hairstyles) or **if attenuation coefficients are
> very small**, the global structure of a hairstyle tends to play an important role that biases the
> results."

**[V], §5 Results, p. 7, on Figure 7:** "Even though the approximation slightly overshoots the
accurate simulation **for very low coefficients**, the results indicate that our approach is a viable
approximation for scattering from a cluster."

Low absorption = light hair = where dual scattering is stressed and *overshoots*. Dark hair is the
easy end. Nowhere does the paper warn about dark hair.

#### 🔴 THE HONEST LIMIT OF THIS EVIDENCE — read this before quoting §6 Q5 as proof

**No sentence in the paper says "multiple scattering is negligible for dark hair."** That exact claim
is **[X] — absent.** What the paper *does* say, five times, is that multiple scattering is
**especially / particularly important for LIGHT** hair, and once (statement 3) that single scattering
alone was **already realistic for dark** hair. The working hypothesis — *near-black hair genuinely
has almost no multiple scattering* — is **strongly consistent with, and nowhere contradicted by, the
paper**, and statement (3) is the closest the literature comes to endorsing it. But it is an
**[I] inference from a body of asymmetric statements, not a [V] quote.** Do not write it into a
justification comment as though Zinke said it. Zinke said the converse-adjacent thing about light
hair.

**[D] The mechanism, though, is not in doubt and does not need the quote.** `T_f = d_f · ∏ ā_f` with
`ā_f = ∫ f_s` over the front hemisphere: for a strongly absorbing (near-black) fibre, `f_s` is small
everywhere, so `ā_f` is small, so `ā_f^n` collapses within a couple of crossings. The physics of
Eq. 5–6 delivers "almost no multiple scattering for black hair" **as an output**, without the paper
needing to assert it. **That is the finding to build on: don't tune ā_f to defend the pedestal —
compute ā_f from the shipped BCSDF and let the pedestal fall where Eq. 5 puts it.**

---

## 7. WHAT THIS RETIRES

- 🔴 **`ā_f = sqrt(C)` is refuted. [D].** Eq. 6 is a hemisphere quadrature of `f_s`, weighted by
  `cos θ_d / π` and averaged over the incident azimuth. It is not any function of a single
  absorption/albedo constant, and it is not a square root of anything. The earlier round's value
  (0.1016 / 0.0663 / 0.0606, taken from TT absorption at h=0) has no relationship to Eq. 6's
  integrand — TT at h=0 is one lobe at one offset, whereas Eq. 6 integrates all lobes over `2π` sr of
  outgoing directions and `π` rad of incident azimuth.
- 🔴 **Raising ā_f to `1+n` was also wrong. [V].** Eq. 5 is `∏_{k=1}^{n}` — exponent `n`, not `n+1`;
  `d_f` is a separate multiplicative factor, not an extra power of `ā_f`. At `n = 0` the product is
  empty and the paper explicitly sets `T_f = 1` (p. 4), which an `n+1` exponent would break.
- ✅ **"Zinke does not state ā_f's magnitude" stops being a blocker.** §4.1.1 says it is precomputed
  by numerical integration of Eq. 6 from the renderer's own `f_s`. **The next step is quadrature over
  this project's shipped BCSDF, not a literature search.** Nothing further needs re-fetching from
  this paper.

## 8. WHAT IS STILL OPEN AFTER THIS ROUND

1. **β̄_f has no defining equation in the paper. [X].** A build agent needs an attenuation-weighted
   front-hemisphere average of `β_R / β_TT / β_TRT` and must mark it **[D]**, not **[V]**.
2. **No ā_f magnitude exists to check a quadrature result against. [X].** There is no published
   number for this project's `ā_f` to be validated against — the validation has to be behavioural
   (does `T_f` fall the way Fig. 8/13 do), not numeric.
3. **Figure 9's β units are unprinted. [I] degrees.** If a build uses them, that assumption is load-bearing.
4. **The paper never renders black hair. [I].** Darkest is RGB absorption `(0.3, 0.6, 1.2)`, Fig. 8.
   Our regime is outside every figure in the paper.
