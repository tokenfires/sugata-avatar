/**
 * BodyMass — where the figure's centre of mass is, given the pose it is currently in.
 *
 * This exists because of one identity, and the identity is the whole reason the file is worth
 * having:
 *
 *   🎯 FOR A SUSTAINED STANDING POSTURE, THE CENTRE OF PRESSURE SITS DIRECTLY UNDER THE CENTRE
 *      OF MASS.
 *
 * Not approximately, and not as a modelling convenience. A body that is not accelerating has no
 * net moment about any point, and the only external horizontal force acting on it is the ground
 * reaction. For that force to produce no moment it must act along a line through the centre of
 * mass — so its point of application on the floor, which is what a force plate calls the centre
 * of pressure, is the centre of mass projected downward. The two separate during transients (the
 * COP has to lead the COM to accelerate it, which is how balance is corrected at all) but the
 * separation is zero-mean and averages away over anything longer than a sway cycle.
 *
 * That matters because ALL of the postural literature this project builds on is measured at the
 * floor with a force plate. Quijoux's 3.0 mm medio-lateral sway and Duarte's 22 mm weight shift
 * are centre-of-pressure numbers. Nothing above the ankles was measured. So the only honest way
 * to turn a published number into an animation is to treat it as a statement about where the
 * centre of mass went, drive the body until the centre of mass is there, and let the head land
 * wherever the body's own geometry puts it.
 *
 * 🚩 The layer this was written for used to do the reverse: it took the published COP amplitude
 * and applied it as HEAD displacement, then bolted on a fudge factor for the weight shifts
 * because they came out wrong. Measured on this rig, the head travels 1.653x as far as the centre
 * of mass does, so that under-moved the whole figure by that factor — and the fudge factor for
 * the shifts, 0.20, was out by a further 8.3x in the other direction. See `motion/Sway.js`.
 *
 *
 * THE SEGMENT TABLE — Winter, *Biomechanics and Motor Control of Human Movement*, table 4.1
 *
 * Winter's table is Dempster's cadaver data, and it is the standard one. Each segment is defined
 * between two anatomical landmarks; `mass` is a fraction of total body mass and `comFraction` is
 * how far the segment's own centre of mass sits from the proximal landmark toward the distal one.
 *
 * 🚩 THE LANDMARKS ARE JOINTS, AND USING A CONVENIENT BONE INSTEAD IS THE EASY MISTAKE. Winter's
 * trunk runs from the greater trochanter to the glenohumeral joint — hip joint to shoulder joint,
 * half the body's mass on that one line. Substituting a chest bone for the shoulder, which is the
 * obvious thing to reach for on a rig, drops the trunk's centre of mass by 11 cm and the whole
 * body's by 6 cm. Measured on figure_g050 in `relaxed-standing`: 0.532 of stature the wrong way
 * against 0.568 the right way, where Winter's whole-body figure is 0.553. The horizontal response
 * to a weight shift moves by 8% between the two, which is second order against the defect this
 * file was written to fix, but it is not nothing and the right landmark costs the same as the
 * wrong one.
 *
 * 🚩 And note WHICH check catches that. The whole-body 0.553 comparison does NOT: the wrong
 * landmark lands 0.021 BELOW Winter's figure where the right one lands 0.015 above it, so any
 * tolerance wide enough to admit the correct answer admits the wrong one too. Segment LENGTH
 * discriminates them by a factor of two, which is what `selfCheckTrunkSpan` exists for, and
 * `bodymass.selftest.mjs` asserts both halves of that so neither can quietly stop being true.
 *
 * The trunk is therefore split into a left and a right half here, each spanning that side's hip
 * joint to that side's shoulder joint. That is not an anatomical claim — it is how a single
 * midline segment gets expressed on a rig whose only hip and shoulder landmarks are lateral. The
 * two halves carry half the trunk mass each and average back to the midline.
 *
 *
 * WHAT THIS IS NOT
 *
 * It is not an inertia model. There are no moments of inertia here and no dynamics; this answers
 * "where is the centre of mass right now" for a rig in a pose, which is what a quasi-static
 * posture layer needs. A future physics layer wanting angular momentum needs Winter's radii of
 * gyration as well, which are in the same table and are deliberately not here yet.
 *
 * It is also not accurate to the millimetre and does not need to be. A single-segment trunk is a
 * crude collapse of a real trunk whose mass is distributed unevenly along it, and the figure is a
 * parametric character rather than a scanned person. `selfCheckFractionOfStature()` exists so a
 * caller can assert the table is being applied sanely on whatever rig it was handed, rather than
 * trusting that it is.
 */

import { Vector3 } from 'three';

import { HUMANOID_TO_FIGURE_BONE } from './Skeleton.js';

// --- measured constants -------------------------------------------------------------------

/**
 * How far the head-and-neck centre of mass sits along the neck-joint-to-head-joint vector.
 *
 * Winter puts it at the ear canal, one full segment length from C7-T1. A game rig's `head` joint
 * is the atlanto-occipital joint, not the ear canal — on figure_g050 the neck-to-head vector is
 * 108 mm and the ear canal sits roughly 40 mm beyond the head joint, so the fraction that lands
 * the mass in the right place is about 1.4 rather than 1.0.
 *
 * It moves the whole-body centre of mass by 3 mm, so it is not load-bearing. It is written as a
 * named constant anyway because a reader who sees a fraction greater than 1 in the table will
 * otherwise assume it is a typo and "fix" it.
 */
const HEAD_COM_FRACTION = 1.40;

/**
 * Winter table 4.1. `proximal` and `distal` are humanoid bone names, so the table is a statement
 * about anatomy rather than about any one rig's naming.
 */
const SEGMENTS = [
    { name: 'headNeck', mass: 0.081, proximal: 'neck', distal: 'head', comFraction: HEAD_COM_FRACTION },

    // Winter's single midline trunk, expressed as two lateral halves. See the file header.
    { name: 'trunkLeft', mass: 0.2485, proximal: 'leftUpperLeg', distal: 'leftUpperArm', comFraction: 0.50 },
    { name: 'trunkRight', mass: 0.2485, proximal: 'rightUpperLeg', distal: 'rightUpperArm', comFraction: 0.50 },

    { name: 'upperArmLeft', mass: 0.028, proximal: 'leftUpperArm', distal: 'leftLowerArm', comFraction: 0.436 },
    { name: 'upperArmRight', mass: 0.028, proximal: 'rightUpperArm', distal: 'rightLowerArm', comFraction: 0.436 },
    { name: 'foreArmLeft', mass: 0.016, proximal: 'leftLowerArm', distal: 'leftHand', comFraction: 0.430 },
    { name: 'foreArmRight', mass: 0.016, proximal: 'rightLowerArm', distal: 'rightHand', comFraction: 0.430 },
    { name: 'handLeft', mass: 0.006, proximal: 'leftHand', distal: 'leftMiddleIntermediate', comFraction: 0.506 },
    { name: 'handRight', mass: 0.006, proximal: 'rightHand', distal: 'rightMiddleIntermediate', comFraction: 0.506 },

    { name: 'thighLeft', mass: 0.100, proximal: 'leftUpperLeg', distal: 'leftLowerLeg', comFraction: 0.433 },
    { name: 'thighRight', mass: 0.100, proximal: 'rightUpperLeg', distal: 'rightLowerLeg', comFraction: 0.433 },
    { name: 'shankLeft', mass: 0.0465, proximal: 'leftLowerLeg', distal: 'leftFoot', comFraction: 0.433 },
    { name: 'shankRight', mass: 0.0465, proximal: 'rightLowerLeg', distal: 'rightFoot', comFraction: 0.433 },
    { name: 'footLeft', mass: 0.0145, proximal: 'leftFoot', distal: 'leftToes', comFraction: 0.50 },
    { name: 'footRight', mass: 0.0145, proximal: 'rightFoot', distal: 'rightToes', comFraction: 0.50 }
];

/**
 * Winter's whole-body centre of mass, as a fraction of standing height. The self-check compares
 * against this rather than against a number fitted to our own figure, so a rig that resolves its
 * landmarks wrongly is caught by anatomy rather than by our own previous output.
 */
export const WHOLE_BODY_COM_FRACTION_OF_STATURE = 0.553;

/**
 * Winter's standing shoulder and hip joint heights, as fractions of stature. Their difference is
 * how long the trunk segment ought to be — which is the one structural fact that catches the
 * mistake this class is most likely to suffer.
 *
 * 🎯 The whole-body check above CANNOT catch a mis-resolved trunk on its own, and that is
 * measured rather than supposed: resolving the trunk's distal landmark to a chest bone instead of
 * the shoulder joint moves the centre of mass 60 mm, but it moves it from 0.015 ABOVE Winter's
 * figure to 0.021 BELOW it, so a symmetric tolerance wide enough to admit the correct answer
 * admits the wrong one too. Segment LENGTH discriminates them by a factor of two, because a chest
 * bone sits barely half way from the hip to the shoulder.
 */
export const SHOULDER_HEIGHT_FRACTION_OF_STATURE = 0.818;
export const HIP_HEIGHT_FRACTION_OF_STATURE = 0.530;

// --- the model ---------------------------------------------------------------------------

export class BodyMass {

    /**
     * @param {Object} [options]
     * @param {Object} [options.bones] - Overrides for the figure bone behind any humanoid name in
     *   the segment table, e.g. `{ hips: 'root_hips' }`. Everything not named keeps the standard
     *   mapping in `figure/Skeleton.js`.
     */
    constructor( options = {} ) {

        this.boneOverrides = options.bones ?? {};

        /** One entry per segment the bound rig could actually resolve, with its bones attached. */
        this.segments = [];

        /** Segments the rig had no bones for, by name. A caller should look at this. */
        this.missingSegments = [];

        /**
         * The mass fraction that was actually resolvable, before renormalisation. A rig missing
         * its toes loses 2.9% and the remaining segments are scaled up to cover it — which is the
         * right behaviour and also worth knowing about, because it is a silent 3% bias otherwise.
         */
        this.massAccountedFor = 0;

        // `scratch` and `scratchDistal` are consumed INSIDE centreOfMass, so nothing may pass
        // either of them in as its output target. `result` exists for exactly the callers that
        // want a number rather than a vector and would otherwise reach for a scratch.
        this.scratch = new Vector3();
        this.scratchDistal = new Vector3();
        this.result = new Vector3();

    }

    // --- action ---------------------------------------------------------------------------

    /**
     * Resolves the segment table against a rig.
     *
     * @param {Object} target - Anything with `getBone( name ) -> Object3D|null`; a `MotionStack`
     *   motion target, or a `Figure`.
     * @param {Function} [boneNameOf] - Maps a humanoid name to a figure bone name. Defaults to
     *   the standard mapping with this instance's overrides applied.
     * @returns {this}
     */
    bind( target, boneNameOf = null ) {

        const nameOf = boneNameOf ?? ( ( humanoid ) =>
            this.boneOverrides[ humanoid ] ?? HUMANOID_TO_FIGURE_BONE[ humanoid ] );

        this.segments = [];
        this.missingSegments = [];
        this.massAccountedFor = 0;

        for ( const segment of SEGMENTS ) {

            const proximal = target.getBone( nameOf( segment.proximal ) ) ?? null;
            const distal = target.getBone( nameOf( segment.distal ) ) ?? null;

            // Both ends are needed: the segment is defined as a line between them, and half a
            // line has no midpoint. A rig missing one end loses the whole segment.
            if ( proximal === null || distal === null ) {

                this.missingSegments.push( segment.name );
                continue;

            }

            this.segments.push( { ...segment, proximal, distal } );
            this.massAccountedFor += segment.mass;

        }

        return this;

    }

    /**
     * The centre of mass in world space, for whatever pose the bones are in right now.
     *
     * Reads the bones' current world matrices without forcing an update, so a caller that has
     * just moved bones must have called `updateMatrixWorld` first. That is deliberate: this gets
     * called inside measurement loops that already control when the rig is refreshed, and a
     * hidden traversal per call there is the kind of cost that never gets found later.
     */
    centreOfMass( target ) {

        target.set( 0, 0, 0 );

        if ( this.segments.length === 0 ) return target;

        for ( const segment of this.segments ) {

            this.scratch.setFromMatrixPosition( segment.proximal.matrixWorld );
            this.scratchDistal.setFromMatrixPosition( segment.distal.matrixWorld );

            // The segment's own centre of mass: proximal, plus a fraction of the way to distal.
            this.scratch.lerp( this.scratchDistal, segment.comFraction );

            target.addScaledVector( this.scratch, segment.mass );

        }

        // Renormalising rather than dividing by 1.0 is what makes a rig with no toes produce a
        // centre of mass in the right place instead of one pulled 3% toward the origin.
        return target.divideScalar( this.massAccountedFor );

    }

    /**
     * How far the centre of mass sits above a given height, which is the lever a pendulum
     * rotating about that height turns through. Named rather than inlined because `Sway` solves
     * for a lean angle with it and the arithmetic reads as nonsense without the name.
     */
    heightAbove( pivotHeightMetres ) {

        return this.centreOfMass( this.result ).y - pivotHeightMetres;

    }

    /**
     * 🎯 The anatomy check, and the reason a caller can trust the number above.
     *
     * Winter puts the whole-body centre of mass at 0.553 of standing height. That is an
     * INDEPENDENT published figure, not one derived from the segment table, so comparing against
     * it catches the failure this class is most likely to have: landmarks resolved to the wrong
     * bones, which produces a perfectly plausible centre of mass in the wrong place.
     *
     * `docs/LEARNINGS.md` §1.1 — a gate that has never failed is not known to work. This one is
     * checked in both directions by `bodymass.selftest.mjs`, which deliberately mis-resolves the
     * trunk and confirms the check fails and names it.
     *
     * @param {number} statureMetres - Floor to vertex, measured from the figure's bounding box.
     * @returns {{ fraction: number, expected: number, deviation: number }}
     */
    selfCheckFractionOfStature( statureMetres ) {

        const fraction = this.centreOfMass( this.result ).y / statureMetres;

        return {
            fraction,
            expected: WHOLE_BODY_COM_FRACTION_OF_STATURE,
            deviation: fraction - WHOLE_BODY_COM_FRACTION_OF_STATURE
        };

    }

    /**
     * 🎯 The landmark check, and the one that actually catches a mis-resolved trunk.
     *
     * Half the body's mass hangs on the trunk segment, so a trunk resolved to the wrong bones is
     * the single most damaging thing that can go wrong here — and the whole-body check above
     * demonstrably does not catch it. This does, because it compares a LENGTH rather than a
     * position: Winter puts the shoulder joint at 0.818 of stature and the hip joint at 0.530, so
     * the trunk spans 0.288 of stature, and a chest bone standing in for the shoulder halves that.
     *
     * @param {number} statureMetres
     * @returns {{ fraction: number, expected: number }} The measured span as a fraction of
     *   stature, and what it should be. Returns a fraction of 0 if the trunk did not resolve.
     */
    selfCheckTrunkSpan( statureMetres ) {

        const expected = SHOULDER_HEIGHT_FRACTION_OF_STATURE - HIP_HEIGHT_FRACTION_OF_STATURE;
        const trunk = this.segments.filter( ( segment ) => segment.name.startsWith( 'trunk' ) );

        if ( trunk.length === 0 ) return { fraction: 0, expected };

        // Vertical span, not length: Winter's two anchors are both heights, and a rig whose
        // shoulder sits forward of its hip would otherwise read as a longer trunk than it has.
        const span = trunk.reduce( ( total, segment ) =>
            total + Math.abs( segment.distal.matrixWorld.elements[ 13 ] - segment.proximal.matrixWorld.elements[ 13 ] ),
        0 ) / trunk.length;

        return { fraction: span / statureMetres, expected };

    }

}
