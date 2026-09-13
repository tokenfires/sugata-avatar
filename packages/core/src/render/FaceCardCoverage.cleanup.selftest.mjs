import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import {
    Scene, Group, Mesh, BufferGeometry, Float32BufferAttribute,
    MeshPhysicalNodeMaterial, Texture, PerspectiveCamera, Matrix4
} from 'three/webgpu';
import { vec4, velocity } from 'three/tsl';
import { RenderParticipants } from './RenderParticipants.js';
import { createFaceCardCoverage } from './FaceCardCoverage.js';

// CPU exception-boundary checks with actual TSL nodes and the actual participant registry.
// Fault injection is confined to a copy in a unique OS temporary directory. Nothing is
// written beside the production module, and no browser, renderer, or GPU is started.
const moduleUrl = new URL( './FaceCardCoverage.js', import.meta.url );
const source = await readFile( moduleUrl, 'utf8' );
const sourceSha256 = createHash( 'sha256' ).update( source ).digest( 'hex' );
const results = [];

function findUniform( material, name ) {
    let found;
    material.alphaTestNode.traverse( node => { if ( node.name === name ) found = node; } );
    assert.ok( found, `Missing ${name}` );
    return found;
}

function fixture() {
    const camera = new PerspectiveCamera(), scene = new Scene(), root = new Group();
    scene.add( root );
    const projection = new Matrix4();
    let target = null, mrt = null;
    const renderer = {
        _initialized: true, xr: { enabled: false, isPresenting: false },
        _nodes: { nodeFrame: { renderId: 0 } },
        getRenderTarget: () => target, setRenderTarget: value => target = value,
        getMRT: () => mrt, setMRT: value => mrt = value
    };
    const stage = {
        renderer, camera, scene, multisampled: false, viewMode: 'beauty', renderPipeline: {},
        scenePass: { renderTarget: {}, overrideMaterial: null },
        temporal: { mode: 'taau', getUnjitteredProjection: () => projection, resetFrameEpoch() {} }
    };
    stage.renderParticipants = new RenderParticipants( stage );
    stage.registerRenderParticipant = participant => stage.renderParticipants.register( participant );
    const materials = [], meshes = [];
    for ( let index = 0; index < 2; index ++ ) {
        const material = new MeshPhysicalNodeMaterial();
        material.name = `cleanup.${index}`;
        material.map = new Texture();
        material.colorNode = vec4( 0.1, 0.1, 0.1, 0.5 );
        material.alphaTest = 0.1;
        const geometry = new BufferGeometry();
        geometry.setAttribute( 'position', new Float32BufferAttribute( [ 0, 0, 0, 1, 0, 0, 0, 1, 0 ], 3 ) );
        const mesh = new Mesh( geometry, material );
        root.add( mesh ); materials.push( material ); meshes.push( mesh );
    }
    function update( index ) {
        const node = findUniform( materials[ index ], 'faceCardCoverageEnabled' );
        node.update( { renderer, camera, scene, object: meshes[ index ], material: materials[ index ], frameId: 11 } );
        return node.value;
    }
    function fresh( body ) {
        return stage.renderParticipants.draw( () => {
            const receipt = stage.renderParticipants.mainPassBegin( stage.scenePass, { renderer } );
            renderer.setRenderTarget( stage.scenePass.renderTarget );
            velocity.setProjectionMatrix( projection );
            try {
                const value = body();
                stage.renderParticipants.mainPassEnd( receipt, null );
                return value;
            } finally {
                renderer.setRenderTarget( null );
                velocity.setProjectionMatrix( null );
            }
        } );
    }
    function release() {
        const errors = [];
        const attempt = callback => { try { callback(); } catch ( error ) { errors.push( error ); } };
        attempt( () => stage.renderParticipants.dispose() );
        for ( const mesh of meshes ) attempt( () => mesh.geometry.dispose() );
        for ( const material of materials ) {
            attempt( () => material.map.dispose() );
            attempt( () => material.dispose() );
        }
        velocity.setProjectionMatrix( null );
        if ( errors.length ) throw new AggregateError( errors, 'Fixture cleanup failed.' );
    }
    return { stage, root, materials, meshes, update, fresh, release };
}

function test( name, run ) {
    const f = fixture();
    let failure;
    try { run( f ); } catch ( error ) { failure = error; }
    try { f.release(); } catch ( cleanup ) {
        failure = failure ? new AggregateError( [ failure, cleanup ], name ) : cleanup;
    }
    if ( failure ) throw failure;
    results.push( { name, passed: true } );
    console.log( 'PASS ' + name );
}

function install( f, create = createFaceCardCoverage ) {
    return create( { stage: f.stage, root: f.root, materials: f.materials } );
}

function assertReleased( f, owner ) {
    assert.equal( f.stage.renderParticipants.clients.size, 0 );
    for ( const material of f.materials ) {
        assert.equal( material.alphaTestNode, null );
        assert.equal( material._listeners?.dispose?.length ?? 0, 0 );
    }
    if ( owner ) {
        assert.equal( owner.report().managedMaterials, 0 );
        assert.equal( owner.report().registered, false );
    }
}

function retainNodes( f ) {
    const enabled = f.materials.map( material => findUniform( material, 'faceCardCoverageEnabled' ) );
    const nodes = f.materials.flatMap( material => [
        findUniform( material, 'faceCardCoverageEnabled' ),
        findUniform( material, 'faceCardCoverageOffset' )
    ] );
    const disposals = nodes.map( () => 0 );
    nodes.forEach( ( node, index ) => node.addEventListener( 'dispose', () => disposals[ index ] ++ ) );
    return { enabled, disposals };
}

function activate( f ) {
    f.fresh( () => {
        assert.equal( f.update( 0 ), 1 );
        assert.equal( f.update( 1 ), 1 );
    } );
}

function assertDisabled( nodes ) {
    for ( const node of nodes ) { node.update( {} ); assert.equal( node.value, 0 ); }
}

function replaceOnce( text, before, after ) {
    assert.equal( text.split( before ).length, 2, `Fault-injection import changed: ${before}` );
    return text.replace( before, after );
}

let temporaryDirectory;
try {
    temporaryDirectory = await mkdtemp( join( tmpdir(), 'sugata-face-coverage-cleanup-' ) );
    // Resolve dependencies from this installed test's location, never from OS temp. In
    // particular this retains the same actual Three module graph and velocity singleton.
    let faultSource = replaceOnce( source,
        "import { float, max, select, uniform, velocity } from 'three/tsl';",
        `import { float, max, select, uniform as realUniform, velocity } from ${JSON.stringify( import.meta.resolve( 'three/tsl' ) )};`
    );
    faultSource = replaceOnce( faultSource,
        "from './HairOIT.js';",
        `from ${JSON.stringify( new URL( './HairOIT.js', import.meta.url ).href )};`
    );
    faultSource += `
export const cleanupFault = { mode: null, calls: 0, failAt: 0, nodes: [], disposals: [], error: null };
function uniform( ...args ) {
    const call = ++ cleanupFault.calls;
    if ( cleanupFault.mode === 'allocation' && call === cleanupFault.failAt ) throw cleanupFault.error;
    const node = realUniform( ...args );
    cleanupFault.nodes.push( node );
    node.addEventListener( 'dispose', () => cleanupFault.disposals.push( call ) );
    const setName = node.setName;
    node.setName = function( ...nameArgs ) {
        if ( cleanupFault.mode === 'configuration' && call === cleanupFault.failAt ) throw cleanupFault.error;
        return setName.apply( this, nameArgs );
    };
    return node;
}
`;
    const faultUrl = pathToFileURL( join( temporaryDirectory, 'FaceCardCoverage.fault.mjs' ) );
    await writeFile( faultUrl, faultSource );
    const { cleanupFault: fault, createFaceCardCoverage: createFaulty } = await import( faultUrl.href );

    for ( const mode of [ 'allocation', 'configuration' ] ) {
        for ( const failAt of [ 1, 2, 3, 4 ] ) {
            test( `${mode} failure at uniform ${failAt} releases partial ownership and permits retry`, f => {
                const failure = new Error( `Controlled ${mode} failure ${failAt}` );
                Object.assign( fault, { mode, calls: 0, failAt, nodes: [], disposals: [], error: failure } );
                assert.throws( () => install( f, createFaulty ), error => error === failure );
                assertReleased( f );
                const completed = mode === 'allocation' ? failAt - 1 : failAt;
                assert.equal( fault.nodes.length, completed );
                assert.deepEqual( fault.disposals, Array.from( { length: completed }, ( _, index ) => index + 1 ) );
                // The retry must use the same module's owners WeakMap; another copy would
                // conceal a retained material lease after a failed constructor.
                fault.failAt = 0;
                const retry = install( f, createFaulty );
                activate( f ); retry.dispose(); assertReleased( f, retry );
            } );
        }
    }

    test( 'Active owner disposal disables retained uniforms and is idempotent', f => {
        const owner = install( f ), retained = retainNodes( f );
        activate( f ); owner.dispose(); owner.dispose();
        assertReleased( f, owner ); assertDisabled( retained.enabled );
        assert.equal( owner.report().live, false );
        assert.deepEqual( retained.disposals, [ 1, 1, 1, 1 ] );
    } );

    test( 'Independent material retirement releases the final registration exactly once', f => {
        const owner = install( f ), retained = retainNodes( f );
        activate( f ); f.materials[ 0 ].dispose();
        assertDisabled( [ retained.enabled[ 0 ] ] );
        assert.equal( owner.report().managedMaterials, 1 );
        assert.equal( owner.report().registered, true );
        assert.deepEqual( retained.disposals, [ 1, 1, 0, 0 ] );
        f.materials[ 1 ].dispose(); assertDisabled( retained.enabled );
        assertReleased( f, owner ); owner.dispose(); owner.dispose();
        assert.deepEqual( retained.disposals, [ 1, 1, 1, 1 ] );
    } );

    test( 'Stage retirement releases graphs and listeners without re-enabling retained uniforms', f => {
        const owner = install( f ), retained = retainNodes( f );
        activate( f ); f.stage.renderParticipants.dispose(); f.stage.renderParticipants.dispose();
        assertReleased( f, owner ); assertDisabled( retained.enabled );
        assert.equal( owner.report().live, false );
        assert.deepEqual( retained.disposals, [ 1, 1, 1, 1 ] );
    } );

    test( 'A clearActive error is reported while every retirement and unregistration completes', f => {
        const owner = install( f ), retained = retainNodes( f );
        activate( f );
        const failure = new Error( 'Controlled clearActive reset failure' );
        const enabled = retained.enabled[ 0 ];
        let value = enabled.value, shouldThrow = true;
        Object.defineProperty( enabled, 'value', {
            configurable: true, get: () => value,
            set: next => {
                if ( next === 0 && shouldThrow ) { shouldThrow = false; throw failure; }
                value = next;
            }
        } );
        assert.throws( () => owner.dispose(), error => error instanceof AggregateError && error.errors.includes( failure ) );
        assertReleased( f, owner ); assertDisabled( retained.enabled ); owner.dispose();
        assert.deepEqual( retained.disposals, [ 1, 1, 1, 1 ] );
    } );
} finally {
    if ( temporaryDirectory ) await rm( temporaryDirectory, { recursive: true, force: true } );
}

assert.equal( await readFile( moduleUrl, 'utf8' ), source, 'Production module changed during the selftest.' );
assert.equal( results.length, 12 );
console.log( JSON.stringify( {
    groups: results.length, passed: true, sourceSha256, temporaryModulesRemoved: true,
    scope: 'CPU cleanup boundaries using actual TSL nodes; injected configuration failures do not claim ordinary setName throws or actual GPU allocation failure.'
} ) );
