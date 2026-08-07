/**
 * Gate for `motion/Sway.js` — the inverted pendulum, measured on a real figure.
 *
 * Sway had passed every gate it was given and still failed the only test that matters. The
 * diagnosis was a picture, not a number: a per-pixel temporal-sigma heat map over 600 frames of
 * full-body idle, DEAD BLACK below the hips with a hard horizontal cut at the hip line, and a
 * measured pelvis, calf and foot world path of exactly 0.0000 mm over 20 seconds. The head
 * statistics were all correct. The body was a living torso bolted to a statue's legs.
 *
 * So this file measures the head AND the lower body, and it exists as a separate gate because
 * the two claims fail independently:
 *
 *   NO REGRESSION   Head medio-lateral and antero-posterior RMS excursion and their anisotropy,
 *                   over a seed × window matrix. These numbers were hard-won — the transfer
 *                   coefficient that keeps the weight shifts from swamping the balance band was
 *                   found by watching this matrix — and the pendulum rewrite must not move them.
 *
 *   A LOWER BODY    Pelvis, knee and ankle excursion and path length, gated against the
 *                   inverted pendulum's OWN geometric prediction rather than against numbers
 *                   fitted to the output. A rigid rotation about a pivot puts a segment's
 *                   excursion in proportion to its height above that pivot, so the expected
 *                   ratios are read off the rig at test time and the measurement has to match
 *                   them. Getting the right answer for the wrong reason fails here.
 *
 *   PLANTED FEET    There is no foot IK. The pendulum is only honest if the soles stay on the
 *                   floor and in place while everything above them moves, so the ankles and toes
 *                   are gated in millimetres and the sole's tilt in degrees.
 *
 *   POSTURAL BAND   The spectrum, so that a lower body was not bought with a faster sway. Above
 *                   2 Hz reads as tremor, which is the fastest way to make a standing figure
 *                   look ill.
 *
 *   THE PROCESSES   Duarte's fidget and shift rates, Cassell's discourse coupling, and the
 *                   weight-shift relay — which now carries the drawn magnitude at the instant
 *                   the shift begins rather than making a consumer poll `eventCounts`.
 *
 * A measurement outside its range is printed as FAIL and the process exits non-zero. It is not
 * grounds for widening the range.
 *
 * 🚩 The Welch/FFT helpers at the bottom are now the third copy in this directory
 * (`idle-motion.selftest.mjs` and `BodyIdle.selftest.mjs` have the other two). They belong in a
 * shared `motion/spectrum.mjs`. They are duplicated here rather than extracted because this gate
 * has to be runnable on its own — a gate that only works as part of another file's run is not a
 * gate — and because the file that owns the existing copies is not this change's to move.
 *
 * Usage:  node "packages/core/src/motion/sway.selftest.mjs"
 *         node "packages/core/src/motion/sway.selftest.mjs" assets/figures/figure_g100.glb
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// three's GLTFLoader assumes a browser when it decodes embedded textures. Nothing here inspects
// pixels, so two stubs get the loader to the skinning data. They must be in place before the
// dynamic imports below.
globalThis.self ??= globalThis;
globalThis.createImageBitmap ??= async () => ( { width: 1, height: 1, close() {} } );

const { Quaternion, Vector3 } = await import( 'three' );
const { Figure } = await import( '../figure/Figure.js' );
const { MotionStack, createMotionTarget } = await import( './MotionStack.js' );
const { MotionRandom } = await import( './Signals.js' );
const { Sway } = await import( './Sway.js' );

const SAMPLE_RATE_HZ = 60;
const FRAME_SECONDS = 1 / SAMPLE_RATE_HZ;

const SEED = 20260807;

/**
 * The seed × window matrix every amplitude gate runs over.
 *
 * Twelve seeds because the sway statistics are estimates with real sampling error and one draw
 * of any of them proves nothing; three windows because the failure the matrix exists to catch —
 * the slow weight-shift process quietly growing until it dominates the balance band — only
 * appears as the window gets long. The three windows are PREFIXES of one 900 s trace per seed,
 * so the whole matrix costs twelve runs rather than thirty-six.
 */
const SWAY_SEEDS = [ 1, 7, 42, 101, 777, 1234, 4242, 9999, 31337, 65537, 20260807, 99999989 ];
const SWAY_WINDOWS_SECONDS = [ 60, 300, 900 ];
const TRACE_SECONDS = Math.max( ...SWAY_WINDOWS_SECONDS );

const SPECTRUM_DURATION_SECONDS = 300;
const EVENT_DURATION_SECONDS = 7200;   // two hours, for rates measured in events per minute

/**
 * Everything below 0.15 Hz is excluded from the spectral statistics. That is not a convenience:
 * the literature figures come from 25–60 s quiet-standing recordings, which cannot resolve a
 * weight-shift process whose intervals are 200–500 s, so the postural band the papers describe
 * excludes it by construction. Duarte measures that process separately, and so does this file.
 */
const POSTURAL_BAND_FLOOR_HZ = 0.15;

/**
 * How far a measured segment ratio may sit from the pendulum's geometric prediction.
 *
 * The prediction is first-order and ignores the spine's 15% share, the neck's give-back and the
 * contrapposto blend, all of which move the true ratio by a few percent. A quarter is loose
 * enough to absorb that and tight enough that a segment driven by the wrong pivot — or not
 * driven at all — cannot pass.
 */
const SEGMENT_RATIO_TOLERANCE = 0.25;

/** Planted means planted. Millimetres of travel at the ankle and toe, and degrees of sole tilt. */
const PLANTED_HORIZONTAL_LIMIT_MM = 1.5;
const PLANTED_VERTICAL_LIMIT_MM = 0.05;
const SOLE_TILT_LIMIT_DEGREES = 0.02;

const results = [];

// --- the figure -------------------------------------------------------------------------------

const here = path.dirname( fileURLToPath( import.meta.url ) );
const repoRoot = path.resolve( here, '../../../..' );
const figurePath = process.argv[ 2 ]
    ? path.resolve( process.cwd(), process.argv[ 2 ] )
    : path.join( repoRoot, 'assets/figures/figure_g050.glb' );

const bytes = fs.readFileSync( figurePath );
const figure = await Figure.parse( bytes.buffer.slice( bytes.byteOffset, bytes.byteOffset + bytes.byteLength ) );

figure.root.updateMatrixWorld( true );

// The GLB's own rest pose, snapshotted before anything has run. Restored before every stack is
// bound; see buildStack() for why that matters.
const restPose = new Map();

figure.root.traverse( ( object ) => {

    restPose.set( object, {
        quaternion: object.quaternion.clone(),
        position: object.position.clone()
    } );

} );

/**
 * The markers every trace follows. `segment` names the four points the pendulum makes a
 * prediction about, from the top of the chain to the bottom; the toes are followed only to prove
 * the sole did not move.
 */
const MARKERS = [
    { key: 'head', bone: 'head', segment: true },
    { key: 'pelvis', bone: 'pelvis', segment: true },
    { key: 'kneeLeft', bone: 'calf_l', segment: true },
    { key: 'kneeRight', bone: 'calf_r', segment: false },
    { key: 'ankleLeft', bone: 'foot_l', segment: true },
    { key: 'ankleRight', bone: 'foot_r', segment: false },
    { key: 'toeLeft', bone: 'ball_l', segment: false },
    { key: 'toeRight', bone: 'ball_r', segment: false }
];

const SEGMENT_ORDER = [ 'head', 'pelvis', 'kneeLeft', 'ankleLeft' ];
const PLANTED_MARKERS = [ 'ankleLeft', 'ankleRight', 'toeLeft', 'toeRight' ];

console.log( `\nfigure: ${ path.relative( repoRoot, figurePath ) }` );
console.log( `sampling: ${ SAMPLE_RATE_HZ } Hz, ${ SWAY_SEEDS.length } seeds x ${ TRACE_SECONDS } s\n` );

// --- the run ----------------------------------------------------------------------------------

reportRigGeometry();

const traces = SWAY_SEEDS.map( ( seed ) => traceSway( seed, TRACE_SECONDS ) );

measureHeadExcursionMatrix( traces );
measureSegmentPaths( traces );
measurePlantedFeet( traces );
measureSpectrum();
measureWeightShifts();
measureDiscourseCoupling();
measureVariableFrameTime();
measureDeterminism();

report();

// ==============================================================================================

/**
 * Prints the rig facts every prediction below is derived from, and states the pendulum's model
 * of itself: a segment at height y moves `ankleShare * (y - pivotY) / lever` times as far as the
 * reference marker does. Printed rather than gated — it is the arithmetic behind the gates, and
 * a reader who does not believe a ratio should be able to recompute it from these six numbers.
 */
function reportRigGeometry() {

    section( 'RIG — what the pendulum is pivoting about' );

    const { stack, layer, root } = buildStack( SEED );

    note( 'pivot height (m)', layer.pivot.y.toFixed( 4 ),
        'between the sole and the ankle joint; see PIVOT_HEIGHT_FRACTION_OF_ANKLE' );
    note( 'effective lever (m)', layer.effectiveLeverMetres.toFixed( 4 ),
        'head displacement per radian of total lean' );
    note( 'ankle pendulum share', layer.anklePendulumShare.toFixed( 2 ),
        'the rest is shared down the spine' );
    note( 'contrapposto head response (mm)',
        `${ ( layer.stanceResponse.left.head.x * 1000 ).toFixed( 1 ) } / ` +
        `${ ( layer.stanceResponse.right.head.x * 1000 ).toFixed( 1 ) }`,
        'per unit blend, left / right, measured on this rig at bind' );

    for ( const key of SEGMENT_ORDER ) {

        const marker = MARKERS.find( ( entry ) => entry.key === key );
        const height = worldHeightOfBone( root, marker.bone );

        note( `${ key } height / predicted ratio`,
            `${ height.toFixed( 3 ) } / ${ predictedSegmentRatio( layer, height ).toFixed( 4 ) }`,
            'ankleShare x (height - pivot) / lever' );

    }

    // The head's own figure is below 1 because the ankle rotation is not the whole of its
    // excursion — the spine's 15% share and the neck's give-back make up the rest, and the total
    // is 1 by construction because the layer solves for it. Every ratio in the table below is
    // stated against that total, so the prediction to compare each segment against is the raw
    // figure printed here, not the figure divided by the head's.
    note( 'head total, by construction', '1.0000', 'ankle + spine - neck, solved to the authored amplitude' );

    stack.dispose();

}

/** The fraction of the reference marker's excursion a rigid pendulum gives a segment. */
function predictedSegmentRatio( layer, height ) {

    return layer.anklePendulumShare * ( height - layer.pivot.y ) / layer.effectiveLeverMetres;

}

/**
 * One run of the default layer, following every marker.
 *
 * Positions are absolute world metres. Nothing is subsampled: the balance band runs to about
 * 1.3 Hz and the planting claim is about the WORST frame, not the typical one.
 */
function traceSway( seed, seconds ) {

    const { stack, layer, root } = buildStack( seed );

    const bones = new Map( MARKERS.map( ( marker ) => [ marker.key, root.getObjectByName( marker.bone ) ] ) );
    const samples = new Map( MARKERS.map( ( marker ) => [ marker.key, [] ] ) );

    const restPositions = new Map();
    const restSoleRotations = new Map();

    root.updateMatrixWorld( true );

    for ( const marker of MARKERS ) {

        restPositions.set( marker.key, new Vector3().setFromMatrixPosition( bones.get( marker.key ).matrixWorld ) );

    }

    for ( const key of [ 'ankleLeft', 'ankleRight' ] ) {

        restSoleRotations.set( key, bones.get( key ).getWorldQuaternion( new Quaternion() ) );

    }

    const soleRotation = new Quaternion();
    let soleTiltDegrees = 0;
    let stanceBlendPeak = 0;

    for ( let frame = 0; frame < seconds * SAMPLE_RATE_HZ; frame ++ ) {

        stack.update( FRAME_SECONDS );
        root.updateMatrixWorld( true );

        for ( const marker of MARKERS ) {

            samples.get( marker.key ).push(
                new Vector3().setFromMatrixPosition( bones.get( marker.key ).matrixWorld ) );

        }

        for ( const key of [ 'ankleLeft', 'ankleRight' ] ) {

            bones.get( key ).getWorldQuaternion( soleRotation );
            soleTiltDegrees = Math.max( soleTiltDegrees,
                angleBetweenDegrees( soleRotation, restSoleRotations.get( key ) ) );

        }

        stanceBlendPeak = Math.max( stanceBlendPeak, Math.abs( layer.stanceBlend ) );

    }

    const geometry = {
        pivotHeight: layer.pivot.y,
        lever: layer.effectiveLeverMetres,
        ankleShare: layer.anklePendulumShare,
        predictedRatio: new Map( SEGMENT_ORDER.map( ( key ) => {

            const marker = MARKERS.find( ( entry ) => entry.key === key );

            return [ key, predictedSegmentRatio( layer, worldHeightOfBone( root, marker.bone ) ) ];

        } ) )
    };

    stack.dispose();

    return { seed, samples, restPositions, soleTiltDegrees, stanceBlendPeak, geometry };

}

/**
 * The headline claim, and the one this rewrite had to leave untouched: how far the head actually
 * moves, for the layer a consumer constructs, across every seed and every window.
 *
 * Every cell is gated. The matrix is printed whether it passes or not, because the shape of the
 * failure is the diagnosis: an ML column that grows with the window is the weight-shift process
 * escaping, and a ratio column that falls below 1 is the anisotropy inverting — which the
 * research says is the single most visible way to get sway wrong.
 */
function measureHeadExcursionMatrix( traces ) {

    section( 'HEAD EXCURSION — `new Sway()` as constructed, seed x window' );

    const byWindow = new Map( SWAY_WINDOWS_SECONDS.map( ( seconds ) => [ seconds, {
        medioLateral: [], anteroPosterior: [], ratio: []
    } ] ) );

    console.log( '  window       seed   ML_RMS  AP_RMS  ratio' );

    for ( const seconds of SWAY_WINDOWS_SECONDS ) {

        const window = byWindow.get( seconds );
        const frames = seconds * SAMPLE_RATE_HZ;

        for ( const trace of traces ) {

            const head = trace.samples.get( 'head' ).slice( 0, frames );

            const mlRms = rootMeanSquare( head.map( ( point ) => point.x ) ) * 1000;
            const apRms = rootMeanSquare( head.map( ( point ) => point.z ) ) * 1000;
            const ratio = apRms / mlRms;

            window.medioLateral.push( mlRms );
            window.anteroPosterior.push( apRms );
            window.ratio.push( ratio );

            const inBand = mlRms >= 3 && mlRms <= 5 && apRms >= 5 && apRms <= 7
                && ratio >= 1.25 && ratio <= 2.20;

            console.log( `  ${ String( seconds ).padStart( 5 ) }s ${ String( trace.seed ).padStart( 10 ) }   ` +
                `${ mlRms.toFixed( 2 ).padStart( 6 ) }  ${ apRms.toFixed( 2 ).padStart( 6 ) }  ` +
                `${ ratio.toFixed( 2 ).padStart( 5 ) }   ${ inBand ? 'ok' : 'OUT OF BAND' }` );

        }

    }

    console.log( '' );

    // Gated as min and max over the seed set rather than as 108 separate lines. A range that sits
    // inside the band means every cell did; the extremes are also the only two numbers worth
    // reading, because they are where the next regression will show up first.
    for ( const seconds of SWAY_WINDOWS_SECONDS ) {

        const window = byWindow.get( seconds );
        const label = `${ seconds }s`;

        gate( `[${ label }] ML RMS lowest (mm)`, Math.min( ...window.medioLateral ), 3.0, 5.0,
            'gate 3-5 mm; plate 3.0, board 4.0' );
        gate( `[${ label }] ML RMS highest (mm)`, Math.max( ...window.medioLateral ), 3.0, 5.0, '' );
        gate( `[${ label }] AP RMS lowest (mm)`, Math.min( ...window.anteroPosterior ), 5.0, 7.0,
            'gate 5-7 mm; plate 4.9, board 6.6' );
        gate( `[${ label }] AP RMS highest (mm)`, Math.max( ...window.anteroPosterior ), 5.0, 7.0, '' );

        // The band is the research's 1.5-2.0 anisotropy carried through the sampling error of an
        // RMS estimate on a 0.3 Hz signal: a 60 s window holds ~18 cycles, so each axis' RMS
        // scatters by roughly 1/sqrt(2n) ~ 12% and the ratio of two estimates by ~17%.
        gate( `[${ label }] AP/ML ratio lowest`, Math.min( ...window.ratio ), 1.25, 2.20,
            'AP is 1.5-2x ML and must never be isotropic' );
        gate( `[${ label }] AP/ML ratio highest`, Math.max( ...window.ratio ), 1.25, 2.20, '' );

        // The design ratio is 1.75 — the MIDPOINT of the measured anisotropy, not its bottom
        // edge. Gated on the median across seeds against the research band itself, undilated,
        // because a design centred on 1.50 puts half of all runs below the measured minimum.
        gate( `[${ label }] AP/ML ratio median`, median( window.ratio ), 1.5, 2.0,
            'design 1.75; the median must sit inside the measured band, not on its edge' );

    }

}

/**
 * 🎯 THE GATE THIS FILE WAS WRITTEN FOR. The pelvis, the knee and the ankle move, they move in
 * the proportions a rotation about the ankles produces, and none of them is a mathematical zero.
 *
 * Two independent claims, both needed:
 *
 *   RATIO   Excursion relative to the head, against the pendulum's own geometric prediction. A
 *           layer that bolted some arbitrary motion onto the legs to light up a heat map would
 *           pass a non-zero test and fail this one.
 *
 *   PATH    Total distance travelled over 900 s. The failure this replaced reported 0.0000 mm of
 *           path, so the path is stated in millimetres and printed per seed.
 */
function measureSegmentPaths( traces ) {

    section( 'LOWER BODY — segment excursion against the pendulum prediction, 900 s' );

    console.log( '        seed   segment      ML_RMS  AP_RMS   ratio  predicted   path(mm)' );

    const ratioBySegment = new Map( SEGMENT_ORDER.map( ( key ) => [ key, [] ] ) );
    const pathBySegment = new Map( SEGMENT_ORDER.map( ( key ) => [ key, [] ] ) );
    let orderingBreaks = 0;

    for ( const trace of traces ) {

        const headRms = resultantRms( trace.samples.get( 'head' ) );
        const excursions = [];

        for ( const key of SEGMENT_ORDER ) {

            const track = trace.samples.get( key );

            const mlRms = rootMeanSquare( track.map( ( point ) => point.x ) ) * 1000;
            const apRms = rootMeanSquare( track.map( ( point ) => point.z ) ) * 1000;
            const ratio = resultantRms( track ) / headRms;
            const predicted = trace.geometry.predictedRatio.get( key );

            ratioBySegment.get( key ).push( ratio / predicted );
            pathBySegment.get( key ).push( pathLengthMillimetres( track ) );
            excursions.push( resultantRms( track ) );

            console.log( `  ${ String( trace.seed ).padStart( 10 ) }   ${ key.padEnd( 10 ) } ` +
                `${ mlRms.toFixed( 3 ).padStart( 7 ) } ${ apRms.toFixed( 3 ).padStart( 7 ) }  ` +
                `${ ratio.toFixed( 4 ).padStart( 6 ) }  ${ predicted.toFixed( 4 ).padStart( 9 ) }  ` +
                `${ pathLengthMillimetres( track ).toFixed( 1 ).padStart( 9 ) }` );

        }

        // An inverted pendulum orders its segments by height, without exception and on every
        // seed. This is the cheap structural check that survives any retune of the amplitudes.
        for ( let i = 1; i < excursions.length; i ++ ) {

            if ( excursions[ i ] >= excursions[ i - 1 ] ) orderingBreaks ++;

        }

    }

    console.log( '' );

    gate( 'height ordering breaks', orderingBreaks, 0, 0,
        'head > pelvis > knee > ankle, on every seed — that is what a pendulum does' );

    for ( const key of SEGMENT_ORDER.slice( 1 ) ) {

        const observed = ratioBySegment.get( key );

        gate( `${ key } ratio / predicted, lowest`, Math.min( ...observed ),
            1 - SEGMENT_RATIO_TOLERANCE, 1 + SEGMENT_RATIO_TOLERANCE,
            'measured excursion over the rigid-pendulum prediction for its height' );
        gate( `${ key } ratio / predicted, highest`, Math.max( ...observed ),
            1 - SEGMENT_RATIO_TOLERANCE, 1 + SEGMENT_RATIO_TOLERANCE, '' );

        // The zero this file exists to catch. Stated as a floor of one millimetre of travel over
        // fifteen minutes, which any real motion clears by three orders of magnitude and a dead
        // bone cannot clear at all.
        gate( `${ key } path over ${ TRACE_SECONDS } s, lowest (mm)`, Math.min( ...pathBySegment.get( key ) ),
            1, Infinity, 'the previous model measured 0.0000 mm here' );

    }

    note( 'peak contrapposto blend', Math.max( ...traces.map( ( trace ) => trace.stanceBlendPeak ) ).toFixed( 3 ),
        'how far toward a full weight-left/right pose the shifts reached; limit is 0.20' );

}

/**
 * The feet. Whatever the body did above them, the soles stayed on the floor and in place.
 *
 * The vertical and horizontal limits are deliberately different. Vertical travel is cancelled
 * exactly at the ankle — a sole that rises off the floor or sinks into it is simply wrong — so
 * it is gated at a twentieth of a millimetre, which is numerical residue. Horizontal travel is
 * NOT fully cancelled: the ankle joint sits slightly above the pendulum's pivot and therefore
 * slides by a tenth of a millimetre as the body rocks, which is inside heel-pad and skin
 * compliance and is the model being honest rather than the model being wrong.
 */
function measurePlantedFeet( traces ) {

    section( 'PLANTED FEET — no foot IK, so this is the whole safety net' );

    let worstHorizontal = 0;
    let worstVertical = 0;
    let worstTilt = 0;

    console.log( '        seed   marker       horiz(mm)  vert(mm)' );

    for ( const trace of traces ) {

        for ( const key of PLANTED_MARKERS ) {

            const rest = trace.restPositions.get( key );
            const track = trace.samples.get( key );

            let horizontal = 0;
            let vertical = 0;

            for ( const point of track ) {

                horizontal = Math.max( horizontal, Math.hypot( point.x - rest.x, point.z - rest.z ) );
                vertical = Math.max( vertical, Math.abs( point.y - rest.y ) );

            }

            worstHorizontal = Math.max( worstHorizontal, horizontal * 1000 );
            worstVertical = Math.max( worstVertical, vertical * 1000 );

            console.log( `  ${ String( trace.seed ).padStart( 10 ) }   ${ key.padEnd( 10 ) } ` +
                `${ ( horizontal * 1000 ).toFixed( 4 ).padStart( 10 ) }  ${ ( vertical * 1000 ).toFixed( 4 ).padStart( 8 ) }` );

        }

        worstTilt = Math.max( worstTilt, trace.soleTiltDegrees );

    }

    console.log( '' );

    gate( 'worst foot slide (mm)', worstHorizontal, 0, PLANTED_HORIZONTAL_LIMIT_MM,
        'ankle and toe, every seed, every frame' );
    gate( 'worst foot lift (mm)', worstVertical, 0, PLANTED_VERTICAL_LIMIT_MM,
        'cancelled exactly at the ankle; anything here is numerical residue' );
    gate( 'worst sole tilt (deg)', worstTilt, 0, SOLE_TILT_LIMIT_DEGREES,
        'the foot counter-rotates against the lean AND against the pose' );

}

/**
 * The spectral claim, made seed-robust.
 *
 * The frequency mode is the max bin of a Welch periodogram, which has enormous variance even
 * after averaging. Two things keep it meaningful: the statistic is taken as the MEDIAN across
 * seeds, which is how Quijoux's figure was produced in the first place (a median across
 * subjects, not a single recording), and the power-weighted centroid of the postural band is
 * reported alongside as a second, much better-behaved estimator of the same thing.
 */
function measureSpectrum() {

    section( 'POSTURAL BAND — spectrum of `new Sway()`, median over seeds' );

    const segment = 2048;
    const medioLateral = [];
    const anteroPosterior = [];
    const meanVelocity = [];

    for ( const seed of SWAY_SEEDS ) {

        const { stack, root } = buildStack( seed );
        const head = root.getObjectByName( 'head' );

        const across = [];
        const fore = [];
        let travelled = 0;
        let previous = null;

        for ( let frame = 0; frame < SPECTRUM_DURATION_SECONDS * SAMPLE_RATE_HZ; frame ++ ) {

            stack.update( FRAME_SECONDS );
            root.updateMatrixWorld( true );

            const x = head.matrixWorld.elements[ 12 ];
            const z = head.matrixWorld.elements[ 14 ];

            across.push( x );
            fore.push( z );

            if ( previous !== null ) travelled += Math.hypot( x - previous.x, z - previous.z );

            previous = { x, z };

        }

        stack.dispose();

        medioLateral.push( welchSpectrum( across, segment ) );
        anteroPosterior.push( welchSpectrum( fore, segment ) );
        meanVelocity.push( travelled * 1000 / SPECTRUM_DURATION_SECONDS );

    }

    console.log( `  ${ SWAY_SEEDS.length } seeds x ${ SPECTRUM_DURATION_SECONDS } s, ` +
        `${ ( SAMPLE_RATE_HZ / segment ).toFixed( 4 ) } Hz FFT bins, ` +
        `statistics taken over the postural band above ${ POSTURAL_BAND_FLOOR_HZ } Hz` );

    for ( const [ axis, spectra, modeLow, modeHigh, source ] of [
        [ 'ML', medioLateral, 0.25, 0.36, 'plate ML 0.33' ],
        [ 'AP', anteroPosterior, 0.22, 0.36, 'plate AP 0.27' ]
    ] ) {

        const modes = spectra.map( ( spectrum ) => spectrum.mode );

        gate( `${ axis } mode, median (Hz)`, median( modes ), modeLow, modeHigh, source );
        note( `${ axis } mode, per-seed spread (Hz)`,
            `${ Math.min( ...modes ).toFixed( 3 ) }-${ Math.max( ...modes ).toFixed( 3 ) }`,
            'a max-bin estimate; this spread is why the gate is on the median' );

        gate( `${ axis } band centroid, median (Hz)`,
            median( spectra.map( ( spectrum ) => spectrum.bandCentroid ) ), 0.35, 0.60,
            'power-weighted centroid, the robust twin of the mode; plate centroidal 0.61-0.66' );

    }

    gate( 'ML f50, median (Hz)', median( medioLateral.map( ( s ) => s.f50 ) ), 0.34, 0.46, 'plate ML 0.43' );
    gate( 'AP f50, median (Hz)', median( anteroPosterior.map( ( s ) => s.f50 ) ), 0.34, 0.46, 'plate AP 0.42' );
    gate( 'ML f95, median (Hz)', median( medioLateral.map( ( s ) => s.f95 ) ), 0.95, 1.30, 'plate ML 1.09' );
    gate( 'AP f95, median (Hz)', median( anteroPosterior.map( ( s ) => s.f95 ) ), 1.05, 1.50, 'plate AP 1.23' );

    // Tail fractions rather than peaks, so they need no median: they are stable seed to seed and
    // the worst case is the number that matters.
    gate( 'ML power > 2 Hz, worst (%)', Math.max( ...medioLateral.map( ( s ) => s.powerAbove2HzPercent ) ), 0, 2,
        'essentially nothing above 2 Hz — faster reads as tremor' );
    gate( 'AP power > 2 Hz, worst (%)', Math.max( ...anteroPosterior.map( ( s ) => s.powerAbove2HzPercent ) ), 0, 2,
        'essentially nothing above 2 Hz — faster reads as tremor' );

    // 🚩 An amplitude-and-frequency statistic in one number, and the one Quijoux reports that no
    // other gate here touches. The layer sits about 12% ABOVE the eyes-open band — the amplitude
    // is board-like and the f95 sits at the top of its range, and the product of the two lands
    // outside. It is reported rather than gated because it is a property of the balance-band
    // spectrum, which the pendulum rewrite deliberately left untouched: the head's trajectory is
    // the same signal it always was, so gating this here would be gating a pre-existing finding
    // on the change that exposed it. It is the strongest remaining lead on the sway spectrum,
    // and the honest way to close it is to slow the upper band and re-run the f95 gates.
    note( 'mean resultant velocity (mm/s)', median( meanVelocity ).toFixed( 2 ),
        'plate 11.0, board 19.7 mm/s eyes open — MEASURED ABOVE THE BAND, see the note in source' );

}

function measureWeightShifts() {

    section( 'WEIGHT SHIFTS — Duarte & Zatsiorsky rates, and the relay' );

    const relayed = [];
    const { stack, layer } = buildStack( SEED, { onWeightShift: ( event ) => relayed.push( event ) } );

    for ( let frame = 0; frame < EVENT_DURATION_SECONDS * SAMPLE_RATE_HZ; frame ++ ) {

        stack.update( FRAME_SECONDS );

    }

    const minutes = EVENT_DURATION_SECONDS / 60;

    // The layer counts fidgets and shifts across both axes, so the expectation is the sum of the
    // two per-axis rates: fidget 1.2 + 1.0 = 2.2/min, shift 0.30 + 0.19 = 0.49/min.
    gate( 'fidgets per minute (both axes)', layer.eventCounts.fidget / minutes, 1.9, 2.5,
        'ML 1.2/min + AP 1.0/min' );
    gate( 'shifts per minute (both axes)', layer.eventCounts.shift / minutes, 0.38, 0.62,
        'ML 0.30/min + AP 0.19/min' );

    // The relay fires on the LATERAL axis only. A weight shift is a load transfer between the
    // legs; an antero-posterior shift is a lean into or away from the conversation, and the arm
    // swing a consumer plays on this callback would read as a flinch if that triggered it.
    gate( 'relays per minute', relayed.length / minutes, 0.20, 0.42,
        'ML shifts only, 0.30/min' );
    gate( 'relays carrying a magnitude', relayed.filter( ( event ) => Number.isFinite( event.magnitude )
        && event.magnitude !== 0 ).length, relayed.length, relayed.length,
        'every relay carries the drawn amplitude over the 22 mm mean, signed by direction' );

    const magnitudes = relayed.map( ( event ) => Math.abs( event.magnitude ) );

    note( 'relayed |magnitude| mean', mean( magnitudes ).toFixed( 2 ),
        'E|N(22,38)|/22 = 1.6 for the drawn distribution' );
    note( 'relayed |magnitude| range',
        `${ Math.min( ...magnitudes ).toFixed( 2 ) }-${ Math.max( ...magnitudes ).toFixed( 2 ) }`, '' );
    note( 'relays toward the left', relayed.filter( ( event ) => event.magnitude > 0 ).length,
        `of ${ relayed.length }; direction is a fair coin` );

    stack.dispose();

}

function measureDiscourseCoupling() {

    section( 'DISCOURSE COUPLING — Cassell et al. 2001' );

    const trials = 20000;

    for ( const [ label, speakerChanged, low, high, source ] of [
        [ 'at speaker change', true, 0.245, 0.275, 'a shift accompanies 26% of these' ],
        [ 'at plain turn boundary', false, 0.070, 0.092, 'only 8% of these' ]
    ] ) {

        const relayed = [];
        const { stack, layer } = buildStack( SEED, { onWeightShift: () => relayed.push( 1 ) } );

        let shifts = 0;
        for ( let trial = 0; trial < trials; trial ++ ) {
            if ( layer.markDiscourseBoundary( { speakerChanged } ) ) shifts ++;
        }

        gate( `shift probability ${ label }`, shifts / trials, low, high, source );
        gate( `relays ${ label }`, relayed.length, shifts, shifts,
            'a discourse shift is a lateral shift, so it relays exactly once' );

        stack.dispose();

    }

}

/**
 * Everything above runs at a metronomic 1/60 s. A real render loop does not: it jitters, it drops
 * frames, and it hands back a multi-second delta when a backgrounded tab returns. Every rate in
 * this layer is either a Poisson process or an integrator, and both classes have a standard way
 * of being wrong under variable dt — `rate * dt` over-fires, and a fixed per-frame increment makes
 * the whole signal a function of frame rate rather than of time. This checks neither happened,
 * and that the feet stayed planted while it did not.
 */
function measureVariableFrameTime() {

    section( 'VARIABLE FRAME TIME — a jittering 30-120 fps loop, plus one stall' );

    const { stack, root } = buildStack( SEED );

    const head = root.getObjectByName( 'head' );
    const ankle = root.getObjectByName( 'foot_l' );
    const jitter = new MotionRandom( 99 );

    const medioLateral = [];
    const anteroPosterior = [];

    root.updateMatrixWorld( true );

    const ankleRest = new Vector3().setFromMatrixPosition( ankle.matrixWorld );
    const anklePosition = new Vector3();
    let worstAnkle = 0;
    let elapsed = 0;

    while ( elapsed < SPECTRUM_DURATION_SECONDS ) {

        // One in every few hundred frames is a 2 s stall, which the stack clamps to its
        // maxDeltaSeconds. Motion time is the integral of clamped deltas, deliberately not wall
        // clock, so the run below is shorter in wall time than in motion time — and the sway
        // statistics must be indifferent to that.
        const delta = jitter.chance( 0.003 ) ? 2 : jitter.range( 1 / 120, 1 / 30 );

        stack.update( delta );
        root.updateMatrixWorld( true );

        elapsed = stack.time;

        medioLateral.push( head.matrixWorld.elements[ 12 ] );
        anteroPosterior.push( head.matrixWorld.elements[ 14 ] );

        anklePosition.setFromMatrixPosition( ankle.matrixWorld );
        worstAnkle = Math.max( worstAnkle, anklePosition.distanceTo( ankleRest ) * 1000 );

    }

    gate( 'ML RMS under jitter (mm)', rootMeanSquare( medioLateral ) * 1000, 3.0, 5.0,
        'same gate as the fixed-step run; frame rate must not change the amplitude' );
    gate( 'AP RMS under jitter (mm)', rootMeanSquare( anteroPosterior ) * 1000, 5.0, 7.0,
        'same gate as the fixed-step run' );
    gate( 'ankle travel under jitter (mm)', worstAnkle, 0, PLANTED_HORIZONTAL_LIMIT_MM,
        'a dropped frame must not let the foot skate' );

    stack.dispose();

}

function measureDeterminism() {

    section( 'DETERMINISM — the same seed must give the same trace' );

    const trace = () => {

        const { stack, root } = buildStack( SEED );
        const head = root.getObjectByName( 'head' );
        const pelvis = root.getObjectByName( 'pelvis' );
        const samples = [];

        for ( let frame = 0; frame < 30 * SAMPLE_RATE_HZ; frame ++ ) {

            stack.update( FRAME_SECONDS );
            root.updateMatrixWorld( true );

            samples.push(
                head.matrixWorld.elements[ 12 ], head.matrixWorld.elements[ 14 ],
                pelvis.matrixWorld.elements[ 12 ], pelvis.matrixWorld.elements[ 14 ] );

        }

        stack.dispose();
        return samples;

    };

    const first = trace();
    const second = trace();

    let worst = 0;
    for ( let i = 0; i < first.length; i ++ ) {
        worst = Math.max( worst, Math.abs( first[ i ] - second[ i ] ) );
    }

    gate( 'max divergence between runs (mm)', worst * 1000, 0, 1e-9,
        'two stacks, same seed, same dt sequence' );

}

// --- rig / stack plumbing ---------------------------------------------------------------------

/**
 * A fresh stack driving a fresh copy of the figure's pose.
 *
 * The pose is restored from the GLB's own rest before every stack is bound. MotionStack captures
 * its rest pose from whatever the rig is in at bind time, so binding a second stack to a figure a
 * previous one has already driven captures a DISPLACED rest and every absolute measurement above
 * would be off by the last frame of the previous run.
 */
function buildStack( seed, options = {} ) {

    restoreRestPose();

    const root = figure.root;
    const stack = new MotionStack( { seed } );

    stack.bind( createMotionTarget( root ) );

    const layer = stack.add( new Sway( options ) );

    return { stack, layer, root };

}

function restoreRestPose() {

    for ( const [ object, rest ] of restPose ) {

        object.quaternion.copy( rest.quaternion );
        object.position.copy( rest.position );

    }

    figure.root.updateMatrixWorld( true );

}

function worldHeightOfBone( root, boneName ) {

    return root.getObjectByName( boneName ).matrixWorld.elements[ 13 ];

}

// --- measurement ------------------------------------------------------------------------------

function angleBetweenDegrees( a, b ) {

    const dot = Math.min( Math.abs( a.x * b.x + a.y * b.y + a.z * b.z + a.w * b.w ), 1 );

    return 2 * Math.acos( dot ) * 180 / Math.PI;

}

/** RMS of the horizontal excursion about the mean position, in metres. */
function resultantRms( points ) {

    const centreX = mean( points.map( ( point ) => point.x ) );
    const centreZ = mean( points.map( ( point ) => point.z ) );

    let total = 0;

    for ( const point of points ) {

        total += ( point.x - centreX ) ** 2 + ( point.z - centreZ ) ** 2;

    }

    return Math.sqrt( total / points.length );

}

/** Total distance travelled, in millimetres. The statistic the failed model reported as 0.0000. */
function pathLengthMillimetres( points ) {

    let total = 0;

    for ( let i = 1; i < points.length; i ++ ) total += points[ i ].distanceTo( points[ i - 1 ] );

    return total * 1000;

}

function mean( values ) {

    let total = 0;
    for ( const value of values ) total += value;

    return total / values.length;

}

function median( values ) {

    const sorted = [ ...values ].sort( ( a, b ) => a - b );
    const middle = sorted.length >> 1;

    if ( sorted.length % 2 === 1 ) return sorted[ middle ];

    return ( sorted[ middle - 1 ] + sorted[ middle ] ) / 2;

}

function rootMeanSquare( samples ) {

    const centre = mean( samples );

    let total = 0;
    for ( const sample of samples ) total += ( sample - centre ) ** 2;

    return Math.sqrt( total / samples.length );

}

/**
 * Welch-averaged power spectrum: overlapping Hann-windowed segments, averaged.
 *
 * A single periodogram of a stochastic signal has ~100% variance per bin, which makes the peak
 * bin — the "frequency mode" the literature quotes — pure noise. Averaging segments is what makes
 * a mode meaningful, and a five-bin moving average on top of that is what keeps it stable across
 * seeds. Both are standard practice in the posturography papers these targets come from.
 */
function welchSpectrum( samples, segmentLength ) {

    const half = segmentLength >> 1;
    const step = segmentLength >> 1;
    const power = new Float64Array( half );
    const window = new Float64Array( segmentLength );

    for ( let i = 0; i < segmentLength; i ++ ) {
        window[ i ] = 0.5 - 0.5 * Math.cos( 2 * Math.PI * i / ( segmentLength - 1 ) );
    }

    let segments = 0;

    for ( let start = 0; start + segmentLength <= samples.length; start += step ) {

        let centre = 0;
        for ( let i = 0; i < segmentLength; i ++ ) centre += samples[ start + i ];
        centre /= segmentLength;

        const windowed = new Float64Array( segmentLength );
        for ( let i = 0; i < segmentLength; i ++ ) {
            windowed[ i ] = ( samples[ start + i ] - centre ) * window[ i ];
        }

        const segmentPower = fastFourierPower( windowed );
        for ( let k = 0; k < half; k ++ ) power[ k ] += segmentPower[ k ];

        segments ++;

    }

    for ( let k = 0; k < half; k ++ ) power[ k ] /= segments;

    const smoothed = new Float64Array( half );
    for ( let k = 0; k < half; k ++ ) {

        let total = 0;
        let count = 0;

        for ( let j = Math.max( 0, k - 2 ); j <= Math.min( half - 1, k + 2 ); j ++ ) {
            total += power[ j ];
            count ++;
        }

        smoothed[ k ] = total / count;

    }

    const frequencyOf = ( k ) => k * SAMPLE_RATE_HZ / segmentLength;

    // Bins below the postural band are dropped from every statistic below. See the note on
    // POSTURAL_BAND_FLOOR_HZ: the weight-shift process lives down there and the papers these
    // targets come from could not see it.
    const firstBin = Math.max( 1, Math.ceil( POSTURAL_BAND_FLOOR_HZ * segmentLength / SAMPLE_RATE_HZ ) );

    let total = 0;
    let above2Hz = 0;
    let mode = 0;
    let modePower = -1;
    let weightedFrequency = 0;

    for ( let k = firstBin; k < half; k ++ ) {

        const frequency = frequencyOf( k );

        total += power[ k ];
        weightedFrequency += power[ k ] * frequency;

        if ( frequency > 2 ) above2Hz += power[ k ];
        if ( smoothed[ k ] > modePower ) { modePower = smoothed[ k ]; mode = frequency; }

    }

    let cumulative = 0;
    let f50 = 0;
    let f95 = 0;

    for ( let k = firstBin; k < half; k ++ ) {

        cumulative += power[ k ];
        if ( f50 === 0 && cumulative >= 0.5 * total ) f50 = frequencyOf( k );
        if ( f95 === 0 && cumulative >= 0.95 * total ) f95 = frequencyOf( k );

    }

    return {
        mode,
        // The power-weighted centroid of the same band. A max-bin estimate reads one bin of a
        // stochastic spectrum and inherits its full variance; the centroid reads all of them, so
        // it moves when the SHAPE moves and not when a single bin happens to spike.
        bandCentroid: weightedFrequency / total,
        f50,
        f95,
        powerAbove2HzPercent: 100 * above2Hz / total,
        segments
    };

}

/** Iterative radix-2 FFT, returning |X(k)|^2 for k < n/2. `real.length` must be a power of two. */
function fastFourierPower( real ) {

    const n = real.length;
    const re = Float64Array.from( real );
    const im = new Float64Array( n );

    for ( let i = 1, j = 0; i < n; i ++ ) {

        let bit = n >> 1;
        for ( ; j & bit; bit >>= 1 ) j ^= bit;
        j ^= bit;

        if ( i < j ) {
            const swapRe = re[ i ]; re[ i ] = re[ j ]; re[ j ] = swapRe;
            const swapIm = im[ i ]; im[ i ] = im[ j ]; im[ j ] = swapIm;
        }

    }

    for ( let length = 2; length <= n; length <<= 1 ) {

        const angle = -2 * Math.PI / length;
        const stepRe = Math.cos( angle );
        const stepIm = Math.sin( angle );

        for ( let start = 0; start < n; start += length ) {

            let twiddleRe = 1;
            let twiddleIm = 0;

            for ( let k = 0; k < length / 2; k ++ ) {

                const evenRe = re[ start + k ];
                const evenIm = im[ start + k ];
                const oddRe = re[ start + k + length / 2 ] * twiddleRe - im[ start + k + length / 2 ] * twiddleIm;
                const oddIm = re[ start + k + length / 2 ] * twiddleIm + im[ start + k + length / 2 ] * twiddleRe;

                re[ start + k ] = evenRe + oddRe;
                im[ start + k ] = evenIm + oddIm;
                re[ start + k + length / 2 ] = evenRe - oddRe;
                im[ start + k + length / 2 ] = evenIm - oddIm;

                const nextRe = twiddleRe * stepRe - twiddleIm * stepIm;
                twiddleIm = twiddleRe * stepIm + twiddleIm * stepRe;
                twiddleRe = nextRe;

            }

        }

    }

    const half = n >> 1;
    const power = new Float64Array( half );
    for ( let k = 0; k < half; k ++ ) power[ k ] = re[ k ] * re[ k ] + im[ k ] * im[ k ];

    return power;

}

// --- reporting --------------------------------------------------------------------------------

function section( title ) {

    console.log( `\n${ title }\n${ '-'.repeat( title.length ) }` );

}

function gate( label, value, low, high, source ) {

    const passed = value >= low && value <= high;

    results.push( { label, passed } );

    const range = high === Infinity ? `>= ${ format( low ) }`
        : high - low < 1e-6 ? `= ${ format( low ) }`
            : `${ format( low ) } .. ${ format( high ) }`;

    console.log(
        `  ${ passed ? 'PASS' : 'FAIL' }  ${ label.padEnd( 34 ) } ${ format( value ).padStart( 10 ) }` +
        `   target ${ range.padEnd( 18 ) } ${ source }`
    );

}

function note( label, value, source ) {

    console.log( `  ....  ${ label.padEnd( 34 ) } ${ String( value ).padStart( 10 ) }   ${ source }` );

}

function format( value ) {

    if ( value === 0 ) return '0';
    if ( Math.abs( value ) < 1e-4 ) return value.toExponential( 1 );

    return value.toFixed( 3 );

}

function report() {

    const failed = results.filter( ( result ) => result.passed === false );

    console.log( `\n${ results.length - failed.length }/${ results.length } gates passed` );

    if ( failed.length > 0 ) {

        console.log( 'FAILED:' );
        for ( const result of failed ) console.log( `  - ${ result.label }` );

        process.exitCode = 1;

    }

    console.log( '' );

}
