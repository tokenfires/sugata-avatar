#!/usr/bin/env node
//
// hair_locks.mjs — whether the groom's mass is LOCKS or a uniform shell, measured off the exported
// geometry.
//
// ## Why the gate that exists cannot answer this
//
// `hair_geometry.cardGathering` reads the mean nearest-neighbour distance between card TIPS over
// the same between card ROOTS, and round 3.6.1 used it to turn a mop into a haircut: 1.331–1.416
// before, 0.812–0.884 after. It is the right number for the question it asks — *do the cards walk
// away from each other on the way down* — and it is structurally blind to the question this round
// is about.
//
// 🚩 **A GROOM WHOSE TIPS ARE ALL SQUEEZED 15% CLOSER MEASURES EXACTLY THE SAME AS ONE WHOSE TIPS
// HAVE GATHERED INTO SIXTEEN BUNDLES WITH GAPS BETWEEN THEM.** The ratio is a single scalar over
// the whole point set; uniform compression and clustering are the same input to it. Standing rule
// 4: check what the statistic can see. This one cannot see a lock, because a lock is not a
// distance — it is a MODULATION, and modulation needs a coordinate to be modulated along.
//
// ## 🎯 The operator: the outer envelope's azimuthal corrugation
//
// A viewer reading "locks" is reading light. Locks catch the key light on their crowns and go dark
// in the grooves between them, and that is the whole read — which means the geometric property
// under it is that **the outer surface of the groom has ridges and grooves running down it**. A
// shell does not; a shell has one radius per direction.
//
// So the groom is put into cylindrical coordinates about the head's own axis, split into height
// bands, and within each band the OUTER radius is taken per azimuth bin. That gives one profile
// `r(θ)` per band — the silhouette a viewer would read if they walked around the figure at that
// height. A lock is a bump in that profile. Sixteen locks are sixteen bumps.
//
// ⚠️ **THE HEAD IS NOT A CYLINDER, SO THE PROFILE HAS TO BE DETRENDED, AND THE DETREND IS WHERE A
// LAZY VERSION OF THIS TOOL WOULD MEASURE THE SKULL.** A skull read this way is an oval: radius
// large front-to-back, small ear-to-ear. That is harmonic 2 of `r(θ)` and it is 20–30 mm of
// amplitude, an order of magnitude over anything a lock does. A running-mean baseline removes it
// only approximately and eats a measurable share of the lock signal on the way past (a boxcar W
// wide attenuates a period-P sinusoid by `sinc(W/P)`, which is 10% of a 22.5° lock at W = 60°).
//
// A LEAST-SQUARES FIT OF HARMONICS 0–3 REMOVES IT EXACTLY AND TOUCHES THE LOCKS NOT AT ALL, because
// the harmonics of a circular profile are orthogonal: the fit of `R + e·cos 2θ` to
// `R + e·cos 2θ + A·cos 16θ` is `R + e·cos 2θ`, with no approximation and no window to tune. The
// residual of a 16-lobed shell is therefore `A·cos 16θ` EXACTLY, whose RMS is `A/√2` and whose peak
// count is 16 — two answers known on paper before the tool is pointed at anything, which is what
// `hair_locks.selftest.mjs` asserts first.
//
// 🎯 **WHY HARMONICS 0–3 AND NOT MORE.** 3 is the highest harmonic that is unambiguously the HEAD:
// harmonic 1 is the profile centre being off the axis, 2 is the oval, 3 is the jaw/occiput
// asymmetry. 4 would already be a plausible lock count for a very chunky groom, and a detrend that
// can remove a lock is a detrend that can hide the defect. See `HEAD_HARMONICS`.
//
// ## What the outer radius is taken as, and why not the maximum
//
// The maximum is one flyaway. `flyaway` is 28 cards at the largest standoff in the groom carrying
// the wispiest strips, and its whole job is to break the silhouette — so a per-bin max reads the
// wisps and nothing else, in every band they reach. A high PERCENTILE reads the mass and lets a
// single card sit outside it. Default 0.85, and the selftest checks the synthetic answers at 1.0
// AND at 0.85 so that the choice is a robustness knob rather than a load-bearing constant.
//
// ## Usage
//
//   node tools/figure-pipeline/hair_locks.mjs                        # every shipped bake
//   node tools/figure-pipeline/hair_locks.mjs path/to/g050.glb --map
//
// `--map` prints the detrended field as text, one row per band, because standing rule 4's second
// clause is that a new operator gets looked at as well as validated.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// 🚩 fileURLToPath, never string surgery on `import.meta.url`: this repository's own path carries a
// space and a non-ASCII character, and `.replace('file://','')` hands back a percent-encoded
// directory that does not exist.
const HERE = path.dirname( fileURLToPath( import.meta.url ) );
const REPO_ROOT = path.resolve( HERE, '..', '..' );

/**
 * The harmonics of `r(θ)` that belong to the HEAD rather than to the groom, removed before anything
 * is measured. 0 is the mean radius, 1 is the profile's centre being off the axis, 2 is the skull's
 * oval, 3 is its front-to-back asymmetry. See the header for why this does not go higher.
 */
export const HEAD_HARMONICS = 3;

/** Defaults for `envelopeProfile`, in one place so the CLI and the selftest cannot drift apart. */
export const PROFILE_DEFAULTS = {
    azimuthBins: 120,      // 3° apart — seven bins across a sixteenth of the head
    heightBands: 12,
    percentile: 0.85,      // the mass, not the one flyaway that reaches furthest. See the header.
    minimumPerBin: 4,      // below this a percentile is a coin flip; the bin is left empty
    prominenceM: 0.001     // a groove has to be a millimetre deep before it is counted as one
};

/**
 * Cylindrical coordinates for every vertex about the head's own vertical axis.
 *
 * glTF is Y-up, so height is y and the azimuth runs in the xz plane. The axis defaults to the mean
 * of the point set, which is approximate on purpose: a centre that is off by a few millimetres puts
 * a `cos θ` term into every profile, and `detrendCircular` removes harmonic 1 exactly.
 *
 * ⚠️ **PASS `axis` WHEN COMPARING TWO GROOMS.** The mean moves when the geometry does, so a build
 * that lost its side curtains is read about a different axis than the build before it and the two
 * profiles are not the same measurement. It is also what makes the gap clause of the selftest an
 * assertion about NaN handling rather than about a centroid sliding sideways.
 *
 * @param {ArrayLike<number>} positions - xyz triples.
 * @param {number[]} [axis] - [x, z] to pin the axis at; defaults to the point set's own mean.
 * @returns {{height:Float64Array, azimuth:Float64Array, radius:Float64Array, centre:number[]}}
 */
export function cylindrical( positions, axis = null ) {

    const count = positions.length / 3;
    let sumX = 0;
    let sumZ = 0;
    for ( let vertex = 0; vertex < count; vertex ++ ) {

        sumX += positions[ vertex * 3 ];
        sumZ += positions[ vertex * 3 + 2 ];

    }

    const centre = axis ?? [ sumX / count, sumZ / count ];
    const height = new Float64Array( count );
    const azimuth = new Float64Array( count );
    const radius = new Float64Array( count );

    for ( let vertex = 0; vertex < count; vertex ++ ) {

        const x = positions[ vertex * 3 ] - centre[ 0 ];
        const z = positions[ vertex * 3 + 2 ] - centre[ 1 ];
        height[ vertex ] = positions[ vertex * 3 + 1 ];
        azimuth[ vertex ] = Math.atan2( z, x );
        radius[ vertex ] = Math.hypot( x, z );

    }

    return { height, azimuth, radius, centre };

}

/**
 * The outer radius of the groom per (height band, azimuth bin) — its silhouette from every side.
 *
 * A bin holding fewer than `minimumPerBin` vertices is left as NaN rather than guessed at: an empty
 * bin means the groom does not reach that direction at that height, which is a real hole in the
 * measurement and not a radius of zero. Everything downstream carries the NaN.
 *
 * @param {ArrayLike<number>} positions - xyz triples.
 * @param {object} [options] - overrides for PROFILE_DEFAULTS, plus an optional {low, high} band.
 */
export function envelopeProfile( positions, options = {} ) {

    const settings = { ...PROFILE_DEFAULTS, ...options };
    const { height, azimuth, radius } = cylindrical( positions, settings.axis ?? null );

    let low = settings.low;
    let high = settings.high;
    if ( low === undefined || high === undefined ) {

        low = Infinity;
        high = - Infinity;
        for ( const y of height ) {

            low = Math.min( low, y );
            high = Math.max( high, y );

        }

    }

    const bands = [];
    const span = ( high - low ) / settings.heightBands;

    for ( let band = 0; band < settings.heightBands; band ++ ) {

        const yLow = low + band * span;
        const yHigh = band === settings.heightBands - 1 ? high : yLow + span;
        const buckets = Array.from( { length: settings.azimuthBins }, () => [] );

        for ( let vertex = 0; vertex < height.length; vertex ++ ) {

            if ( height[ vertex ] < yLow || height[ vertex ] > yHigh ) continue;
            let bin = Math.floor( ( azimuth[ vertex ] + Math.PI ) / ( 2 * Math.PI ) * settings.azimuthBins );
            if ( bin < 0 ) bin = 0;
            if ( bin >= settings.azimuthBins ) bin = settings.azimuthBins - 1;
            buckets[ bin ].push( radius[ vertex ] );

        }

        const profile = new Float64Array( settings.azimuthBins ).fill( NaN );
        for ( let bin = 0; bin < settings.azimuthBins; bin ++ ) {

            const samples = buckets[ bin ];
            if ( samples.length < settings.minimumPerBin ) continue;
            samples.sort( ( a, b ) => a - b );
            const rank = Math.min( samples.length - 1,
                Math.round( settings.percentile * ( samples.length - 1 ) ) );
            profile[ bin ] = samples[ rank ];

        }

        bands.push( { yLow, yHigh, profile } );

    }

    return { bands, settings };

}

/**
 * The profile with the head taken out of it: `r(θ)` minus its own least-squares fit of harmonics
 * 0..`harmonics`, computed over the bins that are not NaN.
 *
 * Normal equations rather than a DFT, and that is not a stylistic choice — a DFT needs every bin,
 * and a groom that does not reach every direction at a given height has empty bins by construction.
 * The system is (2H+1)² and H is 3, so it is a 7x7 solve per band.
 *
 * @param {Float64Array} profile - radius per azimuth bin, NaN where unmeasured.
 * @param {number} [harmonics]
 * @returns {Float64Array} residual per bin, NaN preserved.
 */
export function detrendCircular( profile, harmonics = HEAD_HARMONICS ) {

    const terms = 2 * harmonics + 1;
    const basisAt = ( bin ) => {

        const theta = 2 * Math.PI * bin / profile.length;
        const row = [ 1 ];
        for ( let h = 1; h <= harmonics; h ++ ) row.push( Math.cos( h * theta ), Math.sin( h * theta ) );
        return row;

    };

    const normal = Array.from( { length: terms }, () => new Float64Array( terms + 1 ) );
    let used = 0;
    for ( let bin = 0; bin < profile.length; bin ++ ) {

        if ( ! Number.isFinite( profile[ bin ] ) ) continue;
        used += 1;
        const row = basisAt( bin );
        for ( let i = 0; i < terms; i ++ ) {

            for ( let j = 0; j < terms; j ++ ) normal[ i ][ j ] += row[ i ] * row[ j ];
            normal[ i ][ terms ] += row[ i ] * profile[ bin ];

        }

    }

    const residual = new Float64Array( profile.length ).fill( NaN );
    if ( used <= terms ) return residual;   // under-determined: report nothing rather than noise

    // Gaussian elimination with partial pivoting. Seven unknowns; nothing here needs a library.
    for ( let column = 0; column < terms; column ++ ) {

        let pivot = column;
        for ( let row = column + 1; row < terms; row ++ ) {

            if ( Math.abs( normal[ row ][ column ] ) > Math.abs( normal[ pivot ][ column ] ) ) pivot = row;

        }

        const swap = normal[ column ];
        normal[ column ] = normal[ pivot ];
        normal[ pivot ] = swap;

        const lead = normal[ column ][ column ];
        if ( Math.abs( lead ) < 1e-14 ) return residual;

        for ( let row = 0; row < terms; row ++ ) {

            if ( row === column ) continue;
            const factor = normal[ row ][ column ] / lead;
            for ( let j = column; j <= terms; j ++ ) normal[ row ][ j ] -= factor * normal[ column ][ j ];

        }

    }

    const coefficients = [];
    for ( let i = 0; i < terms; i ++ ) coefficients.push( normal[ i ][ terms ] / normal[ i ][ i ] );

    for ( let bin = 0; bin < profile.length; bin ++ ) {

        if ( ! Number.isFinite( profile[ bin ] ) ) continue;
        const row = basisAt( bin );
        let fitted = 0;
        for ( let i = 0; i < terms; i ++ ) fitted += coefficients[ i ] * row[ i ];
        residual[ bin ] = profile[ bin ] - fitted;

    }

    return residual;

}

/**
 * How corrugated one detrended profile is: the depth of its grooves and how many there are.
 *
 * `rms` is the plain RMS of the residual, in metres — for a pure `A·cos nθ` it is `A/√2`, which is
 * the identity the selftest pins the operator against. `peaks` counts local maxima whose PROMINENCE
 * — the rise above the higher of the two GROOVES flanking it — clears `prominenceM`. Prominence
 * rather than height, because a ridge riding on a slow swell is still one ridge and a height
 * threshold would count it as several.
 *
 * 🚩 **THE GROOVE IS THE ADJACENT LOCAL MINIMUM, NOT THE TEXTBOOK PROMINENCE SADDLE, AND THE
 * TEXTBOOK ONE WAS TRIED FIRST AND COULD NOT COUNT A COSINE.** The standard definition walks out
 * from a peak until the profile rises ABOVE it; on `A·cos nθ` sampled symmetrically, every other
 * peak is EXACTLY equal rather than above, so the walk never terminates and runs the whole ring —
 * which then fails on the first NaN and reported zero peaks on a shell with sixteen visible ridges.
 * Walking downhill to the nearest turn is what a groove IS on a hair groom anyway: the dark line
 * between two locks, not the deepest point between two summits half a head apart.
 *
 * ⚠️ NaN bins still break the ring. A groom that does not reach every azimuth at this height has
 * gaps, and a ridge whose groove is inside one is not counted: the two sides of a gap are not
 * neighbours and the depth between them is not measured.
 *
 * @param {Float64Array} residual - from `detrendCircular`.
 * @param {number} prominenceM
 */
export function corrugation( residual, prominenceM = PROFILE_DEFAULTS.prominenceM ) {

    let sum = 0;
    let counted = 0;
    let lowest = Infinity;
    let highest = - Infinity;
    for ( const value of residual ) {

        if ( ! Number.isFinite( value ) ) continue;
        sum += value * value;
        counted += 1;
        lowest = Math.min( lowest, value );
        highest = Math.max( highest, value );

    }

    if ( counted === 0 ) return { rms: NaN, peaks: 0, peakToTrough: NaN, coverage: 0 };

    // A peak is a bin that beats both its neighbours; its grooves are found by walking downhill in
    // both directions until the profile turns back up or the ring is broken by a gap.
    let peaks = 0;
    const bins = residual.length;
    const at = ( bin ) => residual[ ( bin % bins + bins ) % bins ];

    for ( let bin = 0; bin < bins; bin ++ ) {

        const here = at( bin );
        if ( ! Number.isFinite( here ) ) continue;
        if ( ! ( here > at( bin - 1 ) ) || ! ( here >= at( bin + 1 ) ) ) continue;

        let broken = false;
        const grooveOnEachSide = [ - 1, 1 ].map( ( step ) => {

            let groove = here;
            for ( let walk = 1; walk < bins; walk ++ ) {

                const value = at( bin + step * walk );
                if ( ! Number.isFinite( value ) ) { broken = true; break; }
                if ( value > groove ) break;
                groove = value;

            }

            return groove;

        } );

        if ( broken ) continue;
        if ( here - Math.max( grooveOnEachSide[ 0 ], grooveOnEachSide[ 1 ] ) >= prominenceM ) peaks += 1;

    }

    return {
        rms: Math.sqrt( sum / counted ),
        peaks,
        peakToTrough: highest - lowest,
        coverage: counted / residual.length
    };

}

/**
 * Pearson correlation between two profiles, over the bins that are finite in BOTH.
 *
 * @returns {{r:number, bins:number}} r is NaN when fewer than three bins overlap.
 */
export function profileCorrelation( first, second ) {

    const paired = [];
    for ( let bin = 0; bin < first.length; bin ++ ) {

        if ( Number.isFinite( first[ bin ] ) && Number.isFinite( second[ bin ] ) ) {

            paired.push( [ first[ bin ], second[ bin ] ] );

        }

    }

    if ( paired.length < 3 ) return { r: NaN, bins: paired.length };

    const meanOf = ( index ) => paired.reduce( ( total, pair ) => total + pair[ index ], 0 ) / paired.length;
    const meanFirst = meanOf( 0 );
    const meanSecond = meanOf( 1 );

    let covariance = 0;
    let varianceFirst = 0;
    let varianceSecond = 0;
    for ( const pair of paired ) {

        const a = pair[ 0 ] - meanFirst;
        const b = pair[ 1 ] - meanSecond;
        covariance += a * b;
        varianceFirst += a * a;
        varianceSecond += b * b;

    }

    const denominator = Math.sqrt( varianceFirst * varianceSecond );
    return { r: denominator > 0 ? covariance / denominator : NaN, bins: paired.length };

}

/**
 * The whole reading for one groom: per band, and the aggregate a gate would use.
 *
 * 🚩 **`reliefMm` ALONE PASSES A SHELL OF RANDOMLY SCATTERED CARDS, AND THAT IS WHAT THE FIRST
 * VERSION OF THIS TOOL DID.** Pointed at the shipped 462-card groom it read 7.29 mm of relief and
 * 21.6 peaks a band — numbers that look like a groom full of locks — and the field map printed
 * STATIC: speckle two to five bins wide with nothing lining up from one height to the next. That is
 * exactly right, and it is not a lock. It is 462 cards each sitting at its own standoff, and the
 * per-bin outer radius wobbling by a card thickness as the sample moves from one to the next.
 *
 * 🎯 **A LOCK IS COHERENT DOWN THE HEAD AND SCATTER IS NOT, WHICH IS THE DISCRIMINATOR.** A lock is
 * a ridge that runs from the crown to the tip: the same azimuth, band after band. Card scatter is
 * independent in every band by construction. So `coherence` is the mean Pearson correlation between
 * the residual profiles of VERTICALLY ADJACENT bands, and it separates the two with no threshold
 * and no tuning.
 *
 * `coherentReliefMm` is what that buys, and it is arithmetic rather than a heuristic. Write each
 * band's residual as a shared ridge `s` plus independent scatter `n`. Then
 *
 *     r = var(s) / ( var(s) + var(n) )     and     rms² = var(s) + var(n)
 *
 * so `rms · √r` is the RMS of the RIDGE alone, whatever the scatter is doing. A shell of pure
 * scatter reads r ≈ 0 and therefore ≈ 0 mm of lock however loud the scatter is; a lobed shell buried
 * in scatter of equal variance reads back its own lobe amplitude to the micrometre. Both are
 * asserted in `hair_locks.selftest.mjs`.
 *
 * `peaks` is counted on the band-AVERAGED residual for the same reason — a ridge survives the
 * average and scatter is divided by √bands.
 *
 * The aggregate deliberately excludes the top and bottom bands. The top is the crown, where the
 * cards are still inside their own roots and a lock has not formed yet; the bottom is the last few
 * millimetres of tip, where the profile is a handful of tapering points and the percentile is
 * reading noise. `bandsUsed` reports which survived, so a groom that lost most of its bands to the
 * minimum-per-bin rule cannot quietly report an average of two of them.
 *
 * @param {ArrayLike<number>} positions - xyz triples of the hair mesh.
 * @param {object} [options]
 */
export function measureGroom( positions, options = {} ) {

    const { bands, settings } = envelopeProfile( positions, options );

    const rows = bands.map( ( band ) => {

        const residual = detrendCircular( band.profile );
        return { ...band, residual, ...corrugation( residual, settings.prominenceM ) };

    } );

    const interior = rows.slice( 1, rows.length - 1 ).filter( ( row ) => Number.isFinite( row.rms ) );
    const mean = ( pick ) => interior.reduce( ( total, row ) => total + pick( row ), 0 )
        / Math.max( interior.length, 1 );

    const correlations = [];
    for ( let index = 1; index < interior.length; index ++ ) {

        const { r } = profileCorrelation( interior[ index - 1 ].residual, interior[ index ].residual );
        if ( Number.isFinite( r ) ) correlations.push( r );

    }

    const coherence = correlations.length === 0 ? NaN
        : correlations.reduce( ( total, value ) => total + value, 0 ) / correlations.length;

    // The ridge line: each bin averaged down the head over the bands that measured it.
    const ridge = new Float64Array( settings.azimuthBins ).fill( NaN );
    for ( let bin = 0; bin < ridge.length; bin ++ ) {

        let total = 0;
        let counted = 0;
        for ( const row of interior ) {

            if ( Number.isFinite( row.residual[ bin ] ) ) { total += row.residual[ bin ]; counted += 1; }

        }

        if ( counted >= Math.max( 2, interior.length / 2 ) ) ridge[ bin ] = total / counted;

    }

    const reliefMm = mean( ( row ) => row.rms ) * 1000;

    return {
        rows,
        settings,
        ridge,
        bandsUsed: interior.length,
        reliefMm,
        coherence,
        coherentReliefMm: reliefMm * Math.sqrt( Math.max( 0, Math.min( 1, coherence ) ) ),
        ridgePeaks: corrugation( ridge, settings.prominenceM ).peaks,
        peaks: mean( ( row ) => row.peaks ),
        peakToTroughMm: mean( ( row ) => row.peakToTrough ) * 1000
    };

}

const RAMP = ' .:-=+*#%@';

/** One profile as a row of the ramp, ±`scaleMm` full scale, a space where it was not measured. */
export function ramped( profile, scaleMm ) {

    let line = '';
    for ( const value of profile ) {

        if ( ! Number.isFinite( value ) ) { line += ' '; continue; }
        const normalised = ( value * 1000 / scaleMm + 1 ) / 2;   // -scale..+scale -> 0..1
        const index = Math.max( 0, Math.min( RAMP.length - 1, Math.round( normalised * ( RAMP.length - 1 ) ) ) );
        line += RAMP[ index ];

    }

    return line;

}

/** The band-averaged ridge line — what survives the average is the lock. */
export function ridgeLine( reading, scaleMm = 4 ) {

    return ramped( reading.ridge, scaleMm );

}

/** The detrended field as text, one row per band, so that it can be LOOKED at. */
export function fieldMap( reading, scaleMm = 4 ) {

    const ramp = RAMP;
    const lines = [];

    for ( const row of [ ...reading.rows ].reverse() ) {

        let line = '';
        for ( const value of row.residual ) {

            if ( ! Number.isFinite( value ) ) { line += ' '; continue; }
            const normalised = ( value * 1000 / scaleMm + 1 ) / 2;   // -scale..+scale -> 0..1
            const index = Math.max( 0, Math.min( ramp.length - 1, Math.round( normalised * ( ramp.length - 1 ) ) ) );
            line += ramp[ index ];

        }

        lines.push( `y=${ row.yLow.toFixed( 3 ) }  ${ line }  ${ ( row.rms * 1000 ).toFixed( 2 ) } mm  ` +
                    `${ row.peaks } peaks` );

    }

    return lines.join( '\n' );

}

// --- CLI ------------------------------------------------------------------------------------

const isMain = process.argv[ 1 ] !== undefined
    && path.resolve( process.argv[ 1 ] ) === fileURLToPath( import.meta.url );

if ( isMain ) {

    const { readGlb, readAccessor } = await import( '../lut-bake/glb.mjs' );
    const wantsMap = process.argv.includes( '--map' );
    const targets = process.argv.slice( 2 ).filter( ( argument ) => ! argument.startsWith( '--' ) );

    const files = targets.length > 0 ? targets
        : [ 'g000', 'g025', 'g050', 'g075', 'g100' ]
            .map( ( bake ) => path.join( REPO_ROOT, 'assets', 'hair', 'bob01', `${ bake }.glb` ) )
            .filter( ( file ) => fs.existsSync( file ) );

    console.log( 'hair_locks.mjs — the outer envelope\'s azimuthal corrugation, detrended of ' +
                 `harmonics 0..${ HEAD_HARMONICS }` );
    console.log( '' );
    console.log( 'file                                   bands   relief mm   coherence   LOCK mm   ridges' );

    for ( const file of files ) {

        const glb = readGlb( file );
        const primitive = glb.json.meshes[ 0 ].primitives[ 0 ];
        const positions = readAccessor( glb, primitive.attributes.POSITION ).data;
        const reading = measureGroom( positions );

        console.log( `${ path.relative( REPO_ROOT, file ).padEnd( 38 ) }` +
                     `${ String( reading.bandsUsed ).padStart( 5 ) }` +
                     `${ reading.reliefMm.toFixed( 3 ).padStart( 12 ) }` +
                     `${ reading.coherence.toFixed( 3 ).padStart( 12 ) }` +
                     `${ reading.coherentReliefMm.toFixed( 3 ).padStart( 10 ) }` +
                     `${ String( reading.ridgePeaks ).padStart( 9 ) }` );

        if ( wantsMap ) {

            console.log( '' );
            console.log( fieldMap( reading ) );
            console.log( `RIDGE    ${ ridgeLine( reading ) }` );
            console.log( '' );

        }

    }

}
