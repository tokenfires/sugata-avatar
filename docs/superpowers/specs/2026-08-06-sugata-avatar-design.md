# Sugata 姿 — design

**Status:** awaiting approval
**Date:** 2026-08-06

A browser-based real-time 3D avatar system that gives an AI agent a body. The agent
configures its own identity — male, female, or anywhere between — and the avatar embodies
what the agent says and how it says it, across the full range of human emotion, face and body.

Supporting research: [`rendering-stack.md`](../../research/rendering-stack.md),
[`character-assets.md`](../../research/character-assets.md),
[`eyes-and-lighting.md`](../../research/eyes-and-lighting.md),
[`lm-studio-integration.md`](../../research/lm-studio-integration.md).

---

## 1. What we are building, and what we are not

**Building:** an engine whose rendering and animation technique is genuinely AAA-tier, so the
quality ceiling is set by the character asset fed to it rather than by the renderer — plus an
affect and motion system that makes an AI's embodiment read as alive.

**Not building:** a replica of a specific commercial character. Stellar Blade's fidelity is
largely *art labor* — scan-derived texture stacks, artist-groomed hair, baked lighting. That
content cannot be authored from a terminal.

**Completion gate (agreed with the user):**
- **Rendering** — harsh blind critics place our renders in the same visual family as
  real-time AAA character work. Same tier, not "better than."
- **Emote** — a *decisive* win over Live2D/VTuber in blind comparison. This is winnable
  outright: Live2D is 2.5D mesh deformation with no true gaze, no real head rotation, no body
  IK, and no physics beyond hair springs.

---

## 2. Architectural decisions

### 2.1 WebGPU-first, WebGL2 as a degraded tier

Forced by evidence, not preference. Every AAA-defining effect — TAA with motion vectors,
SSGI, SSR, motion blur, temporal upscaling — exists **only** in three.js's TSL/WebGPU path.
`VelocityNode` is WebGPU-only, and no velocity buffer means no TAA at all. Meanwhile
`WebGPURenderer` auto-falls back to a WebGL2 backend and TSL compiles to both WGSL and GLSL,
so we author once and pay nothing for the choice.

Firefox is served the WebGL2 tier — not for availability but for performance: its WebGPU
dispatch overhead is ~1040 µs against Safari/M-series' 31.7 µs, which at ~15 passes/frame is
~15 ms of pure overhead. Disqualifying.

### 2.2 The character comes from MakeHuman/MPFB2 (CC0)

The only source satisfying all four requirements: permissive licensing, a continuous
male↔female axis, an AAA quality ceiling, and headless generation. Its gender macro is a true
continuous blend **defaulting to 0.5 — androgynous**. 14,766 all-quad faces, professional
topology.

Every alternative fails decisively: Ready Player Me shut down 2026-01-31; Character Creator 4
and Daz3D explicitly prohibit browser-delivered character generation in their EULAs; MetaHuman
cannot be redistributed openly and has no continuous gender axis; SMPL is non-commercial;
VRoid cannot reach realism because the anime proportions are in the mesh, not the shader.

**The property that makes this work:** MakeHuman targets are per-vertex deltas against a
*fixed base topology*, with vertex order invariant across every morph. So ARKit 52 is authored
**once** and remains valid for every character ever generated. Same for the UV layout and
every baked map. Two weaknesses — no stock blendshapes, weak stock skins — become one-time
asset-production costs instead of per-character problems.

### 2.3 Identity and expression are coupled, and the coupling has a clean answer

Blendshapes authored for a masculine skull do not land correctly on a feminine one. Fixed
topology keeps expression deltas *topologically* valid everywhere on the axis, but not
*anatomically* ideal at the extremes.

**Resolution: author ARKit 52 on the neutral base, which is already the androgynous midpoint —
the position that minimises worst-case error to both ends of the axis.** Add corrective shapes
at the extremes only if measurement shows error worth correcting. The identity default and the
optimal authoring position are the same point.

### 2.4 Affect is two-tier

LLM affect inference costs ~0.7 s — fine per-utterance, impossible per-frame.

- **Tier 1, reflex (< 1 ms).** Lexicon (NRC-VAD) + live prosody. Drives the face the instant
  sound starts. **Must stand alone and look right on its own, because Tier 2 is allowed to fail.**
- **Tier 2, appraisal (~0.7 s, async).** LM Studio. Returns a richer vector *blended into* the
  running state rather than snapped to, so the correction reads as settling, not popping.

This mirrors human affect — a fast automatic reaction, then a considered appraisal that colors
it. Tier 2 output is semantically validated (reject all-zero vectors, unknown emotions,
repetition collapse), not merely parsed.

### 2.5 PAD, not valence-arousal

Measured: sadness returns `V −0.8, A 0.3, D 0.2`; anger returns `V −0.8, A 0.7, D 0.6`. The
sharper case is anger vs. fear — same valence, same arousal, separable only by dominance, and
their body language is opposite (expand and advance vs. contract and retreat). **A 2D model
cannot drive posture.**

---

## 3. Structure

```
sugata/
├─ packages/
│  ├─ core/                    @sugata/core — the portable library
│  │  └─ src/
│  │     ├─ render/            Stage, PostChain, LightingRig, Grade
│  │     ├─ material/          SkinMaterial, EyeMaterial, HairMaterial,
│  │     │                     FabricMaterial, lut/
│  │     ├─ figure/            Figure, Identity, ExpressionBank
│  │     ├─ motion/            MotionStack, Gaze, Blink, Breath,
│  │     │                     Gesture, Posture, ik/
│  │     ├─ physics/           SpringBones, Cloth, SoftTissue
│  │     ├─ affect/            AffectState, ReflexAffect, AppraisalAffect,
│  │     │                     ExpressionMap
│  │     ├─ voice/             Speech, Visemes, Prosody
│  │     ├─ ear/               Mic, Backchannel
│  │     └─ Avatar.js          the public API
│  └─ testbed/                 demo app, LM Studio chat, critic harness
├─ tools/
│  ├─ figure-pipeline/         Blender: MPFB2 → ARKit 52 → bake → glTF/KTX2
│  ├─ lut-bake/                SSS and eye-caustic LUT bakers
│  └─ critic/                  headless capture + blind A/B harness
└─ docs/
```

Application-layer directories at the top so the architecture is implied by the tree;
domain-named files inside them. Three layers where there is state: the runtime API is decoupled
from motion and affect, which are decoupled from rendering.

**Offline vs. runtime is a hard boundary.** `tools/figure-pipeline` runs in Blender and emits
glTF + KTX2. The runtime never sees Blender, MakeHuman, or a `.mhm` file. That keeps the
shipped library small and lets the asset pipeline evolve independently.

---

## 4. The public API

The whole point of the library. An agent should need one call.

```js
const avatar = await Avatar.create({
  canvas,
  identity: { gender: 0.5, age: 0.35, build: 0.4, height: 0.5 },
  quality:  'auto',            // auto | cinematic | balanced | efficient
});

// The agent speaks. Affect inference, prosody, visemes, gesture,
// posture and gaze all follow from this one call.
await avatar.say("Oh — I actually didn't expect that to work.");

// Or drive affect directly, when the agent knows its own state.
avatar.feel({ valence: 0.8, arousal: 0.7, dominance: 0.6 });

// Listening: gaze, backchannel nods, listening posture.
avatar.listen(micStream);
```

`say()` is the entire required surface. An agent never has to know what a blendshape is.
`feel()` exists because an agent with its own affect model — Ember, for instance — should be
able to drive the body directly rather than having its state re-inferred from its own words.

`identity` is a continuous vector, not a preset enum. `gender: 0.5` is a real, renderable
body, not a fallback.

---

## 5. Rendering approach

**Pipeline** (one geometry draw, no prepass):

```
pass(scene, camera) with MRT { output, diffuseColor, normal, velocity, sssMask }
  → GTAO  → bent normal + specular occlusion  (hand-rolled; three.js has neither)
  → SSGI  (SSILVB)
  → SSR
  → TAAU  (temporal AA + upscale in one pass, resolutionScale ≈ 0.66)
  → bloom → DOF → grade (AgX) → film grain
```

`sssMask` rides as one extra named MRT channel written **only** by the skin material, via
`material.mrtNode`. Other materials write nothing.

**TAAU is the key lever.** Temporal upscaling from ~0.66 resolution is what buys us the budget
for an expensive skin shader at 60 fps. No ML upscaler exists in-browser; TAAU is the ceiling.

**Materials.** Skin: pre-integrated (Penner) SSS with a *baked* curvature map — runtime
curvature from screen-space derivatives is too noisy on a skinned, morphing face — plus
dual-lobe specular and a tiled micro-normal. Separable SSSS is a later quality tier, deferred
until the MRT G-buffer is settled. Eyes: cornea refraction into a flat iris plane, shader-side
pupil dilation (an arousal readout, free), view-dependent limbal ring, baked caustic LUT, and
the dual-normal sclera/iris trick where specular snaps flat inside the iris. Hair: Karis's
closed-form BSDF, cards as the shipping default with strands as a WebGPU-only LOD0.

**Lighting.** 3–4 RectAreaLights (key/fill/rim/kicker — a classic portrait rig) for the soft
wrapped specular that is the single biggest AAA tell. They cast no shadows, so each pairs with
a co-located shadow-casting directional. Screen-space contact shadows on top for eyelid crease,
nostril and lip corner. Studio HDRI via PMREM at low intensity, rotatable independently of the
backdrop. A hand-placed per-eye catchlight, non-negotiable for portrait framing.

**Two known gaps we must hand-roll:** three.js has no bent normals and no specular occlusion
(un-occluded ambient specular is the commonest reason WebGL characters look like plastic), and
its specular anti-aliasing is geometric only — normal-map detail contributes nothing to
roughness, so micro-detail and hair will shimmer violently without a normal-variance term.

---

## 6. Phases

| # | Phase | Gate |
|---|---|---|
| 0 | Foundation — scaffold, asset pipeline, critic harness, **spikes** | MPFB2 headless proven; perf measured |
| 1 | Rendering — skin, eyes, hair, cloth, lighting, post | Blind critic: same tier |
| 2 | Body and identity — morph axes, ARKit 52 bank, rig | Gender axis renders correctly end to end |
| 3 | Motion — gaze, blink, breath, gesture, posture, IK | Reads as alive when silent |
| 4 | Physics — spring bones, cloth, soft tissue | 60 fps with secondary motion |
| 5 | Affect and speech — PAD, AU mapping, TTS, mic | Full emotional range legible |
| 6 | Runtime API and testbed | An agent embeds it in one call |
| 7 | Blind critic loops | Both gates met |

### Phase 0 spikes — run before any architecture depends on them

1. 🚩 **MPFB2 headless.** Does `blender --background --python` drive `HumanService`
   end-to-end? **Undocumented, and the highest-risk assumption in the plan.** Some Blender
   addons need GUI context. Everything rests on this.
2. **Morph-target cost.** three.js iterates a `DataArrayTexture` layer per target — cost is
   O(vertices × targets) per frame. Benchmark a 52-shape rig on the 14.7k-face base.
   Directly sets our blendshape budget.
3. **Hair performance.** Open the frostbitten-hair WebGPU demo on this Mac, use its built-in
   profiler, sweep the strand slider. Twenty minutes, and it replaces every extrapolated
   estimate with a measurement.
4. **RectAreaLight cost.** Where does the portrait rig actually start costing us?

---

## 7. Risks

| Risk | Mitigation |
|---|---|
| MPFB2 cannot run headless | Spike first. Fallback: scripted GUI Blender, or pre-generate a morph-target set offline and ship deltas. |
| Texture quality is the real ceiling | Accepted and stated up front. Lee Perry-Smith CC BY maps for detail; budget one-time artist effort. |
| Specular shimmer on micro-detail | Hand-rolled normal-variance roughness + TRAA. Verify early with a moving camera, not a still. |
| Hair is the largest single block | Cards first, strands as LOD0. Karis BSDF shared between both paths. |
| Asset budget (~90 MB VRAM per 4K map) | KTX2, UASTC for data maps, ETC1S for albedo. First hard wall on mobile. |
| Critic loop never terminates | Gate is "same tier," not "better." Technique checklist as the objective backstop. |

---

## 8. Open items

Two research passes were still running when this was drafted — conversational emotion and
animation state of the art, and a Stellar Blade art-direction decomposition into implementable
render parameters. They inform Phases 1, 3 and 5 but do not change the architecture above.
Fold in on arrival.

Undecided, deferred to the phase that needs it: TTS engine choice (needs viseme or timing
event support); whether corrective shapes at the gender extremes are necessary; whether to
ship separable SSSS as a quality tier.
