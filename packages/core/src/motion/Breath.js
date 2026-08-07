/**
 * Breath — the motion that makes a still figure read as alive rather than paused.
 *
 * A perfectly still avatar reads as dead inside about two seconds. Breath is the cheapest fix
 * and the easiest one to get wrong, because the correct amplitude is far smaller than intuition
 * says. This layer exists to keep it honest: every displacement below comes from a measured
 * table, and the one number an artist would reach for — "make the chest heave" — is the classic
 * uncanny tell.
 *
 *
 * ⚠️ AMPLITUDE IS TINY. READ THIS BEFORE TOUCHING A CONSTANT.
 *
 * Takashima 2017, VICON motion capture, tidal breathing, sitting, mean marker excursion in
 * MILLIMETRES (docs/research/body-motion-numbers.md §6):
 *
 *     site                        cranio-caudal   medio-lateral   antero-posterior
 *     anterior pulmonary ribcage       1.94           -0.34              1.91
 *     anterior abdominal ribcage       2.58            0.26              2.81
 *     left abdominal ribcage           2.19            0.96              2.11
 *     ANTERIOR ABDOMEN                 0.93            0.32              4.79
 *     left abdomen                     0.58            0.55              1.59
 *
 * At rest the ribcage surface moves about 2–3 mm antero-posteriorly and the belly about 5 mm.
 * That is the whole motion. Tidal volume 0.56 ± 0.20 L sitting. Sitting more than doubles
 * ribcage AP motion versus supine (1.91 vs 0.69 mm), so these are the *generous* numbers.
 *
 * If breathing needs to read bigger on camera, raise `exaggeration` — a single art-direction
 * multiplier that leaves the physiology constants alone and keeps this file readable as a
 * statement of fact rather than a pile of tuned magic.
 *
 *
 * RATE — 15–16 brpm, NOT the textbook 12.
 *
 * The clinical "12–20 brpm" is a convention repeated without primary support. The best modern
 * population data is KORA-FF4 (2025, n = 2,224 adults, resting ECG-derived): median 15.80 brpm,
 * IQR 3.16, 5th percentile 12.06, 95th 20.06. So resting default is 15.8 brpm ≈ 0.263 Hz.
 *
 *
 * TIMING — I:E ≈ 1:1.7, NOT the clinically-quoted 1:2.
 *
 * Measured at rest (n = 47): Ti/Ttot = 0.365, i.e. inspiration occupies 36.5% of the cycle and
 * expiration 63.5%, which is 1:1.74. Expiration lengthens disproportionately as rate falls, so
 * the ratio is a property of the resting rate rather than a constant of breathing.
 *
 *
 * WHY TRANSLATION AND NOT BONE SCALE
 *
 * The shipping trick for breath is a non-uniform scale on the chest bone plus a compensating
 * inverse scale on the neck and arms, so the head and shoulders do not inflate with the ribcage.
 * MotionStack has no scale channel — a layer states rotations and translations — so this does it
 * with translation instead, which has the compensation property by construction: translating a
 * spine bone carries its whole subtree, so the head rides up with the chest rather than growing.
 * The cost is that the back surface moves with the front; at 2.4 mm nobody has ever seen it.
 */

import { Quaternion, Vector3 } from 'three';

import { Layer } from './Layer.js';
import { MOTION_ORDER } from './MotionStack.js';
import { HUMANOID_TO_FIGURE_BONE } from '../figure/Skeleton.js';

// --- measured constants ------------------------------------------------------------------

/** KORA-FF4 (2025, n = 2,224) resting median. 15.8 brpm = 0.263 Hz. Not 12. */
const RESTING_BREATHS_PER_MINUTE = 15.8;

/**
 * Acute-stress reactivity, top tertile (Kaplan 2023, n = 55, PASAT stressor). The three tertiles
 * were −1.29, +4.02 and +9.17 brpm over baseline, so `arousal` 0.44 lands on the middle tertile
 * and 1.0 on the top — roughly 25 brpm, which is the acute-stress figure the research names.
 */
const AROUSAL_BREATHS_PER_MINUTE_GAIN = 9.17;

/** Ti/Ttot at rest. 0.365 gives I:E = 1:1.74. */
const INSPIRATORY_DUTY_CYCLE = 0.365;

/** Takashima 2017 tidal marker excursions, metres. See the table in the file header. */
const RIBCAGE_ANTERO_POSTERIOR_METRES = 0.00240; // midpoint of 1.91 and 2.81 mm
const RIBCAGE_CRANIO_CAUDAL_METRES = 0.00226;    // midpoint of 1.94 and 2.58 mm
const ABDOMEN_ANTERO_POSTERIOR_METRES = 0.00479; // anterior abdomen
const ABDOMEN_CRANIO_CAUDAL_METRES = 0.00093;    // anterior abdomen

/**
 * Compartment split of tidal motion: ribcage 47.9%, abdomen 52.1% (Tamiya 2021, n = 48). Under
 * respiratory load the ribcage share rises to 74–78%.
 *
 * The excursions above already embody the resting split, so this enters as a *modulation*: at
 * 0.479 the layer reproduces Takashima exactly, and raising it moves motion from the belly to
 * the ribcage the way the literature says loaded breathing does.
 */
const RIBCAGE_SHARE_AT_REST = 0.479;
const RIBCAGE_SHARE_UNDER_LOAD = 0.76;

/**
 * ABDOMINAL SKIN TRANSFER — measured, and the one number in this file that is a property of the
 * FIGURE rather than of breathing.
 *
 * A bone's translation does not arrive at the skin at full strength. Every vertex is a weighted
 * blend, and on the anterior abdomen the blend includes the pelvis, which never moves. Measured
 * on figure_g050.glb by driving the abdomen bone alone and reading the deformed anterior-midline
 * surface: the most responsive vertex sits at y = 1.010 m with a spine_01 skin weight of 0.68,
 * and receives 0.81 of the authored excursion once the neighbouring bones' inherited share is
 * added back. So authoring 4.79 mm lands 3.87 mm on the skin — a 19% shortfall against Takashima.
 *
 * Dividing by this makes the constants above mean "millimetres at the skin", which is the
 * quantity the paper reports. The ribcage needs no such correction: above the upper chest the
 * skin is 0.98-weighted to a single bone, so its transfer is 1.00 and is left implicit.
 *
 * ⚠️ Re-measure for a new figure. `idle-motion.selftest.mjs` prints the whole anterior-midline
 * excursion profile for exactly this purpose. It held across the whole gender sweep as shipped —
 * g000 through g100 land at 4.63–4.73 mm belly and 2.40–2.51 mm ribcage on one constant — because
 * all five bakes come out of the same MPFB2 pipeline and share their weight painting. A figure
 * from a different pipeline will not.
 */
const ABDOMEN_SKIN_TRANSFER = 0.81;

// --- tuning constants, with no primary support -------------------------------------------

/**
 * TUNING, not measured. How much deeper a fully aroused breath is than a tidal one.
 *
 * The ceiling this is chosen against: a full deep breath changes chest circumference by 2.2–2.6 cm
 * (Ile-Ife, n = 428), which is a radius change of ΔC / 2π ≈ 3.5–4.1 mm, so the AP surface
 * excursion of a *vital-capacity* breath is only about 4–8 mm. Tidal is 2.4 mm. An aroused breath
 * is not a vital-capacity breath, so the ceiling has to be approached and not crossed.
 *
 * ⚠️ This multiplier does NOT act alone. At full arousal the ribcage share also rises from 0.479
 * to 0.76, a further 1.59×, and the two compound: 2.40 mm × 1.59 × 1.8 = 6.9 mm at the sternum,
 * at the top of the deep-breath band. Raising this to the 2.5 that "twice as deep" intuition
 * suggests produced 9.5 mm — measurably a heave. Any change here must be re-measured with the
 * aroused-ribcage gate in idle-motion.selftest.mjs, not reasoned about in isolation.
 */
const AMPLITUDE_AT_FULL_AROUSAL = 1.8;

/**
 * TUNING, not measured. Breath-to-breath period variation, as a fraction of the period.
 *
 * The KORA IQR of 3.16 brpm is *between* people, not within one person, so it cannot be used
 * here. Some jitter is needed regardless: a metronomic breath reads as a machine within about
 * three cycles. 6% keeps 15.8 brpm inside roughly 14–18.
 */
const PERIOD_JITTER = 0.06;

/** Guards against a jitter draw that would stall or double the breath. */
const PERIOD_JITTER_LIMIT = 0.35;

export class Breath extends Layer {

    /**
     * @param {Object} [options]
     * @param {number} [options.restingBreathsPerMinute=15.8]
     * @param {number} [options.arousalBreathsPerMinuteGain=9.17] - Added to the rate at arousal 1.
     * @param {number} [options.amplitudeAtFullArousal=2.5] - Amplitude multiplier at arousal 1.
     * @param {number} [options.ribcageShareAtRest=0.479]
     * @param {number} [options.ribcageShareAtFullArousal=0.76] - Set equal to the resting share to
     *   disable the coupling. The 0.74–0.78 measurement is *respiratory* load, and applying it to
     *   psychological arousal is an extrapolation with no direct support — a real one, clinically
     *   observed as breathing becoming more thoracic under stress, but not a measured coefficient.
     * @param {number} [options.exaggeration=1] - Art-direction multiplier on every displacement.
     *   1 is physiological. Raise it if breath needs to read at a wide framing; the gate in
     *   docs/PUNCHLIST.md 2.5 is measured at 1.
     * @param {number} [options.abdomenSkinTransfer=0.81] - How much of the authored abdominal
     *   excursion reaches the skin on this figure. A property of the asset's weight painting, not
     *   of breathing; re-measure it when the figure pipeline changes.
     * @param {number} [options.periodJitter=0.06]
     * @param {Object} [options.bones] - `{ abdomen, ribcage }` rig bone names. Defaults to the
     *   figure's spine and chest, resolved through the humanoid map so this file holds no rig
     *   naming of its own.
     */
    constructor( options = {} ) {

        super( {
            name: options.name ?? 'breath',
            order: MOTION_ORDER.BREATH,
            boneChannels: [
                options.bones?.abdomen ?? HUMANOID_TO_FIGURE_BONE.spine,
                options.bones?.ribcage ?? HUMANOID_TO_FIGURE_BONE.chest
            ]
        } );

        this.abdomenBoneName = options.bones?.abdomen ?? HUMANOID_TO_FIGURE_BONE.spine;
        this.ribcageBoneName = options.bones?.ribcage ?? HUMANOID_TO_FIGURE_BONE.chest;

        this.restingBreathsPerMinute = options.restingBreathsPerMinute ?? RESTING_BREATHS_PER_MINUTE;
        this.arousalBreathsPerMinuteGain = options.arousalBreathsPerMinuteGain ?? AROUSAL_BREATHS_PER_MINUTE_GAIN;
        this.amplitudeAtFullArousal = options.amplitudeAtFullArousal ?? AMPLITUDE_AT_FULL_AROUSAL;
        this.ribcageShareAtRest = options.ribcageShareAtRest ?? RIBCAGE_SHARE_AT_REST;
        this.ribcageShareAtFullArousal = options.ribcageShareAtFullArousal ?? RIBCAGE_SHARE_UNDER_LOAD;
        this.exaggeration = options.exaggeration ?? 1;
        this.abdomenSkinTransfer = options.abdomenSkinTransfer ?? ABDOMEN_SKIN_TRANSFER;
        this.periodJitter = options.periodJitter ?? PERIOD_JITTER;
        this.inspiratoryDutyCycle = options.inspiratoryDutyCycle ?? INSPIRATORY_DUTY_CYCLE;

        this.arousal = 0;

        // Where we are in the current breath, on [0, 1): 0 is end-expiration, `duty` is peak
        // inspiration. Held as a phase rather than a running clock so a period change between
        // breaths does not make the current one jump.
        this.phase = 0;
        this.periodSeconds = 60 / this.restingBreathsPerMinute;
        this.breathsCompleted = 0;

        // The tidal waveform, 0 at end-expiration and 1 at peak inspiration. Readable by anything
        // that wants to phase against the breath — speech onset, a sigh, the critic's measurement.
        this.level = 0;

        // What the layer is asking for this frame, in rig space (x medio-lateral, y up, z forward),
        // in metres. These are what the selftest measures; the bone offsets below are derived.
        this.ribcageDisplacement = new Vector3();
        this.abdomenDisplacement = new Vector3();

        // Resolved at bind: the inverse of each offset bone's PARENT rest rotation, because
        // MotionStack adds a bone offset to `bone.position`, which lives in the parent's frame.
        this.abdomenParentFrameInverse = new Quaternion();
        this.ribcageParentFrameInverse = new Quaternion();

        // True when the ribcage bone hangs off the abdomen bone, which is the normal spine chain.
        // When it does, the abdomen's offset already carries the ribcage, so the ribcage is
        // written as the residual rather than as an absolute.
        this.ribcageInheritsAbdomen = false;

        this.scratchOffset = new Vector3();
        this.scratchLocalOffset = new Vector3();

    }

    // --- action -----------------------------------------------------------------------------

    /**
     * @param {number} arousal - [0, 1]. Drives rate (+0 to +9.17 brpm), depth, and the shift of
     *   tidal motion from the belly toward the ribcage.
     */
    setArousal( arousal ) {

        this.arousal = Math.min( Math.max( arousal, 0 ), 1 );

    }

    /** The rate the current breath is being taken at, in breaths per minute. */
    get breathsPerMinute() {

        return 60 / this.periodSeconds;

    }

    /** The rate arousal is asking for, before per-breath jitter. */
    get targetBreathsPerMinute() {

        return this.restingBreathsPerMinute + this.arousal * this.arousalBreathsPerMinuteGain;

    }

    onBind( context ) {

        const abdomenBone = context.target.getBone( this.abdomenBoneName );
        const ribcageBone = context.target.getBone( this.ribcageBoneName );

        // A missing bone is already reported by the stack's missing-channel list, so this only
        // has to avoid crashing on the way past.
        if ( abdomenBone !== null && abdomenBone !== undefined ) {

            restRotationRelativeToRig( abdomenBone.parent, null, this.abdomenParentFrameInverse ).invert();

        }

        if ( ribcageBone !== null && ribcageBone !== undefined ) {

            restRotationRelativeToRig( ribcageBone.parent, null, this.ribcageParentFrameInverse ).invert();

        }

        this.ribcageInheritsAbdomen = isDescendantOf( ribcageBone, abdomenBone );

    }

    update( deltaSeconds, context ) { // eslint-disable-line no-unused-vars

        this.advancePhase( deltaSeconds );

        this.level = tidalLevelAtPhase( this.phase, this.inspiratoryDutyCycle );

        this.measureDisplacements();

        // Rig-space displacement -> the parent frame each bone's position lives in.
        this.writeOffset( this.abdomenBoneName, this.abdomenDisplacement, this.abdomenParentFrameInverse );

        this.scratchOffset.copy( this.ribcageDisplacement );
        if ( this.ribcageInheritsAbdomen ) this.scratchOffset.sub( this.abdomenDisplacement );

        this.writeOffset( this.ribcageBoneName, this.scratchOffset, this.ribcageParentFrameInverse );

        return this.contribution;

    }

    reset() {

        this.phase = 0;
        this.breathsCompleted = 0;
        this.level = 0;
        this.periodSeconds = 60 / this.targetBreathsPerMinute;
        this.ribcageDisplacement.set( 0, 0, 0 );
        this.abdomenDisplacement.set( 0, 0, 0 );

    }

    // --- helpers ------------------------------------------------------------------------------

    /**
     * Walks the breath forward. The period is redrawn only when a breath completes, so a change
     * of arousal mid-breath finishes the breath it started rather than snapping.
     */
    advancePhase( deltaSeconds ) {

        this.phase += deltaSeconds / this.periodSeconds;

        while ( this.phase >= 1 ) {

            this.phase -= 1;
            this.breathsCompleted ++;
            this.periodSeconds = this.drawPeriodSeconds();

        }

    }

    drawPeriodSeconds() {

        const basePeriod = 60 / this.targetBreathsPerMinute;

        if ( this.periodJitter <= 0 || this.random === null ) return basePeriod;

        const jitter = this.random.gaussian( 0, this.periodJitter );
        const bounded = Math.min( Math.max( jitter, -PERIOD_JITTER_LIMIT ), PERIOD_JITTER_LIMIT );

        return basePeriod * ( 1 + bounded );

    }

    /**
     * The two compartment displacements for this frame, in rig space, in metres.
     *
     * The share modulation is written as a ratio against the resting share so that the default
     * settings reproduce the measured Takashima excursions exactly — a reader can check this
     * layer against the table without doing any arithmetic.
     */
    measureDisplacements() {

        const share = lerp( this.ribcageShareAtRest, this.ribcageShareAtFullArousal, this.arousal );

        const ribcageGain = share / RIBCAGE_SHARE_AT_REST;
        const abdomenGain = ( 1 - share ) / ( 1 - RIBCAGE_SHARE_AT_REST );

        const depth = this.exaggeration
            * ( 1 + this.arousal * ( this.amplitudeAtFullArousal - 1 ) )
            * this.level;

        // Cranio-caudal is taken as upward on inspiration. Takashima reports excursion magnitudes
        // without a sign; upward is the pump-handle direction for the ribcage, and at 0.93 mm the
        // abdomen's sign is below the threshold of anyone caring.
        this.ribcageDisplacement.set(
            0,
            RIBCAGE_CRANIO_CAUDAL_METRES * ribcageGain * depth,
            RIBCAGE_ANTERO_POSTERIOR_METRES * ribcageGain * depth
        );

        const abdomenAtSkin = abdomenGain * depth / this.abdomenSkinTransfer;

        this.abdomenDisplacement.set(
            0,
            ABDOMEN_CRANIO_CAUDAL_METRES * abdomenAtSkin,
            ABDOMEN_ANTERO_POSTERIOR_METRES * abdomenAtSkin
        );

    }

    writeOffset( boneName, rigSpaceDisplacement, parentFrameInverse ) {

        const local = this.scratchLocalOffset;

        local.copy( rigSpaceDisplacement ).applyQuaternion( parentFrameInverse );

        this.contribution.offsetBone( boneName, local.x, local.y, local.z );

    }

}

// --- shared geometry helpers --------------------------------------------------------------

/**
 * A bone's rest rotation relative to the rig root: the product of its own and every ancestor's
 * local rotation, stopping at `rigRoot` or at the top of the graph.
 *
 * Sway and IdleMotion import this from here. It is the same computation as the private
 * `Skeleton.restRotationRelativeToRig`, and the natural long-term home is Skeleton itself once
 * the motion target and the normalised rig merge; it lives in Breath because breath was the
 * first layer to need it and three private copies would be worse than one odd import.
 *
 * Two things it depends on, both worth knowing:
 *
 *   - It reads the pose the figure is in *right now*, so it is only meaningful at bind time,
 *     before any layer has run. Binding to a figure another stack has already been driving
 *     captures a displaced rest.
 *   - Working relative to the rig root rather than the world is what makes "forward" mean the
 *     character's forward. Turning the avatar 90° in the scene must not turn a breath into a
 *     sideways lurch.
 *
 * @param {Object3D|null} object
 * @param {Object3D|null} [rigRoot=null] - Stop here. Null walks to the top of the graph.
 * @param {Quaternion} [target]
 * @returns {Quaternion} `target`, so callers can chain `.invert()`.
 */
export function restRotationRelativeToRig( object, rigRoot = null, target = new Quaternion() ) {

    target.set( 0, 0, 0, 1 );

    for ( let node = object; node !== null && node !== undefined && node !== rigRoot; node = node.parent ) {

        target.premultiply( node.quaternion );

    }

    // The GLB stores quaternions to six decimal places, so each rest rotation is about 5e-7 off
    // unit length. Quaternion.invert() is a conjugate, which is only the true inverse of a unit
    // quaternion, so that error would compound through every frame's composition.
    return target.normalize();

}

/**
 * Rotates `rigSpaceRotation` into the frame a MotionStack bone delta is applied in.
 *
 * The stack commits `bone.quaternion = rest * delta`, so `delta` acts in the bone's own frame —
 * the one in which its rest orientation is identity. To make a bone turn by a given rotation
 * expressed in rig space, the delta has to be that rotation conjugated by the bone's rest
 * rotation: `delta = restWorld⁻¹ · rigSpaceRotation · restWorld`.
 *
 * @param {Quaternion} rigSpaceRotation - What the motion means anatomically.
 * @param {Quaternion} boneRestFrame - The bone's rest rotation relative to the rig root.
 * @param {Quaternion} target
 * @returns {Quaternion} `target`
 */
export function toBoneDeltaFrame( rigSpaceRotation, boneRestFrame, target ) {

    target.copy( boneRestFrame ).invert();
    target.multiply( rigSpaceRotation );
    target.multiply( boneRestFrame );

    return target;

}

// --- local helpers --------------------------------------------------------------------------

/**
 * The tidal waveform: a raised cosine up over the inspiratory fraction of the cycle and a longer
 * raised cosine down over the rest.
 *
 * Raised cosines rather than a sine because the two halves have to be different lengths and
 * still meet smoothly. Both halves have zero slope at both ends, so velocity is continuous
 * across the switch and across the wrap, and the flat spot at the bottom of the longer half
 * approximates the end-expiratory pause without needing a third segment.
 */
function tidalLevelAtPhase( phase, inspiratoryDutyCycle ) {

    if ( phase < inspiratoryDutyCycle ) {

        return 0.5 - 0.5 * Math.cos( Math.PI * phase / inspiratoryDutyCycle );

    }

    const expiratoryProgress = ( phase - inspiratoryDutyCycle ) / ( 1 - inspiratoryDutyCycle );

    return 0.5 + 0.5 * Math.cos( Math.PI * expiratoryProgress );

}

function isDescendantOf( candidate, ancestor ) {

    if ( candidate === null || candidate === undefined ) return false;
    if ( ancestor === null || ancestor === undefined ) return false;

    for ( let node = candidate.parent; node !== null && node !== undefined; node = node.parent ) {

        if ( node === ancestor ) return true;

    }

    return false;

}

function lerp( from, to, amount ) {

    return from + ( to - from ) * amount;

}
