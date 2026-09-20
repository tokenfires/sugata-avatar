/** Opt-in Avatar clothing contract and real-GLB ownership tests. CPU checks do not certify appearance. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { readGlb } from '../../../../tools/lut-bake/glb.mjs';
import { Avatar, resolveWardrobeOption, validateWardrobePlan } from '../Avatar.js';
import { Identity } from '../figure/Identity.js';
import { Figure } from '../figure/Figure.js';
import { Wardrobe } from './Wardrobe.js';
import { GarmentManifest } from './GarmentManifest.js';
import { FoundationLayer } from './FoundationLayer.js';
import { wardrobeAssetUrls, bundledWardrobeFragmentUrl, loadAvatarWardrobe } from './AvatarWardrobe.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

globalThis.self ??= globalThis;
globalThis.createImageBitmap ??= async () => ( { width: 1, height: 1, close() {} } );
const root = path.resolve( path.dirname( fileURLToPath( import.meta.url ) ), '../../../..' );
const checks = [], evidence = {};
async function check( label, body ) { await body(); checks.push( label ); console.log( `PASS ${ label }` ); }
const manifestFile = path.join( root, 'assets/wardrobe/manifest.json' );
const manifestSource = JSON.parse( fs.readFileSync( manifestFile ) );
const manifest = new GarmentManifest( manifestSource, pathToFileURL( manifestFile ).href );
async function gltf( url ) {
    const file = fs.readFileSync( new URL( url ) );
    return new GLTFLoader().parseAsync( file.buffer.slice( file.byteOffset, file.byteOffset + file.byteLength ), '' );
}
const bodyUrl = pathToFileURL( path.join( root, 'assets/wardrobe/body/g050.glb' ) ).href;
async function figure() { return new Figure( await gltf( bodyUrl ) ); }
function deferred() { let resolve, reject; const promise = new Promise( ( yes, no ) => { resolve = yes; reject = no; } ); return { promise, resolve, reject }; }
function watches( scene ) {
    const resources = new Set();
    scene.traverse( object => {
        if ( !object.isMesh ) return;
        resources.add( object.geometry ); if ( object.skeleton ) resources.add( object.skeleton );
        for ( const material of [].concat( object.material ) ) {
            resources.add( material );
            for ( const value of Object.values( material ) ) if ( value?.isTexture ) resources.add( value );
        }
    } );
    return [ ...resources ].map( resource => {
        const entry = { resource, calls: 0 }, original = resource.dispose;
        resource.dispose = function () { entry.calls++; return original.call( this ); };
        return entry;
    } );
}
await check( 'optional configuration preserves default and copies caller arrays', () => {
    assert.equal( resolveWardrobeOption(), null );
    const request = { outfit: [ 'shoes01' ], foundation: { TORSO: 'foundation_bra' } };
    const copy = resolveWardrobeOption( request ); request.outfit.push( 'fedora01' ); request.foundation.TORSO = 'bad';
    assert.deepEqual( copy, { outfit: [ 'shoes01' ], foundation: { TORSO: 'foundation_bra' } } );
    for ( const value of [ true, [], 'casual', { outfit: 'shoes01' }, { outfit: [ 3 ] }, { foundation: [] } ] ) assert.throws( () => resolveWardrobeOption( value ), /wardrobe/ );
} );
await check( 'resolved g050 accepted; unsupported bake and cross-fade rejected by name', async () => {
    for ( const gender of [ .4, .5, .6 ] ) assert.equal( validateWardrobePlan( await new Identity( { gender } ).resolve() ), 'g050' );
    for ( const gender of [ 0, .25, .75, 1 ] ) assert.throws( () => validateWardrobePlan( { figures: [ { gender } ] } ), /g050/ );
    assert.throws( () => validateWardrobePlan( { figures: [ { gender: .5 }, { gender: .75 } ] } ), /g050/ );
} );
await check( 'unsupported identity fails before changing identity, figure, or initiating a swap', async () => {
    const avatar = new Avatar( { identity: new Identity(), wardrobeRequest: { outfit: [], foundation: {} } } );
    let swaps = 0; avatar.swapFigure = async () => swaps++;
    const before = avatar.identity.toJSON();
    await assert.rejects( avatar.setIdentity( { gender: 0 } ), /g050/ );
    assert.deepEqual( avatar.identity.toJSON(), before ); assert.equal( swaps, 0 );
    await avatar.setIdentity( { gender: .6 } ); assert.equal( swaps, 1 );
} );
await check( 'manifest authority preserved with hashed mapping and external relative paths', () => {
    const mapped = new GarmentManifest( manifestSource, 'https://example.test/assets/manifest-HASH.json', { resolveFragmentUrl: bundledWardrobeFragmentUrl } );
    assert.equal( mapped.fragmentUrl( 'shoes01', 'g050' ), bundledWardrobeFragmentUrl( 'shoes01/g050.glb' ) );
    assert.throws( () => mapped.fragmentUrl( 'shoes01', 'g000' ), /no fragment/ );
    assert.throws( () => bundledWardrobeFragmentUrl( 'missing/g050.glb' ), /no bundled asset/ );
    const external = new GarmentManifest( manifestSource, 'https://example.test/prefix/wardrobe/manifest.json' );
    assert.equal( external.fragmentUrl( 'shoes01', 'g050' ), 'https://example.test/prefix/wardrobe/shoes01/g050.glb' );
    assert.equal( wardrobeAssetUrls( 'https://example.test/prefix' ).bodyUrl, 'https://example.test/prefix/wardrobe/body/g050.glb' );
    evidence.urls = wardrobeAssetUrls();
} );
await check( 'existing FoundationLayer validates defaults and all four preference combinations', async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => ( { ok: true, url: pathToFileURL( manifestFile ).href, json: async () => structuredClone( manifestSource ) } );
    try {
        const defaults = await loadAvatarWardrobe( { outfit: [], foundation: {} } );
        assert.deepEqual( new Set( defaults.foundation.currentFloor() ), new Set( [ 'foundation_vest', 'foundation_boxer_brief' ] ) );
        for ( const TORSO of [ 'foundation_bra', 'foundation_vest' ] ) for ( const HIPS of [ 'foundation_briefs', 'foundation_boxer_brief' ] ) {
            const assets = await loadAvatarWardrobe( { outfit: [ 'shoes01' ], foundation: { TORSO, HIPS } } );
            assert.deepEqual( new Set( assets.foundation.currentFloor() ), new Set( [ TORSO, HIPS ] ) );
        }
        await assert.rejects( loadAvatarWardrobe( { outfit: [], foundation: { UNKNOWN: 'foundation_vest' } } ), /floor slot/ );
        await assert.rejects( loadAvatarWardrobe( { outfit: [], foundation: { TORSO: 'shoes01' } } ), /FoundationLayer/ );
        await assert.rejects( loadAvatarWardrobe( { outfit: [], foundation: { LEGS: 'foundation_boxer_brief' } } ), /floor slot/ );
    } finally { globalThis.fetch = originalFetch; }
} );
await check( 'masked g050 preserves every baseline mesh index, attribute, morph, and bone transform', async () => {
    const plainPath = path.join( root, 'assets/figures/figure_g050.glb' );
    const plain = new Figure( await gltf( pathToFileURL( plainPath ).href ) ), masked = await figure();
    assert.equal( masked.meshes.length, plain.meshes.length );
    let attributes = 0, morphAttributes = 0;
    for ( const mesh of plain.meshes ) {
        const actual = masked.meshes.find( candidate => candidate.name === mesh.name ); assert.ok( actual );
        assert.deepEqual( actual.geometry.index.array, mesh.geometry.index.array );
        for ( const [ key, attribute ] of Object.entries( mesh.geometry.attributes ) ) { assert.deepEqual( actual.geometry.attributes[ key ].array, attribute.array ); attributes++; }
        for ( const [ key, targets ] of Object.entries( mesh.geometry.morphAttributes ) ) for ( const [ i, target ] of targets.entries() ) {
            assert.deepEqual( actual.geometry.morphAttributes[ key ][ i ].array, target.array ); morphAttributes++;
        }
        assert.deepEqual( actual.morphTargetDictionary, mesh.morphTargetDictionary );
        assert.deepEqual( actual.matrix.toArray(), mesh.matrix.toArray() );
        if ( mesh.skeleton ) {
            assert.deepEqual( actual.skeleton.bones.map( b => [ b.name, b.matrix.toArray() ] ), mesh.skeleton.bones.map( b => [ b.name, b.matrix.toArray() ] ) );
            assert.deepEqual( actual.skeleton.boneInverses.map( m => m.toArray() ), mesh.skeleton.boneInverses.map( m => m.toArray() ) );
        }
    }
    const baseGlb = readGlb( plainPath ), maskedGlb = readGlb( fileURLToPath( bodyUrl ) );
    for ( const key of [ 'nodes', 'scenes', 'materials', 'textures', 'samplers' ] ) assert.deepEqual( maskedGlb.json[ key ], baseGlb.json[ key ] );
    assert.equal( maskedGlb.json.images.length, baseGlb.json.images.length );
    const embeddedImage = ( asset, image ) => {
        const view = asset.json.bufferViews[ image.bufferView ];
        return asset.bin.subarray( view.byteOffset ?? 0, ( view.byteOffset ?? 0 ) + view.byteLength );
    };
    for ( const [ i, image ] of baseGlb.json.images.entries() ) assert.deepEqual( embeddedImage( maskedGlb, maskedGlb.json.images[ i ] ), embeddedImage( baseGlb, image ) );
    evidence.bodyEquivalence = { meshes: plain.meshes.length, attributes, morphAttributes, exact: true,
        nodeHierarchyAndMaterialsExact: true, embeddedImagesExact: baseGlb.json.images.length,
        baseSha256: createHash( 'sha256' ).update( fs.readFileSync( plainPath ) ).digest( 'hex' ),
        maskedSha256: createHash( 'sha256' ).update( fs.readFileSync( new URL( bodyUrl ) ) ).digest( 'hex' ) };
    plain.dispose(); masked.dispose();
} );
await check( 'latest outfit wins with a slower older load (optional old-source comparison)', async () => {
    async function race( Class ) {
        const f = await figure(), delayed = deferred();
        const w = new Class( f, manifest, { loadFragment: async url => { if ( url.includes( 'female_casualsuit01' ) ) await delayed.promise; return gltf( url ); } } );
        const older = w.dress( [ 'female_casualsuit01' ] );
        await w.dress( [ 'shoes01' ] ); delayed.resolve(); await older;
        const worn = w.stats().worn; w.dispose?.(); f.dispose(); return worn;
    }
    assert.deepEqual( await race( Wardrobe ), [ 'shoes01' ] );
    const oldArg = process.argv.indexOf( '--old-source' );
    if ( oldArg >= 0 ) {
        let source = fs.readFileSync( process.argv[ oldArg + 1 ], 'utf8' );
        source = source.replaceAll( "from 'three'", `from '${ import.meta.resolve( 'three' ) }'` )
            .replaceAll( "from 'three/examples/jsm/loaders/GLTFLoader.js'", `from '${ import.meta.resolve( 'three/examples/jsm/loaders/GLTFLoader.js' ) }'` );
        const Old = ( await import( `data:text/javascript;base64,${ Buffer.from( source ).toString( 'base64' ) }` ) ).Wardrobe;
        evidence.oldSourceRace = await race( Old ); assert.notDeepEqual( evidence.oldSourceRace, [ 'shoes01' ] );
    }
} );
await check( 'overlapping same-fragment requests share one load and apply only once', async () => {
    const f = await figure(), delayed = deferred(); let loads = 0;
    const w = new Wardrobe( f, manifest, { loadFragment: async url => { loads++; await delayed.promise; return gltf( url ); } } );
    const first = w.dress( [ 'shoes01' ] ), second = w.dress( [ 'shoes01' ] );
    assert.equal( loads, 1 ); delayed.resolve(); await Promise.all( [ first, second ] );
    assert.equal( w.wornMeshes.size, 1 ); w.dispose(); f.dispose();
} );
await check( 'bad outfit and fragment failure preserve current foundation and clothing', async () => {
    const f = await figure(), foundation = new FoundationLayer( manifest );
    const w = new Wardrobe( f, manifest, { decencyFloor: foundation.floor, loadFragment: async url => {
        if ( url.includes( 'female_elegantsuit01' ) ) throw new Error( 'controlled unavailable garment' ); return gltf( url );
    } } );
    await w.dress( [ 'female_casualsuit01', 'shoes01' ] ); const before = w.stats().worn;
    await assert.rejects( w.dress( [ 'female_casualsuit01', 'female_elegantsuit01' ] ), /cannot be worn/ );
    await assert.rejects( w.dress( [ 'female_elegantsuit01' ] ), /controlled unavailable/ );
    assert.deepEqual( w.stats().worn, before ); assert.equal( w.body.visible, true );
    await w.undress(); assert.deepEqual( w.stats().worn, foundation.currentFloor() ); w.dispose(); f.dispose();
} );
await check( 'loaded fragments reserved by an in-flight outfit cannot be released before atomic apply', async () => {
    const f = await figure(), delayed = deferred(); let began; const started = new Promise( resolve => began = resolve );
    const w = new Wardrobe( f, manifest, { loadFragment: async url => { if ( url.includes( 'shoes01' ) ) { began(); await delayed.promise; } return gltf( url ); } } );
    const pending = w.dress( [ 'female_casualsuit01', 'shoes01' ] ); await started;
    assert.throws( () => w.release( 'female_casualsuit01' ), /still loading/ );
    delayed.resolve(); await pending; assert.equal( w.stats().worn.length, 2 ); w.dispose(); f.dispose();
} );
await check( 'active and cached resources disposed once; borrowed body/skeleton retained', async () => {
    const f = await figure(), bodyResources = watches( f.root ), imported = [];
    const w = new Wardrobe( f, manifest, { loadFragment: async url => { const loaded = await gltf( url ); imported.push( ...watches( loaded.scene ) ); return loaded; } } );
    await w.dress( [ 'female_casualsuit01', 'shoes01' ] ); await w.dress( [ 'female_elegantsuit01', 'shoes01' ] );
    assert.equal( w.stats().residentFragments, 3 ); w.release( 'female_casualsuit01' ); w.dispose(); w.dispose();
    assert.ok( imported.every( entry => entry.calls === 1 ) ); assert.ok( bodyResources.every( entry => entry.calls === 0 ) );
    assert.equal( w.stats().residentFragments, 0 ); assert.equal( w.wornMeshes.size, 0 );
    await assert.rejects( w.dress( [] ), /disposed/ ); assert.throws( () => w.release( 'shoes01' ), /disposed/ );
    evidence.disposedImportedResources = imported.length; f.dispose();
} );
await check( 'disposal during fragment fetch frees late resources without attaching or revealing body', async () => {
    const f = await figure(), delayed = deferred(), foundation = new FoundationLayer( manifest ); let imported;
    const w = new Wardrobe( f, manifest, { decencyFloor: foundation.floor, loadFragment: async url => {
        const loaded = await gltf( url ); imported = watches( loaded.scene ); await delayed.promise; return loaded;
    } } );
    const pending = w.dress( [] ); const rejected = assert.rejects( pending, /disposed/ );
    while ( !imported ) await new Promise( resolve => setImmediate( resolve ) );
    w.dispose(); w.dispose(); delayed.resolve(); await rejected;
    assert.ok( imported.every( entry => entry.calls === 1 ) ); assert.equal( w.stats().pendingFragments, 0 );
    assert.equal( w.body.visible, false ); assert.equal( w.wornMeshes.size, 0 ); f.dispose();
} );
await check( 'malformed fragment adoption frees loaded resources and preserves the active outfit', async () => {
    const f = await figure(); let imported;
    const w = new Wardrobe( f, manifest, { loadFragment: async url => {
        const loaded = await gltf( url ); if ( url.includes( 'female_elegantsuit01' ) ) {
            imported = watches( loaded.scene ); loaded.scene.traverse( mesh => { if ( mesh.isSkinnedMesh ) mesh.skeleton.bones[ 0 ].name = 'invalid_joint'; } );
        } return loaded;
    } } );
    await w.dress( [ 'shoes01' ] ); await assert.rejects( w.dress( [ 'female_elegantsuit01' ] ), /joint|bone/ );
    assert.deepEqual( w.stats().worn, [ 'shoes01' ] ); assert.ok( imported.every( entry => entry.calls === 1 ) ); w.dispose(); f.dispose();
} );
console.log( JSON.stringify( { passed: checks.length, checks, evidence, limitations: 'CPU ownership/geometry/API checks. No GPU timing or visual clothing fit certification.' }, null, 2 ) );
