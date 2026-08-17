#!/usr/bin/env node
//
// violet.mjs — is the rim ONE HUE, tracing the WHOLE silhouette? An objective statistic for the
// defect three blind judges named as the strongest single tell that this is a render.
//
// ## What is being measured, and why it is not "how blue is it"
//
// The judges' words are on record and they describe a PROPERTY rather than an intensity:
// *"a constant-width saturated violet outline tracing the whole silhouette at uniform intensity
// regardless of surface angle"*, two of the three calling it a bug rather than low quality. The
// ledger's own conclusion is the part that is easy to miss — **only warming ONE side breaks that**
// — and it means the defect is SYMMETRY. `render/LightingRig.js`'s portrait preset puts the rim at
// irradiance 16 and the kicker at irradiance 7 on the SAME colour, `0x0f30ff`, at near-mirror
// azimuths of −168° and +166°. Two lights of one hue on both sides of a figure is an outline.
//
// So a statistic that answers "how much blue is there" is answering the wrong question: it goes
// down when the rim is dimmed, and dimming the rim was never the fix. What has to go UP when the
// picture gets better is the DISAGREEMENT between the two sides. Both quantities below are built on
// the chroma-weighted circular mean of hue over a set of pixels,
//
//     R = | Σ wᵢ e^{i θᵢ} | / Σ wᵢ          V = 1 − R
//
// with θ the pixel's HSV hue and w its HSV saturation.
//
// ## 🚩 AND THE OBVIOUS READING OF THAT IS WRONG ON A REAL PLATE. MEASURED, TWICE.
//
// The obvious statistic is V over the WHOLE silhouette band: one hue all the way round gives V = 0,
// half the band warm gives V = 1 − |cos(Δ/2)| = 0.811 for this rig's blue against a 30° warm, so
// warming one side should take V up. On the synthetic discs it does exactly that. **On the shipped
// portrait plate it does the opposite**, and the reason is arithmetic rather than bad luck:
//
//     `src/lighting.html?bare` at 900x1200, shipped rig      V 0.198670   side separation  1.6978°
//     the same page, `?ov=kicker.colour:0xffd7b0,irradiance:2.5`
//                                                            V 0.151531   side separation 15.1957°
//
// An 8 px band on a real figure is roughly four fifths SKIN — measured band saturation 0.286
// against a rim colour at 0.941 — so the dominant disagreement inside the band is skin-against-rim
// within each side, not side-against-side. Warming the key side makes that side's band agree MORE
// with its own skin, and V falls. `dilute` in §VALIDATION reproduces this in closed form on a
// painted disc, so it is a proven property of the operator and not an observation about one plate.
//
// **The statistic that moves the right way is `band.sideSeparation`** — the angle between the
// key-side band's circular mean hue and the shadow-side band's. It is 0 when both back lights carry
// one hue, which is REQ-060's whole thesis expressed as a number, and the shipped rig reads 1.70°.
//
// ## 🚩 THE OPERATOR IS VALIDATED AGAINST ARITHMETIC BEFORE IT IS POINTED AT A RENDER
//
// This repository has EIGHT recorded instances of a statistic that was structurally blind to the
// defect it was written for — mean alpha cannot tell a picket fence from a rectangle; a slab scores
// a PERFECT bimodality; a card-wide luminance baseline read 4.0 on a visibly flat wall. So every
// run of this file, measurement runs included, first prints §VALIDATION: seven synthetic discs in
// six cases, whose answers are closed form over integer pixel counts and are asserted to
// floating-point tolerance rather than to a recorded literal —
//
//     uniform      a disc rimmed in one blue all the way round        V = 0                exactly
//     split        the same disc, blue on one side, warm on the other V = 1 − cos(158.25°/2)
//     three-one    three quarters blue, one quarter warm              V = 1 − |¾e^{iθb}+¼e^{iθw}|
//     unrimmed     a bare disc, no rim at all                         V = 0                exactly
//     narrow       a 3 px rim instead of an 8 px one                  V = 0                exactly
//     dilute       a 2 px rim inside the 8 px band, both arms         the exact skin/rim mixture
//
// Three of those rows are BLIND SPOTS rather than successes, and they are printed as such:
// `unrimmed` scores the same V as `uniform` (a band of one hue is a band of one hue, whether the
// hue came from a light or from skin); `narrow` scores the same V as `uniform` (V cannot see WIDTH,
// which is a third of the judges' sentence); and `dilute` is the one above. Nobody should quote V
// alone, and the run says so every time.
//
// ## The numbers
//
//   1. `subject.coolShare` — the share of SUBJECT pixels in a cool hue at saturation > 0.10. This
//      is the footprint: `LightingRig.js` records the shipped portrait rig at 1.11% and REQ-060
//      records 1.60%, and it is the number a judge's "a third of the figure is violet" becomes.
//   2. `band.sideSeparation` — 🎯 THE HEADLINE. How far the key-side band's hue sits from the
//      shadow-side band's. Zero is the defect.
//   3. `band.circularVariance` — reported, with its per-side halves, because it is the quantity the
//      defect is stated in and a reader will want it. Read it with §1 above.
//   4. `band.keySideHueRotation` — the signed angle from the KEY-SIDE interior skin's hue to the
//      key-side band's hue. REQ-060 records −39.4° on the shipped rig and −18.6° with a warm
//      kicker. Negative means the band has rotated away from skin toward blue.
//   5. `band.depthProfile` — the "constant width, regardless of surface angle" clause, from a
//      single plate. Mean saturation shell by shell inward from the silhouette. A rim falls off; a
//      shader outline does not.
//
// ## 🎯 WHAT THE OPERATOR THEN SAID, AND IT IS NOT THE ANSWER REQ-060 EXPECTED
//
// Three arms of the real rig, all on `src/lighting.html?bare` at 900x1200 against a `?figure=0`
// mask, `--query` moving only the kicker. The mask came back at **644,648 px on all three**, which
// is the check that makes the columns comparable: the rim's placement puts zero spill on the
// backdrop at the shipped standoff, so the mask is rig-independent and the numbers are read over
// the same pixels.
//
//   | portrait kicker                     | cool subject px | side separation | key-side rotation |
//   |-------------------------------------|----------------:|----------------:|------------------:|
//   | `0x0f30ff` E 7 — SHIPPED            |         1.0806% |        1.6978°  |        −28.2127°  |
//   | `0xffd7b0` E 2.5 — REQ-060's fix    |         0.4744% |       15.1957°  |        −14.4848°  |
//   | **E 0 — the kicker simply DELETED** |     **0.5006%** |    **13.7966°** |    **−15.8943°**  |
//
// **Deleting the key-side kicker buys 91–97% of what warming it buys, on every one of these
// numbers.** And on `alive.html?bare&freeze&seed=1&capture` at 900x1200, 1 step, through
// `measure.mjs` against `regions.lighting-portrait.json`: the warm kicker takes **G1, G2 AND G4**
// red (1.2506 against a 1.43 floor; G2 luma 0.8836 against 0.92), while `?ov=kicker.irradiance:0`
// is **G1–G7 all green** — G1 1.5748, G2 luma 0.9480, chroma 1.2771.
//
// That is not a contradiction of REQ-060's thesis, it is the thesis reached by subtraction. The
// entry says "only warming ONE side breaks" a one-hue outline and concludes the fix is asymmetry
// rather than removal. Removing the RIM would indeed be wrong — it is the shadow-side separation.
// The KICKER is the key-side light, and deleting it leaves exactly one side blue, which is the same
// asymmetry for none of the cost.
//
// ⚠️ STATED AS A LIMIT RATHER THAN HIDDEN: these four numbers are about HUE and AREA. A key-side
// kicker's job, in `LightingRig.js`'s own words, is "the jaw and shoulder line", and nothing here
// measures whether that line survives its deletion. The band's depth-1 saturation barely moves
// (0.2861 shipped, 0.2897 deleted), which says the deletion is not costing band contrast — it does
// not say the jaw still reads. That is a judge's question and it needs a crop, not a statistic.
//
// ## What it needs, and the one structural limit worth stating up front
//
// It needs a SUBJECT MASK, and a mask is taken by difference against the same studio with the
// subject removed. **`packages/testbed/src/lighting.html` is the only page in this repository that
// can produce one** — `?figure=0` — and it is exactly why REQ-060's two published numbers were
// taken there. `alive.html`, the page the seven objective gates are measured on, has no such flag,
// so the two halves of REQ-060's evidence come off two different pages and were never comparable
// as pixels. That is a fact about the repository rather than about this tool, and it is printed in
// the provenance block of every run so nobody quotes a number from one page against the other.
//
// `capture.mjs --plate` cannot take these plates either: it waits for `window.__SUGATA_STEP__`,
// which `lighting.html` does not expose because nothing on that page animates. `--shoot` below is
// the two screenshots, in the shape `hair-plates.mjs` already uses for the same reason.
//
// ## Usage
//
//   node tools/critic/violet.mjs --selftest
//     ^ the synthetic validations alone. No browser, no vite, under a second.
//
//   node tools/critic/violet.mjs --shoot captures/violet-shipped
//     ^ starts vite, screenshots `lighting.html?bare` and `lighting.html?bare&figure=0` at
//       900×1200, writes `plate.png`, `background.png` and `manifest.json`.
//
//   node tools/critic/violet.mjs --plate captures/violet-shipped/plate.png \
//        --background captures/violet-shipped/background.png --json /tmp/violet.json
//
//   --shoot accepts --query to sweep the rig through `?ov=`, e.g.
//   --query '&ov=kicker.irradiance:2.5' — the mask plate is shot with the SAME query, so the mask
//   is the mask of the rig being measured.
//
// Exit codes follow the rest of the critic harness:
//   0 = the validations passed and the measurement was written
//   1 = a validation FAILED — the operator is not trustworthy and no measurement is reported
//   2 = tool error (bad file, no browser, mismatched plate sizes)

import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { decodePng, encodePng } from './png.mjs';
import { rgbToHsv, encodedLuma } from './color.mjs';
// Imported as an ORACLE rather than as the implementation. This file needs erosions at 25 radii to
// build a depth profile, and a square-window erosion costs O(n·(2r+1)²) per radius — 2.8e9 samples
// at r = 25 on a 900×1200 plate. The Chebyshev distance transform below gives every radius at once
// in two linear passes, and `erosionsAgreeWithBandPower` asserts the two produce byte-identical
// masks, so the cheap one is checked against the one already in the tree rather than trusted.
import { erodeMask } from './band-power.mjs';

const HERE = path.dirname( fileURLToPath( import.meta.url ) );
const REPO_ROOT = path.resolve( HERE, '..', '..' );

// --- the constants, each with the measurement or the citation that fixes it -------------------

// The band's half-width, in pixels, measured inward from the silhouette. 8 is not a preference:
// `LightingRig.js`'s portrait rim table and REQ-060's kicker table are both stated as "the outer
// 8 px of the silhouette", so any number quoted against theirs has to use the same window.
//
// ⚠️ IT IS A PIXEL COUNT AND THE PLATE IS NOT SCALE-FREE. Those tables were measured at 900×1200;
// the same 8 px on a 3840×5120 plate is a 4.3× narrower band in subject terms. The report prints
// the band width as a fraction of frame height beside it so two plates of different sizes cannot
// be compared by accident.
const BAND_RADIUS = 8;

// How far inside the silhouette "interior skin" starts, in pixels. `LightingRig.js` states its own
// falloff statistic as "the light the pair adds at the silhouette divided by the light it still
// adds 25 px inside", so 25 is this project's own definition of "past the rim" and is reused
// rather than re-chosen.
const INTERIOR_DEPTH = 25;

// A hue only means something where there is chroma to carry it. 0.10 is `LightingRig.js`'s own
// floor — every "subject px in a cool hue at S > 0.10" row in that file uses it — and it is reused
// so the `coolShare` below is comparable with the six tables already written against it.
const SATURATION_FLOOR = 0.10;

// What counts as COOL, as an HSV hue arc.
//
// 🚩 THE REPOSITORY NEVER WROTE THIS DOWN, and six tables in `LightingRig.js` are stated in terms
// of it. The arc here is derived from the two hues the frame actually contains rather than chosen:
// this project's skin measures 16–31° (the spec's cheek `#E5C3C3` is at 0°, `measure.mjs` reads
// cheeks at 20.95° and 30°), and the rim's `0x0f30ff` sits at 231.75°. 150° is past every green
// the frame can produce and well short of the blue; 300° is the magenta boundary, past which a hue
// is on its way back to red through the lips and the subsurface term, which are warm and are not
// this defect. The report prints the share at three arcs so the reader can see how much of the
// answer is the arc and how much is the picture — see `COOL_HUE_ARCS`.
const COOL_HUE_ARC = [ 150, 300 ];

// Reported alongside the headline arc, never instead of it. A statistic whose value depends on an
// undocumented threshold is a statistic that can be argued with; one that publishes its own
// sensitivity cannot.
const COOL_HUE_ARCS = [
    { name: 'wide   [150,300)', arc: [ 150, 300 ] },
    { name: 'narrow [180,300)', arc: [ 180, 300 ] },
    { name: 'widest [150,330)', arc: [ 150, 330 ] }
];

// A pixel belongs to the subject when the beauty plate and the subject-removed plate disagree by
// more than this on any channel, in display code values. 2/255 is one code value above the PNG
// quantisation floor: the two plates are the SAME studio rendered twice, so everything outside the
// figure — backdrop, floor, the lights' own spill — is identical bit for bit, and the threshold is
// there for the plates' own residue rather than for a real difference. `--move` overrides it and
// the report prints the mask size, which is the number that shows a bad threshold.
const MASK_MOVE = 2 / 255;

// The synthetic validation palette. Blue is the rig's own shipped rim colour. Warm is chosen to
// carry EXACTLY the same HSV saturation as the blue (240/255) so the closed-form predictions below
// are a statement about hue alone — an unequal-saturation pair would make the chroma weighting do
// part of the work and the prediction would no longer be arithmetic.
//
// 🎯 `skin` AND `skinKeySide` ARE 6x AND 7x THE SAME TRIPLE (33, 25, 22), which is what makes the
// key-side brightening exact. A float gain does not survive the round to 8-bit — 198 x 1.3 is 257,
// which wraps, and 198 x 1.25 is 248 against 150 x 1.25 = 188, a triple whose hue is 16.6265° and
// not 16.3636°. Both would have moved a prediction under the validation's feet. An integer multiple
// of a reduced triple scales VALUE and leaves hue and saturation bit-identical.
const SYNTHETIC = {
    background: [ 20, 22, 28 ],
    skin: [ 198, 150, 132 ],        // 6 x (33,25,22). hue 16.3636°, S 0.3333 — this project's cheek family
    skinKeySide: [ 231, 175, 154 ], // 7 x (33,25,22). The same hue and saturation, 1.1667x the value
    blueRim: [ 15, 48, 255 ],       // 0x0f30ff, the shipped portrait rim. hue 231.75°, S 0.9412
    warmRim: [ 255, 135, 15 ],      // hue 30°, S 0.9412 — the same saturation, deliberately
    size: 240,
    radius: 80,
    narrowRadius: 3
};

// Tolerances for the validations, and they are two rather than one because the quantities are.
//
// 🚩 THE FIRST DRAFT USED 1e-9 FOR BOTH AND THREE ROWS WENT RED AT 1e-8, which was the operator
// telling the truth about `png.mjs`: decoded pixels are a **Float32Array**, so a plate's colours
// carry float32 quantisation (≈1.2e-7 relative) before any statistic touches them. The fix is not a
// looser tolerance — it is that `hueOf` below quantises the PREDICTION through `Math.fround` the
// same way the decode does, so prediction and measurement are computing the same numbers. What is
// left is summation order over a few thousand terms, which is what these two cover.
const VARIANCE_TOLERANCE = 1e-9;      // dimensionless, on a quantity in [0,1]
const ANGLE_TOLERANCE_DEGREES = 1e-6; // an atan2 of those sums, expressed in degrees

// --- morphology, as one distance transform ----------------------------------------------------

/**
 * Chebyshev (chessboard) distance from every foreground pixel to the nearest background pixel,
 * with everything outside the image counted as background.
 *
 * 🎯 ONE TRANSFORM REPLACES EVERY EROSION AND DILATION THIS FILE NEEDS, and that is the reason it
 * is here rather than a loop over `erodeMask`. A square-window erosion of radius r keeps exactly
 * the pixels whose chessboard distance to background EXCEEDS r, so `distance > r` is `erodeMask(r)`
 * for every r at once — which is what makes a 25-shell depth profile affordable at all.
 *
 * The out-of-bounds convention matters and is not incidental: `band-power.mjs`'s `erodeMask` drops
 * a pixel whose window leaves the image, so the image border behaves as background. The two passes
 * below reproduce that by treating an out-of-bounds neighbour as distance 0. `erosionsAgreeWithBandPower`
 * asserts the equality rather than arguing it.
 */
function chessboardDistance( mask, width, height ) {

    const distance = new Int32Array( width * height );
    const unreached = width + height;

    for ( let index = 0; index < distance.length; index ++ ) {

        distance[ index ] = mask[ index ] === 0 ? 0 : unreached;

    }

    const at = ( x, y ) => ( x < 0 || y < 0 || x >= width || y >= height ) ? 0 : distance[ y * width + x ];

    for ( let y = 0; y < height; y ++ ) {

        for ( let x = 0; x < width; x ++ ) {

            const index = y * width + x;
            if ( distance[ index ] === 0 ) continue;

            const nearest = Math.min(
                at( x - 1, y ), at( x - 1, y - 1 ), at( x, y - 1 ), at( x + 1, y - 1 ) );
            distance[ index ] = Math.min( distance[ index ], nearest + 1 );

        }

    }

    for ( let y = height - 1; y >= 0; y -- ) {

        for ( let x = width - 1; x >= 0; x -- ) {

            const index = y * width + x;
            if ( distance[ index ] === 0 ) continue;

            const nearest = Math.min(
                at( x + 1, y ), at( x + 1, y + 1 ), at( x, y + 1 ), at( x - 1, y + 1 ) );
            distance[ index ] = Math.min( distance[ index ], nearest + 1 );

        }

    }

    return distance;

}

/** The same transform run on the complement: how far a background pixel is from the subject. */
function chessboardDistanceToForeground( mask, width, height ) {

    const inverted = new Uint8Array( mask.length );
    for ( let index = 0; index < mask.length; index ++ ) inverted[ index ] = mask[ index ] === 0 ? 1 : 0;

    return chessboardDistance( inverted, width, height );

}

// --- the subject mask -------------------------------------------------------------------------

/**
 * The subject, by difference against the same studio with the figure hidden.
 *
 * Deliberately NOT a colour or luma segmentation. The defect being measured is a hue that spills
 * from the subject onto everything near it, so any mask built out of hue would be a mask built out
 * of the thing being measured, and a change to the rim would move the mask and the statistic
 * together. A difference mask is a statement about GEOMETRY and is invariant to the rig — provided
 * the two plates are the same rig, which is why `--shoot` shoots both with one `--query`.
 */
function subjectMaskByDifference( plate, background, move ) {

    if ( plate.width !== background.width || plate.height !== background.height ) {

        throw new Error( 'violet: the beauty plate and the background plate are different sizes' );

    }

    const mask = new Uint8Array( plate.width * plate.height );
    let count = 0;

    for ( let index = 0; index < mask.length; index ++ ) {

        const sample = index * 4;
        const moved = Math.max(
            Math.abs( plate.pixels[ sample ] - background.pixels[ sample ] ),
            Math.abs( plate.pixels[ sample + 1 ] - background.pixels[ sample + 1 ] ),
            Math.abs( plate.pixels[ sample + 2 ] - background.pixels[ sample + 2 ] ) );

        if ( moved > move ) {

            mask[ index ] = 1;
            count += 1;

        }

    }

    return { mask, width: plate.width, height: plate.height, count };

}

// --- the statistics -----------------------------------------------------------------------------

/** HSV of one pixel of a decoded plate, on the ENCODED triple — the domain the spec was measured in. */
function hsvAt( plate, index ) {

    const sample = index * 4;
    return rgbToHsv( plate.pixels[ sample ], plate.pixels[ sample + 1 ], plate.pixels[ sample + 2 ] );

}

/**
 * The chroma-weighted circular mean and variance of hue over a set of pixels.
 *
 * Weighted by HSV saturation rather than thresholded on it, and the difference is the point: a
 * grey pixel has no hue to contribute AND no weight to dilute the mean, so it drops out of both
 * halves of the ratio on its own. A threshold would have to be defended; a weight does not.
 *
 * `chromaCoverage` is reported beside the variance and is the clause the variance cannot state.
 * "One hue tracing the WHOLE silhouette" is two claims — one hue, and the whole silhouette — and a
 * band that is half saturated blue and half bare grey scores a LOW variance while plainly failing
 * the second. Coverage is the share of the band carrying any hue at all, at `SATURATION_FLOOR`.
 */
function circularHueStatistics( plate, indices ) {

    let x = 0;
    let y = 0;
    let weight = 0;
    let covered = 0;

    for ( const index of indices ) {

        const hsv = hsvAt( plate, index );
        const radians = hsv.hue * Math.PI / 180;

        x += hsv.saturation * Math.cos( radians );
        y += hsv.saturation * Math.sin( radians );
        weight += hsv.saturation;

        // `>` and not `>=`, matching `coolShare` below and `LightingRig.js`'s six tables, all of
        // which are stated as "a cool hue at S > 0.10". Two spellings of one floor is how two
        // numbers in one report come to disagree at the fourth decimal for no reason anyone can find.
        if ( hsv.saturation > SATURATION_FLOOR ) covered += 1;

    }

    if ( indices.length === 0 || weight === 0 ) {

        return { meanHue: null, resultantLength: null, circularVariance: null,
            chromaCoverage: 0, pixels: indices.length };

    }

    const resultantLength = Math.hypot( x, y ) / weight;
    let meanHue = Math.atan2( y, x ) * 180 / Math.PI;
    if ( meanHue < 0 ) meanHue += 360;

    return {
        meanHue,
        resultantLength,
        circularVariance: 1 - resultantLength,
        chromaCoverage: covered / indices.length,
        pixels: indices.length
    };

}

/** The signed shortest rotation from `from` to `to`, in (−180, 180]. Negative is anticlockwise. */
function signedHueRotation( from, to ) {

    let delta = ( to - from ) % 360;
    if ( delta > 180 ) delta -= 360;
    if ( delta <= -180 ) delta += 360;
    return delta;

}

/** The share of a pixel set whose hue falls inside a cool arc AND which carries enough chroma to have one. */
function coolShare( plate, indices, arc ) {

    let cool = 0;

    for ( const index of indices ) {

        const hsv = hsvAt( plate, index );
        if ( hsv.saturation <= SATURATION_FLOOR ) continue;
        if ( hsv.hue >= arc[ 0 ] && hsv.hue < arc[ 1 ] ) cool += 1;

    }

    return indices.length === 0 ? 0 : cool / indices.length;

}

/** Mean encoded luma over a pixel set — how the key side is told from the shadow side. */
function meanEncodedLuma( plate, indices ) {

    if ( indices.length === 0 ) return null;

    let total = 0;

    for ( const index of indices ) {

        const sample = index * 4;
        total += encodedLuma( plate.pixels[ sample ], plate.pixels[ sample + 1 ], plate.pixels[ sample + 2 ] );

    }

    return total / indices.length;

}

/**
 * Which side of the frame the key is on, MEASURED rather than derived from the rig's azimuths.
 *
 * 🚩 GETTING THIS BACKWARDS FLIPS THE SIGN OF THE HEADLINE NUMBER, so it is not taken on trust from
 * `LightingRig.js` — the camera is placed by `placeCamera` from the posed figure's own eye line and
 * carries a yaw, so "azimuth +166° is screen right" is a claim about a chain of four transforms
 * rather than about a constant. The interior of the subject is brighter on the key side, and that
 * is directly readable off the plate the statistic is being taken on.
 *
 * The margin is reported. Two halves within 1% of each other mean the plate cannot answer the
 * question, and a report that says so is worth more than a coin toss that does not.
 */
function keySideOfSubject( plate, mask, distance, width, height ) {

    let centroidX = 0;
    let count = 0;

    for ( let index = 0; index < mask.length; index ++ ) {

        if ( mask[ index ] === 0 ) continue;
        centroidX += index % width;
        count += 1;

    }

    if ( count === 0 ) throw new Error( 'violet: the subject mask is empty — check --move and the two plates' );

    const splitX = centroidX / count;
    const left = [];
    const right = [];

    for ( let index = 0; index < mask.length; index ++ ) {

        if ( mask[ index ] === 0 || distance[ index ] <= INTERIOR_DEPTH ) continue;
        ( index % width < splitX ? left : right ).push( index );

    }

    const leftLuma = meanEncodedLuma( plate, left );
    const rightLuma = meanEncodedLuma( plate, right );

    if ( leftLuma === null || rightLuma === null ) {

        throw new Error( `violet: no interior deeper than ${ INTERIOR_DEPTH } px on one side — ` +
            'the subject is too small at this plate size for the interior reference' );

    }

    const margin = Math.abs( leftLuma - rightLuma ) / Math.max( leftLuma, rightLuma );

    return {
        side: rightLuma > leftLuma ? 'right' : 'left',
        splitX,
        leftInteriorLuma: leftLuma,
        rightInteriorLuma: rightLuma,
        margin,
        // 1% of interior luma. Below it the two halves are the same brightness and the side the
        // detector picked is noise, which the report says out loud rather than hiding.
        ambiguous: margin < 0.01,
        leftInteriorPixels: left.length,
        rightInteriorPixels: right.length
    };

}

/**
 * Saturation and hue shell by shell inward from the silhouette — the "constant width, regardless of
 * surface angle" clause, from ONE plate.
 *
 * `LightingRig.js` measures the same clause as a ratio of ADDED light between depth 1 and depth 25,
 * which needs a rim-off plate as well. This is the single-plate form of the same question and it is
 * weaker in a stated way: it reads the band's own chroma rather than the light the rim contributed,
 * so a figure whose albedo happens to be saturated at the edge would read like a rim. What it can
 * still separate is the shape of the falloff, and a shader outline has none.
 */
function depthProfile( plate, mask, distance, maxDepth ) {

    const shells = [];

    for ( let depth = 1; depth <= maxDepth; depth ++ ) {

        const indices = [];

        for ( let index = 0; index < mask.length; index ++ ) {

            if ( mask[ index ] === 1 && distance[ index ] === depth ) indices.push( index );

        }

        if ( indices.length === 0 ) break;

        let saturation = 0;
        for ( const index of indices ) saturation += hsvAt( plate, index ).saturation;

        shells.push( {
            depth,
            pixels: indices.length,
            meanSaturation: saturation / indices.length,
            meanHue: circularHueStatistics( plate, indices ).meanHue
        } );

    }

    return shells;

}

// --- the measurement ------------------------------------------------------------------------------

/**
 * Everything the report prints, off one beauty plate and one subject-removed plate.
 *
 * @param {Object} plate       - decoded beauty plate.
 * @param {Object} background  - decoded plate of the same studio with the subject hidden.
 * @param {Object} [settings]  - `bandRadius`, `interiorDepth`, `move`.
 */
export function measureViolet( plate, background, settings = {} ) {

    const bandRadius = settings.bandRadius ?? BAND_RADIUS;
    const interiorDepth = settings.interiorDepth ?? INTERIOR_DEPTH;
    const move = settings.move ?? MASK_MOVE;

    const subject = subjectMaskByDifference( plate, background, move );
    const { mask, width, height } = subject;

    const distance = chessboardDistance( mask, width, height );
    const outward = chessboardDistanceToForeground( mask, width, height );

    const key = keySideOfSubject( plate, mask, distance, width, height );

    const subjectIndices = [];
    const innerBand = [];
    const outerBand = [];
    const keySideBand = [];
    const shadowSideBand = [];
    const keySideInterior = [];

    for ( let index = 0; index < mask.length; index ++ ) {

        const onKeySide = key.side === 'right'
            ? ( index % width ) >= key.splitX
            : ( index % width ) < key.splitX;

        if ( mask[ index ] === 1 ) {

            subjectIndices.push( index );

            if ( distance[ index ] <= bandRadius ) {

                innerBand.push( index );
                ( onKeySide ? keySideBand : shadowSideBand ).push( index );

            } else if ( distance[ index ] > interiorDepth && onKeySide ) {

                keySideInterior.push( index );

            }

        } else if ( outward[ index ] <= bandRadius ) {

            outerBand.push( index );

        }

    }

    const band = circularHueStatistics( plate, innerBand );
    const keyBand = circularHueStatistics( plate, keySideBand );
    const shadowBand = circularHueStatistics( plate, shadowSideBand );
    const keyInterior = circularHueStatistics( plate, keySideInterior );
    const spill = circularHueStatistics( plate, outerBand );

    return {
        settings: { bandRadius, interiorDepth, move },
        frame: { width, height, bandRadiusAsFrameHeight: bandRadius / height },
        subject: {
            pixels: subject.count,
            shareOfFrame: subject.count / mask.length,
            coolShare: coolShare( plate, subjectIndices, COOL_HUE_ARC ),
            coolShareByArc: COOL_HUE_ARCS.map( ( entry ) => ( {
                name: entry.name, share: coolShare( plate, subjectIndices, entry.arc )
            } ) )
        },
        key,
        band: {
            ...band,
            keySide: keyBand,
            shadowSide: shadowBand,
            keySideInterior: keyInterior,
            // The two headline asymmetry numbers. `sideSeparation` is the whole thesis of REQ-060 in
            // one figure: it is 0 when both back lights share a hue and grows as one side warms.
            sideSeparation: keyBand.meanHue === null || shadowBand.meanHue === null
                ? null
                : Math.abs( signedHueRotation( shadowBand.meanHue, keyBand.meanHue ) ),
            keySideHueRotation: keyBand.meanHue === null || keyInterior.meanHue === null
                ? null
                : signedHueRotation( keyInterior.meanHue, keyBand.meanHue ),
            depthProfile: depthProfile( plate, mask, distance, interiorDepth )
        },
        // The band OUTSIDE the silhouette — the rim's spill onto the backdrop, which
        // `LightingRig.js` measures separately and records at 0.00% of background pixels for the
        // shipped portrait standoff. Reported because "dilate the mask and subtract it" is the
        // other reading of "the silhouette band" and the two answer different questions.
        backdropSpill: spill
    };

}

// --- §VALIDATION: the operator against shapes whose answers are arithmetic ------------------------

/**
 * A synthetic studio: a flat backdrop, a disc, and a rim painted on the disc's own Chebyshev band.
 *
 * 🎯 THE RIM IS PAINTED FROM THE SAME DISTANCE TRANSFORM THE OPERATOR MEASURES WITH, and that is
 * what makes the predictions exact rather than approximate. Painting a geometric annulus instead —
 * radius between R−8 and R — would leave a fringe of skin inside the measured band and every
 * closed-form number below would be out by an unknown amount, which is precisely the kind of
 * "close enough" this validation exists to refuse.
 *
 * @param {Function} rimColourAt - (x, y, centre, depth) -> an RGB triple, or null for bare skin.
 *   It is called for EVERY disc pixel and given that pixel's chessboard depth, so a case can paint
 *   a 3 px rim as easily as an 8 px one and the width blind-spot check has something to compare.
 * @param {boolean} [brightenKeySide] - paint the RIGHT interior in `SYNTHETIC.skinKeySide`, which
 *   is the same hue and saturation at a higher value, so the key-side detector has a target and no
 *   prediction below moves.
 */
function syntheticStudio( rimColourAt, brightenKeySide = false ) {

    const size = SYNTHETIC.size;
    const centre = size / 2;
    const disc = new Uint8Array( size * size );

    for ( let y = 0; y < size; y ++ ) {

        for ( let x = 0; x < size; x ++ ) {

            const dx = x + 0.5 - centre;
            const dy = y + 0.5 - centre;
            disc[ y * size + x ] = ( dx * dx + dy * dy ) <= SYNTHETIC.radius * SYNTHETIC.radius ? 1 : 0;

        }

    }

    const distance = chessboardDistance( disc, size, size );
    const plate = new Uint8Array( size * size * 4 );
    const background = new Uint8Array( size * size * 4 );

    const put = ( bytes, index, rgb ) => {

        bytes[ index * 4 ] = rgb[ 0 ];
        bytes[ index * 4 + 1 ] = rgb[ 1 ];
        bytes[ index * 4 + 2 ] = rgb[ 2 ];
        bytes[ index * 4 + 3 ] = 255;

    };

    for ( let y = 0; y < size; y ++ ) {

        for ( let x = 0; x < size; x ++ ) {

            const index = y * size + x;
            put( background, index, SYNTHETIC.background );

            if ( disc[ index ] === 0 ) {

                put( plate, index, SYNTHETIC.background );
                continue;

            }

            const rim = rimColourAt( x, y, centre, distance[ index ] );

            if ( rim !== null ) {

                put( plate, index, rim );

            } else if ( brightenKeySide === true && x >= centre ) {

                put( plate, index, SYNTHETIC.skinKeySide );

            } else {

                put( plate, index, SYNTHETIC.skin );

            }

        }

    }

    return {
        plate: decodePng( encodePng( size, size, plate ) ),
        background: decodePng( encodePng( size, size, background ) ),
        disc, distance, size
    };

}

/**
 * The closed-form chroma-weighted circular statistics of a band made of known components.
 *
 * @param {Array} components - `{ rgb, share }`, shares summing to 1. Saturation is read off the
 *   palette triple through the same float32 quantisation the decoder applies, so the prediction and
 *   the measurement are the same arithmetic in a different order.
 */
function predictedCircularStatistics( components ) {

    let x = 0;
    let y = 0;
    let weight = 0;

    for ( const component of components ) {

        const hsv = hsvOf( component.rgb );
        const radians = hsv.hue * Math.PI / 180;

        x += component.share * hsv.saturation * Math.cos( radians );
        y += component.share * hsv.saturation * Math.sin( radians );
        weight += component.share * hsv.saturation;

    }

    const resultantLength = Math.hypot( x, y ) / weight;
    let meanHue = Math.atan2( y, x ) * 180 / Math.PI;
    if ( meanHue < 0 ) meanHue += 360;

    return { meanHue, resultantLength, circularVariance: 1 - resultantLength };

}

/** The closed-form circular variance of a band that is `share` one hue and the rest another. */
function predictedCircularVariance( rgbA, rgbB, share ) {

    return predictedCircularStatistics( [
        { rgb: rgbA, share }, { rgb: rgbB, share: 1 - share }
    ] ).circularVariance;

}

/**
 * How many band pixels of a synthetic disc are RIM and how many are bare skin, per side.
 *
 * Counted off the same distance transform that paints them and that the operator measures with, so
 * a mixture prediction below is arithmetic on known integers rather than a literal recorded from a
 * previous run.
 */
function bandComposition( studio, rimDepth, bandRadius ) {

    const centre = studio.size / 2;
    const tally = { key: { rim: 0, skin: 0 }, shadow: { rim: 0, skin: 0 } };

    for ( let y = 0; y < studio.size; y ++ ) {

        for ( let x = 0; x < studio.size; x ++ ) {

            const index = y * studio.size + x;
            const depth = studio.distance[ index ];

            if ( studio.disc[ index ] === 0 || depth > bandRadius ) continue;

            const side = x >= centre ? tally.key : tally.shadow;
            if ( depth <= rimDepth ) side.rim += 1; else side.skin += 1;

        }

    }

    return tally;

}

/**
 * The HSV of a palette triple AS THE OPERATOR WILL SEE IT.
 *
 * `Math.fround` is the load-bearing call. `png.mjs` decodes into a `Float32Array`, so the colour
 * this file paints as the byte 150 arrives back as the float32 nearest to 150/255 and not as the
 * float64 one. Predicting from float64 and measuring from float32 disagrees at ~1e-8, which is
 * exactly what three validation rows reported before this was here — a real disagreement about a
 * real thing, and the honest fix is to predict in the domain the measurement lives in.
 */
function hsvOf( rgb ) {

    return rgbToHsv( ...rgb.map( ( channel ) => Math.fround( channel / 255 ) ) );

}

function hueOf( rgb ) {

    return hsvOf( rgb ).hue;

}

/**
 * The oracle check the header promises: the Chebyshev transform's `distance > r` is byte-identical
 * to `band-power.mjs`'s square-window `erodeMask( r )`, on a real shape, at three radii.
 */
function erosionsAgreeWithBandPower( disc, size ) {

    const distance = chessboardDistance( disc, size, size );
    const disagreements = [];

    for ( const radius of [ 1, 4, BAND_RADIUS ] ) {

        const reference = erodeMask( disc, size, size, radius );
        let differing = 0;

        for ( let index = 0; index < disc.length; index ++ ) {

            const ours = distance[ index ] > radius ? 1 : 0;
            if ( ours !== reference[ index ] ) differing += 1;

        }

        disagreements.push( { radius, differing } );

    }

    return disagreements;

}

/**
 * Every validation, printed on every run. Returns the number that failed.
 *
 * The tolerances are floating-point rather than percentages on purpose: the synthetic plates carry
 * no anti-aliasing, the band is painted from the same transform that measures it, the two rim
 * colours carry equal saturation, and the predictions are quantised through the same float32 the
 * decoder uses — so the operator and the closed form are computing one sum in two orders, and
 * anything above summation noise is a real disagreement about a real thing.
 */
export function runValidations() {

    const results = [];
    const check = ( name, detail, passed ) => {

        results.push( { name, detail, passed } );
        console.log( `  ${ passed ? 'ok  ' : 'FAIL' }  ${ name }\n        ${ detail }` );

    };

    const blue = hueOf( SYNTHETIC.blueRim );
    const warm = hueOf( SYNTHETIC.warmRim );
    const skin = hueOf( SYNTHETIC.skin );
    const separation = Math.abs( signedHueRotation( warm, blue ) );

    console.log( '\n--- §VALIDATION: the operator against shapes whose answers are arithmetic ---\n' );
    console.log( `  palette   blue ${ blue.toFixed( 4 ) }°  warm ${ warm.toFixed( 4 ) }°  ` +
        `skin ${ skin.toFixed( 4 ) }°  |  blue-to-warm separation ${ separation.toFixed( 4 ) }°` );
    console.log( `  the two rim hues carry the SAME saturation (${ hsvOf( SYNTHETIC.blueRim ).saturation.toFixed( 4 ) } ` +
        `vs ${ hsvOf( SYNTHETIC.warmRim ).saturation.toFixed( 4 ) }), so every prediction below is a statement about hue alone\n` );

    // 0. The morphology, against the erosion already in the tree.
    const uniform = syntheticStudio( ( x, y, centre, depth ) => depth <= BAND_RADIUS ? SYNTHETIC.blueRim : null );
    const agreement = erosionsAgreeWithBandPower( uniform.disc, uniform.size );
    check( 'the Chebyshev transform reproduces band-power.mjs\'s erodeMask exactly',
        agreement.map( ( row ) => `r=${ row.radius }: ${ row.differing } px differ` ).join( ', ' ),
        agreement.every( ( row ) => row.differing === 0 ) );

    // 1. UNIFORM — one hue all the way round. R = 1, V = 0, exactly.
    const uniformMeasured = measureViolet( uniform.plate, uniform.background );
    check( 'uniform: a disc rimmed in ONE blue all the way round scores V = 0',
        `predicted 0 exactly, measured ${ uniformMeasured.band.circularVariance.toExponential( 3 ) } ` +
        `over ${ uniformMeasured.band.pixels } band px, mean hue ${ uniformMeasured.band.meanHue.toFixed( 4 ) }°`,
        Math.abs( uniformMeasured.band.circularVariance ) < VARIANCE_TOLERANCE );

    // 2. SPLIT — half blue, half warm. The disc and the Chebyshev metric are both symmetric about
    //    the centre column, so the two halves carry exactly equal pixel counts and equal weights.
    const split = syntheticStudio( ( x, y, centre, depth ) => depth > BAND_RADIUS
        ? null
        : ( x < centre ? SYNTHETIC.blueRim : SYNTHETIC.warmRim ), true );
    const splitMeasured = measureViolet( split.plate, split.background );
    const splitPrediction = predictedCircularVariance( SYNTHETIC.blueRim, SYNTHETIC.warmRim, 0.5 );

    check( 'split: blue on one side, warm on the other, scores 1 − cos(Δ/2)',
        `predicted ${ splitPrediction.toFixed( 12 ) }, measured ${ splitMeasured.band.circularVariance.toFixed( 12 ) } ` +
        `(Δ ${ separation.toFixed( 4 ) }°)`,
        Math.abs( splitMeasured.band.circularVariance - splitPrediction ) < VARIANCE_TOLERANCE );

    check( 'and it SEPARATES from uniform in the direction the fix moves',
        `uniform ${ uniformMeasured.band.circularVariance.toFixed( 6 ) } -> split ` +
        `${ splitMeasured.band.circularVariance.toFixed( 6 ) }: asymmetry raises V`,
        splitMeasured.band.circularVariance > uniformMeasured.band.circularVariance + 0.5 );

    // 3. THREE-ONE — three quarters blue. Four-fold symmetry makes each quadrant exactly a quarter
    //    of the band, so the mixture is exact and the operator has to be MONOTONIC rather than
    //    merely able to tell two cases apart.
    const threeOne = syntheticStudio( ( x, y, centre, depth ) => depth > BAND_RADIUS
        ? null
        : ( x >= centre && y >= centre ? SYNTHETIC.warmRim : SYNTHETIC.blueRim ) );
    const threeOneMeasured = measureViolet( threeOne.plate, threeOne.background );
    const threeOnePrediction = predictedCircularVariance( SYNTHETIC.blueRim, SYNTHETIC.warmRim, 0.75 );

    check( 'three-one: warming ONE QUADRANT scores the exact three-quarter mixture',
        `predicted ${ threeOnePrediction.toFixed( 12 ) }, measured ` +
        `${ threeOneMeasured.band.circularVariance.toFixed( 12 ) }`,
        Math.abs( threeOneMeasured.band.circularVariance - threeOnePrediction ) < VARIANCE_TOLERANCE );

    check( 'and V is monotonic in how much of the outline disagrees',
        `0 warmed ${ uniformMeasured.band.circularVariance.toFixed( 6 ) } < ` +
        `1/4 warmed ${ threeOneMeasured.band.circularVariance.toFixed( 6 ) } < ` +
        `1/2 warmed ${ splitMeasured.band.circularVariance.toFixed( 6 ) }`,
        uniformMeasured.band.circularVariance < threeOneMeasured.band.circularVariance
            && threeOneMeasured.band.circularVariance < splitMeasured.band.circularVariance );

    // 4. The key-side detector, and the two rotations it decides the sign of. `split` brightened its
    //    RIGHT interior, and the right half of its band is the WARM one.
    check( 'the key side is MEASURED off the plate rather than assumed from the rig',
        `detected '${ splitMeasured.key.side }', interior luma L ${ splitMeasured.key.leftInteriorLuma.toFixed( 4 ) } ` +
        `vs R ${ splitMeasured.key.rightInteriorLuma.toFixed( 4 ) }, margin ` +
        `${ ( splitMeasured.key.margin * 100 ).toFixed( 2 ) }%`,
        splitMeasured.key.side === 'right' && splitMeasured.key.ambiguous === false );

    const warmRotation = signedHueRotation( skin, warm );
    check( 'keySideHueRotation is the signed skin-to-band angle on the KEY side',
        `predicted ${ warmRotation.toFixed( 9 ) }°, measured ` +
        `${ splitMeasured.band.keySideHueRotation.toFixed( 9 ) }°`,
        Math.abs( splitMeasured.band.keySideHueRotation - warmRotation ) < ANGLE_TOLERANCE_DEGREES );

    check( 'and the two sides\' hues separate by exactly the palette separation',
        `predicted ${ separation.toFixed( 9 ) }°, measured ${ splitMeasured.band.sideSeparation.toFixed( 9 ) }° ` +
        `(key ${ splitMeasured.band.keySide.meanHue.toFixed( 4 ) }°, shadow ` +
        `${ splitMeasured.band.shadowSide.meanHue.toFixed( 4 ) }°)`,
        Math.abs( splitMeasured.band.sideSeparation - separation ) < ANGLE_TOLERANCE_DEGREES );

    check( 'a one-hue outline separates the two sides by ZERO, which is the defect stated as a number',
        `uniform side separation ${ uniformMeasured.band.sideSeparation.toExponential( 3 ) }° against ` +
        `split's ${ splitMeasured.band.sideSeparation.toFixed( 4 ) }°`,
        Math.abs( uniformMeasured.band.sideSeparation ) < ANGLE_TOLERANCE_DEGREES );

    // 5. The footprint statistic, which is the one that CAN see "there is no rim". Its prediction is
    //    an identity rather than a recorded value: on `uniform` every band pixel is cool and no
    //    other subject pixel is, so the share must equal band px ÷ subject px exactly.
    const unrimmed = syntheticStudio( () => null );
    const unrimmedMeasured = measureViolet( unrimmed.plate, unrimmed.background );
    const coolPrediction = uniformMeasured.band.pixels / uniformMeasured.subject.pixels;

    check( 'coolShare counts exactly the rimmed band on a blue-rimmed disc, and EXACTLY 0 with no rim',
        `predicted ${ uniformMeasured.band.pixels }/${ uniformMeasured.subject.pixels } = ` +
        `${ ( coolPrediction * 100 ).toFixed( 6 ) }%, measured ` +
        `${ ( uniformMeasured.subject.coolShare * 100 ).toFixed( 6 ) }%; unrimmed ` +
        `${ ( unrimmedMeasured.subject.coolShare * 100 ).toFixed( 6 ) }%`,
        Math.abs( uniformMeasured.subject.coolShare - coolPrediction ) < VARIANCE_TOLERANCE
            && unrimmedMeasured.subject.coolShare === 0 );

    // 6. 🚩 THE BLIND SPOT, MEASURED RATHER THAN ADMITTED. This is the row to read before quoting V.
    check( '🚩 BLIND SPOT: circular variance CANNOT tell "no rim" from "one perfect rim"',
        `unrimmed V ${ unrimmedMeasured.band.circularVariance.toExponential( 3 ) } and uniform V ` +
        `${ uniformMeasured.band.circularVariance.toExponential( 3 ) } are the SAME number — a band of ` +
        'one hue is a band of one hue whether the hue came from a light or from skin. V states ' +
        'ONE HUE; coolShare and keySideHueRotation state WHOSE hue. Never quote V alone.',
        Math.abs( unrimmedMeasured.band.circularVariance - uniformMeasured.band.circularVariance ) < VARIANCE_TOLERANCE );

    // 7. And the second blind spot, which is in the judges' own sentence: "CONSTANT WIDTH".
    const narrow = syntheticStudio(
        ( x, y, centre, depth ) => depth <= SYNTHETIC.narrowRadius ? SYNTHETIC.blueRim : null );
    const narrowMeasured = measureViolet( narrow.plate, narrow.background,
        { bandRadius: SYNTHETIC.narrowRadius } );

    check( '🚩 BLIND SPOT: V is indifferent to band WIDTH, which is a third of the complaint',
        `an ${ BAND_RADIUS } px rim and a ${ SYNTHETIC.narrowRadius } px rim of the same hue score the SAME V ` +
        `(${ uniformMeasured.band.circularVariance.toExponential( 3 ) } / ` +
        `${ narrowMeasured.band.circularVariance.toExponential( 3 ) }), each read over its own band. ` +
        `The width clause is depthProfile's: wide ${ profileFalloff( uniformMeasured ) }, ` +
        `narrow ${ profileFalloff( narrowMeasured ) }`,
        Math.abs( narrowMeasured.band.circularVariance - uniformMeasured.band.circularVariance ) < VARIANCE_TOLERANCE );

    // 8. 🚩 THE THIRD BLIND SPOT, AND IT IS THE ONE THAT DECIDES WHETHER V CAN BE THE FIX'S GATE.
    //
    //    Every case above paints the WHOLE band one colour, and no real rim does. Measured on the
    //    shipped portrait plate: the band's mean saturation is 0.286 against a rim colour at 0.941,
    //    so an 8 px band is roughly four fifths SKIN and one fifth rim. Under that dilution the
    //    dominant disagreement inside the band is skin-against-rim, not side-against-side — and
    //    warming one side makes that side's band agree MORE with its own skin. So V can FALL while
    //    the picture improves.
    //
    //    That is not a hypothesis. Both arms are painted below at a known 2 px rim inside an 8 px
    //    band, both predictions are closed form over integer pixel counts taken off the same
    //    distance transform, and the two assertions are that V moves DOWN while sideSeparation
    //    moves UP. It is exactly what the two real plates then do.
    const DILUTE_RIM_DEPTH = 2;
    const diluteRim = ( colour ) => ( x, y, centre, depth ) =>
        depth >= 1 && depth <= DILUTE_RIM_DEPTH ? colour : null;

    const diluteUniform = syntheticStudio( diluteRim( SYNTHETIC.blueRim ), true );
    const diluteSplit = syntheticStudio( ( x, y, centre, depth ) => depth >= 1 && depth <= DILUTE_RIM_DEPTH
        ? ( x < centre ? SYNTHETIC.blueRim : SYNTHETIC.warmRim )
        : null, true );

    const composition = bandComposition( diluteUniform, DILUTE_RIM_DEPTH, BAND_RADIUS );
    const bandTotal = composition.key.rim + composition.key.skin
        + composition.shadow.rim + composition.shadow.skin;

    const diluteUniformMeasured = measureViolet( diluteUniform.plate, diluteUniform.background );
    const diluteSplitMeasured = measureViolet( diluteSplit.plate, diluteSplit.background );

    // ⚠️ THE TWO SKIN TRIPLES ARE PREDICTED SEPARATELY, and the reason is a real 1.2e-9 disagreement
    // this validation reported when they were not. `skin` and `skinKeySide` are mathematically the
    // same hue and saturation — that is the whole point of them being 6x and 7x one reduced triple
    // — but they are NOT bit-identical once each is quantised to float32 and put through a division,
    // and 3,600 pixels of the difference is visible at the ninth decimal. Folding them into one
    // component would have been a prediction of a plate that was not painted.
    const diluteUniformPrediction = predictedCircularStatistics( [
        { rgb: SYNTHETIC.blueRim, share: ( composition.key.rim + composition.shadow.rim ) / bandTotal },
        { rgb: SYNTHETIC.skinKeySide, share: composition.key.skin / bandTotal },
        { rgb: SYNTHETIC.skin, share: composition.shadow.skin / bandTotal }
    ] );

    const diluteSplitPrediction = predictedCircularStatistics( [
        { rgb: SYNTHETIC.blueRim, share: composition.shadow.rim / bandTotal },
        { rgb: SYNTHETIC.warmRim, share: composition.key.rim / bandTotal },
        { rgb: SYNTHETIC.skinKeySide, share: composition.key.skin / bandTotal },
        { rgb: SYNTHETIC.skin, share: composition.shadow.skin / bandTotal }
    ] );

    check( 'dilute: a 2 px rim inside an 8 px band scores the exact skin/rim mixture',
        `band ${ bandTotal } px = ${ composition.key.rim + composition.shadow.rim } rim + ` +
        `${ composition.key.skin + composition.shadow.skin } skin. predicted ` +
        `${ diluteUniformPrediction.circularVariance.toFixed( 12 ) }, measured ` +
        `${ diluteUniformMeasured.band.circularVariance.toFixed( 12 ) }`,
        Math.abs( diluteUniformMeasured.band.circularVariance
            - diluteUniformPrediction.circularVariance ) < VARIANCE_TOLERANCE );

    check( 'and warming ONE side of that diluted band scores its exact three-way mixture too',
        `predicted ${ diluteSplitPrediction.circularVariance.toFixed( 12 ) }, measured ` +
        `${ diluteSplitMeasured.band.circularVariance.toFixed( 12 ) }`,
        Math.abs( diluteSplitMeasured.band.circularVariance
            - diluteSplitPrediction.circularVariance ) < VARIANCE_TOLERANCE );

    check( '🚩 BLIND SPOT: on a DILUTED band, warming one side takes V DOWN — the wrong way',
        `uniform V ${ diluteUniformMeasured.band.circularVariance.toFixed( 6 ) } -> split V ` +
        `${ diluteSplitMeasured.band.circularVariance.toFixed( 6 ) }. The band is mostly SKIN, so V is ` +
        'dominated by skin-against-rim inside each side rather than by side-against-side, and the ' +
        'fix reduces the first faster than it creates the second. V IS NOT THE FIX\'S GATE.',
        diluteSplitMeasured.band.circularVariance < diluteUniformMeasured.band.circularVariance );

    check( '🎯 and sideSeparation moves the RIGHT way on the same pair, which is why it is the headline',
        `uniform ${ diluteUniformMeasured.band.sideSeparation.toFixed( 4 ) }° -> split ` +
        `${ diluteSplitMeasured.band.sideSeparation.toFixed( 4 ) }°`,
        diluteSplitMeasured.band.sideSeparation > diluteUniformMeasured.band.sideSeparation + 1
            && Math.abs( diluteUniformMeasured.band.sideSeparation ) < ANGLE_TOLERANCE_DEGREES );

    check( 'and depthProfile IS the discriminator the variance is not',
        `at depth ${ SYNTHETIC.narrowRadius + 1 }: wide rim S ` +
        `${ uniformMeasured.band.depthProfile[ SYNTHETIC.narrowRadius ].meanSaturation.toFixed( 4 ) } vs ` +
        `narrow rim S ${ narrowMeasured.band.depthProfile[ SYNTHETIC.narrowRadius ].meanSaturation.toFixed( 4 ) } ` +
        `(bare skin is ${ hsvOf( SYNTHETIC.skin ).saturation.toFixed( 4 ) })`,
        Math.abs( narrowMeasured.band.depthProfile[ SYNTHETIC.narrowRadius ].meanSaturation
            - hsvOf( SYNTHETIC.skin ).saturation ) < 1e-6
            && Math.abs( uniformMeasured.band.depthProfile[ SYNTHETIC.narrowRadius ].meanSaturation
                - hsvOf( SYNTHETIC.blueRim ).saturation ) < 1e-6 );

    const failed = results.filter( ( row ) => row.passed === false ).length;
    console.log( `\n  ${ failed === 0 ? 'VALIDATION PASS' : 'VALIDATION FAIL' }: ` +
        `${ results.length - failed }/${ results.length }\n` );

    return failed;

}

/** How far the band's saturation has fallen by the time the profile reaches the interior. */
function profileFalloff( measured ) {

    const shells = measured.band.depthProfile;
    if ( shells.length < 2 ) return 'n/a';

    const first = shells[ 0 ].meanSaturation;
    const last = shells[ shells.length - 1 ].meanSaturation;

    return `${ first.toFixed( 4 ) } -> ${ last.toFixed( 4 ) } by depth ${ shells[ shells.length - 1 ].depth }`;

}

// --- the report ------------------------------------------------------------------------------------

function reportMeasurement( measured, provenance ) {

    const percent = ( value ) => `${ ( value * 100 ).toFixed( 4 ) }%`;
    const degrees = ( value ) => value === null ? 'n/a' : `${ value.toFixed( 4 ) }°`;

    console.log( '--- §PROVENANCE -------------------------------------------------------------\n' );
    for ( const [ key, value ] of Object.entries( provenance ) ) {

        console.log( `  ${ key.padEnd( 12 ) } ${ value }` );

    }

    console.log( '\n  ⚠️  A SUBJECT MASK NEEDS A SUBJECT-REMOVED PLATE, and `lighting.html?figure=0` is the' );
    console.log( '      only place in this repository that produces one. `alive.html` — the page G1-G7 are' );
    console.log( '      measured on — has no such flag, so REQ-060\'s hue numbers and its G1/G2 numbers were' );
    console.log( '      taken on two different pages and are not comparable as pixels.\n' );

    console.log( '--- §MEASUREMENT ------------------------------------------------------------\n' );
    console.log( `  frame            ${ measured.frame.width }x${ measured.frame.height }, band radius ` +
        `${ measured.settings.bandRadius } px = ${ ( measured.frame.bandRadiusAsFrameHeight * 100 ).toFixed( 3 ) }% of frame height` );
    console.log( `  subject          ${ measured.subject.pixels } px, ${ percent( measured.subject.shareOfFrame ) } of the frame` );
    console.log( `  key side         ${ measured.key.side }${ measured.key.ambiguous ? '  ⚠️ AMBIGUOUS' : '' }` +
        `  (interior luma L ${ measured.key.leftInteriorLuma.toFixed( 4 ) } vs R ` +
        `${ measured.key.rightInteriorLuma.toFixed( 4 ) }, margin ${ percent( measured.key.margin ) })` );

    console.log( '\n  1. FOOTPRINT — subject pixels in a cool hue at S > 0.10' );
    console.log( `     cool share    ${ percent( measured.subject.coolShare ) }   [arc ${ COOL_HUE_ARC[ 0 ] }-${ COOL_HUE_ARC[ 1 ] }°, S > ${ SATURATION_FLOOR }]` );
    for ( const entry of measured.subject.coolShareByArc ) {

        console.log( `                   ${ entry.name }  ${ percent( entry.share ) }` );

    }

    console.log( '\n  2. 🎯 SYMMETRY — how far the two sides of the silhouette band disagree' );
    console.log( `     key side      ${ degrees( measured.band.keySide.meanHue ) }  over ${ measured.band.keySide.pixels } px` );
    console.log( `     shadow side   ${ degrees( measured.band.shadowSide.meanHue ) }  over ${ measured.band.shadowSide.pixels } px` );
    console.log( `     SEPARATION    ${ degrees( measured.band.sideSeparation ) }   🎯 0° is "both back lights are the same blue" — REQ-060's thesis as a number` );

    console.log( '\n  3. CIRCULAR VARIANCE of hue around the band — read this WITH §2, never instead of it' );
    console.log( `     V total       ${ measured.band.circularVariance === null ? 'n/a' : measured.band.circularVariance.toFixed( 6 ) }` +
        `   (R ${ measured.band.resultantLength === null ? 'n/a' : measured.band.resultantLength.toFixed( 6 ) }, ` +
        `${ measured.band.pixels } band px, mean hue ${ degrees( measured.band.meanHue ) })` );
    console.log( `     V key side    ${ measured.band.keySide.circularVariance === null ? 'n/a' : measured.band.keySide.circularVariance.toFixed( 6 ) }` );
    console.log( `     V shadow side ${ measured.band.shadowSide.circularVariance === null ? 'n/a' : measured.band.shadowSide.circularVariance.toFixed( 6 ) }` );
    console.log( `     chroma cover  ${ percent( measured.band.chromaCoverage ) }   the share of the band carrying any hue — the "WHOLE silhouette" clause` );
    console.log( '     ⚠️  V FALLS WHEN ONE SIDE IS WARMED on a band this dilute. The band is mostly skin,' );
    console.log( '         so V is dominated by skin-against-rim WITHIN each side. See §VALIDATION `dilute`.' );

    console.log( '\n  4. ROTATION — the key-side band against the key-side interior skin' );
    console.log( `     interior hue  ${ degrees( measured.band.keySideInterior.meanHue ) }  over ${ measured.band.keySideInterior.pixels } px deeper than ${ measured.settings.interiorDepth } px` );
    console.log( `     rotation      ${ degrees( measured.band.keySideHueRotation ) }   REQ-060 records -39.4000° shipped, -18.6000° with a warm kicker` );

    console.log( '\n  5. WIDTH — mean band saturation, shell by shell inward from the silhouette' );
    const shells = measured.band.depthProfile;
    const sampled = shells.filter( ( shell ) => shell.depth === 1 || shell.depth % 4 === 0 );
    for ( const shell of sampled ) {

        console.log( `     depth ${ String( shell.depth ).padStart( 2 ) }      S ${ shell.meanSaturation.toFixed( 4 ) }  ` +
            `hue ${ degrees( shell.meanHue ) }  ${ shell.pixels } px` );

    }
    if ( shells.length >= 2 ) {

        console.log( `     falloff       S ${ shells[ 0 ].meanSaturation.toFixed( 4 ) } at depth 1 -> ` +
            `${ shells[ shells.length - 1 ].meanSaturation.toFixed( 4 ) } at depth ${ shells[ shells.length - 1 ].depth } ` +
            `= ${ ( shells[ 0 ].meanSaturation / shells[ shells.length - 1 ].meanSaturation ).toFixed( 4 ) }x` );

    }

    console.log( '\n  6. SPILL — the band OUTSIDE the silhouette (dilate the mask, subtract it)' );
    console.log( `     hue           ${ degrees( measured.backdropSpill.meanHue ) }  over ${ measured.backdropSpill.pixels } px, ` +
        `chroma cover ${ percent( measured.backdropSpill.chromaCoverage ) }` );
    console.log( '' );

}

// --- shooting the two plates -----------------------------------------------------------------------

/**
 * The beauty plate and the subject-removed plate, from `lighting.html`, at 900x1200.
 *
 * The size is REQ-060's and `LightingRig.js`'s: every hue table in that file is stated at 900x1200
 * against a `?figure=0` mask, and `BAND_RADIUS` is a pixel count, so a plate of another size is not
 * comparable with any of them without saying so.
 *
 * Both plates carry the SAME `--query`. A mask shot at one rig and a beauty plate shot at another
 * would put the rim's own change into the mask, and every number here would then be measured over a
 * different set of pixels in each arm.
 */
async function shootPlates( outputDirectory, options ) {

    const playwright = await loadPlaywright();
    const server = options.url === null ? await startVite() : { origin: options.url, stop: () => {} };
    // 🚩 `/src/lighting.html`, NOT `/lighting.html`. Vite's root is `packages/testbed`, and only
    // `alive.html` and `index.html` sit at that root — every other testbed page lives one directory
    // down in `src/`. The wrong path 404s and the page then never sets `__LIGHTING_READY__`, which
    // presents as a 120 s readiness timeout rather than as a missing file.
    const base = `${ server.origin }/src/lighting.html?bare&w=${ options.width }&h=${ options.height }${ options.query }`;

    const browser = await playwright.chromium.launch( {
        channel: 'chromium',                  // headless_shell has no GPU and therefore no WebGPU
        headless: true,
        args: [ '--enable-unsafe-webgpu', '--ignore-gpu-blocklist', '--hide-scrollbars' ]
    } );

    fs.mkdirSync( outputDirectory, { recursive: true } );
    const manifest = { page: 'lighting.html', width: options.width, height: options.height,
        query: options.query, urls: {}, plates: {} };

    try {

        const page = await browser.newPage( {
            viewport: { width: options.width, height: options.height },
            deviceScaleFactor: 1,
            colorScheme: 'dark',
            reducedMotion: 'no-preference'
        } );

        const problems = [];
        page.on( 'pageerror', ( error ) => problems.push( String( error ) ) );

        for ( const [ name, url ] of [ [ 'plate', base ], [ 'background', `${ base }&figure=0` ] ] ) {

            await page.goto( url, { waitUntil: 'load' } );

            // 🚩 `__LIGHTING_READY__` IS NOT "THE PICTURE EXISTS". `lighting.js` sets the flag and
            // THEN awaits `installFrameClock`, so the flag is true for a whole probe before the
            // first frame is drawn — measured: a screenshot taken two animation frames after READY
            // came back a 5,823-byte flat field, and the beauty plate and the `?figure=0` plate had
            // the SAME sha256 because neither had drawn anything. The wait that means something is
            // the renderer's own triangle count.
            await page.waitForFunction(
                () => globalThis.__LIGHTING__?.stage?.renderer?.info?.render?.triangles > 0,
                null, { timeout: 120000, polling: 200 } );

            await page.evaluate( () => new Promise( ( resolve ) => requestAnimationFrame(
                () => requestAnimationFrame( () => requestAnimationFrame( resolve ) ) ) ) );

            manifest.urls[ name ] = url;

            // 🚩 THE CANVAS, NOT THE PAGE. `lighting.html` insets `#stage` by a 16 px margin, so a
            // viewport screenshot at 900x1200 clips 16 px off two sides of the plate and pads the
            // other two with page background — measured on the shipped page, canvas box at
            // (16, 16, 900, 1200). An element screenshot is 1:1 with the buffer, which is the
            // contract `lighting.js` states beside its own canvas sizing.
            //
            // Shot TWICE. Nothing on this page animates, so two shots of one load must be identical
            // and a residue means the plate is not a plate. Cheap, and the alternative is finding
            // out from a number that moved for no reason.
            const shots = [];

            for ( let attempt = 0; attempt < 2; attempt ++ ) {

                shots.push( await page.locator( '#stage' ).screenshot( { timeout: 120000 } ) );

            }

            const file = path.join( outputDirectory, `${ name }.png` );
            fs.writeFileSync( file, shots[ 0 ] );

            const digests = shots.map( ( png ) => createHash( 'sha256' ).update( png ).digest( 'hex' ) );

            manifest.plates[ name ] = {
                file: path.relative( REPO_ROOT, file ),
                sha256: digests[ 0 ],
                bytes: shots[ 0 ].length,
                stillOnTwoShots: digests[ 0 ] === digests[ 1 ]
            };

            console.log( `  ${ name.padEnd( 12 ) } ${ digests[ 0 ].slice( 0, 16 ) }  ${ shots[ 0 ].length } bytes  ` +
                `${ digests[ 0 ] === digests[ 1 ] ? 'still on two shots' : '⚠️ TWO SHOTS DIFFER' }` );

            if ( name === 'plate' ) {

                manifest.rig = await page.evaluate( () => globalThis.__LIGHTING_INFO__?.() ?? null );

            }

        }

        if ( manifest.plates.plate.sha256 === manifest.plates.background.sha256 ) {

            throw new Error( 'the beauty plate and the ?figure=0 plate are byte-identical — ' +
                'nothing was masked, so neither plate drew the figure' );

        }

        manifest.pageProblems = problems;
        if ( problems.length > 0 ) console.log( `\n  page errors:\n    ${ problems.join( '\n    ' ) }` );

    } finally {

        await browser.close();
        server.stop();

    }

    fs.writeFileSync( path.join( outputDirectory, 'manifest.json' ), `${ JSON.stringify( manifest, null, 2 ) }\n` );

    return manifest;

}

function startVite() {

    return new Promise( ( resolve, reject ) => {

        const child = spawn( 'npx', [ 'vite', '--port', '0', '--strictPort=false' ], {
            cwd: REPO_ROOT,
            stdio: [ 'ignore', 'pipe', 'pipe' ]
        } );

        const stop = () => child.kill( 'SIGTERM' );
        const timer = setTimeout( () => { stop(); reject( new Error( 'vite did not report a URL within 60 s' ) ); }, 60000 );

        child.stdout.setEncoding( 'utf8' );
        child.stdout.on( 'data', ( chunk ) => {

            const match = /(http:\/\/localhost:\d+)/.exec( chunk );

            if ( match !== null ) {

                clearTimeout( timer );
                resolve( { origin: match[ 1 ], stop } );

            }

        } );

        child.on( 'error', reject );

    } );

}

/** Playwright is not a dependency of this repo; it is looked up wherever it happens to live. */
async function loadPlaywright() {

    const candidates = [ 'playwright' ];
    if ( process.env.PLAYWRIGHT_MODULE ) candidates.unshift( process.env.PLAYWRIGHT_MODULE );

    const cache = path.join( process.env.HOME ?? '', '.npm', '_npx' );

    if ( fs.existsSync( cache ) ) {

        for ( const entry of fs.readdirSync( cache ) ) {

            const candidate = path.join( cache, entry, 'node_modules', 'playwright' );
            if ( fs.existsSync( candidate ) ) candidates.push( candidate );

        }

    }

    for ( const candidate of candidates ) {

        try {

            const namespace = await import( candidate.startsWith( '/' )
                ? `${ candidate }/index.js` : candidate );
            const unwrapped = namespace.chromium ? namespace : namespace.default;
            if ( unwrapped?.chromium ) return unwrapped;

        } catch {

            // try the next candidate; the error only matters if they all fail

        }

    }

    throw new Error( 'playwright not resolvable. Install it and pass PLAYWRIGHT_MODULE=<path>.' );

}

// --- CLI ---------------------------------------------------------------------------------------------

function parseArguments( argv ) {

    const options = { plate: null, background: null, shoot: null, json: null, url: null,
        query: '', width: 900, height: 1200, selftest: false,
        bandRadius: BAND_RADIUS, interiorDepth: INTERIOR_DEPTH, move: MASK_MOVE };

    for ( let index = 0; index < argv.length; index ++ ) {

        const token = argv[ index ];

        if ( token === '--selftest' ) { options.selftest = true; continue; }

        const key = token.replace( /^--/, '' );
        const value = argv[ index + 1 ];

        if ( Object.hasOwn( options, key ) === false ) throw new Error( `unknown option ${ token }` );

        options[ key ] = typeof options[ key ] === 'number' ? Number( value ) : value;
        index += 1;

    }

    return options;

}

async function main() {

    const options = parseArguments( process.argv.slice( 2 ) );

    // 🚩 THE VALIDATIONS RUN FIRST AND ON EVERY INVOCATION, measurement runs included. A statistic
    // this project has burned itself on eight times does not get to report a number about a render
    // before it has reported its own arithmetic.
    if ( runValidations() > 0 ) {

        console.error( 'violet: the operator failed its own validation. No measurement is reported.\n' );
        process.exit( 1 );

    }

    if ( options.selftest === true ) return;

    let plateFile = options.plate;
    let backgroundFile = options.background;
    let shot = null;

    if ( options.shoot !== null ) {

        console.log( `--- §SHOOT: lighting.html at ${ options.width }x${ options.height } ---\n` );
        shot = await shootPlates( options.shoot, options );
        plateFile = path.join( options.shoot, 'plate.png' );
        backgroundFile = path.join( options.shoot, 'background.png' );
        console.log( '' );

    }

    if ( plateFile === null || backgroundFile === null ) {

        console.error( '\nviolet: needs --plate and --background, or --shoot <dir>. See the header.\n' );
        process.exit( 2 );

    }

    const plate = decodePng( fs.readFileSync( plateFile ) );
    const background = decodePng( fs.readFileSync( backgroundFile ) );
    const measured = measureViolet( plate, background, options );

    reportMeasurement( measured, {
        plate: path.relative( REPO_ROOT, plateFile ),
        background: path.relative( REPO_ROOT, backgroundFile ),
        sha256: createHash( 'sha256' ).update( fs.readFileSync( plateFile ) ).digest( 'hex' ).slice( 0, 16 ),
        query: shot === null ? '(plate supplied by hand)' : `src/lighting.html?bare${ options.query }`
    } );

    if ( options.json !== null ) {

        fs.writeFileSync( options.json, `${ JSON.stringify( { measured, shot }, null, 2 ) }\n` );
        console.log( `  json          ${ options.json }\n` );

    }

}

// 🚩 GUARDED, and `fileURLToPath` rather than string surgery on `import.meta.url`: this repository's
// own path carries a non-ASCII character, so `import.meta.url` arrives percent-encoded and a naive
// comparison never matches. The guard is what lets `measureViolet` be imported by a future gate
// without the import running a browser. Same shape as `band-power.mjs`'s.
if ( process.argv[ 1 ] && fileURLToPath( import.meta.url ) === path.resolve( process.argv[ 1 ] ) ) {

    main().catch( ( error ) => {

        console.error( `\nviolet: ${ error.message }\n` );
        process.exit( 2 );

    } );

}
