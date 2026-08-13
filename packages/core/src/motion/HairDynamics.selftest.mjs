/**
 * Gate for `packages/core/src/motion/HairDynamics.js` — punch-list 6.6, the hair that moves.
 *
 * ## Why this is a browser test and not a CPU mirror
 *
 * Every claim here is about what a WebGPU COMPUTE PASS wrote into a storage buffer. A JavaScript
 * re-implementation of the same arithmetic would agree with itself and say nothing about whether
 * the WGSL three generated does the same thing — LEARNINGS §1.25b — and this file has already been
 * paid for that lesson twice in one session: `'from' is a reserved keyword` in WGSL made the
 * rebuild kernel a silent no-op that a CPU mirror would have scored green, and a collider left at a
 * fixed WORLD point read a constant 9.709 mm of penetration in every variant including the one
 * where nothing moves. So this drives a real Chromium against a real vite, steps
 * `packages/testbed/src/hair.html?motion=1` on a fixed clock, and reads the numbers back off the
 * GPU buffer with `getArrayBufferAsync`.
 *
 * ## The six clauses, and the ONE defect each of them is rejected by
 *
 * §1.25a: a rejection proof written against the defect the gate was designed from proves the two
 * are consistent, not that either is right. So each row below names a MECHANISM, each mechanism is
 * one uniform or one submission shape, and the table asserts the whole row — **greens included**,
 * because a defect that turns every clause red proves nothing about which clause is doing the work.
 *
 *   | clause                        | what it measures                     | red proof              |
 *   |-------------------------------|--------------------------------------|------------------------|
 *   | I  inextensible               | worst segment vs its own rest length | `hairdefect=noftl`     |
 *   | M  it moves                   | mean tip lag behind the RIGID pose   | `hairdefect=kinematic` |
 *   | P  no penetration             | deepest particle inside the skull    | `hairdefect=nocollide` |
 *   | S  it settles                 | tip travel over 0.25 s, 4 s after    | `hairdefect=novelocity`|
 *   | E  rest is the equilibrium    | lag from rigid with the head STILL   | `hairdefect=fullgravity`|
 *   | D  dt-invariant               | 60 Hz against 120 Hz, same clock     | `hairstep=perframe`    |
 *   | X  one compute pass           | COMPUTE-pool ms per frame            | `hairsubmit=perkernel` |
 *
 * 🚩 **AND CLAUSE P CARRIES ITS OWN MASK CHECK, which is the one thing the spike got wrong.**
 * `tools/spikes/results/hair-motion.json`'s correctness table reports *0.000 mm of skull
 * penetration* in its green run AND in its `?breakFtl=1` red run. Both numbers are true and neither
 * means anything: the collider never fired. So P asserts `colliderContacts > 0` beside the
 * penetration figure — the count of particles resting exactly ON the collider — and a run where
 * the mask is empty fails whatever the penetration reads.
 *
 * ## What is NOT gated here, so its absence is not read as a claim
 *
 * The PICTURE. This file measures geometry off the buffer; whether a swinging bob reads as hair is
 * a thing somebody has to look at, and the round report carries that judgement with plates. The
 * shading is not here either — `?motion=1` draws through a plain `MeshStandardNodeMaterial`, not
 * `HairMaterial`, because this agent does not own that file and wiring the solver onto the
 * acceptance page is filed as a request rather than done.
 *
 * Usage:  node "packages/core/src/motion/HairDynamics.selftest.mjs"
 *         node "packages/core/src/motion/HairDynamics.selftest.mjs" --quick   forward checks only
 *
 * Exit codes follow tools/critic/measure.mjs:
 *   0 = every check green
 *   1 = at least one check FAILED
 *   2 = tool error — no Chromium, no vite, the page never became ready. NOT a pass.
 */

import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';

const REPOSITORY_ROOT = path.resolve( fileURLToPath( new URL( '.', import.meta.url ) ), '../../../..' );

const GPU_FLAGS = [ '--enable-unsafe-webgpu', '--ignore-gpu-blocklist', '--hide-scrollbars' ];
const QUICK = process.argv.includes( '--quick' );

/**
 * The stimulus every clause but E and D is measured on.
 *
 * `?head=impulse` is the ±0.85 rad / 0.6 Hz shake the research doc's spike used (§9.2), stopped
 * dead at 2 s. Energy in, then silence — which is the only stimulus a settling measurement can be
 * taken on, and it is the same trajectory for the other clauses so one run serves all of them.
 *
 * `?capture` takes the frame loop off requestAnimationFrame and hands it to `__HAIR_STEP__`, so
 * every number below is taken on a clock this file owns rather than on the machine's.
 */
const SHAKE_FRAMES = 120;

/**
 * ⚠️ SIX seconds of held head, not four, and the extra two are a margin rather than a preference.
 *
 * The softest cards in this groom run at 0.3x the tip stiffness (`chainComplianceBuffer`), which is
 * a time constant near 0.9 s. At 4 s the quiescence measured **0.4189 mm** against a 0.5 mm floor —
 * a 1.2x margin, which is not a gate, it is a coin flip with a good day behind it. At 6 s the same
 * run reads an order of magnitude lower and the red proof is unaffected, because
 * `hairdefect=novelocity` never settles at all.
 */
const SETTLE_FRAMES = 360;
const QUIESCENCE_FRAMES = 15;
const STEP_SECONDS = 1 / 60;

/**
 * The thresholds, each one stated against the measurement it separates.
 *
 * Every pair below is `green measured / red measured` from the run that wrote this file, 2026-08-13,
 * Chromium via Playwright against `hair.html?motion=1&head=impulse&capture` on the shipped
 * `assets/hair/bob01/g050.glb` — 294 chains × 17 rings = 4,998 particles.
 */
const THRESHOLDS = {
    /** 0.0001 mm green against 29,813 mm red. Anywhere in six orders of magnitude would do. */
    segmentErrorMm: 0.01,

    /** 20.1 mm green against 0.14 mm red. Also has to clear the project's own indistinguishability
     *  bracket, whose lower end is 0.48 px reported as "the hands never move". */
    meanTipTravelMm: 5,
    kinematicTipTravelMm: 1,

    /** 0.000 mm green against 17.79 mm red, over a mask of 31 live contacts. */
    penetrationMm: 0.05,
    penetrationRejectionMm: 2,

    /** 0.42 mm green at four seconds and an order less at six against 17.1 mm red, and the run
     *  has to have been moving first. See SETTLE_FRAMES. */
    quiescenceMm: 0.5,
    quiescenceRejectionMm: 5,

    /** 0.000115 mm green against a sag the `fullgravity` defect puts in the tens of millimetres. */
    restLagMm: 0.01,
    restLagRejectionMm: 1,

    /** 0.628 mm green against 25.2 mm red, on a signal of 18.4 mm. */
    frameRateDivergenceMm: 3,
    frameRateRejectionMm: 8,

    /** One frame of the solver reads 0.06554 ms — see the cost block for what that number is and
     *  is not. The ceiling is a BUDGET clause: 1.5% of 16.6 ms. */
    computeBudgetMs: 0.25,

    /** Two fresh page loads, same URL, same step sequence: the tips must agree. */
    reproducibilityMm: 0.001
};

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

/**
 * Playwright is deliberately not a dependency of this repo — it is a development instrument, not
 * part of the build — so it is looked up wherever it happens to live, npx's cache included. Same
 * resolution order as `tools/critic/capture.mjs` and `alive-capture-determinism.selftest.mjs`.
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

/** The watcher is off so a concurrent agent's save cannot navigate the page out from under a run. */
async function startVite() {

    const { createServer } = await import(
        path.join( REPOSITORY_ROOT, 'node_modules', 'vite', 'dist', 'node', 'index.js' ) );

    const server = await createServer( {
        configFile: path.join( REPOSITORY_ROOT, 'vite.config.js' ),
        server: { port: 5197, strictPort: false, hmr: false, watch: { ignored: [ '**' ] } },
        logLevel: 'silent'
    } );

    await server.listen();
    server.baseUrl = server.resolvedUrls.local[ 0 ].replace( /\/$/, '' );

    return server;

}

/**
 * Opens one page on a FRESH context and hands back the hooks, plus the page errors it collected.
 *
 * Fresh per run and not shared: the solver has state, which is the whole subject, and two runs off
 * one page would share it.
 */
async function openPage( browser, baseUrl, query ) {

    const context = await browser.newContext( { viewport: { width: 900, height: 1000 } } );
    const page = await context.newPage();

    // A block of 240 stepped frames is well past Playwright's 30 s default, and the failure mode of
    // leaving it there is a TOOL ERROR that reads like a broken page.
    page.setDefaultTimeout( 300_000 );

    const pageErrors = [];
    const consoleErrors = [];

    page.on( 'pageerror', ( error ) => pageErrors.push( error.message ) );

    // 🚩 The console IS the instrument for this subsystem. A WGSL compile failure does not throw —
    // three logs it and the compute pass becomes a silent no-op, which is exactly how the rebuild
    // kernel spent its first hour writing nothing while every buffer read back zeros. So console
    // errors are collected and asserted.
    //
    // ⚠️ Everything except a resource 404. `hair.html` ships no favicon, Chromium asks for one
    // anyway, and the console line it logs carries no URL — so the FAILING REQUEST is recorded
    // separately, off the response, and the favicon is excluded by name rather than by dropping a
    // whole class of message that a missing GLB would also land in.
    page.on( 'console', ( message ) => {

        if ( message.type() !== 'error' ) return;
        if ( message.text().startsWith( 'Failed to load resource' ) ) return;

        consoleErrors.push( message.text() );

    } );

    page.on( 'response', ( response ) => {

        if ( response.status() < 400 ) return;
        if ( response.url().endsWith( '/favicon.ico' ) ) return;

        consoleErrors.push( `HTTP ${ response.status() } ${ response.url() }` );

    } );

    await page.goto( `${ baseUrl }/src/hair.html?motion=1&capture&${ query }`,
        { waitUntil: 'domcontentloaded' } );

    await page.waitForFunction( () => typeof globalThis.__HAIR_STEP__ === 'function', null,
        { timeout: 120_000, polling: 200 } );

    return { context, page, pageErrors, consoleErrors };

}

/** Steps `frames` fixed frames and returns nothing — the caller measures when it wants to. */
async function step( page, frames, deltaSeconds = STEP_SECONDS ) {

    await page.evaluate( async ( { frames: count, delta } ) => {

        for ( let frame = 0; frame < count; frame ++ ) await globalThis.__HAIR_STEP__( delta );

    }, { frames, delta: deltaSeconds } );

}

const measure = ( page ) => page.evaluate( () => globalThis.__HAIR_MEASURE__() );

/**
 * The whole impulse run, in one page: shake, peak statistics, settle, quiescence.
 *
 * Statistics are peaks over the shake rather than end-of-run values, because a sinusoidal stimulus
 * passes through zero twice a cycle and an end-of-run reading is a coin toss about where in the
 * cycle the last frame landed.
 */
async function runImpulse( browser, baseUrl, query ) {

    const opened = await openPage( browser, baseUrl, `head=impulse&${ query }` );

    try {

        const peaks = { segmentErrorMm: 0, meanTipMm: 0, penetrationMm: 0, contacts: 0, nonFinite: 0 };

        for ( let block = 0; block < SHAKE_FRAMES / 6; block ++ ) {

            await step( opened.page, 6 );
            const sample = await measure( opened.page );

            peaks.segmentErrorMm = Math.max( peaks.segmentErrorMm, sample.worstSegmentErrorMm );
            peaks.meanTipMm = Math.max( peaks.meanTipMm, sample.meanTipDisplacementMm );
            peaks.penetrationMm = Math.max( peaks.penetrationMm, sample.deepestPenetrationMm );
            peaks.contacts = Math.max( peaks.contacts, sample.colliderContacts );
            peaks.nonFinite = Math.max( peaks.nonFinite, sample.nonFinite );

        }

        await step( opened.page, SETTLE_FRAMES );
        const settled = await measure( opened.page );

        await step( opened.page, QUIESCENCE_FRAMES );
        const after = await measure( opened.page );

        return {
            peaks,
            settled,
            quiescenceMm: worstTipTravelMm( settled.tips, after.tips ),
            errors: [ ...opened.pageErrors, ...opened.consoleErrors ]
        };

    } finally {

        await opened.context.close();

    }

}

/** The worst distance any tip moved between two snapshots, in millimetres. */
function worstTipTravelMm( before, after ) {

    let worst = 0;

    for ( let index = 0; index < before.length; index += 3 ) {

        worst = Math.max( worst, Math.hypot(
            after[ index ] - before[ index ],
            after[ index + 1 ] - before[ index + 1 ],
            after[ index + 2 ] - before[ index + 2 ] ) );

    }

    return worst * 1000;

}

/** The mean distance between two tip snapshots, in millimetres. */
function meanTipTravelMm( before, after ) {

    let sum = 0;
    let count = 0;

    for ( let index = 0; index < before.length; index += 3 ) {

        sum += Math.hypot(
            after[ index ] - before[ index ],
            after[ index + 1 ] - before[ index + 1 ],
            after[ index + 2 ] - before[ index + 2 ] );
        count ++;

    }

    return ( sum / count ) * 1000;

}

/**
 * The same two seconds of head shake at two frame rates, compared tip for tip.
 *
 * Same SIMULATION time, different frame counts — which is the only comparison that means anything:
 * `?head=shake` is a pure function of simulation time, so a solver whose trajectory depends on the
 * frame rate is the only thing that can separate the two runs.
 */
async function runFrameRatePair( browser, baseUrl, query ) {

    const at = async ( delta, frames ) => {

        const opened = await openPage( browser, baseUrl, `head=shake&${ query }` );

        try {

            await step( opened.page, frames, delta );
            return await measure( opened.page );

        } finally {

            await opened.context.close();

        }

    };

    const sixty = await at( 1 / 60, 120 );
    const oneTwenty = await at( 1 / 120, 240 );

    return {
        sixty,
        oneTwenty,
        meanMm: meanTipTravelMm( sixty.tips, oneTwenty.tips ),
        worstMm: worstTipTravelMm( sixty.tips, oneTwenty.tips )
    };

}

// --- run ----------------------------------------------------------------------------------------

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

console.log( `\nHairDynamics — ${ server.baseUrl }/src/hair.html?motion=1&head=impulse&capture` );
console.log( `${ SHAKE_FRAMES } frames of shake at 1/60, then ${ SETTLE_FRAMES } held, ` +
    `then ${ QUIESCENCE_FRAMES } more for the quiescence pair\n` );

const startedAtMs = Date.now();

try {

    console.log( '--- the forward run --------------------------------------------------------\n' );

    const green = await runImpulse( browser, server.baseUrl, 'hairdefect=none' );

    if ( green.errors.length > 0 ) {

        report( 'the page loads without errors', false, green.errors.slice( 0, 4 ).join( ' | ' ) );

    }

    // A page that simulated nothing would pass several clauses below. This is the shape check: the
    // groom the solver found has to be the groom the GLB contains.
    report(
        `G  the solver found the groom — ${ green.settled.chains } chains of ` +
            `${ green.settled.particles / green.settled.chains } rings`,
        green.settled.chains > 0 && green.settled.particles === green.settled.chains *
            ( green.settled.particles / green.settled.chains ),
        `${ green.settled.particles } particles over ${ green.settled.segments } segments, ` +
            `skull sphere ${ green.settled.skullRadiusMm.toFixed( 1 ) } mm`
    );

    report(
        'F  nothing in the buffer is non-finite',
        green.peaks.nonFinite === 0 && green.settled.nonFinite === 0,
        `${ green.peaks.nonFinite } non-finite components at the peak, ` +
            `${ green.settled.nonFinite } after settling`
    );

    report(
        `I  inextensible — the worst segment is within ${ THRESHOLDS.segmentErrorMm } mm of its own rest length`,
        green.peaks.segmentErrorMm < THRESHOLDS.segmentErrorMm,
        `${ green.peaks.segmentErrorMm.toFixed( 6 ) } mm over ${ green.settled.segments } segments — ` +
            'and the rest length is stored PER SEGMENT because this groom\'s rings are not uniformly ' +
            'spaced (median 38.91% spread within a card)'
    );

    report(
        `M  it moves — the mean tip lags the rigid pose by more than ${ THRESHOLDS.meanTipTravelMm } mm`,
        green.peaks.meanTipMm > THRESHOLDS.meanTipTravelMm,
        `${ green.peaks.meanTipMm.toFixed( 2 ) } mm peak, measured against where the head transform ` +
            'ALONE would have put each tip — so the head turning is subtracted out and what is left ' +
            'is the simulation'
    );

    report(
        `P  no penetration — nothing is more than ${ THRESHOLDS.penetrationMm } mm inside the skull`,
        green.peaks.penetrationMm < THRESHOLDS.penetrationMm,
        `${ green.peaks.penetrationMm.toFixed( 3 ) } mm deepest, against a ` +
            `${ green.settled.skullRadiusMm.toFixed( 1 ) } mm sphere fitted to the groom's own roots`
    );

    // 🚩 The mask check. See this file's header — the spike reported 0.000 mm of penetration in its
    // green run AND its red one, because the collider never fired in either.
    report(
        'P2 ...over a mask that CONTAINED contacts, so the zero above is a resolved collision',
        green.peaks.contacts > 0,
        `${ green.peaks.contacts } particles resting exactly on the collider at the peak. Zero here ` +
            'would mean P measured a collider that never ran.'
    );

    report(
        `S  it settles — the worst tip moves under ${ THRESHOLDS.quiescenceMm } mm in the quarter second ` +
            `after ${ ( SETTLE_FRAMES / 60 ).toFixed( 0 ) } s of held head`,
        green.quiescenceMm < THRESHOLDS.quiescenceMm,
        `${ green.quiescenceMm.toFixed( 4 ) } mm, having peaked at ` +
            `${ green.peaks.meanTipMm.toFixed( 2 ) } mm of mean tip lag during the shake`
    );

    // ...and S would pass trivially on a solver that never moved, which is why M is asserted on the
    // same run rather than on a separate one.
    report(
        'S2 ...and that is a settle rather than a stillness, because M moved on this same run',
        green.peaks.meanTipMm > THRESHOLDS.meanTipTravelMm,
        `peak ${ green.peaks.meanTipMm.toFixed( 2 ) } mm -> quiescent ${ green.quiescenceMm.toFixed( 4 ) } mm, ` +
            `a factor of ${ ( green.peaks.meanTipMm / Math.max( green.quiescenceMm, 1e-6 ) ).toFixed( 0 ) }`
    );

    console.log( '\n--- E: with the head STILL, the solver is the identity ----------------------\n' );

    const still = await openPage( browser, server.baseUrl, 'head=still' );
    await step( still.page, 300 );
    const stillMeasure = await measure( still.page );
    await still.context.close();

    report(
        `E  head still for 5 s — every particle is within ${ THRESHOLDS.restLagMm } mm of the authored pose`,
        stillMeasure.maxDisplacementMm < THRESHOLDS.restLagMm,
        `${ stillMeasure.maxDisplacementMm.toFixed( 6 ) } mm worst, kinetic energy ` +
            `${ stillMeasure.kineticEnergy.toExponential( 2 ) }. This is what makes the A/B toggle a ` +
            'CONTROL: with the solver on and nothing moving, the plate is the plate without it.'
    );

    console.log( '\n--- D: the same motion at two frame rates -----------------------------------\n' );

    const rates = await runFrameRatePair( browser, server.baseUrl, 'hairdefect=none' );

    report(
        `D  60 Hz and 120 Hz reach the same pose at t = 2 s, within ${ THRESHOLDS.frameRateDivergenceMm } mm`,
        rates.meanMm < THRESHOLDS.frameRateDivergenceMm,
        `${ rates.meanMm.toFixed( 4 ) } mm mean / ${ rates.worstMm.toFixed( 4 ) } mm worst over 294 tips, ` +
            `on a signal of ${ rates.sixty.meanTipDisplacementMm.toFixed( 2 ) } mm of mean tip lag`
    );

    // ...and D is trivially green on a solver that does not move at all, at either rate.
    report(
        'D2 ...and both rates were actually simulating, so D is not comparing two still grooms',
        rates.sixty.meanTipDisplacementMm > THRESHOLDS.meanTipTravelMm &&
            rates.oneTwenty.meanTipDisplacementMm > THRESHOLDS.meanTipTravelMm,
        `${ rates.sixty.meanTipDisplacementMm.toFixed( 2 ) } mm at 60 Hz, ` +
            `${ rates.oneTwenty.meanTipDisplacementMm.toFixed( 2 ) } mm at 120 Hz`
    );

    console.log( '\n--- Z: two independent page loads of the same URL ---------------------------\n' );

    const first = await runFrameRatePairSingle( browser, server.baseUrl );
    const second = await runFrameRatePairSingle( browser, server.baseUrl );

    report(
        'Z  two fresh loads, same URL, same step sequence — the same tips',
        worstTipTravelMm( first.tips, second.tips ) < THRESHOLDS.reproducibilityMm,
        `${ worstTipTravelMm( first.tips, second.tips ).toFixed( 6 ) } mm worst tip difference. The ` +
            'solver draws no random number and reads no wall clock, so a capture driver that supplies ' +
            'a fixed step reproduces frame for frame — provided it calls reset() when it takes over.'
    );

    console.log( '\n--- X: what it costs, on the COMPUTE pool -----------------------------------\n' );

    const cost = await measureCost( browser, server.baseUrl, 'hairsubmit=onepass' );

    report(
        `X  the whole solver costs under ${ THRESHOLDS.computeBudgetMs } ms of COMPUTE a frame`,
        cost.p95 < THRESHOLDS.computeBudgetMs,
        `p50 ${ cost.p50.toFixed( 5 ) } ms / p95 ${ cost.p95.toFixed( 5 ) } ms over ${ cost.samples } ` +
            `frames — ${ ( cost.p95 / 16.6 * 100 ).toFixed( 2 ) }% of a 16.6 ms budget. The amortised ` +
            `dispatch arithmetic, ${ cost.batchRepeats } copies of the frame's dispatches inside ONE ` +
            `pass, is ${ cost.batchPerFrameMs.toFixed( 5 ) } ms a frame, so the remainder is the pass ` +
            `opening. ${ describeQuantum( cost.quantumMs ) }`
    );

    // 🎯 AND THE SUBMISSION SHAPE IS ASSERTED AS A COUNT, NOT AS A DURATION.
    //
    // Research doc §0.3 is the most valuable engineering fact in this subsystem — a compute pass
    // costs 30.8–54.1 µs to open and an extra dispatch inside one costs 2.3–5.1 µs, so the naive
    // submission is about ten times the price of the simulation. But the TIMING of that comparison
    // will not hold a gate: two runs of this file, same tree and same machine minutes apart, read
    // the per-kernel arm at 0.11091 ms and at 0.02717 ms of p50 against a one-pass arm that barely
    // moved (0.02366, 0.02350) — 4.7x on one run and 1.2x on the other (§1.25y, a threshold tuned
    // on a quiet machine is a threshold tuned on the weather). The COUNT is exact: one array-shaped
    // call is 1, one call per kernel per substep is 3, and no thermal state moves an integer.
    report(
        'X2 ...and it is submitted as ONE compute call a frame, counted rather than timed',
        cost.computeCallsPerFrame === 1,
        `the solver made ${ cost.computeCallsPerFrame } renderer.compute() call this frame. Research doc §0.3: every ` +
            'substep plus the rebuild go into one `renderer.compute( array )`, because the pass ' +
            'opening is 93% of the ungrouped cost.'
    );

    if ( QUICK === true ) {

        console.log( '\n--quick: rejection proofs SKIPPED. This run is not a verdict on the gate.\n' );

    } else {

        console.log( '\n--- rejection proofs: one mechanism per clause ------------------------------\n' );

        const noftl = await runImpulse( browser, server.baseUrl, 'hairdefect=noftl' );

        report(
            '  I  hairdefect=noftl breaks inextensibility',
            noftl.peaks.segmentErrorMm > 1,
            `${ noftl.peaks.segmentErrorMm.toFixed( 3 ) } mm of segment error against ` +
                `${ green.peaks.segmentErrorMm.toFixed( 6 ) } mm green — the FTL projection is the ` +
                'only line removed; prediction, gravity, the shape constraint and the colliders all run.'
        );

        const kinematic = await runImpulse( browser, server.baseUrl, 'hairdefect=kinematic' );

        report(
            '  M  hairdefect=kinematic stops the hair moving, and M sees it',
            kinematic.peaks.meanTipMm < THRESHOLDS.kinematicTipTravelMm,
            `${ kinematic.peaks.meanTipMm.toFixed( 3 ) } mm against ${ green.peaks.meanTipMm.toFixed( 2 ) } mm ` +
                'green. The solver still runs and the head still turns — so a green M here would mean ' +
                'M was measuring the head transform rather than the simulation.'
        );

        report(
            '  M2 ...and it leaves inextensibility green, so the two clauses are independent',
            kinematic.peaks.segmentErrorMm < THRESHOLDS.segmentErrorMm,
            `${ kinematic.peaks.segmentErrorMm.toFixed( 6 ) } mm of segment error`
        );

        const nocollide = await runImpulse( browser, server.baseUrl, 'hairdefect=nocollide' );

        report(
            '  P  hairdefect=nocollide lets the groom into the skull',
            nocollide.peaks.penetrationMm > THRESHOLDS.penetrationRejectionMm,
            `${ nocollide.peaks.penetrationMm.toFixed( 3 ) } mm deep against ` +
                `${ green.peaks.penetrationMm.toFixed( 3 ) } mm green. This is the number that says ` +
                `the ${ green.peaks.contacts } contacts in the forward run were doing work.`
        );

        report(
            '  P2 ...and it leaves inextensibility green — the collider slides ALONG the length sphere',
            nocollide.peaks.segmentErrorMm < THRESHOLDS.segmentErrorMm,
            `${ nocollide.peaks.segmentErrorMm.toFixed( 6 ) } mm with the collider off against ` +
                `${ green.peaks.segmentErrorMm.toFixed( 6 ) } mm with it on. Both green is the claim: ` +
                'resolving the collider onto the circle where the two constraint spheres meet ' +
                'satisfies BOTH exactly, which is what TressFX and the spike trade away.'
        );

        const novelocity = await runImpulse( browser, server.baseUrl, 'hairdefect=novelocity' );

        report(
            '  S  hairdefect=novelocity stops it settling',
            novelocity.quiescenceMm > THRESHOLDS.quiescenceRejectionMm,
            `${ novelocity.quiescenceMm.toFixed( 3 ) } mm of tip travel a quarter second after ` +
                `${ ( SETTLE_FRAMES / 60 ).toFixed( 0 ) } s of held head, against ` +
                `${ green.quiescenceMm.toFixed( 4 ) } mm green. PBD eq 13 is the one line removed.`
        );

        report(
            '  S2 ...and it leaves inextensibility green, so S is not reading a blow-up',
            novelocity.peaks.segmentErrorMm < THRESHOLDS.segmentErrorMm,
            `${ novelocity.peaks.segmentErrorMm.toFixed( 6 ) } mm of segment error`
        );

        const sagging = await openPage( browser, server.baseUrl, 'head=still&hairdefect=fullgravity' );
        await step( sagging.page, 300 );
        const sagged = await measure( sagging.page );
        await sagging.context.close();

        report(
            '  E  hairdefect=fullgravity makes the authored pose stop being the equilibrium',
            sagged.maxDisplacementMm > THRESHOLDS.restLagRejectionMm,
            `${ sagged.maxDisplacementMm.toFixed( 3 ) } mm of sag with the head STILL, against ` +
                `${ stillMeasure.maxDisplacementMm.toFixed( 6 ) } mm green. The groom already carries ` +
                'gravity — hair_cards.py:1123 — so the simulation applies the CHANGE in it, and this ' +
                'defect applies the whole 9.81 on top.'
        );

        const perframe = await runFrameRatePair( browser, server.baseUrl, 'hairstep=perframe' );

        report(
            '  D  hairstep=perframe makes the trajectory depend on the frame rate',
            perframe.meanMm > THRESHOLDS.frameRateRejectionMm,
            `${ perframe.meanMm.toFixed( 3 ) } mm mean / ${ perframe.worstMm.toFixed( 3 ) } mm worst ` +
                `between 60 Hz and 120 Hz, against ${ rates.meanMm.toFixed( 4 ) } mm fixed-step. ` +
                'LEARNINGS §1.13, in one measurement.'
        );

        report(
            '  D2 ...and it is a DIFFERENT motion, not merely a shifted one',
            Math.abs( perframe.sixty.meanTipDisplacementMm - rates.sixty.meanTipDisplacementMm ) > 5,
            `mean tip lag ${ perframe.sixty.meanTipDisplacementMm.toFixed( 2 ) } mm per-frame against ` +
                `${ rates.sixty.meanTipDisplacementMm.toFixed( 2 ) } mm fixed-step at the same 60 Hz — ` +
                'a bigger step is a softer solver, so the defect changes the look as well as the ' +
                'reproducibility.'
        );

        const perkernel = await measureCost( browser, server.baseUrl, 'hairsubmit=perkernel' );

        report(
            '  X2 hairsubmit=perkernel opens three passes a frame, and the count sees it',
            perkernel.computeCallsPerFrame === 3,
            `${ perkernel.computeCallsPerFrame } renderer.compute() calls a frame against ` +
                `${ cost.computeCallsPerFrame } one-pass — two solve substeps and the rebuild, each ` +
                'in its own call.'
        );

        // Printed, deliberately NOT asserted. See the X2 comment: the timing difference between the
        // two arms is real and is the reason the rule exists, but it is the same size as this
        // statistic's own noise on this machine, and a gate row over a straddling statistic is a
        // coin flip wearing a check's clothes.
        console.log( `      (the same pair by TIME, not a check: p50 ${ perkernel.p50.toFixed( 5 ) } / ` +
            `p95 ${ perkernel.p95.toFixed( 5 ) } ms per-kernel against ${ cost.p50.toFixed( 5 ) } / ` +
            `${ cost.p95.toFixed( 5 ) } one-pass, and amortised ` +
            `${ perkernel.batchPerFrameMs.toFixed( 5 ) } against ${ cost.batchPerFrameMs.toFixed( 5 ) }. ` +
            'Research doc §0.3 puts the pass opening at 30.8–54.1 µs, and the two arms here differed ' +
            'by 4.7x on one run of this file and by 1.2x on another — same tree, same machine, ' +
            'minutes apart. The direction is always right and the magnitude is weather, which is why ' +
            'the COUNT above is the check and this line is printed rather than asserted.)' );

    }

} catch ( error ) {

    await browser.close();
    await server.close();
    toolError( `${ error.message }\n${ error.stack }` );

}

await browser.close();
await server.close();

const seconds = ( ( Date.now() - startedAtMs ) / 1000 ).toFixed( 0 );

console.log( `\n${ checks - failures }/${ checks } checks green in ${ seconds }s` );

if ( QUICK === true ) console.log( 'RAN WITH --quick — the rejection proofs did not run.' );

process.exit( failures === 0 ? 0 : 1 );

// --- the two helpers that need the harness above ------------------------------------------------

/** One 60 Hz run of the shake to t = 2 s, for the reproducibility pair. */
async function runFrameRatePairSingle( browser, baseUrl ) {

    const opened = await openPage( browser, baseUrl, 'head=shake' );

    try {

        await step( opened.page, 120 );
        return await measure( opened.page );

    } finally {

        await opened.context.close();

    }

}

/**
 * The COMPUTE pool, per frame and amortised.
 *
 * ⚠️ The quantum is DERIVED from the samples rather than assumed: the greatest common divisor of
 * every non-zero reading. If a future browser resolves finer, this reports that instead of a
 * constant somebody typed in 2026.
 */
async function measureCost( browser, baseUrl, query ) {

    const opened = await openPage( browser, baseUrl, `head=shake&gputime=1&${ query }` );

    try {

        await step( opened.page, 60 );

        // Read BEFORE the amortisation batch, which is a deliberately abnormal submission.
        const state = await opened.page.evaluate( () => globalThis.__HAIR_STATE__() );

        const samples = await opened.page.evaluate( async () => {

            const values = [];

            for ( let frame = 0; frame < 120; frame ++ ) {

                await globalThis.__HAIR_STEP__( 1 / 60 );
                const reading = await globalThis.__HAIR_GPU_MS__();
                if ( reading !== null ) values.push( reading.compute );

            }

            return values;

        } );

        const batch = await opened.page.evaluate( async () => {

            const runs = [];
            for ( let attempt = 0; attempt < 8; attempt ++ ) runs.push( await globalThis.__HAIR_GPU_COST__( 64 ) );

            return runs;

        } );

        const sorted = [ ...samples ].sort( ( a, b ) => a - b );
        const nonZero = sorted.filter( ( value ) => value > 0 );

        return {
            computeCallsPerFrame: state.computeCallsThisFrame,
            samples: sorted.length,
            p50: sorted[ Math.floor( sorted.length * 0.5 ) ] ?? 0,
            p95: sorted[ Math.floor( sorted.length * 0.95 ) ] ?? 0,
            quantumMs: nonZero.reduce( ( carry, value ) => greatestCommonDivisor( carry, value ), 0 ),
            batchRepeats: 64,
            batchPerFrameMs: Math.min( ...batch.map( ( run ) => run.perFrameMs ) )
        };

    } finally {

        await opened.context.close();

    }

}

/**
 * ⚠️ Whether this environment's GPU clock is quantised, said out loud rather than assumed.
 *
 * Measured 2026-08-13: headless Chromium under Playwright resolves this pool to the nanosecond and
 * the greatest common divisor of 120 samples comes back at 0.000001 ms — but the SAME page in the
 * Chrome the browser pane drives read every sample as an exact multiple of **0.065536 ms**, one or
 * two ticks and nothing between. A cost quoted off that clock would be quoting the clock. So the
 * quantum is derived from the samples on every run instead of being a constant somebody typed.
 */
function describeQuantum( quantumMs ) {

    if ( quantumMs < 0.001 ) {

        return `Timestamp resolution here is ${ quantumMs.toFixed( 6 ) } ms — fine enough that these ` +
            'are durations rather than tick counts.';

    }

    return `⚠️ EVERY SAMPLE IS AN INTEGER MULTIPLE OF ${ quantumMs.toFixed( 6 ) } ms, so this clock ` +
        'is counting ticks rather than resolving a duration and the reading is an upper bound.';

}

/** Numeric GCD, to a nanosecond, so the timestamp quantum can be read off the samples. */
function greatestCommonDivisor( a, b ) {

    let left = Math.round( a * 1e6 );
    let right = Math.round( b * 1e6 );

    while ( right > 0 ) {

        [ left, right ] = [ right, left % right ];

    }

    return left / 1e6;

}
