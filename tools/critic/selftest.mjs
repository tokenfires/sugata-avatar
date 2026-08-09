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
import {
  measureAll, resolveRegions, canonicalPageKey, round, TARGETS, G2_SEED_LOTTERY,
  describeG2Margin, G2_RECIPE_SENSITIVITIES,
} from './measure.mjs';
import { compareFrameSequences, summarisePlateLoads } from './capture.mjs';

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

// `provenance` is what page/framing/motion state the plate came from. A synthetic test image has
// none by construction, and saying so here is the same statement the CLI makes on a real plate
// with no capture.json beside it — see measure.mjs's header for the round a missing one cost.
// regionsPath is overridable because one warning — G2's seed record — only applies when the plate
// was measured through the region spec the record was measured through, and a synthetic test has
// to be able to say it was.
function measureFile(filePath, spec, provenance = SYNTHETIC_PROVENANCE, regionsPath = '(selftest: synthetic spec)') {
  const image = decodePng(fs.readFileSync(filePath));
  return measureAll(
    image,
    resolveRegions(spec, image),
    spec,
    { imagePath: filePath, regionsPath },
    provenance
  );
}

const SYNTHETIC_PROVENANCE = {
  source: 'selftest',
  known: true,
  summary: 'selftest synthetic plate (no page)',
};

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
  expectEqual('and it says WHICH side, so a reader is not sent at the wrong end',
    failGate.failures.filter((line) => line.includes('TOO CONTRASTY')).length, 1);

  // 🎯 THE OTHER END, WHICH DID NOT EXIST UNTIL 2026-08-08. G1 asserted `< 2.00` alone, so every
  // render flatter than the reference read green — including, on this project, 1.344 linear
  // against a reference band of 1.43–1.64, and the full-body framing at 1.21 which PROGRESS had
  // recorded in prose as a known trade because no gate could hold it.
  //
  // §1.11's shape: the right answer to "my gate cannot catch this" is a structurally different
  // assertion, and here the structure is a DIRECTION rather than a quantity. A one-sided gate
  // cannot see half its own failure mode, and the half it cannot see is invisible precisely
  // because the gate is green.
  const flatLit = linearToSrgb(0.4) * 255;
  const flatDark = linearToSrgb(0.4 / 1.344) * 255;
  const flatPath = writeTestImage(
    'g1-flatter-than-reference.png',
    200,
    100,
    paint(200, 100, (x) => (x < 100 ? [flatLit, flatLit, flatLit] : [flatDark, flatDark, flatDark]))
  );
  const flatGate = gateNamed(measureFile(flatPath, spec), 'G1');
  expectClose('G1 constructed flat ratio reads back as 1.344', flatGate.measured.ratioLinear, 1.344, 0.02);
  expectEqual('G1 1.344 is UNDER the old 2.00 ceiling — the old gate called this green',
    flatGate.measured.ratioLinear < 2.0, true);
  expectEqual('G1 flatter-than-reference now FAILs', flatGate.status, 'FAIL');
  expectEqual('and it says TOO FLAT rather than just FAIL',
    flatGate.failures.filter((line) => line.includes('TOO FLAT')).length, 1);

  // A DIFFERENT defect of the same kind, so the floor is not a gate that only catches the one
  // number it was written for. Dead flat — key and shadow identical, which is what an unlit
  // ambient-only render measures and what the OLD inline rig on alive.html actually scored
  // (key:shadow 0.99 linear, recorded in PROGRESS under punch-list 3.8). The old gate passed it.
  const deadPath = writeTestImage(
    'g1-dead-flat.png',
    200,
    100,
    paint(200, 100, () => [flatLit, flatLit, flatLit])
  );
  const deadGate = gateNamed(measureFile(deadPath, spec), 'G1');
  expectClose('G1 dead-flat ratio is 1.0', deadGate.measured.ratioLinear, 1.0, 0.001);
  expectEqual('G1 dead flat FAILs', deadGate.status, 'FAIL');
  expectEqual('G1 dead flat is reported as TOO FLAT',
    deadGate.failures.filter((line) => line.includes('TOO FLAT')).length, 1);

  // And the reference pair must still sit inside, or the floor was set past the thing it was
  // derived from. 1.6344 linear against a floor of 1.43 — asserted, not assumed.
  expectEqual('the reference pair is INSIDE the reference band', gate.measured.side, 'inside the reference band');
  expectEqual('the floor is below the reference pair it was derived from',
    gate.measured.floorLinear < gate.measured.ratioLinear, true);
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

  // The reference chroma ratio is DERIVED from the two hexes above rather than transcribed from
  // the spec's prose, so assert it against the prose as an external oracle: 0.275 / 0.215 = 1.2791.
  expectClose('G2 reference chroma ratio reproduces the spec prose', gate.measured.referenceSaturationRatio, 1.2791, 0.006);
  // ±0.002 because the spec's prose is rounded to three places and the hexes are exact: the
  // derived figures are 0.27389 and 0.21333 against a published 0.275 and 0.215.
  expectClose('G2 reference sclera saturation', gate.measured.referenceScleraSaturation, 0.275, 0.002);
  expectClose('G2 reference cheek saturation', gate.measured.referenceCheekSaturation, 0.215, 0.002);
  expectClose('G2 reference eye chroma ratio', gate.measured.saturationRatio, 1.2839, 0.001);

  // 🎯 THE KNOWN-BAD THE OLD SINGLE-HALF GATE COULD NOT SEE (§1.1, §1.11).
  //
  // A grey sclera at exactly the reference sclera's encoded luma. The luma half is not merely
  // passed, it is passed PERFECTLY — this is the render that matches the published brightness and
  // renders a dead grey eyeball, and for three rounds G2 would have called it green. The grey is
  // solved from the reference hex rather than picked, so the luma half cannot be what catches it.
  const referenceLuma = encodedLuma(sclera[0] / 255, sclera[1] / 255, sclera[2] / 255);
  const greyCode = Math.round(referenceLuma * 255);
  const greyPath = writeTestImage(
    'g2-grey-sclera.png',
    200,
    100,
    paint(200, 100, (x) => (x < 100 ? [greyCode, greyCode, greyCode] : cheek))
  );
  const greyGate = gateNamed(measureFile(greyPath, spec), 'G2');

  expectClose('G2 grey sclera matches the reference LUMA to a code value', greyGate.measured.ratioEncoded, 0.9839, 0.005);
  expectEqual('G2 grey sclera has no chroma at all', greyGate.measured.scleraSaturation, 0);
  expectEqual('G2 grey sclera FAILs', greyGate.status, 'FAIL');
  expectEqual(
    'and the luma half is NOT what catches it — recorded as a gate, not tolerated',
    greyGate.failures.filter((line) => line.startsWith('luma half')).length,
    0
  );
  expectEqual(
    'both chroma components catch it: the ordinal one and the band one',
    greyGate.failures.filter((line) => line.startsWith('chroma half')).length,
    2
  );

  // And the band component alone, on a sclera that IS more saturated than the cheek but by far
  // too little: HSV S = (157−121)/157 = 0.2293 against the cheek's 0.2133, a ratio of 1.075 that
  // is on the right side of the ordinal test and well below the band's 1.205 floor. An ordinal
  // test with no band would pass this render; a band with no ordinal test would pass a reversed
  // eye whose ratio happened to land in range. Both are needed and these two plates say so.
  const weakPath = writeTestImage(
    'g2-weak-chroma.png',
    200,
    100,
    paint(200, 100, (x) => (x < 100 ? [157, 121, 123] : cheek))
  );
  const weakGate = gateNamed(measureFile(weakPath, spec), 'G2');
  expectEqual('G2 weak-chroma sclera is still MORE saturated than cheek', weakGate.measured.saturationRatio > 1, true);
  expectEqual('G2 weak-chroma sclera FAILs anyway', weakGate.status, 'FAIL');
  expectEqual(
    'the ORDINAL component alone does NOT catch it — recorded, not tolerated',
    weakGate.failures.filter((line) => line.includes('ORDINAL')).length,
    0
  );
  expectEqual(
    'the BAND component is what catches it',
    weakGate.failures.filter((line) => line.includes('BAND')).length,
    1
  );

  // 🎯 THE KNOWN-BAD THE TWO-CLAUSE GATE COULD NOT SEE EITHER — the fix for a half-measured
  // sentence was itself a half-measured sentence.
  //
  // Luma and saturation are TWO numbers; a colour is THREE. Pin the first two and what is left is
  // not a point, it is the entire hue circle. So the check below is not one known-bad: it is the
  // WHOLE free manifold, swept. Every plate is solved — not picked — to carry the reference
  // sclera's exact encoded luma AND its exact HSV saturation, so neither of the first two clauses
  // can be what decides any of them. Measured before the hue clause existed: 24 of 24 PASSED.
  const referenceSaturation = rgbToHsv(sclera[0] / 255, sclera[1] / 255, sclera[2] / 255).saturation;
  const survivors = [];
  for (let hue = 0; hue < 360; hue += 15) {
    const solved = solveForHueSaturationLuma(hue, referenceSaturation, referenceLuma);
    const sweptPath = writeTestImage(
      `g2-hue-${hue}.png`,
      200,
      100,
      paint(200, 100, (x) => (x < 100 ? solved : cheek))
    );
    const swept = gateNamed(measureFile(sweptPath, spec), 'G2');

    // The construction has to be verified on every plate or the sweep proves nothing: if a
    // solved colour missed the luma or the saturation band, its FAIL would be the old gate's
    // doing and the hue clause would be getting credit it had not earned.
    expectEqual(
      `hue ${hue}: the solved plate still satisfies the LUMA clause, so hue is what decides it`,
      swept.failures.filter((line) => line.startsWith('luma half')).length,
      0
    );
    expectEqual(
      `hue ${hue}: the solved plate still satisfies BOTH chroma clauses`,
      swept.failures.filter((line) => line.startsWith('chroma half')).length,
      0
    );
    if (swept.status === 'PASS') survivors.push(hue);
  }

  // Only the warm arc survives, and it is the arc the spec's word "pink-tinted" names.
  //
  // ⚠️ THIS SET CHANGED ON 2026-08-08, FROM `0,15,345` TO `0,345`, AND THE CHANGE IS THE POINT.
  // The synthetic cheek here is the spec's own `#96767D` at hue 346.875° — MAGENTA-of-red. The
  // old two-clause hue test folded the circle (`hueDistanceFromRed` returns `min(hue, 360−hue)`),
  // so a sclera at hue 15° scored 15° exactly as one at 345° did, and passed beside a magenta
  // cheek while being orange. It is the same eyeball-colour defect the whole sweep exists for,
  // one step around the wheel from the arc that should survive, and the sweep had been printing
  // it as a survivor for a round. The SIDE clause closes it; 0° is red itself and stays, because
  // the neutral zone is the reference sclera's own 2.791° from red.
  expectEqual('G2 hue sweep: only the pink family survives', survivors.join(','), '0,345');

  // And name the reported defect explicitly, because a set-equality assertion is easy to read
  // past: a GREEN eyeball at the reference's luma and saturation is the plate that started this.
  const greenPath = writeTestImage(
    'g2-green-sclera.png',
    200,
    100,
    paint(200, 100, (x) => (x < 100 ? [97, 134, 97] : cheek))
  );
  const greenGate = gateNamed(measureFile(greenPath, spec), 'G2');
  expectClose('G2 green sclera matches the reference LUMA', greenGate.measured.ratioEncoded, 0.9839, 0.005);
  expectClose('G2 green sclera sits INSIDE the chroma band', greenGate.measured.saturationRatio, 1.2943, 0.001);
  expectEqual('G2 green sclera is 120 deg from red', greenGate.measured.scleraHueFromRed, 120);
  expectEqual('G2 green sclera FAILs', greenGate.status, 'FAIL');
  expectEqual(
    'and ONLY the hue clauses catch it — luma and chroma are green on this plate',
    greenGate.failures.filter((line) => line.startsWith('hue clause')).length,
    greenGate.failures.length
  );
  expectEqual(
    'both hue clauses fire on green: 120 deg from red AND the wrong side of it',
    greenGate.failures.filter((line) => line.startsWith('hue clause')).length,
    2
  );

  // The ceiling is a MEASUREMENT of the two spec hexes, not a chosen tolerance. Assert both the
  // separation it is built from and the ceiling it produces on this plate, so a silently-edited
  // constant cannot pass: sclera #9D7274 sits 2.791 deg from red, cheek #96767D 13.125 deg.
  expectClose('G2 reference sclera hue from red', gate.measured.referenceScleraHueFromRed, 2.79, 0.01);
  expectClose('G2 reference cheek hue from red', gate.measured.referenceCheekHueFromRed, 13.13, 0.01);
  expectClose('G2 reference hue separation is derived, not typed', gate.measured.referenceHueSeparation, 10.33, 0.01);
  expectClose('G2 hue ceiling = this plate cheek + that separation', gate.measured.hueCeilingFromRed, 23.46, 0.01);

  // 🎯 THE SIDE CLAUSE, PROVEN THREE WAYS. §1.1: a gate that has never failed is not known to
  // work — and the sharper version, that a gate proved only by the known-bad it was written for
  // is decorative. So: it must reject the defect it was written for, it must reject a DIFFERENT
  // defect of the same kind, and it must provably NOT reject the palette it was derived from.
  //
  // (a) The defect it was written for: a magenta sclera beside an orange cheek. Both patches are
  //     solved to the reference's own luma and saturation, so neither of those clauses can be
  //     what decides it, and the ORDINAL clause is handed a sclera CLOSER to red than the cheek —
  //     it passes that test outright. The eye is pink-magenta in an orange-lit face and until
  //     2026-08-08 G2 called it green.
  const referenceCheekSaturation = rgbToHsv(cheek[0] / 255, cheek[1] / 255, cheek[2] / 255).saturation;
  const referenceCheekLuma = encodedLuma(cheek[0] / 255, cheek[1] / 255, cheek[2] / 255);
  const orangeCheek = solveForHueSaturationLuma(20, referenceCheekSaturation, referenceCheekLuma)
    .map((component) => Math.round(component));
  const magentaSclera = solveForHueSaturationLuma(348, referenceSaturation, referenceLuma)
    .map((component) => Math.round(component));
  const crossPath = writeTestImage(
    'g2-magenta-sclera-orange-cheek.png',
    200,
    100,
    paint(200, 100, (x) => (x < 100 ? magentaSclera : orangeCheek))
  );
  const crossGate = gateNamed(measureFile(crossPath, spec), 'G2');
  expectEqual('G2 side: the sclera is magenta-of-red', crossGate.measured.scleraSideOfRed, 'magenta');
  expectEqual('G2 side: the cheek beside it is orange-of-red', crossGate.measured.cheekSideOfRed, 'orange');
  expectEqual(
    'G2 side: the ORDINAL clause PASSES it — the sclera really is nearer red than the cheek',
    crossGate.failures.filter((line) => line.startsWith('hue clause, ORDINAL')).length,
    0
  );
  expectEqual('G2 magenta-sclera-in-orange-face FAILs', crossGate.status, 'FAIL');
  expectEqual(
    'and the SIDE clause is the only thing that catches it',
    crossGate.failures.length === 1 && crossGate.failures[0].startsWith('hue clause, SIDE'),
    true
  );

  // (b) A DIFFERENT defect in the same class, so this is not a gate that only catches its own
  //     known-bad. Mirror it: an ORANGE sclera beside a MAGENTA cheek, which is the failure the
  //     hue sweep above was silently passing at 15°. Same clause, opposite rotation, and the
  //     ordinal is again satisfied.
  const magentaCheekRgb = cheek;
  const orangeSclera = solveForHueSaturationLuma(12, referenceSaturation, referenceLuma)
    .map((component) => Math.round(component));
  const mirrorPath = writeTestImage(
    'g2-orange-sclera-magenta-cheek.png',
    200,
    100,
    paint(200, 100, (x) => (x < 100 ? orangeSclera : magentaCheekRgb))
  );
  const mirrorGate = gateNamed(measureFile(mirrorPath, spec), 'G2');
  expectEqual('G2 side, mirrored: the sclera is orange-of-red', mirrorGate.measured.scleraSideOfRed, 'orange');
  expectEqual('G2 side, mirrored: the cheek is magenta-of-red', mirrorGate.measured.cheekSideOfRed, 'magenta');
  expectEqual(
    'G2 side, mirrored: the ORDINAL clause PASSES it too',
    mirrorGate.failures.filter((line) => line.startsWith('hue clause, ORDINAL')).length,
    0
  );
  expectEqual('G2 orange-sclera-in-magenta-face FAILs', mirrorGate.status, 'FAIL');

  // (c) 🚩 AND IT PROVABLY CANNOT REJECT THE REFERENCE. The neutral zone is the reference
  //     sclera's OWN distance from red, so the spec's published pair sits exactly at the
  //     boundary — inclusive. A gate derived from a palette that then rejects that palette is
  //     not a gate, it is a bug with a threshold in it, and nothing in this file was asserting
  //     the difference. Both hexes are re-solved to the reference luma so the other clauses
  //     cannot be what passes it.
  const referencePairPath = writeTestImage(
    'g2-reference-pair.png',
    200,
    100,
    paint(200, 100, (x) => (x < 100 ? sclera : cheek))
  );
  const referenceGate = gateNamed(measureFile(referencePairPath, spec), 'G2');
  expectClose(
    'the neutral zone IS the reference sclera hue-from-red, not a chosen number',
    referenceGate.measured.hueSideNeutralZone,
    referenceGate.measured.referenceScleraHueFromRed,
    0.001
  );
  expectEqual(
    'the reference sclera lands INSIDE its own neutral zone, so the side clause is silent on it',
    referenceGate.measured.scleraSideOfRed,
    'red'
  );
  expectEqual(
    'the SIDE clause never fires on the spec\'s own two hexes',
    referenceGate.failures.filter((line) => line.startsWith('hue clause, SIDE')).length,
    0
  );

  // (d) The signed offset is reported, so a reader can see the fold that used to hide here.
  expectClose('signed hue: the reference sclera is 2.79 deg BELOW red', referenceGate.measured.scleraSignedHueFromRed, -2.79, 0.02);
  expectClose('signed hue: the reference cheek is 13.13 deg BELOW red', referenceGate.measured.cheekSignedHueFromRed, -13.13, 0.02);
  expectEqual(
    'and hueDistanceFromRed is exactly its magnitude — one primitive, with and without its sign',
    Math.abs(referenceGate.measured.scleraSignedHueFromRed) === referenceGate.measured.scleraHueFromRed,
    true
  );

  // ⚠️ WHAT THE SIDE CLAUSE DOES NOT COVER, recorded rather than assumed. Near hue 180° the sign
  // of the offset from red is arbitrary — 179° and 181° are half a degree apart on the wheel and
  // score +179 and −179 — so the side clause's verdict there is meaningless. It is harmless only
  // because the ORDINAL clause has already rejected anything that far from red, and that is
  // asserted here rather than believed.
  const cyanSclera = solveForHueSaturationLuma(181, referenceSaturation, referenceLuma)
    .map((component) => Math.round(component));
  const cyanPath = writeTestImage(
    'g2-cyan-sclera-near-180.png',
    200,
    100,
    paint(200, 100, (x) => (x < 100 ? cyanSclera : cheek))
  );
  const cyanGate = gateNamed(measureFile(cyanPath, spec), 'G2');
  expectEqual('near hue 180 the ORDINAL clause is what rejects it, not the side clause',
    cyanGate.failures.filter((line) => line.startsWith('hue clause, ORDINAL')).length, 1);
  expectEqual('a cyan sclera FAILs however its side is read', cyanGate.status, 'FAIL');

  // ⚠️ AND THE CLAUSE THAT DOES *NOT* COVER FOR ANOTHER, recorded so nobody assumes it does.
  // rgbToHsv reports hue 0 for a fully desaturated colour, so a grey eyeball scores 0 deg from red
  // and the hue clause waves it through. Grey is the saturation ordinal's job, and the two grey
  // failures asserted above are still exactly two.
  expectEqual('the hue clause does NOT catch grey — it scores 0 deg from red', greyGate.measured.scleraHueFromRed, 0);
  expectEqual(
    'so grey is still caught by the chroma clauses alone, not by hue',
    greyGate.failures.filter((line) => line.startsWith('hue clause')).length,
    0
  );
}

// Solves for the RGB triple with a given hue and HSV saturation whose ENCODED luma is exactly the
// one asked for. Hue and saturation are invariant under a uniform scale of the triple, so the
// full-value colour is built first and then scaled until its Rec.709 encoded luma lands. This is
// what lets the hue sweep above hold two of G2's three clauses fixed by construction.
function solveForHueSaturationLuma(hueDegrees, saturation, targetEncodedLuma) {
  const sector = (((hueDegrees % 360) + 360) % 360) / 60;
  const secondary = saturation * (1 - Math.abs((sector % 2) - 1));
  const wheel = [
    [saturation, secondary, 0],
    [secondary, saturation, 0],
    [0, saturation, secondary],
    [0, secondary, saturation],
    [secondary, 0, saturation],
    [saturation, 0, secondary],
  ][Math.floor(sector) % 6];

  const atFullValue = wheel.map((component) => component + (1 - saturation));
  const scale = targetEncodedLuma / encodedLuma(...atFullValue);
  return atFullValue.map((component) => component * scale * 255);
}

// ============================================================================================
// 4a. PROVENANCE — which page, at which framing, in which motion state
// ============================================================================================
//
// measure.mjs's header records why: a G4 sigma of 1.9495/255 measured on skin.html was quoted in
// the punch list as certifying alive.html, which reads 1.4764 at the same width. Nothing in the
// report said the two plates were different pages, so nothing could catch it. These checks assert
// that the stamp exists, that it reaches every gate individually (gate blocks get copied out one
// at a time), and that its absence is LOUD rather than silent.

function testProvenance() {
  const spec = {
    units: 'pixels',
    regions: {
      sclera: [{ x: 20, y: 20, w: 60, h: 60 }],
      cheek: [{ x: 120, y: 20, w: 60, h: 60 }],
    },
  };
  const filePath = writeTestImage(
    'provenance.png',
    200,
    100,
    paint(200, 100, (x) => (x < 100 ? hexToRgb('#9D7274') : hexToRgb('#96767D')))
  );

  const stamped = {
    source: 'selftest',
    known: true,
    summary: '/alive.html?bare&freeze  900×1200  seed 1  webgpu',
  };
  const known = measureFile(filePath, spec, stamped);

  expectEqual('the report carries the provenance summary', known.provenance.summary, stamped.summary);
  expectEqual(
    'EVERY measured gate carries it too, not just the report',
    known.gates.filter((gate) => gate.measured && gate.measured.measuredOn === stamped.summary).length,
    known.gates.filter((gate) => gate.measured).length
  );
  expectEqual(
    'a known page raises no provenance warning',
    known.warnings.filter((line) => line.startsWith('NO PROVENANCE')).length,
    0
  );

  const orphan = measureFile(filePath, spec, { source: 'none', known: false, summary: 'UNKNOWN PAGE' });
  expectEqual(
    'a plate with no provenance is WARNED about',
    orphan.warnings.filter((line) => line.startsWith('NO PROVENANCE')).length,
    1
  );
  expectEqual('and every gate says UNKNOWN PAGE', gateNamed(orphan, 'G2').measured.measuredOn, 'UNKNOWN PAGE');
}

// ============================================================================================
// 4a-bis. THE G2 SEED RECORD — a number the instrument prints about ITS OWN SUBJECT
// ============================================================================================
//
// 🚩 THE ONE DEFECT IN THIS ROUND WHERE THE OBJECTIVE INSTRUMENT WAS ITSELF THE LIAR.
//
// measure.mjs used to carry the G2 seed distribution as prose inside the warning string, with a
// typed verdict: "…0.8127 / 0.9627 / 0.9736 / 0.4384 … a 2.2× spread, two of four passing." True
// when written. Six commits of render work later every value had moved and only ONE of four still
// passed, and the tool went on printing the old sentence on every report it produced. Re-measured
// 2026-08-08 at build 82260d4: 0.7836 / 0.9189 / 0.9292 / 0.4390.
//
// A gate for this cannot be "assert the four numbers", because that is the same literal in a
// second file and it rots in lockstep. It has to be a gate on the MECHANISM, and there are four
// distinct ways this class of defect gets in:
//
// ⚠️ AND THE RE-MEASUREMENT ABOVE IS ITSELF SUPERSEDED, which is the point of check 5 below. The
// capture-epoch pin (punch-list 3.20) collapsed the lottery entirely: the same four seeds on the
// same recipe at `2ec7db9` return ONE PNG and 0.9182 every time. So `0.7836 / 0.9189 / 0.9292 /
// 0.4390` joined `0.8127 / 0.9627 / 0.9736 / 0.4384` on the forbidden list, and this comment is
// the history rather than the record. The record lives in `G2_SEED_LOTTERY`, one file over.
//
//   1. the record drifts away from the render        → the reproduction check must FIRE
//   2. it fires on plates it has no business judging → it must stay SILENT on those
//   3. it silently stops being applicable at all     → the comparability contract must hold
//                                                      against the URL shape capture.mjs writes
//   4. the verdict is typed rather than counted      → spread and pass count must track the data
//
// Each is asserted below, and 1 is asserted at the SMALLEST drift the defect actually produced
// (seed 20260807 moved 0.0006), not at a comfortable one.

// The exact URL shape capture.mjs writes into capture.json — flags with `=`, plus the two keys
// that name the run rather than the render. If that shape ever changes, the reproduction check
// goes quiet forever and the whole mechanism above becomes decorative, so pin it here.
const CAPTURE_URL_AS_WRITTEN = 'http://localhost:5188/alive.html?bare=&freeze=&capture=1&seed=1';

function g2RecordProvenance(seed, overrides = {}) {
  return {
    source: 'selftest',
    known: true,
    page: `http://localhost:5188/alive.html?bare=&freeze=&capture=1&seed=${seed}`,
    seed,
    prerollSeconds: null,
    pixelWidth: G2_SEED_LOTTERY.pixelWidth,
    pixelHeight: G2_SEED_LOTTERY.pixelHeight,
    summary: `/alive.html?bare&freeze  900×1200  seed ${seed}  webgpu`,
    ...overrides,
  };
}

function staleWarnings(report) {
  return report.warnings.filter((line) => line.startsWith('THE G2 SEED RECORD ABOVE IS STALE'));
}

function lotteryWarning(report) {
  return report.warnings.find((line) => line.startsWith('G2 samples an 11×6 px rect')) ?? '';
}

function testG2SeedRecord() {
  // The plate has to be the recorded SIZE, because that is half of what makes a number
  // comparable. Reference sclera against reference cheek gives a ratio of 0.9839 by construction
  // — the same pair section 3 asserts against the spec — so the record can be pointed at a value
  // this test knows without measuring the real page.
  const sclera = hexToRgb('#9D7274');
  const cheek = hexToRgb('#96767D');
  const width = G2_SEED_LOTTERY.pixelWidth;
  const height = G2_SEED_LOTTERY.pixelHeight;
  const spec = {
    units: 'pixels',
    regions: {
      sclera: [{ x: 20, y: 20, w: 60, h: 60 }],
      cheek: [{ x: 400, y: 20, w: 60, h: 60 }],
    },
  };
  const platePath = writeTestImage(
    'g2-seed-record.png',
    width,
    height,
    paint(width, height, (x) => (x < width / 2 ? sclera : cheek))
  );

  const plateRatio = gateNamed(measureFile(platePath, spec, g2RecordProvenance(1), G2_SEED_LOTTERY.regionsPath), 'G2').measured
    .ratioEncoded;

  // Swap the real record for one this plate satisfies exactly, then put it back. Mutating the
  // record rather than the plate is the honest direction: it is the record that rotted.
  const realRatios = { ...G2_SEED_LOTTERY.lumaRatioBySeed };
  const restore = () => {
    G2_SEED_LOTTERY.lumaRatioBySeed = realRatios;
  };

  // --- 1. the record must reproduce, and must SAY SO when it does not --------------------------
  G2_SEED_LOTTERY.lumaRatioBySeed = { ...realRatios, 1: plateRatio };
  const agreeing = measureFile(platePath, spec, g2RecordProvenance(1), G2_SEED_LOTTERY.regionsPath);
  expectEqual('a record that reproduces on the plate raises NO stale warning', staleWarnings(agreeing).length, 0);
  expectEqual(
    'and the lottery sentence is not marked historical',
    lotteryWarning(agreeing).includes('HISTORICAL AND KNOWN STALE'),
    false
  );

  // The smallest drift the real defect produced: seed 20260807 went 0.4384 → 0.4390. A check that
  // only catches the big movers would have let that one through, so it is the one asserted.
  const smallestRealDrift = 0.0006;
  G2_SEED_LOTTERY.lumaRatioBySeed = { ...realRatios, 1: round(plateRatio - smallestRealDrift, 4) };
  const drifted = measureFile(platePath, spec, g2RecordProvenance(1), G2_SEED_LOTTERY.regionsPath);
  expectEqual(
    `a record 0.0006 off — the SMALLEST real drift — is caught`,
    staleWarnings(drifted).length,
    1
  );
  expectEqual(
    'and the lottery sentence disowns itself in the same report',
    lotteryWarning(drifted).includes('HISTORICAL AND KNOWN STALE'),
    true
  );
  expectEqual(
    'the stale warning names BOTH numbers, so nobody has to go and find them',
    (staleWarnings(drifted)[0] ?? '').includes(round(plateRatio, 4).toFixed(4)) &&
      (staleWarnings(drifted)[0] ?? '').includes((plateRatio - smallestRealDrift).toFixed(4)),
    true
  );

  // And the whole-round defect at its real magnitude, for the record.
  G2_SEED_LOTTERY.lumaRatioBySeed = { ...realRatios, 1: round(plateRatio - 0.0291, 4) };
  expectEqual(
    'the actual 2026-08-08 drift on seed 1 (0.0291) is caught',
    staleWarnings(measureFile(platePath, spec, g2RecordProvenance(1), G2_SEED_LOTTERY.regionsPath)).length,
    1
  );

  // --- 2. and it must stay QUIET on plates it cannot judge -------------------------------------
  //
  // A check that cries stale on a page it was never measured on gets switched off inside a day,
  // and then defect 1 is back. Every one of these differs from the record in exactly one way, on
  // a plate whose ratio is 0.0291 away from what the record claims.
  const notComparable = [
    ['an unrecorded seed', g2RecordProvenance(7, { page: CAPTURE_URL_AS_WRITTEN.replace('seed=1', 'seed=7') })],
    ['a different page', g2RecordProvenance(1, { page: 'http://localhost:5188/skin.html?bare=&freeze=' })],
    ['a different framing flag', g2RecordProvenance(1, { page: 'http://localhost:5188/alive.html?bare=&freeze=&frame=body' })],
    ['a pre-rolled motion state', g2RecordProvenance(1, { prerollSeconds: 6 })],
    ['no provenance at all', { source: 'none', known: false, summary: 'UNKNOWN PAGE' }],
  ];
  for (const [what, provenance] of notComparable) {
    expectEqual(
      `no stale claim on ${what}`,
      staleWarnings(measureFile(platePath, spec, provenance, G2_SEED_LOTTERY.regionsPath)).length,
      0
    );
  }

  // A different SIZE is the same class and needs its own plate, because the size compared is the
  // image's. 900×1200 rects on a 450×600 plate are not the recorded measurement.
  const halfSpec = {
    units: 'pixels',
    regions: {
      sclera: [{ x: 20, y: 20, w: 60, h: 60 }],
      cheek: [{ x: 300, y: 20, w: 60, h: 60 }],
    },
  };
  const halfPath = writeTestImage(
    'g2-seed-record-half.png',
    width / 2,
    height / 2,
    paint(width / 2, height / 2, (x) => (x < width / 4 ? sclera : cheek))
  );
  expectEqual(
    'no stale claim on a different resolution',
    staleWarnings(measureFile(halfPath, halfSpec, g2RecordProvenance(1), G2_SEED_LOTTERY.regionsPath)).length,
    0
  );

  // And the region spec, which is the other half of what a G2 ratio is a statement about. The
  // body spec samples different rectangles on the same page at the same size — a legitimately
  // different number, and crying stale at it would train people to ignore the warning.
  expectEqual(
    'no stale claim through a different region spec',
    staleWarnings(
      measureFile(platePath, spec, g2RecordProvenance(1), 'tools/critic/regions.lighting-body.json')
    ).length,
    0
  );
  restore();

  // --- 3. the comparability contract, against the URL capture.mjs actually writes ---------------
  //
  // Silence is the failure mode with no symptom. If canonicalPageKey and the record's pageKey ever
  // stop agreeing on the shape capture.mjs emits, every check above passes and the mechanism is
  // dead. Pin the shape itself.
  expectEqual(
    'capture.mjs\'s own URL shape canonicalises to the record\'s pageKey',
    canonicalPageKey(CAPTURE_URL_AS_WRITTEN),
    G2_SEED_LOTTERY.pageKey
  );
  expectEqual(
    'and the run-naming keys are what get dropped, not the render-deciding ones',
    canonicalPageKey('/alive.html?freeze&bare&seed=4242&capture=1'),
    G2_SEED_LOTTERY.pageKey
  );
  expectEqual(
    'a framing flag is NOT dropped — it is a different render',
    canonicalPageKey('/alive.html?bare=&freeze=&frame=body') === G2_SEED_LOTTERY.pageKey,
    false
  );

  // --- 4. the verdict is counted, not typed -----------------------------------------------------
  //
  // The original sentence carried "a 2.2× spread, two of four passing" as English. Recompute both
  // here from the record and TARGETS and require the printed sentence to agree — and then move the
  // record and require the sentence to move with it, which is the part a hand-typed verdict fails.
  const printed = lotteryWarning(measureFile(platePath, spec, g2RecordProvenance(1), G2_SEED_LOTTERY.regionsPath));
  const ratios = Object.values(G2_SEED_LOTTERY.lumaRatioBySeed);
  const low = TARGETS.scleraCheekRatio - TARGETS.scleraCheekTolerance;
  const high = TARGETS.scleraCheekRatio + TARGETS.scleraCheekTolerance;
  const inBand = ratios.filter((ratio) => ratio >= low && ratio <= high).length;
  const spread = Math.max(...ratios) / Math.min(...ratios);

  expectEqual('the printed spread is the computed one', printed.includes(`${round(spread, 1)}× spread`), true);
  expectEqual(
    'the printed pass count is the counted one',
    printed.includes(`${inBand} of ${ratios.length} inside the luma band`),
    true
  );
  expectEqual(
    'and every recorded value is printed at the 4 dp the tolerance assumes',
    ratios.every((ratio) => printed.includes(ratio.toFixed(4))),
    true
  );

  // Move the data; the verdict has to move on its own. With all four seeds inside the band the
  // count must read 4 of 4 and the spread must collapse to 1.0 — neither is reachable by editing
  // the record alone if the sentence is typed.
  G2_SEED_LOTTERY.lumaRatioBySeed = { 1: 0.98, 42: 0.98, 4242: 0.98, 20260807: 0.98 };
  const moved = lotteryWarning(measureFile(platePath, spec, g2RecordProvenance(42), G2_SEED_LOTTERY.regionsPath));
  expectEqual('a re-measured record moves the pass count with it', moved.includes('4 of 4 inside the luma band'), true);
  expectEqual('and the spread with it', moved.includes('1× spread'), true);
  restore();

  // --- 5. the zombie guard ----------------------------------------------------------------------
  //
  // Every superseded value must not appear in ANY string the report prints. This is the one
  // assertion that names the old numbers, and it names them only to forbid them.
  //
  // 🚩 TWO GENERATIONS ARE LISTED, AND THE SECOND IS THE DANGEROUS ONE. The guard was one
  // generation behind for a whole round: it forbade the 2026-08-07 values while measure.mjs went
  // on printing the 2026-08-08 ones, which had ALSO been superseded by the capture-epoch pin. The
  // values a reader is most likely to re-paste are the ones that were current until this morning,
  // not the ones that were current last week — so a generation stays on this list forever once it
  // leaves the record, and adding to it is part of re-measuring the record.
  const superseded = [
    '0.8127', '0.9627', '0.9736', '0.4384',   // the first generation, pre-82260d4
    '0.7836', '0.9189', '0.9292', '0.4390'    // the second: the pre-epoch-pin seed lottery
  ];
  const printedStrings = [];
  const report = measureFile(platePath, spec, g2RecordProvenance(1), G2_SEED_LOTTERY.regionsPath);
  printedStrings.push(...report.warnings);
  for (const gate of report.gates) {
    for (const key of ['target', 'note', 'reason']) if (gate[key]) printedStrings.push(gate[key]);
    printedStrings.push(...(gate.failures ?? []));
  }
  expectEqual(
    'no superseded G2 seed value survives anywhere in a printed report',
    superseded.filter((value) => printedStrings.some((line) => line.includes(value))).join(',') || 'none',
    'none'
  );
}

// ============================================================================================
// 4b. capture.mjs's reproducibility comparison, on plates with a KNOWN residue
// ============================================================================================
//
// The check this replaces compared SHA-256 digests and reported "NOT byte-reproducible" on 8 of
// 10 runs of an unchanged clean plate, because a GPU render's alpha-to-coverage resolve moves a
// few dozen pixels by a couple of code values. A flaky check on the observation instrument
// poisons everything downstream, so the residue was measured and the comparison restated in the
// units the residue is in. These plates carry the measured magnitudes exactly:
//
//   within one build, 12 browser processes   worst Δ3/255 on 0.025% of pixels
//   across a concurrent agent's edit         worst Δ209/255 on 0.391% of pixels
//   a different seed                         Δ249/255 on 25.75% of pixels
//
// The tolerance (Δ6 / 0.1%) has to sit above the first and below the other two. Assert it.

function testFrameSequenceComparison() {
  // 500x400 = 200,000 px, within 5% of the 350x600 plate the residue was measured on, so the
  // pixel FRACTIONS below are the real ones rather than a rescaling of them.
  const WIDTH = 500;
  const HEIGHT = 400;
  const TOTAL = WIDTH * HEIGHT;
  const CODE_TOLERANCE = 6;
  const AREA_TOLERANCE = 0.001;

  const flat = (code) => paint(WIDTH, HEIGHT, () => [code, code, code]);
  const perturbed = (code, pixels, delta) => {
    const bytes = flat(code);
    for (let i = 0; i < pixels; i += 1) {
      bytes[i * 4] = code + delta;
      bytes[i * 4 + 1] = code + delta;
      bytes[i * 4 + 2] = code + delta;
    }
    return bytes;
  };

  const png = (bytes) => encodePng(WIDTH, HEIGHT, bytes);
  const inside = (c) => c.worstCodeDelta <= CODE_TOLERANCE && c.worstPixelFraction <= AREA_TOLERANCE;
  const base = png(flat(20));

  const identical = compareFrameSequences([base, base], [base, base]);
  expectEqual('two identical sequences differ by nothing', identical.worstCodeDelta, 0);
  expectEqual('and by no pixels', identical.worstDifferingPixels, 0);

  // The alpha-to-coverage residue, at the magnitude measured on the real page: Δ3 on 44 px.
  const dust = compareFrameSequences([base, base], [base, png(perturbed(20, 44, 3))]);
  expectEqual('the measured GPU residue reads as Δ3', dust.worstCodeDelta, 3);
  expectEqual('on the frame it is actually on', dust.worstFrame, 2);
  expectClose('and 44 of 200,000 pixels', dust.worstPixelFraction, 44 / TOTAL, 1e-9);
  expectEqual(
    'so it is INSIDE the tolerance — this is the false negative the old digest check generated',
    inside(dust),
    true
  );

  // 🚩 PROVEN RED THREE WAYS, because a determinism break can be deep, wide, or both, and one
  // statistic cannot see all three (§1.11).
  //
  // Deep and narrow: 209 code values on the same 44 pixels. The AREA half cannot see this at all.
  const deep = compareFrameSequences([base], [png(perturbed(20, 44, 209))]);
  expectEqual('a deep narrow change reads as Δ209', deep.worstCodeDelta, 209);
  expectEqual('and is REJECTED', inside(deep), false);
  expectEqual(
    'the AREA half ALONE does not catch it — recorded, not tolerated',
    deep.worstPixelFraction <= AREA_TOLERANCE,
    true
  );

  // Wide and shallow: 2 code values over 2.5% of the frame. The CODE half cannot see this at all.
  const wide = compareFrameSequences([base], [png(perturbed(20, 5000, 2))]);
  expectEqual('a wide shallow change stays under Δ6', wide.worstCodeDelta, 2);
  expectEqual('and is REJECTED anyway', inside(wide), false);
  expectEqual(
    'the CODE half ALONE does not catch it — recorded, not tolerated',
    wide.worstCodeDelta <= CODE_TOLERANCE,
    true
  );

  // The real cross-build failure measured on the page: Δ209 on 821 px of 210,000 = 0.391%.
  const acrossBuild = compareFrameSequences([base], [png(perturbed(20, 782, 209))]);
  expectClose('the measured cross-build failure covers 0.391% of the frame', acrossBuild.worstPixelFraction, 0.00391, 1e-5);
  expectEqual('and both halves catch it', acrossBuild.worstCodeDelta > CODE_TOLERANCE && acrossBuild.worstPixelFraction > AREA_TOLERANCE, true);

  // Different sizes are not a residue, they are a different capture.
  const mismatched = compareFrameSequences(
    [base],
    [encodePng(WIDTH, HEIGHT + 1, paint(WIDTH, HEIGHT + 1, () => [20, 20, 20]))]
  );
  expectEqual('a size mismatch is a total difference, not a small one', mismatched.worstCodeDelta, 255);
  expectEqual('and reports the whole frame', mismatched.worstPixelFraction, 1);
}

// ============================================================================================
// 4c. capture.mjs --plate: which digest IS the plate, and how many pairs matched
// ============================================================================================
//
// A still plate's sha256 is quoted in PUNCHLIST as the identity of a configuration, and it is not
// one. Measured with `--plate` at 3840x5120, 60 steps, on the shipped default: thirty loads of one
// build returned TWELVE distinct digests, nineteen of them the digest already on record, worst
// residue 2 of 255 on 164 pixels of 19,660,800. A second run of the same thirty returned one
// digest. Whether a run looks byte-identical is not a property of the build.
//
// So `summarisePlateLoads` has two jobs and both were got wrong in a first draft:
//   - name the plate as the MODE. Naming load 1 makes a singleton the identity, and load 1 WAS a
//     singleton in the thirty-load run;
//   - count bit-identical PAIRS over all N(N-1)/2, not against a reference, because two loads can
//     each match the plate and a third can match neither.

function testPlateSummary() {
  // The shape of the measured 30-load run, compressed: a dominant mode and a tail of singletons,
  // with the mode NOT first. 10 loads, mode 'M' on 6 of them, four one-offs.
  const measured = ['x', 'M', 'M', 'y', 'M', 'z', 'M', 'w', 'M', 'M'];
  const summary = summarisePlateLoads(measured);

  expectEqual('the plate is the modal digest, not load 1', summary.modal.sha256, 'M');
  expectEqual('and it reports how many loads it was', summary.modal.loads.length, 6);
  expectEqual('load 1 was a singleton, which is why naming it would have been wrong',
    summary.groups.find((group) => group.sha256 === 'x').loads.length, 1);
  expectEqual('distinct digests', summary.distinctShas, 5);
  // C(6,2) among the mode, and nothing else pairs with anything.
  expectEqual('bit-identical pairs are counted over every pair', summary.bitIdenticalPairs, 15);
  expectEqual('of the full N(N-1)/2', summary.pairsCompared, 45);

  // 🚩 THE COUNT IS NOT "MATCHES THE PLATE", and this is the case that separates them. Two loads
  // agree with each other and neither is the mode: an against-the-reference count scores this 3,
  // the true pair count is 4. Getting this wrong understates agreement on exactly the runs where
  // the plate is least stable.
  const twoGroups = summarisePlateLoads(['A', 'A', 'A', 'B', 'B']);
  expectEqual('the mode is the larger group', twoGroups.modal.sha256, 'A');
  expectEqual('and the B pair is counted too', twoGroups.bitIdenticalPairs, 3 + 1);

  const clean = summarisePlateLoads(['A', 'A', 'A', 'A']);
  expectEqual('a genuinely byte-identical run is every pair', clean.bitIdenticalPairs, 6);
  expectEqual('over every pair', clean.pairsCompared, 6);

  // No repeats at all: there is no mode, and the honest report is "one of N" rather than silence.
  const noRepeats = summarisePlateLoads(['A', 'B', 'C']);
  expectEqual('with no repeats the tie breaks to the earliest load', noRepeats.modal.sha256, 'A');
  expectEqual('and says it is one of three', noRepeats.modal.loads.length, 1);
  expectEqual('with nothing bit-identical', noRepeats.bitIdenticalPairs, 0);

  // Two loads is the floor the CLI enforces, and it must still produce a pair.
  expectEqual('two loads is one pair', summarisePlateLoads(['A', 'B']).pairsCompared, 1);
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
  testProvenance();
  testG2SeedRecord();
  testFrameSequenceComparison();
  testPlateSummary();
  testTerminatorShift();
  testG2MarginVerdict();
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

// ============================================================================================
// 4a-ter. THE G2 MARGIN VERDICT — a rule that decides whether a verdict may be quoted
// ============================================================================================
//
// The sentence this replaces was four typed literals ("0.9197 FAIL against 0.9221 PASS, a
// difference of 0.0024"). It was true when written and false one round later, at which point the
// tool would have gone on stamping MARGINAL on a green clearing its floor by ten times the largest
// thing that can move it — training a reader to skip the word, which is the failure mode MARGINAL
// exists to prevent.
//
// The replacement is computed, so the class of rot above cannot recur. But a computed rule with no
// rejection proof is the same decoration wearing better clothes, so this section proves it fires
// in BOTH directions and does not merely track the sign of the gate.
function testG2MarginVerdict() {
  const low = TARGETS.scleraCheekRatio - TARGETS.scleraCheekTolerance;
  const high = TARGETS.scleraCheekRatio + TARGETS.scleraCheekTolerance;
  const worst = Math.max(...G2_RECIPE_SENSITIVITIES.map((row) => row.delta));

  const verdict = (ratio) => describeG2Margin({ measured: { ratioEncoded: ratio } }, low, high);
  const isMarginal = (ratio) => verdict(ratio).startsWith('G2 IS MARGINAL');

  // The forward case: the plate this round actually ships. Clears the floor by 10x the worst
  // recipe sensitivity, so the verdict is entitled and the rule says so.
  expectEqual('MARGIN: the shipped default is NOT marginal', isMarginal(0.9544), false);

  // 🚩 REJECTION 1 — a PASSING plate that is marginal anyway. This is the direction the rule exists
  // for and the one a sign-following check cannot do: 0.9210 is INSIDE the band and still too close
  // to its edge to be quoted, because changing the anti-aliasing mode alone moves G2 further.
  expectEqual('MARGIN: a PASS 0.0010 inside the floor is still MARGINAL', isMarginal(low + 0.0010), true);

  // 🚩 REJECTION 2 — a DIFFERENT mechanism in the same class: the CEILING, which the retired
  // sentence never mentioned at all because no plate had ever approached it. A gate written only
  // against the edge that happened to be in play is a gate about one edge.
  expectEqual('MARGIN: a PASS 0.0010 inside the CEILING is MARGINAL too', isMarginal(high - 0.0010), true);
  expectEqual(
    'MARGIN: and it names the CEILING rather than defaulting to the floor',
    verdict(high - 0.0010).includes('from the ceiling'),
    true
  );

  // 🚩 REJECTION 3 — a FAILING plate just outside the floor. The rule is about distance from the
  // edge, not about which side of it the plate landed on, so a near-miss FAIL is unquotable for
  // exactly the same reason a near-hit PASS is.
  expectEqual('MARGIN: a FAIL 0.0010 outside the floor is MARGINAL', isMarginal(low - 0.0010), true);

  // The boundary is the sensitivity itself, not a hand-picked number, and it is asserted from both
  // sides so that shrinking the table silently cannot widen the rule.
  expectEqual('MARGIN: the boundary is the worst recipe sensitivity, below', isMarginal(low + worst * 0.99), true);
  expectEqual('MARGIN: the boundary is the worst recipe sensitivity, above', isMarginal(low + worst * 1.01), false);

  // A gate that cannot be measured must not report headroom it does not have.
  expectEqual(
    'MARGIN: an unmeasurable G2 offers no verdict at all',
    describeG2Margin({}, low, high).includes('could not be measured'),
    true
  );

  // And the table it all rests on has to be a table, not one row that happens to be biggest.
  expectEqual('MARGIN: every recipe sensitivity is a positive measured number',
    G2_RECIPE_SENSITIVITIES.every((row) => row.delta > 0 && row.detail.length > 0)
      && G2_RECIPE_SENSITIVITIES.length >= 3,
    true);
}

process.exitCode = run();
