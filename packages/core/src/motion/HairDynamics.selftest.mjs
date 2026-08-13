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
 * ## The nine clauses, and the ONE defect each of them is rejected by
 *
 * §1.25a: a rejection proof written against the defect the gate was designed from proves the two
 * are consistent, not that either is right. So each row below names a MECHANISM, each mechanism is
 * one uniform or one submission shape, and the table asserts the whole row — **greens included**,
 * because a defect that turns every clause red proves nothing about which clause is doing the work.
 *
 * ⚠️ The last three rows' red proofs are SOURCE breaks rather than query flags, because no shipped
 * url makes the solver expensive: `SUBSTEP_SECONDS` at 1/7680 with the cap raised runs 128 substeps
 * a frame instead of 2, and at 1/100 it stops dividing the frame so the substep count alternates.
 * Both are restored byte-identically; the readings are in the X block.
 *
 *   | clause                        | what it measures                     | red proof              |
 *   |-------------------------------|--------------------------------------|------------------------|
 *   | I  inextensible               | worst segment vs its own rest length | `hairdefect=noftl`     |
 *   | M  it moves                   | mean tip lag behind the RIGID pose   | `hairdefect=kinematic` |
 *   | P  no penetration             | deepest particle inside the skull    | `hairdefect=nocollide` |
 *   | S  it settles                 | tip travel over 0.25 s, 4 s after    | `hairdefect=novelocity`|
 *   | E  rest is the equilibrium    | lag from rigid with the head STILL   | `hairdefect=fullgravity`|
 *   | D  dt-invariant               | 60 Hz against 120 Hz, same clock     | `hairstep=perframe`    |
 *   | X  it fits the budget         | COMPUTE-pool ms per frame, at p50    | `SUBSTEP_SECONDS`/64   |
 *   | Xb ...and p50 is the right one| substeps per frame — one number      | `SUBSTEP_SECONDS`=1/100|
 *   | X2 one compute pass           | `renderer.compute()` calls, counted  | `hairsubmit=perkernel` |
 *
 * ## And the ALIVE block, which is six checks on a DIFFERENT page and the reason is a defect
 *
 * Everything above is measured on `packages/testbed/src/hair.html`, and for one round that was the
 * only page the solver was on — gated at 25/25, invisible to every plate anybody judges. The blind
 * critic read the shipped build as *"nothing moves, and I can say that from the data rather than by
 * squinting."* Round 13 had already shipped the same shape once, with `render/HairOIT.js`. So the
 * A checks are taken on `alive.html` itself:
 *
 *   | A1 | the solver is constructed on the acceptance page, one compute call a frame |
 *   | A2 | it MOVES behind the shipped `MotionStack`, no stimulus written for the test |
 *   | A3 | ...and reads ~zero on a `?freeze` plate — A2's liveness control                |
 *   | A4 | `?capture` reaches it: 60 steps leave exactly 120 substeps, from two boot epochs |
 *   | A5 | ...and those two loads reach the same pose, tip for tip                       |
 *   | A6 | `?hairmotion=0` is a real rigid control, and what it costs a still plate in pixels |
 *
 * ⚠️ **The critic's own instrument reads 0 on this build too, and it is correct that it does.**
 * `geometry.attributes.position.version` counts uploads of the CPU-side attribute; this solver
 * writes a GPU storage buffer that the material samples through `positionNode`, so the attribute
 * stays the bind pose forever. A2 reads the buffer the vertex stage actually samples and A6 reads
 * rendered pixels, which are the honest forms of the same question.
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
 * The PICTURE. This file measures geometry off the buffer and one pixel share; whether a swinging
 * bob reads as hair is a thing somebody has to look at, and the round report carries that judgement
 * with plates.
 *
 * The TANGENT. `HairMaterial` reads a baked strand direction, so a card that has moved is shaded
 * off a tangent that no longer points along it. The rebuild kernel already computes the live one
 * and how it should reach the BSDF is the shading owner's call — REQ-070 in `docs/OPEN-REQUESTS.md`.
 * Nothing here measures it, and that is an absence rather than a clean bill.
 *
 * The SHADING on `hair.html`: `?motion=1` draws through a plain `MeshStandardNodeMaterial` rather
 * than `HairMaterial`, because that file is not this one's. The ALIVE block below is the one place
 * the two meet, and it runs the shipped material.
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

// The ALIVE section compares two rendered plates, which is the only instrument that can say what
// the A/B toggle costs a picture. Same decoder every other pixel gate in the repo uses.
import { decodePng } from '../../../../tools/critic/png.mjs';

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
 * The ALIVE section's recipes, and every flag in them is load-bearing.
 *
 * `bare` and `seed=1` are what every gate plate in this repository carries. `capture` is what makes
 * the clock this file's rather than the machine's. There is deliberately NO `freeze` in the base:
 * the whole question is whether the SHIPPED idle stack reaches the hair, and a frozen page answers
 * a different one — check A3 loads that page separately as the control.
 *
 * The pixel recipe adds `aa=msaa&grade=0`, which is the deterministic forward path. The shipped
 * default is known non-reproducible to about 1 code value on under 0.001% of samples (see
 * `alive.js`'s `takeOverFrameLoop`), so a pixel comparison taken there could not tell a toggle from
 * a quantiser. `hairoit=cutout` because the shipped `stochastic` arm refuses alpha-to-coverage and
 * `alive.js` would fall back to cutout anyway with a warning — naming it keeps the recipe honest.
 */
const ALIVE_BASE = 'bare&seed=1&capture';
const ALIVE_PIXEL_BASE = `${ ALIVE_BASE }&freeze&aa=msaa&grade=0&hairoit=cutout`;

/**
 * How long the second load of the A4 pair is made to wait for its GLB.
 *
 * Borrowed wholesale from `alive-capture-determinism.selftest.mjs`'s `BOOT_DELAY_MS`, and for its
 * reason: two back-to-back loads against a warm vite boot in the SAME number of rAF frames, so a
 * pair taken without this would agree even with the reset deleted, and the check would be measuring
 * "two warm loads agreed" — a thing the defect also does. A4 asserts the two epochs really did
 * differ before it is allowed to mean anything.
 */
const ALIVE_BOOT_DELAY_MS = 400;

/** 450x600 rather than the 900x1200 the lighting gates use: the ALIVE checks are geometric and one
 *  pixel share, none of them is a code value against a reference band, and a quarter of the samples
 *  is a quarter of the screenshot time on a section that loads six plates. */
const ALIVE_WIDTH = 450;
const ALIVE_HEIGHT = 600;

/**
 * The whole ALIVE measurement, as ONE function shipped into the page.
 *
 * It has to be self-contained — Playwright serialises the source and there is no closure on the
 * other side — and it reads the buffer the VERTEX STAGE samples rather than any bookkeeping the
 * page keeps about itself, which is the only reading that cannot be faked by a counter.
 *
 * `positionVersion` is the blind critic's own instrument, carried so the run can say out loud that
 * it reads 0 and why that is correct rather than leaving the next reader to rediscover it.
 */
const ALIVE_MEASURE = async () => {

    const session = globalThis.sugata.session;
    const dynamics = session.hairDynamics;

    if ( dynamics === null || dynamics === undefined ) return null;

    // 🚩 A SOLVER THAT WAS BUILT AND NEVER STEPPED HAS NO GPU BUFFER TO READ, and `getArrayBufferAsync`
    // throws on it rather than returning zeros. That is precisely the state a `trackFigure` which
    // dropped its call leaves behind, so it is REPORTED rather than allowed to become a tool error:
    // exit 2 means "the harness broke", and this is the gate catching the thing it was written for.
    let read = null;

    try {

        read = await dynamics.readCentrelines();

    } catch ( error ) {

        return { neverRan: true, reason: error.message, steps: dynamics.stepsTaken, tips: [] };

    }

    const groom = dynamics.groom;
    const head = read.headMatrix;

    let maxTipMm = 0;
    let sumTipMm = 0;
    let nonFinite = 0;
    const tips = [];

    for ( let particle = 0; particle < groom.particleCount; particle ++ ) {

        const x = read.positions[ particle * 3 ];
        const y = read.positions[ particle * 3 + 1 ];
        const z = read.positions[ particle * 3 + 2 ];

        if ( Number.isFinite( x ) === false || Number.isFinite( y ) === false ||
            Number.isFinite( z ) === false ) { nonFinite ++; continue; }

        if ( particle % groom.pointsPerChain !== groom.pointsPerChain - 1 ) continue;

        // Where the head transform ALONE would have put this tip. The difference is the simulation.
        const rx = groom.restCentres[ particle * 3 ];
        const ry = groom.restCentres[ particle * 3 + 1 ];
        const rz = groom.restCentres[ particle * 3 + 2 ];

        const distance = Math.hypot(
            x - ( head[ 0 ] * rx + head[ 4 ] * ry + head[ 8 ] * rz + head[ 12 ] ),
            y - ( head[ 1 ] * rx + head[ 5 ] * ry + head[ 9 ] * rz + head[ 13 ] ),
            z - ( head[ 2 ] * rx + head[ 6 ] * ry + head[ 10 ] * rz + head[ 14 ] ) ) * 1000;

        sumTipMm += distance;
        if ( distance > maxTipMm ) maxTipMm = distance;
        tips.push( x, y, z );

    }

    // The CPU-side attribute the critic stepped. It is the bind pose for the life of the page.
    const attribute = session.hair.meshes[ 0 ].geometry.getAttribute( 'position' );

    return {
        steps: read.steps,
        meanTipMm: sumTipMm / groom.chainCount,
        maxTipMm,
        nonFinite,
        positionVersion: attribute.version,
        tips
    };

};

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

    /** The ceiling is a BUDGET clause and nothing else: 1.5% of 16.6 ms. It is pinned by that
     *  derivation rather than by its distance from any reading, so it does not move when the
     *  solver gets cheaper — LEARNINGS §1.25z, a bound with a derivation is pinned by it.
     *
     *  ⚠️ WHAT MOVED IN R20 WAS THE STATISTIC UNDER IT, NOT THIS NUMBER. It was applied to `p95`
     *  of 120 single-frame COMPUTE timestamps, and that statistic reads the machine rather than
     *  the solver — see the X block for the two-pool control that proves it. Measured this
     *  session over six sittings of the same page: p50 0.02746–0.02837 ms (a 3.3% spread), p95
     *  0.28849–0.32682 ms (above this ceiling on every one of the six). */
    computeBudgetMs: 0.25,

    /** Two fresh page loads, same URL, same step sequence: the tips must agree. */
    reproducibilityMm: 0.001,

    /** ALIVE. Peak mean tip lag over 120 captured frames of the SHIPPED idle stack, against the
     *  same instrument on a `?freeze` plate where the head does not move. Measured 2026-08-13 on
     *  `alive.html?bare&seed=1&capture&hair=1&preroll=2`: **2.6009 mm peak mean / 11.3155 mm peak
     *  worst tip against 0.002658 mm frozen**, a factor of 4,257 between the two. (The same pair on
     *  the bake an hour earlier read 3.2177 / 14.5249 against 0.004067 — see the warning below.)
     *
     *  ⚠️ THE GROOM MOVED UNDER THIS MEASUREMENT THREE TIMES IN ONE SESSION and the floors are set
     *  wide because of it: `assets/hair/bob01/g050.glb` read 294 chains, then 370, then 378 while
     *  these checks were being written, because the generator is being iterated in the same round.
     *  The bakes are gitignored, so `git status` clean says nothing about them. The floor is under
     *  half the smallest green reading seen across those three grooms and 250x the frozen one; a
     *  tighter one would be a threshold tuned on one bake of an artefact that is still moving. */
    aliveMeanTipMm: 1.0,
    aliveStillTipMm: 0.1,

    /** ALIVE. What the A/B toggle costs a STILL plate, as a share of samples, on the deterministic
     *  forward path. Not zero and it is not claimed to be — see check A5. */
    aliveControlSampleShare: 0.005
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

    // 🚩 THE BUDGET IS TAKEN AT p50, AND WHICH ORDER STATISTIC THIS IS COST A ROUND TO SETTLE.
    //
    // It read `p95` from R16 — `5a08e7e`, where this file was born — and went red in R19,
    // undeclared, caught by the first run of the declaration machinery. The solver did
    // not get more expensive. Measured over six sittings of this page this session, p50 is
    // 0.02746–0.02837 ms — a 3.3% spread, and CHEAPER than the 0.06554 ms this threshold was
    // derived against — while p95 lands at 0.28849–0.32682 ms, above the ceiling on all six. The
    // work is the same on every one of the 120 frames (Xb asserts that rather than assuming it), so
    // a statistic that swings 11x across identical frames is not reading the solver.
    //
    // ⚠️ AND THE FILE HAD ALREADY WRITTEN THIS LESSON DOWN ONE CLAUSE LOWER without applying it
    // here: X2's block says the per-kernel/one-pass TIME comparison moved 4.7x on one run of this
    // file and 1.2x on another, same tree and same machine minutes apart, which is why X2 asserts a
    // COUNT. The same pool, the same weather, and the same answer — assert the stable statistic and
    // print the tail. `max` is printed below for exactly that reason: its absence would be a claim.
    report(
        `X  the whole solver costs under ${ THRESHOLDS.computeBudgetMs } ms of COMPUTE a frame`,
        cost.p50 < THRESHOLDS.computeBudgetMs,
        `p50 ${ cost.p50.toFixed( 5 ) } ms over ${ cost.samples } frames — ` +
            `${ ( cost.p50 / 16.6 * 100 ).toFixed( 2 ) }% of a 16.6 ms budget. The amortised ` +
            `dispatch arithmetic, ${ cost.batchRepeats } copies of the frame's dispatches inside ONE ` +
            `pass, is ${ cost.batchPerFrameMs.toFixed( 5 ) } ms a frame, so the remainder is the pass ` +
            `opening. ${ describeQuantum( cost.quantumMs ) } (p95 ${ cost.p95.toFixed( 5 ) } ms, ` +
            `worst ${ cost.max.toFixed( 5 ) } ms — REPORTED, and bounded by NOTHING in this file. ` +
            'Xb says why p50 is the honest statistic; it does not put a ceiling on the tail, and ' +
            'R20 measured that no ceiling on it would hold — see Xb\'s header for the control that ' +
            'was tried and withdrawn. The absence is stated so it is not read as a clean bill.)'
    );

    // 🎯 WHAT LICENSES p50 IS THAT THE WORK IS IDENTICAL, AND THAT IS THE ONLY THING ASSERTED HERE.
    //
    // At 1/60 with SUBSTEP_SECONDS = 1/120 the accumulator lands on exactly two substeps a frame in
    // binary, so every frame dispatches the same two solve kernels and the same rebuild over the
    // same chain count. Assert it rather than reason about it — a run whose substep count varied
    // WOULD honestly cost different amounts on different frames, and then p50 would be the median
    // of a mixture rather than the cost of a frame. Red proof: SUBSTEP_SECONDS at 1/100 stops
    // dividing the frame, the counts come back {2, 1} and this clause fails.
    //
    // Together with the amortised reading that is the whole argument, and it needs no second
    // opinion: `__HAIR_GPU_COST__` measures the dispatch arithmetic directly, 64 copies inside one
    // pass, and it reads 0.01807–0.01848 ms a frame on every run this session — a 2.3% spread
    // across sittings hours apart. A single frame reads 0.0249–0.0284 ms. So the solver's own
    // arithmetic is ~0.018 ms and the rest of a single-frame reading is one pass opening, which
    // research doc §0.3 puts at 30.8–54.1 µs. A frame that reads 0.38 ms cannot be arithmetic that
    // measures 0.018 ms to within 2%.
    //
    // 🚩 AND A CONTROL THAT WAS TRIED HERE AND REMOVED, RECORDED BECAUSE THE NEGATIVE RESULT IS THE
    // USEFUL PART. R20 first bounded the tail by a COMMON-MODE argument: split the run at the
    // compute decile and read the RENDER pool — a different pool (three's `constants.js:1672`),
    // drawing a scene the solver does not touch — on both halves. If the slow frames were slow
    // because the SOLVER did more work the ratio would read 1.0; if the machine stalled, well above
    // it. Six probe sittings measured 8.37x, 8.81x, 11.01x and 14.03x, and the 64x-substep defect
    // measured 1.96x, which looked like a clean separation between two real states.
    //
    // ⚠️ IT DID NOT REPRODUCE. Across the runs that followed, the same statistic on the same shipped
    // build read 9.24x, 1.14x and **0.57x** — the last one BELOW the null, with the render pool
    // faster on the slow-compute frames. The ratio is not a property of the build; it is a property
    // of whatever else the machine was doing in that half-second, which is the same weather X2's
    // block warns about one clause lower. Two suite runs went red on it before it was pulled. It is
    // printed in the detail above as a diagnostic and asserted by nothing, and the four-sitting
    // agreement that made it look solid is exactly the trap §1.25z names: a statistic sampled a few
    // times in one sitting is not a statistic with a known distribution. LEARNINGS §1.25ag.
    report(
        'Xb ...and p50 is the honest statistic because the WORK is identical on every frame',
        cost.substepCounts.length === 1,
        `the ${ cost.samples } frames ran ${ cost.substepCounts.join( ' and ' ) } substeps, and the ` +
            'claim holds only while that is ONE number — the same kernels over the same chain count ' +
            `on every frame. The amortised arithmetic reads ${ cost.batchPerFrameMs.toFixed( 5 ) } ` +
            `ms against a p50 of ${ cost.p50.toFixed( 5 ) } ms, so a single frame is that arithmetic ` +
            'plus one pass opening and nothing else the solver controls. ' +
            `(DIAGNOSTIC, asserted by nothing: on the slowest ${ cost.slowestCount } frames by COMPUTE ` +
            `— median ${ cost.slowestComputeMs.toFixed( 5 ) } ms against ` +
            `${ cost.restComputeMs.toFixed( 5 ) } ms on the other ${ cost.samples - cost.slowestCount } — ` +
            `the RENDER pool reads ${ cost.slowestRenderMs.toFixed( 5 ) } against ` +
            `${ cost.restRenderMs.toFixed( 5 ) } ms, ` +
            `${ ( cost.slowestRenderMs / cost.restRenderMs ).toFixed( 2 ) }x. See this clause's ` +
            'header for why that number is printed and not gated.)'
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

    console.log( '\n--- A: the ACCEPTANCE PAGE, which is the only page a judge captures ---------\n' );

    // 🚩 EVERY CHECK ABOVE IS TAKEN ON `hair.html`, AND THAT IS THE DEFECT THIS BLOCK EXISTS FOR.
    //
    // The solver passed all of them a round before anything on `alive.html` called it, and the
    // blind critic read the shipped build as *"nothing moves, and I can say that from the data
    // rather than by squinting… not one hair, strand, dynamic or sim bone in the list… its position
    // attribute's upload version stayed at 0 across every frame I stepped."* Round 13 shipped the
    // same shape with `render/HairOIT.js`. A gate on a page nobody judges is a gate on a page
    // nobody judges, so these five checks are taken on `alive.html` itself.
    //
    // ⚠️ AND THE CRITIC'S OWN INSTRUMENT STILL READS ZERO, WHICH IS WORTH SAYING BEFORE THE
    // NUMBERS RATHER THAN AFTER. `geometry.attributes.position.version` is the upload counter for
    // the CPU-side attribute, and this solver never touches it: it writes a GPU storage buffer and
    // the material reads it through `positionNode`, so the attribute is the BIND POSE for the life
    // of the page and its version stays 0 whatever the hair is doing. A2 below reads the buffer the
    // vertex stage actually samples — the honest form of the same question — and A5 reads the
    // rendered pixels, which is the form no bookkeeping can fake.

    const aliveMoving = await runAliveCapture( browser, server.baseUrl,
        `${ ALIVE_BASE }&hair=1&preroll=2`, { sampleEvery: 6, frames: 120 } );

    report(
        'A1 the solver is ON alive.html — the page a judge captures runs punch-list 6.6',
        aliveMoving.census?.motion != null &&
            aliveMoving.census.motion.particles ===
                aliveMoving.census.motion.chains * aliveMoving.census.motion.pointsPerChain &&
            aliveMoving.census.motion.computeCallsLastFrame === 1,
        aliveMoving.census?.motion == null
            ? 'census.hair.motion is null on ?hair=1 — the acceptance page is running a RIGID groom ' +
                'and every check above is about a page nobody judges'
            : `${ aliveMoving.census.motion.chains } chains x ${ aliveMoving.census.motion.pointsPerChain } ` +
                `rings = ${ aliveMoving.census.motion.particles } particles, ` +
                `${ aliveMoving.census.motion.computeCallsLastFrame } renderer.compute() call a frame, ` +
                `oit '${ aliveMoving.census.oit }'`
    );

    report(
        `A2 ...and the groom MOVES behind the shipped idle stack — mean tip lag over ` +
            `${ THRESHOLDS.aliveMeanTipMm } mm`,
        aliveMoving.peakMeanTipMm > THRESHOLDS.aliveMeanTipMm,
        aliveMoving.neverRan !== null
            ? `THE SOLVER WAS BUILT AND NEVER STEPPED — its storage buffer has no GPU allocation ` +
                `after ${ aliveMoving.clock.hairSteps } steps ("${ aliveMoving.neverRan }"). Nothing ` +
                'on the page is calling it per frame, which is the exact state the acceptance page ' +
                'was in before this round.'
            : `${ aliveMoving.peakMeanTipMm.toFixed( 4 ) } mm peak mean / ` +
            `${ aliveMoving.peakMaxTipMm.toFixed( 4 ) } mm peak worst tip over ` +
            `${ aliveMoving.census?.motion?.chains ?? 0 } chains, measured ` +
            'against where the head transform ALONE would have put each tip — so head idle, gaze and ' +
            'sway are subtracted out and what is left is the simulation. Nothing on this page drives ' +
            'the head on purpose: it is `MotionStack` doing what it does on every plate. ' +
            `⚠️ geometry.attributes.position.version reads ${ aliveMoving.positionVersion } throughout, ` +
            'and always will — see this block\'s header.'
    );

    // 🚩 A2'S LIVENESS CONTROL, and standing rule 5 is why it is here rather than assumed. A2 reads
    // a distance between two buffers, and a page whose head never moves must read ~zero on the SAME
    // instrument — otherwise A2 could be measuring readback noise, a mis-indexed rest buffer or a
    // solver that jitters in place, all of which would look like hair.
    const aliveStill = await runAliveCapture( browser, server.baseUrl,
        `${ ALIVE_BASE }&freeze&hair=1`, { sampleEvery: 12, frames: 24 } );

    report(
        `A3 ...and the same instrument reads under ${ THRESHOLDS.aliveStillTipMm } mm on a ?freeze plate, ` +
            'so A2 is measuring the head and not the meter',
        // ⚠️ THE MOVING HALF IS IN THIS PREDICATE ON PURPOSE. A control that reads zero because
        // NOTHING ran is not a control, and the red proof for this section (deleting the
        // `hairMotionUpdate` call from `trackFigure`) left an earlier version of this clause GREEN
        // at 0.000000 mm against 0.0000 mm — §1.25g, in the file that quotes §1.25g.
        aliveStill.peakMaxTipMm < THRESHOLDS.aliveStillTipMm && aliveStill.census?.motion != null &&
            aliveMoving.peakMaxTipMm > THRESHOLDS.aliveMeanTipMm,
        aliveStill.census?.motion == null
            ? 'the frozen plate has no solver on it, so this is not a control'
            : `${ aliveStill.peakMaxTipMm.toFixed( 6 ) } mm worst against ` +
                `${ aliveMoving.peakMaxTipMm.toFixed( 4 ) } mm moving, a factor of ` +
                `${ ( aliveMoving.peakMaxTipMm / Math.max( aliveStill.peakMaxTipMm, 1e-9 ) ).toFixed( 0 ) }. ` +
                'The solver ran on both — same substeps, same dispatch — and the head is the only ' +
                'difference between them.'
    );

    // 🎯 THE CAPTURE EPOCH, which is the leg `alive-capture-determinism.selftest.mjs` cannot see:
    // that gate reads RENDERER counters, and the solver's step count is neither a renderer counter
    // nor a pixel. Two loads, one of them with its GLB held back so it provably boots at a
    // different rAF epoch, and the assertion is on the STEP COUNT and the TIPS rather than on two
    // observers agreeing (§1.25g).
    const epochA = await runAliveCapture( browser, server.baseUrl, `${ ALIVE_BASE }&hair=1&preroll=2`,
        { frames: 60 } );
    const epochB = await runAliveCapture( browser, server.baseUrl, `${ ALIVE_BASE }&hair=1&preroll=2`,
        { frames: 60, bootDelayMs: ALIVE_BOOT_DELAY_MS } );

    report(
        'A4 the capture epoch reaches the solver: 60 steps at 1/60 leave it at exactly 120 substeps, ' +
            'on two loads that booted at different rAF epochs',
        epochA.clock.hairSteps === 120 && epochB.clock.hairSteps === 120 &&
            epochA.clock.bootFrameId !== epochB.clock.bootFrameId,
        `hairSteps ${ epochA.clock.hairSteps } and ${ epochB.clock.hairSteps } against an oracle of 120 ` +
            `(1/60 − 1/120 − 1/120 is exactly zero in binary), from boot epochs ` +
            `${ epochA.clock.bootFrameId } and ${ epochB.clock.bootFrameId }. ` +
            ( epochA.clock.bootFrameId === epochB.clock.bootFrameId
                ? '🚩 THE TWO EPOCHS ARE EQUAL, so this check is not testing what it says it is — the ' +
                    'GLB hold-back did not perturb the boot and the pair proves only that two warm ' +
                    'loads agree.'
                : 'The two loads booted at different epochs, so `reset()` at the takeover is what ' +
                    'makes the counts equal rather than luck.' )
    );

    report(
        'A5 ...and they reach the same pose, tip for tip',
        // Both halves, for the reason A3 carries: two runs that never simulated agree perfectly, and
        // "0.00000000 mm" over two empty buffers is the degenerate input §1.3 is about.
        worstTipTravelMm( epochA.tips, epochB.tips ) < THRESHOLDS.reproducibilityMm &&
            epochA.tips.length > 0 && epochA.peakMeanTipMm > THRESHOLDS.aliveMeanTipMm,
        `${ worstTipTravelMm( epochA.tips, epochB.tips ).toFixed( 8 ) } mm worst tip difference over ` +
            `${ epochA.tips.length / 3 } tips, on a run carrying ` +
            `${ epochA.peakMeanTipMm.toFixed( 3 ) } mm of mean tip lag — so the pair is reproducible ` +
            'AND was simulating, which is the pairing §1.3 asks for.'
    );

    // 🎯 WHAT THE A/B TOGGLE COSTS A STILL PLATE, IN PIXELS, AND IT IS NOT ZERO.
    //
    // Every objective gate in this repository captures `?freeze`, so if `?hairmotion=1` moved those
    // plates it would move every recorded number with them. `HairDynamics`'s clause E says the
    // solver is the identity to 0.000132 mm with the head still — but that is a claim about a
    // buffer, and the claim that matters is about a picture. Measured here, on the deterministic
    // forward path, and reported as a share rather than asserted to be zero: the rebuild reaches
    // the same vertex by a different arithmetic path than the skinning does, and a MASK cutout
    // turns a sub-micron disagreement into a coverage flip on the texels sitting on the threshold.
    const stillOn = await runAliveCapture( browser, server.baseUrl, `${ ALIVE_PIXEL_BASE }&hair=1`,
        { frames: 24, screenshot: true } );
    const stillOff = await runAliveCapture( browser, server.baseUrl,
        `${ ALIVE_PIXEL_BASE }&hair=1&hairmotion=0`, { frames: 24, screenshot: true } );

    const control = comparePlates( stillOn.pixels, stillOff.pixels );

    report(
        `A6 ?hairmotion is a CONTROL: on a still plate it moves under ` +
            `${ ( THRESHOLDS.aliveControlSampleShare * 100 ).toFixed( 2 ) }% of samples`,
        stillOff.census?.motion === null && control.share < THRESHOLDS.aliveControlSampleShare,
        stillOff.census?.motion !== null
            ? '?hairmotion=0 did NOT remove the solver, so there is no rigid control plate and no A ' +
                'side for anything measured with the hair on'
            : `${ control.differing } of ${ control.samples } samples ` +
                `(${ ( control.share * 100 ).toFixed( 4 ) }%) differ, worst ` +
                `${ ( control.worst * 255 ).toFixed( 0 ) }/255, on a groom whose particles sit ` +
                `${ stillOn.peakMaxTipMm.toFixed( 6 ) } mm from the rigid pose. NOT zero: the coverage ` +
                'test is a step function and the two paths reach the same vertex by different ' +
                'arithmetic. Two loads of the ON plate are byte-identical, so this is the toggle and ' +
                'not the weather.'
    );

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

        // 🎯 BOTH POOLS AND THE SUBSTEP COUNT, per frame, because the X clause needs to say whether
        // a slow frame was slow BECAUSE OF THE SOLVER. `render` is the control: a different pool,
        // drawing a scene this solver does not touch. `steps` is the work: if the substep count is
        // the same on every frame then the dispatch shape is too, and any spread is not arithmetic.
        const frames = await opened.page.evaluate( async () => {

            const values = [];
            let previousSteps = globalThis.__HAIR_STATE__().steps;

            for ( let frame = 0; frame < 120; frame ++ ) {

                await globalThis.__HAIR_STEP__( 1 / 60 );

                const steps = globalThis.__HAIR_STATE__().steps;
                const reading = await globalThis.__HAIR_GPU_MS__();

                if ( reading !== null ) {

                    values.push( { compute: reading.compute, render: reading.render,
                        substeps: steps - previousSteps } );

                }

                previousSteps = steps;

            }

            return values;

        } );

        const samples = frames.map( ( frame ) => frame.compute );

        const batch = await opened.page.evaluate( async () => {

            const runs = [];
            for ( let attempt = 0; attempt < 8; attempt ++ ) runs.push( await globalThis.__HAIR_GPU_COST__( 64 ) );

            return runs;

        } );

        const sorted = [ ...samples ].sort( ( a, b ) => a - b );
        const nonZero = sorted.filter( ( value ) => value > 0 );

        // The slowest tenth of frames BY COMPUTE, against the other nine tenths, with the RENDER
        // pool read on both halves. Split by decile rather than by "above N times the median" so
        // the split carries no threshold of its own — the two halves are disjoint and the ratio
        // between their render medians is the whole statistic.
        const byCompute = [ ...frames ].sort( ( first, second ) => second.compute - first.compute );
        const slowCount = Math.ceil( frames.length * 0.1 );
        const slowest = byCompute.slice( 0, slowCount );
        const rest = byCompute.slice( slowCount );

        const median = ( group, pool ) => {

            const values = group.map( ( frame ) => frame[ pool ] ).sort( ( a, b ) => a - b );
            return values[ Math.floor( values.length / 2 ) ] ?? 0;

        };

        const substepCounts = [ ...new Set( frames.map( ( frame ) => frame.substeps ) ) ];

        return {
            computeCallsPerFrame: state.computeCallsThisFrame,
            samples: sorted.length,
            p50: sorted[ Math.floor( sorted.length * 0.5 ) ] ?? 0,
            p95: sorted[ Math.floor( sorted.length * 0.95 ) ] ?? 0,
            max: sorted[ sorted.length - 1 ] ?? 0,
            quantumMs: nonZero.reduce( ( carry, value ) => greatestCommonDivisor( carry, value ), 0 ),
            batchRepeats: 64,
            batchPerFrameMs: Math.min( ...batch.map( ( run ) => run.perFrameMs ) ),
            substepCounts,
            slowestCount: slowCount,
            slowestComputeMs: median( slowest, 'compute' ),
            restComputeMs: median( rest, 'compute' ),
            slowestRenderMs: median( slowest, 'render' ),
            restRenderMs: median( rest, 'render' )
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

/**
 * One captured run of `alive.html`, with the solver measured off the buffer the vertex stage reads.
 *
 * `bootDelayMs` holds the GLB back, which is a cold cache rather than a synthetic perturbation and
 * is what makes the A4 pair a pair of loads that provably booted at different rAF epochs.
 */
async function runAliveCapture( browser, baseUrl, query,
    { frames = 60, sampleEvery = 0, bootDelayMs = 0, screenshot = false } = {} ) {

    const context = await browser.newContext( {
        viewport: { width: ALIVE_WIDTH, height: ALIVE_HEIGHT }, deviceScaleFactor: 1 } );
    const page = await context.newPage();
    page.setDefaultTimeout( 300_000 );

    const errors = [];
    page.on( 'pageerror', ( error ) => errors.push( error.message ) );
    page.on( 'console', ( message ) => {

        if ( message.type() !== 'error' ) return;
        if ( message.text().startsWith( 'Failed to load resource' ) ) return;
        errors.push( message.text() );

    } );

    if ( bootDelayMs > 0 ) {

        await page.route( '**/*.glb', async ( route ) => {

            await new Promise( ( resolve ) => setTimeout( resolve, bootDelayMs ) );
            await route.continue();

        } );

    }

    try {

        await page.goto( `${ baseUrl }/alive.html?${ query }`, { waitUntil: 'load' } );
        await page.waitForFunction( () => globalThis.sugata?.session?.figure != null, null,
            { timeout: 120_000 } );
        await page.waitForFunction( () => globalThis.sugata?.session?.hair != null, null,
            { timeout: 120_000 } );

        // The groom lands before its material has compiled, and a plate read early is a plate of a
        // page that has not finished. Same 1500 ms `alive-toggles.selftest.mjs` waits.
        await page.waitForTimeout( 1500 );

        let peakMeanTipMm = 0;
        let peakMaxTipMm = 0;
        let positionVersion = null;
        let stepped = 0;

        const advance = ( count ) => page.evaluate( async ( n ) => {

            for ( let frame = 0; frame < n; frame ++ ) await globalThis.__SUGATA_STEP__( 1 / 60 );

        }, count );

        let neverRan = null;

        const sample = async () => {

            const reading = await page.evaluate( ALIVE_MEASURE );
            if ( reading === null ) return;

            if ( reading.neverRan === true ) { neverRan = reading.reason; return; }

            peakMeanTipMm = Math.max( peakMeanTipMm, reading.meanTipMm );
            peakMaxTipMm = Math.max( peakMaxTipMm, reading.maxTipMm );
            positionVersion = reading.positionVersion;

        };

        const block = sampleEvery > 0 ? sampleEvery : frames;

        while ( stepped < frames ) {

            const count = Math.min( block, frames - stepped );
            await advance( count );
            stepped += count;
            if ( sampleEvery > 0 ) await sample();

        }

        const final = await page.evaluate( ALIVE_MEASURE );

        if ( final !== null && final.neverRan !== true ) {

            peakMeanTipMm = Math.max( peakMeanTipMm, final.meanTipMm );
            peakMaxTipMm = Math.max( peakMaxTipMm, final.maxTipMm );
            positionVersion = final.positionVersion;

        }

        if ( final?.neverRan === true ) neverRan = final.reason;

        return {
            clock: await page.evaluate( () => globalThis.sugata.captureClock() ),
            census: await page.evaluate( () => globalThis.sugata.subsystems().hair ),
            pixels: screenshot === true ? await page.screenshot( { timeout: 120_000 } ) : null,
            tips: final?.tips ?? [],
            nonFinite: final?.nonFinite ?? 0,
            neverRan,
            peakMeanTipMm,
            peakMaxTipMm,
            positionVersion,
            errors
        };

    } finally {

        await context.close();

    }

}

/** Two PNGs, sample for sample. `decodePng` returns normalised channels, so `worst` is a fraction. */
function comparePlates( a, b ) {

    const left = decodePng( a );
    const right = decodePng( b );

    if ( left.width !== right.width || left.height !== right.height ) {

        throw new Error( 'HairDynamics: the two alive plates are different sizes.' );

    }

    let differing = 0;
    let worst = 0;

    for ( let sample = 0; sample < left.pixels.length; sample ++ ) {

        const delta = Math.abs( left.pixels[ sample ] - right.pixels[ sample ] );
        if ( delta === 0 ) continue;

        differing ++;
        if ( delta > worst ) worst = delta;

    }

    return { samples: left.pixels.length, differing, share: differing / left.pixels.length, worst };

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
