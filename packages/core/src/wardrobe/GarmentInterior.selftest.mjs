/** CPU ownership, skinning and mask regression tests; no appearance claim or GPU initialization. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { Bone, BufferAttribute, BufferGeometry, DoubleSide, FrontSide, BackSide, Matrix4,
    MeshStandardMaterial, Scene, Skeleton, SkinnedMesh, Texture, Vector3, DetachedBindMode } from 'three';
import { MeshStandardNodeMaterial } from 'three/webgpu';
import { vertexIndex, float, vec3 } from 'three/tsl';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { GarmentManifest } from './GarmentManifest.js';
import { createGarmentInterior } from './GarmentInterior.js';

globalThis.self ??= globalThis;
globalThis.createImageBitmap ??= async () => ( { width: 1, height: 1, close() {} } );
const root = path.resolve( path.dirname( fileURLToPath( import.meta.url ) ), '../../../..' );
const args = process.argv.slice( 2 );
const value = name => args.includes( name ) ? args[ args.indexOf( name ) + 1 ] : null;
const wardrobeModule = value( '--wardrobe-module' );
const { Wardrobe } = await import( wardrobeModule ? pathToFileURL( path.resolve( wardrobeModule ) ).href : './Wardrobe.js' );
const candidate = value( '--candidate' );
const candidateSha = value( '--candidate-sha' );
const checks = [];
async function check( label, body ) { await body(); checks.push( label ); console.log( `PASS ${ label }` ); }
function spy( resource ) {
    const record = { calls: 0 }, original = resource.dispose;
    resource.dispose = function ( ...args ) { record.calls++; return original.apply( this, args ); };
    return record;
}
function fixture() {
    const geometry = new BufferGeometry();
    geometry.setAttribute( 'position', new BufferAttribute( new Float32Array( [ 0, 0, 0, 1, 0, 0, 0, 1, 0, 1, 1, 0 ] ), 3 ) );
    geometry.setAttribute( 'normal', new BufferAttribute( new Float32Array( [ 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1 ] ), 3 ) );
    geometry.setAttribute( 'uv', new BufferAttribute( new Float32Array( [ 0, 0, 1, 0, 0, 1, 1, 1 ] ), 2 ) );
    geometry.setAttribute( 'skinIndex', new BufferAttribute( new Uint16Array( [ 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0 ] ), 4 ) );
    geometry.setAttribute( 'skinWeight', new BufferAttribute( new Float32Array( [ 1, 0, 0, 0, .7, .3, 0, 0, .4, .6, 0, 0, 0, 1, 0, 0 ] ), 4 ) );
    geometry.setIndex( [ 0, 1, 2, 2, 1, 3 ] );
    const texture = new Texture(), material = new MeshStandardMaterial( { map: texture } );
    material.shadowSide = DoubleSide;
    const mesh = new SkinnedMesh( geometry, material ), bones = [ new Bone(), new Bone() ];
    bones[ 0 ].name = 'root'; bones[ 1 ].name = 'neck'; bones[ 0 ].add( bones[ 1 ] );
    mesh.bind( new Skeleton( bones, [ new Matrix4(), new Matrix4() ] ), new Matrix4() );
    mesh.receiveShadow = true;
    mesh.userData.sugataInterior = { version: 1, kind: 'collar-band', sourceVertexCount: 4, sourceTriangleCount: 2, triangles: [ 0, 1 ] };
    const resources = { geometries: new Set( [ geometry ] ), materials: new Set( [ material ] ) };
    return { mesh, bones, texture, resources, fullIndex: geometry.index.array.slice() };
}
const install = f => createGarmentInterior( f.mesh, { fullIndex: f.fullIndex, resources: f.resources } );
function retire( f ) { f.mesh.geometry.dispose(); f.mesh.material.dispose(); f.texture.dispose(); f.mesh.skeleton.dispose(); }
function loadedResources( scene ) {
    const set = new Set();
    scene.traverse( object => {
        if ( !object.isMesh ) return;
        set.add( object.geometry ); if ( object.skeleton ) set.add( object.skeleton );
        for ( const material of [].concat( object.material ) ) {
            set.add( material ); for ( const v of Object.values( material ) ) if ( v?.isTexture ) set.add( v );
        }
    } );
    return [ ...set ].map( resource => ( { resource, ...spyReference( resource ) } ) );
}
function spyReference( resource ) { const state = spy( resource ); return { state }; }
async function gltf( file ) {
    const bytes = fs.readFileSync( file );
    return new GLTFLoader().parseAsync( bytes.buffer.slice( bytes.byteOffset, bytes.byteOffset + bytes.byteLength ), '' );
}
function firstMesh( loaded ) { let result; loaded.scene.traverse( m => { if ( m.isSkinnedMesh && !result ) result = m; } ); return result; }
const id = 'female_casualsuit01';
const manifestFile = path.join( root, 'assets/wardrobe/manifest.json' );
const manifest = new GarmentManifest( JSON.parse( fs.readFileSync( manifestFile ) ), pathToFileURL( manifestFile ).href );
const garmentFile = candidate ? path.resolve( candidate ) : path.join( root, `assets/wardrobe/${ id }/g050.glb` );
if ( candidate ) {
    assert.match( candidateSha ?? '', /^[0-9a-f]{64}$/, 'A candidate requires its exact expected SHA-256.' );
    assert.equal( createHash( 'sha256' ).update( fs.readFileSync( garmentFile ) ).digest( 'hex' ), candidateSha );
}
async function setupWardrobe( { alter = null, maskByShoes = false } = {} ) {
    const bodyGltf = await gltf( path.join( root, 'assets/wardrobe/body/g050.glb' ) ), body = firstMesh( bodyGltf );
    const imported = [], bodySkeleton = spy( body.skeleton );
    const wardrobe = new Wardrobe( { body, skeleton: body.skeleton }, manifest, {
        loadFragment: async ( url, garmentId ) => {
            const loaded = await gltf( garmentId === id ? garmentFile : fileURLToPath( url ) );
            imported.push( ...loadedResources( loaded.scene ) );
            if ( garmentId === id ) {
                const mesh = firstMesh( loaded );
                if ( !mesh.userData.sugataInterior ) {
                    assert.equal( !!candidate, false, 'Qualified candidate metadata was not loaded onto its skinned mesh.' );
                    mesh.userData.sugataInterior = { version: 1, kind: 'collar-band', sourceVertexCount: mesh.geometry.attributes.position.count,
                        sourceTriangleCount: mesh.geometry.index.count / 3, triangles: [ 0, 1 ] };
                }
                if ( maskByShoes ) {
                    const hidden = new Float32Array( mesh.geometry.attributes.position.count );
                    for ( const triangle of mesh.userData.sugataInterior.triangles ) hidden[ mesh.geometry.index.array[ triangle * 3 ] ] = 1;
                    mesh.geometry.setAttribute( '_UNDER_SHOES01', new BufferAttribute( hidden, 1 ) );
                }
                alter?.( mesh );
            }
            return loaded;
        }
    } );
    return { wardrobe, bodyGltf, bodySkeleton, imported };
}

await check( 'absent metadata leaves an ordinary garment untouched', () => {
    const f = fixture(); delete f.mesh.userData.sugataInterior;
    assert.equal( createGarmentInterior( f.mesh ), null ); assert.equal( f.mesh.children.length, 0 );
    assert.equal( f.resources.geometries.size, 1 ); assert.equal( f.resources.materials.size, 1 ); retire( f );
} );
await check( 'malformed metadata and source selections fail before allocating', () => {
    const definitions = [ null, [], {}, { version: 2 }, { kind: 'other' }, { sourceVertexCount: 3 }, { sourceTriangleCount: 3 },
        { triangles: [] }, { triangles: [ 0, 0 ] }, { triangles: [ -1 ] }, { triangles: [ 2 ] },
        { triangles: [ .5 ] }, { triangles: [ '0' ] }, { triangles: [ NaN ] }, { extra: true } ];
    for ( const change of definitions ) {
        const f = fixture(); let allocations = 0; const clone = f.mesh.geometry.clone;
        f.mesh.geometry.clone = function () { allocations++; return clone.call( this ); };
        f.mesh.userData.sugataInterior = change === null || Array.isArray( change ) ? change : { ...f.mesh.userData.sugataInterior, ...change };
        if ( change && !Array.isArray( change ) && !Object.keys( change ).length ) f.mesh.userData.sugataInterior = {};
        assert.throws( () => install( f ), /Garment interior:/ );
        assert.equal( allocations, 0 ); assert.equal( f.mesh.children.length, 0 ); retire( f );
    }
    const f = fixture(); f.fullIndex[ 0 ] = 99; assert.throws( () => install( f ), /invalid vertex/ ); retire( f );
} );
await check( 'unsupported material, binding and deformation modes fail closed', () => {
    for ( const alter of [ f => { f.mesh.material.side = DoubleSide; }, f => { f.mesh.material.side = BackSide; },
        f => { f.mesh.material.transparent = true; }, f => { f.mesh.material.opacity = .5; },
        f => { f.mesh.material.alphaTest = .1; }, f => { f.mesh.material.alphaHash = true; },
        f => { f.mesh.bindMode = DetachedBindMode; }, f => { f.mesh.morphTargetInfluences = [ .2 ]; } ] ) {
        const f = fixture(); alter( f ); assert.throws( () => install( f ), /Garment interior:/ );
        assert.equal( f.resources.geometries.size, 1 ); retire( f );
    }
    const f = fixture(), material = f.mesh.material; f.mesh.material = [ material ];
    assert.throws( () => install( f ), /one opaque/ ); f.mesh.material = material; retire( f );
} );
await check( 'raw vertex IDs, attributes, inward side and borrowed resources survive installation', () => {
    const f = fixture(), before = f.fullIndex.slice(), owner = install( f );
    assert.equal( owner.mesh.skeleton, f.mesh.skeleton ); assert.equal( owner.mesh.material.map, f.texture );
    assert.equal( owner.mesh.material.side, BackSide ); assert.equal( f.mesh.material.side, FrontSide );
    assert.equal( owner.mesh.castShadow, false ); assert.equal( owner.mesh.receiveShadow, true );
    assert.equal( f.mesh.material.shadowSide, DoubleSide );
    for ( const [ name, a ] of Object.entries( f.mesh.geometry.attributes ) ) {
        const b = owner.mesh.geometry.attributes[ name ]; assert.notEqual( a, b ); assert.deepEqual( a.array, b.array );
    }
    assert.deepEqual( f.mesh.geometry.index.array, before );
    assert.equal( f.resources.geometries.has( owner.mesh.geometry ), true ); assert.equal( f.resources.materials.has( owner.mesh.material ), true );
    assert.throws( () => install( f ), /already installed/ );
    owner.dispose(); retire( f );
} );
await check( 'skinned world positions agree after hierarchy, mesh and bone transformations', () => {
    const f = fixture(), scene = new Scene(), owner = install( f ), a = new Vector3(), b = new Vector3();
    scene.add( f.mesh, f.bones[ 0 ] );
    for ( let i = 0; i < 6; i++ ) {
        scene.position.set( .1 * i, -.2 * i, .05 * i ); scene.rotation.set( .02 * i, -.1 * i, .03 * i ); scene.scale.set( 1 + i * .05, 1, 1 - i * .02 );
        f.mesh.position.set( .03 * i, .01 * i, -.02 * i ); f.mesh.rotation.y = .12 * i;
        f.bones[ 1 ].rotation.z = .15 * i; scene.updateMatrixWorld( true ); f.mesh.skeleton.update();
        for ( let v = 0; v < 4; v++ ) {
            f.mesh.getVertexPosition( v, a ).applyMatrix4( f.mesh.matrixWorld );
            owner.mesh.getVertexPosition( v, b ).applyMatrix4( owner.mesh.matrixWorld ); assert.ok( a.distanceTo( b ) <= 1e-12 );
        }
    }
    owner.dispose(); retire( f );
} );
await check( 'the exact any-corner mask removes interior triangles and restores original ordered corners', () => {
    const f = fixture(), owner = install( f ), hidden = new Uint8Array( 4 );
    hidden[ 0 ] = 1; assert.equal( owner.syncMask( hidden ), 1 );
    assert.deepEqual( Array.from( owner.mesh.geometry.index.array.slice( 0, 3 ) ), [ 2, 1, 3 ] );
    hidden[ 1 ] = 1; assert.equal( owner.syncMask( hidden ), 0 ); assert.equal( owner.drawCalls, 0 ); assert.equal( owner.mesh.visible, false );
    assert.equal( owner.syncMask( null ), 2 ); assert.equal( owner.drawCalls, 1 ); assert.equal( owner.mesh.visible, true );
    assert.deepEqual( Array.from( owner.mesh.geometry.index.array ), [ 0, 1, 2, 2, 1, 3 ] );
    f.mesh.userData.sugataInterior.sourceVertexCount = 9; f.mesh.userData.sugataInterior.triangles.length = 0;
    assert.equal( owner.syncMask( new Uint8Array( 4 ) ), 2, 'Installed selection must not alias mutable metadata.' );
    assert.throws( () => owner.syncMask( new Uint8Array( 3 ) ), /hidden-vertex/ );
    assert.throws( () => owner.syncMask( new Uint8Array( [ 2, 0, 0, 0 ] ) ), /hidden-vertex/ );
    owner.dispose(); assert.throws( () => owner.syncMask( null ), /disposed/ ); retire( f );
} );
await check( 'material cloning preserves node graphs used by vertex-index colour recipes', () => {
    const f = fixture(), original = f.mesh.material; f.mesh.material = new MeshStandardNodeMaterial();
    f.mesh.material.colorNode = vertexIndex.greaterThanEqual( 1427 ).select( vec3( 1, 0, 0 ), vec3( 0, 1, 0 ) );
    f.mesh.material.roughnessNode = float( .9 ); f.mesh.material.map = f.texture;
    const owner = install( f ); assert.equal( owner.mesh.material.colorNode, f.mesh.material.colorNode );
    assert.equal( owner.mesh.material.roughnessNode, f.mesh.material.roughnessNode ); owner.dispose(); original.dispose(); retire( f );
} );
await check( 'failed allocation, attachment and registration retire only newly owned resources', () => {
    for ( const stage of [ 'material-clone', 'attachment', 'registration' ] ) {
        const f = fixture(), allocated = [], cloned = f.mesh.geometry.clone;
        f.mesh.geometry.clone = function () { const value = cloned.call( this ); allocated.push( spy( value ) ); return value; };
        const materialClone = f.mesh.material.clone;
        f.mesh.material.clone = function () {
            if ( stage === 'material-clone' ) throw new Error( 'injected failure' );
            const value = materialClone.call( this ); allocated.push( spy( value ) ); return value;
        };
        const add = f.mesh.add;
        if ( stage === 'attachment' ) f.mesh.add = function ( child ) { add.call( this, child ); throw new Error( 'injected failure' ); };
        if ( stage === 'registration' ) f.resources.materials.add = () => { throw new Error( 'injected failure' ); };
        const borrowed = [ spy( f.mesh.geometry ), spy( f.mesh.material ), spy( f.texture ), spy( f.mesh.skeleton ) ];
        assert.throws( () => install( f ), /injected failure/ );
        assert.ok( allocated.every( r => r.calls === 1 ) ); assert.ok( borrowed.every( r => r.calls === 0 ) );
        assert.equal( f.mesh.children.length, 0 ); assert.equal( f.resources.geometries.size, 1 ); assert.equal( f.resources.materials.size, 1 );
        retire( f );
    }
} );
await check( 'explicit disposal is idempotent and never frees borrowed textures or body skeleton', () => {
    const f = fixture(), owner = install( f ), geometry = spy( owner.mesh.geometry ), material = spy( owner.mesh.material );
    const borrowed = [ spy( f.mesh.geometry ), spy( f.mesh.material ), spy( f.texture ), spy( f.mesh.skeleton ) ];
    owner.dispose(); owner.dispose(); assert.equal( geometry.calls, 1 ); assert.equal( material.calls, 1 );
    assert.ok( borrowed.every( r => r.calls === 0 ) ); assert.equal( f.mesh.children.length, 0 );
    assert.equal( f.resources.geometries.size, 1 ); assert.equal( f.resources.materials.size, 1 );
    assert.equal( owner.drawnTriangles, 0 ); assert.equal( owner.drawCalls, 0 ); retire( f );
} );
await check( 'real GLB adoption, undress/redress, release and statistics own the interior', async () => {
    const { wardrobe: w, imported, bodySkeleton } = await setupWardrobe(); await w.dress( [ id ] );
    const fragment = w.fragments.get( id ), interior = fragment.interior;
    assert.ok( interior, 'Wardrobe integration is missing; test the deferred patch with --wardrobe-module.' );
    if ( candidate ) assert.equal( interior.fullTriangles, 140 );
    assert.equal( w.stats().garmentTriangles, fragment.drawnTriangles + interior.fullTriangles ); assert.equal( w.stats().drawCalls, 3 );
    const geometry = spy( interior.mesh.geometry ), material = spy( interior.mesh.material );
    await w.undress(); assert.equal( fragment.mesh.parent, null ); assert.equal( w.stats().drawCalls, 1 );
    await w.dress( [ id ] ); assert.equal( w.fragments.get( id ).interior, interior ); assert.equal( fragment.mesh.children.filter( o => o === interior.mesh ).length, 1 );
    await w.undress(); w.release( id ); assert.equal( geometry.calls, 1 ); assert.equal( material.calls, 1 ); assert.equal( interior.mesh.parent, null );
    assert.ok( imported.every( r => r.state.calls === 1 ) ); assert.equal( bodySkeleton.calls, 0 ); w.dispose();
} );
await check( 'runtime outer masking hides the selected inside faces and removes their draw cost', async () => {
    const { wardrobe: w, bodySkeleton } = await setupWardrobe( { maskByShoes: true } ); await w.dress( [ id ] );
    const fragment = w.fragments.get( id ), interior = fragment.interior, count = interior.fullTriangles;
    assert.equal( interior.drawnTriangles, count ); await w.dress( [ id, 'shoes01' ] );
    assert.equal( interior.drawnTriangles, 0 ); assert.equal( interior.mesh.visible, false ); assert.equal( w.stats().drawCalls, 3 );
    await w.dress( [ id ] ); assert.equal( interior.drawnTriangles, count ); assert.equal( interior.mesh.visible, true );
    const geometry = spy( interior.mesh.geometry ), material = spy( interior.mesh.material );
    w.dispose(); w.dispose(); assert.equal( geometry.calls, 1 ); assert.equal( material.calls, 1 ); assert.equal( bodySkeleton.calls, 0 );
} );
await check( 'failed adoption retires every loaded resource and preserves the borrowed body', async () => {
    const { wardrobe: w, imported, bodySkeleton } = await setupWardrobe( { alter: mesh => { mesh.userData.sugataInterior.triangles = [ -1 ]; } } );
    await assert.rejects( w.dress( [ id ] ), /selected triangles/ ); assert.equal( w.fragments.size, 0 ); assert.equal( w.wornMeshes.size, 0 );
    assert.ok( imported.length > 0 && imported.every( r => r.state.calls === 1 ) ); assert.equal( bodySkeleton.calls, 0 ); w.dispose();
} );
console.log( `${ checks.length } garment interior groups passed. CPU only; no appearance claim.` );
