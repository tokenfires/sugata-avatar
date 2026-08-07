# Rendering stack — verified research

Researched 2026-08-06. three.js claims checked against tagged source at **r185**
(released 2026-07-01, npm `three@0.185.1`), not against docs or blogs. Library maintenance
from npm publish dates and the GitHub API. Unverified items flagged at the end.

---

## The architectural verdict: WebGPU-first with TSL

**Decision: author against `WebGPURenderer` + TSL. WebGL2 is a degraded fallback tier, not
a co-equal backend.**

Forced by three findings, not a preference:

1. Every AAA-defining effect — TAA with motion vectors, SSGI, SSR + denoise, motion blur,
   temporal upscaling — exists **only** in the TSL/WebGPU path. The WebGL post stack in
   three.js is frozen, and pmndrs `postprocessing` has **zero WebGPU code** (confirmed by
   enumerating all 195 `.ts` files on its v7 branch and grepping, not by reading docs).
2. `VelocityNode` exports `velocity` for WebGPU only. **No velocity buffer means no TAA, no
   motion blur, no temporal upscaling.** Structural, not incidental.
3. `WebGPURenderer` **auto-falls back to a WebGL2 backend**, and TSL compiles to both WGSL
   and GLSL. You write the shader once. There is no cost to choosing WebGPU as the authoring
   target.

`WebGPURenderer`'s class doc calls it simply "the new alternative of `WebGLRenderer`" — no
experimental warning. It is production-ready.

### Browser reality (from the gpuweb Implementation-Status wiki, not caniuse)

| Browser | WebGPU |
|---|---|
| Chrome/Edge | macOS/Windows since 113 |
| Safari | **26** (macOS Tahoe 26, iOS/iPadOS 26), on by default |
| Firefox | Windows 141+; macOS Apple Silicon 145+, all macOS 147+; **Linux Nightly only** |

🚩 **Firefox is disqualified for the WebGPU path on performance, not availability.**
[Dispatch overhead measurements](https://arxiv.org/html/2604.02344v1) (arXiv, Feb 2026):
Safari/Metal/M2 **31.7 µs**, Chrome/D3D12 **58.7 µs**, **Firefox ≈ 1040 µs**. At ~15 passes
per frame that is ~0.5 ms on Safari/M2 versus **~15 ms on Firefox**. Serve Firefox the
WebGL2 tier.

🚩 **API rename:** `PostProcessing` → **`RenderPipeline`** as of **r183**. The old name is a
deprecated subclass emitting `warnOnce`. Write new code against `RenderPipeline`.

---

## 1. Skin — 100% custom work

### 🚩 Two unrelated things are named "SSS" in three.js

| Symbol | What it actually is |
|---|---|
| `MeshSSSNodeMaterial` | **Subsurface scattering** — but only a back-lit translucency hack |
| `addons/tsl/display/SSSNode.js` | **Screen-Space *Shadows*** — nothing to do with scattering |

`MeshSSSNodeMaterial` is source-verified as
[Barré-Brisebois' GDC 2011 "Approximating Translucency"](https://colinbarrebrisebois.com/2011/03/07/gdc-2011-approximating-translucency-for-a-fast-cheap-and-convincing-subsurface-scattering-look/) —
its own class comment says so and calls itself "an experimental extension." The whole
scattering term is a wrap-lighting transmission driven by a thickness map. It gives glowing
ears and nostrils. It gives **nothing at the light terminator** — no red bleed, no softened
shadow edge, no diffusion profile. Those are the cues that read as skin.
**It is not a skin shader and must not be treated as one.**

`MeshPhysicalMaterial` has no subsurface property. `transmission` is the wrong tool — it
samples `viewportMipTexture()` to refract *the scene behind the object*. For skin that is
both wrong and expensive.

**No maintained three.js implementation of pre-integrated or separable SSS exists.** The one
community reference (forum "Skin Shader (WIP)", March 2022) is self-described as
"artistic wise without some fancy paper physical correct formular," has no
curvature/dual-lobe/detail-normal work, and was abandoned.

### Technique choice

Per [MJP's taxonomy](https://therealmjp.github.io/posts/sss-intro/):

| Technique | Verdict |
|---|---|
| Texture-space diffusion | **Reject.** UV seams, profile warping from UV stretch, awkward integration. |
| **Pre-integrated (Penner)** | **Start here.** Zero gather passes — one pixel shader, one LUT. Shipped in *The Order: 1886*, *Lone Echo*. Weak at shadow penumbrae. |
| **Separable screen-space (Jimenez)** | **Upgrade path.** Correct diffusion profile, needs an SSS mask channel + denoise/TAA. |

**Plan: pre-integrated first, separable as an optional quality tier.** Pre-integrated is a
single-material change with no pipeline surgery, so it de-risks everything. Separable needs
the MRT G-buffer settled first. Revisit if terminator quality proves insufficient on hero
close-ups — pre-integrated's weakness is exactly the shadow-penumbra region, which is where
a portrait camera lives.

**Extension point is verified:** `MeshPhysicalNodeMaterial.setupLightingModel()` returns a
`PhysicalLightingModel` subclass with overridable `start`, `direct`, `directRectArea`,
`indirectDiffuse`, `indirectSpecular`, `ambientOcclusion`, `finish`. Override `direct()` to
replace `BRDF_Lambert` with the curvature-indexed LUT lookup and add the second specular
lobe. Everything needed is exposed in TSL: `Fn()`, `texture()`, `dFdx`/`dFdy`, `normalView`,
`positionViewDirection`, `refract`.

**Curvature:** Penner computes it at runtime as
`length(dFdx(normalWorld)) / length(dFdx(positionWorld))`. On a **skinned, morphing** face
this is noisy and produces quad-derivative artifacts. Production practice is a **baked
curvature map** blended with the runtime term. **Budget for baking it.**

**MRT plumbing is better than expected:** `MRTNode` supports named outputs with per-output
blend modes and `merge()`, and **`NodeMaterial.mrtNode` lets the skin material alone** write
an extra `sssMask`/`profileId` channel that merges with the pass-level MRT. Other materials
write nothing. Exactly the right primitive for separable SSSS later.

### Best porting reference

**[Unity-Technologies/com.unity.demoteam.digital-human](https://github.com/Unity-Technologies/com.unity.demoteam.digital-human)**
— **MIT**, 567 stars. Ships full shader graphs for skin/eyes/teeth/hair as seen in *The
Heretic*, plus **skin tension driving wrinkle maps**, GPU skin deformation, and a custom pass
doing cross-material normal-buffer blur (**tearline**) and eyelid blurring.
**The highest-quality openly-licensed digital-human shader set in existence.** Port from here.

Other verified primary sources: [Penner, Pre-Integrated Skin Shading, SIGGRAPH 2011](https://advances.realtimerendering.com/s2011/index.html);
[Jimenez et al., Next-Generation Character Rendering, **GDC** 2013](http://www.iryoku.com/next-generation-life)
(note: GDC, not SIGGRAPH — Jimenez is not in the SIGGRAPH 2013 Advances index; hit 93/74 fps
at 720p/1080p on a **GTX 560 Ti**, which tells you the technique set is not the bottleneck);
[iryoku/separable-sss](https://github.com/iryoku/separable-sss) (BSD-2).

Micro-normal is a **tiled 256×256 secondary normal** at high repeat, distance-faded.
Blood-flow variation bakes into the SSS *color* map rather than a separate channel.
Wrinkle/tension maps are expression-driven normals blended by rig pose.

---

## 2. Hair — the largest engineering block

### three.js has none

Verified by enumerating all 600 files in `examples/`: **no hair or fur example.** Also **no
Alembic loader** anywhere, and `USDComposer` handles only `Mesh` + primitives — **no
`BasisCurves`**, so USD grooms cannot be imported. Pivot format is **TressFX `.tfx`**.
[GPUOpen-Effects/TressFX](https://github.com/GPUOpen-Effects/TressFX) is MIT but **last
pushed 2023-01-26 — upstream unmaintained**; format and compute algorithms remain the reference.

**Hidden asset: three.js already ships the correct strand primitive, unlabelled.**
`LineSegmentsGeometry` extends `InstancedBufferGeometry` with an
`InstancedInterleavedBuffer(lineSegments, 6, 1)` giving `instanceStart`/`instanceEnd` —
**one instance per hair segment, camera-facing quad expansion in the vertex shader**, exactly
the strand rasterizer topology. `LineMaterial` already has `worldUnits` and
`USE_ALPHA_TO_COVERAGE`. **Forking these is far shorter than starting from scratch.**

### Reference implementation

**[Scthe/frostbitten-hair-webgpu](https://github.com/Scthe/frostbitten-hair-webgpu)** —
TypeScript + WebGPU, [live demo](https://scthe.github.io/frostbitten-hair-webgpu/),
[write-up](https://www.sctheblog.com/blog/hair-software-rasterize/). Reimplements EA's
*Every Strand Counts: Physics and Rendering Behind Frostbite's Hair*. GPU verlet physics with
SDF collision, software-rasterized quads with analytical AA, tile-binned OIT with depth bins,
Kajiya-Kay diffuse + Marschner specular + UE5-style fake multiple scattering, PCF/PCSS
shadows, GTAO. **The closest thing to PS5-tier strand hair in a browser that exists.**

Non-obvious: a software rasterizer can't write usable depth/normals, so Scthe **re-renders
hair with the hardware rasterizer** for depth/normals/shadows and software-rasterizes only
color. **Two rasterization paths for the same geometry.**

### Shading model — implement Karis, not Kajiya-Kay

[Karis, Physically Based Hair Shading in Unreal, SIGGRAPH 2016](https://blog.selfshadow.com/publications/s2016-shading-course/karis/s2016_pbs_epic_hair.pdf).
Marschner's `M_p × N_p` split per R/TT/TRT lobe, with every expensive part replaced:
M → Gaussian; N_R → trig identity removes all inverse trig; N_TT → Pixar's approximation
"too expensive for too little improvement," logistic approximated by a Gaussian; N_TRT →
"we have to be brutal," root-finding for glints dropped entirely.

Multiple scattering is the *Agni's Philosophy* fake-normal trick — synthesized normal +
wrapped Lambert + absorption from path length through the hair volume, **derived from an
exponential shadow value**. Karis: "a giant artistic hack and not physically based in the
slightest… derived by looking at photos," and he calls it "the biggest opportunity for others
to improve this model." Consequence: **shadow maps must use PCF with exponential falloff
rather than a hard comparison** — that exponential value feeds the absorption term. Load-bearing.

| Model | Verdict |
|---|---|
| Kajiya-Kay | Diffuse only. Insufficient — TRT/TT separation from cuticle tilt is what reads as hair. |
| Marschner (full) | Offline only. Root-finding is not shippable in a fragment shader. |
| **Karis/Epic** | **Implement this.** Closed-form, no root-finding, no inverse trig. |

### OIT — WebGL2 cannot do it properly

WebGL2 is OpenGL ES 3.0. **No compute shaders, no SSBOs, no image load/store** — those need
ES 3.1. **Per-pixel linked lists are impossible in WebGL2** (PPLL needs an atomic counter plus
`imageStore` into an unbounded buffer).

Ranked for WebGL2:
1. **Weighted-blended OIT** — the answer. MRT is real (`RenderTarget` takes `options.count`).
   Caveat: the weighting heuristic must be tuned to your depth range, and hair's 10–50
   overlapping low-alpha fragments per pixel is exactly the regime where a bad weight goes milky.
   ⚠️ `stevinz/three-wboit` is **stale** (2023, WebGL1-compatible so it doesn't even use MRT) —
   code reference, not a dependency.
2. **Alpha-to-coverage + MSAA** — `Material.alphaToCoverage` is honored by the WebGPU backend
   too. Ceiling: 4× MSAA = 4 opacity levels, visibly quantized on thin dark strands. Mid-LOD only.
3. Depth peeling — a geometry pass per layer. Non-starter at 8+ layers.
4. Stochastic + TAA — viable but commits you to solid TAA, which WebGL lacks.

🚩 three.js will not solve this: issue
[#9977 "Order Independent Transparency"](https://github.com/mrdoob/three.js/issues/9977) has
been **open since 2016**. #7345 (WBOIT for hair specifically) was closed as "use the forum."

🚩 **WGSL constraint to design around:** WGSL §6.2.8 — `atomic<T>` requires T be `u32` or
`i32`. **There are no 64-bit atomics in WGSL**, so the standard packed-depth+payload
visibility buffer via `atomicMin` on a u64 is unavailable. Budget for a workaround.

Scthe's tuned constants: `tileSize 8`, `tileDepthBins 32`, `avgSegmentsPerTile 128`,
`fiberRadius 0.0006`.

### Performance anchors (measured elsewhere, extrapolated to us)

| Source | Config | Result |
|---|---|---|
| Huang et al. 2025, RTX 3090, 1024² | full strands, 1050K segments, 50% coverage | 10.2 ms |
| same | LoD near/mid/far | 10.3 / 2.8 / 0.4 ms |
| same | **hair cards** near/mid/far | **4.1 / 1.6 / 1.3 ms** |
| Scthe, RTX 3060, WebGPU/Chrome | Sintel groom | `HairFinePass` 30 → 10 → 3.3 ms after rewrite |

**Planning hypothesis:** on an M-series Max in Chrome/Safari 26, a 16.6 ms budget supports
roughly **20–40K rendered strands at LOD0** for one hero head at 1080p-equivalent, hair taking
4–7 ms. True follicle count (100–150K) is **not achievable in-browser at 60 fps**.
⚠️ Extrapolated from desktop GPUs — **no browser-specific M-series hair benchmark exists.**

**Plan: cards as the shipping default, strands as a WebGPU-only LOD0.** Cards are ~2.5×
faster even on an RTX 3090 at 1 MP; browser + M-series + DPR 2 widens that. The Karis BSDF is
shared between both paths — write it once in TSL.

📌 **20-minute experiment that replaces every estimate here:** open the frostbitten-hair demo
on this Mac in Chrome and Safari 26, use its built-in Profile button (browser vsync makes
wall-clock fps meaningless), sweep the strand-count slider. **Do this in Phase 0.**

---

## 3. Eyes — best effort-to-impact ratio in the project

three.js has nothing, but `refract()` is a TSL builtin and the technique is ~40 lines.
Full detail in [`eyes-and-lighting.md`](eyes-and-lighting.md). HDRP quality tiers map onto our
LOD plan: **Eye** (cheap caustic approximation) / **Eye Cinematic** (refraction, used in
*The Heretic*) / **Eye Cinematic With Caustic** (used in *Enemies*, the current real-time benchmark).

HDRP `Eye IOR` default is **1.4** (vs 1.333 in `EyeUtils.hlsl` and 1.336 in Unreal — pick per
look, they bracket the physical value).

`com.unity.demoteam.digital-human` (MIT) additionally ships **marker-driven eye occlusion**,
a **cross-material normal-buffer blur explicitly labelled "tearline,"** and **eyelid blurring**.
Those are the details nobody implements and everybody notices missing. They are screen-space
normal-buffer ops, so they port cleanly to a TSL post pass reading our MRT normal channel.

---

## 4. Post-processing — ecosystem status (npm + GitHub API)

| Package | Latest | Published | Verdict |
|---|---|---|---|
| `three` | 0.185.1 | 2026-07-01 | Very active |
| `postprocessing` (pmndrs) | 6.39.4 / v7 beta | 2026-07-27 | Active, **WebGL-only** |
| `n8ao` | 2.0.0 | 2026-07-12 | Active, **WebGL-only** (the "WebGPU in 2.0" note did not happen) |
| `three-mesh-bvh` | 0.9.14 | 2026-08-01 | Very active, **has a WebGPU compute API** |
| `three.quarks` | 0.17.1 | 2026-05-21 | Active; **WebGPU unchecked on roadmap** |
| `three-gpu-pathtracer` | 0.0.24 | 2026-02-21 | Active, WebGL2-only |
| `realism-effects` | 1.1.2 | **2023-05-12** | 🚩 **ABANDONED** |
| `screen-space-reflections` (0beqz) | — | — | 🚩 **ARCHIVED** |

🚩 **Do not build on `realism-effects` or `0beqz/screen-space-reflections`.** The advertised
v2 never shipped. `0beqz/ssgi` does not exist.

### `three/addons/tsl/display/` — 44 modules, the real AAA stack

Verified highlights:

- 🚩 **WebGL `TAARenderPass` is not TAA.** Its own header: "this effect uses no reprojection
  so it is no TRAA implementation." It converges only on a static scene — **useless for an
  animated avatar.** The real one is **`TRAANode`** `(beauty, depth, velocity, camera)`. MSAA must be off.
- **`SSGINode`** — a genuine **SSILVB** (screen-space indirect lighting with visibility bitmask)
  implementation. High preset: `sliceCount 3` × `stepCount 16`.
- **`GTAONode`** — real Activision GTAO with the 6-entry temporal rotation table. By contrast
  the WebGL `GTAOPass` renders **a separate full normal prepass with `MeshNormalMaterial`** —
  an extra full draw of all geometry, costly on a dense head.
- **`SSSNode`** (screen-space shadows) — documented limits: **single directional light only**,
  max shadow length ≲ 1 m, "shadows might have too hard edges" so blur before compositing.
  For a face this is genuinely valuable — nose, lip and eyelid contact shadows are a AAA tell.
- **`SharpenNode`** — real AMD RCAS.
- **Upscaling, better than expected.** `FSR1Node` is a full FSR1 port. **`TAAUNode`** is the
  better fit: temporal AA + upscale in one pass, jittered accumulation + motion-vector
  reprojection at reduced input resolution via `PassNode.setResolutionScale()`, resolved with
  a 9-tap Blackman-Harris filter. Explicitly positioned as "an alternative to FSR2/3."
  **No ML upscaler exists in-browser — TAAU is the ceiling.**
  🎯 **This is our single biggest lever for affording an expensive skin shader at 60 fps.**
- **Tonemapping** — all present at r185: `Linear, Reinhard, Cineon, ACESFilmic, Custom,
  **AgX**, **Neutral**` (Khronos PBR Neutral).
- **Missing:** lens distortion has no TSL equivalent (pmndrs has `LensDistortionEffect`).

### The canonical pipeline pattern — one geometry draw, no prepass

```js
const scenePass = pass( scene, camera );
scenePass.setMRT( mrt( {
    output, diffuseColor,
    normal: packNormalToRGB( normalView ),
    velocity
} ) );
scenePass.getTexture( 'normal' ).type = THREE.UnsignedByteType; // bandwidth
const giPass = ssgi( color, depth, normal, camera );
renderPipeline.outputNode = traa( composite, depth, velocity, camera );
```

Add `sssMask` as one more named MRT channel via `material.mrtNode` on the skin material only;
swap `traa` for `taau` + `setResolutionScale(0.66)`. That is the whole stack.

### Compute

`webgpu_compute_cloth.html` is a complete in-core **GPU verlet spring solver in TSL** —
`instancedArray()` storage buffers, two dispatches (springs, then vertices),
`renderer.compute()`. **Directly transferable to hair strand simulation** (springs = strand
segments) **and to our cloth requirement**. Note `.setPBO(true)` gives a WebGL2 fallback path,
so compute-style work degrades rather than dying.

---

## 5. Asset budget — the first hard wall

Uncompressed cost is `w × h × 4 × 1.333` with mips → **a single 4K map is ~90 MB in VRAM**.
A photoreal head needs albedo + base normal + micro-normal + roughness + cavity + curvature +
SSS mask + thickness. At 4K that is **~720 MB uncompressed, ~90–180 MB compressed**.

**Use KTX2: UASTC for normal/data maps** (ETC1S visibly degrades them), **ETC1S for albedo**,
transcoded at load. ([Don McCurdy's guide](https://www.donmccurdy.com/2024/02/11/web-texture-formats/))

**This, not shader cost, is the first hard wall on mobile Safari.**

---

## 6. Biggest gaps vs a PS5 AAA character, ranked by perceptual impact

1. **No subsurface scattering.** The single largest gap. Skin without diffusion reads as
   plastic or wax instantly, at any resolution, in any lighting. Fully custom work.
2. **No TAA on the WebGL path, and specular aliasing everywhere.** Two compounding problems.
   🚩 three.js's specular AA is source-verified as *geometric only* — `getGeometryRoughness()`
   takes derivatives of `normalViewGeometry`, **the interpolated vertex normal**, so
   **normal-map detail contributes nothing to roughness**. No Toksvig/LEAN normal-variance
   filtering exists. Micro-normal skin detail and hair strands **will shimmer violently**.
   Mitigation: WebGPU + `TRAANode`, plus rolling our own normal-map variance term.
3. **Hair.** Nothing in three.js, no OIT in core (open 10 years), largest single block.
4. **Eyes.** Nothing exists — but **best effort-to-impact ratio in the project**. ~40 lines of
   TSL transforms the read of a face. **Do this early.**
5. **Shadow quality.** No PCSS in the WebGPU path, no area-light shadows at all.
   Uniform-penumbra shadows are a strong "realtime engine" tell. Partially mitigable via
   `light.shadow.filterNode` (a supported per-light extension point) + `SSSNode`.
6. **Lighting sophistication and art direction** — likely the final 20%.
7. **Asset authoring throughput** — the real schedule risk. Curvature/cavity/thickness/
   micro-normal baking, groom authoring and export, wrinkle-map rigging are all bespoke
   pipeline work with no browser-native tooling.

**Strategic note: no photorealistic three.js human has shipped publicly.** Searching 2026
three.js/WebGPU showcases surfaces cyberpunk worlds and stylized characters — no photoreal
humans. Genuinely unexplored territory: both the risk and the opportunity.

Worth tracking as a parallel: **relightable 3D Gaussian-splat head avatars** are advancing
fast ([Disney RelightAnyone, May 2026](https://studios.disneyresearch.com/2026/05/31/relightanyone-a-generalized-relightable-3d-gaussian-head-model/)).
They reach photorealism from capture rather than shading, but don't yet animate or relight as
controllably as a rigged mesh. If the goal were *photoreal* rather than *art-directable*, that
is a different and possibly shorter road. **Not our goal** — we need the AI to author its own
identity, which requires control.

---

## Explicitly unverified

- **Stellar Blade's rendering techniques** — no primary technical source found in this pass;
  the baked-lightmap/SSR claim did not survive fetching its attributed article. (A dedicated
  art-direction research pass is running separately.)
- The three.js release in which AgX / Neutral tonemapping first landed (presence at r185 confirmed).
- **N8AO 2.0 changelog** — no tagged releases; "neural denoising" from a commit message.
- **pmndrs `postprocessing` v7 WebGPU plans** — absence of WebGPU *code* proven; no roadmap
  statement found either way.
- **Morph-target scaling** — `Morph.js` uses a `DataArrayTexture` (one layer per target)
  iterated in a `Loop`, so cost is O(vertices × targets) per frame. **Hard layer ceiling and
  52-shape ARKit rig cost not benchmarked — do this in Phase 0**, it directly affects our
  blendshape budget.
- **All M-series hair numbers** — extrapolated from desktop GPUs.
- **WebGL2's lack of SSBO/image-load-store** — verified via MDN (Khronos registry 403'd).
  Conclusion not in doubt.
