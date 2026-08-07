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
 * The punch-list gate widens the RMS to 3–5 mm ML and 5–7 mm AP, spanning the Wii-board and
 * force-plate protocols, so the defaults here are the midpoints: 4.0 mm ML, 6.0 mm AP. Ratio
 * 1.5, at the bottom of the measured anisotropy range.
 *
 * 🚩 One honest approximation. The literature figure is centre-of-pressure RMS at the floor;
 * this layer applies the same amplitude as the horizontal excursion of the HEAD, because that is
 * the part of the sway a viewer actually sees and because a body swaying as a near-rigid
 * inverted pendulum moves its head at least as far as its centre of pressure. The gate measures
 * head excursion, so the two agree by construction — but they are not the same quantity, and a
 * future critic comparing against a force plate needs to know that.
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

/** Midpoints of the punch-list gate ranges (3–5 mm ML, 5–7 mm AP). Metres. */
const BALANCE_RMS_MEDIO_LATERAL_METRES = 0.0040;
const BALANCE_RMS_ANTERO_POSTERIOR_METRES = 0.0060;

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
 * TUNING. How fast a shifted stance leaks back toward centre. Without this the random walk
 * eventually walks the avatar out of frame; with it, a stance holds for the better part of a
 * minute — long enough to read as a decision rather than a spring.
 */
const SHIFT_RETURN_SECONDS = 45;

/**
 * TUNING. Hard limit on the accumulated posture offset, metres. Well inside a real limit of
 * stability; the point is that an idle avatar should not wander, not that it cannot.
 */
const POSTURE_OFFSET_LIMIT_MEDIO_LATERAL_METRES = 0.035;
const POSTURE_OFFSET_LIMIT_ANTERO_POSTERIOR_METRES = 0.025;

/** TUNING. Drift amplitude, metres. Duarte reports drift intervals but no amplitude. */
const DRIFT_AMPLITUDE_MEDIO_LATERAL_METRES = 0.006;
const DRIFT_AMPLITUDE_ANTERO_POSTERIOR_METRES = 0.005;

/**
 * TUNING. How much of the trunk's lean the neck takes back, so the head stays nearer vertical
 * than the chest. Head stabilisation in quiet stance is real but weak — it is much stronger
 * during locomotion — and no coefficient for quiet standing is in the record. Set to 0 to sway
 * as a rigid plank, which is closer to the literature and slightly worse to look at.
 */
const HEAD_STABILISATION = 0.3;

/**
 * TUNING. How the lean is shared down the spine. Weighting the lower spine most makes the trunk
 * lean from the base rather than bending in the middle, which is what an ankle-strategy sway
 * looks like from the chest up.
 */
const DEFAULT_LEAN_SHARE = [ 0.5, 0.3, 0.2 ];

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
    limit: POSTURE_OFFSET_LIMIT_MEDIO_LATERAL_METRES
};

const ANTERO_POSTERIOR_SETTINGS = {
    key: 'anteroPosterior',
    fidgetRate: FIDGET_RATE_ANTERO_POSTERIOR,
    shiftRate: SHIFT_RATE_ANTERO_POSTERIOR,
    shiftAmplitude: SHIFT_AMPLITUDE_ANTERO_POSTERIOR_METRES,
    shiftAmplitudeSd: SHIFT_AMPLITUDE_ANTERO_POSTERIOR_SD_METRES,
    driftFrequencyHz: DRIFT_FREQUENCY_ANTERO_POSTERIOR_HZ,
    driftAmplitude: DRIFT_AMPLITUDE_ANTERO_POSTERIOR_METRES,
    limit: POSTURE_OFFSET_LIMIT_ANTERO_POSTERIOR_METRES
};

export class Sway extends Layer {

    /**
     * @param {Object} [options]
     * @param {number} [options.balanceRmsMedioLateralMetres=0.0040]
     * @param {number} [options.balanceRmsAnteroPosteriorMetres=0.0060]
     * @param {number} [options.headStabilisation=0.3]
     * @param {number[]} [options.leanShare=[0.5,0.3,0.2]] - Must sum to 1 and match `bones.lean`.
     * @param {boolean} [options.weightShiftsEnabled=true] - Turn off to measure the balance band
     *   on its own, which is what the punch-list RMS and spectrum gates are stated against.
     * @param {Object} [options.bones] - `{ lean: string[], neck, reference }`. `reference` is the
     *   marker the stated amplitude is realised at, and defaults to the head.
     */
    constructor( options = {} ) {

        const leanBoneNames = options.bones?.lean ?? [
            HUMANOID_TO_FIGURE_BONE.spine,
            HUMANOID_TO_FIGURE_BONE.chest,
            HUMANOID_TO_FIGURE_BONE.upperChest
        ];
        const neckBoneName = options.bones?.neck ?? HUMANOID_TO_FIGURE_BONE.neck;

        super( {
            name: options.name ?? 'sway',
            order: MOTION_ORDER.SWAY,
            boneChannels: [ ...leanBoneNames, neckBoneName ]
        } );

        this.leanBoneNames = leanBoneNames;
        this.neckBoneName = neckBoneName;
        this.referenceBoneName = options.bones?.reference ?? HUMANOID_TO_FIGURE_BONE.head;

        this.leanShare = options.leanShare ?? DEFAULT_LEAN_SHARE;

        if ( this.leanShare.length !== leanBoneNames.length ) {

            throw new Error(
                `Sway: leanShare has ${ this.leanShare.length } entries for ${ leanBoneNames.length } lean bones. ` +
                'One share per bone, summing to 1 — the shares are how the lean is distributed down the spine.'
            );

        }

        this.headStabilisation = options.headStabilisation ?? HEAD_STABILISATION;

        this.balanceRmsMedioLateral = options.balanceRmsMedioLateralMetres ?? BALANCE_RMS_MEDIO_LATERAL_METRES;
        this.balanceRmsAnteroPosterior = options.balanceRmsAnteroPosteriorMetres ?? BALANCE_RMS_ANTERO_POSTERIOR_METRES;

        this.weightShiftsEnabled = options.weightShiftsEnabled ?? true;

        this.elapsedSeconds = 0;

        // The three signals, all in metres, all horizontal displacement of the reference marker.
        // Kept apart because the gates are stated against `balance` alone and because a critic
        // reading "the avatar drifted 30 mm" needs to know which process did it.
        this.balanceDisplacement = new Vector3();  // continuous, the measured spectrum
        this.postureDisplacement = new Vector3();  // fidget + shift + drift
        this.displacement = new Vector3();         // the sum, which is what gets posed

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

        // Bind-time rig facts.
        this.leanBoneFrames = [];      // rest rotation of each lean bone, relative to the rig
        this.neckBoneFrame = new Quaternion();
        this.effectiveLeverMetres = 1; // reference-marker displacement per radian of total lean

        this.scratchRigRotation = new Quaternion();
        this.scratchAxisRotation = new Quaternion();
        this.scratchBoneDelta = new Quaternion();

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

        this.postureDisplacement.set(
            this.weightShiftsEnabled ? this.medioLateral.displacement : 0,
            0,
            this.weightShiftsEnabled ? this.anteroPosterior.displacement : 0
        );

        this.displacement.copy( this.balanceDisplacement ).add( this.postureDisplacement );

        this.writeLean();

        return this.contribution;

    }

    reset() {

        this.elapsedSeconds = 0;

        this.balanceDisplacement.set( 0, 0, 0 );
        this.postureDisplacement.set( 0, 0, 0 );
        this.displacement.set( 0, 0, 0 );

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

    beginShift( axis ) {

        const settings = axis.settings;

        // A shift moves to a NEW region, so it is drawn as a signed displacement away from where
        // the stance already is rather than as an absolute position.
        axis.shiftTarget += this.drawAmplitude( settings ) * ( this.random.chance( 0.5 ) ? 1 : -1 );
        axis.shiftTarget = Math.min( Math.max( axis.shiftTarget, -settings.limit ), settings.limit );

        this.eventCounts.shift ++;

    }

    /** Duarte reports mean ± SD, so amplitudes are gaussian, floored at a tenth of the mean. */
    drawAmplitude( settings ) {

        const drawn = this.random.gaussian( settings.shiftAmplitude, settings.shiftAmplitudeSd );

        return Math.max( Math.abs( drawn ), settings.shiftAmplitude * 0.1 );

    }

    // --- posing -------------------------------------------------------------------------------

    /**
     * Reads the rig facts the lean maths needs: each lean bone's rest frame, and how far the
     * reference marker moves per radian of total lean.
     *
     * The effective lever is the share-weighted sum of each bone's height below the marker, to
     * first order in the angle — which at half a degree is exact to five decimal places. The
     * neck's counter-rotation is folded in with a negative share, so `effectiveLeverMetres`
     * remains the one number that converts a wanted displacement into a total lean angle.
     *
     * Note that the heights are read from the pose the figure is in when this runs. On the first
     * bind that is the rest pose. On a `MotionStack.reset()` mid-run it is a leaned pose, which
     * shifts the lever by well under a tenth of a millimetre at these angles — worth knowing
     * about, not worth correcting.
     */
    resolveRigGeometry( target ) {

        this.leanBoneFrames = [];

        const referenceBone = target.getBone( this.referenceBoneName );
        const referenceHeight = worldHeightOf( referenceBone );

        let lever = 0;

        this.leanBoneNames.forEach( ( boneName, index ) => {

            const bone = target.getBone( boneName );

            this.leanBoneFrames.push( restRotationRelativeToRig( bone ) );

            if ( bone === null || bone === undefined ) return;

            lever += this.leanShare[ index ] * ( referenceHeight - worldHeightOf( bone ) );

        } );

        const neckBone = target.getBone( this.neckBoneName );
        this.neckBoneFrame = restRotationRelativeToRig( neckBone );

        if ( neckBone !== null && neckBone !== undefined ) {

            lever -= this.headStabilisation * ( referenceHeight - worldHeightOf( neckBone ) );

        }

        // A degenerate rig — no reference bone, or every lean bone at the marker's height —
        // would divide by zero and fling the figure. One metre keeps the layer harmless and the
        // stack's missing-channel report names the actual cause.
        this.effectiveLeverMetres = Math.abs( lever ) > 1e-4 ? lever : 1;

    }

    /**
     * Turns the wanted horizontal displacement into a lean, shares it down the spine, and takes
     * a fraction of it back at the neck.
     *
     * Sign convention, derived from the rig-space axes and confirmed by measuring the reference
     * marker's world displacement in the selftest: a positive rotation about the rig's
     * medio-lateral axis (+X) carries the trunk toward +Z, which is forward; a positive rotation
     * about the rig's vertical axis is a yaw and is not used. Lateral lean is therefore a
     * rotation about the FORWARD axis, and it moves the marker toward -X, so its angle is
     * negated.
     */
    writeLean() {

        const leanAnteroPosterior = this.displacement.z / this.effectiveLeverMetres;
        const leanMedioLateral = -this.displacement.x / this.effectiveLeverMetres;

        this.leanBoneNames.forEach( ( boneName, index ) => {

            const share = this.leanShare[ index ];

            this.composeRigRotation( leanAnteroPosterior * share, leanMedioLateral * share );

            toBoneDeltaFrame( this.scratchRigRotation, this.leanBoneFrames[ index ], this.scratchBoneDelta );
            this.contribution.rotateBone( boneName, this.scratchBoneDelta );

        } );

        this.composeRigRotation(
            -leanAnteroPosterior * this.headStabilisation,
            -leanMedioLateral * this.headStabilisation
        );

        toBoneDeltaFrame( this.scratchRigRotation, this.neckBoneFrame, this.scratchBoneDelta );
        this.contribution.rotateBone( this.neckBoneName, this.scratchBoneDelta );

    }

    /** A sagittal lean and a frontal lean, composed into one rig-space rotation. */
    composeRigRotation( anteroPosteriorRadians, medioLateralRadians ) {

        this.scratchRigRotation.setFromAxisAngle( RIG_MEDIO_LATERAL_AXIS, anteroPosteriorRadians );
        this.scratchAxisRotation.setFromAxisAngle( RIG_FORWARD_AXIS, medioLateralRadians );

        // At well under a degree the two rotations commute to five decimal places, so the order
        // here is a readability choice rather than a correctness one.
        this.scratchRigRotation.multiply( this.scratchAxisRotation );

    }

}

// --- local helpers ----------------------------------------------------------------------------

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

function worldHeightOf( bone ) {

    if ( bone === null || bone === undefined ) return 0;

    bone.updateWorldMatrix( true, false );

    return bone.matrixWorld.elements[ 13 ];

}
