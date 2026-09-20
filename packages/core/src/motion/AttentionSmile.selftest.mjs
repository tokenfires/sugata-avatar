import assert from 'node:assert/strict';
import { Bone, Object3D, PerspectiveCamera } from 'three';
import { MotionStack } from './MotionStack.js';
import { Layer } from './Layer.js';
import { Gaze } from './Gaze.js';
import { IdleMotion } from './IdleMotion.js';
import { AttentionAction } from './AttentionAction.js';
import { AttentionSmile } from './AttentionSmile.js';
import { VisemeLayer } from '../voice/VisemeLayer.js';
import { OVR_VISEMES } from '../voice/Visemes.js';

let checks = 0;
function test( name, fn ) { fn(); checks++; console.log( `PASS ${ name }` ); }
function near( a, b ) { assert.ok( Math.abs( a - b ) < 1e-12, `${ a } != ${ b }` ); }
class Prefix extends Layer {
    constructor( left, right = left, order = 910, name = 'prefix' ) {
        super( { name, order, morphChannels: [ 'mouthSmileLeft', 'mouthSmileRight' ] } );
        this.left = left; this.right = right;
    }
    update() {
        this.contribution.setMorph( 'mouthSmileLeft', this.left );
        this.contribution.setMorph( 'mouthSmileRight', this.right );
        return this.contribution;
    }
}
function fixture( { full = false, missing = false } = {} ) {
    const world = new Object3D(), rig = new Object3D(); world.add( rig );
    const weights = {}, stack = new MotionStack( { seed: 1 } );
    const target = { hasMorph: name => !missing || !name.startsWith( 'mouthSmile' ),
        setMorph: ( name, value ) => weights[ name ] = value,
        getBone: name => rig.getObjectByName( name ) ?? null };
    let action, gaze, idle, camera;
    if ( full ) {
        const spine = new Bone(), neck = new Bone(), head = new Bone();
        spine.name = 'spine_01'; neck.name = 'neck_01'; head.name = 'head';
        rig.add( spine ); spine.add( neck ); neck.add( head ); neck.position.y = 1.4; head.position.y = .2;
        idle = new IdleMotion( { armsEnabled: true } );
        for ( const name of Object.values( idle.bones ) ) if ( !rig.getObjectByName( name ) ) {
            const bone = new Bone(); bone.name = name; rig.add( bone );
        }
        gaze = new Gaze( { rigRoot: rig, blinkCoupling: false } );
        stack.add( new Layer( { name: 'base', boneChannels: [ 'spine_01' ] } ) );
        stack.add( idle ); stack.add( gaze.head ); stack.add( gaze );
        world.updateMatrixWorld( true ); stack.bind( target );
        camera = new PerspectiveCamera(); camera.position.set( .3, 1.6, 2 ); world.add( camera );
        action = new AttentionAction( { stack, layers: { gaze, idle } } );
    } else {
        action = { smileWeight: 0, retire() { this.smileWeight = 0; } };
        action.smile = new AttentionSmile( action ); stack.add( action.smile ); stack.bind( target );
    }
    const tick = ( count = 1, dt = 1 / 60 ) => {
        for ( let i = 0; i < count; i++ ) { stack.update( dt ); world.updateMatrixWorld( true ); }
    };
    return { world, rig, weights, stack, target, action, cue: action.smile, gaze, idle, camera, tick };
}
const warm = f => f.action.lookAtCamera( f.camera, { expression: 'soft-smile' } );

test( 'qualified neutral cue is symmetric and bounded by its authored peak', () => {
    const f = fixture(); f.stack.add( new Prefix( .035, .04 ) );
    f.action.smileWeight = 1; f.tick(); assert.equal( f.cue.amount, .18 );
    near( f.weights.mouthSmileLeft, .215 ); near( f.weights.mouthSmileRight, .22 );
    f.action.smileWeight = 2; f.tick(); assert.equal( f.cue.amount, .18 );
    for ( const value of [ NaN, Infinity, -1 ] ) {
        f.action.smileWeight = value; f.tick(); assert.equal( f.cue.amount, 0 );
    }
    f.stack.dispose();
} );
test( 'current weighted prefix budgets only the new addition, preserving existing overages', () => {
    const f = fixture(), prefix = new Prefix( .30, .31, 700 );
    f.stack.add( prefix ); f.stack.add( new Prefix( .02, .025, 910, 'idle' ) );
    f.action.smileWeight = 1; f.tick(); near( f.cue.amount, .015 );
    near( f.weights.mouthSmileRight, .35 ); assert.equal( f.cue.status, 'limited' );
    prefix.weight = .5; f.tick(); near( f.cue.amount, .17 );
    prefix.weight = 1; prefix.left = prefix.right = .35; f.tick();
    assert.equal( f.cue.amount, 0 ); near( f.weights.mouthSmileLeft, .37 ); near( f.weights.mouthSmileRight, .375 );
    f.stack.dispose();
} );
test( 'late declarations, missing shapes and weighted cue decline without erasing other owners', () => {
    const f = fixture(), later = new Prefix( .1, .2, 1000 ); f.stack.add( later );
    f.action.smileWeight = 1; f.tick(); assert.equal( f.cue.status, 'later-smile-writer' );
    near( f.weights.mouthSmileRight, .2 ); later.enabled = false;
    assert.equal( f.cue.support(), 'later-smile-writer' ); f.stack.remove( later );
    f.cue.weight = .5; f.tick(); assert.equal( f.cue.amount, 0 );
    f.cue.weight = 1; f.stack.target.hasMorph = () => false; f.tick();
    assert.equal( f.cue.status, 'missing-smile-morphs' ); f.stack.dispose();
} );
test( 'viseme contribution is unchanged while mixed smile uses the remaining budget', () => {
    const f = fixture(), values = Object.fromEntries( OVR_VISEMES.map( name => [ name, 0 ] ) );
    values.viseme_aa = .6;
    const viseme = new VisemeLayer( { schedule: { update: () => values, stop() {} } } );
    const prefix = new Prefix( .2 ); f.stack.add( viseme ); f.stack.add( prefix );
    f.action.smileWeight = 1; f.tick(); near( f.cue.amount, .15 ); near( f.weights.viseme_aa, .6 );
    assert.equal( f.stack.context.shared.speaking, true );
    values.viseme_aa = 0; f.tick(); near( f.cue.amount, .15 ); assert.equal( f.stack.context.shared.speaking, false );
    f.stack.dispose();
} );
test( 'fresh smile follows the reviewed pose envelope and naturally returns to zero', () => {
    const f = fixture( { full: true } ); warm( f );
    for ( let i = 0; i < 205; i++ ) {
        f.tick(); near( f.action.smileWeight, f.action.poseWeight );
        near( f.weights.mouthSmileLeft, .18 * f.action.smileWeight );
    }
    assert.equal( f.action.phase, 'idle' ); assert.equal( f.action.expression, 'neutral' );
    assert.equal( f.weights.mouthSmileLeft, 0 ); assert.equal( f.idle.headScales.size, 0 ); f.stack.dispose();
} );
test( 'neutral and smile repeats preserve the current committed cue at zero elapsed time', () => {
    const f = fixture( { full: true } );
    for ( const initial of [ 'neutral', 'soft-smile' ] ) for ( const next of [ 'neutral', 'soft-smile' ] ) {
        f.action.cancel( { immediate: true } ); f.action.lookAtCamera( f.camera, { expression: initial } ); f.tick( 60 );
        const before = f.weights.mouthSmileLeft, pose = f.action.poseWeight;
        f.action.lookAtCamera( f.camera, { expression: next } ); f.tick( 1, 0 );
        near( f.weights.mouthSmileLeft, before ); near( f.action.poseWeight, pose );
        f.tick( 60 ); near( f.weights.mouthSmileLeft, next === 'soft-smile' ? .18 : 0 );
    }
    f.action.cancel(); f.tick( 5 ); const fading = f.weights.mouthSmileLeft;
    warm( f ); f.tick( 1, 0 ); near( f.weights.mouthSmileLeft, fading );
    f.stack.dispose();
} );
test( 'invalid repeated requests preserve old smile, resources, pose and target', () => {
    const f = fixture( { full: true } ); warm( f ); f.tick( 60 );
    function rejects( request, pattern ) {
        const before = f.action.report(), hold = f.action.gazeHold, scale = f.action.headScale;
        const starts = [ f.action.startSmile, f.action.startPose, f.action.startSettle ];
        assert.throws( request, pattern ); assert.deepEqual( f.action.report(), before );
        assert.equal( f.action.gazeHold, hold ); assert.ok( hold.active ); assert.equal( f.action.headScale, scale );
        assert.deepEqual( [ f.action.startSmile, f.action.startPose, f.action.startSettle ], starts );
    }
    rejects( () => f.action.lookAtCamera( f.camera, { expression: 'grin' } ), /Choose neutral/ );
    f.camera.position.z = -2; rejects( () => warm( f ), /nearer the front/ ); f.camera.position.z = 2;
    const later = new Prefix( 0, 0, 1000 ); f.stack.add( later ); rejects( () => warm( f ), /later-smile-writer/ ); f.stack.remove( later );
    f.target.hasMorph = () => false; rejects( () => warm( f ), /missing-smile/ ); f.stack.dispose();
} );
test( 'neutral action remains available without the optional smile shapes', () => {
    const f = fixture( { full: true, missing: true } );
    f.action.lookAtCamera( f.camera ); f.tick( 60 ); assert.equal( f.action.poseWeight, 1 );
    assert.throws( () => warm( f ), /missing-smile/ ); assert.equal( f.action.phase, 'attending' ); f.stack.dispose();
} );
test( 'release and new gaze or speech cues fade only the old owned smile', () => {
    for ( const kind of [ 'release', 'look', 'speech', 'policy' ] ) {
        const f = fixture( { full: true } ); warm( f ); f.tick( 60 ); const hold = f.action.gazeHold;
        if ( kind === 'release' ) f.action.cancel();
        if ( kind === 'look' ) f.gaze.lookAt( { yawDegrees: -8 } );
        if ( kind === 'speech' ) f.gaze.markFilledPause( { durationSeconds: .5 } );
        if ( kind === 'policy' ) f.gaze.setPolicyEnabled( false );
        assert.equal( hold.active, false ); f.tick();
        assert.equal( f.action.phase, 'releasing' ); assert.ok( f.weights.mouthSmileLeft > 0 && f.weights.mouthSmileLeft < .18 );
        let prior = f.weights.mouthSmileLeft;
        for ( let i = 0; i < 21; i++ ) { f.tick(); assert.ok( f.weights.mouthSmileLeft <= prior ); prior = f.weights.mouthSmileLeft; }
        assert.equal( f.action.phase, 'idle' ); assert.equal( f.weights.mouthSmileLeft, 0 );
        if ( kind === 'policy' ) assert.equal( f.gaze.policyEnabled, false ); f.stack.dispose();
    }
} );
test( 'reset, rebind, removal and disposal restore committed smile channels', () => {
    for ( const kind of [ 'immediate', 'reset', 'bind', 'smile', 'pose', 'control', 'dispose' ] ) {
        const f = fixture( { full: true } ); f.stack.add( new Prefix( .03 ) ); warm( f ); f.tick( 60 );
        if ( kind === 'immediate' ) f.action.cancel( { immediate: true } );
        if ( kind === 'reset' ) f.stack.reset();
        if ( kind === 'bind' ) f.stack.bind( f.target );
        if ( [ 'smile', 'pose', 'control' ].includes( kind ) ) f.stack.remove( f.action[ kind ] );
        if ( kind === 'dispose' ) f.action.dispose();
        f.tick( 1, 0 ); assert.equal( f.action.phase, 'idle' ); near( f.weights.mouthSmileLeft, .03 );
        assert.equal( f.idle.headScales.size, 0 ); assert.equal( f.gaze.policyEnabled, true );
        f.action.dispose(); f.stack.dispose();
    }
    const f = fixture( { full: true } ); warm( f ); f.tick( 60 ); f.stack.remove( f.cue ); f.tick( 1, 0 );
    assert.equal( f.weights.mouthSmileLeft, 0 ); f.stack.dispose();
} );
test( 'third registration failure rolls back only its new layers and duplicate owner leaves the old one live', () => {
    const f = fixture( { full: true } ); warm( f ); f.tick( 60 ); const before = f.action.report();
    const avatar = { stack: f.stack, layers: { gaze: f.gaze, idle: f.idle } };
    assert.throws( () => new AttentionAction( avatar ), /already/ );
    assert.deepEqual( f.action.report(), before ); assert.ok( f.action.gazeHold.active );
    f.action.dispose(); const layers = [ ...f.stack.layers ]; const add = f.stack.add.bind( f.stack );
    f.stack.add = layer => { if ( layer.name === 'attentionSmile' ) layer.onBind = () => { throw Error( 'injected third bind failure' ); }; return add( layer ); };
    assert.throws( () => new AttentionAction( avatar ), /injected third/ );
    assert.deepEqual( f.stack.layers, layers ); assert.equal( f.idle.headScales.size, 0 );
    assert.equal( f.gaze.policyEnabled, true ); f.stack.dispose();
} );
test( 'disabled timing control releases the held pose and cannot acquire a new action', () => {
    const f = fixture( { full: true } ); warm( f ); f.tick( 60 );
    f.action.control.enabled = false; const before = f.action.report();
    assert.throws( () => warm( f ), /Enable the attention control/ );
    assert.deepEqual( f.action.report(), before );
    f.tick(); assert.equal( f.action.phase, 'idle' ); assert.equal( f.weights.mouthSmileLeft, 0 );
    assert.equal( f.idle.headScales.size, 0 ); assert.equal( f.gaze.policyEnabled, true );
    f.action.control.enabled = true; f.tick(); assert.equal( f.weights.mouthSmileLeft, 0 );
    warm( f ); f.tick( 60 ); f.action.cancel(); f.action.control.enabled = false;
    f.tick(); assert.equal( f.action.phase, 'idle' ); assert.equal( f.weights.mouthSmileLeft, 0 );
    f.stack.dispose();
} );
console.log( `${ checks } optional smile groups passed (CPU; rendered composition is separate).` );
