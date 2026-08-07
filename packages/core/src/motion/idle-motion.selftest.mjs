/**
 * Gate for punch-list items 2.5 (breath), 2.6 (postural sway) and 2.7 (idle micro-motion).
 *
 * Every claim these three layers make is a claim about a NUMBER — a rate in breaths per minute, a
 * displacement in millimetres, a distribution of spectral power. So this file does not check that
 * the layers ran. It drives them against a real figure GLB, measures what actually moved, and
 * prints the measurement beside the research target.
 *
 * What is measured, and where it comes from:
 *
 *   BREATH   rate in brpm and Ti/Ttot from the tidal waveform; ribcage and belly antero-posterior
 *            excursion from the SKINNED MESH SURFACE, because Takashima measured surface markers,
 *            not joints. `SkinnedMesh.applyBoneTransform` gives the deformed vertex position, so
 *            this is the same quantity the paper reports.
 *
 *   SWAY     RMS of the head's horizontal excursion, separately for medio-lateral and
 *            antero-posterior, plus a Welch-averaged FFT giving the spectral mode, f50, f95 and
 *            the fraction of power above 2 Hz.
 *
 *            🎯 Measured on `new Sway()` AS CONSTRUCTED, over a seed × window matrix. This used
 *            to be measured on `new Sway( { weightShiftsEnabled: false } )` — a configuration no
 *            consumer builds — and the default was outside its own gate on 18 of 24 seed ×
 *            window combinations, with the AP/ML anisotropy INVERTED on several seeds. A gate
 *            that only fires against a configuration nobody ships is not a gate. One seed is not
 *            a measurement either: the RMS of a 0.3 Hz stochastic signal over a 60 s window
 *            scatters by well over 10%, so every figure below is a matrix, not a number.
 *
 *   SHIFTS   event rates over a long run, against Duarte & Zatsiorsky's intervals, and the
 *            discourse-boundary shift probability against Cassell's 26% / 8%.
 *
 *   IDLE     hand and head excursion in millimetres — reported rather than gated, because the
 *            amplitudes are tuning constants with no primary support — and the fraction of power
 *            in the 8–12 Hz physiological-tremor band, which IS gated, because idle motion that
 *            reaches into that band reads as illness.
 *
 * A measurement outside its range is printed as FAIL and the process exits non-zero. It is not
 * grounds for widening the range.
 *
 * Usage:  node "packages/core/src/motion/idle-motion.selftest.mjs"
 *         node "packages/core/src/motion/idle-motion.selftest.mjs" assets/figures/figure_g100.glb
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// three's GLTFLoader assumes a browser when it decodes embedded textures. Nothing here inspects
// pixels, so two stubs get the loader to the skinning data. They must be in place before the
// dynamic imports below.
globalThis.self ??= globalThis;
globalThis.createImageBitmap ??= async () => ( { width: 1, height: 1, close() {} } );

const { Vector3 } = await import( 'three' );
const { Figure } = await import( '../figure/Figure.js' );
const { MotionStack, createMotionTarget } = await import( './MotionStack.js' );
const { MotionRandom } = await import( './Signals.js' );
const { Breath } = await import( './Breath.js' );
const { Sway } = await import( './Sway.js' );
const { IdleMotion } = await import( './IdleMotion.js' );

const SAMPLE_RATE_HZ = 60;
const FRAME_SECONDS = 1 / SAMPLE_RATE_HZ;
const GATE_DURATION_SECONDS = 60;      // what the brief asks for
const SPECTRUM_DURATION_SECONDS = 300; // a tighter estimate of the same signal
const EVENT_DURATION_SECONDS = 7200;   // two hours, for rates measured in events per minute

const SEED = 20260807;

/**
 * The seed × window matrix the sway gates run over. Twelve seeds because the sway statistics are
 * estimates with real sampling error and one draw of any of them proves nothing; three windows
 * because the failure the matrix exists to catch — the slow weight-shift process quietly growing
 * until it dominates the balance band — only appears as the window gets long.
 */
const SWAY_SEEDS = [ 1, 7, 42, 101, 777, 1234, 4242, 9999, 31337, 65537, 20260807, 99999989 ];
const SWAY_WINDOWS_SECONDS = [ 60, 300, 900 ];

/**
 * Everything below 0.15 Hz is excluded from the spectral statistics. That is not a convenience:
 * the literature figures come from 25–60 s quiet-standing recordings, which cannot resolve a
 * weight-shift process whose intervals are 200–500 s, so the postural band the papers describe
 * excludes it by construction. Duarte measures that process separately, and so does this file.
 */
const POSTURAL_BAND_FLOOR_HZ = 0.15;

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

console.log( `\nfigure: ${ path.relative( repoRoot, figurePath ) }` );
console.log( `sampling: ${ SAMPLE_RATE_HZ } Hz, seed ${ SEED }\n` );

// --- 2.5 breath -------------------------------------------------------------------------------

measureBreath();

// --- 2.6 postural sway ------------------------------------------------------------------------

measureSwayAmplitudeMatrix();
measureSwaySpectrum();
measureWeightShifts();
measureDiscourseCoupling();

// --- 2.7 idle micro-motion --------------------------------------------------------------------

measureIdleMotion();

// --- robustness -------------------------------------------------------------------------------

measureVariableFrameTime();
measureDeterminism();

report();

// ==============================================================================================

function measureBreath() {

    const { stack, layer, root } = buildStack( ( options ) => new Breath( options ) );

    const body = figure.body ?? figure.meshes[ 0 ];

    // A profile of the whole anterior midline rather than two chosen points. Takashima placed
    // markers on the abdomen and the ribcage; the fair comparison is the most responsive point in
    // each region, and printing the profile is what makes the skin-transfer constant in Breath.js
    // re-measurable instead of magic.
    const profile = anteriorMidlineProfile( body, 0.86, 1.36, 0.025 );
    const levelTrack = [];

    for ( let frame = 0; frame < GATE_DURATION_SECONDS * SAMPLE_RATE_HZ; frame ++ ) {

        stack.update( FRAME_SECONDS );
        root.updateMatrixWorld( true );

        for ( const marker of profile ) trackMarker( body, marker );

        levelTrack.push( layer.level );

    }

    const abdomenBand = [
        worldHeightOfBone( root, 'spine_01' ) - 0.02,
        worldHeightOfBone( root, 'spine_02' ) + 0.02
    ];
    const ribcageBand = [
        worldHeightOfBone( root, 'spine_03' ) + 0.10,
        worldHeightOfBone( root, 'clavicle_l' ) - 0.05
    ];

    // Rate: count completed breaths over the run rather than reading the layer's instantaneous
    // period, so the per-breath jitter is included in what is checked.
    const breathsPerMinute = layer.breathsCompleted * 60 / GATE_DURATION_SECONDS;

    // Ti/Ttot straight off the waveform: the fraction of frames on which the tidal level rose.
    let risingFrames = 0;
    for ( let i = 1; i < levelTrack.length; i ++ ) {
        if ( levelTrack[ i ] > levelTrack[ i - 1 ] ) risingFrames ++;
    }
    const inspiratoryDutyCycle = risingFrames / ( levelTrack.length - 1 );
    const expiratoryRatio = ( 1 - inspiratoryDutyCycle ) / inspiratoryDutyCycle;

    const bellyExcursion = peakBandExcursion( profile, abdomenBand, 'z' );
    const ribcageExcursion = peakBandExcursion( profile, ribcageBand, 'z' );
    const ribcageLift = peakBandExcursion( profile, ribcageBand, 'y' );

    section( '2.5  BREATH' );
    gate( 'resting rate (brpm)', breathsPerMinute, 15.0, 16.6,
        'KORA-FF4 median 15.80, IQR 3.16. NOT the textbook 12.' );
    gate( 'Ti/Ttot', inspiratoryDutyCycle, 0.345, 0.385,
        'measured 0.365 at rest' );
    gate( 'I:E ratio (1:x)', expiratoryRatio, 1.60, 1.90,
        '1:1.74 at rest, NOT the clinically-quoted 1:2' );
    gate( 'ribcage surface AP (mm)', ribcageExcursion, 1.9, 2.9,
        'Takashima anterior ribcage 1.91-2.81 mm' );
    gate( 'belly surface AP (mm)', bellyExcursion, 4.0, 5.5,
        'Takashima anterior abdomen 4.79 mm' );
    note( 'ribcage surface cranio-caudal (mm)', ribcageLift.toFixed( 2 ),
        'Takashima 1.94-2.58 mm' );

    console.log( '  ....  anterior-midline AP excursion profile (height m -> mm):' );
    console.log( '        ' + profile
        .map( ( marker ) => `${ marker.height.toFixed( 2 ) }:${ ( ( marker.max.z - marker.min.z ) * 1000 ).toFixed( 2 ) }` )
        .join( '  ' ) );

    // Arousal is a separate claim: rate rises by the measured tertiles and depth scales with it.
    stack.reset();
    layer.setArousal( 1 );

    for ( const marker of profile ) resetMarker( marker );

    for ( let frame = 0; frame < GATE_DURATION_SECONDS * SAMPLE_RATE_HZ; frame ++ ) {

        stack.update( FRAME_SECONDS );
        root.updateMatrixWorld( true );

        for ( const marker of profile ) trackMarker( body, marker );

    }

    const arousedRate = layer.breathsCompleted * 60 / GATE_DURATION_SECONDS;

    gate( 'aroused rate (brpm)', arousedRate, 23.0, 26.5,
        'resting 15.8 + top reactivity tertile 9.17 = 24.97' );
    gate( 'aroused ribcage AP (mm)', peakBandExcursion( profile, ribcageBand, 'z' ), 4.0, 9.0,
        'scaled toward the deep-breath range; must not become a heave' );

    stack.dispose();

}

/**
 * The headline sway claim: how far the head actually moves, for the layer a consumer constructs,
 * across every seed and every window.
 *
 * Every cell is gated. The matrix is printed whether it passes or not, because the shape of the
 * failure is the diagnosis: an ML column that grows with the window is the weight-shift process
 * escaping, and a ratio column that falls below 1 is the anisotropy inverting — which the
 * research says is the single most visible way to get sway wrong.
 */
function measureSwayAmplitudeMatrix() {

    section( '2.6  POSTURAL SWAY — head excursion of `new Sway()`, as constructed' );

    const rows = [];
    const byWindow = new Map();

    for ( const seconds of SWAY_WINDOWS_SECONDS ) {

        const window = { medioLateral: [], anteroPosterior: [], ratio: [] };
        byWindow.set( seconds, window );

        for ( const seed of SWAY_SEEDS ) {

            const track = traceSwayHead( seed, seconds );

            const mlRms = rootMeanSquare( track.medioLateral ) * 1000;
            const apRms = rootMeanSquare( track.anteroPosterior ) * 1000;
            const ratio = apRms / mlRms;

            window.medioLateral.push( mlRms );
            window.anteroPosterior.push( apRms );
            window.ratio.push( ratio );

            const inBand = mlRms >= 3 && mlRms <= 5 && apRms >= 5 && apRms <= 7
                && ratio >= 1.25 && ratio <= 2.20;

            rows.push( `  ${ String( seconds ).padStart( 5 ) }s ${ String( seed ).padStart( 10 ) }   ` +
                `${ mlRms.toFixed( 2 ).padStart( 6 ) }  ${ apRms.toFixed( 2 ).padStart( 6 ) }  ` +
                `${ ratio.toFixed( 2 ).padStart( 5 ) }   ${ inBand ? 'ok' : 'OUT OF BAND' }` );

        }

    }

    console.log( '  window       seed   ML_RMS  AP_RMS  ratio' );
    for ( const row of rows ) console.log( row );
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

    // Honest note on what the matrix can and cannot prove, because a future maintainer who widens
    // the seed set will meet this and should know it is arithmetic rather than a regression.
    const shortest = byWindow.get( SWAY_WINDOWS_SECONDS[ 0 ] ).anteroPosterior;
    note( `AP RMS spread at ${ SWAY_WINDOWS_SECONDS[ 0 ] }s`,
        `x${ ( Math.max( ...shortest ) / Math.min( ...shortest ) ).toFixed( 2 ) }`,
        'the 5-7 mm gate spans x1.40; over ~40 seeds this window spreads x1.6, so a 60 s cell ' +
        'can fall out on sampling error alone. The 300 s and 900 s rows are the load-bearing ones.' );

}

/**
 * The spectral claim, made seed-robust.
 *
 * The frequency mode is the max bin of a Welch periodogram, which has enormous variance even
 * after averaging — 2 of 8 seeds used to land outside the AP band on a layer that was otherwise
 * correct. Two changes fix that without softening anything: the statistic is taken as the MEDIAN
 * across seeds, which is how Quijoux's figure was produced in the first place (a median across
 * subjects, not a single recording), and the power-weighted centroid of the postural band is
 * reported alongside as a second, much better-behaved estimator of the same thing.
 */
function measureSwaySpectrum() {

    section( '2.6  POSTURAL SWAY — spectrum of `new Sway()`, median over seeds' );

    const segment = 2048;
    const medioLateral = [];
    const anteroPosterior = [];

    for ( const seed of SWAY_SEEDS ) {

        const track = traceSwayHead( seed, SPECTRUM_DURATION_SECONDS );

        medioLateral.push( welchSpectrum( track.medioLateral, segment ) );
        anteroPosterior.push( welchSpectrum( track.anteroPosterior, segment ) );

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

    // This one is a tail fraction rather than a peak, so it needs no median: it is stable seed to
    // seed and the worst case is the number that matters.
    gate( 'ML power > 2 Hz, worst (%)', Math.max( ...medioLateral.map( ( s ) => s.powerAbove2HzPercent ) ), 0, 2,
        'essentially nothing above 2 Hz — faster reads as tremor' );
    gate( 'AP power > 2 Hz, worst (%)', Math.max( ...anteroPosterior.map( ( s ) => s.powerAbove2HzPercent ) ), 0, 2,
        'essentially nothing above 2 Hz — faster reads as tremor' );

}

/** One run of the default layer, returning the head's horizontal excursion in metres. */
function traceSwayHead( seed, seconds ) {

    const { stack, root } = buildStack( ( options ) => new Sway( options ), seed );

    const head = root.getObjectByName( 'head' );
    const medioLateral = [];
    const anteroPosterior = [];

    for ( let frame = 0; frame < seconds * SAMPLE_RATE_HZ; frame ++ ) {

        stack.update( FRAME_SECONDS );
        root.updateMatrixWorld( true );

        medioLateral.push( head.matrixWorld.elements[ 12 ] );
        anteroPosterior.push( head.matrixWorld.elements[ 14 ] );

    }

    stack.dispose();

    return { medioLateral, anteroPosterior };

}

function measureWeightShifts() {

    section( '2.6 / 2.9  WEIGHT SHIFTS — Duarte & Zatsiorsky rates' );

    const { stack, layer, root } = buildStack( ( options ) => new Sway( options ) );

    const head = root.getObjectByName( 'head' );
    const track = [];

    for ( let frame = 0; frame < EVENT_DURATION_SECONDS * SAMPLE_RATE_HZ; frame ++ ) {

        stack.update( FRAME_SECONDS );

        // Sampled sparsely: two hours at 60 Hz is 432,000 frames and the posture signal is
        // measured in minutes, so one sample a second is generous.
        if ( frame % SAMPLE_RATE_HZ === 0 ) {

            root.updateMatrixWorld( true );
            track.push( new Vector3().setFromMatrixPosition( head.matrixWorld ) );

        }

    }

    const minutes = EVENT_DURATION_SECONDS / 60;

    // The layer counts fidgets and shifts across both axes, so the expectation is the sum of the
    // two per-axis rates: fidget 1.2 + 1.0 = 2.2/min, shift 0.30 + 0.19 = 0.49/min.
    gate( 'fidgets per minute (both axes)', layer.eventCounts.fidget / minutes, 1.9, 2.5,
        'ML 1.2/min + AP 1.0/min' );
    gate( 'shifts per minute (both axes)', layer.eventCounts.shift / minutes, 0.38, 0.62,
        'ML 0.30/min + AP 0.19/min' );

    // The posture cap is stated in centre-of-pressure millimetres — 30 ML, 22 AP — and only
    // POSTURE_HEAD_TRANSFER of it reaches the head, so the peaks below are dominated by the
    // balance band rather than by the shifts. That is the intended balance of the two processes.
    note( 'peak head ML offset (mm)', ( extreme( track, 'x' ) * 1000 ).toFixed( 1 ),
        'COP shift 22 +- 38 mm ML, capped at 30 mm, x0.20 to the head, plus balance and drift' );
    note( 'peak head AP offset (mm)', ( extreme( track, 'z' ) * 1000 ).toFixed( 1 ),
        'COP shift 17 +- 15 mm AP, capped at 22 mm, x0.20 to the head, plus balance and drift' );

    stack.dispose();

}

function measureDiscourseCoupling() {

    section( '2.6  DISCOURSE COUPLING — Cassell et al. 2001' );

    const trials = 20000;

    for ( const [ label, speakerChanged, low, high, source ] of [
        [ 'at speaker change', true, 0.245, 0.275, 'a shift accompanies 26% of these' ],
        [ 'at plain turn boundary', false, 0.070, 0.092, 'only 8% of these' ]
    ] ) {

        const { stack, layer } = buildStack( ( options ) => new Sway( options ) );

        let shifts = 0;
        for ( let trial = 0; trial < trials; trial ++ ) {
            if ( layer.markDiscourseBoundary( { speakerChanged } ) ) shifts ++;
        }

        gate( `shift probability ${ label }`, shifts / trials, low, high, source );

        stack.dispose();

    }

}

function measureIdleMotion() {

    section( '2.7  IDLE MICRO-MOTION — Perlin 1 / 2 / 4 Hz' );

    const { stack, root } = buildStack( ( options ) => new IdleMotion( options ) );

    const hand = root.getObjectByName( 'hand_l' );
    const forearm = root.getObjectByName( 'lowerarm_l' );
    const head = root.getObjectByName( 'head' );

    const shoulder = root.getObjectByName( 'upperarm_l' );

    const handTrack = [];
    const forearmTrack = [];

    // The joints are measured as ROTATION, in degrees off rest, because that is what the layer
    // actually authors. A position metric on the head would read 0.00 mm and mean nothing —
    // IdleMotion rotates the head about its own joint and never touches the neck.
    const joints = [
        { label: 'shoulder', bone: shoulder, latticeHz: 1, rest: shoulder.quaternion.clone(), angles: [], peak: 0 },
        { label: 'elbow', bone: forearm, latticeHz: 2, rest: forearm.quaternion.clone(), angles: [], peak: 0 },
        { label: 'wrist', bone: hand, latticeHz: 4, rest: hand.quaternion.clone(), angles: [], peak: 0 },
        { label: 'head', bone: head, latticeHz: 0.5, rest: head.quaternion.clone(), angles: [], peak: 0 }
    ];

    for ( let frame = 0; frame < SPECTRUM_DURATION_SECONDS * SAMPLE_RATE_HZ; frame ++ ) {

        stack.update( FRAME_SECONDS );
        root.updateMatrixWorld( true );

        handTrack.push( new Vector3().setFromMatrixPosition( hand.matrixWorld ) );
        forearmTrack.push( new Vector3().setFromMatrixPosition( forearm.matrixWorld ) );

        for ( const joint of joints ) {

            // Signed by the x component so the series oscillates about zero and has a spectrum;
            // an unsigned angle would fold every cycle in half and double the apparent frequency.
            const angle = angleBetweenDegrees( joint.bone.quaternion, joint.rest );
            const sign = joint.bone.quaternion.x >= joint.rest.x ? 1 : -1;

            joint.angles.push( angle * sign );
            joint.peak = Math.max( joint.peak, angle );

        }

    }

    note( 'hand excursion, peak-to-peak (mm)', peakToPeakResultant( handTrack ).toFixed( 2 ),
        'TUNING — Improv gives no idle amplitude; judge this number, do not trust it' );
    note( 'hand excursion, RMS (mm)', ( rootMeanSquare( handTrack.map( ( p ) => p.z ) ) * 1000 ).toFixed( 2 ),
        'the peak-to-peak above is the extreme over five minutes, not the typical motion' );
    note( 'elbow excursion, peak-to-peak (mm)', peakToPeakResultant( forearmTrack ).toFixed( 2 ), '' );

    // The octave structure is the actual claim of 2.7, so it is checked at the joints rather than
    // inferred from the hand — hand POSITION is dominated by the shoulder, which has the longest
    // lever, so its spectrum reports the shoulder's rate no matter what the wrist is doing.
    for ( const joint of joints ) {

        const spectrum = welchSpectrum( joint.angles, 2048 );
        const expected = joint.latticeHz * 0.5;

        note( `${ joint.label } peak rotation (deg)`, joint.peak.toFixed( 3 ), '' );
        gate( `${ joint.label } spectral mode (Hz)`, spectrum.mode, expected * 0.72, expected * 1.35,
            `Improv lattice ${ joint.latticeHz } Hz; gradient noise peaks near half its lattice rate` );

    }

    const handSpectrum = welchSpectrum( handTrack.map( ( p ) => p.z ), 2048 );

    note( 'hand position spectral mode (Hz)', handSpectrum.mode.toFixed( 3 ),
        'shoulder-dominated, as expected: the longest lever wins the position spectrum' );
    gate( 'hand power in 8-12 Hz tremor band (%)', handSpectrum.powerInTremorBandPercent, 0, 1,
        'idle motion reaching the tremor band reads as illness' );

    stack.dispose();

}

/**
 * Everything above runs at a metronomic 1/60 s. A real render loop does not: it jitters, it drops
 * frames, and it hands back a multi-second delta when a backgrounded tab returns. Every rate in
 * these layers is either a Poisson process or an integrator, and both classes have a standard way
 * of being wrong under variable dt — `rate * dt` over-fires, and a fixed per-frame increment makes
 * the whole signal a function of frame rate rather than of time. This checks neither happened.
 */
function measureVariableFrameTime() {

    section( 'VARIABLE FRAME TIME — a jittering 30-120 fps loop, plus one stall' );

    const { stack, root } = buildStack( ( options ) => new Sway( options ) );

    const head = root.getObjectByName( 'head' );
    const jitter = new MotionRandom( 99 );

    const medioLateral = [];
    const anteroPosterior = [];

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

    }

    gate( 'ML RMS under jitter (mm)', rootMeanSquare( medioLateral ) * 1000, 3.0, 5.0,
        'same gate as the fixed-step run; frame rate must not change the amplitude' );
    gate( 'AP RMS under jitter (mm)', rootMeanSquare( anteroPosterior ) * 1000, 5.0, 7.0,
        'same gate as the fixed-step run' );

    stack.dispose();

}

function measureDeterminism() {

    section( 'DETERMINISM — the same seed must give the same trace' );

    const trace = () => {

        const { stack, root } = buildStack( ( options ) => new Sway( options ) );
        const head = root.getObjectByName( 'head' );
        const samples = [];

        for ( let frame = 0; frame < 30 * SAMPLE_RATE_HZ; frame ++ ) {

            stack.update( FRAME_SECONDS );
            root.updateMatrixWorld( true );
            samples.push( head.matrixWorld.elements[ 12 ], head.matrixWorld.elements[ 14 ] );

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
 * previous one has already driven captures a DISPLACED rest and every absolute measurement below
 * would be off by the last frame of the previous run.
 */
function buildStack( createLayer, seed = SEED ) {

    restoreRestPose();

    const root = figure.root;
    const stack = new MotionStack( { seed } );

    stack.bind( createMotionTarget( root ) );

    const layer = stack.add( createLayer( {} ) );

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

/**
 * One marker per height band: the most anterior vertex on the midline, which is the closest thing
 * this mesh has to where Takashima put a reflective marker.
 */
function anteriorMidlineProfile( mesh, fromHeight, toHeight, spacing ) {

    const position = mesh.geometry.attributes.position;
    const local = new Vector3();
    const world = new Vector3();

    const markers = [];

    for ( let height = fromHeight; height <= toHeight + 1e-9; height += spacing ) {

        markers.push( { height, index: -1, bestZ: -Infinity } );

    }

    for ( let index = 0; index < position.count; index ++ ) {

        local.fromBufferAttribute( position, index );
        mesh.applyBoneTransform( index, local );
        world.copy( local ).applyMatrix4( mesh.matrixWorld );

        if ( Math.abs( world.x ) > 0.015 ) continue;

        for ( const marker of markers ) {

            if ( Math.abs( world.y - marker.height ) > spacing * 0.5 ) continue;
            if ( world.z <= marker.bestZ ) continue;

            marker.bestZ = world.z;
            marker.index = index;

        }

    }

    return markers.filter( ( marker ) => marker.index >= 0 ).map( ( marker ) => {

        marker.min = new Vector3( Infinity, Infinity, Infinity );
        marker.max = new Vector3( -Infinity, -Infinity, -Infinity );
        return marker;

    } );

}

function trackMarker( mesh, marker ) {

    const point = new Vector3().fromBufferAttribute( mesh.geometry.attributes.position, marker.index );

    mesh.applyBoneTransform( marker.index, point );
    point.applyMatrix4( mesh.matrixWorld );

    marker.min.min( point );
    marker.max.max( point );

}

function resetMarker( marker ) {

    marker.min.set( Infinity, Infinity, Infinity );
    marker.max.set( -Infinity, -Infinity, -Infinity );

}

/** The largest excursion any marker in the height band saw, in millimetres. */
function peakBandExcursion( profile, [ fromHeight, toHeight ], axis ) {

    let peak = 0;

    for ( const marker of profile ) {

        if ( marker.height < fromHeight || marker.height > toHeight ) continue;

        peak = Math.max( peak, marker.max[ axis ] - marker.min[ axis ] );

    }

    return peak * 1000;

}

// --- measurement ------------------------------------------------------------------------------

function peakToPeakResultant( points ) {

    // Millimetres of travel of the point itself, which is what a viewer sees, rather than of any
    // one axis. Measured against the mean position so a static offset does not count as motion.
    const centre = new Vector3();
    for ( const point of points ) centre.add( point );
    centre.divideScalar( points.length );

    let furthest = 0;
    for ( const point of points ) furthest = Math.max( furthest, point.distanceTo( centre ) );

    return furthest * 2 * 1000;

}

function angleBetweenDegrees( a, b ) {

    const dot = Math.min( Math.abs( a.x * b.x + a.y * b.y + a.z * b.z + a.w * b.w ), 1 );

    return 2 * Math.acos( dot ) * 180 / Math.PI;

}

function extreme( points, axis ) {

    let mean = 0;
    for ( const point of points ) mean += point[ axis ];
    mean /= points.length;

    let furthest = 0;
    for ( const point of points ) furthest = Math.max( furthest, Math.abs( point[ axis ] - mean ) );

    return furthest;

}

function median( values ) {

    const sorted = [ ...values ].sort( ( a, b ) => a - b );
    const middle = sorted.length >> 1;

    if ( sorted.length % 2 === 1 ) return sorted[ middle ];

    return ( sorted[ middle - 1 ] + sorted[ middle ] ) / 2;

}

function rootMeanSquare( samples ) {

    let mean = 0;
    for ( const sample of samples ) mean += sample;
    mean /= samples.length;

    let total = 0;
    for ( const sample of samples ) total += ( sample - mean ) ** 2;

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

        let mean = 0;
        for ( let i = 0; i < segmentLength; i ++ ) mean += samples[ start + i ];
        mean /= segmentLength;

        const windowed = new Float64Array( segmentLength );
        for ( let i = 0; i < segmentLength; i ++ ) {
            windowed[ i ] = ( samples[ start + i ] - mean ) * window[ i ];
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
    let tremorBand = 0;
    let mode = 0;
    let modePower = -1;
    let weightedFrequency = 0;

    for ( let k = firstBin; k < half; k ++ ) {

        const frequency = frequencyOf( k );

        total += power[ k ];
        weightedFrequency += power[ k ] * frequency;

        if ( frequency > 2 ) above2Hz += power[ k ];
        if ( frequency >= 8 && frequency <= 12 ) tremorBand += power[ k ];
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
        powerInTremorBandPercent: 100 * tremorBand / total,
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

    const range = high - low < 1e-6 ? `= ${ low }` : `${ format( low ) } .. ${ format( high ) }`;

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
