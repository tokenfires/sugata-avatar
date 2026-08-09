/**
 * affect — the browsercheck for punch-list 5.1, 5.2, 5.4 and 5.5.
 *
 * `affect.selftest.mjs` proves 91 things about the numbers. It cannot prove a face is LEGIBLE, and
 * LEARNINGS §1.2 is blunt about the difference: "Structural correctness is not visual correctness...
 * If an artifact will ultimately be judged by eye, SOMETHING MUST LOOK AT IT, early." That is what
 * this page is for. It drives the real `ExpressionLayer` through the real `MotionStack` onto the
 * real figure's real morph targets, framed as a portrait, and holds nothing back for a later
 * integration.
 *
 * Five questions it is built to answer, in the order they are easy to fake:
 *
 *   1. **Are three emotions three legible faces?** `?emotion=anger&settle` poses one, settled, so a
 *      screenshot is reproducible from a string. The selftest measures that four emotions are four
 *      different morph VECTORS — closest pair anger/fear at 0.2553 RMS — which is not the same
 *      claim as "a person can tell them apart", and only a judge can make that one.
 *
 *   2. **Does dominance stay off the face?** Drag the dominance slider. The PAD readout moves, the
 *      body prescription in the HUD moves, and the AU table does not — except where dominance
 *      changed WHICH EMOTION is selected, which is categorical and is the one thing dominance is
 *      for. Anger and fear at the same P and A are the demonstration.
 *
 *   3. **Does the mouth stay lipsync's?** Press "speak" and then any emotion preset. The viseme
 *      envelope in the strip along the bottom does not change shape; only the corner offset moves,
 *      and it is drawn separately so the two can be seen not to interfere.
 *
 *   4. **Does it threshold rather than blend?** The strip's right-hand panel shows every emotion's
 *      activation weight. One or two bars, ever. Sweep the sliders and watch bars switch on and off
 *      at a hard edge instead of the whole set breathing together.
 *
 *   5. **Do the two timescales separate?** The mood bar creeps while the emotion bar snaps.
 *      `?fastmood` runs the mood clock 600x so ten minutes of it fits in a second, because the
 *      honest version of this demonstration is unwatchable and the accelerated one is the same
 *      arithmetic.
 *
 * URL parameters, all of them so a screenshot can be reproduced from a string:
 *
 *   ?w=1400&h=1800  pin the drawing buffer. Required in any pane that performs no layout, where
 *                   clientWidth reads 0 and the buffer comes up 1x1 (LEARNINGS §1.12).
 *   ?emotion=anger  one of the presets below.
 *   ?pad=-0.8,0.7,0.7   raw PAD, comma separated.
 *   ?settle         jump the affect state to its settled value instead of easing into it. A
 *                   still plate of a face mid-attack is a plate of a different face.
 *   ?speak          start the canned utterance immediately, looping, under the expression.
 *   ?fastmood       run the mood layer 600x, so ALMA's ten minutes takes one second.
 *   ?height=0.42    framed height in metres. 0.42 is alive.js's portrait; 0.16 is a mouth crop.
 *   ?azimuth=12     camera azimuth in degrees off the facing axis.
 *   ?gender=0.5     which bake.
 *   ?bare           hide the HUD, the controls and the strip, for a clean plate.
 *   ?webgl          force the WebGL2 tier.
 */

import { EMOTION_PRESETS } from './affect-presets.js';
import { Box3, Color, Mesh, MeshStandardNodeMaterial, PlaneGeometry, RectAreaLight, RectAreaLightNode, Vector3 }
    from 'three/webgpu';
import { RectAreaLightTexturesLib } from 'three/addons/lights/RectAreaLightTexturesLib.js';

import { Stage } from '../../core/src/render/Stage.js';
import { Figure } from '../../core/src/figure/Figure.js';
import { Identity } from '../../core/src/figure/Identity.js';
import { MotionStack, createMotionTarget } from '../../core/src/motion/MotionStack.js';
import { VisemeLayer } from '../../core/src/voice/VisemeLayer.js';
import { OVR_VISEMES } from '../../core/src/voice/Visemes.js';

import { AffectState } from '../../core/src/affect/AffectState.js';
import { ExpressionLayer } from '../../core/src/affect/ExpressionLayer.js';
import { ANCHOR_SETS, EMOTION_MORPHS, ExpressionMap, MOUTH_CORNER_MORPHS }
    from '../../core/src/affect/ExpressionMap.js';
import { ReflexAffect } from '../../core/src/affect/ReflexAffect.js';

// The portrait rig, copied from alive.js rather than imported for the same reason voice.js copies
// it: that file belongs to the render work and this page must not be able to change what it
// renders. Numbers from docs/research/stellar-blade-look-spec.md § Lighting rig.
const LIGHTING_RIG = [
    { name: 'key', offsetMetres: [ 0.90, 0.45, 0.95 ], sizeMetres: [ 0.85, 1.20 ], colour: 0xfff0dc, intensity: 5.5 },
    { name: 'fill', offsetMetres: [ -1.05, 0.10, 0.85 ], sizeMetres: [ 1.60, 1.60 ], colour: 0xbcd4ff, intensity: 1.9 },
    { name: 'rim', offsetMetres: [ -0.75, 0.55, -0.90 ], sizeMetres: [ 0.45, 1.10 ], colour: 0x8fb6ff, intensity: 16 },
    { name: 'kicker', offsetMetres: [ 0.95, -0.10, -0.80 ], sizeMetres: [ 0.35, 1.00 ], colour: 0xffbe8c, intensity: 10 }
];

const BACKDROP_EMISSIVE = 0x11151f;
const BACKDROP_DISTANCE_METRES = 1.9;

// alive.js's portrait numbers, so a plate from this page is framed like a plate from that one.
const PORTRAIT_FIELD_OF_VIEW_DEGREES = 26;
const PORTRAIT_HEIGHT_METRES = 0.42;
const EYE_LINE_FROM_TOP = 1 / 3;
const CAMERA_AZIMUTH_DEGREES = 12;
const EYEBALL_MESH_PATTERN = /high-poly|low-poly|eyeball/i;

// The preset table lives in `./affect-presets.js`, shared with `alive.js`'s `?affect=`.


/**
 * The canned utterance, the same one `voice.js` uses, so what is under the corner offset here is
 * the same mouth that page gates. Synthetic; not a transcription of speech.
 */
const CANNED_TIMELINE = [
    { viseme: 'sil', startTime: 0.000, duration: 0.080 },
    { viseme: 'viseme_PP', startTime: 0.080, duration: 0.070 },
    { viseme: 'viseme_aa', startTime: 0.150, duration: 0.110 },
    { viseme: 'viseme_nn', startTime: 0.260, duration: 0.045 },
    { viseme: 'viseme_aa', startTime: 0.350, duration: 0.140 },
    { viseme: 'viseme_E', startTime: 0.490, duration: 0.040 },
    { viseme: 'viseme_FF', startTime: 0.530, duration: 0.075 },
    { viseme: 'viseme_O', startTime: 0.605, duration: 0.260 },
    { viseme: 'sil', startTime: 0.865, duration: 0.120 }
];

const LOOP_GAP_SECONDS = 0.4;

/** How much the mood clock is accelerated by `?fastmood`. ALMA's 600 s becomes one second. */
const FAST_MOOD_FACTOR = 600;

boot().catch( ( error ) => {

    const overlay = document.getElementById( 'boot' );
    const reached = ( window.__SUGATA_AFFECT_BOOT__ ?? [] ).join( ' -> ' );

    if ( overlay !== null ) overlay.textContent = `failed after [${ reached }]: ${ error.message }`;

    // 🚩 Logged as well as shown. The overlay is removed on the LAST line of a successful boot, so
    // a failure on that line writes a message onto an element that is already gone.
    console.error( `affect: boot failed after [${ reached }]`, error );

} );

async function boot() {

    const query = new URLSearchParams( window.location.search );
    const canvas = document.getElementById( 'stage' );

    // ⚠️ The boot overlay reports WHERE it got to, not just that it is booting.
    //
    // This page's first run hung on a black screen reading "booting…" with an empty console, and
    // the reason was a `const` read from a function called before the `const` was initialised — a
    // temporal-dead-zone ReferenceError thrown inside an async function whose rejection handler
    // then rewrote the same element the next line was about to remove. A one-word overlay cannot
    // tell "still loading a 40 MB GLB" from "threw four lines ago"; a staged one can, and it costs
    // one line per stage.
    const boot = document.getElementById( 'boot' );
    const stageMarks = [];
    const mark = ( label ) => {

        stageMarks.push( label );
        boot.textContent = `booting… ${ label }`;
        window.__SUGATA_AFFECT_BOOT__ = stageMarks;

    };

    mark( 'renderer' );

    const width = Number( query.get( 'w' ) ?? 0 ) || canvas.clientWidth || 1000;
    const height = Number( query.get( 'h' ) ?? 0 ) || canvas.clientHeight || 1300;

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
        fieldOfView: PORTRAIT_FIELD_OF_VIEW_DEGREES,
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

    mark( 'identity' );

    const identity = new Identity( { gender: Number( query.get( 'gender' ) ?? 0.5 ) } );
    const plan = await identity.resolve();

    mark( 'figure' );

    const figure = await Figure.load( plan.figures[ 0 ].url );
    stage.add( figure.root );

    figure.root.updateMatrixWorld( true );

    mark( 'affect' );

    // --- affect ------------------------------------------------------------------------------

    const state = new AffectState();
    const map = new ExpressionMap();
    const reflex = new ReflexAffect();

    const stack = new MotionStack( { seed: 1 } );
    stack.bind( createMotionTarget( figure.root ) );

    // 🚩 `advanceState: false`. The page owns the affect clock, because `?fastmood` scales it and
    // because the HUD needs the state advanced before it reads it. Two clocks over one state would
    // double its rate, which is the kind of defect that looks like a tuning problem.
    const affect = new ExpressionLayer( { state, map, advanceState: false } );
    stack.add( affect );

    const speech = new VisemeLayer( { clock: () => performance.now() / 1000 } );
    stack.add( speech );

    const session = {
        moodFactor: query.has( 'fastmood' ) ? FAST_MOOD_FACTOR : 1,
        speaking: false,
        utteranceStart: 0,
        preset: 'neutral',
        heightMetres: Number( query.get( 'height' ) ?? PORTRAIT_HEIGHT_METRES ),
        azimuth: Number( query.get( 'azimuth' ) ?? CAMERA_AZIMUTH_DEGREES )
    };

    // 🚩 DECLARED HERE, NOT DOWN IN THE UI BLOCK WHERE THEY ARE USED. `applyPreset` runs while the
    // query string is being read, several statements above where the UI is built, and it calls
    // `syncSliders`, which reads `bare`. A `const` read before its initialiser is a ReferenceError,
    // not `undefined`, and this page shipped that bug for exactly one run: black screen, "booting…",
    // empty console, because the rejection handler rewrote the overlay with a message the next line
    // would have removed anyway. Hoisting is not a substitute for ordering.
    const bare = query.has( 'bare' );
    const hud = document.getElementById( 'hud' );
    const meter = document.getElementById( 'meter' );

    function syncSliders() {

        if ( bare === true ) return;

        for ( const axis of [ 'pleasure', 'arousal', 'dominance' ] ) {

            const slider = document.getElementById( axis );
            slider.value = String( state.target[ axis ] );
            document.getElementById( `${ axis }Value` ).textContent = state.target[ axis ].toFixed( 2 );

        }

    }

    /**
     * Poses a PAD point.
     *
     * `settle` runs the state forward at a large fixed step until the fast layer has arrived, which
     * is the same arithmetic the frame loop does and not a back door — a still plate of a face
     * caught mid-attack is a plate of a different face, and there is no other way to make a
     * screenshot of an expression reproducible.
     */
    const pose = ( pad, { settle = false } = {} ) => {

        map.clearTriggers();
        if ( pad.trigger !== undefined ) map.trigger( pad.trigger );

        state.push( { pleasure: pad.pleasure, arousal: pad.arousal, dominance: pad.dominance } );

        if ( settle === true ) {

            // 3 s is fifteen attack time constants; the residual is under 1e-6 of an axis.
            for ( let step = 0; step < 300; step ++ ) state.update( 0.01 );

        }

    };

    const applyPreset = ( name ) => {

        const preset = EMOTION_PRESETS[ name ];
        if ( preset === undefined ) return false;

        session.preset = name;
        pose( preset, { settle: true } );
        syncSliders();

        return true;

    };

    if ( query.has( 'pad' ) ) {

        const [ pleasure, arousal, dominance ] = String( query.get( 'pad' ) ).split( ',' ).map( Number );
        session.preset = 'custom';
        pose( { pleasure, arousal, dominance }, { settle: query.has( 'settle' ) } );

    } else if ( query.has( 'emotion' ) ) {

        if ( applyPreset( query.get( 'emotion' ) ) === false ) {

            console.warn( `affect: '${ query.get( 'emotion' ) }' is not a preset. Known: ${ Object.keys( EMOTION_PRESETS ).join( ', ' ) }.` );

        }

    }

    const startUtterance = () => {

        session.utteranceStart = performance.now() / 1000;
        speech.speak( CANNED_TIMELINE, { at: session.utteranceStart } );
        session.speaking = true;

    };

    if ( query.has( 'speak' ) ) startUtterance();

    // --- framing -----------------------------------------------------------------------------

    const focus = new Vector3( 0, eyeLineHeight( figure ) + session.heightMetres * ( EYE_LINE_FROM_TOP - 0.5 ), 0 );

    frameCamera( stage, focus, session );
    aimRig( lights, backdrop, focus );

    // --- UI ------------------------------------------------------------------------------------

    mark( 'ui' );

    if ( bare ) {

        for ( const id of [ 'hud', 'controls', 'meter' ] ) document.getElementById( id ).style.display = 'none';

    } else {

        buildControls( { state, map, reflex, session, applyPreset, startUtterance, speech, syncSliders } );
        syncSliders();
        sizeMeter( meter );

    }

    boot.remove();

    // --- the frame clock -------------------------------------------------------------------------
    //
    // Stage drives itself from requestAnimationFrame, which never fires in a pane that performs no
    // layout (LEARNINGS §1.12). Probe it and fall back to a MessageChannel, counting from inside
    // Stage's own callback rather than taking the loop away.
    let ticks = 0;
    let lastSeconds = performance.now() / 1000;

    const tick = () => {

        ticks ++;

        const now = performance.now() / 1000;
        const deltaSeconds = Math.min( Math.max( 0, now - lastSeconds ), 0.1 );
        lastSeconds = now;

        // 🚩 The mood accelerator scales the WHOLE affect clock, not just the mood layer, because
        // scaling one layer's rate and not the other would make the page a demonstration of a
        // system this repo does not ship. `?fastmood` therefore also makes the fast layer 600x
        // faster, which is invisible — it was already arriving inside one frame.
        state.update( deltaSeconds * session.moodFactor );

        if ( session.speaking === true
            && now > session.utteranceStart + speech.schedule.durationSeconds + LOOP_GAP_SECONDS ) {

            startUtterance();

        }

        stack.update( deltaSeconds );

        if ( bare === false ) {

            hud.textContent = describe( { stage, state, affect, session, width, height, reflex } );
            drawMeter( meter, { state, affect, speech, session } );

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
    window.__SUGATA_AFFECT__ = {

        stage,
        figure,
        stack,
        state,
        map,
        reflex,
        affect,
        session,
        rafWorks,
        ready: true,
        presets: Object.keys( EMOTION_PRESETS ),

        /** The committed influence of a morph, read back off the mesh. The ground truth. */
        morphOnMesh( name ) {

            const locations = figure.morphRegistry.get( name );
            if ( locations === undefined ) return null;
            return locations[ 0 ].influences[ locations[ 0 ].index ];

        },

        /** Every expression morph currently above zero on the figure. What a screenshot is showing. */
        activeMorphs() {

            const active = {};
            for ( const name of [ ...EMOTION_MORPHS, ...MOUTH_CORNER_MORPHS, ...OVR_VISEMES ] ) {

                const value = this.morphOnMesh( name );
                if ( value > 1e-4 ) active[ name ] = Number( value.toFixed( 4 ) );

            }
            return active;

        },

        /** What the layer decided this frame — emotions, AUs, and the body prescription. */
        readout() {

            return {
                pad: state.pad,
                mood: { ...state.mood },
                moodOctant: state.moodOctant,
                activations: affect.activations,
                aus: affect.faceResult?.aus ?? null,
                mouthCornerOffset: affect.faceResult?.mouthCornerOffset ?? null,
                speechOwned: affect.faceResult?.speechOwned ?? null,
                body: affect.bodyPrescription
            };

        },

        pose: ( pad, options ) => { pose( pad, options ); syncSliders(); },
        preset: applyPreset,
        speak: startUtterance

    };

}

// --- framing -------------------------------------------------------------------------------

/** alive.js's eye-line read, copied for the same reason the rig is: this page must not change it. */
function eyeLineHeight( figure ) {

    let eyeballs = null;
    figure.root.traverse( ( object ) => {

        if ( object.isMesh === true && EYEBALL_MESH_PATTERN.test( object.name ) ) eyeballs = object;

    } );

    if ( eyeballs !== null ) return new Box3().setFromObject( eyeballs ).getCenter( new Vector3() ).y;

    console.warn( `affect: no mesh matching ${ EYEBALL_MESH_PATTERN } — the portrait frame is ` +
        'guessing at the eye line from the top of the bounding box.' );

    return new Box3().setFromObject( figure.root ).max.y - 0.11;

}

function frameCamera( stage, focus, session ) {

    const distance = ( session.heightMetres / 2 ) / Math.tan( PORTRAIT_FIELD_OF_VIEW_DEGREES * Math.PI / 360 );
    const azimuth = session.azimuth * Math.PI / 180;

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

// --- HUD -------------------------------------------------------------------------------------

function describe( { stage, state, affect, session, width, height, reflex } ) {

    const pad = state.pad;
    const face = affect.faceResult;
    const body = affect.bodyPrescription;

    const aus = face === null ? '' : Object.entries( face.aus )
        .filter( ( [ , value ] ) => value > 0.005 )
        .map( ( [ unit, value ] ) => `${ unit } ${ value.toFixed( 2 ) }` )
        .join( '  ' );

    return [
        `backend ${ stage.backendName }   ${ Math.round( stage.fps ) } fps   ${ width }x${ height }`,
        `preset  ${ session.preset }${ session.moodFactor > 1 ? `   mood clock ${ session.moodFactor }x` : '' }`,
        '',
        `target  P ${ signed( state.target.pleasure ) }  A ${ signed( state.target.arousal ) }  D ${ signed( state.target.dominance ) }`,
        `emotion P ${ signed( state.emotion.pleasure ) }  A ${ signed( state.emotion.arousal ) }  D ${ signed( state.emotion.dominance ) }   (attack 200 ms / decay 2.25 s)`,
        `mood    P ${ signed( state.mood.pleasure ) }  A ${ signed( state.mood.arousal ) }  D ${ signed( state.mood.dominance ) }   ${ state.moodOctant } ${ state.moodStrength.toFixed( 3 ) }`,
        `pad     P ${ signed( pad.pleasure ) }  A ${ signed( pad.arousal ) }  D ${ signed( pad.dominance ) }`,
        '',
        `active  ${ affect.activations.length === 0 ? '(neutral)' : affect.activations.map( ( a ) => `${ a.emotion } ${ a.weight.toFixed( 3 ) }${ a.saturated ? ' SAT' : '' }` ).join( '   ' ) }`,
        `AUs     ${ aus || '(none)' }`,
        `mouth   AU12 offset ${ ( face?.mouthCornerOffset.smile ?? 0 ).toFixed( 3 ) }  ` +
            `AU15 offset ${ ( face?.mouthCornerOffset.frown ?? 0 ).toFixed( 3 ) }   ADDITIVE, over the viseme`,
        `unrouted AU25 ${ ( face?.speechOwned.AU25 ?? 0 ).toFixed( 2 ) }  AU26 ${ ( face?.speechOwned.AU26 ?? 0 ).toFixed( 2 ) }  AU10 ${ ( face?.speechOwned.AU10 ?? 0 ).toFixed( 2 ) }   the mouth belongs to lipsync`,
        '',
        '🚩 DOMINANCE GOES HERE, NEVER TO THE FACE',
        `body    approach ${ signed( body?.approach ?? 0 ) }  armSpread ${ signed( body?.armSpread ?? 0 ) }  ` +
            `knees ${ signed( body?.kneeActivation ?? 0 ) }  headTiltUp ${ signed( body?.headTiltUp ?? 0 ) }`,
        `        gestureAmplitude ${ ( body?.gestureAmplitude ?? 0.5 ).toFixed( 3 ) }  ` +
            `headAlignment ${ ( body?.headAlignment ?? 0.5 ).toFixed( 3 ) }  ` +
            `temporalExtent ${ ( body?.temporalExtent ?? 0.5 ).toFixed( 3 ) }`,
        '',
        `lexicon ${ reflex.lexiconProvenance.name }, ${ reflex.lexiconProvenance.entries } entries — ${ reflex.lexiconProvenance.licence }`
    ].join( '\n' );

}

function signed( value ) {

    return `${ value >= 0 ? '+' : '' }${ value.toFixed( 2 ) }`;

}

/**
 * The strip along the bottom, in three panels.
 *
 *   LEFT    the two timescales, as bars. Emotion snaps; mood creeps. Nothing else on the page shows
 *           the 298:1 separation as directly as watching one move and the other not.
 *   MIDDLE  the viseme envelope, and the corner offset drawn UNDER it in a different colour. The
 *           whole of 5.5 is that these two lines are independent.
 *   RIGHT   every emotion's activation weight. One or two bars, with a hard edge.
 */
function drawMeter( meter, { state, affect, speech, session } ) {

    const context = meter.getContext( '2d' );
    const { width, height } = meter;

    context.clearRect( 0, 0, width, height );

    const panel = width / 3;

    // --- left: the two timescales -----------------------------------------------------------
    context.font = '10px ui-monospace, monospace';

    const bars = [
        [ 'emotion P', state.emotion.pleasure, '#7fd4ff' ],
        [ 'emotion A', state.emotion.arousal, '#7fd4ff' ],
        [ 'mood P', state.mood.pleasure, '#ffb37f' ],
        [ 'mood A', state.mood.arousal, '#ffb37f' ]
    ];

    for ( let index = 0; index < bars.length; index ++ ) {

        const [ label, value, colour ] = bars[ index ];
        const y = 14 + index * 18;
        const zero = panel * 0.55;
        const scale = panel * 0.35;

        context.fillStyle = 'rgba(255,255,255,0.45)';
        context.fillText( label, 8, y + 4 );

        context.strokeStyle = 'rgba(255,255,255,0.18)';
        context.beginPath();
        context.moveTo( zero, y - 6 );
        context.lineTo( zero, y + 6 );
        context.stroke();

        context.fillStyle = colour;
        context.fillRect( Math.min( zero, zero + value * scale ), y - 4, Math.abs( value * scale ), 8 );

    }

    // --- middle: the viseme envelope and the corner offset, drawn apart ---------------------
    const left = panel;
    const span = Math.max( speech.schedule.durationSeconds, 0.001 );
    const now = performance.now() / 1000;

    context.strokeStyle = 'rgba(255,255,255,0.18)';
    context.beginPath();
    context.moveTo( left, 0 );
    context.lineTo( left, height );
    context.moveTo( left + panel, 0 );
    context.lineTo( left + panel, height );
    context.stroke();

    if ( session.speaking === true ) {

        const shapes = [ ...new Set( speech.schedule.timeline.map( ( entry ) => entry.viseme ) ) ];
        const colours = [ '#7fd4ff', '#b8ff7f', '#ff7fd4', '#ffe97f', '#7f9bff', '#7fffd4' ];

        for ( let index = 0; index < shapes.length; index ++ ) {

            context.strokeStyle = colours[ index % colours.length ];
            context.lineWidth = 1.2;
            context.beginPath();

            for ( let column = 0; column < panel; column ++ ) {

                const audioTime = session.utteranceStart + ( column / panel ) * span;
                const weights = speech.schedule.sampleAt( audioTime );
                const y = height - 26 - weights[ shapes[ index ] ] * ( height - 40 );

                if ( column === 0 ) context.moveTo( left + column, y );
                else context.lineTo( left + column, y );

            }

            context.stroke();

        }

        // Restore the schedule's live sample; the sweep left it wherever the last column was.
        speech.schedule.sampleAt( now );

        const nowColumn = left + ( ( now - session.utteranceStart ) / span ) * panel;
        context.strokeStyle = 'rgba(255,255,255,0.55)';
        context.lineWidth = 1;
        context.beginPath();
        context.moveTo( nowColumn, 0 );
        context.lineTo( nowColumn, height );
        context.stroke();

    }

    // The corner offset, as a flat band along the bottom of the same panel. Flat because it does
    // not move with the viseme — which is the claim.
    const offset = affect.faceResult?.mouthCornerOffset ?? { smile: 0, frown: 0 };
    const cornerHeight = Math.max( offset.smile, offset.frown ) / 0.35 * 16;

    context.fillStyle = offset.smile >= offset.frown ? 'rgba(120,255,160,0.55)' : 'rgba(255,140,140,0.55)';
    context.fillRect( left + 1, height - 10 - cornerHeight, panel - 2, cornerHeight );

    context.fillStyle = 'rgba(255,255,255,0.5)';
    context.fillText( session.speaking ? 'viseme envelope  +  AU12/AU15 corner offset (band)' : 'not speaking', left + 6, 12 );

    // --- right: activation weights, thresholded ---------------------------------------------
    const right = panel * 2;
    const names = Object.keys( ANCHOR_SETS ).slice( 0, 8 );
    const active = new Map( affect.activations.map( ( a ) => [ a.emotion, a ] ) );

    context.fillStyle = 'rgba(255,255,255,0.5)';
    context.fillText( 'activation — 1 or 2, never a blend', right + 6, 12 );

    for ( let index = 0; index < names.length; index ++ ) {

        const name = names[ index ];
        const row = active.get( name );
        const y = 20 + index * 9;

        context.fillStyle = 'rgba(255,255,255,0.35)';
        context.fillText( name, right + 6, y + 6 );

        const barLeft = right + 74;
        const barWidth = ( panel - 84 ) * ( row?.weight ?? 0 );

        context.fillStyle = row === undefined ? 'rgba(255,255,255,0.08)'
            : ( row.saturated ? '#ffe97f' : '#7fd4ff' );
        context.fillRect( barLeft, y, Math.max( barWidth, row === undefined ? 1 : barWidth ), 7 );

    }

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

function buildControls( { state, map, reflex, session, applyPreset, startUtterance, speech, syncSliders } ) {

    const presets = document.getElementById( 'presets' );

    for ( const name of Object.keys( EMOTION_PRESETS ) ) {

        const button = document.createElement( 'button' );
        button.textContent = name;
        button.addEventListener( 'click', () => applyPreset( name ) );
        presets.appendChild( button );

    }

    for ( const axis of [ 'pleasure', 'arousal', 'dominance' ] ) {

        const slider = document.getElementById( axis );

        slider.addEventListener( 'input', () => {

            session.preset = 'custom';
            state.push( { [ axis ]: Number( slider.value ) } );
            document.getElementById( `${ axis }Value` ).textContent = Number( slider.value ).toFixed( 2 );

        } );

    }

    document.getElementById( 'settle' ).addEventListener( 'click', () => {

        for ( let step = 0; step < 300; step ++ ) state.update( 0.01 );

    } );

    document.getElementById( 'release' ).addEventListener( 'click', () => {

        map.clearTriggers();
        state.release();
        syncSliders();

    } );

    document.getElementById( 'feel' ).addEventListener( 'click', () => {

        const text = document.getElementById( 'utterance' ).value;
        session.preset = 'tier 1';
        state.push( reflex.estimateFromText( text ) );
        syncSliders();

    } );

    document.getElementById( 'speak' ).addEventListener( 'click', () => {

        if ( session.speaking === true ) {

            session.speaking = false;
            speech.stop();
            return;

        }

        startUtterance();

    } );

    document.getElementById( 'fastMood' ).addEventListener( 'click', () => {

        session.moodFactor = session.moodFactor > 1 ? 1 : FAST_MOOD_FACTOR;

    } );

    document.getElementById( 'resetMood' ).addEventListener( 'click', () => {

        for ( const axis of [ 'pleasure', 'arousal', 'dominance' ] ) state.mood[ axis ] = state.defaultMood[ axis ];

    } );

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
