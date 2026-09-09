// Geometry identity and wardrobe canonical-topology controls; no ignored fixtures or GPU.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { BufferAttribute, BufferGeometry, Bone, Matrix4, Skeleton, SkinnedMesh,
    InterleavedBuffer, InterleavedBufferAttribute } from 'three';
import { readGlb, readPrimitive, readAccessor } from '../../../../tools/lut-bake/glb.mjs';
import { transformHairLongFall } from '../../../../tools/figure-pipeline/hair_long_fall.mjs';
import { transformHairLongFallG025 } from '../../../../tools/figure-pipeline/hair_long_fall_g025.mjs';
import { selectHairBodyContactCalibration as select, HAIR_BODY_CONTACT_CALIBRATION as C } from './HairBodyContactCalibration.js';
const root = fileURLToPath( new URL( '../../../../', import.meta.url ) );
const temp = fs.mkdtempSync( path.join( os.tmpdir(), 'sugata-contact-calibration-' ) );
const resources = [];
function meshFrom( file, name ) {
    const glb = readGlb( file ), p = readPrimitive( glb, name ), mi = glb.json.meshes.findIndex( m => m.name === name );
    const node = glb.json.nodes.find( n => n.mesh === mi ), skin = glb.json.skins[ node.skin ];
    const attributes = glb.json.meshes[ mi ].primitives[ 0 ].attributes;
    const geometry = new BufferGeometry();
    for ( const [ name, source, size, integer ] of [ [ 'position', 'POSITION', 3 ], [ 'normal', 'NORMAL', 3 ],
        [ 'uv', 'TEXCOORD_0', 2 ], [ 'skinIndex', 'JOINTS_0', 4, true ], [ 'skinWeight', 'WEIGHTS_0', 4 ] ] ) {
        const values = readAccessor( glb, attributes[ source ] ).data;
        geometry.setAttribute( name, new BufferAttribute( integer ? new Uint32Array( values ) : new Float32Array( values ), size ) );
    }
    geometry.setIndex( new BufferAttribute( new Uint32Array( p.indices ), 1 ) );
    const inverseValues = readAccessor( glb, skin.inverseBindMatrices ).data;
    const bones = skin.joints.map( i => { const bone = new Bone(); bone.name = glb.json.nodes[ i ].name; return bone; } );
    const skeleton = new Skeleton( bones, bones.map( ( _, i ) => new Matrix4().fromArray( inverseValues, i * 16 ) ) );
    const mesh = new SkinnedMesh( geometry ); mesh.bind( skeleton, new Matrix4() ); mesh.normalizeSkinWeights();
    resources.push( geometry, skeleton ); return mesh;
}
let groups = 0;
async function check( name, run ) { await run(); groups++; console.log( `PASS ${ groups } - ${ name }` ); }
try {
    const bodyFile = path.join( root, 'assets/figures/figure_g050.glb' );
    const output = path.join( temp, 'g050.glb' );
    fs.writeFileSync( output, transformHairLongFall( path.join( root, 'tools/figure-pipeline/fixtures/bob01-g050-original.glb' ), bodyFile ).bytes );
    const body = meshFrom( bodyFile, 'base.001' ), groom = meshFrom( output, 'hair_bob01' );
    const input = { style: 'bob01', bake: 'figure_g050', body, groom };
    await check( 'tracked original and portable correction match runtime-normalized calibrated geometry', async () => {
        const result = await select( input ); assert.equal( result.enabled, true, result.reason );
        assert.equal( result.calibration, C ); assert.deepEqual( result.bodyIndices, new Uint32Array( body.geometry.index.array ) );
        assert.notEqual( result.bodyIndices, body.geometry.index.array );
        const anatomy = JSON.parse( fs.readFileSync( path.join( root, 'tools/critic/fixtures/portrait-anatomy-v1.json' ) ) );
        const a = anatomy.bakes.find( b => b.bake === 'g050' ); assert.deepEqual( C.sourceTriangleIds, a.neckPatchTriangleIds );
        assert.equal( C.sourceTriangleIds.length, 1872 ); assert.equal( C.body.hashes.skinWeight, a.hashes.runtimeWeightFloat32 );
        assert.equal( Object.isFrozen( C.sourceTriangleIds ), true ); assert.equal( Object.isFrozen( C.groom.hashes ), true );
    } );
    await check( 'g025 portable composition selects its exact corresponding body without changing g050', async () => {
        const file = path.join( temp, 'g025.glb' );
        fs.writeFileSync( file, transformHairLongFallG025().bytes );
        const body025 = meshFrom( path.join( root, 'assets/figures/figure_g025.glb' ), 'base.001' );
        const groom025 = meshFrom( file, 'hair_bob01' );
        const result = await select( { style: 'bob01', bake: 'figure_g025', body: body025, groom: groom025 } );
        assert.equal( result.enabled, true, result.reason );
        assert.equal( result.calibration.id, 'bob01-g025-composed-neck-v1' );
        assert.equal( result.calibration.sourceTriangleIds.length, 1872 );
        assert.equal( result.calibration.activeChains.length, 496 );
        assert.notEqual( result.calibration.body.inverseBindSha256, C.body.inverseBindSha256 );
        const original025 = meshFrom( path.join( root, 'tools/figure-pipeline/fixtures/bob01-g025-original.glb' ), 'hair_bob01' );
        assert.equal( ( await select( { style: 'bob01', bake: 'figure_g025', body: body025, groom: original025 } ) ).enabled, false );
        assert.equal( ( await select( input ) ).calibration, C );
    } );
    await check( 'unsupported styles and bakes never touch geometry', async () => {
        const inaccessible = new Proxy( {}, { get() { throw Error( 'read forbidden' ); } } );
        for ( const [ style, bake ] of [ [ 'bob02', 'figure_g050' ], [ 'bob01', 'figure_g000' ], [ 'bob01', 'g050' ], [ null, null ] ] ) {
            const result = await select( { style, bake, body: inaccessible, groom: inaccessible } );
            assert.equal( result.enabled, false ); assert.match( result.reason, /No body-contact calibration/ );
        }
    } );
    await check( 'wardrobe masking requires canonical fullIndex and cannot change triangle ordinals', async () => {
        const original = body.geometry.index, fullIndex = original.array.slice();
        body.geometry.setIndex( new BufferAttribute( fullIndex.slice( 600 ), 1 ) );
        try {
            assert.equal( ( await select( input ) ).enabled, false );
            const result = await select( { ...input, bodyIndices: fullIndex } ); assert.equal( result.enabled, true, result.reason );
            assert.deepEqual( result.bodyIndices, new Uint32Array( fullIndex ) );
            fullIndex[ 0 ] = ( fullIndex[ 0 ] + 1 ) % C.body.vertexCount;
            assert.notEqual( result.bodyIndices[ 0 ], fullIndex[ 0 ] );
            assert.equal( ( await select( { ...input, bodyIndices: fullIndex } ) ).enabled, false );
        } finally { body.geometry.setIndex( original ); }
    } );
    await check( 'modified positions, normals, UVs, skin weights and joints cannot reuse a fixed mask', async () => {
        for ( const mesh of [ body, groom ] ) for ( const name of [ 'position', 'normal', 'uv', 'skinWeight', 'skinIndex' ] ) {
            const attribute = mesh.geometry.getAttribute( name ), before = attribute.array[ 0 ];
            attribute.array[ 0 ] += name === 'skinIndex' ? 1 : .001;
            try { const result = await select( input ); assert.equal( result.enabled, false ); assert.match( result.reason, new RegExp( name ) ); }
            finally { attribute.array[ 0 ] = before; }
        }
    } );
    await check( 'same-count reordered hair topology and bone order are rejected', async () => {
        const index = groom.geometry.index.array; [ index[ 0 ], index[ 1 ] ] = [ index[ 1 ], index[ 0 ] ];
        try { assert.match( ( await select( input ) ).reason, /Groom index/ ); }
        finally { [ index[ 0 ], index[ 1 ] ] = [ index[ 1 ], index[ 0 ] ]; }
        for ( const mesh of [ body, groom ] ) {
            const bones = mesh.skeleton.bones; [ bones[ 0 ], bones[ 1 ] ] = [ bones[ 1 ], bones[ 0 ] ];
            try { assert.match( ( await select( input ) ).reason, /skeleton/ ); }
            finally { [ bones[ 0 ], bones[ 1 ] ] = [ bones[ 1 ], bones[ 0 ] ]; }
        }
    } );
    await check( 'incorrect inverse bind matrices are rejected', async () => {
        for ( const mesh of [ body, groom ] ) {
            const e = mesh.skeleton.boneInverses[ 0 ].elements, before = e[ 12 ]; e[ 12 ] += .001;
            try { assert.match( ( await select( input ) ).reason, /inverse bind/ ); } finally { e[ 12 ] = before; }
        }
    } );
    await check( 'interleaved attributes hash component values and ignore unrelated padding', async () => {
        const original = groom.geometry.getAttribute( 'position' ), values = new Float32Array( original.count * 5 ).fill( 123 );
        for ( let i = 0; i < original.count; i ++ ) for ( let k = 0; k < 3; k ++ ) values[ i * 5 + k + 1 ] = original.getComponent( i, k );
        groom.geometry.setAttribute( 'position', new InterleavedBufferAttribute( new InterleavedBuffer( values, 5 ), 3, 1 ) );
        try { const result = await select( input ); assert.equal( result.enabled, true, result.reason ); }
        finally { groom.geometry.setAttribute( 'position', original ); }
    } );
    await check( 'nonfinite, out-of-range, truncated and malformed geometry are refused', async () => {
        const a = body.geometry.getAttribute( 'position' ), before = a.array[ 0 ]; a.array[ 0 ] = NaN;
        try { assert.equal( ( await select( input ) ).enabled, false ); } finally { a.array[ 0 ] = before; }
        for ( const bodyIndices of [ [ 0, 1 ], [ 0, 1, -1 ], [ 0, 1, C.body.vertexCount ], [ 0, 1, .1 ], new DataView( new ArrayBuffer( 12 ) ) ] ) {
            assert.equal( ( await select( { ...input, bodyIndices } ) ).enabled, false );
        }
        assert.equal( ( await select( { ...input, groom: {} } ) ).enabled, false );
    } );
    await check( 'scale, shear, reflection and animated head scale cannot invalidate the world-width contract', async () => {
        const saved = groom.matrixWorld.clone();
        for ( const matrix of [ new Matrix4().makeScale( 2, 1, 1 ), new Matrix4().makeShear( .1, 0, 0, 0, 0, 0 ), new Matrix4().makeScale( -1, 1, 1 ) ] ) {
            groom.matrixWorld.copy( matrix ); const result = await select( input ); assert.equal( result.enabled, false ); assert.match( result.reason, /rigid/ );
        }
        groom.matrixWorld.copy( saved );
        const head = groom.skeleton.bones.find( bone => bone.name === 'head' ), before = head.matrixWorld.clone();
        head.matrixWorld.makeScale( 1, 2, 1 );
        try { const result = await select( input ); assert.equal( result.enabled, false ); assert.match( result.reason, /rigid/ ); }
        finally { head.matrixWorld.copy( before ); }
    } );
    await check( 'original collision-producing groom cannot activate the corrected-rest calibration', async () => {
        const original = meshFrom( path.join( root, 'tools/figure-pipeline/fixtures/bob01-g050-original.glb' ), 'hair_bob01' );
        const result = await select( { ...input, groom: original } ); assert.equal( result.enabled, false ); assert.match( result.reason, /Groom position/ );
    } );
    const { createHairBodyContactFactory } = await import( './HairBodyContact.js' );
    const { createHairDynamics } = await import( './HairDynamics.js' );
    const selection = await select( input );
    const spy = () => ( { _initialized: true, calls: [], deleted: [],
        compute( nodes ) { this.calls.push( nodes ); },
        _attributes: { delete: null } } );
    const rendererFor = () => { const r = spy(); r._attributes.delete = attribute => r.deleted.push( attribute ); return r; };
    const make = ( renderer, contactFactory = createHairBodyContactFactory( { body, groomMesh: groom, selection } ) ) =>
        createHairDynamics( { renderer, geometry: groom.geometry, contactFactory } );
    await check( 'body owner submits64 reset projections without velocity and16 per normal substep', async () => {
        const renderer = rendererFor(), d = make( renderer );
        try {
            d.update( 0 ); assert.equal( d.contactReport().frames, 1 );
            assert.equal( renderer.calls.length, 1 );
            assert.equal( renderer.calls[ 0 ].filter( node => node.name === 'surface contact coupled chain projection' ).length, 64 );
            assert.equal( renderer.calls[ 0 ].some( node => node.name === 'surface contact velocity correction' ), false );
            d.update( 0 ); assert.equal( d.contactReport().frames, 1 ); assert.equal( renderer.calls.length, 1 );
            d.update( 1 / 60 ); assert.equal( d.contactReport().frames, 2 );
            assert.equal( renderer.calls[ 1 ].filter( node => node.name === 'surface contact coupled chain projection' ).length, 32 );
            assert.equal( renderer.calls[ 1 ].filter( node => node.name === 'surface contact velocity correction' ).length, 2 );
            assert.equal( renderer.calls[ 1 ].at( -1 ).name, 'hair card rebuild' );
            assert.equal( d.computeCallsLastFrame, 1 );
        } finally { d.dispose(); d.dispose(); }
        assert.equal( renderer.deleted.length, 35 ); assert.equal( new Set( renderer.deleted ).size, 35 );
    } );
    await check( 'failure constructing stage2 releases the first stage, shared surface and solver exactly once', async () => {
        const renderer = rendererFor(), build = createHairBodyContactFactory( { body, groomMesh: groom, selection } ); let reads = 0;
        assert.throws( () => make( renderer, context => build( { ...context, groom: new Proxy( context.groom, {
            get( target, key ) { if ( key === 'chainCount' && ++reads === 3 ) throw Error( 'stage2 construction failed' ); return Reflect.get( target, key ); }
        } ) } ) ), /stage2 construction failed/ );
        assert.equal( renderer.deleted.length, 17 ); assert.equal( new Set( renderer.deleted ).size, 17 );
        assert.equal( renderer.calls.length, 0 );
    } );
    await check( 'body getter retirement prevents stale skin history or any GPU submission', async () => {
        const renderer = rendererFor(), d = make( renderer ), original = body.getVertexPosition;
        body.getVertexPosition = function( ...args ) { d.dispose(); return original.apply( this, args ); };
        try { assert.throws( () => d.update( 0 ), /live patch|disposed/ ); }
        finally { body.getVertexPosition = original; d.dispose(); }
        assert.equal( renderer.calls.length, 0 ); assert.equal( renderer.deleted.length, 35 );
    } );
    await check( 'a contact buffer deletion error does not prevent other stages or borrowed solver cleanup', async () => {
        const renderer = rendererFor(), d = make( renderer );
        renderer._attributes.delete = attribute => { renderer.deleted.push( attribute ); if ( renderer.deleted.length === 1 ) throw Error( 'delete failure' ); };
        assert.throws( () => d.dispose(), /delete failure/ ); d.dispose();
        assert.equal( renderer.deleted.length, 35 ); assert.equal( new Set( renderer.deleted ).size, 35 );
        assert.equal( body.geometry.getAttribute( 'position' ).count, C.body.vertexCount );
        assert.equal( groom.geometry.getAttribute( 'position' ).count, C.groom.vertexCount );
    } );
    await check( 'a later nonrigid head pose retires contact before GPU submission', async () => {
        const renderer = rendererFor(), d = make( renderer ), head = groom.skeleton.bones.find( bone => bone.name === 'head' ), before = head.matrixWorld.clone();
        head.matrixWorld.makeScale( 2, 1, 1 );
        try { assert.throws( () => d.update( 0 ), /unit rigid/ ); }
        finally { head.matrixWorld.copy( before ); d.dispose(); }
        assert.equal( renderer.calls.length, 0 ); assert.equal( renderer.deleted.length, 35 );
    } );
    console.log( `${ groups } contact calibration/owner groups passed (CPU; actual motion acceptance separate)` );
} finally { for ( const resource of resources ) resource.dispose(); fs.rmSync( temp, { recursive: true, force: true } ); }
