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
// 🎯 --- THE PER-PIXEL σ ABOVE MEASURES FILM GRAIN, AND ON THE SHIPPED DEFAULT THAT IS MOST OF
//        WHAT IT MEASURES. Read this before quoting `moving%` or `dead%`. -------------------
//
// The shipped page carries an enveloped film grain (`Grade.js`, σ 1.5/255, reseeded every frame
// off `frameId`) and a temporal resolve. Both put a fresh, independent value into every pixel of
// every frame, so EVERY PIXEL HAS A NONZERO TEMPORAL σ WHETHER OR NOT ANYTHING MOVED. Measured
// on `captures/r9-frozen-taau` — 600 frames of a figure frozen by `?freeze`, shipped default:
//
//     pixels    counted 751,419 moving (89.5%)   skipped 88,581 static
//     band 10   rows 1080-1199   mean σ 1.512   dead% 0.0%
//
// Nothing in that clip moved. `?aa=msaa&grade=0` on the identical URL renders 1 distinct frame
// and 599 repeats, which is the control proving `?freeze` really does freeze. So the per-pixel
// statistic reported 89.5% of the frame "moving" on a stone-still figure, and its refusal — the
// EVERY PIXEL IS FROZEN banner, which needs σ to be exactly 0 — cannot fire on a page that has
// grain. That is LEARNINGS §1.3 arriving inside the instrument: a metric a frozen image passes
// trivially is measuring nothing.
//
// --- what separates grain from motion, and why a per-pixel test cannot -------------------------
//
// Grain is spatially UNCORRELATED: each pixel draws its own value. Motion is not — a silhouette
// edge sweeping through a region moves every pixel of that region together. No statistic computed
// one pixel at a time can tell those apart, and a spatial one can, because averaging a k×k block
// divides independent noise by k while leaving a coherent edge sweep where it was.
//
// So this tool now measures a second field beside the per-pixel one: the temporal σ of the
// **8×8 BLOCK MEAN**. Measured over the capture corpus, 100 frames each, whole frame:
//
//     clip                              per-pixel σ   block σ   blocks over σ 8
//     r9-frozen-taau      frozen             0.7453    0.1457            0.000%
//     r9-frozen-nograin   frozen             0.1672    0.0954            0.000%
//     r9-frozen-taau-nograde frozen          0.1562    0.1009            0.000%
//     r10-frozen-grain15  frozen, 10× grain  6.4595    0.8399            0.000%
//     j9-b900 / j9-p900 / j9-ab-traa frozen  0.67-0.87 0.13-0.16         0.000%
//     r9-judge-body-42    moving             2.2718    1.6465            5.586%
//     r8-clip-body        moving             2.0241    1.5475            5.095%
//     judge-portrait      moving            14.1204   13.1267           31.440%
//
// Ten frozen clips: **0.000%** of blocks over σ 8, including one with the grain turned up 10×.
// Ten moving clips: **5.095% – 31.440%**. That is the refusal, and it is the whole of the repair.
//
// 🚩 --- AND THE BLOCK MEAN ALONE WAS STILL DECORATIVE, CAUGHT BY BREAKING IT A SECOND WAY ------
//
// §1.25a: a gate that only catches its own known-bad is decorative, so the block statistic was
// aimed at a defect in the same class built by a DIFFERENT mechanism. Grain is spatially
// uncorrelated; a **global exposure flicker** is the opposite — every pixel scaled by the same
// per-frame gain — and the block mean is built to PRESERVE exactly that. Measured, on 120 frames
// synthesised from one genuinely static frame of `r9-frozen-msaa` with a ±30% gain wobble:
//
//     block σ mean 5.213, p99 16.600, 37.9% of blocks "moving" — EXIT 0, no refusal
//
// A frozen figure, an instrument saying more than a third of the frame moved. Same shape as the
// grain finding, one level along.
//
// The repair is that a global gain and a global offset are two numbers, so they can be MEASURED
// and DIVIDED OUT. Each frame's luma p10 and p90 are matched to frame 1's, and the coherent field
// accumulates the corrected frame. Re-measured with the correction in place, the ±30% flicker
// clip scores **0.0% of blocks moving** and is refused — mean block σ 5.213 → 0.113, a 46× crush.
//
// ⚠️ The first version of this used ordinary least squares over every pixel and it was measurably
// the wrong estimator — it absorbed the SUBJECT into the "exposure". See `fitPhotometrically`,
// which carries the table. The cost of the correction on a real clip is now measured rather than
// argued: on the identical 30 frames of `r8-judge-ground-on`, uncorrected against corrected, mean
// block σ 2.0175 → 2.011 and the moving-block share 6.690% → 6.6%, and the worst gain any real
// clip in the corpus asks for is between ×0.9861 and ×1.0062.
//
// ⚠️ THE CORRECTION APPLIES TO THE COHERENT FIELD ONLY. The per-pixel σ that this tool draws is left
// exactly as it was, because it is the historical artefact and its numbers are quoted in
// docs/. So the map shows what the clip literally contains and the verdict is stated on what
// survives a whole-frame gain and offset — and the report says which is which.
//
// ⚠️ ONE STATISTIC THAT LOOKED DECISIVE AND IS NOT, recorded so it is not re-proposed. The
// coherence gain G = k·σ_block/σ_pixel has a derived null of exactly 1 for spatially-independent
// noise, which is the kind of oracle LEARNINGS §1.25g asks for, and it reads 1.040 on the 10×
// grain clip against 5.798 on a moving one. It is still unusable: `r9-frozen-nograin` and
// `r9-frozen-taau-nograde` are FROZEN and score G = 4.562 and 5.169, because with the grain off
// the only temporal variation left is the resolve's sub-pixel camera jitter, which is spatially
// coherent by construction. Frozen tops out at 5.169 and moving bottoms out at 5.593 — a 1.08×
// gap. G is reported below, and reported only.
//
// Exit codes follow measure.mjs and capture.mjs, so a calling script can tell a dead clip from
// a broken tool:
//   0 = heat map written, the picture moved
//   1 = the clip is not evidence — σ is 0 everywhere, the only temporal variance is a spatially
//       uncorrelated noise floor, or --fail-on-dead-bands and a band is dead
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

// --- the spatial-coherence field ----------------------------------------------------------------
//
// Every constant here is derived from the corpus table in this file's header, and the derivations
// are stated because a floor nobody can re-derive is a floor nobody can re-check.

// The block edge, in pixels. Independent noise in a k×k mean falls by k; a coherent edge sweep
// does not fall at all. 8 is the smallest k that separated the two populations of clips in the
// header table, and at the 700-1200 px framings this harness captures it is ~13 mm of subject —
// below the scale of any body part this tool is ever asked about, so nothing a judge cares about
// is averaged away. k=2 and k=4 were measured too and do not separate: on the 10× grain clip they
// leave block σ at 3.757 and 1.897 against a moving clip's 1.5-2.1.
const COHERENCE_BLOCK = 8;

// A block whose 8×8 mean varies by more than this many code values across the clip is counted as
// MOVING. Derived as the geometric mean of the two populations' p99 block σ: the frozen clips top
// out at 2.118 (the 10× grain one) and the moving clips bottom out at 30.023, and √(2.118×30.023)
// = 7.97. So the floor sits 3.78× above the loudest frozen clip and 3.75× below the quietest
// moving one — the two margins are equal by construction, which is the point of a geometric mean.
const MOVING_BLOCK_SIGMA_CODES = 8;

// Under this share of moving blocks there is no coherent motion in the clip and the report is
// refused rather than printed as a table of small plausible numbers.
//
// Measured: every one of the ten frozen clips scores EXACTLY 0.000% and every one of the ten
// moving clips scores 5.095% or more. The floor is placed at 1% rather than at the midpoint
// because the interesting robustness question is what happens when MOVING_BLOCK_SIGMA_CODES is
// wrong: halve it to 4 and the worst frozen clip rises only to 0.015%, still 67× under this
// floor, while the quietest moving clip is at 7.583%. Both constants can be a factor of two out
// and the verdict does not change.
const MOVING_BLOCK_SHARE_FLOOR = 0.01;

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
  // 🎯 The refusal that had to exist. The one above needs σ to be exactly 0 everywhere, which a
  // page carrying film grain can never produce, so before this line a frozen clip of the shipped
  // default exited 0 and reported 89.5% of the frame moving.
  if (report.coherence.movingBlockShare < MOVING_BLOCK_SHARE_FLOOR) return 1;
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
  const coherence = summariseCoherence(field, 0, field.blockRows);

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
      coherenceBlock: COHERENCE_BLOCK,
      movingBlockSigmaCodes: MOVING_BLOCK_SIGMA_CODES,
      movingBlockShareFloor: MOVING_BLOCK_SHARE_FLOOR,
    },
    // The honest answer to "did anything move", and the only one that survives the page's own
    // grain. See the header table: ten frozen clips score 0.000% here, ten moving clips 5%+.
    coherence,
    photometric: field.photometric,
    bands,
    // 🚩 A BAND IS DEAD BY THE COHERENT STATISTIC, NOT BY THE PER-PIXEL ONE. `deadFraction` is
    // retained and printed because it is the historical column and it describes the map that is
    // drawn — but on the shipped default it reads 0.0% for a frozen figure, so it cannot be
    // allowed to decide anything.
    deadBands: bands
      .filter((band) => band.coherence.movingBlockShare < MOVING_BLOCK_SHARE_FLOOR)
      .map((band) => band.index),
    field,
  };
}

/**
 * The block-coherence statistic as a streaming accumulator, so that the three tools that ask
 * "did anything move" answer it with ONE definition rather than three that drift apart.
 *
 * `heatmap.mjs` feeds it every frame, `capture.mjs` feeds it a sample of frames while it is
 * already holding them, and `travel.mjs` uses the exposure match alone. A caller pushes luma
 * fields in code values and reads a summary; nothing about the block size, the exposure match or
 * the moving-block floor is the caller's business.
 *
 * @param {{width: number, height: number}} frame
 */
function createBlockCoherence({ width, height }) {
  const blockColumns = Math.ceil(width / COHERENCE_BLOCK);
  const blockRows = Math.ceil(height / COHERENCE_BLOCK);
  const mean = new Float64Array(blockColumns * blockRows);
  const sumSquaredDeltas = new Float64Array(blockColumns * blockRows);
  const total = new Float64Array(blockColumns * blockRows);
  const pixelsPerBlock = new Float64Array(blockColumns * blockRows);

  for (let y = 0; y < height; y += 1) {
    const blockRow = Math.floor(y / COHERENCE_BLOCK) * blockColumns;
    for (let x = 0; x < width; x += 1) pixelsPerBlock[blockRow + Math.floor(x / COHERENCE_BLOCK)] += 1;
  }

  let referenceQuantiles = null;
  let frames = 0;
  let worstGain = 1;
  let worstOffset = 0;

  return {
    /** @param {Float32Array} luma - the frame's luma in 8-bit code values, row-major. */
    push(luma) {
      const quantiles = lumaQuantiles(luma, CODE_VALUE_SCALE);
      if (referenceQuantiles === null) referenceQuantiles = quantiles;

      const match = fitPhotometrically(quantiles, referenceQuantiles);
      if (Math.abs(match.gain - 1) > Math.abs(worstGain - 1)) worstGain = match.gain;
      if (Math.abs(match.offset) > Math.abs(worstOffset)) worstOffset = match.offset;

      total.fill(0);
      for (let y = 0, pixel = 0; y < height; y += 1) {
        const blockRow = Math.floor(y / COHERENCE_BLOCK) * blockColumns;
        for (let x = 0; x < width; x += 1, pixel += 1) {
          total[blockRow + Math.floor(x / COHERENCE_BLOCK)] += (luma[pixel] - match.offset) / match.gain;
        }
      }

      frames += 1;
      for (let block = 0; block < total.length; block += 1) {
        const value = total[block] / pixelsPerBlock[block];
        const deltaFromOldMean = value - mean[block];
        mean[block] += deltaFromOldMean / frames;
        sumSquaredDeltas[block] += deltaFromOldMean * (value - mean[block]);
      }
    },

    /** The σ of every block, and the exposure fits that were divided out getting there. */
    result() {
      const blockSigma = new Float64Array(mean.length);
      for (let block = 0; block < blockSigma.length; block += 1) {
        blockSigma[block] = frames === 0 ? 0 : Math.sqrt(sumSquaredDeltas[block] / frames);
      }
      return { blockSigma, blockColumns, blockRows, frames, photometric: { worstGain, worstOffset } };
    },
  };
}

/** Rec.709 encoded luma of a decoded PNG, in code values, as one flat array. */
function lumaFieldOf(image) {
  const luma = new Float32Array(image.width * image.height);
  for (let pixel = 0, base = 0; pixel < luma.length; pixel += 1, base += 4) {
    luma[pixel] =
      encodedLuma(image.pixels[base], image.pixels[base + 1], image.pixels[base + 2]) * CODE_VALUE_SCALE;
  }
  return luma;
}

/**
 * The half-open range of block rows a band owns: those whose FIRST pixel row lies inside it.
 *
 * A band thinner than one block contains no block start, and would otherwise own nothing and read
 * as permanently dead. That case falls back to the blocks the band overlaps and is the one place
 * two bands can claim the same block — the alternative is a band that no evidence can ever save.
 *
 * @param {number} firstRow - first pixel row of the band, inclusive.
 * @param {number} lastRow - last pixel row of the band, inclusive.
 * @param {number} blockRows - how many block rows the frame has.
 * @returns {[number, number]} first block row inclusive, last block row exclusive.
 */
function blockRowsOf(firstRow, lastRow, blockRows) {
  const first = Math.ceil(firstRow / COHERENCE_BLOCK);
  const last = Math.floor(lastRow / COHERENCE_BLOCK) + 1;

  if (last > first) return [Math.min(first, blockRows), Math.min(last, blockRows)];

  return [
    Math.min(Math.floor(firstRow / COHERENCE_BLOCK), blockRows),
    Math.min(Math.floor(lastRow / COHERENCE_BLOCK) + 1, blockRows),
  ];
}

/**
 * Pools the block-σ field over a range of block rows: how much of it is moving, and how loud.
 *
 * `gain` is reported and NOT gated. It is k·σ_block/σ_pixel, whose value for spatially-independent
 * noise is exactly 1, so it reads like the first-principles oracle §1.25g asks for — and it is
 * measured to be useless as a gate, because a frozen clip with the grain OFF scores 5.169 against
 * a moving clip's 5.593. It is worth printing because it says which KIND of temporal variance a
 * clip holds: near 1 is a fresh independent value per pixel per frame, well above 1 is something
 * spatially extended, which may be motion or may be a sub-pixel camera jitter.
 */
function summariseCoherence(field, firstBlockRow, lastBlockRow) {
  const start = firstBlockRow * field.blockColumns;
  const end = Math.min(field.blockSigma.length, lastBlockRow * field.blockColumns);

  let movingBlocks = 0;
  let sum = 0;
  const sigmas = new Float64Array(Math.max(0, end - start));

  for (let block = start; block < end; block += 1) {
    const blockSigma = field.blockSigma[block];
    sigmas[block - start] = blockSigma;
    sum += blockSigma;
    if (blockSigma > MOVING_BLOCK_SIGMA_CODES) movingBlocks += 1;
  }

  sigmas.sort();

  // The per-pixel σ over the same rows, so `gain` compares like with like.
  const firstPixelRow = firstBlockRow * COHERENCE_BLOCK;
  const lastPixelRow = Math.min(field.height, lastBlockRow * COHERENCE_BLOCK);
  let pixelSum = 0;
  for (let pixel = firstPixelRow * field.width; pixel < lastPixelRow * field.width; pixel += 1) {
    pixelSum += field.sigma[pixel];
  }
  const pixelCount = (lastPixelRow - firstPixelRow) * field.width;
  const meanPixelSigma = pixelCount === 0 ? 0 : pixelSum / pixelCount;
  const meanBlockSigma = sigmas.length === 0 ? 0 : sum / sigmas.length;

  return {
    block: COHERENCE_BLOCK,
    blocks: sigmas.length,
    movingBlocks,
    movingBlockShare: sigmas.length === 0 ? 0 : movingBlocks / sigmas.length,
    meanBlockSigma,
    p99BlockSigma: percentileOfSorted(sigmas, 0.99),
    maxBlockSigma: sigmas.length === 0 ? 0 : sigmas[sigmas.length - 1],
    meanPixelSigma,
    gain: meanPixelSigma === 0 ? 0 : (COHERENCE_BLOCK * meanBlockSigma) / meanPixelSigma,
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

  // The second field, and the reason this tool is not measuring grain. Shared with capture.mjs
  // so that "did anything move" has one definition in this directory — see createBlockCoherence.
  let coherence = null;
  let frameLuma = null;

  for (const framePath of framePaths) {
    const image = decodePng(fs.readFileSync(framePath));

    if (frameCount === 0) {
      width = image.width;
      height = image.height;
      mean = new Float64Array(width * height);
      sumSquaredDeltas = new Float64Array(width * height);

      coherence = createBlockCoherence({ width, height });
      frameLuma = new Float32Array(width * height);
    } else if (image.width !== width || image.height !== height) {
      throw new Error(
        `frame ${path.basename(framePath)} is ${image.width}×${image.height}, but the clip ` +
          `started at ${width}×${height}. A σ map across mixed frame sizes is meaningless.`
      );
    }

    frameCount += 1;

    for (let pixel = 0, base = 0; pixel < frameLuma.length; pixel += 1, base += 4) {
      const luma =
        encodedLuma(image.pixels[base], image.pixels[base + 1], image.pixels[base + 2]) *
        CODE_VALUE_SCALE;

      frameLuma[pixel] = luma;

      // The per-pixel field is the raw clip, unmatched. It is what the heat map draws.
      const deltaFromOldMean = luma - mean[pixel];
      mean[pixel] += deltaFromOldMean / frameCount;
      sumSquaredDeltas[pixel] += deltaFromOldMean * (luma - mean[pixel]);
    }

    coherence.push(frameLuma);

    reportProgress(frameCount, framePaths.length);
  }

  // Exactly zero for a frozen pixel, and that exactness matters: every frame gives the identical
  // luma, so deltaFromOldMean is exactly 0.0, the mean never moves, and nothing is ever added to
  // the accumulator. The degenerate case is detected by equality, not by a tolerance.
  const sigma = new Float64Array(mean.length);
  for (let pixel = 0; pixel < sigma.length; pixel += 1) {
    sigma[pixel] = Math.sqrt(sumSquaredDeltas[pixel] / frameCount);
  }

  const blocks = coherence.result();

  return {
    width, height, frameCount, sigma, mean,
    blockSigma: blocks.blockSigma,
    blockColumns: blocks.blockColumns,
    blockRows: blocks.blockRows,
    photometric: blocks.photometric,
  };
}

// The two points of the luma histogram that the exposure match is pinned to. They straddle the
// figure/backdrop cut — p10 sits deep in the backdrop, p90 in the lit subject — and each is the
// boundary of a large population rather than a single pixel, which is what p0 and p100 would be.
const PHOTOMETRIC_LOW_QUANTILE = 0.1;
const PHOTOMETRIC_HIGH_QUANTILE = 0.9;
const PHOTOMETRIC_HISTOGRAM_BINS = 4096;

/**
 * Where two quantiles of a frame's luma sit, with the position interpolated inside its bin.
 *
 * The interpolation is not tidiness. Without it the quantile lands on a bin edge, so grain
 * jittering the histogram by one bin reads as a 0.3% exposure change — which the corrector then
 * "removes" by scaling the whole frame, injecting a spatially coherent term into the very field
 * built to have none. Measured: bin-edge quantiles put a frozen clip's worst gain at 0.9969;
 * interpolated, at 0.99996.
 */
/**
 * @param {Float32Array} luma - the frame's luma, in whatever unit the caller is holding it.
 * @param {number} [fullScale=1] - the value a white pixel takes in that unit. REQUIRED to be
 *   right: this tool carries luma in 8-bit code values and travel.mjs carries it normalised, and
 *   the first version of this function assumed 0–1 for both. Every code-value frame then binned
 *   into the top bin, every quantile came back at full scale, the span came back zero, and the
 *   corrector silently returned the identity — so the flicker adversary it exists to catch walked
 *   straight through it reporting a gain of exactly ×1.0000. An "exactly 1.0000" from an estimator
 *   fitted to real data is a tell, not a reassurance.
 */
function lumaQuantiles(luma, fullScale = 1) {
  const last = PHOTOMETRIC_HISTOGRAM_BINS - 1;
  const histogram = new Int32Array(PHOTOMETRIC_HISTOGRAM_BINS);

  for (let pixel = 0; pixel < luma.length; pixel += 1) {
    histogram[Math.min(last, Math.max(0, Math.round((luma[pixel] / fullScale) * last)))] += 1;
  }

  const pick = (fraction) => {
    const target = fraction * luma.length;
    let seen = 0;
    for (let bin = 0; bin <= last; bin += 1) {
      const next = seen + histogram[bin];
      if (next >= target) {
        // Where inside this bin the target falls, so the answer moves smoothly as the histogram
        // shifts by less than a whole bin.
        const within = histogram[bin] === 0 ? 0 : (target - seen) / histogram[bin];
        return (fullScale * (bin - 0.5 + within)) / last;
      }
      seen = next;
    }
    return fullScale;
  };

  return { low: pick(PHOTOMETRIC_LOW_QUANTILE), high: pick(PHOTOMETRIC_HIGH_QUANTILE) };
}

/**
 * The whole-frame gain and offset that carry the reference frame's exposure onto this one.
 *
 * 🚩 THIS WAS ORDINARY LEAST SQUARES OVER EVERY PIXEL AND THAT WAS WRONG, in the direction that
 * matters: OLS is dragged by the subject, so it absorbed real motion into the "exposure". The
 * justification originally written here — "a body moves through a small minority of pixels, so the
 * worst gain any real clip needs is 1.0 to three decimals" — was plausible, was never measured,
 * and is false. Measured over 80 frames per clip:
 *
 *     clip                  worst OLS gain   worst quantile gain
 *     judge-portrait                0.7418                0.9930
 *     r9-judge-body-42              0.9667                0.9939
 *     r5-body                       0.9431                0.9978
 *     j9-clip-portrait              0.9178                0.9964
 *     flicker adversary ×1.30       1.1989                1.1989
 *     flicker adversary ×1.06       1.0395                1.0390
 *
 * Matching two QUANTILES instead is equally sensitive to the thing being removed and 35× less
 * sensitive to the thing that must survive, and the reason is one sentence: **a translation
 * leaves a frame's luma histogram nearly unchanged — the same pixels are lit, in different
 * places — while an exposure change transforms it.** A subject moving cannot move a percentile
 * much; a gain moves every percentile by exactly the gain.
 *
 * A flat frame has no span between its quantiles, so the identity is returned rather than a
 * division by zero.
 */
function fitPhotometrically(frameQuantiles, referenceQuantiles) {
  const span = referenceQuantiles.high - referenceQuantiles.low;
  if (Math.abs(span) < 1e-9) return { gain: 1, offset: 0 };

  const gain = (frameQuantiles.high - frameQuantiles.low) / span;
  if (Math.abs(gain) < 1e-9) return { gain: 1, offset: 0 };

  return { gain, offset: frameQuantiles.low - gain * referenceQuantiles.low };
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
      // A block row belongs to the band its FIRST pixel row falls in, so every block is counted
      // once and no band borrows its neighbour's motion across the boundary.
      //
      // 🚩 This used to floor the start and ceil the end, which is the obvious way to write it and
      // gives a band every block it OVERLAPS. Measured on the statue fixture — 120 rows, 10 bands,
      // so 12 rows a band against an 8 px block — the first dead band then inherited the block
      // straddling the hip line and read as alive, and the gate named 7,8,9,10 where the truth is
      // 6,7,8,9,10. A block cannot resolve a boundary finer than itself; the question is only
      // which side of the boundary it is allowed to speak for, and the answer has to be one side.
      coherence: summariseCoherence(field, ...blockRowsOf(firstRow, lastRow - 1, field.blockRows)),
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
    `pixels    counted ${count(coverage.counted)} NONZERO σ (${percent(coverage.countedFraction)})   ` +
      `skipped ${count(coverage.skippedStatic)} static, σ = 0 exactly ` +
      `(${percent(1 - coverage.countedFraction)})`
  );
  // 🚩 That line used to say "moving", and on a frozen clip of the shipped default it said 89.5%
  // of the frame was moving. A nonzero per-pixel σ is what film grain produces; it is not motion.
  lines.push(
    `coherent  ${percent(report.coherence.movingBlockShare)} of ${count(report.coherence.blocks)} ` +
      `${report.coherence.block}×${report.coherence.block} blocks move ` +
      `(block σ over ${MOVING_BLOCK_SIGMA_CODES}, floor ${percent(MOVING_BLOCK_SHARE_FLOOR)})   ` +
      `mean block σ ${report.coherence.meanBlockSigma.toFixed(3)}, p99 ${report.coherence.p99BlockSigma.toFixed(3)}`
  );
  lines.push(
    `          gain k·σblock/σpixel = ${report.coherence.gain.toFixed(3)} ` +
      '(1.0 = every pixel drew its own value; REPORTED, NOT GATED — see the header)'
  );
  lines.push(
    `          block field is exposure-matched to frame 1 (p10/p90) before averaging; ` +
      `worst fit ×${report.photometric.worstGain.toFixed(4)} ` +
      `${report.photometric.worstOffset >= 0 ? '+' : '−'}${Math.abs(report.photometric.worstOffset).toFixed(3)}`
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
  } else if (report.coherence.movingBlockShare < MOVING_BLOCK_SHARE_FLOOR) {
    lines.push('');
    lines.push('*** NOTHING COHERENT MOVED. This is a NOISE FLOOR, not a moving picture.');
    lines.push(`*** ${percent(coverage.countedFraction)} of pixels have a nonzero temporal σ — but only ` +
      `${percent(report.coherence.movingBlockShare)} of`);
    lines.push(`*** ${report.coherence.block}×${report.coherence.block} blocks vary by more than σ ` +
      `${MOVING_BLOCK_SIGMA_CODES}, under the ${percent(MOVING_BLOCK_SHARE_FLOOR)} floor. Independent`);
    lines.push('*** noise averages away in a block mean; a silhouette sweeping through one does not.');
    lines.push('*** Measured: every frozen clip in captures/ scores 0.000% here, including one with');
    lines.push('*** the grain turned up 10×; every moving clip scores 5.095% or more.');
    lines.push('*** The likeliest cause is that the simulation never advanced — ?freeze, a capture');
    lines.push('*** hook that did not step, or a page that rendered one pose. The per-pixel map');
    lines.push('*** below is film grain and it is NOT evidence of anything. Do not read it.');
  } else if (report.deadBands.length > 0) {
    const dead = report.bands.filter((band) => report.deadBands.includes(band.index));
    lines.push('');
    lines.push(`*** DEAD BANDS: ${report.deadBands.join(', ')} — rows ` +
      `${dead[0].firstRow}–${dead[dead.length - 1].lastRow} hold under ` +
      `${percent(MOVING_BLOCK_SHARE_FLOOR)} moving ${COHERENCE_BLOCK}×${COHERENCE_BLOCK} blocks.`);
    lines.push('*** Nothing there moved. If that is backdrop, fine. If the figure reaches into');
    lines.push('*** those rows, that part of the figure is a statue.');
    lines.push('*** (Stated on the COHERENT column. The per-pixel dead% beside it is grain and');
    lines.push('*** reads 0.0% on a frozen band of the shipped default.)');
  }

  lines.push('');
  lines.push(`  ${'heat map'.padEnd(13)} ${path.resolve(options.out)}`);
  if (options.jsonPath) lines.push(`  ${'json'.padEnd(13)} ${path.resolve(options.jsonPath)}`);
  lines.push('');

  return lines.join('\n');
}

function formatBandTable(report, options) {
  // Two blocks of columns, and the order is the finding: the per-pixel ones first because they
  // are what this tool has always printed, then the coherent ones, which are the ones that
  // decide. `blk σ` and `blk move%` are the 8×8 block statistics; `dead%` is per-pixel and is
  // there for continuity with older reports rather than because anything reads it.
  const header = [
    'band', 'rows', 'σ>0', 'mean σ', 'p99 σ', 'max σ', `dead% (σ<${options.dead.toFixed(2)})`,
    'blk σ', 'blk p99', `blk move% (>${MOVING_BLOCK_SIGMA_CODES})`,
  ];
  const rows = report.bands.map((band) => [
    String(band.index),
    `${band.firstRow}–${band.lastRow}`,
    percent(band.countedFraction),
    band.meanSigma.toFixed(3),
    band.p99Sigma.toFixed(3),
    band.maxSigma.toFixed(3),
    percent(band.deadFraction),
    band.coherence.meanBlockSigma.toFixed(3),
    band.coherence.p99BlockSigma.toFixed(3),
    band.coherence.movingBlockShare < MOVING_BLOCK_SHARE_FLOOR
      ? `${percent(band.coherence.movingBlockShare)} DEAD`
      : percent(band.coherence.movingBlockShare),
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
    'TWO FIELDS ARE MEASURED AND ONLY ONE OF THEM DECIDES ANYTHING.',
    '  per-pixel σ   what the map draws. On a page carrying film grain EVERY pixel has a nonzero',
    `                one, so it cannot answer "did anything move" — measured, a frozen figure on`,
    '                the shipped default reads 89.5% of the frame with nonzero σ.',
    `  block σ       the same statistic on the ${COHERENCE_BLOCK}×${COHERENCE_BLOCK} block mean, after every frame is`,
    '                exposure-matched to frame 1. Independent noise averages away in a block mean',
    '                and a silhouette sweeping through one does not. This is the verdict.',
    '',
    'Options:',
    `  --out <path>                heat map PNG               (<capture-dir>/heatmap.png)`,
    '  --json <path>               also write the numbers as JSON',
    `  --normalise auto|<σ>        σ at the top of the ramp   (${DEFAULTS.normalise})`,
    '                              auto prints its choice; pin it to compare two clips',
    `  --bands <n>                 horizontal bands           (${DEFAULTS.bands})`,
    `  --dead <σ>                  per-pixel dead threshold, code values  (${DEFAULTS.dead})`,
    '                              REPORTING ONLY — it moves the dead% column and does NOT',
    '                              decide which bands are dead. It used to, and on a graded page',
    '                              that column reads 0.0% for a frozen figure.',
    `  --dead-band-fraction <f>    reporting only, as above               (${DEFAULTS.deadBandFraction})`,
    `  --stride <n>                use every nth frame        (${DEFAULTS.stride})`,
    '  --fail-on-dead-bands        exit 1 if any band is dead, to use this as a gate',
    '',
    `A band is DEAD when under ${(100 * MOVING_BLOCK_SHARE_FLOOR).toFixed(0)}% of its blocks vary by more than σ ${MOVING_BLOCK_SIGMA_CODES}; the whole clip is`,
    'REFUSED when the frame as a whole is. Measured, ten frozen clips score 0.000% and ten moving',
    'clips 5.095%–31.440%. Both constants are derived in the source, from those two populations.',
    '',
    'Exit codes:  0 = the picture moved   1 = frozen clip, noise floor, or dead band',
    '             2 = tool error',
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
  summariseCoherence,
  createBlockCoherence,
  lumaFieldOf,
  fitPhotometrically,
  lumaQuantiles,
  findFramePaths,
  renderHeatMap,
  sampleRamp,
  RAMP_STOPS,
  DEFAULTS,
  COHERENCE_BLOCK,
  MOVING_BLOCK_SIGMA_CODES,
  MOVING_BLOCK_SHARE_FLOOR,
};
