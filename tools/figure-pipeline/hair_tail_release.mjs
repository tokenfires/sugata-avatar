#!/usr/bin/env node
/** Calibrated third stage for bob02/g050, after fall and hem.
 * Held roll directions exposed finite ribbon edges crossing the face while their simulated
 * centers remained outside; a mirrored nod also exposed a long terminal triangle interior. This small authored tail margin preserves solver tuning and width.
 * The twelve-card mask is measured on one immutable groom, not a generic collision algorithm.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { BufferAttribute, BufferGeometry } from 'three';
import { readAccessor, readGlb, readPrimitive } from '../lut-bake/glb.mjs';
import { SurfaceGrid } from './hair_geometry.mjs';
import { measureHairSurface } from './hair_surface.mjs';
import { CALIBRATION as FALL, encodeGlb, geometryFingerprint, sha256, updateMovedFrames, validatePaths } from './hair_fall.mjs';
import { HEM_CALIBRATION as HEM } from './hair_hem.mjs';
import { deriveCardGroom } from '../../packages/core/src/motion/HairDynamics.js';

const STAMP_KEY = 'sugataHairTailRelease';
export const TAIL_RELEASE_CALIBRATION = Object.freeze( {
    id: 'bob02-g050-tail-clearance-v1', style: 'bob02', bake: 'figure_g050',
    hemCalibration: HEM.id,
    sourceGeometry: 'e7fba6a998fedbe1c3778c4be48b08100bf3899134dad8737c00d1829c85e482',
    outputGeometry: '390f9d1ded1098239ac88aacc7a1b3791edfc81a9ed99f5fc5954bde6d5d56ce',
    bodyGeometry: '644d39473d8d46193914ef046079543730f1eb9e44add93605102aac7c9a8701',
    // Union of full-triangle contacts over held rolls and mirrored nod. Card196 is a long
    // underlayer curtain; card352 is a long triangle with clear corners. Static edge or
    // root-only selection would miss these cases.
    cards: Object.freeze( [ 6, 14, 15, 22, 29, 42, 45, 53, 69, 75, 196, 352 ] ),
    startRing: 12, endRing: 16, displacement: 0.0035,
    cardCount: 496, rings: 17, capVertices: 652
} );
const point = ( values, index ) => Array.from( values.slice( index * 3, index * 3 + 3 ) );
const smooth = t => { t = Math.max( 0, Math.min( 1, t ) ); return t * t * ( 3 - 2 * t ); };
const median = values => [ ...values ].sort( ( a, b ) => a - b )[ Math.floor( values.length / 2 ) ];
const compliance = ( arc, medianArc ) => Math.min( 3, Math.max( 0.3, medianArc / arc ) );
function attributesOf( glb ) { return glb.json.meshes.find( mesh => mesh.name === 'hair_bob02' ).primitives[ 0 ].attributes; }
function tangentHash( glb ) {
    const index = attributesOf( glb ).TANGENT;
    return index === undefined ? null : sha256( Buffer.from( new Float32Array( readAccessor( glb, index ).data ).buffer ) );
}
function writeAttribute( glb, index, values, components ) {
    const accessor = glb.json.accessors[ index ];
    if ( accessor.componentType !== 5126 || accessor.sparse || accessor.type !== `VEC${ components }`
        || values.length !== accessor.count * components ) throw new Error( 'Tail release needs dense floating point geometry attributes.' );
    const view = glb.json.bufferViews[ accessor.bufferView ];
    const base = ( view.byteOffset ?? 0 ) + ( accessor.byteOffset ?? 0 ), stride = view.byteStride ?? components * 4;
    const min = Array( components ).fill( Infinity ), max = Array( components ).fill( - Infinity );
    for ( let vertex = 0; vertex < accessor.count; vertex ++ ) for ( let axis = 0; axis < components; axis ++ ) {
        const value = values[ vertex * components + axis ];
        if ( ! Number.isFinite( value ) ) throw new Error( 'Tail release produced a non-finite attribute.' );
        glb.bin.writeFloatLE( value, base + vertex * stride + axis * 4 );
        min[ axis ] = Math.min( min[ axis ], value ); max[ axis ] = Math.max( max[ axis ], value );
    }
    if ( accessor.min ) accessor.min = min;
    if ( accessor.max ) accessor.max = max;
}
function validateHemStamp( glb, currentHem ) {
    const stamp = glb.json.asset?.extras?.sugataHairHem, c = TAIL_RELEASE_CALIBRATION;
    if ( ! stamp || stamp.calibration !== c.hemCalibration || stamp.sourceGeometry !== HEM.sourceGeometry
        || stamp.outputGeometry !== c.sourceGeometry || stamp.bodyGeometry !== c.bodyGeometry ) {
        throw new Error( 'Tail release requires the calibrated, stamped bob02/g050 hem stage first.' );
    }
    if ( currentHem && stamp.outputTangentSha256 !== tangentHash( glb ) ) throw new Error( 'Hem tangent output changed before tail release.' );
    // The hem stamp cannot stand in for a missing or replaced first-stage history.
    const fall = glb.json.asset?.extras?.sugataHairFall;
    if ( ! fall || fall.calibration !== HEM.fallCalibration || fall.sourceGeometry !== FALL.sourceGeometry || fall.outputGeometry !== HEM.sourceGeometry
        || fall.bodyGeometry !== c.bodyGeometry ) throw new Error( 'Tail release requires its calibrated fall-stage history.' );
}
function faceGate( primitive, body ) {
    const surface = measureHairSurface( primitive, body );
    if ( surface.face.pairs !== 0 ) throw new Error( `Tail release rejected: ${ surface.face.pairs } face-region triangle intersections.` );
    return surface;
}

/** Read-only: returns bytes/report and leaves both files unchanged. */
export function transformHairTailRelease( inputFile, bodyFile ) {
    const bytes = fs.readFileSync( inputFile ), glb = readGlb( inputFile );
    const original = readPrimitive( glb, 'hair_bob02' ), body = readPrimitive( readGlb( bodyFile ), 'base.001' );
    const c = TAIL_RELEASE_CALIBRATION, inputGeometry = geometryFingerprint( original );
    if ( geometryFingerprint( body ) !== c.bodyGeometry ) throw new Error( 'Body does not match calibrated figure_g050 geometry. A new bake needs a new calibration.' );
    const existing = glb.json.asset?.extras?.[ STAMP_KEY ];
    validateHemStamp( glb, existing === undefined );
    if ( existing !== undefined ) {
        if ( ! existing || existing.calibration !== c.id || existing.sourceGeometry !== c.sourceGeometry
            || existing.outputGeometry !== c.outputGeometry || existing.bodyGeometry !== c.bodyGeometry
            || inputGeometry !== c.outputGeometry || existing.outputTangentSha256 !== tangentHash( glb ) ) {
            throw new Error( 'Tail-release stamp is unknown or its corrected geometry changed. Refusing a second deformation.' );
        }
        const surface = faceGate( original, body );
        return { bytes, report: { calibration: c.id, alreadyApplied: true,
            inputSha256: sha256( bytes ), outputSha256: sha256( bytes ), stamp: existing, surface } };
    }
    if ( inputGeometry !== c.sourceGeometry ) throw new Error( 'Input is not the calibrated hem-corrected bob02/g050 geometry.' );
    const geometry = new BufferGeometry();
    geometry.setAttribute( 'position', new BufferAttribute( new Float32Array( original.positions ), 3 ) );
    geometry.setIndex( new BufferAttribute( new Uint32Array( original.indices ), 1 ) );
    const groom = deriveCardGroom( geometry );
    if ( groom.chainCount !== c.cardCount || groom.pointsPerChain !== c.rings || groom.cardVertexBase !== c.capVertices ) throw new Error( 'Calibrated hair topology changed.' );
    const grid = new SurfaceGrid( body.positions, body.normals, body.indices );
    const movedVertices = [], movedCards = [];
    for ( const card of c.cards ) {
        const tip = point( groom.restCentres, card * c.rings + c.endRing ), closest = grid.nearest( tip ).closest;
        const away = [ tip[ 0 ] - closest[ 0 ], 0, tip[ 2 ] - closest[ 2 ] ];
        const length = Math.hypot( ...away ), direction = away.map( value => value / length );
        if ( ! direction.every( Number.isFinite ) || Math.sign( direction[ 0 ] ) !== Math.sign( tip[ 0 ] ) ) throw new Error( 'Invalid source-body outward direction.' );
        for ( let ring = c.startRing + 1; ring <= c.endRing; ring ++ ) {
            const magnitude = c.displacement * smooth( ( ring - c.startRing ) / ( c.endRing - c.startRing ) );
            for ( let side = 0; side < 2; side ++ ) {
                const vertex = groom.cardVertexBase + ( card * c.rings + ring ) * 2 + side;
                for ( let axis = 0; axis < 3; axis ++ ) geometry.attributes.position.array[ vertex * 3 + axis ] += direction[ axis ] * magnitude;
                movedVertices.push( vertex );
            }
        }
        movedCards.push( { card, direction, sourceTip: tip, sourceClosest: closest } );
    }
    const changed = deriveCardGroom( geometry ), medianBefore = median( groom.arcLengths ), medianAfter = median( changed.arcLengths );
    if ( medianBefore !== medianAfter ) throw new Error( 'Tail release changed the whole-groom compliance reference.' );
    const lengthChanges = c.cards.map( card => ( {
        card, beforeMm: groom.arcLengths[ card ] * 1000, afterMm: changed.arcLengths[ card ] * 1000,
        deltaMm: ( changed.arcLengths[ card ] - groom.arcLengths[ card ] ) * 1000,
        complianceBefore: compliance( groom.arcLengths[ card ], medianBefore ),
        complianceAfter: compliance( changed.arcLengths[ card ], medianAfter ),
        segments: Array.from( { length: c.rings - 1 }, ( _, index ) => ( {
            ring: index + 1, beforeMm: groom.restLengths[ card * c.rings + index + 1 ] * 1000,
            afterMm: changed.restLengths[ card * c.rings + index + 1 ] * 1000
        } ) )
    } ) );
    const attributes = attributesOf( glb );
    const tangents = attributes.TANGENT === undefined ? null : readAccessor( glb, attributes.TANGENT ).data;
    // Preserve the reviewed post-export convention: regenerate moved vertices' frames while
    // retaining authored neighbors, including ring12. This is not a full normal-field rebake.
    const frames = updateMovedFrames( geometry, original, movedVertices, tangents );
    writeAttribute( glb, attributes.POSITION, geometry.attributes.position.array, 3 );
    writeAttribute( glb, attributes.NORMAL, frames.normals, 3 );
    if ( frames.tangents !== null ) writeAttribute( glb, attributes.TANGENT, frames.tangents, 4 );
    const corrected = readPrimitive( glb, 'hair_bob02' ), outputGeometry = geometryFingerprint( corrected );
    if ( outputGeometry !== c.outputGeometry ) throw new Error( 'Tail release did not reproduce the accepted geometry.' );
    const surface = faceGate( corrected, body );
    const stamp = { calibration: c.id, sourceGeometry: c.sourceGeometry, bodyGeometry: c.bodyGeometry,
        outputGeometry, correctedCards: c.cards.length, modifiedVertices: movedVertices.length,
        startRing: c.startRing, endRing: c.endRing, maxDisplacementMm: c.displacement * 1000,
        outputTangentSha256: tangentHash( glb ) };
    glb.json.asset.extras[ STAMP_KEY ] = stamp;
    const output = encodeGlb( glb );
    return { bytes: output, report: { calibration: c.id, alreadyApplied: false,
        inputSha256: sha256( bytes ), outputSha256: sha256( output ), stamp,
        correctedCards: c.cards.length, modifiedVertices: movedVertices.length,
        medianArcMm: medianBefore * 1000, movedCards, lengthChanges, surface } };
}
function writeAtomic( file, data ) {
    fs.mkdirSync( path.dirname( file ), { recursive: true } );
    const temporary = `${ file }.hair-tail-${ process.pid }.tmp`;
    let created = false;
    try { fs.writeFileSync( temporary, data, { flag: 'wx' } ); created = true; fs.renameSync( temporary, file ); }
    finally { if ( created && fs.existsSync( temporary ) ) fs.unlinkSync( temporary ); }
}
export function runHairTailRelease( options ) {
    validatePaths( options );
    const result = transformHairTailRelease( options.input, options.body );
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
        if ( options === null ) console.log( 'node tools/figure-pipeline/hair_tail_release.mjs --input hem-corrected-bob02-g050.glb --body figure_g050.glb --output tail.glb [--report report.json] [--allow-in-place]' );
        else { const report = runHairTailRelease( options ); console.log( `${ report.alreadyApplied ? 'Already corrected' : `Corrected ${ report.correctedCards } cards` }: ${ options.output }\nsha256 ${ report.outputSha256 }` ); }
    } catch ( error ) { console.error( `hair_tail_release: ${ error.message }` ); process.exitCode = 1; }
}
