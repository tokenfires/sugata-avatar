# Eyes and lighting — verified research

Researched 2026-08-06. Claims below were checked against live source or docs; anything
unverified is flagged inline. three.js baseline: **r185 (2026-07-01)**, `dev` is r186.

---

## Headline: there is no three.js prior art for photoreal eyes

Repeated GitHub and web searches found **no maintained three.js eye shader, no PBR eye
addon, nothing in three.js examples**. This is greenfield. We port from Unity HDRP, whose
implementation is open, readable, complete, and about 180 lines total.

`@pixiv/three-vrm` is alive (2086 stars, pushed 2026-08-06, MIT) but its eyes are two
stylized meshes under MToon, which explicitly "does not support realistic materials such
as glass." Useful for **rig and expression conventions** (`lookAt`, expression presets),
useless for photoreal shading.

---

## 1. Cornea refraction — the core trick

Source of truth: [`EyeUtils.hlsl`](https://github.com/Unity-Technologies/Graphics/blob/master/Packages/com.unity.render-pipelines.high-definition/Runtime/Material/Eye/EyeUtils.hlsl)

Five steps, portable to GLSL/TSL verbatim:

1. Work in **object space**. Eye mesh authored cornea-facing **+Z**, iris plane at
   `z = -irisPlaneOffset`, XY roughly in `[-0.5, 0.5]` — sclera UV is literally
   `positionOS.xy + 0.5`.
2. `refract(-V_os, N_cornea_os, 1.0 / IOR)`, IOR **1.333–1.336**.
3. Ray-plane intersect the flat iris plane: `t = -(pos.z + offset) / refractDir.z`.
4. Hit XY → iris UV: divide by iris radius (**0.22** in HDRP stock geometry), remap to `[0,1]`.
5. Out-of-bounds hits (ray hit the inside of the cornea) clamp to a solid color.

HDRP defaults: `IRIS_RADIUS 0.22`, `CORNEA_IOR 1.3333`, `IRIS_PLANE_OFFSET 0.02`.

Unreal's equivalent is the **Eye shading model** (Base Color, Specular, Roughness,
Opacity, **Iris Mask**, **Iris Distance**), with refraction done in the material graph:
IoR **1.336**, **Depth Scale 1.0–1.4**, plus a Mid Plane Displacement Map. Crucially the
eye mesh is **not a sphere** — "a distinct dome at the front to represent the cornea,
giving the eye an almost egg-like shape," with planar UV projection along the cornea axis.
Same geometry contract as HDRP.

Origin of the technique: Jimenez, GDC 2013 *Next Generation Character Rendering*
([slides](https://www.iryoku.com/downloads/Next-Generation-Character-Rendering-v6.pptx),
[video](https://archive.org/details/GDC2013Jimenez)).
⚠️ A snippet claims the eye-parallax content is slide 232 — unconfirmed, the 323 MB deck
was never opened.

## 2. Pupil dilation — shader, not blendshape

HDRP's `CirclePupilAnimation` does a **two-piece radial UV remap**: inside the pupil,
uniform scale; outside, compress/stretch the remaining annulus. The iris texture therefore
stretches correctly instead of a circle merely scaling. Cheap, correct, no blendshape.

This matters for us because **pupil dilation is an arousal readout** — it is one of the
cheapest and most legible autonomic signals we can drive from the affect state.

Unreal's equivalent: a single **Pupil Scale (0.5–1.0)**. MetaHuman exposes **Dilation** and
**Feather**.

## 3. Limbal ring

Two separate functions, iris-side and sclera-side, both **view-dependent** — the ring
tightens and fades edge-on via `NdotV`. HDRP params: Size Iris, Size Sclera, Fade, Intensity.

Unreal: **Limbus Dark Scale 2.0–2.15**, **Limbus Pow 15.0–22.0**, plus Limbus UV Width
Color / Shading. MetaHuman Creator: Limbal Ring Size / Softness / Color.

## 4. Iris caustics — bake a 3D LUT

HDRP does **not** fake this with a power function. It uses a pre-integrated **3D LUT**
indexed by iris-plane position rotated into the light's frame × cosine of light elevation
([`EyeCausticLUT.hlsl`](https://github.com/Unity-Technologies/Graphics/blob/master/Packages/com.unity.render-pipelines.high-definition/Runtime/Material/Eye/EyeCausticLUT.hlsl)).

The collapse to 3D works because the caustic is symmetric about the light azimuth and
otherwise depends only on light *elevation*. **We can bake this offline once** (small
cornea path-trace) and ship a 64×64×32 R16F 3D texture — trivial in WebGL2/WebGPU.

Constants: `causticLutThetaMin -0.5` (last slice 30° below horizon), `causticMirrorV true`,
`causticScleraMargin 0.15`.

Unreal instead exposes an analytic fake (**Iris Concavity Power / Scale**). Cheaper, less
accurate. Decision rule: static key light → analytic is fine; moving key → bake the LUT.

## 5. The dual-normal sclera/iris blend — highest-value detail after refraction

HDRP treats sclera and iris as **two separately-profiled SSS surfaces on one mesh**, blended
by a radial mask with a deliberately sharp `pow(x, 8)` falloff, and keeps **two different
normals**:

- **diffuse normal** — blends sclera↔iris normal maps
- **specular normal** — snaps to flat `+Z` inside the iris, *because the specular comes off
  the smooth cornea, not the bumpy iris*

Smoothness and diffusion profile are likewise blended per-property. Authoring requirement:
**sclera map with no iris information, iris map with no sclera information** — they are
blended per-property, not composited.

## 6. Eye occlusion, wetness, catchlight — the details people skip

- **Eye occlusion mesh** — a separate translucent sheet at the eyelid opening providing
  approximated AO. Epic: "wherever the eye comes in contact with other tissues such as the
  eyelid or the tear duct (caruncle), you will see very soft shadowing due to the fact that
  the eye itself is translucent." **Without this, eyes look pasted on.** Shadow Radius 0.5–0.85.
- **Lacrimal fluid geometry** — separate mesh for the wetness gathering under the lower lid.
  ⚠️ The "raise occlusion-mesh emissive to read as a wet tearline" trick is from an Epic
  forum thread, not official docs.
- **Secondary Environment catchlight** — Epic hand-places a *separate* cubemap reflection
  per eye (`SecondaryEnvBalance` 0.00–0.03, manual rotation axis) purely so closeups get a
  controllable catchlight independent of scene IBL. **Steal this.** For portrait framing an
  artist-rotatable per-eye catchlight is worth more than any amount of IBL accuracy.
- Sclera: **Brightness 0.9–1.3**, **Roughness 0.0–0.1**, vein/vascularity map, shared wet-surface
  normal (Normal UV Scale 1.8–2.6). MetaHuman: Vascularity Intensity / Coverage / Rotation,
  Transmission Spread / Color.

---

## 7. three.js lighting — what exists, verified

### IBL

`Scene.environment`, `environmentIntensity` (r163+), `environmentRotation` — and
`environmentRotation` is **independent of `backgroundRotation`**, so we can rotate
reflections without rotating the visible backdrop. Exactly what portrait work wants.

`PMREMGenerator` uses GGX VNDF importance sampling. Ideal equirect source **1024×512**.

🚩 **`RGBELoader` is deprecated since r180** — now a shim that warns and extends `HDRLoader`.
Use **`HDRLoader`**. `EXRLoader` and `UltraHDRLoader` also live.

WebGPU bonus: `tsl/display/ImportanceSampledEnvironment.js` does **multiple importance
sampling** (GGX + environment-luminance CDF, power heuristic). Noticeably better specular
from a high-DR studio HDRI than PMREM alone.

### Area lights — the honest picture

`RectAreaLight` gives the elongated wrapped softbox highlight that is **the single biggest
driver of the AAA portrait look**. But:

- ❌ **No shadow support.** Confirmed in docs and in `RectAreaLightNode.js` — no shadow code at all.
- ❌ PBR materials only (`MeshStandardMaterial` / `MeshPhysicalMaterial`).
- ⚠️ Needs manual init — WebGL: `RectAreaLightUniformsLib.init()`; WebGPU:
  `THREE.RectAreaLightNode.setLTC( RectAreaLightTexturesLib.init() )`.
- ⚠️ `updateType = RENDER` (depends on `viewMatrix`) → per-render-call uniform churn. Not free.

🚩 **Clustered lighting will not save us.** `ClusteredLightsNode.js` filters literally to
`light.isPointLight === true && light.castShadow !== true`. **Point lights only,
non-shadow-casting only.** r185's "Forward+ clustered shading" headline does not apply to
area lights.

three.js issue [#14161](https://github.com/mrdoob/three.js/issues/14161) "Add shadow map
support for RectAreaLights" — **still open since 2018**, no PR, no assignee.

**Practical budget: 3–4 RectAreaLights** = key + fill + rim + kicker, which is exactly a
classic portrait rig. The official `webgl_lights_rectarealight` example uses 3.
⚠️ Not benchmarked — reasoned from the example plus forum reports of slowdowns past ~6.

**Our approach to area-light shadows:** RectAreaLights for the *shading*, a co-located
DirectionalLight/SpotLight shadow map plus screen-space shadows for the *shadowing*. That
is the Heitz et al. ratio-estimator idea
([I3D 2018](https://dl.acm.org/doi/abs/10.1145/3190834.3190852)) in cheap form, and nobody
will spot the difference on a single character.

### Shadows — and a landmine

🚩 **`PCFSoftShadowMap` is deprecated as of r186.** `PCFShadowMap` was made soft in r182 and
is the recommended path. On the WebGPU/TSL side `PCFSoftShadowMap` is **already removed** —
`ShadowNode.js` has a literal `null` in its filter table where it used to be.

WebGPU/TSL shadow filters that exist: `BasicShadowFilter`, `PCFShadowFilter`,
`VSMShadowFilter`. **There is no PCSS node.** But `PCFShadowFilter` is respectable — 5
samples on a **Vogel disk** rotated per-pixel by Interleaved Gradient Noise on top of
hardware 4-tap PCF, which the source says "effectively provides 20 filtered taps with better
distribution." r185 moved it onto `textureGatherCompare`.

PCSS exists **WebGL-only, as a monkey-patch**: `examples/webgl_shadowmap_pcss.html`
overwrites `THREE.ShaderChunk.shadowmap_pars_fragment` with custom GLSL
(`findBlocker()` Poisson blocker search, `penumbraSize()`, 34-sample PCF) and requires
`BasicShadowMap`.

🚩 **The r182 landmine:** r182 replaced RGBA-packed shadow depth with **native depth
textures** and removed `unpackRGBAToDepth()`. **Every third-party PCSS predating r182
broke.** Confirmed case: drei
[#2583](https://github.com/pmndrs/drei/issues/2583) — fix is exactly
`unpackRGBAToDepth(texture2D(shadowMap, uv))` → `texture2D(shadowMap, uv).r`.
Assume any PCSS/soft-shadow snippet found online is broken until proven otherwise.

### 🚩 Naming trap: `SSSNode` is Screen-Space *Shadows*, not subsurface scattering

`examples/jsm/tsl/display/SSSNode.js` — "also known as Contact Shadows," ray-marches in
screen space toward the light. Params: `maxDistance 0.1`, `thickness 0.01`,
`shadowIntensity 1.0`, `quality 0.5`, `resolutionScale`, `useTemporalFiltering`.

From its own source comment: *"Use Shadow Maps for the foundation and Screen-Space Shadows
for the details."* **This is what gets the crease under the eyelid, the nostril, the lip
corner** — the micro-contact separating "3D model" from "photograph." Second-biggest tell
after area lights. **WebGPU/TSL only.**

### AO, bent normals, specular occlusion

- WebGL: `GTAOPass`, `SSAOPass`, `SAOPass`. WebGPU/TSL: `GTAONode`, `SSAONode`, `SSGINode`,
  `DenoiseNode`, `RecurrentDenoiseNode`, `depthAwareBlur`, `bilateralBlurNode`.
- **GTAO is the one** — horizon-based, yields a visibility cone rather than a scalar, which
  is the natural place to derive a bent normal.
- 🚩 **three.js has no bent normals, no capsule/proxy AO, no specular occlusion.**
  `aoMap` applies to indirect diffuse only. **Un-occluded ambient specular is the single most
  common reason WebGL characters look like plastic.** We hand-roll: derive bent normal from
  GTAO's horizon integral, sample PMREM with it for indirect diffuse, apply the Frostbite
  specular-occlusion term `saturate(pow(NdotV + AO, exp2(-16*roughness - 1)) - 1 + AO)` to
  indirect specular. Cleanest hook is a **TSL NodeMaterial override** — r185 added an
  `ambientOcclusion` property and an "override context system for advanced lighting control."
  ⚠️ Exact API surface unverified — read `LightingContextNode.js` first.
- ⚠️ **N8AO** ([repo](https://github.com/N8python/n8ao)) works with vanilla three.js, but
  maintenance status **could not be verified** (API rate-limited). Check `pushed_at` before depending on it.

### Light probes

`LightProbe` + `LightProbeGenerator` (`fromCubeTexture`, `fromCubeRenderTarget`, works with
both renderers). For a single portrait, PMREM `Scene.environment` already beats an SH probe.
Only worth it for a cheap secondary bounce we want to animate independently.

---

## 8. The AAA portrait stack, ranked by contribution

1. **Large soft key + fill + hard rim as area lights.** The elongated wrapped specular off a
   rectangular source is the #1 tell. 3–4 RectAreaLights.
2. **Screen-space contact shadows layered on a shadow map.** Shadow maps alone cannot resolve
   eyelid creases at portrait framing.
3. **Studio HDRI via PMREM at low `environmentIntensity` (0.2–0.5)**, with rotation as an art
   control — *plus* AO, bent normals, and specular occlusion so ambient doesn't flatten the face.
4. **Hand-placed per-eye catchlight.** Non-negotiable for portraits.
5. Tonemap + film grain + bokeh DoF.

**Calibration datapoint:** Digital Foundry's analysis says Stellar Blade is a **UE4** title
running **1440p/60 or 4K/30**, and calls out **film grain and bokeh DoF** as core to its look.
That is genuinely encouraging — our target does not require exotic tech.
<https://www.digitalfoundry.net/articles/digitalfoundry-2024-stellar-blade-tech-preview-what-can-we-learn-from-the-ps5-demo>

## 9. Current papers worth mining

SIGGRAPH 2025 *Advances in Real-Time Rendering* — <https://advances.realtimerendering.com/s2025/index.html>

- **Real-Time Subsurface Scattering via Hybrid ReSTIR-Path-Tracing and Diffusion** (Zhang,
  NVIDIA) — explicitly on lifelike digital humans, addresses nostrils and ears.
- **MegaLights: Stochastic Direct Lighting in UE5** (Narkowicz & Costa, Epic) — the current
  AAA answer to *shadowed* area lights.
- **Strand-Based Hair and Fur in Indiana Jones and the Great Circle.**
- **Stochastic Tile-Based Lighting in HypeHype** (Lempinen) — fixed-cost local lighting *with
  shadows* on low-end mobile GPUs; the most directly transferable perf model for a browser target.

---

## Architectural consequence: WebGPU/TSL is the primary path

Tally of what is **WebGPU/TSL only**: screen-space contact shadows (`SSSNode`), the GTAO/SSGI/
denoise node stack, importance-sampled environment, and the lighting-override hook we need for
bent normals and specular occlusion. Meanwhile the best WebGL soft-shadow option is a
deprecated monkey-patch that r182 broke.

**Decision: target `WebGPURenderer` + TSL as the primary path**, with WebGL2 as a
visually-degraded fallback rather than a co-equal target. Attempting parity would cost us the
four highest-impact techniques on the list.

## Flagged gaps

- Jimenez slide 232 reference — snippet only, deck not opened.
- Shadertoy `fsSyD3` (stegu, 2025) eye sketch — 403 to all tools, metadata only.
- N8AO maintenance status — unverified.
- RectAreaLight practical count — reasoned, not benchmarked. **Benchmark this in Phase 0.**
- TSL lighting override-context API surface — release-note level only.
- `gkjohnson/threejs-sandbox` PCSS post-r182 status — unchecked.
