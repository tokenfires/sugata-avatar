#!/usr/bin/env node
/**
 * Calibrated post-export correction for bob02/g050's authored facial wrap.
 *
 * The original rings pass vertex clearance while the triangles joining them cut through the face.
 * This releases the lower curtains into vertical fall without changing the cut, roots or scalp.
 * Calibration is deliberately pinned to one exported geometry and one body. A new bake needs a
 * new measured calibration, not a filename rename. See the figure-pipeline README.
 */
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { BufferAttribute, BufferGeometry } from 'three';
import { readGlb, readPrimitive } from '../lut-bake/glb.mjs';
import { SurfaceGrid } from './hair_geometry.mjs';
import { deriveCardGroom } from '../../packages/core/src/motion/HairDynamics.js';

const STAMP_KEY = 'sugataHairFall';
export const CALIBRATION = Object.freeze( {
    id: 'bob02-g050-curtain-release-v1',
    style: 'bob02', bake: 'figure_g050',
    sourceGeometry: 'd31fe4417aaec4d385dad1cfc5cd5397bc797f7d76e4108548ecc9d8c5a1b1fb',
    bodyGeometry: '644d39473d8d46193914ef046079543730f1eb9e44add93605102aac7c9a8701',
    releaseY: 1.585, transition: 0.025, frontZ: 0.03, sideX: 0.035,
    faceZ: 0.04, inwardExcursion: 0.02,
    clearance: 0.0035, outwardStep: 0.002, outwardLimit: 0.04,
    headCentreZ: 0.03,
    // Exact original layer order: root 78; six long layers 384; separate fringe 34.
    rootCards: 78, fringeStart: 462, cardCount: 496, rings: 17, capVertices: 652
} );

export const sha256 = bytes => createHash( 'sha256' ).update( bytes ).digest( 'hex' );
const bytesOf = array => Buffer.from( array.buffer, array.byteOffset, array.byteLength );
export function geometryFingerprint( primitive ) {
    const hash = createHash( 'sha256' );
    for ( const key of [ 'positions', 'normals', 'uvs', 'indices' ] ) {
        hash.update( key );
        hash.update( bytesOf( key === 'indices'
            ? new Uint32Array( primitive[ key ] ) : new Float32Array( primitive[ key ] ) ) );
    }
    return hash.digest( 'hex' );
}
const point = ( array, index ) => Array.from( array.slice( index * 3, index * 3 + 3 ) );
const subtract = ( a, b ) => a.map( ( value, axis ) => value - b[ axis ] );
const interpolate = ( a, b, weight ) => a.map( ( value, axis ) => value * ( 1 - weight ) + b[ axis ] * weight );
const length = value => Math.hypot( ...value );
const unit = value => value.map( component => component / ( length( value ) || 1 ) );
const smooth = fraction => { const t = Math.max( 0, Math.min( 1, fraction ) ); return t * t * ( 3 - 2 * t ); };
const percentile = ( values, q ) => [ ...values ].sort( ( a, b ) => a - b )[ Math.floor( ( values.length - 1 ) * q ) ] ?? null;
function geometryOf( primitive ) {
    const geometry = new BufferGeometry();
    geometry.setAttribute( 'position', new BufferAttribute( new Float32Array( primitive.positions ), 3 ) );
    geometry.setIndex( new BufferAttribute( new Uint32Array( primitive.indices ), 1 ) );
    return geometry;
}

/** Recompute changed surfaces; preserve the untouched cards' authored normals and tangent values. */
export function updateMovedFrames( geometry, primitive, movedVertices, originalTangents = null ) {
    geometry.computeVertexNormals();
    const normals = new Float32Array( primitive.normals );
    for ( const vertex of movedVertices ) {
        for ( let axis = 0; axis < 3; axis ++ ) normals[ vertex * 3 + axis ] = geometry.attributes.normal.array[ vertex * 3 + axis ];
    }
    geometry.setAttribute( 'normal', new BufferAttribute( normals, 3 ) );
    let tangents = null;
    if ( originalTangents !== null ) {
        geometry.setAttribute( 'uv', new BufferAttribute( new Float32Array( primitive.uvs ), 2 ) );
        geometry.computeTangents();
        tangents = new Float32Array( originalTangents );
        for ( const vertex of movedVertices ) {
            for ( let axis = 0; axis < 4; axis ++ ) tangents[ vertex * 4 + axis ] = geometry.attributes.tangent.array[ vertex * 4 + axis ];
        }
    }
    return { normals, tangents };
}

function accessorFloats( glb, index ) {
    const accessor = glb.json.accessors[ index ];
    if ( accessor.componentType !== 5126 || accessor.sparse ) throw new Error( 'Hair fall requires dense floating point geometry attributes.' );
    const components = { VEC3: 3, VEC4: 4 }[ accessor.type ];
    if ( ! components ) throw new Error( `Unsupported geometric accessor ${ accessor.type }.` );
    const view = glb.json.bufferViews[ accessor.bufferView ];
    const base = ( view.byteOffset ?? 0 ) + ( accessor.byteOffset ?? 0 );
    const stride = view.byteStride ?? components * 4;
    return { accessor, components, base, stride };
}
function readFloats( glb, index ) {
    const { accessor, components, base, stride } = accessorFloats( glb, index );
    const values = new Float32Array( accessor.count * components );
    for ( let vertex = 0; vertex < accessor.count; vertex ++ ) {
        for ( let axis = 0; axis < components; axis ++ ) values[ vertex * components + axis ] = glb.bin.readFloatLE( base + vertex * stride + axis * 4 );
    }
    return values;
}
function writeFloats( glb, index, values ) {
    const { accessor, components, base, stride } = accessorFloats( glb, index );
    const min = Array( components ).fill( Infinity ), max = Array( components ).fill( - Infinity );
    for ( let vertex = 0; vertex < accessor.count; vertex ++ ) {
        for ( let axis = 0; axis < components; axis ++ ) {
            const value = values[ vertex * components + axis ];
            if ( ! Number.isFinite( value ) ) throw new Error( 'Hair fall produced a non-finite attribute.' );
            glb.bin.writeFloatLE( value, base + vertex * stride + axis * 4 );
            min[ axis ] = Math.min( min[ axis ], value ); max[ axis ] = Math.max( max[ axis ], value );
        }
    }
    if ( accessor.min ) accessor.min = min;
    if ( accessor.max ) accessor.max = max;
}
export function encodeGlb( glb ) {
    const raw = Buffer.from( JSON.stringify( glb.json ) );
    const json = Buffer.concat( [ raw, Buffer.alloc( ( 4 - raw.length % 4 ) % 4, 0x20 ) ] );
    const bin = Buffer.concat( [ glb.bin, Buffer.alloc( ( 4 - glb.bin.length % 4 ) % 4 ) ] );
    const result = Buffer.alloc( 12 + 8 + json.length + 8 + bin.length );
    result.writeUInt32LE( 0x46546c67, 0 ); result.writeUInt32LE( 2, 4 ); result.writeUInt32LE( result.length, 8 );
    result.writeUInt32LE( json.length, 12 ); result.writeUInt32LE( 0x4e4f534a, 16 ); json.copy( result, 20 );
    const offset = 20 + json.length;
    result.writeUInt32LE( bin.length, offset ); result.writeUInt32LE( 0x004e4942, offset + 4 ); bin.copy( result, offset + 8 );
    return result;
}

/** Read-only transformation. The CLI is the only function that writes files. */
export function transformHairFall( inputFile, bodyFile ) {
    const sourceBytes = fs.readFileSync( inputFile );
    const glb = readGlb( inputFile ), body = readPrimitive( readGlb( bodyFile ), 'base.001' );
    const primitive = readPrimitive( glb, 'hair_bob02' );
    const sourceGeometry = geometryFingerprint( primitive ), bodyGeometry = geometryFingerprint( body );
    if ( bodyGeometry !== CALIBRATION.bodyGeometry ) throw new Error( 'Body geometry does not match the calibrated figure_g050 bake. Other identities require their own calibration.' );
    const stamp = glb.json.asset?.extras?.[ STAMP_KEY ];
    if ( stamp !== undefined ) {
        if ( stamp.calibration !== CALIBRATION.id || stamp.bodyGeometry !== bodyGeometry
            || stamp.outputGeometry !== sourceGeometry || stamp.sourceGeometry !== CALIBRATION.sourceGeometry ) {
            throw new Error( 'Hair fall stamp is unknown or its geometry changed. Refusing to apply a second deformation.' );
        }
        return { bytes: sourceBytes, report: { calibration: CALIBRATION.id, alreadyApplied: true,
            inputSha256: sha256( sourceBytes ), outputSha256: sha256( sourceBytes ), stamp } };
    }
    if ( sourceGeometry !== CALIBRATION.sourceGeometry ) throw new Error( 'Input geometry does not match the original bob02/g050 calibration. Refusing an unmeasured deformation.' );

    const geometry = geometryOf( primitive ), groom = deriveCardGroom( geometry );
    if ( groom.chainCount !== CALIBRATION.cardCount || groom.pointsPerChain !== CALIBRATION.rings
        || groom.cardVertexBase !== CALIBRATION.capVertices ) throw new Error( 'Calibrated layer topology changed.' );
    const surface = new SurfaceGrid( body.positions, body.normals, body.indices );
    const selections = [], movedVertices = [];
    const c = CALIBRATION;
    for ( let card = c.rootCards; card < c.fringeStart; card ++ ) {
        const points = Array.from( { length: c.rings }, ( _, ring ) => point( groom.restCentres, card * c.rings + ring ) );
        if ( points.at( -1 )[ 1 ] >= c.releaseY - c.transition ) continue;
        let anchor = null;
        if ( points[ 0 ][ 1 ] <= c.releaseY ) anchor = points[ 0 ];
        else for ( let ring = 1; ring < points.length; ring ++ ) {
            if ( points[ ring ][ 1 ] <= c.releaseY && points[ ring - 1 ][ 1 ] > c.releaseY ) {
                anchor = interpolate( points[ ring - 1 ], points[ ring ],
                    ( points[ ring - 1 ][ 1 ] - c.releaseY ) / ( points[ ring - 1 ][ 1 ] - points[ ring ][ 1 ] ) );
                break;
            }
        }
        if ( anchor === null ) continue;
        const reentersFace = points.some( p => p[ 1 ] < c.releaseY - c.transition && p[ 2 ] > c.faceZ
            && ( anchor[ 0 ] * p[ 0 ] < 0 || Math.abs( p[ 0 ] ) < Math.abs( anchor[ 0 ] ) - c.inwardExcursion ) );
        if ( ( anchor[ 2 ] < c.frontZ || Math.abs( anchor[ 0 ] ) < c.sideX ) && ! reentersFace ) continue;
        const radial = unit( [ anchor[ 0 ], 0, anchor[ 2 ] - c.headCentreZ ] );
        const candidateAt = push => points.map( ( old, ring ) => {
            // The highest edge owns the transition: every vertex above the release plane stays fixed.
            const halfY = Math.abs( groom.restOffsets[ ( card * c.rings + ring ) * 3 + 1 ] );
            const t = smooth( ( anchor[ 1 ] - old[ 1 ] - halfY ) / c.transition );
            return [ old[ 0 ] * ( 1 - t ) + ( anchor[ 0 ] + radial[ 0 ] * push ) * t,
                old[ 1 ], old[ 2 ] * ( 1 - t ) + ( anchor[ 2 ] + radial[ 2 ] * push ) * t ];
        } );
        const clearanceOf = centres => {
            let minimum = Infinity;
            const rings = centres.map( ( centre, ring ) => {
                const offset = point( groom.restOffsets, card * c.rings + ring );
                return [ centre.map( ( value, axis ) => value - offset[ axis ] ),
                    centre.map( ( value, axis ) => value + offset[ axis ] ) ];
            } );
            for ( let ring = 1; ring < c.rings; ring ++ ) {
                if ( Math.min( ...rings[ ring - 1 ].map( p => p[ 1 ] ), ...rings[ ring ].map( p => p[ 1 ] ) ) > c.releaseY ) continue;
                for ( const p of [ ...rings[ ring - 1 ], ...rings[ ring ] ] ) minimum = Math.min( minimum, surface.nearest( p )?.signed ?? Infinity );
                for ( let along = 1; along <= 3; along ++ ) for ( let across = 0; across <= 4; across ++ ) {
                    const p = interpolate( interpolate( ...rings[ ring - 1 ], across / 4 ),
                        interpolate( ...rings[ ring ], across / 4 ), along / 4 );
                    minimum = Math.min( minimum, surface.nearest( p )?.signed ?? Infinity );
                }
            }
            return minimum;
        };
        let push = 0, clearance = clearanceOf( candidateAt( push ) );
        while ( clearance < c.clearance && push < c.outwardLimit ) {
            push += c.outwardStep;
            clearance = clearanceOf( candidateAt( push ) );
        }
        if ( clearance < c.clearance ) throw new Error( `Card ${ card } cannot clear the body inside the calibrated outward bound. No output written.` );
        const centres = candidateAt( push );
        let maxMove = 0;
        for ( let ring = 0; ring < c.rings; ring ++ ) {
            const delta = subtract( centres[ ring ], points[ ring ] ); maxMove = Math.max( maxMove, length( delta ) );
            for ( let side = 0; side < 2; side ++ ) {
                const vertex = groom.cardVertexBase + ( card * c.rings + ring ) * 2 + side;
                for ( let axis = 0; axis < 3; axis ++ ) geometry.attributes.position.array[ vertex * 3 + axis ] += delta[ axis ];
            }
        }
        if ( maxMove > 1e-9 ) {
            selections.push( { card, anchor, outwardPushMm: push * 1000, clearanceMm: clearance * 1000 } );
            for ( let vertex = groom.cardVertexBase + card * c.rings * 2; vertex < groom.cardVertexBase + ( card + 1 ) * c.rings * 2; vertex ++ ) movedVertices.push( vertex );
        }
    }
    const changed = deriveCardGroom( geometry );
    const changes = selections.map( ( { card } ) => ( changed.arcLengths[ card ] - groom.arcLengths[ card ] ) * 1000 );
    // v2's largest measured growth is 0.00948 mm; larger changes need new validation.
    if ( Math.max( ...changes ) > 0.02 ) throw new Error( 'Hair fall unexpectedly lengthened a guide by over 0.02 mm.' );
    const attributes = glb.json.meshes.find( mesh => mesh.name === 'hair_bob02' ).primitives[ 0 ].attributes;
    const frames = updateMovedFrames( geometry, primitive, movedVertices,
        attributes.TANGENT === undefined ? null : readFloats( glb, attributes.TANGENT ) );
    writeFloats( glb, attributes.POSITION, geometry.attributes.position.array );
    writeFloats( glb, attributes.NORMAL, frames.normals );
    if ( frames.tangents !== null ) writeFloats( glb, attributes.TANGENT, frames.tangents );
    const outputGeometry = geometryFingerprint( readPrimitive( glb, 'hair_bob02' ) );
    glb.json.asset.extras = { ...glb.json.asset.extras, [ STAMP_KEY ]: {
        calibration: c.id, sourceGeometry, bodyGeometry, outputGeometry,
        inputSha256: sha256( sourceBytes ), correctedCards: selections.length
    } };
    const bytes = encodeGlb( glb );
    return { bytes, report: { calibration: c, alreadyApplied: false,
        inputSha256: sha256( sourceBytes ), outputSha256: sha256( bytes ), outputGeometry,
        correctedCards: selections.length, selections,
        arcLengthChangeMm: { p50: percentile( changes, .5 ), min: Math.min( ...changes ), max: Math.max( ...changes ) },
        limits: 'Body-clearance sampling guides the correction; it is not an exact triangle-intersection or runtime collision certificate. Validate the output with the geometric and runtime probes.'
    } };
}

function aliases( a, b ) {
    if ( path.resolve( a ) === path.resolve( b ) ) return true;
    if ( fs.existsSync( a ) && fs.existsSync( b ) ) {
        const sa = fs.statSync( a ), sb = fs.statSync( b );
        return sa.dev === sb.dev && sa.ino === sb.ino;
    }
    return false;
}
export function validatePaths( { input, body, output, report, allowInPlace = false } ) {
    if ( aliases( output, body ) ) throw new Error( 'Output must never overwrite the body.' );
    if ( aliases( input, output ) && ! allowInPlace ) throw new Error( 'In-place mutation refused. Use a separate --output, or explicitly pass --allow-in-place.' );
    if ( report && [ input, body, output ].some( file => aliases( file, report ) ) ) throw new Error( 'Report path must be separate from the input, body and output assets.' );
}
function writeAtomic( destination, bytes ) {
    fs.mkdirSync( path.dirname( destination ), { recursive: true } );
    const temporary = `${ destination }.hair-fall-${ process.pid }.tmp`;
    try { fs.writeFileSync( temporary, bytes, { flag: 'wx' } ); fs.renameSync( temporary, destination ); }
    finally { if ( fs.existsSync( temporary ) ) fs.unlinkSync( temporary ); }
}
export function runHairFall( options ) {
    validatePaths( options );
    const result = transformHairFall( options.input, options.body );
    writeAtomic( options.output, result.bytes );
    if ( options.report ) writeAtomic( options.report, `${ JSON.stringify( result.report, null, 2 ) }\n` );
    return result.report;
}
function parseArgs( args ) {
    const options = {};
    for ( let i = 0; i < args.length; i ++ ) {
        const flag = args[ i ];
        if ( flag === '--help' ) return null;
        if ( flag === '--allow-in-place' ) { options.allowInPlace = true; continue; }
        if ( ! [ '--input', '--body', '--output', '--report' ].includes( flag ) ) throw new Error( `Unknown argument ${ flag }.` );
        if ( ! args[ i + 1 ] || args[ i + 1 ].startsWith( '--' ) ) throw new Error( `${ flag } requires a path.` );
        options[ flag.slice( 2 ) ] = path.resolve( args[ ++ i ] );
    }
    for ( const key of [ 'input', 'body', 'output' ] ) if ( ! options[ key ] ) throw new Error( `--${ key } is required.` );
    return options;
}
if ( process.argv[ 1 ] && path.resolve( process.argv[ 1 ] ) === fileURLToPath( import.meta.url ) ) {
    try {
        const options = parseArgs( process.argv.slice( 2 ) );
        if ( options === null ) console.log( 'node tools/figure-pipeline/hair_fall.mjs --input original-bob02-g050.glb --body figure_g050.glb --output corrected.glb [--report report.json] [--allow-in-place]' );
        else { const report = runHairFall( options ); console.log( `${ report.alreadyApplied ? 'Already corrected' : `Corrected ${ report.correctedCards } cards` }: ${ options.output }\nsha256 ${ report.outputSha256 }` ); }
    } catch ( error ) { console.error( `hair_fall: ${ error.message }` ); process.exitCode = 1; }
}
