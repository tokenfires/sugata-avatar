/**
 * Layer — one procedural influence on the figure, and the contribution it produces.
 *
 * A layer never touches a mesh, a morph influence or a bone. It writes numbers into its own
 * contribution and hands that back to the MotionStack, which sums every layer and commits once.
 * That indirection is the whole reason the stack exists: blink and emotion both want the
 * eyelids, breath and sway both want the spine, gaze and head motion both want the neck. Direct
 * writers fight and the last one wins. Contributors add up.
 *
 * A layer declares its channels up front, and the declaration is load-bearing in three ways:
 *
 *   1. It preallocates the contribution's storage, so a running frame allocates nothing.
 *   2. It is how bone masking is done. three.js has no AvatarMask; you mask by choosing which
 *      bones a layer is allowed to touch. Do NOT reach into AnimationMixer's `_propertyBindings`
 *      to do this — that hack circulates on the forum and it will break.
 *   3. It lets the stack name both sides of a channel conflict before anyone has to debug one.
 *
 * Writing an undeclared channel throws. That is deliberate: it is a programming error, it
 * surfaces on the first frame the code runs, and the message says exactly what to add.
 *
 * Minimal layer:
 *
 *     class Blink extends Layer {
 *
 *         constructor() {
 *             super( {
 *                 name: 'blink',
 *                 order: MOTION_ORDER.BLINK,
 *                 morphChannels: [ 'eyeBlinkLeft', 'eyeBlinkRight' ]
 *             } );
 *             this.closure = 0;
 *         }
 *
 *         update( deltaSeconds, context ) {
 *             this.closure = advanceBlink( this.closure, deltaSeconds, this.random );
 *             if ( this.closure === 0 ) return null;          // nothing to say this frame
 *             this.contribution.setMorph( 'eyeBlinkLeft', this.closure );
 *             this.contribution.setMorph( 'eyeBlinkRight', this.closure );
 *             return this.contribution;
 *         }
 *
 *     }
 */

import { Euler, Quaternion, Vector3 } from 'three';

// Shared scratch for the Euler convenience path. Safe because a frame is single-threaded and the
// value is consumed inside the call that fills it.
const scratchEuler = new Euler();
const scratchQuaternion = new Quaternion();

export class Layer {

    /**
     * @param {Object} options
     * @param {string} options.name - Unique within a stack. Names the layer's random stream and
     *   every line it appears on in the conflict report, so make it the domain word: 'blink',
     *   'gaze', 'breath'.
     * @param {number} [options.order=500] - Position in the stack. See MOTION_ORDER for the
     *   agreed slots. Lower runs first.
     * @param {string[]} [options.morphChannels=[]] - Morph target names this layer may write.
     * @param {string[]} [options.boneChannels=[]] - Bone names this layer may rotate or offset.
     * @param {boolean} [options.enabled=true]
     * @param {number} [options.weight=1] - Scales everything this layer contributes. Bone weight
     *   is clamped to [0, 1] because it is applied by slerp from identity; morph weight is not,
     *   so a layer may deliberately overdrive a morph past 1 and let the stack clamp it.
     */
    constructor( options = {} ) {

        if ( typeof options.name !== 'string' || options.name.length === 0 ) {

            throw new Error( 'A motion Layer needs a name; it identifies the layer in the conflict report and seeds its random stream.' );

        }

        this.name = options.name;
        this.order = options.order ?? 500;
        this.enabled = options.enabled ?? true;
        this.weight = options.weight ?? 1;

        this.morphChannels = [ ...( options.morphChannels ?? [] ) ];
        this.boneChannels = [ ...( options.boneChannels ?? [] ) ];

        this.contribution = new MotionContribution( this.name, this.morphChannels, this.boneChannels );

        // Both are filled in by MotionStack.add(). A layer is inert until it joins a stack.
        this.stack = null;
        this.random = null;

    }

    /**
     * Called when the layer joins a bound stack, again if the stack is rebound to a new figure,
     * and again on `MotionStack.reset()`. This is where a layer resolves rest-pose data or caches
     * anything derived from the figure. `context.stack.restRotationOf( boneName )` is available
     * by now.
     *
     * Keep it idempotent — it runs more than once — and note that `this.random` has been rewound
     * to its first draw each time it is called, so drawing from it here is safe and reproducible.
     */
    onBind( context ) {} // eslint-disable-line no-unused-vars

    /**
     * The one function a layer must implement. Advance internal state by `deltaSeconds`, write
     * into `this.contribution`, return it.
     *
     * Return `null` to contribute nothing this frame — that is the normal case for an event
     * layer between events, and it keeps the layer out of the conflict report while idle.
     *
     * @param {number} deltaSeconds
     * @param {Object} context - `{ stack, target, dt, time, frame, random, shared }`.
     *   `context.time` is motion time (the integral of clamped dt), not wall clock.
     * @returns {MotionContribution|null}
     */
    update( deltaSeconds, context ) { // eslint-disable-line no-unused-vars

        return null;

    }

    /**
     * Replaces the declared channels at runtime and rebuilds the contribution's storage. Only
     * needed by layers whose channel set genuinely varies — a gesture layer that switches between
     * arms, for instance. Everything else should declare once in the constructor.
     */
    declareChannels( { morphChannels, boneChannels } = {} ) {

        if ( morphChannels !== undefined ) this.morphChannels = [ ...morphChannels ];
        if ( boneChannels !== undefined ) this.boneChannels = [ ...boneChannels ];

        this.contribution = new MotionContribution( this.name, this.morphChannels, this.boneChannels );

        if ( this.stack !== null ) this.stack.markChannelsDirty();

    }

    /**
     * Returns the layer to its start-of-run state. Called by `MotionStack.reset()` after the
     * layer's random stream has been rewound.
     *
     * A layer that holds internal state — a blink's phase, a gaze target, a noise cursor — MUST
     * override this, or a second critic run in the same process starts mid-blink and diverges
     * from the first. Rewinding the random stream alone is not enough.
     */
    reset() {}

    /** Releases anything the layer holds. The stack calls this on remove() and dispose(). */
    dispose() {}

}

/**
 * What one layer says it wants, for one frame.
 *
 * Storage is allocated once from the declaration and reused forever; `clear()` resets values in
 * place rather than dropping the maps. Nothing here is weighted or clamped — the layer states its
 * intent at full strength and the stack decides what that is worth.
 *
 * A channel left at its neutral value (0 for a morph, identity for a rotation, zero for an offset)
 * counts as "not written" and does not appear in the conflict report. That is why a blink layer
 * can declare the eyelids permanently without claiming them on every frame.
 */
export class MotionContribution {

    constructor( ownerName, morphChannels, boneChannels ) {

        this.ownerName = ownerName;

        this.morphs = new Map();
        this.boneRotations = new Map();
        this.boneOffsets = new Map();

        for ( const channel of morphChannels ) {

            this.morphs.set( channel, 0 );

        }

        for ( const channel of boneChannels ) {

            this.boneRotations.set( channel, new Quaternion() );
            this.boneOffsets.set( channel, new Vector3() );

        }

    }

    /** Returns every channel to neutral. Called by the stack immediately before `update()`. */
    clear() {

        for ( const channel of this.morphs.keys() ) {

            this.morphs.set( channel, 0 );

        }

        for ( const rotation of this.boneRotations.values() ) {

            rotation.set( 0, 0, 0, 1 );

        }

        for ( const offset of this.boneOffsets.values() ) {

            offset.set( 0, 0, 0 );

        }

    }

    /**
     * States this layer's morph value. Not clamped here — the stack clamps the sum, and knowing
     * how far past 1 the layers collectively pushed is exactly what the conflict report reports.
     */
    setMorph( channel, value ) {

        this.assertDeclared( this.morphs, channel, 'morph', 'morphChannels' );
        this.morphs.set( channel, value );

        return this;

    }

    /** Adds to whatever this layer has already said about the channel this frame. */
    addMorph( channel, value ) {

        this.assertDeclared( this.morphs, channel, 'morph', 'morphChannels' );
        this.morphs.set( channel, this.morphs.get( channel ) + value );

        return this;

    }

    /**
     * States a rotation delta from the bone's rest pose, in the bone's local space. Deltas, never
     * absolutes: an absolute would silently discard every other layer on that bone.
     */
    rotateBone( channel, quaternion ) {

        this.assertDeclared( this.boneRotations, channel, 'bone', 'boneChannels' );
        this.boneRotations.get( channel ).copy( quaternion );

        return this;

    }

    /**
     * The same thing in radians about the bone's local axes, which is how breath, sway and
     * posture are actually specified. Replaces whatever rotation this layer already stated.
     */
    rotateBoneEuler( channel, x, y, z, order = 'XYZ' ) {

        scratchEuler.set( x, y, z, order );
        scratchQuaternion.setFromEuler( scratchEuler );

        return this.rotateBone( channel, scratchQuaternion );

    }

    /**
     * States a translation offset from the bone's rest position, in metres, in the bone's local
     * space. Offsets add across layers rather than composing, because millimetre-scale breath and
     * sway displacements are what use this and they superpose linearly at that amplitude.
     */
    offsetBone( channel, x, y, z ) {

        this.assertDeclared( this.boneOffsets, channel, 'bone', 'boneChannels' );
        this.boneOffsets.get( channel ).set( x, y, z );

        return this;

    }

    // --- helpers ---------------------------------------------------------------------------

    assertDeclared( storage, channel, kind, declarationField ) {

        if ( storage.has( channel ) ) return;

        throw new Error(
            `Layer "${ this.ownerName }" wrote ${ kind } channel "${ channel }" without declaring it. ` +
            `Add "${ channel }" to the layer's ${ declarationField }. Declaration is how the stack ` +
            'masks bones and how it names both sides of a channel conflict.'
        );

    }

}
