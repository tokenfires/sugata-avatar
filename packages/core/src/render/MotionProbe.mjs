/**
 * MotionProbe — drives `packages/testbed/src/post.html` from Node and hands back decoded pixels.
 *
 * ⚠️ **Node only.** It imports `vite` and `playwright` and is never reachable from the browser
 * bundle. It lives in `render/` because it is the instrument the render gates run on, and it is
 * named for the reason it exists: **a temporal effect cannot be gated on a still plate**, so the
 * gates for `TRAAPost.js` need a way to render a SEQUENCE and measure across it, and there was no
 * such thing in this repo — `tools/critic/capture.mjs` writes video for a human to watch, which is
 * a different job and a much slower one.
 *
 * ## The mistake this file exists to make impossible
 *
 * `docs/PROGRESS.md` records `?aa=traa` measuring G4 = 4.2333 and reads it, correctly, as a
 * non-result: a temporal filter on frame 1 has no history, so on a single frozen frame TRAA
 * measures **identical to no antialiasing at all**. That has now been re-measured here and it is
 * exact, not approximate — see `TRAAPost.selftest.mjs`'s STILL-PLATE TRAP section, which asserts
 * the identity rather than merely warning about it.
 *
 * Anything that measures temporal AA therefore takes a `frames` count, and `capturePlates` refuses
 * to return a single frame for a temporal mode. A future agent that wants one has to delete a
 * check that says why.
 *
 * ## What it does
 *
 *   startProbeServer()        one vite, watcher OFF (LEARNINGS §1.12), so a fan-out cannot
 *                             navigate the page out from under a run
 *   capturePlates(...)        load a URL, step the clock N times, decode the frames it asks for
 *   temporalRms(...)          per-pixel RMS of successive frame differences inside a rect, in
 *                             8-bit code values — the statistic 3.12 is argued in
 *   silhouetteCrossings(...)  how many pixels along a row sit strictly between two plateaux, and
 *                             how large the largest single-pixel step is: the edge-quality
 *                             statistic, which is what antialiasing is actually for
 *   bandStatistics(...)       mean / percentile / chroma over a rect, for the grade gate
 */

import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname( fileURLToPath( import.meta.url ) );
const REPOSITORY_ROOT = path.resolve( HERE, '..', '..', '..', '..' );

const { decodePng } = await import( pathToFileURL( path.join( REPOSITORY_ROOT, 'tools', 'critic', 'png.mjs' ) ).href );

/** Copied from `tools/critic/capture.mjs`, where each flag is justified by a measurement. */
const GPU_FLAGS = [ '--enable-unsafe-webgpu', '--ignore-gpu-blocklist', '--hide-scrollbars' ];

const READY_TIMEOUT_MS = 120_000;

// --- the server and the browser ----------------------------------------------------------------

/**
 * A vite rooted at `packages/testbed`, with the file watcher disarmed.
 *
 * 🚩 `hmr: false` is NOT what makes this safe — `/@vite/client` is still injected. The watcher
 * ignore list is: chokidar never emits a change, so the server has nothing to send and a
 * concurrent agent's save cannot navigate the page. Proven in both directions in LEARNINGS §1.12.
 */
export async function startProbeServer( { port = 5187 } = {} ) {

    const { createServer } = await import( 'vite' );

    const server = await createServer( {
        configFile: path.join( REPOSITORY_ROOT, 'vite.config.js' ),
        server: { port, strictPort: false, hmr: false, watch: { ignored: [ '**' ] } },
        logLevel: 'error'
    } );

    await server.listen();

    const baseUrl = server.resolvedUrls.local[ 0 ].replace( /\/$/, '' );

    return { baseUrl, close: () => server.close() };

}

/**
 * Chromium with a real GPU. `channel: 'chromium'` is load-bearing — plain headless runs
 * `headless_shell`, which has no GPU and silently falls through to SwiftShader, so every number
 * would be a measurement of a software rasteriser.
 */
export async function launchProbeBrowser() {

    const playwright = await loadPlaywright();

    return playwright.chromium.launch( { channel: 'chromium', headless: true, args: GPU_FLAGS } );

}

async function loadPlaywright() {

    const require = createRequire( import.meta.url );
    const candidates = [ process.env.PLAYWRIGHT_MODULE, 'playwright', ...npxCacheCandidates() ].filter( Boolean );

    for ( const candidate of candidates ) {

        try {

            const resolved = require.resolve( candidate );
            const module = await import( pathToFileURL( resolved ).href );

            return module.default ?? module;

        } catch {

            // next candidate; only the exhaustion of the list is an error
        }

    }

    throw new Error( 'playwright not resolvable. npm i --prefix /tmp/pw playwright && ' +
        'npx --prefix /tmp/pw playwright install chromium, then PLAYWRIGHT_MODULE=/tmp/pw/node_modules/playwright' );

}

function npxCacheCandidates() {

    const cache = path.join( process.env.HOME ?? '', '.npm', '_npx' );

    if ( fs.existsSync( cache ) === false ) return [];

    return fs.readdirSync( cache )
        .map( ( entry ) => path.join( cache, entry, 'node_modules', 'playwright' ) )
        .filter( ( candidate ) => fs.existsSync( candidate ) );

}

// --- driving a page ------------------------------------------------------------------------------

/**
 * Loads one `post.html` configuration, steps it, and returns the decoded frames asked for.
 *
 * @param {Object} options
 * @param {Object} options.browser - from `launchProbeBrowser`.
 * @param {string} options.baseUrl - from `startProbeServer`.
 * @param {string} options.query - the page's query string, WITHOUT `?capture`, which is added
 *   here because stepping and the rAF loop must never both own the frame.
 * @param {number} [options.width=900]
 * @param {number} [options.height=1200]
 * @param {number} [options.frames=1] - how many fixed steps to take.
 * @param {number} [options.fps=60] - the size of each step.
 * @param {?number} [options.stepSeconds] - the step directly, overriding `fps`. **Zero is the one
 *   that matters**: `alive.html`'s `?freeze` is honoured on the rAF path and NOT inside
 *   `__SUGATA_STEP__`, so a stepped capture of a "frozen" page is not frozen at all. A zero step
 *   advances the RENDERER without advancing the simulation, which is the only way to let a
 *   temporal filter converge on a scene that is genuinely not moving.
 * @param {string} [options.page='/src/post.html'] - which page to drive. `alive.html` is the page
 *   a judge captures, so the default decision has to be measured there and not only here.
 * @param {?string} [options.saveTo] - path prefix; each kept frame is written as `<prefix>-<n>.png`
 *   so `tools/critic/measure.mjs` can read it.
 * @param {number[]} [options.keep] - which 1-based frame indices to decode and return. Defaults
 *   to the last one. Decoding is the expensive part, so a converged measurement keeps two frames
 *   out of three hundred rather than three hundred.
 * @returns {Promise<{ frames: Map<number, {width:number,height:number,data:Uint8Array}>, environment: Object, errors: string[] }>}
 */
export async function capturePlates( {
    browser, baseUrl, query, page: pagePath = '/src/post.html',
    width = 900, height = 1200, frames = 1, fps = 60, stepSeconds = null, keep = null, saveTo = null
} ) {

    const wanted = new Set( keep ?? [ frames ] );

    const context = await browser.newContext( {
        viewport: { width, height },
        deviceScaleFactor: 1,
        colorScheme: 'dark',
        reducedMotion: 'no-preference'
    } );

    const page = await context.newPage();
    const errors = [];

    page.on( 'pageerror', ( error ) => errors.push( error.message ) );
    page.on( 'console', ( message ) => {

        if ( message.type() === 'error' && /favicon/i.test( message.location()?.url ?? '' ) === false ) {

            errors.push( `console: ${ message.text() }` );

        }

    } );

    const separator = query.startsWith( '?' ) ? '&' : '?';
    const url = `${ baseUrl }${ pagePath }${ query }${ separator }capture`;

    await page.goto( url, { waitUntil: 'domcontentloaded' } );

    await page.waitForFunction( () => typeof globalThis.__SUGATA_STEP__ === 'function',
        null, { timeout: READY_TIMEOUT_MS, polling: 200 } )
        .catch( () => {

            throw new Error( `post.html never became ready for ${ url }` +
                ( errors.length > 0 ? `\n  ${ errors.join( '\n  ' ) }` : '' ) );

        } );

    const environment = await page.evaluate( () => globalThis.__SUGATA_ENV__?.() ?? {} );

    const decoded = new Map();
    const step = stepSeconds ?? ( 1 / fps );

    for ( let frame = 1; frame <= frames; frame += 1 ) {

        const stepped = await page.evaluate( ( dt ) => globalThis.__SUGATA_STEP__( dt ), step );

        if ( stepped !== true ) throw new Error( `__SUGATA_STEP__ refused at frame ${ frame } of ${ url }` );

        if ( wanted.has( frame ) ) {

            const shot = await page.screenshot();

            if ( saveTo !== null ) fs.writeFileSync( `${ saveTo }-${ frame }.png`, shot );

            decoded.set( frame, decodePlateBytes( shot ) );

        }

    }

    // The grade probe has no simulation to step: it is a static target and the only thing that
    // changes frame to frame is the grain. A short settle lets the first compiled frame land.
    if ( frames === 0 ) {

        await page.waitForTimeout( 400 );

        const shot = await page.screenshot();

        if ( saveTo !== null ) fs.writeFileSync( `${ saveTo }-0.png`, shot );

        decoded.set( 0, decodePlateBytes( shot ) );

    }

    await context.close();

    return { frames: decoded, environment, errors };

}

/** `png.mjs` calls the sample array `pixels`; everything below wants `data`. One place to say so. */
function decodePlateBytes( png ) {

    const { width, height, pixels } = decodePng( png );

    return { width, height, data: pixels };

}

// --- the statistics -------------------------------------------------------------------------------

/**
 * Rec.709 luma of one pixel, in **display units 0..1**.
 *
 * ⚠️ `png.mjs` hands back a `Float32Array` already normalised to 0..1, not the byte array the
 * name `pixels` suggests. Dividing by 255 here reads every plate a thousand times too dark and
 * every band statistic still looks like a plausible small number — which is exactly what it did
 * on the first run of this file. Code values are `luma * 255`, and the functions that report in
 * code values say so in their names.
 */
export function lumaAt( plate, x, y ) {

    const index = ( y * plate.width + x ) * 4;

    return 0.2126 * plate.data[ index ] + 0.7152 * plate.data[ index + 1 ] + 0.0722 * plate.data[ index + 2 ];

}

/** Luma in 8-bit code values, which is the unit the grain sigma and the temporal RMS are stated in. */
export function codeValueAt( plate, x, y ) {

    return lumaAt( plate, x, y ) * 255;

}

/**
 * Per-pixel RMS of the difference between two plates, inside a rect, in 8-bit code values.
 *
 * This is the statistic punch-list 3.12 is argued in, and its meaning depends entirely on what
 * the two plates are: two CONSECUTIVE frames of a scene that is not moving, so every code value
 * of difference is an artefact and zero is the correct answer.
 *
 * @param {Object} a - decoded plate
 * @param {Object} b - decoded plate
 * @param {{x:number,y:number,width:number,height:number}} rect
 */
export function temporalRms( a, b, rect ) {

    let sumSquares = 0;
    let count = 0;

    for ( let y = rect.y; y < rect.y + rect.height; y += 1 ) {

        for ( let x = rect.x; x < rect.x + rect.width; x += 1 ) {

            const difference = codeValueAt( a, x, y ) - codeValueAt( b, x, y );

            sumSquares += difference * difference;
            count += 1;

        }

    }

    return Math.sqrt( sumSquares / count );

}

/**
 * Edge quality along one row: how many pixels are partial, and how hard the hardest jump is.
 *
 * `crossings` counts pixels whose luma sits strictly between the two neighbouring plateaux —
 * intermediate coverage samples, i.e. antialiasing. `hardFraction` is the share of those
 * transitions that happen in a single pixel, which is what a jaggy IS. `meanLargestStep` is the
 * mean over transitions of the largest single-pixel luma jump, normalised to 0..1.
 *
 * @param {Object} plate
 * @param {{y:number,x0:number,x1:number}} row
 * @param {number} [threshold=8] - code values. Below this a difference is noise, not an edge.
 */
export function silhouetteCrossings( plate, { y, x0, x1 }, threshold = 8 ) {

    let crossings = 0;
    let transitions = 0;
    let hard = 0;
    let largestStepSum = 0;

    let x = x0 + 1;

    while ( x < x1 ) {

        const step = Math.abs( codeValueAt( plate, x, y ) - codeValueAt( plate, x - 1, y ) );

        if ( step < threshold ) { x += 1; continue; }

        // Walk to the end of this transition: consecutive pixels that keep changing.
        let largest = step;
        let width = 1;
        let cursor = x + 1;

        while ( cursor < x1 ) {

            const next = Math.abs( codeValueAt( plate, cursor, y ) - codeValueAt( plate, cursor - 1, y ) );

            if ( next < threshold ) break;

            largest = Math.max( largest, next );
            width += 1;
            cursor += 1;

        }

        transitions += 1;
        crossings += width - 1;
        if ( width === 1 ) hard += 1;
        largestStepSum += largest / 255;

        x = cursor + 1;

    }

    return {
        transitions,
        crossings,
        hardFraction: transitions === 0 ? 0 : hard / transitions,
        meanLargestStep: transitions === 0 ? 0 : largestStepSum / transitions
    };

}

/**
 * Mean, percentile and chroma over a rect, all in 0..1 display units except `chroma`, which is
 * `max(r,g,b) - min(r,g,b)` in the same units.
 *
 * The percentile is the statistic the look spec's black point is stated in (p0.1), and it is
 * computed over the population rather than over a mean, because the crush this gate exists to
 * catch moves a TAIL and leaves the mean almost where it was.
 */
export function bandStatistics( plate, rect, percentile = 0.001 ) {

    const values = [];
    let chromaSum = 0;
    let chromaMax = 0;

    for ( let y = rect.y; y < rect.y + rect.height; y += 1 ) {

        for ( let x = rect.x; x < rect.x + rect.width; x += 1 ) {

            const index = ( y * plate.width + x ) * 4;
            const r = plate.data[ index ];
            const g = plate.data[ index + 1 ];
            const b = plate.data[ index + 2 ];

            values.push( 0.2126 * r + 0.7152 * g + 0.0722 * b );

            const chroma = Math.max( r, g, b ) - Math.min( r, g, b );
            chromaSum += chroma;
            chromaMax = Math.max( chromaMax, chroma );

        }

    }

    values.sort( ( a, b ) => a - b );

    const mean = values.reduce( ( total, value ) => total + value, 0 ) / values.length;
    const variance = values.reduce( ( total, value ) => total + ( value - mean ) ** 2, 0 ) / values.length;

    return {
        count: values.length,
        mean,
        sigma: Math.sqrt( variance ),
        min: values[ 0 ],
        percentile: values[ Math.floor( values.length * percentile ) ],
        median: values[ Math.floor( values.length * 0.5 ) ],
        zeroFraction: values.filter( ( value ) => value === 0 ).length / values.length,
        chromaMean: chromaSum / values.length,
        chromaMax
    };

}

/**
 * The standard deviation of the per-pixel difference between two plates over a rect, in 8-bit code
 * values — the grain's own sigma when one plate is grained and the other is not.
 */
export function differenceSigma( a, b, rect ) {

    const differences = [];

    for ( let y = rect.y; y < rect.y + rect.height; y += 1 ) {

        for ( let x = rect.x; x < rect.x + rect.width; x += 1 ) {

            differences.push( codeValueAt( a, x, y ) - codeValueAt( b, x, y ) );

        }

    }

    const mean = differences.reduce( ( total, value ) => total + value, 0 ) / differences.length;
    const variance = differences.reduce( ( total, value ) => total + ( value - mean ) ** 2, 0 ) / differences.length;

    return { mean, sigma: Math.sqrt( variance ) };

}
