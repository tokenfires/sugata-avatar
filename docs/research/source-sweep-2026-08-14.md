# Five supplied sources, read 2026-08-14 — and what they do NOT contain

The owner supplied five links the day the frostbitten control landed. Five agents read one each,
then a sixth adjudicated their claims against the primary artefacts rather than against the reports.
This file is the durable result. **The eliminations here are worth as much as the acquisitions** —
see §5, which says where to stop looking.

Sources: [MACH](https://human3daigc.github.io/MACH/) ·
[awesome-webgpu](https://github.com/mikbry/awesome-webgpu) ·
[webgpu-samples](https://webgpu.github.io/webgpu-samples/) ·
[webgpu.com](https://www.webgpu.com) · [gpuweb](https://github.com/gpuweb/gpuweb)

---

## 1. 🚩 Licence findings, first, because one of these would have cost real time

**Perm (`c-he/perm`) — code MIT, WEIGHTS UNUSABLE.** Offered in one report as the licensed
hierarchical hair representation. The code is genuinely MIT. The released `.pkl` checkpoints are
trained on **Hair20k, an augmentation of USC-HairSalon**, whose terms read *"internal,
non-commercial research, evaluation or testing purposes only"* and forbid sublicensing or
distribution. The fitted parameters for the original 343 hairstyles are directly derivative. The
README also says the Adobe-internal-data models need *"an individual release license"*.
**Perm's guide-strand + residual factorisation is the right idea to read for; anything that comes
out of the released checkpoints is encumbered.** Same shape as the Yuksel patent and the Fab EULA.

**Use.GPU is MIT+NMLA, not MIT.** `LICENSE.md` adds, verbatim: *"This Software may not be used as
source material to train machine learning systems of any kind."* Redistribution is permitted so it
is shippable — but that specific clause inside an AI-embodiment library deserves a deliberate
decision rather than a default.

**MACH releases nothing.** `Human3DAIGC/Make-A-Character` is **17 tree entries: `README.md` and
`assets/`**, `license: null`, 578 stars. The HuggingFace Space is ~40 lines of Gradio wrapping an
`<iframe>` to a private Alibaba endpoint. Papers are CC BY 4.0 — that licenses the PDFs. The output
chain is MetaHuman-derived and rendered in Unreal, so even released code would be Epic-EULA
encumbered. Upstream **NeuralHDHair** has `license: null` — code posted with no grant at all, which
is legally worse than a restrictive licence.

Verified clean: `momentchan/false-earth` MIT · `AmyangXYZ/reze-engine` MIT (default branch is
`master`, not `main` — the raw-URL 404 is a branch artefact) · `webgpu/webgpu-samples` BSD-3-Clause ·
`kainino0x/alpha-to-coverage-emulator` BSD-3-Clause. Refused: `Ludicon/spark.js` NOASSERTION, the
shaders are under a separate EULA · `toji/webgpu-clustered-shading` no licence.

---

## 2. The one acquisition: F2−F1 clump membership, and it is in our exact stack

`momentchan/false-earth`, `src/components/grass/core/grassCompute.ts`, `getClumpInfo` (lines
187–224). **MIT, three.js TSL, WebGPU compute, `instancedArray`** — the same stack we are already
in, which is why this beats everything else in the batch.

The mechanism: a 3×3 neighbour scan over hashed cell points tracking BOTH the nearest and the
second-nearest — `minD2`/`bestID` (F1) and `secondMinD2`/`secondBestID` (F2) — then

```
centerFactor = smoothstep(0.0, uClumpBlendSmoothness, d2 - d1)
blendFactor  = mix(0.5, 1.0, centerFactor)
height       = mix(p2.height, p1.height, blendFactor)
```

`centerFactor` is the F2−F1 edge distance: zero on a clump boundary, one at a clump core. It is the
scalar that tells a filament *how much it belongs to its lock*, and the lock-scale yaw terms are
gated by it. The `mix(p2, p1, blendFactor)` attribute blend is what stops clump boundaries reading
as tiling.

### ⚠️ What it is NOT, adjudicated

- **One level, not a hierarchy.** `getClumpInfo` is called exactly once at one cell size. The
  multi-scale version is a loop over cell sizes — cheap, because the cell size is already a closure
  variable — but it is unbuilt, and no source in this batch has built it.
- **Root-space membership only.** `centerFactor` derives from the blade's root on a flat XZ grid.
  For grass that is complete; a blade is one vertical instance. **A hair strand is a curve** — locks
  converge, twist and separate *along their length*, and tip separation is arguably the exact thing
  *"missing every intermediate level between one mass and individual filaments"* was naming. Root
  Voronoi gives constant lock membership per strand and says nothing 200 mm down it.

### 🎯 Split it, because the cheap half is the informative half

**Half A — lock-scale ALBEDO. An afternoon, and it runs on the cards we already have.**
false-earth packs `clumpSeed01` per instance, reads it as a varying, and multiplies base colour by
`mix(uClumpSeedRange.x, .y, vClumpSeed)` *separately from* its per-blade seed term. The judges'
complaint was *"per-pixel noise standing in for structure"* — a **frequency** complaint. Our
variation exists at filament scale and mass scale with **nothing at lock scale**. Adding one
lock-scale term is a hash, a varying and a multiply. It needs no strand pipeline and no geometry
work, and it is a clean control in this project's own idiom: if lock-scale *colour* alone moves the
judges, the complaint is about frequency content rather than silhouette, and the whole geometry plan
gets redirected. If it doesn't, an afternoon eliminated a hypothesis.

**Half B — geometry. 3–5 days, and blocked behind cards→strands.** The 3×3 scan retargeted from a
flat XZ grid to strand roots in scalp UV, feeding `centerFactor`-gated lock-scale yaw.

---

## 3. 🎯 The measurement that should run FIRST, and it is half a day

false-earth drives one AO scalar into `colorNode`, `roughnessNode` **and** `envNode`
(`pmremTexture(envMap).mul(ao)`). That is a diagnostic aimed straight at our worst judged defect.

**Our 1–3% skin darkening under a full curtain of hair is exactly what you get when the occlusion
term attenuates direct diffuse and leaves other light paths untouched — in which case no shadowing
algorithm, however correct, can make skin sit under hair, because the unattenuated floor dominates.**

We already have **one confirmed unattenuated term and it is not IBL**:
`LightingRig.js:424` sets `shadowFraction: 0.45`, so **55% of the key's irradiance sits in a
`RectAreaLight`, which in three cannot cast a shadow at all**, plus an ambient at
`ambientFractionOfKey` on top. That is a structural ceiling on what *any* occluder can do on this
rig, hair or garment, before a single card is considered.

⚠️ And the obvious hypothesis is already **refuted**: `alive.js:2297` sets `castShadow` and
`receiveShadow` on the groom, and `configureHairMaterial`'s `maskShadowNode` gets strand coverage
into the depth pass. This is not the R11 garment defect recurring.

**The experiment:** instrument the skin path under a hair curtain and split its contribution into
direct diffuse / direct specular / IBL / ambient / non-shadowing area light. Find which terms are
unattenuated, then sweep `shadowFraction` and measure forehead darkening under the fringe with
hair-off as the control. It either explains the judges' highest-ranked failure with a plumbing fix,
or it rules that out and justifies the expensive light-view transmittance structure. **Do not design
a deep shadow map before this runs.**

---

## 4. MACH is not what the page looks like — but its Phase 6 material is the best we have

**It is an offline, cloud-side character ASSET GENERATOR, not a renderer and not a runtime.** Text
or a single photo in, a rigged MetaHuman-skeleton character out in ~2 minutes. Hair is **matched
from a pre-authored library by CLIP similarity** (MACH 1) or **CNN classification into an asset
library** (MACH 2 §3.3). Rendering is Unreal's PBR. The only real-time claim is lip-sync inference,
with no FPS or latency figure anywhere.

🎯 **Gesture as a Viterbi path through a graph of animator-authored clips (MACH 2 §4.1)** — the best
Phase 6 material in the batch:

- ~100+ Vicon clips, each **2–3 seconds**, revised by two senior animators.
- Partitioned into **5 categories, one per body pose.** Within a category *every clip starts and
  ends in the same pose*, so any two concatenate seamlessly. Dedicated transition clips move between
  categories.
- Each clip is a graph node carrying a **wav2vec 2.0** audio embedding. Edge weight
  `T(Ni,Nj) = λ1·Tp + λ2·Tr` — translation loss plus per-joint rotation loss.
- Total cost `C = Σ Ca(Ai, Âi) + Σ T(i,i+1)`; the sequence is the **Viterbi** optimal path.

No training run, no learned body model, no physics; runtime is a Viterbi decode over ~100 nodes,
trivially inside frame budget in JS. **Their design leaves exactly the hook we need open** — they
score on audio only, so affect can bias the category choice and add a term to the node cost, which
plugs straight into the affect→body actuation loop that already works.

⚠️ **Deflate it honestly:** this is a Kovar-style motion graph with an audio-embedding cost term
added — a 24-year-old technique. That is a point in its *favour* (no research risk), and it should
not be recorded as a novel finding from this source. The quality ceiling is set by the clips, which
is a content problem we can phase rather than a research problem.

Also worth taking: **regress rig CONTROL COEFFICIENTS, not vertex offsets**, from a
**non-autoregressive** decoder called once, with a velocity loss (`‖(b_t − b_{t−1}) −
(b̂_t − b̂_{t−1})‖²`, from SelfTalk) whose only job is killing lip jitter. Their rationale is ours:
vertex-displacement methods *"lack components like teeth, tongue, and eyelashes"*. And: **authored
template animations for interjections**, fired on top of the regression when an emotive interjection
is detected. Cheap, high payoff for emotional range, costs one lookup table.

---

## 5. 🚩 What five sources do NOT contain — stop looking here

**Warm-tinted multiple scattering — a unanimous zero across all five.** Not one source contains a
hair BSDF. No Marschner, no Chiang, no d'Eon, no Zinke dual scattering, no anisotropic specular of
any kind. `webgpu-samples`' `deferredRendering` does Lambert × falloff² plus a literal
`result += vec3(0.2)` "manual ambient"; `shadowMapping` uses `const albedo = vec3f(0.9)`.

⚠️ **The near-miss that will tempt someone:** reze-engine uses **Fdez-Agüera 2019** multi-scatter
compensation, better-founded than Karis' slide-39 `sqrt(albedo)` fake. **It will not help.** It is a
surface-BRDF *energy* correction across a rough microfacet lobe; it has no mechanism to tint a
secondary highlight toward the hue of light transmitted through melanin. Swapping it in is
defensible housekeeping that moves this judgement by zero.

**This blocker needs hair-fibre shading literature — Chiang et al. 2016, d'Eon 2011, Zinke dual
scattering, Frostbite's own strand-shading talk — plus offline path-traced ground truth to fit
against.** Five sources, five zeros, is a strong enough signal to stop reading platform sources.

**Hair-to-skin shadowing — absent as a solution.** Nobody in the batch computes hair→skin
transmittance. MACH never mentions shadowing, transmittance or AO once in either paper. reze's
related feature is the *opposite* — a stencil-gated pass that deliberately blends hair to 25% over
the eyes to defeat occlusion for NPR legibility. What exists is §3's diagnostic and the a-buffer
data structure, which is heavier than our requirement (see §6).

**Lock hierarchy — corroborating evidence that this is hard.** NeuralHDHair grows strands from a
single 3D orientation field, which is structurally *exactly* the *"one flow field, one scale, no
hierarchy"* the judges named — and by MACH 2 Alibaba **abandoned reconstruction and switched to
classifying into an artist-authored library.** That is a third independent production system routing
around this problem by hiring a groom artist.

**TAAU thin-feature technique — nothing.** Fifty WebGPU samples and there is no TAA sample at all:
no jitter sequence, no history reprojection, no neighbourhood clamp, no motion vectors.

**A judging-brief rewrite — nothing, across all five.** No evaluation methodology anywhere. Given
that all six judges including the three shown the Frostbite reference said "not same-tier", this is
the open problem nobody in this batch touches, and it gates whether any of the above can be scored.

**Phase 7 — no prior art, only patterns.** Twenty-eight libraries on awesome-webgpu and **not one is
an embeddable runtime in our sense**; every candidate either owns the canvas and the frame loop or
is a horizontal utility. `reze-engine` is the closest existing shape — MIT, zero runtime deps,
consumes user-supplied `.pmx`/`.vmd`, bundles no assets — and is worth reading for its
materials-as-JSON / `renderClass` split and its capability-by-pragma design.

---

## 6. Two technical overreaches caught before they cost build time

**`textureBarrier()` cannot accumulate transmittance across a rasterised pass.** Read-write storage
textures ARE core (`r32uint`/`r32sint`/`r32float`) and `texture-formats-tier2` DOES extend them to
`rgba16float`/`rgba32float` — both verified in `webgpu.bs`. But `wgsl/index.bs` §Synchronization
Built-in Functions states: *"All synchronization functions use the `Workgroup` memory scope… must
only be used in the compute shader stage."* It synchronises one workgroup inside one compute
dispatch. There are no texture atomics. **Read-write storage textures kill a ping-pong when each
texel is owned by exactly one invocation; multi-strand accumulation is not that shape.** Use 32-bit
atomics into a storage buffer — core WGSL, always available.

**`primitive_index` is a per-draw ordinal, not a reprojection key.** Shipped and real —
`"primitive-index"` is in the `GPUFeatureName` enum, the WGSL builtin is at `wgsl/index.bs:10102`,
Chrome shipped it in 142. But the spec defines it as *"the number of primitives processed for the
current instance since the beginning of the current draw operation… Resets to 0 between each
instance."* It is only a valid TAA key if draw order, instance order and primitive count are
bit-identical between frames. Worse, **the two recommendations in this batch are mutually hostile**:
false-earth's LOD routing uses `atomicAdd` compaction into per-LOD index buffers, which is
non-deterministic in ordering. Adopt both and the ID changes every frame. **A stable strand ID has
to come from our own data.**

**Also caught, and it is a Phase 7 design-time decision:** compat mode sets
`maxStorageBuffersInVertexStage` to **0** (spec limits table line 1756, default 8).
**Vertex-pulling strand data — how every modern strand renderer works — is unavailable on compat
devices.** `maxStorageBuffersInFragmentStage` is 8→4, and `maxColorAttachments` drops 8→4, which
competes with the deferred G-buffer. Either we build a second non-vertex-pulling path or we write an
explicit "strands require a core device" contract. ⚠️ And note `maxStorageBufferBindingSize` is
**134217728** at spec line 1811 — the *rendered* spec page shows 4294967295, a 32× error on the exact
number a strand-buffer budget would be built from.

**The a-buffer is over-engineered for our case.** `webgpu-samples/sample/a-buffer` (BSD-3) is a real
per-pixel linked-list OIT — atomic head pointers, a bump-allocated
`LinkedListElement{color, depth, next}` pool, opaque-depth pre-rejection, and memory bounded by
rendering in horizontal screen slices (`sliceInfo.sliceStartY`). Two independent readers flagged
that **its composite blend never accumulates alpha past layer 0 — do not reuse the resolve.** But
hair→skin occlusion needs **one transmittance scalar per skin pixel**, and skin is opaque. An
opacity shadow map or a small fixed-slice transmittance stack from the light is O(1) memory, no
atomics, no sort. Adopt the a-buffer only if we also want correct hair-through-hair transparency.
