# Checkpoint — 2026-08-13, the hair phase paused

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

## 4. ⏭️ The next move, decided but not yet run

**One hour, no code, and it can falsify everything above.**

Capture the hosted frostbitten demo at our portrait framing and capture resolution — **with its
purple neutralised to a plausible dark brown and its cyan background removed** — and put it blind in
front of the same critics with the same prompt used for eight rounds.

- They call it hair → the judges are calibrated, the defect is ours, and the strand direction is
  worth costing out. Then run the second control: export our own Blender groom curves as `.tfx`
  (`scripts/tfx_exporter.py`, MIT, 238 lines, needs 4–64 points per strand, power of two) and render
  OUR groom in THEIR renderer. That separates "our groom's shape is wrong" from "our card/alpha/
  dither path is wrong" — the experiment no round has ever run.
- They reach for *"flat sheets," "veil," "dither confetti"* about a renderer with no cards, no alpha
  texture, no dither and no TAA → **all three suspects are dead**, and the fault is in the judging
  loop, the capture path, the lighting rig or the colour. That would explain eight rounds of real
  findings and no progress better than any structural theory.

Neither outcome needs a decision about strands versus cards first.

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
