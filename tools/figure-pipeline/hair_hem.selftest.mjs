#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { BufferAttribute, BufferGeometry } from 'three';
import { readAccessor, readGlb, readPrimitive } from '../lut-bake/glb.mjs';
import { encodeGlb, geometryFingerprint, sha256, transformHairFall, updateMovedFrames } from './hair_fall.mjs';
import { HEM_CALIBRATION as C, runHairHem, transformHairHem } from './hair_hem.mjs';

const root = path.resolve( path.dirname( fileURLToPath( import.meta.url ) ), '../..' );
// Derive a transient fall-stage asset from the immutable original for full default coverage.
// An explicit fall or hem asset remains supported for targeted checks.
const bodyFile = path.join( root, 'assets/figures/figure_g050.glb' );
const temporary = fs.mkdtempSync( path.join( os.tmpdir(), 'sugata-hair-hem-test-' ) );
const input = process.argv[ 2 ] === undefined ? path.join( temporary, 'fall-input.glb' ) : path.resolve( process.argv[ 2 ] );
const cards = [ 81,83,85,99,110,111,114,117,119,121,122,128,134,136,147,148,149,150,157,163,176,
    301,303,306,309,317,320,324,325,336,339,349,352,357,361,366,375,379,382,390,397,411,414,421,
    428,437,440,448,451,455,459,461 ];
let groups = 0;
function check( name, test ) { test(); groups ++; console.log( `ok ${ groups } - ${ name }` ); }
function save( name, glb ) { const file = path.join( temporary, name ); fs.writeFileSync( file, encodeGlb( glb ) ); return file; }
function attributes( glb, name = 'hair_bob02' ) { return glb.json.meshes.find( mesh => mesh.name === name ).primitives[ 0 ].attributes; }
function perturbPosition( glb, name = 'hair_bob02' ) {
    const a = glb.json.accessors[ attributes( glb, name ).POSITION ], v = glb.json.bufferViews[ a.bufferView ];
    const offset = ( v.byteOffset ?? 0 ) + ( a.byteOffset ?? 0 ); glb.bin.writeFloatLE( glb.bin.readFloatLE( offset ) + .001, offset );
}
try {
    if ( process.argv[ 2 ] === undefined ) {
        const fixture = path.join( root, 'tools/figure-pipeline/fixtures/bob02-g050-original.glb' );
        assert.equal( sha256( fs.readFileSync( fixture ) ),
            '25376e139cd498bf2bdb36dfdc6df80cb8f5f4ec026ca033ca2dd1cae23913d4',
            'Original fixture hash mismatch; fetch its Git LFS content and do not replace it with a corrected asset.' );
        fs.writeFileSync( input, transformHairFall( fixture, bodyFile ).bytes );
    }
    const originalBytes = fs.readFileSync( input ), before = readGlb( input ), original = readPrimitive( before, 'hair_bob02' );
    const result = transformHairHem( input, bodyFile ), outputFile = path.join( temporary, 'hem.glb' );
    fs.writeFileSync( outputFile, result.bytes );
    const after = readGlb( outputFile ), corrected = readPrimitive( after, 'hair_bob02' );
    const attrs = attributes( before );
    check( 'exact accepted candidate positions/normals and independent face gate', () => {
        assert.equal( sha256( Buffer.from( new Float32Array( corrected.positions ).buffer ) ), '7d7f2bc9c640231ee93bebd1dfd9598ece268dba42a9025dbb8c85166545c737' );
        assert.equal( sha256( Buffer.from( new Float32Array( corrected.normals ).buffer ) ), '815882764df3e5456b494dc2a0b6dc8ad37015d2cf2f016842541523c4530d3a' );
        assert.equal( geometryFingerprint( corrected ), C.outputGeometry );
        assert.equal( result.report.surface.face.pairs, 0 );
        assert.equal( result.report.surface.head.pairs, 165 );
        assert.equal( after.json.asset.extras.sugataHairHem.correctedCards, 52 );
        if ( ! result.report.alreadyApplied ) {
            assert.deepEqual( result.report.movedCards.map( card => card.card ), cards );
            assert.ok( result.report.lengthChanges.every( row => row.deltaMm <= 0 ) );
        }
        assert.deepEqual( fs.readFileSync( input ), originalBytes );
    } );
    check( 'roots, crown, x/z and full ring width vectors stay exact', () => {
        let changed = 0;
        for ( let vertex = 0; vertex < original.positions.length / 3; vertex ++ ) {
            const i = vertex * 3, dy = corrected.positions[ i + 1 ] - original.positions[ i + 1 ];
            assert.equal( corrected.positions[ i ], original.positions[ i ] ); assert.equal( corrected.positions[ i + 2 ], original.positions[ i + 2 ] );
            assert.ok( dy >= 0 && dy <= .018 ); if ( dy > 0 ) changed ++;
            if ( vertex < 652 || ( vertex - 652 ) % 34 < 2 || original.positions[ i + 1 ] >= C.startY ) assert.equal( dy, 0 );
        }
        if ( ! result.report.alreadyApplied ) assert.equal( changed, 510 );
        for ( let vertex = 652; vertex < original.positions.length / 3; vertex += 2 ) for ( let axis = 0; axis < 3; axis ++ ) {
            assert.equal( corrected.positions[ vertex * 3 + axis ] - corrected.positions[ ( vertex + 1 ) * 3 + axis ],
                original.positions[ vertex * 3 + axis ] - original.positions[ ( vertex + 1 ) * 3 + axis ] );
        }
    } );
    check( 'all nongeometry data and the original fall stamp survive unchanged', () => {
        assert.equal( before.bin.length, after.bin.length );
        const allowed = new Uint8Array( before.bin.length );
        for ( const name of [ 'POSITION', 'NORMAL', 'TANGENT' ] ) {
            if ( attrs[ name ] === undefined ) continue;
            const a = before.json.accessors[ attrs[ name ] ], v = before.json.bufferViews[ a.bufferView ], width = name === 'TANGENT' ? 16 : 12;
            for ( let vertex = 0; vertex < a.count; vertex ++ ) {
                const start = ( v.byteOffset ?? 0 ) + ( a.byteOffset ?? 0 ) + vertex * ( v.byteStride ?? width ); allowed.fill( 1, start, start + width );
            }
        }
        for ( let i = 0; i < allowed.length; i ++ ) if ( ! allowed[ i ] ) assert.equal( before.bin[ i ], after.bin[ i ] );
        const a = structuredClone( before.json ), b = structuredClone( after.json );
        for ( const json of [ a, b ] ) {
            delete json.asset.extras.sugataHairHem;
            for ( const name of [ 'POSITION', 'NORMAL', 'TANGENT' ] ) if ( attrs[ name ] !== undefined ) {
                delete json.accessors[ attrs[ name ] ].min; delete json.accessors[ attrs[ name ] ].max;
            }
        }
        assert.deepEqual( b, a );
        assert.deepEqual( after.json.asset.extras.sugataHairFall, before.json.asset.extras.sugataHairFall );
    } );
    check( 'deterministic fresh output and byte-idempotent repeat', () => {
        assert.deepEqual( transformHairHem( input, bodyFile ).bytes, result.bytes );
        const repeated = transformHairHem( outputFile, bodyFile );
        assert.equal( repeated.report.alreadyApplied, true ); assert.deepEqual( repeated.bytes, result.bytes );
    } );
    check( 'fall-stage order, source/body calibration, and unknown stamps are enforced', () => {
        const missing = readGlb( input ); delete missing.json.asset.extras.sugataHairFall;
        assert.throws( () => transformHairHem( save( 'missing-fall.glb', missing ), bodyFile ), /fall stage first/ );
        const wrongFall = readGlb( input ); wrongFall.json.asset.extras.sugataHairFall.calibration = 'unknown';
        assert.throws( () => transformHairHem( save( 'wrong-fall.glb', wrongFall ), bodyFile ), /fall stage first/ );
        const wrongSource = readGlb( input ); delete wrongSource.json.asset.extras.sugataHairHem; perturbPosition( wrongSource );
        assert.throws( () => transformHairHem( save( 'wrong-source.glb', wrongSource ), bodyFile ), /calibrated fall-corrected/ );
        const wrongBody = readGlb( bodyFile ); perturbPosition( wrongBody, 'base.001' );
        assert.throws( () => transformHairHem( input, save( 'wrong-body.glb', wrongBody ) ), /calibrated figure_g050/ );
        const unknown = readGlb( outputFile ); unknown.json.asset.extras.sugataHairHem.calibration = 'unknown';
        assert.throws( () => transformHairHem( save( 'unknown.glb', unknown ), bodyFile ), /second deformation/ );
        const altered = readGlb( outputFile ); perturbPosition( altered );
        assert.throws( () => transformHairHem( save( 'altered.glb', altered ), bodyFile ), /second deformation/ );
    } );
    check( 'the historical fall stage still rejects a later hem deformation', () => {
        assert.throws( () => transformHairFall( outputFile, bodyFile ), /second deformation/ );
    } );
    check( 'CLI writer reuses overwrite guards, including file aliases', () => {
        const inputCopy = path.join( temporary, 'input-copy.glb' ); fs.writeFileSync( inputCopy, originalBytes );
        const options = { input: inputCopy, body: bodyFile, output: inputCopy };
        assert.throws( () => runHairHem( options ), /In-place/ );
        assert.throws( () => runHairHem( { ...options, output: bodyFile, allowInPlace: true } ), /body/ );
        const alias = path.join( temporary, 'input-link.glb' ); fs.symlinkSync( inputCopy, alias );
        assert.throws( () => runHairHem( { ...options, output: alias } ), /In-place/ );
        const hardlink = path.join( temporary, 'hard-link.glb' ); fs.linkSync( inputCopy, hardlink );
        assert.throws( () => runHairHem( { ...options, output: hardlink } ), /In-place/ );
        assert.throws( () => runHairHem( { ...options, output: path.join( temporary, 'new.glb' ), report: inputCopy } ), /Report path/ );
        const reportFile = path.join( temporary, 'write-report.json' );
        runHairHem( { ...options, allowInPlace: true, report: reportFile } );
        assert.deepEqual( fs.readFileSync( inputCopy ), result.bytes );
        assert.equal( JSON.parse( fs.readFileSync( reportFile ) ).outputSha256, sha256( result.bytes ) );
    } );
    check( 'normal/tangent transport maintains orthonormal frames and preserves other vertices', () => {
        const geometry = new BufferGeometry();
        geometry.setAttribute( 'position', new BufferAttribute( new Float32Array( [ 0,0,0, 1,0,1, 0,1,0, 1,1,1, 4,4,4 ] ), 3 ) );
        geometry.setIndex( [ 0,1,2, 2,1,3 ] );
        const primitive = { normals: [ 0,0,1, 0,0,1, 0,0,1, 0,0,1, 0,1,0 ], uvs: [ 0,0, 1,0, 0,1, 1,1, 0,0 ] };
        const tangents = [ 1,0,0,1, 1,0,0,1, 1,0,0,1, 1,0,0,1, 1,0,0,-1 ];
        const frames = updateMovedFrames( geometry, primitive, [ 0,1,2,3 ], tangents );
        for ( let vertex = 0; vertex < 4; vertex ++ ) {
            const n = frames.normals.slice( vertex * 3, vertex * 3 + 3 ), t = frames.tangents.slice( vertex * 4, vertex * 4 + 3 );
            assert.ok( Math.abs( Math.hypot( ...n ) - 1 ) < 1e-6 ); assert.ok( Math.abs( Math.hypot( ...t ) - 1 ) < 1e-6 );
            assert.ok( Math.abs( n.reduce( ( sum, x, axis ) => sum + x * t[ axis ], 0 ) ) < 1e-6 );
            assert.ok( Math.abs( t[ 2 ] - Math.SQRT1_2 ) < 1e-6 ); assert.equal( frames.tangents[ vertex * 4 + 3 ], 1 );
        }
        assert.deepEqual( Array.from( frames.normals.slice( 12 ) ), primitive.normals.slice( 12 ) );
        assert.deepEqual( Array.from( frames.tangents.slice( 16 ) ), tangents.slice( 16 ) ); geometry.dispose();
    } );
    if ( ! result.report.alreadyApplied ) check( 'real asset tangent channel updates only corrected cards and participates in the stamp', () => {
        const glb = readGlb( input ), geometry = new BufferGeometry();
        geometry.setAttribute( 'position', new BufferAttribute( new Float32Array( original.positions ), 3 ) );
        geometry.setAttribute( 'normal', new BufferAttribute( new Float32Array( original.normals ), 3 ) );
        geometry.setAttribute( 'uv', new BufferAttribute( new Float32Array( original.uvs ), 2 ) );
        geometry.setIndex( new BufferAttribute( new Uint32Array( original.indices ), 1 ) ); geometry.computeTangents();
        const tangents = new Float32Array( geometry.attributes.tangent.array ), offset = glb.bin.length;
        glb.bin = Buffer.concat( [ glb.bin, Buffer.from( tangents.buffer ) ] ); glb.json.buffers[ 0 ].byteLength = glb.bin.length;
        const view = glb.json.bufferViews.push( { buffer: 0, byteOffset: offset, byteLength: tangents.byteLength, target: 34962 } ) - 1;
        const accessor = glb.json.accessors.push( { bufferView: view, componentType: 5126, type: 'VEC4', count: tangents.length / 4 } ) - 1;
        attributes( glb ).TANGENT = accessor;
        const transformed = transformHairHem( save( 'with-tangents.glb', glb ), bodyFile );
        const file = path.join( temporary, 'hem-tangents.glb' ); fs.writeFileSync( file, transformed.bytes );
        const output = readGlb( file ), normals = readPrimitive( output, 'hair_bob02' ).normals, values = readAccessor( output, accessor ).data;
        const changedCards = new Set( cards ); let updated = 0;
        for ( let vertex = 0; vertex < values.length / 4; vertex ++ ) {
            if ( vertex < 652 || ! changedCards.has( Math.floor( ( vertex - 652 ) / 34 ) ) ) {
                assert.deepEqual( Array.from( values.slice( vertex * 4, vertex * 4 + 4 ) ), Array.from( tangents.slice( vertex * 4, vertex * 4 + 4 ) ) );
            } else {
                const t = values.slice( vertex * 4, vertex * 4 + 3 ), n = normals.slice( vertex * 3, vertex * 3 + 3 );
                assert.ok( Math.abs( Math.hypot( ...t ) - 1 ) < 1e-5 );
                assert.ok( Math.abs( n.reduce( ( sum, x, axis ) => sum + x * t[ axis ], 0 ) ) < 1e-5 );
                assert.ok( Math.abs( values[ vertex * 4 + 3 ] ) === 1 );
                if ( t.some( ( x, axis ) => x !== tangents[ vertex * 4 + axis ] ) ) updated ++;
            }
        }
        assert.ok( updated > 0 ); assert.deepEqual( transformHairHem( file, bodyFile ).bytes, transformed.bytes );
        output.bin.writeFloatLE( output.bin.readFloatLE( offset ) + .1, offset );
        assert.throws( () => transformHairHem( save( 'tampered-tangent.glb', output ), bodyFile ), /second deformation/ ); geometry.dispose();
    } );
    console.log( `${ groups } hair-hem test groups passed (${ result.report.alreadyApplied ? 'hem input; pass a fall-stage asset to also exercise deformation and full tangent integration' : 'fall-stage input including full tangent integration' }).` );
} finally { fs.rmSync( temporary, { recursive: true, force: true } ); }
