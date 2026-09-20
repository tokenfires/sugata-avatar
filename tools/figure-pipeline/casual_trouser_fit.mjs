#!/usr/bin/env node
/** Authored g050 casual trouser correction. Not a general fitting or cloth simulation API. */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { readGlb, readPrimitive } from '../lut-bake/glb.mjs';
import { encodeGlb } from './hair_fall.mjs';
import { fitCuffHeight } from './casual_trouser_cuff.mjs';

export const CASUAL_TROUSER_FIT = Object.freeze( {
    id: 'g050-casual-trouser-fit-v1',
    garment: 'female_casualsuit01',
    sourceSHA256: '109dad33eb225ff7954501f6b1d0fcf9a17f4ea3d0271f7cef374dcbfa295160',
    shoesSHA256: '28e15257130da9eabf790b5dda55e96c985b3504e5905fa9b230195b2f27fde4',
    outputSHA256: '44ebc3eb3a09408a3563d369ae74be15a5bc4beb8040bc43c2c5446d6e65c783',
    transitionLow: .24, transitionHigh: .35,
    minimumRadiusX: .050, minimumRadiusZ: .058,
    centerXIntercept: .195, centerXSlope: -.085, centerZ: .014
} );
export const originalCasualTrouser = fileURLToPath( new URL( './fixtures/casual-g050-original.glb', import.meta.url ) );
const shoeFile = fileURLToPath( new URL( '../../assets/wardrobe/shoes01/g050.glb', import.meta.url ) );
const sha = bytes => createHash( 'sha256' ).update( bytes ).digest( 'hex' );
const smooth = value => { const u = Math.max( 0, Math.min( 1, value ) ); return u * u * u * ( u * ( u * 6 - 15 ) + 10 ); };
const pointKey = ( values, i ) => Array.from( values.slice( i * 3, i * 3 + 3 ), v => Math.round( v / 1e-7 ) ).join( ':' );

/** The reference mesh combines two uppers, two soles and two tall socks. */
function shoeSurfaces( mesh ) {
    const parent = Array.from( { length: mesh.vertexCount }, ( _, i ) => i );
    const find = i => { while ( parent[ i ] !== i ) { parent[ i ] = parent[ parent[ i ] ]; i = parent[ i ]; } return i; };
    for ( let t = 0; t < mesh.indices.length; t += 3 ) {
        const a = find( mesh.indices[ t ] );
        for ( let k = 1; k < 3; k ++ ) parent[ find( mesh.indices[ t + k ] ) ] = a;
    }
    const tops = new Map();
    for ( let i = 0; i < mesh.vertexCount; i ++ ) {
        const key = find( i );
        tops.set( key, Math.max( tops.get( key ) ?? -Infinity, mesh.positions[ i * 3 + 1 ] ) );
    }
    const indices = [];
    for ( let t = 0; t < mesh.indices.length; t += 3 ) {
        if ( tops.get( find( mesh.indices[ t ] ) ) < .12 ) indices.push( ...mesh.indices.slice( t, t + 3 ) );
    }
    assert.equal( indices.length / 3, 2816, 'Expected the calibrated shoe uppers and soles' );
    return { ...mesh, indices };
}

/** Rebuild area-weighted normals across source UV twins, preserving deliberate hard edges. */
function correctedNormals( mesh, positions, moved ) {
    const movedSet = new Set( moved ), affected = new Set();
    for ( let t = 0; t < mesh.indices.length; t += 3 ) {
        const tri = Array.from( mesh.indices.slice( t, t + 3 ) );
        if ( tri.some( i => movedSet.has( i ) ) ) tri.forEach( i => affected.add( i ) );
    }
    const buckets = new Map(), groups = [], groupOf = [];
    for ( let i = 0; i < mesh.vertexCount; i ++ ) {
        const key = pointKey( mesh.positions, i );
        if ( ! buckets.has( key ) ) buckets.set( key, [] );
        const candidates = buckets.get( key );
        let group = candidates.find( g => [ 0, 1, 2 ].every( k => Math.abs( mesh.normals[ i * 3 + k ] - g.original[ k ] ) <= 1e-6 ) );
        if ( ! group ) {
            group = { original: Array.from( mesh.normals.slice( i * 3, i * 3 + 3 ) ), vertices: [], sum: [ 0, 0, 0 ], affected: false };
            groups.push( group ); candidates.push( group );
        }
        group.vertices.push( i ); groupOf[ i ] = group;
        if ( affected.has( i ) ) group.affected = true;
    }
    for ( let t = 0; t < mesh.indices.length; t += 3 ) {
        const [ a, b, c ] = Array.from( mesh.indices.slice( t, t + 3 ) );
        const ab = [ 0, 1, 2 ].map( k => positions[ b * 3 + k ] - positions[ a * 3 + k ] );
        const ac = [ 0, 1, 2 ].map( k => positions[ c * 3 + k ] - positions[ a * 3 + k ] );
        const face = [ ab[ 1 ] * ac[ 2 ] - ab[ 2 ] * ac[ 1 ], ab[ 2 ] * ac[ 0 ] - ab[ 0 ] * ac[ 2 ], ab[ 0 ] * ac[ 1 ] - ab[ 1 ] * ac[ 0 ] ];
        for ( const i of [ a, b, c ] ) for ( let k = 0; k < 3; k ++ ) groupOf[ i ].sum[ k ] += face[ k ];
    }
    const normals = Float32Array.from( mesh.normals );
    for ( const group of groups ) if ( group.affected ) {
        const length = Math.hypot( ...group.sum );
        assert.ok( length > 1e-12, 'Degenerate changed smoothing group' );
        for ( const i of group.vertices ) for ( let k = 0; k < 3; k ++ ) normals[ i * 3 + k ] = group.sum[ k ] / length;
    }
    return normals;
}

function writeAttribute( glb, index, values ) {
    const accessor = glb.json.accessors[ index ], view = glb.json.bufferViews[ accessor.bufferView ];
    assert.equal( accessor.componentType, 5126 ); assert.equal( accessor.type, 'VEC3' );
    assert.ok( ! accessor.sparse, 'Expected a dense attribute' );
    const stride = view.byteStride ?? 12, base = ( view.byteOffset ?? 0 ) + ( accessor.byteOffset ?? 0 );
    const min = [ Infinity, Infinity, Infinity ], max = [ -Infinity, -Infinity, -Infinity ];
    for ( let i = 0; i < accessor.count; i ++ ) for ( let k = 0; k < 3; k ++ ) {
        const value = values[ i * 3 + k ]; assert.ok( Number.isFinite( value ) );
        glb.bin.writeFloatLE( value, base + i * stride + k * 4 );
        min[ k ] = Math.min( min[ k ], value ); max[ k ] = Math.max( max[ k ], value );
    }
    if ( accessor.min ) accessor.min = min;
    if ( accessor.max ) accessor.max = max;
}

/** Read exact reference assets, transform in memory, and require the reviewed output digest. */
export function transformCasualTrouserFit( { input = originalCasualTrouser, shoes = shoeFile } = {} ) {
    const cfg = CASUAL_TROUSER_FIT;
    assert.equal( sha( fs.readFileSync( input ) ), cfg.sourceSHA256, 'Unqualified casual source' );
    assert.equal( sha( fs.readFileSync( shoes ) ), cfg.shoesSHA256, 'Unqualified shoe reference' );
    const glb = readGlb( input ), mesh = readPrimitive( glb, cfg.garment ), positions = Float32Array.from( mesh.positions );
    // Ease the ankle/calf radially, leaving the authored hem height intact until the shoe fit.
    for ( let i = 0; i < mesh.vertexCount; i ++ ) {
        const x = mesh.positions[ i * 3 ], y = mesh.positions[ i * 3 + 1 ], z = mesh.positions[ i * 3 + 2 ];
        if ( y >= cfg.transitionHigh ) continue;
        const weight = smooth( ( cfg.transitionHigh - y ) / ( cfg.transitionHigh - cfg.transitionLow ) );
        const cx = Math.sign( x ) * ( cfg.centerXIntercept + cfg.centerXSlope * y ), dx = x - cx, dz = z - cfg.centerZ;
        const radius = Math.hypot( dx / cfg.minimumRadiusX, dz / cfg.minimumRadiusZ );
        const expand = radius > 1e-9 ? Math.max( 1, 1 / radius ) : 1;
        positions[ i * 3 ] = x + dx * ( expand - 1 ) * weight;
        positions[ i * 3 + 2 ] = z + dz * ( expand - 1 ) * weight;
    }
    const cuff = fitCuffHeight( mesh, positions, shoeSurfaces( readPrimitive( readGlb( shoes ), 'shoes01' ) ) );
    const moved = [];
    for ( let i = 0; i < mesh.vertexCount; i ++ ) {
        if ( [ 0, 1, 2 ].some( k => positions[ i * 3 + k ] !== mesh.positions[ i * 3 + k ] ) ) moved.push( i );
    }
    const normals = correctedNormals( mesh, positions, moved );
    const attributes = glb.json.meshes.find( m => m.name === cfg.garment ).primitives[ 0 ].attributes;
    writeAttribute( glb, attributes.POSITION, positions ); writeAttribute( glb, attributes.NORMAL, normals );
    const bytes = encodeGlb( glb ), outputSHA256 = sha( bytes );
    assert.equal( outputSHA256, cfg.outputSHA256, 'Fit no longer reproduces the reviewed asset' );
    return { bytes, report: { id: cfg.id, sourceSHA256: cfg.sourceSHA256, shoesSHA256: cfg.shoesSHA256, outputSHA256, movedVertices: moved.length, cuff } };
}

export function runCasualTrouserFit( { input, shoes, output } = {} ) {
    if ( ! output ) throw new Error( 'An explicit new --output path is required' );
    const result = transformCasualTrouserFit( { input, shoes } );
    fs.writeFileSync( output, result.bytes, { flag: 'wx' } );
    return result.report;
}
if ( process.argv[ 1 ] && path.resolve( process.argv[ 1 ] ) === fileURLToPath( import.meta.url ) ) {
    const args = process.argv.slice( 2 ), options = {};
    if ( args.includes( '--help' ) ) {
        console.log( 'node tools/figure-pipeline/casual_trouser_fit.mjs --output /tmp/casual.glb [--input original.glb] [--shoes reference.glb]\nOnly the reviewed g050 inputs are accepted. Existing outputs are never overwritten.' );
    } else {
        for ( let i = 0; i < args.length; i += 2 ) {
            const name = { '--input': 'input', '--shoes': 'shoes', '--output': 'output' }[ args[ i ] ];
            if ( ! name || ! args[ i + 1 ] || args[ i + 1 ].startsWith( '--' ) || options[ name ] !== undefined ) throw new Error( 'Invalid or duplicate argument: ' + args[ i ] );
            options[ name ] = args[ i + 1 ];
        }
        console.log( JSON.stringify( runCasualTrouserFit( options ), null, 2 ) );
    }
}
