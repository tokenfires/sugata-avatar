#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Matrix4 } from 'three';
import { measurePortraitSurface } from './portrait-surface.mjs';

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
try {
    check( 'a complete intersecting capture rejects both measured poses', () => {
        capture(); const result = measurePortraitSurface( directory );
        assert.equal( result.gate.pass, false ); assert.deepEqual( result.results.map( p => p.face.pairs ), [ 1,1 ] );
    } );
    check( 'a complete clear capture passes with nonempty calibrated geometry', () => {
        capture( { clear: true } ); const result = measurePortraitSurface( directory );
        assert.equal( result.gate.pass, true ); assert.ok( result.results.every( p => p.selectedHairTriangles && p.selectedBodyTriangles ) );
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
    console.log( `${ checks }/7 portrait surface integrity checks passed` );
} finally { fs.rmSync( directory, { recursive: true, force: true } ); }
