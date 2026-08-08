#!/usr/bin/env node
//
// capture.mjs — deterministic video capture of a live Sugata page.
//
// Aliveness is a TEMPORAL property, and two review passes in a row failed to judge it because
// they only ever had stills. This tool produces the moving picture.
//
// It does not record in real time. The page is loaded with ?capture, which stops its frame loop
// and hands the clock to this process —
//
//     step(1/fps) -> screenshot -> step(1/fps) -> screenshot -> ...
//
// Simulation time is therefore fully decoupled from wall-clock time, which buys three things
// real-time screen recording cannot:
//
//   - exact. 20.000 s of simulated time is 600 frames at 30 fps, never 597 or 611, no matter
//     how slow the machine is or how long a screenshot takes.
//   - immune to rAF throttling, background tabs and thermal state. (For the record: rAF was
//     MEASURED at 120 Hz in Playwright's headless Chromium, not the ~1.5 Hz that motivated this
//     work. Whatever throttled the earlier attempts, it was not this harness. The fixed-step
//     design is still the right one — for exactness and reproducibility, not to dodge a throttle.)
//   - reproducible to the byte. A clean plate (?bare) at a given seed replays frame for frame:
//     verified 600/600 across a fresh page load AND across a separate browser process.
//
//     ⚠ The INSTRUMENTED page is not, and the tool will say so. The HUD prints `stats.frameMs`,
//     a wall-clock millisecond reading, so those pixels differ run to run. The figure underneath
//     is identical either way. Capture with ?bare when the digest has to mean something; read a
//     HUD capture as evidence, not as a fingerprint.
//
// Reproducibility here is MEASURED, never asserted: every run replays its opening frames from a
// fresh page load and reports whether they came back identical. That check is not ceremony — it
// is what caught a bug where stopping the frame loop also froze skinning, so the figure rendered
// a still pose while the strip chart happily animated. It measured as perfectly reproducible,
// because a still image always does.
//
// Outputs, all in --out:
//   capture.mp4          h264 / yuv420p, for scrubbing frame by frame
//   capture.gif          palettegen + paletteuse, so skin gradients do not band
//   contact-sheet.png    evenly-spaced frames tiled and time-stamped, for a reviewer that
//                        cannot play video at all
//   capture.json         the manifest: seed, backend, per-frame digests, timings
//
// ⚠ A REPRODUCIBLE CLIP IS NOT A REPRESENTATIVE ONE. See the POSTURAL CONTENT block below:
// --seed pins the draw, and every judgement in this repo was pinned to seed 1, which contains no
// sustained weight transfer in seven minutes. --seed takes a LIST for that reason.
//
// Usage:
//   node tools/critic/capture.mjs --url http://localhost:5173/alive.html \
//        --seconds 20 --fps 30 --width 1080 --height 1350 --seed 1 --out captures/idle
//
//   node tools/critic/capture.mjs --seed 4242,42,20260807 --seconds 420 --out captures/judge
//     ^ three clips, one per seed, in captures/judge/seed-<n>/ — the postural-judgement set.
//
// With no --url it starts vite itself and drives /alive.html.
//
// Exit codes follow measure.mjs, so a calling script can tell a bad capture from a broken tool:
//   0 = capture written, frames genuinely differ
//   1 = the capture is not usable — every frame identical (the stepping hook did nothing), or
//       --require-weight-shift was asked for and the clip is not known to contain one
//   2 = tool error (no browser, no ffmpeg, page never became ready)

import { spawn } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { decodePng, encodePng } from './png.mjs';

const CRITIC_DIRECTORY = path.dirname(fileURLToPath(import.meta.url));
const REPOSITORY_ROOT = path.resolve(CRITIC_DIRECTORY, '..', '..');

// Measured on macOS with Chromium 151 by tools/spikes/run.mjs, not assumed — and the findings
// there are worth not relearning:
//
//   - WebGPU comes up headless on the real Apple Metal adapter with NO flags. `channel:
//     'chromium'` is what matters: plain headless runs `headless_shell`, which has no GPU and
//     falls through to SwiftShader.
//   - `--enable-features=Vulkan` REMOVES WebGPU on macOS. It replaces the default feature set
//     and asks for a backend that does not exist here, so navigator.gpu ends up undefined and
//     the page silently degrades to WebGL2. Do not add it back.
//   - `--use-angle=metal` only selects an ANGLE backend for WebGL; it does nothing for WebGPU
//     and is left out rather than carried as cargo.
//
// WebGPU also requires a secure context, which is why the page is always served over
// http://localhost and never from file://.
const GPU_FLAGS = [
  '--enable-unsafe-webgpu',
  '--ignore-gpu-blocklist',
  '--hide-scrollbars',
];

const FFMPEG = process.env.FFMPEG || '/opt/homebrew/bin/ffmpeg';

const READY_TIMEOUT_MS = 120_000;
const SCREENSHOT_TIMEOUT_MS = 60_000;

const DEFAULTS = {
  seconds: 10,
  fps: 30,
  width: 1080,
  height: 1350,
  dpr: 1,
  preroll: 0,
  gifFps: 15,
  gifWidth: 540,
  sheetCells: 12,
  sheetColumns: 4,
  sheetCellWidth: 340,
  verifyFrames: 20,
};

// Contact-sheet tiling. Margin is the outer border, padding the gap between cells; both are
// needed below to work out where each cell landed so the time stamps can be drawn on it.
const SHEET_MARGIN = 10;
const SHEET_PADDING = 8;
const SHEET_BACKGROUND = '0x0b0b0e';

// --- POSTURAL CONTENT: which clips actually contain the behaviour a body judge is asked about ---
//
// 🎯 THE DEFECT THIS BLOCK EXISTS FOR. Seed 1 was pinned for every capture and every judgement in
// this repo because it is reproducible. Reproducible is not representative. Measured on the
// shipped `Sway` layer at this tool's own 30 fps and full-body framing, seed 1's pelvis never
// leaves a +-5 px band for as long as fifteen seconds in 420 s — its first sustained transfer
// arrives at 483.0 s, sixty-three seconds after the clip ends. Judges were asked whether a body
// shifts its weight while watching a clip that, by the draw, contains no weight shift.
//
// It is not a bug in the layer. Duarte's medio-lateral weight shift runs at 0.30/min, so a 420 s
// clip holds ~2.1 expected arrivals and the magnitude draw is lognormal — most shifts are small.
// Measured over the twelve seeds `sway.selftest.mjs` gates on, only SEVEN contain a sustained
// transfer in 420 s and the median wait for the first one is 341 s. This is LEARNINGS §1.4 one
// level down: the window was sized against the RELAY rate (1.5/min, the pooled fidget-plus-shift
// process) and the behaviour being judged is governed by the SHIFT rate, five times slower.
//
// So the seed is a gate parameter and it is now written down, measured, and re-verified on every
// run of `packages/core/src/motion/sway.selftest.mjs` — which imports these five constants and
// fails if any nominated seed has stopped containing its transfer, or if seed 1 has started.
//
// The definition of "sustained transfer", both halves derived from numbers already in the repo:
//   - 5 px of pelvis displacement at full-body framing is 7.6 mm, which is 2.46x the layer's own
//     measured medio-lateral balance RMS of 3.089 mm. Below that a viewer is looking at noise;
//     above it, at a decision. (The 1.6 px indistinguishability floor is a peak-to-peak and is
//     the wrong statistic for a held offset — LEARNINGS §1.14.)
//   - 15 s is the glance window `sway.selftest.mjs` already measures legibility over: a hold that
//     fills the span a viewer spends deciding whether the thing is alive.
const POSTURAL_HOLD_PIXELS = 5;
const POSTURAL_HOLD_SECONDS = 15;
const POSTURAL_SMOOTHING_SECONDS = 3;

/** The clip length the postural nomination below was measured at. Change it and re-verify. */
const POSTURAL_CLIP_SECONDS = 420;

/**
 * Seeds whose 420 s clip is KNOWN BY MEASUREMENT to contain a sustained weight transfer, with the
 * onset and peak each one was verified at. Both directions are represented on purpose: a judge
 * shown three clips that all load the same leg will report a body that always stands on its left.
 *
 * 4242 leads because its transfer opens at 17.1 s, so it is the one clip that shows the behaviour
 * even if the reviewer only watches the first minute. 20260807 is `alive.js`'s own default seed.
 */
const POSTURAL_JUDGEMENT_SEEDS = [
  { seed: 4242, direction: 'left', onsetSeconds: 17.1, peakPixels: -34.1 },
  { seed: 42, direction: 'right', onsetSeconds: 297.0, peakPixels: 30.4 },
  { seed: 20260807, direction: 'left', onsetSeconds: 232.2, peakPixels: -17.8 },
];

/**
 * Seeds measured to contain NO sustained transfer in 420 s. Named rather than merely omitted, so
 * that a capture pinned to one of them gets told what it is about to fail to show. Seed 1 is here
 * because it is the seed this whole block was written for.
 */
const POSTURAL_EMPTY_SEEDS = [
  { seed: 1, firstTransferSeconds: 483.0 },
  { seed: 7, firstTransferSeconds: 688.8 },
  { seed: 777, firstTransferSeconds: 968.6 },
  { seed: 31337, firstTransferSeconds: 410.6 },
  { seed: 99999989, firstTransferSeconds: 781.2 },
];

/**
 * Below this there is no point asking about postural content at all: nothing in the postural
 * literature has a period short enough to appear (LEARNINGS §1.4), so a 20 s eye capture should
 * not be nagged about weight shifts it was never going to contain.
 */
const POSTURAL_ADVISORY_FLOOR_SECONDS = 60;

export {
  POSTURAL_JUDGEMENT_SEEDS,
  POSTURAL_EMPTY_SEEDS,
  POSTURAL_CLIP_SECONDS,
  POSTURAL_HOLD_PIXELS,
  POSTURAL_HOLD_SECONDS,
  POSTURAL_SMOOTHING_SECONDS,
};

// Importable as well as runnable: `sway.selftest.mjs` imports the constants above and re-measures
// them, so the nomination cannot rot silently. Without this guard that import would launch a
// browser and start capturing.
if (path.resolve(process.argv[1] ?? '') === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(`\ncapture.mjs failed: ${error.message}`);
    if (process.env.DEBUG) console.error(error.stack);
    process.exitCode = 2;
  });
}

async function main() {
  const options = parseArguments(process.argv.slice(2));

  requireFfmpeg();

  const playwright = await loadPlaywright(options.playwrightPath);
  const server = wantsOwnServer(options) ? await startViteServer() : null;
  const browser = await launchBrowser(playwright, options);

  // One clip per seed. The browser and the vite server are shared across them, which is most of
  // the wall-clock cost, so three seeds is nothing like three times one seed.
  const baseDirectory = path.resolve(options.out);
  const manifests = [];

  try {
    for (const seed of options.seeds) {
      const outputDirectory = options.seeds.length > 1
        ? path.join(baseDirectory, `seed-${seed}`)
        : baseDirectory;

      manifests.push(await captureOneSeed({ browser, server, options, seed, outputDirectory }));
    }
  } finally {
    await browser.close();
    if (server !== null) await server.close();
  }

  if (options.seeds.length > 1) writeSeedIndex(baseDirectory, manifests);

  // A capture where nothing moved is worse than no capture: it looks like evidence and is not.
  if (manifests.some((manifest) => manifest.determinism.distinctFrames <= 1)) {
    console.error('\n*** EVERY FRAME IS IDENTICAL. The stepping hook did nothing — this capture is');
    console.error('*** not evidence of anything. Check that the page exposes window.__SUGATA_STEP__');
    console.error('*** and that ?capture is in the URL.');
    process.exitCode = 1;
  }

  // §1.3 — a clip that cannot contain the behaviour is a degenerate input to the judge, and it
  // scores exactly as well as a real one. --require-weight-shift makes that a failure instead of
  // a footnote, for the callers whose whole question is postural.
  if (options.requireWeightShift) {
    const empty = manifests.filter((manifest) => manifest.posturalContent.containsWeightShift !== true);

    if (empty.length > 0) {
      console.error('\n*** --require-weight-shift: no sustained weight transfer is known to be in');
      for (const manifest of empty) {
        console.error(`***   seed ${manifest.seed ?? '(page default)'} over ${manifest.simulation.simulatedSeconds} s — ${manifest.posturalContent.reason}`);
      }
      console.error(`*** Checked seeds at ${POSTURAL_CLIP_SECONDS} s: ${POSTURAL_JUDGEMENT_SEEDS.map((entry) => entry.seed).join(', ')}`);
      process.exitCode = 1;
    }
  }
}

/** One clip, at one seed, into one directory. Everything main() used to do inline. */
async function captureOneSeed({ browser, server, options, seed, outputDirectory }) {
  const framesDirectory = path.join(outputDirectory, 'frames');
  fs.mkdirSync(framesDirectory, { recursive: true });

  const pageUrl = buildPageUrl(options, server, seed);
  const posturalContent = describePosturalContent(seed, options.seconds);

  console.log('');
  console.log(`page      ${pageUrl}`);
  console.log(`capture   ${options.seconds} s @ ${options.fps} fps = ${frameCountOf(options)} frames` +
    `   ${options.width}x${options.height} @ dpr ${options.dpr}`);

  reportPosturalContent(posturalContent);

  const startedAtMs = Date.now();

  const capture = await driveCapture(browser, pageUrl, options, {
    frameCount: frameCountOf(options),
    framesDirectory,
    quiet: false,
  });

  reportBackend(capture.environment, pageUrl);

  const reproducibility = options.verifyFrames > 0
    ? await verifyReproducibility(browser, pageUrl, options, capture)
    : null;

  const mp4Path = path.join(outputDirectory, 'capture.mp4');
  const gifPath = path.join(outputDirectory, 'capture.gif');
  const sheetPath = path.join(outputDirectory, 'contact-sheet.png');

  await encodeMp4(framesDirectory, mp4Path, options);
  await encodeGif(framesDirectory, gifPath, options);
  const sheetCells = await buildContactSheet(framesDirectory, sheetPath, capture, options);

  const manifest = buildManifest({
    options,
    seed,
    pageUrl,
    capture,
    reproducibility,
    posturalContent,
    sheetCells,
    elapsedSeconds: (Date.now() - startedAtMs) / 1000,
    outputs: { mp4: mp4Path, gif: gifPath, contactSheet: sheetPath },
  });

  fs.writeFileSync(path.join(outputDirectory, 'capture.json'), JSON.stringify(manifest, null, 2) + '\n');

  if (options.keepFrames === false) fs.rmSync(framesDirectory, { recursive: true, force: true });

  printSummary(manifest, outputDirectory, options);

  return manifest;
}

/**
 * The top-level index for a multi-seed run, so a judge opening the directory is told what the set
 * as a whole contains before it opens any one clip.
 */
function writeSeedIndex(baseDirectory, manifests) {
  const index = {
    tool: 'tools/critic/capture.mjs',
    capturedAt: new Date().toISOString(),
    seeds: manifests.map((manifest) => ({
      seed: manifest.seed,
      directory: `seed-${manifest.seed}`,
      sequenceDigest: manifest.determinism.sequenceDigest,
      posturalContent: manifest.posturalContent,
    })),
    seedsContainingWeightShift: manifests
      .filter((manifest) => manifest.posturalContent.containsWeightShift === true)
      .map((manifest) => manifest.seed),
  };

  fs.writeFileSync(path.join(baseDirectory, 'capture.json'), JSON.stringify(index, null, 2) + '\n');

  console.log('');
  console.log(`seed set  ${index.seeds.length} clips; sustained weight transfer in ` +
    `${index.seedsContainingWeightShift.length} of them` +
    (index.seedsContainingWeightShift.length > 0 ? ` (${index.seedsContainingWeightShift.join(', ')})` : ''));
  console.log(`  ${'index'.padEnd(13)} ${path.join(baseDirectory, 'capture.json')}`);
}

// --- postural content ---------------------------------------------------------------------------

/**
 * What this (seed, duration) pair is known to contain, from the measured table at the top of this
 * file. It answers only from measurement: a seed nobody has measured comes back `null`, which is
 * the honest answer and reads differently in the manifest from a measured `false`.
 */
function describePosturalContent(seed, seconds) {
  if (seconds < POSTURAL_ADVISORY_FLOOR_SECONDS) {
    return {
      containsWeightShift: null,
      reason: `clip is ${seconds} s; below ${POSTURAL_ADVISORY_FLOOR_SECONDS} s no postural process has a short enough period to appear, so the question is not asked`,
      measuredAtSeconds: null,
    };
  }

  if (seed === null) {
    return {
      containsWeightShift: null,
      reason: 'seed not pinned — the page chose it, so nothing here can say what the clip contains. Pass --seed with one of the checked seeds.',
      measuredAtSeconds: null,
    };
  }

  const nominated = POSTURAL_JUDGEMENT_SEEDS.find((entry) => entry.seed === seed);

  if (nominated !== undefined) {
    // Measured at POSTURAL_CLIP_SECONDS. A shorter clip may end before the transfer opens, and
    // saying otherwise would be exactly the unchecked claim this block exists to stop.
    if (seconds < nominated.onsetSeconds + POSTURAL_HOLD_SECONDS) {
      return {
        containsWeightShift: false,
        reason: `seed ${seed}'s transfer opens at ${nominated.onsetSeconds} s and this clip is only ${seconds} s long`,
        measuredAtSeconds: POSTURAL_CLIP_SECONDS,
      };
    }

    return {
      containsWeightShift: true,
      reason: `seed ${seed} transfers ${nominated.direction} from ${nominated.onsetSeconds} s, peak ${nominated.peakPixels} px of pelvis travel at full-body framing`,
      measuredAtSeconds: POSTURAL_CLIP_SECONDS,
      onsetSeconds: nominated.onsetSeconds,
      direction: nominated.direction,
    };
  }

  const empty = POSTURAL_EMPTY_SEEDS.find((entry) => entry.seed === seed);

  if (empty !== undefined) {
    const contains = seconds >= empty.firstTransferSeconds + POSTURAL_HOLD_SECONDS;

    return {
      containsWeightShift: contains,
      reason: contains
        ? `seed ${seed}'s first sustained transfer arrives at ${empty.firstTransferSeconds} s, which this ${seconds} s clip does reach`
        : `seed ${seed} was MEASURED to hold no weight transfer until ${empty.firstTransferSeconds} s, and this clip ends at ${seconds} s`,
      measuredAtSeconds: POSTURAL_CLIP_SECONDS,
    };
  }

  return {
    containsWeightShift: null,
    reason: `seed ${seed} has never been measured for postural content`,
    measuredAtSeconds: null,
  };
}

/**
 * Says it out loud, before the capture runs rather than after, because the whole cost of this
 * defect was seven-minute clips that were judged before anyone asked what was in them.
 */
function reportPosturalContent(content) {
  if (content.containsWeightShift === true) {
    console.log(`postural  weight transfer present — ${content.reason}`);
    return;
  }

  if (content.containsWeightShift === null && content.measuredAtSeconds === null
    && content.reason.startsWith('clip is ')) {
    return;
  }

  console.log('');
  console.log('*** NO SUSTAINED WEIGHT TRANSFER IS KNOWN TO BE IN THIS CLIP.');
  console.log(`***   ${content.reason}`);
  console.log(`***   Checked seeds at ${POSTURAL_CLIP_SECONDS} s: ` +
    POSTURAL_JUDGEMENT_SEEDS.map((entry) => `${entry.seed} (${entry.direction}, from ${entry.onsetSeconds} s)`).join(', '));
  console.log('***   Judging weight shift on this clip judges the draw, not the layer.');
  console.log('');
}

// --- driving the page -------------------------------------------------------------------------

/**
 * Loads the page, waits for the figure to exist, then walks the simulation forward one fixed
 * step per frame, screenshotting after each.
 *
 * The step and the screenshot are strictly in lockstep and both are awaited, so nothing here
 * depends on how fast the machine is; a slow machine produces the same frames, just later.
 *
 * @param {?string} framesDirectory - where to write the PNGs, or null to hash and discard,
 *   which is what the reproducibility replay does.
 */
async function driveCapture(browser, pageUrl, options, { frameCount, framesDirectory, quiet }) {
  const context = await browser.newContext({
    viewport: { width: options.width, height: options.height },
    deviceScaleFactor: options.dpr,
    // A capture is a measurement. Reduced motion or a non-default colour scheme would change
    // what the page draws, so both are pinned rather than inherited from the host.
    colorScheme: 'dark',
    reducedMotion: 'no-preference',
  });

  const page = await context.newPage();
  const pageErrors = [];

  page.on('pageerror', (error) => pageErrors.push(error.message));
  page.on('console', (message) => {
    // A missing favicon is the one 404 every headless run produces and the one that never means
    // anything; letting it into the manifest trains a reader to ignore the field.
    if (message.type() === 'error' && /favicon/i.test(message.location()?.url ?? '') === false) {
      pageErrors.push(`console: ${message.text()}`);
    }
  });

  await page.goto(pageUrl, { waitUntil: 'domcontentloaded' });

  await page
    .waitForFunction(() => typeof globalThis.__SUGATA_STEP__ === 'function', null, {
      timeout: READY_TIMEOUT_MS,
      polling: 200,
    })
    .catch(() => {
      throw new Error(
        `page never exposed window.__SUGATA_STEP__ within ${READY_TIMEOUT_MS / 1000}s.` +
          (pageErrors.length > 0 ? `\n  page errors: ${pageErrors.join('\n  ')}` : '')
      );
    });

  const environment = await readEnvironment(page);

  const deltaSeconds = 1 / options.fps;
  const digests = [];

  let previousDigest = null;
  let distinctFrames = 0;
  let repeatedFrames = 0;
  let lastProgressAtMs = 0;

  for (let frame = 1; frame <= frameCount; frame += 1) {
    const stepped = await page.evaluate((dt) => globalThis.__SUGATA_STEP__(dt), deltaSeconds);

    if (stepped !== true) {
      throw new Error(`__SUGATA_STEP__ refused at frame ${frame} — the figure is not loaded.`);
    }

    const png = await page.screenshot({ timeout: SCREENSHOT_TIMEOUT_MS });
    if (framesDirectory !== null) {
      fs.writeFileSync(path.join(framesDirectory, frameFileName(frame)), png);
    }

    const digest = crypto.createHash('sha256').update(png).digest('hex');
    digests.push(digest);

    if (digest === previousDigest) repeatedFrames += 1;
    else distinctFrames += 1;
    previousDigest = digest;

    if (quiet !== true && (Date.now() - lastProgressAtMs > 2000 || frame === frameCount)) {
      lastProgressAtMs = Date.now();
      process.stdout.write(
        `\r  frame ${String(frame).padStart(5)}/${frameCount}   ` +
          `sim ${(frame * deltaSeconds).toFixed(2)} s   distinct ${distinctFrames}   `
      );
    }
  }

  if (quiet !== true) process.stdout.write('\n');

  await context.close();

  return {
    environment,
    frameCount,
    deltaSeconds,
    digests,
    distinctFrames,
    repeatedFrames,
    pageErrors,
    // One number that identifies the whole run. Two captures with the same sequence digest are
    // byte-identical, which is the property that makes a critic loop's before/after meaningful.
    sequenceDigest: crypto.createHash('sha256').update(digests.join('')).digest('hex'),
  };
}

/**
 * Reloads the page from scratch and replays the opening frames, then compares them against what
 * the real capture produced.
 *
 * This is here because "deterministic" was a claim before it was a measurement, and every time it
 * was measured it found something: a compositor race that returned the previous frame, three's
 * node clock reading `performance.now()`, and a frozen-skinning bug that made a still image score
 * a perfect result. None of those were visible by looking at the video.
 *
 * A clean plate (?bare) now replays identically, 600/600. The instrumented page never will — the
 * HUD's `stats.frameMs` is a wall-clock number living in the pixels. Both facts are reported
 * rather than assumed, so the day a clean plate stops reproducing, something real has changed.
 */
async function verifyReproducibility(browser, pageUrl, options, capture) {
  const frameCount = Math.min(options.verifyFrames, capture.frameCount);

  process.stdout.write(`verify    replaying the first ${frameCount} frames… `);

  const replay = await driveCapture(browser, pageUrl, options, {
    frameCount,
    framesDirectory: null,
    quiet: true,
  });

  let matched = 0;
  for (let index = 0; index < frameCount; index += 1) {
    if (replay.digests[index] === capture.digests[index]) matched += 1;
    else break;
  }

  const identical = matched === frameCount;
  console.log(identical ? `identical (${matched}/${frameCount})` : `DIVERGED at frame ${matched + 1}`);

  if (identical === false) {
    console.log('          expected when the HUD is visible — it prints a wall-clock ms figure.');
    console.log('          Capture with ?bare for a sequence digest that means something.');
  }

  return { framesReplayed: frameCount, framesMatched: matched, byteReproducible: identical };
}

/**
 * Asks the page what it actually is, rather than what we asked it to be. The backend is read
 * back off the renderer (Stage does the same), and the adapter is re-requested so a software
 * rasteriser cannot masquerade as a GPU capture.
 *
 * Deliberately absent: draw calls, triangle count and fps. Stage assigns those inside its rAF
 * callback, which ?capture detaches, so under capture they are frozen at whatever the last
 * pre-load frame saw — 2 draws and 3 triangles, which is the backdrop and nothing else. A stale
 * number in a manifest is worse than a missing one, because the missing one gets asked about.
 */
async function readEnvironment(page) {
  return page.evaluate(async () => {
    const stats = globalThis.sugata?.stage?.stats ?? null;

    let adapter = null;
    if (navigator.gpu !== undefined) {
      const gpuAdapter = await navigator.gpu.requestAdapter().catch(() => null);
      if (gpuAdapter !== null && gpuAdapter.info !== undefined) {
        adapter = {
          vendor: gpuAdapter.info.vendor,
          architecture: gpuAdapter.info.architecture,
          device: gpuAdapter.info.device,
          description: gpuAdapter.info.description,
        };
      }
    }

    return {
      backend: stats?.backend ?? 'unknown',
      devicePixelRatio: window.devicePixelRatio,
      rendererPixelRatio: stats?.dpr ?? null,
      hasWebGpu: navigator.gpu !== undefined,
      adapter,
      userAgent: navigator.userAgent,
    };
  });
}

/** Says plainly what backend came up. A silent WebGL2 fallback invalidates any look judgement. */
function reportBackend(environment, pageUrl) {
  const adapter = environment.adapter;
  const adapterText = adapter === null
    ? 'adapter info unavailable'
    : `${adapter.vendor || '?'} ${adapter.architecture || ''} ${adapter.description || ''}`.trim();

  console.log(`backend   ${environment.backend}   (${adapterText})`);

  if (environment.backend === 'webgpu') {
    if (/swiftshader|llvmpipe|software/i.test(adapterText)) {
      console.warn('\n*** SOFTWARE RASTERISER. The pixels are WebGPU but not from a real GPU.');
    }
    return;
  }

  if (/[?&]webgl\b/.test(pageUrl)) {
    console.log('          (the URL asked for the WebGL2 tier, so this is expected)');
    return;
  }

  console.warn('\n*** BACKEND IS NOT WEBGPU. The page fell back to ' + environment.backend + '.');
  console.warn('*** These frames are the fallback tier, not the tier the look spec targets.');
  console.warn('*** Do not present them as a WebGPU capture.');
}

// --- encoding ---------------------------------------------------------------------------------

/**
 * h264 for scrubbing. yuv420p and even dimensions are what make the file playable in QuickTime
 * and in a browser at all — 4:2:0 chroma cannot represent an odd number of pixels, so an odd
 * height silently produces a file some players refuse.
 */
async function encodeMp4(framesDirectory, outputPath, options) {
  await runFfmpeg('mp4', [
    '-y',
    '-framerate', String(options.fps),
    '-start_number', '1',
    '-i', path.join(framesDirectory, 'frame-%05d.png'),
    '-vf', 'pad=ceil(iw/2)*2:ceil(ih/2)*2',
    '-c:v', 'libx264',
    '-preset', 'slow',
    '-crf', '16',
    '-pix_fmt', 'yuv420p',
    '-movflags', '+faststart',
    '-r', String(options.fps),
    outputPath,
  ]);
}

/**
 * Two passes, because a GIF has 256 colours and the default web-safe palette destroys skin: a
 * face becomes visible contour bands. palettegen with stats_mode=diff builds the palette from
 * what actually CHANGES between frames, which on an idle avatar is the face, so the palette is
 * spent on the pixels being judged rather than on the backdrop.
 */
async function encodeGif(framesDirectory, outputPath, options) {
  const palettePath = path.join(path.dirname(outputPath), '.palette.png');
  const scale = `fps=${options.gifFps},scale=${options.gifWidth}:-2:flags=lanczos`;

  await runFfmpeg('gif palette', [
    '-y',
    '-framerate', String(options.fps),
    '-start_number', '1',
    '-i', path.join(framesDirectory, 'frame-%05d.png'),
    '-vf', `${scale},palettegen=stats_mode=diff`,
    palettePath,
  ]);

  await runFfmpeg('gif', [
    '-y',
    '-framerate', String(options.fps),
    '-start_number', '1',
    '-i', path.join(framesDirectory, 'frame-%05d.png'),
    '-i', palettePath,
    '-lavfi', `${scale}[x];[x][1:v]paletteuse=dither=bayer:bayer_scale=5:diff_mode=rectangle`,
    '-loop', '0',
    outputPath,
  ]);

  fs.rmSync(palettePath, { force: true });
}

/**
 * A montage of evenly-spaced frames, time-stamped, as one PNG.
 *
 * This exists because a reviewer — human or agent — that cannot play a video can still read a
 * contact sheet, and because a sheet answers "did anything change at all?" at a glance in a way
 * a 600-frame directory does not.
 *
 * @returns {Array<{frame: number, videoTimeSeconds: number}>} what each cell shows, in order.
 */
async function buildContactSheet(framesDirectory, outputPath, capture, options) {
  const cellCount = Math.min(options.sheetCells, capture.frameCount);
  const columns = Math.min(options.sheetColumns, cellCount);
  const rows = Math.ceil(cellCount / columns);

  const cells = [];
  const stagingDirectory = path.join(framesDirectory, '.sheet');
  fs.rmSync(stagingDirectory, { recursive: true, force: true });
  fs.mkdirSync(stagingDirectory, { recursive: true });

  for (let cell = 0; cell < cellCount; cell += 1) {
    const frame = cellCount === 1
      ? 1
      : 1 + Math.round((cell * (capture.frameCount - 1)) / (cellCount - 1));

    fs.copyFileSync(
      path.join(framesDirectory, frameFileName(frame)),
      path.join(stagingDirectory, `cell-${String(cell + 1).padStart(4, '0')}.png`)
    );

    cells.push({ frame, videoTimeSeconds: (frame - 1) / options.fps });
  }

  const cellWidth = evenNumber(options.sheetCellWidth);
  const cellHeight = evenNumber(Math.round((cellWidth * options.height) / options.width));

  await runFfmpeg('contact sheet', [
    '-y',
    '-framerate', '1',
    '-start_number', '1',
    '-i', path.join(stagingDirectory, 'cell-%04d.png'),
    '-frames:v', '1',
    '-vf',
    `scale=${cellWidth}:${cellHeight},tile=${columns}x${rows}` +
      `:margin=${SHEET_MARGIN}:padding=${SHEET_PADDING}:color=${SHEET_BACKGROUND}`,
    outputPath,
  ]);

  stampContactSheet(outputPath, cells, { columns, cellWidth, cellHeight });

  fs.rmSync(stagingDirectory, { recursive: true, force: true });

  return cells;
}

/**
 * Burns "f<frame> <time>s" into the corner of every cell.
 *
 * ffmpeg's drawtext filter needs a libfreetype build and this machine's does not have one, so
 * the label is drawn here instead, straight into the decoded pixels with the repo's own PNG
 * codec and the small bitmap font below. The alternative — an unlabelled sheet — makes a
 * reviewer guess which cell is which, and guessing is the thing this whole harness exists to
 * remove.
 */
function stampContactSheet(sheetPath, cells, layout) {
  const image = decodePng(fs.readFileSync(sheetPath));
  const bytes = new Uint8Array(image.width * image.height * 4);

  for (let index = 0; index < bytes.length; index += 1) {
    bytes[index] = Math.round(Math.min(1, Math.max(0, image.pixels[index])) * 255);
  }

  const scale = Math.max(2, Math.round(layout.cellWidth / 220));

  cells.forEach((cell, index) => {
    const column = index % layout.columns;
    const row = Math.floor(index / layout.columns);

    const x = SHEET_MARGIN + column * (layout.cellWidth + SHEET_PADDING);
    const y = SHEET_MARGIN + row * (layout.cellHeight + SHEET_PADDING);

    drawLabel(
      bytes,
      image.width,
      image.height,
      x + 4,
      y + 4,
      `f${cell.frame} ${cell.videoTimeSeconds.toFixed(2)}s`,
      scale
    );
  });

  fs.writeFileSync(sheetPath, encodePng(image.width, image.height, bytes));
}

// --- the label font ----------------------------------------------------------------------------
//
// 5x7 pixels per glyph, one row per string. Only the characters a time stamp uses are here; add
// more the day something else needs drawing, not before.

const GLYPHS = {
  '0': '01110 10001 10011 10101 11001 10001 01110',
  '1': '00100 01100 00100 00100 00100 00100 01110',
  '2': '01110 10001 00001 00010 00100 01000 11111',
  '3': '11111 00010 00100 00010 00001 10001 01110',
  '4': '00010 00110 01010 10010 11111 00010 00010',
  '5': '11111 10000 11110 00001 00001 10001 01110',
  '6': '00110 01000 10000 11110 10001 10001 01110',
  '7': '11111 00001 00010 00100 01000 01000 01000',
  '8': '01110 10001 10001 01110 10001 10001 01110',
  '9': '01110 10001 10001 01111 00001 00010 01100',
  '.': '00000 00000 00000 00000 00000 01100 01100',
  'f': '00110 01001 01000 11110 01000 01000 01000',
  's': '00000 00000 01111 10000 01110 00001 11110',
  ' ': '00000 00000 00000 00000 00000 00000 00000',
};

const GLYPH_WIDTH = 5;
const GLYPH_HEIGHT = 7;

/** Draws `text` in white on a dark plate, so it stays readable over both hair and backdrop. */
function drawLabel(bytes, imageWidth, imageHeight, left, top, text, scale) {
  const padding = 3;
  const textWidth = text.length * (GLYPH_WIDTH + 1) * scale;
  const textHeight = GLYPH_HEIGHT * scale;

  fillRect(bytes, imageWidth, imageHeight,
    left - padding, top - padding,
    textWidth + padding * 2, textHeight + padding * 2,
    [0, 0, 0, 200]);

  let penX = left;

  for (const character of text) {
    const glyph = GLYPHS[character] ?? GLYPHS[' '];
    const rows = glyph.split(' ');

    for (let row = 0; row < GLYPH_HEIGHT; row += 1) {
      for (let column = 0; column < GLYPH_WIDTH; column += 1) {
        if (rows[row][column] !== '1') continue;

        fillRect(bytes, imageWidth, imageHeight,
          penX + column * scale, top + row * scale, scale, scale,
          [255, 255, 255, 255]);
      }
    }

    penX += (GLYPH_WIDTH + 1) * scale;
  }
}

/** Alpha-composites a solid rect over the image, clipped to it. */
function fillRect(bytes, imageWidth, imageHeight, left, top, width, height, [r, g, b, a]) {
  const x0 = Math.max(0, Math.round(left));
  const y0 = Math.max(0, Math.round(top));
  const x1 = Math.min(imageWidth, Math.round(left + width));
  const y1 = Math.min(imageHeight, Math.round(top + height));
  const alpha = a / 255;

  for (let y = y0; y < y1; y += 1) {
    for (let x = x0; x < x1; x += 1) {
      const index = (y * imageWidth + x) * 4;
      bytes[index] = Math.round(bytes[index] * (1 - alpha) + r * alpha);
      bytes[index + 1] = Math.round(bytes[index + 1] * (1 - alpha) + g * alpha);
      bytes[index + 2] = Math.round(bytes[index + 2] * (1 - alpha) + b * alpha);
      bytes[index + 3] = 255;
    }
  }
}

// --- plumbing -----------------------------------------------------------------------------------

function frameCountOf(options) {
  return Math.max(1, Math.round(options.seconds * options.fps));
}

function frameFileName(frame) {
  return `frame-${String(frame).padStart(5, '0')}.png`;
}

function evenNumber(value) {
  return value % 2 === 0 ? value : value + 1;
}

/**
 * Adds the parameters a capture needs without discarding anything the caller put in the URL —
 * ?bare, ?webgl, ?gender and ?height are all legitimate things to capture, and clobbering them
 * would make the tool quietly capture something other than what was asked for.
 */
/**
 * Whether this run should bring up its own vite. A bare path — `/alive.html?bare&frame=body` —
 * means "that page, on a server of your own", which is the only way to get both a custom query
 * and the un-watched server below.
 */
function wantsOwnServer(options) {
  return options.url === null || options.url.startsWith('/');
}

function buildPageUrl(options, server, seed) {
  const url = server === null
    ? new URL(options.url)
    : new URL(options.url ?? '/alive.html', server.baseUrl);

  url.searchParams.set('capture', '1');
  if (seed !== null) url.searchParams.set('seed', String(seed));
  if (options.preroll > 0) url.searchParams.set('preroll', String(options.preroll));

  return url.href;
}

async function launchBrowser(playwright, options) {
  const attempts = options.headed ? [false] : [true, false];

  for (const headless of attempts) {
    try {
      const browser = await playwright.chromium.launch({
        channel: 'chromium', // the real browser — headless_shell has no GPU and no WebGPU
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

async function startViteServer() {
  const { createServer } = await import('vite');

  // 🚩 THE WATCHER IS OFF, AND THAT IS THE POINT. LEARNINGS §1.12: a concurrent agent's file edit
  // fires HMR, the page navigates, and Playwright dies with "Execution context was destroyed" —
  // measured again while this option was being written, at frame 64 of 1800. A capture is a
  // MEASUREMENT of one build; picking up an edit halfway through would corrupt it even if the
  // reload were survivable. So the server this tool starts serves the tree as it stood at launch
  // and ignores everything after. Long captures no longer have to be scheduled around a fan-out.
  const server = await createServer({
    configFile: path.join(REPOSITORY_ROOT, 'vite.config.js'),
    server: {
      port: 5188,
      strictPort: false,
      hmr: false,
      watch: { ignored: [ '**' ] },
    },
    logLevel: 'warn',
  });

  await server.listen();
  server.baseUrl = server.resolvedUrls.local[0].replace(/\/$/, '');
  console.log(`vite      ${server.baseUrl} (started by capture.mjs)`);

  return server;
}

/**
 * Playwright is deliberately not a dependency of this repo — capture is a development
 * instrument, not part of the build — so it is looked up wherever it happens to live,
 * including npx's cache, which is where `npx playwright` leaves it.
 */
async function loadPlaywright(explicitPath) {
  const candidates = [];

  if (explicitPath) candidates.push(explicitPath);
  if (process.env.PLAYWRIGHT_MODULE) candidates.push(process.env.PLAYWRIGHT_MODULE);
  candidates.push('playwright');
  candidates.push(...findPlaywrightInNpxCache());

  const require = createRequire(import.meta.url);

  for (const candidate of candidates) {
    try {
      const resolved = require.resolve(candidate);
      return unwrapCommonJs(await import(pathToFileURL(resolved).href));
    } catch {
      // try the next candidate; the error only matters if they all fail
    }
  }

  throw new Error(
    'playwright not resolvable. Install it somewhere and pass --playwright <path>, e.g.\n' +
      '  npm i --prefix /tmp/pw playwright\n' +
      '  npx --prefix /tmp/pw playwright install chromium\n' +
      '  node tools/critic/capture.mjs --playwright /tmp/pw/node_modules/playwright ...'
  );
}

function findPlaywrightInNpxCache() {
  const cache = path.join(process.env.HOME ?? '', '.npm', '_npx');
  if (fs.existsSync(cache) === false) return [];

  return fs
    .readdirSync(cache)
    .map((entry) => path.join(cache, entry, 'node_modules', 'playwright'))
    .filter((candidate) => fs.existsSync(candidate));
}

/** playwright is CommonJS; importing it from ESM parks the real exports under `default`. */
function unwrapCommonJs(namespace) {
  if (namespace && namespace.chromium) return namespace;
  if (namespace && namespace.default && namespace.default.chromium) return namespace.default;
  return namespace;
}

function requireFfmpeg() {
  if (fs.existsSync(FFMPEG)) return;

  throw new Error(
    `ffmpeg not found at ${FFMPEG}. Install it (brew install ffmpeg) or set FFMPEG=<path>.`
  );
}

function runFfmpeg(label, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(FFMPEG, ['-hide_banner', '-loglevel', 'error', ...args]);
    const stderr = [];

    child.stderr.on('data', (chunk) => stderr.push(chunk));
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) {
        console.log(`ffmpeg    ${label} ok`);
        resolve();
        return;
      }
      reject(new Error(`ffmpeg ${label} exited ${code}:\n${Buffer.concat(stderr).toString()}`));
    });
  });
}

function buildManifest({ options, seed, pageUrl, capture, reproducibility, posturalContent, sheetCells, elapsedSeconds, outputs }) {
  return {
    tool: 'tools/critic/capture.mjs',
    capturedAt: new Date().toISOString(),
    url: pageUrl,
    seed,
    // What the clip is known to contain, so a later reader of this manifest does not have to
    // reconstruct from the seed whether the judgement it supported was entitled to be made.
    posturalContent,
    prerollSeconds: options.preroll,
    simulation: {
      fps: options.fps,
      stepSeconds: capture.deltaSeconds,
      frameCount: capture.frameCount,
      simulatedSeconds: capture.frameCount * capture.deltaSeconds,
    },
    resolution: {
      cssWidth: options.width,
      cssHeight: options.height,
      devicePixelRatio: options.dpr,
      pixelWidth: options.width * options.dpr,
      pixelHeight: options.height * options.dpr,
    },
    environment: capture.environment,
    determinism: {
      sequenceDigest: capture.sequenceDigest,
      distinctFrames: capture.distinctFrames,
      repeatedConsecutiveFrames: capture.repeatedFrames,
      // Measured by replaying the opening frames from a fresh page load, not assumed.
      // See verifyReproducibility() for why an instrumented page cannot come back identical.
      reproducibility,
      frameDigests: capture.digests,
    },
    contactSheet: sheetCells,
    pageErrors: capture.pageErrors,
    outputs: {
      mp4: path.relative(REPOSITORY_ROOT, outputs.mp4),
      gif: path.relative(REPOSITORY_ROOT, outputs.gif),
      contactSheet: path.relative(REPOSITORY_ROOT, outputs.contactSheet),
    },
    wallClockSeconds: Number(elapsedSeconds.toFixed(1)),
  };
}

function printSummary(manifest, outputDirectory, options) {
  const simulated = manifest.simulation.simulatedSeconds;

  console.log('');
  console.log(`simulated ${simulated.toFixed(3)} s in ${manifest.simulation.frameCount} frames ` +
    `of ${manifest.simulation.stepSeconds.toFixed(5)} s`);
  console.log(`wall      ${manifest.wallClockSeconds.toFixed(1)} s ` +
    `(${(manifest.wallClockSeconds / simulated).toFixed(1)}x slower than real time — irrelevant, ` +
    'the output is exact either way)');
  console.log(`frames    ${manifest.determinism.distinctFrames} distinct, ` +
    `${manifest.determinism.repeatedConsecutiveFrames} repeated`);
  console.log(`digest    ${manifest.determinism.sequenceDigest.slice(0, 16)}   ` +
    describeReproducibility(manifest.determinism.reproducibility));

  if (manifest.pageErrors.length > 0) {
    console.log(`page errors:\n  ${manifest.pageErrors.slice(0, 5).join('\n  ')}`);
  }

  console.log('');
  for (const [name, filePath] of Object.entries(manifest.outputs)) {
    const absolute = path.join(REPOSITORY_ROOT, filePath);
    console.log(`  ${name.padEnd(13)} ${absolute}  ${describeSize(absolute)}`);
  }
  console.log(`  ${'manifest'.padEnd(13)} ${path.join(outputDirectory, 'capture.json')}`);
  if (options.keepFrames) console.log(`  ${'frames'.padEnd(13)} ${path.join(outputDirectory, 'frames')}`);
}

function describeReproducibility(reproducibility) {
  if (reproducibility === null) return '(reproducibility not checked)';

  return reproducibility.byteReproducible
    ? `(byte-reproducible: verified over ${reproducibility.framesReplayed} frames)`
    : `(NOT byte-reproducible: replay diverged at frame ${reproducibility.framesMatched + 1})`;
}

function describeSize(filePath) {
  if (fs.existsSync(filePath) === false) return '(missing)';
  const bytes = fs.statSync(filePath).size;
  return bytes > 1024 * 1024
    ? `${(bytes / 1024 / 1024).toFixed(1)} MB`
    : `${(bytes / 1024).toFixed(0)} KB`;
}

function parseArguments(argv) {
  const options = {
    url: null,
    out: path.join('captures', 'capture'),
    // Always a list, even when it holds one entry, and `[null]` when the page keeps its own seed.
    // Judging one draw was the defect; the plural is the point.
    seeds: [null],
    requireWeightShift: false,
    playwrightPath: null,
    headed: false,
    keepFrames: false,
    ...DEFAULTS,
  };

  // Applied after the loop rather than inside it, so that --postural-seeds means the same thing
  // wherever it appears on the command line instead of depending on what came after it.
  let posturalSet = false;

  for (let index = 0; index < argv.length; index += 1) {
    const flag = argv[index];
    const value = argv[index + 1];

    switch (flag) {
      case '--url': options.url = value; index += 1; break;
      case '--out': options.out = value; index += 1; break;
      case '--seconds': options.seconds = Number(value); index += 1; break;
      case '--fps': options.fps = Number(value); index += 1; break;
      case '--width': options.width = Number(value); index += 1; break;
      case '--height': options.height = Number(value); index += 1; break;
      case '--dpr': options.dpr = Number(value); index += 1; break;
      case '--seed': case '--seeds': options.seeds = parseSeedList(value); index += 1; break;
      case '--postural-seeds': posturalSet = true; break;
      case '--require-weight-shift': options.requireWeightShift = true; break;
      case '--preroll': options.preroll = Number(value); index += 1; break;
      case '--gif-fps': options.gifFps = Number(value); index += 1; break;
      case '--gif-width': options.gifWidth = Number(value); index += 1; break;
      case '--sheet-cells': options.sheetCells = Number(value); index += 1; break;
      case '--sheet-columns': options.sheetColumns = Number(value); index += 1; break;
      case '--verify-frames': options.verifyFrames = Number(value); index += 1; break;
      case '--skip-verify': options.verifyFrames = 0; break;
      case '--playwright': options.playwrightPath = value; index += 1; break;
      case '--headed': options.headed = true; break;
      case '--keep-frames': options.keepFrames = true; break;
      case '--help': case '-h': printUsage(); process.exit(0); break;
      default: throw new Error(`unknown option "${flag}". Try --help.`);
    }
  }

  if (posturalSet) {
    options.seeds = POSTURAL_JUDGEMENT_SEEDS.map((entry) => entry.seed);
    options.seconds = POSTURAL_CLIP_SECONDS;
    options.requireWeightShift = true;
  }

  if (Number.isFinite(options.seconds) === false || options.seconds <= 0) {
    throw new Error('--seconds must be a positive number.');
  }
  if (Number.isFinite(options.fps) === false || options.fps <= 0) {
    throw new Error('--fps must be a positive number.');
  }

  return options;
}

/** `--seed 1` and `--seed 4242,42,20260807` are the same flag; one clip comes out per entry. */
function parseSeedList(value) {
  const seeds = String(value ?? '')
    .split(',')
    .map((part) => part.trim())
    .filter((part) => part.length > 0)
    .map(Number);

  if (seeds.length === 0 || seeds.some((seed) => Number.isFinite(seed) === false)) {
    throw new Error(`--seed wants a number or a comma-separated list of numbers, not "${value}".`);
  }

  if (new Set(seeds).size !== seeds.length) {
    throw new Error(`--seed "${value}" repeats a seed; each one would overwrite the last.`);
  }

  return seeds;
}

function printUsage() {
  console.log(`
capture.mjs — deterministic video capture of a live Sugata page.

  node tools/critic/capture.mjs [options]

  --url <url>          page to drive. Default: start vite and use /alive.html.
                       A bare PATH (/alive.html?bare&frame=body) starts vite here too, on a
                       server with the file watcher OFF — a concurrent edit cannot kill it.
  --out <dir>          output directory                     (captures/capture)
  --seconds <n>        simulated seconds to capture         (${DEFAULTS.seconds})
  --fps <n>            frames per simulated second          (${DEFAULTS.fps})
  --width <px>         CSS viewport width                   (${DEFAULTS.width})
  --height <px>        CSS viewport height                  (${DEFAULTS.height})
  --dpr <n>            device pixel ratio; 2 doubles output (${DEFAULTS.dpr})
  --seed <n[,n...]>    motion stack seed(s). Default: the page's own. A list captures one
                       clip per seed into <out>/seed-<n>/ — judge more than one draw.
  --postural-seeds     the measured weight-transfer set: seeds ${POSTURAL_JUDGEMENT_SEEDS.map((entry) => entry.seed).join(', ')}
                       at ${POSTURAL_CLIP_SECONDS} s, with --require-weight-shift
  --require-weight-shift
                       exit 1 unless every clip is KNOWN to contain a sustained weight
                       transfer. Seeds with none measured in ${POSTURAL_CLIP_SECONDS} s: ${POSTURAL_EMPTY_SEEDS.map((entry) => entry.seed).join(', ')}
  --preroll <s>        settle the stack this long before frame 1  (${DEFAULTS.preroll})
  --gif-fps <n>        gif frame rate                       (${DEFAULTS.gifFps})
  --gif-width <px>     gif width                            (${DEFAULTS.gifWidth})
  --sheet-cells <n>    frames on the contact sheet          (${DEFAULTS.sheetCells})
  --sheet-columns <n>  contact sheet columns                (${DEFAULTS.sheetColumns})
  --verify-frames <n>  replay this many frames to prove reproducibility (${DEFAULTS.verifyFrames})
  --skip-verify        do not replay
  --keep-frames        keep the PNG sequence
  --headed             run Chromium headed
  --playwright <path>  path to a playwright installation
`);
}
