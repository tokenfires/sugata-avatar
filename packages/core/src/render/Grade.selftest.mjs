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
 *   R0-R6           🎯 **The rendered gate, and the reason everything above it is not enough.**
 *                   Every check above this line runs on a CPU mirror or on a named constant, and
 *                   an independent verifier proved the set decorative by replacing the shipped
 *                   node's body with an expression that is arithmetically the constant 1 and
 *                   watching this file score 28/28 green. R0-R6 render the shipped node on a GPU,
 *                   read the pixels back, and assert what the grade DID to them: the grade is in
 *                   the chain at all, exact black stays exact black, the shadow percentiles are
 *                   not crushed, the midtone grain sigma is inside the spec band, the grain is
 *                   achromatic, its envelope vanishes in the shadows, and the darkest visible band
 *                   is not lifted. Eight rebuilt defects are rendered alongside and the gate
 *                   prints WHICH check each one trips — three of the eight are caught by exactly
 *                   one check, which is what makes those three load-bearing rather than ornamental.
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
    TEMPORAL_RECOVERY_SHARPNESS,
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

// The three checks that used to live here read `Grade.js`'s own TEXT with regular expressions and
// called that "tying the shipped node graph to the mirror". They are DELETED rather than repaired,
// because an independent verifier proved them decorative: the sabotage
// `level.mul( level.oneMinus() ).mul( 4 ).mul( 0 ).add( 1 )` keeps every token they look for and
// evaluates to the constant 1. A regex cannot evaluate arithmetic and should not be asked to.
//
// What ties the CPU mirror to the shipped GPU node now is a MEASUREMENT, and it is in the rendered
// section at the foot of this file: the rendered grain sigma is swept across the probe's sixteen
// display levels and its peak is compared against the peak the mirror predicts.

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
    'the temporal recovery sharpness is a real SharpenNode setting, and not the default',
    TEMPORAL_RECOVERY_SHARPNESS > 0 && TEMPORAL_RECOVERY_SHARPNESS < 2
        && new ( await import( './Grade.js' ) ).Grade().sharpness === null,
    `${ TEMPORAL_RECOVERY_SHARPNESS } on SharpenNode's 0..2 scale (0 max, 2 none), and a Grade built ` +
        'with no options sharpens nothing — a forward MSAA frame has no temporal low-pass to recover from. ' +
        'The sweep that chose 1.2 is in Grade.js: G4 1.5375 -> 1.6223 -> 1.9029 at RCAS none / 1.2 / 0.2, ' +
        'against silhouette hard% 11.4 -> 17.9 -> 47.0.'
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

// ==============================================================================================
// THE RENDERED GATE
// ==============================================================================================
//
// 🚩 Everything above this line was proved DECORATIVE by an independent verifier, and the way it
// was proved is worth more than the fix.
//
// The 13 behavioural checks run on `grainEnvelopeAt`, a CPU mirror. The three checks that tie the
// mirror to the shipped GPU node are a regex over `Grade.js`'s own text. So the verifier replaced
// the node body with
//
//     level.mul( level.oneMinus() ).mul( 4 ).mul( 0 ).add( 1 )
//
// — arithmetically the constant 1, i.e. the flat grain that crushed p0.1 from 0.00869 to 0.00057,
// with every token the regex looks for still present — and this file scored 28/28 GREEN, exit 0.
// It also passes with the envelope call REMOVED, because the mirror does not know.
//
// A CPU mirror plus a regex tests neither. What follows renders the shipped node on a GPU, reads
// the pixels back, and asserts what the grade DID to them. Every check below has a rebuilt defect
// that turns it red, reachable from a URL (`?graindefect=`), and the table of which defect trips
// which check is printed rather than described — because a gate whose rejections are not
// enumerated is a gate nobody has checked the coverage of.
//
// The target is `post.html?probe=grade`: sixteen vertical strips of constant linear radiance on a
// geometric ladder, no figure in frame. A picture of a person would make the black point a
// property of the person's silhouette, which is exactly how G6 came to be measuring the eyelashes.
//
// ⚠️ The rendered gate has a resolution floor and says so. A screenshot is 8-bit, so a crush
// confined below ~0.5/255 is invisible to it — the `sqrt` envelope's crush is, and the analytic
// vanishing-rate check above is what catches that one. The two layers are complementary and
// neither is sufficient. The rendered gate catches `sqrt` anyway, but by its SHAPE rather than by
// its crush, which is a different assertion.

console.log( '\n--- the RENDERED grade: pixels off a GPU, not a CPU mirror --------------------\n' );

{
    const probe = await import( './MotionProbe.mjs' );

    const WIDTH = 960;
    const HEIGHT = 400;
    const BANDS = 16;

    /** Bands 0-4 render at exact display zero with the shipped grade: nothing added to nothing. */
    const TRUE_BLACK_BANDS = [ 0, 1, 2, 3, 4 ];

    /** The darkest bands with a non-zero display value. Their p0.1 is what "no crush" means. */
    const SHADOW_BANDS = [ 6, 7, 8 ];

    /** The darkest band the grade can lift measurably. Bloom threshold 0 raises it 4.4x. */
    const LIFT_BAND = 5;

    /** Display ~0.476: the peak of a 4L(1-L) envelope, where the grain should be at full sigma. */
    const MIDTONE_BAND = 12;

    // Thresholds, each set from the measurements printed by this run rather than chosen.
    const LIFT_TOLERANCE = 0.05;              // shipped moves the band by 0.2%; threshold 0 by 344%
    const CRUSH_TOLERANCE_CODES = 1.0;        // shipped moves shadow p0.1 by exactly 0 code values
    const CHROMA_CEILING = 0.0005;            // shipped 0.000001, chromatic grain 0.010107
    const SHADOW_TO_MIDTONE_SIGMA_CEILING = 0.20;  // shipped 0.103, sqrt 0.265, flat 0.795

    function bandRect( index ) {

        const bandWidth = WIDTH / BANDS;

        return {
            x: Math.round( index * bandWidth ) + 8,
            y: 20,
            width: Math.round( bandWidth ) - 16,
            height: HEIGHT - 40
        };

    }

    const PLATES = {
        shipped: '?probe=grade&grade=1&aa=off&bare',
        ungraded: '?probe=grade&aa=off&bare',
        grainOff: '?probe=grade&grade=1&aa=off&bare&grain=0',
        flat: '?probe=grade&grade=1&aa=off&bare&graindefect=flat',
        floored: '?probe=grade&grade=1&aa=off&bare&graindefect=floored',
        sqrt: '?probe=grade&grade=1&aa=off&bare&graindefect=sqrt',
        inverted: '?probe=grade&grade=1&aa=off&bare&graindefect=inverted',
        chromatic: '?probe=grade&grade=1&aa=off&bare&graindefect=chromatic',
        naiveAmplitude: '?probe=grade&grade=1&aa=off&bare&graindefect=naive-amplitude',
        grainDefectOff: '?probe=grade&grade=1&aa=off&bare&graindefect=off',
        bloomThresholdZero: '?probe=grade&grade=1&aa=off&bare&thresh=0'
    };

    let server = null;
    let browser = null;
    const plates = {};

    try {

        server = await probe.startProbeServer( { port: 5186 } );
        browser = await probe.launchProbeBrowser();

        for ( const [ name, query ] of Object.entries( PLATES ) ) {

            const shot = await probe.capturePlates( {
                // Eight steps rather than one: the probe draws on `__SUGATA_STEP__`, and the
                // first frames of any WebGPU page are shader compilation. Eight is cheap and past it.
                browser, baseUrl: server.baseUrl, query, width: WIDTH, height: HEIGHT, frames: 8
            } );

            if ( shot.errors.length > 0 ) {

                throw new Error( `${ name }: ${ shot.errors.slice( 0, 2 ).join( ' | ' ) }` );

            }

            plates[ name ] = shot.frames.get( 8 );

        }

    } catch ( error ) {

        // A rendered gate that cannot render is a FAILED gate, not a skipped one. Skipping is how
        // a decorative gate survives: it goes quiet on the machine that would have caught it.
        report(
            'the rendered probe came up on a real GPU',
            false,
            `it did not: ${ error.message }`
        );

    }

    if ( plates.shipped !== undefined ) {

        /** The measurement every check below is stated against: bands of the shipped plate. */
        const stats = ( plate, band ) => probe.bandStatistics( plate, bandRect( band ) );

        const grainSigma = ( plate, band ) =>
            probe.differenceSigma( plate, plates.grainOff, bandRect( band ) ).sigma;

        // Printed first, so a reader who distrusts a verdict can check the arithmetic.
        console.log( '      band  shipped mean   grain-off mean   shipped p0.1   grain sigma /255   chroma' );

        for ( const band of [ 0, LIFT_BAND, ...SHADOW_BANDS, MIDTONE_BAND, 15 ] ) {

            const shipped = stats( plates.shipped, band );
            const clean = stats( plates.grainOff, band );

            console.log( `      ${ String( band ).padStart( 4 ) }  ${ shipped.mean.toFixed( 6 ).padStart( 12 ) }   ` +
                `${ clean.mean.toFixed( 6 ).padStart( 14 ) }   ${ shipped.percentile.toFixed( 6 ).padStart( 12 ) }   ` +
                `${ grainSigma( plates.shipped, band ).toFixed( 3 ).padStart( 16 ) }   ${ shipped.chromaMean.toFixed( 6 ) }` );

        }

        console.log( '' );

        // R0 — the grade is actually in the chain. LEARNINGS §1.24: a post effect that is being
        // thrown away measures as exactly nothing, and reads as "too subtle to detect".
        {
            const graded = stats( plates.shipped, MIDTONE_BAND ).mean;
            const plain = stats( plates.ungraded, MIDTONE_BAND ).mean;

            report(
                'R0 the graded plate differs from the ungraded one, so the grade is in the chain',
                Math.abs( graded - plain ) > 0.02,
                `midtone band ${ MIDTONE_BAND }: ungraded ${ plain.toFixed( 6 ) } -> graded ${ graded.toFixed( 6 ) }`
            );
        }

        // R1 — nothing added to nothing. The purest statement the black point has.
        {
            const worst = TRUE_BLACK_BANDS
                .map( ( band ) => stats( plates.shipped, band ) )
                .reduce( ( a, b ) => ( b.mean > a.mean ? b : a ) );

            report(
                'R1 a band of exact black renders exact black, every pixel of it',
                worst.mean === 0 && worst.zeroFraction === 1,
                `bands ${ TRUE_BLACK_BANDS.join( ',' ) }: worst mean ${ worst.mean.toFixed( 8 ) }, ` +
                    `${ ( worst.zeroFraction * 100 ).toFixed( 3 ) }% of pixels at zero`
            );
        }

        // R2 — the crush. A percentile, because the crush moves a TAIL.
        {
            let worstBand = null;
            let worstDelta = 0;

            for ( const band of SHADOW_BANDS ) {

                const delta = ( stats( plates.grainOff, band ).percentile - stats( plates.shipped, band ).percentile ) * 255;

                if ( delta > worstDelta ) { worstDelta = delta; worstBand = band; }

            }

            report(
                'R2 the grain does not crush the shadow bands',
                worstDelta <= CRUSH_TOLERANCE_CODES,
                `worst p0.1 loss ${ worstDelta.toFixed( 3 ) } code values (band ${ worstBand ?? SHADOW_BANDS[ 0 ] }), ` +
                    `ceiling ${ CRUSH_TOLERANCE_CODES }`
            );
        }

        // R3 — the grain is actually there, at the sigma the spec asks for. Measured as the
        // standard deviation of the DIFFERENCE against the grain-off plate, so it is the grain and
        // nothing else. 8-bit quantisation adds ~0.08 in quadrature at this level.
        {
            const sigma = grainSigma( plates.shipped, MIDTONE_BAND );

            report(
                'R3 the rendered midtone grain sigma is inside the spec band',
                sigma >= GRAIN_BAND_CODES[ 0 ] && sigma <= GRAIN_BAND_CODES[ 1 ],
                `${ sigma.toFixed( 3 ) }/255 at band ${ MIDTONE_BAND } (display ` +
                    `${ stats( plates.shipped, MIDTONE_BAND ).mean.toFixed( 3 ) }), band ` +
                    `${ GRAIN_BAND_CODES[ 0 ] }-${ GRAIN_BAND_CODES[ 1 ] }/255 — asked for ${ DEFAULT_GRAIN_SIGMA_CODES }`
            );
        }

        // R4 — achromatic. No black-point check can see coloured grain, which is why this is here.
        {
            const chroma = stats( plates.shipped, MIDTONE_BAND ).chromaMean;

            report(
                'R4 the rendered grain moves brightness and never hue',
                chroma <= CHROMA_CEILING,
                `mean chroma (max-min) ${ chroma.toFixed( 6 ) } at band ${ MIDTONE_BAND }, ceiling ${ CHROMA_CEILING }`
            );
        }

        // R5 — the SHAPE. The envelope has to vanish in the shadows, and this is the check that
        // sees a wrong shape whose crush is below the 8-bit floor.
        {
            const shadow = grainSigma( plates.shipped, LIFT_BAND );
            const midtone = grainSigma( plates.shipped, MIDTONE_BAND );
            const ratio = midtone === 0 ? Infinity : shadow / midtone;

            report(
                'R5 the rendered grain vanishes in the shadows relative to the midtones',
                ratio <= SHADOW_TO_MIDTONE_SIGMA_CEILING,
                `sigma band ${ LIFT_BAND } / band ${ MIDTONE_BAND } = ${ shadow.toFixed( 3 ) } / ` +
                    `${ midtone.toFixed( 3 ) } = ${ ratio.toFixed( 3 ) }, ceiling ${ SHADOW_TO_MIDTONE_SIGMA_CEILING }. ` +
                    'The shipped value is at the 8-bit quantisation floor and cannot go lower.'
            );
        }

        // R6 — no black LIFT, which is the constraint the spec states in bold and the one the
        // bloom threshold decides. Same band, measured against the grade with the grain off.
        {
            const lifted = stats( plates.shipped, LIFT_BAND ).mean;
            const reference = stats( plates.grainOff, LIFT_BAND ).mean;
            const change = Math.abs( lifted - reference ) / reference;

            report(
                'R6 the shipped grade does not lift the darkest visible band',
                change <= LIFT_TOLERANCE,
                `band ${ LIFT_BAND } mean ${ reference.toFixed( 6 ) } -> ${ lifted.toFixed( 6 ) }, ` +
                    `${ ( change * 100 ).toFixed( 2 ) }% (tolerance ${ LIFT_TOLERANCE * 100 }%)`
            );
        }

        // R7 — the CPU mirror above and the shipped GPU node are the same function.
        //
        // This is what replaced three regular expressions over `Grade.js`'s own text. The rendered
        // grain sigma is swept across all sixteen display levels; the mirror predicts where that
        // sweep peaks, because `4L(1-L)` is maximal at L = 0.5. Comparing the PEAK rather than the
        // values sidesteps the 8-bit quantisation floor, which dominates every band under about
        // 0.4/255 and would make a direct comparison a measurement of the screenshot format.
        {
            const sigmas = [];
            const levels = [];

            for ( let band = 0; band < BANDS; band += 1 ) {

                sigmas.push( grainSigma( plates.shipped, band ) );
                levels.push( stats( plates.grainOff, band ).mean );

            }

            const argmax = ( values ) => values.indexOf( Math.max( ...values ) );

            const measuredPeak = argmax( sigmas );
            const predictedPeak = argmax( levels.map( grainEnvelopeAt ) );

            // Unimodal: rises to the peak and falls after it, allowing the quantisation floor a
            // little slack on the flat dark end where every sigma is within 0.05 of zero.
            let unimodal = true;

            for ( let band = 1; band < BANDS; band += 1 ) {

                const rising = sigmas[ band ] >= sigmas[ band - 1 ] - 0.05;
                const falling = sigmas[ band ] <= sigmas[ band - 1 ] + 0.05;

                if ( band <= measuredPeak ? rising === false : falling === false ) unimodal = false;

            }

            report(
                'R7 the rendered grain sigma peaks where the CPU mirror says it does',
                measuredPeak === predictedPeak && unimodal,
                `sigma by band ${ sigmas.map( ( v ) => v.toFixed( 2 ) ).join( ' ' ) } — measured peak at ` +
                    `band ${ measuredPeak } (display ${ levels[ measuredPeak ].toFixed( 3 ) }), ` +
                    `grainEnvelopeAt predicts band ${ predictedPeak }, unimodal ${ unimodal }`
            );
        }

        // --- the rejections, which are what stop the six checks above from being decorative -----
        //
        // Each rebuilt defect must trip at least one check, and the table says WHICH — because
        // "it fails" is not coverage. LEARNINGS §1.1, and the harder version of it: three of last
        // round's new gates only caught their own known-bad, so four of the seven defects below
        // were invented rather than observed.

        console.log( '\n      rejection coverage — which rendered check each rebuilt defect trips\n' );

        const CHECKS = {
            R0: ( plate ) => Math.abs( stats( plate, MIDTONE_BAND ).mean - stats( plates.ungraded, MIDTONE_BAND ).mean ) > 0.02,
            R7: ( plate ) => {
                const sigmas = [];
                const levels = [];
                for ( let band = 0; band < BANDS; band += 1 ) {
                    sigmas.push( grainSigma( plate, band ) );
                    levels.push( stats( plates.grainOff, band ).mean );
                }
                const argmax = ( values ) => values.indexOf( Math.max( ...values ) );
                return argmax( sigmas ) === argmax( levels.map( grainEnvelopeAt ) );
            },
            R1: ( plate ) => TRUE_BLACK_BANDS.every( ( band ) => stats( plate, band ).mean === 0 ),
            R2: ( plate ) => SHADOW_BANDS.every( ( band ) =>
                ( stats( plates.grainOff, band ).percentile - stats( plate, band ).percentile ) * 255 <= CRUSH_TOLERANCE_CODES ),
            R3: ( plate ) => {
                const sigma = grainSigma( plate, MIDTONE_BAND );
                return sigma >= GRAIN_BAND_CODES[ 0 ] && sigma <= GRAIN_BAND_CODES[ 1 ];
            },
            R4: ( plate ) => stats( plate, MIDTONE_BAND ).chromaMean <= CHROMA_CEILING,
            R5: ( plate ) => {
                const midtone = grainSigma( plate, MIDTONE_BAND );
                return midtone > 0 && grainSigma( plate, LIFT_BAND ) / midtone <= SHADOW_TO_MIDTONE_SIGMA_CEILING;
            },
            R6: ( plate ) => Math.abs( stats( plate, LIFT_BAND ).mean - stats( plates.grainOff, LIFT_BAND ).mean )
                / stats( plates.grainOff, LIFT_BAND ).mean <= LIFT_TOLERANCE
        };

        const DEFECTS = {
            'flat (the shipped defect, and the `.mul(0).add(1)` sabotage)': 'flat',
            'floored at 0.25': 'floored',
            'sqrt — right endpoints, wrong slope': 'sqrt',
            'inverted': 'inverted',
            'chromatic (per-channel noise)': 'chromatic',
            'naive amplitude (missing the sqrt 12)': 'naiveAmplitude',
            'grain removed entirely': 'grainDefectOff',
            'bloom threshold 0 (the black lift)': 'bloomThresholdZero',
            // The LEARNINGS 1.24 failure: the grade compiled, ran, and was thrown away by a
            // caller that drew past the pipeline. It measures as EXACTLY nothing, which reads as
            // "the grade is too subtle to detect" — so R0 has to be provable red too.
            'the grade thrown away entirely (LEARNINGS 1.24)': 'ungraded'
        };

        for ( const [ label, key ] of Object.entries( DEFECTS ) ) {

            const tripped = Object.entries( CHECKS )
                .filter( ( [ , check ] ) => check( plates[ key ] ) === false )
                .map( ( [ name ] ) => name );

            report(
                `rejected by rendering: ${ label }`,
                tripped.length > 0,
                tripped.length > 0
                    ? `trips ${ tripped.join( ', ' ) }`
                    : 'passes every rendered check — this gate does NOT cover this defect'
            );

        }

        // And the honest limit, stated as a printed fact rather than as a comment: the shipped
        // plate must pass every check, or the coverage table above is measuring a broken baseline.
        {
            const shippedTrips = Object.entries( CHECKS )
                .filter( ( [ , check ] ) => check( plates.shipped ) === false )
                .map( ( [ name ] ) => name );

            report(
                'the shipped grade passes every rendered check, so the rejections above mean something',
                shippedTrips.length === 0,
                shippedTrips.length === 0 ? 'R0-R7 all green on the shipped plate' : `trips ${ shippedTrips.join( ', ' ) }`
            );
        }

    }

    await browser?.close();
    await server?.close();

}

console.log( `\n${ failures === 0 ? 'PASS' : 'FAIL' }: ${ checks - failures }/${ checks } checks green\n` );

process.exitCode = failures === 0 ? 0 : 1;
