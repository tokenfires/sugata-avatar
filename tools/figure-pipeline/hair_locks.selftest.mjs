#!/usr/bin/env node
//
// hair_locks.selftest.mjs — the corrugation operator against shapes whose answer is known on paper,
// BEFORE it is pointed at a groom.
//
// 🚩 **STANDING RULE 4 IS WHY THIS FILE IS LONGER THAN THE TOOL'S OWN MEASUREMENT PATH.** Four
// rounds of this phase ran a headline statistic that was blind to the defect it was quoted about —
// a runs-per-row count that could not see the sampler, a screen operator with a baseline one card
// wide that passed a flat wall, a gather ratio that reads identically for sixteen locks and for a
// shell squeezed 15%. Every one of them was plausible, and none had ever been shown an input whose
// answer was known first.
//
// So the operator is pinned against six shapes, in this order:
//
//   1. **A CYLINDER.** `r(θ) = R`. Detrended residual is exactly zero, RMS zero, no peaks. If this
//      fails the tool is measuring its own arithmetic.
//   2. **AN OVAL.** `r(θ) = R + e·cos 2θ` — the skull. Harmonic 2 is inside the detrend basis, so
//      the residual is exactly zero AGAIN, on a shape whose raw profile varies by 2e. This is the
//      clause that separates "the groom has locks" from "the head is not round", and it is the one
//      a running-mean baseline would fail.
//   3. **A LOBED SHELL.** `r(θ) = R + A·cos nθ` for n = 16. Harmonics are orthogonal, so the fit of
//      the 0–3 basis is `R` exactly and the residual is `A·cos 16θ` exactly: RMS = A/√2 = 0.7071·A,
//      and 16 peaks. Both numbers are arithmetic, not tolerance.
//   4. **A LOBED SHELL WITH FLYAWAYS.** The same, plus one vertex per bin at `R + 6A`. At
//      percentile 1.0 the profile is the flyaway and the reading is destroyed; at the shipped 0.85
//      it is unmoved. This is the clause that says the tool measures the MASS.
//   5. **A RING WITH A QUARTER MISSING.** A groom does not reach every azimuth at every height, so
//      the NaN path is on the measurement path and gets an assertion rather than a hope.
//   6. **SCATTER, AND SCATTER WITH A RIDGE INSIDE IT.** 🚩 **THIS IS THE ONE THE TOOL WAS REWRITTEN
//      FOR.** The first version reported 7.29 mm of relief on the shipped groom and 21.6 peaks a
//      band, which reads like a head full of locks, and its field map was STATIC. A shell whose
//      radius wobbles independently in every band measures MORE relief than a shell with sixteen
//      real ridges on it — 5.73 mm against 2.83 — so relief alone would have called the noisier
//      groom the better one. `coherence` and `coherentReliefMm` are what separate them, and clause
//      6 pins the arithmetic: equal parts ridge and scatter correlate at exactly r = ½ and hand the
//      ridge's own amplitude back out of the mixture.
//
// And then the field map is printed for shape 3, because an operator that has only ever been
// asserted about has only ever been half looked at.
//
//   node tools/figure-pipeline/hair_locks.selftest.mjs

import {
    HEAD_HARMONICS, PROFILE_DEFAULTS, corrugation, cylindrical, detrendCircular, envelopeProfile,
    fieldMap, measureGroom
} from './hair_locks.mjs';

let checks = 0;
let failures = 0;

function near( actual, expected, tolerance, what ) {

    checks += 1;
    const ok = Math.abs( actual - expected ) <= tolerance;
    if ( ! ok ) failures += 1;
    console.log( `  ${ ok ? 'ok  ' : 'FAIL' } ${ what }` );
    if ( ! ok ) console.log( `       expected ${ expected } ± ${ tolerance }, measured ${ actual }` );

}

function same( actual, expected, what ) {

    checks += 1;
    const ok = actual === expected;
    if ( ! ok ) failures += 1;
    console.log( `  ${ ok ? 'ok  ' : 'FAIL' } ${ what }` );
    if ( ! ok ) console.log( `       expected ${ expected }, measured ${ actual }` );

}

/**
 * A shell of points whose radius is a named function of azimuth, sampled at BIN CENTRES.
 *
 * ⚠️ **THE BIN CENTRES ARE THE WHOLE TRICK AND WITHOUT THEM NO IDENTITY BELOW HOLDS.** A bin is 3°
 * of azimuth and a sixteen-lobed profile turns 48° of phase inside one of them, so a bin filled
 * with points at scattered azimuths reports the largest radius the lobe reaches ANYWHERE in that
 * 48°, not the lobe's value at the bin. The measured RMS then exceeds A/√2 by a bias that depends
 * on the bin width and the lobe count, and the test would be pinning the sampling rather than the
 * operator. One azimuth per bin, several vertices stacked on it, and the profile is `r(θ_bin)`.
 */
function shell( radiusOf, { bins, levels = 48, perBin = 6, low = 1.30, high = 1.66, extra = null } ) {

    const positions = [];
    for ( let bin = 0; bin < bins; bin ++ ) {

        const theta = 2 * Math.PI * ( bin + 0.5 ) / bins - Math.PI;
        const radius = radiusOf( theta );

        for ( let level = 0; level < levels; level ++ ) {

            const y = low + ( high - low ) * level / ( levels - 1 );
            for ( let repeat = 0; repeat < perBin; repeat ++ ) {

                positions.push( radius * Math.cos( theta ), y, radius * Math.sin( theta ) );

            }

            if ( extra !== null ) positions.push( extra * Math.cos( theta ), y, extra * Math.sin( theta ) );

        }

    }

    return positions;

}

console.log( '' );
console.log( 'hair_locks.mjs — the operator against shapes whose answer is known first' );
console.log( '' );

// --- 0. the coordinate change itself --------------------------------------------------------
console.log( '--- cylindrical coordinates ---' );
{
    // A ring of radius 0.1 centred on (0.5, 0, -0.25), so nothing here can pass by accident on a
    // point set that happens to be centred on the origin.
    const positions = [];
    for ( let step = 0; step < 64; step ++ ) {

        const theta = 2 * Math.PI * step / 64;
        positions.push( 0.5 + 0.1 * Math.cos( theta ), 1.4, - 0.25 + 0.1 * Math.sin( theta ) );

    }

    const { radius, height, centre } = cylindrical( positions );
    near( centre[ 0 ], 0.5, 1e-12, 'the axis is found at the point set\'s own x' );
    near( centre[ 1 ], - 0.25, 1e-12, 'the axis is found at the point set\'s own z' );
    near( Math.min( ...radius ), 0.1, 1e-12, 'every point of a ring reads one radius' );
    near( Math.max( ...radius ), 0.1, 1e-12, 'every point of a ring reads one radius' );
    near( height[ 0 ], 1.4, 1e-12, 'height is y — glTF is Y-up and the build is Z-up' );
}

// --- 1. a cylinder --------------------------------------------------------------------------
console.log( '' );
console.log( '--- 1. a cylinder: r = R ---' );
{
    const reading = measureGroom( shell( () => 0.095, { bins: 128 } ), { azimuthBins: 128 } );
    near( reading.reliefMm, 0, 1e-9, 'a cylinder has no relief at all' );
    near( reading.peaks, 0, 0, 'a cylinder has no lock in it' );
    same( reading.bandsUsed, 10, 'ten interior bands of twelve are measured' );
}

// --- 2. an oval — the skull -----------------------------------------------------------------
console.log( '' );
console.log( '--- 2. an oval: r = R + e·cos 2θ, the shape the detrend exists to remove ---' );
{
    const R = 0.095;
    const e = 0.025;                                  // 25 mm — bigger than any lock will ever be
    const positions = shell( ( theta ) => R + e * Math.cos( 2 * theta ), { bins: 128 } );
    const { bands } = envelopeProfile( positions, { azimuthBins: 128 } );

    // 2e·cos(π/64): the same half-bin offset as the lobed shell below, two bins per period of an
    // oval rather than eight, so the shortfall here is 0.12% instead of 7.6%.
    const raw = bands[ 4 ].profile;
    near( Math.max( ...raw ) - Math.min( ...raw ), 2 * e * Math.cos( Math.PI / 64 ), 1e-12,
        'the RAW profile of an oval swings 2e — the signal the detrend has to survive' );

    const reading = measureGroom( positions, { azimuthBins: 128 } );
    near( reading.reliefMm, 0, 1e-9, 'and the detrended relief is zero: harmonic 2 is the head' );
    near( reading.peaks, 0, 0, 'an oval head is not two locks' );

    // The same shape read with a detrend that CANNOT remove it, which is what a tool with no
    // detrend at all would report — 17.7 mm of "relief" on a shell with no groom on it.
    const undetrended = corrugation( detrendCircular( raw, 0 ), PROFILE_DEFAULTS.prominenceM );
    near( undetrended.rms * 1000, e * 1000 / Math.SQRT2, 1e-9,
        'with harmonics 0 only, the oval IS the reading — 17.68 mm of skull' );
}

// --- 3. sixteen locks -----------------------------------------------------------------------
console.log( '' );
console.log( '--- 3. a lobed shell: r = R + A·cos 16θ ---' );
{
    const R = 0.095;
    const A = 0.004;                                  // 4 mm ridges
    const lobed = ( theta ) => R + A * Math.cos( 16 * theta );

    // 128 bins is exactly 8 per lobe, so the identity is arithmetic and not sampling.
    const aligned = measureGroom( shell( lobed, { bins: 128 } ), { azimuthBins: 128 } );
    near( aligned.reliefMm, A * 1000 / Math.SQRT2, 1e-9,
        'RMS of A·cos nθ is A/√2 — 4 mm of ridge reads 2.828 mm of relief' );
    near( aligned.peaks, 16, 0, 'sixteen ridges are counted as sixteen' );

    // ⚠️ Peak to trough is 2A·cos(π/8), NOT 2A, and the shortfall is the SAMPLING rather than the
    // operator: a bin is read at its centre and eight bins per lobe puts the nearest centre half a
    // bin — π/8 of phase — off the crest. The RMS above is unaffected because the mean of cos²
    // over eight uniformly offset phases is exactly ½ wherever the offset sits.
    near( aligned.peakToTroughMm, 2 * A * 1000 * Math.cos( Math.PI / 8 ), 1e-9,
        'peak to trough is 2A·cos(π/8) — the crest falls between two bin centres' );

    // And at the SHIPPED bin count, which is not a whole number of bins per lobe.
    const shipped = measureGroom( shell( lobed, { bins: PROFILE_DEFAULTS.azimuthBins } ) );
    near( shipped.peaks, 16, 0, 'still sixteen at the shipped 120 bins — 7.5 bins per lobe' );
    near( shipped.reliefMm, A * 1000 / Math.SQRT2, 0.01,
        'and the relief is within 10 µm of A/√2 at 7.5 bins per lobe' );

    // 🎯 The direction check the whole round turns on: MORE lobes of the same amplitude is the same
    // relief, and DEEPER lobes is more relief. A statistic that moved with the count would be
    // measuring the groom's card count rather than its lock structure.
    const thirtyTwo = measureGroom( shell( ( theta ) => R + A * Math.cos( 32 * theta ), { bins: 128 } ),
        { azimuthBins: 128 } );
    near( thirtyTwo.reliefMm, A * 1000 / Math.SQRT2, 1e-9, 'relief is independent of the lock COUNT' );
    near( thirtyTwo.peaks, 32, 0, 'and the count is what the peak number reports' );

    const deeper = measureGroom( shell( ( theta ) => R + 2 * A * Math.cos( 16 * theta ), { bins: 128 } ),
        { azimuthBins: 128 } );
    near( deeper.reliefMm, 2 * A * 1000 / Math.SQRT2, 1e-9, 'relief IS the groove depth' );

    // A ridge shallower than the prominence floor is not a groove anybody can see.
    const shallow = measureGroom( shell( ( theta ) => R + 0.0004 * Math.cos( 16 * theta ), { bins: 128 } ),
        { azimuthBins: 128 } );
    near( shallow.peaks, 0, 0, 'a 0.4 mm ripple is under the 1 mm prominence floor and is not a lock' );
}

// --- 4. the flyaways ------------------------------------------------------------------------
console.log( '' );
console.log( '--- 4. the same shell with one flyaway per bin at R + 6A ---' );
{
    const R = 0.095;
    const A = 0.004;
    const positions = shell( ( theta ) => R + A * Math.cos( 16 * theta ),
        { bins: 128, extra: R + 6 * A } );

    const mass = measureGroom( positions, { azimuthBins: 128 } );
    near( mass.reliefMm, A * 1000 / Math.SQRT2, 1e-9,
        'at the shipped 0.85 percentile the wisps are outside the reading' );
    near( mass.peaks, 16, 0, 'and the sixteen locks are still there' );

    const outermost = measureGroom( positions, { azimuthBins: 128, percentile: 1.0 } );
    near( outermost.reliefMm, 0, 1e-9,
        'at percentile 1.0 the profile IS the flyaway ring and the locks vanish' );
    near( outermost.peaks, 0, 0, 'which is the reading a max-radius operator would have shipped' );
}

// --- 5. gaps --------------------------------------------------------------------------------
console.log( '' );
console.log( '--- 5. an incomplete ring ---' );
{
    const R = 0.095;
    const A = 0.004;
    const positions = shell( ( theta ) => R + A * Math.cos( 16 * theta ), { bins: 128 } );

    // Drop a quarter of the azimuths: a groom does not reach every direction at every height.
    //
    // ⚠️ **THE AXIS IS PINNED, AND WITHOUT THAT THIS CLAUSE MEASURES THE WRONG THING.** Deleting a
    // quarter of a ring walks its centroid 28 mm sideways, so an unpinned reading is taken about an
    // axis 28 mm from the one the full ring was read about: every radius acquires a large harmonic
    // 1, the lobes are frequency-modulated by the off-centre projection, and the residual drops to
    // 2.757 mm with 6 peaks. All of that is real and none of it is what this clause is about.
    const kept = [];
    for ( let vertex = 0; vertex < positions.length; vertex += 3 ) {

        const theta = Math.atan2( positions[ vertex + 2 ], positions[ vertex ] );
        if ( theta > 0 && theta < Math.PI / 2 ) continue;
        kept.push( positions[ vertex ], positions[ vertex + 1 ], positions[ vertex + 2 ] );

    }

    const reading = measureGroom( kept, { azimuthBins: 128, axis: [ 0, 0 ] } );
    near( reading.rows[ 5 ].coverage, 0.75, 1e-9, 'three quarters of the ring is measured' );

    // Not A/√2 to the micrometre: the harmonic basis is orthogonal to cos 16θ over a WHOLE ring,
    // and this is three quarters of one, so the 0–3 fit picks up a little of the lobes. 40 µm of
    // it, which is the size of the honest error a gap costs.
    near( reading.reliefMm, A * 1000 / Math.SQRT2, 0.05,
        'a quarter-empty ring reads the relief of the three quarters it has, to 50 µm' );
    near( reading.peaks, 11, 0,
        'eleven of the sixteen ridges survive — the four inside the gap are gone, and so is the ' +
        'one whose groove is' );
}

// --- 6. the discriminator: a ridge against scatter -------------------------------------------
console.log( '' );
console.log( '--- 6. sixteen ridges vs. 462 cards at their own standoffs ---' );
{
    const R = 0.095;
    const A = 0.004;
    const BANDS = 12;
    const LOW = 1.30;
    const HIGH = 1.66;
    const window = { azimuthBins: 128, axis: [ 0, 0 ], low: LOW, high: HIGH, heightBands: BANDS };

    /**
     * A shell carrying a 16-lobe ridge of amplitude `ridgeA` plus scatter of standard deviation
     * `sigma` drawn ONCE PER (band, bin) — so the scatter is exactly what a band's profile sees,
     * and `var(n)` in the arithmetic below is exactly `sigma²` rather than something the height
     * binning reduced on the way past. Four levels per band, seated inside the band's own bounds.
     */
    const shellWith = ( ridgeA, sigma ) => {

        let state = 12345;
        const draw = () => { state = ( state * 1103515245 + 12345 ) & 0x7fffffff; return state / 0x7fffffff; };
        const gaussian = () => Math.sqrt( - 2 * Math.log( draw() + 1e-12 ) ) * Math.cos( 2 * Math.PI * draw() );

        const span = ( HIGH - LOW ) / BANDS;
        const positions = [];

        for ( let band = 0; band < BANDS; band ++ ) {

            for ( let bin = 0; bin < 128; bin ++ ) {

                const theta = 2 * Math.PI * ( bin + 0.5 ) / 128 - Math.PI;
                const radius = R + ridgeA * Math.cos( 16 * theta ) + sigma * gaussian();

                for ( let level = 0; level < 4; level ++ ) {

                    const y = LOW + span * ( band + ( level + 0.5 ) / 4 );
                    for ( let repeat = 0; repeat < 6; repeat ++ ) positions.push(
                        radius * Math.cos( theta ), y, radius * Math.sin( theta ) );

                }

            }

        }

        return positions;

    };

    const clean = measureGroom( shellWith( A, 0 ), window );
    near( clean.coherence, 1, 1e-9, 'a ridge is perfectly coherent from band to band' );
    near( clean.coherentReliefMm, A * 1000 / Math.SQRT2, 1e-9, 'so all of its relief is lock' );
    near( clean.ridgePeaks, 16, 0, 'and the ridge line carries all sixteen' );

    // Pure scatter, no ridge at all, at 1.5x the ridge's amplitude — which is roughly what a card
    // groom's per-card standoff wobble measures against the lock relief anybody would want.
    const onlyScatter = measureGroom( shellWith( 0, 1.5 * A ), window );

    checks += 1;
    const louder = onlyScatter.reliefMm > clean.reliefMm;
    if ( ! louder ) failures += 1;
    console.log( `  ${ louder ? 'ok  ' : 'FAIL' } pure scatter reads MORE relief than sixteen real ` +
                 `ridges — ${ onlyScatter.reliefMm.toFixed( 2 ) } mm against ` +
                 `${ clean.reliefMm.toFixed( 2 ) }, and reliefMm alone would call it the better groom` );
    near( onlyScatter.coherence, 0, 0.10, 'and its coherence is zero — no ridge runs down it' );
    near( onlyScatter.coherentReliefMm, 0, 1.2,
        'so it reads about a millimetre of LOCK where the naive number read six' );

    // 🎯 The decomposition, on a shape where both are present: ridge amplitude A, scatter of the
    // same variance. r has to land on 1/2 and `rms·√r` has to hand back A/√2, not the total.
    const both = measureGroom( shellWith( A, A / Math.SQRT2 ), window );
    near( both.coherence, 0.5, 0.06, 'equal parts ridge and scatter correlate at r = 1/2' );
    near( both.reliefMm, A * 1000, 0.25, 'whose total relief is A — half ridge, half scatter' );
    near( both.coherentReliefMm, A * 1000 / Math.SQRT2, 0.25,
        'and the ridge amplitude comes back out of the mixture' );
    near( both.ridgePeaks, 16, 0, 'the sixteen ridges survive the band average; the scatter does not' );
}

// --- the look -------------------------------------------------------------------------------
console.log( '' );
console.log( '--- the field, looked at rather than asserted about ---' );
console.log( '    (r = 95 mm + 4 mm·cos 16θ; the ramp is ±4 mm, one column per 2.8°)' );
console.log( '' );
console.log( fieldMap( measureGroom(
    shell( ( theta ) => 0.095 + 0.004 * Math.cos( 16 * theta ), { bins: 128 } ),
    { azimuthBins: 128 } ) ) );

console.log( '' );
console.log( `head harmonics removed: 0..${ HEAD_HARMONICS }` );
console.log( '='.repeat( 84 ) );
console.log( failures === 0 ? `PASS — ${ checks } assertions.`
    : `FAIL — ${ failures } of ${ checks } assertions.` );

process.exit( failures === 0 ? 0 : 1 );
