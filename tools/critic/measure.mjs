#!/usr/bin/env node
//
// measure.mjs — the objective half of the critic loop.
//
// Six gates from docs/research/stellar-blade-look-spec.md §6. They exist so that "does this look
// right?" stops being purely a matter of taste: a render either reproduces the measured
// properties of the reference or it does not, and the number says which.
//
//   G1  face key:shadow luma ratio     < 2:1
//   G2  sclera luma / cheek luma       ≈ 0.98  (±0.06)
//   G3  shadow terminator gets MORE saturated and REDDER than lit skin  (SSS correctness)
//   G4  flat-skin 5×5 high-pass σ      1.5–2.1 / 255 at 4K
//   G5  fraction of pixels above 0.99 luma  < 0.5%
//   G6  black point, p0.1 luma         0.004–0.016  (NO lift)
//
// Usage:
//   node measure.mjs <image.png> <regions.json> [--human] [--out result.json]
//
// Exit codes are distinct on purpose, so a calling script can tell "the render failed a gate"
// from "the tool broke":
//   0 = every gate PASS or SKIP
//   1 = at least one gate FAIL
//   2 = tool error (bad file, bad region spec, unreadable PNG)

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  decodePng,
} from './png.mjs';
import {
  encodedLuma,
  linearLuma,
  meanEncodedRgb,
  rgbToHsv,
  hueDistanceFromRed,
} from './color.mjs';

// --- gate targets, quoted from the spec -----------------------------------------------------
//
// Do not "tune" these. They are measurements of the reference, not preferences. If a target has
// to move, the spec moves first and this file follows it.

const TARGETS = {
  // §6.1 / §5 lighting rig. Judged on LINEAR luma because a key:shadow ratio is a ratio of
  // light — the spec's own comparison ("western photoreal runs 4:1–8:1") is a stop-based,
  // linear figure, and a 2.0 threshold read as ENCODED would be 2^2.4 = 5.28 linear, i.e. it
  // would happily pass the photoreal lighting the gate exists to reject.
  //
  // Reference, recomputed from the spec's published hexes: #E5C3C3 → #C29997 is 1.25 encoded
  // and 1.634 linear. The second asset is published only as encoded lumas (0.577 → 0.489 =
  // 1.18), which implies ≈1.43 linear under the true sRGB EOTF. So the reference band is ~1.43–1.64 linear.
  keyShadowRatioMax: 2.0,
  keyShadowReferenceLinear: [1.43, 1.64],

  // §2 eyes: sclera measured 0.483 against cheek 0.492 = 0.98×. Judged ENCODED — it is a
  // "reads as the same brightness" test and 0.98 is the encoded figure the spec published.
  scleraCheekRatio: 0.98,
  scleraCheekTolerance: 0.06,

  // §2 skin: saturation RISES into shadow (0.15–0.25 lit → 0.23–0.26 shadow → 0.41 in
  // transmission) and hue shifts red. The gate is RELATIONAL — the absolute band is reported
  // but not enforced, because it depends on the key colour of the shot being measured.
  saturationRiseMin: 0.01,
  shadowSaturationBand: [0.23, 0.26],

  // §0.2 / §5 skin detail. Encoded 8-bit code values, hence "/255".
  highPassSigma: [1.5, 2.1],
  highPassReferenceWidth: 3840,

  // §3 grade.
  clippedLumaThreshold: 0.99,
  clippedFractionMax: 0.005,
  blackPointPercentile: 0.1,
  blackPointBand: [0.004, 0.016],
};

// A 16-bit histogram resolves the black point to ~1.5e-5, which is two orders of magnitude
// finer than the 0.004–0.016 band G6 cares about, and costs 256 KB instead of sorting 8M floats.
const HISTOGRAM_BINS = 65536;

// --- entry point ----------------------------------------------------------------------------

function main(argv) {
  const options = parseArguments(argv);
  if (options.help) {
    process.stdout.write(usageText());
    return 0;
  }

  const image = decodePng(fs.readFileSync(options.imagePath));
  const spec = JSON.parse(fs.readFileSync(options.regionsPath, 'utf8'));
  const regions = resolveRegions(spec, image);

  const report = measureAll(image, regions, spec, options.imagePath);

  const serialised = JSON.stringify(report, null, 2);
  if (options.outPath) fs.writeFileSync(options.outPath, serialised);
  process.stdout.write(options.human ? formatHumanReport(report) : `${serialised}\n`);

  return report.summary.failed > 0 ? 1 : 0;
}

// --- measurement ----------------------------------------------------------------------------

function measureAll(image, regions, spec, imagePath) {
  // One pass builds the encoded-luma field that three of the six gates read from. Everything
  // downstream reads this instead of touching raw pixels again.
  const lumaField = buildEncodedLumaField(image);
  const warnings = collectCaptureWarnings(image, spec);

  const gates = [
    measureKeyShadowRatio(image, regions),
    measureScleraAgainstCheek(image, regions),
    measureTerminatorShift(image, regions),
    measureHighPassSigma(image, lumaField, regions, warnings),
    measureHighlightClipping(image, lumaField, regions),
    measureBlackPoint(image, lumaField, regions),
  ];

  const summary = {
    passed: gates.filter((gate) => gate.status === 'PASS').length,
    failed: gates.filter((gate) => gate.status === 'FAIL').length,
    skipped: gates.filter((gate) => gate.status === 'SKIP').length,
  };
  summary.verdict = summary.failed > 0 ? 'FAIL' : 'PASS';

  return {
    image: {
      path: path.resolve(imagePath),
      width: image.width,
      height: image.height,
      bitDepth: image.bitDepth,
      colorType: image.colorType,
    },
    warnings,
    gates,
    summary,
  };
}

// G1 — the highest-leverage parameter in the whole spec. A conventional 4:1 three-point ratio
// reads as the wrong game no matter how good the skin shader is.
function measureKeyShadowRatio(image, regions) {
  const key = regions.faceKey;
  const shadow = regions.faceShadow;
  if (!key || !shadow) {
    return skipGate('G1', 'face key:shadow luma ratio', 'needs regions "faceKey" and "faceShadow"');
  }

  const lit = summariseRegion(image, key);
  const dark = summariseRegion(image, shadow);
  const linearRatio = lit.linearLuma / dark.linearLuma;
  const encodedRatio = lit.encodedLuma / dark.encodedLuma;

  return {
    id: 'G1',
    name: 'face key:shadow luma ratio',
    status: linearRatio < TARGETS.keyShadowRatioMax ? 'PASS' : 'FAIL',
    lumaDomain: 'linear',
    target: `< ${TARGETS.keyShadowRatioMax.toFixed(2)}:1 (reference ${TARGETS.keyShadowReferenceLinear[0]}–${TARGETS.keyShadowReferenceLinear[1]} linear, 1.18–1.25 encoded)`,
    measured: {
      ratioLinear: round(linearRatio, 4),
      ratioEncoded: round(encodedRatio, 4),
      keyLumaLinear: round(lit.linearLuma, 4),
      shadowLumaLinear: round(dark.linearLuma, 4),
      keyLumaEncoded: round(lit.encodedLuma, 4),
      shadowLumaEncoded: round(dark.encodedLuma, 4),
      keyHex: lit.hex,
      shadowHex: dark.hex,
    },
    note: 'Judged in the linear domain: a key:shadow ratio is a ratio of light. The encoded ratio is reported so it can be compared directly against the spec text.',
  };
}

// G2 — a white eyeball instantly breaks the look. The reference sclera measures the SAME
// luminance as the cheek beside it, from heavy lid AO plus sclera SSS.
function measureScleraAgainstCheek(image, regions) {
  const sclera = regions.sclera;
  const cheek = regions.cheek;
  if (!sclera || !cheek) {
    return skipGate('G2', 'sclera : cheek luma', 'needs regions "sclera" and "cheek"');
  }

  const white = summariseRegion(image, sclera);
  const skin = summariseRegion(image, cheek);
  const ratio = white.encodedLuma / skin.encodedLuma;
  const low = TARGETS.scleraCheekRatio - TARGETS.scleraCheekTolerance;
  const high = TARGETS.scleraCheekRatio + TARGETS.scleraCheekTolerance;

  return {
    id: 'G2',
    name: 'sclera : cheek luma',
    status: ratio >= low && ratio <= high ? 'PASS' : 'FAIL',
    lumaDomain: 'encoded',
    target: `${TARGETS.scleraCheekRatio} ± ${TARGETS.scleraCheekTolerance} (${round(low, 2)}–${round(high, 2)})`,
    measured: {
      ratioEncoded: round(ratio, 4),
      ratioLinear: round(white.linearLuma / skin.linearLuma, 4),
      scleraLumaEncoded: round(white.encodedLuma, 4),
      cheekLumaEncoded: round(skin.encodedLuma, 4),
      scleraSaturation: round(white.saturation, 4),
      cheekSaturation: round(skin.saturation, 4),
      scleraHex: white.hex,
      cheekHex: skin.hex,
    },
    note: 'Judged encoded — this is a perceptual "reads as the same brightness" match, and 0.98 is the encoded figure the spec measured. Reference sclera is also MORE saturated than cheek (0.275 vs 0.215).',
  };
}

// G3 — the objective subsurface-scattering test. Physically wrong skin shading darkens toward
// grey or blue; a pre-integrated skin profile pushes the terminator redder and more saturated.
function measureTerminatorShift(image, regions) {
  const litRegion = regions.litSkin;
  const shadowRegion = regions.shadowTerminator;
  if (!litRegion || !shadowRegion) {
    return skipGate('G3', 'terminator saturation and hue shift', 'needs regions "litSkin" and "shadowTerminator"');
  }

  const lit = summariseRegion(image, litRegion);
  const shadow = summariseRegion(image, shadowRegion);

  const saturationRise = shadow.saturation - lit.saturation;
  const saturationRises = saturationRise >= TARGETS.saturationRiseMin;
  const hueGetsRedder = shadow.hueDistanceFromRed < lit.hueDistanceFromRed;

  const failures = [];
  if (!saturationRises) failures.push(`saturation did not rise (${round(saturationRise, 4)})`);
  if (!hueGetsRedder) {
    failures.push(
      `hue moved away from red (${round(lit.hueDistanceFromRed, 2)}° → ${round(shadow.hueDistanceFromRed, 2)}° from red)`
    );
  }

  const [bandLow, bandHigh] = TARGETS.shadowSaturationBand;

  return {
    id: 'G3',
    name: 'terminator saturation and hue shift',
    status: failures.length === 0 ? 'PASS' : 'FAIL',
    lumaDomain: 'encoded',
    target: 'shadow saturation > lit saturation AND shadow hue closer to red',
    measured: {
      litSaturation: round(lit.saturation, 4),
      shadowSaturation: round(shadow.saturation, 4),
      saturationRise: round(saturationRise, 4),
      litHue: round(lit.hue, 2),
      shadowHue: round(shadow.hue, 2),
      litHueDistanceFromRed: round(lit.hueDistanceFromRed, 2),
      shadowHueDistanceFromRed: round(shadow.hueDistanceFromRed, 2),
      litHex: lit.hex,
      shadowHex: shadow.hex,
      shadowSaturationInReferenceBand:
        shadow.saturation >= bandLow && shadow.saturation <= bandHigh,
    },
    failures,
    note: `Relational test. The absolute reference band for shadow saturation is ${bandLow}–${bandHigh}, reported but NOT enforced: it depends on the key colour of the shot. Sample lit and shadow from the same lighting setup or the comparison is meaningless.`,
  };
}

// G4 — skin micro-detail amplitude. The reference is 3–5× LOWER than photoreal scan skin;
// too much detail reads as "western photoreal", too little as plastic.
function measureHighPassSigma(image, lumaField, regions, warnings) {
  const patch = regions.flatCheek;
  if (!patch) {
    return skipGate('G4', 'flat-skin high-pass sigma', 'needs region "flatCheek"');
  }
  if (patch.rects.length !== 1) {
    return skipGate('G4', 'flat-skin high-pass sigma', 'region "flatCheek" must be exactly one rect');
  }

  const rect = patch.rects[0];
  if (rect.w < 16 || rect.h < 16) {
    return skipGate('G4', 'flat-skin high-pass sigma', 'region "flatCheek" must be at least 16×16 px');
  }

  const sigma = highPassSigmaOverRect(lumaField, image.width, image.height, rect);
  const [low, high] = TARGETS.highPassSigma;

  const widthDrift = Math.abs(image.width - TARGETS.highPassReferenceWidth) / TARGETS.highPassReferenceWidth;
  if (widthDrift > 0.1) {
    warnings.push(
      `G4 was measured at ${image.width} px wide but the reference sigma band was measured at ${TARGETS.highPassReferenceWidth} px. High-pass amplitude is scale-dependent and there is no sound rescaling law — capture at 4K for a comparable number.`
    );
  }

  return {
    id: 'G4',
    name: 'flat-skin high-pass sigma',
    status: sigma.sigma255 >= low && sigma.sigma255 <= high ? 'PASS' : 'FAIL',
    lumaDomain: 'encoded',
    target: `${low}–${high} / 255 at ${TARGETS.highPassReferenceWidth} px wide`,
    measured: {
      sigmaPer255: round(sigma.sigma255, 4),
      meanAbsoluteHighPass: round(sigma.meanAbs255, 4),
      patchMeanLumaEncoded: round(sigma.meanLuma, 4),
      pixelCount: sigma.pixelCount,
      imageWidth: image.width,
    },
    note: 'High-pass is pixel minus the mean of its 5×5 neighbourhood (neighbourhood sampled from the full image, clamped at edges), on encoded Rec.709 luma in 0–255 code values. Photoreal scan skin measures 6–12 here; the reference measures 1.44–2.11.',
  };
}

// G5 — highlight rolloff. Even a frame full of emissive neon puts 0.001% of the reference at
// white. Hard clipping is the loudest "this is a game engine with the defaults on" tell.
function measureHighlightClipping(image, lumaField, regions) {
  const indices = regions.frame ? regions.frame.pixelIndices : null;
  let clipped = 0;
  let total = 0;

  if (indices) {
    for (const index of indices) {
      if (lumaField[index / 4] > TARGETS.clippedLumaThreshold) clipped += 1;
      total += 1;
    }
  } else {
    total = lumaField.length;
    for (let i = 0; i < lumaField.length; i += 1) {
      if (lumaField[i] > TARGETS.clippedLumaThreshold) clipped += 1;
    }
  }

  const fraction = clipped / total;

  return {
    id: 'G5',
    name: 'highlight clipping',
    status: fraction < TARGETS.clippedFractionMax ? 'PASS' : 'FAIL',
    lumaDomain: 'encoded',
    target: `< ${(TARGETS.clippedFractionMax * 100).toFixed(1)}% of pixels above ${TARGETS.clippedLumaThreshold} luma`,
    measured: {
      clippedFraction: round(fraction, 6),
      clippedPercent: round(fraction * 100, 4),
      clippedPixels: clipped,
      totalPixels: total,
      scope: indices ? 'region "frame"' : 'whole image',
    },
    note: 'Reference assets: 0.001%–0.036% for portraits and action; the one asset at 1.30% was background practicals, not the subject.',
  };
}

// G6 — black point. The commonest mistake when people try to make a render look "cinematic" is
// lifting the shadows. The reference does not do it: p0.1 sits at 0.004–0.016.
function measureBlackPoint(image, lumaField, regions) {
  const histogram = new Uint32Array(HISTOGRAM_BINS);
  const indices = regions.frame ? regions.frame.pixelIndices : null;
  let total = 0;

  if (indices) {
    for (const index of indices) {
      histogram[binFor(lumaField[index / 4])] += 1;
      total += 1;
    }
  } else {
    total = lumaField.length;
    for (let i = 0; i < lumaField.length; i += 1) {
      histogram[binFor(lumaField[i])] += 1;
    }
  }

  const p01 = percentileFromHistogram(histogram, total, TARGETS.blackPointPercentile / 100);
  const p50 = percentileFromHistogram(histogram, total, 0.5);
  const [low, high] = TARGETS.blackPointBand;

  return {
    id: 'G6',
    name: 'black point (no lift)',
    status: p01 >= low && p01 <= high ? 'PASS' : 'FAIL',
    lumaDomain: 'encoded',
    target: `p${TARGETS.blackPointPercentile} luma in ${low}–${high}`,
    measured: {
      p01Luma: round(p01, 5),
      p01Code8Bit: round(p01 * 255, 2),
      medianLuma: round(p50, 4),
      totalPixels: total,
      scope: indices ? 'region "frame"' : 'whole image',
    },
    note: 'Below the band means blacks are crushed; above it means shadow lift, which the reference grade does not have. Measured to 1/65536 via histogram.',
  };
}

// --- region handling ------------------------------------------------------------------------

// Turns the JSON spec into resolved pixel rects plus a flat list of pixel offsets per region.
// Accepts either shorthand (`"cheek": [ {x,y,w,h} ]`) or the documented object form
// (`"cheek": { "note": "...", "rects": [...] }`).
function resolveRegions(spec, image) {
  const normalised = spec.units === 'normalized';
  const resolved = {};

  for (const [name, value] of Object.entries(spec.regions ?? {})) {
    // JSON has no comments, so a leading underscore marks a documentation key. See
    // regions.example.json, which uses them heavily.
    if (name.startsWith('_')) continue;

    const rawRects = Array.isArray(value) ? value : value.rects;
    if (!Array.isArray(rawRects) || rawRects.length === 0) {
      throw new Error(`Region "${name}" has no rects.`);
    }

    const rects = rawRects.map((rect) => toPixelRect(rect, image, normalised, name));
    resolved[name] = {
      name,
      note: Array.isArray(value) ? '' : (value.note ?? ''),
      rects,
      pixelIndices: collectPixelIndices(rects, image.width),
    };
  }

  return resolved;
}

function toPixelRect(rect, image, normalised, regionName) {
  const scaleX = normalised ? image.width : 1;
  const scaleY = normalised ? image.height : 1;

  const x = Math.round(rect.x * scaleX);
  const y = Math.round(rect.y * scaleY);
  const w = Math.round(rect.w * scaleX);
  const h = Math.round(rect.h * scaleY);

  if (w <= 0 || h <= 0) {
    throw new Error(`Region "${regionName}" has a rect with non-positive size.`);
  }
  if (x < 0 || y < 0 || x + w > image.width || y + h > image.height) {
    throw new Error(
      `Region "${regionName}" rect ${x},${y} ${w}×${h} falls outside the ${image.width}×${image.height} image.`
    );
  }

  return { x, y, w, h };
}

function collectPixelIndices(rects, imageWidth) {
  const indices = [];
  for (const rect of rects) {
    for (let y = rect.y; y < rect.y + rect.h; y += 1) {
      for (let x = rect.x; x < rect.x + rect.w; x += 1) {
        indices.push((y * imageWidth + x) * 4);
      }
    }
  }
  return indices;
}

// Every per-region number the gates need, computed once. Note that the linear luma is the mean
// of per-pixel linear luma — NOT the linearisation of the mean colour, which would be a
// different (and wrong) quantity.
function summariseRegion(image, region) {
  const { pixels } = image;
  const indices = region.pixelIndices;

  let linearSum = 0;
  for (const index of indices) {
    linearSum += linearLuma(pixels[index], pixels[index + 1], pixels[index + 2]);
  }

  const mean = meanEncodedRgb(pixels, indices);
  const hsv = rgbToHsv(mean.r, mean.g, mean.b);

  return {
    encodedLuma: encodedLuma(mean.r, mean.g, mean.b),
    linearLuma: linearSum / indices.length,
    saturation: hsv.saturation,
    hue: hsv.hue,
    hueDistanceFromRed: hueDistanceFromRed(hsv.hue),
    hex: toHex(mean),
    pixelCount: indices.length,
  };
}

// --- pixel maths ------------------------------------------------------------------------------

function buildEncodedLumaField(image) {
  const field = new Float32Array(image.width * image.height);
  const { pixels } = image;
  for (let i = 0; i < field.length; i += 1) {
    const base = i * 4;
    field[i] = encodedLuma(pixels[base], pixels[base + 1], pixels[base + 2]);
  }
  return field;
}

// 5×5 boxcar high-pass: value minus the local mean. The neighbourhood is taken from the whole
// image and clamped at the borders, so every pixel inside the rect contributes — no 2 px inset,
// no edge bias.
function highPassSigmaOverRect(lumaField, imageWidth, imageHeight, rect) {
  let sum = 0;
  let sumSquares = 0;
  let sumAbs = 0;
  let lumaSum = 0;
  let count = 0;

  for (let y = rect.y; y < rect.y + rect.h; y += 1) {
    for (let x = rect.x; x < rect.x + rect.w; x += 1) {
      const centre = lumaField[y * imageWidth + x] * 255;

      let neighbourhood = 0;
      let neighbours = 0;
      for (let dy = -2; dy <= 2; dy += 1) {
        const ny = clamp(y + dy, 0, imageHeight - 1);
        for (let dx = -2; dx <= 2; dx += 1) {
          const nx = clamp(x + dx, 0, imageWidth - 1);
          neighbourhood += lumaField[ny * imageWidth + nx] * 255;
          neighbours += 1;
        }
      }

      const highPass = centre - neighbourhood / neighbours;
      sum += highPass;
      sumSquares += highPass * highPass;
      sumAbs += Math.abs(highPass);
      lumaSum += centre;
      count += 1;
    }
  }

  const mean = sum / count;
  const variance = Math.max(0, sumSquares / count - mean * mean);

  return {
    sigma255: Math.sqrt(variance),
    meanAbs255: sumAbs / count,
    meanLuma: lumaSum / count / 255,
    pixelCount: count,
  };
}

function binFor(luma) {
  const bin = Math.floor(luma * HISTOGRAM_BINS);
  return clamp(bin, 0, HISTOGRAM_BINS - 1);
}

function percentileFromHistogram(histogram, total, quantile) {
  const wanted = Math.max(1, Math.ceil(quantile * total));
  let seen = 0;
  for (let bin = 0; bin < histogram.length; bin += 1) {
    seen += histogram[bin];
    if (seen >= wanted) return (bin + 0.5) / HISTOGRAM_BINS;
  }
  return 1;
}

// --- reporting ---------------------------------------------------------------------------------

// Things that make a measurement untrustworthy rather than merely failing. Surfaced separately
// so a red gate is never blamed on the render when the capture itself was wrong.
function collectCaptureWarnings(image, spec) {
  const warnings = [];

  let transparent = 0;
  for (let i = 3; i < image.pixels.length; i += 4) {
    if (image.pixels[i] < 0.99) transparent += 1;
  }
  const transparentFraction = transparent / (image.width * image.height);
  if (transparentFraction > 0.01) {
    warnings.push(
      `${round(transparentFraction * 100, 2)}% of pixels are not opaque — the capture was probably not composited over a background, which makes the grade gates (G5, G6) meaningless.`
    );
  }

  // A resolution mismatch is fatal for a pixel-unit spec (the rects land somewhere else entirely)
  // and merely worth noting for a normalised one (the rects still track, but G4's sigma does not
  // survive a resolution change). Say which, rather than one vague message that fits neither.
  if (spec.imageWidth && spec.imageWidth !== image.width) {
    if (spec.units === 'normalized') {
      warnings.push(
        `Region spec was authored against ${spec.imageWidth} px wide but the image is ${image.width} px. The normalised rects still track the same features, but G4's sigma is not comparable across resolutions.`
      );
    } else {
      warnings.push(
        `Region spec declares imageWidth ${spec.imageWidth} but the image is ${image.width} px wide, and its rects are in PIXELS — every region is now pointing somewhere else. Re-author the rects, or switch to "units": "normalized".`
      );
    }
  }

  return warnings;
}

function skipGate(id, name, reason) {
  return { id, name, status: 'SKIP', reason };
}

function formatHumanReport(report) {
  const lines = [];
  lines.push(`${report.image.path}`);
  lines.push(`${report.image.width}×${report.image.height}, ${report.image.bitDepth}-bit`);
  lines.push('');

  for (const gate of report.gates) {
    lines.push(`${gate.status.padEnd(4)} ${gate.id}  ${gate.name}`);
    if (gate.status === 'SKIP') {
      lines.push(`        ${gate.reason}`);
    } else {
      lines.push(`        target: ${gate.target}  [${gate.lumaDomain} luma]`);
      const headline = Object.entries(gate.measured)[0];
      lines.push(`        actual: ${headline[0]} = ${headline[1]}`);
      for (const failure of gate.failures ?? []) lines.push(`        ↳ ${failure}`);
    }
    lines.push('');
  }

  for (const warning of report.warnings) lines.push(`WARN  ${warning}`);
  if (report.warnings.length > 0) lines.push('');

  lines.push(
    `${report.summary.verdict}: ${report.summary.passed} passed, ${report.summary.failed} failed, ${report.summary.skipped} skipped`
  );
  return `${lines.join('\n')}\n`;
}

// --- small utilities ----------------------------------------------------------------------------

function parseArguments(argv) {
  const options = { imagePath: null, regionsPath: null, human: false, outPath: null, help: false };
  const positional = [];

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--human') options.human = true;
    else if (arg === '--help' || arg === '-h') options.help = true;
    else if (arg === '--out') {
      i += 1;
      options.outPath = argv[i];
    } else if (arg.startsWith('--')) throw new Error(`Unknown option ${arg}.`);
    else positional.push(arg);
  }

  if (options.help) return options;
  if (positional.length !== 2) {
    throw new Error('Expected exactly two arguments: <image.png> <regions.json>. Run with --help.');
  }

  options.imagePath = positional[0];
  options.regionsPath = positional[1];
  return options;
}

function usageText() {
  return [
    'measure.mjs — six objective gates from the Stellar Blade look spec.',
    '',
    'Usage:',
    '  node measure.mjs <image.png> <regions.json> [--human] [--out result.json]',
    '',
    'Options:',
    '  --human          human-readable summary instead of JSON on stdout',
    '  --out <path>     also write the full JSON report to a file',
    '',
    'Exit codes:  0 = all gates pass or skip   1 = a gate failed   2 = tool error',
    '',
    'See regions.example.json for the region spec format and README.md for what each gate means.',
    '',
  ].join('\n');
}

function toHex({ r, g, b }) {
  const channel = (value) =>
    Math.round(clamp(value, 0, 1) * 255)
      .toString(16)
      .padStart(2, '0');
  return `#${channel(r)}${channel(g)}${channel(b)}`.toUpperCase();
}

function clamp(value, low, high) {
  if (value < low) return low;
  if (value > high) return high;
  return value;
}

function round(value, places) {
  const scale = 10 ** places;
  return Math.round(value * scale) / scale;
}

// One catch-all at the boundary where measurement becomes output.
//
// fileURLToPath rather than a string compare against `file://${argv[1]}`: this repository's own
// path contains a space and a non-ASCII character, so import.meta.url arrives percent-encoded
// and the naive comparison never matches.
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  try {
    process.exitCode = main(process.argv.slice(2));
  } catch (error) {
    process.stderr.write(`measure.mjs: ${error.message}\n`);
    process.exitCode = 2;
  }
}

export { measureAll, resolveRegions, TARGETS };
