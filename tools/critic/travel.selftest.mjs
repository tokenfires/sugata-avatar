#!/usr/bin/env node
//
// travel.selftest.mjs — proves travel.mjs measures the distance it claims to.
//
// docs/LEARNINGS.md §1.1: *"A gate that has never failed is not known to work."* Every gate below
// is therefore exercised against a clip whose answer is known BEFORE the tool runs, and the
// degenerate clips — a frozen still, a figure that breathes without moving, an all-black frame —
// are checked for REFUSAL, because each of them produces a perfectly presentable table of small
// plausible numbers if nobody looks.
//
// ================================================================================================
// THE CLOSED-FORM ORACLE, derived here rather than fitted to the tool's output
// ================================================================================================
//
// A hard-edged rectangle of integer width W occupies columns a … a+W−1. The mean of consecutive
// integers a … b is (a+b)/2, so its horizontal centroid is exactly
//
//     c = a + (W−1)/2
//
// Translate it by an integer d pixels per frame over N frames, so on frame k (k = 0 … N−1) the
// rectangle starts at a = a₀ + k·d and the centroid is c(k) = a₀ + (W−1)/2 + k·d. The travel
// statistics are then statistics of the integers k = 0 … N−1, scaled by d.
//
//   PEAK-TO-PEAK.  max − min = d·(N−1).
//
//   POPULATION SD.  Var(k) over k = 0 … N−1:
//       E[k]  = (N−1)/2
//       E[k²] = (N−1)(2N−1)/6                     [sum of squares, divided by N]
//       Var   = (N−1)(2N−1)/6 − (N−1)²/4
//             = (N−1)·[ 2(2N−1) − 3(N−1) ] / 12
//             = (N−1)(N+1)/12
//             = (N² − 1)/12
//   so   SD(c) = d · √( (N² − 1) / 12 ).
//
// Population, not sample, because the tool reports population σ — the clip IS the population of
// frames, not a draw from a wider one. Nothing here is approximate: the centroid is a ratio of two
// exact integers, so these are the numbers to full double precision and the tolerances below are
// 1e-9, not "a few percent".
//
// ================================================================================================
// WHAT THIS FILE CANNOT PROVE, AND SAYS SO
// ================================================================================================
//
// A synthetic rectangle is not a rendered figure. These gates prove the ARITHMETIC is right — that
// a known translation reads back as that translation, that a frozen clip reads back as exactly
// zero, that area and centroid are independent. They do not prove the THRESHOLD picks the right
// silhouette on a real render; only the silhouette-fraction check and a human looking at a frame
// can do that. §1.9: state what you could not observe.
//
// Run: node tools/critic/travel.selftest.mjs

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { encodePng } from './png.mjs';
import { findFramePaths } from './heatmap.mjs';
import { analyseClip, parseBandSpec, resolveBands, DEFAULTS } from './travel.mjs';

const WORK_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'sugata-travel-selftest-'));
const HERE = path.dirname(fileURLToPath(import.meta.url));

// One frame geometry for every synthetic clip, so the band fractions below always mean the same
// rows and a reader only has to hold one shape in their head.
const FRAME_WIDTH = 320;
const FRAME_HEIGHT = 240;

// Neutral grey figure on a neutral grey backdrop. Grey because for r = g = b = v the Rec.709
// weights sum to one, so encoded luma is exactly v/255 and no colour maths sits between the
// synthesised image and the oracle. The two levels are far apart so the auto threshold has an
// unambiguous shoulder to find — this file tests travel, not threshold heroics.
const BACKDROP_VALUE = 20;
const FIGURE_VALUE = 220;

const gates = [];

// --- the oracle ---------------------------------------------------------------------------------

// SD of the integers 0 … N−1, derived in the header. Stated once so no gate can quietly use a
// different one.
function sdOfFrameIndices(frameCount) {
  return Math.sqrt((frameCount * frameCount - 1) / 12);
}

function expectedTravelSd(pixelsPerFrame, frameCount) {
  return pixelsPerFrame * sdOfFrameIndices(frameCount);
}

function expectedTravelPeakToPeak(pixelsPerFrame, frameCount) {
  return pixelsPerFrame * (frameCount - 1);
}

// --- clip synthesis -----------------------------------------------------------------------------

/**
 * Writes `frames` numbered PNGs, each painted by `valueAt(x, y, frame)` in 8-bit code values.
 *
 * Rounded, not truncated, for the reason selftest.mjs records: assigning a float into a Uint8Array
 * truncates toward zero, which would bias every antialiased edge half a code value — and half a
 * code value at an edge is exactly the signal the sub-pixel gate is trying to read.
 */
function writeClip(name, { frames, valueAt, width = FRAME_WIDTH, height = FRAME_HEIGHT }) {
  const directory = path.join(WORK_DIR, name);
  fs.mkdirSync(directory, { recursive: true });

  for (let frame = 0; frame < frames; frame += 1) {
    const bytes = new Uint8Array(width * height * 4);
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const value = clampByte(Math.round(valueAt(x, y, frame)));
        const base = (y * width + x) * 4;
        bytes[base] = value;
        bytes[base + 1] = value;
        bytes[base + 2] = value;
        bytes[base + 3] = 255;
      }
    }
    fs.writeFileSync(
      path.join(directory, `frame-${String(frame + 1).padStart(5, '0')}.png`),
      encodePng(width, height, bytes)
    );
  }

  return directory;
}

function clampByte(value) {
  return value < 0 ? 0 : value > 255 ? 255 : value;
}

// A hard-edged axis-aligned rectangle: inclusive column and row bounds, no antialiasing, so the
// silhouette the tool recovers is exactly the rectangle and the oracle is exact.
function hardRectangle(x, y, { left, width, top, height }) {
  const inside = x >= left && x < left + width && y >= top && y < top + height;
  return inside ? FIGURE_VALUE : BACKDROP_VALUE;
}

// Box-filter coverage of pixel column x by the real interval [left, right). This is the only place
// a fractional position can enter the image, and it is what makes a quarter-pixel translation
// visible at all: it lands as a change in one edge pixel's code value, not as a moved pixel.
function coverageOfColumn(x, left, right) {
  return Math.max(0, Math.min(x + 1, right) - Math.max(x, left));
}

function shadeByCoverage(coverage) {
  return BACKDROP_VALUE + coverage * (FIGURE_VALUE - BACKDROP_VALUE);
}

function analyse(directory, overrides = {}) {
  const options = { ...DEFAULTS, ...overrides };
  return analyseClip(findFramePaths(directory, options.stride), options);
}

// The CLI exits 1 on every refusal, which is most of what this file feeds it. Capture stdout and
// the exit code together rather than letting execFileSync throw.
function runCli(args) {
  try {
    const stdout = execFileSync('node', [path.join(HERE, 'travel.mjs'), ...args], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    return { stdout, stderr: '', status: 0 };
  } catch (error) {
    if (error.status === undefined) throw error;
    return { stdout: error.stdout ?? '', stderr: error.stderr ?? '', status: error.status };
  }
}

function bandNamed(report, name) {
  const band = report.bands.find((candidate) => candidate.name === name);
  if (band === undefined) throw new Error(`the report has no band "${name}"`);
  return band;
}

// --- assertions ---------------------------------------------------------------------------------

function expectClose(label, actual, expected, tolerance) {
  const delta = Math.abs(actual - expected);
  gates.push({
    label,
    ok: delta <= tolerance,
    detail: `actual ${format(actual)}  expected ${format(expected)} ±${format(tolerance)}  (Δ ${format(delta)})`,
  });
}

function expectEqual(label, actual, expected) {
  gates.push({ label, ok: actual === expected, detail: `actual ${actual}  expected ${expected}` });
}

function expectTrue(label, condition, detail) {
  gates.push({ label, ok: condition === true, detail });
}

function note(label, detail) {
  gates.push({ label, ok: true, detail, informational: true });
}

function format(value) {
  if (typeof value !== 'number') return String(value);
  if (Math.abs(value) >= 1000 || (Math.abs(value) < 0.001 && value !== 0)) return value.toExponential(3);
  return value.toFixed(6);
}

// ================================================================================================
// 1. A known translation reads back as that translation  (CLOSED-FORM ORACLE)
// ================================================================================================
//
// A full-height column translating 3 px/frame for 64 frames. Full height so it crosses every band
// identically: every band must return the SAME answer, which checks the band arithmetic at the same
// time as the travel arithmetic. Vertical travel and area must be EXACTLY zero — the column never
// moves up, down, or changes size, and "exactly" is available here because the centroid is a ratio
// of exact integers.

const TRANSLATE_FRAMES = 64;
const TRANSLATE_STEP = 3;
const TRANSLATE_WIDTH = 40;
const TRANSLATE_ORIGIN = 8;

function testKnownTranslation() {
  const directory = writeClip('translate', {
    frames: TRANSLATE_FRAMES,
    valueAt: (x, y, frame) =>
      hardRectangle(x, y, {
        left: TRANSLATE_ORIGIN + frame * TRANSLATE_STEP,
        width: TRANSLATE_WIDTH,
        top: 0,
        height: FRAME_HEIGHT,
      }),
  });

  const report = analyse(directory);
  const expectedSd = expectedTravelSd(TRANSLATE_STEP, TRANSLATE_FRAMES);
  const expectedP2p = expectedTravelPeakToPeak(TRANSLATE_STEP, TRANSLATE_FRAMES);

  for (const band of report.bands) {
    expectClose(`band ${band.name}: x SD = d·√((N²−1)/12) = ${expectedSd.toFixed(5)}`,
      band.x.sd, expectedSd, 1e-9);
    expectClose(`band ${band.name}: x peak-to-peak = d·(N−1) = ${expectedP2p}`,
      band.x.peakToPeak, expectedP2p, 1e-9);
  }

  // The absolute centroid is also predicted, not just its spread: a₀ + (W−1)/2 + mean(k)·d.
  const expectedMean =
    TRANSLATE_ORIGIN + (TRANSLATE_WIDTH - 1) / 2 + ((TRANSLATE_FRAMES - 1) / 2) * TRANSLATE_STEP;
  expectClose('mean centroid matches a₀ + (W−1)/2 + d·(N−1)/2',
    bandNamed(report, 'whole').x.mean, expectedMean, 1e-9);

  expectEqual('a column that only moves sideways reports y SD of EXACTLY 0',
    report.bands.every((band) => band.y.sd === 0), true);
  expectEqual('a column that never changes size reports area SD of EXACTLY 0',
    report.bands.every((band) => band.area.sd === 0), true);
  expectEqual('no band is called motionless when every band moved', report.motionlessBands.length, 0);
  expectEqual('the clip is accepted as evidence', report.verdict.refused, false);
  expectEqual('the CLI exits 0 on a clip that travelled',
    runCli([directory]).status, 0);
}

// ================================================================================================
// 2. Travel is LINEAR in the motion  (the anti-saturation gate — the whole reason this tool exists)
// ================================================================================================
//
// §1.10a: heatmap.mjs's σ saturates because its edge pixels already swing the full code range, so
// doubling the motion barely moves the number. A distance cannot do that. Two clips identical but
// for the step size must report SDs in exactly the ratio of their steps. If this gate ever fails,
// travel.mjs has inherited the defect it was built to escape.

const LINEARITY_FRAMES = 32;

function testTravelIsLinearInMotion() {
  const build = (name, step) =>
    writeClip(name, {
      frames: LINEARITY_FRAMES,
      valueAt: (x, y, frame) =>
        hardRectangle(x, y, {
          left: TRANSLATE_ORIGIN + frame * step,
          width: TRANSLATE_WIDTH,
          top: 0,
          height: FRAME_HEIGHT,
        }),
    });

  const slow = analyse(build('linear-slow', 3));
  const fast = analyse(build('linear-fast', 6));

  const slowSd = bandNamed(slow, 'whole').x.sd;
  const fastSd = bandNamed(fast, 'whole').x.sd;

  expectClose('doubling the motion exactly doubles the reported SD (σ would not)',
    fastSd / slowSd, 2, 1e-12);
  expectClose('doubling the motion exactly doubles the reported peak-to-peak',
    bandNamed(fast, 'whole').x.peakToPeak / bandNamed(slow, 'whole').x.peakToPeak, 2, 1e-12);
  note('  measured', `slow ${format(slowSd)} px SD, fast ${format(fastSd)} px SD`);
}

// ================================================================================================
// 3. Vertical travel is measured, and told apart from horizontal  (a bob is not a sway)
// ================================================================================================
//
// A rectangle that only descends, held inside one band for the whole clip so the oracle stays the
// pure integer one. A second band above it never sees the figure at all — and must be reported
// EMPTY, not motionless. A band with nothing in it is not a statue, and calling it one would send a
// reader hunting for a rigging bug in a patch of backdrop.

const DESCENT_FRAMES = 48;
const DESCENT_STEP = 1;
const DESCENT_WIDTH = 60;
const DESCENT_HEIGHT = 40;
const DESCENT_ORIGIN = 60;
const DESCENT_BANDS = 'above:0.0-0.20,mid:0.20-0.65';

function testVerticalTravel() {
  const directory = writeClip('descend', {
    frames: DESCENT_FRAMES,
    valueAt: (x, y, frame) =>
      hardRectangle(x, y, {
        left: 100,
        width: DESCENT_WIDTH,
        top: DESCENT_ORIGIN + frame * DESCENT_STEP,
        height: DESCENT_HEIGHT,
      }),
  });

  const report = analyse(directory, { bands: parseBandSpec(DESCENT_BANDS) });
  const mid = bandNamed(report, 'mid');
  const above = bandNamed(report, 'above');

  expectClose('a descending rectangle reports y SD = d·√((N²−1)/12)',
    mid.y.sd, expectedTravelSd(DESCENT_STEP, DESCENT_FRAMES), 1e-9);
  expectClose('and y peak-to-peak = d·(N−1)',
    mid.y.peakToPeak, expectedTravelPeakToPeak(DESCENT_STEP, DESCENT_FRAMES), 1e-9);
  expectClose('its y centroid matches y₀ + (H−1)/2 + d·(N−1)/2',
    mid.y.mean,
    DESCENT_ORIGIN + (DESCENT_HEIGHT - 1) / 2 + ((DESCENT_FRAMES - 1) / 2) * DESCENT_STEP,
    1e-9);

  expectEqual('a bob is NOT reported as a sway — x SD is EXACTLY 0', mid.x.sd, 0);
  expectEqual('and the area is unchanged — x SD of 0 is not a lost silhouette', mid.area.sd, 0);

  expectEqual('a band the figure never enters is reported empty, not motionless',
    above.observedFrames, 0);
  expectEqual('every frame of that band is counted as empty', above.emptyFrames, DESCENT_FRAMES);
  expectEqual('an empty band is not named as a statue',
    report.motionlessBands.includes('above'), false);
}

// ================================================================================================
// 4. A frozen clip is refused, loudly  (DEGENERATE INPUT — §1.3)
// ================================================================================================
//
// The still is a PICTURE, not a flat fill: a rectangle off the frame's centre line, so a tool that
// had quietly fallen back to measuring the frame centre, or to a spatial rather than temporal
// statistic, would produce a confident number here and be caught.

function testFrozenClipIsRefused() {
  const directory = writeClip('frozen', {
    frames: 40,
    valueAt: (x, y) => hardRectangle(x, y, { left: 70, width: 55, top: 30, height: 150 }),
  });

  const report = analyse(directory);

  expectEqual('every band reports x SD of EXACTLY 0 on a frozen clip',
    report.bands.every((band) => band.x.sd === 0), true);
  expectEqual('every band reports y SD of EXACTLY 0 on a frozen clip',
    report.bands.every((band) => band.y.sd === 0), true);
  expectEqual('every band reports peak-to-peak of EXACTLY 0',
    report.bands.every((band) => band.x.peakToPeak === 0 && band.y.peakToPeak === 0), true);
  expectEqual('the clip is refused rather than reported as small travel',
    report.verdict.refused, true);
  expectEqual('and the refusal names the frozen silhouette', report.verdict.reason, 'silhouette-frozen');

  const run = runCli([directory]);
  expectEqual('the CLI exits 1 on a frozen clip', run.status, 1);
  expectTrue('the CLI says the silhouette is frozen instead of printing plausible small numbers',
    run.stdout.includes('THE SILHOUETTE IS FROZEN'),
    run.stdout.split('\n').find((line) => line.includes('FROZEN')) ?? '(no FROZEN line printed)');
  expectTrue('and it says outright that there is no travel here to be small',
    run.stdout.includes('no travel here to be small'),
    run.stdout.split('\n').find((line) => line.includes('to be small')) ?? '(missing)');
}

// ================================================================================================
// 5. A living torso on a statue's legs  (the §1.10 failure, in the units that answer it)
// ================================================================================================
//
// The defect the whole instrument exists for: the upper body moves, the lower body does not, and
// the band table has to NAME the dead rows rather than leaving a reader to squint at an image.

const STATUE_FRAMES = 64;
const STATUE_BANDS = 'head:0.05-0.20,chest:0.20-0.45,thigh:0.55-0.80,shin:0.80-0.95';

function testLivingTorsoOnStatueLegs() {
  const directory = writeClip('statue-legs', {
    frames: STATUE_FRAMES,
    valueAt: (x, y, frame) => {
      const moving = hardRectangle(x, y, {
        left: TRANSLATE_ORIGIN + frame * TRANSLATE_STEP,
        width: TRANSLATE_WIDTH,
        top: 0,
        height: 120,
      });
      if (moving === FIGURE_VALUE) return FIGURE_VALUE;
      return hardRectangle(x, y, { left: 200, width: 40, top: 130, height: 110 });
    },
  });

  const bands = parseBandSpec(STATUE_BANDS);
  const report = analyse(directory, { bands });
  const expectedSd = expectedTravelSd(TRANSLATE_STEP, STATUE_FRAMES);

  for (const name of ['head', 'chest']) {
    expectClose(`the living band "${name}" reports the injected travel`,
      bandNamed(report, name).x.sd, expectedSd, 1e-9);
  }
  for (const name of ['thigh', 'shin']) {
    expectEqual(`the statue band "${name}" reports x SD of EXACTLY 0`, bandNamed(report, name).x.sd, 0);
    expectEqual(`the statue band "${name}" reports y SD of EXACTLY 0`, bandNamed(report, name).y.sd, 0);
    expectTrue(`the statue band "${name}" DOES hold silhouette, so it is a statue and not empty`,
      bandNamed(report, name).observedFrames === STATUE_FRAMES,
      `observed ${bandNamed(report, name).observedFrames}/${STATUE_FRAMES} frames`);
  }

  expectEqual('the motionless bands are named exactly', report.motionlessBands.join(','), 'thigh,shin');
  expectEqual('the clip is still evidence — something moved', report.verdict.refused, false);

  const run = runCli([directory, '--bands', STATUE_BANDS]);
  expectEqual('the CLI exits 0 without --fail-on-motionless (a measurement is a diagnostic)', run.status, 0);
  expectTrue('the CLI names the motionless bands in its output',
    run.stdout.includes('MOTIONLESS BANDS: thigh, shin'),
    run.stdout.split('\n').find((line) => line.includes('MOTIONLESS')) ?? '(no MOTIONLESS line)');

  const gated = runCli([directory, '--bands', STATUE_BANDS, '--fail-on-motionless']);
  expectEqual('--fail-on-motionless turns it into a gate that exits 1', gated.status, 1);
}

// ================================================================================================
// 6. Growth is not travel  (centroid and area are independent measurements)
// ================================================================================================
//
// A rectangle growing symmetrically about a fixed centre line. Symmetric growth cannot move the
// centroid — the mean of a … b is (a+b)/2 and both ends move by the same amount — so a tool that
// conflated "the silhouette changed" with "the body moved" reports travel here and is caught.
// This is the breathing figure: it must not be mistaken for a swaying one.

const GROWTH_FRAMES = 48;
const GROWTH_CENTRE = 160;
const GROWTH_HALF_WIDTH_START = 20;

function testGrowthIsNotTravel() {
  const directory = writeClip('growth', {
    frames: GROWTH_FRAMES,
    valueAt: (x, y, frame) => {
      const halfWidth = GROWTH_HALF_WIDTH_START + frame;
      return hardRectangle(x, y, {
        left: GROWTH_CENTRE - halfWidth,
        width: 2 * halfWidth + 1,
        top: 0,
        height: FRAME_HEIGHT,
      });
    },
  });

  const report = analyse(directory);
  const whole = bandNamed(report, 'whole');

  expectEqual('symmetric growth moves the centroid by EXACTLY 0 px', whole.x.sd, 0);
  expectEqual('and its peak-to-peak is EXACTLY 0 px', whole.x.peakToPeak, 0);
  expectClose('the centroid sits exactly on the growth centre line', whole.x.mean, GROWTH_CENTRE, 1e-9);
  expectTrue('while the area SD rises — the two are independent measurements',
    whole.area.sd > 1000, `area SD ${format(whole.area.sd)} px, area cv ${(whole.areaVariation * 100).toFixed(1)}%`);

  expectEqual('the tool distinguishes a breathing figure from a frozen one',
    report.verdict.reason, 'shape-changes-but-does-not-travel');

  const run = runCli([directory]);
  expectEqual('the CLI exits 1 — a figure that does not travel is not evidence of travel', run.status, 1);
  expectTrue('and the banner says shape changed while the body stayed put',
    run.stdout.includes('CHANGES SHAPE BUT DOES NOT TRAVEL'),
    run.stdout.split('\n').find((line) => line.includes('CHANGES SHAPE')) ?? '(missing)');
  expectTrue('the banner does NOT claim the clip is frozen',
    run.stdout.includes('THE SILHOUETTE IS FROZEN') === false,
    'a breathing figure and a still frame are different findings');
}

// ================================================================================================
// 7. Sway and breathing at the same time  (independence, under load)
// ================================================================================================
//
// Gate 6 shows growth alone does not fake travel. This shows growth does not CORRUPT travel: the
// same rectangle translates and grows simultaneously, and the travel oracle must still hold to
// full precision while the area moves underneath it.

const COMBINED_FRAMES = 32;
const COMBINED_STEP = 2;

function testSwayAndBreathTogether() {
  const directory = writeClip('sway-and-breathe', {
    frames: COMBINED_FRAMES,
    valueAt: (x, y, frame) => {
      const halfWidth = GROWTH_HALF_WIDTH_START + frame;
      return hardRectangle(x, y, {
        left: 120 + frame * COMBINED_STEP - halfWidth,
        width: 2 * halfWidth + 1,
        top: 0,
        height: FRAME_HEIGHT,
      });
    },
  });

  const whole = bandNamed(analyse(directory), 'whole');

  expectClose('travel survives a simultaneous area change, to full precision',
    whole.x.sd, expectedTravelSd(COMBINED_STEP, COMBINED_FRAMES), 1e-9);
  expectClose('and so does peak-to-peak',
    whole.x.peakToPeak, expectedTravelPeakToPeak(COMBINED_STEP, COMBINED_FRAMES), 1e-9);
  expectTrue('the area moved while it did so', whole.area.sd > 1000, `area SD ${format(whole.area.sd)} px`);
}

// ================================================================================================
// 8. Sub-pixel translation  (the point of the instrument — 1.6 px is the number in dispute)
// ================================================================================================
//
// PROGRESS's failing measurement is 1.6 pixels. An instrument that quantises to whole pixels cannot
// adjudicate it, so this gate asks directly: can a QUARTER-pixel step per frame be read back?
//
// The tool thresholds to a binary mask, so a fractional position can only reach it through the code
// value of an antialiased edge pixel. Two shapes are run, and the difference between them IS the
// mechanism:
//
//   AXIS-ALIGNED — every pixel of the left edge has the SAME sub-pixel phase, so they all cross the
//   threshold on the same frame and the mask steps in whole pixels. This is the WORST case.
//
//   SHEARED — the edge advances 0.11 px per row, so the ~100 distinct phases down the frame cross
//   the threshold on different frames and the mask boundary moves a few rows at a time. The
//   centroid of thousands of such rows tracks the true position far below one pixel. A rendered
//   limb is this case, not the axis-aligned one: nothing on a body is a perfectly vertical edge.
//
// The claim under test is about MOTION, not absolute position: where the threshold cuts an
// antialiased edge sets a fixed offset between the true centroid and the measured one, and that
// offset is a property of the shading, not an error in the travel. So the residual is taken after
// removing the series mean — one constant, not a fitted curve — and the header says so rather than
// letting a reader wonder what was fitted.

const SUBPIXEL_FRAMES = 64;
const SUBPIXEL_STEP = 0.25;
const SUBPIXEL_WIDTH = 40;
const SUBPIXEL_ORIGIN = 8;
const SUBPIXEL_SHEAR = 0.11;

function testSubPixelTranslation() {
  const axisAligned = writeClip('subpixel-axis', {
    frames: SUBPIXEL_FRAMES,
    valueAt: (x, y, frame) => {
      const left = SUBPIXEL_ORIGIN + frame * SUBPIXEL_STEP;
      return shadeByCoverage(coverageOfColumn(x, left, left + SUBPIXEL_WIDTH));
    },
  });

  const sheared = writeClip('subpixel-sheared', {
    frames: SUBPIXEL_FRAMES,
    valueAt: (x, y, frame) => {
      const left = SUBPIXEL_ORIGIN + frame * SUBPIXEL_STEP + y * SUBPIXEL_SHEAR;
      return shadeByCoverage(coverageOfColumn(x, left, left + SUBPIXEL_WIDTH));
    },
  });

  const expectedSd = expectedTravelSd(SUBPIXEL_STEP, SUBPIXEL_FRAMES);
  const expectedP2p = expectedTravelPeakToPeak(SUBPIXEL_STEP, SUBPIXEL_FRAMES);

  const shearedTracking = trackCentroidSeries(sheared);
  const axisTracking = trackCentroidSeries(axisAligned);

  expectClose('a sheared edge translating 0.25 px/frame reports the analytic SD',
    shearedTracking.sd, expectedSd, 0.02 * expectedSd);
  expectClose('and the analytic peak-to-peak', shearedTracking.peakToPeak, expectedP2p, 0.3);
  expectTrue('a QUARTER-PIXEL step is resolved: RMS tracking error stays well under one pixel',
    shearedTracking.rmsResidual < 0.25,
    `RMS residual ${format(shearedTracking.rmsResidual)} px, worst frame ` +
      `${format(shearedTracking.maxResidual)} px`);
  expectTrue('the centroid moves on most frames rather than stepping in whole pixels',
    shearedTracking.movedFraction > 0.9,
    `centroid changed on ${(shearedTracking.movedFraction * 100).toFixed(1)}% of frame-to-frame steps`);

  // The worst case, measured rather than assumed, and asserted in BOTH directions: the axis-aligned
  // edge must be measurably worse, or the explanation above is wrong and this gate is decoration.
  expectTrue('a perfectly vertical edge is the WORST case and tracks worse than a sheared one',
    axisTracking.rmsResidual > shearedTracking.rmsResidual,
    `axis-aligned ${format(axisTracking.rmsResidual)} px vs sheared ${format(shearedTracking.rmsResidual)} px RMS`);
  expectTrue('even the worst case still resolves below one pixel',
    axisTracking.rmsResidual < 1,
    `axis-aligned RMS residual ${format(axisTracking.rmsResidual)} px`);

  note('  RESOLUTION LIMIT (sheared edge, the realistic case)',
    `${shearedTracking.rmsResidual.toFixed(4)} px RMS, ${shearedTracking.maxResidual.toFixed(4)} px worst frame`);
  note('  RESOLUTION LIMIT (perfectly vertical edge, worst case)',
    `${axisTracking.rmsResidual.toFixed(4)} px RMS, ${axisTracking.maxResidual.toFixed(4)} px worst frame; ` +
      `centroid changed on ${(axisTracking.movedFraction * 100).toFixed(1)}% of steps`);
}

/**
 * Replays one clip a frame at a time and compares the measured centroid against the commanded
 * position, after removing the constant offset (see the section header for why one constant is
 * legitimate and a fitted curve would not be).
 */
function trackCentroidSeries(directory) {
  const framePaths = findFramePaths(directory, 1);
  const bands = parseBandSpec('all:0.0-1.0');

  const measured = framePaths.map((framePath, frame) => {
    const single = analyseClip([framePath, framePath], { ...DEFAULTS, bands });
    return { frame, centroid: single.bands[0].x.mean };
  });

  const residuals = measured.map((sample) => sample.centroid - sample.frame * SUBPIXEL_STEP);
  const offset = residuals.reduce((sum, value) => sum + value, 0) / residuals.length;
  const centred = residuals.map((value) => value - offset);

  let moved = 0;
  for (let index = 1; index < measured.length; index += 1) {
    if (measured[index].centroid !== measured[index - 1].centroid) moved += 1;
  }

  const whole = analyse(directory, { bands });

  return {
    sd: whole.bands[0].x.sd,
    peakToPeak: whole.bands[0].x.peakToPeak,
    rmsResidual: Math.sqrt(centred.reduce((sum, value) => sum + value * value, 0) / centred.length),
    maxResidual: Math.max(...centred.map(Math.abs)),
    movedFraction: moved / (measured.length - 1),
  };
}

// ================================================================================================
// 9. Threshold failure modes are refused, not reported as zero travel
// ================================================================================================
//
// An all-black clip and an all-white clip are the two ways a capture fails without crashing: a page
// that never rendered, and a page that rendered blown out. Both have a centroid — the frame centre,
// by construction — and both would otherwise be published as "0.00 px travel", which reads as a
// finding about the animation rather than about the capture. Both refusal paths are checked: the
// histogram has no shoulder to cut at (auto), and a pinned threshold catches nothing or everything.

function testThresholdFailureModes() {
  const flat = (name, value) => writeClip(name, { frames: 20, valueAt: () => value });
  const black = flat('all-black', 0);
  const white = flat('all-white', 255);

  for (const [name, directory] of [['black', black], ['white', white]]) {
    const report = analyse(directory);
    expectEqual(`an all-${name} clip is refused under an auto threshold`, report.verdict.refused, true);
    expectEqual(`and the refusal names the missing figure/backdrop separation`,
      report.verdict.reason, 'no-separation');
    expectEqual(`no band statistics are published for the all-${name} clip`, report.bands.length, 0);

    const run = runCli([directory]);
    expectEqual(`the CLI exits 1 on an all-${name} clip`, run.status, 1);
    expectTrue(`the CLI refuses the all-${name} clip in words`,
      run.stdout.includes('REFUSED: the first frame has no figure'),
      run.stdout.split('\n').find((line) => line.includes('REFUSED')) ?? '(no REFUSED line)');
    expectTrue(`and says plainly that this is NOT zero travel`,
      run.stdout.includes('This is NOT zero travel'),
      run.stdout.split('\n').find((line) => line.includes('NOT zero travel')) ?? '(missing)');
  }

  // Pinning the threshold bypasses the histogram check — deliberately, because an operator who
  // knows the figure level should be able to say so. The silhouette-fraction check is what still
  // has to catch it, and it is a genuinely different code path.
  const caughtNothing = analyse(black, { threshold: 0.5 });
  expectEqual('a pinned threshold above everything is refused, not reported as zero travel',
    caughtNothing.verdict.reason, 'threshold-caught-nothing');
  expectEqual('the pinned all-black refusal exits 1',
    runCli([black, '--threshold', '0.5']).status, 1);
  expectTrue('and the message tells the reader which way to move the threshold',
    runCli([black, '--threshold', '0.5']).stdout.includes('Lower --threshold'),
    'expected a "Lower --threshold" hint');

  const caughtEverything = analyse(white, { threshold: 0.5 });
  expectEqual('a pinned threshold below everything is refused as catching the whole frame',
    caughtEverything.verdict.reason, 'threshold-caught-everything');
  expectEqual('the pinned all-white refusal exits 1',
    runCli([white, '--threshold', '0.5']).status, 1);
  expectTrue('and the message tells the reader which way to move the threshold',
    runCli([white, '--threshold', '0.5']).stdout.includes('Raise'),
    'expected a "Raise --threshold" hint');
}

// ================================================================================================
// 10. The threshold is published, pinnable, and changes the answer
// ================================================================================================
//
// heatmap.mjs's --normalise discipline, applied to the quantity that matters here: two clips only
// compare if they were cut at the same luma, so auto must print its choice and a pin must be used
// verbatim. And a knob that does not change the answer is not a knob — a threshold that swallows
// the figure has to visibly swallow it.

function testThresholdIsPublishedAndPinnable() {
  const directory = writeClip('threshold-knob', {
    frames: 24,
    valueAt: (x, y, frame) =>
      hardRectangle(x, y, { left: 40 + frame * 2, width: 50, top: 40, height: 160 }),
  });

  const auto = analyse(directory);
  expectEqual('an auto threshold is labelled auto', auto.threshold.mode, 'auto');
  expectClose('and sits the documented fraction of the way between the documented percentiles',
    auto.threshold.luma,
    auto.threshold.lowValue + auto.threshold.fraction * (auto.threshold.highValue - auto.threshold.lowValue),
    1e-12);

  const pinned = analyse(directory, { threshold: auto.threshold.luma });
  expectEqual('a pinned threshold is labelled pinned', pinned.threshold.mode, 'pinned');
  expectClose('a pinned threshold is used verbatim', pinned.threshold.luma, auto.threshold.luma, 0);
  expectClose('pinning the auto value reproduces the auto answer exactly',
    bandNamed(pinned, 'whole').x.sd, bandNamed(auto, 'whole').x.sd, 0);

  const run = runCli([directory]);
  expectTrue('the report tells a later run how to pin this threshold',
    run.stdout.includes('pin with --threshold'),
    'expected a "pin with --threshold <luma>" line');
  expectTrue('the report states the percentiles the threshold came from',
    /p5 = [0-9.]+ to p99 = [0-9.]+/.test(run.stdout),
    run.stdout.split('\n').find((line) => line.includes('threshold ')) ?? '(missing)');
  expectTrue('the report states what fraction of the frame the silhouette covered',
    /^silhouette /m.test(run.stdout),
    run.stdout.split('\n').find((line) => line.startsWith('silhouette')) ?? '(missing)');

  // A threshold set above the figure catches nothing — the knob demonstrably bites.
  expectEqual('a threshold above the figure level catches nothing and is refused',
    analyse(directory, { threshold: 0.95 }).verdict.reason, 'threshold-caught-nothing');
}

// ================================================================================================
// 11. Bands, determinism, and refusal of malformed input
// ================================================================================================

function testBandsDeterminismAndRefusals() {
  const directory = writeClip('plumbing', {
    frames: 20,
    valueAt: (x, y, frame) =>
      hardRectangle(x, y, { left: 30 + frame * 4, width: 45, top: 20, height: 200 }),
  });

  const first = analyse(directory);
  const second = analyse(directory);
  // Digested rather than compared field by field: the claim is that the ENTIRE band table is
  // reproduced, and a digest states that in one line instead of pasting two of them into the log.
  expectEqual('same frames in, same numbers out',
    digestOf(first.bands), digestOf(second.bands));

  expectEqual('the default band table is the standing-figure one',
    first.bands.map((band) => band.name).join(','), 'head,shoulder,hip,knee,ankle,foot,whole');

  const custom = analyse(directory, { bands: parseBandSpec('upper:0.1-0.4,lower:0.6-0.9') });
  expectEqual('--bands is honoured, names and all',
    custom.bands.map((band) => band.name).join(','), 'upper,lower');
  expectEqual('band fractions resolve to the expected rows',
    `${custom.bands[0].firstRow}–${custom.bands[0].lastRow}`, '24–95');

  const bandFile = path.join(WORK_DIR, 'bands.json');
  fs.writeFileSync(bandFile, JSON.stringify([{ name: 'torso', top: 0.2, bottom: 0.5 }]));
  const viaFile = runCli([directory, '--bands-file', bandFile]);
  expectTrue('--bands-file is honoured', /^torso /m.test(viaFile.stdout),
    viaFile.stdout.split('\n').find((line) => line.startsWith('torso')) ?? '(no torso row)');

  // capture.mjs writes <out>/frames/frame-*.png, so pointing at the capture root must work — and
  // --stride must actually thin the clip, or a "quick look" silently measures the whole thing.
  const captureRoot = path.join(WORK_DIR, 'capture-root');
  fs.mkdirSync(captureRoot, { recursive: true });
  fs.cpSync(directory, path.join(captureRoot, 'frames'), { recursive: true });
  expectEqual('a capture root is descended into automatically',
    analyse(captureRoot).clip.frameCount, 20);
  expectEqual('--stride thins the clip', analyse(captureRoot, { stride: 4 }).clip.frameCount, 5);

  const jsonPath = path.join(WORK_DIR, 'plumbing.json');
  runCli([directory, '--json', jsonPath]);
  const written = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
  expectClose('the JSON report carries the same travel as the table',
    written.bands.find((band) => band.name === 'whole').x.sd, bandNamed(first, 'whole').x.sd, 1e-12);
  expectTrue('the JSON report carries the threshold and its provenance',
    typeof written.threshold.luma === 'number' && written.threshold.lowPercentile === 5,
    JSON.stringify(written.threshold));

  expectEqual('an inverted band is refused',
    refusalFrom(() => parseBandSpec('bad:0.6-0.2'), /top must be less than bottom/), true);
  expectEqual('a band outside the frame is refused',
    refusalFrom(() => parseBandSpec('bad:0.2-1.4'), /fractions of frame height/), true);
  expectEqual('an unreadable band spec is refused',
    refusalFrom(() => parseBandSpec('0.2-0.4'), /Expected name:top-bottom/), true);
  expectEqual('a nameless band is refused — the report is read by name',
    refusalFrom(() => resolveBands([{ top: 0.1, bottom: 0.2 }], 240), /needs a name/), true);
  expectEqual('a band too thin to hold a row is refused',
    refusalFrom(() => resolveBands([{ name: 'sliver', top: 0.5, bottom: 0.5001 }], 240), /covers no rows/), true);

  expectEqual('a mismatched frame size is refused', refusalFrom(() => {
    const mixed = path.join(WORK_DIR, 'mixed');
    fs.mkdirSync(mixed, { recursive: true });
    fs.copyFileSync(path.join(directory, 'frame-00001.png'), path.join(mixed, 'frame-00001.png'));
    fs.writeFileSync(path.join(mixed, 'frame-00002.png'), encodePng(8, 8, new Uint8Array(8 * 8 * 4)));
    return analyse(mixed);
  }, /but the clip started at/), true);

  expectEqual('a threshold outside (0,1) is refused', runCli([directory, '--threshold', '1.5']).status, 2);
  expectEqual('an unknown option is refused', runCli([directory, '--sigma', '3']).status, 2);
  expectEqual('a missing directory is refused', runCli([path.join(WORK_DIR, 'nowhere')]).status, 2);
}

function digestOf(value) {
  return crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex').slice(0, 16);
}

function refusalFrom(action, pattern) {
  try {
    action();
    return false;
  } catch (error) {
    return pattern.test(error.message);
  }
}

// --- runner ---------------------------------------------------------------------------------------

function run() {
  testKnownTranslation();
  testTravelIsLinearInMotion();
  testVerticalTravel();
  testFrozenClipIsRefused();
  testLivingTorsoOnStatueLegs();
  testGrowthIsNotTravel();
  testSwayAndBreathTogether();
  testSubPixelTranslation();
  testThresholdFailureModes();
  testThresholdIsPublishedAndPinnable();
  testBandsDeterminismAndRefusals();

  const width = Math.max(...gates.map((gate) => gate.label.length));
  for (const gate of gates) {
    const status = gate.informational ? '    ' : gate.ok ? 'ok  ' : 'FAIL';
    process.stdout.write(`${status}  ${gate.label.padEnd(width)}  ${gate.detail}\n`);
  }

  const asserted = gates.filter((gate) => gate.informational !== true);
  const failed = asserted.filter((gate) => !gate.ok).length;
  process.stdout.write(`\n${asserted.length - failed}/${asserted.length} gates passed.\n`);
  process.stdout.write(`Test clips left in ${WORK_DIR}\n`);
  return failed === 0 ? 0 : 1;
}

process.exitCode = run();
