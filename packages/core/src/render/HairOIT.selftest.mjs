/**
 * Gate for `render/HairOIT.js` — punch-list 3.6.
 *
 * Two halves, and this file says which is which because they are worth very different amounts.
 *
 * The WEAK HALF is arithmetic. It re-derives McGuire & Bavoil's equations (10) and (11) from the
 * primary artefact's own numbers, checks the two fixed points that catch the sign trap in (11), and
 * asserts that the `BlendMode` objects handed to the pass MRT carry exactly Listing 4's factors.
 * Every one of those, broken, produces a plausible picture rather than an obvious failure — a
 * weight function pinned at its clamp is a milky groom, and a wrong `blendDstAlpha` is a groom that
 * is merely a bit too solid.
 *
 * The STRONG HALF renders the real groom on a real GPU and measures the defect ITSELF rather than a
 * proxy for it.
 *
 *   ORDER DEPENDENCE  The same frame, twice, with the groom's triangle order reversed
 *                     (`?cardorder=reverse`). Nothing about the geometry, the camera, the lights or
 *                     the shading differs — only the sequence fragments arrive in. Order
 *                     independence IS the property that the two plates are the same picture, so the
 *                     RMS between them is the artefact in code values, with no reference render and
 *                     no judgement anywhere in it.
 *
 *   MOTION            A still frame cannot show popping. The camera orbits 0.25 degrees per
 *                     simulated frame — small enough that the honest frame-to-frame change is a
 *                     fraction of a pixel — and the per-pixel temporal sigma over the hair band is
 *                     accumulated across twenty converged frames.
 *
 *   RED PROOF         🚩 `?oitdefect=material-blend` moves the two OIT blend modes from the pass MRT
 *                     onto `material.mrtNode`, which is where a reader of `docs/research/hair.md`
 *                     §4.3(a) would expect them to belong. `WebGPUPipelineUtils.js:132` reads
 *                     `renderObject.context.mrt`, which is the PASS's, so the material's table is
 *                     never consulted, the accumulation attachments get no blending at all, and the
 *                     sums become last-write-wins. The gate requires the `wboit` arm to go back to
 *                     being order dependent under the defect: a gate that has never failed is
 *                     decorative, and this one fails by 329x.
 *
 * A measurement outside its range is a FAIL and exits non-zero. It is not grounds for widening the
 * range.
 *
 * ⚠️ **This gate does NOT enforce a GPU cost.** The cost numbers that decide 3.6 are in
 * `HairOIT.js`'s header and in the punch-list entry; a millisecond threshold asserted here would go
 * red on a slower machine and tell the next agent nothing about the code. What IS asserted is the
 * thing a cost number cannot be argued out of — which arms are correct.
 *
 * Usage:  node "packages/core/src/render/HairOIT.selftest.mjs"
 */

import * as probe from './MotionProbe.mjs';

import {
    HAIR_OIT_MODES,
    HAIR_WEIGHT_CEILING,
    HAIR_WEIGHT_FLOOR,
    HAIR_WEIGHT_RANGE,
    clipDepthValue,
    hairAccumBlendMode,
    hairWeightBlendMode,
    hairWeightValue,
    publishedWeightValue,
    viewDepthExtent
} from './HairOIT.js';

import {
    AddEquation,
    Box3,
    CustomBlending,
    OneFactor,
    OneMinusSrcAlphaFactor,
    PerspectiveCamera,
    Vector3,
    ZeroFactor
} from 'three/webgpu';

let checks = 0;
let failures = 0;

function report( name, passed, detail ) {

    checks += 1;
    if ( passed !== true ) failures += 1;
    console.log( `${ passed ? 'PASS' : 'FAIL' }  ${ name }\n      ${ detail }` );

}

// ---------------------------------------------------------------------------------------------
// The weak half — arithmetic
// ---------------------------------------------------------------------------------------------

console.log( '\n--- equation (11) and the sign convention that decides it ---------------------\n' );

{
    // The two fixed points. A perspective depth is 0 at the near plane and 1 at the far plane, and
    // the ONLY way to get both out of the paper's formula is to treat `z_near` and `z_far` as
    // negative alongside `z` — page 129, one line under the equation. Pass them positive and the
    // near plane reads 2.005, the cubic in equation (10) goes negative, and every fragment pins at
    // the clamp floor. That reads as "weighted-blended OIT is milky", which is a conclusion about
    // the method rather than about the transcription.
    const NEAR = 0.05;
    const FAR = 20;

    const atNear = clipDepthValue( NEAR, NEAR, FAR );
    const atFar = clipDepthValue( FAR, NEAR, FAR );

    report(
        'd(near) = 0 and d(far) = 1 exactly, which is what catches the sign trap in (11)',
        Math.abs( atNear ) < 1e-9 && Math.abs( atFar - 1 ) < 1e-9,
        `d(${ NEAR }) = ${ atNear.toExponential( 2 ) }, d(${ FAR }) = ${ atFar.toFixed( 12 ) }. ` +
            'With positive near/far the same call returns 2.005 at the near plane.'
    );

    // Monotone and inside the unit interval across the whole frustum — the property that makes it
    // a depth at all.
    const samples = [ 0.05, 0.1, 0.3, 0.75, 2, 8, 20 ].map( ( z ) => clipDepthValue( z, NEAR, FAR ) );
    let monotone = true;

    for ( let i = 1; i < samples.length; i ++ ) if ( samples[ i ] <= samples[ i - 1 ] ) monotone = false;

    report(
        'the depth is monotone and inside 0..1 across the whole frustum',
        monotone && samples.every( ( d ) => d >= 0 && d <= 1 ),
        samples.map( ( d ) => d.toFixed( 4 ) ).join( ' -> ' )
    );

}

console.log( '\n--- equation (10) over a groom, which is why the weight is re-fitted ------------\n' );

{
    // The groom's own slab, measured off the exported GLB by the round that built it and re-stated
    // here as the interval this arm captures at: a head at 0.66 m orbit radius spans roughly
    // 0.55–0.85 m in front of the camera.
    const FRONT = 0.55;
    const BACK = 0.85;

    const FRUSTUMS = [
        { near: 0.05, far: 20 },      // the hair arm's own camera
        { near: 0.05, far: 100 },
        { near: 0.1, far: 12 },       // src/stage.html's default
        { near: 0.01, far: 100 }      // alive.html's
    ];

    const rows = FRUSTUMS.map( ( { near, far } ) => {

        const front = publishedWeightValue( FRONT, 1, near, far );
        const back = publishedWeightValue( BACK, 1, near, far );

        return { near, far, front, back, ratio: front / back, backAtFloor: back <= HAIR_WEIGHT_FLOOR * ( 1 + 1e-9 ) };

    } );

    for ( const row of rows ) {

        console.log( `      near ${ String( row.near ).padEnd( 5 ) } far ${ String( row.far ).padEnd( 4 ) } ` +
            `front ${ row.front.toFixed( 5 ).padStart( 9 ) }  back ${ row.back.toFixed( 5 ).padStart( 9 ) }  ` +
            `ratio ${ row.ratio.toFixed( 3 ) }${ row.backAtFloor ? '   back AT THE CLAMP FLOOR' : '' }` );

    }

    // The claim the re-fit rests on: the published curve does not discriminate enough over a groom.
    // Stated as an upper bound rather than as an equality, because it is the DIRECTION that matters
    // and a three.js or paper revision could move the digits.
    const worstRatio = Math.max( ...rows.map( ( row ) => row.ratio ) );

    report(
        'the published equation (10) separates the front and back of a groom by under 5x',
        worstRatio < 5,
        `best of four frustums is ${ worstRatio.toFixed( 3 ) }x, against the ` +
            `${ HAIR_WEIGHT_RANGE }x the slab fit is authored at. A groom stacks 10-50 cards.`
    );

    // And the reason it cannot simply be tuned: the answer depends on the CAMERA and not on the
    // hair. Two frustums that differ only in their near plane — a change with no visual meaning —
    // move the absolute weight by more than two orders of magnitude, and one of them puts the back
    // of the groom on the clamp floor.
    const absolutes = rows.map( ( row ) => row.front );
    const spread = Math.max( ...absolutes ) / Math.min( ...absolutes );

    report(
        'and equation (10) is a property of the frustum, not of the groom — the whole case for the re-fit',
        spread > 100 && rows.some( ( row ) => row.backAtFloor ),
        `the same fragment at 0.55 m is worth ${ Math.min( ...absolutes ).toFixed( 5 ) } to ` +
            `${ Math.max( ...absolutes ).toFixed( 5 ) } across four frustums — ${ spread.toFixed( 0 ) }x — ` +
            `and near 0.01 pins the back of the groom at the ${ HAIR_WEIGHT_FLOOR } floor.`
    );

}

console.log( '\n--- the slab weight -------------------------------------------------------------\n' );

{
    // The two ends, exactly. `range` at the front and 1 at the back is the contract the composite
    // divides by, and an off-by-one here is a groom that is uniformly slightly wrong.
    const front = hairWeightValue( 0, 1, 64 );
    const back = hairWeightValue( 1, 1, 64 );

    report(
        'the slab weight spans exactly `range` at the front to 1 at the back',
        Math.abs( front - 64 ) < 1e-9 && Math.abs( back - 1 ) < 1e-9,
        `w(t=0) = ${ front.toFixed( 6 ) }, w(t=1) = ${ back.toFixed( 6 ) }`
    );

    // Monotone, and clamped outside the slab rather than extrapolated: a flyaway in front of the
    // bounding box must be worth the front weight and not `range x 8`.
    let monotone = true;
    let previous = Infinity;

    for ( const t of [ - 0.5, 0, 0.2, 0.4, 0.6, 0.8, 1, 1.5 ] ) {

        const value = hairWeightValue( t, 1 );
        if ( value > previous + 1e-12 ) monotone = false;
        previous = value;

    }

    report(
        'it is monotone in depth and clamped outside the slab in both directions',
        monotone
            && hairWeightValue( - 0.5, 1 ) === hairWeightValue( 0, 1 )
            && hairWeightValue( 1.5, 1 ) === hairWeightValue( 1, 1 ),
        `t = -0.5 gives ${ hairWeightValue( - 0.5, 1 ).toFixed( 4 ) } (same as t = 0), ` +
            `t = 1.5 gives ${ hairWeightValue( 1.5, 1 ).toFixed( 4 ) } (same as t = 1)`
    );

    // ⚠️ α is INSIDE w, as equations (7)-(10) write it. The accumulation then carries α twice — once
    // through the premultiplied colour and once through w — and the quotient is still a weighted
    // average. Hoisting α out to "simplify" is the plausible-looking mistake, and this is the check
    // that would catch it.
    report(
        'alpha is a linear factor of the weight, as equations (7)-(10) write it',
        Math.abs( hairWeightValue( 0.3, 0.25 ) - 0.25 * hairWeightValue( 0.3, 1 ) ) < 1e-12,
        `w(0.3, 0.25) = ${ hairWeightValue( 0.3, 0.25 ).toFixed( 6 ) } = ` +
            `0.25 x ${ hairWeightValue( 0.3, 1 ).toFixed( 6 ) }`
    );

    // The paper's clamps, which exist for 16-bit float underflow and overflow and not for looks.
    const enormous = hairWeightValue( 0, 1, 1e9 );
    const tiny = hairWeightValue( 1, 1e-9 );

    // ⚠️ The floor bounds the CURVE and not the product — `w(z,α) = α · max(1e-2, …)`, with α
    // outside the max. So a vanishing coverage really does produce a vanishing weight, and a first
    // draft of this check asserted the opposite (that 1e-9 of coverage would be lifted to 1e-10 by
    // the floor) and went red. The paper's floor exists to stop the DEPTH term underflowing, which
    // is a different hazard from a fragment that is genuinely almost absent.
    report(
        "the paper's clamps bound the depth curve, and alpha passes through them untouched",
        enormous === HAIR_WEIGHT_CEILING && Math.abs( tiny - 1e-9 ) < 1e-21,
        `range 1e9 at the front saturates to ${ enormous }, and an alpha of 1e-9 at the back gives ` +
            `${ tiny.toExponential( 2 ) } — alpha times the curve's own minimum of 1, not lifted to ` +
            `the ${ HAIR_WEIGHT_FLOOR } floor.`
    );

}

console.log( '\n--- Listing 4, factor by factor -------------------------------------------------\n' );

{
    const accum = hairAccumBlendMode();
    const weight = hairWeightBlendMode();

    // glBlendFuncSeparate(GL_ONE, GL_ONE, GL_ZERO, GL_ONE_MINUS_SRC_ALPHA)
    report(
        'the accumulation blend is Listing 4 exactly: ONE/ONE for rgb, ZERO/ONE_MINUS_SRC_ALPHA for a',
        accum.blending === CustomBlending
            && accum.blendSrc === OneFactor && accum.blendDst === OneFactor
            && accum.blendSrcAlpha === ZeroFactor && accum.blendDstAlpha === OneMinusSrcAlphaFactor
            && accum.blendEquation === AddEquation && accum.blendEquationAlpha === AddEquation,
        `src/dst ${ accum.blendSrc }/${ accum.blendDst }, srcA/dstA ${ accum.blendSrcAlpha }/${ accum.blendDstAlpha }. ` +
            'The alpha half is what turns three\'s fixed (0,0,0,1) clear into the revealage product, ' +
            'and it is the reason Listing 4 is buildable here and Listing 3 is not.'
    );

    report(
        'the weight blend is pure additive, and carries no separate alpha to get wrong',
        weight.blending === CustomBlending
            && weight.blendSrc === OneFactor && weight.blendDst === OneFactor
            && weight.blendSrcAlpha === null && weight.blendDstAlpha === null,
        `src/dst ${ weight.blendSrc }/${ weight.blendDst }, srcA/dstA ${ weight.blendSrcAlpha }/${ weight.blendDstAlpha }`
    );

    // Fresh objects per call. A shared `BlendMode` is stored by reference on the MRT node, so a
    // caller that mutated one would silently change every pass that had ever asked for it.
    report(
        'each call returns a fresh BlendMode, because the MRT node stores it by reference',
        hairAccumBlendMode() !== accum && hairWeightBlendMode() !== weight,
        'two calls, two objects'
    );

    // The revealage recurrence, run on the CPU over a stack of cards. This is the arithmetic the
    // alpha blend performs, and it is checked here because a wrong factor produces a groom that is
    // merely a little too solid — nobody would look at it and see a bug.
    const coverages = [ 0.42, 0.18, 0.65, 0.07, 0.31 ];
    let revealage = 1;                      // three's fixed clear for attachment i > 0

    for ( const alpha of coverages ) revealage = revealage * ( 1 - alpha );

    const expected = coverages.reduce( ( product, alpha ) => product * ( 1 - alpha ), 1 );

    // The literal is the real check and the reduction beside it is only a spelling of the loop, so
    // the literal is what caught a hand-derived 0.1177 in the first draft of this file. Keep both.
    report(
        'the alpha recurrence dst.a <- dst.a x (1 - src.a) from a clear of 1 is the revealage product',
        Math.abs( revealage - expected ) < 1e-12 && Math.abs( revealage - 0.106817 ) < 5e-6,
        `five cards of coverage ${ coverages.join( ', ' ) } leave ${ revealage.toFixed( 6 ) } of the ` +
            'background showing, so the composite mixes 89.3% hair over 10.7% face.'
    );

}

console.log( '\n--- the slab, in view space -----------------------------------------------------\n' );

{
    // A world-axis-aligned box is NOT view-axis-aligned, and taking its z extent directly
    // under-reports the slab at every angle except dead-on. That is every frame of the orbit this
    // item is gated on, so it is worth a known-answer check rather than a reading.
    const camera = new PerspectiveCamera( 32, 1, 0.05, 20 );
    const bounds = new Box3( new Vector3( - 0.1, - 0.1, - 0.1 ), new Vector3( 0.1, 0.1, 0.1 ) );
    const scratch = new Vector3();

    // Dead-on at 1 m: the slab is exactly the box's own depth, 0.9 to 1.1.
    camera.position.set( 0, 0, 1 );
    camera.lookAt( 0, 0, 0 );
    camera.updateMatrixWorld( true );
    camera.matrixWorldInverse.copy( camera.matrixWorld ).invert();

    const straight = viewDepthExtent( bounds, camera, scratch );

    // At 45 degrees the far corner is sqrt(2) x 0.1 further away, so the slab is wider by exactly
    // that — the quantity a naive world-space z extent would miss.
    camera.position.set( Math.SQRT1_2, 0, Math.SQRT1_2 );
    camera.lookAt( 0, 0, 0 );
    camera.updateMatrixWorld( true );
    camera.matrixWorldInverse.copy( camera.matrixWorld ).invert();

    const diagonal = viewDepthExtent( bounds, camera, scratch );

    report(
        'the view-space slab is exact dead-on and widens by sqrt(2) at 45 degrees',
        Math.abs( straight.near - 0.9 ) < 1e-6 && Math.abs( straight.far - 1.1 ) < 1e-6
            && Math.abs( ( diagonal.far - diagonal.near ) - 0.2 * Math.SQRT2 ) < 1e-6,
        `dead-on ${ straight.near.toFixed( 4 ) }..${ straight.far.toFixed( 4 ) } (depth ` +
            `${ ( straight.far - straight.near ).toFixed( 4 ) }), at 45 degrees depth ` +
            `${ ( diagonal.far - diagonal.near ).toFixed( 4 ) } against sqrt(2) x 0.2 = ` +
            `${ ( 0.2 * Math.SQRT2 ).toFixed( 4 ) }. A world-space z extent would report 0.2 at both.`
    );

}

// ---------------------------------------------------------------------------------------------
// The strong half — the real groom on a real GPU
// ---------------------------------------------------------------------------------------------

const WIDTH = 560;
const HEIGHT = 700;

/**
 * The hair mass on the subject's right, at the arm's fixed 34-degree azimuth. Stated as a rect
 * rather than derived, and it is only used for the MOTION statistic — the order statistic below is
 * whole-frame precisely so that no rect has to be argued about.
 */
const HAIR_BAND = { x: 320, y: 110, width: 180, height: 350 };

/** Frames kept from the orbit clip. 40 warm-up steps is well past TAAU's 31-frame Halton period. */
const MOTION_FRAMES = 60;
const MOTION_KEEP = Array.from( { length: 20 }, ( unused, index ) => 41 + index );

console.log( '\n--- draw-order dependence, which is the defect itself ---------------------------\n' );

let server = null;
let browser = null;

const order = {};
const motion = {};

try {

    server = await probe.startProbeServer( { port: 5189 } );
    browser = await probe.launchProbeBrowser();

    const plate = async ( query, frames, keep ) => {

        const shot = await probe.capturePlates( {
            browser, baseUrl: server.baseUrl, page: '/src/stage.html',
            query, width: WIDTH, height: HEIGHT, frames, keep, stepSeconds: 1 / 60
        } );

        if ( shot.errors.length > 0 ) throw new Error( `${ query }: ${ shot.errors.slice( 0, 2 ).join( ' | ' ) }` );

        return keep.map( ( index ) => shot.frames.get( index ) );

    };

    const ARMS = [ ...HAIR_OIT_MODES, 'defect' ];

    for ( const arm of ARMS ) {

        const suffix = arm === 'defect' ? 'wboit&oitdefect=material-blend' : arm;
        const still = `?hair=1&bare&oit=${ suffix }&orbit=0&w=${ WIDTH }&h=${ HEIGHT }`;

        const [ forward ] = await plate( still, 40, [ 40 ] );
        const [ reverse ] = await plate( `${ still }&cardorder=reverse`, 40, [ 40 ] );

        order[ arm ] = frameDifference( forward, reverse );

        // The motion clip is only worth taking for the four real arms; the defect exists to fail the
        // order check and nothing else.
        if ( arm !== 'defect' ) {

            const clip = await plate(
                `?hair=1&bare&oit=${ suffix }&orbit=0.25&w=${ WIDTH }&h=${ HEIGHT }`,
                MOTION_FRAMES, MOTION_KEEP
            );

            motion[ arm ] = clipStatistics( clip, HAIR_BAND );

        }

    }

} catch ( error ) {

    report( 'the groom came up on a real GPU', false, `it did not: ${ error.message }` );

}

if ( order.blend !== undefined && order.wboit !== undefined ) {

    for ( const [ arm, value ] of Object.entries( order ) ) {

        console.log( `      ${ arm.padEnd( 8 ) } rms ${ value.rms.toFixed( 4 ).padStart( 9 ) } cv   ` +
            `worst pixel ${ value.max.toFixed( 1 ).padStart( 6 ) } cv   ` +
            `${ value.overTwoPercent.toFixed( 3 ).padStart( 7 ) }% of pixels move by more than 2 cv` );

    }

    // A1 — the defect exists. Without this the rest of the file measures nothing: if naive blending
    // were already order independent on this groom there would be no item.
    report(
        'A1 naive alpha blending IS order dependent on this groom, which is the whole of 3.6',
        order.blend.rms > 5 && order.blend.overTwoPercent > 5,
        `reversing the triangle order moves the frame by ${ order.blend.rms.toFixed( 4 ) } code values ` +
            `RMS, up to ${ order.blend.max.toFixed( 1 ) } on the worst pixel, with ` +
            `${ order.blend.overTwoPercent.toFixed( 3 ) }% of the frame moving by more than 2. Same ` +
            'geometry, same camera, same lights — only the sequence.'
    );

    // A2 — the three candidate arms are not. The ceiling is 1 code value: below that a difference
    // cannot survive 8-bit quantisation of the plate, so it is not a picture anybody can see.
    for ( const arm of [ 'cutout', 'hash', 'wboit' ] ) {

        report(
            `A2 the ${ arm } arm is order INDEPENDENT — under 1 code value RMS`,
            order[ arm ].rms < 1,
            `${ order[ arm ].rms.toFixed( 4 ) } cv RMS against blend's ${ order.blend.rms.toFixed( 4 ) } — ` +
                `a ${ ( order.blend.rms / order[ arm ].rms ).toFixed( 0 ) }x reduction — with ` +
                `${ order[ arm ].overTwoPercent.toFixed( 3 ) }% of pixels over 2 cv.`
        );

    }

    // A3 — and the residue is the right SHAPE. `cutout` and `hash` decide per fragment with a depth
    // test, so their two orders should be bit-identical up to the temporal resolve's own dither;
    // `wboit` sums in fp16, and floating-point addition is not associative, so a handful of pixels
    // must differ and the rest must not. A wboit residue that was uniformly zero would mean the
    // accumulation is not accumulating.
    report(
        'A3 the residues have the right shape: a depth test is exact, an fp16 sum is not',
        order.cutout.max <= 2 && order.wboit.max > 2 && order.wboit.overTwoPercent < 0.5,
        `cutout's worst pixel moves ${ order.cutout.max.toFixed( 1 ) } cv and wboit's ` +
            `${ order.wboit.max.toFixed( 1 ) }, but only on ${ order.wboit.overTwoPercent.toFixed( 3 ) }% ` +
            'of the frame — reassociation of a half-float sum, not a sorting artefact.'
    );

    // A4 — THE RED PROOF. The blend modes moved to the material, which is where they look like they
    // belong and where three never reads them.
    report(
        'A4 RED PROOF: with the blend modes on material.mrtNode the wboit arm is order dependent again',
        order.defect.rms > 5 && order.defect.rms > 50 * order.wboit.rms,
        `?oitdefect=material-blend takes the wboit arm from ${ order.wboit.rms.toFixed( 4 ) } cv RMS to ` +
            `${ order.defect.rms.toFixed( 4 ) } — ${ ( order.defect.rms / order.wboit.rms ).toFixed( 0 ) }x — ` +
            `with ${ order.defect.overTwoPercent.toFixed( 3 ) }% of the frame moving. ` +
            'WebGPUPipelineUtils reads renderObject.context.mrt, which is the PASS\'s; the material\'s ' +
            'table is never consulted and the attachments get no blending at all.'
    );

}

console.log( '\n--- under motion, because a still frame cannot show popping ----------------------\n' );

if ( motion.wboit !== undefined ) {

    for ( const [ arm, value ] of Object.entries( motion ) ) {

        console.log( `      ${ arm.padEnd( 8 ) } per-pixel sigma ${ value.sigma.toFixed( 4 ).padStart( 8 ) } cv   ` +
            `frame-to-frame rms median ${ value.median.toFixed( 4 ) } max ${ value.max.toFixed( 4 ) }   ` +
            `spike ${ ( value.max / value.median ).toFixed( 2 ) }x` );

    }

    // B1 — the accumulation arm is the most stable thing in the comparison. This is the measurement
    // that says WBOIT is worth having even though it is the one this project cannot afford: it is
    // the quality reference the cheap arms are judged against.
    const worstOther = Math.max( motion.blend.sigma, motion.cutout.sigma, motion.hash.sigma );

    report(
        'B1 wboit is the most temporally stable arm under a 0.25 deg/frame orbit',
        motion.wboit.sigma < worstOther,
        `per-pixel sigma over the hair band, 20 converged frames: wboit ${ motion.wboit.sigma.toFixed( 4 ) }, ` +
            `blend ${ motion.blend.sigma.toFixed( 4 ) }, hash ${ motion.hash.sigma.toFixed( 4 ) }, ` +
            `cutout ${ motion.cutout.sigma.toFixed( 4 ) } code values.`
    );

    // B2 — and the arm 3.6 originally implied, alpha testing, is the WORST. That is 3.12's finding
    // arriving on hair: a binary coverage decision on a card silhouette crawls, and the temporal
    // resolve cannot integrate what it is not given.
    report(
        'B2 the cutout arm is the LEAST stable, which is the silhouette crawling',
        motion.cutout.sigma > motion.hash.sigma && motion.cutout.sigma > motion.wboit.sigma,
        `cutout ${ motion.cutout.sigma.toFixed( 4 ) } against hash ${ motion.hash.sigma.toFixed( 4 ) } ` +
            `and wboit ${ motion.wboit.sigma.toFixed( 4 ) } — ` +
            `${ ( motion.cutout.sigma / motion.wboit.sigma ).toFixed( 2 ) }x the accumulation arm. ` +
            'A binary alpha test is the one decision a temporal filter cannot soften.'
    );

    // B3 — nothing POPS. A pop is a single frame that moves far more than its neighbours, so the
    // statistic is the ratio of the worst frame-to-frame step to the median one. An orbit at a
    // constant rate has a nearly constant honest step, so a large ratio is an artefact.
    const spikes = Object.entries( motion ).map( ( [ arm, value ] ) => ( { arm, ratio: value.max / value.median } ) );
    const worstSpike = spikes.reduce( ( worst, row ) => row.ratio > worst.ratio ? row : worst );

    report(
        'B3 no arm pops: the worst frame-to-frame step is within 2x of the median one',
        worstSpike.ratio < 2,
        `worst is ${ worstSpike.arm } at ${ worstSpike.ratio.toFixed( 2 ) }x — ` +
            spikes.map( ( row ) => `${ row.arm } ${ row.ratio.toFixed( 2 ) }x` ).join( ', ' ) +
            '. The camera moves at a constant rate, so a constant step is the honest answer and a ' +
            'spike would be a card changing places.'
    );

}

await browser?.close();
await server?.close();

// ---------------------------------------------------------------------------------------------
// statistics
// ---------------------------------------------------------------------------------------------

/**
 * Whole-frame difference between two plates, in 8-bit code values.
 *
 * Whole-frame and not a rect: the face, the shoulders and the background are identical between the
 * two draw orders by construction, so they contribute exactly zero and dilute nothing that matters.
 * Choosing a rect would be choosing where to look for the artefact.
 */
function frameDifference( a, b ) {

    let sumSquares = 0;
    let count = 0;
    let max = 0;
    let overTwo = 0;

    for ( let y = 0; y < a.height; y ++ ) {

        for ( let x = 0; x < a.width; x ++ ) {

            const difference = probe.codeValueAt( a, x, y ) - probe.codeValueAt( b, x, y );
            const magnitude = Math.abs( difference );

            sumSquares += difference * difference;
            count += 1;

            if ( magnitude > max ) max = magnitude;
            if ( magnitude > 2 ) overTwo += 1;

        }

    }

    return { rms: Math.sqrt( sumSquares / count ), max, overTwoPercent: ( 100 * overTwo ) / count };

}

/**
 * Per-pixel temporal sigma over a clip, plus the frame-to-frame RMS series.
 *
 * Welford, not a sum of squares: the signal is a variance of order a few code values riding on a
 * mean of order a hundred, and a naive accumulator ends by subtracting two nearly equal large
 * numbers — the low bits it cancels away ARE the answer. `tools/critic/heatmap.mjs` makes the same
 * choice for the same reason and says so at length.
 */
function clipStatistics( frames, rect ) {

    let sigmaSum = 0;
    let pixels = 0;

    for ( let y = rect.y; y < rect.y + rect.height; y ++ ) {

        for ( let x = rect.x; x < rect.x + rect.width; x ++ ) {

            let mean = 0;
            let m2 = 0;
            let seen = 0;

            for ( const frame of frames ) {

                seen += 1;

                const value = probe.codeValueAt( frame, x, y );
                const delta = value - mean;

                mean += delta / seen;
                m2 += delta * ( value - mean );

            }

            sigmaSum += Math.sqrt( m2 / seen );
            pixels += 1;

        }

    }

    const series = [];

    for ( let index = 1; index < frames.length; index ++ ) {

        series.push( probe.temporalRms( frames[ index - 1 ], frames[ index ], rect ) );

    }

    series.sort( ( a, b ) => a - b );

    return {
        sigma: sigmaSum / pixels,
        median: series[ Math.floor( series.length / 2 ) ],
        max: series[ series.length - 1 ]
    };

}

console.log( `\n${ failures === 0 ? 'PASS' : 'FAIL' }: ${ checks - failures }/${ checks } checks green\n` );

process.exitCode = failures === 0 ? 0 : 1;
