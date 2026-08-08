/**
 * Gate for the attribution toggles on `packages/testbed/src/alive.js`.
 *
 * ## What this file exists to stop
 *
 * Every rendering claim in this project is made by TOGGLE: capture the shipped plate, capture
 * `?x=0`, measure both, and attribute the difference to x. That inference is only valid if `?x=0`
 * switches x AND NOTHING ELSE — and nothing on the page ever asserted that, so for two review
 * rounds it was not true.
 *
 * `?eyes=0` returned before both `new EyeMaterial()` and `buildEyeOcclusion()`. It removed the eye
 * SHADER and the four occlusion/lacrimal meshes, and every number attributed to "the eye shader"
 * was a sum over two subsystems whose contributions have OPPOSITE SIGNS. Measured on one page load
 * of `?bare&freeze&seed=1` at 900x1200 CSS, `measure.mjs` G2 luma ratio against the committed
 * portrait regions: shipped 0.9203, sheet off only 0.9449, material off only 0.8815, both off
 * 0.9086. The old control reported 0.0117 of movement for a shader worth 0.0388.
 *
 * ## Why it is a browser test and not a unit test
 *
 * The claim under test is about what a PLATE CONTAINS, and only a rendered page can answer it.
 * Reading `alive.js` and reasoning about its control flow is exactly the method that missed the
 * defect, and asserting against the page's own flags would be a tautology — the flags were correct
 * the whole time; the thing they were supposed to control was not. So this file drives a real
 * Chromium against a real vite, and reads `window.sugata.subsystems()`, which counts live meshes
 * and lights out of the SCENE GRAPH.
 *
 * ## The two kinds of check, and why one is not enough
 *
 * 1. CENSUS. For each toggle, exactly the subsystem it names goes to zero and every other entry
 *    holds its baseline count. This is the direct instrument and it catches the general form —
 *    any toggle that takes a second subsystem with it.
 *
 * 2. PIXELS, for the eye pair. The census can only see what it was told to count, so a census
 *    check alone is a gate that trusts its own bookkeeping. The pixel check needs no bookkeeping
 *    at all: if `?eyes=0` already removed the occlusion sheet, then adding `&eyeocc=0` has nothing
 *    left to remove and the two plates come back BYTE-IDENTICAL. Under the shipped defect they did.
 *    That is a detector for this exact bug that shares no mechanism with check 1.
 *
 * A degenerate baseline would pass check 1 trivially — nothing can go to zero twice — so the
 * baseline census is asserted non-zero on every entry first.
 *
 * Usage:  node "packages/testbed/src/alive-toggles.selftest.mjs"
 *
 * Exit codes follow tools/critic/measure.mjs, so a caller can tell a red gate from a broken tool:
 *   0 = every check green
 *   1 = at least one check FAILED
 *   2 = tool error — no Chromium, no vite, the page never became ready. NOT a pass.
 */

import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';

const REPOSITORY_ROOT = path.resolve( fileURLToPath( new URL( '.', import.meta.url ) ), '../../..' );

// The same flags capture.mjs launches with. `headless_shell` has no GPU and therefore no WebGPU,
// so the channel matters as much as the flags.
const GPU_FLAGS = [ '--enable-unsafe-webgpu', '--ignore-gpu-blocklist', '--hide-scrollbars' ];

/**
 * The plate every check is made against.
 *
 * `?freeze` with NO `?preroll` is chosen deliberately and it is not the same thing as "seed 1".
 * With freeze on and no pre-roll the motion stack never advances, so no layer ever writes a morph
 * and `?seed` cannot act: measured 2026-08-08, `?bare&freeze&seed=1`, `seed=42` and
 * `seed=20260807` came back BYTE-IDENTICAL, 0 differing samples of 17,280,000. That is the
 * property this file needs — one plate, not a distribution — and it is why the seed is pinned
 * here for readability rather than for determinism.
 *
 * It also happens to be the only state in which the eye toggles are visible to G2 at all: with a
 * 6 s pre-roll the gaze has moved and at seeds 1 and 42 all four eye states measure the SAME G2,
 * because the region rect is no longer on the sclera. That is punch-list 3.3's open problem, not
 * this file's.
 */
const BASE_QUERY = 'bare&freeze&seed=1';

/**
 * Which subsystem each toggle owns. One toggle, one census entry — that IS the contract.
 *
 * A toggle added to `alive.js` without a row here is not gated, and a row here whose subsystem is
 * not in the census will fail loudly rather than pass quietly.
 */
const TOGGLES = [
    { query: 'skin=0', owns: 'skinMaterial' },
    { query: 'eyes=0', owns: 'eyeMaterial' },
    { query: 'eyeocc=0', owns: 'eyeOcclusion' },
    { query: 'cards=0', owns: 'cardShading' },
    { query: 'shadows=0', owns: 'shadowCastingLights' },
    { query: 'msaa=0', owns: 'multisampleSamples' }
];

let checks = 0;
let failures = 0;

function report( label, ok, detail ) {

    checks ++;
    if ( ok !== true ) failures ++;

    console.log( `${ ok ? 'PASS' : 'FAIL' }  ${ label }` );
    if ( detail !== undefined ) console.log( `        ${ detail }` );

}

function toolError( message ) {

    console.error( `\nTOOL ERROR: ${ message }\n` );
    process.exit( 2 );

}

// --- the harness ------------------------------------------------------------------------------

/**
 * Playwright is deliberately not a dependency of this repo — it is a development instrument, not
 * part of the build — so it is looked up wherever it happens to live, npx's cache included. Same
 * resolution order as tools/critic/capture.mjs.
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

/** The watcher is off for the same reason capture.mjs turns it off: a concurrent agent's save
 *  would otherwise navigate the page out from under a check. */
async function startVite() {

    const { createServer } = await import( path.join( REPOSITORY_ROOT, 'node_modules', 'vite', 'dist', 'node', 'index.js' ) );

    const server = await createServer( {
        configFile: path.join( REPOSITORY_ROOT, 'vite.config.js' ),
        server: { port: 5194, strictPort: false, hmr: false, watch: { ignored: [ '**' ] } },
        logLevel: 'silent'
    } );

    await server.listen();
    server.baseUrl = server.resolvedUrls.local[ 0 ].replace( /\/$/, '' );

    return server;

}

/** One page load. Returns the scene census and the rendered bytes, which are the two instruments. */
async function loadPlate( page, baseUrl, query ) {

    await page.goto( `${ baseUrl }/alive.html?${ query }`, { waitUntil: 'load' } );
    await page.waitForFunction( () => globalThis.sugata?.session?.figure != null, null, { timeout: 120_000 } );

    // The figure lands before its materials have all compiled; a plate read too early is a plate
    // of a half-shaded figure and would make the census right and the pixels wrong.
    await page.waitForTimeout( 1500 );

    return {
        census: await page.evaluate( () => globalThis.sugata.subsystems() ),
        pixels: await page.screenshot( { timeout: 60_000 } )
    };

}

// --- run --------------------------------------------------------------------------------------

const playwright = await loadPlaywright();
if ( playwright === null ) toolError( 'playwright not resolvable. Run: npx playwright install chromium' );

const server = await startVite().catch( ( error ) => toolError( `vite would not start: ${ error.message }` ) );

let browser = null;

try {

    browser = await playwright.chromium.launch( { channel: 'chromium', headless: true, args: GPU_FLAGS } );

} catch ( error ) {

    await server.close();
    toolError( `could not launch Chromium: ${ error.message }` );

}

const context = await browser.newContext( { viewport: { width: 900, height: 1200 }, deviceScaleFactor: 2 } );
const page = await context.newPage();

console.log( `\nalive.html toggles — ${ server.baseUrl }/alive.html?${ BASE_QUERY }\n` );

try {

    const baseline = await loadPlate( page, server.baseUrl, BASE_QUERY );

    console.log( '--- baseline ---------------------------------------------------------------\n' );
    console.log( `        ${ JSON.stringify( baseline.census ) }\n` );

    // A census of zeros would make every "went to zero" check below pass for the wrong reason.
    const empty = Object.entries( baseline.census ).filter( ( [ , count ] ) => count === 0 );

    report(
        'every subsystem is live on the shipped plate, so a zero downstream means something',
        empty.length === 0,
        empty.length === 0
            ? `${ Object.keys( baseline.census ).length } subsystems, all non-zero`
            : `NOT LIVE: ${ empty.map( ( [ name ] ) => name ).join( ', ' ) } — the checks below cannot mean anything`
    );

    console.log( '\n--- one toggle, one subsystem ----------------------------------------------\n' );

    for ( const toggle of TOGGLES ) {

        const plate = await loadPlate( page, server.baseUrl, `${ BASE_QUERY }&${ toggle.query }` );

        if ( plate.census[ toggle.owns ] === undefined ) {

            report( `?${ toggle.query } names a subsystem the census knows`, false,
                `'${ toggle.owns }' is not in the census — this row is gating nothing` );
            continue;

        }

        report(
            `?${ toggle.query } switches ${ toggle.owns } OFF`,
            plate.census[ toggle.owns ] === 0,
            `${ toggle.owns } ${ baseline.census[ toggle.owns ] } -> ${ plate.census[ toggle.owns ] }`
        );

        const collateral = Object.keys( baseline.census )
            .filter( ( name ) => name !== toggle.owns )
            .filter( ( name ) => plate.census[ name ] !== baseline.census[ name ] )
            .map( ( name ) => `${ name } ${ baseline.census[ name ] } -> ${ plate.census[ name ] }` );

        report(
            `?${ toggle.query } switches NOTHING ELSE`,
            collateral.length === 0,
            collateral.length === 0
                ? `the other ${ Object.keys( baseline.census ).length - 1 } subsystems hold their counts`
                : `COLLATERAL: ${ collateral.join( ', ' ) } — every attribution made against ?${ toggle.query } is a sum`
        );

    }

    console.log( '\n--- the eye pair, in pixels ------------------------------------------------\n' );

    // Independent of the census by construction: if one toggle has already removed the other's
    // subsystem, adding the second toggle has nothing left to do and the renders match byte for
    // byte. This is what the shipped defect looked like from outside.
    const eyesOff = await loadPlate( page, server.baseUrl, `${ BASE_QUERY }&eyes=0` );
    const occOff = await loadPlate( page, server.baseUrl, `${ BASE_QUERY }&eyeocc=0` );
    const bothOff = await loadPlate( page, server.baseUrl, `${ BASE_QUERY }&eyes=0&eyeocc=0` );

    // The failure text states the OBSERVATION, not a cause. Two identical plates mean the second
    // toggle changed nothing, and that has two possible causes — the first toggle already removed
    // its subsystem, or the second toggle is inert. Both were reproduced while proving this gate;
    // naming one of them in the message sent a reader looking in the wrong place.
    report(
        '?eyeocc=0 still changes the render when ?eyes=0 is already on',
        eyesOff.pixels.equals( bothOff.pixels ) === false,
        eyesOff.pixels.equals( bothOff.pixels )
            ? '?eyes=0 and ?eyes=0&eyeocc=0 are BYTE-IDENTICAL — adding ?eyeocc=0 removed nothing, so ' +
                'either ?eyes=0 already took the sheet or ?eyeocc=0 is inert'
            : 'the two plates differ, so the sheet survives ?eyes=0'
    );

    report(
        '?eyes=0 still changes the render when ?eyeocc=0 is already on',
        occOff.pixels.equals( bothOff.pixels ) === false,
        occOff.pixels.equals( bothOff.pixels )
            ? '?eyeocc=0 and ?eyes=0&eyeocc=0 are BYTE-IDENTICAL — adding ?eyes=0 removed nothing, so ' +
                'either ?eyeocc=0 already took the shader or ?eyes=0 is inert'
            : 'the two plates differ, so the shader survives ?eyeocc=0'
    );

    report(
        'both eye toggles together zero both eye subsystems',
        bothOff.census.eyeMaterial === 0 && bothOff.census.eyeOcclusion === 0,
        `eyeMaterial ${ bothOff.census.eyeMaterial }, eyeOcclusion ${ bothOff.census.eyeOcclusion }`
    );

} finally {

    await browser.close();
    await server.close();

}

console.log( `\n${ failures === 0 ? 'PASS' : 'FAIL' }: ${ checks - failures }/${ checks } checks green\n` );

process.exitCode = failures === 0 ? 0 : 1;
