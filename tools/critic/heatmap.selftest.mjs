#!/usr/bin/env node
//
// heatmap.selftest.mjs — proves heatmap.mjs measures the σ it claims to.
//
// docs/LEARNINGS.md §1.1: *"A gate that has never failed is not known to work."* So every gate
// below is exercised in BOTH directions — the tool has to read the right number back off a clip
// whose answer is known in advance, AND it has to refuse the degenerate clips that a
// plausible-looking heat map would otherwise launder into evidence.
//
// Three kinds of oracle, and the distinction is the whole point:
//
//   ANALYTIC — a clip is synthesised with gaussian noise of known amplitude a, injected as a
//   gradient of amplitudes down the frame. The expected temporal σ is derived on paper, not
//   fitted to the tool's output:
//
//       σ_expected = √( (a² + 1/12) · (N−1)/N )
//
//   The 1/12 is the variance of the rounding to 8-bit code values (Widrow: quantising a smooth
//   variable adds an independent uniform(−½,½) error, variance 1/12 — valid here because every
//   amplitude used is ≳ 1 code value). The (N−1)/N is the bias of the POPULATION σ the tool
//   reports: E[σ̂²_pop] = σ²(N−1)/N exactly. Both terms are small, and both are included rather
//   than absorbed into a loose tolerance, because a tolerance wide enough to hide them is wide
//   enough to hide a real error too.
//
//   EXACT — for numerical precision, the reference is a two-pass float64 σ computed by this file
//   from the tool's own decoded pixels. That is the gold standard the streaming algorithm has to
//   match, and the same data run through a naive float32 Σx² accumulator is measured alongside
//   to show what the algorithm choice is actually buying.
//
//   DEGENERATE — a frozen still repeated N times, and a "living torso on a statue's legs". §1.3:
//   *"a metric a frozen image passes trivially is measuring nothing."* A σ map of a frozen clip
//   is a perfectly presentable black rectangle, so the tool must SAY it is frozen, not draw it.
//
// 🎯 --- AND THIS FILE USED GAUSSIAN NOISE AS ITS MODEL OF MOTION, WHICH IS THE DEFECT ----------
//
// Every fixture above builds "a region that moves" as `base + σ · gaussian()` — a fresh
// independent value in every pixel of every frame. That is not motion. It is exactly what the
// shipped page's film grain is, and building the gate's positive fixture out of it is the reason
// `heatmap.mjs` reported 89.5% of a FROZEN clip of the shipped default as moving and exited 0.
// The instrument and the test of the instrument shared one wrong idea, so neither could catch it.
//
// Two consequences run through the sections below and both are load-bearing:
//
//   - The noise ladder and the precision fixture are still the right oracles for the PER-PIXEL σ,
//     which is a real quantity honestly measured. They are now ALSO rejection proofs: a clip of
//     pure per-pixel noise must be REFUSED as a noise floor, however loud it is. Section 2
//     asserts both about the same clip, which is the clearest statement of the finding available.
//   - The statue fixture's living half now carries a MOVING EDGE, because the property under test
//     is "can the tool find a dead region", and a fixture whose live region is noise was asking a
//     different question.
//
// Section 8 is new and is the §1.25a work: three defects in the class "temporal variation that is
// not motion", built by three different mechanisms — per-pixel noise, a global exposure flicker,
// and real motion confined to too little of the frame — with a coherently moving bar beside them
// as the control that must NOT be refused.
//
// Run: node tools/critic/heatmap.selftest.mjs

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { encodePng, decodePng } from './png.mjs';
import { encodedLuma } from './color.mjs';
import { analyseClip, findFramePaths, sampleRamp, RAMP_STOPS, DEFAULTS } from './heatmap.mjs';

const WORK_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'sugata-heatmap-selftest-'));
const HERE = path.dirname(fileURLToPath(import.meta.url));

const gates = [];

// --- clip synthesis ---------------------------------------------------------------------------

// Every synthetic frame is neutral grey, which makes the oracle exact: for r = g = b = v the
// Rec.709 weights sum to one, so encoded luma in code values IS v. The tool's σ can therefore be
// compared straight against the σ of the injected noise, with no colour maths in between.
//
// Rounded, not truncated, for the reason selftest.mjs records: assigning a float into a
// Uint8Array truncates toward zero, which would bias every synthetic frame half a code value.
function writeClip(name, { width, height, frames, valueAt }) {
  const directory = path.join(WORK_DIR, name);
  fs.mkdirSync(directory, { recursive: true });

  for (let frame = 1; frame <= frames; frame += 1) {
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
      path.join(directory, `frame-${String(frame).padStart(5, '0')}.png`),
      encodePng(width, height, bytes)
    );
  }

  return directory;
}

function clampByte(value) {
  return value < 0 ? 0 : value > 255 ? 255 : value;
}

// Deterministic Gaussian noise, same generator selftest.mjs uses. A self-test that fails one run
// in twenty is a self-test people learn to ignore.
function makeGaussianSource(seed) {
  let state = seed >>> 0;
  const nextUniform = () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  return () => {
    const u1 = Math.max(nextUniform(), Number.EPSILON);
    const u2 = nextUniform();
    return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  };
}

// The analytic oracle, stated once so no gate can quietly use a different one.
function expectedSigma(amplitude, frameCount) {
  return Math.sqrt((amplitude * amplitude + 1 / 12) * ((frameCount - 1) / frameCount));
}

function analyse(directory, overrides = {}) {
  const options = { ...DEFAULTS, ...overrides };
  return analyseClip(findFramePaths(directory, options.stride), options);
}

// The CLI exits 1 on a frozen clip and on a dead band, which is most of what this file feeds it.
// Capture stdout and the exit code together rather than letting execFileSync throw.
function runCli(args) {
  try {
    const stdout = execFileSync('node', [path.join(HERE, 'heatmap.mjs'), ...args], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    return { stdout, stderr: '', status: 0 };
  } catch (error) {
    if (error.status === undefined) throw error;
    return { stdout: error.stdout ?? '', stderr: error.stderr ?? '', status: error.status };
  }
}

function sha256(filePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

// Mean encoded luma of the heat map itself, excluding the legend strip underneath it. This is how
// "did the colours get brighter?" becomes a number.
function meanMapLuma(pngPath, mapHeight) {
  const image = decodePng(fs.readFileSync(pngPath));
  let total = 0;
  for (let pixel = 0; pixel < mapHeight * image.width; pixel += 1) {
    const base = pixel * 4;
    total += encodedLuma(image.pixels[base], image.pixels[base + 1], image.pixels[base + 2]);
  }
  return total / (mapHeight * image.width);
}

// --- assertions -------------------------------------------------------------------------------

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

function format(value) {
  if (typeof value !== 'number') return String(value);
  if (Math.abs(value) >= 1000 || (Math.abs(value) < 0.001 && value !== 0)) return value.toExponential(3);
  return value.toFixed(5);
}

// ================================================================================================
// 1. The colour ramp is monotonic in luminance  (the "not a rainbow" gate)
// ================================================================================================
//
// Both directions: this ramp must pass, and a rainbow must FAIL the identical check. Without the
// second half, "monotonic" is an assertion that has never been tested against a counter-example.

function testRampMonotonicity() {
  const monotonicity = (rampAt) => {
    let reversals = 0;
    let previous = -1;
    let span = 0;
    for (let step = 0; step <= 255; step += 1) {
      const [r, g, b] = rampAt(step / 255);
      const luma = encodedLuma(r / 255, g / 255, b / 255);
      if (luma < previous - 1e-9) reversals += 1;
      span = Math.max(span, luma);
      previous = luma;
    }
    return { reversals, span };
  };

  const ours = monotonicity(sampleRamp);
  expectEqual('ramp never reverses in encoded luma over 256 samples', ours.reversals, 0);
  expectTrue(
    'ramp spans the full luminance range, so ordering is readable in greyscale',
    ours.span >= 0.99,
    `top of ramp reaches luma ${format(ours.span)}, need ≥ 0.99000`
  );

  expectTrue(
    'ramp stops rise strictly in luma, stop by stop',
    RAMP_STOPS.every((stop, index) => {
      if (index === 0) return true;
      const before = RAMP_STOPS[index - 1].rgb;
      return encodedLuma(stop.rgb[0] / 255, stop.rgb[1] / 255, stop.rgb[2] / 255) >
        encodedLuma(before[0] / 255, before[1] / 255, before[2] / 255);
    }),
    RAMP_STOPS.map((stop) =>
      `${stop.name} ${encodedLuma(stop.rgb[0] / 255, stop.rgb[1] / 255, stop.rgb[2] / 255).toFixed(3)}`
    ).join(' < ')
  );

  // KNOWN-BAD INPUT. An HSV rainbow: yellow at 0.17 is brighter than green at 0.33 and than cyan
  // at 0.5, so a reader's eye ranks a middling σ above a high one. If this check cannot catch
  // that, it is not checking anything.
  const rainbow = (t) => {
    const hue = t * 300;
    const sector = Math.floor(hue / 60) % 6;
    const f = hue / 60 - Math.floor(hue / 60);
    const table = [
      [1, f, 0], [1 - f, 1, 0], [0, 1, f], [0, 1 - f, 1], [f, 0, 1], [1, 0, 1 - f],
    ][sector];
    return table.map((channel) => Math.round(channel * 255));
  };
  const rainbowResult = monotonicity(rainbow);
  expectTrue(
    'the same check FAILS a rainbow ramp (known-bad input)',
    rainbowResult.reversals > 0,
    `rainbow reverses ${rainbowResult.reversals} times; ours reverses ${ours.reversals}`
  );
}

// ================================================================================================
// 2. Known σ read back within tolerance  (ANALYTIC ORACLE)
// ================================================================================================
//
// Six horizontal bands, each carrying gaussian noise of a different known amplitude. The tool has
// to recover every one of them, and it has to keep them in order — a σ map whose colours do not
// rank motion correctly is worse than no map.

const NOISE_LADDER = [1.5, 2.5, 4, 6, 9, 13];
const LADDER_FRAMES = 240;
const LADDER_WIDTH = 96;
const LADDER_HEIGHT = 120;
const LADDER_BASE = 120;

function testKnownSigmaLadder() {
  const gaussian = makeGaussianSource(20260807);
  const rowsPerBand = LADDER_HEIGHT / NOISE_LADDER.length;

  const directory = writeClip('ladder', {
    width: LADDER_WIDTH,
    height: LADDER_HEIGHT,
    frames: LADDER_FRAMES,
    valueAt: (x, y) => LADDER_BASE + NOISE_LADDER[Math.floor(y / rowsPerBand)] * gaussian(),
  });

  const report = analyse(directory, { bands: NOISE_LADDER.length });

  NOISE_LADDER.forEach((amplitude, index) => {
    const expected = expectedSigma(amplitude, LADDER_FRAMES);
    const band = report.bands[index];
    // 3% relative, floored at 0.03 code values: the sampling scatter of a population σ over N
    // frames is 1/√(2N) ≈ 4.6% per pixel, but the band averages 1920 independent pixels, so the
    // mean's own scatter is ~0.1%. The tolerance is loose against that, tight against a real bug.
    expectClose(
      `band ${band.index} reads back its injected σ = ${amplitude}`,
      band.meanSigma,
      expected,
      Math.max(0.03, 0.03 * expected)
    );
  });

  const ordered = report.bands.every((band, index) => index === 0 || band.meanSigma > report.bands[index - 1].meanSigma);
  expectTrue('σ increases band by band, matching the injected ladder', ordered,
    report.bands.map((band) => band.meanSigma.toFixed(2)).join(' < '));

  // A p99 that equals the mean would mean the tool is reporting one number twice. For a gaussian
  // the per-pixel σ estimates scatter about the true σ, so p99 must sit above the mean.
  expectTrue('p99 σ sits above mean σ in every band', report.bands.every((band) => band.p99Sigma > band.meanSigma),
    report.bands.map((band) => `${band.meanSigma.toFixed(2)}→${band.p99Sigma.toFixed(2)}`).join(' '));

  // Every pixel in this clip has a nonzero σ, so nothing may be skipped as static.
  expectEqual('no pixel of a fully-noisy clip is skipped as static', report.coverage.skippedStatic, 0);

  // 🎯 AND THE SAME CLIP MUST BE REFUSED. This assertion used to read "no band of a fully-noisy
  // clip is called dead", which is the defect written down as an expectation: a clip in which
  // every pixel draws an independent value every frame contains NO MOTION, however large the
  // amplitude. σ 13 is nine times the shipped grain and it must still be refused.
  expectEqual('EVERY band of a fully-noisy clip is dead — per-pixel noise is not motion',
    report.deadBands.length, NOISE_LADDER.length);
  expectTrue('and the clip as a whole is refused as a noise floor',
    report.coherence.movingBlockShare === 0,
    `${(100 * report.coherence.movingBlockShare).toFixed(3)}% of blocks move; ` +
      `mean block σ ${format(report.coherence.meanBlockSigma)} against a per-pixel mean of ` +
      `${format(report.coherence.meanPixelSigma)} — the block mean divided the noise by ~8`);
  expectEqual('the CLI exits 1 on it', runCli([directory, '--out', path.join(WORK_DIR, 'ladder.png')]).status, 1);

  // Auto-normalisation has to publish the number it picked, or two clips can never be compared.
  expectTrue('auto normalisation reports the σ it chose', report.scale.mode === 'auto' && report.scale.maxSigma > 0,
    `maxSigma ${format(report.scale.maxSigma)} (p${report.scale.percentile} of moving pixels)`);

  // The band count is a knob, and a knob that does not change the answer is not a knob.
  expectEqual('--bands is honoured', analyse(directory, { bands: 4 }).bands.length, 4);
}

// ================================================================================================
// 3. A frozen still repeated N times is refused, loudly  (DEGENERATE INPUT — §1.3)
// ================================================================================================

function testFrozenClipIsRefused() {
  const directory = writeClip('frozen', {
    width: 64,
    height: 64,
    frames: 60,
    // A gradient, not a flat fill: the still must be a picture worth looking at, so that a tool
    // that fell back to SPATIAL variance would produce a pretty map and get caught here.
    valueAt: (x, y) => 40 + x + y,
  });

  const report = analyse(directory);

  let worst = 0;
  for (let pixel = 0; pixel < report.field.sigma.length; pixel += 1) {
    worst = Math.max(worst, report.field.sigma[pixel]);
  }
  expectClose('σ is EXACTLY zero at every pixel of a frozen clip', worst, 0, 0);
  expectEqual('no pixel is counted as moving', report.coverage.counted, 0);
  expectEqual('every pixel is reported skipped as static', report.coverage.skippedStatic, 64 * 64);
  expectEqual('every band reads mean σ = 0', report.bands.filter((band) => band.meanSigma !== 0).length, 0);
  expectEqual('every band is 100% dead', report.bands.filter((band) => band.deadFraction !== 1).length, 0);

  const run = runCli([directory, '--out', path.join(WORK_DIR, 'frozen.png')]);
  expectEqual('the CLI exits 1 on a frozen clip', run.status, 1);
  expectTrue('the CLI says the clip is frozen instead of just drawing black',
    run.stdout.includes('EVERY PIXEL IS FROZEN'),
    run.stdout.split('\n').find((line) => line.includes('FROZEN')) ?? '(no FROZEN line printed)');
  // On a frozen clip every band is also dead, and "DEAD BANDS: 1..10" ahead of the real finding
  // sends the reader off reasoning about anatomy when the capture itself is what broke.
  expectTrue('the frozen banner leads, not the dead-band noise',
    run.stdout.indexOf('***') === run.stdout.indexOf('*** EVERY PIXEL IS FROZEN'),
    run.stdout.split('\n').filter((line) => line.startsWith('***')).length + ' *** lines, frozen first');
  // The word is "NONZERO σ", not "moving", and that is not cosmetic — this line said
  // "counted 751,419 moving (89.5%)" about a clip of a frozen figure on the shipped default.
  expectTrue('the frozen report states nonzero-σ vs skipped, and does not call either "moving"',
    /counted 0 NONZERO σ \(0\.0%\)/.test(run.stdout) && /skipped 4,096 static/.test(run.stdout),
    run.stdout.split('\n').find((line) => line.startsWith('pixels')) ?? '(no pixels line)');
}

// ================================================================================================
// 4. A living torso on a statue's legs  (the §1.10 failure, reproduced)
// ================================================================================================
//
// This is the exact defect the heat map was invented to expose: the top half of the frame moves,
// the bottom half is bit-frozen, and the boundary lands on a band edge. The band table has to
// name the dead bands rather than leaving the reader to squint at an image.

const STATUE_HEIGHT = 120;
const STATUE_WIDTH = 96;
const STATUE_FRAMES = 120;
const STATUE_SIGMA = 6;
const STATUE_BAR_WIDTH = 24;
const STATUE_BAR_SWING = 12;
const STATUE_BACKDROP = 70;
const STATUE_BAR = 190;

/**
 * The living half is a BAR THAT MOVES, plus grain, and the change from grain alone is the point.
 *
 * This fixture used to be `128 + 6 · gaussian()` above the hip line and a constant below it, and
 * every check in the section passed. It could not have failed: the tool it was testing counted a
 * pixel as moving whenever its σ was nonzero, and the fixture's live half was built out of the one
 * thing that makes σ nonzero without anything moving. The live half now translates a hard edge
 * back and forth across ~6 of the 12 block columns, which is what a silhouette does, and the grain
 * stays on top of it so the fixture still looks like the page this tool is pointed at.
 */
function testLivingTorsoOnStatueLegs() {
  const gaussian = makeGaussianSource(1979);
  const hipLine = STATUE_HEIGHT / 2;

  // The bar's left edge per frame, precomputed so `valueAt` stays a pure function of (x, y, frame)
  // and the clip is reproducible whatever order the writer walks the pixels in.
  const barLeftAt = (frame) =>
    Math.round(STATUE_WIDTH / 2 - STATUE_BAR_WIDTH / 2 + STATUE_BAR_SWING * Math.sin((2 * Math.PI * frame) / 40));

  const directory = writeClip('statue-legs', {
    width: STATUE_WIDTH,
    height: STATUE_HEIGHT,
    frames: STATUE_FRAMES,
    valueAt: (x, y, frame) => {
      if (y >= hipLine) return STATUE_BACKDROP;
      const left = barLeftAt(frame);
      const onBar = x >= left && x < left + STATUE_BAR_WIDTH;
      return (onBar ? STATUE_BAR : STATUE_BACKDROP) + STATUE_SIGMA * gaussian();
    },
  });

  const report = analyse(directory, { bands: 10 });

  expectEqual('the dead bands are named exactly', report.deadBands.join(','), '6,7,8,9,10');

  const alive = report.bands.slice(0, 5);
  const dead = report.bands.slice(5);

  expectTrue('every living band clears the moving-block floor',
    alive.every((band) => band.coherence.movingBlockShare >= 0.01),
    alive.map((band) => `${(100 * band.coherence.movingBlockShare).toFixed(1)}%`).join(' '));
  expectTrue('every dead band holds no moving block at all',
    dead.every((band) => band.coherence.movingBlocks === 0),
    dead.map((band) => band.coherence.movingBlocks).join(' '));
  expectEqual('every dead band is 100% below the per-pixel dead threshold',
    dead.filter((band) => band.deadFraction !== 1).length, 0);
  expectEqual('every dead band counts zero nonzero-σ pixels', dead.filter((band) => band.countedPixels !== 0).length, 0);

  // The separation between the two halves, as one number, so a later change that erodes it says so.
  const quietestAlive = Math.min(...alive.map((band) => band.coherence.p99BlockSigma));
  expectTrue('the live half outruns the dead half by a wide margin on block σ',
    quietestAlive > 10 * Math.max(0.001, ...dead.map((band) => band.coherence.p99BlockSigma)),
    `quietest live band p99 block σ ${format(quietestAlive)} against a dead half of exactly ` +
      `${format(Math.max(...dead.map((band) => band.coherence.p99BlockSigma)))}`);

  expectClose('the cut lands exactly on the hip line',
    report.bands[5].firstRow, hipLine, 0);

  // Half the frame moved, so exactly half must be counted. This is the "counted vs skipped"
  // statement doing real work: if it were computed over the whole frame it would read 100%.
  expectClose('coverage reports exactly half the frame counted', report.coverage.countedFraction, 0.5, 0.001);

  const run = runCli([directory, '--out', path.join(WORK_DIR, 'statue.png'), '--json', path.join(WORK_DIR, 'statue.json')]);
  expectEqual('the CLI exits 0 without --fail-on-dead-bands (a heat map is a diagnostic)', run.status, 0);
  expectTrue('the CLI names the dead bands in its output',
    run.stdout.includes('DEAD BANDS: 6, 7, 8, 9, 10'),
    run.stdout.split('\n').find((line) => line.includes('DEAD BANDS')) ?? '(no DEAD BANDS line)');

  const failing = runCli([directory, '--out', path.join(WORK_DIR, 'statue2.png'), '--fail-on-dead-bands']);
  expectEqual('--fail-on-dead-bands turns it into a gate that exits 1', failing.status, 1);

  const written = JSON.parse(fs.readFileSync(path.join(WORK_DIR, 'statue.json'), 'utf8'));
  expectEqual('the JSON report carries the same dead bands', written.deadBands.join(','), '6,7,8,9,10');
  expectEqual('the JSON report omits the multi-megabyte σ field', 'field' in written, false);

  // 🚩 `--dead` NO LONGER DECIDES ANYTHING, and that has to be asserted rather than assumed,
  // because the flag is still there and a reader will reach for it. It moves the per-pixel `dead%`
  // column only. It used to pick the dead bands, and on any page carrying film grain that column
  // reads 0.0% for a frozen figure, so it was a knob attached to nothing.
  expectEqual('--dead far above the injected σ does NOT change the verdict',
    analyse(directory, { bands: 10, dead: 100 }).deadBands.join(','), '6,7,8,9,10');
  expectEqual('--dead 0 does NOT change the verdict either',
    analyse(directory, { bands: 10, dead: 0 }).deadBands.join(','), '6,7,8,9,10');
  expectTrue('--dead does still move the per-pixel column it describes',
    analyse(directory, { bands: 10, dead: 100 }).bands[0].deadFraction === 1 &&
      analyse(directory, { bands: 10, dead: 0 }).bands[0].deadFraction === 0,
    'dead=100 → deadFraction 1, dead=0 → deadFraction 0 on band 1');
}

// ================================================================================================
// 5. Welford vs. a naive accumulator  (EXACT ORACLE)
// ================================================================================================
//
// The stated reason for the algorithm, measured rather than asserted. A tiny variance riding on a
// large mean over many frames is precisely the case where Σx² − (Σx)²/N cancels away the answer.
// The reference is a two-pass float64 σ over the tool's own decoded pixels.

const PRECISION_FRAMES = 1200;
const PRECISION_BASE = 250;
const PRECISION_AMPLITUDE = 1;

function testNumericalStability() {
  const gaussian = makeGaussianSource(4242);
  const directory = writeClip('precision', {
    width: 4,
    height: 4,
    frames: PRECISION_FRAMES,
    valueAt: () => PRECISION_BASE + PRECISION_AMPLITUDE * gaussian(),
  });

  const report = analyse(directory);

  // The same luma series the tool saw, read back out of the same files.
  const series = [];
  for (const framePath of findFramePaths(directory, 1)) {
    const image = decodePng(fs.readFileSync(framePath));
    series.push(encodedLuma(image.pixels[0], image.pixels[1], image.pixels[2]) * 255);
  }

  let sum = 0;
  for (const value of series) sum += value;
  const mean = sum / series.length;
  let sumSquaredDeltas = 0;
  for (const value of series) sumSquaredDeltas += (value - mean) ** 2;
  const exact = Math.sqrt(sumSquaredDeltas / series.length);

  const naiveSums = new Float32Array(2);
  for (const value of series) {
    naiveSums[0] += value;
    naiveSums[1] += value * value;
  }
  const naiveMean = naiveSums[0] / series.length;
  const naive = Math.sqrt(Math.max(0, naiveSums[1] / series.length - naiveMean * naiveMean));

  const welfordError = Math.abs(report.field.sigma[0] - exact);
  const naiveError = Math.abs(naive - exact);

  expectClose('Welford matches a two-pass float64 σ to machine precision',
    report.field.sigma[0], exact, 1e-9);
  expectClose('the σ recovered is the σ injected (quantisation included)',
    exact, expectedSigma(PRECISION_AMPLITUDE, PRECISION_FRAMES), 0.06);
  expectTrue('a naive float32 Σx² accumulator on the same data is far worse',
    naiveError > 100 * Math.max(welfordError, 1e-12),
    `naive error ${format(naiveError)} vs Welford error ${format(welfordError)} on σ ${format(exact)}`);
}

// ================================================================================================
// 6. Two clips only compare on the same scale  (--normalise, both directions)
// ================================================================================================

const SCALE_SIZE = 64;
const SCALE_FRAMES = 150;

function testNormalisationComparability() {
  const quiet = writeClip('scale-quiet', {
    width: SCALE_SIZE, height: SCALE_SIZE, frames: SCALE_FRAMES,
    valueAt: ((gaussian) => () => 128 + 4 * gaussian())(makeGaussianSource(11)),
  });
  const loud = writeClip('scale-loud', {
    width: SCALE_SIZE, height: SCALE_SIZE, frames: SCALE_FRAMES,
    valueAt: ((gaussian) => () => 128 + 8 * gaussian())(makeGaussianSource(22)),
  });

  const quietAuto = path.join(WORK_DIR, 'quiet-auto.png');
  const loudAuto = path.join(WORK_DIR, 'loud-auto.png');
  runCli([quiet, '--out', quietAuto]);
  runCli([loud, '--out', loudAuto]);

  // THE TRAP, demonstrated rather than warned about: under auto each clip is normalised to its
  // own maximum, so a clip with half the motion renders at the same brightness. This is why the
  // tool prints the number it chose.
  expectClose('under --normalise auto the two clips look identical despite 2× the motion',
    meanMapLuma(loudAuto, SCALE_SIZE), meanMapLuma(quietAuto, SCALE_SIZE), 0.03);

  const pinnedMax = analyse(loud).scale.maxSigma;
  const quietPinned = path.join(WORK_DIR, 'quiet-pinned.png');
  const loudPinned = path.join(WORK_DIR, 'loud-pinned.png');
  runCli([quiet, '--out', quietPinned, '--normalise', String(pinnedMax)]);
  runCli([loud, '--out', loudPinned, '--normalise', String(pinnedMax)]);

  expectTrue('pinned to one scale, the louder clip renders visibly brighter',
    meanMapLuma(loudPinned, SCALE_SIZE) > meanMapLuma(quietPinned, SCALE_SIZE) + 0.1,
    `loud ${format(meanMapLuma(loudPinned, SCALE_SIZE))} vs quiet ${format(meanMapLuma(quietPinned, SCALE_SIZE))}`);

  const pinnedReport = analyse(quiet, { normalise: pinnedMax });
  expectClose('a pinned scale is used verbatim', pinnedReport.scale.maxSigma, pinnedMax, 0);
  expectEqual('a pinned scale is labelled as pinned', pinnedReport.scale.mode, 'pinned');
  expectTrue('the report tells a later run how to pin this scale',
    runCli([quiet, '--out', path.join(WORK_DIR, 'pin-hint.png')]).stdout.includes('--normalise'),
    'expected a "pin with --normalise <σ>" line in the report');
}

// ================================================================================================
// 7. Determinism, and refusal of malformed input
// ================================================================================================

function testDeterminismAndRefusals() {
  const directory = writeClip('determinism', {
    width: 48, height: 48, frames: 40,
    valueAt: ((gaussian) => (x, y) => 100 + (y / 8) * gaussian())(makeGaussianSource(7)),
  });

  const first = path.join(WORK_DIR, 'determinism-a.png');
  const second = path.join(WORK_DIR, 'determinism-b.png');
  runCli([directory, '--out', first]);
  runCli([directory, '--out', second]);
  expectEqual('same frames in, byte-identical PNG out', sha256(first), sha256(second));

  const encoded = decodePng(fs.readFileSync(first));
  expectEqual('the heat map is frame-sized plus a legend strip', `${encoded.width}x${encoded.height}`, '48x76');

  // capture.mjs writes <out>/frames/frame-*.png, so pointing at the capture root must work.
  const captureRoot = path.join(WORK_DIR, 'capture-root');
  fs.mkdirSync(captureRoot, { recursive: true });
  fs.cpSync(directory, path.join(captureRoot, 'frames'), { recursive: true });
  fs.writeFileSync(path.join(captureRoot, 'capture.json'), '{}\n');
  expectEqual('a capture root is descended into automatically',
    findFramePaths(captureRoot, 1).length, 40);

  expectEqual('--stride thins the clip', findFramePaths(captureRoot, 4).length, 10);

  // Frames must be read in numeric order even unpadded, or a re-numbered clip silently becomes a
  // different measurement.
  const unpadded = path.join(WORK_DIR, 'unpadded');
  fs.mkdirSync(unpadded, { recursive: true });
  for (const frame of [1, 2, 9, 10, 11]) {
    fs.copyFileSync(path.join(directory, 'frame-00001.png'), path.join(unpadded, `frame-${frame}.png`));
  }
  expectEqual('unpadded frame numbers sort numerically, not lexically',
    findFramePaths(unpadded, 1).map((p) => path.basename(p)).join(','),
    'frame-1.png,frame-2.png,frame-9.png,frame-10.png,frame-11.png');

  expectEqual('a mismatched frame size is refused', refusalFrom(() => {
    const mixed = path.join(WORK_DIR, 'mixed');
    fs.mkdirSync(mixed, { recursive: true });
    fs.copyFileSync(path.join(directory, 'frame-00001.png'), path.join(mixed, 'frame-00001.png'));
    fs.writeFileSync(path.join(mixed, 'frame-00002.png'), encodePng(8, 8, new Uint8Array(8 * 8 * 4)));
    return analyse(mixed);
  }, /but the clip started at/), true);

  expectEqual('a single frame is refused — a temporal σ needs two', refusalFrom(() => {
    const lonely = path.join(WORK_DIR, 'lonely');
    fs.mkdirSync(lonely, { recursive: true });
    fs.copyFileSync(path.join(directory, 'frame-00001.png'), path.join(lonely, 'frame-00001.png'));
    return findFramePaths(lonely, 1);
  }, /at least two/), true);

  expectEqual('an empty directory is refused with the --keep-frames hint', refusalFrom(() => {
    const empty = path.join(WORK_DIR, 'empty');
    fs.mkdirSync(empty, { recursive: true });
    return findFramePaths(empty, 1);
  }, /--keep-frames/), true);

  expectEqual('a bad --normalise is refused', runCli([directory, '--normalise', '-3']).status, 2);
  expectEqual('an unknown option is refused', runCli([directory, '--colour-map', 'rainbow']).status, 2);
}

// ================================================================================================
// 8. THE NOISE-FLOOR REFUSAL, proved against four clips built by four different mechanisms
// ================================================================================================
//
// LEARNINGS §1.25a: a gate that only catches its own known-bad is decorative, because the gate and
// the known-bad were written by the same person in the same hour against the same mental model.
// So the class is stated out loud —
//
//     ANY TEMPORAL VARIATION IN A CLIP THAT IS NOT A PART OF THE PICTURE CHANGING PLACE
//
// — and enumerated, and the enumeration deliberately includes one entry that the gate's designer
// did NOT have in mind, `flicker`, which is spatially COHERENT and therefore survives the block
// mean the whole repair is built on. It walked straight through the first version of this gate
// (37.9% of blocks "moving" on a clip synthesised from ONE static frame) and is the reason
// heatmap.mjs exposure-matches every frame before averaging.
//
// The fourth clip is the control, and it matters as much as the three defects: a refusal that also
// rejects the clips the tool exists for is worse than no refusal at all.

// 256×256 at an 8 px block is 1024 blocks, which is the smallest frame on which the `patch`
// defect can be stated honestly: a 12×12 patch touches ~4 of them, 0.4%, and the real case it
// stands for — a HUD readout on a 700×1200 capture — is ~30 of 13,200, 0.23%. On a 128×128 frame
// the same patch is 1.6% of the blocks and would clear the floor for reasons of arithmetic rather
// than of evidence.
const CLASS_WIDTH = 256;
const CLASS_HEIGHT = 256;
const CLASS_FRAMES = 90;
const CLASS_PATCH = 12;

function testNoiseFloorRefusalAgainstItsWholeClass() {
  const gaussian = makeGaussianSource(31337);

  // A static picture with real structure in it, so the flicker and patch clips are frames of
  // SOMETHING rather than of a flat field — a flat field would be caught by an easier check.
  // Kept under code value 170 so that a ×1.3 flicker does not clip at 255: clipping is a
  // non-linear distortion no global gain can undo, and letting it in would mean the flicker clip
  // was being refused partly for a reason this section is not about.
  const staticPicture = (x, y) =>
    60 + 90 * (x > CLASS_WIDTH * 0.3 && x < CLASS_WIDTH * 0.7 && y > CLASS_HEIGHT * 0.2 ? 1 : 0) +
    20 * Math.sin((x / CLASS_WIDTH) * 6);

  // 1. PER-PIXEL NOISE, loud. The mechanism the repair was designed against.
  const noise = writeClip('class-noise', {
    width: CLASS_WIDTH, height: CLASS_HEIGHT, frames: CLASS_FRAMES,
    valueAt: (x, y) => staticPicture(x, y) + 12 * gaussian(),
  });

  // 2. GLOBAL EXPOSURE FLICKER. Spatially coherent — the block mean PRESERVES it — so this is the
  //    second mechanism, and the one that proved the first version of the gate decorative.
  const flickerGain = [];
  for (let frame = 0; frame <= CLASS_FRAMES; frame += 1) flickerGain.push(1 + 0.3 * Math.sin(frame * 1.7));
  const flicker = writeClip('class-flicker', {
    width: CLASS_WIDTH, height: CLASS_HEIGHT, frames: CLASS_FRAMES,
    valueAt: (x, y, frame) => staticPicture(x, y) * flickerGain[frame],
  });

  // 3. REAL MOTION, TOO LITTLE OF IT. A HUD digit, a blinking eye: genuine coherent movement over
  //    a handful of blocks. The clip still is not evidence that a BODY moved, and a share floor is
  //    the only thing that can say so — an amplitude test cannot, because the amplitude is large.
  const patch = writeClip('class-patch', {
    width: CLASS_WIDTH, height: CLASS_HEIGHT, frames: CLASS_FRAMES,
    valueAt: (x, y, frame) => {
      const inPatch = y >= 16 && y < 16 + CLASS_PATCH && x >= 16 && x < 16 + CLASS_PATCH;
      return inPatch ? (frame % 2 === 0 ? 20 : 240) : staticPicture(x, y);
    },
  });

  // 4. THE CONTROL. A hard edge sweeping across the frame, plus the same grain as clip 1, so the
  //    only difference between this and the defects is that something changes place.
  const grain = makeGaussianSource(90210);
  const moving = writeClip('class-moving', {
    width: CLASS_WIDTH, height: CLASS_HEIGHT, frames: CLASS_FRAMES,
    valueAt: (x, y, frame) => {
      const edge = CLASS_WIDTH * 0.5 + CLASS_WIDTH * 0.25 * Math.sin((2 * Math.PI * frame) / 30);
      return (x < edge ? 200 : 40) + 12 * grain();
    },
  });

  const measured = {
    noise: analyse(noise), flicker: analyse(flicker), patch: analyse(patch), moving: analyse(moving),
  };

  for (const [name, report] of Object.entries(measured)) {
    const share = report.coherence.movingBlockShare;
    const detail = `${(100 * share).toFixed(3)}% of blocks move, mean block σ ` +
      `${format(report.coherence.meanBlockSigma)}, per-pixel σ ${format(report.coherence.meanPixelSigma)}, ` +
      `worst exposure fit ×${report.photometric.worstGain.toFixed(4)}`;

    if (name === 'moving') {
      expectTrue('CONTROL — a sweeping edge is NOT refused', share >= 0.01, detail);
      expectEqual('CONTROL — and the CLI exits 0 on it',
        runCli([moving, '--out', path.join(WORK_DIR, 'class-moving.png')]).status, 0);
    } else {
      expectTrue(`REJECTED — "${name}" is refused as a noise floor`, share < 0.01, detail);
    }
  }

  // The two whole-frame defects look ALIVE to the per-pixel statistic, which is the whole reason
  // it could not be the gate. Stated as a number so the point cannot be read past. (`patch` is
  // excluded because most of ITS frame is bit-identical, so the per-pixel statistic gets that one
  // right — a defect being visible to one instrument is exactly why there are two.)
  expectTrue('both whole-frame defects look ALIVE to the per-pixel statistic',
    ['noise', 'flicker'].every((name) => measured[name].coverage.countedFraction > 0.5),
    ['noise', 'flicker', 'patch']
      .map((name) => `${name} ${(100 * measured[name].coverage.countedFraction).toFixed(1)}% nonzero σ`).join(', '));

  // And the flicker specifically must be caught by the exposure match rather than by luck: the
  // fit has to SEE the gain, or the refusal is being produced by something else. Stated as a
  // distance from 1 rather than as `> 1.2`, because the worst frame of a symmetric wobble is as
  // likely to be the dark one — measured ×0.54 here, which the one-sided form read as innocent.
  expectTrue('the exposure match measured the flicker it removed',
    Math.abs(measured.flicker.photometric.worstGain - 1) > 0.2,
    `worst fit ×${measured.flicker.photometric.worstGain.toFixed(4)}, ` +
      `against ×${measured.moving.photometric.worstGain.toFixed(4)} on the moving control`);

  expectEqual('the CLI exits 1 on the flicker clip',
    runCli([flicker, '--out', path.join(WORK_DIR, 'class-flicker.png')]).status, 1);
  expectEqual('the CLI exits 1 on the small-patch clip',
    runCli([patch, '--out', path.join(WORK_DIR, 'class-patch.png')]).status, 1);
  expectTrue('and the banner names the finding rather than drawing the map',
    runCli([noise, '--out', path.join(WORK_DIR, 'class-noise.png')]).stdout.includes('NOTHING COHERENT MOVED'),
    'expected a "NOTHING COHERENT MOVED" banner');
}

function refusalFrom(action, pattern) {
  try {
    action();
    return false;
  } catch (error) {
    return pattern.test(error.message);
  }
}

// --- runner -------------------------------------------------------------------------------------

function run() {
  testRampMonotonicity();
  testKnownSigmaLadder();
  testFrozenClipIsRefused();
  testLivingTorsoOnStatueLegs();
  testNumericalStability();
  testNormalisationComparability();
  testDeterminismAndRefusals();
  testNoiseFloorRefusalAgainstItsWholeClass();

  const width = Math.max(...gates.map((gate) => gate.label.length));
  for (const gate of gates) {
    process.stdout.write(`${gate.ok ? 'ok  ' : 'FAIL'}  ${gate.label.padEnd(width)}  ${gate.detail}\n`);
  }

  const failed = gates.filter((gate) => !gate.ok).length;
  process.stdout.write(`\n${gates.length - failed}/${gates.length} gates passed.\n`);
  process.stdout.write(`Test clips left in ${WORK_DIR}\n`);
  return failed === 0 ? 0 : 1;
}

process.exitCode = run();
