#!/usr/bin/env node
/** Full triangle-shell crossing checks for a completed portrait-clearance capture.
 * node tools/critic/portrait-surface.mjs --input captures/example --out /tmp/surface.json
 * Exit 0: all captured poses clear the face box; 1: crossings; 2: invalid/incomplete evidence.
 * This is a finite-pose floating-point crossing test, not a universal clearance certificate.
 */
import fs from 'node:fs';
import path from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { Matrix4, Vector3 } from 'three';
import { measureHairSurface, DEFAULT_HEAD_BOUNDS, DEFAULT_FACE_BOUNDS } from '../figure-pipeline/hair_surface.mjs';
import { calibrationForBake, captureRegion, captureAnatomy, decodeBounds, validateBodyTopology, validateBodyGeometryHashes } from './portrait-calibration.mjs';
import { CAPTURE_REGION, captureTarget, parseCaptureOptions, validateCaptureRuntime, validateLoadedAssets } from './portrait-clearance.mjs';

const sha = bytes => createHash( 'sha256' ).update( bytes ).digest( 'hex' );
const read = file => JSON.parse( fs.readFileSync( file, 'utf8' ) );
const finite = values => Array.isArray( values ) && values.every( Number.isFinite );

// The g050 box was measured against this exact body. A new body revision needs an
// explicit calibration review; matching a new response hash alone cannot inherit it.
export const CALIBRATED_BODY_SHA256 = 'b56115d0cb52edb72af7e725bf479d81253b660c298bd95ff9e89456d671ec14';
function captureCalibration( capture, directory ) {
    const { options, region, sourceHashes, loadedAssets } = capture;
    const has = ( object, key ) => object != null && Object.hasOwn( object, key );
    const modern = has( capture, 'region' ) || has( capture, 'loadedAssets' ) ||
        has( capture, 'anatomy' ) || has( options, 'hair' ) || has( options, 'bake' ) || has( sourceHashes, 'body' );
    if ( ! modern ) return { target: null, faceBounds: DEFAULT_FACE_BOUNDS, headBounds: DEFAULT_HEAD_BOUNDS,
        evidence: { status: 'legacy-unattested', bake: 'g050', calibration: CAPTURE_REGION.calibration,
            limitation: 'Historical capture lacks body-response and selection attestation; fixed g050 bounds retained for compatibility.' } };
    const bake = options?.bake;
    let body; try { body = calibrationForBake( bake ); } catch { throw new Error( 'Capture region/body calibration is missing or unsupported.' ); }
    const expected = { ...captureRegion( bake ), bodySha256: body.hashes.file };
    const hasAnatomy = has( capture, 'anatomy' );
    if ( hasAnatomy && ! isDeepStrictEqual( capture.anatomy, captureAnatomy( bake ) ) ) throw new Error( 'Capture anatomy calibration is missing, unsupported or changed.' );
    if ( ! hasAnatomy && bake !== 'g050' ) throw new Error( 'Non-g050 captures require the correspondence anatomy calibration.' );
    if ( ! region || Object.keys( region ).length !== Object.keys( expected ).length ||
        Object.entries( expected ).some( ( [ key, value ] ) => region[ key ] !== value ) ) throw new Error( 'Capture region/body calibration is missing, unsupported or changed.' );
    if ( ! options || typeof options.url !== 'string' || ! [ 'bob01', 'bob02' ].includes( options.hair ) ) throw new Error( 'Capture lacks a supported explicit hair/body selection.' );
    // Reuse the CLI contradiction checks without starting a browser or touching outputs.
    parseCaptureOptions( [ '--out', directory, '--url', options.url, '--hair', options.hair, '--bake', options.bake ], {} );
    if ( sourceHashes?.body !== body.hashes.file || ! /^[a-f0-9]{64}$/.test( sourceHashes?.groom ?? '' ) ) throw new Error( 'Capture source hashes disagree with the calibrated body or lack a groom hash.' );
    if ( ! Array.isArray( loadedAssets ) || loadedAssets.some( asset => ! asset || typeof asset.url !== 'string' || ! /^[a-f0-9]{64}$/.test( asset.sha256 ?? '' ) ) ) throw new Error( 'Capture lacks valid loaded GLB response provenance.' );
    validateLoadedAssets( loadedAssets, sourceHashes );
    const target = captureTarget( options );
    validateCaptureRuntime( capture.descriptor?.report, target );
    if ( hasAnatomy ) validateBodyGeometryHashes( capture.descriptor?.bodyGeometryHashes, bake );
    return { target, body: hasAnatomy ? body : null, headBounds: hasAnatomy ? decodeBounds( body.proposed.head ) : DEFAULT_HEAD_BOUNDS, faceBounds: { min: [ -Infinity, region.minY, region.minZ ], max: [ Infinity, region.maxY, Infinity ] },
        evidence: { status: hasAnatomy ? 'attested-correspondence-v1' : 'attested-g050', hair: options.hair, ...expected,
            ...( hasAnatomy ? { anatomy: capture.anatomy } : { limitation: 'Historical g050 attestation has no captured rest-geometry/topology proof; neck/shoulder gate unavailable.' } ) } };
}

/** Only exact calibrated body triangles participate; the AABB is recomputed from this pose. */
export function measureNeckShoulder( vertices, cardIndices, bodyPositions, bodyIndices, bake ) {
    validateBodyTopology( bodyIndices, bodyPositions.length, bake );
    const body = calibrationForBake( bake );
    const indices = body.neckPatchTriangleIds.flatMap( t => bodyIndices.slice( t * 3, t * 3 + 3 ) );
    const bounds = { min: [ Infinity,Infinity,Infinity ], max: [ -Infinity,-Infinity,-Infinity ] };
    for ( const i of body.neckPatchVertexIds ) for ( let k = 0; k < 3; k ++ ) {
        bounds.min[ k ] = Math.min( bounds.min[ k ], bodyPositions[ i * 3 + k ] );
        bounds.max[ k ] = Math.max( bounds.max[ k ], bodyPositions[ i * 3 + k ] );
    }
    const measured = measureHairSurface( { positions: vertices, indices: cardIndices },
        { positions: bodyPositions, indices }, { headBounds: bounds, faceBounds: bounds } );
    return { ...measured.head, examples: measured.head.examples.map( example => ( { ...example,
        bodyTriangle: body.neckPatchTriangleIds[ example.bodyTriangle ] } ) ),
        selectedHairTriangles: measured.selectedHairTriangles, selectedBodyTriangles: measured.selectedBodyTriangles,
        candidatePairs: measured.candidatePairs, posedBounds: bounds, coordinateSpace: 'world',
        method: 'All ribbon triangles against the same-frame posed calibrated neck/shoulder body triangle subset; posed patch AABB broad phase.',
        limitation: 'Conservative neck/clavicle patch includes upper chest and lower-face border. No crossings does not certify positive clearance or exclude containment.' };
}

/** Original bob01 layout ranges, diagnostic only. Every triangle remains in the strict gate. */
export function originalBob01Parts( descriptor, hair ) {
    if ( hair !== 'bob01' || descriptor.chainCount !== 496 || descriptor.pointsPerChain !== 17 ||
        descriptor.cardVertexBase !== 652 || descriptor.cardVertexCount !== 16864 || descriptor.cardIndices.length !== 496 * 32 * 3 ) return null;
    const parts = [ { name: 'rootLayer', firstCard: 0, lastCard: 77, indices: [] },
        { name: 'longCurtains', firstCard: 78, lastCard: 461, indices: [] },
        { name: 'fringe', firstCard: 462, lastCard: 495, indices: [] } ];
    const counts = new Uint32Array( 496 ), edges = new Set();
    for ( let t = 0; t < descriptor.cardIndices.length; t += 3 ) {
        const tri = descriptor.cardIndices.slice( t, t + 3 ), card = Math.floor( tri[ 0 ] / 34 );
        if ( tri.some( v => ! Number.isInteger( v ) || v < 0 || v >= 16864 || Math.floor( v / 34 ) !== card ) ) return null;
        counts[ card ] ++;
        for ( const [ a,b ] of [ [ tri[0],tri[1] ], [ tri[1],tri[2] ], [ tri[2],tri[0] ] ] ) edges.add( `${ Math.min(a,b) }:${ Math.max(a,b) }` );
        parts.find( part => card >= part.firstCard && card <= part.lastCard ).indices.push( ...tri );
    }
    if ( counts.some( n => n !== 32 ) ) return null;
    for ( let card = 0; card < 496; card ++ ) for ( let ring = 0; ring < 17; ring ++ ) {
        const left = card * 34 + ring * 2; if ( ! edges.has( `${left}:${left+1}` ) ) return null;
    }
    return parts;
}

export function measurePortraitSurface( directory, onPose = () => {} ) {
    const capturePath = path.join( directory, 'report.json' );
    const capture = read( capturePath );
    if ( ! Array.isArray( capture.errors ) || capture.errors.length ) throw new Error( 'Capture has errors or lacks its completion report.' );
    const { descriptor, samples, options } = capture;
    const calibration = captureCalibration( capture, directory );
    if ( ! options || ! [ options.seconds, options.fps, options.stride ].every( value => Number.isFinite( value ) && value > 0 ) || ! Number.isInteger( options.stride ) ) throw new Error( 'Capture lacks valid duration/cadence.' );
    if ( ! descriptor || ! Array.isArray( descriptor.cardIndices ) || ! Array.isArray( samples ) || ! samples.length ) throw new Error( 'Capture has no measured poses/topology.' );
    if ( ! Number.isInteger( descriptor.cardVertexCount ) || descriptor.cardVertexCount <= 0 ) throw new Error( 'Invalid card vertex count.' );
    const expectedFiles = samples.map( sample => {
        if ( ! Number.isInteger( sample.frame ) || sample.frame < 0 || ! Number.isFinite( sample.time ) ) throw new Error( 'Invalid frame descriptor.' );
        const expectedTime = sample.frame / options.fps;
        if ( Math.abs( sample.time - expectedTime ) > 1e-8 * Math.max( 1, expectedTime ) ) throw new Error( 'Capture clock does not match frame cadence.' );
        return `frame-${ String( sample.frame ).padStart( 4, '0' ) }.json`;
    } );
    const finalFrame = Math.round( options.seconds * options.fps );
    const expectedFrames = [];
    for ( let frame = 0; frame <= finalFrame; frame ++ ) if ( frame % options.stride === 0 || frame === finalFrame ) expectedFrames.push( frame );
    if ( JSON.stringify( samples.map( sample => sample.frame ) ) !== JSON.stringify( expectedFrames ) ) throw new Error( 'Capture stopped before its requested sequence completed.' );
    const actualFiles = fs.readdirSync( directory ).filter( file => /^frame-\d+\.json$/.test( file ) ).sort();
    if ( new Set( expectedFiles ).size !== samples.length || JSON.stringify( actualFiles ) !== JSON.stringify( [ ...expectedFiles ].sort() ) ) throw new Error( 'Capture frame files and completion report disagree.' );
    const results = samples.map( ( sample, index ) => {
        const file = expectedFiles[ index ], raw = fs.readFileSync( path.join( directory, file ) ), state = JSON.parse( raw );
        if ( calibration.target ) validateCaptureRuntime( state.report, calibration.target );
        if ( state.time !== sample.time || state.verticesSpace !== 'world' || state.vertexBase !== descriptor.cardVertexBase ) throw new Error( `Pose metadata mismatch: ${ file }` );
        if ( ! finite( state.headMatrix ) || state.headMatrix.length !== 16 || ! finite( state.vertices ) || state.vertices.length !== descriptor.cardVertexCount * 3 || ! finite( state.bodyPositions ) || state.bodyPositions.length < 9 || state.bodyPositions.length % 3 || ! Array.isArray( state.bodyIndices ) || state.bodyIndices.length < 3 ) throw new Error( `Invalid pose arrays: ${ file }` );
        if ( calibration.body ) validateBodyTopology( state.bodyIndices, state.bodyPositions.length, options.bake );
        const matrix = new Matrix4().fromArray( state.headMatrix );
        if ( Math.abs( matrix.determinant() ) < 1e-12 ) throw new Error( `Singular head transform: ${ file }` );
        const inverse = matrix.invert(), point = new Vector3();
        const transform = values => {
            const positions = new Float64Array( values.length );
            for ( let i = 0; i < values.length; i += 3 ) point.fromArray( values, i ).applyMatrix4( inverse ).toArray( positions, i );
            return positions;
        };
        const headVertices = transform( state.vertices ), headBody = transform( state.bodyPositions );
        const measurement = measureHairSurface(
            { positions: headVertices, indices: descriptor.cardIndices },
            { positions: headBody, indices: state.bodyIndices },
            { headBounds: calibration.headBounds, faceBounds: calibration.faceBounds } );
        if ( measurement.selectedHairTriangles === 0 || measurement.selectedBodyTriangles === 0 ) throw new Error( `Empty calibrated comparison; check pose coordinate alignment: ${ file }` );
        const neckShoulder = calibration.body ? measureNeckShoulder( state.vertices, descriptor.cardIndices, state.bodyPositions, state.bodyIndices, options.bake ) : null;
        const parts = originalBob01Parts( descriptor, options.hair );
        const layerBreakdown = { status: parts ? 'original-bob01-layout-ranges' : 'unclassified', diagnosticOnly: true,
            caps: 'Scalp/cap geometry is excluded from captured ribbon vertices and is not verified.',
            limitation: 'Original bob01 card ranges do not exempt any pair from the gate. Root-layer cards are distinct from the fixed ring-0 center roots on every chain.',
            groups: parts ? parts.map( part => {
                const head = measureHairSurface( { positions: headVertices, indices: part.indices },
                    { positions: headBody, indices: state.bodyIndices }, { headBounds: calibration.headBounds, faceBounds: calibration.faceBounds } );
                const shoulder = calibration.body ? measureNeckShoulder( state.vertices, part.indices, state.bodyPositions, state.bodyIndices, options.bake ) : null;
                return { name: part.name, firstCard: part.firstCard, lastCard: part.lastCard,
                    headPairs: head.head.pairs, facePairs: head.face.pairs, neckShoulderPairs: shoulder?.pairs ?? null };
            } ) : [ { name: 'unclassified', headPairs: measurement.head.pairs, facePairs: measurement.face.pairs, neckShoulderPairs: neckShoulder?.pairs ?? null } ] };
        for ( const [ key, total ] of [ [ 'headPairs', measurement.head.pairs ], [ 'facePairs', measurement.face.pairs ], [ 'neckShoulderPairs', neckShoulder?.pairs ?? null ] ] ) {
            if ( total !== null && layerBreakdown.groups.reduce( ( sum, group ) => sum + group[ key ], 0 ) !== total ) throw new Error( 'Layer diagnostics lost a measured crossing pair.' );
        }
        const result = { file, time: state.time, frameSha256: sha( raw ), ...measurement, neckShoulder, layerBreakdown };
        onPose( result );
        return result;
    } );
    return {
        version: 2, directory: path.resolve( directory ), captureReportSha256: sha( fs.readFileSync( capturePath ) ),
        sourceHashes: capture.sourceHashes, calibration: calibration.evidence,
        instrumentSha256: sha( fs.readFileSync( new URL( '../figure-pipeline/hair_surface.mjs', import.meta.url ) ) ),
        replayInstrumentSha256: sha( fs.readFileSync( fileURLToPath( import.meta.url ) ) ),
        method: 'Face/head: both GPU cards and posed body transformed by inverse captured headMatrix. Neck/shoulder: calibrated source triangle IDs with same-frame world positions and posed patch AABB; head transform never moves the shoulder gate. Triangle-prism intersection; no alpha filtering.',
        results, gate: { region: calibration.body ? 'face-and-neck-shoulder' : 'face',
            facePass: results.every( result => result.face.pairs === 0 ),
            neckShoulderPass: calibration.body ? results.every( result => result.neckShoulder.pairs === 0 ) : null,
            pass: results.every( result => result.face.pairs === 0 && ( ! calibration.body || result.neckShoulder.pairs === 0 ) ) }
    };
}

if ( process.argv[ 1 ] && path.resolve( process.argv[ 1 ] ) === fileURLToPath( import.meta.url ) ) {
    try {
        const options = {};
        for ( let i = 2; i < process.argv.length; i += 2 ) {
            const key = process.argv[ i ];
            if ( ! [ '--input', '--out' ].includes( key ) || ! process.argv[ i + 1 ] || options[ key ] ) throw new Error( 'Usage: --input capture-directory --out new-report.json' );
            options[ key ] = process.argv[ i + 1 ];
        }
        if ( ! options[ '--input' ] || ! options[ '--out' ] ) throw new Error( 'Both --input and --out are required.' );
        if ( fs.existsSync( options[ '--out' ] ) ) throw new Error( 'Output exists; choose a new evidence path.' );
        const result = measurePortraitSurface( options[ '--input' ], pose => {
            console.log( JSON.stringify( { file: pose.file, facePairs: pose.face.pairs, headPairs: pose.head.pairs } ) );
        } );
        fs.mkdirSync( path.dirname( path.resolve( options[ '--out' ] ) ), { recursive: true } );
        fs.writeFileSync( options[ '--out' ], JSON.stringify( result, null, 2 ) + '\n', { flag: 'wx' } );
        process.exitCode = result.gate.pass ? 0 : 1;
    } catch ( error ) {
        console.error( error.message );
        process.exitCode = 2;
    }
}
