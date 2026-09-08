# Checkpoint — the hair phase paused 2026-08-13, control run 2026-08-14

> **2026-09-08 restart:** read [RESTART-2026-09-08.md](RESTART-2026-09-08.md) first. This
> checkpoint predates later local experiments preserved outside this clone; its last proposed
> hair experiment is not the current recommendation.

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
| **6 Body motion** | **foundation landed 2026-08-17.** 6.1 was always done and the file said otherwise. `motion/IKSolver.js` 106/106 and `physics/SpringBones.js` 86/86 now ship; 6.3 gesture, 6.4, 6.7, 6.8, 6.9 open |
| **7 Runtime API** | ✅ **DONE 2026-08-16.** `Avatar.create({canvas})` produces a living avatar. 7.1–7.5 all landed |
| 8 Blind critic loops | running continuously; the mechanism that finds everything |
| 9 Wardrobe | plumbing, foundation, agency, shadows, hem done; 9.9 capsule and 9.10 cultural dress open |
| 10 Identity sculpting | catalogue and targets landed; the human–AI coherence loop unbuilt |

🚩 **THIS PARAGRAPH SAID "THE TWO LARGEST UNSTARTED BLOCKS ARE PHASE 6 AND PHASE 7" AND BOTH HALVES
ARE NOW FALSE.** Phase 7 is done — `Avatar.create({canvas})` is one call and it was verified on
pixels. Phase 6 was never fully unstarted: 6.1 had been built for months behind a stale `[ ]`, and
its foundation landed 2026-08-17.

✅ **AND THE REPOSITORY IS PUBLIC.** `https://github.com/tokenfires/sugata-avatar`, MIT, assets
through git-LFS. See §5.

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

Rounds 13–23 built hair from zero: a procedural card groom (`assets/hair/bob01`, ~~462~~ **496** cards,
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
⚠️ **2026-08-22: `scripts/tfx_exporter.py` IS NOT AND NEVER WAS A FILE IN THIS TREE.** That name is
**frostbitten's OWN Blender exporter**, inside their repository — so this sentence declined a
shortcut we never had. Ours was written this round as `tools/figure-pipeline/tfx_export.py`, and the
rest of the paragraph is correct: it takes the guide curves directly and needs no Blender at all.
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
- ✅ **THE REMOTE IS SET UP AND THE REPOSITORY IS PUBLIC, 2026-08-16.**
  **`https://github.com/tokenfires/sugata-avatar`**, MIT, default branch `main`.
  This bullet used to read *"the remote is not set up… 70+ commits are local only"* and that is
  retracted. `origin` had pointed at `robault/Sugata-`, which was confirmed never to have existed
  (`gh repo view` resolves nothing), and the `gh` CLI authenticates as **`tokenfires`** rather than
  `robault`, which is why the repository is under that account.
  🚩 **The assets ship now.** `assets/figures`, `assets/hair` and `assets/wardrobe` were gitignored
  as build output; they are committed through **git-LFS**, 43 objects, 244 MB uploaded. A clone
  without `git lfs install` gets pointer files and `Avatar.create()` fails on a missing bake.
  ⚠️ GitHub's free LFS tier is 1 GB storage and 1 GB/month bandwidth, so roughly four full clones a
  month exhausts the bandwidth. The wardrobe is 159 MB of the 232 and is the obvious first cut.
  `reference/` is still gitignored and still was never committed in any commit — verified across
  the whole history before publishing, and a research artefact that INVENTORIED it by absolute path
  was stripped in `68bed11`.
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
coordinate.** One baked number per texel, shared by all ~~462~~ **496** cards, and `hair_texture.py` fills that
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

---

## 11. R28 — the pedestal's input is FIXED and proven to read the light, and the picture did not move

**Seventh clean negative. Nothing shipped in the picture** — the plate is byte-identical to HEAD's,
same SHA-256 `15b919a2…`, because the new path is gated behind `?hairdefect=` arms. New gate
`HairEnvelope.selftest.mjs` 29/29 with six red proofs. `HairMaterial` unmoved at its declared 76/80.

### 🎯 §10's instruction was carried out, and it was the right instruction

R27 closed with *"Until `Shadow` stops being noise, no shading change to this term is
attributable."* It is no longer noise. An ellipsoid envelope fit gives a per-fragment, per-LIGHT
chord, proven to read the light three independent ways:

- **On pixels**: `?hairdefect=envelope-depth` against `envelope-fixed-direction` — identical shell,
  σ, chords and slide-39 form, differing ONLY in whether the chord is taken toward the light — moved
  **160,646 of 225,126 gated hair pixels (71.36%)** against a noise floor of **exactly zero**.
- **Arithmetically**: key azimuth 42° → −20°, camera fixed, `n` goes **4.7507 → 4.0654** mean over
  R27's own 7,913 ray-cast fragments. **The shipped input gives |Δn| = 0 by construction.**
- **Against ground truth**: Spearman **0.6118** for the envelope path against **0.0598** for
  `depth.png`. Honest halves: the rim reads 0.13, and the ellipsoid's RMS residual on a bob is
  0.385 mm.

Candidate (B), the `hair_texture.py` generator fix, was **refused by measurement**: a correct
per-fragment per-light depth moves the pedestal's shape by 0.21%, so a per-card baked value cannot
do more inside the same form. §10.3's "that sheet is the actual root" is therefore **superseded** —
the sheet is a bad input to a form that cannot spend a good one.

### 🔴 The ceiling, and it is arithmetic rather than a tuning problem

Slide 39 spends `Shadow` ONLY on `(C/Luma(C))^(1−Shadow)`, and sweeping that exponent across its
**entire domain** moves the term's luminance by **1.0927×** — measured on the shipped mirror, and
independently the same 1.0927 R27 obtained from plates. R26 bought **1.19×** from a single
lobe-width constant. **So no depth input, however correct, can buy more than 1.0927× inside this
form.** `> 4× R's own mean` stays **0.0000% in every arm**.

⏭️ **The next obviously-wrong constant is named and deliberately not replaced:** `ā_f = √C`
(0.1016/0.0663/0.0606, R27's pick from `absorbTT` at h=0) raised to `1+n ≈ 8.5`. At the card-crossing
rate the product annihilates the pedestal (p50 1.434e-5 against a shipped 3.719e-2). Zinke Eq. 4-5
gives `d_f = 0.7` and **does not state ā_f's magnitude**, so no value is asserted here.

### 🚩 The strategic position, because two independent lines now say the same thing

R28's blind judge, on its own plates: *"There is no specular highlight in the sense of a readable
band."* At plate scale the groom *"reads as a mass of overlapping flat slabs with hard straight
silhouettes and rectangular notches"*, and boosting the crown 2.2× makes it unambiguous — *"the
bright regions are card facets, and their edges are card outlines."*

**That is §4's conclusion arriving from a second direction.** The frostbitten control already
CONFIRMED and BOUNDED "the card is the wrong primitive": moving to strands demonstrably buys the hem
and the silhouette and **buys nothing else**. Now a judge looking only at our own plates, with no
control beside it, independently reports card facets as the thing it sees.

🎯 **So the open question is no longer a shading question.** Rounds 26, 27 and 28 each improved a
term correctly and the picture did not move, and R28 measured WHY the third one could not. The
decision in front of this project is whether to change the primitive — §3 records that
`Scthe/frostbitten-hair-webgpu` is MIT, runs headless, and that its `HairFinePass` alone costs
~3.3 ms on an RTX 3060 against our whole ~3 ms hair budget. **That is a spike and a budget decision,
not another constant.** It should be taken deliberately rather than by drifting into a ninth
shading round.

### A defect caught by provenance rather than by looking

🔴 `alive.js:2513` assigns the hair material directly and **never calls `applyHairMaterial`**. R28's
first version fitted the envelope only there, so every live plate came back `envelope.fitted false`
with `n` identically zero. Caught on the FIRST smoke run by the capture tool's `describe()`
provenance check — which reads the material off the live page instead of trusting the URL, and which
exists because this project once judged plates from the wrong page for eleven rounds. **Filed, not
fixed: R28 does not own `alive.js`.**

## 12. R29 — gesture lands, and two intermittents get measured instead of argued about

### 6.3 ships, and the interesting part is what its own gate could not see

`motion/Gesture.js` at 86/86, wired into `Avatar.js`, verified on a live figure. The mechanism is
McNeill's one-sided synchrony rule made structural: strokes are placed BACKWARDS from their peak, so
a candidate that will not fit is dropped rather than slid later. Full detail in the commit body and
in punch-list 6.3.

🎯 **Dominance now reaches the body twice.** `AffectState` had carried the finding and named the
consumer since Phase 5 — Arellano (AMDO 2014, n=109), "dominance not at all" from a static face,
therefore *"posture, gaze policy, interruption behaviour and gesture amplitude, never the face"* —
and nothing had consumed the gesture half. Measured live, pleasure and arousal held fixed:

| settled dominance | peak shoulder |
|---:|---:|
| **+0.958** | **15.55°** |
| **−0.850** | **6.03°** |

2.58x, and the two dominance channels can disagree: high dominance under an adducted posture
gestures large-but-suppressed, which is a state neither the trunk nor the amplitude expresses alone.

🚩 **The gate was green at 82/82 while every sentence gestured at the previous sentence's
amplitude.** `AffectState.push()` sets a target that `pad` integrates toward, so reading `pad` at
`say()` time returns the emotion before last — `feel({ dominance: +0.9 })` read back **−0.892** in
the browser, and the submissive run came out LARGER than the dominant one. The gate could not see it
because it set the extent directly and never went through an `AffectState` at all. This is the third
time this project has shipped a defect that its own green gate was structurally unable to observe,
and the pattern is identical each time: **the gate exercised the mechanism through a shortcut the
product does not use.** The repair was to drive the gate through the shared bag, which is the
shipped path.

### `physics/SpringBones.js` is finished, correct, and unreachable

Measured 2026-08-17: **86/86 gates, zero call sites.** The shipped rig carries 53 skinned joints and
the hair GLB carries the identical 53 — a plain UE4-style skeleton with **no** breast, belly, glute,
skirt, coat or accessory bone, and the wardrobe capsule has no skirt or coat either. There is
nothing on this bake for it to drive, and wiring it to the groom would duplicate `HairDynamics`,
which owns that phenomenon on a different primitive.

So **6.8 is a bake-pipeline item, not a runtime one**: tissue bones plus skin weights in
`tools/identity-pipeline/`, then a re-bake of five gender variants and the hair variants that share
the skeleton, against a 232 MB LFS payload and a 1 GB/month ceiling. Schedule it as a phase.

🎯 A green gate proves the algorithm and says nothing about reachability. 6.3 therefore ships with a
WIRING section that asserts `Avatar.js` constructs, adds, drives, publishes, stops and reports its
layer — cheap insurance against exactly this.

### The `alive-toggles` intermittent did not reproduce, and that is the finding

**Six consecutive clean runs on a quiet machine, 197/197 every time** — one inside the full suite,
then five standalone repeats. Combined with the earlier observation that it wandered across the
`PIXEL_BASE` family rather than sitting on one row (`?cavity=0`, then `?specaa=0`, then
`?shadows=0`), the weight of evidence points at **machine load**, not at a defect in any toggle.

⚠️ It is deliberately NOT declared in `docs/RED-GATES.md`. It is green, and declaring a green gate
red is a false declaration in the direction that file exists to refuse. What is recorded instead is
the measurement: 0 of 6 on a quiet machine, and the load hypothesis it supports.

## 13. R30 — the runtime API grows hair, and the handoff for hairstyle variety

### The gap this round closed, and how long it had been open

`Avatar.js` — the API any embedding agent uses — **did not load hair at all**, and said so at its own
line 80: *"Deferred rather than dropped, and named so the omission is visible: hair (3.5/3.6/6.6)."*
Every screenshot in this project's record is bald because that is what shipped. Hair existed only on
testbed pages. Alongside it, `Avatar.create()` took eleven options and **not one controlled lighting,
background or exposure**; `docs/API.md` mentioned those words zero times. The capability existed
internally — `lighting.html` drives every light through `?ov=` — and was never exposed.

🚩 **AND THAT IS WHY THE BLIND CRITIC HAD BEEN PRODUCING LIGHTING NITS FOR ROUNDS.** It was being
shown stills of a bald, nude figure. It cannot comment on hair (none in the API), on motion (a
still), or on wardrobe (unclothed). Skin and lighting are the only things in frame, so those are the
findings it returned — and four rounds were spent on a violet rim that changed no pixels. The critic
was accurate; the FRAME it was given manufactured the priorities. Re-point it only after the subject
has hair, clothes and movement in it.

### Hair, verified on a real page by two independent lenses

Attaches through `Avatar.create({ hair: 'bob01' })`, skinned to the FIGURE's own bones (53/53
identical bone objects, so the head carries it), 496 chains / 8,432 particles, no divergence over 600
frames, survives an identity swap and five concurrent ones, and `dispose()` leaves `leakedHandles()`
empty across ten build/dispose cycles. It fits every tier's frame budget on this machine at a
measured **+2.0 ms p50**.

⚠️ **p95 DOES NOT RESOLVE** and three places shipped a p95 claim anyway, one of them as a runtime
string an embedder reads. The measuring round retracted it in `docs/API.md` — the two bald
repetitions differ by more than bald differs from haired — and R30 removed every quotation of it.

### 🎯 THE HANDOFF: a second hairstyle is twelve numbers, not a modelling job

Measured this round with a silhouette-IoU tool built for the question, and with the control that
makes it answerable — **the same haircut on a different head**:

| pair | front IoU | side | top | outline area |
|---|---:|---:|---:|---:|
| **CONTROL** bob01 g050 vs g000, same style different bake | 0.8329 | 0.5956 | 0.5591 | 0.92x |
| CLI knobs only — `--hair-part` / `--hair-seed` / `--hair-colour` | **0.8352** | 0.8995 | 0.8819 | 1.04x |
| **12-line patch** of `HAIR_LAYERS` `cut` + `length` | **0.4811** | 0.4887 | 0.3662 | **2.05–2.54x** |

🚩 **THE CLI KNOBS ARE NOT A SECOND STYLE.** They move the outline LESS than a gender bake does —
496 cards, 17,516 verts, per-layer tip z within 1.5 mm of bob01. That is bob01 with a different hair
colour, and anything that ships it as a style is shipping one haircut twice.

The real lever is `tools/figure-pipeline/hair_cards.py`'s **module-level globals**: eight layer dicts
in `HAIR_LAYERS` plus ~30 constants (`CUT_*`, `PART_*`, `GRAVITY_*`, `LOCK_*`, `CAP_*`, `ATTACH_*`,
`FRINGE_FORWARD`, `TIP_WIDTH_FRACTION`, `HAIRLINE_LIFT`, `WHORL_SETBACK`). **`--hair STYLE` is an ID
STRING AND NOTHING ELSE** — `hair_cards.py:782`, used only for the output directory and the material
name. There is no style table; that is the thing to build.

> 🔴 **SUPERSEDED BY §14, AND THIS PARAGRAPH IS WHY A HANDOFF NEEDS AN EXPIRY.** §14 (`44f41f4`,
> *"Seven grooms out of one generator"*) BUILT the style table this paragraph asks for. At HEAD
> `HAIR_STYLES` carries seven entries — `bob01 bob02 crop01 quiff01 long01 pixie01 lob01` — and
> `apply_style()` rebinds **32** `STYLE_PARAMETERS` over the module globals (`hair_cards.py:419-441`
> at `5bba1bb`; counted by `ast.literal_eval` of the tuple literal — an earlier draft of this note
> said 30, which was itself the defect it describes). So "an ID string and
> nothing else" was true when written and false one section later, in the same file.
>
> ⚠️ **It cost something on 2026-08-22:** this round's own briefing quoted it as current, because a
> paragraph headed THE HANDOFF reads as the live instruction and nobody re-reconciles a handoff
> against sections written after it. **A superseded handoff is more dangerous than a stale number**
> — a number gets re-measured, an instruction gets obeyed.

A bake is **20.43 s wall** and reproduced
the committed LFS object byte for byte (sha256 98ca6c23…), so iteration is cheap. `hair_texture.py`'s
`write_strand_atlas` takes no geometry, so the atlas is separable and need not be rebuilt per style.

⚠️ **AND `verify_glb.mjs` HAS CLAUSES TUNED TO A COLLARBONE BOB.** On the long groom, `cards gather`
reads 1.197 against a 0.95 ceiling and `shared space` fails at 162 mm — and the first FAILS WITH THE
WRONG DIAGNOSIS and then silently skips the five clauses that would catch a real defect. Generalise
those before adding styles, or every new style arrives red for reasons that are about bob01.

### What is still open, filed rather than carried

REQ-088 (`hair: false` still emits 16.26 MiB — module-scope `new URL()` literals defeat the dynamic
import), REQ-089 (the Avatar gate proves call sites exist in source text, not that options reach the
frame; two red proofs cannot go red), REQ-090 (`report().scene.lighting` reads the placement table
rather than the lights).


---

## 14. The night of 2026-08-17/18 — hairstyles, and the avatar goes outdoors

**Five commits. Read them in order; the bodies carry the measurements.** `39d6ce0` scene
requirement, `7007f39` source sweep + viewer, `18a348a` hairstyle targets, `a12dcf6` Phase 11.1-11.3,
`4e0d8b6` the scene look round, `44f41f4` seven grooms.

### 🎯 What a person can SEE that they could not yesterday

1. **`bob02` is a bob.** The owner supplied reference and said the shipped bob was "still very
   different" from it. He was right and it is now arithmetic: the jaw plane on `figure_g050` is
   **z 1.4350** (midline profile in 10 mm bands; forward-y steps −86.9 → −136.9 between 1.430 and
   1.440 — the chin coming off the throat) and bob01's longest cards reach **1.3279**, **107 mm
   below the jaw** and 14.6 mm below the collarbone. bob02's tips land **10-14 mm above the jaw**,
   inside the ±15 mm the reference plates themselves span.
2. **Seven grooms out of one generator**, selectable: `bob01 bob02 crop01 quiff01 long01 pixie01
   lob01`. `hair.html?groom=<id>&bake=<g000..g100>`.
3. **The avatar can stand outdoors.** `Avatar.create({ scene: 'beach' | 'park' })`. IBL went from a
   measured **0.00%** of a forehead pixel to **25.92%** (beach) and **38.22%** (park).

### 🚩 Read these before touching anything

- **`bob01` IS THE CONTROL AND MUST NOT BE "FIXED".** It bakes to
  `98ca6c23b9e0431b36437f386a39b961f1d4e296d58a5cab7cb519044caaea9c` and every committed number in
  this project was measured on it. bob02 is the corrected cut. Same argument as `studio`, which is
  byte-identical at `fac62c50d56590fb` and is the calibration reference for every scene.
- **THE GLBs FOR THE SIX NEW STYLES ARE NOT COMMITTED.** `assets/` is 276 MB against git-LFS's free
  1 GB storage and 1 GB/month bandwidth; six styles × five bakes is ~90 MB more. The generator and
  manifest ARE committed and a bake is 20 s. **This is an open product decision, deliberately left
  to the owner.**
- **THE ROUND FENCE IS 58 COMMITS PAST A CEILING OF 14.** `docs/OPEN-REQUESTS.md` declares R12 at
  `a20bfcb`. Declaring the new round is overdue and expires ~90 open entries, which is what it is
  for. Not done unilaterally.

### 🔴 The three things that are wrong, ranked

1. **EVERY SHORT STYLE FAILS AND EVERY LONG STYLE WORKS.** `crop01`, `quiff01`, `pixie01` render as
   separate dark shingles with scalp between them. The generalised gate finds it independently —
   `no bald patch` 109.7 mm² and `no skin on show` 158.4 mm² at the temple — and the obvious fix was
   tested and refused: rebuilt at bob01's card widths and 682 cards, coverage improves and it is
   still not a haircut.
   🎯 **The diagnosis is the PRIMITIVE, and this is the third independent road to it.** §4 got it
   from a blind control against frostbitten; §11 from a judge on our own plates; this round names a
   REGIME rather than a defect — **cards are fine for a bob and unusable for a crop**, because a
   40 mm card carrying a strand atlas reads as a flake when its own outline is a large fraction of
   its area. Men's short hair does not become good by tuning.
2. **A BEACH DOES NOT READ AS A BEACH AT PORTRAIT FRAMING.** A blind judge shown six unlabelled
   plates named three: both studio plates and beach at BODY framing ("a beach or a wide flat shore,
   sea behind her, late morning to midday" — correct, declared sun 52°). It could not name `park` at
   either framing. 🚩 **The two exterior portrait backdrops are the same picture** — mean |Δ| 2.42
   code values over a sky-only rect, against 150.12 versus studio and 31.79 over the two faces. The
   scenes light the SUBJECT differently by an order of magnitude more than they distinguish the
   WORLD. 11.6's own gate fails on four of six plates.
3. **`park` still looks worse than `studio`, and `beach` is close but not past it.** The skin repair
   was real — the defect was traced to b* collapsing 10.98 → 1.26 while a* never moved (a blue
   illuminant, not a tone curve; exposure was measured and REFUTED as the cause) — and hue came back
   6.4° → 44.9° against the control's 47.2°. But held at matched lightness, all six chroma patches
   still sit BELOW the control. `park`'s ground renders **navy** (hue 218.7 against a declared grass
   at 92.1) and reads blind as dark water; `beach`'s floor is mauve-grey (hue 271.0 against sand at
   40.0). Both are rim-poisoned and nobody has repaired the floor.

### ⚠️ Method failures this round, because they cost more than the code

- **A READER MUST TAKE A PINNED REVISION.** I ran the source sweep concurrently with the build round
  that was rewriting `hair_cards.py`. The readers took the working tree, the builders replaced it
  underneath them, and the synthesis's premise went stale mid-flight with every line citation ~240
  lines off. Disjoint FILE OWNERSHIP does not protect a moving READ. Use `git show <sha>:path` and
  state the sha.
- **A BACKGROUND WORKER THAT CAN STALL NEEDS A LIVENESS CHECK THAT IS NOT ITS OWN COMPLETION
  CALLBACK.** The hair verification fan-out hung: last write 22:16, still nominally running at
  02:47. The loop's fallback heartbeat is what surfaced it.
- **§1.25r reached its NINTH instance, twice inside notes written to prevent the previous one.**
  (7) a hand-fitted linear triple no colour curve produces; (8) a gate table committed under the
  words "re-measured AFTER the last edit" that was an intermediate batch, plus one figure matching
  no batch anywhere; (9) "the post-retune shares are in the round note below" pointing at numbers
  that were nowhere in the tree. Also **RETRACTED**: "an exterior plate is a MODE" — it does not
  reproduce (`bitident 10/10 worst=0 px=0` on all four exterior configurations, checked three ways),
  and it mattered because it had established a noise budget that licensed the stale figures.
  🎯 **The lesson is narrower than "re-measure": this round DID re-measure and then edited again. A
  table is only as fresh as the last write to the file it describes.** REQ-091 is the repair — the
  probe must EMIT the markdown rather than have it retyped.

### ⏭️ Next, in the order I would take them

1. ~~Fix `park`'s navy ground and `beach`'s mauve floor.~~ ✅ **DONE, `36ba35d`.** Attributed by
   removing one light at a time: **the rim was the whole of it** — zeroing it takes park's floor from
   hue 219 to 138 while nulling the ENVIRONMENT leaves it blue. It also explains why park was 5×
   worse than beach: a fixed-irradiance blue light dominates a dark albedo more completely.
   `scales.rim = { irradiance: 0.05, distanceInHeights: 0.5 }` on both exteriors; park hue
   219.0 → 169.4, beach saturation 0.202 → 0.035. ⚠️ Beach's floor is now near-NEUTRAL rather than
   sand-COLOURED — it stopped being lilac, which was the filed defect; warmth is a separate item.
   ⚠️ And `layers` cannot do this: three's node path tests light-versus-CAMERA (`Renderer.js:973`),
   not light-versus-object.
2. **Decide the primitive question for SHORT hair.** It is now a regime statement, not a hunch, and
   it blocks the entire men's set. A scalp-shell surface with strand detail is the candidate nobody
   has costed.
3. **Make a scene read as a place at portrait framing** — 11.8's set silhouettes, pulled forward,
   because 11.6's gate cannot pass without them.
4. Then 11.4 interior, 11.6 the remaining ten scenes, 11.7 the legibility gates.


---

## 15. 2026-08-18 morning — six rooms, and the naming gate still fails

`745c39c`. Punch-list **11.4** (interior), **11.7** (legibility gates) and the first half of **11.6**
(the six ORDINARY scenes). Nine scenes now exist: `studio`, `beach`, `park`, `street`,
`kitchen`, `bedroom-morning`, `desk`, `living-room`, `bedside-night`.

### 🎯 What is real

**One sun, three consumers.** Moving `sun.elevationDegrees` alone moves the walls, the IBL and the
key's direction, colour and level. The discriminator that proves it is a MODEL rather than a gain is
elevation 30 → 45: the beam climbs above the window head, `windowAdmittance` goes to 0, the key
switches OFF — and the far wall HOLDS (5.82e-2 → 5.54e-2 → 5.82e-2) while the face falls 3.1×. The
room keeps the sun's flux through the aperture after the beam stops reaching the subject.

**Backdrops finally differ.** Pairwise mean |Δ| over five masked background rects: beach vs park
**1.98**, studio vs kitchen **41.14**, beach vs kitchen **120.08**. The interior is 61× further from
beach than park is. ⚠️ Necessary, not sufficient.

**At BODY framing the interiors give a corner, a ceiling line and a floor line** — which `beach` and
`park` never had.

### 🔴 What is wrong

1. **11.6's naming gate FAILS and adding five rooms did not move it.** A blind judge took all 18
   plates, randomised them, sealed the key, and named **3 of 18** — `studio` at both framings and
   `beach` at body. **Interiors scored 0 of 10.** The hour reads on most; the place reads on none.
   The rooms are coloured boxes with a floor line — no counter, no desk, no bed, no window.
   ⏭️ **This is now the phase's blocking item and it is 11.8's job**: a scene needs an OBJECT in it.
   Two rounds of light have taken this as far as light can take it.
2. 🔴 **"The window is a portal" was wrong at the pixel and is corrected in place.** Hiding the live
   pane changes **0 px on all six interior plates**. The window is an **APERTURE** — it admits flux,
   it is not a hole you can see the sky through. The light model survives entirely; only the framing
   of it was wrong. ⚠️ The tell was inside the same file: its own arithmetic rules a window out of a
   portrait frame, and four lines later a sentence described seeing one.
3. 🔴 **Two of the five legibility clauses are defective and are declared in the tool's header.**
   L3 measures a **dither cloud** — a ~30 px speckled band ~100 px out in the wall, with the figure's
   real edge unsampled — so it goes red on readable pictures. L4's denominator is that same
   contaminated matte, inflated 1.21–1.29×, under-reporting clipping by 15–22%, **and its own guard
   fires at 90% while the worst measured is 80.58%**. The repair is the matte, once, for all five.
   ⚠️ The other three are near-inert: L1 reads 0.9907 GREEN on an arm where 42.30% of the subject is
   clipped to white.

### ✅ And the failure that did NOT recur

The adversary **could not break reproduction**: all 14 plate digests, the 7-row elevation sweep, the
9-scene gate table to four decimals, the exposure ladder and the backdrop table all came back digit
for digit. **No measurement-before-a-later-edit in the rendered numbers** — the failure that hit the
two previous rounds did not happen a third time. Both agents pinned and reported the sha they read,
and one fingerprinted the dirty tree when `git show` could not see untracked deliverables. The
briefing change worked.

### ⏭️ Next

1. **11.8 — put an object in the frame.** The naming gate cannot pass on light alone and two rounds
   have now demonstrated that. A window reveal, a counter edge, a doorway, a lamp in shot.
2. **Repair the matte**, which unblocks all five legibility clauses at once.
3. The short-hair primitive question (§14), still the blocker for the men's set.
4. 11.6's remaining six occasional scenes.


---

## 16. R31, 2026-08-22 — the primitive is decided, and "muddy" was never the pedestal

**17 agents across two workflows, 0 errors, every deliverable adversarially verified.** Read the
commit bodies; they carry the measurements. New docs: `docs/research/no-coloured-lobe-2026-08-22.md`,
`zinke-dual-scattering.md`, `hair-reference-2026-08-22.md`, `pedestal-look-2026-08-22.md`, and the
spec at `docs/superpowers/specs/2026-08-22-hair-frame-design.md` **with its own addendum retracting
half of its body.**

### 🎯 THE PRIMITIVE IS DECIDED: (b). Do not reopen it without new measurement.

Short styles move to strands; the bob keeps cards plus a strand flyaway shell. Applied against the
**pre-registered 2.0 ms**, in p50, minus the same-session empty arm, GPU render-pool time:

| arm | 720×900 | 1920×1080 |
|---|---:|---:|
| **crop01 8,832 + shadow** | **1.556** | **1.870** ← the number the decision rests on |
| bob 4,960 + shadow | 1.785 | 2.696 |
| bob 11,408 + shadow | 2.943 | 4.185 |

**(a) is refuted robustly** — the bob at the density that reads exceeds *every* parity figure on the
record (1.46 / 1.71 / 2.00 / 2.36) at both resolutions with and without the shadow caster.

🚩 **AND THE ACCEPT HALF IS PROVISIONAL ON ONE MEASUREMENT.** Every strand figure is raster+shade on
a bare page — no TAAU, no G-buffer, no velocity write, no OIT composite, and **no skinning and no
dynamics** (verified: zero `skin`/`bone`/`morph` symbols in `strand-spike.js`'s 1,128 lines) —
against a card cost that is a whole-frame delta on the shipped deferred stack with a skinned groom.
The missing term is nameable: **141,312 skinned points per frame plus the ribbon rebuild**, and it
is plausibly larger than the crop's 0.13 ms margin. The comparison is generous to the prototype,
which is why the **refusal** of (a) is safe and the **acceptance** of (b) is not yet.
**P0: ribbons inside `alive.html`, delta against no-hair, body framing.** Blocking.

⚠️ **`frostbitten`'s 3.3 ms never bound us.** On this machine (Apple M5 Max, 40 GPU cores) their
whole hair cost is 2.168 ms at 11,400 strands and their sw OIT rasterizer alone is 1.403 ms — and
that rasterizer is a transparency architecture we would not adopt.

### 🎯 "MUDDY" IS NOT THE PEDESTAL. THE BSDF HAS NO ACTIVE COLOUR-CARRYING LOBE.

**R cannot carry colour by construction** (`azimuthalValues`' R branch takes no `colour` argument;
measured R/B **1.0307** on the plate) and it is 62% of the brightest luminance decile — so bright
pixels are grey pixels. **TT is the coloured forward lobe and `weightTT = 0`.** **TRT is absent from
the forward hemisphere** — `exp(17cosφ − 16.78)` is 2.14e-15 at `cosφ = −1` — and measures 0.10% of
the mass. So the only thing tinting our hair is slide 39's **hack**, which is why three rounds of
adjusting that hack could not fix a colour problem.

**TT carries 88.4% of the fibre's scattering energy.** `weightTT = 0` is not "a lobe is off".

🔴 **AND TT-ON WAS TESTED THIS ROUND AND IS STILL VIOLET**, with the corrected `#1A0E0C` albedo:
R/B **1.824 → 0.763**, hue 1.5° → 273.1°, 28.96% of the frame. The TT term alone measures hue
237.4° / sat 0.921 against the rim light's **231.8° / 0.941** — agreement to **5.7°**, so TT is
transmitting `#0f30ff` essentially unmodified. **The albedo fix did nothing for it. The cause is the
unshadowed rim alone**, and `LightingRig.js:611-613` is untouched at HEAD (irradiance 16, `#0f30ff`,
`shadowFraction 0`); §14's rim repair applied to the **exterior scenes only**.

⏭️ **The fix is the envelope chord, and R28 already built it.** R27 measured the rim as the most
occluded direction in the groom — p50 **30** card crossings, mean 34.42, **0.04%** of pixels with a
clear path, against the key's p50 0 and 76.66% clear. Attenuating TT by `exp(−σ·ℓ)` along R28's
per-fragment per-light chord annihilates rim-lit TT while leaving key-lit TT (`n ≈ 0.76`) nearly
untouched. Frostbite's Tier-3 fallback, which §10 already named as the tier that fits this rig.
⚠️ **An EXTENSION of Zinke, not Zinke** — his `T_f` attenuates the global multiple-scattering term,
not a single-scattering lobe. **The plate pair above is its control**: any candidate must take R/B
back above 1.0 *while keeping TT non-zero*.

### 🔴 MULTIPLE SCATTERING SHOULD BE ~ZERO, AND THAT IS A TRAP AS WELL AS AN ANSWER

`ā_f` is **not a constant of Zinke's paper** — §4.1.1 states it is precomputed by numerical
integration of Eq. 6 over whatever BCSDF you ship. `tools/critic/hair-af.mjs` does that quadrature
(14/14 clauses, analytic expected values; V3 reproduces the closed form `cosθ_d/2` to twelve digits
under both readings of Ω_f). Result: **`ā_f ≤ 0.131` everywhere**, so `T_f = d_f·ā_f^n` is 1.17e-2 at
n = 1.189 and **3.66e-12** at n = 7.55, against a shipped `scatter` of 1 carrying **65.4%** of the
groom.

🚩 **DO NOT SHIP THAT.** Substituting Eq. 5 does not dim the groom — it deletes two thirds of it,
**and deletes the only colour with it**, because `ā_f` is achromatic with TT off. **TT comes first.**

🔴 **And R28's annihilation was TWO errors stacked.** Eq. 5 is `T_f = d_f · Π_{k=1..n} ā_f` —
exponent **n**, `d_f` outside the product — while `HairMaterial.js` evaluated `ā_f^(1+n)` at
`ā_f = √C`. Both base and exponent wrong. Keeping R27's own (sound) exit-scatter argument, the
corrected form is **`√C · ā_f^n`**.

### 🔴 WHAT THIS ROUND RETRACTED, INCLUDING ITS OWN

- **"Our hair is 3.43× too bright" — WITHDRAWN.** Matched whole-hair masks give **1.03×**.
  `hair.md` §2.1's fringe rect is **skin-contaminated** — its p99 hex `#96757e` is lit forehead, p99
  pixel (1544,591). The dynamic-range shortfall is real but **0.58× encoded / 0.38× radiance**.
  ⚠️ §2.1a's "four reference reads, four with R above B" is really **three hair reads and one skin
  read**; the albedo correction stands on those three plus d'Eon's physical constant.
- **The 2×2 factorial in the spec is DEAD AS SPECIFIED** — its Zinke arms cannot produce a colour
  effect the shipped BSDF is incapable of. Not running it is how the ninth shading round was avoided.
- **`~2.6 ms headroom` does not reproduce.** `alive.html` is **bimodal** on this machine (no-hair p50
  6.53–13.27 across rounds of the identical URL). Use p95 or min-of-rounds, never p50.
- **The blunt hem is the GROOM's, not the primitive's** — it survives into the strand arm. Our arc
  lengths are median 244.2 mm (max 531.1) against Sintel's 101.5 (max 248.0). A `tfx_export.py`
  tip-randomisation fix; a primitive change will not repair it.

### ⚠️ Method, and two of these are about this round's own work

1. 🔴 **`captures/` HAS NEVER BEEN TRACKED**, so every plate, table and manifest backing every round
   had no history and no protection from a `git clean`. Now the DATA is kept (496 KB) and the PLATES
   stay ignored (36 MB). The pattern had to become `/captures/**` not `/captures/` — **git will not
   descend into an excluded directory, so a `!` negation inside one is never evaluated.**
2. 🔴 **And that rule almost committed the answer key to an unrun blind panel.** Same defect
   `blind_ab.mjs` carried until it was repaired the same morning, arriving by a different route.
   **A structural guard only protects the path it is on.**
3. 🚩 **A pre-registered threshold was renegotiated — by me, in the conservative direction — and an
   agent refused it.** *"Renegotiating in the conservative direction is still renegotiating, and it
   establishes the precedent."* Correct. Apply the registered number; file the reproduction failure
   separately.
4. ⚠️ **A caveat written is not a caveat closed.** This round wrote "these masks are not comparable",
   then quoted the number in a commit headline anyway. **A cross-artefact comparison is not quotable
   until its masks are matched — not "quotable with a caveat".**
5. §1.25r reached **instance ten**, in a file whose own header lectures about it.

### ⏭️ Next, in order

1. **P0** — ribbons in `alive.html`, delta against no-hair, body framing. Unblocks (b)'s acceptance
   and fills the one cell that could still upgrade the bob to (a): whether a 4,960-strand bob clears
   2.0 at shipped framing. ⚠️ Two documents disagree on whether 4,960 is an adequate bob density and
   **neither notices**; that fork is the largest unresolved item in the round.
2. **TT + envelope attenuation**, against the R31 plate pair as its control.
3. **Then** the pedestal form, with `ā_f` finally chromatic (11.72× against 1.0096×).
4. **Then** REQ-064's near-axis light — the only way to light TRT, the other coloured lobe.
5. `tools/critic/hair-reference.mjs` **has no selftest** and two false numbers in its comments, and
   it is the tool that would define the factorial's mask. Gate it first.


---

## 17. R31 continued, 2026-08-22 evening — TT closed, ribbons in the shipped stack, P0 still open

**Read §16 first.** This is the same round after its groundwork, and it contains two RETRACTIONS of
things §16 and I said earlier the same day. HEAD `d9773a0`. Suite at §16's state: FAILING GATES 5,
~~**UNDECLARED RED 0**~~, one stale declaration (`HairOIT`, the documented intermittent).

> 🔴 **RETRACTED 2026-08-23 — "UNDECLARED RED 0" WAS NOT TRUE, IN TWO INDEPENDENT WAYS, AND ONE OF
> THEM IS PROVABLE WITHOUT RUNNING ANYTHING.**
>
> 1. **`alive-toggles.selftest.mjs` was already red at `98bfc73`.** Its closure clause — *every url
>    key the page read is classified in this file* — had been printing `UNCLASSIFIED: hairribbons,
>    hairribbonskin, hairribbonwidth` since those keys landed at `04fe601`, in this same round.
>    Statically checkable at that commit: `alive.js` reads `hairribbons` **six times** and
>    `alive-toggles.selftest.mjs` matches it **zero times**. No measurement is needed to see it and
>    none was done. The three keys now carry `UNGATED` rows with the reason.
> 2. **`quoted-numbers.selftest.mjs` was green only because of a SESSION-LOCAL ASSET.** Four claims
>    in `hair-reference.mjs` are verified by clauses that stand down without `--reference <dir>`,
>    because the plates are SHIFT UP / SIE copyright and `.gitignore` refuses them. Those plates were
>    in *that session's scratchpad*. A new session gets a new scratchpad, so on a clean clone — which
>    is what every other reader and every future session has — the gate is **red**. Now declared in
>    `docs/RED-GATES.md` with the repair named.
>
> 🎯 **THE LESSON IS ABOUT THE CLAIM, NOT THE GATES.** Both reds were being printed by
> `tools/run-selftests.sh` at the time §17 was written. `docs/RED-GATES.md`'s own opening paragraph
> says this exact failure happened three rounds running and that *"the information was never
> missing — what was missing was a step that fails when the information goes unread."* §17 quoted a
> summary line instead of the run. **A suite result is only as good as the environment it was taken
> in, and "UNDECLARED RED 0" must never again be written from anything but a fresh run's own
> output.** Related: `a-table-is-as-fresh-as-the-last-write`.

### 🎯 THE TT LINE IS CLOSED. Do not reopen it without a new light.

§16 named TT as the missing coloured lobe and the envelope chord as its fix. Both halves were built
and measured, and the line closes:

1. **TT on, unattenuated, is still violet** — re-tested WITH the corrected `#1A0E0C` albedo, so the
   albedo fix did nothing for it. R/B **1.824 → 0.763**, hue 1.5° → 273.1°, 28.96% of the frame. The
   TT term alone reads hue 237.4° / sat 0.921 against the rim light's own **231.8° / 0.941** —
   agreement to **5.7°**, so TT transmits `#0f30ff` essentially unmodified. `?hairlobes=r,tt,trt`.
2. **The envelope attenuation kills the blue and takes TT with it.** `?hairdefect=tt-envelope`
   restores R/B to 1.823 against shipped 1.824 — and TT survives at 0.18%, i.e. the plate IS the
   shipped arm to one code value. The arm's own pre-registered gate says that is a FAILURE.
3. **The repair (`attenuateTT` false on `direct()`) is right and does not rescue it.** `direct()`
   carries the key's SpotLight, whose `lightColor` already contains the shadow map, so the chord was
   double-counting a real occlusion. Fixing it moves survival 0.18% → 0.52%. The plate does not move.

🎯 **AND THE CEILING WAS MEASURED RATHER THAN ARGUED, WHICH IS WHAT CLOSES IT.** With
`?ov=rim.irradiance:0` the **rim supplies 91.21%** of everything TT delivers, and the ray cast says
only **0.48%** of visible fragments have a clear path to the rim (1.44% at ≤2 crossings, against the
key's 63.84% at zero). So annihilating rim TT is CORRECT PHYSICS and necessarily removes nine tenths
of the lobe. What any repair can recover is the other **8.79%**, which is warm (R/B 2.075) and worth
about **2% of the mass**.

> **TT is not the "muddy" fix on this rig, and the reason is geometric rather than a bug.** No
> fragment has a thin path to a back light. The remaining coloured lobe is **TRT**, and it needs a
> light near the view axis — **REQ-064**, which is now the only candidate left standing.

⚠️ The chord does carry real signal at the thin end: at fragments the ray cast calls clear, 15.79%
retain `T > 0.1` against a 0.82% baseline — a 19× enrichment with poor recall. It can tell a thin
path from a thick one; it cannot tell WHICH thin path.

### 🎯 RIBBONS RENDER IN THE SHIPPED DEFERRED STACK

`?hairribbons=<url>` on `alive.html` swaps the card groom for a ribbon groom from a TressFX `.tfx`,
**skinned to the figure's own head bone**, through the same G-buffer, rig, OIT, resolve and material.
bob01 at 11,408 strands reads as a real head of hair — individually resolvable strands, feathered
silhouette, no card facets. `packages/core/src/material/HairRibbons.js` holds the loader, the
geometry builder, the lighting model and the node set; `tools/spikes/strand-spike.js` imports the
same module, so there is one definition.

**The skinning is EXACT, not an approximation:** `verify_glb` reports the card groom as
`bones {head}, worst weight sum 1.000000`, so a ribbon groom takes `skinIndex` 0 into a one-bone
skeleton and `skinWeight` (1,0,0,0). That IS the card rig. 141,312 skinned points for crop01 at
8,832; 182,528 for bob01 at 11,408.

⚠️ **NO DYNAMICS ON THE RIBBON ARM, ENFORCED RATHER THAN DOCUMENTED.** `HairDynamics` and the ribbon
expansion both write `material.positionNode` and three has ONE such slot. The solver won, every
ribbon collapsed to zero width, and the plate came back **BALD rather than erroring** — a silent
failure that reads exactly like a placement bug. `?hairmotion` defaults ON, so this was the ordinary
path. `alive.js` now refuses the pair and warns.

⚠️ **AND THE EXPANSION MUST COMPOSE WITH SKINNING.** `NodeMaterial.setupPosition` runs
`skinning( object )` and THEN assigns `positionNode` unconditionally
(`node_modules/three/src/materials/nodes/NodeMaterial.js:774-803`), so an expansion built on
`positionGeometry` discards the skinning. `ribbonNodes` now takes a position basis. At bind pose this
changes nothing, which is why it did not show on a `?freeze` plate — it will show the first time the
head turns. **The tangent is still unskinned**, a stated limit, not a discovery for later.

⚠️ `crop01` LOSES ITS FRONT THIRD INSIDE THE SKULL on the shipped figure. The same `.tfx` renders as
a full dense groom on the spike page, which has no head mesh. Short strands hug a scalp that sits
inside the figure's head surface — a generator matter (`HAIRLINE_LIFT` / `ATTACH_*`), the same regime
§14 files against every short style, and **crop01 is the groom the parity figure was measured on.**

### 🔴 P0 IS NOT CLOSED, AND I WAS WRONG ABOUT WHY TWICE

`frame-budget.mjs` now carries the ribbon arms and runs end to end. It does not produce a usable
delta: `ribbons-bob-4960` reads **2.9 ms faster than rendering no hair at all**, which cannot be true.

**Three real harness defects were found and fixed, and the fixes are verified:**

1. **The round-robin was biased by POSITION.** A fixed arm order let each arm inherit the previous
   arm's GPU state: `no-hair` and `no-hair-2` are the SAME URL and differed by **+1.77 ms** in
   fast-mode median. Every ribbon arm sat after the card arm. Now shuffled per round with a recorded
   seed — and the control proves it: the two arms converged to **13.004 vs 12.990, 0.014 ms apart.**
2. **The arms were unequal on motion.** `?hairmotion` defaults on, so cards ran the solver and
   ribbons had it refused, while a comment claimed motion was off on every arm. Now explicit.
   ⚠️ ~0.018 ms — a correctness fix, never the explanation.
3. 🔴 **A `--only` filter I added aliased its own array**, so a default run executed ZERO ARMS,
   finished fifteen rounds in seconds and threw on a missing gate row. A silent no-op that looks
   like a fast success is the worst shape a harness bug takes.

🔴 **RETRACTION: "Δmin is the robust statistic" and "ribbons cost 1.5–2.3× the cards" are WITHDRAWN.**
`captures/hair-r31-ladder-ours/tools/strand-time.mjs:317` already says why, and said it before I
looked: *"a minimum-of-samples is NOT comparable ACROSS arms here: some rows would be quoting the
boosted clock and some the base clock… That is the opposite of what a minimum is for."* Minima across
arms compare **GPU clock states**, not workloads. The direction may still be right; there is no
evidence for it.

🎯 **THE DIAGNOSIS, and it is structural rather than a tuning problem.** The same header names the
cause as **duty cycle**, and `frame-budget.mjs` violates it by construction: it round-robins a bare
720×900 spike page (the gate) against 1080×1920 full-deferred pages. Those cannot sit in the same
DVFS state, which is exactly the condition under which that header says cross-arm comparison is
invalid. The strand ladder reached ~1% spread because **every one of its arms was the same page
class.** Neither a quieter machine nor a better percentile fixes this — measured: load 2.15 on 18
cores with nothing else running still gave a 67% gate spread, and batch 24 → 96 moved `no-hair` from
12.991 to 13.017.

### ⚠️ Two more retractions from this round

- **§16's `hair-reference.mjs` figures.** Its "769 of 771 lie below y = 570" is INVERTED (60 below,
  710 above) and — worse — `fringe rect, hair only` cuts the rect in **Y** while the skin
  contamination lives in **X**. It keeps 60 contaminated pixels rather than 2. **It is a smaller
  rect, not a cleaner population, and must not be quoted as skin-excluded.** The reference fringe has
  no published hair-only dynamic range. Filter 3 is worth **0.5719 → 0.2854**, not `→ 0.1932`, which
  is §9.2's value from a different capture. All three now gated by
  `tools/critic/hair-reference.selftest.mjs` (18/18 with the reference present, stands down with a
  reason without it — the plates are SIE copyright and gitignored).
- **`hair-plates.mjs` read its census BEFORE the first draw**, so `describe().envelope.fitted` read
  FALSE on plates whose shell was fitted. It reads exactly like §11's filed defect and cost a
  diagnosis pass. Fixed; the control now reports `fitted true, residual 0.3852730609170131` matching
  `envelope-reference.json` to the digit, **with the plate byte-identical across the change.**

### ⏭️ Next, in order

1. **P0's harness needs the ladder's timing method, not a patch.** Every arm must share a duty cycle:
   either the gate becomes the same page class as the arms, or the arms are timed the way
   `strand-time.mjs` times them. Until then branch (b)'s ACCEPT half is unmeasured.
2. **`crop01`'s scalp clearance**, because crop01 is what the parity figure rests on.
3. **REQ-064** — the only coloured-lobe candidate left after TT closed.
4. `alive.html`'s **bimodal p50** is still unexplained and the record has been quoting a statistic
   with two modes as though it had one.
5. The 4,960-vs-11,408 bob density fork from §16 — two documents disagree and neither notices.

### Method, and the two that are new

- 🚩 **A DOCSTRING IS NOT A GUARD.** `buildRibbonGroom` said "NO DYNAMICS" and did not enforce it; the
  solver silently flattened the groom.
- 🚩 **A TIMEOUT MUST CARRY ITS CAUSE.** `hair-plates.mjs` reported "Timeout 120000ms exceeded" while
  the real TypeError sat unread in a variable printed only on a path a timeout never reaches.
- **A structural guard only protects the path it is on** — the `blind_ab.mjs` key fix did not stop
  `.gitignore` nearly committing a blind panel's answer key eight hours later.
- **A caveat written is not a caveat closed.**

---

## 18. R32–R33, 2026-08-23 — three requests closed by measurement, and the rim is answered

**Read §16 and §17 first, and read §17's retraction box before trusting anything in it.** HEAD
`a770038`, nine commits past §17's `98bfc73`.

**Suite at HEAD: FAILING GATES 6, UNDECLARED RED 0, STALE DECLARATIONS 1** — the six are
`HairMaterial` (76/80, red by design), `sway` (the affect/footprint composite), `hair_alpha`,
`quoted-numbers` (declared this session — red on a clean clone by construction), `request-ledger`
(the ROUNDS clause) and `verify_glb`. The stale declaration is `HairOIT`, the documented
intermittent that passes about nine runs in twelve, and deleting its declaration would be wrong.

🚩 **THAT LINE IS COPIED FROM A FRESH RUN'S OWN OUTPUT**, at `23:38:55Z`, because §17's identical
line was written from memory and was wrong in two independent ways. See the retraction box in §17.
**Do not write this line from anything but a run.**

This session closed the three requests the hair phase had been circling, each on a pre-registered
rule applied as written, and none by argument. It also corrected four things in our own record — two
of them from earlier the same day.

### 🎯 THE HEADLINE: "muddy" is not a lighting problem, and now that is measured rather than argued

Three independent routes to a lighting fix are closed, all bounded by plates:

| request | asked for | verdict | the number that decided it |
|---|---|---|---|
| **REQ-064** | a near-axis light so TRT can fire | **REJECTED** | attribution **1.048×** against a registered 2.0×; slide 39's fake carries **88.8%** |
| **REQ-078** | a different rim hue | **REJECTED** | the outline and the muddiness are different problems; hue is the lever for neither |
| **REQ-063** | a shadow caster on the rim | **REJECTED** | shadowed rim and DELETED rim give the same p50 hair luma **to eight decimals** |

**The coloured-lobe list is empty.** R cannot carry colour by construction (relative chroma exactly
`0.0000` at every azimuth, re-derived this round from the BSDF's own CPU mirror). TT closed
2026-08-22 on a geometric ceiling. TRT closes on an absorption ceiling that a rig cannot move.

**And the rim is answered.** Its entire exposure to the hair is worth **2.508 codes** of mass-mean
chroma — bounded by `captures/hair-r33-rimshadow/rim0.png`, not argued — while the muddiness is a
**38% collapse** of the groom's saturation as it lightens, which survives deleting the rim entirely.

So every remaining route runs through the **fibre** and the per-channel `T_f = d_f · Π ā_f(θ_d)` of
`docs/superpowers/specs/2026-08-22-hair-frame-design.md` §5. That is a MATERIAL change, `ā_f` is
already derived and bounded at ≤ 0.131, and it is where the frame design put it before any of these
three rounds ran.

### 🔴 REQ-064 — refuted by the measurement it asked for

Full write-up `docs/research/req-064-refuted-2026-08-23.md`. Registered at `79c870e` before any arm
was rendered; decoy at azimuth 180 clean at ratio 0.004; drift **0.0000**.

Two things were wrong with the request before a pixel was drawn, and neither needed a measurement.
Its change clause named `CAMERA_AZIMUTH_DEGREES` — `Avatar.js:233`, the camera's yaw in the
**character** frame — while the rig's azimuth is measured **from** the camera, so the camera axis is
**0** and 12 discards 31.0% of an `exp(17 cos φ)` peak. And it asked for a fifth AREA light, which
`placements()` throws above at 0.9543 ms each against a 1.870 ms hair budget. It only became
measurable as a `DirectionalLight`.

⚠️ **It ships at `irradiance: 0`** and `buildLights` constructs nothing at zero, so the frame pays
nothing while `?ov=glint.irradiance:0.05` rebuilds it and every arm reproduces.

### 🔴 REQ-078 — rejected on plates, and it was two requests

The plates that decided it had been committed since R31 and nobody had opened them.
`hair-r31-shipcheck` against `hair-r31-norim-ttoff` separates the problems the entry had fused:
the **violet outline** is 100% the rim's (cool pixels → 0.00% with the rim off), and **muddy is not**
(the 38% collapse survives deletion). Its own "cheapest thing on the list" read a spec row about
CAST SHADOW **pixels** and applied it to a **rim**, landing 16.5° further from the only applicable
clause and within 3.1° of the violet this repo already withdrew.

### 🔴 REQ-063 — and the bit-identical rows

Registered at `55f1711`. `shadowFraction: 1` and `rim.irradiance: 0` give the same p50 hair luma —
**0.06378722 both**. A fully shadowed rim delivers *nothing* to the hair, so the registered
matched-luma bisection terminated at E = 0 and gate 1 read **0.994× against 2.0×**. One option is
free; the other is a caster priced at **2.62 ms**, more than the whole groom.

🎯 **And the entry's own "the two changes have to land together" is refuted.** The 2×2 had never been
run: shadow alone +2.492, the pair +2.551, so `sideVisibility` on top of a shadow adds **0.059
codes** — exactly what the physics predicts once the rim is occluded.

✅ **A BY-PRODUCT WORTH RECORDING: §17's TT CLOSURE WAS INDEPENDENTLY CONFIRMED.** The R32 arms in
`captures/hair-r32-glint/rim-shadow.md` ran TT **on** against a shadowed rim — the one combination
nobody had tried, because `sideVisibility` exempts TT from the occlusion that discards the rim for R
and TRT. Shadowing the rim **kills the violet outright**, R/B 0.886 → 2.019, so the physical repair
works and the modelled occlusion succeeds where the envelope chord failed (§17 diagnosed that
failure as *"truth is bimodal, an ellipsoid is smooth"*, and a shadow map is bimodal). **And TT is
still worth +0.364 codes on top of the shadow alone.** So the closure holds for the reason §17 gave:
when the occlusion is modelled, 91.21% of TT dies whatever colour it was. **Do not reopen TT on the
strength of a rim repair — that experiment has now been run.**

### ⚠️ FOUR CORRECTIONS TO OUR OWN RECORD

1. **§17's `UNDECLARED RED 0` was not true, in two independent ways.** `alive-toggles` had been red
   since `04fe601` — provable statically, `alive.js` reads `hairribbons` six times at `98bfc73` and
   the gate matched it zero times — and `quoted-numbers` was green only because copyrighted
   reference plates sat in **that session's scratchpad**. On a clean clone it is red. Both declared.
2. **The REQ-064 refutation quoted a STALE FIBRE COLOUR through five sites.** `#150F17` is the
   pre-correction albedo (§1: *"a physical error, now fixed"*); the shipped constant is
   `HAIR_BASE_COLOUR_HEX = 0x1A0E0C`. Re-derived: TRT relative chroma **0.6712** (published 0.4981),
   share of an on-axis light **25.9%** (19.0%), absorption ceiling **0.01669** (0.022).
   🎯 **And the hue was backwards.** TRT on the shipped fibre is **7.1°, a red** — the copper the
   judges asked for — where the stale fibre computes **283.7°, a violet**. The published claim was
   correct and was reached from a computation saying the opposite. Every MEASURED number is
   unaffected; the plates came off the shipped renderer.
3. **`LightingRig.js`'s "REQ-063 buys nothing this file can deliver" was a LUMA assessment**, correct
   on median and on the wrong quantity. Retracted in place.
4. **My own P0 diagnosis is withdrawn** — see below.

### 🔴 P0: the harness was timing a bald frame

§17 said P0 needed the ladder's timing method because a 720×900 gate page cannot share a clock state
with 1080×1920 arms. Sound, and **not what was breaking it**. Nothing in `frame-budget.mjs` ever
proved an arm rendered what it claimed: `arm.info` collected every property of the RENDERER and none
of the PICTURE, while `alive.js` had published `sugata.report().hair` with a full census since the
arm landed, with no consumer.

~~**With the census read, the `hair` arm attaches no groom** — `hairEnabled` true, `hairRequest` set,
`report().hair` null after 600 s, one 404, no warning.~~

> 🔴 **RETRACTED THE SAME DAY, AND THE RETRACTION IS MINE TWICE OVER. THERE IS NO 404, AND THE ARM
> WAS NEVER BALD.** `alive.js:1434`'s `report()` returns `defects`, `nudgeMillimetres`, `affect`,
> `affectPostureDegrees`, `identity` and `foundation`. **It has no `hair` key at all** — `'hair' in
> report()` is `false`. The hair census lives on **`sugata.subsystems()`**, which is
> `censusOfShading( session, stage )` at `alive.js:3548`.
>
> So `report().hair` yielded `undefined`, my `?? null` coerced it, and `assertArmRenders` reported a
> **fully attached groom as absent**. Measured on the harness's own server: every asset serves 200
> (`figure_g050.glb`, `bob01/g050.glb`, `flow.png`, `depth.png`), **zero requests ≥ 400**, zero
> swallowed rejections, and `session.hair` is SET. With the accessor corrected the harness runs end
> to end and every arm's census matches its registered expectation exactly — cards
> `groomMeshes: 1, strandCount: null`; ribbons at **8,832 / 4,960 / 11,408** strands with
> 141,312 / 79,360 / 182,528 skinned points.
>
> 🚩 **THE GUARD I BUILT TO CATCH "NOTHING ASSERTED THE STIMULUS" ASSERTED THE STIMULUS AGAINST A
> FIELD THAT DOES NOT EXIST.** It is the same defect class it was written to prevent, one level up,
> and it produced a confident diagnosis that stood for a day. A `?? null` on an optional-chained read
> cannot tell *"the page says no groom"* from *"I asked the wrong object"*.
>
> ⚠️ A first re-run at n=16 showed the control's two p50s 70% apart and I nearly wrote that down as
> the finding. **At n=384 it converges to 0.7%** — 13.007 against 13.104 ms — so that spread was
> small-sample, not clock state. Recorded because it was one paragraph away from becoming a third
> wrong diagnosis of the same harness in one day.

### P0 AT HEAD: the stimulus is verified, the control converges, and ONE arm is still anomalous

Measured with the accessor fixed, 8 rounds × batch 24 × 2 per visit, **384 samples per arm**, every
arm's census asserted before its samples counted:

| arm | n | min | p05 | **p50** | p95 |
|---|---:|---:|---:|---:|---:|
| contention gate | 16 | 1.548 | 1.636 | 2.465 | 3.085 |
| `no-hair` | 384 | 4.812 | 5.736 | **13.007** | 14.701 |
| `hair` (cards) | 384 | 1.704 | 3.875 | **9.019** | 16.492 |
| `ribbons-bob-4960` | 384 | 4.115 | 6.461 | **9.722** | 19.672 |
| `ribbons-crop-8832` | 384 | 6.069 | 6.904 | **14.398** | 20.892 |
| `ribbons-bob-11408` | 384 | 8.538 | 11.660 | **17.081** | 21.495 |
| `no-hair-2` | 384 | 2.904 | 5.507 | **13.104** | 14.656 |

1. ✅ **THE CONTROL REPRODUCES.** The same configuration at both ends of the arm order: p50 13.007
   against 13.104 (**0.7%**), p05 5.736/5.507, p95 14.701/14.656. The harness is no longer
   noise-dominated, which it demonstrably was before.
2. ✅ **AND THE RIBBON LADDER IS MONOTONIC IN STRAND COUNT** — 4,960 → 9.722, 8,832 → 14.398,
   11,408 → 17.081 ms. That is a physical curve and it is the first one this harness has produced.
3. ✅ **AND THE `no-hair` ANOMALY IS NAMED — it is a MIXTURE, not a cost.** Full analysis:
   `captures/hair-r31-ladder-ours/data/no-hair-anomaly-2026-08-23.md`.

   Every arm is **bimodal**, two GPU clock states 1.33–2.22× apart, fitted by k-means on the 384
   samples. **Within each mode the sign is physical** — cards costs **+0.247 ms** in the fast mode
   and **+1.728 ms** in the slow one. The p50 inverts only because **58.9%** of the cards samples
   sit in the fast mode against **33.6%** of no-hair's, so the two medians are drawn from different
   clock states. A median across a mixture that varies per arm reports which state the arm sat in,
   not what it cost.

   🎯 **The per-mode statistic is the reproducible one.** The control's two captures agree to
   **0.0%** in the slow mode (13.473 vs 13.474) and 2.5% in the fast. It is the MIXTURE that
   wanders — 28.9% against 33.6% for one configuration.

   🔴 **THE MECHANISM IS DUTY CYCLE, AND THIS HARNESS REINTRODUCED A DESIGN THE LADDER HAD ALREADY
   REFUTED.** `strand-time.mjs:321-325`, written first: *"a harness that idles between frames is
   measuring its own latency's effect on the clock."* `frame-budget.mjs` resolves timestamps ONCE
   PER FRAME — a `mapAsync` round trip between every submission — and **a lighter arm idles more**,
   so it drops to base clock more often and reports the longer frame. Measured: bursting frames back
   to back narrows the cards-vs-no-hair gap from **2.797 ms at N=1 to 1.046 ms at N=16**.

   ⚠️ It does not fully invert at six reps, so duty cycle is confirmed as **a** cause and not yet
   demonstrated to be the only one. The fix is to report **per mode** (no re-capture needed; the
   existing run becomes readable) and then to burst-and-divide, which the file's own comment already
   derived — *"315.686 / 24 = 13.15 ms"* — and then rejected.

### 🎯 AND THE CARDS ARM IMPROVES SHARPLY — but "closed" was too strong, corrected below

Both halves of the repair went in. **Reporting per mode made it honest but did not fix it**: with the
clock boundary fitted once on pooled samples, the control's own per-mode spread was ±0.4 ms — the
same size as the card groom's cost — and the ribbon slow-mode deltas did not track strand count.
Conditioning on a state cannot recover a cost when the state is entangled with the workload.

**Bursting did fix it.** `takeSample` now submits `burst` frames back to back, resolves ONCE, and
divides by the burst — which this file's own earlier comment had computed (*"315.686 / 24 = 13.15
ms"*) and discarded as a bug rather than recognising as a mean. Measured, 48 samples an arm:

| arm | p50 | Δ vs no-hair | % in one mode |
|---|---:|---:|---:|
| `no-hair` | 9.430 | — | **97.9%** |
| `hair` (cards) | 9.891 | **+0.461** | 95.8% |
| `ribbons-bob-4960` | 13.455 | +4.024 | 31.3% fast |
| `ribbons-crop-8832` | 15.340 | +5.909 | 12.5% fast |
| `ribbons-bob-11408` | 15.987 | +6.557 | 12.5% fast |
| `no-hair-2` | 9.245 | −0.186 | 97.9% |

1. ✅ **THE MIXTURE IS GONE FOR THE LIGHT ARMS.** `no-hair` went from 33.6% in one mode to **97.9%**.
   The per-mode instrument now reports *"single mode — mixture gone"* and refuses to difference a
   cluster of n=1, which is a hole it grew while being used.
2. ✅ **Δp50 IS POSITIVE AND PHYSICAL: +0.461 ms**, against −3.974 before. And it agrees with an
   INDEPENDENT route — `HairMaterial.selftest.mjs` measures the groom at **0.738 ms p50** by a
   different method entirely. The control reproduces to 0.185 ms.
3. ⚠️ **THE RIBBON ARMS HAVE NOT COLLAPSED** — 12.5%, 31.3%, 12.5% in the fast mode against
   no-hair's 97.9%. So their p50 is still a mixture and **their deltas are not yet comparable
   costs.** They are monotonic within `bob01` (4,960 → +4.024, 11,408 → +6.557), which is
   encouraging and is not the same as measured.

> 🔴 **CORRECTED THE SAME DAY BY A VERIFICATION PASS I HAD NOT COLLECTED.** A parallel
> investigation ran a cleaner protocol — **two resident pages, arms alternated ONE FRAME at a time**
> rather than in 48-frame visits — and measured today's cards at **+1.61 and +1.59 ms**, two
> replicates 1% apart, cards slower as physics requires. It also ran my harness at HEAD three times
> and got **−1.570, +1.191 and +0.501 ms** for the same statistic, with the no-hair control
> disagreeing by up to 20.9% at p50 within a single run.
>
> **So +0.461 is one draw from a swing that still includes negative values, and "the cards arm is
> closed" is withdrawn.** Burst-and-divide is a real improvement — it collapsed the light arms from
> 33.6% to 97.9% in one mode — and it is not sufficient. Three figures for the same quantity now
> stand: 0.738 ms (`HairMaterial.selftest.mjs`, independent route), 0.461 (this harness, one run),
> 1.61/1.59 (frame-granularity interleave, two replicates). **The last is the best-controlled.**
>
> 🎯 **AND IT INDEPENDENTLY CONFIRMED THE MECHANISM BURST-AND-DIVIDE RELIES ON.** Under `?capture`,
> `takeOverFrameLoop` stops the animation loop and `Animation.js:75` is the only caller of
> `info.reset()` — so `info.frame` is FROZEN, all 21 pass uids land in one group, and
> `passSum === info.render.timestamp` exactly. That is precisely why the resolved value is the sum
> over the whole burst and why dividing by the burst is correct. ⚠️ It also means
> `info.render.drawCalls` and `.triangles` are CUMULATIVE on this page and must be diffed across one
> step — read raw they are boot-to-now totals.
>
> **NEXT, AND IT IS CHEAP:** interleave at FRAME granularity between resident pages, and add a
> **known-zero calibration gate** — the instrument must measure zero on a pair it knows is zero
> (no-hair against no-hair) before it is allowed to report anything non-zero. That is the Verifier
> idea applied to a timing harness, and this session produced three wrong timing conclusions that it
> would have caught.

🔴 **SO BRANCH (b)'S ACCEPT HALF IS STILL NOT SETTLED, AND THE TEMPTATION HERE IS THE ERROR.** The
registered threshold is **+2.0 ms p50** and `ribbons-crop-8832` reads **+5.909**. Reading that as a
FAIL would be applying a registered rule to a number the same page says is not comparable — the
ribbon arms are cross-mode against the baseline. **The next step is to make the ribbon arms collapse
too** (longer bursts, or a heavier warm-up that holds them at one clock), and only then read the
rule.

Four silent readiness defects died on the way. The reusable one: **`waitForFunction` with an `async`
predicate never waits** — an async arrow returns a Promise, a Promise is truthy on the first poll, so
the wait reports success instantly. `tools/critic/hair-lightpath.mjs`'s `waitForFigure` is written
that way, in the file whose own docstring warns about this hazard.

### 🚩 THE PATTERN THIS SESSION ESTABLISHED: four colour questions answered with a luma operator

REQ-064 assessed as a brightness lever **twice**. REQ-063's "buys nothing" on median luma. And the
`sideVisibility` arm scoring the table's largest "improvement" on an **unsigned** chroma statistic
while R/B collapsed to 0.932 — the violet wearing the statistic's clothes.

Every one was *correctly found small* by an operator that could not see the property in the
complaint. The rule this yields is sharper than "assert the stimulus": **the operator must be able
to see the property the complaint names before it is allowed to answer it.** The next colour
registration needs a SIGNED statistic — R/B, or chroma projected on the fibre's own hue axis (7.1°).

🚩 **And a second, cheaper one:** the ceiling plate for every possible rim intervention was **already
on disk** since R31. Three rounds argued about hue without opening it. Not *"is the stimulus
present?"* but **"has this experiment already been run?"**

### What is new in the tree

- `tools/critic/hair-glint.mjs`, `tools/critic/hair-rimshadow.mjs` — two registered rounds, each
  with a decoy, a drift control and gates that refuse to report when a control fails.
- `chromaInCodes` / `cielabChroma` in `tools/critic/color.mjs`, with the unit defect in REQ-064's
  own registration declared over them.
- `assertArmRenders` in `frame-budget.mjs` — throws rather than warns, because a warning beside
  fifteen rounds of scrolling timings is a warning nobody reads.
- `GLINT_LIGHTS` in `LightingRig.js` — a `DirectionalLight` class the rig did not have, shipped at
  zero, with `directionFor()` extracted so the camera-relative convention lives in a name rather
  than inside a loop body. That convention living in a loop is how REQ-064 came to name a different
  frame and nobody noticed for eleven days.
- `docs/hair-way-forward-2026-08-23-review.md` — 38 claims from an outside review checked against
  the tree: 24 confirmed, 7 misleading, 6 wrong, 1 unverifiable.

### The open list, in the order I would take it

1. **P0's timing method.** The 404 is named — there was none; see the retraction above. The harness
   now verifies every arm's stimulus, so what remains is the interleaved single-page design: toggle
   the groom inside one running page, A/B/A/B, N cycles after M warm-up toggles, so both halves of a
   pair share the immediately preceding clock state **by construction**. ⚠️ But the cheap half comes
   first and needs no re-capture: **report per clock mode.** The clusters are clean, the per-mode
   control agrees to 0.0%, and the sign is already physical — the existing 384-sample run becomes
   readable by changing the reporting alone. Then burst-and-divide.
2. **The fibre and the per-channel `T_f`.** The only surviving route to "muddy", and it is a
   material change. `ā_f` is derived and bounded.
3. **`rim.irradiance` per preset.** REQ-063's rejection defines this: the rim's *job* is backdrop
   separation, its *cost* is a wash over the groom, and those are separable by a free constant.
   An art-constant look-dev item, not a physics round.
4. `crop01`'s scalp clearance — still the groom the parity figure rests on.
5. The 4,960-vs-11,408 bob density fork.
6. **Declare the round.** The fence is **101 commits past a ceiling of 14** — measured at HEAD, not
   quoted, because §14's "58" was stale by 43 and read as present tense.

---

## §19 — R34, the stopwatch round (2026-08-24, overnight)

**HEAD `fbb001d`.** Tool: `tools/critic/frame-cost.mjs`, 52 selftest gates. Registrations:
`docs/superpowers/specs/2026-08-23-frame-cost-preregistration.md` (**closed VOID**) and
`2026-08-24-frame-cost-v2-preregistration.md` (**voided on G1**). Findings:
`captures/hair-r34-frame-cost/findings-2026-08-24.md`.

**Seven calibrated runs. Seven refusals. No blessed cost.** Read the findings doc before touching
timing again — the refusals are where the information is.

### The three things a successor must not re-derive

1. 🔴 **~~The same picture costs 30% more depending on which page draws it~~ — RETRACTED the same
   day, by an adversarial pass over this round's own claims.** The arithmetic was exact; the causal
   noun was wrong, and the section committed the error it indicted two paragraphs later — an
   unpaired subtraction of one page from another, on a pooled statistic.

   **What survives is narrower and stronger.** Two pages opened from the *identical URL*, with no
   ribbon geometry and only three resident contexts, differ **22.56%** on a pooled median — and are
   **indistinguishable when paired** (+0.148, sign 53.3%, CI [−0.159, +0.378], passing the
   registered null). So cross-page *pooled* comparison is unreliable; the 30%, the noun "page
   identity", and the mechanism "resident geometry" are all gone. Correlation of hidden p50 with
   resident triangles is r = +0.175, and in one run the page holding **no geometry at all** is the
   most expensive.

   🚩 **The cause was a confound in the harness, now fixed.** `tickSchedule` rotated arm order, and
   **a rotation preserves adjacency exactly** — every arm had exactly two possible predecessors in
   an 80/20 split, forever, so page identity and predecessor identity could never be separated.
   Position balance was gated; adjacency balance was not. See `findings-2026-08-24.md` §2R.
2. 🔴 **v2's pair-integrity gate G1 measures effect size, not clock stability.** Agreement falls
   monotonically as the effect grows — 62.5% at +3.275 ms, 57.5% at +5.182, 45.5% at +7.513 —
   while identical-workload pairs hold 81–88% regardless. **The bigger the real cost, the more
   confidently the gate calls the measurement invalid.** Delete it in any v3; the workload-free
   replacement (a second read of the *hidden* condition in the same batch) is already collected.
3. ✅ **`visible = false` is licensed as equivalent to absence**, measured, census deltas 0/0 on
   every run. The self-difference primitive stands. Its own null — N3, within page, same picture —
   is clean on **every** run: +0.011, −0.112, −0.110, −0.113, −0.124. It is N1/N2, which pair across
   pages, that fail.

### 🎯 The schedule fix, and the one diagnosis that unifies the whole round

Re-run at `49b2e13` with the confound broken: **all twelve nulls pass**, pooled and inside each clock
state. N1 went from +0.316 / −0.301 / +0.303 and failing to −0.028 / −0.214 / −0.099 / −0.086 and
green; N2 from five-of-six failing to **six of six passing**. One line of scheduling.

**And every failure in this round is one defect wearing three hats — a pooled statistic used where a
paired one was available:**

| where | pooled | the paired replacement, which already exists |
|---|---|---|
| the retracted headline | pooled p50 across pages | the registered per-tick paired median |
| gate **G1** | bins a pooled quantity, so effect size crosses the bin | within-pair state agreement at fixed workload |
| **`REFERENCE_TOLERANCE`** | pooled median of a mixture | **N2 — already computed, passed 6/6** |

Evidence for the third: across five identical pictures the pooled spread is **29.7%**, within the
fast state **8.5%**, within the slow state **0.8%** — and the pooled ordering tracks fast share
exactly. `cards-` vs `bald` reads −0.086 ms paired and 24% apart pooled.

**A v3 would be a NARROWING** — deleting two uses of a statistic proven unfit — not a loosening.
Deliberately not taken; it is the owner's call.

### The provisional numbers, which are NOT to be quoted as the answer

One run, one clock, v1 §5's registered statistic, all pairs:

| arm | strands | p50 | 95% CI | sign | reference |
|---|---:|---:|---|---:|---:|
| cards | — | +1.120 | [0.851, 1.288] | 81.0% | 7.541 |
| bob4960 | 4,960 | +3.099 | [2.756, 3.581] | 98.0% | 6.652 |
| crop8832 | 8,832 | +6.441 | [5.356, 7.613] | 100.0% | 8.557 |
| bob11408 | 11,408 | +6.923 | [6.438, 7.442] | 100.0% | 6.623 |
| **N3 null, identical path** | — | **+0.011** | [−0.123, 0.090] | 51.0% | — |

⚠️ **Superseded by the fixed-schedule run** (`data/frame-cost-all-49b2e13.json`): cards **+1.212**
[1.019, 1.531], bob4960 **+3.380**, crop8832 **+4.775**, bob11408 **+8.268**. The ribbon figures are
**not stable across runs** — crop8832 moved −26% and bob11408 +19% — so quote no ribbon cost better
than "3–8 ms".

🎯 **The one comparison the registered rule blessed on the OLD run:** `bob11408` vs `bob4960`, references **0.44%
apart**. **2.30× the strands, 2.23× the cost.** Every other pair has references 13–29% apart and is
refused, so **no parity call is made** and §2's "parity with today's cards" clause remains
unevaluated.

⚠️ Superseded: the cards figure has now been 2.03, then 1.46–1.71, then −3.974, then +0.461, then
withdrawn. **Everything before R34 came through the cross-page channel item 1 retires.**

### What replaced what

- `captures/hair-r31-ladder-ours/tools/frame-budget.mjs` is superseded as the primitive-decision
  instrument. It is kept: it diagnosed the mixture, and its per-mode table is the instrument that
  found it.
- §18's open item 1 ("report per clock mode, then burst-and-divide") is **closed and superseded**.
  Per-mode reporting was tried and is not enough — conditioning on a state entangled with the
  workload is item 2 above. The interleaved single-page design it asked for is what `frame-cost.mjs`
  now is.

### The open list, unchanged in order, with item 1 rewritten

1. **A v3 registration, if the owner wants one** — §8 of the findings doc lists exactly four
   changes. Do not write it as a third amendment; v1 was amended twice and closed void, and that is
   the pattern pre-registration exists to prevent.
2. **The fibre and the per-channel `T_f`** — still the only surviving route to "muddy", still a
   material change, `ā_f` derived and bounded ≤ 0.131.
3. **`rim.irradiance` per preset** — art-constant look-dev, defined by REQ-063's rejection.
4. `crop01`'s scalp clearance.
5. The 4,960-vs-11,408 bob density fork — **the cost side is now measured** (2.23× for 2.30× the
   strands, comparable references). What remains is the silhouette judgement.
6. **Declare the round.** The fence is past a ceiling of 14 by a wide margin; measure it at HEAD
   rather than quoting §18.
