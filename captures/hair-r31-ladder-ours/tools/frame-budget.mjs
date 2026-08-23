#!/usr/bin/env node
//
// frame-budget.mjs — what the SHIPPED build costs today, with and without its card groom.
//
// The strand ladder next door answers "what would the new primitive cost". This answers the two
// questions it has to be judged against, and both of them are currently quoted in the record from
// measurements that no longer reproduce:
//
//   1. WHAT DO TODAY'S CARDS COST? The decision rule's clause is "parity with today's cards". Its
//      number has been 2.03 ms and then 1.46-1.71 ms; the rule is applied at whatever this
//      measures, because a rule that says parity cannot be applied at a stale parity.
//   2. HOW MUCH HEADROOM IS THERE ACTUALLY? The 2.6 ms in the record is headroom on the NO-HAIR
//      plate. The number that matters is the shipped frame WITH hair against 16.6 ms.
//
// Both arms are `alive.html` — the shipped page, the shipped groom, the shipped OIT default — and
// they are round-robined inside one browser process with the SAME fixed contention gate the strand
// ladder uses (`strand-spike.html` at 4,960 strands / 720x900), so a row here and a row there can
// be read against one yardstick.
//
// 🔴 THE SAMPLER IS BURST-THEN-RESOLVE FOR THE REASON `strand-time.mjs` documents at length: a
// harness that awaits a `mapAsync` between frames leaves the GPU idle half the time, it sits at
// its base clock, and the rare boost lands on one arm and not another. Frames are submitted back
// to back and the timestamps resolved once at the end of the burst.
//
//   node captures/hair-r31-ladder-ours/tools/frame-budget.mjs --out captures/hair-r31-ladder-ours
//

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';

const REPOSITORY_ROOT = fileURLToPath(new URL('../../..', import.meta.url));
const GPU_FLAGS = ['--enable-unsafe-webgpu', '--ignore-gpu-blocklist', '--hide-scrollbars'];

/** The frame budget the whole decision is against: 60 Hz with a little in hand. */
const BUDGET_MS = 16.6;

/** `alive.js`'s own timing header states this framing for the arms already in the record. */
const VIEWPORT = { width: 1080, height: 1920 };

// 🔴 `hairmotion=0` IS EXPLICIT, AND ITS ABSENCE MADE THE ARMS UNEQUAL. `?hairmotion` DEFAULTS ON,
// so the CARD arm ran `HairDynamics` while every ribbon arm had it refused — `alive.js` will not let
// the solver and the ribbon expansion both write `material.positionNode`. The comment beside the
// ribbon arms claimed "MOTION IS OFF ON EVERY ARM" and it was false: motion was off on the ribbons
// and ON for the cards, so the card arm was carrying a compute pass the others were not.
//
// ⚠️ The solver is ~0.018 ms and CANNOT account for the deltas seen — this is a correctness fix, not
// the explanation. Recorded because a false claim in a comment beside a measurement is the defect
// this project has caught ten times, and writing one while hunting a different bug is how eleven
// happens.
const BASE_QUERY = 'bare&freeze&seed=1&frame=body&capture&gputime=1&hairmotion=0';

/**
 * The ribbon arms, named by the file `tools/figure-pipeline/build-tfx.sh` writes.
 *
 * `crop01` at 8,832 is the count the primitive decision's parity figure was measured at; the two
 * `bob01` densities are the fork the round could not settle — one document reads 4,960 as adequate
 * bob silhouette and another reads it as thin at the crown, and NEITHER NOTICES THE DISAGREEMENT.
 * Both are timed here so the cost side of that fork is at least closed.
 */
const RIBBON_ARMS = [
  { key: 'ribbons-crop-8832', file: 'crop01_g050_d23.tfx' },
  { key: 'ribbons-bob-4960', file: 'bob01_g050_d10.tfx' },
  { key: 'ribbons-bob-11408', file: 'bob01_g050_d23.tfx' },
];

async function main() {
  const options = parseArguments(process.argv.slice(2));

  const playwright = await loadPlaywright();
  const server = await startViteServer(options.gateTfx);
  const browser = await launchBrowser(playwright);

  const arms = [
    { key: 'gate', kind: 'gate', page: null,
      url: `${server.baseUrl}/tools/spikes/strand-spike.html?strands=4960&w=720&h=900&aa=off&gputime=1&frames=1`,
      step: 'strand' },
    { key: 'no-hair', kind: 'frame', url: `${server.baseUrl}/packages/testbed/alive.html?${BASE_QUERY}`, step: 'alive' },
    { key: 'hair', kind: 'frame', url: `${server.baseUrl}/packages/testbed/alive.html?${BASE_QUERY}&hair=1`, step: 'alive' },
    // The control repeated at the far end of the arm order. `alive.js`'s own header measured the
    // no-hair arm twice for this reason and reported the pair; a single control cannot show drift.

    // 🎯 R31's P0. The SAME page, the SAME deferred stack, the SAME material — one query parameter
    // apart from the card arm. That is the whole point: every strand figure on the record before
    // this was raster-and-shade on a bare page with no G-buffer, no resolve, no OIT composite and
    // no skinning, compared against a card cost that is a whole-frame delta. These arms close that.
    //
    // ⚠️ Motion is held off on EVERY arm by `BASE_QUERY`'s explicit `hairmotion=0` — see the note
    // there for why that had to become explicit rather than assumed.
    ...RIBBON_ARMS.map((arm) => ({
      key: arm.key,
      kind: 'frame',
      url: `${server.baseUrl}/packages/testbed/alive.html?${BASE_QUERY}&hair=1`
        + `&hairribbons=/tfx/${arm.file}`,
      step: 'alive',
    })),

    { key: 'no-hair-2', kind: 'frame', url: `${server.baseUrl}/packages/testbed/alive.html?${BASE_QUERY}`, step: 'alive' },
  ];

  // ⚠️ `arms.slice()`, NOT `arms`. With no filter the two were the SAME ARRAY, so the
  // `arms.length = 0` below emptied the very list being spread back in and the run executed ZERO
  // arms — completing all fifteen rounds in seconds and then throwing on a missing gate row. A
  // silent no-op that looks like a fast success is the worst shape a harness bug can take, and this
  // one was caught only because the report needed a row that was not there.
  const selected = options.only === null
    ? arms.slice()
    : arms.filter((a) => options.only.includes(a.key));

  if (selected.length !== arms.length) {
    console.log(`arms      ${selected.length} of ${arms.length}: ${selected.map((a) => a.key).join(', ')}`);
  }

  if (selected.length === 0) {
    throw new Error(`--only matched no arms. Known: ${arms.map((a) => a.key).join(', ')}`);
  }

  arms.length = 0;
  arms.push(...selected);

  const context = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: 1 });

  try {
    for (const arm of arms) {
      arm.page = await context.newPage();
      arm.page.setDefaultTimeout(600_000);
      arm.page.on('pageerror', (error) => console.error(`PAGEERROR ${arm.key}`, error.message));

      await arm.page.goto(arm.url, { waitUntil: 'load' });

      if (arm.step === 'alive') {
        await arm.page.waitForFunction(
          () => typeof globalThis.__SUGATA_STEP__ === 'function', null,
          { timeout: 600_000, polling: 250 }
        );
      } else {
        await arm.page.waitForFunction(
          () => window.__STRAND_READY__ === true || window.__STRAND_ERROR__ !== undefined,
          null, { timeout: 600_000 }
        );
      }

      arm.info = await arm.page.evaluate((step) => {
        if (step === 'strand') return { strandGate: true };
        const renderer = globalThis.sugata?.stage?.renderer;
        const canvas = renderer?.domElement;
        return {
          trackTimestamp: renderer?.trackTimestamp,
          width: canvas?.width,
          height: canvas?.height,
          pixelRatio: renderer?.getPixelRatio?.(),
        };
      }, arm.step);

      console.log(`arm       ${arm.key.padEnd(10)} ${JSON.stringify(arm.info)}`);
      arm.samples = [];
    }

    for (let pass = 0; pass < options.warmup; pass += 1) {
      for (const arm of arms) await takeSample(arm, options.batch, 1);
    }
    for (const arm of arms) arm.samples = [];

    // 🔴 THE ARM ORDER IS SHUFFLED EVERY ROUND, AND A FIXED ORDER WAS BIASING THE RESULT.
    //
    // The round-robin exists so that drift is common-mode. It was not: with a FIXED order inside
    // each round, an arm inherits whatever GPU state the arm before it left, and that position
    // effect is systematic rather than random. Measured on the first P0 run, where `no-hair` and
    // `no-hair-2` are the SAME URL and differ only in cycle position — first against last:
    //
    //     min                 1.406  against  1.646   (+0.24)
    //     fast-mode median   10.778  against 12.548   (+1.77)
    //
    // Every ribbon arm sat AFTER the card arm, so part of their apparent extra cost was position.
    // A per-round shuffle turns that from a bias into noise the rounds average out, and the two
    // no-hair arms become a real control on whether it worked: they should now converge.
    //
    // ⚠️ Deterministic by default so a run is reproducible. `--seed` changes it; the seed is
    // recorded in the report, because a shuffle nobody can reproduce is a shuffle nobody can check.
    let seed = options.seed;
    const nextRandom = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 0x100000000;
    };

    for (let round = 0; round < options.rounds; round += 1) {

      const order = arms.slice();
      for (let i = order.length - 1; i > 0; i -= 1) {
        const j = Math.floor(nextRandom() * (i + 1));
        [ order[i], order[j] ] = [ order[j], order[i] ];
      }

      for (const arm of order) await takeSample(arm, options.batch, options.perVisit);
      if ((round + 1) % 5 === 0) console.log(`          round ${round + 1}/${options.rounds}`);
    }

    const rows = arms.map((arm) => ({
      key: arm.key,
      kind: arm.kind,
      url: arm.url,
      info: arm.info,
      samples: arm.samples.length,
      minMs: Math.min(...arm.samples),
      p05Ms: quantile(arm.samples, 0.05),
      p50Ms: quantile(arm.samples, 0.5),
      p95Ms: quantile(arm.samples, 0.95),
      maxMs: Math.max(...arm.samples),
      samplesMs: arm.samples,
    }));

    print(rows);

    const file = path.join(options.outDirectory, 'data', 'frame-budget.json');
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, `${JSON.stringify({
      tool: 'captures/hair-r31-ladder-ours/tools/frame-budget.mjs',
      generatedAt: new Date().toISOString(),
      headSha: options.headSha,
      budgetMs: BUDGET_MS,
      viewport: VIEWPORT,
      rounds: options.rounds,
      burstFramesPerSample: options.batch,
      samplesPerVisit: options.perVisit,
      armOrderSeed: options.seed,
      rows,
    }, null, 2)}\n`);
    console.log(`\nreport    ${path.relative(REPOSITORY_ROOT, file)}`);
  } finally {
    await browser.close();
    await server.close();
  }
}

async function takeSample(arm, burst, perVisit) {
  const values = await arm.page.evaluate(async ({ burst, perVisit, step }) => {
    const out = [];

    for (let visit = 0; visit < perVisit; visit += 1) {
      if (step === 'alive') {
        // 🔴 ONE RESOLVE PER FRAME ON THIS PAGE, AND THE FIRST VERSION OF THIS FILE GOT IT WRONG
        // IN A WAY WORTH RECORDING. Burst-then-resolve — which is correct on `strand-spike.html` —
        // reported 315 ms for the no-hair arm. It was not a slow frame: 315.686 / 24 = 13.15 ms,
        // exactly the magnitude `alive.js`'s own header records. `resolveQueriesAsync` groups
        // passes by the frame id in each context's uid and returns the LAST frame's total, and on
        // this page a burst's twenty-four steps landed in ONE such group, so the "frame" it
        // returned was twenty-four of them summed. The strand page does not do this (its burst and
        // its per-frame designs agree to 3%), which is why the divergence had to be found here
        // rather than assumed away.
        //
        // Resolving every frame is safe here for the reason it was NOT safe there: these frames
        // are ~13 ms, so the resolve's own round trip is a few percent of the period rather than
        // half of it, and the GPU never falls off its clock between them.
        const renderer = globalThis.sugata.stage.renderer;
        for (let frame = 0; frame < burst; frame += 1) {
          await globalThis.__SUGATA_STEP__(0);
          await renderer.resolveTimestampsAsync('render');
          out.push(renderer.info.render.timestamp);
        }
      } else {
        for (let frame = 0; frame < burst; frame += 1) await window.__STRAND_RENDER__();
        out.push(await window.__STRAND_GPU_MS__());
      }
    }

    return out;
  }, { burst, perVisit, step: arm.step });

  for (const value of values) {
    if (typeof value === 'number' && Number.isFinite(value) && value > 0) arm.samples.push(value);
  }
}

function print(rows) {
  const control = rows.find((row) => row.key === 'no-hair');
  const controlEnd = rows.find((row) => row.key === 'no-hair-2');
  const hair = rows.find((row) => row.key === 'hair');
  const gate = rows.find((row) => row.kind === 'gate');

  console.log(`\n${'='.repeat(88)}`);
  console.log(
    `CONTENTION GATE (the strand ladder's own fixed 4,960-strand render at 720x900, ` +
    `in this round-robin): min ${gate.minMs.toFixed(4)}  p50 ${gate.p50Ms.toFixed(4)}  ` +
    `p95 ${gate.p95Ms.toFixed(4)} ms`
  );
  console.log('arm            n     min      p05      p50      p95      max');
  console.log('-'.repeat(88));
  for (const row of rows) {
    console.log(
      `${row.key.padEnd(12)} ${String(row.samples).padStart(4)} ` +
      `${row.minMs.toFixed(3).padStart(8)} ${row.p05Ms.toFixed(3).padStart(8)} ` +
      `${row.p50Ms.toFixed(3).padStart(8)} ${row.p95Ms.toFixed(3).padStart(8)} ` +
      `${row.maxMs.toFixed(3).padStart(8)}`
    );
  }

  console.log(
    `\nCONTROL REPRODUCIBILITY (no-hair measured at both ends of the arm order): ` +
    `p05 ${control.p05Ms.toFixed(3)} vs ${controlEnd.p05Ms.toFixed(3)}, ` +
    `p50 ${control.p50Ms.toFixed(3)} vs ${controlEnd.p50Ms.toFixed(3)}, ` +
    `p95 ${control.p95Ms.toFixed(3)} vs ${controlEnd.p95Ms.toFixed(3)}`
  );
  console.log(
    `\nTODAY'S CARDS COST   Δp05 ${(hair.p05Ms - control.p05Ms).toFixed(3)}  ` +
    `Δp50 ${(hair.p50Ms - control.p50Ms).toFixed(3)}  ` +
    `Δp95 ${(hair.p95Ms - control.p95Ms).toFixed(3)} ms`
  );
  console.log(
    `HEADROOM AGAINST ${BUDGET_MS} ms   with hair: ` +
    `p50 ${(BUDGET_MS - hair.p50Ms).toFixed(3)}  p95 ${(BUDGET_MS - hair.p95Ms).toFixed(3)} ms   ` +
    `| no hair: p50 ${(BUDGET_MS - control.p50Ms).toFixed(3)}  ` +
    `p95 ${(BUDGET_MS - control.p95Ms).toFixed(3)} ms`
  );
}

function quantile(values, q) {
  const sorted = [...values].sort((a, b) => a - b);
  const index = (sorted.length - 1) * q;
  const low = Math.floor(index);
  const high = Math.ceil(index);
  if (low === high) return sorted[low];
  return sorted[low] + (sorted[high] - sorted[low]) * (index - low);
}

async function startViteServer(gateTfx) {
  const { createServer } = await import('vite');

  const mountTfx = {
    name: 'sugata-frame-budget-tfx',
    configureServer(server) {
      // Serves the gate's own file AND any export the ribbon arms name, resolved against the
      // directory `--tfx` points at. Files rather than a copy, for `strand-spike.mjs`'s reason:
      // the plate is then of the file on disk and not of a stale duplicate.
      server.middlewares.use('/tfx', (request, response, next) => {
        const name = (request.url ?? '').replace(/^\//, '').split('?')[0];
        const file = /^strands-4960\.tfx$/.test(name)
          ? gateTfx
          : path.join(path.dirname(gateTfx), name);
        if (name === '' || fs.existsSync(file) === false) return next();
        response.setHeader('Content-Type', 'application/octet-stream');
        response.setHeader('Content-Length', String(fs.statSync(file).size));
        fs.createReadStream(file).pipe(response);
      });
    },
  };

  // 🚩 `vite.spikes.config.js`, NOT `vite.config.js`, AND R31's PAGE MOVE IS WHY. The main config
  // roots vite at `packages/testbed`, which served `/src/strand-spike.html` — and the spike page
  // moved to `tools/spikes/` when `pages.selftest.mjs` correctly went red over a prototype sitting
  // in the SHIPPING page set. Under the main root that URL no longer resolves and the contention
  // gate would 404 silently. The spikes config roots at the repo, so both pages are reachable by
  // their real paths and the gate keeps working.
  const server = await createServer({
    configFile: path.join(REPOSITORY_ROOT, 'vite.spikes.config.js'),
    plugins: [mountTfx],
    server: { port: 5195, strictPort: false, hmr: false, watch: { ignored: ['**'] } },
    logLevel: 'warn',
  });

  await server.listen();
  server.baseUrl = server.resolvedUrls.local[0].replace(/\/$/, '');
  console.log(`vite      ${server.baseUrl}`);
  return server;
}

async function launchBrowser(playwright) {
  const browser = await playwright.chromium.launch({
    channel: 'chromium', headless: true, args: GPU_FLAGS,
  });
  console.log('chromium  headless (channel=chromium)');
  return browser;
}

async function loadPlaywright() {
  const candidates = ['playwright'];
  const cache = path.join(process.env.HOME ?? '', '.npm', '_npx');
  if (fs.existsSync(cache)) {
    candidates.push(
      ...fs.readdirSync(cache)
        .map((entry) => path.join(cache, entry, 'node_modules', 'playwright'))
        .filter((candidate) => fs.existsSync(candidate))
    );
  }

  const require = createRequire(import.meta.url);
  for (const candidate of candidates) {
    try {
      const namespace = await import(pathToFileURL(require.resolve(candidate)).href);
      if (namespace?.chromium) return namespace;
      if (namespace?.default?.chromium) return namespace.default;
    } catch { /* next */ }
  }
  throw new Error('playwright not resolvable');
}

function parseArguments(argv) {
  const options = {
    outDirectory: path.join(REPOSITORY_ROOT, 'captures', 'hair-r31-ladder-ours'),
    gateTfx: null,
    rounds: 15,
    batch: 24,
    perVisit: 4,
    warmup: 2,
    headSha: null,
    only: null,
    seed: 20260822,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const flag = argv[index];
    const value = argv[index + 1];
    switch (flag) {
      case '--out': options.outDirectory = path.resolve(value); index += 1; break;
      case '--gate-tfx': options.gateTfx = path.resolve(value); index += 1; break;
      case '--rounds': options.rounds = Number(value); index += 1; break;
      case '--batch': options.batch = Number(value); index += 1; break;
      case '--pervisit': options.perVisit = Number(value); index += 1; break;
      case '--warmup': options.warmup = Number(value); index += 1; break;
      case '--sha': options.headSha = value; index += 1; break;

      // 🎯 THE RESIDENT-SET KNOB, AND IT EXISTS TO TEST A HYPOTHESIS RATHER THAN TO TUNE ONE.
      // Every arm's page is opened up front and held live for the whole round-robin, so a seven-arm
      // run keeps seven 1080x1920 WebGPU contexts resident. The strand ladder used the identical
      // protocol and held its contention gate to ~1%; this held it to 67%, and the difference
      // between them is page weight. `--only` runs a named subset so the gate's spread can be read
      // against the number of live pages and the cause CONFIRMED before anything is rebuilt.
      case '--only': options.only = value.split(',').map((k) => k.trim()); index += 1; break;
      case '--seed': options.seed = Number(value); index += 1; break;
      default: throw new Error(`unknown argument '${flag}'`);
    }
  }

  if (options.gateTfx === null) throw new Error('--gate-tfx is required (the 4,960-strand export)');

  return options;
}

await main();
