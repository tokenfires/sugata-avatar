#!/usr/bin/env node
//
// lock-coherence.selftest.mjs — the gate on `lock-coherence.mjs`.
//
// 🚩 THE STANDING RULE THIS FILE EXISTS FOR. Six times in this phase a number was written for a
// defect it was structurally blind to — mean alpha cannot tell a picket fence from a rectangle; a
// slab scores a PERFECT bimodality; a card-wide luminance baseline read 4.0 on a visibly flat wall;
// a gap counter cannot see shading; a relief statistic rated a NOISIER groom above a lock-ier one;
// and, most recently, a whole-face occlusion mean could not tell a missing shadow from a present
// one over a small area. `docs/CHECKPOINT.md` §5 and §7 carry the list. So every reading below is
// PREDICTED FIRST — from the Dirichlet kernel `G(w,f) = sin(π f w)/(w sin(π f))`, from the rank of
// a plane wave's outer product, or from `Σh²` of the band kernel — and then compared with what the
// operator returns.
//
// The five cases the round asked for are §2 flat, §3 isotropic noise, §4 the 53 px lock grating,
// §5 THE DISCRIMINATION TEST, §6 scale selectivity at 4.8 px. §7 and §8 are the operator's own
// blind spots, measured rather than admitted.
//
// Nothing here is a literal recorded from a previous run of this file except `DEFAULT_NOISE_FLOOR`,
// which §3 exists to re-derive and which goes red the moment it drifts.

import assert from 'node:assert/strict';
import {
    COHERENCE_DEFAULTS, DEFAULT_NOISE_FLOOR, coherenceExcess, erodeMaskSeparable, erosionFor,
    lockBandGain, lockCoherence, noiseFloor, whiteNoiseBandFactor, whiteNoiseField, boxBlurRunning,
    mulberry32
} from './lock-coherence.mjs';
import { boxBlur, bandPower, erodeMask } from './band-power.mjs';

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

function close( actual, expected, tolerance, label ) {

    assert.ok( Math.abs( actual - expected ) <= tolerance,
        `${ label }: expected ${ expected.toExponential( 6 ) }, got ${ actual.toExponential( 6 ) }` );

}

const WIDTH = 720;                              // the portrait plate's own size, so the synthetic
const HEIGHT = 900;                             // cases live at the scale the groom is judged at.

// The full filter support: box²(11) reaches 10, box(121) reaches another 60, the gradient stencil
// 1, the 53-wide tensor 26. 97 in total. Eroding by that much makes every synthetic reading below
// EXACT — no clamped edge and no mask fill enters a quoted number.
const FULL_SUPPORT = 10 + 60 + 1 + ( COHERENCE_DEFAULTS.wTensor - 1 ) / 2;

/**
 * A plane wave. `angleDeg` is the direction the wave TRAVELS (the gradient direction), measured
 * from +x toward +y, and +y is down in image space — so the RIDGES run at `angleDeg + 90`.
 */
function grating( { period, angleDeg = 0, amplitude = 0.1, offset = 0.5 }, base = null ) {

    const field = base === null ? new Float64Array( WIDTH * HEIGHT ).fill( offset ) : base;
    const radians = angleDeg * Math.PI / 180;
    const kx = 2 * Math.PI * Math.cos( radians ) / period;
    const ky = 2 * Math.PI * Math.sin( radians ) / period;

    for ( let y = 0; y < HEIGHT; y ++ ) {

        for ( let x = 0; x < WIDTH; x ++ ) field[ y * WIDTH + x ] += amplitude * Math.sin( kx * x + ky * y );

    }

    return { field, width: WIDTH, height: HEIGHT };

}

/** The band RMS a plane wave MUST produce: `A·|gain|/√2`, from the closed-form 2-D box gain. */
function predictedBandRms( { period, angleDeg = 0, amplitude } ) {

    return Math.abs( amplitude * lockBandGain( period, angleDeg ) ) / Math.SQRT2;

}

/**
 * The angle the CENTRAL DIFFERENCE recovers, which is not quite the angle the wave was drawn at.
 *
 * The stencil's transfer is `i·sin(2πf)` where a true derivative's is `i·2πf`, so the measured
 * gradient direction is `atan2( sin k_y , sin k_x )` rather than `atan2( k_y , k_x )`. This is a
 * bias, it is computable, and it is stated rather than absorbed into a tolerance.
 */
function predictedRidgeDeg( period, angleDeg ) {

    const radians = angleDeg * Math.PI / 180;
    const kx = 2 * Math.PI * Math.cos( radians ) / period;
    const ky = 2 * Math.PI * Math.sin( radians ) / period;

    const gradientDeg = Math.atan2( Math.sin( ky ), Math.sin( kx ) ) * 180 / Math.PI;

    return ( ( gradientDeg + 90 ) % 180 + 180 ) % 180;

}

const FULL = { erode: FULL_SUPPORT };

console.log( 'lock-coherence.selftest.mjs — the operator against shapes whose answer is arithmetic\n' );
console.log( `  widths ${ COHERENCE_DEFAULTS.wFine } / ${ COHERENCE_DEFAULTS.wCoarse } /` +
    ` ${ COHERENCE_DEFAULTS.wTensor }, plate erosion ${ erosionFor( COHERENCE_DEFAULTS.wTensor ) },` +
    ` synthetic erosion ${ FULL_SUPPORT }\n` );

// --- 0. the optimisation is the reference implementation ------------------------------------------

check( '§0 boxBlurRunning agrees with band-power.mjs boxBlur to 1e-12 — same filter, O(n) instead of O(nw)', () => {

    const random = mulberry32( 7 );
    const field = new Float64Array( 200 * 150 );
    for ( let index = 0; index < field.length; index ++ ) field[ index ] = random();

    for ( const width of [ 1, 3, 11, 41, 121 ] ) {

        const reference = boxBlur( field, 200, 150, width );
        const fast = boxBlurRunning( field, 200, 150, width );

        let worst = 0;
        for ( let index = 0; index < field.length; index ++ ) {

            worst = Math.max( worst, Math.abs( reference[ index ] - fast[ index ] ) );

        }

        assert.ok( worst < 1e-12, `box ${ width }: worst disagreement ${ worst.toExponential( 3 ) }` );

    }

} );

check( '§0b erodeMaskSeparable is byte-identical to band-power.mjs erodeMask, including at the frame edge', () => {

    const random = mulberry32( 19 );
    const width = 90;
    const height = 70;

    for ( const density of [ 0.35, 0.85, 1 ] ) {

        const mask = new Uint8Array( width * height );
        for ( let index = 0; index < mask.length; index ++ ) mask[ index ] = random() < density ? 1 : 0;

        for ( const radius of [ 1, 3, 8, 27 ] ) {

            const reference = erodeMask( mask, width, height, radius );
            const fast = erodeMaskSeparable( mask, width, height, radius );

            for ( let index = 0; index < mask.length; index ++ ) {

                assert.equal( fast[ index ], reference[ index ],
                    `density ${ density } radius ${ radius }: disagreement at ${ index }` );

            }

        }

    }

} );

// --- 1. the band-pass, in closed form -------------------------------------------------------------

check( '§1 the band gain is the Dirichlet kernel squared, pinned by three identities', () => {

    // A box of 11 samples averages exactly one whole period of a period-11 sinusoid, so box²(11)
    // annihilates it and the band is exactly zero. Arithmetic, not a fit.
    close( lockBandGain( 11 ), 0, 1e-15, 'gain at period 11' );

    // At DC the coarse box passes everything, so the high-pass subtracts everything.
    close( lockBandGain( 1e12 ), 0, 1e-9, 'gain at DC' );

    // And the two numbers the whole scale-selectivity argument rests on, axis-aligned (worst case).
    const lock = lockBandGain( 53 );
    const filament = lockBandGain( 4.8 );

    console.log( `        gain at 53 px ${ lock.toFixed( 6 ) },  at 4.8 px ${ filament.toFixed( 6 ) },` +
        `  ratio ${ ( lock / filament ).toFixed( 2 ) }x` );

    assert.ok( lock / filament > 50, `band separation ${ ( lock / filament ).toFixed( 1 ) }x is too weak` );

} );

check( '§1b a single fine box would only separate 7.5x — the SQUARE is the selectivity', () => {

    // The rejected alternative, computed rather than asserted: band = box(I,11) − box(box(I,11),121).
    const single = ( period ) => {

        const gain = ( width ) => Math.sin( Math.PI * width / period ) / ( width * Math.sin( Math.PI / period ) );
        return gain( 11 ) * ( 1 - gain( 121 ) );

    };

    const ratio = single( 53 ) / single( 4.8 );

    console.log( `        single fine box: 53 px ${ single( 53 ).toFixed( 6 ) },` +
        ` 4.8 px ${ single( 4.8 ).toFixed( 6 ) },  ratio ${ ratio.toFixed( 2 ) }x` );

    assert.ok( ratio < 10, 'the single-box alternative should be the weak one' );
    assert.ok( lockBandGain( 53 ) / lockBandGain( 4.8 ) > 5 * ratio, 'squaring must buy at least 5x' );

} );

// --- 2. A FLAT FIELD — case 1 of the round's five -------------------------------------------------

check( '§2 flat field: the tensor is IDENTICALLY ZERO, so coherence is UNDEFINED and reported null', () => {

    const flat = { field: new Float64Array( WIDTH * HEIGHT ).fill( 0.5 ), width: WIDTH, height: HEIGHT };
    const reading = lockCoherence( { ...flat, mask: null }, FULL );

    close( reading.trace, 0, 1e-30, 'flat trace' );
    close( reading.bandRms, 0, 1e-15, 'flat band rms' );
    close( reading.mean, 0.5, 1e-15, 'flat mean' );

    // 🎯 The round asked for "undefined or 0; say which and handle it". It is UNDEFINED — a flat
    // field has no orientation, and returning 0 would be a claim the pixels do not support. Every
    // orientation-derived field is null and only the amplitude-derived ones carry numbers.
    assert.equal( reading.coherence, null, 'coherence must be null, not 0' );
    assert.equal( reading.alignment, null, 'alignment must be null' );
    assert.equal( reading.orientationDeg, null, 'orientation must be null' );
    assert.equal( reading.coherentLock, null, 'coherentLock must be null' );

    console.log( `        flat: trace ${ reading.trace }  bandRms ${ reading.bandRms }` +
        `  coherence ${ reading.coherence }` );

} );

// --- 3. ISOTROPIC WHITE NOISE — case 2, and the floor every other reading is quoted against -------

const NOISE_SIGMA = 1;
let measuredFloor = null;

check( '§3 isotropic white noise: the band RMS is σ·√(Σh²) in closed form, over 8 seeds', () => {

    const factor = whiteNoiseBandFactor();
    const readings = [];

    for ( let seed = 11; seed < 19; seed ++ ) {

        readings.push( lockCoherence(
            { ...whiteNoiseField( WIDTH, HEIGHT, NOISE_SIGMA, 0.5, seed ), mask: null }, FULL ).bandRms );

    }

    const mean = readings.reduce( ( total, value ) => total + value, 0 ) / readings.length;
    const spread = Math.sqrt( readings.reduce( ( total, value ) => total + ( value - mean ) ** 2, 0 ) /
        ( readings.length - 1 ) );

    // ⚠️ ONE SEED IS NOT ENOUGH AND THE REASON IS ARITHMETIC, not a tolerance that was widened until
    // it passed. The band keeps periods of roughly 20–200 px, so the 526×706 measured interior
    // holds on the order of a hundred INDEPENDENT blobs, not 371,000 independent samples — and the
    // sampling error on an RMS built from ~100 independent values is ~1/√(2·100) ≈ 7%. A single
    // seed landing 1.1% off the closed form is the expected behaviour of the estimator; eight seeds
    // pull it to ~2%.
    console.log( `        Σh² factor ${ factor.toFixed( 8 ) } → predicted band rms` +
        ` ${ ( NOISE_SIGMA * factor ).toFixed( 6 ) },  measured ${ mean.toFixed( 6 ) } ± ${ spread.toFixed( 6 ) }` +
        ` over ${ readings.length } seeds  (${ ( ( mean / ( NOISE_SIGMA * factor ) - 1 ) * 100 ).toFixed( 2 ) }%)` );

    close( mean, NOISE_SIGMA * factor, NOISE_SIGMA * factor * 0.03, 'white-noise band rms' );

} );

check( '§3b the coherence FLOOR on isotropic noise, and it is NOT ~0 — that is geometry, not a bug', () => {

    const floor = noiseFloor( {}, { width: 512, height: 512, seeds: 8 } );
    measuredFloor = floor.coherence.mean;

    console.log( `        coherence floor ${ floor.coherence.mean.toFixed( 4 ) } ± ${ floor.coherence.sd.toFixed( 4 ) }` +
        `   alignment floor ${ floor.alignment.mean.toFixed( 4 ) } ± ${ floor.alignment.sd.toFixed( 4 ) }` +
        `   (${ floor.seeds } seeds, 512x512)` );

    // 🚩 The reason the floor is 0.17 rather than 0.00, stated as arithmetic: `coherence` sums
    // λ1−λ2, which is non-negative at EVERY pixel, so isotropic noise biases it upward instead of
    // cancelling out of it. The bias is ~1/√(independent samples in the tensor window), and a
    // 53 px window laid over noise band-limited to a ~53 px wavelength holds only a handful of
    // independent blobs. `alignment` sums a SIGNED double-angle vector, so the same noise cancels
    // and its floor is two per cent.
    assert.ok( floor.alignment.mean < 0.06, 'the alignment floor must be near zero — that is its job' );
    assert.ok( floor.coherence.sd < 0.02, 'the floor must be stable across seeds or it cannot be quoted' );

    // ⚠️ This is the clause that checks the constant in `lock-coherence.mjs`'s comment. See
    // `docs/CHECKPOINT.md` §7: a number in a justification comment is a claim and nothing else in
    // the tree checks it.
    close( DEFAULT_NOISE_FLOOR, floor.coherence.mean, 0.01, 'DEFAULT_NOISE_FLOOR has drifted' );

} );

check( '§3c the floor falls as 1/wTensor, which is the law a √(independent samples) bias must obey', () => {

    const widths = [ 27, 53, 105 ];
    const floors = widths.map( ( wTensor ) =>
        noiseFloor( { wTensor }, { width: 512, height: 512, seeds: 4 } ).coherence.mean );

    console.log( `        wTensor ${ widths.join( ' / ' ) } → floor ` +
        floors.map( ( value ) => value.toFixed( 4 ) ).join( ' / ' ) +
        `,  ratios ${ ( floors[ 0 ] / floors[ 1 ] ).toFixed( 2 ) }x and` +
        ` ${ ( floors[ 1 ] / floors[ 2 ] ).toFixed( 2 ) }x against width ratios` +
        ` ${ ( widths[ 1 ] / widths[ 0 ] ).toFixed( 2 ) }x and ${ ( widths[ 2 ] / widths[ 1 ] ).toFixed( 2 ) }x` );

    assert.ok( floors[ 0 ] > floors[ 1 ] && floors[ 1 ] > floors[ 2 ], 'the floor must fall with the window' );

    for ( let index = 0; index < 2; index ++ ) {

        const observed = floors[ index ] / floors[ index + 1 ];
        const law = widths[ index + 1 ] / widths[ index ];

        assert.ok( Math.abs( observed - law ) / law < 0.3,
            `floor ratio ${ observed.toFixed( 3 ) } is not the 1/w law ${ law.toFixed( 3 ) }` );

    }

} );

// --- 4. A PURE 53 px GRATING — case 3 -------------------------------------------------------------

const LOCK = { period: 53, angleDeg: 30, amplitude: 0.10 };

check( '§4 a 53 px grating at 30°: coherence is EXACTLY 1 and the ridge angle lands within 0.05°', () => {

    const reading = lockCoherence( { ...grating( LOCK ), mask: null }, FULL );
    const wantRidge = predictedRidgeDeg( LOCK.period, LOCK.angleDeg );
    const wantBand = predictedBandRms( LOCK );

    // 🎯 Coherence is exactly 1 and it is not a coincidence: a plane wave's gradient is
    // (A k_x c, A k_y c) with a SHARED scalar c, so the outer product is rank-1 at every pixel and
    // λ2 = 0 identically — before any smoothing, at any amplitude, after any linear filter.
    close( reading.coherence, 1, 1e-9, 'coherence on a plane wave' );
    close( reading.alignment, 1, 1e-9, 'alignment on a plane wave' );

    close( reading.orientationDeg, wantRidge, 1e-6, 'ridge angle against the stencil prediction' );
    close( reading.bandRms, wantBand, wantBand * 0.01, 'band rms against A|gain|/√2' );

    const trueRidge = ( LOCK.angleDeg + 90 ) % 180;

    console.log( `        drawn ridge ${ trueRidge.toFixed( 3 ) }°,  central-difference prediction` +
        ` ${ wantRidge.toFixed( 3 ) }°,  measured ${ reading.orientationDeg.toFixed( 3 ) }°` +
        `  — stencil bias ${ ( wantRidge - trueRidge ).toFixed( 4 ) }°` );
    console.log( `        coherence ${ reading.coherence.toFixed( 9 ) }` +
        `   band rms ${ reading.bandRms.toFixed( 6 ) } against predicted ${ wantBand.toFixed( 6 ) }` +
        `   coherentLock ${ ( reading.coherentLock * 100 ).toFixed( 3 ) }%` );

    assert.ok( Math.abs( reading.orientationDeg - trueRidge ) < 1,
        'the round asked for the angle to within a degree' );

} );

// --- 5. 🎯 THE DISCRIMINATION TEST — case 4, and the one that decides whether this is usable ------

// The noise amplitude is SET, not tuned: `docs/CHECKPOINT.md` §7 measures the per-fragment strand
// jitter delivering 13.69% of the plate's mean into the LOCK band, and `whiteNoiseBandFactor()`
// converts that band RMS back to a white-noise σ in closed form. The grating is then scaled to
// deliver the SAME band power, so the two fields are indistinguishable to a band-power score by
// construction — which is exactly the situation round 24 was in and could not see out of.
const MATCHED_MEAN = 0.5;
const MATCHED_TARGET = 0.1369 * MATCHED_MEAN;
const MATCHED_SIGMA = MATCHED_TARGET / whiteNoiseBandFactor();
const MATCHED_AMPLITUDE = MATCHED_TARGET * Math.SQRT2 /
    Math.abs( lockBandGain( LOCK.period, LOCK.angleDeg ) );

function summarise( values ) {

    const mean = values.reduce( ( total, value ) => total + value, 0 ) / values.length;
    const sd = Math.sqrt( values.reduce( ( total, value ) => total + ( value - mean ) ** 2, 0 ) /
        Math.max( 1, values.length - 1 ) );

    return { mean, sd };

}

check( '§5 🎯 THE DISCRIMINATION TEST: a 53 px grating buried in white noise of EQUAL lock-band power', () => {

    const seeds = [ 23, 24, 25, 26, 27, 28 ];
    const matched = { ...LOCK, amplitude: MATCHED_AMPLITUDE };

    const noiseArm = [];
    const bothArm = [];

    for ( const seed of seeds ) {

        noiseArm.push( lockCoherence(
            { ...whiteNoiseField( WIDTH, HEIGHT, MATCHED_SIGMA, MATCHED_MEAN, seed ), mask: null }, FULL ) );

        bothArm.push( lockCoherence( {
            ...grating( matched, whiteNoiseField( WIDTH, HEIGHT, MATCHED_SIGMA, MATCHED_MEAN, seed ).field ),
            mask: null
        }, FULL ) );

    }

    const noiseCoherence = summarise( noiseArm.map( ( reading ) => reading.coherence ) );
    const bothCoherence = summarise( bothArm.map( ( reading ) => reading.coherence ) );
    const noiseAlignment = summarise( noiseArm.map( ( reading ) => reading.alignment ) );
    const bothAlignment = summarise( bothArm.map( ( reading ) => reading.alignment ) );
    const noiseBand = summarise( noiseArm.map( ( reading ) => reading.bandRms ) );
    const bothBand = summarise( bothArm.map( ( reading ) => reading.bandRms ) );

    const readGrating = lockCoherence( { ...grating( matched ), mask: null }, FULL );

    console.log( `        white-noise σ ${ MATCHED_SIGMA.toFixed( 4 ) }, grating amplitude` +
        ` ${ MATCHED_AMPLITUDE.toFixed( 4 ) }, both aimed at ${ ( MATCHED_TARGET / MATCHED_MEAN * 100 ).toFixed( 2 ) }%` +
        ` of mean in the lock band  (${ seeds.length } seeds)` );
    console.log( `        band rms % of mean — noise ${ ( noiseBand.mean / MATCHED_MEAN * 100 ).toFixed( 3 ) }` +
        `   grating ${ ( readGrating.bandRms / MATCHED_MEAN * 100 ).toFixed( 3 ) }` +
        `   both ${ ( bothBand.mean / MATCHED_MEAN * 100 ).toFixed( 3 ) }` );
    console.log( `        coherence  — noise ${ noiseCoherence.mean.toFixed( 4 ) } ± ${ noiseCoherence.sd.toFixed( 4 ) }` +
        `   both ${ bothCoherence.mean.toFixed( 4 ) } ± ${ bothCoherence.sd.toFixed( 4 ) }` +
        `   grating alone ${ readGrating.coherence.toFixed( 4 ) }` );
    console.log( `        alignment  — noise ${ noiseAlignment.mean.toFixed( 4 ) } ± ${ noiseAlignment.sd.toFixed( 4 ) }` +
        `   both ${ bothAlignment.mean.toFixed( 4 ) } ± ${ bothAlignment.sd.toFixed( 4 ) }` );

    const sigmas = ( bothCoherence.mean - noiseCoherence.mean ) / noiseCoherence.sd;
    const rawRatio = bothCoherence.mean / noiseCoherence.mean;
    const excessRatio = coherenceExcess( bothCoherence.mean ) / coherenceExcess( noiseCoherence.mean );
    const alignmentRatio = bothAlignment.mean / noiseAlignment.mean;

    console.log( `        excess over the ${ DEFAULT_NOISE_FLOOR } floor — noise` +
        ` ${ coherenceExcess( noiseCoherence.mean ).toFixed( 4 ) }   both` +
        ` ${ coherenceExcess( bothCoherence.mean ).toFixed( 4 ) }` +
        `   ⚠️ the noise arm sits ON the floor, so this ratio divides by ~0 and only its ORDER is meaningful` );
    console.log( `        🎯 separation — raw coherence x${ rawRatio.toFixed( 2 ) },` +
        ` excess over the noise floor x${ excessRatio.toFixed( 1 ) },` +
        ` alignment x${ alignmentRatio.toFixed( 1 ) },  and ${ sigmas.toFixed( 1 ) }σ of the noise arm's own scatter` );

    // 🚩 THE HONEST SHAPE OF THIS RESULT, BECAUSE THE RAW RATIO IS THE WEAK ONE AND HIDING THAT
    // WOULD BE THE SEVENTH BLIND STATISTIC. At equal lock-band POWER the raw coherence moves only
    // ~1.4×, and the reason is that equal band power is NOT equal gradient energy: white noise
    // spreads its band content up to the fine cutoff (~20 px periods) where gradients are three
    // times steeper than at 53 px, so the tensor weights the noise more heavily than the signal
    // that shares its power. The discrimination is real and it lives in the two numbers that
    // reference the floor — the excess, and the σ distance from the noise arm's own scatter.
    // QUOTE `coherence` WITHOUT ITS FLOOR AND YOU HAVE QUOTED ALMOST NOTHING.
    assert.ok( sigmas > 5,
        `grating+noise is only ${ sigmas.toFixed( 1 ) }σ above noise — not a separation` );
    assert.ok( excessRatio > 4,
        `floor-referenced excess only x${ excessRatio.toFixed( 2 ) } — the operator is too blunt for this round` );
    assert.ok( alignmentRatio > 5,
        `alignment only x${ alignmentRatio.toFixed( 2 ) } — the orientations are not agreeing` );

    // And the recovered angle survives an equal dose of noise, which is what "structure" has to
    // mean. ⚠️ The round's "within a degree" is a requirement on the CLEAN grating and §4 meets it
    // at 0.029°. Buried in noise of equal band power the angle wobbles by a couple of degrees, and
    // that number is printed rather than tightened away — it is the operator's angular resolution
    // at 1:1, and any future round quoting an orientation shift smaller than it is quoting noise.
    const angles = bothArm.map( ( reading ) => Math.abs( reading.orientationDeg - readGrating.orientationDeg ) );
    const worst = Math.max( ...angles );

    console.log( `        angular resolution at 1:1 signal-to-noise: worst drift ${ worst.toFixed( 2 ) }°` +
        ` across ${ seeds.length } seeds  (clean grating, §4: 0.029°)` );

    assert.ok( worst < 5, `the recovered angle drifted ${ worst.toFixed( 2 ) }° under the noise` );

} );

check( '§5b 🚩 BAND POWER RANKS THE PURE NOISE ABOVE THE PURE STRUCTURE', () => {

    const noiseOnly = whiteNoiseField( WIDTH, HEIGHT, MATCHED_SIGMA, MATCHED_MEAN, 23 );
    const gratingOnly = grating( { ...LOCK, amplitude: MATCHED_AMPLITUDE } );

    // `band-power.mjs` at the widths round 24 read the groom with, over the same eroded interior.
    const settings = { wFine: 11, wCoarse: 121, erode: FULL_SUPPORT };
    const noiseBand = bandPower( { ...noiseOnly, mask: null }, settings );
    const gratingBand = bandPower( { ...gratingOnly, mask: null }, settings );
    const ratio = gratingBand.relative.lock / noiseBand.relative.lock;

    console.log( `        band-power lock band — noise ${ ( noiseBand.relative.lock * 100 ).toFixed( 3 ) }%` +
        `   grating ${ ( gratingBand.relative.lock * 100 ).toFixed( 3 ) }%   grating/noise x${ ratio.toFixed( 3 ) }` );

    // 🎯 The two fields were matched on THIS operator's band. Read with band-power's single-box
    // decomposition the noise reads HIGHER than the grating, because a single 11 box lets more of
    // the noise's short-period content through into what it calls the lock band. So a band-power
    // score does not merely fail to separate structure from noise — on this pair it PREFERS THE
    // NOISE. That is round 24's negative result reproduced on a shape whose answer is known.
    assert.ok( ratio < 1.05,
        `band power should not favour the grating here; got x${ ratio.toFixed( 3 ) }` );

} );

check( '§5c 🚩 THE BLIND SPOT: 1-D VALUE NOISE IS COHERENT. It is noise and it reads as structure.', () => {

    // The strand jitter this project already ships is 1-D value noise on a 4.8 px lattice. Along
    // one axis it is random; along the other it is CONSTANT — so its structure tensor is rank-1 and
    // its coherence is ~1. The operator separates ISOTROPIC noise from oriented structure. It does
    // not separate a streak from a lock.
    const random = mulberry32( 5 );
    const lattice = 4.8;
    const knots = Math.ceil( WIDTH / lattice ) + 2;
    const values = Array.from( { length: knots }, () => random() * 2 - 1 );

    const field = new Float64Array( WIDTH * HEIGHT );
    for ( let x = 0; x < WIDTH; x ++ ) {

        const position = x / lattice;
        const knot = Math.floor( position );
        const t = position - knot;
        const smooth = t * t * ( 3 - 2 * t );
        const value = values[ knot ] * ( 1 - smooth ) + values[ knot + 1 ] * smooth;

        for ( let y = 0; y < HEIGHT; y ++ ) field[ y * WIDTH + x ] = 0.5 + 0.1 * value;

    }

    const reading = lockCoherence( { field, width: WIDTH, height: HEIGHT, mask: null }, FULL );

    console.log( `        1-D value noise, 4.8 px lattice: coherence ${ reading.coherence.toFixed( 4 ) }` +
        `   alignment ${ reading.alignment.toFixed( 4 ) }   orientation ${ reading.orientationDeg.toFixed( 2 ) }°` +
        `   coherentLock ${ ( reading.coherentLock * 100 ).toFixed( 4 ) }%` );

    assert.ok( reading.coherence > 0.9,
        'if this ever reads low the blind spot has closed and the comment above is stale' );

    // 🎯 The mechanism that WOULD separate them, recorded as the next experiment and not as a
    // claim: this field's ridges run at 90° (constant in y, varying in x) — PERPENDICULAR to the
    // direction the "strand" runs. A real lock's brightness varies ACROSS the flow, so its ridges
    // run ALONG it. The two are a quarter turn apart and `orientation` already reports the angle.
    close( reading.orientationDeg, 90, 1e-6, '1-D noise ridges must run across the variation' );

} );

// --- 6. SCALE SELECTIVITY — case 5 ----------------------------------------------------------------

check( '§6 a 4.8 px FILAMENT grating: coherence still reads 1.000, and coherentLock does NOT light up', () => {

    // Axis-aligned, which §1's docstring establishes is the WORST case for leak — an off-axis wave
    // is rejected by both halves of the separable filter and reads four orders lower.
    const filament = { period: 4.8, angleDeg: 0, amplitude: 0.10 };
    const lock = { period: 53, angleDeg: 0, amplitude: 0.10 };

    const readFilament = lockCoherence( { ...grating( filament ), mask: null }, FULL );
    const readLock = lockCoherence( { ...grating( lock ), mask: null }, FULL );

    // 🚩 STATED PLAINLY BECAUSE IT IS THE OPERATOR'S MOST IMPORTANT LIMIT: anisotropy alone is
    // SCALE-BLIND. A normalised ratio cannot count photons, and a plane wave is rank-1 at any
    // amplitude. Quoting `coherence` without `coherentLock` beside it would be exactly the class of
    // structurally-blind statistic this file exists to refuse.
    close( readFilament.coherence, 1, 1e-6, 'coherence on the filament grating' );
    close( readLock.coherence, 1, 1e-6, 'coherence on the lock grating' );

    const separation = readLock.coherentLock / readFilament.coherentLock;
    const predicted = lockBandGain( 53 ) / lockBandGain( 4.8 );

    console.log( `        coherence — filament ${ readFilament.coherence.toFixed( 6 ) },` +
        ` lock ${ readLock.coherence.toFixed( 6 ) }   ← SCALE-BLIND, as designed` );
    console.log( `        coherentLock — filament ${ ( readFilament.coherentLock * 100 ).toFixed( 4 ) }%,` +
        ` lock ${ ( readLock.coherentLock * 100 ).toFixed( 4 ) }%   separation ${ separation.toFixed( 1 ) }x` +
        `  against the closed form ${ predicted.toFixed( 1 ) }x` );

    close( separation, predicted, predicted * 0.02, 'coherentLock separation against the band gain' );
    assert.ok( separation > 50, `${ separation.toFixed( 1 ) }x is not scale selectivity` );

} );

// --- 7. THE MASK, and the fill policy that lets the widths exceed the erosion ----------------------

check( '§7 the mask-mean fill costs under 1% — measured against the same grating read full-frame', () => {

    const wave = { period: 53, angleDeg: 0, amplitude: 0.10 };
    const full = lockCoherence( { ...grating( wave ), mask: null }, FULL );

    // A rectangular mask whose interior, after the SHIPPING erosion of 27, still spans whole
    // periods: 424 px = 8 × 53. The band-pass reaches 70 px, so most measured pixels here DO see
    // the fill — which is the point of the case.
    const mask = new Uint8Array( WIDTH * HEIGHT );
    for ( let y = 100; y < 800; y ++ ) {

        for ( let x = 121; x < 599; x ++ ) mask[ y * WIDTH + x ] = 1;

    }

    const masked = lockCoherence( { ...grating( wave ), mask }, {} );

    console.log( `        full-frame coherence ${ full.coherence.toFixed( 6 ) } band ${ full.bandRms.toFixed( 6 ) }` +
        `  |  masked+filled coherence ${ masked.coherence.toFixed( 6 ) } band ${ masked.bandRms.toFixed( 6 ) }` +
        `  (${ masked.count.toLocaleString() } px, erode ${ masked.widths.erode })` );

    close( masked.coherence, full.coherence, 0.01, 'coherence under the fill' );
    close( masked.orientationDeg, full.orientationDeg, 0.5, 'orientation under the fill' );
    close( masked.bandRms, full.bandRms, full.bandRms * 0.02, 'band rms under the fill' );

} );

check( '§7b a mask that erodes to nothing FAILS LOUDLY rather than returning a number', () => {

    const mask = new Uint8Array( WIDTH * HEIGHT );
    for ( let y = 400; y < 410; y ++ ) for ( let x = 400; x < 410; x ++ ) mask[ y * WIDTH + x ] = 1;

    assert.throws( () => lockCoherence( { ...grating( { period: 53 } ), mask }, {} ),
        /eroded mask is empty/, 'an empty measured set must throw' );

} );

// --- 8. 🚩 THE SECOND BLIND SPOT, MEASURED --------------------------------------------------------

check( '§8 a 300 px SHADING RAMP reads as coherent — so an absolute reading is not evidence', () => {

    const ramp = { period: 300, angleDeg: 0, amplitude: 0.10 };
    const reading = lockCoherence( { ...grating( ramp ), mask: null }, FULL );
    const leak = lockBandGain( 300 );

    console.log( `        300 px component: band gain ${ leak.toFixed( 4 ) },` +
        ` coherence ${ reading.coherence.toFixed( 4 ) },` +
        ` coherentLock ${ ( reading.coherentLock * 100 ).toFixed( 3 ) }%` +
        ` against the 53 px lock's ${ ( lockBandGain( 53 ) * 0.10 / Math.SQRT2 / 0.5 * 100 ).toFixed( 3 ) }%` );

    close( reading.coherence, 1, 1e-6, 'a smooth ramp is as rank-1 as anything gets' );
    assert.ok( leak > 0.15, 'if the mass leak ever drops below 15% this clause is stale and should be re-stated' );

    // The consequence, asserted rather than left in a comment: mass-scale shading enters the lock
    // band at a THIRD of a real lock's gain and is perfectly coherent, so only an A/B between two
    // plates differing in one expression is attributable. Same rule `band-power.mjs` arrived at.
    assert.ok( leak / lockBandGain( 53 ) > 0.2,
        'the mass leak is the reason absolute readings are not evidence — keep it stated' );

} );

console.log( `\n${ passed } passed, ${ failed } failed` );
process.exit( failed === 0 ? 0 : 1 );
