/**
 * alive — the Phase 2 acceptance page.
 *
 * The gate this page exists to answer is subjective and it is stated in one line:
 * *does the figure read as alive when it is silent and unshaded?* Everything here serves
 * being able to LOOK at that honestly.
 *
 *   - The figure is lit by the portrait rig the look spec asks for — four RectAreaLights at a
 *     key:fill around 1.5:1, rim and kicker hue-opposed to the key. Four is the measured budget
 *     (0.265 ms + 0.618 ms per Mpx lit, per light: 3.6 ms at 1080p), and no more than four are
 *     ever in the scene, because a light left in the scene still costs a slot in the generated
 *     lighting loop even when it is invisible.
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
 *     gaze (eyes and head), blink, pupil. Every one of them is a contributor to a MotionStack,
 *     which is the only thing that writes to the figure.
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
 */

import {
    Color,
    Mesh,
    MeshStandardNodeMaterial,
    PlaneGeometry,
    RectAreaLight,
    RectAreaLightNode,
    Vector3
} from 'three/webgpu';
import { Box3 } from 'three';
import { RectAreaLightTexturesLib } from 'three/addons/lights/RectAreaLightTexturesLib.js';

import { Stage } from '../../core/src/render/Stage.js';
import { Figure } from '../../core/src/figure/Figure.js';
import { Identity } from '../../core/src/figure/Identity.js';
import { RestPose } from '../../core/src/figure/RestPose.js';
import { Skeleton } from '../../core/src/figure/Skeleton.js';
import { MotionStack, createMotionTarget } from '../../core/src/motion/MotionStack.js';
import { Blink } from '../../core/src/motion/Blink.js';
import { BodyIdle } from '../../core/src/motion/BodyIdle.js';
import { Breath } from '../../core/src/motion/Breath.js';
import { Gaze } from '../../core/src/motion/Gaze.js';
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

// The mesh the eye line is read off. GLTFLoader strips the dot from 'Human.low-poly'.
const EYEBALL_MESH_NAME = 'Humanlow-poly';

// How much air to leave around the figure in the full-body frame, as a fraction of its height.
// A body cropped hard at crown and heel reads as a passport photo of a corpse; a little headroom
// is what lets the eye see the silhouette, which is the whole point of looking at a rest pose.
const BODY_FRAME_MARGIN = 1.10;

// The posture the figure stands in when no URL says otherwise.
const DEFAULT_REST_POSE = 'relaxed-standing';

// --- the lighting rig ------------------------------------------------------------------------

/**
 * Key / fill / rim / kicker, positioned relative to the framed focus point so the rig travels
 * with the figure when a different bake changes its height.
 *
 * The numbers come from docs/research/stellar-blade-look-spec.md § Lighting rig: key broad and
 * soft about 45° off axis and slightly above the eyeline; fill large and strong, one stop under;
 * rim and kicker hue-opposed to the key, winning on saturation rather than on brightness. The
 * figure's own axes are +X to the character's left, +Z forward, so +X here is camera left.
 *
 * ⚠️ RectAreaLight casts no shadow — three.js has never implemented it and the issue has been
 * open since 2018. Contact shadow is punch-list 3.9; nothing here fakes it.
 */
const LIGHTING_RIG = [
    {
        name: 'key',
        offsetMetres: [ 0.90, 0.45, 0.95 ],
        sizeMetres: [ 0.85, 1.20 ],
        colour: 0xfff0dc,
        intensity: 5.5
    },
    {
        name: 'fill',
        offsetMetres: [ -1.05, 0.10, 0.85 ],
        sizeMetres: [ 1.60, 1.60 ],
        colour: 0xbcd4ff,
        intensity: 1.9
    },
    {
        name: 'rim',
        offsetMetres: [ -0.75, 0.55, -0.90 ],
        sizeMetres: [ 0.45, 1.10 ],
        colour: 0x8fb6ff,
        intensity: 16
    },
    {
        name: 'kicker',
        offsetMetres: [ 0.95, -0.10, -0.80 ],
        sizeMetres: [ 0.35, 1.00 ],
        colour: 0xffbe8c,
        intensity: 10
    }
];

/**
 * The backdrop. The look spec wants it 1.5–2.0 stops below the subject, cooler and desaturated —
 * a black void is as wrong as a blown one, because the silhouette then has nothing to separate
 * from and the head reads as a cut-out.
 *
 * It is EMISSIVE rather than lit, and that is a deliberate stand-in, not an oversight. Every one
 * of the four RectAreaLights emits toward the figure; a RectAreaLight is single-sided, so the two
 * behind the figure throw their light forward, away from anything further back. Lighting a card
 * properly would mean a fifth light, and four is the measured budget. So the card states its own
 * value directly. Replace it with a real bounce when LightingRig (punch-list 3.8) lands.
 */
const BACKDROP_EMISSIVE = 0x11151f;
const BACKDROP_DISTANCE_METRES = 1.9;

const FIXED_STEP_SECONDS = 1 / 60;

// --- boot ---------------------------------------------------------------------------------

async function boot() {

    const query = new URLSearchParams( window.location.search );
    const hud = document.getElementById( 'hud' );

    const stage = new Stage();
    await stage.create( document.getElementById( 'stage' ), {
        fieldOfView: PORTRAIT_FIELD_OF_VIEW_DEGREES,
        near: 0.01,
        far: 50,
        forceWebGL: query.has( 'webgl' )
    } );

    stage.scene.background = new Color( 0x08080a );

    // RectAreaLight needs its linearly-transformed-cosine tables installed before first use. On
    // the WebGPU path they go in through RectAreaLightNode; without this the lights contribute
    // nothing at all and the figure renders black.
    RectAreaLightNode.setLTC( RectAreaLightTexturesLib.init() );

    const bare = query.has( 'bare' );

    if ( bare ) {

        for ( const id of [ 'controls', 'hud', 'trace' ] ) {

            document.getElementById( id ).style.display = 'none';

        }

    }

    const lights = buildLightingRig( stage );
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
        framedHeightMetres: PORTRAIT_HEIGHT_METRES
    };

    const stack = new MotionStack( { seed: Number( query.get( 'seed' ) ?? 20260807 ) } );

    const breath = new Breath();
    const sway = new Sway();
    const idle = new IdleMotion();
    const bodyIdle = new BodyIdle();
    const gaze = new Gaze( { partnerYawDegrees: CAMERA_AZIMUTH_DEGREES } );
    const blink = new Blink();
    const pupil = new Pupil();

    // IdleMotion declares the six arm bones as well as the head, and so does BodyIdle. Bone
    // contributions SUM, so running both as shipped is not an error the stack can catch — it is a
    // silent doubling of every arm joint that nobody asked for, and both files say so in their
    // headers. The intended split is IdleMotion on the head, BodyIdle on everything below the
    // neck. Emptying the arm joints here is the integration-side half of that; the library-side
    // half is an `armsEnabled` option on IdleMotion, which it does not have yet.
    idle.joints.length = 0;

    // The eye layer and the head layer are two members of one pair, added separately because they
    // sit in different slots — HEAD runs before GAZE so the eyes can counter-rotate against the
    // head position this frame actually landed on.
    const layers = { breath, sway, idle, bodyIdle, gazeHead: gaze.head, gaze, blink, pupil };

    await swapFigure( session, stack, stage, lights, backdrop );

    for ( const layer of Object.values( layers ) ) stack.add( layer );

    // No eye shader yet (punch-list 3.3), so pupil dilation has nowhere to land on this asset.
    // Reading it through the same sink a material will use proves the hook is live.
    let pupilScale = 1;
    pupil.addSink( ( scale ) => { pupilScale = scale; } );

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

    const relayWeightShifts = createWeightShiftRelay( sway, bodyIdle );
    const samplers = { head: createHeadSampler( session ), hand: createHandSampler( session ) };

    /**
     * One simulated frame: advance the stack, hand Sway's events on to the arms, and record what
     * moved. Every clock the page has — pre-roll, rAF, the capture hook — comes through here, so
     * a capture and a live run cannot drift into being different simulations.
     */
    const advanceSimulation = ( deltaSeconds ) => {

        stack.update( deltaSeconds );
        relayWeightShifts();
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
            aimLightingRig( lights, framed.focus, framed.distanceMetres / portraitDistanceMetres() );

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
 * Four RectAreaLights, parked at the origin. `aimLightingRig` moves them once the figure's height
 * is known. They are added to the scene once and never removed, because the rig is fixed at four.
 */
function buildLightingRig( stage ) {

    return LIGHTING_RIG.map( ( placement ) => {

        const light = new RectAreaLight(
            placement.colour,
            placement.intensity,
            placement.sizeMetres[ 0 ],
            placement.sizeMetres[ 1 ]
        );

        light.name = placement.name;
        stage.add( light );

        return { light, placement };

    } );

}

/**
 * Points every light at the focus point the camera is framing, and scales the rig to the subject.
 *
 * The offsets in LIGHTING_RIG are authored for a head half a metre across. Aimed at a whole body
 * from the same half-metre standoff, the key panel is inside the figure's own silhouette: the
 * chest blows out and the legs fall into black. So the rig grows with the camera's distance.
 *
 * Panel SIZE scales with the offsets and intensity does not, which is the physically right pairing
 * and worth stating because the instinct is to brighten. A RectAreaLight's intensity is a
 * radiance; the irradiance it delivers goes as the solid angle it subtends, which is area over
 * distance squared. Scale both by the same factor and that ratio is unchanged — the subject keeps
 * its exposure and, more importantly, keeps the same shadow softness relative to its own size.
 *
 * @param {number} scale - camera distance over the portrait distance the offsets were authored at.
 */
function aimLightingRig( lights, focus, scale = 1 ) {

    for ( const { light, placement } of lights ) {

        light.position.set(
            focus.x + placement.offsetMetres[ 0 ] * scale,
            focus.y + placement.offsetMetres[ 1 ] * scale,
            focus.z + placement.offsetMetres[ 2 ] * scale
        );

        light.width = placement.sizeMetres[ 0 ] * scale;
        light.height = placement.sizeMetres[ 1 ] * scale;

        light.lookAt( focus.x, focus.y, focus.z );

    }

}

/** The camera distance LIGHTING_RIG's offsets were authored against — the portrait standoff. */
function portraitDistanceMetres() {

    return ( PORTRAIT_HEIGHT_METRES / 2 ) / Math.tan( ( PORTRAIT_FIELD_OF_VIEW_DEGREES / 2 ) * Math.PI / 180 );

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

    stack.bind( session.target );

    // Measured after posing, because the pose changes the figure's height by centimetres.
    session.framedHeightMetres = framedHeightFor( figure, session.frameMode, session.heightOverride );

    const { focus, distanceMetres } = frameFigure( stage, figure, {
        mode: session.frameMode,
        heightMetres: session.framedHeightMetres
    } );

    aimLightingRig( lights, focus, distanceMetres / portraitDistanceMetres() );

    // The card does not move with the rig. It is emissive, so distance costs it nothing, and at
    // 8 x 6 m it still fills a full-body frame from 1.9 m behind the subject.
    backdrop.position.set( focus.x, focus.y, focus.z - BACKDROP_DISTANCE_METRES );

}

/**
 * Reads back what the loaded asset actually is, so the page can say it rather than assume it.
 *
 * This page used to carry two workarounds here — one reparenting the unskinned face meshes onto
 * the head bone, one forcing every BLEND material opaque. Both are gone, because the figure
 * pipeline now exports all six meshes skinned and only the brow and lash cards non-opaque. A
 * check replaces them: if a regressed bake is ever dropped in, the HUD says so in words instead
 * of the page quietly gluing the face back on and hiding it.
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
 * rather than at the navel.
 */
function eyeLineHeight( figure ) {

    const eyeballs = figure.root.getObjectByName( EYEBALL_MESH_NAME );

    if ( eyeballs !== undefined && eyeballs !== null ) {

        return new Box3().setFromObject( eyeballs ).getCenter( new Vector3() ).y;

    }

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

/**
 * Sway measures weight shifts and BodyIdle wants to hear about them, so the arms answer a shift
 * with one small decaying swing instead of drifting on obliviously while the pelvis moves.
 *
 * The event is OBSERVED from Sway's counters rather than pushed by Sway, because `Sway.beginShift`
 * carries no callback yet. That costs one frame of latency — 16 ms, an order of magnitude under
 * anything a viewer resolves — and it costs the magnitude: the drawn shift amplitude lives inside
 * `beginShift` and is not readable from out here, so every shift is relayed at the nominal 1.
 * The real fix is one line in Sway; this is the integration standing in for it, visibly.
 */
function createWeightShiftRelay( sway, bodyIdle ) {

    const totalShifts = () => sway.eventCounts.shift + sway.eventCounts.discourseShift;

    let seen = totalShifts();

    return () => {

        const now = totalShifts();
        if ( now === seen ) return;

        seen = now;
        bodyIdle.onWeightShift();

    };

}

function describeState( stage, stack, layers, session, pupilScale ) {

    const { breath, sway, bodyIdle, gaze, blink } = layers;
    const stats = stage.stats;

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
        `pupil    scale ${ pupilScale.toFixed( 3 ) }   ${ layers.pupil.physiologicalDiameterMillimetres.toFixed( 2 ) } mm` +
            `   (no pupil morph on this asset)`
    ].join( '\n' );

}

// --- controls ------------------------------------------------------------------------------

function bindControls( { session, stack, stage, lights, backdrop, layers } ) {

    const { breath, sway, bodyIdle, gaze, blink, pupil } = layers;

    bindDial( 'arousal', ( value ) => {

        breath.setArousal( value );
        pupil.setArousal( value );
        bodyIdle.setArousal( value );

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
