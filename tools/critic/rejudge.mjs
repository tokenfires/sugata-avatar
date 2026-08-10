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
// Three of the seven views REFUSE on the tree as it ships today, and the `VIEWS` comment carries
// the measurement and the cause. That is the report, not a fault in the run.
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
 * ## The three views that are here and REFUSE, and why they stay in the file
 *
 * ⚠️ MEASURED THIS SESSION, ON THE TREE AS IT SHIPS: at the sleeve, the cuff and the skirt hem the
 * shipped library casts NOTHING. Not a weak shadow — nothing. `hem-thigh` reads 0.000% changed with
 * a max delta of 0.00000 against `garment-cast`, `garment-receive` AND `body-receive`: the two
 * plates are bit-identical, so no shadow of any kind reaches the thigh below that hem.
 *
 * The cause is measurable and is not in the wardrobe's flags. Three leaves `material.shadowSide`
 * null, and `WebGLShadowMap` then renders the OPPOSITE of `material.side` into the shadow map — so
 * a FrontSide garment casts from its BACK faces only. For a hat brim the back face is the brim's
 * underside, two millimetres above the forehead, which is why the one contact that works is the one
 * the judges named. For a tube — a sleeve, a cuff, a skirt — the back faces are the FAR wall,
 * decimetres of depth behind the limb inside it, so the limb is never behind an occluder. Setting
 * `shadowSide` to FrontSide or DoubleSide on the worn materials and changing nothing else takes
 * `hem-thigh` from 0.000% to 1.810% changed, max delta 0.33598, in the same run.
 *
 * They stay in the list, refusing, because a refusal with a number on it is the honest report and
 * because this file is then the standing measurement of how far the fix reaches. When the request
 * against `Wardrobe.js` lands, these three stop refusing and start producing pairs, with no edit
 * here. A non-zero exit from this tool means "some contacts still have nothing to judge", which is
 * exactly the state of the world it should be reporting.
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
        heightM: 0.26,
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
        list: false,
        help: false
    };

    for ( let index = 0; index < argv.length; index += 1 ) {

        const argument = argv[ index ];

        if ( argument === '--help' || argument === '-h' ) parsed.help = true;
        else if ( argument === '--list' ) parsed.list = true;
        else if ( argument === '--no-blind' ) parsed.blind = false;
        else if ( argument === '--noise' ) { parsed.noise = true; parsed.blind = false; }
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
        '                               [--no-blind] [--noise] [--list]',
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
        ''
    ].join( '\n' );

}
