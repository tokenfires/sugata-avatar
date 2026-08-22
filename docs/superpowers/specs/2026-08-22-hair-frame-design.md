# The hair frame — design for R31

**Written 2026-08-22.** Approved by the owner the same day, who then stepped away for the cycle
with explicit standing authority to proceed. HEAD at writing: `c5748aa`, tree clean apart from six
untracked groom directories and `tools/critic/scene-gates.selftest.mjs`.

**This is a FRAME document, not a shading round.** Rounds 24–30 each produced a genuine, sourced,
red-proven finding and the picture did not move. `docs/CHECKPOINT.md` §11 names the reason: the
open question stopped being a shading question three rounds ago. This spec exists to make the two
decisions that are actually in front of the project, and to make both of them attributable.

---

## 0. The owner's complaint, mapped to mechanism

Four adjectives, none of them taste. Each maps to a diagnosis already on the record.

| word | mechanism | established in |
|---|---|---|
| **wet** | no readable specular band. R is present at 39.36% of the mass but FLAT — p99 equals the mass mean, ratio 1.00 — riding on a ~59% multiple-scattering pedestal (87% on the crown) | CHECKPOINT §9 |
| **muddy** | the highlight desaturates toward grey as it lightens instead of warming. Slide 39's `sqrt(colour)` broadcasts albedo chromaticity across the whole mass; Chiang et al. EGSR 2016 §4.2 gives the anti-correlation it violates | CHECKPOINT §10, hair.md §0.00 |
| **blocky** | the card primitive showing through — blunt hem slabs, card edges in the silhouette, card facets in the interior | CHECKPOINT §4, §11, §14 (three independent lines) |
| **low-res vs face** | alpha cannot carry a strand at this card size; the trilinear filter removes it CORRECTLY. Face and body are meshes with genuine high-frequency detail | CHECKPOINT §2 |

Two levers cover all four: **the primitive** (blocky, low-res) and **the pedestal** (wet, muddy).
They are independent, and this spec keeps them independent.

---

## 1. The finding that reframes the pedestal

`docs/research/hair.md` §2.1 measured the reference's own fringe percentiles. §9.2 measured our
`scatter` sweep. **The two tables have never been placed beside each other.** Both are encoded luma.

| | p50 vs reference | p95/p50 |
|---|---:|---:|
| reference fringe, `overview_character.jpg` `[1480,540]-[1700,610]`, n = 15,400 | 1.00× | **4.936** |
| ours, `scatter` 0.00 | 1.21× | 3.000 |
| **ours, shipped `scatter` 1.00** | **3.43×** | **1.648** |
| ours, `scatter` 4.00 | 8.09× | 1.223 |

**Our shipped hair's median pixel is 3.43× brighter than the reference's, and the pedestal is the
term doing it.** Eight rounds tried to raise a peak through a floor that was three and a half times
too high. §9.5's conclusion — that even near-grey hair's lobes fall 1.6× short of the requirement —
reads differently once the denominator is known to be inflated.

🎯 **AND IT INVERTS R28's READING OF `ā_f`.** R28 found Zinke's `√C^(1+n)` annihilates the term at
the card-crossing rate and concluded the constant must be wrong. The alternative reading is that
**near-black hair genuinely has almost no multiple scattering** — which is the physics dual
scattering exists to express — and that a pedestal carrying 59% of the mass at `#1A0E0C` is a term
that should be small, held up by a gate that divides by a fixed albedo (hair.md §0.6: floor-limited
with the floor in the numerator). Falsifiable, and §4 below decides it.

### ⚠️ Two caveats carried, not hidden

1. **Different populations.** The reference figure is a fringe RECT; ours is a whole-groom MASK. A
   fringe is shadowed; a groom includes the crown. The comparison is indicative of direction and
   magnitude, not a gate. It becomes a gate only after §3.B re-measures both on matched masks.
2. **Different domains.** §9.4's green rows are RADIANCE; these are ENCODED. The conversion is not
   a power law on this pipeline — `render/Stage.js` sets ACESFilmic on the renderer and the
   no-grade branch still ends in `renderOutput()` (hair.md §9.1). **Quoting a radiance ratio
   against an encoded one is precisely the §0.1 error class.** No target is quoted until one
   measured conversion closes it.

---

## 2. The primitive — target (a) all hair, phased, rule pre-registered

### The decision

**Target: (a) all hair.** Not (b) short-only — the owner is looking at a bob, and CHECKPOINT §4
bounded strands as buying the hem and the silhouette, which is "blocky" outright plus half of
"low-res", on the groom actually in frame. Fixing `crop01` fixes a groom nobody is looking at.
Not (c) not-yet — three independent lines plus a regime statement blocking the entire men's set;
"not yet" has been the answer for three weeks.

**But (a) cannot be committed today, because the only millisecond figure on the record measures a
different architecture.**

### 🎯 Why frostbitten's 3.3 ms does not bind us

`HairFinePass` ~3.3 ms on an RTX 3060 is the cost of a **compute software rasterizer** — 8 px
screen tiles × 32 depth bins, per-pixel linked lists into 8 slices, strict front-to-back blend with
early-out at α 0.999 — built deliberately outside the hardware path. It measures their
**transparency architecture**, not the ribbon primitive.

We would not adopt it. hair.md §5 measured our alternative on this project's own cards:
**alpha-hash + TAAU resolves silhouettes at 27.1% single-pixel transitions against the reference's
own 21.5%** — already inside the reference band. The binding number is *hardware-raster ribbons
through the OIT and temporal resolve we already ship*, and it has never been measured by anyone.

### What can be bounded without the spike, and where it stops

- **Dynamics is the number to worry about and it needs no renderer work.** Today: 496 chains /
  8,432 particles. A frostbitten-density groom is 11.4k × 16 = **182k particles, 21.6×**, on the
  existing DFTL compute pass. One hour, measurable before a single strand renders.
- **Geometry**: ~342k triangles against our 17,000. 20× vertex work — rarely binding at this scale,
  not free.
- **Fragments**: genuinely underivable. Same head so similar coverage; higher depth complexity,
  thinner layers. This is what the spike is for.
- 🚩 **Strand count is the free parameter, not a constant.** 11.4k is frostbitten's figure for
  Sintel's groom; ours has 462 cards. **The spike's deliverable is a strand-count → millisecond
  CURVE**, because that curve IS the LOD story hair.md §7 says hair does not fit without — and
  strand decimation with width compensation at constant total coverage is a far cleaner LOD than
  card LOD.

### The decision rule, registered BEFORE the measurement

| spike result | decision |
|---|---|
| strand bob ≤ **+2.0 ms p50** (parity with today's cards) | **(a) all hair** — cards retired |
| parity for a crop but not a bob | **(b)** short on strands; bob = cards + strand flyaway shell |
| neither, at any strand count with an acceptable silhouette | **(c) not yet** — ship the flyaway shell alone |

(c) is not "nothing". hair.md §0.4/§3.3 measured the reference's silhouette as a **20–60 px flyaway
halo that is not card edges at all**, and §6.2 already budgets 40–60% of cards to that layer. A
strand shell at the silhouette only is the cheapest thing that buys the hem, and it is the floor of
this decision rather than a consolation prize.

---

## 3. The costed spike — ~2 days

The harness exists: `tools/critic/control-frostbitten/` carries `index.control.ts`, the
compose/crop/background-solve chain, `control-blind.mjs`, and a documented headless recipe (two
Deno-2 patches, one frame ≈ 2 s). `GUIDE_SEGMENTS = 16` is confirmed at `hair_cards.py:271`, so
CHECKPOINT §4's claim that no Blender round-trip is needed holds.

⚠️ **Correction to CHECKPOINT §4 while we are here:** it names `scripts/tfx_exporter.py` as the
round-trip we do not need. **That file does not exist anywhere in the tree.** It is not a shortcut
being declined; it is a file to write.

| step | work | est. |
|---|---|---:|
| **A. Exporter** | `tools/figure-pipeline/tfx_export.py` — guide curves → frostbitten `.tfx`, 16 points/strand, direct from `grow_to_cut`. Binary layout verified against **their loader source**, never from memory. | 2–3 h |
| **B. Neutralise** | Their default hair is `rgb(119,43,119)` root → `rgb(76,0,255)` tip. Force `#1A0E0C`; match 720×900 framing and the solved RGB(20,22,26) background. Unneutralised it hands judges "purple" for unrelated reasons (CHECKPOINT §3). | 1–2 h |
| **C. The separation** | Three arms through one judging path: *our groom × our renderer* (on disk), *our groom × their renderer* (**new — the separator**), *their groom × their renderer* (on disk). Arm 1↔2 isolates the RENDERER; arm 2↔3 isolates the GROOM. | 1 h + judging |
| **D. Their cost, our hardware** | frostbitten per-pass timing on this machine at 720×900 and 1080p, replacing a 3060 README figure. | 2 h |
| **E. Our cost, our stack** | **The number that decides.** Isolated three r185 WebGPU prototype: camera-facing ribbons from A's `.tfx`, our Karis material, alpha-hash + TAAU, `?gputime=1`, swept over strand count. No `alive.js` integration. | 1 day |
| **F. Dynamics** | 182k particles through the existing DFTL pass. Independent of A–E. | 1 h |

Step A pays for both C and E, which is what makes this two days rather than a week.

---

## 4. The pedestal's FORM — `ā_f` is derived, never invented

### Why Zinke does not state it

`ā_f` is not a constant of the paper. It is **the average attenuation of the fibre's
forward-scattering over the forward hemisphere** — a property of whatever BCSDF you are using. We
ship that BCSDF, and `HairMaterial.js` carries a complete CPU mirror of it: `hairScatteringValue()`
at `:1878` and `azimuthalValues()` at `:1833`, the same mirror hair.md §9.5 already swept over the
sphere.

**So `ā_f` is a quadrature over our own lobes, per RGB channel, restricted to the forward
hemisphere, evaluated at each `θ_d`.** No plate, no capture, no invented number — a selftest clause.
Same class of move as R26's β_R solve, and the direct answer to R28's "the next untested constant
in this term… now the one that is obviously wrong."

### ⚠️ Step zero, and it is not optional

The exact definition and **normalisation** of `ā_f` must be read off the Zinke SIGGRAPH 2008 paper
before any quadrature is written. A factor-of-π error here would present as a tuning problem and
could absorb another three rounds. Until that read lands, every statement in this subsection is
`[I]`, including the sentence above describing the integral.

### REQ-064, costed

**Free in milliseconds, expensive in calibration.**

- One more analytic light in a loop already running four is not a measurable hair cost.
- The real price: `studio` is byte-identical at `fac62c50d56590fb` and is **the calibration
  reference for all nine scenes.** Moving a key or adding a light re-opens every one of them, the
  skin and eye gates, and G2's saturation clause — already 0.001 inside its bound.
- 🔴 **The cheap escape is closed and already measured.** CHECKPOINT §14 records that `layers`
  cannot give hair its own light: three's node path tests light-versus-CAMERA at
  `Renderer.js:973`, not light-versus-object.
- **Its value is NOT TRT.** R26 measured TRT at 1.30% of a hair pixel even with the key on-axis,
  confirming REQ-064's own warning that "the gain is NOT mostly TRT." Its value is that a near-axis
  light makes the **R** lobe fire toward the viewer — hair.md §9.4's `?ov=key.azimuthDegrees:12`
  row, radiance p95/p50 **1.872 → 4.291**, with the fake off.

**Recommendation: a dedicated low-irradiance near-axis glint light, not a key move.** Bounded cost
— one rig constant plus a re-run of the nine-scene gate table — against a key azimuth change that
redesigns the portrait for every scene.

---

## 5. "Muddy" — the per-channel chromaticity fix

`T_f = d_f · Π_{k=1..n} ā_f(θ_d^k)`, **stored per RGB channel**, with `d_f = 0.7` in [0.6, 0.8]
from Zinke Eq. 4–5 (verified verbatim in CHECKPOINT §10), and `T_f = 1` when `n = 0`. Spread widens
with depth by the same mechanism: `σ̄_f² = Σ β̄_f²` (Eq. 8).

Because each channel attenuates at its own rate, chromaticity sharpens **geometrically** with depth:
deep hair goes darker *and* more saturated, shallow hair brighter *and* less saturated. That is
Beer-Lambert, it is Chiang et al. EGSR 2016 §4.2's anti-correlation, and it is the "warming toward
copper as it deepens" six blind judges asked for across five rounds.

🎯 **Slide 39's `(C/Luma(C))^(1−Shadow)` is luminance-preserving by construction and CANNOT produce
it at any input, however correct.** R28 measured the ceiling at **1.0927×** across the exponent's
entire domain. That is why this is a form change and not a ninth constant.

⚠️ **And the tempting one-line version of that ceiling argument is false**, as R28's own gate
discovered: the FACTOR is luminance-preserving (exactly 1 at both ends, twelve decimals) while the
TERM is not, because the factor multiplies `√C` channel by channel and `Luma(a ⊙ b) ≠
Luma(a)·Luma(b)`. Both statements are clauses in `HairEnvelope.selftest.mjs`. Do not re-derive.

---

## 6. The 2×2, which is how the three-week error is avoided

R28 fixed the depth input and proved it directional — 160,646 of 225,126 gated hair pixels (71.36%)
moved against a noise floor of **exactly zero**, Spearman 0.6118 against the sheet's 0.0598. **But
it is NOT SHIPPED**: the live path still takes `n` from `shadowDensity · depth.png`, and the
envelope path is reachable only through `?hairdefect=envelope-*`. So promoting it is itself a
change, and there are two moving parts rather than one.

One run, one mask, four arms:

| | slide-39 form | Zinke per-channel form |
|---|---|---|
| **sheet input** (shipped) | **A** — control | **C** — the form alone |
| **envelope input** (R28) | **B** — the input alone | **D** — the candidate |

- **A→B** attributes the input. Expected ≈0.21% on pedestal shape — a **null control that SHOULD
  not move.** It is not a wasted arm: it is the proof that whatever D moves belongs to the form.
- **A→C** attributes the form on the old input.
- **B→D** and **C→D** close the square.

**A factorial moves two variables and attributes both** — which is exactly what eight rounds of
moving the groom and the shading together could never do.

Every arm carries a level-matched twin, because hair.md §9.2/§9.4 established that any brightness
change flatters a contrast ratio. The headline statistic is the **pedestal-alone percentile ratio**,
which is exactly invariant to `scatter` and therefore cannot be bought with level — R28 identified
it as the un-gameable number in this term.

---

## 7. How the round is scored

🚩 **The completion gate cannot terminate as operationalised, and this is established.** CHECKPOINT
§4.3: six of six blind judges refused "same-tier" **including all three shown the published
Frostbite reference implementation.** Rewriting the brief has sat as item 3 on §4's next-list since
2026-08-14 and was never done. So:

1. **The owner's four adjectives are the acceptance criterion.** Before/after plates at matched
   framing and exposure, plus 4× crops at the crown and the fringe.
2. **Blind judges stay in as DESCRIBERS only.** CHECKPOINT §4's own rule: a judge's DESCRIPTION is
   reliable, its ATTRIBUTION TO MECHANISM is not — control judge 3 reported a "diagonal cross-hatch
   checkerboard" of "alpha dithering" about a renderer with no dither and no alpha texture at all.
   Take what a judge SEES; never what it says is causing it.
3. **Pixel statistics are the attribution layer**, reported as the §6 factorial, in one domain,
   with the mask and the run stated.

⚠️ **Judges must show the bar** — crops, citations and an exemplar, or the verdict is discarded.

---

## 8. What is explicitly NOT in this round

- **No ninth shading round.** No sweeping of `scatter`, `weightR`, `shadowDensity`, α_R, or any
  other constant as a headline. R26 and R28 measured why each of those is a brightness cut wearing
  a contrast ratio.
- **No deep shadow map, opacity shadow map or light-view transmittance stack.** CHECKPOINT §7
  measured 0.7 percentage points remaining in hair→skin occlusion — about a third of one code
  value — and 81.83% of forehead light is beyond any shadowing algorithm.
- **No `hair_texture.py` `depth.png` generator fix.** R28 refused it by measurement: a correct
  per-fragment per-LIGHT depth moves the pedestal's shape 0.21%, so a per-card baked value cannot
  do more inside the same form. Worth making when the form can spend depth on energy, not before.
- **No re-derivation of anything in CHECKPOINT §2, §7, §9, §10, §11 or hair.md §0–§10.** Those are
  the source of truth for this round.
- **`bob01` IS THE CONTROL AND MUST NOT BE "FIXED"** — sha256 `98ca6c23…`; every committed number
  in this project was measured on it.

---

## 9. Method rules for this round, from the failures that cost most

1. **Pin the revision a reader takes.** `git show <sha>:path`, and state the sha. File ownership
   protects writes, not reads (CHECKPOINT §14).
2. **A table is only as fresh as the last write to the file it describes.** Re-measuring is not
   enough — the probe must EMIT the markdown rather than have it retyped (REQ-091).
3. **Numbers in prose are claims and nothing in the tree checks them.** `tools/quoted-numbers.mjs`
   tags a claim to the command that produces it — and its coverage was 0.038%, and it cannot catch
   an error the producer shares. Both limits are part of its verdict.
4. **A background worker that can stall needs a liveness check that is not its own completion
   callback.**
5. **State the domain beside every number.** Encoded and radiance are not interchangeable on this
   pipeline (hair.md §0.1, §9.1).

---

## 10. Order of work

1. Zinke Eq. 3 read verbatim → `ā_f`'s definition and normalisation. Blocks §4.
2. Reference re-measured on a matched mask in a stated domain. Closes §1's two caveats.
3. `ā_f` quadrature over the CPU mirror, per channel, as a selftest clause.
4. The §6 factorial, one run, one mask, four arms plus level-matched twins.
5. In parallel and independent: spike steps A–F (§3).
6. Score per §7. Iterate at most three times, then stop and report the problem rather than churn.

---

# ADDENDUM — 2026-08-22 evening. §6's factorial is DEAD AS SPECIFIED, and the ordering inverts.

The groundwork ran (12 agents, 0 errors, every deliverable adversarially verified). Three questions
closed cheaply. One closed the wrong way and it reorders the whole plan.

## What closed

| question | answer | where |
|---|---|---|
| Is multiple scattering the lever? | **No — it should be ~zero.** `ā_f ≤ 0.131` everywhere; `T_f = d_f·ā_f^n` is 3.66e-12 at n = 7.55 against a shipped `scatter` of 1 carrying 65.4% of the groom | `no-coloured-lobe-2026-08-22.md` |
| Is the simulation the binding cost at strand density? | **No, by three orders of magnitude.** 0.0646 ms at 182,400 particles = 0.39% of a 16.6 ms frame | dynamics chain |
| Is our hair too bright against the reference? | **No — 1.03× on matched masks.** §1's 3.43× was a mask artefact and the reference rect is skin-contaminated | `hair-reference-2026-08-22.md` |

## 🔴 §6's 2×2 IS A NULL BY CONSTRUCTION AND MUST NOT BE RUN AS WRITTEN

The C and D arms replace slide 39 with Zinke's per-channel `T_f`. **`T_f`'s entire chromaticity
payload is in `ā_f`, and `ā_f` is achromatic with TT off** — the shipped forward hemisphere is R
alone, and R takes no colour argument. The Zinke arms would render at `T_f ≤ 1.17e-2` and
`R/B = 1.0096`: near-black and grey.

**A factorial cannot attribute a colour effect the shipped BSDF cannot produce.** Four arms, a day,
and a null that says nothing about the form — the ninth consecutive "genuine finding, picture did not
move." §8's promise not to open a ninth shading round is kept by NOT running this.

## ⏭️ The corrected ordering

1. **TT, attenuated per light along R28's envelope chord.** ⚠️ Not "turn TT on" — that was tested
   this round and **refuted on pixels**: `?hairlobes=r,tt,trt` takes the groom's R/B from **1.824 to
   0.763**, hue 1.5° → 273.1°, and the TT term alone measures hue 237.4°/sat 0.921 against the rim
   light's 231.8°/0.941 — **agreement to 5.7°, so TT is transmitting `#0f30ff` essentially
   unmodified.** The albedo correction did nothing for it; the cause is the unshadowed rim alone.
   The mechanism is Frostbite's Tier-3 fallback, which CHECKPOINT §10 already identified as the tier
   that fits this rig: `exp(−σ_hair · ℓ)`, per channel, on a geometric path length.
   ⚠️ **This is an EXTENSION of Zinke, not Zinke.** His `T_f` attenuates the global multiple-
   scattering term, not a single-scattering lobe. Record it as ours.
2. **Then** the pedestal form, with `ā_f` finally chromatic (sharpening 11.72× against 1.0096×).
3. **Then** whatever fills the energy hole. REQ-064's near-axis light is the standing candidate
   because it is also the only way to light TRT, the other coloured lobe.

## 🚩 Corrections to this spec's own body

- **§1's "3.43× too bright" is WITHDRAWN.** Matched masks give 1.03×. The dynamic-range shortfall is
  real but 0.58× encoded / 0.38× radiance, not 0.33×.
- **§2's decision rule keeps its CLAUSE and updates its NUMBER.** The clause is "parity with today's
  cards". Today's cards have been re-measured at **+1.46 to +1.71 ms**, not +2.03. Apply the rule at
  measured parity — holding 2.0 once parity is known to be 1.7 would let a slower primitive pass a
  rule that says parity.
- **§2's "~2.6 ms headroom" does not reproduce.** `alive.html` is bimodal on this machine today
  (no-hair p50 6.53–13.27 across rounds of the identical URL). Use p95 or min-of-rounds, never p50.
- **§4's `ā_f` is derived and the answer is in.** `tools/critic/hair-af.mjs`, 14/14 clauses with
  analytic expected values. Zinke states no magnitude for it anywhere, so validation is against
  arithmetic — V3 reproduces the closed form `cosθ_d/2` to twelve digits under both readings.
- **§7's scoring stands**, and `JUDGE-BRIEF.md` now carries the A/B protocol, the decoy-axis
  requirement and the rule against naming the hypothesis in the prompt.
