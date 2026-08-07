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
 *   - The full idle stack runs: breath, sway, idle micro-motion, gaze (eyes and head), blink,
 *     pupil. Every one of them is a contributor to a MotionStack, which is the only thing that
 *     writes to the figure.
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
 *   ?rawface        turn OFF the unskinned-head-mesh workaround, to look at the asset defect
 *   ?bare           hide every overlay — controls, HUD, strip chart — for a clean plate. A critic
 *                   comparing this against a reference still wants pixels, not instrumentation.
 *   ?height=0.18    override the framed height in metres. 0.18 is an eyes-only crop.
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
import { Box3, Matrix4 } from 'three';
import { RectAreaLightTexturesLib } from 'three/addons/lights/RectAreaLightTexturesLib.js';

import { Stage } from '../../core/src/render/Stage.js';
import { Figure } from '../../core/src/figure/Figure.js';
import { Identity } from '../../core/src/figure/Identity.js';
import { MotionStack, createMotionTarget } from '../../core/src/motion/MotionStack.js';
import { Blink } from '../../core/src/motion/Blink.js';
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

    // Everything that changes when the gender dial moves lives in one place, so the reload path
    // has exactly one object to swap and the frame loop has exactly one thing to null-check.
    const session = {
        identity: new Identity( { gender: Number( query.get( 'gender' ) ?? 0.5 ) } ),
        figure: null,
        target: null,
        loadToken: 0,
        repairUnskinnedHead: query.has( 'rawface' ) === false,
        rescuedMeshes: [],
        framedHeightMetres: Number( query.get( 'height' ) ?? PORTRAIT_HEIGHT_METRES )
    };

    const stack = new MotionStack( { seed: Number( query.get( 'seed' ) ?? 20260807 ) } );

    const breath = new Breath();
    const sway = new Sway();
    const idle = new IdleMotion();
    const gaze = new Gaze( { partnerYawDegrees: CAMERA_AZIMUTH_DEGREES } );
    const blink = new Blink();
    const pupil = new Pupil();

    // The eye layer and the head layer are two members of one pair, added separately because they
    // sit in different slots — HEAD runs before GAZE so the eyes can counter-rotate against the
    // head position this frame actually landed on.
    const layers = { breath, sway, idle, gazeHead: gaze.head, gaze, blink, pupil };

    await swapFigure( session, stack, stage, lights, backdrop );

    for ( const layer of Object.values( layers ) ) stack.add( layer );

    // No eye shader yet (punch-list 3.3), so pupil dilation has nowhere to land on this asset.
    // Reading it through the same sink a material will use proves the hook is live.
    let pupilScale = 1;
    pupil.addSink( ( scale ) => { pupilScale = scale; } );

    const trace = createTrace( document.getElementById( 'trace' ) );
    if ( bare || query.get( 'trace' ) === '0' ) trace.setVisible( false );

    bindControls( { session, stack, stage, lights, backdrop, layers } );
    bindKeyboard( { blink, trace } );

    const sampleHeadDisplacement = createHeadSampler( session );

    // A pre-roll is the difference between a screenshot that means something and one that does
    // not: it puts the stack at a known motion time, and it fills the strip chart, so a single
    // captured frame carries the history that a 240 ms blink lives in.
    const prerollSeconds = Number( query.get( 'preroll' ) ?? 0 );
    const frozen = query.has( 'freeze' );

    for ( let step = 0; step < Math.round( prerollSeconds / FIXED_STEP_SECONDS ); step ++ ) {

        stack.update( FIXED_STEP_SECONDS );
        trace.push( FIXED_STEP_SECONDS, sampleSignals( stack, layers, sampleHeadDisplacement ) );

    }

    stage.onFrame( ( deltaSeconds ) => {

        if ( session.figure === null ) return;   // a bake is being swapped in

        if ( frozen === false ) {

            stack.update( deltaSeconds );
            trace.push( deltaSeconds, sampleSignals( stack, layers, sampleHeadDisplacement ) );

        }

        if ( bare ) return;

        trace.draw();
        hud.textContent = describeState( stage, stack, layers, session, pupilScale );

    } );

    // Handy for poking at any of it from the console. `frame( 0.16 )` pushes in until the frame is
    // 160 mm tall, which is the only way to inspect an eyelid roll closely without a second page.
    window.sugata = {
        stage,
        stack,
        layers,
        session,
        lights,
        frame: ( heightMetres ) => aimLightingRig( lights, framePortrait( stage, session.figure, heightMetres ) )
    };

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

/** Points every light at the focus point the camera is framing. */
function aimLightingRig( lights, focus ) {

    for ( const { light, placement } of lights ) {

        light.position.set(
            focus.x + placement.offsetMetres[ 0 ],
            focus.y + placement.offsetMetres[ 1 ],
            focus.z + placement.offsetMetres[ 2 ]
        );

        light.lookAt( focus.x, focus.y, focus.z );

    }

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

    forceOpaqueMaterials( figure );
    session.rescuedMeshes = session.repairUnskinnedHead ? reattachUnskinnedHeadMeshes( figure ) : [];

    session.figure = figure;
    session.target = createMotionTarget( figure.root );

    stack.bind( session.target );

    const focus = framePortrait( stage, figure, session.framedHeightMetres );
    aimLightingRig( lights, focus );

    backdrop.position.set( focus.x, focus.y, focus.z - BACKDROP_DISTANCE_METRES );

}

/**
 * ⚠️ WORKAROUND FOR AN ASSET DEFECT. This does not belong here; it belongs in the figure pipeline.
 *
 * In the shipped GLBs only the body carries JOINTS_0/WEIGHTS_0 and a `skin`. The five head meshes
 * — eyebrows, eyelashes, eyeballs, teeth, tongue — are exported as *plain, unskinned* meshes
 * parented under the skinned body node, with no node transform of their own. Verified by parsing
 * the glTF JSON of figure_g050.glb directly:
 *
 *     Human.eyebrow001 / eyelashes01 / low-poly / teeth_base / tongue01
 *         attributes: POSITION, NORMAL, TEXCOORD_0        no skin, no TRS
 *     Human (base.001)
 *         attributes: POSITION, NORMAL, TEXCOORD_0, JOINTS_0, WEIGHTS_0   skin 0
 *
 * A child of a SkinnedMesh inherits that mesh's OBJECT transform, which is identity, and not one
 * bit of its skin deformation. So the moment any bone moves — a nod, a sway, a breath — the face
 * comes apart: the skull turns and the eyes, brows, lashes, teeth and tongue stay behind in the
 * bind pose, sitting off the cheek. At a 14° head yaw they are visibly detached from the head.
 *
 * The real fix is in tools/figure-pipeline/build_figure.py: export those five with the armature
 * modifier applied, exactly as the body is.
 *
 * Until then, this reparents each one onto the `head` bone with the matrix that puts it back
 * where it rested, so they ride the skull rigidly. That is the right approximation for all five —
 * eyeballs, teeth and tongue really are rigid bodies inside the head, and lashes and brows carry
 * their own blink and brow morphs, so nothing here needs skin deformation to animate correctly.
 * It only covers the head; a shoulder-region unskinned mesh would need the real fix.
 *
 * @returns {string[]} the meshes that had to be rescued — empty once the pipeline is fixed.
 */
function reattachUnskinnedHeadMeshes( figure ) {

    const headBone = figure.bone( 'head' );
    if ( headBone === null || headBone === undefined ) return [];

    figure.root.updateMatrixWorld( true );

    const headRestWorldInverse = new Matrix4().copy( headBone.matrixWorld ).invert();
    const rescued = [];

    for ( const mesh of figure.meshes ) {

        if ( mesh.isSkinnedMesh === true ) continue;

        const restWorld = mesh.matrixWorld.clone();

        headBone.add( mesh );
        mesh.matrix.multiplyMatrices( headRestWorldInverse, restWorld );
        mesh.matrix.decompose( mesh.position, mesh.quaternion, mesh.scale );

        rescued.push( mesh.name );

    }

    return rescued;

}

/**
 * Known asset defect: every material in the shipped GLBs is exported with alphaMode BLEND, so the
 * six meshes sort against each other and the figure renders as a translucent mess — teeth through
 * lips, eyeballs through eyelids. Nothing here is actually transparent, so the fix is to say so.
 * Belongs in the figure pipeline; until it is fixed there, every consumer has to do this.
 */
function forceOpaqueMaterials( figure ) {

    let corrected = 0;

    figure.root.traverse( ( object ) => {

        if ( object.isMesh !== true ) return;

        const materials = Array.isArray( object.material ) ? object.material : [ object.material ];

        for ( const material of materials ) {

            if ( material.transparent !== true ) continue;

            material.transparent = false;
            material.opacity = 1;
            material.depthWrite = true;
            material.needsUpdate = true;
            corrected ++;

        }

    } );

    return corrected;

}

/**
 * Puts the camera on a head-and-shoulders portrait and returns the point it is looking at, which
 * is also what the lights aim at.
 *
 * The frame is anchored on the EYE LINE, read off the eyeball mesh rather than guessed from a
 * bone: the five bakes differ in height by centimetres, and the `head` joint sits at the base of
 * the skull, well below the eyes. Anchoring on the eyes means the same rule produces a correct
 * head-and-shoulders at 0.42 m and a correct eyes-only crop at 0.17 m.
 */
function framePortrait( stage, figure, heightMetres = PORTRAIT_HEIGHT_METRES ) {

    figure.root.updateMatrixWorld( true );

    const focus = new Vector3( 0, eyeLineHeight( figure ) + heightMetres * ( EYE_LINE_FROM_TOP - 0.5 ), 0 );

    const halfFieldOfView = ( PORTRAIT_FIELD_OF_VIEW_DEGREES / 2 ) * Math.PI / 180;
    const distance = ( heightMetres / 2 ) / Math.tan( halfFieldOfView );
    const azimuth = CAMERA_AZIMUTH_DEGREES * Math.PI / 180;

    stage.camera.position.set(
        focus.x + Math.sin( azimuth ) * distance,
        focus.y,
        focus.z + Math.cos( azimuth ) * distance
    );

    stage.camera.lookAt( focus );

    return focus;

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

function sampleSignals( stack, layers, sampleHeadDisplacement ) {

    const head = sampleHeadDisplacement();

    return {
        blinkClosure: stack.morphChannels.get( 'eyeBlinkLeft' )?.committed ?? 0,
        breathLevel: layers.breath.level,
        eyeYawDegrees: layers.gaze.currentEyeYawDegrees,
        headYawDegrees: layers.gaze.headYawDegrees,
        headMedioLateralMm: head.medioLateral
    };

}

function describeState( stage, stack, layers, session, pupilScale ) {

    const { breath, sway, gaze, blink } = layers;
    const stats = stage.stats;

    return [
        `${ stats.backend }   ${ stats.fps.toFixed( 0 ) } fps   ${ stats.frameMs.toFixed( 2 ) } ms cpu   ` +
            `${ stats.drawCalls } draws   ${ ( stats.triangles / 1000 ).toFixed( 0 ) }k tris   dpr ${ stats.dpr }`,
        `motion time ${ stack.time.toFixed( 1 ) } s   conflicts ${ stack.conflicts.length }`,
        '',
        `figure   gender ${ session.identity.gender.toFixed( 2 ) }   ` +
            `unskinned-head workaround ${ session.repairUnskinnedHead ? `ON (${ session.rescuedMeshes.length } meshes)` : 'OFF — asset defect visible' }`,
        `breath   ${ breath.breathsPerMinute.toFixed( 1 ) } brpm   level ${ breath.level.toFixed( 2 ) }   ×${ breath.exaggeration }`,
        `sway     ML ${ ( sway.displacement.x * 1000 ).toFixed( 1 ) } mm   AP ${ ( sway.displacement.z * 1000 ).toFixed( 1 ) } mm` +
            `   shifts ${ sway.eventCounts.shift + sway.eventCounts.discourseShift }`,
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

    const { breath, sway, gaze, blink, pupil } = layers;

    bindDial( 'arousal', ( value ) => {

        breath.setArousal( value );
        pupil.setArousal( value );

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
        { key: 'headMedioLateralMm', colour: '#e57bb0', label: 'head ML ±12 mm', min: -12, max: 12 }
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
