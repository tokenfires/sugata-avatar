# Phase 0 performance spikes

Two standalone pages that answer budget questions with measurements instead of estimates:

| File | Punch list | Question |
|---|---|---|
| `morph-cost.html` | 0.8 | What does a 69-shape ARKit + viseme rig cost per frame on a 13.7k-vertex head? |
| `rectarea-cost.html` | 0.10 | Where does a RectAreaLight portrait rig start to hurt? |

Supporting files: `spike-harness.js` (shared measurement plumbing), `spike-page.css`,
`run.mjs` (headless runner), `results/` (scraped JSON + page screenshots).

---

## How to run them

### In a browser

```
npm run dev
```

Then open:

- <http://localhost:5173/tools/spikes/morph-cost.html>
- <http://localhost:5173/tools/spikes/rectarea-cost.html>

Each page renders a live table and, when the sweep finishes, publishes the same data to
`window.__SPIKE_RESULTS__` and logs one console line prefixed `SPIKE_RESULT `.

Query parameters (both pages): `repeats`, `frames`, `warmup`, `passes`, `width`, `height`,
`forceWebGL=1`. `morph-cost.html` also takes `normals=1` to include morph normals.

### Headlessly

Playwright is deliberately **not** a dependency of this repo — the spikes are a one-off
measurement, not part of the build. Install it anywhere and point the runner at it:

```
npm i --prefix /tmp/pw playwright
npx --prefix /tmp/pw playwright install chromium

node tools/spikes/run.mjs --playwright /tmp/pw/node_modules/playwright
node tools/spikes/run.mjs --playwright /tmp/pw/node_modules/playwright --webgl   # fallback tier
```

The runner starts vite itself, drives all four configurations, and writes a JSON file and a
matching page screenshot to `results/` for each. `--mode headless|headed|auto` picks the browser
mode; `--webgl` forces the WebGL2 backend and suffixes the output files `.webgl2`.

Two flag findings are baked into `run.mjs` and worth not relearning: WebGPU comes up headless on
the real Metal adapter with no flags at all, `--enable-features=Vulkan,WebGPU` *removes* it on
macOS, and WebGPU needs a secure context — which is why the pages are always served over
`http://localhost` rather than `file://`.

---

## What the numbers mean

**Read the GPU column.** Wall-clock frame time is vsync-locked — it floors at the refresh
interval and stays there until a configuration is already over budget, at which point it jumps
to the next multiple. It is a pass/fail light, not a cost. Every figure below is a GPU
timestamp-query duration.

**Read `Δ vs 0`, not the absolute.** Each sweep includes a zero-variant that renders the same
pixels with the feature switched off. The delta is the feature's cost; the absolute includes
the fixed cost of the render pass.

Three things the harness does that are load-bearing, recorded here because each one was a bug
first:

- The loop runs through `renderer.setAnimationLoop`. `renderer.info.frame` is stamped inside
  three.js's animation loop and nowhere else, so a hand-rolled `requestAnimationFrame` loop
  makes every pass share frame id 0 and the "per-frame" timestamp becomes a running total.
- **The loop renders nothing while a timestamp resolve is outstanding.** `resolveQueriesAsync`
  returns the total for whichever frame is last in the pending set; if several ticks' queries
  pool up before a resolve lands, that total no longer matches the pass count you divide by.
  Before this guard, the morph sweep produced an *inverted* curve — 69 targets measuring
  cheaper than 0.
- Each sweep runs three times with the variant order alternating. A single pass produced a
  non-monotonic RectAreaLight curve (4 lights "costing" more than 7) purely because GPU clocks
  drift over the minutes a sweep takes. Alternating the direction decorrelates a variant's
  position in the run from the variant itself.

---

# RESULTS

**Measured 2026-08-07.** MacBook Pro, Apple M5 Max, 40 GPU cores, 128 GB unified memory,
macOS 25.6. Chromium 151 headless via Playwright, `channel: chromium`, WebGPU adapter reported
as `apple / metal-3`, compatibility mode `false`. three.js r185. Canvas pixel ratio pinned to 1.
GPU timestamp queries active on **both** backends — WebGL2 has
`EXT_disjoint_timer_query_webgl2` through ANGLE/Metal here, which is not something to count on
elsewhere.

Sampling: 3 passes × 200 sampled frames per variant after 60 warmup frames; ~597 GPU samples
per data point. Raw JSON and a matching page screenshot for every configuration are in
`results/`.

**Reproducibility.** The WebGPU suite was run three times. Headline deltas across those runs:
69 morph targets 0.233 / 0.222 / 0.219 ms; 4 RectAreaLights at 1080p 3.807 / 3.620 / 3.604 ms;
8 lights at 1080p 7.476 / 5.738 / 7.421 ms. Everything agrees within ~5 % except that one
8-light outlier in run 2, which also broke monotonicity in that run alone. The tables below are
run 3, the numbers currently in `results/`.

> These are single-machine numbers on the fastest hardware we will ever target. Treat them as
> the floor of the cost curve, not as what a mid-range client will see.

## 0.8 — Morph-target cost

13,695-vertex mesh (matching hm08's head region), **every influence animated every frame and
none ever exactly zero** — `Morph.js` skips the texture fetch for a zero weight, so a realistic
mostly-idle face measures far cheaper and would tell us nothing about the ceiling.

### WebGPU

| targets | position only, GPU ms | Δ vs 0 | + morph normals, GPU ms | Δ vs 0 |
|---:|---:|---:|---:|---:|
| 0  | 0.113 | 0.000 | 0.112 | 0.000 |
| 8  | 0.141 | 0.028 | 0.172 | 0.061 |
| 16 | 0.163 | 0.051 | 0.233 | 0.121 |
| 32 | 0.211 | 0.099 | 0.359 | 0.248 |
| 52 | 0.276 | 0.164 | 0.502 | 0.391 |
| **69** | **0.332** | **0.219** | **0.616** | **0.504** |

### WebGL2 fallback

| targets | position only Δ | + normals Δ |
|---:|---:|---:|
| 52 | 0.161 | 0.394 |
| **69** | **0.215** | **0.505** |

**The curve is linear with no cliff anywhere in the range.**

- **≈ 0.0032 ms per target** at 13.7k vertices, position only.
- **≈ 0.0071 ms per target** with morph normals — a factor of 2.2, which is what the two
  texture fetches per target in `Morph.js` predict. The measurement agreeing with the source is
  the strongest evidence we have that the harness is measuring the right thing.
- Normalised: **≈ 2.3 × 10⁻⁷ ms per vertex per target**, or **0.0023 ms per 10k vertices per
  target**.
- WebGL2 and WebGPU are within noise of each other (69 targets: 0.215 vs 0.219 ms). Same
  `DataArrayTexture` + `Loop`, compiled to GLSL instead of WGSL. No backend decision rides on
  this — unlike the area lights, where the backend matters a lot.

### Verdict: the blendshape budget is not a budget

The full 69-shape rig — 52 ARKit + 15 OVR visemes + 2 gender — with **all 69 shapes live every
frame** costs **0.22 ms**, or **1.3 % of a 16.6 ms frame**. With morph normals exported it is
0.50 ms, **3.0 %**.

Consequences for Phase 1:

1. **Stop treating shape count as scarce.** There is no measured reason to trim the ARKit set,
   drop visemes, or cap simultaneous active shapes. Budget the full rig and spend the design
   effort on which shapes read well, not on how many we can afford.
2. **Scaling to the whole body is still free.** hm08 is 19,158 vertices; scaling linearly puts a
   whole-body 69-target rig at ~0.31 ms. Even 150 targets on the full body lands near 0.7 ms.
3. **Skip morph normals unless something needs them.** They double the cost for a still-trivial
   figure, but they also double the `DataArrayTexture`. Exclude them from the glTF export by
   default and revisit only if smooth-shading artefacts appear on extreme expressions.
4. **The real constraints are memory and texture geometry, not time.**
   - The morph texture is `Float32Array(width × height × 4 × targets)`. At 13.7k vertices,
     69 targets is **~18 MB** position-only and **~31 MB** with normals. On the full body,
     ~25 MB / ~50 MB. Not free, but not a wall.
   - `Morph.js` hard-codes `const maxTextureSize = 4096` with a `@TODO` to read it from
     capabilities. Vertices × stride are wrapped into rows of 4096 and the row count becomes
     texture *height*, so this constrains neither vertex count nor target count at our sizes —
     the full body with normals needs 10 rows. Worth knowing it is a literal, not a capability
     query, in case a much denser mesh ever shows up.
   - Targets become **array-texture layers**, so the real ceiling is the backend's max texture
     array layers (256 in baseline WebGPU). 69 is comfortable; a 256-shape rig is the limit.

⚠️ Not measured: skinning combined with morphing. These meshes are unskinned. The morph loop
runs before skinning in the vertex stage, so the costs should add rather than multiply, but that
is reasoning, not a measurement.

## 0.10 — RectAreaLight cost curve

102,400-triangle `TorusKnotGeometry` under `MeshPhysicalNodeMaterial`, framed to cover
**53.8 % of the viewport** (measured from the rendered canvas, not estimated). Ambient +
one directional light are present in every variant including the zero-light baseline, so the
delta is purely the area lights. LTC tables installed via
`THREE.RectAreaLightNode.setLTC( RectAreaLightTexturesLib.init() )` — without that call the
lights contribute nothing and the whole sweep reads as free.

### WebGPU

| lights | 1280×720 GPU ms | Δ vs 0 | 1920×1080 GPU ms | Δ vs 0 |
|---:|---:|---:|---:|---:|
| 0 | 0.339 | 0.000 | 0.521 | 0.000 |
| 1 | 0.783 | 0.444 | 1.259 | 0.739 |
| 2 | 1.439 | 1.100 | 2.355 | 1.834 |
| 3 | 1.986 | 1.647 | 3.254 | 2.733 |
| **4** | **2.516** | **2.177** | **4.125** | **3.604** |
| 5 | 3.094 | 2.754 | 5.144 | 4.623 |
| 6 | 3.736 | 3.397 | 6.257 | 5.737 |
| 7 | 4.171 | 3.832 | 7.003 | 6.482 |
| 8 | 4.785 | 4.445 | 7.942 | 7.421 |

### WebGL2 fallback

| lights | 1280×720 Δ | 1920×1080 Δ |
|---:|---:|---:|
| 1 | 0.613 | 0.930 |
| 2 | 1.589 | 2.441 |
| 3 | 2.421 | 3.700 |
| **4** | **3.239** | **4.947** |
| 6 | 5.081 | 7.636 |
| 8 | 6.753 | 10.030 |

### The cost model

The marginal cost of each additional light is **0.57 ms at 720p** (0.50 Mpx lit) and
**0.95 ms at 1080p** (1.12 Mpx lit). Fitting those two points gives a figure that transfers to
any framing:

> **WebGPU: ≈ 0.26 ms fixed + 0.62 ms per megapixel of lit surface, per additional light.**
> **WebGL2: ≈ 0.54 ms fixed + 0.68 ms per megapixel, per additional light** (~1.4× WebGPU).

The first light is consistently cheaper than the marginal ones (0.74 ms rather than 0.95 ms at
1080p), so the fit overestimates small rigs slightly. Where a rig size is already in the table,
trust the table.

Scaling is **linear in light count** across the whole 1–8 range. There is no knee, no cliff, and
no point at which adding a light becomes cheaper — consistent with the source: clustered
lighting filters to `isPointLight === true && castShadow !== true`, so area lights are evaluated
unconditionally in every lit fragment.

### Verdict: 4 lights, and the fourth one is not cheap

The prior research reasoned to a budget of "3–4 RectAreaLights" from the official example and
forum reports. **That estimate is confirmed, and the reason is now quantified.**

At 1080p on WebGPU, a classic key + fill + rim + kicker rig costs **3.6 ms, or 22 % of a 16.6 ms
frame** — on an M5 Max, on a plain physical material, before any skin shading, hair, eyes, or
post-processing. On the WebGL2 tier the same rig costs **4.9 ms, 30 %**. Eight lights cost
**7.4 ms (45 % of the frame) on WebGPU and 10.0 ms (60 %) on WebGL2** — the fallback tier runs
out of frame on area lights alone.

Consequences:

1. **Cap the portrait rig at 4 RectAreaLights and treat that as a hard budget line**, not a
   soft preference. A fifth light costs another ~0.95 ms at 1080p; there are better places to
   spend a millisecond.
2. **Area-light count is a quality tier.** WebGPU 1080p: 4 lights. WebGL2 or high-DPR: 2–3 —
   a WebGL2 client pays ~1.4× per light, so the fallback tier must drop lights, not just
   effects. The cost model above makes the tier boundaries calculable rather than guessed.
3. **Coverage is the lever, and it is under our control.** Cost is per *lit fragment*. Our
   subject is a head at portrait framing, which covers far less than the 53.8 % measured here.
   A head covering ~25 % of 1080p lights 0.52 Mpx, putting 4 lights at
   `4 × (0.26 + 0.62 × 0.52)` ≈ **2.3 ms** — a third off, for a framing decision. Keeping the
   character from filling the frame is worth real milliseconds.
4. **This measurement is a floor for the shipping material.** A custom skin lighting model
   overriding `PhysicalLightingModel.directRectArea` will change the constant, and every extra
   BRDF lobe multiplies through the per-light loop. Re-run this spike after the pre-integrated
   SSS material exists — the per-light number is a property of the material, not of the light.
5. **None of this buys shadows.** RectAreaLight casts none, so the co-located
   DirectionalLight/SpotLight shadow-map plan from `eyes-and-lighting.md` is additional cost on
   top of every figure above.

## What was not measured

- **Skinned + morphed together.** Both spikes use unskinned meshes.
- **Safari 26.** WebGPU dispatch overhead differs substantially between browsers
  (`rendering-stack.md` cites 31.7 µs Safari/Metal vs 58.7 µs Chrome/D3D12); these numbers are
  Chromium/Metal only.
- **Sustained thermal behaviour.** Each variant runs for a few seconds. A 20-minute session
  will clock lower.
- **DPR > 1.** Pixel ratio is pinned to 1. A Retina 2× target multiplies lit pixels by 4, which
  the cost model above extends to directly.
- **RectAreaLight against a real skin material.** See point 4 above.
