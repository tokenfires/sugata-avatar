/**
 * Gate for the CAPTURE EPOCH on `packages/testbed/src/alive.html` — punch-list 3.20.
 *
 * ## What this file exists to stop
 *
 * `?capture` promises one thing: "simulation time stops depending on wall-clock time altogether,
 * so a seeded run reproduces frame for frame regardless of machine, load or thermal state." For
 * two rounds it delivered a weaker thing. `takeOverFrameLoop` pinned `nodeFrame.time` and
 * `nodeFrame.deltaTime` and left three counters free-running:
 *
 *   - `nodeFrame.frameId`, which the shipped film grain is seeded from;
 *   - the temporal resolve's `_jitterIndex`, which selects the Halton camera offset;
 *   - the temporal resolve's history render target.
 *
 * All three advance on every requestAnimationFrame tick, and rAF starts inside `stage.create()`
 * while `boot()` is still awaiting a GLB — so their value at the first captured step was a count
 * of how many frames the machine fitted into loading a figure. Measured 2026-08-08 before the
 * fix, one vite, one Chromium, `?bare&freeze&capture&seed=1` stepped 60x(1/60) at 900x1200 dpr 1:
 * `frameId` came back **2392 / 1216 / 1961** on three back-to-back loads, and the three plates
 * were three distinct images. `nodeFrame.time` was bit-exact at 1.0000000000000013 in all three —
 * the one counter anybody had thought to pin was the one that was already right, which is why
 * this survived a round in which several agents measured "the frozen plate".
 *
 * The shipped default carried both affected subsystems, so **the shipped default had no
 * reproducible still plate** and gate verdicts moved between identical runs.
 *
 * ## Four kinds of check, and why no three of them are enough
 *
 * 1. **R — REPRODUCIBILITY.** Two independent page loads of the same URL, stepped the same number
 *    of times, must produce the same pixels. This is the direct instrument and it is the only one
 *    that needs no bookkeeping: it does not care which counter was unpinned, or whether the
 *    mechanism is one this file's author thought of. It is a TOLERANCE rather than a digest
 *    comparison, for the reason `capture.mjs` gives about its own — see RESIDUE_SAMPLE_SHARE,
 *    which carries the measured residue and the margin against the smallest defect here.
 *
 * 2. **O — ORACLE ON THE COUNTERS.** After N steps `frameId` must read exactly N, `time` exactly
 *    N/fps, and the resolve's jitter phase exactly N mod 31 — values derived from the step count,
 *    not from a second observer. Check R alone is a cross-observer agreement test, and LEARNINGS
 *    §1.25g is the whole reason that is not sufficient: a counter pinned to a CONSTANT makes both
 *    observers agree exactly. `?clockdefect=frozen-frame` is that defect and R is green on it.
 *
 * 3. **L — LIVENESS, with its own control.** On a FROZEN scene with the grade on, the plate at N
 *    steps must DIFFER from the plate at N+1 steps: the only thing that can have changed is the
 *    grain, so this asserts the pinned counter still advances. §1.3 — a metric a frozen image
 *    passes trivially is measuring nothing, and "pin every counter to zero" passes R and O-on-time
 *    perfectly. The control beside it is the same pair of step counts under `?aa=msaa&grade=0`,
 *    which has neither grain nor a temporal resolve and must therefore be IDENTICAL. Without
 *    that control, L would also go green if `?freeze` stopped freezing and the figure moved
 *    between the two plates — which is exactly the bug that was live on this page last round
 *    (LEARNINGS §1.19a).
 *
 * 4. **H — THE HISTORY, read off the live node.** The resolve's history render target is the one
 *    leg of the reset that R cannot hold, and finding that out cost this file a revision: a
 *    temporal resolve on a static scene converges to the same fixed point from any starting
 *    history, so with `resolved._historyRenderTarget?.setSize( 1, 1 )` deleted from `TRAAPost.js`
 *    the plates come back byte-identical at 2 steps and at 24, and only 2-distinct-of-3 at 60.
 *    Every R check in the first version of this gate was green on that defect. H reads the render
 *    target's width off the running node at the instant the capture takes the loop over — 1 if the
 *    history was discarded, the beauty buffer's width if it was not. It is not a pixel and it is
 *    not a source regex; it is the state of the object the shader samples, observed by execution.
 *
 * ## What each check is worth, measured by deleting each leg of the fix at source
 *
 * Four sabotages, each one line removed, each run through the forward checks (`--quick`, 26):
 *
 *   | line deleted                             | what goes red                                |
 *   |------------------------------------------|----------------------------------------------|
 *   | `nodeFrame.frameId = startingFrameIdFor…`| R, R2, O, O2 on all four recipes — 14 checks |
 *   | `stage.temporal?.resetFrameEpoch?.()`    | R, R2, O, O2, H on the two resolve recipes   |
 *   | `resolved._jitterIndex = 0`              | R, R2, O, O2 on the two resolve recipes      |
 *   | `resolved._historyRenderTarget…setSize`  | **H only** — nothing else can see it         |
 *
 * The last row is the reason H exists. The first row's `aa=msaa&grade=0` column is the reason O
 * exists: that recipe has no grain and no resolve, so the counter is wrong and the PICTURE IS NOT,
 * and only the oracle says so.
 *
 * ## Proving the gate, and then trying to break it another way
 *
 * §1.25a: a gate that only catches its own known-bad is decorative. `CAPTURE_CLOCK_DEFECTS` in
 * `alive.js` names SIX ways the epoch can be wrong, of which one shipped and five exist only to be
 * shot at, and each is reachable from `?clockdefect=` so the proof is a page rather than a
 * committed plate. The class is stated out loud: *any renderer-side per-frame counter that
 * `?capture` does not put at a known value.*
 *
 * The table below is what each defect is expected to do to each check, and this file asserts the
 * whole table — including the greens, because a rejection proof that also turns the other checks
 * red proves only that the page is broken.
 *
 *   | ?clockdefect=     | R (default) | R (?aa=msaa) | O          | H       | L       |
 *   |-------------------|-------------|--------------|------------|---------|---------|
 *   | drifting-epoch    | **RED**     | **RED**      | **RED**    | **RED** | —       |
 *   | random-epoch      | **RED**     | **RED**      | **RED**    | green   | —       |
 *   | unpinned-resolve  | **RED**     | green        | **RED**    | **RED** | —       |
 *   | frozen-frame      | green       | —            | **RED**    | green   | **RED** |
 *   | offset-epoch      | green       | —            | **RED**    | green   | green   |
 *   | wall-clock-time   | green       | —            | **RED**    | green   | —       |
 *
 * `unpinned-resolve` is the row that matters most and it is not the defect the fix was designed
 * from. It is green under `?aa=msaa` and red under the default, so a fix that had stopped at
 * `frameId` — which is where the obvious reading of the evidence pointed — would have made the
 * A-side plate reproducible and left the SHIPPED DEFAULT exactly as broken. `frozen-frame` and
 * `offset-epoch` are the two that are invisible to R, which is the check anybody would write
 * first.
 *
 * ⚠️ **And the first version of this gate scored those R rejections GREEN on live defects.** Two
 * loads under `drifting-epoch` diverge only if they booted in different numbers of rAF frames, and
 * against the vite this file starts — watcher off, hmr off, second load fully warm — they boot in
 * the same number: three loads, boot epoch 15 every time, plates byte-identical. The gate was
 * measuring "two warm loads agreed", which is a thing the defect does. `BOOT_DELAY_MS` is the
 * repair and it is the reason every R check here is taken across an undelayed load and a load
 * whose GLB was held back — a cold cache, in other words — with check P asserting that the two
 * really did land at different epochs before check R is allowed to mean anything.
 *
 * ## Why it is a browser test
 *
 * The claim is about what a rendered plate CONTAINS across two page loads. A CPU mirror of the
 * counter arithmetic plus a regex over `alive.js` would test neither (§1.25b): the arithmetic here
 * is `frameId = 0`, and the thing that can be wrong is whether it reaches the shader. So this
 * drives a real Chromium against a real vite and compares decoded pixels.
 *
 * Usage:  node "packages/testbed/src/alive-capture-determinism.selftest.mjs"
 *         node "packages/testbed/src/alive-capture-determinism.selftest.mjs" --quick
 *           ^ forward checks only, no rejection proofs. For a fast loop, never for a verdict.
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

import { decodePng } from '../../../tools/critic/png.mjs';

const REPOSITORY_ROOT = path.resolve( fileURLToPath( new URL( '.', import.meta.url ) ), '../../..' );

/**
 * How many frames the camera jitter takes to come back round.
 *
 * Stated here as well as in `render/TRAAPost.js` rather than imported, and that is not
 * duplication for its own sake — `TRAAPost.js` imports `three/addons`, which does not resolve
 * under plain node, and a gate that cannot run is worse than a number written twice. The two are
 * held together by a check: the page reports its own `jitterPeriod` and it must equal this.
 *
 * ⚠️ **31, not 32.** Both nodes build `_haltonOffsets` with `Array.from( { length: 32 }, ... )`
 * (`TRAANode.js:751`, `TAAUNode.js:819`) and then advance with
 * `this._jitterIndex % ( _haltonOffsets.length - 1 )` (`:337`, `:370`), so the last table entry is
 * never used. Verified by execution: 60 captured steps from a reset epoch leave `_jitterIndex` at
 * 29, and 60 % 31 = 29.
 */
const HALTON_JITTER_PERIOD = 31;

// The same flags capture.mjs launches with. `headless_shell` has no GPU and therefore no WebGPU,
// so the channel matters as much as the flags.
const GPU_FLAGS = [ '--enable-unsafe-webgpu', '--ignore-gpu-blocklist', '--hide-scrollbars' ];

const QUICK = process.argv.includes( '--quick' );

/**
 * The plate every check is taken on.
 *
 * `?freeze` is chosen so the ONLY thing that can move between two plates of the same recipe is the
 * render — no motion layer, no seed-dependent draw. That makes a pixel difference attributable to
 * the frame state and nothing else, and it is what lets check L read "the grain advanced" out of a
 * plain inequality. `?freeze` genuinely freezes under `?capture` as of 2026-08-08; check C is what
 * keeps that true.
 *
 * 900x1200 at dpr 1 is the framing every lighting gate in the repo is stated at.
 */
const BASE_QUERY = 'bare&freeze&seed=1&capture';
const WIDTH = 900;
const HEIGHT = 1200;
const DEVICE_SCALE = 1;

/**
 * Steps per plate, and the fixed step they are taken at.
 *
 * 24 rather than 60 because the defect is worse at low step counts, not better: an unpinned
 * temporal history has had less time to converge, so a short capture is the harsher test AND the
 * cheaper one. Verified after the fix at 4, 24 and 60 steps, frozen and moving.
 */
const STEPS = 24;
const CAPTURE_FPS = 60;

/**
 * A second, SHORT step count, so R is not stated at one window only.
 *
 * §1.4: the observation window is a gate parameter. A temporal resolve converges, so the residue
 * of a wrong starting state is loudest in the first frames and quietest later — and a plate taken
 * at 1, 2 or 4 steps is a real recipe in this repository (LEARNINGS §1.19a's tables are stated at
 * exactly those counts, and `capture.mjs`'s reproducibility replay compares opening frames). Two
 * steps costs one extra pair per recipe.
 *
 * ⚠️ It does NOT close the history hole; see check H, which is what does.
 */
const SHORT_STEPS = 2;

/**
 * 🎯 How long the second load of every pair is made to wait for its GLB.
 *
 * This is the single thing that turns this gate from flaky into deterministic, and it is worth
 * reading before changing anything else here. The counters at issue advance on rAF, rAF starts
 * inside `stage.create()`, and `boot()` then awaits a figure — so the epoch a capture starts at is
 * a count of how many frames the machine fitted into that await. Two back-to-back loads against a
 * warm vite fit the SAME number, and the defect then produces two identical plates: measured on
 * the first full run of this file, three loads under `?clockdefect=drifting-epoch` all booted at
 * epoch 15 and were byte-identical, and the rejection proof went green on a live defect.
 *
 * Holding the GLB back is a cold cache or a loaded machine, not a synthetic perturbation, and 400
 * ms is ~48 rAF frames in Playwright's headless Chromium (rAF measured at 120 Hz there — see
 * tools/critic/capture.mjs). Every R check below is therefore taken across a pair that provably
 * booted at different epochs, and asserts the pair is byte-identical anyway.
 */
const BOOT_DELAY_MS = 400;

/**
 * The pair check L is taken on, and its control.
 *
 * `?aa=msaa` rather than the shipped default, deliberately. Under a temporal resolve the jitter
 * phase differs between step N and step N+1, so the two plates differ at every silhouette edge
 * whether the grain advanced or not — measured on the default recipe, 36.42% of samples move and
 * the worst is 158/255, which is an edge, not a 1.5/255 grain. That would leave L green on a
 * frozen grain, which is the one thing it exists to catch. On the forward path the grain is the
 * only per-frame term in the whole image.
 *
 * The control is the SAME recipe with `&grade=0`, so exactly one thing differs between them.
 */
const LIVENESS_QUERY = `${ BASE_QUERY }&aa=msaa`;
const CONTROL_QUERY = `${ BASE_QUERY }&aa=msaa&grade=0`;

/**
 * How much of the frame the grain must move between consecutive steps, as a share of samples.
 *
 * Film grain is added to every pixel the envelope does not zero, so "the seed advanced" and "a
 * large fraction of the frame changed" are the same statement — while a defect that reseeded a
 * corner, or that only shifted an edge, would satisfy a bare inequality.
 *
 * Measured 2026-08-08 at 900x1200 dpr 1, `?bare&freeze&seed=1&capture&aa=msaa`, 24 vs 25 steps:
 * **36.47% of samples move, worst 6/255** — grain-sized, as against the 158/255 the same pair
 * reads under the default's temporal jitter. The share is not near 100% for two structural
 * reasons and both are properties of the grain rather than of this measurement: a quarter of the
 * samples are ALPHA, which is opaque everywhere and can never differ, and the grade's envelope
 * takes the grain to zero at black, which is most of a dark portrait backdrop. 36.47% of all
 * samples is 48.6% of the colour ones.
 *
 * The floor is 0.20 — comfortably under the measurement and an order of magnitude above what an
 * edge-only difference could reach.
 */
const GRAIN_COVERAGE_FLOOR = 0.20;

/**
 * 🚩 R IS A TOLERANCE, NOT A BOOLEAN, and it has to be — the render carries a small residual
 * nondeterminism that predates this fix and has nothing to do with the frame epoch.
 *
 * `tools/critic/capture.mjs`'s header records the same thing and the same conclusion one level up:
 * it used to compare SHA-256 digests, called a clean plate "NOT byte-reproducible" on 8 of 10 runs
 * of the same seed, and was changed to compare decoded pixels against a stated tolerance. §1.14 is
 * the general form — "are these the same bytes" was never the same KIND of question as "is this
 * render deterministic".
 *
 * Measured here, 2026-08-08, after the epoch fix, `?bare&freeze&seed=1&capture` at 900x1200 dpr 1,
 * 24 steps, undelayed load against a 400 ms-delayed one:
 *
 *   - default (taau + grade): 8 of 8 pairs bit-identical, 1 distinct plate over 16 loads
 *   - `?aa=traa`:             8 of 8 pairs bit-identical, 1 distinct plate over 16 loads
 *   - `?aa=traa&cards=0`:     8 of 8 pairs bit-identical
 *   - and across roughly thirty `?aa=traa` pairs taken while this file was being written, TWO
 *     came back with dust: **4 of 4,320,000 samples at worst 1/255**, and **54 samples at worst
 *     8/255**. Unattributed — `?cards=0` was clean in eight pairs, but so was `?cards=1` in the
 *     same session, so that control attributes nothing and is recorded as inconclusive.
 *
 * The thresholds sit between that and the smallest defect signal any rejection in this file
 * produces, which is `unpinned-resolve` on the default at **9.11–12.57% of samples, worst
 * 101–111/255**. So the margin is about 7,000x on the share and 12x on the worst code value, and
 * the run output always prints the measured pair whether it passes or fails.
 *
 * ⚠️ A defect too small for these thresholds is not thereby safe — it is out of R's reach, and
 * that is exactly the case check H exists for.
 */
const RESIDUE_SAMPLE_SHARE = 0.0001;
const RESIDUE_WORST_CODES = 12;

/**
 * The recipes. Between them they cover both AA families and both sides of the grade, which are the
 * two subsystems that read a per-frame counter.
 *
 * `aa=msaa&grade=0` is here as the negative control: it is the one recipe that has NEITHER a grain
 * seed nor a temporal resolve, it was the only reproducible configuration before this fix, and if
 * it ever goes red the fault is in the harness rather than in the epoch.
 */
const RECIPES = [
    { name: 'default (taau + grade)', query: '', resolve: true },
    { name: 'aa=msaa (forward + grade)', query: 'aa=msaa', resolve: false },
    { name: 'aa=traa', query: 'aa=traa', resolve: true },
    { name: 'aa=msaa&grade=0 (no grain, no resolve)', query: 'aa=msaa&grade=0', resolve: false }
];

/**
 * The rejection proofs. `expect` is the FULL expected verdict of every check the defect is run
 * through, greens included — a defect that turns everything red proves nothing about which check
 * is doing the work.
 *
 * `reproducible` is `null` where the row is not run through check R.
 */
const REJECTIONS = [
    {
        defect: 'drifting-epoch',
        why: 'the shipped defect: no counter is reset',
        on: [ { query: '', reproducible: false }, { query: 'aa=msaa', reproducible: false } ],
        oracle: 'fails'
    },
    {
        defect: 'random-epoch',
        why: 'the shipped defect with the machine taken out of it, so a two-run pixel check has a ' +
            'rejection proof that does not depend on how fast a GLB loaded',
        on: [ { query: '', reproducible: false }, { query: 'aa=msaa', reproducible: false } ],
        oracle: 'fails'
    },
    {
        defect: 'unpinned-resolve',
        why: 'a DIFFERENT mechanism in the same class — the node clock is pinned and the resolve is not',
        on: [ { query: '', reproducible: false }, { query: 'aa=msaa', reproducible: true } ],
        oracle: 'fails-on-default-only'
    },
    {
        defect: 'frozen-frame',
        why: 'reproducible AND wrong — the shape check R is structurally blind to',
        on: [ { query: '', reproducible: true } ],
        oracle: 'fails',
        liveness: false
    },
    {
        defect: 'offset-epoch',
        why: 'reproducible, animating, and still not the plate any other capture of this recipe takes',
        on: [ { query: '', reproducible: true } ],
        oracle: 'fails',
        liveness: true
    },
    {
        defect: 'wall-clock-time',
        why: 'the frame index is right and the node clock is wall time — only the oracle sees it',
        on: [],
        oracle: 'fails'
    }
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
 * resolution order as tools/critic/capture.mjs and alive-toggles.selftest.mjs.
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
        server: { port: 5196, strictPort: false, hmr: false, watch: { ignored: [ '**' ] } },
        logLevel: 'silent'
    } );

    await server.listen();
    server.baseUrl = server.resolvedUrls.local[ 0 ].replace( /\/$/, '' );

    return server;

}

/**
 * One plate: a FRESH browser context, a page load, `steps` calls to the capture hook, and the
 * pixels plus the frame counters that produced them.
 *
 * The context is fresh per plate and that is load-bearing rather than tidy. The defect being
 * gated is state that survives from before the first captured step, so two plates taken from the
 * SAME page would share it and every check here would go green on a broken page.
 */
async function takePlate( browser, baseUrl, query, steps, bootDelayMs = 0, forceFrameId = null ) {

    const context = await browser.newContext( {
        viewport: { width: WIDTH, height: HEIGHT },
        deviceScaleFactor: DEVICE_SCALE,
        colorScheme: 'dark',
        reducedMotion: 'no-preference'
    } );

    const page = await context.newPage();
    const pageErrors = [];

    page.on( 'pageerror', ( error ) => pageErrors.push( error.message ) );

    // 🎯 Holding the figure back is what makes this gate deterministic, and it is the real-world
    // mechanism rather than a synthetic one. The counters this file exists to pin advance on every
    // requestAnimationFrame tick, and rAF starts inside `stage.create()` while `boot()` is still
    // awaiting the GLB — so the epoch at the first captured step is a count of how many frames the
    // machine fitted into loading a figure. On a warm vite with the watcher off, two back-to-back
    // loads fit the SAME number, and the defect then hides: measured on the first full run of this
    // gate, three loads under `?clockdefect=drifting-epoch` all booted at epoch 15 and produced
    // byte-identical plates. Delaying the GLB by a few hundred milliseconds is a cold cache, a
    // loaded disk or a slower machine, and it moves the epoch by tens of frames every time.
    if ( bootDelayMs > 0 ) {

        await page.route( '**/*.glb', async ( route ) => {

            await new Promise( ( resolve ) => setTimeout( resolve, bootDelayMs ) );
            await route.continue();

        } );

    }

    try {

        await page.goto( `${ baseUrl }/alive.html?${ query }`, { waitUntil: 'domcontentloaded' } );
        await page.waitForFunction( () => typeof globalThis.__SUGATA_STEP__ === 'function', null,
            { timeout: 120_000, polling: 200 } );

        // Used only by check X, and only against `?clockdefect=drifting-epoch`, to construct the
        // same-epoch case the boot will not reliably hand over. See the check for why.
        if ( forceFrameId !== null ) {

            await page.evaluate( ( value ) => {

                globalThis.sugata.stage.renderer._nodes.nodeFrame.frameId = value;

            }, forceFrameId );

        }

        // Read BEFORE the first step, which is the only moment the history reset is observable:
        // `updateBefore` restores the render target's size on the very next render. See check H.
        const readyClock = await page.evaluate( () => globalThis.sugata.captureClock() );

        for ( let step = 0; step < steps; step ++ ) {

            const stepped = await page.evaluate( ( delta ) => globalThis.__SUGATA_STEP__( delta ), 1 / CAPTURE_FPS );

            // The hook refuses while a bake is still loading. Retry rather than count the step.
            if ( stepped === false ) {

                step --;
                await page.waitForTimeout( 50 );

            }

        }

        return {
            pixels: await page.screenshot( { timeout: 60_000 } ),
            clock: await page.evaluate( () => globalThis.sugata.captureClock() ),
            readyClock,
            errors: pageErrors
        };

    } finally {

        await context.close();

    }

}

/** Differing 8-bit samples between two PNGs, and the worst one, so a FAIL says how far off it is. */
function comparePlates( first, second ) {

    const a = decodePng( first );
    const b = decodePng( second );

    if ( a.width !== b.width || a.height !== b.height ) {

        return { differing: Infinity, total: 0, worstCodes: 255, note: 'different dimensions' };

    }

    let differing = 0;
    let worst = 0;

    for ( let index = 0; index < a.pixels.length; index ++ ) {

        const delta = Math.abs( a.pixels[ index ] - b.pixels[ index ] );

        if ( delta > 0 ) {

            differing ++;
            if ( delta > worst ) worst = delta;

        }

    }

    return {
        differing,
        total: a.pixels.length,
        worstCodes: worst * 255,
        share: differing / a.pixels.length
    };

}

/**
 * Whether two plates count as the same render. See RESIDUE_SAMPLE_SHARE for why this is a
 * tolerance and what the margin against a real defect is.
 */
function withinResidue( difference ) {

    return difference.share <= RESIDUE_SAMPLE_SHARE && difference.worstCodes <= RESIDUE_WORST_CODES;

}

function describe( difference ) {

    return `${ difference.differing } of ${ difference.total } samples differ ` +
        `(${ ( difference.share * 100 ).toFixed( 4 ) }%), worst ${ difference.worstCodes.toFixed( 1 ) }/255`;

}

/**
 * The N vs N+1 pair, for check L. Takes the second plate and differences it against one already
 * in hand, so the pair costs one page load rather than two.
 */
async function measureAdvance( browser, baseUrl, query, plateAtSteps ) {

    const oneMore = await takePlate( browser, baseUrl, query, STEPS + 1 );

    return comparePlates( plateAtSteps.pixels, oneMore.pixels );

}

/** The counter values a capture of `steps` frames MUST land on, derived rather than observed. */
function expectedClock( steps, hasResolve ) {

    return {
        frameId: steps,
        time: steps / CAPTURE_FPS,
        jitterIndex: hasResolve ? steps % HALTON_JITTER_PERIOD : null
    };

}

function checkOracle( label, clock, steps, hasResolve ) {

    const want = expectedClock( steps, hasResolve );
    const wrong = [];

    if ( clock.frameId !== want.frameId ) wrong.push( `frameId ${ clock.frameId } want ${ want.frameId }` );

    // The step is 1/60 and the sum of 24 of them is not exactly 0.4 in binary floating point, so
    // the clock is compared at a tolerance a whole frame could not hide in.
    if ( Math.abs( clock.time - want.time ) > 1e-9 ) wrong.push( `time ${ clock.time } want ~${ want.time }` );

    if ( clock.jitterIndex !== want.jitterIndex ) {

        wrong.push( `jitterIndex ${ clock.jitterIndex } want ${ want.jitterIndex }` );

    }

    // The period is the one number this file and `TRAAPost.js` both state. If they drift, every
    // jitter expectation above is computed against the wrong modulus and would still look
    // self-consistent, so the disagreement is worth a check of its own.
    if ( hasResolve === true && clock.jitterPeriod !== HALTON_JITTER_PERIOD ) {

        wrong.push( `jitterPeriod ${ clock.jitterPeriod } — the page and this gate disagree, ` +
            `and the modulus above is computed from ${ HALTON_JITTER_PERIOD }` );

    }

    return {
        ok: wrong.length === 0,
        detail: wrong.length === 0
            ? `frameId ${ clock.frameId }, time ${ clock.time.toFixed( 9 ) }, jitter ${ clock.jitterIndex } ` +
                `of ${ HALTON_JITTER_PERIOD } — all derived from ${ steps } steps at 1/${ CAPTURE_FPS }`
            : wrong.join( '; ' ),
        label
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

console.log( `\nalive.html capture epoch — ${ server.baseUrl }/alive.html?${ BASE_QUERY }` );
console.log( `${ STEPS } steps at 1/${ CAPTURE_FPS }, ${ WIDTH }x${ HEIGHT } dpr ${ DEVICE_SCALE }, ` +
    `fresh browser context per plate\n` );

const startedAtMs = Date.now();

try {

    console.log( '--- R: two independent page loads, same URL, same step count ----------------\n' );

    const plates = new Map();

    for ( const recipe of RECIPES ) {

        const query = recipe.query === '' ? BASE_QUERY : `${ BASE_QUERY }&${ recipe.query }`;

        const first = await takePlate( browser, server.baseUrl, query, STEPS );
        const second = await takePlate( browser, server.baseUrl, query, STEPS, BOOT_DELAY_MS );

        plates.set( recipe.name, first );

        const errors = [ ...first.errors, ...second.errors ];

        if ( errors.length > 0 ) {

            report( `${ recipe.name } loads without page errors`, false, errors.join( ' | ' ) );

        }

        // Without this the R check below is only "two warm loads agreed", which is what the defect
        // itself passes. See BOOT_DELAY_MS.
        report(
            `P  ${ recipe.name } — the two loads really did boot at different epochs`,
            first.clock.bootFrameId !== second.clock.bootFrameId,
            `boot epoch ${ first.clock.bootFrameId } undelayed vs ${ second.clock.bootFrameId } ` +
                `with the GLB held back ${ BOOT_DELAY_MS } ms`
        );

        const difference = comparePlates( first.pixels, second.pixels );

        report(
            `R  ${ recipe.name } — the two plates are byte-identical anyway`,
            withinResidue( difference ),
            describe( difference )
        );

        const oracle = checkOracle( recipe.name, first.clock, STEPS, recipe.resolve );

        report( `O  ${ recipe.name } — the counters read what ${ STEPS } steps say they must`,
            oracle.ok, oracle.detail );

        // 🚩 The one leg of the reset a pixel check cannot reliably hold. A temporal resolve on a
        // static scene converges to the same fixed point from any starting history, so deleting
        // the history reset leaves R green at 2 and at 24 steps and only intermittently red at 60
        // — measured, 2 distinct plates of 3. The observation that IS deterministic is the render
        // target's own state one instant after the reset, read off the live node rather than off
        // a mirror or a regex: `resetFrameEpoch()` shrinks it to 1x1 and the next `updateBefore`
        // refills it from that frame's beauty.
        if ( recipe.resolve === true ) {

            report(
                `H  ${ recipe.name } — the resolve's history was discarded before the first step`,
                first.readyClock.historyWidth === 1,
                `history render target ${ first.readyClock.historyWidth }px wide at the moment the ` +
                    'capture took the loop over; 1 means it will be refilled from this capture\'s ' +
                    'own first frame rather than from the boot\'s'
            );

        }

        // ...and again where a temporal resolve has not had time to converge, which is the only
        // window in which a wrong starting history is visible. See SHORT_STEPS.
        const shortFirst = await takePlate( browser, server.baseUrl, query, SHORT_STEPS );
        const shortSecond = await takePlate( browser, server.baseUrl, query, SHORT_STEPS, BOOT_DELAY_MS );
        const shortDifference = comparePlates( shortFirst.pixels, shortSecond.pixels );

        report(
            `R${ SHORT_STEPS } ${ recipe.name } — identical at ${ SHORT_STEPS } steps too, before the resolve converges`,
            withinResidue( shortDifference ),
            `${ describe( shortDifference ) } — boot epochs ${ shortFirst.clock.bootFrameId } vs ` +
                `${ shortSecond.clock.bootFrameId }`
        );

        report(
            `O${ SHORT_STEPS } ${ recipe.name } — the counters read what ${ SHORT_STEPS } steps say they must`,
            checkOracle( recipe.name, shortFirst.clock, SHORT_STEPS, recipe.resolve ).ok,
            checkOracle( recipe.name, shortFirst.clock, SHORT_STEPS, recipe.resolve ).detail
        );

    }

    // A page that rendered nothing would pass every R check above. Two recipes that differ in
    // their anti-aliasing cannot resolve the same edges the same way, so a byte-identical pair
    // means one of them is not running — the same non-degeneracy argument alive-toggles makes.
    const defaultPlate = plates.get( RECIPES[ 0 ].name );
    const msaaPlate = plates.get( RECIPES[ 1 ].name );
    const acrossRecipes = comparePlates( defaultPlate.pixels, msaaPlate.pixels );

    report(
        'B  the plates are not all the same image, so R is comparing something',
        acrossRecipes.differing > 0,
        `default vs aa=msaa: ${ describe( acrossRecipes ) }`
    );

    console.log( '\n--- L: the pinned counter still ADVANCES, and its control -------------------\n' );

    const livenessAdvance = await measureAdvance( browser, server.baseUrl, LIVENESS_QUERY, plates.get( RECIPES[ 1 ].name ) );

    report(
        `L  aa=msaa — the plate at ${ STEPS + 1 } steps differs from the plate at ${ STEPS }`,
        livenessAdvance.differing > 0,
        `${ describe( livenessAdvance ) } — forward path, frozen figure, grade on: the grain is the ` +
            'only thing in the frame that can have moved'
    );

    // ...and grain is EVERYWHERE, so a difference confined to a few edges is not the grain
    // reseeding. Without this, L would go green on a defect that reseeded one pixel.
    report(
        `L2 aa=msaa — that difference covers the frame rather than an edge`,
        livenessAdvance.share > GRAIN_COVERAGE_FLOOR,
        `${ ( livenessAdvance.share * 100 ).toFixed( 2 ) }% of samples moved, floor ` +
            `${ ( GRAIN_COVERAGE_FLOOR * 100 ).toFixed( 0 ) }% — see GRAIN_COVERAGE_FLOOR`
    );

    // ...and the control, without which L would also go green if `?freeze` stopped freezing. It is
    // the SAME recipe with the grade removed, so the grade is the single variable between them.
    const controlAdvance = await measureAdvance( browser, server.baseUrl, CONTROL_QUERY, plates.get( RECIPES[ 3 ].name ) );

    report(
        `C  aa=msaa&grade=0 — ${ STEPS } and ${ STEPS + 1 } steps are IDENTICAL, so L is reading the grain`,
        controlAdvance.differing === 0,
        `${ describe( controlAdvance ) } — same recipe minus the grade. An extra step of a frozen ` +
            'figure must change nothing here; a difference means ?freeze stopped freezing and L ' +
            'is measuring motion rather than grain.'
    );

    if ( QUICK === true ) {

        console.log( '\n--quick: rejection proofs SKIPPED. This run is not a verdict on the gate.\n' );

    } else {

        console.log( '\n--- rejection proofs: six named ways the epoch can be wrong -----------------\n' );

        for ( const rejection of REJECTIONS ) {

            console.log( `?clockdefect=${ rejection.defect } — ${ rejection.why }` );

            for ( const target of rejection.on ) {

                const query = [ BASE_QUERY, target.query, `clockdefect=${ rejection.defect }` ]
                    .filter( ( part ) => part !== '' ).join( '&' );

                const a = await takePlate( browser, server.baseUrl, query, STEPS );
                const b = await takePlate( browser, server.baseUrl, query, STEPS, BOOT_DELAY_MS );
                const difference = comparePlates( a.pixels, b.pixels );
                const reproducible = withinResidue( difference );

                report(
                    `  R  ${ rejection.defect }${ target.query === '' ? '' : ' + ' + target.query } is ` +
                        `${ target.reproducible ? 'still reproducible' : 'NOT reproducible' }`,
                    reproducible === target.reproducible,
                    `${ describe( difference ) } — expected ${ target.reproducible ? 'identical' : 'a difference' }`
                );

            }

            // The oracle is read on the default recipe, which is the one that has every counter.
            const oracleQuery = `${ BASE_QUERY }&clockdefect=${ rejection.defect }`;
            const oraclePlate = await takePlate( browser, server.baseUrl, oracleQuery, STEPS );
            const oracle = checkOracle( rejection.defect, oraclePlate.clock, STEPS, true );

            report(
                `  O  ${ rejection.defect } is caught by the counter oracle`,
                oracle.ok === false,
                oracle.ok
                    ? `THE ORACLE IS GREEN ON THIS DEFECT: ${ oracle.detail }`
                    : oracle.detail
            );

            // The two defects that leave the resolve's history alone are the two check H exists
            // for, and the other four must leave it green or H is firing on the wrong thing.
            const leavesHistory = rejection.defect === 'drifting-epoch' || rejection.defect === 'unpinned-resolve';

            report(
                `  H  ${ rejection.defect } ${ leavesHistory ? 'is caught by' : 'leaves' } the history check`,
                ( oraclePlate.readyClock.historyWidth === 1 ) === ( leavesHistory === false ),
                `history render target ${ oraclePlate.readyClock.historyWidth }px at takeover — ` +
                    `expected ${ leavesHistory ? 'the boot\'s buffer, i.e. not 1' : '1' }`
            );

            if ( rejection.liveness !== undefined ) {

                // On the forward path, for the reason LIVENESS_QUERY gives: under a temporal
                // resolve the jitter phase alone moves a third of the frame between consecutive
                // steps, and this check would pass on a dead grain.
                const liveQuery = `${ LIVENESS_QUERY }&clockdefect=${ rejection.defect }`;
                const at = await takePlate( browser, server.baseUrl, liveQuery, STEPS );
                const andOneMore = await takePlate( browser, server.baseUrl, liveQuery, STEPS + 1 );
                const advance = comparePlates( at.pixels, andOneMore.pixels );
                const alive = advance.differing > 0 && advance.share > GRAIN_COVERAGE_FLOOR;

                report(
                    `  L  ${ rejection.defect } ${ rejection.liveness ? 'leaves the grain advancing' : 'freezes the grain' }`,
                    alive === rejection.liveness,
                    `aa=msaa, ${ STEPS } vs ${ STEPS + 1 } steps: ${ describe( advance ) } — ` +
                        `expected ${ rejection.liveness ? 'the frame to reseed' : 'nothing to move' }`
                );

            }

            console.log( '' );

        }

        console.log( '--- X: the boot epoch is the CAUSE, not a correlate ------------------------\n' );

        // 🚩 The R rejection two blocks up proves that two loads of `drifting-epoch` differ. It
        // does NOT prove they differ BECAUSE of the boot epoch — a page that rendered something
        // different on every load for any other reason would satisfy it just as well, and this
        // repository has already shipped one gate whose green came from the wrong mechanism.
        //
        // The other half of the biconditional is the one that names the cause: hold the epoch
        // EQUAL across two loads that booted differently, and the plates must come back identical.
        // The boot will not supply that case on demand — three loads measured 16 / 17 / 55, and
        // the two undelayed ones disagreed by one frame — so it is constructed, by writing the
        // same `frameId` into both pages after they load. That is the only place in this file the
        // harness reaches into the page, and it is doing it to the DEFECT rather than to the fix.
        //
        // `?aa=msaa` because on the forward path `frameId` is the whole of the frame state: under
        // the default the resolve's jitter and history would still differ and the check could not
        // isolate anything.
        const forcedEpoch = 777;
        const driftQuery = `${ LIVENESS_QUERY }&clockdefect=drifting-epoch`;

        const forcedA = await takePlate( browser, server.baseUrl, driftQuery, STEPS, 0, forcedEpoch );
        const forcedB = await takePlate( browser, server.baseUrl, driftQuery, STEPS, BOOT_DELAY_MS, forcedEpoch );
        const forced = comparePlates( forcedA.pixels, forcedB.pixels );

        report(
            'X  drifting-epoch + aa=msaa — two loads that booted differently but were FORCED to the ' +
                'same frame index render the same plate',
            withinResidue( forced ) && forcedA.clock.bootFrameId !== forcedB.clock.bootFrameId,
            `boot epochs ${ forcedA.clock.bootFrameId } vs ${ forcedB.clock.bootFrameId }, both then ` +
                `pinned to ${ forcedEpoch }: ${ describe( forced ) }. Together with the R rejection ` +
                'above — same recipe, epochs left alone, plates differ — this says the epoch is why.'
        );

        console.log( '' );

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
