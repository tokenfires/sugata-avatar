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
 *   SWAY     🎯 TWO REGIMES, GATED SEPARATELY, BECAUSE THE LITERATURE MEASURED THEM SEPARATELY —
 *            and in CENTRE-OF-PRESSURE millimetres, which is the quantity every one of those
 *            papers put on a force plate.
 *
 *            QUIET STANDING. `layer.balanceDisplacement` alone, against Quijoux et al. 2021's
 *            60 s "stand as still as possible" force-plate column: 3.0 mm ML, 4.9 mm AP. The
 *            AP > ML anisotropy is gated here and ONLY here.
 *
 *            UNCONSTRAINED STANDING. `layer.displacement` — the balance band plus Duarte's
 *            fidget, shift and drift processes — against Bates et al. 2021's fifteen minutes
 *            with subjects free to move. Its anisotropy is REPORTED and deliberately not gated:
 *            it inverts, and inverting is the model being right.
 *
 *            Head excursion is REPORTED, with only a sanity envelope. What is gated instead is
 *            the LEVER that produces it, against the rig's own raw bone heights.
 *
 *            🎯 Measured on `new Sway()` AS CONSTRUCTED, over a seed × window matrix, on fields
 *            the DEFAULT layer publishes every frame. Both halves of that matter and both have
 *            been got wrong here before. It was once measured on
 *            `new Sway( { weightShiftsEnabled: false } )` — a configuration no consumer builds —
 *            and the default was outside its own gate on 18 of 24 cells; the separable signal is
 *            what lets the balance band be isolated without gating a fiction. And it was once
 *            measured as HEAD excursion against numbers that are centre of pressure, which
 *            under-stated the whole figure by the lever ratio, 1.65 on this rig. One seed is not
 *            a measurement either: the RMS of a 0.3 Hz stochastic signal over a 60 s window
 *            scatters by well over 10%, so every figure below is a matrix, not a number.
 *
 *   SHIFTS   event rates over a long run against Duarte & Zatsiorsky's intervals; the RELAY rate
 *            and relayed magnitude distribution, which is where a folded-gaussian amplitude draw
 *            shows up as a number; and the discourse-boundary shift probability against
 *            Cassell's 26% / 8%.
 *
 *   IDLE     hand and head excursion in millimetres — reported rather than gated, because the
 *            amplitudes are tuning constants with no primary support — and the fraction of power
 *            in the 8–12 Hz physiological-tremor band, which IS gated, because idle motion that
 *            reaches into that band reads as illness.
 *
 *   SYMMETRY 🎯 A RATIO, not a magnitude. Left-limb energy over right-limb energy at every arm
 *            joint and at the fingertip, over a seed matrix, with an explicit upper bound. This
 *            file was entirely green while a blind visual judge was reporting *"one arm is 2.5x
 *            livelier than the other, consistently — looks like a bug, not a choice"*, because
 *            everything in it measured ONE side and asked whether the number was in range.
 *            LEARNINGS §1.11: when a gate cannot catch a defect, the answer is an assertion of a
 *            different KIND, not a tighter threshold. A ratio is that different kind.
 *
 *            Note what is deliberately NOT gated here: phase. The arms are decorrelated
 *            left-to-right at |r| ≈ 0.05 and that is correct and hard-won — `BodyIdle.selftest`
 *            owns that gate. Decorrelated phase with matched energy is the target. A persistent
 *            energy ratio is the defect.
 *
 *   HANDS    fingertip travel in the HAND's own frame, in millimetres AND in pixels at full-body
 *            framing, because the second is the quantity the defect was about. The same judge
 *            wrote *"THE HANDS NEVER MOVE"*, and it was right: the shipped finger idle moves an
 *            index fingertip 0.73 mm — **0.48 px** — over seven minutes, against the 1.6 px this
 *            project already has on record (docs/PROGRESS.md) as producing indistinguishable
 *            before-and-after plates. A degree at a knuckle is not a quantity anyone can picture;
 *            a pixel at the framing we capture at is.
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

const { Box3, Matrix4, Quaternion, Vector3 } = await import( 'three' );
const { Figure } = await import( '../figure/Figure.js' );
const { BodyMass } = await import( '../figure/BodyMass.js' );
const { HUMANOID_TO_FIGURE_BONE, Skeleton } = await import( '../figure/Skeleton.js' );
const { RestPose } = await import( '../figure/RestPose.js' );
const { MotionStack, createMotionTarget, MOTION_ORDER } = await import( './MotionStack.js' );
const { MotionRandom, CoherentNoise1D } = await import( './Signals.js' );
const { Layer } = await import( './Layer.js' );
const { Breath, restRotationRelativeToRig, toBoneDeltaFrame } = await import( './Breath.js' );
const { Sway } = await import( './Sway.js' );
const { IdleMotion } = await import( './IdleMotion.js' );
const { BodyIdle } = await import( './BodyIdle.js' );
const { HandIdle } = await import( './HandIdle.js' );

const SAMPLE_RATE_HZ = 60;
const FRAME_SECONDS = 1 / SAMPLE_RATE_HZ;
const GATE_DURATION_SECONDS = 60;      // what the brief asks for
const SPECTRUM_DURATION_SECONDS = 300; // a tighter estimate of the same signal
const EVENT_DURATION_SECONDS = 7200;   // two hours, for rates measured in events per minute

const SEED = 20260807;

/**
 * The median of a lognormal whose MEAN is 1 and whose coefficient of variation is Duarte's own
 * 38/22. Every relayed magnitude is a draw from that distribution scaled by its pattern's
 * amplitude fraction, so this is the one number both the fidget and the shift expectation are
 * built from. exp(-½·ln(1+CV²)) = 0.5010.
 */
const DUARTE_SHIFT_MEDIO_LATERAL_MM = 22;
const DUARTE_SHIFT_MEDIO_LATERAL_SD_MM = 38;
const LOGNORMAL_MEDIAN_OF_UNIT_MEAN_SHIFT = Math.exp( -0.5 * Math.log(
    1 + ( DUARTE_SHIFT_MEDIO_LATERAL_SD_MM / DUARTE_SHIFT_MEDIO_LATERAL_MM ) ** 2 ) );

/**
 * The seed × window matrix the sway gates run over. Twelve seeds because the sway statistics are
 * estimates with real sampling error and one draw of any of them proves nothing; three windows
 * because the two regimes this file gates are separated by the OBSERVATION WINDOW as much as by
 * anything else — the weight-shift process has 200–500 s intervals, so a 60 s window structurally
 * cannot contain it and a 900 s window is dominated by it.
 */
const SWAY_SEEDS = [ 1, 7, 42, 101, 777, 1234, 4242, 9999, 31337, 65537, 20260807, 99999989 ];
const SWAY_WINDOWS_SECONDS = [ 60, 300, 900 ];

/**
 * 🎯 THE QUIET-STANDING GATE. Quijoux et al. 2021, force-plate column, VERBATIM, in
 * CENTRE-OF-PRESSURE millimetres — the frame that paper measured in and the frame `Sway.js` now
 * authors in.
 *
 * ⚠️ These are NOT the 3–5 / 5–7 mm bands the research doc quotes and this file used to gate on.
 * Those bands span the 25 s Wii-board column as well as the 60 s force-plate one and the two
 * disagree by nearly 2×; the doc's own advice is to prefer the plate. Authoring at 3.0 / 4.9 and
 * gating at 3.0 / 4.9 is the only pairing that does not quietly re-tune the layer through the
 * gate — and note that the plate's AP figure, 4.9, sits BELOW the 5–7 mm band, so the old gate
 * would have rejected the correct answer.
 *
 * The tolerances are the ESTIMATOR's scatter, not slack for the design:
 *
 *   MEDIAN, ±7%. The median across twelve seeds of an RMS estimate whose seed-to-seed spread is
 *   ~±10% at the shortest window has a standard error near 2%, so this is a ~3σ band. It also has
 *   to absorb one real and explicable bias: an RMS taken about the window's own mean removes
 *   power at periods approaching the window length, and the antero-posterior band's lower lattice
 *   rate makes it the axis that loses most — which is why the 60 s AP median sits a few percent
 *   under the 300 s and 900 s ones rather than scattering about them.
 *
 *   EXTREMES, ±15%. The RMS of a 0.3 Hz signal over a 60 s window holds ~18 cycles and scatters
 *   by roughly 1/sqrt(2n) ≈ 12%; the worst of twelve draws is wider still. By 900 s the observed
 *   spread has narrowed to ±3%, so this band alone WOULD go decorative at the long window. That
 *   is exactly why the median is gated too, at every window, and tightly.
 *
 * Both are far tighter than the 1.65× frame error they exist to catch — see
 * `gateBalanceBandRejectsHeadFramedAmplitudes`, which builds the pre-fix layer and proves it.
 */
const BALANCE_TARGET_MILLIMETRES = { medioLateral: 3.0, anteroPosterior: 4.9 };
const BALANCE_MEDIAN_TOLERANCE = 0.07;
const BALANCE_EXTREME_TOLERANCE = 0.15;

/**
 * 🎯 THE UNCONSTRAINED-STANDING GATE. Bates, McGregor & Alexander 2021, *BMC Musculoskelet
 * Disord* 22:1005, normal-flexibility controls (N = 22), fifteen minutes, subjects explicitly
 * told they could change position as they wished. Standard deviation of centre of pressure.
 *
 * 🚩 Gated against the INTERQUARTILE RANGE rather than against the median. The medians are 16.87
 * ML and 16.32 AP, but the quartiles are 9.58–66.5 and 10.34–28.75: some controls barely moved
 * laterally and some ranged over centimetres. A gate on the median would be asserting a precision
 * the paper does not have.
 *
 * The window is fixed at fifteen minutes because that is the protocol. Comparing a 60 s trace to
 * this would be the same category error the file was just fixed for, in the other direction.
 */
const BATES_COMPOSITE_INTERQUARTILE_MILLIMETRES = {
    medioLateral: { low: 9.58, high: 66.5, median: 16.87 },
    anteroPosterior: { low: 10.34, high: 28.75, median: 16.32 }
};

const BATES_WINDOW_SECONDS = 900;

/**
 * The envelope the head's own excursion is held to, in millimetres.
 *
 * 🚩 NOT a literature band. No published absolute head-sway amplitude in millimetres for healthy
 * adult quiet stance was found — see `reportHeadExcursion`. These two numbers are judgements
 * about a rendered avatar and nothing more: below ~2 mm over a quarter of an hour the head is
 * sub-pixel at full-body framing and the figure reads as frozen, which is the class of defect
 * that started this rework; above ~80 mm it is a stagger rather than standing.
 */
const HEAD_SANITY_ENVELOPE_MILLIMETRES = { low: 2, high: 80 };

/**
 * How far the measured head-per-centre-of-mass lever may sit from the rig's raw geometry.
 *
 * An exact identity is not expected and the gate would be wrong to demand one: the pendulum is
 * only 85% rigid about the ankles, the spine takes a share of the lean and the neck gives 30% of
 * it back, so the head travels slightly differently from a rigid rod. 5% is loose enough for all
 * three of those and two orders tighter than the error it exists to catch.
 */
const LEVER_TOLERANCE = 0.05;

/**
 * Everything below 0.15 Hz is excluded from the spectral statistics. That is not a convenience:
 * the literature figures come from 25–60 s quiet-standing recordings, which cannot resolve a
 * weight-shift process whose intervals are 200–500 s, so the postural band the papers describe
 * excludes it by construction. Duarte measures that process separately, and so does this file.
 */
const POSTURAL_BAND_FLOOR_HZ = 0.15;

/**
 * 🎯 THE LIMB SYMMETRY BOUND. How far apart the two arms' energies may be, as a ratio, stated so
 * that whichever side is larger goes on top.
 *
 * The defect this exists to catch is a blind judge's, verbatim: *"one arm is 2.5x livelier than
 * the other, consistently, over the whole clip — looks like a bug, not a choice."* Every gate in
 * this file was green at the time, because every one of them measured a single side's magnitude
 * against a range. No magnitude gate can catch a ratio; that is LEARNINGS §1.11, and the answer is
 * an assertion of a different kind rather than a tighter threshold.
 *
 * The number is set from the measured scatter, not from the defect. Over 12 seeds × 6 channels ×
 * 2 windows on the consumer stack, the worst symmetric ratio observed is **1.171** (300 s) and
 * **1.125** (900 s) — the arms are already balanced and the residual is the estimator, driven by
 * the Poisson event streams that fire per side. 1.40 sits 2.4× further from parity than the worst
 * of those, and 1.8× below the 2.5 it must reject. Both margins are stated because a bound with
 * only one of them is either decorative or flaky.
 */
const LIMB_ENERGY_RATIO_LIMIT = 1.40;

/**
 * The seeds and window the symmetry and articulation gates run over. One draw of a stochastic
 * process proves nothing about a ratio either — §1.4 and the sway matrix above make the same
 * point — but these two gates are about a persistent bias rather than about an amplitude
 * estimate, so a shorter window over the same seeds is enough and keeps the file's runtime sane.
 */
const LIMB_SEEDS = [ 1, 42, 777, 4242, 31337, 20260807 ];
const LIMB_WINDOW_SECONDS = 300;

/**
 * The framing every full-body capture in this project is taken at, which is what converts a
 * millimetre of fingertip travel into the quantity the defect was actually about.
 *
 * 1200 px comes from the capture command in docs/LEARNINGS.md Part 3 (`--width 700 --height 1200`);
 * the 1.10 margin is `BODY_FRAME_MARGIN` in `packages/testbed/src/alive.js`, which frames the
 * figure's own MEASURED height plus that margin. Stature is measured off this GLB rather than
 * assumed, because the five bakes differ by centimetres.
 */
const FULL_BODY_CAPTURE_PIXELS = 1200;
const BODY_FRAME_MARGIN = 1.10;

/**
 * 🎯 THE HAND ARTICULATION FLOOR, in pixels of fingertip travel at full-body framing over
 * LIMB_WINDOW_SECONDS.
 *
 * Stated in pixels on purpose. The shipped finger idle was authored as 0.45° of peak deviation at
 * a knuckle, which sounds reasonable and is not a quantity anybody can picture; converted, it is
 * 0.73 mm of fingertip travel — **0.48 px** — over seven minutes, and a blind judge reported the
 * hands as motionless. docs/PROGRESS.md already records the verdict on this order of magnitude:
 * a weight shift worth "1.6 pixels at full-body framing" gave before-and-after plates that were
 * *indistinguishable*.
 *
 * 3.0 px is a little under twice that known-invisible figure and six times the shipped 0.48, so
 * the gate rejects the shipped layer by a factor of six rather than by a whisker. It is a
 * judgement about a rendered avatar and nothing more — there is no published resting-finger
 * excursion in docs/research/ and none is invented here.
 *
 * ⚠️ Measured in the HAND's OWN FRAME. A fingertip's world position is dominated by the arm and
 * the whole-body sway carrying it around; in the hand's frame what is left is articulation, which
 * is the only thing this gate is about.
 */
const FINGERTIP_TRAVEL_FLOOR_PIXELS = 3.0;

/**
 * How much of its resting curl a finger's total flexion must range over, and may not exceed.
 *
 * The floor is the same statement as the pixel floor in the units the layer authors in, kept
 * because the two fail differently: a rig with short fingers could clear the angle and miss the
 * pixels. The ceiling is the over-animation guard — past about half its resting curl a hand is
 * opening and closing rather than idling, and over-animating an idle reads as a nervous condition.
 */
const FINGER_FLEXION_RANGE_FRACTION = { low: 0.10, high: 0.50 };

/**
 * The rest pose the symmetry and articulation gates measure in, and why they do not use the bind
 * pose everything above them uses.
 *
 * `alive.js` sets `DEFAULT_REST_POSE = 'relaxed-standing'`, so that is the configuration a
 * consumer renders and the one the judge watched. It matters here more than anywhere else in this
 * file: `HandIdle`'s amplitude is a fraction of how flexed each joint RESTS, and the raw bind pose
 * leaves the fingers half straight — measured 27.1° of index flexion against 55.9° posed. Gating
 * the bind pose would be measuring a configuration no consumer builds at half the shipped
 * amplitude, which is the mistake LEARNINGS §1.5 records against `new Sway({weightShiftsEnabled: false})`.
 */
const CONSUMER_REST_POSE = 'relaxed-standing';

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

const swayMatrix = traceSwayMatrix();

gateBalanceBand( swayMatrix );
gateCompositeAgainstBates( swayMatrix );
reportHeadExcursion( swayMatrix );
gateHeadPerCentreOfMassLever();
gateBalanceBandRejectsHeadFramedAmplitudes();

measureSwaySpectrum();
measureWeightShifts();
measureDiscourseCoupling();

// --- 2.7 idle micro-motion --------------------------------------------------------------------

measureIdleMotion();
measureArmOwnership();

// --- 2.7 the two defects a magnitude gate could not see ----------------------------------------

gateLimbSymmetry();
gateLimbSymmetryRejectsAOneSidedArm();

gateFingerOwnership();
gateHandArticulation();
gateHandArticulationRejectsTheShippedFingers();
gateHandIdleFrameRateInvariance();

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
 * Runs the whole seed × window matrix once and prints it, in the three frames the rest of section
 * 2.6 gates: the balance band alone, the composite, and the head.
 *
 * 🎯 The three columns are the point. They are the SAME run, and they disagree, and the
 * disagreement is the physics rather than an inconsistency. Balance stays flat across the windows
 * because it is a stationary 0.3 Hz process. Composite grows with the window because Duarte's
 * shift process has 200–500 s intervals and a short window structurally cannot contain it. Head
 * is both, multiplied by this rig's lever. Reading one column and calling it "sway" is how this
 * file came to gate centre-of-pressure numbers against a head marker.
 *
 * The matrix is printed whether it passes or not, because the shape of a failure is the
 * diagnosis: a balance ML column that grows with the window is the weight-shift process leaking
 * into a signal that is supposed to be separable from it.
 */
function traceSwayMatrix() {

    section( '2.6  POSTURAL SWAY — the seed × window matrix, all three frames' );

    const rows = [];
    const byWindow = new Map();

    for ( const seconds of SWAY_WINDOWS_SECONDS ) {

        const window = {
            balance: { medioLateral: [], anteroPosterior: [], ratio: [] },
            composite: { medioLateral: [], anteroPosterior: [], ratio: [] },
            head: { medioLateral: [], anteroPosterior: [] }
        };

        byWindow.set( seconds, window );

        for ( const seed of SWAY_SEEDS ) {

            const track = traceSway( seed, seconds );

            const cell = {};

            for ( const frame of [ 'balance', 'composite', 'head' ] ) {

                cell[ frame ] = {
                    medioLateral: rootMeanSquare( track[ frame ].medioLateral ) * 1000,
                    anteroPosterior: rootMeanSquare( track[ frame ].anteroPosterior ) * 1000
                };

                window[ frame ].medioLateral.push( cell[ frame ].medioLateral );
                window[ frame ].anteroPosterior.push( cell[ frame ].anteroPosterior );

            }

            for ( const frame of [ 'balance', 'composite' ] ) {

                cell[ frame ].ratio = cell[ frame ].anteroPosterior / cell[ frame ].medioLateral;
                window[ frame ].ratio.push( cell[ frame ].ratio );

            }

            // Only the balance columns carry a per-cell verdict. The composite is gated at one
            // window against an interquartile range, and the head is not gated at all.
            const inBand = withinTolerance( cell.balance.medioLateral, 'medioLateral', BALANCE_EXTREME_TOLERANCE )
                && withinTolerance( cell.balance.anteroPosterior, 'anteroPosterior', BALANCE_EXTREME_TOLERANCE );

            rows.push( `  ${ String( seconds ).padStart( 5 ) }s ${ String( seed ).padStart( 10 ) }  ` +
                `${ column( cell.balance ) } |${ column( cell.composite ) } |` +
                `${ cell.head.medioLateral.toFixed( 2 ).padStart( 7 ) }` +
                `${ cell.head.anteroPosterior.toFixed( 2 ).padStart( 7 ) }   ` +
                `${ inBand ? 'ok' : 'BALANCE OUT OF BAND' }` );

        }

    }

    console.log( '                        balance band COP  |    composite COP    |   head (output)' );
    console.log( '  window       seed      ML     AP  ratio |    ML     AP  ratio |    ML     AP' );
    for ( const row of rows ) console.log( row );
    console.log( '' );

    return byWindow;

    function column( cell ) {

        return `${ cell.medioLateral.toFixed( 2 ).padStart( 6 ) }` +
            `${ cell.anteroPosterior.toFixed( 2 ).padStart( 7 ) }` +
            `${ cell.ratio.toFixed( 2 ).padStart( 7 ) }`;

    }

}

/**
 * REGIME 1 — quiet standing, against Quijoux's force-plate column.
 *
 * 🎯 Measured on `layer.balanceDisplacement`, which is a field the DEFAULT layer publishes on
 * every frame, not a field that only exists when the gate asks for it. That distinction is the
 * whole reason this can be a real gate: the balance band has to be isolated from the weight
 * shifts to be compared with a paper that excluded them by construction, and the choice is
 * between isolating the SIGNAL and isolating the CONFIGURATION. This file used to do the second,
 * with `new Sway( { weightShiftsEnabled: false } )`, and a gate that only fires against a
 * configuration nobody ships is not a gate — the shipped default was outside it on 18 of 24
 * cells while the gate stayed green.
 *
 * 🎯 THE ANISOTROPY IS GATED HERE AND NOWHERE ELSE. AP is 1.5–2× ML in quiet stance and an
 * isotropic wobble reads as floating. It is emphatically NOT a property of the composite; see
 * `gateCompositeAgainstBates`.
 */
function gateBalanceBand( byWindow ) {

    section( '2.6  POSTURAL SWAY — regime 1, quiet standing (Quijoux et al. 2021, force plate)' );

    for ( const seconds of SWAY_WINDOWS_SECONDS ) {

        const balance = byWindow.get( seconds ).balance;
        const label = `${ seconds }s`;

        for ( const [ axis, name ] of [ [ 'medioLateral', 'ML' ], [ 'anteroPosterior', 'AP' ] ] ) {

            const target = BALANCE_TARGET_MILLIMETRES[ axis ];
            const medianBand = toleranceBand( axis, BALANCE_MEDIAN_TOLERANCE );
            const extremeBand = toleranceBand( axis, BALANCE_EXTREME_TOLERANCE );

            gate( `[${ label }] balance ${ name } median (mm)`, median( balance[ axis ] ), medianBand.low, medianBand.high,
                `plate ${ name } ${ target } mm COP RMS, verbatim; +-7% is the median's own scatter` );
            gate( `[${ label }] balance ${ name } lowest (mm)`, Math.min( ...balance[ axis ] ), extremeBand.low, extremeBand.high,
                `+-15% is the RMS estimator's scatter at 60 s, not slack` );
            gate( `[${ label }] balance ${ name } highest (mm)`, Math.max( ...balance[ axis ] ), extremeBand.low, extremeBand.high, '' );

        }

        // The extremes band is the research's 1.5-2.0 anisotropy carried through the sampling
        // error of an RMS estimate on a 0.3 Hz signal: a 60 s window holds ~18 cycles, so each
        // axis' RMS scatters by roughly 1/sqrt(2n) ~ 12% and the ratio of two estimates by ~17%.
        gate( `[${ label }] balance AP/ML lowest`, Math.min( ...balance.ratio ), 1.25, 2.20,
            'AP is 1.5-2x ML in quiet stance and must never be isotropic' );
        gate( `[${ label }] balance AP/ML highest`, Math.max( ...balance.ratio ), 1.25, 2.20, '' );

        // The design ratio is 4.9/3.0 = 1.633, which falls out of authoring both axes at the
        // plate column rather than being derived from the ratio. Gated on the median against the
        // research band itself, undilated.
        gate( `[${ label }] balance AP/ML median`, median( balance.ratio ), 1.5, 2.0,
            'design 4.9/3.0 = 1.633; the median must sit inside the measured band' );

    }

    // Honest note on what the matrix can and cannot prove, because a future maintainer who widens
    // the seed set will meet this and should know it is arithmetic rather than a regression.
    const shortest = byWindow.get( SWAY_WINDOWS_SECONDS[ 0 ] ).balance.anteroPosterior;
    note( `balance AP spread at ${ SWAY_WINDOWS_SECONDS[ 0 ] }s`,
        `x${ ( Math.max( ...shortest ) / Math.min( ...shortest ) ).toFixed( 2 ) }`,
        'the +-15% extremes band spans x1.35, so a 60 s cell can fall out on sampling error ' +
        'alone. The 300 s and 900 s rows are the load-bearing ones.' );

}

/**
 * REGIME 2 — unconstrained standing, against Bates et al. 2021.
 *
 * 🎯 A DIFFERENT PAPER, A DIFFERENT PROTOCOL, AND THEREFORE A DIFFERENT GATE. Quijoux's subjects
 * were told to stand as still as possible for 60 s; Duarte's medio-lateral weight shift has a
 * 199 s interval, so it is absent from that data by construction. Gating a trace that contains
 * both processes against the quiet-standing RMS is a category error, and the last time it was
 * done here it was "fixed" by scaling the shift process down 8x until it fitted.
 *
 * 🎯 THE ANISOTROPY IS NOT GATED HERE, AND THE INVERSION IS THE MODEL BEING RIGHT. Bates measures
 * 16.87 mm ML against 16.32 mm AP — a ratio of 1.03, where quiet stance is 1.5–2.0 — because
 * Duarte's lateral shift process is larger and more frequent than his fore-and-aft one, and
 * fifteen minutes is long enough to contain it. The ratio column below crosses 1.0 as the window
 * grows and that is the signature of a correct model, not a regression.
 */
function gateCompositeAgainstBates( byWindow ) {

    section( '2.6  POSTURAL SWAY — regime 2, unconstrained standing (Bates et al. 2021, 15 min)' );

    const composite = byWindow.get( BATES_WINDOW_SECONDS ).composite;

    for ( const [ axis, name ] of [ [ 'medioLateral', 'ML' ], [ 'anteroPosterior', 'AP' ] ] ) {

        const bates = BATES_COMPOSITE_INTERQUARTILE_MILLIMETRES[ axis ];
        const measured = median( composite[ axis ] );

        // 🚩 The lateral axis is gated against Bates' interquartile range. The fore-and-aft one is
        // NOT, and the reason is a conflict between two papers rather than a gap in the model:
        // measured, the balance band carries 4.87 mm of the 8.27 mm composite, so Duarte's
        // fore-and-aft processes carry 6.7 mm where reaching Bates would need 15.6 mm. That is
        // 2.3x his 17 mm shift amplitude or five times his 316 s rate — both contradict the paper
        // this layer implements event by event. See Sway.js DRIFT_AMPLITUDE_ANTERO_POSTERIOR_METRES
        // for the two calibration attempts and why each was abandoned.
        //
        // So it is asserted as a KNOWN STATE, the same shape `bodymass.selftest.mjs` uses for a
        // check that provably cannot catch something: the day the shortfall closes, this gate goes
        // RED and forces the comment above to be rewritten rather than quietly going stale.
        if ( axis === 'anteroPosterior' ) {

            note( `composite ${ name } SD median (mm)`, measured.toFixed( 3 ),
                `Bates ${ bates.median }, IQR ${ bates.low }-${ bates.high } — a documented shortfall, not a pass` );

            gate( 'composite AP median is BELOW Bates Q1', measured < bates.low ? 1 : 0, 1, 1,
                'recorded, not tolerated: 1 means the known conflict is still there and the note is current' );

        } else {

            gate( `composite ${ name } SD median (mm)`, measured, bates.low, bates.high,
                `N=22 controls, median ${ bates.median }, IQR ${ bates.low }-${ bates.high }` );

        }

        note( `composite ${ name } SD range (mm)`,
            `${ Math.min( ...composite[ axis ] ).toFixed( 2 ) }-${ Math.max( ...composite[ axis ] ).toFixed( 2 ) }`,
            'across seeds; the quartiles above are Bates\' spread across SUBJECTS, not an error bar' );

    }

    // Reported, never gated. See the header of this function for why a ratio below 1 here is the
    // model agreeing with Bates rather than failing Quijoux.
    note( 'composite AP/ML median', median( composite.ratio ).toFixed( 3 ),
        'Bates 1.03 — the anisotropy INVERTS over a long unconstrained window. Not a gate.' );
    note( 'composite AP/ML range',
        `${ Math.min( ...composite.ratio ).toFixed( 2 ) }-${ Math.max( ...composite.ratio ).toFixed( 2 ) }`,
        'crosses 1.0, as it must: Duarte\'s lateral shift is the larger of the two processes' );

    for ( const seconds of SWAY_WINDOWS_SECONDS ) {

        if ( seconds === BATES_WINDOW_SECONDS ) continue;

        note( `composite AP/ML median at ${ seconds }s`,
            median( byWindow.get( seconds ).composite.ratio ).toFixed( 3 ),
            'ungated: the shorter the window, the less of the shift process it can contain' );

    }

}

/**
 * The head, REPORTED — because there is nothing to report it against.
 *
 * 🚩 NO PUBLISHED ABSOLUTE HEAD-SWAY AMPLITUDE IN MILLIMETRES FOR HEALTHY ADULT QUIET STANCE WAS
 * FOUND. Not in `docs/research/body-motion-numbers.md`, and not by looking. Every amplitude in
 * the posturography literature this project rests on was taken at the floor with a force plate;
 * nothing above the ankles was measured. So the numbers below have NO direct empirical check, and
 * the envelope they are held to is a judgement about a rendered avatar rather than a citation —
 * see HEAD_SANITY_ENVELOPE_MILLIMETRES.
 *
 * What CAN be checked is the lever that turns a gated centre-of-pressure amplitude into these
 * numbers, and that is checked, on the rig's own bone heights, in
 * `gateHeadPerCentreOfMassLever`. That is the honest division: the input is gated against a
 * paper, the transfer function is gated against the geometry, and the product is printed.
 */
function reportHeadExcursion( byWindow ) {

    section( '2.6  POSTURAL SWAY — head excursion, an OUTPUT with no published counterpart' );

    for ( const seconds of SWAY_WINDOWS_SECONDS ) {

        const head = byWindow.get( seconds ).head;

        note( `[${ seconds }s] head ML / AP RMS (mm)`,
            `${ median( head.medioLateral ).toFixed( 2 ) } / ${ median( head.anteroPosterior ).toFixed( 2 ) }`,
            'medians across seeds; reported, not gated against any published figure' );

    }

    const seconds = SWAY_WINDOWS_SECONDS[ SWAY_WINDOWS_SECONDS.length - 1 ];
    const longest = byWindow.get( seconds ).head;
    const envelope = HEAD_SANITY_ENVELOPE_MILLIMETRES;

    const cells = [ ...longest.medioLateral, ...longest.anteroPosterior ];

    gate( `[${ seconds }s] head RMS smallest (mm)`, Math.min( ...cells ), envelope.low, envelope.high,
        'sanity envelope ONLY, no citation — below this the head is sub-pixel at full-body framing' );
    gate( `[${ seconds }s] head RMS largest (mm)`, Math.max( ...cells ), envelope.low, envelope.high,
        'sanity envelope ONLY, no citation — above this it is a stagger rather than standing' );

}

/**
 * 🎯 The one number in the head's chain that CAN be checked, checked against the rig itself.
 *
 * `layer.headPerCentreOfMass` replaced a hand-set constant — POSTURE_HEAD_TRANSFER = 0.20, "the
 * fraction of a weight shift that reaches the head" — which had no support in the record and was
 * out by a factor of 8 in the wrong direction. The replacement is measured by leaning the rig, so
 * it cannot be wrong in the way the constant was; it can, however, drift silently if the sway
 * chain, the mass table or the pivot changes. This is the gate that stops that.
 *
 * The check is deliberately of a DIFFERENT KIND from the measurement it checks (§1.11): the layer
 * gets its number by leaning the rig and reading two world positions, and this gets its number
 * from static bone heights and Winter's mass table, with no lean anywhere in it. For a rigid
 * inverted pendulum the ratio of horizontal travel is exactly the ratio of heights above the
 * pivot, so the two must agree.
 *
 * The pivot is bracketed rather than assumed. Sway pivots half way between the sole and the ankle
 * joint; lowering a pivot moves the ratio monotonically toward 1, so the true value has to lie
 * between the ratio taken at the sole and the ratio taken at the ankle. Both are printed, and the
 * gate is the bracket with LEVER_TOLERANCE around it.
 *
 * ⚠️ THIS FILE MEASURES THE LEVER IN THE GLB'S BIND POSE, NOT IN `relaxed-standing`. `buildStack`
 * puts a bare Sway on the raw rig, and the bind pose holds the arms 41.8° out, which moves the
 * centre of mass. The lever reads 1.636 here against 1.653 measured on the same figure in
 * `relaxed-standing` — a 1% difference, well inside the tolerance, and it is recorded because the
 * two numbers WILL be compared by someone and the difference is a pose rather than a regression.
 * A stack that also carried a posture layer would report the second figure.
 */
function gateHeadPerCentreOfMassLever() {

    section( '2.6  POSTURAL SWAY — the head/centre-of-mass lever, against raw rig geometry' );

    const { stack, layer, root } = buildStack( ( options ) => new Sway( options ) );

    // Read before a single frame runs, so the rig is in the same pose the layer probed at bind.
    const measured = layer.headPerCentreOfMass;
    const centreOfMassLever = layer.centreOfMassLever;
    const headLever = layer.headLever;

    stack.dispose();

    // Independently: bone heights and Winter's mass table, with no lean involved anywhere.
    restoreRestPose();

    const bodyMass = new BodyMass( {} );
    bodyMass.bind( createMotionTarget( root ) );
    root.updateMatrixWorld( true );

    const centreOfMassHeight = bodyMass.centreOfMass( new Vector3() ).y;
    const headHeight = worldHeightOfBone( root, HUMANOID_TO_FIGURE_BONE.head );

    const feet = [ HUMANOID_TO_FIGURE_BONE.leftFoot, HUMANOID_TO_FIGURE_BONE.rightFoot ]
        .map( ( name ) => root.getObjectByName( name ) );

    const ankleHeight = feet.reduce( ( total, foot ) => total + foot.matrixWorld.elements[ 13 ], 0 ) / feet.length;
    const soleHeight = Math.min( ...feet.map( toeHeightOf ) );

    const ratioAt = ( pivotHeight ) => ( headHeight - pivotHeight ) / ( centreOfMassHeight - pivotHeight );

    const atSole = ratioAt( soleHeight );
    const atAnkle = ratioAt( ankleHeight );

    note( 'centre-of-mass lever ML / AP (m)',
        `${ centreOfMassLever.medioLateral.toFixed( 4 ) } / ${ centreOfMassLever.anteroPosterior.toFixed( 4 ) }`,
        'travel per radian of lean, measured by leaning this rig' );
    note( 'head lever ML / AP (m)',
        `${ headLever.medioLateral.toFixed( 4 ) } / ${ headLever.anteroPosterior.toFixed( 4 ) }`, '' );
    note( 'rigid ratio, sole .. ankle pivot',
        `${ atSole.toFixed( 4 ) } .. ${ atAnkle.toFixed( 4 ) }`,
        `head ${ headHeight.toFixed( 3 ) } m, COM ${ centreOfMassHeight.toFixed( 3 ) } m, ` +
        `sole ${ soleHeight.toFixed( 3 ) } m, ankle ${ ankleHeight.toFixed( 3 ) } m` );

    gate( 'head per unit centre of mass', measured, atSole * ( 1 - LEVER_TOLERANCE ), atAnkle * ( 1 + LEVER_TOLERANCE ),
        'the rigid-pendulum height ratio; this replaced a hand-set 0.20 and must not drift back' );

    /** The sole under one foot, taken from the toe joint — the same probe Sway.js uses. */
    function toeHeightOf( foot ) {

        const toe = foot.children.find( ( child ) => child.isBone === true ) ?? foot;

        toe.updateWorldMatrix( true, false );

        return toe.matrixWorld.elements[ 13 ];

    }

}

/**
 * 🎯 §1.1 — THE GATE ABOVE, RUN AGAINST KNOWN-BAD INPUT, TO PROVE IT IS NOT DECORATIVE.
 *
 * The defect this file was rewritten for is a frame-of-reference error: the layer took published
 * CENTRE-OF-PRESSURE amplitudes and realised them as HEAD excursion, which under-moves the whole
 * figure by the lever ratio — 1.65 on this rig. Reconstructing it is exactly one division. The
 * pre-fix layer is `new Sway()` with the balance amplitudes divided by the lever, so that the
 * head lands on 3.0 / 4.9 mm and the centre of pressure lands 1.65x short.
 *
 * The gate must reject it, on BOTH axes, using the SAME band constants the real gate uses — not
 * a copy of them, which is why the tolerance arithmetic lives in `toleranceBand`. If this ever
 * prints PASS with a zero rejection count, the balance gate is measuring nothing and the right
 * response is to say so, not to tighten it after the fact.
 */
function gateBalanceBandRejectsHeadFramedAmplitudes() {

    section( '2.6  POSTURAL SWAY — known-bad input: the pre-fix, head-framed amplitudes' );

    // The lever measured on this figure in `relaxed-standing`. Written as a literal rather than
    // read from the layer because it is a statement about the DEFECT — this is the number the
    // pre-fix file was short by — and because a known-bad input that derived itself from the code
    // under test could be made to pass by breaking that code. The gate is not sensitive to the 1%
    // between this and the bind-pose reading; see gateHeadPerCentreOfMassLever.
    const lever = 1.6528;

    const preFix = {
        balanceRmsMedioLateralMetres: BALANCE_TARGET_MILLIMETRES.medioLateral / 1000 / lever,
        balanceRmsAnteroPosteriorMetres: BALANCE_TARGET_MILLIMETRES.anteroPosterior / 1000 / lever
    };

    const seconds = 300;
    const measured = { medioLateral: [], anteroPosterior: [] };

    for ( const seed of SWAY_SEEDS ) {

        const track = traceSway( seed, seconds, preFix );

        measured.medioLateral.push( rootMeanSquare( track.balance.medioLateral ) * 1000 );
        measured.anteroPosterior.push( rootMeanSquare( track.balance.anteroPosterior ) * 1000 );

    }

    let rejected = 0;

    for ( const [ axis, name ] of [ [ 'medioLateral', 'ML' ], [ 'anteroPosterior', 'AP' ] ] ) {

        const value = median( measured[ axis ] );

        if ( withinTolerance( value, axis, BALANCE_MEDIAN_TOLERANCE ) === false ) rejected ++;

        note( `pre-fix balance ${ name } median (mm)`, value.toFixed( 3 ),
            `head lands on ${ BALANCE_TARGET_MILLIMETRES[ axis ] }; the centre of pressure lands ${ lever }x short` );

    }

    gate( 'known-bad axes rejected (of 2)', rejected, 2, 2,
        'the balance gate must FAIL the defect it was written for, or it is decorative' );

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
 *
 * 🎯 THIS IS THE ONE SWAY STATISTIC THE FRAME OF REFERENCE DOES NOT TOUCH, and it is measured on
 * the HEAD deliberately. Everything above had to be re-framed from head excursion into centre of
 * pressure because an amplitude carries units and a lever converts them. A frequency does not:
 * the pendulum is a linear, memoryless multiplication by that lever, so head and centre of
 * pressure have identical spectra to within the arithmetic. Measuring at the head therefore costs
 * nothing and buys something — it is the END-TO-END signal, so a pendulum that filtered the band
 * on its way up the body would show here and would not show in `balanceDisplacement`.
 */
function measureSwaySpectrum() {

    section( '2.6  POSTURAL SWAY — spectrum at the head, median over seeds' );

    const segment = 2048;
    const medioLateral = [];
    const anteroPosterior = [];

    for ( const seed of SWAY_SEEDS ) {

        const track = traceSway( seed, SPECTRUM_DURATION_SECONDS ).head;

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

/**
 * One run of the layer, sampled every frame in all three frames of reference, in metres.
 *
 * `balance` and `composite` are read straight off the layer — `balanceDisplacement` and
 * `displacement` are centre-of-pressure fields the DEFAULT layer publishes on every frame, which
 * is what lets the two regimes be gated against two different papers without ever constructing a
 * configuration a consumer would not. `head` is the reference marker's world position, which is
 * an output of both.
 *
 * @param {Object} [options] - Passed to the layer, for the known-bad-input check ONLY. Every gate
 *   in this file is stated against `new Sway()` as a consumer constructs it.
 */
function traceSway( seed, seconds, options = {} ) {

    const { stack, layer, root } = buildStack( ( layerOptions ) => new Sway( layerOptions ), seed, options );

    const head = root.getObjectByName( HUMANOID_TO_FIGURE_BONE.head );

    const track = {
        balance: { medioLateral: [], anteroPosterior: [] },
        composite: { medioLateral: [], anteroPosterior: [] },
        head: { medioLateral: [], anteroPosterior: [] }
    };

    for ( let frame = 0; frame < seconds * SAMPLE_RATE_HZ; frame ++ ) {

        stack.update( FRAME_SECONDS );
        root.updateMatrixWorld( true );

        track.balance.medioLateral.push( layer.balanceDisplacement.x );
        track.balance.anteroPosterior.push( layer.balanceDisplacement.z );

        track.composite.medioLateral.push( layer.displacement.x );
        track.composite.anteroPosterior.push( layer.displacement.z );

        track.head.medioLateral.push( head.matrixWorld.elements[ 12 ] );
        track.head.anteroPosterior.push( head.matrixWorld.elements[ 14 ] );

    }

    stack.dispose();

    return track;

}

/** The gate band for one balance axis: the plate column, times one minus and one plus a tolerance. */
function toleranceBand( axis, tolerance ) {

    const target = BALANCE_TARGET_MILLIMETRES[ axis ];

    return { low: target * ( 1 - tolerance ), high: target * ( 1 + tolerance ) };

}

function withinTolerance( millimetres, axis, tolerance ) {

    const band = toleranceBand( axis, tolerance );

    return millimetres >= band.low && millimetres <= band.high;

}

/**
 * Duarte & Zatsiorsky's event rates, the relay a consumer actually listens to, and the clamp.
 *
 * 🎯 THE RELAYED MAGNITUDE IS GATED, NOT NOTED, AND THAT IS THE POINT OF THIS SECTION. Amplitudes
 * are drawn from a lognormal matched to Duarte's mean and SD, and the reason is §1.7c: read as a
 * gaussian and folded to stay positive, "22 ± 38 mm" draws a mean of 35 mm — 60% larger than the
 * paper says. That defect was VISIBLE in this file's own output for a whole phase, as
 * `relayed |magnitude| mean 1.59` against a distribution that should average 1.0, and nobody read
 * it as a defect because it was printed as a `....` note rather than asserted as a gate. It is a
 * gate now.
 *
 * `magnitude` is the drawn amplitude over Duarte's mean, so a shift averages 1.0 and a fidget
 * averages FIDGET_AMPLITUDE_FRACTION_OF_SHIFT. The MEDIAN is what is gated rather than the mean,
 * because a lognormal that skewed has a mean whose sample estimate is far noisier than its median:
 * sigma = 1.176 in log space, so the median of n draws is good to x/÷exp(1.253·1.176/sqrt(n)). At
 * the ~150 fidgets two hours produces that is ±13%, and the folded-gaussian defect would read
 * 2.8× the lognormal median — five times outside the band.
 *
 * ⚠️ The fidget fraction is READ OFF THE LAYER, not retyped here. This gate hardcoded 0.5 and went
 * red the day Sway moved to 1.0, against a layer that was doing exactly what it says.
 */

function measureWeightShifts() {

    section( '2.6 / 2.9  WEIGHT SHIFTS — Duarte & Zatsiorsky rates, and the relay' );

    const relays = [];

    const { stack, layer, root } = buildStack(
        ( layerOptions ) => new Sway( layerOptions ), SEED, { onWeightShift: ( event ) => relays.push( event ) } );

    const head = root.getObjectByName( HUMANOID_TO_FIGURE_BONE.head );
    const track = [];

    let peakPostureMedioLateral = 0;
    let peakPostureAnteroPosterior = 0;

    for ( let frame = 0; frame < EVENT_DURATION_SECONDS * SAMPLE_RATE_HZ; frame ++ ) {

        stack.update( FRAME_SECONDS );

        // The clamp is a per-frame invariant, so it is watched on every frame even though the
        // head track below is sampled once a second.
        peakPostureMedioLateral = Math.max( peakPostureMedioLateral, Math.abs( layer.postureDisplacement.x ) );
        peakPostureAnteroPosterior = Math.max( peakPostureAnteroPosterior, Math.abs( layer.postureDisplacement.z ) );

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

    // 🚩 Only the LATERAL axis relays, and it relays fidgets as well as shifts. Both halves of
    // that are recent and both were defects: a fore-and-aft shift firing a consumer's lateral arm
    // swing reads as a flinch, and relaying only the 0.30/min shift process left 7 of 12
    // ninety-second windows with no postural event in them at all (§1.4).
    const shifts = relays.filter( ( event ) => event.pattern === 'shift' ).map( magnitudeOf );
    const fidgets = relays.filter( ( event ) => event.pattern === 'fidget' ).map( magnitudeOf );
    const axes = new Set( relays.map( ( event ) => event.axis ) );

    gate( 'lateral relays per minute', relays.length / minutes, 1.25, 1.80,
        'ML fidget 1.2 + ML shift 0.30 = 1.5/min; +-3 Poisson sigma over two hours' );
    gate( 'relays are lateral only', axes.size === 1 && axes.has( 'medioLateral' ) ? 1 : 0, 1, 1,
        'a fore-and-aft shift firing a lateral arm swing would read as a flinch' );
    gate( 'both patterns relay', shifts.length > 0 && fidgets.length > 0 ? 1 : 0, 1, 1,
        'a fidget IS a weight shift — it is a shift that comes back' );

    // 🎯 DERIVED, NOT RETYPED. This band used to hardcode Sway's fidget amplitude fraction of 0.5,
    // and when that constant moved to 1.0 the gate went red against a layer that was behaving
    // correctly. Two copies of a constant drift apart; sway.selftest.mjs derives its own pooled
    // expectation the same way, at `relayed |magnitude| mean`.
    const fidgetFraction = new Sway().fidget.amplitudeFraction;
    const fidgetMedian = LOGNORMAL_MEDIAN_OF_UNIT_MEAN_SHIFT * fidgetFraction;

    gate( 'relayed fidget |magnitude| median', median( fidgets ),
        fidgetMedian * 0.77, fidgetMedian * 1.30,
        `lognormal median ${ fidgetMedian.toFixed( 4 ) } at a fidget fraction of ` +
        `${ fidgetFraction.toFixed( 2 ) }; a folded gaussian on 22 +- 38 mm would read ` +
        `${ ( 1.38 * fidgetFraction ).toFixed( 2 ) }` );

    note( 'relayed fidget |magnitude| mean', mean( fidgets ).toFixed( 3 ),
        `n=${ fidgets.length }; expectation ${ fidgetFraction.toFixed( 2 ) }. ` +
        'Noisier than the median, hence not the gate.' );
    note( 'relayed shift |magnitude| median', median( shifts ).toFixed( 3 ),
        `n=${ shifts.length }; expectation ${ LOGNORMAL_MEDIAN_OF_UNIT_MEAN_SHIFT.toFixed( 3 ) }` +
        ' — TOO FEW TO GATE (good to x/÷1.32 at this n)' );
    note( 'relayed shift |magnitude| mean', mean( shifts ).toFixed( 3 ),
        'expectation 1.0; the pre-lognormal layer printed 1.59 here and it was not read as a defect' );

    // The clamp is read off the rig's own base of support — a quarter of the way from the midline
    // to the stance foot, and from the ankle to the ball — so it is a fact about this figure
    // rather than a constant. It is an invariant, not a target: a two-hour run SHOULD reach it.
    note( 'peak posture ML / AP offset (mm)',
        `${ ( peakPostureMedioLateral * 1000 ).toFixed( 1 ) } / ${ ( peakPostureAnteroPosterior * 1000 ).toFixed( 1 ) }`,
        `clamp ${ ( layer.medioLateral.limit * 1000 ).toFixed( 1 ) } / ` +
        `${ ( layer.anteroPosterior.limit * 1000 ).toFixed( 1 ) } mm, read off the base of support` );

    gate( 'posture stays inside its clamp',
        Math.max( peakPostureMedioLateral / layer.medioLateral.limit,
            peakPostureAnteroPosterior / layer.anteroPosterior.limit ), 0, 1,
        'without the clamp a single draw from Duarte\'s tail walks the figure out of frame' );

    // Head offsets, reported: this is the composite in the frame a viewer sees, and there is
    // nothing published to compare it with. See reportHeadExcursion.
    note( 'peak head ML / AP offset (mm)',
        `${ ( extreme( track, 'x' ) * 1000 ).toFixed( 1 ) } / ${ ( extreme( track, 'z' ) * 1000 ).toFixed( 1 ) }`,
        'peak over two hours, balance + fidget + shift + drift, through the 1.64x head lever' );

    stack.dispose();

    /** The relay's magnitude is signed by direction; the amplitude claim is about its size. */
    function magnitudeOf( event ) {

        return Math.abs( event.magnitude );

    }

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

    const { stack, layer } = buildStack( ( options ) => new Sway( options ) );

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

        elapsed = stack.time;

        medioLateral.push( layer.balanceDisplacement.x );
        anteroPosterior.push( layer.balanceDisplacement.z );

    }

    // The balance band rather than the head, for the same reason the fixed-step gate uses it: it
    // is the quantity Quijoux measured. The band is the ±10% one — a single 300 s run, where the
    // seed-to-seed spread is ~±5%, sits between the median and extremes cases above.
    for ( const [ axis, name, samples ] of [
        [ 'medioLateral', 'ML', medioLateral ],
        [ 'anteroPosterior', 'AP', anteroPosterior ]
    ] ) {

        const band = toleranceBand( axis, 0.10 );

        gate( `balance ${ name } RMS under jitter (mm)`, rootMeanSquare( samples ) * 1000, band.low, band.high,
            `plate ${ name } ${ BALANCE_TARGET_MILLIMETRES[ axis ] } mm; frame rate must not change the amplitude` );

    }

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

    // The hand layer separately, because its state is not only a noise cursor: it carries Poisson
    // re-settle events and per-finger shares drawn at the moment one fires. A layer that rewinds
    // its noise but not its events reproduces for a while and then diverges, which is the worst
    // shape of non-determinism to debug and exactly what Layer.reset() exists to prevent.
    const handTrace = () => {

        const trace = traceLimbs( SEED, 60, { handIdle: true } );

        return trace.left.fingertipInHandFrame.flatMap( ( point ) => [ point.x, point.y, point.z ] );

    };

    const firstHand = handTrace();
    const secondHand = handTrace();

    let worstHand = 0;
    for ( let index = 0; index < firstHand.length; index ++ ) {
        worstHand = Math.max( worstHand, Math.abs( firstHand[ index ] - secondHand[ index ] ) );
    }

    gate( 'fingertip divergence between runs (mm)', worstHand * 1000, 0, 1e-9,
        'the re-settle draws its per-finger shares at event time; those have to rewind too' );

}

// --- rig / stack plumbing ---------------------------------------------------------------------

/**
 * A fresh stack driving a fresh copy of the figure's pose.
 *
 * The pose is restored from the GLB's own rest before every stack is bound. MotionStack captures
 * its rest pose from whatever the rig is in at bind time, so binding a second stack to a figure a
 * previous one has already driven captures a DISPLACED rest and every absolute measurement below
 * would be off by the last frame of the previous run.
 *
 * `layerOptions` exists for the known-bad-input check and for nothing else. Every gate in this
 * file is stated against the layer AS A CONSUMER CONSTRUCTS IT; see §1.5 and the sway header for
 * what happens when a gate quietly runs against a configuration nobody ships.
 */
function buildStack( createLayer, seed = SEED, layerOptions = {} ) {

    restoreRestPose();

    const root = figure.root;
    const stack = new MotionStack( { seed } );

    stack.bind( createMotionTarget( root ) );

    const layer = stack.add( createLayer( layerOptions ) );

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

function mean( values ) {

    let total = 0;
    for ( const value of values ) total += value;

    return total / values.length;

}

function range( values ) {

    return Math.max( ...values ) - Math.min( ...values );

}

function worldPositionOf( object ) {

    return new Vector3().setFromMatrixPosition( object.matrixWorld );

}

/**
 * The RMS of a point's displacement about its own mean, resolved over all three axes — the
 * quantity "how much did this point move", in metres, for a track of positions.
 *
 * Taken as the resultant of the three per-axis RMS values rather than of the per-frame distance,
 * so it is the same statistic the sway gates report and it composes the way a variance does.
 */
function resultantRootMeanSquare( points ) {

    const perAxis = [ 'x', 'y', 'z' ].map( ( axis ) => rootMeanSquare( points.map( ( point ) => point[ axis ] ) ) );

    return Math.sqrt( perAxis[ 0 ] ** 2 + perAxis[ 1 ] ** 2 + perAxis[ 2 ] ** 2 );

}

function pearson( first, second ) {

    const meanFirst = mean( first );
    const meanSecond = mean( second );

    let covariance = 0;
    let varianceFirst = 0;
    let varianceSecond = 0;

    for ( let index = 0; index < first.length; index ++ ) {

        const a = first[ index ] - meanFirst;
        const b = second[ index ] - meanSecond;

        covariance += a * b;
        varianceFirst += a * a;
        varianceSecond += b * b;

    }

    if ( varianceFirst === 0 || varianceSecond === 0 ) return 0;

    return covariance / Math.sqrt( varianceFirst * varianceSecond );

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

/**
 * Who drives the arms when IdleMotion and BodyIdle are in the same stack.
 *
 * Both declare the same six arm bones and the stack SUMS bone contributions, so running the pair
 * as shipped doubles every arm joint — silently, because two layers writing one bone is the normal
 * case the stack exists to serve. The testbed used to work around it by emptying IdleMotion's
 * joint array from the outside. These gates are the replacement contract.
 *
 * Note the add order: BodyIdle goes in AFTER IdleMotion, which is the order the application uses
 * and the order that breaks any resolution done at bind time.
 */
function measureArmOwnership() {

    section( 'ARM OWNERSHIP — IdleMotion yields the arms to BodyIdle' );

    const alone = runOnce( ( stack ) => stack.add( new IdleMotion() ) );

    gate( 'alone: drives the arms', alone.drivesArms ? 1 : 0, 1, 1,
        'no BodyIdle in the stack, so Improv on the arms is what this layer is for' );

    const shared = runOnce( ( stack ) => {

        const idle = stack.add( new IdleMotion() );
        stack.add( new BodyIdle() );

        return idle;

    } );

    gate( 'with BodyIdle: yields the arms', shared.drivesArms ? 0 : 1, 1, 1,
        'auto — bone contributions sum, so both driving the arms is a silent doubling' );

    gate( 'with BodyIdle: still drives the head', shared.drivesHead ? 1 : 0, 1, 1,
        'the intended split is BodyIdle below the neck, IdleMotion on the head' );

    gate( 'with BodyIdle: no longer DECLARES the arms', shared.declaresArms ? 0 : 1, 1, 1,
        'declaration is how the stack masks bones and names a conflict; it must not lie' );

    const forced = runOnce( ( stack ) => {

        const idle = stack.add( new IdleMotion( { armsEnabled: true } ) );
        stack.add( new BodyIdle() );

        return idle;

    } );

    gate( 'armsEnabled: true overrides the yield', forced.drivesArms ? 1 : 0, 1, 1,
        'an explicit request beats the automatic one' );

    const silenced = runOnce( ( stack ) => stack.add( new IdleMotion( { armsEnabled: false } ) ) );

    gate( 'armsEnabled: false silences them alone too', silenced.drivesArms ? 0 : 1, 1, 1,
        'no consumer should have to reach into the layer to do this' );

    /** Builds a stack, runs a second of it, and reports what IdleMotion ended up writing. */
    function runOnce( addLayers ) {

        restoreRestPose();

        const stack = new MotionStack( { seed: SEED } );
        stack.bind( createMotionTarget( figure.root ) );

        const idle = addLayers( stack );

        // Peak over a second rather than the value on one frame: coherent noise is exactly zero
        // at its lattice points, and a whole number of seconds lands the 1 Hz shoulder stream on
        // one. A single sample there reads as "not driven" for a layer that is driving fine.
        let armPeak = 0;
        let headPeak = 0;

        for ( let frame = 0; frame < 60; frame ++ ) {

            stack.update( FRAME_SECONDS );

            const rotations = idle.contribution.boneRotations;

            armPeak = Math.max( armPeak, rotationSize( rotations.get( idle.bones.leftUpperArm ) ) );
            headPeak = Math.max( headPeak, rotationSize( rotations.get( idle.bones.head ) ) );

        }

        const result = {
            declaresArms: idle.contribution.boneRotations.has( idle.bones.leftUpperArm ),
            drivesArms: armPeak > 0,
            drivesHead: headPeak > 0
        };

        stack.dispose();

        return result;

    }

    /** How far off identity a contributed rotation is; 0 for a channel that was never written. */
    function rotationSize( quaternion ) {

        if ( quaternion === undefined ) return 0;

        return 1 - Math.abs( quaternion.w );

    }

}

// --- limb symmetry and hand articulation -------------------------------------------------------

/**
 * 🎯 THE RATIO GATE. Left-limb energy over right-limb energy, at every arm joint and at the
 * fingertip, over a seed matrix.
 *
 * Read the LIMB_ENERGY_RATIO_LIMIT comment before touching anything here. In one line: a blind
 * judge measured one arm at 2.5× the other over seven minutes while this whole file was green,
 * because everything in it measured one side's magnitude against a range and a magnitude gate is
 * structurally unable to see a ratio.
 *
 * What is measured, and why each is a different question:
 *
 *   ANGULAR RMS per joint — how hard the layer is driving that joint. This is where a seed, a
 *   rest frame or a handedness bug would show, because it is upstream of every lever.
 *
 *   HAND POSITION RMS — how far the whole arm carries the hand in world space. A joint could be
 *   balanced and the arms still asymmetric if one of them rides a longer lever, which is a rest
 *   pose defect rather than a motion one, and this is the channel that would show it.
 *
 *   FINGERTIP RMS IN THE HAND'S FRAME — articulation alone, with the arm's carriage divided out.
 *
 * 🚩 What is deliberately NOT gated here is PHASE. `BodyIdle.selftest.mjs` gates left-against-right
 * Pearson r to |r| ≤ 0.25 at every joint, and that decorrelation is correct and hard-won — two
 * arms drifting in step read as mechanical instantly. Decorrelated phase with matched energy is
 * the target. Nothing below may be "fixed" by correlating the sides.
 */
function gateLimbSymmetry() {

    section( 'LIMB SYMMETRY — left against right, as a RATIO (the 2.5x defect)' );

    const byChannel = new Map();
    const byPhase = new Map();

    for ( const seed of LIMB_SEEDS ) {

        const trace = traceLimbs( seed, LIMB_WINDOW_SECONDS, { handIdle: true } );

        for ( const [ channel, ratio ] of Object.entries( symmetricRatios( trace ) ) ) {

            if ( byChannel.has( channel ) === false ) byChannel.set( channel, [] );
            byChannel.get( channel ).push( ratio );

        }

        for ( const [ channel, r ] of Object.entries( leftRightCorrelations( trace ) ) ) {

            if ( byPhase.has( channel ) === false ) byPhase.set( channel, [] );
            byPhase.get( channel ).push( r );

        }

    }

    for ( const [ channel, ratios ] of byChannel ) {

        gate( `${ channel } worst L/R ratio`, Math.max( ...ratios ), 1, LIMB_ENERGY_RATIO_LIMIT,
            `worst of ${ LIMB_SEEDS.length } seeds; measured scatter tops out at 1.17, the defect was 2.5` );

    }

    const worst = Math.max( ...[ ...byChannel.values() ].flat() );

    note( 'worst ratio, any channel any seed', worst.toFixed( 3 ),
        `the whole matrix in one number; the bound is ${ LIMB_ENERGY_RATIO_LIMIT }` );

    // 🎯 The other half of the contract, asserted in the same place so neither can be traded for
    // the other. Matched energy is trivially achievable by making the two sides the SAME signal,
    // and that is the defect this project already solved — symmetric arm drift reads as mechanical
    // before a viewer can say why. BodyIdle.selftest owns the primary decorrelation gate on its
    // own layer alone; this one holds the same bound on the assembled consumer stack, where the
    // hand layer is new and the arms are being read through a rest pose.
    for ( const [ channel, correlations ] of byPhase ) {

        const strongest = correlations.reduce( ( a, b ) => Math.abs( a ) > Math.abs( b ) ? a : b );

        gate( `${ channel } left-right |r|`, Math.abs( strongest ), 0, 0.25,
            `signed r = ${ strongest.toFixed( 3 ) }; the bound is BodyIdle.selftest's, unchanged` );

    }

}

/**
 * Known-bad input for the gate above — LEARNINGS §1.1: a gate that has never failed is not known
 * to work.
 *
 * The defect is constructed rather than simulated: one extra layer that drives ONE upper arm and
 * nothing else, which is the shape of every candidate the judge's finding pointed at — a seed
 * offset applied to one side, a mirrored bone map, a copy-paste that never got its `_r`. It is
 * added to the same stack the gate above measures, and the same measurement is taken.
 *
 * The assertion is two-sided on purpose. It is not enough that the ratio comes out large; it has
 * to come out large enough to be the defect the judge described, and the bound has to reject it.
 */
function gateLimbSymmetryRejectsAOneSidedArm() {

    section( 'LIMB SYMMETRY — known-bad inputs: a lopsided arm, and a mirrored pair' );

    const lopsided = { ratios: [], correlations: [] };
    const mirrored = { ratios: [], correlations: [] };

    for ( const seed of LIMB_SEEDS ) {

        const oneSided = traceLimbs( seed, LIMB_WINDOW_SECONDS, { handIdle: true, armDefect: 'oneSided' } );
        lopsided.ratios.push( symmetricRatios( oneSided ).upperarm );
        lopsided.correlations.push( Math.abs( leftRightCorrelations( oneSided ).upperarm ) );

        const both = traceLimbs( seed, LIMB_WINDOW_SECONDS, { handIdle: true, armDefect: 'mirrored' } );
        mirrored.ratios.push( symmetricRatios( both ).upperarm );
        mirrored.correlations.push( Math.abs( leftRightCorrelations( both ).upperarm ) );

    }

    const smallestImbalance = Math.min( ...lopsided.ratios );

    note( 'lopsided: ratio across seeds',
        `${ smallestImbalance.toFixed( 2 ) }..${ Math.max( ...lopsided.ratios ).toFixed( 2 ) }`,
        'the injected imbalance, measured exactly as the gate above measures the real stack' );

    gate( 'lopsided reaches the judged 2.5x', smallestImbalance, 2.3, 12,
        'if the injected defect were small the rejection below would prove nothing' );

    gate( 'lopsided is REJECTED by the ratio gate', smallestImbalance > LIMB_ENERGY_RATIO_LIMIT ? 1 : 0, 1, 1,
        `the smallest injected ratio ${ smallestImbalance.toFixed( 2 ) } must exceed the bound ${ LIMB_ENERGY_RATIO_LIMIT }` );

    // 🎯 The independence proof. A mirrored pair is what "make the two arms match" produces if it
    // is taken as an instruction about the signal rather than about its energy — and it is the
    // defect this project already fixed once. It must sail through the ratio gate and be caught by
    // the correlation one; if either half of that fails, the two gates are not measuring two
    // different things and one of them is decorative.
    const strongestMirrored = Math.max( ...mirrored.correlations );
    const worstMirroredRatio = Math.max( ...mirrored.ratios );

    note( 'mirrored: ratio / correlation',
        `${ worstMirroredRatio.toFixed( 2 ) } / ${ strongestMirrored.toFixed( 2 ) }`,
        'matched energy, collapsed phase — the failure a naive fix for the gate above introduces' );

    gate( 'mirrored PASSES the ratio gate', worstMirroredRatio <= LIMB_ENERGY_RATIO_LIMIT ? 1 : 0, 1, 1,
        'if the ratio gate caught this too, it would not be measuring energy alone' );

    gate( 'mirrored is REJECTED by the phase gate', Math.min( ...mirrored.correlations ) > 0.25 ? 1 : 0, 1, 1,
        `weakest injected |r| ${ Math.min( ...mirrored.correlations ).toFixed( 2 ) } must exceed the 0.25 bound` );

}

/**
 * Who owns the fingers when BodyIdle and HandIdle are in the same stack.
 *
 * Both declare all thirty finger bones and contributions SUM, so running the pair unresolved is a
 * silent doubling — the same trap already documented between IdleMotion and BodyIdle on the arms.
 * HandIdle resolves it by TAKING the channel rather than yielding it, because BodyIdle's finger
 * model is a strict subset of HandIdle's at an amplitude measured at 0.48 px of travel.
 *
 * Reaching into a sibling layer's flag earns a gate rather than trust: that it happens, that it is
 * defeatable, and that it is handed back on dispose.
 */
function gateFingerOwnership() {

    section( 'FINGER OWNERSHIP — HandIdle takes the fingers from BodyIdle' );

    const claimed = runFingerOwnership( {} );

    gate( 'BodyIdle stands down', claimed.ownerDrivesFingersAfter ? 0 : 1, 1, 1,
        'bone contributions sum, so both driving the fingers is a silent doubling' );

    gate( 'HandIdle drives them instead', claimed.handIdleDrivesFingers ? 1 : 0, 1, 1,
        'taking a channel and then not writing it would be worse than leaving it alone' );

    gate( 'released on dispose', claimed.ownerDrivesFingersAfterDispose ? 1 : 0, 1, 1,
        'a layer that silences another and leaves would take the fingers with it' );

    const left = runFingerOwnership( { claimFingersFrom: null } );

    gate( 'claimFingersFrom: null leaves BodyIdle alone', left.ownerDrivesFingersAfter ? 1 : 0, 1, 1,
        'the takeover is defeatable, for a test that wants to measure the doubling' );

    /** Builds BodyIdle then HandIdle — the add order an application uses — and runs one second. */
    function runFingerOwnership( options ) {

        restoreRestPose();

        const stack = new MotionStack( { seed: SEED } );
        stack.bind( createMotionTarget( figure.root ) );

        const bodyIdle = stack.add( new BodyIdle() );
        const handIdle = stack.add( new HandIdle( options ) );

        const fingerBone = HUMANOID_TO_FIGURE_BONE.leftIndexProximal;

        let handIdlePeak = 0;

        for ( let frame = 0; frame < 60; frame ++ ) {

            stack.update( FRAME_SECONDS );

            const rotation = handIdle.contribution.boneRotations.get( fingerBone );
            handIdlePeak = Math.max( handIdlePeak, rotation === undefined ? 0 : 1 - Math.abs( rotation.w ) );

        }

        const result = {
            ownerDrivesFingersAfter: bodyIdle.fingersEnabled,
            handIdleDrivesFingers: handIdlePeak > 0
        };

        stack.remove( handIdle );
        result.ownerDrivesFingersAfterDispose = bodyIdle.fingersEnabled;

        stack.dispose();

        return result;

    }

}

/**
 * 🎯 THE ARTICULATION GATE. Does the hand move enough for a viewer to see it?
 *
 * Stated in pixels at full-body framing, because that is the question, and because the units the
 * shipped layer was authored in — degrees at a knuckle — are what let a motion that turned out to
 * be 0.48 px over seven minutes pass every review it was given. See FINGERTIP_TRAVEL_FLOOR_PIXELS.
 *
 * Four assertions, each catching a different way of being wrong:
 *
 *   TRAVEL, in pixels — the defect itself.
 *   FLEXION RANGE, as a fraction of resting curl — the same claim in the units the layer authors
 *     in, with a CEILING as well, because over-animating an idle is as bad as having none.
 *   TREMOR BAND — a hand can be made to travel far by buzzing, and 8–12 Hz reads as illness.
 *   TOGETHERNESS — a relaxed hand moves as a loose unit; five independent digits read as a hand
 *     playing an invisible piano. Same statistic BodyIdle.selftest gates, kept because the layer
 *     driving the fingers changed underneath it.
 */
function gateHandArticulation() {

    section( '2.7  HAND ARTICULATION — fingertip travel, in pixels at full-body framing' );

    const stature = new Box3().setFromObject( figure.root );
    const framedHeightMillimetres = ( stature.max.y - stature.min.y ) * BODY_FRAME_MARGIN * 1000;
    const pixelsPerMillimetre = FULL_BODY_CAPTURE_PIXELS / framedHeightMillimetres;

    note( 'full-body framing (mm / px per mm)',
        `${ framedHeightMillimetres.toFixed( 0 ) } / ${ pixelsPerMillimetre.toFixed( 4 ) }`,
        'measured stature x 1.10 margin over a 1200 px capture; alive.js and LEARNINGS Part 3' );

    const travelPixels = [];
    const flexionFractions = [];
    const tremorPercents = [];
    const togetherness = [];

    for ( const seed of LIMB_SEEDS ) {

        const trace = traceLimbs( seed, LIMB_WINDOW_SECONDS, { handIdle: true } );

        for ( const side of [ 'left', 'right' ] ) {

            const hand = trace[ side ];

            travelPixels.push( peakToPeakResultant( hand.fingertipInHandFrame ) * pixelsPerMillimetre );
            flexionFractions.push( range( hand.indexFlexionDegrees ) / mean( hand.indexFlexionDegrees ) );
            tremorPercents.push( welchSpectrum( hand.indexFlexionDegrees, 2048 ).powerInTremorBandPercent );

        }

        togetherness.push( pearson( trace.left.indexFlexionDegrees, trace.left.middleFlexionDegrees ) );

    }

    note( 'fingertip travel (mm, worst side/seed)',
        ( Math.min( ...travelPixels ) / pixelsPerMillimetre ).toFixed( 2 ),
        'peak-to-peak in the HAND\'s own frame, so the arm carrying it is divided out' );

    gate( 'fingertip travel (px, worst)', Math.min( ...travelPixels ), FINGERTIP_TRAVEL_FLOOR_PIXELS, 40,
        'the shipped finger idle measures 0.48 px here; 1.6 px is on record as indistinguishable' );

    gate( 'index flexion range / rest (worst low)', Math.min( ...flexionFractions ),
        FINGER_FLEXION_RANGE_FRACTION.low, FINGER_FLEXION_RANGE_FRACTION.high,
        'the same claim in the units the layer authors in — a fraction of the resting curl' );

    gate( 'index flexion range / rest (worst high)', Math.max( ...flexionFractions ),
        FINGER_FLEXION_RANGE_FRACTION.low, FINGER_FLEXION_RANGE_FRACTION.high,
        'ceiling: past about half its resting curl a hand is opening and closing, not idling' );

    gate( 'finger power in 8-12 Hz tremor band (%)', Math.max( ...tremorPercents ), 0, 1,
        'travel bought by buzzing reads as illness; relaxed fingers drift' );

    gate( 'same-hand index/middle r', Math.min( ...togetherness ), 0.50, 1.0,
        'a relaxed hand moves as a loose unit, not as five independent digits' );

}

/**
 * Known-bad input for the gate above, and the strongest form of LEARNINGS §1.1 available here:
 * the known-bad is **the code as it shipped**.
 *
 * Remove HandIdle and BodyIdle's own finger drift comes back — 0.45° of peak deviation at a
 * knuckle, which is what the blind judge watched for seven minutes and reported as "THE HANDS
 * NEVER MOVE". If the articulation gate is worth anything it must reject that, and it must reject
 * it by a wide margin rather than by a whisker.
 */
/**
 * 🎯 THE SAME SEED AT 30, 60 AND 120 Hz MUST PRODUCE THE SAME HANDS — punch-list 2.11, and the
 * gate LEARNINGS §1.13 says every stochastic layer needs.
 *
 * `HandIdle` used to ask `poissonEventOccurs(rate, dt)` once per hand per frame, off ONE shared
 * stream. Both halves of that were wrong: the stream was advanced by the renderer rather than by
 * the hand, and the two hands interleaved their draws in whatever order they fired, so which frame
 * the left hand re-settled in decided the right hand's sequence. The fix is one `PoissonSchedule`
 * per hand on its own forked stream, plus cutting the frame at each arrival AND at each
 * re-settle's end — the refractory window was the second coupling, the same one `Blink` had
 * (§1.13a), and converting the arrivals alone would have left it.
 *
 * Measured on the layer ALONE, at the instants the three rates share. Attribution by isolation:
 * every other layer in this file is already invariant, and running the whole stack would put five
 * layers' worth of arithmetic between the change and the number.
 */
function gateHandIdleFrameRateInvariance() {

    section( '2.7  HAND IDLE — the same seed at 30, 60 and 120 Hz' );

    const rates = [ 30, 60, 120 ];

    // 🎯 THE TOLERANCE IS THE INSTRUMENT'S FLOOR, MEASURED, NOT A ROUND NUMBER. Two things put a
    // residue here that no scheduling fix can remove, and both are attributed below rather than
    // assumed: `noisePhase` is INTEGRATED (`+= dt × gain`), so 18,000 additions and 72,000
    // additions of the same total differ in their last bits; and `chainFlexionDegrees` measures
    // through `acos` near 1, which MotionStack.selftest.mjs records as amplifying 7e-9 of
    // quaternion error into 0.013 degrees. The drift-only run below measures what the pair costs
    // with no events in play at all, and the tolerance sits three orders of magnitude above it and
    // seven below the coupled layer's error.
    const toleranceDegrees = 1e-6;
    const seconds = 600;

    const shipped = rates.map( ( rate ) => traceHandIdleAtRate( rate, seconds, {} ) );
    const coupled = rates.map( ( rate ) => traceHandIdleAtRate( rate, seconds, { frameCoupledArrivals: true } ) );
    const driftOnly = rates.map( ( rate ) => traceHandIdleAtRate( rate, seconds, { resettlesEnabled: false } ) );

    console.log( '' );
    console.log( '          rate   re-settles   worst finger flexion vs 60 Hz (deg)' );

    for ( let index = 0; index < rates.length; index ++ ) {

        console.log( `        ${ String( rates[ index ] ).padStart( 4 ) } Hz   ${ String( shipped[ index ].resettles ).padStart( 10 ) }   ` +
            `${ worstFlexionGap( shipped[ index ], shipped[ 1 ] ).toExponential( 2 ).padStart( 34 ) }` );

    }

    console.log( '' );

    const worst = Math.max( ...shipped.map( ( trace ) => worstFlexionGap( trace, shipped[ 1 ] ) ) );
    const coupledWorst = Math.max( ...coupled.map( ( trace ) => worstFlexionGap( trace, coupled[ 1 ] ) ) );
    const driftWorst = Math.max( ...driftOnly.map( ( trace ) => worstFlexionGap( trace, driftOnly[ 1 ] ) ) );

    // ATTRIBUTION, not argument. With the events switched off there is nothing left to schedule,
    // so whatever this reads is the integrated noise phase plus the acos measurement — the floor
    // the gate above cannot go below however the arrivals are drawn.
    note( 'drift only, no events, worst divergence (deg)', driftWorst.toExponential( 2 ),
        `the instrument's own floor; the tolerance is ${ toleranceDegrees } and the coupled layer scores ` +
        `${ coupledWorst.toExponential( 2 ) }` );

    gate( 'worst finger divergence, 30/60/120 Hz (deg)', worst, 0, toleranceDegrees,
        `both hands, index and middle chains, every shared instant over ${ seconds } s` );

    gate( 'the events add nothing to the instrument floor (x)', worst / Math.max( driftWorst, 1e-15 ), 0, 10,
        'if scheduling were still coupled this ratio would be enormous; it is the check that the ' +
        'tolerance above is measuring float dust rather than hiding a residue' );

    gate( 're-settle count identical at every frame rate',
        shipped.every( ( trace ) => trace.resettles === shipped[ 0 ].resettles ) ? 1 : 0, 1, 1,
        shipped.map( ( trace ) => trace.resettles ).join( ' / ' ) );

    // §1.1 — proven against the defect itself, rebuilt behind an option.
    gate( 'the gate REJECTS frame-coupled arrivals', coupledWorst > toleranceDegrees ? 1 : 0, 1, 1,
        `the per-frame coin diverges by ${ coupledWorst.toExponential( 2 ) } deg` );

    gate( 'and by a real margin (x the tolerance)', coupledWorst / toleranceDegrees, 1e6, 1e18,
        'the error has to be large enough that the tolerance is not what decided it' );

    // 🚩 RECORDED AS A GATE. A count is what an audit reaches for and it cannot see this. Stated
    // in units of the sampling error, because these are Poisson counts and a percentage means
    // something different at 5 events than at 60: the difference of two independent Poisson counts
    // has standard deviation sqrt(N1 + N2).
    const counts = coupled.map( ( trace ) => trace.resettles );
    const sigmas = Math.abs( counts[ 0 ] - counts[ 2 ] ) / Math.sqrt( Math.max( counts[ 0 ] + counts[ 2 ], 1 ) );

    gate( 'a RATE gate would NOT have caught it (sigma)', sigmas, 0, 3,
        `recorded, not tolerated: ${ counts.join( ' / ' ) } re-settles at 30 / 60 / 120 Hz — ` +
        'inside Poisson sampling error while the trajectory is a different one' );

}

/** HandIdle alone at one frame rate, sampled only at the instants every rate shares. */
function traceHandIdleAtRate( rateHz, seconds, options ) {

    restoreRestPose();

    const skeleton = new Skeleton( figure.root );
    RestPose.load( CONSUMER_REST_POSE ).applyTo( skeleton );
    skeleton.update();
    figure.root.updateMatrixWorld( true );

    const stack = new MotionStack( { seed: LIMB_SEEDS[ 0 ] } );
    stack.bind( createMotionTarget( figure.root ) );

    const handIdle = stack.add( new HandIdle( { claimFingersFrom: null, ...options } ) );

    const sides = { left: createLimbTrace( 'left' ), right: createLimbTrace( 'right' ) };
    const substeps = Math.round( rateHz / 30 );
    const samples = Math.round( seconds * 30 );

    for ( let sample = 0; sample < samples; sample ++ ) {

        for ( let step = 0; step < substeps; step ++ ) stack.update( 1 / rateHz );

        figure.root.updateMatrixWorld( true );

        for ( const side of [ 'left', 'right' ] ) {

            sides[ side ].indexFlexionDegrees.push( chainFlexionDegrees( sides[ side ].indexChain ) );
            sides[ side ].middleFlexionDegrees.push( chainFlexionDegrees( sides[ side ].middleChain ) );

        }

    }

    const resettles = handIdle.eventCounts.resettle;

    stack.dispose();

    return { sides, resettles };

}

/** The worst disagreement between two hand traces, over both hands and both chains. */
function worstFlexionGap( trace, reference ) {

    let worst = 0;

    for ( const side of [ 'left', 'right' ] ) {

        for ( const channel of [ 'indexFlexionDegrees', 'middleFlexionDegrees' ] ) {

            const mine = trace.sides[ side ][ channel ];
            const theirs = reference.sides[ side ][ channel ];

            for ( let index = 0; index < mine.length; index ++ ) {

                worst = Math.max( worst, Math.abs( mine[ index ] - theirs[ index ] ) );

            }

        }

    }

    return worst;

}

function gateHandArticulationRejectsTheShippedFingers() {

    section( '2.7  HAND ARTICULATION — known-bad input: the finger idle as it shipped' );

    const stature = new Box3().setFromObject( figure.root );
    const pixelsPerMillimetre =
        FULL_BODY_CAPTURE_PIXELS / ( ( stature.max.y - stature.min.y ) * BODY_FRAME_MARGIN * 1000 );

    const travelPixels = [];
    const flexionFractions = [];

    for ( const seed of LIMB_SEEDS ) {

        const trace = traceLimbs( seed, LIMB_WINDOW_SECONDS, { handIdle: false } );

        for ( const side of [ 'left', 'right' ] ) {

            travelPixels.push( peakToPeakResultant( trace[ side ].fingertipInHandFrame ) * pixelsPerMillimetre );
            flexionFractions.push( range( trace[ side ].indexFlexionDegrees ) / mean( trace[ side ].indexFlexionDegrees ) );

        }

    }

    const worstCase = Math.max( ...travelPixels );

    note( 'shipped fingers, travel (px)', worstCase.toFixed( 3 ),
        'best of every side and seed, so the rejection is not luck' );

    note( 'shipped fingers, flexion / rest', Math.max( ...flexionFractions ).toFixed( 4 ),
        `against the ${ FINGER_FLEXION_RANGE_FRACTION.low } floor` );

    gate( 'shipped fingers are REJECTED', worstCase < FINGERTIP_TRAVEL_FLOOR_PIXELS ? 1 : 0, 1, 1,
        `${ worstCase.toFixed( 2 ) } px must fall under the ${ FINGERTIP_TRAVEL_FLOOR_PIXELS } px floor` );

    gate( 'rejection margin (floor / measured)', FINGERTIP_TRAVEL_FLOOR_PIXELS / worstCase, 3, 1e4,
        'a gate that rejects the defect by a whisker is a gate that will drift back through it' );

}

// --- limb measurement --------------------------------------------------------------------------

/**
 * Runs the arm and hand layers the way an application does, and records what each side did.
 *
 * The stack is the consumer's, not a single layer in isolation: `Sway` is in it because the arms
 * answer a weight shift through `onWeightShift`, and `IdleMotion` because its 'auto' arm yield is
 * part of what decides who drives what. LEARNINGS §1.5 — a gate measured on a configuration no
 * consumer would construct proved nothing once already in this file.
 *
 * The rest pose goes on BEFORE the stack binds, which is the whole trick and is what alive.js
 * does: every layer snapshots rest from whatever pose the bones are in at bind time.
 *
 * @param {number} seed
 * @param {number} seconds
 * @param {Object} options
 * @param {boolean} options.handIdle - false leaves BodyIdle's shipped finger drift in charge.
 * @param {'oneSided'|'mirrored'|null} [options.armDefect=null] - Injects a known-bad arm layer.
 */
function traceLimbs( seed, seconds, { handIdle, armDefect = null } ) {

    restoreRestPose();

    const skeleton = new Skeleton( figure.root );
    RestPose.load( CONSUMER_REST_POSE ).applyTo( skeleton );
    skeleton.update();
    figure.root.updateMatrixWorld( true );

    const stack = new MotionStack( { seed } );
    stack.bind( createMotionTarget( figure.root ) );

    const bodyIdle = new BodyIdle();

    stack.add( new Sway( { onWeightShift: ( shift ) => bodyIdle.onWeightShift( shift ) } ) );
    stack.add( new IdleMotion( { armsEnabled: 'auto' } ) );
    stack.add( bodyIdle );

    if ( handIdle ) stack.add( new HandIdle() );
    if ( armDefect !== null ) stack.add( createArmDefect( armDefect ) );

    const sides = {
        left: createLimbTrace( 'left' ),
        right: createLimbTrace( 'right' )
    };

    const handInverse = new Matrix4();

    for ( let frame = 0; frame < seconds * SAMPLE_RATE_HZ; frame ++ ) {

        stack.update( FRAME_SECONDS );
        figure.root.updateMatrixWorld( true );

        for ( const side of [ 'left', 'right' ] ) {

            const trace = sides[ side ];

            for ( const joint of trace.joints ) {

                const degrees = angleBetweenDegrees( joint.bone.quaternion, joint.rest );

                joint.degrees.push( degrees );

                // Signed by the x component, the same convention measureIdleMotion uses: an
                // unsigned angle folds every cycle in half, which is harmless for an energy RMS
                // and ruins a correlation. Energy is measured on the folded series the bound was
                // calibrated against; phase is measured on this one.
                joint.signedDegrees.push( degrees * ( joint.bone.quaternion.x >= joint.rest.x ? 1 : -1 ) );

            }

            trace.handPosition.push( worldPositionOf( trace.hand ) );

            // In the HAND's frame: the arm carrying the hand around the scene is divided out and
            // what is left is articulation. A world-space fingertip is dominated by postural sway.
            handInverse.copy( trace.hand.matrixWorld ).invert();
            trace.fingertipInHandFrame.push( worldPositionOf( trace.fingertip ).applyMatrix4( handInverse ) );

            trace.indexFlexionDegrees.push( chainFlexionDegrees( trace.indexChain ) );
            trace.middleFlexionDegrees.push( chainFlexionDegrees( trace.middleChain ) );

        }

    }

    stack.dispose();

    return sides;

}

function createLimbTrace( side ) {

    const boneOf = ( humanoidName ) => figure.root.getObjectByName( HUMANOID_TO_FIGURE_BONE[ humanoidName ] );

    const capitalised = side === 'left' ? 'left' : 'right';

    const joints = [ 'Shoulder', 'UpperArm', 'LowerArm', 'Hand' ].map( ( name ) => {

        const bone = boneOf( `${ capitalised }${ name }` );

        return { label: name, bone, rest: bone.quaternion.clone(), degrees: [], signedDegrees: [] };

    } );

    return {
        side,
        joints,
        hand: boneOf( `${ capitalised }Hand` ),
        fingertip: boneOf( `${ capitalised }IndexDistal` ),
        indexChain: [ 'Hand', 'IndexProximal', 'IndexIntermediate', 'IndexDistal' ].map( ( n ) => boneOf( `${ capitalised }${ n }` ) ),
        middleChain: [ 'Hand', 'MiddleProximal', 'MiddleIntermediate', 'MiddleDistal' ].map( ( n ) => boneOf( `${ capitalised }${ n }` ) ),
        handPosition: [],
        fingertipInHandFrame: [],
        indexFlexionDegrees: [],
        middleFlexionDegrees: []
    };

}

/**
 * Total flexion along a finger, in degrees: the angle between successive segment directions,
 * summed over the two joints that have a successor to measure against.
 *
 * Measured as GEOMETRY rather than as a quaternion off rest, because that is the quantity the
 * amplitude is a fraction of and the quantity a viewer sees — and because it is comparable across
 * rigs, where a bone-local quaternion is not.
 */
function chainFlexionDegrees( bones ) {

    const points = bones.map( worldPositionOf );

    let total = 0;

    for ( let index = 0; index < points.length - 2; index ++ ) {

        const before = points[ index + 1 ].clone().sub( points[ index ] ).normalize();
        const after = points[ index + 2 ].clone().sub( points[ index + 1 ] ).normalize();

        total += Math.acos( Math.min( Math.max( before.dot( after ), -1 ), 1 ) ) * 180 / Math.PI;

    }

    return total;

}

/**
 * The trace reduced to one symmetric ratio per channel: whichever side is larger goes on top, so
 * a bound can be stated once instead of as a two-sided band nobody reads correctly.
 */
function symmetricRatios( trace ) {

    const ratios = {};

    for ( let index = 0; index < trace.left.joints.length; index ++ ) {

        const label = trace.left.joints[ index ].label.toLowerCase();

        ratios[ label ] = symmetricRatio(
            rootMeanSquare( trace.left.joints[ index ].degrees ),
            rootMeanSquare( trace.right.joints[ index ].degrees ) );

    }

    ratios.handPosition = symmetricRatio(
        resultantRootMeanSquare( trace.left.handPosition ),
        resultantRootMeanSquare( trace.right.handPosition ) );

    ratios.fingertip = symmetricRatio(
        resultantRootMeanSquare( trace.left.fingertipInHandFrame ),
        resultantRootMeanSquare( trace.right.fingertipInHandFrame ) );

    return ratios;

}

/**
 * The same trace reduced to one left-against-right Pearson r per channel — PHASE, where the
 * ratios above are ENERGY. Two arms can be perfectly matched in energy and still wrong, if they
 * are matched by being the same signal.
 */
function leftRightCorrelations( trace ) {

    const correlations = {};

    for ( let index = 0; index < trace.left.joints.length; index ++ ) {

        const label = trace.left.joints[ index ].label.toLowerCase();

        correlations[ label ] = pearson(
            trace.left.joints[ index ].signedDegrees,
            trace.right.joints[ index ].signedDegrees );

    }

    correlations.fingerFlexion = pearson( trace.left.indexFlexionDegrees, trace.right.indexFlexionDegrees );

    return correlations;

}

function symmetricRatio( a, b ) {

    if ( a === 0 && b === 0 ) return 1;
    if ( a === 0 || b === 0 ) return Infinity;

    return Math.max( a / b, b / a );

}

/**
 * The two injected arm defects, one per half of the symmetry contract.
 *
 *   'oneSided' drives ONE upper arm and nothing else — the energy imbalance the judge reported.
 *   'mirrored' drives BOTH upper arms from the SAME noise stream — energy stays matched and the
 *     phase collapses, which is the failure the decorrelation gate exists for and the one a naive
 *     "fix" for the energy gate would introduce.
 *
 * Having both matters more than having either. They prove the two gates are independent: the
 * mirrored defect passes the ratio gate and fails the correlation gate, so neither can be traded
 * for the other by a future change trying to make one of them green.
 *
 * Both are built out of the same materials as the real thing — a coherent-noise stream on the same
 * joint at the same Improv rate — so what is rejected is the property under test and not something
 * structurally alien that could be rejected for the wrong reason.
 *
 * The class lives inside this function rather than beside the other declarations at the foot of
 * the file because the top-level gate calls run before that point is evaluated, and a class
 * declaration — unlike a function declaration — is in its temporal dead zone until then. A
 * function is the one form that is hoisted, so the fixture stays where its explanation is.
 */
function createArmDefect( mode ) {

    const bones = mode === 'mirrored'
        ? [ HUMANOID_TO_FIGURE_BONE.leftUpperArm, HUMANOID_TO_FIGURE_BONE.rightUpperArm ]
        : [ HUMANOID_TO_FIGURE_BONE.leftUpperArm ];

    return new ( class extends Layer {

        constructor() {

            super( {
                name: 'armDefect',
                order: MOTION_ORDER.SWAY + 80,
                boneChannels: bones
            } );

            this.elapsedSeconds = 0;
            this.noise = null;
            this.restFrames = new Map();
            this.scratchRig = new Quaternion();
            this.scratchDelta = new Quaternion();
            this.axis = new Vector3( 1, 0, 0 );

        }

        onBind( context ) {

            // ONE stream for however many bones. That is the whole point of the mirrored variant.
            this.noise = new CoherentNoise1D( this.random.integer( 0, 0x7fffffff ), 256 );

            for ( const boneName of bones ) {

                this.restFrames.set( boneName, restRotationRelativeToRig( context.target.getBone( boneName ) ) );

            }

        }

        update( deltaSeconds ) {

            this.elapsedSeconds += deltaSeconds;

            // Calibrated so the MEASURED ratio lands on the judge's 2.5, rather than picked to
            // look like it should. Swept on this stack over the same six seeds: 3° gives
            // 1.40–1.59, 4° gives 1.77–1.97, 5° gives 2.16–2.44, 6° gives 2.54–2.93, 7° gives
            // 2.93–3.43. The relationship is nowhere near 1:1 with the ratio, because this adds
            // in quadrature on top of BodyIdle's own 2° shoulder and a coherent-noise signal's
            // RMS is about 0.23 of its peak — which is exactly why the number was measured.
            const peak = 6.0 * Math.PI / 180;

            this.scratchRig.setFromAxisAngle( this.axis, peak * this.noise.at( this.elapsedSeconds ) );

            for ( const boneName of bones ) {

                toBoneDeltaFrame( this.scratchRig, this.restFrames.get( boneName ), this.scratchDelta );

                this.contribution.rotateBone( boneName, this.scratchDelta );

            }

            return this.contribution;

        }

        reset() {

            this.elapsedSeconds = 0;

        }

    } )();

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
