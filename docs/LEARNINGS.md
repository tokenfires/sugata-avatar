# Learnings

Hard-won knowledge that is not obvious from the code and would be expensive to rediscover.
Written for a successor with no memory of the sessions that produced it.

Two kinds here: **how to verify things** (which has repeatedly been the difference between
working and merely appearing to work) and **specific technical traps**.

---

## Part 1 — Verification lessons, in order of how much they cost

### 1.1 A gate that has never failed is not known to work

Every gate must be **sanity-checked in both directions** before it is trusted: run it against
known-bad input and confirm it *fails*, naming the defect.

Worked example. `verify_glb.mjs` passed on five figures for two full phases. It asserted morph
names on the body mesh only. Meanwhile **five of six meshes were unskinned** and **all six
materials exported `alphaMode: BLEND`** — the face came apart the moment a bone moved, and teeth
drew through closed lips. Both defects leave the body mesh perfect, so the gate stayed green
through both.

After the fix the gate was run against the *old* GLBs: `FAIL — 22 problem(s)`, naming each one.
That is the check that makes a gate trustworthy. Do it every time.

### 1.2 Structural correctness is not visual correctness

Phase 0's gate proved the morphs existed and were named correctly. It never proved the mesh
**renders correctly**. Those are different properties and only one was gated.

If an artifact will ultimately be judged by eye, **something must look at it**, early.

### 1.3 A metric a frozen image passes trivially is measuring nothing

The capture tool scored **perfectly byte-reproducible** while rendering a *still pose* — stopping
the frame loop had also stopped the skinning update, so the body froze while the eyes blinked and
the HUD animated. A still image is always perfectly reproducible.

Caught only by cross-checking rendered head yaw against the simulation's known 33.5°.

**Ask of any green metric: what would a degenerate input score here?**

### 1.4 The observation window is itself a gate parameter

Postural event rates are 0.5–1/min. A 20-second clip **structurally cannot contain** a weight
shift, a shoulder settle, or an arm swing. Two judges assessed "does this read as a person
waiting?" on a clip that excluded, by construction, the behaviours that most sell it.

Worse: the weight-shift relay was verified as *wiring* and never as *behaviour*, because it never
fired. **Before measuring a rate-limited behaviour, check the window is longer than the period.**

### 1.5 Adversarial verification pays for itself, but only if it re-executes

The pattern that works: **build → adversarial verify by execution → fix**. The verifier is
instructed to assume the claim is overstated, to re-run the commands rather than read the report,
and to specifically hunt fabricated benchmark numbers.

Findings that only re-execution caught:
- A "critical" vite alias that was **inert** (byte-identical bundle without it) *and* a landmine
  that would have hard-failed the first Phase 3 addon.
- A selftest gating `new Sway({weightShiftsEnabled: false})` — a configuration no consumer would
  construct. The default failed its own gate on **9 of 9** runs with the anisotropy inverted.
- One fabricated corroboration: `jawOpen` "moves 2,543 vertices, exactly the research figure."
  It moves 2,239. The 2,543 is pre-helper-removal. The agent reached for a number to confirm a
  result rather than measuring it.

**Verifiers found zero invented constants in code, but several in prose.** Numbers in commentary
get less scrutiny than numbers in expressions. Check the comments.

### 1.6 Root causes are often in the dependency, not in our code

Two of the worst bugs were in how a library behaves, and no amount of staring at our code would
have found either:
- MPFB2's `add_mhclo_asset` only rigs an asset **when a skeleton already exists**; otherwise it
  silently parents without an armature modifier. Our pipeline attaches face parts *before* the
  rig by design, so everything took the unrigged branch.
- Blender 5.2 **no longer uses `blend_method`** for glTF export. The exporter reads the Principled
  BSDF alpha socket directly, and MPFB wires an alpha map into it unconditionally.

**When behaviour is inexplicable, read the dependency's source.** Both were found that way.

### 1.7 Check the frame of reference before tuning

Sway's anisotropy inverted as the window grew. It was not a tuning error: Duarte's weight-shift
amplitudes are **centre-of-pressure**, and the layer realised them 1:1 as **head excursion**.

**A published number carries a frame of reference. Ask what it was measured on.**

Three sharper corollaries, each of which cost a round:

**1.7a — Identifying the right inequality and then applying it backwards.** The fix for the above
was a coefficient, `POSTURE_HEAD_TRANSFER = 0.20`, justified by "a body swaying as a near-rigid
inverted pendulum moves its head *at least as far as* its centre of pressure." That inequality is
true. The file then set head excursion **equal** to the published COP figure — which under-moves
the head by exactly the lever ratio the sentence had just identified. Measured on this rig: 1.65.
Writing the reasoning down was not enough to stop the code contradicting it.

**1.7b — Two literatures measured under different protocols must not share one gate.** Quijoux's
3.0/4.9 mm is a **60 s quiet-standing trial** with the instruction "stand as still as possible."
Duarte's weight shifts have a 199 s interval — longer than that whole trial, so they are absent
from Quijoux's data *by construction*. Gating a trace containing both processes against the
quiet-standing RMS is a category error, and it was silently "fixed" by scaling the shift process
down 8× until it fitted. The right shape is one gate per regime, on separable signals. Bates et
al. 2021 supplies the composite number (15 min unconstrained: 16.87 mm ML, 16.32 mm AP) — and
independently confirms the anisotropy **inverts** in that regime, which is the very symptom the
8× fudge had been suppressing.

**1.7c — A distribution is a frame of reference too.** Duarte reports the ML shift as 22 ± 38 mm.
Read as a gaussian and folded to keep it positive, that draws a **mean of 35 mm** — 60% larger
than the paper says. When a reported SD exceeds its mean on a strictly positive quantity, the
distribution is *skewed*, not merely wide; a lognormal matched on both moments is the honest
reading. The layer's own selftest had been printing `relayed |magnitude| mean 1.59` against a
distribution whose *shifts* should average 1.0, and nobody read it as a defect because it was in a
`....` note rather than a gate. (The pooled relay stream now averages 0.60, because fidgets relay
too and carry half amplitude — so the gate had to be stated per pattern to mean anything.)

### 1.7d Two axes can need two mechanisms — and a citation can answer a question it was not asked

`Sway` modelled BOTH axes as an inverted pendulum about the ankles. That is right fore-and-aft and
wrong side to side: medio-laterally, with the feet apart, the ankle has almost no lateral authority
and the body uses **hip load/unload**. Winter et al. 1996 says so in its title — *"Unified theory
regarding A/P and M/L balance in quiet stance"* — and every measured gate in the repo passed anyway,
because they all gated *amplitude* and the defect was in *distribution with height*.

A visual judge named it in one sentence and proved it in three numbers: left-leg tilt against
right-leg tilt r = 0.94, hip against neck r = 0.95, lateral displacement proportional to height
above the ankle. **Nothing in the repo was measuring a correlation between two body parts.** Consider
adding one wherever a layer claims a body is articulated rather than rigid.

🚩 And the part worth wincing at: the adversarial verifier had cited Winter 1996 to me earlier in
the same session — as a supporting mechanism note under a *different* claim, about how the centre
of pressure moves between the feet. It was read as corroboration and moved past. **A source
delivered in support of one claim can be the answer to a different one; when a verifier hands you a
paper, read what it is about, not only the sentence it was quoted for.**

### 1.8 Conceptual model errors look like missing features

The lower body had **exactly 0.0000 mm** of motion over 600 frames. `Sway` declared only spine,
chest and neck — postural sway was modelled as a **spine bend**. Real quiet stance is an
**inverted pendulum about the ankles**; the whole body leans and the spine barely participates.

The fix is not "add leg bones," it is re-rooting the model so head excursion becomes an *output*.
The distinction matters: bolting on legs would have kept the wrong physics.

### 1.9 Judges must state what they could not observe

The best judgements in this project ended with an explicit limits statement — *"I have not watched
this thing animate in real time with my own eyes; I have watched it frame by frame and measured
it."* That honesty is what let the next round fix the **instrument** rather than the symptom.

**Require it. A judge that only reports findings is hiding its blind spots.**

### 1.10 The per-pixel temporal-σ heat map is the single best motion diagnostic

Accumulate per-pixel variance across a clip and render it. The dead lower body showed as a hard
horizontal cut at the hip line, unmissable, in one image. Generate one for every motion gate.

It is now a tool — `tools/critic/heatmap.mjs`, with band statistics that turn "the lower body is
dead" into a number. Two cautions from its own selftest: use a **monotonic** ramp (a rainbow
reverses apparent ordering — the selftest asserts this by failing a rainbow), and pin
`--normalise` when comparing two clips, because `auto` picks p99.9 of moving pixels and silhouette
edges against a dark backdrop swing nearly the full code range.

### 1.10a Temporal σ says WHETHER a region moves. It does not say HOW FAR.

The heat map saturates. Its σ is dominated by silhouette-edge pixels that already swing nearly the
full 8-bit code range, so more motion cannot raise them. Measured on two captures of the same seed
and framing, before and after a change that moved the lower body ~40% further: the head band's mean
σ rose **1.5%** while the head's actual on-screen travel rose **12%**, and the lower bands rose
34–38% in σ against 40–48% in travel. Use σ to find dead regions; use `tools/critic/travel.mjs` —
the horizontal centroid of the silhouette, in pixels — to answer "would a viewer see this."

That distinction is what PROGRESS's failing diagnosis was actually about: "1.6 pixels at full-body
framing" is a travel measurement, and no amount of variance analysis produces it.

### 1.11 A single scalar check may be structurally unable to catch the error you built it for

`BodyMass`'s whole-body centre of mass was checked against Winter's 0.553 of stature. Resolving
the trunk's distal landmark to a chest bone instead of the shoulder joint moves the centre of mass
**60 mm** — and moves it from 0.015 *above* Winter's figure to 0.021 *below* it. Any tolerance wide
enough to admit the correct answer admits the wrong one. No amount of tightening fixes that; the
two answers straddle the target.

What fixes it is a check of a **different kind**: segment *length*. Winter puts the shoulder at
0.818 of stature and the hip at 0.530, so the trunk spans 0.288 — and a chest bone halves it. The
right response to "my gate cannot catch this" is a structurally different assertion, not a tuned
threshold. Record in the gate, as a gate, that the first check does **not** catch it; otherwise
someone later assumes it does.

### 1.11a A justification can be correct about the wrong quantity

`STANCE_RESPONSE_PROBE_BLEND` measured the contrapposto once and scaled it linearly. Its comment
justified that with a real measurement — the *centre-of-mass* response varies 0.3% across the whole
blend range, and a later loop-closure gate confirmed it at 0.996–1.016. Both true. Neither covers
the **ankle**, which rides an arc because the poses differ at the hip by tens of degrees and are
combined by slerp. When the blend cap went from 0.20 to 1.0 the ankle linearisation error reached
2 mm of vertical — a foot leaving the floor, failing the planting gate by 40×.

**A cited measurement in a comment is not automatically a measurement of the thing the comment is
about.** Check which quantity the evidence covers, not just that evidence exists.

### 1.11b A constant that was cheap can stop being cheap when a scale changes

`PIVOT_HEIGHT_FRACTION_OF_ANKLE = 0.5` was a deliberate, well-argued idealisation: the true centre
of rotation sits a little below the malleolus because the heel pad compresses, and the honest
midpoint cost the sole a tenth of a millimetre of slide. Correct, and invisible.

Then the re-rooting multiplied the lean by six. The sole sits 29 mm below a half-way pivot, so it
slides by 29 mm × the lean — measured worst case **2.49 mm**, a foot visibly skating. Moving the
pivot to the ankle joint took it to 0.16 mm. **A sub-millimetre truth is not worth a 2.5 mm lie.**

When an amplitude changes by an order of magnitude, re-audit every constant whose cost was
previously argued as negligible. The argument was about the old amplitude.

### 1.11c Ask whether the ASSET can support the technique before writing the technique

Punch-list 3.3 was "the best effort-to-impact ratio in the whole project: ~40 lines of TSL". A spike
against the actual eyeball mesh found **6 of 8 geometry clauses failing**, one of them fatally:
there is no corneal dome to refract through. Front-versus-equator bulge 0.051 mm against 0.158 mm
of tessellation noise, and the apex is a flat octagonal facet recessed 0.131 mm *inside* the
sphere — a dimple exactly where the pupil is.

The 40 lines would have run. They would have produced roughly half the corneal power (power scales
as 1/R, and a 15.4 mm globe against a real 7.8 mm cornea) and an octagonal catchlight. **A shader
that runs is not a shader that delivers**, and an item chosen for its effort-to-impact ratio is
exactly the one where a silently halved impact goes unnoticed.

The spike cost a fraction of the shader and produced a scoped asset fix instead of a disappointment.
Do this for every technique whose research doc states a geometry contract.

### 1.12 Two practical traps that cost real time

**A scratch vector passed as an output target aliases itself.** `selfCheckFractionOfStature` called
`centreOfMass( this.scratch )`, and `centreOfMass` used `this.scratch` as its own per-segment temp.
The result was garbage that *looked* like a plausible small number (0.0239). It was caught only
because the gate ran on known-bad input in the same pass and both directions returned the same
wrong value. Give measurement methods their own result vector.

**A concurrent agent's file edit will kill a long browser capture.** Vite's watcher fired HMR while
`capture.mjs` was 211 frames into a 3600-frame run; Playwright reported "Execution context was
destroyed, most likely because of a navigation." Long captures and fan-out edits do not mix — run
captures either before the fan-out or after it lands.

---

## Part 2 — Technical traps

### three.js (verified at r185)

- **Do NOT alias `three` → `three/webgpu`.** Both re-export from a shared `three.core.js`, so
  there is no dual-instance problem to solve. The alias omits `UniformsUtils`, `ShaderChunk`,
  `WebGLRenderer` and four others that 30+ stock addons import.
- `PostProcessing` → **`RenderPipeline`** as of r183.
- `RGBELoader` deprecated since r180 → use `HDRLoader`.
- `PCFSoftShadowMap` deprecated at r186; already removed from the WebGPU path.
- 🚩 **Two unrelated things are called SSS.** `MeshSSSNodeMaterial` is a back-lit translucency
  hack (not a skin shader). `addons/tsl/display/SSSNode.js` is Screen-Space **Shadows**.
- `TAARenderPass` (WebGL) **is not TAA** — no reprojection. Useless for an animated avatar.
  The real one is `TRAANode`, WebGPU only.
- Specular AA is **geometric only** — normal-map detail contributes nothing to roughness. Micro-detail
  and hair *will* shimmer without a hand-rolled normal-variance term.
- No bent normals, no specular occlusion, no cloth, no hair, no eye shader. All hand-rolled.
- Bone masking: **filter `clip.tracks`**. Never touch `_propertyBindings` (forum hack, will break).
- `CCDIKSolver.iteration` defaults to **1** in code, not 5 as documented.
- Morph targets live in a `DataArrayTexture` — **no 8-target limit**, and they are nearly free
  (measured 0.219 ms for 69 targets).
- three's node clock reads `performance.now()` — wall-clock re-enters through the renderer. Pin it
  for deterministic capture.

### The figure asset

- Six meshes: `Human` (body, 89 morphs), `teeth_base` (27), `tongue01` (28), `eyelashes01` (27),
  `eyebrow001` (49), `low-poly` (**eyeballs** — named for topology, not anatomy).
- **65 of 89 morphs live on more than one mesh.** Setting a morph means writing every location.
- 53-bone `game_engine` rig. 🚩 **No jaw bone, no eye bones** — face is entirely morph-driven.
- Blink saturates at **0.735**; past that the lash cards punch through the lid.
- Bind pose is worse than an A-pose: arms 41.8° out, 43.1° elbow flexion, wrists 17 cm clear of hips.
- Gender axis is **exactly linear** (2.2e-13 mm). Blending adjacent bakes deviates 0.0004 mm in
  shape. The research's "clamp to a narrow band" mitigation is unnecessary with bracketed bakes.

### LM Studio

See `research/lm-studio-integration.md`. Two blockers: **schema-constrained output arrives in
`reasoning_content`, not `content`**, and thinking **cannot be disabled** by any documented path,
so the schema constraint is load-bearing rather than optional. ~0.7 s per call.

---

## Part 3 — Commands known to work

```bash
# Dev server (serves packages/testbed)
npm run dev                                    # http://localhost:5173/alive.html

# Perf spike pages (need a repo-rooted vite; the main config roots at the testbed
# and SPA-falls-back, returning HTTP 200 with the WRONG page)
npm run spikes

# Rebuild all five figures (~6 s each, byte-for-byte reproducible)
bash tools/figure-pipeline/build.sh

# The asset gate — skinning, materials, ARKit 52, visemes, all six meshes
node tools/figure-pipeline/verify_glb.mjs

# Objective visual gates (the six measured Stellar Blade properties)
node tools/critic/measure.mjs <png> <regions.json>
node tools/critic/selftest.mjs                 # 79 checks

# Blind A/B — strips provenance so a critic genuinely cannot tell which is ours
node tools/critic/blind_ab.mjs <a.png> <b.png>
node tools/critic/blind_ab.mjs reveal

# Deterministic video capture — THE observation instrument. Byte-reproducible.
# --keep-frames is NOT optional if you intend to heat-map the result; without it the
# PNG sequence is deleted and only the mp4/gif survive.
node tools/critic/capture.mjs --url "http://localhost:5173/alive.html?bare&frame=body" \
     --seconds 90 --fps 30 --width 700 --height 1200 --seed 1 --keep-frames --out captures/idle

# Per-pixel temporal-σ heat map — see §1.10. PIN --normalise to compare two clips.
node tools/critic/heatmap.mjs <capture-dir> --stride 5 --normalise 12 --bands 12
node tools/critic/heatmap.selftest.mjs           # 57 checks

# The dev server the captures drive. Start it through the harness (.claude/launch.json,
# name `sugata-testbed`), NOT with bash — and note that ANY file edit while a capture is
# running fires HMR and kills it. See §1.12.

# Motion-layer selftests
node packages/core/src/figure/bodymass.selftest.mjs
node packages/core/src/figure/figure.selftest.mjs
node packages/core/src/motion/MotionStack.selftest.mjs
node packages/core/src/motion/ocular.selftest.mjs
node packages/core/src/motion/Gaze.selftest.mjs
node packages/core/src/motion/idle-motion.selftest.mjs
node packages/core/src/motion/sway.selftest.mjs
node packages/core/src/motion/BodyIdle.selftest.mjs
node packages/core/src/motion/FacialIdle.selftest.mjs
node packages/core/src/figure/restpose.selftest.mjs

# Blender (5.2.0 LTS)
/Applications/Blender.app/Contents/MacOS/Blender --background --python <script>

# LM Studio
/Users/robault/.lmstudio/bin/lms ps
curl -s http://127.0.0.1:1234/v1/models
```

**Environment:** MacBook Pro, Apple M5 Max, 40 GPU cores, 128 GB. Node 24.13.1. Blender 5.2.0 LTS.
ffmpeg 8.1.2. Playwright 1.62.1. Chrome reports `webgpu` / `apple metal-3`.

⚠️ `npm init` **cannot** derive a package name from this directory (non-ASCII character).
`package.json` is hand-maintained. Editing it with Python `json.dumps` will escape the 姿 —
pass `ensure_ascii=False`.

---

## Part 4 — The workflow pattern that works

```js
phase('Build')
const built = await parallel([ /* 3-4 agents, DISJOINT FILE OWNERSHIP */ ])

phase('Verify')
const checks = await parallel([
  adversarialVerifier(built),   // re-executes; assumes claims overstated
  visualJudge(built),           // opens a browser, looks, judges against the gate
])
```

What makes it work:
- **Disjoint file ownership per agent.** Stated explicitly in every prompt. Zero collisions so far.
- **Give agents the measured constants** and tell them not to invent numbers already in `research/`.
- **Tell them an honest failure report beats a plausible partial claim.** They comply, and it is
  the most valuable output.
- **Separate the builder from the judge.** Builders are systematically optimistic about their own work.
- Verifiers should **not fix anything** — report only. Mixing the roles loses the signal.

Cost so far: ~4.4M subagent tokens across four workflows for Phases 0–2.
