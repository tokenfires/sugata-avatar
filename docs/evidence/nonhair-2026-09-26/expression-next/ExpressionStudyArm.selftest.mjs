import assert from 'node:assert/strict';
import fs from 'node:fs';
import { PerspectiveCamera, Vector3 } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { MotionStack, createMotionTarget } from '../../../../packages/core/src/motion/MotionStack.js';
import { Layer } from '../../../../packages/core/src/motion/Layer.js';
import { ExpressionLayer } from '../../../../packages/core/src/affect/ExpressionLayer.js';
import { Gaze } from '../../../../packages/core/src/motion/Gaze.js';
import { IdleMotion } from '../../../../packages/core/src/motion/IdleMotion.js';
import { FacialIdle } from '../../../../packages/core/src/motion/FacialIdle.js';
import { Blink } from '../../../../packages/core/src/motion/Blink.js';
import { VisemeLayer } from '../../../../packages/core/src/voice/VisemeLayer.js';
import { OVR_VISEMES } from '../../../../packages/core/src/voice/Visemes.js';
import { calibrateEyeAim } from '../../../../packages/core/src/motion/EyeAimCalibration.js';
import { findEyeMeshes } from '../../../../packages/core/src/material/EyeMaterial.js';
import { ExpressionStudyArm, EYE_WIDE_CHANNELS, ATTENUATION, studyEnvelope, admittedCorrection, expectedCommit } from './ExpressionStudyArm.mjs';

const checks = [];
async function test( name, fn ) { await fn(); checks.push( name ); console.log( 'PASS ' + name ); }
const near = ( a, b, label = '' ) => assert.ok( Math.abs( a - b ) < 1e-12, `${ label }: ${ a } != ${ b }` );
class Writer extends Layer {
    constructor( name, order, values, weight = 1 ) {
        super( { name, order, morphChannels: Object.keys( values ), weight } ); this.values = values;
    }
    update() { for ( const [ n, v ] of Object.entries( this.values ) ) this.contribution.setMorph( n, v ); return this.contribution; }
}
function simple( { left = .4, right = .2, weight = 1, study = true } = {} ) {
    const values = { eyeWideLeft: left, eyeWideRight: right, eyeBlinkLeft: .12, browDownLeft: .2 };
    const map = { activate: () => [], face: () => ( { morphs: values, mouthCornerOffset: { smile: .11, frown: 0 } } ),
        body: () => ( {} ), clearTriggers() {} };
    const weights = {}, target = { hasMorph: () => true, setMorph: ( n, v ) => { weights[ n ] = v; }, getBone: () => null };
    const stack = new MotionStack( { seed: 20260807 } ); stack.bind( target );
    const expression = stack.add( new ExpressionLayer( { map, weight } ) );
    const avatar = { stack, expression, layers: {} };
    const f = { stack, expression, avatar, target, values, weights };
    f.study = study ? new ExpressionStudyArm( avatar, { arm: 'C' } ) : null;
    f.tick = ( n = 1, dt = 1 / 60 ) => { for ( let i = 0; i < n; i++ ) stack.update( dt ); };
    f.dispose = () => { f.study?.dispose(); stack.dispose(); };
    return f;
}
const eye = f => f.study.report().channels.eyeWideLeft;
const peak = f => { f.study.start( f.camera ); f.tick( 60 ); assert.equal( f.study.envelope, 1 ); };

await test( 'Fixed C reads the weighted current native expression; other writers, blink, brow, corners and OVR survive', () => {
    const f = simple( { weight: .5 } );
    f.stack.add( new Writer( 'foreignBefore', 650, { eyeWideLeft: .09 } ) );
    f.stack.add( new Writer( 'foreignAfter', 910, { eyeWideLeft: .07, eyeBlinkLeft: .3 } ) );
    const speech = Object.fromEntries( OVR_VISEMES.map( n => [ n, n === 'viseme_aa' ? .6 : 0 ] ) );
    f.stack.add( new VisemeLayer( { schedule: { update: () => speech, stop() {} } } ) );
    peak( f );
    near( eye( f ).expression, .2 ); near( eye( f ).requested, -.09 ); near( eye( f ).actualAdmitted, -.09 );
    near( f.weights.eyeWideLeft, .27 ); near( f.weights.eyeWideRight, .055 );
    near( f.weights.eyeBlinkLeft, .36 ); near( f.weights.browDownLeft, .1 ); near( f.weights.mouthSmileLeft, .055 );
    assert.equal( f.weights.viseme_aa, .6 ); assert.equal( f.stack.context.shared.speaking, true );
    assert.deepEqual( f.study.output.morphChannels, EYE_WIDE_CHANNELS ); assert.deepEqual( f.study.output.boneChannels, [] );
    assert.throws( () => f.study.output.contribution.setMorph( 'viseme_aa', 1 ), /without declaring/ );
    f.values.eyeWideLeft = .6; f.tick(); near( eye( f ).expression, .3 ); near( eye( f ).requested, -.135 );
    f.dispose();
} );

await test( 'Native epsilon boundaries preserve E=1.5e-6, admit exact -1e-6, and filter before expression weight', () => {
    for ( const [ value, weight, expectedE, expectedCorrection ] of [
        [ 1.5e-6, 1, 1.5e-6, 0 ], [ 1e-6 / ATTENUATION, 1, 1e-6 / ATTENUATION, -1e-6 ],
        [ 1.5e-6, .5, .75e-6, 0 ], [ 1e-6, 2, 0, 0 ] // ExpressionLayer itself omits <=1e-6.
    ] ) {
        const f = simple( { left: value, weight } ); peak( f ); const r = eye( f );
        assert.equal( r.expression, expectedE ); assert.equal( r.actualAdmitted, expectedCorrection );
        assert.equal( r.expectedAdmitted, expectedCorrection ); assert.equal( f.weights.eyeWideLeft, expectedE + expectedCorrection );
        f.dispose();
    }
    assert.equal( admittedCorrection( -1e-6 ), -1e-6 ); assert.equal( admittedCorrection( -0.999999e-6 ), 0 );
} );

await test( 'Opposing admitted writers leave a positive sub-epsilon residual; only the final sum is clamped', () => {
    const f = simple( { left: 2e-6 } );
    f.stack.add( new Writer( 'opposing', 910, { eyeWideLeft: -1.5e-6 } ) ); peak( f );
    assert.equal( eye( f ).actualAdmitted, 0 );
    assert.equal( f.weights.eyeWideLeft, 2e-6 - 1.5e-6 ); assert.ok( f.weights.eyeWideLeft > 0 && f.weights.eyeWideLeft < 1e-6 );
    assert.equal( f.weights.eyeWideLeft, expectedCommit( 2e-6, -1.5e-6, -.45 * 2e-6 ) );
    f.values.eyeWideLeft = 2; f.tick(); assert.equal( f.weights.eyeWideLeft, 1 );
    f.values.eyeWideLeft = .1; f.stack.findLayer( 'opposing' ).values.eyeWideLeft = -.5; f.tick(); assert.equal( f.weights.eyeWideLeft, 0 );
    f.dispose();
} );

await test( 'Disabled or silent expression has no stale subtraction; enabling the same owner uses its fresh writer', () => {
    const f = simple(); peak( f ); const previous = f.expression.contribution.morphs.get( 'eyeWideLeft' );
    Object.defineProperty( f.expression, 'faceResult', { get() { throw Error( 'Stale faceResult was read' ); }, set() {}, configurable: true } );
    f.expression.enabled = false; f.tick();
    assert.equal( f.expression.contribution.morphs.get( 'eyeWideLeft' ), previous, 'native disabled contribution is actually stale' );
    assert.equal( eye( f ).expression, 0 ); assert.equal( eye( f ).actualAdmitted, 0 ); assert.equal( f.weights.eyeWideLeft, 0 );
    delete f.expression.faceResult; f.expression.faceResult = null;
    f.expression.enabled = true; f.values.eyeWideLeft = .7; f.tick(); near( eye( f ).expression, .7 ); near( f.weights.eyeWideLeft, .385 );
    f.values.eyeWideLeft = f.values.eyeWideRight = 0; f.tick(); assert.equal( eye( f ).expression, 0 ); assert.equal( eye( f ).actualAdmitted, 0 );
    f.dispose();
    const absent = simple( { study: false } ); absent.avatar.expression = null;
    assert.throws( () => new ExpressionStudyArm( absent.avatar, { arm: 'C' } ), /expression-owner/ ); absent.dispose();
} );

await test( 'C rejects negative/nonfinite current owner values atomically without touching the other writers', () => {
    for ( const bad of [ -.1, NaN, Infinity ] ) {
        const f = simple(); peak( f );
        f.expression.update = function () { this.contribution.setMorph( 'eyeWideLeft', .4 ); this.contribution.setMorph( 'eyeWideRight', bad ); return this.contribution; };
        f.tick(); assert.equal( f.study.phase, 'idle' ); assert.equal( f.study.retirementReason, 'invalid-current-expression-writer' );
        for ( const n of EYE_WIDE_CHANNELS ) assert.ok( !f.stack.morphChannels.get( n ).writerNames.includes( f.study.output.name ) );
        near( f.weights.eyeWideLeft, .4 ); f.dispose();
    }
} );

await test( 'C follows the same-frame authored envelope, repeats continuously, cancels smoothly and ends at rest', () => {
    const f = simple(); f.study.start();
    for ( let i = 1; i <= 210; i++ ) {
        f.tick(); near( f.study.envelope, studyEnvelope( i / 60 ) );
        near( eye( f ).requested, -.45 * f.study.envelope * .4 );
    }
    assert.equal( f.study.phase, 'idle' ); assert.equal( f.study.retirementReason, 'complete' );
    f.study.start(); f.tick( 32 ); const onset = f.study.envelope; f.study.start(); assert.equal( f.study.envelope, onset );
    f.tick( 1, 0 ); assert.equal( f.study.envelope, onset );
    f.study.cancel(); assert.equal( f.study.envelope, onset ); f.tick( 9 ); assert.ok( f.study.envelope < onset && f.study.envelope > 0 );
    const fading = f.study.envelope; f.study.start(); assert.equal( f.study.envelope, fading );
    f.study.cancel(); f.tick( 19 ); assert.equal( f.study.phase, 'idle' ); assert.equal( f.weights.eyeWideLeft, .4 );
    f.dispose();
} );

await test( 'C pins actual owner identity/order/weight and retires rather than following a same-name replacement', () => {
    for ( const change of [ f => { f.expression.weight = .5; }, f => { f.expression.order = 702; },
        f => { f.study.output.weight = .5; }, f => { f.study.control.order = 800; },
        f => { f.study.output.declareChannels( { morphChannels: [ ...EYE_WIDE_CHANNELS, 'viseme_aa' ] } ); },
        f => { f.stack.remove( f.expression ); f.avatar.expression = f.stack.add( new ExpressionLayer() ); },
        f => { f.avatar.expression = new ExpressionLayer(); } ] ) {
        const f = simple(); peak( f ); change( f ); f.tick(); assert.equal( f.study.phase, 'idle' );
        assert.equal( eye( f ).actualAdmitted, 0 ); assert.throws( () => f.study.start(), /unavailable/ ); f.dispose();
    }
} );

await test( 'C disable/reset/rebind/removal/disposal retire, re-enable never resumes, and replacement names survive cleanup', () => {
    for ( const kind of [ 'control-disabled', 'output-disabled', 'reset', 'bind', 'control-remove', 'output-remove', 'dispose' ] ) {
        const f = simple(); peak( f );
        if ( kind === 'control-disabled' ) f.study.control.enabled = false;
        if ( kind === 'output-disabled' ) f.study.output.enabled = false;
        if ( kind === 'reset' ) f.stack.reset();
        if ( kind === 'bind' ) f.stack.bind( f.target );
        if ( kind === 'control-remove' ) f.stack.remove( f.study.control );
        if ( kind === 'output-remove' ) f.stack.remove( f.study.output );
        if ( kind === 'dispose' ) f.stack.dispose();
        if ( kind !== 'dispose' ) f.tick(); assert.equal( f.study.phase, 'idle', kind );
        if ( kind !== 'dispose' ) { f.study.control.enabled = f.study.output.enabled = true; f.tick(); assert.equal( f.study.phase, 'idle' ); assert.equal( eye( f ).actualAdmitted, 0 ); }
        f.dispose();
    }
    const f = simple(); f.stack.remove( f.study.output );
    const replacement = f.stack.add( new Layer( { name: f.study.output.name, order: 701 } ) ); f.study.dispose();
    assert.ok( f.stack.layers.includes( replacement ) ); f.dispose();
} );

await test( 'Partial native registration failure removes only study instances, including failure after onBind', () => {
    const f = simple( { study: false } ), before = f.stack.layers.slice(), add = f.stack.add.bind( f.stack );
    f.stack.add = layer => { add( layer ); if ( layer.name === 'expressionStudyEyeWide' ) throw Error( 'injected after registration' ); return layer; };
    assert.throws( () => new ExpressionStudyArm( f.avatar, { arm: 'C' } ), /injected/ ); assert.deepEqual( f.stack.layers, before );
    f.stack.add = add;
    const foreign = add( new Layer( { name: 'expressionStudyEyeWide', order: 900 } ) );
    assert.throws( () => new ExpressionStudyArm( f.avatar, { arm: 'C' } ), /already/ );
    assert.ok( f.stack.layers.includes( foreign ) ); assert.equal( f.stack.findLayer( 'expressionStudyControl' ), null ); f.dispose();
} );

// Real g050 skinning/calibration/native controllers on CPU. Only texture decode is stubbed;
// this is geometry/ownership evidence, never a rendered appearance claim.
globalThis.self ??= globalThis;
globalThis.createImageBitmap ??= async () => ( { width: 1, height: 1, close() {} } );
const bytes = fs.readFileSync( new URL( '../../../../assets/figures/figure_g050.glb', import.meta.url ) );
const template = await new Promise( ( resolve, reject ) => new GLTFLoader().parse(
    bytes.buffer.slice( bytes.byteOffset, bytes.byteOffset + bytes.byteLength ), '', g => resolve( g.scene ), reject ) );
function native( { arm = 'B', policy = true, study = true } = {} ) {
    const root = clone( template ); root.updateMatrixWorld( true );
    const eyes = findEyeMeshes( root ), calibration = calibrateEyeAim( eyes.globe, eyes.cornea );
    const stack = new MotionStack( { seed: 20260807 } ), target = createMotionTarget( root ); stack.bind( target );
    const idle = stack.add( new IdleMotion( { armsEnabled: false } ) );
    const gaze = new Gaze( { policy, blinkCoupling: false, rigRoot: root } ); stack.add( gaze.head ); stack.add( gaze );
    stack.add( new FacialIdle() ); stack.add( new Blink() );
    const expression = stack.add( new ExpressionLayer() ); stack.add( expression.postureLayer() );
    const speechValues = Object.fromEntries( OVR_VISEMES.map( n => [ n, 0 ] ) );
    stack.add( new VisemeLayer( { schedule: { update: () => speechValues, stop() {} } } ) );
    gaze.setPointAimCalibration( target, calibration );
    const camera = new PerspectiveCamera(); camera.position.set( .18911854, 1.52277907, .88973277 ); camera.updateMatrixWorld( true );
    const avatar = { stack, expression, layers: { gaze, idle } };
    const f = { root, stack, target, eyes, gaze, idle, expression, camera, avatar, speechValues };
    f.study = study ? new ExpressionStudyArm( avatar, { arm } ) : null;
    f.tick = ( n = 1, dt = 1 / 60 ) => { for ( let i = 0; i < n; i++ ) { stack.update( dt ); root.updateMatrixWorld( true ); } };
    f.dispose = () => { f.study?.dispose(); stack.dispose(); };
    return f;
}

await test( 'B acquires one genuine calibrated hold, sets current-frame point weight, restores either prior policy', () => {
    for ( const policy of [ true, false ] ) {
        const f = native( { policy } ), acquired = [], holdTarget = f.gaze.holdTarget.bind( f.gaze );
        f.gaze.holdTarget = ( ...args ) => { acquired.push( args ); return holdTarget( ...args ); };
        f.study.start( f.camera ); assert.equal( acquired.length, 1 ); assert.ok( f.study.gazeHold.active );
        assert.equal( acquired[ 0 ][ 1 ].pointWeight, 0 ); assert.equal( f.gaze.policyEnabled, false );
        const copied = f.study.pointWorld.slice(); f.camera.position.x += .1; assert.deepEqual( f.study.pointWorld, copied );
        f.tick( 15 ); assert.equal( f.study.envelope, 0 ); assert.equal( f.gaze.pointAimOutput, null );
        f.tick( 25 ); near( f.gaze.targetHold.pointAim.weight, f.study.envelope ); assert.equal( f.gaze.pointAimOutput.status, 'aiming' );
        f.tick( 165 ); assert.equal( f.study.phase, 'idle' ); assert.equal( f.gaze.policyEnabled, policy );
        assert.equal( f.gaze.targetHold, null ); assert.equal( f.gaze.pointAimRelease, null ); assert.equal( acquired.length, 1 );
        assert.equal( f.study.output, null ); assert.equal( f.idle.headScaleLeases?.size ?? 0, 0 ); f.dispose();
    }
} );

await test( 'B invalid camera/support preserves the current token; repeat/cancel blend and old tokens cannot steal', () => {
    const f = native(); peak( f ); const old = f.study.gazeHold;
    const invalid = new PerspectiveCamera(); invalid.position.set( 0, 10, 0 ); invalid.updateMatrixWorld( true );
    assert.throws( () => f.study.start( invalid ), /frontal/ ); assert.equal( f.study.gazeHold, old ); assert.ok( old.active );
    f.gaze.weight = .5; assert.throws( () => f.study.start( f.camera ), /unsupported/ ); assert.ok( old.active ); f.gaze.weight = 1;
    f.study.start( f.camera ); assert.equal( f.study.envelope, 1 ); assert.equal( old.active, false ); assert.equal( old.release(), false );
    const next = f.study.gazeHold; f.study.cancel(); assert.equal( f.gaze.policyEnabled, true ); assert.ok( next.pointFading );
    f.tick( 9 ); const fading = f.study.envelope; assert.ok( fading > 0 && fading < 1 );
    f.study.start( f.camera ); near( f.gaze.targetHold.pointAim.weight, fading ); assert.equal( next.pointFading, false );
    assert.equal( next.release(), false ); assert.ok( f.study.gazeHold.active );
    f.study.cancel(); f.tick( 20 ); assert.equal( f.study.phase, 'idle' ); assert.equal( f.gaze.pointAimRelease, null );
    f.study.start( f.camera ); f.tick( 30 ); f.study.cancel( { immediate: true } ); assert.equal( f.gaze.targetHold, null );
    f.study.start( f.camera ); f.tick( 5 ); f.study.cancel(); assert.equal( f.study.phase, 'idle' ); assert.equal( f.gaze.targetHold, null ); f.dispose();
} );

await test( 'B retires on newer native gaze commands; older study cleanup cannot change their policy or hold', () => {
    for ( const command of [ g => g.lookAt( { yawDegrees: -12 } ), g => g.holdTarget( { yawDegrees: -5 } ),
        g => g.setPolicyEnabled( false ), g => g.markFilledPause(), g => g.markTurnEnd(), g => g.setPartnerDirection( { yawDegrees: -8 } ) ] ) {
        const f = native(); peak( f ); const old = f.study.gazeHold, newer = command( f.gaze ), policy = f.gaze.policyEnabled;
        assert.equal( old.active, false ); f.tick(); assert.equal( f.study.phase, 'idle' );
        assert.equal( f.gaze.policyEnabled, policy ); f.study.dispose(); assert.equal( f.gaze.policyEnabled, policy );
        if ( newer?.active !== undefined ) assert.equal( newer.active, true ); f.dispose();
    }
} );

await test( 'B normal speaking/real Viseme output does not supersede, C ignores unrelated gaze supersession', () => {
    const b = native(); peak( b ); const hold = b.study.gazeHold;
    b.gaze.setConversationState( 'speaking' ); b.speechValues.viseme_aa = .6; b.tick();
    assert.ok( hold.active ); assert.equal( b.study.phase, 'attending' ); assert.equal( b.stack.morphChannels.get( 'viseme_aa' ).committed, .6 ); b.dispose();
    const c = native( { arm: 'C' } ); peak( c );
    c.gaze.lookAt( { yawDegrees: -12 } ); c.gaze.setPolicyEnabled( false ); c.gaze.markTurnEnd(); c.tick();
    assert.equal( c.study.phase, 'attending' ); assert.equal( c.study.envelope, 1 ); assert.equal( c.study.gazeHold, null ); c.dispose();
} );

await test( 'B control/gaze/head disable and native reset/bind/removal/disposal retire resources without resurrection', () => {
    for ( const kind of [ 'control-disabled', 'gaze-disabled', 'head-disabled', 'reset', 'bind', 'gaze-reset', 'gaze-bind', 'control-remove', 'head-remove', 'dispose' ] ) {
        const f = native(); peak( f ); const hold = f.study.gazeHold;
        if ( kind === 'control-disabled' ) f.study.control.enabled = false;
        if ( kind === 'gaze-disabled' ) f.gaze.enabled = false;
        if ( kind === 'head-disabled' ) f.gaze.head.enabled = false;
        if ( kind === 'reset' ) f.stack.reset();
        if ( kind === 'bind' ) f.stack.bind( f.target );
        if ( kind === 'gaze-reset' ) f.gaze.reset();
        if ( kind === 'gaze-bind' ) f.gaze.onBind( f.stack.context );
        if ( kind === 'control-remove' ) f.stack.remove( f.study.control );
        if ( kind === 'head-remove' ) f.stack.remove( f.gaze.head );
        if ( kind === 'dispose' ) f.stack.dispose();
        if ( kind !== 'dispose' ) f.tick(); assert.equal( f.study.phase, 'idle', kind ); assert.equal( hold.active, false, kind ); assert.equal( hold.pointFading, false, kind );
        f.gaze.enabled = f.gaze.head.enabled = f.study.control.enabled = true;
        if ( kind !== 'dispose' ) f.tick(); assert.equal( f.study.phase, 'idle' ); f.dispose();
    }
} );

await test( 'A/C native affected input, bones, gaze, blink, visemes and all other committed morphs match through release', () => {
    const a = native( { study: false } ), c = native( { arm: 'C' } );
    for ( const f of [ a, c ] ) { f.expression.feel( { pleasure: 0, arousal: .4, dominance: .85 } ); f.tick( 150 ); }
    c.study.start(); let differingEyeFrames = 0;
    for ( let step = 0; step < 270; step++ ) {
        for ( const f of [ a, c ] ) {
            f.speechValues.viseme_aa = step >= 30 && step < 90 ? .7 : 0;
            f.speechValues.viseme_PP = step >= 90 && step < 150 ? .5 : 0;
            f.tick();
        }
        assert.equal( a.stack.time, c.stack.time ); assert.deepEqual( a.expression.state.pad, c.expression.state.pad );
        assert.deepEqual( a.expression.faceResult, c.expression.faceResult ); assert.deepEqual( a.stack.context.shared, c.stack.context.shared );
        for ( const [ name, bone ] of a.stack.boneChannels ) {
            const other = c.stack.boneChannels.get( name ); assert.deepEqual( bone.bone?.quaternion.toArray(), other.bone?.quaternion.toArray(), name );
            assert.deepEqual( bone.bone?.position.toArray(), other.bone?.position.toArray(), name );
        }
        for ( const [ name, channel ] of a.stack.morphChannels ) {
            const other = c.stack.morphChannels.get( name );
            if ( !EYE_WIDE_CHANNELS.includes( name ) ) assert.equal( channel.committed, other.committed, name );
            else if ( channel.committed !== other.committed ) differingEyeFrames++;
        }
    }
    assert.ok( differingEyeFrames > 0, 'test must actually attenuate' ); assert.equal( c.study.phase, 'idle' ); a.dispose(); c.dispose();
} );

console.log( `${ checks.length } expression study CPU groups passed. Native rendering, Avatar.say integration, hair and perceptual judgment remain separate.` );
