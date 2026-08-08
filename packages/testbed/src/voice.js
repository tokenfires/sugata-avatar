/**
 * voice — the browsercheck for punch-list 4.1, 4.2 and 4.4.
 *
 * `visemes.selftest.mjs` proves the schedule is right in numbers. It cannot prove the mouth MOVES,
 * and LEARNINGS §1.2 is explicit about the difference: "Structural correctness is not visual
 * correctness... If an artifact will ultimately be judged by eye, SOMETHING MUST LOOK AT IT,
 * early." This page is that something. It drives the real `VisemeLayer` through the real
 * `MotionStack` onto the real figure's real morph targets, framed on the mouth, and holds nothing
 * back for a later integration.
 *
 * Three questions it is built to answer, in the order they are easy to fake:
 *
 *   1. **Do the visemes render as visibly DIFFERENT mouths?** `?viseme=PP` holds one shape at its
 *      authored peak. Screenshot four of them and look. A morph set that baked fifteen copies of
 *      the neutral face passes every numeric gate in the selftest except the vertex-space one, and
 *      it would be obvious here in one glance.
 *
 *   2. **Does it animate against a real clock?** The utterance is scheduled against
 *      `AudioContext.currentTime` — the actual clock the audio would be on — not against a frame
 *      counter. ⚠️ A context created without a user gesture starts SUSPENDED and its
 *      `currentTime` does not advance, so the page boots on a `performance.now()` clock and swaps
 *      to the audio clock when "start audio clock" is pressed. The swap is one line, which is the
 *      point of injecting the clock rather than reaching for it.
 *
 *   3. **Is the mouth ahead of the audio?** The strip along the bottom plots the schedule's
 *      weights against time with the lead marked, and `?lead=` moves it. Set it to 0 and the
 *      envelope slides right by exactly the lead.
 *
 * URL parameters, all of them so a screenshot can be reproduced from a string:
 *
 *   ?w=900&h=900     pin the drawing buffer. Required in any pane that performs no layout, where
 *                    clientWidth reads 0 and the buffer comes up 1x1 (LEARNINGS §1.12).
 *   ?viseme=PP       hold one viseme at its authored peak, forever. Any spelling Visemes.js takes.
 *   ?play            start the canned utterance immediately, looping.
 *   ?rate=1.4        time-scale the canned timeline.
 *   ?lead=0          lead in MILLISECONDS. Default 40, the derived ITU-R midpoint.
 *   ?height=0.16     framed height in metres. 0.16 is a mouth crop; 0.42 is alive.js's portrait.
 *   ?azimuth=12      camera azimuth in degrees off the facing axis.
 *   ?gender=0.5      which bake.
 *   ?clock=perf      force the performance.now() clock (the default until audio is started).
 *   ?bare            hide the HUD, the controls and the meter, for a clean plate.
 *   ?webgl           force the WebGL2 tier.
 */

import { Color, Mesh, MeshStandardNodeMaterial, PlaneGeometry, RectAreaLight, RectAreaLightNode, Vector3 }
    from 'three/webgpu';
import { RectAreaLightTexturesLib } from 'three/addons/lights/RectAreaLightTexturesLib.js';

import { Stage } from '../../core/src/render/Stage.js';
import { Figure } from '../../core/src/figure/Figure.js';
import { Identity } from '../../core/src/figure/Identity.js';
import { MotionStack, createMotionTarget } from '../../core/src/motion/MotionStack.js';
import { VisemeLayer } from '../../core/src/voice/VisemeLayer.js';
import { OVR_VISEMES, canonicalViseme, normaliseTimeline, peakFor } from '../../core/src/voice/Visemes.js';
import { envelopeKeys } from '../../core/src/voice/Coarticulation.js';
import { DEFAULT_LEAD_SECONDS } from '../../core/src/voice/VisemeSchedule.js';

// The portrait rig, copied from alive.js rather than imported for the same reason eye.js copies
// it: that file belongs to the motion work and this page must not be able to change what it
// renders. Numbers from docs/research/stellar-blade-look-spec.md § Lighting rig.
const LIGHTING_RIG = [
    { name: 'key', offsetMetres: [ 0.90, 0.45, 0.95 ], sizeMetres: [ 0.85, 1.20 ], colour: 0xfff0dc, intensity: 5.5 },
    { name: 'fill', offsetMetres: [ -1.05, 0.10, 0.85 ], sizeMetres: [ 1.60, 1.60 ], colour: 0xbcd4ff, intensity: 1.9 },
    { name: 'rim', offsetMetres: [ -0.75, 0.55, -0.90 ], sizeMetres: [ 0.45, 1.10 ], colour: 0x8fb6ff, intensity: 16 },
    { name: 'kicker', offsetMetres: [ 0.95, -0.10, -0.80 ], sizeMetres: [ 0.35, 1.00 ], colour: 0xffbe8c, intensity: 10 }
];

const BACKDROP_EMISSIVE = 0x11151f;
const BACKDROP_DISTANCE_METRES = 1.9;
const FIELD_OF_VIEW_DEGREES = 26;

/**
 * The mouth sits below the head bone's origin. 0.075 m is measured off the shipped rig at load
 * (see `findMouthFocus`) rather than assumed; this is only the starting guess the search refines.
 */
const MOUTH_BELOW_HEAD_METRES = 0.075;

/**
 * The canned utterance. Deliberately the SAME one `visemes.selftest.mjs` gates, so what is on
 * screen and what is measured are the same timeline rather than two that resemble each other.
 * It is synthetic and is not a transcription of speech.
 */
const CANNED_TIMELINE = [
    { viseme: 'sil',        startTime: 0.000, duration: 0.080 },
    { viseme: 'viseme_PP',  startTime: 0.080, duration: 0.070 },
    { viseme: 'viseme_aa',  startTime: 0.150, duration: 0.110 },
    { viseme: 'viseme_nn',  startTime: 0.260, duration: 0.045 },
    { viseme: 'viseme_nn',  startTime: 0.305, duration: 0.045 },
    { viseme: 11,           startTime: 0.350, duration: 0.140 },
    { viseme: 12,           startTime: 0.490, duration: 0.040 },
    { viseme: 'f_v_18',     startTime: 0.530, duration: 0.075 },
    { viseme: 'ou',         startTime: 0.605, duration: 0.260 },
    { viseme: 'sil',        startTime: 0.865, duration: 0.120 }
];

/** The four shapes a screenshot pass should compare. Chosen to be maximally unlike each other. */
const SCREENSHOT_POSES = [ 'viseme_sil', 'viseme_PP', 'viseme_aa', 'viseme_U', 'viseme_FF' ];

const LOOP_GAP_SECONDS = 0.4;

boot().catch( ( error ) => {

    document.getElementById( 'boot' ).textContent = `failed: ${ error.message }`;
    console.error( error );

} );

async function boot() {

    const query = new URLSearchParams( window.location.search );
    const canvas = document.getElementById( 'stage' );

    const width = Number( query.get( 'w' ) ?? 0 ) || canvas.clientWidth || 900;
    const height = Number( query.get( 'h' ) ?? 0 ) || canvas.clientHeight || 900;

    // A pinned drawing buffer and a CSS box that fills the window are two different aspect ratios,
    // and the canvas stretches to reconcile them. Letterbox instead.
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

    // Without the LTC tables RectAreaLight contributes nothing and the figure renders black.
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

    figure.root.updateMatrixWorld( true );

    // --- the clock -------------------------------------------------------------------------
    //
    // Boots on performance.now() because an AudioContext created without a user gesture is
    // SUSPENDED and its currentTime never advances — the page would render one still mouth and
    // look broken. `clockSource` is swapped, not rebuilt, because VisemeSchedule holds the
    // function rather than the context.
    const clockSource = { now: () => performance.now() / 1000, name: 'performance.now()' };
    let audioContext = null;

    const startAudioClock = async () => {

        if ( audioContext === null ) audioContext = new AudioContext();
        await audioContext.resume();

        clockSource.now = () => audioContext.currentTime;
        clockSource.name = `AudioContext.currentTime @ ${ audioContext.sampleRate } Hz`;

        // Re-anchor whatever is speaking, or the utterance jumps to a different clock's origin.
        if ( state.playing ) startUtterance();

    };

    // --- the stack -------------------------------------------------------------------------

    const leadSeconds = query.has( 'lead' )
        ? Number( query.get( 'lead' ) ) / 1000
        : DEFAULT_LEAD_SECONDS;

    const stack = new MotionStack( { seed: 1 } );
    stack.bind( createMotionTarget( figure.root ) );

    const state = {
        rate: Number( query.get( 'rate' ) ?? 1 ),
        heldViseme: undefined,
        playing: false,
        utteranceStart: 0,

        /**
         * 🚩 HOW A VISEME IS HELD, AND WHY IT IS NOT A LONG TIMELINE ENTRY.
         *
         * The first version of this page held a shape by scheduling it for an hour. It rendered a
         * closed mouth, and the schedule was right: research §3 caps a viseme's sustain at 200 ms,
         * so a 3600 s entry ends 200 ms after it starts and the rest is silence. That cap is a
         * correct property of speech and must not be special-cased away for a screenshot.
         *
         * So a hold FREEZES THE CLOCK instead, at the middle of the shape's own sustain. The
         * schedule, the envelope, the cap and the morph path are all exactly the shipped ones —
         * only time stops, which is the same trick `alive.html?freeze` uses.
         */
        frozenAudioTime: null,

        azimuth: Number( query.get( 'azimuth' ) ?? 12 ),
        heightMetres: Number( query.get( 'height' ) ?? 0.16 )
    };

    const speech = new VisemeLayer( {
        clock: () => state.frozenAudioTime ?? clockSource.now(),
        leadSeconds
    } );
    stack.add( speech );

    /** Poses one shape at the middle of its sustain, through the shipped schedule. */
    const holdViseme = ( name ) => {

        const canonical = canonicalViseme( name );
        if ( ! OVR_VISEMES.includes( canonical ) ) return false;

        const entry = { viseme: canonical, startTime: 0, duration: 0.200 };
        speech.speak( [ entry ], { at: 0 } );

        const keys = envelopeKeys( entry );
        state.frozenAudioTime = ( keys.peak + keys.releaseStart ) / 2 - speech.schedule.leadSeconds;
        state.heldViseme = canonical;
        state.playing = true;

        return true;

    };

    const scaledTimeline = () => CANNED_TIMELINE.map( ( entry ) => ( {
        viseme: entry.viseme,
        startTime: entry.startTime / state.rate,
        duration: entry.duration / state.rate
    } ) );

    const startUtterance = () => {

        state.frozenAudioTime = null;
        state.heldViseme = undefined;
        state.utteranceStart = clockSource.now();
        speech.speak( scaledTimeline(), { at: state.utteranceStart } );
        state.playing = true;

    };

    if ( query.has( 'viseme' ) ) {

        if ( holdViseme( query.get( 'viseme' ) ) === false ) {

            console.warn( `voice: '${ query.get( 'viseme' ) }' is not a viseme. Nothing held.` );

        }

    } else if ( query.has( 'play' ) ) {

        startUtterance();

    }

    // --- framing ---------------------------------------------------------------------------

    const focus = findMouthFocus( figure );

    const applyFraming = () => {

        frameCamera( stage, focus, state );
        aimRig( lights, backdrop, focus );

    };

    applyFraming();

    // --- UI ----------------------------------------------------------------------------------

    const bare = query.has( 'bare' );
    const hud = document.getElementById( 'hud' );
    const meter = document.getElementById( 'meter' );

    if ( bare ) {

        for ( const id of [ 'hud', 'controls', 'meter' ] ) document.getElementById( id ).style.display = 'none';

    } else {

        buildControls( { state, speech, startUtterance, startAudioClock, leadSeconds } );
        sizeMeter( meter );

    }

    document.getElementById( 'boot' ).remove();

    // --- the frame clock -----------------------------------------------------------------------
    //
    // Stage drives itself from requestAnimationFrame, which never fires in a pane that performs no
    // layout (LEARNINGS §1.12). Probe it and fall back to a MessageChannel, counting from inside
    // Stage's own callback rather than taking the loop away.
    let ticks = 0;
    let lastClock = clockSource.now();

    const tick = () => {

        ticks ++;

        const now = clockSource.now();
        const deltaSeconds = Math.max( 0, now - lastClock );
        lastClock = now;

        // Loop the utterance so a page left open keeps moving. A held pose never expires.
        if ( state.playing && state.heldViseme === undefined
            && now > state.utteranceStart + speech.schedule.durationSeconds + LOOP_GAP_SECONDS ) {

            startUtterance();

        }

        stack.update( deltaSeconds );

        if ( bare === false ) {

            hud.textContent = describe( { stage, speech, state, clockSource, leadSeconds, width, height } );
            drawMeter( meter, speech, state, clockSource );

        }

    };

    stage.onFrame( tick );

    const rafWorks = await new Promise( ( resolve ) => setTimeout( () => resolve( ticks >= 2 ), 250 ) );

    if ( rafWorks === false ) {

        startManualLoop( () => {

            tick();
            stage.renderer._nodes?.nodeFrame?.update();
            stage.renderer.render( stage.scene, stage.camera );

        } );

    }

    // Everything a screenshot harness needs.
    window.__SUGATA_VOICE__ = {

        stage,
        figure,
        stack,
        speech,
        state,
        rafWorks,
        ready: true,

        /** The committed influence of a morph, read back off the mesh. The ground truth. */
        morphOnMesh( name ) {

            const locations = figure.morphRegistry.get( name );
            if ( locations === undefined ) return null;
            return locations[ 0 ].influences[ locations[ 0 ].index ];

        },

        /** Every viseme currently above zero on the figure. What a screenshot is showing. */
        activeVisemes() {

            const active = {};
            for ( const name of OVR_VISEMES ) {

                const value = this.morphOnMesh( name );
                if ( value > 1e-4 ) active[ name ] = value;

            }
            return active;

        },

        hold: holdViseme,

        play: startUtterance,
        startAudioClock,
        poses: SCREENSHOT_POSES

    };

}

/**
 * Where the mouth is, in the figure's own space.
 *
 * Read off the rig rather than typed in: the head bone's world position, dropped by a fraction of
 * the head's own height. The drop is a fraction rather than a constant so it survives the gender
 * bakes, which differ in stature.
 */
function findMouthFocus( figure ) {

    const head = figure.bone( 'head' );
    const neck = figure.bone( 'neck' );

    if ( head === undefined ) {

        // No head bone: fall back to the figure's bounding box, at the classic 0.88 of stature.
        const box = new Vector3();
        figure.root.updateMatrixWorld( true );
        figure.body.geometry.computeBoundingBox();
        figure.body.geometry.boundingBox.getSize( box );
        return new Vector3( 0, box.y * 0.88, 0 );

    }

    const headWorld = new Vector3();
    head.getWorldPosition( headWorld );

    if ( neck !== undefined ) {

        const neckWorld = new Vector3();
        neck.getWorldPosition( neckWorld );

        // The head bone sits at the atlanto-occipital joint and the mouth is roughly one
        // neck-to-head span below the crown; half that span below the head bone puts the frame on
        // the lips on every bake tried.
        const span = Math.abs( headWorld.y - neckWorld.y );
        return new Vector3( headWorld.x, headWorld.y - span * 0.5, headWorld.z + 0.02 );

    }

    return new Vector3( headWorld.x, headWorld.y - MOUTH_BELOW_HEAD_METRES, headWorld.z + 0.02 );

}

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

/** The rig is pinned at its authored standoff and does not follow the crop. Same reasoning as eye.js. */
function aimRig( lights, backdrop, focus ) {

    for ( const { light, placement } of lights ) {

        light.position.set(
            focus.x + placement.offsetMetres[ 0 ],
            focus.y + placement.offsetMetres[ 1 ],
            focus.z + placement.offsetMetres[ 2 ] );
        light.lookAt( focus );

    }

    backdrop.position.set( focus.x, focus.y, focus.z - BACKDROP_DISTANCE_METRES );

}

function describe( { stage, speech, state, clockSource, leadSeconds, width, height } ) {

    const weights = speech.schedule.weights;
    const active = OVR_VISEMES
        .filter( ( name ) => weights[ name ] > 0.005 )
        .map( ( name ) => `${ name.slice( 7 ) } ${ weights[ name ].toFixed( 3 ) }` );

    const elapsed = clockSource.now() - state.utteranceStart;

    return [
        `backend ${ stage.backendName }   ${ Math.round( stage.fps ) } fps   ${ width }x${ height }`,
        `clock  ${ clockSource.name }`,
        `lead   ${ ( leadSeconds * 1000 ).toFixed( 0 ) } ms  (ITU-R BT.1359-1: mouth may be 125 ms early, 45 ms late)`,
        `rate   ${ state.rate.toFixed( 2 ) }x   utterance ${ speech.schedule.durationSeconds.toFixed( 3 ) } s   ` +
            `t ${ elapsed.toFixed( 3 ) } s`,
        state.heldViseme !== undefined && typeof state.heldViseme === 'string'
            ? `HELD   ${ state.heldViseme } at ${ peakFor( state.heldViseme ) }`
            : `speaking ${ speech.speaking ? 'yes' : 'no' }`,
        `active ${ active.length > 0 ? active.join( '   ' ) : '(silent)' }`
    ].join( '\n' );

}

/**
 * The strip along the bottom: the schedule's weights over the whole utterance, with NOW marked in
 * two places — where the audio is, and where the mouth is. The gap between them IS the lead, and
 * it is the only way to see 4.4 rather than read about it.
 */
function drawMeter( meter, speech, state, clockSource ) {

    const context = meter.getContext( '2d' );
    const { width, height } = meter;

    context.clearRect( 0, 0, width, height );

    const timeline = speech.schedule.timeline;
    if ( timeline.length === 0 ) return;

    const span = speech.schedule.durationSeconds;
    if ( span <= 0 ) return;

    const colours = [ '#7fd4ff', '#ffb37f', '#b8ff7f', '#ff7fd4', '#ffe97f', '#7f9bff' ];
    const shapes = [ ...new Set( timeline.map( ( entry ) => entry.viseme ) ) ];

    const startAudio = state.utteranceStart;

    for ( let index = 0; index < shapes.length; index ++ ) {

        context.strokeStyle = colours[ index % colours.length ];
        context.lineWidth = 1.5;
        context.beginPath();

        for ( let column = 0; column < width; column ++ ) {

            const audioTime = startAudio + ( column / width ) * span;
            const weights = speech.schedule.sampleAt( audioTime );
            const y = height - 6 - weights[ shapes[ index ] ] * ( height - 14 );

            if ( column === 0 ) context.moveTo( column, y );
            else context.lineTo( column, y );

        }

        context.stroke();

    }

    // Restore the schedule's live sample; the sweep above left it wherever the last column was.
    speech.schedule.sampleAt( clockSource.now() );

    const nowColumn = ( ( clockSource.now() - startAudio ) / span ) * width;
    const mouthColumn = ( ( clockSource.now() - startAudio + speech.schedule.leadSeconds ) / span ) * width;

    context.strokeStyle = 'rgba(255,255,255,0.55)';
    context.lineWidth = 1;
    context.beginPath();
    context.moveTo( nowColumn, 0 );
    context.lineTo( nowColumn, height );
    context.stroke();

    context.strokeStyle = '#ff5555';
    context.beginPath();
    context.moveTo( mouthColumn, 0 );
    context.lineTo( mouthColumn, height );
    context.stroke();

    context.fillStyle = 'rgba(255,255,255,0.6)';
    context.font = '10px ui-monospace, monospace';
    context.fillText( 'audio', nowColumn + 3, 11 );
    context.fillStyle = '#ff8888';
    context.fillText( 'mouth', mouthColumn + 3, 24 );

}

function sizeMeter( meter ) {

    const resize = () => {

        const rect = meter.getBoundingClientRect();
        meter.width = Math.max( 1, Math.round( rect.width ) );
        meter.height = Math.max( 1, Math.round( rect.height ) );

    };

    resize();
    window.addEventListener( 'resize', resize );

}

function buildControls( { state, speech, startUtterance, startAudioClock, leadSeconds } ) {

    document.getElementById( 'play' ).addEventListener( 'click', () => {

        state.heldViseme = undefined;
        startUtterance();

    } );

    document.getElementById( 'stop' ).addEventListener( 'click', () => {

        state.playing = false;
        state.heldViseme = undefined;
        state.frozenAudioTime = null;
        speech.stop();

    } );

    document.getElementById( 'audio' ).addEventListener( 'click', startAudioClock );

    const rate = document.getElementById( 'rate' );
    rate.value = String( state.rate );
    document.getElementById( 'rateValue' ).textContent = state.rate.toFixed( 2 );

    rate.addEventListener( 'input', () => {

        state.rate = Number( rate.value );
        document.getElementById( 'rateValue' ).textContent = state.rate.toFixed( 2 );
        if ( state.playing && state.heldViseme === undefined ) startUtterance();

    } );

    const lead = document.getElementById( 'lead' );
    lead.value = String( Math.round( leadSeconds * 1000 ) );
    document.getElementById( 'leadValue' ).textContent = String( Math.round( leadSeconds * 1000 ) );

    lead.addEventListener( 'input', () => {

        speech.schedule.leadSeconds = Number( lead.value ) / 1000;
        document.getElementById( 'leadValue' ).textContent = lead.value;

    } );

    const poses = document.getElementById( 'poses' );

    for ( const name of SCREENSHOT_POSES ) {

        const button = document.createElement( 'button' );
        button.textContent = name.slice( 7 );
        button.addEventListener( 'click', () => window.__SUGATA_VOICE__.hold( name ) );
        poses.appendChild( button );

    }

}

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

// Referenced by the header's documentation of what a normalised timeline looks like; also the one
// import that would otherwise be unused, and removing it would remove the page's ability to print
// the normalised form when debugging a timeline that does not look right.
window.__SUGATA_NORMALISE__ = normaliseTimeline;
