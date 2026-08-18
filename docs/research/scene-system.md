# Scene system — research and design

**Requirement R20, `docs/BRIEF.md`.** The user's words are quoted verbatim there and are the source;
this file is interpretation and loses to it.

> Think typical situations through someone's day but also include fun scenes like vacations, going
> to the beach, out to dinner, etc. We don't need a huge corpus here but its important you
> understand the intent so you build into the goal.

---

## 1. What was measured before anything was designed

Read off the tree on 2026-08-17, not recalled:

| fact | where |
|---|---|
| A "scene" today is a clear colour, one emissive card at 1.9 m, and a contact shadow | `Avatar.js` `BACKDROP_EMISSIVE`, `BACKDROP_DISTANCE_METRES`, `GroundContact.js` |
| Three background presets exist: `studio`, `void`, `transparent` — and `transparent` is refused | `Avatar.js` `BACKGROUND_PRESETS`, `docs/API.md` §"Transparent background" |
| `scene.environment` and `environmentNode` are both **null**. IBL contributes measured **0.00%** | `docs/CHECKPOINT.md` §7 light-path table |
| The rig is 2 RectAreaLights + 2 edge lights + a hemisphere, all in SUBJECT-RELATIVE units | `LightingRig.js` `FORM_LIGHTS`, `EDGE_LIGHTS`, `AMBIENT` |
| Light placement is already parametric: azimuth, elevation, distanceInHeights, widthInHeights, heightInHeights, irradiance, colour, shadowFraction | `LightingRig.js:414` |
| `LightingRig.override()` exists and re-solves without re-aiming; `avatar.setLighting()` partial-merges over it | `docs/API.md` |
| Every committed gate number was measured under the studio rig, and `report().scene.lighting.calibrated` goes false when exposure or ambient leave 1 | `docs/API.md`, `docs/PROGRESS.md` |
| **`SkyMesh` — a Preetham analytic sky written in TSL for WebGPURenderer — ships in the installed three r185** | `node_modules/three/examples/jsm/objects/SkyMesh.js` |
| `GroundedSkybox` and `Sky` (the WebGL sibling) ship beside it | same directory |

🎯 **The last row is the finding that shaped this design.** The single most expensive part of an
outdoor scene — a physically-plausible sky that produces both the background pixels and the image-
based light — is already installed, MIT, in TSL, targeting our exact renderer, driven by five
uniforms (`turbidity`, `rayleigh`, `mieCoefficient`, `mieDirectionalG`, `sunPosition`). Its own
docstring even records the gotcha for our use case: hide the sun disc while generating an
environment map, then re-enable it for the backdrop. **Reuse before build**, and this one is free.

---

## 2. The intent, decoded — and the ordering in the request is the design

The user named the ordinary places FIRST and the memorable ones SECOND, and that ordering is not
incidental. A person's day is mostly four or five rooms; a beach is memorable precisely *because* it
is rare. An avatar that can only ever stand on a beach is as wrong as one that can only stand in a
photographic studio — which is what it can do today.

**"We don't need a huge corpus here" is a constraint, not a hedge.** It rules out the obvious
approach (author many scenes) and forces the good one: **a scene is a composable description, not a
downloaded set.**

### The three constraints that were binding before any art

1. **The LFS budget.** `assets/` is 232 MB against a free tier of 1 GB storage and 1 GB/month
   bandwidth — about four clones a month. Three downloaded HDRIs at 8 MB each and one furnished
   room would end that. **Scenes must be procedural.** This is the repo's standing "build it
   ourselves" preference arriving as an actual engineering limit rather than a taste.
2. **The calibrated gates.** A scene changes the light by definition, and every measured gate in
   `docs/PROGRESS.md` was taken under the studio rig. Silently re-lighting the figure retires the
   whole measured record without a single failing test. §7 below is the answer.
3. **The frame is mostly avatar.** At portrait framing the figure owns most of the pixels. Whatever
   is behind them is a minority of the image — which is the reason the next section is the load-
   bearing one.

---

## 3. 🎯 A scene is mostly LIGHT, and the geometry is the cheap part

**The place is carried by the light falling on the subject, not by the pixels behind them.**

A beach at noon is not sand pixels. It is a hard, small, nearly overhead source; a very large, very
blue fill arriving from the entire upper hemisphere; a warm bounce up from sand at roughly 0.35
albedo, which is why beach portraits fill the underside of the jaw; and a high exposure. A
candlelit restaurant is a small warm source *below* eye level with steep inverse-square falloff,
almost no fill, and a near-black surround. Swap those two light descriptions behind the same grey
card and a viewer will name both places. Swap the backgrounds and keep studio light and they will
name neither.

This is corroborated inside the project rather than asserted: across every blind-critic round, the
findings that reproduced were about light, and `LightingRig.js` is the most heavily measured file in
the repository. The critic has been telling us for rounds that light is what it reads.

**So a scene is defined in this order of value per byte:**

| layer | what it is | bytes | why it is where it is |
|---|---|---:|---|
| 1. **Light** | the rig's own schema with different numbers, plus exposure | 0 | carries the place; already parametric; already gated |
| 2. **Environment** | an analytic sky, or a synthesised room, → PMREM → `scene.environment` | 0 | IBL is currently measured at 0.00% of the frame; it is the largest missing term in the renderer |
| 3. **Backdrop** | the same environment drawn behind the figure, defocused | 0 | replaces the emissive card |
| 4. **Ground** | a plane with the scene's own albedo and roughness, feeding bounce and contact | 0 | `GroundContact.js` already exists |
| 5. **Air** | height fog / haze, one depth cue | 0 | separates figure from distance for almost nothing |
| 6. **Set** | two or three procedural silhouettes at the right depth: horizon, table edge, window frame, doorway | ~0 | the last 10%, and the first thing to cut |

Nothing on this list is a downloaded asset. That is the point.

---

## 4. The mechanism, and the one idea that unifies indoor and outdoor

### Outdoor is solved by what is already installed

```
sun( elevation, azimuth )  ->  SkyMesh uniforms  ->  render to cube  ->  PMREM
                                                  |                       |
                                                  v                       v
                                            scene.background        scene.environment
                                                  |
                            key light aimed along the sun, colour and irradiance
                            derived from the SAME elevation
```

Five numbers produce beach, park, street, balcony, rooftop and garden, at any hour, in any weather
that turbidity can express. Weather is `turbidity` and `mieCoefficient`; hour is `sunPosition`.

### 🎯 Indoor is the same model seen through a rectangle

There is no analytic interior daylight model and we are not going to write one. But an interior
environment is a **box of emissive faces**: walls at a plausible albedo lit by what comes in, a
ceiling fixture at its own colour temperature, and — the part that matters — **a window whose
radiance is sampled from the very same sky model at the very same sun position.**

A morning kitchen is the Preetham sky at 15° elevation, seen through a rectangle, bounced once off
a warm wall. An evening living room is the same sky at −4° plus a 2700 K lamp. **One model serves
both families**, an indoor scene inherits time-of-day for free, and the two families cannot drift
apart because there is only one sun.

This is the transferable idea in the whole design, and it is worth stating plainly because it is
what keeps the corpus small: *the window is a portal, not a texture.*

### A scene is therefore a data structure, not a file

```js
{
  id: 'kitchen',
  kind: 'interior',
  sun:    { elevationDegrees: 15, azimuthDegrees: -30, turbidity: 2.4 },
  room:   { wall: 0xd8cfc2, floor: 0x6b5443, ceiling: 0xe8e4dc,
            window: { azimuthDegrees: -30, widthInHeights: 1.4, heightInHeights: 1.8 },
            fixtures: [ { kelvin: 2900, irradiance: 0.6, elevationDegrees: 72 } ] },
  lights: { /* LightingRig overrides, in the schema FORM_LIGHTS already uses */ },
  ground: { albedo: 0x6b5443, roughness: 0.55 },
  air:    { haze: 0.0 },
  set:    [ 'counter-edge', 'window-frame' ],
  exposure: 1.0
}
```

Everything in it is a number or a name. Nothing in it is an asset.

---

## 5. Composability is the answer to "we don't need a huge corpus"

**scene = place × time × weather.** Twelve places × six times of day is seventy-two looks from
twelve definitions, and the time axis is *one uniform* — `sunPosition` — that the light, the sky,
the window and the exposure all read.

That is the difference between a corpus and a system, and it is what "build into the goal" asks for.

---

## 6. The corpus — ordinary first, because the request put it first

**The day** (built first, and the ones that will be used a thousand times more often):

| id | the moment | what carries it |
|---|---|---|
| `bedroom-morning` | waking, first conversation of the day | low sun through a near window, warm bounce, very soft fill, high key-to-fill ratio |
| `kitchen` | coffee, the day starting | window daylight plus a warm interior bounce, mid exposure |
| `desk` | work, the longest-occupied scene in a real day | window side light plus a cool screen fill from the front-below — the one scene lit partly from the camera's own side |
| `living-room` | evening, unwinding | 2700 K lamp key, no daylight, deep falloff, TV bounce as an optional cool secondary |
| `street` | commute, outdoors, moving | overcast-capable sky, high ambient, low contrast, building bounce |
| `bedside-night` | late, quiet, the day ending | one small warm source below eye level, near-black surround, lowest exposure in the set |

**The occasions** (the ones a person remembers, and the ones the user named):

| id | the moment | what carries it |
|---|---|---|
| `beach` | vacation, midday | hard high sun, whole-sky blue fill, warm sand bounce from below, highest exposure |
| `restaurant` | out to dinner | candle key below eye level, warm pendant behind, everything else black; the most flattering and most difficult light in the set |
| `cafe` | meeting, daytime, indoors-with-a-window | large soft window key, cool, high ratio of fill |
| `hotel-balcony` | vacation, golden hour | low warm sun almost behind, strong rim, sky fill from the open side |
| `park` | a walk, dappled | sun through broken cover — the only scene with a broken key |
| `rooftop-evening` | a party, after dark | string lights as multiple small warm sources, sky as a dim cool fill |

Twelve. The user asked for no more.

---

## 7. 🚩 The gate problem, and the answer that makes the scene system measurable

Every measured gate in this project assumes the studio rig. A scene changes the light, so a scene
invalidates them. Three options were considered and only one survives:

- ~~Re-measure every gate per scene~~ — twelve times the gate surface, and the numbers would be
  fitted to art direction rather than to anything.
- ~~Let scenes go uncalibrated~~ — this is the current behaviour of `exposure`, and it means the
  project's whole measured record silently stops applying the moment anyone uses the feature.
- ✅ **Gate the SUBJECT'S LEGIBILITY, not the absolute pixel values.**

🎯 **A scene gate should ask "can you still read the person?" — because that is the only property
that must hold in a studio, on a beach and by candlelight alike.** Candidates, each of which is a
ratio or a rank and therefore scene-invariant by construction:

- the face's median luma sits inside a band relative to the frame's own exposure, not to a constant;
- key-to-fill ratio stays inside a legibility band — a scene may be dramatic, it may not be unreadable;
- the silhouette separates: the figure's edge luma differs from the background it is against by a
  measurable margin, on **every** side (this is what the rim exists for, and it is the one thing a
  bright background can destroy);
- no more than G5's share of subject pixels clip;
- eyes carry a catchlight in every scene — a scene that removes it removes the thing that makes a
  face alive, and `EyeCatchlight.js` exists precisely because of that.

⚠️ **And `studio` remains the calibration reference and keeps its committed numbers.** It is the
control. Every other scene is measured against the ratios above and declares its own expected
ranges in `docs/RED-GATES.md` if it cannot meet one.

⚠️ **Do not write a scene gate that averages over the whole frame.** This project has shipped eight
statistics that were structurally blind to the defect they were aimed at, and a whole-frame mean is
how six of them went wrong. Every clause above is either a ratio, a rank, or restricted to a mask.

---

## 8. Agency — the scene is chosen the way the wardrobe is chosen

R18 established the pattern and it carries here without modification: the AI picks, the user can
pin, and an AI able to express a preference even when overruled is *"the difference between a puppet
and a someone."*

So the scene API mirrors the wardrobe API rather than inventing a second idiom:

- `avatar.setScene( 'kitchen' )` — explicit, from the user or the agent.
- `avatar.scene.suggest()` — the agent proposes from local time of day, its own affect state, and
  what is being talked about. Morning and a fresh session is `kitchen`; a long working session is
  `desk`; high pleasure and low arousal late in the evening is `living-room`.
- `avatar.scene.pin( id )` — the user fixes it, exactly as they can pin an outfit.

**Time of day should default to the USER'S local clock.** An avatar standing in noon sunlight at
11 p.m. is uncanny in a way no amount of shading quality repairs, and the fix is one `Date`.

---

## 9. What this deliberately does NOT build

Recorded so it is not relitigated:

- **No downloaded HDRIs or set meshes.** §2's LFS constraint. If a scene cannot be described in
  numbers, it does not ship yet.
- **No level editor, no furniture library, no navigable space.** The camera frames a person. Nothing
  outside the frame needs to exist.
- **No weather simulation.** Rain and snow are particle work and belong to a later phase if ever;
  overcast is `turbidity` and costs nothing.
- **No baked lighting.** Everything is solved at scene-change time from the parameters.
- **No second lighting engine.** Scenes drive `LightingRig` through the override path that already
  exists. A scene that needs a light the rig cannot express is a request against `LightingRig`, not
  a reason to fork it.

---

## 10. Phasing

Ordered so that each step puts something on the screen a person can judge.

| step | what lands | why here |
|---|---|---|
| 11.1 | `Scene.js` — the data structure, the resolver, and `studio` re-expressed as a scene | the refactor that proves the shape without changing a pixel; `studio` must stay byte-identical |
| 11.2 | **Sky + environment.** `SkyMesh` → PMREM → `scene.environment` + `scene.background` | the largest missing term in the renderer (IBL is 0.00% today) and it lands three outdoor scenes at once |
| 11.3 | Ground plane with per-scene albedo, bounce, and the existing contact shadow | the underside of the jaw is most of what says "outdoors" |
| 11.4 | The interior model: emissive room box with a window sampling the same sky | unlocks six of the twelve |
| 11.5 | Air — height fog / haze as one depth cue | cheapest separation in the list |
| 11.6 | The twelve scenes authored, `setScene()` / `suggest()` / `pin()` on the API | the deliverable |
| 11.7 | Scene legibility gates per §7, and `studio` declared the calibration control | so the record survives the feature |
| 11.8 | Set silhouettes — horizon, table edge, window frame, doorway | the last 10%, first to cut |

⏭️ **11.2 before 11.1 is tempting and would be wrong.** Landing the sky first means `studio` is
re-expressed as a scene *after* the code has grown around an outdoor case, and the byte-identical
control on `studio` — the one thing that proves the refactor changed nothing — is no longer
available. The same argument the hair style table is being built under.
