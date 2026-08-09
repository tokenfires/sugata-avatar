/**
 * PostureLayer — the actuator for `ExpressionMap.body()`. Punch-list 6.2's affect half.
 *
 * 🚩 WHY THIS FILE EXISTS, STATED AS THE DEFECT IT CLOSES.
 * `ExpressionMap.body()` has computed a BAP prescription on every frame since 5.4 landed, and
 * until this file there was no reader anywhere in the tree except a HUD string. Measured on the
 * shipped page: eight `?affect=` presets, and the torso band of five of the seven non-neutral
 * plates was BIT-IDENTICAL to neutral. The face emoted; the body did not exist. R5 asks for the
 * full range of human emotion as a FULL BODY avatar, so a prescription with no actuator is the
 * requirement half-built rather than a missing nice-to-have.
 *
 *
 * WHAT IT DRIVES, AND WHAT IT DELIBERATELY DOES NOT
 * ------------------------------------------------
 * `body()` returns nine numbers. Three of them are postures and this layer owns them; the rest
 * belong to layers that do not exist yet, and naming their owners here is how it stays visible
 * that they were considered rather than forgotten:
 *
 *   approach        ✅ trunk carried forward or back, hinged at the lumbar
 *   armSpread       ✅ shoulder abduction / adduction
 *   headTiltUp      ✅ head pitch
 *   kneeActivation  ❌ a knee bend that does not also lower the pelvis is a figure standing on
 *                      stilts. Doing it right is a two-link solve plus a pelvis offset plus a foot
 *                      re-plant, which is punch-list 6.5's analytic two-bone IK. Left to 6.5.
 *   illustrative    ❌ a gesture RATE, not a pose. Punch-list 6.3, `motion/Gesture.js`.
 *   gestureAmplitude, temporalExtent   ❌ 6.4's two GRETA parameters.
 *   headAlignment, gazeAwayFraction*   ❌ gaze policy, `motion/Gaze.js`.
 *
 * ⚠️ AND ONE MORE THAT LOOKS LIKE AN OMISSION AND IS A BOUNDARY. `approach` is BAP's "forward
 * whole-body movement", and the whole-body reading of it — the centre of pressure travelling
 * toward the toes with the body rotating rigidly about the ankles — is `motion/Sway.js`'s
 * inverted pendulum, which already owns the pelvis, the legs, the feet and the footprint clamp
 * that keeps them standable. Building a second ankle pendulum here would be a duplicate model
 * that cannot see the first one's clamp, so what this layer realises is the part that is a JOINT
 * ROTATION rather than a balance problem: the trunk hinging at the lumbar, which Coulson codes
 * as its own degree of freedom and gives in degrees. The whole-body half is filed against
 * `Sway` — see `docs/OPEN-REQUESTS.md`.
 *
 *
 * WHERE THE ANGLES COME FROM — Coulson (2004), research `body-motion-numbers.md` §3
 * ---------------------------------------------------------------------------------
 * BAP (Dael/Mortillaro/Scherer) gives factor loadings, not degrees: it says WHICH channel moves
 * for which emotion and by what RELATIVE amount, and `BAP_PRESCRIPTIONS` already carries that.
 * What it cannot give is a full-scale angle. Coulson's Table 1 is the only published emotion →
 * joint-angle table in the record, it covers the same six emotions, and research §2 names it
 * explicitly as the thing to derive our mapping from: "no quantified PAD → body mapping exists…
 * We are building one. The two published sources to derive it from: Coulson's Table 4 betas…"
 *
 * The rule is one line and it is re-derived by the gate rather than trusted from this comment:
 * **each channel's full scale is the smallest non-zero magnitude Coulson lists in the column that
 * codes it.** Coulson's levels are the extremes of a 6-AFC stimulus set built to be maximally
 * discriminable between acted portrayals; the smallest level in a column is the least exaggerated
 * posture the study actually measured, and a settled idle is the least exaggerated case there is.
 * BAP's normalised loading then scales inside that, and the activation weight scales again.
 *
 * 🚩 THE SIGNS ARE MEASURED ON THE RIG, NOT TRANSCRIBED. research §3 carries three flagged
 * problems in the published paper — shoulder-swing signs inverted between Tables 1 and 4, mis-set
 * level lists, offset figure labels — and it ends with "verify sign conventions visually in our
 * rig before trusting either table." Coulson's own stated convention for the shoulder column
 * ("positive = arms toward trunk") contradicts his own verbal summary for happiness and sadness,
 * so there is no reading of that table that is self-consistent. This layer therefore takes
 * MAGNITUDE from Coulson and DIRECTION from BAP, and resolves left-versus-right by MEASURING
 * which side of the spine each arm is on at bind. A rig that mirrors, or a pose that crosses the
 * arms, gets the right answer without anyone editing a sign.
 *
 * ⚠️ ADDUCTION IS CLAMPED BY ANATOMY AND THE LIMIT IS MEASURED, NOT PICKED. On `figure_g050` in
 * `relaxed-standing` the upper arms already hang 10.18° (left) and 11.94° (right) from vertical,
 * so "arms drawn in" has about ten degrees of room before the arm is inside the ribcage. The limit
 * is each arm's own measured abduction at bind. The visible consequence, stated so it is not read
 * as a bug: anger and sadness both SATURATE it, so their arms are the same, and they separate on
 * the trunk instead.
 *
 *
 * WHY IT SITS AT MOTION_ORDER.POSTURE
 * -----------------------------------
 * "The pose everything else is a deviation from." Breath, sway, idle, gaze and gesture are all
 * deviations from the stance a person is holding, and an emotional stance is a stance. Running
 * first also means the head channel composes UNDER gaze rather than over it, so the eyes still
 * aim where the gaze layer asked from whatever attitude the posture put the head in.
 */

import { Quaternion, Vector3 } from 'three';

import { HUMANOID_TO_FIGURE_BONE } from '../figure/Skeleton.js';
import { restRotationRelativeToRig, toBoneDeltaFrame } from '../motion/Breath.js';
import { Layer } from '../motion/Layer.js';
import { MOTION_ORDER } from '../motion/MotionStack.js';
import { AffectState } from './AffectState.js';
import { ExpressionMap } from './ExpressionMap.js';

const DEGREES_TO_RADIANS = Math.PI / 180;

/**
 * Rig-space anatomical axes, the same three `motion/Sway.js` verified on figure_g050: +X is the
 * character's left-right axis, +Y is up, +Z is forward. A sagittal (forward/back) rotation is
 * therefore about +X and a frontal (arm out to the side) rotation is about +Z.
 *
 * The SENSE of each is derived once, here, rather than left to a reader to re-derive:
 *   +θ about +X carries +Y toward +Z, so a positive sagittal angle tips the top FORWARD.
 *   +θ about +Z carries −Y toward +X, so a positive frontal angle swings a hanging limb toward +X.
 * Both are asserted by measurement in `affect.selftest.mjs`, because a comment cannot fail.
 */
const RIG_SAGITTAL_AXIS = new Vector3( 1, 0, 0 );
const RIG_FRONTAL_AXIS = new Vector3( 0, 0, 1 );

/**
 * Coulson (2004) Table 1, transcribed from `docs/research/body-motion-numbers.md` §3. Degrees, and
 * one array per cell because the paper states the LEVELS a degree of freedom was sampled at rather
 * than a single value.
 *
 * ⚠️ Transcribed for the MAGNITUDES. See the header on why the signs are not used.
 */
export const COULSON_TABLE_1 = Object.freeze( {
    //            abdomen twist  chest bend   head bend        shoulder ad/ab  swing          elbow
    anger:     coulsonRow( [ 0 ], [ 20, 40 ], [ -20, 25 ], [ -60, -80 ], [ 45, 90 ], [ 50, 110 ] ),
    disgust:   coulsonRow( [ -25, -50 ], [ -20, 0 ], [ -20 ], [ -60, -80 ], [ -25, 45 ], [ 0, 50 ] ),
    fear:      coulsonRow( [ 0 ], [ 20, 40 ], [ 25, 50, -20 ], [ -60 ], [ 45, 90 ], [ 50, 110 ] ),
    happiness: coulsonRow( [ 0 ], [ 0, -20 ], [ 0, -20 ], [ 50 ], [ 0, 45 ], [ 0, 50 ] ),
    sadness:   coulsonRow( [ 0, -25 ], [ 0, 20 ], [ 25, 50 ], [ -60, -80 ], [ 0 ], [ 0 ] ),
    surprise:  coulsonRow( [ 0 ], [ -20 ], [ 25, 50 ], [ 50 ], [ -25, 0, 45 ], [ 0, 50 ] )
} );

/**
 * Which Coulson column codes which BAP channel. One line, so the mapping is a statement rather
 * than something spread across the file.
 *
 *   approach   -> chest bend. The trunk carried forward or back of neutral.
 *   armSpread  -> shoulder ad/abduction. The arm's angle away from the trunk.
 *   headTiltUp -> head bend. The head's pitch.
 */
export const CHANNEL_TO_COULSON_COLUMN = Object.freeze( {
    approach: 'chestBend',
    armSpread: 'shoulderAdAbduct',
    headTiltUp: 'headBend'
} );

/** The derived full scales. See the header for the rule; `smallestListedMagnitude` IS the rule. */
export const POSTURE_FULL_SCALE_DEGREES = Object.freeze(
    Object.fromEntries( Object.entries( CHANNEL_TO_COULSON_COLUMN )
        .map( ( [ channel, column ] ) => [ channel, smallestListedMagnitude( column ) ] ) ) );

/** Below this an angle is not worth a quaternion, and the layer stays out of the conflict report. */
const POSTURE_EPSILON_RADIANS = 1e-6;

export class PostureLayer extends Layer {

    /**
     * @param {Object} [options]
     * @param {AffectState} [options.state] - The SAME state `ExpressionLayer` holds. Bring your
     *   own; `ExpressionLayer.postureLayer()` is the paired constructor that cannot mismatch them.
     * @param {ExpressionMap} [options.map] - Likewise.
     * @param {number} [options.amplitude=1] - One art-direction multiplier over every channel. The
     *   per-channel degrees stay readable as the statement of intent they are.
     * @param {Object} [options.bones] - Overrides for the humanoid names this drives.
     * @param {Object} [options.defects] - 🚩 Gate fodder only. See POSTURE_DEFECTS.
     */
    constructor( options = {} ) {

        const bones = {
            spine: HUMANOID_TO_FIGURE_BONE.spine,
            head: HUMANOID_TO_FIGURE_BONE.head,
            leftUpperArm: HUMANOID_TO_FIGURE_BONE.leftUpperArm,
            rightUpperArm: HUMANOID_TO_FIGURE_BONE.rightUpperArm,
            ...( options.bones ?? {} )
        };

        super( {
            name: options.name ?? 'affectPosture',
            order: options.order ?? MOTION_ORDER.POSTURE,
            boneChannels: Object.values( bones ),
            enabled: options.enabled ?? true,
            weight: options.weight ?? 1
        } );

        this.bones = bones;
        this.amplitude = options.amplitude ?? 1;

        this.state = options.state ?? new AffectState();
        this.map = options.map ?? new ExpressionMap();

        this.defects = { ...POSTURE_DEFECTS_OFF, ...( options.defects ?? {} ) };

        /**
         * ⚠️ This layer never advances the affect state. `ExpressionLayer` does, and two clocks over
         * one state doubles its rate — the defect that layer's own header warns about. It also
         * recomputes `activate()` rather than reading the other layer's cached result, because the
         * two layers sit at opposite ends of MOTION_ORDER and reading across would hand this one
         * last frame's emotion. Eight anchors and a distance is cheaper than a frame of lag.
         */
        this.prescription = null;
        this.activations = [];

        /**
         * Last frame's angles in degrees, for a HUD and for the gates. `armSpread` is what the
         * prescription ASKED for and the two per-side numbers are what anatomy allowed, kept apart
         * so a reader can see the adduction clamp bite instead of wondering why the arms stopped.
         */
        this.appliedDegrees = {
            approach: 0, armSpread: 0, armSpreadLeft: 0, armSpreadRight: 0, headTiltUp: 0
        };

        /** Filled in by `onBind`. Rest frames, plus the two things that must be measured per rig. */
        this.restFrames = new Map();
        this.armSides = { leftUpperArm: 1, rightUpperArm: -1 };
        this.maxAdductionRadians = { leftUpperArm: 0, rightUpperArm: 0 };

        /**
         * What this layer put on each arm last frame, signed, positive for abduction. Read by
         * `onBind` and by nothing else — see the note there on why re-binding needs it.
         */
        this.appliedArmRadians = { leftUpperArm: 0, rightUpperArm: 0 };

        this.scratchRigRotation = new Quaternion();
        this.scratchBoneDelta = new Quaternion();
        this.scratchShoulder = new Vector3();
        this.scratchElbow = new Vector3();
        this.scratchSpine = new Vector3();

    }

    /**
     * Resolves rest frames, and measures the two rig facts the model refuses to assume: which side
     * of the spine each arm is on, and how much adduction that arm has before it is inside the
     * ribcage.
     */
    onBind( context ) {

        const target = context.stack.target;

        this.restFrames.clear();

        for ( const boneName of Object.values( this.bones ) ) {

            const bone = target.getBone( boneName );
            if ( bone === null || bone === undefined ) continue;

            this.restFrames.set( boneName, restRotationRelativeToRig( bone ) );

        }

        const spine = target.getBone( this.bones.spine );
        if ( spine === null || spine === undefined ) return;

        // 🚩 REFRESH BEFORE READING, and this line is a bug fix rather than defensiveness. `onBind`
        // runs when the layer joins the stack, which is normally the instant after a rest pose was
        // written into the bones' LOCAL quaternions — and nothing has recomputed a world matrix
        // since. Reading `matrixWorld` there measures the BIND pose, not the posed one. On this
        // figure the bind pose is an A-pose: measured, the adduction budget came out at 30°+
        // instead of the 10.18°/11.94° the relaxed stance actually has, so the clamp silently did
        // not bite and anger swung its arms 30° into the ribcage.
        spine.updateWorldMatrix( true, false );
        this.scratchSpine.setFromMatrixPosition( spine.matrixWorld );

        for ( const humanoid of [ 'leftUpperArm', 'rightUpperArm' ] ) {

            const shoulder = target.getBone( this.bones[ humanoid ] );
            const elbow = target.getBone( HUMANOID_TO_FIGURE_BONE[
                humanoid === 'leftUpperArm' ? 'leftLowerArm' : 'rightLowerArm' ] );

            if ( shoulder === null || shoulder === undefined || elbow === null || elbow === undefined ) continue;

            elbow.updateWorldMatrix( true, false );
            this.scratchShoulder.setFromMatrixPosition( shoulder.matrixWorld );
            this.scratchElbow.setFromMatrixPosition( elbow.matrixWorld );

            // Which way is "away from the midline" for this arm, and therefore which sign of a
            // frontal rotation abducts it. Measured, because a mirrored rig flips it.
            const side = Math.sign( this.scratchShoulder.x - this.scratchSpine.x ) || 1;
            this.armSides[ humanoid ] = side;

            // How far the arm already hangs from vertical, in its own frontal plane. That angle IS
            // the adduction budget: swinging it back to vertical is the most a shoulder can draw in
            // before the humerus is where the ribs are.
            const lateral = ( this.scratchElbow.x - this.scratchShoulder.x ) * side;
            const downward = this.scratchShoulder.y - this.scratchElbow.y;

            // 🚩 MINUS WHAT THIS LAYER ITSELF PUT THERE. `onBind` runs again on `MotionStack.reset()`
            // and on a rebind, and by then the arm is carrying the pose this layer committed on the
            // last frame — so a settled anger, whose arms are held AT vertical, would re-measure its
            // own budget as zero and never adduct again. Subtracting the layer's own last
            // contribution makes the measurement idempotent, which is what `Layer.onBind`'s contract
            // asks for. ⚠️ It does not subtract anyone ELSE's: an idle layer's degree or two of arm
            // noise is inside this measurement, and on the first bind — before any frame has run —
            // there is none of either.
            this.maxAdductionRadians[ humanoid ] = Math.max( 0,
                Math.atan2( lateral, downward ) - this.appliedArmRadians[ humanoid ] );

        }

    }

    reset() {

        this.prescription = null;
        this.activations = [];
        this.appliedDegrees = {
            approach: 0, armSpread: 0, armSpreadLeft: 0, armSpreadRight: 0, headTiltUp: 0
        };

        // 🚩 `appliedArmRadians` IS DELIBERATELY NOT CLEARED HERE. It is not layer state; it is a
        // record of what is on the BONES at this instant, and `MotionStack.reset()` calls
        // `layer.reset()` and then `layer.onBind()` WITHOUT re-committing — so the figure is still
        // standing in the last pose this layer wrote. Zeroing it here would make `onBind`
        // re-measure a settled anger's adduction budget as zero and pin the arms for good.

    }

    update() {

        this.activations = this.map.activate( this.state.pad );
        this.prescription = this.map.body( this.activations, this.state.bodyInput() );

        // 🎯 The prescription carries DIRECTION AND SHAPE only — `body()` divides by the total
        // activation weight, so a barely-active fear prescribes the same posture as a saturated
        // one. Intensity is the separate number, and using it here is what makes WASABI's own base
        // intensities visible in the body: fear ships at 0.25 because the paper calls it
        // "reluctant", and a reluctant fear should barely move the trunk.
        const intensity = this.defects.ignoreIntensity === true ? 1 : this.prescription.intensity;
        const drive = intensity * this.amplitude;

        const approach = POSTURE_FULL_SCALE_DEGREES.approach * DEGREES_TO_RADIANS
            * this.prescription.approach * drive;

        const headTiltUp = POSTURE_FULL_SCALE_DEGREES.headTiltUp * DEGREES_TO_RADIANS
            * this.prescription.headTiltUp * drive;

        const armSpread = POSTURE_FULL_SCALE_DEGREES.armSpread * DEGREES_TO_RADIANS
            * this.prescription.armSpread * drive;

        let wrote = false;

        // The trunk carried forward or back, hinged at the lumbar so the trunk rotates as a unit.
        // Spreading it down the spine would curl the figure, which is a slouch and not a lean.
        if ( this.writeSagittal( this.bones.spine, approach ) ) wrote = true;

        // Head pitch. Negative sagittal raises the face, since +X carries the head's forward vector
        // downward — hence the sign flip on a channel whose name says "up".
        if ( this.writeSagittal( this.bones.head, -headTiltUp ) ) wrote = true;

        const limited = { leftUpperArm: 0, rightUpperArm: 0 };

        for ( const humanoid of [ 'leftUpperArm', 'rightUpperArm' ] ) {

            limited[ humanoid ] = armSpread >= 0 || this.defects.unclampedAdduction === true
                ? armSpread
                : Math.max( armSpread, -this.maxAdductionRadians[ humanoid ] );

            this.appliedArmRadians[ humanoid ] = limited[ humanoid ];

            if ( this.writeFrontal( this.bones[ humanoid ], limited[ humanoid ] * this.armSides[ humanoid ] ) ) {

                wrote = true;

            }

        }

        this.appliedDegrees = {
            approach: approach / DEGREES_TO_RADIANS,
            armSpread: armSpread / DEGREES_TO_RADIANS,
            armSpreadLeft: limited.leftUpperArm / DEGREES_TO_RADIANS,
            armSpreadRight: limited.rightUpperArm / DEGREES_TO_RADIANS,
            headTiltUp: headTiltUp / DEGREES_TO_RADIANS
        };

        return wrote ? this.contribution : null;

    }

    /** One line for a HUD. `approach +14.2°  ·  arms -10.2°/-11.9° (asked -30.3°)  ·  head +0.0°` */
    describe() {

        const { approach, armSpread, armSpreadLeft, armSpreadRight, headTiltUp } = this.appliedDegrees;

        const clamped = Math.abs( armSpreadLeft - armSpread ) > 1e-6 || Math.abs( armSpreadRight - armSpread ) > 1e-6;

        return `approach ${ signedDegrees( approach ) }   ·   arms ${ signedDegrees( armSpreadLeft ) }/` +
            `${ signedDegrees( armSpreadRight ) }${ clamped ? ` (asked ${ signedDegrees( armSpread ) })` : '' }` +
            `   ·   head ${ signedDegrees( headTiltUp ) }`;

    }

    // --- helpers -----------------------------------------------------------------------------

    writeSagittal( boneName, radians ) {

        return this.writeAxis( boneName, RIG_SAGITTAL_AXIS, radians );

    }

    writeFrontal( boneName, radians ) {

        return this.writeAxis( boneName, RIG_FRONTAL_AXIS, radians );

    }

    writeAxis( boneName, axis, radians ) {

        if ( Math.abs( radians ) <= POSTURE_EPSILON_RADIANS ) return false;

        const restFrame = this.restFrames.get( boneName );
        if ( restFrame === undefined ) return false;

        this.scratchRigRotation.setFromAxisAngle( axis, radians );
        toBoneDeltaFrame( this.scratchRigRotation, restFrame, this.scratchBoneDelta );
        this.contribution.rotateBone( boneName, this.scratchBoneDelta );

        return true;

    }

}

/**
 * 🚩 Named ways this layer could be wrong, kept reachable so the gate is measured against them
 * rather than against an argument. LEARNINGS §1.25a: a gate proved only against the known-bad its
 * author had in mind is decorative, so each of these attacks the same class from a different
 * direction and every one of them still MOVES BONES — a gate that counted moved bones, which is
 * the obvious gate to write for the defect this file closes, says all three are fine.
 *
 *     ignoreIntensity     the prescription's shape applied at full commitment, so WASABI's
 *                         "reluctant" fear (base 0.25) stands like a saturated anger.
 *     unclampedAdduction  "arms drawn in" driven past the measured anatomical limit, so the
 *                         humerus travels through the ribcage. This one SHIPPED for an hour: the
 *                         limit was measured off stale world matrices and read 30°+ instead of
 *                         10.18°, which is the same failure with none of the code changed.
 *
 * The third member of the class is `ExpressionMap.DEFECTS.bapDenominatorSkipsUnlisted`, because it
 * is a mapping error rather than an actuation one.
 */
export const POSTURE_DEFECTS = Object.freeze( {
    ignoreIntensity: 'every emotion commits fully, so a reluctant fear stands like a settled anger',
    unclampedAdduction: 'adduction driven past vertical, so the arm enters the ribcage'
} );

const POSTURE_DEFECTS_OFF = Object.freeze(
    Object.fromEntries( Object.keys( POSTURE_DEFECTS ).map( ( key ) => [ key, false ] ) ) );

// --- local helpers ------------------------------------------------------------------------------

function coulsonRow( abdomenTwist, chestBend, headBend, shoulderAdAbduct, shoulderSwing, elbowBend ) {

    return Object.freeze( {
        abdomenTwist: Object.freeze( abdomenTwist ),
        chestBend: Object.freeze( chestBend ),
        headBend: Object.freeze( headBend ),
        shoulderAdAbduct: Object.freeze( shoulderAdAbduct ),
        shoulderSwing: Object.freeze( shoulderSwing ),
        elbowBend: Object.freeze( elbowBend )
    } );

}

/**
 * The derivation rule, as code. The smallest non-zero magnitude any emotion's row lists in a
 * column — the least exaggerated level of that degree of freedom the study actually measured.
 */
export function smallestListedMagnitude( column ) {

    let smallest = Infinity;

    for ( const row of Object.values( COULSON_TABLE_1 ) ) {

        for ( const degrees of row[ column ] ) {

            const magnitude = Math.abs( degrees );
            if ( magnitude > 0 && magnitude < smallest ) smallest = magnitude;

        }

    }

    if ( smallest === Infinity ) {

        throw new Error( `PostureLayer: Coulson Table 1 has no non-zero value in column '${ column }'.` );

    }

    return smallest;

}

function signedDegrees( value ) {

    return `${ value >= 0 ? '+' : '' }${ value.toFixed( 1 ) }°`;

}
