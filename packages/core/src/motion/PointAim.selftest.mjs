// CPU ownership/geometry checks. Texture decode is stubbed; browser appearance is separate.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { Bone, Object3D, Matrix4, PerspectiveCamera, Vector3 } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { Gaze } from './Gaze.js';
import { Layer } from './Layer.js';
import { MotionStack, createMotionTarget } from './MotionStack.js';
import { FacialIdle } from './FacialIdle.js';
import { IdleMotion } from './IdleMotion.js';
import { AttentionAction } from './AttentionAction.js';
import { calibrateEyeAim } from './EyeAimCalibration.js';
import { findEyeMeshes, measureEye } from '../material/EyeMaterial.js';

globalThis.self ??= globalThis;
globalThis.createImageBitmap ??= async () => ( { width: 1, height: 1, close() {} } );
const bytes = fs.readFileSync( fileURLToPath( new URL( '../../../../assets/figures/figure_g050.glb', import.meta.url ) ) );
const checks = [];
async function test( name, fn ) { await fn(); checks.push( name ); console.log( 'PASS ' + name ); }
const targetAngles = { yawDegrees: 14.9, pitchDegrees: .65 };
const cameraPoint = new Vector3( .18911854, 1.52277907, .88973277 );

async function fixture( { policy = false } = {} ) {
    const root = await new Promise( ( ok, no ) => new GLTFLoader().parse(
        bytes.buffer.slice( bytes.byteOffset, bytes.byteOffset + bytes.byteLength ), '', g => ok( g.scene ), no ) );
    root.updateMatrixWorld( true );
    const eyes = findEyeMeshes( root ), calibration = calibrateEyeAim( eyes.globe, eyes.cornea );
    const stack = new MotionStack( { seed: 379 } ), target = createMotionTarget( root );
    stack.bind( target );
    const idle = new IdleMotion( { armsEnabled: false } );
    const gaze = new Gaze( { policy, blinkCoupling: false, rigRoot: root } ), facial = new FacialIdle();
    stack.add( new Layer( { name: 'testBase', order: 100, boneChannels: [ 'spine_01' ] } ) );
    stack.add( idle ); stack.add( gaze.head ); stack.add( gaze ); stack.add( facial );
    gaze.setPointAimCalibration( target, calibration );
    const camera = new PerspectiveCamera(); camera.position.copy( cameraPoint ); camera.updateMatrixWorld( true );
    const f = { root, eyes, calibration, stack, target, gaze, idle, facial, camera };
    f.action = new AttentionAction( { stack, layers: { gaze, idle } } );
    f.dispose = () => { f.action.dispose(); stack.dispose(); };
    return f;
}
function tick( f, count = 1, dt = 1 / 60 ) {
    for ( let i = 0; i < count; i++ ) { f.stack.update( dt ); f.root.updateMatrixWorld( true ); }
}
function hold( f, weight = 1 ) { return f.gaze.holdTarget( targetAngles, { pointWorld: cameraPoint, pointWeight: weight, predicted: true } ); }
function weights( f ) { return Object.fromEntries( f.gaze.morphChannels.map( name => [ name,
    f.eyes.globe.morphTargetInfluences[ f.eyes.globe.morphTargetDictionary[ name ] ] ] ) ); }
function fitEye( mesh, side ) {
    const points = [], uv = [], seen = new Set(), v = new Vector3(), p = mesh.geometry.attributes.position;
    mesh.skeleton.update();
    for ( let i = 0; i < p.count; i++ ) {
        const key = [ p.getX( i ), p.getY( i ), p.getZ( i ) ].join( ',' );
        if ( ( side === 'left' ? p.getX( i ) <= 0 : p.getX( i ) > 0 ) || seen.has( key ) ) continue;
        seen.add( key ); mesh.getVertexPosition( i, v ).applyMatrix4( mesh.matrixWorld );
        points.push( v.toArray() ); uv.push( [ mesh.geometry.attributes.uv.getX( i ), mesh.geometry.attributes.uv.getY( i ) ] );
    }
    return { points, uv };
}

await test( 'Calibrated hold copies its point and writes through one Gaze contribution', async () => {
    const f = await fixture(), point = cameraPoint.clone();
    const h = f.gaze.holdTarget( targetAngles, { pointWorld: point, predicted: true } ); point.set( 900, 900, 900 );
    tick( f, 120 ); assert.ok( h.active );
    const out = f.gaze.pointAimOutput; assert.equal( out.status, 'aimed' );
    assert.deepEqual( weights( f ), out.weights );
    assert.equal( f.stack.context.shared.gaze.eyePitchDegrees, ( out.angles.left.pitchDegrees + out.angles.right.pitchDegrees ) / 2 );
    assert.equal( f.gaze.eyePitchDegrees, f.stack.context.shared.gaze.eyePitchDegrees );
    for ( const name of f.gaze.morphChannels ) assert.ok( f.stack.morphChannels.get( name ).writerNames.every( n => n === f.gaze.name ) );
    for ( const side of [ 'left', 'right' ] ) {
        const g = fitEye( f.eyes.globe, side ), c = fitEye( f.eyes.cornea, side ), eye = measureEye( g.points, g.uv, c.points );
        const axis = new Vector3( ...eye.axis ), direction = cameraPoint.clone().sub( new Vector3( ...eye.centre ) );
        assert.ok( axis.angleTo( direction ) * 180 / Math.PI < .8, side + ' physical target fit' );
    }
    f.dispose();
} );

await test( 'Lossless WebGPU skin-index widening keeps calibration, while changed values and metadata reject', async () => {
    for ( const kind of [ 'lossless', 'changed', 'metadata', 'position' ] ) {
        const f = await fixture(), p = JSON.stringify( f.calibration.profile );
        for ( const mesh of [ f.eyes.globe, f.eyes.cornea ] ) {
            const a = mesh.geometry.attributes.skinIndex;
            assert.ok( a.array instanceof Uint16Array || a.array instanceof Uint8Array );
            a.array = new Uint32Array( a.array );
            if ( kind === 'changed' ) a.array[ 0 ]++;
            if ( kind === 'metadata' ) a.normalized = true;
            if ( kind === 'position' ) mesh.geometry.attributes.position.array = new Float32Array( mesh.geometry.attributes.position.array );
        }
        assert.equal( f.calibration.isCurrent(), kind === 'lossless' );
        if ( kind === 'lossless' ) {
            assert.ok( f.calibration.isCurrent(), 'repeated guard retains accepted upload' );
            assert.equal( JSON.stringify( f.calibration.profile ), p );
            hold( f ); tick( f, 60 ); assert.equal( f.gaze.pointAimOutput.status, 'aimed' );
        }
        f.dispose();
    }
} );

await test( 'Weight zero retains native output; invalid new requests preserve a valid lease', async () => {
    const f = await fixture(), h = hold( f, 0 ); tick( f, 20 );
    assert.equal( f.gaze.pointAimOutput, null );
    assert.equal( f.gaze.eyePitchDegrees, f.gaze.currentEyePitchDegrees );
    const before = weights( f );
    for ( const options of [ { pointWorld: new Vector3( NaN, 0, 0 ) }, { pointWorld: cameraPoint, pointWeight: 2 } ] )
        assert.throws( () => f.gaze.holdTarget( targetAngles, options ) );
    assert.throws( () => h.setPointWeight( Infinity ) );
    assert.throws( () => h.release( { pointFadeSeconds: -1 } ) );
    assert.ok( h.active ); assert.deepEqual( weights( f ), before );
    h.setPointWeight( 1 ); tick( f ); assert.ok( f.gaze.pointAimOutput ); f.dispose();
} );

await test( 'Soft release restores policy immediately, decays once per frame, and cannot restart', async () => {
    const f = await fixture( { policy: true } ), h = hold( f ); tick( f, 60 );
    h.release( { pointFadeSeconds: .3 } ); assert.equal( h.active, false ); assert.equal( h.pointFading, true );
    assert.equal( f.gaze.policyEnabled, true );
    tick( f, 1, .1 );
    assert.equal( f.gaze.pointAimRelease.elapsed, .1 );
    const elapsed = f.gaze.pointAimRelease.elapsed, weight = f.gaze.pointAimRelease.aim.weight;
    assert.ok( weight > 0 && weight < 1 );
    assert.equal( h.release( { pointFadeSeconds: .3 } ), false ); assert.equal( f.gaze.pointAimRelease.elapsed, elapsed );
    tick( f, 2, .1 ); assert.equal( h.pointFading, false ); assert.equal( f.gaze.pointAimOutput, null );
    assert.equal( h.release(), false ); f.dispose();
} );

await test( 'New direction, partner, policy and speech cues synchronously invalidate an old fade', async () => {
    for ( const command of [ g => g.lookAt( { yawDegrees: -12 } ), g => g.setPartnerDirection( { yawDegrees: -8 } ),
        g => g.setPolicyEnabled( false ), g => g.markFilledPause(), g => g.markTurnEnd() ] ) {
        const f = await fixture( { policy: true } ), h = hold( f ); tick( f, 40 ); h.release( { pointFadeSeconds: .3 } );
        command( f.gaze ); assert.equal( h.pointFading, false ); assert.equal( f.gaze.pointAimRelease, null );
        const policy = f.gaze.policyEnabled; assert.equal( h.release(), false ); assert.equal( f.gaze.policyEnabled, policy );
        tick( f ); assert.equal( f.gaze.pointAimOutput, null ); f.dispose();
    }
} );

await test( 'An old handle cannot clear a newer hold or its release fade', async () => {
    const f = await fixture(), first = hold( f ); tick( f, 50 ); first.release( { pointFadeSeconds: .3 } );
    const second = hold( f, .6 ); tick( f );
    assert.equal( first.release(), false ); assert.ok( second.active );
    second.release( { pointFadeSeconds: .2 } );
    assert.equal( first.release(), false ); assert.ok( second.pointFading );
    assert.ok( second.release() ); assert.equal( second.pointFading, false ); f.dispose();
} );

await test( 'Action cancellation, repeat and immediate cleanup retain only their own fade', async () => {
    const f = await fixture( { policy: true } ); f.action.lookAtCamera( f.camera ); tick( f, 60 );
    const h = f.action.gazeHold; f.action.cancel();
    assert.equal( f.action.report().holdsGaze, false ); assert.ok( h.pointFading );
    assert.equal( f.gaze.policyEnabled, true ); tick( f, 4 );
    f.action.lookAtCamera( f.camera ); assert.ok( f.action.gazeHold.active ); assert.equal( h.pointFading, false );
    assert.equal( h.release(), false );
    f.action.cancel(); f.action.cancel( { immediate: true } );
    assert.equal( f.gaze.pointAimRelease, null ); assert.equal( f.action.phase, 'idle' );
    f.action.lookAtCamera( f.camera ); tick( f, 60 ); f.action.cancel(); f.action.dispose();
    assert.equal( f.gaze.pointAimRelease, null ); f.stack.dispose();
} );

await test( 'Reset, rebind and removal retire calibration leases without affecting later owners', async () => {
    for ( const operation of [ 'reset', 'rebind', 'gaze', 'control', 'pose', 'dispose' ] ) {
        const f = await fixture(); f.action.lookAtCamera( f.camera ); tick( f, 60 );
        const h = f.action.gazeHold; f.action.cancel(); assert.ok( h.pointFading );
        if ( operation === 'reset' ) f.stack.reset();
        if ( operation === 'rebind' ) f.stack.bind( createMotionTarget( f.root ) );
        if ( operation === 'gaze' ) f.stack.remove( f.gaze );
        if ( operation === 'control' ) f.stack.remove( f.action.control );
        if ( operation === 'pose' ) f.stack.remove( f.action.pose );
        if ( operation === 'dispose' ) f.stack.dispose();
        assert.equal( h.active, false, operation ); assert.equal( h.pointFading, false, operation );
        assert.equal( f.gaze.pointAimRelease, null, operation ); assert.equal( h.release(), false );
        f.dispose();
    }
} );

await test( 'Removing Gaze restores physical eye channels and follower angles on the next commit', async () => {
    const f = await fixture(), h = hold( f ); tick( f, 60 );
    const before = weights( f ); assert.ok( Object.values( before ).some( x => x > .1 ) );
    f.stack.remove( f.gaze );
    assert.deepEqual( weights( f ), before, 'removal itself does not write the figure' );
    tick( f ); assert.ok( Object.values( weights( f ) ).every( x => x === 0 ) );
    assert.equal( f.stack.context.shared.gaze.eyePitchDegrees, 0 );
    assert.equal( f.stack.context.shared.gaze.eyeYawDegrees, 0 );
    assert.equal( h.active, false );
    // After its final zero commit the stack relinquishes the channels.
    f.target.setMorph( 'eyeLookInLeft', .25 ); tick( f );
    assert.equal( weights( f ).eyeLookInLeft, .25 ); f.dispose();
} );

await test( 'Last-owner retirement preserves bone rest, respects replacements, and never writes a new target', () => {
    function setup() {
        const head = new Bone(); head.name = 'head'; head.position.set( .1, .2, .3 ); head.rotation.set( .2, -.1, .15 );
        const rest = { position: head.position.clone(), rotation: head.quaternion.clone() }, writes = [];
        const target = { hasMorph: () => true, getBone: n => n === 'head' ? head : null,
            setMorph: ( name, value ) => writes.push( { name, value } ) };
        const stack = new MotionStack(); stack.bind( target );
        class Move extends Layer {
            constructor( name = 'move' ) { super( { name, order: 100, morphChannels: [ 'test' ], boneChannels: [ 'head' ] } ); }
            update() { this.contribution.setMorph( 'test', .6 );
                this.contribution.rotateBoneEuler( 'head', .2, .3, -.1 );
                this.contribution.offsetBone( 'head', .2, .1, .3 ); return this.contribution; }
        }
        const layer = stack.add( new Move() ); stack.update( .1 );
        return { stack, head, rest, writes, target, layer, Move };
    }
    {
        const f = setup(), driven = f.head.quaternion.clone(); f.stack.remove( f.layer );
        assert.deepEqual( f.head.quaternion.toArray(), driven.toArray() ); assert.equal( f.writes.length, 1 );
        f.stack.update( .1 ); assert.deepEqual( f.head.position, f.rest.position ); assert.deepEqual( f.head.quaternion.toArray(), f.rest.rotation.toArray() );
        assert.deepEqual( f.writes.map( x => x.value ), [ .6, 0 ] );
        f.head.position.x = 9; f.stack.update( .1 ); assert.equal( f.head.position.x, 9 ); assert.equal( f.writes.length, 2 ); f.stack.dispose();
    }
    {
        const f = setup(), driven = f.head.quaternion.clone(), position = f.head.position.clone(); f.stack.remove( f.layer );
        const replacement = f.stack.add( new f.Move( 'replacement' ) ); f.stack.update( .1 );
        assert.deepEqual( f.head.quaternion.toArray(), driven.toArray() ); assert.deepEqual( f.head.position, position );
        assert.deepEqual( f.writes.map( x => x.value ), [ .6, .6 ] );
        f.stack.remove( replacement ); f.stack.update( .1 ); assert.deepEqual( f.head.quaternion.toArray(), f.rest.rotation.toArray() ); f.stack.dispose();
    }
    {
        const f = setup(), driven = f.head.quaternion.clone(); f.stack.remove( f.layer );
        const nextWrites = [], next = new Bone(); next.position.x = 7;
        f.stack.bind( { hasMorph: () => true, getBone: () => next, setMorph: ( ...args ) => nextWrites.push( args ) } );
        f.stack.update( .1 ); assert.deepEqual( nextWrites, [] ); assert.equal( next.position.x, 7 );
        assert.deepEqual( f.head.quaternion.toArray(), driven.toArray(), 'old target is unbound' ); f.stack.dispose();
    }
    {
        const f = setup(); f.layer.declareChannels( { morphChannels: [], boneChannels: [] } ); f.layer.update = () => null;
        f.stack.update( .1 ); assert.equal( f.writes.at( -1 ).value, 0 );
        assert.deepEqual( f.head.quaternion.toArray(), f.rest.rotation.toArray() ); f.stack.dispose();
    }
} );

await test( 'Unsupported late or contested writers and Gaze fades retain honest native fallback', async () => {
    for ( const kind of [ 'late', 'contested', 'weighted', 'head-removed', 'geometry' ] ) {
        const f = await fixture(), h = hold( f ); tick( f, 40 );
        if ( kind === 'late' ) f.stack.add( new Layer( { name: 'lateHead', order: 800, boneChannels: [ 'head' ] } ) );
        if ( kind === 'contested' ) f.stack.add( new Layer( { name: 'eyeOther', order: 500, morphChannels: [ 'eyeLookInLeft' ] } ) );
        if ( kind === 'weighted' ) f.gaze.weight = .5;
        if ( kind === 'head-removed' ) f.stack.remove( f.gaze.head );
        if ( kind === 'geometry' ) f.eyes.globe.geometry.attributes.position.needsUpdate = true;
        assert.notEqual( f.gaze.pointAimSupport(), null, kind );
        assert.throws( () => hold( f ) ); assert.ok( h.active );
        tick( f ); assert.equal( f.gaze.pointAimOutput.status, 'fallback', kind );
        f.dispose();
    }
} );

await test( 'Disabling Gaze clears point leases and stale corrected metadata on the next stack frame', async () => {
    const f = await fixture(), h = hold( f ); tick( f, 60 ); f.gaze.enabled = false; tick( f );
    assert.equal( h.active, false ); assert.equal( h.pointFading, false );
    assert.ok( Object.values( weights( f ) ).every( x => x === 0 ) );
    assert.equal( f.stack.context.shared.gaze.eyePitchDegrees, 0 );
    assert.equal( f.stack.context.shared.gaze.binocular.status, 'inactive' ); f.dispose();
} );

await test( 'Invalid relative transforms and overflowing targets reject without changing the current hold', async () => {
    const f = await fixture(), h = hold( f );
    assert.throws( () => f.gaze.holdTarget( targetAngles, { pointWorld: new Vector3( 1e308, 0, 0 ) } ) );
    assert.ok( h.active );
    const head = f.gaze.headBone, old = head.scale.clone(); head.scale.set( 1, 2, 1 );
    assert.throws( () => hold( f ) ); assert.ok( h.active ); head.scale.copy( old ); f.dispose();
} );

await test( 'Pose query predicts weighted ancestors exactly and rejects late/self writers and aliases', () => {
    const root = new Object3D(), head = new Bone(); head.name = 'head'; root.add( head ); root.updateMatrixWorld( true );
    const stack = new MotionStack(); stack.bind( createMotionTarget( root ) );
    class Move extends Layer { constructor() { super( { name: 'move', order: 100, weight: .4, boneChannels: [ 'head' ] } ); }
        update() { this.contribution.rotateBoneEuler( 'head', .2, .3, -.1 ); this.contribution.offsetBone( 'head', .2, .1, .3 ); return this.contribution; } }
    const prediction = new Matrix4();
    class Query extends Layer { constructor() { super( { name: 'query', order: 600 } ); }
        update() { assert.ok( stack.predictWorldMatrix( head, this, prediction ) );
            assert.throws( () => stack.predictWorldMatrix( head, this, head.matrixWorld ), /scene matrix/ ); return null; } }
    const q = new Query(); stack.add( new Move() ); stack.add( q ); stack.update( .1 ); root.updateMatrixWorld( true );
    assert.deepEqual( prediction.elements, head.matrixWorld.elements );
    assert.throws( () => stack.predictWorldMatrix( head, q, prediction ), /during/ );
    const later = new Layer( { name: 'later', order: 900, boneChannels: [ 'head' ] } ); stack.add( later );
    assert.equal( stack.posePredictionSupport( head, q ), 'later-ancestor-writer' ); stack.remove( later );
    q.declareChannels( { boneChannels: [ 'head' ] } ); stack.rebuildChannels();
    assert.equal( stack.posePredictionSupport( head, q ), 'requesting-ancestor-writer' ); stack.dispose();
} );

console.log( `${ checks.length } point aim CPU groups passed; renderer, continuous appearance and frame cost remain separate.` );
