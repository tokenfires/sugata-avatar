#!/usr/bin/env node
//
// strand-spike.mjs — the capture and correctness driver for `tools/spikes/strand-spike.js`.
//
// ## What this tool does, and the one thing it refuses to do
//
// It brings up vite, mounts the `.tfx` strand exports somewhere the page can fetch them, drives
// Chromium, and produces THREE kinds of evidence that the ribbon prototype renders correctly:
//
//   1. a plate at 720x900 of every exported strand count;
//   2. a FOOTPRINT probe — the rendered pixel area of a small, isolated set of ribbons measured
//      against the area predicted from the camera, the centreline and the width, swept across
//      camera azimuth. This is the camera-facing proof AND the one-fibre-wide proof, and why one
//      measurement answers both is derived in `__STRAND_FOOTPRINT__`'s comment on the page;
//   3. a strand CENSUS — the page writes each strand's own file index into the colour attachment
//      and this tool counts the distinct values that come back, so "the strand count in the frame
//      matches the file" is a measurement rather than an assumption.
//
// 🔴 **IT TAKES NO TIMINGS, ON PURPOSE, AND THAT IS NOT AN OMISSION TO BE FIXED IN PASSING.**
// This machine measured an IDENTICAL fixed workload at 0.01785 ms and 0.11228 ms in one session —
// a 6.3x swing — purely from other agents running on the GPU. A timing taken here, now, would not
// be a slow number or a fast number; it would be a number with no relationship to the thing it
// claims to measure, and it would look exactly like data. The timings belong to a separate
// serialised phase with exclusive access, round-robining arms inside one process and reporting
// minima beside a fixed-workload contention gate. `?gputime=1` is wired on the page for that phase
// to use. This tool does not pass it.
//
// ## Why the `.tfx` files are mounted rather than copied
//
// `tfx_export.py` writes to wherever it is told, and on this tree that is a scratchpad outside the
// repository. vite's root is the REPO (see `configFile` below) and its `fs.allow` is the repo, so
// the page cannot reach them by path. Copying them in would put six binaries totalling 11 MB into a tree that owns
// none of them and would make "which export is this plate of" a question about a stale copy. So
// the server grows one middleware, `/tfx/strands-<count>.tfx`, resolved against `--tfx` at request
// time — the file the plate is of is the file on disk, always.
//
// ## Running it
//
//   node tools/critic/strand-spike.mjs \
//       --tfx /path/to/exports --out captures/strand-spike
//
// `--tfx` is a directory holding the exports. They are matched by their DECLARED STRAND COUNT read
// out of each header rather than by filename, because `tfx_export.py` names them after the density
// multiplier (`_d23`) and the density multiplier is not the strand count.

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { decodePng } from './png.mjs';

const REPOSITORY_ROOT = fileURLToPath(new URL('../..', import.meta.url));

// Copied from capture.mjs rather than imported, because that file does not export them and this
// tool must not grow a reason to edit it. `channel: 'chromium'` matters: headless_shell has no GPU
// and therefore no WebGPU, and a spike that silently fell back to a software path would produce
// plates that look right and mean nothing.
const GPU_FLAGS = ['--enable-unsafe-webgpu', '--ignore-gpu-blocklist', '--hide-scrollbars'];

const PAGE_PATH = '/tools/spikes/strand-spike.html';

const TFX_HEADER_BYTES = 160;

const PLATE_WIDTH = 720;
const PLATE_HEIGHT = 900;

const READY_TIMEOUT_MS = 180_000;

/**
 * The azimuths the footprint probe sweeps.
 *
 * 0 and 90 are the decisive pair: a ribbon expanded in a FIXED plane rather than toward the eye
 * keeps its full footprint at one of them and collapses toward a line at the other. The
 * in-between angles are there so a partial failure — an expansion that is camera-facing in one
 * axis only — cannot hide between two samples.
 */
const PROBE_AZIMUTHS = [0, 30, 60, 90, 135, 180];

/**
 * Two widths, and the pair is the instrument rather than a sweep.
 *
 * ⚠️ AT ONE PIXEL THE PREDICTION AND THE RASTERISER ARE NOT MEASURING QUITE THE SAME THING. A quad
 * 1.5 px across covers a jagged set of pixel centres, and `L · w` is its analytic area, not its
 * pixel count; the two agree in the mean and disagree by tens of percent on any one segment. So
 * the FAT arm is where "is the width what the camera says it should be" gets a clean answer — at
 * 25 px the quantisation is under a percent — and the THIN arm is the width the spike will
 * actually be timed at, reported with its residue stated rather than tuned away.
 */
const PROBE_WIDTHS = [
  { name: 'fat', metres: 0.02, tolerance: 0.1 },
  { name: 'fibre', metres: 0.0012, tolerance: 0.35 },
];

/** How many strands the footprint probe draws. Small enough that self-overlap stays a residue. */
const PROBE_STRAND_LIMIT = 1;

async function main() {
  const options = parseArguments(process.argv.slice(2));

  const exports_ = indexTfxDirectory(options.tfxDirectory);
  if (exports_.size === 0) {
    throw new Error(`no .tfx files found under ${options.tfxDirectory}`);
  }

  console.log(`tfx       ${options.tfxDirectory}`);
  for (const [count, file] of [...exports_].sort((a, b) => a[0] - b[0])) {
    console.log(`          ${String(count).padStart(6)} strands  ${path.basename(file.path)}`);
  }

  fs.mkdirSync(options.outDirectory, { recursive: true });

  const playwright = await loadPlaywright(options.playwrightPath);
  const server = await startViteServer(exports_);
  const browser = await launchBrowser(playwright, options);

  const report = {
    tool: 'tools/critic/strand-spike.mjs',
    generatedAt: new Date().toISOString(),
    timings: 'NONE TAKEN — this machine swings 6.3x under contention; see this file\'s header.',
    tfxDirectory: options.tfxDirectory,
    plateSize: [PLATE_WIDTH, PLATE_HEIGHT],
    plates: [],
    footprint: [],
    census: [],
  };

  try {
    const context = await browser.newContext({
      viewport: { width: PLATE_WIDTH + 620, height: PLATE_HEIGHT + 220 },
      deviceScaleFactor: 1,
    });

    const page = await context.newPage();
    page.on('console', (message) => {
      if (message.type() === 'error') console.warn(`  page error: ${message.text()}`);
    });

    // A console error only says "404"; a reader needs to know 404 on WHAT. The first run of this
    // tool printed one and it took a second pass to establish it was the favicon rather than a
    // strand file that had silently failed to load behind a plate that still drew something.
    page.on('response', (response) => {
      if (response.status() >= 400) console.warn(`  ${response.status()} ${response.url()}`);
    });

    // --- 1. a plate of every density -------------------------------------------------------
    for (const count of [...exports_.keys()].sort((a, b) => a - b)) {
      const url = `${server.baseUrl}${PAGE_PATH}?strands=${count}`;
      const { describe, canvas } = await drive(page, url);

      const file = path.join(options.outDirectory, `plate-${String(count).padStart(5, '0')}.png`);
      fs.writeFileSync(file, canvas);

      const coverage = coverageOf(canvas);

      console.log(
        `plate     ${String(count).padStart(6)} strands  ` +
          `${describe.geometry.triangles.toLocaleString()} tri  ` +
          `${(coverage.covered / coverage.total * 100).toFixed(2)}% of frame covered  ` +
          `-> ${path.basename(file)}`
      );

      report.plates.push({
        strands: count,
        file: path.relative(REPOSITORY_ROOT, file),
        url,
        describe,
        framePixelsCovered: coverage.covered,
        framePixelsTotal: coverage.total,
      });
    }

    // --- 2. the footprint probe ------------------------------------------------------------
    //
    // Run on the SMALLEST export, because the probe draws one strand and the file it comes from is
    // irrelevant to what is being tested — the expansion arithmetic is per-vertex and knows nothing
    // about how many neighbours it has.
    const probeCount = Math.min(...exports_.keys());

    for (const width of PROBE_WIDTHS) {
      for (const azimuth of PROBE_AZIMUTHS) {
        const url =
          `${server.baseUrl}${PAGE_PATH}?strands=${probeCount}` +
          `&strandlimit=${PROBE_STRAND_LIMIT}&coverage=opaque&width=${width.metres}&azimuth=${azimuth}`;

        const { footprint, canvas } = await drive(page, url, { footprint: true });
        const measured = coverageOf(canvas).covered;

        const ratio = footprint.expectedAreaPixels === 0 ? null : measured / footprint.expectedAreaPixels;

        console.log(
          `footprint ${width.name.padEnd(6)} az=${String(azimuth).padStart(3)}  ` +
            `expect ${footprint.expectedAreaPixels.toFixed(1).padStart(9)} px  ` +
            `measured ${String(measured).padStart(7)} px  ` +
            `ratio ${ratio === null ? '   n/a' : ratio.toFixed(3)}  ` +
            `w=${footprint.expectedWidthPixels.mean === null ? 'n/a' : footprint.expectedWidthPixels.mean.toFixed(2)} px`
        );

        report.footprint.push({
          width: width.name,
          widthMetres: width.metres,
          azimuthDegrees: azimuth,
          url,
          expectedAreaPixels: footprint.expectedAreaPixels,
          measuredAreaPixels: measured,
          ratio,
          expectedWidthPixels: footprint.expectedWidthPixels,
          segments: footprint.segments,
          skippedSegments: footprint.skippedSegments,
          tolerance: width.tolerance,
        });
      }
    }

    // --- 3. the strand census ---------------------------------------------------------------
    for (const count of [...exports_.keys()].sort((a, b) => a - b)) {
      const url = `${server.baseUrl}${PAGE_PATH}?strands=${count}&probe=strandid&coverage=opaque`;
      const { describe, canvas } = await drive(page, url);

      // Kept as evidence rather than decoded and thrown away. An identity plate is unreadable as a
      // picture and is exactly the artefact somebody re-running this will want to diff.
      const identityFile = path.join(
        options.outDirectory,
        `identity-${String(count).padStart(5, '0')}.png`
      );
      fs.writeFileSync(identityFile, canvas);

      const seen = decodeStrandIdentities(canvas, count);

      console.log(
        `census    ${String(count).padStart(6)} strands  ` +
          `${String(seen.distinct).padStart(6)} distinct in frame ` +
          `(${(seen.distinct / count * 100).toFixed(2)}%)  ` +
          `out-of-range ${seen.outOfRange}  ` +
          `submitted tri ${describe.render.triangles.toLocaleString()}`
      );

      report.census.push({
        strands: count,
        url,
        distinctStrandsInFrame: seen.distinct,
        fileStrandCount: count,
        fractionOfFileVisible: seen.distinct / count,
        identitiesOutOfRange: seen.outOfRange,
        backgroundPixels: seen.background,
        file: path.relative(REPOSITORY_ROOT, identityFile),
        submittedTriangles: describe.render.triangles,
        expectedTriangles: describe.geometry.expectedTriangles,
        trianglesMatchFile: describe.render.triangles === describe.geometry.expectedTriangles,
      });
    }

    // --- 4. the control arms ------------------------------------------------------------------
    //
    // Not extra pictures: each one is the A side of a claim this spike makes in words.
    //
    //   tangent      the shipped `strandTangentNode` derives the fibre direction from screen-space
    //                derivatives of the card's UV. On a one-pixel-wide primitive the 2x2 derivative
    //                quad straddles neighbours and background, so the claim is that the geometric
    //                tangent is not merely tidier but NECESSARY. Two plates, one query key apart.
    //   coverage     the analytic ramp resolved by `alphaHash` against the same geometry drawn
    //                solid. The difference between them IS the coverage decision, isolated.
    //   oit          `cutout` at 0.5 against `hash`, which is the binary-versus-stochastic pair
    //                hair.md §5 measured on cards. Here it is measured on ribbons.
    const controlCount = exports_.has(11408) ? 11408 : Math.max(...exports_.keys());

    const controls = [
      { name: 'tangent-geometric', query: 'tangent=geometric' },
      { name: 'tangent-derivative', query: 'tangent=derivative' },
      { name: 'coverage-opaque', query: 'coverage=opaque' },
      { name: 'oit-cutout', query: 'oit=cutout' },
      { name: 'oit-stochastic', query: 'oit=stochastic' },
      { name: 'aa-taau', query: 'aa=taau' },
      { name: 'aa-traa', query: 'aa=traa' },
    ];

    report.controls = [];

    for (const control of controls) {
      const url = `${server.baseUrl}${PAGE_PATH}?strands=${controlCount}&${control.query}`;
      const { describe, canvas } = await drive(page, url);

      const file = path.join(options.outDirectory, `control-${control.name}.png`);
      fs.writeFileSync(file, canvas);

      const coverage = coverageOf(canvas);

      console.log(
        `control   ${control.name.padEnd(20)} ` +
          `${(coverage.covered / coverage.total * 100).toFixed(2)}% covered  ` +
          `tri ${describe.render.triangles.toLocaleString()}  -> ${path.basename(file)}`
      );

      // ⚠️ `describe.render.triangles` IS NOT THE GEOMETRY COUNT ON THE `aa=*` ARMS AND MUST NOT BE
      // READ AS ONE. Those arms composite through a `RenderPipeline`, and what the counter holds
      // after it is the composite's own full-screen quads — 1 or 2 — rather than the scene pass's
      // draws. The geometry census is taken at `aa=off` in section 3, where the counter means what
      // it says; this field is kept so the difference is visible rather than silently reconciled.
      report.controls.push({
        name: control.name,
        trianglesAreCompositeOnly: control.query.startsWith('aa='),
        strands: controlCount,
        url,
        file: path.relative(REPOSITORY_ROOT, file),
        framePixelsCovered: coverage.covered,
        framePixelsTotal: coverage.total,
        describe,
      });
    }

    // --- 5. what the control arms are worth, as a number ----------------------------------------
    //
    // 🎯 TWO PLATES THAT "LOOK DIFFERENT" IS NOT A FINDING. The tangent pair in particular is the
    // spike's own claim about itself — that a geometric fibre tangent is NECESSARY on a
    // one-pixel-wide primitive rather than merely tidier — and a claim like that has to survive a
    // pixel difference or be withdrawn. Reported over the union of the two arms' drawn footprints,
    // because the background is identical by construction and averaging it in would divide every
    // difference by three.
    report.controlDiffs = [];

    const plateOf = (name) =>
      fs.readFileSync(path.join(options.outDirectory, `control-${name}.png`));

    for (const [left, right] of [
      ['tangent-geometric', 'tangent-derivative'],
      ['tangent-geometric', 'oit-cutout'],
      ['tangent-geometric', 'oit-stochastic'],
      ['tangent-geometric', 'aa-taau'],
      ['tangent-geometric', 'aa-traa'],
    ]) {
      const difference = differenceOf(plateOf(left), plateOf(right));

      console.log(
        `diff      ${left} vs ${right}: ` +
          `${(difference.changedFraction * 100).toFixed(2)}% of drawn pixels differ, ` +
          `mean Δ ${difference.meanDelta.toFixed(3)}/255, max Δ ${difference.maxDelta}/255`
      );

      report.controlDiffs.push({ left, right, ...difference });
    }

    const file = path.join(options.outDirectory, 'strand-spike.report.json');
    fs.writeFileSync(file, `${JSON.stringify(report, null, 2)}\n`);
    console.log(`report    ${path.relative(REPOSITORY_ROOT, file)}`);
  } finally {
    await browser.close();
    await server.close();
  }
}

/**
 * Loads a URL, waits for the page to say it is ready, and returns the census and the canvas bytes.
 *
 * The wait is on `__STRAND_READY__`, which the page sets only AFTER its first frame has been
 * submitted and the device queue has drained — so a screenshot taken the instant this resolves is
 * of a finished frame rather than of a cleared one. `__STRAND_ERROR__` is checked first and
 * rethrown here, because a page that failed to load otherwise waits out the full timeout and
 * reports "timed out" for what was a one-line stack trace on the HUD.
 */
async function drive(page, url, { footprint = false } = {}) {
  await page.goto(url, { waitUntil: 'load' });

  await page.waitForFunction(
    () => window.__STRAND_READY__ === true || window.__STRAND_ERROR__ !== undefined,
    null,
    { timeout: READY_TIMEOUT_MS }
  );

  const error = await page.evaluate(() => window.__STRAND_ERROR__ ?? null);
  if (error !== null) throw new Error(`page failed at ${url}\n${error}`);

  const describe = await page.evaluate(() => window.__STRAND_DESCRIBE__());
  const measured = footprint ? await page.evaluate(() => window.__STRAND_FOOTPRINT__()) : null;
  const canvas = await page.locator('#stage').screenshot();

  return { describe, footprint: measured, canvas };
}

/**
 * Non-black pixels. The page clears to 0x000000, so this is the drawn footprint exactly.
 *
 * ⚠️ `decodePng` HANDS BACK NORMALISED FLOATS, NOT BYTES (`png.mjs:237` — a `Float32Array` divided
 * by `(1 << bitDepth) - 1`). Nothing here needs the code value, but `decodeStrandIdentities` does,
 * and reading that array as bytes is what turned the first census run into 47,866 out-of-range
 * identities off a frame that was encoded perfectly. Noted here because both readers share it.
 */
function coverageOf(pngBuffer) {
  const { width, height, pixels } = decodePng(pngBuffer);

  let covered = 0;

  for (let index = 0; index < width * height; index += 1) {
    const offset = index * 4;
    if (pixels[offset] !== 0 || pixels[offset + 1] !== 0 || pixels[offset + 2] !== 0) covered += 1;
  }

  return { covered, total: width * height };
}

/**
 * Counts the distinct strand identities the frame actually contains.
 *
 * The page writes `strand + 1` as little-endian base 256 across RGB with tone mapping off and no
 * output transfer, so a channel byte comes back as it was written. `Math.round` absorbs the
 * half-code-value a float-to-unorm quantisation can leave; `outOfRange` is the gate on that
 * assumption — if the transfer were live, identities would land anywhere and the count would be
 * nonsense that still LOOKED like a count. A non-zero `outOfRange` invalidates the row.
 */
function decodeStrandIdentities(pngBuffer, strandCount) {
  const { width, height, pixels } = decodePng(pngBuffer);

  const seen = new Uint8Array(strandCount);
  let outOfRange = 0;
  let background = 0;

  for (let index = 0; index < width * height; index += 1) {
    const offset = index * 4;

    // Back to code values. `decodePng` normalises to 0..1, and `Math.round` is the half-code-value
    // tolerance on a float-to-unorm round trip — a channel written as k/255 comes back as k/255 to
    // seven digits, and rounding costs nothing while making that assumption cheap to hold.
    const red = Math.round(pixels[offset] * 255);
    const green = Math.round(pixels[offset + 1] * 255);
    const blue = Math.round(pixels[offset + 2] * 255);

    if (red === 0 && green === 0 && blue === 0) {
      background += 1;
      continue;
    }

    const identity = red + green * 256 + blue * 65536 - 1;

    if (identity < 0 || identity >= strandCount) outOfRange += 1;
    else seen[identity] = 1;
  }

  let distinct = 0;
  for (let index = 0; index < strandCount; index += 1) distinct += seen[index];

  return { distinct, outOfRange, background };
}

/**
 * Per-channel absolute difference between two plates, over the pixels either of them drew.
 *
 * The mask is the UNION of the two footprints rather than the frame, for the reason the caller
 * gives: two thirds of a 720x900 hair plate is black in both arms, and including it turns any
 * difference into a small number about the framing instead of a real number about the pixels.
 */
function differenceOf(leftBuffer, rightBuffer) {
  const left = decodePng(leftBuffer);
  const right = decodePng(rightBuffer);

  if (left.width !== right.width || left.height !== right.height) {
    throw new Error('cannot difference plates of different sizes');
  }

  let drawn = 0;
  let changed = 0;
  let sum = 0;
  let maxDelta = 0;

  for (let index = 0; index < left.width * left.height; index += 1) {
    const offset = index * 4;

    let pixelMax = 0;
    let anyDrawn = false;

    for (let channel = 0; channel < 3; channel += 1) {
      const a = Math.round(left.pixels[offset + channel] * 255);
      const b = Math.round(right.pixels[offset + channel] * 255);

      if (a !== 0 || b !== 0) anyDrawn = true;

      pixelMax = Math.max(pixelMax, Math.abs(a - b));
    }

    if (anyDrawn === false) continue;

    drawn += 1;
    sum += pixelMax;
    if (pixelMax > 0) changed += 1;
    maxDelta = Math.max(maxDelta, pixelMax);
  }

  return {
    drawnPixels: drawn,
    changedPixels: changed,
    changedFraction: drawn === 0 ? 0 : changed / drawn,
    meanDelta: drawn === 0 ? 0 : sum / drawn,
    maxDelta,
    mask: 'union of the two arms\' drawn footprints; per-pixel delta is the max over R, G, B',
  };
}

/**
 * Indexes a directory of `.tfx` files by the strand count in each header.
 *
 * 🚩 BY THE HEADER AND NOT BY THE FILENAME. `tfx_export.py` names its output after the DENSITY
 * MULTIPLIER — `bob01_g050_d23.tfx` is 11,408 strands, not 23 — so a filename-derived count would
 * be wrong by three orders of magnitude and would still sort, still print and still look fine.
 */
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

    if (offsetVertexPosition !== TFX_HEADER_BYTES || bytes !== expected) {
      console.warn(`  skipping ${entry}: header declares ${expected} bytes, file is ${bytes}`);
      continue;
    }

    // A duplicate count means two exports of the same density are sitting in one directory and
    // there is no way to tell from here which one a plate should be of. Refused rather than
    // resolved by mtime — a plate of the wrong groom is the defect this whole spike exists to
    // avoid making claims from.
    if (found.has(strandCount)) {
      throw new Error(
        `two exports in ${directory} both declare ${strandCount} strands: ` +
          `${path.basename(found.get(strandCount).path)} and ${entry}. Point --tfx at a directory ` +
          'holding one export per density.'
      );
    }

    found.set(strandCount, { path: file, strandCount, pointsPerStrand, bytes });
  }

  return found;
}

/**
 * vite, with the exports mounted.
 *
 * The watcher is off for `capture.mjs`'s reason, verbatim: a concurrent agent's edit fires HMR, the
 * page navigates, and Playwright dies with "Execution context was destroyed" mid-run. This tree has
 * other agents live in it by assumption, so a run that could be killed by someone else's save is a
 * run that will be.
 */
async function startViteServer(exports_) {
  const { createServer } = await import('vite');

  const mountTfx = {
    name: 'sugata-strand-spike-tfx',
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

  // 🚩 `vite.spikes.config.js`, NOT `vite.config.js`, and the difference is why this page moved.
  // The main config roots vite at `packages/testbed`, so a spike page had to live under
  // `packages/testbed/src/` to be served — and a page there is a SHIPPING page: `pages.selftest.mjs`
  // closes over that directory in both directions and went UNDECLARED RED the moment this one
  // appeared, because it is in neither `pages.js` nor `vite.pages.config.js`'s PAGES. It should
  // never have been in either. `vite.spikes.config.js` roots at the repo for exactly this reason
  // and its own header says so: "the spike pages live outside packages/testbed".
  const server = await createServer({
    configFile: path.join(REPOSITORY_ROOT, 'vite.spikes.config.js'),
    plugins: [mountTfx],
    // `open: false` explicitly, even though `vite.spikes.config.js` no longer sets `open` — this is
    // a headless harness and it must not be one config edit away from launching a real browser.
    server: { port: 5191, strictPort: false, hmr: false, watch: { ignored: ['**'] }, open: false },
    logLevel: 'warn',
  });

  await server.listen();
  server.baseUrl = server.resolvedUrls.local[0].replace(/\/$/, '');
  console.log(`vite      ${server.baseUrl} (started by strand-spike.mjs)`);

  return server;
}

async function launchBrowser(playwright, options) {
  const attempts = options.headed ? [false] : [true, false];

  for (const headless of attempts) {
    try {
      const browser = await playwright.chromium.launch({
        channel: 'chromium',
        headless,
        args: GPU_FLAGS,
      });
      console.log(`chromium  ${headless ? 'headless' : 'headed'} (channel=chromium)`);
      return browser;
    } catch (error) {
      console.warn(`  launch (headless=${headless}) failed: ${error.message}`);
    }
  }

  throw new Error('could not launch Chromium. Run: npx playwright install chromium');
}

/** Playwright is not a dependency of this repo; it is looked up wherever it happens to live. */
async function loadPlaywright(explicitPath) {
  const candidates = [];

  if (explicitPath) candidates.push(explicitPath);
  if (process.env.PLAYWRIGHT_MODULE) candidates.push(process.env.PLAYWRIGHT_MODULE);
  candidates.push('playwright');

  const cache = path.join(process.env.HOME ?? '', '.npm', '_npx');
  if (fs.existsSync(cache)) {
    candidates.push(
      ...fs
        .readdirSync(cache)
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
    } catch {
      // try the next candidate; the error only matters if they all fail
    }
  }

  throw new Error('playwright not resolvable. Pass --playwright <path to a playwright install>.');
}

function parseArguments(argv) {
  const options = {
    tfxDirectory: null,
    outDirectory: path.join(REPOSITORY_ROOT, 'captures', 'strand-spike'),
    playwrightPath: null,
    headed: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const flag = argv[index];
    const value = argv[index + 1];

    switch (flag) {
      case '--tfx': options.tfxDirectory = path.resolve(value); index += 1; break;
      case '--out': options.outDirectory = path.resolve(value); index += 1; break;
      case '--playwright': options.playwrightPath = value; index += 1; break;
      case '--headed': options.headed = true; break;
      case '--help': printUsage(); process.exit(0); break;
      default: throw new Error(`unknown argument '${flag}'. Try --help.`);
    }
  }

  if (options.tfxDirectory === null) {
    printUsage();
    throw new Error('--tfx is required: point it at the directory tfx_export.py wrote into.');
  }

  return options;
}

function printUsage() {
  console.log(`
strand-spike.mjs — plates and correctness probes for the ribbon strand prototype.
It takes NO timings; see this file's header for why.

  --tfx <dir>          directory of .tfx exports, indexed by the strand count in each header
  --out <dir>          where plates and the report go. Default captures/strand-spike
  --playwright <path>  path to a playwright installation
  --headed             run Chromium headed
`);
}

main().catch((error) => {
  console.error(`\nstrand-spike.mjs failed: ${error.message}`);
  if (error.stack) console.error(error.stack);
  process.exitCode = 1;
});
