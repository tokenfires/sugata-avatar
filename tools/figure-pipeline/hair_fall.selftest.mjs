#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { BufferAttribute, BufferGeometry } from 'three';
import { readGlb, readPrimitive } from '../lut-bake/glb.mjs';
import { CALIBRATION, encodeGlb, geometryFingerprint, sha256, transformHairFall, updateMovedFrames, validatePaths } from './hair_fall.mjs';
import { measureHairSurface } from './hair_surface.mjs';

const root = path.resolve( path.dirname( fileURLToPath( import.meta.url ) ), '../..' );
// An explicit original export exercises the transform even after the shipped asset is corrected.
const input = path.resolve( process.argv[ 2 ] ?? path.join( root, 'assets/hair/bob02/g050.glb' ) );
const bodyFile = path.join( root, 'assets/figures/figure_g050.glb' );
const directory = fs.mkdtempSync( path.join( os.tmpdir(), 'sugata-hair-fall-test-' ) );
let groups = 0;
function check( name, test ) { test(); groups ++; console.log( `ok ${ groups } - ${ name }` ); }
function saveGlb( name, glb ) { const file = path.join( directory, name ); fs.writeFileSync( file, encodeGlb( glb ) ); return file; }
try {
    const beforeBytes = fs.readFileSync( input ), before = readGlb( input );
    const original = readPrimitive( before, 'hair_bob02' );
    const result = transformHairFall( input, bodyFile );
    const outputFile = path.join( directory, 'corrected.glb' );
    fs.writeFileSync( outputFile, result.bytes );
    const after = readGlb( outputFile ), corrected = readPrimitive( after, 'hair_bob02' );
    const attrs = before.json.meshes.find( mesh => mesh.name === 'hair_bob02' ).primitives[ 0 ].attributes;
    check( 'validated v2 geometry and normals reproduce exactly', () => {
        assert.equal( sha256( Buffer.from( new Float32Array( corrected.positions ).buffer ) ), '17e5cb1a85f7acebb0d1c4ac9dcedd535002e048280c4f7d6e19ee19337f3b8e' );
        assert.equal( sha256( Buffer.from( new Float32Array( corrected.normals ).buffer ) ), '67742e3c5db2de49eaf1521797da4ef08925a30ead54d9c6947ec516d364f9a4' );
        assert.equal( after.json.asset.extras.sugataHairFall.correctedCards, 170 );
        if ( ! result.report.alreadyApplied ) {
            assert.equal( result.report.correctedCards, 170 );
            assert.ok( result.report.arcLengthChangeMm.max <= 0.02 );
        }
        assert.deepEqual( fs.readFileSync( input ), beforeBytes, 'transform must never modify its input' );
    } );
    check( 'heights, cap, roots, and upper silhouette are exact', () => {
        for ( let vertex = 0; vertex < original.positions.length / 3; vertex ++ ) {
            const p = vertex * 3;
            assert.equal( corrected.positions[ p + 1 ], original.positions[ p + 1 ] );
            const rootRing = vertex >= CALIBRATION.capVertices && ( vertex - CALIBRATION.capVertices ) % ( CALIBRATION.rings * 2 ) < 2;
            if ( vertex < CALIBRATION.capVertices || rootRing || original.positions[ p + 1 ] >= CALIBRATION.releaseY ) {
                assert.deepEqual( corrected.positions.slice( p, p + 3 ), original.positions.slice( p, p + 3 ) );
            }
        }
    } );
    check( 'topology, UVs, skin, materials, images and all other bytes survive', () => {
        assert.equal( before.bin.length, after.bin.length );
        const permitted = new Uint8Array( before.bin.length );
        for ( const name of [ 'POSITION', 'NORMAL', 'TANGENT' ] ) {
            if ( attrs[ name ] === undefined ) continue;
            const accessor = before.json.accessors[ attrs[ name ] ], view = before.json.bufferViews[ accessor.bufferView ];
            const width = name === 'TANGENT' ? 16 : 12;
            for ( let vertex = 0; vertex < accessor.count; vertex ++ ) {
                const start = ( view.byteOffset ?? 0 ) + ( accessor.byteOffset ?? 0 ) + vertex * ( view.byteStride ?? width );
                permitted.fill( 1, start, start + width );
            }
        }
        for ( let byte = 0; byte < permitted.length; byte ++ ) if ( ! permitted[ byte ] ) assert.equal( before.bin[ byte ], after.bin[ byte ] );
        const a = structuredClone( before.json ), b = structuredClone( after.json );
        for ( const json of [ a, b ] ) {
            if ( json.asset.extras ) { delete json.asset.extras.sugataHairFall; if ( Object.keys( json.asset.extras ).length === 0 ) delete json.asset.extras; }
            for ( const name of [ 'POSITION', 'NORMAL', 'TANGENT' ] ) if ( attrs[ name ] !== undefined ) {
                delete json.accessors[ attrs[ name ] ].min; delete json.accessors[ attrs[ name ] ].max;
            }
        }
        assert.deepEqual( b, a );
    } );
    check( 'complete triangle face-region intersection gate passes', () => {
        const measurement = measureHairSurface( corrected, readPrimitive( readGlb( bodyFile ), 'base.001' ) );
        assert.equal( measurement.face.pairs, 0 );
        // This is deliberately a face-region gate. Hair/scalp contact remains outside that region.
        assert.ok( measurement.head.pairs > 0 );
    } );
    check( 'same input is deterministic and corrected input is byte-idempotent', () => {
        assert.deepEqual( transformHairFall( input, bodyFile ).bytes, result.bytes );
        const repeated = transformHairFall( outputFile, bodyFile );
        assert.equal( repeated.report.alreadyApplied, true );
        assert.deepEqual( repeated.bytes, result.bytes );
    } );
    check( 'uncalibrated source and body are rejected', () => {
        const changed = readGlb( input );
        delete changed.json.asset.extras?.sugataHairFall;
        const a = changed.json.accessors[ attrs.POSITION ], v = changed.json.bufferViews[ a.bufferView ];
        const offset = ( v.byteOffset ?? 0 ) + ( a.byteOffset ?? 0 );
        changed.bin.writeFloatLE( changed.bin.readFloatLE( offset ) + .001, offset );
        assert.throws( () => transformHairFall( saveGlb( 'other-hair.glb', changed ), bodyFile ), /original bob02\/g050 calibration/ );
        const body = readGlb( bodyFile );
        const bodyAttr = body.json.meshes.find( mesh => mesh.name === 'base.001' ).primitives[ 0 ].attributes.POSITION;
        const ba = body.json.accessors[ bodyAttr ], bv = body.json.bufferViews[ ba.bufferView ];
        const bo = ( bv.byteOffset ?? 0 ) + ( ba.byteOffset ?? 0 );
        body.bin.writeFloatLE( body.bin.readFloatLE( bo ) + .001, bo );
        assert.throws( () => transformHairFall( input, saveGlb( 'other-body.glb', body ) ), /calibrated figure_g050/ );
    } );
    check( 'unknown stamps and altered corrected geometry cannot deform twice', () => {
        const unknown = readGlb( outputFile ); unknown.json.asset.extras.sugataHairFall.calibration = 'future-version';
        assert.throws( () => transformHairFall( saveGlb( 'unknown.glb', unknown ), bodyFile ), /second deformation/ );
        const changed = readGlb( outputFile );
        const a = changed.json.accessors[ attrs.POSITION ], v = changed.json.bufferViews[ a.bufferView ];
        const offset = ( v.byteOffset ?? 0 ) + ( a.byteOffset ?? 0 ); changed.bin.writeFloatLE( 42, offset );
        assert.throws( () => transformHairFall( saveGlb( 'altered.glb', changed ), bodyFile ), /second deformation/ );
    } );
    check( 'in-place, body, report, symlink and hardlink overwrites are guarded', () => {
        const options = { input: outputFile, body: bodyFile, output: path.join( directory, 'new.glb' ) };
        validatePaths( options );
        assert.throws( () => validatePaths( { ...options, output: outputFile } ), /In-place/ );
        validatePaths( { ...options, output: outputFile, allowInPlace: true } );
        assert.throws( () => validatePaths( { ...options, output: bodyFile, allowInPlace: true } ), /body/ );
        for ( const report of [ outputFile, bodyFile, options.output ] ) assert.throws( () => validatePaths( { ...options, report } ), /Report path/ );
        const symlink = path.join( directory, 'alias.glb' ), hardlink = path.join( directory, 'hardlink.glb' );
        fs.symlinkSync( outputFile, symlink ); fs.linkSync( outputFile, hardlink );
        for ( const output of [ symlink, hardlink ] ) assert.throws( () => validatePaths( { ...options, output } ), /In-place/ );
    } );
    check( 'changed normal/tangent frames remain orthonormal and untouched frames survive', () => {
        const geometry = new BufferGeometry();
        geometry.setAttribute( 'position', new BufferAttribute( new Float32Array( [ 0,0,0, 1,0,1, 0,1,0, 1,1,1, 4,4,4 ] ), 3 ) );
        geometry.setIndex( [ 0,1,2, 2,1,3 ] );
        const primitive = { normals: [ 0,0,1, 0,0,1, 0,0,1, 0,0,1, 0,1,0 ], uvs: [ 0,0, 1,0, 0,1, 1,1, 0,0 ] };
        const originalTangents = [ 1,0,0,1, 1,0,0,1, 1,0,0,1, 1,0,0,1, 1,0,0,-1 ];
        const frames = updateMovedFrames( geometry, primitive, [ 0,1,2,3 ], originalTangents );
        for ( let vertex = 0; vertex < 4; vertex ++ ) {
            const n = frames.normals.slice( vertex * 3, vertex * 3 + 3 ), t = frames.tangents.slice( vertex * 4, vertex * 4 + 3 );
            assert.ok( Math.abs( Math.hypot( ...n ) - 1 ) < 1e-6 ); assert.ok( Math.abs( Math.hypot( ...t ) - 1 ) < 1e-6 );
            assert.ok( Math.abs( n.reduce( ( sum, value, axis ) => sum + value * t[ axis ], 0 ) ) < 1e-6 );
            assert.ok( Math.abs( n[ 0 ] + Math.SQRT1_2 ) < 1e-6 ); assert.ok( Math.abs( t[ 2 ] - Math.SQRT1_2 ) < 1e-6 );
            assert.equal( frames.tangents[ vertex * 4 + 3 ], 1 );
        }
        assert.deepEqual( Array.from( frames.normals.slice( 12 ) ), primitive.normals.slice( 12 ) );
        assert.deepEqual( Array.from( frames.tangents.slice( 16 ) ), originalTangents.slice( 16 ) );
        geometry.dispose();
    } );
    console.log( `${ groups } hair-fall test groups passed (${ result.report.alreadyApplied ? 'corrected input' : 'original export' }).` );
} finally { fs.rmSync( directory, { recursive: true, force: true } ); }
