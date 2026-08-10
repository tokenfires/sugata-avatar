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
 *   FOREHEAD  wearing the fedora, the forehead under the brim against the SAME forehead with the
 *             brim's shadow switched off.
 *   THIGH     wearing the foundation floor, the thigh under the briefs hem against the same thigh
 *             with the hem's shadow switched off.
 *
 * Both probes are the same shape and neither is an absolute value, because an absolute luma is a
 * property of the light rig and would go red the day somebody moves a light.
 *
 * ## Its two red proofs, and why they are two
 *
 * The rules of this repository say a gate that only catches its own known-bad is decorative. The
 * "off" branch of each probe IS the known-bad reintroduced — `castShadow` cleared on every worn
 * fragment, which is the original defect exactly. The second break is in the same class and a
 * different mechanism: `receiveShadow` cleared on the BODY, so the garment casts perfectly and the
 * shadow lands on a surface that will not take it. A build that fixed only half of the flag pair
 * passes the first proof and fails the second, and half of the flag pair is precisely the fix a
 * hurried reader writes.
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
async function readProbe( page, { outfit, box, breakage } ) {

    const staged = await page.evaluate( ( request ) =>
        globalThis.sugataWardrobe.stageShadowProbe( request ), { outfit, break: breakage } );

    const region = staged.boxes[ box ];
    if ( region === undefined ) {

        throw new Error( `the page could not derive a '${ box }' box from the skeleton` );

    }

    const [ x, y, width, height ] = region;
    const shot = await page.screenshot( { clip: { x, y, width, height }, timeout: 30000 } );

    return { ...meanLumaOf( decodePng( shot ) ), worn: staged.worn, region, break: breakage };

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

    // --- MEASURED AND REPORTED, NOT ASSERTED: the foundation hem ---------------------------------
    //
    // 🚩 The diagnostic asked for a second probe "under a hem against the thigh above it". It was
    // built, swept, and it has no signal: 34 boxes down both thighs from the hip joint to 16 cm
    // below it, foundation floor only, `castShadow` on against off — not one box moved by more
    // than 0.5%. That is not a broken probe, it is the geometry. A foundation shell stands 2.0 mm
    // off the skin and its rolled hem is 1.2 mm deep; at full-body framing this page renders about
    // 1 mm per pixel, so the shadow such an edge casts is one to three pixels wide.
    //
    // Recorded here rather than dropped, because the conclusion matters to the NEXT round: the
    // foundation hem reading as painted-on (punch-list 9.8, reopened) is not a shadow problem and
    // will not be fixed by one. It is fixed by the hem having thickness, which is what
    // `roll_the_hem` in build_figure.py now gives it. Asserting a shadow here would be asserting
    // noise, and this file would rather print the finding than hold a threshold it cannot mean.

    console.log( '\n--- the thigh under the foundation hem (reported, not asserted) ---' );

    const floorLit = await readProbe( page,
        { outfit: [], box: 'thigh', breakage: 'garment-cast' } );
    const floorShadowed = await readProbe( page, { outfit: [], box: 'thigh', breakage: 'none' } );

    console.log( `       box ${ floorShadowed.region.join( ',' ) }  ` +
        `worn: ${ floorShadowed.worn.join( ', ' ) }` );
    console.log( `       luma  shadows on ${ floorShadowed.luma.toFixed( 5 ) }   ` +
        `castShadow cleared ${ floorLit.luma.toFixed( 5 ) }   ` +
        `darkening ${ ( darkening( floorLit, floorShadowed ) * 100 ).toFixed( 2 ) }%` );
    console.log( '       a 2.0 mm shell with a 1.2 mm rolled hem casts one to three pixels at ' +
        'this framing. See the block above this reading in the source.' );

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
