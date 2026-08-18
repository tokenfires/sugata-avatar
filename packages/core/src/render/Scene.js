/**
 * Scene — the PLACE the figure stands in, as a plain object of numbers and names.
 *
 * Punch-list 11.1, requirement **R20** in `docs/BRIEF.md`: *"so the AI and users can provide an
 * environment for their avatar … typical situations through someone's day but also … vacations,
 * going to the beach, out to dinner."* The design, its measurements and the three constraints that
 * were binding before any art live in `docs/research/scene-system.md`.
 *
 * ## 🎯 A SCENE IS MOSTLY LIGHT, AND THAT IS WHY THIS FILE IS A TABLE AND NOT A LOADER
 *
 * The load-bearing claim of the design, and the one that decides this file's shape: **the place is
 * carried by the light falling on the subject, not by the pixels behind them.** A beach at noon is
 * a hard nearly-overhead source, a very large blue fill from the whole upper hemisphere, a warm
 * bounce off sand at ~0.35 albedo, and a high exposure. A candlelit restaurant is a small warm
 * source BELOW eye level with steep falloff, almost no fill, and a near-black surround. Swap those
 * two light descriptions behind the same grey card and a viewer names both places; swap the
 * backgrounds and keep studio light and they name neither.
 *
 * Which is corroborated inside this project rather than asserted: across every blind-critic round
 * the findings that reproduced were about light, and `LightingRig.js` is the most heavily measured
 * file in the repository.
 *
 * So a scene is defined in this order of value per byte, and **nothing on the list is a downloaded
 * asset** — `assets/` is already 232 MB against git-LFS's free 1 GB/month, so procedural is an
 * engineering constraint here rather than a taste:
 *
 *   | layer | what it is | why it is where it is |
 *   |---|---|---|
 *   | 1. light | the rig's OWN schema with different numbers, plus exposure | carries the place; already parametric; already gated |
 *   | 2. environment | analytic sky or synthesised room → PMREM → `scene.environment` | IBL is measured at **0.00%** of a forehead pixel today (`docs/CHECKPOINT.md` §7) |
 *   | 3. backdrop | the same environment drawn behind the figure | replaces the emissive card |
 *   | 4. ground | a plane with the scene's own albedo and roughness | `GroundContact.js` already exists |
 *   | 5. air | height fog / haze, one depth cue | cheapest separation there is |
 *   | 6. set | two or three procedural silhouettes | the last 10%, and the first thing to cut |
 *
 * ## 🚩 THIS FILE IS A DESCRIPTION. IT IS NOT A LIGHTING ENGINE, AND THAT IS AN INSTRUCTION
 *
 * The punch list forbids a second lighting engine in as many words: *"a scene that needs a light
 * `LightingRig` cannot express is a request against `LightingRig`, not a fork of it."* So `lights`
 * below is **the schema `LightingRig.FORM_LIGHTS` already uses** — `azimuthDegrees`,
 * `elevationDegrees`, `distanceInHeights`, `widthInHeights`, `heightInHeights`, `irradiance`,
 * `colour`, `shadowFraction`, all SUBJECT-RELATIVE — keyed by the rig's own light names, so a
 * scene reaches the rig through the `override()` path that already exists and through nothing else.
 * This module imports nothing, constructs nothing, and touches no scene graph. It is a table and a
 * resolver, and every consumer of it is somewhere else.
 *
 * ## WHAT 11.1 IS AND WHAT IT DELIBERATELY IS NOT
 *
 * 11.1 is the SHAPE, landed before any new look, because `studio` re-expressed as a scene is the
 * only byte-identical control this refactor will ever get. The design records why the tempting
 * order is the wrong one: land the sky first and `studio` becomes a scene *after* the code has
 * grown around an outdoor case, and the control is gone.
 *
 * So `sun`, `sky` and `room` are declared here and are `null` in all three entries. They are not
 * placeholders for their own sake — they are the fields 11.2 and 11.4 fill, named now so that the
 * consumer written against this shape does not change when they arrive. Everything that IS
 * populated below is a value this repository already ships and can already be measured.
 *
 * ⚠️ **NOTHING IN THIS FILE MAY CHANGE A PIXEL AT `studio`.** Every literal here was read off
 * `Avatar.js` at HEAD `f65330d` and the gate is a plate, not a review: see `Scene.selftest.mjs`
 * clause A and the ```plates evidence in the round summary.
 */

// --- the studio literals, which are the shipped plate ---------------------------------------------
//
// 🚩 THESE THREE MOVED HERE FROM `Avatar.js` AND THEY ARE THE WHOLE REASON 11.1 CAN BE PROVED FREE.
// They are the only numbers in this repository that decide what is behind the figure, they are
// imported by `Avatar.js` rather than copied, and `Scene.selftest.mjs` clause A holds the `studio`
// scene to them. A second copy of any of them is how a refactor moves a pixel while every gate
// reads green.

/**
 * The emissive card behind the figure.
 *
 * The look spec wants a backdrop 1.5–2.0 stops under the subject: a black void is as wrong as a
 * blown one, because the silhouette then has nothing to separate from and the head reads as a
 * cut-out. Base colour BLACK with the whole value in `emissive`, so the card states its own
 * exposure and the rig cannot touch it — a RectAreaLight lights only the half-space in front of its
 * own plane, and across a large flat card the rim and kicker would draw a straight-edged wedge.
 *
 * ⚠️ `0x070a0e` IS A ONE-CODE-VALUE WINDOW AND SHOULD NOT BE READ AS A COMFORTABLE CONSTANT. Gate
 * G6 asks for a whole-image 0.1st-percentile luma of 0.004–0.016; measured one flag apart at
 * 900x1200, `0x050709` reads portrait 0.00393 (0.00007 UNDER the floor) and this value reads
 * portrait 0.00420 / body 0.01597, both in band, with body clearing the ceiling by 0.00003. The
 * full table is at `alive.js:420-450`.
 *
 * 🎯 AND IT IS ONE CODE VALUE IN THE PLATE TOO, WHICH IS WHAT MAKES THE 11.1 GATE ABLE TO GO RED.
 * Measured 2026-08-17 through `tools/critic/avatar-plate.html`, 900×1200, 1 step at 60 fps, seed 1,
 * frozen, `background: { backdrop: … }` the only thing moved:
 *
 *     0x070a0e (shipped)   sha fac62c50d56590fb   2 loads, 1/1 pairs bit-identical, worst 0 px
 *     0x070a0f (+1 blue)   sha 392bc43acbfc3f75   2 loads, 1/1 pairs bit-identical, worst 0 px
 *
 * A plate that cannot see a one-code-value change to this constant would be a control that proves
 * nothing about a refactor of the file that owns it. This one sees it.
 */
export const BACKDROP_EMISSIVE = 0x070a0e;

/**
 * How far behind the framing focus the card stands, in metres.
 *
 * ⚠️ It is a DISTANCE FROM THE FOCUS and not a world position — `Avatar` re-places the card on
 * every `setFraming`, because a card pinned in world space walks out of a body frame.
 */
export const BACKDROP_DISTANCE_METRES = 1.9;

/** The scene clear colour the shipped plate is measured on. `Avatar.js`'s own literal, named. */
export const SCENE_CLEAR_COLOUR = 0x08080a;

// --- the schema ----------------------------------------------------------------------------------

/**
 * The three families a scene can belong to, and the field each one is expected to populate.
 *
 *   `studio`    no sun and no room — a card, a rig and a floor. The calibration control.
 *   `exterior`  carries `sun` and `sky`; 11.2 turns those into `SkyMesh` uniforms and a PMREM.
 *   `interior`  carries `sun` and `room`; 11.4's window samples the SAME sky at the SAME sun.
 *
 * 🎯 The last line is the idea that keeps the corpus small and it is worth stating where the enum
 * is defined: **the window is a portal, not a texture.** One sun serves both outdoor and indoor
 * families, an interior inherits time-of-day for free, and the two cannot drift apart because
 * there is only ever one sun.
 */
export const SCENE_KINDS = Object.freeze( [ 'studio', 'interior', 'exterior' ] );

/**
 * Every field a scene description may carry. Deny-by-default: `resolveScene` refuses an unknown
 * key rather than dropping it.
 *
 * 🚩 SILENT DROPS ARE THE FAILURE MODE THIS LIST EXISTS AGAINST, and it is not hypothetical here.
 * `Avatar.js`'s own `PLACEMENT_FIELDS` block records the measurement: handed `{ fifth: { … } }`
 * the real `LightingRig` builds four placements and throws nothing, and handed
 * `{ key: { irradianceX: 9 } }` it merges the field and ignores it. A scene table with a typo'd
 * key would be a scene that renders as `studio` and reports itself as something else.
 */
export const SCENE_FIELDS = Object.freeze( [
    'id', 'kind', 'sun', 'sky', 'room', 'lights', 'scales', 'ground', 'air', 'exposure', 'background',
    'framing'
] );

/** The rig's own light names. A scene may address these and no others — see `SCENES` below. */
export const SCENE_LIGHT_NAMES = Object.freeze( [ 'key', 'fill', 'rim', 'kicker' ] );

/**
 * The placement fields a scene's `lights` entry may carry — `LightingRig.FORM_LIGHTS`' own schema,
 * listed here so `resolveScene` can refuse a misspelling at the table rather than at the rig.
 *
 * ⚠️ **`name` IS NOT ON THIS LIST AND MUST NOT BE.** `Avatar.aimRigAt` finds the key by
 * `placement.name === 'key'` to hand the eye shader its direction, and `LightingRig.selftest.mjs`'s
 * spill partition uses the names as its expected ANSWER. A rename is free at the rig and breaks
 * both.
 *
 * ⚠️ And the ranges are NOT re-declared here. `Avatar.js`'s `PLACEMENT_FIELDS` carries them with
 * the seven measured pathologies that motivated each one, and a scene's overrides go through
 * `Avatar.resolveLightOverrides` on the way to the rig — so a scene gets the same refusals an
 * embedder does, from the same table. Two range tables would be two claims and one gate.
 */
export const SCENE_PLACEMENT_FIELDS = Object.freeze( [
    'azimuthDegrees', 'elevationDegrees', 'distanceInHeights', 'widthInHeights', 'heightInHeights',
    'irradiance', 'colour', 'shadowFraction'
] );

/**
 * The placement fields a scene's `scales` entry may carry — the numeric half of the list above.
 *
 * ## 🎯 WHY A SCENE NEEDS A MULTIPLIER AXIS AT ALL, AND IT IS A MEASUREMENT RATHER THAN A TASTE
 *
 * `lights` above is ABSOLUTE and `EDGE_LIGHTS` is authored PER FRAMING, so an absolute edge light
 * written into a scene is correct at the crop it was solved on and wrong at the other one. The
 * shipped rim is **16** at portrait and **22** at body (`LightingRig.js`' `EDGE_LIGHTS`), so a
 * scene that wrote `rim: { irradiance: 2.6 }` would hold at portrait and, through
 * `setFraming( 'body' )`, would deliver 2.6 where the body preset authored 22 — 88.2% under, with
 * nothing reporting it. That is the same defect `SCENE_LOOKS` records for looks in `Avatar.js`
 * ("soft resolved at portrait leaves the body rim reading 11.2000 where the body preset authored
 * 15.4000") and it is why a look is a multiplier and not a number.
 *
 * So a scene gets the axis a look already has, in the same shape and through the same resolution:
 * `scales.rim.irradiance = 0.1625` means *"whatever THIS framing's table authored for the rim,
 * times 0.1625"* — 2.60 at portrait and 3.575 at body, re-resolved by `setFraming` before
 * `setPreset`, never stored as an absolute.
 *
 * ⚠️ **`colour` IS NOT ON THIS LIST AND CANNOT BE.** A hex is not a scalar: 0xffeeda × 0.5 is
 * 0x7f776d in integer arithmetic, which is a different HUE as well as a different level, and the
 * one thing this project has measured repeatedly is that hue on skin is not a free parameter (the
 * matched-panel-luminance table in `LightingRig.js` moves the shadow cheek 14× between a blue and
 * a neutral panel of the SAME luminance). A scene that wants a different colour states it in
 * `lights`, where it is absolute and where `FORM_LIGHTS` being identical at both framings makes an
 * absolute safe.
 *
 * ⚠️ And unlike a LOOK, a scene MAY scale `key` and `fill` irradiance. A look may not, because a
 * look is a multiplier on the studio rig and moving that pair is moving the G1 axis with no other
 * change; a scene has already moved it — `beach` sets `fill.irradiance` outright — because the
 * light is what a scene IS. What a scene owes instead is 11.7's legibility gate, not a prohibition.
 */
export const SCENE_SCALE_FIELDS = Object.freeze( [
    'azimuthDegrees', 'elevationDegrees', 'distanceInHeights', 'widthInHeights', 'heightInHeights',
    'irradiance', 'shadowFraction'
] );

// --- the sun and the sky, which are punch-list 11.2's half of the description ----------------------
//
// 🚩 THESE TWO TABLES ARE THE DESCRIPTION AND `render/SkyEnvironment.js` IS THE ENGINE, and the
// dependency runs that way round rather than the other. `SkyEnvironment` imports `SKY_DEFAULTS` from
// here; nothing here imports it, because this file must stay runnable with no three.js and no GPU
// (clause E4). What that buys is a real one: the fields a scene may carry are checked by a gate that
// needs no adapter, and the engine cannot grow a fifth uniform the table has never heard of.

/**
 * The fields a scene's `sun` may carry.
 *
 * `elevationDegrees` and `azimuthDegrees` are WORLD angles — azimuth about +Y from +Z, positive
 * toward +X, three's own sky-example convention. ⚠️ **They are NOT `LightingRig`'s azimuth**, which
 * is measured from the camera so a rig follows it; `SkyEnvironment.rigAzimuthForSun()` converts, and
 * copying a world azimuth straight into `key.azimuthDegrees` is the exact defect 11.2 exists to
 * prevent — a key that swings when the camera orbits while the sky stands still.
 *
 * `occlusion` is the fraction of the SOLAR DISC hidden by something local the sky model knows
 * nothing about: leaf cover, an awning, a passing cloud. It scales the derived key and leaves the
 * sky alone, because what stands between the subject and the sun does not stand between the subject
 * and the rest of the hemisphere. `park` is what it exists for.
 */
export const SUN_FIELDS = Object.freeze( [ 'elevationDegrees', 'azimuthDegrees', 'occlusion' ] );

/**
 * The `SkyMesh` uniforms a scene may move, and what they mean.
 *
 *   `turbidity`       haze. 2 is a clean day; 6 reads as coastal or urban murk.
 *   `rayleigh`        the blue. Below 1 the sky greys out; the model's own default is 1.
 *   `mieCoefficient`  the aerosol load, i.e. how big the glow around the sun is.
 *   `mieDirectionalG` how tightly that glow hugs the sun.
 *
 * 🚩 **`cloudCoverage` IS DELIBERATELY NOT ON THIS LIST AND THE REASON IS A MEASUREMENT.** `SkyMesh`
 * ships it at 0.4 and drives the noise from the TSL `time` node, so an environment baked with clouds
 * on is a DIFFERENT environment on every bake: no plate in this repository would be reproducible and
 * a scene's look would depend on how long the page had been open. `SkyEnvironment` forces it to
 * zero. A scene system that wants weather has to decide what it does about the clock first, and that
 * is not this item.
 */
export const SKY_DEFAULTS = Object.freeze( {
    turbidity: 2,
    rayleigh: 1,
    mieCoefficient: 0.005,
    mieDirectionalG: 0.8
} );

/** The fields a scene's `sky` may carry. Deny-by-default, same as everything else here. */
export const SKY_FIELDS = Object.freeze( Object.keys( SKY_DEFAULTS ) );

// --- the room, which is punch-list 11.4's half of the description ---------------------------------
//
// 🎯 AN INTERIOR CARRIES **`sun`, `sky` AND `room`**, AND THE FIRST TWO ARE NOT OPTIONAL — WHICH IS
// THE DESIGN'S ONE IDEA WRITTEN INTO THE SCHEMA RATHER THAN INTO A COMMENT. `docs/research/scene-
// system.md` §4: *"the window is a portal, not a texture."* A kitchen is the same Preetham sky at
// the same sun seen through a rectangle. An interior that carried a room and no sky would be an
// interior whose window had to be AUTHORED, which is the sky/key disagreement 11.2 exists to
// prevent, one room further in — so `resolveScene` refuses it below.

/**
 * The fields a scene's `room` may carry.
 *
 * `wall` / `floor` / `ceiling` are sRGB hex ALBEDOS, not radiances — the room's brightness is
 * derived from the sky through the window and never authored. `widthMetres` / `depthMetres` /
 * `heightMetres` describe a box around the figure, who stands at the world origin;
 * `centreOffsetMetres` is what moves the box relative to her, and it is load-bearing twice over:
 * `+z` puts floor behind the CAMERA (which stands 4.05 m out at body framing and would otherwise be
 * outside the back wall) and `+x` brings a CORNER into the portrait frame.
 *
 * ⚠️ **THE CORNER IS THE ITEM.** The flagship complaint against the exteriors is that a blind judge
 * could not name either at portrait framing and *"the two exterior portrait backdrops are the same
 * picture — mean |Δ| 2.42 code values."* At a 26° field of view 0.9 m out, only about 1.2 m of the
 * back wall is in a portrait frame; nothing on a side wall is. So the whole of what an interior can
 * put behind a face is a wall, a luminance GRADIENT across it, and — if the box is placed for it —
 * the vertical edge where two walls meet. `kitchen`'s `centreOffsetMetres.x` is chosen for that edge
 * and for nothing else.
 */
export const ROOM_FIELDS = Object.freeze( [
    'widthMetres', 'depthMetres', 'heightMetres', 'centreOffsetMetres',
    'wall', 'floor', 'ceiling', 'window', 'fixtures'
] );

/**
 * The fields a room's `window` may carry.
 *
 * `azimuthDegrees` is the WORLD azimuth of the window's OUTWARD normal — the SAME convention
 * `sun.azimuthDegrees` uses — so a window and a sun that share an azimuth are a window the sun
 * shines straight into, and the wall the window lands on is that azimuth's dominant axis.
 * `offsetMetres` slides it along its wall. `transmission` is the glazing's, and it is the only
 * number in an interior that attenuates daylight without being geometry.
 */
export const WINDOW_FIELDS = Object.freeze( [
    'azimuthDegrees', 'widthMetres', 'heightMetres', 'sillMetres', 'offsetMetres', 'transmission'
] );

/**
 * The fields a fixture may carry — a colour temperature and a level, which is the pair a lighting
 * person names a bulb by.
 *
 * ⚠️ `irradiance` IS IN THE SKY'S OWN UNITS, not the rig's. Everything in a room is: the window's
 * radiance is read off the sky's own PMREM, the walls' is derived from it, and one
 * `SKY_TO_RIG_SCALE` converts the lot. A fixture with its own scale would be the second photometric
 * system the whole scene system exists to avoid.
 */
export const FIXTURE_FIELDS = Object.freeze( [
    'kelvin', 'irradiance', 'heightMetres', 'offsetMetres'
] );

// --- the corpus, which today is exactly what already shipped ---------------------------------------

/**
 * The scenes that exist.
 *
 * 🚩 **THREE OF THE FIVE ARE PORTS RATHER THAN AUTHORING.** `studio`, `void` and the refused
 * `transparent` are `Avatar.BACKGROUND_PRESETS` re-expressed in this shape, value for value, and
 * `studio` is the calibration control whose numbers may not move.
 *
 * `beach` and `park` are punch-list 11.2/11.3's two authored exteriors and they are TWO on purpose:
 * two is enough to prove that the mechanism is parametric rather than a special case — they differ
 * in sun elevation, sun side, disc occlusion, turbidity and ground albedo, and NOTHING about the
 * code path differs between them. The other ten of the design's twelve are 11.6.
 *
 * Each entry's `background` is exactly what `Avatar.resolveBackgroundOption` accepts as a long
 * form, so the back-compatible option and the scene cannot describe the room differently.
 */
export const SCENES = Object.freeze( {

    /**
     * 🎯 **THE CALIBRATION CONTROL, AND IT IS THE ONE ENTRY WHOSE NUMBERS MAY NOT MOVE.**
     *
     * Every committed gate number in `docs/PROGRESS.md` — G1 through G7, every skin, eye and hair
     * figure, every critic verdict — was measured under this rig, this card and this clear colour.
     * A scene changes the light by definition, so scenes 2..12 will each have to declare what they
     * invalidate (11.7); `studio` is what they are compared AGAINST, and it is the reason 11.7 is
     * possible at all.
     *
     * `lights: {}` is not an empty slot. It is the assertion that the shipped rig is the authored
     * `FORM_LIGHTS`/`EDGE_LIGHTS` table with ZERO overrides — which is exactly what
     * `SCENE_LOOKS.studio` says on the look axis, and the two agree because a gate holds them to
     * each other rather than because they were typed the same day.
     */
    studio: Object.freeze( {
        id: 'studio',
        kind: 'studio',

        // No sun, no sky, no room. A photographic studio is the one place with no daylight model
        // and no window, which is why it is the control: nothing about it moves with the clock.
        sun: null,
        sky: null,
        room: null,

        lights: Object.freeze( {} ),

        /**
         * The per-framing multiplier axis, and it is empty here for the same reason `lights` is:
         * `studio` is the assertion that the shipped rig is `FORM_LIGHTS`/`EDGE_LIGHTS` with NOTHING
         * applied. An empty `scales` resolves to zero overrides, so the control keeps its digest.
         */
        scales: Object.freeze( {} ),

        /**
         * The floor. `enabled` is today's `background.ground`; `albedo` and `roughness` are 11.3's
         * and are null here because the shipped ground has no albedo of its own — `GroundContact`
         * occludes the hemisphere analytically and does not shade a surface.
         *
         * ⚠️ `enabled: false` IS A DOCUMENTED DOWNGRADE. 60% of the light landing on the floor
         * beside a sole comes from two RectAreaLights, which cannot cast a shadow at all
         * (three.js #14161). Take the plane away and the figure floats.
         */
        ground: Object.freeze( { enabled: true, albedo: null, roughness: null } ),

        /** 11.5. Zero is "no air", which is what the shipped frame has. */
        air: Object.freeze( { haze: 0 } ),

        /**
         * A RELATIVE multiplier on `EXPOSURE_CALIBRATION`, in the units `lighting.exposure` already
         * uses. ⚠️ Anything but 1 takes `report().scene.lighting.calibrated` false — see the OPEN
         * QUESTION at the foot of this file, which is 11.1's and is not settled here.
         */
        exposure: 1,

        background: Object.freeze( {
            colour: SCENE_CLEAR_COLOUR,
            backdrop: BACKDROP_EMISSIVE,
            distanceMetres: BACKDROP_DISTANCE_METRES
        } ),

        /**
         * What the scene ASKS the camera for, or null to leave the caller's framing alone. Null in
         * all three entries today: framing is `Avatar`'s `frame` option and `setFraming`, and a
         * scene that silently re-framed would change the crop a gate was measured at.
         */
        framing: null
    } ),

    /**
     * A black surround with the card removed and the floor kept.
     *
     * ⚠️ IT DOES NOT RUN ON EVERY TIER, AND THE REFUSAL IS `Avatar`'S RATHER THAN THIS TABLE'S.
     * `backdrop: false` on a tier carrying ground-truth occlusion renders the WHOLE FRAME black —
     * measured, and isolated to the card's PIXELS at background depth rather than its presence in
     * the draw list. `Avatar.create` resolves `quality: 'auto'` to `balanced` for it and refuses
     * `high`/`fallback` in words. Recorded here so a reader of the table is not surprised by a
     * throw that lives two files away.
     */
    void: Object.freeze( {
        id: 'void',
        kind: 'studio',
        sun: null,
        sky: null,
        room: null,
        lights: Object.freeze( {} ),
        scales: Object.freeze( {} ),
        ground: Object.freeze( { enabled: true, albedo: null, roughness: null } ),
        air: Object.freeze( { haze: 0 } ),
        exposure: 1,
        background: Object.freeze( {
            colour: 0x000000,
            backdrop: false,
            distanceMetres: BACKDROP_DISTANCE_METRES
        } ),
        framing: null
    } ),

    /**
     * 🔴 **DECLARED, DOCUMENTED AND CURRENTLY REFUSED — AND THE REFUSAL IS THE HONEST RESULT OF A
     * MEASUREMENT RATHER THAN AN OMISSION.** It is the scene an embedder actually asks for, an
     * avatar composited over a host page's own chrome, and it does not work today for a reason
     * that is not in this file or in `Avatar.js`.
     *
     * The refusal itself, with its measured diagnosis and the two isolated blockers, stays in
     * `Avatar.resolveBackgroundOption` where it already lives and where `Avatar.selftest.mjs`
     * already gates it. **It is deliberately NOT re-thrown here.** A refusal in two places is two
     * messages that will drift, and the one in `Avatar.js` is the one an embedder hits: this table
     * resolves `transparent` to `colour: null`, and `colour: null` is the exact condition that
     * function refuses. So the scene door and the background door fail identically, in one voice,
     * from one line of code — which is what `Scene.selftest.mjs` clause C asserts.
     *
     * The short form of the diagnosis, for a reader of the table: the TEMPORAL RESOLVE forces the
     * frame alpha to 1, so no tier with one can present a transparent canvas; and ground-truth
     * occlusion blacks out a frame with nothing at background depth. No tier has neither.
     */
    transparent: Object.freeze( {
        id: 'transparent',
        kind: 'studio',
        sun: null,
        sky: null,
        room: null,
        lights: Object.freeze( {} ),
        scales: Object.freeze( {} ),
        ground: Object.freeze( { enabled: false, albedo: null, roughness: null } ),
        air: Object.freeze( { haze: 0 } ),
        exposure: 1,
        background: Object.freeze( {
            colour: null,
            backdrop: false,
            distanceMetres: BACKDROP_DISTANCE_METRES
        } ),
        framing: null
    } ),

    /**
     * 🏖️ **THE OCCASION THE USER NAMED FIRST — R20's "going to the beach" — AND THE LOUDEST TEST OF
     * the design's claim that a scene is mostly LIGHT.**
     *
     * A beach at midday is not sand pixels. It is a hard, small, high source; an enormous blue fill
     * arriving from the whole upper hemisphere; and a warm bounce up off sand at ~0.35 albedo, which
     * is the reason beach portraits have a filled jaw underside and studio portraits do not. All
     * three of those are in this entry and none of them is an asset.
     *
     * **52°** rather than a true noon 70°: the sun is the key, and a key at 70° puts the brow ridge
     * over the eye and takes the catchlight with it. 52° is early afternoon, it is the highest this
     * table goes, and the choice is stated because it is a choice — the IBL fills the sockets that a
     * studio rig would have needed a second panel for, which is precisely what 11.2 buys.
     *
     * The sun's WORLD azimuth of 58° reaches `LightingRig` as 58 − 12 = **46°**, four degrees wider
     * than the studio key's 42°, because the camera stands at world azimuth 12° (`Avatar.js`'s
     * `CAMERA_AZIMUTH_DEGREES`). Two scenes on the same side of the camera and one on the other is
     * what makes the conversion falsifiable rather than decorative — see `park`.
     */
    beach: Object.freeze( {
        id: 'beach',
        kind: 'exterior',

        sun: Object.freeze( { elevationDegrees: 52, azimuthDegrees: 58, occlusion: 0 } ),

        // Turbidity 2.8 rather than the model's 2.0: sea air carries salt aerosol, and the visible
        // consequence is the wider, whiter glow around the sun that a coastal midday actually has.
        sky: Object.freeze( {
            turbidity: 2.8,
            rayleigh: 1.0,
            mieCoefficient: 0.006,
            mieDirectionalG: 0.8
        } ),

        room: null,

        /**
         * 🎯 **THE FILL IS THE WARM GROUND BOUNCE, AND THE SKY IS THE COOL ONE. TWO TERMS, FOUR
         * LIGHTS.**
         *
         * The version this replaced cut the studio fill from 2.20 to 0.70 AND recoloured it to sky
         * blue, on the argument that "the sky has taken its job". Half of that argument is right and
         * the other half is what made the skin chalky. **Real outdoor fill on a face is two things**
         * — cool sky from above and a WARM BOUNCE off the ground from below — and the previous entry
         * supplied the first twice and the second not at all: the sky arrives as image-based light
         * (measured at 27.50% of a forehead pixel and 56.05% of a jaw underside) *and* the one
         * analytic panel was pointed at the same job in the same hue.
         *
         * 🔴 MEASURED, on `cheek` (320,400,50,30 — `regions.lighting-portrait.json`'s own G2 skin),
         * CIELAB from the plate's own sRGB, 900×1200, 1 step, seed 1:
         *
         *     arm                                  L*      a*      b*    C*     h*
         *     studio, the control                 81.64   10.16   10.98  14.96  47.2°
         *     beach as it shipped                 77.94   11.20    1.26  11.27   6.4°
         *
         * **`a*` did not move. `b*` collapsed from 10.98 to 1.26.** The skin did not lose its RED,
         * it lost its YELLOW, and the hue rotated 41° off skin into a chalky pink — which is what a
         * blue illuminant does and is not what a tone curve does. The attribution runs the same way:
         * nulling `scene.environment` alone returns b* to 8.99, and dropping exposure to 0.80 —
         * below the control's own lightness — returns it to 0.98, i.e. **not at all**. Exposure is
         * a real axis and it is not this one.
         *
         * So the panel keeps the job it is uniquely able to do and stops duplicating the sky's:
         *
         *   `colour`             a sand bounce. Sunlight ⊗ sand: `#ffe9cd` (the derived sun at 52°,
         *                        `report().scene.environment.sunColour`) times `#a89f8d` is
         *                        `(0.3916, 0.2825, 0.1626)` linear, normalised `#ffddac`. **Shipped
         *                        one step hotter at `#ffc070`, and that step is not physics.** ACES
         *                        sheds chroma as it brightens (`docs/CHECKPOINT.md` §10, Chiang et
         *                        al. EGSR 2016 §4.2), so the hue that LANDS is not the hue that
         *                        leaves the panel: measured at identical irradiance, `#ffddac` gives
         *                        cheek b* 11.35 and `#ffc070` gives 13.30 against the control's
         *                        10.98. It is a pre-compensation, it is stated as one, and the
         *                        derived value is on the line above so the size of the step is
         *                        readable rather than lost.
         *   `elevationDegrees`   −22, because a bounce comes from BELOW. A standing figure over a
         *                        flat ground plane receives it centred roughly 20–30° under the
         *                        horizon. ⚠️ Worth little on its own — at a fixed irradiance and
         *                        colour, +2 → −22 moves cheek C* 13.46 → 13.52 — so it is here for
         *                        the jaw and the underside of the chin and is NOT credited with the
         *                        chroma.
         *
         * The fill's IRRADIANCE is not here. It is in `scales` — read the 🔴 below, because the
         * reason is a correction rather than a preference. At portrait it resolves to **1.276**
         * against the shipped 0.70, and `designedKeyToFill` is then 2.70/1.276 = **2.12** — between
         * the studio rig's 1.36 and the 3.86 this scene shipped with.
         *
         * `azimuthDegrees` is NOT set here either: `FORM_LIGHTS` authors the fill at −52 and this
         * scene's sun reaches the rig at **+46**, so the panel is already on the opposite side of
         * the camera from the key, which is what a fill is for. ⚠️ `park` is the case where it is
         * not, and it has to say so — see there.
         *
         * ⚠️ `colour` and `elevationDegrees` ARE safe as absolutes and they are the only two
         * written here. Read off the real rig at both presets: key and fill agree on colour,
         * azimuth and elevation at portrait and at body, and disagree on exactly one number.
         */
        lights: Object.freeze( {
            fill: Object.freeze( {
                colour: 0xffc070,
                elevationDegrees: -22
            } )
        } ),

        /**
         * 🎯 **THE RIM, SOLVED AS A FACTOR RATHER THAN DROPPED — WHICH IS THE WHOLE REASON
         * `SCENE_SCALE_FIELDS` EXISTS.**
         *
         * The previous round measured that dropping the rim's irradiance cleans the edge up and
         * recorded that it COULD NOT SHIP, because a scene's `lights` are absolute: 2.6 written into
         * `lights` holds at portrait (authored 16) and delivers 2.6 at body where `EDGE_LIGHTS.body`
         * authored 22 — 88.2% under, silently. **0.1625 is that same drop expressed as the thing it
         * actually is**: 16 × 0.1625 = **2.60** at portrait and 22 × 0.1625 = **3.575** at body,
         * re-resolved by `setFraming` against whichever table is live.
         *
         * 🔴 AND IT IS A SKIN FIX, NOT ONLY A SILHOUETTE ONE, WHICH IS WHY IT SITS IN THE ROUND
         * ABOUT THE SKIN. Deleting the rim outright from the shipped beach moves the `cheek` patch
         * b* 1.26 → 8.11 and its hue 6.4° → 40.1° — the violet was not confined to the outline, it
         * was laying blue across the face, and at 23× the fill it was the second largest term in the
         * cheek's colour after the sky itself.
         *
         * ⚠️ 0.1625 and not 0.32 (the factor the fill took last round): at 5.1 the magenta halo
         * around the eye sockets is reduced and still legible on the plate; at 2.6 it is gone. Both
         * were looked at, at 900×1200, before either was written down.
         */
        scales: Object.freeze( {
            /**
             * 🔴 **THE FILL'S IRRADIANCE IS A FACTOR TOO, AND FINDING THAT OUT COST A CLAIM THIS
             * FILE HAS BEEN MAKING SINCE 11.2.**
             *
             * The entry this replaced wrote `fill: { irradiance: 0.70 }` as an ABSOLUTE, justified
             * in this file's own words: *"`fill` is safe because `FORM_LIGHTS` is IDENTICAL in both
             * presets — that is the file's own load-bearing claim"*. **It is not.**
             * `LightingRig.js`' `FORM_LIGHT_OVERRIDES_BY_PRESET` is
             * `body: { fill: { irradiance: 1.20 } }`, and the live rig says so: reading
             * `report().scene.lighting.placements` through `setFraming( 'body' )` on the SHIPPED
             * `studio` scene, the fill goes **2.20 → 1.20** while its colour, azimuth and elevation
             * do not move. So `0.70` was 0.318× the portrait table and 0.583× the body table, and
             * `setFraming( 'body' )` changed this scene's key:fill by **1.83×** with nothing
             * reporting it — the exact defect the entry's own ⚠️ was written to prevent, in the one
             * field it declared exempt.
             *
             * ⏭️ The repair is the mechanism and not the number: G17 in `Scene.selftest.mjs` now
             * reads the authored fill off the real class at BOTH presets and refuses any shipped
             * scene that writes `lights.fill.irradiance`, so the claim cannot be re-asserted.
             *
             * **0.58** is **1.276** at portrait (against the 2.20 authored there) and **0.696** at
             * body (against the 1.20 authored there), which keeps the body preset's own G1 solve —
             * 1.20 was chosen for the CENTRE of the reference band — instead of overwriting it.
             *
             * ⚠️ **AND 0.58 RATHER THAN 0.82, BECAUSE G1 IS THE PRICE OF THE BOUNCE AND IT IS
             * TWO-SIDED.** A warm fill big enough to fix the chroma flattens the face, and the
             * image-based light is already filling the shadow side, so the RENDERED key:shadow runs
             * well under the DESIGNED key:fill. Swept on `measure.mjs` with
             * `regions.lighting-portrait.json`, 900×1200, everything else at the shipped values:
             *
             *     factor   portrait fill   G1 linear (band 1.43–1.64)   cheek C*   flatCheek C*
             *     0.82         1.804          1.3541  ❌ TOO FLAT         18.67        15.63
             *     0.70         1.540          1.4324  ❌ by 0.0024        18.35        15.21
             *     **0.58**   **1.276**      **1.5337 ✅ centred**       **17.96**    **14.77**
             *     0.46         1.012          1.6676  ✅ near the ceiling  17.49        14.28
             *
             * The whole chroma cost of buying G1 back is 0.7 of cheek C* — which still leaves the
             * cheek ABOVE the studio control's 14.96 — so the trade is cheap and it is taken. ⚠️
             * 1.4324 at 0.70 is 4.8× G1's retained fragility floor of 0.0005 below the band, so it
             * is a FAIL and not a MARGINAL; the row is here because a reader will otherwise assume
             * the gap between 0.70 and 0.58 is noise.
             */
            fill: Object.freeze( { irradiance: 0.58 } ),

            rim: Object.freeze( { irradiance: 0.05, distanceInHeights: 0.5 } ),
            // Same repair as `park.scales.rim` — read the measurement table there; this floor is
            // sand at linear 0.35 rather than grass at 0.093, so the same fixed blue rim showed
            // as lilac-grey instead of navy. One defect, two magnitudes.
            kicker: Object.freeze( { distanceInHeights: 0.5 } )
        } ),

        /**
         * Dry sand. `0xa89f8d` is linear **(0.3916, 0.3467, 0.2664)**, luminance Y **0.3504** — the
         * ~0.35 the design doc quotes for sand, warm-biased, with blue lowest.
         *
         * 🔴 THIS TRIPLE READ (0.401, 0.352, 0.265) WHEN 11.3 LANDED AND NO CURVE PRODUCES IT.
         * Seventh instance of `docs/LEARNINGS.md` §1.25r. Under the sRGB EOTF every instrument in
         * this repository uses (`lightpath-probe.mjs`'s `srgbToLinear`) it is 0.3916/0.3467/0.2664,
         * and R was out by 2.4%; a pure 2.2 gamma gives 0.399/0.354/0.272 and does not reproduce it
         * either, so the number was hand-fitted rather than converted. The tell was available in
         * the round's own output: `scene-probe --ground` PRINTS `linear Y 0.3504`, which agrees
         * with the corrected triple and disagrees with the old one, whose Y would be 0.3562.
         * ⚠️ Nothing rests on it — the shading reads the HEX — which is exactly why it survived.
         *
         * 🎯 THIS IS THE FIELD 11.3 IS ABOUT AND IT IS READ TWICE: `GroundContact` shades the plane
         * the figure stands on with it, and `SkyEnvironment` puts a 500 m disc of it into the
         * environment bake so the lower hemisphere of the image-based light is a floor rather than
         * horizon sky. The second reading is the bounce.
         */
        ground: Object.freeze( { enabled: true, albedo: 0xa89f8d, roughness: 0.95 } ),

        /**
         * 🏖️ **PUNCH-LIST 11.5, AND IT IS THE FIELD THAT MAKES THE GROUND A DISTANCE INSTEAD OF A
         * FLOOR THAT STOPS.** 0.25 means the ground is 95% dissolved into the sky at
         * `HAZE_95_PERCENT_METRES_AT_FULL / 0.25` = **100 m** — coastal air, not weather.
         *
         * Measured on the body plate, 900×1200, 1 step, seed 1, mask `620,790,240,40` (the ground
         * at its farthest visible, below every seam this round moves), against the SAME plate with
         * `?noair`:
         *
         *     haze  0     0.15    0.25    0.40    0.60
         *     mean  60.31 63.28   68.29   79.33   97.81      (sky above it reads 165.12)
         *
         * 🚩 **0.25 RATHER THAN 0.60, AND THE PLATE IS WHY RATHER THAN THE TABLE.** Every row above
         * lifts the far ground toward the sky and the statistic gets monotonically "better"; at
         * 0.60 the plate has no horizon left in it at all — the background is one milky wash and
         * the figure floats in it, which is a worse picture than the one this item started from and
         * no number here says so. At 0.25 the far band still reads as a darker distance under a
         * hazy horizon, which on a beach reads as the sea.
         *
         * ⚠️ **IT IS NOT FREE ON THE SUBJECT AND THE COST IS QUOTED.** Flat thigh skin
         * (`430,880,44,70`), which is the closest subject mask to the ground: 118.12 at haze 0 →
         * 119.44 at 0.25 → 121.47 at 0.40. **1.32 code values at the shipped setting**, and it is
         * physically real — there is air between the camera and a person 4 m away. The chest
         * (`396,300,88,60`) moves 199.93 → 199.74, under a fifth of a code.
         */
        air: Object.freeze( { haze: 0.25 } ),

        /**
         * ⚠️ **RE-ANCHORED 1.28 → 1.22 BECAUSE THE FILL ABOVE MADE THE FACE BRIGHTER, AND THE ANCHOR
         * IS THE THING THAT HAD TO MOVE RATHER THAN THE FILL.**
         *
         * 1.28 was solved so the forehead probe (`tools/critic/scene-probe.mjs`, rect
         * 250,196,120,46) read 6.0670e-1 against the `studio` control's 5.9640e-1 — 1.017×, so that
         * a beach plate and a studio plate are two pictures of one person rather than two exposures.
         * A warm bounce raises that same probe, so holding 1.28 would have banked the chroma win
         * and spent it straight back up the tone curve. Measured on the forehead patch in CIELAB, at
         * the SHIPPED fill factor of 0.58, 900×1200, 1 step, seed 1:
         *
         *     exposure   forehead L*   forehead C*   G6 p0.1   (control: L* 82.24, C* 16.64)
         *     1.28          83.30         11.29       PASS
         *     **1.22**      **82.28**     **11.83**   **PASS**
         *     1.15          81.10         12.42       ❌ FAIL — under the 0.004 floor
         *
         * 1.22 is where the forehead's LIGHTNESS returns to the control's, to 0.04 of L*. Two things
         * beside it are the honest cost statement. Chroma keeps rising as exposure falls, so "match
         * the control's brightness" and "match the control's colourfulness" are not the same
         * instruction and this scene ships the first. And **1.15 takes G6 red** — the whole-image
         * 0.1st-percentile luma drops under the 0.004 floor — so the ladder has a floor under it as
         * well as a target on it, and 1.22 is the only rung that clears both.
         *
         * ⚠️ The forehead is the one patch that does not reach the control on chroma (11.83 against
         * 16.64) and it is the patch a 52° sun hits squarely. The cheek (17.30 against 14.96), the
         * chin and the terminator all clear it.
         *
         * 🚩 IT STILL DOES NOT MEAN THE GATES HOLD. `report().scene.lighting.calibrated` is FALSE
         * and correctly so — 27.50% of that forehead is image-based light and `docs/CHECKPOINT.md`
         * §7's decomposition was taken at 0.00%.
         */
        exposure: 1.22,

        /**
         * ⚠️ **`backdrop: false` IS STRUCTURAL FOR AN EXTERIOR AND IT COSTS A TIER.** The emissive
         * card stands 1.9 m behind the focus and fills the frame; leave it in and the sky is behind
         * it and invisible. Taking it out is what `resolveTier`'s `backdropless` flag already
         * handles — `quality: 'auto'` resolves to `balanced`, and an EXPLICIT `high` or `fallback` is
         * refused in words, because ground-truth occlusion with nothing at background depth renders
         * the whole frame black (measured; `BACKGROUND_PRESETS` carries the table).
         *
         * 🚩 So an exterior scene does not run on the occlusion tiers today. That is a real cost, it
         * is stated rather than discovered, and the ROUND NOTE below records what was measured about
         * it. `colour` is the clear, which `SkyEnvironment` overwrites with the sky's own PMREM the
         * moment it attaches — it exists so a frame between the clear and the bake is sky-coloured
         * rather than studio-grey.
         */
        background: Object.freeze( {
            colour: 0x8fb4d8,
            backdrop: false,
            distanceMetres: BACKDROP_DISTANCE_METRES
        } ),

        framing: null
    } ),

    /**
     * 🌳 **A WALK, AND THE ONE SCENE IN THE DESIGN WITH A BROKEN KEY.**
     *
     * Everything about `park` is chosen to differ from `beach` on an axis the code has to honour,
     * so that two scenes prove a mechanism instead of one scene proving a special case:
     *
     *   | axis | beach | park | what it exercises |
     *   |---|---|---|---|
     *   | sun elevation | 52° | 34° | the derived key's colour AND irradiance move together |
     *   | sun side | world 58° → rig **+46** | world −46° → rig **−58** | the camera-relative conversion, in both signs |
     *   | disc occlusion | 0 | **0.45** | the key drops and the sky does NOT |
     *   | turbidity | 2.8 | 3.4 | the sky's own hue and glow |
     *   | ground albedo | sand `#a89f8d` | grass `#455438` | the bounce, and 11.3's whole gate |
     *
     * 🎯 `occlusion: 0.45` IS WHAT "DAPPLED" IS AS A NUMBER, and modelling it here rather than as a
     * turbidity change is the substantive choice. Leaf cover stands between the subject and the SUN;
     * it does not stand between the subject and the rest of the hemisphere. Raise turbidity instead
     * and the whole sky dims, which is an overcast day and a different picture. So the key loses 45%
     * and the image-based fill keeps all of it — which is exactly why a park reads as soft and a
     * beach reads as hard even though both are lit by one sun.
     *
     * ⚠️ It is a SCALAR and not a pattern. Actual dapple is a high-frequency shadow across the face,
     * which needs a projected texture on the key — a `LightingRig` request, not a scene field, and
     * not this item.
     */
    park: Object.freeze( {
        id: 'park',
        kind: 'exterior',

        sun: Object.freeze( { elevationDegrees: 34, azimuthDegrees: -46, occlusion: 0.45 } ),

        sky: Object.freeze( {
            turbidity: 3.4,
            rayleigh: 1.1,
            mieCoefficient: 0.005,
            mieDirectionalG: 0.8
        } ),

        room: null,

        /**
         * 🔴 **THE FILL WAS ON THE SAME SIDE OF THE CAMERA AS THE KEY, AND THAT IS WHY `park` READ
         * DEAD.** This is the entry's largest single defect and it was structural rather than
         * photometric. `FORM_LIGHTS` authors the fill at azimuth **−52**, and this scene's sun
         * reaches the rig at **−58** — six degrees apart, both on the camera's left. So the whole
         * right-hand side of the face had NO analytic source at all: it was lit by the blue sky and
         * by a violet rim at 16, which is exactly the grey-green the plates showed. `beach` never
         * showed it because its sun lands at +46, opposite the authored fill, by luck rather than by
         * construction. **+52 mirrors the fill back across the camera axis**, and the rule it states
         * is the one 11.6 will need for ten more scenes: a fill belongs opposite the key, and the
         * key here is the sun.
         *
         * `colour` and `elevationDegrees` are `beach`'s argument — a warm bounce from below against
         * the sky's cool from above; see there for the measurement.
         *
         * 🔴 **AND THE PHYSICALLY DERIVED GRASS BOUNCE IS REFUTED, BY LOOKING AND BY THE
         * STATISTIC.** Sunlight ⊗ grass is `#ffe5c0` (the derived sun at 34°) times `#455438`,
         * which is `(0.0578, 0.0729, 0.0231)` linear, normalised **`#e7ff98`** — a vivid
         * yellow-green. Rendered, it puts the cheek's `a*` at **−5.83** and its hue at **101.5°**:
         * the plate is a face with an olive cast down the jaw and the whole right side, which is a
         * more saturated version of the defect this round exists to remove. `#ffcf9a` is authored
         * instead and the derivation is kept above it so the departure is visible. What the
         * derivation leaves out is the reason it fails: a park is not a grass box. The ground a face
         * actually sees is grass plus path plus soil plus trunks, and the green a real dappled
         * portrait carries comes from light through LEAVES, which every photographer corrects.
         *
         * The fill's IRRADIANCE is in `scales` for the reason `beach.scales.fill` sets out.
         */
        lights: Object.freeze( {
            fill: Object.freeze( {
                colour: 0xffcf9a,
                azimuthDegrees: 52,
                elevationDegrees: -22
            } )
        } ),

        /**
         * `rim` is the same factor `beach` uses, and deliberately the same rather than separately
         * tuned: the rim is `EDGE_LIGHTS`' number and the two exteriors have no reason to disagree
         * about how much of it an outdoor scene wants. 16 × 0.1625 = 2.60 at portrait, 22 × 0.1625
         * = 3.575 at body. See `beach.scales` for why it is a factor and not a number.
         *
         * ⚠️ **`fill` IS 0.28 AND NOT `beach`'S 0.58, AND THE CEILING IS THE KEY.** With 45% of the
         * disc behind leaves the derived key is only **1.056**, so `beach`'s factor would put the
         * fill at 1.21× the key — a face with no source direction at all, which this file's own
         * exposure note already records as a worse picture than a darker one. 0.28 is **0.616** at
         * portrait and **0.336** at body; `designedKeyToFill` is **1.71**, which is a direction.
         *
         * ⚠️ **AND G1 CANNOT READ IT THE RIGHT WAY UP ON THIS SCENE, WHICH IS 11.7's ARGUMENT AND
         * NOT AN EXCUSE.** `regions.lighting-portrait.json` hard-codes `faceKey` to the studio rig's
         * RIGHT-hand key and this scene's sun is on the left, so G1 reports the ratio inverted. The
         * factor was still swept against it, in the only way an inverted reading supports — as a
         * magnitude — on `measure.mjs`, 900×1200:
         *
         *     factor   portrait fill   G1 as read   INVERTED (band 1.43–1.64)   cheek C*   flatCheek C*
         *     0.386        0.849         0.7803          1.2816  ❌ too flat      17.81       26.35
         *     0.30         0.660         0.7033          1.4219  ❌ by 0.008      17.71       24.22
         *     **0.28**   **0.616**     **0.6839**      **1.4622 ✅**            **17.67**   **23.53**
         *     0.22         0.484         0.6219          1.6080  ✅ at the ceiling 17.57      20.75
         *
         * 0.28 is where the face regains a source direction of the reference band's own strength,
         * and the cheek pays 0.14 of C* for it. ⚠️ 1.4219 at 0.30 is 16× G1's retained fragility
         * floor of 0.0005 below the band, so it is a FAIL and not a MARGINAL — the row is here
         * because a reader will otherwise take the gap between 0.30 and 0.28 for noise.
         */
        scales: Object.freeze( {
            fill: Object.freeze( { irradiance: 0.28 } ),
            /**
             * 🎯 **THE RIM IS A SUBJECT LIGHT AND IT WAS PAINTING THE FLOOR. MEASURED 2026-08-18 BY
             * REMOVING ONE LIGHT AT A TIME, `park`, body framing, a floor rect clear of the figure:**
             *
             *     arm                              floor RGB              hue     sat
             *     shipped                          38.07 54.02 83.54     219.0   0.544
             *     rim irradiance 0                 42.39 55.04 46.28   **138.4** 0.230
             *     rim AND kicker 0                 40.78 53.83 45.68     142.5   0.242
             *     `?noenv` (sky environment nulled, rim kept) 30.98 34.35 63.28   233.7   0.510
             *
             * **The rim is the whole of it.** Zeroing it takes the floor from navy to green;
             * nulling the ENVIRONMENT leaves it blue, so the sky is not the cause. A blind judge
             * called this ground *"dark water, or a hole in the frame"* and explicitly rejected
             * grass, against a declared albedo at hue 92.1.
             *
             * 🎯 **AND IT EXPLAINS WHY `park` IS FIVE TIMES WORSE THAN `beach`, which nobody had
             * accounted for.** The rim is a FIXED irradiance, so the darker the ground albedo the
             * more completely it dominates: sand at linear 0.35 comes out mildly mauve, grass at
             * 0.093 goes fully navy. One defect, two magnitudes, one cause.
             *
             * ⚠️ **`layers` CANNOT FIX THIS AND I CHECKED RATHER THAN ASSUMING.** three's node path
             * tests `object.layers.test( camera.layers )` for LIGHTS (`Renderer.js:973`) — that is
             * light-versus-CAMERA, not light-versus-object, so there is no per-object light mask.
             * `LightingRig.js` already records `layers` as *"measured inert"*.
             *
             * So the levers are the two this file can reach, and BOTH are needed — measured, at
             * `park` body, floor hue:
             *
             *     distance 0.65 (shipped) 219.0 | 0.45 210.8 | 0.32 198.3 | 0.22 179.8
             *     at distance 0.32: irradiance 2.6 → 188.9 | 1.3 → 167.1 | 0.6 → 153.6 | 0 → 141.4
             *
             * Standoff alone gets halfway; level alone leaves the panel reaching a 36-height floor.
             * ⚠️ The residual at rim-zero is hue 141 against a declared 92.1 and it is CORRECT — a
             * green plane under an open blue sky reads cyan-green. That is the sky doing its job.
             *
             * 🎯 **AND CUTTING THE RIM OUTDOORS IS NOT A HACK, IT IS THE MORE PHYSICAL CHOICE.**
             * There is no saturated blue panel on a beach. Outdoors the thing that rims a subject IS
             * the sky, and 11.2 put it there — measured at 25.9–38.2% of a face pixel. The studio
             * rim is a cinematic device with no outdoor referent, and a blind judge shown all six
             * plates reported the loudest violet in the set is now on the CONTROL.
             * ⚠️ Recolouring it was REFUTED last round (a desaturated rim puts more red through skin
             * and grows an orange SSS glow), so the hue stays and only the level moves.
             *
             * LOOKED AT, both scenes, body framing, before and after: `beach`'s floor goes from
             * lilac-grey to a warm sandy beige, `park`'s from navy to green, and the figure still
             * separates cleanly against the sky in both.
             */
            rim: Object.freeze( { irradiance: 0.05, distanceInHeights: 0.5 } ),
            kicker: Object.freeze( { distanceInHeights: 0.5 } )
        } ),

        // Summer grass: linear (0.058, 0.093, 0.041). Dark, and green-dominant with blue lowest —
        // the bounce off it is the reason a park portrait's jaw underside is cool-green where a
        // beach portrait's is warm. That difference is the whole of 11.3 made visible.
        ground: Object.freeze( { enabled: true, albedo: 0x455438, roughness: 0.85 } ),

        /**
         * 11.5. Lower than the beach's 0.25 — 95% dissolved at **139 m** rather than 100 m — and
         * the reason is the same asymmetry `occlusion` is: a park is an ENCLOSED place. Coastal air
         * carries salt aerosol over open water, which is the same reasoning `sky.turbidity` 2.8
         * already encodes on `beach`; a treed park does not, and its distance is measured in tens
         * of metres rather than hundreds.
         *
         * 🎯 **AND PARK IS WHERE THE HORIZON DEFECT WAS WORST, WHICH IS THE CHECK ON THE MECHANISM
         * RATHER THAN ON THE VALUE.** Grass is dark: `#455438` under a 45%-occluded sun put a
         * **122-code** step across ONE row at x=60 (y=737→738, (156,176,183) → (34,56,66)) against
         * the beach's 96, with the square plane's own corner visible as a jog. Same closure, same
         * two constants, no per-scene tuning: **9 codes**. A repair that needed a different number
         * on the second scene would be a tuning and not a mechanism.
         */
        air: Object.freeze( { haze: 0.18 } ),

        /**
         * Higher than the beach's because the scene genuinely has less light in it: a 34° sun is
         * 16.26 in SkyMesh units against the beach's 22.65, and 45% of its disc is behind leaves.
         *
         *     forehead probe, same recipe:  park at 0.82  1.6117e-1     park at 1.90  4.2741e-1
         *
         * ⚠️ **AND IT LANDS 28% UNDER THE STUDIO CONTROL'S 5.9640e-1 RATHER THAN ON IT, ON PURPOSE.**
         * Dappled shade IS darker than midday sun, and pushing it to parity took the fill above the
         * key (designed key:fill 0.880 at exposure 2.20) — a face with no source direction at all,
         * which is a worse picture than a slightly darker one. `docs/research/scene-system.md` §7 is
         * explicit that a scene gate should ask whether the person is still LEGIBLE rather than
         * whether the pixels match a constant, and this is the first entry in the table where those
         * two answers differ.
         */
        exposure: 1.90,

        background: Object.freeze( {
            colour: 0x9fc0dd,
            backdrop: false,
            distanceMetres: BACKDROP_DISTANCE_METRES
        } ),

        framing: null
    } ),

    /**
     * 🎯 **`kitchen` — THE ONE INTERIOR, AND IT EXISTS TO PROVE A MECHANISM RATHER THAN TO BE A SET.**
     * Punch-list 11.4.
     *
     * 🚩 **SAY IT PLAINLY: ONE SCENE PROVES A SPECIAL CASE AND TWO PROVE A MECHANISM.** `beach` and
     * `park` are two on purpose — they differ in sun elevation, sun side, disc occlusion, turbidity
     * and ground albedo and NOTHING about the code path differs between them, which is what makes
     * the exterior model parametric rather than fitted. This is ONE. The claim it can carry is *"an
     * interior can be built out of the same sun"*, and no more than that.
     *
     * ⏭️ **WHAT THE SECOND INTERIOR MUST VARY, so 11.6 does not author five more of the same
     * picture:** (1) **the window on a different WALL** — `azimuthDegrees` here puts it on the −X
     * wall, and a back-wall window is the case where the sun is behind the subject and the room's
     * inter-reflection is the whole key; (2) **an interior with the sun BELOW the horizon**, where
     * `windowAdmittance` returns 0 and the FIXTURES are the only light — `living-room` and
     * `bedside-night` are that case and it exercises a branch this scene never enters; (3) **a room
     * whose walls are not warm**, because the wall albedo is the interior's answer to what ground
     * albedo is outdoors and it has been swept on neither. Any one of the three would have caught a
     * hard-coded assumption; this scene alone cannot.
     */
    kitchen: Object.freeze( {
        id: 'kitchen',
        kind: 'interior',

        /**
         * Morning. 15° is the elevation the design doc's own kitchen sketch names, and it is the
         * hour the scene is FOR — the first conversation of the day.
         *
         * ⚠️ The azimuth is chosen against the WINDOW rather than against the camera: at −55° the
         * solar ray from the figure's eye crosses the −X wall 1.14 m out and 1.80 m up, which is
         * inside the aperture below — so this room's sun genuinely comes through its window. Move
         * either number without the other and `report().scene.environment.windowAdmittance` says so.
         */
        sun: Object.freeze( { elevationDegrees: 15, azimuthDegrees: -55, occlusion: 0 } ),

        // ⏭️ `occlusion` IS 0 HERE AND THE ALTERNATIVE WAS TRIED. A sheer curtain reads correctly
        // against the field's own definition — it hides the DISC and leaves the enclosure's flux,
        // so the key softens and the room does not dim — but it cannot change the wall-to-face
        // ratio, because it scales the numerator of a ratio whose denominator it also feeds. Left
        // at 0 rather than shipped as a number that does not earn its place. `living-room` is where
        // an interior `occlusion` will.

        /**
         * The same four `SkyMesh` uniforms an exterior carries, because it is the same sky. 2.6 is a
         * clean domestic morning — slightly hazier than `beach`'s coastal 2.8 would suggest only
         * because a low sun through more air is already redder without help.
         */
        sky: Object.freeze( {
            turbidity: 2.6,
            rayleigh: 1.0,
            mieCoefficient: 0.005,
            mieDirectionalG: 0.8
        } ),

        /**
         * The box. Nine numbers and three colours, and every one of them is either a room a person
         * could stand in or a framing constraint stated in `ROOM_FIELDS`.
         *
         * ⚠️ `depthMetres` 6.4 at `centreOffsetMetres.z` +1.5 puts the back wall at z = +4.7 m. The
         * body-framed camera stands 4.05 m out (1.87 m of framed height at a 26° field of view), so
         * the clearance is 0.65 m. A shallower room renders the OUTSIDE of a box at body framing.
         * ⚠️ `centreOffsetMetres.x` +1.2 puts the −X wall 0.9 m from the figure, which is what
         * brings its corner into the portrait frame. See `ROOM_FIELDS`.
         */
        room: Object.freeze( {
            widthMetres: 4.2,
            depthMetres: 6.4,
            heightMetres: 2.6,
            centreOffsetMetres: Object.freeze( { x: 0.9, z: 1.5 } ),

            // Warm plaster, an oak floor and a near-white ceiling. Albedos, not radiances.
            wall: 0xd8cfc2,
            floor: 0x6b5443,
            ceiling: 0xe8e4dc,

            window: Object.freeze( {
                azimuthDegrees: -90,
                widthMetres: 1.4,
                heightMetres: 1.5,
                sillMetres: 0.95,
                offsetMetres: -0.66,
                transmission: 0.86
            } ),

            /**
             * One 2900 K fitting, which is the second colour temperature in the room and the reason
             * a fixture is in the schema at all: an interior is the only scene family whose light
             * has TWO sources that disagree about white, and a model that cannot express that
             * cannot express an evening.
             */
            fixtures: Object.freeze( [
                Object.freeze( { kelvin: 2900, irradiance: 5, heightMetres: 2.42, offsetMetres: -0.9 } )
            ] )
        } ),

        lights: Object.freeze( {} ),

        /**
         * ⚠️ **THE RIM IS CUT FOR THE SAME REASON IT IS CUT OUTDOORS AND THE REASON IS PHYSICAL.**
         * `36ba35d` traced `park`'s navy lawn and `beach`'s lilac sand to one saturated `#0f30ff`
         * panel. There is no blue rim source in a kitchen either; what rims a subject here is the
         * window, and the environment carries it. ⚠️ It cannot paint THIS room's walls — they are
         * unlit materials by construction (`InteriorEnvironment`'s header) — but it still reaches
         * the figure and `GroundContact`'s floor.
         */
        scales: Object.freeze( {

            // 🎯 **INDOORS THE FILL *IS* THE ROOM, AND THE ROOM IS THE ENVIRONMENT MAP.** An
            // analytic fill at studio strength is the same light counted twice: `scene.environment`
            // already carries every wall, the ceiling and the window. What is left for the panel is
            // shaping, which is what 0.15 buys.
            fill: Object.freeze( { irradiance: 0.15 } ),

            // ⚠️ **MEASURED BEFORE IT WAS CHOSEN.** At the studio's own level `report()` showed the
            // rim at irradiance **2.4 against a derived key of 0.318** — the saturated `#0f30ff`
            // edge light running at 7.5× the sun — and the floor rendered violet at body framing,
            // which is `36ba35d`'s finding one room further in. There is no blue rim source in a
            // kitchen; what rims a subject here is the window, and 11.2's environment carries it.
            // At 0.02 the floor reads hue **16.9–20.3** against its declared `#6b5443` at 25.5.
            // ⚠️ The walls could never have been painted by it — they are unlit materials by
            // construction — but `GroundContact`'s floor and the figure both still see it.
            rim: Object.freeze( { irradiance: 0.02, distanceInHeights: 0.5 } ),

            kicker: Object.freeze( { irradiance: 0.10, distanceInHeights: 0.5 } )
        } ),

        // The floor the figure stands on is `GroundContact`'s and carries the room's own oak, so the
        // plane under her feet and the bounce in the environment bake are one statement.
        ground: Object.freeze( { enabled: true, albedo: 0x6b5443, roughness: 0.6 } ),

        // ⚠️ NO AIR. `air.haze` dissolves a ground plane into a SKY, and an interior has neither a
        // horizon nor a sky in frame. `InteriorEnvironment` installs no `scene.fogNode` at all.
        air: Object.freeze( { haze: 0 } ),

        /**
         * 🎯 **RE-ANCHORED, AND ANCHORED ON THE PLATE RATHER THAN ON THE STATISTIC.**
         *
         * An interior at `exposure: 1` is **2.09 stops** under the `studio` control on
         * `docs/CHECKPOINT.md` §7's own forehead probe. The obvious anchor is *"match the control"*,
         * which is about **3.2** — and it was shipped for one iteration and the plate is CHALKY: a
         * white, chroma-poor face with the lit side flattened. Every number said it was fine
         * (forehead 0.96–1.07× the control, G5 clipping **0** at every rung, cheek C\* ABOVE the
         * control's at every rung). Opening the plate is what caught it.
         *
         * **2.4 puts the forehead at 0.6586× the control — 0.60 stops under — and keeps the skin's
         * colour.** ⚠️ It takes `report().scene.lighting.calibrated` false, exactly as `beach`'s 1.22
         * and `park`'s 1.90 do. ⚠️ And `Avatar.resolveLightingOption` caps the field at 4.0, so a
         * darker interior has 0.74 stops of headroom left on this axis and will need its LIGHT
         * rather than its stop. The ladder and the refutation are in `InteriorEnvironment.js`'s
         * ROUND NOTE.
         */
        exposure: 2.4,

        /**
         * 🎯 **THE ROOM IS THE BACKGROUND, SO THE CARD GOES.** `backdrop: false` is what makes item
         * 11.4.4 true rather than decorative: the studio's 8 × 6 emissive card at 1.9 m is replaced
         * by walls that are actually there, at their actual distance, with a gradient across them.
         * ⚠️ `colour` is the clear colour and is never seen — the box encloses the camera.
         */
        background: Object.freeze( {
            colour: 0x14100c,
            backdrop: false,
            distanceMetres: BACKDROP_DISTANCE_METRES
        } ),

        framing: null
    } ),

    /**
     * 🛏️ **`bedroom-morning` — WAKING, AND THE FIRST CONVERSATION OF THE DAY.** Punch-list 11.6.
     *
     * The design doc's own line is *"low sun through a near window, warm bounce, very soft fill,
     * high key-to-fill ratio"*, and every one of those four is a field below rather than a mood.
     *
     * 🎯 **IT IS `kitchen` MIRRORED, AND THE MIRROR IS THE POINT.** `docs/PUNCHLIST.md` 11.4 names
     * what a second interior has to vary so that 11.6 does not author five more of the same
     * picture, and the first item on that list is *"the window on a different WALL."* This room's
     * window is on the **+X** wall where `kitchen`'s is on −X, its sun is on the camera's RIGHT
     * (rig **+58°**) where `kitchen`'s is on the LEFT (rig **−67°**), and its near wall is
     * therefore the one `kitchen` never shows. Nothing in `InteriorEnvironment` changes to do it:
     * `windowOnWall` picks the wall from the azimuth's dominant axis, and both signs of that axis
     * are now exercised by a shipped scene.
     */
    'bedroom-morning': Object.freeze( {
        id: 'bedroom-morning',
        kind: 'interior',

        /**
         * 8° is about 40 minutes after sunrise at mid-latitude, and it is the hour the scene is
         * FOR. It is also the lowest sun in the interior set, and everything that follows from that
         * is derived rather than authored — read off the shipped `solarDiscLight` at THIS scene's
         * own `sky`, not at the defaults:
         *
         *     scene              elev   disc irradiance   colour     CCT      rig key irradiance
         *     bedroom-morning      8°      4.0437e+0      #ffc475   3285 K        0.4249
         *     kitchen             15°      7.7484e+0      #ffd9a2   4042 K        0.7957
         *
         * **757 K warmer and 47% dimmer, with no colour and no level written anywhere in this
         * entry.** ⚠️ The first draft of this block quoted 4.1118e+0 / `#ffc679` / 3347 K, which
         * were solved at `rayleigh: 1.0` before this scene shipped 1.05 — §1.25r in miniature, and
         * the reason every figure in this file now comes out of a script that reads `SCENES`.
         */
        sun: Object.freeze( { elevationDegrees: 8, azimuthDegrees: 70, occlusion: 0 } ),

        sky: Object.freeze( {
            turbidity: 2.4,
            rayleigh: 1.05,
            mieCoefficient: 0.005,
            mieDirectionalG: 0.8
        } ),

        /**
         * 🔴 **THE FIRST VERSION OF THIS ROOM PUT THE BODY CAMERA OUTSIDE IT, AND ONLY THE PLATE
         * SAID SO.** It was `widthMetres` 4.2 at `centreOffsetMetres.x` −1.5, i.e. the +X wall at
         * x = +0.60 — and `frameFigure` stands the body camera at
         * `sin(12°) × 4.05 = **x +0.84**`. The camera was 0.24 m the far side of the wall it was
         * supposed to be looking away from. Nothing threw, no statistic moved, and the plate
         * rendered a flat gold field with no corner, no floor line and no window: we were looking
         * at the room through the back of a wall. The repair is 2.7 m of width at
         * `centreOffsetMetres.x` +0.05 → bounds x [−1.30, +1.40], camera inside by 0.56 m.
         *
         * 🎯 **AND THE ROOM IS NARROW BECAUSE THE FRAME IS ASYMMETRIC — WHICH IS A PROPERTY OF THE
         * CAMERA AND NOT OF THE ROOM.** The camera stands at world azimuth 12°, so its axis crosses
         * the far wall at x = −0.36 rather than at 0, and the strip of that wall a 900×1200 body
         * frame can see is **x ∈ [−1.36, +0.64]**. A corner is therefore reachable on −X and
         * **unreachable on +X for any wall the camera is inside of**. This room takes the −X corner
         * (at −1.30, just inside the strip) while its window is on the +X wall — so the light comes
         * from the side `kitchen`'s does not, and the corner is still in shot. Command:
         * `node scratchpad/ordinary/frame.mjs <scene…>`, which reads the constants out of
         * `Avatar.js` and the bounds out of `resolveRoomGeometry`.
         *
         * ⚠️ `depthMetres` 6.4 at `z` +1.5 keeps the far wall at z = −1.70 and the wall BEHIND the
         * camera at +4.70, 0.65 m clear of the body camera at 4.05 m — `kitchen`'s clearance and
         * `kitchen`'s reason.
         */
        room: Object.freeze( {
            widthMetres: 2.7,
            depthMetres: 6.4,
            heightMetres: 2.55,
            centreOffsetMetres: Object.freeze( { x: 0.05, z: 1.5 } ),

            wall: 0xd9cfc0,
            floor: 0x7a6350,
            ceiling: 0xeae6de,

            window: Object.freeze( {
                azimuthDegrees: 90,
                widthMetres: 1.25,
                heightMetres: 1.45,
                sillMetres: 0.72,
                offsetMetres: -0.6,
                transmission: 0.88
            } ),

            // ⚠️ NO FIXTURE, AND THAT IS A STATEMENT RATHER THAN AN OMISSION. Nobody has the ceiling
            // light on at 8 a.m. with the curtains open, and it is the axis this scene varies
            // against `kitchen`: one room in the set is lit by daylight ALONE, so the fixture term
            // has a null control inside the shipped corpus rather than only inside a probe.
            fixtures: Object.freeze( [] )
        } ),

        lights: Object.freeze( {} ),

        /**
         * 🎯 **"VERY SOFT FILL, HIGH KEY-TO-FILL" IS ONE NUMBER, AND IT IS SMALLER THAN THE
         * KITCHEN'S.** Indoors the fill IS the room — `scene.environment` is a PMREM of the walls,
         * the ceiling and the window — so the analytic panel is shaping and nothing else. At 0.06
         * the portrait fill resolves to 2.20 × 0.06 = **0.132** against a derived key of **0.4249**,
         * a designed key:fill of **3.22** where `kitchen`'s is 2.41 (0.7957 over 0.33). The gate
         * agrees on the picture: L2 cheek:cheek reads **1.7590** here and **1.5730** on `kitchen`.
         *
         * The rim and the kicker are cut for the reason they are cut in every other scene here:
         * `36ba35d` traced `park`'s navy lawn and `beach`'s lilac sand to one saturated `#0f30ff`
         * panel, and there is no blue rim source in a bedroom either. ⚠️ **Raising it back was
         * tried, on this scene, to buy L3 — and refuted in both directions. See the ROUND NOTE.**
         */
        scales: Object.freeze( {
            fill: Object.freeze( { irradiance: 0.06 } ),
            rim: Object.freeze( { irradiance: 0.02, distanceInHeights: 0.5 } ),
            kicker: Object.freeze( { irradiance: 0.10, distanceInHeights: 0.5 } )
        } ),

        ground: Object.freeze( { enabled: true, albedo: 0x7a6350, roughness: 0.6 } ),

        // No air: an interior has no horizon for haze to dissolve, and `InteriorEnvironment`
        // installs no `scene.fogNode` at all.
        air: Object.freeze( { haze: 0 } ),

        /**
         * ⚠️ **THE LADDER, AND IT WAS READ OFF THE PLATE AND NOT OFF THE ROW.** Forehead probe
         * (`250,196,120,46`), scene-linear, against the `studio` control's **5.9640e-1**; CIELAB
         * from the plate's own sRGB on the same patch:
         *
         *     exposure   forehead linear   × control   forehead C*   what the plate shows
         *     1.4            3.470e-1        0.58         42.75       muddy; the wall goes brown
         *     **1.8**      **4.526e-1**    **0.76**     **39.91**     shipped
         *     2.2            6.267e-1        1.05         35.17       the lit cheek starts to wash
         *     2.6            8.126e-1        1.36         30.70       chalky
         *
         * 🚩 **CHROMA RISES AS EXPOSURE FALLS, WHICH IS THE OPPOSITE OF THE INTUITION AND IS THE
         * SAME MECHANISM `beach.exposure` RECORDS**: ACES sheds chroma as it brightens, so "match
         * the control's brightness" and "match the control's colourfulness" pull opposite ways and
         * this scene ships neither extreme.
         *
         * 🔴 **AND THE OBVIOUS ALTERNATIVE — A HIGHER SUN — IS REFUTED ON THE PLATE.** At 13° and
         * the same exposure the forehead reads **1.907e+0**, 3.2× the control, C* 10.13: a white,
         * chroma-poor face. That is `kitchen`'s own chalky-at-3.2 finding arriving through the SUN
         * rather than through the stop, and it is why 8° is a scene decision rather than a default.
         *
         * ⚠️ At C* 39.91 against the control's 16.64 this is the most saturated face in the
         * corpus. It is a 3285 K sun on skin with no chromatic adaptation anywhere in the pipeline
         * — see the ROUND NOTE — and it is quoted rather than tuned away because the picture is a
         * warm morning and the number says so.
         */
        exposure: 1.8,

        background: Object.freeze( {
            colour: 0x191410,
            backdrop: false,
            distanceMetres: BACKDROP_DISTANCE_METRES
        } ),

        framing: null
    } ),

    /**
     * 💻 **`desk` — WORK, THE LONGEST-OCCUPIED SCENE IN A REAL DAY, AND THE ONLY ONE LIT PARTLY FROM
     * THE CAMERA'S OWN SIDE.** Punch-list 11.6.
     *
     * 🚩 **THIS IS THE SCENE THAT TESTS `LightingRig`'s AZIMUTH CONVENTION AND IT IS THE REASON IT
     * IS IN THE ORDINARY SIX.** `LightingRig.js:265-268`: *"0° is a light sitting at the camera
     * (flat frontal), 90° is a pure side light, 180° is directly behind the subject. Positive is
     * toward the camera's right."* Every scene before this one puts every light OFF axis, so a
     * sign error or an origin error in that convention would have been invisible in the whole
     * corpus. Here the screen sits at **+6°** — six degrees off the lens — and eighteen degrees
     * BELOW the horizontal, which is where a monitor actually is when you are looking at a camera
     * above it. If the convention were measured from anywhere else, this fill would land on a
     * cheek instead of under the chin and the plate would say so immediately.
     *
     * The window is the key and it is a hard side light: sun world −60° reaches the rig at
     * **−72°**, which is the widest key in the corpus and is what a desk beside a window is.
     */
    desk: Object.freeze( {
        id: 'desk',
        kind: 'interior',

        sun: Object.freeze( { elevationDegrees: 26, azimuthDegrees: -60, occlusion: 0 } ),

        sky: Object.freeze( {
            turbidity: 3.0,
            rayleigh: 1.0,
            mieCoefficient: 0.005,
            mieDirectionalG: 0.8
        } ),

        /**
         * 🎯 **THE FIRST ROOM IN THE SET WHOSE WALLS ARE NOT WARM**, which is the third item on
         * `kitchen`'s "what a second interior must vary" list. `#c4c8c9` is a cool grey paint and
         * `#4e5052` a grey carpet; every interior before this one had a warm wall and a wood floor,
         * so the wall albedo — the interior's answer to what ground albedo is outdoors — had never
         * been moved off one hue.
         */
        room: Object.freeze( {
            widthMetres: 4.6,
            depthMetres: 6.6,
            heightMetres: 2.7,
            centreOffsetMetres: Object.freeze( { x: 1.1, z: 1.6 } ),

            wall: 0xc4c8c9,
            floor: 0x4e5052,
            ceiling: 0xeceeef,

            // A wide, high-silled window — the shape an office actually has, and it is why this
            // room's key is a side light rather than a top light despite a 26° sun.
            window: Object.freeze( {
                azimuthDegrees: -90,
                widthMetres: 1.6,
                heightMetres: 1.3,
                sillMetres: 1.05,
                offsetMetres: -0.5,
                transmission: 0.84
            } ),

            fixtures: Object.freeze( [
                Object.freeze( { kelvin: 4000, irradiance: 4, heightMetres: 2.56, offsetMetres: 0.5 } )
            ] )
        } ),

        /**
         * 🎯 **THE SCREEN, AND IT IS A `lights` ENTRY RATHER THAN A ROOM FIELD ON PURPOSE.** A
         * monitor is not part of the enclosure — it faces the subject, it is 0.6 m away, and it
         * lights a face and nothing else in the room. That is a rig light by definition, and
         * inventing a `room.screens[]` would be a second lighting model inside a file whose whole
         * argument is that there is one (`docs/PUNCHLIST.md`: *"no second lighting engine"*).
         *
         * ⚠️ **`colour` IS 7500 K AND THE DERIVED 6500 K WAS TRIED FIRST AND DOES NOT READ.**
         * `kelvinToLinearSRGB( 6500 )` normalises to **`#fffefa`** — sRGB's own white point is
         * D65, so a D65 emitter in an unadapted render is white, and a white fill is not a
         * "cool screen fill", it is a second key. 7500 K is `#e6ebff` and it is inside the range
         * consumer displays actually ship at (the sRGB standard is 6504 K; the "cool white" factory
         * default on most consumer panels is 7000–9300 K). So the number is a real display white
         * point rather than a taste, and the derivation it replaced is on the line above.
         *
         * ⚠️ **`irradiance` IS NOT HERE AND MUST NOT BE.** `FORM_LIGHT_OVERRIDES_BY_PRESET` moves
         * the fill 2.20 → 1.20 between portrait and body, so an absolute written here would be
         * 0.55× at one framing and 1.0× at the other with nothing reporting it — the defect
         * `beach.scales`' 🔴 block records in full. Colour, azimuth, elevation and distance ARE
         * identical between the two presets and are safe as absolutes.
         *
         * 🚩 **AND `widthInHeights` IS NOT HERE EITHER, WHICH IS THE HONEST LIMIT OF THIS SCENE.**
         * A monitor is about 0.6 m across at 0.6 m — roughly **1.4 framed heights at portrait and
         * 0.32 at body**, since a "height" is 0.42 m at one framing and 1.87 m at the other. One
         * number cannot be both, and the number that WOULD make it read as a screen rather than as
         * a wash is a 9× area reduction at a fixed irradiance, which is the direction
         * `Scene.js`'s 11.2 ROUND NOTE refutes: a smaller panel at the same irradiance is a higher
         * RADIANCE and skin's subsurface term answers radiance. So the screen is expressed by its
         * DIRECTION and its COLOUR and not by its size, and it reads as a cool underlight rather
         * than as a rectangle. **This is the weakest identity of the six and the report says so.**
         */
        lights: Object.freeze( {
            fill: Object.freeze( {
                azimuthDegrees: 6,
                elevationDegrees: -18,
                colour: 0xe6ebff,
                distanceInHeights: 1.15
            } )
        } ),

        scales: Object.freeze( {
            fill: Object.freeze( { irradiance: 0.45 } ),
            rim: Object.freeze( { irradiance: 0.02, distanceInHeights: 0.5 } ),
            kicker: Object.freeze( { irradiance: 0.10, distanceInHeights: 0.5 } )
        } ),

        ground: Object.freeze( { enabled: true, albedo: 0x4e5052, roughness: 0.7 } ),

        air: Object.freeze( { haze: 0 } ),

        /**
         * ⚠️ **THE WINDOW IS PARTLY ABOVE THE SUBJECT'S BEAM AND THE MODEL SAYS SO:
         * `windowAdmittance` returns **0.9147**, not 1.** A 26° sun through a window whose head is
         * at 2.35 m puts the beam's hit point at y = **2.176 m** against a window centre of 1.70 —
         * 0.476 m up, inside the linear ramp `overlap()` runs over the subject's own 0.42 m width.
         * So the derived key is 1.5392 × 0.9147 × 0.84 = **1.1826**, and this is the first shipped
         * scene where the aperture takes a real bite out of the sun rather than all of it or none.
         *
         * ⚠️ **THE COOL ROOM COSTS CHROMA AND THE COST IS ATTRIBUTED RATHER THAN ASSUMED.** The
         * forehead reads C\* **11.41** against the `studio` control's 16.64, hue 61.6° against
         * 69.4° — cooler and paler, not the hue COLLAPSE `beach` was repaired for (that was hue
         * 6.4°). Three candidate causes were each tested by moving one thing:
         *
         *     arm                                              forehead C*
         *     shipped                                             11.41
         *     the screen fill at irradiance 0 (nothing else)      11.99
         *     warm wall `#cfc9bf` + a 3200 K fitting              12.03
         *
         * **None of them is the cause.** The window's own daylight at 4545 K through a grey-walled
         * enclosure is, and that is what an office in daylight is. Quoted, not tuned.
         */
        exposure: 1.8,

        background: Object.freeze( {
            colour: 0x14161a,
            backdrop: false,
            distanceMetres: BACKDROP_DISTANCE_METRES
        } ),

        framing: null
    } ),

    /**
     * 🛋️ **`living-room` — EVENING, AND THE FIRST SCENE IN THE CORPUS WITH NO DAYLIGHT ON THE
     * SUBJECT AT ALL.** Punch-list 11.6.
     *
     * 🎯 **THE SUN IS ON THE HORIZON AND THE WINDOW ADMITS NOTHING, WHICH IS A BRANCH NO SHIPPED
     * SCENE HAS EVER ENTERED.** `windowAdmittance` returns 0 for `elevationDegrees <= 0` and
     * `sunFluxThroughWindow` returns `[0,0,0]` for a disc that is not above the horizon, so the
     * derived key's irradiance is **exactly 0** and the room's direct solar term is **exactly 0**.
     * What is left is the sky's own dusk radiance through the glass and the two fixtures — which
     * is what an evening living room is.
     *
     * ⚠️ **AND THE HOUR IS THE FLOOR OF WHAT THIS SKY MODEL CAN SAY, WHICH IS STATED RATHER THAN
     * HIDDEN.** `Scene.resolveSceneSun` refuses a negative elevation, and the reason it gives is
     * arithmetic: `SkyMesh`'s own sun-intensity curve reaches exactly zero at about **−2.31°**
     * (`acos( sin e ) = CUTOFF_ANGLE = 92.31°`), below which there is no sun and no gradient left to
     * describe. So 0° is dusk — the last minute of it — and **there is no night sky in this model
     * at all**: no stars, no moon, no city glow. A window at midnight is a dark rectangle here
     * because the model has nothing else to put in it, and `bedside-night` draws a curtain over
     * exactly that limit rather than pretending it away.
     */
    'living-room': Object.freeze( {
        id: 'living-room',
        kind: 'interior',

        sun: Object.freeze( { elevationDegrees: 0, azimuthDegrees: -95, occlusion: 0 } ),

        // A dusk sky: more turbid and more Rayleigh than a morning, which is what reddens a low sun
        // and is the one axis available for "later" once the elevation has bottomed out.
        sky: Object.freeze( {
            turbidity: 3.6,
            rayleigh: 1.2,
            mieCoefficient: 0.008,
            mieDirectionalG: 0.82
        } ),

        room: Object.freeze( {
            widthMetres: 5.0,
            depthMetres: 6.8,
            heightMetres: 2.5,
            centreOffsetMetres: Object.freeze( { x: 1.2, z: 1.6 } ),

            wall: 0xc9c3b8,
            floor: 0x5a4536,
            ceiling: 0xd8d2c8,

            window: Object.freeze( {
                azimuthDegrees: -90,
                widthMetres: 1.5,
                heightMetres: 1.4,
                sillMetres: 0.9,
                offsetMetres: -0.4,
                transmission: 0.9
            } ),

            /**
             * 🎯 **TWO FIXTURES AT ONE COLOUR TEMPERATURE, AND THEY ARE THE WHOLE ROOM.** A table
             * lamp at 1.35 m on the window side and a dimmer one at 2.30 m across the room: with
             * the sun down, `enclosureGain()` has nothing else to work with, so these two numbers
             * ARE the wall's brightness and the falloff between them IS the depth of the room.
             * ⚠️ `irradiance` is in the SKY's units — see `FIXTURE_FIELDS` — which is why they are
             * an order of magnitude above `kitchen`'s 5: that fitting was a top-up beside a sunlit
             * window and these two are the only light in the scene.
             *
             * 🔴 **`offsetMetres` −2.3 IS NOT DECORATION — AT −1.2 THE LAMP WAS IN THE SHOT AND
             * BLOWN WHITE.** `fixturePosition` places a fitting at `centre.x + offsetMetres` on the
             * room's own centre LINE in z, which for a ceiling fitting is above the frame and for a
             * table lamp at 1.35 m is **between the body camera and the subject**. The disc's
             * radiance is `irradiance / (π · 0.11²) · roomIntensity` — a factor of 26.3 on the
             * level — so any fixture that lands in frame is a white hole. −2.3 puts it at x = −1.1,
             * 0.2 m off the window wall and clear of the body frame's ±0.42 m at that depth; at
             * portrait the camera is 0.91 m out and the lamp is behind it.
             * ⚠️ **So a PRACTICAL LAMP IN SHOT IS NOT AVAILABLE IN THIS MODEL** — the fixture is a
             * bare disc with no shade, and a bare bulb at a level that lights a room clips by
             * construction. That is set dressing and it is 11.8.
             * ⚠️ 34 and 4 rather than 26 and 9: the near lamp carries the room and the far one only
             * keeps the opposite corner off black, which is what "deep falloff" is as two numbers.
             */
            fixtures: Object.freeze( [
                Object.freeze( { kelvin: 2700, irradiance: 34, heightMetres: 1.35, offsetMetres: -2.3 } ),
                Object.freeze( { kelvin: 2700, irradiance: 4, heightMetres: 2.30, offsetMetres: 1.6 } )
            ] )
        } ),

        /**
         * 🎯 **THE LAMP IS THE KEY, WRITTEN AS AN ABSOLUTE, AND THE PRECEDENCE THAT LETS IT WIN IS
         * DESIGNED.** `Avatar.lightOverridesFor` applies the derived sun key FIRST and the scene's
         * own `lights` LAST, so a scene can say *"the sun is not what is lighting this"* without a
         * second sun model anywhere. Here the sun's contribution is already 0 and this entry is
         * what replaces it.
         *
         * 🔴 **`colour` IS DERIVED AND THEN PARTIALLY UN-DERIVED, AND THE STEP IS STATED BECAUSE
         * IT IS NOT PHYSICS.** `kelvinToLinearSRGB( 2700 )` normalises to **`#ffa757`**, and
         * shipping that renders an ORANGE FACE: measured on this scene at a fixed exposure of 2.2,
         * the cheek's C\* is **45.50** against the `studio` control's 18.66 — two and a half times
         * the control, on a plate where the skin reads as tanned plastic.
         *
         * The reason is a real absence rather than a tuning failure: **there is no chromatic
         * adaptation anywhere in this pipeline.** A person standing in a 2700 K room adapts and
         * sees the walls as cream; an unadapted camera does not, and neither does `Stage`. So the
         * shipped colour is the derived one mixed 40% toward equal-energy white in LINEAR space,
         * which is a von-Kries-shaped partial adaptation with the fraction written down instead of
         * a hex chosen by eye:
         *
         *     adaptation   colour     CCT      cheek C*   forehead C*   (shipped room, exposure 2.2,
         *     0.00 (raw)   #ffa757   2584 K       45.50        42.67       nothing else moved —
         *     0.25         #ffc29a   3555 K       31.24        29.60       one `lights.key` field
         *     **0.40**   **#ffd0b4** **4170 K** **25.03**    **24.11**     at a time)
         *
         * ⚠️ **The FIXTURES stay at a true 2700 K** and are not adapted, deliberately: they light
         * the WALLS, a warm wall under a warm bulb is what the picture is about, and the number
         * that was too saturated was the one landing on SKIN. That asymmetry is stated rather than
         * smoothed over, because it means the lamp on the wall and the lamp on the face are no
         * longer literally the same colour — 4170 K against 2584 K — and a reader is entitled to
         * know which half was moved and why.
         *
         * ⚠️ **`distanceInHeights` 1.5 IS THE "DEEP FALLOFF" AND IT IS THE SAFE DIRECTION.**
         * `irradiance` is what a light delivers AT THE FOCUS, so distance does not change the
         * level on the face — it changes how fast the level falls ACROSS the figure, which is what
         * a lamp two metres away does and a studio key at 2.6 heights does not. And bringing a
         * panel of unchanged `widthInHeights` CLOSER makes its solid angle LARGER and its radiance
         * LOWER, which is the opposite of the refuted move: `Scene.js`'s ROUND NOTE records that
         * SHRINKING a panel at fixed irradiance raises radiance and grows an orange subsurface glow
         * along the nose, lips and eyelids that no lighting statistic catches. No panel dimension
         * is touched here.
         */
        lights: Object.freeze( {
            key: Object.freeze( {
                azimuthDegrees: 52,
                elevationDegrees: 10,
                colour: 0xffd0b4,
                irradiance: 2.4,
                distanceInHeights: 1.5
            } )
        } ),

        scales: Object.freeze( {
            fill: Object.freeze( { irradiance: 0.10 } ),
            rim: Object.freeze( { irradiance: 0.02, distanceInHeights: 0.5 } ),
            kicker: Object.freeze( { irradiance: 0.10, distanceInHeights: 0.5 } )
        } ),

        ground: Object.freeze( { enabled: true, albedo: 0x5a4536, roughness: 0.5 } ),

        air: Object.freeze( { haze: 0 } ),

        exposure: 2.2,

        background: Object.freeze( {
            colour: 0x120e0a,
            backdrop: false,
            distanceMetres: BACKDROP_DISTANCE_METRES
        } ),

        framing: null
    } ),

    /**
     * 🌙 **`bedside-night` — LATE, QUIET, THE DAY ENDING. ONE SMALL WARM SOURCE BELOW EYE LEVEL AND
     * A NEAR-BLACK SURROUND.** Punch-list 11.6.
     *
     * 🚩 **THE CURTAIN IS AN HONEST ANSWER TO A MODEL LIMIT, NOT A PROP.** There is no night sky in
     * `SkyMesh` — see `living-room` — so the darkest window this system can build is a dusk one.
     * `transmission: 0.05` is a drawn curtain, it is a real thing in a real bedroom at midnight,
     * and it is what takes the window out of the picture without pretending the sky model can do
     * something it cannot. The alternative (a black window) would have had to be authored, and an
     * authored window is the one thing this whole design refuses.
     *
     * ⚠️ **A LAMP BELOW EYE LEVEL IS THE HARDEST LIGHT IN THE ORDINARY SET AND IT IS SUPPOSED TO
     * BE.** `elevationDegrees: -14` puts the key under the brow, which throws the shadow of the
     * nose UP and the shadow of the chin onto the throat — the shape a bedside lamp genuinely makes
     * and the one a studio rig spends its whole existence avoiding.
     */
    'bedside-night': Object.freeze( {
        id: 'bedside-night',
        kind: 'interior',

        sun: Object.freeze( { elevationDegrees: 0, azimuthDegrees: 150, occlusion: 0 } ),

        sky: Object.freeze( {
            turbidity: 4.0,
            rayleigh: 1.3,
            mieCoefficient: 0.01,
            mieDirectionalG: 0.8
        } ),

        room: Object.freeze( {
            widthMetres: 3.4,
            depthMetres: 6.2,
            heightMetres: 2.45,
            centreOffsetMetres: Object.freeze( { x: 1.0, z: 1.6 } ),

            wall: 0x9c8f80,
            floor: 0x4a3a2e,
            ceiling: 0xa9a096,

            window: Object.freeze( {
                azimuthDegrees: -90,
                widthMetres: 1.1,
                heightMetres: 1.3,
                sillMetres: 0.95,
                offsetMetres: -0.3,
                transmission: 0.05
            } ),

            // One bulb, at 0.62 m — a bedside table, not a ceiling. 2200 K is a dimmed incandescent
            // and it is the warmest source in the corpus.
            fixtures: Object.freeze( [
                Object.freeze( { kelvin: 2200, irradiance: 11, heightMetres: 0.62, offsetMetres: -1.5 } )
            ] )
        } ),

        /**
         * The lamp, on the same partial-adaptation rule `living-room` derives in full — one step
         * further, because 2200 K is one step warmer. `kelvinToLinearSRGB( 2200 )` is **`#ff9227`,
         * 2134 K**, and on the shipped room with nothing else moved it renders a cheek C\* of
         * **57.94** against the control's 18.66 — three times the control, the most saturated face
         * this corpus has produced. Shipped at **0.50** adaptation — `#ffd2bd`, 4361 K — which
         * brings the cheek to **23.67** and the forehead 54.55 → 25.63. The FIXTURE stays at a
         * true 2200 K.
         *
         * ⚠️ `elevationDegrees: -14` is the scene's whole point and is not a mistake to be
         * corrected later: the shadow of the nose goes UP and the chin throws onto the throat,
         * which is what a lamp on a bedside table does and what a studio rig exists to avoid.
         */
        lights: Object.freeze( {
            key: Object.freeze( {
                azimuthDegrees: 34,
                elevationDegrees: -14,
                colour: 0xffd2bd,
                irradiance: 1.5,
                distanceInHeights: 1.15
            } )
        } ),

        scales: Object.freeze( {
            fill: Object.freeze( { irradiance: 0.05 } ),
            rim: Object.freeze( { irradiance: 0.02, distanceInHeights: 0.5 } ),
            kicker: Object.freeze( { irradiance: 0.06, distanceInHeights: 0.5 } )
        } ),

        ground: Object.freeze( { enabled: true, albedo: 0x4a3a2e, roughness: 0.5 } ),

        air: Object.freeze( { haze: 0 } ),

        exposure: 2.8,

        background: Object.freeze( {
            colour: 0x0a0806,
            backdrop: false,
            distanceMetres: BACKDROP_DISTANCE_METRES
        } ),

        framing: null
    } ),

    /**
     * 🚦 **`street` — THE COMMUTE, AND THE THIRD EXTERIOR. OVERCAST, WHICH IS THE ONE WEATHER THIS
     * SKY MODEL CAN ACTUALLY EXPRESS.** Punch-list 11.6.
     *
     * 🎯 **THE OVERCAST *LIGHT* IS TWO EXISTING FIELDS AND NO NEW CODE. THE OVERCAST *SKY* IS NOT
     * AVAILABLE AT ALL, AND THAT IS A MEASUREMENT RATHER THAN A COMPROMISE.**
     *
     * The light half works and is the same lever `park` uses at 0.45 for leaf cover: `occlusion` is
     * *"the fraction of the solar DISC hidden by something local the sky model knows nothing
     * about … a passing cloud"*, and it scales the KEY while leaving the hemisphere alone. That
     * asymmetry IS an overcast day — the sun is still delivering its energy, it just arrives from
     * the whole dome instead of from a disc. At **0.68** the key drops to a third and the sky keeps
     * all of it, and the legibility gate reads the result as low contrast without reading it as
     * unreadable (L2 **1.1395**, against a flat-lit null of 1.0270).
     *
     * 🔴 **BUT `docs/PUNCHLIST.md`'s *"overcast is `turbidity` and costs nothing"* IS REFUTED ON
     * THE PLATE.** A real overcast dome is BRIGHT and UNIFORM. Preetham's brightness away from the
     * sun IS its Rayleigh term, so turning the blue down turns the sky OFF rather than white — the
     * zenith goes to near-black while a glow gathers round the sun, which is a dusty evening and
     * not a grey morning. Measured at body framing, everything else held:
     *
     *     turbidity / rayleigh    what the plate actually shows
     *     8.5 / 1.05              a clear blue sky. Not overcast at all.
     *     **8.5 / 0.55**          **pale grey-blue, low contrast — the shipped compromise**
     *     14  / 0.10              dark navy zenith with a bright horizon band
     *     20  / 0.02              near-black overhead, a hot glow at the sun. Worse in every way.
     *
     * So `street` ships a sky that is *hazy and desaturated* rather than *overcast*, and the honest
     * statement is that this scene's WEATHER is in the key and not in the backdrop. A true overcast
     * dome needs a second sky term (a uniform luminance floor, or Perez rather than Preetham) and
     * that is a `SkyEnvironment` request, not a number here.
     */
    street: Object.freeze( {
        id: 'street',
        kind: 'exterior',

        sun: Object.freeze( { elevationDegrees: 38, azimuthDegrees: 22, occlusion: 0.68 } ),

        sky: Object.freeze( {
            turbidity: 8.5,
            rayleigh: 0.55,
            mieCoefficient: 0.021,
            mieDirectionalG: 0.72
        } ),

        room: null,

        /**
         * 🏢 **THE BUILDING BOUNCE, AND IT COMES FROM THE SIDE RATHER THAN FROM BELOW.** `beach`'s
         * fill is a warm ground bounce at −22° because sand under a high sun throws light UP; a
         * street's dominant secondary is the façade opposite, which is a vertical grey surface at
         * roughly eye height. So this fill sits at **+4°** and is near-neutral: `#dfe2e6` is a
         * concrete/glass façade under an overcast dome, not a colour with an opinion.
         *
         * ⚠️ It is deliberately NOT recoloured toward the SURROUND — that is refuted (see the 11.2
         * ROUND NOTE) — it is recoloured toward SKIN's own bounce, which is the job
         * `FORM_LIGHTS.fill` already does at `#f2d2c6`. `#ffb46b` is `beach`'s pre-compensation
         * argument at a different level: ACES sheds chroma as it brightens, so a fill authored at
         * the hue you want lands paler than the hue you want.
         *
         * 🔴 **AND THE FILL IS THE ONE PLACE THIS SCENE HAS TO CHOOSE, WHICH IS QUOTED RATHER THAN
         * HIDDEN.** It is the only warm term on a face otherwise lit entirely by a grey-blue dome,
         * so it buys chroma — and it sits opposite the key, so it costs modelling. Measured on this
         * scene, everything else held:
         *
         *     fill scale   cheek C*   forehead hue   L2 cheek:cheek   verdict
         *     0.75           6.55         16.0°          1.0579        🔴 L2 RED, under the floor
         *     0.55           5.61          4.3°          1.0882        ⚠️ MARGINAL — 0.0035 over a
         *                                                              floor whose whole usable
         *                                                              range is 0.156 stops
         *     **0.32**     **4.53**     **343.0°**     **1.1395**      ✅ shipped
         *
         * Occlusion 0.68 and exposure 1.05 are held across all three; only the fill scale moves.
         * **The chroma is the price of the gate and the gate wins**, and 0.55 is not taken because
         * a value 0.0035 above a floor calibrated on two plates is not a pass anyone should lean
         * on. Cheek C\* 4.53 against the `studio` control's 18.66 is the lowest in the corpus — an
         * overcast dome on skin with no white balance anywhere in the pipeline — and the forehead's
         * hue at 343° is on the magenta side of red rather than the yellow side, which is the
         * `beach` b\* signature at a level too low for the repair that fixed it. ⚠️ A warmer ground
         * was tried as the alternative source of warmth (`#9c8a70` against the shipped `#8a8478`)
         * and moves the cheek by **0.03** — asphalt is not sand, and a dark ground has no bounce.
         * ⚠️ **AND THE NUMBER IS WORSE THAN THE PICTURE**: opened at 900×1200 the plate reads as a
         * person on a grey day, with lip colour and skin that reads as skin. It is quoted because
         * it is the lowest in the corpus, not because the plate is broken.
         */
        lights: Object.freeze( {
            fill: Object.freeze( {
                colour: 0xffb46b,
                elevationDegrees: 4
            } )
        } ),

        scales: Object.freeze( {
            // An overcast day is a high-fill day by definition — that IS what low contrast means —
            // so this is the only scene in the corpus whose fill factor is near unity.
            fill: Object.freeze( { irradiance: 0.32 } ),
            rim: Object.freeze( { irradiance: 0.05, distanceInHeights: 0.5 } ),
            kicker: Object.freeze( { irradiance: 0.50, distanceInHeights: 0.5 } )
        } ),

        // Asphalt. Dark, near-neutral and slightly cool, which is the opposite end of the albedo
        // range from `beach`'s sand at linear 0.3504 — so 11.3's bounce term is exercised at both
        // ends of the corpus rather than only at the bright one.
        ground: Object.freeze( { enabled: true, albedo: 0x8a8478, roughness: 0.75 } ),

        // Urban air, hazier than `beach`'s coastal 0.25 and much hazier than `park`'s enclosed
        // 0.18: a street's distance is buildings under a low overcast, and that is what dissolves.
        air: Object.freeze( { haze: 0.30 } ),

        exposure: 1.05,

        background: Object.freeze( {
            colour: 0xb9bfc4,
            backdrop: false,
            distanceMetres: BACKDROP_DISTANCE_METRES
        } ),

        framing: null
    } )

} );

/** The scene ids `scene` accepts as a shorthand string. */
export const SCENE_IDS = Object.freeze( Object.keys( SCENES ) );

// --- the resolver ----------------------------------------------------------------------------------

/**
 * A scene id, or a partial description, into a frozen scene.
 *
 *     resolveScene( 'studio' )
 *     resolveScene( { id: 'my-room', kind: 'interior', lights: { key: { elevationDegrees: 30 } } } )
 *     resolveScene( { ...SCENES.studio, exposure: 1.2 } )
 *
 * ## What it validates, and the one thing it deliberately does not
 *
 * Everything structural: the id, the kind, unknown top-level fields, unknown light names, unknown
 * placement fields, the shape of `ground`, `air` and `background`. What it does NOT do is
 * range-check a placement number — `Avatar.resolveLightOverrides` owns those ranges and the seven
 * measured pathologies behind them, and duplicating the table here would be a second claim with
 * one gate on it. A scene's `lights` goes through that function on its way to the rig.
 *
 * ⚠️ A PARTIAL IS FILLED FROM `studio` AND NOT FROM NOTHING. A caller who writes
 * `{ id: 'x', kind: 'interior', lights: { … } }` gets the studio card, the studio floor and
 * exposure 1 — a scene that renders — rather than a null background and a frame with no floor. The
 * fields a partial does not mention are the SHIPPED ones, which is the same defaulting rule
 * `resolveBackgroundOption` uses one level up.
 *
 * @param {string|Object} request - a `SCENE_IDS` name, or a description.
 * @returns {Object} frozen, with every field of `SCENE_FIELDS` present.
 */
export function resolveScene( request ) {

    if ( typeof request === 'string' ) {

        const scene = SCENES[ request ];

        if ( scene === undefined ) {

            throw new TypeError( `Scene: scene must be one of ${ SCENE_IDS.join( ', ' ) }, ` +
                `or a description object; got '${ request }'.` );

        }

        // Re-entered through the object path rather than returned, so a named scene cannot be a
        // second door past the validation a described one goes through. If a table entry ever
        // stops satisfying the schema, it is the NAMED path that says so first.
        return resolveScene( { ...scene } );

    }

    if ( request === null || typeof request !== 'object' ) {

        throw new TypeError( 'Scene: scene must be a scene id or a description object — ' +
            `{ ${ SCENE_FIELDS.join( ', ' ) } }.` );

    }

    for ( const key of Object.keys( request ) ) {

        if ( SCENE_FIELDS.includes( key ) === false ) {

            throw new TypeError( `Scene: scene has no field '${ key }'. Accepted: ` +
                `${ SCENE_FIELDS.join( ', ' ) }. ` +
                ( key === 'set' ? 'Set silhouettes are punch-list 11.8 and do not exist yet.' : '' ) +
                ( key === 'environment' ? 'The environment is derived from `sky` or `room`, ' +
                    'never declared — punch-list 11.2 and 11.4.' : '' ) );

        }

    }

    const base = SCENES.studio;

    const id = request.id ?? base.id;

    if ( typeof id !== 'string' || id.length === 0 ) {

        throw new TypeError( `Scene: scene.id must be a non-empty string; got ${ String( id ) }.` );

    }

    const kind = request.kind ?? base.kind;

    if ( SCENE_KINDS.includes( kind ) === false ) {

        throw new TypeError( `Scene: scene.kind must be one of ${ SCENE_KINDS.join( ', ' ) }, ` +
            `got '${ String( kind ) }'.` );

    }

    // 🚩 REFUSED RATHER THAN LEFT TO RENDER AS A STUDIO. An `exterior` with no sky, or an
    // `interior` with no room, is a scene that declares a family it cannot produce — and the
    // symptom is the shipped studio frame under a different name in `report()`, which is precisely
    // the "reported a subsystem that failed to attach as present" defect `Avatar.report()`'s own
    // census rule was written after.
    //
    // ⚠️ AN EXTERIOR NEEDS A **SUN** AS WELL AS A SKY, and that is a 11.2 clause rather than a
    // tidiness one: `SkyMesh`'s `sunPosition` is what produces the sky's own gradient, and the SAME
    // elevation produces the key's colour and irradiance. A sky with no sun would be a scene whose
    // backdrop and whose key could not be the same statement.
    if ( kind === 'exterior' && ( request.sky == null || request.sun == null ) ) {

        throw new TypeError( "Scene: kind 'exterior' needs BOTH a `sun` " +
            `{ ${ SUN_FIELDS.join( ', ' ) } } and a \`sky\` { ${ SKY_FIELDS.join( ', ' ) } }. ` +
            'The sky is drawn from the sun and the key light is derived from the same elevation, ' +
            'so one without the other is a scene whose backdrop and whose light cannot agree.' );

    }

    // 🎯 AND AN INTERIOR NEEDS A **SUN AND A SKY** AS WELL AS A ROOM, WHICH IS THE DESIGN'S ONE
    // IDEA AS A REFUSAL RATHER THAN AS A COMMENT. The window is a portal: its pixels, the walls'
    // radiance and the key are three readings of one `sunPosition`. A room with no sky is a room
    // whose window has to be authored, and an authored window is a second sun.
    if ( kind === 'interior' && ( request.room == null || request.sky == null || request.sun == null ) ) {

        throw new TypeError( "Scene: kind 'interior' needs a `room` " +
            `{ ${ ROOM_FIELDS.join( ', ' ) } } AND both a \`sun\` { ${ SUN_FIELDS.join( ', ' ) } } ` +
            `and a \`sky\` { ${ SKY_FIELDS.join( ', ' ) } }. An interior's window SAMPLES THE SAME ` +
            'SKY AT THE SAME SUN — that is the whole of why the corpus stays small — so a room ' +
            'without one is a window whose light would have to be authored separately, which is ' +
            'the sky/key disagreement 11.2 exists to prevent.' );

    }

    const exposure = request.exposure ?? base.exposure;

    if ( Number.isFinite( exposure ) === false ) {

        throw new TypeError( 'Scene: scene.exposure must be a finite RELATIVE multiplier on the ' +
            `calibrated exposure; got ${ String( exposure ) }. ` +
            '⚠️ Anything but 1 takes report().scene.lighting.calibrated false.' );

    }

    return Object.freeze( {
        id,
        kind,
        sun: resolveSceneSun( request.sun ?? base.sun ),
        sky: resolveSceneSky( request.sky ?? base.sky ),
        room: resolveSceneRoom( request.room ?? base.room ),
        lights: resolveSceneLights( request.lights ?? base.lights ),
        scales: resolveSceneScales( request.scales ?? base.scales ),
        ground: resolveSceneGround( request.ground ?? base.ground ),
        air: resolveSceneAir( request.air ?? base.air ),
        exposure,
        background: resolveSceneBackground( request.background ?? base.background ),
        framing: request.framing ?? base.framing
    } );

}

/**
 * A scene's `lights`, checked against the rig's OWN names and fields.
 *
 * The two rows this closes are measured and are quoted in `Avatar.js`'s `PLACEMENT_FIELDS` block:
 * a fifth light is silently dropped by the real `LightingRig` and a misspelled field is silently
 * merged and ignored. Both would leave a scene that looks like `studio` and claims not to be.
 */
function resolveSceneLights( lights ) {

    if ( lights === null || lights === undefined ) return Object.freeze( {} );

    if ( typeof lights !== 'object' ) {

        throw new TypeError( 'Scene: scene.lights must be an object keyed by light name — ' +
            `${ SCENE_LIGHT_NAMES.join( ', ' ) }.` );

    }

    const resolved = {};

    for ( const [ name, fields ] of Object.entries( lights ) ) {

        if ( SCENE_LIGHT_NAMES.includes( name ) === false ) {

            throw new TypeError( `Scene: scene.lights has no light '${ name }'. The rig has ` +
                `${ SCENE_LIGHT_NAMES.join( ', ' ) }, and a fifth entry is SILENTLY DROPPED by ` +
                'LightingRig rather than refused — which is why this is checked here. A scene that ' +
                'needs a light the rig cannot express is a request against LightingRig, not a fork.' );

        }

        if ( fields === null || typeof fields !== 'object' ) {

            throw new TypeError( `Scene: scene.lights.${ name } must be an object of placement ` +
                `fields — ${ SCENE_PLACEMENT_FIELDS.join( ', ' ) }.` );

        }

        for ( const field of Object.keys( fields ) ) {

            if ( SCENE_PLACEMENT_FIELDS.includes( field ) === false ) {

                throw new TypeError( `Scene: scene.lights.${ name } has no field '${ field }'. ` +
                    `Accepted: ${ SCENE_PLACEMENT_FIELDS.join( ', ' ) }. ` +
                    ( field === 'name' ? '⚠️ `name` is deliberately unreachable: aimRigAt and the ' +
                        "rig's own spill partition both key off it." : '' ) );

            }

        }

        resolved[ name ] = Object.freeze( { ...fields } );

    }

    return Object.freeze( resolved );

}

/**
 * A scene's `scales`, checked against the same names and a NUMERIC subset of the same fields.
 *
 * 🚩 A FACTOR IS REFUSED AT ZERO AND BELOW, AND THAT IS NOT TIDINESS. `scales` is resolved by
 * multiplying the framing's authored value, so a negative factor produces a NEGATIVE irradiance and
 * a zero factor produces `distanceInHeights: 0`, which `Avatar.js`'s `PLACEMENT_FIELDS` table
 * measured putting **NaN into the scene graph** with nothing thrown anywhere in the chain. The
 * absolute path refuses those at `resolveLightOverrides`; the multiplier path has to refuse them
 * here, because 0 and −1 are perfectly legal NUMBERS and only become illegal after the multiply.
 *
 * ⚠️ "No rim" is therefore `lights: { rim: { irradiance: 0 } }` — absolute, legal, and safe at both
 * framings because zero is zero at either — and never `scales: { rim: { irradiance: 0 } }`.
 */
function resolveSceneScales( scales ) {

    if ( scales === null || scales === undefined ) return Object.freeze( {} );

    if ( typeof scales !== 'object' ) {

        throw new TypeError( 'Scene: scene.scales must be an object keyed by light name — ' +
            `${ SCENE_LIGHT_NAMES.join( ', ' ) } — whose values are FACTORS on whatever the current ` +
            'framing authored, in the shape SCENE_LOOKS.scales already uses.' );

    }

    const resolved = {};

    for ( const [ name, fields ] of Object.entries( scales ) ) {

        if ( SCENE_LIGHT_NAMES.includes( name ) === false ) {

            throw new TypeError( `Scene: scene.scales has no light '${ name }'. The rig has ` +
                `${ SCENE_LIGHT_NAMES.join( ', ' ) }.` );

        }

        if ( fields === null || typeof fields !== 'object' ) {

            throw new TypeError( `Scene: scene.scales.${ name } must be an object of FACTORS on the ` +
                `placement fields — ${ SCENE_SCALE_FIELDS.join( ', ' ) }.` );

        }

        for ( const [ field, factor ] of Object.entries( fields ) ) {

            if ( SCENE_SCALE_FIELDS.includes( field ) === false ) {

                throw new TypeError( `Scene: scene.scales.${ name } cannot scale '${ field }'. ` +
                    `Scalable: ${ SCENE_SCALE_FIELDS.join( ', ' ) }. ` +
                    ( field === 'colour' ? '⚠️ A hex is not a scalar — 0xffeeda x 0.5 is a different ' +
                        'HUE, not a dimmer light. State a colour in `lights`, where it is absolute.' : '' ) );

            }

            if ( Number.isFinite( factor ) === false || factor <= 0 ) {

                throw new TypeError( `Scene: scene.scales.${ name }.${ field } must be a POSITIVE ` +
                    `finite factor on the framing's authored value; got ${ String( factor ) }. ` +
                    'A factor of 0 or less multiplies into a negative irradiance or a zero distance, ' +
                    'and LightingRig puts both into the scene graph without a word. ' +
                    'For "no rim" write lights: { rim: { irradiance: 0 } }, which is absolute and ' +
                    'therefore means the same thing at both framings.' );

            }

        }

        resolved[ name ] = Object.freeze( { ...fields } );

    }

    return Object.freeze( resolved );

}

/**
 * A scene's `sun`. Null for a studio; two angles and an occlusion for anything with a sky.
 *
 * Ranges are checked HERE rather than at `SkyMesh`, because `SkyMesh` validates nothing at all: a
 * NaN elevation produces a `sunPosition` of NaN, `fromScene` bakes a cube of NaN, every material
 * that samples it renders black, and no call in the chain throws. That is the same silent-drop shape
 * `PLACEMENT_FIELDS` was written against one file over.
 */
function resolveSceneSun( sun ) {

    if ( sun === null || sun === undefined ) return null;

    if ( typeof sun !== 'object' ) {

        throw new TypeError( `Scene: scene.sun must be null or { ${ SUN_FIELDS.join( ', ' ) } }.` );

    }

    for ( const key of Object.keys( sun ) ) {

        if ( SUN_FIELDS.includes( key ) === false ) {

            throw new TypeError( `Scene: scene.sun has no field '${ key }'. ` +
                `Accepted: ${ SUN_FIELDS.join( ', ' ) }. ` +
                ( key === 'kelvin' || key === 'colour' || key === 'irradiance'
                    ? '⚠️ The sun\'s colour and irradiance are DERIVED from its elevation through ' +
                      "SkyMesh's own extinction, never declared — a second statement of them is how " +
                      'a sky and its key come to disagree.'
                    : '' ) +
                ( key === 'hour' ? 'Time of day is 11.6 and resolves to an elevation and an azimuth.' : '' ) );

        }

    }

    const elevationDegrees = sun.elevationDegrees;

    // ⚠️ THE FLOOR IS THE HORIZON AND IT IS NOT PEDANTRY. Below it `SkyMesh`'s sun-intensity curve
    // has already gone to zero through its own `max( 0, … )`, so a negative elevation is a scene
    // with a black sky and a key of exactly zero — a picture, but not one any of these fields
    // describe. Night is a `room` with fixtures (11.4), not a sun underground.
    if ( Number.isFinite( elevationDegrees ) === false || elevationDegrees < 0 || elevationDegrees > 90 ) {

        throw new TypeError( 'Scene: scene.sun.elevationDegrees must be in [0, 90] — degrees above ' +
            `the horizon; got ${ String( elevationDegrees ) }. Below the horizon SkyMesh's own ` +
            'sun-intensity curve is already zero, so a negative elevation is a black sky and a key ' +
            'of nothing. An evening scene is punch-list 11.4, with fixtures.' );

    }

    const azimuthDegrees = sun.azimuthDegrees;

    if ( Number.isFinite( azimuthDegrees ) === false || azimuthDegrees < -360 || azimuthDegrees > 360 ) {

        throw new TypeError( 'Scene: scene.sun.azimuthDegrees must be a WORLD azimuth in ' +
            `[-360, 360], about +Y from +Z and positive toward +X; got ${ String( azimuthDegrees ) }. ` +
            '⚠️ This is NOT LightingRig\'s azimuth, which is measured from the camera.' );

    }

    const occlusion = sun.occlusion ?? 0;

    if ( Number.isFinite( occlusion ) === false || occlusion < 0 || occlusion > 1 ) {

        throw new TypeError( 'Scene: scene.sun.occlusion must be the fraction of the solar disc ' +
            `hidden by local cover, in [0, 1]; got ${ String( occlusion ) }.` );

    }

    return Object.freeze( { elevationDegrees, azimuthDegrees, occlusion } );

}

/**
 * A scene's `sky`. `SkyMesh`'s four uniforms, defaulted from `SKY_DEFAULTS` and range-checked.
 *
 * The bands below are the model's own usable range rather than opinions: `turbidity` under 1 makes
 * `betaM` negative, and `rayleigh` under 0 makes `betaR` negative — either of which is an
 * extinction that AMPLIFIES with distance and produces a sky brighter than its own sun.
 */
function resolveSceneSky( sky ) {

    if ( sky === null || sky === undefined ) return null;

    if ( typeof sky !== 'object' ) {

        throw new TypeError( `Scene: scene.sky must be null or { ${ SKY_FIELDS.join( ', ' ) } }.` );

    }

    for ( const key of Object.keys( sky ) ) {

        if ( SKY_FIELDS.includes( key ) === false ) {

            throw new TypeError( `Scene: scene.sky has no field '${ key }'. ` +
                `Accepted: ${ SKY_FIELDS.join( ', ' ) }. ` +
                ( key === 'cloudCoverage' || key === 'cloudDensity' || key === 'cloudElevation'
                    || key === 'cloudScale' || key === 'cloudSpeed'
                    ? '🚩 SkyMesh\'s clouds are DRIVEN BY THE TSL `time` NODE, so an environment ' +
                      'baked with them on is a different environment on every bake — no plate in ' +
                      'this repository would be reproducible. They are forced to zero. Weather ' +
                      'needs a decision about the clock first, and that is not 11.2.'
                    : '' ) +
                ( key === 'sunPosition' ? 'The sun is `scene.sun`, in degrees.' : '' ) );

        }

    }

    const bands = {
        turbidity: [ 1, 20 ],
        rayleigh: [ 0, 4 ],
        mieCoefficient: [ 0, 0.1 ],
        mieDirectionalG: [ 0, 0.999 ]
    };

    const resolved = {};

    for ( const field of SKY_FIELDS ) {

        const value = sky[ field ] ?? SKY_DEFAULTS[ field ];
        const [ low, high ] = bands[ field ];

        if ( Number.isFinite( value ) === false || value < low || value > high ) {

            throw new TypeError( `Scene: scene.sky.${ field } must be in [${ low }, ${ high }]; ` +
                `got ${ String( value ) }.` );

        }

        resolved[ field ] = value;

    }

    return Object.freeze( resolved );

}

/** A scene's `ground`. `true`/`false` is accepted as the shorthand `background.ground` already is. */
/**
 * A scene's `room`, checked against `ROOM_FIELDS`, `WINDOW_FIELDS` and `FIXTURE_FIELDS`.
 *
 * 🚩 DENY-BY-DEFAULT, FOR THE REASON THE WHOLE FILE IS. `Avatar.js`'s `PLACEMENT_FIELDS` block
 * carries the measurement this rule was written after: handed a field it does not know, the real
 * `LightingRig` merges it and ignores it, and nothing anywhere says so. A room is worse, not better
 * — `InteriorEnvironment` reads `room.window.widthMetres`, and a typo'd `widthMeters` would build a
 * window of `undefined` metres, `NaN` its way into a uniform, and render a room that is silently
 * black with no error on any path.
 *
 * ⚠️ `window` IS REQUIRED AND HAS NO DEFAULT. A room with no window is a room with no light in this
 * model at all — the fixtures are a second source, not the first one — and defaulting one in would
 * be inventing the scene's own subject.
 */
function resolveSceneRoom( room ) {

    if ( room === null || room === undefined ) return null;

    if ( typeof room !== 'object' ) {

        throw new TypeError( `Scene: scene.room must be an object — { ${ ROOM_FIELDS.join( ', ' ) } }.` );

    }

    refuseUnknown( room, ROOM_FIELDS, 'scene.room' );

    for ( const name of [ 'wall', 'floor', 'ceiling' ] ) {

        if ( Number.isInteger( room[ name ] ) === false ) {

            throw new TypeError( `Scene: scene.room.${ name } must be an sRGB hex ALBEDO — the ` +
                'room\'s brightness is derived from the sky through its window and is never ' +
                `authored; got ${ String( room[ name ] ) }.` );

        }

    }

    if ( room.window == null || typeof room.window !== 'object' ) {

        throw new TypeError( 'Scene: scene.room needs a `window` — ' +
            `{ ${ WINDOW_FIELDS.join( ', ' ) } }. A room with no window has no daylight in it, and ` +
            'defaulting one in would be inventing the scene.' );

    }

    refuseUnknown( room.window, WINDOW_FIELDS, 'scene.room.window' );

    for ( const name of [ 'azimuthDegrees', 'widthMetres', 'heightMetres', 'sillMetres' ] ) {

        if ( Number.isFinite( room.window[ name ] ) === false ) {

            throw new TypeError( `Scene: scene.room.window.${ name } must be a finite number; ` +
                `got ${ String( room.window[ name ] ) }.` );

        }

    }

    for ( const fixture of room.fixtures ?? [] ) {

        refuseUnknown( fixture, FIXTURE_FIELDS, 'scene.room.fixtures[]' );

        if ( Number.isFinite( fixture.kelvin ) === false || Number.isFinite( fixture.irradiance ) === false ) {

            throw new TypeError( 'Scene: a room fixture is { kelvin, irradiance, heightMetres, ' +
                `offsetMetres } and needs both of the first two; got ${ JSON.stringify( fixture ) }. ` +
                '⚠️ `irradiance` is in the SKY\'s units, not the rig\'s — see FIXTURE_FIELDS.' );

        }

    }

    return room;

}

/** One refusal, one message, used by every clause above. */
function refuseUnknown( object, known, where ) {

    for ( const key of Object.keys( object ) ) {

        if ( known.includes( key ) === false ) {

            throw new TypeError( `Scene: ${ where } has no field '${ key }'. Accepted: ` +
                `${ known.join( ', ' ) }. ` +
                ( /Meters$/.test( key ) ? 'This project spells it `Metres`.' : '' ) +
                ( key === 'color' ? 'This project spells it `colour`.' : '' ) );

        }

    }

}

function resolveSceneGround( ground ) {

    if ( typeof ground === 'boolean' ) return Object.freeze( { enabled: ground, albedo: null, roughness: null } );

    if ( ground === null || typeof ground !== 'object' ) {

        throw new TypeError( 'Scene: scene.ground must be true, false, or ' +
            '{ enabled, albedo, roughness }.' );

    }

    for ( const key of Object.keys( ground ) ) {

        if ( [ 'enabled', 'albedo', 'roughness' ].includes( key ) === false ) {

            throw new TypeError( `Scene: scene.ground has no option '${ key }'. ` +
                'Accepted: enabled, albedo, roughness.' );

        }

    }

    const enabled = ground.enabled ?? true;

    if ( typeof enabled !== 'boolean' ) {

        throw new TypeError( `Scene: scene.ground.enabled must be true or false, got ${ typeof enabled }. ` +
            '⚠️ false is a documented downgrade: 60% of the light landing beside a sole comes from ' +
            'two RectAreaLights that cannot cast a shadow at all, which is why GroundContact ' +
            'occludes analytically. Without the plane the figure floats.' );

    }

    // ✅ `albedo` AND `roughness` ARE NOW READ — punch-list 11.3 — AND THEY ARE READ TWICE, WHICH IS
    // THE POINT OF THE ITEM. `Avatar` hands them to `GroundContact`, which shades the plane the
    // figure stands on; and `SkyEnvironment` puts a disc of the SAME albedo into the environment
    // bake, so the lower hemisphere of the image-based light stops being horizon sky and becomes a
    // floor. The second half is what fills the underside of a jaw on a beach, and it is measurable:
    // remove the disc and the jaw goes dark while the frame mean barely moves.
    //
    // ⚠️ `null` MEANS "WHATEVER THE SUBSYSTEM ALREADY SHIPPED" AND NOT "BLACK". `GroundContact`'s
    // own `FLOOR_ALBEDO` is what the studio plate was measured on, and a studio scene must keep it.
    return Object.freeze( {
        enabled,
        albedo: ground.albedo ?? null,
        roughness: ground.roughness ?? null
    } );

}

/** A scene's `air`. 11.5. One number today, and it does nothing until the fog exists. */
function resolveSceneAir( air ) {

    if ( air === null || air === undefined ) return Object.freeze( { haze: 0 } );

    if ( typeof air !== 'object' ) throw new TypeError( 'Scene: scene.air must be { haze }.' );

    for ( const key of Object.keys( air ) ) {

        if ( key !== 'haze' ) {

            throw new TypeError( `Scene: scene.air has no option '${ key }'. Accepted: haze.` );

        }

    }

    const haze = air.haze ?? 0;

    if ( Number.isFinite( haze ) === false || haze < 0 || haze > 1 ) {

        throw new TypeError( `Scene: scene.air.haze must be a number in [0, 1]; got ${ String( haze ) }.` );

    }

    return Object.freeze( { haze } );

}

/**
 * A scene's `background`.
 *
 * ⚠️ **THIS IS NOT WHERE `transparent` IS REFUSED.** `colour: null` passes here and is refused by
 * `Avatar.resolveBackgroundOption`, which carries the measurement and the two isolated blockers.
 * One refusal, one message, one gate — see the `transparent` entry above.
 */
function resolveSceneBackground( background ) {

    if ( background === null || typeof background !== 'object' ) {

        throw new TypeError( 'Scene: scene.background must be { colour, backdrop, distanceMetres }.' );

    }

    const known = [ 'colour', 'backdrop', 'distanceMetres' ];

    for ( const key of Object.keys( background ) ) {

        if ( known.includes( key ) === false ) {

            throw new TypeError( `Scene: scene.background has no option '${ key }'. ` +
                `Accepted: ${ known.join( ', ' ) }. ` +
                ( key === 'color' ? 'This project spells it `colour`.' : '' ) +
                ( key === 'ground' ? 'The floor is `scene.ground`, not part of the background.' : '' ) );

        }

    }

    const distanceMetres = background.distanceMetres ?? BACKDROP_DISTANCE_METRES;

    if ( Number.isFinite( distanceMetres ) === false || distanceMetres <= 0 ) {

        throw new TypeError( 'Scene: scene.background.distanceMetres must be a positive distance ' +
            `BEHIND THE FRAMING FOCUS, in metres; got ${ String( distanceMetres ) }.` );

    }

    return Object.freeze( {
        colour: background.colour === undefined ? SCENE_CLEAR_COLOUR : background.colour,
        backdrop: background.backdrop === undefined ? BACKDROP_EMISSIVE : background.backdrop,
        distanceMetres
    } );

}

// --- what a consumer reads off a scene -------------------------------------------------------------

/**
 * The scene's room, in the shape `Avatar.resolveBackgroundOption` already accepts.
 *
 * 🎯 THE POINT OF THIS FUNCTION IS THAT THERE IS NO SECOND BACKGROUND PATH. A scene does not write
 * `scene.background` or build a card; it produces the same `{ colour, backdrop, ground }` request
 * an embedder would have typed, and that request goes through the same resolver, the same
 * validation and the same refusals. `Scene.selftest.mjs` clause B holds `studio` through this
 * function bit-equal to `BACKGROUND_PRESETS.studio`.
 */
export function backgroundRequestOf( scene ) {

    return {
        colour: scene.background.colour,
        backdrop: scene.background.backdrop,
        ground: scene.ground.enabled
    };

}

/**
 * The scene's light, in the shape `Avatar.resolveLightingOption` already accepts.
 *
 * ⚠️ **A SCENE DOES NOT CARRY A `look`.** Looks (`SCENE_LOOKS` in `Avatar.js`) are the EMBEDDER's
 * axis — warm for a companion UI, cool for a product one — and they are multipliers on whatever
 * the current framing authored. A scene setting a look would silently overrule a caller who had
 * already chosen one, and the two axes are meant to compose: the scene says where the figure is,
 * the look says how the host page wants it to feel. So `look` is left at the caller's value and a
 * scene reaches the rig through `lights` and `exposure` only.
 */
export function lightingRequestOf( scene ) {

    return {
        exposure: scene.exposure,
        lights: scene.lights,
        scales: scene.scales
    };

}

/**
 * The scene's environment, in the shape `render/SkyEnvironment.js`'s constructor accepts — or
 * `null` for a scene that has none.
 *
 * 🎯 SAME ARGUMENT AS THE TWO FUNCTIONS ABOVE, AND IT IS THE ONE THAT KEEPS `studio` A CONTROL.
 * `studio` returns `null` here and gets no environment, no PMREM and no `scene.environment` — so
 * the calibration control keeps EXACTLY the light path `docs/CHECKPOINT.md` §7 decomposed, IBL at
 * 0.00% included. The exterior branch in `Avatar.build` is entered on this function's return value
 * and on nothing else, which is what makes "studio is byte-identical" a property of one `if` rather
 * than of a reader's care.
 *
 * ⚠️ `interior` will return non-null here too when 11.4 lands, with `room` where `sky` is. The
 * caller branches on the SHAPE and not on the kind, deliberately.
 */
export function environmentRequestOf( scene ) {

    // 🎯 11.4. THE `room` IS TESTED FIRST AND THE CALLER BRANCHES ON THE SHAPE, exactly as the
    // header of this function promised it would. An interior carries a `sky` too — it needs one, the
    // window is a portal — so a test on `sky` alone would build an EXTERIOR for a kitchen: a sky
    // backdrop, no walls, and a `report()` that says `kind: 'interior'` over a beach.
    if ( scene.room !== null ) {

        return {
            sun: scene.sun,
            sky: scene.sky,
            room: scene.room,
            ground: scene.ground
        };

    }

    if ( scene.sky === null ) return null;

    // 11.5. `air` rides along because the haze's COLOUR is the sky's — `SkyEnvironment` is the only
    // object that holds the baked backdrop the aerial node reads back, so it is the only place the
    // air can be built. A scene with no sky has nothing for haze to dissolve into and gets none.
    return {
        sun: scene.sun,
        sky: scene.sky,
        ground: scene.ground,
        air: scene.air
    };

}

// ❓ --- THE ONE QUESTION 11.1 LEAVES OPEN ----------------------------------------------------------
//
/**
 * ❓ **OPEN, AND DELIBERATELY NOT DECIDED HERE: WHAT A SCENE DOES TO
 * `report().scene.lighting.calibrated`.**
 *
 * Today that flag is `exposure === EXPOSURE_CALIBRATION && ambientFractionOfKey === shipped`, and
 * it goes false the moment either moves. It means one thing and means it correctly: *"this frame is
 * comparable with the numbers the critic has judged."*
 *
 * Every scene past `studio` moves the light by definition, so every scene will read `false` — which
 * is true, and useless, because a flag that is false for eleven of twelve scenes tells a reader
 * nothing about which of them are in trouble. The three candidate answers are written down in
 * `docs/research/scene-system.md` §7 and the design picks the third (gate the SUBJECT'S LEGIBILITY
 * — ratios, ranks and masked statistics — rather than absolute pixel values), but that is 11.7's
 * decision and it needs the user's call on the reporting contract, not this file's.
 *
 * What 11.1 does NOT do, so the question stays open rather than being answered by accident: it does
 * not touch the flag, and the `studio` scene resolves to exposure 1 and ambient 1, so the flag
 * reads exactly as it does today on the shipped default.
 */
// 📋 --- ROUND NOTE: 11.2 / 11.3, measured 2026-08-17 -----------------------------------------------
//
/**
 * 📋 **WHERE THE TWO EXTERIORS' NUMBERS CAME FROM, AND THE TWO THINGS THAT WERE TRIED AND REFUTED.**
 *
 * Every figure below is from `tools/critic/scene-probe.mjs` driving
 * `tools/critic/avatar-plate.html` at 900×1200, 1 step at 60 fps, seed 1, frozen, quality `auto`
 * (which resolves to `balanced` for a backdropless scene), on apple/metal-3 WebGPU. Luminances are
 * SCENE-LINEAR — the plate's ACES + sRGB is inverted by `lightpath-probe.mjs`, which validates that
 * inverse against arithmetic and against additivity on real pixels before it reports anything.
 *
 * ## The exposure ladder, which is how `exposure` stopped being a guess
 *
 *     forehead probe (250,196,120,46)      studio control  5.9640e-1
 *     beach  exposure 0.62                 2.7424e-1     beach  exposure 1.00   4.4460e-1
 *     beach  exposure 1.28  →  6.0670e-1   (1.017× the control)
 *     park   exposure 0.82                 1.6117e-1     park   exposure 1.90   4.2741e-1 (SHIPPED)
 *
 * ⚠️ **THE `beach` ROW IS SUPERSEDED AND IS KEPT ONLY AS THE LADDER'S SHAPE.** It was solved
 * against a fill of 0.70; the fill is now a warm bounce at 0.58 × the framing's authored value and
 * the same probe reads higher at every rung, so `exposure` was re-anchored to **1.22**. The
 * re-solve, in CIELAB on the same forehead skin, is in the `beach.exposure` block. ⚠️ **A LADDER
 * TAKEN BEFORE A RETUNE IS THE EXACT DEFECT THIS FILE WAS CORRECTED FOR ONCE ALREADY** — see the
 * 🚩 in `docs/PUNCHLIST.md` 11.2 — which is why the row is marked rather than silently left.
 *
 * ## 🔴 REFUTED #1: DERIVING THE KEY'S PANEL SIZE FROM THE SUN'S ANGULAR DIAMETER
 *
 * The design doc calls a beach "a hard, small source", and the obvious next step after deriving the
 * key's direction, colour and irradiance from `SkyMesh` is to derive its SIZE too: the sun subtends
 * 0.533°, so at `distanceInHeights` 2.6 a physically-sized panel is **0.0242 heights** against the
 * studio key's 2.0 × 2.8.
 *
 * **It is wrong, and it is wrong in a way no lighting statistic would have caught.** Measured:
 *
 *     key panel        forehead      jaw underside   what the plate looks like
 *     2.0 x 2.8 heights (shipped)  5.6236e-1   1.7093e-1   correct
 *     0.25 x 0.25                  5.4321e-1   1.6518e-1   ORANGE SSS GLOW on nose, lips, eyelids
 *     0.0242 x 0.0242 (physical)   8.6787e-1   ALL CLIPPED  blown
 *
 * A small panel at the same irradiance is a very high RADIANCE, and the skin's subsurface term
 * responds to radiance: the picture grows a fire-coloured rim inside every thin feature. The
 * forehead mean barely moves at 0.25 — a rig-level statistic reads the two as nearly identical —
 * and the plate is obviously broken. **This is why the item's instruction is to look at the plate.**
 *
 * ⏭️ So the derived key carries FOUR fields and panel geometry is not one of them. A genuinely hard
 * outdoor key is a request against `LightingRig` for a source model whose SSS response is bounded,
 * not a number to type into this table.
 *
 * ## 🔴 REFUTED #2: RECOLOURING THE RIM TO THE SKY'S OWN HUE
 *
 * With the fill cut from 2.20 to 0.70 the shipped rim at irradiance 16 is 23× the fill where in the
 * studio it was 7.3×, and the saturated `#0f30ff` edge is correspondingly louder. The physical-
 * sounding fix — outdoors the thing behind the subject IS the sky, so give the rim the sky's hue —
 * produces the SAME orange subsurface glow as a small panel, for the same reason: a desaturated rim
 * puts far more red through the skin than a deep blue one does. Dropping the rim's IRRADIANCE to
 * 5.1 (the same 0.32 factor the fill took) does clean the edge up and keeps the hue.
 *
 * ✅ **NOW SHIPPED, AS A FACTOR.** The blocker was real and it was the SHAPE of the value rather
 * than the value: a scene's `lights` are absolute and `EDGE_LIGHTS` is authored per framing. Both
 * exteriors now carry `scales: { rim: { irradiance: 0.1625 } }`, which is 2.60 at portrait and
 * 3.575 at body, re-resolved by `setFraming` against whichever table is live. 0.1625 rather than
 * 0.32 because 5.1 leaves the eye-socket halo legible on the plate and 2.6 does not — looked at,
 * both, before either was written down. See `SCENE_SCALE_FIELDS` and `Scene.selftest.mjs` G13.
 *
 * ## What the environment is worth, on the same probes
 *
 *     scene    forehead IBL share   jaw-underside IBL share   frame mean, env removed
 *     studio         0.00%                 0.00%              no change (the null control)
 *     beach         27.50%                56.05%              3.7286e-1 -> 3.0361e-1  (-18.57%)
 *
 * ⚠️ **THAT ROW READ 27.03% / 64.58% / −19.02% UNTIL `a12dcf6` AND EVERY ABSOLUTE IN IT WAS OUT BY
 * A FACTOR OF TWO** — the beach was probed before the scene was retuned and never probed again.
 * The figures above are the corrected ones. ⚠️ **AND THEY ARE THEMSELVES PRE-RETUNE NOW**: this
 * round moved the fill, the rim and the exposure. Re-probed on the shipped tree after the last
 * edit with `tools/critic/scene-probe.mjs --ibl` — `beach` forehead **25.92%**, jaw underside
 * **39.03%**, frame red proof **−17.65%**; `park` forehead **38.22%**, jaw **44.26%**, frame
 * **−22.12%**; `studio` **0.00% / 0.00%** as the null control. (⚠️ This sentence used to say "the
 * post-retune shares are in the round note below" and they were nowhere in the tree — a forward
 * reference to numbers that were measured, quoted in the round's own claim, and never written
 * down. Ninth §1.25r, and the cheapest kind: not a wrong number, an absent one behind a promise.)
 * The durable repair is REQ-091 — the probe must EMIT these rows, because a row that is retyped
 * after a retune is a row nobody re-runs.
 *
 * and the ground's own half, over four albedos spanning 70.28× of linear reflectance: the jaw moves
 * 5.0038e-2 → 1.0496e-1 monotonically, **2.0976×**, while the same sweep with the ground taken out
 * of the environment bake moves **1.0000×** and the whole-frame mean moves 1.0993×. ⚠️ Those three
 * figures were corrected at `a12dcf6` to 1.2794e-1 → 2.4162e-1, **1.8885×**, null 1.0000×, frame
 * 1.0974× — and the CONCLUSION survived the correction untouched, which is the distinction worth
 * keeping: monotone, null exact, mask an order of magnitude more sensitive than the frame mean.
 */
// 📋 --- ROUND NOTE: the skin outdoors, measured 2026-08-18 ------------------------------------------
//
/**
 * 📋 **WHY BOTH EXTERIORS MADE THE SUBJECT LOOK WORSE THAN THE CONTROL, TRACED RATHER THAN GUESSED.**
 *
 * The round before this one landed the sky, measured it, and wrote down that the picture did not
 * cash it: beach skin chalky, park skin grey-green, `studio` beside them warm and believable. This
 * is what it was.
 *
 * ## 🎯 THE DIAGNOSIS IS ONE NUMBER: `b*`, AND `a*` NEVER MOVED
 *
 * A luma gate cannot see "the skin desaturated", so the round is measured in CIELAB on the plate's
 * own sRGB — display-referred, because the defect is in the picture a person sees, after ACES and
 * after the OETF. The operator is `chroma`: C* = √(a*² + b*²) over a MASKED rect of cheek, validated
 * against three published sRGB→Lab conversions and a red proof before it was pointed at a render.
 * Masked because a portrait plate is ~40% sky and six of this project's eight structurally blind
 * statistics were whole-frame means.
 *
 *     `cheek` (320,400…) — regions.lighting-portrait.json's own G2 skin, 900×1200, 1 step, seed 1
 *
 *     arm                              L*      a*      b*      C*      h*
 *     studio, the control            81.64   10.16   10.98   14.96   47.2°
 *     beach as it shipped            77.94   11.20    1.26   11.27    6.4°
 *     park  as it shipped            78.67   11.47    0.43   11.48    2.1°
 *
 * **`a*` is unchanged or higher on both. `b*` collapses by an order of magnitude.** The skin did not
 * lose its red, it lost its YELLOW, and the hue rotated 41–45° off skin. That is what a blue
 * illuminant does. Attribution, one term at a time, on the shipped `beach`:
 *
 *     what was removed                       cheek b*   cheek C*   hue
 *     nothing (shipped)                        1.26      11.27     6.4°
 *     `scene.environment` nulled               8.99      19.70    27.2°
 *     the rim deleted                          8.11      12.61    40.1°
 *     the fill recoloured warm at SAME E       3.33      12.56    15.4°
 *     exposure 1.28 → 0.80 (DARKER than the control)   0.98      14.71     3.8°
 *
 * 🎯 **THE LAST ROW IS THE ONE THAT SETTLES IT.** ACES does shed chroma as it brightens — C* rises
 * 11.27 → 14.71 as exposure falls — and that lift is entirely in `a*`. Pushed BELOW the control's
 * own lightness, `b*` is still 0.98. **Exposure is a real axis and it is not this one.** The two
 * terms that carry the yellow away are the sky and the violet rim, in that order, and both are
 * fixed rather than dimmed: the sky keeps its whole job and the analytic fill takes the one the sky
 * cannot do (see `beach.lights`), and the rim becomes a per-framing FACTOR (see `beach.scales`).
 *
 * ## What it is worth, re-measured AFTER the last edit
 *
 *     rect                studio      beach before → after      park before → after
 *     cheek C*            14.96       11.27 → **17.30**         11.48 → **17.67**
 *     cheek h*            47.2°        6.4° → **44.9°**          2.1° → **34.1°**
 *     forehead C*         16.64        7.40 → **11.83**          6.11 → **12.56**
 *     chin C*             22.82       11.83 → **21.16**         12.13 → **24.06**
 *     terminator C*       22.29       10.18 → **24.53**          5.41 →  **9.31**
 *
 * 🔴 **AND THE "CLEARS OR BEATS THE CONTROL" READING OF THAT TABLE IS AN ARTEFACT OF LIGHTNESS.**
 * The rows are real and the HUE column is the round's true result — hue is nearly lightness-
 * invariant (beach's cheek moves 3.4° over 11.7 L* of an exposure ladder), so 6.4° → 44.9° against
 * the control's 47.2° is a large genuine repair. **C* is not.** This same note measures, two
 * paragraphs up, that ACES sheds chroma as it brightens — and then compares C* between plates at
 * different lightnesses anyway. The exteriors' patches are materially darker than the control's:
 * beach cheek −5.65, chin −7.60 L*; park cheek −9.73, forehead −10.50, flatCheek −20.05 L*. Held
 * at the control's lightness by interpolating exposure ladders (beach 1.00–1.70, park 1.90–3.70,
 * 11 plates, the chroma-per-lightness slope measured at −0.33 to −0.61 across every patch and both scenes),
 * **all six patches fall BELOW the control**: cheek 14.03 / 12.23 against 14.96, flatCheek
 * 12.72 / 12.24 against 19.97, forehead 11.85 / 8.83 against 16.64.
 * 🎯 **So the honest statement is: the skin is much better than it was and still worse than
 * `studio`.** A blind judge shown all three said exactly that independently. The statistic could
 * not separate "more colourful" from "darker" and was not asked to — which is §1.2 one layer up:
 * the number was right and the inference was wrong.
 *
 * and the committed gates, `measure.mjs` with `regions.lighting-portrait.json` on the same plates:
 *
 *     gate                 studio        beach before → after      park before → after
 *     G1 key:shadow        1.5635 ✅     1.7135 ✅ → 1.5076 ✅      0.5076 ❌ → 0.6840 ❌ (see below)
 *     G2 sclera:cheek luma 0.9393 ✅     0.8285 ❌ → 0.8715 ❌      0.6425 ❌ → 0.7686 ❌
 *     G2 sclera:cheek sat  1.2256 ✅     1.4904 ❌ → 1.0295 ❌      1.4116 ❌ → **1.2854 ✅**
 *     G3 terminator        PASS ✅       FAIL ❌ → **PASS ✅**       FAIL ❌ → FAIL ❌
 *     G4 flat-skin σ@900   1.6388 ✅     3.0033 ❌ → 2.6091 ❌      3.0360 ❌ → **1.5539 ✅**
 *     G6 black point       0.00755 ✅    0.00449 ✅ → 0.00587 ✅    0.03613 ❌ → **0.00475 ✅**
 *
 * 🔴 **THE `after` COLUMN ABOVE WAS WRONG WHEN IT WAS WRITTEN — EIGHTH INSTANCE OF §1.25r, AND IT
 * WAS INSIDE THE ROUND NOTE ADDED TO PREVENT THE SEVENTH.** It read 1.5077 / 1.0298 / 2.6062 /
 * 0.00559 and 0.6839 / 1.2867 / **1.5451**, under the sentence "re-measured AFTER the last edit."
 * It was not: it is an intermediate plate batch, exact to four decimals on six of seven cells, and
 * park's G4 1.5451 matches NO batch anywhere — a figure with no provenance at all.
 * Re-derived from plates taken on the shipped tree after the last edit, `--plate-loads 2`,
 * `beach` sha `517a6abd2e54fa84` and `park` sha `5e63cc874b007729`, both `bitident=1/1 worst=0 px=0`:
 * the values above. Three independent runs agree — an adversarial verifier, a blind judge, and the
 * integrator.
 * 🎯 **The lesson is narrower and worse than "re-measure".** This round DID re-measure, and wrote
 * the sentence saying so. What it did not do is re-measure *and then not edit again*. A table is
 * only as fresh as the LAST write to the file it describes, and nothing in this tree enforces that
 * ordering. That is REQ-091's emitter, arriving a second time by a different road.
 *
 * ✅ `studio` is byte-identical through BOTH doors after the last edit:
 * `fence loads=3 sha=fac62c50d56590fb bitident=3/3 worst=0 px=0` on `?scene=studio` and the same
 * digest on `?bg=studio` — the digest HEAD's own plate carries. Every gate value above is bit-equal
 * to the control's, which is the check that says the instrument did not move either.
 *
 * 🔴 **RETRACTED: "AN EXTERIOR PLATE IS A MODE AND `studio` IS NOT."** This paragraph claimed two
 * back-to-back runs differ by 66,662 of 4,320,000 subpixels on `beach` (1.5431%) and 49,617 on
 * `park` (1.1485%), and filed a follow-up that the PMREM bake is not bit-stable. **IT DOES NOT
 * REPRODUCE.** `capture.mjs --plate --plate-loads 5` returns `bitident=10/10 worst=0 px=0` on
 * beach-portrait `517a6abd2e54fa84`, park-portrait `5e63cc874b007729`, beach-body
 * `1a86237f615a023e` and park-body `e4bde1a5297ef478`. Checked by three parties across separate
 * browser processes, on plates whose digests match each other byte for byte, and by the integrator
 * at `--plate-loads 2` on both scenes. Eleven-plus loads, four configurations, zero subpixels.
 * ⚠️ **AND THE RETRACTION MATTERS MORE THAN THE CLAIM DID, because the claim was load-bearing:** it
 * established a noise budget inside which the stale gate figures above were "not quoted outside
 * their noise." A fabricated tolerance is how a wrong number gets permission to stay. The most
 * likely reading is that the two runs straddled a concurrent edit by another agent in the same
 * tree — which is the exact hazard this round was told to engineer against, appearing as a
 * measurement instead of as a conflict.
 *
 * ✅ **AND `setFraming( 'body' )` WAS DRIVEN LIVE**, which is what the `scales` axis exists for.
 * Reading `report().scene.lighting.placements` through the real class: `beach` rim **2.60** at
 * portrait, **3.575** at body, **2.60** on the way back; fill **1.276 → 0.696 → 1.276**. `studio`
 * reads the authored 16 / 22 and 2.20 / 1.20 at the same three points, untouched.
 *
 * ## 🚩 WHAT IT COST, AND THREE OF THESE ARE NOT REPAIRED
 *
 *   - **G2's chroma clause moved from failing HIGH to failing LOW on `beach`.** 1.4904 was a
 *     desaturated CHEEK inflating the sclera:cheek ratio; 1.0295 is a cheek that has its chroma
 *     back and a sclera that did not follow. The lever is `SCLERA_BRIGHTNESS` in the eye material,
 *     not this file, and re-solving it is a request against 3.3.
 *   - **`beach` G4 is still 2.6091 against a band of 1.5–2.1** (⚠️ stated at 3840 px; this is 900,
 *     where the control reads 1.6388 and the band is not portable). It fell 0.3942 and it is not
 *     fixed. G4's own header predicts the direction — a smaller fill raises σ — and the exteriors
 *     still run a smaller analytic fill than the studio does.
 *   - **`park` G1 and G3 are the GATE'S FRAME and are not repaired by re-lighting.**
 *     `regions.lighting-portrait.json` hard-codes `faceKey` and `litSkin` to the studio rig's
 *     RIGHT-hand key; this scene's sun is on the LEFT, so G1 reads the ratio inverted (0.6840,
 *     i.e. **1.4620** the right way up, inside the band) and G3 compares the fill-lit cheek against
 *     the key-lit one. Read the other way round, G3's saturation clause passes by +0.2392 and its
 *     hue clause fails by 4.96°. Neither number is quoted as a result; both are 11.7's argument.
 *   - **The violet still traces the lip seam**, on all three scenes including `studio` — looked at
 *     in a 2× crop of the nose, lips and eyelids. It is the shipped rim at grazing incidence on a
 *     thin feature and it is now no worse outdoors than in the control, which is the whole of what
 *     this round claims about it.
 *
 * ## 🔴 REFUTED THIS ROUND, BY LOOKING
 *
 *   - **The physically derived GRASS bounce.** Sunlight ⊗ `#455438` normalises to `#e7ff98`, and
 *     rendered it puts the cheek's `a*` at **−5.83** and its hue at **101.5°** — an olive cast down
 *     the jaw and the whole shadow side, which is a more saturated version of the defect this round
 *     exists to remove. The derivation is kept above `park.lights` so the departure from it is
 *     readable. See there for why a park is not a grass box.
 *   - **Raising `beach`'s turbidity to warm the sky.** A coastal midday IS hazier, and 2.8 → 4.5
 *     takes the cheek's C* 14.47 → 13.77 at a fixed fill: more Mie scatter is a BRIGHTER sky, more
 *     image-based light, and further up the tone curve. The lever runs the wrong way.
 *   - **Dropping `rayleigh` to take the blue out of the sky.** 1.0 → 0.7 does work on the skin
 *     (cheek C* 14.47 → 16.03) and it is not taken: it repairs the subject by degrading the
 *     BACKDROP, and 11.6's gate is a blind judge naming the place. A sky that is not blue is not a
 *     cheaper beach, it is a different one.
 */

// 📋 --- ROUND NOTE: 11.6, THE SIX ORDINARY SCENES, measured 2026-08-18 -----------------------------
//
/**
 * 📋 **THE ORDINARY SIX — `bedroom-morning`, `kitchen`, `desk`, `living-room`, `bedside-night`,
 * `street` — AND THE FIVE THINGS THIS ROUND FOUND BY OPENING THE PLATE.**
 *
 * Every figure below comes out of one script that fingerprints the working tree before and after
 * itself and ran TWICE, once before this comment existed and once after, with every number and
 * every plate digest identical to the digit. That is this project's answer to §1.25r's sharpest
 * form — *"a table is only as fresh as the last write to the file it describes"* — when the table
 * lives inside the file it describes. Recipe throughout: `tools/critic/avatar-plate.html`,
 * 900×1200, 1 step at 60 fps, seed 1, `?freeze`, quality `auto`, apple/metal-3 WebGPU. Face colour
 * is CIELAB from the plate's own sRGB on `regions`' forehead and cheek patches; luminances are
 * scene-linear through `lightpath-probe.mjs`'s validated inverse. ✅ The instrument reproduces five
 * committed figures before it is trusted on anything new: `studio` forehead **5.9640e-1**, its
 * L\* **82.24** and C\* **16.64**, and `kitchen`'s forehead **3.9282e-1**, frame mean **112.07**
 * and wall:face **0.1121**.
 *
 * ## 🚩 1. THE CAMERA IS AT x = +0.84 m, AND THAT MAKES A ROOM ASYMMETRIC
 *
 * `frameFigure` stands the camera at `sin( 12° ) × distance` — **x +0.19 m at portrait and +0.84 m
 * at body** — and aims it at the origin, so its axis crosses the far wall at x = −0.36 rather than
 * at 0. Two consequences that every interior in this file now obeys:
 *
 *   - **A corner is reachable on −X and not on +X.** The far wall's visible strip is
 *     **x ∈ [−1.36, +0.64]** at body and **[−0.82, +0.10]** at portrait. A +X wall inside +0.64 is
 *     a wall the body camera is standing outside of.
 *   - 🔴 **AND THAT IS NOT HYPOTHETICAL — `bedroom-morning` SHIPPED IT FOR A ROUND.** Its first
 *     room put the +X wall at +0.60 with the camera at +0.84. No error, no statistic moved, and
 *     the plate was a flat gold field with no corner, no floor line and no window: the camera was
 *     outside the box looking in through a wall. Only the body plate said so.
 *
 * ⚠️ **AND NO ROOM IN THIS CORPUS PUTS A CORNER IN A *PORTRAIT* FRAME.** The strip is 0.92 m wide
 * and the nearest shipped wall is `bedside-night`'s at −0.70; a corner clear of the head needs
 * roughly x ≤ −0.75 with the head covering screen x 80–540. `bedside-night` is the closest this
 * corpus gets and it is still the far wall behind her, not an edge. Command:
 * `node scratchpad/ordinary/frame.mjs <scene…>`.
 *
 * ## 🚩 2. THERE IS NO CHROMATIC ADAPTATION IN THIS PIPELINE, AND WARM SCENES PAY FOR IT
 *
 * A 2700 K bulb rendered without adaptation is ORANGE, not cream. Cheek C\* against the `studio`
 * control's **18.66**, at the shipped exposures:
 *
 *     scene            lamp, derived    cheek C*      shipped colour     cheek C*
 *     living-room      2700 K #ffa757     45.50     0.40 adapt #ffd0b4     25.03
 *     bedside-night    2200 K #ff9227     57.94     0.50 adapt #ffd2bd     23.67
 *
 * Both rows are the SHIPPED room with one `lights.key.colour` moved and nothing else — the first
 * draft of this table mixed an arm from before the rooms were repaired with an arm from after, and
 * it is corrected here rather than quietly, because that is §1.25r and it happened inside the round
 * that was written to avoid it.
 *
 * The shipped colour is the derived one mixed toward equal-energy white in LINEAR space by a stated
 * fraction — a von-Kries-shaped partial adaptation with the number written down. ⚠️ The FIXTURES
 * are not adapted: they light the walls, and a warm wall under a warm bulb is the picture. So the
 * lamp on the wall and the lamp on the face are deliberately no longer the same colour, and that
 * asymmetry is named here rather than discovered later. This is the same family as `beach`'s
 * `#ffddac` → `#ffc070` pre-compensation, in the opposite direction and for the opposite reason.
 *
 * ## 🔴 3. A RIM CANNOT BUY BACK SILHOUETTE SEPARATION INDOORS — REFUTED IN BOTH DIRECTIONS
 *
 * `36ba35d` cut the rim 20–50× on every scene to stop a saturated `#0f30ff` panel painting the
 * floor, and `tools/critic/scene-gates.mjs`' L3 is the bill for it. The obvious repair — a NEUTRAL
 * rim, which is not the refuted *"recolour the rim to the surround's hue"* — was tried on
 * `bedroom-morning` with `lights.rim.colour = 0xfff0dc` and measured on a corrected matte:
 *
 *     rim scale   portrait irradiance   L3 worst side (band ≥ 0.05)
 *     0.02 shipped        0.32                 0.0234
 *     0.05                0.80                 0.0247
 *     0.12                1.92                 0.0136   ← WORSE
 *
 * **It does not help, and past a point it hurts.** The mechanism is that the rim's own bloom lifts
 * the wall immediately outside the silhouette by as much as it lifts the edge inside it, and L3 is
 * a Michelson contrast across exactly that boundary. An edge light cannot separate a figure from a
 * background it is also lighting. The exteriors' L3 failure has the same shape with a bright sky in
 * place of a bloomed wall.
 *
 * ## 🔴 4. AND THE GATE THAT REPORTS IT HAS A MATTE PROBLEM ON INTERIORS — HANDED BACK, NOT PATCHED
 *
 * `scene-gates.mjs` builds its subject mask by differencing two arms at a **2-code** tolerance.
 * That is clean on a studio card and on a sky; on a dim interior wall the figure's own bloom clears
 * 2 codes over a wide halo, so the matte swallows background and L3 measures an outline that is not
 * the figure. Measured, same plates, tolerance moved at the call site:
 *
 *     scene              matte at 2 codes    matte at 28 codes    L3 at 2      L3 at 28
 *     studio                 60.07%              59.41%           0.9501 ✅    0.9221 ✅
 *     street                 59.95%              59.72%           0.1971 ✅    0.2089 ✅
 *     bedroom-morning        69.26%              58.69%           0.0005 ❌    0.0234 ❌
 *     bedside-night          72.13%              59.42%           0.0000 ❌    0.1754 ✅
 *     living-room            76.56%              59.57%           0.0006 ❌    0.2010 ✅
 *     kitchen                80.02%              63.07%           0.0000 ❌    0.0020 ❌
 *     desk                   80.58%              66.16%           0.0000 ❌    0.0024 ❌
 *
 * The two columns of matte percentages are the finding: the scenes whose matte is already the right
 * size (`studio`, `street`) do not move, and the five interiors shed 10–17 points of frame the
 * moment the tolerance clears the bloom.
 *
 * 🎯 **Two of the five interior L3 reds are the instrument and three are the scene** — and
 * `kitchen`, which is not mine this round, is one of the three. The verdict
 * this round reports is the SHIPPED tool's, because that is the gate; the corrected column is the
 * diagnosis and it is the tool owner's to act on. ⚠️ `?quality=balanced` was tested first and
 * ruled GTAO out — the matte is 78.89% with the occlusion pass off — so this is the grade's bloom
 * and not the ambient-occlusion pass. Command:
 * `sed "s|buildSubjectMask(lit.png, bg.png, 2)|…, 28)|" tools/critic/scene-gates.mjs > /tmp/g.mjs`.
 *
 * ## 🔴 6. THE RED PROOFS FOR THE ONE CLAIM THESE SCENES ADD — "THE FIXTURES ARE THE ROOM"
 *
 * `living-room` and `bedside-night` are the first scenes whose `windowAdmittance` is 0, so the
 * claim to falsify is that with the sun on the horizon the FIXTURES carry the room and the window
 * carries almost nothing. Both arms go through `?sceneover` — the public schema, no instrument
 * flag — with the room otherwise held byte for byte. The statistic is `wall:face`, the far-wall
 * rect over the forehead rect in scene-linear, because it is a RATIO and cannot be moved by the
 * analytic lamp that lights only the figure:
 *
 *     arm                                    frame mean   wall:face   forehead linear
 *     living-room, shipped                     128.50       0.1198       5.736e-1
 *     living-room, `fixtures: []`              103.85     **0.0231**     5.125e-1   ← wall × 0.19
 *     living-room, `window.transmission: 0`    126.24       0.1091       5.664e-1   ← wall × 0.91
 *     bedside-night, shipped                   106.30       0.0393       4.110e-1
 *     bedside-night, `fixtures: []`            100.39     **0.0116**     3.989e-1   ← wall × 0.30
 *
 * 🎯 **Taking the FIXTURES out costs the wall 81% of its brightness relative to the face; walling
 * the WINDOW off costs it 9%.** That is the claim, in the one number that cannot be faked by the
 * lamp: at elevation 0 the aperture is decoration and the bulbs are the room. ⚠️ The forehead
 * barely moves in either arm (5.736e-1 → 5.125e-1) and that is the control INSIDE the control —
 * the subject is lit by `lights.key`, which neither arm touches, so a large move there would have
 * meant the override was not doing what this file says it does.
 *
 * 🔴 **AND THE SUN STILL DRIVES THE ROOM WHEN IT IS UP, ON THE SAME SCENE.** `living-room`'s
 * elevation moved 0 → 15° alone, room held: frame **128.50 → 162.01**, wall:face
 * **0.1198 → 0.2624** (2.2×), backdrop span **4.99 → 25.16** code values (5.0×). The evening room
 * is not a room with the daylight path disconnected — it is the same path with the sun down.
 *
 * ## 🔴 5. PREETHAM CANNOT MAKE AN OVERCAST DOME, SO `street`'s WEATHER IS IN ITS KEY
 *
 * See the `street` entry for the four-row sweep. The punch list's *"overcast is `turbidity` and
 * costs nothing"* is refuted: Rayleigh scattering IS the sky's brightness away from the sun, so
 * turning the blue down turns the sky off rather than white. `occlusion` carries the weather and
 * the backdrop stays a hazy blue gradient.
 *
 * ## ⏭️ TIME OF DAY IS **FILED, NOT WIRED**, AND HERE IS EXACTLY WHAT IT NEEDS
 *
 * `docs/research/scene-system.md` §8 is right that *"the fix is one `Date`"* for the CHOICE of
 * scene, and wrong that it is one `Date` for the LIGHT. Three things are missing and none of them
 * is in this file's gift:
 *
 *   1. **An hour → `{ elevationDegrees, azimuthDegrees }` solar position**, which needs a latitude
 *      and a day of year as well as a clock. `SUN_FIELDS` refuses an `hour` key today and says so
 *      in its own message.
 *   2. **A rule for what a scene's authored sun MEANS once an hour exists.** Every entry here
 *      writes an elevation chosen against its own WINDOW — `kitchen`'s −55° at 15° crosses its
 *      aperture, `bedroom-morning`'s 70° at 8° crosses its own — and `windowAdmittance` goes to
 *      zero if the clock moves the sun off the glass. A clock-driven interior is a room whose
 *      window has to move with the sun, or a room that goes dark at 4 p.m.
 *   3. 🚩 **A DECISION ABOUT NIGHT, WHICH THIS ROUND MEASURED.** `resolveSceneSun` floors elevation
 *      at 0 and the reason is arithmetic: `SkyMesh`'s sun-intensity curve reaches exactly zero at
 *      about **−2.31°** (`acos( sin e ) = CUTOFF_ANGLE = 92.31°`) — verified by evaluating the
 *      shipped `solarDiscLight`, which returns 2.8312e-2 at −2° and **exactly 0** at −4°. Below
 *      that there is no sun AND no sky: no stars, no moon, no city glow. So a clock that reaches
 *      21:00 has to clamp at dusk and hand the room to its fixtures, which is precisely what
 *      `living-room` and `bedside-night` do by hand — and `bedside-night` draws a curtain
 *      (`transmission: 0.05`) over the window because the darkest sky this model owns is a sunset.
 *
 * ⚠️ **Wiring a clock without (3) is how an avatar ends up in noon sunlight at 11 p.m.** — the
 * exact failure the punch list names — with the added twist that the model cannot render the fix.
 */
