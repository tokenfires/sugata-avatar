// tools/critic/hair-af.selftest.mjs — the ā_f quadrature held to answers known on paper.
//
// This project's rule is that an instrument is validated against arithmetic whose answer is written
// down BEFORE the run, and on the SAME code path the real numbers come out of. Every clause below
// is imported from hair-af.mjs rather than re-implemented here, so a gate cannot pass against a
// second, friendlier copy of the quadrature.
//
// The clauses, and what each one would catch:
//
//   V1  Eq.6 on f_s ≡ 1 returns |Ω_f| = 2π ......... the ω measure and the θ_o limits
//   V2  ∫ M_p dx = 1 .............................. the 1/(β√2π) normalisation in the mirror
//   V3  f_s = 1/4π gives ā_f = cos θ_d / 2 ........ the 1/π, the cos θ_d, and BOTH readings of Ω_f,
//                                                   end to end, against a closed form
//   V4  a fibre that scatters nothing returns 0 ... sign and clamping errors, with V4c as the
//                                                   control proving V4b is not vacuous
//   V5  ā_f + ā_b = the whole-sphere integral ..... a front/back convention swap, which is the one
//                                                   error that would invert the round's answer
//   V6  f_s is reciprocal ......................... that Eq.6's outer sweep may run over either slot
//   V7  ā_f < 1 ................................... Zinke Eq.11/13 are closed forms of Σ ā_f^{2i}
//                                                   and diverge at 1; a table that broke this would
//                                                   be unusable downstream
//   V8  halving the step moves the answer < 1e-3 .. the convergence check, as a gate
//
//   node tools/critic/hair-af.selftest.mjs

import {
    ARMS,
    BASE_COLOUR,
    WEIGHTS,
    averageAttenuation,
    clausePassed,
    materialDigest,
    shippedScattering,
    validations
} from './hair-af.mjs';

const GRID = { thetaSteps: 180, deltaSteps: 360 };
const HALVED = { thetaSteps: 360, deltaSteps: 720 };

let checks = 0;
let failures = 0;

function report( name, passed, detail ) {

    checks += 1;
    if ( passed !== true ) failures += 1;
    console.log( `${ passed ? 'PASS' : 'FAIL' }  ${ name }\n      ${ detail }` );

}

const digest = materialDigest();

console.log( `\nhair-af.selftest.mjs` );
console.log( `  material sha256 ${ digest.sha256 }` );
console.log( `  colour   linear ${ BASE_COLOUR.map( ( c ) => c.toExponential( 6 ) ).join( ', ' ) }` );
console.log( `  grid     ${ GRID.thetaSteps } × ${ GRID.deltaSteps } midpoint in (u = sinθ_o, Δ)\n` );

console.log( '--- V1-V6: the known answers, expected value first ------------------------------\n' );

for ( const clause of validations( GRID ) ) {

    const expected = Number.isNaN( clause.expected ) ? '(predicate)' : clause.expected.toPrecision( 12 );

    report(
        clause.name,
        clausePassed( clause ),
        `expected ${ expected }\n      actual   ${ clause.actual.toPrecision( 12 ) }` +
            `\n      tol      ${ Number.isNaN( clause.tolerance ) ? '(predicate)' : clause.tolerance.toExponential( 3 ) }` +
            `\n      ${ clause.detail }`
    );

}

console.log( '\n--- V7: ā_f < 1, which Zinke Eq.11/13 require of any BCSDF ----------------------\n' );

{
    let worst = 0;
    let worstAt = '';

    for ( const [ armName, settings ] of ARMS ) {

        for ( const reading of [ 'A', 'B' ] ) {

            for ( let degrees = 0; degrees <= 85; degrees += 5 ) {

                const af = averageAttenuation( shippedScattering( settings ),
                    degrees * Math.PI / 180, WEIGHTS[ `${ reading }-front` ], GRID );

                for ( const channel of af ) {

                    if ( channel > worst ) {

                        worst = channel;
                        worstAt = `${ armName }/${ reading }/θ_d=${ degrees }°`;

                    }

                }

            }

        }

    }

    report(
        'V7  the largest ā_f anywhere in the table is below 1',
        worst < 1,
        `expected < 1\n      actual   ${ worst.toPrecision( 12 ) } at ${ worstAt }\n` +
            `      Eq.11 Ā_1 = ā_b ā_f²/(1−ā_f²) and Eq.13 Ā_3 = ā_b³ā_f²/(1−ā_f²)³ are closed forms of\n` +
            `      Σ_{i≥1} ā_f^{2i} and diverge at ā_f = 1, so this is a usability bar on the table itself.`
    );
}

console.log( '\n--- V8: convergence. Halve the step; the answer must not move --------------------\n' );

{
    const bar = 1e-3;
    let worst = 0;
    let worstAt = '';

    for ( const [ armName, settings ] of ARMS ) {

        for ( const reading of [ 'A', 'B' ] ) {

            for ( const degrees of [ 0, 30, 60, 80 ] ) {

                const thetaD = degrees * Math.PI / 180;
                const w = WEIGHTS[ `${ reading }-front` ];
                const coarse = averageAttenuation( shippedScattering( settings ), thetaD, w, GRID )[ 0 ];
                const fine = averageAttenuation( shippedScattering( settings ), thetaD, w, HALVED )[ 0 ];
                const relative = Math.abs( fine - coarse ) / fine;

                if ( relative > worst ) {

                    worst = relative;
                    worstAt = `${ armName }/${ reading }/θ_d=${ degrees }°`;

                }

            }

        }

    }

    report(
        `V8  halving the step moves ā_f by less than ${ bar.toExponential( 0 ) } relative`,
        worst < bar,
        `expected < ${ bar.toExponential( 3 ) }\n      actual   ${ worst.toExponential( 3 ) } at ${ worstAt }\n` +
            `      ⚠️ The bar is 1e-3 and NOT tighter on purpose. W_B is a step function in Δ, so midpoint is\n` +
            `      O(h) across it — those rows halve their error per halving instead of quartering, and a\n` +
            `      1e-5 bar would be asserting a convergence order this integrand does not have.\n` +
            `      Read the tables to 3 significant digits, which is what this measures.`
    );
}

console.log( `\n${ checks - failures } of ${ checks } clauses passed.\n` );

process.exit( failures === 0 ? 0 : 1 );
