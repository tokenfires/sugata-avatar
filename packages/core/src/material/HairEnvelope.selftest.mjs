// HairEnvelope.selftest.mjs — the gate on round 28's depth input.
//
// ## What this gate is for
//
// R27's closing finding was that slide 39's multiple-scattering term — 59% of the hair mass and 87%
// of the crown — takes its `Shadow` from `exp(−shadowDensity · depth.png sampled at uv())`, THE
// CARD'S OWN ATLAS COORDINATE, and that `tools/figure-pipeline/hair_texture.py` fills that sheet
// with `random.random()` per strand. Its words: *"Until `Shadow` stops being noise, no shading
// change to this term is attributable."* R28 replaces the INPUT and leaves the form alone: `n`
// becomes `σ_hair · l`, where `l` is the geometric chord of the groom's own fitted shell from this
// fragment toward THIS LIGHT.
//
// 🎯 THE CLAUSE THAT MATTERS MOST IS §C, AND IT IS A RED PROOF RATHER THAN A CHECK. R27 killed the
// previous attempt by showing it was a scalar in disguise — level-matched, it produced the same
// moves, the same rank order (ρ 0.9763) and the same crop. The discriminator it used is one line:
// **a term that varies with light direction must change when the light moves and the camera does
// not.** §C is that discriminator as arithmetic, so it runs on every clean tree at no cost, and it
// is asserted in BOTH directions: the geometric path must move when the direction moves, and the
// baked sheet — being one number per texel — provably cannot.
//
// ## 🚩 WHAT THIS GATE CANNOT SEE, STATED BEFORE ITS NUMBERS
//
// **1. IT TESTS THE CPU MIRROR, NOT THE EMITTED SHADER.** `shellPathValue` and `forwardChordNode`
// are written to be the same arithmetic — same quadratic, same `max(0, …)` on both roots, same
// difference of two chords — and nothing here compares them expression by expression, because that
// needs a GPU readback harness this file does not have. What DOES tie them together is end to end
// and is in the round's own record: the envelope the material fits at runtime reproduces the one
// `hair-envelope.mjs` fits offline to every printed digit (centre, both radii sets, the 0.385
// residual), and the plate discriminator moves in the direction and by the order of magnitude the
// arithmetic leg predicts. That is agreement at the ends, not proof in the middle.
//
// **2. §E IS RE-DERIVED FROM A RECORD ITS OWN PRODUCER WROTE.** `/captures/` is gitignored, so the
// measured constants come out of `tools/critic/hair-envelope.measured.json`. That checks
// transcription and arithmetic and cannot catch an error the producer and the record share — R27's
// stated permanent limit of `quoted-numbers`, inherited here deliberately.
//
//   node packages/core/src/material/HairEnvelope.selftest.mjs
//
// Exit code is the number of failed clauses.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
    HAIR_DEFAULTS,
    HAIR_DEFECTS,
    HAIR_ENVELOPE_EXTINCTION,
    HAIR_ENVELOPE_QUANTILES,
    baseColourDerivation,
    ellipsoidSpanValue,
    fitEllipsoidValue,
    forwardChordValue,
    hairEnvelopeValue,
    scatterValue,
    shellPathValue
} from './HairMaterial.js';

const REPO = path.resolve( path.dirname( fileURLToPath( import.meta.url ) ), '..', '..', '..', '..' );

const checks = [];

function check( name, pass, detail = '' ) {

    checks.push( { name, pass, detail } );

}

const close = ( a, b, tolerance = 1e-9 ) => Math.abs( a - b ) <= tolerance;

// ================================================================================================
// A. THE CHORD — arithmetic whose answer is known without a plate
// ================================================================================================

{
    const unit = ellipsoidSpanValue( [ 0, 0, 0 ], [ 1, 0, 0 ], [ 1, 1, 1 ] );

    check( 'A1 a unit sphere, from its own centre, spans [−1, 1]',
        close( unit[ 0 ], - 1 ) && close( unit[ 1 ], 1 ), `got [${ unit }]` );

    const radii = [ 2, 3, 4 ];
    const x = ellipsoidSpanValue( [ 0, 0, 0 ], [ 1, 0, 0 ], radii );
    const y = ellipsoidSpanValue( [ 0, 0, 0 ], [ 0, 1, 0 ], radii );
    const z = ellipsoidSpanValue( [ 0, 0, 0 ], [ 0, 0, 1 ], radii );

    check( 'A2 an anisotropic ellipsoid exits at each of its own semi-axes',
        close( x[ 1 ], 2 ) && close( y[ 1 ], 3 ) && close( z[ 1 ], 4 ),
        `got ${ x[ 1 ] }, ${ y[ 1 ] }, ${ z[ 1 ] }` );

    check( 'A3 a ray that misses returns null rather than a NaN',
        ellipsoidSpanValue( [ 0, 2, 0 ], [ 1, 0, 0 ], [ 1, 1, 1 ] ) === null );

    // Only the FORWARD half counts. A fragment on the far surface pointing outward has an
    // algebraic span two units long and zero light-blocking path.
    const outward = ellipsoidSpanValue( [ 1, 0, 0 ], [ 1, 0, 0 ], [ 1, 1, 1 ] );

    check( 'A4 a span entirely behind the fragment contributes zero',
        close( forwardChordValue( outward ), 0 ), `got ${ forwardChordValue( outward ) }` );

    // The mixed case, and it is the one a fragment INSIDE the shell actually takes: half the chord
    // is behind it, so the forward part is one radius rather than two.
    const inside = ellipsoidSpanValue( [ 0, 0, 0 ], [ 1, 0, 0 ], [ 1, 1, 1 ] );

    check( 'A5 a fragment inside the ellipsoid contributes only the part in front of it',
        close( forwardChordValue( inside ), 1 ), `got ${ forwardChordValue( inside ) }` );
}

// ================================================================================================
// B. THE SHELL — the difference of two chords, which is the whole model
// ================================================================================================

const SHELL = { outer: [ 2, 2, 2 ], inner: [ 1, 1, 1 ] };

{
    // A fragment on the outer surface firing back through the middle: the outer chord is 4, the
    // inner is 2, so the hair path is 2 — one unit of shell on the way in, one on the way out.
    const through = shellPathValue( [ 2, 0, 0 ], [ - 1, 0, 0 ], SHELL );

    check( 'B1 a diametral ray crosses the shell twice and the skull not at all',
        close( through, 2 ), `got ${ through }, expected 2` );

    check( 'B2 a fragment on the envelope firing outward has zero path',
        close( shellPathValue( [ 2, 0, 0 ], [ 1, 0, 0 ], SHELL ), 0 ) );

    // 🚩 THE FALLBACK, AS ARITHMETIC. `createHairMaterial` starts `outer` and `inner` EQUAL, so a
    // material that never meets a mesh computes the same chord twice and their difference is
    // exactly zero — `Shadow` = 1, and the term collapses to the value a build with no depth sheet
    // already renders. This clause is why no `if` is needed on the GPU to say so.
    const degenerate = { outer: [ 1, 1, 1 ], inner: [ 1, 1, 1 ] };
    let anyNonZero = false;

    for ( let i = 0; i < 64; i ++ ) {

        const angle = ( i / 64 ) * 2 * Math.PI;
        const l = shellPathValue( [ 0.3, - 0.2, 0.1 ], [ Math.cos( angle ), Math.sin( angle ), 0 ], degenerate );

        if ( l !== 0 ) anyNonZero = true;

    }

    check( 'B3 an unfitted material\'s degenerate shell is EXACTLY zero in every direction',
        anyNonZero === false, 'a single non-zero would mean the unapplied material shades on a NaN-adjacent path' );
}

// ================================================================================================
// C. 🔴 THE DISCRIMINATOR — R27's one-line falsification, run in both directions
// ================================================================================================

{
    const origin = [ 1.4, 0.3, 0.2 ];
    const directions = [];

    for ( let i = 0; i < 32; i ++ ) {

        const angle = ( i / 32 ) * 2 * Math.PI;
        directions.push( [ Math.cos( angle ), Math.sin( angle ), 0 ] );

    }

    const lengths = directions.map( ( d ) => shellPathValue( origin, d, SHELL ) );
    const spread = Math.max( ...lengths ) - Math.min( ...lengths );

    check( '🔴 C1 the path length VARIES WITH LIGHT DIRECTION at a fixed fragment',
        spread > 1e-6,
        `min ${ Math.min( ...lengths ).toFixed( 6 ) } max ${ Math.max( ...lengths ).toFixed( 6 ) } — ` +
        'a spread of zero is what "a scalar in disguise" looks like, and it is what R27 measured' );

    // And it must vary with the FRAGMENT too, for a fixed direction. A model that reads only the
    // direction is a per-light constant, which is the other way to fake this.
    const fragments = [ [ 1.9, 0, 0 ], [ 1.4, 0, 0 ], [ 1.05, 0, 0 ], [ 0, 1.6, 0 ] ];
    const atFixed = fragments.map( ( p ) => shellPathValue( p, [ - 1, 0, 0 ], SHELL ) );
    const fragmentSpread = Math.max( ...atFixed ) - Math.min( ...atFixed );

    check( '🔴 C2 the path length VARIES WITH THE FRAGMENT at a fixed direction',
        fragmentSpread > 1e-6, `values ${ atFixed.map( ( v ) => v.toFixed( 4 ) ).join( ', ' ) }` );

    // 🎯 AND THE CONTROL, WHICH IS THE HALF THAT MAKES C1 MEAN ANYTHING. The input R28 replaces is
    // a texture read at `uv()`: one number per fragment, by construction shared by every light. Its
    // across-direction spread is not merely small, it is IDENTICALLY ZERO — and that is the defect,
    // stated as arithmetic rather than as a sentence. Modelled here as what the shader does:
    // `n = shadowDensity · sheet(uv)`, with `uv` fixed because the fragment is fixed.
    const sheetEvents = ( sheetValue ) => HAIR_DEFAULTS.shadowDensity * sheetValue;
    const bakedAcrossDirections = directions.map( () => sheetEvents( 0.42 ) );
    const bakedSpread = Math.max( ...bakedAcrossDirections ) - Math.min( ...bakedAcrossDirections );

    check( '🔴 C3 CONTROL: the sheet input the round replaces has EXACTLY zero directional spread',
        bakedSpread === 0,
        'this is R27\'s finding as arithmetic — the shipped n is a texture read at uv() and no ' +
        'light appears in that expression' );
}

// ================================================================================================
// D. THE FIT — recovery, and the conditioning failure it was written around
// ================================================================================================

/** A deterministic spiral over a sphere, mapped to an ellipsoid. No seed for a gate to disagree on. */
function ellipsoidCloud( centre, radii, count, scale = 1 ) {

    const out = new Float64Array( count * 3 );

    for ( let i = 0; i < count; i ++ ) {

        const z = - 1 + ( 2 * i ) / ( count - 1 );
        const r = Math.sqrt( Math.max( 0, 1 - z * z ) );
        const phi = i * 2.399963229728653;

        out[ i * 3 ] = centre[ 0 ] + scale * radii[ 0 ] * r * Math.cos( phi );
        out[ i * 3 + 1 ] = centre[ 1 ] + scale * radii[ 1 ] * r * Math.sin( phi );
        out[ i * 3 + 2 ] = centre[ 2 ] + scale * radii[ 2 ] * z;

    }

    return out;

}

const CLOUD_CENTRE = [ 0.1, 1.5, - 0.2 ];
const CLOUD_RADII = [ 0.09, 0.12, 0.10 ];

{
    const cloud = ellipsoidCloud( CLOUD_CENTRE, CLOUD_RADII, 2000 );
    const fit = fitEllipsoidValue( cloud );

    check( 'D1 the fit recovers a known off-centre ellipsoid to 1e-6',
        fit.centre.every( ( v, i ) => close( v, CLOUD_CENTRE[ i ], 1e-6 ) ) &&
        fit.radii.every( ( v, i ) => close( v, CLOUD_RADII[ i ], 1e-6 ) ),
        `centre [${ fit.centre.map( ( v ) => v.toFixed( 6 ) ) }] radii [${ fit.radii.map( ( v ) => v.toFixed( 6 ) ) }]` );

    check( 'D2 a cloud that IS the surface fits with ~zero residual',
        fit.residual < 1e-6, `residual ${ fit.residual.toExponential( 3 ) }` );

    // 🔴 THE RED PROOF FOR THE MEAN-CENTRING, and it is a real historical failure rather than a
    // hypothetical. The groom sits at y ≈ 1.5 m with a 0.1 m radius, so the raw design matrix has a
    // `y²` column of ~2.25 beside an `x²` column of ~0.01 and normal equations SQUARE the condition
    // number. Fitted WITHOUT centring — this local function is the version that shipped for ten
    // minutes — the same cloud returns a squared coefficient that is not positive, i.e. a
    // hyperboloid, on data that is an ellipsoid by construction.
    const raw = fitUncentred( cloud );

    check( '🔴 D3 the SAME cloud fitted WITHOUT mean-centring is not an ellipsoid',
        raw.some( ( v, i ) => i < 3 && v <= 0 ),
        `squared coefficients [${ raw.slice( 0, 3 ).map( ( v ) => v.toExponential( 2 ) ).join( ', ' ) }] — ` +
        'at least one must be non-positive, which is why fitEllipsoidValue centres first' );
}

{
    // 🎯 THE SHELL RECOVERY, on a synthetic groom whose answer is known by construction. Two
    // concentric ellipsoidal surfaces at 0.8x and 1.2x of one shape, equal populations: the p02 and
    // p98 radial quantiles must land on those two scales, so `hairEnvelopeValue` recovers the shell
    // it was given rather than some interior compromise.
    const inner = ellipsoidCloud( CLOUD_CENTRE, CLOUD_RADII, 3000, 0.8 );
    const outer = ellipsoidCloud( CLOUD_CENTRE, CLOUD_RADII, 3000, 1.2 );
    const both = new Float64Array( inner.length + outer.length );
    both.set( inner, 0 );
    both.set( outer, inner.length );

    const envelope = hairEnvelopeValue( both );
    const innerRatio = envelope.inner[ 0 ] / CLOUD_RADII[ 0 ];
    const outerRatio = envelope.outer[ 0 ] / CLOUD_RADII[ 0 ];

    check( 'D4 a two-surface shell is recovered at its own two scales',
        close( innerRatio, 0.8, 5e-3 ) && close( outerRatio, 1.2, 5e-3 ),
        `recovered inner ${ innerRatio.toFixed( 4 ) } outer ${ outerRatio.toFixed( 4 ) }, given 0.8 and 1.2` );

    check( 'D5 the shell\'s inner surface is inside its outer one on every axis',
        envelope.inner.every( ( v, i ) => v < envelope.outer[ i ] ) );
}

// ================================================================================================
// E. THE MEASURED CONSTANTS — re-derived from the run that produced them
// ================================================================================================

// ⚠️ WHAT THIS SECTION CANNOT DO, STATED BEFORE ITS NUMBERS. `/captures/` is gitignored, so a gate
// that read the ray cast would go red on a clean checkout. R27 hit this exactly and answered it
// with a machine-written record; this does the same. So E1 re-derives σ from the REGRESSION's own
// sufficient statistics rather than reading the constant twice — but a gate that re-derives a
// number from a record its own producer wrote checks TRANSCRIPTION AND ARITHMETIC, not the
// measurement, and cannot catch an error the producer and the record share. That is R27's stated
// permanent limit of `quoted-numbers`, inherited here on purpose and written down rather than
// rediscovered.

const RECORD_PATH = path.join( REPO, 'tools', 'critic', 'hair-envelope.measured.json' );

{
    if ( fs.existsSync( RECORD_PATH ) === false ) {

        check( 'E1 the measured record exists', false,
            `missing ${ RECORD_PATH } — run: node tools/critic/hair-envelope.mjs --models --out captures/hair-r28-envelope` );

    } else {

        const record = JSON.parse( fs.readFileSync( RECORD_PATH, 'utf8' ) );
        const sigma = record.regression.sumPathTimesCards / record.regression.sumPathSquared;

        console.log( `  sigma from the ray cast: ${ sigma.toFixed( 2 ) } card crossings per metre, ` +
            `over ${ record.regression.pairs } pixel-light pairs` );

        check( 'E1 HAIR_ENVELOPE_EXTINCTION is the regression the run recorded',
            close( sigma, HAIR_ENVELOPE_EXTINCTION, 5e-3 ),
            `re-derived ${ sigma.toFixed( 4 ) } against the source's ${ HAIR_ENVELOPE_EXTINCTION }` );

        check( 'E2 the recorded envelope was fitted at the quantiles the source ships',
            record.envelope.quantiles.every( ( q, i ) => close( q, HAIR_ENVELOPE_QUANTILES[ i ] ) ),
            `record ${ record.envelope.quantiles } against ${ HAIR_ENVELOPE_QUANTILES }` );

        check( 'E3 the regression is pooled over the lights that carry the energy, not over all five',
            record.energyLights.length === 3 && record.energyLights.includes( 'key' ) &&
            record.energyLights.includes( 'fill' ) && record.energyLights.includes( 'rim' ) === false,
            `pooled over ${ record.energyLights.join( ', ' ) } — CHECKPOINT §9 puts rim and kicker at 0.02-0.87% of a hair pixel` );

        check( 'E4 HAIR_DEFAULTS carries the measured extinction rather than a second number',
            HAIR_DEFAULTS.envelopeExtinction === HAIR_ENVELOPE_EXTINCTION,
            `defaults ${ HAIR_DEFAULTS.envelopeExtinction }, constant ${ HAIR_ENVELOPE_EXTINCTION }` );

        // ================================================================================
        // The round's own figures, printed so `tools/quoted-numbers.mjs` can adjudicate the
        // comment block in `HairMaterial.js` that argues from them. Same record, same limit.
        // ================================================================================
        const v = record.verdict;

        if ( v == null ) {

            check( 'E5 the verdict record exists', false,
                'run: node tools/critic/hair-envelope.mjs --verdict --out captures/hair-r28-envelope' );

        } else {

            // ⚠️ EVERY LABEL HERE IS NUMERAL-FREE AND UNIQUE IN THIS RUN'S OUTPUT, AND BOTH
            // PROPERTIES ARE LOAD-BEARING RATHER THAN TIDY. `quoted-numbers.mjs` picks the n-th
            // NUMERIC LITERAL on the one line its selector matches, so a label reading "p95/p50"
            // offers `95` as literal #1 and a selector that also appears in a clause NAME matches
            // two lines and is refused. Both went red on this file's first run before this comment
            // existed, which is the gate behaving exactly as its own header promises.
            console.log( `  directional A/B fraction: ${ ( v.oneExpressionMovedFraction * 100 ).toFixed( 2 ) } ` +
                `percent of the gated hair pixels moved` );
            console.log( `  n toward the key, mean: ${ v.meanEventsTowardKey.a.toFixed( 4 ) } then ` +
                `${ v.meanEventsTowardKey.b.toFixed( 4 ) } when the key moves` );
            console.log( `  pedestal shape, shipped input: ${ v.pedestalShape[ 'ped-sheet-a1' ].toFixed( 4 ) }` );
            console.log( `  pedestal shape, envelope input: ${ v.pedestalShape[ 'ped-env-a1' ].toFixed( 4 ) }` );

            // 🎯 THE ROUND'S OWN VERDICT, AS A CLAUSE RATHER THAN AS A SENTENCE. The falsification
            // is that the geometric input must move the picture on the one-token A/B; if a later
            // change quietly makes `envelope-depth` and `envelope-fixed-direction` render the same
            // frame, the term has become a scalar in disguise and this goes red rather than the
            // conclusion silently rotting in a comment.
            check( '🔴 E5 the one-token A/B moved a majority of the gate, so the term reads the light',
                v.oneExpressionMovedFraction > 0.5,
                `${ v.oneExpressionMovedPixels } of ${ v.gatePixels } pixels — ` +
                'the fixed-direction arm differs from the light-facing one in a single token' );

            check( '🔴 E6 `n` toward the key changes when the key moves and the camera does not',
                Math.abs( v.meanEventsTowardKey.a - v.meanEventsTowardKey.b ) > 0.1,
                `mean ${ v.meanEventsTowardKey.a.toFixed( 4 ) } -> ${ v.meanEventsTowardKey.b.toFixed( 4 ) } ` +
                `over ${ v.fragments } measured fragments` );

            // ⚠️ AND THE NEGATIVE, PINNED SO IT CANNOT BE FORGOTTEN INTO A POSITIVE. The pedestal's
            // own shape — a percentile ratio, exactly invariant to `scatter` — moves by 0.2% between
            // the shipped input and the geometric one. A future reader who assumes R28 improved the
            // picture is wrong, and this clause is where that is written down as arithmetic.
            const shipped = v.pedestalShape[ 'ped-sheet-a1' ];
            const envelope = v.pedestalShape[ 'ped-env-a1' ];
            check( '⚠️ E7 THE NEGATIVE: the geometric input changes the pedestal\'s SHAPE by under 2%',
                Math.abs( envelope - shipped ) / shipped < 0.02,
                `shipped ${ shipped.toFixed( 4 ) } vs envelope ${ envelope.toFixed( 4 ) } — ` +
                `${ ( ( ( envelope - shipped ) / shipped ) * 100 ).toFixed( 2 ) }%. Slide 39 spends Shadow ` +
                'on a unit-luminance chromaticity exponent, so a depth input recolours the pedestal ' +
                'and cannot lower it. If this clause ever goes red the FORM changed, not the input.' );

            check( '⚠️ E8 no arm puts a single pixel above 4x the R lobe\'s own mean',
                Object.values( v.massContrast ).every( ( m ) => m.above4 === 0 ),
                `where R26 and R27 left it: ${ Object.entries( v.massContrast )
                    .map( ( [ k, m ] ) => `${ k } ${ ( m.above4 * 100 ).toFixed( 4 ) }%` ).join( ', ' ) }` );

        }

    }
}

// ================================================================================================
// F. 🎯 WHY THE NEGATIVE IS STRUCTURAL — slide 39's ceiling on what ANY depth input can buy
// ================================================================================================

// This is the round's whole explanation and it needs no plate. Slide 39 spends `Shadow` in exactly
// one place: the per-channel factor `(C / Luma(C))^(1 − Shadow)`.
//
// 🔴 AND THE OBVIOUS ARGUMENT ABOUT IT IS WRONG, WHICH IS WHY THE CEILING IS MEASURED HERE RATHER
// THAN ASSERTED. "Divide a colour by its own luminance and the result has luminance 1, so the factor
// cannot change brightness" is true of the FACTOR — G1 checks it to twelve decimals at both ends —
// and false of the TERM. The factor multiplies `√C` CHANNEL BY CHANNEL, and the two are positively
// correlated: the exponent boosts exactly the channel `√C` is already largest in. `Luma(a ⊙ b)` is
// not `Luma(a) · Luma(b)`, so the product's luminance does move. This selftest's first version
// claimed 0.00% from G1 alone and was wrong by the whole size of the effect.
//
// So G2 runs the SHIPPED MIRROR — `scatterValue`, the same arithmetic the shader emits — across the
// entire range of `Shadow` and reads the luminance ratio off it. That number is the hard ceiling on
// what ANY depth input can buy inside this form, however correct the input is. R27 measured the
// same quantity independently and this file already carries it as a tagged claim: 1.0927.

{
    const colour = baseColourDerivation().linear;
    const luminance = ( v ) => 0.2126 * v[ 0 ] + 0.7152 * v[ 1 ] + 0.0722 * v[ 2 ];
    const luma = luminance( colour );
    const chroma = colour.map( ( c ) => c / luma );

    const factorLuminance = ( exponent ) => luminance( chroma.map( ( c ) => Math.pow( c, exponent ) ) );

    check( 'F1 slide 39\'s chroma FACTOR has luminance exactly 1 at both ends of its exponent',
        close( factorLuminance( 0 ), 1, 1e-12 ) && close( factorLuminance( 1 ), 1, 1e-12 ),
        `Shadow = 1 gives ${ factorLuminance( 0 ).toFixed( 12 ) }, ` +
        `Shadow = 0 gives ${ factorLuminance( 1 ).toFixed( 12 ) } — and this is NOT the term` );

    // The TERM, over the whole domain of the input. `wrap` and `scatter` are scalars on every
    // channel alike, so they cancel out of the ratio and any fixed geometry does.
    const term = ( shadow ) => luminance( scatterValue( 0.3, colour, shadow ) );
    let widest = 0;
    let narrowest = Infinity;

    for ( let i = 0; i <= 1000; i ++ ) {

        const v = term( i / 1000 );
        widest = Math.max( widest, v );
        narrowest = Math.min( narrowest, v );

    }

    const ceiling = widest / narrowest;

    console.log( `  slide 39 luminance ratio over the whole range of Shadow: ${ ceiling.toFixed( 4 ) }` );

    check( '🔴 F2 THE CEILING: over the ENTIRE range of Shadow the term\'s luminance moves 1.09x',
        ceiling > 1.05 && ceiling < 1.15,
        `${ ceiling.toFixed( 4 ) }x, against R26 buying 1.19x of dynamic range from ONE lobe-width ` +
        'constant. No input, however correct, beats this bound inside slide 39\'s form — which is ' +
        'why R28\'s measured answer is 0.21% and why the FORM is the next lever, not the input.' );
}

// ================================================================================================
// G. THE ARMS ARE REACHABLE WITHOUT EDITING alive.js
// ================================================================================================

{
    // `alive.js:2039` validates `?hairdefect=` against `Object.hasOwn( HAIR_DEFECTS, defect )`, so a
    // key added to that table is reachable from the page with no change to a file this round does
    // not own. R24, R25, R26 and R27 all state the same clause for the same reason.
    const required = [ 'envelope-depth', 'envelope-zinke', 'envelope-fixed-direction' ];

    check( 'G1 every round-28 arm is in HAIR_DEFECTS, so ?hairdefect= reaches it unedited',
        required.every( ( key ) => Object.hasOwn( HAIR_DEFECTS, key ) ),
        `missing ${ required.filter( ( k ) => Object.hasOwn( HAIR_DEFECTS, k ) === false ).join( ', ' ) || 'none' }` );

    check( 'G2 the falsification arm is described AS a falsification, not as a feature',
        /FALSIFICATION/.test( HAIR_DEFECTS[ 'envelope-fixed-direction' ] ) );

    // R27's arm must still be reachable and still mean what it meant: its input is the SHEET. A
    // round that quietly redefined the previous round's control would make both unattributable.
    check( 'G3 R27\'s zinke-transmittance arm still names the sheet as its input',
        /shadowDensity·depth/.test( HAIR_DEFECTS[ 'zinke-transmittance' ] ) );
}

// ================================================================================================

const failed = checks.filter( ( c ) => c.pass === false );

for ( const c of checks ) {

    console.log( `  ${ c.pass ? 'ok  ' : 'FAIL' }  ${ c.name }${ c.detail ? `\n          ${ c.detail }` : '' }` );

}

console.log( `\n  HairEnvelope: ${ checks.length - failed.length }/${ checks.length } clauses green` );

process.exit( failed.length );

/**
 * The un-centred normal equations, kept HERE rather than in the material, because its only purpose
 * is to fail. See D3.
 */
function fitUncentred( points ) {

    const count = points.length / 3;
    const normal = new Float64Array( 36 );
    const rhs = new Float64Array( 6 );
    const row = new Float64Array( 6 );

    for ( let i = 0; i < count; i ++ ) {

        const x = points[ i * 3 ];
        const y = points[ i * 3 + 1 ];
        const z = points[ i * 3 + 2 ];

        row[ 0 ] = x * x; row[ 1 ] = y * y; row[ 2 ] = z * z;
        row[ 3 ] = x; row[ 4 ] = y; row[ 5 ] = z;

        for ( let r = 0; r < 6; r ++ ) {

            rhs[ r ] += row[ r ];
            for ( let c = 0; c < 6; c ++ ) normal[ r * 6 + c ] += row[ r ] * row[ c ];

        }

    }

    // Gaussian elimination, partial pivoting — the same solver, on the un-centred system.
    const n = 6;
    const m = Float64Array.from( normal );
    const v = Float64Array.from( rhs );

    for ( let col = 0; col < n; col ++ ) {

        let pivot = col;

        for ( let r = col + 1; r < n; r ++ ) {

            if ( Math.abs( m[ r * n + col ] ) > Math.abs( m[ pivot * n + col ] ) ) pivot = r;

        }

        if ( pivot !== col ) {

            for ( let c = 0; c < n; c ++ ) {

                const t = m[ col * n + c ];
                m[ col * n + c ] = m[ pivot * n + c ];
                m[ pivot * n + c ] = t;

            }

            const t = v[ col ]; v[ col ] = v[ pivot ]; v[ pivot ] = t;

        }

        const diagonal = m[ col * n + col ];

        for ( let r = col + 1; r < n; r ++ ) {

            const factor = m[ r * n + col ] / diagonal;

            if ( factor === 0 ) continue;

            for ( let c = col; c < n; c ++ ) m[ r * n + c ] -= factor * m[ col * n + c ];

            v[ r ] -= factor * v[ col ];

        }

    }

    const out = new Float64Array( n );

    for ( let r = n - 1; r >= 0; r -- ) {

        let sum = v[ r ];

        for ( let c = r + 1; c < n; c ++ ) sum -= m[ r * n + c ] * out[ c ];

        out[ r ] = sum / m[ r * n + r ];

    }

    return Array.from( out );

}
