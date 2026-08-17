# 姿 Sugata

A body for an AI — a real-time WebGPU avatar with affect-driven full-body embodiment, built so any
agent can embed an embodied version of itself.

## Embed it — the one call

```html
<canvas id="stage" style="width: 100%; height: 100%"></canvas>

<script type="module">
    import { Avatar } from './packages/core/src/Avatar.js';

    const avatar = await Avatar.create( { canvas: document.getElementById( 'stage' ) } );
</script>
```

That is the whole of it. `canvas` is the only required option, and what comes back is already
breathing, blinking, gazing, micro-shifting its weight, lit by a key/fill/rim/kicker rig, framed on
its own eye line and standing in a relaxed pose rather than a T-pose. There is no second call, no
frame loop to write and no `update()` to schedule — `autoStart` defaults to true and the avatar
drives its own.

**`packages/testbed/src/embed-example.html` is that page, executable.** Twelve executable lines of
script, of which one is the call and seven are an error banner; everything else on the page is CSS
and a `window.avatar` handle for poking at the API from a console. Run `npm run dev` and open
<http://localhost:5173/src/embed-example.html>.

⚠️ **CSS owns the canvas size.** `Stage` observes the element and sizes the drawing buffer to
match, so a canvas with no CSS height gets the HTML default of 300×150 and the avatar renders into
a stamp. Give it a size.

### What you have to serve

The library is `packages/core/src/` — plain ES modules, no build step of its own. It is not
published to a registry (`package.json` is `private`), so vendor the directory or take it as a git
dependency. Its one runtime dependency is **`three` 0.185.1**, imported as `three`, `three/webgpu`,
`three/tsl` and `three/examples/jsm/loaders/GLTFLoader.js`.

Alongside the modules, four files per avatar have to be reachable over HTTP:

| what | where the library looks by default | bytes (g050) |
|---|---|---|
| `figure_g050.glb` — the bake | `assets/figures/`, resolved from `figure/Identity.js` | 11,567,392 |
| `figure_g050-curvature.png` | `tools/lut-bake/out/`, resolved from `material/SkinMaterial.js` | 527,543 |
| `figure_g050-regions.png` | **derived from the curvature URL by name** — same directory, always | 225,935 |
| `figure_g050-cavity.png` | `tools/lut-bake/out/` | 135,923 |

**11.9 MiB for one avatar**, and five bakes exist (`figure_g000` … `figure_g100`, 55 MB in total)
because `identity.gender` snaps to the nearest of them.

⚠️ **The three baked maps must be siblings in one directory, and the curvature file must still
be named `*-curvature.png`.** `SkinMaterial` derives the region and cavity URLs by string-replacing
`-curvature` in the curvature URL. A renamed curvature file does not fail — the replacement
misses, both derived URLs come back null, and the roughness/thickness/lip and cavity terms
simply vanish from the skin. A file that is named right and 404s is the loud failure; a file that
is named wrong is the quiet one.

The three baked maps are committed — all fifteen of them, one set per bake. **The GLBs are not:**
`assets/figures/*.glb` is gitignored and has to be rebuilt with `npm run figure`, which needs
Blender and takes about six seconds per figure. A fresh clone therefore has the maps and no bodies,
and `Avatar.create` fails on the GLB fetch until that command has been run once.

To serve them from somewhere else — a CDN, a `/static/` path — pass the two base options. Both
accept a root-relative path and resolve it against the document, the way an `<img src>` does:

```js
const avatar = await Avatar.create( {
    canvas,
    assetBaseUrl: '/static/avatar/',        // expects <base>/figures/figure_g050.glb
    bakedMapBaseUrl: '/static/avatar/maps/' // expects the three PNGs, side by side
} );
```

### Every option

```js
const avatar = await Avatar.create( {
    canvas,                        // HTMLCanvasElement — REQUIRED, and sized by CSS
    identity: { gender: 0.5 },     // 0 masculine … 1 feminine; snaps to the nearest of five bakes
    quality: 'auto',               // 'auto' | 'high' | 'balanced' | 'fallback'
    frame: 'portrait',             // 'portrait' | 'body'
    seed: 20260807,                // same seed + same dt sequence = same motion trace
    affect: true,                  // build the expression and posture layers
    autoStart: true,               // false hands the clock to update( dt )
    pose: 'relaxed-standing',      // null for the untouched bind pose, which is a T-pose
    assetBaseUrl: null,
    bakedMapBaseUrl: null,
    framedHeightMetres: undefined  // override the crop; 0.18 is eyes-only
} );
```

`AVATAR_DEFAULTS`, `QUALITY_TIERS`, `QUALITY_REQUESTS` and `FRAME_MODES` are exported beside
`Avatar`, so the defaults are readable rather than described. The three tiers move switches this
repository has already priced — `high` is TAAU + grade + GTAO + shadows and is exactly the
configuration every committed gate number was measured on; `balanced` gives back the +0.845 ms p50
that ground-truth occlusion costs; `fallback` swaps the temporal resolve for MSAA and moves
nothing else.

Bad arguments are refused in words before any GPU work happens: a missing or non-canvas `canvas`,
an unknown `quality` or `frame`, and a non-finite `seed` each throw a `TypeError` naming the fix.

### The verbs

| call | what it does |
|---|---|
| `avatar.feel( 'joy', 0.8 )` | Push an emotion by name. Any key of `ANCHOR_SETS` — WASABI's eight drift states plus ALMA's twenty-four OCC appraisals. It both triggers the emotion and moves the PAD point to that emotion's nearest anchor, because a trigger alone is geometrically gated and would often do nothing. Chains. |
| `avatar.feel( { pleasure, arousal, dominance } )` | Push a PAD vector; each axis on [-1, 1], at least one must be a finite number. |
| `await avatar.say( text )` | Drives the face and the body from the sentence. See the limit below. |
| `await avatar.say( text, { timeline, at, prosody } )` | …and the mouth, from a TTS viseme timeline. |
| `avatar.update( dt )` | One simulation frame plus one render. **Only under `autoStart: false`** — it throws otherwise rather than let the simulation advance twice per displayed frame. |
| `await avatar.setIdentity( { gender: 1 } )` | Swap the bake live. Async because a new bake means a new motion target, and the layers keep their phase so nothing visibly restarts. |
| `avatar.report()` | The census, the affect state, the tier, the framing and the leak check, as a plain object. |
| `avatar.dispose()` | Releases the GPU, the layers and the frame loop. Idempotent; every verb afterwards throws by name. |

`report()` is what a HUD and a gate both read. `quality.backend` is read off the renderer rather
than off the request; `subsystems` is counted off the scene graph rather than off the options that
were supposed to put things there, so a subsystem that failed to attach reports as absent; and
`disposal.leaked` is a deny-by-default walk of the instance's own handles, empty after a clean
`dispose()`.

### The limits, plainly

**WebGPU is the default path and WebGL2 is a downgrade, not a fallback plan.** `quality: 'auto'`
asks `navigator.gpu.requestAdapter()` — not merely whether `navigator.gpu` exists — and resolves
to `high` when an adapter is granted and to `fallback` when it is null, when it throws, or when
there is no `navigator.gpu` at all. WebGL2 has no velocity buffer, so the temporal resolve genuinely
cannot run there; the `fallback` tier serves MSAA instead. ⚠️ **`quality: 'fallback'` does not
force WebGL2** — it selects an antialiasing path, not a backend, and `Avatar` never asks `Stage`
for `forceWebGL`. If a temporal tier ends up on a WebGL2 backend anyway (device creation can fail
after the adapter was granted), the console warns and `report().quality.backendMismatch` goes true
rather than the frame being quietly wrong.

**Tier selection is structural, never a frame budget.** `Avatar.create` resolves the tier through
its own `resolveTier()`, which asks the adapter and nothing else — it does not time a frame, warm
anything up, or apply hysteresis. Choosing a tier from a measured frame budget is punch-list 7.2,
and `Avatar.js` imports nothing that does it.

**`say( text )` does not move the mouth.** It drives valence and dominance from the text and the
body posture from the same state — arousal lives in the acoustics, so pass `prosody` readings when
you have them — but a viseme timeline comes out of a TTS engine, and inventing one would mean
typing a speaking rate into the library that nothing in `docs/research/` has measured. Pass
`{ timeline }` and the mouth moves and the promise resolves when the utterance ends; pass none and
the promise resolves immediately with `timelineSupplied: false`.

**The LM Studio proxy is a dev-server facility and does not ship.** `vite.config.js` proxies
`/lmstudio` so a page can reach a local model same-origin; LM Studio sends no
`Access-Control-Allow-Origin` and answers the preflight with a 400, both measured. A built page
served anywhere else has no proxy, so an embedder needs their own same-origin path or a
CORS-enabled gateway, and `LMStudioClient` takes `endpoint` as a constructor option for exactly
that reason. Nothing in `Avatar` calls it — the avatar is complete without a language model.

**🚩 A bundled build breaks the skin, and the fix is one line of bundler config.** Measured at
HEAD `741ae2b` on this page, three builds minutes apart with vite 8.2.1 / three 0.185.1 /
node 24.13.1:

- Default asset naming (hashed) — the bundler emits every GLB and all fifteen baked PNGs, and the
  page still fails: the bake name is read off the GLB's *filename*, which is now
  `figure_g050-4pzc9G3S`, so the generated lookup table for the maps misses and the page requests
  `/assets/undefined`. `Avatar.create` rejects with *"SkinMaterial: could not load the baked map
  at …/assets/undefined"*. ⚠️ **`bakedMapBaseUrl` does not rescue this** — the failing part is the
  file's *name*, not its base.
- The same build with `rollupOptions.output.assetFileNames: 'assets/[name][extname]'` — the page
  boots, requests exactly `figure_g050.glb` and the three `figure_g050-*.png` maps, and reports
  tier `high` with skin, both eye shells and both card materials on the figure.

So: **turn asset hashing off for these files, or serve the figure and the maps as static files you
control and point `assetBaseUrl` / `bakedMapBaseUrl` at them.** The dev server has neither problem
because it rewrites nothing. `docs/LEARNINGS.md` records this hazard as handled — that line is
correct about the *emission* and wrong about the *lookup*. The durable fix belongs in
`material/SkinMaterial.js`: key the maps on the identity, not on a filename that a bundler owns.

**Not wired into `Avatar` yet, and named so the absence is visible:** hair (3.5/3.6/6.6), the
wardrobe (Phase 9) and identity detail targets (Phase 10). All three exist and are gated; all
three are opt-in on `alive.html` for reasons that still hold. They are `Avatar`'s next options,
not its first.

### How the section above was checked

Nothing here is quoted from the API contract; it is what the code did when it was run. Measured at
HEAD `741ae2b` on `packages/testbed/src/embed-example.html`, in Chrome 148 on macOS, with node
24.13.1 / vite 8.2.1 / three 0.185.1:

- **The one call.** Dev server, no options but `canvas`: `report().quality` is
  `{ requested: 'auto', tier: 'high', backend: 'webgpu', temporalResolve: 1, resolutionScale: 0.66,
  backendMismatch: false }`; the census reads skin 1, eye material 2, eye occlusion 4, cards 2,
  shadow-casting lights 1, grade 1; 43 draw calls and 86,751 triangles; and exactly four assets are
  fetched — the GLB and the three baked maps.
- **It is alive.** Thirteen layers in the stack, `motion.frame` and `motion.timeSeconds` advance,
  and `motion.fingerClaim` goes `{ resolved: true, yieldedTo: 'bodyIdle' }` on the first frame —
  which is the trap where `HandIdle` and `BodyIdle` would otherwise both write the fingers and sum.
- **`feel( 'joy', 0.8 )`.** PAD moves to `{ +0.170, +0.085, +0.043 }`, mood octant `exuberant`,
  activations `joy 0.800` and `happy 0.147`, and the posture layer answers with 3.30° of arm spread
  and 2.34° of head tilt — the body emoting off the same state as the face.
- **`say( text )` with no timeline** resolves `{ text, affect, timelineSupplied: false,
  durationSeconds: 0 }`, with `affect` carrying pleasure, arousal, dominance and their confidences.
- **`dispose()`** leaves `disposal` at `{ disposed: true, leaked: [] }`, and `feel()` afterwards
  throws *"Avatar.feel: this avatar has been disposed. Create another one."*
- **`quality: 'fallback'`** on the same machine: tier `fallback`, backend still `webgpu`,
  `temporalResolve: 0` — which is how the "it is not a backend switch" claim above was settled.
  With `autoStart: false`, one `update( 1/60 )` advanced `motion.frame` from 0 to exactly 1, and
  `frame: 'body'` measured the framed height at 1.8267 m off the posed figure.
- **The build finding** is the A/B described above: the same page, built twice, failing on hashed
  asset names and booting on unhashed ones.

## Start here

```bash
npm install
npm run dev
```

Then open **<http://localhost:5173/>**. That is the testbed hub: every page in the project, what
each one is for, and which gate proves it. Start at **alive** — the acceptance page, and the one
every objective gate and every blind-judge plate is captured from.

The hub is generated from `packages/testbed/pages.js`, and `packages/testbed/pages.selftest.mjs`
holds it to the filesystem and to the build config in both directions, so a page added without a
card fails a gate rather than quietly going missing.

## The commands

| | |
|---|---|
| `npm run dev` | The hub and every page, at <http://localhost:5173/>. |
| `npm run selftests` | **Every gate in the repo**, one line each, with the tree state at both ends. Exit code is the number that failed. Slow — the browser-driven gates are most of it. |
| `npm run critic` | The seven objective image gates (G1–G7) over a captured plate. |
| `npm run verify:glb` | Structural verification of every shipped GLB. |
| `npm run build:pages` | Builds **all** pages. Plain `npm run build` compiles only `index.html`, vite's default single entry, so a broken import anywhere else passes it. |
| `npm run figure` | Rebuilds the figure and wardrobe artefacts through Blender. Slow, and it moves sha256-bearing gate inputs. |
| `npm run spikes` | The spike pages under `tools/spikes/`, which live outside the dev root and need their own config. |

A single gate is a plain node file with no test runner:

```bash
node packages/core/src/wardrobe/shadow.selftest.mjs
```

## Where things are

| | |
|---|---|
| `packages/core/src/Avatar.js` | The composition root — the whole public API above, in one file. |
| `packages/core/` | The library. `figure/ material/ render/ motion/ affect/ voice/ wardrobe/` |
| `packages/testbed/` | The pages. `index.html` is the hub; `alive.html` is the acceptance page; `src/embed-example.html` is the one-call embed. |
| `tools/critic/` | The measurement harness — objective gates, blind A/B pairing, capture. |
| `tools/figure-pipeline/` | Blender-side asset build and GLB verification. |
| `tools/lut-bake/out/` | The baked curvature, region and cavity maps — committed, and served as-is. |
| `assets/` | Built artefacts. Gitignored; rebuild with `npm run figure`. |
| `reference/` | Comparison imagery. **Gitignored, never committed, never shipped.** |

## The documents, and the order to read them

1. **`docs/BRIEF.md`** — the original request, verbatim, plus the requirements derived from it.
   When any other document disagrees with this one, this one wins.
2. **`docs/PUNCHLIST.md`** — every item, its gate, and what was measured. The working document.
3. **`docs/LEARNINGS.md`** — what went wrong and what it cost. Part 1 is verification lessons,
   Part 3 is commands known to work.
4. **`docs/OPEN-REQUESTS.md`** — the cross-file request ledger, adjudicated by its own gate.
5. **`docs/research/`** — sourced reference numbers. Every constant in a gate traces to one of these.

## How this repository is built

Two rules carry most of the weight, and both are there because they were learned expensively:

**A gate that has never failed is not known to work.** Every gate here has a *red proof* — the
defect reintroduced at source, the gate observed going red, the tree restored byte-identically.
A gate with no red proof is decorative.

**Structural correctness is not visual correctness.** Every selftest proves numbers; none of them
can tell you whether a face is legible. That is why there is a browsercheck page per subsystem and
why the critic loop is blind: the harshest reviews in this project came from judges who did not
know which image was ours.
