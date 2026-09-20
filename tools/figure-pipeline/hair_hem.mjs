#!/usr/bin/env node
/**
 * Second post-export stage for bob02/g050, after hair_fall.mjs.
 * Pulls the longest lower-front ends toward the measured chin hem while retaining cut scatter.
 * The fall stamp remains historical evidence of the first stage. This stage has its own stamp,
 * exact source/body calibration and repeat-application guard. It is not a generic haircut tool.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { BufferAttribute, BufferGeometry } from 'three';
import { readAccessor, readGlb, readPrimitive } from '../lut-bake/glb.mjs';
import { CALIBRATION as FALL, encodeGlb, geometryFingerprint, sha256, updateMovedFrames, validatePaths } from './hair_fall.mjs';
import { measureHairSurface } from './hair_surface.mjs';
import { deriveCardGroom } from '../../packages/core/src/motion/HairDynamics.js';

const STAMP_KEY = 'sugataHairHem';
export const HEM_CALIBRATION = Object.freeze( {
    id: 'bob02-g050-front-hem-v1', style: 'bob02', bake: 'figure_g050',
    fallCalibration: 'bob02-g050-curtain-release-v1',
    sourceGeometry: '6dfafa0abcd892d95864bff12f296d72c0f7d04f34df6e225c571cedef665924',
    outputGeometry: 'e7fba6a998fedbe1c3778c4be48b08100bf3899134dad8737c00d1829c85e482',
    bodyGeometry: '644d39473d8d46193914ef046079543730f1eb9e44add93605102aac7c9a8701',
    startY: 1.50, jawY: 1.435, hemY: 1.437, scatterRetention: 0.15,
    frontBeginZ: 0.08, frontFullZ: 0.12,
    firstCard: 78, endCard: 462, cardCount: 496, rings: 17, capVertices: 652
} );
const point = ( values, index ) => Array.from( values.slice( index * 3, index * 3 + 3 ) );
const smooth = fraction => { const t = Math.max( 0, Math.min( 1, fraction ) ); return t * t * ( 3 - 2 * t ); };
const attributeBytes = values => Buffer.from( new Float32Array( values ).buffer );
function attributesOf( glb ) { return glb.json.meshes.find( mesh => mesh.name === 'hair_bob02' ).primitives[ 0 ].attributes; }
function tangentHash( glb ) {
    const index = attributesOf( glb ).TANGENT;
    return index === undefined ? null : sha256( attributeBytes( readAccessor( glb, index ).data ) );
}
function writeAttribute( glb, index, values, components ) {
    const accessor = glb.json.accessors[ index ];
    if ( accessor.componentType !== 5126 || accessor.sparse || accessor.type !== `VEC${ components }`
        || values.length !== accessor.count * components ) throw new Error( 'Hem correction needs dense floating point geometry attributes.' );
    const view = glb.json.bufferViews[ accessor.bufferView ];
    const base = ( view.byteOffset ?? 0 ) + ( accessor.byteOffset ?? 0 ), stride = view.byteStride ?? components * 4;
    const min = Array( components ).fill( Infinity ), max = Array( components ).fill( - Infinity );
    for ( let vertex = 0; vertex < accessor.count; vertex ++ ) for ( let axis = 0; axis < components; axis ++ ) {
        const value = values[ vertex * components + axis ];
        if ( ! Number.isFinite( value ) ) throw new Error( 'Hem correction produced a non-finite attribute.' );
        glb.bin.writeFloatLE( value, base + vertex * stride + axis * 4 );
        min[ axis ] = Math.min( min[ axis ], value ); max[ axis ] = Math.max( max[ axis ], value );
    }
    if ( accessor.min ) accessor.min = min;
    if ( accessor.max ) accessor.max = max;
}
function validateFallStamp( glb ) {
    const stamp = glb.json.asset?.extras?.sugataHairFall, c = HEM_CALIBRATION;
    if ( ! stamp || stamp.calibration !== c.fallCalibration || stamp.sourceGeometry !== FALL.sourceGeometry
        || stamp.bodyGeometry !== c.bodyGeometry || stamp.outputGeometry !== c.sourceGeometry ) {
        throw new Error( 'Hem correction requires the calibrated, stamped bob02/g050 fall stage first.' );
    }
}
function faceGate( primitive, body ) {
    const surface = measureHairSurface( primitive, body );
    if ( surface.face.pairs !== 0 ) throw new Error( `Hem correction rejected: ${ surface.face.pairs } face-region triangle intersections.` );
    return surface;
}

/** Read-only: returns bytes/report, and never changes input or body files. */
export function transformHairHem( inputFile, bodyFile ) {
    const sourceBytes = fs.readFileSync( inputFile ), glb = readGlb( inputFile );
    const primitive = readPrimitive( glb, 'hair_bob02' ), body = readPrimitive( readGlb( bodyFile ), 'base.001' );
    const c = HEM_CALIBRATION, inputGeometry = geometryFingerprint( primitive ), bodyGeometry = geometryFingerprint( body );
    if ( bodyGeometry !== c.bodyGeometry ) throw new Error( 'Body does not match the calibrated figure_g050 geometry. Other bakes require a new calibration.' );
    validateFallStamp( glb );
    const stamp = glb.json.asset.extras[ STAMP_KEY ];
    if ( stamp !== undefined ) {
        if ( ! stamp || stamp.calibration !== c.id || stamp.sourceGeometry !== c.sourceGeometry
            || stamp.bodyGeometry !== c.bodyGeometry || stamp.outputGeometry !== c.outputGeometry
            || inputGeometry !== c.outputGeometry || stamp.outputTangentSha256 !== tangentHash( glb ) ) {
            throw new Error( 'Hem stamp is unknown or its corrected geometry changed. Refusing a second deformation.' );
        }
        const surface = faceGate( primitive, body );
        return { bytes: sourceBytes, report: { calibration: c.id, alreadyApplied: true,
            inputSha256: sha256( sourceBytes ), outputSha256: sha256( sourceBytes ), stamp, surface } };
    }
    if ( inputGeometry !== c.sourceGeometry ) throw new Error( 'Input is not the calibrated fall-corrected bob02/g050 geometry.' );
    const geometry = new BufferGeometry();
    geometry.setAttribute( 'position', new BufferAttribute( new Float32Array( primitive.positions ), 3 ) );
    geometry.setIndex( new BufferAttribute( new Uint32Array( primitive.indices ), 1 ) );
    const groom = deriveCardGroom( geometry );
    if ( groom.chainCount !== c.cardCount || groom.pointsPerChain !== c.rings
        || groom.cardVertexBase !== c.capVertices ) throw new Error( 'Calibrated hair topology changed.' );
    const movedCards = [], movedVertices = [];
    for ( let card = c.firstCard; card < c.endCard; card ++ ) {
        const rings = Array.from( { length: c.rings }, ( _, ring ) => {
            const centre = point( groom.restCentres, card * c.rings + ring );
            const offset = point( groom.restOffsets, card * c.rings + ring );
            return { centre, low: centre[ 1 ] - Math.abs( offset[ 1 ] ), high: centre[ 1 ] + Math.abs( offset[ 1 ] ) };
        } );
        const tip = rings.at( -1 ).centre, minY = Math.min( ...rings.map( ring => ring.low ) );
        if ( minY >= c.hemY || tip[ 2 ] <= c.frontBeginZ ) continue;
        const frontWeight = smooth( ( tip[ 2 ] - c.frontBeginZ ) / ( c.frontFullZ - c.frontBeginZ ) );
        const targetMinY = minY + ( c.hemY - minY ) * ( 1 - c.scatterRetention ) * frontWeight;
        // Move each ring intact; its higher edge owns the transition so everything above
        // startY stays fixed. Solve the amplitude against every low edge, including tilted ends.
        const weights = rings.map( ring => smooth( ( c.startY - ring.high ) / ( c.startY - minY ) ) );
        let amplitude = 0;
        for ( let ring = 0; ring < c.rings; ring ++ ) if ( rings[ ring ].low < targetMinY ) {
            amplitude = Math.max( amplitude, ( targetMinY - rings[ ring ].low ) / weights[ ring ] );
        }
        if ( ! Number.isFinite( amplitude ) ) throw new Error( 'Invalid lower-span hem deformation.' );
        let maxMove = 0;
        for ( let ring = 0; ring < c.rings; ring ++ ) for ( let side = 0; side < 2; side ++ ) {
            const vertex = groom.cardVertexBase + ( card * c.rings + ring ) * 2 + side;
            const dy = amplitude * weights[ ring ];
            geometry.attributes.position.array[ vertex * 3 + 1 ] += dy;
            maxMove = Math.max( maxMove, dy ); movedVertices.push( vertex );
        }
        movedCards.push( { card, tip, minY, targetMinY, maxMoveMm: maxMove * 1000, frontWeight } );
    }
    const changed = deriveCardGroom( geometry );
    const lengthChanges = movedCards.map( ( { card } ) => ( {
        card, beforeMm: groom.arcLengths[ card ] * 1000, afterMm: changed.arcLengths[ card ] * 1000,
        deltaMm: ( changed.arcLengths[ card ] - groom.arcLengths[ card ] ) * 1000
    } ) );
    if ( lengthChanges.some( change => change.deltaMm > 0.0001 ) ) throw new Error( 'Hem correction unexpectedly lengthened a guide.' );
    const attributes = attributesOf( glb );
    const tangents = attributes.TANGENT === undefined ? null : readAccessor( glb, attributes.TANGENT ).data;
    const frames = updateMovedFrames( geometry, primitive, movedVertices, tangents );
    writeAttribute( glb, attributes.POSITION, geometry.attributes.position.array, 3 );
    writeAttribute( glb, attributes.NORMAL, frames.normals, 3 );
    if ( frames.tangents !== null ) writeAttribute( glb, attributes.TANGENT, frames.tangents, 4 );
    const corrected = readPrimitive( glb, 'hair_bob02' ), outputGeometry = geometryFingerprint( corrected );
    if ( outputGeometry !== c.outputGeometry ) throw new Error( 'Hem output differs from the validated geometry; review the calibration before producing an asset.' );
    const surface = faceGate( corrected, body );
    glb.json.asset.extras[ STAMP_KEY ] = {
        calibration: c.id, sourceGeometry: c.sourceGeometry, bodyGeometry, outputGeometry,
        outputTangentSha256: tangentHash( glb ), inputSha256: sha256( sourceBytes ), correctedCards: movedCards.length
    };
    const bytes = encodeGlb( glb );
    return { bytes, report: { calibration: c, alreadyApplied: false, inputSha256: sha256( sourceBytes ),
        outputSha256: sha256( bytes ), outputGeometry, correctedCards: movedCards.length, movedCards, lengthChanges, surface,
        limits: 'The exact triangle face-region gate excludes scalp contacts behind the region. No shell crossings does not establish positive clearance everywhere. Validate motion and matched renders before installing an asset.' } };
}
function writeAtomic( destination, bytes ) {
    fs.mkdirSync( path.dirname( destination ), { recursive: true } );
    const temporary = `${ destination }.hair-hem-${ process.pid }.tmp`;
    try { fs.writeFileSync( temporary, bytes, { flag: 'wx' } ); fs.renameSync( temporary, destination ); }
    finally { if ( fs.existsSync( temporary ) ) fs.unlinkSync( temporary ); }
}
export function runHairHem( options ) {
    validatePaths( options );
    const result = transformHairHem( options.input, options.body );
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
        if ( options === null ) console.log( 'node tools/figure-pipeline/hair_hem.mjs --input fall-corrected-bob02-g050.glb --body figure_g050.glb --output hem.glb [--report report.json] [--allow-in-place]' );
        else { const report = runHairHem( options ); console.log( `${ report.alreadyApplied ? 'Already corrected' : `Corrected ${ report.correctedCards } cards` }: ${ options.output }\nsha256 ${ report.outputSha256 }` ); }
    } catch ( error ) { console.error( `hair_hem: ${ error.message }` ); process.exitCode = 1; }
}
