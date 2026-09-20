import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readGlb, readPrimitive, readAccessor } from '../lut-bake/glb.mjs';
import { measureHairSurface } from './hair_surface.mjs';
import { CASUAL_TROUSER_FIT as calibration, originalCasualTrouser, transformCasualTrouserFit, runCasualTrouserFit } from './casual_trouser_fit.mjs';
import { validateWardrobeMaskEnvironment, WARDROBE_MASK_CALIBRATION } from './wardrobe_under_masks.mjs';

const directory = fs.mkdtempSync( path.join( os.tmpdir(), 'sugata-trouser-fit-' ) );
const sha = bytes => createHash( 'sha256' ).update( bytes ).digest( 'hex' );
const asset = id => new URL( `../../assets/wardrobe/${ id }/g050.glb`, import.meta.url );
let checks = 0;
function group( name, fn ) { fn(); checks ++; console.log( 'PASS ' + name ); }
try {
    const originalBytes = fs.readFileSync( originalCasualTrouser );
    const source = readGlb( originalCasualTrouser ), before = readPrimitive( source, calibration.garment );
    const result = transformCasualTrouserFit(), file = path.join( directory, 'candidate.glb' );
    fs.writeFileSync( file, result.bytes );
    const output = readGlb( file ), after = readPrimitive( output, calibration.garment );
    group( 'immutable reference reproduces the independently rendered asset', () => {
        assert.equal( sha( originalBytes ), calibration.sourceSHA256 );
        assert.equal( sha( result.bytes ), calibration.outputSHA256 );
        assert.equal( result.report.movedVertices, 205 );
        assert.equal( result.report.cuff.skippedDegenerateProjections, 0 );
        assert.ok( result.report.cuff.maxLift < .024 );
        assert.deepEqual( fs.readFileSync( originalCasualTrouser ), originalBytes );
    } );
    group( 'only position and normal payloads and their accessor bounds can change', () => {
        const attributes = source.json.meshes.find( m => m.name === calibration.garment ).primitives[ 0 ].attributes;
        const mutable = new Set( [ attributes.POSITION, attributes.NORMAL ] ), allowedBytes = new Set();
        const expectedJson = structuredClone( source.json );
        for ( const index of mutable ) {
            const accessor = source.json.accessors[ index ], view = source.json.bufferViews[ accessor.bufferView ];
            for ( const field of [ 'min', 'max' ] ) if ( accessor[ field ] ) expectedJson.accessors[ index ][ field ] = output.json.accessors[ index ][ field ];
            for ( let i = 0; i < accessor.count; i ++ ) for ( let byte = 0; byte < 12; byte ++ ) allowedBytes.add( ( view.byteOffset ?? 0 ) + ( accessor.byteOffset ?? 0 ) + i * ( view.byteStride ?? 12 ) + byte );
        }
        assert.deepEqual( output.json, expectedJson ); assert.equal( output.bin.length, source.bin.length );
        for ( let i = 0; i < source.bin.length; i ++ ) if ( ! allowedBytes.has( i ) ) assert.equal( output.bin[ i ], source.bin[ i ], 'Unrelated binary byte ' + i );
        for ( let i = 0; i < source.json.accessors.length; i ++ ) if ( ! mutable.has( i ) ) assert.deepEqual( readAccessor( source, i ).data, readAccessor( output, i ).data );
        for ( let i = 0; i < before.vertexCount; i ++ ) if ( before.positions[ i * 3 + 1 ] >= .35 ) {
            assert.deepEqual( after.positions.slice( i * 3, i * 3 + 3 ), before.positions.slice( i * 3, i * 3 + 3 ) );
        }
    } );
    group( 'source smoothing twins retain continuous positions and normals', () => {
        const buckets = new Map();
        for ( let i = 0; i < before.vertexCount; i ++ ) {
            const key = Array.from( before.positions.slice( i * 3, i * 3 + 3 ), v => Math.round( v / 1e-7 ) ).join( ':' );
            for ( const j of buckets.get( key ) ?? [] ) {
                assert.deepEqual( after.positions.slice( i * 3, i * 3 + 3 ), after.positions.slice( j * 3, j * 3 + 3 ) );
                if ( [ 0, 1, 2 ].every( k => Math.abs( before.normals[ i * 3 + k ] - before.normals[ j * 3 + k ] ) <= 1e-6 ) ) {
                    assert.ok( [ 0, 1, 2 ].every( k => Math.abs( after.normals[ i * 3 + k ] - after.normals[ j * 3 + k ] ) <= 1e-6 ), 'New normal seam ' + i + '/' + j );
                }
            }
            if ( ! buckets.has( key ) ) buckets.set( key, [] ); buckets.get( key ).push( i );
        }
    } );
    group( 'the original shoe crossing reproduces and the fitted resting asset has none', () => {
        const shoes = readPrimitive( readGlb( asset( 'shoes01' ) ), 'shoes01' ), bounds = { min: [ -3, -3, -3 ], max: [ 3, 3, 3 ] };
        const cross = p => measureHairSurface( p, shoes, { headBounds: bounds, faceBounds: bounds, exampleLimit: 1000 } ).head;
        assert.equal( cross( before ).pairs, 409 ); assert.equal( cross( after ).pairs, 0 );
    } );
    group( 'frozen foundation calibration accepts exactly the original and proved successor', () => {
        const environment = Object.fromEntries( [ 'body', ...Object.keys( WARDROBE_MASK_CALIBRATION.outerGarments ) ].map( id => [ id, fs.readFileSync( asset( id ) ) ] ) );
        validateWardrobeMaskEnvironment( { ...environment, [ calibration.garment ]: originalBytes } );
        validateWardrobeMaskEnvironment( { ...environment, [ calibration.garment ]: result.bytes } );
        for ( const original of [ originalBytes, result.bytes ] ) {
            const bad = Buffer.from( original ); bad[ bad.length - 5 ] ^= 1;
            assert.throws( () => validateWardrobeMaskEnvironment( { ...environment, [ calibration.garment ]: bad } ), /environment digest/ );
        }
    } );
    group( 'foreign, already-fitted and damaged sources cannot be silently refitted', () => {
        assert.throws( () => transformCasualTrouserFit( { input: file } ), /Unqualified casual source/ );
        const bad = path.join( directory, 'bad.glb' ); fs.writeFileSync( bad, originalBytes.subarray( 0, 64 ) );
        assert.throws( () => transformCasualTrouserFit( { input: bad } ), /Unqualified casual source/ );
        assert.throws( () => transformCasualTrouserFit( { shoes: file } ), /Unqualified shoe reference/ );
    } );
    group( 'explicit output publication cannot overwrite an existing asset or source', () => {
        assert.throws( () => runCasualTrouserFit(), /explicit new --output/ );
        assert.throws( () => runCasualTrouserFit( { output: originalCasualTrouser } ), /EEXIST/ );
        assert.deepEqual( fs.readFileSync( originalCasualTrouser ), originalBytes );
        const destination = path.join( directory, 'new.glb' ); runCasualTrouserFit( { output: destination } );
        assert.equal( sha( fs.readFileSync( destination ) ), calibration.outputSHA256 );
        assert.throws( () => runCasualTrouserFit( { output: destination } ), /EEXIST/ );
    } );
    console.log( `${ checks } casual trouser groups passed. Shipping assets were not changed.` );
} finally { fs.rmSync( directory, { recursive: true, force: true } ); }
