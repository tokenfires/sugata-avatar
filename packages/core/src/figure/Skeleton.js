/**
 * Skeleton — a normalised humanoid rig sitting in front of the figure's real bones.
 *
 * The problem it solves: the figure's bones do not rest at identity. Measured on
 * figure_g050.glb, every one of the 53 joints carries a non-identity rest rotation —
 * `clavicle_l` rests ~99° off, `thigh_l` ~160°, `pelvis` ~64°. So a quaternion written
 * straight onto `clavicle_l.quaternion` means something different from the same quaternion
 * written onto any other bone, and something different again on any other model. Procedural
 * motion written that way is welded to one asset.
 *
 * The fix, borrowed from VRM's normalised humanoid: expose a parallel rig in which every bone
 * *does* rest at identity, in the armature's own frame. A motion layer says "rotate the neck
 * 30° about X" and gets a 30° nod, on this figure and on the next one. `update()` converts
 * the whole normalised pose back onto the real bones once per frame.
 *
 *
 * THE CONVERSION, IN ONE PLACE
 *
 * For a bone b, with R(b) its rest rotation relative to the rig root and q(b) the normalised
 * rotation a motion layer wrote:
 *
 *     W(b)     = W( nearest normalised ancestor ) · q(b)     — accumulate down the chain
 *     Wraw(b)  = W(b) · R(b)                                  — where the real bone must end up
 *     local(b) = Wraw( raw parent )⁻¹ · Wraw(b)               — what three.js needs written
 *
 * All three are rotations relative to the rig root, not to the world, so the normalised frame
 * travels with the character. Turning the avatar 90° in the scene does not turn a nod into a
 * roll.
 *
 *
 * WHAT THIS RIG DOES NOT HAVE, AND WHY IT MATTERS
 *
 * The MakeHuman `game_engine` export carries **no jaw bone and no eye bones.** Verified by
 * parsing the GLB node tree: the head chain is `neck_01 → head` and stops. Jaw and eyes are
 * driven entirely by morph targets — `jawOpen`, `eyeLookUpLeft`, `eyeBlinkLeft` and the rest
 * of the ARKit 52. Gaze and jaw motion belong to the expression layer, not here.
 *
 * That is also why the ~17.5 mm head-region joint drift in
 * docs/research/base-mesh-verification.md finding 4 does not bite this asset in the way the
 * doc anticipates: there is no jaw pivot in the skeleton to drift. Head-region joints in this
 * rig are `neck_01` and `head`, nothing inside the skull.
 *
 * No twist bones either, so forearm and upper-arm roll will pinch the skin at extremes.
 * Noted, not solved here.
 */

import { Quaternion, Vector3 } from 'three';

/**
 * Humanoid vocabulary → the figure's actual bone names, read out of figure_g050.glb rather
 * than guessed. Names follow VRM 1.0 so that anything written against a VRM humanoid drops in.
 *
 * The trunk maps onto MakeHuman's three spine bones: `spine_01` sits just above the pelvis,
 * `spine_03` just below the clavicles, so spine/chest/upperChest is the natural reading.
 */
export const HUMANOID_TO_FIGURE_BONE = {

    hips: 'pelvis',
    spine: 'spine_01',
    chest: 'spine_02',
    upperChest: 'spine_03',
    neck: 'neck_01',
    head: 'head',

    leftShoulder: 'clavicle_l',
    leftUpperArm: 'upperarm_l',
    leftLowerArm: 'lowerarm_l',
    leftHand: 'hand_l',

    rightShoulder: 'clavicle_r',
    rightUpperArm: 'upperarm_r',
    rightLowerArm: 'lowerarm_r',
    rightHand: 'hand_r',

    leftUpperLeg: 'thigh_l',
    leftLowerLeg: 'calf_l',
    leftFoot: 'foot_l',
    leftToes: 'ball_l',

    rightUpperLeg: 'thigh_r',
    rightLowerLeg: 'calf_r',
    rightFoot: 'foot_r',
    rightToes: 'ball_r'

};

// The 30 finger bones follow one pattern exactly, so they are stated as the pattern rather
// than as 30 near-identical lines. VRM calls the pinky "little", and names the thumb's three
// segments metacarpal/proximal/distal where the other four are proximal/intermediate/distal.
const FINGERS = [
    { humanoid: 'Thumb', figure: 'thumb', segments: [ 'Metacarpal', 'Proximal', 'Distal' ] },
    { humanoid: 'Index', figure: 'index', segments: [ 'Proximal', 'Intermediate', 'Distal' ] },
    { humanoid: 'Middle', figure: 'middle', segments: [ 'Proximal', 'Intermediate', 'Distal' ] },
    { humanoid: 'Ring', figure: 'ring', segments: [ 'Proximal', 'Intermediate', 'Distal' ] },
    { humanoid: 'Little', figure: 'pinky', segments: [ 'Proximal', 'Intermediate', 'Distal' ] }
];

for ( const side of [ { humanoid: 'left', figure: 'l' }, { humanoid: 'right', figure: 'r' } ] ) {
    for ( const finger of FINGERS ) {
        finger.segments.forEach( ( segment, index ) => {
            const humanoidName = `${ side.humanoid }${ finger.humanoid }${ segment }`;
            HUMANOID_TO_FIGURE_BONE[ humanoidName ] = `${ finger.figure }_0${ index + 1 }_${ side.figure }`;
        } );
    }
}

/**
 * Humanoid bones this figure has no joint for. Motion layers should branch on this rather
 * than discover it as a silent no-op — `Skeleton.has( 'jaw' )` returns false and
 * `rotationOf( 'jaw' )` throws.
 */
export const MORPH_DRIVEN_INSTEAD_OF_BONES = [ 'jaw', 'leftEye', 'rightEye' ];

const IDENTITY_ROTATION = new Quaternion();

export class Skeleton {

    /**
     * @param {Object3D} rigRoot - The armature root of a loaded figure: the object all the
     *   bones descend from. Pass `gltf.scene` — it is the reliable choice. The armature is
     *   named 'Human.rig' in the GLB, but three's GLTFLoader strips dots from node names, so
     *   `getObjectByName( 'Human.rig' )` finds nothing and the node arrives as 'Humanrig'.
     *   (The same sanitising turns the mesh 'Human.teeth_base' into 'Humanteeth_base'.)
     *
     *   Every rotation this class computes is expressed relative to whatever is passed here,
     *   which is what makes the normalised frame follow the character around the scene rather
     *   than being pinned to world axes.
     */
    constructor( rigRoot ) {

        this.rigRoot = rigRoot;

        // The normalised rig itself: one quaternion per humanoid bone, identity meaning "rest
        // pose". This is the surface motion layers write to. Held as live Quaternion objects
        // so a layer can call setFromAxisAngle on one without allocating.
        this.normalisedRotation = new Map();

        // Bind-time facts, captured once in bindToFigure() and never written again.
        this.rawBones = new Map();          // humanoid name  -> Bone
        this.restRotations = new Map();     // Bone           -> rest rotation vs rigRoot
        this.restPositions = new Map();     // Bone           -> rest local position
        this.normalisedParents = new Map(); // humanoid name  -> nearest humanoid ancestor, or null

        // Per-frame scratch, pre-allocated per bone so update() allocates nothing.
        this.accumulatedRotations = new Map(); // humanoid name -> W(b)
        this.rawWorldRotations = new Map();    // Bone          -> Wraw(b)

        this.orderedBoneNames = [];
        this.missingBones = [];

        // Root translation. Everything else in a humanoid pose is rotation; the hips are the
        // one bone that also travels — a weight shift, a crouch, the vertical bob of a step.
        // In metres, in rig-root space, added to the hips' rest position.
        this.hipsOffset = new Vector3();
        this.hipsRestHeight = 0;
        this.hipsParentRotationInverse = new Quaternion();

        this.bindToFigure();

    }

    /**
     * Reads the figure's rest pose and builds everything derived from it.
     *
     * Called once from the constructor. The rest pose is whatever the bones are in at this
     * moment, so bind before any motion layer has run.
     */
    bindToFigure() {

        for ( const [ humanoidName, figureBoneName ] of Object.entries( HUMANOID_TO_FIGURE_BONE ) ) {

            const bone = this.rigRoot.getObjectByName( figureBoneName );

            if ( bone === undefined ) {
                this.missingBones.push( humanoidName );
                continue;
            }

            this.rawBones.set( humanoidName, bone );
            this.normalisedRotation.set( humanoidName, new Quaternion() );
            this.accumulatedRotations.set( humanoidName, new Quaternion() );
            this.restPositions.set( bone, bone.position.clone() );

        }

        this.missingBones.push( ...MORPH_DRIVEN_INSTEAD_OF_BONES );

        // Rest rotations are needed for every bone in the chain, not only the mapped ones,
        // because a mapped bone's real parent may be an unmapped bone — 'pelvis' hangs off
        // 'Root' here, and a rig with twist bones would have more such gaps.
        this.rigRoot.traverse( ( object ) => {

            const restRotation = this.restRotationRelativeToRig( object );
            this.restRotations.set( object, restRotation );

            // Seeded with the rest rotation on purpose. update() overwrites this entry for
            // every bone it drives, parents before children, so a parent lookup is either a
            // value written a moment ago or — for a bone nothing drives — a constant that was
            // always correct. That removes the need to ask "has this been computed yet?".
            this.rawWorldRotations.set( object, restRotation.clone() );

        } );

        this.orderedBoneNames = this.orderParentsFirst();

        const humanoidNameOfBone = new Map(
            [ ...this.rawBones.entries() ].map( ( [ name, bone ] ) => [ bone, name ] ) );

        for ( const humanoidName of this.orderedBoneNames ) {
            this.normalisedParents.set(
                humanoidName, this.nearestHumanoidAncestor( humanoidName, humanoidNameOfBone ) );
        }

        this.captureHipsRest();

    }

    /**
     * Writes the normalised pose onto the real bones. Call once per frame, after every motion
     * layer has had its say and before three.js updates world matrices.
     */
    update() {

        for ( const humanoidName of this.orderedBoneNames ) {

            const bone = this.rawBones.get( humanoidName );
            const normalisedParent = this.normalisedParents.get( humanoidName );

            // W(b) — accumulate the normalised chain. Parentless bones start from identity.
            const accumulated = this.accumulatedRotations.get( humanoidName );
            const parentAccumulated = normalisedParent === null
                ? IDENTITY_ROTATION
                : this.accumulatedRotations.get( normalisedParent );
            accumulated.multiplyQuaternions( parentAccumulated, this.normalisedRotation.get( humanoidName ) );

            // Wraw(b) — where this bone has to end up, relative to the rig root.
            const rawWorld = this.rawWorldRotations.get( bone );
            rawWorld.multiplyQuaternions( accumulated, this.restRotations.get( bone ) );

            // local(b) — undo the real parent's rotation. See the seeding note in
            // bindToFigure(): this lookup is correct whether or not the parent is driven.
            const parentRawWorld = this.rawWorldRotations.get( bone.parent ) ?? IDENTITY_ROTATION;

            bone.quaternion.copy( parentRawWorld ).invert().multiply( rawWorld );

        }

        this.applyHipsOffset();

    }

    /** Puts every bone back to its rest pose. Does not touch the real bones until update(). */
    reset() {

        for ( const rotation of this.normalisedRotation.values() ) {
            rotation.identity();
        }

        this.hipsOffset.set( 0, 0, 0 );

    }

    /** True when this figure actually has a joint for that humanoid bone. */
    has( humanoidName ) {

        return this.rawBones.has( humanoidName );

    }

    /**
     * The live normalised rotation for a bone. Motion layers write into it directly:
     *
     *     skeleton.rotationOf( 'neck' ).setFromAxisAngle( X_AXIS, radians );
     *
     * Identity is the rest pose. Throws for a bone this figure does not have, because a
     * silent no-op in a motion layer is a bug that hides for weeks.
     *
     * @param {string} humanoidName
     * @returns {Quaternion}
     */
    rotationOf( humanoidName ) {

        const rotation = this.normalisedRotation.get( humanoidName );

        if ( rotation === undefined ) {
            throw new Error(
                `No '${ humanoidName }' bone on this figure. Missing: ${ this.missingBones.join( ', ' ) }. ` +
                `Jaw and eyes are morph targets on this asset, not joints.` );
        }

        return rotation;

    }

    /** Convenience for callers holding a quaternion already. Equivalent to copying into rotationOf(). */
    setRotation( humanoidName, quaternion ) {

        this.rotationOf( humanoidName ).copy( quaternion );

    }

    /**
     * The accumulated normalised rotation of a bone relative to the rig root, as of the last
     * update(). Look-at and IK need this to work out how far a chain has already turned.
     *
     * @param {string} humanoidName
     * @returns {Quaternion} A live object; copy it if you intend to keep it.
     */
    accumulatedRotationOf( humanoidName ) {

        const accumulated = this.accumulatedRotations.get( humanoidName );

        if ( accumulated === undefined ) {
            throw new Error( `No '${ humanoidName }' bone on this figure.` );
        }

        return accumulated;

    }

    /** The real three.js Bone behind a humanoid name, for the rare caller that needs it. */
    rawBoneOf( humanoidName ) {

        return this.rawBones.get( humanoidName );

    }

    /**
     * Rigidly attaches an unskinned object to a humanoid bone, keeping where it currently sits
     * in the world. Reparenting only — no vertex weights, no per-frame cost.
     *
     * This exists because of a defect in the shipped figures, found by rotating the head and
     * watching the eyes stay behind. Verified at the time by parsing figure_g050.glb: of its
     * meshes, only the body carried a `skin` and JOINTS_0. The eyeballs, teeth, tongue, eyebrows
     * and eyelashes were plain children of the body mesh node with no skinning at all. They
     * followed the body's morph targets, so blinks and `jawOpen` worked — but they did not follow
     * a single bone, so the first neck rotation left the face behind.
     *
     * Attaching the face parts to `head` is right for the brows, lashes and eyes, and right
     * enough for the teeth and tongue: this rig has no jaw bone either, so jaw motion is the
     * `jawOpen` morph, which those meshes already carry.
     *
     * ⚠️ THE REAL FIX HAS LANDED. `tools/figure-pipeline/build_figure.py` now rigs every face
     * part, and `verify_glb.mjs` fails the build if any mesh exports unskinned. All seven meshes
     * of a current figure — including both shells of the eye, `Human.high-poly` and
     * `Human.cornea` — carry JOINTS_0 and WEIGHTS_0. This method is kept for figures built
     * elsewhere and for parts a consumer adds at runtime; on a current figure it is a no-op path.
     *
     * Call after the scene's world matrices are up to date — Object3D.attach reads them.
     *
     * @param {Object3D} object - An unskinned mesh or group.
     * @param {string} humanoidName - The bone to ride, usually 'head'.
     */
    attachToBone( object, humanoidName ) {

        const bone = this.rawBones.get( humanoidName );

        if ( bone === undefined ) {
            throw new Error( `Cannot attach to '${ humanoidName }': this figure has no such bone.` );
        }

        bone.attach( object );

        return object;

    }

    /** Every humanoid bone this figure has, parents before children. */
    get boneNames() {

        return this.orderedBoneNames;

    }

    // ---- helpers ------------------------------------------------------------------------

    /**
     * A bone's rest rotation relative to the rig root: the product of its own and every
     * ancestor's rest local rotation, stopping at the root.
     *
     * Read off the current pose, so this is only meaningful at bind time.
     *
     * Normalised at the end because the GLB stores quaternions to six decimal places, so the
     * figure's rest rotations are each about 5e-7 off unit length. Quaternion.invert() is a
     * conjugate, which is only the true inverse of a unit quaternion, so that error compounds
     * down a chain and through every frame's accumulation. One normalise here, at bind, keeps
     * the whole runtime clean.
     */
    restRotationRelativeToRig( object ) {

        const rotation = new Quaternion();

        for ( let node = object; node !== null && node !== this.rigRoot; node = node.parent ) {
            rotation.premultiply( node.quaternion );
        }

        return rotation.normalize();

    }

    /**
     * Humanoid bones sorted so that a bone always follows its ancestors. update() relies on
     * this: it reads the parent's accumulated rotation while computing the child's.
     */
    orderParentsFirst() {

        const depthOf = ( bone ) => {
            let depth = 0;
            for ( let node = bone; node !== null && node !== this.rigRoot; node = node.parent ) depth ++;
            return depth;
        };

        return [ ...this.rawBones.keys() ]
            .sort( ( a, b ) => depthOf( this.rawBones.get( a ) ) - depthOf( this.rawBones.get( b ) ) );

    }

    /**
     * The closest ancestor of this bone that is itself a humanoid bone, or null. Skips over
     * anything unmapped in between, which is how the normalised chain stays continuous on a
     * rig that carries extra joints.
     */
    nearestHumanoidAncestor( humanoidName, humanoidNameOfBone ) {

        const bone = this.rawBones.get( humanoidName );

        for ( let node = bone.parent; node !== null && node !== this.rigRoot; node = node.parent ) {
            if ( humanoidNameOfBone.has( node ) ) return humanoidNameOfBone.get( node );
        }

        return null;

    }

    /**
     * Records what the hips need in order to translate: their rest height, so a caller can
     * scale a motion clip's root travel to this figure's stature, and the inverse of their
     * parent's rest rotation, so a rig-space offset can be written into a local position.
     *
     * Stature matters here — the five bakes stand between 1591 mm and 1729 mm, a 138 mm spread
     * (measured 2026-08-07). A 20 mm weight shift authored on one is not 20 mm on another.
     */
    captureHipsRest() {

        const hips = this.rawBones.get( 'hips' );

        if ( hips === undefined ) return;

        hips.updateWorldMatrix( true, false );
        this.hipsRestHeight = new Vector3().setFromMatrixPosition( hips.matrixWorld ).y;

        this.hipsParentRotationInverse
            .copy( this.restRotations.get( hips.parent ) ?? IDENTITY_ROTATION )
            .invert();

    }

    /** Rewrites the hips' local position from rest + the rig-space offset. */
    applyHipsOffset() {

        const hips = this.rawBones.get( 'hips' );

        if ( hips === undefined ) return;

        hips.position
            .copy( this.hipsOffset )
            .applyQuaternion( this.hipsParentRotationInverse )
            .add( this.restPositions.get( hips ) );

    }

}
