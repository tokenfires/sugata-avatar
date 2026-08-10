/**
 * shadow.selftest.mjs — punch-list 3.9's WARDROBE HALF, measured in rendered pixels.
 *
 * ## The defect this exists because of
 *
 * Three blind judges, none with any context on this project, were each shown our figure beside a
 * reference and asked what separated them. All three put "nothing worn casts a shadow onto the
 * body" in their top three, and all three named the same instance unprompted: **the fedora sits
 * directly over a fully lit forehead.** One measured a skirt hem and reported the thighs lit
 * identically above and below it.
 *
 * They were right and it was a bug, not a missing feature. `Wardrobe.js` parented every garment
 * fragment with `this.body.parent.add( mesh )` and never set `castShadow` or `receiveShadow`;
 * three defaults both to false; and the one traverse that set them — `applyShading()` in
 * `alive.js` — runs before the first `dress()` and never again. The string did not appear anywhere
 * in `packages/core/src/wardrobe/`.
 *
 * ## Why this gate measures LUMA and not the flags
 *
 * `wardrobe.selftest.mjs` asserts the flags, and says in its own text that it is the weak half.
 * A flag gate is exactly the instrument that was already available when the bug shipped: everybody
 * who looked, looked at configuration, and the configuration was correct — for the objects that
 * existed when it ran. What nobody measured was whether a forehead got darker.
 *
 * So this gate renders the figure in the wardrobe browsercheck and reads pixels:
 *
 *   FOREHEAD   wearing the fedora, the forehead under the brim against the SAME forehead with the
 *              brim's shadow switched off. A BRIM: the caster is a flat plate a couple of
 *              millimetres above the skin.
 *   HEM/THIGH  wearing the elegant suit, the thigh below the skirt hem against the same thigh with
 *              nothing but the foundation floor on. A TUBE: the caster wraps the limb, and the
 *              limb is inside it.
 *
 * Both probes are the same shape and neither is an absolute value, because an absolute luma is a
 * property of the light rig and would go red the day somebody moves a light.
 *
 * ## 🎯 WHY A TUBE AND A BRIM, WHEN ONE GARMENT WOULD SEEM TO PROVE THE OTHER
 *
 * ⚠️ **This file used to prove the brim and RECORD THE TUBE AS A MEASURED NON-RESULT, and that
 * recorded non-result was wrong.** It said the hem under a garment casts nothing and blamed the
 * geometry — a 2 mm lip at about a millimetre per pixel. That is true of the FOUNDATION shell and
 * it is still true (the reading is still in this file, at the bottom, and it still reads 0.00%).
 * It was never true of the elegant suit's skirt hem, where the probe below now reads 13.21%
 * darkening: a skirt is a tube standing clear of the leg, not a 2 mm lip lying on it.
 *
 * What was actually wrong was `material.shadowSide`. three leaves it null and then renders the
 * OPPOSITE of `material.side` into the shadow map, so a FrontSide garment cast from its BACK faces
 * only. For a brim the back face is the underside, two millimetres above the forehead — which is
 * exactly why the ONE contact that worked was the one the judges named. For a tube the back faces
 * are the far wall, decimetres behind the limb inside it, so the limb was never behind an occluder
 * at all and the plates came back BIT-IDENTICAL with shadows on and off.
 *
 * So the two probes are not redundant and a build cannot pass one by accident of the other: a brim
 * probe alone went green for a whole round on a library where nothing tubular cast anything. See
 * `GARMENT_SHADOW_SIDE` in `Wardrobe.js` for the fix and the measurements behind its value.
 *
 * ## Its red proofs, and why they are three
 *
 * The rules of this repository say a gate that only catches its own known-bad is decorative. The
 * "off" branch of each probe IS the known-bad reintroduced — `castShadow` cleared on every worn
 * fragment, which is the original defect exactly. The second break is in the same class and a
 * different mechanism: `receiveShadow` cleared on the BODY, so the garment casts perfectly and the
 * shadow lands on a surface that will not take it. A build that fixed only half of the flag pair
 * passes the first proof and fails the second, and half of the flag pair is precisely the fix a
 * hurried reader writes.
 *
 * The third is not a break this file can apply, because it is not a flag: `material.shadowSide`
 * reverted to three's default at source in `Wardrobe.js`, one line, the tree restored byte-identically
 * afterwards. Measured — **4 of 19 assertions red, and the tube probe reads 0.46412 in all four of
 * its states**, i.e. the skirted thigh becomes bit-identical to the bare one. ⚠️ **The forehead
 * probe stayed GREEN at 31.68% through that whole run.** That is the entire argument for the second
 * contact, in one number: the brim probe is not a proxy for the tube and never was.
 *
 * ⚠️ The gate measures the page AS THE LIBRARY LEAVES IT. It never sets `castShadow` true itself —
 * if it did, a regression in `Wardrobe.js` would be repaired by the instrument and the gate would
 * go green on a broken library. It only ever clears flags.
 *
 *     node packages/core/src/wardrobe/shadow.selftest.mjs
 */

import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { decodePng } from '../../../../tools/critic/png.mjs';
import { encodedLuma } from '../../../../tools/critic/color.mjs';

const REPOSITORY_ROOT = path.resolve(
    path.dirname( fileURLToPath( import.meta.url ) ), '..', '..', '..', '..' );

const GPU_FLAGS = [ '--enable-unsafe-webgpu', '--ignore-gpu-blocklist', '--hide-scrollbars' ];

// Portrait, and large enough that a probe box is tens of pixels across rather than four. The gate
// reads a MEAN over the box, so the box wants enough samples for the mean to be stable, and the
// forehead under a fedora brim is a small part of a full-body frame.
const WIDTH = 900;
const HEIGHT = 1600;
const DEVICE_SCALE = 1;

/**
 * How much darker the shadowed reading has to be, as a fraction of the unshadowed one.
 *
 * ⚠️ AUTHORED AS A FLOOR, NOT FITTED TO THE MEASUREMENT. The measured darkening at HEAD is far
 * larger than this — the run prints both numbers, so a later reader can see the margin rather than
 * take this constant's word for it. The floor is set where it is because the failure mode it has
 * to separate is ZERO: a build with the flags cleared reads a delta of a few tenths of one per
 * cent, which is the renderer's own frame-to-frame residue (`capture.mjs` measures that residue at
 * Δ2/255 on 164 px of 19.7 million). 4% is two orders of magnitude clear of it and still an order
 * of magnitude under what a working shadow produces.
 */
const MINIMUM_DARKENING = 0.04;

/**
 * How close to zero a BROKEN configuration has to read.
 *
 * This is the other side of the same question and it is the one that makes the gate a gate. If a
 * cleared-flag build could produce 3% darkening from some other mechanism, then 4% on the working
 * build would not be evidence of anything.
 */
const MAXIMUM_BROKEN_DARKENING = 0.01;

/**
 * How much of the jacket's brightness the recovered AO map has to be worth — punch-list 9.7.
 *
 * ⚠️ TWO ORDERS SMALLER THAN THE SHADOW FLOOR, AND THAT IS THE PHYSICS RATHER THAN A WEAK RESULT.
 * An occlusion map attenuates INDIRECT light only. This page lights the figure with one ambient at
 * 0.55 and three directionals at 2.4, 1.1 and 1.6, so the whole budget the AO map is allowed to
 * touch is about a tenth of the light in the frame, and the map only takes a fraction of that.
 * Measured over a 150 px box on the jacket torso: 0.26781 with the map against 0.27026 without,
 * a darkening of 0.91%, repeatable to the fifth decimal across runs.
 *
 * The floor is 0.4% — a little over twice clear of zero on one side and a little over twice under
 * the measurement on the other, so it is neither fitted to the reading nor sitting in the noise.
 * What it has to separate is a map that is WIRED from a map that reached the GLB and is sampled by
 * nothing, and that second case reads exactly 0.00%.
 */
const MINIMUM_AO_DARKENING = 0.004;

/**
 * The two outfits the headline is measured between: the same figure, the same light, the same
 * pixels, with and without the hat. Nothing else changes, so nothing else can explain a delta.
 */
const HATTED = [ 'female_casualsuit01', 'shoes01', 'fedora01' ];
const BAREHEADED = [ 'female_casualsuit01', 'shoes01' ];

/**
 * The tube contact: the elegant suit, whose skirt hem sits mid-thigh, against the floor alone.
 *
 * The casual suit is the wrong garment for this question and one scouting plate says so — its
 * sleeve is SHORT and its trousers cover the thigh entirely, so there is no lit limb below a hem
 * to darken. `SKIRTED` is the pair's shadowed side and the decency floor alone is its lit side;
 * the floor is unioned into every outfit regardless, so the ONLY difference between the two
 * readings is the elegant suit and the shoes.
 */
const SKIRTED = [ 'female_elegantsuit01', 'shoes01' ];
const FLOOR_ONLY = [];

/**
 * Where the tube probe measures, and how close the eye gets to it.
 *
 * ⚠️ EVERY NUMBER HERE IS IN METRES OFF A BONE, NOT IN PIXELS. `HEM_PROBE` is the same
 * `[name, bone fragment, rise, half-size]` shape the page's own probes use, so the box tracks the
 * skeleton exactly as the forehead's does. The camera target is derived from the SAME bone, so a
 * taller identity or a re-posed figure moves the eye and the box together — a camera aimed at a
 * typed-in world point is a number that keeps working while it stops meaning anything.
 *
 * 🚩 THE CAMERA IS AIMED, AND IT HAS TO BE. At the page's own full-body framing this contact is a
 * band about seventeen pixels tall: swept there, the best box available read 17.97% darkening in
 * one 10 mm window and 0.10% one step below it. Aimed, the same contact is a 127 px box with a
 * ±4 mm window either side of it, and `cameraHeldAcross` asserts the eye did not move between the
 * readings, because a pair captured from two eye points differs in every pixel and would sail past
 * the darkening floor while measuring a parallax.
 *
 * The rise was swept in 4 mm steps from −322 to −342 mm, at half-sizes of 12, 14, 16 and 18 mm.
 * −326 / 12 mm is the box that is PURE SKIN in both outfits — the two independent unshadowed
 * routes, "no skirt" and "skirt with castShadow cleared", read 0.46412 and 0.46412, equal to five
 * decimals — while carrying the largest darkening of the pure-skin candidates, 13.21%. Repeated
 * three times in one session: 0.40279 / 0.46412 / 0.46412 every time.
 *
 * The azimuth and elevation are the re-judge tool's, for the same reason it chose them: the key
 * light is at +X and above, so the figure's left side is the lit one, and shadows fall downward
 * off every edge, so an eye BELOW the contact looks into the lit face of the cloth.
 */
const HEM_PROBE = [ 'hem-thigh', 'thigh', -0.326, 0.012 ];
const HEM_VIEW = { boneFragment: 'thigh', riseM: -0.315, heightM: 0.30, azimuthDeg: 14, elevationDeg: 6 };

/**
 * The dimmest the probe's mean may be and still be believed to be on lit skin.
 *
 * 🚩 THE GATE READ 0.003 ONCE AND REPORTED A PLAUSIBLE 46%. `png.mjs` hands back a Float32Array
 * already normalised to [0,1]; dividing it by 255 again turned the whole frame black, and a black
 * frame still has ratios in it — two black readings differing in the last bit read as a shadow.
 * Skin under this page's key light means around 0.5 to 0.75 and the backdrop is under 0.05, so a
 * floor of 0.15 separates the two by a wide margin and catches a decode that has gone to zero.
 */
const MINIMUM_PROBE_LUMA = 0.15;

let checks = 0;
let failures = 0;

function report( ok, label, detail ) {

    checks ++;
    if ( ok !== true ) failures ++;

    console.log( `  ${ ok ? 'ok  ' : 'FAIL' } ${ label }${ detail ? ` — ${ detail }` : '' }` );

}

function toolError( message ) {

    console.error( `\nTOOL ERROR: ${ message }\n` );
    process.exit( 2 );

}

// --- the harness ------------------------------------------------------------------------------

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
        server: { port: 5199, strictPort: false, hmr: false, watch: { ignored: [ '**' ] } },
        logLevel: 'silent'
    } );

    await server.listen();
    server.baseUrl = server.resolvedUrls.local[ 0 ].replace( /\/$/, '' );

    return server;

}


/**
 * One reading: dress the figure, apply the requested break, render, screenshot, mean the luma.
 *
 * The box comes back from the page rather than being a constant here, because a box expressed as a
 * canvas fraction keeps working while it stops meaning anything — see `projectProbeBoxes`.
 */
async function readProbe( page, { outfit, box, breakage, probes = null, view = null } ) {

    // The eye is aimed BEFORE and AFTER staging, and that is not belt-and-braces: the probe renders
    // one frame itself and `Stage` also runs an animation loop, so the frame the screenshot lands on
    // is a loop frame drawn after the probe returned. Aiming first makes the probe's box right;
    // aiming again makes every loop frame after it right.
    if ( view !== null ) await aimAtContact( page, view );

    const staged = await page.evaluate( ( request ) =>
        globalThis.sugataWardrobe.stageShadowProbe( request ),
    probes === null ? { outfit, break: breakage } : { outfit, break: breakage, probes } );

    const camera = view === null ? null : await aimAtContact( page, view );

    if ( view !== null ) {

        await page.evaluate( () => new Promise( ( resolve ) =>
            requestAnimationFrame( () => requestAnimationFrame( resolve ) ) ) );

    }

    const region = staged.boxes[ box ];
    if ( region === undefined ) {

        throw new Error( `the page could not derive a '${ box }' box from the skeleton` );

    }

    const [ x, y, width, height ] = region;
    const shot = await page.screenshot( { clip: { x, y, width, height }, timeout: 30000 } );

    return { ...meanLumaOf( decodePng( shot ) ), worn: staged.worn, region, camera, break: breakage };

}

/**
 * Puts the eye a fixed distance from a contact, on the lit side, looking down at it.
 *
 * The target is a bone plus a rise in metres — the same anchor the probe boxes use — and the
 * distance is derived from the camera's own field of view so `heightM` means what it says: the
 * frame covers that many metres of world, top to bottom. A distance typed in metres stops meaning
 * anything the moment somebody changes the page's field of view, and the gate would keep passing
 * while framing the wrong patch of leg.
 */
function aimAtContact( page, view ) {

    return page.evaluate( ( request ) => {

        const { stage, figure } = globalThis.sugataWardrobe;
        const skeleton = figure.skeleton ?? figure.body?.skeleton ?? null;

        const bone = skeleton?.bones.find(
            ( candidate ) => candidate.name.toLowerCase().includes( request.boneFragment ) );

        if ( bone === undefined || bone === null ) return null;

        const camera = stage.camera;
        const radians = Math.PI / 180;
        const elements = bone.matrixWorld.elements;

        const target = [ elements[ 12 ], elements[ 13 ] + request.riseM, elements[ 14 ] ];

        const distance = ( request.heightM / 2 ) / Math.tan( ( camera.fov * radians ) / 2 );
        const azimuth = request.azimuthDeg * radians;
        const elevation = request.elevationDeg * radians;

        camera.position.set(
            target[ 0 ] + distance * Math.sin( azimuth ) * Math.cos( elevation ),
            target[ 1 ] + distance * Math.sin( elevation ),
            target[ 2 ] + distance * Math.cos( azimuth ) * Math.cos( elevation ) );

        camera.lookAt( target[ 0 ], target[ 1 ], target[ 2 ] );
        camera.updateMatrixWorld();

        return [ camera.position.x, camera.position.y, camera.position.z ];

    }, view );

}

/** Whether every reading in a set was taken from the same eye point, to the last digit. */
function cameraHeldAcross( readings ) {

    const first = readings[ 0 ].camera;
    if ( first === null ) return false;

    return readings.every( ( reading ) => reading.camera !== null &&
        reading.camera.join( ',' ) === first.join( ',' ) );

}

/** The mean encoded luma of a decoded PNG, and its darkest and brightest pixel. */
function meanLumaOf( decoded ) {

    let total = 0;
    let darkest = 1;
    let brightest = 0;

    for ( let offset = 0; offset < decoded.pixels.length; offset += 4 ) {

        const luma = encodedLuma( decoded.pixels[ offset ],
            decoded.pixels[ offset + 1 ],
            decoded.pixels[ offset + 2 ] );

        total += luma;
        darkest = Math.min( darkest, luma );
        brightest = Math.max( brightest, luma );

    }

    const pixels = decoded.pixels.length / 4;

    return { luma: pixels === 0 ? 0 : total / pixels, pixels, darkest, brightest };

}

/** Darkening as a fraction: how much of the brighter reading the shadow took away. */
function darkening( lit, shadowed ) {

    if ( lit.luma <= 0 ) return 0;
    return ( lit.luma - shadowed.luma ) / lit.luma;

}

// --- run ----------------------------------------------------------------------------------------

console.log( '='.repeat( 78 ) );
console.log( 'garment shadows, in rendered pixels — punch-list 3.9, wardrobe half' );
console.log( '='.repeat( 78 ) );

const playwright = await loadPlaywright();
if ( playwright === null ) {

    toolError( 'playwright not resolvable. Run: npx playwright install chromium' );

}

const server = await startVite().catch(
    ( error ) => toolError( `vite would not start: ${ error.message }` ) );

let browser = null;

try {

    browser = await playwright.chromium.launch(
        { channel: 'chromium', headless: true, args: GPU_FLAGS } );

} catch ( error ) {

    await server.close();
    toolError( `could not launch Chromium: ${ error.message }` );

}

try {

    const context = await browser.newContext( {
        viewport: { width: WIDTH, height: HEIGHT },
        deviceScaleFactor: DEVICE_SCALE,
        colorScheme: 'dark'
    } );

    const page = await context.newPage();
    await page.goto( `${ server.baseUrl }/src/wardrobe.html`,
        { waitUntil: 'load', timeout: 60000 } );
    await page.waitForFunction(
        () => globalThis.sugataWardrobe?.stageShadowProbe !== undefined, null, { timeout: 60000 } );

    console.log( `\n${ server.baseUrl }/src/wardrobe.html   ` +
        `${ WIDTH }x${ HEIGHT } dpr ${ DEVICE_SCALE }\n` );

    // --- the one configuration assertion, and it is here to make a red reading readable ---------
    //
    // Everything below measures pixels. This reads the flags the LIBRARY set, so that when a luma
    // check goes red a reader can tell "Wardrobe stopped shading fragments" from "somebody moved
    // a light" in one line instead of a bisect. It is not the gate.

    await page.evaluate( ( outfit ) => globalThis.sugataWardrobe.dress( outfit ), HATTED );
    const shading = await page.evaluate( () => globalThis.sugataWardrobe.shading() );

    report( shading.length > 0 && shading.every( ( entry ) => entry.castShadow === true ),
        'the library shaded every worn fragment to CAST, with no help from this gate',
        shading.map( ( entry ) => `${ entry.id } ${ entry.castShadow }` ).join( ', ' ) );

    report( shading.length > 0 && shading.every( ( entry ) => entry.receiveShadow === true ),
        'the library shaded every worn fragment to RECEIVE',
        shading.map( ( entry ) => `${ entry.id } ${ entry.receiveShadow }` ).join( ', ' ) );

    // The third member of the same fix, and the one with no symptom of its own at this probe — the
    // forehead reads the same whichever way it is set, because a brim's back face is its underside.
    // Read here for the same reason as the two above: so a red TUBE reading downstream can be told
    // apart from a moved light in one line. It is still configuration, not evidence.
    report( shading.length > 0 &&
        shading.every( ( entry ) => entry.shadowSide.every( ( side ) => side !== null ) ),
    'the library set shadowSide on every worn material, so a tube casts from its NEAR wall',
    shading.map( ( entry ) => `${ entry.id } side ${ entry.side.join( '/' ) } ` +
            `shadowSide ${ entry.shadowSide.join( '/' ) }` ).join( ', ' ) );

    // --- THE MEASUREMENT: the forehead under the fedora brim -------------------------------------

    console.log( '\n--- the forehead under the fedora brim ---' );

    const hatted = await readProbe( page, { outfit: HATTED, box: 'forehead', breakage: 'none' } );
    const bare = await readProbe( page, { outfit: BAREHEADED, box: 'forehead', breakage: 'none' } );
    const noCast = await readProbe( page,
        { outfit: HATTED, box: 'forehead', breakage: 'garment-cast' } );
    const noReceive = await readProbe( page,
        { outfit: HATTED, box: 'forehead', breakage: 'body-receive' } );

    console.log( `       box ${ hatted.region.join( ',' ) }, ${ hatted.pixels } px, ` +
        `derived from the head bone` );
    console.log( `       luma  hatted ${ hatted.luma.toFixed( 5 ) }   ` +
        `bareheaded ${ bare.luma.toFixed( 5 ) }   ` +
        `no-cast ${ noCast.luma.toFixed( 5 ) }   no-receive ${ noReceive.luma.toFixed( 5 ) }` );

    report( hatted.region.join( ',' ) === bare.region.join( ',' ),
        'the box does not move between readings',
        `${ hatted.region.join( ',' ) } vs ${ bare.region.join( ',' ) }` );

    report( hatted.luma > MINIMUM_PROBE_LUMA && bare.luma > MINIMUM_PROBE_LUMA,
        'the box is on lit skin, and the decode did not go to zero',
        `hatted ${ hatted.luma.toFixed( 4 ) }, bareheaded ${ bare.luma.toFixed( 4 ) }, ` +
        `floor ${ MINIMUM_PROBE_LUMA }` );

    // 🎯 THE HEADLINE, and the form the diagnostic asked for: the same forehead, hatted against
    // unhatted, with nothing in this process touching a flag. If `Wardrobe.js` stops shading its
    // fragments these two readings become the same number and this line goes red on its own.
    const versusBare = darkening( bare, hatted );
    report( versusBare >= MINIMUM_DARKENING,
        'THE HEADLINE — the forehead is darker with the hat on than with it off',
        `${ ( versusBare * 100 ).toFixed( 2 ) }% against a ` +
        `${ ( MINIMUM_DARKENING * 100 ).toFixed( 0 ) }% floor` );

    // RED PROOF 1 — the original defect, reintroduced exactly: `castShadow` false on the worn
    // fragments is the state `Wardrobe.js` left every garment in for the whole of phase 9.
    const versusCast = darkening( noCast, hatted );
    report( versusCast >= MINIMUM_DARKENING,
        'RED PROOF 1 — clearing castShadow on the fragments removes the darkening',
        `${ ( versusCast * 100 ).toFixed( 2 ) }% of the reading is the garment's shadow` );

    report( Math.abs( darkening( bare, noCast ) ) <= MAXIMUM_BROKEN_DARKENING,
        'RED PROOF 1 — and with it cleared, hatted reads the same as bareheaded',
        `${ ( darkening( bare, noCast ) * 100 ).toFixed( 2 ) }% apart, which is the defect` );

    // RED PROOF 2 — the same class, a different mechanism, and the one a half-fix leaves behind:
    // the hat casts perfectly and the forehead will not take the shadow.
    const versusReceive = darkening( noReceive, hatted );
    report( versusReceive >= MINIMUM_DARKENING,
        'RED PROOF 2 — clearing receiveShadow on the BODY removes the same darkening',
        `${ ( versusReceive * 100 ).toFixed( 2 ) }%` );

    const betweenBreaks = Math.abs( noCast.luma - noReceive.luma ) /
        Math.max( noCast.luma, Number.EPSILON );
    report( betweenBreaks <= MAXIMUM_BROKEN_DARKENING,
        'the two breaks land on the same unshadowed value, so both measure the same shadow',
        `${ ( betweenBreaks * 100 ).toFixed( 2 ) }% apart` );

    // --- 9.7: the AO map the build used to throw away, measured in the folds ---------------------
    //
    // 🎯 Punch-list 9.7's gate asks for two things and this is the second: `occlusionTexture`
    // present on every garment material in the built GLB — `wardrobe.selftest.mjs` reads that off
    // the file — AND a rendered on/off difference measured IN THE FOLDS rather than asserted.
    //
    // The toggle is the map itself, not a flag: `material.aoMap` is nulled and put back. A build
    // where `build_figure.py` stopped wiring the occlusion node, or where the runtime stopped
    // aliasing `uv1` onto the fragment's only UV set, reads the same number twice and goes red.

    console.log( '\n--- the jacket torso, with and without the baked AO map (9.7) ---' );

    const withAo = await readProbe( page, { outfit: HATTED, box: 'torso', breakage: 'none' } );
    const withoutAo = await readProbe( page,
        { outfit: HATTED, box: 'torso', breakage: 'garment-ao' } );

    console.log( `       box ${ withAo.region.join( ',' ) }, ${ withAo.pixels } px` );
    console.log( `       luma  AO on ${ withAo.luma.toFixed( 5 ) }   ` +
        `AO off ${ withoutAo.luma.toFixed( 5 ) }` );

    report( withAo.luma > MINIMUM_PROBE_LUMA,
        'the torso box is on the jacket and lit',
        `${ withAo.luma.toFixed( 4 ) } against a floor of ${ MINIMUM_PROBE_LUMA }` );

    const aoDarkening = darkening( withoutAo, withAo );
    report( aoDarkening >= MINIMUM_AO_DARKENING,
        '9.7 — the recovered AO map darkens the jacket, and switching it off gives the light back',
        `${ ( aoDarkening * 100 ).toFixed( 2 ) }% against a ` +
        `${ ( MINIMUM_AO_DARKENING * 100 ).toFixed( 1 ) }% floor` );

    // --- MEASURED AND REPORTED, NOT ASSERTED: the FOUNDATION hem ---------------------------------
    //
    // 🚩 A DIFFERENT PHYSICAL LIMIT FROM THE ONE ABOVE, AND IT DID NOT MOVE. The tube probe above
    // used to be a paragraph saying no hem casts anything; that paragraph was wrong about GARMENT
    // hems and right about this one, so the reading stays and the conclusion drawn from it is
    // narrowed to what it actually covers.
    //
    // A foundation shell stands 2.0 mm off the skin and its rolled hem is 1.2 mm deep. At the
    // page's full-body framing — which is the framing this reading is taken at, deliberately, since
    // that is where the "painted-on" complaint was made — the page renders about a millimetre per
    // pixel, so the shadow such an edge casts is one to three pixels wide. `shadowSide` puts the
    // near wall of that shell into the shadow map instead of the far one and the reading does not
    // move: it was 0.00% before the fix and it is 0.00% after it, on plates that are identical to
    // five decimals.
    //
    // Kept because the conclusion still matters: the foundation hem reading as painted-on
    // (punch-list 9.8) is not a shadow problem and will not be fixed by one. It is fixed by the hem
    // having thickness, which is what `roll_the_hem` in build_figure.py gives it. Asserting a
    // shadow here would be asserting noise.

    console.log( '\n--- the thigh under the FOUNDATION hem, full-body framing (reported, not asserted) ---' );

    const floorLit = await readProbe( page,
        { outfit: [], box: 'thigh', breakage: 'garment-cast' } );
    const floorShadowed = await readProbe( page, { outfit: [], box: 'thigh', breakage: 'none' } );

    console.log( `       box ${ floorShadowed.region.join( ',' ) }  ` +
        `worn: ${ floorShadowed.worn.join( ', ' ) }` );
    console.log( `       luma  shadows on ${ floorShadowed.luma.toFixed( 5 ) }   ` +
        `castShadow cleared ${ floorLit.luma.toFixed( 5 ) }   ` +
        `darkening ${ ( darkening( floorLit, floorShadowed ) * 100 ).toFixed( 2 ) }%` );
    console.log( '       a 2.0 mm shell with a 1.2 mm rolled hem casts one to three pixels at ' +
        'this framing, with or without shadowSide. See the block above this reading in the source.' );

    // --- THE SECOND MEASUREMENT: a TUBE, not a brim ----------------------------------------------
    //
    // 🎯 This is what replaced a recorded non-result. See the header: the sleeve, the cuff and the
    // skirt hem all cast NOTHING for a whole round, on plates that were bit-identical with shadows
    // on and off, while the forehead probe below the brim went green the entire time. A gate that
    // only ever measures a flat plate over skin cannot see that, and this one could not.
    //
    // Everything from here uses an AIMED camera, so it comes last: the contact is seventeen pixels
    // tall at the framing the readings above are taken at.

    console.log( '\n--- the thigh below the elegant suit\'s skirt hem (a TUBE) ---' );

    const skirted = await readProbe( page, { outfit: SKIRTED, box: HEM_PROBE[ 0 ],
        breakage: 'none', probes: [ HEM_PROBE ], view: HEM_VIEW } );
    const bareLeg = await readProbe( page, { outfit: FLOOR_ONLY, box: HEM_PROBE[ 0 ],
        breakage: 'none', probes: [ HEM_PROBE ], view: HEM_VIEW } );
    const hemNoCast = await readProbe( page, { outfit: SKIRTED, box: HEM_PROBE[ 0 ],
        breakage: 'garment-cast', probes: [ HEM_PROBE ], view: HEM_VIEW } );
    const hemNoReceive = await readProbe( page, { outfit: SKIRTED, box: HEM_PROBE[ 0 ],
        breakage: 'body-receive', probes: [ HEM_PROBE ], view: HEM_VIEW } );

    const hemReadings = [ skirted, bareLeg, hemNoCast, hemNoReceive ];

    console.log( `       box ${ skirted.region.join( ',' ) }, ${ skirted.pixels } px, ` +
        `derived from the thigh bone ${ ( HEM_PROBE[ 2 ] * 1000 ).toFixed( 0 ) } mm below its head` );
    console.log( `       worn  ${ skirted.worn.join( ', ' ) }   against   ` +
        `${ bareLeg.worn.join( ', ' ) }` );
    console.log( `       luma  skirted ${ skirted.luma.toFixed( 5 ) }   ` +
        `floor only ${ bareLeg.luma.toFixed( 5 ) }   ` +
        `no-cast ${ hemNoCast.luma.toFixed( 5 ) }   no-receive ${ hemNoReceive.luma.toFixed( 5 ) }` );

    report( cameraHeldAcross( hemReadings ),
        'the eye did not move between the four readings, so nothing here is a parallax',
        skirted.camera === null ? 'the page could not derive the camera from the thigh bone'
            : skirted.camera.map( ( axis ) => axis.toFixed( 4 ) ).join( ', ' ) );

    report( hemReadings.every( ( reading ) =>
        reading.region.join( ',' ) === skirted.region.join( ',' ) ),
    'the box does not move between readings',
    hemReadings.map( ( reading ) => reading.region.join( ',' ) ).join( '  vs  ' ) );

    report( bareLeg.luma > MINIMUM_PROBE_LUMA && hemNoCast.luma > MINIMUM_PROBE_LUMA,
        'the box is on lit thigh, and the decode did not go to zero',
        `floor only ${ bareLeg.luma.toFixed( 4 ) }, no-cast ${ hemNoCast.luma.toFixed( 4 ) }, ` +
        `floor ${ MINIMUM_PROBE_LUMA }` );

    // 🚩 THE ASSERTION THAT STOPS THE HEADLINE BEING A CLOTH-FOR-SKIN SWAP. The box sits below the
    // hem, so it should be skin in BOTH outfits — and if it crept up over the cloth, "skirted" would
    // read darker for having a dark garment in it rather than for being shadowed. Two independent
    // routes to "no shadow here" — take the skirt off, or leave it on and stop it casting — have to
    // land on the same luma. Swept, they do so exactly: 0.46412 against 0.46412. A box that has
    // drifted onto the hem separates them immediately.
    const routesApart = Math.abs( darkening( bareLeg, hemNoCast ) );
    report( routesApart <= MAXIMUM_BROKEN_DARKENING,
        'the box is pure skin: taking the skirt off and stopping it casting read the same',
        `${ ( routesApart * 100 ).toFixed( 2 ) }% apart` );

    // 🎯 THE HEADLINE, and nothing in this process has touched a flag to get it: the same thigh,
    // skirt on against skirt off. This is the reading that was BIT-IDENTICAL before `shadowSide`
    // landed, and it is the one that goes red if `shadowSide` is ever cleaned up.
    const versusBareLeg = darkening( bareLeg, skirted );
    report( versusBareLeg >= MINIMUM_DARKENING,
        'THE HEADLINE — a TUBE casts: the thigh is darker under the skirt hem than without it',
        `${ ( versusBareLeg * 100 ).toFixed( 2 ) }% against a ` +
        `${ ( MINIMUM_DARKENING * 100 ).toFixed( 0 ) }% floor` );

    const hemVersusCast = darkening( hemNoCast, skirted );
    report( hemVersusCast >= MINIMUM_DARKENING,
        'RED PROOF 1 — clearing castShadow on the fragments removes the darkening',
        `${ ( hemVersusCast * 100 ).toFixed( 2 ) }% of the reading is the skirt's shadow` );

    const hemVersusReceive = darkening( hemNoReceive, skirted );
    report( hemVersusReceive >= MINIMUM_DARKENING,
        'RED PROOF 2 — clearing receiveShadow on the BODY removes the same darkening',
        `${ ( hemVersusReceive * 100 ).toFixed( 2 ) }%` );

    await context.close();

} catch ( error ) {

    console.error( error );
    failures += 1;

} finally {

    await browser.close();
    await server.close();

}

console.log( '' );
console.log( '='.repeat( 78 ) );
console.log( failures === 0
    ? `PASS — ${ checks } assertions.`
    : `FAIL — ${ failures } of ${ checks }.` );

process.exit( failures === 0 ? 0 : 1 );
