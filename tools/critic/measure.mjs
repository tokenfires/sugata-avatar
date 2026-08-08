#!/usr/bin/env node
//
// measure.mjs — the objective half of the critic loop.
//
// Seven gates from docs/research/stellar-blade-look-spec.md §6. They exist so that "does this look
// right?" stops being purely a matter of taste: a render either reproduces the measured
// properties of the reference or it does not, and the number says which.
//
//   G1  face key:shadow luma ratio     < 2:1
//   G2  sclera vs cheek, BOTH halves:  luma ≈ 0.98 (±0.06) AND chroma ≈ 1.28× (the sclera is
//       more saturated than skin — one spec sentence, two measurable properties)
//   G3  shadow terminator gets MORE saturated and REDDER than lit skin  (SSS correctness)
//   G4  flat-skin 5×5 high-pass σ      1.5–2.1 / 255 at 4K
//   G5  fraction of pixels above 0.99 luma  < 0.5%
//   G6  black point, p0.1 luma         0.004–0.016  (NO lift)
//   G7  near-black surfaces do not render as saturated coloured ones  < 0.10% of the card band
//
// 🚩 EVERY NUMBER THIS TOOL PRINTS IS ABOUT ONE PAGE AT ONE FRAMING IN ONE MOTION STATE, and the
// report says which. That block is not decoration. A G4 sigma of 1.9495/255 was measured on
// `packages/testbed/src/skin.html` — different page, different framing, different rig — and then
// quoted in docs/PUNCHLIST.md as certifying `alive.html`, which measures 1.4764 at the same width.
// The two plates were never comparable and nothing in the report said so. So: a report carries a
// `provenance` block, every gate carries a `measuredOn` string beside its number, and a plate with
// no provenance is WARNED about rather than silently measured. `capture.mjs` writes the
// `capture.json` this reads; `--page` supplies it by hand for a screenshot taken any other way.
//
// 🚩 G7 exists because G1–G6 could all be green on a plate whose single most visually wrong
// feature was the eyelashes rendering as vivid royal-blue spikes. Every one of G1–G6 samples a
// small rectangle of cheek, sclera or terminator, or a whole-image percentile; between them they
// make no assertion about COLOUR anywhere else in the frame, so a near-black surface reflecting a
// saturated rim at full Fresnel is invisible to all six. That was true for three review rounds.
// G7 is deliberately a different KIND of assertion — a per-pixel outlier count rather than a mean
// or a ratio between two patches — because a mean over a patch containing both black cards and
// bright skin cannot resolve the defect at all (LEARNINGS §1.11).
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

  // 🎯 THE OTHER HALF OF THE SAME SPEC SENTENCE, which no gate measured for three rounds.
  //
  // The spec does not say "the sclera matches the cheek's brightness". It says the sclera "measures
  // the same luminance as the surrounding cheek and is *more* saturated than skin (0.275 vs 0.215),
  // pink-tinted." Only the first clause was gated, so a render could match the luma exactly while
  // rendering a grey eyeball, and G2 would call it green. Measured on `alive.html?bare&freeze` at
  // 900×1200: sclera saturation 0.0917 against cheek 0.2200 — a ratio of 0.417 against a reference
  // 1.284, i.e. out by 3.1× on the half nothing was looking at, while the luma half was being
  // quoted as proof the eye shader worked.
  //
  // The reference is RECOMPUTED from the spec's own published hexes rather than copied from its
  // prose, so the constant traces to a measurement rather than to a sentence: HSV saturation of
  // sclera #9D7274 is (157−114)/157 = 0.27389 and of cheek #96767D is (150−118)/150 = 0.21333,
  // giving 1.2839. The spec's own rounded prose figures (0.275 / 0.215) give 1.2791 — they agree
  // to 0.4%, which is what makes it safe to quote either.
  //
  // Two components, because they answer different questions and one of them is ordinal:
  //
  //   ORDINAL — sclera saturation ≥ cheek saturation. This is the spec sentence verbatim and it
  //             invents nothing. A grey or blue-white eyeball fails here regardless of tolerance.
  //   BAND    — the ratio inside ±6.1% of 1.2839. That percentage is not chosen: it is the same
  //             RELATIVE tolerance the luma half already carries (0.06 on 0.98), applied to the
  //             other half of the same sentence rather than invented for it.
  //
  // Judged on HSV saturation rather than chroma (max−min) because that is the statistic the spec
  // published both numbers in. Note that G7 deliberately uses chroma instead, for the opposite
  // reason — see its block for the measured sweep where saturation is non-monotone.
  scleraHexReference: '#9D7274',
  cheekHexReference: '#96767D',
  scleraCheekSaturationTolerance: 0.06 / 0.98,

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

  // §2 hair / §2 eyes. Three published measurements bound this gate and none of them is a
  // preference:
  //
  //   - hair base albedo is "essentially black — luma 0.067 (#150F17)", and its apparent colour
  //     is supposed to come from an ANISOTROPIC lobe along the fibre, not from the card's plane;
  //   - the lid crease / socket — the band this gate samples — measures #352327, luma 0.152,
  //     **0.31× cheek**, and the spec says that occlusion is "heavier than physically-derived AO
  //     would give";
  //   - the rim, the one thing in a portrait rig entitled to be strongly chromatic, is capped at
  //     "≈1.0–1.5× key-lit skin luma ... the rim wins on saturation, not brightness".
  //
  // So a DARK pixel in the socket band carrying strong chroma is, by construction, not the rim
  // band and not the albedo: it is a light landing on a surface with nothing to dilute it.
  //
  // The three qualifiers are all needed, and each was checked against the alternative:
  //
  //   value  — restricts the count to the cards themselves, so the statistic is about the near-
  //            black surfaces rather than about rim spill on skin. Derived from the reference,
  //            not chosen: the spec's socket sample #352327 has HSV value 0.208 against its own
  //            cheek reference #96767D at 0.588, i.e. **0.354× cheek**. On `alive.html` the cheek
  //            measures value 0.851, so the reference band puts the cards at ~0.301 here. 0.35 is
  //            that with ~16% headroom. Measured separation between the pre-fix plate and a plate
  //            with the card meshes removed, as the ceiling moves:
  //
  //              ceiling  0.25   0.30   0.35   0.45   0.60   none
  //              defect   0.415% 0.617% 0.858% 1.239% 1.464% 1.879%
  //              floor    0.000% 0.011% 0.022% 0.112% 0.236% 0.645%
  //              ratio       ∞    55×    38×    11×     6×     2.9×
  //
  //            i.e. dropping the qualifier entirely costs an order of magnitude of separation,
  //            because bright skin beside the socket does legitimately carry cool chroma.
  //
  //   chroma — max−min, NOT HSV saturation. Saturation is chroma/value, so a DIMMER blue can
  //            score HIGHER: measured across a card specular-intensity sweep on the real page
  //            (ACES tone-mapped, which desaturates the bright end), the saturation form went
  //            1.0 → 2.866%, 0.5 → 3.197%, 0.35 → 3.208%, 0.0 → 0.101% — it PEAKS in the middle
  //            of a monotonically improving sequence, so a threshold on it would have called the
  //            half-fixed render worse than the broken one. The chroma form on the same four
  //            plates is monotone: 1.879 / 1.279 / 0.925 / 0.589%.
  //
  //   hue    — the cool arc. Warm chroma in this band is eyeshadow and lid vasculature, which the
  //            spec bakes into albedo on purpose; cool chroma there is not in the asset at all.
  cardBandMaxValue: 0.35,
  cardBandMinChroma: 0.15,
  cardBandCoolHueArc: [180, 300],
  cardBandOutlierFractionMax: 0.001,
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
  const provenance = resolveProvenance(options, image);

  const report = measureAll(image, regions, spec, options, provenance);

  const serialised = JSON.stringify(report, null, 2);
  if (options.outPath) fs.writeFileSync(options.outPath, serialised);
  process.stdout.write(options.human ? formatHumanReport(report) : `${serialised}\n`);

  return report.summary.failed > 0 ? 1 : 0;
}

// --- measurement ----------------------------------------------------------------------------

function measureAll(image, regions, spec, options, provenance) {
  // One pass builds the encoded-luma field that three of the six gates read from. Everything
  // downstream reads this instead of touching raw pixels again.
  const lumaField = buildEncodedLumaField(image);
  const warnings = collectCaptureWarnings(image, spec, provenance);

  const gates = [
    measureKeyShadowRatio(image, regions),
    measureScleraAgainstCheek(image, regions),
    measureTerminatorShift(image, regions, warnings),
    measureHighPassSigma(image, lumaField, regions, warnings, provenance),
    measureHighlightClipping(image, lumaField, regions),
    measureBlackPoint(image, lumaField, regions),
    measureCardBandChroma(image, regions),
  ];

  // 🚩 STAMPED ON EVERY GATE, NOT ONLY ON THE REPORT. Gate blocks get copied out of a report one
  // at a time — into a punch list, into a commit message, into another agent's brief — and a
  // number that travels without its page is the exact defect this field exists to stop.
  for (const gate of gates) {
    if (gate.measured) gate.measured.measuredOn = provenance.summary;
  }

  const summary = {
    passed: gates.filter((gate) => gate.status === 'PASS').length,
    failed: gates.filter((gate) => gate.status === 'FAIL').length,
    skipped: gates.filter((gate) => gate.status === 'SKIP').length,
  };
  summary.verdict = summary.failed > 0 ? 'FAIL' : 'PASS';

  return {
    image: {
      path: path.resolve(options.imagePath),
      width: image.width,
      height: image.height,
      bitDepth: image.bitDepth,
      colorType: image.colorType,
    },
    regionsPath: path.resolve(options.regionsPath),
    provenance,
    warnings,
    gates,
    summary,
  };
}

// --- provenance ------------------------------------------------------------------------------
//
// What page, at what size, in what motion state. See the file header for the round this cost.

/** How far up from the image to look for the capture manifest. frames/ is one level; <out>/ is two. */
const PROVENANCE_SEARCH_DEPTH = 3;

function resolveProvenance(options, image) {
  if (options.page) {
    return describeProvenance({
      source: '--page',
      page: options.page,
      pixelWidth: image.width,
      pixelHeight: image.height,
    });
  }

  const manifestPath = options.provenancePath ?? findCaptureManifest(options.imagePath);
  if (manifestPath === null) {
    return {
      source: 'none',
      summary: 'UNKNOWN PAGE — no capture.json found and no --page given',
      known: false,
    };
  }

  let manifest;
  try {
    manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  } catch (error) {
    return {
      source: 'none',
      summary: `UNKNOWN PAGE — ${path.basename(manifestPath)} unreadable (${error.message})`,
      known: false,
    };
  }

  return describeProvenance({
    source: path.resolve(manifestPath),
    page: manifest.url ?? null,
    seed: manifest.seed ?? null,
    prerollSeconds: manifest.prerollSeconds ?? null,
    pixelWidth: manifest.resolution?.pixelWidth ?? image.width,
    pixelHeight: manifest.resolution?.pixelHeight ?? image.height,
    devicePixelRatio: manifest.resolution?.devicePixelRatio ?? null,
    backend: manifest.environment?.backend ?? null,
    capturedAt: manifest.capturedAt ?? null,
  });
}

/**
 * A page URL carries the framing in its query string (`?frame=body`, `?height=0.18`) and the
 * motion state in `?freeze` / `?preroll` / `?seed`, so the shortest honest summary is the path,
 * the query, the pixel size and the seed. The host is dropped: it is a port number, not a fact
 * about the render, and two captures on 5173 and 5188 are the same plate.
 */
function describeProvenance(fields) {
  const parts = [];

  if (fields.page) {
    try {
      const url = new URL(fields.page);
      parts.push(`${url.pathname}${url.search}`);
    } catch {
      parts.push(fields.page);
    }
  } else {
    parts.push('(page not recorded)');
  }

  parts.push(`${fields.pixelWidth}×${fields.pixelHeight}`);
  if (fields.devicePixelRatio && fields.devicePixelRatio !== 1) parts.push(`dpr ${fields.devicePixelRatio}`);
  if (fields.seed !== null && fields.seed !== undefined) parts.push(`seed ${fields.seed}`);
  if (fields.prerollSeconds) parts.push(`preroll ${fields.prerollSeconds} s`);
  if (fields.backend) parts.push(fields.backend);

  return { ...fields, known: true, summary: parts.join('  ') };
}

function findCaptureManifest(imagePath) {
  let directory = path.dirname(path.resolve(imagePath));

  for (let level = 0; level < PROVENANCE_SEARCH_DEPTH; level += 1) {
    const candidate = path.join(directory, 'capture.json');
    if (fs.existsSync(candidate)) return candidate;

    const parent = path.dirname(directory);
    if (parent === directory) break;
    directory = parent;
  }

  return null;
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
// luminance as the cheek beside it, from heavy lid AO plus sclera SSS, AND is more saturated than
// the skin beside it. Both halves are gated; see TARGETS for why the second one exists.
function measureScleraAgainstCheek(image, regions) {
  const sclera = regions.sclera;
  const cheek = regions.cheek;
  if (!sclera || !cheek) {
    return skipGate('G2', 'sclera : cheek luma and chroma', 'needs regions "sclera" and "cheek"');
  }

  const white = summariseRegion(image, sclera);
  const skin = summariseRegion(image, cheek);

  const ratio = white.encodedLuma / skin.encodedLuma;
  const low = TARGETS.scleraCheekRatio - TARGETS.scleraCheekTolerance;
  const high = TARGETS.scleraCheekRatio + TARGETS.scleraCheekTolerance;

  const reference = referenceScleraSaturationRatio();
  const saturationRatio = skin.saturation === 0 ? Infinity : white.saturation / skin.saturation;
  const saturationLow = reference.ratio * (1 - TARGETS.scleraCheekSaturationTolerance);
  const saturationHigh = reference.ratio * (1 + TARGETS.scleraCheekSaturationTolerance);

  const failures = [];
  if (ratio < low || ratio > high) {
    failures.push(
      `luma half: ${round(ratio, 4)} outside ${round(low, 2)}–${round(high, 2)} ` +
        `(sclera ${round(white.encodedLuma, 4)} vs cheek ${round(skin.encodedLuma, 4)})`
    );
  }
  if (white.saturation < skin.saturation) {
    failures.push(
      `chroma half, ORDINAL: the sclera is LESS saturated than the cheek ` +
        `(${round(white.saturation, 4)} vs ${round(skin.saturation, 4)}) — the spec says it is more`
    );
  }
  if (saturationRatio < saturationLow || saturationRatio > saturationHigh) {
    failures.push(
      `chroma half, BAND: ${round(saturationRatio, 4)}× outside ` +
        `${round(saturationLow, 3)}–${round(saturationHigh, 3)}× (reference ${round(reference.ratio, 4)}×)`
    );
  }

  return {
    id: 'G2',
    name: 'sclera : cheek luma and chroma',
    status: failures.length === 0 ? 'PASS' : 'FAIL',
    lumaDomain: 'encoded',
    target:
      `luma ${TARGETS.scleraCheekRatio} ± ${TARGETS.scleraCheekTolerance} (${round(low, 2)}–${round(high, 2)})` +
      ` AND saturation ${round(reference.ratio, 3)}× ± ${round(TARGETS.scleraCheekSaturationTolerance * 100, 1)}%` +
      ` (${round(saturationLow, 3)}–${round(saturationHigh, 3)}×), sclera never below cheek`,
    measured: {
      ratioEncoded: round(ratio, 4),
      saturationRatio: round(saturationRatio, 4),
      ratioLinear: round(white.linearLuma / skin.linearLuma, 4),
      scleraLumaEncoded: round(white.encodedLuma, 4),
      cheekLumaEncoded: round(skin.encodedLuma, 4),
      scleraSaturation: round(white.saturation, 4),
      cheekSaturation: round(skin.saturation, 4),
      referenceSaturationRatio: round(reference.ratio, 4),
      referenceScleraSaturation: round(reference.scleraSaturation, 4),
      referenceCheekSaturation: round(reference.cheekSaturation, 4),
      scleraHex: white.hex,
      cheekHex: skin.hex,
    },
    failures,
    note:
      'Two halves of one spec sentence. Luma is judged encoded — a perceptual "reads as the same brightness" match, and 0.98 is the encoded figure the spec measured. ' +
      `Saturation is judged against ${round(reference.ratio, 4)}×, recomputed here from the spec's own published hexes ` +
      `(sclera ${TARGETS.scleraHexReference} at S ${round(reference.scleraSaturation, 5)}, cheek ${TARGETS.cheekHexReference} at S ${round(reference.cheekSaturation, 5)}), ` +
      'not copied from its prose. A grey eyeball that happens to match the cheek\'s brightness passes the luma half alone.',
  };
}

// The reference chroma ratio, derived at run time from the two hexes the spec publishes, so the
// number in the report is a measurement of the reference rather than a transcription of it.
function referenceScleraSaturationRatio() {
  const scleraSaturation = rgbToHsv(...hexToUnitRgb(TARGETS.scleraHexReference)).saturation;
  const cheekSaturation = rgbToHsv(...hexToUnitRgb(TARGETS.cheekHexReference)).saturation;
  return { scleraSaturation, cheekSaturation, ratio: scleraSaturation / cheekSaturation };
}

function hexToUnitRgb(hex) {
  const value = parseInt(hex.replace('#', ''), 16);
  return [((value >> 16) & 255) / 255, ((value >> 8) & 255) / 255, (value & 255) / 255];
}

// G3 — the objective subsurface-scattering test. Physically wrong skin shading darkens toward
// grey or blue; a pre-integrated skin profile pushes the terminator redder and more saturated.
function measureTerminatorShift(image, regions, warnings) {
  const litRegion = regions.litSkin;
  const shadowRegion = regions.shadowTerminator;

  // G3 does not isolate a material. Measured during punch-list 3.2: under a rig that satisfies G1,
  // three's stock MeshPhysicalNodeMaterial scores 0.2384 on the same regions and PASSES, while the
  // skin shader's own off/on difference at the spec's 1.0–1.5 mm scatter distance changes 0.00% of
  // skin pixels by more than one code value. Read a green G3 as a statement about the LIGHTING and
  // the albedo; attribute a shading change with an off/on difference image instead.
  if (warnings) {
    warnings.push(
      'G3 is a property of the whole picture, not of one material. It passes identically on three\'s stock MeshPhysicalNodeMaterial under any rig that satisfies G1, so it cannot certify a skin shader on its own — attribute a material with an off/on difference at the same regions.'
    );
  }

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
function measureHighPassSigma(image, lumaField, regions, warnings, provenance) {
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

  // The sigma is a high-pass of a SHADED surface, so it reads the lighting's response to the
  // normal perturbation and not the perturbation itself. Measured during 3.2: one unchanged
  // micro-normal moved from 1.72 to 2.06 as the fill fell from 0.7 to 0.3.
  //
  // 🚩 AND IT DOES NOT SURVIVE A CHANGE OF PAGE, which is the defect this warning was rewritten
  // for. 1.9495/255 was measured on `skin.html` and quoted as certifying `alive.html`; that page
  // measures 1.4764 at the same width, on a different rig, with a differently framed cheek patch.
  // So the warning names the page the number came from rather than describing the hazard in the
  // abstract, and it is unconditional: there is no framing at which a G4 sigma is page-portable.
  warnings.push(
    'G4 is not independent of the rig OR of the page: it high-passes a SHADED surface, so it measures the lighting\'s ' +
      'response to the normal perturbation. One unchanged micro-normal measured sigma 1.72 at fill 0.7 and 2.06 at ' +
      `fill 0.3, and the same material measured 1.9495 on skin.html against 1.4764 on alive.html. This sigma is about ` +
      `${provenance.known ? provenance.summary : 'an UNRECORDED page'} and nothing else — never quote it for another page.`
  );

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
    note:
      'Below the band means blacks are crushed; above it means shadow lift, which the reference grade does not have. Measured to 1/65536 via histogram. ' +
      '⚠️ Whole-image scope makes this a measurement of whatever the darkest 0.1% of the frame happens to BE, not of the grade. On alive.html it read 0.0250 while the backdrop was the darkest thing present, and 0.00001 once the eyelash and eyebrow cards stopped being lit by the rim — same grade, both readings red, neither about the grade. Give it a "frame" region, or read it as belonging to punch-list 3.13.',
  };
}

// G7 — a near-black surface must not render as the most saturated thing in the frame.
//
// The failure this catches is specific and was worth a whole review round: the eyelash and eyebrow
// cards on `alive.html` rendered as vivid royal-blue spikes while G1, G2, G4 and G5 all read
// green. It is a per-pixel OUTLIER COUNT rather than a patch mean, because the band it samples
// deliberately contains both the near-black cards and the bright skin around them, and no mean
// over that mixture can resolve either.
//
// Reference numbers, all measured on `alive.html?freeze&bare` at 900×1200 (LEARNINGS §1.17 — the
// rest pose, no pre-roll, which is the state the region file was authored against):
//
//   | plate                                          | outlier fraction |
//   |------------------------------------------------|-----------------:|
//   | cards on the shipped GLB material (`?cards=0`)  |           0.847% |
//   | card meshes removed from the scene entirely      |           0.011% |
//   | rim and kicker at zero irradiance                |           0.000% |
//   | edge lights swung to the FRONT (worst case)      |           3.454% |
//   | the shipped card treatment                       |           0.022% |
//
// The 0.10% threshold sits an order of magnitude below the defect and 2× above the floor, and it
// is deliberately tight enough to reject a PARTIAL fix: alpha-to-coverage alone, with the specular
// lobe still on the cards, measures 0.123% and still reads red — correctly, because the lash tips
// are still visibly blue on that plate.
function measureCardBandChroma(image, regions) {
  const band = regions.cardBand;
  if (!band) {
    return skipGate('G7', 'card band chroma outliers', 'needs region "cardBand"');
  }

  const { pixels } = image;
  const [hueLow, hueHigh] = TARGETS.cardBandCoolHueArc;

  let outliers = 0;
  let darkPixels = 0;
  let worstChroma = 0;
  let worstHex = null;
  let worstValue = 0;

  for (const index of band.pixelIndices) {
    const r = pixels[index];
    const g = pixels[index + 1];
    const b = pixels[index + 2];

    const { hue, value } = rgbToHsv(r, g, b);
    const isCool = hue >= hueLow && hue < hueHigh;
    const chroma = Math.max(r, g, b) - Math.min(r, g, b);

    // The worst offender is reported over EVERY cool pixel in the band, not only the counted
    // ones. The count is restricted to dark pixels because that is what makes the statistic about
    // the cards rather than about rim spill on skin — but the single most obviously wrong pixel on
    // the pre-fix plate was #1A45A7 at value 0.655, above the ceiling, and a report that named a
    // lesser pixel as "worst" would send the next reader to the wrong place.
    if (isCool && chroma > worstChroma) {
      worstChroma = chroma;
      worstHex = toHex({ r, g, b });
      worstValue = value;
    }

    if (value > TARGETS.cardBandMaxValue) continue;
    darkPixels += 1;

    if (isCool && chroma >= TARGETS.cardBandMinChroma) outliers += 1;
  }

  const fraction = outliers / band.pixelIndices.length;

  return {
    id: 'G7',
    name: 'card band chroma outliers',
    status: fraction < TARGETS.cardBandOutlierFractionMax ? 'PASS' : 'FAIL',
    lumaDomain: 'encoded',
    target:
      `< ${(TARGETS.cardBandOutlierFractionMax * 100).toFixed(2)}% of the band: ` +
      `value ≤ ${TARGETS.cardBandMaxValue}, chroma ≥ ${TARGETS.cardBandMinChroma}, hue ${hueLow}–${hueHigh}°`,
    measured: {
      outlierFraction: round(fraction, 6),
      outlierPercent: round(fraction * 100, 4),
      outlierPixels: outliers,
      darkPixels,
      totalPixels: band.pixelIndices.length,
      worstCoolChroma: round(worstChroma, 4),
      worstCoolHex: worstHex,
      worstCoolValue: round(worstValue, 4),
    },
    note:
      'Chroma is max−min, not HSV saturation: saturation is chroma/value, so dimming a blue pixel RAISES it and the statistic stops being monotone in the defect. Reference: lid crease / socket measures 0.31× cheek luma and hair albedo is luma 0.067, so nothing in this band is entitled to carry chroma of its own. ' +
      '⚠️ This gate covers the CHROMA half of the card defect only. The other half — binary alpha-test edges on the same cards — is NOT gated here and NOT gated anywhere: the obvious statistic, the fraction of the band at an intermediate luma, does not separate (21.06% with the hard cut against 20.07% anti-aliased, because the band is dominated by iris and lid shading rather than by card edges). A real edge gate would have to localise on the card boundary first.',
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
function collectCaptureWarnings(image, spec, provenance) {
  const warnings = [];

  // Loud, and first, because a number without a page is the one failure mode that has already
  // cost this project a whole round (see the file header).
  if (provenance.known !== true) {
    warnings.push(
      'NO PROVENANCE. This report does not know what page, framing or motion state produced the plate, so none ' +
        'of its numbers may be quoted as certifying anything. Capture with tools/critic/capture.mjs — it writes ' +
        'capture.json beside the frames and this tool finds it — or pass --page "<url> @ WxH".'
    );
  }

  // 🚩 MEASURED, NOT SUSPECTED. The sclera rect is 11×6 px on an eye ~40 px across at the portrait
  // framing, and `?freeze` pins the POSE but not the ocular or postural layers: their state at the
  // first drawn frame is drawn from the seed. Measured on `alive.html?bare&freeze` at 900×1200,
  // one frame, four seeds, nothing else changed:
  //
  //     seed 1        G2 luma 0.8127   sclera 0.6107
  //     seed 42       G2 luma 0.9627   sclera 0.7278
  //     seed 4242     G2 luma 0.9736   sclera 0.7350
  //     seed 20260807 G2 luma 0.4384   sclera 0.3277   (the rect has walked onto the iris)
  //
  // A 2.2× spread across the gate's own ±6% band, decided entirely by the seed. Two of those four
  // draws pass. Any single-seed G2 on an animating page is a draw of the dice, and the 0.9641 that
  // punch-list 3.3 was marked done on is one of them.
  if (spec.regions?.sclera) {
    warnings.push(
      'G2 samples an 11×6 px rect on an eye ~40 px across. On an animating page ?freeze pins the POSE but not the ' +
        'ocular or postural layers, whose state at the first frame comes from the seed: measured on alive.html?bare&freeze ' +
        'at 900×1200, G2 luma reads 0.8127 / 0.9627 / 0.9736 / 0.4384 at seeds 1 / 42 / 4242 / 20260807 — a 2.2× spread, ' +
        'two of four passing. Quote G2 as a distribution over a seed set, never as one number.'
    );
  }

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

  // G7's rects are drawn on four small features of a face at ONE framing, so they only mean
  // anything on a plate that framing was authored for and in a motion state that has not moved
  // them. LEARNINGS §1.17 is the same trap on G1: at ?preroll=6 the head yaws 35.8° and the
  // committed rects sample different anatomy — for G7 that would mean sampling cheek instead of
  // lash line, and a band with no cards in it scores a perfect zero.
  if (spec.regions?.cardBand) {
    warnings.push(
      'G7 samples four hand-drawn rects on the lash lines and brows. Pin the motion state — ?freeze with NO pre-roll — or the rects land on skin and a band containing no cards passes trivially.'
    );
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
  lines.push(`measured on: ${report.provenance.summary}`);
  lines.push(`regions:     ${report.regionsPath}`);
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
  const options = {
    imagePath: null,
    regionsPath: null,
    human: false,
    outPath: null,
    page: null,
    provenancePath: null,
    help: false,
  };
  const positional = [];

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--human') options.human = true;
    else if (arg === '--help' || arg === '-h') options.help = true;
    else if (arg === '--out') {
      i += 1;
      options.outPath = argv[i];
    } else if (arg === '--page') {
      i += 1;
      options.page = argv[i];
    } else if (arg === '--provenance') {
      i += 1;
      options.provenancePath = argv[i];
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
    'measure.mjs — seven objective gates from the Stellar Blade look spec.',
    '',
    'Usage:',
    '  node measure.mjs <image.png> <regions.json> [--human] [--out result.json]',
    '',
    'Options:',
    '  --human               human-readable summary instead of JSON on stdout',
    '  --out <path>          also write the full JSON report to a file',
    '  --page <text>         what page/framing this plate is, when there is no capture.json',
    '  --provenance <path>   an explicit capture.json instead of the one found beside the image',
    '',
    'Provenance is found automatically: capture.mjs writes capture.json beside the frames and this',
    'tool walks up from the image to find it. Without it every gate is stamped UNKNOWN PAGE and a',
    'warning says the numbers may not be quoted — a G4 sigma measured on skin.html once certified',
    'alive.html, which reads 1.4764 against 1.9495 at the same width.',
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
