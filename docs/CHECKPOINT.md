# Checkpoint — the hair phase paused 2026-08-13, control run 2026-08-14

**Written so a successor with none of this conversation can resume without re-deriving it.**

HEAD at writing: `a9a121c`, tree clean, nothing pushed (see *The remote* below).
Suite: 49 gates, 5 red, all declared in `docs/RED-GATES.md`, UNDECLARED RED 0.

---

## 1. Where the project is

| Phase | State |
|---|---|
| 0 Foundation, 1 Body/identity | done |
| 2 Ocular + idle | landed, gates green |
| 3 Rendering | skin, eyes, lighting, AA/grade, GTAO done. **Hair paused — see §2** |
| 4 Speech | viseme timeline, prosody landed |
| 5 Affect | PAD, WASABI, LM Studio, body actuation landed |
| **6 Body motion** | **unstarted** (6.9 added from REQ-058) |
| **7 Runtime API** | **unstarted — and this is R7, arguably the brief's core requirement** |
| 8 Blind critic loops | running continuously; the mechanism that finds everything |
| 9 Wardrobe | plumbing, foundation, agency, shadows, hem done; 9.9 capsule and 9.10 cultural dress open |
| 10 Identity sculpting | catalogue and targets landed; the human–AI coherence loop unbuilt |

**The two largest unstarted blocks are Phase 6 and Phase 7.** Phase 7 is the one that makes this a
library any agent can embed, which is requirement R7 in `docs/BRIEF.md`.

---

## 2. 🚩 The hair phase, paused after eight rounds — read this before touching hair

> 🚩 **READ §9 BEFORE ANYTHING ELSE IN THIS SECTION.** R26 refuted the light-path hypothesis on
> pixels, measured all three of REQ-063/064/065, and found the missing highlight in a lobe width
> that had been authored at the middle of its range by default since R13. §8's closing pointer to
> "REQ-063/064/065 come before any further lock work" is superseded by §9's measurements.
>
> **Read §7 first, then §4.** The control has been run — and §7 records that §4 judged the WRONG
> PLATES, so §4's hair→skin occlusion row is WITHDRAWN. Its hem and card-edge rows survive.
> Nothing in this section is retracted, but §4 and §7 together tell you which parts of it matter.

Rounds 13–23 built hair from zero: a procedural card groom (`assets/hair/bob01`, 462 cards,
`tools/figure-pipeline/hair_cards.py` + `hair_texture.py`), Karis' closed-form Marschner with a
per-fragment strand field (`material/HairMaterial.js`), five transparency arms
(`render/HairOIT.js`, shipped `stochastic`), and DFTL dynamics in a compute pass
(`motion/HairDynamics.js`), all live on `alive.html?hair=1`.

**Every round produced a genuine, sourced, red-proven finding. The picture did not move.** The last
three blind critics each concluded the bald render is the better one. That pattern — correct local
measurement, no global progress — is the signature of a wrong FRAME, not poor execution.

### What is actually established (do not re-derive these)

- **Alpha cannot carry a strand at this card size.** A 7-texel run is 1.9 scene-pass pixels while
  the trilinear filter at the sampled lod is 4–5.7 texels wide. The filter removes it CORRECTLY —
  keeping it would alias. Even pixels covered by exactly ONE card deliver 1.614 runs of the atlas's
  3.637. `git show 4efcca7`.
- **The groom is not a surface.** p85−p50 of the outer envelope is 10.03–11.69 mm inside a single
  3°×30 mm bin — an eleven-millimetre cloud of cards at seven standoffs. No lock can be louder than
  that cloud without rendering as storm damage (±45 mm corrugation = 90 mm peak-to-trough on a
  142 mm head). **The lever is the scatter, not the relief.** `git show b6a6a25`.
- **The albedo was a physical error, now fixed.** `#150F17` is R21 G15 B23 — blue above red. Melanin
  absorption cross-sections (d'Eon et al., EGSR 2011 §6.1) make `exp(−k·σa)` R>G>B at every
  concentration, so **no melanin mixture produces that hex.** Five blind critics reported "lavender/
  mauve/aubergine/purple" across five rounds and it was filed as taste each time. Now `#1A0E0C`, a
  70.2° hue rotation at constant L\* and C\*. `git show a9a121c`.
- **Multiple scattering broadcasts the albedo.** Slide 39's fake carries 66% of the mass's lightness
  and 98% of its b\* deficit, because its colour is `sqrt(colour)`. It is also why contrast is
  FLOOR-LIMITED with the floor in the numerator: sweeping its scalar moves the contrast ratio
  2.92→7.97 while the plate's own dynamic range moves 3.000→1.223, monotone in OPPOSITE directions.
- **TRT is not firing.** `D_TRT = exp(17cos φ − 16.78)` is retroreflective and the portrait rig has
  no light near the view axis, so it contributes L\* 0.16 of 25.18 — 0.6%.

### 🎯 The methodological hole, which is the real finding

**No control was ever built. A known-good hair asset has never been through this renderer.** Every
round moved the groom AND the shading and measured the result, so no round is attributable. Eight
rounds, two free variables, no way to separate them.

### The structural suspects, and one correction

**(A) "Deferred is hostile to hair" — WRONG AS FRAMED, and corrected from our own source.**
`HairNodeMaterial extends MeshPhysicalNodeMaterial` with a custom lighting model, so hair is already
shaded **forward**, in the material, during the MRT pass. `GBuffer.js` is an attribute buffer for
post effects, not a lighting G-buffer.

**The real mismatch is narrower and is twenty lines of installed three.js.** In
`node_modules/three/examples/jsm/tsl/display/TAAUNode.js`:
- `:678` `isDisocclusion = closestDepth − previousDepth > depthThreshold` (`0.0005` at `:105`)
- `:751` invalid history sets `currentWeight` to 1 — the accumulator is fully replaced
- `:743` `isDepthChanged` is **TWO-SIDED**, and `:744` `canLock = isValidUV && !isDepthChanged`

So the **thin-feature lock** — the one mechanism designed to preserve exactly the sub-pixel
high-frequency detail hair is made of — is gated off by a two-sided depth change, and a dithered
coverage decision changes depth in both directions every frame. **Our coverage mode and our temporal
resolve are in direct contradiction at hair pixels.** Not yet acted on.

**(B) The card may be the wrong primitive — supported by both published sources.** Our cards are
~35 scene-pass pixels wide and are asked to carry lock, clump and fibre scale at once. Two
independent competent real-time hair renderers (§3) both use **one fibre-wide camera-facing ribbon
per strand** and put lock/clump structure in strand POSITIONS. Neither uses narrower cards. The
2024 Yuksel paper cites the card-with-atlas approach only as what the field moved away from.

---

## 3. The two sources read on 2026-08-13, and what they license

**`Scthe/frostbitten-hair-webgpu` — MIT, and it is usable.**
A standalone WebGPU strand renderer + simulator re-implementing Frostbite's system. Raw WebGPU +
WGSL, ~30 passes, deps only `dat.gui`/`webgl-obj-loader`/`wgpu-matrix`. **Runs headless under Deno
to PNG**, which matters for using it as a control. Ships a TressFX `.tfx` of 11,400 strands × 16
points.
- **Transparency:** a compute SOFTWARE RASTERIZER outside the hardware path. Screen tiles (8 px) ×
  32 depth bins, per-pixel linked list into 8 slices, strict front-to-back blend with early-out at
  α 0.999. Coverage is **ANALYTIC** — `alpha = 1 − |interpW.x·2 − 1|` across the projected strand
  width. No texel, no mip, no filter, **no dither, no TAA at all**.
- **Costs:** `HairFinePass` ~3.3 ms on an RTX 3060 (README:190, CHANGELOG) at an unstated
  resolution, excluding four other passes. Our whole hair budget is ~3 ms. **A full strand path may
  not fit** and nobody can say yet.
- **Assets are NOT MIT:** the Sintel hair/meshes are BlendSwap-licensed with their own terms.
- ⚠️ **Its default hair colour is literally purple** — `rgb(119,43,119)` root, `rgb(76,0,255)` tip.
  Must be neutralised before any blind capture or it hands critics the same word for unrelated
  reasons.

**Yuksel hair meshes — PATENTED. Read for ideas only.**
`cemyuksel.com` states verbatim: *"Hair meshes are protected by US and Internal patents"*, with a
2011 patent in the page's own BibTeX. The SIGGRAPH 2024 paper is CC-BY; **no source is published**.
It also needs **mesh/task shaders, which WebGPU does not have**, and its own §5 says arbitrary
strand models cannot be converted into the representation. At render time it resolves to
camera-facing triangle strips one fibre wide — the same primitive as frostbitten.

🎯 **The transferable idea, decoupled from the patent, and it is the good one:** our groom is a
cloud because nothing constrains cards to lie on a DEFINED SURFACE. Author the envelope explicitly
as a shell and place everything inside it barycentrically **by construction**. The p50–p85 spread
then collapses to the shell thickness by definition rather than by tuning. That is generator
design, not an implementation of anything patented.

---

## 4. ✅ The control was run on 2026-08-14, and it landed on neither predicted outcome

Harness, reproduction steps and licensing: **`tools/critic/control-frostbitten/README.md`.**
Plates: `captures/control-frostbitten/` (gitignored, local only).

Six blind judges, three per arm. Each saw ONE arm, in a randomly-named directory with PNG metadata
stripped, and was never told the other arm existed. Both arms 720×900, background measured
identical at RGB(20,22,26), round-23 brief verbatim minus `MOTION` (dropped from BOTH arms, since
the headless path renders one frame).

### 🎯 Six of six said "not same-tier" — including all three shown frostbitten

The control is the published reference implementation of Frostbite's hair system: 11.4k strands,
171k segments, analytic coverage, no cards, no alpha texture, no dither, no TAA. Its three judges
called it *"a wig, and a cheap one"* (two of them in almost exactly those words), *"a generation
behind"*, *"good geometry wearing a broken shader"*.

### What the judges DISCRIMINATED, which is how we know the instrument works

| complaint | ours, 3 judges | frostbitten, 3 judges |
|---|---|---|
| hem is blunt slabs / card rectangles | **3/3 yes** | **3/3 explicitly NO** — *"the strongest part"*, *"tapers to single-pixel points"*, *"no blunt slabs, no card edges"* |
| card edges visible AS edges in the silhouette | **3/3 yes** (one names four instances) | **3/3 explicitly NO** — *"deliberate and clean"*, *"no card edges, no flat facets"* |
| dither speckle scattered over skin | **3/3 yes**, measured as literal isolated pixels | 1/3 — and see the caution below |
| uniform shell, no lock hierarchy | **3/3 yes** | **3/3 yes** |
| desaturates to grey as it lightens instead of warming | **3/3 yes** | **3/3 yes** |
| no hair→skin occlusion | **3/3 yes**, measured 1–3% | **3/3 yes**, measured |

### The three conclusions, in order of what they cost

1. **Suspect (B) — the card is the wrong primitive — is CONFIRMED, and BOUNDED.** Moving to strands
   demonstrably buys the hem and the silhouette: the two complaints all three of our judges make and
   all three of theirs explicitly refuse to make. It buys **nothing else**.
2. **The three complaints that SURVIVE the primitive change are the real work, and two are cheap.**
   Lock hierarchy, the desaturating highlight ramp, and hair→skin occlusion are all present in a
   competent strand renderer at 11.4k strands. 🚩 Ours measures **1–3% skin darkening under a full
   curtain of hair** — three judges sampled it independently and one called it *"the biggest
   structural failure"*. That is a bug, it is independent of cards versus strands, and it is the
   cheapest item on this list. The desaturating ramp is our slide-39 `sqrt(colour)` finding — and
   frostbitten has it too, so it is a limitation of the cheap multiple-scattering fake rather than
   our error.
3. 🚩 **The completion gate cannot terminate as currently operationalised.** "Same-tier" as this
   prompt asks for it is refused for the published reference implementation of Frostbite's hair
   system. Eleven rounds pushed against a bar that would have rejected a known-good asset. The gate
   in `docs/PROGRESS.md` is the project's own decision and stands; what needs rewriting is the
   BRIEF the judges are given, which currently invites a verdict no real-time hair renderer earns.

### ⚠️ A judge's DESCRIPTION is reliable; its ATTRIBUTION TO MECHANISM is not

Control judge 3 reported *"the alpha dithering… a regular diagonal cross-hatch checkerboard… the
transparency solution showing through as texture"* — about a renderer whose coverage is analytic and
which has **no dither and no alpha texture at all.** A real observation with a confabulated cause
attached. This is the same failure class as the five blind statistics in §5, on the critic side:
take what a judge SEES as evidence, never what a judge says is CAUSING it.

### ⏭️ WHAT TO DO NEXT, after the source sweep of the same day

Read `docs/research/source-sweep-2026-08-14.md` before picking anything up. In priority order:

1. **The light-path split measurement — half a day, and NOTHING should be built before it.** Our
   1–3% skin darkening is what you get when the occlusion term attenuates direct diffuse and leaves
   other paths untouched. We already have one confirmed unattenuated term and it is not IBL:
   `LightingRig.js:424` `shadowFraction: 0.45`, so **55% of the key sits in a `RectAreaLight` which
   in three cannot cast a shadow at all**, plus ambient on top. ⚠️ The obvious hypothesis is already
   REFUTED — `alive.js:2297` sets `castShadow`/`receiveShadow` and `maskShadowNode` gets strand
   coverage into the depth pass, so this is NOT the R11 garment defect recurring. Split the skin
   path into direct diffuse / direct specular / IBL / ambient / non-shadowing area light and find
   what is unattenuated. If the floor dominates, **no shadowing algorithm can fix this** and a deep
   shadow map would be aimed at the wrong term.
2. **Lock-scale ALBEDO — an afternoon, on the cards we already have.** One hash, one varying, one
   multiply, ported from false-earth (MIT, three.js TSL, our exact stack). The judges' complaint was
   *"per-pixel noise standing in for structure"*, which is a FREQUENCY complaint: we vary at
   filament scale and mass scale with nothing at lock scale. A clean control either way.
3. **The judging brief.** Six of six said "not same-tier" including the Frostbite reference, and
   none of the five sources contains any evaluation methodology. This gates whether any other work
   can be scored.

### ⏭️ The second control is much cheaper than this file previously costed it

It does not need a Blender → `.tfx` round-trip through `scripts/tfx_exporter.py`.
`tools/figure-pipeline/hair_cards.py` already integrates guide curves in `GUIDE_SEGMENTS = 16`
steps, and `grow_to_cut` returns 17 points **uniformly spaced along the curve's own arc** — which
resamples to the 16-point `.tfx` frostbitten already ships. Rendering OUR groom in THEIR renderer
separates "our groom's shape is wrong" from "our card/alpha/dither path is wrong", and after the
result above it is the one remaining question about the groom itself.

---

## 5. Standing context a successor needs

- **`docs/BRIEF.md` is the source of truth.** When any other document disagrees with it, it wins.
- **The durable record is the commit bodies.** Every measurement in this phase is in one. `git log`
  is the primary artefact; this file is an index to it.
- `docs/RED-GATES.md` declares every red gate and `tools/run-selftests.sh` adjudicates it —
  UNDECLARED RED and STALE DECLARATIONS must both be 0. It exists because **file ownership orphans
  reds**: a groom change breaks a render gate, and neither owner runs the other's tests.
- `docs/OPEN-REQUESTS.md` is the cross-file request ledger with its own gate. REQ-063/064/065 are
  the three highlight levers (rim shadow map, view-axis light, environment path) and are open.
- **`docs/LEARNINGS.md` §1.25ac–ae** and the rule-4 instances are the expensive lessons. The single
  most repeated failure in this phase: **a statistic that is structurally blind to the defect.** Five
  separate instances — mean alpha cannot tell a picket fence from a rectangle; a slab scores a
  PERFECT bimodality; a card-wide baseline read 4.0 runs on a flat wall; a gap-counting statistic
  cannot see shading; a relief statistic rated a NOISIER groom better than a lock-ier one. **Validate
  every new operator against a shape whose answer is arithmetic FIRST, and against a crop you have
  looked at.**
- **The remote is not set up.** `origin` points at `robault/Sugata-`, which has never existed;
  `robault/Sugata` is a DIFFERENT project (a 2D text avatar system). 70+ commits are local only.
  `reference/` was never committed in any of them — verified across the whole history.
- Reference imagery (Stellar Blade plates, and hairstyle references the owner supplied) is
  **gitignored, never committed, never shipped**. Parameters extracted, pixels never copied.

---

## 7. 🚩 R24 — both experiments returned CLEAN NEGATIVES, and one of them invalidated §4

Commit: see `git log`. Adversarial verifier: *"the most reproducible pair of reports I have audited
in this repository"* — every one of ~40 re-derived figures landed on the digit.

### 🔴 The §4 control judged the wrong plates. That is a correction to this file, not a footnote.

`control-blind.mjs:41` sourced the "sugata" arm from `captures/hair-r23-after/`. Those plates come
from `hair_shots.mjs` driving `packages/testbed/src/hair.html`, a GEOMETRY-judging page. Read live
off it: **`renderer.shadowMap.enabled === false`**, three lights with `castShadow` false on all
three, 8 meshes with 0 casters and 0 receivers, `scene.environment === null`, `toneMapping === 0`.
No LightingRig, no GTAO, no HairOIT, no grade. **Hair→skin occlusion there is zero by construction**
— hiding the groom moves groom-free skin by 3.022e-4 of one code value.

So the judges were **right about the plate and said nothing about this renderer.** §4's row "no
hair→skin occlusion, ours 3/3 yes" is withdrawn. The frostbitten arm stands (rendered on its own
full rig); the hem, card-edge and dither rows concern geometry and coverage and survive, but
**anything in §4 that depends on lighting must be re-run.** `control-blind.mjs` now points at
`captures/hair-r24-before/`, from `alive.html?hair=1`, and carries a 🚩 comment saying why.

### The light path: hypothesis CONFIRMED as arithmetic, REFUTED as an explanation

At the forehead under the fringe, hair off, total scene luminance 5.3333e-1:

| term | share | shadowable |
|---|---|---|
| key RectAreaLight | 27.00% | **no** — three.js RectAreaLight has no shadow code |
| fill RectAreaLight | **50.01%** | **no** |
| rim + kicker RectArea | 0.01% | no |
| ambient (Hemisphere, via GTAO) | 5.79% | partly — GTAO takes 0.98 pp |
| **key SpotLight** | **17.55%** | **yes — this is the entire shadowable budget** |
| IBL / environment | **0.00%** | measured, not assumed: `scene.environment` and `environmentNode` are both null |

Closure: sum 5.3523e-1 against measured 5.3333e-1, +0.36%.

**81.83% of the light at the forehead is beyond the reach of any shadowing algorithm.** That is the
authored energy split (`shadowFraction` 0.45 on the key, 0 on fill/rim/kicker), not a defect.

🎯 **AND THE OCCLUSION IS ALREADY SATURATED.** Ceiling at P1 = 17.55 + 0.98 = **18.54%**; the groom
removes **17.82%** — 96.1%. At the chest, ceiling 26.17%, measured 26.20% — **100.1%**, with the
shadowing term reading exactly 0.0000e+0. Corroborated on a second arithmetic: the key-spot term
collapses 9.3614e-2 → 3.7905e-3. Null controls on open skin read 0.00%, which is what proves the
statistic is not simply reporting the ceiling back.

**⛔ DO NOT BUILD a deep shadow map, an opacity shadow map or a light-view transmittance stack for
hair→skin occlusion.** There are 0.7 percentage points left in it — about a third of one code value.
If deeper hair shadow is wanted the lever is `shadowFraction`, it is one number, and its price is
G2: the sweep goes red at the first step above 0.45. ⚠️ State the margin honestly — the shipped
plate reads saturationRatio 1.361 against a ceiling of 1.362, so G2 was already 0.001 inside its
clause and `shadowFraction` is not solely causing that red.

⚠️ **The "1–3%" was the SIXTH structurally-blind statistic, this time on the judges' side.** Averaged
over all visible groom-free skin the shipped plate reads 0.96% — reproducing their number — because
most of that skin has no hair between it and any light. Restricted to skin the curtain is actually
in front of, the same plates read **18–28%**. A whole-face mean cannot tell a missing shadow from a
present shadow over a small area. The related claim that the forehead is the brightest skin in the
frame does not reproduce: it ranks 479 of 709 tiles, 67th percentile.

### Lock-scale albedo: the hypothesis was wrong in its premise AND its lever

🔴 **"Nothing at lock scale" is FALSE, measured.** The existing per-fragment strand jitter already
delivers 13.39% of the plate's mean into the filament band and **13.69% into the LOCK band**. Its
lattice period is 4.8 px and 1-D value noise is flat below its own lattice frequency. **The lock
band is already full — of noise.** The judges' words were more precise than the hypothesis derived
from them: *"per-pixel noise standing in for structure"* is a complaint about **COHERENCE, not
power**. Score future work on coherence.

🔴 **The band definition was a guess and it did not fit.** 10–40 px was nominated blind; the groom's
own lock is `LOCK_COUNT` 16 at a mass radius of 88.1 mm = 34.6 mm = **53 px**, coarser than a card
(44 px) and outside the band.

🔴 **Albedo is the wrong QUANTITY for hair, and this is the durable finding.** Grass clumps genuinely
differ in albedo — different plants, age, dryness — which is why false-earth's `clumpSeed01` into
base colour works there. **Every fibre on one head shares one melanin.** A lock reads as a lock
because of *shading* — self-shadow, tilt, and the highlight breaking across it — not because it is a
different colour. At the solved spread the term is invisible; at its physical maximum it reads as
**patchy dye**, not locks. The blind judge could not tell the two sets apart at 1:1, 4x or 5x.

🎯 **The groom HAS a real lock identity and none of it reaches the shader.** `hair_cards.py` carries
`LOCK_COUNT = 16` dart-thrown scalp centres, assigns every card by `nearest_lock()` — a Voronoi on
the scalp — and gives the lock 75% of a card's deflection and curl. But `assemble_cards` writes
`u` = atlas strip and `v` = root-to-tip, and the GLB carries no lock id, no card id, and no per-card
UV offset to derive one from. **Plumbing the existing lock id through to the shader, and driving
SHADING with it rather than albedo, is the next experiment** — and it needs no new groom.

### New instruments, both validated against arithmetic before use

- `tools/critic/band-power.mjs` — three-band separable **box**-filter decomposition, chosen because a
  box's response to a discrete sinusoid is the closed-form Dirichlet kernel, so every reading is
  known on paper first. Four required validations print exactly: flat 0/0/0; filament grating
  0.070711/0.001725/0.001725 against A/√2 and A/(41√2); lock grating; and their sum. Separation 375.8×.
  Its step-edge blind spot is a **measured clause**, not a caveat.
- `tools/critic/lightpath-probe.mjs` — leave-one-out light decomposition through a closed-form
  inverse of three's ACES. ⚠️ Its `buildGroomMask` docstring shipped a **false number** — 24.33/255
  attributed to P1 when it belongs to a discarded rect, spliced against P1's own clean 11.06. Third
  instance of §1.25r; found by the verifier re-measuring both rects on all three plate pairs. Fixed,
  with the error recorded in place. **Numbers in a justification comment are claims and nothing in
  the tree checks them.**

---

## 8. R25 — the lock id reaches the GPU, and it is shading a highlight that does not exist

### 🎯 The finding, and it reorders everything downstream

The blind judge was asked whether the specular is one broad band or broken across bundles, and
answered with a third option: **there is no band.** *"It is not one broad band and it is not broken
across bundles — there is no lobe."* The highlight pixel sets are **bit-identical** between the two
arms at every threshold: crown at L>0.25 both blobs=8 px=33 top=[9,9,5,3]; at L>0.4 both blobs=7
px=22; left fall both blobs=12 px=8323.

**R25 built correct machinery for breaking a highlight across locks, and pointed it at a term that
is not rendering.** That is the round's result and it is not a small one — it says the ordering was
wrong, not the mechanism. `docs/CHECKPOINT.md` §2 already established *"TRT is not firing… 0.6%"*,
and REQ-063/064/065 are the three highlight levers (rim shadow map, view-axis light, environment
path) sitting open in `docs/OPEN-REQUESTS.md`. **Those come before any further lock work.**

### What stands, and it is real infrastructure

The lock id is **plumbed end to end and verified four independent ways by the adversary**, including
reading it off the running GPU and proving consumption by mutating the live buffer:

- `hair_cards.py` now emits `TEXCOORD_1`: `u1` = (lock index + 0.5)/16 constant over a card,
  `v1` = the Voronoi **F2−F1 edge distance** at the card root, scaled by
  `sqrt(ScalpFrame.area / LOCK_COUNT)` — a division, not a taste value, 54.4–59.2 mm across the
  identity sweep, written into mesh extras so a gate can re-derive it.
- ⚠️ **The cap/card asymmetry is load-bearing**: per-CARD on cards, per-VERTEX on the cap, because
  Blender de-duplicates on the whole attribute tuple and a per-face value on the cap's shared
  vertices would shatter it into hundreds of components. Same failure `export_hair_fragment` already
  records for `export_tangents=True`. Verified: 17,516 verts / 17,000 tris unchanged, 496 quad-strip
  components + 2 cap patches, +141,352 bytes a bake.
- `TEXCOORD_1` chosen over a custom `_LOCK` attribute and **verified in both installed trees**
  rather than assumed: Blender's exporter sets `tex_coord_max` from `len(mesh.uv_layers)` with no
  material filter, and three r185 maps it to `uv1` at `GLTFLoader.js:2228`.
- The tangent shift in `HairMaterial.js` derives its amplitude from Marschner 2003 Table 1:
  `sin(10°) − sin(5°)` = 0.086492 rad. The two factors of two cancel — the ×2 in the Karis alpha
  conversion and the ×2 in the tilt-to-alpha equivalence — which is why the answer is Marschner's
  own 5° band again. Shipped at 33.3% of the bound where neighbouring locks' bands go disjoint.

### 🔴 The eighth structurally-blind statistic, caught in the same round it was written

`coherentLock = coherence × rms(band) / mean` **is band contrast wearing a coherence hat.** Injecting
orientation-free lock-scale noise into the real `hair-r24-before` plate through the same mask gives
×1.0255 at ±3%, ×1.0491 at ±6%, ×1.0897 at ±12%. R25's shipped term read ×1.0212 / ×1.0502 and its
bound ×1.1270 / ×1.1920 — **every reading sits inside the range pure isotropic noise produces.**
`coherence` itself FALLS on that noise (×0.9544), and the headline rose anyway because the amplitude
factor carried it.

🎯 **The lesson is sharper than the previous seven.** This operator was written *specifically because*
band power could not tell structure from noise — and it reintroduced the identical flaw by
multiplying the ratio back by the amplitude. **A normalised ratio cannot count photons; multiplying
it by photons does not make it a structure measure, it makes it a contrast measure with a ratio
attached.** `coherence`, `alignment` and `orientationDeg` survive their own validations and are the
numbers to score with. The file now carries the refutation in place.

⚠️ **And there is a stated next step for the discriminator nobody has measured yet:** a lock's
brightness varies ACROSS the flow while strand jitter varies ALONG it. **The two are 90° apart**, and
`orientationDeg` is already reported per band — run the tool at lock widths and at filament widths
and the angle between them is the discriminator. Nothing in R25 measured that, so nothing claims it.

### The recurring failure recurred — fourth instance

**Five wrong numbers in one justification comment** in `lock-coherence.mjs`: 0.110/0.823/7.5×/0.0139/
55.5× against true values 0.119454/0.830304/6.9508×/0.014152/54.6314×. **The file's own selftest
prints the right values two lines from the label carrying the wrong ones.** Fixed. Fourth instance
of §1.25r, and the pattern is now unambiguous: **numbers written into prose during authoring are
never re-derived, and nothing in the tree checks them.** A gate that re-derives quoted constants from
their own selftest output is worth building.

### Suite

UNDECLARED RED 0. Four reds, all pre-existing and declared. `HairMaterial.selftest` 70/74 — up from
63/67, seven new clauses all green, the same four pre-existing failures. Provenance clean: every
plate in the round carries an `alive.html?…&hair=1…` URL in its manifest, and the live census shows
`HairNodeMaterial`, which `hair.html` could not produce.

---

## 9. 🚩 R26 — every light DOES reach the hair, and the missing highlight was a lobe authored mid-band by default

**§8's closing pointer — *"REQ-063/064/065 come before any further lock work"* — is now measured and
it was only a third right.** All three were swept on pixels this round. None of them was the lever.

### The leading hypothesis was REFUTED before anything was changed

The round opened believing 77% of the rig's energy was stranded, on the theory that a custom TSL
`LightingModel` never receives a `RectAreaLight`. Read from installed three r185 source and then
from pixels: `HairLightingModel.directRectArea` **is** implemented and it **does** fire. Hair and
the skin 105 px beside it receive the same light in the same proportions — RectAreaLights carry
66–73% of a hair pixel against 62–66% of the skin pixel, the absolute ratio being albedo and BSDF.
Red-proved by renaming the method: the hair darkens 3.51× and reads 82.58% key-SpotLight, while
skin is untouched digit for digit. **Nothing is missing from the hair light path. Do not look again.**

### 🎯 The fifth instance of §1.25r, and it was inside the diagnosis that named this round's lever

The diagnosis reported `HAIR_DEFAULTS.roughnessR` as *"0.26 rad = 14.9° against Marschner's β_R of
5–10°"* and filed it as a defect. **That defect does not exist.** `HairMaterial.js`'s own header
derives the conversion: M_p's argument is `sinθi + sinθr`, not Marschner's half-angle, so
`β_K = 2 β_M`. The shipped 0.26 was **β_M = 7.4485°, the middle of Table 1's band**, and
`HAIR_DEFAULTS`' own docstring said "mid-band of 0.1745…0.3491" two lines from the value. Reading
β_K as β_M is a factor of two. `tools/critic/hair-lobe-sweep.mjs --selftest` is now the clause that
catches it, and `describe()` reports β in **both** variables so a manifest cannot be misread either.

### What the lever actually was: β_R was never solved, only defaulted

`docs/research/hair.md` §2.3 proposed starting at the centre of Marschner's bands and solving α_R and
β_R against a measured band width. The solve was never done; the centre shipped from R13 to R25.
It has now been done, on 216,745 gated hair pixels of the judged URL, reading R alone against the
mass **rendered at the same width**:

| β_K | β_M | R p99 | mass mean | **R p99 / mass** | >4× R's own mean |
|---|---|---:|---:|---:|---:|
| 0.349066 | 10.000° | 5.146e-2 | 6.320e-2 | 0.814 | 0.0000% |
| 0.26 | 7.448° | 6.785e-2 | 6.612e-2 | **1.026** | 0.0000% |
| 0.20 | 5.730° | 8.560e-2 | 6.814e-2 | 1.256 | 0.0000% |
| **0.174533** | **5.000°** | 9.585e-2 | 6.896e-2 | **1.390** | 0.0000% |
| 0.12 | 3.438° | 1.260e-1 | 7.045e-2 | 1.789 | 0.8978% |
| 0.08 | 2.292° | 1.594e-1 | 7.106e-2 | 2.243 | 4.9136% |

**Shipped: `HAIR_BETA_R` = 0.174533, the narrow end of Marschner's measured band.** β_TT, β_TRT and
`material.roughness` follow by the paper's own ratios, so it is one free parameter. On the judged
plate the mass gets **4.0% brighter and 19.0% wider in range** (p95/p50 1.5867 → 1.8879), and on the
project's own declared contrast gate, same mask, same run, two builds differing in that one
constant: radiance p95/p50 **1.587 → 1.898** and lobes-alone **2.191 → 3.035**. A shape change, by
§9.4's own discriminator — *a multiplier moves the level and not the range.*

### ⚠️ The two knobs that were NOT it, and why, because both look like wins on a ratio

* `scatter` 1 → 0.25 reads p99/mass 1.735 **by darkening the whole groom 40.9%** while R's own p99
  stays byte-identical across all three arms. CHECKPOINT §2's floor-limited contrast, with the floor
  in the numerator, appearing on the specular side. It is a brightness cut wearing a contrast ratio.
* `weightR` 1 → 4 reads 1.932 by making R 74.1% of the mass. Karis gives no such scalar.
* REQ-063 is **not** a highlight lever: `sideVisibilityValue` is 1.000 for both the key and the fill,
  so the slide-47 occlusion touches only rim and kicker, which are 0.02–0.87% of a hair pixel. It
  survives as a documentation request. REQ-064 **is** real and is now the strongest of the three,
  and a narrower lobe makes it worth more rather than less. REQ-065's term measures 3.54% of the mass.

### ⏭️ The forward finding, which is a stated limit and not a plan

**No width inside Marschner's band puts a single pixel of 216,745 above 4× R's own mean.** The first
arm where a shape statistic sees a band at all is β_M 3.438°, smoother than any fibre in Table 1. So
this round bought the largest primary-lobe contrast the source permits and **the rest of the missing
highlight is elsewhere.** The standing candidate is the groom's own tangent spread inside a pixel —
R26 measured removing the strand jitter, the flow sheet or the lock tilt as worth ≤0.02× of
peak/mass-mean **each**, which says the groom never turns into the lobe's peak rather than that the
lobe is too wide. That is §2's eleven-millimetre cloud arriving on the specular side.

### Suite

Full suite, tree DIRTY (multi-agent round — read the caveat in `run-selftests.sh`'s header):
**FAILING GATES 4, UNDECLARED RED 0, STALE DECLARATIONS 1.** The four reds are `HairMaterial`
(76/80, declared, red by design), `hair_alpha` 18/19, `request-ledger` 25/26 (the ROUNDS clause —
R12 declared, HEAD 23 commits past it, nothing to do with this round) and `verify_glb`. The one
stale declaration is `HairOIT`, which passed 32/32 this run and whose own `docs/RED-GATES.md` entry
predicts exactly this: it is the documented intermittent, and the entry says in as many words that
an intermittent gate reads as STALE on a run where it passes. `HairMaterial.selftest` **76/80** —
up from 70/74, six new clauses all green, the same four pre-existing declared failures.
`tools/quoted-numbers.mjs` 15 verified / 0 failed, with six of the fifteen new this round: the
conversions this section argues from are now re-derived by a gate rather than typed. `alive-toggles.selftest` 197/197 with two new keys
classified. `GTAO.selftest` 27/27, which is the check that `material.roughness` following β_TRT to
0.349066 did not disturb the specular occlusion. Provenance: `hair-plates.mjs` now writes a
`provenance` block read off the live page into every manifest — `hairMaterialClass`,
`shadowMapEnabled`, light count, environment — so a plate taken off `hair.html` would say so in its
own sidecar instead of in a README a reader has to trust.

---

## 9. R26 — the lights all arrive, the lobe is drowned not missing, and β_R had never been solved

### 🔴 The leading hypothesis was REFUTED, and it was mine

"77% of the rig is carried by RectAreaLights and a custom TSL LightingModel does not receive them"
is **false for this material**. `HairLightingModel` implements `directRectArea()` at
`HairMaterial.js:2129`. Verified in three r185 source (`RectAreaLightNode.js:89` →
`AnalyticLightNode.js:183/276/286` → `LightsNode.js:324`) *and* on pixels: RectAreaLights carry
**66–73% of a hair pixel and 62–66% of the skin pixel 105 px away.** Hair and skin receive the same
light in the same proportions. Nothing is stranded.

⚠️ `indirect()` IS empty — deliberately — but it costs nothing here: `alive.js:944` builds the rig
with `ambient: occlusion.enabled === false`, GTAO is on, so **there is no HemisphereLight in the
scene at all.** Hair's ambient arrives through the GTAO composite and measures 3.54%.

### 🎯 The real diagnosis: a CONTRAST failure, not a light-path failure

The primary R lobe is present and carries **39.36% of the mass** — and its p99 over 207,947 hair
pixels is 6.80e-2 against a mass mean of 6.78e-2. **A ratio of 1.00.** It rides on a **59.03%
multiple-scattering pedestal**. On the crown the split is worse: **R 6.95%, scatter 87.39%.**
TRT is 0.10%, peak 0.04× the mass mean; with the key on the camera axis it reaches only 1.30%,
which confirms REQ-064's own warning that *"the gain is NOT mostly TRT"*.

**None of REQ-063/064/065 was the answer, and all three were measured rather than reasoned about.**
They are brightness levers: peak/mass-mean moves 1.08× → 1.28× → 1.23× → 1.39×, with **0.0000% of
the groom above 4× in every arm.** REQ-063's occlusion turns out to do nothing to the two lights
carrying 66–73% of a hair pixel — `sideVisibility` is **1.000** for both key and fill on the rig's
real directions; it only attenuates rim and kicker, which are 0.02–0.87% of a hair pixel.

### What shipped, and it is the first non-null in three rounds

`HAIR_DEFAULTS.roughnessR` (β_R) moved from the **middle** of Marschner 2003 Table 1's measured band
to its **narrow end**: 0.174533 = β_M 5.000°. **It had been sitting at a taste default since R13 and
the solve `docs/research/hair.md` §2.3 proposed had never been run.** Measured on the judged plate:
dynamic range **p95/p50 1.5867 → 1.8879, +19.0%**, for a 4.0% change in brightness — a shape change
by the project's own discriminator, on one free parameter, from a source with a band.

**The blind judge: not a null.** 38% of each frame changed, mean |dRGB| 5.6–6.1, and **skin, eyes,
lips, brows, shoulder and background are bit-identical** — a clean internal control. Macro form
contrast p95/p50 1.29→1.40 portrait, 1.33→1.50 three-quarter. Its words: *"The mass now reads as
having a light direction where before it read as a tinted cutout."*

⚠️ **And its verdict is the thing to carry forward: "REAL CHANGE, WRONG MECHANISM. Keep it, then do
the actual work."** There is still no specular highlight — what arrived is a broad fibre-aligned
diffuse/wrap gain. **The pedestal is the target.** Slide 39's fake is 59% of the mass and 87% on the
crown, and no lobe can peak through it. That is now the named next problem.

### The comment-number gate, and the perfect demonstration of its limits

`tools/quoted-numbers.mjs` + selftest (25/25) landed, wired in by `run-selftests.sh`'s own
`*.selftest.mjs` glob with **no edit to the runner**. A tagged claim names the number *and* the
command that produces it; the gate runs it and compares. It goes red on a real historical instance.

🔴 **And the round shipped a false number anyway, which its own new gate certified green.**
`HairMaterial.js` said narrowing β raises the peak by **1.4897×**. The true answer is **1.500000× by
construction** — Marschner's band is [2·sin 5°, 2·sin 10°], so its midpoint is exactly 1.5× its
narrow end and no plate is involved. 1.4897 is `0.26 / 0.174533`, the ratio against the *old taste
default*, not against the band midpoint the sentence names. **Fifth instance of §1.25r.**

It survived because **the sentence was not tagged.** Which is the finding: `quoted-numbers` reports
**9 tagged claims against 23,497 numerals in comment prose — 0.038%** — and prints that fraction on
every run, precisely so a green result is never mistaken for a checked tree. **A gate's coverage is
part of its verdict.** Now tagged.

---

## 10. R27 — the pedestal's depth input is white noise, so depth cannot be the lever yet

**Nothing shipped in the picture.** `captures/hair-r27-after` is byte-identical to `hair-r26-after`.
Sixth clean negative of the week, and it closes a line cheaply.

### 🎯 The forward finding: the input comes before the form

`Shadow` in the slide-39 term is `exp(−3 · depth.png sampled at uv())` — **the CARD's own atlas
coordinate.** One baked number per texel, shared by all 462 cards, and `hair_texture.py` fills that
sheet with `random.random()` per strand. **It cannot vary with light direction, head orientation, or
how many other cards lie between the fragment and a light.**

Zinke's `n` counts fibres along the **shadow path**. Ours counts depth **within one card's bundle**.
Right histogram, wrong spatial referent. 🚩 **Depth-modulating the pedestal is not the lever while
its input is noise** — and that is why the correctly-derived Zinke term was indistinguishable from a
scalar: a level-matched constant multiple of the hack it replaced produced the same moves, the same
rank order (ρ 0.9763) and the same crop. **The gain was 38.8% brightness and 0.9% physics.**

### The literature settled both hypotheses, and one of them was mine

🔴 **Hypothesis (B) — "`sqrt(albedo)` is backwards" — REFUTED AS STATED.** `sqrt(C)` is not the
term's colour model; it is the **Shadow = 1 boundary value** of a term whose per-channel chromaticity
exponent is `(1.5 − Shadow)`. Criticising the sqrt alone mistakes an endpoint for the function.

**But the judges were right anyway, and the literature backs them.** Chiang et al. EGSR 2016 §4.2:
lower azimuthal roughness → more forward scattering → **darker AND more saturated**; higher →
"brighter and less saturated." **Brightness and saturation are anti-correlated and both set by
penetration depth.** Six blind judges said *"it desaturates toward grey as it lightens instead of
warming toward copper"* and that is a real, sourced defect.

⚠️ **Karis offers no justification for the sqrt anywhere.** His own speaker notes call the whole
thing *"a giant artistic hack and not physically based in the slightest"*, derived from photographs
rather than ground-truth renders. Our citation of slides 39/44 is faithful; the slides just do not
claim what a reader might assume.

### What the fix would actually require, from Zinke et al. SIGGRAPH 2008 (verified verbatim)

`Ψ^G ≈ T_f · S_f` with `T_f = d_f · Π_{k=1..n} ā_f(θ_d^k)` (Eq. 4–5), `d_f = 0.7` in [0.6, 0.8], and
`T_f = 1` when `n = 0`. Spread widens with depth too: `σ̄_f² = Σ β̄_f²` (Eq. 8). The GPU form stores
`T_f` and `σ̄_f` **per RGB channel**, so chromaticity sharpens *geometrically* with depth — that is
the anti-correlation, and it is Beer-Lambert.

🚩 **And our rig bounds which tier is reachable.** Every real-time source derives depth from the
**light's view** — Zinke §4.1.3 and Frostbite slide 27 both use deep opacity maps. We can only do
that for the key SpotLight: three's `RectAreaLight` has no shadow code, and RectAreaLights carry
**66–73% of a hair pixel**. So **Frostbite's own Tier-3 fallback fits this rig and deep opacity maps
do not**: `T_f = d_f · exp(−σ_hair · l)`, per channel, on a *geometric* path length. Frostbite states
its limitation plainly — it will not adapt to actual changes in hair volume.

**Licences:** Zinke read-only, no code, ACM personal-use preprint. Karis' slides are published course
notes (already cited); UE source is EULA-bound and must not be vendored. d'Eon read-only.

### 🔴 The sixth false number — and it exposes a permanent limit of last round's gate

`HairMaterial.js` quoted slide 39 rising by **1.0927** and Zinke's `T_f` falling by **1927.5**
*"over the full range the shipped `shadowDensity` can produce"* — as though one domain. It is two:
`1.0927` sweeps `Shadow` 0 → 1, `1927.5` sweeps `n` 0 → 3. **The magnitudes are not comparable and
must never be divided.** Only the *sign* difference is domain-independent, and the sign is what the
probe tested.

🎯 **The gate passed it, and this time not because the claim was untagged.** Both numbers ARE what
their tagged command prints — because `hair-transmittance.selftest.mjs` computed and printed them
over the two domains too. **A gate that re-derives a number from its producer cannot catch an error
the producer shares: it checks transcription, not meaning.** That is a permanent limit of
`quoted-numbers` and it belongs beside its 0.038% coverage figure as the second half of what a green
result does not mean. Both the producer and the comment are now fixed, and the producer prints the
two domains on separate lines so they cannot be conflated again.

### ⏭️ Next, in order

1. **Give the pedestal a real depth input before touching its form.** The candidates are a light-view
   path length for the key, and a *geometric* per-fragment path length through the groom envelope for
   the RectAreaLights that cannot have a shadow map. Until `Shadow` stops being noise, no shading
   change to this term is attributable.
2. Then the per-channel chromaticity (Chiang §4.2's anti-correlation), which is the judges' sentence.
3. `hair_texture.py`'s `depth.png` is `random.random()` per strand — that sheet is the actual root
   and it is a **generator** fix, not a shader one.
