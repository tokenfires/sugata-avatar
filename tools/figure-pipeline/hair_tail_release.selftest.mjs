#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { BufferAttribute, BufferGeometry, Euler, Matrix4, Quaternion, Vector3 } from 'three';
import { readAccessor, readGlb, readPrimitive } from '../lut-bake/glb.mjs';
import { encodeGlb, geometryFingerprint, sha256, transformHairFall } from './hair_fall.mjs';
import { transformHairHem } from './hair_hem.mjs';
import { TAIL_RELEASE_CALIBRATION as C, runHairTailRelease, transformHairTailRelease } from './hair_tail_release.mjs';
import { createHairDynamics, deriveCardGroom } from '../../packages/core/src/motion/HairDynamics.js';

const root = path.resolve( path.dirname( fileURLToPath( import.meta.url ) ), '../..' );
const fixture = path.join( root, 'tools/figure-pipeline/fixtures/bob02-g050-original.glb' );
const bodyFile = path.join( root, 'assets/figures/figure_g050.glb' );
const temporary = fs.mkdtempSync( path.join( os.tmpdir(), 'sugata-hair-tail-test-' ) );
let groups = 0;
function check( name, test ) { test(); groups ++; console.log( `ok ${ groups } - ${ name }` ); }
function save( name, glb ) { const file = path.join( temporary, name ); fs.writeFileSync( file, encodeGlb( glb ) ); return file; }
function attrs( glb, name = 'hair_bob02' ) { return glb.json.meshes.find( mesh => mesh.name === name ).primitives[ 0 ].attributes; }
function perturb( glb, name = 'hair_bob02' ) {
    const a = glb.json.accessors[ attrs( glb, name ).POSITION ], v = glb.json.bufferViews[ a.bufferView ];
    const offset = ( v.byteOffset ?? 0 ) + ( a.byteOffset ?? 0 ); glb.bin.writeFloatLE( glb.bin.readFloatLE( offset ) + .001, offset );
}
function geometry( primitive ) {
    const g = new BufferGeometry(); g.setAttribute( 'position', new BufferAttribute( new Float32Array( primitive.positions ), 3 ) );
    g.setIndex( new BufferAttribute( new Uint32Array( primitive.indices ), 1 ) ); return g;
}
const arraySha = values => sha256( Buffer.from( new Float32Array( values ).buffer ) );
try {
    // Never use the mutable installed hair or ignored captures as default source. Both preceding
    // stages are rebuilt from the tracked original, including their validated provenance stamps.
    assert.equal( sha256( fs.readFileSync( fixture ) ), '25376e139cd498bf2bdb36dfdc6df80cb8f5f4ec026ca033ca2dd1cae23913d4', 'Fetch the immutable Git LFS fixture; do not replace it with an installed correction.' );
    const fallFile = path.join( temporary, 'fall.glb' ), input = path.join( temporary, 'hem.glb' ), output = path.join( temporary, 'tail.glb' );
    fs.writeFileSync( fallFile, transformHairFall( fixture, bodyFile ).bytes );
    fs.writeFileSync( input, transformHairHem( fallFile, bodyFile ).bytes );
    const originalBytes = fs.readFileSync( input ), before = readGlb( input ), original = readPrimitive( before, 'hair_bob02' );
    const result = transformHairTailRelease( input, bodyFile ); fs.writeFileSync( output, result.bytes );
    const after = readGlb( output ), changed = readPrimitive( after, 'hair_bob02' ), attributes = attrs( before );
    const sourceGroom = deriveCardGroom( geometry( original ) ), finalGroom = deriveCardGroom( geometry( changed ) );
    check( 'tracked original→fall→hem→tail reproduces reviewed geometry and clear static face', () => {
        assert.equal( sha256( originalBytes ), 'dd00a39d8aaa02f71e0f91a43a4f4b07b51fd334e506117d25833735d686cae7' );
        assert.equal( arraySha( changed.positions ), '79cb4cbc4464d5991501ff8727a4f9cb484ebc821de3054106c0bf68ff8d0973' );
        assert.equal( arraySha( changed.normals ), '2d878b17a726a5602a1589dd29ac5516f6c9293274de60132212a3b3fd0bebaf' );
        assert.equal( geometryFingerprint( changed ), C.outputGeometry );
        assert.equal( result.report.surface.face.pairs, 0 ); assert.equal( result.report.surface.head.pairs, 165 );
        assert.equal( result.report.correctedCards, C.cards.length );
        assert.deepEqual( fs.readFileSync( input ), originalBytes );
        assert.deepEqual( [ finalGroom.chainCount, finalGroom.pointsPerChain, finalGroom.vertexCount ], [ 496, 17, 17516 ] );
    } );
    check( 'only observed terminal spans move; caps, upper rings, other cards, Y and widths stay protected', () => {
        let moved = 0;
        for ( let v = 0; v < original.positions.length / 3; v ++ ) {
            const card = Math.floor( ( v - 652 ) / 34 ), ring = Math.floor( ( v - 652 ) % 34 / 2 );
            const delta = [ 0,1,2 ].map( k => changed.positions[ v * 3 + k ] - original.positions[ v * 3 + k ] );
            const distance = Math.hypot( ...delta ); assert.equal( delta[ 1 ], 0 ); assert.ok( distance <= .00350001 );
            if ( v < 652 || ring <= 12 || ! C.cards.includes( card ) ) assert.equal( distance, 0 );
            if ( distance > 0 ) moved ++;
        }
        assert.equal( moved, C.cards.length * 8 );
        for ( let i = 0; i < sourceGroom.restOffsets.length; i ++ ) assert.ok( Math.abs( sourceGroom.restOffsets[ i ] - finalGroom.restOffsets[ i ] ) <= 2e-9 );
        for ( let i = 0; i < finalGroom.restLengths.length; i ++ ) assert.ok( finalGroom.restLengths[ i ] >= 0 );
    } );
    check( 'all nongeometry bytes, UVs, skin, material and both historical stamps remain exact', () => {
        assert.equal( before.bin.length, after.bin.length );
        const allowed = new Uint8Array( before.bin.length );
        for ( const name of [ 'POSITION', 'NORMAL', 'TANGENT' ] ) {
            if ( attributes[ name ] === undefined ) continue;
            const a = before.json.accessors[ attributes[ name ] ], v = before.json.bufferViews[ a.bufferView ], width = name === 'TANGENT' ? 16 : 12;
            for ( let i = 0; i < a.count; i ++ ) { const start = ( v.byteOffset ?? 0 ) + ( a.byteOffset ?? 0 ) + i * ( v.byteStride ?? width ); allowed.fill( 1, start, start + width ); }
        }
        for ( let i = 0; i < allowed.length; i ++ ) if ( ! allowed[ i ] ) assert.equal( before.bin[ i ], after.bin[ i ] );
        const a = structuredClone( before.json ), b = structuredClone( after.json );
        for ( const json of [ a, b ] ) {
            delete json.asset.extras.sugataHairTailRelease;
            for ( const name of [ 'POSITION', 'NORMAL', 'TANGENT' ] ) if ( attributes[ name ] !== undefined ) { delete json.accessors[ attributes[ name ] ].min; delete json.accessors[ attributes[ name ] ].max; }
        }
        assert.deepEqual( b, a );
    } );
    check( 'actual collider fitter remains exact in bind pose and an oblique posed transform', () => {
        const body = readGlb( bodyFile ), meshIndex = body.json.meshes.findIndex( m => m.name === 'base.001' );
        const skin = body.json.skins[ body.json.nodes.find( n => n.mesh === meshIndex ).skin ], inverses = readAccessor( body, skin.inverseBindMatrices ).data;
        const shoulder = name => { const i = skin.joints.findIndex( j => body.json.nodes[ j ].name === name ); return new Vector3().setFromMatrixPosition( new Matrix4().fromArray( inverses, i * 16 ).invert() ); };
        const shoulderLeft = shoulder( 'clavicle_l' ), shoulderRight = shoulder( 'clavicle_r' );
        const pose = new Matrix4().compose( new Vector3( .02, -.01, .03 ), new Quaternion().setFromEuler( new Euler( -.37, .22, .47 ) ), new Vector3( 1,1,1 ) );
        for ( const matrix of [ new Matrix4(), pose ] ) {
            const fit = primitive => { const d = createHairDynamics( { renderer: {}, geometry: geometry( primitive ) } ); d.setHeadMatrix( new Matrix4(), matrix, new Matrix4() ); const f = d.fitColliders( { shoulderLeft, shoulderRight } ); return { centre: f.skullCentre.toArray(), radius: f.skullRadius, scalp: f.scalpRadius, nearest: f.nearestRestParticle, capsule: f.capsuleRadius, capsuleNearest: f.nearestRestParticleToAxis }; };
            assert.deepEqual( fit( changed ), fit( original ) );
        }
    } );
    check( 'global compliance reference is exact and all target length/stiffness shifts are bounded', () => {
        const median = values => [ ...values ].sort( ( a,b ) => a-b )[ Math.floor( values.length / 2 ) ];
        assert.equal( median( finalGroom.arcLengths ), median( sourceGroom.arcLengths ) );
        for ( let card = 0; card < 496; card ++ ) if ( ! C.cards.includes( card ) ) assert.equal( finalGroom.arcLengths[ card ], sourceGroom.arcLengths[ card ] );
        assert.deepEqual( C.cards, [ 6,14,15,22,29,42,45,53,69,75,196,352 ], 'Recorded motion-contact mask must include both long curtains as well as the root tails.' );
        assert.deepEqual( result.report.lengthChanges.map( r => r.card ), C.cards );
        for ( const row of result.report.lengthChanges ) { assert.ok( Math.abs( row.deltaMm ) < 1.5 ); assert.ok( Math.abs( row.complianceAfter / row.complianceBefore - 1 ) < .018 ); assert.equal( row.segments.length, 16 ); }
    } );
    check( 'fresh output is deterministic; repeat is byte-idempotent; historical stages reject later geometry', () => {
        assert.deepEqual( transformHairTailRelease( input, bodyFile ).bytes, result.bytes );
        const again = transformHairTailRelease( output, bodyFile ); assert.equal( again.report.alreadyApplied, true ); assert.deepEqual( again.bytes, result.bytes );
        assert.throws( () => transformHairHem( output, bodyFile ), /second deformation/ );
        assert.throws( () => transformHairFall( output, bodyFile ), /second deformation/ );
        assert.throws( () => transformHairTailRelease( fixture, bodyFile ), /hem stage first/ );
        assert.throws( () => transformHairTailRelease( fallFile, bodyFile ), /hem stage first/ );
    } );
    check( 'forged source/body/history/tangent stamps and altered corrected geometry fail closed', () => {
        const missing = readGlb( input ); delete missing.json.asset.extras.sugataHairHem;
        assert.throws( () => transformHairTailRelease( save( 'missing.glb', missing ), bodyFile ), /hem stage first/ );
        const forged = readGlb( input ); forged.json.asset.extras.sugataHairFall.sourceGeometry = 'forged';
        assert.throws( () => transformHairTailRelease( save( 'forged.glb', forged ), bodyFile ), /fall-stage history/ );
        const noFall = readGlb( input ); delete noFall.json.asset.extras.sugataHairFall;
        assert.throws( () => transformHairTailRelease( save( 'no-fall.glb', noFall ), bodyFile ), /fall-stage history/ );
        const tangent = readGlb( input ); tangent.json.asset.extras.sugataHairHem.outputTangentSha256 = 'forged';
        assert.throws( () => transformHairTailRelease( save( 'tangent.glb', tangent ), bodyFile ), /tangent output changed/ );
        const wrongSource = readGlb( input ); perturb( wrongSource );
        assert.throws( () => transformHairTailRelease( save( 'wrong-source.glb', wrongSource ), bodyFile ), /calibrated hem-corrected/ );
        const wrongBody = readGlb( bodyFile ); perturb( wrongBody, 'base.001' );
        assert.throws( () => transformHairTailRelease( input, save( 'wrong-body.glb', wrongBody ) ), /calibrated figure_g050/ );
        for ( const field of [ 'calibration', 'sourceGeometry', 'outputGeometry', 'bodyGeometry', 'outputTangentSha256' ] ) {
            const unknown = readGlb( output ); unknown.json.asset.extras.sugataHairTailRelease[ field ] = 'forged';
            assert.throws( () => transformHairTailRelease( save( `unknown-${ field }.glb`, unknown ), bodyFile ), /second deformation/ );
        }
        const altered = readGlb( output ); perturb( altered );
        assert.throws( () => transformHairTailRelease( save( 'altered.glb', altered ), bodyFile ), /second deformation/ );
    } );
    check( 'writer handles nested dirs and protects source/body/report aliases and existing temporary files', () => {
        const inputCopy = path.join( temporary, 'input-copy.glb' ); fs.writeFileSync( inputCopy, originalBytes );
        const options = { input: inputCopy, body: bodyFile, output: inputCopy };
        assert.throws( () => runHairTailRelease( options ), /In-place/ );
        assert.throws( () => runHairTailRelease( { ...options, output: bodyFile, allowInPlace: true } ), /body/ );
        const link = path.join( temporary, 'input-link.glb' ); fs.symlinkSync( inputCopy, link );
        assert.throws( () => runHairTailRelease( { ...options, output: link } ), /In-place/ );
        const hard = path.join( temporary, 'input-hard.glb' ); fs.linkSync( inputCopy, hard );
        assert.throws( () => runHairTailRelease( { ...options, output: hard } ), /In-place/ );
        assert.throws( () => runHairTailRelease( { ...options, output: path.join( temporary, 'new.glb' ), report: inputCopy } ), /Report path/ );
        const nested = path.join( temporary, 'nested', 'tail.glb' ), report = path.join( temporary, 'nested-report', 'report.json' );
        runHairTailRelease( { ...options, output: nested, report } ); assert.deepEqual( fs.readFileSync( nested ), result.bytes );
        assert.equal( JSON.parse( fs.readFileSync( report ) ).outputSha256, sha256( result.bytes ) );
        const blocked = path.join( temporary, 'blocked.glb' ), temp = `${ blocked }.hair-tail-${ process.pid }.tmp`;
        fs.linkSync( inputCopy, temp ); assert.throws( () => runHairTailRelease( { ...options, output: blocked } ), /EEXIST/ );
        assert.ok( fs.existsSync( temp ) ); assert.equal( fs.existsSync( blocked ), false ); assert.deepEqual( fs.readFileSync( inputCopy ), originalBytes );
        runHairTailRelease( { ...options, allowInPlace: true } ); assert.deepEqual( fs.readFileSync( inputCopy ), result.bytes );
    } );
    check( 'real tangent channel survives the complete pipeline and tampering is rejected', () => {
        const glb = readGlb( fixture ), source = readPrimitive( glb, 'hair_bob02' ), g = geometry( source );
        g.setAttribute( 'normal', new BufferAttribute( new Float32Array( source.normals ), 3 ) );
        g.setAttribute( 'uv', new BufferAttribute( new Float32Array( source.uvs ), 2 ) ); g.computeTangents();
        const tangents = new Float32Array( g.attributes.tangent.array ), offset = glb.bin.length;
        glb.bin = Buffer.concat( [ glb.bin, Buffer.from( tangents.buffer ) ] ); glb.json.buffers[ 0 ].byteLength = glb.bin.length;
        const view = glb.json.bufferViews.push( { buffer: 0, byteOffset: offset, byteLength: tangents.byteLength, target: 34962 } ) - 1;
        attrs( glb ).TANGENT = glb.json.accessors.push( { bufferView: view, componentType: 5126, type: 'VEC4', count: tangents.length / 4 } ) - 1;
        const originalT = save( 'original-tangents.glb', glb ), fallT = path.join( temporary, 'fall-tangents.glb' ), hemT = path.join( temporary, 'hem-tangents.glb' ), tailT = path.join( temporary, 'tail-tangents.glb' );
        fs.writeFileSync( fallT, transformHairFall( originalT, bodyFile ).bytes );
        fs.writeFileSync( hemT, transformHairHem( fallT, bodyFile ).bytes );
        const transformed = transformHairTailRelease( hemT, bodyFile ); fs.writeFileSync( tailT, transformed.bytes );
        const inGlb = readGlb( hemT ), outGlb = readGlb( tailT ), inT = readAccessor( inGlb, attrs( inGlb ).TANGENT ).data, outT = readAccessor( outGlb, attrs( outGlb ).TANGENT ).data;
        const outNormals = readPrimitive( outGlb, 'hair_bob02' ).normals;
        assert.ok( outGlb.json.asset.extras.sugataHairTailRelease.outputTangentSha256 );
        for ( let v = 0; v < outT.length / 4; v ++ ) {
            const card = Math.floor( ( v - 652 ) / 34 ), ring = Math.floor( ( v - 652 ) % 34 / 2 );
            if ( v < 652 || ring <= 12 || ! C.cards.includes( card ) ) {
                assert.deepEqual( Array.from( outT.slice( v * 4, v * 4 + 4 ) ), Array.from( inT.slice( v * 4, v * 4 + 4 ) ) ); continue;
            }
            const n = Array.from( outNormals.slice( v * 3, v * 3 + 3 ) ), t = Array.from( outT.slice( v * 4, v * 4 + 3 ) );
            assert.ok( t.every( Number.isFinite ) ); assert.ok( Math.abs( Math.hypot( ...t ) - 1 ) < 1e-6 );
            assert.ok( Math.abs( n.reduce( ( sum, x, k ) => sum + x * t[ k ], 0 ) ) < 1e-6 );
            assert.equal( outT[ v * 4 + 3 ], inT[ v * 4 + 3 ] );
        }
        assert.deepEqual( transformHairTailRelease( tailT, bodyFile ).bytes, transformed.bytes );
        function alterTangent( value ) { const a = value.json.accessors[ attrs( value ).TANGENT ], v = value.json.bufferViews[ a.bufferView ], at = ( v.byteOffset ?? 0 ) + ( a.byteOffset ?? 0 ); value.bin.writeFloatLE( value.bin.readFloatLE( at ) + .1, at ); }
        const badHem = readGlb( hemT ); alterTangent( badHem );
        assert.throws( () => transformHairTailRelease( save( 'altered-hem-tangent.glb', badHem ), bodyFile ), /tangent output changed/ );
        const badTail = readGlb( tailT ); alterTangent( badTail );
        assert.throws( () => transformHairTailRelease( save( 'altered-tail-tangent.glb', badTail ), bodyFile ), /second deformation/ );
    } );
    console.log( `PASS ${ groups } tail-release groups (default source: tracked original→fall→hem).` );
} finally { fs.rmSync( temporary, { recursive: true, force: true } ); }
