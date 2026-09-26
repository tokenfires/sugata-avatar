// CPU mechanism gate. Real native stack/posture/gesture over exact g050 bone transforms;
// no renderer, mesh skinning, Avatar loading/lifecycle integration or perceptual claim.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { Bone, Object3D, Quaternion } from 'three';
import { HandAttributionArm, REQUIRED_SOURCE_HASHES } from './HandAttributionArm.mjs';
import { MotionStack } from '../../../../packages/core/src/motion/MotionStack.js';
import { Layer } from '../../../../packages/core/src/motion/Layer.js';
import { GestureLayer } from '../../../../packages/core/src/motion/Gesture.js';
import { ExpressionLayer } from '../../../../packages/core/src/affect/ExpressionLayer.js';
import { Skeleton } from '../../../../packages/core/src/figure/Skeleton.js';
import { RestPose } from '../../../../packages/core/src/figure/RestPose.js';
import { readGlb } from '../../../../tools/lut-bake/glb.mjs';

const ROOT = fileURLToPath( new URL( '../../../../', import.meta.url ) );
const sha = bytes => createHash( 'sha256' ).update( bytes ).digest( 'hex' );
const sourceHashes = Object.fromEntries( Object.keys( REQUIRED_SOURCE_HASHES ).map( p => [ p, sha( fs.readFileSync( ROOT + p ) ) ] ) );
assert.deepEqual( sourceHashes, REQUIRED_SOURCE_HASHES );
const json = readGlb( ROOT + 'assets/figures/figure_g050.glb' ).json;
const PLAN = { synthetic: true, durationSeconds: 6, words: [
    { text: 'closer', startTime: 1.5, endTime: 1.9, stressed: true, contrastGroup: 'span' },
    { text: 'farther', startTime: 4.5, endTime: 4.9, stressed: true, contrastGroup: 'span' }
] };
const PAD = { neutral: [ 0, 0, 0 ], angry: [ -.8, .8, 1 ], happy: [ .8, .8, 1 ] };
const rows = c => ( { morphs: [ ...c.morphs ], rotations: [ ...c.boneRotations ].map( ( [ n, q ] ) => [ n, q.toArray() ] ),
    offsets: [ ...c.boneOffsets ].map( ( [ n, v ] ) => [ n, v.toArray() ] ) } );
const results = [];
function test( name, body ) { body(); results.push( name ); console.log( `PASS ${ name }` ); }

class ForeignWitness extends Layer {
    constructor( { name = 'foreignArmAndMouth', enabled = true, silent = false } = {} ) {
        super( { name, order: 350, weight: .4, enabled, morphChannels: [ 'viseme_aa', 'testSmall' ], boneChannels: [ 'upperarm_l', 'spine_01', 'hand_l' ] } );
        this.elapsed = this.calls = this.skipped = 0; this.silent = silent; this.callback = null;
    }
    update( dt ) {
        this.elapsed += dt; this.calls++;
        const r = this.random.next();
        this.contribution.rotateBoneEuler( 'upperarm_l', .07 + r * .01, .12, -.03 );
        this.contribution.rotateBoneEuler( 'spine_01', 0, .015, 0 );
        this.contribution.rotateBoneEuler( 'hand_l', -.025, 0, .02 );
        this.contribution.offsetBone( 'upperarm_l', .001, 0, 0 );
        this.contribution.setMorph( 'viseme_aa', .6 );
        this.contribution.setMorph( 'testSmall', 1.5e-6 );
        this.callback?.();
        return this.silent ? null : this.contribution;
    }
    onDisabledFrame() { this.skipped++; }
}

function fixture( { mood = 'angry', speaking = true, postureEnabled = true, gestureEnabled = true } = {} ) {
    const joints = new Set( json.skins.flatMap( s => s.joints ) );
    const nodes = json.nodes.map( ( data, i ) => {
        const n = joints.has( i ) ? new Bone() : new Object3D(); n.name = data.name ?? '';
        if ( data.matrix ) { n.matrix.fromArray( data.matrix ); n.matrix.decompose( n.position, n.quaternion, n.scale ); }
        else { if ( data.translation ) n.position.fromArray( data.translation ); if ( data.rotation ) n.quaternion.fromArray( data.rotation ); if ( data.scale ) n.scale.fromArray( data.scale ); }
        return n;
    } );
    json.nodes.forEach( ( data, i ) => ( data.children ?? [] ).forEach( c => nodes[ i ].add( nodes[ c ] ) ) );
    const root = new Object3D(); for ( const i of json.scenes[ json.scene ?? 0 ].nodes ) root.add( nodes[ i ] );
    root.updateMatrixWorld( true );
    const skeleton = new Skeleton( root ); RestPose.load( 'relaxed-standing' ).applyTo( skeleton ); skeleton.update(); root.updateMatrixWorld( true );
    const morphs = new Map(), target = { hasMorph: () => true, setMorph: ( n, v ) => morphs.set( n, v ), getBone: n => root.getObjectByName( n ) ?? null };
    const stack = new MotionStack( { seed: 20260807 } ); stack.bind( target );
    const expression = new ExpressionLayer(), [ pleasure, arousal, dominance ] = PAD[ mood ];
    expression.state.push( { pleasure, arousal, dominance } ); for ( let i = 0; i < 300; i++ ) expression.state.update( .01 );
    const posture = expression.postureLayer( { enabled: postureEnabled } ), gesture = new GestureLayer( { enabled: gestureEnabled } );
    const foreign = new ForeignWitness(), disabled = new ForeignWitness( { name: 'disabledWitness', enabled: false } ), silent = new ForeignWitness( { name: 'nullWitness', silent: true } );
    for ( const layer of [ expression, posture, foreign, disabled, silent, gesture ] ) stack.add( layer );
    stack.context.shared.posture = posture; stack.context.shared.affect = expression.state;
    if ( speaking ) gesture.speak( PLAN, { ratePerMinute: 26 } );
    const a = { stack, posture, gesture, expression, target, figure: { root }, autoStart: false, disposed: false, teardownCalls: 0,
        setIdentity() { this.identityMutated = true; }, dress() { this.wardrobeMutated = true; },
        dispose() { this.teardownCalls++; this.disposed = true; this.stack.dispose(); this.stack = null; this.figure = this.target = this.posture = this.gesture = null; } };
    return { a, stack, posture, gesture, expression, foreign, disabled, silent, target, root, morphs };
}
function install( f, arm ) { return new HandAttributionArm( f.a, { arm, sourceHashes } ); }
function snapshot( f ) {
    return { frame: f.stack.frame, time: f.stack.time, bones: [ ...f.stack.boneChannels ].map( ( [ n, c ] ) => [ n, c.bone.quaternion.toArray(), c.bone.position.toArray(), c.rotationWriters.slice(), c.offsetWriters.slice() ] ),
        morphs: [ ...f.morphs ], raw: f.stack.layers.map( l => [ l.name, rows( l.contribution ) ] ),
        posture: structuredClone( f.posture.appliedDegrees ), gesture: structuredClone( f.gesture.applied ),
        schedule: structuredClone( f.gesture.schedule ), utteranceTime: f.gesture.utteranceTime,
        random: f.stack.layers.map( l => [ l.name, l.random.state, l.random.spareGaussian ] ),
        foreign: [ f.foreign.elapsed, f.foreign.calls, f.disabled.skipped, f.silent.calls ] };
}
function cleanup( ...items ) { for ( const item of items ) item instanceof HandAttributionArm ? item.dispose() : item.a.dispose(); }
function unchangedExceptArms( a, b ) {
    const names = new Set( [ 'upperarm_l', 'upperarm_r', 'lowerarm_l', 'lowerarm_r' ] );
    assert.deepEqual( a.raw, b.raw ); assert.deepEqual( a.morphs, b.morphs );
    assert.deepEqual( a.posture, b.posture ); assert.deepEqual( a.gesture, b.gesture );
    assert.deepEqual( a.schedule, b.schedule ); assert.equal( a.utteranceTime, b.utteranceTime );
    assert.deepEqual( a.random, b.random ); assert.deepEqual( a.foreign, b.foreign );
    assert.deepEqual( a.bones.filter( x => !names.has( x[ 0 ] ) ), b.bones.filter( x => !names.has( x[ 0 ] ) ) );
}

test( 'source drift and foreign native methods are rejected before acquiring ownership', () => {
    const f = fixture(); const before = Object.getOwnPropertyDescriptors( f.stack );
    assert.throws( () => new HandAttributionArm( f.a, { arm: 'B', sourceHashes: {} } ), /source pin mismatch/ );
    assert.deepEqual( Object.getOwnPropertyDescriptors( f.stack ), before );
    f.stack.accumulate = function () {};
    assert.throws( () => install( f, 'B' ), /unwrapped frame path/ ); delete f.stack.accumulate; cleanup( f );
} );

test( 'A matches an untouched native stack exactly for 120 frames, including ordered competing writers', () => {
    const a = fixture(), b = fixture(), study = install( b, 'A' );
    for ( let i = 0; i < 120; i++ ) { a.stack.update( 1 / 60 ); b.stack.update( 1 / 60 ); assert.deepEqual( snapshot( a ), snapshot( b ) ); }
    assert.equal( study.report().completedFrames, 120 ); assert.ok( b.stack.boneChannels.get( 'upperarm_l' ).rotationWriters.includes( 'foreignArmAndMouth' ) );
    assert.equal( b.morphs.get( 'viseme_aa' ), .24 ); assert.equal( b.morphs.get( 'testSmall' ), .4 * 1.5e-6 );
    cleanup( a, study );
} );

test( 'B removes only current negative posture arm rotations and preserves native telemetry, gesture yield and other owners', () => {
    const a = fixture(), b = fixture(), study = install( b, 'B' ); let witness;
    for ( let i = 0; i < 120; i++ ) {
        a.stack.update( 1 / 60 ); b.stack.update( 1 / 60 ); unchangedExceptArms( snapshot( a ), snapshot( b ) );
        const p = study.report().samples.posture;
        assert.deepEqual( p.suppressed, [ 'upperarm_l', 'upperarm_r' ] );
        for ( const [ name, q ] of p.effective.rotations ) assert.deepEqual( q, p.suppressed.includes( name ) ? [ 0, 0, 0, 1 ] : p.raw.rotations.find( x => x[ 0 ] === name )[ 1 ] );
        assert.deepEqual( p.effective.offsets, p.raw.offsets );
        if ( b.gesture.applied.activation === 1 ) witness = { a: snapshot( a ), b: snapshot( b ), p };
    }
    assert.ok( witness, 'real native gesture must reach committed stroke' ); assert.equal( witness.b.gesture.yield, .35 );
    assert.notDeepEqual( witness.a.bones.find( x => x[ 0 ] === 'upperarm_l' )[ 1 ], witness.b.bones.find( x => x[ 0 ] === 'upperarm_l' )[ 1 ] );
    // Deliberately wrong late inverse cannot cancel the earlier native posture factor through the foreign/gesture rotations.
    const late = new Quaternion().fromArray( witness.a.bones.find( x => x[ 0 ] === 'upperarm_l' )[ 1 ] )
        .multiply( new Quaternion().fromArray( witness.p.raw.rotations.find( x => x[ 0 ] === 'upperarm_l' )[ 1 ] ).invert() );
    assert.ok( late.angleTo( new Quaternion().fromArray( witness.b.bones.find( x => x[ 0 ] === 'upperarm_l' )[ 1 ] ) ) > .001 );
    cleanup( a, study );
} );

test( 'C suppresses only the actual gesture rotations while its native clock/schedule/random and all other outputs survive', () => {
    const a = fixture(), b = fixture(), study = install( b, 'C' ); let peak = false;
    for ( let i = 0; i < 120; i++ ) {
        a.stack.update( 1 / 60 ); b.stack.update( 1 / 60 ); unchangedExceptArms( snapshot( a ), snapshot( b ) );
        const g = study.report().samples.gesture;
        if ( g.status === 'returned-output' ) { assert.ok( g.raw.rotations.some( x => x[ 1 ][ 3 ] !== 1 ) ); assert.ok( g.effective.rotations.every( x => x[ 1 ].join() === '0,0,0,1' ) ); }
        if ( b.gesture.applied.activation === 1 ) { peak = true; assert.ok( !b.stack.boneChannels.get( 'upperarm_l' ).rotationWriters.includes( 'gesture' ) ); }
    }
    assert.ok( peak ); assert.ok( b.gesture.utteranceTime > 1.9 ); cleanup( a, study );
} );

test( 'B preserves positive posture spread exactly rather than muting the full posture owner', () => {
    const a = fixture( { mood: 'happy' } ), b = fixture( { mood: 'happy' } ), study = install( b, 'B' );
    for ( let i = 0; i < 100; i++ ) { a.stack.update( 1 / 60 ); b.stack.update( 1 / 60 ); assert.deepEqual( snapshot( a ), snapshot( b ) ); }
    assert.ok( b.posture.appliedArmRadians.leftUpperArm > 0 ); assert.deepEqual( study.report().samples.posture.suppressed, [] ); cleanup( a, study );
} );

test( 'neutral null frames and stopped gestures cannot replay stale native telemetry', () => {
    const neutral = fixture( { mood: 'neutral', speaking: false } ), n = install( neutral, 'B' ); neutral.stack.update( 1 / 60 );
    assert.equal( n.report().samples.posture.status, 'no-returned-output' ); assert.equal( n.report().samples.gesture.status, 'no-returned-output' ); cleanup( n );
    const f = fixture(), s = install( f, 'C' ); for ( let i = 0; i < 100; i++ ) f.stack.update( 1 / 60 );
    assert.equal( s.report().samples.gesture.status, 'returned-output' ); f.gesture.stop(); f.stack.update( 1 / 60 );
    assert.ok( f.gesture.applied.shoulderDegrees > 0, 'native last-degree telemetry remains stale after stop' );
    assert.equal( s.report().samples.gesture.status, 'no-returned-output' ); assert.deepEqual( s.report().samples.gesture.suppressed, [] ); cleanup( s );
} );

test( 'initially disabled native owners stay disabled, including native skipped-frame behavior', () => {
    const f = fixture( { gestureEnabled: false, postureEnabled: false } ), s = install( f, 'C' ); f.stack.update( 1 / 60 );
    assert.equal( s.report().samples.gesture.status, 'disabled' ); assert.equal( s.report().samples.posture.status, 'disabled' );
    assert.equal( f.gesture.utteranceTime, 0 ); assert.equal( f.disabled.skipped, 1 ); assert.equal( f.silent.calls, 1 ); cleanup( s );
} );

test( 'ordered all-owner receipts distinguish actual returns from populated null buffers and skipped owners', () => {
    const f = fixture(), s = install( f, 'C' ); for ( let i = 0; i < 100; i++ ) f.stack.update( 1 / 60 );
    const report = s.report(); assert.deepEqual( report.owners.map( x => x.name ), f.stack.layers.map( x => x.name ) );
    for ( const [ i, owner ] of report.owners.entries() ) {
        const l = f.stack.layers[ i ];
        assert.deepEqual( owner.randomAfterFrame, { seed: l.random.seed, state: l.random.state, spareGaussian: l.random.spareGaussian } );
        if ( owner.status === 'returned-output' ) {
            const { ownerName, ...raw } = owner.raw; assert.equal( ownerName, l.name ); assert.deepEqual( raw, rows( l.contribution ) );
            if ( l !== f.gesture ) assert.deepEqual( owner.effective, owner.raw );
        }
    }
    const silent = report.owners.find( x => x.name === 'nullWitness' ), disabled = report.owners.find( x => x.name === 'disabledWitness' );
    assert.equal( silent.status, 'no-returned-output' ); assert.equal( silent.raw, null ); assert.equal( silent.effective, null );
    assert.ok( f.silent.contribution.morphs.get( 'viseme_aa' ) > 0 ); assert.equal( disabled.status, 'disabled' );
    assert.ok( !f.stack.morphChannels.get( 'viseme_aa' ).writerNames.includes( 'nullWitness' ) ); cleanup( s );
} );

test( 'reset/rebind/rest recapture/registration/declaration/identity/outfit mutations fail before native mutation', () => {
    const actions = [ f => f.stack.reset(), f => f.stack.bind( f.target ), f => f.stack.captureRestPose(), f => f.stack.add( new Layer( { name: 'new' } ) ),
        f => f.stack.remove( f.posture ), f => f.stack.markChannelsDirty(), f => f.stack.rebuildChannels(), f => f.stack.dispose(),
        f => f.posture.reset(), f => f.posture.onBind( f.stack.context ), f => f.posture.declareChannels( { boneChannels: [] } ),
        f => f.gesture.dispose(), f => f.a.setIdentity( {} ), f => f.a.dress( [] ) ];
    for ( const action of actions ) {
        const f = fixture(), s = install( f, 'B' ), before = snapshot( f ), budget = structuredClone( f.posture.maxAdductionRadians );
        assert.throws( () => action( f ), /Forbidden lifecycle mutation/ ); assert.deepEqual( snapshot( f ), before );
        assert.deepEqual( f.posture.maxAdductionRadians, budget ); assert.equal( f.a.identityMutated, undefined ); assert.equal( f.a.wardrobeMutated, undefined ); cleanup( s );
    }
} );

test( 'owner, target, weight, order, enabled and source configuration assignments are blocked before mutation', () => {
    const actions = [ f => { f.a.posture = {}; }, f => { f.stack.target = {}; }, f => { f.posture.weight = 0; }, f => { f.gesture.order = 50; },
        f => { f.gesture.enabled = false; }, f => { f.posture.boneChannels = []; }, f => { f.stack.context.shared.posture = {}; }, f => { f.gesture.sagittalShare = 0; } ];
    for ( const action of actions ) { const f = fixture(), s = install( f, 'B' ), before = snapshot( f ); assert.throws( () => action( f ), /Forbidden field mutation/ ); assert.deepEqual( snapshot( f ), before ); cleanup( s ); }
} );

test( 'unsupported direct array/map/target edits are detected before the next native frame advances', () => {
    const actions = [ f => f.stack.layers.reverse(), f => f.posture.boneChannels.reverse(), f => f.posture.contribution.boneRotations.delete( 'upperarm_l' ),
        f => { f.target.getBone = () => new Bone(); }, f => { f.posture.bones.leftUpperArm = 'hand_l'; } ];
    for ( const action of actions ) {
        const f = fixture(), s = install( f, 'B' ); action( f ); const frame = f.stack.frame, time = f.stack.time;
        assert.throws( () => f.stack.update( 1 / 60 ), /drift|replaced/ ); assert.equal( f.stack.frame, frame ); assert.equal( f.stack.time, time ); cleanup( s );
    }
} );

test( 'mid-frame unsafe mutation stops before commit and poisons further stepping', () => {
    const f = fixture(), s = install( f, 'B' ), before = [ ...f.stack.boneChannels ].map( ( [ n, c ] ) => [ n, c.bone.quaternion.toArray() ] );
    f.foreign.callback = () => { f.gesture.weight = 0; };
    assert.throws( () => f.stack.update( 1 / 60 ), /Forbidden field mutation/ );
    assert.deepEqual( [ ...f.stack.boneChannels ].map( ( [ n, c ] ) => [ n, c.bone.quaternion.toArray() ] ), before );
    assert.equal( f.stack.frame, 1, 'failed native frame began; no false rollback claim' ); assert.equal( s.report().completedFrames, 0 );
    assert.throws( () => f.stack.update( 1 / 60 ), /reuse is forbidden/ ); assert.equal( f.stack.frame, 1 ); cleanup( s );
} );

test( 'direct accumulator/commit calls and duplicate instrumentation are rejected', () => {
    for ( const action of [ ( f ) => f.stack.accumulate( f.posture, f.posture.contribution ), f => f.stack.commit(), f => f.stack.beginFrame() ] ) {
        const f = fixture(), s = install( f, 'A' ); assert.throws( () => install( f, 'C' ), /unwrapped frame path|already owns/ );
        assert.throws( () => action( f ), /actual owner contribution|Direct stack/ ); assert.equal( f.stack.frame, 0 ); cleanup( s );
    }
} );

test( 'partial acquisition failure restores exact descriptors and leaves normal native teardown available', () => {
    const f = fixture(); Object.defineProperty( f.a, 'dress', { value: f.a.dress, writable: true, configurable: false, enumerable: true } );
    const objects = [ f.a, f.stack, f.stack.context, f.stack.context.shared, ...f.stack.layers ], before = objects.map( Object.getOwnPropertyDescriptors );
    assert.throws( () => install( f, 'B' ), /Cannot acquire.*dress/ );
    objects.forEach( ( o, i ) => assert.deepEqual( Object.getOwnPropertyDescriptors( o ), before[ i ] ) );
    f.stack.update( 1 / 60 ); cleanup( f ); assert.equal( f.a.teardownCalls, 1 );
} );

test( 'descriptor theft is reported without overwriting the new owner during teardown', () => {
    const f = fixture(), s = install( f, 'C' ), foreign = function () {};
    Object.defineProperty( f.stack, 'accumulate', { value: foreign, writable: true, configurable: true } );
    assert.throws( () => f.stack.update( 1 / 60 ), /descriptor ownership lost/ ); assert.equal( f.stack.frame, 0 );
    assert.throws( () => s.dispose(), /teardown failed/ ); assert.equal( f.stack.accumulate, foreign );
    assert.equal( f.a.disposed, true ); assert.equal( f.a.teardownCalls, 1 ); assert.ok( s.report().cleanup.lost.includes( 'accumulate' ) );
} );

test( 'teardown restores exact owned descriptors then retires Avatar once, with no detached/reusable state', () => {
    const f = fixture(), before = Object.getOwnPropertyDescriptor( f.stack, 'accumulate' ), s = install( f, 'B' ), guardedUpdate = f.stack.update;
    f.stack.update( 1 / 60 ); const report = s.report(); report.samples.posture.effective.rotations[ 0 ][ 1 ][ 0 ] = 999;
    assert.notEqual( s.report().samples.posture.effective.rotations[ 0 ][ 1 ][ 0 ], 999 );
    f.a.dispose(); assert.equal( f.a.teardownCalls, 1 ); assert.equal( s.report().status, 'disposed' );
    assert.deepEqual( Object.getOwnPropertyDescriptor( f.stack, 'accumulate' ), before ); assert.deepEqual( s.report().cleanup.lost, [] );
    assert.throws( () => s.dispose(), /reuse is forbidden/ ); assert.throws( () => guardedUpdate.call( f.stack, 1 / 60 ), /reuse is forbidden/ );
    assert.throws( () => install( f, 'B' ), /fresh, live/ );
} );

test( 'native teardown failure is surfaced after restoration, with retired state and no repeat disposal', () => {
    const f = fixture(), native = f.a.dispose;
    f.a.dispose = function () { native.call( this ); throw Error( 'controlled native disposal failure' ); };
    const s = install( f, 'C' );
    assert.throws( () => s.dispose(), error => error instanceof AggregateError && error.errors.some( e => /controlled native/.test( e.message ) ) );
    assert.equal( f.a.teardownCalls, 1 ); assert.equal( f.a.disposed, true ); assert.equal( s.report().status, 'disposed' );
    assert.deepEqual( s.report().cleanup.lost, [] ); assert.equal( f.stack.update, MotionStack.prototype.update );
    assert.throws( () => s.dispose(), /reuse is forbidden/ );
} );

console.log( JSON.stringify( { passed: true, groups: results.length, sourceHashes,
    adapterSha256: sha( fs.readFileSync( new URL( './HandAttributionArm.mjs', import.meta.url ) ) ),
    testSha256: sha( fs.readFileSync( fileURLToPath( import.meta.url ) ) ),
    scope: 'Native CPU motion mechanism on exact shipped bone hierarchy with controlled foreign writers. No WebGPU, skinned hand clearance, real Avatar teardown or visual qualification.' }, null, 2 ) );
