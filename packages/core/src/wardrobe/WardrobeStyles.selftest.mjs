/** Real GLBs and native material disposal events; CPU evidence does not certify rendering. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshStandardNodeMaterial } from 'three/webgpu';
import { Figure } from '../figure/Figure.js';
import { Wardrobe } from './Wardrobe.js';
import { GarmentManifest } from './GarmentManifest.js';
import { FoundationLayer } from './FoundationLayer.js';
import { createWardrobeStyle, validateStyledFragmentBytes } from './WardrobeStyles.js';
import { resolveWardrobeOption } from '../Avatar.js';

const root = fileURLToPath( new URL( '../../../../', import.meta.url ) );
const manifestUrl = pathToFileURL( root + 'assets/wardrobe/manifest.json' ).href;
const manifest = new GarmentManifest( JSON.parse( fs.readFileSync( new URL( manifestUrl ) ) ), manifestUrl );
globalThis.self ??= globalThis;
globalThis.createImageBitmap ??= async () => ( { width: 1, height: 1, close() {} } );
globalThis.ProgressEvent ??= class { constructor( type, values ) { Object.assign( this, { type }, values ); } };
const nativeFetch = globalThis.fetch;
globalThis.fetch = async input => {
    const url = input instanceof Request ? input.url : String( input );
    return url.startsWith( 'file:' ) ? new Response( fs.readFileSync( new URL( url ) ) ) : nativeFetch( input );
};
const checks = [];
async function check( name, run ) { await run(); checks.push( name ); console.log( 'PASS ' + name ); }
async function figure() {
    const bytes = fs.readFileSync( root + 'assets/wardrobe/body/g050.glb' );
    return new Figure( await new GLTFLoader().parseAsync( bytes.buffer.slice( bytes.byteOffset, bytes.byteOffset + bytes.byteLength ), '' ) );
}
function watches( scene ) {
    const resources = new Set();
    scene.traverse( mesh => {
        if ( !mesh.isMesh ) return;
        resources.add( mesh.geometry ); if ( mesh.skeleton ) resources.add( mesh.skeleton );
        for ( const material of [].concat( mesh.material ) ) {
            resources.add( material );
            for ( const v of Object.values( material ) ) if ( v?.isTexture ) resources.add( v );
        }
    } );
    return [ ...resources ].map( resource => {
        const r = { resource, calls: 0 }, dispose = resource.dispose;
        resource.dispose = function () { r.calls++; return dispose.call( this ); }; return r;
    } );
}
function owner( f, style, alter = null ) {
    const options = createWardrobeStyle( style ), imported = [], replacements = [];
    const w = new Wardrobe( f, manifest, { ...options, decencyFloor: new FoundationLayer( manifest, {
        preference: { TORSO: 'foundation_bra', HIPS: 'foundation_briefs' }
    } ).floor,
    loadFragment: async ( url, id ) => {
        const gltf = await options.loadFragment( url, id ); imported.push( ...watches( gltf.scene ) );
        await alter?.( gltf, id ); return gltf;
    },
    createMaterial: ( id, mesh ) => {
        const material = options.createMaterial( id, mesh );
        if ( material ) { const r = { id, material, calls: 0 }; material.addEventListener( 'dispose', () => r.calls++ ); replacements.push( r ); }
        return material;
    } } );
    return { w, imported, replacements };
}
try {
    await check( 'finite styles copy into Avatar options while original keeps the prior configuration shape', () => {
        for ( const style of [ 'ecru', 'charcoal' ] ) assert.equal( resolveWardrobeOption( { style } ).style, style );
        assert.deepEqual( resolveWardrobeOption( { style: 'original' } ), { outfit: [], foundation: {} } );
        for ( const style of [ null, '', 'blue', {}, [ 'ecru' ] ] ) assert.throws( () => resolveWardrobeOption( { style } ), /wardrobe.style/ );
    } );
    await check( 'all three reviewed byte streams pass; one-byte changes fail before GLTF parsing', async () => {
        for ( const id of [ 'female_casualsuit01', 'female_elegantsuit01', 'shoes01' ] ) {
            const bytes = fs.readFileSync( new URL( manifest.fragmentUrl( id, 'g050' ) ) );
            await validateStyledFragmentBytes( id, bytes ); const altered = Buffer.from( bytes ); altered[ altered.length - 1 ] ^= 1;
            await assert.rejects( validateStyledFragmentBytes( id, altered ), /qualified g050/ );
        }
    } );
    await check( 'same geometry and body/foundation indices under both palettes, unchanged cache identities across outfits', async () => {
        const states = [];
        for ( const style of [ 'ecru', 'charcoal' ] ) {
            const f = await figure(), borrowed = watches( f.root ), { w, imported, replacements } = owner( f, style );
            await w.dress( [ 'female_casualsuit01', 'shoes01' ] );
            assert.deepEqual( w.appearance(), { style, attached: true } );
            assert.throws( () => { w.materialStyle = 'original'; }, /read only/ );
            const snapshot = () => Object.fromEntries( [ [ 'body', f.body ], ...w.wornMeshes ].map( ( [ id, mesh ] ) => [ id, {
                indices: Array.from( mesh.geometry.index.array.slice( 0, mesh.geometry.drawRange.count ) ),
                attributes: Object.fromEntries( Object.entries( mesh.geometry.attributes ).map( ( [ key, attr ] ) => [ key, Array.from( attr.array ) ] ) )
            } ] ) );
            states.push( snapshot() );
            const casual = w.wornMeshes.get( 'female_casualsuit01' ).material, shoes = w.wornMeshes.get( 'shoes01' ).material;
            assert.equal( casual.map.anisotropy, 8 ); assert.equal( casual.normalMap.anisotropy, 8 );
            const attached = w.wornMeshes.get( 'shoes01' ); attached.material = casual; assert.equal( w.appearance().attached, false ); attached.material = shoes;
            await w.dress( [ 'female_elegantsuit01', 'shoes01' ] ); assert.equal( w.wornMeshes.get( 'shoes01' ).material, shoes );
            await w.dress( [ 'female_casualsuit01', 'shoes01' ] ); assert.equal( w.wornMeshes.get( 'female_casualsuit01' ).material, casual );
            await w.dress( [ 'female_elegantsuit01', 'shoes01' ] ); w.release( 'female_casualsuit01' );
            assert.equal( replacements.find( r => r.material === casual ).calls, 1 );
            await w.dress( [ 'female_casualsuit01', 'shoes01' ] ); assert.notEqual( w.wornMeshes.get( 'female_casualsuit01' ).material, casual );
            w.dispose(); w.dispose(); assert.ok( imported.every( r => r.calls === 1 ) ); assert.ok( replacements.every( r => r.calls === 1 ) );
            assert.ok( borrowed.every( r => r.calls === 0 ) ); assert.equal( w.appearance().attached, false ); f.dispose();
        }
        assert.deepEqual( states[ 0 ], states[ 1 ] );
    } );
    await check( 'adoption failure after style creation frees both materials and preserves the existing outfit', async () => {
        const f = await figure(), { w, imported, replacements } = owner( f, 'ecru', ( gltf, id ) => {
            if ( id === 'female_elegantsuit01' ) gltf.scene.traverse( m => { if ( m.isSkinnedMesh ) m.skeleton.bones[ 0 ].name = 'invalid'; } );
        } );
        await w.dress( [ 'female_casualsuit01', 'shoes01' ] ); const before = w.stats().worn;
        await assert.rejects( w.dress( [ 'female_elegantsuit01', 'shoes01' ] ), /joint|bone/ );
        assert.deepEqual( w.stats().worn, before ); assert.equal( w.appearance().attached, true );
        assert.equal( replacements.find( r => r.id === 'female_elegantsuit01' ).calls, 1 );
        w.dispose(); assert.ok( imported.every( r => r.calls === 1 ) ); assert.ok( replacements.every( r => r.calls === 1 ) ); f.dispose();
    } );
    await check( 'late verified loads after disposal retire without creating or attaching a replacement', async () => {
        let release, arrived; const wait = new Promise( r => { release = r; } ), ready = new Promise( r => { arrived = r; } );
        const f = await figure(), { w, imported, replacements } = owner( f, 'charcoal', async () => { arrived(); await wait; } );
        const pending = w.dress( [ 'female_casualsuit01' ] ), rejected = assert.rejects( pending, /disposed/ );
        await ready; w.dispose(); release(); await rejected;
        assert.equal( replacements.length, 0 ); assert.ok( imported.every( r => r.calls === 1 ) ); assert.equal( w.wornMeshes.size, 0 ); f.dispose();
    } );
    await check( 'factory construction failure disposes its unreturned material and rejects unverified meshes', async () => {
        const style = createWardrobeStyle( 'ecru' );
        assert.throws( () => style.createMaterial( 'shoes01', {} ), /unverified/ );
        const gltf = await style.loadFragment( manifest.fragmentUrl( 'shoes01', 'g050' ), 'shoes01' );
        let mesh; gltf.scene.traverse( m => { if ( m.isSkinnedMesh ) mesh = m; } );
        const originalScale = mesh.material.normalScale; mesh.material.normalScale = { get x() { throw new Error( 'controlled construction failure' ); } };
        let disposed = 0; const originalDispose = MeshStandardNodeMaterial.prototype.dispose;
        MeshStandardNodeMaterial.prototype.dispose = function () { disposed++; return originalDispose.call( this ); };
        try { assert.throws( () => style.createMaterial( 'shoes01', mesh ), /controlled construction failure/ ); assert.equal( disposed, 1 ); }
        finally { MeshStandardNodeMaterial.prototype.dispose = originalDispose; mesh.material.normalScale = originalScale; }
        for ( const r of watches( gltf.scene ) ) r.resource.dispose();
    } );
} finally { globalThis.fetch = nativeFetch; }
console.log( JSON.stringify( { passed: checks.length, checks, limits: 'CPU API/geometry and no-throw resource retirement only. Rendering and arbitrary throwing dispose listeners are separate.' }, null, 2 ) );
