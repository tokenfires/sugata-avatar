/**
 * eye — the browsercheck for punch-list 3.3 and 3.4.
 *
 * `alive.html` is the Phase 2 page and is owned by the motion work; this one exists so the eye can
 * be looked at, A/B'd and measured without touching it.
 *
 * The three questions it is built to answer, in order of how easy they are to fake:
 *
 *   1. **Does it render at all, and does it look like an eye?** Screenshot at portrait framing.
 *   2. **Does the gate pass?** G2 of `tools/critic/measure.mjs` — sclera at 0.98x cheek luma,
 *      +/-0.06. A white sclera is on the punch list's standing-constraints list as explicitly
 *      wrong, so this gate is the one that decides whether the material is finished.
 *   3. **Is the refraction real, or is it a flat disc that happens to compile?** A still frame
 *      cannot answer that (docs/LEARNINGS.md §1.3). `?azimuth=` moves the camera, and the pupil
 *      has to travel ACROSS the iris relative to the limbus as it does. `?refraction=0` renders
 *      the same frame with the iris pinned to its own UV — a flat disc — so the two plates
 *      differ in exactly one thing.
 *
 * URL parameters, all of them so a screenshot can be reproduced from a string:
 *
 *   ?w=1200&h=1200   pin the drawing buffer. Required in any pane that performs no layout, where
 *                    clientWidth reads 0 and the buffer comes up 1x1 (LEARNINGS §1.12).
 *   ?height=0.075    framed height in metres. 0.075 is an eyes-only crop; 0.42 is the portrait
 *                    framing alive.js uses.
 *   ?azimuth=12      camera azimuth in degrees off the facing axis. 12 matches alive.js.
 *   ?yaw= ?pitch=    gaze, in degrees, driven straight onto the eyeLook* morphs.
 *   ?pupil=1.0       pupil scale, the scalar motion/Pupil.js publishes.
 *   ?refraction=0    pin the iris to its own UV. The A side of the parallax comparison.
 *   ?shader=0        put the shipped GLB materials back. The A side of everything else.
 *   ?occlusion=0     no occlusion sheet, no tearline.
 *   ?catchlight=0    no per-eye catchlight cubemap.
 *   ?gender=0.5      which bake.
 *   ?bare            hide the HUD and the controls, for a clean plate.
 *   ?webgl           force the WebGL2 tier.
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
import { RectAreaLightTexturesLib } from 'three/addons/lights/RectAreaLightTexturesLib.js';

import { Stage } from '../../core/src/render/Stage.js';
import { Figure } from '../../core/src/figure/Figure.js';
import { Identity } from '../../core/src/figure/Identity.js';
import { EyeMaterial, findEyeMeshes } from '../../core/src/material/EyeMaterial.js';
import { buildEyeOcclusion } from '../../core/src/material/EyeOcclusion.js';

// The portrait rig, copied from packages/testbed/src/alive.js rather than imported, because that
// file belongs to the motion work and this page must not be able to change what it renders. The
// numbers come from docs/research/stellar-blade-look-spec.md § Lighting rig; keep them in step by
// hand if alive.js's move.
const LIGHTING_RIG = [
    { name: 'key', offsetMetres: [ 0.90, 0.45, 0.95 ], sizeMetres: [ 0.85, 1.20 ], colour: 0xfff0dc, intensity: 5.5 },
    { name: 'fill', offsetMetres: [ -1.05, 0.10, 0.85 ], sizeMetres: [ 1.60, 1.60 ], colour: 0xbcd4ff, intensity: 1.9 },
    { name: 'rim', offsetMetres: [ -0.75, 0.55, -0.90 ], sizeMetres: [ 0.45, 1.10 ], colour: 0x8fb6ff, intensity: 16 },
    { name: 'kicker', offsetMetres: [ 0.95, -0.10, -0.80 ], sizeMetres: [ 0.35, 1.00 ], colour: 0xffbe8c, intensity: 10 }
];

const BACKDROP_EMISSIVE = 0x11151f;
const BACKDROP_DISTANCE_METRES = 1.9;

// The rig offsets are authored for a head-sized subject. An eyes-only crop puts the camera 15 cm
// from the face, and a key panel 0.9 m away at that distance is a point source — so the rig scales
// with the camera's own standoff, the same way alive.js's does, referenced to the portrait frame.
const PORTRAIT_HEIGHT_METRES = 0.42;
const FIELD_OF_VIEW_DEGREES = 26;

const GAZE_MORPHS = {
    yawIn: [ 'eyeLookInLeft', 'eyeLookOutRight' ],
    yawOut: [ 'eyeLookOutLeft', 'eyeLookInRight' ],
    up: [ 'eyeLookUpLeft', 'eyeLookUpRight' ],
    down: [ 'eyeLookDownLeft', 'eyeLookDownRight' ]
};

// Full weight on a gaze morph is 15.1 degrees of eye rotation, measured by
// tools/spikes/eye-geometry.mjs. That is the conversion from the page's degrees to a morph weight,
// and it is a measurement rather than a scale factor picked to make the slider feel right.
const DEGREES_PER_GAZE_MORPH = 15.1;

boot().catch( ( error ) => {

    document.getElementById( 'boot' ).textContent = `failed: ${ error.message }`;
    console.error( error );

} );

async function boot() {

    const query = new URLSearchParams( window.location.search );
    const canvas = document.getElementById( 'stage' );

    const width = Number( query.get( 'w' ) ?? 0 ) || canvas.clientWidth || 1200;
    const height = Number( query.get( 'h' ) ?? 0 ) || canvas.clientHeight || 1200;

    // A pinned drawing buffer and a CSS box that fills the window are two different aspect ratios,
    // and the canvas stretches to reconcile them — which silently squashes the picture a judge is
    // looking at. Letterbox instead, so what is on screen is what a screenshot at this size would
    // contain.
    if ( query.has( 'w' ) || query.has( 'h' ) ) {

        canvas.style.width = `min( 100vw, 100vh * ${ width / height } )`;
        canvas.style.height = `min( 100vh, 100vw * ${ height / width } )`;
        canvas.style.margin = 'auto';
        document.body.style.display = 'grid';
        document.body.style.placeItems = 'center';

    }

    const stage = new Stage();
    await stage.create( canvas, {
        fieldOfView: FIELD_OF_VIEW_DEGREES,
        near: 0.005,
        far: 20,
        width,
        height,
        forceWebGL: query.has( 'webgl' )
    } );

    stage.scene.background = new Color( 0x08080a );

    // Without the LTC tables RectAreaLight contributes nothing at all and the figure renders black.
    RectAreaLightNode.setLTC( RectAreaLightTexturesLib.init() );

    const lights = LIGHTING_RIG.map( ( placement ) => {

        const light = new RectAreaLight( placement.colour, placement.intensity,
            placement.sizeMetres[ 0 ], placement.sizeMetres[ 1 ] );
        light.name = placement.name;
        stage.add( light );
        return { light, placement };

    } );

    const backdrop = new Mesh( new PlaneGeometry( 4, 4 ), new MeshStandardNodeMaterial( {
        color: 0x000000,
        emissive: new Color( BACKDROP_EMISSIVE ),
        roughness: 1
    } ) );
    stage.add( backdrop );

    const identity = new Identity( { gender: Number( query.get( 'gender' ) ?? 0.5 ) } );
    const plan = await identity.resolve();
    const figure = await Figure.load( plan.figures[ 0 ].url );
    stage.add( figure.root );

    // The skeleton has to be current before EyeMaterial reads the head bone's world matrix.
    figure.root.updateMatrixWorld( true );

    const eyes = new EyeMaterial( {
        figure,
        refraction: query.get( 'refraction' ) !== '0',
        catchlight: query.get( 'catchlight' ) === '0' ? null : 'softbox'
    } );

    const occlusion = buildEyeOcclusion( { figure, geometry: eyes.geometry } );
    const occlusionVisible = ( visible ) => {

        for ( const mesh of occlusion.meshes ) mesh.visible = visible;

    };

    if ( query.get( 'shader' ) !== '0' ) eyes.attach();
    occlusionVisible( query.get( 'occlusion' ) !== '0' );

    // ?shell=0 takes the corneal shell out of the draw entirely. It is the only way to attribute a
    // highlight to one of the two meshes rather than to "the eye", and it is how the panel-slab
    // finding in EyeMaterial.js's CORNEA_SCENE_SPECULAR was pinned down.
    eyes.corneaMesh.visible = query.get( 'shell' ) !== '0';
    document.getElementById( 'shell' ).checked = eyes.corneaMesh.visible;

    const state = {
        yaw: Number( query.get( 'yaw' ) ?? 0 ),
        pitch: Number( query.get( 'pitch' ) ?? 0 ),
        pupil: Number( query.get( 'pupil' ) ?? 1 ),
        azimuth: Number( query.get( 'azimuth' ) ?? 12 ),
        heightMetres: Number( query.get( 'height' ) ?? 0.075 )
    };

    // The eye midpoint, in the figure's own space. Everything is framed and lit about this point
    // rather than about the head's bounding box, because at a 75 mm frame a centimetre of error
    // puts the eyes out of shot.
    const focusEye = query.get( 'focus' ) ?? 'centre';
    const focus = new Vector3(
        focusEye === 'centre' ? 0 : eyes.geometry[ focusEye ].centre[ 0 ],
        ( eyes.geometry.left.centre[ 1 ] + eyes.geometry.right.centre[ 1 ] ) / 2,
        ( eyes.geometry.left.centre[ 2 ] + eyes.geometry.right.centre[ 2 ] ) / 2 );

    const applyState = () => {

        applyGaze( figure, state );
        eyes.pupilScaleUniform.value = state.pupil;
        eyes.update();
        frameCamera( stage, focus, state );
        aimRig( lights, backdrop, focus );

    };

    applyState();

    const bare = query.has( 'bare' );
    if ( bare ) {

        for ( const id of [ 'hud', 'controls' ] ) document.getElementById( id ).style.display = 'none';

    }

    bindControls( state, { applyState, eyes, occlusionVisible } );

    const hud = document.getElementById( 'hud' );

    const describe = () => [
        `backend ${ stage.backendName }   ${ Math.round( stage.fps ) } fps   ${ width }x${ height }`,
        `frame ${ state.heightMetres.toFixed( 3 ) } m   azimuth ${ state.azimuth.toFixed( 0 ) }°   ` +
            `gaze ${ state.yaw.toFixed( 0 ) }/${ state.pitch.toFixed( 0 ) }°   pupil ${ state.pupil.toFixed( 2 ) }`,
        `refraction ${ eyes.refractionEnabled ? 'on' : 'OFF (flat disc)' }   ` +
            `shader ${ eyes.attached ? 'on' : 'OFF (shipped GLB material)' }`,
        `aperture source: ${ occlusion.apertures.left.source }`,
        eyes.describe()
    ].join( '\n' );

    document.getElementById( 'boot' ).remove();
    if ( bare === false ) hud.textContent = describe();

    // --- the frame clock -----------------------------------------------------------------------
    //
    // Stage drives itself from requestAnimationFrame, which never fires in a pane that performs no
    // layout — the page would render one frame and stall at "booting…" (LEARNINGS §1.12). Probe it,
    // and fall back to a MessageChannel, which is a macrotask a hidden document does not throttle.
    // Counted from inside Stage's own callback rather than by taking the loop away and handing it
    // back. Stealing it means knowing the private field it is stored in, and a rename there fails
    // by leaving the page frozen on a correct-looking first frame — the worst failure shape there
    // is (LEARNINGS §1.3). Counting cannot fail that way: if the loop is alive the count rises.
    let ticks = 0;

    stage.onFrame( () => {

        ticks ++;
        eyes.update();
        if ( bare === false ) hud.textContent = describe();

    } );

    const rafWorks = await new Promise( ( resolve ) => setTimeout( () => resolve( ticks >= 2 ), 250 ) );

    if ( rafWorks === false ) {

        startManualLoop( () => {

            eyes.update();
            stage.renderer._nodes?.nodeFrame?.update();
            stage.renderer.render( stage.scene, stage.camera );
            if ( bare === false ) hud.textContent = describe();

        } );

    }

    // Everything a screenshot harness needs, plus a pixel reader so a region mean can be taken
    // without a round trip through a PNG.
    window.__SUGATA_EYE__ = {

        stage,
        figure,
        eyes,
        occlusion,
        state,
        rafWorks,

        ready: true,

        set( changes ) {

            Object.assign( state, changes );
            applyState();
            return { ...state };

        },

        /**
         * Mean sRGB-encoded Rec.709 luma over a normalised rectangle of the drawing buffer.
         *
         * The same definition `tools/critic/color.mjs` uses, so a number read here and a number
         * read out of a PNG by measure.mjs are the same quantity. measure.mjs on a real file is
         * still the authority; this exists so a sweep of twenty framings does not need twenty PNGs.
         */
        readRegion( x, y, w, h ) {

            const buffer = document.createElement( 'canvas' );
            buffer.width = canvas.width;
            buffer.height = canvas.height;
            buffer.getContext( '2d' ).drawImage( canvas, 0, 0 );

            const x0 = Math.round( x * canvas.width );
            const y0 = Math.round( y * canvas.height );
            const pixels = buffer.getContext( '2d' )
                .getImageData( x0, y0, Math.max( 1, Math.round( w * canvas.width ) ),
                    Math.max( 1, Math.round( h * canvas.height ) ) ).data;

            let luma = 0;
            let red = 0;
            let green = 0;
            let blue = 0;
            const count = pixels.length / 4;

            for ( let index = 0; index < pixels.length; index += 4 ) {

                red += pixels[ index ];
                green += pixels[ index + 1 ];
                blue += pixels[ index + 2 ];

            }

            red /= count * 255;
            green /= count * 255;
            blue /= count * 255;
            luma = 0.2126 * red + 0.7152 * green + 0.0722 * blue;

            return { luma, red, green, blue, count };

        }

    };

}

// --- gaze -----------------------------------------------------------------------------------------

/**
 * Degrees onto the eight `eyeLook*` morphs.
 *
 * "In" and "out" are named relative to the midline, so a single yaw has to drive `In` on one eye
 * and `Out` on the other — which is exactly the fan-out `Figure.setMorph` exists to hide, except
 * that here the two eyes need different morphs rather than the same morph on several meshes.
 */
function applyGaze( figure, state ) {

    const yaw = state.yaw / DEGREES_PER_GAZE_MORPH;
    const pitch = state.pitch / DEGREES_PER_GAZE_MORPH;

    figure.beginFrame();

    for ( const name of GAZE_MORPHS.yawIn ) figure.weights[ name ] = Math.max( 0, yaw );
    for ( const name of GAZE_MORPHS.yawOut ) figure.weights[ name ] = Math.max( 0, -yaw );
    for ( const name of GAZE_MORPHS.up ) figure.weights[ name ] = Math.max( 0, pitch );
    for ( const name of GAZE_MORPHS.down ) figure.weights[ name ] = Math.max( 0, -pitch );

    figure.commit();

}

// --- framing and lighting ----------------------------------------------------------------------

function frameCamera( stage, focus, state ) {

    const halfHeight = state.heightMetres / 2;
    const distance = halfHeight / Math.tan( FIELD_OF_VIEW_DEGREES * Math.PI / 360 );
    const azimuth = state.azimuth * Math.PI / 180;

    stage.camera.position.set(
        focus.x + Math.sin( azimuth ) * distance,
        focus.y,
        focus.z + Math.cos( azimuth ) * distance );
    stage.camera.lookAt( focus );
    stage.camera.updateMatrixWorld( true );

}

function aimRig( lights, backdrop, focus ) {

    // The rig is PINNED at its authored standoff and does not follow the camera.
    //
    // alive.js scales its rig with camera distance, and is right to: there the subject itself
    // changes size, from a head to a whole body, and a key panel authored for a head is inside the
    // silhouette of a body. Here the subject is always one face and only the crop changes — which
    // is a lens change, not a lighting change. Scaling the rig with the crop was tried and it
    // blows the skin out: pulled in to a 75 mm frame the key sits 90 mm off the cheek, and every
    // luma in the picture, including the one G2 gates on, moves with the zoom.
    for ( const { light, placement } of lights ) {

        light.position.set(
            focus.x + placement.offsetMetres[ 0 ],
            focus.y + placement.offsetMetres[ 1 ],
            focus.z + placement.offsetMetres[ 2 ] );
        light.lookAt( focus );

    }

    backdrop.position.set( focus.x, focus.y, focus.z - BACKDROP_DISTANCE_METRES );

}

// --- the frame clock ---------------------------------------------------------------------------

/**
 * A macrotask loop for panes where rAF never fires.
 *
 * `setTimeout(fn, 0)` is throttled to 8 callbacks per second in a hidden document; the same loop
 * over a MessageChannel measured 553,921 per second (LEARNINGS §1.12). That is far more than this
 * page needs, so the loop paces itself off a timestamp and idles between frames.
 */
function startManualLoop( body ) {

    const channel = new MessageChannel();
    let lastMs = 0;

    channel.port1.onmessage = () => {

        const now = performance.now();

        if ( now - lastMs >= 30 ) {

            lastMs = now;
            body();

        }

        channel.port2.postMessage( 0 );

    };

    channel.port2.postMessage( 0 );

}

// --- controls -----------------------------------------------------------------------------------

function bindControls( state, { applyState, eyes, occlusionVisible } ) {

    const slider = ( id, key, format ) => {

        const input = document.getElementById( id );
        const readout = document.getElementById( `${ id }Value` );
        input.value = String( state[ key ] );
        readout.textContent = format( state[ key ] );

        input.addEventListener( 'input', () => {

            state[ key ] = Number( input.value );
            readout.textContent = format( state[ key ] );
            applyState();

        } );

    };

    slider( 'yaw', 'yaw', ( value ) => value.toFixed( 0 ) );
    slider( 'pitch', 'pitch', ( value ) => value.toFixed( 0 ) );
    slider( 'pupil', 'pupil', ( value ) => value.toFixed( 2 ) );
    slider( 'azimuth', 'azimuth', ( value ) => value.toFixed( 0 ) );
    slider( 'height', 'heightMetres', ( value ) => value.toFixed( 3 ) );

    const toggle = ( id, handler ) => {

        const input = document.getElementById( id );
        input.addEventListener( 'change', () => handler( input.checked ) );
        return input;

    };

    toggle( 'occlusion', occlusionVisible );
    toggle( 'shell', ( on ) => { eyes.corneaMesh.visible = on; } );
    toggle( 'catchlight', ( on ) => {

        eyes.catchlightIntensityUniform.value = on ? 1 : 0;

    } );
    toggle( 'shader', ( on ) => {

        if ( on ) eyes.attach(); else eyes.detach();

    } );

    // Refraction is a shader branch chosen at build time, so flipping it needs a reload rather
    // than a uniform. Honest and cheap; the alternative is a permanent runtime branch in the one
    // material whose cost matters.
    toggle( 'refraction', ( on ) => {

        const url = new URL( window.location.href );
        url.searchParams.set( 'refraction', on ? '1' : '0' );
        window.location.href = url.toString();

    } ).checked = eyes.refractionEnabled;

}
