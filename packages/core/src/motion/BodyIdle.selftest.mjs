/**
 * Gate for BodyIdle — arm, hand, shoulder-girdle and trunk idle motion.
 *
 * Every claim BodyIdle makes is a claim about a number, so this file does not check that the
 * layer ran. It drives it against a real figure GLB and measures what actually moved:
 *
 *   AMPLITUDE   per-joint angular RMS and peak, in degrees off rest, measured on the committed
 *               bone rather than on the layer's internal state — so the whole path through
 *               MotionStack is in the measurement. Gated as a CEILING and as a descending chain,
 *               because the failure mode here is over-animating, not under-animating.
 *
 *   OCTAVES     the dominant frequency of each joint's own angle series, and the RATIO between
 *               successive joints. This is the actual claim of Perlin's 1 / 2 / 4 Hz ladder, and
 *               asserting it in the OUTPUT rather than in the constants is the point: a constant
 *               that never reaches a bone proves nothing. Gradient noise at lattice rate f peaks
 *               near 0.5f, so the absolute frequencies land near 0.5 / 1 / 2 Hz — the ratio is
 *               what is invariant, and the ratio is what is gated.
 *
 *               🚩 "Dominant" here is the MEDIAN-POWER frequency f50, not the single largest bin.
 *               Gradient noise is broadband, so its largest bin is a noisy statistic — over one
 *               minute it scattered by more than an octave between the two arms, which would have
 *               made this gate a coin toss rather than a measurement. f50 integrates the whole
 *               band and converges; it is also the statistic the sway literature reports, so the
 *               two spectral gates in this repo are stated in the same terms. The largest bin is
 *               still printed beside it, because when the two disagree wildly something is wrong.
 *
 *   DECORRELATION  Pearson r between the left and right series at each arm joint. Symmetric arm
 *               drift reads as mechanical instantly, so a low |r| is not a nicety.
 *
 *   TOGETHERNESS   Pearson r between two fingers of the SAME hand, which must be high — a relaxed
 *               hand moves as a loose unit, and fingers wandering independently read as a hand
 *               playing an invisible piano.
 *
 *   AROUSAL     the ratio of RMS at arousal 1 to RMS at arousal 0, against Wallbott's 2.73×
 *               dynamics range, plus the 8–12 Hz tremor-band power at full arousal, which is the
 *               thing the held-back rate gain exists to prevent.
 *
 *   EVENTS      the size and the decay of the onWeightShift() transient, isolated by differencing
 *               two otherwise identical runs, and the shoulder-settle rate over four hours.
 *
 *   ROBUSTNESS  the same amplitude under jittered frame times, and bit-identical output from the
 *               same seed twice.
 *
 * A measurement outside its range is printed as FAIL and the process exits non-zero. It is not
 * grounds for widening the range.
 *
 * Usage:  node "packages/core/src/motion/BodyIdle.selftest.mjs"
 *         node "packages/core/src/motion/BodyIdle.selftest.mjs" assets/figures/figure_g100.glb
 *         BODY_IDLE_SEED=42 node "packages/core/src/motion/BodyIdle.selftest.mjs"
 *
 * The seed override exists because a gate that only holds on one draw of a stochastic process is
 * not a gate. Every range below was checked across seven seeds and all five figure variants.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// three's GLTFLoader assumes a browser when it decodes embedded textures. Nothing here inspects
// pixels, so two stubs get the loader as far as the skinning data.
globalThis.self ??= globalThis;
globalThis.createImageBitmap ??= async () => ( { width: 1, height: 1, close() {} } );

const { Quaternion } = await import( 'three' );
const { Figure } = await import( '../figure/Figure.js' );
const { MotionStack, createMotionTarget } = await import( './MotionStack.js' );
const { MotionRandom } = await import( './Signals.js' );
const { BodyIdle } = await import( './BodyIdle.js' );

const SAMPLE_RATE_HZ = 60;
const FRAME_SECONDS = 1 / SAMPLE_RATE_HZ;
const GATE_DURATION_SECONDS = 60;    // what the brief asks for
const EVENT_DURATION_SECONDS = 4 * 3600; // four hours; one hour leaves a +-2 sd band an octave wide
const SEED = Number( process.env.BODY_IDLE_SEED ?? 20260807 );

/** 1024 samples at 60 Hz is a 17 s segment: 0.059 Hz resolution, six segments over the minute. */
const SPECTRUM_SEGMENT = 1024;

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

// The GLB's own rest pose, snapshotted before anything has run, and restored before every stack
// is bound — a layer that binds to an already-posed figure captures a displaced rest.
const restPose = new Map();

figure.root.traverse( ( object ) => {

    restPose.set( object, { quaternion: object.quaternion.clone(), position: object.position.clone() } );

} );

/** The joints measured, and the chain relationships the gates are stated over. */
const MEASURED_BONES = [
    { label: 'clavicle L', bone: 'clavicle_l' },
    { label: 'clavicle R', bone: 'clavicle_r' },
    { label: 'shoulder L', bone: 'upperarm_l' },
    { label: 'shoulder R', bone: 'upperarm_r' },
    { label: 'elbow L', bone: 'lowerarm_l' },
    { label: 'elbow R', bone: 'lowerarm_r' },
    { label: 'wrist L', bone: 'hand_l' },
    { label: 'wrist R', bone: 'hand_r' },
    { label: 'finger index L', bone: 'index_01_l' },
    { label: 'finger middle L', bone: 'middle_01_l' },
    { label: 'finger index R', bone: 'index_01_r' },
    { label: 'torso twist', bone: 'spine_03' }
];

console.log( `\nfigure: ${ path.relative( repoRoot, figurePath ) }` );
console.log( `sampling: ${ SAMPLE_RATE_HZ } Hz, ${ GATE_DURATION_SECONDS } s, seed ${ SEED }\n` );

measureAmplitudeAndCorrelation();
measureOctaveStructure();
measureArousalGain();
measureWeightShiftResponse();
measureShoulderSettleRate();
measureVariableFrameTime();
measureDeterminism();

report();

// ==============================================================================================

/**
 * The layer AS CONSTRUCTED, over the 60 s the brief asks for: how far each joint moves, and how
 * independent the two sides are. Discrete events are left ON here on purpose — a gate that only
 * fires against a configuration nobody ships is not a gate.
 */
function measureAmplitudeAndCorrelation() {

    section( 'AMPLITUDE — per-joint angular RMS and peak, degrees off rest' );

    const tracks = run( { seconds: GATE_DURATION_SECONDS } );

    for ( const track of tracks ) {

        note( track.label, `${ track.rmsDegrees.toFixed( 3 ) } rms`,
            `peak ${ track.peakDegrees.toFixed( 3 ) }°` );

    }

    const shoulder = averageRms( tracks, 'shoulder' );
    const elbow = averageRms( tracks, 'elbow' );
    const wrist = averageRms( tracks, 'wrist' );
    const clavicle = averageRms( tracks, 'clavicle' );
    const finger = averageRms( tracks, 'finger' );
    const torso = averageRms( tracks, 'torso' );

    gate( 'shoulder RMS (deg)', shoulder, 0.20, 1.20,
        'TUNING — a few degrees peak at the shoulder, so well under one degree RMS' );
    gate( 'elbow RMS / shoulder RMS', elbow / shoulder, 0.05, 0.95,
        'amplitude must fall down the chain, not rise' );
    gate( 'wrist RMS / elbow RMS', wrist / elbow, 0.05, 0.95, 'same' );
    gate( 'finger RMS (deg)', finger, 0.01, 0.30,
        'very small — a relaxed finger drifts, it does not gesture' );
    gate( 'clavicle RMS (deg)', clavicle, 0.02, 0.60,
        'the girdle is the slowest and one of the smallest joints in the chain' );
    gate( 'torso twist RMS (deg)', torso, 0.01, 0.40,
        'an axial twist only, on the one trunk axis Breath and Sway do not write' );

    const peak = Math.max( ...tracks.map( ( track ) => track.peakDegrees ) );

    gate( 'largest peak, any joint (deg)', peak, 0, 5.0,
        'micro-motion ceiling — over-animating an idle is as bad as having none' );

    section( 'DECORRELATION — Pearson r, left against right' );

    for ( const pair of [ 'clavicle', 'shoulder', 'elbow', 'wrist', 'finger index' ] ) {

        const left = findTrack( tracks, `${ pair } L` );
        const right = findTrack( tracks, `${ pair } R` );
        const r = pearson( left.series, right.series );

        gate( `${ pair } left-right r`, Math.abs( r ), 0, 0.25,
            `signed r = ${ r.toFixed( 3 ) }; symmetric drift reads as mechanical` );

    }

    section( 'TOGETHERNESS — Pearson r, two fingers of the same hand' );

    const index = findTrack( tracks, 'finger index L' );
    const middle = findTrack( tracks, 'finger middle L' );
    const together = pearson( index.series, middle.series );

    gate( 'index/middle same-hand r', together, 0.50, 1.0,
        'a relaxed hand moves as a loose unit, not as five independent digits' );

}

/**
 * The octave ladder, measured rather than asserted from the constants.
 *
 * Events are disabled for this pass alone. The 1:2:4 claim is a claim about the noise floor, and
 * a shoulder settle injects a half-hertz transient into the two upper joints that would bias
 * their spectral mode; the settle is measured on its own further down.
 */
function measureOctaveStructure() {

    section( 'OCTAVES — dominant frequency per joint, Perlin 1 / 2 / 4 Hz' );

    const tracks = run( { seconds: GATE_DURATION_SECONDS, options: { eventsEnabled: false } } );

    for ( const track of tracks ) {

        track.spectrum = welchSpectrum( track.series, SPECTRUM_SEGMENT, SAMPLE_RATE_HZ );

    }

    for ( const label of [ 'clavicle L', 'shoulder L', 'elbow L', 'wrist L', 'finger index L', 'torso twist' ] ) {

        const track = findTrack( tracks, label );
        note( `${ label } dominant (Hz)`, track.spectrum.f50.toFixed( 3 ),
            `peak bin ${ track.spectrum.mode.toFixed( 2 ) }, f95 ${ track.spectrum.f95.toFixed( 2 ) } Hz` );

    }

    // Both sides, because the ratio holding on one arm and not the other would mean a stream was
    // wired to the wrong joint.
    for ( const side of [ 'L', 'R' ] ) {

        const shoulder = findTrack( tracks, `shoulder ${ side }` ).spectrum.f50;
        const elbow = findTrack( tracks, `elbow ${ side }` ).spectrum.f50;
        const wrist = findTrack( tracks, `wrist ${ side }` ).spectrum.f50;

        gate( `${ side }: elbow / shoulder`, elbow / shoulder, 1.6, 2.5,
            'Improv N1 is one octave above N0' );
        gate( `${ side }: wrist / elbow`, wrist / elbow, 1.6, 2.5,
            'Improv N2 is one octave above N1' );
        gate( `${ side }: wrist / shoulder`, wrist / shoulder, 3.2, 5.0,
            'two octaves end to end' );

    }

    const wristTremor = findTrack( tracks, 'wrist L' ).spectrum.tremorBandPercent;
    const fingerTremor = findTrack( tracks, 'finger index L' ).spectrum.tremorBandPercent;

    gate( 'wrist power in 8-12 Hz band (%)', wristTremor, 0, 1,
        'idle motion reaching the tremor band reads as illness' );
    gate( 'finger power in 8-12 Hz band (%)', fingerTremor, 0, 1,
        'why the octave ladder stops at the wrist instead of continuing to 8 Hz' );

}

/**
 * Wallbott's dynamics scale is the primary arousal gain: 1.00 at sadness, 2.73 at hot anger. The
 * amplitude ratio should land on that; the rate is deliberately held back, which is what keeps
 * the aroused figure out of the tremor band.
 */
function measureArousalGain() {

    section( 'AROUSAL — Wallbott dynamics 1.00 (sadness) to 2.73 (hot anger)' );

    const calm = run( { seconds: GATE_DURATION_SECONDS, options: { eventsEnabled: false } } );
    const roused = run( {
        seconds: GATE_DURATION_SECONDS,
        options: { eventsEnabled: false },
        configure: ( layer ) => layer.setArousal( 1 )
    } );

    const calmRms = averageRms( calm, 'shoulder' );
    const rousedRms = averageRms( roused, 'shoulder' );

    note( 'shoulder RMS at arousal 0 (deg)', calmRms.toFixed( 3 ), '' );
    note( 'shoulder RMS at arousal 1 (deg)', rousedRms.toFixed( 3 ), '' );

    gate( 'amplitude gain, arousal 0 -> 1', rousedRms / calmRms, 2.3, 3.1,
        'Wallbott 2.73x; the tolerance is the RMS sampling scatter over one minute' );

    const wrist = welchSpectrum( findTrack( roused, 'wrist L' ).series, SPECTRUM_SEGMENT, SAMPLE_RATE_HZ );

    note( 'wrist dominant at arousal 1 (Hz)', wrist.mode.toFixed( 3 ),
        `f95 ${ wrist.f95.toFixed( 2 ) } Hz` );
    gate( 'wrist 8-12 Hz band at arousal 1 (%)', wrist.tremorBandPercent, 0, 1,
        'the reason the rate gain is the square root of the amplitude gain' );

}

/**
 * onWeightShift() has to produce something visible, or Sway is calling into a no-op.
 *
 * Measured as the DIFFERENCE between two otherwise identical runs — same seed, same options,
 * same Poisson draws, one of them with the call — because the transient is small enough to hide
 * under the noise floor's own peak. Comparing peaks across the two runs measured nothing: the
 * first attempt at this gate reported an identical 1.830° either way and would have passed a
 * completely inert onWeightShift(). A difference isolates the event exactly, and onWeightShift()
 * draws nothing from the random stream, so the two runs stay in step in every other respect.
 */
function measureWeightShiftResponse() {

    const SHIFT_AT_SECONDS = 6;
    const RUN_SECONDS = 20;

    section( 'EVENTS — onWeightShift()' );

    const quiet = run( { seconds: RUN_SECONDS } );
    const fired = run( {
        seconds: RUN_SECONDS,
        onFrame: ( layer, elapsedSeconds, previousSeconds ) => {

            // Once, six seconds in, so there is a clean noise floor on either side of it.
            if ( previousSeconds < SHIFT_AT_SECONDS && elapsedSeconds >= SHIFT_AT_SECONDS ) {

                layer.onWeightShift( { magnitude: 1 } );

            }

        }
    } );

    for ( const label of [ 'shoulder L', 'shoulder R', 'elbow L', 'clavicle L' ] ) {

        const transient = peakDifferenceDegrees( findTrack( quiet, label ), findTrack( fired, label ) );

        note( `${ label } shift transient (deg)`, transient.toFixed( 3 ), '' );

    }

    const shoulder = peakDifferenceDegrees( findTrack( quiet, 'shoulder L' ), findTrack( fired, 'shoulder L' ) );
    const clavicle = peakDifferenceDegrees( findTrack( quiet, 'clavicle L' ), findTrack( fired, 'clavicle L' ) );

    gate( 'shoulder shift transient (deg)', shoulder, 0.70, 2.50,
        'TUNING 1.5° peak, decaying — an event, not a gesture' );
    gate( 'clavicle share of the swing', clavicle / shoulder, 0.05, 0.45,
        'a weight shift is an arm event the girdle barely feels' );

    // And it has to END — exactly, not approximately. A transient that leaves a residue behind is
    // a pose change rather than a settle, and a hundred of them over an hour would walk the arms
    // somewhere no one asked for. The layer drops the swing at four decay constants, so twelve
    // seconds after the call the two runs must agree bit for bit.
    const settled = differenceDegreesAt( findTrack( quiet, 'shoulder L' ), findTrack( fired, 'shoulder L' ),
        Math.round( ( SHIFT_AT_SECONDS + 12 ) * SAMPLE_RATE_HZ ) );

    // 1e-4° rather than 0: the angle between two quaternions is 2*acos(dot), and acos near 1
    // amplifies a one-ulp difference in dot into ~1e-6 of a degree. That is the resolution floor
    // of the comparison, not a residue in the layer. It is still four orders of magnitude under
    // the transient it is asserting has gone.
    gate( 'residual 12 s later (deg)', settled, 0, 1e-4,
        'the swing decays back to the noise floor and leaves no offset behind' );

}

/** The discrete settle rate, over an hour, against the ~1/min family the literature reports. */
function measureShoulderSettleRate() {

    section( 'EVENTS — shoulder settle rate' );

    const { layer } = drive( { seconds: EVENT_DURATION_SECONDS, options: {}, track: false } );

    const perMinute = layer.eventCounts.shoulderSettle * 60 / EVENT_DURATION_SECONDS;

    note( 'settles observed', layer.eventCounts.shoulderSettle,
        `over ${ ( EVENT_DURATION_SECONDS / 3600 ).toFixed( 0 ) } h; Poisson, so the band below is +-2 sd` );
    gate( 'shoulder settles per minute', perMinute, 0.40, 0.62,
        'TUNING 0.5/min — a fraction of the ~1/min idle posture-event budget' );

}

/**
 * Everything above runs at a metronomic 1/60 s. A real render loop does not: it jitters, it drops
 * frames, and it hands back a long delta when a backgrounded tab returns. The noise phase is
 * integrated from dt rather than read off a frame counter precisely so that none of that changes
 * what the layer produces, and this is the measurement that says so.
 */
function measureVariableFrameTime() {

    section( 'ROBUSTNESS — jittered frame time' );

    const steady = run( { seconds: GATE_DURATION_SECONDS, options: { eventsEnabled: false } } );
    const jittered = driveJittered( GATE_DURATION_SECONDS );

    const steadyRms = averageRms( steady, 'shoulder' );
    const jitteredRms = averageRms( jittered, 'shoulder' );

    note( 'shoulder RMS at 60 Hz (deg)', steadyRms.toFixed( 3 ), '' );
    note( 'shoulder RMS, jittered (deg)', jitteredRms.toFixed( 3 ), '20-120 ms frames, one 400 ms stall' );

    gate( 'jittered / steady RMS', jitteredRms / steadyRms, 0.85, 1.15,
        'amplitude must not depend on how fast the browser happens to be running' );

}

/** A critic run has to be reproducible frame for frame, or no measurement above is comparable. */
function measureDeterminism() {

    section( 'DETERMINISM' );

    const first = run( { seconds: 20 } );
    const second = run( { seconds: 20 } );

    let largestDifference = 0;

    for ( let index = 0; index < first.length; index ++ ) {

        for ( let sample = 0; sample < first[ index ].series.length; sample ++ ) {

            largestDifference = Math.max( largestDifference,
                Math.abs( first[ index ].series[ sample ] - second[ index ].series[ sample ] ) );

        }

    }

    gate( 'largest sample difference (deg)', largestDifference, 0, 1e-9,
        'same seed, same stack, same twenty seconds' );

}

// --- the harness ------------------------------------------------------------------------------

/**
 * Builds a stack with one BodyIdle on the figure's own rest pose, runs it, and returns the
 * per-joint angle tracks.
 *
 * @param {Object} settings
 * @param {number} settings.seconds
 * @param {Object} [settings.options] - Passed to the BodyIdle constructor.
 * @param {Function} [settings.configure] - Called once with the layer, after it joins the stack.
 * @param {Function} [settings.onFrame] - `( layer, elapsedSeconds, previousSeconds )`.
 */
function run( settings ) {

    return drive( { ...settings, track: true } ).tracks;

}

/**
 * The same 60 s, delivered in frames of 20–120 ms with one 400 ms stall in the middle — a tab
 * that lost focus and came back. The stall is longer than MotionStack's dt clamp on purpose.
 */
function driveJittered( seconds ) {

    const jitter = new MotionRandom( SEED );
    const stallAt = seconds / 2;

    let elapsed = 0;

    return drive( {
        seconds,
        options: { eventsEnabled: false },
        frameDelta: () => {

            const stalling = elapsed < stallAt && elapsed + 0.4 >= stallAt;
            const delta = stalling ? 0.4 : jitter.range( 0.020, 0.120 );

            elapsed += delta;

            return delta;

        }
    } ).tracks;

}

function drive( { seconds, options = {}, configure, onFrame, frameDelta, track = true } ) {

    restoreRestPose();

    const root = figure.root;
    const stack = new MotionStack( { seed: SEED } );

    stack.bind( createMotionTarget( root ) );

    const layer = stack.add( new BodyIdle( options ) );

    if ( configure !== undefined ) configure( layer );

    // Rest is captured after bind and before the first update, so the delta measured below is
    // exactly what the layer contributed and nothing else.
    const tracks = MEASURED_BONES.map( ( measured ) => {

        const bone = root.getObjectByName( measured.bone );

        return {
            label: measured.label,
            bone,
            // 🚩 Normalised before inverting. The GLB stores quaternions to six decimal places,
            // so every rest rotation is ~5e-7 off unit length; Quaternion.invert() is a conjugate,
            // which is only the true inverse of a unit quaternion. Left raw, the delta below comes
            // out with |q| slightly under 1 and 2*acos(w) reports a phantom 0.06° on a bone that
            // did not move — a floor that swamped the finger and clavicle measurements and made a
            // run look non-deterministic against itself.
            restInverse: bone === undefined ? new Quaternion() : bone.quaternion.clone().normalize().invert(),
            components: [ [], [], [] ],
            // The whole delta, four numbers per frame, kept so that two runs can be differenced
            // against each other rather than only against rest. See measureWeightShiftResponse().
            deltas: [],
            angles: [],
            peakDegrees: 0
        };

    } );

    const delta = new Quaternion();

    let elapsedSeconds = 0;

    while ( elapsedSeconds < seconds ) {

        const previousSeconds = elapsedSeconds;
        const step = frameDelta === undefined ? FRAME_SECONDS : frameDelta();

        stack.update( step );
        elapsedSeconds += step;

        if ( onFrame !== undefined ) onFrame( layer, elapsedSeconds, previousSeconds );

        if ( track === false ) continue;

        for ( const entry of tracks ) {

            if ( entry.bone === undefined ) continue;

            delta.copy( entry.restInverse ).multiply( entry.bone.quaternion ).normalize();

            // The rotation magnitude, unsigned, for RMS and peak.
            const angleDegrees = 2 * Math.acos( Math.min( Math.abs( delta.w ), 1 ) ) * 180 / Math.PI;

            entry.angles.push( angleDegrees );
            entry.peakDegrees = Math.max( entry.peakDegrees, angleDegrees );

            // And the three imaginary components, from which a SIGNED series is chosen below. A
            // signed series is what a spectrum and a correlation need — an unsigned angle folds
            // every cycle in half and doubles the apparent frequency.
            entry.components[ 0 ].push( delta.x );
            entry.components[ 1 ].push( delta.y );
            entry.components[ 2 ].push( delta.z );

            entry.deltas.push( delta.x, delta.y, delta.z, delta.w );

        }

    }

    for ( const entry of tracks ) {

        entry.rmsDegrees = rootMeanSquare( entry.angles );
        entry.series = principalComponentSeries( entry.components );

    }

    stack.dispose();

    return { stack, layer, tracks };

}

function restoreRestPose() {

    for ( const [ object, rest ] of restPose ) {

        object.quaternion.copy( rest.quaternion );
        object.position.copy( rest.position );

    }

    figure.root.updateMatrixWorld( true );

}

/**
 * The most active of the delta quaternion's three imaginary components, in degrees.
 *
 * For a small rotation q ≈ ( axis · θ/2, 1 ), each component is proportional to the rotation
 * about that basis axis, so the one with the largest variance is the joint's dominant swing —
 * whichever axis the bone's own rest frame happens to put it on. Picking it by variance rather
 * than naming an axis is what keeps this measurement rig-agnostic.
 */
function principalComponentSeries( components ) {

    let best = components[ 0 ];
    let bestVariance = -1;

    for ( const component of components ) {

        const value = variance( component );

        if ( value > bestVariance ) {

            bestVariance = value;
            best = component;

        }

    }

    return best.map( ( value ) => 2 * Math.asin( Math.min( Math.max( value, -1 ), 1 ) ) * 180 / Math.PI );

}

/**
 * The angle between what two runs did to the same bone on the same frame, in degrees. This is the
 * true magnitude of whatever one run has that the other does not, on whatever axis it lands on.
 */
function differenceDegreesAt( first, second, frame ) {

    const offset = frame * 4;

    let dot = 0;
    for ( let index = 0; index < 4; index ++ ) dot += first.deltas[ offset + index ] * second.deltas[ offset + index ];

    return 2 * Math.acos( Math.min( Math.abs( dot ), 1 ) ) * 180 / Math.PI;

}

function peakDifferenceDegrees( first, second ) {

    const frames = first.deltas.length / 4;
    let peak = 0;

    for ( let frame = 0; frame < frames; frame ++ ) {

        peak = Math.max( peak, differenceDegreesAt( first, second, frame ) );

    }

    return peak;

}

function findTrack( tracks, label ) {

    const found = tracks.find( ( track ) => track.label === label );

    if ( found === undefined ) throw new Error( `no measured bone labelled "${ label }"` );

    return found;

}

/** Mean RMS over every track whose label starts with the given prefix — i.e. both sides. */
function averageRms( tracks, prefix ) {

    const matching = tracks.filter( ( track ) => track.label.startsWith( prefix ) );

    return matching.reduce( ( total, track ) => total + track.rmsDegrees, 0 ) / matching.length;

}

// --- statistics -------------------------------------------------------------------------------

function rootMeanSquare( samples ) {

    let total = 0;
    for ( const sample of samples ) total += sample * sample;

    return Math.sqrt( total / samples.length );

}

function mean( samples ) {

    let total = 0;
    for ( const sample of samples ) total += sample;

    return total / samples.length;

}

function variance( samples ) {

    const average = mean( samples );
    let total = 0;

    for ( const sample of samples ) total += ( sample - average ) * ( sample - average );

    return total / samples.length;

}

function pearson( first, second ) {

    const firstMean = mean( first );
    const secondMean = mean( second );

    let covariance = 0;
    let firstSpread = 0;
    let secondSpread = 0;

    for ( let index = 0; index < first.length; index ++ ) {

        const a = first[ index ] - firstMean;
        const b = second[ index ] - secondMean;

        covariance += a * b;
        firstSpread += a * a;
        secondSpread += b * b;

    }

    const denominator = Math.sqrt( firstSpread * secondSpread );

    return denominator === 0 ? 0 : covariance / denominator;

}

/**
 * Welch-averaged power spectrum: Hann-windowed, 50% overlap, mean removed per segment. Returns
 * the dominant frequency, the frequency below which 95% of the power sits, and the share of
 * power in the 8–12 Hz physiological-tremor band.
 */
function welchSpectrum( samples, segmentLength, sampleRateHz ) {

    const half = segmentLength >> 1;
    const power = new Float64Array( half );
    const window = new Float64Array( segmentLength );

    for ( let index = 0; index < segmentLength; index ++ ) {

        window[ index ] = 0.5 - 0.5 * Math.cos( 2 * Math.PI * index / ( segmentLength - 1 ) );

    }

    let segments = 0;

    for ( let start = 0; start + segmentLength <= samples.length; start += segmentLength >> 1 ) {

        const segmentMean = mean( samples.slice( start, start + segmentLength ) );
        const windowed = new Float64Array( segmentLength );

        for ( let index = 0; index < segmentLength; index ++ ) {

            windowed[ index ] = ( samples[ start + index ] - segmentMean ) * window[ index ];

        }

        const segmentPower = fourierPower( windowed );

        for ( let bin = 0; bin < half; bin ++ ) power[ bin ] += segmentPower[ bin ];

        segments ++;

    }

    if ( segments === 0 ) throw new Error( 'series too short for one spectral segment' );

    const binHz = sampleRateHz / segmentLength;

    let total = 0;
    let tremor = 0;
    let modeBin = 1;

    // Bin 0 is the mean, which was removed; starting at 1 also keeps a residual DC leak out of
    // the mode.
    for ( let bin = 1; bin < half; bin ++ ) {

        total += power[ bin ];

        const frequency = bin * binHz;
        if ( frequency >= 8 && frequency <= 12 ) tremor += power[ bin ];

        if ( power[ bin ] > power[ modeBin ] ) modeBin = bin;

    }

    let cumulative = 0;
    let f50 = 0;
    let f95 = 0;

    for ( let bin = 1; bin < half; bin ++ ) {

        cumulative += power[ bin ];

        if ( f50 === 0 && cumulative >= 0.50 * total ) f50 = bin * binHz;

        if ( cumulative >= 0.95 * total ) {

            f95 = bin * binHz;
            break;

        }

    }

    return {
        mode: modeBin * binHz,
        f50,
        f95,
        tremorBandPercent: 100 * tremor / total
    };

}

/** Iterative radix-2 FFT, returning the power of the first half of the bins. */
function fourierPower( samples ) {

    const length = samples.length;
    const real = Float64Array.from( samples );
    const imaginary = new Float64Array( length );

    for ( let i = 1, j = 0; i < length; i ++ ) {

        let bit = length >> 1;

        for ( ; j & bit; bit >>= 1 ) j ^= bit;

        j ^= bit;

        if ( i < j ) {

            [ real[ i ], real[ j ] ] = [ real[ j ], real[ i ] ];
            [ imaginary[ i ], imaginary[ j ] ] = [ imaginary[ j ], imaginary[ i ] ];

        }

    }

    for ( let size = 2; size <= length; size <<= 1 ) {

        const angle = -2 * Math.PI / size;
        const stepReal = Math.cos( angle );
        const stepImaginary = Math.sin( angle );

        for ( let start = 0; start < length; start += size ) {

            let twiddleReal = 1;
            let twiddleImaginary = 0;

            for ( let offset = 0; offset < size / 2; offset ++ ) {

                const a = start + offset;
                const b = a + size / 2;

                const productReal = real[ b ] * twiddleReal - imaginary[ b ] * twiddleImaginary;
                const productImaginary = real[ b ] * twiddleImaginary + imaginary[ b ] * twiddleReal;

                real[ b ] = real[ a ] - productReal;
                imaginary[ b ] = imaginary[ a ] - productImaginary;
                real[ a ] += productReal;
                imaginary[ a ] += productImaginary;

                const nextReal = twiddleReal * stepReal - twiddleImaginary * stepImaginary;
                twiddleImaginary = twiddleReal * stepImaginary + twiddleImaginary * stepReal;
                twiddleReal = nextReal;

            }

        }

    }

    const power = new Float64Array( length >> 1 );

    for ( let bin = 0; bin < power.length; bin ++ ) {

        power[ bin ] = real[ bin ] * real[ bin ] + imaginary[ bin ] * imaginary[ bin ];

    }

    return power;

}

// --- reporting --------------------------------------------------------------------------------

function section( title ) {

    console.log( `\n${ title }\n${ '-'.repeat( title.length ) }` );

}

function gate( label, value, low, high, source ) {

    const passed = value >= low && value <= high;

    results.push( { label, passed } );

    const range = high - low < 1e-12 ? `= ${ low }` : `${ format( low ) } .. ${ format( high ) }`;

    console.log(
        `  ${ passed ? 'PASS' : 'FAIL' }  ${ label.padEnd( 32 ) } ${ format( value ).padStart( 10 ) }` +
        `   target ${ range.padEnd( 16 ) } ${ source }`
    );

}

function note( label, value, source ) {

    console.log( `  ....  ${ label.padEnd( 32 ) } ${ String( value ).padStart( 10 ) }   ${ source }` );

}

function format( value ) {

    if ( value === 0 ) return '0';
    if ( Math.abs( value ) < 1e-3 ) return value.toExponential( 1 );

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
