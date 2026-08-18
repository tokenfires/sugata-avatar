# Source sweep, 2026-08-17 — six links supplied by the owner, read for hair

Sources, all supplied by the owner in one message:

| source | what it is | licence — **checked in the file, not on the page** |
|---|---|---|
| `Scthe/frostbitten-hair-webgpu` | WebGPU strand renderer + simulator, Frostbite re-implementation | **MIT**, © 2024 Marcin Matuszczyk — vendorable |
| `SiTronXD/WebHairSim` | WebGPU strand sim toy | 🚩 **NO LICENCE = all rights reserved.** `package.json` says `"license": "ISC"` amid untouched npm-init defaults (`"name": "gpu001"`). Read only |
| Babylon.js forum, *Hair simulation WebGPU* (2 pages) | a peer engine solving our problem on our API | 🚩 **NO LICENCE.** `propolisa/pisces` reports `license: null`; playground snippets carry no grant. Read only |
| `basementstudio/shader-lab` | a browser motion-graphics editor, TSL/WebGPU | **Apache 2.0**, © 2026 basement.studio LLC — vendorable *and stays Apache*; modified files must say so |
| Maxime Heckel, *A field guide to TSL and WebGPU* | our exact stack, recent | 🚩 **NO LICENCE STATED.** Read only — costs us nothing, every API it shows is three.js MIT and already installed |

⚠️ **STANDING RULE THIS LEDGER IMPLIES, and three of five sources demonstrate it: assets in a repo
are frequently NOT under the repo's own licence.** frostbitten's Sintel hair is Blender Foundation
content; WebHairSim carries a textures.com fur map and Blender's Suzanne; shader-lab ships
proprietary typefaces and an unattributed `blue-noise.png`. **Check every binary separately from the
code, every time.**

---

## 0. 🚩 The sweep's own methodological failure, recorded first because it cost the most

**I ran this read at the same time as a build workflow that was rewriting `hair_cards.py`.** The
readers took the working tree; the builders replaced it underneath them — 719 insertions, 476
deletions. So:

- the synthesis's premise *"there is no style table"* was **true when briefed and false when
  reported**, and one of its three recommendations was to build what was already on disk;
- **every `hair_cards.py` line citation in it is ~240 lines stale** (HEAD 2145 lines, working tree
  2388). `read_scalp_region` cited at `:828` is at `:1071`; `grow_guide` cited at `:1538` is at
  `:1781`; one citation lands inside a different function entirely.

🎯 **Disjoint FILE OWNERSHIP is not enough when one workflow reads what another writes.** The rule
this adds to the project's method: **a reader gets a pinned revision — `git show <sha>:path` — never
the working tree**, and every report states the sha it read. Ownership prevents write conflicts; it
does nothing about a moving read.

The mechanisms below survive this intact. The coordinates do not. **Trust the values in this
document, re-derive the line numbers.**

---

## 1. Decision 1 — men's and women's styles: INDEPENDENT of the primitive, and startable

**Direct answer: the style work does not wait on the card-versus-strand question.** The root domain
is a CPU-side Python list; the confirmed blind-judge control says strands buy *the hem and the
silhouette and nothing else*, and neither of those is a hairstyle.

⚠️ **One correction to that, from the adversary, and it is fair:** the split is not perfectly clean.
Of the style parameters, `CARD_TWIST` (a round strand has no twist), `TIP_WIDTH_FRACTION`, the three
`CAP_*` keys (an opaque scalp shell that exists *because* cards cannot cover a scalp), and the layer
keys `cards`, `half_width` and `strips` (an atlas column index) are **card artefacts**. And
`GUIDE_SEGMENTS` is co-owned by three systems — the runtime's spring chains are one particle per
ring, and TressFX `.tfx` wants 16 points. "Zero interaction" is overstated; "no blocking dependency"
is right.

### What the sources actually contribute

🎯 **Two unrelated sources converged on the same missing mechanism: the root region must be
AUTHORED, not derived from thresholds.**

- WebHairSim loads a **separate 238-face `suzanneHairRoot.obj`** beside the head and scatters roots
  barycentrically over it. The growth region is a modelled asset.
- The Babylon thread's `findScalpPoints` defines the hairline as a **solid-geometry query** — a ray
  from each vertex against a sphere — and the author notes in the thread that this **replaced "just
  using a Y-clip value."**

Two hobbyists, different engines, no contact, both concluded the same thing. **Our hairline is a
`hairline_z` threshold plus an ARKit-brow-motion trim — a Y-clip with a good excuse.** That is
exactly why *undercut, nape taper, shaved sides, receding hairline and widow's peak* are flatly
inexpressible today, and those are the five things that most separate a men's cut from a women's.

**The transferable form is the SDF one, not the extra-mesh one**: a small list of signed primitives
(sphere, capsule, plane, box) unioned and subtracted, evaluated per candidate root. It needs no new
asset per style, no loader, and it previews without a bake because it is a per-vertex scalar test.

### ⏭️ The ordering, after the adversary corrected mine

🔴 **"Fix the gate first" is wrong, and it is the violet-rim failure in a new place.** Editing five
verify_glb ceilings before a second style exists is tuning a judge against a subject nobody has
photographed — a zero-pixel commit. **Correct order: author the style → bake it → let the gate go
red → fix the specific clause that went red, for a reason you can read.**

⚠️ And the gate is less blocking than the sweep claimed. `MAX_EXPOSED_PATCH_MM2 = 50` carries its
own comment: *"50 mm² is about 8 mm across — the width of a parting, which is a hairstyle, against
the 20 mm patch the critic saw, which is not."* **A hard part is explicitly permitted.** Only the
undercut / shaved-side case is genuinely blocked. Two of the three examples were wrong because
nobody read the comment above the constant.

### 🚩 Explicitly NOT expressible, and not a parameter set

**Ponytail, bun, braid, pigtails.** Three independent missing mechanisms: no tie point; no root
outside the scalp region; and **no upward transport** — the hug pulls anything above `hairline_z`
back onto the skull within 45 mm, and the cut correction divides by the curve's descent, so an
upward card is uncuttable.

⚠️ **This refutes a guess I made earlier tonight from reading `draw_into_lock`** — that a tie is
"just a lock whose centre is off the scalp." The blend would work; the transport and the cut would
not. Recorded because the guess was plausible and wrong, and the next reader will have it too.

🎯 Worth stating in the same breath: **the project's own art target wears a blunt fringe and a high
gathered tail** (Stellar Blade, 206 reference plates, one hairstyle). The one style our own reference
most wants is the one the generator most cannot make.

---

## 2. Decision 2 — the primitive: DEFERRED PENDING MEASUREMENT, not refuted

The numbers, with the qualifications that travel with them and **must not be dropped**:

| figure | source | why it is not a budget number |
|---|---|---|
| `HairFinePass` **~3.3 ms** | frostbitten README, post-rewrite | RTX 3060. **Resolution stated nowhere in the repo** — the canvas is resized to `clientWidth × devicePixelRatio` on load |
| `HairTilesPass` **2.2–2.3 ms** | an **undated inline comment** in a workgroup-tuning block | a note about tuning *insensitivity*, not a profiled total; no evidence it postdates the rewrite |
| frame **<10 ms** | README | same rig, same unknown resolution |
| method | README, verbatim | *"The performance tests were done manually. By commenting out code, testing alternatives."* |

🔴 **The sweep summed 3.3 + 2.2 = ~5.5 ms and called the software rasterizer refuted. That sum is
inadmissible and the adversary is right.** It adds a post-rewrite measurement to an undated tuning
comment, on an unknown resolution, for a 171,000-segment scene, and divides it by our budget. **You
cannot label a figure unusable as a budget number in one sentence and close a decision with it in
the next.**

**The recommendation stands; the reason changes.** Do not build the software rasterizer, because:

1. **It needs three TSL primitives that r185 does not have** — `atomicExchange`,
   `workgroupUniformLoad`, `pack2x16float`. Verified absent by two independent greps.
2. **A software rasterizer is an ADDITION to a hardware draw, not a replacement.** frostbitten still
   runs a second hardware rasterization of the same strands for depth and normals, because a
   software path produces colour only.
3. **The cost may not scale down with our smaller groom**: the fine pass is bounded by *tile
   saturation*, and the repo's own constant says *"performance is NOT linear."* ⚠️ Note honestly
   that "not linear" is not "does not shrink" — nothing in that repo measures a sparse groom.

**The one measurement that should reopen this**: `HairTilesPass` + `HairFinePass` alone, everything
else stubbed, **on our hardware at our resolution**. If it lands near 1.5 ms, this is back on.

### ⏭️ Three cheap experiments that attack the two CONFIRMED defects without changing the primitive

1. 🎯 **Analytic edge coverage on the cards we already have — and it is a DECISIVE experiment, not
   an improvement.** frostbitten computes coverage as `1 − |interpW.x·2 − 1|` from the pixel's
   normalised distance to the segment centreline — ~35 lines of pure arithmetic, MIT, no atomics, no
   barriers, no blocked feature. We already have the card UV, so that distance is nearly free.
   **This separates "the hem loss is a COVERAGE failure" from "the hem loss is GEOMETRIC" — the
   question the blind-judge control could not answer, and the one that decides whether strands are
   needed at all.** One afternoon.
2. **Partial view-alignment for edge-on cards.** We *transport* the authored ribbon offset, which is
   why a card can turn edge-on — the confirmed silhouette failure. ⚠️ **Do not take the full
   billboard**: correct for a 0.05-wide ribbon, wrong for a 35–44 pixel card carrying an atlas, and
   it would destroy the authored twist. Slerp toward view-aligned by an edge-on weight. ~6 ALU in a
   kernel we already dispatch. **Re-derive — WebHairSim is unlicensed.**
3. **An instanced billboard wisp layer** for flyaways and fine frizz — the one thing cards are worst
   at. `Sprite` sets `count`, so instanced sprites are real in r185. ⚠️ Its natural blending is
   additive with `depthWrite` false, which needs reconciling with our stochastic OIT.

**If we ever do go to strands, go HARDWARE**: instanced camera-facing quads driven from
`vertex_index` with no vertex buffer, plus the Babylon thread's **Hermite up-res** — simulate 12
control points, render N, with **analytic** tangents. That decouples simulated count from rendered
count and is the lever that makes strands affordable. ⚠️ Analytic tangents matter more than the
interpolation: a differenced tangent at high subdivision produces the frame jitter that reads as
crawling.

---

## 3. Decision 3 — can TSL express a strand path? ANSWERED. Stop treating it as a blocker

Verified by grep against installed `three@0.185.1`, and the load-bearing items confirmed twice.

| capability | verdict |
|---|---|
| all nine atomics (`Load/Store/Add/Sub/Max/Min/And/Or/Xor`) | ✅ present |
| `workgroupArray`, barriers, subgroup ops | ✅ present |
| indirect dispatch, indirect draw, multi-offset multi-draw | ✅ present |
| storage textures with `read_write` | ✅ present |
| storage attributes usable as vertex attributes | ✅ — every storage attribute is allocated `STORAGE \| VERTEX \| COPY_SRC \| COPY_DST`, so **compute writes positions and the vertex stage consumes them with no storage binding at all** |
| `atomicExchange` | 🔴 **ABSENT** |
| `workgroupUniformLoad` | 🔴 **ABSENT** — and not sugar: it carries the uniformity guarantee WGSL's validator demands for barriers under non-uniform control flow |
| **fragment-stage atomics** | 🔴 **BLOCKED.** `getNodeAccess` returns `READ_ONLY` outside compute; an atomic node merely *warns* and returns `READ_WRITE` in the WGSL while the bind-group layout declares read-only-storage. **A validation mismatch, not a compile error** |

**ANSWERED YES:** compute-simulated strands rendered as instanced camera-facing quads. Every piece
exists and we already ship most of it — `HairDynamics.js` is a working compute→render pipeline with
seven storage buffers and a storage read driving `positionNode`.

**ANSWERED NO:** a per-pixel linked list built from the fragment shader. Do not plan around it.

⏭️ **The one spike still worth running, and it is 20 lines and half an hour**: confirm *in a browser*
that fragment-stage atomics really fail, that a `read_write` storage texture on `r32` binds, and that
indirect draw survives three's CPU-side `drawParams === null` guard. **We read a source
contradiction; we did not observe a failure**, and this project's own rule is that a number nobody
executed is a guess.

🚩 **The budget constraint that should shape any strand design, from our own measured record:** a
`renderer.compute()` call costs **30.8–54.1 µs of pass overhead** against **2.3–5.1 µs** for an extra
dispatch inside one. Against 3 ms, a strand path must be **one `renderer.compute([...])` per frame**,
handing its kernels into the same array as the DFTL solve.

---

## 4. 🔴 The multiple-scattering hypothesis, and the ninth structurally-blind statistic — caught before it ran

The sweep's headline was that the MS pedestal is a **composition** defect: our shading returns
`lobeR + lobeTRT + scatter` — the MS term **additive alongside** the specular lobes — gated only by
a wrap that never reaches zero, whereas frostbitten multiplies the same fake by a Kajiya-Kay diffuse
**and** by `saturate(dot(T, L))`, which is identically zero across half the tangent–light hemisphere.
Proposed experiment: gate `scatter` by `saturate(tangent · toLight)`, measure with
`tools/critic/hair-pedestal.mjs`.

**Three things are wrong with that and all three were caught by adversaries:**

1. 🔴 **The comparison is backwards.** frostbitten **saturates NoL before the wrap**; we do not. Its
   term has a hard floor of `1/(4π)` over the entire back hemisphere; ours decays to zero at the
   antipode. **Our wrap is already strictly LESS of a pedestal than the source it was being
   unfavourably compared to.** The phrase "never reaches zero except at the antipode" describes
   *ours*; frostbitten's never reaches zero at all.
2. 🔴 **The proposed gate is sign-convention dependent and would delete the term.** `tangent` is
   root-to-tip, so a bob's descending mass has a downward tangent; a key light above the head gives
   `dot(T,L) < 0` and `saturate` returns exactly **0**. That is not "suppressed where R and TRT want
   to peak" — that is the groom losing its fill entirely. If the gate is still wanted, use a
   symmetric form (`abs(dot(T,L))`, or a wrapped variant).
3. 🔴 **THE NAMED PROBE IS STRUCTURALLY BLIND TO THE EXPERIMENT — the ninth instance.**
   `hair-pedestal.mjs` recovers `1 − Shadow` from a **per-channel plate ratio** in which every
   channel-independent factor cancels *by design*. `saturate(dot(T,L))` is channel-independent. **It
   cancels out of the operator by construction**, so the probe returns the same number with the gate
   in and with it out — and the round would be filed as a null result on a change that may have
   worked. The instrument that *can* see it is `hair-lobe-sweep.mjs`, whose statistic is R's p99
   against the mass mean — **1.00 today over 207,947 pixels**, and that ratio is exactly what the
   gate exists to move.

🎯 **This is the eighth-and-ninth time the same failure has appeared here and the first time it was
caught before the experiment ran.** See `docs/LEARNINGS.md` and the standing memory
*brief the property, not the operator*. The hypothesis is still the most interesting idea in the
sweep. It needs the other probe and a symmetric gate.

⚠️ Also unquoted and material: **frostbitten ships `weightTT: 0.0`** — it has a lobe disabled that we
give a privileged ungated position. Comparing two compositions while one side has switched a lobe off
is not like-for-like.

---

## 5. Cross-domain mechanisms worth carrying, regardless of hair

Read for the idea, not the artefact — the owner's standing instruction, and it paid here.

1. 🎯 **Deterministic frame capture via a real GPU fence** — from a motion-graphics editor's *export*
   path, nothing to do with graphics research. Reach through three to
   `renderer.backend.device.queue.onSubmittedWorkDone()`, poll pending shader compilations and media
   loads before capturing, then render twice more. **~25 lines, Apache 2.0, and the highest
   value-per-line in the sweep for our judge harness**: a plate captured before the hair material
   finished compiling is a discarded round, and this project has had discarded rounds.
2. **Clamp-and-report as a structural defence against unexecuted numbers** — every parameter write
   returns `applied` / `clamped {from,to}` / `rejected {reason}`. ⚠️ **But our shipped contract is
   already STRICTER**: `apply_style` fails the build on an unknown key, a missing key, a duplicate
   layer name, or a fringe band that disagrees with the forehead band. **Clamping would weaken it.**
   Take only the idea of *embedding the report in the bake record*.
3. **Bake-time shuffle makes LOD a free array prefix** — shuffle the groom before writing and a
   draw-range prefix is a uniform subsample instead of a bald patch. ⚠️ **Not two lines for us**: the
   cap shells share one primitive with the cards, so a shuffled prefix would cut into the opaque
   scalp cap — the geometry that guarantees coverage.
4. **Anisotropic velocity drag decomposed along the strand tangent** — from an underwater fishing
   game. Damp parallel and perpendicular differently, ~1.6–2× more perpendicular. Scalar damping is
   why hair reads as moving through treacle in every direction at once. ~10 lines where the tangent
   is already in scope. Only the *ratio* transfers, and even that is eyeballed.
5. **Inverse-delta transform** — hair points *resist* the parent transform instead of riding it.
   Pre-multiply every non-root point by `inverse(currentWorld · inverse(previousWorld))` so points
   stay put in world space while the head moves and tension drags them along. Pure algebra, injects
   no energy, composes with our per-substep pose interpolation rather than replacing it.
6. **Render-time state interpolation fused into a pass that had to run anyway** — pass the leftover
   fixed-timestep accumulator fraction into the geometry-build kernel and lerp previous-to-current
   *including neighbours*, so the tangent and the ribbon orientation are smooth too. Costs zero extra
   passes. **We have the accumulator and throw the residual away**, compensating by simulating at
   1/120 — so adopting this is a direct lever on the 3 ms budget.
7. **A fixed-max unrolled loop gated by `step()` turns a quality knob into a uniform** — sample count
   changes with no recompile and no pipeline stall. ⚠️ Carries a warning worth grepping our 4,003-line
   material for: **a JS `for` in TSL UNROLLS into the graph; `Loop()` emits a real GPU loop.**
8. **Degenerate-primitive rejection by screen-span threshold** — discard any segment whose screen
   bounding box covers more than N tiles, as insurance against physics launching one strand across
   the screen. Cheaper than making a solver unconditionally stable. ⚠️ Closeup avatar and few points
   per lock both say *raise* the threshold — porting the constant unchanged would silently delete locks.

**Two MIT tools already sitting unused in our own `node_modules`:** `examples/jsm/inspector/`
(Profiler / Memory / Timeline, plus a TSL graph view, attached via `renderer.inspector`) and
`examples/jsm/transpiler/` (GLSL→TSL, runs offline). **We have a 4,003-line hand-written TSL material
whose generated WGSL nobody has ever looked at.** Cheapest debugging win available.

---

## 6. Discarded, with the reason, so it is not re-proposed

- **frostbitten as a source for guide-to-render strand multiplication** — it has none. Its README
  says so: *"I simulate all hair strands. Frostbite can choose how much and interpolate the rest."*
  All 171,000 segments are real. **The honest next source is TressFX proper.**
- **WebHairSim as a feasibility argument** — zero timing instrumentation, a `console.log` inside the
  draw loop, dead pre-1.0 WGSL, and it renders **opaque** geometry with no transparency and no
  sorting. A strictly cheaper problem than ours.
- **Its constraint solver** — applies the full correction to both endpoints, 2× over-relaxed, needing
  ten dispatches to do one pass's work; the correct FTL projection sits commented out below it.
  **Corroborates that our DFTL choice was right.**
- **The Babylon thread's only FPS number** — it is a bug report, and the author found the cause two
  posts later: a per-frame GPU→CPU readback left enabled while debugging. **No WebGPU hair cost is
  established by that source at all.**
- **Its stiffness term** — adds a scaled fraction of an *absolute* position rather than blending
  toward it, translating the strand by a world-space vector. Shipped with `stiffness: 0.0`. Take the
  idea; there is a correct unused helper twenty lines below it.
- **shader-lab for anything hair-related** — a grep for `hair|fur|anisotrop|marschner|kajiya|strand`
  across the whole tree returns **zero**. Its value is entirely architectural.
- **shader-lab's `buildBlueNoiseTexture`** — misnamed. It is a white-noise hash with no spectral
  shaping. Copying it into `HairOIT` expecting blue-noise error distribution would silently make
  dithered transparency **worse**.
- **Heckel's Sobel normal-buffer approach** — re-renders the entire scene a second time with
  `MeshNormalMaterial` swapped on, because he chose not to use `setMRT`. **We already have a deferred
  G-buffer; adopting this is a strict regression.** It confirms our choice rather than challenging it.
- **Heckel for any performance or version claim** — no ms, no fps, no GPU, no resolution, no three.js
  version anywhere; its compute footnotes cite a third-party *fork*. One code sample names a method
  that does not exist (`.computeInstancePosition` — the real one is `.computeKernel`).

---

## 7. What this changes about the plan

1. **Style work proceeds now.** It never depended on the primitive. ✅ In flight.
2. **Order is style → bake → red → fix the clause that went red.** Not gate-first.
3. **The root region wants to be authorable (SDF).** It is the single change that buys undercut, nape
   taper, receding hairline and widow's peak — but **build the control first**: bake a short style
   with the existing parameters and look at it before assuming the undercut is the missing lever.
4. **The primitive decision is deferred pending one measurement on our hardware**, not refused.
5. **Decision 3 is closed.** Record it and stop re-opening it.
6. **The MS composition hypothesis survives**, with a symmetric gate and `hair-lobe-sweep.mjs` as the
   instrument.
7. **The viewer had to be wired before any of this was worth doing** — `hair.js` and `alive.js` both
   hard-coded `bob01/`, so every style baked would have been a file nobody could open. Fixed the same
   night the finding arrived.
