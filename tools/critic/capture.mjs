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
//   - reproducible, and the tool now says HOW reproducible rather than answering yes/no.
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
// 🚩 AND THE CHECK ITSELF WAS A FALSE-NEGATIVE GENERATOR UNTIL IT WAS MEASURED. It compared
// SHA-256 digests, which is a boolean over a GPU render's last code value, and it reported "NOT
// byte-reproducible" on a clean plate at random — 8 of 10 runs of the same seed, diverging at
// frames 8, 11, 14, 15, 21, 21, 22 and 24. A flaky check on the observation instrument poisons
// everything downstream, so the residue was measured instead of argued about. Six independent
// browser processes, `/alive.html?bare&frame=body`, 350×600, seed 1, 30 frames, decoded and
// differenced pixel by pixel:
//
//   | plate                        | frames bit-identical | worst frame                        |
//   |------------------------------|---------------------|------------------------------------|
//   | as shipped                   | 29 of 30            | 44 px of 210,000 (0.021%), Δ ≤ 3/255 |
//   | `?msaa=0`                    | 29 of 30            | 1 px, Δ = 1/255                     |
//   | `?cards=0`                   | **30 of 30**        | —                                   |
//
// So the render is deterministic to within an alpha-to-coverage resolve on the two hair cards,
// and the digest was reporting that dust as a determinism failure.
//
// 🚩 THAT ATTRIBUTION IS A PROPERTY OF THE FRAMING IT WAS TAKEN AT — 350×600 on the MSAA-era
// default — and it is NARROWED AT 3840. Re-measured at 3840×5120 on today's shipped default over
// 103 loads in seven runs there are TWO residues and the cards are the smaller: the TAAU path
// leaves 671 of 1053 pairs bit-identical (worst Δ2/255 on 164 px of 19,660,800) while
// `?aa=msaa&grade=0`, which still has the cards and still has alpha-to-coverage, leaves none —
// 290 of 290 over 45 loads. The tolerance block below carries the full runs under the same
// literal token NARROWED AT 3840, so the two cannot be updated one at a time again; `cd2e567`
// corrected the block and not this header, in the same file, in the same commit.
//
// The check now compares DECODED
// PIXELS against a stated tolerance and reports the magnitude either way; the bit-identical frame
// count survives as a reported fact rather than as the verdict. LEARNINGS §1.14 is the same shape
// one level up: a floor and a measurement must be the same KIND of statistic, and "are these two
// files the same bytes" was never the same kind of question as "is this render deterministic".
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
//   node tools/critic/capture.mjs --plate --steps 60 --fps 60 --width 3840 --height 5120 \
//        --seed 1 --url '/alive.html?bare&freeze&seed=1' --out captures/plate-default
//     ^ ONE STILL, taken three times from three fresh page loads, with the residue between them
//       measured. This is what a ```plates row in PUNCHLIST is, and see the block below for why
//       it is not a clip with the other 59 frames deleted.
//
// With no --url it starts vite itself and drives /alive.html.
//
// 🎯 --- "FRAMES GENUINELY DIFFER" WAS NEVER A TEST THAT THE PICTURE MOVED -----------------------
//
// This tool's liveness check was `distinctFrames <= 1`. The shipped page reseeds a film grain from
// `frameId` on every frame, so no two frames of it are ever byte-identical, whatever the figure is
// doing. Measured on 2026-08-08, same build, same seed, same session, one flag apart:
//
//     /alive.html?bare&frame=body&freeze     150 distinct, 0 repeated   0.000% of blocks moved
//     /alive.html?bare&frame=body            150 distinct, 0 repeated   8.864% of blocks moved
//
// Identical on the old statistic. The first clip is a figure standing perfectly still — `?freeze`
// at `?aa=msaa&grade=0` renders 1 distinct frame and 599 repeats, which is the control proving the
// flag really does freeze — and this tool handed it to judges as a 20-second clip of a living
// body. Every downstream reading of that clip inherited the error.
//
// The manifest now carries a `liveness` block beside `determinism`, and the distinction between
// them is the whole finding: **`determinism.distinctFrames` is a statement about BYTES and
// `liveness.movingBlockShare` is a statement about the PICTURE.** The second is heatmap.mjs's
// statistic, imported rather than reimplemented, and a clip that fails it exits 1.
//
// 🚩 --- A PLATE IS NOT A CLIP, AND UNTIL `--plate` THIS TOOL COULD ONLY MAKE CLIPS ------------
//
// Most of what this repository measures is a STILL: one frame, at a stated step count, at a
// stated width, whose sha256 is quoted as the identity of a configuration. PUNCHLIST's ```plates
// fence is a table of them. There was no way to take one. What people did instead was run a clip
// with --keep-frames and hash the last file in `frames/`, which has three consequences and all
// three bit:
//
//   1. it costs 60 screenshots of a 19.6 MP frame to keep one — measured at 363 s per plate on
//      this machine, which is why plates get taken once and their reproducibility asserted;
//   2. `verifyReproducibility` replays the FIRST --verify-frames frames (default 20) of 60, so
//      the one frame the plate is read off is the one frame the determinism check never sees.
//      A determinism check that reads the opening window cannot see a divergence at frame 60,
//      exactly as a liveness check that reads seven frames cannot see a freeze at frame 16;
//   3. the residue therefore never gets measured at plate width at all, and the claim written
//      down is the strongest one the evidence appears to allow — "one PNG, all three times".
//
// Measured at 3840×5120 (see the PLATE RESIDUE block above `capturePlate`): that claim is not
// true, and the tool's own header has said since it was written that `sha256(a) === sha256(b)`
// is the wrong verdict for a GPU render. `--plate` steps to the plate frame, screenshots only
// that frame, replays the whole thing from N fresh page loads, and reports the residue as a
// TOLERANCE with the bit-identical count beside it — the same shape as `verifyReproducibility`,
// pointed at the frame that is actually quoted.
//
// Exit codes follow measure.mjs, so a calling script can tell a bad capture from a broken tool:
//   0 = capture written, the picture moved
//   1 = the capture is not usable — every frame identical (the stepping hook did nothing), the
//       frames differ but nothing coherent moved (a frozen simulation under film grain),
//       --require-weight-shift was asked for and the clip is not known to contain one, or
//       --plate found the plate outside the reproducibility tolerance
//   2 = tool error (no browser, no ffmpeg, page never became ready)

import { spawn } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { decodePng, encodePng } from './png.mjs';
// The liveness statistic is heatmap.mjs's, not a second copy of it. Three tools in this directory
// answer "did anything move" and they must answer it the same way or a judge gets two verdicts.
import {
  createBlockCoherence,
  lumaFieldOf,
  COHERENCE_BLOCK,
  MOVING_BLOCK_SIGMA_CODES,
  MOVING_BLOCK_SHARE_FLOOR,
} from './heatmap.mjs';

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

// How many frames the liveness statistic decodes, spread evenly across the whole clip. Decoding
// is the only per-frame cost this tool pays beyond the screenshot, so it is bounded rather than
// proportional: 120 samples of a 12,600-frame judge clip is one every 4 simulated seconds, which
// is far finer than the 0.5-1/min rate of the postural events the clip exists to contain.
const LIVENESS_SAMPLE_FRAMES = 120;

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
  // Plate mode replays the whole plate this many times from fresh page loads. Three is the
  // smallest number that gives more than one PAIR, and pairs are what the residue is measured
  // over — with two loads, "1 of 1 pairs bit-identical" and "the plate is reproducible" are the
  // same sentence, and there is no way to see two loads agreeing while a third does not.
  plateLoads: 3,
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
// arrives at 482.8 s, sixty-three seconds after the clip ends. Judges were asked whether a body
// shifts its weight while watching a clip that, by the draw, contains no weight shift.
//
// It is not a bug in the layer. Duarte's medio-lateral weight shift runs at 0.30/min, so a 420 s
// clip holds ~2.1 expected arrivals and the magnitude draw is lognormal — most shifts are small.
// Measured over the twelve seeds `sway.selftest.mjs` gates on, only EIGHT contain a sustained
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
 * 4242 leads because its transfer opens at 18.77 s, so it is the one clip that shows the behaviour
 * even if the reviewer only watches the first minute. 20260807 is `alive.js`'s own default seed.
 */
const POSTURAL_JUDGEMENT_SEEDS = [
  { seed: 4242, direction: 'left', onsetSeconds: 18.77, peakPixels: -40.02 },
  { seed: 42, direction: 'right', onsetSeconds: 296.70, peakPixels: 35.72 },
  { seed: 20260807, direction: 'left', onsetSeconds: 231.97, peakPixels: -21.90 },
];

/**
 * Seeds measured to contain NO sustained transfer in 420 s. Named rather than merely omitted, so
 * that a capture pinned to one of them gets told what it is about to fail to show. Seed 1 is here
 * because it is the seed this whole block was written for.
 */
const POSTURAL_EMPTY_SEEDS = [
  { seed: 1, firstTransferSeconds: 482.80 },
  { seed: 7, firstTransferSeconds: 501.90 },
  { seed: 777, firstTransferSeconds: 968.37 },
  { seed: 31337, firstTransferSeconds: 411.03 },
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

  // A plate is a PNG. ffmpeg is a clip-mode dependency and demanding it here would make a still
  // impossible to take on a machine that only needs one.
  if (options.plate === false) requireFfmpeg();

  const playwright = await loadPlaywright(options.playwrightPath);
  const server = wantsOwnServer(options) ? await startViteServer() : null;
  const browser = await launchBrowser(playwright, options);

  if (options.plate) {
    try {
      await capturePlates({ browser, server, options });
    } finally {
      await browser.close();
      if (server !== null) await server.close();
    }
    return;
  }

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

  // 🎯 …and the check above cannot fire on a page that has film grain, which the shipped default
  // does. See the note beside `liveness` in captureFrames: 600 distinct frames of a figure that
  // never moved. This is the same finding as heatmap.mjs's, at the point the clip is created
  // rather than at the point somebody analyses it.
  const noiseFloorOnly = manifests.filter((manifest) =>
    manifest.determinism.distinctFrames > 1 &&
    manifest.liveness.movingBlockShare !== null &&
    manifest.liveness.movingBlockShare < MOVING_BLOCK_SHARE_FLOOR);

  if (noiseFloorOnly.length > 0) {
    console.error('\n*** NOTHING COHERENT MOVED. The frames DIFFER and the picture did not change.');
    for (const manifest of noiseFloorOnly) {
      console.error(`***   seed ${manifest.seed ?? '(page default)'}: ` +
        `${manifest.determinism.distinctFrames} distinct frames, but only ` +
        `${(100 * manifest.liveness.movingBlockShare).toFixed(3)}% of ` +
        `${COHERENCE_BLOCK}×${COHERENCE_BLOCK} blocks vary by more than σ ${MOVING_BLOCK_SIGMA_CODES} ` +
        `(floor ${(100 * MOVING_BLOCK_SHARE_FLOOR).toFixed(0)}%, over ${manifest.liveness.sampled} sampled frames)`);
    }
    console.error('*** Frame-to-frame difference is what FILM GRAIN produces. Measured: a figure');
    console.error('*** frozen by ?freeze on the shipped default renders 600 distinct frames and');
    console.error('*** 0.000% moving blocks; every real clip in captures/ scores 5.095% or more.');
    console.error('*** Check ?freeze is not in the URL and that the simulation is advancing.');
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

/**
 * Plate mode's top level: one plate per seed, into one directory each, and a non-zero exit if any
 * of them landed outside the reproducibility tolerance.
 *
 * A plate whose residue exceeds the tolerance is not a plate — it is two pictures — and every
 * number read off it is a draw from something nobody has characterised. Exiting 1 is the same
 * stance clip mode takes on a clip in which nothing moved.
 */
async function capturePlates({ browser, server, options }) {
  const baseDirectory = path.resolve(options.out);
  const failures = [];

  for (const seed of options.seeds) {
    const outputDirectory = options.seeds.length > 1
      ? path.join(baseDirectory, `seed-${seed}`)
      : baseDirectory;

    const pageUrl = buildPageUrl(options, server, seed);

    console.log('');
    console.log(`page      ${pageUrl}`);
    console.log(`plate     ${options.steps ?? frameCountOf(options)} steps @ ${options.fps} fps` +
      `   ${options.width}x${options.height} @ dpr ${options.dpr}   ${options.plateLoads} loads`);

    const startedAtMs = Date.now();
    const plate = await capturePlate(browser, pageUrl, options);
    reportBackend(plate.environment, pageUrl);
    writePlate(plate, options, outputDirectory, pageUrl, (Date.now() - startedAtMs) / 1000);

    if (plate.reproducibility.reproducible === false) failures.push(seed);
  }

  if (failures.length > 0) {
    console.error('');
    console.error('*** PLATE OUTSIDE THE REPRODUCIBILITY TOLERANCE — this is not one picture.');
    console.error(`***   seed(s) ${failures.join(', ')}`);
    console.error('*** Every gate value read off it is a draw from a distribution nobody has');
    console.error('*** characterised. Do not record it in a ```plates fence.');
    process.exitCode = 1;
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
    // Only the verify window's own frames are held in memory; the rest go straight to disk.
    retainFrames: options.verifyFrames,
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
/**
 * A fresh browser context on a loaded, steppable page — everything both a clip and a plate need
 * before the first step, and nothing either of them differs on.
 *
 * Extracted so `capturePlate` cannot drift from `driveCapture` in viewport, colour scheme,
 * reduced-motion or readiness. A plate whose context differed from the clip's in any of those is
 * a different picture, and the whole point of a plate is that it is the same picture twice.
 */
async function openSteppablePage(browser, pageUrl, options) {
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

  return { context, page, environment, pageErrors };
}

async function driveCapture(browser, pageUrl, options, { frameCount, framesDirectory, quiet, retainFrames = 0 }) {
  const { context, page, environment, pageErrors } = await openSteppablePage(browser, pageUrl, options);

  const deltaSeconds = 1 / options.fps;
  const digests = [];

  // The reproducibility check needs PIXELS, not hashes (see the header), and only for its own
  // short window — so the buffers are kept for the first `retainFrames` frames and nothing else
  // is held in memory. At the default 20 frames and 1080×1350 that is a few tens of megabytes.
  const retained = [];

  let previousDigest = null;
  let distinctFrames = 0;
  let repeatedFrames = 0;
  let lastProgressAtMs = 0;

  // 🎯 `distinctFrames` IS NOT A LIVENESS CHECK ON A PAGE THAT HAS FILM GRAIN, and the exit-1
  // condition below it rested on that for two rounds. Measured: `?bare&frame=body&freeze` on the
  // shipped default renders 600 DISTINCT frames of a figure that never moved, because the grade
  // reseeds its grain from `frameId` every frame. The same URL at `?aa=msaa&grade=0` renders
  // 1 distinct and 599 repeated, which is the control proving `?freeze` really does freeze.
  //
  // So a second statistic is accumulated as the frames go past: the share of 8×8 blocks whose
  // mean luma varies across the clip. It is the same one heatmap.mjs gates on and it is imported
  // rather than reimplemented. Sampled rather than taken on every frame because decoding a PNG is
  // not free and a 12,600-frame judge clip would pay for it twice over — LIVENESS_SAMPLE_FRAMES
  // evenly spaced samples span the WHOLE clip, which sees more of the motion than the same number
  // of consecutive ones would.
  let coherence = null;
  const liveness = { sampled: 0, movingBlockShare: null, meanBlockSigma: null };
  const sampleEvery = Math.max(1, Math.ceil(frameCount / LIVENESS_SAMPLE_FRAMES));

  for (let frame = 1; frame <= frameCount; frame += 1) {
    const stepped = await page.evaluate((dt) => globalThis.__SUGATA_STEP__(dt), deltaSeconds);

    if (stepped !== true) {
      throw new Error(`__SUGATA_STEP__ refused at frame ${frame} — the figure is not loaded.`);
    }

    const png = await page.screenshot({ timeout: SCREENSHOT_TIMEOUT_MS });
    if (framesDirectory !== null) {
      fs.writeFileSync(path.join(framesDirectory, frameFileName(frame)), png);
    }

    if (retained.length < retainFrames) retained.push(png);

    const digest = crypto.createHash('sha256').update(png).digest('hex');
    digests.push(digest);

    if (digest === previousDigest) repeatedFrames += 1;
    else distinctFrames += 1;
    previousDigest = digest;

    if ((frame - 1) % sampleEvery === 0) {
      const image = decodePng(png);
      if (coherence === null) coherence = createBlockCoherence(image);
      coherence.push(lumaFieldOf(image));
      liveness.sampled += 1;
    }

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

  // Two samples are the minimum a temporal σ can be taken over; below that the clip is a still and
  // `distinctFrames` says so on its own.
  if (coherence !== null && liveness.sampled >= 2) {
    const { blockSigma } = coherence.result();
    let moving = 0;
    let sum = 0;
    for (let block = 0; block < blockSigma.length; block += 1) {
      sum += blockSigma[block];
      if (blockSigma[block] > MOVING_BLOCK_SIGMA_CODES) moving += 1;
    }
    liveness.blocks = blockSigma.length;
    liveness.movingBlocks = moving;
    liveness.movingBlockShare = moving / blockSigma.length;
    liveness.meanBlockSigma = sum / blockSigma.length;
  }

  return {
    environment,
    frameCount,
    deltaSeconds,
    digests,
    retained,
    distinctFrames,
    repeatedFrames,
    liveness,
    pageErrors,
    // One number that identifies the whole run. Two captures with the same sequence digest are
    // byte-identical, which is the property that makes a critic loop's before/after meaningful.
    sequenceDigest: crypto.createHash('sha256').update(digests.join('')).digest('hex'),
  };
}

/**
 * 🎯 THE REPRODUCIBILITY TOLERANCE, and why a tolerance rather than a hash.
 *
 * Measured, not chosen. Six independent browser processes drove `/alive.html?bare&frame=body` at
 * 350×600, seed 1, 30 frames each. Twenty-nine of thirty frames came back bit-identical in every
 * pairing; one frame differed on 44 pixels of 210,000 — 0.021% — by at most 3 of 255 code values.
 * `?cards=0` removes it entirely (30 of 30 bit-identical), so the residue is the alpha-to-coverage
 * sample resolve on the two hair cards and nothing else.
 *
 * The ceiling is 6 code values (2× the measured worst) and 0.1% of pixels (~5× the measured
 * worst). Both are far under anything a real determinism break produces: a different seed moves
 * the whole silhouette, which is tens of code values across percent-scale areas of the frame, and
 * the HUD's wall-clock millisecond readout rewrites whole glyphs.
 *
 * 🚩 THE ATTRIBUTION ABOVE IS NARROWER THAN IT READS, AND THE CEILING IS NOT — NARROWED AT 3840,
 * the same token this file's header carries so the pair cannot drift apart again. "The alpha-to-
 * coverage sample resolve on the two hair cards and nothing else" was measured at 350×600 on the
 * MSAA-era default. Re-measured at 3840×5120 on today's shipped default with `--plate`, 103 loads
 * over seven runs: the TAAU path leaves a residue (671 of 1053 pairs bit-identical, worst Δ2 of
 * 255 on 164 px of 19,660,800) and `?aa=msaa&grade=0` — which still has the cards and still has
 * alpha-to-coverage — leaves NONE, 290 of 290 pairs over 45 loads including two deliberately
 * concurrent runs. So there are two residues, not one, and the cards are the smaller of them.
 * The tolerance covers both with room: the worst plate residue ever measured here is a third of
 * the code ceiling and a hundredth of the area ceiling. PUNCHLIST's plate block carries the runs.
 *
 * A hash cannot express any of this. `sha256(a) === sha256(b)` is a boolean over the last code
 * value of the last pixel, and as the verdict on a GPU render it reported "NOT byte-reproducible"
 * on 8 of 10 runs of an unchanged clean plate. The bit-identical frame count is still reported —
 * it is the strictest available fact and it is genuinely informative — it just is not the verdict.
 */
const REPRODUCIBILITY_MAX_CODE_DELTA = 6;
const REPRODUCIBILITY_MAX_PIXEL_FRACTION = 0.001;

function round(value, places) {
  const scale = 10 ** places;
  return Math.round(value * scale) / scale;
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
 * The instrumented page will never come back clean — the HUD's `stats.frameMs` is a wall-clock
 * number living in the pixels. That is reported rather than assumed, so the day a clean plate
 * stops reproducing, something real has changed.
 *
 * 🚩 ITS COVERAGE IS AN OPENING WINDOW, AND IT NOW SAYS SO IN WORDS. Replaying frames 1..20 of 60
 * says nothing whatsoever about frame 60, and frame 60 is the one every plate in PUNCHLIST is
 * read off. This was not a hypothetical: three loads of the shipped default were recorded as
 * "one PNG, all three times" on the strength of a verify line that had never looked at the frame
 * being quoted. `coversPlateFrame` is in the manifest and in the console line, and `--plate`
 * exists so the question can be asked about the right frame.
 */
async function verifyReproducibility(browser, pageUrl, options, capture) {
  const frameCount = Math.min(options.verifyFrames, capture.frameCount);
  const coversPlateFrame = frameCount >= capture.frameCount;

  process.stdout.write(`verify    replaying the first ${frameCount} frames… `);

  const replay = await driveCapture(browser, pageUrl, options, {
    frameCount,
    framesDirectory: null,
    quiet: true,
    retainFrames: frameCount,
  });

  const comparison = compareFrameSequences(
    capture.retained.slice(0, frameCount),
    replay.retained.slice(0, frameCount)
  );

  let bitIdentical = 0;
  for (let index = 0; index < frameCount; index += 1) {
    if (replay.digests[index] === capture.digests[index]) bitIdentical += 1;
  }

  const reproducible =
    comparison.worstCodeDelta <= REPRODUCIBILITY_MAX_CODE_DELTA &&
    comparison.worstPixelFraction <= REPRODUCIBILITY_MAX_PIXEL_FRACTION;

  console.log(
    reproducible
      ? `reproducible — ${bitIdentical}/${frameCount} bit-identical, worst residue ` +
          `${comparison.worstDifferingPixels} px (${round(comparison.worstPixelFraction * 100, 4)}%) at Δ${comparison.worstCodeDelta}/255`
      : `NOT reproducible — worst frame ${comparison.worstFrame}: ` +
          `${comparison.worstDifferingPixels} px (${round(comparison.worstPixelFraction * 100, 4)}%) at Δ${comparison.worstCodeDelta}/255`
  );

  if (coversPlateFrame === false) {
    console.log(`          window is frames 1-${frameCount} of ${capture.frameCount}. ` +
      `FRAME ${capture.frameCount} — the plate — WAS NOT REPLAYED. Use --plate for that.`);
  }

  if (reproducible === false) {
    console.log('          expected when the HUD is visible — it prints a wall-clock ms figure.');
    console.log('          Capture with ?bare for a sequence digest that means something.');
  }

  return {
    framesReplayed: frameCount,
    // Whether the replay reached the LAST frame, which is the one a still plate is read off.
    // False is the default at 20 of 60, and a manifest that does not say so invites the claim
    // this field exists to stop.
    coversPlateFrame,
    framesBitIdentical: bitIdentical,
    worstFrame: comparison.worstFrame,
    worstCodeDelta: comparison.worstCodeDelta,
    worstDifferingPixels: comparison.worstDifferingPixels,
    worstPixelFraction: round(comparison.worstPixelFraction, 8),
    toleranceCodeDelta: REPRODUCIBILITY_MAX_CODE_DELTA,
    tolerancePixelFraction: REPRODUCIBILITY_MAX_PIXEL_FRACTION,
    reproducible,
  };
}

/**
 * 🎯 ONE STILL PLATE, TAKEN N TIMES FROM N FRESH PAGE LOADS, WITH THE RESIDUE MEASURED.
 *
 * THE PLATE RESIDUE, and why this function reports a tolerance and not a verdict on a hash.
 *
 * A plate is a page, a seed, a width, a dpr and a STEP COUNT, and its sha256 is quoted in
 * PUNCHLIST's ```plates fence as the identity of a configuration. The claim that fence rested on
 * was "three loads → one PNG". Re-measured here, at the width the fence states:
 *
 *   `/alive.html?bare&freeze&seed=1&capture`, 3840×5120, dpr 1, 60 steps at 60 fps, shipped
 *   default (TAAU 0.66 + grade + RCAS 1.2, MSAA off) — see the plate block in PUNCHLIST for the
 *   loads, the shas and the per-pair residue.
 *
 * The residue is real, tiny, and NOT removed by `?grain=0`, which is what the earlier attribution
 * assumed. It is the same alpha-to-coverage dust the header block measured at 350×600 — one code
 * value on a handful of pixels — and at 19.6 megapixels a handful of pixels is enough to change
 * the last byte of a sha256 about a third of the time. That is why this returns the same shape
 * `verifyReproducibility` does: a bit-identical COUNT, reported as a fact, and a verdict taken
 * against a measured tolerance.
 *
 * Cost, and why plate mode exists as well as clip mode: a clip screenshots every frame, so a
 * 60-step plate at 3840×5120 costs 60 screenshots of a 19.6 MP frame to keep one of them. This
 * steps the same 60 times — the step count is part of the identity and cannot be shortened — and
 * screenshots once.
 */
/**
 * The bookkeeping half of a plate: which digest IS the plate, and how many of the pairs matched.
 *
 * BIT IDENTITY IS COUNTED OVER EVERY PAIR, AND IT IS FREE. "load 1 equals load 2" and "load 2
 * equals load 3" are two facts and neither implies the third, so a record that only compares
 * against load 1 can call a plate reproducible when two of its loads disagree with each other. Two
 * loads are bit-identical exactly when their digests match, so the full N(N-1)/2 count costs
 * nothing but string comparisons and grouping by digest gives it in one pass.
 *
 * 🎯 AND THE PLATE IS THE MODE, NOT LOAD 1. Measured at 30 loads of the shipped default: nineteen
 * came back `d3c9946f73e5eaa1` — the digest this repository has quoted as the plate all along —
 * and eleven were one-off variants, load 1 among them. Naming load 1 "the plate" would have
 * recorded a singleton as the identity and made every other load look like a divergence from it.
 * Ties break toward the earliest load, so a run with no repeats at all still reports something
 * rather than nothing, and `modal.loads.length` is how a reader sees that it is one of one.
 *
 * Pure and exported so `selftest.mjs` can prove it on digest lists whose answer is known by hand —
 * a real 30-load plate takes three and a half minutes and cannot be a gate.
 *
 * @param {string[]} digests - one sha256 per load, in load order.
 */
export function summarisePlateLoads(digests) {
  const byDigest = new Map();
  digests.forEach((digest, index) => {
    if (byDigest.has(digest) === false) byDigest.set(digest, []);
    byDigest.get(digest).push(index + 1);
  });

  const groups = [...byDigest.entries()].map(([sha256, members]) => ({ sha256, loads: members }));

  const modal = groups.reduce((best, group) =>
    group.loads.length > best.loads.length ||
    (group.loads.length === best.loads.length && group.loads[0] < best.loads[0]) ? group : best);

  let bitIdenticalPairs = 0;
  for (const group of groups) bitIdenticalPairs += (group.loads.length * (group.loads.length - 1)) / 2;

  return {
    groups,
    modal,
    distinctShas: groups.length,
    bitIdenticalPairs,
    pairsCompared: (digests.length * (digests.length - 1)) / 2,
  };
}

async function capturePlate(browser, pageUrl, options) {
  const steps = options.steps ?? frameCountOf(options);
  const deltaSeconds = 1 / options.fps;
  const loads = [];
  const pngs = [];
  let environment = null;
  const pageErrors = [];

  for (let load = 1; load <= options.plateLoads; load += 1) {
    process.stdout.write(`plate     load ${load}/${options.plateLoads}: ${steps} steps… `);

    const opened = await openSteppablePage(browser, pageUrl, options);
    if (environment === null) environment = opened.environment;

    for (let step = 1; step <= steps; step += 1) {
      const stepped = await opened.page.evaluate((dt) => globalThis.__SUGATA_STEP__(dt), deltaSeconds);
      if (stepped !== true) {
        throw new Error(`__SUGATA_STEP__ refused at step ${step} — the figure is not loaded.`);
      }
    }

    const png = await opened.page.screenshot({ timeout: SCREENSHOT_TIMEOUT_MS });
    await opened.context.close();

    pngs.push(png);
    pageErrors.push(...opened.pageErrors);

    // The digest of the file EXACTLY as it is written to disk, because that is what a reader
    // re-derives with `shasum -a 256`. Playwright writes no provenance chunks, so the raw file
    // digest and the plate digest are the same number; `stripProvenanceChunks` is deliberately
    // not applied here, or the fence would record a digest nobody can reproduce by hand.
    const sha = crypto.createHash('sha256').update(png).digest('hex');
    loads.push({ load, sha256: sha, bytes: png.length, source: sourceFingerprint() });
    console.log(sha.slice(0, 16));
  }

  const summary = summarisePlateLoads(loads.map((load) => load.sha256));
  const { groups, modal, bitIdenticalPairs, pairsCompared } = summary;
  const referencePng = pngs[modal.loads[0] - 1];

  // THE MAGNITUDE IS MEASURED AGAINST THE MODAL PLATE, and the choice of one reference rather than
  // all pairs is a deliberate limit rather than an oversight. A true all-pairs residue at 30 loads
  // is 435 comparisons of a 19.6 MP PNG — 870 decodes — and it was measured taking longer than the
  // capture it was describing. One representative per DISTINCT digest, differenced against the
  // mode, is a handful of decodes and answers the question the tolerance is about: how far from
  // the plate can a load land. It under-estimates the worst PAIR by at most a factor of two
  // (triangle inequality), and `residueMeasuredAgainst` says so in the manifest rather than
  // leaving a reader to assume all-pairs.
  const versusReference = [];

  for (const group of groups) {
    if (group.sha256 === modal.sha256) continue;
    const index = group.loads[0] - 1;
    const comparison = compareFrameSequences([referencePng], [pngs[index]]);
    versusReference.push({
      load: group.loads[0],
      sha256: group.sha256,
      differingPixels: comparison.worstDifferingPixels,
      pixelFraction: round(comparison.worstPixelFraction, 10),
      codeDelta: comparison.worstCodeDelta,
    });
  }

  const worstCodeDelta = versusReference.reduce((worst, entry) => Math.max(worst, entry.codeDelta), 0);
  const worstPixelFraction = versusReference.reduce((worst, entry) => Math.max(worst, entry.pixelFraction), 0);
  const worstDifferingPixels = versusReference.reduce((worst, entry) => Math.max(worst, entry.differingPixels), 0);

  return {
    steps,
    fps: options.fps,
    loads,
    environment,
    pageErrors,
    png: referencePng,
    reproducibility: {
      loads: loads.length,
      pairsCompared,
      bitIdenticalPairs,
      distinctShas: groups.length,
      // The plate itself: the digest that came back most often, and how many of the loads it was.
      plateSha256: modal.sha256,
      modalLoads: modal.loads.length,
      digestGroups: groups,
      residueMeasuredAgainst: 'the modal plate — one decode per distinct digest, not all pairs',
      versusReference,
      worstCodeDelta,
      worstDifferingPixels,
      worstPixelFraction,
      toleranceCodeDelta: REPRODUCIBILITY_MAX_CODE_DELTA,
      tolerancePixelFraction: REPRODUCIBILITY_MAX_PIXEL_FRACTION,
      reproducible:
        worstCodeDelta <= REPRODUCIBILITY_MAX_CODE_DELTA &&
        worstPixelFraction <= REPRODUCIBILITY_MAX_PIXEL_FRACTION,
    },
  };
}

/** Plate mode's whole output: one PNG, one manifest, and a fence line ready to paste. */
function writePlate(plate, options, outputDirectory, pageUrl, elapsedSeconds) {
  fs.mkdirSync(outputDirectory, { recursive: true });

  const platePath = path.join(outputDirectory, 'plate.png');
  fs.writeFileSync(platePath, plate.png);

  const manifest = {
    tool: 'tools/critic/capture.mjs --plate',
    capturedAt: new Date().toISOString(),
    url: pageUrl,
    seed: options.seeds[0] ?? null,
    simulation: { fps: plate.fps, steps: plate.steps, stepSeconds: 1 / plate.fps },
    resolution: {
      cssWidth: options.width,
      cssHeight: options.height,
      devicePixelRatio: options.dpr,
      pixelWidth: options.width * options.dpr,
      pixelHeight: options.height * options.dpr,
    },
    environment: plate.environment,
    // Whether the three loads are even OF one build. This tool's own vite freezes the tree at
    // launch and ignores every later edit, so the loads are one build by construction; an
    // external --url server usually has the watcher on, and in a fan-out a load can be of code
    // that did not exist when the previous load ran. `loads[].source.packagesDigest` says what
    // actually happened either way.
    servedByOwnFrozenServer: wantsOwnServer(options),
    loads: plate.loads,
    reproducibility: plate.reproducibility,
    pageErrors: plate.pageErrors,
    outputs: { plate: path.relative(REPOSITORY_ROOT, platePath) },
    wallClockSeconds: Number(elapsedSeconds.toFixed(1)),
  };

  fs.writeFileSync(path.join(outputDirectory, 'plate.json'), JSON.stringify(manifest, null, 2) + '\n');

  const residue = plate.reproducibility;
  console.log('');
  console.log(`plate     ${residue.plateSha256.slice(0, 16)} — the MODE, ${residue.modalLoads} of ` +
    `${plate.loads.length} loads; ${residue.distinctShas} distinct sha256, ` +
    `${residue.bitIdenticalPairs}/${residue.pairsCompared} pairs bit-identical`);
  console.log(`residue   worst ${residue.worstDifferingPixels} px ` +
    `(${(100 * residue.worstPixelFraction).toFixed(7)}%) at Δ${residue.worstCodeDelta}/255` +
    `   vs the mode   tolerance Δ${residue.toleranceCodeDelta} / ${100 * residue.tolerancePixelFraction}% of pixels`);
  console.log(`verdict   ${residue.reproducible
    ? 'reproducible WITHIN TOLERANCE'
    : 'NOT reproducible — outside the measured tolerance'}` +
    `${residue.distinctShas > 1 ? '   <- and NOT byte-identical: do not write "one PNG"' : ''}`);
  console.log(`stepping  ${plate.steps} step(s) at ${plate.fps} fps   ` +
    '<- part of the plate identity, not just its cost');

  // The line a PUNCHLIST ```plates row needs, so the record and the measurement cannot drift by a
  // transcription. Gate values are the caller's to fill in from measure.mjs; everything that
  // describes the PLATE rather than the picture is emitted here.
  console.log('');
  console.log(`fence     loads=${plate.loads.length} sha=${residue.plateSha256.slice(0, 16)} ` +
    `bitident=${residue.bitIdenticalPairs}/${residue.pairsCompared} ` +
    `worst=${residue.worstCodeDelta} px=${residue.worstDifferingPixels}`);
  console.log('');
  console.log(`  plate         ${platePath}  ${describeSize(platePath)}`);
  console.log(`  manifest      ${path.join(outputDirectory, 'plate.json')}`);

  return manifest;
}

/**
 * Two PNG sequences, differenced in DECODED PIXELS. Returns the worst frame by either statistic,
 * because they fail differently: a shading change moves many pixels a little and a geometry change
 * moves few pixels a lot.
 *
 * Exported so `selftest.mjs` can prove it in both directions on synthetic plates — a real capture
 * is far too slow to be a gate, and §1.1 says a check that has never failed is not known to work.
 */
export function compareFrameSequences(left, right) {
  let worstFrame = 0;
  let worstCodeDelta = 0;
  let worstDifferingPixels = 0;
  let worstPixelFraction = 0;

  const frames = Math.min(left.length, right.length);

  for (let index = 0; index < frames; index += 1) {
    const a = decodePng(left[index]);
    const b = decodePng(right[index]);

    if (a.width !== b.width || a.height !== b.height) {
      return {
        worstFrame: index + 1,
        worstCodeDelta: 255,
        worstDifferingPixels: a.width * a.height,
        worstPixelFraction: 1,
      };
    }

    let differing = 0;
    let maxDelta = 0;

    for (let i = 0; i < a.pixels.length; i += 4) {
      const delta =
        Math.max(
          Math.abs(a.pixels[i] - b.pixels[i]),
          Math.abs(a.pixels[i + 1] - b.pixels[i + 1]),
          Math.abs(a.pixels[i + 2] - b.pixels[i + 2])
        ) * 255;

      // Half a code value: anything smaller cannot survive the 8-bit encode and is a rounding
      // artefact of the float decode, not a difference between two renders.
      if (delta < 0.5) continue;
      differing += 1;
      if (delta > maxDelta) maxDelta = delta;
    }

    const fraction = differing / (a.width * a.height);

    if (maxDelta > worstCodeDelta || fraction > worstPixelFraction) {
      if (maxDelta > worstCodeDelta) worstCodeDelta = maxDelta;
      if (fraction > worstPixelFraction) {
        worstPixelFraction = fraction;
        worstDifferingPixels = differing;
      }
      worstFrame = index + 1;
    }
  }

  return {
    worstFrame,
    worstCodeDelta: Math.round(worstCodeDelta),
    worstDifferingPixels,
    worstPixelFraction,
  };
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

/**
 * 🎯 WHICH BUILD THIS CLIP IS OF. The residual hazard left by the watcher-off server, measured.
 *
 * LEARNINGS §1.12 used to say a concurrent edit kills a long capture, and `startViteServer` fixed
 * that — the server this tool starts serves the tree AS IT STOOD AT LAUNCH and ignores everything
 * after. What it cannot do is make two SEPARATE runs be of the same tree, and in a fan-out they
 * routinely are not.
 *
 * Measured while this function was being written. Twelve captures of `/alive.html?bare&frame=body`
 * at seed 1, six before a concurrent agent saved `FacialIdle.js` and `HandIdle.js` and six after,
 * differenced pixel by pixel:
 *
 *   within either group   worst Δ3/255 on 44 px of 210,000 (0.021%) — the alpha-to-coverage residue
 *   across the two groups worst Δ209/255 on 821 px (0.391%) at frame 25
 *
 * A factor of seventy in code value, and NOTHING in the manifest said the two halves were of
 * different code. Two clips handed to a judge as an A/B would have been an A/B of a fan-out.
 *
 * So the manifest carries a fingerprint of the source the server was about to serve: git HEAD plus
 * a content hash of every file under `packages/` that vite can reach. Content rather than mtime,
 * because a touched-but-unchanged file is the same build and should say so.
 */
function sourceFingerprint() {
  const hash = crypto.createHash('sha256');
  const roots = [path.join(REPOSITORY_ROOT, 'packages')];
  const extensions = new Set(['.js', '.mjs', '.html', '.css', '.json', '.wgsl', '.glsl']);
  const files = [];

  const walk = (directory) => {
    let entries;
    try {
      entries = fs.readdirSync(directory, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries.sort((a, b) => (a.name < b.name ? -1 : 1))) {
      if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
      const full = path.join(directory, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (extensions.has(path.extname(entry.name))) files.push(full);
    }
  };

  for (const root of roots) walk(root);

  for (const file of files) {
    hash.update(path.relative(REPOSITORY_ROOT, file));
    hash.update(crypto.createHash('sha256').update(fs.readFileSync(file)).digest());
  }

  let head = null;
  try {
    head = fs.readFileSync(path.join(REPOSITORY_ROOT, '.git', 'HEAD'), 'utf8').trim();
    const match = head.match(/^ref: (.+)$/);
    if (match) head = fs.readFileSync(path.join(REPOSITORY_ROOT, '.git', match[1]), 'utf8').trim();
  } catch {
    head = null;
  }

  return {
    gitHead: head,
    packagesDigest: hash.digest('hex').slice(0, 16),
    fileCount: files.length,
    note: 'Two clips are of the same code only if packagesDigest matches. A concurrent edit between two runs is invisible without this — measured at 209/255 code values on 0.39% of pixels.',
  };
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
    source: sourceFingerprint(),
    // 🚩 READ THIS BEFORE `determinism.distinctFrames`. Distinct frames is a statement about
    // BYTES; this is the statement about the PICTURE, and on a page carrying film grain they
    // disagree completely — a frozen figure gives 600 distinct frames and 0.000% moving blocks.
    liveness: {
      ...capture.liveness,
      block: COHERENCE_BLOCK,
      movingBlockSigmaCodes: MOVING_BLOCK_SIGMA_CODES,
      movingBlockShareFloor: MOVING_BLOCK_SHARE_FLOOR,
    },
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
  console.log(`moved     ${manifest.liveness.movingBlockShare === null
    ? 'not measured — fewer than two sampled frames'
    : `${(100 * manifest.liveness.movingBlockShare).toFixed(3)}% of ${manifest.liveness.blocks} ` +
      `${COHERENCE_BLOCK}x${COHERENCE_BLOCK} blocks (floor ${(100 * MOVING_BLOCK_SHARE_FLOOR).toFixed(0)}%, ` +
      `${manifest.liveness.sampled} frames sampled)   <- distinct frames is bytes; this is the picture`}`);
  console.log(`digest    ${manifest.determinism.sequenceDigest.slice(0, 16)}   ` +
    describeReproducibility(manifest.determinism.reproducibility));

  // 🎯 THE STEP COUNT IS PART OF A PLATE'S IDENTITY, so it is printed where a human reads the
  // digest rather than only in the line about wall clock. Measured at `2ec7db9`, one page and one
  // seed at 900x1200: G2 reads 0.9182 after 1 capture step and 0.9169 after 60, because the
  // capture hook drives the frame epoch once per captured frame and the temporal resolve has
  // accumulated a different number of samples. `measure.mjs` reads this back out of the frame file
  // name to decide whether two plates are comparable at all; two plates at different step counts
  // are two different pictures, not one picture measured twice.
  console.log(`stepping  ${manifest.simulation.frameCount} step(s) at ` +
    `${(1 / manifest.simulation.stepSeconds).toFixed(0)} fps   ` +
    '<- part of the plate identity, not just its cost');

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

  const residue =
    `${reproducibility.framesBitIdentical}/${reproducibility.framesReplayed} bit-identical, ` +
    `worst residue ${reproducibility.worstDifferingPixels} px at Δ${reproducibility.worstCodeDelta}/255` +
    (reproducibility.coversPlateFrame === false ? ', PLATE FRAME NOT COVERED' : '');

  return reproducibility.reproducible
    ? `(reproducible within tolerance: ${residue})`
    : `(NOT reproducible: ${residue}, over Δ${reproducibility.toleranceCodeDelta} / ` +
        `${reproducibility.tolerancePixelFraction * 100}% of pixels)`;
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
    // Plate mode. `steps` is null until asked for, so --seconds/--fps keep meaning the same thing
    // in both modes and a plate can still be described the way the punch list describes one.
    plate: false,
    steps: null,
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
      case '--plate': options.plate = true; break;
      case '--steps': options.steps = Number(value); index += 1; break;
      case '--plate-loads': options.plateLoads = Number(value); index += 1; break;
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
  if (options.steps !== null && (Number.isInteger(options.steps) === false || options.steps < 1)) {
    throw new Error('--steps must be a positive whole number of simulation steps.');
  }
  // One load cannot measure a residue: the whole output of plate mode is a comparison, and a
  // single load would report "0 of 0 pairs bit-identical" as if that were a clean result.
  if (options.plate && (Number.isInteger(options.plateLoads) === false || options.plateLoads < 2)) {
    throw new Error('--plate-loads must be at least 2 — one load measures nothing about reproducibility.');
  }
  if (options.plate === false && options.steps !== null) {
    throw new Error('--steps is plate mode only. In clip mode the frame count is --seconds x --fps.');
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
                       ⚠ an OPENING window. At the default it does not reach the last frame,
                       which is the frame a still plate is read off. Use --plate for that.
  --skip-verify        do not replay
  --keep-frames        keep the PNG sequence

  PLATE MODE — one still, taken N times, with the residue measured instead of asserted.
  --plate              step to the plate frame, screenshot only that frame, repeat from fresh
                       page loads, and report the pairwise residue against the tolerance.
                       Writes plate.png + plate.json. No ffmpeg needed.
  --steps <n>          simulation steps before the plate is taken (default --seconds x --fps).
                       Part of the plate's identity: N steps is not the picture at M steps.
  --plate-loads <n>    how many fresh loads to compare      (${DEFAULTS.plateLoads})
  --headed             run Chromium headed
  --playwright <path>  path to a playwright installation
`);
}
