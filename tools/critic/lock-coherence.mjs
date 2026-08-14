#!/usr/bin/env node
//
// lock-coherence.mjs — is there ORIENTED, SPATIALLY-CORRELATED structure at lock scale, or is the
// lock band just full of noise? One operator, four numbers, and every one of them predicted on
// paper before the tool is pointed at a plate.
//
// ## Why this exists, and why `band-power.mjs` could not answer it
//
// Round 24 scored lock-scale structure with band POWER and the score was wrong — not misread,
// WRONG FOR THE QUESTION. `docs/CHECKPOINT.md` §7: the existing per-fragment strand jitter already
// delivers **13.69% of the plate's mean into the lock band**, because one-dimensional value noise
// is flat below its own lattice frequency. The lock band was never empty. It was already full, of
// noise. So a real structural change and a wash of dye deposit the same power and read the same,
// and a blind judge could not tell round 24's two arms apart at 1:1, 4x or 5x.
//
// `band-power.mjs` says so itself, in its own §6 clause: *"It cannot tell COHERENT structure from
// NOISE in the same band."* The judges' words were more precise than the hypothesis derived from
// them — *"per-pixel noise standing in for structure"* is a complaint about **COHERENCE, NOT
// POWER**. This file is the operator for the half band-power cannot see.
//
// ## The operator
//
// A **band-limited structure tensor**. Three stages, each of which is a linear filter with a
// closed-form response, so the reading on any grating is arithmetic before it is a measurement:
//
//   1. BAND-LIMIT to lock scale.  `band = box²(I, wFine) − box( box²(I, wFine), wCoarse )`
//      Gain on a sinusoid of period T is exactly `G(wFine,1/T)² · ( 1 − G(wCoarse,1/T) )`, with
//      `G` the Dirichlet kernel `sin(π f w)/(w sin(π f))` — `band-power.mjs`'s own `boxGain`.
//      🚩 The FINE box is applied TWICE and that is the scale selectivity, not a refinement. A
//      single fine box leaks a 4.8 px filament grating into the lock band at gain 0.119454 against
//      0.830304 for a 53 px lock — 6.9508×, which is not a separation. Applied twice the leak is
//      0.014152 — **54.6314×**. The COARSE box is applied ONCE, deliberately: squaring it widens
//      it in space, which makes it *worse* at rejecting the mass band, not better.
//   2. GRADIENT by central difference, `(I(x+1) − I(x−1)) / 2`.
//   3. STRUCTURE TENSOR: `J = box( [gx² , gxgy ; gxgy , gy²] , wTensor )`, then aggregate over the
//      mask. Coherent oriented structure makes `J` rank-1; isotropic noise makes it isotropic.
//
// Aggregated over the measured mask (sums, not per-pixel ratios — a per-pixel anisotropy is 0/0
// wherever the tensor vanishes and would be dominated by whichever pixels happened to be flat):
//
//   coherence   = Σ √( (Jxx−Jyy)² + 4Jxy² ) / Σ (Jxx+Jyy)      = Σ(λ1−λ2)/Σ(λ1+λ2), in [0,1]
//   alignment   = |( Σ(Jxx−Jyy) , Σ2Jxy )| / Σ (Jxx+Jyy)       do the local orientations AGREE?
//   orientation = ½·atan2( Σ2Jxy , Σ(Jxx−Jyy) ) + 90°          the direction the RIDGES run
//   coherentLock = coherence × rms(band) / mean       🔴 BLIND — band contrast, NOT structure. See below.
//
// `coherence` and `alignment` differ in exactly one way and it matters on a head: noise contributes
// a POSITIVE bias to `coherence` (every pixel's λ1−λ2 is ≥ 0, so nothing cancels) and contributes
// approximately NOTHING to `alignment` (the double-angle vectors cancel). A groom whose flow turns
// across the temple is locally coherent and globally unaligned, which is the correct description of
// hair; a single flat grating is both.
//
// ## 🚩 WHAT THIS OPERATOR CANNOT SEE, STATED BEFORE ANY READING IS QUOTED
//
// **1. `coherence` ALONE IS SCALE-BLIND, and that is arithmetic rather than a weakness to argue
// about.** A pure sinusoid of ANY period survives the band-pass as a pure sinusoid of some smaller
// amplitude, and the structure tensor of a plane wave is exactly rank-1 at every pixel whatever the
// amplitude — so a 4.8 px filament grating reads `coherence = 1.000` at lock scale, identically to
// a 53 px lock. **Anisotropy is a normalised ratio and normalised ratios cannot count photons.**
// The scale-selective number is `coherentLock`, which multiplies the ratio by the band amplitude
// the ratio was measured on. §6 of the selftest is that measurement: same coherence, 54.6314× apart
// in `coherentLock`. Quote both or quote neither.
//
// 🔴 **AND `coherentLock` IS ITSELF A BLIND STATISTIC. DO NOT USE IT TO SCORE A CHANGE.** This was
// found by R25's adversarial verifier, after this file had already been used to declare a positive
// result. Because it is `coherence × rms(band) / mean`, the amplitude factor carries it, and it
// **RISES ON PURELY ISOTROPIC NOISE**: injecting orientation-free lock-scale noise into the real
// `captures/hair-r24-before` plate through this same mask gives ×1.0255 at ±3%, ×1.0491 at ±6%,
// ×1.0897 at ±12%, ×1.1312 at ±20% — while `coherence` itself FALLS (×0.9544 at ±12%). R25's
// shipped term read ×1.0212 / ×1.0502 and its bound read ×1.1270 / ×1.1920, so **every R25 reading
// sits inside the range that noise with no orientation whatsoever produces on the same pixels.**
//
// The eighth structurally-blind statistic in this project, and the first one caught in the same
// round it was written. It was written to replace band power precisely because band power could not
// tell structure from noise — and it reintroduced the same flaw by multiplying the ratio back by
// the amplitude. **A normalised ratio cannot count photons, but multiplying it by photons does not
// make it a structure measure; it makes it a contrast measure with a ratio attached.**
//
// `coherence`, `alignment` and `orientationDeg` are still meaningful and still pass their own
// arithmetic validations. Score with those, and quote `coherentLock` only as the band amplitude it
// actually is.
//
// **2. IT CANNOT TELL ORIENTED NOISE FROM AN ORIENTED GRATING.** One-dimensional value noise — the
// strand jitter this project already ships — is constant along one axis by construction, so its
// tensor is rank-1 and its `coherence` is ~1. Measured in §5c. The operator separates ISOTROPIC
// noise from oriented structure, which is what the validation asks of it, and it does not separate
// a streak from a lock.
//    🎯 There is a mechanism that would, and it is stated here as a NEXT STEP and not as a claim:
//    a lock's brightness varies ACROSS the flow (gradient across, ridges along), while jitter along
//    the strand parameter varies ALONG the flow (gradient along, ridges across). **The two are 90°
//    apart**, and `orientation` is already reported per band — run this tool twice, once at lock
//    widths and once at filament widths, and the angle between them is the discriminator. Nothing
//    in this round measures that on a real plate, so nothing in this round claims it.
//
// **3. A SMOOTH SHADING RAMP IS COHERENT.** The lock band keeps 24.7% of a 300 px component (§8),
// and a 300 px luminance ramp across the mass is as rank-1 as anything gets. So an ABSOLUTE
// `coherence` reading on a real plate is not evidence of locks — the same rule `band-power.mjs`
// arrived at for its own absolute readings. **Only an A/B between two plates differing in one
// expression is attributable.**
//
// **4. THE WIDTHS ARE A PARAMETER AND A READING WITHOUT THEM BESIDE IT IS MEANINGLESS.** The
// defaults 11/121/53 are the groom's own cell: `hair_cards.py`'s `LOCK_COUNT` is 16 on a mass of
// horizontal radius 88.1 mm, so a lock is 34.6 mm, and at the portrait plate's 0.652 mm/px that is
// **53 px** — coarser than a card (44 px). Same derivation `band-power.mjs` uses for 11/121.
//
// ## Usage
//
//   node tools/critic/lock-coherence.mjs before.png after.png \
//        --unit captures/…-mask-unit/portrait.png --zero captures/…-mask-zero/portrait.png
//
//   --fine N --coarse N --tensor N   re-band the operator (filament scale is roughly 3 / 15 / 15)
//   --domain linear|encoded          which luma. Default linear, the space a shader multiplies in.
//
// `lockCoherence()` is the API a gate asserts on. `tools/critic/lock-coherence.selftest.mjs` is the
// gate on this file and every number in it is predicted from the Dirichlet kernel first.
//
// ## 🎯 TAGGED CLAIMS — the five numbers this comment got wrong once, now checked by a gate
//
// R25 shipped this header with **five wrong numbers in it** — 0.110 / 0.823 / 7.5 / 0.0139 / 55.5
// against the true values below — while the selftest two directories away printed the right ones on
// every run. `docs/CHECKPOINT.md` §8, fourth instance of the same failure. The lines below name each
// number and the command that produces it, and `tools/quoted-numbers.mjs` runs that command and
// compares. A number here that drifts from its producer now turns the SUITE red.
//
// @claim 0.830304 :: node tools/critic/lock-coherence.selftest.mjs :: single fine box: 53 px #2
// @claim 0.119454 :: node tools/critic/lock-coherence.selftest.mjs :: single fine box: 53 px #4
// @claim 6.9508 :: node tools/critic/lock-coherence.selftest.mjs :: single fine box: 53 px #5
// @claim 0.014152 :: node tools/critic/lock-coherence.selftest.mjs :: gain at 53 px #4
// @claim 54.6314 :: node tools/critic/lock-coherence.selftest.mjs :: gain at 53 px #5

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// 🚩 fileURLToPath, never string surgery on `import.meta.url`: this repository's own path carries a
// space and a non-ASCII character.
const HERE = path.dirname( fileURLToPath( import.meta.url ) );

const { decodePng } = await import( path.join( HERE, 'png.mjs' ) );
const { boxGain, lumaField, solidHairMask } = await import( path.join( HERE, 'band-power.mjs' ) );

/**
 * The three widths that define the operator, and the mask erosion that keeps every REPORTED pixel's
 * tensor window inside the mask.
 *
 * 🚩 `erode` covers the TENSOR window and the gradient stencil — 27 px — and deliberately NOT the
 * band-pass support, which reaches 70 px (5 + 5 for `box²(11)`, then 60 for `box(121)`). Covering
 * everything would need 97 px of erosion and the portrait's solid-hair mask is measured EMPTY well
 * before that: 256,106 px raw → 120,069 at 20 → 46,146 at 40 → 4,779 at 60 → **0 at 87**. The
 * band-pass is protected differently, by `fillOutsideMask` below, and its residual is measured in
 * §7 of the selftest rather than asserted away.
 */
export const COHERENCE_DEFAULTS = {
    wFine: 11,
    wCoarse: 121,
    wTensor: 53
};

/**
 * 🚩 THE `coherence` NOISE FLOOR AT THE DEFAULT WIDTHS. A `coherence` reading below this is
 * indistinguishable from isotropic noise, and one at 0.20 is NOT "0.20 of the way to coherent" —
 * it is barely off the floor.
 *
 * ⚠️ This is a number in a comment, which `docs/CHECKPOINT.md` §7 records as a failure mode of this
 * repository ("numbers in a justification comment are claims and nothing in the tree checks them").
 * So it is checked: `lock-coherence.selftest.mjs` §3 re-derives it from `noiseFloor()` on every run
 * and goes red if it drifts. Change a width and this constant is wrong until the selftest says
 * otherwise — the floor falls roughly as 1/wTensor (measured 0.3079 / 0.1715 / 0.0899 / 0.0619 at
 * wTensor 27 / 53 / 105 / 159, i.e. ×1.80, ×1.91, ×1.45 against width ratios ×1.96, ×1.98, ×1.51).
 *
 * 🎯 A STOCHASTIC CLAIM, SO ITS TOLERANCE IS THE PRODUCER'S OWN SCATTER RATHER THAN A NUMBER
 * CHOSEN HERE. `±#2` reads the second number on the matched line — the ± the selftest prints beside
 * the floor over its eight seeds — so this tag cannot be made to pass by widening it.
 * @claim 0.1715 ±#2 :: node tools/critic/lock-coherence.selftest.mjs :: coherence floor #1
 *
 * ⚠️ The other three floors quoted above (0.3079, 0.0899, 0.0619) are NOT tagged: the selftest's
 * §3c line prints 0.3093 / 0.1728 / 0.0911 from a different sitting and carries no scatter of its
 * own, so checking them would need a tolerance invented here — which is the failure mode one level
 * down from the one being fixed. They stay unchecked and are counted as such.
 */
export const DEFAULT_NOISE_FLOOR = 0.1715;

/** The erosion a given tensor width requires: its own radius, plus one for the gradient stencil. */
export function erosionFor( wTensor ) {

    return ( wTensor - 1 ) / 2 + 1;

}

/**
 * The band-pass's exact gain on a discrete plane wave of the given period, travelling at the given
 * angle from the +x axis.
 *
 * A 2-D box is separable, so its gain on a plane wave is `G(w,f_x)·G(w,f_y)` — hence
 * `[Gf(f_x)Gf(f_y)]² · ( 1 − Gc(f_x)Gc(f_y) )`, with `G` the Dirichlet kernel imported from
 * `band-power.mjs` so the two instruments cannot disagree about a box filter.
 *
 * 🚩 THE ANGLE IS NOT COSMETIC. An AXIS-ALIGNED wave is the WORST CASE for out-of-band leak,
 * because `f_y = 0` and the vertical half of the filter passes it untouched. A 4.8 px grating leaks
 * at 0.01415 along an axis and at 1.05e-6 at 30°. Every selectivity claim in the selftest is quoted
 * at angle 0 for that reason.
 *
 * Exported so a caller can state what a synthetic plate MUST read before running the tool on it.
 */
export function lockBandGain( period, angleDeg = 0, settings = {} ) {

    const { wFine, wCoarse } = { ...COHERENCE_DEFAULTS, ...settings };

    const radians = angleDeg * Math.PI / 180;
    const frequencyX = Math.cos( radians ) / period;
    const frequencyY = Math.sin( radians ) / period;

    const fine = boxGain( wFine, frequencyX ) * boxGain( wFine, frequencyY );
    const coarse = boxGain( wCoarse, frequencyX ) * boxGain( wCoarse, frequencyY );

    return fine * fine * ( 1 - coarse );

}

/**
 * A separable box blur with RUNNING SUMS, edge-clamped — O(pixels) instead of O(pixels × width).
 *
 * ⚠️ This duplicates `band-power.mjs`'s `boxBlur` on purpose and the duplication is paid for: a
 * 121-wide box over 720×900 is 157 million adds in the naive form, and this operator applies four
 * such passes per plate. §0 of the selftest asserts the two agree to 1e-12 on a real field, so the
 * reference implementation stays the definition and this one stays an optimisation of it.
 */
export function boxBlurRunning( field, width, height, boxWidth ) {

    if ( boxWidth % 2 !== 1 ) throw new Error( `box width must be odd, got ${ boxWidth }` );

    const radius = ( boxWidth - 1 ) / 2;
    const horizontal = new Float64Array( width * height );
    const output = new Float64Array( width * height );

    for ( let y = 0; y < height; y ++ ) {

        const row = y * width;
        let sum = 0;

        for ( let offset = - radius; offset <= radius; offset ++ ) {

            sum += field[ row + Math.min( width - 1, Math.max( 0, offset ) ) ];

        }

        horizontal[ row ] = sum / boxWidth;

        // The window is the multiset { clamp(i) : i ∈ [x−r, x+r] } and clamp is monotone, so
        // stepping x by one removes exactly clamp(x−1−r) and adds exactly clamp(x+r).
        for ( let x = 1; x < width; x ++ ) {

            sum += field[ row + Math.min( width - 1, x + radius ) ];
            sum -= field[ row + Math.max( 0, x - 1 - radius ) ];
            horizontal[ row + x ] = sum / boxWidth;

        }

    }

    for ( let x = 0; x < width; x ++ ) {

        let sum = 0;

        for ( let offset = - radius; offset <= radius; offset ++ ) {

            sum += horizontal[ Math.min( height - 1, Math.max( 0, offset ) ) * width + x ];

        }

        output[ x ] = sum / boxWidth;

        for ( let y = 1; y < height; y ++ ) {

            sum += horizontal[ Math.min( height - 1, y + radius ) * width + x ];
            sum -= horizontal[ Math.max( 0, y - 1 - radius ) * width + x ];
            output[ y * width + x ] = sum / boxWidth;

        }

    }

    return output;

}

/**
 * Chebyshev erosion of a binary mask, SEPARABLE and O(pixels).
 *
 * ⚠️ Duplicates `band-power.mjs`'s `erodeMask` for the same reason `boxBlurRunning` duplicates its
 * `boxBlur`, and the reason is a measurement rather than a preference: the reference implementation
 * scans the whole (2r+1)² square per pixel, which for the erosion of 97 the synthetic cases need is
 * 2.5e10 comparisons on a 720×900 field. Its early break rescues a sparse mask and does nothing for
 * a full one. This runs a horizontal pass then a vertical one, keeping a pixel only when every
 * sample in its 1-D window is set and the window is entirely inside the frame — identical
 * semantics, asserted against the reference in §0 of the selftest.
 */
export function erodeMaskSeparable( mask, width, height, radius ) {

    if ( radius <= 0 ) return mask;

    const horizontal = new Uint8Array( width * height );
    const eroded = new Uint8Array( width * height );
    const span = 2 * radius + 1;

    for ( let y = 0; y < height; y ++ ) {

        const row = y * width;
        let set = 0;

        for ( let x = 0; x <= Math.min( width - 1, radius ); x ++ ) set += mask[ row + x ];

        for ( let x = 0; x < width; x ++ ) {

            if ( x > 0 ) {

                const entering = x + radius;
                const leaving = x - 1 - radius;

                if ( entering < width ) set += mask[ row + entering ];
                if ( leaving >= 0 ) set -= mask[ row + leaving ];

            }

            const inside = x - radius >= 0 && x + radius < width;
            horizontal[ row + x ] = inside && set === span ? 1 : 0;

        }

    }

    for ( let x = 0; x < width; x ++ ) {

        let set = 0;

        for ( let y = 0; y <= Math.min( height - 1, radius ); y ++ ) set += horizontal[ y * width + x ];

        for ( let y = 0; y < height; y ++ ) {

            if ( y > 0 ) {

                const entering = y + radius;
                const leaving = y - 1 - radius;

                if ( entering < height ) set += horizontal[ entering * width + x ];
                if ( leaving >= 0 ) set -= horizontal[ leaving * width + x ];

            }

            const inside = y - radius >= 0 && y + radius < height;
            eroded[ y * width + x ] = inside && set === span ? 1 : 0;

        }

    }

    return eroded;

}

/**
 * Replaces every pixel outside the mask with the mask's own mean, and returns the filled field.
 *
 * 🚩 THIS IS THE MASK BOUNDARY POLICY AND IT IS A CHOICE. The band-pass reaches 70 px, the full
 * support is 97, and the portrait's hair mask is measured empty at 87. The alternatives
 * were: (a) clamp, which is what a plain filter does — the silhouette then enters the band as a
 * step edge, and a step edge is both broadband and perfectly rank-1, i.e. it is the single worst
 * thing that can happen to a coherence measure; (b) shrink the widths until erosion fits, which
 * moves the band off the groom's own 53 px cell; (c) this.
 *
 * Filling with the interior mean makes the low-pass see NO step at the silhouette. The residual is
 * that the coarse box, within 60 px of the boundary, is pulled toward the mean — a smooth, slowly
 * varying error whose gradient is small. §7 of the selftest measures it: a grating read inside a
 * mask against the same grating read full-frame.
 */
export function fillOutsideMask( field, mask, width, height ) {

    let sum = 0;
    let count = 0;

    for ( let index = 0; index < mask.length; index ++ ) {

        if ( mask[ index ] === 0 ) continue;
        sum += field[ index ];
        count += 1;

    }

    if ( count === 0 ) throw new Error( 'lock-coherence: the mask is empty' );

    const mean = sum / count;
    const filled = new Float64Array( width * height );

    for ( let index = 0; index < filled.length; index ++ ) {

        filled[ index ] = mask[ index ] === 1 ? field[ index ] : mean;

    }

    return { filled, mean, count };

}

/** Stage 1: the lock band. `box²(I, wFine) − box( box²(I, wFine), wCoarse )`. */
export function lockBandField( field, width, height, settings = {} ) {

    const { wFine, wCoarse } = { ...COHERENCE_DEFAULTS, ...settings };

    const once = boxBlurRunning( field, width, height, wFine );
    const fine = boxBlurRunning( once, width, height, wFine );
    const coarse = boxBlurRunning( fine, width, height, wCoarse );

    const band = new Float64Array( field.length );
    for ( let index = 0; index < band.length; index ++ ) band[ index ] = fine[ index ] - coarse[ index ];

    return band;

}

/**
 * Stages 2 and 3: central-difference gradient, then the smoothed outer product.
 *
 * ⚠️ The central difference has transfer `i·sin(2πf)` where the true derivative has `i·2πf`, so a
 * grating's recovered ANGLE carries a bias of `atan2( sin k_y , sin k_x ) − atan2( k_y , k_x )`.
 * At the 53 px lock and 30° that is **0.029°** — computed, not assumed, and asserted against the
 * closed form in §4 of the selftest rather than hidden inside a tolerance.
 */
export function structureTensor( band, width, height, wTensor ) {

    const gxx = new Float64Array( band.length );
    const gxy = new Float64Array( band.length );
    const gyy = new Float64Array( band.length );

    for ( let y = 0; y < height; y ++ ) {

        for ( let x = 0; x < width; x ++ ) {

            const index = y * width + x;

            const left = y * width + Math.max( 0, x - 1 );
            const right = y * width + Math.min( width - 1, x + 1 );
            const up = Math.max( 0, y - 1 ) * width + x;
            const down = Math.min( height - 1, y + 1 ) * width + x;

            const gx = ( band[ right ] - band[ left ] ) / 2;
            const gy = ( band[ down ] - band[ up ] ) / 2;

            gxx[ index ] = gx * gx;
            gxy[ index ] = gx * gy;
            gyy[ index ] = gy * gy;

        }

    }

    return {
        jxx: boxBlurRunning( gxx, width, height, wTensor ),
        jxy: boxBlurRunning( gxy, width, height, wTensor ),
        jyy: boxBlurRunning( gyy, width, height, wTensor )
    };

}

/**
 * THE OPERATOR.
 *
 * @param {Object} plate
 * @param {Float64Array|Float32Array} plate.field - one scalar per pixel, any units.
 * @param {number} plate.width
 * @param {number} plate.height
 * @param {?Uint8Array} [plate.mask] - 1 where the field is the subject. Defaults to everything.
 * @param {Object} [settings] - overrides over `COHERENCE_DEFAULTS`, plus `erode`.
 * @returns {{ coherence:?number, alignment:?number, orientationDeg:?number, bandRms:number,
 *   coherentLock:?number, mean:number, count:number, trace:number, widths:Object }}
 *   `coherence`, `alignment`, `orientationDeg` and `coherentLock` are **null when the tensor is
 *   identically zero** — a flat field has no orientation and reporting 0 would be a claim the
 *   pixels do not support. See §2 of the selftest.
 */
export function lockCoherence( plate, settings = {} ) {

    const options = { ...COHERENCE_DEFAULTS, ...settings };
    const erode = settings.erode ?? erosionFor( options.wTensor );
    const { field, width, height } = plate;

    const mask = plate.mask ?? new Uint8Array( width * height ).fill( 1 );
    const measured = erode > 0 ? erodeMaskSeparable( mask, width, height, erode ) : mask;

    const { filled, mean } = fillOutsideMask( field, mask, width, height );
    const band = lockBandField( filled, width, height, options );
    const { jxx, jxy, jyy } = structureTensor( band, width, height, options.wTensor );

    let trace = 0;
    let anisotropy = 0;
    let vectorX = 0;
    let vectorY = 0;
    let bandSquares = 0;
    let fieldSum = 0;
    let count = 0;

    for ( let index = 0; index < measured.length; index ++ ) {

        if ( measured[ index ] === 0 ) continue;

        const difference = jxx[ index ] - jyy[ index ];
        const cross = 2 * jxy[ index ];

        trace += jxx[ index ] + jyy[ index ];
        anisotropy += Math.sqrt( difference * difference + cross * cross );
        vectorX += difference;
        vectorY += cross;

        bandSquares += band[ index ] * band[ index ];
        fieldSum += field[ index ];
        count += 1;

    }

    if ( count === 0 ) throw new Error( 'lock-coherence: the eroded mask is empty. Widen it or erode less.' );

    const measuredMean = fieldSum / count;
    const bandRms = Math.sqrt( bandSquares / count );

    if ( trace <= 0 ) {

        return {
            coherence: null, alignment: null, orientationDeg: null, coherentLock: null,
            bandRms, mean: measuredMean, maskMean: mean, count, trace,
            widths: { wFine: options.wFine, wCoarse: options.wCoarse, wTensor: options.wTensor, erode }
        };

    }

    const coherence = anisotropy / trace;

    // The ridge direction, i.e. the direction the STRUCTURE runs, which is the gradient direction
    // turned a quarter turn. Angles are measured from +x toward +y, and +y is DOWN in image space.
    const gradientDeg = 0.5 * Math.atan2( vectorY, vectorX ) * 180 / Math.PI;
    const orientationDeg = ( ( gradientDeg + 90 ) % 180 + 180 ) % 180;

    return {
        coherence,
        alignment: Math.hypot( vectorX, vectorY ) / trace,
        orientationDeg,
        coherentLock: coherence * bandRms / Math.max( Math.abs( measuredMean ), 1e-12 ),
        bandRms,
        mean: measuredMean,
        maskMean: mean,
        count,
        trace,
        widths: { wFine: options.wFine, wCoarse: options.wCoarse, wTensor: options.wTensor, erode }
    };

}

// --- white noise, in closed form ------------------------------------------------------------------

/** Discrete convolution of two 1-D kernels. */
function convolve1d( first, second ) {

    const output = new Float64Array( first.length + second.length - 1 );

    for ( let a = 0; a < first.length; a ++ ) {

        for ( let b = 0; b < second.length; b ++ ) output[ a + b ] += first[ a ] * second[ b ];

    }

    return output;

}

/**
 * 🎯 THE FACTOR BY WHICH THE BAND-PASS SHRINKS WHITE NOISE, in closed form.
 *
 * The band is `h = hFine − hCoarse` with `hFine = a ⊗ a` and `hCoarse = b ⊗ b` separable and
 * square, so `Σ h² = (Σa²)² − 2(Σab)² + (Σb²)²` — the cross term collapses because
 * `⟨a⊗a, b⊗b⟩ = (Σ ab)²`. For white noise of standard deviation σ the band's RMS is therefore
 * `σ · √(Σh²)` exactly, with no simulation anywhere.
 *
 * This is what lets the selftest SET a noise amplitude to hit a stated band power rather than
 * tuning one until it looks right.
 */
export function whiteNoiseBandFactor( settings = {} ) {

    const { wFine, wCoarse } = { ...COHERENCE_DEFAULTS, ...settings };

    const box = ( width ) => new Float64Array( width ).fill( 1 / width );

    const a = convolve1d( box( wFine ), box( wFine ) );
    const b = convolve1d( a, box( wCoarse ) );

    let aa = 0;
    let bb = 0;
    let ab = 0;

    // `b` is `a` padded and smeared, and `convolve1d` centres both on their own supports, so the
    // shared centre is at (length−1)/2 of each.
    const shift = ( b.length - a.length ) / 2;

    for ( let index = 0; index < a.length; index ++ ) {

        aa += a[ index ] * a[ index ];
        ab += a[ index ] * b[ index + shift ];

    }

    for ( let index = 0; index < b.length; index ++ ) bb += b[ index ] * b[ index ];

    return Math.sqrt( aa * aa - 2 * ab * ab + bb * bb );

}

/** mulberry32 — a seeded uniform generator, so every noise reading in this file is reproducible. */
export function mulberry32( seed ) {

    let state = seed >>> 0;

    return function random() {

        state = ( state + 0x6D2B79F5 ) >>> 0;
        let value = Math.imul( state ^ ( state >>> 15 ), 1 | state );
        value = ( value + Math.imul( value ^ ( value >>> 7 ), 61 | value ) ) ^ value;

        return ( ( value ^ ( value >>> 14 ) ) >>> 0 ) / 4294967296;

    };

}

/** Gaussian white noise about `offset`, Box–Muller on `mulberry32`. Isotropic by construction. */
export function whiteNoiseField( width, height, sigma, offset, seed ) {

    const random = mulberry32( seed );
    const field = new Float64Array( width * height );

    for ( let index = 0; index < field.length; index += 2 ) {

        const radius = Math.sqrt( - 2 * Math.log( Math.max( random(), 1e-12 ) ) );
        const angle = 2 * Math.PI * random();

        field[ index ] = offset + sigma * radius * Math.cos( angle );
        if ( index + 1 < field.length ) field[ index + 1 ] = offset + sigma * radius * Math.sin( angle );

    }

    return { field, width, height };

}

/**
 * 🎯 THE NOISE FLOOR OF `coherence`, WITHOUT WHICH A `coherence` READING CANNOT BE INTERPRETED.
 *
 * `coherence` sums a quantity that is non-negative at every pixel, so isotropic noise does not
 * cancel out of it — it biases it UPWARD, and the bias is large at lock scale for a reason that is
 * geometry rather than a defect: a `wTensor`-wide window laid over noise that has been band-limited
 * to a ~53 px wavelength contains only a handful of independent blobs, and a handful of blobs is
 * locally oriented. **The floor is a property of the widths, not of the plate**, so it is measured
 * here, from isotropic Gaussian noise, at the same widths the plate will be read with.
 *
 * ⚠️ The `coherence` floor does NOT depend on how many pixels are measured (it is a mean of
 * per-pixel positives). The `alignment` floor DOES — it falls as 1/√(independent blobs) — so the
 * alignment figure returned here is only comparable to a reading over a similar area.
 *
 * @returns {{ coherence:{mean:number,sd:number}, alignment:{mean:number,sd:number}, seeds:number }}
 */
export function noiseFloor( settings = {}, sampling = {} ) {

    const width = sampling.width ?? 512;
    const height = sampling.height ?? 512;
    const seeds = sampling.seeds ?? 8;

    const coherences = [];
    const alignments = [];

    for ( let seed = 1; seed <= seeds; seed ++ ) {

        const noise = whiteNoiseField( width, height, 1, 0, seed );
        const reading = lockCoherence( { ...noise, mask: null }, settings );

        coherences.push( reading.coherence );
        alignments.push( reading.alignment );

    }

    const summarise = ( values ) => {

        const mean = values.reduce( ( total, value ) => total + value, 0 ) / values.length;
        const variance = values.reduce( ( total, value ) => total + ( value - mean ) ** 2, 0 ) /
            Math.max( 1, values.length - 1 );

        return { mean, sd: Math.sqrt( variance ) };

    };

    return { coherence: summarise( coherences ), alignment: summarise( alignments ), seeds };

}

// --- plates ---------------------------------------------------------------------------------------

/** Reads a plate and measures it. `domain` is `linear` (shader space) or `encoded` (eye space). */
export function measurePlate( file, settings = {} ) {

    const decoded = decodePng( fs.readFileSync( file ) );
    const domain = settings.domain ?? 'linear';
    const mask = settings.mask ?? new Uint8Array( decoded.width * decoded.height ).fill( 1 );

    const luma = lumaField( decoded, domain );
    const reading = lockCoherence( { ...luma, mask }, settings );

    return { file, domain, width: decoded.width, height: decoded.height, ...reading };

}

// --- the CLI --------------------------------------------------------------------------------------

/** `coherence` rescaled so the isotropic-noise floor reads 0 and a pure grating still reads 1. */
export function coherenceExcess( coherence, floor = DEFAULT_NOISE_FLOOR ) {

    if ( coherence === null ) return null;

    return ( coherence - floor ) / ( 1 - floor );

}

function report( reading, atDefaultWidths ) {

    const number = ( value, digits ) => value === null ? '   n/a' : value.toFixed( digits );
    const excess = atDefaultWidths ? coherenceExcess( reading.coherence ) : null;

    console.log( `  ${ path.basename( reading.file ) }  ${ reading.width }x${ reading.height }` +
        `  measured px ${ reading.count.toLocaleString() }` );
    console.log( `    mean ${ reading.mean.toExponential( 4 ) }` +
        `   band rms ${ ( reading.bandRms / Math.abs( reading.mean ) * 100 ).toFixed( 3 ) }% of mean` );
    console.log( `    coherence ${ number( reading.coherence, 4 ) }` +
        ` (excess over the noise floor ${ number( excess, 4 ) })` +
        `   alignment ${ number( reading.alignment, 4 ) }` +
        `   orientation ${ reading.orientationDeg === null ? 'n/a' : reading.orientationDeg.toFixed( 2 ) + '°' }` );
    console.log( `    🎯 coherentLock ${ reading.coherentLock === null ? 'n/a' : ( reading.coherentLock * 100 ).toFixed( 4 ) + '% of mean' }` );

}

if ( process.argv[ 1 ] === fileURLToPath( import.meta.url ) ) {

    const argv = process.argv.slice( 2 );
    const flag = ( name ) => { const at = argv.indexOf( `--${ name }` ); return at < 0 ? null : argv[ at + 1 ]; };
    const files = argv.filter( ( argument, index ) =>
        argument.startsWith( '--' ) === false && argv[ index - 1 ]?.startsWith( '--' ) !== true );

    if ( files.length === 0 ) {

        console.log( 'usage: node tools/critic/lock-coherence.mjs <plate.png> [after.png]' +
            ' --unit <unit.png> --zero <zero.png> [--fine 11] [--coarse 121] [--tensor 53]' +
            ' [--domain linear|encoded]' );
        process.exit( 2 );

    }

    const settings = {
        wFine: flag( 'fine' ) === null ? COHERENCE_DEFAULTS.wFine : Number( flag( 'fine' ) ),
        wCoarse: flag( 'coarse' ) === null ? COHERENCE_DEFAULTS.wCoarse : Number( flag( 'coarse' ) ),
        wTensor: flag( 'tensor' ) === null ? COHERENCE_DEFAULTS.wTensor : Number( flag( 'tensor' ) ),
        domain: flag( 'domain' ) ?? 'linear'
    };

    const unit = flag( 'unit' );
    const zero = flag( 'zero' );
    settings.mask = unit !== null && zero !== null ? solidHairMask( unit, zero ).mask : undefined;

    const atDefaultWidths = settings.wFine === COHERENCE_DEFAULTS.wFine &&
        settings.wCoarse === COHERENCE_DEFAULTS.wCoarse && settings.wTensor === COHERENCE_DEFAULTS.wTensor;

    console.log( 'lock-coherence.mjs — band-limited structure tensor over the eroded solid-hair mask' );
    console.log( `  widths: fine ${ settings.wFine }  coarse ${ settings.wCoarse }` +
        `  tensor ${ settings.wTensor }  erode ${ erosionFor( settings.wTensor ) }` +
        `   band gain (axis-aligned) at 53 px ${ lockBandGain( 53, 0, settings ).toFixed( 4 ) },` +
        ` at 4.8 px ${ lockBandGain( 4.8, 0, settings ).toFixed( 4 ) }` );
    console.log( atDefaultWidths
        ? `  isotropic-noise floor on coherence: ${ DEFAULT_NOISE_FLOOR } — a reading at or below it is noise`
        : '  ⚠️  NON-DEFAULT WIDTHS — DEFAULT_NOISE_FLOOR does not apply, run noiseFloor() at these widths' );
    console.log( settings.mask === undefined
        ? '  ⚠️  NO MASK — measuring the whole frame. Pass --unit and --zero for the hair mask.\n'
        : `  mask: ${ settings.mask.reduce( ( total, value ) => total + value, 0 ).toLocaleString() }` +
          ` solid hair px from ${ path.basename( unit ) } vs ${ path.basename( zero ) }\n` );

    const readings = files.map( ( file ) => measurePlate( file, settings ) );
    for ( const reading of readings ) report( reading, atDefaultWidths );

    if ( readings.length === 2 ) {

        const [ before, after ] = readings;
        const ratio = ( key ) => before[ key ] === null || after[ key ] === null
            ? 'n/a' : `x${ ( after[ key ] / before[ key ] ).toFixed( 4 ) }`;

        console.log( `\n  A/B   coherence ${ ratio( 'coherence' ) }   alignment ${ ratio( 'alignment' ) }` +
            `   coherentLock ${ ratio( 'coherentLock' ) }` +
            `   orientation ${ ( after.orientationDeg - before.orientationDeg ).toFixed( 3 ) }°` );
        console.log( '  ⚠️  An ABSOLUTE coherence reading is not evidence of locks — a shading ramp and a' );
        console.log( '      silhouette are both rank-1. Only this A/B, between plates differing in one' );
        console.log( '      expression, is attributable.' );

    }

}
