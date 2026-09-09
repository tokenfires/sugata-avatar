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

With `hair: 'bob01'`, nine more files under `assets/hair/bob01/` become reachable — five per-identity
grooms and four shared sheets, of which two are embedded in the GLBs and two are sidecars the
material fetches separately. Measured on disk:

| what | bytes |
|---|---:|
| `g000.glb` … `g100.glb` — one groom per figure bake | 3,327,232 / 3,327,560 / 3,326,956 / 3,327,368 / 3,327,344 |
| `flow.png` — strand tangent, root-to-tip, strand id | 348,510 |
| `depth.png` — depth within the bundle | 63,001 |
| `albedo.png`, `normal.png` — reference copies; both are **embedded** in every groom GLB | 1,090,362 / 1,064,393 |

**19,202,726 B = 18.313 MiB for the directory**, of which one avatar fetches 3,327,232 B (its groom)
plus 411,511 B (the two sidecars). `assetBaseUrl` moves all seven together — the sheets have to
travel with the grooms or a self-hosted avatar loads with a constant-1 shadow and no flow rotation,
which is a *different picture* rather than an error.

⚠️ **The three baked maps must be siblings in one directory, and the curvature file must still
be named `*-curvature.png`.** `SkinMaterial` derives the region and cavity URLs by string-replacing
`-curvature` in the curvature URL. A renamed curvature file does not fail — the replacement
misses, both derived URLs come back null, and the roughness/thickness/lip and cavity terms
simply vanish from the skin. A file that is named right and 404s is the loud failure; a file that
is named wrong is the quiet one.

The three baked maps are committed — all fifteen of them, one set per bake. 🚩 **So are the GLBs, and
the sentence that stood here said the opposite.** Verified at HEAD: `git ls-files assets/figures`
returns all five bodies and `git ls-files assets/hair` returns all five grooms and all four sheets;
`.gitattributes` routes `assets/figures/*.glb`, `assets/hair/*/*.glb` and `assets/hair/*/*.png`
through LFS. A fresh clone with LFS therefore has everything `Avatar.create` needs. `npm run figure`
rebuilds them through Blender — it is how you change them, not how you obtain them — and it moves
sha256-bearing gate inputs when it runs.

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
    framedHeightMetres: undefined, // override the crop; 0.18 is eyes-only

    lighting: 'studio',            // 'studio'|'warm'|'cool'|'soft'|'dramatic', or the object below
    background: 'studio',          // 'studio'|'void', a hex, or the object below
    scene: 'studio',               // 'studio'|'void', or a scene description — the WIDER form
    hair: false                    // 'bob01' | 'bob02' (g050 only) | false
} );
```

`AVATAR_DEFAULTS`, `QUALITY_TIERS`, `QUALITY_REQUESTS`, `FRAME_MODES`, `SCENE_LOOKS`,
`SCENE_LOOK_NAMES`, `BACKGROUND_PRESETS`, `BACKGROUND_PRESET_NAMES`, `SCENES`, `SCENE_IDS`,
`SCENE_KINDS`, `resolveScene` and `HAIR_STYLES` are exported beside `Avatar`, so the defaults are
readable rather than described. The three tiers move switches
this repository has already priced — `high` is TAAU + grade + GTAO + shadows and is exactly the
configuration every committed gate number was measured on; `balanced` gives back the +0.845 ms p50
that ground-truth occlusion costs; `fallback` swaps the temporal resolve for MSAA and moves
nothing else.

Bad arguments are refused in words before any GPU work happens: a missing or non-canvas `canvas`,
an unknown `quality` or `frame`, and a non-finite `seed` each throw a `TypeError` naming the fix.

### The scene — light, room and hair

These three are the options an *agent* embedding itself actually reaches for, because they are the
ones that decide whether the avatar looks like it belongs on the host page.

```js
lighting: {
    look: 'studio',      // 'studio' | 'warm' | 'cool' | 'soft' | 'dramatic'
    exposure: 1,         // RELATIVE multiplier on the calibrated exposure. Refused outside [0.25, 4]
    ambient: 1,          // RELATIVE multiplier on the rig's ambient fraction of key. [0.5, 2]
    shadows: null,       // null lets the quality tier decide; true/false wins over it
    lights: null         // escape hatch: { key: {…}, fill: {…}, rim: {…}, kicker: {…} }
},
background: {
    colour: 0x08080a,    // scene clear colour. 🔴 null (transparent) is REFUSED — see below
    backdrop: 0x070a0e,  // the emissive card's level. false => no card, and forces the balanced tier
    ground: true         // the floor plane + contact occlusion. false => no plane
}
```

### `scene` — the place, which is the wider form of `background`

`background` says what is *behind* the figure. `scene` says *where the figure is*: the light, the
backdrop, the ground, the air and the exposure, as one plain object of numbers and names. It is a
**new, wider door and not a replacement** — `background` and `lighting` keep working exactly as
documented above, and an explicit `background` or `lighting` **wins over** the scene's.

```js
scene: {
    id: 'studio',
    kind: 'studio',          // 'studio' | 'interior' | 'exterior'
    sun: null,               // ✅ 11.2 — { elevationDegrees, azimuthDegrees, occlusion }, WORLD angles
    sky: null,               // ✅ 11.2 — { turbidity, rayleigh, mieCoefficient, mieDirectionalG }
    room: null,              // punch-list 11.4 — an emissive room box with a window onto the same sky
    lights: {},              // LightingRig's OWN placement schema: { key, fill, rim, kicker }
    ground: { enabled: true, albedo: null, roughness: null },
    air: { haze: 0 },        // ✅ 11.5 — 0 is a clean day; 1 dissolves the ground into the sky at 25 m
    exposure: 1,             // RELATIVE multiplier, same units as lighting.exposure
    background: { colour: 0x08080a, backdrop: 0x070a0e, distanceMetres: 1.9 },
    framing: null            // null leaves the caller's `frame` alone
}
```

**Today the table has five entries.** Three are ports — `studio`, `void`, and the refused
`transparent` — and `studio` is the **calibration control** whose numbers may not move. Two are
authored exteriors: **`beach`** and **`park`** (punch-list 11.2/11.3). Two, not one, on purpose:
they differ in sun elevation, sun side, disc occlusion, turbidity, ground albedo and exposure, and
nothing about the code path differs between them, which is what proves the mechanism is parametric
rather than a special case. The other ten of the design's twelve are 11.6.

#### `kind: 'exterior'` — the sky, and the sun that is also the key

An exterior needs BOTH a `sun` and a `sky`; either alone is refused, because the sky is drawn from
the sun and the key light is derived from the same elevation, so one without the other is a scene
whose backdrop and whose light cannot agree.

```js
scene: {
    id: 'beach', kind: 'exterior',
    sun:  { elevationDegrees: 52, azimuthDegrees: 58, occlusion: 0 },
    sky:  { turbidity: 2.8, rayleigh: 1.0, mieCoefficient: 0.006, mieDirectionalG: 0.8 },
    ground: { enabled: true, albedo: 0xa89f8d, roughness: 0.95 },
    lights: { fill: { irradiance: 0.70, colour: 0xbcd6f7 } },
    exposure: 1.28,
    background: { colour: 0x8fb4d8, backdrop: false, distanceMetres: 1.9 }
}
```

- **`sun.azimuthDegrees` is a WORLD azimuth** — about +Y from +Z, positive toward +X. ⚠️ It is *not*
  `LightingRig`'s azimuth, which is measured from the camera so a rig follows it.
  `rigAzimuthForSun()` converts; the camera stands at world azimuth 12°, so beach's 58° reaches the
  rig as **+46°** and park's −46° as **−58°**.
- **`sun.occlusion`** is the fraction of the solar *disc* hidden by local cover — leaves, an awning,
  a passing cloud. It scales the derived key and leaves the sky alone, because what stands between
  the subject and the sun does not stand between the subject and the rest of the hemisphere. `park`
  runs at 0.45 and that is what "dappled" is as a number.
- **The key's colour and irradiance are DERIVED, never declared.** A declared `sun.colour` is
  refused: two statements of one star is how a sky and its key come to disagree. Both come from
  `SkyMesh`'s own extinction — `solarDiscLight()` is a CPU port of the same `Fex` the sky is drawn
  with, validated against arithmetic at the zenith and against pixels in `tools/spikes/sky-env.html`
  §E (the analytic key and the baked solar disc agree to **90.8%** with no fitting).
- **`sky.cloudCoverage` is refused.** `SkyMesh`'s clouds are driven by the TSL `time` node, so an
  environment baked with them on is a different environment on every bake and no plate is
  reproducible. Weather needs a decision about the clock first.
- ⚠️ **An exterior sets `backdrop: false` and therefore runs on `balanced` only.** `quality: 'auto'`
  resolves it there; an explicit `high` or `fallback` is refused, because ground-truth occlusion with
  nothing at background depth renders the whole frame black — re-measured with the sky PMREM as the
  background and it is still every pixel at code 0, so the sky does not rescue it.
- ⚠️ **`SkyMesh` is `WebGPURenderer`-only.** An exterior on a WebGL2 backend is refused in words
  rather than rendered as a black box.

**Units.** `SkyMesh` emits its own absolute scale and a 60° sun delivers 25.12 there against the
studio key's 3.0 — a factor of 8.37. `SKY_TO_RIG_SCALE` (0.11942) is the single conversion: the
derived key carries it, and `scene.environmentIntensity` / `scene.backgroundIntensity` are set to it
times the rig's own `exposure`, so the image-based half tracks exposure exactly as the four direct
lights do. One scale for the light and the image means they cannot drift.

🎯 **`scene: 'studio'` renders the same bytes `background: 'studio'` does, and that is measured
rather than asserted.** 900×1200, 1 step at 60 fps, seed 1, frozen, through `Avatar.create` on
`tools/critic/avatar-plate.html`:

| arm | loads | sha256 | bitident | worst | px |
|---|---:|---|---:|---:|---:|
| `background: 'studio'`, before the refactor | 5 | `fac62c50d56590fb` | 10/10 | 0 | 0 |
| `background: 'studio'`, after | 5 | `fac62c50d56590fb` | 10/10 | 0 | 0 |
| `scene: 'studio'` — the new door | 3 | `fac62c50d56590fb` | 3/3 | 0 | 0 |

`cmp` on the PNGs reports no difference. ⚠️ The control that makes those rows mean anything: the
same plate with the card one code value brighter, `0x070a0e` → `0x070a0f`, reads `392bc43acbfc3f75`.

⚠️ **`lights` is the rig's schema and nothing else.** A scene drives `LightingRig` through the
`override()` path that already exists; there is no second lighting engine and a scene that needs a
light the rig cannot express is a request against `LightingRig`. Unknown light names, unknown
placement fields, `name`, an unknown `kind`, a `kind: 'exterior'` with no sky and a `kind:
'interior'` with no room are all refused with a `TypeError` — deny-by-default, because
`LightingRig` silently *drops* a fifth light and silently *ignores* a misspelled field.

✅ **`ground.albedo` and `ground.roughness` are now read, and they are read TWICE** (11.3):
`GroundContact` shades the plane the figure stands on with them, and a 500 m disc of the same albedo
goes into the environment bake so the lower hemisphere of the image-based light is a floor rather
than horizon sky. The second reading is the bounce that fills the underside of a jaw — measured
monotone across four albedos with a null control that reads a span of exactly 1.0000×.
✅ **`air.haze` is now read too** (11.5), and `room` is still carried and NOT consumed (11.4) — it is
named here rather than left to be discovered, because a field that is stored and ignored is a lie
unless it says so.

`haze` is an extinction toward the sky, LINEAR in the field: **`haze: 1` leaves the ground 95%
dissolved into the sky at 25 m**, so 0.5 is 50 m, `beach`'s shipped 0.25 is 100 m and `park`'s 0.18
is 139 m. It is installed as `scene.fogNode` — three's own hook — and only for a scene that has a
sky, so `studio` can never have air and stays byte-identical.

🎯 **And the haze's COLOUR is not a colour.** It is `scene.background` itself, re-read: the same
PMREM, sampled along the same view direction, through the same `backgroundIntensity` and
`backgroundBlurriness` three multiplies the backdrop by. Fully hazed ground and the sky behind it
are then the same expression of the same texture, which is what closes the horizon **by
construction** instead of by tuning — measured 96→9 and 122→9 code values across the seam on
`beach` and `park`. A CPU-computed horizon colour cannot do this: the sky's own horizon varies 43
code values across the frame because it brightens toward the sun.

⚠️ **An exterior's ground plane is three times wider than a studio's** — 36 framed heights against
12 — because a floor that has to reach a horizon is not the same object as a floor that only has to
leave frame. The two are one change: the extra extent without the dissolve is a longer matte line,
and the dissolve without the extent finishes 345 px too low. See
`GroundContact.EXTERIOR_GROUND_EXTENT_IN_HEIGHTS`.

⚠️ **A scene may not usefully override `rim` or `kicker` today.** A scene's `lights` are ABSOLUTE
numbers and `EDGE_LIGHTS` is authored per framing, so an absolute rim survives `setFraming('body')`
into a preset that authored a different value — the same 27.27% error `SCENE_LOOKS` records. `key`
and `fill` are safe because `FORM_LIGHTS` is identical in both presets. A scene that wants to move
the edge lights is a request for the per-framing `scales` axis a look already has, and it belongs to
11.7.

❓ **Open, and not decided by this item: what a scene does to `report().scene.lighting.calibrated`.**
That flag is `false` the moment exposure or ambient leave 1, which is correct and which will be
`false` for every scene past `studio` — true, and useless, because a flag that is false for eleven
of twelve scenes says nothing about which of them are in trouble. `docs/research/scene-system.md` §7
proposes gating the subject's *legibility* (ratios, ranks and masked statistics) instead. That is
punch-list 11.7's decision. `scene: 'studio'` reads exactly as the shipped default does.

⚠️ **11.2 widened the flag by one term and it is a real change: `calibrated` is now also `false`
whenever an image-based light is attached**, whatever the exposure resolved to. `docs/CHECKPOINT.md`
§7 decomposed the committed numbers at IBL **0.00%**, and `beach` measures the same forehead at
**27.03%** — so a scene that happened to resolve to exposure 1 would otherwise have reported `true`
about a picture the critic has never seen. A flag that can be true about a frame it does not
describe is worse than no flag.

`report().scene` carries `id` and `kind` beside the existing light and room readings, plus
`environment` (the sky's cube size, bake count, environment intensity, sun angles, derived sun
colour and CCT, and `attached` read off `stage.scene.environment`), `groundMaterial` (the floor's
actual albedo and roughness) and `lighting.ambientAttached` (whether the hemisphere light is in the
scene at all — GTAO moves it into the composite, an image-based light REPLACES it). `background`
reads `'sky-pmrem'` on an exterior, because what is behind the figure there is a texture and not a
colour. ⚠️ `id` and `kind` are the **description** — what the caller asked for — while everything
else in that block is read off the live scene graph.

**The five looks, and what each is for.** A look changes colour, key geometry and edge-light energy
— and *nothing else*. Measured through the real `LightingRig` at both framings on 2026-08-17,
against the two environment-spill ceilings `LightingRig.selftest.mjs` publishes:

| look | what it moves | key:fill portrait | key:fill body | behind:front | blue:red | for |
|---|---|---:|---:|---:|---:|---|
| `studio` | nothing — zero overrides | 1.3636 | 2.5000 | 1.7862 | 2.5144 | the default; the plate every gate number is stated on |
| `warm` | key `#ffe3c0`, fill `#f7cdb8`, kicker ×1.20 | 1.3636 | 2.5000 | 1.7862 | 2.3319 | a companion on a dark or neutral host UI |
| `cool` | key `#eef2ff`, fill `#dfe6f4` | 1.3636 | 2.5000 | 1.7862 | 3.3409 | an avatar inside cool product chrome |
| `soft` | key elevation 18°→10°, rim ×0.70, kicker ×0.70 | 1.3636 | 2.5000 | 1.5018 | 2.2325 | always-on, small in a corner |
| `dramatic` | key elevation 18°→30°, azimuth 42°→52°, rim ×1.25 | 1.3636 | 2.5000 | 1.7060 | 2.4218 | a reveal, an emphatic reply, a listening state |

🎯 **Every key:fill is bit-equal to its framing's own baseline, and that is the rule rather than an
outcome.** A look may not move `key.irradiance` or `fill.irradiance`: that pair is the G1 axis, and
a look that moved it would be a look that differs mainly in whether it passes the gate. Looks are
also *multipliers re-resolved per framing*, not absolutes — resolve `soft` once at portrait and the
body rim reads 11.2000 where the body preset authored 15.4000, 27.27% under, with nothing reporting
it. `setFraming` re-resolves before it moves the preset.

⚠️ **`cool` is deliberately parked short of a knee.** 3.3409 sits under `LightingRig.selftest.mjs`'s
own MUST-PASS row `#e8ecff` (3.4167, which renders 0.058% of the frame blue — *less* than shipped).
One step further, `#b0c0ff` — a tint that reads as white in a swatch — scores 6.2939 and renders
**57.37% of the frame saturated blue**. If you want a cooler avatar, reach for `lights` and measure.

⚠️ **`exposure` and `ambient` are exposed, and moving either invalidates every committed gate
number.** `report().scene.lighting.calibrated` goes `false` the moment they leave 1, so a plate
captured at anything but `true` is not comparable with the ones the critic has judged. `ambient` in
particular is the most fragile lever on the surface: gate G6 wants whole-image p0.1 luma in
0.004–0.016 and the shipped backdrop measures portrait **0.00420** and body **0.01597** — a
one-code-value window at both ends.

**`lights` is an escape hatch and `Avatar` validates it because the rig does not.** Measured through
the real `LightingRig` constructor — every one of these is accepted *in silence*:

| override | what the rig does with it |
|---|---|
| `key.irradiance: -3` | key E **−2.5500** — negative light |
| `fill.irradiance: 0` | designed key:fill **Infinity** |
| `key.shadowFraction: 2` | panel radiance **−3.9599** |
| `key.widthInHeights: 0` | panel radiance **Infinity** |
| `key.distanceInHeights: 0` | **NaN** into the scene graph |
| `{ fifth: {…} }` | silently dropped — 4 placements, no throw |
| `{ key: { irradianceX: 9 } }` | silently merged and ignored |

All seven are refused at `Avatar.create` with a `TypeError` naming the field *and* the accepted
range, deny-by-default on both the light name and the field name.

**Hair is `false` by default.** Style is an explicit choice: `bob01` supports five figure bakes,
while the chin-length `bob02` currently supports only `figure_g050` (`gender: 0.5` in the default
nearest-bake mode). Both use their own texture maps. The original `bob01` adds ~18.3 MiB of assets and a measured **+2.0 ms at p50** (🚩 not p95 — see the table below, where p95 does not resolve); and
`installHairVelocity` still patches `NodeMaterial.prototype.setupPosition` **process-wide**
without an uninstall. That mutation is declared in `report().hair.undisposable`, because
`disposal.leaked` is an own-property walk and cannot see a prototype patch. HairDynamics now
explicitly disposes its five compute nodes and eight private storage attributes during retirement;
same-renderer rebuilds keep one resource set. Disposal is idempotent, and retired solvers refuse
updates and readback. The attribute cleanup depends on Three r185's private manager; revalidate it
on upgrade. See [the GPU lifetime evidence](evidence/hair-disposal-2026-09-09.json).

With either supported hair style, `quality: 'auto'` resolves to `balanced` rather than `high` — a *structural*
decision (hair is on), not a frame budget. `quality: 'high'` still gets `high` and
`report().hair.frameBudgetWarning` says what it costs. The `fallback` tier gets a **static** groom
on the `cutout` arm: `configureHairMaterial` genuinely *throws* on `stochastic` + `alphaToCoverage`,
a stochastic arm needs a temporal resolve to integrate it, and WebGL2's compute cannot run the
solver's kernels. ⚠️ The third of those is a structural read of two sources and is **not**
browser-verified.

`report().hair.style` is the requested style; `loadedStyle` and `bake` identify the attached groom.
An unsupported identity bake leaves hair detached and supplies `unavailableReason`, so bob02 never
borrows another style's geometry or fits its g050 groom to a different skull. Switching back to
an available bake restores it. `resolveHairAssets(style, bakeName, assetBaseUrl)` exposes the same
availability and canonical external asset URLs without loading the groom. Bob02's frame cost is
unmeasured; the bob01 timing table below does not certify it.

Open `src/portrait.html` for a living bob02 portrait with expression, lighting, orbit, and pause
controls, plus a comparison with bob01. Style selection navigates to a new document to isolate the
renderer and its prototype state. This is a visual development preview, not a claim that the hair meets the final
AAA appearance target.

**What it actually costs, measured here rather than quoted.** In a GPU Chromium on 2026-08-17, tier
`high`, 1280×1600 dpr 1, submit-to-GPU-idle, 400 samples after 120 warm-up, bald and haired
*interleaved* three times each so session drift cancels:

| | p50 | p95 |
|---|---:|---:|
| bald | 10.7 / 9.9 | 21.5 / 29.6 |
| haired | 12.9 / 11.4 | 27.7 / 18.8 |

**≈ +2.0 ms at p50.** ⚠️ **p95 does not resolve** — the spread between two runs of the *same*
configuration is larger than the difference between configurations, so no p95 claim is made here.
The first bald repetition (p50 1.0) is a warm-up artefact and is excluded. Loading the groom costs
about **+150 ms** of `create()` (107.9 ms bald against 255.2 ms haired at 400×520), which is the
3.3 MB fetch, the rebind, the material and the solver's five compute pipelines.

Hair is also refused with `identity: { mode: 'live-preview' }`: a cross-faded identity resolves to
two bakes and the groom is cut per skull, so it would sit on a head it was not made for.

### 🔴 Transparent background — declared, diagnosed, and currently refused

```js
await Avatar.create( { canvas, background: 'transparent' } );
// TypeError: Avatar: background.colour: null (a transparent canvas) is not supported yet, and it
// is refused rather than presented as an opaque black rectangle. …
```

This is the option an embedder actually asks for, and it does **not** work today. It is refused with
the measurement attached rather than shipped returning a black rectangle. The renderer was always
configured for it — `alpha` defaults true, the clear alpha is already 0, the canvas is already
`premultiplied` — and `Grade.compose` now carries and premultiplies the frame alpha correctly
(`Grade.selftest.mjs` 68/68 on the change). Two *further* blockers were then found by rendering, in
a GPU Chromium on 2026-08-17, against a magenta page behind the canvas with a no-canvas control at
100% magenta:

| configuration | page shows through | figure |
|---|---:|---|
| `studio`, `high` | 0.00% | correct |
| `transparent`, `high` (TAAU + GTAO) | 0.00% | **black** |
| `transparent`, `balanced` (TAAU) | 0.00% | correct |
| `transparent`, `fallback` (MSAA + GTAO) | **41.63%** | **black** |

1. **The temporal resolve forces the frame alpha to 1.** Measured by making the grade *display* its
   own alpha: `fallback` reads 41.63% of the frame at alpha 0 and 57.80% at alpha 1 — exactly right
   — while `high` reads **100% at alpha 1**. The repair is in `TAAUNode`/`TRAANode`, which are
   three's; `render/Grade.js` is ready for the day it lands.
2. **Ground-truth occlusion blacks out a frame with nothing at background depth.** Isolated to the
   card alone: `backdrop: 0x000000` — a black card — renders the figure perfectly, and
   `backdrop: false` renders the *whole frame* black on both tiers that carry GTAO. Not the card's
   presence in the draw list either: scaling it to 0.001 and moving it off-screen reproduces the
   black frame exactly.

`fallback` has no temporal resolve and `balanced` has no occlusion; there is no tier with neither.

**What you can do today:** `background: { backdrop: false }` *is* supported and renders correctly —
it resolves `quality: 'auto'` to `balanced` for blocker 2, and refuses an explicit `high`/`fallback`
in words. Set the clear colour to whatever your page uses (`background: 0x101820`) and composite
against that.

⚠️ **`ground: false` is a documented downgrade, not a free win.** 60% of the light landing beside a
sole comes from two `RectAreaLight`s that cannot cast a shadow at all, which is why `GroundContact`
occludes analytically. Remove the plane and the figure floats. A shadow-catcher that writes alpha is
a follow-up item and is not claimed here.

⚠️ **Composite before you judge, when it does land.** `tools/critic/measure.mjs` refuses a plate
where more than 1% of pixels are not opaque — *"which makes the grade gates (G5, G6) meaningless."*
So a transparent capture must be composited over `#08080a` before the critic runs, and the
transparent plate and the studio plate are then compared on the same pixels. That rule is declared
now, ahead of the option, so the two cannot arrive in different rounds.

### The verbs

| call | what it does |
|---|---|
| `avatar.feel( 'joy', 0.8 )` | Push an emotion by name. Any key of `ANCHOR_SETS` — WASABI's eight drift states plus ALMA's twenty-four OCC appraisals. It both triggers the emotion and moves the PAD point to that emotion's nearest anchor, because a trigger alone is geometrically gated and would often do nothing. Chains. |
| `avatar.feel( { pleasure, arousal, dominance } )` | Push a PAD vector; each axis on [-1, 1], at least one must be a finite number. |
| `await avatar.say( text )` | Drives the face and the body from the sentence. See the limit below. |
| `await avatar.say( text, { timeline, at, prosody } )` | …and the mouth, from a TTS viseme timeline. |
| `avatar.update( dt )` | One simulation frame plus one render. **Only under `autoStart: false`** — it throws otherwise rather than let the simulation advance twice per displayed frame. |
| `await avatar.setIdentity( { gender: 1 } )` | Swap the bake live. Async because a new bake means a new motion target, and the layers keep their phase so nothing visibly restarts. |
| `avatar.setFraming( 'body' )` | Re-frame the camera and re-aim the rig between portrait and body, without touching the motion stack. Re-resolves the look against the new framing first. Chains. |
| `avatar.setLighting( 'dramatic' )` | Change the look live. Partial-merges over what is current, so `{ exposure: 1.2 }` keeps the look. Re-aims the rig — `LightingRig.override()` solves and never aims, so the eye shader would otherwise keep pointing at where the key used to be. Chains. |
| `avatar.setBackground( 0x101820 )` | Change the room live: clear colour, card level, card and ground removal. ⚠️ One-way for the card and the plane — it can remove them and cannot put them back, and asking is refused in words rather than ignored. Removing the card is refused on a tier carrying ground-truth occlusion, for the reason below. Chains. |
| `avatar.report()` | The census, the affect state, the tier, the framing and the leak check, as a plain object. |
| `avatar.dispose()` | Releases the GPU, the layers and the frame loop. Idempotent; every verb afterwards throws by name. |

`report()` is what a HUD and a gate both read. `quality.backend` is read off the renderer rather
than off the request; `subsystems` is counted off the scene graph rather than off the options that
were supposed to put things there, so a subsystem that failed to attach reports as absent; `scene`
reads the background, the card's emissive level and every lighting number off the live scene graph
and the live rig for the same reason; `hair` is `null` when none was asked for and carries
`attached: false` when one was asked for and did not land, which is the case a boolean could not
carry; and `disposal.leaked` is a deny-by-default walk of the instance's own handles, empty after a
clean `dispose()`.

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

**Hashed production assets work as of the 2026-09-08 restart.** Previously, `Avatar`
parsed the selected GLB filename to identify its bake. Vite's hashed name then missed the skin-map
lookup and requested `/assets/undefined`. The runtime now takes the bake from the selected identity
plan's `gender`, preserves bundled asset URLs, and supplies curvature, cavity, and region maps
explicitly. Region-map inference from a hashed curvature filename had also silently omitted that
map. External hosting uses the canonical figure and map filenames under the supplied base URLs.

A default hashed `build:pages` was loaded in Chromium/WebGPU and the portrait rendered with both
`skin.hasRegionMap` and `skin.hasCavityMap` true. Turning off asset hashing is no longer required
for the `Avatar` path. This does not certify other pages that construct materials themselves.
See [the restart checkpoint](RESTART-2026-09-08.md) for the evidence and verification limits.

**Not wired into `Avatar` yet, and named so the absence is visible:** the wardrobe (Phase 9) and
identity detail targets (Phase 10). Both exist and are gated; both are opt-in on `alive.html` for
reasons that still hold.

**What the node gate cannot see about the three scene options, said plainly.**
`packages/core/src/Avatar.selftest.mjs` drives the real `LightingRig` and the real resolvers, and it
prints its blind spots on every run. Four of them belong to this section: whether the alpha is
actually correct on the canvas (a node graph cannot be compiled under node, and whether
`TAAUNode`/`TRAANode` preserve `.a` through the temporal resolve was **read, not executed**);
whether the premultiply matches the premultiplied canvas in a real composite; the numeric half of
the re-aim clause, which needs an eye material; and whether the groom *renders* at all. The groom's
rig mapping was measured out-of-band — 53 joints, 0 absent from the figure rig, on all five bakes —
but the picture was not.

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
| `assets/` | Built artefacts — figures, grooms, wardrobe. **Committed, through git-lfs**; rebuild with `npm run figure`. |
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
