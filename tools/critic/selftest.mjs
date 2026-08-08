#!/usr/bin/env node
//
// selftest.mjs — proves measure.mjs measures what it claims to.
//
// A measurement tool nobody tested is worse than no tool: it produces confident numbers that
// quietly steer the whole project wrong. So every gate is exercised against synthetic images
// whose properties are known in advance, by construction or by closed-form derivation.
//
// Two kinds of oracle are used, and the distinction matters:
//
//   EXTERNAL — the image is painted with the literal hex swatches published in
//   docs/research/stellar-blade-look-spec.md, and the tool must reproduce the luma, saturation
//   and ratio values printed alongside them. This checks the tool against measurements it did
//   not produce, so it cannot be self-consistently wrong.
//
//   ANALYTIC — the image is generated with a known statistical distribution and the expected
//   measurement is derived on paper. Used for G4, where a 5x5 boxcar high-pass of white noise
//   with per-pixel variance v has output variance 0.96v: the centre pixel keeps weight 24/25 and
//   the 24 neighbours contribute 1/25 each, giving (24/25)^2 + 24/25^2 = 600/625 = 0.96.
//
// Run: node tools/critic/selftest.mjs

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { encodePng, decodePng, stripProvenanceChunks } from './png.mjs';
import { encodedLuma, linearLuma, linearToSrgb, rgbToHsv } from './color.mjs';
import { measureAll, resolveRegions } from './measure.mjs';

const WORK_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'sugata-critic-selftest-'));
const HERE = path.dirname(fileURLToPath(import.meta.url));

const checks = [];

// --- test image construction --------------------------------------------------------------

function hexToRgb(hex) {
  const value = parseInt(hex.replace('#', ''), 16);
  return [(value >> 16) & 0xff, (value >> 8) & 0xff, value & 0xff];
}

// Builds an RGBA byte buffer by asking a function for the colour of every pixel. Code values are
// rounded, not truncated: assigning a float into a Uint8Array truncates toward zero, which would
// silently bias every synthetic image half a code value dark.
function paint(width, height, colorAt) {
  const bytes = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const [r, g, b] = colorAt(x, y);
      const base = (y * width + x) * 4;
      bytes[base] = Math.round(r);
      bytes[base + 1] = Math.round(g);
      bytes[base + 2] = Math.round(b);
      bytes[base + 3] = 255;
    }
  }
  return bytes;
}

function writeTestImage(name, width, height, bytes) {
  const filePath = path.join(WORK_DIR, name);
  fs.writeFileSync(filePath, encodePng(width, height, bytes));
  return filePath;
}

// The CLI exits 1 whenever a gate fails, which is most of the time for a synthetic test image.
// Capture stdout and the exit code together rather than letting execFileSync throw.
function runCli(scriptName, args) {
  try {
    const stdout = execFileSync('node', [path.join(HERE, scriptName), ...args], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    return { stdout, status: 0 };
  } catch (error) {
    if (error.status === undefined) throw error;
    return { stdout: error.stdout ?? '', status: error.status };
  }
}

function measureFile(filePath, spec) {
  const image = decodePng(fs.readFileSync(filePath));
  return measureAll(image, resolveRegions(spec, image), spec, filePath);
}

function gateNamed(report, id) {
  return report.gates.find((gate) => gate.id === id);
}

// Deterministic Gaussian noise. Seeded so a failing run is reproducible — a self-test that
// fails one time in twenty is a self-test people learn to ignore.
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

// --- assertions ------------------------------------------------------------------------------

function expectClose(label, actual, expected, tolerance) {
  const delta = Math.abs(actual - expected);
  checks.push({
    label,
    ok: delta <= tolerance,
    detail: `actual ${format(actual)}  expected ${format(expected)} ±${format(tolerance)}  (Δ ${format(delta)})`,
  });
}

function expectEqual(label, actual, expected) {
  checks.push({
    label,
    ok: actual === expected,
    detail: `actual ${actual}  expected ${expected}`,
  });
}

function format(value) {
  if (typeof value !== 'number') return String(value);
  if (Math.abs(value) >= 1000 || (Math.abs(value) < 0.001 && value !== 0)) return value.toExponential(3);
  return value.toFixed(5);
}

// ============================================================================================
// 1. Colour maths against the spec's own published numbers  (EXTERNAL ORACLE)
// ============================================================================================

function testColorMathsAgainstSpec() {
  const cases = [
    // hex,       spec luma, spec HSV S,  spec source
    ['#E5C3C3', 0.793, 0.150, 'lit cheek, cool key'],
    ['#C29997', 0.633, null, 'shadow-side cheek'],
    ['#977670', 0.489, null, 'shoulder, shade'],
    ['#9D7274', 0.483, null, 'sclera'],
    ['#96767D', 0.492, null, 'cheek reference for eyes'],
    ['#4D2F33', 0.211, null, 'iris'],
    ['#150F17', 0.067, null, 'hair base albedo'],
  ];

  for (const [hex, specLuma, specSaturation, source] of cases) {
    const [r, g, b] = hexToRgb(hex).map((channel) => channel / 255);
    expectClose(`spec luma ${hex} (${source})`, encodedLuma(r, g, b), specLuma, 0.001);
    if (specSaturation !== null) {
      expectClose(`spec HSV S ${hex}`, rgbToHsv(r, g, b).saturation, specSaturation, 0.005);
    }
  }

  // The domain trap, stated as a test: the same swatch the spec records as luma 0.793 is 0.596
  // once linearised — a 25% difference. This is exactly why every gate declares its domain.
  const [r, g, b] = hexToRgb('#E5C3C3').map((channel) => channel / 255);
  expectClose('linear luma #E5C3C3 differs from encoded (domain trap)', linearLuma(r, g, b), 0.5963, 0.001);
}

// ============================================================================================
// 2. PNG codec round-trip
// ============================================================================================

function testPngRoundTrip() {
  const bytes = paint(37, 23, (x, y) => [(x * 7) % 256, (y * 11) % 256, (x * y) % 256]);
  const filePath = writeTestImage('roundtrip.png', 37, 23, bytes);
  const decoded = decodePng(fs.readFileSync(filePath));

  expectEqual('png round-trip width', decoded.width, 37);
  expectEqual('png round-trip height', decoded.height, 23);

  let worstError = 0;
  for (let i = 0; i < bytes.length; i += 1) {
    worstError = Math.max(worstError, Math.abs(decoded.pixels[i] * 255 - bytes[i]));
  }
  expectClose('png round-trip worst channel error', worstError, 0, 1e-3);
}

// ============================================================================================
// 3. G1 — key:shadow ratio  (EXTERNAL ORACLE, then a constructed failure)
// ============================================================================================

function testKeyShadowRatio() {
  // The spec's own 3/4 close-up pair: 0.793 -> 0.633 encoded, which it reports as 1.25:1.
  const key = hexToRgb('#E5C3C3');
  const shadow = hexToRgb('#C29997');
  const filePath = writeTestImage(
    'g1-reference.png',
    200,
    100,
    paint(200, 100, (x) => (x < 100 ? key : shadow))
  );

  const spec = {
    units: 'pixels',
    regions: {
      faceKey: [{ x: 20, y: 20, w: 60, h: 60 }],
      faceShadow: [{ x: 120, y: 20, w: 60, h: 60 }],
    },
  };
  const gate = gateNamed(measureFile(filePath, spec), 'G1');

  expectClose('G1 encoded ratio matches spec 1.25:1', gate.measured.ratioEncoded, 1.253, 0.005);
  expectClose('G1 key encoded luma matches spec 0.793', gate.measured.keyLumaEncoded, 0.793, 0.001);
  expectClose('G1 shadow encoded luma matches spec 0.633', gate.measured.shadowLumaEncoded, 0.633, 0.001);
  expectClose('G1 linear ratio of the same pair', gate.measured.ratioLinear, 1.6344, 0.002);
  expectEqual('G1 reference pair PASSes', gate.status, 'PASS');

  // A conventional western 4:1 key:fill, built in the linear domain so the ratio is exact.
  const lit = linearToSrgb(0.4) * 255;
  const dark = linearToSrgb(0.1) * 255;
  const failPath = writeTestImage(
    'g1-photoreal.png',
    200,
    100,
    paint(200, 100, (x) => (x < 100 ? [lit, lit, lit] : [dark, dark, dark]))
  );
  const failGate = gateNamed(measureFile(failPath, spec), 'G1');

  // Tolerance is 0.05 rather than something tighter because the target linear values do not land
  // on exact 8-bit code values: 0.4 linear encodes to code 169.6 and 0.1 to code 89.1, so
  // quantisation alone moves the ratio by ~0.7%.
  expectClose('G1 constructed 4:1 linear ratio reads back as 4.0', failGate.measured.ratioLinear, 4.0, 0.05);
  expectEqual('G1 photoreal ratio FAILs', failGate.status, 'FAIL');
}

// ============================================================================================
// 4. G2 — sclera against cheek  (EXTERNAL ORACLE, then a white eyeball)
// ============================================================================================

function testScleraRatio() {
  const sclera = hexToRgb('#9D7274');
  const cheek = hexToRgb('#96767D');
  const spec = {
    units: 'pixels',
    regions: {
      sclera: [{ x: 20, y: 20, w: 60, h: 60 }],
      cheek: [{ x: 120, y: 20, w: 60, h: 60 }],
    },
  };

  const goodPath = writeTestImage(
    'g2-reference.png',
    200,
    100,
    paint(200, 100, (x) => (x < 100 ? sclera : cheek))
  );
  // 0.48348 / 0.49141 at full precision. The spec's own rounded figures (0.483 / 0.492) divide
  // to 0.9817; both round to the published 0.98.
  const gate = gateNamed(measureFile(goodPath, spec), 'G2');
  expectClose('G2 sclera:cheek matches spec 0.98x', gate.measured.ratioEncoded, 0.9839, 0.001);
  expectEqual('G2 reference eye PASSes', gate.status, 'PASS');

  const badPath = writeTestImage(
    'g2-white-eyeball.png',
    200,
    100,
    paint(200, 100, (x) => (x < 100 ? [255, 255, 255] : cheek))
  );
  const badGate = gateNamed(measureFile(badPath, spec), 'G2');
  expectClose('G2 white eyeball ratio', badGate.measured.ratioEncoded, 1 / 0.492, 0.01);
  expectEqual('G2 white eyeball FAILs', badGate.status, 'FAIL');
}

// ============================================================================================
// 5. G3 — terminator saturation and hue shift
// ============================================================================================

function testTerminatorShift() {
  // Warm-key chain from the spec: lit cheek -> ear transmission. Saturation rises 0.253 -> 0.316
  // and hue moves 16.6 degrees above red to 3.2 degrees below it.
  const lit = hexToRgb('#E5BBAB');
  const shadow = hexToRgb('#755052');
  const spec = {
    units: 'pixels',
    regions: {
      litSkin: [{ x: 20, y: 20, w: 60, h: 60 }],
      shadowTerminator: [{ x: 120, y: 20, w: 60, h: 60 }],
    },
  };

  const goodPath = writeTestImage(
    'g3-sss.png',
    200,
    100,
    paint(200, 100, (x) => (x < 100 ? lit : shadow))
  );
  const gate = gateNamed(measureFile(goodPath, spec), 'G3');

  expectClose('G3 lit saturation', gate.measured.litSaturation, 0.2533, 0.002);
  expectClose('G3 shadow saturation', gate.measured.shadowSaturation, 0.3162, 0.002);
  expectClose('G3 lit hue (degrees)', gate.measured.litHue, 16.55, 0.1);
  expectClose('G3 shadow hue wraps below red', gate.measured.shadowHue, 356.76, 0.2);
  expectClose('G3 shadow hue distance from red', gate.measured.shadowHueDistanceFromRed, 3.24, 0.1);
  expectEqual('G3 correct SSS PASSes', gate.status, 'PASS');

  // The failure mode this gate exists to catch: shading that desaturates and goes blue, which
  // is what a diffuse-only skin material does.
  const badPath = writeTestImage(
    'g3-no-sss.png',
    200,
    100,
    paint(200, 100, (x) => (x < 100 ? lit : [154, 154, 168]))
  );
  const badGate = gateNamed(measureFile(badPath, spec), 'G3');
  expectEqual('G3 desaturated blue shadow FAILs', badGate.status, 'FAIL');
  expectEqual('G3 reports both failure reasons', badGate.failures.length, 2);
}

// ============================================================================================
// 6. G4 — high-pass sigma  (ANALYTIC ORACLE)
// ============================================================================================

function testHighPassSigma() {
  const size = 512;
  const base = 200;

  // The measured sigma we want is 1.80/255. Working backwards: the boxcar attenuates by
  // sqrt(0.96), and rounding to 8-bit adds uniform quantisation noise of variance 1/12, so the
  // noise we inject must be sigma_inject where 0.96*(sigma_inject^2 + 1/12) = 1.80^2.
  const targetSigma = 1.8;
  const boxcarAttenuation = Math.sqrt(0.96);
  const quantisationVariance = 1 / 12;
  const injectSigma = Math.sqrt((targetSigma / boxcarAttenuation) ** 2 - quantisationVariance);

  const gaussian = makeGaussianSource(0x5ada7a);
  const noisy = paint(size, size, () => {
    const code = Math.round(base + gaussian() * injectSigma);
    return [code, code, code];
  });
  const noisyPath = writeTestImage('g4-noisy.png', size, size, noisy);

  const spec = {
    units: 'pixels',
    regions: { flatCheek: [{ x: 100, y: 100, w: 300, h: 300 }] },
  };
  const gate = gateNamed(measureFile(noisyPath, spec), 'G4');

  expectClose(
    `G4 sigma of noise injected at sigma=${injectSigma.toFixed(3)}`,
    gate.measured.sigmaPer255,
    targetSigma,
    0.08
  );
  expectEqual('G4 in-band sigma PASSes', gate.status, 'PASS');

  // Plastic skin: no micro-detail at all.
  const flatPath = writeTestImage('g4-flat.png', size, size, paint(size, size, () => [base, base, base]));
  const flatGate = gateNamed(measureFile(flatPath, spec), 'G4');
  expectClose('G4 perfectly flat patch sigma is zero', flatGate.measured.sigmaPer255, 0, 1e-6);
  expectEqual('G4 flat patch FAILs (too smooth)', flatGate.status, 'FAIL');

  // Photoreal scan skin: the spec puts this at 6-12, three to five times the target.
  const loudGaussian = makeGaussianSource(0xbeef01);
  const loudSigma = Math.sqrt((8.0 / boxcarAttenuation) ** 2 - quantisationVariance);
  const loudPath = writeTestImage(
    'g4-photoreal.png',
    size,
    size,
    paint(size, size, () => {
      const code = Math.round(base + loudGaussian() * loudSigma);
      return [code, code, code];
    })
  );
  const loudGate = gateNamed(measureFile(loudPath, spec), 'G4');
  expectClose('G4 photoreal-amplitude sigma reads back near 8.0', loudGate.measured.sigmaPer255, 8.0, 0.2);
  expectEqual('G4 photoreal amplitude FAILs (too sharp)', loudGate.status, 'FAIL');
}

// ============================================================================================
// 7. G5 — highlight clipping  (exact counted fraction)
// ============================================================================================

function testHighlightClipping() {
  const size = 1000;
  const totalPixels = size * size;

  const buildWithClippedCount = (clippedCount) =>
    paint(size, size, (x, y) => {
      const index = y * size + x;
      return index < clippedCount ? [255, 255, 255] : [128, 128, 128];
    });

  const okPath = writeTestImage('g5-ok.png', size, size, buildWithClippedCount(2000));
  const okGate = gateNamed(measureFile(okPath, { regions: {} }), 'G5');
  expectEqual('G5 counts exactly the clipped pixels', okGate.measured.clippedPixels, 2000);
  expectClose('G5 clipped fraction 0.2%', okGate.measured.clippedFraction, 2000 / totalPixels, 1e-9);
  expectEqual('G5 0.2% clipped PASSes', okGate.status, 'PASS');

  const badPath = writeTestImage('g5-blown.png', size, size, buildWithClippedCount(8000));
  const badGate = gateNamed(measureFile(badPath, { regions: {} }), 'G5');
  expectClose('G5 clipped fraction 0.8%', badGate.measured.clippedFraction, 0.008, 1e-9);
  expectEqual('G5 0.8% clipped FAILs', badGate.status, 'FAIL');
}

// ============================================================================================
// 8. G6 — black point  (exact constructed percentile)
// ============================================================================================

function testBlackPoint() {
  const size = 1000;

  // The darkest 1% of the frame is set to a single known code value. The 0.1% quantile
  // therefore lands inside that block, so p0.1 must come back as exactly that code / 255.
  const buildWithFloorCode = (code) =>
    paint(size, size, (x, y) => {
      const index = y * size + x;
      return index < size * 10 ? [code, code, code] : [128, 128, 128];
    });

  const okPath = writeTestImage('g6-ok.png', size, size, buildWithFloorCode(3));
  const okGate = gateNamed(measureFile(okPath, { regions: {} }), 'G6');
  expectClose('G6 p0.1 recovers the planted floor (code 3)', okGate.measured.p01Luma, 3 / 255, 3e-5);
  expectEqual('G6 correct black point PASSes', okGate.status, 'PASS');

  const liftedPath = writeTestImage('g6-lifted.png', size, size, buildWithFloorCode(12));
  const liftedGate = gateNamed(measureFile(liftedPath, { regions: {} }), 'G6');
  expectClose('G6 p0.1 recovers a lifted floor (code 12)', liftedGate.measured.p01Luma, 12 / 255, 3e-5);
  expectEqual('G6 shadow lift FAILs', liftedGate.status, 'FAIL');

  const crushedPath = writeTestImage('g6-crushed.png', size, size, buildWithFloorCode(0));
  const crushedGate = gateNamed(measureFile(crushedPath, { regions: {} }), 'G6');
  expectEqual('G6 crushed blacks FAIL', crushedGate.status, 'FAIL');
}

// ============================================================================================
// 8b. G7 — card band chroma outliers  (both directions, plus the two statistics it rejected)
// ============================================================================================

function testCardBandChroma() {
  const size = 400;
  const skin = hexToRgb('#D9BBAB');          // the measured cheek on alive.html at 900x1200

  // The band is a mixture on purpose: mostly skin, with a small fraction of near-black card. The
  // fraction is set to 4% because that is roughly what the four real rects contain, and because a
  // gate stated as a fraction OF THE BAND has to be told what the band is made of before its
  // threshold means anything.
  const cardEvery = 25;
  const buildBand = (cardColour) =>
    paint(size, size, (x, y) => ((y * size + x) % cardEvery === 0 ? cardColour : skin));

  const spec = { units: 'pixels', regions: { cardBand: [{ x: 0, y: 0, w: size, h: size }] } };

  // A card lit only by the warm key and the ambient — near-black, essentially neutral. This is
  // what the asset's own texture (mean sRGB 0.033 / 0.012 / 0.004) renders as when nothing
  // saturated reaches it.
  const neutralPath = writeTestImage('g7-neutral.png', size, size, buildBand([12, 10, 9]));
  const neutralGate = gateNamed(measureFile(neutralPath, spec), 'G7');
  expectEqual('G7 near-black neutral cards PASS', neutralGate.status, 'PASS');
  expectClose('G7 counts no outliers on neutral cards', neutralGate.measured.outlierFraction, 0, 1e-6);

  // The defect, painted with a colour taken off the pre-fix plate rather than invented: #071D58
  // is the highest-chroma counted pixel in the real card band (value 0.345, chroma 0.318, hue
  // 224°), at (109,375) on alive.html?freeze&bare&cards=0&msaa=0 at 900x1200. 4% of the band is
  // 40x the 0.10% threshold.
  const bluePath = writeTestImage('g7-blue-cards.png', size, size, buildBand(hexToRgb('#071D58')));
  const blueGate = gateNamed(measureFile(bluePath, spec), 'G7');
  expectEqual('G7 saturated blue cards FAIL', blueGate.status, 'FAIL');
  expectClose('G7 recovers the planted outlier fraction', blueGate.measured.outlierFraction, 1 / cardEvery, 0.002);
  expectEqual('G7 reports the worst offending pixel', blueGate.measured.worstCoolHex, '#071D58');

  // 🚩 A PATCH MEAN cannot see this, and that is the whole reason G7 is an outlier count. The
  // blue plate and the neutral plate differ in 4% of their pixels, so their mean lumas differ by
  // well under one part in a hundred — inside any tolerance wide enough to admit a real face.
  // LEARNINGS §1.11: when a gate structurally cannot resolve the thing it is aimed at, the answer
  // is a different KIND of assertion, not a tighter threshold.
  const meanLumaOf = (filePath) => {
    const { pixels } = decodePng(fs.readFileSync(filePath));
    let sum = 0;
    for (let i = 0; i < pixels.length; i += 4) sum += encodedLuma(pixels[i], pixels[i + 1], pixels[i + 2]);
    return sum / (pixels.length / 4);
  };
  expectClose('a patch MEAN would not resolve the defect (Δ luma < 0.01)', Math.abs(meanLumaOf(neutralPath) - meanLumaOf(bluePath)), 0, 0.01);

  // Monotone in chroma at a fixed value — which is the property HSV saturation does not have,
  // and which is why the threshold means the same thing on a half-fixed render as on a broken one.
  const paler = [0x2a, 0x33, 0x58];       // same value as #071D58's blue channel, less chroma
  const palerGate = gateNamed(measureFile(writeTestImage('g7-paler.png', size, size, buildBand(paler)), spec), 'G7');
  expectEqual('G7 is monotone in chroma at fixed value', palerGate.measured.outlierFraction <= blueGate.measured.outlierFraction, true);
  const saturationOf = ([r, g, b]) => (Math.max(r, g, b) === 0 ? 0 : (Math.max(r, g, b) - Math.min(r, g, b)) / Math.max(r, g, b));
  expectEqual('HSV saturation would ALSO have ranked those two, so that is not the disagreement', saturationOf(paler) < saturationOf(hexToRgb('#071D58')), true);

  // 🚩 What this gate does NOT catch, asserted as a gate so nobody later assumes it does
  // (LEARNINGS §1.11). The value ceiling is what makes the statistic about near-black CARDS
  // rather than about rim spill on skin, and the price is that a cool pixel brighter than the
  // ceiling is not counted at all — including #1A45A7 at value 0.655, the single most obviously
  // wrong pixel in the real pre-fix band. The gate still went red there, on 0.858% of the band,
  // but it went red on the darker company that pixel keeps. `worstCoolHex` / `worstCoolValue` are
  // reported over EVERY cool pixel precisely to cover this, and anything hunting a bright
  // chromatic artefact somewhere other than the card band wants a new gate, not a wider G7.
  const tooBright = hexToRgb('#1A45A7');
  const tooBrightGate = gateNamed(measureFile(writeTestImage('g7-above-ceiling.png', size, size, buildBand(tooBright)), spec), 'G7');
  expectEqual('G7 does NOT count cool pixels above the value ceiling', tooBrightGate.measured.outlierFraction, 0);
  expectEqual('...but still reports them as the worst offender', tooBrightGate.measured.worstCoolHex, '#1A45A7');

  // The value qualifier is load-bearing: without it the count is dominated by rim spill on skin.
  // A band of BRIGHT blue-tinted skin must not trip a gate about near-black cards.
  const tintedSkinPath = writeTestImage('g7-tinted-skin.png', size, size, buildBand([200, 205, 235]));
  expectEqual('G7 ignores a cool tint on bright skin', gateNamed(measureFile(tintedSkinPath, spec), 'G7').status, 'PASS');

  // And warm chroma in this band is eyeshadow and lid vasculature, which the look spec bakes into
  // albedo deliberately. A dark warm card must pass.
  const warmPath = writeTestImage('g7-warm-cards.png', size, size, buildBand([70, 20, 14]));
  expectEqual('G7 ignores warm chroma on dark cards', gateNamed(measureFile(warmPath, spec), 'G7').status, 'PASS');
}

// ============================================================================================
// 9. Region plumbing — normalised units, unions, missing regions
// ============================================================================================

function testRegionHandling() {
  const key = hexToRgb('#E5C3C3');
  const shadow = hexToRgb('#C29997');
  const filePath = writeTestImage(
    'regions.png',
    400,
    200,
    paint(400, 200, (x) => (x < 200 ? key : shadow))
  );

  const normalisedSpec = {
    units: 'normalized',
    regions: {
      faceKey: { note: 'left half', rects: [{ x: 0.1, y: 0.1, w: 0.2, h: 0.2 }] },
      faceShadow: { note: 'right half', rects: [{ x: 0.6, y: 0.1, w: 0.2, h: 0.2 }] },
    },
  };
  const report = measureFile(filePath, normalisedSpec);
  expectClose('normalised units resolve to the right pixels', gateNamed(report, 'G1').measured.ratioEncoded, 1.253, 0.005);
  expectEqual('gates without regions SKIP rather than fail', gateNamed(report, 'G2').status, 'SKIP');
  expectEqual('every region-dependent gate SKIPs', report.summary.skipped, 4);

  // The whole-image gates still run on a partial spec. This test image is two flat bright tones
  // with no dark pixels at all, so G6 must report a lifted black point — and it must be the only
  // failure, i.e. a SKIP never masquerades as a FAIL.
  expectEqual('whole-image gates still run on a partial spec', gateNamed(report, 'G6').status, 'FAIL');
  expectEqual('skipped gates are not counted as failures', report.summary.failed, 1);

  // A union of two rects, one on each side, must average to something between the two.
  const unionSpec = {
    units: 'pixels',
    regions: {
      sclera: [{ x: 10, y: 10, w: 50, h: 50 }],
      cheek: [
        { x: 10, y: 100, w: 50, h: 50 },
        { x: 300, y: 100, w: 50, h: 50 },
      ],
    },
  };
  const unionGate = gateNamed(measureFile(filePath, unionSpec), 'G2');
  expectClose('rect union averages both patches', unionGate.measured.cheekLumaEncoded, (0.793 + 0.633) / 2, 0.002);

  // Out-of-bounds rects must be rejected loudly, not silently clamped into a wrong measurement.
  let rejected = false;
  try {
    measureFile(filePath, { units: 'pixels', regions: { cheek: [{ x: 380, y: 10, w: 50, h: 50 }] } });
  } catch (error) {
    rejected = /outside/.test(error.message);
  }
  expectEqual('out-of-bounds rect is rejected', rejected, true);
}

// ============================================================================================
// 10. End-to-end: the CLI itself, and the blind A/B harness
// ============================================================================================

function testCommandLine() {
  const key = hexToRgb('#E5C3C3');
  const shadow = hexToRgb('#C29997');
  const imagePath = writeTestImage(
    'cli.png',
    200,
    100,
    paint(200, 100, (x) => (x < 100 ? key : shadow))
  );
  const specPath = path.join(WORK_DIR, 'cli-regions.json');
  fs.writeFileSync(
    specPath,
    JSON.stringify({
      units: 'pixels',
      regions: {
        faceKey: [{ x: 20, y: 20, w: 60, h: 60 }],
        faceShadow: [{ x: 120, y: 20, w: 60, h: 60 }],
      },
    })
  );

  const cli = runCli('measure.mjs', [imagePath, specPath]);
  const parsed = JSON.parse(cli.stdout);
  expectEqual('CLI emits parseable JSON on stdout', typeof parsed.summary.verdict, 'string');
  expectClose('CLI G1 matches the in-process result', parsed.gates[0].measured.ratioEncoded, 1.253, 0.005);

  // Exit code 1 on a failed gate, so a calling script can branch without parsing. This two-tone
  // test image has no dark pixels at all, so G6 correctly reports a lifted black point.
  expectEqual('CLI exits 1 when a gate fails', cli.status, 1);
  expectEqual('failing CLI run still emits its full report', parsed.gates.length, 7);

  // Exit code 2 is reserved for the tool itself breaking, so callers can tell the two apart.
  const broken = runCli('measure.mjs', [path.join(WORK_DIR, 'does-not-exist.png'), specPath]);
  expectEqual('CLI exits 2 on a tool error', broken.status, 2);

  // --human is a different presentation of the same measurement, not a different measurement.
  const human = runCli('measure.mjs', [imagePath, specPath, '--human']);
  expectEqual('--human prints a verdict line', /FAIL: \d+ passed/.test(human.stdout), true);

  const blownPath = writeTestImage('cli-blown.png', 100, 100, paint(100, 100, () => [255, 255, 255]));

  // Blind A/B: pairing must produce a.png and b.png, keep the key outside the image directory,
  // and reveal a mapping that points back at the two originals.
  const blindRoot = path.join(WORK_DIR, 'blind');
  const pairOutput = JSON.parse(
    runCli('blind_ab.mjs', ['pair', imagePath, blownPath, '--root', blindRoot, '--label', 'selftest']).stdout
  );

  const listing = fs.readdirSync(pairOutput.imagesDir).sort();
  expectEqual('blind pair writes exactly a.png and b.png', listing.join(','), 'a.png,b.png');
  expectEqual('key file is NOT inside the image directory', listing.some((name) => name.includes('key')), false);

  const revealed = JSON.parse(
    runCli('blind_ab.mjs', ['reveal', pairOutput.sessionId, '--root', blindRoot]).stdout
  );
  const revealedPair = [revealed.a, revealed.b].sort().join(',');
  expectEqual('reveal maps back to the two originals', revealedPair, [imagePath, blownPath].sort().join(','));

  // Blinding must not touch pixels — the same image measured before and after must be identical.
  const blindedForA = decodePng(fs.readFileSync(path.join(pairOutput.imagesDir, 'a.png')));
  const originalForA = decodePng(fs.readFileSync(revealed.a));
  let worstDrift = 0;
  for (let i = 0; i < originalForA.pixels.length; i += 1) {
    worstDrift = Math.max(worstDrift, Math.abs(blindedForA.pixels[i] - originalForA.pixels[i]));
  }
  expectClose('blinding is pixel-lossless', worstDrift, 0, 0);

  // Different-sized images are a de-blinding tell and must be reported.
  expectEqual('mismatched dimensions raise a blindness warning', pairOutput.warnings.length, 1);

  // The pair report itself must not distinguish the two slots. A per-slot stripped-chunk count
  // would announce which image came from the encoder that writes metadata.
  expectEqual('pair report has no per-slot chunk counts', pairOutput.strippedChunks, undefined);
  expectEqual('pair report totals stripped chunks instead', typeof pairOutput.strippedChunkTotal, 'number');

  // list must never leak the mapping.
  const listOutput = runCli('blind_ab.mjs', ['list', '--root', blindRoot]).stdout;
  expectEqual('list does not leak the mapping', listOutput.includes(imagePath), false);
}

// ============================================================================================
// 11. Cross-decoder check against ImageMagick  (EXTERNAL ORACLE, optional)
// ============================================================================================
//
// Round-tripping through our own encoder only proves the decoder agrees with itself. This section
// hands ImageMagick a source image, has it re-emit that image in every PNG variant we claim to
// support — including the sub-byte, 16-bit and palette paths our own encoder never produces —
// and compares our decode against ImageMagick's own raw pixel dump.
//
// It is skipped, not failed, when ImageMagick is absent: the tool itself has no dependencies and
// must stay runnable on a bare machine.

function haveImageMagick() {
  try {
    execFileSync('magick', ['-version'], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

function testAgainstImageMagick() {
  if (!haveImageMagick()) {
    checks.push({
      label: 'cross-decoder check vs ImageMagick',
      ok: true,
      detail: 'SKIPPED — `magick` not on PATH. Core self-test needs no external tools.',
    });
    return;
  }

  const source = writeTestImage(
    'magick-source.png',
    64,
    48,
    paint(64, 48, (x, y) => [(x * 4) % 256, (y * 5) % 256, (x + y) % 256])
  );

  const variants = [
    ['rgb8', ['-define', 'png:color-type=2', '-depth', '8']],
    ['rgba8', ['-define', 'png:color-type=6', '-depth', '8']],
    ['gray8', ['-colorspace', 'Gray', '-define', 'png:color-type=0', '-depth', '8']],
    ['gray16', ['-colorspace', 'Gray', '-define', 'png:color-type=0', '-depth', '16']],
    ['rgb16', ['-define', 'png:color-type=2', '-depth', '16']],
    ['palette', ['-colors', '64', '-define', 'png:color-type=3']],
    ['gray4', ['-colorspace', 'Gray', '-define', 'png:color-type=0', '-define', 'png:bit-depth=4']],
    ['gray1', ['-colorspace', 'Gray', '-monochrome', '-define', 'png:color-type=0', '-define', 'png:bit-depth=1']],
  ];

  for (const [name, options] of variants) {
    const variantPath = path.join(WORK_DIR, `magick-${name}.png`);
    execFileSync('magick', [source, ...options, variantPath], { stdio: 'ignore' });

    // ImageMagick's own view of the same file, as 8-bit sRGB RGBA bytes.
    const truth = execFileSync('magick', [variantPath, '-depth', '8', 'rgba:-'], {
      maxBuffer: 1 << 28,
    });
    const decoded = decodePng(fs.readFileSync(variantPath));

    let worstError = 0;
    for (let i = 0; i < truth.length; i += 1) {
      worstError = Math.max(worstError, Math.abs(Math.round(decoded.pixels[i] * 255) - truth[i]));
    }

    // Tolerance 1 code value: the 16-bit variants are being compared after ImageMagick has
    // truncated them to 8 bits, so a one-code rounding disagreement is expected and harmless.
    expectClose(
      `ImageMagick cross-check: ${name} (depth ${decoded.bitDepth}, colour type ${decoded.colorType})`,
      worstError,
      0,
      1
    );
  }

  // ImageMagick writes tEXt/tIME chunks, which our own encoder never does — so its output is the
  // realistic case for provenance stripping, and proof that stripping leaves pixels untouched.
  const withMetadata = fs.readFileSync(path.join(WORK_DIR, 'magick-rgb8.png'));
  const stripped = stripProvenanceChunks(withMetadata);
  expectEqual('ImageMagick output carries provenance chunks to strip', stripped.removedChunkCount > 0, true);

  const before = decodePng(withMetadata);
  const after = decodePng(stripped.buffer);
  let drift = 0;
  for (let i = 0; i < before.pixels.length; i += 1) {
    drift = Math.max(drift, Math.abs(before.pixels[i] - after.pixels[i]));
  }
  expectClose('stripping provenance leaves pixels bit-identical', drift, 0, 0);

  // Interlaced PNGs must be refused with an explanation, never half-decoded into plausible
  // nonsense — a silently wrong image is the one failure mode this whole tool exists to avoid.
  const interlacedPath = path.join(WORK_DIR, 'magick-interlaced.png');
  execFileSync('magick', [source, '-interlace', 'PNG', interlacedPath], { stdio: 'ignore' });
  let refusal = '';
  try {
    decodePng(fs.readFileSync(interlacedPath));
  } catch (error) {
    refusal = error.message;
  }
  expectEqual('interlaced PNG is refused with a clear message', /Interlaced/.test(refusal), true);
}

// --- runner -------------------------------------------------------------------------------------

function run() {
  testColorMathsAgainstSpec();
  testPngRoundTrip();
  testKeyShadowRatio();
  testScleraRatio();
  testTerminatorShift();
  testHighPassSigma();
  testHighlightClipping();
  testBlackPoint();
  testCardBandChroma();
  testRegionHandling();
  testCommandLine();
  testAgainstImageMagick();

  const width = Math.max(...checks.map((check) => check.label.length));
  for (const check of checks) {
    process.stdout.write(`${check.ok ? 'ok  ' : 'FAIL'}  ${check.label.padEnd(width)}  ${check.detail}\n`);
  }

  const failed = checks.filter((check) => !check.ok).length;
  process.stdout.write(`\n${checks.length - failed}/${checks.length} checks passed.\n`);
  process.stdout.write(`Test images left in ${WORK_DIR}\n`);
  return failed === 0 ? 0 : 1;
}

process.exitCode = run();
