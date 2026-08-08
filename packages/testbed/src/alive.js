/**
 * alive — the Phase 2 acceptance page.
 *
 * The gate this page exists to answer is subjective and it is stated in one line:
 * *does the figure read as alive when it is silent and unshaded?* Everything here serves
 * being able to LOOK at that honestly.
 *
 *   - The figure is lit by `render/LightingRig.js` — the same four RectAreaLights the look spec
 *     asks for, but authored as IRRADIANCE AT THE FOCUS rather than as raw `intensity`, which is
 *     what makes key:fill a design decision instead of an accident of panel geometry. This page
 *     used to carry its own inline rig; two of that rig's own comments were measurably wrong (the
 *     four typed intensities did not express a ratio at all — the fill panel subtends 2.485× the
 *     key's solid angle — and the full-body rim measured 1 px of band, i.e. none). Four lights is
 *     still the measured budget: 0.265 ms + 0.618 ms per Mpx lit, per light, 3.6 ms at 1080p.
 *     Exactly one of them — the key — carries a co-located shadow-casting SpotLight, because a
 *     shadow pass measures 2.62 ms and four of them would cost 77% of the frame.
 *
 *   - The body wears `material/SkinMaterial.js` (punch-list 3.2) and the two eye shells wear
 *     `material/EyeMaterial.js` (3.3/3.4). Before this they were the raw GLB materials, and a
 *     glaring white sclera is on the punch list's standing-constraints list as explicitly wrong.
 *     ?skin=0 and ?eyes=0 put the shipped GLB materials back, which is the A side of every
 *     comparison a judge is asked to make about the shading.
 *
 *   - It is framed as a portrait: crown to mid-chest, 30° FOV, camera at eye level and 12° off
 *     axis. That framing is not decoration. Blink and gaze are only readable when the eyes are
 *     large in frame, and breath is a 2–3 mm chest excursion, so the chest has to be in frame too.
 *
 *   - The figure stands in a REST POSE before anything animates it. The bind pose is not a
 *     posture — on this asset the upper arms stand 41.8° out from vertical with the forearms
 *     swung forward — and no amount of micro-motion rescues a mannequin silhouette. The pose is
 *     applied before the stack binds, so every layer's delta is a deviation from a person
 *     standing rather than from a T-pose.
 *
 *   - The full idle stack runs: breath, sway, body idle (arms, hands, fingers, trunk), head idle,
 *     gaze (eyes and head), blink, facial idle (brow, lids, cheeks, mouth, jaw), pupil. Every one
 *     of them is a contributor to a MotionStack, which is the only thing that writes to the figure.
 *
 *   - A strip chart plots what is moving. Millimetre-scale motion looks identical to no motion in
 *     a still frame, so a screenshot without the trace cannot distinguish "breathing" from
 *     "frozen". The trace is how a still frame carries evidence.
 *
 * The controls are the four dials an affect system will eventually drive: arousal (breath rate and
 * depth, pupil), cognitive load and attention (blink rate), conversation state (gaze policy), and
 * the gender axis of Identity, which reloads a different bake.
 *
 * URL parameters, for reproducible captures:
 *
 *   ?webgl          force the WebGL2 fallback tier
 *   ?gender=0.75    start on a different bake
 *   ?preroll=6      advance the stack 6 s in fixed 1/60 steps before the first drawn frame, so a
 *                   captured frame is reproducible from the seed rather than from luck
 *   ?freeze         stop advancing after the pre-roll — a still pose at a known motion time
 *   ?seed=20260807  the motion stack's root seed
 *   ?trace=0        hide the strip chart
 *   ?bare           hide every overlay — controls, HUD, strip chart — for a clean plate. A critic
 *                   comparing this against a reference still wants pixels, not instrumentation.
 *   ?frame=body     frame the whole figure instead of a head-and-shoulders portrait
 *   ?height=0.18    override the framed height in metres. 0.18 is an eyes-only crop.
 *   ?pose=weight-left   which RestPose to stand in. `?pose=bind` shows the untouched bind pose,
 *                   which is the A side of the comparison the rest pose exists to win.
 *   ?arousal=0.8    starting value of a dial, so a capture can ask for a state rather than
 *                   needing a human to drag a slider. Same for ?load and ?attention.
 *   ?capture        stop the frame loop and hand the clock to `window.__SUGATA_STEP__`, so
 *                   tools/critic/capture.mjs can drive the page one fixed step at a time.
 *   ?skin=0         body keeps the shipped GLB material — the control for punch-list 3.2
 *   ?eyes=0         eye shells keep their shipped GLB materials — the control for 3.3/3.4
 *   ?cards=0        eyelash and eyebrow cards keep the shipped GLB material — the control for the
 *                   card shading, and the plate that proves gate G7 goes red
 *   ?msaa=0         build the stage without MSAA. Alpha to coverage needs it, so this is also the
 *                   A side of the card anti-aliasing.
 *   ?shadows=0      build the rig without its shadow-casting half (2.62 ms, measured)
 *   ?ov=rim.irradiance:0,kicker.irradiance:0
 *                   override LightingRig placement fields, same syntax as lighting.html. One
 *                   plate per light is how a colour cast gets attributed to a light rather than
 *                   guessed at.
 */

import {
    Color,
    Mesh,
    MeshPhysicalNodeMaterial,
    MeshStandardNodeMaterial,
    PlaneGeometry,
    Vector3
} from 'three/webgpu';
import { Box3 } from 'three';

import { Stage } from '../../core/src/render/Stage.js';
import { LightingRig } from '../../core/src/render/LightingRig.js';
import { EyeMaterial } from '../../core/src/material/EyeMaterial.js';
import { buildEyeOcclusion } from '../../core/src/material/EyeOcclusion.js';
import {
    applySkinMaterial,
    createSkinMaterial,
    curvatureMapUrlFor
} from '../../core/src/material/SkinMaterial.js';
import { Figure } from '../../core/src/figure/Figure.js';
import { Identity } from '../../core/src/figure/Identity.js';
import { RestPose } from '../../core/src/figure/RestPose.js';
import { Skeleton } from '../../core/src/figure/Skeleton.js';
import { MotionStack, createMotionTarget } from '../../core/src/motion/MotionStack.js';
import { Blink } from '../../core/src/motion/Blink.js';
import { BodyIdle } from '../../core/src/motion/BodyIdle.js';
import { Breath } from '../../core/src/motion/Breath.js';
import { FacialIdle } from '../../core/src/motion/FacialIdle.js';
import { Gaze } from '../../core/src/motion/Gaze.js';
import { HandIdle } from '../../core/src/motion/HandIdle.js';
import { IdleMotion } from '../../core/src/motion/IdleMotion.js';
import { Pupil } from '../../core/src/motion/Pupil.js';
import { Sway } from '../../core/src/motion/Sway.js';

// --- framing ---------------------------------------------------------------------------------

// 24–40° is the portrait range. 26° puts the camera ~1.1 m out, which is long enough that the
// nose does not balloon the way a 40° lens at half a metre would.
const PORTRAIT_FIELD_OF_VIEW_DEGREES = 26;

// Vertical extent of the frame, in metres: a little above the crown down to the top of the chest.
// Wide enough that the sternum is in shot — breath is 2–3 mm of chest and has to be *in frame* —
// tight enough that an eyelid is dozens of pixels tall, which is what blink needs.
const PORTRAIT_HEIGHT_METRES = 0.42;

// Where the eye line sits in the frame, measured from the top. A third is the portrait rule, and
// anchoring on the eyes rather than on the crown is what makes a tighter crop still land on the
// face instead of climbing up the forehead.
const EYE_LINE_FROM_TOP = 1 / 3;

// How far off the facing axis the camera stands. Dead-on is flatter and reads as a mugshot; 12°
// gives the cheek and jaw some form without turning the eyes away from the viewer.
const CAMERA_AZIMUTH_DEGREES = 12;

// The mesh the eye line is read off. MakeHuman names its eyeball proxy for its topology rather
// than its anatomy, and GLTFLoader strips the dot, so 'Human.high-poly' arrives as
// 'Humanhigh-poly'. Matched by pattern rather than by an exact string on purpose: this used to be
// the literal 'Humanlow-poly', and when the pipeline swapped proxies the lookup returned undefined
// and eyeLineHeight quietly fell back to a guess. A miss now says so out loud.
const EYEBALL_MESH_PATTERN = /high-poly|low-poly|eyeball/i;

// How much air to leave around the figure in the full-body frame, as a fraction of its height.
// A body cropped hard at crown and heel reads as a passport photo of a corpse; a little headroom
// is what lets the eye see the silhouette, which is the whole point of looking at a rest pose.
const BODY_FRAME_MARGIN = 1.10;

// The posture the figure stands in when no URL says otherwise.
const DEFAULT_REST_POSE = 'relaxed-standing';

// --- the backdrop ----------------------------------------------------------------------------

/**
 * The backdrop. The look spec wants it 1.5–2.0 stops below the subject, cooler and desaturated —
 * a black void is as wrong as a blown one, because the silhouette then has nothing to separate
 * from and the head reads as a cut-out.
 *
 * Its base colour is BLACK and its emissive carries the whole value, so the card states its own
 * exposure and the rig cannot touch it. That is deliberate, and the reason recorded here before
 * was wrong in a way worth correcting: it said a RectAreaLight behind the figure "throws its light
 * forward, away from anything further back", so lighting a card would need a fifth light. The key
 * and the fill do point at the card and would light it perfectly well. The real obstacle, isolated
 * by execution on the lighting browsercheck, is that a RectAreaLight illuminates only the
 * half-space in FRONT OF ITS OWN PLANE, with a hard cut at the plane — on a curved subject that
 * boundary is invisible, but across a large flat card behind the figure the rim and kicker draw a
 * straight-edged wedge. Rim and kicker at zero give a clean backdrop; rim and kicker alone give
 * black plus one hard wedge. A black-albedo emissive card cannot show that seam at all, which is
 * why this one stays as it is rather than becoming a lit surface with the arrival of 3.8.
 */
const BACKDROP_EMISSIVE = 0x11151f;
const BACKDROP_DISTANCE_METRES = 1.9;

const FIXED_STEP_SECONDS = 1 / 60;

// --- boot ---------------------------------------------------------------------------------

async function boot() {

    const query = new URLSearchParams( window.location.search );
    const hud = document.getElementById( 'hud' );

    // MSAA is ON here, which is a departure from Stage's default and is load-bearing rather than
    // cosmetic: the eyelash and eyebrow cards are alpha-to-coverage, and alpha to coverage on a
    // single-sampled target silently degrades to the same binary cut it replaced. `?msaa=0` is the
    // A side, and `applyCardShading` is told which it got so the two can never disagree.
    // Stage's own note says to leave MSAA off "once TRAA is in the pipeline"; punch-list 3.12 is
    // open and blocked on the morph-velocity defect, so there is nothing else anti-aliasing this
    // page. Measured: with and without MSAA the page is vsync-pinned at p50 16.7 ms and p95
    // 18.4–18.7 ms at BOTH 1920x1080 and 3840x2160, i.e. it does not come off 60 Hz on this
    // hardware. That is a headroom statement, not a cost in milliseconds — the instrument cannot
    // resolve the delta while the frame is vsync-locked, and it is recorded as the weaker claim.
    const multisampled = query.get( 'msaa' ) !== '0';

    const stage = new Stage();
    await stage.create( document.getElementById( 'stage' ), {
        fieldOfView: PORTRAIT_FIELD_OF_VIEW_DEGREES,
        near: 0.01,
        far: 50,
        forceWebGL: query.has( 'webgl' ),
        antialias: multisampled
    } );

    stage.scene.background = new Color( 0x08080a );

    // The linearly-transformed-cosine tables every RectAreaLight needs before first use are
    // installed by LightingRig.attachTo(); without them the lights contribute nothing at all and
    // the figure renders black, which looks exactly like a broken material.

    const bare = query.has( 'bare' );

    if ( bare ) {

        for ( const id of [ 'controls', 'hud', 'trace' ] ) {

            document.getElementById( id ).style.display = 'none';

        }

    }

    const backdrop = buildBackdrop( stage );

    const poseName = query.get( 'pose' ) ?? DEFAULT_REST_POSE;

    // Everything that changes when the gender dial moves lives in one place, so the reload path
    // has exactly one object to swap and the frame loop has exactly one thing to null-check.
    const session = {
        identity: new Identity( { gender: Number( query.get( 'gender' ) ?? 0.5 ) } ),
        figure: null,
        skeleton: null,
        target: null,
        loadToken: 0,
        // 'bind' is not a pose file, it is the absence of one: the untouched asset, which is the
        // A side of the comparison RestPose exists to win.
        restPose: poseName === 'bind' ? null : RestPose.load( poseName ),
        frameMode: query.get( 'frame' ) === 'body' ? 'body' : 'portrait',
        heightOverride: query.has( 'height' ) ? Number( query.get( 'height' ) ) : null,
        framedHeightMetres: PORTRAIT_HEIGHT_METRES,

        // The shading. Both are rebuilt per bake, because every constant in them is measured off
        // the mesh that is actually loaded: EyeMaterial fits the sclera sphere, the corneal axis
        // and the iris plane at construction, and the curvature map is baked per figure.
        skinEnabled: query.get( 'skin' ) !== '0',
        eyesEnabled: query.get( 'eyes' ) !== '0',
        cardsEnabled: query.get( 'cards' ) !== '0',
        multisampled,
        skin: null,
        eyes: null,
        eyeOcclusion: null,
        cards: []
    };

    // The rig is preset per framing, not scaled from one. The portrait rim azimuth measures 1 px
    // of band on a full-body thigh — no band at all — which is the open lead PROGRESS.md records
    // as "rim and kicker stop reading at body scale".
    const lights = new LightingRig( {
        preset: session.frameMode,
        shadows: query.get( 'shadows' ) !== '0',
        overrides: parseLightOverrides( query.get( 'ov' ) )
    } );

    lights.attachTo( stage.scene, stage.renderer );

    const stack = new MotionStack( { seed: Number( query.get( 'seed' ) ?? 20260807 ) } );

    const breath = new Breath();
    const bodyIdle = new BodyIdle();

    // The fingers were the one part of the body a judge could see was frozen: BodyIdle's finger
    // idle moves an index fingertip 0.73 mm over seven minutes — 0.48 px at full-body framing,
    // against the 1.6 px this project already has on record as indistinguishable. HandIdle
    // re-roots the amplitude as a fraction of each joint's own measured resting flexion and takes
    // the finger channel off BodyIdle on its first frame, handing it back on dispose.
    const handIdle = new HandIdle();

    // Sway measures the weight shift; the arms answer it with one small decaying swing instead of
    // drifting on obliviously while the pelvis moves. The callback carries the drawn amplitude, so
    // a big shift gets a big swing — which is the whole reason the arms are worth coupling.
    const sway = new Sway( { onWeightShift: ( shift ) => bodyIdle.onWeightShift( shift ) } );

    // 'auto' is IdleMotion's own answer to the arm-doubling problem: it declares the six arm bones
    // and so does BodyIdle, and bone contributions SUM. With a layer named 'bodyIdle' in the stack
    // it stands down to the head alone, which is the split this page wants.
    const idle = new IdleMotion( { armsEnabled: 'auto' } );

    const gaze = new Gaze( { partnerYawDegrees: CAMERA_AZIMUTH_DEGREES } );
    const blink = new Blink();
    const facialIdle = new FacialIdle();
    const pupil = new Pupil();

    // The eye layer and the head layer are two members of one pair, added separately because they
    // sit in different slots — HEAD runs before GAZE so the eyes can counter-rotate against the
    // head position this frame actually landed on. FacialIdle comes after Blink for the same kind
    // of reason: it reads this frame's lid closure to know how much lid-follow is left to give.
    const layers = {
        breath, sway, idle, bodyIdle, handIdle, gazeHead: gaze.head, gaze, blink, facialIdle, pupil
    };

    await swapFigure( session, stack, stage, lights, backdrop );

    for ( const layer of Object.values( layers ) ) stack.add( layer );

    // Pupil dilation lands on the eye shader's own uniform. Written through a sink rather than
    // through `pupil.driveUniform` on purpose: the gender dial rebuilds `session.eyes`, and
    // `driveUniform` appends to a list with no way to remove an entry, so every swap would leave
    // a dead uniform being written for the rest of the session. One sink, added once, reads
    // whichever eye material is current.
    let pupilScale = 1;
    pupil.addSink( ( scale ) => {

        pupilScale = scale;
        if ( session.eyes !== null ) session.eyes.pupilScaleUniform.value = scale;

    } );

    const trace = createTrace( document.getElementById( 'trace' ) );
    if ( bare || query.get( 'trace' ) === '0' ) trace.setVisible( false );

    // A capture has to be able to ask for a state — "the same twenty seconds, but aroused" — and
    // a slider only a human can drag makes that impossible. Written to the input rather than to
    // the layer so the control and the figure cannot disagree about what the value is.
    for ( const id of [ 'arousal', 'load', 'attention' ] ) {

        if ( query.has( id ) ) document.getElementById( id ).value = query.get( id );

    }

    bindControls( { session, stack, stage, lights, backdrop, layers } );
    bindKeyboard( { blink, trace } );

    const samplers = { head: createHeadSampler( session ), hand: createHandSampler( session ) };

    /**
     * One simulated frame: advance the stack and record what moved. Every clock the page has —
     * pre-roll, rAF, the capture hook — comes through here, so a capture and a live run cannot
     * drift into being different simulations.
     */
    const advanceSimulation = ( deltaSeconds ) => {

        stack.update( deltaSeconds );

        // The eye frame is rebuilt from the head bone's WORLD matrix and from this frame's
        // eyeLook* morph weights, so it has to run after the stack has committed both — and after
        // the world matrices have been brought up to date. The renderer would do that itself, but
        // only during render(), which is one frame too late: read there, the eye would look where
        // the head was last frame. A 7-mesh, 53-bone subtree costs nothing to walk.
        if ( session.eyes !== null ) {

            session.figure.root.updateMatrixWorld( true );
            session.eyes.update();

        }

        trace.push( deltaSeconds, sampleSignals( stack, layers, samplers ) );

    };

    // A pre-roll is the difference between a screenshot that means something and one that does
    // not: it puts the stack at a known motion time, and it fills the strip chart, so a single
    // captured frame carries the history that a 240 ms blink lives in.
    const prerollSeconds = Number( query.get( 'preroll' ) ?? 0 );
    const frozen = query.has( 'freeze' );

    for ( let step = 0; step < Math.round( prerollSeconds / FIXED_STEP_SECONDS ); step ++ ) {

        advanceSimulation( FIXED_STEP_SECONDS );

    }

    stage.onFrame( ( deltaSeconds ) => {

        if ( session.figure === null ) return;   // a bake is being swapped in

        if ( frozen === false ) advanceSimulation( deltaSeconds );

        if ( bare ) return;

        trace.draw();
        hud.textContent = describeState( stage, stack, layers, session, pupilScale );

    } );

    // --- the deterministic capture hook -------------------------------------------------------
    //
    // Aliveness is a temporal property, and a still frame cannot carry it. Under ?capture the
    // renderer's own frame loop is stopped and tools/critic/capture.mjs becomes the clock: it
    // calls __SUGATA_STEP__(1/fps), reads the pixels back, and repeats. Simulation time stops
    // depending on wall-clock time altogether, so a capture is exactly as long as it claims and
    // a seeded run reproduces frame for frame regardless of machine, load or thermal state.
    const advanceRendererFrame = query.has( 'capture' ) ? takeOverFrameLoop( stage.renderer ) : null;

    /**
     * Advances the motion stack by exactly `deltaSeconds`, draws one frame, and resolves once
     * the GPU has finished it — so the caller may read the canvas back immediately.
     *
     * The await is the whole point of the return value being a promise. `render()` only submits
     * work; the screenshot that follows is a separate process asking the compositor for the
     * canvas, and without a barrier it sometimes wins that race and gets the PREVIOUS frame.
     * On millimetre-scale idle motion that mis-capture is invisible — a fraction of a percent of
     * pixels along lash and lid edges — which is exactly why it has to be closed here rather
     * than eyeballed later.
     *
     * @param {number} deltaSeconds - fixed simulation step, e.g. 1/30.
     * @returns {Promise<boolean>} false while a bake is still loading, so the caller can retry.
     */
    window.__SUGATA_STEP__ = async ( deltaSeconds ) => {

        if ( session.figure === null ) return false;

        advanceSimulation( deltaSeconds );

        if ( bare === false ) {

            trace.draw();
            hud.textContent = describeState( stage, stack, layers, session, pupilScale );

        }

        // The renderer's per-frame internal tick, which normally rides on rAF. Skinning is
        // updated here, so skipping it renders a live simulation onto a frozen pose — see
        // takeOverFrameLoop() for what that looked like when it was missed.
        advanceRendererFrame?.( deltaSeconds );

        stage.renderer.render( stage.scene, stage.camera );

        // Barrier one: the GPU has finished the frame. WebGL2 has no equivalent, so the fallback
        // tier keeps the race — capture.mjs reports the backend, and a WebGL2 capture is a
        // degraded artefact for other reasons anyway.
        await stage.renderer.backend?.device?.queue?.onSubmittedWorkDone();

        // Barrier two: the compositor has painted it. The screenshot arrives out of band, from
        // another process asking the compositor for the canvas — so GPU-done is not enough on
        // its own, and two paints are what make "the pixels the caller reads" the frame we just
        // drew rather than the one before it.
        await nextPaint();

        return true;

    };

    // Handy for poking at any of it from the console. `frame( 0.16 )` pushes in until the frame is
    // 160 mm tall, which is the only way to inspect an eyelid roll closely without a second page;
    // `frame( 1.9, 'body' )` pulls back to the whole figure.
    window.sugata = {
        stage,
        stack,
        layers,
        session,
        lights,
        frame: ( heightMetres, mode = session.frameMode ) => {

            const framed = frameFigure( stage, session.figure, { mode, heightMetres } );

            lights.setPreset( mode === 'body' ? 'body' : 'portrait' );
            aimRigAt( lights, session, framed.focus, heightMetres, stage );

        }
    };

}

/**
 * Resolves after the browser has painted, which takes two animation frames: the first callback
 * runs *before* the paint it was scheduled for, the second only after that paint has happened.
 *
 * This is the one place capture still depends on rAF, and it is a barrier rather than a clock —
 * so a throttled tab makes a capture slow, never wrong. Measured in Playwright's headless
 * Chromium, rAF runs at 120 Hz and this costs about 16 ms a frame against the ~50 ms a
 * screenshot already takes.
 */
function nextPaint() {

    return new Promise( ( resolve ) => {

        requestAnimationFrame( () => requestAnimationFrame( resolve ) );

    } );

}

/**
 * Takes the renderer's per-frame tick away from requestAnimationFrame so a capture can drive it.
 *
 * Two things have to happen together, and doing either one alone is a trap:
 *
 *   1. STOP the rAF chain. `setAnimationLoop( null )` is the public way and it is not enough —
 *      it only clears the user callback, while three's internal Animation keeps requesting
 *      frames and keeps calling `nodeFrame.update()` on each one. Whether one of those lands
 *      between two capture steps depends on how many ticks the browser fitted in, which is
 *      wall-clock time leaking back in through the side door. Measured: two runs of the same
 *      seed diverged at frame 54 of 600, along lash and lid edges.
 *
 *   2. DRIVE that tick yourself, once per captured frame. `nodeFrame.update()` is where skinning
 *      is refreshed. Stopping the chain without replacing it renders a live simulation onto a
 *      pose frozen near rest — and the failure is quiet and deeply convincing: the eyes still
 *      blink (morphs update elsewhere), the strip chart still moves, the head just never turns.
 *      It measured as *perfectly* reproducible, because a still image always is.
 *
 * Both `_animation` and `_nodes` are private, so this reaches into the renderer and says so. If
 * an upgrade renames either, capture falls back to leaving rAF running: correct pictures, no
 * bit-exactness, and a console line saying which — never the frozen-pose failure, which is the
 * one that would look fine and be worthless.
 *
 * @returns {?Function} call once per frame before rendering, or null if rAF was left running.
 */
function takeOverFrameLoop( renderer ) {

    const nodeFrame = renderer._nodes?.nodeFrame;

    if ( typeof renderer._animation?.stop === 'function' && typeof nodeFrame?.update === 'function' ) {

        renderer._animation.stop();

        let elapsedSeconds = 0;

        return ( deltaSeconds ) => {

            nodeFrame.update();

            // ...and then overwrite the clock it just read. `NodeFrame.update()` derives its own
            // time and deltaTime from `performance.now()`, which is the last place wall-clock
            // time hides: any node that animates from them would drift with machine load. Pin
            // both to the simulation's fixed step so the renderer shares the capture's clock.
            elapsedSeconds += deltaSeconds;
            nodeFrame.deltaTime = deltaSeconds;
            nodeFrame.time = elapsedSeconds;

        };

    }

    console.warn(
        'capture: could not reach renderer._animation / _nodes.nodeFrame, so the rAF chain is ' +
        'still running. Frames are correct but not bit-reproducible — see takeOverFrameLoop().'
    );

    return null;

}

/**
 * Aims the rig at the shot, and hands the eye shader the key's direction.
 *
 * `aimAt` wants the framed height rather than the figure's stature — a 0.42 m portrait crop and a
 * 1.87 m full-body frame are different shots of the same person and want different rigs — and it
 * wants the camera, because every placement azimuth is measured from the camera direction rather
 * than from the world axes. That is what makes the same key:fill hold at both framings.
 *
 * The eye's analytic iris caustic is computed against one key direction, and its default is the
 * inline rig this page used to carry. Left unset it would light the iris from a key that is no
 * longer there.
 */
function aimRigAt( lights, session, focus, framedHeightMetres, stage ) {

    lights.aimAt( { focus, subjectHeightMetres: framedHeightMetres, cameraPosition: stage.camera.position } );

    if ( session.eyes === null ) return;

    const key = lights.units.find( ( unit ) => unit.placement.name === 'key' );
    if ( key === undefined ) return;

    session.eyes.keyLightDirectionUniform.value
        .copy( key.area.position )
        .sub( focus )
        .normalize();

}

/**
 * `?ov=rim.irradiance:0,kicker.irradiance:0` — arbitrary rig overrides from the URL.
 *
 * `packages/testbed/src/lighting.html` has had this since 3.8, and the integrated page did not,
 * which meant no light on THIS page could be subtracted and looked at. That gap is what let the
 * blue eyelash cards sit in PROGRESS as an unattributed "violet cast" for two rounds: attributing
 * a colour to one of four lights takes one plate per light, and there was no way to ask for one.
 *
 * The syntax is deliberately identical to lighting.html's so a sweep transfers between the two
 * pages unchanged. Kept as its own small parser rather than imported from the other page: a
 * browsercheck importing another browsercheck's internals couples two things that are meant to be
 * independently readable.
 *
 * @param {?string} spec - e.g. `key.elevationDegrees:34,rim.irradiance:9`
 * @returns {Object} per-light field overrides, keyed by light name.
 */
function parseLightOverrides( spec ) {

    if ( spec === null || spec === '' ) return {};

    const overrides = {};

    for ( const clause of spec.split( ',' ) ) {

        const [ path, value ] = clause.split( ':' );
        const [ light, field ] = path.split( '.' );

        overrides[ light ] = { ...( overrides[ light ] ?? {} ), [ field ]: Number( value ) };

    }

    return overrides;

}

function buildBackdrop( stage ) {

    const material = new MeshStandardNodeMaterial( {
        color: 0x000000,
        emissive: BACKDROP_EMISSIVE,
        emissiveIntensity: 1,
        roughness: 1,
        metalness: 0
    } );

    const backdrop = new Mesh( new PlaneGeometry( 8, 6 ), material );
    stage.add( backdrop );

    return backdrop;

}

/**
 * Loads the bake the current identity resolves to, puts it in the scene in place of whatever was
 * there, and rebinds the motion stack to it.
 *
 * Rebinding rather than resetting is deliberate: the stack re-snapshots the new figure's rest pose
 * and every layer's `onBind` runs again, but the layers keep their phase, so breath does not jump
 * back to end-expiration and the figure does not visibly restart when the dial moves.
 */
async function swapFigure( session, stack, stage, lights, backdrop ) {

    const plan = await session.identity.resolve();
    const token = ++ session.loadToken;

    const figure = await Figure.load( plan.figures[ 0 ].url );

    // A fast slider drag starts several loads; only the newest may land.
    if ( token !== session.loadToken ) {

        figure.dispose();
        return;

    }

    // The skin material is built BEFORE the old figure comes out of the scene, because building it
    // fetches this bake's own baked curvature map and a fetch is another chance for a newer load
    // to overtake this one. Doing it here means the page never shows a gap.
    const skin = session.skinEnabled
        ? await createSkinMaterial( {
            albedoMap: figure.body.material.map ?? null,
            curvatureMapUrl: curvatureMapUrlFor( bakeNameFrom( plan.figures[ 0 ].url ) )
        } )
        : null;

    if ( token !== session.loadToken ) {

        skin?.dispose();
        figure.dispose();
        return;

    }

    disposeShading( session );

    if ( session.figure !== null ) {

        stage.scene.remove( session.figure.root );
        session.figure.dispose();

    }

    stage.add( figure.root );
    figure.root.updateMatrixWorld( true );

    // The rest pose goes on BEFORE the stack binds, and the order is the whole trick. MotionStack
    // snapshots rest from whatever pose the bones are in at bind time, and every layer composes
    // its delta onto that snapshot. Pose first and the arms micro-move about a body standing at
    // ease; pose after and they micro-move about a T-pose while the figure visibly snaps.
    const skeleton = new Skeleton( figure.root );

    if ( session.restPose !== null ) {

        const absent = session.restPose.applyTo( skeleton );
        if ( absent.length > 0 ) console.warn( `rest pose '${ session.restPose.name }': this figure has no ${ absent.join( ', ' ) }` );

        skeleton.update();
        figure.root.updateMatrixWorld( true );

    }

    session.figure = figure;
    session.skeleton = skeleton;
    session.target = createMotionTarget( figure.root );

    applyShading( session, skin );

    stack.bind( session.target );

    // Measured after posing, because the pose changes the figure's height by centimetres.
    session.framedHeightMetres = framedHeightFor( figure, session.frameMode, session.heightOverride );

    const { focus } = frameFigure( stage, figure, {
        mode: session.frameMode,
        heightMetres: session.framedHeightMetres
    } );

    aimRigAt( lights, session, focus, session.framedHeightMetres, stage );

    // The card does not move with the rig. It is emissive, so distance costs it nothing, and at
    // 8 x 6 m it still fills a full-body frame from 1.9 m behind the subject.
    backdrop.position.set( focus.x, focus.y, focus.z - BACKDROP_DISTANCE_METRES );

}

/** The bake's own name — `figure_g050` — which is what the curvature map is keyed on. */
function bakeNameFrom( url ) {

    return url.slice( url.lastIndexOf( '/' ) + 1 ).replace( '.glb', '' );

}

/**
 * Puts the two Phase 3 materials on the figure that has just landed.
 *
 * Both are per-bake and neither is cheap to rebuild, which is why they live on `session` rather
 * than being constructed once at boot: `EyeMaterial` fits the sclera sphere, the corneal axis, the
 * iris plane and the eight gaze rotations off the mesh in front of it, and the curvature map is a
 * different PNG per figure. A material built against g050 and left on g100 would be describing a
 * different eye.
 *
 * ⚠️ `markAsSkin` is deliberately NOT called. It writes `material.mrtNode`, and a material
 * carrying one cannot be forward-rendered — `NodeMaterial.setup` uses it alone against the
 * unnamed intermediate target every tone-mapped canvas frame allocates, emits an empty WGSL
 * output struct, and the object silently stops drawing (LEARNINGS Part 2, GBuffer.js). This page
 * is on the forward path: `stage.create` is called without `pipeline: true`, because the deferred
 * G-buffer would change the render path every Phase 2 motion number was measured against, and
 * nothing here consumes a G-buffer channel yet.
 *
 * Shadows are switched on per mesh here rather than at load, because the rig's shadow half is the
 * only thing that wants them and a figure with `castShadow` false produces a perfectly configured
 * shadow map of nothing at all.
 */
function applyShading( session, skin ) {

    const figure = session.figure;

    figure.root.traverse( ( object ) => {

        if ( object.isMesh !== true ) return;
        object.castShadow = true;
        object.receiveShadow = true;

    } );

    if ( skin !== null ) {

        applySkinMaterial( figure, skin );
        session.skin = skin;

    }

    if ( session.cardsEnabled ) session.cards = applyCardShading( figure, session.multisampled );

    if ( session.eyesEnabled === false ) return;

    // Not fatal if it throws: a figure built with the superseded single-shell eye proxy has no
    // corneal dome to refract through, and the page is more useful reporting that in the console
    // and rendering the GLB's own eye than it is refusing to boot.
    try {

        const eyes = new EyeMaterial( { figure } );
        eyes.attach();

        session.eyes = eyes;
        session.eyeOcclusion = buildEyeOcclusion( { figure, geometry: eyes.geometry } );

    } catch ( error ) {

        console.warn( `eye material not applied: ${ error.message }` );

    }

}

/**
 * The alpha value below which a card texel is sheet background rather than painted fibre.
 *
 * Not a taste setting — read off the two card textures' own alpha histograms, measured on
 * `figure_g050.glb`'s embedded PNGs at 512x512:
 *
 *   | texture      | texels in alpha 0.0–0.1 | of 262,144 |
 *   |--------------|------------------------:|-----------:|
 *   | eyelashes01  |                 225,416 |      86.0% |
 *   | eyebrow001   |                 236,954 |      90.4% |
 *
 * Everything above that first decile is painted. glTF `alphaMode: MASK` defaults `alphaCutoff` to
 * 0.5, which throws away the whole soft ramp between 0.1 and 0.5 — 15,368 eyelash texels and
 * 20,262 eyebrow texels, i.e. most of the brow's density and every lash tip. That is where the
 * "visible holes in the brow" came from.
 *
 * With alpha-to-coverage doing the in/out decision continuously, the cutoff's only remaining job
 * is to keep the transparent sheet out of the depth buffer, so it belongs at the top of the empty
 * decile rather than half way up the ramp.
 */
const CARD_ALPHA_CUTOFF = 0.1;

/**
 * Shades the alpha-masked hair cards — the eyelashes and the eyebrows.
 *
 * These two meshes were the only ones on the figure `applyShading` skipped, and leaving them on
 * MakeHuman's default `roughness 0.5 / metalness 0` slab is what made them the most visually wrong
 * thing in the frame: at portrait framing they rendered as saturated blue spikes, more saturated
 * than anything else on screen, on an asset whose own texture is near-black.
 *
 * ## Why a card must not claim an isotropic specular lobe
 *
 * A hair card's shading normal is its plane normal, and that is a lie about what the card stands
 * for — a bundle of fibres. A real fibre confines its highlight to a cone about its own TANGENT,
 * so it can only ever produce a band ALONG the strand. An isotropic GGX lobe about the card's
 * plane normal instead puts the highlight wherever the card happens to face, and a fan of lash
 * blades standing perpendicular to the lid faces, by construction, close to the half-vector of a
 * light behind the head. The portrait rim sits at azimuth −152°, so its half-vector lands ~76° off
 * the view axis — exactly the grazing geometry where Fresnel runs from 0.04 to ~1.
 *
 * Nothing dilutes it. The mean sRGB of `eyelashes01`'s opaque texels is (0.033, 0.012, 0.004),
 * i.e. ~0.003 in linear, so the diffuse term contributes essentially nothing and the rendered
 * pixel is 100% the rim's own colour. Measured on `?freeze&bare` at 900x1200, over the four lash
 * and brow rects `regions.lighting-portrait.json` now carries:
 *
 *   | plate                                   | G7 cool-chroma outliers |
 *   |-----------------------------------------|------------------------:|
 *   | shipped, before this change             |                  0.847% |
 *   | cards hidden altogether (the floor)      |                  0.011% |
 *   | rim and kicker at zero irradiance        |                  0.000% |
 *   | this treatment                           |                  0.028% |
 *
 * So the lobe is removed rather than tuned: `specularIntensity 0` measures at the floor, and the
 * intermediate values do not (0.35 → 0.336%, 0.5 → 0.656%). Punch-list 3.5's Karis hair BSDF is
 * what puts a lobe back, anisotropically, where the fibre tangent says it belongs — the look spec
 * is explicit that hair's apparent colour comes almost entirely from those lobes, so this is an
 * interim that owes 3.5 a replacement, not a final answer.
 *
 * ⚠️ It is NOT the rig's fault, and that was checked before this file was touched. The rim band on
 * skin measures 0.7482 encoded luma against key-lit skin at 0.7935 — 0.943×, at the bottom of the
 * look spec's own 1.0–1.5× band, so the rim is if anything under-powered. Moving the rig's shadow
 * budget off the key and onto the back lights was tried and rejected by measurement: at
 * `shadowFraction` 0.45 the cards barely improve (0.847% → 0.656% equivalent), and at 1.0 the rim
 * band is destroyed (band contrast against skin 40 px inboard falls 1.0967 → 0.9340, i.e. the rim
 * band becomes darker than the skin it is meant to separate from the backdrop).
 *
 * ## Why alpha to coverage
 *
 * `alphaMode: MASK` at cutoff 0.5 draws a texel covering 20% of a pixel at 100% opacity. That is
 * the hard staircase on every lash tip and brow edge, and before the lobe came off it also showed
 * a maximum-Fresnel specular at full strength on a sliver of card. Alpha to coverage turns the
 * binary decision into a sample count, which is both the anti-aliasing fix and a proportional
 * dilution of whatever the card reflects.
 *
 * It needs a multisampled target to mean anything, so it is applied only when the stage actually
 * has one — otherwise the flag would sit on the material reading like a fix while the hard cut
 * carried on underneath.
 *
 * @param {import('../../core/src/figure/Figure.js').Figure} figure
 * @param {boolean} multisampled - whether the stage was built with MSAA.
 * @returns {Array<import('three').Material>} the materials installed, for disposal.
 */
function applyCardShading( figure, multisampled ) {

    const installed = [];

    figure.root.traverse( ( object ) => {

        if ( object.isMesh !== true ) return;

        // Matched on the asset's own alpha mode rather than on mesh names. `verify_glb.mjs`
        // asserts that the brow and lash cards are the only two non-opaque meshes in the bake, and
        // a name matcher has already had to be widened once on this project when `low-poly`
        // became `high-poly` (LEARNINGS, the figure asset). glTF `alphaMode: MASK` arrives as a
        // non-zero `alphaTest`.
        const previous = object.material;
        const isAlphaMaskedCard = previous !== undefined && previous !== null && previous.alphaTest > 0;
        if ( isAlphaMaskedCard === false ) return;

        const card = new MeshPhysicalNodeMaterial();
        card.name = `sugata.card.${ previous.name }`;
        card.map = previous.map;
        card.color.copy( previous.color );
        card.side = previous.side;

        // Kept from the asset rather than re-chosen: with no specular lobe they change nothing,
        // and a number that changes nothing should not be silently re-authored.
        card.roughness = previous.roughness;
        card.metalness = 0;

        card.specularIntensity = 0;
        card.alphaTest = CARD_ALPHA_CUTOFF;
        card.alphaToCoverage = multisampled;

        object.material = card;
        installed.push( card );

    } );

    console.log( `card shading: ${ installed.length } mesh(es) — ${ installed.map( ( m ) => m.name ).join( ', ' ) }` +
        `   alphaToCoverage ${ multisampled }` );

    return installed;

}

/** Drops whatever the previous bake was wearing. Called before the figure itself is disposed. */
function disposeShading( session ) {

    session.eyeOcclusion?.dispose();
    session.eyes?.dispose();
    session.skin?.dispose();
    for ( const card of session.cards ) card.dispose();

    session.eyeOcclusion = null;
    session.eyes = null;
    session.skin = null;
    session.cards = [];

}

/**
 * Reads back what the loaded asset actually is, so the page can say it rather than assume it.
 *
 * This page used to carry two workarounds here — one reparenting the unskinned face meshes onto
 * the head bone, one forcing every BLEND material opaque. Both are gone, because the figure
 * pipeline now exports all seven meshes skinned and only the brow and lash cards non-opaque. A
 * check replaces them: if a regressed bake is ever dropped in, the HUD says so in words instead
 * of the page quietly gluing the face back on and hiding it.
 *
 * Materials this page installed are skipped, and the distinction is the whole point of the check:
 * it is an account of the ASSET, and a blend that Phase 3 chose is not a defect in the bake. The
 * corneal shell is deliberately transparent with depth writing off, so without this it would raise
 * a permanent false alarm on the one line a judge reads to find real ones.
 *
 * @returns {string} one HUD line — the asset's own account of itself.
 */
function describeAsset( figure ) {

    const unskinned = [];
    const blended = [];

    for ( const mesh of figure.meshes ) {

        if ( mesh.isSkinnedMesh !== true ) unskinned.push( mesh.name );

        const materials = Array.isArray( mesh.material ) ? mesh.material : [ mesh.material ];
        for ( const material of materials ) {

            if ( material.name?.startsWith( 'sugata.' ) === true ) continue;
            if ( material.transparent === true ) blended.push( `${ mesh.name }/${ material.name }` );

        }

    }

    if ( unskinned.length === 0 && blended.length === 0 ) {

        return `${ figure.meshes.length }/${ figure.meshes.length } meshes skinned, none blended`;

    }

    return `⚠ unskinned [${ unskinned.join( ' ' ) }]  blended [${ blended.join( ' ' ) }]`;

}

/**
 * Puts the camera on the figure and reports where it is looking and how far away it stands.
 *
 * Two framings, because the Phase 2 gate asks two different questions of the same figure. A
 * PORTRAIT is the only frame in which a blink or a saccade is legible — an eyelid has to be dozens
 * of pixels tall before the roll of it means anything. A BODY frame is the only one in which a
 * rest pose, an arm that hangs, and a weight shift are legible at all. Neither answers for the
 * other, so the page does both rather than compromising on one.
 *
 * The portrait is anchored on the EYE LINE, read off the eyeball mesh rather than guessed from a
 * bone: the five bakes differ in height by centimetres, and the `head` joint sits at the base of
 * the skull, well below the eyes. Anchoring on the eyes means the same rule produces a correct
 * head-and-shoulders at 0.42 m and a correct eyes-only crop at 0.17 m.
 *
 * The body frame is anchored on the figure's own bounding box instead, because "the whole person"
 * is a statement about the mesh, not about the face.
 *
 * @returns {{ focus: Vector3, distanceMetres: number }} the point the lights should aim at, and
 *   the camera's distance, which is what the lighting rig scales itself against.
 */
function frameFigure( stage, figure, { mode, heightMetres } ) {

    figure.root.updateMatrixWorld( true );

    const focus = mode === 'body'
        ? bodyFocus( figure, heightMetres )
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
 * The framed height the requested mode wants, in metres — a portrait crop, or the figure's own
 * measured height plus a margin.
 *
 * Measured rather than assumed because the five bakes differ by centimetres and because a rest
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
 * World height of the pupils, taken as the centre of the eyeball mesh. Falls back to the crown of
 * the bounding box less a head's worth, so a figure without that mesh still frames somewhere sane
 * rather than at the navel — but says so, because a silent fallback here moves the portrait crop
 * without moving anything a gate looks at.
 */
function eyeLineHeight( figure ) {

    let eyeballs = null;
    figure.root.traverse( ( object ) => {

        if ( object.isMesh === true && EYEBALL_MESH_PATTERN.test( object.name ) ) eyeballs = object;

    } );

    if ( eyeballs !== null ) {

        return new Box3().setFromObject( eyeballs ).getCenter( new Vector3() ).y;

    }

    console.warn( `alive: no mesh matching ${ EYEBALL_MESH_PATTERN } — the portrait frame is ` +
        'guessing at the eye line from the top of the bounding box.' );

    return new Box3().setFromObject( figure.root ).max.y - 0.11;

}

// --- signals -------------------------------------------------------------------------------

/**
 * Measures how far the head has actually travelled, in millimetres, against where it sat on the
 * frame this sampler was built. Sway and breath are both millimetre-scale, so "did anything move"
 * is a question only a measurement can answer.
 */
function createHeadSampler( session ) {

    // Re-zeroed whenever a different bake arrives: the five figures differ in height by
    // centimetres, and measuring the new head against the old one's rest would swamp the
    // millimetres we are actually trying to see.
    let referenceHead = null;
    let restPosition = null;
    const current = new Vector3();

    return () => {

        const head = session.figure?.root.getObjectByName( 'head' );
        if ( head === undefined || head === null ) return { medioLateral: 0, anteroPosterior: 0 };

        session.figure.root.updateMatrixWorld( true );
        current.setFromMatrixPosition( head.matrixWorld );

        if ( head !== referenceHead ) {

            referenceHead = head;
            restPosition = current.clone();

        }

        return {
            medioLateral: ( current.x - restPosition.x ) * 1000,
            anteroPosterior: ( current.z - restPosition.z ) * 1000
        };

    };

}

/**
 * Measures how far each hand has travelled from where it rested at bind, in millimetres.
 *
 * The two hands are plotted as two traces rather than one, because the question BodyIdle exists
 * to answer is not "do the arms move" but "do they move independently". Two lines that wander
 * apart are the evidence; one line, or two that mirror, is the tell that a rig is driving both
 * from the same stream.
 */
function createHandSampler( session ) {

    const rest = new Map();     // Bone -> its position at first sight
    const current = new Vector3();

    const displacementOf = ( boneName ) => {

        const hand = session.figure?.root.getObjectByName( boneName );
        if ( hand === undefined || hand === null ) return 0;

        current.setFromMatrixPosition( hand.matrixWorld );

        if ( rest.has( hand ) === false ) rest.set( hand, current.clone() );

        return current.distanceTo( rest.get( hand ) ) * 1000;

    };

    return () => {

        // World matrices are refreshed by the head sampler on the same frame; refreshing again
        // here would be a second full traverse for the same answer.
        return { left: displacementOf( 'hand_l' ), right: displacementOf( 'hand_r' ) };

    };

}

function sampleSignals( stack, layers, samplers ) {

    const head = samplers.head();
    const hand = samplers.hand();

    return {
        blinkClosure: stack.morphChannels.get( 'eyeBlinkLeft' )?.committed ?? 0,
        breathLevel: layers.breath.level,
        eyeYawDegrees: layers.gaze.currentEyeYawDegrees,
        headYawDegrees: layers.gaze.headYawDegrees,
        headMedioLateralMm: head.medioLateral,
        leftHandMm: hand.left,
        rightHandMm: hand.right
    };

}

function describeState( stage, stack, layers, session, pupilScale ) {

    const { breath, sway, bodyIdle, gaze, blink, facialIdle } = layers;
    const stats = stage.stats;
    const faceEvents = facialIdle.eventCounts;

    return [
        `${ stats.backend }   ${ stats.fps.toFixed( 0 ) } fps   ${ stats.frameMs.toFixed( 2 ) } ms cpu   ` +
            `${ stats.drawCalls } draws   ${ ( stats.triangles / 1000 ).toFixed( 0 ) }k tris   dpr ${ stats.dpr }`,
        `motion time ${ stack.time.toFixed( 1 ) } s   conflicts ${ stack.conflicts.length }`,
        '',
        `figure   gender ${ session.identity.gender.toFixed( 2 ) }   asset ${ describeAsset( session.figure ) }`,
        `pose     ${ session.restPose === null ? 'BIND (no rest pose)' : session.restPose.name }` +
            `   frame ${ session.frameMode } ${ session.framedHeightMetres.toFixed( 2 ) } m`,
        `breath   ${ breath.breathsPerMinute.toFixed( 1 ) } brpm   level ${ breath.level.toFixed( 2 ) }   ×${ breath.exaggeration }`,
        `sway     ML ${ ( sway.displacement.x * 1000 ).toFixed( 1 ) } mm   AP ${ ( sway.displacement.z * 1000 ).toFixed( 1 ) } mm` +
            `   shifts ${ sway.eventCounts.shift + sway.eventCounts.discourseShift }`,
        `body     arousal ${ bodyIdle.arousal.toFixed( 2 ) }   settles ${ bodyIdle.eventCounts.shoulderSettle }` +
            `   arm swings ${ bodyIdle.eventCounts.weightShiftSwing }`,
        `gaze     ${ gaze.conversationState } / ${ gaze.region }   eye ${ gaze.currentEyeYawDegrees.toFixed( 1 ) }°` +
            ` head ${ gaze.headYawDegrees.toFixed( 1 ) }°   ${ gaze.saccadeCount } saccades`,
        `blink    ${ blink.blinkCount } blinks   ${ blink.effectiveRatePerMinute().toFixed( 1 ) }/min asked` +
            `   down ${ ( blink.closingDuration * 1000 ).toFixed( 0 ) } ms  up ${ ( blink.openingDuration * 1000 ).toFixed( 0 ) } ms`,
        `face     brow ${ faceEvents.browRaise }/${ faceEvents.browFurrow }` +
            `   lip press ${ faceEvents.lipPress }   swallow ${ faceEvents.swallow }`,
        `pupil    scale ${ pupilScale.toFixed( 3 ) }   ${ layers.pupil.physiologicalDiameterMillimetres.toFixed( 2 ) } mm` +
            `   ${ session.eyes === null ? '(no eye shader — nowhere to land)' : 'on EyeMaterial.pupilScaleUniform' }`,
        `shading  skin ${ session.skin === null ? 'OFF (shipped GLB material)' : 'SkinMaterial' }` +
            `   eyes ${ session.eyes === null ? 'OFF (shipped GLB materials)' : 'EyeMaterial + occlusion' }` +
            `   cards ${ session.cards.length === 0 ? 'OFF (shipped GLB materials)'
                : `${ session.cards.length } lobe-free${ session.multisampled ? ' + a2c' : ', NO MSAA — a2c inert' }` }`
    ].join( '\n' );

}

// --- controls ------------------------------------------------------------------------------

function bindControls( { session, stack, stage, lights, backdrop, layers } ) {

    const { breath, sway, bodyIdle, handIdle, gaze, blink, pupil } = layers;

    bindDial( 'arousal', ( value ) => {

        breath.setArousal( value );
        pupil.setArousal( value );
        bodyIdle.setArousal( value );
        handIdle.setArousal( value );

    } );

    bindDial( 'load', ( value ) => blink.setCognitiveLoad( value ) );
    bindDial( 'attention', ( value ) => blink.setAttention( value ) );

    document.getElementById( 'conversation' ).addEventListener( 'change', ( event ) => {

        gaze.setConversationState( event.target.value );

    } );

    document.getElementById( 'discourse' ).addEventListener( 'change', ( event ) => {

        gaze.setDiscourse( event.target.value === '' ? null : event.target.value );

    } );

    document.getElementById( 'filled-pause' ).addEventListener( 'click', () => gaze.markFilledPause() );
    document.getElementById( 'turn-end' ).addEventListener( 'click', () => gaze.markTurnEnd() );
    document.getElementById( 'boundary' ).addEventListener( 'click', () => {

        sway.markDiscourseBoundary( { speakerChanged: true } );

    } );

    // The gender dial is the one control that reloads an asset. Identity's NEAREST mode snaps to
    // the closest of five bakes, so a drag across the axis loads at most five files and the slider
    // moves in five visible steps — that is the mode's honest behaviour, not a bug.
    //
    // The value guard matters: bindDial publishes once at setup so every other dial starts in
    // sync, and without it that publish would fetch an 11 MB GLB the page has already loaded.
    bindDial( 'gender', ( value ) => {

        if ( value === session.identity.gender ) return;

        session.identity.set( { gender: value } );
        swapFigure( session, stack, stage, lights, backdrop ).catch( reportFailure );

    } );

    buildLayerToggles( layers );

    const exaggerate = document.getElementById( 'exaggerate' );
    exaggerate.addEventListener( 'click', () => {

        breath.exaggeration = breath.exaggeration > 1 ? 1 : 8;
        exaggerate.setAttribute( 'aria-pressed', String( breath.exaggeration > 1 ) );

    } );

    document.getElementById( 'conflicts' ).addEventListener( 'click', () => {

        console.log( stack.describeConflicts() );

    } );

}

function bindDial( id, apply ) {

    const input = document.getElementById( id );
    const output = document.getElementById( `${ id }-value` );

    const publish = () => {

        const value = Number( input.value );
        output.textContent = value.toFixed( 2 );
        apply( value );

    };

    input.addEventListener( 'input', publish );
    publish();

}

/** One on/off button per motion layer, so any of them can be subtracted and the loss looked at. */
function buildLayerToggles( layers ) {

    const container = document.getElementById( 'layer-toggles' );

    for ( const [ key, layer ] of Object.entries( layers ) ) {

        const button = document.createElement( 'button' );
        button.type = 'button';
        button.textContent = key;
        button.setAttribute( 'aria-pressed', String( layer.enabled ) );

        button.addEventListener( 'click', () => {

            layer.enabled = ! layer.enabled;
            button.setAttribute( 'aria-pressed', String( layer.enabled ) );

        } );

        container.appendChild( button );

    }

}

function bindKeyboard( { blink, trace } ) {

    window.addEventListener( 'keydown', ( event ) => {

        if ( event.target.tagName === 'INPUT' || event.target.tagName === 'SELECT' ) return;

        const key = event.key.toLowerCase();

        if ( key === 'b' ) blink.blinkNow();
        if ( key === 's' ) blink.triggerWithSaccade( 35 );
        if ( key === 't' ) trace.toggle();

    } );

}

// --- the strip chart ---------------------------------------------------------------------------

/**
 * A rolling plot of the five signals that carry aliveness. Without it a screenshot of this page
 * cannot distinguish a breathing figure from a frozen one, because the whole motion is
 * millimetres. The picture is the sanity check; the trace is the evidence.
 */
function createTrace( canvas ) {

    const context = canvas.getContext( '2d' );
    const windowSeconds = 12;

    const channels = [
        { key: 'blinkClosure', colour: '#f2a65a', label: 'blink closure 0..1', min: 0, max: 1 },
        { key: 'breathLevel', colour: '#7fd1a0', label: 'breath level 0..1', min: 0, max: 1 },
        { key: 'eyeYawDegrees', colour: '#8ab4f8', label: 'eye yaw ±15°', min: -15, max: 15 },
        { key: 'headYawDegrees', colour: '#c58af9', label: 'head yaw ±15°', min: -15, max: 15 },
        { key: 'headMedioLateralMm', colour: '#e57bb0', label: 'head ML ±12 mm', min: -12, max: 12 },
        // Two hands, two lines. Whether the arms are alive is answered by either line moving;
        // whether they are a rig is answered by the two moving together.
        { key: 'leftHandMm', colour: '#f4e07a', label: 'left hand 0..14 mm', min: 0, max: 14 },
        { key: 'rightHandMm', colour: '#79e0d8', label: 'right hand 0..14 mm', min: 0, max: 14 }
    ];

    const samples = [];
    let elapsed = 0;

    return {

        push( deltaSeconds, values ) {

            elapsed += deltaSeconds;
            samples.push( { time: elapsed, values } );

            while ( samples.length > 0 && samples[ 0 ].time < elapsed - windowSeconds ) samples.shift();

        },

        draw() {

            if ( canvas.style.display === 'none' ) return;

            const rowHeight = canvas.height / channels.length;

            context.clearRect( 0, 0, canvas.width, canvas.height );

            channels.forEach( ( channel, row ) => {

                const top = row * rowHeight;

                context.strokeStyle = 'rgba(255,255,255,0.08)';
                context.beginPath();
                context.moveTo( 0, top + rowHeight * 0.5 );
                context.lineTo( canvas.width, top + rowHeight * 0.5 );
                context.stroke();

                context.fillStyle = channel.colour;
                context.font = '9px ui-monospace, monospace';
                context.fillText( channel.label, 6, top + 10 );

                context.strokeStyle = channel.colour;
                context.lineWidth = 1.25;
                context.beginPath();

                samples.forEach( ( sample, index ) => {

                    const x = canvas.width * ( 1 - ( elapsed - sample.time ) / windowSeconds );
                    const normalised = ( sample.values[ channel.key ] - channel.min ) / ( channel.max - channel.min );
                    const y = top + rowHeight - 3 - normalised * ( rowHeight - 6 );

                    if ( index === 0 ) context.moveTo( x, y );
                    else context.lineTo( x, y );

                } );

                context.stroke();

            } );

        },

        setVisible( visible ) {

            canvas.style.display = visible ? 'block' : 'none';

        },

        toggle() {

            this.setVisible( canvas.style.display === 'none' );

        }

    };

}

function reportFailure( error ) {

    document.getElementById( 'hud' ).textContent = `failed\n${ error.message }`;
    console.error( error );

}

// The one catch-all: the boundary where a failure has to become something a human can read.
boot().catch( reportFailure );
