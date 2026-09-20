import assert from 'node:assert/strict';
import { Scene, Group, Mesh, BufferGeometry, Float32BufferAttribute, MeshPhysicalNodeMaterial, Texture, PerspectiveCamera, Matrix4 } from 'three/webgpu';
import { vec4, velocity, float } from 'three/tsl';
import { RenderParticipants } from './RenderParticipants.js';
import { createFaceCardCoverage } from './FaceCardCoverage.js';
let groups = 0;
const test = ( name, run ) => { run(); groups ++; console.log( 'PASS ' + name ); };
function findEnable( material ) { let result; material.alphaTestNode.traverse( n => { if ( n.name === 'faceCardCoverageEnabled' ) result = n; } ); assert.ok( result ); return result; }
function fixture() {
    const camera = new PerspectiveCamera(), scene = new Scene(), root = new Group(); scene.add( root );
    const projection = new Matrix4(); let target = null, mrt = null;
    const renderer = { _initialized: true, xr: { enabled: false, isPresenting: false },
        _nodes: { nodeFrame: { renderId: 0 } }, getRenderTarget: () => target, setRenderTarget: v => target = v,
        getMRT: () => mrt, setMRT: v => mrt = v };
    const stage = { renderer, camera, scene, multisampled: false, viewMode: 'beauty', renderPipeline: {},
        scenePass: { renderTarget: {}, overrideMaterial: null },
        temporal: { mode: 'taau', getUnjitteredProjection: () => projection, resetFrameEpoch() {} } };
    stage.renderParticipants = new RenderParticipants( stage );
    stage.registerRenderParticipant = p => stage.renderParticipants.register( p );
    const materials = [], meshes = [];
    for ( let i = 0; i < 2; i ++ ) {
        const material = new MeshPhysicalNodeMaterial(); material.name = 'face.' + i;
        material.map = new Texture(); material.colorNode = vec4( 0.1, 0.1, 0.1, 0.5 ); material.alphaTest = 0.1; material.specularIntensity = 0;
        const geometry = new BufferGeometry(); geometry.setAttribute( 'position', new Float32BufferAttribute( [ 0, 0, 0, 1, 0, 0, 0, 1, 0 ], 3 ) );
        const mesh = new Mesh( geometry, material ); root.add( mesh ); materials.push( material ); meshes.push( mesh );
    }
    const install = mode => createFaceCardCoverage( { stage, root, materials, mode } );
    function update( index = 0, overrides = {} ) {
        const frame = { renderer, camera, scene, object: meshes[ index ], material: materials[ index ], frameId: 11, ...overrides };
        const node = findEnable( materials[ index ] ); node.update( frame ); return node.value;
    }
    function fresh( body = () => update() ) {
        return stage.renderParticipants.draw( () => {
            const receipt = stage.renderParticipants.mainPassBegin( stage.scenePass, { renderer } );
            renderer.setRenderTarget( stage.scenePass.renderTarget ); velocity.setProjectionMatrix( projection );
            try { const value = body(); stage.renderParticipants.mainPassEnd( receipt, null ); return value; }
            finally { renderer.setRenderTarget( null ); velocity.setProjectionMatrix( null ); }
        } );
    }
    return { stage, root, materials, meshes, projection, install, update, fresh };
}

test( 'Exact approved alpha graph preserves material inputs and all mesh callbacks', () => {
    const f = fixture(), before = f.materials.map( m => ( { color: m.colorNode, map: m.map, alphaTest: m.alphaTest, position: m.positionNode, mrt: m.mrtNode, version: m.version } ) );
    const callbacks = f.meshes.map( o => [ o.onBeforeRender, o.onAfterRender ] );
    const h = f.install(); assert.equal( f.fresh(), 1 );
    for ( let i = 0; i < 2; i ++ ) { const m = f.materials[ i ], b = before[ i ]; assert.equal( m.colorNode, b.color ); assert.equal( m.map, b.map ); assert.equal( m.alphaTest, 0.1 ); assert.equal( m.positionNode, b.position ); assert.equal( m.mrtNode, b.mrt ); assert.deepEqual( [ f.meshes[ i ].onBeforeRender, f.meshes[ i ].onAfterRender ], callbacks[ i ] ); }
    h.dispose(); assert.ok( f.materials.every( m => m.alphaTestNode === null ) );
} );
test( 'Off, debug, custom bypass, XR and MSAA transition to binary without recompiling', () => {
    const mutations = [ f => f.stage.temporal = null, f => f.stage.viewMode = 'normal', f => f.stage.renderPipeline = null,
        f => f.stage.renderer.xr.isPresenting = true, f => f.stage.multisampled = true,
        f => f.stage.temporal.getUnjitteredProjection = () => new Matrix4(), f => f.stage.scene.overrideMaterial = {}, f => f.stage.scenePass.overrideMaterial = {} ];
    for ( const mutate of mutations ) { const f = fixture(), h = f.install(), versions = f.materials.map( m => m.version ); assert.equal( f.fresh(), 1 ); mutate( f ); assert.equal( f.fresh(), 0 ); assert.deepEqual( f.materials.map( m => m.version ), versions ); h.dispose(); }
} );
test( 'Returning from temporal-off and eligible TRAA restores coverage in the same graph', () => {
    const f = fixture(), h = f.install(), temporal = f.stage.temporal, version = f.materials[ 0 ].version;
    f.stage.temporal = null; assert.equal( f.fresh(), 0 ); f.stage.temporal = temporal; temporal.mode = 'traa'; assert.equal( f.fresh(), 1 );
    assert.equal( f.materials[ 0 ].version, version ); h.dispose();
} );
test( 'Wrong camera, target, object, material or direct render cannot activate', () => {
    for ( const overrides of [ f => ( { camera: new PerspectiveCamera() } ), f => ( { material: {} } ), f => ( { object: new Mesh() } ), f => ( { scene: new Scene() } ) ] ) {
        const f = fixture(), h = f.install(); assert.equal( f.fresh( () => f.update( 0, overrides( f ) ) ), 0 ); h.dispose();
    }
    const f = fixture(), h = f.install(); assert.equal( f.fresh(), 1 ); assert.equal( f.update(), 0 );
    assert.equal( f.fresh( () => { f.stage.renderer.setRenderTarget( {} ); return f.update(); } ), 0 ); h.dispose();
} );
test( 'Participant transaction/pass receipt is necessary despite a matching projection', () => {
    const f = fixture(), h = f.install(); velocity.setProjectionMatrix( f.projection ); f.stage.renderer.setRenderTarget( f.stage.scenePass.renderTarget );
    assert.equal( f.update(), 0 ); f.stage.renderParticipants.draw( () => assert.equal( f.update(), 0 ) );
    f.stage.renderParticipants.draw( () => { const p = f.stage.renderParticipants.mainPassBegin( {}, { renderer: f.stage.renderer } ); assert.equal( f.update(), 0 ); f.stage.renderParticipants.mainPassEnd( p, null ); } );
    velocity.setProjectionMatrix( null ); h.dispose();
} );
test( 'Existing synchronous mesh callbacks remain untouched and composable', () => {
    const f = fixture(); let calls = 0; const before = () => calls ++, after = () => calls ++;
    f.meshes[ 0 ].onBeforeRender = before; f.meshes[ 0 ].onAfterRender = after;
    const h = f.install(); f.fresh( () => { f.meshes[ 0 ].onBeforeRender(); assert.equal( f.update(), 1 ); f.meshes[ 0 ].onAfterRender(); } );
    h.dispose(); assert.equal( calls, 2 ); assert.equal( f.meshes[ 0 ].onBeforeRender, before ); assert.equal( f.meshes[ 0 ].onAfterRender, after );
} );
test( 'Material.dispose retires one graph, then unregisters when the last is gone', () => {
    const f = fixture(), h = f.install(), retained = findEnable( f.materials[ 0 ] ); assert.equal( f.fresh(), 1 );
    f.materials[ 0 ].dispose(); assert.equal( h.report().managedMaterials, 1 ); assert.equal( f.materials[ 0 ].alphaTestNode, null ); retained.update( {} ); assert.equal( retained.value, 0 );
    f.materials[ 1 ].dispose(); assert.equal( h.report().managedMaterials, 0 ); assert.equal( f.stage.renderParticipants.clients.size, 0 ); h.dispose(); h.dispose();
} );
test( 'Removed/replaced mesh material is pruned at next Stage transaction', () => {
    const f = fixture(), h = f.install(); f.meshes[ 0 ].material = new MeshPhysicalNodeMaterial(); f.root.remove( f.meshes[ 1 ] );
    f.stage.renderParticipants.draw( () => {} ); assert.equal( h.report().managedMaterials, 0 ); assert.equal( f.stage.renderParticipants.clients.size, 0 );
    assert.ok( f.materials.every( m => m.alphaTestNode === null ) ); h.dispose();
} );
test( 'Geometry or position graph replacement fails closed and restores only owned threshold', () => {
    const f = fixture(), h = f.install(); f.meshes[ 0 ].geometry = new BufferGeometry(); f.materials[ 1 ].positionNode = vec4( 1 );
    f.stage.renderParticipants.draw( () => {} ); assert.equal( h.report().managedMaterials, 0 ); h.dispose();
    const q = fixture(), owner = q.install(), foreign = float( 0.7 ); q.materials[ 0 ].alphaTestNode = foreign; owner.dispose(); assert.equal( q.materials[ 0 ].alphaTestNode, foreign );
} );
test( 'Binary/MSAA controls allocate no participant or material graph', () => {
    for ( const msaa of [ false, true ] ) { const f = fixture(); f.stage.multisampled = msaa; const h = f.install( msaa ? 'auto' : 'binary' ); assert.equal( f.stage.renderParticipants.clients.size, 0 ); assert.ok( f.materials.every( m => m.alphaTestNode === null ) ); h.dispose(); }
} );
test( 'Repeated attachment/removal and Stage disposal leave no client/listener accumulation', () => {
    const f = fixture();
    for ( let i = 0; i < 30; i ++ ) { const h = f.install(); assert.equal( f.fresh(), 1 ); h.dispose(); assert.equal( f.stage.renderParticipants.clients.size, 0 ); for ( const m of f.materials ) assert.equal( m._listeners?.dispose?.length ?? 0, 0 ); }
    const h = f.install(); f.stage.renderParticipants.dispose(); assert.equal( h.report().live, false ); assert.equal( f.stage.renderParticipants.clients.size, 0 );
} );
test( 'Image abort and Stage invalidation immediately disable retained uniform', () => {
    const f = fixture(), h = f.install(), n = findEnable( f.materials[ 0 ] ); f.fresh(); assert.equal( n.value, 1 ); f.stage.renderParticipants.invalidate( 'test mode change' ); assert.equal( n.value, 0 );
    assert.throws( () => f.fresh( () => { f.update(); throw Error( 'draw failed' ); } ), /draw failed/ ); assert.equal( n.value, 0 ); h.dispose();
} );
test( 'Duplicate/invalid installation rejects before changing either material', () => {
    const f = fixture(), h = f.install(); assert.throws( () => f.install(), /already owned/ ); assert.throws( () => f.install( 'binary' ), /already owned/ ); h.dispose();
    const q = fixture(); q.materials[ 1 ].alphaTest = 0.5; assert.throws( () => q.install(), /Unexpected/ ); assert.equal( q.stage.renderParticipants.clients.size, 0 ); assert.equal( q.materials[ 0 ].alphaTestNode, null );
    assert.throws( () => q.install( 'random' ), /mode/ );
} );
test( 'Partial listener install failure releases graphs/ownership/Stage lease', () => {
    const f = fixture(); f.materials[ 1 ].addEventListener = () => { throw Error( 'listener red' ); };
    assert.throws( () => f.install(), /listener red/ ); assert.equal( f.stage.renderParticipants.clients.size, 0 ); assert.ok( f.materials.every( m => m.alphaTestNode === null ) );
    assert.equal( f.materials[ 0 ]._listeners?.dispose?.length ?? 0, 0 );
} );
const { readFileSync } = await import( 'node:fs' );
const { runInNewContext } = await import( 'node:vm' );
test( 'Actual Avatar shading disposal detaches owner first and attempts every resource', () => {
    const source = readFileSync( new URL( '../Avatar.js', import.meta.url ), 'utf8' );
    const text = source.slice( source.indexOf( '    disposeShading() {' ), source.indexOf( '    // --- reporting helpers' ) );
    const dispose = runInNewContext( '({' + text + '}).disposeShading' );
    const calls = [], resource = name => ( { dispose() { calls.push( name ); if ( name === 'coverage' ) throw Error( 'listener red' ); } } );
    const avatar = { faceCardCoverage: resource( 'coverage' ), eyeOcclusion: resource( 'occlusion' ), eyes: resource( 'eyes' ), skin: resource( 'skin' ), cards: [ resource( 'brow' ), resource( 'lash' ) ] };
    assert.throws( () => dispose.call( avatar ), /Shading disposal failed/ );
    assert.deepEqual( calls, [ 'coverage', 'occlusion', 'eyes', 'skin', 'brow', 'lash' ] );
    assert.equal( avatar.faceCardCoverage, null ); assert.equal( avatar.cards.length, 0 ); assert.equal( avatar.skin, null );
} );
const { Avatar, AVATAR_DEFAULTS } = await import( '../Avatar.js' );
assert.equal( AVATAR_DEFAULTS.faceCardCoverage, 'auto' );
await assert.rejects( Avatar.create( { canvas: { getContext() { throw Error( 'GPU must not be touched' ); } }, faceCardCoverage: 'invalid' } ), /faceCardCoverage must be auto or binary/ );
groups ++;
console.log( 'PASS Invalid Avatar coverage mode rejects before GPU setup; auto is the default' );
console.log( JSON.stringify( { groups } ) );
