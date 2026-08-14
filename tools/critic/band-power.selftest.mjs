#!/usr/bin/env node
//
// band-power.selftest.mjs — the gate on `band-power.mjs`, and it is written the way this project's
// five blind statistics say a new operator has to be gated.
//
// 🚩 THE STANDING RULE THIS FILE EXISTS FOR. Five times in the hair phase a number was written for a
// defect it could not see — mean alpha cannot tell a picket fence from a rectangle; a slab scores a
// PERFECT bimodality; a card-wide luminance baseline read 4.0 on a visibly flat wall. Every one of
// those would have been caught by pointing the operator at a shape whose answer is arithmetic.
//
// So every reading below is PREDICTED FIRST, in closed form, from the Dirichlet kernel
// `G(w,f) = sin(π f w)/(w sin(π f))`, and then compared with what the operator returns. Nothing here
// is a literal recorded from a previous run — the only literals are two provable identities
// (`G(5, 1/2.5) = 0` and `G(41, 1/2.5) = 1/41`) which pin the closed form itself.
//
// The four cases the round asked for are §2–§5. §6 is the operator's own BLIND SPOT, measured
// rather than admitted: a step edge is broadband and lands in every band at once.

import assert from 'node:assert/strict';
import {
    BAND_DEFAULTS, bandGains, bandPower, boxBlur, boxGain, erodeMask
} from './band-power.mjs';

let passed = 0;
let failed = 0;

function check( name, run ) {

    try {

        run();
        passed += 1;
        console.log( `  ok    ${ name }` );

    } catch ( error ) {

        failed += 1;
        console.log( `  FAIL  ${ name }\n        ${ error.message.split( '\n' )[ 0 ] }` );

    }

}

const WIDTH = 720;
const HEIGHT = 900;
const ERODE = BAND_DEFAULTS.erode;              // 20, i.e. (41 − 1) / 2

/** A field that varies in x only, so the vertical half of the separable filter has gain exactly 1. */
function gratingField( components, offset = 0.5 ) {

    const field = new Float64Array( WIDTH * HEIGHT );

    for ( let y = 0; y < HEIGHT; y ++ ) {

        for ( let x = 0; x < WIDTH; x ++ ) {

            let value = offset;
            for ( const { period, amplitude } of components ) {

                value += amplitude * Math.sin( 2 * Math.PI * x / period );

            }

            field[ y * WIDTH + x ] = value;

        }

    }

    return { field, width: WIDTH, height: HEIGHT };

}

/**
 * The reading a grating MUST produce, computed on paper.
 *
 * A symmetric box filter multiplies a sinusoid by a real gain and leaves its phase alone, so each
 * band is itself a sinusoid of amplitude `A·gain` and its RMS over an integer number of periods is
 * `A·|gain|/√2` exactly. Two components at different frequencies are orthogonal over a common
 * period, so their RMS values add in quadrature — which is why the measured window below is chosen
 * to span whole periods of both.
 */
function predicted( components ) {

    const total = { filament: 0, lock: 0, mass: 0 };

    for ( const { period, amplitude } of components ) {

        const gains = bandGains( period );

        for ( const band of Object.keys( total ) ) {

            total[ band ] += ( amplitude * gains[ band ] / Math.SQRT2 ) ** 2;

        }

    }

    return {
        filament: Math.sqrt( total.filament ),
        lock: Math.sqrt( total.lock ),
        mass: Math.sqrt( total.mass )
    };

}

function close( actual, expected, tolerance, label ) {

    assert.ok( Math.abs( actual - expected ) <= tolerance,
        `${ label }: expected ${ expected.toExponential( 6 ) }, got ${ actual.toExponential( 6 ) }` );

}

console.log( 'band-power.selftest.mjs — the operator against shapes whose answer is arithmetic\n' );

// --- 1. the closed form itself ------------------------------------------------------------------

check( 'boxGain is the Dirichlet kernel, and two identities pin it', () => {

    // A box of 5 samples averages exactly one whole period of a period-2.5 sinusoid, so it is
    // annihilated. Not a fit and not a measurement — arithmetic.
    close( boxGain( 5, 1 / 2.5 ), 0, 1e-12, 'G(5, 1/2.5)' );

    // 41·0.4 = 16.4, and sin(16.4π) = sin(0.4π), so the numerator and the denominator's sine
    // cancel and the gain is exactly 1/41.
    close( boxGain( 41, 1 / 2.5 ), 1 / 41, 1e-12, 'G(41, 1/2.5)' );

    // DC passes untouched, whatever the width.
    close( boxGain( 41, 0 ), 1, 1e-12, 'G(41, 0)' );

} );

check( 'boxBlur at width 1 is the identity, and its gain matches boxGain', () => {

    const { field } = gratingField( [ { period: 20, amplitude: 0.1 } ] );
    const same = boxBlur( field, WIDTH, HEIGHT, 1 );

    for ( let index = 0; index < 1000; index ++ ) close( same[ index ], field[ index ], 1e-12, 'width 1' );

    const blurred = boxBlur( field, WIDTH, HEIGHT, 5 );
    const centre = 450 * WIDTH + 360;
    const expected = 0.5 + 0.1 * boxGain( 5, 1 / 20 ) * Math.sin( 2 * Math.PI * 360 / 20 );

    close( blurred[ centre ], expected, 1e-12, 'boxBlur gain against boxGain' );

} );

check( 'erodeMask leaves exactly the pixels whose square support is inside the mask', () => {

    const mask = new Uint8Array( 21 * 21 ).fill( 1 );
    const eroded = erodeMask( mask, 21, 21, 5 );

    let kept = 0;
    for ( const value of eroded ) kept += value;

    assert.equal( kept, 11 * 11, 'a 21x21 mask eroded by 5 leaves 11x11' );
    assert.equal( eroded[ 10 * 21 + 10 ], 1, 'the centre survives' );
    assert.equal( eroded[ 4 * 21 + 10 ], 0, 'a pixel 4 rows from the edge does not' );

} );

// --- 2. a FLAT FIELD — every band must read zero -------------------------------------------------

check( '§2 flat field: all three bands are zero', () => {

    const flat = gratingField( [] );
    const reading = bandPower( { ...flat, mask: null } );

    close( reading.mean, 0.5, 1e-12, 'flat mean' );
    close( reading.filament, 0, 1e-12, 'flat filament' );
    close( reading.lock, 0, 1e-12, 'flat lock' );
    close( reading.mass, 0, 1e-12, 'flat mass' );

    console.log( `        flat: filament ${ reading.filament.toExponential( 2 ) }` +
        `  lock ${ reading.lock.toExponential( 2 ) }  mass ${ reading.mass.toExponential( 2 ) }` );

} );

// --- 3. a PURE FILAMENT GRATING, period 2.5 px ---------------------------------------------------

const FILAMENT = [ { period: 2.5, amplitude: 0.10 } ];
const LOCK = [ { period: 20, amplitude: 0.10 } ];

check( '§3 filament grating (2.5 px): the fine band takes it all', () => {

    const reading = bandPower( { ...gratingField( FILAMENT ), mask: null } );
    const want = predicted( FILAMENT );

    close( reading.filament, want.filament, 1e-9, 'filament band' );
    close( reading.lock, want.lock, 1e-9, 'lock band' );
    close( reading.mass, want.mass, 1e-9, 'mass band' );

    // The paper answer, stated so a reader does not have to run the predictor: the fine box kills
    // period 2.5 exactly, so the filament band is A/√2 and the lock band is A/(41√2).
    close( want.filament, 0.10 / Math.SQRT2, 1e-12, 'A/√2' );
    close( want.lock, 0.10 / ( 41 * Math.SQRT2 ), 1e-12, 'A/(41√2)' );

    console.log( `        filament grating: filament ${ reading.filament.toFixed( 6 ) }` +
        `  lock ${ reading.lock.toFixed( 6 ) }  mass ${ reading.mass.toFixed( 6 ) }` );

} );

// --- 4. a PURE LOCK GRATING, period 20 px --------------------------------------------------------

check( '§4 lock grating (20 px): the lock band takes it', () => {

    const reading = bandPower( { ...gratingField( LOCK ), mask: null } );
    const want = predicted( LOCK );

    close( reading.filament, want.filament, 1e-9, 'filament band' );
    close( reading.lock, want.lock, 1e-9, 'lock band' );
    close( reading.mass, want.mass, 1e-9, 'mass band' );

    console.log( `        lock grating:     filament ${ reading.filament.toFixed( 6 ) }` +
        `  lock ${ reading.lock.toFixed( 6 ) }  mass ${ reading.mass.toFixed( 6 ) }` );

} );

// --- 5. THE SUM, which is the case that decides whether the operator SEPARATES --------------------

check( '§5 sum of both gratings: each band reads its own component, in quadrature', () => {

    const both = [ ...FILAMENT, ...LOCK ];
    const reading = bandPower( { ...gratingField( both ), mask: null } );
    const want = predicted( both );

    close( reading.filament, want.filament, 1e-9, 'filament band' );
    close( reading.lock, want.lock, 1e-9, 'lock band' );

    console.log( `        sum:              filament ${ reading.filament.toFixed( 6 ) }` +
        `  lock ${ reading.lock.toFixed( 6 ) }  mass ${ reading.mass.toFixed( 6 ) }` );

} );

check( '§5b THE SEPARATION IS 375x, so the operator is not blind to the difference', () => {

    const fromFilament = bandPower( { ...gratingField( FILAMENT ), mask: null } );
    const fromLock = bandPower( { ...gratingField( LOCK ), mask: null } );

    const filamentRatio = fromFilament.lock / fromFilament.filament;
    const lockRatio = fromLock.lock / fromLock.filament;

    // 🎯 THE ONE NUMBER THAT SAYS THIS OPERATOR IS USABLE. A statistic that returned the same
    // lock/filament ratio for both gratings would be exactly the class of blind statistic this
    // whole file exists to refuse.
    const separation = lockRatio / filamentRatio;

    console.log( `        lock/filament ratio — filament grating ${ filamentRatio.toFixed( 5 ) },` +
        ` lock grating ${ lockRatio.toFixed( 3 ) }, separation ${ separation.toFixed( 1 ) }x` );

    assert.ok( separation > 300, `separation ${ separation.toFixed( 1 ) }x is too small to attribute` );

    // And the arithmetic prediction of that separation, so the ratio is not a recorded number:
    const want = ( bandGains( 20 ).lock / bandGains( 20 ).filament ) /
        ( bandGains( 2.5 ).lock / bandGains( 2.5 ).filament );

    close( separation, Math.abs( want ), Math.abs( want ) * 1e-6, 'predicted separation' );

} );

// --- 6. 🚩 THE BLIND SPOT, MEASURED ---------------------------------------------------------------

check( '§6 a STEP EDGE is broadband — this operator cannot tell a lock from a card border', () => {

    const field = new Float64Array( WIDTH * HEIGHT );

    for ( let y = 0; y < HEIGHT; y ++ ) {

        for ( let x = 0; x < WIDTH; x ++ ) field[ y * WIDTH + x ] = x < WIDTH / 2 ? 0.4 : 0.6;

    }

    const reading = bandPower( { field, width: WIDTH, height: HEIGHT, mask: null } );

    console.log( `        step edge:        filament ${ reading.filament.toFixed( 6 ) }` +
        `  lock ${ reading.lock.toFixed( 6 ) }  mass ${ reading.mass.toFixed( 6 ) }` );

    assert.ok( reading.filament > 0 && reading.lock > 0 && reading.mass > 0,
        'a step must show in every band — if it does not, the decomposition is wrong' );

    // The consequence, asserted rather than written in a comment: the edge puts MORE in the lock
    // band than in the filament band, so an absolute lock reading is not evidence of lock structure
    // and only an A/B between two plates differing in one expression is attributable.
    assert.ok( reading.lock > reading.filament,
        'a step edge should load the coarse band more than the fine one' );

} );

// --- 7. the mask, because every real reading runs through one ------------------------------------

check( '§7 a mask restricts the reading, and erosion keeps the filter support inside it', () => {

    const grating = gratingField( LOCK );
    const mask = new Uint8Array( WIDTH * HEIGHT );

    for ( let y = 200; y < 700; y ++ ) {

        for ( let x = 200; x < 520; x ++ ) mask[ y * WIDTH + x ] = 1;

    }

    const reading = bandPower( { ...grating, mask } );
    const want = predicted( LOCK );

    // The masked window is 280 px wide after erosion, which is 14 whole periods of the 20 px
    // grating, so the RMS is still exactly A|gain|/√2.
    assert.equal( reading.count, ( 500 - 2 * ERODE ) * ( 320 - 2 * ERODE ), 'eroded pixel count' );
    close( reading.lock, want.lock, 1e-9, 'lock band under a mask' );

} );

console.log( `\n${ passed } passed, ${ failed } failed` );
process.exit( failed === 0 ? 0 : 1 );
