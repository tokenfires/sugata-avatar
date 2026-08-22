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

---

# 9. ā_f BY QUADRATURE OVER THE SHIPPED BSDF — the number, measured

**Round:** quadrature build, 2026-08-22, appended by a second agent. Sections 0–8 above are the
literature read and are not modified here.

| | |
|---|---|
| Instrument | `tools/critic/hair-af.mjs` (new), gated by `tools/critic/hair-af.selftest.mjs` (new) |
| `f_s` | `hairScatteringValue(...).total` from `packages/core/src/material/HairMaterial.js` |
| Material sha256 | `09f748639e6078e56e8e0e043bbc5e8ffcabcc4b6d36ad80c84a04522882cd88` — **identical to the file at `5bba1bb`**, verified `git show 5bba1bb:packages/core/src/material/HairMaterial.js \| shasum -a 256` |
| Colour | `baseColourDerivation().linear` = `(1.050578e-2, 4.360575e-3, 3.836711e-3)`, `#1A0E0C` |
| Quadrature | midpoint, 180 × 360 in `(u = sin θ_o, Δ)`; `dω = du dφ` so there is no Jacobian to discretise |
| Command | `node tools/critic/hair-af.mjs` · `node tools/critic/hair-af.selftest.mjs` |

Every number in §9 is reproduced by those two commands. Nothing here is derived in prose.

## 9.1 What was actually integrated, and the two readings that are both reported

§2.2 above marks the meaning of the `1/π` **[D]** and tells a build agent to implement Eq. 6 as
printed. Implementing it as printed exposes an ambiguity the paper never resolves: **is `Ω_f` fixed
in the fibre frame, or defined relative to each incident azimuth `φ`?** Both are computed and both
are reported, because picking one would be exactly the invention this file's §8 warns against.

Since `f_s` depends only on the relative azimuth `Δ = φ_o − φ_i`, both collapse onto one 2-D
quadrature with different azimuthal weights:

```
    ā(θ_d) = (cos θ_d / π) ∫_{-1}^{1} ∫_0^{2π} W(Δ) f_s(θ_d, θ_o, Δ) dΔ du,     u = sin θ_o

    reading A  "fixed frame"     W_front(Δ) = π − |Δ − π|      (tent, peaks at forward)
    reading B  "relative frame"  W_front(Δ) = π on (π/2, 3π/2), else 0
```

**[D]** Both carry the same total weight `∫W dΔ = π²`, so they agree exactly on any BSDF that is
azimuthally flat and differ only in how that weight is distributed over `Δ`. **[D]** Reading B is
the one consistent with Zinke's own `s̃_f` ("1/π for forward scattering directions and zero for
backward", p. 4), which is unambiguously relative.

**Which half is forward. [V] + [V].** `Δ = π` is straight-through transmission: Karis' TT azimuthal
term as mirrored in `azimuthalValues`, `exp(−3.65 cos φ − 3.98)`, is maximal at `cos φ = −1`, and
Zinke §3.1 p. 4 says "the strong TT component of hair fiber scattering is included in the front
half-cone". So `Ω_f = {cos Δ < 0}`. Getting this backwards silently swaps `ā_f` and `ā_b`, which is
why V5 below gates it.

## 9.2 🔴 THE VALIDATIONS, RUN BEFORE THE REAL ONE. 14/14, exit 0

Every expected value was written into the source before the run. All measured **[M]** this session
by `node tools/critic/hair-af.selftest.mjs`.

| # | Known answer | Expected | Actual | Tolerance |
|---|---|---:|---:|---|
| V1 | Eq. 6 on `f_s ≡ 1` returns `\|Ω_f\| = 2π` | 6.28318530718 | 6.28318530718 | 7.232e-10, derived as `8·N·ε·\|Ω_f\|` |
| V2 | `∫ M_p dx = 1` over its own variable | 1 | 1.00000000000 | 1e-9 |
| V3A | `f_s = 1/4π`, `θ_d = 0°` → `cos θ_d / 2` | 0.5 | 0.500000000000 | 1.151e-10 |
| V3A | `f_s = 1/4π`, `θ_d = 60°` → `cos θ_d / 2` | 0.25 | 0.250000000000 | 1.151e-10 |
| V3B | same, reading B, 0° / 60° | 0.5 / 0.25 | 0.5 / 0.25 | 1.151e-10 |
| V4a | all lobes off → 0 | 0 | 0 | exact |
| V4b | perfectly absorbing fibre (`C = 0`, R off) → 0 | 0 | 0 | exact |
| V4c | **control:** R alone on a black fibre is NOT 0 | > 1e-6 | 3.187227e-2 | predicate |
| V5A | `ā_f + ā_b` = the whole-sphere integral | 6.604304049e-2 | 6.604304049e-2 | 1e-12 |
| V5B | same, reading B | 6.604304049e-2 | 6.604304049e-2 | 1e-12 |
| V6 | `f_s` is reciprocal | 0 | 1.38778e-16 | 1e-15 |
| V7 | `ā_f < 1` (Eq. 11/13 diverge at 1) | < 1 | 0.131159 max | — |
| V8 | halving the step moves `ā_f` < 1e-3 relative | < 1e-3 | 8.559e-4 | — |

**V3 is the load-bearing one.** For a constant `f_s = c`, Eq. 6 collapses to
`ā_f = (cos θ_d/π)·c·2·π² = 2π c cos θ_d`, and at `c = 1/4π` — **this project's own
`?hairdefect=unit-bsdf` probe constant, the BSDF of a perfect diffuser** — that is exactly
`cos θ_d / 2`. It exercises the `1/π`, the `cos θ_d`, the measure and both `W`s end to end against a
closed form, and it reproduces to twelve digits.

**V4c is the clause that makes V4b mean anything.** Setting the base colour to black does *not*
give `ā_f = 0`: R never enters the fibre, is achromatic, and survives at `3.187e-2`. "Perfectly
absorbing" in this BSDF has to be spelled by disabling R as well. **[M]** — and that fact is the
whole of §9.4.

**Convergence. [M].** At 180 × 360 versus 360 × 720, the worst relative movement anywhere in the
tables is **8.559e-4** (`shipped`/A/`θ_d = 80°`); typical rows move 1e-5 to 4e-5 and quarter their
error per halving (O(h²)). The rows sitting on `W_B`'s step in `Δ` only halve it (O(h)), which is
the honest order for a midpoint rule across a discontinuity. **Read every table below to three
significant digits and no further.**

## 9.3 ā_f, per RGB channel, over θ_d

Grid 180 × 360. `#1A0E0C`. Three significant digits.

**Arm `shipped` — `HAIR_DEFAULTS` exactly, i.e. `weightTT = 0`, TT OFF, as the frame renders today.**

| θ_d° | ā_f.R (A) | ā_f.G (A) | ā_f.B (A) | R/B | ā_f (B), all three | R/B |
|---:|---:|---:|---:|---:|---:|---:|
| 0 | 3.2047e-2 | 3.2010e-2 | 3.2006e-2 | 1.0013 | 3.1872e-2 | 1.0000 |
| 20 | 3.2143e-2 | 3.2106e-2 | 3.2102e-2 | 1.0013 | 3.2765e-2 | 1.0000 |
| 40 | 2.5663e-2 | 2.5639e-2 | 2.5637e-2 | 1.0010 | 2.6984e-2 | 1.0000 |
| 60 | 1.0204e-2 | 1.0194e-2 | 1.0194e-2 | 1.0010 | 1.0502e-2 | 1.0000 |
| 80 | 2.0796e-3 | 2.0782e-3 | 2.0781e-3 | 1.0007 | 1.9251e-3 | 1.0000 |

**Arm `tt-on` — the same with the forward lobe restored (`?hairlobes=r,tt,trt`).**

| θ_d° | ā_f.R (A) | ā_f.G (A) | ā_f.B (A) | R/B | ā_f.R (B) | ā_f.G (B) | ā_f.B (B) | R/B |
|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 0 | 1.1662e-1 | 8.7474e-2 | 8.4170e-2 | 1.3855 | 1.3083e-1 | 9.6952e-2 | 9.3104e-2 | 1.4052 |
| 20 | 1.0471e-1 | 7.8871e-2 | 7.5972e-2 | 1.3782 | 1.1761e-1 | 8.7590e-2 | 8.4216e-2 | 1.3966 |
| 40 | 6.3702e-2 | 4.8183e-2 | 4.6530e-2 | 1.3691 | 7.1330e-2 | 5.3324e-2 | 5.1403e-2 | 1.3877 |
| 60 | 1.8407e-2 | 1.4199e-2 | 1.3803e-2 | 1.3336 | 2.0014e-2 | 1.5153e-2 | 1.4695e-2 | 1.3620 |
| 80 | 2.3357e-3 | 2.1678e-3 | 2.1551e-3 | 1.0838 | 2.2205e-3 | 2.0285e-3 | 2.0140e-3 | 1.1026 |

`ā_b` at `θ_d = 0`, reading A: `shipped` `(3.3996, 3.3437, 3.3385)e-2`; `tt-on`
`(4.9030, 4.3508, 4.2885)e-2`. Reading B: `shipped` `(3.4171, 3.3575, 3.3519)e-2`; `tt-on`
`(3.4813, 3.4029, 3.3951)e-2`. **[M]**

## 9.4 🎯 THE HEADLINE, AND IT IS A MECHANISM FINDING RATHER THAN A NUMBER

**All of ā_f's chromaticity comes from TT, and TT ships off.**

Under reading B the shipped `ā_f` is **exactly achromatic to twelve digits** — the three channels
print identically. That is not a bug in the quadrature; it is the BSDF. With `weightTT = 0` only
R and TRT remain, R is achromatic by construction (it never enters the fibre; `azimuthalValues`
gives `N_R` no `colour` argument), and TRT's azimuthal term `exp(17 cos φ − 16.78)` evaluates to
`exp(−33.78) ≈ 2e-15` at `cos φ = −1` — **TRT lives entirely in the BACK hemisphere.** So the
shipped front hemisphere is R, and R has no colour. Reading A's `1.0013` is the small leak of TRT
through the tent weight's tail into `cos Δ > 0`, and nothing else. **[M] + [D]**

That is the answer to the round's headline question, and it is not the answer the round expected:
**the chromaticity sharpening the six blind judges asked for is available from this BSDF, but only
through the lobe that is currently disabled.**

## 9.5 THE CONSEQUENCE: `T_f = d_f · ā_f^n` at `d_f = 0.7`, `θ_d = 0`

`d_f = 0.7` is **[V]** (Zinke p. 4). The four `n` values are this project's own measurements,
carried in from the brief that owns each. Reading A; reading B is in the tool's output and differs
in the third digit for `shipped` and by ~10% for `tt-on`.

**Arm `shipped` — `ā_f = (3.2047, 3.2010, 3.2006)e-2`, `ā_f.R/ā_f.B = 1.00127`**

| n | T_f.R | T_f.G | T_f.B | **T_f.R / T_f.B** |
|---:|---:|---:|---:|---:|
| 0 (`T_f = 1`, [V] p. 4) | 1 | 1 | 1 | 1.0000 |
| 1.1890 | 1.1708e-2 | 1.1692e-2 | 1.1690e-2 | **1.0015** |
| 4.0654 | 5.8954e-7 | 5.8677e-7 | 5.8651e-7 | **1.0052** |
| 4.7507 | 5.5787e-8 | 5.5480e-8 | 5.5451e-8 | **1.0061** |
| 7.5500 | 3.6625e-12 | 3.6305e-12 | 3.6275e-12 | **1.0096** |

**Arm `tt-on` — `ā_f = (1.1662, 0.87474, 0.84170)e-1`, `ā_f.R/ā_f.B = 1.38548`**

| n | T_f.R | T_f.G | T_f.B | **T_f.R / T_f.B** |
|---:|---:|---:|---:|---:|
| 0 | 1 | 1 | 1 | 1.0000 |
| 1.1890 | 5.4384e-2 | 3.8636e-2 | 3.6907e-2 | **1.4735** |
| 4.0654 | 1.1248e-4 | 3.4947e-5 | 2.9883e-5 | **3.7641** |
| 4.7507 | 2.5795e-5 | 6.5808e-6 | 5.4807e-6 | **4.7065** |
| 7.5500 | 6.2965e-8 | 7.1826e-9 | 5.3706e-9 | **11.7239** |

🎯 **THE CHROMATICITY SHARPENING, AS ONE NUMBER PER ARM AT THE DEEPEST MEASURED `n`:**
**1.00964× as the frame ships, 11.7239× with TT on.** That ratio is the "warms as it deepens
instead of desaturating toward grey" the judges asked for across five rounds. Stated two ways so
neither can be misread: the ratio itself is **11.612×** larger on `tt-on`, and its *departure from
neutral* — the part that is the effect — is **1112.5×** larger
(`(11.7239 − 1) / (1.00964 − 1)`). Both figures print from
`node -e` over `averageAttenuation(..., 'A-front')` at `θ_d = 0`, `n = 7.55`.

## 9.6 THE VERDICT ON THE ROUND'S WORKING HYPOTHESIS — CONFIRMED, EMPHATICALLY

**Does a physically-derived `ā_f` make the multiple-scattering term small for near-black hair? Yes,
overwhelmingly, on both arms and both readings. [M]**

`ā_f` peaks at **3.28e-2** (shipped) and **1.31e-1** (`tt-on`) across all `θ_d`. `T_f` is therefore
already **1.17e-2** at the shallowest measured crossing count `n = 1.189` — a factor of 60 below
`d_f` itself — and **3.66e-12** at `n = 7.55`. Compare the term this replaces: `HAIR_DEFAULTS.scatter`
ships at 1 and carries a measured **65.4%** of the groom's rise above its indirect floor
(`HAIR_DEFAULTS.scatter`'s own comment, `5bba1bb`). Zinke's Eq. 5 evaluated over this project's own
`f_s` says the correct value of that term is **twelve orders of magnitude below the smallest number
in the frame.** §6's `[D]` prediction — "for a strongly absorbing near-black fibre `f_s` is small
everywhere, so `ā_f` is small, so `ā_f^n` collapses within a couple of crossings" — is confirmed with
the numbers attached.

🔴 **And that is a finding with a sharp edge on it, not a licence to ship.** The multiple-scattering
*pedestal* is real physics and it is essentially zero here — but the **chromaticity sharpening the
judges want is carried by the same term**, and at `ā_f ≈ 0.03` there is no energy left in it to
carry anything. **Both arms make the pedestal vanish; only the `tt-on` arm makes it vanish
COLOURFULLY.** If Eq. 5 replaces slide 39, `T_f` does not dim the groom slightly — it deletes 65%
of it. Whatever fills that hole is the next round's question and this file does not answer it.

## 9.7 β̄_f — **[D]**, and the derivation is mine, not the paper's

§4.1 above records that β̄_f has **[X] no defining equation in the ten pages**. The weighting used
here is stated in `forwardVariance`'s docstring and is a derivation:

```
    β̄_f²(θ_d) = Σ_p ā_f,p(θ_d) β_p²  /  Σ_p ā_f,p(θ_d)
```

— each lobe's own longitudinal width, weighted by that lobe's share of `ā_f`, i.e. Eq. 6 run three
times, once per lobe. At `θ_d = 0`, reading B, **[M]**:

| arm | β̄_f.R | β̄_f.G | β̄_f.B |
|---|---:|---:|---:|
| `shipped` | 0.174533 | 0.174533 | 0.174533 |
| `tt-on` | 0.114809 | 0.122988 | 0.124243 |

`shipped` returns `β_R` exactly (0.1745 rad) for the same reason §9.4 gives: R is the only lobe in
the front hemisphere, so the weighted average of one thing is that thing. **[D]**

⚠️ **THE VARIABLE IS LOAD-BEARING AND THE IDENTIFICATION IS [D].** Zinke's `g` is defined in
`θ_d + θ_i` — a *sum* of angles, i.e. twice Marschner's half-angle. `HairMaterial` stores β in
Karis' `sinθi + sinθr`, and `HAIR_BETA_R`'s own comment records `β_K = 2 β_M`. The two are the same
variable to first order in the angles, so the widths above need no factor of two — **but that is a
small-angle identification made here, not a quoted equivalence.** §8 item 3's warning about Figure
9's unprinted units is untouched by this: no value from Figure 9 was used.

## 9.8 🔴 TWO PROPERTIES OF THE SHIPPED BSDF THAT BOUND EVERY NUMBER ABOVE

1. **`weightTT = 0`. TT ships off.** `HAIR_DEFAULTS.weightTT`'s comment at `5bba1bb` gives the
   reason (the rim `RectAreaLight` casts no shadow, three has had no rect-area shadow since issue
   #14161, and TT transmits it straight at camera, rendering the groom blue). This is not a defect
   introduced by this round — it is what ships — but it means **the shipped `ā_f` is an `ā_f` with
   the dominant forward lobe deleted**, and §9.4 is the price.

2. **The shipped BSDF has no `1/cos²θ_d`.** Marschner 2003 §4 writes `S = M_p N_p / cos²θ_d`;
   neither the CPU mirror nor the TSL twin carries the divisor (`grep` for a `cosThetaD*cosThetaD`
   divide in `HairMaterial.js` returns nothing). Whether that is right is a shader question and out
   of this file's scope, but `ā_f` is an integral of `f_s`, so it moves the answer. Priced **[M]**,
   reading B, as the ratio `ā_f(with divisor) / ā_f(as shipped)`:

   | arm | θ_d = 0° | 30° | 60° |
   |---|---:|---:|---:|
   | `shipped` | 1.0237 | 1.7027 | 5.5822 |
   | `tt-on` | 1.0105 | 1.3883 | 4.2485 |

   At `θ_d = 0` it is a 1–2% question; by 60° it is a factor of 4–6. **Every table in §9.3–9.6 is
   the as-shipped BSDF.** If the divisor is ever restored, §9 must be re-run — the verdict in §9.6
   survives it comfortably (`ā_f` stays well under 0.6 at every angle) but the numbers do not.

## 9.9 WHAT §9 DOES NOT ESTABLISH

- **[X] There is still no published `ā_f` to check these against.** §8 item 2 stands. The validation
  here is against *arithmetic* (V1–V8), not against a literature value, because no literature value
  exists. Behavioural validation against Zinke Fig. 8/13 has **not** been done.
- **[X] The A-versus-B ambiguity is not resolved, only bounded.** The two readings differ by up to
  12% on `tt-on`'s `ā_f` and by a factor of ~1.4 on `T_f` at `n = 7.55`. Nothing in the paper picks
  one. Reading B is preferred **[I]** on the `s̃_f` argument in §9.1 and nothing stronger.
- **[X] No render was made.** Every number is CPU quadrature over the mirror. The mirror is held to
  the shader's properties by `HairMaterial.selftest.mjs`, which is not the same as being the shader.
- **[I] The four `n` values were taken as given from the brief.** They were not re-measured here and
  no plate was captured for them.
