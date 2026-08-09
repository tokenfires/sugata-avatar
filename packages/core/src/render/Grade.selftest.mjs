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
 *   T1-T4           🎯 **The rendered gate's other axis, and the reason R0-R7 were not enough
 *                   either.** Every one of R0-R7 is a SINGLE-FRAME statistic — mean, percentile,
 *                   sigma, chroma, envelope shape — and all of them are identical whether the noise
 *                   field changes between frames or not. So an independent verifier replaced the
 *                   seed driver with `onFrameUpdate( () => 0 )`, which is the exact defect
 *                   `Grade.js`'s own comment names in as many words, and this file scored 44/44
 *                   green. T1-T4 render a SEQUENCE and two independent runs, and assert the four
 *                   things a grain has to do over time: it changes, it does not repeat, it does not
 *                   merely slide, and it depends on nothing but the frame index. Five rebuilt
 *                   temporal defects are rendered alongside, and the gate asserts that every one of
 *                   them passes all of R0-R7 — which is the finding, printed rather than described.
 *
 *   L1-L5           🎯 **And the reason T1-T4 were not enough. `SEQUENCE_FRAMES` tops out at frame
 *                   20.** A grain that advances correctly and then FREEZES FROM FRAME 16 scores
 *                   full marks on all four, because every frame they look at is inside the
 *                   healthy stretch. Reproduced by rewriting the served `Grade.js` — see
 *                   `SourcePatchProbe.mjs` — with a `late-freeze` driver: on the midtone band, the
 *                   worst consecutive-pair ratio over 74 pairs is **0.000 at frames 32-33** while
 *                   the same defect scores T1 **1.397** and T2 **0.0441** on the seven frames
 *                   T1-T4 look at. L1-L3 render **600 frames**, sample 96 of them, and
 *                   check every one of the 74 consecutive pairs and all 4,560 pairwise
 *                   correlations; L0 COMPUTES what that sampling can and cannot see rather than
 *                   claiming it, and L4 states the horizon against the clip lengths
 *                   `capture.mjs` actually renders. A second late defect — a 37-frame repeat
 *                   arriving at frame 16 — is caught by L2 (worst |r| **1.0000** at frames 32-513)
 *                   and **not** by L1 (worst ratio **1.369**, inside the band), which is what
 *                   makes the two separate checks rather than one restated.
 *                   L5 is the finding that came out of building them: the shipped seed is
 *                   `frameId % 4096`, so the grain **repeats exactly every 4096 frames**, proven
 *                   by rendering frames 100 and 4196 and measuring a difference sigma of
 *                   0.000000 against an adjacent control of 2.146. Outside a 600-frame clip;
 *                   three times over inside a 12,600-frame postural one.
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
 *
 * ⚠️ It renders four 600-frame clips and one 4,197-frame clip and takes several minutes. That is
 * the cost of the L-checks and it is stated here so a slow run is not mistaken for a hang: a
 * stepped frame of the grade probe measures ~17-21 ms and a kept screenshot ~100 ms.
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

// Static because the temporal helpers below are module-level and need it. `MotionProbe.mjs` pulls
// in vite and playwright lazily, inside the two functions that need them, so importing it here
// costs a PNG decoder and nothing else.
import { codeValueAt } from './MotionProbe.mjs';

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
//
// 🚩 AND THE SECOND AXIS, which R0-R7 were blind to for a round. Every one of them is a statistic
// of ONE frame, so none of them can see what the grain does over TIME — and "what it does over
// time" is the first thing `Grade.js`'s constructor comment claims: "The grain has to change every
// frame or it reads as dirt on the lens rather than as grain." A verifier froze the seed and this
// file reported 44/44 green. T1-T4 below render a sequence and two runs. They are a different
// measurement, not a stronger one: a temporal defect leaves every R-check's number untouched, and
// the gate proves that by rendering five of them and asserting they all pass R0-R7.

/**
 * The grain field on its own: the plate minus the same frame with the grain switched off, in 8-bit
 * code values, laid out as rows so a SHIFTED correlation is a matter of indexing.
 *
 * `padX`/`padY` extra pixels are read on every side of `rect`, so a correlation at a shift of up to
 * the pad still samples real pixels. They differ because the probe's geometry is not square: a
 * band is 60 px wide and 400 tall, so there is far more room to look up and down than sideways,
 * and T4's reach follows the room it has rather than a round number.
 */
function grainField( plate, grainOffPlate, rect, padX, padY ) {

    const rows = [];

    for ( let y = rect.y - padY; y < rect.y + rect.height + padY; y += 1 ) {

        const row = new Float64Array( rect.width + 2 * padX );

        for ( let x = rect.x - padX; x < rect.x + rect.width + padX; x += 1 ) {

            row[ x - ( rect.x - padX ) ] = codeValueAt( plate, x, y ) - codeValueAt( grainOffPlate, x, y );

        }

        rows.push( row );

    }

    return { rows, padX, padY, width: rect.width, height: rect.height };

}

/**
 * Pearson correlation between two grain fields, with the second one shifted by `(dx, dy)`.
 *
 * At `(0,0)` this asks "is frame B's noise the same noise as frame A's", which is what a frozen or
 * a repeating seed fails. At a non-zero shift it asks "is frame B's noise frame A's noise MOVED",
 * which is the one defect that leaves every other statistic in this file exactly right.
 */
function fieldCorrelation( a, b, dx = 0, dy = 0 ) {

    const { padX, padY, width, height } = a;
    const count = width * height;

    let sumA = 0;
    let sumB = 0;

    for ( let y = 0; y < height; y += 1 ) {

        for ( let x = 0; x < width; x += 1 ) {

            sumA += a.rows[ y + padY ][ x + padX ];
            sumB += b.rows[ y + padY + dy ][ x + padX + dx ];

        }

    }

    const meanA = sumA / count;
    const meanB = sumB / count;

    let covariance = 0;
    let varianceA = 0;
    let varianceB = 0;

    for ( let y = 0; y < height; y += 1 ) {

        for ( let x = 0; x < width; x += 1 ) {

            const da = a.rows[ y + padY ][ x + padX ] - meanA;
            const db = b.rows[ y + padY + dy ][ x + padX + dx ] - meanB;

            covariance += da * db;
            varianceA += da * da;
            varianceB += db * db;

        }

    }

    return covariance / Math.sqrt( varianceA * varianceB );

}

/**
 * The largest |r| over every shift the fields have room for, and where it was found.
 *
 * The search box is the pad, and the pad is the probe's geometry — see `grainField`. It is NOT a
 * tolerance to be tuned: an integral seed step of (5,11) was missed by an earlier version of this
 * check whose box was a square +-8, and the fix was to search all the room there is rather than to
 * pick a bigger round number.
 */
function strongestShiftedCorrelation( a, b ) {

    let best = { r: 0, dx: 0, dy: 0 };

    for ( let dy = -a.padY; dy <= a.padY; dy += 1 ) {

        for ( let dx = -a.padX; dx <= a.padX; dx += 1 ) {

            const r = Math.abs( fieldCorrelation( a, b, dx, dy ) );

            if ( r > best.r ) best = { r, dx, dy };

        }

    }

    return best;

}

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

        // ==========================================================================================
        // T1-T4 — THE SAME PIXELS, ACROSS TIME
        // ==========================================================================================
        //
        // Everything above measures ONE frame. `Grade.js`'s constructor comment makes two claims
        // that no single frame can test — the grain changes every frame, and it depends on nothing
        // but the frame index — and a verifier proved both untested by freezing the seed and
        // watching this file score 44/44.
        //
        // Four statistics, on a seven-frame sequence plus a second independent run:
        //
        //   T1  it MOVES          sigma(frame N - frame N+1) / sigma(grain) = sqrt(2) for independent
        //                         draws, 0 for a frozen field. A ratio, so it cannot be satisfied by
        //                         a grain of the wrong size — R3 already owns the size.
        //   T2  it does not REPEAT  every one of the 21 pairs is decorrelated, at every lag from 1
        //                         to 11 — not just the neighbours, and not just short lags.
        //                         `two-frame` beats a neighbours-only check (adjacent r = 0.026,
        //                         lag-2 r = 1.0000) and `four-frame` beat four consecutive frames.
        //   T3  it is DETERMINISTIC  the same frame index renders the same field in a second run.
        //                         This is the half of the comment about `performance.now()`, and it
        //                         is the only check `wall-clock` trips.
        //   T4  it does not SLIDE  no spatial shift the probe has room for lines frame N up with
        //                         frame N+1. `grain-scrolls` passes T1, T2 AND T3 and is caught
        //                         only here — and beat this check's first +-8 px version.
        //
        // ⚠️ Measured at the MIDTONE band for the same reason R3 and R7 are: below it the residual
        // is a couple of 8-bit code values and the quantisation, not the grain, sets the
        // correlation — the shipped grade reads r = 0.33 at band 6 and r = 0.04 at band 12. A
        // temporal check run in the shadows would be a measurement of the screenshot format.

        console.log( '\n--- T: the same grade across TIME, which R0-R7 cannot see ---------------------\n' );

        /**
         * The frames T2 compares, and the reason they are not simply four in a row.
         *
         * ⚠️ They WERE four in a row, and `four-frame` beat that: a repeat check sees a period p
         * only when two of its frames are congruent modulo p, and 9,10,11,12 are four distinct
         * residues mod 4. K consecutive frames therefore cover periods 1..K-1 and nothing else,
         * which is a gate that catches the repeats somebody already thought of.
         *
         * Six in a row plus one far frame instead. The pairwise differences are 1,2,3,4,5 inside
         * the block and 6,7,8,9,10,11 from the block to frame 20 — every period from 1 to 11
         * appears, so every one of them is caught. **Period 12 and longer is the stated limit**,
         * and the price of raising it is one screenshot per extra frame.
         */
        const SEQUENCE_FRAMES = [ 9, 10, 11, 12, 13, 14, 20 ];

        /**
         * T1 and T4 need a genuinely CONSECUTIVE pair; `SEQUENCE_FRAMES` no longer ends in one.
         *
         * Every T-check is a statement about a LAG, never about an absolute frame index, and that
         * is load-bearing rather than tidy: the renderer's `frameId` is offset from the capture
         * index by a constant this file has no way to know. Measured — with the seven-frame set,
         * `two-frame` and `four-frame` render byte-identical fields at frames 13 and 14, which
         * happens exactly when the underlying frameId there is 0 mod 4.
         */
        const CONSECUTIVE_PAIR = [ 13, 14 ];

        /**
         * T3 renders one frame twice — and the second run reaches it on a DELIBERATELY different
         * wall clock, by screenshotting every frame on the way and spending a few hundred
         * milliseconds the first run does not.
         *
         * ⚠️ That is not belt-and-braces, it is the check. Without it T3 measured luck and said so
         * in the wrong direction: `performance.now()` is PAGE-relative and Chromium coarsens it, so
         * two runs with the SAME capture schedule reach frame 9 at the same clamped value, and the
         * `wall-clock` defect reproduced byte for byte — run-to-run sigma 0.0000, T3 green, defect
         * shipped. An earlier draft only caught it because its two runs happened to have different
         * screenshot counts, which is a property of the harness and not of the grade.
         */
        const DETERMINISM_SLOW_RUN = [ 5, 6, 7, 8, 9 ];
        const DETERMINISM_FRAME = DETERMINISM_SLOW_RUN.at( -1 );

        if ( SEQUENCE_FRAMES.includes( CONSECUTIVE_PAIR[ 0 ] ) === false
            || SEQUENCE_FRAMES.includes( CONSECUTIVE_PAIR[ 1 ] ) === false
            || SEQUENCE_FRAMES.includes( DETERMINISM_FRAME ) === false ) {

            throw new Error( 'Grade.selftest: CONSECUTIVE_PAIR and DETERMINISM_FRAME must all be ' +
                'frames SEQUENCE_FRAMES captures, or the first run has nothing to compare against.' );

        }

        /**
         * T4's search box, which is the probe's geometry rather than a tolerance.
         *
         * ⚠️ This started as a square +-8 and it was WRONG, in the way rule 4 exists to catch: a
         * rebuilt `grain-scrolls` sliding by (3,7) was rejected, and then the same defect written
         * into the shipped path as an integral seed step of (5,11) sailed through, because 11 > 8.
         * A search box that only reaches as far as the defect it was written for is a decorative
         * check with a number in it.
         *
         * So the box is now everything the probe leaves room for. A band is 60 px wide, which caps
         * the horizontal reach; the frame is 400 tall against a 264 px sample, which does not. The
         * rect is narrowed and vertically inset to buy that room, at the cost of sampling 4,224
         * pixels instead of 16,200. That costs precision — the max of 3,201 correlations of 4,224
         * samples runs to 0.06-0.08 on a clean plate against 0.04 for a single pair of the full
         * band — and it is still four times under the ceiling and twelve times under a real slide.
         */
        const SLIDE_RADIUS_X = 16;
        const SLIDE_RADIUS_Y = 48;

        // Thresholds, each set from the measurements this run prints rather than chosen.
        const TEMPORAL_RATIO_BAND = [ 1.25, 1.55 ];  // sqrt(2) = 1.414 ideal; shipped 1.38-1.40, frozen 0
        const REPEAT_CEILING = 0.20;                 // shipped worst 0.044-0.052, a repeat is 1.0000
        const SLIDE_CEILING = 0.30;                  // worst clean 0.058-0.078, an integral step 0.91

        const TEMPORAL_PLATES = {
            shipped: '?probe=grade&grade=1&aa=off&bare',
            frozen: '?probe=grade&grade=1&aa=off&bare&graindefect=frozen',
            twoFrame: '?probe=grade&grade=1&aa=off&bare&graindefect=two-frame',
            fourFrame: '?probe=grade&grade=1&aa=off&bare&graindefect=four-frame',
            quarterRate: '?probe=grade&grade=1&aa=off&bare&graindefect=quarter-rate',
            wallClock: '?probe=grade&grade=1&aa=off&bare&graindefect=wall-clock',
            grainScrolls: '?probe=grade&grade=1&aa=off&bare&graindefect=grain-scrolls'
        };

        /** T1-T3 want every pixel of the band; they are population statistics at zero offset. */
        const midtoneRect = bandRect( MIDTONE_BAND );

        /**
         * T4 wants ROOM either side, so it takes a narrow column down the middle of the same band
         * and leaves `SLIDE_RADIUS_X`/`SLIDE_RADIUS_Y` px of real pixels around it to shift into.
         * Six px of the band's own edge are left unread at each side in any case — with `aa=off` a
         * band boundary can land mid-pixel and that pixel is neither band.
         */
        const slideRect = {
            x: Math.round( MIDTONE_BAND * ( WIDTH / BANDS ) ) + 6 + SLIDE_RADIUS_X,
            y: 20 + SLIDE_RADIUS_Y,
            width: Math.round( WIDTH / BANDS ) - 12 - 2 * SLIDE_RADIUS_X,
            height: HEIGHT - 40 - 2 * SLIDE_RADIUS_Y
        };

        /**
         * Everything the four T-checks need, for one page: the sequence's grain fields, the sigmas,
         * and one frame captured again in a SEPARATE page load.
         */
        async function measureSequence( query ) {

            const run = async ( keep ) => {

                const shot = await probe.capturePlates( {
                    browser, baseUrl: server.baseUrl, query, width: WIDTH, height: HEIGHT,
                    frames: Math.max( ...keep ), keep
                } );

                if ( shot.errors.length > 0 ) throw new Error( `${ query }: ${ shot.errors.slice( 0, 2 ).join( ' | ' ) }` );

                return shot.frames;

            };

            const first = await run( SEQUENCE_FRAMES );
            const repeat = ( await run( DETERMINISM_SLOW_RUN ) ).get( DETERMINISM_FRAME );

            const fields = SEQUENCE_FRAMES.map(
                ( frame ) => grainField( first.get( frame ), plates.grainOff, midtoneRect, 0, 0 ) );

            const slideFields = CONSECUTIVE_PAIR.map( ( frame ) => grainField(
                first.get( frame ), plates.grainOff, slideRect, SLIDE_RADIUS_X, SLIDE_RADIUS_Y ) );

            let worstRepeat = 0;
            let worstPair = '';

            for ( let i = 0; i < fields.length; i += 1 ) {

                for ( let j = i + 1; j < fields.length; j += 1 ) {

                    const r = Math.abs( fieldCorrelation( fields[ i ], fields[ j ] ) );

                    if ( r > worstRepeat ) {

                        worstRepeat = r;
                        worstPair = `${ SEQUENCE_FRAMES[ i ] }-${ SEQUENCE_FRAMES[ j ] }`;

                    }

                }

            }

            const grainSigmaHere = probe.differenceSigma(
                first.get( CONSECUTIVE_PAIR[ 1 ] ), plates.grainOff, midtoneRect ).sigma;

            const consecutive = probe.differenceSigma(
                first.get( CONSECUTIVE_PAIR[ 0 ] ), first.get( CONSECUTIVE_PAIR[ 1 ] ), midtoneRect ).sigma;

            return {
                lastPlate: first.get( SEQUENCE_FRAMES.at( -1 ) ),
                ratio: grainSigmaHere === 0 ? 0 : consecutive / grainSigmaHere,
                grainSigma: grainSigmaHere,
                consecutive,
                worstRepeat,
                worstPair,
                runToRunSigma: probe.differenceSigma( first.get( DETERMINISM_FRAME ), repeat, midtoneRect ).sigma,
                slide: strongestShiftedCorrelation( slideFields[ 0 ], slideFields[ 1 ] )
            };

        }

        const sequences = {};

        for ( const [ name, query ] of Object.entries( TEMPORAL_PLATES ) ) {

            sequences[ name ] = await measureSequence( query );

        }

        console.log( '      page            grain sigma   consec sigma   ratio   worst pair r   run-to-run   best slide' );

        for ( const [ name, s ] of Object.entries( sequences ) ) {

            console.log( `      ${ name.padEnd( 14 ) }  ${ s.grainSigma.toFixed( 3 ).padStart( 11 ) }   ` +
                `${ s.consecutive.toFixed( 3 ).padStart( 12 ) }   ${ s.ratio.toFixed( 3 ).padStart( 5 ) }   ` +
                `${ s.worstRepeat.toFixed( 4 ).padStart( 12 ) }   ${ s.runToRunSigma.toFixed( 4 ).padStart( 10 ) }   ` +
                `${ s.slide.r.toFixed( 4 ) }@(${ s.slide.dx },${ s.slide.dy })` );

        }

        console.log( '' );

        const TEMPORAL_CHECKS = {
            T1: ( s ) => s.ratio >= TEMPORAL_RATIO_BAND[ 0 ] && s.ratio <= TEMPORAL_RATIO_BAND[ 1 ],
            T2: ( s ) => s.worstRepeat <= REPEAT_CEILING,
            T3: ( s ) => s.runToRunSigma === 0,
            T4: ( s ) => s.slide.r <= SLIDE_CEILING
        };

        {
            const s = sequences.shipped;

            report(
                'T1 the grain field CHANGES between consecutive frames, by the amount two independent draws would',
                TEMPORAL_CHECKS.T1( s ),
                `sigma(frame ${ CONSECUTIVE_PAIR[ 0 ] } - frame ${ CONSECUTIVE_PAIR[ 1 ] }) / sigma(grain) = ` +
                    `${ s.consecutive.toFixed( 3 ) } / ${ s.grainSigma.toFixed( 3 ) } = ${ s.ratio.toFixed( 3 ) }, ` +
                    `band ${ TEMPORAL_RATIO_BAND[ 0 ] }-${ TEMPORAL_RATIO_BAND[ 1 ] } around sqrt(2) = 1.414. ` +
                    'A frozen field reads 0.000; an alternating-sign one would read 2.000.'
            );

            report(
                'T2 no two frames of the seven carry the same field, at any lag from 1 to 11',
                TEMPORAL_CHECKS.T2( s ),
                `worst |r| over the ${ SEQUENCE_FRAMES.length * ( SEQUENCE_FRAMES.length - 1 ) / 2 } pairs of ` +
                    `frames ${ SEQUENCE_FRAMES.join( ',' ) } is ${ s.worstRepeat.toFixed( 4 ) } (frames ` +
                    `${ s.worstPair }), ceiling ${ REPEAT_CEILING }. Their pairwise differences cover every ` +
                    'lag 1..11, so every repeat period up to 11 frames is caught; 12 is the stated limit. ' +
                    'The residual 0.03-0.05 is the fract(sin) hash, not sampling noise: 1/sqrt(16200) is 0.008.'
            );

            report(
                'T3 the same frame index renders the same field in a separate run, so a capture reproduces',
                TEMPORAL_CHECKS.T3( s ),
                `two page loads reaching frame ${ DETERMINISM_FRAME } on deliberately different wall clocks ` +
                    `(the second screenshots frames ${ DETERMINISM_SLOW_RUN.join( ',' ) } on the way, the first ` +
                    `none): difference sigma ${ s.runToRunSigma.toFixed( 6 ) } code values. This is the claim the ` +
                    'constructor comment makes about performance.now(), and it had never been measured.'
            );

            report(
                'T4 the grain is REDRAWN each frame, not slid across the screen',
                TEMPORAL_CHECKS.T4( s ),
                `strongest |r| over the ${ ( 2 * SLIDE_RADIUS_X + 1 ) * ( 2 * SLIDE_RADIUS_Y + 1 ) } shifts within ` +
                    `+-${ SLIDE_RADIUS_X } x +-${ SLIDE_RADIUS_Y } px is ${ s.slide.r.toFixed( 4 ) } at ` +
                    `(${ s.slide.dx },${ s.slide.dy }), ceiling ${ SLIDE_CEILING }. The irrational GRAIN_SEED_STEP ` +
                    'is what makes this true; an integral step of (3,7) or (5,11) reads 0.92 at that offset.'
            );
        }

        console.log( '\n      rejection coverage — which temporal check each rebuilt clock defect trips\n' );

        const TEMPORAL_DEFECTS = {
            'frozen (`onFrameUpdate( () => 0 )`, the reported defect verbatim)': 'frozen',
            'two-frame (0,1,0,1 — passes a neighbours-only check)': 'twoFrame',
            'four-frame (0,1,2,3 — passes FOUR consecutive frames, which is what T2 used to be)': 'fourFrame',
            'quarter-rate (advances once in four)': 'quarterRate',
            'wall-clock (performance.now(), unreproducible)': 'wallClock',
            'grain-scrolls (an integer seed step — one field, translated)': 'grainScrolls'
        };

        for ( const [ label, key ] of Object.entries( TEMPORAL_DEFECTS ) ) {

            const tripped = Object.entries( TEMPORAL_CHECKS )
                .filter( ( [ , check ] ) => check( sequences[ key ] ) === false )
                .map( ( [ name ] ) => name );

            report(
                `rejected by rendering a sequence: ${ label }`,
                tripped.length > 0,
                tripped.length > 0
                    ? `trips ${ tripped.join( ', ' ) }`
                    : 'passes every temporal check — this gate does NOT cover this defect'
            );

        }

        // 🎯 The finding, asserted rather than described. If a temporal defect ever DID trip an
        // R-check, the rejections above would be proving something about that defect's amplitude
        // or envelope instead of about its clock, and the T-checks would be back to unproven.
        {
            const contaminated = Object.entries( TEMPORAL_DEFECTS )
                .map( ( [ label, key ] ) => [ label, Object.entries( CHECKS )
                    .filter( ( [ , check ] ) => check( sequences[ key ].lastPlate ) === false )
                    .map( ( [ name ] ) => name ) ] )
                .filter( ( [ , tripped ] ) => tripped.length > 0 );

            report(
                'every temporal defect passes ALL of R0-R7 — which is exactly why T1-T4 had to exist',
                contaminated.length === 0,
                contaminated.length === 0
                    ? `all ${ Object.keys( TEMPORAL_DEFECTS ).length } broken clocks are invisible to the ` +
                        'single-frame checks: same mean, same p0.1, same sigma, same chroma, same envelope shape'
                    : contaminated.map( ( [ label, tripped ] ) => `${ label } trips ${ tripped.join( '/' ) }` ).join( '; ' )
            );
        }

        {
            const shippedTemporalTrips = Object.entries( TEMPORAL_CHECKS )
                .filter( ( [ , check ] ) => check( sequences.shipped ) === false )
                .map( ( [ name ] ) => name );

            report(
                'the shipped grade passes every temporal check, so the rejections above mean something',
                shippedTemporalTrips.length === 0,
                shippedTemporalTrips.length === 0 ? 'T1-T4 all green on the shipped sequence'
                    : `trips ${ shippedTemporalTrips.join( ', ' ) }`
            );
        }


        // ==========================================================================================
        // L1-L4 — THE LONG CLIP, WHICH T1-T4 CANNOT SEE EITHER
        // ==========================================================================================
        //
        // 🎯 THE DEFECT THIS EXISTS FOR, and it is the third layer of the same onion.
        //
        // R0-R7 measure one frame. T1-T4 fixed that by measuring a SEQUENCE — and the sequence is
        // `SEQUENCE_FRAMES`, whose highest member is **frame 20**. A grain that advances perfectly
        // for fifteen frames and then STOPS scores full marks on all four: frames 9-14 and 20 are
        // all inside the healthy stretch, so T1 sees motion, T2 sees no repeat, T3 reproduces and
        // T4 sees no slide. Reproduced for this round with a `late-freeze` seed driver whose onset
        // is frame 16. Measured on the midtone band over the 74 consecutive pairs this section
        // samples: the shipped grade's WORST pair ratio is **1.378**, `late-freeze`'s is
        // **0.000 at frames 32-33**, and on the seven frames T1-T4 actually look at the same
        // defect scores T1 **1.397** and T2 **0.0441** — green on both. T1-T4 never look past 20.
        //
        // 🚩 THE MODEL ERROR IS §1.4, RESTATED FOR A DEGRADATION RATHER THAN FOR A RATE: **the
        // observation window is a gate parameter, and a window shorter than the clip certifies
        // nothing about the rest of the clip.** `tools/critic/capture.mjs` renders 300 frames by
        // default (10 s at 30 fps) and 12,600 for a postural clip, and every judgement in this
        // project is made on one of those. A seven-frame window topping out at 20 was being read
        // as "the grain is fine."
        //
        // ## What the horizon is, and why it is 600 and not 20 or 12,600
        //
        // 600 frames is 20 s at this project's 30 fps — the clip length `docs/LEARNINGS.md` quotes
        // for its motion findings, and twice `capture.mjs`'s default. It is a CHOICE and it is
        // costed rather than asserted: measured on this machine, one stepped frame of the grade
        // probe is ~21 ms and one kept screenshot ~100 ms, so a 600-frame run with 96 kept frames
        // is ~23 s and three of them are ~70 s. The postural 12,600-frame clip would be ~4.5
        // minutes per run and is NOT certified here; L4 states that limit as a check rather than
        // as a caveat, because a caveat in a comment is what let frame 20 stand for a clip.
        //
        // ## The sampling, and the two exact statements it buys
        //
        // 96 frames: five dense blocks of twelve at 1, 150, 300, 450 and 585, plus a consecutive
        // pair every 32 frames, plus 599 and 600. Two properties, both COMPUTED by the gate rather
        // than argued in this comment, and both printed:
        //
        //   FREEZE ONSET — the set contains 74 consecutive pairs and the highest starts at 599, so
        //   a stall beginning at ANY frame from 1 to 599 has a pair entirely inside it. That is
        //   complete coverage of the horizon, not a sample of it.
        //
        //   REPEAT PERIOD — a period p is detectable only if two sampled frames are congruent
        //   mod p, which is a fact about the frame set and nothing else. `periodsNotCovered`
        //   computes it: every period from 1 to 481 is covered, 581 of the 600 are, and the
        //   smallest uncovered one is printed so the limit is a number a reader can act on.
        //   (The old set's equivalent number was 12, stated in its own comment.)
        //
        // ## The two defects, and why they are two
        //
        // Neither exists in `GRAIN_DEFECTS`, and `Grade.js` belongs to another agent this round,
        // so they are injected by rewriting the served module — see `SourcePatchProbe.mjs`. Both
        // are late-onset and they are caught by DIFFERENT checks, which is the point:
        //
        //   late-freeze   the seed stops at frame 16. Caught by L1 (a consecutive pair reads 0)
        //                 and by L2 (every frame after 16 is the same field).
        //   late-period   the seed acquires a 37-frame repeat at frame 16. Consecutive frames
        //                 still differ, the run reproduces, nothing slides — **L1 is green on it**,
        //                 worst pair ratio 1.369 at frames 288-289 where late-freeze reads 0.000.
        //                 Only L2 sees it, at |r| 1.0000 between frames 32 and 513, and only
        //                 because both are sampled and 481 = 13 x 37.
        const LONG_HORIZON = 600;
        const LONG_BLOCK_STARTS = [ 1, 150, 300, 450, 585 ];
        const LONG_BLOCK_LENGTH = 12;
        const LONG_CHECKPOINT_STRIDE = 32;

        const LONG_FRAMES = ( () => {

            const frames = new Set( [ LONG_HORIZON - 1, LONG_HORIZON ] );

            for ( const start of LONG_BLOCK_STARTS ) {

                for ( let offset = 0; offset < LONG_BLOCK_LENGTH; offset += 1 ) frames.add( start + offset );

            }

            for ( let frame = LONG_CHECKPOINT_STRIDE; frame + 1 <= LONG_HORIZON; frame += LONG_CHECKPOINT_STRIDE ) {

                frames.add( frame );
                frames.add( frame + 1 );

            }

            return [ ...frames ].filter( ( frame ) => frame >= 1 && frame <= LONG_HORIZON ).sort( ( a, b ) => a - b );

        } )();

        /** Every `(n, n+1)` the sample set contains. A freeze from frame f is caught by any of these with n >= f. */
        const LONG_PAIRS = LONG_FRAMES
            .filter( ( frame ) => LONG_FRAMES.includes( frame + 1 ) )
            .map( ( frame ) => [ frame, frame + 1 ] );

        /**
         * The repeat periods this frame set is structurally unable to see.
         *
         * A gate that samples frames cannot detect a period p unless two of its samples fall in
         * the same residue class mod p — that is arithmetic, not tuning, and it is the reason the
         * old seven-frame set could say "every period up to 11" and nothing beyond. Computed here
         * so the claim is produced by the set rather than written beside it.
         */
        function periodsNotCovered( frames, maximum ) {

            const uncovered = [];

            for ( let period = 1; period <= maximum; period += 1 ) {

                const residues = new Set();
                let collides = false;

                for ( const frame of frames ) {

                    const residue = frame % period;

                    if ( residues.has( residue ) ) { collides = true; break; }

                    residues.add( residue );

                }

                if ( collides === false ) uncovered.push( period );

            }

            return uncovered;

        }

        /**
         * 🚩 The two late-onset seed drivers, as a rewrite of the served `Grade.js`.
         *
         * The anchor is `GRAIN_SEED_DRIVERS`'s declaration, and the replacement ALSO mutates
         * `GRAIN_DEFECTS` — the constructor validates the name against that table and throws
         * otherwise, which is how the first attempt at this failed: the driver was installed, the
         * page never booted, and the only symptom was a 120 s timeout. Recorded because the next
         * person to inject a defect here will hit it.
         */
        const LATE_DEFECT_ONSET = 16;
        const LATE_DEFECT_PERIOD = 37;

        const LATE_DEFECT_PATCH = {
            urlPattern: '**/Grade.js*',
            anchor: 'const GRAIN_SEED_DRIVERS = {',
            replacement: `const LATE_ONSET = ${ LATE_DEFECT_ONSET };
Object.assign( GRAIN_DEFECTS, {
    'late-freeze': 'the seed advances correctly and then STOPS, at frame ${ LATE_DEFECT_ONSET }',
    'late-period': 'the seed acquires a ${ LATE_DEFECT_PERIOD }-frame repeat at frame ${ LATE_DEFECT_ONSET }'
} );
const GRAIN_SEED_DRIVERS = {
    'late-freeze': ( frame ) => Math.min( frame.frameId, LATE_ONSET ) % 4096,
    'late-period': ( frame ) => frame.frameId < LATE_ONSET
        ? frame.frameId % 4096
        : ( LATE_ONSET + ( ( frame.frameId - LATE_ONSET ) % ${ LATE_DEFECT_PERIOD } ) ) % 4096,`
        };

        const { capturePatchedPlates } = await import( './SourcePatchProbe.mjs' );

        /** One 600-frame run, and the four statistics the L-checks are made of. */
        async function measureLongClip( query, patch ) {

            const shot = await capturePatchedPlates( {
                browser, baseUrl: server.baseUrl, query, width: WIDTH, height: HEIGHT,
                frames: LONG_HORIZON, keep: LONG_FRAMES, patch
            } );

            if ( shot.errors.length > 0 ) throw new Error( `${ query }: ${ shot.errors.slice( 0, 2 ).join( ' | ' ) }` );

            const grainSigma = probe.differenceSigma(
                shot.frames.get( LONG_HORIZON ), plates.grainOff, midtoneRect ).sigma;

            // L1. The WORST pair, because a late freeze makes exactly one region of the clip dead
            // and an average over 74 pairs would bury it.
            let worstRatio = Infinity;
            let worstRatioPair = '';

            for ( const [ first, second ] of LONG_PAIRS ) {

                const consecutive = probe.differenceSigma(
                    shot.frames.get( first ), shot.frames.get( second ), midtoneRect ).sigma;
                const ratio = grainSigma === 0 ? 0 : consecutive / grainSigma;

                if ( ratio < worstRatio ) {

                    worstRatio = ratio;
                    worstRatioPair = `${ first }-${ second }`;

                }

            }

            // L2. Every pair of the 96 sampled frames, which is 4,560 correlations.
            const fields = LONG_FRAMES.map(
                ( frame ) => grainField( shot.frames.get( frame ), plates.grainOff, midtoneRect, 0, 0 ) );

            let worstRepeat = 0;
            let worstRepeatPair = '';

            for ( let i = 0; i < fields.length; i += 1 ) {

                for ( let j = i + 1; j < fields.length; j += 1 ) {

                    const r = Math.abs( fieldCorrelation( fields[ i ], fields[ j ] ) );

                    if ( r > worstRepeat ) {

                        worstRepeat = r;
                        worstRepeatPair = `${ LONG_FRAMES[ i ] }-${ LONG_FRAMES[ j ] }`;

                    }

                }

            }

            // L3. The slide check at the FAR END of the clip, not at its start.
            const lastPair = LONG_PAIRS.at( -1 );
            const slideFields = lastPair.map( ( frame ) => grainField(
                shot.frames.get( frame ), plates.grainOff, slideRect, SLIDE_RADIUS_X, SLIDE_RADIUS_Y ) );

            return {
                grainSigma,
                worstRatio,
                worstRatioPair,
                worstRepeat,
                worstRepeatPair,
                lastPair,
                slide: strongestShiftedCorrelation( slideFields[ 0 ], slideFields[ 1 ] )
            };

        }

        console.log( `\n--- L: the same grade over ${ LONG_HORIZON } frames, which T1-T4 cannot see -----------\n` );

        const uncoveredPeriods = periodsNotCovered( LONG_FRAMES, LONG_HORIZON );

        report(
            `L0 the ${ LONG_FRAMES.length }-frame sample set covers every freeze onset and every repeat period up to ${ uncoveredPeriods[ 0 ] - 1 }`,
            LONG_PAIRS.length > 0
                && Math.max( ...LONG_PAIRS.map( ( [ first ] ) => first ) ) === LONG_HORIZON - 1
                && uncoveredPeriods[ 0 ] > 400,
            `${ LONG_PAIRS.length } consecutive pairs, the last starting at ` +
                `${ Math.max( ...LONG_PAIRS.map( ( [ first ] ) => first ) ) }, so a stall beginning at any frame ` +
                `1..${ LONG_HORIZON - 1 } has a pair inside it. Repeat periods: ` +
                `${ LONG_HORIZON - uncoveredPeriods.length }/${ LONG_HORIZON } covered, all of 1..` +
                `${ uncoveredPeriods[ 0 ] - 1 }, smallest uncovered ${ uncoveredPeriods[ 0 ] }. This is arithmetic on ` +
                'the frame set, computed rather than claimed — see periodsNotCovered.'
        );

        /**
         * 🚩 THE REJECTION PROOF IN ITS STRONGEST FORM: put the defect in the SHIPPED arm.
         *
         *     node "packages/core/src/render/Grade.selftest.mjs" --shipped-grain-defect=late-freeze
         *
         * The coverage rows below already fail if a defect passes every L-check, which is this
         * file's established idiom and is asserted on every run. This flag asks the other
         * question — does the FILE go red when the shipped grade is the broken one — and it is
         * the question rule 4 is actually about. `late-freeze` and `late-period` are the two
         * names; both are injected by the same source rewrite the coverage rows use.
         */
        const SHIPPED_GRAIN_DEFECT = process.argv
            .find( ( argument ) => argument.startsWith( '--shipped-grain-defect=' ) )?.split( '=' )[ 1 ] ?? null;

        if ( SHIPPED_GRAIN_DEFECT !== null ) {

            console.log( `\n      🚩 DEFECT INJECTED INTO THE SHIPPED ARM: graindefect=${ SHIPPED_GRAIN_DEFECT }. This run\n` +
                '      is a rejection proof, not a verdict on the repo.\n' );

        }

        const longSequences = {
            shipped: await measureLongClip(
                SHIPPED_GRAIN_DEFECT === null
                    ? '?probe=grade&grade=1&aa=off&bare'
                    : `?probe=grade&grade=1&aa=off&bare&graindefect=${ SHIPPED_GRAIN_DEFECT }`,
                SHIPPED_GRAIN_DEFECT === null ? null : LATE_DEFECT_PATCH ),
            lateFreeze: await measureLongClip(
                '?probe=grade&grade=1&aa=off&bare&graindefect=late-freeze', LATE_DEFECT_PATCH ),
            latePeriod: await measureLongClip(
                '?probe=grade&grade=1&aa=off&bare&graindefect=late-period', LATE_DEFECT_PATCH )
        };

        console.log( '      page            grain sigma   worst pair ratio   worst repeat r   best slide' );

        for ( const [ name, s ] of Object.entries( longSequences ) ) {

            console.log( `      ${ name.padEnd( 14 ) }  ${ s.grainSigma.toFixed( 3 ).padStart( 11 ) }   ` +
                `${ `${ s.worstRatio.toFixed( 3 ) }@${ s.worstRatioPair }`.padStart( 16 ) }   ` +
                `${ `${ s.worstRepeat.toFixed( 4 ) }@${ s.worstRepeatPair }`.padStart( 14 ) }   ` +
                `${ s.slide.r.toFixed( 4 ) }@(${ s.slide.dx },${ s.slide.dy })` );

        }

        console.log( '' );

        const LONG_CHECKS = {
            L1: ( s ) => s.worstRatio >= TEMPORAL_RATIO_BAND[ 0 ] && s.worstRatio <= TEMPORAL_RATIO_BAND[ 1 ],
            L2: ( s ) => s.worstRepeat <= REPEAT_CEILING,
            L3: ( s ) => s.slide.r <= SLIDE_CEILING
        };

        {
            const s = longSequences.shipped;

            report(
                `L1 EVERY consecutive pair across ${ LONG_HORIZON } frames moves, not just the one at frame 13`,
                LONG_CHECKS.L1( s ),
                `worst of ${ LONG_PAIRS.length } pairs is ${ s.worstRatio.toFixed( 3 ) } at frames ${ s.worstRatioPair }, ` +
                    `band ${ TEMPORAL_RATIO_BAND[ 0 ] }-${ TEMPORAL_RATIO_BAND[ 1 ] }. A clip that dies at any point ` +
                    'reads 0.000 here; T1 measured one pair at frame 13 and could not.'
            );

            report(
                `L2 no two of the ${ LONG_FRAMES.length } sampled frames carry the same field, at any lag up to ${ uncoveredPeriods[ 0 ] - 1 }`,
                LONG_CHECKS.L2( s ),
                `worst |r| over the ${ LONG_FRAMES.length * ( LONG_FRAMES.length - 1 ) / 2 } pairs is ` +
                    `${ s.worstRepeat.toFixed( 4 ) } (frames ${ s.worstRepeatPair }), ceiling ${ REPEAT_CEILING }. ` +
                    `T2's seven frames covered lags 1..11; this covers 1..${ uncoveredPeriods[ 0 ] - 1 }.`
            );

            report(
                `L3 the grain is still redrawn rather than slid at frame ${ s.lastPair[ 0 ] }, not only at frame 13`,
                LONG_CHECKS.L3( s ),
                `strongest |r| over the shifts within +-${ SLIDE_RADIUS_X } x +-${ SLIDE_RADIUS_Y } px at frames ` +
                    `${ s.lastPair.join( '-' ) } is ${ s.slide.r.toFixed( 4 ) } at (${ s.slide.dx },${ s.slide.dy }), ` +
                    `ceiling ${ SLIDE_CEILING }`
            );
        }

        console.log( '\n      rejection coverage — which LONG check each late-onset defect trips, and which\n' +
                     '      of T1-T4 it walks straight past\n' );

        const LONG_DEFECTS = {
            [ `late-freeze (the seed stops at frame ${ LATE_DEFECT_ONSET })` ]: 'lateFreeze',
            [ `late-period (a ${ LATE_DEFECT_PERIOD }-frame repeat from frame ${ LATE_DEFECT_ONSET })` ]: 'latePeriod'
        };

        for ( const [ label, key ] of Object.entries( LONG_DEFECTS ) ) {

            const tripped = Object.entries( LONG_CHECKS )
                .filter( ( [ , check ] ) => check( longSequences[ key ] ) === false )
                .map( ( [ name ] ) => name );

            report(
                `rejected by rendering ${ LONG_HORIZON } frames: ${ label }`,
                tripped.length > 0,
                tripped.length > 0
                    ? `trips ${ tripped.join( ', ' ) }. Worst pair ratio ` +
                        `${ longSequences[ key ].worstRatio.toFixed( 3 ) } at ${ longSequences[ key ].worstRatioPair }, ` +
                        `worst repeat ${ longSequences[ key ].worstRepeat.toFixed( 4 ) } at ` +
                        `${ longSequences[ key ].worstRepeatPair }`
                    : 'passes every long check — this gate does NOT cover this defect'
            );

        }

        // 🎯 THE FINDING, ASSERTED. Both late defects are invisible to T1-T4, because every frame
        // T1-T4 look at is inside the healthy stretch before the onset. If one of them ever DID
        // trip a T-check, the rejections above would be proving something about a defect that the
        // seven-frame window already caught, and L1-L3 would be back to unproven.
        {
            const seenEarly = [];

            for ( const [ label, key ] of Object.entries( LONG_DEFECTS ) ) {

                const query = key === 'lateFreeze'
                    ? '?probe=grade&grade=1&aa=off&bare&graindefect=late-freeze'
                    : '?probe=grade&grade=1&aa=off&bare&graindefect=late-period';

                const shot = await capturePatchedPlates( {
                    browser, baseUrl: server.baseUrl, query, width: WIDTH, height: HEIGHT,
                    frames: Math.max( ...SEQUENCE_FRAMES ), keep: SEQUENCE_FRAMES, patch: LATE_DEFECT_PATCH
                } );

                const early = SEQUENCE_FRAMES.map(
                    ( frame ) => grainField( shot.frames.get( frame ), plates.grainOff, midtoneRect, 0, 0 ) );

                let worst = 0;

                for ( let i = 0; i < early.length; i += 1 ) {

                    for ( let j = i + 1; j < early.length; j += 1 ) {

                        worst = Math.max( worst, Math.abs( fieldCorrelation( early[ i ], early[ j ] ) ) );

                    }

                }

                const consecutive = probe.differenceSigma(
                    shot.frames.get( CONSECUTIVE_PAIR[ 0 ] ), shot.frames.get( CONSECUTIVE_PAIR[ 1 ] ), midtoneRect ).sigma;
                const grainSigma = probe.differenceSigma(
                    shot.frames.get( CONSECUTIVE_PAIR[ 1 ] ), plates.grainOff, midtoneRect ).sigma;
                const ratio = grainSigma === 0 ? 0 : consecutive / grainSigma;

                const t1 = ratio >= TEMPORAL_RATIO_BAND[ 0 ] && ratio <= TEMPORAL_RATIO_BAND[ 1 ];
                const t2 = worst <= REPEAT_CEILING;

                if ( t1 === false || t2 === false ) seenEarly.push( `${ label } (T1 ${ ratio.toFixed( 3 ) }, T2 ${ worst.toFixed( 4 ) })` );

                console.log( `      ${ label.padEnd( 56 ) } on frames ${ SEQUENCE_FRAMES.join( ',' ) }: ` +
                    `T1 ratio ${ ratio.toFixed( 3 ) }, T2 worst r ${ worst.toFixed( 4 ) }` );

            }

            report(
                'every late-onset defect passes T1 and T2 on the old seven-frame window — which is exactly why L1-L3 had to exist',
                seenEarly.length === 0,
                seenEarly.length === 0
                    ? `both broken clocks are invisible to frames ${ SEQUENCE_FRAMES.join( ',' ) }: the onset is frame ` +
                        `${ LATE_DEFECT_ONSET } and only frame 20 of that set is past it, which is one frame and ` +
                        'therefore no pair'
                    : `CAUGHT EARLY: ${ seenEarly.join( '; ' ) } — the window was not the thing that missed them`
            );
        }

        // ⚠️ THE HORIZON, AS A CHECK RATHER THAN AS A CAVEAT. A gate that certifies 600 frames and
        // is read as certifying a clip cannot be corrected by a sentence in a header — frame 20
        // was read that way for a round. So the two clip lengths this project actually renders are
        // named here, and the one this gate does not reach is a printed, failing-if-forgotten fact.
        {
            const CAPTURE_DEFAULT_FRAMES = 300;      // tools/critic/capture.mjs DEFAULTS: 10 s at 30 fps
            const POSTURAL_CLIP_FRAMES = 12_600;     // POSTURAL_CLIP_SECONDS 420 at 30 fps

            report(
                `L4 the horizon reaches capture.mjs's DEFAULT clip, and is stated as NOT reaching the postural one`,
                LONG_HORIZON >= CAPTURE_DEFAULT_FRAMES && LONG_HORIZON < POSTURAL_CLIP_FRAMES,
                `certified to frame ${ LONG_HORIZON } (${ ( LONG_HORIZON / 30 ).toFixed( 1 ) } s at 30 fps) against ` +
                    `capture.mjs's default ${ CAPTURE_DEFAULT_FRAMES } and its postural ${ POSTURAL_CLIP_FRAMES }. ` +
                    `Anything after frame ${ LONG_HORIZON } is UNMEASURED by this gate: at ~21 ms a stepped frame, ` +
                    `raising the horizon to ${ POSTURAL_CLIP_FRAMES } costs ~4.5 minutes per run and there are three ` +
                    'runs. That is the price, stated, so the next reader decides rather than assumes.'
            );

            // 🎯 AND THE HORIZON IS NOT A HYPOTHETICAL LIMIT — THERE IS A REAL REPEAT JUST PAST IT.
            //
            // The shipped driver is `frame.frameId % 4096`, so frames k and k+4096 are handed the
            // SAME seed and must render the same field. That is a 4096-frame repeat period: 136 s
            // at 30 fps, comfortably outside a 600-frame clip and comfortably INSIDE the 12,600-
            // frame postural one, where it recurs three times.
            //
            // Rendered rather than reasoned, because a CPU reading of the driver is exactly the
            // kind of mirror this whole file exists to distrust — an independent verifier once
            // replaced the shipped node's body with an arithmetic constant and watched the mirror
            // checks score 28/28. Measured here: the midtone difference sigma between frames 100
            // and 4196 is **0.000000** while the adjacent control (100 against 101) is **2.146**.
            //
            // It is recorded as a LIMIT rather than as a failure. Nothing in the look spec asks
            // for a non-repeating grain over 136 s, `Grade.js` belongs to another agent, and a
            // gate that goes red on a documented design choice gets muted. What this check does is
            // pin the period: if the wrap ever moves — shortened by a well-meant tidy-up, or fixed
            // — this says so, and it is the only measurement anywhere in the repo of how long the
            // grain actually goes before it comes round again.
            //
            // Cost: one extra run to frame 4197, measured at 70.5 s (~17 ms a stepped frame).
            const SEED_WRAP_FRAMES = 4096;
            const WRAP_PROBE_FRAME = 100;

            const wrapShot = await capturePatchedPlates( {
                browser, baseUrl: server.baseUrl, query: '?probe=grade&grade=1&aa=off&bare',
                width: WIDTH, height: HEIGHT,
                frames: WRAP_PROBE_FRAME + SEED_WRAP_FRAMES,
                keep: [ WRAP_PROBE_FRAME, WRAP_PROBE_FRAME + 1, WRAP_PROBE_FRAME + SEED_WRAP_FRAMES ],
                patch: null
            } );

            const wrapped = probe.differenceSigma( wrapShot.frames.get( WRAP_PROBE_FRAME ),
                wrapShot.frames.get( WRAP_PROBE_FRAME + SEED_WRAP_FRAMES ), midtoneRect ).sigma;
            const adjacent = probe.differenceSigma( wrapShot.frames.get( WRAP_PROBE_FRAME ),
                wrapShot.frames.get( WRAP_PROBE_FRAME + 1 ), midtoneRect ).sigma;

            report(
                `L5 STATED LIMIT: the grain repeats exactly every ${ SEED_WRAP_FRAMES } frames, which is where the seed wraps`,
                wrapped === 0 && adjacent > 1,
                `frames ${ WRAP_PROBE_FRAME } and ${ WRAP_PROBE_FRAME + SEED_WRAP_FRAMES } differ by sigma ` +
                    `${ wrapped.toFixed( 6 ) } code values — the same field — against ${ adjacent.toFixed( 3 ) } for ` +
                    `the adjacent control. ${ ( SEED_WRAP_FRAMES / 30 ).toFixed( 1 ) } s at 30 fps: outside a ` +
                    `${ LONG_HORIZON }-frame clip, and three times over inside a ${ POSTURAL_CLIP_FRAMES }-frame one. ` +
                    'Recorded as the measured period, not as a defect — but it moves the day the wrap does.'
            );
        }

    }

    await browser?.close();
    await server?.close();

}

console.log( `\n${ failures === 0 ? 'PASS' : 'FAIL' }: ${ checks - failures }/${ checks } checks green\n` );

process.exitCode = failures === 0 ? 0 : 1;
