#!/usr/bin/env node
//
// band-power.mjs — how much of a plate's variation lives at FILAMENT scale, at LOCK scale, and at
// MASS scale. One operator, three numbers, and the answer to each is arithmetic on a grating.
//
// ## Why a new statistic, when this project's most repeated failure is a new statistic
//
// Five separate times in this phase a number was written for a defect it was structurally blind to
// — mean alpha cannot tell a picket fence from a rectangle; a slab scores a PERFECT bimodality; a
// card-wide luminance baseline read 4.0 on a visibly flat wall; a gap counter cannot see shading; a
// relief statistic rated a NOISIER groom above a lock-ier one. `docs/CHECKPOINT.md` §5 carries the
// list. So the standing rule is: **validate the operator against a shape whose answer is arithmetic
// BEFORE pointing it at the groom, and look at a crop as well.**
//
// The complaint this is built for is a FREQUENCY complaint. Six blind judges — three shown our hair
// and three shown an independent 11.4k-strand renderer — said the mass has no lock hierarchy, in
// these words: *"one flow field, one scale, no hierarchy"*, *"a single combed sheaf with PER-PIXEL
// NOISE STANDING IN FOR STRUCTURE"*, *"missing every intermediate level between one mass and
// individual filaments"*. That is a claim about WHERE THE ENERGY SITS IN SPATIAL FREQUENCY, and no
// statistic in this repo measures that. `hair_locks.mjs` is the closest and it measures GEOMETRY —
// the envelope's azimuthal corrugation off the GLB — not delivered image structure.
//
// ## The operator
//
// A three-band separable box-filter decomposition of one scalar field, measured over a mask:
//
//     filament = I            − box( I, wFine )
//     lock     = box( I, wFine ) − box( I, wCoarse )
//     mass     = box( I, wCoarse ) − mean( I over the mask )
//
// reported as the RMS of each band over the mask. Box filters rather than Gaussians for one reason
// and it is the whole design: **a box filter's response to a sinusoid is a closed form**, the
// Dirichlet kernel `G(w,f) = sin(π f w) / (w sin(π f))`, so the reading on any grating is known on
// paper before the tool is run. A Gaussian's is too, but the box's is exact in the DISCRETE domain
// the pixels actually live in, with no truncation to argue about.
//
// 🚩 **THE WIDTHS ARE A PARAMETER AND CHOOSING THEM WRONG READS AS A FAILED EXPERIMENT.** The
// defaults 5 and 41 implement the 10–40 px lock band round 24's brief nominated. Measured against
// the groom, that band is wrong for THIS asset: `hair_cards.py`'s `LOCK_COUNT` is 16 and the mass
// sits at a horizontal radius of 88.1 mm, so a lock is 34.6 mm — and a card is 28.7 mm of scalp and
// 44 px of a 720-wide portrait plate, i.e. 0.652 mm/px, which makes a lock **53 px**, coarser than
// a card and OUTSIDE 10–40. Read at 5/41 the round-24 lock term looks mass-dominated
// (2.77 / 4.49 / 11.29 filament / lock / mass); read at **11/121**, whose lock band contains 53 px,
// the same plates read 3.97 / 9.70 / 7.39 and the term lands where it was aimed. Same operator,
// same pixels, one parameter. The validation below is analytic at any width, so re-parameterising
// costs nothing and hides nothing — but a reading is meaningless without its widths beside it.
//
// ## 🚩 WHAT THIS OPERATOR CANNOT SEE, STATED BEFORE ANY READING IS QUOTED
//
// **It cannot tell a lock from an EDGE.** A step edge is broadband: a card border, a silhouette, a
// cast shadow boundary and a lock all deposit power in the lock band, and this number cannot
// separate them. §6 of the selftest is that measurement — a 0.4→0.6 step reads 0.0049 / 0.0125 /
// 0.0980 across the three bands — kept as a validation case precisely so the limit is a number
// rather than a caveat.
//
// **It cannot tell COHERENT structure from NOISE in the same band, either.** Measured this round:
// the per-fragment strand jitter, whose lattice period is 4.8 px, delivers 13.39% of the plate's
// mean into the filament band and **13.69% into the lock band** — because one-dimensional value
// noise is flat below its own lattice frequency. A band reading alone would have called that lock
// structure. Coherence is a different question and it is asserted on the field itself, in
// `HairMaterial.selftest.mjs`'s autocorrelation clause, not here.
//
// The consequence is a rule about how it may be used: **an absolute lock-band reading is not
// evidence of lock structure.** Only a DIFFERENCE between two plates that differ in one expression
// is attributable, which is why every reading below is quoted as an A/B and why the mask is eroded
// (a silhouette edge inside the mask would dominate everything).
//
// It is also isotropic — separable in x and y — so it does not know which way a strand runs. That
// is deliberate: hair on a three-quarter plate runs in several directions at once and an operator
// with a preferred axis would read the parting differently from the temple.
//
// ## Usage
//
//   node tools/critic/band-power.mjs before.png after.png \
//        --unit captures/…-mask-unit/portrait.png --zero captures/…-mask-zero/portrait.png
//
// The two mask plates are `?hairdefect=unit-bsdf` and `?hairlobes=&hairscatter=0` at the same
// framing — see `solidHairMask`. Without them it measures the whole frame and says so.
// `bandPower()` and `measureDelivered()` are the API a gate asserts on.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// 🚩 fileURLToPath, never string surgery on `import.meta.url`: this repository's own path carries a
// space and a non-ASCII character.
const HERE = path.dirname( fileURLToPath( import.meta.url ) );

const { decodePng } = await import( path.join( HERE, 'png.mjs' ) );

/**
 * The two box widths that define the three bands, and the mask erosion that keeps every measured
 * pixel's own filter support inside the mask.
 *
 * `erode` is `(wCoarse − 1) / 2` and must stay that: a measured pixel whose coarse box reaches
 * outside the mask is reading the background, and the silhouette is the largest edge on the plate.
 */
export const BAND_DEFAULTS = {
    wFine: 5,
    wCoarse: 41,
    get erode() { return ( this.wCoarse - 1 ) / 2; }
};

/**
 * A box filter's exact gain on a discrete sinusoid — the Dirichlet kernel.
 *
 * `G(w,f) = sin(π f w) / (w sin(π f))`, with `G(w,0) = 1`. This is what makes every validation
 * reading in `band-power.selftest.mjs` a number computed on paper rather than a number recorded
 * from a previous run of this file.
 *
 * @param {number} width - box width in samples, odd.
 * @param {number} frequency - cycles per sample.
 */
export function boxGain( width, frequency ) {

    const denominator = width * Math.sin( Math.PI * frequency );

    if ( Math.abs( denominator ) < 1e-12 ) return 1;

    return Math.sin( Math.PI * frequency * width ) / denominator;

}

/**
 * The three band gains this decomposition applies to a sinusoid of the given period. Exported so a
 * caller can state the expected reading of a synthetic plate instead of trusting the tool.
 *
 * @returns {{ filament:number, lock:number, mass:number }} signed gains.
 */
export function bandGains( period, settings = {} ) {

    const { wFine, wCoarse } = { ...BAND_DEFAULTS, ...settings };
    const frequency = 1 / period;

    const fine = boxGain( wFine, frequency );
    const coarse = boxGain( wCoarse, frequency );

    return { filament: 1 - fine, lock: fine - coarse, mass: coarse };

}

/**
 * A separable box blur of an arbitrary scalar field, edge-CLAMPED.
 *
 * Clamping rather than wrapping or zeroing because the field this runs on is a photograph of a
 * head: outside the frame is more of the same, not black. Every pixel this tool then REPORTS on is
 * at least `erode` from the mask boundary, so the clamp never enters a quoted number.
 */
export function boxBlur( field, width, height, boxWidth ) {

    if ( boxWidth % 2 !== 1 ) throw new Error( `box width must be odd, got ${ boxWidth }` );

    const radius = ( boxWidth - 1 ) / 2;
    const horizontal = new Float64Array( width * height );
    const output = new Float64Array( width * height );

    for ( let y = 0; y < height; y ++ ) {

        for ( let x = 0; x < width; x ++ ) {

            let sum = 0;

            for ( let offset = - radius; offset <= radius; offset ++ ) {

                const sample = Math.min( width - 1, Math.max( 0, x + offset ) );
                sum += field[ y * width + sample ];

            }

            horizontal[ y * width + x ] = sum / boxWidth;

        }

    }

    for ( let y = 0; y < height; y ++ ) {

        for ( let x = 0; x < width; x ++ ) {

            let sum = 0;

            for ( let offset = - radius; offset <= radius; offset ++ ) {

                const sample = Math.min( height - 1, Math.max( 0, y + offset ) );
                sum += horizontal[ sample * width + x ];

            }

            output[ y * width + x ] = sum / boxWidth;

        }

    }

    return output;

}

/**
 * Shrinks a boolean mask so that every surviving pixel is at least `radius` from a pixel that was
 * never in it. Chebyshev distance, because the filter support is a square.
 */
export function erodeMask( mask, width, height, radius ) {

    const eroded = new Uint8Array( width * height );

    for ( let y = 0; y < height; y ++ ) {

        for ( let x = 0; x < width; x ++ ) {

            if ( mask[ y * width + x ] === 0 ) continue;

            let keep = 1;

            for ( let dy = - radius; dy <= radius && keep === 1; dy ++ ) {

                const sampleY = y + dy;
                if ( sampleY < 0 || sampleY >= height ) { keep = 0; break; }

                for ( let dx = - radius; dx <= radius; dx ++ ) {

                    const sampleX = x + dx;

                    if ( sampleX < 0 || sampleX >= width || mask[ sampleY * width + sampleX ] === 0 ) {

                        keep = 0;
                        break;

                    }

                }

            }

            eroded[ y * width + x ] = keep;

        }

    }

    return eroded;

}

/**
 * THE OPERATOR.
 *
 * @param {Object} plate
 * @param {Float64Array|Float32Array} plate.field - one scalar per pixel, any units.
 * @param {number} plate.width
 * @param {number} plate.height
 * @param {?Uint8Array} [plate.mask] - 1 where the field is the subject. Defaults to everything.
 * @param {Object} [settings] - overrides over `BAND_DEFAULTS`.
 * @returns {{ filament:number, lock:number, mass:number, mean:number, count:number,
 *   relative:{filament:number,lock:number,mass:number} }} RMS per band over the eroded mask, the
 *   mask's mean, and each band as a fraction of that mean.
 */
export function bandPower( plate, settings = {} ) {

    const options = { ...BAND_DEFAULTS, ...settings };
    const erode = settings.erode ?? ( options.wCoarse - 1 ) / 2;
    const { field, width, height } = plate;

    const mask = plate.mask ?? new Uint8Array( width * height ).fill( 1 );
    const measured = erode > 0 ? erodeMask( mask, width, height, erode ) : mask;

    const fine = boxBlur( field, width, height, options.wFine );
    const coarse = boxBlur( field, width, height, options.wCoarse );

    let count = 0;
    let sum = 0;

    for ( let index = 0; index < measured.length; index ++ ) {

        if ( measured[ index ] === 0 ) continue;
        sum += field[ index ];
        count += 1;

    }

    if ( count === 0 ) throw new Error( 'band-power: the eroded mask is empty. Widen it or erode less.' );

    const mean = sum / count;

    let filamentSquares = 0;
    let lockSquares = 0;
    let massSquares = 0;

    for ( let index = 0; index < measured.length; index ++ ) {

        if ( measured[ index ] === 0 ) continue;

        const filament = field[ index ] - fine[ index ];
        const lock = fine[ index ] - coarse[ index ];
        const mass = coarse[ index ] - mean;

        filamentSquares += filament * filament;
        lockSquares += lock * lock;
        massSquares += mass * mass;

    }

    const filament = Math.sqrt( filamentSquares / count );
    const lock = Math.sqrt( lockSquares / count );
    const mass = Math.sqrt( massSquares / count );

    return {
        filament, lock, mass, mean, count,
        relative: {
            filament: filament / Math.max( Math.abs( mean ), 1e-12 ),
            lock: lock / Math.max( Math.abs( mean ), 1e-12 ),
            mass: mass / Math.max( Math.abs( mean ), 1e-12 )
        }
    };

}

// --- turning a plate into a field ---------------------------------------------------------------

/** sRGB EOTF. The plate is display-encoded; the transfer to a shader multiply is not. */
export function encodedToLinear( encoded ) {

    return encoded <= 0.04045 ? encoded / 12.92 : Math.pow( ( encoded + 0.055 ) / 1.055, 2.4 );

}

/**
 * Rec.709 luma of a decoded PNG, in one of two domains.
 *
 * 🚩 THE DOMAIN IS A CHOICE AND BOTH ARE REPORTED, because they answer different questions. `linear`
 * is the space a shader multiplies in, so a RELATIVE band reading there is directly comparable to a
 * multiplicative albedo amplitude. `encoded` is the space a judge's eye is in and the space this
 * project's whole look spec was measured in, so a band reading there is in code values a reader can
 * picture.
 */
export function lumaField( decoded, domain = 'linear' ) {

    const { width, height, pixels } = decoded;
    const field = new Float64Array( width * height );

    for ( let index = 0; index < width * height; index ++ ) {

        const r = pixels[ index * 4 ];
        const g = pixels[ index * 4 + 1 ];
        const b = pixels[ index * 4 + 2 ];

        field[ index ] = domain === 'linear'
            ? 0.2126 * encodedToLinear( r ) + 0.7152 * encodedToLinear( g ) + 0.0722 * encodedToLinear( b )
            : ( 0.2126 * r + 0.7152 * g + 0.0722 * b ) * 255;

    }

    return { field, width, height };

}

/**
 * THE HAIR MASK, AND IT IS A MEASUREMENT RATHER THAN A THRESHOLD ON THE PLATE ITSELF.
 *
 * 🚩 The obvious mask — "dark pixels", or "pixels that differ from a no-hair plate" — was tried in
 * `HairMaterial.selftest.mjs` and rejected there with a number: the no-hair diff came out at 25% of
 * frame of which most was SKIN, because hair casts shadows and the resolve smears an edge. That
 * file's replacement is reused here verbatim so the two instruments cannot disagree about which
 * pixels are hair:
 *
 *   hair  = the pixels `?hairdefect=unit-bsdf` and a ZERO BSDF (`?hairlobes=&hairscatter=0`)
 *           disagree about by more than 0.01 display luma. Same groom, same alpha coverage, same
 *           shadow casting — only the BSDF differs, so a pixel that moves is a hair texel.
 *
 * The constant is `HairMaterial.selftest.mjs`'s, unchanged; that file's own sweep shows the mask
 * size is flat across two decades of it.
 *
 * ⚠️ THAT FILE'S SECOND CLAUSE — "and the ZERO plate is darker than 0.01 there", which drops
 * part-covered card texels — IS DELIBERATELY NOT APPLIED HERE, and the reason is measured. It
 * removes 8.3% of the mask as isolated pixels scattered through the interior, and a 41x41 window
 * cannot avoid a hole at that density: the mask goes 234,922 px raw to **exactly 0** after the
 * erosion this operator requires, against 256,106 → 120,069 without the clause. A percentile does
 * not care about holes and a spatial filter cannot survive them. The cost is that ~8% of measured
 * pixels are part-covered card texels carrying some of the skin behind them — identical pixels in
 * both arms of every A/B below, so it dilutes an effect rather than inventing one.
 *
 * @param {string} unitFile - a `?hairdefect=unit-bsdf` plate.
 * @param {string} zeroFile - a `?hairlobes=&hairscatter=0` plate, same framing.
 */
export function solidHairMask( unitFile, zeroFile, options = {} ) {

    const move = options.move ?? 0.01;
    const coverage = options.coverage ?? Infinity;

    const unit = decodePng( fs.readFileSync( unitFile ) );
    const zero = decodePng( fs.readFileSync( zeroFile ) );

    if ( unit.width !== zero.width || unit.height !== zero.height ) {

        throw new Error( 'band-power: the two mask plates are different sizes' );

    }

    const mask = new Uint8Array( unit.width * unit.height );
    const luma = ( pixels, index ) => 0.2126 * pixels[ index * 4 ] +
        0.7152 * pixels[ index * 4 + 1 ] + 0.0722 * pixels[ index * 4 + 2 ];

    for ( let index = 0; index < mask.length; index ++ ) {

        const zeroLuma = luma( zero.pixels, index );

        mask[ index ] = Math.abs( luma( unit.pixels, index ) - zeroLuma ) > move && zeroLuma < coverage ? 1 : 0;

    }

    return { mask, width: unit.width, height: unit.height };

}

/** Reads a plate and returns both domains, measured over the mask the caller supplies. */
export function measurePlate( file, settings = {} ) {

    const decoded = decodePng( fs.readFileSync( file ) );
    const mask = settings.mask ?? new Uint8Array( decoded.width * decoded.height ).fill( 1 );

    const linear = lumaField( decoded, 'linear' );
    const encoded = lumaField( decoded, 'encoded' );

    return {
        file,
        width: decoded.width,
        height: decoded.height,
        maskPixels: mask.reduce( ( total, value ) => total + value, 0 ),
        linear: bandPower( { ...linear, mask }, settings ),
        encoded: bandPower( { ...encoded, mask }, settings )
    };

}

/**
 * 🎯 THE ATTRIBUTABLE READING: the band power of the DIFFERENCE between two plates that differ in
 * one expression, as a fraction of the shipped plate's own mean.
 *
 * This is the statistic every claim in this round rests on, and it is the answer to §6's blind
 * spot. An ABSOLUTE lock-band reading contains every card border, every silhouette and every shadow
 * boundary on the plate; a DIFFERENCE contains only what the one changed expression put there. The
 * mass band of a difference is the term's DC shift and is reported so a term that merely darkened
 * the groom cannot be mistaken for one that structured it.
 *
 * @returns {{ delivered:{filament:number,lock:number,mass:number}, mean:number, count:number }}
 */
export function measureDelivered( aFile, bFile, settings = {} ) {

    const a = decodePng( fs.readFileSync( aFile ) );
    const b = decodePng( fs.readFileSync( bFile ) );

    if ( a.width !== b.width || a.height !== b.height ) throw new Error( 'band-power: plates differ in size' );

    const mask = settings.mask ?? new Uint8Array( a.width * a.height ).fill( 1 );
    const fieldA = lumaField( a, 'linear' );
    const fieldB = lumaField( b, 'linear' );

    const difference = new Float64Array( fieldA.field.length );
    for ( let index = 0; index < difference.length; index ++ ) {

        difference[ index ] = fieldA.field[ index ] - fieldB.field[ index ];

    }

    const reference = bandPower( { ...fieldA, mask }, settings );
    const change = bandPower( { field: difference, width: a.width, height: a.height, mask }, settings );

    return {
        mean: reference.mean,
        count: change.count,
        delivered: {
            filament: change.filament / reference.mean,
            lock: change.lock / reference.mean,
            mass: change.mass / reference.mean
        }
    };

}

// --- the CLI ------------------------------------------------------------------------------------

function report( reading ) {

    const relative = reading.linear.relative;

    console.log( `  ${ path.basename( reading.file ) }  ${ reading.width }x${ reading.height }` +
        `  measured px ${ reading.linear.count.toLocaleString() }` );
    console.log( `    linear   mean ${ reading.linear.mean.toExponential( 4 ) }` +
        `   filament ${ ( relative.filament * 100 ).toFixed( 3 ) }%` +
        `   lock ${ ( relative.lock * 100 ).toFixed( 3 ) }%` +
        `   mass ${ ( relative.mass * 100 ).toFixed( 3 ) }%` );
    console.log( `    encoded  mean ${ reading.encoded.mean.toFixed( 2 ) }/255` +
        `   filament ${ reading.encoded.filament.toFixed( 4 ) }` +
        `   lock ${ reading.encoded.lock.toFixed( 4 ) }` +
        `   mass ${ reading.encoded.mass.toFixed( 4 ) }  code values` );

}

if ( process.argv[ 1 ] === fileURLToPath( import.meta.url ) ) {

    const argv = process.argv.slice( 2 );
    const flag = ( name ) => { const at = argv.indexOf( `--${ name }` ); return at < 0 ? null : argv[ at + 1 ]; };
    const files = argv.filter( ( argument, index ) =>
        argument.startsWith( '--' ) === false && argv[ index - 1 ]?.startsWith( '--' ) !== true );

    if ( files.length === 0 ) {

        console.log( 'usage: node tools/critic/band-power.mjs <plate.png> [after.png] --unit <unit.png> --zero <zero.png>' );
        process.exit( 2 );

    }

    const unit = flag( 'unit' );
    const zero = flag( 'zero' );
    const mask = unit !== null && zero !== null ? solidHairMask( unit, zero ).mask : undefined;

    console.log( 'band-power.mjs — filament / lock / mass, RMS over the eroded solid-hair mask' );
    console.log( mask === undefined
        ? '  ⚠️  NO MASK — measuring the whole frame. Pass --unit and --zero for the hair mask.\n'
        : `  mask: ${ mask.reduce( ( total, value ) => total + value, 0 ).toLocaleString() } solid hair px` +
          ` from ${ path.basename( unit ) } vs ${ path.basename( zero ) }\n` );

    const readings = files.map( ( file ) => measurePlate( file, { mask } ) );
    for ( const reading of readings ) report( reading );

    if ( readings.length === 2 ) {

        const [ before, after ] = readings;
        const change = ( key ) => ( after.linear.relative[ key ] / before.linear.relative[ key ] );

        console.log( `\n  A/B      filament x${ change( 'filament' ).toFixed( 3 ) }` +
            `   lock x${ change( 'lock' ).toFixed( 3 ) }` +
            `   mass x${ change( 'mass' ).toFixed( 3 ) }` );

        // 🎯 The attributable half. See `measureDelivered`.
        const delivered = measureDelivered( files[ 1 ], files[ 0 ], { mask } ).delivered;

        console.log( `  DELIVERED by the change alone, as a share of the plate's own mean:` +
            `  filament ${ ( delivered.filament * 100 ).toFixed( 3 ) }%` +
            `   lock ${ ( delivered.lock * 100 ).toFixed( 3 ) }%` +
            `   mass ${ ( delivered.mass * 100 ).toFixed( 3 ) }%` );

    }

}
