/**
 * Avatar — the runtime API. Punch-list 7.1, requirement R7 in `docs/BRIEF.md`:
 * *"usable by any AI agent to embody itself, in real time"*.
 *
 * ONE CALL HAS TO PRODUCE A LIVING FIGURE
 * ---------------------------------------
 *
 *     const avatar = await Avatar.create( { canvas: document.getElementById( 'stage' ) } );
 *
 * That is the whole of the acceptance gate. Breathing, blinking, gazing, lit, framed, standing in
 * a rest pose rather than a bind pose — with no second call. Everything else on this class is
 * refinement of a figure that is already alive.
 *
 * WHY THIS FILE EXISTS AT ALL
 * ---------------------------
 * Every subsystem in this repository already works and is already gated. What did not exist was a
 * way to USE them: the only place they were ever composed was `packages/testbed/src/alive.js`, a
 * 790-line `boot()` driven by a `URLSearchParams`, in a package `core` must not depend on. An
 * embedder cannot call a testbed page. So this file is that same wiring, in the same VERIFIED
 * ORDER, driven by a plain options object.
 *
 * The order is not a style preference and each step below is load-bearing. It is restated here
 * because a reader who reorders it gets a figure that renders black, or double-counted ambient, or
 * a grade that silently does nothing:
 *
 *   1. Resolve `occlusion.enabled` BEFORE the rig exists. `LightingRig` is built
 *      `ambient: occlusion.enabled === false` — with GTAO on, the hemisphere term is re-evaluated
 *      per pixel in the composite, and leaving the light in the scene too puts the ambient in the
 *      frame twice. (`alive.js:734-737`, `:948-953`.)
 *   2. `new Stage()` → `await stage.create( canvas, … )`, with
 *      `pipeline: temporalAA !== 'off' || wantsGrade || occlusion.enabled`. Grade and GTAO both
 *      need the deferred path and neither implies it inside `Stage` (`alive.js:767`,
 *      `Stage.js:331`). MSAA and temporal AA are mutually exclusive; `Stage` throws on the pair
 *      (`Stage.js:217`).
 *   3. `stage.setGrade( … )` — throws without the pipeline (`Stage.js:546`).
 *   4. `new LightingRig( … )` → `lights.attachTo( scene, renderer )`. `attachTo` is where the LTC
 *      tables are installed; without them every RectAreaLight contributes nothing and the figure
 *      renders black, which looks exactly like a broken material (`LightingRig.js:1674`).
 *   5. `createGroundTruthOcclusion( … )` → `stage.setAmbientOcclusion( gtao )`, after the rig,
 *      because the composite needs the ambient the rig would have built.
 *   6. `new MotionStack( { seed } )`.
 *   7. The nine layers, constructed in the order breath, bodyIdle, handIdle, sway, idle, gaze,
 *      blink, facialIdle, pupil. Slot order comes from `MOTION_ORDER`, not from insertion — but
 *      see trap (b), which is about NAMES rather than order.
 *   8. `Figure.load( url )` → rest pose → `createMotionTarget( figure.root )` → `stack.bind()`.
 *   9. `stack.add( layer )` for each.
 *  10. Per frame, in exactly this order: `stack.update( dt )` →
 *      `figure.root.updateMatrixWorld( true )` → `eyes.update()` → `ground.update()` →
 *      `stage.draw()`.
 *      ⚠️ `stage.draw()`, NEVER `renderer.render()`. On the deferred path the pipeline is what
 *      binds the MRT and runs the composite, so calling the renderer directly throws the grade and
 *      the temporal resolve away — silently, and it looks exactly like a feature that does nothing
 *      (`alive.js:1296-1303`).
 *
 * WHAT WAS DELIBERATELY LEFT BEHIND, AND WHY
 * ------------------------------------------
 * `alive.js` is an INSTRUMENT. Most of what it carries exists so a number can be attributed to a
 * subsystem, and a library consumer has no use for any of it. Left behind on purpose:
 *
 *   - **`?statedefect` / `?grounddefect` / `?gtaodefect` / `?clockdefect` / `?hairdefect` and
 *     `?wearrace`.** Every one of them plants a KNOWN-BAD on a working rig so a rejection proof can
 *     be re-run on the page the seven gates are measured on. A library whose public API can plant a
 *     defect in a shipped avatar is a liability; the proofs belong on the testbed page, which still
 *     has them.
 *   - **The capture clock — `?capture`, `takeOverFrameLoop`, `window.__SUGATA_STEP__`,
 *     `readCaptureClock`.** It reaches into `renderer._animation` and `renderer._nodes.nodeFrame`,
 *     both private, to make a plate bit-reproducible for a screenshot harness. `update( dt )` here
 *     gives a caller the same fixed-step control through public API; what it does not give is a
 *     pinned renderer epoch, and it says so rather than pretending (see `update`).
 *   - **The strip chart, the HUD, the dial bindings and the keyboard bindings.** Presentation for a
 *     human looking at the page. An embedder draws its own UI, and `report()` is the data it needs.
 *   - **`recordingQuery` and the toggle surface.** They exist so `alive-toggles.selftest.mjs` can
 *     gate "one toggle switches one subsystem" against a URL. There is no URL here.
 *   - **`shadingFingerprint` / `frameSubjectState` — the whole-scene walks.** Instruments for
 *     attribution. `report()` carries the census, which is the half a consumer and a gate both read.
 *   - **`?nudge`.** A stimulus for one psychophysical staircase (LEARNINGS §1.14a).
 *   - **`?webgl`, `?gputime`, `?preroll`, `?freeze`, `?pose=bind`, and the per-knob grade sweeps.**
 *     A/B levers. The tier system covers the one of these a consumer needs — see `QUALITY_TIERS`.
 *
 * **HAIR IS NO LONGER ON THAT LIST, AND THE SHIPPED RUNTIME FIGURE IS NO LONGER BALD.** The
 * paragraph that stood here deferred the groom on the grounds that it "moves every committed number
 * in the repository", which is an argument for `hair: false` being the DEFAULT and was being used as
 * an argument for the option not existing. Those are different things, and the second one made
 * `Avatar` a runtime API that could not put hair on a head at all — the single most visible gap
 * between this file and `alive.js`. `hair: 'bob01'` is opt-in, it is off by default, and §THE GROOM
 * below carries the three measured reasons it stays off.
 *
 * Still deferred rather than dropped, and named so the omission is visible: **the wardrobe**
 * (Phase 9) and **identity detail targets** (Phase 10). Both are opt-in on `alive.js` for reasons
 * that still hold — the wardrobe has fragments for one bake only, and 10.7/10.9 are open so eyes and
 * skeleton do not follow the skin.
 *
 * ⚠️ THIS FILE DOES NOT IMPORT FROM `packages/testbed`, EVER. `core` must not depend on the
 * testbed. Where a helper was needed it was READ and reimplemented here, and every constant lifted
 * across carries the line in `alive.js` that recorded the measurement which chose it. A parity gate
 * (`Avatar.selftest.mjs`, not this file) asserts the two wirings agree; two wirings are a liability
 * and a gate on their agreement is what keeps the liability visible instead of latent.
 */

import { Box3, Matrix4, SRGBColorSpace, Skeleton as SkinSkeleton } from 'three';
import {
    Color,
    Group,
    Mesh,
    MeshPhysicalNodeMaterial,
    MeshStandardNodeMaterial,
    PlaneGeometry,
    Vector3
} from 'three/webgpu';
import { max, texture, vec3, vec4 } from 'three/tsl';

import { AffectState } from './affect/AffectState.js';
import { ANCHOR_SETS } from './affect/ExpressionMap.js';
import { ExpressionLayer } from './affect/ExpressionLayer.js';
import { ReflexAffect } from './affect/ReflexAffect.js';

import { Figure } from './figure/Figure.js';
import { Identity, LIVE_PREVIEW } from './figure/Identity.js';
import { RestPose } from './figure/RestPose.js';
import { Skeleton } from './figure/Skeleton.js';

import { EyeMaterial } from './material/EyeMaterial.js';
import { buildEyeOcclusion } from './material/EyeOcclusion.js';
import {
    applySkinMaterial,
    cavityMapUrlFor,
    createSkinMaterial,
    curvatureMapUrlFor
} from './material/SkinMaterial.js';

import { Blink } from './motion/Blink.js';
import { BodyIdle } from './motion/BodyIdle.js';
import { Breath } from './motion/Breath.js';
import { FacialIdle } from './motion/FacialIdle.js';
import { Gaze } from './motion/Gaze.js';
import { GestureLayer, syntheticSpeechPlan } from './motion/Gesture.js';
import { HandIdle } from './motion/HandIdle.js';
import { IdleMotion } from './motion/IdleMotion.js';
import { MotionStack, createMotionTarget } from './motion/MotionStack.js';
import { Pupil } from './motion/Pupil.js';
import { Sway } from './motion/Sway.js';

import { Grade, TEMPORAL_RECOVERY_SHARPNESS } from './render/Grade.js';
import { GroundContact } from './render/GroundContact.js';
import { GTAO_SHIPPING_QUALITY, createGroundTruthOcclusion } from './render/GTAO.js';
import { EXPOSURE_CALIBRATION, LightingRig } from './render/LightingRig.js';
import { Stage } from './render/Stage.js';

import { VisemeLayer } from './voice/VisemeLayer.js';

// --- framing -----------------------------------------------------------------------------------
//
// The five numbers below are lifted verbatim from `packages/testbed/src/alive.js:366-399`, which is
// where the reasoning that chose each of them is recorded in full. They are repeated rather than
// imported because `core` must not import from `testbed`, and they are load-bearing for parity: the
// Avatar gate compares this composition root's camera against that page's, so a divergence here is
// a divergence in every plate anybody has ever measured.

/** 24–40° is the portrait range; 26° stands the camera ~1.1 m out. `alive.js:370`. */
const PORTRAIT_FIELD_OF_VIEW_DEGREES = 26;

/** Crown to the top of the chest. Breath is 2–3 mm of sternum and has to be in frame. `alive.js:375`. */
const PORTRAIT_HEIGHT_METRES = 0.42;

/** Where the eye line sits, measured from the top of the frame. The portrait rule. `alive.js:380`. */
const EYE_LINE_FROM_TOP = 1 / 3;

/** Off-axis camera angle. Dead-on reads as a mugshot. `alive.js:384`. */
const CAMERA_AZIMUTH_DEGREES = 12;

/** Headroom in the full-body frame, as a fraction of the figure's height. `alive.js:396`. */
const BODY_FRAME_MARGIN = 1.10;

/**
 * The mesh the eye line is read off, matched by PATTERN and not by an exact name.
 *
 * `alive.js:391` records why: it was the literal `Humanlow-poly`, the figure pipeline swapped the
 * proxy to `high-poly`, the lookup returned undefined, and the portrait crop quietly climbed the
 * forehead for a round. A miss now says so out loud.
 */
const EYEBALL_MESH_PATTERN = /high-poly|low-poly|eyeball/i;

/** The posture the figure stands in when the caller says nothing. `alive.js:399`. */
const DEFAULT_REST_POSE = 'relaxed-standing';

// --- the backdrop ------------------------------------------------------------------------------

/**
 * The emissive card behind the figure, and its distance.
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
 */
const BACKDROP_EMISSIVE = 0x070a0e;
const BACKDROP_DISTANCE_METRES = 1.9;

/** The scene clear colour the shipped plate is measured on. `Avatar.js`'s own literal, named. */
const SCENE_CLEAR_COLOUR = 0x08080a;

// --- the scene: what an embedder may change about the light and the room -------------------------
//
// 🚩 UNTIL THIS ROUND `Avatar.create()` TOOK ELEVEN OPTIONS AND NOT ONE OF THEM TOUCHED LIGHTING,
// BACKGROUND, EXPOSURE OR ENVIRONMENT. An agent embedding this avatar got a figure in a room it
// could not change, on a page whose own chrome it chose. That is the gap this section closes, and
// the shape of the closure is the same one `QUALITY_TIERS` uses: a small set of named, MEASURED
// configurations, plus one escape hatch that is validated at this boundary because the subsystem
// behind it validates nothing.

/**
 * The look presets, as what each one MOVES rather than as a table of absolutes.
 *
 * ## 🚩 A LOOK IS NOT A `LightingRig` PRESET, AND CONFLATING THEM BREAKS `setFraming`
 *
 * `LightingRig`'s `preset` is `'portrait' | 'body'` — a FRAMING concept, already driven by
 * `Avatar.setFraming`. A look preset has to ride on `overrides` instead, or `setFraming('body')`
 * silently changes the look as well as the crop.
 *
 * ## 🎯 AND A LOOK IS A MULTIPLIER, RE-RESOLVED PER FRAMING. MEASURED WHY
 *
 * `LightingRig.setPreset()` re-runs `resolvePlacements()`, which re-merges `this.overrides` OVER
 * the new framing's authored table. So an ABSOLUTE override computed at portrait survives into body
 * and destroys it. Measured through the real class on 2026-08-17:
 *
 *     soft@portrait rim override = 11.2000   (portrait authored 16 x 0.70)
 *     soft@body     rim override = 15.4000   (body     authored 22 x 0.70)
 *     NOT re-resolved -> body rim 11.2000    RE-resolved -> body rim 15.4000    error 27.27%
 *
 * `scales` is therefore a factor on whatever the CURRENT framing's table authored, read back off
 * `LightingRig` itself rather than copied here, and `setFraming` re-resolves before `setPreset`.
 *
 * ## 🚩 THE ONE RULE THAT MAKES LOOKS SAFE: NO LOOK MAY MOVE `key.irradiance` OR `fill.irradiance`
 *
 * That pair is the G1 axis and `LightingRig.selftest.mjs:698-703` gates it; that gate's own
 * KNOWN-BAD at `:707-714` is exactly the 4:1 rig a "cinematic" preset would reach for. A look that
 * moved it would be a look that differs mainly in whether it passes G1. So looks differ on COLOUR,
 * KEY GEOMETRY and EDGE-LIGHT ENERGY only, and clause A2 of the gate holds every (look, framing)
 * pair BIT-EQUAL to its framing's own baseline.
 *
 * Measured through the real class at both framings on 2026-08-17, against the two ceilings
 * `LightingRig.selftest.mjs` publishes (behind:front <= 3.0, blue:red <= 4.5):
 *
 *     | look       | keyToFill portrait | keyToFill body | behind:front | blue:red |
 *     |------------|-------------------:|---------------:|-------------:|---------:|
 *     | `studio`   |             1.3636 |         2.5000 |       1.7862 |   2.5144 |
 *     | `warm`     |             1.3636 |         2.5000 |       1.7862 |   2.3319 |
 *     | `cool`     |             1.3636 |         2.5000 |       1.7862 |   3.3409 |
 *     | `soft`     |             1.3636 |         2.5000 |       1.5018 |   2.2325 |
 *     | `dramatic` |             1.3636 |         2.5000 |       1.7060 |   2.4218 |
 *
 * Every ratio is bit-equal to its framing's baseline; all ten pairs clear both ceilings.
 *
 * ⚠️ `cool` IS THE DANGEROUS DIRECTION AND IT IS DELIBERATELY PARKED SHORT OF THE KNEE. 3.3409 sits
 * under the gate's own MUST-PASS row `#e8ecff` (3.4167, which renders 0.058% of the frame blue —
 * LESS than shipped). One step further, `#b0c0ff` — a tint that reads as white in a swatch — scores
 * 6.2939 and renders 57.37% of the frame saturated blue.
 *
 * ⚠️ AND NO LOOK MOVES THE AMBIENT. See `AMBIENT_MULTIPLIER_RANGE` for the one-code-value window
 * that makes it the most gate-fragile lever on this whole surface.
 */
export const SCENE_LOOKS = Object.freeze( {

    /**
     * The default, and it IS the shipped rig: zero overrides. Every committed gate number in this
     * repository is stated on this configuration, so an agent that says nothing gets the frame the
     * critic has judged.
     */
    studio: Object.freeze( { fields: Object.freeze( {} ), scales: Object.freeze( {} ) } ),

    /**
     * A companion or assistant presence on a dark or neutral host UI. Key ~4300 K instead of
     * ~5000 K; kicker up 20% so the jaw edge survives the warmer key. blue:red FALLS to 2.3319 —
     * further from the ceiling than shipped.
     */
    warm: Object.freeze( {
        fields: Object.freeze( {
            key: Object.freeze( { colour: 0xffe3c0 } ),
            fill: Object.freeze( { colour: 0xf7cdb8 } )
        } ),
        scales: Object.freeze( { kicker: Object.freeze( { irradiance: 1.20 } ) } )
    } ),

    /**
     * An avatar inside a technical or product UI with cool chrome, so the figure does not read as
     * pasted-in warm. The dangerous direction — see the ⚠️ above.
     */
    cool: Object.freeze( {
        fields: Object.freeze( {
            key: Object.freeze( { colour: 0xeef2ff } ),
            fill: Object.freeze( { colour: 0xdfe6f4 } )
        } ),
        scales: Object.freeze( {} )
    } ),

    /**
     * An always-on avatar, small in the corner of a UI. The key drops to 10° so the nose shadow
     * does not cross the lip at 120 px; rim and kicker at 70% so the separation does not alias.
     * Lowest environment spill of the five.
     */
    soft: Object.freeze( {
        fields: Object.freeze( { key: Object.freeze( { elevationDegrees: 10 } ) } ),
        scales: Object.freeze( {
            rim: Object.freeze( { irradiance: 0.70 } ),
            kicker: Object.freeze( { irradiance: 0.70 } )
        } )
    } ),

    /**
     * A beat: a reveal, an emphatic reply, a "listening" portrait state. The key raised and swung
     * wider deepens the far-cheek modelling without touching the ratio; rim up 25% holds the
     * silhouette against the deeper shadow.
     */
    dramatic: Object.freeze( {
        fields: Object.freeze( {
            key: Object.freeze( { elevationDegrees: 30, azimuthDegrees: 52 } )
        } ),
        scales: Object.freeze( { rim: Object.freeze( { irradiance: 1.25 } ) } )
    } )

} );

/** The look names `lighting.look` accepts. */
export const SCENE_LOOK_NAMES = Object.freeze( Object.keys( SCENE_LOOKS ) );

/** The only two keys a look entry may carry. Deny-by-default; see clause A4's red proof. */
const LOOK_ENTRY_KEYS = Object.freeze( [ 'fields', 'scales' ] );

/**
 * The four lights the rig has, and the fields the escape hatch may reach — with the range each one
 * has to be inside for the scene graph to hold a finite number.
 *
 * 🚩 **`Avatar` VALIDATES WHERE THE RIG DOES NOT, AND THAT IS THIS TABLE'S WHOLE JOB.** Measured
 * through the real `LightingRig` constructor on 2026-08-17 — NOTHING throws:
 *
 *     | override                    | result                                          |
 *     |-----------------------------|-------------------------------------------------|
 *     | `key.irradiance: -3`        | key E **-2.5500** — negative light               |
 *     | `fill.irradiance: 0`        | designedKeyToFill **Infinity**                   |
 *     | `key.shadowFraction: 2`     | `1 - f` negative -> panel radiance **-3.9599**   |
 *     | `key.widthInHeights: 0`     | panel radiance **Infinity**                      |
 *     | `key.distanceInHeights: 0`  | **NaN** into the scene graph                     |
 *     | `{ fifth: { … } }`          | silently dropped — 4 placements, no throw        |
 *     | `{ key: { irradianceX: 9 } }`| silently merged and ignored                     |
 *     | `preset: 'cinematic'`       | **THROWS** — the one validated field             |
 *
 * The last row is the shape the other seven should have had. Deny-by-default on BOTH the light name
 * and the field name is what closes the two silent-drop rows, and the gate's B1 asserts both
 * directions: `Avatar` throws, and the rig handed the same value does not.
 *
 * ⚠️ `name` IS NOT REACHABLE and that is deliberate rather than an oversight. `aimRigAt` finds the
 * key by `placement.name === 'key'` to hand the eye shader its direction, and
 * `LightingRig.selftest.mjs`'s spill partition uses the names as its expected ANSWER. A rename is
 * free at the rig and breaks both.
 */
const RIG_LIGHT_NAMES = Object.freeze( [ 'key', 'fill', 'rim', 'kicker' ] );

const PLACEMENT_FIELDS = Object.freeze( {
    azimuthDegrees: Object.freeze( { kind: 'number', min: -360, max: 360 } ),
    elevationDegrees: Object.freeze( { kind: 'number', min: -90, max: 90 } ),
    distanceInHeights: Object.freeze( { kind: 'number', min: 1e-3, max: 100 } ),
    widthInHeights: Object.freeze( { kind: 'number', min: 1e-4, max: 100 } ),
    heightInHeights: Object.freeze( { kind: 'number', min: 1e-4, max: 100 } ),
    irradiance: Object.freeze( { kind: 'number', min: 0, max: 1000 } ),
    shadowFraction: Object.freeze( { kind: 'number', min: 0, max: 0.999 } ),
    colour: Object.freeze( { kind: 'colour', min: 0, max: 0xffffff } )
} );

/**
 * `lighting.exposure`, as a RELATIVE multiplier on `EXPOSURE_CALIBRATION` (0.85).
 *
 * Measured: exposure is ratio-neutral — at x0.5 / x1 / x2 the designed key:fill is **1.3636 at all
 * three** while key irradiance goes 1.2750 / 2.5500 / 5.1000. But `LightingRig.js:240-256`'s own
 * table shows it is NOT neutral to G1 in the rendered frame: at 0.35 a 1.47:1 design MEASURES
 * 2.04:1 and fails, because ACES has more gradient down there. So it is offered, it is relative, and
 * `report().scene.lighting.calibrated` goes false the moment it moves.
 */
const EXPOSURE_MULTIPLIER_RANGE = Object.freeze( { min: 0.25, max: 4 } );

/**
 * `lighting.ambient`, as a RELATIVE multiplier on the rig's own `AMBIENT.fractionOfKey` (0.22).
 *
 * ⚠️ **THIS IS THE MOST GATE-FRAGILE LEVER ON THE WHOLE SURFACE AND NO SHIPPED LOOK TOUCHES IT.**
 * Gate G6 wants whole-image p0.1 luma in 0.004–0.016; the shipped backdrop measures portrait
 * **0.00420** (0.0002 above the floor) and body **0.01597** (0.00003 under the ceiling) — see
 * `BACKDROP_EMISSIVE`. The one measured lever of comparable size, `alive.js`'s `?ambspec=0`, moves
 * body to **0.01989**, out of band. `LightingRig.js:989-991` says it in one line: *"if G6 goes red
 * the suspect is here, not the grade."*
 *
 * A one-code-value window is not a knob. It is exposed because an embedder compositing over their
 * own chrome has a legitimate reason to want it, and it is exposed with this paragraph attached.
 */
const AMBIENT_MULTIPLIER_RANGE = Object.freeze( { min: 0.5, max: 2 } );

/**
 * The three background presets, by name.
 *
 * 🔴 **`transparent` IS DECLARED, DOCUMENTED AND CURRENTLY REFUSED, AND THE REFUSAL IS THE HONEST
 * RESULT OF THIS ROUND RATHER THAN AN OMISSION.** It is the option an embedder actually asks for —
 * an avatar composited over a host page's own chrome — and it does not work today for a reason that
 * is not in this file. Measured in a real GPU chromium on 2026-08-17, against a magenta page behind
 * the canvas (100% magenta with no canvas at all, as the control):
 *
 *     | configuration                          | page shows through | figure     |
 *     |----------------------------------------|-------------------:|------------|
 *     | `studio`, `high`                        |              0.00% | correct    |
 *     | `transparent`, `high`   (TAAU + GTAO)   |              0.00% | BLACK      |
 *     | `transparent`, `balanced` (TAAU)        |              0.00% | correct    |
 *     | `transparent`, `fallback` (MSAA + GTAO) |             41.63% | BLACK      |
 *
 * Two independent blockers, both isolated by moving one dial at a time:
 *
 *   1. **THE TEMPORAL RESOLVE FORCES ALPHA TO 1.** With the grade returning `vec4( vec3( alpha ), 1 )`
 *      — the alpha displayed as a picture — `fallback` reads 41.63% at alpha 0 and 57.80% at alpha 1,
 *      exactly right; `high` reads **100% at alpha 1**. `Grade.compose` carries and premultiplies the
 *      alpha correctly and `Grade.selftest.mjs` is 68/68 on the change; `TAAUNode`/`TRAANode` are
 *      three's and do not carry `.a` through the resolve. So no tier with a temporal resolve can
 *      present a transparent canvas.
 *   2. **GROUND-TRUTH OCCLUSION BLACKS OUT A FRAME WITH NOTHING AT BACKGROUND DEPTH.** Isolated to
 *      the CARD alone: `backdrop: 0x000000` — a black card, same pixels to the eye — renders the
 *      figure perfectly, and `backdrop: false` renders the WHOLE FRAME black on both tiers that
 *      carry GTAO. It is not the card's presence in the draw list either: scaling it to 0.001 and
 *      moving it off-screen reproduces the black frame exactly. `balanced`, the one tier with
 *      `occlusion: false`, renders correctly with no card at all.
 *
 * `fallback` has no temporal resolve and `balanced` has no occlusion, and there is no tier with
 * neither — so `transparent` is refused at `create()` rather than shipping an option that returns an
 * opaque black rectangle. `backdrop: false` on its own IS supported, and resolves `quality: 'auto'`
 * to `balanced` for blocker 2.
 */
export const BACKGROUND_PRESETS = Object.freeze( {
    studio: Object.freeze( { colour: SCENE_CLEAR_COLOUR, backdrop: BACKDROP_EMISSIVE, ground: true } ),
    transparent: Object.freeze( { colour: null, backdrop: false, ground: false } ),
    void: Object.freeze( { colour: 0x000000, backdrop: false, ground: true } )
} );

/** The background names `background` accepts as a shorthand string. */
export const BACKGROUND_PRESET_NAMES = Object.freeze( Object.keys( BACKGROUND_PRESETS ) );

// --- the groom -----------------------------------------------------------------------------------

/** The one groom that exists. `assets/hair/manifest.json` declares exactly this id. */
const HAIR_GROOM_ID = 'bob01';

/** The style names `hair` accepts, beside `false`. One entry, and it is a list on purpose. */
export const HAIR_STYLES = Object.freeze( [ HAIR_GROOM_ID ] );

/**
 * The groom's five bakes, keyed on the FIGURE bake they belong to.
 *
 * 🚩 **THESE MUST STAY STATIC LITERALS INSIDE `new URL( …, import.meta.url )`, AND THAT IS WHY THIS
 * TABLE EXISTS AT ALL RATHER THAN A DIRECTORY AND A JOIN.** vite's asset rewrite fires only on a
 * static literal, so a URL assembled from a directory 404s in dev AND emits no asset in a build —
 * arriving as `SyntaxError: Unexpected token '<'` out of `GLTFLoader.parse`, which is `index.html`
 * being parsed as glTF and names neither the file nor the asset. `HairMaterial.js:3329-3332` carries
 * the same rule against its own `groomDirectoryUrl` convenience, and `resolveAgainstBase` carries it
 * for the figures. `figure/Identity.js:72-77` is the shape this copies.
 *
 * ⚠️ ONE GROOM PER IDENTITY BAKE, AND THE NAMES MUST MATCH. The groom is generated per figure bake
 * because a bob is cut to a skull and the five skulls differ by centimetres. A bake with no groom is
 * a MISS in this map rather than a 404 discovered at fetch time, so `attachHair` can refuse in words
 * before it requests anything.
 *
 * Measured 2026-08-17, all five bakes: **53 groom joints, 0 absent from the figure rig**, `head` /
 * `clavicle_l` / `clavicle_r` present on every one; material `hair_bob01`, `alphaMode: MASK`, cutoff
 * default 0.5, doubleSided, 17,516 vertices, 2 embedded images, exactly one skinned mesh. So the
 * rebind cannot fail on the shipped asset set — it is still checked BY NAME and refused in words,
 * because the failure it guards is a rig rename in the figure pipeline.
 */
const HAIR_BAKES = new Map( [
    [ 'figure_g000', new URL( '../../../assets/hair/bob01/g000.glb', import.meta.url ).href ],
    [ 'figure_g025', new URL( '../../../assets/hair/bob01/g025.glb', import.meta.url ).href ],
    [ 'figure_g050', new URL( '../../../assets/hair/bob01/g050.glb', import.meta.url ).href ],
    [ 'figure_g075', new URL( '../../../assets/hair/bob01/g075.glb', import.meta.url ).href ],
    [ 'figure_g100', new URL( '../../../assets/hair/bob01/g100.glb', import.meta.url ).href ]
] );

/**
 * The two SIDECAR sheets. `albedo.png` and `normal.png` are embedded in every groom bake and are
 * taken off the mesh's own material instead, so the material and the groom can never disagree about
 * which bake they are. Same static-literal rule as `HAIR_BAKES`.
 */
const HAIR_SHEET_URLS = Object.freeze( {
    flow: new URL( '../../../assets/hair/bob01/flow.png', import.meta.url ).href,
    depth: new URL( '../../../assets/hair/bob01/depth.png', import.meta.url ).href
} );

/**
 * Which order-independent-transparency arm each tier gets, and whether the DFTL solver runs.
 *
 * Measured hair cost at 1920x1080 dpr 1, 100 samples after 60 warm-up, control 12.038 p50 /
 * 13.347 p95: `cutout` +0.761/+0.964, `hash` +1.229/+1.961, `wboit` +0.826/**+9.416**.
 *
 * 🚩 `fallback` REFUSES BOTH THE SHIPPED ARM AND THE SOLVER, AND ALL THREE REASONS ARE STRUCTURAL
 * RATHER THAN BUDGET:
 *
 *   1. `stage.multisampled === true` on that tier, so `createHairMaterial` sets `alphaToCoverage`,
 *      and `configureHairMaterial( …, 'stochastic', { alphaToCoverage: true } )` **THROWS**
 *      (`HairOIT.js:1086-1093`) — it would swap the coverage test for an edge softener around a
 *      per-pixel-random threshold and stop being an unbiased estimator while still drawing a
 *      plausible picture.
 *   2. `stochastic` is an estimator only a temporal resolve integrates, and this tier is
 *      `temporalAA: 'off'`. Without one it is a one-sample stipple.
 *   3. The tier exists because the renderer came up on WebGL2, whose compute is transform feedback —
 *      one output set per invocation — while `HairDynamics`' solve kernel writes 17 and its rebuild
 *      writes 2. ⚠️ **(3) IS A STRUCTURAL READ OF TWO SOURCES AND IS NOT BROWSER-VERIFIED**, which
 *      is why it is written down here rather than left as the reason nobody can find later.
 */
const HAIR_BY_TIER = Object.freeze( {
    high: Object.freeze( { oit: 'stochastic', solver: true } ),
    balanced: Object.freeze( { oit: 'stochastic', solver: true } ),
    fallback: Object.freeze( { oit: 'cutout', solver: false } )
} );

// --- the eyelash and eyebrow cards -------------------------------------------------------------

/**
 * The alpha below which a card texel is sheet background rather than painted fibre.
 *
 * Read off the two card textures' own alpha histograms on `figure_g050.glb` at 512x512: 86.0% of
 * eyelash texels and 90.4% of eyebrow texels sit in alpha 0.0–0.1, and glTF's `alphaMode: MASK`
 * default of 0.5 throws away the entire soft ramp above that decile — 15,368 lash and 20,262 brow
 * texels, which is where the "visible holes in the brow" came from. `alive.js:3958-3978`.
 */
const CARD_ALPHA_CUTOFF = 0.1;

/**
 * The darkest albedo a card may claim, as an sRGB hex — the look spec's own published hair base
 * albedo, "luma 0.067 (#150F17)".
 *
 * 🎯 THIS IS THE WHOLE OF GATE G6 AT PORTRAIT FRAMING. Both card textures' cores are 0.0000 LINEAR
 * — not dark, zero — and an ungraded shipped plate at 900x1200 carried 1,431 pixels at literally
 * RGB(0,0,0), all of them in the brow and lash band. A surface at zero albedo with
 * `specularIntensity 0` cannot be raised by any light, any ambient term or any grade, so three
 * rounds spent in `LightingRig`, `Grade` and `GroundContact` were spent in the wrong files. The
 * finding is that ANY non-zero floor takes the cards out of the tail; the value is the spec's
 * published one rather than one tuned for the number it produces. `alive.js:3980-4010`.
 */
const CARD_ALBEDO_FLOOR = 0x150F17;

// --- quality -----------------------------------------------------------------------------------

/**
 * The three tiers, as the render switches each one moves and the measurement that priced it.
 *
 * ⚠️ **AUTO-SELECTION FROM A MEASURED FRAME BUDGET IS PUNCH-LIST 7.2 AND IS NOT DONE HERE.** Said
 * out loud so nobody reads `quality: 'auto'` as more than it is: `auto` resolves on a STRUCTURAL
 * fact — whether the adapter can carry the temporal path at all — and never on a timing. A tier
 * chosen from a frame budget needs frames to have been measured on the machine in front of it, and
 * that measurement, its warm-up and its hysteresis are 7.2's whole subject.
 *
 * Each tier moves switches this repository has already priced:
 *
 *   - **`high`** — TAAU + grade + GTAO at `low` + shadows. This is `alive.js`'s shipped default
 *     exactly, which is the configuration every committed gate number is stated on. TAAU takes
 *     silhouette transitions that jump in a single pixel from 67.9% to 17.9% against MSAA, and the
 *     lash/brow card band from 44.5% to 27.1% (`alive.js:657-670`). GTAO `low` — 8 samples at half
 *     resolution — is the only quality whose p50 AND p95 both stay inside 16.6 ms
 *     (12.9949 / 13.921 against medium's 14.0262 / 25.855), and it keeps four fifths of the
 *     occlusion depth (`GTAO.js`, `GTAO_SHIPPING_QUALITY`).
 *   - **`balanced`** — the same, with the occlusion off. That is the +0.845 ms p50 GTAO costs,
 *     given back. ⚠️ It is not a free subtraction: with GTAO off the hemisphere ambient goes back
 *     into the forward shader as a `HemisphereLight`, so the two tiers differ in WHERE the ambient
 *     is computed as well as in whether it is occluded. Step 1 of the construction order is what
 *     makes that one decision rather than two files disagreeing.
 *   - **`fallback`** — MSAA instead of TAAU, and NOTHING ELSE MOVED. WebGL2 has no velocity buffer,
 *     so `taau` and `traa` genuinely cannot run on it; MSAA is that tier's own default. One dial,
 *     deliberately: `alive.js:703-708` records that a fallback which silently moves two dials
 *     cannot be attributed, and the same argument applies to a tier.
 *
 * Sharpness is per-tier for an architectural reason rather than a measured one: RCAS recovers what
 * a temporal resolve blurs, and a forward MSAA'd frame has nothing to recover. `Grade`'s own
 * constructor default is off; `TEMPORAL_RECOVERY_SHARPNESS` (1.2) is what the sweep chose for the
 * temporal path, inside G4's band with 8% of margin against `none`'s 2.5% (`alive.js:1780-1792`).
 */
export const QUALITY_TIERS = Object.freeze( {
    high: Object.freeze( {
        temporalAA: 'taau',
        antialias: false,
        grade: true,
        gradeSharpness: TEMPORAL_RECOVERY_SHARPNESS,
        occlusion: true,
        occlusionQuality: GTAO_SHIPPING_QUALITY,
        shadows: true
    } ),
    balanced: Object.freeze( {
        temporalAA: 'taau',
        antialias: false,
        grade: true,
        gradeSharpness: TEMPORAL_RECOVERY_SHARPNESS,
        occlusion: false,
        occlusionQuality: GTAO_SHIPPING_QUALITY,
        shadows: true
    } ),
    fallback: Object.freeze( {
        temporalAA: 'off',
        antialias: true,
        grade: true,
        gradeSharpness: undefined,
        occlusion: true,
        occlusionQuality: GTAO_SHIPPING_QUALITY,
        shadows: true
    } )
} );

/** The tier names `quality` accepts, plus the one that resolves to another. */
export const QUALITY_REQUESTS = Object.freeze( [ 'auto', ...Object.keys( QUALITY_TIERS ) ] );

/** The two framings. A portrait reads a blink; a body frame reads a rest pose. Neither answers for the other. */
export const FRAME_MODES = Object.freeze( [ 'portrait', 'body' ] );

/**
 * What `create()` assumes when the caller says nothing.
 *
 * Exported because "the defaults" is exactly the thing a consumer needs to be able to read and a
 * gate needs to be able to assert against, and because a default nobody can see is a number in a
 * comment. `seed` is `alive.js`'s own so a trace taken through either wiring is comparable.
 */
export const AVATAR_DEFAULTS = Object.freeze( {
    identity: Object.freeze( { gender: 0.5 } ),
    quality: 'auto',
    frame: 'portrait',
    seed: 20260807,
    affect: true,
    autoStart: true,
    pose: DEFAULT_REST_POSE,
    assetBaseUrl: null,
    bakedMapBaseUrl: null,

    /**
     * 🎯 THE DEFAULTS ARE THE SHIPPED BEHAVIOUR, AND THAT IS AN ASSERTION RATHER THAN A COMMENT.
     * `lighting: 'studio'` resolves to zero rig overrides; `background: 'studio'` resolves to the
     * three literals this file already had — `SCENE_CLEAR_COLOUR`, `BACKDROP_EMISSIVE` and a ground
     * plane. Clause D2 of the gate holds each of the three, so changing any literal without changing
     * this table goes red.
     */
    lighting: 'studio',
    background: 'studio',

    /**
     * 🚩 OFF, AND THE THREE REASONS ARE MEASURED RATHER THAN CAUTIOUS.
     *
     *   1. **One groom exists.** `assets/hair/manifest.json` declares one (`bob01`) and
     *      `assets/hair/` holds one directory. A default that names the only entry in a list of one
     *      is a default that has to be renamed the day a second lands.
     *   2. **Cost.** The groom is 19,202,726 B (18.313 MiB) of assets on top of the 11.5 MB bake,
     *      of which 3,327,232 B is a third `await` inside `swapFigure`; and it adds a measured
     *      **+2.0 ms at p50**. 🚩 NOT p95: the round that measured this states in docs/API.md that
     *      "p95 does not resolve — the spread between two runs of the SAME configuration is larger
     *      than the difference between configurations", and its own p95 column runs the wrong way
     *      (haired 18.8 against bald 29.6 on one repetition). p50 is the number that survived.
     *   3. **Two process-wide mutations that a library must not make behind a caller's back.**
     *      `createHairDynamics` returns NO `dispose` (957 kB plus five compute pipelines per swap),
     *      and `installHairVelocity` MONKEY-PATCHES `NodeMaterial.prototype.setupPosition` globally
     *      with no uninstall (`HairVelocity.js:162-183`). Both are benign on a testbed page and
     *      both are process-wide in a library. `leakedHandles()` is an own-property walk and
     *      **cannot see a prototype patch** — the same structural blindness the `setGrade` 🚩
     *      already documents — so both are declared in `report().hair` instead of being hidden.
     */
    hair: false
} );

export class Avatar {

    /**
     * Builds a living figure on a canvas.
     *
     * The only required option is `canvas`. Everything else refines a figure that would already be
     * breathing, blinking and gazing without it.
     *
     * @param {Object} options
     * @param {HTMLCanvasElement} options.canvas - REQUIRED. Sized by CSS; `Stage` follows it.
     * @param {Object} [options.identity] - Anything `figure/Identity.js` takes. `{ gender: 0.5 }`
     *   by default; 0 masculine, 1 feminine, anything between snaps to the nearest of five bakes.
     * @param {'auto'|'high'|'balanced'|'fallback'} [options.quality='auto'] - See `QUALITY_TIERS`,
     *   including what `auto` does and does not decide.
     * @param {'portrait'|'body'} [options.frame='portrait']
     * @param {number} [options.seed=20260807] - Root seed for every motion layer's stream. Same
     *   seed and same dt sequence produce an identical trace.
     * @param {boolean} [options.affect=true] - Build the expression and posture layers.
     * @param {boolean} [options.autoStart=true] - Drive the rAF loop. `false` hands the clock to
     *   `update( dt )`.
     * @param {string} [options.pose='relaxed-standing'] - A `figure/RestPose.js` name, or `null`
     *   for the untouched bind pose, which is a T-pose and is the A side of the comparison the rest
     *   pose exists to win.
     * @param {?string} [options.assetBaseUrl=null] - Where `assets/figures/*.glb` are served from.
     *   Null uses this module's own bundler-visible URLs — see `resolveAgainstBase`.
     * @param {?string} [options.bakedMapBaseUrl=null] - Where the per-bake curvature and cavity PNGs
     *   are served from. Null uses `SkinMaterial`'s own resolution.
     * @param {number} [options.framedHeightMetres] - Override the framed height, in metres. 0.18 is
     *   an eyes-only crop; absent, portrait uses 0.42 and body measures the figure.
     * @param {string|Object} [options.lighting='studio'] - A `SCENE_LOOKS` name, or
     *   `{ look, exposure, ambient, shadows, lights }`. `exposure` and `ambient` are RELATIVE
     *   multipliers; `lights` is the per-light escape hatch and is validated field by field. See
     *   `SCENE_LOOKS` and `setLighting`.
     * @param {string|number|Object} [options.background='studio'] - A `BACKGROUND_PRESETS` name, a
     *   plain hex for the clear colour alone, or `{ colour, backdrop, ground }`. `colour: null` is
     *   a transparent canvas — read `setBackground` before shipping one.
     * @param {false|string} [options.hair=false] - `'bob01'`, or `false` for no groom. See
     *   `AVATAR_DEFAULTS.hair` for the three measured reasons it is off by default.
     * @returns {Promise<Avatar>}
     */
    static async create( options = {} ) {

        const canvas = options.canvas;

        // Refused first and in words, before any GPU work, because the failure it replaces is
        // `Stage.create` handing `undefined` to `WebGPURenderer` and the message arriving from
        // inside three with nothing in it that names this API.
        if ( canvas === undefined || canvas === null || typeof canvas.getContext !== 'function' ) {

            throw new TypeError(
                'Avatar.create: `canvas` is required and must be an HTMLCanvasElement — ' +
                'Avatar.create( { canvas: document.getElementById( "stage" ) } ).' );

        }

        const requestedQuality = options.quality ?? AVATAR_DEFAULTS.quality;

        if ( QUALITY_REQUESTS.includes( requestedQuality ) === false ) {

            throw new TypeError(
                `Avatar.create: quality must be one of ${ QUALITY_REQUESTS.join( ', ' ) }, got '${ requestedQuality }'.` );

        }

        const frameMode = options.frame ?? AVATAR_DEFAULTS.frame;

        if ( FRAME_MODES.includes( frameMode ) === false ) {

            throw new TypeError(
                `Avatar.create: frame must be one of ${ FRAME_MODES.join( ', ' ) }, got '${ frameMode }'.` );

        }

        const seed = options.seed ?? AVATAR_DEFAULTS.seed;

        if ( Number.isFinite( seed ) === false ) {

            throw new TypeError( `Avatar.create: seed must be a finite number, got ${ seed }.` );

        }

        // The three scene options are resolved and refused HERE, beside `quality`/`frame`/`seed`
        // and before any GPU work, for the same reason those are: the subsystems behind them do
        // not validate, and the failure arrives as `NaN` in a scene graph or as a light that is
        // silently dropped. Each resolver throws a `TypeError` naming the field AND the range.
        const lighting = resolveLightingOption( options.lighting ?? AVATAR_DEFAULTS.lighting );
        const background = resolveBackgroundOption( options.background ?? AVATAR_DEFAULTS.background );
        const hairStyle = resolveHairOption( options.hair ?? AVATAR_DEFAULTS.hair );

        const identity = new Identity( options.identity ?? AVATAR_DEFAULTS.identity );

        // 🚩 REFUSED RATHER THAN LEFT TO BE DISCOVERED. `Identity` in `LIVE_PREVIEW` mode resolves
        // to TWO bakes (`Identity.js:245-246`) and `swapFigure` takes `plan.figures[0].url` only, so
        // a cross-faded identity would get the LOWER bake's groom on the UPPER bake's head — a
        // sunken cap, at an offset that is centimetres at the extremes. `Avatar` ships `NEAREST`, so
        // this is latent rather than live; a latent defect behind a new option is exactly the kind
        // this repository has paid for twice.
        if ( hairStyle !== null && identity.mode === LIVE_PREVIEW ) {

            throw new TypeError(
                `Avatar.create: hair '${ hairStyle }' cannot run with identity mode '${ LIVE_PREVIEW }'. ` +
                'The groom is baked per figure and a cross-faded identity resolves to two bakes, so ' +
                'the groom would sit on a head it was not cut for. Use the default nearest mode, or ' +
                'hair: false.' );

        }

        const avatar = new Avatar( {
            canvas,
            requestedQuality,
            frameMode,
            seed,
            identity,
            affectEnabled: options.affect ?? AVATAR_DEFAULTS.affect,
            autoStart: options.autoStart ?? AVATAR_DEFAULTS.autoStart,
            poseName: options.pose === undefined ? AVATAR_DEFAULTS.pose : options.pose,
            assetBaseUrl: options.assetBaseUrl ?? AVATAR_DEFAULTS.assetBaseUrl,
            bakedMapBaseUrl: options.bakedMapBaseUrl ?? AVATAR_DEFAULTS.bakedMapBaseUrl,
            heightOverride: Number.isFinite( options.framedHeightMetres ) ? options.framedHeightMetres : null,
            lighting,
            background,
            hairStyle
        } );

        // 🚩 THE MOST LIKELY PRODUCTION FAILURE IS A MISSING GLB, AND WITHOUT THIS IT LEAKED A WHOLE
        // GPU SESSION EVERY TIME.
        //
        // `build()` awaits four times and the first is `Figure.load` of an 11.5 MB bake. By then
        // `Stage.create` has already constructed the `WebGPURenderer` AND started the rAF loop
        // (`Stage.js:357`), the rig is attached and the grade is installed. If the fetch throws, the
        // caller gets a rejected promise and **no handle**, so `dispose()` is unreachable and the
        // renderer plus its live animation chain stay alive for the lifetime of the page.
        //
        // Measured by an adversarial verifier before this block existed, driving a real `build()`
        // with `Figure.load` throwing a 404:
        //
        //     create() rejected with: GLTFLoader: 404 on figure_g050.glb
        //     Stage.create calls: 1   Stage.dispose calls: 0
        //     LightingRig attachTo: 1  LightingRig dispose: 0
        //     Grade installed: 1       Grade disposed: 0
        //
        // ⚠️ AND THE 404 IS NOT HYPOTHETICAL: `assets/figures/*.glb` is gitignored, so a fresh clone
        // has no bake at all and EVERY `create()` on it took this path. Retrying in a loop — which
        // is what a page with a reconnect does — leaked one renderer per attempt.
        //
        // `dispose()` is idempotent and tolerant of a half-built avatar by construction, which is
        // what makes it safe to call on an object whose `build()` did not finish.
        try {

            await avatar.build();

        } catch ( error ) {

            avatar.dispose();
            throw error;

        }

        return avatar;

    }

    /**
     * Holds the whole session. Not the constructor a consumer calls — `create()` is, because half
     * of this is async and a half-built avatar is a worse thing to hand back than a promise.
     *
     * Every field is declared here rather than appearing during `build()`, so `dispose()` and
     * `report()` have one object to walk and the leak check below can be deny-by-default.
     */
    constructor( session ) {

        // --- what the caller asked for ---
        this.canvas = session.canvas;
        this.requestedQuality = session.requestedQuality;
        this.frameMode = session.frameMode;
        this.seed = session.seed;
        this.identity = session.identity;
        this.affectEnabled = session.affectEnabled;
        this.autoStart = session.autoStart;
        this.poseName = session.poseName;
        this.assetBaseUrl = session.assetBaseUrl;
        this.bakedMapBaseUrl = session.bakedMapBaseUrl;
        this.heightOverride = session.heightOverride;

        // --- the scene, as resolved and validated by `create()` ---
        this.lighting = session.lighting;
        this.background = session.background;

        // The style id, or null. Named `hairStyle` rather than `hair` so the option and the live
        // groom handle below cannot be confused for one another in `report()` or in a leak walk.
        this.hairStyle = session.hairStyle;

        // --- resolved at build ---
        this.tier = null;
        this.tierSettings = null;

        // True when the renderer came up on a backend the resolved tier cannot run on. See `build`.
        this.backendMismatch = false;

        // --- the render side ---
        this.stage = null;
        this.lights = null;

        // Held rather than handed away — see the 🚩 at the `setGrade` call for why a
        // handle that never lands on `this` is invisible to `leakedHandles()`.
        this.grade = null;
        this.ground = null;
        this.backdrop = null;
        this.unsubscribeFrame = null;

        // --- the figure and its shading, all rebuilt per bake ---
        this.figure = null;
        this.skeleton = null;
        this.target = null;
        this.restPose = null;
        this.currentBakeName = null;
        this.skin = null;
        this.eyes = null;
        this.eyeOcclusion = null;
        this.cards = [];
        this.framedHeightMetres = PORTRAIT_HEIGHT_METRES;

        // Where the camera and the rig are currently pointed. Kept because `setLighting` has to
        // RE-AIM and `aimAt` takes the focus — see the 🚩 in `applyLighting` for why re-aiming is
        // not optional after an override.
        this.focus = new Vector3();

        // --- the groom, all rebuilt per bake ---
        //
        // Four handles rather than one because they have four different readers and three different
        // lifetimes. `hairRoot` is the Group under `figure.root`; `hairMaterial` carries a `dispose`
        // and is therefore VISIBLE to `leakedHandles()`; `hairDynamics` carries NONE and is
        // therefore invisible to it, which is why it is declared in `report().hair` instead; and
        // `hairUpdate` is the per-frame closure `advanceFrame` calls.
        this.hairRoot = null;
        this.hairMaterial = null;
        this.hairDynamics = null;
        this.hairUpdate = null;
        this.hairArm = 'off';
        this.hairVelocityRepaired = null;

        // The GLB's OWN materials, kept only so their textures can be freed. `applyHairMaterial`
        // replaces `object.material`, which orphans them — and three's `Material.dispose()` frees no
        // textures, so the 1024x1024 embedded albedo and normal would survive every swap otherwise.
        this.hairSourceMaterials = [];

        // A fast sequence of `setIdentity` calls starts several loads; only the newest may land.
        // `alive.js` calls this `loadToken` and the mechanism is the same.
        this.loadToken = 0;

        // --- motion ---
        this.stack = null;
        this.layers = {};
        this.pupilScale = 1;

        // --- affect ---
        this.affectState = null;
        this.expression = null;
        this.posture = null;
        this.reflex = null;

        // --- speech ---
        this.viseme = null;
        this.gesture = null;

        // 🎯 THE SPEECH CLOCK IS SIMULATION TIME, NOT WALL CLOCK, AND NOT `AudioContext.currentTime`.
        // `VisemeSchedule` takes its clock as an argument precisely so the host can choose; this one
        // is the sum of the deltas the stack has been advanced by. That makes an utterance
        // reproducible under `autoStart: false` at a fixed step — same seed, same dt sequence, same
        // mouth — which is the property a gate and a capture both need. A consumer playing real
        // audio should pass `at: <the instant the audio graph will start>` in seconds of THIS clock;
        // `VisemeSchedule`'s header carries why "now" is the wrong answer there.
        this.clockSeconds = 0;
        this.utterance = null;

        this.disposed = false;

    }

    // --- construction ---------------------------------------------------------------------

    /**
     * The verified order, once. Split out of `create()` only so the order reads as ten steps
     * rather than as a paragraph inside a factory.
     */
    async build() {

        // STEP 1 — before the rig, and the whole reason it is first. `LightingRig` gets
        // `ambient: occlusion.enabled === false`; with the occlusion on, the hemisphere term is
        // re-evaluated per pixel through the bent normal, and leaving the light in the scene too
        // would put the ambient in the frame twice — a uniform lift that reads as an exposure
        // mistake rather than as a double count.
        this.stage = new Stage();

        this.tier = await resolveTier( this.requestedQuality, this.stage, {
            hair: this.hairStyle !== null,
            backdropless: this.background.backdrop === false
        } );

        this.tierSettings = QUALITY_TIERS[ this.tier ];

        // 🔴 REFUSED HERE RATHER THAN RENDERED BLACK, AND THE TWO HALVES REACH THIS POINT FROM
        // DIFFERENT PLACES — `background` is the caller's and `occlusion` is the tier's, so this is
        // the first line at which both are known. `auto` never lands here (it resolves to
        // `balanced` for exactly this), so the only way in is an EXPLICIT tier that carries GTAO.
        if ( this.background.backdrop === false && this.tierSettings.occlusion === true ) {

            throw new TypeError(
                `Avatar.create: background.backdrop: false cannot run on quality '${ this.tier }', ` +
                'which carries ground-truth occlusion. Measured 2026-08-17 in a GPU chromium: with ' +
                'nothing at background depth the occlusion pass renders the WHOLE FRAME black — ' +
                'isolated to the card alone, because backdrop: 0x000000 renders the figure ' +
                'perfectly and scaling the card to 0.001 off-screen reproduces the black frame. ' +
                "Use quality: 'balanced' (occlusion off) or 'auto', which resolves to it, or keep " +
                'the card and set its level instead: background: { backdrop: 0x000000 }.' );

        }

        const occlusionEnabled = this.tierSettings.occlusion;
        const wantsGrade = this.tierSettings.grade;
        const temporalAA = this.tierSettings.temporalAA;

        this.hairArm = this.hairStyle === null ? 'off' : HAIR_BY_TIER[ this.tier ].oit;

        // STEP 2 — the pipeline is asked for explicitly. Grade and GTAO both need the deferred path
        // and neither implies it inside `Stage`; temporal AA does imply it, and asking anyway is
        // one term rather than a dependency a reader has to know.
        //
        // 🚩 `hairOIT` IS PASSED EVEN THOUGH ONLY `wboit` CHANGES ANYTHING IN `Stage`, AND THE
        // REASON IS THE CENSUS RATHER THAN THE RENDER. `Stage.stats.hairOIT` reads
        // `this.hairOITMode` (`Stage.js:581`), so an `Avatar` shipping `stochastic` without telling
        // `Stage.create` would report `'off'` on a page that is running hair — and
        // `report().subsystems` is what a gate reads. A frame that is right and a census that is
        // wrong is the failure mode this whole file's `censusOfShading` exists to refuse.
        await this.stage.create( this.canvas, {
            fieldOfView: PORTRAIT_FIELD_OF_VIEW_DEGREES,
            near: 0.01,
            far: 50,
            antialias: this.tierSettings.antialias,
            temporalAA,
            hairOIT: this.hairArm,
            pipeline: temporalAA !== 'off' || wantsGrade || occlusionEnabled
        } );

        // 🚩 THE BACKEND IS READ BACK RATHER THAN TRUSTED, AND THIS IS THE LAST GAP `resolveTier`
        // CANNOT CLOSE. `resolveTier` already asks the adapter rather than only asking whether
        // `navigator.gpu` exists, so the ordinary "WebGPU advertised, adapter refuses" case never
        // reaches here. What can still reach here is device creation failing AFTER a successful
        // adapter request: `Renderer.init()` catches that and swaps in a WebGL2 backend
        // (`Stage.js:315-317`), and WebGL2 has no velocity buffer, so the temporal path this tier
        // asked for has nothing to resolve against.
        //
        // ⚠️ IT SAYS SO AND CONTINUES; IT DOES NOT REBUILD. A rebuild would mean constructing a
        // second renderer against a canvas that already has a context bound, and I have no way to
        // run a browser to prove that works — an unverified recovery path that can itself fail is
        // worse than a message naming the one-line fix. Recorded in `report().quality` as well as
        // warned, because a console line is not something a gate can read.
        this.backendMismatch = this.stage.backendName === 'webgl2' && temporalAA !== 'off';

        if ( this.backendMismatch === true ) {

            console.warn( `Avatar: tier '${ this.tier }' asked for temporal AA '${ temporalAA }', and ` +
                'the renderer came up on WebGL2, which has no velocity buffer. The frame will be ' +
                "wrong. Pass `quality: 'fallback'` to get this tier's own MSAA path." );

        }

        // STEP 3 — after the pipeline exists; `setGrade` throws without it.
        //
        // 🚩 THE GRADE IS HELD ON `this` DELIBERATELY, AND THE LINE THAT USED TO BE HERE PASSED IT
        // STRAIGHT INTO `setGrade` WITHOUT KEEPING IT. That leaked, and worse, it leaked INVISIBLY:
        // `leakedHandles()` walks `Object.entries( this )`, so a handle never assigned to `this` is
        // outside its reach BY CONSTRUCTION. The disposal clause read green while a render target
        // went unreleased on every create/destroy cycle of the two tiers that ship a grade.
        //
        // `Grade.dispose()` exists (`Grade.js:407-415`) and frees the bloom and sharpen render
        // targets; repo-wide it had NO CALLER. `Stage.dispose()` sets `this.grade = null` at
        // `Stage.js:623` without disposing it, unlike the `ambientOcclusion` three lines above at
        // `:609-612` — so nothing anywhere was going to free it.
        //
        // 🎯 The lesson is about the INSTRUMENT, not the leak: a deny-by-default walk is only
        // deny-by-default over the things it can see. `leakedHandles()` is an own-property walk, so
        // "every handle this file acquires is released" is true only of handles this file KEEPS.
        // Anything handed to a subsystem and forgotten is invisible to it — which is the same shape
        // as this repo's structurally-blind statistics, on the disposal side.
        if ( this.tierSettings.grade === true ) {

            this.grade = new Grade( { sharpness: this.tierSettings.gradeSharpness } );
            this.stage.setGrade( this.grade );

        }

        // 🚩 WRITE #1 OF THE FOUR THAT DECIDE WHETHER `background: 'transparent'` MEANS ANYTHING,
        // AND IT IS ONE LINE AND DECISIVE. `Background.js:71-76` — ANY `isColor` background sets
        // `_clearColor.a = 1` and `forceClear = true`, so a scene with a colour background can never
        // present a transparent canvas no matter what the renderer was constructed with. `null`
        // falls through to `:65-68` and the renderer's own alpha-0 clear, which
        // `Renderer.js:465`/`:473` already computes (`alphaClear = this.alpha === true ? 0 : 1`, and
        // `alpha` defaults to true) and which `WebGPUBackend.js:349` already configures the canvas
        // for (`alphaMode = parameters.alpha ? 'premultiplied' : 'opaque'`).
        //
        // Writes #2 and #3 are the emissive card and the ground plane, both below. Write #4 is
        // `Grade.compose`'s final node, which returned a LITERAL alpha of 1 and survived fixing the
        // other three — see `Grade.js`.
        this.stage.scene.background = this.background.colour === null
            ? null
            : new Color( this.background.colour );

        this.backdrop = this.background.backdrop === false
            ? null
            : buildBackdrop( this.stage, this.background.backdrop );

        // STEP 4 — `attachTo` is where the linearly-transformed-cosine tables are installed. Without
        // them every RectAreaLight contributes nothing and the figure renders black, which looks
        // exactly like a broken material.
        //
        // The look reaches the rig as `overrides`, resolved against THIS framing's authored table —
        // never as a `preset`, which is the framing axis `setFraming` owns. See `SCENE_LOOKS`.
        this.lights = new LightingRig( {
            preset: this.frameMode,
            shadows: this.lighting.shadows ?? this.tierSettings.shadows,
            ambient: this.tierSettings.occlusion === false,
            exposure: EXPOSURE_CALIBRATION * this.lighting.exposure,
            ambientFractionOfKey: shippedAmbientFractionOfKey() * this.lighting.ambient,
            overrides: this.lightOverridesFor( this.frameMode )
        } );

        this.lights.attachTo( this.stage.scene, this.stage.renderer );

        // STEP 5 — after the rig, because the composite needs the ambient the rig would have built.
        // `describeAmbient()` reports it whether or not the light was attached, which is what makes
        // "the term moved" a property of one flag rather than of two files agreeing.
        if ( this.tierSettings.occlusion === true ) {

            this.stage.setAmbientOcclusion( createGroundTruthOcclusion( {
                gbuffer: this.stage.gbuffer,
                camera: this.stage.camera,
                ambient: this.lights.describeAmbient(),
                quality: this.tierSettings.occlusionQuality
            } ) );

        }

        // 🎯 THE FIGURE USED TO FLOAT AND A SHADOW MAP COULD NEVER HAVE FIXED IT: 60% of the light
        // landing on the floor beside a sole comes from two RectAreaLights, which cannot cast a
        // shadow at all (three.js #14161). `GroundContact` occludes the hemisphere in closed form
        // instead, using spheres whose radii are measured off the bake that is actually loaded —
        // which is why `fitTo` re-runs on every identity swap rather than once here.
        //
        // ⚠️ **`background.ground: false` IS A DOCUMENTED DOWNGRADE, NOT A FREE WIN.** The paragraph
        // above is the reason: take the plane away and the figure floats, because the analytic
        // occlusion has nothing to darken. It is offered because an opaque 20 m plane fills a
        // transparent frame and there is no way to composite around that; a shadow-catcher that
        // writes alpha is the follow-up, and it is NOT claimed here.
        if ( this.background.ground === true ) {

            this.ground = new GroundContact( { occlusion: true } );
            this.ground.attachTo( this.stage.scene );

        }

        // STEP 6.
        this.stack = new MotionStack( { seed: this.seed } );

        // STEP 7 — construction order. `MOTION_ORDER` decides the running order; this order is the
        // one a reader can follow, and it is the order the contract states.
        this.buildLayers();

        // STEP 8 — load, pose, snapshot, bind.
        this.restPose = this.poseName === null ? null : RestPose.load( this.poseName );
        await this.swapFigure();

        // STEP 9 — after the bind, so `MotionStack.add` runs each layer's `onBind` against a target
        // that already exists (`MotionStack.js:186-191`).
        for ( const layer of Object.values( this.layers ) ) this.stack.add( layer );

        // 🚩 TRAP (b), AND THIS IS WHERE IT IS PAID FOR. `HandIdle` reaches into a SIBLING LAYER by
        // name: on its first frame it writes `owner.fingersEnabled = false` on the layer called
        // `claimFingersFrom` (default `'bodyIdle'`), and it does NOT re-declare the finger channels
        // (`HandIdle.js:269`, `:413`). So if `bodyIdle` is absent, renamed, or added after the first
        // update, both layers write the fingers and their contributions SUM — which is a silent
        // doubling, not an error. The claim's whole failure mode is silence, so the assertion is
        // here rather than in a comment: it is checked once, at build, against the stack itself.
        this.assertFingerClaimCanResolve();

        this.attachAffect();
        this.attachSpeech();

        // 🚩 TRAP (d). Pupil dilation lands on the eye shader's own uniform, and it goes through a
        // SINK rather than through `pupil.driveUniform`. `driveUniform` appends to a list with no
        // way to remove an entry (`alive.js:1061-1072`), so every identity swap would leave a dead
        // uniform being written for the rest of the session — a leak that grows with each swap and
        // that nothing in the frame would report. One sink, added once, reading whichever eye
        // material is current.
        this.layers.pupil.addSink( ( scale ) => {

            this.pupilScale = scale;
            if ( this.eyes !== null ) this.eyes.pupilScaleUniform.value = scale;

        } );

        // STEP 10 — the frame. Registered on the stage either way; under `autoStart: false` the
        // stage's own loop is stopped and `update( dt )` calls the same body directly, so the two
        // clocks cannot drift into being different simulations.
        this.unsubscribeFrame = this.stage.onFrame( ( deltaSeconds ) => this.advanceFrame( deltaSeconds ) );

        if ( this.autoStart === false ) {

            // ⚠️ `setAnimationLoop( null )` DOES NOT STOP THE rAF CHAIN, AND THAT IS WHY IT IS THE
            // RIGHT CALL HERE. Read at three r185: `Renderer.setAnimationLoop` only assigns
            // `Animation._animationLoop`, while `Animation.start`'s own `update` closure keeps
            // requesting frames and keeps calling `nodes.nodeFrame.update()`
            // (`three/src/renderers/common/Animation.js:70-88`). So the stage stops drawing and
            // stops firing frame callbacks — the caller owns the clock, which is what was asked —
            // and the node clock keeps ticking, which is what keeps SKINNING alive. Stopping the
            // chain properly needs `renderer._animation.stop()`, a private, and the failure it
            // produces is a live simulation rendered onto a frozen pose. `Renderer.dispose()` does
            // call `_animation.dispose()`, so teardown genuinely stops it.
            //
            // The honest limit: the renderer's frame epoch is therefore NOT pinned to the caller's
            // step. `update( dt )` gives a fixed simulation step, not a bit-reproducible plate;
            // reproducible plates are the testbed's `?capture` and stay there.
            await this.stage.renderer.setAnimationLoop( null );

        }

    }

    /**
     * The nine idle layers, constructed in the order the contract states.
     *
     * Three of them are coupled and the couplings are the reason this is a function rather than an
     * object literal:
     *
     *   - `Sway` hands its drawn weight-shift amplitude to `BodyIdle`, so a big shift gets a big
     *     arm swing instead of the arms drifting on obliviously while the pelvis moves.
     *   - `IdleMotion` is built `armsEnabled: 'auto'`, which is its own answer to arm doubling: it
     *     declares the six arm bones and so does `BodyIdle`, and bone contributions SUM. With a
     *     layer named `bodyIdle` in the stack it stands down to the head alone.
     *   - `Gaze` carries a second layer, `gaze.head`, added separately because the two sit in
     *     different `MOTION_ORDER` slots — HEAD runs before GAZE so the eyes can counter-rotate
     *     against the head position this frame actually landed on. `FacialIdle` comes after `Blink`
     *     for the same kind of reason: it reads this frame's lid closure to know how much lid-follow
     *     is left to give.
     *
     * 🚩 THE KEYS OF THIS OBJECT ARE NOT DECORATION. Trap (b) resolves `bodyIdle` by name out of the
     * stack, and `MotionStack.add` seeds each layer's random stream from its name — so renaming one
     * changes the trace at a fixed seed as well as breaking the claim.
     */
    buildLayers() {

        const breath = new Breath();
        const bodyIdle = new BodyIdle();
        const handIdle = new HandIdle();
        const sway = new Sway( { onWeightShift: ( shift ) => bodyIdle.onWeightShift( shift ) } );
        const idle = new IdleMotion( { armsEnabled: 'auto' } );
        const gaze = new Gaze( { partnerYawDegrees: CAMERA_AZIMUTH_DEGREES } );
        const blink = new Blink();
        const facialIdle = new FacialIdle();
        const pupil = new Pupil();

        this.layers = {
            breath, sway, idle, bodyIdle, handIdle, gazeHead: gaze.head, gaze, blink, facialIdle, pupil
        };

    }

    /**
     * Trap (b)'s red proof, run in-process at build.
     *
     * `HandIdle.claimFingers()` gives up silently on any of three conditions — no stack, a null
     * `claimFingersFrom`, or a named layer that is absent or carries no `fingersEnabled` flag
     * (`HandIdle.js:412-418`). Two of those are legitimate (an explicit `null` disables the claim),
     * and one is a wiring bug whose only symptom is that the fingers move twice as far as they
     * should. This separates them.
     */
    assertFingerClaimCanResolve() {

        const handIdle = this.layers.handIdle;

        if ( handIdle.claimFingersFrom === null ) return;   // the claim was deliberately disabled

        const owner = this.stack.findLayer( handIdle.claimFingersFrom );

        if ( owner === null || typeof owner.fingersEnabled !== 'boolean' ) {

            throw new Error(
                `Avatar: HandIdle claims the finger channel from a layer named ` +
                `'${ handIdle.claimFingersFrom }', and this stack has no such layer carrying a ` +
                '`fingersEnabled` flag. Both layers would then write the fingers and their ' +
                'contributions would SUM, silently. Add BodyIdle under that name, or construct ' +
                'HandIdle with `claimFingersFrom: null` to disable the claim on purpose.' );

        }

    }

    /**
     * Phase 5, wired so trap (c) cannot happen.
     *
     * 🚩 TRAP (c) — THE AFFECT CLOCK HAS EXACTLY ONE OWNER, AND IT IS `ExpressionLayer`.
     * `ExpressionLayer` is constructed with its default `advanceState: true`, which means IT calls
     * `AffectState.update( dt )` once per frame off the same delta the rig is on. Nothing in this
     * file ever calls `this.affectState.update()` — searching for that string is the check — because
     * two clocks over one state advance the attack and decay at double rate, and that failure looks
     * exactly like a tuning problem rather than like a bug. `PostureLayer.update()` never
     * advances it — `grep -n 'state.update' packages/core/src/affect/PostureLayer.js` returns
     * nothing, which is the check, and it is a grep rather than a line number on purpose. This
     * paragraph used to say "takes no arguments and never advances it (`PostureLayer.js:184-188`)",
     * and punch-list 6.9 falsified BOTH halves of that citation without touching this file: the
     * signature is now `update( deltaSeconds, context )`, and :184-188 is prose about head-channel
     * composition. The safety property held throughout; only the evidence trail rotted. A claim
     * pinned to a line number ages every time somebody edits above it, so pin it to a search.
     *
     * The body half is built through `expression.postureLayer()` rather than constructed alongside,
     * because that constructor hands the new layer THIS layer's own state and map — a `PostureLayer`
     * built by hand with neither is silent: it holds a fresh neutral `AffectState` that never moves,
     * which looks exactly like the defect the pair exists to close (`ExpressionLayer.js:104-118`).
     */
    attachAffect() {

        if ( this.affectEnabled === false ) return;

        this.affectState = new AffectState();
        this.expression = new ExpressionLayer( { state: this.affectState } );
        this.posture = this.expression.postureLayer();

        this.stack.add( this.expression );
        this.stack.add( this.posture );

        // 🎯 HOW A BEAT LEARNS THAT THE BODY IS ANGRY. `GestureLayer` scales itself down when the
        // posture has drawn the arms IN, and it reads that off the shared bag rather than off a
        // direct reference, because the alternative is a layer holding a pointer to another layer
        // and going stale on every rebuild. `MotionStack`'s `shared` exists for exactly this and
        // its docstring names affect as the case. Published here, beside the layer it belongs to,
        // so a stack built without affect simply has no `posture` key and gesture reads "no claim".
        this.stack.context.shared.posture = this.posture;

        // And the state itself, which `GestureLayer` reads EVERY FRAME for dominance rather than
        // snapshotting it. `AffectState.push()` sets a target that `pad` integrates toward, so a
        // value read at `say()` time is the PREVIOUS utterance's emotion — measured live on
        // 2026-08-17 as `feel({ dominance: +0.9 })` reading back −0.892. `Gesture.js`'s
        // `effectiveSpatialExtent` carries the full finding.
        this.stack.context.shared.affect = this.affectState;

        // Tier 1. Valence from the text, arousal from the acoustics — `ReflexAffect`'s two halves
        // never touch, and `say()` is its only caller here.
        this.reflex = new ReflexAffect();

    }

    /**
     * Phase 4's mouth, on the avatar's own clock.
     *
     * Added unconditionally, and cheaply: a `VisemeLayer` with no utterance loaded returns null from
     * `update()` every frame, so it contributes nothing and stays out of the conflict report
     * entirely. Building it lazily on the first `say()` would mean the first utterance arrives on a
     * stack whose channel set has just changed, which is a rebuild in the middle of a frame for no
     * gain.
     *
     * The mouth belongs to lipsync and the face belongs to affect, enforced by declaration rather
     * than by policy: `VisemeLayer` declares the fifteen OVR shapes and nothing else, and
     * `ExpressionLayer` declares brow/eye/cheek/nose plus four mouth CORNER shapes and nothing else.
     * They sum, and the sum is the additive AU12/AU15 corner offset over the viseme that research §1
     * calls the single rule which eliminates most emotion-by-speech mush.
     */
    attachSpeech() {

        this.viseme = new VisemeLayer( { clock: () => this.clockSeconds } );
        this.stack.add( this.viseme );

        // 🎯 AND THE ARMS, WHICH DO NOT WAIT FOR A TTS ENGINE THE WAY THE MOUTH HAS TO.
        //
        // This looks like an inconsistency with the paragraph above — the mouth refuses to move
        // without real timing, the arms move on generated timing — so here is the measurement that
        // separates them, because without it this is just a double standard.
        //
        // A viseme timeline runs at roughly ten events a second and lipsync error is judged against
        // the phoneme it lands on, so a synthetic one is visibly wrong: research §3's AV-sync
        // asymmetry is measured in tens of milliseconds. A gesture schedule runs at 9 to 26 events
        // a MINUTE, and research §5 puts the perceptual tolerance on gesture-speech asynchrony at
        // ±600 ms, with recall declining only past 400 ms of stroke delay. Uniform 150 wpm word
        // spacing sits inside that tolerance for a beat and nowhere near it for a viseme. So the
        // arms get a generated plan and the mouth does not, and the reason is a two-order-of-
        // magnitude difference in the tolerance rather than a preference.
        //
        // ⚠️ The plan is still flagged `synthetic: true` and `report().speech.gesture.schedule
        // .syntheticTiming` republishes it. Punch-list 4.3 replaces it with real word onsets and
        // stress marks, and `say({ speechPlan })` already takes them.
        this.gesture = new GestureLayer();
        this.stack.add( this.gesture );

    }

    // --- the verbs ------------------------------------------------------------------------

    /**
     * Push an emotion.
     *
     *     avatar.feel( 'joy', 0.8 );
     *     avatar.feel( { pleasure: 0.4, arousal: 0.2, dominance: 0.1 } );
     *
     * A LABEL is resolved against `ExpressionMap`'s `ANCHOR_SETS` — WASABI's eight drift states plus
     * ALMA's twenty-four OCC appraisals — and it does two things, because one is not enough. It
     * `trigger()`s the emotion, which supplies a base intensity that drift alone cannot reach; and
     * it pushes the emotion's own PAD anchor into the state, because a trigger is still geometrically
     * gated. `trigger('joy')` while the PAD point sits in the depressive corner correctly produces
     * NOTHING (`ExpressionMap.js:374-386`), so a label that did not also move the point would be a
     * verb that usually did nothing.
     *
     * `intensity` is carried on BOTH halves and means the same thing on each: it is the trigger's
     * base intensity, and it is the push's `confidence`, which is the weight the new target is
     * blended in at (`AffectState.push`). A weak feel therefore moves the point a short way and
     * fires a weak emotion, rather than snapping the face and then fading.
     *
     * A PAD VECTOR goes straight into the state. At least one axis has to be a finite number: an
     * object with none — `{ valence: 1 }`, say — would otherwise be an entirely silent no-op, which
     * is the shape of every affect bug this project has logged.
     *
     * ⚠️ The API contract states that a label "must be a `WASABI_ANCHORS` key" and gives `'joy'` as
     * its example. `joy` is an ALMA OCC emotion, not one of WASABI's eight, so the two halves of that
     * sentence disagree. Resolved in favour of the example and of the wider set: `ANCHOR_SETS` is
     * what `ExpressionMap.trigger` itself validates against, and refusing `'joy'` would refuse the
     * contract's own sample call.
     *
     * @param {string|Object} emotion - A label, or `{ pleasure, arousal, dominance }` on [-1, 1].
     * @param {number} [intensity] - Labels only. Omitted, `ExpressionMap`'s own default applies.
     * @returns {Avatar} this, so calls chain.
     */
    feel( emotion, intensity ) {

        this.requireLive( 'feel' );

        if ( this.affectState === null ) {

            throw new Error( 'Avatar.feel: this avatar was created with `affect: false`, so it has ' +
                'no affect state to push into. Create it with `affect: true`.' );

        }

        if ( typeof emotion === 'string' ) {

            const key = emotion.toLowerCase();
            const anchors = ANCHOR_SETS[ key ];

            if ( anchors === undefined ) {

                throw new Error( `Avatar.feel: '${ emotion }' is not an emotion. ` +
                    `Known: ${ Object.keys( ANCHOR_SETS ).join( ', ' ) }.` );

            }

            // An emotion may own several anchor points — WASABI gives happiness four, because
            // "Ekman has one positive emotion, so it must cover all of +P". Moving toward the
            // NEAREST of them is the shortest honest move: it is the same distance metric
            // `ExpressionMap.activate` selects on, so the push and the trigger agree about which
            // corner of PAD space this emotion means from where the avatar currently stands.
            const anchor = nearestAnchorTo( this.affectState.pad, anchors.points );

            this.affectState.push( {
                pleasure: anchor[ 0 ],
                arousal: anchor[ 1 ],
                dominance: anchor[ 2 ],
                confidence: intensity ?? 1
            } );

            // Undefined is forwarded deliberately, so `ExpressionMap.trigger`'s own default — 0.75,
            // WASABI's base for its non-special emotions — stays the one place that number lives.
            this.expression.trigger( key, intensity );

            return this;

        }

        if ( emotion === null || typeof emotion !== 'object' ) {

            throw new TypeError( 'Avatar.feel: pass an emotion name, or ' +
                '{ pleasure, arousal, dominance } with each axis on [-1, 1].' );

        }

        const named = [ 'pleasure', 'arousal', 'dominance' ]
            .filter( ( axis ) => Number.isFinite( emotion[ axis ] ) );

        if ( named.length === 0 ) {

            throw new TypeError( 'Avatar.feel: that object names no PAD axis. At least one of ' +
                `pleasure, arousal or dominance must be a finite number; got [ ${ Object.keys( emotion ).join( ', ' ) } ].` );

        }

        this.affectState.push( emotion );

        return this;

    }

    /**
     * R6 — text drives the mouth, the face and the body.
     *
     * The face and body half is complete and needs nothing from the caller: `ReflexAffect` is tier
     * 1 of the affect stack, and `estimate({ text })` returns valence and a dominance stopgap with
     * their own per-axis confidences, in the exact shape `AffectState.push` consumes. Arousal is
     * deliberately absent from a text-only estimate — research §2, in one line: *"valence lives in
     * the text, arousal lives in the acoustics"* — so pass `prosody` readings when you have them
     * and the arousal axis fills in. `PostureLayer` reads the same state, so the body emotes from
     * the same sentence the face does, with no second call.
     *
     * 🚩 THE MOUTH HALF NEEDS A TIMELINE AND THIS FILE WILL NOT INVENT ONE. A viseme timeline is
     * `{ viseme, startTime, duration }[]` and it comes out of a TTS engine; punch-list **4.3**
     * (`voice/Speech.js`) is the item that produces one and it is the one Phase 4 item still open.
     * Deriving a timeline from letters would mean typing a speaking rate into this file, and
     * `docs/research/` carries no speaking-rate or phoneme-duration figure at all — PUNCHLIST 4.2
     * says so explicitly and says one has to be MEASURED before any such claim can be made. So:
     * with a timeline, the mouth moves and the promise resolves when the utterance ends; without
     * one, the face and body still emote, the promise resolves on the next frame, and `report()`
     * records `speech.timelineSupplied: false` so nobody reads a silent mouth as a broken layer.
     *
     * @param {string} text - What is being said. Drives affect whether or not a timeline came with it.
     * @param {Object} [options]
     * @param {Array<{viseme, startTime, duration}>} [options.timeline] - From a TTS engine.
     * @param {number} [options.at] - Instant on this avatar's simulation clock at which
     *   `startTime === 0` will be HEARD. Defaults to now. Pass the value the audio graph will
     *   actually start at, not "now", or the mouth is early by the lead and late by the scheduling
     *   delay at the same time.
     * @param {Array<Object>} [options.prosody] - `voice/Prosody.js` readings, for the arousal axis.
     * @param {Object} [options.speechPlan] - Word onsets and stress marks for the gesture
     *   scheduler; see `motion/Gesture.js`. Absent, one is GENERATED from the text at 150 wpm and
     *   flagged `synthetic`. Unlike the viseme timeline, a generated plan is inside the measured
     *   perceptual tolerance for a beat — `attachSpeech()` carries the numbers.
     * @returns {Promise<Object>} resolves when the utterance finishes, with what it did.
     */
    async say( text, options = {} ) {

        this.requireLive( 'say' );

        if ( typeof text !== 'string' ) {

            throw new TypeError( `Avatar.say: text must be a string, got ${ typeof text }.` );

        }

        // Tier 1 fires immediately and on the caller's thread. research/lm-studio-integration.md
        // finding 4: a schema-constrained affect call to a local 35B costs 0.6–0.95 s, which is
        // "fine per-utterance and impossible per-frame" — so tier 1 drives the face the instant the
        // words exist, and a tier 2 vector blends in later through `feel()` if the host has one.
        const estimate = this.reflex === null
            ? null
            : this.reflex.estimate( { text, prosody: options.prosody } );

        if ( estimate !== null ) this.affectState.push( estimate );

        // A second utterance while one is in flight supersedes it. The previous promise is settled
        // rather than dropped, because a caller awaiting it would otherwise wait forever.
        this.settleUtterance( 'superseded' );

        // 🎯 THE ARMS START HERE, ABOVE THE TIMELINE CHECK, AND THE PLACEMENT IS THE POINT.
        //
        // Everything below this line is conditional on a TTS timeline the host may not have. If
        // gesture were scheduled down there with the mouth, `say()` without a timeline would return
        // a figure that had silently done nothing but change expression — which is precisely the
        // "emotes from the eyebrows up" failure the whole body half of this project exists to
        // refuse. See `attachSpeech()` for why generated word timing is defensible for a beat and
        // is not defensible for a viseme.
        //
        // The rate rides on arousal rather than on a constant; `rateForArousal` maps the measured
        // 9-to-26/min band and research §5 reads the spread as register rather than personality.
        //
        // 🎯 AND THE AMPLITUDE RIDES ON DOMINANCE, WHICH IS A CONTRACT THIS FILE INHERITED RATHER
        // THAN A CHOICE MADE HERE. `AffectState.faceInput()` carries the finding it is built on —
        // Arellano et al. (AMDO 2014), n=109, "dominance not at all" from a static face — and
        // states the consequence as structural: *"dominance must be carried by posture, gaze
        // policy, interruption behaviour and GESTURE AMPLITUDE, never by the face."* `bodyInput()`
        // then says in one line who is supposed to consume it: *"All three axes, for posture, gaze
        // policy and gesture amplitude. Phase 6 consumes this."* This is Phase 6 consuming it.
        //
        // So dominance reaches the body twice, through two different mechanisms, and that is the
        // design rather than a duplication: `PostureLayer` puts it in the TRUNK as a static lean
        // (anger +17.99° forward, fear −3.53° back), and gesture puts it in the SIZE of every
        // movement. A still frame carries the first; a moving figure carries both.
        // ⚠️ THE TARGET, NOT `pad`, AND THE DIFFERENCE IS A MEASURED BUG RATHER THAN A NICETY.
        // `push()` above set a target that `pad` integrates toward over subsequent frames, so `pad`
        // at this instant still holds the PREVIOUS utterance's emotion. A schedule has to fix its
        // refractory once, when it is built, so it reads the target — which is immediate and is
        // what this speaker is becoming. Gesture AMPLITUDE has no such constraint and is read live
        // by the layer every frame; `Gesture.js`'s `effectiveSpatialExtent` carries that half.
        this.gesture?.speak(
            options.speechPlan ?? syntheticSpeechPlan( text ),
            { arousal: this.affectState?.target?.arousal ?? 0 }
        );

        const timeline = options.timeline ?? null;

        if ( timeline === null ) {

            return {
                text,
                affect: estimate,
                timelineSupplied: false,
                durationSeconds: 0
            };

        }

        const startsAt = options.at ?? this.clockSeconds;

        // Handed over raw. `VisemeSchedule.speak` normalises — canonical OVR names, diphthongs
        // expanded, repeats merged, peaks resolved — and normalising here first would run that pass
        // twice on one utterance for no gain. The duration is read back off the schedule afterwards
        // so it is the NORMALISED span, which is what a caller awaiting the end actually waits for:
        // an expanded diphthong or a dropped zero-duration entry changes it.
        this.viseme.speak( timeline, { at: startsAt } );

        const durationSeconds = this.viseme.schedule.durationSeconds;

        return new Promise( ( resolve ) => {

            this.utterance = {
                text,
                affect: estimate,
                timelineSupplied: true,
                durationSeconds,
                startsAt,
                endsAt: startsAt + durationSeconds,
                resolve
            };

        } );

    }

    /**
     * One simulation frame plus one render, for a caller that owns the clock.
     *
     * Only meaningful under `autoStart: false`; under `autoStart: true` the stage's own loop is
     * already calling the same body, and calling this as well would advance the simulation twice per
     * displayed frame. That is refused rather than allowed, because the symptom — everything running
     * at double rate — is the same symptom trap (c) produces and a consumer would have two suspects.
     *
     * @param {number} deltaSeconds - Fixed step, e.g. 1/60. Clamped by `MotionStack`.
     */
    update( deltaSeconds ) {

        this.requireLive( 'update' );

        if ( this.autoStart === true ) {

            throw new Error( 'Avatar.update: this avatar was created with `autoStart: true`, so it ' +
                'is already driving its own frame loop. Calling update() as well would advance the ' +
                'simulation twice per frame. Create it with `autoStart: false` to own the clock.' );

        }

        this.advanceFrame( deltaSeconds );

        // 🚩 `stage.draw()`, NOT `stage.renderer.render()`. On the deferred path the pipeline is what
        // binds the MRT and runs the composite, so calling the renderer directly renders the scene
        // and throws the grade and the temporal resolve away. It fails SILENTLY: measured on
        // `alive.js` before that line changed, `?grade=1` produced a plate byte-identical to no grade
        // across all seven gates, and `?aa=traa` was indistinguishable from no AA at all.
        this.stage.draw();

    }

    /**
     * One frame, and the promise resolves only once the pixels are actually on the screen.
     *
     * 🚩 THIS EXISTS BECAUSE `update()` CANNOT BE USED BY A CAPTURE HARNESS AND THE FAILURE LOOKS
     * LIKE A BROKEN RENDER.
     *
     * `draw()` SUBMITS work. It does not wait for the GPU, and it does not wait for the compositor.
     * A screenshot taken straight after `update()` returns is a separate process asking the
     * compositor for the canvas, and it sometimes wins that race and gets the PREVIOUS frame — or,
     * on the first frame, no frame at all. Measured while verifying this API: a screenshot taken
     * immediately after `update()` came back BLACK while `renderer.info.render` reported
     * `drawCalls 43, triangles 86,751` for that very step. The draw had happened. The paint had not.
     * I diagnosed that as a render failure before measuring it, which is exactly the trap.
     *
     * ⚠️ AND THE MIS-CAPTURE IS USUALLY INVISIBLE RATHER THAN BLACK. `alive.js:1305-1314` closes the
     * same race in `__SUGATA_STEP__` and its comment records why it had to be closed in code: on
     * millimetre-scale idle motion a one-frame slip is "a fraction of a percent of pixels along lash
     * and lid edges". A capture harness would produce plates that are wrong in a way no reviewer
     * would ever spot by eye.
     *
     * Two barriers, in order, because each closes a different half:
     *   1. `onSubmittedWorkDone()` — the GPU has finished the frame. WebGL2 has no equivalent, so
     *      the fallback tier keeps the race and says so rather than pretending.
     *   2. `nextPaint()` — the compositor has painted it. GPU-done is not enough on its own.
     *
     * @param {number} deltaSeconds - fixed simulation step, e.g. 1/60.
     * @returns {Promise<void>} resolves when the caller may safely read the canvas back.
     */
    async step( deltaSeconds ) {

        this.update( deltaSeconds );

        await this.stage.renderer.backend?.device?.queue?.onSubmittedWorkDone();
        await nextPaint();

    }

    /**
     * Re-frames the camera and re-aims the rig between portrait and body.
     *
     * 🚩 WITHOUT THIS, `frame` WAS CREATE-TIME ONLY AND ONE OF THIS PROJECT'S OWN GATES WAS
     * UNREACHABLE THROUGH THE API. Punch-list 5.7 requires its critic plates at body framing, in as
     * many words: "a portrait crop cannot show a 14° trunk lean or a 334 mm hand span, and every
     * affect plate this project has captured so far was a portrait." An embedder who wanted both
     * had to dispose the avatar and rebuild it, which throws away the motion state that makes a
     * before/after pair comparable at all.
     *
     * ⚠️ THE RIG IS RE-AIMED, NOT RE-ATTACHED. `LightingRig.attachTo()` THROWS on a second call
     * (`LightingRig.js:1672`), and the presets are authored per framing rather than scaled from one
     * — the portrait rim azimuth measures one pixel of band on a full-body thigh. So this calls
     * `setPreset()` and re-aims; it never rebuilds the rig, and it never touches the motion stack,
     * so the simulation clock runs straight through the change.
     *
     * @param {'portrait'|'body'} mode
     * @param {number} [heightMetres] - override the framed height; omitted uses the preset's own.
     */
    setFraming( mode, heightMetres = undefined ) {

        this.requireLive( 'setFraming' );

        if ( FRAME_MODES.includes( mode ) === false ) {

            throw new TypeError(
                `Avatar.setFraming: mode must be one of ${ FRAME_MODES.join( ', ' ) }, got '${ mode }'.` );

        }

        this.frameMode = mode;
        if ( heightMetres !== undefined ) this.heightOverride = heightMetres;

        // 🚩 THE LOOK IS RE-RESOLVED AGAINST THE NEW FRAMING **BEFORE** `setPreset`, AND THE ORDER
        // IS THE WHOLE OF CLAUSE C5. `setPreset` re-runs `resolvePlacements()`, which re-merges
        // `this.overrides` OVER the new framing's authored table — so a look resolved once at create
        // is a set of ABSOLUTE numbers taken from the OTHER framing. Measured: `soft` resolved at
        // portrait leaves the body rim reading **11.2000** where the body preset authored
        // **15.4000**, 27.27% under, and nothing reports it. Assigned rather than pushed through
        // `override()` because `setPreset` is what re-resolves on this path.
        this.lights.overrides = this.lightOverridesFor( mode );

        // The rig's preset moves FIRST, because `aimRigAt` aims whatever preset is current and
        // aiming the portrait preset at a body focus is the "rim reads 1 px of band on a thigh"
        // failure `LightingRig` records against scaling one preset into the other.
        this.lights.setPreset( mode );

        this.framedHeightMetres = framedHeightFor( this.figure, mode, this.heightOverride );

        const { focus } = frameFigure( this.stage, this.figure, {
            mode,
            heightMetres: this.framedHeightMetres
        } );

        this.focus.copy( focus );

        aimRigAt( this.lights, this.eyes, focus, this.framedHeightMetres, this.stage );

        this.backdrop?.position.set( focus.x, focus.y, focus.z - BACKDROP_DISTANCE_METRES );
        this.ground?.sizeTo?.( { focus, subjectHeightMetres: this.framedHeightMetres } );

    }

    /**
     * Change the light without rebuilding the avatar.
     *
     *     avatar.setLighting( 'dramatic' );
     *     avatar.setLighting( { exposure: 1.2 } );
     *     avatar.setLighting( { lights: { rim: { irradiance: 20 } } } );
     *
     * A PARTIAL MERGE over whatever is current, so `{ exposure: 1.2 }` keeps the look and
     * `'dramatic'` keeps the exposure. Every field is re-validated at this boundary — see
     * `PLACEMENT_FIELDS` for the seven pathologies the rig accepts in silence.
     *
     * 🚩 **IT RE-AIMS, AND WITHOUT THAT LINE THE EYES LOOK AT A KEY THAT IS NO LONGER THERE.**
     * `LightingRig.override()` calls `solve()` and NEVER `aimAt()` (`LightingRig.js:1894-1905`), so
     * an override that moves the key's azimuth or elevation — which `soft` and `dramatic` both do —
     * moves the panel and leaves `eyes.keyLightDirectionUniform` (`EyeMaterial.js:625`) pointing
     * where the key used to be. The iris caustic is computed against that one direction.
     *
     * @param {string|Object} request - a `SCENE_LOOKS` name, or a partial lighting object.
     * @returns {Avatar} this, so calls chain.
     */
    setLighting( request ) {

        this.requireLive( 'setLighting' );

        this.lighting = resolveLightingOption( mergeLightingRequest( this.lighting, request ) );
        this.applyLighting();

        return this;

    }

    /**
     * Change the room without rebuilding the avatar.
     *
     *     avatar.setBackground( 'transparent' );
     *     avatar.setBackground( 0x101820 );
     *     avatar.setBackground( { ground: false } );
     *
     * ⚠️ **THE GROUND PLANE AND THE CARD ARE ONE-WAY AT RUNTIME: THIS CAN REMOVE THEM AND CANNOT
     * PUT THEM BACK.** Rebuilding either needs the figure's own measured occluder radii
     * (`GroundContact.fitTo`) and the current focus, which is a swap rather than a setter, and a
     * half-rebuilt contact shadow is exactly the state that produces a plate nobody can reproduce.
     * Asking for one back is refused in words rather than silently ignored. Pass it to `create()`.
     *
     * @param {string|number|Object} request - a `BACKGROUND_PRESETS` name, a hex, or a partial.
     * @returns {Avatar} this, so calls chain.
     */
    setBackground( request ) {

        this.requireLive( 'setBackground' );

        const wanted = resolveBackgroundOption( mergeBackgroundRequest( this.background, request ) );

        if ( wanted.backdrop !== false && this.backdrop === null ) {

            throw new Error( 'Avatar.setBackground: this avatar was built without a backdrop card, ' +
                'and one cannot be added live — it is positioned from the framing focus and its ' +
                'level is what gate G6 measures. Pass `background` to Avatar.create instead.' );

        }

        // The same correctness constraint `build()` enforces, at the other door. See `resolveTier`.
        if ( wanted.backdrop === false && this.tierSettings.occlusion === true ) {

            throw new Error(
                `Avatar.setBackground: removing the card cannot run on quality '${ this.tier }', ` +
                'which carries ground-truth occlusion — with nothing at background depth the ' +
                'occlusion pass renders the whole frame black. Set the card\'s level instead ' +
                '(background: { backdrop: 0x000000 }), or build the avatar on the balanced tier.' );

        }

        if ( wanted.ground === true && this.ground === null ) {

            throw new Error( 'Avatar.setBackground: this avatar was built without a ground plane, ' +
                'and one cannot be added live — `GroundContact.fitTo` measures its occluder radii ' +
                'off the loaded bake. Pass `background` to Avatar.create instead.' );

        }

        this.background = wanted;

        this.stage.scene.background = wanted.colour === null ? null : new Color( wanted.colour );

        if ( wanted.backdrop === false && this.backdrop !== null ) {

            this.backdrop.removeFromParent();
            this.backdrop.geometry.dispose();
            this.backdrop.material.dispose();
            this.backdrop = null;

        } else if ( this.backdrop !== null ) {

            this.backdrop.material.emissive.setHex( wanted.backdrop, SRGBColorSpace );

        }

        if ( wanted.ground === false && this.ground !== null ) {

            this.ground.dispose();
            this.ground = null;

        }

        return this;

    }

    /**
     * Pushes the current `this.lighting` onto the live rig, in the one order that leaves nothing
     * stale. Shared by `setLighting` and by nothing else; `build()` goes through the constructor.
     */
    applyLighting() {

        const overrides = this.lightOverridesFor( this.frameMode );

        // Set before the re-solve below, because `solve()` reads both.
        this.lights.exposure = EXPOSURE_CALIBRATION * this.lighting.exposure;
        this.lights.ambientFractionOfKey = shippedAmbientFractionOfKey() * this.lighting.ambient;

        const wantsShadows = this.lighting.shadows ?? this.tierSettings.shadows;
        const shadowsMoved = this.lights.shadowsEnabled !== wantsShadows;
        this.lights.shadowsEnabled = wantsShadows;

        // 🚩 REPLACED RATHER THAN ACCUMULATED. `override()` MERGES into whatever is already there,
        // so a previous look's key colour would survive a change to a look that does not name the
        // key — `dramatic` then `studio` would leave the key at 30° of elevation for ever.
        this.lights.overrides = {};

        // One call per light, EMPTY OBJECT INCLUDED, because `override()` is the only public entry
        // that re-runs `resolvePlacements()` — and a look that names nothing (`studio`) still has to
        // undo the one before it. Four spreads and four solves; the alternative is reaching into
        // `resolvePlacements()`, which is not public.
        for ( const name of RIG_LIGHT_NAMES ) this.lights.override( name, overrides[ name ] ?? {} );

        // 🚩 UNCONDITIONAL, AND MAKING IT CONDITIONAL IS WHY `setLighting` DID NOTHING AT ALL.
        //
        // The paragraph above assumed `override()` was enough because it re-runs
        // `resolvePlacements()`. It re-runs it, and the result never reaches the lights. Traced on
        // 2026-08-17: `override()` (`LightingRig.js:1981-1986`) replaces `this.placements` with a
        // FRESH ARRAY and calls `solve()`; `solve()` (`:2288`) iterates `this.units` and reads
        // `unit.placement` — the object bound into the unit back at `buildUnit` (`:2169`) — so it
        // faithfully re-solves the OLD placements. And `solve()` never assigns `area.color` on any
        // path, so a look that only changes a hue could not have worked even with fresh placements.
        //
        // Measured: `Avatar.create({})` then `setLighting('dramatic')` rendered a plate PIXEL-FOR-
        // PIXEL identical to plain studio (19.07% of pixels moved, mean 0.009176 — the same figures
        // two builds of the SAME configuration differ by), while `dramatic` passed at create time
        // differed at 52.85% / 0.024517. All four non-default looks were inert through the setter.
        //
        // `rebuild()` (`:2227`) disposes the units and rebuilds them from `this.placements`, which
        // IS the freshly resolved array, so it is the only call that carries both geometry and
        // colour through. It runs on every apply rather than on a guess about what moved: this is
        // called from `setLighting` and `setFraming`, never per frame, and a wrong guess here is
        // silent while an extra teardown of four lights is not.
        this.lights.rebuild();

        // See the 🚩 in `setLighting`. `override()` solves and never aims.
        aimRigAt( this.lights, this.eyes, this.focus, this.framedHeightMetres, this.stage );

        // 🚩 AND THE AMBIENT SNAPSHOT, WHICH IS THE HALF THAT WOULD HAVE GONE WRONG SILENTLY ON THE
        // DEFAULT TIER. On `high` the rig is built `ambient: false` and the hemisphere term is
        // handed to the composite as a CREATE-TIME SNAPSHOT — `describeAmbient()` at build,
        // `uniform( ambient.intensity )` at `GTAO.js:882`. Without the setter this call reaches,
        // `setLighting({ exposure })` would scale the four direct lights and leave the ambient
        // frozen at its build value, changing the very key:ambient balance the file is calibrated
        // on, invisibly. `setAmbientIntensity` was added to `createGroundTruthOcclusion`'s return
        // for this line; the `?.` is for the tiers that have no occlusion to tell.
        this.stage.ambientOcclusion?.setAmbientIntensity?.( this.lights.describeAmbient().intensity );

    }

    /**
     * The rig overrides this avatar's lighting resolves to at one framing: the look, then the
     * caller's own `lights` escape hatch merged over it, field by field.
     *
     * Separate from `applyLighting` because `setFraming` needs the ANSWER without the side effects —
     * it hands the table to `setPreset`, which re-resolves it itself.
     */
    lightOverridesFor( preset ) {

        const merged = resolveLook( this.lighting.look, preset );

        for ( const [ name, fields ] of Object.entries( this.lighting.lights ) ) {

            merged[ name ] = { ...( merged[ name ] ?? {} ), ...fields };

        }

        return merged;

    }

    /**
     * Swap the bake — R8's gender axis, live.
     *
     * 🚩 TRAP (a) IS THE WHOLE REASON THIS IS ASYNC AND NOT A SETTER. `createMotionTarget` SNAPSHOTS
     * the scene graph at call time: its morph-writer map and its bone map are built in a single
     * traverse (`MotionStack.js:754-777`) and there is no invalidate. A new bake is a new set of
     * `morphTargetInfluences` arrays and a new set of `Bone` objects, so a target built against the
     * old figure keeps writing into geometry that has been disposed — the figure freezes and nothing
     * reports it. `swapFigure()` therefore builds a NEW target and re-`bind()`s.
     *
     * 🚩 TRAP (e) IS WHY THE LAYERS ARE NOT TOUCHED. `MotionStack.remove( layer )` DISPOSES the layer
     * (`MotionStack.js:205`), so remove-then-re-add hands back a dead object. `bind()` re-runs every
     * layer's `onBind` against the new target and re-snapshots the rest pose, which is exactly the
     * rebuild that is wanted — and the layers keep their phase, so breath does not jump back to
     * end-expiration and the figure does not visibly restart when the dial moves.
     *
     * @param {Object} partial - Anything `Identity.set` takes; absent keys keep their value.
     * @returns {Promise<Avatar>} this.
     */
    async setIdentity( partial = {} ) {

        this.requireLive( 'setIdentity' );

        this.identity.set( partial );

        await this.swapFigure();

        return this;

    }

    /**
     * Everything a still frame cannot carry, as a plain object a HUD and a gate both read.
     *
     * The subsystem census is read off the SCENE rather than off the options that were supposed to
     * put things there. Reporting the options back would be a tautology: it would report a subsystem
     * that failed to attach as present, which is the exact defect `alive.js`'s own census was written
     * after (`alive.js:3216-3236`).
     */
    report() {

        return {
            quality: {
                requested: this.requestedQuality,
                tier: this.tier,

                // Read off the renderer, never off the request. `Renderer.init()` swaps in a WebGL2
                // backend when adapter acquisition throws, so a report that echoed the request back
                // would name a tier the frame is not being drawn on. The two no-stage answers are
                // kept apart on purpose: 'disposed' is a torn-down avatar, 'uninitialised' is one
                // whose `build()` has not reached `Stage.create` yet, and reporting a half-built
                // avatar as disposed would send a reader after the wrong thing.
                backend: this.stage !== null
                    ? this.stage.backendName
                    : ( this.disposed === true ? 'disposed' : 'uninitialised' ),

                // ⚠️ Auto-selection here is STRUCTURAL, never a timing. See `QUALITY_TIERS`.
                selectedBy: this.requestedQuality === 'auto' ? 'adapter-capability' : 'caller',
                temporalResolve: this.stage?.temporal == null ? 0 : 1,
                resolutionScale: this.stage?.resolutionScale ?? null,

                // True means the frame is being drawn on a backend this tier cannot run on, and it
                // is here rather than only in a console warning because a console line is not
                // something a gate can read. See `build`.
                backendMismatch: this.backendMismatch
            },

            subsystems: this.censusOfShading(),

            /**
             * The room and the light, READ OFF THE SCENE GRAPH rather than off the options that
             * were supposed to put them there — this object's own rule, written after a census that
             * reported a subsystem that failed to attach as present. `background` is the scene's
             * actual background object; `backdrop` and `ground` are whether the handles exist;
             * every lighting number comes off the live `LightingRig`.
             */
            scene: {
                background: this.stage?.scene?.background == null
                    ? null
                    : `#${ this.stage.scene.background.getHexString() }`,
                backdrop: this.backdrop === null
                    ? null
                    : `#${ this.backdrop.material.emissive.getHexString() }`,
                ground: this.ground !== null,

                lighting: this.lights === null ? null : {
                    look: this.lighting.look,
                    exposure: this.lights.exposure,
                    ambientFractionOfKey: this.lights.ambientFractionOfKey,

                    // 🚩 False the moment `exposure` or `ambient` moves off 1. Both are exposed and
                    // both invalidate every committed G1/G4/G5/G6 number, so a plate captured at
                    // anything but `true` is not comparable with the ones the critic has judged.
                    calibrated: this.lights.exposure === EXPOSURE_CALIBRATION
                        && this.lights.ambientFractionOfKey === shippedAmbientFractionOfKey(),

                    designedKeyToFill: this.lights.designedKeyToFill,
                    shadowsEnabled: this.lights.shadowsEnabled,
                    placements: this.lights.placements.map( ( placement ) => ( {
                        name: placement.name,
                        azimuthDegrees: placement.azimuthDegrees,
                        elevationDegrees: placement.elevationDegrees,
                        irradiance: placement.irradiance,
                        colour: `#${ new Color( placement.colour ).getHexString( SRGBColorSpace ) }`
                    } ) )
                }
            },

            /**
             * The groom. Null when none was asked for; an object with `attached: false` when one was
             * asked for and did not land, which is the case a boolean could not carry.
             *
             * 🚩 `undisposable` IS NOT DECORATION AND IS NOT A TODO. `dispose()`'s central claim is
             * "every handle this file acquires is released, and that is CHECKED rather than
             * asserted" — by `leakedHandles()`, an own-property walk. Two things hair does are
             * outside what such a walk can ever see, so they are published here instead: a solver
             * with no `dispose` (dropped by reference; five compute pipelines and ~957 kB), and a
             * process-wide patch of `NodeMaterial.prototype.setupPosition` with no uninstall. Both
             * are the reason `hair` defaults to false.
             */
            hair: this.hairStyle === null ? null : {
                style: this.hairStyle,
                attached: this.hairRoot !== null,
                meshes: this.hairRoot === null
                    ? 0
                    : this.hairRoot.children.filter( ( child ) => child.isMesh === true ).length,
                oit: this.hairArm,
                stageReportsOit: this.stage?.hairOITMode ?? null,
                solver: this.hairDynamics === null ? null : {
                    chains: this.hairDynamics.groom.chainCount,
                    particles: this.hairDynamics.groom.particleCount,
                    steps: this.hairDynamics.stepsTaken
                },
                // 🚩 Clause C4's readable half, and it is `hasHairVelocity( material )`'s own answer
                // rather than "we called the function": that helper reads the module's `WeakSet`,
                // which is what the prototype patch actually consults. Recorded at attach because
                // `HairVelocity.js` is a dynamic import and `report()` is synchronous.
                velocityRepaired: this.hairVelocityRepaired,

                // ⚠️ `high` fits with under a millisecond in hand — ~15.9 p95 against 16.6 — and
                // that is a warning rather than a refusal, because the number was measured on one
                // machine. `quality: 'auto'` resolves to `balanced` when hair is on for this reason,
                // and that is a STRUCTURAL fact ("hair is on") rather than a frame budget, so it
                // does not violate `QUALITY_TIERS`' "auto is never a timing" rule.
                frameBudgetWarning: this.tier === 'high'
                    // 🚩 p50, and it used to say p95. The measuring round retracted its own p95 in
                    // docs/API.md — "p95 does not resolve" — and this string quoted it anyway, to an
                    // embedder, as a runtime fact. A retracted measurement is not a smaller
                    // measurement.
                    ? 'hair adds a measured +2.0 ms at p50; p95 did not resolve, see docs/API.md'
                    : null,

                undisposable: Object.freeze( [
                    'HairDynamics: createHairDynamics returns no dispose() — 5 compute pipelines and ' +
                        '~957 kB of instancedArray storage per attach, dropped by reference',
                    'HairVelocity: installHairVelocity patches NodeMaterial.prototype.setupPosition ' +
                        'process-wide with no uninstall (HairVelocity.js:162-183)'
                ] )
            },

            motion: {
                seed: this.seed,
                frame: this.stack?.frame ?? null,
                timeSeconds: this.stack?.time ?? null,
                layers: this.stack === null ? [] : this.stack.layers.map( ( layer ) => layer.name ),
                clampingConflicts: this.stack === null
                    ? null
                    : this.stack.conflicts.filter( ( entry ) => entry.kind === 'morph' ).length,
                pupilScale: this.pupilScale,

                // 🚩 Trap (b), reported rather than assumed — and as THREE states rather than a
                // boolean, because `HandIdle` resolves ownership on its FIRST FRAME and not at bind
                // (`HandIdle.js:281`, `:316`). Before any frame has run, `bodyIdle.fingersEnabled`
                // is still true and reading that alone as "the claim failed" would report a
                // correctly wired avatar as broken for exactly one frame. `resolved` says whether
                // the claim has been attempted; `yieldedTo` names the layer that actually handed
                // the channel over, and null there AFTER `resolved` is the real defect — both
                // layers writing the fingers and their contributions summing.
                fingerClaim: this.layers.handIdle === undefined ? null : {
                    claimsFrom: this.layers.handIdle.claimFingersFrom,
                    resolved: this.layers.handIdle.fingerOwnershipResolved,
                    yieldedTo: this.layers.handIdle.yieldedLayer?.name ?? null
                }
            },

            affect: this.affectState === null ? null : {
                pad: { ...this.affectState.pad },
                moodOctant: this.affectState.moodOctant,
                activations: this.expression.activations.map( ( entry ) => ( {
                    emotion: entry.emotion,
                    weight: entry.weight,
                    saturated: entry.saturated
                } ) ),
                postureDegrees: this.posture === null ? null : { ...this.posture.appliedDegrees },

                // 🚩 Trap (c) made checkable from outside. There is exactly one owner of the affect
                // clock and this names it; a second owner would show up as a doubled rate that
                // nothing else in this object could distinguish from a tuning change.
                clockOwner: 'expression'
            },

            speech: {
                speaking: this.viseme?.speaking ?? false,
                timelineSupplied: this.utterance === null ? null : this.utterance.timelineSupplied,
                utteranceEndsAt: this.utterance?.endsAt ?? null,
                clockSeconds: this.clockSeconds,

                // 🚩 Reported beside `timelineSupplied` on purpose. The two answer the same question
                // for two different body parts and they routinely disagree: the mouth needs a TTS
                // timeline and stays shut without one, the arms run on generated word timing and
                // say so. `schedule.syntheticTiming` is the flag that rides on the data.
                gesture: this.gesture?.report() ?? null
            },

            identity: {
                gender: this.identity.gender,
                bake: this.figure === null ? null : this.currentBakeName
            },

            framing: {
                mode: this.frameMode,
                heightMetres: this.framedHeightMetres,
                fps: this.stage?.fps ?? null,
                frameMs: this.stage?.frameMs ?? null,
                drawCalls: this.stage?.drawCalls ?? null,
                triangles: this.stage?.triangles ?? null
            },

            // Deny-by-default, and it is what makes the disposal claim checkable rather than
            // argued. See `leakedHandles`.
            disposal: {
                disposed: this.disposed,
                leaked: this.leakedHandles()
            }
        };

    }

    /**
     * Releases the GPU, the DOM and the layers. Safe to call twice.
     *
     * WHAT WAS VERIFIED, AND HOW
     * --------------------------
     * The claim an embedder needs is "create and destroy a hundred avatars and nothing accumulates",
     * and it is made out of three parts, of which this file can honestly stand behind two.
     *
     *   1. **Every handle this file acquires is released here, and that is checked rather than
     *      asserted.** `leakedHandles()` walks this instance's OWN properties after teardown and
     *      reports anything still holding a `dispose` function — a deny-by-default walk rather than
     *      a hand-written list, because a hand-written list is exactly the thing that goes stale
     *      when someone adds a handle. `report().disposal.leaked` is therefore the gate clause, and
     *      its red proof is one line: comment out any single release below and the array stops
     *      being empty.
     *   2. **The rAF chain really stops.** Read at source rather than assumed:
     *      `Stage.dispose()` calls `renderer.dispose()`, which calls `_animation.dispose()` →
     *      `Animation.stop()` → `cancelAnimationFrame` (`three/src/renderers/common/Animation.js`
     *      :148-160, `Renderer.js:2540`). ⚠️ `setAnimationLoop( null )` alone does NOT do this — it
     *      only clears the user callback — which is why `autoStart: false` uses it and teardown does
     *      not.
     *   3. **DOM listeners.** This file adds NONE. That is deliberate and it is the reason the
     *      claim is cheap: `Stage` owns the only two — a `ResizeObserver` on the canvas and a
     *      `matchMedia` change listener for `devicePixelRatio` — and `Stage.dispose()` disconnects
     *      the observer. ⚠️ **One real leak found in `Stage` and NOT fixed here, because that file
     *      is not mine:** `watchPixelRatio()` adds its listener with `{ once: true }` and
     *      `unwatchViewport()` sets `pixelRatioWatcher = null` without ever calling
     *      `removeEventListener`, so a disposed Stage leaves one closure alive on a MediaQueryList
     *      until the user drags the window to a display of different density. It is harmless when it
     *      fires — the callback returns early on `renderer === null` — but a hundred create/destroy
     *      cycles leave a hundred of them. Filed as a request against `render/Stage.js`.
     *
     * What is NOT verified here is the browser-side measurement: a hundred cycles with the heap and
     * the GPU allocator watched. That needs a page, and it belongs to `Avatar.selftest.mjs` and to a
     * browsercheck, neither of which is this file.
     */
    dispose() {

        if ( this.disposed === true ) return;

        this.disposed = true;

        // First, so nothing draws into a half-torn-down scene on the frame that is already queued.
        this.unsubscribeFrame?.();
        this.unsubscribeFrame = null;

        // Settled rather than dropped: a caller awaiting `say()` would otherwise wait forever.
        this.settleUtterance( 'disposed' );

        // `MotionStack.dispose()` disposes every layer and clears the channel maps. The layers are
        // NOT removed one by one first — `remove()` disposes as it goes (trap (e)) and doing both
        // would call `dispose()` twice on each layer.
        this.stack?.dispose();
        this.stack = null;
        this.layers = {};

        this.disposeShading();

        // Before the figure, for `swapFigure`'s reason: the groom is parented under `figure.root`
        // and `Figure.dispose()` is a traverse, so leaving it there would dispose geometry this file
        // owns and call `dispose()` on the hair material twice.
        this.disposeHair();

        if ( this.figure !== null ) {

            this.stage?.scene.remove( this.figure.root );
            this.figure.dispose();
            this.figure = null;

        }

        this.skeleton = null;
        this.target = null;
        this.restPose = null;

        if ( this.backdrop !== null ) {

            this.backdrop.removeFromParent();
            this.backdrop.geometry.dispose();
            this.backdrop.material.dispose();
            this.backdrop = null;

        }

        this.ground?.dispose();
        this.ground = null;

        this.lights?.dispose();
        this.lights = null;

        // Before the stage: `Stage.dispose()` sets `this.grade = null` WITHOUT disposing
        // it (`Stage.js:623`), so releasing after would drop the only reference first.
        this.grade?.dispose();
        this.grade = null;

        // Last, and it takes the renderer, the pipeline, the temporal resolve, the ambient
        // occlusion and the rAF chain with it.
        this.stage?.dispose();
        this.stage = null;

        this.expression = null;
        this.posture = null;
        this.affectState = null;
        this.reflex = null;
        this.viseme = null;
        this.gesture = null;

        const leaked = this.leakedHandles();

        if ( leaked.length > 0 ) {

            console.warn( `Avatar.dispose: ${ leaked.length } handle(s) still hold a disposable ` +
                `after teardown — ${ leaked.join( ', ' ) }. Every one of them is a leak per ` +
                'create/destroy cycle.' );

        }

    }

    // --- the frame ------------------------------------------------------------------------

    /**
     * One simulated frame, in the order the construction contract states — and it is the ONLY
     * per-frame path. The stage's callback and `update( dt )` both come through here, so a
     * caller-driven run and an rAF-driven run cannot drift into being different simulations.
     *
     * The order matters twice over:
     *
     *   - `eyes.update()` rebuilds the eye frame from the head bone's WORLD matrix and from this
     *     frame's `eyeLook*` morph weights, so it has to run after the stack has committed both AND
     *     after the world matrices are current. The renderer would bring them up to date itself, but
     *     only during `render()`, which is one frame too late: read there, the eye looks where the
     *     head was last frame.
     *   - `ground.update()` follows the feet. It is here rather than in a `stage.onFrame` callback
     *     of its own because there are two frame paths on this page's ancestor and they had already
     *     diverged once — the contact shadow silently stopped following the feet on exactly the
     *     plates a judge measures (`alive.js:1160-1173`).
     */
    advanceFrame( deltaSeconds ) {

        if ( this.figure === null ) return;   // a bake is being swapped in

        this.stack.update( deltaSeconds );

        this.figure.root.updateMatrixWorld( true );

        if ( this.eyes !== null ) this.eyes.update();

        this.ground?.update();

        // 🎯 ONE LINE, BECAUSE `Avatar` HAS THE PROPERTY `alive.js` HAD TO WORK FOR: ONE FRAME PATH.
        // The stage callback and `update( dt )` both come through `advanceFrame`, so the
        // `trackFigure` / `stage.onFrame` split that page needed — and that once let its contact
        // shadow stop following the feet on exactly the plates a judge measures — does not exist
        // here. Null on every avatar without a groom and on the `fallback` tier, which is rigid.
        this.hairUpdate?.( deltaSeconds );

        this.clockSeconds += deltaSeconds;

        this.settleUtteranceIfFinished();

    }

    /** Resolves a pending `say()` once its last viseme window has passed. */
    settleUtteranceIfFinished() {

        if ( this.utterance === null ) return;
        if ( this.clockSeconds < this.utterance.endsAt ) return;

        this.settleUtterance( 'finished' );

    }

    /**
     * Settles whatever `say()` is in flight, exactly once.
     *
     * Every exit from an utterance goes through here — finished, superseded by the next one, or
     * cut short by `dispose()` — because a promise that is dropped rather than settled is a caller
     * awaiting forever, and that failure is invisible in every instrument this class has.
     */
    settleUtterance( outcome ) {

        if ( this.utterance === null ) return;

        const utterance = this.utterance;
        this.utterance = null;

        // The arms are stopped alongside the mouth, and for the same reason: an utterance that was
        // superseded or disposed must not leave a schedule running against a clock nobody is
        // advancing toward an end nobody is waiting for. A `say()` that follows immediately calls
        // `gesture.speak()` right after this, which reloads the schedule from zero.
        if ( outcome !== 'finished' ) { this.viseme?.stop(); this.gesture?.stop(); }

        utterance.resolve( {
            text: utterance.text,
            affect: utterance.affect,
            timelineSupplied: utterance.timelineSupplied,
            durationSeconds: utterance.durationSeconds,
            outcome
        } );

    }

    // --- the bake -------------------------------------------------------------------------

    /**
     * Loads the bake the current identity resolves to, puts it in the scene in place of whatever was
     * there, and rebinds the motion stack to it.
     *
     * The order inside is load-bearing in several directions and is taken from `swapFigure` in
     * `alive.js:1830-1954`:
     *
     *   - The skin material is built BEFORE the old figure leaves the scene, because building it
     *     fetches this bake's own curvature and cavity maps and a fetch is another chance for a
     *     newer load to overtake this one. Doing it here means the page never shows a gap.
     *   - The REST POSE goes on before the stack binds, and that is the whole trick. `MotionStack`
     *     snapshots rest from whatever pose the bones are in at bind time and every layer composes
     *     its delta onto that snapshot. Pose first and the arms micro-move about a body standing at
     *     ease; pose after and they micro-move about a T-pose while the figure visibly snaps.
     *   - The framed height is measured AFTER posing, because the pose changes the figure's height
     *     by centimetres.
     *   - `ground.fitTo` re-runs on every swap rather than once at build: the occluder radii are
     *     MEASURED off the meshes that just landed, and a g100 thigh is not a g000 thigh.
     */
    async swapFigure() {

        const plan = await this.identity.resolve();
        const token = ++ this.loadToken;
        const figureUrl = resolveAgainstBase( plan.figures[ 0 ].url, this.assetBaseUrl, 'figures' );

        const figure = await Figure.load( figureUrl );

        // A fast sequence of swaps starts several loads; only the newest may land. Checked after
        // every await, and each check disposes what this attempt had already built.
        if ( token !== this.loadToken ) {

            figure.dispose();
            return;

        }

        const bakeName = bakeNameFrom( plan.figures[ 0 ].url );

        const skin = await createSkinMaterial( {
            albedoMap: figure.body.material.map ?? null,
            curvatureMapUrl: resolveAgainstBase( curvatureMapUrlFor( bakeName ), this.bakedMapBaseUrl, '' ),
            cavityMapUrl: resolveAgainstBase( cavityMapUrlFor( bakeName ), this.bakedMapBaseUrl, '' )
        } );

        if ( token !== this.loadToken ) {

            skin.dispose();
            figure.dispose();
            return;

        }

        this.disposeShading();

        // 🚩 THE GROOM COMES OFF BEFORE THE OLD FIGURE DOES, AND BOTH HALVES OF THAT ARE LOAD-BEARING.
        //
        // The SOLVER first, for `alive.js:2328-2330`'s reason: it holds a rest pose derived from the
        // OLD groom's vertex buffer, and a solver left running across a bake swap drives the new
        // groom from the old one's chains.
        //
        // ⚠️ AND THE MESHES, EXPLICITLY, BECAUSE `Figure.dispose()` WOULD OTHERWISE TAKE THEM AND
        // TAKE THE SHARED MATERIAL WITH THEM. `Figure.dispose()` (`Figure.js:309-330`) is a
        // `root.traverse` and the groom is parented UNDER `figure.root`, so it disposes geometry
        // this file owns and calls `dispose()` on a `HairNodeMaterial` that `disposeHair` is about
        // to dispose again. Removing first makes the ownership match the disposal.
        this.disposeHair();

        if ( this.figure !== null ) {

            this.stage.scene.remove( this.figure.root );
            this.figure.dispose();

        }

        this.stage.add( figure.root );
        figure.root.updateMatrixWorld( true );

        const skeleton = new Skeleton( figure.root );

        if ( this.restPose !== null ) {

            const absent = this.restPose.applyTo( skeleton );

            if ( absent.length > 0 ) {

                console.warn( `Avatar: rest pose '${ this.restPose.name }' — this figure has no ${ absent.join( ', ' ) }.` );

            }

            skeleton.update();
            figure.root.updateMatrixWorld( true );

        }

        this.figure = figure;
        this.skeleton = skeleton;
        this.currentBakeName = bakeName;

        // 🚩 TRAP (a). A NEW target, never a mutated one — `createMotionTarget` snapshots the graph
        // in a single traverse and has no invalidate (`MotionStack.js:754-777`).
        this.target = createMotionTarget( figure.root );

        this.applyShading( skin );

        // 🚩 TRAP (e)'s other half. `bind()` re-runs every layer's `onBind` and re-snapshots rest;
        // the layers are neither removed nor re-added, because `MotionStack.remove` disposes them.
        this.stack.bind( this.target );

        this.framedHeightMetres = framedHeightFor( figure, this.frameMode, this.heightOverride );

        const { focus } = frameFigure( this.stage, figure, {
            mode: this.frameMode,
            heightMetres: this.framedHeightMetres
        } );

        this.focus.copy( focus );

        aimRigAt( this.lights, this.eyes, focus, this.framedHeightMetres, this.stage );

        // The card is emissive, so distance costs it nothing; at 8 x 6 m it still fills a full-body
        // frame from 1.9 m behind the subject.
        this.backdrop?.position.set( focus.x, focus.y, focus.z - BACKDROP_DISTANCE_METRES );

        if ( this.ground !== null ) {

            const unfitted = this.ground.fitTo( figure.root );

            if ( unfitted.length > 0 ) {

                console.warn( `Avatar: ground contact — this figure has no ${ unfitted.join( ', ' ) }.` );

            }

            this.ground.sizeTo( { focus, subjectHeightMetres: this.framedHeightMetres } );

        }

        // 🎯 THE GROOM GOES LAST, AND ALL FOUR REASONS WERE READ OR MEASURED RATHER THAN PREFERRED.
        //
        //   1. **AFTER THE REST POSE.** `HairDynamics`' first `setHeadMatrix` captures the gravity
        //      rest frame PERMANENTLY (`HairDynamics.js:963-969`). Calling it at a T-pose head and
        //      then posing puts a permanent gravity offset into a groom that should be at
        //      equilibrium.
        //   2. **AFTER `stack.bind()` and `updateMatrixWorld( true )`.** `fitColliders` reads
        //      `headMatrix` off the POSED rig (`HairDynamics.js:1044-1047`), and the skull and
        //      shoulder radii are sized to the largest the rest pose does not already violate.
        //   3. **LAST, so a hair failure cannot take the body off the page.** `alive.js:2006`'s
        //      reason, unchanged: a groom that 404s should cost the page its hair, not its figure.
        //   4. **Inside `swapFigure`, not `build()`.** The groom is per bake — five files keyed on
        //      the same name the baked skin maps are keyed on.
        await this.attachHair( figure, bakeName, token );

    }

    /**
     * Puts the Phase 3 materials on the bake that has just landed.
     *
     * All three are per-bake and none is cheap to rebuild, which is why they are rebuilt on every
     * swap rather than constructed once: `EyeMaterial` fits the sclera sphere, the corneal axis, the
     * iris plane and the eight gaze rotations off the mesh in front of it, and the curvature and
     * cavity maps are different PNGs per figure. A material built against g050 and left on g100
     * would be describing a different eye.
     *
     * Shadow flags are set here, per mesh, because the rig's shadow half is the only thing that
     * wants them and a figure with `castShadow` false produces a perfectly configured shadow map of
     * nothing at all.
     */
    applyShading( skin ) {

        this.figure.root.traverse( ( object ) => {

            if ( object.isMesh !== true ) return;

            object.castShadow = true;
            object.receiveShadow = true;

        } );

        applySkinMaterial( this.figure, skin );
        this.skin = skin;

        this.cards = applyCardShading( this.figure, this.stage.multisampled );

        this.applyEyeShading();

    }

    /**
     * The eye's two subsystems — the shader and the occlusion sheet.
     *
     * ⚠️ THEY ARE SEPARATE ON PURPOSE AND THEIR CONTRIBUTIONS HAVE OPPOSITE SIGNS. Measured on one
     * page load at 900x1200, gate G2's luma ratio: shipped 0.9203, sheet off 0.9449, material off
     * 0.8815 — the material costs 0.0388 and the sheet hands 0.0246 back. `alive.js:3153-3185`
     * carries the full table and the round in which one switch over both made every number
     * attributed to it a sum of the two.
     *
     * A throw is not fatal: a figure built with the superseded single-shell eye proxy has no corneal
     * dome to refract through, and an avatar is more useful reporting that in the console and
     * rendering the GLB's own eye than it is refusing to exist.
     */
    applyEyeShading() {

        let eyes;

        try {

            eyes = new EyeMaterial( { figure: this.figure } );

        } catch ( error ) {

            console.warn( `Avatar: eye material not applied — ${ error.message }` );
            return;

        }

        this.eyes = eyes;
        eyes.attach();

        // The pupil sink is registered once, at build, and reads `this.eyes` — so a swap needs no
        // re-registration and leaves no dead writer behind. That is trap (d).
        eyes.pupilScaleUniform.value = this.pupilScale;

        this.eyeOcclusion = buildEyeOcclusion( { figure: this.figure, geometry: eyes.geometry } );

    }

    // --- the groom ------------------------------------------------------------------------

    /**
     * PUNCH-LIST 3.5 / 3.6 / 6.6 — the groom, on the runtime API rather than on a testbed page.
     *
     * ## 🚩 THE ONE ORDERING RULE THAT IS A CLIFF RATHER THAN A PREFERENCE
     *
     * `material.positionNode = dynamics.positionNode` must be set BEFORE the material reaches any
     * mesh, and `installHairVelocity( material )` must accompany it in the same function. Each half
     * has its own measured failure:
     *
     *   - **Assign `positionNode` and never run `update()`:** `cardVertexBuffer` is
     *     `instancedArray( cardVertexCount, 'vec3' )` — a ZERO-FILLED Float32Array — and
     *     `positionNode` routes every vertex at or above `cardVertexBase` to it. All **16,864 card
     *     vertices collapse to mesh-local (0,0,0)** while the two 326-vertex scalp caps keep their
     *     skinning: the hair vanishes off the head and a black shard appears at the figure origin,
     *     in the beauty pass, the G-buffer normal, the velocity buffer AND the shadow map.
     *   - **Omit `installHairVelocity`:** not a collapse — the picture is right and the RESOLVE is
     *     wrong. p90 **259.9 px/frame** of reported velocity against `TAAUNode.maxVelocityLength`
     *     **128**, on a geometrically static groom. That shipped for two rounds.
     *
     * ## 🎯 AND IT GOES ON THROUGH `applyHairMaterial`, WHICH HAD ZERO CALL SITES ANYWHERE
     *
     * Measured 2026-08-17: `applyHairMaterial` is called **0 times in `Avatar.js`, 0 in `alive.js`,
     * 0 in `hair.js`, 0 in `stage.js`.** `alive.js:2504` assigns `mesh.material = material` in a
     * loop instead — which skips the vertex collection and `installHairEnvelope`, which is why every
     * live plate came back `envelope.fitted false` and forced a SECOND path into existence
     * (`ensureHairEnvelope`, `HairMaterial.js:3908-3922`). This is failure #5 from the brief, live
     * and shipped: a module passing its own gates with no reachable caller. Clause C3 of the gate
     * asserts the assignment loop does not appear on this path.
     *
     * ⚠️ Note the ordering conflict the apply path creates and how it is resolved: `createHairMaterial`
     * needs `alphaMap` AT CONSTRUCTION while `applyHairMaterial` only collects it during assignment,
     * so the map is read off `skinned[0].material?.map` first, as `alive.js:2449` does.
     *
     * @param {Figure} figure - the bake that has just landed and been posed and bound.
     * @param {string} bakeName - `figure_g050`; the groom is keyed on it.
     * @param {number} token - `swapFigure`'s load token. This function awaits twice more.
     */
    async attachHair( figure, bakeName, token ) {

        if ( this.hairStyle === null ) return;

        // `setIdentity({ mode })` can reach a cross-fade after `create()` refused one. Refused in
        // words and skipped rather than thrown, because a throw here rejects `setIdentity` and
        // takes the whole swap with it — and the body half of the swap has already succeeded.
        if ( this.identity.mode === LIVE_PREVIEW ) {

            console.warn( `Avatar: hair is off while identity mode is '${ LIVE_PREVIEW }' — the groom ` +
                'is baked per figure and a cross-fade resolves to two bakes, so it would sit on a ' +
                'head it was not cut for.' );

            return;

        }

        const groomUrl = HAIR_BAKES.get( bakeName );

        if ( groomUrl === undefined ) {

            console.warn( `Avatar: hair '${ this.hairStyle }' is ignored on ${ bakeName } — the groom ` +
                `is baked per identity and only ${ [ ...HAIR_BAKES.keys() ].join( ', ' ) } have one. ` +
                'Run tools/figure-pipeline/build_figure.py --hair for this bake.' );

            return;

        }

        // Dynamic, and it is not a style choice: `material/HairMaterial.js` is four thousand lines
        // and `render/HairOIT.js`, `render/HairVelocity.js` and `motion/HairDynamics.js` are behind
        // it. An avatar with `hair: false` must not carry any of that in its module graph, and
        // `installHairVelocity` in particular patches `NodeMaterial.prototype` — a module that is
        // never imported cannot be a module that patches a prototype.
        const [ { GLTFLoader }, { createHairMaterial, applyHairMaterial }, { configureHairMaterial } ] =
            await Promise.all( [
                import( 'three/examples/jsm/loaders/GLTFLoader.js' ),
                import( './material/HairMaterial.js' ),
                import( './render/HairOIT.js' )
            ] );

        const groom = await new GLTFLoader().loadAsync(
            resolveAgainstBase( groomUrl, this.assetBaseUrl, `hair/${ this.hairStyle }` ) );

        // ⚠️ A THIRD `await` ON A 3,327,232 B FILE INSIDE `swapFigure`, SO THE TOKEN GUARD HAS TO
        // COVER IT. A fast gender-slider drag races this otherwise, and the loser would add its
        // groom to a figure the winner has already replaced. Every early exit from here on frees
        // what this attempt has already built — the same discipline `swapFigure`'s own guards keep.
        if ( token !== this.loadToken ) { disposeGroomScene( groom.scene ); return; }

        const skinned = [];
        groom.scene.traverse( ( object ) => { if ( object.isSkinnedMesh === true ) skinned.push( object ); } );

        if ( skinned.length === 0 ) {

            console.warn( `Avatar: ${ groomUrl } carries no SkinnedMesh — the groom did not export ` +
                'skinned. The figure has no hair on this bake.' );

            disposeGroomScene( groom.scene );
            return;

        }

        // The rebind, by NAME rather than by count, because the failure it guards against is a rig
        // rename in the figure pipeline and "3 bones missing" would send the next reader to the
        // wrong file. Measured across all five bakes: 53 joints, 0 absent — so this cannot fail on
        // the shipped asset set, and it is checked anyway for the day the pipeline moves.
        const figureBones = new Map();
        figure.root.traverse( ( object ) => { if ( object.isBone === true ) figureBones.set( object.name, object ); } );

        for ( const mesh of skinned ) {

            const absent = mesh.skeleton.bones
                .filter( ( bone ) => figureBones.has( bone.name ) === false )
                .map( ( bone ) => bone.name );

            if ( absent.length > 0 ) {

                console.warn( `Avatar: the groom is skinned to ${ absent.join( ', ' ) }, which this ` +
                    'figure\'s rig does not have. The groom and the figure are out of step; the ' +
                    'figure has no hair on this bake.' );

                disposeGroomScene( groom.scene );
                return;

            }

            const bones = mesh.skeleton.bones.map( ( bone ) => figureBones.get( bone.name ) );

            // ⚠️ THE GROOM'S OWN `boneInverses`, CARRIED BY REFERENCE. The new skeleton is the
            // FIGURE's bones with the GROOM's inverses, which is exactly what `HairDynamics` reads
            // back at the head index — the bone is the figure's and the inverse is the groom's.
            mesh.bind( new SkinSkeleton( bones, mesh.skeleton.boneInverses ), new Matrix4() );
            mesh.frustumCulled = false;

            // Hair shadowing the forehead is a large part of why hair reads as hair, and the key is
            // the only shadow caster on this rig. ⚠️ `alive.js:2388-2402` records that the cut-out
            // does NOT reach the depth pass on the arms that carry coverage in `colorNode` — that is
            // a `HairMaterial` repair and is not fixed here; `configureHairMaterial` installs
            // `maskShadowNode`, which is the half that does reach it.
            mesh.castShadow = true;
            mesh.receiveShadow = true;

        }

        // A Group of this file's own rather than reparenting straight onto `figure.root`, and it is
        // a disposal decision rather than a scene-graph one: the groom is not the figure's, so
        // `disposeHair` needs one handle to remove and `Figure.dispose`'s traverse needs the meshes
        // gone before it runs. Identity transform, so `mesh.matrixWorld` — which is the solver's
        // entire input — is what it would have been parented directly.
        const hairRoot = new Group();
        hairRoot.name = `hair.${ this.hairStyle }`;
        for ( const mesh of skinned ) hairRoot.add( mesh );
        figure.root.add( hairRoot );
        figure.root.updateMatrixWorld( true );

        // Rebased alongside the groom, not beside it: the two sidecar sheets live in the same
        // directory as the five GLBs, so `assetBaseUrl` has to move all seven together or a
        // self-hosted groom loads with a constant-1 shadow and no flow rotation — which is a
        // DIFFERENT PICTURE and not an error.
        const groomFolder = `hair/${ this.hairStyle }`;

        const material = await createHairMaterial( {
            flowMapUrl: resolveAgainstBase( HAIR_SHEET_URLS.flow, this.assetBaseUrl, groomFolder ),
            depthMapUrl: resolveAgainstBase( HAIR_SHEET_URLS.depth, this.assetBaseUrl, groomFolder ),

            // Read HERE, before `applyHairMaterial` would have collected it, because
            // `createHairMaterial` needs the cutout at construction. See the ⚠️ in the header.
            alphaMap: skinned[ 0 ].material?.map ?? null,
            multisampled: this.stage.multisampled
        } );

        // Everything this attempt built, released together, so a losing load leaves nothing behind.
        const abandon = () => {

            hairRoot.removeFromParent();
            disposeGroomScene( hairRoot );
            material.hair?.flowMap?.value?.dispose?.();
            material.hair?.depthMap?.value?.dispose?.();
            material.dispose();

        };

        if ( token !== this.loadToken ) { abandon(); return; }

        // `slab` is `wboit`'s own depth range and is null on every arm this file ships; the slab
        // closure `alive.js` installs is therefore not reproduced here, and saying so is cheaper
        // than a reader looking for it.
        configureHairMaterial( material, this.hairArm, {
            alphaToCoverage: this.stage.multisampled,
            slab: this.stage.hairOIT?.slab ?? null,
            defect: null
        } );

        // BEFORE the material reaches any mesh — see the cliff in this function's header. Nothing
        // has drawn with this material yet, so adding a `positionNode` costs no program rebuild.
        //
        // 🚩 IT RETURNS ITS HANDLES RATHER THAN WRITING THEM ONTO `this`, AND THAT IS THE RACE
        // GUARD RATHER THAN A STYLE. A losing load that assigned `this.hairDynamics` from inside
        // that call would clobber the WINNER's solver — which has already been installed by then,
        // because the winner's `swapFigure` ran its `disposeHair()` and its own attach first — and
        // the loser's own token check afterwards would then null the winner's. Nothing is written
        // to `this` until every await is behind us.
        const solver = HAIR_BY_TIER[ this.tier ].solver === true
            ? await this.buildHairDynamics( figure, skinned, material )
            : null;

        if ( token !== this.loadToken ) { abandon(); return; }

        // Captured before `applyHairMaterial` orphans them — see `hairSourceMaterials`.
        this.hairSourceMaterials = skinned
            .flatMap( ( mesh ) => ( Array.isArray( mesh.material ) ? mesh.material : [ mesh.material ] ) )
            .filter( ( entry ) => entry !== null && entry !== undefined );

        // 🎯 THE APPLY PATH, NOT THE ASSIGNMENT LOOP. See the header.
        const applied = applyHairMaterial( hairRoot, material );

        this.hairRoot = hairRoot;
        this.hairMaterial = material;
        this.hairDynamics = solver?.dynamics ?? null;
        this.hairUpdate = solver?.update ?? null;
        this.hairVelocityRepaired = solver?.velocityRepaired ?? null;

        console.log( `Avatar: hair '${ this.hairStyle }' on ${ bakeName } — ${ applied.meshes } mesh(es), ` +
            `arm ${ this.hairArm }, solver ${ this.hairDynamics === null ? 'off' : 'on' }.` );

    }

    /**
     * PUNCH-LIST 6.6 — the DFTL solver on the groom that has just been rebound.
     *
     * The coupling in one sentence: the groom is skinned 1.000 to `head` and nothing else, so its
     * skinned position is ONE rigid transform — which is why `setHeadMatrix` is the entire input to
     * the simulation, and why `MotionStack`'s head idle, gaze and sway reach the hair without any of
     * them knowing the hair exists.
     *
     * 🚩 **NEITHER `positionNode` NOR `installHairVelocity` MAY BE SEPARATED FROM THE OTHER, AND
     * THAT IS WHY BOTH LINES ARE IN THIS ONE FUNCTION.** A gate that checks one is the gate that let
     * this ship for two rounds — clause C4.
     *
     * @returns {?{ dynamics, update: function, velocityRepaired: boolean }} null when the groom's
     *   shape refuses a solver. Returned rather than assigned — see the 🚩 at the call site.
     */
    async buildHairDynamics( figure, meshes, material ) {

        // `deriveCardGroom` reads ONE geometry, and a two-mesh groom would need one solver each with
        // a shared collider fit. The shipped bakes are one mesh; a refusal in words is the honest
        // answer to a groom that is not, rather than a solver silently driving the first of two.
        if ( meshes.length !== 1 ) {

            console.warn( `Avatar: the hair solver needs one SkinnedMesh and this groom has ` +
                `${ meshes.length }. The groom is RIGID.` );

            return null;

        }

        const mesh = meshes[ 0 ];
        const boneIndex = mesh.skeleton.bones.findIndex( ( bone ) => bone.name === 'head' );

        if ( boneIndex < 0 ) {

            console.warn( 'Avatar: the groom\'s skeleton has no `head` bone to hang the solver on. ' +
                'The groom is RIGID.' );

            return null;

        }

        const headBone = mesh.skeleton.bones[ boneIndex ];
        const headBoneInverse = mesh.skeleton.boneInverses[ boneIndex ].clone();

        const [ { createHairDynamics }, { hasHairVelocity, installHairVelocity } ] = await Promise.all( [
            import( './motion/HairDynamics.js' ),
            import( './render/HairVelocity.js' )
        ] );

        const dynamics = createHairDynamics( {
            renderer: this.stage.renderer,
            geometry: mesh.geometry
        } );

        // The first call captures the gravity rest frame permanently, which is reason 1 for this
        // whole subsystem running at the END of `swapFigure` — the head has to be posed by now.
        dynamics.setHeadMatrix( mesh.matrixWorld, headBone.matrixWorld, headBoneInverse );

        const bones = new Map();
        figure.root.traverse( ( object ) => { if ( object.isBone === true ) bones.set( object.name, object ); } );

        const clavicleLeft = bones.get( 'clavicle_l' ) ?? null;
        const clavicleRight = bones.get( 'clavicle_r' ) ?? null;
        const leftShoulder = new Vector3();
        const rightShoulder = new Vector3();

        dynamics.fitColliders( {
            shoulderLeft: clavicleLeft === null ? null : clavicleLeft.getWorldPosition( leftShoulder ),
            shoulderRight: clavicleRight === null ? null : clavicleRight.getWorldPosition( rightShoulder )
        } );

        // 🎯 THE ONE LINE THE WHOLE SUBSYSTEM ARRIVES THROUGH. `NodeMaterial.setupPosition` runs
        // `skinning( object )` and THEN overwrites `positionLocal` with `positionNode` (r185,
        // `NodeMaterial.js:774` and `:802`), so a card vertex takes the solver's answer and the two
        // 326-vertex scalp cap shells — which are head, not hair — keep their skinning.
        material.positionNode = dynamics.positionNode;

        // 🎯 AND THE LINE THAT HAS TO ACCOMPANY IT. Overwriting `positionLocal` without also
        // assigning `positionPrevious` leaves the groom reporting its whole displacement from the
        // skinned rest pose as this frame's motion — p90 259.9 px/frame against a 128 px ceiling.
        installHairVelocity( material );

        // Read back rather than assumed, and read back through the module's own predicate. See the
        // 🚩 on `report().hair.velocityRepaired`.
        const velocityRepaired = hasHairVelocity( material );

        const update = ( deltaSeconds ) => {

            // The bones moved in `advanceFrame` and the renderer will not refresh their world
            // matrices until it draws, which is after this. Idempotent against the walk
            // `advanceFrame` already did — and required, because that walk runs before the eye
            // update and this closure runs after `ground.update()` has moved nothing.
            figure.root.updateMatrixWorld( true );

            dynamics.setHeadMatrix( mesh.matrixWorld, headBone.matrixWorld, headBoneInverse );

            // The skull rides the head matrix above; the capsule does not, because it hangs off the
            // clavicles and `Sway` moves the whole column.
            if ( clavicleLeft !== null && clavicleRight !== null ) {

                dynamics.setShoulders(
                    clavicleLeft.getWorldPosition( leftShoulder ),
                    clavicleRight.getWorldPosition( rightShoulder ) );

            }

            return dynamics.update( deltaSeconds );

        };

        // `HairDynamics.js:1189` grants one step while `resetPending`, which is exactly what a fresh
        // attach wants: the first frame runs from the rest pose rather than from whatever the
        // buffers held.
        dynamics.reset();

        return { dynamics, update, velocityRepaired };

    }

    /**
     * Drops the groom. Called before every bake swap and from `dispose()`, and safe on an avatar
     * that never had one.
     *
     * ⚠️ **`Material.dispose()` IN THREE ONLY DISPATCHES AN EVENT — IT FREES NO TEXTURES.** The
     * GLB's embedded base-colour map is 1024x1024 RGBA8 = 4.00 MB on the GPU (5.33 MB with mips) and
     * is referenced by the hair material's cutout; the two SIDECAR sheets `createHairMaterial`
     * decodes are another two. None of the three is reachable from `HairNodeMaterial.dispose()`,
     * which is not overridden, so all three are disposed by name here.
     *
     * 🚩 **AND ONE THING THIS FUNCTION CANNOT UNDO, DECLARED RATHER THAN HIDDEN.**
     * `createHairDynamics` returns no `dispose` — its five compute pipelines and ~957 kB of
     * `instancedArray` storage are dropped by reference and freed only when three's own bookkeeping
     * gets to them — and `installHairVelocity` patched `NodeMaterial.prototype.setupPosition`
     * process-wide with no uninstall. `leakedHandles()` is an own-property walk and can see neither.
     * `report().hair.undisposable` is where they are stated.
     */
    disposeHair() {

        this.hairUpdate = null;
        this.hairDynamics = null;

        // Cleared with the solver it describes. Left set, `report().hair.velocityRepaired` would
        // answer for the PREVIOUS groom on a swap where this one failed to land — which is exactly
        // the shape of report this file's census rule exists to refuse.
        this.hairVelocityRepaired = null;

        if ( this.hairRoot !== null ) {

            this.hairRoot.removeFromParent();
            this.hairRoot.traverse( ( object ) => {

                if ( object.isMesh === true ) object.geometry.dispose();

            } );

            this.hairRoot = null;

        }

        for ( const source of this.hairSourceMaterials ) {

            // By name, because `Material.dispose()` frees none of them and the embedded pair is
            // 1024x1024 RGBA8 apiece. The base-colour map is ALSO the hair material's cutout, so it
            // is freed here exactly once rather than in both places.
            source.map?.dispose?.();
            source.normalMap?.dispose?.();
            source.dispose?.();

        }

        this.hairSourceMaterials = [];

        if ( this.hairMaterial !== null ) {

            const nodes = this.hairMaterial.hair ?? {};

            nodes.flowMap?.value?.dispose?.();
            nodes.depthMap?.value?.dispose?.();

            this.hairMaterial.dispose();
            this.hairMaterial = null;

        }

    }

    /** Drops whatever the previous bake was wearing. Called before the figure itself is disposed. */
    disposeShading() {

        this.eyeOcclusion?.dispose();
        this.eyes?.dispose();
        this.skin?.dispose();

        for ( const card of this.cards ) card.dispose();

        this.eyeOcclusion = null;
        this.eyes = null;
        this.skin = null;
        this.cards = [];

    }

    // --- reporting helpers ------------------------------------------------------------------

    /**
     * WHICH SHADING SUBSYSTEMS ARE ACTUALLY LIVE, counted off the scene graph rather than off the
     * options that were supposed to put them there.
     *
     * Reporting the options back would be a tautology and would report a subsystem that failed to
     * attach — the eye material's `catch` above is a live example — as present.
     */
    censusOfShading() {

        const census = {
            skinMaterial: 0,
            eyeMaterial: 0,
            eyeOcclusion: 0,
            cardShading: 0,

            // Counted off the graph like the four above, and deliberately NOT the same question as
            // `report().hair.attached`: that one reads a handle this file kept, this one reads how
            // many meshes in the scene are actually wearing the groom's material. A groom that
            // loaded, rebound and then failed to take the material reads `attached: true` here and
            // `hairMaterial: 0` — which is exactly the disagreement a census exists to expose.
            hairMaterial: 0,

            shadowCastingLights: 0,
            temporalResolve: this.stage?.temporal == null ? 0 : 1,
            grade: this.stage?.grade == null ? 0 : 1,
            ambientOcclusion: this.stage?.ambientOcclusion == null
                ? null
                : { ...this.stage.ambientOcclusion.describe() }
        };

        if ( this.figure !== null ) {

            this.figure.root.traverse( ( object ) => {

                if ( object.isMesh !== true ) return;

                const materials = Array.isArray( object.material ) ? object.material : [ object.material ];

                for ( const material of materials ) {

                    if ( material === null || material === undefined ) continue;
                    if ( this.skin !== null && material === this.skin ) census.skinMaterial ++;
                    if ( this.cards.includes( material ) ) census.cardShading ++;
                    if ( this.hairMaterial !== null && material === this.hairMaterial ) census.hairMaterial ++;

                    // Identity against the two shells `EyeMaterial` builds, not a name test. An
                    // honest limit inherited from `alive.js`'s census: this reads 0 both when the
                    // eye material was never built and when it was built and never attached. It
                    // does not need to tell those apart — either way the frame has no eye shader
                    // on it.
                    if ( this.eyes !== null
                        && ( material === this.eyes.globeMaterial || material === this.eyes.corneaMaterial ) ) {

                        census.eyeMaterial ++;

                    }

                }

            } );

        }

        if ( this.eyeOcclusion !== null ) {

            census.eyeOcclusion = this.eyeOcclusion.meshes.filter( ( mesh ) => mesh.parent !== null ).length;

        }

        if ( this.lights !== null ) {

            for ( const unit of this.lights.units ) {

                if ( unit.shadowCaster !== null && unit.shadowCaster.castShadow === true ) {

                    census.shadowCastingLights ++;

                }

            }

        }

        return census;

    }

    /**
     * Every own property that still holds something disposable — a deny-by-default leak check.
     *
     * 🎯 THE POINT IS THAT IT IS NOT A LIST. A hand-written inventory of the handles this class owns
     * is a list of what somebody remembered, and it goes stale the first time a field is added; this
     * walks what the object actually has. After `dispose()` it must be empty, and its red proof is
     * to comment out any one release in `dispose()` and read the array.
     */
    leakedHandles() {

        if ( this.disposed === false ) return [];

        const leaked = [];

        for ( const [ name, value ] of Object.entries( this ) ) {

            if ( Array.isArray( value ) ) {

                if ( value.some( ( entry ) => hasDispose( entry ) ) ) leaked.push( name );
                continue;

            }

            if ( hasDispose( value ) ) leaked.push( name );

        }

        return leaked;

    }

    /** Every verb refuses on a disposed avatar, by name, rather than throwing from inside three. */
    requireLive( verb ) {

        if ( this.disposed === true ) {

            throw new Error( `Avatar.${ verb }: this avatar has been disposed. Create another one.` );

        }

    }

}

// --- module helpers ----------------------------------------------------------------------------

/**
 * Which tier to build, and the honest account of how that was decided.
 *
 * `auto` is a STRUCTURAL decision and never a timing one: WebGL2 has no velocity buffer, so the
 * temporal path cannot run on it at all. Tier selection from a MEASURED FRAME BUDGET is punch-list
 * 7.2 and is not done anywhere in this file.
 *
 * 🚩 IT ASKS THE ADAPTER, NOT ONLY THE API. `Stage.isWebGPUAvailable()` says so about itself in
 * words — "presence of `navigator.gpu` is necessary but not sufficient — an adapter request can
 * still fail" (`Stage.js:893-896`) — and the consequence of believing it is a tier built on a
 * velocity buffer that does not exist. `requestAdapter()` is the authoritative answer and it is
 * available BEFORE any renderer is constructed, which is the only place a tier decision can be
 * taken without a rebuild. Anything thrown by it is a refusal: this runs before there is a GPU to
 * lose, and a browser that cannot answer the question cannot serve the tier either.
 *
 * Exported so a gate can state this without standing up a GPU. The two exported module helpers are
 * exactly the two whose failure mode is silent: a tier that resolves wrong still renders, and a
 * rebased asset URL 404s at fetch time with a message that names neither this file nor the asset.
 *
 * 🎯 **HAIR MOVES `auto` FROM `high` TO `balanced`, AND THAT IS STILL NOT A FRAME BUDGET.** The
 * input is a STRUCTURAL fact the caller has already stated — hair is on — rather than a timing this
 * machine was measured at. The measurement behind the choice is elsewhere and was taken once, and
 * 🚩 IT IS WEAKER THAN THE SENTENCE THAT STOOD HERE. Hair costs a measured **+2.0 ms at p50**; the
 * same round's p95 column DID NOT RESOLVE — docs/API.md states it outright, and its two bald
 * repetitions differ by more (21.5 against 29.6) than bald differs from haired. So "a hair-bearing
 * `high` fits with under a millisecond in hand" was arithmetic on a number its own author had
 * withdrawn, and it is gone.
 *
 * What survives is enough to keep the demotion, as a CONSERVATIVE choice rather than a measured
 * necessity: +2.0 ms of p50 is real, `high` has the least headroom of the three tiers, and an `auto`
 * caller has by definition expressed no preference, so it gets the configuration with room in it.
 * `quality: 'high'` still gets `high` for a caller who wants it, and
 * `report().hair.frameBudgetWarning` says what that costs in the units that resolved.
 *
 * @param {string} requested - One of `QUALITY_REQUESTS`.
 * @param {Stage} stage - Asked only for `isWebGPUAvailable()`; not yet created.
 * 🔴 **AND `backdrop: false` FORCES `balanced`, WHICH IS A CORRECTNESS CONSTRAINT RATHER THAN A
 * BUDGET.** Measured in a GPU chromium: ground-truth occlusion with NOTHING at background depth
 * renders the WHOLE FRAME black, on `high` and on `fallback` alike, and `balanced` — the one tier
 * with `occlusion: false` — renders correctly. Isolated to the card alone: `backdrop: 0x000000`
 * renders the figure perfectly and `backdrop: false` does not, and scaling the card to 0.001 and
 * moving it off-screen reproduces the black frame, so it is the card's PIXELS at background depth
 * and not its presence in the draw list. `BACKGROUND_PRESETS` carries the table.
 *
 * @param {Object} [structural] - Facts the caller has already stated that change what `auto` means.
 * @param {boolean} [structural.hair=false] - whether a groom will be attached.
 * @param {boolean} [structural.backdropless=false] - whether the emissive card is off.
 * @returns {Promise<string>} a key of `QUALITY_TIERS`.
 */
export async function resolveTier( requested, stage, structural = {} ) {

    if ( requested !== 'auto' ) return requested;

    if ( stage.isWebGPUAvailable() === false ) return 'fallback';

    const withRoom = structural.hair === true || structural.backdropless === true ? 'balanced' : 'high';

    try {

        const adapter = await navigator.gpu.requestAdapter();

        return adapter === null || adapter === undefined ? 'fallback' : withRoom;

    } catch ( error ) {

        console.warn( `Avatar: requesting a WebGPU adapter threw (${ error.message }), so the ` +
            "'fallback' tier is what this machine gets. Pass an explicit `quality` to override." );

        return 'fallback';

    }

}

// --- the scene options: resolution and refusal ---------------------------------------------------
//
// All four functions below are EXPORTED and all four are pure, because the gate has to be able to
// drive them without a canvas and a consumer has to be able to see what a shorthand expands to.

/**
 * The shipped ambient fraction of key, read off `LightingRig` rather than copied.
 *
 * `AMBIENT.fractionOfKey` (0.22) is module-private in that file, and `lighting.ambient` is a
 * RELATIVE multiplier on it — so the number has to come from somewhere. A bare `new LightingRig()`
 * builds no lights and touches no scene; it resolves its placement table and stops. Reading the
 * default off the class means the multiplier tracks the file that owns the value, which is exactly
 * what a copied `0.22` would not do.
 */
let cachedAmbientFractionOfKey = null;

export function shippedAmbientFractionOfKey() {

    if ( cachedAmbientFractionOfKey === null ) {

        cachedAmbientFractionOfKey = new LightingRig( {} ).ambientFractionOfKey;

    }

    return cachedAmbientFractionOfKey;

}

/** The authored placement table for one framing, keyed by name. Read off the real class. */
function authoredPlacements( preset ) {

    const table = new Map();

    for ( const placement of new LightingRig( { preset } ).placements ) table.set( placement.name, placement );

    return table;

}

/**
 * One look, resolved into absolute per-light overrides against ONE framing's authored table.
 *
 * Exported because it is the function `setFraming` has to re-run and the function clause A2 drives:
 * a gate that asserted a copy of these numbers would be a gate on a copy.
 *
 * @param {string} look - a key of `SCENE_LOOKS`.
 * @param {'portrait'|'body'} preset
 * @returns {Object} `{ [lightName]: { field: value } }`, ready for `LightingRig`'s `overrides`.
 */
export function resolveLook( look, preset ) {

    const entry = SCENE_LOOKS[ look ];

    if ( entry === undefined ) {

        throw new TypeError(
            `Avatar: unknown look '${ look }'. Known: ${ SCENE_LOOK_NAMES.join( ', ' ) }.` );

    }

    // 🚩 DENY-BY-DEFAULT ON THE LOOK ENTRY ITSELF, AND THIS IS CLAUSE A4'S RED PROOF HOOK. A look
    // that carried an `ambientScale` would move the one lever with a ONE-CODE-VALUE window — G6
    // wants whole-image p0.1 luma in 0.004–0.016 and the shipped backdrop measures portrait 0.00420
    // and body 0.01597 — and it would move it invisibly, because nothing else in this resolution
    // path would notice a key it does not read. See `AMBIENT_MULTIPLIER_RANGE`.
    for ( const key of Object.keys( entry ) ) {

        if ( LOOK_ENTRY_KEYS.includes( key ) === false ) {

            throw new TypeError( `Avatar: look '${ look }' declares '${ key }', and a look may only ` +
                `declare ${ LOOK_ENTRY_KEYS.join( ' and ' ) }. A look must not move the ambient — G6's ` +
                'window is one code value wide (LightingRig.js:989-991), and it must not move ' +
                'key.irradiance or fill.irradiance, which is the G1 axis.' );

        }

    }

    const authored = authoredPlacements( preset );
    const overrides = {};

    for ( const [ light, fields ] of Object.entries( entry.fields ) ) {

        requireKnownLight( light, `look '${ look }'` );
        overrides[ light ] = { ...fields };

    }

    for ( const [ light, scaled ] of Object.entries( entry.scales ) ) {

        requireKnownLight( light, `look '${ look }'` );

        const base = authored.get( light );

        // A look naming a light this framing's preset does not carry cannot be scaled against
        // anything. `resolvePlacements` would drop it in SILENCE — measured: `{ fifth: {…} }`
        // leaves 4 placements and throws nothing.
        if ( base === undefined ) {

            throw new TypeError( `Avatar: look '${ look }' scales '${ light }', which the '${ preset }' ` +
                'preset does not carry. LightingRig would drop that override without a word.' );

        }

        const merged = overrides[ light ] ?? ( overrides[ light ] = {} );

        for ( const [ field, factor ] of Object.entries( scaled ) ) merged[ field ] = base[ field ] * factor;

    }

    return overrides;

}

/** Deny-by-default on the light NAME. Half of what closes the rig's two silent-drop rows. */
function requireKnownLight( name, source ) {

    if ( RIG_LIGHT_NAMES.includes( name ) === false ) {

        throw new TypeError( `Avatar: ${ source } names a light '${ name }'. ` +
            `Accepted: ${ RIG_LIGHT_NAMES.join( ', ' ) }. LightingRig drops an unknown name in silence.` );

    }

}

/**
 * `lighting`, from any accepted shorthand into the one shape the rest of this file reads.
 *
 * @param {string|Object} request
 * @returns {{ look: string, exposure: number, ambient: number, shadows: ?boolean, lights: Object }}
 */
export function resolveLightingOption( request ) {

    if ( typeof request === 'string' ) return resolveLightingOption( { look: request } );

    if ( request === null || typeof request !== 'object' ) {

        throw new TypeError( 'Avatar: lighting must be a look name or an object — ' +
            `one of ${ SCENE_LOOK_NAMES.join( ', ' ) }, or { look, exposure, ambient, shadows, lights }.` );

    }

    const known = [ 'look', 'exposure', 'ambient', 'shadows', 'lights' ];

    for ( const key of Object.keys( request ) ) {

        if ( known.includes( key ) === false ) {

            throw new TypeError( `Avatar: lighting has no option '${ key }'. Accepted: ${ known.join( ', ' ) }.` );

        }

    }

    const look = request.look ?? 'studio';

    if ( SCENE_LOOKS[ look ] === undefined ) {

        throw new TypeError(
            `Avatar: lighting.look must be one of ${ SCENE_LOOK_NAMES.join( ', ' ) }, got '${ look }'.` );

    }

    const exposure = request.exposure ?? 1;
    const ambient = request.ambient ?? 1;

    requireInRange( 'lighting.exposure', exposure, EXPOSURE_MULTIPLIER_RANGE,
        'a RELATIVE multiplier on the calibrated exposure; it cannot move any ratio but it does ' +
        'move G1 in the rendered frame (LightingRig.js:240-256)' );

    requireInRange( 'lighting.ambient', ambient, AMBIENT_MULTIPLIER_RANGE,
        'a RELATIVE multiplier on the rig\'s ambient fraction of key. ⚠️ G6\'s window is one code ' +
        'value wide — shipped portrait 0.00420, body 0.01597, band 0.004–0.016' );

    if ( request.shadows !== undefined && request.shadows !== null
        && typeof request.shadows !== 'boolean' ) {

        throw new TypeError( 'Avatar: lighting.shadows must be true, false, or null to let the ' +
            `quality tier decide; got ${ typeof request.shadows }.` );

    }

    return Object.freeze( {
        look,
        exposure,
        ambient,
        shadows: request.shadows ?? null,
        lights: resolveLightOverrides( request.lights ?? null )
    } );

}

/**
 * The escape hatch, validated field by field.
 *
 * 🚩 THIS IS THE FUNCTION THE SEVEN MEASURED PATHOLOGIES DIE IN. See `PLACEMENT_FIELDS` for the
 * table of what each one does to a rig that accepts it — negative light, `Infinity` panel radiance,
 * `NaN` into the scene graph, and two overrides silently discarded.
 */
export function resolveLightOverrides( lights ) {

    if ( lights === null || lights === undefined ) return Object.freeze( {} );

    if ( typeof lights !== 'object' ) {

        throw new TypeError( 'Avatar: lighting.lights must be an object keyed by light name — ' +
            `${ RIG_LIGHT_NAMES.join( ', ' ) }.` );

    }

    const resolved = {};

    for ( const [ name, fields ] of Object.entries( lights ) ) {

        requireKnownLight( name, 'lighting.lights' );

        if ( fields === null || typeof fields !== 'object' ) {

            throw new TypeError( `Avatar: lighting.lights.${ name } must be an object of placement ` +
                `fields — ${ Object.keys( PLACEMENT_FIELDS ).join( ', ' ) }.` );

        }

        const out = {};

        for ( const [ field, value ] of Object.entries( fields ) ) {

            const spec = PLACEMENT_FIELDS[ field ];

            // Deny-by-default on the FIELD name. `{ key: { irradianceX: 9 } }` is merged into the
            // placement and ignored by every reader — measured, no throw, no warning.
            if ( spec === undefined ) {

                throw new TypeError( `Avatar: lighting.lights.${ name } has no field '${ field }'. ` +
                    `Accepted: ${ Object.keys( PLACEMENT_FIELDS ).join( ', ' ) }. LightingRig merges ` +
                    'an unknown field and ignores it, in silence.' );

            }

            requireInRange( `lighting.lights.${ name }.${ field }`, value, spec,
                spec.kind === 'colour' ? 'an sRGB hex' : 'a finite number' );

            // 🚩 ZERO IS LEGAL FOR AN EDGE LIGHT AND ILLEGAL FOR A FORM LIGHT, AND THE ASYMMETRY IS
            // THE G1 AXIS RATHER THAN A STYLE RULE. `rim: { irradiance: 0 }` is an honest way to
            // say "no rim". `fill: { irradiance: 0 }` makes `designedKeyToFill` **Infinity** —
            // measured through the real rig, no throw — and `key: { irradiance: 0 }` makes it 0.
            // Either one takes the ratio the whole lighting spec is stated in out of the reals, and
            // every downstream reader of it (`describe()`, `report()`, gate G1) inherits that.
            if ( field === 'irradiance' && value === 0 && ( name === 'key' || name === 'fill' ) ) {

                throw new TypeError( `Avatar: lighting.lights.${ name }.irradiance is 0. The key and ` +
                    'the fill are the two halves of the designed key:fill ratio — the G1 axis — so a ' +
                    'zero in either takes it to 0 or Infinity. Accepted range ( 0, ' +
                    `${ PLACEMENT_FIELDS.irradiance.max } ]. An edge light may be 0; these two may not.` );

            }

            out[ field ] = value;

        }

        resolved[ name ] = Object.freeze( out );

    }

    return Object.freeze( resolved );

}

/** One numeric refusal, with the field named AND the accepted range printed. */
function requireInRange( label, value, range, meaning ) {

    if ( Number.isFinite( value ) === false ) {

        throw new TypeError( `Avatar: ${ label } must be ${ meaning }; got ${ String( value ) }. ` +
            `Accepted range [${ range.min }, ${ range.max }].` );

    }

    if ( value < range.min || value > range.max ) {

        throw new TypeError( `Avatar: ${ label } is ${ value }, outside [${ range.min }, ${ range.max }] — ` +
            `${ meaning }.` );

    }

}

/**
 * `background`, from any accepted shorthand into `{ colour, backdrop, ground }`.
 *
 * `'transparent'` resolves to `{ colour: null, backdrop: false, ground: false }` and all three
 * halves are needed: the clear alpha is decided by `scene.background`, the 8x6 m emissive card fills
 * a portrait frame regardless of the clear, and the ground plane is a unit plane scaled to twelve
 * subject heights — about 20 m square at body framing, and opaque.
 */
export function resolveBackgroundOption( request ) {

    if ( typeof request === 'string' ) {

        const preset = BACKGROUND_PRESETS[ request ];

        if ( preset === undefined ) {

            throw new TypeError( `Avatar: background must be one of ${ BACKGROUND_PRESET_NAMES.join( ', ' ) }, ` +
                `a colour hex, or { colour, backdrop, ground }; got '${ request }'.` );

        }

        // Re-entered through the object path rather than returned, so a preset cannot be a second
        // door past the validation the long form goes through. `'transparent'` is exactly that
        // case today: the preset is declared and the refusal below is what it resolves to.
        return resolveBackgroundOption( { ...preset } );

    }

    // A bare hex is the clear colour ALONE — the card and the ground are kept, because an embedder
    // tinting the room to match their chrome has not asked to lose the contact shadow.
    if ( typeof request === 'number' ) return resolveBackgroundOption( { colour: request } );

    if ( request === null || typeof request !== 'object' ) {

        throw new TypeError( 'Avatar: background must be a preset name, a colour hex, or ' +
            '{ colour, backdrop, ground }.' );

    }

    const known = [ 'colour', 'backdrop', 'ground' ];

    for ( const key of Object.keys( request ) ) {

        if ( known.includes( key ) === false ) {

            throw new TypeError( `Avatar: background has no option '${ key }'. Accepted: ${ known.join( ', ' ) }. ` +
                ( key === 'color' ? 'This project spells it `colour`.' : '' ) );

        }

    }

    const colour = request.colour === undefined ? BACKGROUND_PRESETS.studio.colour : request.colour;
    const ground = request.ground === undefined ? BACKGROUND_PRESETS.studio.ground : request.ground;

    // 🚩 THE CARD FOLLOWS THE COLOUR, AND NOT DOING SO MADE THIS WHOLE OPTION INVISIBLE.
    //
    // `scene.background` is the CLEAR colour, and the emissive backdrop card stands in front of it
    // at every ordinary aspect ratio, so a caller who set only `colour` changed a pixel nobody could
    // see. Measured in a GPU chromium on 2026-08-17, top-left patch, tier `high`, one avatar per
    // page load: `background: 'studio'` -> [2.69, 2.95, 3.98]; `0xffffff` -> [2.69, 2.96, 3.98];
    // `0xff0000` -> [2.69, 2.96, 3.98]. White, red and the default were IDENTICAL to two decimals,
    // and `report().scene.background` cheerfully echoed back the colour that was not in the frame.
    // The control that proved the mechanism: `{ colour: 0xffffff, backdrop: false }` -> [238.20,
    // 238.18, 238.17]. The wiring was always fine; the card was simply in front.
    //
    // So an explicit `colour` with no explicit `backdrop` sets BOTH. That is what "tint the room to
    // match your chrome" means, and it keeps the ground plane — the comment on the bare-hex path
    // above is right that an embedder tinting the room has not asked to lose the contact shadow.
    // A caller who wants them to differ still says so; `{ colour: X, backdrop: Y }` is untouched.
    //
    // ⚠️ THE CARD IS EMISSIVE, so this is a light source as well as a backdrop, and a bright colour
    // lights the room. That is the honest behaviour of an emissive backdrop rather than a defect —
    // `BACKDROP_EMISSIVE` is near-black for exactly that reason — and it is stated in docs/API.md
    // so a caller who wants a bright background and a dark room knows to pass `backdrop` too.
    const backdrop = request.backdrop !== undefined ? request.backdrop
        : ( request.colour !== undefined ? request.colour : BACKGROUND_PRESETS.studio.backdrop );

    // 🔴 REFUSED, WITH THE MEASUREMENT, RATHER THAN SHIPPED BROKEN. See `BACKGROUND_PRESETS` for
    // the table and the two isolations. An option that returns an opaque black rectangle is worse
    // than an option that says why it cannot exist yet, because the first one gets shipped.
    if ( colour === null ) {

        throw new TypeError( 'Avatar: background.colour: null (a transparent canvas) is not ' +
            'supported yet, and it is refused rather than presented as an opaque black rectangle. ' +
            'Measured 2026-08-17 in a GPU chromium: the TEMPORAL RESOLVE forces the frame alpha to ' +
            '1, so no tier with one can present a transparent canvas — with the grade displaying ' +
            'its own alpha, tier fallback reads 41.63% at alpha 0 and tier high reads 100% at alpha ' +
            '1. render/Grade.js already carries and premultiplies the alpha correctly; the repair ' +
            'is in the TAAU/TRAA resolve. Use background: { colour: 0x08080a } and composite ' +
            'against that, or a solid colour that matches your page.' );

    }

    requireInRange( 'background.colour', colour, PLACEMENT_FIELDS.colour, 'an sRGB hex' );
    if ( backdrop !== false ) requireInRange( 'background.backdrop', backdrop, PLACEMENT_FIELDS.colour, 'an sRGB hex' );

    if ( typeof ground !== 'boolean' ) {

        throw new TypeError( `Avatar: background.ground must be true or false, got ${ typeof ground }. ` +
            '⚠️ false is a documented downgrade: 60% of the light landing beside a sole comes from ' +
            'two RectAreaLights that cannot cast a shadow at all, which is why GroundContact ' +
            'occludes analytically. Without the plane the figure floats.' );

    }

    return Object.freeze( { colour, backdrop, ground } );

}

/**
 * `hair`, from any accepted shorthand into a style id or null.
 *
 * ⚠️ `true` IS ACCEPTED AND WARNS RATHER THAN BEING THE PRIMARY FORM. A boolean cannot name a style
 * and there will be a second groom; a caller who wrote `hair: true` today would be a caller whose
 * avatar silently changed its hairstyle on the day one lands.
 */
export function resolveHairOption( request ) {

    if ( request === false || request === null || request === undefined ) return null;

    if ( request === true ) {

        console.warn( `Avatar: hair: true is an alias for the first groom in the manifest — ` +
            `'${ HAIR_STYLES[ 0 ] }' today. Name the style instead: hair: '${ HAIR_STYLES[ 0 ] }'.` );

        return HAIR_STYLES[ 0 ];

    }

    if ( HAIR_STYLES.includes( request ) === false ) {

        throw new TypeError( `Avatar: hair must be false or one of ${ HAIR_STYLES.join( ', ' ) }, ` +
            `got '${ String( request ) }'.` );

    }

    return request;

}

/** A partial `setLighting` request, merged over what is live. Shorthands expand first. */
function mergeLightingRequest( current, request ) {

    const partial = typeof request === 'string' ? { look: request } : request;

    if ( partial === null || typeof partial !== 'object' ) {

        throw new TypeError( 'Avatar.setLighting: pass a look name or a partial lighting object.' );

    }

    return { ...current, ...partial };

}

/** A partial `setBackground` request, merged over what is live. */
function mergeBackgroundRequest( current, request ) {

    if ( typeof request === 'string' ) return BACKGROUND_PRESETS[ request ] ?? request;
    if ( typeof request === 'number' ) return { ...current, colour: request };

    if ( request === null || typeof request !== 'object' ) {

        throw new TypeError( 'Avatar.setBackground: pass a preset name, a colour hex, or a partial ' +
            '{ colour, backdrop, ground }.' );

    }

    return { ...current, ...request };

}

/**
 * Rebases an asset URL onto a caller-supplied origin, or leaves it exactly as it is.
 *
 * 🚩 THE DEFAULT PATH MUST STAY A BUNDLER-VISIBLE `new URL( <literal>, import.meta.url )`, AND THAT
 * IS WHY THIS FUNCTION DOES NOTHING WHEN NO BASE IS GIVEN. A URL built by string concatenation is
 * invisible to rollup, so `vite build` emits no asset and the built page 404s on data the dev server
 * served happily — and the failure arrives as `SyntaxError: Unexpected token '<'` out of
 * `GLTFLoader.parse`, which is `index.html` being parsed as glTF and names neither the file nor the
 * asset (`alive.js:518-533`). `figure/Identity.js:72-78` already holds the five figure URLs as
 * literals, so the default is correct by construction and this only takes over when the embedder has
 * explicitly said where they host the assets — at which point they own the hosting and concatenation
 * is the right answer rather than the invisible one.
 *
 * 🚩 A ROOT-RELATIVE BASE IS THE FIRST THING AN EMBEDDER WRITES AND IT USED TO THROW HERE.
 * `new URL( 'figures/x.glb', '/static/avatar/' )` is `TypeError: Invalid URL` — `URL` requires an
 * ABSOLUTE base, and `/static/avatar/` is the most natural value anybody would pass. Verified by
 * execution on node 24, which is how it was found. So the base is itself resolved first, against the
 * DOCUMENT, which is what makes `assetBaseUrl` behave the way an `<img src>` does rather than
 * relative to wherever in `node_modules` this module happens to be installed. Outside a browser
 * there is no document, and the module's own URL stands in so a gate can exercise this without a DOM.
 *
 * @param {string} url - What the library resolved on its own.
 * @param {?string} base - The caller's origin, or null to keep `url` untouched.
 * @param {string} folder - Sub-path under the base, '' for none.
 */
export function resolveAgainstBase( url, base, folder ) {

    if ( base === null || base === undefined ) return url;

    const documentBase = globalThis.location?.href ?? import.meta.url;
    const root = new URL( base.endsWith( '/' ) ? base : `${ base }/`, documentBase );
    const fileName = url.slice( url.lastIndexOf( '/' ) + 1 );

    return new URL( folder === '' ? fileName : `${ folder }/${ fileName }`, root ).href;

}

/**
 * Resolves after the browser has PAINTED, which takes two animation frames: the first callback runs
 * before the paint it was scheduled for, the second only after that paint has happened.
 *
 * This is a BARRIER rather than a clock, so a throttled or hidden tab makes `step()` slow and never
 * wrong. ⚠️ In a hidden tab rAF may not fire at all, so `step()` will not resolve until the tab is
 * visible — which is correct behaviour for a call whose contract is "the pixels are on the screen",
 * and is worth knowing before using it in a background page.
 */
function nextPaint() {

    return new Promise( ( resolve ) => {

        requestAnimationFrame( () => requestAnimationFrame( () => resolve() ) );

    } );

}

/** The bake's own name — `figure_g050` — which is what the baked maps are keyed on. */
function bakeNameFrom( url ) {

    return url.slice( url.lastIndexOf( '/' ) + 1 ).replace( '.glb', '' );

}

/** Nearest of an emotion's PAD anchors to where the avatar currently stands. See `feel`. */
function nearestAnchorTo( pad, points ) {

    let best = points[ 0 ];
    let bestDistance = Infinity;

    for ( const point of points ) {

        const dp = pad.pleasure - point[ 0 ];
        const da = pad.arousal - point[ 1 ];
        const dd = pad.dominance - point[ 2 ];
        const distance = dp * dp + da * da + dd * dd;

        if ( distance < bestDistance ) {

            bestDistance = distance;
            best = point;

        }

    }

    return best;

}

/**
 * Frees a loaded groom's own GPU-side resources.
 *
 * Used on every early exit from `attachHair` — a losing load token, a groom with no skinned mesh, a
 * rig that has moved under it. ⚠️ `Material.dispose()` frees no textures, so the two embedded
 * 1024x1024 sheets are named rather than left to the material.
 */
function disposeGroomScene( root ) {

    root.traverse( ( object ) => {

        if ( object.isMesh !== true ) return;

        object.geometry.dispose();

        for ( const material of ( Array.isArray( object.material ) ? object.material : [ object.material ] ) ) {

            if ( material === null || material === undefined ) continue;

            material.map?.dispose?.();
            material.normalMap?.dispose?.();
            material.dispose();

        }

    } );

}

/** True for anything that carries a `dispose` method. Used by the leak walk. */
function hasDispose( value ) {

    return value !== null && typeof value === 'object' && typeof value.dispose === 'function';

}

/**
 * The backdrop card.
 *
 * Named because anything keying on mesh names would otherwise file it under `mesh:anonymous`, which
 * is a bucket rather than an identity and collides with the next unnamed mesh anybody adds.
 */
function buildBackdrop( stage, emissive = BACKDROP_EMISSIVE ) {

    const material = new MeshStandardNodeMaterial( {
        color: 0x000000,
        emissive,
        emissiveIntensity: 1,
        roughness: 1,
        metalness: 0
    } );

    const backdrop = new Mesh( new PlaneGeometry( 8, 6 ), material );
    backdrop.name = 'backdrop';

    stage.add( backdrop );

    return backdrop;

}

/**
 * Re-shades the eyelash and eyebrow cards, and gives their albedo a floor.
 *
 * Matched on the ASSET'S OWN ALPHA MODE rather than on mesh names: glTF `alphaMode: MASK` arrives as
 * a non-zero `alphaTest`, and a name matcher has already had to be widened once on this project when
 * `low-poly` became `high-poly`.
 *
 * ⚠️ THE ALPHA HAS TO BE CARRIED ACROSS THE FLOOR EXPLICITLY. `alphaTest` reads `diffuseColor.a`, and
 * `vec4( someVec3 )` pads alpha with ZERO — which would discard every texel on the card and delete
 * the brows and lashes outright. That is why the floor is an explicit `colorNode` rather than a
 * tweak to `material.color`.
 *
 * `alphaToCoverage` follows whether the target is multisampled, and the two can never disagree
 * because the value is read off the stage rather than off a flag: alpha to coverage on a
 * single-sampled target silently degrades to the same binary cut it replaced.
 */
function applyCardShading( figure, multisampled ) {

    const installed = [];

    figure.root.traverse( ( object ) => {

        if ( object.isMesh !== true ) return;

        const previous = object.material;
        const isAlphaMaskedCard = previous !== undefined && previous !== null && previous.alphaTest > 0;

        if ( isAlphaMaskedCard === false ) return;

        const card = new MeshPhysicalNodeMaterial();
        card.name = `sugata.card.${ previous.name }`;
        card.map = previous.map;
        card.color.copy( previous.color );
        card.side = previous.side;

        if ( previous.map !== null && previous.map !== undefined ) {

            const floor = new Color().setHex( CARD_ALBEDO_FLOOR, SRGBColorSpace );
            const sampled = texture( previous.map );

            card.colorNode = vec4(
                max( sampled.rgb.mul( vec3( previous.color.r, previous.color.g, previous.color.b ) ),
                    vec3( floor.r, floor.g, floor.b ) ),
                sampled.a
            );

        }

        // Kept from the asset rather than re-chosen: with no specular lobe they change nothing, and
        // a number that changes nothing should not be silently re-authored.
        card.roughness = previous.roughness;
        card.metalness = 0;

        card.specularIntensity = 0;
        card.alphaTest = CARD_ALPHA_CUTOFF;
        card.alphaToCoverage = multisampled;

        object.material = card;
        installed.push( card );

    } );

    return installed;

}

/**
 * Puts the camera on the figure and reports where it is looking.
 *
 * Two framings, because the acceptance gate asks two different questions of the same figure. A
 * PORTRAIT is the only frame in which a blink or a saccade is legible — an eyelid has to be dozens
 * of pixels tall before the roll of it means anything. A BODY frame is the only one in which a rest
 * pose, an arm that hangs and a weight shift are legible at all. Neither answers for the other.
 *
 * The portrait is anchored on the EYE LINE, read off the eyeball mesh rather than guessed from a
 * bone: the five bakes differ in height by centimetres and the `head` joint sits at the base of the
 * skull, well below the eyes. The body frame is anchored on the bounding box instead, because "the
 * whole person" is a statement about the mesh rather than about the face.
 */
function frameFigure( stage, figure, { mode, heightMetres } ) {

    figure.root.updateMatrixWorld( true );

    const focus = mode === 'body'
        ? bodyFocus( figure )
        : new Vector3( 0, eyeLineHeight( figure ) + heightMetres * ( EYE_LINE_FROM_TOP - 0.5 ), 0 );

    const halfFieldOfView = ( PORTRAIT_FIELD_OF_VIEW_DEGREES / 2 ) * Math.PI / 180;
    const distance = ( heightMetres / 2 ) / Math.tan( halfFieldOfView );
    const azimuth = CAMERA_AZIMUTH_DEGREES * Math.PI / 180;

    stage.camera.position.set(
        focus.x + Math.sin( azimuth ) * distance,
        focus.y,
        focus.z + Math.cos( azimuth ) * distance
    );

    stage.camera.lookAt( focus );

    return { focus, distanceMetres: distance };

}

/** Vertical centre of the figure's bounding box, on the figure's own axis rather than the box's. */
function bodyFocus( figure ) {

    const bounds = new Box3().setFromObject( figure.root );

    return new Vector3( 0, ( bounds.min.y + bounds.max.y ) / 2, 0 );

}

/**
 * The framed height the requested mode wants, in metres.
 *
 * Measured rather than assumed because the five bakes differ by centimetres and because the rest
 * pose changes the number: the relaxed pose drops the arms and settles the pelvis, so the same
 * figure is not the same height posed as it is in bind.
 */
function framedHeightFor( figure, mode, override ) {

    if ( Number.isFinite( override ) ) return override;
    if ( mode !== 'body' ) return PORTRAIT_HEIGHT_METRES;

    const bounds = new Box3().setFromObject( figure.root );

    return ( bounds.max.y - bounds.min.y ) * BODY_FRAME_MARGIN;

}

/**
 * World height of the pupils, taken as the centre of the eyeball mesh.
 *
 * Falls back to the crown of the bounding box less a head's worth so a figure without that mesh
 * still frames somewhere sane rather than at the navel — but SAYS SO, because a silent fallback here
 * moves the portrait crop without moving anything a gate looks at.
 */
function eyeLineHeight( figure ) {

    let eyeballs = null;

    figure.root.traverse( ( object ) => {

        if ( object.isMesh === true && EYEBALL_MESH_PATTERN.test( object.name ) ) eyeballs = object;

    } );

    if ( eyeballs !== null ) {

        return new Box3().setFromObject( eyeballs ).getCenter( new Vector3() ).y;

    }

    console.warn( `Avatar: no mesh matching ${ EYEBALL_MESH_PATTERN } — the portrait frame is ` +
        'guessing at the eye line from the top of the bounding box.' );

    return new Box3().setFromObject( figure.root ).max.y - 0.11;

}

/**
 * Aims the rig at the shot, and hands the eye shader the key's direction.
 *
 * `aimAt` wants the FRAMED height rather than the figure's stature — a 0.42 m portrait crop and a
 * 1.87 m full-body frame are different shots of the same person and want different rigs — and it
 * wants the camera, because every placement azimuth is measured from the camera direction rather
 * than from the world axes. That is what makes the same key:fill ratio hold at both framings.
 *
 * The eye's analytic iris caustic is computed against one key direction and its default is an inline
 * rig that no longer exists; left unset, the iris would be lit from a key that is not there.
 */
function aimRigAt( lights, eyes, focus, framedHeightMetres, stage ) {

    lights.aimAt( {
        focus,
        subjectHeightMetres: framedHeightMetres,
        cameraPosition: stage.camera.position
    } );

    if ( eyes === null ) return;

    const key = lights.units.find( ( unit ) => unit.placement.name === 'key' );

    if ( key === undefined ) return;

    eyes.keyLightDirectionUniform.value
        .copy( key.area.position )
        .sub( focus )
        .normalize();

}
