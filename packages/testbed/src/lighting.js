/**
 * lighting — the browsercheck for `render/LightingRig.js`, punch list 3.8.
 *
 * The rig's gate is a MEASURED one — `tools/critic/measure.mjs` G1, face key:shadow < 2:1 linear
 * — so this page exists to produce the frame that gets measured, at both framings, under
 * conditions that do not drift. Everything here serves that:
 *
 *   - **The canvas is sized in device pixels by this page**, never by CSS. A CSS-stretched canvas
 *     hands the critic a resampled image, and every high-pass and edge-width number taken off it
 *     would be a measurement of the browser's resampler.
 *
 *   - **Nothing animates.** This is not a motion page. The figure stands in a `RestPose` and the
 *     only thing that changes between two screenshots is the light, which is the only way a
 *     before/after on a lighting change means anything.
 *
 *   - **The known-bad variants are on the page, not in a branch.** `?variant=dramatic` builds the
 *     conventional 4:1 portrait rig the look spec exists to reject, and `?variant=noshadow` drops
 *     the shadow halves. A gate that has only ever been run on the intended rig is not known to
 *     be measuring the rig (LEARNINGS §1.1).
 *
 *   - **The rim is reported in pixels.** `LightingRig.silhouetteBandPixels` converts the rig's
 *     azimuth into the unit the "rim stops reading at body scale" defect is actually judged in.
 *     An azimuth in degrees passes every review; a 3-pixel band does not (LEARNINGS §1.10b).
 *
 * ⚠️ The frame clock is probed, not assumed. The Claude browser pane performs no layout and fires
 * no `requestAnimationFrame` (LEARNINGS §1.12), so a page that trusts either renders one frame and
 * stalls at "booting…". The size is pinned and the loop falls back to a `MessageChannel`, which
 * measured 553,921 dispatches/s in that pane against `setTimeout`'s 8.
 *
 * URL parameters:
 *   ?frame=body           full-figure framing instead of head-and-shoulders
 *   ?preset=portrait|body force a rig preset independently of the framing (for the A/B that shows
 *                         the body preset is doing something)
 *   ?variant=dramatic     KNOWN-BAD: a 4:1 key:fill, the ratio the look spec rejects
 *   ?variant=noshadow     KNOWN-BAD: area lights only, no shadow halves at all
 *   ?w=900&h=1200         drawing buffer, in device pixels
 *   ?gender=0.5           which bake
 *   ?pose=relaxed-standing
 *   ?exposure=1
 *   ?bare                 hide every overlay
 *   ?perf=1               run the GPU cost sweep (pins 1920x1080 unless ?w/?h say otherwise)
 */

import {
    Color,
    Mesh,
    MeshStandardNodeMaterial,
    PlaneGeometry,
    TimestampQuery,
    Vector3
} from 'three/webgpu';
import { Box3 } from 'three';

import { Stage } from '../../core/src/render/Stage.js';
import { LightingRig, silhouetteBandPixels } from '../../core/src/render/LightingRig.js';
import { Figure } from '../../core/src/figure/Figure.js';
import { Identity } from '../../core/src/figure/Identity.js';
import { RestPose } from '../../core/src/figure/RestPose.js';
import { Skeleton } from '../../core/src/figure/Skeleton.js';

// --- framing -----------------------------------------------------------------------------------
//
// Both numbers are `alive.js`'s, quoted rather than re-chosen: the two pages have to frame the
// same shot or the lighting measured here is not the lighting that page renders.

const PORTRAIT_FIELD_OF_VIEW_DEGREES = 26;
const PORTRAIT_HEIGHT_METRES = 0.42;
const EYE_LINE_FROM_TOP = 1 / 3;
const CAMERA_AZIMUTH_DEGREES = 12;
const BODY_FRAME_MARGIN = 1.10;
const EYEBALL_MESH_PATTERN = /high-poly|low-poly|eyeball/i;

// Limb radii the silhouette band is reported against. Approximate on purpose — the claim they
// serve is a RATIO between two framings, and a radius wrong by a fifth cancels out of it.
const HEAD_RADIUS_METRES = 0.09;
const UPPER_ARM_RADIUS_METRES = 0.045;

// --- the studio ----------------------------------------------------------------------------------
//
// A real backdrop and floor, both LIT and both receiving shadow — not the emissive card `alive.js`
// carries. That card exists precisely because a rig of four single-sided RectAreaLights has
// nothing pointing at anything behind the figure, so the card had to state its own value. With a
// shadow-casting directional in the key the studio is lit for free, and the figure gets the one
// thing an area-light-only rig cannot give it: somewhere for its shadow to land.
//
// The look spec puts the background 1.5–2.0 stops below the subject, cooler and desaturated
// (3.8:1 measured). Hitting that with a LIT card is a geometry problem before it is an albedo
// problem: at `alive.js`'s 1.9 m standoff the card sits three times further from the key than the
// face does, receives ~9% of the face's irradiance, and would need an albedo of 1.6 to come back
// to 4:1 — which is why that page gave up and made the card emissive. Bringing the card in to
// 1.2x the camera distance takes its share to ~18% and puts a real, physically-lit, shadow-taking
// surface inside reach of the target. The albedo below is the value that measured closest; see
// the report in this round's notes.
//
// Scaling with the CAMERA distance rather than fixing it in metres is the same argument the rig
// itself makes: it keeps the card's exposure relative to the subject unchanged between framings,
// so a backdrop tuned at portrait is still right for a full body.
const BACKDROP_ALBEDO = 0x74777e;
const FLOOR_ALBEDO = 0x2e3036;
const BACKDROP_DISTANCE_IN_CAMERA_DISTANCES = 1.2;

const DEFAULT_WIDTH = 900;
const DEFAULT_HEIGHT = 1200;

const PERF_WIDTH = 1920;
const PERF_HEIGHT = 1080;

const query = new URLSearchParams( window.location.search );
const status = document.getElementById( 'status' );

boot().catch( ( error ) => {

    document.getElementById( 'hud' ).textContent = `failed\n${ error.stack ?? error }`;
    console.error( error );

} );

async function boot() {

    const wantsPerf = query.has( 'perf' ) && query.get( 'perf' ) !== '0';
    const width = Number( query.get( 'w' ) ?? ( wantsPerf ? PERF_WIDTH : DEFAULT_WIDTH ) );
    const height = Number( query.get( 'h' ) ?? ( wantsPerf ? PERF_HEIGHT : DEFAULT_HEIGHT ) );

    const canvas = document.getElementById( 'stage' );

    // Device pixels, stated twice on purpose: the buffer size AND the CSS box, so the element a
    // screenshot captures is 1:1 with the buffer measure.mjs reads.
    canvas.style.width = `${ width }px`;
    canvas.style.height = `${ height }px`;

    const stage = new Stage();
    await stage.create( canvas, {
        fieldOfView: PORTRAIT_FIELD_OF_VIEW_DEGREES,
        near: 0.01,
        far: 60,
        maxPixelRatio: 1,             // one canvas pixel is one measured pixel
        width,
        height,
        forceWebGL: query.has( 'webgl' ),
        trackTimestamp: wantsPerf
    } );

    stage.scene.background = new Color( 0x050506 );

    const bare = query.has( 'bare' );
    if ( bare ) {

        for ( const id of [ 'hud', 'controls', 'perf' ] ) document.getElementById( id ).style.display = 'none';

    }

    const studio = buildStudio( stage );

    const session = {
        frameMode: query.get( 'frame' ) === 'body' ? 'body' : 'portrait',
        variant: query.get( 'variant' ) ?? 'default',
        figure: null,
        framedHeightMetres: PORTRAIT_HEIGHT_METRES,
        focus: new Vector3(),
        canvasHeightPixels: height
    };

    const identity = new Identity( { gender: Number( query.get( 'gender' ) ?? 0.5 ) } );
    const plan = await identity.resolve();
    const figure = await Figure.load( plan.figures[ 0 ].url );

    stage.add( figure.root );
    figure.root.updateMatrixWorld( true );

    const poseName = query.get( 'pose' ) ?? 'relaxed-standing';

    if ( poseName !== 'bind' ) {

        const skeleton = new Skeleton( figure.root );
        const absent = RestPose.load( poseName ).applyTo( skeleton );
        if ( absent.length > 0 ) console.warn( `rest pose '${ poseName }': no ${ absent.join( ', ' ) }` );
        skeleton.update();
        figure.root.updateMatrixWorld( true );

    }

    // Every mesh both casts and receives. A figure that casts but does not receive has no shadow
    // under its own chin, which is the single most visible thing a shadow-casting rig buys on a
    // face, and it is easy to miss because the floor shadow looks correct.
    figure.root.traverse( ( object ) => {

        if ( object.isMesh !== true ) return;
        object.castShadow = true;
        object.receiveShadow = true;

    } );

    session.figure = figure;

    const rig = new LightingRig( {
        preset: query.get( 'preset' ) ?? session.frameMode,
        ...( query.has( 'exposure' ) ? { exposure: Number( query.get( 'exposure' ) ) } : {} ),
        shadows: session.variant !== 'noshadow',
        ...( query.has( 'shadowmap' ) ? { shadowMapSize: Number( query.get( 'shadowmap' ) ) } : {} ),
        ...( query.has( 'ambient' ) ? { ambientFractionOfKey: Number( query.get( 'ambient' ) ) } : {} ),
        overrides: {
            ...variantOverrides( session.variant ),
            ...( query.has( 'keyshadow' ) ? { key: { shadowFraction: Number( query.get( 'keyshadow' ) ) } } : {} ),
            ...parseOverrides( query.get( 'ov' ) )
        }
    } );

    rig.attachTo( stage.scene, stage.renderer );

    applyFraming( stage, rig, session, studio );

    buildControls( { stage, rig, session, studio } );

    const hud = document.getElementById( 'hud' );

    stage.onFrame( () => {

        if ( bare ) return;
        hud.textContent = describe( stage, rig, session );

    } );

    // Handles for a screenshot driver and for poking from the console. `__LIGHTING_READY__` is the
    // flag an external capture waits on — a screenshot taken before the GLB resolves is a picture
    // of an empty studio, and it looks exactly like a lighting failure.
    globalThis.__LIGHTING__ = { stage, rig, session, studio, applyFraming: () => applyFraming( stage, rig, session, studio ) };
    globalThis.__LIGHTING_INFO__ = () => report( stage, rig, session );
    globalThis.__LIGHTING_READY__ = true;

    // The pane that renders these screenshots fires no rAF, so `Stage`'s own loop never ticks.
    // Probe it and take over if it is dead.
    await installFrameClock( stage );

    if ( wantsPerf ) await runCostSweep( stage, rig, session );

}

// --- the studio ------------------------------------------------------------------------------

function buildStudio( stage ) {

    const backdrop = new Mesh(
        new PlaneGeometry( 14, 10 ),
        new MeshStandardNodeMaterial( { color: BACKDROP_ALBEDO, roughness: 0.95, metalness: 0 } )
    );
    backdrop.receiveShadow = true;
    backdrop.name = 'backdrop';
    stage.add( backdrop );

    const floor = new Mesh(
        new PlaneGeometry( 14, 14 ),
        new MeshStandardNodeMaterial( { color: FLOOR_ALBEDO, roughness: 0.9, metalness: 0 } )
    );
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    floor.name = 'floor';
    stage.add( floor );

    return { backdrop, floor };

}

// --- framing ---------------------------------------------------------------------------------

/**
 * Puts the camera on the figure, then hands the shot to the rig.
 *
 * The order matters and is the whole reason this is one function: the rig needs the focus point,
 * the framed height and the camera position, and all three are outputs of the framing decision.
 * A caller that aimed the rig first would be lighting the previous shot.
 */
function applyFraming( stage, rig, session, studio ) {

    const figure = session.figure;
    figure.root.updateMatrixWorld( true );

    const bounds = new Box3().setFromObject( figure.root );

    session.framedHeightMetres = session.frameMode === 'body'
        ? ( bounds.max.y - bounds.min.y ) * BODY_FRAME_MARGIN
        : PORTRAIT_HEIGHT_METRES;

    const focusY = session.frameMode === 'body'
        ? ( bounds.min.y + bounds.max.y ) / 2
        : eyeLineHeight( figure, bounds ) + session.framedHeightMetres * ( EYE_LINE_FROM_TOP - 0.5 );

    session.focus.set( 0, focusY, 0 );

    const halfFieldOfView = ( PORTRAIT_FIELD_OF_VIEW_DEGREES / 2 ) * Math.PI / 180;
    const distance = ( session.framedHeightMetres / 2 ) / Math.tan( halfFieldOfView );
    const azimuth = CAMERA_AZIMUTH_DEGREES * Math.PI / 180;

    stage.camera.position.set(
        session.focus.x + Math.sin( azimuth ) * distance,
        session.focus.y,
        session.focus.z + Math.cos( azimuth ) * distance
    );
    stage.camera.lookAt( session.focus );

    const backdropDistance = distance * BACKDROP_DISTANCE_IN_CAMERA_DISTANCES;
    studio.backdrop.position.set( 0, session.focus.y, session.focus.z - backdropDistance );
    studio.backdrop.scale.setScalar( Math.max( 1, session.framedHeightMetres / PORTRAIT_HEIGHT_METRES ) );
    studio.floor.scale.setScalar( Math.max( 1, session.framedHeightMetres / PORTRAIT_HEIGHT_METRES ) );
    session.backdropDistanceMetres = backdropDistance;

    rig.aimAt( {
        focus: session.focus,
        subjectHeightMetres: session.framedHeightMetres,
        cameraPosition: stage.camera.position
    } );

}

/** The full-body framed height, measured off the posed figure rather than assumed. */
function bodyFramedHeight( figure ) {

    const bounds = new Box3().setFromObject( figure.root );

    return ( bounds.max.y - bounds.min.y ) * BODY_FRAME_MARGIN;

}

/** World height of the pupils. Says so out loud if the eyeball mesh is missing — see alive.js. */
function eyeLineHeight( figure, bounds ) {

    let eyeballs = null;
    figure.root.traverse( ( object ) => {

        if ( object.isMesh === true && EYEBALL_MESH_PATTERN.test( object.name ) ) eyeballs = object;

    } );

    if ( eyeballs !== null ) return new Box3().setFromObject( eyeballs ).getCenter( new Vector3() ).y;

    console.warn( `lighting: no mesh matching ${ EYEBALL_MESH_PATTERN } — guessing the eye line.` );

    return bounds.max.y - 0.11;

}

// --- known-bad variants -------------------------------------------------------------------------

/**
 * The rigs this one exists to be better than, so the gate can be run against them.
 *
 * `dramatic` is the conventional portrait ratio: key four times the fill. The look spec's single
 * loudest sentence is that this reads wrong on this target no matter how good the shader is, and
 * G1 must go red on it or G1 is not measuring what it claims.
 */
function variantOverrides( variant ) {

    if ( variant === 'dramatic' ) {

        // 4:1, and the rim pulled back to a token so the shadow side is genuinely dark. This is
        // what "western photoreal cinematics run 4:1–8:1" looks like on our rig.
        return { fill: { irradiance: 0.75 }, rim: { irradiance: 2.0 }, kicker: { irradiance: 1.2 } };

    }

    return {};

}

/**
 * `?ov=key.elevationDegrees:34,rim.irradiance:9` — arbitrary placement overrides from the URL.
 *
 * A sweep over a rig parameter has to be reproducible from a command line or it is not a sweep,
 * it is somebody's memory of dragging a slider. Every number reported in this round's write-up
 * came through here.
 */
function parseOverrides( spec ) {

    if ( spec === null || spec === '' ) return {};

    const overrides = {};

    for ( const clause of spec.split( ',' ) ) {

        const [ path, value ] = clause.split( ':' );
        const [ light, field ] = path.split( '.' );

        overrides[ light ] = { ...( overrides[ light ] ?? {} ), [ field ]: Number( value ) };

    }

    return overrides;

}

// --- reporting -----------------------------------------------------------------------------------

/** Everything a screenshot cannot carry, as a plain object an external driver can read. */
function report( stage, rig, session ) {

    return {
        backend: stage.stats.backend,
        canvas: { width: stage.renderer.domElement.width, height: stage.renderer.domElement.height },
        frameMode: session.frameMode,
        preset: rig.preset,
        variant: session.variant,
        framedHeightMetres: session.framedHeightMetres,
        focus: session.focus.toArray(),
        cameraPosition: stage.camera.position.toArray(),
        designedKeyToFill: rig.designedKeyToFill,
        lights: rig.describe( session.canvasHeightPixels, limbRadiusFor( session ) ),
        limbRadiusMetres: limbRadiusFor( session ),
        drawCalls: stage.stats.drawCalls,
        triangles: stage.stats.triangles
    };

}

/**
 * Which limb the silhouette band is reported against.
 *
 * The head at portrait framing and the upper arm at body framing — in each case the part of the
 * figure the rim is being asked to describe. Reporting the body rim against a head radius would
 * flatter it by 2x and hide the exact defect this page is here to quantify.
 */
function limbRadiusFor( session ) {

    return session.frameMode === 'body' ? UPPER_ARM_RADIUS_METRES : HEAD_RADIUS_METRES;

}

function describe( stage, rig, session ) {

    const info = report( stage, rig, session );

    const header = [
        `${ info.backend }  ${ info.canvas.width }x${ info.canvas.height }  ${ stage.stats.fps.toFixed( 0 ) } fps  ` +
            `${ info.drawCalls } draws  ${ ( info.triangles / 1000 ).toFixed( 0 ) }k tris`,
        `frame ${ info.frameMode } ${ info.framedHeightMetres.toFixed( 3 ) } m   rig preset ${ info.preset }   variant ${ info.variant }`,
        `designed key:fill  ${ info.designedKeyToFill.toFixed( 3 ) }:1   ` +
            `(G1 wants the RENDERED key:shadow < 2.00, reference 1.43–1.64 linear)`,
        `silhouette band reported against a ${ ( info.limbRadiusMetres * 1000 ).toFixed( 0 ) } mm ` +
            `${ session.frameMode === 'body' ? 'upper arm' : 'head' }`,
        '',
        'light      az°   el°       E     panel m    d m   Ω_p sr  radiance  shadow  1+cosφ  band px'
    ];

    const rows = info.lights.map( ( light ) => (
        `${ light.name.padEnd( 9 ) }` +
        `${ light.azimuthDegrees.toFixed( 0 ).padStart( 5 ) }` +
        `${ light.elevationDegrees.toFixed( 0 ).padStart( 6 ) }` +
        `${ light.irradiance.toFixed( 2 ).padStart( 8 ) }` +
        `${ `${ light.panelMetres[ 0 ].toFixed( 2 ) }x${ light.panelMetres[ 1 ].toFixed( 2 ) }`.padStart( 12 ) }` +
        `${ light.distanceMetres.toFixed( 2 ).padStart( 7 ) }` +
        `${ light.projectedSolidAngle.toFixed( 4 ).padStart( 9 ) }` +
        `${ light.areaRadiance.toFixed( 2 ).padStart( 10 ) }` +
        `${ light.shadowFraction.toFixed( 2 ).padStart( 8 ) }` +
        `${ light.silhouetteBandFraction.toFixed( 3 ).padStart( 8 ) }` +
        `${ light.silhouetteBandPixels.toFixed( 1 ).padStart( 9 ) }`
    ) );

    // What the same rim would measure at the other framing — the "scaled portrait rig" defect,
    // stated as two numbers rather than as a sentence.
    const rim = rig.placements.find( ( entry ) => entry.name === 'rim' );

    // The other framing's height has to be MEASURED, not assumed: in portrait mode the page has
    // never computed the body frame, and reusing the current one would print the portrait number
    // twice under two different labels — which is exactly the kind of line a reader believes.
    const otherHeight = session.frameMode === 'body'
        ? PORTRAIT_HEIGHT_METRES
        : bodyFramedHeight( session.figure );
    const otherRadius = session.frameMode === 'body' ? HEAD_RADIUS_METRES : UPPER_ARM_RADIUS_METRES;

    const footer = [
        '',
        `the same rim at the OTHER framing (${ ( otherRadius * 1000 ).toFixed( 0 ) } mm limb over ` +
            `${ otherHeight.toFixed( 2 ) } m of frame): ` +
            `${ silhouetteBandPixels( rim.azimuthDegrees, otherRadius, otherHeight, session.canvasHeightPixels ).toFixed( 1 ) } px`
    ];

    return [ ...header, ...rows, ...footer ].join( '\n' );

}

// --- controls --------------------------------------------------------------------------------

function buildControls( { stage, rig, session, studio } ) {

    const framings = document.getElementById( 'framings' );

    for ( const [ label, apply ] of [
        [ 'portrait', () => { session.frameMode = 'portrait'; rig.setPreset( 'portrait' ); } ],
        [ 'body', () => { session.frameMode = 'body'; rig.setPreset( 'body' ); } ],
        [ 'body frame + portrait rig', () => { session.frameMode = 'body'; rig.setPreset( 'portrait' ); } ]
    ] ) {

        const button = document.createElement( 'button' );
        button.textContent = label;
        button.style.marginRight = '4px';
        button.addEventListener( 'click', () => {

            apply();
            applyFraming( stage, rig, session, studio );

        } );
        framings.appendChild( button );

    }

    const toggles = document.getElementById( 'toggles' );

    for ( const unit of rig.units ) {

        const button = document.createElement( 'button' );
        button.textContent = unit.placement.name;
        button.style.marginRight = '4px';
        button.setAttribute( 'aria-pressed', 'true' );
        button.addEventListener( 'click', () => {

            const on = button.getAttribute( 'aria-pressed' ) === 'false';
            button.setAttribute( 'aria-pressed', String( on ) );
            unit.area.visible = on;
            if ( unit.shadowCaster !== null ) unit.shadowCaster.visible = on;

        } );
        toggles.appendChild( button );

    }

    const dials = document.getElementById( 'dials' );

    // Only the dials that can move a gate. A slider per field would be a nicer toy and a worse
    // instrument — the point of this panel is to find the edge of G1 by hand, not to art-direct.
    addDial( dials, 'exposure', 0.2, 3, 0.05, rig.exposure, ( value ) => {

        rig.exposure = value;
        rig.solve();

    } );

    addDial( dials, 'fill E', 0.2, 4, 0.02, rig.irradianceOf( 'fill' ), ( value ) => {

        rig.override( 'fill', { irradiance: value } );

    } );

    addDial( dials, 'key shadow', 0, 1, 0.05, 0.30, ( value ) => {

        rig.override( 'key', { shadowFraction: value } );

    } );

    addDial( dials, 'rim az°', -180, -90, 1, rig.placements.find( ( p ) => p.name === 'rim' ).azimuthDegrees, ( value ) => {

        rig.override( 'rim', { azimuthDegrees: value } );

    } );

    addDial( dials, 'rim E', 0, 20, 0.2, rig.irradianceOf( 'rim' ), ( value ) => {

        rig.override( 'rim', { irradiance: value } );

    } );

    const actions = document.getElementById( 'actions' );

    const log = document.createElement( 'button' );
    log.textContent = 'log rig';
    log.addEventListener( 'click', () => console.log( JSON.stringify( report( stage, rig, session ), null, 2 ) ) );
    actions.appendChild( log );

}

function addDial( container, label, min, max, step, value, apply ) {

    const row = document.createElement( 'label' );

    const name = document.createElement( 'span' );
    name.textContent = label;

    const input = document.createElement( 'input' );
    input.type = 'range';
    input.min = String( min );
    input.max = String( max );
    input.step = String( step );
    input.value = String( value );

    const readout = document.createElement( 'span' );
    readout.style.textAlign = 'right';
    readout.textContent = Number( value ).toFixed( 2 );

    input.addEventListener( 'input', () => {

        const next = Number( input.value );
        readout.textContent = next.toFixed( 2 );
        apply( next );

    } );

    row.append( name, input, readout );
    container.appendChild( row );

}

// --- the frame clock ------------------------------------------------------------------------

/**
 * A macrotask a hidden page does not throttle. Same reasoning, and the same measured numbers, as
 * `packages/testbed/src/stage.js`: `setTimeout(fn, 0)` yields 8 callbacks per second in a hidden
 * pane; a `MessageChannel` measured 553,921.
 *
 * Duplicated rather than shared because `stage.js` does not export it and this agent does not own
 * that file. It is ~15 lines and the alternative is a screenshot of "booting…".
 */
const taskChannel = new MessageChannel();
const taskQueue = [];

taskChannel.port1.onmessage = () => {

    const task = taskQueue.shift();
    if ( task !== undefined ) task();

};

function scheduleTask( task ) {

    taskQueue.push( task );
    taskChannel.port2.postMessage( 0 );

}

/**
 * Probes whether requestAnimationFrame is alive and, if it is not, drives the renderer's own
 * per-frame tick by hand.
 *
 * Both halves are needed. `nodeFrame.update()` is where skinning is refreshed; stopping the rAF
 * chain without replacing it renders a live scene onto a frozen pose, which measures as perfectly
 * reproducible because a still image always does (LEARNINGS §1.3).
 */
async function installFrameClock( stage ) {

    const renderer = stage.renderer;

    const rafWorks = await new Promise( ( resolve ) => {

        let ticks = 0;
        renderer.setAnimationLoop( () => { ticks += 1; } );
        setTimeout( () => {

            renderer.setAnimationLoop( null );
            resolve( ticks >= 2 );

        }, 250 );

    } );

    globalThis.__LIGHTING_FRAME_CLOCK__ = rafWorks ? 'requestAnimationFrame' : 'MessageChannel (no rAF in this pane)';

    if ( rafWorks ) {

        renderer.setAnimationLoop( stage.renderFrame );
        return;

    }

    let elapsed = 0;

    const loop = () => {

        renderer._nodes.nodeFrame.update();
        if ( renderer.info.autoReset === true ) renderer.info.reset();
        renderer.info.frame = renderer._nodes.nodeFrame.frameId;

        elapsed += 16;
        stage.renderFrame( elapsed );

        scheduleTask( loop );

    };

    scheduleTask( loop );

}

// --- the cost sweep ---------------------------------------------------------------------------

/**
 * What does this rig cost, on this hardware, on the real figure?
 *
 * `docs/PROGRESS.md` already measures the area lights in isolation — 0.265 ms + 0.618 ms per Mpx
 * lit, per light, giving 3.604 ms for four at 1080p. That figure is a fitted model over spheres.
 * What it cannot tell anyone is what the SHADOW halves add on a 15k-vertex skinned figure, because
 * a shadow map costs a whole extra draw of the geometry and the model has no term for geometry.
 *
 * Four variants, same scene, same frame:
 *
 *   ambient-only          the floor of the measurement: no area lights at all
 *   4 area, no shadows    the PROGRESS.md condition, reproduced on our geometry
 *   4 area, key shadow    what the rig ships
 *   4 area, 4 shadows     what "each paired with a shadow-casting directional" costs in full
 *
 * The timestamp discipline is `stage.js`'s, and every part of it was a bug there first: ONE render
 * per frame (the passes-per-frame trick reports the deferred path as cheaper than forward, which
 * cannot be true), await each resolve before the next frame (a pooled resolve reports whichever
 * frame is last), and headline the **p95** rather than the median — Chrome quantises WebGPU
 * timestamps to 0.065536 ms here and some resolves come back holding only part of a frame, so the
 * low tail is dropout and the upper envelope is the honest estimate.
 */
async function runCostSweep( stage, rig, session ) {

    const panel = document.getElementById( 'perf' );
    panel.style.display = 'block';

    const renderer = stage.renderer;

    if ( renderer.hasFeature?.( 'timestamp-query' ) !== true ) {

        panel.textContent = 'no timestamp-query on this adapter — refusing to report wall clock as GPU cost';
        return;

    }

    const variants = [
        { name: 'ambient only', shadows: false, lights: 0 },
        { name: '4 area, 0 shadows', shadows: false, lights: 4 },
        { name: '4 area, key shadow', shadows: true, lights: 4, shadowNames: [ 'key' ] },
        { name: '4 area, 4 shadows', shadows: true, lights: 4, shadowNames: [ 'key', 'fill', 'rim', 'kicker' ] }
    ];

    const repeats = Number( query.get( 'repeats' ) ?? 3 );
    const warmupFrames = Number( query.get( 'warmup' ) ?? 40 );
    const sampleFrames = Number( query.get( 'frames' ) ?? 120 );

    const collected = new Map( variants.map( ( variant ) => [ variant.name, [] ] ) );

    for ( let repeat = 0; repeat < repeats; repeat += 1 ) {

        // Alternate the order. GPU clocks drift across a sweep and a variant that always ran last
        // would carry that drift as if it were its own cost.
        const order = repeat % 2 === 0 ? variants : variants.slice().reverse();

        for ( const variant of order ) {

            status.textContent = `cost sweep — pass ${ repeat + 1 }/${ repeats }, ${ variant.name }`;

            applyCostVariant( rig, session, stage, variant );

            for ( let frame = 0; frame < warmupFrames + sampleFrames; frame += 1 ) {

                await nextTask();
                renderer._nodes.nodeFrame.update();
                renderer.render( stage.scene, stage.camera );

                const duration = await renderer.resolveTimestampsAsync( TimestampQuery.RENDER );

                if ( frame >= warmupFrames && typeof duration === 'number' && duration > 0 ) {

                    collected.get( variant.name ).push( duration );

                }

            }

        }

    }

    // Put the rig back the way it shipped, so the page a human then looks at is the real one.
    applyCostVariant( rig, session, stage, variants[ 2 ] );

    const rows = variants.map( ( variant ) => {

        const samples = collected.get( variant.name ).slice().sort( ( a, b ) => a - b );
        const at = ( q ) => samples.length === 0 ? null : samples[ Math.min( samples.length - 1, Math.floor( q * samples.length ) ) ];

        return {
            name: variant.name,
            p95: at( 0.95 ),
            median: at( 0.5 ),
            min: samples[ 0 ] ?? null,
            max: samples[ samples.length - 1 ] ?? null,
            count: samples.length,
            quantum: smallestStep( samples )
        };
    } );

    const floorMs = rows[ 0 ].p95;

    panel.innerHTML = '';
    const table = document.createElement( 'table' );
    table.innerHTML =
        '<thead><tr><th>variant</th><th>GPU ms p95</th><th>Δ vs ambient</th><th>median</th>' +
        '<th>min</th><th>max</th><th>n</th><th>timer step</th></tr></thead>';

    const body = document.createElement( 'tbody' );

    for ( const row of rows ) {

        const cells = [
            row.name,
            fmt( row.p95 ), row.p95 === null || floorMs === null ? '—' : fmt( row.p95 - floorMs ),
            fmt( row.median ), fmt( row.min ), fmt( row.max ), String( row.count ), fmt( row.quantum )
        ];

        const tr = document.createElement( 'tr' );
        for ( const cell of cells ) {

            const td = document.createElement( 'td' );
            td.textContent = cell;
            tr.appendChild( td );

        }
        body.appendChild( tr );

    }

    table.appendChild( body );
    panel.appendChild( table );

    const payload = {
        page: 'lighting-cost',
        backend: stage.stats.backend,
        conditions: {
            width: stage.renderer.domElement.width,
            height: stage.renderer.domElement.height,
            frameMode: session.frameMode,
            repeats, warmupFrames, sampleFrames,
            note: 'one render call per frame; p95 headline; resolve awaited every frame'
        },
        rows
    };

    globalThis.__LIGHTING_PERF__ = payload;
    globalThis.__LIGHTING_PERF_DONE__ = true;
    console.log( 'LIGHTING_PERF ' + JSON.stringify( payload ) );
    status.textContent = 'cost sweep complete';

}

/** Rebuilds the rig for one cost variant. Disposing and rebuilding, never hiding: a hidden light
 *  still occupies a slot in the generated lighting loop and a hidden shadow caster still renders
 *  its map, so `visible = false` would measure the cost of the thing it was trying to remove. */
function applyCostVariant( rig, session, stage, variant ) {

    const overrides = {};

    if ( variant.lights === 0 ) {

        for ( const name of [ 'key', 'fill', 'rim', 'kicker' ] ) overrides[ name ] = { irradiance: 0, shadowFraction: 0 };

    } else {

        for ( const name of [ 'key', 'fill', 'rim', 'kicker' ] ) {

            const casts = variant.shadows && ( variant.shadowNames ?? [] ).includes( name );
            overrides[ name ] = { shadowFraction: casts ? 0.45 : 0 };

        }

    }

    rig.overrides = overrides;
    rig.shadowsEnabled = variant.shadows;
    rig.placements = rig.resolvePlacements();

    // `lights: 0` still leaves four RectAreaLights in the scene at zero radiance, which is NOT the
    // floor this variant is supposed to measure — three.js generates the lighting loop from the
    // lights present, not from their intensity. Strip them.
    if ( variant.lights === 0 ) {

        rig.dispose();
        rig.scene = stage.scene;
        rig.renderer = stage.renderer;
        rig.units.length = 0;

    } else {

        rig.rebuild();

    }

    rig.aimAt( {
        focus: session.focus,
        subjectHeightMetres: session.framedHeightMetres,
        cameraPosition: stage.camera.position
    } );

}

function nextTask() {

    return new Promise( ( resolve ) => scheduleTask( resolve ) );

}

function smallestStep( sorted ) {

    let step = Infinity;

    for ( let i = 1; i < sorted.length; i += 1 ) {

        const gap = sorted[ i ] - sorted[ i - 1 ];
        if ( gap > 1e-9 && gap < step ) step = gap;

    }

    return step === Infinity ? null : step;

}

function fmt( value ) {

    return value === null || value === undefined ? '—' : `${ value.toFixed( 3 ) }`;

}
