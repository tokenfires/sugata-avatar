#!/usr/bin/env node
//
// rejudge.mjs — puts the eye back on the question the eye found.
//
// ## The gap this closes
//
// In round 10 three blind judges, none with any context on this project, were each shown our
// figure beside a reference and asked what separated them. All three put "nothing worn by the
// figure casts any shadow onto the body" in their top three, and all three named the same instance
// unprompted: a fedora sitting directly above a fully lit forehead.
//
// Round 11 fixed it in `packages/core/src/wardrobe/Wardrobe.js` (`applyFragmentShading`) and proved
// the fix in rendered pixels — `packages/core/src/wardrobe/shadow.selftest.mjs` measures the
// forehead under the brim against the same forehead with the brim's shadow switched off. What
// round 11 did NOT do is put the finding back in front of the instrument that made it. Its
// re-judge stage pointed at a directory no stage had ever created, and the judge correctly refused
// to go hunting for one, because hunting would have destroyed the blind.
//
// So this tool builds the pair set that stage needed. It is a CAPTURE tool, not a gate: the gate
// on this defect is `shadow.selftest.mjs` and it measures luma. What this produces is evidence a
// person can look at, framed close enough that the thing under discussion is not four pixels tall.
//
// ## What one pair is
//
// Two plates of the same contact, from the same camera, in the same outfit, differing in exactly
// one thing: whether worn garments cast and receive shadows. One side is the library as it ships.
// The other is the round-10 defect reintroduced through the page's own `break` vocabulary — which
// clears `castShadow` or `receiveShadow` on every worn fragment, the state `Wardrobe.js` left every
// garment in for the whole of phase 9. The judge is choosing between the bug and the fix, and is
// told neither which is which nor that one of them is a bug.
//
// Which half of that flag pair a view reintroduces depends on the contact and is recorded per view
// in `VIEWS`: a brim darkening a forehead is the CAST half, a chin darkening a shirt collar is the
// RECEIVE half. The page has no composite break that clears both at once, which is what a single
// pair per contact would rather use; `docs/OPEN-REQUESTS.md` carries the request for one.
//
// The breaking is the PAGE's, deliberately, and not this tool's. `stageShadowProbe` in
// `packages/testbed/src/wardrobe.js` snapshots the flags each object arrived with before any break
// runs and restores from that snapshot every call, so a plate captured here renders whatever the
// library set — never what an instrument set on its way past. A tool that assigned `castShadow`
// itself would photograph its own repair. The full vocabulary the page accepts, read off its
// source rather than assumed: `none`, `garment-cast`, `garment-receive`, `body-receive`,
// `garment-ao`.
//
// ## Why every pair is measured before it is published
//
// A blind pair whose two images are identical is worse than no pair: the judge reports "these look
// the same to me", the report reads as a null result, and nobody can tell a working renderer from
// a broken capture harness. So each pair is diffed in rendered pixels before it is blinded, and a
// view whose two sides do not separate is REFUSED rather than shipped — see `MINIMUM_CHANGED`,
// `MINIMUM_PEAK`, and the `--noise` mode that says what this page's frame-to-frame residue is.
//
// ONE of the seven views refuses on the tree as it ships today — `sleeve-arm`, and the `VIEWS`
// comment carries the measurement and the cause. Three refused when this tool was written; the
// `material.shadowSide` defect it diagnosed has since been fixed in `Wardrobe.js`, and `hem-thigh`
// and `cuff-wrist` publish. That is the report, not a fault in the run.
//
// ## A refusal has to say WHY, and the why has to be re-derivable
//
// R12 refused `sleeve-arm` and wrote a cause into `VIEWS` that it had inferred rather than
// measured — that the sleeve hem stood about a millimetre off the arm, a physical limit. R13
// measured it: 2.660 mm at the median, and the cause is the shadow map's normal bias instead. The
// wrong reason had sat in this file looking exactly like a right one, because nothing in the tool
// could check it. So the geometry the refusal rests on is now an instrument rather than a
// sentence: `--clearance` reads the shipped garment GLBs and prints the standoff distribution at
// every opening, and the numbers in `VIEWS` are that mode's output.
//
// ## The two guards, and the red proof each one has
//
// Both are measurements of rendered pixels, not readings of a flag — the strong half.
//
// SEPARATION. `node rejudge.mjs --defect none` makes the "defect" side the shipped side, so the
// pair is the library against itself. Measured: hat-forehead and chin-collar both read 0.000%
// changed, mean |Δluma| 0.00000, max 0.00000, and both were REFUSED. Put back, the same two views
// read 5.941% and 1.217% changed and both publish. `--noise` reports the same zero without the
// refusal, which is how the residue gets quoted rather than assumed.
//
// CAMERA HELD. Proved by reintroducing the defect at source: `capturePlate` for the second side was
// given `elevationDeg + 0.4`, one view was run, and it went red — "MOVED BETWEEN SIDES", REFUSED.
// The number that matters is the one on the line above it: 28.688% changed, max delta 0.93825. A
// four-tenths-of-a-degree camera drift sails past the separation floor by a factor of fifty while
// showing a judge a parallax and not a shadow, which is exactly why the camera is asserted rather
// than trusted. The file was restored byte-identically (sha256 e5d159f9…) and read 5.941% green.
//
// ## Usage
//
//   node tools/critic/rejudge.mjs                     # every view, captured, measured, blinded
//   node tools/critic/rejudge.mjs --only hat-forehead # one view
//   node tools/critic/rejudge.mjs --no-blind          # capture and measure, skip the blinding
//   node tools/critic/rejudge.mjs --noise             # the same side twice: the residue floor
//   node tools/critic/rejudge.mjs --clearance         # how far each contact stands off the body
//   node tools/critic/rejudge.mjs --list              # the views, without launching anything
//
// The pairs land in <out>/blind/<sessionId>/{a,b}.png and the answer key one level ABOVE them, at
// <out>/blind/<sessionId>.key.json — `blind_ab.mjs` puts it there on purpose, so a judge who lists
// the directory it was handed cannot stumble over the answer. Give the judge the images directory.
// Reveal only after the verdict is written down.

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { decodePng } from './png.mjs';
import { encodedLuma } from './color.mjs';

// fileURLToPath, not string surgery on the URL: this repository's path contains a space and a
// non-ASCII character, so import.meta.url arrives percent-encoded.
const THIS_FILE = fileURLToPath( import.meta.url );
const CRITIC_DIR = path.dirname( THIS_FILE );
const REPOSITORY_ROOT = path.resolve( CRITIC_DIR, '..', '..' );

const DEFAULT_OUT = path.join( REPOSITORY_ROOT, 'captures', 'rejudge-shadows' );

// Where `--clearance` reads its geometry from. Declared up here with the other module constants
// rather than beside `reportClearances`, because the entry point below runs at module evaluation
// and a `const` declared after it is still in its temporal dead zone when it is called.
const WARDROBE_DIR = path.join( REPOSITORY_ROOT, 'assets', 'wardrobe' );

/**
 * The figure the wardrobe page dresses, and therefore the only one whose fragments these views ever
 * render. Read off `packages/testbed/src/wardrobe.js` — `new Wardrobe( ..., { figureKey: 'g050' } )`
 * — rather than assumed, because a fragment cut for a different identity is a different garment and
 * `--clearance` would be measuring one the judge never saw.
 */
const FIGURE_KEY = 'g050';

const GPU_FLAGS = [ '--enable-unsafe-webgpu', '--ignore-gpu-blocklist', '--hide-scrollbars' ];

// The page is a two-column grid: a flexible viewport and a 460 px panel. Subtract the panel and the
// canvas is square, which is the shape a close-up of a contact wants — a contact is a patch, not a
// column. Device scale 2 because `Stage` clamps its pixel ratio at 2: asking for more would widen
// the screenshot without adding a rendered pixel, which is a bigger file pretending to be detail.
const PANEL_WIDTH = 460;
const CANVAS_EDGE = 800;
const VIEWPORT = { width: CANVAS_EDGE + PANEL_WIDTH, height: CANVAS_EDGE };
const DEVICE_SCALE = 2;

/**
 * How far apart the two sides of a pair have to read before the pair is fit to show anybody.
 *
 * TWO floors rather than one, because they answer different questions. `MINIMUM_CHANGED` asks
 * whether the difference is BIG ENOUGH TO FIND — 0.5% of a 1600x1600 plate is about 12,800 pixels,
 * a patch roughly 113 px square, which nobody has to hunt for. `MINIMUM_PEAK` asks whether it is
 * DEEP ENOUGH TO SEE — 0.05 encoded luma is thirteen 8-bit steps at the darkest changed pixel,
 * well past the point where a patch that size reads as a shadow rather than as dithering. A pair
 * that clears one and not the other is a pair a judge would strain over, and a judge straining is
 * how a verdict turns into a guess.
 *
 * ⚠️ FLOORS, NOT FITTED TO THE MEASUREMENTS — the run prints what each view actually scored, so a
 * later reader sees the margin rather than taking these constants' word for it. What they have to
 * clear on the other side is ZERO: `--noise` captures the SAME side twice and diffs it, and on this
 * page — forward path, no temporal AA, no grade, no jitter — that residue measured 0.0000% changed
 * with a max delta of 0.00000 at every view in this file. The plates are bit-identical. So these
 * floors are not separating signal from noise; there is no noise. They are separating a difference
 * a person can judge from one they cannot, which is a harder and more useful line.
 */
const MINIMUM_CHANGED = 0.005;
const MINIMUM_PEAK = 0.05;

/** A pixel counts as changed when its encoded luma moves by more than one 8-bit step. */
const CHANGED_THRESHOLD = 1 / 255;

/**
 * The contacts, what each one can show, and — where it can show nothing — the number that says so.
 *
 * Every view is a place where something worn touches, or nearly touches, the body, because that is
 * the only kind of place the round-10 finding is visible at all. A full-body plate is not evidence
 * here: at that framing this page renders about a millimetre per pixel, and a brim's shadow is a
 * smudge a judge would be right to discount. So each view puts the eye about a third of a metre
 * from the contact and lets it fill the frame.
 *
 * Each entry is:
 *   id            the session label, which a judge never sees
 *   contact       what a person is looking at, in plain language
 *   outfit        garment ids to dress in — 9.8's foundation layer is unioned in regardless
 *   breakage      WHICH HALF of the round-10 defect this contact can show. See below.
 *   target        the world point the camera looks at, in metres
 *   heightM       how much of the world the frame covers top to bottom, in metres
 *   azimuthDeg    degrees around the up axis from +Z. The key light sits at +X and above, so the
 *                 figure's LEFT side is the lit one and every off-centre view is of that side
 *   elevationDeg  degrees above the horizon. Shadows fall DOWNWARD off every edge here, so a
 *                 camera below a contact looks into the lit face of the cloth and misses the thing
 *                 being judged
 *
 * ## Why `breakage` is per view, and why two of the values are legitimate
 *
 * Round 10's defect was that worn garments carried NEITHER `castShadow` nor `receiveShadow` — three
 * defaults both to false and `Wardrobe.js` set neither. The page exposes those two halves
 * separately (`garment-cast`, `garment-receive`) and has no composite, so each view reintroduces
 * the half its own contact can express: a brim darkening a forehead is the CAST half, a chin
 * darkening a shirt collar is the RECEIVE half. Both are the original bug; neither is a
 * hypothetical. `docs/OPEN-REQUESTS.md` carries the request for a composite `garment-shadows`
 * break that clears both at once, which is what a single pair per contact would rather use.
 *
 * ## ✅ THE TUBE CONTACTS: WHAT THIS COMMENT USED TO SAY, AND WHAT IT SAYS NOW
 *
 * This block used to record three refusals — the sleeve, the cuff and the skirt hem — and name
 * `material.shadowSide` as the cause. **That diagnosis was reproduced independently and it was
 * right, the fix has landed in `Wardrobe.js` (`GARMENT_SHADOW_SIDE`), and `hem-thigh` now
 * publishes.** Measured this session, every number below re-derived rather than carried over:
 *
 *     view          before (shadowSide null)   after (DoubleSide)
 *     hem-thigh     0.000% changed, peak 0.00000   1.335% changed, peak 0.33627   PUBLISHES
 *     cuff-wrist    0.332% / 0.30253               0.469% / 0.36107   → reframed, see below
 *     sleeve-arm    0.171% / 0.04856               0.182% / 0.06555   REFUSES
 *     hat-forehead  5.941% / 0.46867               5.958% / 0.46867   PUBLISHES, as it always did
 *
 * The mechanism, confirmed here rather than taken on trust: three leaves `material.shadowSide` null
 * and both shadow paths then render the OPPOSITE of `material.side`, so a FrontSide garment cast
 * from its BACK faces only — the far wall of a tube, decimetres behind the limb inside it. The
 * proof is a sha256 rather than an argument: with `shadowSide` forced to BackSide the plates at
 * every view in this file are BIT-IDENTICAL to the ones the shipped library produced.
 *
 * ## ⚠️ `cuff-wrist` WAS REFRAMED, AND THAT IS A CHANGE TO THE INSTRUMENT — SAID OUT LOUD
 *
 * At `heightM: 0.26` the fixed library read 0.469% changed against a 0.500% floor: refused by four
 * thousandths of one per cent, on the AREA statistic. `heightM` is now 0.13. The peak delta did not
 * move — 0.36107 both times, because a peak is a per-pixel quantity and framing cannot touch it —
 * and the changed AREA went to 1.752%, a factor of 3.7 on a factor-of-4 change in magnification.
 * So the shadow is the same shadow; what was wrong was that the contact filled a sixteenth of the
 * frame, which is the under-fill this file's own preamble says every view exists to avoid.
 *
 * 🚩 **AND THE SAME TRICK WAS TRIED ON `sleeve-arm` AND MADE IT WORSE, WHICH IS WHY IT IS STILL AT
 * 0.30.** `heightM: 0.15` took it from 0.182% to 0.042% changed — the frame filled with lit arm and
 * left the contact in a corner. It is recorded here so a reader can see that the views were not
 * zoomed until they agreed: one contact was under-framed and one is genuinely faint.
 *
 * ## ❌ THE VIEW THAT STILL REFUSES — AND THE REASON THIS COMMENT GAVE FOR IT WAS WRONG
 *
 * `sleeve-arm` reads 0.182% changed over 4,654 pixels of a 2.56 M-pixel plate, with a peak of
 * 0.06555. It fails ONE of the two floors: the peak is seventeen 8-bit steps and clears 0.05 with
 * room to spare, and it is the AREA that comes up short against 0.500%. Something real is there
 * and there is not enough of it.
 *
 * 🚩 R12 WROTE HERE, FLAGGING IT AS AN INFERENCE IT HAD NOT MEASURED, that the sleeve hem "stands
 * roughly a millimetre off the arm" and that this was a physical limit like the 2.0 mm foundation
 * shell's. R13 MEASURED IT. BOTH HALVES ARE WRONG.
 *
 * **THE CLEARANCE**, off the shipped `assets/wardrobe/female_casualsuit01/g050.glb` against
 * `assets/wardrobe/body/g050.glb`, one distance per boundary vertex of the sleeve's own opening.
 * `node tools/critic/rejudge.mjs --clearance` re-derives every number in this block:
 *
 *     +X sleeve hem, 21 verts   min 0.565  p05 0.736  median 2.660  p95 7.509  max 7.827 mm
 *
 * The hem stands 2.660 mm off the arm at the median — LOOSER than the 2.0 mm foundation shell it
 * was compared to, not tighter, and nowhere near "roughly a millimetre".
 *
 * **THE ACTUAL SUPPRESSOR IS THE SHADOW MAP'S NORMAL BIAS, WHICH IS LARGER THAN THE CLEARANCE IT
 * HAS TO RESOLVE.** `packages/testbed/src/wardrobe.js` sets `light.shadow.normalBias = 0.004` —
 * four millimetres, in WORLD UNITS. Read off the primary artefact rather than remembered: three
 * r0.185.1 `src/nodes/lighting/ShadowNode.js` lines 508-517 build the receiver's shadow lookup as
 * `shadowPositionWorld + normalWorld * normalBias`, an unscaled world-space step along the
 * receiver's own normal. A patch of arm 2.660 mm under the hem has its sample point displaced 4 mm
 * out along that normal, which puts it ABOVE the hem, and it reads lit.
 *
 * Measured by driving `light.shadow.normalBias` from a Playwright session with NO FILE EDITED —
 * same camera, same outfit, same `none`-against-`garment-cast` pair this tool captures:
 *
 *     normalBias mm    4.0     3.0     2.0     1.5     1.0     0.5     0.0
 *     changed %       0.182   0.229   0.339   0.502   1.353   5.754  12.559
 *     peak Δluma     0.06555 0.10505 0.16558 0.17425 0.18325 0.21070 0.24096
 *
 * Not one vertex moved. Sixty-nine times the changed area and 3.7 times the peak came out of one
 * renderer constant, so this is not a limit on how wide a shadow the sleeve can cast.
 *
 * ## The ladder that makes the bias the explanation rather than a coincidence
 *
 * The three views where a garment's OWN HEM is the occluder and the skin immediately under it is
 * the receiver, so the hem's clearance IS the occluder-to-receiver distance the bias is compared
 * against. Clearances from `--clearance`, separations re-measured this round:
 *
 *     view          the opening it looks at    median clearance    changed %
 *     hem-thigh     elegant skirt hem              73.023 mm         1.335   publishes
 *     cuff-wrist    elegant cuff                    6.640 mm         1.752   publishes
 *     sleeve-arm    casual sleeve hem               2.660 mm         0.182   REFUSES
 *
 * ⚠️ The changed-% column is NOT comparable down the page — `cuff-wrist` is framed at 0.13 m and
 * the other two at 0.30 m, so it is magnified 2.3 times. The clearance column is the one to read.
 * The publish/refuse line falls between 6.640 mm and 2.660 mm, and the page's normal bias is 4.000
 * mm — inside that gap. Nothing else in the three views' configuration separates them that way.
 *
 * 🚩 AND THE STATISTIC IS OCCLUDER-TO-RECEIVER DISTANCE, NOT "THE OPENING'S CLEARANCE" — the
 * fedora is the case that proves the difference and it would have been easy to misread. Its one
 * opening, the sweatband ring, measures 2.157 mm at the median, UNDER the bias, and yet
 * `hat-forehead` is the strongest pair in the file. Nothing is wrong: the sweatband is not what
 * darkens the forehead. The BRIM is, and the brim's own standoff is the whole-mesh figure —
 * min 0.076, median 15.577, p95 29.472, max 41.293 mm — because a brim is an overhang and stands
 * off by its overhang. `chin-collar` is the same trap read the other way round: its occluder is
 * the CHIN and its receiver the collar, centimetres apart, and the collar opening's 2.503 mm has
 * nothing to do with it. Read `--clearance`'s per-view line only where a hem darkens the limb it
 * is wrapped around; everywhere else it is reporting the wrong pair of surfaces, and the "cm off
 * target" it prints beside each match is the warning that it might be.
 *
 * ## ⚠️ WHICH IS NOT AN ARGUMENT FOR TURNING THE BIAS DOWN, AND THE MEASUREMENT SAYS WHY
 *
 * Below the bias the page acnes, because the bias is what stops a curved skinned body
 * self-shadowing across its own shadow-map texels. Measured by diffing the SHIPPED side against
 * the shipped side at the page's own 4.0 mm — at 3.0 and 2.0 mm the change stays inside the
 * contact band (0.080% and 0.195% of frame, a 160 x 72 mm box on the sleeve); at 1.0 mm it covers
 * 1,132 rows of the plate and at 0.5 mm 1,294, spread over the whole figure. That is acne. So at
 * this page's 2048² map over a 2.4 m frustum — 1.1719 mm per texel — the bias cannot go low enough
 * to resolve a 2.660 mm standoff before it stops being a bias.
 *
 * 🎯 IT IS THE TEXEL, NOT THE STANDOFF. The bias that buys a given acne margin scales with the
 * texel's world footprint, so shrinking the texel buys the standoff back. Measured on the same
 * page, same runtime-only driving, map size against bias — SEPARATION is the pair this tool
 * judges, DRIFT is the shipped side against the page's 2048/4.0 mm baseline:
 *
 *     map    texel mm    bias mm    separation %   peak      drift %
 *     2048    1.1719       4.0         0.182      0.06555     0.000   ← as it ships
 *     2048    1.1719       0.5         5.754      0.21070     5.617   ← acned
 *     8192    0.2930       1.0         0.317      0.26079     0.182
 *     8192    0.2930       0.5         0.504      0.25941     0.369   ← separates, drift at the contact
 *
 * At a quarter the texel the sleeve clears the area floor at 0.5 mm of bias, with a drift SMALLER
 * than the separation and confined to the same contact band the 4 mm pair already darkens — that
 * is recovered shadow, not acne. So the contact is recoverable and the cost is shadow-map
 * resolution.
 *
 * ## Why the view stays in the file, refusing
 *
 * Because on the tree as it ships it refuses, and 0.182% is the honest number for that tree. The
 * fix is not this tool's to make: `SHADOW_NORMAL_BIAS` and `SHADOW_MAP_SIZE` live in
 * `packages/testbed/src/wardrobe.js`, changing them moves every other view's recorded figures and
 * `shadow.selftest.mjs`'s along with them, and an 8192² shadow map is a decision about the budget
 * rather than about this pair. R13 filed it as a request in its round report rather than writing
 * it into `docs/OPEN-REQUESTS.md`, which R13 did not own; a reader who cannot find it there should
 * assume it was never granted an id. A non-zero exit means "some contact still has nothing to
 * judge", which is exactly the state of the world it should be reporting — the difference from R12
 * is that the reason is now measured.
 *
 * 🚩 AND THE SAME CONSTANT IS FIVE TIMES LARGER IN THE SHIPPED RIG.
 * `packages/core/src/render/LightingRig.js` sets `shadowCaster.shadow.normalBias = 0.02` — twenty
 * millimetres, against a whole-garment standoff whose median `--clearance` puts at 3.934 mm for the
 * casual suit. This page is the friendly case. Nothing in this file measures the shipped rig and
 * nothing here should be read as having done so, but the arithmetic is the same arithmetic.
 *
 * ⚠️ THE TARGETS ARE READ OFF RENDERED PLATES, NOT OFF THE MANIFEST. The casual suit's sleeve is
 * SHORT — it ends mid-upper-arm — which the manifest's "long-sleeve dress shirt 0.25" clo row does
 * not tell you and one scouting plate does at a glance. The elegant suit's skirt hem sits near
 * y = 0.55 m, a good 17 cm below the head of the thigh bone; a target derived from the bone alone
 * framed nothing but cloth.
 */
const CASUAL = [ 'female_casualsuit01', 'shoes01', 'fedora01' ];
const ELEGANT = [ 'female_elegantsuit01', 'shoes01' ];

const VIEWS = [
    {
        id: 'hat-forehead',
        contact: 'the forehead under a fedora brim — the instance all three judges named',
        outfit: CASUAL,
        breakage: 'garment-cast',
        target: [ 0, 1.552, 0.068 ],
        heightM: 0.28,
        azimuthDeg: 12,
        elevationDeg: 4
    },
    {
        id: 'hat-temple',
        contact: 'the temple and the ear under the same brim, from the side',
        outfit: CASUAL,
        breakage: 'garment-cast',
        target: [ 0.05, 1.552, 0.025 ],
        heightM: 0.20,
        azimuthDeg: 50,
        elevationDeg: 8
    },
    {
        id: 'chin-collar',
        contact: 'the chin meeting the neck, over a shirt collar',
        outfit: CASUAL,
        breakage: 'garment-receive',
        target: [ 0.02, 1.378, 0.05 ],
        heightM: 0.24,
        azimuthDeg: 14,
        elevationDeg: 4
    },
    {
        id: 'collar-chest',
        contact: 'an open collar meeting the chest and the base of the neck',
        outfit: ELEGANT,
        breakage: 'garment-receive',
        target: [ 0, 1.31, 0.075 ],
        heightM: 0.22,
        azimuthDeg: 14,
        elevationDeg: 12
    },
    {
        id: 'sleeve-arm',
        contact: 'a short sleeve meeting the upper arm',
        outfit: CASUAL,
        breakage: 'garment-cast',
        target: [ 0.27, 1.20, 0.02 ],
        heightM: 0.30,
        azimuthDeg: 30,
        elevationDeg: 12
    },
    {
        id: 'cuff-wrist',
        contact: 'a shirt cuff meeting the wrist',
        outfit: ELEGANT,
        breakage: 'garment-cast',
        target: [ 0.43, 1.04, 0.13 ],
        heightM: 0.13,
        azimuthDeg: 30,
        elevationDeg: 14
    },
    {
        id: 'hem-thigh',
        contact: 'a skirt hem meeting the thigh',
        outfit: ELEGANT,
        breakage: 'garment-cast',
        target: [ 0.10, 0.58, 0.03 ],
        heightM: 0.30,
        azimuthDeg: 14,
        elevationDeg: 6
    }
];

// --- entry point --------------------------------------------------------------------------------

const options = parseArguments( process.argv.slice( 2 ) );

if ( options.help ) {

    process.stdout.write( usageText() );
    process.exit( 0 );

}

if ( options.list ) {

    for ( const view of VIEWS ) console.log( `${ view.id.padEnd( 14 ) } ${ view.contact }` );
    process.exit( 0 );

}

const chosen = options.only.length === 0
    ? VIEWS
    : VIEWS.filter( ( view ) => options.only.includes( view.id ) );

if ( chosen.length === 0 ) {

    console.error( `rejudge.mjs: no view matches --only ${ options.only.join( ',' ) }. ` +
        `Known: ${ VIEWS.map( ( view ) => view.id ).join( ', ' ) }` );
    process.exit( 2 );

}

if ( options.clearance ) {

    await reportClearances( chosen );
    process.exit( 0 );

}

const plateDir = path.join( options.out, 'plates' );
const blindRoot = path.join( options.out, 'blind' );
fs.mkdirSync( plateDir, { recursive: true } );

console.log( '='.repeat( 78 ) );
console.log( 'rejudge — blind pair set for the garment-shadow finding (round 10, item 1)' );
console.log( '='.repeat( 78 ) );
console.log( `shipped side: break='${ options.shipped }'    ` +
    `other side: ${ options.defect ?? "each view's own break, see VIEWS" }` );
console.log( `plates:       ${ plateDir }` );
if ( options.blind ) console.log( `blind root:   ${ blindRoot }` );
console.log( '' );

const playwright = await loadPlaywright();
if ( playwright === null ) {

    console.error( '\nTOOL ERROR: playwright not resolvable. Run: npx playwright install chromium\n' );
    process.exit( 2 );

}

const server = await startVite().catch( ( error ) => {

    console.error( `\nTOOL ERROR: vite would not start: ${ error.message }\n` );
    process.exit( 2 );

} );

let browser = null;
let refused = 0;
const sessions = [];

try {

    browser = await playwright.chromium.launch(
        { channel: 'chromium', headless: true, args: GPU_FLAGS } );

} catch ( error ) {

    await server.close();
    console.error( `\nTOOL ERROR: could not launch Chromium: ${ error.message }\n` );
    process.exit( 2 );

}

try {

    const context = await browser.newContext( {
        viewport: VIEWPORT,
        deviceScaleFactor: DEVICE_SCALE,
        colorScheme: 'dark'
    } );

    const page = await context.newPage();
    await page.goto( `${ server.baseUrl }/src/wardrobe.html`,
        { waitUntil: 'load', timeout: 60000 } );
    await page.waitForFunction(
        () => globalThis.sugataWardrobe?.stageShadowProbe !== undefined, null, { timeout: 60000 } );

    for ( const view of chosen ) {

        const viewDir = path.join( plateDir, view.id );
        fs.mkdirSync( viewDir, { recursive: true } );

        // The two sides are captured through the same function with the same camera arguments, so
        // the only thing that can differ between them is the break. `--noise` asks for the shipped
        // side twice, which turns this pair into a measurement of the renderer rather than of the
        // library — the residue the two floors have to clear.
        const defect = options.noise
            ? options.shipped
            : ( options.defect ?? view.breakage );

        const first = await capturePlate( page, view, options.shipped );
        const second = await capturePlate( page, view, defect );

        const firstPath = path.join( viewDir, `${ options.shipped }.png` );
        const secondPath = path.join( viewDir,
            options.noise ? `${ options.shipped }-again.png` : `${ defect }.png` );

        fs.writeFileSync( firstPath, first.buffer );
        fs.writeFileSync( secondPath, second.buffer );

        // 🚩 THE CAMERA IS ASSERTED IDENTICAL, NOT ASSUMED. A pair captured from two slightly
        // different eye points differs in every pixel and would sail past the separation check
        // while showing the judge a parallax, not a shadow. The page hands back the eye point it
        // actually rendered from, and it has to be the same string on both sides.
        const cameraHeld = first.camera.join( ',' ) === second.camera.join( ',' );

        const diff = diffPlates( first.buffer, second.buffer );

        console.log( `--- ${ view.id } — ${ view.contact } ---` );
        console.log( `    outfit ${ first.worn.join( ', ' ) }` );
        console.log( `    '${ options.shipped }' against '${ defect }'` );
        console.log( `    camera ${ first.camera.map( ( n ) => n.toFixed( 4 ) ).join( ', ' ) }` +
            `  ${ cameraHeld ? 'held' : 'MOVED BETWEEN SIDES' }` );
        console.log( `    ${ diff.width }x${ diff.height }, ` +
            `changed ${ ( diff.changed * 100 ).toFixed( 3 ) }% of pixels, ` +
            `mean |Δluma| ${ diff.meanDelta.toFixed( 5 ) }, ` +
            `max ${ diff.maxDelta.toFixed( 5 ) }` );

        if ( cameraHeld !== true ) {

            console.log( '    REFUSED — the camera moved between the two sides.' );
            refused += 1;
            continue;

        }

        if ( options.noise ) {

            console.log( '    (noise mode — this is the page\'s own frame-to-frame residue, ' +
                `against a ${ ( MINIMUM_CHANGED * 100 ).toFixed( 2 ) }% / ` +
                `${ MINIMUM_PEAK.toFixed( 2 ) } floor)` );
            continue;

        }

        if ( diff.changed < MINIMUM_CHANGED || diff.maxDelta < MINIMUM_PEAK ) {

            console.log( `    REFUSED — the two sides do not separate enough to judge: ` +
                `${ ( diff.changed * 100 ).toFixed( 3 ) }% changed against a ` +
                `${ ( MINIMUM_CHANGED * 100 ).toFixed( 2 ) }% floor, peak ` +
                `${ diff.maxDelta.toFixed( 5 ) } against ${ MINIMUM_PEAK.toFixed( 2 ) }.` );
            console.log( '             A pair a judge cannot tell apart is not evidence and this ' +
                'tool will not hand one over. See the VIEWS comment for what is known about ' +
                'this contact.' );
            refused += 1;
            continue;

        }

        if ( options.blind !== true ) {

            console.log( '    captured, not blinded (--no-blind)' );
            continue;

        }

        const session = blindPair( firstPath, secondPath, blindRoot, view );
        sessions.push( { view, session } );

        console.log( `    blinded  ${ session.imagesDir }` );
        for ( const warning of session.warnings ?? [] ) console.log( `    ⚠️ ${ warning }` );

    }

    await context.close();

} catch ( error ) {

    console.error( error );
    refused += 1;

} finally {

    await browser.close();
    await server.close();

}

console.log( '' );
console.log( '='.repeat( 78 ) );

if ( sessions.length > 0 ) {

    console.log( 'SHOW THE JUDGE THESE DIRECTORIES, one session at a time:' );
    for ( const { view, session } of sessions ) {

        console.log( `  ${ view.contact }` );
        console.log( `    ${ session.imagesDir }` );

    }

    console.log( '' );
    console.log( 'ANSWER KEYS — do not open until the verdicts are written down:' );
    for ( const { session } of sessions ) {

        console.log( `    ${ path.join( blindRoot, `${ session.sessionId }.key.json` ) }` );

    }

}

console.log( refused === 0
    ? `\nOK — ${ chosen.length } view${ chosen.length === 1 ? '' : 's' } captured.`
    : `\nREFUSED ${ refused } of ${ chosen.length }. Each refusal printed its own reason above, ` +
      'with the number it was refused on. That is a report, not a crash.' );

process.exit( refused === 0 ? 0 : 1 );

// --- the geometry behind a refusal ----------------------------------------------------------------

/**
 * 🚩 THE OTHER WAY (docs/LEARNINGS.md §1.1) — drives the clearance instrument with a shape whose
 * answer is arithmetic, before it is allowed to print a number about a real garment.
 *
 * The measurement below replaced a WRONG INFERENCE with a number, and a number from an unchecked
 * instrument is just a better-dressed inference. Everything `--clearance` prints on the shipped
 * garments is self-consistent by construction: the loops come from the same weld the distances are
 * measured in, so an instrument that mis-grouped the openings or mis-measured the gaps would print
 * a tidy table of wrong figures and nothing in the run would notice.
 *
 * So: a faceted cylinder for a limb, and an OPEN TUBE around it whose axis is deliberately OFFSET,
 * which is what makes this a test of the distribution rather than of one number — the clearance
 * then varies all the way round the ring between `gap - offset` and `gap + offset`, and every
 * vertex's right answer is `hypot( x, z ) - radius` in closed form. Two things are checked:
 *
 *   TOPOLOGY  the tube is open at both ends, so exactly TWO loops of exactly the ring's vertex
 *             count. This is what fails if the boundary is pooled instead of split by connectivity
 *             — the two ends come back as one loop of twice the size, and every per-opening figure
 *             in the table becomes an average over openings that are nowhere near each other.
 *
 *   DISTANCE  every vertex's measured clearance against its closed form, worst case. This is what
 *             fails if the distances collapse to the nearest approach, which is the reduction
 *             `nearestApproachMm` performs and the one `approachDistancesMm` exists to avoid.
 *
 * ⚠️ The cylinder is INSCRIBED in the circle its vertices sit on, so its facets sag inward by
 * `radius * ( 1 - cos( π / segments ) )` and every measured distance is longer than the closed
 * form by up to that much. At 256 segments on a 50 mm limb that is 0.00038 mm, three orders under
 * the tolerance, which is why the segment count is 256 and not 32.
 *
 * ## Both clauses have a red proof, taken by breaking `HemGeometry.js` at source
 *
 * Green, and this is what the run prints today:
 *
 *     ok  two openings of 64 vertices — found 2 of 64, 64
 *     ok  every vertex within 0.01 mm — worst 0.00376 mm over a spread of 1.500 to 3.500 mm
 *
 * TOPOLOGY. `findBoundaryLoops`'s flood fill was made to walk every boundary vertex rather than the
 * component's own neighbours — the pooled boundary `measureHemRoll` uses, which is correct for a
 * shell with one opening and wrong for a garment with seven:
 *
 *     FAIL two openings of 64 vertices — found 1 of 128
 *
 * DISTANCE. `approachDistancesMm` was made to return `fill( min( ... ) )`, which is the reduction
 * `nearestApproachMm` performs and the exact defect having a per-point export avoids:
 *
 *     FAIL every vertex within 0.01 mm — worst 2.00000 mm over a spread of 1.500 to 1.500 mm
 *
 * Both took the whole mode down with exit 2 rather than printing a table. `HemGeometry.js` was
 * restored byte-identically after each — sha256 383edcf1… before and after — and read green again.
 */
function verifyClearanceInstrument( { findBoundaryLoops, approachDistancesMm } ) {

    const LIMB_RADIUS_M = 0.05;
    const LIMB_SEGMENTS = 256;
    const SLEEVE_SEGMENTS = 64;
    const GAP_M = 0.0025;

    // Eccentric on purpose — see the note above. 1 mm of offset on a 2.5 mm gap makes the right
    // answer a 1.5 mm to 3.5 mm spread rather than a single repeated value.
    const OFFSET_M = 0.001;

    // How far apart a measured clearance and its closed form may read, in millimetres. Three
    // orders over the faceting bias and two under anything this mode reports.
    const TOLERANCE_MM = 0.01;

    const limbPositions = [];
    const limbIndices = [];
    const limbRings = [];

    // The limb runs well past both ends of the tube, so the nearest surface to a ring vertex is
    // always the side wall and never the limb's own open end.
    for ( let y = -0.1; y <= 0.5001; y += 0.02 ) limbRings.push( y );

    for ( const y of limbRings ) {

        for ( let step = 0; step < LIMB_SEGMENTS; step ++ ) {

            const angle = ( step / LIMB_SEGMENTS ) * Math.PI * 2;
            limbPositions.push( Math.cos( angle ) * LIMB_RADIUS_M, y,
                Math.sin( angle ) * LIMB_RADIUS_M );

        }

    }

    for ( let ring = 0; ring < limbRings.length - 1; ring ++ ) {

        for ( let step = 0; step < LIMB_SEGMENTS; step ++ ) {

            const next = ( step + 1 ) % LIMB_SEGMENTS;
            const low = ring * LIMB_SEGMENTS;
            const high = ( ring + 1 ) * LIMB_SEGMENTS;

            limbIndices.push( low + step, high + next, low + next );
            limbIndices.push( low + step, high + step, high + next );

        }

    }

    const sleevePositions = [];
    const sleeveIndices = [];
    const sleeveRings = [ 0.1, 0.2, 0.3 ];
    const sleeveRadius = LIMB_RADIUS_M + GAP_M;

    for ( const y of sleeveRings ) {

        for ( let step = 0; step < SLEEVE_SEGMENTS; step ++ ) {

            const angle = ( step / SLEEVE_SEGMENTS ) * Math.PI * 2;
            sleevePositions.push( OFFSET_M + Math.cos( angle ) * sleeveRadius, y,
                Math.sin( angle ) * sleeveRadius );

        }

    }

    for ( let ring = 0; ring < sleeveRings.length - 1; ring ++ ) {

        for ( let step = 0; step < SLEEVE_SEGMENTS; step ++ ) {

            const next = ( step + 1 ) % SLEEVE_SEGMENTS;
            const low = ring * SLEEVE_SEGMENTS;
            const high = ( ring + 1 ) * SLEEVE_SEGMENTS;

            sleeveIndices.push( low + step, high + next, low + next );
            sleeveIndices.push( low + step, high + step, high + next );

        }

    }

    const { mesh, loops } = findBoundaryLoops( sleevePositions, sleeveIndices );

    const topologyHolds = loops.length === 2 &&
        loops.every( ( loop ) => loop.vertices.length === SLEEVE_SEGMENTS );

    const points = [];
    const expected = [];

    for ( const loop of loops ) {

        for ( const vertex of loop.vertices ) {

            const x = mesh.coordinates[ vertex * 3 ];
            const y = mesh.coordinates[ vertex * 3 + 1 ];
            const z = mesh.coordinates[ vertex * 3 + 2 ];

            points.push( x, y, z );
            expected.push( ( Math.hypot( x, z ) - LIMB_RADIUS_M ) * 1000 );

        }

    }

    const measured = approachDistancesMm( Float64Array.from( points ), limbPositions, limbIndices );

    let worst = 0;
    let low = Infinity;
    let high = -Infinity;

    for ( let index = 0; index < measured.length; index ++ ) {

        worst = Math.max( worst, Math.abs( measured[ index ] - expected[ index ] ) );
        low = Math.min( low, measured[ index ] );
        high = Math.max( high, measured[ index ] );

    }

    const distanceHolds = worst < TOLERANCE_MM;

    console.log( 'THE INSTRUMENT, on a shape whose answer is arithmetic — an open tube of radius ' +
        `${ ( ( LIMB_RADIUS_M + GAP_M ) * 1000 ).toFixed( 1 ) } mm,` );
    console.log( `offset ${ ( OFFSET_M * 1000 ).toFixed( 1 ) } mm, around a ` +
        `${ ( LIMB_RADIUS_M * 1000 ).toFixed( 1 ) } mm limb:` );
    console.log( `  ${ topologyHolds ? 'ok  ' : 'FAIL' } two openings of ${ SLEEVE_SEGMENTS } ` +
        `vertices — found ${ loops.length } of ` +
        `${ loops.map( ( loop ) => loop.vertices.length ).join( ', ' ) }` );
    console.log( `  ${ distanceHolds ? 'ok  ' : 'FAIL' } every vertex within ` +
        `${ TOLERANCE_MM } mm of hypot( x, z ) - radius — worst ${ worst.toFixed( 5 ) } mm ` +
        `over a measured spread of ${ low.toFixed( 3 ) } to ${ high.toFixed( 3 ) } mm ` +
        `(closed form ${ ( ( GAP_M - OFFSET_M ) * 1000 ).toFixed( 3 ) } to ` +
        `${ ( ( GAP_M + OFFSET_M ) * 1000 ).toFixed( 3 ) })` );

    if ( topologyHolds && distanceHolds ) { console.log( '' ); return; }

    console.error( '\nTOOL ERROR: the clearance instrument does not recover a known answer. ' +
        'Nothing below it would be worth reading, so nothing below it runs.\n' );
    process.exit( 2 );

}

/**
 * How far each contact's garment opening stands off the body underneath it, in millimetres.
 *
 * ## Which half of this repository's rule this is
 *
 * THE STRONG HALF. Nothing here reads a flag, a manifest row or a build log. It welds the shipped
 * `<garment>/g050.glb`, finds the mesh's open boundaries by counting how many triangles use each
 * edge, splits them into separate openings by their own connectivity, and measures every boundary
 * vertex's perpendicular distance to the triangulated `body/g050.glb` that ships beside it. The
 * bytes a judge's plate was rendered from are the bytes this reads.
 *
 * ## Why it exists at all — the defect, in this tool's own history
 *
 * `sleeve-arm` has refused since R12, and R12 wrote a CAUSE into `VIEWS` that it had reasoned to
 * rather than measured: that the sleeve hem stood about a millimetre off the arm and no shadow
 * could be wider than that. It stood 2.660 mm, and the cause was the shadow map's normal bias. The
 * wrong reason was indistinguishable from a right one for a whole round because nothing in the
 * tool could be pointed at it. Now it can, and a reader who doubts the number in `VIEWS` runs this.
 *
 * ## Why the whole distribution and not the closest approach
 *
 * A hem is a ring around a limb and it is not concentric with it — the +X sleeve opening runs from
 * 0.565 mm to 7.827 mm around its own circumference. A minimum is one vertex at the tightest point
 * and it decides nothing about how wide a shadow the hem throws; a median is what the shadow's
 * width is set by. Both are printed, along with the tails, so nobody has to take a summary's word
 * for the shape.
 *
 * ⚠️ PERPENDICULAR DISTANCE TO THE DRAWN BODY, WHICH IS UNSIGNED — see `approachDistancesMm`. A
 * fold that has sunk through the skin reads the same as one hovering the same distance above it.
 * On these garments the whole-mesh minimum is 0.003 mm, which is a garment vertex sitting ON the
 * body, so the low tail of any of these figures should be read as "touching", not as "0.003 mm of
 * air".
 */
async function reportClearances( views ) {

    // The GLTFLoader is a browser module. Same two shims `hem.selftest.mjs` uses to run it under
    // node: it reaches for `self` at import and for `createImageBitmap` when a texture arrives.
    globalThis.self ??= globalThis;
    globalThis.createImageBitmap ??= async () => ( { width: 1, height: 1, close() {} } );

    const { GLTFLoader } = await import( pathToFileURL( path.join( REPOSITORY_ROOT,
        'node_modules', 'three', 'examples', 'jsm', 'loaders', 'GLTFLoader.js' ) ).href );
    const geometry = await import(
        pathToFileURL( path.join( REPOSITORY_ROOT, 'packages', 'core', 'src', 'wardrobe',
            'HemGeometry.js' ) ).href );
    const { findBoundaryLoops, approachDistancesMm, percentile } = geometry;

    verifyClearanceInstrument( geometry );

    const loadMesh = async ( filePath ) => {

        const file = fs.readFileSync( filePath );
        const bytes = file.buffer.slice( file.byteOffset, file.byteOffset + file.byteLength );
        const gltf = await new Promise( ( resolve, reject ) =>
            new GLTFLoader().parse( bytes, '', resolve, reject ) );

        // The largest mesh, which on a fragment is the garment and on a body is the skin — the
        // same rule `hem.selftest.mjs` uses, so the two gates cannot pick different geometry.
        let largest = null;

        gltf.scene.traverse( ( object ) => {

            if ( object.isMesh !== true ) return;
            if ( largest === null || object.geometry.attributes.position.count >
                largest.geometry.attributes.position.count ) largest = object;

        } );

        return largest;

    };

    const bodyPath = path.join( WARDROBE_DIR, 'body', `${ FIGURE_KEY }.glb` );

    if ( fs.existsSync( bodyPath ) === false ) {

        console.error( `\nTOOL ERROR: no body at ${ bodyPath }. ` +
            'See tools/figure-pipeline/README.md.\n' );
        process.exit( 2 );

    }

    const body = await loadMesh( bodyPath );
    const skinPositions = body.geometry.attributes.position.array;
    const skinIndices = body.geometry.index.array;

    console.log( `body ${ FIGURE_KEY }: ` +
        `${ ( skinIndices.length / 3 ).toLocaleString() } triangles, the surface everything below ` +
        'is measured against' );
    console.log( 'MEASURED off the shipped GLBs — no flag, no manifest row, no build log.\n' );

    const garmentIds = [ ...new Set( views.flatMap( ( view ) => view.outfit ) ) ];
    const openings = [];

    for ( const id of garmentIds ) {

        const fragmentPath = path.join( WARDROBE_DIR, id, `${ FIGURE_KEY }.glb` );

        if ( fs.existsSync( fragmentPath ) === false ) {

            console.log( `--- ${ id } — no ${ FIGURE_KEY } fragment, skipped ---\n` );
            continue;

        }

        const mesh = await loadMesh( fragmentPath );
        const { mesh: welded, loops, boundaryEdges, nonManifoldEdges } = findBoundaryLoops(
            mesh.geometry.attributes.position.array, mesh.geometry.index.array );

        console.log( `--- ${ id } ${ FIGURE_KEY } — ` +
            `${ welded.vertexCount.toLocaleString() } welded verts, ` +
            `${ welded.triangleCount.toLocaleString() } tris, ` +
            `${ boundaryEdges } boundary edges, ${ nonManifoldEdges } non-manifold, ` +
            `${ loops.length } opening${ loops.length === 1 ? '' : 's' } ---` );

        for ( const loop of loops ) {

            const points = new Float64Array( loop.vertices.length * 3 );

            for ( const [ slot, vertex ] of loop.vertices.entries() ) {

                points[ slot * 3 ] = welded.coordinates[ vertex * 3 ];
                points[ slot * 3 + 1 ] = welded.coordinates[ vertex * 3 + 1 ];
                points[ slot * 3 + 2 ] = welded.coordinates[ vertex * 3 + 2 ];

            }

            const sorted = approachDistancesMm( points, skinPositions, skinIndices ).sort();

            openings.push( { id, loop, sorted } );

            console.log( `    ${ String( loop.vertices.length ).padStart( 3 ) } verts  centre ` +
                `${ loop.centroid.map( ( n ) => n.toFixed( 3 ) ).join( ', ' ) }  ` +
                `clearance mm  min ${ sorted[ 0 ].toFixed( 3 ) }  ` +
                `p05 ${ percentile( sorted, 0.05 ).toFixed( 3 ) }  ` +
                `median ${ percentile( sorted, 0.5 ).toFixed( 3 ) }  ` +
                `p95 ${ percentile( sorted, 0.95 ).toFixed( 3 ) }  ` +
                `max ${ sorted[ sorted.length - 1 ].toFixed( 3 ) }` );

        }

        // The whole mesh, not just its openings — the standoff a reader needs before comparing any
        // of this to a shadow bias, which applies to every receiver under the garment and not only
        // to the ones under a hem.
        const all = Float64Array.from( welded.coordinates );
        const whole = approachDistancesMm( all, skinPositions, skinIndices ).sort();

        console.log( `    WHOLE MESH  min ${ whole[ 0 ].toFixed( 3 ) }  ` +
            `p05 ${ percentile( whole, 0.05 ).toFixed( 3 ) }  ` +
            `median ${ percentile( whole, 0.5 ).toFixed( 3 ) }  ` +
            `p95 ${ percentile( whole, 0.95 ).toFixed( 3 ) }  ` +
            `max ${ whole[ whole.length - 1 ].toFixed( 3 ) }\n` );

    }

    // 🚩 THE OPENING IS MATCHED TO THE VIEW BY THE VIEW'S OWN CAMERA TARGET, not by a name typed
    // here. A hand-written mapping would go stale the moment somebody re-aimed a view — which
    // `cuff-wrist` had already had done to it once — and it would go stale silently, reporting a
    // sleeve's clearance beside a wrist's separation. The target is where the eye is pointed, so
    // the nearest opening centre to it is what the plate is a picture of.
    //
    // ⚠️ AND THE MATCH IS PRINTED WITH ITS OWN DISTANCE BECAUSE IT IS SOMETIMES MEANINGLESS. This
    // finds the nearest OPENING, and an opening is only the occluder when a hem darkens the limb
    // it wraps. `hat-forehead` matches the fedora's sweatband 5.3 cm from its target and the
    // sweatband darkens nothing — the brim does, from its own overhang. `collar-chest` matches
    // 18.0 cm away, which is the tool saying it has not found the contact at all. A line with a
    // large offset, or a view whose breakage is `garment-receive`, is a line to disregard.
    console.log( 'THE OPENING EACH VIEW IS AIMED AT — nearest opening centre to the view\'s own ' +
        'camera target.\nRead it only where a hem darkens the limb it wraps: see the note above ' +
        'this list in the source.\n' );

    for ( const view of views ) {

        const reachable = openings.filter( ( entry ) => view.outfit.includes( entry.id ) );

        if ( reachable.length === 0 ) { console.log( `  ${ view.id.padEnd( 14 ) } no openings` ); continue; }

        let nearest = null;
        let nearestMetres = Infinity;

        for ( const entry of reachable ) {

            const away = Math.hypot( entry.loop.centroid[ 0 ] - view.target[ 0 ],
                entry.loop.centroid[ 1 ] - view.target[ 1 ],
                entry.loop.centroid[ 2 ] - view.target[ 2 ] );

            if ( away < nearestMetres ) { nearestMetres = away; nearest = entry; }

        }

        console.log( `  ${ view.id.padEnd( 14 ) } ${ nearest.id } opening at ` +
            `${ nearest.loop.centroid.map( ( n ) => n.toFixed( 3 ) ).join( ', ' ) }, ` +
            `${ ( nearestMetres * 100 ).toFixed( 1 ) } cm off target — ` +
            `median clearance ${ percentile( nearest.sorted, 0.5 ).toFixed( 3 ) } mm ` +
            `(min ${ nearest.sorted[ 0 ].toFixed( 3 ) }, ` +
            `max ${ nearest.sorted[ nearest.sorted.length - 1 ].toFixed( 3 ) })` );

    }

    console.log( '\nAn occluder standing off its receiver by less than the shadow map\'s normal ' +
        'bias is one the\nlookup steps over: three offsets the receiver\'s sample by ' +
        '`normalWorld * normalBias` in world\nunits. The wardrobe page\'s bias is 4.000 mm. See ' +
        'the VIEWS comment for the sweep that measured\nwhat that costs at the sleeve, and for ' +
        'why the fedora is unharmed by it.' );

}

// --- the harness --------------------------------------------------------------------------------

/**
 * Aims the page's camera at a contact and renders one plate of it.
 *
 * The camera is aimed BEFORE and AFTER `stageShadowProbe`, and that is not belt-and-braces. The
 * probe renders one frame itself, and `Stage` also runs an animation loop, so the plate that
 * reaches the screenshot is a loop frame drawn after the probe returned. Aiming first makes the
 * probe's own frame right; aiming again makes every loop frame after it right, and the screenshot
 * is taken from those.
 */
async function capturePlate( page, view, breakage ) {

    await aimCamera( page, view );

    const staged = await page.evaluate( ( request ) =>
        globalThis.sugataWardrobe.stageShadowProbe( request ),
    { outfit: view.outfit, break: breakage } );

    const camera = await aimCamera( page, view );

    // Two animation frames, so the screenshot is taken from a settled loop frame rather than from
    // whatever was on the compositor the microsecond the evaluate resolved.
    await page.evaluate( () => new Promise( ( resolve ) =>
        requestAnimationFrame( () => requestAnimationFrame( resolve ) ) ) );

    const rect = await page.evaluate( () => {

        const bounds = globalThis.sugataWardrobe.stage.renderer.domElement.getBoundingClientRect();
        return { x: bounds.left, y: bounds.top, width: bounds.width, height: bounds.height };

    } );

    const buffer = await page.screenshot( { clip: rect, timeout: 30000 } );

    return { buffer, camera, worn: staged.worn, break: breakage };

}

/**
 * Puts the eye at a fixed distance from the contact, on the lit side, looking down at it.
 *
 * Distance is derived from the vertical field of view rather than typed in, so `heightM` means what
 * it says: the frame covers that many metres of world top to bottom. A distance typed in metres is
 * a number that stops meaning anything the moment somebody changes the page's field of view, and
 * the view would keep working while framing the wrong thing — the same failure `projectProbeBoxes`
 * exists to avoid on the measurement side.
 */
function aimCamera( page, view ) {

    return page.evaluate( ( request ) => {

        const camera = globalThis.sugataWardrobe.stage.camera;
        const radians = Math.PI / 180;

        const distance = ( request.heightM / 2 ) / Math.tan( ( camera.fov * radians ) / 2 );
        const azimuth = request.azimuthDeg * radians;
        const elevation = request.elevationDeg * radians;

        camera.position.set(
            request.target[ 0 ] + distance * Math.sin( azimuth ) * Math.cos( elevation ),
            request.target[ 1 ] + distance * Math.sin( elevation ),
            request.target[ 2 ] + distance * Math.cos( azimuth ) * Math.cos( elevation ) );

        camera.lookAt( request.target[ 0 ], request.target[ 1 ], request.target[ 2 ] );
        camera.updateMatrixWorld();

        return [ camera.position.x, camera.position.y, camera.position.z ];

    }, {
        target: view.target,
        heightM: view.heightM,
        azimuthDeg: view.azimuthDeg,
        elevationDeg: view.elevationDeg
    } );

}

/**
 * How far apart two plates read, in rendered pixels.
 *
 * `changed` is the headline rather than `meanDelta` because it answers the judge's question: how
 * much of this picture is different. A mean over the whole frame is dominated by the backdrop,
 * which is identical in both plates and would drag any real difference down toward zero.
 */
function diffPlates( firstBuffer, secondBuffer ) {

    const first = decodePng( firstBuffer );
    const second = decodePng( secondBuffer );

    if ( first.width !== second.width || first.height !== second.height ) {

        throw new Error( `plates are different sizes: ${ first.width }x${ first.height } ` +
            `against ${ second.width }x${ second.height }` );

    }

    let changedPixels = 0;
    let totalDelta = 0;
    let maxDelta = 0;

    for ( let offset = 0; offset < first.pixels.length; offset += 4 ) {

        const delta = Math.abs(
            encodedLuma( first.pixels[ offset ],
                first.pixels[ offset + 1 ],
                first.pixels[ offset + 2 ] ) -
            encodedLuma( second.pixels[ offset ],
                second.pixels[ offset + 1 ],
                second.pixels[ offset + 2 ] ) );

        totalDelta += delta;
        if ( delta > maxDelta ) maxDelta = delta;
        if ( delta > CHANGED_THRESHOLD ) changedPixels += 1;

    }

    const pixels = first.pixels.length / 4;

    return {
        width: first.width,
        height: first.height,
        pixels,
        changed: pixels === 0 ? 0 : changedPixels / pixels,
        meanDelta: pixels === 0 ? 0 : totalDelta / pixels,
        maxDelta
    };

}

/**
 * Hands the pair to `blind_ab.mjs` and returns what it wrote.
 *
 * Shelled out rather than imported on purpose: `blind_ab.mjs` chooses the assignment with
 * `crypto.randomInt` and writes the key itself, and the whole value of that arrangement is that
 * the mapping never passes through the caller. This process never learns which plate became A.
 */
function blindPair( firstPath, secondPath, root, view ) {

    const stdout = execFileSync( process.execPath, [
        path.join( CRITIC_DIR, 'blind_ab.mjs' ), 'pair', firstPath, secondPath,
        '--root', root, '--label', `garment shadows — ${ view.contact }`
    ], { encoding: 'utf8' } );

    return JSON.parse( stdout );

}

/**
 * Playwright is deliberately not a dependency of this repo — it is a development instrument, not
 * part of the build. Same resolution order as `tools/critic/capture.mjs`.
 */
async function loadPlaywright() {

    const cache = path.join( process.env.HOME ?? '', '.npm', '_npx' );
    const fromCache = fs.existsSync( cache )
        ? fs.readdirSync( cache )
            .map( ( entry ) => path.join( cache, entry, 'node_modules', 'playwright' ) )
            .filter( ( candidate ) => fs.existsSync( candidate ) )
        : [];

    const require = createRequire( import.meta.url );

    for ( const candidate of [ 'playwright', process.env.PLAYWRIGHT_MODULE, ...fromCache ] ) {

        if ( candidate === undefined ) continue;

        try {

            const namespace = await import( pathToFileURL( require.resolve( candidate ) ).href );
            return namespace.chromium !== undefined ? namespace : namespace.default;

        } catch {

            // try the next candidate; the error only matters if they all fail
        }

    }

    return null;

}

/** The watcher is off for the reason capture.mjs turns it off: a concurrent save would navigate. */
async function startVite() {

    const { createServer } = await import(
        path.join( REPOSITORY_ROOT, 'node_modules', 'vite', 'dist', 'node', 'index.js' ) );

    const server = await createServer( {
        configFile: path.join( REPOSITORY_ROOT, 'vite.config.js' ),
        server: { port: 5203, strictPort: false, hmr: false, watch: { ignored: [ '**' ] } },
        logLevel: 'silent'
    } );

    await server.listen();
    server.baseUrl = server.resolvedUrls.local[ 0 ].replace( /\/$/, '' );

    return server;

}

// --- arguments ----------------------------------------------------------------------------------

function parseArguments( argv ) {

    const parsed = {
        out: DEFAULT_OUT,
        only: [],
        shipped: 'none',
        defect: null,
        blind: true,
        noise: false,
        clearance: false,
        list: false,
        help: false
    };

    for ( let index = 0; index < argv.length; index += 1 ) {

        const argument = argv[ index ];

        if ( argument === '--help' || argument === '-h' ) parsed.help = true;
        else if ( argument === '--list' ) parsed.list = true;
        else if ( argument === '--no-blind' ) parsed.blind = false;
        else if ( argument === '--noise' ) { parsed.noise = true; parsed.blind = false; }
        else if ( argument === '--clearance' ) parsed.clearance = true;
        else if ( argument === '--out' ) { index += 1; parsed.out = path.resolve( argv[ index ] ); }
        else if ( argument === '--shipped' ) { index += 1; parsed.shipped = argv[ index ]; }
        else if ( argument === '--defect' ) { index += 1; parsed.defect = argv[ index ]; }
        else if ( argument === '--only' ) {

            index += 1;
            parsed.only = argv[ index ].split( ',' ).map( ( id ) => id.trim() );

        } else {

            throw new Error( `Unknown option ${ argument }. Run with --help.` );

        }

    }

    return parsed;

}

function usageText() {

    return [
        'rejudge.mjs — blind pair set for the garment-shadow finding, captured at the contacts.',
        '',
        'Usage:',
        '  node tools/critic/rejudge.mjs [--only <id,...>] [--out <dir>]',
        '                               [--shipped <break>] [--defect <break>]',
        '                               [--no-blind] [--noise] [--clearance] [--list]',
        '',
        `Default out:  ${ DEFAULT_OUT }`,
        'Default defect: each view\'s own, because a contact can only show the half of the',
        '                round-10 flag pair its geometry expresses. --defect overrides all of them,',
        '                which is how the separation guard gets its red proof: --defect none.',
        '',
        'The page\'s break vocabulary, read off packages/testbed/src/wardrobe.js:',
        '  none             the library exactly as it ships',
        '  garment-cast     castShadow cleared on every worn fragment — the round-10 defect',
        '  garment-receive  receiveShadow cleared on the fragments — the half a hurried fix drops',
        '  body-receive     receiveShadow cleared on the BODY — cast perfectly, landing on nothing',
        '  garment-ao       the baked occlusion map nulled — a different mechanism, 9.7\'s own',
        '',
        '--noise captures the SHIPPED side twice and diffs it. That is the residue the separation',
        '        floor has to clear, and running it is how you find out the floor is still honest.',
        '',
        '--clearance launches nothing. It welds the shipped g050 garment GLBs, finds every open',
        '        boundary, and measures each one\'s distance to the shipped g050 body — the geometry',
        '        a refusal rests on, so it can be checked rather than believed. Honours --only.',
        ''
    ].join( '\n' );

}
