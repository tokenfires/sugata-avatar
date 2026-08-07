/**
 * Sway — postural sway and weight shift, the two things a standing body never stops doing.
 *
 * Quiet standing is not stillness. It is a continuous, low-frequency balance correction with a
 * very specific spectrum, plus a sparse series of larger weight shifts. This layer produces both
 * and keeps them separate, because they are measured separately and they mean different things:
 * the balance band is physiology, the weight shifts are *behaviour* and belong to the
 * conversation.
 *
 *
 * 🎯 SWAY IS AN INVERTED PENDULUM ABOUT THE ANKLES, NOT A BEND IN THE SPINE
 *
 * The version this replaced modelled sway as a spine bend: it declared spine_01..03 and the neck
 * and nothing else. Every head statistic it was gated on passed. It still failed the only test
 * that matters, and the diagnosis was unambiguous — a per-pixel temporal-sigma heat map over 600
 * frames of full-body idle was DEAD BLACK below the hips, with a hard horizontal cut at the hip
 * line while the arm a centimetre away glowed. Measured pelvis, calf and foot world path over
 * 20 s: exactly 0.0000 mm. A living torso bolted to a statue's legs.
 *
 * Quiet-stance balance is an ANKLE STRATEGY. The body rotates about the ankles as a near-rigid
 * inverted pendulum; the trunk barely participates. So the rotation is authored at the bottom of
 * the chain and everything above it — pelvis, knees, spine, head — TRANSLATES as a consequence.
 * The head excursion the literature reports is then an OUTPUT of the pendulum rather than the
 * thing this file authors, which is what makes the lower body move without changing a single one
 * of the validated head numbers: the wanted head displacement is still stated in millimetres, and
 * the pendulum angle that produces it is solved for from the rig's own geometry.
 *
 * The rig is hip-rooted — the legs hang off the pelvis — so an ankle-rooted rotation is written
 * as three things that together are one rigid rotation about the ankle line:
 *
 *   1. the pelvis rotates by the lean, carrying spine, arms, head AND legs with it;
 *   2. the pelvis translates so the rotation pivots about the ankles rather than about itself;
 *   3. each foot counter-rotates by the same lean, so the soles stay flat on the floor.
 *
 * See `PIVOT_HEIGHT_FRACTION_OF_ANKLE` and `planted feet` below for how the last millimetre of
 * that is kept honest without foot IK.
 *
 *
 * THE BALANCE BAND — Quijoux et al. 2021, force-plate column (§7 of the research doc)
 *
 *     measure                ML      AP
 *     frequency mode (Hz)    0.33    0.27
 *     f50 median power (Hz)  0.43    0.42
 *     f95 (Hz)               1.09    1.23
 *     RMS distance (mm)      3.0     4.9
 *
 * 95% of the power sits below 1.1–1.3 Hz and ESSENTIALLY NOTHING sits above 2 Hz. Anything
 * faster than that does not read as balance, it reads as tremor — the fastest way to make a
 * standing avatar look ill.
 *
 * AP is consistently 1.5–2× ML in amplitude, in velocity AND in high-frequency content. Sway is
 * not isotropic and making it isotropic is visible: an isotropic wobble reads as floating.
 *
 * 🎯 THE ANISOTROPY IS THE CLAIM, SO IT IS WHAT THE DEFAULTS ARE CENTRED ON. The punch-list gate
 * widens the RMS to 3–5 mm ML and 5–7 mm AP, spanning the Wii-board and force-plate protocols.
 * Sitting on both midpoints — 4.0 and 6.0 mm — would mean a design ratio of exactly 1.50, the
 * BOTTOM EDGE of the measured 1.5–2.0 anisotropy, and the sampling scatter of an RMS estimate
 * then puts half of all runs below 1.5, i.e. outside the finding. So AP takes its gate midpoint
 * and ML is derived from the anisotropy MIDPOINT of 1.75 instead: 6.04 mm AP, 3.45 mm ML.
 *
 * 🚩 One honest approximation. The literature figure is centre-of-pressure RMS at the floor;
 * this layer applies the same amplitude as the horizontal excursion of the HEAD, because that is
 * the part of the sway a viewer actually sees and because a body swaying as a near-rigid
 * inverted pendulum moves its head at least as far as its centre of pressure. The gate measures
 * head excursion, so the two agree by construction — but they are not the same quantity, and a
 * future critic comparing against a force plate needs to know that.
 *
 * ⚠️ That approximation does NOT carry over to the weight shifts below. See POSTURE_HEAD_TRANSFER.
 *
 *
 * HOW THE SPECTRUM IS BUILT
 *
 * Two bands of gradient noise, summed. Gradient noise at lattice rate f puts its spectral mode
 * near 0.5f and its f95 near 0.94f — measured, not assumed (see the band constants below). One
 * band cannot hit both a 0.3 Hz mode and a 1.1 Hz f95: the low band sets the mode, the upper
 * band supplies the tail. The band frequencies and weights below were found by sweeping against
 * the four measured statistics and are verified by the selftest's FFT, not by eye.
 *
 *
 * WEIGHT SHIFTS — Duarte & Zatsiorsky 1999, 30 min unconstrained standing
 *
 *     pattern                        AP interval   AP amplitude   ML interval   ML amplitude
 *     fidgeting (fast, returns)       59 ± 15 s         —          49 ± 16 s         —
 *     shifting (fast, new region)    316 ± 292 s     17 ± 15 mm   199 ± 148 s    22 ± 38 mm
 *     drifting (slow, continuous)    319 ± 173 s        —         529 ± 333 s        —
 *
 * ≈ 1.0/min AP and 1.2/min ML fidget; 0.19/min AP and 0.30/min ML shift; drift 0.19 and 0.11/min.
 *
 * A weight shift is not a lean. It is the pelvis travelling over the stance foot with the lumbar
 * spine counter-bending above it — contrapposto — and the figure package already has that pose
 * authored and reasoned about in `figure/poses/weight-left.json` and `weight-right.json`. The
 * medio-lateral half of the shift process therefore drives a blend toward those poses rather
 * than more pendulum lean; see STANCE_BLEND_LIMIT for how it is scaled so the head still lands
 * POSTURE_HEAD_TRANSFER says it should.
 *
 *
 * 🎯 WHY markDiscourseBoundary() EXISTS, AND WHY IT IS NOT A TIMER
 *
 * Cassell et al. 2001, 70.5 minutes double-coded: a posture shift accompanies **26% of discourse
 * boundaries that coincide with a speaker change**, but only **8% of turn boundaries that are not
 * discourse boundaries**. The shift lands *at* the topic change.
 *
 * That coupling is a large part of why an avatar reads as UNDERSTANDING rather than ANIMATING.
 * A posture shift on a timer is decoration; the same shift, same amplitude, same duration, fired
 * at the moment the topic turns, is read by a viewer as the body agreeing with the mind. It is
 * the cheapest legibility win in the whole motion stack and it costs one call from the dialogue
 * layer. Do not replace it with a scheduler.
 *
 * The Duarte idle rates continue underneath regardless — a listener who is not at a boundary
 * still fidgets — and the two independently-measured background rates agree: Cassell's
 * conversational 1.4–1.6 shifts/min and Duarte's force-plate ~1/min fidget rate.
 */

import { Quaternion, Vector3 } from 'three';

import { Layer } from './Layer.js';
import { MOTION_ORDER } from './MotionStack.js';
import { CoherentNoise1D } from './Signals.js';
import { restRotationRelativeToRig, toBoneDeltaFrame } from './Breath.js';
import { HUMANOID_TO_FIGURE_BONE } from '../figure/Skeleton.js';
import { RestPose } from '../figure/RestPose.js';

// --- measured constants ------------------------------------------------------------------

/**
 * Balance-band shape. `frequencyHz` is the noise lattice rate, which is about twice the spectral
 * mode it produces — that factor is measured, not theoretical.
 *
 * Verified by FFT over eight seeds, 300 s each (Welch, 34 s Hann segments):
 *
 *     axis  bands                        mode    f50     f95     >2 Hz
 *     ML    0.66 @1.0 + 1.60 @0.5        0.330   0.388   1.066   0.09%
 *     AP    0.62 @1.0 + 1.90 @0.5        0.300   0.370   1.263   0.18%
 *
 * against targets ML 0.33 / 0.43 / 1.09 and AP 0.27 / 0.42 / 1.23. AP's higher upper band is
 * what gives it the greater high-frequency content the literature reports.
 */
const BALANCE_BANDS_MEDIO_LATERAL = [
    { frequencyHz: 0.66, weight: 1.0 },
    { frequencyHz: 1.60, weight: 0.5 }
];

const BALANCE_BANDS_ANTERO_POSTERIOR = [
    { frequencyHz: 0.62, weight: 1.0 },
    { frequencyHz: 1.90, weight: 0.5 }
];

/**
 * The RMS of either band sum at unit weight, measured over eight seeds × 300 s: 0.3142 (ML) and
 * 0.3141 (AP). Dividing by it makes the amplitude options below mean literal millimetres.
 */
const BALANCE_BAND_UNIT_RMS = 0.314;

/**
 * AP sits at the midpoint of its gate range (5–7 mm); ML is AP divided by 1.75, the midpoint of
 * the measured 1.5–2.0 anisotropy, rather than at its own gate midpoint. See the file header for
 * why centring the RATIO matters more than centring both amplitudes. Metres.
 */
const BALANCE_RMS_ANTERO_POSTERIOR_METRES = 0.00604;
const BALANCE_ANISOTROPY_ANTERO_POSTERIOR_OVER_MEDIO_LATERAL = 1.75;
const BALANCE_RMS_MEDIO_LATERAL_METRES =
    BALANCE_RMS_ANTERO_POSTERIOR_METRES / BALANCE_ANISOTROPY_ANTERO_POSTERIOR_OVER_MEDIO_LATERAL;

/** Duarte & Zatsiorsky 1999, derived rates, events per second. */
const FIDGET_RATE_MEDIO_LATERAL = 1.2 / 60;
const FIDGET_RATE_ANTERO_POSTERIOR = 1.0 / 60;
const SHIFT_RATE_MEDIO_LATERAL = 0.30 / 60;
const SHIFT_RATE_ANTERO_POSTERIOR = 0.19 / 60;

/** Duarte & Zatsiorsky 1999, shift amplitudes, metres. Mean and SD, both reported. */
const SHIFT_AMPLITUDE_MEDIO_LATERAL_METRES = 0.022;
const SHIFT_AMPLITUDE_MEDIO_LATERAL_SD_METRES = 0.038;
const SHIFT_AMPLITUDE_ANTERO_POSTERIOR_METRES = 0.017;
const SHIFT_AMPLITUDE_ANTERO_POSTERIOR_SD_METRES = 0.015;

/** Duarte & Zatsiorsky 1999, drift intervals as frequencies: 529 s ML, 319 s AP. */
const DRIFT_FREQUENCY_MEDIO_LATERAL_HZ = 1 / 529;
const DRIFT_FREQUENCY_ANTERO_POSTERIOR_HZ = 1 / 319;

/** Cassell et al. 2001. The two numbers Rea actually used. */
const SHIFT_PROBABILITY_AT_SPEAKER_CHANGE = 0.26;
const SHIFT_PROBABILITY_AT_PLAIN_TURN_BOUNDARY = 0.08;

// --- tuning constants, with no primary support -------------------------------------------

/**
 * TUNING. Duarte reports fidget *intervals* but no fidget amplitude, and a fidget is by
 * definition smaller than a shift because it returns to the same region. Half the shift
 * amplitude is the assumption; it is visible in the selftest's event report if it is wrong.
 */
const FIDGET_AMPLITUDE_FRACTION_OF_SHIFT = 0.5;

/** TUNING. How long a fidget's out-and-back takes. "Fast" is all Duarte says. */
const FIDGET_DURATION_SECONDS = 1.4;

/** TUNING. How long a shift takes to settle into its new region. */
const SHIFT_SETTLE_SECONDS = 0.8;

/**
 * 🚩 TUNING, and the single most consequential number in the weight-shift half of this file.
 *
 * Everything in the block above is a CENTRE-OF-PRESSURE amplitude at the floor. For the balance
 * band, treating COP excursion as head excursion is a fair approximation (see the file header):
 * quiet sway really is a near-rigid inverted pendulum, so the head travels at least as far as
 * the COP. A WEIGHT SHIFT is not that motion at all. Loading one leg drives the pelvis sideways
 * over the loaded foot and the trunk counter-leans above it; the COP moves 22 mm and the head,
 * which is what the counter-lean exists to keep still, moves a fraction of that — and not
 * necessarily in the same direction.
 *
 * No coefficient for that transfer is in the record, so this is the assumption, and it is the
 * one to attack first if the idle stance looks wrong. It is chosen so that the weight shifts are
 * a PERTURBATION on the balance band rather than a replacement for it. The version this replaced
 * had no transfer at all, and measured over 8 seeds × 60/300/900 s windows the shift process on
 * its own then contributed 6–14 mm RMS of head excursion against a 4–6 mm balance band: it
 * swamped the measured sway, inverted its anisotropy (Duarte's ML shifts are the larger ones,
 * and the literature's ML sway is the smaller one) and put the default layer outside its own
 * gate on 18 of those 24 combinations. Measured, not assumed — `sway.selftest.mjs` prints the
 * matrix on every run.
 *
 * Duarte's amplitudes stay literal above and `axis.displacement` stays in COP millimetres, so a
 * critic can still compare the event process against the paper. The transfer is applied once,
 * where posture becomes head displacement.
 */
const POSTURE_HEAD_TRANSFER = 0.20;

/**
 * TUNING. How fast a shifted stance leaks back toward centre. Without this the random walk
 * eventually walks the avatar out of frame; with it, a stance holds for something like half a
 * minute — long enough to read as a decision rather than a spring.
 *
 * It is also the term that sets how much shift variance accumulates, which is why it is one of
 * the three constants the sway retune touched: for jumps arriving at rate λ and decaying over τ,
 * the stationary variance is λ·τ·E[A²]/2, so the accumulated stance grows as the square root of
 * this number. The previous 45 s gave a stance 22% wider than 30 s does, for no gain that a
 * viewer could name.
 */
const SHIFT_RETURN_SECONDS = 30;

/**
 * TUNING. Hard limit on the accumulated posture offset, in COP metres. Well inside a real limit
 * of stability; the point is that an idle avatar should not wander, not that it cannot. Duarte's
 * ML shift amplitude has an SD of 38 mm on a mean of 22 mm, so without this clamp a single draw
 * from the tail can put the stance somewhere no standing human goes.
 */
const POSTURE_OFFSET_LIMIT_MEDIO_LATERAL_METRES = 0.030;
const POSTURE_OFFSET_LIMIT_ANTERO_POSTERIOR_METRES = 0.022;

/**
 * TUNING. Drift amplitude, in COP metres. Duarte reports drift intervals but no amplitude.
 *
 * The first version had ML larger than AP, which is backwards: the one thing the sway literature
 * is emphatic about is that AP exceeds ML on every measure it reports. These carry the same 1.75
 * anisotropy the balance band does, so the slow drift cannot quietly undo it over a long run.
 */
const DRIFT_AMPLITUDE_ANTERO_POSTERIOR_METRES = 0.007;
const DRIFT_AMPLITUDE_MEDIO_LATERAL_METRES =
    DRIFT_AMPLITUDE_ANTERO_POSTERIOR_METRES / BALANCE_ANISOTROPY_ANTERO_POSTERIOR_OVER_MEDIO_LATERAL;

/**
 * TUNING. How much of the trunk's lean the neck takes back, so the head stays nearer vertical
 * than the chest. Head stabilisation in quiet stance is real but weak — it is much stronger
 * during locomotion — and no coefficient for quiet standing is in the record. Set to 0 to sway
 * as a rigid plank, which is closer to the literature and slightly worse to look at.
 */
const HEAD_STABILISATION = 0.3;

/**
 * 🎯 TUNING, and the number that decides whether this layer has a lower body at all.
 *
 * The fraction of the total lean carried as a rigid rotation about the ankles. The remainder is
 * shared down the spine by SPINE_SHARE. The posturography literature treats quiet-stance balance
 * as a SINGLE inverted pendulum — 1.0 here — and a value near that is what makes the pelvis,
 * knees and feet move at all.
 *
 * It is not set to exactly 1.0 because a perfectly rigid plank reads as a mannequin on a hinge:
 * multi-segment models of quiet stance do find a small trunk contribution in phase with the
 * ankle, and 15% of the lean spread over three spine joints is under a hundredth of a degree
 * each — invisible as a bend, but enough to keep the silhouette from looking welded.
 */
const PENDULUM_ANKLE_SHARE = 0.85;

/**
 * TUNING. How the spine's small remaining share is distributed. Weighting the lower spine most
 * makes what little trunk motion there is start from the base rather than fold in the middle.
 */
const SPINE_SHARE = [ 0.5, 0.3, 0.2 ];

/**
 * 🚩 TUNING. Where the pendulum actually pivots, as a fraction of the way from the sole to the
 * ankle joint. 1.0 is the talocrural joint itself; 0.0 is the floor.
 *
 * The anatomical pivot is the ankle joint, and a pivot exactly there is geometrically tidy: the
 * ankle then does not move at all, so the foot is planted for free. That is also slightly false.
 * A real foot is not a rigid link welded to the ground — the heel pad compresses as the centre
 * of pressure travels under it, and the shank's instantaneous centre of rotation sits a little
 * below the malleolus. The midpoint between the two defensible extremes is the assumption here.
 *
 * What it buys: the ankle joint gets a real, non-zero path — of the order of a tenth of a
 * millimetre — instead of a mathematical zero, and the sole slides by the same tenth of a
 * millimetre, which is comfortably inside skin-and-heel-pad compliance. Nothing a viewer can see
 * depends on this number; it exists so the model is honest about which idealisation it made.
 */
const PIVOT_HEIGHT_FRACTION_OF_ANKLE = 0.5;

/**
 * 🎯 TUNING. The upper bound on how far toward full contrapposto a weight shift may blend.
 *
 * The blend is normally solved for, not clamped: the medio-lateral half of the shift process
 * asks for a head displacement (POSTURE_HEAD_TRANSFER × the COP offset) and the blend that
 * delivers exactly that displacement is what gets used, measured against the pose on the actual
 * rig at bind. At the ML posture cap of 30 mm that solve lands near 0.10 — a tenth of the way to
 * a full life-class contrapposto, which moves the pelvis about 4 mm and the head about 6 mm.
 *
 * This limit only bites if a future rig makes the pose's head response much smaller than the one
 * it was authored on, and it exists so that a bad measurement produces a stiff avatar rather
 * than one that throws itself into a full contrapposto every three minutes.
 */
const STANCE_BLEND_LIMIT = 0.20;

/**
 * The blend the pose response is measured at during bind.
 *
 * A pose response is not quite linear in the blend, so the probe is placed where the runtime
 * peaks rather than at a round number: measured over twelve seeds the shift process reaches
 * 0.104 and no further. Probing there rather than at 0.25 halved the worst-case planting
 * residue — the selftest's foot-lift figure went from 0.057 mm to 0.026 mm on that change alone,
 * and what is left is second-order pendulum terms rather than anything the pose did.
 */
const STANCE_RESPONSE_PROBE_BLEND = 0.10;

/**
 * Rig-space anatomical axes, verified on figure_g050.glb (2026-08-07): +X is the character's
 * left-right axis, +Y is up, +Z is forward — the nose sits at z = +0.144 and the toes at
 * z = +0.139, against a heel at z = +0.022.
 *
 * A sagittal (forward/back) lean is therefore a rotation about +X, and a frontal (side-to-side)
 * lean is a rotation about +Z.
 */
const RIG_MEDIO_LATERAL_AXIS = new Vector3( 1, 0, 0 );
const RIG_FORWARD_AXIS = new Vector3( 0, 0, 1 );

/**
 * The chain this layer drives, parent first.
 *
 * This table IS the model. Read top to bottom it says: the pelvis carries the lean, the spine
 * takes a token share of it, the neck gives a little back, and both legs ride along so the
 * pendulum reaches the floor. `pendulum` names which of the four roles a joint plays.
 *
 * Arms, hands and the head itself are deliberately absent. The contrapposto poses do move the
 * upper arms by a couple of degrees and level the head, but at the blends this layer reaches
 * that is under half a degree, and claiming those channels would put Sway into a permanent
 * channel conflict with BodyIdle, IdleMotion and Gaze for a motion nobody can see.
 */
const SWAY_CHAIN = [
    { humanoid: 'hips', parent: null, pendulum: 'lean' },
    { humanoid: 'spine', parent: 'hips', pendulum: 'spine' },
    { humanoid: 'chest', parent: 'spine', pendulum: 'spine' },
    { humanoid: 'upperChest', parent: 'chest', pendulum: 'spine' },
    { humanoid: 'neck', parent: 'upperChest', pendulum: 'headStabilisation' },
    { humanoid: 'leftUpperLeg', parent: 'hips', pendulum: 'carried' },
    { humanoid: 'leftLowerLeg', parent: 'leftUpperLeg', pendulum: 'carried' },
    { humanoid: 'leftFoot', parent: 'leftLowerLeg', pendulum: 'plant' },
    { humanoid: 'rightUpperLeg', parent: 'hips', pendulum: 'carried' },
    { humanoid: 'rightLowerLeg', parent: 'rightUpperLeg', pendulum: 'carried' },
    { humanoid: 'rightFoot', parent: 'rightLowerLeg', pendulum: 'plant' }
];

/** The two feet, and which pose loads each of them. Used for planting and for the stance blend. */
const STANCE_FEET = [
    { key: 'left', foot: 'leftFoot', shank: 'leftLowerLeg' },
    { key: 'right', foot: 'rightFoot', shank: 'rightLowerLeg' }
];

/**
 * The per-axis constants gathered into one shape, so `advanceAxis` reads as one process
 * parameterised by which axis it is running rather than as two copies of the same code.
 */
const MEDIO_LATERAL_SETTINGS = {
    key: 'medioLateral',
    fidgetRate: FIDGET_RATE_MEDIO_LATERAL,
    shiftRate: SHIFT_RATE_MEDIO_LATERAL,
    shiftAmplitude: SHIFT_AMPLITUDE_MEDIO_LATERAL_METRES,
    shiftAmplitudeSd: SHIFT_AMPLITUDE_MEDIO_LATERAL_SD_METRES,
    driftFrequencyHz: DRIFT_FREQUENCY_MEDIO_LATERAL_HZ,
    driftAmplitude: DRIFT_AMPLITUDE_MEDIO_LATERAL_METRES,
    limit: POSTURE_OFFSET_LIMIT_MEDIO_LATERAL_METRES,

    // A weight shift is a LATERAL load transfer, so only this axis relays one. An antero-
    // posterior shift is a lean into or away from the conversation, and the arm swing a
    // consumer plays on the relay is a lateral motion that would read as a flinch if a
    // fore-and-aft shift triggered it.
    relaysWeightShift: true
};

const ANTERO_POSTERIOR_SETTINGS = {
    key: 'anteroPosterior',
    fidgetRate: FIDGET_RATE_ANTERO_POSTERIOR,
    shiftRate: SHIFT_RATE_ANTERO_POSTERIOR,
    shiftAmplitude: SHIFT_AMPLITUDE_ANTERO_POSTERIOR_METRES,
    shiftAmplitudeSd: SHIFT_AMPLITUDE_ANTERO_POSTERIOR_SD_METRES,
    driftFrequencyHz: DRIFT_FREQUENCY_ANTERO_POSTERIOR_HZ,
    driftAmplitude: DRIFT_AMPLITUDE_ANTERO_POSTERIOR_METRES,
    limit: POSTURE_OFFSET_LIMIT_ANTERO_POSTERIOR_METRES,
    relaysWeightShift: false
};

export class Sway extends Layer {

    /**
     * @param {Object} [options]
     * @param {number} [options.balanceRmsMedioLateralMetres=0.00345] - Wanted RMS excursion of
     *   the reference marker. The pendulum angle that produces it is solved for at bind.
     * @param {number} [options.balanceRmsAnteroPosteriorMetres=0.00604]
     * @param {number} [options.headStabilisation=0.3]
     * @param {number} [options.anklePendulumShare=0.85] - Fraction of the lean carried as a
     *   rigid rotation about the ankles. See PENDULUM_ANKLE_SHARE.
     * @param {number[]} [options.spineShare=[0.5,0.3,0.2]] - How the remaining share is spread
     *   down the three spine joints. Must sum to 1.
     * @param {boolean} [options.weightShiftsEnabled=true] - Turn off to measure the balance band
     *   on its own. The gates are stated against the layer AS CONSTRUCTED, not against this.
     * @param {boolean} [options.stanceBlendEnabled=true] - Turn off to keep the weight shifts as
     *   pure pendulum lean, without the contrapposto pose blend.
     * @param {number} [options.postureHeadTransfer=0.20] - Fraction of a centre-of-pressure
     *   weight shift that reaches the head. See POSTURE_HEAD_TRANSFER before changing it.
     * @param {Function} [options.onWeightShift] - Called as `({ magnitude, axis })` at the
     *   instant a shift begins. `magnitude` is the drawn amplitude over the measured mean,
     *   signed by direction, which is exactly what BodyIdle.onWeightShift() wants.
     * @param {string} [options.referenceBone='head'] - The marker the stated balance amplitude
     *   is realised at.
     * @param {Object} [options.bones] - Overrides for the figure bone behind any humanoid name
     *   in SWAY_CHAIN, e.g. `{ hips: 'root_hips' }`. Everything not named keeps the standard
     *   mapping.
     */
    constructor( options = {} ) {

        const boneNameOf = ( humanoidName ) =>
            options.bones?.[ humanoidName ] ?? HUMANOID_TO_FIGURE_BONE[ humanoidName ];

        super( {
            name: options.name ?? 'sway',
            order: MOTION_ORDER.SWAY,
            boneChannels: SWAY_CHAIN.map( ( joint ) => boneNameOf( joint.humanoid ) )
        } );

        this.referenceBoneName = options.referenceBone ?? HUMANOID_TO_FIGURE_BONE.head;

        this.anklePendulumShare = options.anklePendulumShare ?? PENDULUM_ANKLE_SHARE;
        this.spineShare = options.spineShare ?? SPINE_SHARE;
        this.headStabilisation = options.headStabilisation ?? HEAD_STABILISATION;

        this.balanceRmsMedioLateral = options.balanceRmsMedioLateralMetres ?? BALANCE_RMS_MEDIO_LATERAL_METRES;
        this.balanceRmsAnteroPosterior = options.balanceRmsAnteroPosteriorMetres ?? BALANCE_RMS_ANTERO_POSTERIOR_METRES;

        this.weightShiftsEnabled = options.weightShiftsEnabled ?? true;
        this.stanceBlendEnabled = options.stanceBlendEnabled ?? true;
        this.postureHeadTransfer = options.postureHeadTransfer ?? POSTURE_HEAD_TRANSFER;

        /** Called at the instant a lateral shift begins. See the constructor options. */
        this.onWeightShift = options.onWeightShift ?? null;

        this.elapsedSeconds = 0;

        // The three signals, all in metres, all horizontal displacement of the reference marker.
        // Kept apart because the gates are stated against `balance` alone and because a critic
        // reading "the avatar drifted 30 mm" needs to know which process did it.
        this.balanceDisplacement = new Vector3();  // continuous, the measured spectrum
        this.postureDisplacement = new Vector3();  // fidget + shift + drift, after the transfer
        this.displacement = new Vector3();         // the sum, which is what gets posed

        // What is left for the pendulum once the contrapposto blend has delivered its share.
        this.pendulumDisplacement = new Vector3();

        // Signed: positive blends toward 'weight-left', negative toward 'weight-right'.
        this.stanceBlend = 0;

        // Per-axis weight-shift state. Two identical structures rather than one interleaved
        // one, because AP and ML are independent processes with different measured rates. Each
        // carries its own settings so the shared advance/shift code never has to ask which axis
        // it is running.
        this.medioLateral = createAxisState( MEDIO_LATERAL_SETTINGS );
        this.anteroPosterior = createAxisState( ANTERO_POSTERIOR_SETTINGS );

        this.eventCounts = { fidget: 0, shift: 0, discourseShift: 0 };

        // Built in onBind from the layer's own stream, so a reset reproduces the run exactly.
        this.balanceNoise = { medioLateral: [], anteroPosterior: [] };
        this.driftNoise = { medioLateral: null, anteroPosterior: null };

        // The poses the weight shift blends between. Compiled once here rather than at bind
        // because they are figure-independent: a pose is a statement in the normalised humanoid
        // frame and costs nothing to hold.
        this.relaxedPose = RestPose.load( 'relaxed-standing' );
        this.stancePoses = { left: RestPose.load( 'weight-left' ), right: RestPose.load( 'weight-right' ) };

        // One entry per driven joint, in SWAY_CHAIN order, each holding its bone name, its role,
        // its rest frame and its own preallocated scratch. Built here, filled at bind.
        this.joints = SWAY_CHAIN.map( ( entry ) => createJointState( entry, boneNameOf( entry.humanoid ) ) );
        this.jointsByHumanoid = new Map( this.joints.map( ( joint ) => [ joint.humanoid, joint ] ) );

        this.accumulateRelaxedPose();

        // The two feet, with the per-frame planting arithmetic they each need.
        this.feet = STANCE_FEET.map( ( foot ) => ( {
            key: foot.key,
            joint: this.jointsByHumanoid.get( foot.foot ),
            shank: this.jointsByHumanoid.get( foot.shank ),
            pendulumArm: new Vector3()
        } ) );

        // Bind-time rig facts.
        this.pivot = new Vector3();               // where the pendulum turns, in rig space
        this.pelvisArm = new Vector3();           // pelvis rest position relative to the pivot
        this.pelvisParentFrameInverse = new Quaternion();
        this.effectiveLeverMetres = 1;            // reference displacement per radian of lean
        this.pendulumPlanted = false;             // false on a rig with no feet to pivot about

        // Per-unit-blend response of the contrapposto, measured on this rig at bind.
        this.stanceResponse = {
            left: createStanceResponse(),
            right: createStanceResponse()
        };

        this.ankleRotation = new Quaternion();
        this.scratchRigRotation = new Quaternion();
        this.scratchAxisRotation = new Quaternion();
        this.scratchBoneDelta = new Quaternion();
        this.scratchDisplacement = new Vector3();
        this.scratchOffset = new Vector3();
        this.scratchStance = new Vector3();
        this.scratchPelvisTravel = new Vector3();

    }

    // --- action -----------------------------------------------------------------------------

    /**
     * Tells the layer that the conversation just crossed a boundary. Call this from the dialogue
     * layer at the moment the topic turns, NOT on a schedule — see the file header.
     *
     * @param {Object} [boundary]
     * @param {boolean} [boundary.speakerChanged=false] - True when the boundary coincides with a
     *   change of speaker, which is the case Cassell measured at 26%. A turn boundary that is not
     *   a discourse boundary is the 8% case.
     * @returns {boolean} Whether a shift was actually triggered. Most boundaries produce none;
     *   that is the finding, not a bug.
     */
    markDiscourseBoundary( { speakerChanged = false } = {} ) {

        if ( this.random === null ) return false;

        const probability = speakerChanged
            ? SHIFT_PROBABILITY_AT_SPEAKER_CHANGE
            : SHIFT_PROBABILITY_AT_PLAIN_TURN_BOUNDARY;

        if ( this.random.chance( probability ) === false ) return false;

        // A posture shift is a whole-body event, so both axes move. ML carries the larger
        // amplitude, which is what a weight transfer onto one leg looks like.
        this.beginShift( this.medioLateral );
        this.beginShift( this.anteroPosterior );

        this.eventCounts.discourseShift ++;

        return true;

    }

    onBind( context ) {

        this.buildNoise();
        this.resolveRigGeometry( context.target );
        this.measureStanceResponse( context.target );

    }

    update( deltaSeconds, context ) { // eslint-disable-line no-unused-vars

        this.elapsedSeconds += deltaSeconds;

        this.balanceDisplacement.set(
            this.sampleBalanceBand( this.balanceNoise.medioLateral, this.balanceRmsMedioLateral ),
            0,
            this.sampleBalanceBand( this.balanceNoise.anteroPosterior, this.balanceRmsAnteroPosterior )
        );

        if ( this.weightShiftsEnabled ) {

            this.advanceAxis( this.medioLateral, deltaSeconds );
            this.advanceAxis( this.anteroPosterior, deltaSeconds );

        }

        // The per-axis state is in centre-of-pressure metres, because that is the unit Duarte
        // measured in; this is the one place it becomes head displacement.
        const transfer = this.weightShiftsEnabled ? this.postureHeadTransfer : 0;

        this.postureDisplacement.set(
            transfer * this.medioLateral.displacement,
            0,
            transfer * this.anteroPosterior.displacement
        );

        this.displacement.copy( this.balanceDisplacement ).add( this.postureDisplacement );

        // The contrapposto delivers the lateral part of the weight shift as an articulated
        // pose; whatever it does not deliver — all of the balance band, and the fore-and-aft
        // posture — is left for the pendulum. Splitting it here rather than adding the two is
        // what keeps the head landing exactly where `displacement` says it should.
        this.stanceBlend = this.solveStanceBlend();
        this.resolvePendulumDisplacement();

        this.writePose();

        return this.contribution;

    }

    reset() {

        this.elapsedSeconds = 0;

        this.balanceDisplacement.set( 0, 0, 0 );
        this.postureDisplacement.set( 0, 0, 0 );
        this.displacement.set( 0, 0, 0 );
        this.pendulumDisplacement.set( 0, 0, 0 );

        this.stanceBlend = 0;

        this.medioLateral = createAxisState( MEDIO_LATERAL_SETTINGS );
        this.anteroPosterior = createAxisState( ANTERO_POSTERIOR_SETTINGS );

        this.eventCounts = { fidget: 0, shift: 0, discourseShift: 0 };

    }

    // --- signal -------------------------------------------------------------------------------

    /**
     * Noise tables are drawn from the layer's own stream at bind, which MotionStack rewinds
     * before every reset — so the same seed gives the same 60 seconds of sway, every run.
     */
    buildNoise() {

        const seedFor = () => this.random.integer( 0, 0x7fffffff );

        this.balanceNoise.medioLateral = BALANCE_BANDS_MEDIO_LATERAL.map(
            ( band ) => ( { band, noise: new CoherentNoise1D( seedFor(), 512 ) } ) );

        this.balanceNoise.anteroPosterior = BALANCE_BANDS_ANTERO_POSTERIOR.map(
            ( band ) => ( { band, noise: new CoherentNoise1D( seedFor(), 512 ) } ) );

        this.driftNoise.medioLateral = new CoherentNoise1D( seedFor(), 512 );
        this.driftNoise.anteroPosterior = new CoherentNoise1D( seedFor(), 512 );

    }

    sampleBalanceBand( bands, rmsMetres ) {

        let total = 0;

        for ( const { band, noise } of bands ) {

            total += band.weight * noise.at( this.elapsedSeconds * band.frequencyHz );

        }

        return total * ( rmsMetres / BALANCE_BAND_UNIT_RMS );

    }

    /**
     * One axis of weight-shift behaviour for one frame: the slow drift, any fidget in progress,
     * the settled shift baseline, and the Poisson draws that start new events.
     */
    advanceAxis( axis, deltaSeconds ) {

        const settings = axis.settings;

        // New events. Poisson, because these are memoryless arrivals at a measured mean rate.
        if ( this.random.poissonEventOccurs( settings.fidgetRate, deltaSeconds ) ) {

            axis.fidgetRemaining = FIDGET_DURATION_SECONDS;
            axis.fidgetAmplitude = this.drawAmplitude( settings ) * FIDGET_AMPLITUDE_FRACTION_OF_SHIFT;
            this.eventCounts.fidget ++;

        }

        if ( this.random.poissonEventOccurs( settings.shiftRate, deltaSeconds ) ) {

            this.beginShift( axis );

        }

        // A fidget is a single out-and-back, so a raised cosine over its whole duration.
        let fidget = 0;

        if ( axis.fidgetRemaining > 0 ) {

            axis.fidgetRemaining = Math.max( axis.fidgetRemaining - deltaSeconds, 0 );

            const progress = 1 - axis.fidgetRemaining / FIDGET_DURATION_SECONDS;
            fidget = axis.fidgetAmplitude * 0.5 * ( 1 - Math.cos( 2 * Math.PI * progress ) );

        }

        // A shift settles toward its new region, then that region leaks slowly back to centre.
        axis.shiftTarget *= Math.exp( -deltaSeconds / SHIFT_RETURN_SECONDS );
        axis.shiftCurrent += ( axis.shiftTarget - axis.shiftCurrent )
            * ( 1 - Math.exp( -deltaSeconds / SHIFT_SETTLE_SECONDS ) );

        const drift = settings.driftAmplitude
            * this.driftNoise[ settings.key ].at( this.elapsedSeconds * settings.driftFrequencyHz );

        const total = axis.shiftCurrent + fidget + drift;

        axis.displacement = Math.min( Math.max( total, -settings.limit ), settings.limit );

    }

    /**
     * Starts a shift on one axis, and tells anyone listening the instant it happens.
     *
     * The callback carries the DRAWN amplitude rather than a bare "a shift occurred", because a
     * consumer scaling an arm swing to the shift needs to know whether this was a 5 mm settle or
     * a 60 mm transfer. Watching `eventCounts` instead — which is what integrations had to do
     * before this existed — loses the magnitude and arrives a frame late.
     */
    beginShift( axis ) {

        const settings = axis.settings;
        const direction = this.random.chance( 0.5 ) ? 1 : -1;
        const amplitude = this.drawAmplitude( settings ) * direction;

        // A shift moves to a NEW region, so it is drawn as a signed displacement away from where
        // the stance already is rather than as an absolute position.
        axis.shiftTarget += amplitude;
        axis.shiftTarget = Math.min( Math.max( axis.shiftTarget, -settings.limit ), settings.limit );

        this.eventCounts.shift ++;

        if ( this.onWeightShift !== null && settings.relaysWeightShift ) {

            this.onWeightShift( {
                magnitude: amplitude / settings.shiftAmplitude,
                axis: settings.key
            } );

        }

    }

    /** Duarte reports mean ± SD, so amplitudes are gaussian, floored at a tenth of the mean. */
    drawAmplitude( settings ) {

        const drawn = this.random.gaussian( settings.shiftAmplitude, settings.shiftAmplitudeSd );

        return Math.max( Math.abs( drawn ), settings.shiftAmplitude * 0.1 );

    }

    /**
     * How far toward a contrapposto this frame's lateral weight shift has moved the body.
     *
     * Solved rather than tuned: the shift process states a wanted head displacement in metres,
     * the pose's head response per unit blend was measured on this rig at bind, and the blend is
     * the ratio. That keeps the authored, validated head amplitude intact while moving the
     * pelvis over the stance foot — which is what a weight shift actually is.
     */
    solveStanceBlend() {

        if ( this.stanceBlendEnabled === false || this.weightShiftsEnabled === false ) return 0;

        const wantedMedioLateral = this.postureDisplacement.x;
        const response = wantedMedioLateral >= 0 ? this.stanceResponse.left : this.stanceResponse.right;

        if ( response.usable === false ) return 0;

        const blend = wantedMedioLateral / response.head.x;

        return Math.min( Math.max( blend, 0 ), STANCE_BLEND_LIMIT ) * Math.sign( wantedMedioLateral );

    }

    /** Whatever head displacement the contrapposto did not deliver is the pendulum's to produce. */
    resolvePendulumDisplacement() {

        this.pendulumDisplacement.copy( this.displacement );

        if ( this.stanceBlend === 0 ) return;

        const response = this.stanceBlend > 0 ? this.stanceResponse.left : this.stanceResponse.right;

        this.pendulumDisplacement.x -= Math.abs( this.stanceBlend ) * response.head.x;
        this.pendulumDisplacement.z -= Math.abs( this.stanceBlend ) * response.head.z;

    }

    // --- posing -------------------------------------------------------------------------------

    /**
     * Reads the rig facts the pendulum needs: every driven joint's rest frame and rest world
     * position, where the pendulum pivots, and how far the reference marker moves per radian.
     *
     * The pivot is the midpoint of the two ankle joints, dropped toward the sole by
     * PIVOT_HEIGHT_FRACTION_OF_ANKLE. The effective lever is then the share-weighted sum of each
     * contributing joint's height below the marker — the ankle share acting from the pivot, the
     * spine shares from their own joints, and the neck's counter-rotation folded in with a
     * negative share — to first order in the angle, which at a quarter of a degree is exact to
     * five decimal places.
     *
     * Note that the heights are read from the pose the figure is in when this runs. On the first
     * bind that is the rest pose. On a `MotionStack.reset()` mid-run it is a leaned pose, which
     * shifts the lever by well under a tenth of a millimetre at these angles — worth knowing
     * about, not worth correcting.
     */
    resolveRigGeometry( target ) {

        for ( const joint of this.joints ) {

            joint.bone = target.getBone( joint.boneName );

            restRotationRelativeToRig( joint.bone, null, joint.restFrame );
            worldPositionOf( joint.bone, joint.restPosition );

        }

        const referenceBone = target.getBone( this.referenceBoneName );
        const referenceHeight = worldPositionOf( referenceBone, this.scratchDisplacement ).y;

        this.resolvePivot();

        let lever = this.pendulumPlanted
            ? this.anklePendulumShare * ( referenceHeight - this.pivot.y )
            : 0;

        // A rig with no feet cannot pivot about them, so the whole lean falls back to the spine
        // and the layer behaves as its predecessor did. The stack's missing-channel report names
        // the actual cause; this just keeps the geometry finite.
        const spineParticipation = this.pendulumPlanted ? 1 - this.anklePendulumShare : 1;

        this.spineJoints().forEach( ( joint, index ) => {

            joint.share = spineParticipation * this.spineShare[ index ];
            lever += joint.share * ( referenceHeight - joint.restPosition.y );

        } );

        const neck = this.jointsByHumanoid.get( 'neck' );

        if ( neck.bone !== null && neck.bone !== undefined ) {

            lever -= this.headStabilisation * ( referenceHeight - neck.restPosition.y );

        }

        // A degenerate rig — no reference bone, or every driven joint at the marker's height —
        // would divide by zero and fling the figure. One metre keeps the layer harmless.
        this.effectiveLeverMetres = Math.abs( lever ) > 1e-4 ? lever : 1;

        const pelvis = this.jointsByHumanoid.get( 'hips' );

        this.pelvisArm.copy( pelvis.restPosition ).sub( this.pivot );
        restRotationRelativeToRig( pelvis.bone?.parent ?? null, null, this.pelvisParentFrameInverse ).invert();

        for ( const foot of this.feet ) {

            foot.pendulumArm.copy( foot.joint.restPosition ).sub( this.pivot );

        }

    }

    /**
     * The pendulum's pivot: between the ankles, and between the ankle joint and the sole.
     *
     * The sole's height is taken from the toe joint rather than assumed to be y = 0, so a figure
     * placed anywhere in the scene pivots about its own feet rather than about the world origin.
     */
    resolvePivot() {

        const left = this.jointsByHumanoid.get( 'leftFoot' );
        const right = this.jointsByHumanoid.get( 'rightFoot' );

        this.pendulumPlanted = isPresent( left.bone ) && isPresent( right.bone );

        if ( this.pendulumPlanted === false ) {

            this.pivot.set( 0, 0, 0 );
            return;

        }

        this.pivot.copy( left.restPosition ).add( right.restPosition ).multiplyScalar( 0.5 );

        const soleHeight = Math.min(
            toeHeightOf( left.bone, this.scratchDisplacement ),
            toeHeightOf( right.bone, this.scratchDisplacement )
        );

        this.pivot.y = soleHeight + PIVOT_HEIGHT_FRACTION_OF_ANKLE * ( this.pivot.y - soleHeight );

    }

    /**
     * Measures what the contrapposto poses actually do to THIS rig, in millimetres.
     *
     * The poses are authored against the figure's proportions, so the only way to convert "a
     * 22 mm centre-of-pressure shift" into a blend is to ask the rig. Both poses are applied at a
     * probe blend, the head and both ankles are read, and the result is divided back to a
     * per-unit-blend response. The two sides are measured separately because the poses are
     * deliberately asymmetric — a real body does not shift identically both ways.
     *
     * This drives the real bones for the length of the measurement and puts every one of them
     * back exactly as it found it. The stack captured its rest pose before onBind ran, so a
     * perfect restore is invisible to it; an imperfect one would silently bias every absolute
     * measurement in the stack, which is why the snapshot is taken from the bones themselves
     * rather than reconstructed.
     */
    measureStanceResponse( target ) {

        const head = target.getBone( this.referenceBoneName );
        const feet = this.feet;

        for ( const side of [ 'left', 'right' ] ) {

            const response = this.stanceResponse[ side ];

            response.usable = false;
            response.head.set( 0, 0, 0 );
            response.ankle.left.set( 0, 0, 0 );
            response.ankle.right.set( 0, 0, 0 );

        }

        if ( isPresent( head ) === false ) return;

        const snapshot = this.joints
            .filter( ( joint ) => isPresent( joint.bone ) )
            .map( ( joint ) => ( {
                joint,
                quaternion: joint.bone.quaternion.clone(),
                position: joint.bone.position.clone()
            } ) );

        const restHead = worldPositionOf( head, new Vector3() );

        for ( const side of [ 'left', 'right' ] ) {

            const response = this.stanceResponse[ side ];

            this.buildStanceRotations( STANCE_RESPONSE_PROBE_BLEND, side );
            this.applyStanceToBones( STANCE_RESPONSE_PROBE_BLEND, side, snapshot );

            response.head.copy( worldPositionOf( head, this.scratchDisplacement ) ).sub( restHead )
                .divideScalar( STANCE_RESPONSE_PROBE_BLEND );

            for ( const foot of feet ) {

                response.ankle[ foot.key ]
                    .copy( worldPositionOf( foot.joint.bone, this.scratchDisplacement ) )
                    .sub( foot.joint.restPosition )
                    .divideScalar( STANCE_RESPONSE_PROBE_BLEND );

            }

            for ( const entry of snapshot ) {

                entry.joint.bone.quaternion.copy( entry.quaternion );
                entry.joint.bone.position.copy( entry.position );

            }

            // A pose that barely moves the head sideways cannot be solved for a blend without
            // dividing by something close to zero, so the blend is simply not used on that rig.
            // 5 mm per unit blend is two orders below what the shipped poses produce.
            response.usable = Math.abs( response.head.x ) > 0.005;

        }

        for ( const entry of snapshot ) {

            entry.joint.bone.updateWorldMatrix( true, false );

        }

    }

    /**
     * Drives the real bones into the stance pose at `blend`, for the response measurement.
     *
     * Runs the same arithmetic the frame loop does — cumulative rotation per joint, parent's
     * taken back off to get the joint's own — so the number that comes out is the number the
     * runtime will reproduce, not an independent derivation that might drift from it.
     */
    applyStanceToBones( blend, side, snapshot ) {

        for ( const entry of snapshot ) {

            const joint = entry.joint;
            const parent = joint.parent === null ? null : this.jointsByHumanoid.get( joint.parent );

            joint.rigRotation.copy( joint.stanceCumulative );

            if ( parent !== null ) {

                this.scratchRigRotation.copy( parent.stanceCumulative ).invert();
                joint.rigRotation.premultiply( this.scratchRigRotation );

            }

            toBoneDeltaFrame( joint.rigRotation, joint.restFrame, this.scratchBoneDelta );
            joint.bone.quaternion.copy( entry.quaternion ).multiply( this.scratchBoneDelta );

        }

        const pelvis = this.jointsByHumanoid.get( 'hips' );
        const pelvisEntry = snapshot.find( ( entry ) => entry.joint === pelvis );

        if ( pelvisEntry === undefined ) return;

        this.stanceHipsOffset( blend, side, this.scratchOffset );
        this.scratchOffset.applyQuaternion( this.pelvisParentFrameInverse );
        pelvis.bone.position.copy( pelvisEntry.position ).add( this.scratchOffset );

    }

    /**
     * Turns the wanted displacement into a lean, distributes it, and writes every channel.
     *
     * Sign convention, derived from the rig-space axes and confirmed by measuring the reference
     * marker's world displacement in the selftest: a positive rotation about the rig's
     * medio-lateral axis (+X) carries the trunk toward +Z, which is forward. A lateral lean is
     * therefore a rotation about the FORWARD axis, and it moves the marker toward -X, so its
     * angle is negated.
     */
    writePose() {

        const leanAnteroPosterior = this.pendulumDisplacement.z / this.effectiveLeverMetres;
        const leanMedioLateral = -this.pendulumDisplacement.x / this.effectiveLeverMetres;

        this.buildPendulumRotations( leanAnteroPosterior, leanMedioLateral );
        this.buildStanceRotations( Math.abs( this.stanceBlend ), this.stanceBlend >= 0 ? 'left' : 'right' );

        for ( const joint of this.joints ) {

            if ( isPresent( joint.bone ) === false ) continue;

            if ( joint.pendulum === 'plant' ) {

                // The foot ends the chain at its rest orientation whatever the body did above
                // it — that is the whole of "the sole stays flat" in one line, and it overrides
                // the contrapposto's own foot angles on purpose. Those angles exist in the pose
                // file to level the sole after the shank swings; levelling it exactly is
                // strictly better, and it is the only version that survives a millimetre gate.
                joint.cumulative.identity();
                continue;

            }

            // Pendulum outside, pose inside: the body takes its stance, then the whole thing
            // tips. At these angles the two commute to five decimal places, so the order is a
            // statement of intent rather than a correctness constraint.
            joint.cumulative.multiplyQuaternions( joint.pendulumCumulative, joint.stanceCumulative );

        }

        for ( const joint of this.joints ) {

            if ( isPresent( joint.bone ) === false ) continue;

            const parent = joint.parent === null ? null : this.jointsByHumanoid.get( joint.parent );

            joint.rigRotation.copy( joint.cumulative );

            if ( parent !== null ) {

                this.scratchRigRotation.copy( parent.cumulative ).invert();
                joint.rigRotation.premultiply( this.scratchRigRotation );

            }

            toBoneDeltaFrame( joint.rigRotation, joint.restFrame, this.scratchBoneDelta );
            this.contribution.rotateBone( joint.boneName, this.scratchBoneDelta );

        }

        this.writePelvisTravel();
        this.writeFootPlanting();

    }

    /**
     * The rigid rotation about the ankles, the spine's token share of it, the neck's give-back,
     * and the counter-rotation that keeps the soles flat — as one cumulative rotation per joint.
     */
    buildPendulumRotations( leanAnteroPosterior, leanMedioLateral ) {

        const ankleShare = this.pendulumPlanted ? this.anklePendulumShare : 0;

        this.composeRigRotation( leanAnteroPosterior * ankleShare, leanMedioLateral * ankleShare );
        this.ankleRotation.copy( this.scratchRigRotation );

        for ( const joint of this.joints ) {

            const parent = joint.parent === null ? null : this.jointsByHumanoid.get( joint.parent );

            switch ( joint.pendulum ) {

                case 'lean':
                    joint.pendulumCumulative.copy( this.ankleRotation );
                    break;

                case 'spine':
                    this.composeRigRotation( leanAnteroPosterior * joint.share, leanMedioLateral * joint.share );
                    joint.pendulumCumulative.multiplyQuaternions( parent.pendulumCumulative, this.scratchRigRotation );
                    break;

                case 'headStabilisation':
                    this.composeRigRotation(
                        -leanAnteroPosterior * this.headStabilisation,
                        -leanMedioLateral * this.headStabilisation
                    );
                    joint.pendulumCumulative.multiplyQuaternions( parent.pendulumCumulative, this.scratchRigRotation );
                    break;

                default:
                    // 'carried' and 'plant' — the leg rides the pelvis and adds nothing of its
                    // own. The foot's counter-rotation is applied in writePose(), against the
                    // pose as well as the lean.
                    joint.pendulumCumulative.copy( parent.pendulumCumulative );

            }

        }

    }

    /**
     * The contrapposto, as a cumulative rig-space rotation per joint.
     *
     * A pose states one rotation per bone in the normalised humanoid frame, and those accumulate
     * down the chain. The rotation this layer contributes is the difference between where the
     * blended pose puts a bone and where relaxed-standing puts it — so at blend 0 every joint is
     * identity no matter what pose the figure is actually resting in, which is the only sane
     * semantics for a layer that adds to a stack rather than replacing it.
     */
    buildStanceRotations( blend, side ) {

        if ( blend === 0 ) {

            for ( const joint of this.joints ) joint.stanceCumulative.identity();

            return;

        }

        const pose = this.stancePoses[ side ];

        for ( const joint of this.joints ) {

            const parent = joint.parent === null ? null : this.jointsByHumanoid.get( joint.parent );

            const from = this.relaxedPose.rotationFor( joint.humanoid ) ?? IDENTITY;
            const to = pose.rotationFor( joint.humanoid ) ?? IDENTITY;

            this.scratchRigRotation.copy( from ).slerp( to, blend );

            if ( parent === null ) {

                joint.stanceAccumulated.copy( this.scratchRigRotation );

            } else {

                joint.stanceAccumulated.multiplyQuaternions( parent.stanceAccumulated, this.scratchRigRotation );

            }

            joint.stanceCumulative.multiplyQuaternions( joint.stanceAccumulated, joint.relaxedAccumulatedInverse );

        }

    }

    /**
     * The relaxed pose's accumulated rotation at each joint, inverted, cached once.
     *
     * This is what makes the contrapposto a DELTA rather than a pose: subtracting it means blend
     * 0 contributes identity everywhere, whatever stance the figure is actually resting in. A
     * layer that replaced the rest pose instead would silently discard everything the posture
     * layer and every other contributor had said.
     */
    accumulateRelaxedPose() {

        for ( const joint of this.joints ) {

            const parent = joint.parent === null ? null : this.jointsByHumanoid.get( joint.parent );
            const own = this.relaxedPose.rotationFor( joint.humanoid ) ?? IDENTITY;

            if ( parent === null ) {

                joint.relaxedAccumulated.copy( own );

            } else {

                joint.relaxedAccumulated.multiplyQuaternions( parent.relaxedAccumulated, own );

            }

            joint.relaxedAccumulatedInverse.copy( joint.relaxedAccumulated ).invert();

        }

    }

    /**
     * Moves the pelvis. Two things live here and they are the reason the lower body moves at all:
     * the arc the pelvis travels because the body is turning about the ankles rather than about
     * its own hip joints, and the lateral travel over the stance foot that a weight shift is.
     */
    writePelvisTravel() {

        const pelvis = this.jointsByHumanoid.get( 'hips' );

        if ( isPresent( pelvis.bone ) === false ) return;

        // r' - r for the pelvis on the end of the pendulum arm. Written as the full rotation
        // rather than the small-angle cross product because it costs the same and stays exact.
        this.scratchOffset.copy( this.pelvisArm ).applyQuaternion( this.ankleRotation ).sub( this.pelvisArm );

        if ( this.stanceBlend !== 0 ) {

            this.stanceHipsOffset(
                Math.abs( this.stanceBlend ),
                this.stanceBlend > 0 ? 'left' : 'right',
                this.scratchDisplacement
            );

            this.scratchOffset.add( this.scratchDisplacement );

        }

        this.scratchOffset.applyQuaternion( this.pelvisParentFrameInverse );

        this.contribution.offsetBone( pelvis.boneName, this.scratchOffset.x, this.scratchOffset.y, this.scratchOffset.z );

    }

    /** The pelvis travel the contrapposto asks for, in rig space, at a given blend. */
    stanceHipsOffset( blend, side, target ) {

        return target
            .copy( this.relaxedPose.hipsOffset )
            .lerp( this.stancePoses[ side ].hipsOffset, blend )
            .sub( this.relaxedPose.hipsOffset );

    }

    /**
     * 🎯 Keeps both feet on the floor, in millimetres, without foot IK.
     *
     * Two residues have to go, and they are different problems:
     *
     *   VERTICAL. A body cannot rigidly rotate about a fore-and-aft axis and keep two laterally
     *   separated feet both flat — one ankle rises and the other falls by half the stance width
     *   times the lean. That is not a bug in the model, it is what medio-lateral balance IS: the
     *   load transfers between the legs and the loaded one shortens. Cancelling it at the ankle
     *   is the cheapest available stand-in for that leg-length change, and it is under a
     *   millimetre.
     *
     *   HORIZONTAL, from the pose. The contrapposto poses were authored without IK and move the
     *   feet by up to 20 mm at full blend — the pose files say so, and say why. At the blends
     *   this layer reaches that is a couple of millimetres, and it is pinned out here so the
     *   planted foot is planted regardless of what the pose does.
     *
     * What is deliberately NOT cancelled is the horizontal residue of the pendulum itself: the
     * ankle sits a little above the pivot, so it travels a tenth of a millimetre as the body
     * rocks, and the sole slides with it. See PIVOT_HEIGHT_FRACTION_OF_ANKLE — that residue is
     * the model being honest rather than the model being wrong.
     */
    writeFootPlanting() {

        for ( const foot of this.feet ) {

            if ( isPresent( foot.joint.bone ) === false ) continue;

            // The arc this ankle rides because the body is turning about a pivot below it.
            this.scratchDisplacement.copy( foot.pendulumArm )
                .applyQuaternion( this.ankleRotation )
                .sub( foot.pendulumArm );

            this.stanceAnkleTravel( foot, this.scratchStance );

            this.scratchOffset.set(
                -this.scratchStance.x,
                -( this.scratchDisplacement.y + this.scratchStance.y ),
                -this.scratchStance.z
            );

            // A bone's offset is read in its parent's space, so the correction goes into the
            // shank's frame AS POSED — rest frame times everything the lean and the pose did to
            // it. Using the rest frame alone would leave a couple of hundredths of a millimetre
            // of the correction pointing the wrong way, which is the difference between a gate
            // that says "planted" and one that says "nearly".
            this.scratchBoneDelta.multiplyQuaternions( foot.shank.cumulative, foot.shank.restFrame ).invert();
            this.scratchOffset.applyQuaternion( this.scratchBoneDelta );

            this.contribution.offsetBone(
                foot.joint.boneName, this.scratchOffset.x, this.scratchOffset.y, this.scratchOffset.z );

        }

    }

    /**
     * Where the contrapposto alone would put one ankle this frame, in rig space.
     *
     * The pose response was measured with no lean applied, so it cannot simply be added to the
     * pendulum's arc: everything below the pelvis rides the lean, and the pelvis's own travel
     * does not. Splitting the measured displacement into the part the pelvis translated and the
     * part the legs articulated, and rotating only the second by the lean, is what makes the two
     * processes compose exactly instead of leaving a cross term behind.
     */
    stanceAnkleTravel( foot, target ) {

        if ( this.stanceBlend === 0 ) return target.set( 0, 0, 0 );

        const blend = Math.abs( this.stanceBlend );
        const side = this.stanceBlend > 0 ? 'left' : 'right';

        this.stanceHipsOffset( blend, side, this.scratchPelvisTravel );

        return target
            .copy( this.stanceResponse[ side ].ankle[ foot.key ] )
            .multiplyScalar( blend )
            .sub( this.scratchPelvisTravel )
            .applyQuaternion( this.ankleRotation )
            .add( this.scratchPelvisTravel );

    }

    /** A sagittal lean and a frontal lean, composed into one rig-space rotation. */
    composeRigRotation( anteroPosteriorRadians, medioLateralRadians ) {

        this.scratchRigRotation.setFromAxisAngle( RIG_MEDIO_LATERAL_AXIS, anteroPosteriorRadians );
        this.scratchAxisRotation.setFromAxisAngle( RIG_FORWARD_AXIS, medioLateralRadians );

        // At well under a degree the two rotations commute to five decimal places, so the order
        // here is a readability choice rather than a correctness one.
        this.scratchRigRotation.multiply( this.scratchAxisRotation );

    }

    // --- helpers ------------------------------------------------------------------------------

    spineJoints() {

        return this.joints.filter( ( joint ) => joint.pendulum === 'spine' );

    }

}

// --- local helpers ----------------------------------------------------------------------------

const IDENTITY = new Quaternion();

function createAxisState( settings ) {

    return {
        settings,
        displacement: 0,   // metres, this frame
        shiftTarget: 0,    // where the stance is heading
        shiftCurrent: 0,   // where the stance is now
        fidgetRemaining: 0,
        fidgetAmplitude: 0
    };

}

/**
 * One driven joint. Everything a frame needs is preallocated here, because the frame loop walks
 * eleven of these and allocating a quaternion per joint per frame is exactly the kind of cost
 * that never gets found later because it never looks like the problem.
 */
function createJointState( entry, boneName ) {

    return {
        humanoid: entry.humanoid,
        parent: entry.parent,
        pendulum: entry.pendulum,
        boneName,
        bone: null,
        share: 0,

        restFrame: new Quaternion(),
        restPosition: new Vector3(),
        relaxedAccumulated: new Quaternion(),
        relaxedAccumulatedInverse: new Quaternion(),

        pendulumCumulative: new Quaternion(),
        stanceAccumulated: new Quaternion(),
        stanceCumulative: new Quaternion(),
        cumulative: new Quaternion(),
        rigRotation: new Quaternion()
    };

}

function createStanceResponse() {

    return {
        usable: false,
        head: new Vector3(),
        ankle: { left: new Vector3(), right: new Vector3() }
    };

}

function isPresent( bone ) {

    return bone !== null && bone !== undefined;

}

function worldPositionOf( bone, target ) {

    if ( isPresent( bone ) === false ) return target.set( 0, 0, 0 );

    bone.updateWorldMatrix( true, false );

    return target.setFromMatrixPosition( bone.matrixWorld );

}

/**
 * The height of the sole under one foot, taken from the toe joint when the rig has one. The toe
 * sits lower than the ankle and close to the ground, which makes it a better floor probe than
 * assuming y = 0 — a figure standing on a plinth still pivots about its own feet.
 */
function toeHeightOf( footBone, scratch ) {

    const toe = footBone.children.find( ( child ) => child.isBone === true ) ?? footBone;

    return worldPositionOf( toe, scratch ).y;

}
