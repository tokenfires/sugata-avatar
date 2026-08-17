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
 * Deferred rather than dropped, and named so the omission is visible: **hair** (3.5/3.6/6.6),
 * **the wardrobe** (Phase 9) and **identity detail targets** (Phase 10). All three are opt-in on
 * `alive.js` for reasons that still hold — the wardrobe has fragments for one bake only, the groom
 * moves every committed number in the repository, and 10.7/10.9 are open so eyes and skeleton do
 * not follow the skin. Adding them here would be publishing four subsystems through a one-call API
 * on the strength of a wiring nobody has judged. They are `Avatar`'s next options, not its first.
 *
 * ⚠️ THIS FILE DOES NOT IMPORT FROM `packages/testbed`, EVER. `core` must not depend on the
 * testbed. Where a helper was needed it was READ and reimplemented here, and every constant lifted
 * across carries the line in `alive.js` that recorded the measurement which chose it. A parity gate
 * (`Avatar.selftest.mjs`, not this file) asserts the two wirings agree; two wirings are a liability
 * and a gate on their agreement is what keeps the liability visible instead of latent.
 */

import { Box3, SRGBColorSpace } from 'three';
import {
    Color,
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
import { Identity } from './figure/Identity.js';
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
import { HandIdle } from './motion/HandIdle.js';
import { IdleMotion } from './motion/IdleMotion.js';
import { MotionStack, createMotionTarget } from './motion/MotionStack.js';
import { Pupil } from './motion/Pupil.js';
import { Sway } from './motion/Sway.js';

import { Grade, TEMPORAL_RECOVERY_SHARPNESS } from './render/Grade.js';
import { GroundContact } from './render/GroundContact.js';
import { GTAO_SHIPPING_QUALITY, createGroundTruthOcclusion } from './render/GTAO.js';
import { LightingRig } from './render/LightingRig.js';
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
    bakedMapBaseUrl: null
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

        const avatar = new Avatar( {
            canvas,
            requestedQuality,
            frameMode,
            seed,
            identity: new Identity( options.identity ?? AVATAR_DEFAULTS.identity ),
            affectEnabled: options.affect ?? AVATAR_DEFAULTS.affect,
            autoStart: options.autoStart ?? AVATAR_DEFAULTS.autoStart,
            poseName: options.pose === undefined ? AVATAR_DEFAULTS.pose : options.pose,
            assetBaseUrl: options.assetBaseUrl ?? AVATAR_DEFAULTS.assetBaseUrl,
            bakedMapBaseUrl: options.bakedMapBaseUrl ?? AVATAR_DEFAULTS.bakedMapBaseUrl,
            heightOverride: Number.isFinite( options.framedHeightMetres ) ? options.framedHeightMetres : null
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
        this.tier = await resolveTier( this.requestedQuality, this.stage );
        this.tierSettings = QUALITY_TIERS[ this.tier ];

        const occlusionEnabled = this.tierSettings.occlusion;
        const wantsGrade = this.tierSettings.grade;
        const temporalAA = this.tierSettings.temporalAA;

        // STEP 2 — the pipeline is asked for explicitly. Grade and GTAO both need the deferred path
        // and neither implies it inside `Stage`; temporal AA does imply it, and asking anyway is
        // one term rather than a dependency a reader has to know.
        await this.stage.create( this.canvas, {
            fieldOfView: PORTRAIT_FIELD_OF_VIEW_DEGREES,
            near: 0.01,
            far: 50,
            antialias: this.tierSettings.antialias,
            temporalAA,
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

        this.stage.scene.background = new Color( 0x08080a );
        this.backdrop = buildBackdrop( this.stage );

        // STEP 4 — `attachTo` is where the linearly-transformed-cosine tables are installed. Without
        // them every RectAreaLight contributes nothing and the figure renders black, which looks
        // exactly like a broken material.
        this.lights = new LightingRig( {
            preset: this.frameMode,
            shadows: this.tierSettings.shadows,
            ambient: this.tierSettings.occlusion === false
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
        this.ground = new GroundContact( { occlusion: true } );
        this.ground.attachTo( this.stage.scene );

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
     * exactly like a tuning problem rather than like a bug. `PostureLayer.update()` takes no
     * arguments and never advances it (`PostureLayer.js:184-188`), so adding the body half cannot
     * introduce a second owner.
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
                clockSeconds: this.clockSeconds
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

        this.ground.update();

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

        if ( outcome !== 'finished' ) this.viseme?.stop();

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

        aimRigAt( this.lights, this.eyes, focus, this.framedHeightMetres, this.stage );

        // The card is emissive, so distance costs it nothing; at 8 x 6 m it still fills a full-body
        // frame from 1.9 m behind the subject.
        this.backdrop.position.set( focus.x, focus.y, focus.z - BACKDROP_DISTANCE_METRES );

        const unfitted = this.ground.fitTo( figure.root );

        if ( unfitted.length > 0 ) {

            console.warn( `Avatar: ground contact — this figure has no ${ unfitted.join( ', ' ) }.` );

        }

        this.ground.sizeTo( { focus, subjectHeightMetres: this.framedHeightMetres } );

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
 * @param {string} requested - One of `QUALITY_REQUESTS`.
 * @param {Stage} stage - Asked only for `isWebGPUAvailable()`; not yet created.
 * @returns {Promise<string>} a key of `QUALITY_TIERS`.
 */
export async function resolveTier( requested, stage ) {

    if ( requested !== 'auto' ) return requested;

    if ( stage.isWebGPUAvailable() === false ) return 'fallback';

    try {

        const adapter = await navigator.gpu.requestAdapter();

        return adapter === null || adapter === undefined ? 'fallback' : 'high';

    } catch ( error ) {

        console.warn( `Avatar: requesting a WebGPU adapter threw (${ error.message }), so the ` +
            "'fallback' tier is what this machine gets. Pass an explicit `quality` to override." );

        return 'fallback';

    }

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
function buildBackdrop( stage ) {

    const material = new MeshStandardNodeMaterial( {
        color: 0x000000,
        emissive: BACKDROP_EMISSIVE,
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
