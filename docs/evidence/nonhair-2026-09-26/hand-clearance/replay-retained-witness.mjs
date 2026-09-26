// Read-only reconstruction of the 2026-09-26 CPU audit. Never writes a file or changes an asset.
// node docs/evidence/nonhair-2026-09-26/hand-clearance/replay-retained-witness.mjs
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { gunzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { readGlb, readPrimitive, readAccessor } from '../../../../tools/lut-bake/glb.mjs';
import { intersectTriangles } from '../../../../tools/figure-pipeline/hair_surface.mjs';

const ROOT = fileURLToPath( new URL( '../../../../', import.meta.url ) );
const file = relative => ROOT + relative;
const read = relative => fs.readFileSync( file( relative ) );
const hash = bytes => createHash( 'sha256' ).update( bytes ).digest( 'hex' );
const receiptPath = 'docs/evidence/nonhair-2026-09-26/hand-clearance/retained-witness.json';
const RECEIPT_SHA256 = '39639e07c9cb47c07bad6ed8a8a0502d7aeafade3478b51d83218968e364f377';
const receiptBytes = read( receiptPath );
assert.equal( hash( receiptBytes ), RECEIPT_SHA256, 'The original receipt must remain unchanged' );
const expected = JSON.parse( receiptBytes );
// Stop before geometry if any recorded current source/input differs; do not revise the receipt.
for ( const [ path, sha256 ] of Object.entries( expected.sourceHashes ) ) assert.equal( hash( read( path ) ), sha256, path );
const base = 'captures/collar-replacement-2026-09-26/capture-v2';
const captureBytes = read( base + '/report.json' );
assert.equal( hash( captureBytes ), expected.captureReportSha256 );
const capture = JSON.parse( captureBytes );
const run = capture.runs.find( x => x.name === 'bob02-expressive-foundation_bra-accepted-installed' );
assert.equal( run.completed, true );
const bodyFile = 'assets/figures/figure_g050.glb';
const garmentFile = 'assets/wardrobe/female_casualsuit01/g050.glb';
const nativeFiles = [ bodyFile, garmentFile, 'packages/core/src/affect/PostureLayer.js',
    'packages/core/src/motion/Gesture.js', 'packages/core/src/motion/BodyIdle.js', 'packages/core/src/motion/HandIdle.js' ];
for ( const path of nativeFiles ) assert.equal( hash( read( path ) ), capture.sourceHashes[ path ], path );
const bodyGlb = readGlb( file( bodyFile ) ), body = readPrimitive( bodyGlb, 'base.001' );
const cloth = readPrimitive( readGlb( file( garmentFile ) ), 'female_casualsuit01' );
const primitive = bodyGlb.json.meshes[ 0 ].primitives[ 0 ];
const joints = readAccessor( bodyGlb, primitive.attributes.JOINTS_0 ).data;
const weights = readAccessor( bodyGlb, primitive.attributes.WEIGHTS_0 ).data;
const jointNames = bodyGlb.json.skins[ 0 ].joints.map( i => bodyGlb.json.nodes[ i ].name );
const weightFor = ( vertex, predicate ) => [ 0, 1, 2, 3 ].reduce( ( sum, k ) =>
    sum + ( predicate( jointNames[ joints[ vertex * 4 + k ] ] ) ? weights[ vertex * 4 + k ] : 0 ), 0 );
const hands = {};
for ( const side of [ 'l', 'r' ] ) hands[ side ] = Array.from( { length: body.vertexCount }, ( _, v ) =>
    weightFor( v, name => /^(hand|thumb|index|middle|ring|pinky)_/.test( name ) && name.endsWith( '_' + side ) ) >= .5 );
const leg = Array.from( { length: body.vertexCount }, ( _, v ) => weightFor( v, name => name === 'pelvis' || /^thigh_/.test( name ) ) >= .5 );

// Exact original selection: connected source garment components after a 1e-7m position weld.
const parent = Array.from( { length: cloth.vertexCount }, ( _, i ) => i );
const find = i => { while ( parent[ i ] !== i ) i = parent[ i ]; return i; };
const keys = new Map();
for ( let i = 0; i < cloth.vertexCount; i++ ) {
    const key = Array.from( cloth.positions.slice( i * 3, i * 3 + 3 ), x => Math.round( x / 1e-7 ) ).join( ':' );
    if ( keys.has( key ) ) parent[ find( i ) ] = find( keys.get( key ) ); else keys.set( key, i );
}
for ( let t = 0; t < cloth.indices.length; t += 3 ) for ( let k = 1; k < 3; k++ ) parent[ find( cloth.indices[ t + k ] ) ] = find( cloth.indices[ t ] );
const components = new Map();
for ( let face = 0; face < cloth.indices.length / 3; face++ ) {
    const ids = Array.from( cloth.indices.slice( face * 3, face * 3 + 3 ) ), root = find( ids[ 0 ] );
    if ( !components.has( root ) ) components.set( root, { root, faces: [], vertices: new Set(), min: [ Infinity, Infinity, Infinity ], max: [ -Infinity, -Infinity, -Infinity ] } );
    const c = components.get( root ); c.faces.push( face );
    for ( const i of ids ) {
        c.vertices.add( i );
        for ( let k = 0; k < 3; k++ ) { c.min[ k ] = Math.min( c.min[ k ], cloth.positions[ i * 3 + k ] ); c.max[ k ] = Math.max( c.max[ k ], cloth.positions[ i * 3 + k ] ); }
    }
}
assert.equal( components.size, 2 );
const ordered = [ ...components.values() ].sort( ( a, b ) => a.max[ 1 ] - b.max[ 1 ] ), trousers = ordered[ 0 ];
assert.equal( trousers.faces.length, 1712 ); assert.ok( trousers.max[ 1 ] < 1 );
const trouserFaces = new Set( trousers.faces );
const faceSet = indices => new Set( Array.from( { length: indices.length / 3 }, ( _, f ) => indices.slice( f * 3, f * 3 + 3 ).join( ',' ) ) );
function triangles( mesh, selected ) {
    const result = [];
    for ( let face = 0; face < mesh.fullIndices.length / 3; face++ ) {
        const ids = mesh.fullIndices.slice( face * 3, face * 3 + 3 );
        if ( !selected( ids, face ) ) continue;
        const vertices = ids.map( i => mesh.positions.slice( i * 3, i * 3 + 3 ) );
        result.push( { face, ids, vertices, min: [ 0, 1, 2 ].map( k => Math.min( ...vertices.map( v => v[ k ] ) ) ),
            max: [ 0, 1, 2 ].map( k => Math.max( ...vertices.map( v => v[ k ] ) ) ) } );
    }
    return result;
}
function crosses( hand, target, drawnHand, drawnTarget ) {
    let hits = 0; const uniqueHand = new Set(), uniqueTarget = new Set(), witnesses = [];
    for ( const x of hand ) for ( const y of target ) {
        if ( [ 0, 1, 2 ].some( k => x.max[ k ] < y.min[ k ] - 1e-10 || y.max[ k ] < x.min[ k ] - 1e-10 ) ) continue;
        const hit = intersectTriangles( x.vertices, y.vertices, 1e-10 ); if ( !hit ) continue;
        hits++; uniqueHand.add( x.face ); uniqueTarget.add( y.face );
        if ( witnesses.length < 4 ) witnesses.push( { handFace: x.face, targetFace: y.face, handVertexIds: x.ids,
            targetVertexIds: y.ids, handVertices: x.vertices, targetVertices: y.vertices, kind: hit.kind, points: hit.points,
            handDrawn: drawnHand.has( x.ids.join( ',' ) ), targetDrawn: drawnTarget.has( y.ids.join( ',' ) ),
            sameAt1e9: !!intersectTriangles( x.vertices, y.vertices, 1e-9 ), sameAt1e11: !!intersectTriangles( x.vertices, y.vertices, 1e-11 ) } );
    }
    return { pairs: hits, handFaces: uniqueHand.size, targetFaces: uniqueTarget.size, witnesses };
}
const originalSourceOrder = [ ...nativeFiles, 'tools/figure-pipeline/hair_surface.mjs', 'tools/lut-bake/glb.mjs' ];
const report = {
    scope: 'Read-only actual retained native geometry audit; no GPU, new pose, asset edit or solver.',
    captureReportSha256: hash( captureBytes ),
    sourceHashes: Object.fromEntries( originalSourceOrder.map( path => [ path, hash( read( path ) ) ] ) ),
    method: {
        hand: 'All three triangle vertices each carry >=.5 summed skin weight from that side hand/finger joints in exact source GLB.',
        bodyTarget: 'All three vertices each carry >=.5 summed pelvis/thigh weight; a selected lower-body subset, not every body triangle.',
        trousers: 'Lower of two source connected components after rest-position weld at1e-7m;1712 triangles/950 raw vertices, source rest maxY<1m.',
        predicate: 'Existing intersectTriangles at1e-10m after AABB pruning; each retained witness also checked at1e-9 and1e-11m. Boundary contacts count; numbers are triangle-pair counts, not penetration volume.',
        limits: 'CPU-skinned world snapshots during native GPU run. Discrete poses only; no global inside/depth, continuous proof, or sole-writer attribution.'
    },
    components: ordered.map( c => ( { triangles: c.faces.length, vertices: c.vertices.size, min: c.min, max: c.max,
        firstFace: Math.min( ...c.faces ), lastFace: Math.max( ...c.faces ) } ) ), poses: []
};
for ( const step of [ 0, 637, 720 ] ) {
    const entry = run.geometry.find( x => x.step === step ), path = base + '/' + entry.file, bytes = read( path ), decoded = gunzipSync( bytes );
    assert.equal( hash( bytes ), entry.sha256 ); assert.equal( hash( decoded ), entry.decodedSHA256 );
    const snapshot = JSON.parse( decoded ), b = snapshot.meshes.find( x => x.id === 'body' ), g = snapshot.meshes.find( x => x.id === 'female_casualsuit01' );
    assert.deepEqual( b.fullIndices, Array.from( body.indices ) ); assert.deepEqual( g.fullIndices, Array.from( cloth.indices ) );
    assert.equal( b.positions.length, body.positions.length ); assert.equal( g.positions.length, cloth.positions.length );
    const bd = faceSet( b.drawnIndices ), gd = faceSet( g.drawnIndices );
    const gt = triangles( g, ( _, face ) => trouserFaces.has( face ) ), bt = triangles( b, ids => ids.every( i => leg[ i ] ) );
    const pose = { step, time: snapshot.time, file: path, sha256: hash( bytes ), decodedSha256: hash( decoded ),
        posture: snapshot.telemetry.affect.postureDegrees, gesture: snapshot.telemetry.gesture.applied, sides: {} };
    for ( const side of [ 'l', 'r' ] ) {
        const hand = triangles( b, ids => ids.every( i => hands[ side ][ i ] ) );
        pose.sides[ side ] = { handTriangles: hand.length, drawnHandTriangles: hand.filter( t => bd.has( t.ids.join( ',' ) ) ).length,
            trousers: crosses( hand, gt, bd, gd ), lowerBody: crosses( hand, bt, bd, bd ) };
    }
    report.poses.push( pose );
}
const oldBase = 'captures/collar-stress-2026-09-22/gpu-v1', oldReportBytes = read( oldBase + '/report.json' );
assert.equal( hash( oldReportBytes ), expected.visualBinding.olderReportSha256 );
const oldCapture = JSON.parse( oldReportBytes ), oldRun = oldCapture.runs.find( x => x.name === 'bob02-previous' );
const oldEntry = oldRun.geometry.find( x => x.step === 637 ), oldBytes = read( oldBase + '/' + oldEntry.file );
assert.equal( hash( oldBytes ), oldEntry.sha256 );
const oldSnapshot = JSON.parse( gunzipSync( oldBytes ) );
const fresh = JSON.parse( gunzipSync( read( report.poses.find( p => p.step === 637 ).file ) ) );
const imageFile = oldBase + '/bob02-previous/body-637.png', imageEntry = oldRun.bodyImages.find( x => x.label === 'body-637' );
assert.equal( hash( read( imageFile ) ), imageEntry.sha256 );
report.visualBinding = { imageFile, imageSha256: imageEntry.sha256,
    // Historical audit fact, not a claim that running this CPU script views the image again.
    imageDirectlyInspected: true, snapshotFile: oldBase + '/' + oldEntry.file, snapshotSha256: oldEntry.sha256,
    olderReportSha256: hash( oldReportBytes ),
    sameWorldGeometryAsSep26Step637: oldSnapshot.meshes.every( m => {
        const q = fresh.meshes.find( x => x.id === m.id );
        return JSON.stringify( m.positions ) === JSON.stringify( q.positions ) && JSON.stringify( m.fullIndices ) === JSON.stringify( q.fullIndices );
    } ), limits: 'The older image uses a temporary full-body camera; the retained snapshot world positions/topology exactly match the newer capture. No PNG byte equality is claimed between different views.' };
for ( const path of [ 'packages/core/src/figure/RestPose.js', 'packages/core/src/figure/poses/relaxed-standing.json',
    'packages/core/src/motion/Sway.js', 'packages/core/src/Avatar.js' ] ) report.sourceHashes[ path ] = hash( read( path ) );
assert.deepEqual( report, expected, 'Recomputed audit must reproduce every original field; no revised counts' );
const regeneratedHash = hash( JSON.stringify( report, null, 2 ) + '\n' );
assert.equal( regeneratedHash, RECEIPT_SHA256, 'Serialized reconstruction must match the unchanged original receipt bytes' );
assert.equal( hash( read( receiptPath ) ), RECEIPT_SHA256 );
console.log( JSON.stringify( { passed: true, scriptSha256: hash( fs.readFileSync( fileURLToPath( import.meta.url ) ) ),
    receiptPath, originalReceiptSha256: RECEIPT_SHA256, regeneratedReceiptSha256: regeneratedHash,
    writes: 0, poses: report.poses.map( p => ( { step: p.step, trousers: [ p.sides.l.trousers.pairs, p.sides.r.trousers.pairs ],
        selectedLowerBody: [ p.sides.l.lowerBody.pairs, p.sides.r.lowerBody.pairs ] } ) ) }, null, 2 ) );
