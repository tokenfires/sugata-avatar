/**
 * Gate for `render/Toksvig.js`.
 *
 * The node itself needs a GPU, so what is checked here is the arithmetic the node and its CPU
 * mirror share — and every check is a property that, if it broke, would produce a plausible
 * picture rather than an obvious failure. That is the only kind of bug worth a selftest.
 *
 *   IDENTITY      Zero variance must return the input roughness EXACTLY. A prefilter that
 *                 roughens a perfectly flat surface is a global gloss change wearing a fix's
 *                 clothes, and it looks like "the material is a bit rougher than I wanted".
 *
 *   MONOTONE      More variance is more roughness, never less, at every roughness.
 *
 *   ONE-SIDED     The filtered roughness is never BELOW the input. Sharpening a lobe because the
 *                 normals disagreed is the exact opposite of the intent.
 *
 *   ALPHA SPACE   Variance is added in GGX alpha, not in perceptual roughness. Proved by
 *                 measuring the disagreement with the naive perceptual-space form and REQUIRING
 *                 it to be large: a check that both forms pass is a check that does not
 *                 distinguish them. LEARNINGS §1.1.
 *
 *   CEILING       The published 0.18 threshold binds, so a silhouette pixel cannot drive
 *                 roughness to 1 and draw a dull grey rim around every curved object.
 *
 *   TOKSVIG       |N| = 1 is the identity; shortening |N| only roughens; and the round trip
 *                 through Blinn-Phong power and back is exact at |N| = 1, which is what makes
 *                 the conversion safe to use as a no-op.
 *
 *   ORDER         The two forms agree on DIRECTION for the same physical situation. They are
 *                 different estimators and are not expected to agree numerically; a sign
 *                 disagreement would mean one of them is wired backwards.
 *
 * A measurement outside its range is a FAIL and exits non-zero. It is not grounds for widening
 * the range.
 *
 * Usage:  node "packages/core/src/render/Toksvig.selftest.mjs"
 */

import {
    DEFAULT_VARIANCE_CEILING,
    filteredRoughnessValue,
    toksvigRoughnessValue
} from './Toksvig.js';

let checks = 0;
let failures = 0;

function report( name, passed, detail ) {

    checks += 1;
    if ( passed !== true ) failures += 1;
    console.log( `${ passed ? 'PASS' : 'FAIL' }  ${ name }\n      ${ detail }` );

}

/** The naive form this file exists NOT to be: variance added in perceptual roughness. */
function perceptualSpaceRoughness( perceptualRoughness, variance ) {

    return Math.min( 1, Math.sqrt( perceptualRoughness * perceptualRoughness + Math.min( variance * 2, DEFAULT_VARIANCE_CEILING ) ) );

}

const ROUGHNESSES = [ 0.05, 0.12, 0.26, 0.46, 0.7, 0.95 ];

console.log( '\n--- identity ---------------------------------------------------------------\n' );

{
    const worst = Math.max( ...ROUGHNESSES.map( ( r ) => Math.abs( filteredRoughnessValue( r, 0 ) - r ) ) );

    report(
        'zero variance is the identity, to floating point',
        worst < 1e-12,
        `worst |filtered - input| over ${ ROUGHNESSES.length } roughnesses = ${ worst.toExponential( 2 ) }`
    );
}

console.log( '\n--- monotone and one-sided -------------------------------------------------\n' );

{
    const variances = [ 0, 0.001, 0.004, 0.016, 0.05, 0.2, 1 ];
    let monotone = true;
    let oneSided = true;

    for ( const roughness of ROUGHNESSES ) {

        let previous = -Infinity;

        for ( const variance of variances ) {

            const filtered = filteredRoughnessValue( roughness, variance );
            if ( filtered < previous - 1e-12 ) monotone = false;
            if ( filtered < roughness - 1e-12 ) oneSided = false;
            previous = filtered;

        }

    }

    report( 'more variance is never less roughness', monotone, `${ ROUGHNESSES.length } x ${ variances.length } grid` );
    report( 'the filter never sharpens', oneSided, `${ ROUGHNESSES.length } x ${ variances.length } grid` );
}

console.log( '\n--- variance is added in ALPHA, not in perceptual roughness ----------------\n' );

{
    // The two forms must be measurably different, or this file's central claim is untestable.
    // The gap is largest where alpha and perceptual roughness diverge most, i.e. on smooth
    // materials — which is also where specular aliasing actually happens.
    const rows = ROUGHNESSES.map( ( roughness ) => {

        const variance = 0.01;
        const correct = filteredRoughnessValue( roughness, variance );
        const naive = perceptualSpaceRoughness( roughness, variance );

        return { roughness, correct, naive, gap: naive - correct };

    } );

    console.log( `      ${ 'roughness'.padStart( 10 ) }${ 'alpha-space'.padStart( 13 ) }${ 'perceptual'.padStart( 12 ) }${ 'gap'.padStart( 10 ) }` );
    for ( const row of rows ) {

        console.log( `      ${ row.roughness.toFixed( 2 ).padStart( 10 ) }${ row.correct.toFixed( 4 ).padStart( 13 ) }` +
            `${ row.naive.toFixed( 4 ).padStart( 12 ) }${ row.gap.toFixed( 4 ).padStart( 10 ) }` );

    }

    const worstGap = Math.max( ...rows.map( ( row ) => Math.abs( row.gap ) ) );

    report(
        'the naive perceptual-space form is measurably WRONG, so this check can fail',
        worstGap > 0.05,
        `largest disagreement ${ worstGap.toFixed( 4 )} at variance 0.01 — a check the two forms both passed would not distinguish them`
    );

    // The skin material on this figure runs roughness 0.46 (the cheek figure recorded in
    // PROGRESS), so state the number for the material that is actually shipping.
    const skin = rows.find( ( row ) => row.roughness === 0.46 );
    report(
        'the shipping skin roughness moves by a reportable amount at variance 0.01',
        skin.correct > 0.46 && skin.correct < 0.60,
        `0.4600 -> ${ skin.correct.toFixed( 4 ) } (alpha space) vs ${ skin.naive.toFixed( 4 ) } (naive)`
    );
}

console.log( '\n--- the ceiling binds ------------------------------------------------------\n' );

{
    const huge = filteredRoughnessValue( 0.05, 100 );
    const atCeiling = filteredRoughnessValue( 0.05, DEFAULT_VARIANCE_CEILING / 2 );

    report(
        'unbounded variance cannot drive roughness to 1',
        Math.abs( huge - atCeiling ) < 1e-12 && huge < 0.70,
        `variance 100 gives ${ huge.toFixed( 4 ) }, identical to the ceiling case ${ atCeiling.toFixed( 4 ) }`
    );
}

console.log( '\n--- Toksvig ----------------------------------------------------------------\n' );

{
    const identityWorst = Math.max( ...ROUGHNESSES.map( ( r ) => Math.abs( toksvigRoughnessValue( r, 1 ) - r ) ) );

    report(
        '|N| = 1 is the identity — the power round trip is exact',
        identityWorst < 1e-9,
        `worst |toksvig(r, 1) - r| = ${ identityWorst.toExponential( 2 ) }`
    );

    const lengths = [ 1, 0.99, 0.97, 0.93, 0.85, 0.7 ];
    let monotone = true;

    console.log( `      ${ '|N|'.padStart( 8 ) }${ 'r=0.12'.padStart( 10 ) }${ 'r=0.26'.padStart( 10 ) }${ 'r=0.46'.padStart( 10 ) }` );

    for ( const length of lengths ) {

        const row = [ 0.12, 0.26, 0.46 ].map( ( r ) => toksvigRoughnessValue( r, length ) );
        console.log( `      ${ length.toFixed( 2 ).padStart( 8 ) }${ row.map( ( v ) => v.toFixed( 4 ).padStart( 10 ) ).join( '' ) }` );

    }

    for ( const roughness of ROUGHNESSES ) {

        // Walked from the SHORTEST averaged normal to the longest, so the sequence must be
        // non-increasing: |N| = 0.7 is the roughest and |N| = 1 is the identity.
        let previous = Infinity;

        for ( let i = lengths.length - 1; i >= 0; i -= 1 ) {

            const filtered = toksvigRoughnessValue( roughness, lengths[ i ] );
            if ( filtered > previous + 1e-9 ) monotone = false;
            previous = filtered;

        }

    }

    report( 'a shorter averaged normal is always rougher, never smoother', monotone, `${ ROUGHNESSES.length } x ${ lengths.length } grid` );
}

console.log( '\n--- the two estimators agree on direction ----------------------------------\n' );

{
    // Same physical situation stated two ways: normals spread inside the footprint. Neither
    // number should be read as the other's answer; only the sign is comparable.
    const screen = filteredRoughnessValue( 0.26, 0.01 );
    const mip = toksvigRoughnessValue( 0.26, 0.97 );

    report(
        'both forms roughen when the normals disagree',
        screen > 0.26 && mip > 0.26,
        `screen-space 0.2600 -> ${ screen.toFixed( 4 ) }, Toksvig |N|=0.97 -> ${ mip.toFixed( 4 ) }`
    );
}

console.log( `\n${ failures === 0 ? 'PASS' : 'FAIL' }: ${ checks - failures }/${ checks } checks green\n` );

process.exitCode = failures === 0 ? 0 : 1;
