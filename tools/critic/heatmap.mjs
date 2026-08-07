#!/usr/bin/env node
//
// heatmap.mjs — per-pixel temporal-σ heat map of a captured clip.
//
// docs/LEARNINGS.md §1.10: *"The per-pixel temporal-σ heat map is the single best motion
// diagnostic. Accumulate per-pixel variance across a clip and render it. The dead lower body
// showed as a hard horizontal cut at the hip line, unmissable, in one image."* That had only
// ever been done by hand. This is the tool.
//
// What it answers that watching the video does not: WHERE did the picture move, and BY HOW
// MUCH. A reviewer watching ninety seconds of clip will forgive a motionless thigh for all
// ninety of them. A σ map draws that thigh as a black slab, and the band table puts a number
// on it — which is the difference between "the lower body feels dead" and "bands 7–10 are
// 100% below σ 0.5".
//
// The measured quantity is the temporal standard deviation of ENCODED Rec.709 luma at each
// pixel, expressed in 8-bit code values (so σ = 1.0 means "one code value"). Encoded, not
// linear, for the reason color.mjs gives: this is a perceptual "did it visibly change?"
// question, not a ratio of light. Population σ, not sample σ — the clip IS the population,
// we are not estimating a wider distribution from a draw of it.
//
// ⚠️ Numerical stability is load-bearing, not pedantry. The signal is a variance of order one
// code value riding on a mean of order a hundred, accumulated over hundreds of frames. A naive
// Σx² accumulator ends by subtracting two nearly-equal large numbers, and the low bits it
// cancels away ARE the answer. Welford's online update never forms that difference, so the
// small variance is carried at full relative precision the whole way.
//
// Outputs:
//   <out>.png    the heat map, with a colour-ramp legend strip below it and band tick marks
//                down both edges
//   stdout       the scale (which σ maps to which colour) and the per-band statistics
//   --json       the same numbers, machine-readable, for a gate script
//
// Usage:
//   node tools/critic/heatmap.mjs captures/idle-body
//   node tools/critic/heatmap.mjs captures/idle-body --normalise 8.42 --bands 12 --dead 0.5
//
// Exit codes follow measure.mjs and capture.mjs, so a calling script can tell a dead clip from
// a broken tool:
//   0 = heat map written, the picture moved
//   1 = the clip is not evidence — σ is 0 everywhere, or --fail-on-dead-bands and a band is dead
//   2 = tool error (no frames, mismatched frame sizes, unreadable PNG)

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { decodePng, encodePng } from './png.mjs';
import { encodedLuma } from './color.mjs';

// σ is reported in 8-bit code values regardless of the source's bit depth, because that is the
// unit every other number in this harness is quoted in (G4's "1.5–2.1 / 255", the spec's hexes).
// png.mjs hands back normalised floats, so a 16-bit capture keeps its precision and still lands
// on the same scale as an 8-bit one.
const CODE_VALUE_SCALE = 255;

const DEFAULTS = {
  bands: 10,

  // A pixel below this σ is called dead.
  //
  // Derived, not tuned: if a pixel holds one code value on all but k of N frames and moves by a
  // single code value on those k, its σ is √(k/N − (k/N)²) ≈ √(k/N). σ < 0.5 therefore means the
  // pixel failed to move by even one quantisation step in more than a quarter of the clip. That
  // is as close to "did not move" as an 8-bit image can express. It also sits well under G4's
  // flat-skin high-pass σ of 1.5–2.1/255, so ordinary render grain never reads as motion.
  dead: 0.5,

  // A band this fraction dead gets the loud callout. Not 1.0: a dead limb still has a lit edge
  // and a contact shadow that flicker, and demanding literal totality would let a statue with a
  // twitching hem pass unremarked.
  deadBandFraction: 0.9,

  normalise: 'auto',
  stride: 1,
  failOnDeadBands: false,
};

// Auto-normalisation reads a high percentile rather than the true maximum. One HUD digit, one
// specular sparkle on an eyelash, one antialiased silhouette edge sweeping a full code range —
// any of those sets a maximum ten times the body's honest σ and compresses everything that
// matters into the bottom of the ramp. The true maximum is printed alongside so either can be
// pinned deliberately.
const AUTO_NORMALISE_PERCENTILE = 99.9;

// The colour ramp: black → red → orange → amber → white.
//
// 🚩 NOT a rainbow. A rainbow ramp is not monotonic in luminance — its yellow is brighter than
// its green AND its cyan, so a mid value looks "hotter" than a high one and the reader's eye
// reverses the ordering the data has. This ramp's stops rise strictly in encoded luma
// (0.000 → 0.176 → 0.383 → 0.725 → 1.000), so brighter always means more motion even in a
// greyscale print or to a colour-blind reader. heatmap.selftest.mjs asserts that monotonicity
// rather than trusting these numbers to stay true if someone edits the stops.
const RAMP_STOPS = [
  { position: 0.0, name: 'black', rgb: [0, 0, 0] },
  { position: 0.3, name: 'dark red', rgb: [140, 20, 10] },
  { position: 0.55, name: 'orange', rgb: [220, 70, 10] },
  { position: 0.78, name: 'amber', rgb: [250, 180, 40] },
  { position: 1.0, name: 'white', rgb: [255, 255, 255] },
];

// Matches the contact sheet's background so the two outputs of one capture sit together without
// one of them looking like a different tool made it.
const CHROME_BACKGROUND = [11, 11, 14];
const BAND_TICK_COLOUR = [120, 120, 130];
const LEGEND_HEIGHT = 24;
const LEGEND_GAP = 4;
const BAND_TICK_LENGTH = 18;

// capture.mjs writes `frames/frame-00001.png`. Other producers may not, so the tool falls back
// to any PNG in the directory — but never to its own output or the contact sheet, which would
// silently poison the statistics with one frame that is not a frame.
const FRAME_NAME = /^frame-(\d+)\.png$/i;
const TRAILING_NUMBER = /(\d+)(?!.*\d)/;
const NOT_A_FRAME = new Set(['contact-sheet.png', 'heatmap.png', '.palette.png']);

// --- entry point ------------------------------------------------------------------------------

function main(argv) {
  const options = parseArguments(argv);
  if (options.help) {
    process.stdout.write(usageText());
    return 0;
  }

  const framePaths = findFramePaths(options.input, options.stride);
  const report = analyseClip(framePaths, options);
  const image = renderHeatMap(report);

  fs.mkdirSync(path.dirname(options.out), { recursive: true });
  fs.writeFileSync(options.out, encodePng(image.width, image.height, image.bytes));
  if (options.jsonPath) {
    // The σ field itself is deliberately dropped here — it is tens of megabytes of Float64 and
    // the renderer is its only consumer. Everything a gate script needs is in the summary.
    const { field: _omitted, ...summary } = report;
    fs.mkdirSync(path.dirname(options.jsonPath), { recursive: true });
    fs.writeFileSync(options.jsonPath, `${JSON.stringify(summary, null, 2)}\n`);
  }

  process.stdout.write(formatReport(report, options));

  // A σ map of a frozen clip is a perfectly plausible-looking black rectangle, and §1.3 is the
  // record of what that costs: the capture tool once scored perfectly byte-reproducible while
  // rendering a still pose, because a still image always does. Say it, do not draw it and hope.
  if (report.coverage.counted === 0) return 1;
  if (options.failOnDeadBands && report.deadBands.length > 0) return 1;
  return 0;
}

// --- measurement ------------------------------------------------------------------------------

/**
 * Reads every frame once and returns the full diagnostic: the σ field, the scale it will be
 * drawn on, how much of the frame was counted, and the per-band statistics.
 */
function analyseClip(framePaths, options) {
  const field = accumulateSigmaField(framePaths);

  // Counted = the pixel changed at all across the clip. Skipped = it is bit-identical in every
  // frame, which is the flat backdrop of a ?bare capture — and, unavoidably, also a limb that
  // never moved. Luminance alone cannot tell those two apart, so skipped pixels are left OUT of
  // the mean and p99 (they would drag every band toward zero and make bands incomparable) and
  // kept IN the dead-fraction denominator (where a frozen limb is exactly what we want to see).
  const counted = collectCountedSigmas(field.sigma);
  counted.sort();

  const observedMax = counted.length > 0 ? counted[counted.length - 1] : 0;
  const autoMax = percentileOfSorted(counted, AUTO_NORMALISE_PERCENTILE / 100);
  const scale = resolveScale(options.normalise, { autoMax, observedMax });

  const bands = summariseBands(field, options);

  return {
    clip: {
      framesDirectory: path.resolve(path.dirname(framePaths[0])),
      frameCount: framePaths.length,
      stride: options.stride,
      firstFrame: path.basename(framePaths[0]),
      lastFrame: path.basename(framePaths[framePaths.length - 1]),
      width: field.width,
      height: field.height,
    },
    units: 'temporal population σ of encoded Rec.709 luma, in 8-bit code values',
    coverage: {
      totalPixels: field.sigma.length,
      counted: counted.length,
      skippedStatic: field.sigma.length - counted.length,
      countedFraction: counted.length / field.sigma.length,
    },
    scale,
    thresholds: {
      dead: options.dead,
      deadBandFraction: options.deadBandFraction,
    },
    bands,
    deadBands: bands.filter((band) => band.deadFraction >= options.deadBandFraction).map((band) => band.index),
    field,
  };
}

/**
 * One streaming pass over the clip, accumulating Welford's running mean and sum of squared
 * deltas per pixel.
 *
 * The frames are read one at a time and released; peak memory is one decoded frame plus two
 * Float64 arrays the size of the image, not the whole clip. That is what makes a 2700-frame
 * capture tractable at all.
 */
function accumulateSigmaField(framePaths) {
  let width = 0;
  let height = 0;
  let mean = null;
  let sumSquaredDeltas = null;
  let frameCount = 0;

  for (const framePath of framePaths) {
    const image = decodePng(fs.readFileSync(framePath));

    if (frameCount === 0) {
      width = image.width;
      height = image.height;
      mean = new Float64Array(width * height);
      sumSquaredDeltas = new Float64Array(width * height);
    } else if (image.width !== width || image.height !== height) {
      throw new Error(
        `frame ${path.basename(framePath)} is ${image.width}×${image.height}, but the clip ` +
          `started at ${width}×${height}. A σ map across mixed frame sizes is meaningless.`
      );
    }

    frameCount += 1;

    for (let pixel = 0, base = 0; pixel < mean.length; pixel += 1, base += 4) {
      const luma =
        encodedLuma(image.pixels[base], image.pixels[base + 1], image.pixels[base + 2]) *
        CODE_VALUE_SCALE;

      const deltaFromOldMean = luma - mean[pixel];
      mean[pixel] += deltaFromOldMean / frameCount;
      sumSquaredDeltas[pixel] += deltaFromOldMean * (luma - mean[pixel]);
    }

    reportProgress(frameCount, framePaths.length);
  }

  // Exactly zero for a frozen pixel, and that exactness matters: every frame gives the identical
  // luma, so deltaFromOldMean is exactly 0.0, the mean never moves, and nothing is ever added to
  // the accumulator. The degenerate case is detected by equality, not by a tolerance.
  const sigma = new Float64Array(mean.length);
  for (let pixel = 0; pixel < sigma.length; pixel += 1) {
    sigma[pixel] = Math.sqrt(sumSquaredDeltas[pixel] / frameCount);
  }

  return { width, height, frameCount, sigma, mean };
}

/**
 * Splits the frame into horizontal bands and reports each one.
 *
 * Horizontal because the failure this exists to catch is anatomical and stacked vertically —
 * head, chest, hips, thighs, feet. A hard cut at the hip line falls exactly on a band boundary
 * and shows up as a step in one column of numbers.
 */
function summariseBands(field, options) {
  const bands = [];

  for (let index = 0; index < options.bands; index += 1) {
    const firstRow = Math.floor((index * field.height) / options.bands);
    const lastRow = Math.floor(((index + 1) * field.height) / options.bands);

    const start = firstRow * field.width;
    const end = lastRow * field.width;
    const totalPixels = end - start;

    const counted = collectCountedSigmas(field.sigma.subarray(start, end));
    counted.sort();

    let deadPixels = 0;
    for (let pixel = start; pixel < end; pixel += 1) {
      if (field.sigma[pixel] < options.dead) deadPixels += 1;
    }

    let sum = 0;
    for (let i = 0; i < counted.length; i += 1) sum += counted[i];

    bands.push({
      index: index + 1,
      firstRow,
      lastRow: lastRow - 1,
      totalPixels,
      countedPixels: counted.length,
      countedFraction: totalPixels === 0 ? 0 : counted.length / totalPixels,
      meanSigma: counted.length === 0 ? 0 : sum / counted.length,
      p99Sigma: percentileOfSorted(counted, 0.99),
      maxSigma: counted.length === 0 ? 0 : counted[counted.length - 1],
      deadPixels,
      deadFraction: totalPixels === 0 ? 0 : deadPixels / totalPixels,
    });
  }

  return bands;
}

function collectCountedSigmas(sigma) {
  let count = 0;
  for (let pixel = 0; pixel < sigma.length; pixel += 1) {
    if (sigma[pixel] > 0) count += 1;
  }

  const counted = new Float64Array(count);
  let next = 0;
  for (let pixel = 0; pixel < sigma.length; pixel += 1) {
    if (sigma[pixel] > 0) {
      counted[next] = sigma[pixel];
      next += 1;
    }
  }
  return counted;
}

function percentileOfSorted(sorted, fraction) {
  if (sorted.length === 0) return 0;
  const index = Math.ceil(fraction * sorted.length) - 1;
  return sorted[Math.min(sorted.length - 1, Math.max(0, index))];
}

/**
 * Decides which σ sits at the top of the ramp.
 *
 * Two clips can only be compared if they are drawn on the SAME scale — under auto, a clip with
 * half the motion of another renders identically, because each is normalised to its own maximum.
 * So auto always prints what it chose, and a later run pins it with --normalise <that number>.
 */
function resolveScale(normalise, { autoMax, observedMax }) {
  const automatic = normalise === 'auto';
  // If under one pixel in a thousand moved, the p99.9 lands on zero while there is real motion
  // to draw. Fall back to the true maximum rather than declaring the clip frozen.
  const requested = automatic ? (autoMax > 0 ? autoMax : observedMax) : normalise;

  // A frozen clip has no maximum to normalise to. Substituting 1 keeps the renderer from
  // dividing by zero and painting NaN; the map is all black either way, which is the truth.
  const maxSigma = requested > 0 ? requested : 1;

  return {
    mode: automatic ? 'auto' : 'pinned',
    maxSigma,
    autoMax,
    observedMax,
    degenerate: requested <= 0,
    percentile: AUTO_NORMALISE_PERCENTILE,
  };
}

// --- rendering --------------------------------------------------------------------------------

/**
 * Draws the σ field, a legend strip showing the ramp, and band tick marks down both edges.
 *
 * Deterministic by construction: every value here is a pure function of the σ field and the
 * scale, the rounding is explicit, and png.mjs encodes with a fixed filter and a fixed deflate
 * level. Same frames in, byte-identical PNG out.
 */
function renderHeatMap(report) {
  const { field, scale, bands } = report;
  const width = field.width;
  const height = field.height + LEGEND_GAP + LEGEND_HEIGHT;
  const bytes = new Uint8Array(width * height * 4);

  fillRectangle(bytes, width, 0, 0, width, height, CHROME_BACKGROUND);

  for (let pixel = 0; pixel < field.sigma.length; pixel += 1) {
    const [r, g, b] = sampleRamp(field.sigma[pixel] / scale.maxSigma);
    const base = pixel * 4;
    bytes[base] = r;
    bytes[base + 1] = g;
    bytes[base + 2] = b;
    bytes[base + 3] = 255;
  }

  // Tick marks rather than full rules across the frame: a band boundary that overwrote a row of
  // data would hide the very cut it is there to help locate.
  for (const band of bands) {
    if (band.index === 1) continue;
    fillRectangle(bytes, width, 0, band.firstRow, BAND_TICK_LENGTH, 1, BAND_TICK_COLOUR);
    fillRectangle(
      bytes, width, width - BAND_TICK_LENGTH, band.firstRow, BAND_TICK_LENGTH, 1, BAND_TICK_COLOUR
    );
  }

  drawLegend(bytes, width, field.height + LEGEND_GAP);

  return { width, height, bytes };
}

// The ramp left-to-right, 0 at the left edge and scale.maxSigma at the right, with a notch every
// 10% so a reader can estimate a value off the bar. The σ each notch stands for is printed to
// stdout — there is no text renderer in this tool and inventing one to put four numbers under a
// colour bar would be a worse trade than printing them.
function drawLegend(bytes, width, top) {
  for (let x = 0; x < width; x += 1) {
    const [r, g, b] = sampleRamp(width === 1 ? 0 : x / (width - 1));
    for (let y = top; y < top + LEGEND_HEIGHT; y += 1) {
      const base = (y * width + x) * 4;
      bytes[base] = r;
      bytes[base + 1] = g;
      bytes[base + 2] = b;
      bytes[base + 3] = 255;
    }
  }

  for (let decile = 1; decile < 10; decile += 1) {
    const x = Math.round((decile / 10) * (width - 1));
    fillRectangle(bytes, width, x, top, 1, 6, CHROME_BACKGROUND);
  }
}

// Piecewise-linear interpolation between the ramp stops, in sRGB-encoded space — which is where
// the monotonicity was checked, so it is where the interpolation has to happen too.
function sampleRamp(t) {
  const position = t <= 0 ? 0 : t >= 1 ? 1 : t;

  let upper = 1;
  while (upper < RAMP_STOPS.length - 1 && RAMP_STOPS[upper].position < position) upper += 1;

  const from = RAMP_STOPS[upper - 1];
  const to = RAMP_STOPS[upper];
  const span = to.position - from.position;
  const mix = span === 0 ? 0 : (position - from.position) / span;

  return [
    Math.round(from.rgb[0] + (to.rgb[0] - from.rgb[0]) * mix),
    Math.round(from.rgb[1] + (to.rgb[1] - from.rgb[1]) * mix),
    Math.round(from.rgb[2] + (to.rgb[2] - from.rgb[2]) * mix),
  ];
}

// Clipped to the image, so a tick mark on a frame narrower than the tick is simply short rather
// than wrapping onto the next row and drawing a lie.
function fillRectangle(bytes, imageWidth, x0, y0, boxWidth, boxHeight, [r, g, b]) {
  const imageHeight = bytes.length / 4 / imageWidth;
  const lastX = Math.min(imageWidth, x0 + boxWidth);
  const lastY = Math.min(imageHeight, y0 + boxHeight);

  for (let y = Math.max(0, y0); y < lastY; y += 1) {
    for (let x = Math.max(0, x0); x < lastX; x += 1) {
      const base = (y * imageWidth + x) * 4;
      bytes[base] = r;
      bytes[base + 1] = g;
      bytes[base + 2] = b;
      bytes[base + 3] = 255;
    }
  }
}

// --- frame discovery --------------------------------------------------------------------------

/**
 * Resolves whatever the caller pointed at into an ordered list of frame files.
 *
 * capture.mjs writes `<out>/frames/frame-00001.png` (and only keeps them with --keep-frames), so
 * a capture directory is descended into automatically — pointing at `captures/idle` is what a
 * reader will try first and it should simply work.
 */
function findFramePaths(input, stride) {
  if (fs.existsSync(input) === false) throw new Error(`no such directory: ${input}`);
  if (fs.statSync(input).isDirectory() === false) {
    throw new Error(`${input} is a file. Point this at the directory of frames.`);
  }

  const nested = path.join(input, 'frames');
  const directory = fs.existsSync(nested) && fs.statSync(nested).isDirectory() ? nested : input;

  const entries = fs.readdirSync(directory).filter((name) => name.toLowerCase().endsWith('.png'));
  const numbered = entries.filter((name) => FRAME_NAME.test(name));
  const candidates = numbered.length > 0 ? numbered : entries.filter((name) => !NOT_A_FRAME.has(name));

  if (candidates.length === 0) {
    throw new Error(
      `${directory} holds no frames. capture.mjs only keeps its PNG sequence with --keep-frames.`
    );
  }
  if (candidates.length < 2) {
    throw new Error(`${directory} holds one frame. A temporal σ needs at least two.`);
  }

  const ordered = sortFrameNames(candidates).map((name) => path.join(directory, name));

  const strided = [];
  for (let index = 0; index < ordered.length; index += stride) strided.push(ordered[index]);
  if (strided.length < 2) {
    throw new Error(`--stride ${stride} leaves ${strided.length} of ${ordered.length} frames. Lower it.`);
  }
  return strided;
}

// Numeric order where the names carry a number, so frame-9 precedes frame-10 even unpadded;
// plain codepoint order otherwise. Never locale-aware — the ordering has to be identical on
// every machine or the "byte-identical PNG out" claim is not true.
function sortFrameNames(names) {
  const keyed = names.map((name) => ({ name, number: numberIn(name) }));
  const allNumbered = keyed.every((entry) => entry.number !== null);

  return keyed
    .sort((a, b) => {
      if (allNumbered && a.number !== b.number) return a.number - b.number;
      return a.name < b.name ? -1 : a.name > b.name ? 1 : 0;
    })
    .map((entry) => entry.name);
}

function numberIn(name) {
  const match = TRAILING_NUMBER.exec(name);
  return match ? Number(match[1]) : null;
}

// --- output -----------------------------------------------------------------------------------

function formatReport(report, options) {
  const lines = [];
  const { clip, coverage, scale } = report;

  lines.push('');
  lines.push(`frames    ${clip.frameCount}  (${clip.firstFrame} … ${clip.lastFrame}` +
    `${clip.stride > 1 ? `, every ${clip.stride}th` : ''})   ${clip.width}×${clip.height}`);
  lines.push(`source    ${clip.framesDirectory}`);
  lines.push(`σ         ${report.units}`);
  lines.push(
    `pixels    counted ${count(coverage.counted)} moving (${percent(coverage.countedFraction)})   ` +
      `skipped ${count(coverage.skippedStatic)} static, σ = 0 exactly ` +
      `(${percent(1 - coverage.countedFraction)})`
  );
  lines.push(
    `scale     0 → ${scale.maxSigma.toFixed(3)} σ   [${scale.mode}]   ` +
      `p${scale.percentile} of moving = ${scale.autoMax.toFixed(3)}, true max = ${scale.observedMax.toFixed(3)}`
  );
  lines.push(`          pin with --normalise ${scale.maxSigma.toFixed(3)} to put another clip on this exact scale`);
  lines.push('');

  lines.push(`ramp      ${RAMP_STOPS.map((stop) =>
    `σ ${(stop.position * scale.maxSigma).toFixed(2)} ${stop.name}`).join('   ')}`);
  lines.push('');

  lines.push(formatBandTable(report, options));

  // The frozen banner leads. On a frozen clip every band is also dead, and a reader who meets
  // "DEAD BANDS: 1..10" first will start reasoning about anatomy instead of about the capture.
  if (coverage.counted === 0) {
    lines.push('');
    lines.push('*** EVERY PIXEL IS FROZEN. σ is exactly 0 across the whole frame, so this heat map');
    lines.push('*** is a black rectangle and it is not evidence of anything. The clip is a still');
    lines.push('*** repeated, or the capture never stepped the simulation. Do not read the map.');
  } else if (report.deadBands.length > 0) {
    const dead = report.bands.filter((band) => report.deadBands.includes(band.index));
    lines.push('');
    lines.push(`*** DEAD BANDS: ${report.deadBands.join(', ')} — rows ` +
      `${dead[0].firstRow}–${dead[dead.length - 1].lastRow} are at least ` +
      `${percent(options.deadBandFraction)} below σ ${options.dead.toFixed(2)}.`);
    lines.push('*** Nothing there moved. If that is backdrop, fine. If the figure reaches into');
    lines.push('*** those rows, that part of the figure is a statue.');
  }

  lines.push('');
  lines.push(`  ${'heat map'.padEnd(13)} ${path.resolve(options.out)}`);
  if (options.jsonPath) lines.push(`  ${'json'.padEnd(13)} ${path.resolve(options.jsonPath)}`);
  lines.push('');

  return lines.join('\n');
}

function formatBandTable(report, options) {
  const header = ['band', 'rows', 'moving', 'mean σ', 'p99 σ', 'max σ', `dead% (σ<${options.dead.toFixed(2)})`];
  const rows = report.bands.map((band) => [
    String(band.index),
    `${band.firstRow}–${band.lastRow}`,
    percent(band.countedFraction),
    band.meanSigma.toFixed(3),
    band.p99Sigma.toFixed(3),
    band.maxSigma.toFixed(3),
    percent(band.deadFraction),
  ]);

  const widths = header.map((_, column) =>
    Math.max(header[column].length, ...rows.map((row) => row[column].length))
  );
  const render = (cells) => cells.map((cell, column) => cell.padStart(widths[column])).join('  ');

  return [render(header), ...rows.map(render)].join('\n');
}

function percent(fraction) {
  return `${(fraction * 100).toFixed(1)}%`;
}

// Grouped by hand rather than through toLocaleString: this tool's output is compared between
// runs, and a number that changes shape with the host's ICU data is a needless way to break that.
function count(value) {
  const digits = String(value);
  let grouped = '';
  for (let index = 0; index < digits.length; index += 1) {
    if (index > 0 && (digits.length - index) % 3 === 0) grouped += ',';
    grouped += digits[index];
  }
  return grouped;
}

// Progress goes to stderr so that stdout stays a clean, diffable report. A 2700-frame capture
// takes minutes and a tool that prints nothing for minutes looks hung.
function reportProgress(done, total) {
  if (total < 50 || process.stderr.isTTY !== true) return;
  if (done % 25 !== 0 && done !== total) return;
  process.stderr.write(`\r  frame ${String(done).padStart(5)}/${total}   `);
  if (done === total) process.stderr.write('\n');
}

// --- command line -----------------------------------------------------------------------------

function parseArguments(argv) {
  const options = { input: null, out: null, jsonPath: null, help: false, ...DEFAULTS };

  for (let index = 0; index < argv.length; index += 1) {
    const flag = argv[index];
    const value = argv[index + 1];

    switch (flag) {
      case '--out': options.out = value; index += 1; break;
      case '--json': options.jsonPath = value; index += 1; break;
      case '--normalise': case '--normalize':
        options.normalise = value === 'auto' ? 'auto' : Number(value);
        index += 1;
        break;
      case '--bands': options.bands = Number(value); index += 1; break;
      case '--dead': options.dead = Number(value); index += 1; break;
      case '--dead-band-fraction': options.deadBandFraction = Number(value); index += 1; break;
      case '--stride': options.stride = Number(value); index += 1; break;
      case '--fail-on-dead-bands': options.failOnDeadBands = true; break;
      case '--help': case '-h': options.help = true; break;
      default:
        if (flag.startsWith('-')) throw new Error(`unknown option "${flag}". Try --help.`);
        if (options.input !== null) throw new Error(`two input directories given: ${options.input} and ${flag}.`);
        options.input = flag;
    }
  }

  if (options.help) return options;
  if (options.input === null) throw new Error('no input directory. Try --help.');

  if (options.normalise !== 'auto' && (Number.isFinite(options.normalise) === false || options.normalise <= 0)) {
    throw new Error('--normalise must be "auto" or a positive σ in code values.');
  }
  if (Number.isInteger(options.bands) === false || options.bands < 1) {
    throw new Error('--bands must be a positive integer.');
  }
  if (Number.isFinite(options.dead) === false || options.dead < 0) {
    throw new Error('--dead must be a σ of zero or more, in code values.');
  }
  if (Number.isFinite(options.deadBandFraction) === false ||
      options.deadBandFraction <= 0 || options.deadBandFraction > 1) {
    throw new Error('--dead-band-fraction must be in (0, 1].');
  }
  if (Number.isInteger(options.stride) === false || options.stride < 1) {
    throw new Error('--stride must be a positive integer.');
  }

  if (options.out === null) options.out = path.join(options.input, 'heatmap.png');
  return options;
}

function usageText() {
  return [
    'heatmap.mjs — per-pixel temporal-σ heat map of a captured clip.',
    '',
    'Usage:',
    '  node tools/critic/heatmap.mjs <capture-dir> [options]',
    '',
    'The directory may be a capture root (its frames/ subdirectory is found automatically) or a',
    'directory of numbered PNGs. capture.mjs only keeps its frames with --keep-frames.',
    '',
    'Options:',
    `  --out <path>                heat map PNG               (<capture-dir>/heatmap.png)`,
    '  --json <path>               also write the numbers as JSON',
    `  --normalise auto|<σ>        σ at the top of the ramp   (${DEFAULTS.normalise})`,
    '                              auto prints its choice; pin it to compare two clips',
    `  --bands <n>                 horizontal bands           (${DEFAULTS.bands})`,
    `  --dead <σ>                  dead-pixel threshold, code values  (${DEFAULTS.dead})`,
    `  --dead-band-fraction <f>    band called dead at this dead%     (${DEFAULTS.deadBandFraction})`,
    `  --stride <n>                use every nth frame        (${DEFAULTS.stride})`,
    '  --fail-on-dead-bands        exit 1 if any band is dead, to use this as a gate',
    '',
    'Exit codes:  0 = the picture moved   1 = frozen clip or dead band   2 = tool error',
    '',
  ].join('\n');
}

// One catch-all at the boundary where measurement becomes output. fileURLToPath rather than a
// string compare, for the reason measure.mjs gives: this repository's path has a space and a
// non-ASCII character in it, so import.meta.url arrives percent-encoded.
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  try {
    process.exitCode = main(process.argv.slice(2));
  } catch (error) {
    process.stderr.write(`heatmap.mjs: ${error.message}\n`);
    if (process.env.DEBUG) process.stderr.write(`${error.stack}\n`);
    process.exitCode = 2;
  }
}

export {
  analyseClip,
  accumulateSigmaField,
  summariseBands,
  findFramePaths,
  renderHeatMap,
  sampleRamp,
  RAMP_STOPS,
  DEFAULTS,
};
