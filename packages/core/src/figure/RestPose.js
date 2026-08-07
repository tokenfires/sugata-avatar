/**
 * RestPose — the posture the figure sits in when nothing is driving it.
 *
 * The figure ships in its bind pose, and a bind pose is not a posture. On figure_g050.glb the
 * upper arms stand 41.8° out from vertical, the elbows carry 43.1° of flexion with the forearms
 * swung forward, and the fingers are all but flat. Measured, not eyeballed: see
 * `poses/relaxed-standing.json`, whose every angle is derived from those numbers. A figure left
 * in that pose reads as a shop mannequin no matter how well it is lit or how well it breathes,
 * because the shape of a body at rest is the first thing a viewer reads and the last thing
 * rendering can fix.
 *
 * So: a rest pose is a layer of bone rotations sitting on top of the bind pose, and it is DATA.
 * The angles in a posture are a judgement call that gets revisited a dozen times — the difference
 * between an arm that hangs and an arm that dangles is two degrees — and nobody should have to
 * edit a source file to try two degrees. Hence `poses/*.json`, and hence the `why` field on every
 * entry: JSON has no comments, and an angle without its reasoning is an angle nobody dares
 * change.
 *
 *
 * WHAT FRAME THE ANGLES ARE IN
 *
 * Poses are written against `figure/Skeleton.js`, the normalised humanoid rig, where every bone
 * rests at identity and axes are the rig root's:
 *
 *     +X  the character's LEFT          (verified: upperarm_l sits at x = +0.170)
 *     +Y  up
 *     +Z  forward                       (the nose at z = +0.144 against a heel at z = +0.022)
 *
 * A bone's rotation is applied in its normalised parent's accumulated frame, which has a
 * consequence worth stating plainly because it is what makes this format authorable: **an axis
 * written in bind-pose rig coordinates is carried down the chain by whatever the pose does
 * upstream.** The elbow hinge axis measured off the bind pose stays the elbow hinge after the
 * shoulder has swung the whole arm 32° inboard. That is why fingers and elbows here are written
 * as axis+angle about a measured anatomical axis rather than as three Euler numbers that would
 * mean nothing to the next reader.
 *
 *
 * THE FILE FORMAT
 *
 *     {
 *       "name": "relaxed-standing",
 *       "description": "...",
 *       "notes": [ "prose that belongs with the numbers" ],
 *       "hipsOffsetMetres": [ 0, 0, 0 ],
 *       "axes": { "elbowExtendLeft": [ 0.745, 0.665, -0.051 ] },
 *       "bones": {
 *         "leftUpperArm": { "euler": [ -7, 0, -32 ], "why": "..." },
 *         "leftLowerArm": { "axis": "elbowExtendLeft", "degrees": 30, "why": "..." },
 *         "spine_01":     [ { "euler": [ 2, 0, 0 ] }, { "axis": [ 0, 0, 1 ], "degrees": -5 } ]
 *       }
 *     }
 *
 *   - Bone keys are VRM humanoid names (`leftUpperArm`), the vocabulary `Skeleton` speaks.
 *   - `euler` is degrees, XYZ order, three.js convention. In rig space that reads as
 *     [ pitch forward, yaw left, roll ] for an upright bone.
 *   - `axis` is either a literal `[x, y, z]` or the name of an entry in `axes`. Not normalised
 *     in the file — measured axes come out of a cross product and normalising them by hand only
 *     invites transcription errors.
 *   - A bone may carry an array of specs, applied in the order written: the first acts on the
 *     bone, each later one on top of the result about the parent's axes.
 *   - Angles are degrees throughout. Radians in a hand-authored file are a bug generator.
 *
 *
 * HOW IT MEETS THE MOTION STACK
 *
 * A rest pose is not a motion layer. It is the pose every motion layer measures its deltas
 * against, so it is applied *before* the stack binds:
 *
 *     restPose.applyTo( skeleton );
 *     skeleton.update();                 // normalised pose -> real bone quaternions
 *     stack.bind( createMotionTarget( figureRoot ) );
 *
 * To crossfade between postures at runtime — a Sway weight-shift moving from square stance to
 * contrapposto — do the same three steps per frame, re-snapshotting rather than re-binding:
 *
 *     standing.blendTo( skeleton, weightLeft, shift );
 *     skeleton.update();
 *     stack.snapshotRestPose();          // deltas now compose onto the new posture
 *
 * `snapshotRestPose()` is a copy loop over the declared channels, so this is cheap enough to run
 * every frame of a shift.
 */

import { Quaternion, Vector3 } from 'three';

import { HUMANOID_TO_FIGURE_BONE } from './Skeleton.js';

import relaxedStanding from './poses/relaxed-standing.json' with { type: 'json' };
import weightLeft from './poses/weight-left.json' with { type: 'json' };
import weightRight from './poses/weight-right.json' with { type: 'json' };

/**
 * The poses that ship with the figure. Statically imported so `load()` is synchronous and so a
 * missing file is a build error rather than a runtime one — a pose that fails to arrive at
 * runtime leaves the figure in the bind pose, which is the exact failure this class exists to
 * prevent, and which looks like a styling problem rather than a missing asset.
 */
const BUNDLED_POSES = {
    'relaxed-standing': relaxedStanding,
    'weight-left': weightLeft,
    'weight-right': weightRight
};

const DEGREES_TO_RADIANS = Math.PI / 180;

const IDENTITY_ROTATION = new Quaternion();

// Scratch for blendTo. A frame is single-threaded and both are consumed inside the call that
// fills them, so one pair for the module is safe and keeps blending allocation-free.
const scratchBlend = new Quaternion();
const scratchOffset = new Vector3();

export class RestPose {

    /**
     * @param {Object} data - A parsed pose file. See the format note above.
     * @param {string} [sourceName] - Used in error messages when `data.name` is absent.
     */
    constructor( data, sourceName = 'pose' ) {

        this.name = data.name ?? sourceName;
        this.description = data.description ?? '';
        this.notes = data.notes ?? [];

        // humanoid bone name -> Quaternion, in the normalised frame. Identity is the bind pose,
        // so a bone absent from this map is a bone the pose deliberately leaves alone.
        this.rotations = new Map();

        this.hipsOffset = new Vector3().fromArray( data.hipsOffsetMetres ?? [ 0, 0, 0 ] );

        this.compile( data );

    }

    /**
     * A bundled pose, by name.
     *
     * Throws rather than returning null on an unknown name: every caller of this is a startup
     * path, and a figure that silently stays in its bind pose is the bug this class was written
     * to remove.
     *
     * @param {string} name - 'relaxed-standing', 'weight-left', 'weight-right'.
     * @returns {RestPose}
     */
    static load( name ) {

        const data = BUNDLED_POSES[ name ];

        if ( data === undefined ) {
            throw new Error(
                `No rest pose named '${ name }'. Available: ${ Object.keys( BUNDLED_POSES ).join( ', ' ) }.` );
        }

        return new RestPose( data, name );

    }

    /** Every bundled pose name, for a picker or a test that wants to walk them all. */
    static get names() {

        return Object.keys( BUNDLED_POSES );

    }

    /**
     * Puts the skeleton into this pose.
     *
     * A pose is a complete statement about the body, so this resets the skeleton first: bones the
     * file does not mention go back to bind. Without that, applying pose B after pose A would
     * leave B wearing whatever A said about the bones B is silent on.
     *
     * Writes only the normalised rig. Call `skeleton.update()` afterwards to move real bones.
     *
     * @param {Skeleton} skeleton - The normalised humanoid rig from `figure/Skeleton.js`.
     * @returns {string[]} Humanoid bones this pose named that this figure does not have. Empty on
     *   a complete rig; worth logging rather than throwing, because figure variants legitimately
     *   differ and a missing pinky should not stop a face from loading.
     */
    applyTo( skeleton ) {

        skeleton.reset();

        const absent = [];

        for ( const [ humanoidName, rotation ] of this.rotations ) {

            if ( skeleton.has( humanoidName ) === false ) {
                absent.push( humanoidName );
                continue;
            }

            skeleton.rotationOf( humanoidName ).copy( rotation );

        }

        skeleton.hipsOffset.copy( this.hipsOffset );

        return absent;

    }

    /**
     * Puts the skeleton somewhere between this pose and another.
     *
     * This is the crossfade Sway's weight shifts ride on: hold 'relaxed-standing' as the anchor,
     * ease `t` toward 1 against 'weight-left', and the hip, spine and shoulder line move together
     * instead of as separate tweens that drift out of step.
     *
     * Slerp per bone rather than lerp on Euler angles, because the two poses disagree about
     * shoulders and hips by tens of degrees and an Euler lerp bends a limb through the wrong
     * plane on the way. Bones named by only one of the two poses blend against identity, which is
     * the correct reading: the silent pose is saying "bind".
     *
     * @param {Skeleton} skeleton
     * @param {RestPose} other - The pose at t = 1.
     * @param {number} t - 0 is this pose, 1 is `other`. Clamped.
     * @returns {string[]} Humanoid bones either pose named that this figure does not have.
     */
    blendTo( skeleton, other, t ) {

        const mix = Math.min( 1, Math.max( 0, t ) );

        skeleton.reset();

        const absent = [];
        const bonesTouched = new Set( [ ...this.rotations.keys(), ...other.rotations.keys() ] );

        for ( const humanoidName of bonesTouched ) {

            if ( skeleton.has( humanoidName ) === false ) {
                absent.push( humanoidName );
                continue;
            }

            const from = this.rotations.get( humanoidName ) ?? IDENTITY_ROTATION;
            const to = other.rotations.get( humanoidName ) ?? IDENTITY_ROTATION;

            scratchBlend.copy( from ).slerp( to, mix );

            skeleton.rotationOf( humanoidName ).copy( scratchBlend );

        }

        scratchOffset.copy( this.hipsOffset ).lerp( other.hipsOffset, mix );
        skeleton.hipsOffset.copy( scratchOffset );

        return absent;

    }

    /**
     * This pose's rotation for one bone, or null if the pose leaves it at bind.
     *
     * @param {string} humanoidName
     * @returns {Quaternion|null} A live object. Copy it if you intend to keep it.
     */
    rotationFor( humanoidName ) {

        return this.rotations.get( humanoidName ) ?? null;

    }

    // ---- helpers ------------------------------------------------------------------------

    /**
     * Turns the file's specs into one quaternion per bone.
     *
     * Done once at construction so that applying or blending a pose is a copy and a slerp. A
     * rest pose is applied on a frame boundary at worst, but blends run every frame of a weight
     * shift, and parsing degrees out of JSON on a frame is the kind of cost that never gets found
     * later because it never looks like the problem.
     */
    compile( data ) {

        const namedAxes = data.axes ?? {};

        for ( const [ humanoidName, spec ] of Object.entries( data.bones ?? {} ) ) {

            if ( HUMANOID_TO_FIGURE_BONE[ humanoidName ] === undefined ) {
                throw new Error(
                    `Pose '${ this.name }' names bone '${ humanoidName }', which is not a humanoid bone. ` +
                    `Poses use VRM humanoid names — 'leftUpperArm', not 'upperarm_l'.` );
            }

            const specs = Array.isArray( spec ) ? spec : [ spec ];
            const rotation = new Quaternion();

            // Premultiply, so the list reads as a sequence of moves: the first entry acts on the
            // bone where it sits, and each later entry is applied on top of the result about the
            // parent's axes. Post-multiplying would reverse that and make a two-line pose entry
            // mean the opposite of how it reads.
            for ( const step of specs ) {
                rotation.premultiply( this.quaternionFromSpec( step, namedAxes, humanoidName ) );
            }

            this.rotations.set( humanoidName, rotation.normalize() );

        }

    }

    /** One `{ euler }` or `{ axis, degrees }` entry, as a quaternion. */
    quaternionFromSpec( spec, namedAxes, humanoidName ) {

        const rotation = new Quaternion();

        if ( spec.euler !== undefined ) {

            // Composed by hand rather than through Euler so that the XYZ convention is visible
            // here rather than inherited from a three.js default that could change under us.
            // q = qX · qY · qZ, three.js 'XYZ': Z acts on the bone first, then Y, then X.
            const [ x, y, z ] = spec.euler;

            rotation
                .setFromAxisAngle( AXIS_X, x * DEGREES_TO_RADIANS )
                .multiply( scratchAxisRotation.setFromAxisAngle( AXIS_Y, y * DEGREES_TO_RADIANS ) )
                .multiply( scratchAxisRotation.setFromAxisAngle( AXIS_Z, z * DEGREES_TO_RADIANS ) );

            return rotation;

        }

        if ( spec.axis !== undefined ) {

            const axis = typeof spec.axis === 'string' ? namedAxes[ spec.axis ] : spec.axis;

            if ( axis === undefined ) {
                throw new Error(
                    `Pose '${ this.name }' bone '${ humanoidName }' names axis '${ spec.axis }', ` +
                    `which is not in this file's "axes" block.` );
            }

            // Normalised here rather than in the file: measured anatomical axes come out of a
            // cross product, and a human retyping them to unit length is a transcription bug
            // waiting to happen.
            scratchAxis.fromArray( axis ).normalize();

            return rotation.setFromAxisAngle( scratchAxis, ( spec.degrees ?? 0 ) * DEGREES_TO_RADIANS );

        }

        throw new Error(
            `Pose '${ this.name }' bone '${ humanoidName }' has neither "euler" nor "axis".` );

    }

}

// Module scratch for compile(). Only ever live inside a single synchronous call.
const AXIS_X = new Vector3( 1, 0, 0 );
const AXIS_Y = new Vector3( 0, 1, 0 );
const AXIS_Z = new Vector3( 0, 0, 1 );

const scratchAxis = new Vector3();
const scratchAxisRotation = new Quaternion();
