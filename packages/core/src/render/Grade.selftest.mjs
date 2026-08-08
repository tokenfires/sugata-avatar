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
 *   NO CRUSH        The one this file was blind to for a whole round, and the reason the rest of
 *                   it is not enough. Every check above asks "is this named constant inside a
 *                   band" — a grade read as a bag of numbers. But the grade is a transfer
 *                   function, and it broke the black point through a mechanism no constant
 *                   describes: symmetric zero-mean grain added to a near-zero signal is not a
 *                   lift, it is a CRUSH, and `BLACK_LIFT === 0` cannot see it. Grade.js's own
 *                   table measured p0.1 0.00869 -> 0.00057 with flat grain, 7x below G6's floor,
 *                   while this file reported 15/15. So the checks here measure what the grain
 *                   DOES to a population of dark pixels, and assert the invariant that makes it
 *                   safe at every luma rather than at the one that was measured: the grain's
 *                   half-width is strictly below the signal it is added to, everywhere. Proved
 *                   to reject flat grain, a shadow-floored envelope, and a sqrt envelope that has
 *                   the right endpoints and the wrong slope at zero.
 *
 *   ENVELOPE WIRED  The behavioural checks run on a CPU mirror, so they stay green if the shader
 *                   simply stops calling the envelope — which is exactly how the defect got in.
 *                   The last group ties the shipped node graph to the mirror. It is a structural
 *                   read of the module text, and it is honest about being one: there is no CPU
 *                   evaluator for a TSL graph, and the authoritative check on the real shader is
 *                   the rendered measurement in Grade.js's table.
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
    grainEnvelopeAt,
    grainHalfWidthAt,
    vignetteMultiplier
} from './Grade.js';

let checks = 0;
let failures = 0;

function report( name, passed, detail ) {

    checks += 1;
    if ( passed !== true ) failures += 1;
    console.log( `${ passed ? 'PASS' : 'FAIL' }  ${ name }\n      ${ detail }` );

}

/**
 * A fixed LCG on [0,1). Every draw in this file comes from one of these, so the verdict is the
 * same on every run: a selftest whose result depends on `Math.random` has a failure RATE rather
 * than a result.
 */
function uniformNoiseSource( seed ) {

    let state = seed;

    return () => {

        state = ( state * 1103515245 + 12345 ) % 2147483648;
        return state / 2147483648;

    };

}

// The spec's own bands, quoted. These are measurements of the reference, not preferences.
const GRAIN_BAND_CODES = [ 1, 2 ];
const SATURATION_BAND = [ 1.00, 1.05 ];
const VIGNETTE_BAND = [ 0.10, 0.20 ];
const BLOOM_STRENGTH_BAND = [ 0.25, 0.40 ];

/** Spec §3 and §5: "black point NO LIFT. p0.1 luma must land 0.004-0.016." Gate G6 measures it. */
const BLACK_POINT_BAND = [ 0.004, 0.016 ];

/**
 * The frame's black point with the grain switched off, quoted from the measured table in
 * Grade.js: `post.html?aa=msaa&bare&specaa=1&grade=1&backdrop=0x0a0d13` at 900x1200, whole-image
 * p0.1 luma. The grain checks below start every simulated pixel here, so what they measure is the
 * grain's own contribution to the black point and nothing else.
 */
const UNGRAINED_BLACK_POINT = 0.00869;

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

    const next = uniformNoiseSource( 20260808 );

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

console.log( '\n--- grain: the envelope, and the black point it exists to protect -----------\n' );

/**
 * The envelope shapes this file has to be able to tell apart. Each one is a plausible thing to
 * write, each one produces a picture, and each one destroys the black point in a different way —
 * which is the point: a gate that only rejects its own known-bad is decorative. LEARNINGS §1.1.
 */
const WRONG_ENVELOPES = {
    'flat (no envelope at all — the defect that shipped)': () => 1,
    'floored at 0.25 ("keep a little grain in the shadows")': ( l ) => 0.25 + 0.75 * grainEnvelopeAt( l ),
    'sqrt — right endpoints, wrong slope at zero': ( l ) => Math.sqrt( grainEnvelopeAt( l ) ),
    'inverted — most grain where there is least light': ( l ) => 1 - Math.min( 1, Math.max( 0, l ) )
};

/**
 * The 0.1st percentile of a patch of `samples` pixels all sitting at `signalLuma`, after this
 * grain is added to each. Mirrors the shader: uniform noise on [-0.5,0.5], scaled by the
 * amplitude and by the envelope evaluated at the pixel's own luma, then clamped — the clamp is in
 * `compose`, and it is where a crushed pixel loses the information that it was ever above zero.
 */
function blackPointUnderGrain( envelope, sigmaCodes, signalLuma, samples = 200_000 ) {

    const amplitude = grainAmplitudeFor( sigmaCodes );
    const next = uniformNoiseSource( 19730401 );
    const pixels = new Float64Array( samples );

    for ( let i = 0; i < samples; i += 1 ) {

        const noise = ( next() - 0.5 ) * amplitude * envelope( signalLuma );
        pixels[ i ] = Math.min( 1, Math.max( 0, signalLuma + noise ) );

    }

    pixels.sort();

    return pixels[ Math.floor( samples * 0.001 ) ];

}

/**
 * Sweeps the invariant `half-width < luma` and returns the worst case: the largest fraction of a
 * pixel's own value that the grain can move it, and the darkest luma at which the grain wins
 * outright. Swept over the whole spec sigma band, because an invariant that only holds at the
 * default is a tuned constant wearing an invariant's clothes.
 */
function worstCrushOverSweep( halfWidthAt, sigmaBand = GRAIN_BAND_CODES, steps = 2048 ) {

    let worstRatio = 0;
    let worstLuma = 0;
    let crushLuma = 0;

    for ( const sigmaCodes of [ sigmaBand[ 0 ], ( sigmaBand[ 0 ] + sigmaBand[ 1 ] ) / 2, sigmaBand[ 1 ] ] ) {

        for ( let step = 1; step <= steps; step += 1 ) {

            const luma = step / steps;
            const ratio = halfWidthAt( sigmaCodes, luma ) / luma;

            if ( ratio > worstRatio ) {

                worstRatio = ratio;
                worstLuma = luma;

            }

            if ( ratio >= 1 && luma > crushLuma ) crushLuma = luma;

        }

    }

    return { worstRatio, worstLuma, crushLuma };

}

/**
 * `grainHalfWidthAt` with a different envelope substituted in, so a wrong shape is swept through
 * exactly the arithmetic the shipped one is.
 */
function halfWidthUsing( envelope ) {

    return ( sigmaCodes, luma ) => 0.5 * grainAmplitudeFor( sigmaCodes ) * envelope( luma );

}

/**
 * How fast the envelope vanishes as the frame goes black, measured as E(L)/L at ever-smaller L.
 *
 * This is the property the crush sweep is a consequence of, and it is worth measuring separately
 * because the sweep's verdict depends on how fine its grid is: `sqrt(4L(1-L))` only loses the
 * sweep below 0.12/255, so a coarser grid would let it through. E(L)/L does not care about the
 * grid. It converges to 4 for an envelope that vanishes linearly, and diverges as 1/L or
 * 1/sqrt(L) for one that does not — which is every wrong shape below.
 */
function vanishingRateNearBlack( envelope ) {

    const ratios = [];

    for ( let decade = 2; decade <= 7; decade += 1 ) {

        const luma = 10 ** -decade;
        ratios.push( envelope( luma ) / luma );

    }

    const first = ratios[ 0 ];
    const last = ratios[ ratios.length - 1 ];

    return { first, last, growth: last / first, bounded: last <= first * 1.05 };

}

{
    const peak = grainEnvelopeAt( 0.5 );

    report(
        'the envelope vanishes at both ends and peaks at 1 in the midtones',
        grainEnvelopeAt( 0 ) === 0 && grainEnvelopeAt( 1 ) === 0 && Math.abs( peak - 1 ) < 1e-12,
        `E(0) = ${ grainEnvelopeAt( 0 ) }, E(0.5) = ${ peak }, E(1) = ${ grainEnvelopeAt( 1 ) } — ` +
            'unexposed film has no grains to fluctuate and a fully exposed frame has no unexposed grains left'
    );

    // Without the shader's saturate(), a display luma above 1 — which a bright tone-mapped
    // highlight can reach before the clamp in `compose` — asks for a NEGATIVE, and growing,
    // envelope: 4L(1-L) at L = 2 is -8, i.e. eight times the grain, in the highlights.
    let clamped = true;
    let worstOutside = '';

    for ( let luma = -1; luma <= 3.0001; luma += 0.01 ) {

        const value = grainEnvelopeAt( luma );

        if ( value < 0 || value > 1 ) {

            clamped = false;
            worstOutside = `E(${ luma.toFixed( 2 ) }) = ${ value.toFixed( 4 ) }`;

        }

    }

    report(
        'luma outside 0..1 is clamped, so the envelope is never negative and never above 1',
        clamped && grainEnvelopeAt( -0.5 ) === 0 && grainEnvelopeAt( 2 ) === 0,
        clamped
            ? 'swept L = -1..3: E stays in 0..1, and E(-0.5) = E(2) = 0 — the unclamped 4L(1-L) is -8 at L = 2'
            : `unclamped: ${ worstOutside }`
    );
}

{
    // The invariant, stated once: the grain's largest excursion is strictly below the value of
    // the pixel it is added to, at every luma and across the spec's whole sigma band. That is
    // what "cannot crush the blacks" means, and unlike a percentile at one measured backdrop it
    // does not depend on which frame we happened to render.
    const shipped = worstCrushOverSweep( grainHalfWidthAt );

    report(
        'the grain can never drive a pixel to black, at any luma or sigma in the spec band',
        shipped.crushLuma === 0 && shipped.worstRatio < 1,
        `worst excursion is ${ ( shipped.worstRatio * 100 ).toFixed( 2 ) }% of the pixel's own value ` +
            `(at L = ${ shipped.worstLuma.toFixed( 4 ) }, sigma ${ GRAIN_BAND_CODES[ 1 ] }/255); ` +
            'no luma in 0..1 is crushed'
    );

    const rate = vanishingRateNearBlack( grainEnvelopeAt );

    report(
        'the envelope vanishes at least LINEARLY as the frame goes black',
        rate.bounded,
        `E(L)/L holds at ${ rate.first.toFixed( 3 ) } -> ${ rate.last.toFixed( 3 ) } from L = 1e-2 down to 1e-7, ` +
            'so the grain shrinks faster than the signal it is added to — the reason the sweep above passes'
    );

    // Prove both measurements discriminate. Each wrong shape has to lose at least one of them,
    // and the detail says which and by how much — a check that every candidate passes is a check
    // that measures nothing. LEARNINGS §1.1.
    for ( const [ name, envelope ] of Object.entries( WRONG_ENVELOPES ) ) {

        const wrong = worstCrushOverSweep( halfWidthUsing( envelope ) );
        const wrongRate = vanishingRateNearBlack( envelope );

        const crushed = wrong.crushLuma > 0 ? `crushes below ${ ( wrong.crushLuma * 255 ).toFixed( 2 ) }/255` : 'survives the sweep';
        const diverged = wrongRate.bounded ? 'vanishes linearly' : `E(L)/L diverges ${ wrongRate.growth.toFixed( 0 ) }x over five decades`;

        report(
            `rejected: the ${ name } envelope`,
            wrong.crushLuma > 0 || wrongRate.bounded === false,
            `${ crushed }; ${ diverged }`
        );

    }
}

{
    // And the same thing measured the way G6 measures it: a percentile over a population of
    // pixels, started at the black point Grade.js measured with the grain off.
    const enveloped = blackPointUnderGrain( grainEnvelopeAt, DEFAULT_GRAIN_SIGMA_CODES, UNGRAINED_BLACK_POINT );
    const flat = blackPointUnderGrain( () => 1, DEFAULT_GRAIN_SIGMA_CODES, UNGRAINED_BLACK_POINT );

    console.log( `      p0.1 over 200,000 pixels starting at ${ UNGRAINED_BLACK_POINT }: ` +
        `enveloped ${ enveloped.toFixed( 5 ) }, flat ${ flat.toFixed( 5 ) }\n` );

    report(
        'the enveloped grain leaves the black point inside the spec band',
        enveloped >= BLACK_POINT_BAND[ 0 ] && enveloped <= BLACK_POINT_BAND[ 1 ],
        `p0.1 ${ enveloped.toFixed( 5 ) } in ${ BLACK_POINT_BAND[ 0 ] }-${ BLACK_POINT_BAND[ 1 ] } — ` +
            `the grain took ${ ( ( UNGRAINED_BLACK_POINT - enveloped ) * 255 ).toFixed( 2 ) }/255 off it`
    );

    report(
        'flat grain measurably destroys it, so the check above can fail',
        flat < BLACK_POINT_BAND[ 0 ],
        `p0.1 collapses to ${ flat.toFixed( 5 ) }, below the ${ BLACK_POINT_BAND[ 0 ] } floor — ` +
            'the same failure Grade.js measured on a real frame as 0.00869 -> 0.00057'
    );
}

console.log( '\n--- grain: the shipped node graph is wired to the mirror above --------------\n' );

{
    // Structural, and labelled as such: the checks above run on `grainEnvelopeAt`, so they all
    // stay green if `grainNode` simply stops calling the envelope — which is precisely the defect
    // that shipped. There is no CPU evaluator for a TSL graph, so this reads the module text. The
    // authoritative check on the real shader is the rendered p0.1 table in Grade.js.
    const source = await ( await import( 'node:fs/promises' ) ).readFile(
        new URL( './Grade.js', import.meta.url ), 'utf8'
    );

    /** The body of a top-level `Fn(...)` or `function`, from its `export` to the first line that closes it. */
    const bodyOf = ( declaration ) => {

        const start = source.indexOf( declaration );
        if ( start < 0 ) return '';
        const end = source.indexOf( '\n}', start );
        return source.slice( start, end < 0 ? undefined : end );

    };

    const grainBody = bodyOf( 'export const grainNode' );
    const envelopeBody = bodyOf( 'export const grainEnvelope =' );

    report(
        'the shipped grain node multiplies by the envelope',
        /\.mul\(\s*grainEnvelope\(/.test( grainBody ),
        grainBody === '' ? 'grainNode not found in Grade.js' : 'grainNode ends in .mul( grainEnvelope( displayLuma ) )'
    );

    report(
        'the envelope node carries the same clamped 4L(1-L) the CPU mirror implements',
        /saturate\(\)/.test( envelopeBody ) && /oneMinus\(\)[\s\S]{0,24}mul\(\s*4\s*\)/.test( envelopeBody ),
        envelopeBody === ''
            ? 'grainEnvelope not found in Grade.js'
            : 'saturate() then level * (1 - level) * 4, matching grainEnvelopeAt'
    );

    report(
        'the grain is driven by luminance and added achromatically to all three channels',
        /grainNode\([\s\S]{0,160}luminance\(/.test( source ) && /add\(\s*vec3\(\s*grainNode\(/.test( source ),
        'compose() adds vec3( grainNode( ..., luminance( sharpened.xyz ) ) ) — one scalar, broadcast, ' +
            'so the noise moves brightness and never hue'
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
