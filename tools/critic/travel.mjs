#!/usr/bin/env node
//
// travel.mjs — how far the silhouette actually moves, in pixels.
//
// docs/PROGRESS.md records the Phase 2 full-body gate failing on a measurement this harness could
// not take: a weight shift moved the body *"~4.5 mm ML — 1.6 pixels at full-body framing.
// Side-by-side plates before and after a shift are indistinguishable."* That sentence is a
// distance, and nothing in tools/critic could produce one.
//
// ⚠️ heatmap.mjs CANNOT ANSWER THIS, and the reason is structural rather than a matter of tuning.
// Its per-pixel temporal σ SATURATES: the σ of a clip is dominated by silhouette-edge pixels,
// which already swing nearly the full 8-bit code range as the edge sweeps across them. Once a
// pixel alternates between backdrop and skin it cannot swing further, so moving the body twice as
// far leaves its σ almost unchanged. Measured (docs/LEARNINGS.md §1.10a) on two real captures of
// the same seed and framing, before and after a change that moved the lower body ~40% further:
// the head band's mean σ rose 1.5% while the actual on-screen travel rose 12%.
//
//   σ tells you WHETHER a region moves. It does not tell you HOW FAR.
//
// What tells you how far is the HORIZONTAL CENTROID OF THE SILHOUETTE, per frame. Threshold the
// figure against the backdrop, take the mean x of every silhouette pixel in a horizontal band, and
// watch that number across the clip. Its standard deviation and its peak-to-peak range, in pixels,
// are literally how far a viewer sees that part of the body travel. It does not saturate — it is a
// position, and a position has no ceiling.
//
// Three numbers per band, and each earns its place:
//
//   x SD / x p2p    the answer. Lateral travel, in pixels.
//   y SD / y p2p    vertical travel. A body that BOBS is a different defect from one that SWAYS,
//                   and separating them costs one extra accumulator.
//   area SD         a stability check on the measurement itself, not on the figure. The centroid
//                   is only meaningful if the threshold is catching the same silhouette every
//                   frame; an area that wanders means it is not, and the travel numbers are noise.
//                   It is also how a BREATHING figure is told from a SWAYING one — breathing moves
//                   area and leaves the centroid alone.
//
// Outputs:
//   stdout       the threshold and where it came from, the silhouette fraction, the band table
//   --json       the same numbers, machine-readable, for a gate script
//
// Usage:
//   node tools/critic/travel.mjs captures/judge-body
//   node tools/critic/travel.mjs captures/judge-body-after --threshold 0.3588 --stride 6
//
// 🚩 `auto` NO LONGER GUESSES, as of 2026-08-08. It picks Otsu's cut — the luma that maximises
// between-class variance, which has no tunable constant — and REFUSES the clip when the silhouette
// that cut produces swallows the frame (over 70%, against 24.3-60.3% for every real framing in
// captures/ and 89.5% for an all-figure crop). ⚠️ That refusal was FIRST written against Otsu's
// separability η and η was measured, later the same day, to separate the two populations
// BACKWARDS once the ground plane put a lit floor in shot — see the note at
// SILHOUETTE_REFUSE_HIGH_AUTO. The rule it replaced was `p5 + 0.20·(p99 − p5)`, three underived
// constants that put the cut at 0.1938 on a frame whose histogram valley is at 0.3588, which is why a judge
// pinned `--threshold 0.30` by hand on every measurement it took. Pinning is still honoured and is
// still the right thing when comparing two clips; it is no longer a workaround.
//
// Exit codes follow heatmap.mjs, measure.mjs and capture.mjs, so a calling script can tell a dead
// clip from a broken tool:
//   0 = travel measured, the silhouette moved
//   1 = the clip is not evidence — the threshold caught nothing or everything, auto refused to
//       guess on a frame that is all subject, or no band travelled at all; or
//       --fail-on-motionless and a band is a statue
//   2 = tool error (no frames, mismatched frame sizes, unreadable PNG, unparseable band table)

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { decodePng } from './png.mjs';
import { encodedLuma } from './color.mjs';
// Frame discovery is heatmap.mjs's, not a second copy of it: the two tools read the same capture
// directories and must agree on what a frame is, in what order, and how --stride thins them.
import { findFramePaths } from './heatmap.mjs';

// Bands are named for a standing figure at full-body framing, and given as fractions of frame
// height so the same table reads a 1200px capture and a 600px one. The gaps are deliberate — the
// interesting rows are the ones a viewer's eye lands on, and a band straddling the hip/thigh
// boundary averages two different motions into one uninformative number.
//
// `whole` is 0.05–0.95 rather than 0–1: the extreme rows at full-body framing hold the floor
// contact shadow and the top of the frame, neither of which is the body.
const DEFAULT_BANDS = [
  { name: 'head', top: 0.08, bottom: 0.2 },
  { name: 'shoulder', top: 0.2, bottom: 0.32 },
  { name: 'hip', top: 0.42, bottom: 0.52 },
  { name: 'knee', top: 0.62, bottom: 0.72 },
  { name: 'ankle', top: 0.82, bottom: 0.92 },
  // `foot` is rows 1110–1176 of a 1200 px capture — the band a judge measured the feet as welded
  // in. Unlike every other band it CAN contain the floor contact shadow, which is why `whole`
  // stops at 0.95. Read it beside the offline prediction in sway.selftest.mjs's GLANCE
  // LEGIBILITY table rather than alone: that table predicts a 15 s median horizontal travel of
  // 0.09–0.44 px across twelve seeds. (The advice that used to be here — "pin --threshold rather
  // than trusting auto" — was right about the old fixed-fraction rule and is superseded; `auto`
  // now finds the valley and refuses when there is not one. Pin to COMPARE two clips, not to
  // work around the tool.)
  { name: 'foot', top: 0.925, bottom: 0.98 },
  { name: 'whole', top: 0.05, bottom: 0.95 },
];

const DEFAULTS = {
  bands: DEFAULT_BANDS,
  threshold: 'auto',
  stride: 1,
  failOnMotionless: false,
};

// --- threshold selection ------------------------------------------------------------------------
//
// The threshold decides what counts as "the figure", so a threshold that is quietly wrong makes
// every number below it quietly wrong. It is therefore derived from the data, printed with the
// percentiles it came from, and pinnable — exactly the discipline heatmap.mjs uses for --normalise,
// and for the same reason: two clips can only be compared on the SAME basis.
//
// 🎯 THE OLD RULE, AND WHY IT WAS REPLACED ON 2026-08-08.
//
// It sat a fixed fraction of the way between two percentiles of the first frame:
// `p5 + 0.20 · (p99 − p5)`. Three constants, none of them derived from the image in front of it,
// and the symptom was that a judge pinned `--threshold 0.30` by hand on every measurement it
// took rather than trust `auto`. That judge was right, and the reason is measurable: on
// `captures/r5-body/frames/frame-00001.png` the histogram's actual valley — the luma that
// maximises between-class variance — is at **0.3588**, and the old rule put the cut at **0.1938**,
// down in the backdrop's own upper tail, 46% of the way to the valley from the wrong side.
//
// It survived because it was ROBUST rather than RIGHT. The silhouette edge is steep, so a cut
// anywhere in the wide empty gap between backdrop and figure catches the same pixels: measured,
// r6-body at its own auto 0.2218 and at r5-body's auto 0.1938 differ by 0.04 px of head travel
// on a 4.22 px SD. A gate can be wrong by 85% of the distance to the right answer and still print
// a presentable table, which is §1.3 with the degenerate input replaced by a degenerate constant.
//
// And where it is not robust it fails silently. Both percentiles are statistics of the WHOLE
// frame, so both move with the figure's AREA FRACTION — a framing choice, nothing to do with the
// figure. Measured on that one frame, cropping only:
//
//     rect                       p5      p99     old cut   Otsu    silhouette
//     whole frame (figure 25%)   0.0516  0.7626  0.1938    0.3588  24.3%
//     torso crop                 0.0552  0.7708  0.1983    0.3745  81.9%
//     a crop that is ALL figure  0.6661  0.7614  0.6852    0.7039  79.8%
//
// On the last row the cut has moved 3.54× and "the silhouette" is the lit 80% of a patch of skin.
// Nothing refused: `SILHOUETTE_WARN_HIGH` is 0.8 and a warning is not a refusal, so the tool
// would have reported the centroid of the LIT SIDE OF A CHEEK, which tracks the lighting rather
// than the body, as travel — in pixels, to two decimal places.
//
// --- what replaced it -------------------------------------------------------------------------
//
// Otsu's method: the cut that maximises between-class variance. It has NO free constant — there
// is nothing to tune and nothing to justify in a comment — and it finds the valley wherever the
// valley is, so it is invariant to the figure's area fraction over the whole range where a valley
// exists. Measured across four crops of the same frame it moves 0.3588 → 0.3863 (7.7%) where the
// silhouette it defines stays the silhouette; the old rule's apparent stability over the same
// crops was stability of a number that was in the wrong place to begin with.
//
// The refusal is the other half, and it is what "make it refuse to guess" means. Otsu always
// returns a cut, including on a histogram with no valley at all, so the cut alone is not evidence.
// η — the between-class variance it achieved as a fraction of the total variance — is the
// separability of the two classes it found, and it is the number that says whether there were two
// classes. Measured, on real frames and on the degenerate crop:
//
//     whole body frame  0.9720      whole portrait frame  0.9790
//     padded body       0.9633      r6-body whole         0.9695
//     torso crop        0.9542      head crop             0.9685
//     ALL-FIGURE CROP   0.7132   ← the one with no backdrop in it
//
// Six real framings span 0.9542–0.9790; the degenerate one scores 0.7132. The floor sat at 0.90,
// between them, 4.7% below the worst real reading and 26% above the degenerate one.
//
// 🚩 --- AND η STOPPED WORKING THE DAY THE FLOOR BECAME A LIT SURFACE ---------------------------
//
// Every one of those seven readings is a crop of ONE frame from `captures/r5-body`, taken before
// the figure stood on anything. That is §1.1a exactly: a threshold sized on a narrower sample than
// the population it gates. Re-measured 2026-08-08 across the WHOLE capture set and on the current
// build, η no longer separates the two populations — **it separates them backwards**:
//
//     clip                                              η        silhouette
//     r5/r6/r7/judge-* (pre-shading, two-class)   0.9683–0.9798    24.3–60.3%
//     r8-judge-body seed-42 / seed-4242           0.8922 / 0.8920      —      ← REFUSED
//     r8-clip-body                                    0.8794           —      ← REFUSED
//     current build, full body, shipped defaults      0.8936        36.7%     ← REFUSED
//     current build, ALL-FIGURE CROP, no backdrop     0.9030        89.5%     ← ACCEPTED
//
// The last two rows are the whole argument. The degenerate crop the floor exists to catch scores
// HIGHER than the real full-body frame it is meant to admit, so no floor can be placed between
// them and the statistic has failed, not the calibration.
//
// The cause is not a defect: η is the variance explained by the best TWO-class split, and the
// scene now has THREE luma classes — near-black backdrop, lit floor, lit figure. Punch-list 3.8's
// ground plane put the floor in shot and this round's lighting work took it from linear luma
// 0.0534 to 0.1687. A two-class model necessarily explains less of a three-class frame. **η going
// down is the scene getting richer, which is the opposite of the degeneracy it was read as.**
//
// --- what refuses now, and why it is the right statistic --------------------------------------
//
// The degeneracy being guarded against is "the crop is all figure, so the cut lands inside the
// subject and the silhouette is the LIT PART of it". That has a direct signature — the silhouette
// swallows the frame — and the silhouette fraction measures it without a model of the histogram:
//
//     real framings, every clip in captures/ plus the current build   24.3% – 60.3%
//     torso crop (mostly figure)                                          81.9%
//     all-figure crop, no backdrop, current build                         89.5%
//
// `SILHOUETTE_REFUSE_HIGH_AUTO` sits at 0.70: 16% above the worst real reading and 16% below the
// mildest degenerate one.
//
// --- BUT THE TWO STATISTICS SEE DIFFERENT DEGENERACIES, SO BOTH REFUSE -------------------------
//
// The silhouette fraction cannot see a frame whose histogram has no valley at all. Measured on the
// two synthetic single-class frames `travel.selftest.mjs` builds — a smooth luma gradient, and a
// unimodal noise field — Otsu cuts them near the middle and the "silhouette" is about half the
// frame, which is a perfectly ordinary-looking number:
//
//     frame                              eta      silhouette
//     synthetic gradient, one class     0.7500       50.5%     <- silhouette rule is BLIND
//     synthetic noise, one class        0.7498       48.3%     <- silhouette rule is BLIND
//     all-figure crop, current build    0.9030       89.5%     <- eta is BLIND
//     real framings, all of captures/   0.8794+      18.9-60.3%
//
// Neither statistic dominates and each is blind to what the other catches, so both refuse:
//
//   * eta below `MINIMUM_SEPARABILITY` — the histogram has no valley, so the cut is a fiction.
//     Re-derived over the widened population: 0.80 sits 6.7% below the worst real reading (0.8794)
//     and 6.7% above the worst synthetic one (0.7498). The old 0.90 was above three real clips.
//   * silhouette over `SILHOUETTE_REFUSE_HIGH_AUTO` — there IS a valley, and the cut fell inside
//     the subject.
//
// η is still printed either way, because a reader comparing two clips wants it.
const THRESHOLD_HISTOGRAM_BINS = 256;
const SILHOUETTE_REFUSE_HIGH_AUTO = 0.70;
const MINIMUM_SEPARABILITY = 0.80;

// Kept only for the diagnostic line that prints the old rule's answer beside the new one, so a
// reader comparing against an older report can see how far apart the two bases are. Nothing
// depends on these.
const LEGACY_LOW_PERCENTILE = 5;
const LEGACY_HIGH_PERCENTILE = 99;
const LEGACY_FRACTION = 0.2;

// Below this separation between the extremes there is no figure to distinguish from a backdrop,
// and any threshold picked from the histogram is a fiction. An all-black clip and an all-white
// clip both land here — refused, rather than reported as zero travel. Retained from the old rule
// because it catches the flat-frame case one step earlier than η does, and more legibly.
const MINIMUM_SEPARATION = 0.05;

// A silhouette this small or this large is not a standing figure; it is a threshold that missed.
// The refuse bounds catch "caught nothing" and "caught the whole frame"; the warn bounds catch the
// subtler misses, where a real but wrong region is being tracked.
const SILHOUETTE_REFUSE_LOW = 0.001;
const SILHOUETTE_REFUSE_HIGH = 0.999;
// A band this full is not holding a body part against a backdrop; the silhouette has swallowed
// the band and its centroid is the band's own centre by construction. Measured at integration:
// with the lit ground plane above the cut, `ankle` fills 100.0% and `foot` 99.5% and both report
// x = 449.5 on a 900 px frame. Real bands holding a limb measure 8.9-31.7%.
const BAND_FULL_WARN = 0.90;

const SILHOUETTE_WARN_LOW = 0.02;
const SILHOUETTE_WARN_HIGH = 0.8;

// --- entry point --------------------------------------------------------------------------------

function main(argv) {
  const options = parseArguments(argv);
  if (options.help) {
    process.stdout.write(usageText());
    return 0;
  }

  const framePaths = findFramePaths(options.input, options.stride);
  const report = analyseClip(framePaths, options);

  if (options.jsonPath) {
    fs.mkdirSync(path.dirname(options.jsonPath), { recursive: true });
    fs.writeFileSync(options.jsonPath, `${JSON.stringify(report, null, 2)}\n`);
  }

  process.stdout.write(formatReport(report, options));

  // §1.3: a metric a degenerate input passes trivially is measuring nothing. A frozen clip and a
  // clip whose threshold caught the backdrop both produce a perfectly presentable table of small
  // plausible numbers. Say what happened; do not print the table and hope it is read carefully.
  if (report.verdict.refused) return 1;
  if (options.failOnMotionless && report.motionlessBands.length > 0) return 1;
  return 0;
}

// --- measurement ----------------------------------------------------------------------------------

/**
 * Reads every frame once and returns the full diagnostic: the threshold and its provenance, how
 * much of the frame the silhouette covered, and the per-band travel statistics.
 */
function analyseClip(framePaths, options) {
  const firstFrame = decodePng(fs.readFileSync(framePaths[0]));
  const threshold = chooseThreshold(firstFrame, options.threshold);

  // The histogram refusal has to happen before any measurement: on an all-black or all-white clip
  // there is no threshold that separates anything, and every number downstream would be an
  // artefact of an arbitrary cut.
  if (threshold.refused) {
    return degenerateReport(framePaths, firstFrame, options, threshold, {
      refused: true,
      // Two distinct findings, not two shades of one: a frame with no dynamic range at all, and a
      // frame with plenty of range and only one class in it. The second is the one the old rule
      // could not see, and it is the one that produced a presentable table of small plausible
      // numbers about the lit side of a cheek.
      reason: threshold.refusedBecause === 'no-two-classes' ? 'no-two-classes' : 'no-separation',
    });
  }

  const bands = resolveBands(options.bands, firstFrame.height);
  const measurement = measureFrames(framePaths, threshold.luma, bands, firstFrame);
  const summarised = summariseBands(bands, measurement);

  const silhouette = {
    meanFraction: measurement.silhouette.mean / measurement.framePixels,
    minFraction: measurement.silhouette.min / measurement.framePixels,
    maxFraction: measurement.silhouette.max / measurement.framePixels,
  };

  return {
    clip: clipSummary(framePaths, firstFrame, options),
    units: 'pixels of the captured frame; centroid of the thresholded silhouette',
    threshold,
    silhouette,
    bands: summarised,
    motionlessBands: summarised
      .filter((band) => band.observedFrames >= 2 && band.x.sd === 0 && band.y.sd === 0)
      .map((band) => band.name),
    verdict: judge(silhouette, summarised, threshold.mode.startsWith('auto')),
  };
}

/**
 * Picks the luma that separates figure from backdrop, or refuses.
 *
 * Reads only the FIRST frame. That is deliberate: the threshold must be one fixed number for the
 * whole clip, because a per-frame threshold would chase the very brightness changes the area
 * stability check exists to detect, and a silhouette that redefines itself each frame has no
 * centroid worth differencing.
 */
function chooseThreshold(image, requested) {
  const pixelCount = image.width * image.height;
  const lumas = new Float64Array(pixelCount);
  for (let pixel = 0, base = 0; pixel < pixelCount; pixel += 1, base += 4) {
    lumas[pixel] = encodedLuma(image.pixels[base], image.pixels[base + 1], image.pixels[base + 2]);
  }
  lumas.sort();

  const lowValue = percentileOfSorted(lumas, LEGACY_LOW_PERCENTILE / 100);
  const highValue = percentileOfSorted(lumas, LEGACY_HIGH_PERCENTILE / 100);
  const separation = highValue - lowValue;
  const automatic = requested === 'auto';

  const otsu = otsuThreshold(lumas);

  return {
    mode: automatic ? 'auto (Otsu)' : 'pinned',
    luma: automatic ? otsu.luma : requested,
    separability: otsu.separability,
    separabilityFloor: MINIMUM_SEPARABILITY,
    // Reported so a reader holding an older report can see how far apart the two bases are.
    // Nothing is decided by it.
    legacyRuleWouldHavePicked: lowValue + LEGACY_FRACTION * separation,
    lowPercentile: LEGACY_LOW_PERCENTILE,
    highPercentile: LEGACY_HIGH_PERCENTILE,
    lowValue,
    highValue,
    separation,
    fraction: LEGACY_FRACTION,
    // A pinned threshold is the operator's decision and is honoured even on a flat frame — the
    // silhouette-fraction check downstream still catches it. Only auto refuses here, because auto
    // would otherwise invent a cut in a histogram that has no valley to cut at.
    //
    // TWO refusals here, because they are two different findings: a frame with no dynamic range
    // at all, and a frame with plenty of range and only one class in it. A THIRD lives in
    // `judge()` — a cut that fell inside the subject — because it needs the silhouette, which is
    // not known until the frames have been measured. See the note at SILHOUETTE_REFUSE_HIGH_AUTO
    // for why one statistic could not do both jobs.
    refused: automatic && (separation < MINIMUM_SEPARATION || otsu.separability < MINIMUM_SEPARABILITY),
    refusedBecause: automatic === false ? null
      : separation < MINIMUM_SEPARATION ? 'no-dynamic-range'
        : otsu.separability < MINIMUM_SEPARABILITY ? 'no-two-classes'
          : null,
  };
}

/**
 * Otsu's cut, plus the separability η that says whether the cut means anything.
 *
 * The method is the boring, forty-year-old primitive for exactly this question: of every possible
 * cut, take the one that maximises the variance BETWEEN the two classes it creates. It has no
 * tunable constant, which is the whole reason it is here — the rule it replaced had three.
 *
 * η = σ²between / σ²total, in [0, 1]. It is the fraction of the image's luma variance that the
 * split explains. A figure against a backdrop explains nearly all of it (measured 0.954–0.979
 * across six real framings); a single-class patch cannot (0.713 on an all-figure crop), because
 * there is no split that explains a unimodal spread. That is the difference between "the cut is
 * here" and "there is a cut", and only the second entitles anything downstream to a number.
 *
 * @param {Float64Array} sortedLumas - encoded luma of every pixel, ascending.
 * @returns {{luma: number, separability: number}}
 */
function otsuThreshold(sortedLumas) {
  const bins = THRESHOLD_HISTOGRAM_BINS;
  const last = bins - 1;
  const histogram = new Float64Array(bins);
  for (const luma of sortedLumas) {
    const bin = Math.round(Math.min(1, Math.max(0, luma)) * last);
    histogram[bin] += 1;
  }

  const total = sortedLumas.length;
  let sumAll = 0;
  for (let bin = 0; bin < bins; bin += 1) sumAll += (bin / last) * histogram[bin];
  const mean = sumAll / total;

  let varianceTotal = 0;
  for (let bin = 0; bin < bins; bin += 1) {
    varianceTotal += histogram[bin] * ((bin / last) - mean) ** 2;
  }
  varianceTotal /= total;

  let weightBelow = 0;
  let sumBelow = 0;
  let bestBetween = -1;
  let bestBin = 0;

  for (let bin = 0; bin < last; bin += 1) {
    weightBelow += histogram[bin];
    sumBelow += (bin / last) * histogram[bin];
    const weightAbove = total - weightBelow;
    if (weightBelow === 0 || weightAbove === 0) continue;

    const meanBelow = sumBelow / weightBelow;
    const meanAbove = (sumAll - sumBelow) / weightAbove;
    const between = (weightBelow / total) * (weightAbove / total) * (meanBelow - meanAbove) ** 2;

    if (between > bestBetween) {
      bestBetween = between;
      bestBin = bin;
    }
  }

  // Half a bin above the last bin of the lower class: the cut belongs between the two bins it
  // separates, not on either of them.
  return {
    luma: (bestBin + 0.5) / last,
    separability: varianceTotal === 0 ? 0 : Math.max(0, bestBetween) / varianceTotal,
  };
}

/**
 * One streaming pass over the clip. Peak memory is one decoded frame plus a handful of
 * accumulators, not the whole clip — the same property that makes heatmap.mjs tractable on a
 * 2700-frame capture.
 */
function measureFrames(framePaths, threshold, bands, firstFrame) {
  const width = firstFrame.width;
  const height = firstFrame.height;

  const trackers = bands.map(() => ({
    x: makeSeriesTracker(),
    y: makeSeriesTracker(),
    area: makeSeriesTracker(),
    coverage: makeSeriesTracker(),
    emptyFrames: 0,
  }));
  const silhouette = makeSeriesTracker();

  let frameIndex = 0;
  for (const framePath of framePaths) {
    const image = frameIndex === 0 ? firstFrame : decodePng(fs.readFileSync(framePath));
    if (image.width !== width || image.height !== height) {
      throw new Error(
        `frame ${path.basename(framePath)} is ${image.width}×${image.height}, but the clip ` +
          `started at ${width}×${height}. Travel in pixels across mixed frame sizes is meaningless.`
      );
    }

    bands.forEach((band, index) => {
      const totals = accumulateBand(image, threshold, band);
      const tracker = trackers[index];

      if (totals.count === 0) {
        tracker.emptyFrames += 1;
        return;
      }
      pushSample(tracker.x, totals.sumX / totals.count);
      pushSample(tracker.y, totals.sumY / totals.count);
      pushSample(tracker.area, totals.count);
      pushSample(tracker.coverage, totals.count / (width * (band.lastRow - band.firstRow + 1)));
    });

    // Bands overlap (`whole` contains all the others), so the per-frame silhouette count is taken
    // over the whole frame rather than summed from the bands — a sum would double-count and could
    // push the coverage warning past 100% on a perfectly good clip.
    pushSample(silhouette, countSilhouette(image, threshold));

    frameIndex += 1;
    reportProgress(frameIndex, framePaths.length);
  }

  return { trackers, silhouette, framePixels: width * height, frameCount: frameIndex };
}

/**
 * Sums x, y and pixel count of the silhouette inside one horizontal band of one frame.
 *
 * Integer sums in a Float64: for a 700×1200 frame the largest possible sumX is under 6×10⁸, well
 * inside the 2⁵³ range where a double holds integers exactly. The centroid is therefore one
 * correctly-rounded division of two exact integers — identical on every machine, which is what
 * "same frames in, same numbers out" rests on.
 */
function accumulateBand(image, threshold, band) {
  let sumX = 0;
  let sumY = 0;
  let count = 0;

  for (let y = band.firstRow; y <= band.lastRow; y += 1) {
    let base = y * image.width * 4;
    for (let x = 0; x < image.width; x += 1, base += 4) {
      const luma = encodedLuma(image.pixels[base], image.pixels[base + 1], image.pixels[base + 2]);
      if (luma >= threshold) {
        sumX += x;
        sumY += y;
        count += 1;
      }
    }
  }

  return { sumX, sumY, count };
}

function countSilhouette(image, threshold) {
  let count = 0;
  const pixelCount = image.width * image.height;
  for (let pixel = 0, base = 0; pixel < pixelCount; pixel += 1, base += 4) {
    if (encodedLuma(image.pixels[base], image.pixels[base + 1], image.pixels[base + 2]) >= threshold) {
      count += 1;
    }
  }
  return count;
}

/**
 * Welford's online mean and sum of squared deltas, plus the running extremes.
 *
 * Welford for the same reason heatmap.mjs gives, and the case here is worse: a centroid of order
 * 350 px with a standard deviation of order 0.3 px. A naive Σx² accumulator ends by subtracting two
 * numbers that agree to six figures, and the digits it cancels away ARE the answer.
 *
 * It also gives the degenerate case for free and EXACTLY: if every frame yields the same centroid,
 * every delta is exactly 0.0, the mean never moves, and nothing is ever added — so a frozen band
 * reads sd === 0 by equality, not by a tolerance.
 */
function makeSeriesTracker() {
  return { count: 0, mean: 0, sumSquaredDeltas: 0, min: Infinity, max: -Infinity };
}

function pushSample(tracker, value) {
  tracker.count += 1;
  const deltaFromOldMean = value - tracker.mean;
  tracker.mean += deltaFromOldMean / tracker.count;
  tracker.sumSquaredDeltas += deltaFromOldMean * (value - tracker.mean);
  if (value < tracker.min) tracker.min = value;
  if (value > tracker.max) tracker.max = value;
}

// Population σ, not sample σ: the clip IS the population. We are describing the travel this clip
// contains, not estimating the travel of a wider population of clips it was drawn from.
function summariseTracker(tracker) {
  if (tracker.count === 0) return { mean: 0, sd: 0, peakToPeak: 0, min: 0, max: 0 };
  return {
    mean: tracker.mean,
    sd: Math.sqrt(tracker.sumSquaredDeltas / tracker.count),
    peakToPeak: tracker.max - tracker.min,
    min: tracker.min,
    max: tracker.max,
  };
}

function summariseBands(bands, measurement) {
  return bands.map((band, index) => {
    const tracker = measurement.trackers[index];
    const area = summariseTracker(tracker.area);

    return {
      name: band.name,
      top: band.top,
      bottom: band.bottom,
      firstRow: band.firstRow,
      lastRow: band.lastRow,
      observedFrames: tracker.x.count,
      emptyFrames: tracker.emptyFrames,
      // 🚩 WHAT FRACTION OF THE BAND THE SILHOUETTE FILLS, and it is not cosmetic. A band the
      // silhouette FILLS has a centroid pinned to the band's own centre by construction: it cannot
      // move, and it reports a rock-steady number that looks like an excellent measurement of a
      // perfectly still body part. Measured 2026-08-08 at integration on a body plate with the
      // lit ground plane in shot — `ankle` 100.0% and `foot` 99.5% full, both reporting centroid
      // x = 449.5 on a 900 px frame, which is the frame centre to one decimal. The floor had risen
      // above the automatic cut and the two lowest bands were measuring it instead of the legs.
      // Nothing in the report said so, because every other statistic looked healthy.
      coverage: summariseTracker(tracker.coverage),
      x: summariseTracker(tracker.x),
      y: summariseTracker(tracker.y),
      area,
      // The area's own coefficient of variation. Under a few percent the silhouette is stable and
      // the centroid means what it says; well above that, the threshold is chasing the lighting.
      areaVariation: area.mean === 0 ? 0 : area.sd / area.mean,
    };
  });
}

/**
 * Turns the numbers into a verdict, so that a degenerate clip cannot be mistaken for a measurement.
 *
 * The three refusals are distinct findings, not shades of the same one, and the report says which:
 * a threshold that separated nothing, a threshold that caught nothing or everything, and a
 * silhouette that is genuinely there but genuinely does not travel.
 */
function judge(silhouette, bands, automatic) {
  const observed = bands.filter((band) => band.observedFrames >= 2);

  if (silhouette.meanFraction <= SILHOUETTE_REFUSE_LOW) {
    return { refused: true, reason: 'threshold-caught-nothing', travelled: false };
  }
  if (silhouette.meanFraction >= SILHOUETTE_REFUSE_HIGH) {
    return { refused: true, reason: 'threshold-caught-everything', travelled: false };
  }

  // The "all figure, no backdrop" degeneracy — a cut that landed inside the subject, so the
  // silhouette is the lit part of it. AUTO ONLY: a pin is the operator's claim, and the tool
  // honours a pin even on a frame it would not have chosen a cut for, exactly as it does above.
  if (automatic && silhouette.meanFraction >= SILHOUETTE_REFUSE_HIGH_AUTO) {
    return { refused: true, reason: 'silhouette-is-the-whole-subject', travelled: false };
  }
  if (observed.length === 0) {
    return { refused: true, reason: 'no-band-holds-the-figure', travelled: false };
  }

  const travelled = observed.some((band) => band.x.sd > 0 || band.y.sd > 0);
  if (travelled === false) {
    // A figure that changes shape without moving is a real and different thing from a still frame
    // repeated — breathing, not swaying — and conflating the two would hide a working capture.
    const changesShape = observed.some((band) => band.area.sd > 0);
    return {
      refused: true,
      reason: changesShape ? 'shape-changes-but-does-not-travel' : 'silhouette-frozen',
      travelled: false,
    };
  }

  return {
    refused: false,
    reason: 'travel-measured',
    travelled: true,
    implausibleSilhouette:
      silhouette.meanFraction < SILHOUETTE_WARN_LOW || silhouette.meanFraction > SILHOUETTE_WARN_HIGH,
  };
}

// A refusal still has to describe the clip it refused, or the reader cannot tell a broken capture
// from a broken threshold.
function degenerateReport(framePaths, firstFrame, options, threshold, verdict) {
  return {
    clip: clipSummary(framePaths, firstFrame, options),
    units: 'pixels of the captured frame; centroid of the thresholded silhouette',
    threshold,
    silhouette: { meanFraction: 0, minFraction: 0, maxFraction: 0 },
    bands: [],
    motionlessBands: [],
    verdict: { ...verdict, travelled: false },
  };
}

function clipSummary(framePaths, firstFrame, options) {
  return {
    framesDirectory: path.resolve(path.dirname(framePaths[0])),
    frameCount: framePaths.length,
    stride: options.stride,
    firstFrame: path.basename(framePaths[0]),
    lastFrame: path.basename(framePaths[framePaths.length - 1]),
    width: firstFrame.width,
    height: firstFrame.height,
  };
}

// --- bands ----------------------------------------------------------------------------------------

/**
 * Turns fractional band bounds into inclusive row ranges.
 *
 * Rounded rather than truncated at both ends so a band's row count matches its fraction of the
 * frame as closely as an integer can, and so two adjacent bands sharing a bound share a boundary
 * row rather than leaving a one-row gap between them.
 *
 * Validation lives HERE, at the one point every band table passes through, rather than only in the
 * two CLI parsers — a table handed straight to analyseClip by a gate script would otherwise reach
 * the measurement unchecked, and a band with no name prints as `undefined` in the report.
 * The parsers validate as well, so a bad --bands fails before 2700 frames are read.
 */
function resolveBands(bands, height) {
  return validateBands(bands).map((band) => {
    const firstRow = Math.max(0, Math.round(band.top * height));
    const lastRow = Math.min(height - 1, Math.round(band.bottom * height) - 1);
    if (lastRow < firstRow) {
      throw new Error(
        `band "${band.name}" (${band.top}–${band.bottom}) covers no rows of a ${height}px frame.`
      );
    }
    return { ...band, firstRow, lastRow };
  });
}

// Compact CLI form: `head:0.08-0.20,hip:0.42-0.52`. Chosen over requiring a file because the
// commonest edit is "move the hip band down a bit" and that should not need a scratch file.
function parseBandSpec(spec) {
  const bands = spec.split(',').map((entry) => {
    const match = /^\s*([A-Za-z][A-Za-z0-9_-]*)\s*:\s*([0-9.]+)\s*-\s*([0-9.]+)\s*$/.exec(entry);
    if (match === null) {
      throw new Error(`cannot read band "${entry.trim()}". Expected name:top-bottom, e.g. hip:0.42-0.52.`);
    }
    return { name: match[1], top: Number(match[2]), bottom: Number(match[3]) };
  });
  return validateBands(bands);
}

// File form: a JSON array of { name, top, bottom }, for a band table worth keeping under version
// control next to the gate that uses it.
function parseBandFile(filePath) {
  const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  if (Array.isArray(parsed) === false) {
    throw new Error(`${filePath} must hold a JSON array of { name, top, bottom } objects.`);
  }
  return validateBands(parsed);
}

function validateBands(bands) {
  if (bands.length === 0) throw new Error('the band table is empty.');
  for (const band of bands) {
    if (typeof band.name !== 'string' || band.name.length === 0) {
      throw new Error('every band needs a name — the report is read by band name, not by index.');
    }
    if (Number.isFinite(band.top) === false || Number.isFinite(band.bottom) === false) {
      throw new Error(`band "${band.name}" needs numeric top and bottom fractions.`);
    }
    if (band.top < 0 || band.bottom > 1 || band.top >= band.bottom) {
      throw new Error(
        `band "${band.name}" spans ${band.top}–${band.bottom}; bounds are fractions of frame ` +
          'height with 0 at the top, and top must be less than bottom.'
      );
    }
  }
  return bands;
}

function percentileOfSorted(sorted, fraction) {
  if (sorted.length === 0) return 0;
  const index = Math.ceil(fraction * sorted.length) - 1;
  return sorted[Math.min(sorted.length - 1, Math.max(0, index))];
}

// --- output -----------------------------------------------------------------------------------

function formatReport(report, options) {
  const lines = [];
  const { clip, threshold, silhouette, verdict } = report;

  lines.push('');
  lines.push(
    `frames     ${clip.frameCount}  (${clip.firstFrame} … ${clip.lastFrame}` +
      `${clip.stride > 1 ? `, every ${clip.stride}th` : ''})   ${clip.width}×${clip.height}`
  );
  lines.push(`source     ${clip.framesDirectory}`);
  lines.push(`travel     ${report.units}`);
  lines.push(
    `threshold  luma ${threshold.luma.toFixed(4)}   [${threshold.mode}]   ` +
      `separability eta ${threshold.separability.toFixed(4)} ` +
      `(floor ${threshold.separabilityFloor.toFixed(2)})   frame 1 spans ` +
      `p${threshold.lowPercentile} = ${threshold.lowValue.toFixed(4)} to ` +
      `p${threshold.highPercentile} = ${threshold.highValue.toFixed(4)}`
  );
  lines.push(
    `           pin with --threshold ${threshold.luma.toFixed(4)} to put another clip on this exact basis` +
      `   (the pre-2026-08-08 fixed-fraction rule would have picked ` +
      `${threshold.legacyRuleWouldHavePicked.toFixed(4)})`
  );

  if (report.bands.length > 0) {
    lines.push(
      `silhouette ${percent(silhouette.meanFraction)} of the frame  ` +
        `(min ${percent(silhouette.minFraction)}, max ${percent(silhouette.maxFraction)})`
    );
    lines.push('');
    lines.push(formatBandTable(report));
  }

  lines.push('');
  lines.push(...verdictLines(report, options));

  if (options.jsonPath) {
    lines.push('');
    lines.push(`  ${'json'.padEnd(13)} ${path.resolve(options.jsonPath)}`);
  }
  lines.push('');

  return lines.join('\n');
}

function formatBandTable(report) {
  const header = ['band', 'rows', 'x SD', 'x p2p', 'y SD', 'y p2p', 'area', 'area SD', 'area cv', 'full', 'empty'];
  const rows = report.bands.map((band) => [
    band.name,
    `${band.firstRow}–${band.lastRow}`,
    band.x.sd.toFixed(2),
    band.x.peakToPeak.toFixed(2),
    band.y.sd.toFixed(2),
    band.y.peakToPeak.toFixed(2),
    Math.round(band.area.mean).toString(),
    band.area.sd.toFixed(1),
    percent(band.areaVariation),
    // A band the silhouette fills reports the band's own centre and cannot move. Flagged rather
    // than merely printed, because the number it corrupts looks healthy.
    band.coverage.mean >= BAND_FULL_WARN ? `${percent(band.coverage.mean)}!` : percent(band.coverage.mean),
    band.emptyFrames === 0 ? '-' : String(band.emptyFrames),
  ]);

  const widths = header.map((_, column) =>
    Math.max(header[column].length, ...rows.map((row) => row[column].length))
  );
  // The band name reads as a label, so it is left-aligned; every other column is a number and
  // right-aligns so the decimal points line up down the table.
  const render = (cells) =>
    cells.map((cell, column) => (column === 0 ? cell.padEnd(widths[0]) : cell.padStart(widths[column]))).join('  ');

  return [render(header), ...rows.map(render)].join('\n');
}

/**
 * The banner. It leads with whatever makes the rest of the table unreadable, because a reader who
 * meets a plausible column of small numbers first will have finished reasoning about the figure's
 * anatomy before reaching the line that says the threshold missed.
 */
function verdictLines(report, options) {
  const lines = [];
  const { verdict, threshold, silhouette } = report;

  if (verdict.reason === 'no-separation') {
    lines.push('*** REFUSED: the first frame has no figure to separate from a backdrop.');
    lines.push(`*** p${threshold.lowPercentile} = ${threshold.lowValue.toFixed(4)} and ` +
      `p${threshold.highPercentile} = ${threshold.highValue.toFixed(4)} are ` +
      `${threshold.separation.toFixed(4)} apart, under the ${MINIMUM_SEPARATION} minimum.`);
    lines.push('*** A flat frame — all black, all white, or a page that never rendered — has no');
    lines.push('*** silhouette, so it has no centroid and no travel. This is NOT zero travel.');
    lines.push('*** Pin --threshold <luma> only if you know what the figure level is.');
    return lines;
  }

  if (verdict.reason === 'no-two-classes') {
    lines.push('*** REFUSED TO GUESS: this frame has dynamic range but only ONE class in it.');
    lines.push(`*** Otsu's best cut at luma ${threshold.luma.toFixed(4)} explains only ` +
      `eta = ${threshold.separability.toFixed(4)} of the frame's`);
    lines.push(`*** luma variance, under the ${threshold.separabilityFloor.toFixed(2)} floor. ` +
      'Every real clip in captures/ measures');
    lines.push('*** 0.879-0.980; a single-class gradient or noise field measures 0.750. There is');
    lines.push('*** no valley to cut at, so any silhouette here would be an arbitrary slice of a');
    lines.push('*** smooth field, and its centroid would track the shading rather than a body.');
    lines.push('*** Widen the framing so a backdrop is in shot, or pin --threshold if you know the');
    lines.push('*** figure level — a pin is honoured, and is your claim rather than the tool\'s.');
    return lines;
  }

  if (verdict.reason === 'silhouette-is-the-whole-subject') {
    lines.push(`*** REFUSED TO GUESS: the silhouette is ${percent(silhouette.meanFraction)} of the frame,`);
    lines.push(`*** over the ${percent(SILHOUETTE_REFUSE_HIGH_AUTO)} bound for an automatic threshold.`);
    lines.push('*** Every real framing in captures/ measures 24.3-60.3%; a crop that is all figure');
    lines.push('*** with no backdrop in it measures 89.5%. At this fraction the cut has landed');
    lines.push('*** INSIDE the subject, so the "silhouette" is the LIT PART of it and its centroid');
    lines.push('*** would track the lighting rather than the body.');
    lines.push('*** Widen the framing so a backdrop is in shot, or pin --threshold if you know the');
    lines.push('*** figure level — a pin is honoured, and is your claim rather than the tool\'s.');
    return lines;
  }

  if (verdict.reason === 'threshold-caught-nothing') {
    lines.push(`*** REFUSED: the threshold caught ${percent(silhouette.meanFraction)} of the frame.`);
    lines.push(`*** Nothing is above luma ${threshold.luma.toFixed(4)}, so there is no silhouette to`);
    lines.push('*** take a centroid of. Lower --threshold, or check the capture actually rendered.');
    return lines;
  }

  if (verdict.reason === 'threshold-caught-everything') {
    lines.push(`*** REFUSED: the threshold caught ${percent(silhouette.meanFraction)} of the frame.`);
    lines.push(`*** Everything is above luma ${threshold.luma.toFixed(4)}, so the "silhouette" is the`);
    lines.push('*** whole picture and its centroid is the frame centre by construction. Raise');
    lines.push('*** --threshold, or check the capture is not a blown-out white page.');
    return lines;
  }

  if (verdict.reason === 'no-band-holds-the-figure') {
    lines.push('*** REFUSED: no band saw the silhouette in two or more frames.');
    lines.push('*** The band table does not overlap the figure. Check the framing, then the bands.');
    return lines;
  }

  if (verdict.reason === 'silhouette-frozen') {
    lines.push('*** THE SILHOUETTE IS FROZEN. Every band reports x SD and y SD of EXACTLY 0, and the');
    lines.push('*** area never changes by one pixel. The clip is a still repeated, or the capture');
    lines.push('*** never stepped the simulation. There is no travel here to be small.');
    return lines;
  }

  if (verdict.reason === 'shape-changes-but-does-not-travel') {
    lines.push('*** THE SILHOUETTE CHANGES SHAPE BUT DOES NOT TRAVEL. Every band reports x SD and');
    lines.push('*** y SD of EXACTLY 0 while the area moves. Something is animating — breathing, a');
    lines.push('*** limb rotating in place — but the body is not going anywhere. That is a');
    lines.push('*** different defect from a dead rig, and a different one from a viewer-visible sway.');
    return lines;
  }

  if (report.motionlessBands.length > 0) {
    lines.push(`*** MOTIONLESS BANDS: ${report.motionlessBands.join(', ')} — x SD and y SD are EXACTLY 0`);
    lines.push('*** across the clip. Those rows of the figure are a statue. If the figure does not');
    lines.push('*** reach into them, fine; if it does, that part of it never moved by one pixel.');
    if (options.failOnMotionless === false) {
      lines.push('*** (--fail-on-motionless turns this into a non-zero exit.)');
    }
  }

  if (verdict.implausibleSilhouette) {
    lines.push(`*** IMPLAUSIBLE SILHOUETTE: ${percent(silhouette.meanFraction)} of the frame. A standing`);
    lines.push(`*** figure at full-body framing covers roughly a quarter. Outside ` +
      `${percent(SILHOUETTE_WARN_LOW)}–${percent(SILHOUETTE_WARN_HIGH)} the`);
    lines.push('*** threshold is probably tracking something that is not the body. Check it before');
    lines.push('*** reading the table.');
  }

  if (lines.length === 0) {
    lines.push(`travelled  the silhouette moved. Largest lateral SD: ` +
      `${largestTravelBand(report.bands)}.`);
  }

  return lines;
}

function largestTravelBand(bands) {
  let best = bands[0];
  for (const band of bands) {
    if (band.x.sd > best.x.sd) best = band;
  }
  return `${best.name} at ${best.x.sd.toFixed(2)} px SD, ${best.x.peakToPeak.toFixed(2)} px peak-to-peak`;
}

function percent(fraction) {
  return `${(fraction * 100).toFixed(1)}%`;
}

// Progress goes to stderr so that stdout stays a clean, diffable report. A 2700-frame capture takes
// minutes and a tool that prints nothing for minutes looks hung.
function reportProgress(done, total) {
  if (total < 50 || process.stderr.isTTY !== true) return;
  if (done % 25 !== 0 && done !== total) return;
  process.stderr.write(`\r  frame ${String(done).padStart(5)}/${total}   `);
  if (done === total) process.stderr.write('\n');
}

// --- command line -------------------------------------------------------------------------------

function parseArguments(argv) {
  const options = { input: null, jsonPath: null, help: false, ...DEFAULTS };

  for (let index = 0; index < argv.length; index += 1) {
    const flag = argv[index];
    const value = argv[index + 1];

    switch (flag) {
      case '--json': options.jsonPath = value; index += 1; break;
      case '--threshold':
        options.threshold = value === 'auto' ? 'auto' : Number(value);
        index += 1;
        break;
      case '--bands': options.bands = parseBandSpec(value ?? ''); index += 1; break;
      case '--bands-file': options.bands = parseBandFile(value ?? ''); index += 1; break;
      case '--stride': options.stride = Number(value); index += 1; break;
      case '--fail-on-motionless': options.failOnMotionless = true; break;
      case '--help': case '-h': options.help = true; break;
      default:
        if (flag.startsWith('-')) throw new Error(`unknown option "${flag}". Try --help.`);
        if (options.input !== null) throw new Error(`two input directories given: ${options.input} and ${flag}.`);
        options.input = flag;
    }
  }

  if (options.help) return options;
  if (options.input === null) throw new Error('no input directory. Try --help.');

  if (options.threshold !== 'auto' &&
      (Number.isFinite(options.threshold) === false || options.threshold <= 0 || options.threshold >= 1)) {
    throw new Error('--threshold must be "auto" or an encoded luma strictly between 0 and 1.');
  }
  if (Number.isInteger(options.stride) === false || options.stride < 1) {
    throw new Error('--stride must be a positive integer.');
  }

  return options;
}

function usageText() {
  return [
    'travel.mjs — how far the silhouette actually moves, in pixels.',
    '',
    'Usage:',
    '  node tools/critic/travel.mjs <capture-dir> [options]',
    '',
    'The directory may be a capture root (its frames/ subdirectory is found automatically) or a',
    'directory of numbered PNGs. capture.mjs only keeps its frames with --keep-frames.',
    '',
    'Reports, per horizontal band: the SD and peak-to-peak range of the silhouette\'s horizontal',
    'centroid (lateral travel), the same for its vertical centroid (bob), and the SD of the',
    'silhouette area (a stability check on the threshold, and how breathing is told from swaying).',
    '',
    'Options:',
    '  --json <path>            also write the numbers as JSON',
    `  --threshold auto|<luma>  figure/backdrop cut, encoded luma   (${DEFAULTS.threshold})`,
    `                           auto sits ${(THRESHOLD_FRACTION * 100).toFixed(0)}% of the way from ` +
      `p${THRESHOLD_LOW_PERCENTILE} to p${THRESHOLD_HIGH_PERCENTILE} of frame 1`,
    '                           and prints its choice; PIN IT to compare two clips',
    '  --bands <spec>           band table, compact form:',
    '                             head:0.08-0.20,hip:0.42-0.52',
    '                           bounds are fractions of frame height, 0 at the top',
    '  --bands-file <path>      band table as JSON: [{ "name", "top", "bottom" }, …]',
    `  --stride <n>             use every nth frame                 (${DEFAULTS.stride})`,
    '  --fail-on-motionless     exit 1 if any band never moved, to use this as a gate',
    '',
    `Default bands: ${DEFAULT_BANDS.map((band) => `${band.name} ${band.top}-${band.bottom}`).join(', ')}`,
    '',
    'Exit codes:  0 = the silhouette travelled   1 = not evidence (see the banner)   2 = tool error',
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
    process.stderr.write(`travel.mjs: ${error.message}\n`);
    if (process.env.DEBUG) process.stderr.write(`${error.stack}\n`);
    process.exitCode = 2;
  }
}

export {
  analyseClip,
  chooseThreshold,
  measureFrames,
  summariseBands,
  resolveBands,
  parseBandSpec,
  DEFAULT_BANDS,
  DEFAULTS,
  otsuThreshold,
  LEGACY_FRACTION,
  LEGACY_LOW_PERCENTILE,
  LEGACY_HIGH_PERCENTILE,
  MINIMUM_SEPARATION,
  MINIMUM_SEPARABILITY,
  SILHOUETTE_REFUSE_HIGH_AUTO,
};
