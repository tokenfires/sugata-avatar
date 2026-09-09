#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Matrix4 } from 'three';
import { measurePortraitSurface, CALIBRATED_BODY_SHA256 } from './portrait-surface.mjs';
import { CAPTURE_REGION } from './portrait-clearance.mjs';

// Tiny real triangle captures test evidence integrity without requiring ignored browser files.
const directory = fs.mkdtempSync( path.join( os.tmpdir(), 'sugata-pose-integrity-' ) );
const body = [ -.02,1.48,.08, .02,1.48,.08, 0,1.54,.08 ];
const hair = [ 0,1.49,.07, 0,1.49,.09, 0,1.52,.08 ];
const translate = ( values, offset ) => values.map( ( value, i ) => value + offset[ i % 3 ] );
let checks = 0;
function check( name, test ) { test(); checks ++; console.log( `PASS ${ name }` ); }
function capture( { clear = false, shift = [ 0,0,0 ], matrixShift = shift, stopped = false, missing = false, errors = [] } = {} ) {
    const report = { options: { seconds: 1, fps: 1, stride: 1 }, errors,
        descriptor: { cardVertexBase: 0, cardVertexCount: 3, cardIndices: [ 0,1,2 ] },
        samples: [ { frame: 0, time: 0 }, { frame: 1, time: stopped ? 0 : 1 } ] };
    fs.writeFileSync( path.join( directory, 'report.json' ), JSON.stringify( report ) );
    for ( let frame = 0; frame < 2; frame ++ ) {
        const file = path.join( directory, `frame-000${ frame }.json` );
        if ( missing && frame === 1 ) { fs.rmSync( file, { force: true } ); continue; }
        const vertices = clear ? translate( hair, [ .06,0,0 ] ) : hair;
        fs.writeFileSync( file, JSON.stringify( { time: stopped ? 0 : frame,
            verticesSpace: 'world', vertexBase: 0, vertices: translate( vertices, shift ),
            bodyPositions: translate( body, shift ), bodyIndices: [ 0,1,2 ],
            headMatrix: new Matrix4().makeTranslation( ...matrixShift ).toArray() } ) );
    }
}
// These tiny synthetic fixtures exercise metadata adjudication, not real-body clearance.
const read = file => JSON.parse( fs.readFileSync( path.join( directory, file ), 'utf8' ) );
function mutate( file, change ) { const value = read( file ); change( value ); fs.writeFileSync( path.join( directory, file ), JSON.stringify( value ) ); }
function modernCapture( { style = 'bob01', clear = true } = {} ) {
    capture( { clear } );
    const runtime = () => ( { identity: { gender: .5, bake: 'figure_g050' },
        hair: { style, loadedStyle: style, bake: 'figure_g050', attached: true, solver: { chains: 1 } } } );
    mutate( 'report.json', report => {
        Object.assign( report.options, { hair: style, bake: 'g050', url: `http://localhost/src/portrait.html?capture&hair=${ style }` } );
        report.region = { ...CAPTURE_REGION, bodySha256: CALIBRATED_BODY_SHA256 };
        report.sourceHashes = { body: CALIBRATED_BODY_SHA256, groom: 'a'.repeat( 64 ) };
        report.loadedAssets = [ { url: 'http://localhost/body.glb', sha256: report.sourceHashes.body },
            { url: 'http://localhost/groom.glb', sha256: report.sourceHashes.groom } ];
        report.descriptor.report = runtime();
    } );
    for ( let frame = 0; frame < 2; frame ++ ) mutate( `frame-000${ frame }.json`, state => { state.report = runtime(); } );
}
try {
    check( 'a complete intersecting capture rejects both measured poses', () => {
        capture(); const result = measurePortraitSurface( directory );
        assert.equal( result.gate.pass, false ); assert.deepEqual( result.results.map( p => p.face.pairs ), [ 1,1 ] );
    } );
    check( 'a complete clear capture passes with nonempty calibrated geometry', () => {
        capture( { clear: true } ); const result = measurePortraitSurface( directory );
        assert.equal( result.gate.pass, true ); assert.ok( result.results.every( p => p.selectedHairTriangles && p.selectedBodyTriangles ) );
        assert.equal( result.calibration.status, 'legacy-unattested' );
    } );
    check( 'matching world/head translations preserve the intersection verdict', () => {
        capture( { shift: [ 2,3,-4 ] } ); const result = measurePortraitSurface( directory );
        assert.equal( result.gate.pass, false ); assert.deepEqual( result.results.map( p => p.face.pairs ), [ 1,1 ] );
    } );
    check( 'mismatched head coordinates cannot pass by emptying the selection', () => {
        capture( { matrixShift: [ 0,10,0 ] } ); assert.throws( () => measurePortraitSurface( directory ), /Empty calibrated comparison/ );
    } );
    check( 'a stopped clock cannot certify a completed duration', () => {
        capture( { clear: true, stopped: true } ); assert.throws( () => measurePortraitSurface( directory ), /clock does not match/ );
    } );
    check( 'a missing measured frame cannot certify a complete capture', () => {
        capture( { clear: true, missing: true } ); assert.throws( () => measurePortraitSurface( directory ), /frame files/ );
    } );
    check( 'reported rendering errors prevent a geometry certificate', () => {
        capture( { clear: true, errors: [ 'GPU failure' ] } ); assert.throws( () => measurePortraitSurface( directory ), /Capture has errors/ );
    } );
    check( 'both attested g050 styles retain clear and crossing geometric verdicts', () => {
        for ( const style of [ 'bob01', 'bob02' ] ) for ( const clear of [ true, false ] ) {
            modernCapture( { style, clear } ); const result = measurePortraitSurface( directory );
            assert.equal( result.gate.pass, clear ); assert.equal( result.calibration.status, 'attested-g050' );
            assert.equal( result.calibration.hair, style ); assert.equal( result.calibration.bodySha256, CALIBRATED_BODY_SHA256 );
            assert.deepEqual( result.results.map( p => p.face.pairs ), clear ? [ 0,0 ] : [ 1,1 ] );
        }
    } );
    check( 'changed, partial, unknown or unsupported regions cannot produce a pass', () => {
        for ( const change of [ r => { r.minY = 1.5; }, r => { r.maxY = 1.6; }, r => { r.minZ = .09; },
            r => { r.bake = 'g100'; }, r => { r.gender = 1; }, r => { r.calibration = 'unreviewed'; },
            r => { delete r.bodySha256; }, r => { r.minX = -.01; } ] ) {
            modernCapture(); mutate( 'report.json', r => change( r.region ) );
            assert.throws( () => measurePortraitSurface( directory ), /region\/body calibration/ );
        }
    } );
    check( 'a different body cannot inherit calibration even when all recorded hashes agree', () => {
        modernCapture(); mutate( 'report.json', r => {
            r.region.bodySha256 = r.sourceHashes.body = r.loadedAssets[ 0 ].sha256 = 'b'.repeat( 64 );
        } );
        assert.throws( () => measurePortraitSurface( directory ), /region\/body calibration/ );
        modernCapture(); mutate( 'report.json', r => { r.sourceHashes.body = 'b'.repeat( 64 ); } );
        assert.throws( () => measurePortraitSurface( directory ), /source hashes/ );
    } );
    check( 'missing, duplicate or inconsistent loaded responses are rejected', () => {
        for ( const change of [ r => { delete r.loadedAssets; }, r => { r.loadedAssets.pop(); },
            r => { r.loadedAssets.push( r.loadedAssets[ 1 ] ); }, r => { r.loadedAssets[ 0 ].sha256 = 'b'.repeat( 64 ); },
            r => { r.sourceHashes.groom = 'wrong'; } ] ) {
            modernCapture(); mutate( 'report.json', change );
            assert.throws( () => measurePortraitSurface( directory ), /provenance|exactly one loaded|source hashes/ );
        }
    } );
    check( 'descriptor selection and every frame must attest the requested live groom', () => {
        const changes = [ r => { r.hair.loadedStyle = 'bob02'; }, r => { r.hair.attached = false; },
            r => { r.hair.bake = 'figure_g100'; }, r => { r.identity.gender = 1; }, r => { r.hair.solver = null; } ];
        for ( const file of [ 'report.json', 'frame-0001.json' ] ) for ( const change of changes ) {
            modernCapture(); mutate( file, r => change( file === 'report.json' ? r.descriptor.report : r.report ) );
            assert.throws( () => measurePortraitSurface( directory ), /runtime selection disagrees/ );
        }
        modernCapture(); mutate( 'frame-0001.json', r => { delete r.report; } );
        assert.throws( () => measurePortraitSurface( directory ), /runtime selection disagrees/ );
    } );
    check( 'URL conflicts and unsupported explicit selection fail replay validation', () => {
        for ( const change of [ o => { o.url = 'http://localhost/?hair=bob02'; }, o => { o.hair = 'bob03'; },
            o => { o.bake = 'g100'; }, o => { o.url = 'http://localhost/?hair=bob01&gender=1'; } ] ) {
            modernCapture(); mutate( 'report.json', r => change( r.options ) );
            assert.throws( () => measurePortraitSurface( directory ), /contradicts|selection|Only --bake/ );
        }
    } );
    check( 'partial new metadata cannot fall back to the historical unattested path', () => {
        for ( const change of [ r => { r.region = null; }, r => { r.loadedAssets = []; },
            r => { r.options.hair = 'bob01'; }, r => { r.options.bake = 'g050'; }, r => { r.sourceHashes = { body: CALIBRATED_BODY_SHA256 }; } ] ) {
            capture( { clear: true } ); mutate( 'report.json', change );
            assert.throws( () => measurePortraitSurface( directory ), /region\/body calibration/ );
        }
    } );
    console.log( `${ checks }/14 portrait surface integrity checks passed` );
} finally { fs.rmSync( directory, { recursive: true, force: true } ); }
