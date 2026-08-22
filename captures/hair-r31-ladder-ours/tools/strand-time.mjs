#!/usr/bin/env node
//
// strand-time.mjs — THE TIMING PHASE for `packages/testbed/src/strand-spike.js`.
//
// `tools/critic/strand-spike.mjs` builds the plates and refuses to take a timing, for a reason its
// own header states: this machine measured an IDENTICAL fixed workload at 0.01785 ms and
// 0.11228 ms in one session, a 6.3x swing, purely from other agents running. This file is the
// separate serialised phase that header hands off to. It exists so the discipline is in the tool
// rather than in a promise:
//
//   * EVERY ARM LIVES IN ONE BROWSER PROCESS AT ONCE. One tab per arm, all created up front, all
//     kept alive. Nothing is navigated between arms, so no arm carries a different process's
//     scheduling, page-load or shader-compile state than its comparand.
//   * THE ARMS ARE ROUND-ROBINED. A round visits every arm once, in a fixed order, and the run is
//     many rounds. A drift that lasts one round therefore lands on every arm, not on whichever arm
//     happened to be measured while it lasted.
//   * MINIMA, NOT MEANS. The minimum over all samples of an arm is the closest thing this machine
//     offers to its uncontended cost; a mean is a mean of the contention.
//   * A CONTENTION GATE IS MEASURED IN THE SAME ROUND-ROBIN AND PRINTED BESIDE EVERY ROW. The gate
//     is a FIXED GPU workload — identical in every round and identical across both resolutions —
//     so its own spread over the run is a direct reading of what the machine was doing to the
//     numbers while they were taken.
//   * AN EMPTY ARM IS TIMED. `?strandlimit=0` sets the draw range to zero, so the frame is the
//     clear plus three's full-screen output triangle and nothing else. Every strand row is
//     reported both raw and minus this arm, because the blit is inside the RENDER pool the
//     timestamp resolves and is NOT part of raster-and-shade.
//
// ## What the number is
//
// `renderer.info.render.timestamp`, resolved from `TimestampQuery.RENDER`. Read
// `WebGPUTimestampQueryPool.resolveQueriesAsync`: it sums the durations of every render pass
// belonging to the LAST FRAME whose queries are unresolved, in milliseconds. The page's
// `__STRAND_RENDER__` resets `info`, renders exactly one frame and awaits
// `device.queue.onSubmittedWorkDone()` before returning, so the value is one frame's GPU render
// time and not a submission latency.
//
// 🔴 `?gputime=1` IS WHAT MAKES THIS A MEASUREMENT AT ALL. It sets `trackTimestamp` at renderer
// construction, and the backend gates the query set on the adapter carrying the `timestamp-query`
// feature. If it is absent, `__STRAND_GPU_MS__()` returns null and this tool ABORTS rather than
// falling back to `performance.now()` — wall clock on a GPU page measures the JavaScript that
// asked for the frame, not the frame.
//
// ## Running it
//
//   node captures/hair-r31-ladder-ours/tools/strand-time.mjs \
//       --tfx /path/to/exports --out captures/hair-r31-ladder-ours
//

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';

const REPOSITORY_ROOT = fileURLToPath(new URL('../../..', import.meta.url));

const GPU_FLAGS = ['--enable-unsafe-webgpu', '--ignore-gpu-blocklist', '--hide-scrollbars'];
const PAGE_PATH = '/src/strand-spike.html';
const TFX_HEADER_BYTES = 160;
const READY_TIMEOUT_MS = 240_000;

/** The densities the round turns on. 24,800 is carried as an extra because its row is cheap. */
const STRAND_COUNTS = [496, 992, 2480, 4960, 11408, 24800];

const RESOLUTIONS = [
  { name: '720x900', w: 720, h: 900 },
  { name: '1920x1080', w: 1920, h: 1080 },
];

/**
 * The contention gate: a FIXED GPU workload, identical in every round of every session.
 *
 * It is deliberately a strand render rather than an unrelated compute kernel, because the quantity
 * under test is a graphics-queue cost and a gate on the compute queue can be quiet while the
 * graphics queue is not. It is pinned at 4,960 strands / 720x900 in BOTH resolution sessions so a
 * 1920x1080 row and a 720x900 row can be read against the same yardstick.
 */
const GATE = { strands: 4960, w: 720, h: 900 };

/** Any value the page's own whitelist accepts; the file actually loaded comes from `?tfxurl=`. */
const WHITELISTED_STRANDS = 11408;

async function main() {
  const options = parseArguments(process.argv.slice(2));

  const exports_ = indexTfxDirectory(options.tfxDirectory);
  console.log(`tfx       ${options.tfxDirectory}`);
  for (const [count, file] of [...exports_].sort((a, b) => a[0] - b[0])) {
    console.log(`          ${String(count).padStart(6)} strands  ${path.basename(file.path)}`);
  }

  // The bob ladder's own six densities when they are what is mounted; otherwise whatever IS
  // mounted, in order. The crop groom exports at different counts for the same density multiplier
  // (its scalp is the same, its strands are 6.4x shorter), and a filter written around the bob's
  // numbers would silently drop every one of them.
  const mounted = [...exports_.keys()].sort((a, b) => a - b);
  const known = STRAND_COUNTS.filter((count) => exports_.has(count));
  const densities = known.length === mounted.length ? known : mounted;
  if (densities.length === 0) throw new Error('no usable .tfx exports found');

  fs.mkdirSync(path.join(options.outDirectory, 'data'), { recursive: true });
  fs.mkdirSync(path.join(options.outDirectory, 'plates'), { recursive: true });

  const playwright = await loadPlaywright(options.playwrightPath);
  const server = await startViteServer(exports_);
  const browser = await launchBrowser(playwright, options);

  const report = {
    tool: 'captures/hair-r31-ladder-ours/tools/strand-time.mjs',
    generatedAt: new Date().toISOString(),
    headSha: options.headSha,
    rounds: options.rounds,
    burstFramesPerSample: options.batch,
    samplesPerVisit: options.perVisit,
    warmupFrames: options.warmup,
    gate: GATE,
    sessions: [],
  };

  try {
    for (const resolution of RESOLUTIONS) {
      const session = await runSession({
        browser, server, resolution, densities, options,
      });
      report.sessions.push(session);
      printSession(session);
    }

    const file = path.join(options.outDirectory, 'data', 'strand-time.json');
    fs.writeFileSync(file, `${JSON.stringify(report, null, 2)}\n`);
    console.log(`\nreport    ${path.relative(REPOSITORY_ROOT, file)}`);
  } finally {
    await browser.close();
    await server.close();
  }
}

/**
 * One resolution's arms, all alive at once, round-robined.
 *
 * The arm order is fixed and the gate sits FIRST and LAST in every round. Two gate readings per
 * round bracket the strand arms in time, so a drift that arrives mid-round shows up as a
 * disagreement between the bracketing pair rather than hiding inside a row.
 */
async function runSession({ browser, server, resolution, densities, options }) {
  const arms = [
    { key: 'gate-open', kind: 'gate', strands: GATE.strands, w: GATE.w, h: GATE.h, strandlimit: null },
    { key: 'empty', kind: 'empty', strands: densities[0], w: resolution.w, h: resolution.h, strandlimit: 0 },
    ...densities.map((strands) => ({
      key: `s${strands}`, kind: 'strands', strands, w: resolution.w, h: resolution.h,
      strandlimit: null, shadows: false,
    })),

    // 🎯 THE SHADOW ARM IS NOT AN EXTRA, IT IS WHAT MAKES THE COMPARISON HONEST. The number this
    // ladder is judged against is the delta a CARD groom adds to the shipped frame, and that delta
    // includes drawing the groom a second time into the shadow map. A ribbon ladder measured with
    // `?shadows=0` is not a cheaper primitive, it is a smaller question — so both are carried and
    // both are printed, and the row that gets quoted against the cards is the one with shadows on.
    ...(options.shadowDensities ?? []).filter((strands) => densities.includes(strands))
      .map((strands) => ({
        key: `s${strands}+shadow`, kind: 'strands-shadow', strands,
        w: resolution.w, h: resolution.h, strandlimit: null, shadows: true,
      })),
    { key: 'gate-close', kind: 'gate', strands: GATE.strands, w: GATE.w, h: GATE.h, strandlimit: null },
  ];

  console.log(`\n=== session ${resolution.name} — ${arms.length} arms, one tab each ===`);

  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });

  for (const arm of arms) {
    // 🚩 `?strands=` IS A WHITELIST ON THE PAGE, NOT A COUNT, so it is pinned and the file is
    // chosen by `?tfxurl=`. `strand-spike.js` validates `?strands=` against the six BOB densities
    // it was built with and throws on anything else; the crop groom exports at 3,840 and 8,832 for
    // the same density multipliers, because its scalp is the same and its strands are 6.4x
    // shorter. Overriding the URL keeps the page unedited and still lets it read the real strand
    // count out of the header, which `describe().file` then reports and this tool records.
    const query = [
      `strands=${WHITELISTED_STRANDS}`,
      `tfxurl=/tfx/strands-${arm.strands}.tfx`,
      `w=${arm.w}`, `h=${arm.h}`,
      'aa=off', 'gputime=1', 'frames=1',
      arm.shadows === true ? 'shadows=1' : null,
      arm.strandlimit === null ? null : `strandlimit=${arm.strandlimit}`,
    ].filter(Boolean).join('&');

    arm.url = `${server.baseUrl}${PAGE_PATH}?${query}`;
    arm.page = await context.newPage();

    await arm.page.goto(arm.url, { waitUntil: 'load' });
    await arm.page.waitForFunction(
      () => window.__STRAND_READY__ === true || window.__STRAND_ERROR__ !== undefined,
      null, { timeout: READY_TIMEOUT_MS }
    );

    const error = await arm.page.evaluate(() => window.__STRAND_ERROR__ ?? null);
    if (error !== null) throw new Error(`arm ${arm.key} failed at ${arm.url}\n${error}`);

    arm.describe = await arm.page.evaluate(() => window.__STRAND_DESCRIBE__());

    // 🔴 THE ABORT THAT KEEPS THIS FROM BECOMING A NON-MEASUREMENT. A null here means the adapter
    // has no `timestamp-query` feature and the page fell back to no instrumentation at all. There
    // is no wall-clock consolation prize on a GPU page.
    const probe = await arm.page.evaluate(async () => {
      await window.__STRAND_RENDER__();
      const value = await window.__STRAND_GPU_MS__();
      return { type: typeof value, value };
    });

    if (probe.type !== 'number' || Number.isFinite(probe.value) === false) {
      throw new Error(
        `arm ${arm.key}: __STRAND_GPU_MS__() returned ${probe.type} ${probe.value}. ` +
        'The adapter has no timestamp-query feature; wall clock is not a substitute.'
      );
    }

    console.log(
      `arm       ${arm.key.padEnd(11)} ${arm.w}x${arm.h}  ` +
      `tri ${arm.describe.render.triangles.toLocaleString().padStart(9)}  ` +
      `draws ${arm.describe.render.drawCalls}`
    );

    arm.samples = [];
  }

  // Warmup, round-robined too: shader compilation and pipeline creation are one-time costs that
  // would otherwise land entirely on whichever arm is visited first.
  for (let pass = 0; pass < options.warmup; pass += 1) {
    for (const arm of arms) await takeSample(arm, options.batch, options.perVisit);
  }
  for (const arm of arms) arm.samples = [];

  const gateRounds = [];

  for (let round = 0; round < options.rounds; round += 1) {
    const roundGate = [];

    for (const arm of arms) {
      const best = await takeSample(arm, options.batch, options.perVisit);
      if (arm.kind === 'gate') roundGate.push(best);
    }

    gateRounds.push(Math.min(...roundGate));

    if ((round + 1) % 5 === 0) {
      process.stdout.write(`          round ${round + 1}/${options.rounds}  gate ${gateRounds[round].toFixed(4)} ms\n`);
    }
  }

  const plates = [];
  for (const arm of arms) {
    if (arm.kind !== 'strands' && arm.kind !== 'strands-shadow') continue;
    const file = path.join(options.outDirectory, 'plates', `${resolution.name}-${arm.key}.png`);
    fs.writeFileSync(file, await arm.page.locator('#stage').screenshot());
    plates.push(path.relative(REPOSITORY_ROOT, file));
  }

  const rows = arms.map((arm) => ({
    key: arm.key,
    kind: arm.kind,
    strands: arm.kind === 'empty' ? 0 : arm.strands,
    url: arm.url,
    widthPixels: arm.w,
    heightPixels: arm.h,
    fileStrandCount: arm.describe.file?.strandCount ?? null,
    submittedTriangles: arm.describe.render.triangles,
    drawCalls: arm.describe.render.drawCalls,
    samples: arm.samples.length,
    minMs: Math.min(...arm.samples),
    p05Ms: quantile(arm.samples, 0.05),
    medianMs: quantile(arm.samples, 0.5),
    p95Ms: quantile(arm.samples, 0.95),
    maxMs: Math.max(...arm.samples),

    // 🔴 THE RAW SAMPLES ARE KEPT, and that is not bulk. The first run of this tool reported a
    // 151% gate spread whose shape turned out not to be noise but two GPU clock states — most
    // visits at ~1.53 ms and a minority at ~0.82 ms on an IDENTICAL workload. A summary row
    // cannot be re-read for that; the array can.
    samplesMs: arm.samples,
  }));

  await context.close();

  const gateMin = Math.min(...gateRounds);

  return {
    resolution: resolution.name,
    widthPixels: resolution.w,
    heightPixels: resolution.h,
    gateRoundMinima: gateRounds,
    gate: {
      min: gateMin,
      median: quantile(gateRounds, 0.5),
      max: Math.max(...gateRounds),
      spreadPercentOfMin: (Math.max(...gateRounds) - gateMin) / gateMin * 100,
    },
    rows,
  };
}

/**
 * A BURST of renders with ONE resolve at the end, and both halves of that are the instrument.
 *
 * 🔴 TWO EARLIER DESIGNS OF THIS FUNCTION PRODUCED A NUMBER I HAD TO THROW AWAY, and the reason is
 * worth more than the number was.
 *
 * v1 put the loop in Node — one `page.evaluate` per frame. The gate came back 151% wide with
 * nothing else on the machine, and the shape was not noise but BIMODAL: an identical 4,960-strand
 * workload landed at ~1.53 ms most visits and ~0.82 ms on a minority, a clean 1.87x with nothing
 * between. v2 moved the loop into the page and the mode survived at 1.4 / 0.89.
 *
 * 🎯 The distributions say what it is. Sorting each arm's samples, the fast readings are ISOLATED:
 * `s24800` at 1920x1080 gave min 3.4284 and second-smallest 5.2666; `s11408` at 720x900 gave
 * 1.4404 and 2.1442. One sample in eight hundred, 35% below everything else, with an empty gap.
 * That is a GPU that occasionally clocks up — the ratios cluster near 1.5x across every arm — and
 * it does NOT visit every arm. `s11408` at 1920x1080 caught none of it at all (min 3.4128 against
 * second 3.5088). **So a minimum-of-samples is not comparable ACROSS arms here: some rows would be
 * quoting the boosted clock and some the base clock, and the ladder's slope would be an artefact
 * of which arm got lucky.** That is the opposite of what a minimum is for.
 *
 * The cause is duty cycle. `__STRAND_RENDER__` awaits `onSubmittedWorkDone`, and the old inner
 * loop then awaited `resolveTimestampsAsync` — a `mapAsync` round trip — before submitting again.
 * The GPU spent as much time idle as busy and sat at its base clock, with the boost as a rare
 * accident. Their own ladder batches 40 submissions per timing window and reports a 12-19% gate;
 * a harness that idles between frames is measuring its own latency's effect on the clock.
 *
 * So a visit now submits `burst` frames back to back with NOTHING between them but the render
 * itself, and resolves ONCE afterwards. `resolveQueriesAsync` returns the total duration of the
 * LAST frame whose queries are outstanding, so the value is one frame measured after `burst - 1`
 * frames of continuous work — the GPU busy, the clock wherever sustained load puts it, which is
 * also the state a real frame loop would keep it in. 2048 queries at 4 per frame is the pool's
 * ceiling; a burst of 24 uses 96.
 */
async function takeSample(arm, burst, perVisit) {
  const values = await arm.page.evaluate(async ({ burst, perVisit }) => {
    const out = [];

    for (let visit = 0; visit < perVisit; visit += 1) {
      for (let frame = 0; frame < burst; frame += 1) await window.__STRAND_RENDER__();
      out.push(await window.__STRAND_GPU_MS__());
    }

    return out;
  }, { burst, perVisit });

  for (const value of values) arm.samples.push(value);

  return Math.min(...values);
}

function printSession(session) {
  const empty = session.rows.find((row) => row.kind === 'empty');

  console.log(`\n${'='.repeat(96)}`);
  console.log(
    `${session.resolution}   rounds ${session.gateRoundMinima.length}  ` +
    `CONTENTION GATE (fixed 4960-strand render at 720x900, in the same round-robin): ` +
    `min ${session.gate.min.toFixed(4)}  med ${session.gate.median.toFixed(4)}  ` +
    `max ${session.gate.max.toFixed(4)} ms   spread ${session.gate.spreadPercentOfMin.toFixed(2)}% of min`
  );
  console.log(
    'arm            strands   triangles    min ms    p05 ms    med ms    p95 ms   minus-empty   gate'
  );
  console.log('-'.repeat(96));

  for (const row of session.rows) {
    const minusEmpty = row.kind === 'empty' ? 0 : row.minMs - empty.minMs;
    console.log(
      `${row.key.padEnd(12)} ${String(row.strands).padStart(7)} ` +
      `${row.submittedTriangles.toLocaleString().padStart(11)} ` +
      `${row.minMs.toFixed(4).padStart(9)} ${row.p05Ms.toFixed(4).padStart(9)} ` +
      `${row.medianMs.toFixed(4).padStart(9)} ${row.p95Ms.toFixed(4).padStart(9)} ` +
      `${minusEmpty.toFixed(4).padStart(13)} ${session.gate.min.toFixed(3).padStart(6)}`
    );
  }
}

function quantile(values, q) {
  const sorted = [...values].sort((a, b) => a - b);
  const index = (sorted.length - 1) * q;
  const low = Math.floor(index);
  const high = Math.ceil(index);
  if (low === high) return sorted[low];
  return sorted[low] + (sorted[high] - sorted[low]) * (index - low);
}

function indexTfxDirectory(directory) {
  const found = new Map();

  for (const entry of fs.readdirSync(directory)) {
    if (entry.endsWith('.tfx') === false) continue;

    const file = path.join(directory, entry);
    const handle = fs.openSync(file, 'r');
    const header = Buffer.alloc(16);
    try {
      fs.readSync(handle, header, 0, 16, 0);
    } finally {
      fs.closeSync(handle);
    }

    const strandCount = header.readUInt32LE(4);
    const pointsPerStrand = header.readUInt32LE(8);
    const offsetVertexPosition = header.readUInt32LE(12);
    const bytes = fs.statSync(file).size;
    const expected = offsetVertexPosition + strandCount * pointsPerStrand * 4 * 4;

    if (offsetVertexPosition !== TFX_HEADER_BYTES || bytes !== expected) continue;

    if (found.has(strandCount)) {
      throw new Error(`two exports in ${directory} both declare ${strandCount} strands`);
    }

    found.set(strandCount, { path: file, strandCount, pointsPerStrand, bytes });
  }

  return found;
}

async function startViteServer(exports_) {
  const { createServer } = await import('vite');

  const mountTfx = {
    name: 'sugata-strand-time-tfx',
    configureServer(server) {
      server.middlewares.use('/tfx', (request, response, next) => {
        const match = /^\/strands-(\d+)\.tfx$/.exec(request.url ?? '');
        const entry = match === null ? undefined : exports_.get(Number(match[1]));
        if (entry === undefined) return next();
        response.setHeader('Content-Type', 'application/octet-stream');
        response.setHeader('Content-Length', String(entry.bytes));
        fs.createReadStream(entry.path).pipe(response);
      });
    },
  };

  const server = await createServer({
    configFile: path.join(REPOSITORY_ROOT, 'vite.config.js'),
    plugins: [mountTfx],
    server: { port: 5193, strictPort: false, hmr: false, watch: { ignored: ['**'] } },
    logLevel: 'warn',
  });

  await server.listen();
  server.baseUrl = server.resolvedUrls.local[0].replace(/\/$/, '');
  console.log(`vite      ${server.baseUrl}`);
  return server;
}

async function launchBrowser(playwright, options) {
  const attempts = options.headed ? [false] : [true, false];

  for (const headless of attempts) {
    try {
      const browser = await playwright.chromium.launch({
        channel: 'chromium', headless, args: GPU_FLAGS,
      });
      console.log(`chromium  ${headless ? 'headless' : 'headed'} (channel=chromium)`);
      return browser;
    } catch (error) {
      console.warn(`  launch (headless=${headless}) failed: ${error.message}`);
    }
  }

  throw new Error('could not launch Chromium. Run: npx playwright install chromium');
}

async function loadPlaywright(explicitPath) {
  const candidates = [];
  if (explicitPath) candidates.push(explicitPath);
  if (process.env.PLAYWRIGHT_MODULE) candidates.push(process.env.PLAYWRIGHT_MODULE);
  candidates.push('playwright');

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
      const resolved = require.resolve(candidate);
      const namespace = await import(pathToFileURL(resolved).href);
      if (namespace?.chromium) return namespace;
      if (namespace?.default?.chromium) return namespace.default;
    } catch { /* try the next */ }
  }

  throw new Error('playwright not resolvable. Pass --playwright <path>.');
}

function parseArguments(argv) {
  const options = {
    tfxDirectory: null,
    outDirectory: path.join(REPOSITORY_ROOT, 'captures', 'hair-r31-ladder-ours'),
    playwrightPath: null,
    headed: false,
    rounds: 15,
    batch: 24,
    perVisit: 4,
    warmup: 2,
    shadowDensities: [],
    headSha: null,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const flag = argv[index];
    const value = argv[index + 1];

    switch (flag) {
      case '--tfx': options.tfxDirectory = path.resolve(value); index += 1; break;
      case '--out': options.outDirectory = path.resolve(value); index += 1; break;
      case '--playwright': options.playwrightPath = value; index += 1; break;
      case '--rounds': options.rounds = Number(value); index += 1; break;
      case '--batch': options.batch = Number(value); index += 1; break;
      case '--pervisit': options.perVisit = Number(value); index += 1; break;
      case '--warmup': options.warmup = Number(value); index += 1; break;
      case '--shadow-densities':
        options.shadowDensities = value.split(',').map(Number); index += 1; break;
      case '--sha': options.headSha = value; index += 1; break;
      case '--headed': options.headed = true; break;
      default: throw new Error(`unknown argument '${flag}'`);
    }
  }

  if (options.tfxDirectory === null) throw new Error('--tfx is required');

  return options;
}

await main();
