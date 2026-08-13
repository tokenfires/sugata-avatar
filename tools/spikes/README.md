# Spikes

Standalone probes that answer one question each with measurements instead of estimates. A spike
answers a question and writes **no production code**.

| File | Punch list | Question |
|---|---|---|
| `morph-cost.html` | 0.8 | What does a 69-shape ARKit + viseme rig cost per frame on a 13.7k-vertex head? |
| `rectarea-cost.html` | 0.10 | Where does a RectAreaLight portrait rig start to hurt? |
| `fabric-weave.mjs` | **9.16** | **Can fabric appearance be GENERATED from `{weave, ends, picks, tex, gsm}` instead of sampled — and can the twill angle be recovered to prove it?** |
| `hair-motion.html` | **6.6 / 9.14** | **Can the groom's guide curves be simulated at 60 Hz on the GPU inside the frame budget — and does a CPU spring chain fit anyway?** |

Supporting files: `spike-harness.js` (shared measurement plumbing), `spike-page.css`,
`run.mjs` (headless runner), `results/` (scraped JSON + page screenshots).
`hair-motion.html` additionally imports `hair-dftl.js` (the TSL compute solver) and
`hair-groom.js` (a stand-in groom regrown from `hair_cards.py`'s own constants, so the spike does
not depend on a gitignored Blender bake).

`fabric-weave.mjs` has no harness and no results directory: it is dependency-free, side-effect-free
on import, and prints its own gate. Its rendered half is `packages/testbed/src/fabric.html`, which
imports this module rather than mirroring it.

---

## How to run them

### In a browser

```
npm run dev
```

Then open:

- <http://localhost:5173/tools/spikes/morph-cost.html>
- <http://localhost:5173/tools/spikes/rectarea-cost.html>
- <http://localhost:5173/tools/spikes/hair-motion.html>

Each page renders a live table and, when the sweep finishes, publishes the same data to
`window.__SPIKE_RESULTS__` and logs one console line prefixed `SPIKE_RESULT `.

Query parameters (all three pages): `repeats`, `frames`, `warmup`, `passes`, `width`, `height`,
`forceWebGL=1`. `morph-cost.html` also takes `normals=1` to include morph normals.
`hair-motion.html` also takes `cpuIterations`, `checkFrames`, and **`breakFtl=1`**, which removes
the Follow-The-Leader projection and nothing else so the segment-length check can be watched
going red.

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

---

# 6.6 / 9.14 — HAIR MOTION

**Measured 2026-08-13**, `tools/spikes/results/hair-motion.json`. Same machine and launcher as the
Phase 0 spikes above: Chromium 149 headless via Playwright 1.61.1, `channel: chromium`, WebGPU
adapter `apple / metal-3`, `compatibilityMode false`, three.js r185, canvas 512×512 at dpr 1, GPU
timestamps active on the **COMPUTE** pool. 3 repeats × 200 sampled frames after 60 warmup, 8 whole
simulation frames per tick, **n = 597** GPU samples per variant.

⚠️ **Measured against the R14 groom**, i.e. after `hair_cards.GUIDE_SEGMENTS` went 12 → 16. That
change landed mid-session and every number here was re-taken after it; the 13-ring figures appear
only under Reproducibility, labelled.

## The groom, measured off the artefact

`assets/hair/bob01/g050.glb` is one mesh of **10,648 vertices and 10,536 triangles** whose index
buffer decomposes into **296 connected components: 294 of exactly 34 vertices and 2 of 326** (the
scalp shells). 294 × 34 = 9,996, + 652 = 10,648. So the groom is **294 cards of 17 rings**, and the
guide layer a simulation needs is **4,998 particles** — 155× fewer than TressFX's published 776k
short-hair scene. ⚠️ The round brief's "254 cards" does not reproduce; `hair_cards.py`'s
`HAIR_LAYERS` sums to 104 + 58 + 56 + 48 + 28 = **294**. That is REQ-067's finding, independently
re-measured here off the same artefact.

## The headline

| configuration | compute median | compute p95 | share of 16.6 ms |
|---|---:|---:|---:|
| **294 chains, 2 substeps, ONE compute pass** | **0.01361 ms** | **0.01398 ms** | **0.082%** |
| 294 chains, 2 substeps, a compute pass per dispatch | 0.13096 ms | 0.13171 ms | 0.79% |
| 1 chain, 2 substeps, one pass — the submission floor | 0.00930 ms | 0.00945 ms | 0.056% |
| CPU DFTL, JS, 2 substeps, same groom | 0.314 ms | 0.324 ms | 1.89% |
| CPU VRM spring chain, JS, 60 Hz fixed, same groom | 0.144 ms | 0.158 ms | 0.87% |

**The hair's own arithmetic is 0.00431 ms.** Everything else in the GPU column is the cost of
submitting the work.

## 🎯 The finding that actually matters: a `renderer.compute()` call costs 31–54 µs of pass, whatever is in it

`Renderer.compute()` opens one WebGPU compute pass per call (`Renderer.js:2765` —
`backend.beginCompute`, loop over the list, `backend.finishCompute` at `:2807`). Handing it an
**array** runs every dispatch inside a single pass, and WebGPU tracks the read-after-write hazards
between dispatches in a pass itself, so a sequential solver still gets the ordering it needs.

| dispatches / frame | a pass each | ms / pass | one pass | ratio |
|---:|---:|---:|---:|---:|
| 2 (1 substep + rebuild) | 0.07133 ms | 0.03567 | 0.00842 ms | 8.5× |
| 3 (2 substeps + rebuild) | 0.13096 ms | 0.04365 | 0.01361 ms | 9.6× |
| 5 (4 substeps + rebuild) | 0.24996 ms | 0.04999 | 0.02386 ms | 10.5× |
| 9 (8 substeps + rebuild) | 0.48689 ms | 0.05410 | 0.02417 ms | 20.1× |

Across the whole table the left column costs **30.8–54.1 µs per compute pass** and barely moves
with the work inside it. Inside one pass an extra dispatch costs **≈2.3–5.1 µs**, an order less.
⚠️ **The 9-dispatch one-pass cell is the one unstable measurement in this spike** — p95 0.04487 ms
against a 0.02417 ms median, and the repeat run read 0.03128 ms, so read that ratio as **15.6–20.1×**
rather than as a value. Every other cell agrees between runs to under 2%.

The left-hand figure lands beside the 31.7 µs Safari/Metal/M2 dispatch overhead
`research/rendering-stack.md` cites in its "architectural verdict" section from arXiv 2604.02344 —
that paper's figure was **not** re-verified here, but the agreement is worth noticing.

## Chain-count sweep, 2 substeps, one pass

| chains | particles | compute median | Δ vs 1 chain |
|---:|---:|---:|---:|
| 1 | 17 | 0.00930 ms | — |
| **294** | **4,998** | **0.01361 ms** | **0.00431 ms** |
| 1,024 | 17,408 | 0.01452 ms | 0.00522 ms |
| 4,096 | 69,632 | 0.00978 ms | 0.00048 ms |
| 16,384 | 278,528 | 0.01328 ms | 0.00398 ms |
| 65,536 | 1,114,112 | 0.10280 ms | 0.09350 ms |

⚠️ **Not monotonic below 65,536, and it should not be read as one.** 4,096 measures *cheaper* than
294, which is this README's own documented clock-drift failure mode showing up in a column where
every value except the last is within 5 µs of the submission floor. The honest statement is:
**up to ~280k particles the solver is indistinguishable from the cost of asking for it**, and the
first variant where real work is visible is 65,536 chains — 1,114,112 particles, 1.4× TressFX's
published 776k short-hair scene, at 0.094 ms of marginal cost.

## Correctness, read back off the solver's buffer

600 frames of a fixed head shake at the shipped size, positions read back with
`getArrayBufferAsync`:

| check | measured | expected | |
|---|---:|---:|---|
| worst segment-length error | **0.00002 mm** | ≤ 0.01 mm | PASS |
| worst tip lag behind the rigid pose | 229.14 mm | > 5 mm | PASS |
| deepest penetration into the skull collider | 0.000 mm | ≤ 0.10 mm | PASS |
| non-finite components | 0 | 0 | PASS |

**Red proof** (`tools/spikes/results/hair-motion.breakftl.json`, `?breakFtl=1`, which removes the
Follow-The-Leader projection and nothing else): the length row goes **0.00002 mm → 21.48883 mm,
FAIL**, and the other three stay PASS. Restoring is a query-string change; the source is
byte-identical between the two runs.

🚩 **The readback needed a stride of 4, not 3.** `WebGPUAttributeUtils.js:113` pads every
itemSize-3 **storage** attribute out to vec4 — WGSL has no packed vec3 in a storage buffer — and it
rewrites `bufferAttribute.itemSize` in place (lines 143–146). Read at stride 3, the first strand
looks nearly right and everything after it walks off by a float per particle: the first version of
this check reported a 379.12 mm length error and 88.0 mm of skull penetration, both entirely an
artefact of the reader.

## Reproducibility

Two full runs of the identical configuration on an idle machine, both this session:
`hair-motion.json` and `hair-motion.run2.json`. Headline **0.01361 / 0.01370 ms**, a-pass-each
**0.13096 / 0.13172 ms**, floor **0.00930 / 0.00918 ms**, CPU DFTL **0.314 / 0.314 ms**, CPU spring
chain **0.144 / 0.146 ms**. Every variant agrees to under 2% except the 9-dispatch one-pass cell
noted above.

An earlier pair of full runs against the **13-ring** groom, before `GUIDE_SEGMENTS` changed under
this session, both read **0.0111 ms** for the same headline variant at 3,822 particles (0.01107 ms
in the run whose JSON was read at full precision; those files were overwritten by the re-take).
Consistent with the 17-ring figure once the particle count is accounted for, and quoted only to
show the two grooms behave the same way.

🚩 **A run taken while `tools/run-selftests.sh` was executing in another process is not in
`results/` and is quoted here only as the warning it is:** headline **0.0057 ms median with a
0.0289 ms p95**, i.e. the median *halved* while the p95 quintupled, and the whole table's
median-to-p95 gap went from ~2% to ~5×. Concurrent GPU work does not simply add time to this
measurement, it changes the clock state the samples are drawn from. **Take these numbers on an
otherwise idle machine or do not take them.**

## What was not measured

- **The real groom's curves.** `hair-groom.js` regrows the guides from `hair_cards.py`'s own
  constants over an analytic skull, because the GLBs are gitignored build output. Card count, ring
  count and half-widths are the shipped ones; the curves are not, and R14's cut plane
  (`grow_to_cut`) and clumping (`draw_into_lock`) are not modelled at all.
- **The real hair material.** The card mesh in the viewport is untextured `MeshBasicNodeMaterial`.
  Nothing here says what `HairMaterial` plus `HairOIT` cost on top.
- **Interaction with skinning.** The head transform is a uniform matrix, not the rig.
- **Anything but Chromium on Apple Metal.** Compute-pass overhead is exactly the quantity that
  differs most between browsers, and it is 93% of the ungrouped cost.
- **Local shape (bend) constraints, hair–hair repulsion, wind, SDF collision.** The collider is one
  sphere and one capsule.

---

# 9.16 — PROCEDURAL FABRIC WEAVE

**Measured 2026-08-08.** `node --version` v24.13.1, three.js r185, WebGPU on Apple Metal via the
Claude browser pane. The generator uses **no RNG** unless `--noise` is passed, so every number below
has a load-to-load spread of exactly **0** and no verdict is MARGINAL for a noise reason. The one
place a value sits near a floor is called out with the literal token.

```
node tools/spikes/fabric-weave.mjs --table          the taxonomy, with every number's provenance
node tools/spikes/fabric-weave.mjs --measure        generate + measure all twelve fabrics
node tools/spikes/fabric-weave.mjs --gate           the gate and its reds; exits 1 on failure
node tools/spikes/fabric-weave.mjs --gate --nonperiodic    the same, forced through sub-bin interpolation
node tools/spikes/fabric-weave.mjs --noise          white-noise and rival-contamination sweeps
node tools/spikes/fabric-weave.mjs --json           machine-readable

# the rendered half — MUST be served from the repo root, it imports tools/spikes/
preview_start { name: "sugata-root" }
http://localhost:5199/packages/testbed/src/fabric.html
```

## The headline

**Yes.** A twill's angle is recoverable from a height field generated out of thread count alone, to
**0.0000–0.0001°** on a patch cut to whole repeats and **0.018–0.197°** on an incommensurate,
Hann-windowed patch forced through sub-bin interpolation, against a stated tolerance of **±1.0°**.

The gate is punch-list 9.16's own: *"twill angle recovered by an FFT peak at the weave-repeat
frequency, matching `atan((picks × advance) / ends)` within a stated tolerance."*

| fabric | weave | sett /in | predicted | recovered | error | uniqueness | prominence |
|---|---|---|---:|---:|---:|---:|---:|
| denim | 3/1 Z twill | 68 × 44 | 32.91° | **32.91°** | 0.0001° | 6.73× | 259× |
| chino | 3/1 Z twill | 114.3 × 67.3 | 30.49° | **30.49°** | 0.0000° | 10.92× | 688× |
| gabardine | 2/2 Z twill | 114.3 × 68.6 | 30.96° | **30.96°** | 0.0000° | 3.39× | 423× |
| worsted wool | 2/2 Z twill | 114.3 × 68.6 | 30.96° | **30.96°** | 0.0000° | 3.39× | 423× |
| gabardine (§4.4 spec) | 2/1 Z twill | 100 × 60 | 30.96° | **30.96°** | 0.0000° | 47.17× | 397× |

## The three reds, and a fourth nobody asked for

**RED 1 — a plain weave, which has no diagonal to find.** Poplin 120 × 80 is refused, at
`uniqueness = 1.000000` and `mirrorRatio = 1.000000` — **exactly** 1, not approximately. Not a
tuned threshold catching a near miss: `(i − j) mod 2` and `(i + j) mod 2` are the same function, so
the field is mirror-symmetric in x and the two diagonals agree to the last bit. Its diagonal also
sits precisely on the corner of the search band, at the yarn lattice's own Nyquist in both axes,
which is the same fact said twice — *a plain weave's diagonal is not a repeat structure, it is the
yarn lattice.*

🚩 **And the first version of this generator FAILED that red**, which is the whole argument for
writing it. It centred each yarn cross-section on the interpolation segment (a `floor` index)
instead of on the yarn (a `round` index), so every ridge sat in the gutter between two yarns. The
picture still looked like cloth. But `floor` is not symmetric about a yarn centre where `round` is,
the field lost its mirror symmetry, and poplin's ± diagonals read **1.99e6 against 4.40e5 — a
chirality of 4.5× on a plain weave**, with RED 1 green on a broken generator.

**RED 2 — the whole-patch structure tensor, on the same correct twills, in the same pass.** It
returns the warp axis, as §4.4 measured. Test stated two-sided: within 10° of ±90° *and* more than
20° from the true twill.

| | tensor says | off the warp axis | from the twill | FFT says |
|---|---:|---:|---:|---:|
| denim | 88.24° | 1.8° | 55.3° | **32.91°** ✓ |
| chino | 88.32° | 1.7° | 57.8° | **30.49°** ✓ |
| gabardine (§4.4) | 86.69° | 3.3° | 55.7° | **30.96°** ✓ |

⚠️ One fabric is **excluded** from that red and the reason is worth keeping. The 2/2 gabardine's
tensor reads **−2.20°**, nowhere near the warp axis — but its coherence is only **0.1314**, and an
orientation read off a near-isotropic tensor is a direction picked out of noise. *A structure
tensor's angle is only meaningful in proportion to the coherence printed beside it*, and neither
§4.4 nor this file should quote one without the other.

**RED 3 — five defects, only ONE of which the gate was designed around** (LEARNINGS §1.25a). The
class stated out loud: *any height field whose visible float structure does not correspond to the
specified interlacing* — which can break in the angle, the handedness, the aspect, the amplitude, or
the provenance.

| defect | FFT | repeat µm | harmonic frac | caught by |
|---|---|---:|---:|---|
| `wrong-advance` move 2 not 1 | REFUSED | 0.00 | n/a | FFT + repeat-profile |
| `s-twill` handedness flipped | **−32.91°** | 0.12 | 42.5 | FFT + repeat-profile |
| `transposed` ends↔picks | 57.10° | 0.02 | n/a | FFT + repeat-profile |
| `flat-floats` zero crimp | REFUSED | 0.00 | n/a | FFT + repeat-profile |
| `painted-diagonal` | **32.91° — PASSES** | 67.97 | **0.048** | **repeat-profile only** |

🎯 **`s-twill` is the one that decided the gate's shape.** Same denim woven the other hand:
identical yarn diameters, identical GSM, identical coherence, identical `|angle|`. Every gate that
compares magnitudes is green on it. That is why the FFT gate reports a **signed** angle.

🎯 **`painted-diagonal` is the one the FFT gate cannot see, and it is reported rather than hidden.**
It is axis-aligned yarn ridges plus a cosine at exactly the correct twill wave vector with **no
interlacing underneath at all** — a picture of a twill, not a twill — and the FFT recovers 32.91°
cleanly. What catches it is `repeatProfile`, an independent instrument: fold the patch onto one
weave repeat along the twill normal and ask what SHAPE the repeat has. A real interlacing is a
square-ish alternation of floats; the painted one is a pure sinusoid.

| | harmonic fraction (h2+h3+h4)/h1 |
|---|---:|
| ideal 3/1 square wave, `\|sin(πkd)\|/k` at d = 0.75 | **1.040** *(computed)* |
| real generated denim | **0.345** |
| floor | 0.15 |
| `painted-diagonal` | **0.048** |

**RED 4, unasked for — CONTAMINATION.** White noise is the easy case: it spreads across every bin
and a single-bin peak barely notices (σ = 400 µm, larger than a yarn, moves the angle by 0.012°
while collapsing coherence 0.395 → 0.039). So a rival diagonal of the *opposite hand* was added at
growing amplitude, putting the energy exactly where a wrong answer lives.

| rival amplitude | % of the true modulation | recovered | uniqueness | verdict |
|---:|---:|---|---:|---|
| 20 µm | 68% | 32.91° | 2.91 | correct |
| 29 µm | 99% | 32.91° | 2.01 | correct but **MARGINAL** — 0.5% above the floor |
| 40 µm | 137% | REFUSED | 1.46 | refuses |
| 100 µm | 341% | REFUSED | 1.71 | refuses |

**The gate never returns a confident wrong number.** It is correct or it declines.

## Two corrections to `research/wardrobe-system.md` §4.4

### 1. Coherence tracks WARP-FACE FRACTION, not float length

§4.4 says coherence *"orders the twills by float length exactly as it should: 2/1 < 3/1 < 4/1
satin."* Those four fabrics had **four different setts** — plain 120×80, denim 68×44, gabardine
100×60, satin 180×90 — so float length and sett imbalance moved together and the measurement cannot
say which caused the ordering. Varying each alone, using the same control §5.3 praises in the
Fibres & Textiles dataset (*"the yarns are held identical … and only the weave changes"*):

**(a) sett and yarns fixed at 114.3 × 67.3 /in, 36.9 / 28.27 tex:**

| weave | float | warp-face | coherence |
|---|---:|---:|---:|
| plain | 1 | 0.500 | 0.1406 |
| **2/2 twill** | **2** | **0.500** | **0.1743** |
| 2/1 twill | 2 | 0.667 | 0.3754 |
| 3/1 twill | 3 | 0.750 | 0.3807 |
| 4/1 satin m2 | 4 | 0.800 | 0.5689 |
| 5/1 sateen m2 | 5 | 0.833 | 0.5617 |

A **2/2 twill breaks the tie** §4.4 could not: float length 2, warp-face 0.500. If coherence
tracked float length it would land beside the 2/1 at 0.3754. It lands at 0.1743, **nearer the plain
weave**. And 2/1 and 3/1 differ by **1.4%** despite a whole float of difference.

**(b) weave fixed at plain, sett varying — the confound, measured:**

| sett | ends:picks | coherence |
|---|---:|---:|
| 90 × 90 | 1.000 | **0.0036** |
| 100 × 100 | 1.000 | 0.1146 |
| 114.3 × 67.3 | 1.698 | 0.1406 |
| 120 × 80 | 1.500 | 0.1664 |
| 68 × 44 | 1.545 | **0.5592** |

A **plain weave at denim's sett is more coherent than a 3/1 twill at a balanced sett** (0.5592
against 0.3807) and within 0.5% of a 5/1 sateen. Sett alone spans nearly the whole range, so **a
bare coherence number is not a statement about the weave.** The balanced 90×90 reading 0.0036 —
isotropic — is the sanity check on the instrument.

**Consequence for the material:** drive anisotropy strength from the **measured coherence of the
generated field**, which is what `anisotropyFromMeasurement` does. A float-length lookup would give
a 2/2 gabardine a lobe it does not have.

⚠️ These are this generator's numbers from a different implementation, and they do not reproduce
§4.4's absolute values. The finding is about the *separation and its cause*, not the digits.

### 2. Satin has no twill line, and 45.00° was the formula applied off its domain

§4.4 predicts **45.00°** for the 4/1 move-2 satin. The gate **refuses** it, at `uniqueness` 1.468,
and it is right to. A satin's interlacing point set satisfies **both** `(2i − j) ≡ 4 (mod 5)` and
`(i + 2j) ≡ 2 (mod 5)` — multiply the first by 3, the inverse of 2 mod 5 — so it has two generators
and two diagonals, and the second one is the stronger peak (**−14.04°**, at 1.468× the 45.00°
family). That is the textile definition of satin: it is *constructed* so the interlacings never line
up into a visible twill. **Reported, not tuned.** A gate returning 45.00° here would be reading a
number off a structure that does not have one.

## The taxonomy, and where it is empty on purpose

Nine named families plus three controls. **Three of the nine are not woven and one is not a
textile,** and the tool refuses them rather than returning a number.

| class | families | what applies |
|---|---|---|
| **woven** | denim, chino, gabardine, worsted wool *(+ poplin, satin, §4.4 gabardine as controls)* | height field from the draft; **twill gate applies** |
| **knit** | jersey, piqué, rib | intermeshed loops — no warp, no weft, no float, **no twill line**. Wale : course gate applies instead |
| **napped** | melton, fleece | fulled or brushed; the structure is destroyed on purpose. **Thread count predicts nothing about the surface.** Sheen lobe only |
| **non-textile** | **leather** | 🚩 **a BRDF, not a weave.** No ends, no picks, no repeat. `generateHeightField` throws rather than returning a plausible field |

The knit gate recovers the lattice instead, and it needed a real correction: **a knit loop has two
legs per wale**, so the surface's dominant x-period is half the wale pitch and the naive peak reads
every knit at exactly 2×. Fixed by textbook fundamental detection (walk the submultiples), not by a
factor of two. Recovered against expected: jersey 23.00 / 23.00 wales·cm⁻¹, courses 17.00 / 17;
1×1 rib 11.50 / 11.50 (its surface period is two wales); piqué 10.00 / 10.00 (its tuck cell spans
two wales).

**Where a number does not exist, the field is `null` and the source line says so.** Denim's drape
coefficient — *"[✗] none published, anywhere"* per §5.3. Piqué's everything — wardrobe-system has no
piqué row at all, and the wale/course figures here are authored inside jersey's measured band.
Rib's GSM is **deliberately empty**: the only rib figure in repo is Wang/O'Brien/Ramamoorthi's
0.276 kg·m⁻², and §5.3 carries the double flag *"DO NOT SHIP THE WANG VALUES."* Their **ratio**
finding is licence-free and is used instead — woven stiffness is flatly anisotropic, knit is soft
and bias-dependent.

⚠️ **Two in-repo sources disagree about gabardine** and both are carried rather than one being
picked silently: §5.3 says 2/2 twill at 45 × 27 /cm; the §4.4 probe used 2/1 twill at 100 × 60 /in.

⚠️ **`worsted-wool` shares gabardine's row.** §5.3 puts "wool suiting / gabardine" on one line, and
the only measured anchor behind it is a fabric whose yarns are **50/50 PES/Co, not wool**. No
worsted-specific sett was found in repo. The geometry is a PES/Co twill wearing a wool label.

**The yarn diameter formula was re-derived rather than transcribed on faith** — `d(µm) = 37.42·√tex`
against §5.3's four worked values: Ne 9.13 → 300.94 vs 301, Ne 14 → 243.02 vs 243, Ne 30 → 166.02 vs
166, Ne 45 → 135.55 vs 135. All four inside 0.6 µm.

## What each instrument can and cannot see

Stated in the tool's own output as well as here, per LEARNINGS §1.25b.

| instrument | sees | **blind to** |
|---|---|---|
| `fftTwillAngle` | the orientation and uniqueness of the dominant off-axis modulation | whether that modulation came from an interlacing at all (`painted-diagonal`) |
| `repeatProfile` | whether the surface is really made of floats of the right shape | the diagonal's angle; it folds along the spec's direction, so "wrong angle" and "no interlacing" look the same to it |
| `structureTensor` | gradient anisotropy — the coherence half that works | the diagonal entirely. That is RED 2 |
| all three | | **whether the maps reach the shader in the right orientation.** Only `fabric.html` closes that |

🚩 **Two draft-recovery attempts failed before `repeatProfile` worked**, and both failures are about
this height model rather than about the code:

- **Thresholding the height at a crossing cannot work at all.** The envelope there is
  `amp_top + ½·d_top`, and since `amp_warp = ½·d_weft` and `amp_weft = ½·d_warp` those are
  *identical* — a warp-up and a weft-up crossing are exactly the same height. Physically right for
  a balanced fabric.
- **Per-cell orientation is degenerate on an open weave.** Denim's weft covers only 304 µm of its
  577 µm pitch, so a weft-up cell's neighbourhood is full of exposed warp ridge. Measured: the
  windowed tensor called **75.7%** of denim's cells warp-up and a curvature probe **75.0%**, against
  a warp-face fraction of exactly **75%** — both had learnt to answer "warp" and nothing else. Either
  would have produced a plausible number that was measuring the class prior.

## The rendered half — `packages/testbed/src/fabric.html`

It imports `fabric-weave.mjs` rather than mirroring it, so there is no CPU mirror to drift, and it
measures what §5.3 warns fails silently: *"the tangent socket must link to a tangent node using the
same UVMap as the normal map, or the direction is wrong **without an error**."*

**Two things it does that are worth reusing.** It **probes the readback's row order** by moving the
light to world +y and seeing which end of the buffer got bright (at `?res=512&light=1.1`: 1049.6
against 418.0 → row 0 is the top), because the whole measurement is an angle and a flipped row order silently
negates it — and a negated twill angle is exactly the `s-twill` defect. And it calls
`geometry.computeTangents()`, without which `tangentView` reads a `tangent` attribute
`PlaneGeometry` does not have and the anisotropy frame is undefined with nothing erroring.

**The measurement, and the two instruments that failed first.**

- An intensity-weighted **second moment** of the difference image put the axis 35° off the twill and
  made "gained" and "lost" 11° apart when they must be 90° apart, on a frame whose highlight is
  unmistakable by eye. A second moment integrates the far tail — where a broad lobe has its area and
  none of its shape — and per-yarn glints outnumber the lobe's own texels.
- The **half-maximum radius** `r(θ)`, the textbook lobe descriptor, measured the isotropic lobe at
  95.5 px against a 126 px frame — clipped by the viewport — and the anisotropic one at 12 px,
  because **roughness 0.55–0.75 denim has no compact specular lobe to find an edge on**. It is a
  matte fabric; the sheen is a wide gentle bias, not a highlight with a rim.
- What works is the **area-weighted radial integral of the difference** — where did the toggle move
  the energy — which needs no edge and no threshold and cancels the diffuse and the weave texture.

**The result, and it is a sweep rather than a single agreement**, because one agreement can be two
errors cancelling. `anisotropyRotation` commanded across 150°, everything else held, on a smooth
plane:

| commanded ρ | expected axis | rendered axis | error |
|---:|---:|---:|---:|
| 0° | 90.00° | 90.00° | 0.00° |
| 30° | 60.00° | 60.00° | 0.00° |
| **57.09°** *(derived from the FFT angle)* | **32.91°** | **33.00°** | **0.09°** |
| 90° | 0.00° | 0.00° | 0.00° |
| 120° | −30.00° | −30.00° | 0.00° |
| 150° | −60.00° | −60.00° | 0.00° |

Worst **0.09°** against a stated ±8°. **The tangent attribute, the UV orientation, the map row order
and the warp-relative → +U basis change are all correct together** — which is the composite §5.3
says fails silently. The ρ = 0° and ρ = 90° rows *are* the rejection proofs, executed rather than
suggested: 0° must land on the weft and 90° on the warp. The third proof needs a reload —
`?defect=s-twill` mirrors the derived rotation to 122.91° and the rendered axis follows it, on a
fabric where yarn diameters, GSM, coherence and `|twill angle|` are all identical.

🚩 **THE SAME SWEEP ON THE TEXTURED FABRIC IS RESOLUTION-DEPENDENT, and that is itself the
finding.** With the weave normal map attached:

| commanded ρ | expected | rendered at `?res=256` | rendered at `?res=512` |
|---:|---:|---:|---:|
| 0° | 90.00° | 89.00° | **−20.00°** |
| 30° | 60.00° | **3.00°** | 54.00° |
| 57.09° | 32.91° | **−6.00°** | 30.00° |
| 90° | 0.00° | 0.00° | 0.00° |
| 120° | −30.00° | **0.00°** | −27.00° |
| 150° | −60.00° | **4.00°** | −54.00° |
| **worst error** | | **64°** | **70°** |

At 256 it is pinned near the warp axis and ignores the command entirely. At 512 it tracks to within
**6°** for five of the six and fails only at ρ = 0° — anisotropy along the **weft**, i.e. across the
yarn ridges the normal map has already made dominant. Same worst-case number, opposite character.

The mechanism is a three.js fact, read out of r185 rather than guessed: `AccessorsUtils.js` builds
`TBNViewMatrix` from `tangentView, bitangentView, normalView`; `Bitangent.js` derives
`bitangentView = normalView.cross(tangentView)`; and `Normal.js` resolves `normalView`, outside the
NORMAL/VERTEX sub-builds, to `builder.context.setupNormal()` — **the normal-mapped normal**. So the
anisotropy frame is re-derived per texel from the perturbed normal and **twists at every yarn
crossing**. On a weave that is physically right, and it makes a single macro axis a quantity that
depends on how finely the weave is sampled.

**So the honest split:** what is **gated** is that nothing between the FFT angle and the shader is
flipped, transposed or mirrored (0.09° over 150°). That the band on the textured plate lies along
the twill is **observed by eye** — it is plainly there on the plate — and 8.1's blind critic is who
decides it, because this instrument's own answer moves with resolution.

---

## 🎯 WHERE PROCEDURAL RUNS OUT

The single most useful thing this spike can report, and the answer is not the one the punch list
expected. §4.5 named wear, dirt, seam pucker and worn-in creasing as the boundary. **Those are real,
but three closer limits were measured here and they arrive first.**

### 1. It generates NEW cloth and cannot generate OWNED cloth. Confirmed, and it is worse than "add wear later".

Everything this generator produces is a **perfect lattice**. Every yarn is the same diameter, every
crimp the same amplitude, every float the same length, the repeat exact to floating point. That is
precisely why the FFT recovers the angle to 0.0001° — **the gate's own precision is the evidence for
the limit.** A real garment's spectrum is broadened by yarn hairiness, count variation, weaving
tension drift, skew, bow and every hour it has been worn, and a fabric that returns a delta function
where a real one returns a smeared peak is a fabric that reads as *rendered*.

Nothing here is a mitigation. `--noise` adds white noise, which is uncorrelated at every scale and
therefore not what cloth does: it destroyed coherence (0.395 → 0.039 at σ = 400 µm) while leaving
the angle at 0.012° error, i.e. it broke the appearance statistic and left the structural one
untouched — the opposite of ageing.

### 2. Thread count describes the surface for FOUR of the nine named families, not nine.

Not a hedge — a count. Denim, chino, gabardine and worsted wool are wovens and the model applies.
**Jersey, piqué and rib are loops** and get a coarser model validated against nothing, because §5.3
carries wales, courses, tex and GSM for knits and **no surface measurement at all**. **Melton and
fleece are napped**, and melton is milled until the ground weave is *mechanically destroyed* —
thread count predicts nothing about a melton surface, and §4.5 has no row for it because there is
nothing to derive. **Leather is a BRDF** with no lattice at all. So the honest headline is: *fabric
appearance is generable from physical parameters for woven cloth, plausible-but-unvalidated for
knits, and not generable for napped or pile surfaces, where what is generable is the sheen lobe.*

### 3. Fabric THICKNESS is generated wrong, and no single constant fixes it. Measured today.

The one external validation available — §5.3 calls the F&T 1/2018 weave comparison *"the single
best calibration target in this whole document"* because the yarns are held identical (36.9 /
28.27 tex) and only the weave changes, and it publishes a measured thickness per weave. Run by
`--gate` section 8, reported and deliberately **not gated**, because turning it green would mean
fitting a constant to four data points:

| weave | ends/cm | picks/cm | F&T measured | generated | ratio |
|---|---:|---:|---:|---:|---:|
| plain | 46 | 20 | 0.48 mm | 0.271 mm | 1.771 |
| twill 2/2 | 45 | 27 | 0.53 mm | 0.346 mm | 1.532 |
| twill 3/1 | 45 | 26.5 | 0.50 mm | 0.261 mm | 1.918 |
| weft rib 2/2 | 46 | 22 | 0.46 mm | 0.352 mm | 1.308 |

The model is **24–48% too thin**, and the correction it would need varies by **1.47×** across four
weaves whose real thicknesses span only **1.15×**. So no single crimp constant fixes it — crimp
interchange between warp and weft is a mechanical equilibrium this model does not solve. It gets
the **order** wrong too: the 3/1 twill generates thinnest (0.261 mm) and measures *thicker* than the
plain weave (0.50 against 0.48). Invisible under a normal map. Visible under a **displacement** map
or at a silhouette, which is exactly where a garment edge lives.

### And what is NOT the boundary, despite expectation

Pockets and hardware are §4.5's other two gaps and they are **bounded** — placement is derivable
from pattern edges and ~15 models is a one-time cost. The weave itself is now measurably solved for
wovens at zero marginal cost per fabric, across the whole family axis, from five numbers. That is a
materially better position than the face was in, where the missing content was unbounded scan data.

**9.19 should chase (1).** Not with a weathering paper — §4.5 records that the canon has never been
applied to garments — but with the cheapest available version of the right idea: **perturb the
lattice.** Per-yarn diameter and tension drawn from a distribution, a slow low-frequency skew field,
and hairiness as a correlated normal perturbation. It is testable with the instruments already in
this file: a real fabric's FFT peak has a **width**, and this one's has none. *"How wide should the
peak be"* is a question a photograph of real denim can answer, and it is a far more tractable target
than a wear model.
