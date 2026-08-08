/**
 * Gate for `render/Grade.js`.
 *
 * The grade is the easiest place in the renderer to be confidently wrong, because every mistake
 * it can make still produces a picture. So the checks here are the ones that would otherwise be
 * caught only by a critic six rounds later:
 *
 *   NO BLACK LIFT   `BLACK_LIFT` is 0, and there is no constructor option that can change it.
 *                   The look spec calls a lifted shadow "the commonest mistake when people try to
 *                   make a render look cinematic", and it is on the punch list's standing
 *                   constraints. A configurable zero is not a constraint.
 *
 *   NO ABERRATION   Same shape: chromatic aberration measured 0 in the reference, so there is no
 *                   way to ask for it. Asserted by inspecting the option surface, because the
 *                   failure mode is somebody adding one.
 *
 *   GRAIN SIGMA     The shader draws UNIFORM noise, whose standard deviation is 1/sqrt(12) of its
 *                   width, so the amplitude is sigma x sqrt(12). Getting that conversion wrong is
 *                   how a grade ends up with 3.5x the spec's grain and nobody can say by how
 *                   much. Checked by simulating the actual distribution, not by re-deriving the
 *                   same constant, and PROVED to reject the naive "amplitude = sigma" form.
 *
 *   GRAIN IN BAND   The default lands inside the spec's 1-2/255.
 *
 *   VIGNETTE        The centre is untouched to floating point and the corner keeps exactly
 *                   1 - amount, which is what makes `vignette` readable as "fraction of light
 *                   removed at the corner" rather than as an arbitrary dial.
 *
 *   BLOOM THRESHOLD The default is NOT zero, and the reason is recorded as a measurement rather
 *                   than a preference. This check exists to make a future "the spec says
 *                   threshold none" edit fail loudly and read the table in the source.
 *
 *   TONE CURVES     All three names resolve to distinct three.js constants, and an unknown name
 *                   throws instead of silently falling back to Linear.
 *
 * A measurement outside its range is a FAIL and exits non-zero. It is not grounds for widening
 * the range.
 *
 * Usage:  node "packages/core/src/render/Grade.selftest.mjs"
 */

import {
    BLACK_LIFT,
    DEFAULT_BLOOM,
    DEFAULT_GRAIN_SIGMA_CODES,
    DEFAULT_SATURATION,
    DEFAULT_VIGNETTE,
    grainAmplitudeFor,
    vignetteMultiplier
} from './Grade.js';

let checks = 0;
let failures = 0;

function report( name, passed, detail ) {

    checks += 1;
    if ( passed !== true ) failures += 1;
    console.log( `${ passed ? 'PASS' : 'FAIL' }  ${ name }\n      ${ detail }` );

}

// The spec's own bands, quoted. These are measurements of the reference, not preferences.
const GRAIN_BAND_CODES = [ 1, 2 ];
const SATURATION_BAND = [ 1.00, 1.05 ];
const VIGNETTE_BAND = [ 0.10, 0.20 ];
const BLOOM_STRENGTH_BAND = [ 0.25, 0.40 ];

console.log( '\n--- the two things that must be impossible, not merely defaulted ------------\n' );

report(
    'the grade adds no black lift, and the constant says so',
    BLACK_LIFT === 0,
    `BLACK_LIFT = ${ BLACK_LIFT }`
);

{
    // Reading the module's own text is the honest way to assert "there is no option for this":
    // a runtime check cannot see an option that does not exist.
    const source = await ( await import( 'node:fs/promises' ) ).readFile(
        new URL( './Grade.js', import.meta.url ), 'utf8'
    );

    const mentionsAberration = /aberration/i.test( source );
    const readsAberrationOption = /options\.\w*[Aa]berration|options\.\w*fringe/i.test( source );
    const readsBlackLiftOption = /options\.\w*(lift|blackPoint)/i.test( source );

    report(
        'chromatic aberration is named as absent and never read from options',
        mentionsAberration && readsAberrationOption === false,
        `the source names it (so a reader knows it was considered) and reads no option for it`
    );

    report(
        'there is no constructor option that can lift the blacks',
        readsBlackLiftOption === false,
        'no options.blackLift / options.blackPoint anywhere in the file'
    );
}

console.log( '\n--- grain: the sigma conversion -------------------------------------------\n' );

{
    // Simulate the distribution the shader actually draws — uniform on [-0.5, 0.5] times the
    // amplitude — and measure its standard deviation. This is a measurement of the code's own
    // arithmetic rather than a restatement of it.
    const sigmaCodes = DEFAULT_GRAIN_SIGMA_CODES;
    const amplitude = grainAmplitudeFor( sigmaCodes );

    const samples = 400_000;
    let sum = 0;
    let sumSquares = 0;

    // A fixed LCG, so the check is the same every run. A selftest whose verdict depends on
    // Math.random has a failure rate rather than a result.
    let state = 20260808;
    const next = () => {

        state = ( state * 1103515245 + 12345 ) % 2147483648;
        return state / 2147483648;

    };

    for ( let i = 0; i < samples; i += 1 ) {

        const noise = ( next() - 0.5 ) * amplitude * 255;   // in 8-bit code values
        sum += noise;
        sumSquares += noise * noise;

    }

    const mean = sum / samples;
    const measured = Math.sqrt( sumSquares / samples - mean * mean );

    report(
        'the grain amplitude produces the sigma it claims',
        Math.abs( measured - sigmaCodes ) < 0.02,
        `asked for sigma ${ sigmaCodes }/255, measured ${ measured.toFixed( 4 ) }/255 over ${ samples.toLocaleString() } samples ` +
            `(mean ${ mean.toFixed( 4 ) })`
    );

    // The naive form — amplitude = sigma — is what this conversion exists to avoid. It must be
    // measurably wrong, or the check above would pass for the wrong code too.
    const naiveSigma = measured * ( 1 / Math.sqrt( 12 ) );

    report(
        'the naive "amplitude = sigma" form is measurably wrong, so this check can fail',
        Math.abs( naiveSigma - sigmaCodes ) > 0.5,
        `it would deliver sigma ${ naiveSigma.toFixed( 4 ) }/255 instead of ${ sigmaCodes }/255 — a factor of ${ Math.sqrt( 12 ).toFixed( 3 ) }`
    );

    report(
        'the default grain sits inside the spec band',
        sigmaCodes >= GRAIN_BAND_CODES[ 0 ] && sigmaCodes <= GRAIN_BAND_CODES[ 1 ],
        `${ sigmaCodes }/255 in ${ GRAIN_BAND_CODES[ 0 ] }-${ GRAIN_BAND_CODES[ 1 ] }/255`
    );
}

console.log( '\n--- vignette ---------------------------------------------------------------\n' );

{
    const amount = 0.15;

    const centre = vignetteMultiplier( amount, 0, 0 );
    const corner = vignetteMultiplier( amount, 1, 1 );
    const edgeX = vignetteMultiplier( amount, 1, 0 );

    console.log( `      centre ${ centre.toFixed( 6 ) }   mid-edge ${ edgeX.toFixed( 6 ) }   corner ${ corner.toFixed( 6 ) }` );

    report(
        'the centre of frame is untouched',
        Math.abs( centre - 1 ) < 1e-12,
        `multiplier ${ centre }`
    );

    report(
        '`vignette` reads as the fraction of light removed AT THE CORNER',
        Math.abs( corner - ( 1 - amount ) ) < 1e-12,
        `amount ${ amount } gives a corner multiplier of ${ corner.toFixed( 6 ) }`
    );

    report(
        'the falloff is quadratic, so the middle of the frame is nearly untouched',
        Math.abs( edgeX - ( 1 - amount / 2 ) ) < 1e-12 && vignetteMultiplier( amount, 0.33, 0 ) > 0.99,
        `mid-edge keeps ${ edgeX.toFixed( 4 ) }, a third of the way out keeps ` +
            `${ vignetteMultiplier( amount, 0.33, 0 ).toFixed( 4 ) }`
    );

    report(
        'the default sits inside the spec band',
        DEFAULT_VIGNETTE >= VIGNETTE_BAND[ 0 ] && DEFAULT_VIGNETTE <= VIGNETTE_BAND[ 1 ],
        `${ DEFAULT_VIGNETTE } in ${ VIGNETTE_BAND[ 0 ] }-${ VIGNETTE_BAND[ 1 ] }`
    );
}

console.log( '\n--- bloom and saturation ---------------------------------------------------\n' );

report(
    'bloom intensity is the spec\'s, unchanged',
    DEFAULT_BLOOM.strength >= BLOOM_STRENGTH_BAND[ 0 ] && DEFAULT_BLOOM.strength <= BLOOM_STRENGTH_BAND[ 1 ],
    `strength ${ DEFAULT_BLOOM.strength } in ${ BLOOM_STRENGTH_BAND[ 0 ] }-${ BLOOM_STRENGTH_BAND[ 1 ] }`
);

report(
    'the bloom threshold is NOT zero, and the source carries the measurement that says why',
    DEFAULT_BLOOM.threshold > 0,
    `threshold ${ DEFAULT_BLOOM.threshold } — at 0 with this strength the whole-image p0.1 luma ` +
        'measured 0.08630 against 0.02496 ungraded, i.e. a 3.5x black lift. See the table in Grade.js.'
);

report(
    'global saturation is inside the spec band',
    DEFAULT_SATURATION >= SATURATION_BAND[ 0 ] && DEFAULT_SATURATION <= SATURATION_BAND[ 1 ],
    `${ DEFAULT_SATURATION } in ${ SATURATION_BAND[ 0 ] }-${ SATURATION_BAND[ 1 ] }`
);

console.log( '\n--- tone curves ------------------------------------------------------------\n' );

{
    // Imported lazily so this file can be read without three.js resolving, and because the only
    // thing under test is the name -> constant mapping.
    const { Grade } = await import( './Grade.js' );

    const curves = [ 'aces', 'agx', 'neutral' ].map( ( name ) => new Grade( { toneCurve: name } ).toneCurve );
    const distinct = new Set( curves ).size === curves.length;

    let threw = false;
    try { new Grade( { toneCurve: 'filmic' } ); } catch { threw = true; }

    report(
        'the three tone curves resolve to distinct constants',
        distinct,
        `aces/agx/neutral -> ${ curves.join( ' / ' ) }`
    );

    report(
        'an unknown tone curve throws instead of silently rendering Linear',
        threw,
        "new Grade({ toneCurve: 'filmic' }) throws"
    );
}

console.log( `\n${ failures === 0 ? 'PASS' : 'FAIL' }: ${ checks - failures }/${ checks } checks green\n` );

process.exitCode = failures === 0 ? 0 : 1;
