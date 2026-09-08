#!/usr/bin/env node
/** Full triangle-shell crossing checks for a completed portrait-clearance capture.
 * node tools/critic/portrait-surface.mjs --input captures/example --out /tmp/surface.json
 * Exit 0: all captured poses clear the face box; 1: crossings; 2: invalid/incomplete evidence.
 * This is a finite-pose floating-point crossing test, not a universal clearance certificate.
 */
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { Matrix4, Vector3 } from 'three';
import { measureHairSurface } from '../figure-pipeline/hair_surface.mjs';

const sha = bytes => createHash( 'sha256' ).update( bytes ).digest( 'hex' );
const read = file => JSON.parse( fs.readFileSync( file, 'utf8' ) );
const finite = values => Array.isArray( values ) && values.every( Number.isFinite );

export function measurePortraitSurface( directory, onPose = () => {} ) {
    const capturePath = path.join( directory, 'report.json' );
    const capture = read( capturePath );
    if ( ! Array.isArray( capture.errors ) || capture.errors.length ) throw new Error( 'Capture has errors or lacks its completion report.' );
    const { descriptor, samples, options } = capture;
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
        if ( state.time !== sample.time || state.verticesSpace !== 'world' || state.vertexBase !== descriptor.cardVertexBase ) throw new Error( `Pose metadata mismatch: ${ file }` );
        if ( ! finite( state.headMatrix ) || state.headMatrix.length !== 16 || ! finite( state.vertices ) || state.vertices.length !== descriptor.cardVertexCount * 3 || ! finite( state.bodyPositions ) || state.bodyPositions.length < 9 || state.bodyPositions.length % 3 || ! Array.isArray( state.bodyIndices ) || state.bodyIndices.length < 3 ) throw new Error( `Invalid pose arrays: ${ file }` );
        const matrix = new Matrix4().fromArray( state.headMatrix );
        if ( Math.abs( matrix.determinant() ) < 1e-12 ) throw new Error( `Singular head transform: ${ file }` );
        const inverse = matrix.invert(), point = new Vector3();
        const transform = values => {
            const positions = new Float64Array( values.length );
            for ( let i = 0; i < values.length; i += 3 ) point.fromArray( values, i ).applyMatrix4( inverse ).toArray( positions, i );
            return positions;
        };
        const measurement = measureHairSurface(
            { positions: transform( state.vertices ), indices: descriptor.cardIndices },
            { positions: transform( state.bodyPositions ), indices: state.bodyIndices } );
        if ( measurement.selectedHairTriangles === 0 || measurement.selectedBodyTriangles === 0 ) throw new Error( `Empty calibrated comparison; check pose coordinate alignment: ${ file }` );
        const result = { file, time: state.time, frameSha256: sha( raw ), ...measurement };
        onPose( result );
        return result;
    } );
    return {
        version: 1, directory: path.resolve( directory ), captureReportSha256: sha( fs.readFileSync( capturePath ) ),
        sourceHashes: capture.sourceHashes,
        instrumentSha256: sha( fs.readFileSync( new URL( '../figure-pipeline/hair_surface.mjs', import.meta.url ) ) ),
        replayInstrumentSha256: sha( fs.readFileSync( fileURLToPath( import.meta.url ) ) ),
        method: 'Both GPU card vertices and posed body transformed by inverse captured headMatrix; triangle-prism intersection; no alpha filtering.',
        results, gate: { region: 'face', pass: results.every( result => result.face.pairs === 0 ) }
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
