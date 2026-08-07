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
// Usage:
//   node tools/critic/capture.mjs --url http://localhost:5173/alive.html \
//        --seconds 20 --fps 30 --width 1080 --height 1350 --seed 1 --out captures/idle
//
// With no --url it starts vite itself and drives /alive.html.
//
// Exit codes follow measure.mjs, so a calling script can tell a bad capture from a broken tool:
//   0 = capture written, frames genuinely differ
//   1 = the capture is not usable — every frame identical, i.e. the stepping hook did nothing
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

main().catch((error) => {
  console.error(`\ncapture.mjs failed: ${error.message}`);
  if (process.env.DEBUG) console.error(error.stack);
  process.exitCode = 2;
});

async function main() {
  const options = parseArguments(process.argv.slice(2));

  requireFfmpeg();

  const outputDirectory = path.resolve(options.out);
  const framesDirectory = path.join(outputDirectory, 'frames');
  fs.mkdirSync(framesDirectory, { recursive: true });

  const playwright = await loadPlaywright(options.playwrightPath);
  const server = options.url === null ? await startViteServer() : null;
  const pageUrl = buildPageUrl(options, server);

  console.log(`page      ${pageUrl}`);
  console.log(`capture   ${options.seconds} s @ ${options.fps} fps = ${frameCountOf(options)} frames` +
    `   ${options.width}x${options.height} @ dpr ${options.dpr}`);

  const browser = await launchBrowser(playwright, options);
  const startedAtMs = Date.now();

  let capture = null;
  let reproducibility = null;

  try {
    capture = await driveCapture(browser, pageUrl, options, {
      frameCount: frameCountOf(options),
      framesDirectory,
      quiet: false,
    });

    reportBackend(capture.environment, pageUrl);

    if (options.verifyFrames > 0) {
      reproducibility = await verifyReproducibility(browser, pageUrl, options, capture);
    }
  } finally {
    await browser.close();
    if (server !== null) await server.close();
  }

  const mp4Path = path.join(outputDirectory, 'capture.mp4');
  const gifPath = path.join(outputDirectory, 'capture.gif');
  const sheetPath = path.join(outputDirectory, 'contact-sheet.png');

  await encodeMp4(framesDirectory, mp4Path, options);
  await encodeGif(framesDirectory, gifPath, options);
  const sheetCells = await buildContactSheet(framesDirectory, sheetPath, capture, options);

  const manifest = buildManifest({
    options,
    pageUrl,
    capture,
    reproducibility,
    sheetCells,
    elapsedSeconds: (Date.now() - startedAtMs) / 1000,
    outputs: { mp4: mp4Path, gif: gifPath, contactSheet: sheetPath },
  });

  fs.writeFileSync(path.join(outputDirectory, 'capture.json'), JSON.stringify(manifest, null, 2) + '\n');

  if (options.keepFrames === false) fs.rmSync(framesDirectory, { recursive: true, force: true });

  printSummary(manifest, outputDirectory, options);

  // A capture where nothing moved is worse than no capture: it looks like evidence and is not.
  if (capture.distinctFrames <= 1) {
    console.error('\n*** EVERY FRAME IS IDENTICAL. The stepping hook did nothing — this capture is');
    console.error('*** not evidence of anything. Check that the page exposes window.__SUGATA_STEP__');
    console.error('*** and that ?capture is in the URL.');
    process.exitCode = 1;
  }
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
function buildPageUrl(options, server) {
  const url = new URL(options.url ?? `${server.baseUrl}/alive.html`);

  url.searchParams.set('capture', '1');
  if (options.seed !== null) url.searchParams.set('seed', String(options.seed));
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

  const server = await createServer({
    configFile: path.join(REPOSITORY_ROOT, 'vite.config.js'),
    server: { port: 5188, strictPort: false },
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

function buildManifest({ options, pageUrl, capture, reproducibility, sheetCells, elapsedSeconds, outputs }) {
  return {
    tool: 'tools/critic/capture.mjs',
    capturedAt: new Date().toISOString(),
    url: pageUrl,
    seed: options.seed,
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
    seed: null,
    playwrightPath: null,
    headed: false,
    keepFrames: false,
    ...DEFAULTS,
  };

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
      case '--seed': options.seed = Number(value); index += 1; break;
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

  if (Number.isFinite(options.seconds) === false || options.seconds <= 0) {
    throw new Error('--seconds must be a positive number.');
  }
  if (Number.isFinite(options.fps) === false || options.fps <= 0) {
    throw new Error('--fps must be a positive number.');
  }

  return options;
}

function printUsage() {
  console.log(`
capture.mjs — deterministic video capture of a live Sugata page.

  node tools/critic/capture.mjs [options]

  --url <url>          page to drive. Default: start vite and use /alive.html
  --out <dir>          output directory                     (captures/capture)
  --seconds <n>        simulated seconds to capture         (${DEFAULTS.seconds})
  --fps <n>            frames per simulated second          (${DEFAULTS.fps})
  --width <px>         CSS viewport width                   (${DEFAULTS.width})
  --height <px>        CSS viewport height                  (${DEFAULTS.height})
  --dpr <n>            device pixel ratio; 2 doubles output (${DEFAULTS.dpr})
  --seed <n>           motion stack seed. Default: the page's own
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
