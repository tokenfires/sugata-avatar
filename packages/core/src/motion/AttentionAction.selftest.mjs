import assert from 'node:assert/strict';
import { Bone, Object3D, PerspectiveCamera, Quaternion, Vector3 } from 'three';
import { MotionStack } from './MotionStack.js';
import { Layer } from './Layer.js';
import { Gaze } from './Gaze.js';
import { IdleMotion } from './IdleMotion.js';
import { AttentionAction, attentionTargetFromCamera } from './AttentionAction.js';
const checks = [];
function test( name, fn ) { fn(); checks.push( name ); console.log( `PASS ${ name }` ); }
function fixture( { policy = true, explicitRig = true } = {} ) {
    const world = new Object3D(), rig = new Object3D(), spine = new Bone(), neck = new Bone(), head = new Bone();
    spine.name = 'spine_01'; neck.name = 'neck_01'; head.name = 'head';
    world.add( rig ); rig.add( spine ); spine.add( neck ); neck.add( head );
    neck.position.y = 1.4; head.position.y = .2;
    const idle = new IdleMotion( { armsEnabled: true } );
    for ( const name of Object.values( idle.bones ) ) if ( !rig.getObjectByName( name ) ) {
        const bone = new Bone(); bone.name = name; rig.add( bone );
    }
    const gaze = new Gaze( { policy, blinkCoupling: false, ...( explicitRig ? { rigRoot: rig } : {} ) } );
    const stack = new MotionStack( { seed: 1 } );
    const base = new Layer( { name: 'base', boneChannels: [ 'spine_01' ] } );
    stack.add( base ); stack.add( idle ); stack.add( gaze.head ); stack.add( gaze );
    const target = { hasMorph: () => true, setMorph() {}, getBone: n => rig.getObjectByName( n ) ?? null };
    world.updateMatrixWorld( true ); stack.bind( target );
    const camera = new PerspectiveCamera(); camera.position.set( .3, 1.6, 2 ); world.add( camera );
    const avatar = { stack, layers: { gaze, idle } };
    return { world, rig, head, camera, gaze, idle, stack, avatar, target, base };
}
function tick( f, count ) { for ( let i = 0; i < count; i++ ) { f.stack.update( 1 / 60 ); f.world.updateMatrixWorld( true ); } }
const command = { yawDegrees: 12, pitchDegrees: 0 };

test( 'gaze holds restore the original true or false policy exactly once', () => {
    for ( const policy of [ true, false ] ) {
        const f = fixture( { policy } ), h = f.gaze.holdTarget( command );
        assert.equal( f.gaze.policyEnabled, false ); assert.ok( h.release() );
        assert.equal( f.gaze.policyEnabled, policy ); assert.equal( h.release(), false ); f.stack.dispose();
    }
} );
test( 'new look, partner, speech cue, policy, reset and bind supersede old holds', () => {
    for ( const kind of [ 'look', 'partner', 'filled', 'turn', 'policy', 'reset', 'bind', 'dispose' ] ) {
        const f = fixture(), h = f.gaze.holdTarget( command );
        if ( kind === 'look' ) f.gaze.lookAt( { yawDegrees: -8 } );
        if ( kind === 'partner' ) f.gaze.setPartnerDirection( { yawDegrees: -8 } );
        if ( kind === 'filled' ) f.gaze.markFilledPause( { durationSeconds: .5 } );
        if ( kind === 'turn' ) f.gaze.markTurnEnd();
        if ( kind === 'policy' ) f.gaze.setPolicyEnabled( false );
        if ( kind === 'reset' ) f.stack.reset();
        if ( kind === 'bind' ) f.stack.bind( f.target );
        if ( kind === 'dispose' ) f.stack.dispose();
        assert.equal( h.active, false, kind ); const policy = f.gaze.policyEnabled;
        assert.equal( h.release(), false ); assert.equal( f.gaze.policyEnabled, policy );
        if ( kind === 'policy' ) assert.equal( policy, false );
        if ( kind === 'filled' ) { tick( f, 60 ); assert.equal( f.gaze.forcedRegion, null ); }
        f.stack.dispose();
    }
} );
test( 'overlapping holds and invalid repeat preserve ownership', () => {
    const f = fixture(), first = f.gaze.holdTarget( command ), next = f.gaze.holdTarget( { yawDegrees: 5 } );
    assert.equal( first.release(), false ); assert.ok( next.active );
    assert.throws( () => f.gaze.holdTarget( new Vector3() ) );
    assert.throws( () => f.gaze.holdTarget( { yawDegrees: NaN } ) ); assert.ok( next.active );
    next.release(); assert.equal( f.gaze.policyEnabled, true ); f.stack.dispose();
} );
test( 'head scales damp only head and compose without overwriting base settings', () => {
    const a = fixture(), b = fixture(); const h = b.idle.acquireHeadScale(), other = b.idle.acquireHeadScale();
    h.set( .5 ); other.set( 0 ); tick( a, 44 ); tick( b, 44 );
    const qa = a.idle.contribution.boneRotations, qb = b.idle.contribution.boneRotations;
    assert.ok( qa.get( 'head' ).angleTo( new Quaternion() ) > 0 );
    assert.ok( qb.get( 'head' ).angleTo( new Quaternion() ) < 1e-7 );
    for ( const [ name, q ] of qa ) if ( name !== 'head' ) assert.deepEqual( qb.get( name ).toArray(), q.toArray(), name );
    b.idle.amplitude = .7; b.idle.weight = .6; b.idle.headEnabled = false;
    h.release(); assert.ok( other.active ); other.release();
    assert.equal( b.idle.amplitude, .7 ); assert.equal( b.idle.weight, .6 ); assert.equal( b.idle.headEnabled, false );
    assert.throws( () => h.set( NaN ) ); assert.equal( h.set( .3 ), false );
    const reset = b.idle.acquireHeadScale(); b.stack.reset(); assert.equal( reset.active, false );
    a.stack.dispose(); b.stack.dispose();
} );
test( 'target geometry uses world camera and resolved rig under rotation and nonuniform scale', () => {
    for ( const explicitRig of [ true, false ] ) {
        const f = fixture( { explicitRig } ); f.rig.rotation.set( .1, .35, -.04 );
        f.rig.position.set( 3, .4, -2 ); f.rig.scale.set( 1.2, .8, 1.4 );
        const parent = new Object3D(); parent.position.set( -4, 2, 1 ); parent.rotation.set( .2, -.8, .15 );
        f.world.add( parent ); parent.add( f.camera ); f.world.updateMatrixWorld( true );
        const root = f.gaze.rigRoot, yaw = 25 * Math.PI / 180, pitch = 7 * Math.PI / 180;
        const local = root.worldToLocal( f.head.getWorldPosition( new Vector3() ) );
        local.addScaledVector( new Vector3( Math.sin( yaw ) * Math.cos( pitch ), Math.sin( pitch ), Math.cos( yaw ) * Math.cos( pitch ) ), 2 );
        const goal = root.localToWorld( local ); f.camera.position.copy( parent.worldToLocal( goal ) );
        const result = attentionTargetFromCamera( f.camera, f.head, root );
        assert.ok( Math.abs( result.yawDegrees - 25 ) < 1e-10 ); assert.ok( Math.abs( result.pitchDegrees - 7 ) < 1e-10 );
        f.rig.scale.setScalar( 0 );
        assert.throws( () => attentionTargetFromCamera( f.camera, f.head, f.rig ), /invalid transform/ ); f.stack.dispose();
    }
} );
test( 'normal action, repeat and invalid view do not pop or reset current ownership', () => {
    const f = fixture(), action = new AttentionAction( f.avatar );
    let calls = 0; const original = f.gaze.holdTarget.bind( f.gaze );
    f.gaze.holdTarget = ( ...args ) => { calls++; return original( ...args ); };
    action.lookAtCamera( f.camera ); tick( f, 60 ); const before = action.report();
    assert.equal( calls, 1 ); assert.equal( before.poseWeight, 1 );
    action.lookAtCamera( f.camera ); f.stack.update( 0 );
    assert.equal( action.report().poseWeight, before.poseWeight ); assert.equal( calls, 2 );
    f.camera.position.z = -2; assert.throws( () => action.lookAtCamera( f.camera ), /nearer the front/ );
    assert.equal( action.phase, 'attending' ); assert.equal( calls, 2 );
    tick( f, 205 ); assert.equal( action.phase, 'idle' ); assert.equal( f.gaze.policyEnabled, true );
    assert.equal( f.idle.headScales.size, 0 ); action.dispose(); action.dispose(); assert.equal( f.stack.layers.length, 4 ); f.stack.dispose();
} );
test( 'cancel and external supersession release own pose without touching newer gaze or base idle', () => {
    const f = fixture(), action = new AttentionAction( f.avatar ); action.lookAtCamera( f.camera ); tick( f, 60 );
    f.idle.amplitude = .8; f.idle.weight = .6; f.gaze.setPolicyEnabled( false );
    tick( f, 20 ); assert.equal( action.phase, 'idle' ); assert.equal( f.gaze.policyEnabled, false );
    assert.equal( f.idle.amplitude, .8 ); assert.equal( f.idle.weight, .6 );
    action.lookAtCamera( f.camera ); tick( f, 35 ); action.cancel();
    assert.equal( action.phase, 'releasing' ); tick( f, 20 ); assert.equal( action.phase, 'idle' );
    action.lookAtCamera( f.camera ); tick( f, 40 ); action.cancel( { immediate: true } ); f.stack.update( 0 );
    assert.equal( action.poseWeight, 0 ); assert.equal( f.idle.headScales.size, 0 ); f.stack.dispose();
} );
test( 'reset, rebind, stack disposal and failed registration leave natural owners intact', () => {
    const f = fixture(), action = new AttentionAction( f.avatar ); action.lookAtCamera( f.camera ); tick( f, 40 );
    f.stack.reset(); assert.equal( action.phase, 'idle' ); action.lookAtCamera( f.camera );
    f.stack.update( 0 ); assert.equal( action.time, 0 );
    const next = fixture(); f.stack.bind( next.target ); assert.equal( action.phase, 'idle' );
    action.lookAtCamera( next.camera ); tick( f, 20 );
    let naturalDisposed = 0; f.base.dispose = () => naturalDisposed++;
    f.stack.dispose(); assert.equal( naturalDisposed, 1 ); assert.equal( action.phase, 'idle' );
    assert.throws( () => action.lookAtCamera( next.camera ) ); action.dispose(); next.stack.dispose();
    const g = fixture(); const count = g.stack.layers.length; const add = g.stack.add.bind( g.stack );
    g.stack.add = layer => { if ( layer.name === 'attentionPose' ) layer.onBind = () => { throw new Error( 'injected bind failure' ); }; return add( layer ); };
    assert.throws( () => new AttentionAction( g.avatar ), /injected/ ); assert.equal( g.stack.layers.length, count );
    assert.equal( g.idle.headScales.size, 0 ); g.stack.dispose();
} );
test( 'failed acquisition and loss of the native gaze-head layer cannot strand a hold', () => {
    const f = fixture(), action = new AttentionAction( f.avatar );
    const acquire = f.idle.acquireHeadScale.bind( f.idle );
    f.idle.acquireHeadScale = () => { throw new Error( 'injected acquisition failure' ); };
    assert.throws( () => action.lookAtCamera( f.camera ), /injected/ );
    assert.equal( action.phase, 'idle' ); assert.equal( f.gaze.policyEnabled, true );
    assert.equal( f.gaze.targetHold, null );
    f.idle.acquireHeadScale = acquire; action.lookAtCamera( f.camera ); tick( f, 50 );
    f.stack.remove( f.gaze.head ); tick( f, 20 );
    assert.equal( action.phase, 'idle' ); assert.equal( f.gaze.policyEnabled, true );
    assert.equal( f.idle.headScales.size, 0 ); action.dispose(); f.stack.dispose();
} );
console.log( `${ checks.length } attention/ownership groups passed (CPU; visual readability is separate).` );
