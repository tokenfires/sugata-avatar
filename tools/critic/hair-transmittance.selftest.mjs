#!/usr/bin/env node
//
// hair-transmittance.selftest.mjs — the arithmetic gate on round 27's change and on the operators
// that judge it. No page, no network, no GPU: every clause below has an answer that can be worked
// out on paper, and every one of them has a REJECTION clause beside it.
//
// ## Why the rejection clauses are the point
//
// `docs/CHECKPOINT.md` records EIGHT structurally-blind statistics in this phase — operators that
// returned a true number computed by the wrong instrument, the most recent found in the round that
// wrote it. The pattern in every case is an operator that was only ever checked on inputs where it
// happened to work. So each clause here comes in a pair: what the operator must SAY, and what it
// must REFUSE.
//
//   node tools/critic/hair-transmittance.selftest.mjs

import { readFileSync } from 'node:fs';

import {
    baseColourDerivation,
    forwardScatteringEvents,
    scatterValue,
    HAIR_DEFAULTS,
    HAIR_DEFECTS
} from '../../packages/core/src/material/HairMaterial.js';

import { chroma, percentile, solveLevelMatch, stats, ASSUMED_ALBEDO_LUMA, LEVEL_ARMS } from './hair-transmittance.mjs';

let passes = 0;
let failures = 0;

function check( label, condition, detail = '' ) {

    if ( condition ) { passes += 1; console.log( `  ✅ ${ label }${ detail ? `  ${ detail }` : '' }` ); }
    else { failures += 1; console.log( `  🔴 ${ label }${ detail ? `  ${ detail }` : '' }` ); }

}

const close = ( a, b, tolerance = 1e-9 ) => Math.abs( a - b ) <= tolerance;

const C = baseColourDerivation().linear;
const luminance = ( v ) => 0.2126 * v[ 0 ] + 0.7152 * v[ 1 ] + 0.0722 * v[ 2 ];

console.log( '\n--- A. `forwardScatteringEvents`: slide 44 inverted ------------------------------\n' );

{
    // Shadow = exp(−n), so the inversion is exact at every point that is not the clamp.
    let exact = true;
    for ( const n of [ 0, 0.25, 1, 1.5, 2, 3 ] ) {

        if ( close( forwardScatteringEvents( Math.exp( - n ) ), n, 1e-12 ) === false ) exact = false;

    }

    check( 'n = −ln(exp(−n)) to 1e-12 at n = 0, 0.25, 1, 1.5, 2, 3', exact );

    check( 'a fully-lit fragment is n = 0 exactly', forwardScatteringEvents( 1 ) === 0 );

    // 🔴 THE REJECTION CLAUSE. An operator that returned Infinity here would put a NaN through the
    // shader mirror and every downstream statistic would be silently empty rather than loudly wrong.
    const clamped = forwardScatteringEvents( 0 );
    check( 'Shadow = 0 returns a finite number rather than Infinity', Number.isFinite( clamped ) );

    const deepest = HAIR_DEFAULTS.shadowDensity;
    console.log( `     events clamp at EPSILON 1e-4: n_max ${ clamped.toFixed( 6 ) }, ` +
        `which is ${ ( clamped / deepest ).toFixed( 2 ) }x the deepest baked texel (n = ${ deepest.toFixed( 1 ) })` );

    check( 'the clamp sits outside anything the shipped sheet can produce', clamped > deepest );
}

console.log( '\n--- B. the change itself, against Zinke Eq.5 and against what it replaced -------\n' );

{
    // 🎯 THE BOUNDARY EQUALITY, AND IT IS THE CLAUSE THAT MAKES THE A/B ATTRIBUTABLE. Zinke §3.1.1
    // sets T_f = 1 at n = 0. Our exponent is 1 + n, so at n = 0 the expression is √C · wrap — which
    // is slide 39's own value there, because its (C/Luma)^(1−Shadow) is (·)^0 = 1 at Shadow = 1.
    // If this clause broke, every fully-lit pixel would move between the arms and no moved pixel
    // could be attributed to the depth dependence.
    const wrapArg = 0.37;
    const probe = ( shadow ) => scatterValue( wrapArg, C, shadow, { defect: 'zinke-transmittance' } );
    const shipped = scatterValue( wrapArg, C, 1 );

    check( 'at Shadow = 1 the two arms agree to 1e-15 on every channel',
        shipped.every( ( v, i ) => close( v, probe( 1 )[ i ], 1e-15 ) ),
        `Y ${ luminance( shipped ).toExponential( 4 ) }` );

    // ā_f = √C is the material's own `absorbTT` at h = 0, cosθd = 1: C^(√(1−0)/2) = C^0.5.
    const absorbTtAtNormalIncidence = C.map( ( c ) => Math.pow( c, Math.sqrt( 1 - 0 ) / ( 2 * 1 ) ) );
    check( 'ā_f = √C is `absorbTT` at h = 0 and cosθd = 1, digit for digit',
        absorbTtAtNormalIncidence.every( ( v, i ) => close( v, Math.sqrt( C[ i ] ), 1e-15 ) ),
        `ā_f ${ absorbTtAtNormalIncidence.map( ( v ) => v.toFixed( 6 ) ).join( ' ' ) }` );

    // Eq.5 is a PRODUCT over n, so the term must be a geometric series in n: T(n+1)/T(n) is the
    // same per-channel constant at every n. That is the property `(C/Luma)^(1−Shadow)` does not have.
    const at = ( n ) => probe( Math.exp( - n ) );
    const ratios = [ 0, 1, 2 ].map( ( n ) => at( n + 1 ).map( ( v, i ) => v / at( n )[ i ] ) );

    check( 'T(n+1)/T(n) is constant in n and equals ā_f, per channel — Eq.5 is a product',
        ratios.every( ( r ) => r.every( ( v, i ) => close( v, Math.sqrt( C[ i ] ), 1e-12 ) ) ) );

    // 🎯 THE DEFECT'S ISOLUMINANCE, MEASURED HERE RATHER THAN ASSERTED IN PROSE. This is the whole
    // reason the change exists, so the number the comments quote is computed by this gate.
    const s39 = ( shadow ) => scatterValue( wrapArg, C, shadow );
    const lumaRatio = luminance( s39( 0 ) ) / luminance( s39( 1 ) );
    const tfRatio = luminance( at( 0 ) ) / luminance( at( 3 ) );

    // ⚠️ TWO DOMAINS, NAMED, BECAUSE THEY ARE NOT THE SAME ONE. `lumaRatio` sweeps slide 39's
    // `Shadow` over 0 → 1; `tfRatio` sweeps Zinke's fibre count `n` over 0 → 3. This line once said
    // "over the full depth range" for both, and HairMaterial.js quoted it that way — the sixth
    // instance of LEARNINGS §1.25r, and the one that showed `quoted-numbers` cannot catch an error
    // its own producer shares. What the probe tests is the SIGN, which is domain-independent. The
    // MAGNITUDES ARE NOT COMPARABLE and must never be divided by one another.
    console.log( `     slide 39 luminance, Shadow 0 → 1: ${ lumaRatio.toFixed( 4 ) }x (RISES with depth)` );
    console.log( `     Zinke T_f luminance, n 0 → 3: ${ tfRatio.toFixed( 1 ) }x (FALLS with depth)` );

    check( 'slide 39 gets BRIGHTER as it deepens — the defect this round names', lumaRatio > 1 );
    check( 'Zinke T_f gets DARKER as it deepens', tfRatio > 1 );

    const satShallow = chroma( at( 0 ) ).saturation;
    const satDeep = chroma( at( 3 ) ).saturation;
    check( 'and MORE saturated as it deepens — Beer–Lambert in both quantities at once',
        satDeep > satShallow, `${ satShallow.toFixed( 4 ) } → ${ satDeep.toFixed( 4 ) }` );

    // 🔴 REJECTION. A term that ignored its own depth input would pass every clause above that only
    // looks at n = 0. This one fails unless the value actually moves.
    check( 'the term is not constant in n', close( luminance( at( 0 ) ), luminance( at( 1 ) ) ) === false );

    // 🎯 AND THE SHIPPED DEFAULT IS SLIDE 39, WHICH IS THE CLAUSE THAT SAYS THE ROUND SHIPPED
    // NOTHING. If a later round flips the default without flipping this file, it goes red here.
    check( 'the SHIPPED default is slide 39, not the probe',
        scatterValue( wrapArg, C, 0.5 ).every( ( v, i ) => v === s39( 0.5 )[ i ] ) &&
        close( luminance( scatterValue( wrapArg, C, 0.5 ) ), luminance( probe( 0.5 ) ) ) === false );

    check( 'the probe is reachable and described', Object.hasOwn( HAIR_DEFECTS, 'zinke-transmittance' ) );
}

console.log( '\n--- C. `solveLevelMatch`: the control is SOLVED, never picked -------------------\n' );

{
    // A linear ramp: means 0, 1, 2, 4, 8 against scalars 0, 0.05, 0.1, 0.2, 0.4 is exactly 20·s.
    const means = LEVEL_ARMS.map( ( s ) => 20 * s );

    check( 'recovers an exact interior point', close( solveLevelMatch( LEVEL_ARMS, means, 2 ), 0.1 ) );
    check( 'interpolates between two arms', close( solveLevelMatch( LEVEL_ARMS, means, 3 ), 0.15 ) );
    check( 'recovers both endpoints', close( solveLevelMatch( LEVEL_ARMS, means, 0 ), 0 ) &&
        close( solveLevelMatch( LEVEL_ARMS, means, 8 ), 0.4 ) );

    // 🔴 THE REJECTION CLAUSE, AND IT IS THE ONE THIS ROUND NEEDS. An extrapolating solver would
    // return a control nobody captured, and the report would compare the arm against a plate that
    // does not exist. Out of range must be null, in BOTH directions.
    check( 'refuses a target above the swept range', solveLevelMatch( LEVEL_ARMS, means, 9 ) === null );
    check( 'refuses a target below the swept range', solveLevelMatch( LEVEL_ARMS, means, - 1 ) === null );
    check( 'refuses a malformed sweep', solveLevelMatch( [ 0 ], [ 0 ], 0 ) === null );
}

console.log( '\n--- D. `chroma`, `stats`, and the gate denominator ------------------------------\n' );

{
    check( 'pure red is saturation 1 at hue 0', close( chroma( [ 1, 0, 0 ] ).saturation, 1 ) &&
        close( chroma( [ 1, 0, 0 ] ).hueDegrees, 0 ) );
    check( 'pure green is hue 120, pure blue hue 240',
        close( chroma( [ 0, 1, 0 ] ).hueDegrees, 120 ) && close( chroma( [ 0, 0, 1 ] ).hueDegrees, 240 ) );

    // 🔴 REJECTION. Grey must read saturation 0 — an operator that leaked a small positive number on
    // an achromatic input would report the R lobe as tinted, which is exactly the claim this round
    // has to be able to make about R and not accidentally manufacture.
    check( 'grey is EXACTLY saturation 0', chroma( [ 0.4, 0.4, 0.4 ] ).saturation === 0 );
    check( 'black returns zeros rather than NaN', chroma( [ 0, 0, 0 ] ).saturation === 0 );

    // The rim's #0f30ff decoded is a blue; the point of the clause is that the operator would SAY so.
    const rim = chroma( [ 0.0033, 0.0295, 1 ] );
    check( 'a blue-dominant mean reads a blue hue', rim.hueDegrees > 200 && rim.hueDegrees < 260,
        `${ rim.hueDegrees.toFixed( 1 ) }°` );

    const ramp = Array.from( { length: 11 }, ( _, i ) => i );
    const s = stats( ramp );
    check( 'stats on 0..10 answers by hand', s.p50 === 5 && s.p10 === 1 && s.p90 === 9 && s.mean === 5 );
    check( 'percentile clamps at both ends', percentile( [ 1, 2, 3 ], - 1 ) === 1 && percentile( [ 1, 2, 3 ], 2 ) === 3 );

    // The gate's denominator is DERIVED from the shipped hex here and interpolated into the report's
    // own column heading, so a label and the arithmetic under it cannot drift apart.
    check( 'the contrast gate divides by #1A0E0C\'s encoded luma, 0.0643',
        close( ASSUMED_ALBEDO_LUMA, 0.0643, 5e-5 ), ASSUMED_ALBEDO_LUMA.toFixed( 6 ) );
}

console.log( '\n--- E. the recorded read-out, which is what the shipped prose is checked against --\n' );

{
    // 🚩 `/captures/` is gitignored, so no `@claim` can name a plate as its producer. `--report
    // --record` writes what it measured into a committed JSON and this block prints it under stable
    // selectors. What that gates is PROSE against a MACHINE-WRITTEN RECORD, which is the failure
    // this project actually has; it is NOT prose against pixels, and saying so is part of the gate.
    const file = new URL( './hair-transmittance.measured.json', import.meta.url );
    let record = null;

    try { record = JSON.parse( readFileSync( file, 'utf8' ) ); } catch { record = null; }

    check( 'the recorded read-out is present', record !== null );

    if ( record !== null ) {

        console.log( `     gate size: ${ record.gatedPixels } gated hair pixels from ${ record.capturedFrom }` );
        console.log( `     pedestal share: slide 39 ${ record.pedestalShare.slide39.toFixed( 2 ) }%, ` +
            `Zinke T_f ${ record.pedestalShare.zinke.toFixed( 2 ) }%` );
        console.log( `     radiance dynamic range p95/p50: slide 39 ${ record.radianceP95OverP50.slide39.toFixed( 3 ) }, ` +
            `Zinke T_f ${ record.radianceP95OverP50.zinke.toFixed( 3 ) }, ` +
            `level-matched constant ${ record.radianceP95OverP50.levelMatched.toFixed( 3 ) }` );
        console.log( `     graded contrast gate: slide 39 ${ record.gradedGateRatio.slide39.toFixed( 2 ) }, ` +
            `Zinke T_f ${ record.gradedGateRatio.zinke.toFixed( 2 ) }, ` +
            `level-matched constant ${ record.gradedGateRatio.levelMatched.toFixed( 2 ) }` );
        console.log( `     R p99 over mass mean: slide 39 ${ record.rP99OverMassMean.slide39.toFixed( 3 ) }, ` +
            `Zinke T_f ${ record.rP99OverMassMean.zinke.toFixed( 3 ) }` );
        console.log( `     mass saturation: slide 39 ${ record.saturation.slide39.toFixed( 4 ) }, ` +
            `Zinke T_f ${ record.saturation.zinke.toFixed( 4 ) }, ` +
            `level-matched constant ${ record.saturation.levelMatched.toFixed( 4 ) }` );
        console.log( `     the level match solved at hairscatter ${ record.starScatter.toFixed( 5 ) }` );
        console.log( `     Spearman between the two arms ${ record.spearmanZinkeVsLevelMatched.toFixed( 4 ) }` );

        // 🎯 THE ROUND'S VERDICT AS ARITHMETIC RATHER THAN AS A SENTENCE. The depth-dependent arm's
        // whole gain over the term it replaces is what a CONSTANT multiple of that same term also
        // buys; what the depth dependence itself is worth is the residual between them.
        const constantGain = record.radianceP95OverP50.levelMatched / record.radianceP95OverP50.slide39 - 1;
        const depthGain = record.radianceP95OverP50.zinke / record.radianceP95OverP50.levelMatched - 1;

        console.log( `     🔴 a level-matched CONSTANT moves radiance p95/p50 by ${ ( 100 * constantGain ).toFixed( 1 ) }%; ` +
            `the depth dependence adds ${ ( 100 * depthGain ).toFixed( 1 ) }% on top of that` );

        check( 'the constant explains far more of the gain than the depth dependence does',
            constantGain > 10 * depthGain );
    }
}

console.log( `\n${ failures === 0 ? '✅' : '🔴' } hair-transmittance ${ passes }/${ passes + failures } clauses green, ${ failures } red\n` );

process.exit( failures === 0 ? 0 : 1 );
