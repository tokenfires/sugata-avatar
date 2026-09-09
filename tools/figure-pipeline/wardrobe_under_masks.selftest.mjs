import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { readGlb, readAccessor } from '../lut-bake/glb.mjs';
import { WARDROBE_MASK_CALIBRATION as calibration, originalWardrobeFoundation, transformWardrobeUnderMasks, validateWardrobeMaskEnvironment, runWardrobeUnderMasks, sha256 } from './wardrobe_under_masks.mjs';

const directory = fs.mkdtempSync( path.join( os.tmpdir(), 'sugata-wardrobe-mask-test-' ) );
const fixtureDirectory = fileURLToPath( new URL( './fixtures/', import.meta.url ) );
let checks = 0;
function group( name, fn ) { fn(); checks ++; console.log( `PASS ${ name }` ); }
try {
    const outputs = new Map();
    group( 'all four immutable originals reproduce exact reviewed payloads', () => {
        for ( const entry of calibration.garments ) {
            const original = originalWardrobeFoundation( entry.id ), copy = Buffer.from( original );
            assert.equal( sha256( original ), entry.sourceSha256 );
            const result = transformWardrobeUnderMasks( original, { garmentId: entry.id } );
            assert.deepEqual( original, copy, 'input buffer must not be mutated' );
            assert.equal( sha256( result.bytes ), entry.outputSha256 );
            assert.equal( result.report.alreadyApplied, false );
            outputs.set( entry.id, result.bytes );
        }
    } );
    group( 'every unrelated accessor, index, JSON property and binary byte stays exact', () => {
        for ( const entry of calibration.garments ) {
            const inputFile = path.join( directory, entry.id + '-source.glb' ), outputFile = path.join( directory, entry.id + '-candidate.glb' );
            fs.writeFileSync( inputFile, originalWardrobeFoundation( entry.id ) ); fs.writeFileSync( outputFile, outputs.get( entry.id ) );
            const before = readGlb( inputFile ), after = readGlb( outputFile );
            assert.deepEqual( after.json, before.json );
            const primitive = before.json.meshes.find( mesh => mesh.name === entry.id ).primitives[ 0 ];
            const mutable = new Set( entry.fields.map( field => primitive.attributes[ field.name ] ) );
            const allowedBytes = new Set();
            for ( const field of entry.fields ) {
                const accessorId = primitive.attributes[ field.name ], accessor = before.json.accessors[ accessorId ], view = before.json.bufferViews[ accessor.bufferView ];
                const a = readAccessor( before, accessorId ).data, b = readAccessor( after, accessorId ).data, selected = new Set( field.vertices );
                for ( let vertex = 0; vertex < accessor.count; vertex ++ ) assert.equal( b[ vertex ], selected.has( vertex ) ? 1 : a[ vertex ] );
                for ( const vertex of selected ) for ( let k = 0; k < 4; k ++ ) allowedBytes.add( ( view.byteOffset ?? 0 ) + ( accessor.byteOffset ?? 0 ) + vertex * ( view.byteStride ?? 4 ) + k );
            }
            for ( let i = 0; i < before.json.accessors.length; i ++ ) if ( ! mutable.has( i ) ) assert.deepEqual( readAccessor( before, i ).data, readAccessor( after, i ).data );
            for ( let i = 0; i < before.bin.length; i ++ ) if ( ! allowedBytes.has( i ) ) assert.equal( after.bin[ i ], before.bin[ i ] );
            const originalBytes = fs.readFileSync( inputFile ), outputBytes = fs.readFileSync( outputFile ), binStart = 28 + originalBytes.readUInt32LE( 12 );
            assert.equal( outputBytes.length, originalBytes.length );
            for ( let i = 0; i < originalBytes.length; i ++ ) if ( ! allowedBytes.has( i - binStart ) ) assert.equal( outputBytes[ i ], originalBytes[ i ], 'byte outside calibrated mask offsets changed' );
        }
    } );
    group( 'runtime any-corner collateral exactly equals qualified calibrated triangles', () => {
        let total = 0;
        for ( const entry of calibration.garments ) {
            const before = readGlb( path.join( directory, entry.id + '-source.glb' ) ), after = readGlb( path.join( directory, entry.id + '-candidate.glb' ) );
            const primitive = before.json.meshes.find( mesh => mesh.name === entry.id ).primitives[ 0 ], index = readAccessor( before, primitive.indices ).data;
            for ( const field of entry.fields ) {
                const a = readAccessor( before, primitive.attributes[ field.name ] ).data, b = readAccessor( after, primitive.attributes[ field.name ] ).data, removed = [];
                for ( let i = 0; i < index.length; i += 3 ) {
                    const vertices = Array.from( index.slice( i, i + 3 ) ), oldHidden = vertices.some( v => a[ v ] > 0.5 ), newHidden = vertices.some( v => b[ v ] > 0.5 );
                    assert.ok( ! oldHidden || newHidden );
                    if ( ! oldHidden && newHidden ) removed.push( i / 3 );
                }
                assert.deepEqual( removed, field.additionallyHiddenTriangles ); total += removed.length;
            }
        }
        assert.equal( total, 23300 );
    } );
    group( 'corrected inputs are idempotent and isolated from returned buffer mutation', () => {
        for ( const entry of calibration.garments ) {
            const input = outputs.get( entry.id ), result = transformWardrobeUnderMasks( input, { garmentId: entry.id } );
            assert.equal( result.report.alreadyApplied, true ); assert.deepEqual( result.bytes, input );
            result.bytes[ 0 ] ^= 1; assert.equal( sha256( input ), entry.outputSha256 );
        }
    } );
    group( 'foreign bake, garment, truncated input and tampered source/output fail closed', () => {
        const id = calibration.garments[ 0 ].id, original = originalWardrobeFoundation( id );
        assert.throws( () => transformWardrobeUnderMasks( original, { garmentId: id, bake: 'g025' } ), /only g050/ );
        assert.throws( () => originalWardrobeFoundation( 'shoes01' ), /Uncalibrated/ );
        assert.throws( () => transformWardrobeUnderMasks( original, { garmentId: 'foundation_vest' } ), /source digest/ );
        assert.throws( () => transformWardrobeUnderMasks( original.subarray( 0, 32 ), { garmentId: id } ), /source digest/ );
        for ( const bytes of [ Buffer.from( original ), Buffer.from( outputs.get( id ) ) ] ) { bytes[ bytes.length - 5 ] ^= 1; assert.throws( () => transformWardrobeUnderMasks( bytes, { garmentId: id } ), /source digest/ ); }
        assert.ok( Object.isFrozen( calibration.garments[ 0 ].fields[ 0 ].vertices ) );
        assert.throws( () => calibration.garments[ 0 ].fields[ 0 ].vertices.push( 0 ), TypeError );
    } );
    group( 'exact body and both outer garments remain mandatory even for idempotent inputs', () => {
        validateWardrobeMaskEnvironment();
        const environment = Object.fromEntries( [ 'body', ...Object.keys( calibration.outerGarments ) ].map( id => [ id, fs.readFileSync( new URL( `../../assets/wardrobe/${ id }/g050.glb`, import.meta.url ) ) ] ) );
        for ( const id of Object.keys( environment ) ) {
            const bad = { ...environment, [ id ]: Buffer.from( environment[ id ] ) }; bad[ id ][ 20 ] ^= 1;
            assert.throws( () => validateWardrobeMaskEnvironment( bad ), /environment digest/ );
            assert.throws( () => transformWardrobeUnderMasks( outputs.get( 'foundation_bra' ), { garmentId: 'foundation_bra', environment: bad } ), /environment digest/ );
        }
    } );
    group( 'CLI runner defaults to immutable originals and publishes explicit new outputs only', () => {
        const output = path.join( directory, 'nested', 'bra.glb' ), report = path.join( directory, 'reports', 'bra.json' );
        const result = runWardrobeUnderMasks( { garmentId: 'foundation_bra', output, report } );
        assert.equal( sha256( fs.readFileSync( output ) ), calibration.garments.find( e => e.id === 'foundation_bra' ).outputSha256 );
        assert.deepEqual( JSON.parse( fs.readFileSync( report ) ), result );
        assert.throws( () => runWardrobeUnderMasks( { garmentId: 'foundation_bra', output } ), /existing destination/ );
        assert.throws( () => runWardrobeUnderMasks( { garmentId: 'foundation_bra' } ), /explicit --output/ );
        const same = path.join( directory, 'same.glb' );
        assert.throws( () => runWardrobeUnderMasks( { garmentId: 'foundation_bra', output: same, report: same } ), /must differ/ ); assert.equal( fs.existsSync( same ), false );
    } );
    group( 'immutable fixture writes and aliases fail without modifying existing evidence', () => {
        const alias = path.join( directory, 'fixture-alias' ); fs.symlinkSync( fixtureDirectory, alias );
        assert.throws( () => runWardrobeUnderMasks( { garmentId: 'foundation_bra', output: path.join( alias, 'unexpected.glb' ) } ), /immutable fixtures/ );
        assert.equal( fs.existsSync( path.join( fixtureDirectory, 'unexpected.glb' ) ), false );
        const nested = 'mask-test-' + path.basename( directory );
        for ( const base of [ fixtureDirectory, alias ] ) {
            const output = path.join( base, nested, 'deeper', 'unexpected.glb' );
            assert.throws( () => runWardrobeUnderMasks( { garmentId: 'foundation_bra', output } ), /immutable fixtures/ );
            assert.equal( fs.existsSync( path.join( fixtureDirectory, nested ) ), false, 'refused fixture output created a directory' );
        }
        const input = path.join( directory, 'same-input.glb' ), bytes = originalWardrobeFoundation( 'foundation_bra' ); fs.writeFileSync( input, bytes );
        assert.throws( () => runWardrobeUnderMasks( { garmentId: 'foundation_bra', input, output: input } ), /existing destination/ ); assert.deepEqual( fs.readFileSync( input ), bytes );
    } );
    console.log( `${ checks } wardrobe mask groups passed. No shipping asset was written.` );
} finally { fs.rmSync( directory, { recursive: true, force: true } ); }
