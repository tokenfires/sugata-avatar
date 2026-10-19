import assert from 'node:assert/strict';
import { readFileSync, realpathSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { performance } from 'node:perf_hooks';

const leaf = new URL( './', import.meta.url );
const digest = bytes => createHash( 'sha256' ).update( bytes ).digest( 'hex' );
const admissionBytes = readFileSync( new URL( 'PROOF-ADMISSION.json', leaf ) );
assert.equal( digest( admissionBytes ), process.env.SUGATA_SKIN_ADMISSION_SHA256 );
const admission = JSON.parse( admissionBytes );
assert.equal( admission.schema, 'completed-skin-owner-one-cpu-admission-v1' );
assert.equal( realpathSync( process.execPath ), admission.executableRealPath );
assert.ok( Date.now() >= Date.parse( admission.createdUtc ) );
assert.ok( Date.now() < Date.parse( admission.expiresUtc ) );
for ( const pin of admission.pins ) {

    const bytes = readFileSync( pin.path );
    assert.equal( bytes.length, pin.bytes, pin.path );
    assert.equal( digest( bytes ), pin.sha256, pin.path );

}

const started = performance.now();
const timer = setTimeout( () => {

    process.stderr.write( 'Skin owner proof cooperative body timer expired.\n' );
    process.exit( 124 );

}, 30_000 );
const reports = [];
const trace = [];
const loaded = [];
let factoryCalls = 0;
let epoch = '';
let borrowed;
let loaderPrototype;
let texturePrototype;
let originalLoad;
let originalDispose;

try {

    const three = await import( 'three/webgpu' );
    const baseline = await import( '../../../../packages/core/src/material/SkinMaterial.js' );
    const candidate = await import( '../../../../packages/core/src/material/SkinMaterial.owner-candidate.js' );
    const { Texture, TextureLoader } = three;
    loaderPrototype = TextureLoader.prototype;
    texturePrototype = Texture.prototype;
    originalLoad = loaderPrototype.load;
    originalDispose = texturePrototype.dispose;
    borrowed = new Texture();
    borrowed.name = 'borrowed-albedo';
    borrowed.image = { width: 4, height: 4 };
    const permittedUrls = new Set( [ 'fixture-curvature.png', 'fixture-region.png', 'fixture-cavity.png' ] );
    loaderPrototype.load = function ( url, onLoad ) {

        assert.ok( permittedUrls.has( url ), 'Unexpected fixture request: ' + url );
        const map = new Texture();
        map.name = url;
        map.image = { width: 4, height: 4 };
        loaded.push( { epoch, map, url } );
        queueMicrotask( () => onLoad( map ) );
        return map;

    };
    texturePrototype.dispose = function () {

        trace.push( { epoch, texture: this } );
        return originalDispose.call( this );

    };

    const fullOptions = {
        albedoMap: borrowed,
        curvatureMapUrl: 'fixture-curvature.png',
        regionMapUrl: 'fixture-region.png',
        cavityMapUrl: 'fixture-cavity.png'
    };
    const mapState = map => ( {
        colorSpace: map.colorSpace, flipY: map.flipY, minFilter: map.minFilter,
        magFilter: map.magFilter, generateMipmaps: map.generateMipmaps,
        wrapS: map.wrapS, wrapT: map.wrapT
    } );
    const valueState = value => value?.isVector3 ? value.toArray() : value;
    const snapshot = material => ( {
        type: material.type, skinFlag: material.isSkinNodeMaterial,
        settings: material.skinSettings,
        uniforms: Object.fromEntries( Object.entries( material.skinUniforms )
            .map( ( [ key, node ] ) => [ key, valueState( node.value ) ] ) ),
        metalness: material.metalness, roughness: material.roughness, ior: material.ior,
        clearcoat: material.clearcoat, clearcoatRoughness: material.clearcoatRoughness,
        hasRegionMap: material.hasRegionMap, hasCavityMap: material.hasCavityMap,
        borrowedAlbedo: material.map === borrowed,
        loadedMaps: [ 'curvatureMap', 'regionMap', 'cavityMap' ].map( key => {

            const node = material.skin[ key ];
            return node === null ? null : mapState( node.value );

        } )
    } );
    const create = async ( factory, options ) => {

        factoryCalls ++;
        const material = await factory( options );
        assert.ok( process.memoryUsage().rss <= 768 * 1024 * 1024, 'Sampled RSS exceeded cap.' );
        assert.ok( performance.now() - started < 30_000, 'Cooperative runtime cap exceeded.' );
        return material;

    };
    const eventsFor = name => trace.filter( event => event.epoch === name );
    const verifyOwnedAttemptSet = ( name, material, expectedCount, repeats = 1 ) => {

        const events = eventsFor( name );
        assert.equal( events.length, expectedCount * repeats );
        const counts = new Map();
        for ( const { texture } of events ) {

            assert.notEqual( texture, borrowed, 'Borrowed albedo was disposed.' );
            counts.set( texture, ( counts.get( texture ) ?? 0 ) + 1 );

        }
        assert.equal( counts.size, expectedCount );
        for ( const count of counts.values() ) assert.equal( count, repeats );
        const loadedHere = loaded.filter( item => item.epoch === name );
        for ( const { map } of loadedHere ) assert.ok( counts.has( map ) );
        assert.ok( counts.has( material.skin.lut.value ) );
        const generated = [ ...counts.keys() ].filter( map => ! loadedHere.some( item => item.map === map ) );
        assert.equal( generated.length, 2 );
        assert.ok( generated.every( map => map.isDataTexture === true && ArrayBuffer.isView( map.image.data ) ) );
        return {
            ownedTextureCount: counts.size, attempts: events.length,
            loadedTextureCount: loadedHere.length, generatedTextureCount: generated.length,
            generated: generated.map( map => ( {
                width: map.image.width, height: map.image.height, bytes: map.image.data.byteLength,
                sha256: digest( Buffer.from( map.image.data.buffer, map.image.data.byteOffset, map.image.data.byteLength ) )
            } ) )
        };

    };

    epoch = 'baseline-full';
    const base = await create( baseline.createSkinMaterial, fullOptions );
    const baseState = snapshot( base );
    let baseMaterialEvents = 0;
    base.addEventListener( 'dispose', () => { baseMaterialEvents ++; } );
    base.dispose();
    assert.equal( eventsFor( epoch ).length, 0 );
    assert.equal( baseMaterialEvents, 1 );
    reports.push( { case: epoch, materialEvents: 1, textureAttempts: 0 } );

    epoch = 'candidate-full';
    const full = await create( candidate.createSkinMaterial, fullOptions );
    assert.deepEqual( snapshot( full ), baseState );
    let fullMaterialEvents = 0;
    full.addEventListener( 'dispose', () => { fullMaterialEvents ++; } );
    full.dispose();
    const firstFull = verifyOwnedAttemptSet( epoch, full, 5 );
    assert.equal( fullMaterialEvents, 1 );
    full.dispose();
    const repeatFull = verifyOwnedAttemptSet( epoch, full, 5, 2 );
    assert.equal( fullMaterialEvents, 2 );
    reports.push( { case: epoch, successfulStateMatchesBaseline: true, first: firstFull,
        repeat: repeatFull, materialEvents: fullMaterialEvents, borrowedAlbedoAttempts: 0 } );

    epoch = 'optional-null-reentrant';
    const optional = await create( candidate.createSkinMaterial, {
        albedoMap: borrowed, curvatureMapUrl: null, regionMapUrl: null, cavityMapUrl: null
    } );
    assert.equal( optional.map, borrowed );
    assert.equal( optional.hasRegionMap, false );
    assert.equal( optional.hasCavityMap, false );
    let nestedRequests = 0;
    let optionalMaterialEvents = 0;
    optional.skin.lut.value.addEventListener( 'dispose', () => {

        nestedRequests ++;
        optional.dispose();

    } );
    optional.addEventListener( 'dispose', () => { optionalMaterialEvents ++; } );
    optional.dispose();
    assert.equal( nestedRequests, 1 );
    assert.equal( optionalMaterialEvents, 1 );
    reports.push( { case: epoch, ...verifyOwnedAttemptSet( epoch, optional, 2 ),
        nestedRequests, materialEvents: optionalMaterialEvents, borrowedAlbedoAttempts: 0 } );

    epoch = 'listener-failures';
    const faulty = await create( candidate.createSkinMaterial, fullOptions );
    const faultMaps = loaded.filter( item => item.epoch === epoch );
    assert.equal( faultMaps.length, 3 );
    const textureFailure = new Error( 'Texture listener sentinel.' );
    const materialFailure = new Error( 'Material listener sentinel.' );
    const throwTextureFailure = () => { throw textureFailure; };
    const throwUndefined = () => { throw undefined; };
    const throwMaterialFailure = () => { throw materialFailure; };
    faultMaps[ 0 ].map.addEventListener( 'dispose', throwTextureFailure );
    faultMaps[ 1 ].map.addEventListener( 'dispose', throwUndefined );
    let failedMaterialEvents = 0;
    faulty.addEventListener( 'dispose', () => {

        failedMaterialEvents ++;
    } );
    faulty.addEventListener( 'dispose', throwMaterialFailure );
    let caught = false;
    try { faulty.dispose(); } catch ( error ) {

        caught = true;
        assert.ok( error instanceof AggregateError );
        assert.equal( error.errors.length, 3 );
        assert.equal( error.errors[ 0 ], textureFailure );
        assert.equal( error.errors[ 1 ], undefined );
        assert.equal( error.errors[ 2 ], materialFailure );

    }
    assert.equal( caught, true );
    assert.equal( failedMaterialEvents, 1 );
    const multipleFailures = verifyOwnedAttemptSet( epoch, faulty, 5 );
    faultMaps[ 0 ].map.removeEventListener( 'dispose', throwTextureFailure );
    faulty.removeEventListener( 'dispose', throwMaterialFailure );
    let singleCaught = false;
    try { faulty.dispose(); } catch ( error ) {

        singleCaught = true;
        assert.equal( error, undefined );

    }
    assert.equal( singleCaught, true );
    assert.equal( failedMaterialEvents, 2 );
    const singleFailure = verifyOwnedAttemptSet( epoch, faulty, 5, 2 );
    faultMaps[ 1 ].map.removeEventListener( 'dispose', throwUndefined );
    faulty.dispose();
    assert.equal( failedMaterialEvents, 3 );
    const laterCleanCall = verifyOwnedAttemptSet( epoch, faulty, 5, 3 );
    reports.push( { case: epoch, multipleFailures, singleFailure, laterCleanCall,
        materialEvents: failedMaterialEvents, exactFailureValues: true, borrowedAlbedoAttempts: 0 } );
    assert.equal( factoryCalls, 4 );
    assert.equal( loaded.length, 9 );
    assert.equal( trace.some( event => event.texture === borrowed ), false );
    const report = {
        schema: 'completed-skin-owner-cpu-proof-v1', status: 'PASS',
        pid: process.pid, utc: new Date().toISOString(), node: process.version,
        factoryCalls, fixtureLoadedTextures: loaded.length, cases: reports,
        elapsedAfterAdmissionMs: performance.now() - started, sampledRssBytes: process.memoryUsage().rss,
        limits: 'Actual component and Three CPU objects/events; loader callback substitution, no decode/network/render/WebGPU or physical-release proof. Repeated signals do not qualify actual render reuse. Loading/constructor failures and arbitrary external clone/shared users are outside this proof.'
    };
    const output = JSON.stringify( report, null, 2 ) + '\n';
    assert.ok( Buffer.byteLength( output ) <= 64 * 1024 );
    process.stdout.write( output );

} catch ( error ) {

    process.stderr.write( ( error?.stack ?? String( error ) ).slice( 0, 16 * 1024 ) + '\n' );
    process.exitCode = 1;

} finally {

    if ( loaderPrototype && originalLoad ) loaderPrototype.load = originalLoad;
    if ( texturePrototype && originalDispose ) texturePrototype.dispose = originalDispose;
    clearTimeout( timer );

}
