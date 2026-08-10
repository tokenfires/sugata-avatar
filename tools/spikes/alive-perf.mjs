/**
 * alive-perf — punch-list 8.3. What does ONE FRAME of `alive.html` cost, on the GPU, measured
 * with timestamp queries rather than counted with a frame counter?
 *
 * Three things make this different from the Phase 0 spikes in this directory:
 *
 *   - It measures THE SHIPPED PAGE, not a probe scene. The spikes answered "what does a
 *     RectAreaLight cost"; this answers "what does the thing a judge captures cost", which is the
 *     only question 8.3 asks. Nothing here builds a scene.
 *
 *   - It drives the page through `?capture` + `window.__SUGATA_STEP__`, which already stops the
 *     rAF loop, draws exactly one frame and awaits `queue.onSubmittedWorkDone()`. That gives a
 *     one-frame-at-a-time driver for free, and it means each `resolveTimestampsAsync()` covers
 *     exactly one frame's render contexts — three's pool returns "the total of the last frame in
 *     the pending set", so a driver that lets several frames pool up reports a number that
 *     corresponds to nothing. Motion is NOT frozen: `?freeze` is deliberately absent so skinning,
 *     69 morph targets and the whole idle stack are doing real work every sampled frame.
 *
 *   - `alive.html` does not ask for `trackTimestamp`, and this tool writes nothing into the repo,
 *     so the flag is injected by rewriting the served module text in a Playwright route handler.
 *     The patch is asserted in-page (`renderer.backend.trackTimestamp === true`) before any
 *     number is kept — a silent patch miss would report the WebGL-fallback story, a plausible
 *     zero, rather than an error.
 *
 * Wall-clock is not the headline and is not reported as cost: rAF is vsync-locked, so it floors
 * at the refresh interval and says nothing until a configuration is already over budget. The
 * `--live` pass exists for the other half — CPU main-thread time per frame, sampled off
 * `stage.frameMs` on the real rAF loop with the overlays in whatever state the URL asks for.
 *
 * ## Two things that were wrong first, and would be wrong again
 *
 * **Warm up for at least 90 frames.** The first run of this tool reported 9.6 ms for a
 * configuration that measured 15.9-16.3 ms in nine independent runs BEFORE the redundant-RTT
 * removal in `render/TRAAPost.js`, and 10.3-11.2 ms p50 after it. It used 40 warm-up frames, and
 * the distribution was bimodal: the bloom mip chain and the temporal history are not all built on
 * frame 40, so the early samples are of a smaller pass list. A short warm-up does not add noise, it
 * measures a different render.
 *
 * ⚠️ Both halves of that pair are quoted with the build they belong to, deliberately. The lesson is
 * about warm-up and survives the number moving; a number in a header with no build attached to it
 * is how the next reader inherits a stale headline as a fact.
 *
 * ## 🚩 What this tool CANNOT attribute, learned by trying
 *
 * The variant list below turns terms of the grade off one at a time and reports a delta. For three
 * of them that delta is not the term's cost, because the flag sets a UNIFORM and leaves the pass
 * list exactly as it was. `?bloom=0` recorded **+0.001 ms** here while twelve render passes went on
 * rendering, and the round that read it concluded the grade's cost "is not the arithmetic" and then
 * could not find where it was. `?bloom=0` is now STRUCTURAL (`Grade.bloomEnabled` skips the chain);
 * `?grain=0` and `?vignette=0` are still arithmetic-only and their deltas are honest measurements
 * of an arithmetic change and nothing more.
 *
 * The general rule this bought: a toggle prices a PASS only if the toggle removes the pass. Before
 * quoting any row of this table as the cost of a subsystem, check what the flag does at the source.
 *
 * **The rAF rate on this machine is 120 Hz, not 60.** An unpaced live run therefore asks the page
 * for 120 fps and the tail of the distribution stops being about the frame. `--pace N` renders on
 * every Nth vsync tick; it defaults to whatever makes 60 Hz, measured on the page rather than
 * assumed. Note that in headless Chromium the frame source does not back-pressure on GPU
 * completion, so "frames per second" out of the loop counts TICKS TAKEN, not frames presented —
 * it is not evidence of holding a frame rate. The GPU timestamp is.
 *
 * ⚠️ DVFS. A `?capture` step awaits two paints, so the GPU idles ~30 ms between frames and can
 * drop its clocks. Capture-mode and paced-60 live numbers agree here to within 5%, and a headed
 * run agrees with a headless one to 0.05%, so this is under control — but one profile run of
 * `?scale=1` came back at 7.29 ms with EVERY pass uniformly 2.3x cheaper, which is a clock
 * signature and not a workload one. It did not reproduce in two re-runs (25.5, 25.7). Treat a
 * single anomalously fast run as suspect and re-run it before believing it.
 *
 * Usage:
 *   node tools/spikes/alive-perf.mjs --suite toggles
 *   node tools/spikes/alive-perf.mjs --suite resolution --repeats 3
 *   node tools/spikes/alive-perf.mjs --live --suite framing        # paced to 60 Hz, adds CPU
 *   node tools/spikes/alive-perf.mjs --suite toggles --headed      # cross-check the backend
 *
 * Results are written to tools/spikes/results/alive-perf.<suite>.<mode>.json and printed.
 */

import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname( fileURLToPath( import.meta.url ) );
const REPOSITORY_ROOT = path.resolve( HERE, '..', '..' );
const RESULTS_DIRECTORY = path.join( HERE, 'results' );

const GPU_FLAGS = [ '--enable-unsafe-webgpu', '--ignore-gpu-blocklist', '--hide-scrollbars' ];

// 🚩 DVFS IS THE BIGGEST SOURCE OF ERROR IN THIS MEASUREMENT AND IT IS WORTH 2.3x.
//
// Measured, same page, same 20 render passes, same 1920x1080: the frame total read 7.29 ms in one
// run and 16.29 ms in another, with EVERY INDIVIDUAL PASS scaled by the same factor. A workload
// change moves resolution-dependent passes and leaves the rest; a uniform scaling of all twenty is
// a clock change. The machine is on AC with no low-power mode and no thermal warning, so this is
// ordinary Apple-GPU frequency management responding to duty cycle: a driver that idles the GPU
// between frames — which `?capture` does, because it awaits two paints per step — measures the
// low-clock cost.
//
// `--unsaturated` keeps the vsync-limited behaviour. The default removes the frame-rate limit so
// the page renders back to back, the GPU never idles, clocks pin at the top, and the run also
// yields a THROUGHPUT number (frames actually completed per second) that does not depend on
// trusting the timestamps at all.
const UNTHROTTLED_FLAGS = [ '--disable-gpu-vsync', '--disable-frame-rate-limit' ];

// The two framings the punch list names, plus the sizes. `pageDefault` is a maximised window on
// this machine's own panel — 1728 x 1117 CSS at dpr 2 — because that is what the page renders at
// when nobody passes a size, and it is 3.7x the pixel count of 1080p.
const SIZES = {
    '1080p': { width: 1920, height: 1080, dpr: 1 },
    'pageDefault': { width: 1728, height: 1117, dpr: 2 },
    '720p': { width: 1280, height: 720, dpr: 1 }
};

// Every variant is the shipped default plus ONE change, so a delta against `base` is that
// change's cost and nothing else. `query` is appended to the base query string.
const VARIANTS = {
    base: '',
    'skin=0': 'skin=0',
    'eyes=0': 'eyes=0',
    'eyeocc=0': 'eyeocc=0',
    'cards=0': 'cards=0',
    'shadows=0': 'shadows=0',
    'ground=0': 'ground=0',
    'ground=none': 'ground=none',
    'grade=0': 'grade=0',
    'aa=msaa': 'aa=msaa',
    'aa=off': 'aa=off',
    'aa=traa': 'aa=traa',
    'forward': 'aa=msaa&grade=0',
    'affect=joy': 'affect=joy',
    'affect=anger': 'affect=anger',
    'wear': 'wear=female_casualsuit01,shoes01',
    'wear-empty': 'wear=',
    // 🚩 These ids are checked against assets/identity/catalogue.json. `?identity=` with an id
    // that does not exist WARNS ON THE CONSOLE AND APPLIES NOTHING, so a mistyped sweep measures
    // the default figure and reports a delta of zero that reads as "identity is free".
    'identity': 'identity=nose/nose-width1-decr-incr:-0.8,eyes/eye-scale-decr-incr:0.9,chin/chin-jaw-drop-decr-incr:0.7',
    'scale=1': 'scale=1',
    'scale=0.8': 'scale=0.8',
    'scale=0.5': 'scale=0.5',
    'cavity=0': 'cavity=0',
    'specaa=0': 'specaa=0',
    'nomotion': 'freeze',
    // Grade decomposition. `Grade.js` builds one node graph; these turn its terms off one at a
    // time. 🚩 THEY CANNOT ATTRIBUTE THE GRADE'S COST TO A TERM — see the header. `bloom=0` is
    // structural and does remove its twelve passes; `grain=0` and `vignette=0` change arithmetic
    // only, so their deltas are a floor on the term's cost and never its price.
    'bloom=0': 'bloom=0',
    'gsharp=none': 'gsharp=none',
    'grain=0': 'grain=0',
    'vignette=0': 'vignette=0',
    'bloom0+sharp0': 'bloom=0&gsharp=none'
};

const SUITES = {
    toggles: {
        sizes: [ '1080p' ],
        frames: [ 'portrait' ],
        variants: [ 'base', 'skin=0', 'eyes=0', 'eyeocc=0', 'cards=0', 'shadows=0',
            'ground=none', 'grade=0', 'aa=msaa', 'aa=off', 'forward', 'nomotion' ]
    },
    framing: {
        sizes: [ '720p', '1080p', 'pageDefault' ],
        frames: [ 'portrait', 'body' ],
        variants: [ 'base' ]
    },
    resolution: {
        sizes: [ '1080p', 'pageDefault' ],
        frames: [ 'portrait' ],
        variants: [ 'base', 'scale=1', 'scale=0.8', 'scale=0.5' ]
    },
    content: {
        sizes: [ '1080p' ],
        frames: [ 'portrait' ],
        variants: [ 'base', 'affect=joy', 'affect=anger', 'identity', 'wear-empty', 'wear' ]
    },
    body: {
        sizes: [ '1080p' ],
        frames: [ 'body' ],
        variants: [ 'base', 'shadows=0', 'ground=none', 'grade=0', 'wear', 'scale=1' ]
    },
    detail: {
        sizes: [ '1080p' ],
        frames: [ 'portrait' ],
        variants: [ 'base', 'cavity=0', 'specaa=0', 'aa=traa' ]
    },
    grade: {
        sizes: [ '1080p' ],
        frames: [ 'portrait' ],
        variants: [ 'base', 'bloom=0', 'gsharp=none', 'grain=0', 'vignette=0', 'bloom0+sharp0', 'grade=0' ]
    }
};

// ---------------------------------------------------------------------------
// entry
// ---------------------------------------------------------------------------

async function main() {

    const options = parseArguments( process.argv.slice( 2 ) );
    const suite = SUITES[ options.suite ];

    if ( suite === undefined ) throw new Error( `unknown suite ${ options.suite }; have ${ Object.keys( SUITES ).join( ', ' ) }` );

    const plan = [];

    for ( const sizeName of suite.sizes ) {
        for ( const frameName of suite.frames ) {
            for ( const variantName of ( options.variants ?? suite.variants ) ) {
                plan.push( { sizeName, frameName, variantName, overlays: options.overlays } );
            }
        }
    }

    const playwright = await loadPlaywright( options.playwrightPath );
    const server = await startViteServer();
    const browser = await launchBrowser( playwright, options.headed, options.saturate );

    const collected = new Map();
    for ( const item of plan ) collected.set( keyOf( item ), { ...item, gpu: [], cpu: [], wall: [], contexts: [], cpuStep: [], renderedFps: null, drawCalls: null, triangles: null, environment: null } );

    try {

        for ( let repeat = 0; repeat < options.repeats; repeat ++ ) {

            // Alternating the order decorrelates a variant's position in the run from the variant
            // itself, so GPU clock drift across a long suite lands as spread rather than as a
            // false shape in the curve. This was a real defect in the Phase 0 rectarea sweep.
            const order = repeat % 2 === 0 ? plan : plan.slice().reverse();

            for ( const item of order ) {

                const label = `${ keyOf( item ) }  pass ${ repeat + 1 }/${ options.repeats }`;
                process.stdout.write( `  ${ label } … ` );

                const bucket = collected.get( keyOf( item ) );

                const result = options.live
                    ? await measureLive( browser, server, item, options )
                    : await measureGpu( browser, server, item, options );

                bucket.gpu.push( ...result.gpu );
                bucket.environment = result.environment;

                if ( options.live ) {
                    bucket.cpu.push( ...result.cpu );
                    bucket.wall.push( ...result.wall );
                    bucket.contexts.push( ...result.contextsPerResolve );
                    bucket.drawCalls = result.drawCalls;
                    bucket.triangles = result.triangles;
                    bucket.renderedFps = result.renderedFramesPerSecond;
                    console.log( `gpu p50 ${ fmt( percentile( result.gpu, 0.5 ) ) }  cpu p50 ${ fmt( percentile( result.cpu, 0.5 ) ) }  wall p50 ${ fmt( percentile( result.wall, 0.5 ) ) } ms  (${ result.gpu.length } gpu samples)` );
                } else {
                    bucket.cpuStep.push( ...result.cpuStep );
                    console.log( `gpu p50 ${ fmt( percentile( result.gpu, 0.5 ) ) } ms  (${ result.gpu.length } samples)` );
                }

            }

        }

    } finally {
        await browser.close();
        await server.close();
    }

    report( options, collected );

}

function keyOf( item ) {
    return `${ item.sizeName }/${ item.frameName }/${ item.variantName }`;
}

// ---------------------------------------------------------------------------
// the GPU pass
// ---------------------------------------------------------------------------

/**
 * One variant, one page load, N single-frame steps each followed by its own timestamp resolve.
 *
 * Nothing is kept until the page confirms the injected `trackTimestamp` took and the backend is
 * WebGPU: on the WebGL2 fallback three has no timestamp pool at all and `resolveTimestampsAsync`
 * returns undefined, which would otherwise be silently filtered into an empty sample set.
 */
async function measureGpu( browser, server, item, options ) {

    const size = SIZES[ item.sizeName ];
    const { page, context } = await openPage( browser, server, item, size, { capture: true } );

    try {

        await page.waitForFunction( () => typeof globalThis.__SUGATA_STEP__ === 'function', null, { timeout: 180_000 } );

        const environment = await page.evaluate( () => {
            const stage = globalThis.sugata.stage;
            return {
                backend: stage.backendName,
                trackTimestamp: stage.renderer.backend.trackTimestamp === true,
                hasTimestampFeature: typeof stage.renderer.hasFeature === 'function'
                    ? stage.renderer.hasFeature( 'timestamp-query' ) : null,
                pixelRatio: stage.pixelRatio,
                drawingBuffer: [ stage.renderer.domElement.width, stage.renderer.domElement.height ],
                resolutionScale: stage.resolutionScale,
                scenePass: stage.scenePass === null || stage.scenePass === undefined
                    ? null
                    : [ stage.scenePass.renderTarget?.width ?? null, stage.scenePass.renderTarget?.height ?? null ],
                pipeline: stage.renderPipeline !== null,
                multisampled: stage.multisampled,
                subsystems: globalThis.sugata.subsystems ? globalThis.sugata.subsystems() : null
            };
        } );

        if ( environment.backend !== 'webgpu' ) throw new Error( `backend is ${ environment.backend }; GPU timestamps need WebGPU` );
        if ( environment.trackTimestamp !== true ) throw new Error( 'trackTimestamp patch did not take — refusing to report wall clock as GPU cost' );

        // Warm-up: shader compilation, texture upload, TAAU history convergence and the GPU
        // clocking up all happen here and none of them belong in the distribution.
        await page.evaluate( async ( warmup ) => {
            for ( let index = 0; index < warmup; index ++ ) {
                const stepped = await globalThis.__SUGATA_STEP__( 1 / 60 );
                if ( stepped === false ) { index --; await new Promise( ( r ) => setTimeout( r, 50 ) ); }
            }
        }, options.warmup );

        // Drain whatever queries the warm-up left pending so the first sample is not a sum of
        // sixty frames.
        await page.evaluate( () => globalThis.sugata.stage.renderer.resolveTimestampsAsync( 'render' ) );

        const samples = await page.evaluate( async ( count ) => {
            const stage = globalThis.sugata.stage;
            const gpu = [];
            const cpuStep = [];

            for ( let index = 0; index < count; index ++ ) {
                const startedAt = performance.now();
                await globalThis.__SUGATA_STEP__( 1 / 60 );
                cpuStep.push( performance.now() - startedAt );

                const duration = await stage.renderer.resolveTimestampsAsync( 'render' );
                if ( typeof duration === 'number' && duration > 0 ) gpu.push( duration );
            }

            return { gpu, cpuStep };
        }, options.samples );

        return { ...samples, environment };

    } finally {
        await context.close();
    }

}

// ---------------------------------------------------------------------------
// the live pass — CPU main-thread cost on the real rAF loop
// ---------------------------------------------------------------------------

/**
 * The measurement that actually answers 8.3, because it is taken on the loop that ships.
 *
 * The `?capture` driver above is deterministic but it is not the shipping loop: every step awaits
 * `onSubmittedWorkDone()` and then two paints, so the GPU sits idle ~30 ms between frames and
 * clocks down. Here the page runs its own `setAnimationLoop` at vsync and three things are sampled
 * off it at once:
 *
 *   - GPU: `resolveTimestampsAsync` fired from a wrapper around `Stage.draw`. The resolve returns
 *     the summed duration of every render context belonging to the LAST frame in the pending set,
 *     which with one render per tick is exactly one frame's GPU cost. A resolve already in flight
 *     is skipped rather than queued, so no sample is ever a sum of two frames.
 *   - CPU: `stage.frameMs`, sampled inside `Stage.renderFrame` around the whole body — every
 *     motion contributor plus the draw submission. This is what decides whether the main thread,
 *     not the GPU, is the ceiling.
 *   - Wall: the rAF interval. Reported for shape only. It is vsync-locked, so it floors at the
 *     refresh interval and is a pass/fail light rather than a cost.
 *
 * Overlays are left in whatever state the URL asks for, because the HUD text and the strip chart
 * are per-frame main-thread work a `?bare` plate does not pay for and a live demo does.
 */
async function measureLive( browser, server, item, options ) {

    const size = SIZES[ item.sizeName ];
    const { page, context } = await openPage( browser, server, item, size, { capture: false } );

    try {

        await page.waitForFunction( () => globalThis.sugata !== undefined
            && globalThis.sugata.session.figure !== null, null, { timeout: 180_000 } );

        const environment = await page.evaluate( () => {
            const stage = globalThis.sugata.stage;
            return {
                backend: stage.backendName,
                trackTimestamp: stage.renderer.backend.trackTimestamp === true,
                pixelRatio: stage.pixelRatio,
                drawingBuffer: [ stage.renderer.domElement.width, stage.renderer.domElement.height ],
                resolutionScale: stage.resolutionScale,
                scenePass: stage.scenePass == null ? null
                    : [ stage.scenePass.renderTarget?.width ?? null, stage.scenePass.renderTarget?.height ?? null ],
                pipeline: stage.renderPipeline !== null,
                multisampled: stage.multisampled
            };
        } );

        if ( environment.trackTimestamp !== true ) throw new Error( 'trackTimestamp patch did not take' );

        // 🚩 THIS PANEL IS 120 Hz AND THAT IS NOT THE BUDGET. Measured: rAF on this machine
        // fires every 8.3 ms, so an unpaced live run asks the page for 120 fps, the GPU never gets
        // idle time between frames, and the tail of the distribution stops being about the frame
        // and starts being about contention. `pace` renders on every Nth vsync tick, so the loop
        // that ships runs at a real 60 Hz cadence with a real 16.6 ms period, which is the
        // condition punch-list 8.3 actually states.
        const refreshHz = await page.evaluate( () => new Promise( ( resolve ) => {
            const stamps = [];
            const tick = ( t ) => {
                stamps.push( t );
                if ( stamps.length < 25 ) requestAnimationFrame( tick );
                else {
                    const gaps = stamps.slice( 1 ).map( ( value, index ) => value - stamps[ index ] ).sort( ( a, b ) => a - b );
                    resolve( 1000 / gaps[ Math.floor( gaps.length / 2 ) ] );
                }
            };
            requestAnimationFrame( tick );
        } ) );

        const pace = options.pace ?? Math.max( 1, Math.round( refreshHz / 60 ) );

        const result = await page.evaluate( async ( { seconds, warmupSeconds, pace } ) => {
            const stage = globalThis.sugata.stage;
            const renderer = stage.renderer;

            const gpu = [];
            const cpu = [];
            const wall = [];
            const contextsPerResolve = [];
            let sampling = false;
            let resolveInFlight = false;

            // 🚩 THE RESOLVE MUST RUN DURING WARM-UP TOO. The pool holds 2048 queries and this page
            // allocates one pair per render context per frame — 10 of them on the deferred path —
            // so it overflows in about 200 frames. Past that `allocateQueriesForContext` returns
            // null and passes stop being timed AT ALL: the frame total silently becomes the total
            // of whichever passes still had a slot. It warns once on the console and is otherwise
            // invisible in the numbers.
            const pool = renderer.backend.timestampQueryPool?.render ?? null;

            const originalDraw = stage.draw.bind( stage );
            stage.draw = function wrappedDraw() {
                originalDraw();
                if ( resolveInFlight ) return;
                resolveInFlight = true;
                const pending = pool === null ? null : pool.currentQueryIndex / 2;
                renderer.resolveTimestampsAsync( 'render' ).then( ( duration ) => {
                    resolveInFlight = false;
                    if ( sampling === false ) return;
                    if ( typeof duration === 'number' && duration > 0 ) gpu.push( duration );
                    if ( pending !== null ) contextsPerResolve.push( pending );
                } );
            };

            let previous = 0;
            let tickIndex = 0;
            let rendered = 0;
            const startedAt = performance.now();

            await new Promise( ( finish ) => {

                renderer.setAnimationLoop( ( timeMs ) => {

                    tickIndex ++;
                    if ( tickIndex % pace !== 0 ) return;

                    const now = performance.now();
                    const elapsed = now - startedAt;

                    // The page's own frame body, unchanged: every motion contributor, then draw.
                    stage.renderFrame( timeMs );
                    rendered ++;

                    if ( elapsed > warmupSeconds * 1000 ) {
                        sampling = true;
                        cpu.push( stage.frameMs );
                        if ( previous > 0 ) wall.push( now - previous );
                    }
                    previous = now;

                    if ( elapsed > ( warmupSeconds + seconds ) * 1000 ) {
                        renderer.setAnimationLoop( stage.renderFrame );
                        finish();
                    }

                } );

            } );

            stage.draw = originalDraw;

            return {
                gpu, cpu, wall, contextsPerResolve,
                renderedFramesPerSecond: rendered / ( ( performance.now() - startedAt ) / 1000 ),
                drawCalls: stage.drawCalls,
                triangles: stage.triangles,
                poolMax: pool === null ? null : pool.maxQueries
            };
        }, { seconds: options.liveSeconds, warmupSeconds: options.warmupSeconds, pace } );

        return {
            gpu: result.gpu,
            cpu: result.cpu,
            wall: result.wall,
            contextsPerResolve: result.contextsPerResolve,
            drawCalls: result.drawCalls,
            triangles: result.triangles,
            renderedFramesPerSecond: result.renderedFramesPerSecond,
            environment: { ...environment, refreshHz, pace }
        };

    } finally {
        await context.close();
    }

}

// ---------------------------------------------------------------------------
// page plumbing
// ---------------------------------------------------------------------------

async function openPage( browser, server, item, size, { capture } ) {

    const context = await browser.newContext( {
        viewport: { width: size.width, height: size.height },
        deviceScaleFactor: size.dpr,
        colorScheme: 'dark'
    } );

    const page = await context.newPage();

    // 🚩 THE ONE MODIFICATION. `alive.html` never asks for `trackTimestamp`, and this tool is not
    // allowed to write into the repo, so the served module text is rewritten in flight. It is
    // asserted in-page afterwards rather than assumed — see measureGpu.
    await page.route( '**/src/alive.js*', async ( route ) => {
        const response = await route.fetch();
        const body = await response.text();
        const needle = 'await stage.create( document.getElementById( \'stage\' ), {';
        const patched = body.includes( needle )
            ? body.replace( needle, needle + '\n        trackTimestamp: true,' )
            : body.replace( /await stage\.create\(\s*document\.getElementById\(\s*'stage'\s*\),\s*\{/, ( m ) => m + '\n trackTimestamp: true,' );
        await route.fulfill( { response, body: patched, headers: { ...response.headers(), 'content-length': String( Buffer.byteLength( patched ) ) } } );
    } );

    page.on( 'pageerror', ( error ) => console.warn( `\n    page error: ${ error.message }` ) );

    const url = new URL( '/alive.html', server.baseUrl );
    if ( item.overlays !== true ) url.searchParams.set( 'bare', '1' );
    url.searchParams.set( 'seed', '1' );
    if ( capture ) url.searchParams.set( 'capture', '1' );
    if ( item.frameName === 'body' ) url.searchParams.set( 'frame', 'body' );

    const extra = VARIANTS[ item.variantName ];
    if ( extra === undefined ) throw new Error( `unknown variant ${ item.variantName }` );
    for ( const pair of extra.split( '&' ).filter( Boolean ) ) {
        const index = pair.indexOf( '=' );
        url.searchParams.set( pair.slice( 0, index ), pair.slice( index + 1 ) );
    }

    await page.goto( url.href, { waitUntil: 'load', timeout: 180_000 } );

    return { page, context, url: url.href };

}

async function startViteServer() {
    const { createServer } = await import( 'vite' );
    const server = await createServer( {
        configFile: path.join( REPOSITORY_ROOT, 'vite.config.js' ),
        server: { port: 5191, strictPort: false, hmr: false, watch: { ignored: [ '**' ] } },
        logLevel: 'warn'
    } );
    await server.listen();
    server.baseUrl = server.resolvedUrls.local[ 0 ].replace( /\/$/, '' );
    console.log( `vite      ${ server.baseUrl }` );
    return server;
}

async function launchBrowser( playwright, headedOnly = false, saturate = false ) {
    for ( const headless of ( headedOnly ? [ false ] : [ true, false ] ) ) {
        try {
            const browser = await playwright.chromium.launch( { channel: 'chromium', headless,
                args: saturate ? [ ...GPU_FLAGS, ...UNTHROTTLED_FLAGS ] : GPU_FLAGS } );
            console.log( `chromium  ${ headless ? 'headless' : 'headed' }` );
            return browser;
        } catch ( error ) {
            console.warn( `  launch (headless=${ headless }) failed: ${ error.message }` );
        }
    }
    throw new Error( 'could not launch Chromium' );
}

async function loadPlaywright( explicitPath ) {
    const candidates = [];
    if ( explicitPath ) candidates.push( explicitPath );
    if ( process.env.PLAYWRIGHT_MODULE ) candidates.push( process.env.PLAYWRIGHT_MODULE );
    candidates.push( 'playwright' );

    const cache = path.join( process.env.HOME ?? '', '.npm', '_npx' );
    if ( fs.existsSync( cache ) ) {
        for ( const entry of fs.readdirSync( cache ) ) {
            const candidate = path.join( cache, entry, 'node_modules', 'playwright' );
            if ( fs.existsSync( candidate ) ) candidates.push( candidate );
        }
    }

    const require = createRequire( import.meta.url );
    for ( const candidate of candidates ) {
        try {
            const resolved = require.resolve( candidate );
            const namespace = await import( pathToFileURL( resolved ).href );
            if ( namespace.chromium ) return namespace;
            if ( namespace.default?.chromium ) return namespace.default;
        } catch { /* next */ }
    }
    throw new Error( 'playwright not resolvable' );
}

// ---------------------------------------------------------------------------
// statistics and reporting
// ---------------------------------------------------------------------------

function distribution( samples ) {
    if ( samples.length === 0 ) return { count: 0, p50: null, p90: null, p99: null, min: null, max: null, mean: null };
    const sorted = samples.slice().sort( ( a, b ) => a - b );
    return {
        count: sorted.length,
        p50: percentile( sorted, 0.5 ),
        p90: percentile( sorted, 0.9 ),
        p99: percentile( sorted, 0.99 ),
        min: sorted[ 0 ],
        max: sorted[ sorted.length - 1 ],
        mean: sorted.reduce( ( a, b ) => a + b, 0 ) / sorted.length
    };
}

function percentile( samples, fraction ) {
    if ( samples.length === 0 ) return null;
    const sorted = samples.slice().sort( ( a, b ) => a - b );
    return sorted[ Math.min( sorted.length - 1, Math.floor( sorted.length * fraction ) ) ];
}

function fmt( value ) {
    if ( value === null || value === undefined ) return '—';
    return value.toFixed( 3 );
}

function report( options, collected ) {

    const rows = [];
    let baseline = null;

    for ( const [ key, bucket ] of collected ) {
        const row = {
            key,
            sizeName: bucket.sizeName,
            frameName: bucket.frameName,
            variantName: bucket.variantName,
            environment: bucket.environment,
            drawCalls: bucket.drawCalls,
            triangles: bucket.triangles,
            renderedFps: bucket.renderedFps,
            contextsPerFrame: distribution( bucket.contexts ),
            gpuStats: distribution( bucket.gpu ),
            cpuStats: distribution( bucket.cpu ),
            wallStats: distribution( bucket.wall ),
            cpuStepStats: distribution( bucket.cpuStep )
        };
        rows.push( row );
        if ( row.variantName === 'base' && baseline === null ) baseline = row;
    }

    console.log( '' );
    console.log( 'variant                                  gpu p50   gpu p90   gpu p99   gpu max    Δ base    cpu p50   cpu p99   wall p50  wall p99   fps   ctx    n' );
    for ( const row of rows ) {
        const g = row.gpuStats;
        const c = row.cpuStats;
        const w = row.wallStats;
        const sameFraming = baseline !== null && baseline.sizeName === row.sizeName && baseline.frameName === row.frameName;
        const delta = sameFraming && g.p50 !== null && baseline.gpuStats.p50 !== null
            ? g.p50 - baseline.gpuStats.p50 : null;
        console.log(
            `${ row.key.padEnd( 40 ) } ${ fmt( g.p50 ).padStart( 8 ) }  ${ fmt( g.p90 ).padStart( 8 ) }  ` +
            `${ fmt( g.p99 ).padStart( 8 ) }  ${ fmt( g.max ).padStart( 8 ) }  ${ fmt( delta ).padStart( 8 ) }  ` +
            `${ fmt( c.p50 ).padStart( 8 ) }  ${ fmt( c.p99 ).padStart( 8 ) }  ${ fmt( w.p50 ).padStart( 9 ) }  ${ fmt( w.p99 ).padStart( 8 ) }  ${ ( row.renderedFps == null ? '—' : row.renderedFps.toFixed( 1 ) ).padStart( 5 ) }  ${ String( row.contextsPerFrame.p50 ?? '—' ).padStart( 4 ) }  ${ String( g.count ).padStart( 4 ) }` );
    }

    fs.mkdirSync( RESULTS_DIRECTORY, { recursive: true } );
    const file = path.join( RESULTS_DIRECTORY, `alive-perf.${ options.suite }${ options.live ? '.live' : '.capture' }.json` );
    fs.writeFileSync( file, JSON.stringify( { options, rows }, null, 2 ) );
    console.log( `\nwrote ${ file }` );

}

function parseArguments( argv ) {
    const options = {
        suite: 'toggles',
        variants: null,
        repeats: 2,
        warmup: 90,
        samples: 200,
        liveSeconds: 6,
        warmupSeconds: 2.5,
        pace: null,
        live: false,
        overlays: false,
        headed: false,
        saturate: false,
        playwrightPath: null
    };

    for ( let index = 0; index < argv.length; index ++ ) {
        const flag = argv[ index ];
        const value = argv[ index + 1 ];
        switch ( flag ) {
            case '--suite': options.suite = value; index ++; break;
            case '--variants': options.variants = value.split( ',' ); index ++; break;
            case '--repeats': options.repeats = Number( value ); index ++; break;
            case '--warmup': options.warmup = Number( value ); index ++; break;
            case '--samples': options.samples = Number( value ); index ++; break;
            case '--seconds': options.liveSeconds = Number( value ); index ++; break;
            case '--pace': options.pace = Number( value ); index ++; break;
            case '--live': options.live = true; break;
            case '--overlays': options.overlays = true; break;
            case '--headed': options.headed = true; break;
            case '--saturate': options.saturate = true; break;
            case '--playwright': options.playwrightPath = value; index ++; break;
            default: throw new Error( `unknown flag ${ flag }` );
        }
    }

    return options;
}

main().catch( ( error ) => { console.error( error ); process.exit( 1 ); } );
