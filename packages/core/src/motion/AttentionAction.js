/**
 * Experimental, user-invoked attention study. Samples the current camera once, using the head
 * origin and Gaze's resolved rig frame. This is directed attention, not calibrated binocular
 * eye contact, continuous camera tracking, an emotion, or a general action API.
 *
 * Art choices: settle head noise over .5 s; incline head 2.6° and spine -1° over .25–.85 s;
 * release over 2.6–3.4 s. Face, speech and affect are owned by their existing layers.
 */
import { Matrix4, Quaternion, Vector3 } from 'three';
import { Layer } from './Layer.js';
import { toBoneDeltaFrame } from './Breath.js';

const AXIS = new Vector3( 1, 0, 0 );
const RAD = Math.PI / 180;
const POSE = [ [ 'head', 2.6 ], [ 'spine_01', -1 ] ];
const smooth = u => { u = Math.max( 0, Math.min( 1, u ) ); return u ** 3 * ( u * ( u * 6 - 15 ) + 10 ); };

/** Pure target calculation, shared by the action and its transformed-camera tests. */
export function attentionTargetFromCamera( camera, head, rigRoot ) {
    if ( !camera?.isCamera || !head?.isObject3D || !rigRoot?.isObject3D )
        throw new TypeError( 'Attention needs a camera, head and resolved gaze rig.' );
    camera.updateWorldMatrix( true, false );
    head.updateWorldMatrix( true, false );
    rigRoot.updateWorldMatrix( true, false );
    const determinant = rigRoot.matrixWorld.determinant();
    if ( !Number.isFinite( determinant ) || Math.abs( determinant ) < 1e-12 )
        throw new RangeError( 'The gaze rig has an invalid transform.' );
    const inverse = new Matrix4().copy( rigRoot.matrixWorld ).invert();
    const origin = head.getWorldPosition( new Vector3() ).applyMatrix4( inverse );
    const direction = camera.getWorldPosition( new Vector3() ).applyMatrix4( inverse ).sub( origin );
    if ( !direction.toArray().every( Number.isFinite ) || direction.lengthSq() < 1e-12 )
        throw new RangeError( 'The view must be away from the avatar’s head.' );
    direction.normalize();
    return { yawDegrees: Math.atan2( direction.x, direction.z ) / RAD,
        pitchDegrees: Math.asin( Math.max( -1, Math.min( 1, direction.y ) ) ) / RAD };
}

export class AttentionAction {
    constructor( avatar ) {
        this.stack = avatar?.stack;
        this.gaze = avatar?.layers?.gaze;
        this.idle = avatar?.layers?.idle;
        this.disposed = false;
        this.phase = 'idle';
        this.time = 0;
        this.poseWeight = 0;
        this.settleWeight = 0;
        this.gazeHold = null;
        this.headScale = null;
        this.target = null;
        this.assertReady();
        // These channels must already have an owner: removing this helper must leave the stack
        // able to restore their rest pose on the next frame.
        for ( const [ name ] of POSE ) {
            if ( !this.stack.target.getBone( name ) || !this.stack.restRotationOf( name ) )
                throw new Error( `Attention needs an existing motion owner for ${ name }.` );
        }
        const owner = this;
        class Control extends Layer {
            constructor() { super( { name: 'attentionControl', order: 50 } ); }
            update( dt ) { owner.advance( dt ); return null; }
            onBind() { owner.retire(); }
            reset() { owner.retire(); }
            dispose() { owner.retire(); }
        }
        class Pose extends Layer {
            constructor() {
                super( { name: 'attentionPose', order: 450, boneChannels: POSE.map( p => p[ 0 ] ) } );
                this.frames = new Map();
                this.rigRotation = new Quaternion();
                this.localRotation = new Quaternion();
            }
            onBind() { owner.retire(); this.frames.clear(); }
            reset() { owner.retire(); }
            dispose() { owner.retire(); }
            update() {
                if ( owner.poseWeight === 0 ) return null;
                for ( const [ name, degrees ] of POSE ) {
                    this.rigRotation.setFromAxisAngle( AXIS, degrees * RAD * owner.poseWeight );
                    toBoneDeltaFrame( this.rigRotation, this.frames.get( name ), this.localRotation );
                    this.contribution.rotateBone( name, this.localRotation );
                }
                return this.contribution;
            }
        }
        this.control = new Control();
        this.pose = new Pose();
        try {
            this.stack.add( this.control );
            this.stack.add( this.pose );
        } catch ( error ) {
            // add registers before onBind. Use the original instances even for a failed add.
            this.dispose();
            throw error;
        }
    }

    assertReady() {
        if ( this.disposed || !this.stack?.target || !this.gaze?.holdTarget || !this.idle?.acquireHeadScale
            || this.gaze.stack !== this.stack || this.gaze.head.stack !== this.stack || this.idle.stack !== this.stack )
            throw new Error( 'Attention needs an active Avatar motion stack.' );
        if ( this.control && ( this.control.stack !== this.stack || this.pose.stack !== this.stack ) )
            throw new Error( 'This attention control has been removed.' );
        if ( !this.gaze.enabled || !this.gaze.head.enabled )
            throw new Error( 'Enable gaze and head motion before using attention.' );
        if ( this.gaze.headBone !== this.stack.target.getBone( this.gaze.headBoneName ) )
            throw new Error( 'Wait for the avatar to finish changing before using attention.' );
    }

    /** A new invocation blends from the current envelope and supersedes the previous gaze hold. */
    lookAtCamera( camera ) {
        this.assertReady();
        const target = attentionTargetFromCamera( camera, this.gaze.headBone, this.gaze.rigRoot );
        // Conservative art-study reach, within the native head limits. This action has no body
        // turn. Reject unsupported views before changing an existing valid action.
        if ( Math.abs( target.yawDegrees ) > 55 || Math.abs( target.pitchDegrees ) > 25 )
            throw new RangeError( 'Move the view nearer the front and eye level, then try again.' );
        const frames = new Map();
        for ( const [ name ] of POSE ) {
            const bone = this.stack.target.getBone( name );
            if ( !bone || !this.stack.restRotationOf( name ) ) throw new Error( `Attention is missing ${ name }.` );
            const frame = new Quaternion();
            for ( let node = bone; node && node !== this.gaze.rigRoot; node = node.parent )
                frame.premultiply( this.stack.restRotationOf( node.name ) ?? node.quaternion );
            frames.set( name, frame.normalize() );
        }
        // Acquire the fallible independent resource before superseding a valid gaze hold.
        // Failed starts preserve an existing action and cannot leave an invisible policy hold.
        const acquiredScale = !this.headScale?.active;
        const scale = acquiredScale ? this.idle.acquireHeadScale() : this.headScale;
        let hold;
        try { hold = this.gaze.holdTarget( target, { predicted: true } ); }
        catch ( error ) { if ( acquiredScale ) scale.release(); throw error; }
        this.gazeHold = hold;
        this.headScale = scale;
        this.pose.frames = frames;
        this.startPose = this.poseWeight;
        this.startSettle = this.settleWeight;
        this.time = 0;
        this.phase = 'attending';
        this.target = target;
        return this;
    }

    cancel( { immediate = false } = {} ) {
        if ( immediate ) { this.retire(); return this; }
        if ( this.phase === 'idle' || this.phase === 'releasing' ) return this;
        this.gazeHold?.release();
        this.gazeHold = null;
        this.phase = 'releasing';
        this.time = 0;
        this.startPose = this.poseWeight;
        this.startSettle = this.settleWeight;
        return this;
    }

    advance( dt ) {
        if ( this.phase === 'idle' ) return;
        if ( this.phase === 'attending' && ( !this.gazeHold?.active || !this.headScale?.active
            || !this.gaze.enabled || !this.gaze.head.enabled
            || this.gaze.stack !== this.stack || this.gaze.head.stack !== this.stack
            || this.idle.stack !== this.stack ) ) this.cancel();
        this.time += dt;
        if ( this.phase === 'releasing' ) {
            const release = 1 - smooth( this.time / 0.3 );
            this.poseWeight = this.startPose * release;
            this.settleWeight = this.startSettle * release;
            if ( this.time >= 0.3 ) { this.retire(); return; }
        } else {
            const release = 1 - smooth( ( this.time - 2.6 ) / 0.8 );
            this.poseWeight = ( this.startPose + ( 1 - this.startPose ) * smooth( ( this.time - 0.25 ) / 0.6 ) ) * release;
            this.settleWeight = ( this.startSettle + ( 1 - this.startSettle ) * smooth( this.time / 0.5 ) ) * release;
            if ( this.time >= 3.4 ) { this.retire(); return; }
        }
        this.headScale?.set( 1 - 0.75 * this.settleWeight );
    }

    /** In-place cleanup is safe inside the stack's reset/bind/dispose iteration. */
    retire() {
        this.gazeHold?.release();
        this.headScale?.release();
        this.gazeHold = this.headScale = null;
        this.phase = 'idle';
        this.time = this.poseWeight = this.settleWeight = 0;
    }

    report() {
        return { phase: this.phase, time: this.time, poseWeight: this.poseWeight,
            headNoiseScale: 1 - 0.75 * this.settleWeight,
            target: this.target ? { ...this.target } : null,
            holdsGaze: this.gazeHold?.active === true };
    }

    dispose() {
        if ( this.disposed ) return;
        this.disposed = true;
        this.retire();
        this.stack.remove( this.control );
        this.stack.remove( this.pose );
    }
}
