#!/usr/bin/env node
/** Apply the reviewed g050 coverage calibration; never regenerate masks from unknown geometry. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash, randomUUID } from 'node:crypto';
import { gunzipSync } from 'node:zlib';
import { readAccessor } from '../lut-bake/glb.mjs';

export const WARDROBE_MASK_DATA_SHA256 = '13170c7dc4d3561c02b84d9ef38c10260e3e5c3a21670872b9986d44ea523c02';
const fixtureDirectory = fileURLToPath( new URL( './fixtures/', import.meta.url ) );
const wardrobeDirectory = fileURLToPath( new URL( '../../assets/wardrobe/', import.meta.url ) );
export const sha256 = bytes => createHash( 'sha256' ).update( bytes ).digest( 'hex' );
const dataBytes = fs.readFileSync( path.join( fixtureDirectory, 'wardrobe-g050-under-masks-v1.json' ) );
if ( sha256( dataBytes ) !== WARDROBE_MASK_DATA_SHA256 ) throw new Error( 'Wardrobe mask calibration digest mismatch' );
const freeze = value => {
    if ( value && typeof value === 'object' ) { Object.values( value ).forEach( freeze ); Object.freeze( value ); }
    return value;
};
export const WARDROBE_MASK_CALIBRATION = freeze( JSON.parse( dataBytes ) );

function entryFor( garmentId, bake ) {
    if ( bake !== 'g050' ) throw new Error( 'Wardrobe mask calibration supports only g050' );
    const entry = WARDROBE_MASK_CALIBRATION.garments.find( entry => entry.id === garmentId );
    if ( ! entry ) throw new Error( `Uncalibrated foundation garment: ${ garmentId }` );
    return entry;
}

export function originalWardrobeFoundation( garmentId, bake = 'g050' ) {
    const entry = entryFor( garmentId, bake );
    const fixture = WARDROBE_MASK_CALIBRATION.fixture;
    const bytes = fs.readFileSync( path.join( fixtureDirectory, fixture.file ) );
    if ( sha256( bytes ) !== fixture.sha256 ) throw new Error( 'Foundation fixture digest mismatch' );
    const bundle = JSON.parse( gunzipSync( bytes ) );
    if ( bundle.schema !== 'sugata-foundation-originals-v1' || bundle.bake !== bake ) throw new Error( 'Invalid foundation fixture schema' );
    const original = Buffer.from( bundle.garments[ garmentId ].glbBase64, 'base64' );
    if ( sha256( original ) !== entry.sourceSha256 ) throw new Error( 'Original foundation digest mismatch' );
    return original;
}

// Two distinct reviewed proofs; the calibration payload and foundation masks remain frozen.
// 44eb: the trouser correction passes all 23,310 authored/historical-pose footprint checks
// using unchanged cloth triangles alone. See docs/WARDROBE-TROUSER-FIT-2026-09-13.md.
// d81a: the collar interior asset has exactly the ca6531 reviewed outward geometry, plus
// interior-selection metadata. Its FULL geometry passes all 23,310 frozen footprint checks.
// Removing its 180 changed-incident triangles fails 3,669 bra and 3,967 vest footprints;
// the earlier unchanged-subset shortcut does not apply. This is coverage, not an all-motion
// clearance certificate. See docs/evidence/collar-interior-2026-09-16-numerical.json.
export const WARDROBE_MASK_ENVIRONMENT_SUCCESSORS = Object.freeze( {
    female_casualsuit01: Object.freeze( [
        '44ebc3eb3a09408a3563d369ae74be15a5bc4beb8040bc43c2c5446d6e65c783',
        'd81a6730bde9d8fee4641e18d6f9f0e3922af420bb68eea3f44b661896aeec3a'
    ] )
} );

/** Exact original or explicitly reviewed successor fingerprints are mandatory. */
export function validateWardrobeMaskEnvironment( environment = null ) {
    const expected = { body: WARDROBE_MASK_CALIBRATION.bodySha256, ...WARDROBE_MASK_CALIBRATION.outerGarments };
    for ( const [ id, digest ] of Object.entries( expected ) ) {
        const bytes = environment === null ? fs.readFileSync( path.join( wardrobeDirectory, id, 'g050.glb' ) ) : environment[ id ];
        const allowed = [ digest, ...( WARDROBE_MASK_ENVIRONMENT_SUCCESSORS[ id ] ?? [] ) ];
        if ( ! bytes || ! allowed.includes( sha256( bytes ) ) ) throw new Error( `Wardrobe mask environment digest mismatch: ${ id }` );
    }
}

function decodeGlb( bytes ) {
    if ( bytes.length < 28 || bytes.readUInt32LE( 0 ) !== 0x46546c67 || bytes.readUInt32LE( 4 ) !== 2 || bytes.readUInt32LE( 8 ) !== bytes.length ) throw new Error( 'Invalid GLB header' );
    let json = null, bin = null, binOffset = null;
    for ( let offset = 12; offset < bytes.length; ) {
        const length = bytes.readUInt32LE( offset ), type = bytes.readUInt32LE( offset + 4 );
        if ( offset + 8 + length > bytes.length ) throw new Error( 'Invalid GLB chunk' );
        const data = bytes.subarray( offset + 8, offset + 8 + length );
        if ( type === 0x4e4f534a ) json = JSON.parse( data.toString( 'utf8' ).trim() );
        if ( type === 0x004e4942 ) { bin = Buffer.from( data ); binOffset = offset + 8; }
        offset += 8 + length;
    }
    if ( ! json || ! bin ) throw new Error( 'Missing GLB JSON or BIN chunk' );
    return { json, bin, binOffset };
}

/** Pure payload transform. Frozen selections include every collateral any-corner triangle. */
export function transformWardrobeUnderMasks( input, { garmentId, bake = 'g050', environment = null } = {} ) {
    const entry = entryFor( garmentId, bake );
    validateWardrobeMaskEnvironment( environment );
    const bytes = Buffer.from( input );
    const inputSha256 = sha256( bytes );
    if ( inputSha256 === entry.outputSha256 ) return { bytes, report: { calibration: WARDROBE_MASK_CALIBRATION.id, garmentId, bake, inputSha256, outputSha256: inputSha256, alreadyApplied: true } };
    if ( inputSha256 !== entry.sourceSha256 ) throw new Error( `Foundation source digest mismatch: ${ garmentId }` );
    const glb = decodeGlb( bytes );
    const primitive = glb.json.meshes.find( mesh => mesh.name === garmentId )?.primitives?.[ 0 ];
    if ( ! primitive ) throw new Error( 'Missing calibrated foundation primitive' );
    const indices = readAccessor( glb, primitive.indices ).data;
    const before = Buffer.from( glb.bin ), allowedBytes = new Set(), fields = [];
    for ( const field of entry.fields ) {
        const accessor = glb.json.accessors[ primitive.attributes[ field.name ] ];
        if ( ! accessor || accessor.type !== 'SCALAR' || accessor.componentType !== 5126 || accessor.sparse ) throw new Error( 'Expected a dense Float32 mask' );
        const view = glb.json.bufferViews[ accessor.bufferView ];
        const stride = view.byteStride ?? 4, base = ( view.byteOffset ?? 0 ) + ( accessor.byteOffset ?? 0 );
        const original = Array.from( readAccessor( glb, primitive.attributes[ field.name ] ).data );
        const modified = [ ...original ];
        for ( const vertex of field.vertices ) {
            if ( ! Number.isInteger( vertex ) || vertex < 0 || vertex >= accessor.count || original[ vertex ] > 0.5 ) throw new Error( 'Invalid calibrated additional mask vertex' );
            modified[ vertex ] = 1;
            glb.bin.writeFloatLE( 1, base + vertex * stride );
            for ( let byte = 0; byte < 4; byte ++ ) allowedBytes.add( base + vertex * stride + byte );
        }
        const additionallyHiddenTriangles = [];
        for ( let offset = 0; offset < indices.length; offset += 3 ) {
            const vertices = Array.from( indices.slice( offset, offset + 3 ) );
            if ( ! vertices.some( vertex => original[ vertex ] > 0.5 ) && vertices.some( vertex => modified[ vertex ] > 0.5 ) ) additionallyHiddenTriangles.push( offset / 3 );
        }
        if ( JSON.stringify( additionallyHiddenTriangles ) !== JSON.stringify( field.additionallyHiddenTriangles ) ) throw new Error( 'Unqualified collateral mask removal' );
        fields.push( { name: field.name, addedVertices: field.vertices.length, additionallyHiddenTriangles: additionallyHiddenTriangles.length } );
    }
    for ( let byte = 0; byte < before.length; byte ++ ) if ( ! allowedBytes.has( byte ) && before[ byte ] !== glb.bin[ byte ] ) throw new Error( 'Non-mask byte changed' );
    const output = Buffer.from( bytes );
    glb.bin.copy( output, glb.binOffset );
    const outputSha256 = sha256( output );
    if ( outputSha256 !== entry.outputSha256 ) throw new Error( 'Calibrated mask output digest mismatch' );
    return { bytes: output, report: { calibration: WARDROBE_MASK_CALIBRATION.id, garmentId, bake, inputSha256, outputSha256, alreadyApplied: false, fields, geometryAndUnrelatedBytesExact: true } };
}

function writableDestination( file ) {
    const absolute = path.resolve( file );
    const fixtureRoot = fs.realpathSync( fixtureDirectory );
    const assertOutsideFixtures = destination => {
        if ( destination === fixtureRoot || destination.startsWith( fixtureRoot + path.sep ) ) throw new Error( 'Cannot write into immutable fixtures' );
    };
    // Resolve the nearest existing ancestor before creating anything. This also catches an
    // existing symlink to fixtures followed by new directories that do not exist yet.
    let ancestor = path.dirname( absolute );
    const missing = [];
    while ( ! fs.existsSync( ancestor ) ) {
        missing.unshift( path.basename( ancestor ) );
        const parent = path.dirname( ancestor );
        if ( parent === ancestor ) throw new Error( 'No existing output ancestor' );
        ancestor = parent;
    }
    const prospective = path.join( fs.realpathSync( ancestor ), ...missing, path.basename( absolute ) );
    assertOutsideFixtures( prospective );
    fs.mkdirSync( path.dirname( absolute ), { recursive: true } );
    const real = path.join( fs.realpathSync( path.dirname( absolute ) ), path.basename( absolute ) );
    assertOutsideFixtures( real );
    if ( fs.existsSync( real ) ) throw new Error( `Refuse existing destination: ${ real }` );
    return real;
}
function writeExclusive( file, bytes ) {
    const temporary = path.join( path.dirname( file ), `.${ path.basename( file ) }.${ randomUUID() }.tmp` );
    try {
        fs.writeFileSync( temporary, bytes, { flag: 'wx' } );
        fs.linkSync( temporary, file ); // Atomic publication; unlike rename, never overwrites a destination.
    } finally { if ( fs.existsSync( temporary ) ) fs.unlinkSync( temporary ); }
}
export function runWardrobeUnderMasks( { garmentId, bake = 'g050', input = null, output, report = null } ) {
    if ( ! output ) throw new Error( 'An explicit --output is required' );
    const inputBytes = input ? fs.readFileSync( input ) : originalWardrobeFoundation( garmentId, bake );
    const result = transformWardrobeUnderMasks( inputBytes, { garmentId, bake } );
    const destination = writableDestination( output ), reportDestination = report ? writableDestination( report ) : null;
    if ( destination === reportDestination ) throw new Error( 'Output and report must differ' );
    writeExclusive( destination, result.bytes );
    if ( reportDestination ) writeExclusive( reportDestination, Buffer.from( JSON.stringify( result.report, null, 2 ) + '\n' ) );
    return result.report;
}

if ( process.argv[ 1 ] && path.resolve( process.argv[ 1 ] ) === fileURLToPath( import.meta.url ) ) {
    const args = process.argv.slice( 2 ), options = {};
    if ( args.includes( '--help' ) ) {
        console.log( 'node wardrobe_under_masks.mjs --garment foundation_bra --bake g050 --output /tmp/bra.glb [--input original.glb] [--report /tmp/report.json]\nThe original fixture is the default input. Existing outputs and other bakes are rejected. No runtime threshold or geometry is changed.' );
    } else {
        const names = { '--garment': 'garmentId', '--bake': 'bake', '--input': 'input', '--output': 'output', '--report': 'report' };
        for ( let i = 0; i < args.length; i += 2 ) {
            if ( ! names[ args[ i ] ] || ! args[ i + 1 ] || args[ i + 1 ].startsWith( '--' ) || options[ names[ args[ i ] ] ] !== undefined ) throw new Error( `Invalid or duplicate argument: ${ args[ i ] }` );
            options[ names[ args[ i ] ] ] = args[ i + 1 ];
        }
        console.log( JSON.stringify( runWardrobeUnderMasks( options ), null, 2 ) );
    }
}
