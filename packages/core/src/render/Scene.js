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
    'id', 'kind', 'sun', 'sky', 'room', 'lights', 'ground', 'air', 'exposure', 'background', 'framing'
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
         * 🚩 THE FILL IS CUT TO LESS THAN A THIRD BECAUSE THE SKY HAS TAKEN ITS JOB, AND LEAVING IT
         * ALONE WOULD HAVE BEEN A DOUBLE COUNT. The studio fill is a 4.2 × 4.2-height panel at
         * irradiance **2.20** standing in for "a large soft source filling the shadow side" — which
         * outdoors IS the sky, and the sky is now in `scene.environment` for real.
         * `docs/CHECKPOINT.md` §7 measured that panel at **50.01%** of the forehead, and this scene
         * measures the image-based light at **27.03%** of the same probe, so the two are the same
         * job done twice.
         *
         * What is KEPT is a frontal term the image-based light cannot supply: `EyeMaterial` computes
         * its iris caustic against ONE named key direction and a face with no direct fill loses the
         * modelling on the shadow cheek entirely. 0.70 is measured — see the ROUND NOTE.
         *
         * ⚠️ **RIM AND KICKER ARE UNTOUCHED, AND THAT IS A CONSTRAINT RATHER THAN A PREFERENCE.**
         * A scene's `lights` are ABSOLUTE numbers, and `EDGE_LIGHTS` is authored PER FRAMING — so an
         * absolute rim written here would survive `setFraming('body')` and destroy the body preset,
         * which is exactly the failure `SCENE_LOOKS` records ("soft resolved at portrait leaves the
         * body rim reading 11.2000 where the body preset authored 15.4000, 27.27% under, and nothing
         * reports it"). `fill` is safe because `FORM_LIGHTS` is IDENTICAL in both presets — that is
         * the file's own load-bearing claim — so this override means the same thing at either crop.
         *
         * 🚩 It has a visible cost and it is recorded rather than hidden: with the fill at 0.70 the
         * shipped rim at irradiance 16 is 23× the fill where in the studio it was 7.3×, and the
         * saturated `#0f30ff` edge is correspondingly more prominent. A rim at 5.1 — the same 0.32
         * factor the fill took — measurably cleans it up. A scene cannot express that today. It is a
         * request against `LightingRig` for a per-framing `scales` axis on scenes, in the shape
         * `SCENE_LOOKS` already uses, and it belongs to 11.7 with the legibility gates.
         */
        lights: Object.freeze( {
            fill: Object.freeze( { irradiance: 0.70, colour: 0xbcd6f7 } )
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

        air: Object.freeze( { haze: 0 } ),

        /**
         * ⚠️ **MEASURED, NOT CHOSEN, AND IT IS THE HONEST FORM OF "the gates will move".**
         *
         * The forehead probe (`tools/critic/scene-probe.mjs`, rect 250,196,120,46, scene-linear
         * luminance through the inverted tone curve), 900×1200, 1 step, seed 1:
         *
         *     studio, the calibration control      5.9640e-1
         *     beach at exposure 0.62               2.7424e-1   (0.46× — a night beach)
         *     beach at exposure 1.00               4.4460e-1
         *     **beach at exposure 1.28**           **6.0670e-1**   1.017× the control
         *
         * So the number is what puts this scene's face where the judged frame has it — a beach plate
         * and a studio plate are then two pictures of the same person rather than two exposures.
         *
         * 🚩 IT DOES NOT MEAN THE GATES STILL HOLD, AND SAYING SO IS THE POINT. It takes
         * `report().scene.lighting.calibrated` FALSE, correctly: 27.03% of that forehead is now
         * image-based light and `docs/CHECKPOINT.md` §7's decomposition was taken at 0.00%.
         */
        exposure: 1.28,

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

        // Higher than `beach`'s: with 45% of the disc behind leaves, the sky IS more of the light
        // here, and a fill cut as hard as the beach's would leave the shadow side to the IBL alone.
        lights: Object.freeze( {
            fill: Object.freeze( { irradiance: 0.95, colour: 0xc6d4e8 } )
        } ),

        // Summer grass: linear (0.058, 0.093, 0.041). Dark, and green-dominant with blue lowest —
        // the bounce off it is the reason a park portrait's jaw underside is cool-green where a
        // beach portrait's is warm. That difference is the whole of 11.3 made visible.
        ground: Object.freeze( { enabled: true, albedo: 0x455438, roughness: 0.85 } ),

        air: Object.freeze( { haze: 0 } ),

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

    if ( kind === 'interior' && request.room == null ) {

        throw new TypeError( "Scene: kind 'interior' needs a `room`, and the interior model is " +
            'punch-list 11.4 (an emissive room box whose window samples the same sky). Until it ' +
            "lands, the only shipping kind is 'studio'." );

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
        room: request.room ?? base.room,
        lights: resolveSceneLights( request.lights ?? base.lights ),
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
        lights: scene.lights
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

    if ( scene.sky === null ) return null;

    return {
        sun: scene.sun,
        sky: scene.sky,
        ground: scene.ground
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
 *     beach  exposure 1.28  →  6.0670e-1   (1.017× the control — SHIPPED)
 *     park   exposure 0.82                 1.6117e-1     park   exposure 1.90   4.2741e-1 (SHIPPED)
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
 * ⏭️ Not shipped, because a scene's `lights` are absolute and `EDGE_LIGHTS` is authored per framing
 * — see the ⚠️ in `beach.lights`. It is the concrete case for giving a scene the per-framing
 * `scales` axis `SCENE_LOOKS` already has, and it belongs to 11.7 with the legibility gates.
 *
 * ## What the environment is worth, on the same probes
 *
 *     scene    forehead IBL share   jaw-underside IBL share   frame mean, env removed
 *     studio         0.00%                 0.00%              no change (the null control)
 *     beach         27.03%                64.58%              1.7469e-1 -> 1.4147e-1  (-19.02%)
 *
 * and the ground's own half, over four albedos spanning 70.28× of linear reflectance: the jaw moves
 * 5.0038e-2 → 1.0496e-1 monotonically, **2.0976×**, while the same sweep with the ground taken out
 * of the environment bake moves **1.0000×** and the whole-frame mean moves 1.0993×.
 */
