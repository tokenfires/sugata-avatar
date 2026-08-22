// hair-reference.mjs — put the reference groom and OUR groom on the same mask and the same domain.
//
// WHY THIS TOOL EXISTS. `docs/research/hair.md` §2.1 measured the reference's FRINGE RECT and §9.2
// measured our own WHOLE-GROOM MASK, and the round placed the two side by side to claim "our
// shipped hair's median is 3.43x the reference's". Two things make that claim unquotable and this
// tool exists to close both:
//
//   1. DIFFERENT POPULATIONS. A fringe is a shadowed region; a groom includes the lit crown. The
//      fix is to measure the reference on several masks — the two published rects as a control on
//      the method, plus a whole-hair mask — and our plate on the analogous ones.
//   2. DIFFERENT DOMAINS. hair.md §9.4's green rows are RADIANCE; §2.1 and §9.2 are ENCODED luma,
//      and this pipeline is not a power law between them (`render/Stage.js` sets
//      ACESFilmicToneMapping on the renderer and the no-grade branch still ends in renderOutput).
//      Every table below therefore prints BOTH, with the transfer stated per column.
//
// ⚠️ THE ONE THING THIS TOOL CANNOT DO. The reference is a JPEG of a SHIPPED GAME FRAME. It has
// already been through SHIFT UP's tone curve, grade and JPEG quantisation, none of which we have.
// Running OUR ACES inverse over it does NOT recover their scene radiance; it recovers "what our
// renderer would have had to emit to land on those codes". That is a defensible quantity — it is
// exactly the target a shader author aims at — and it is NOT the same quantity as §9.4's rows,
// which are our own pre-tonemap radiance. Both are printed and the difference is stated, in the
// report, rather than being quietly assumed away.
//
// ⚠️ THE REFERENCE PLATES ARE COPYRIGHTED by SHIFT UP / Sony Interactive Entertainment. Internal
// comparison reference only. This tool takes their PATHS as arguments and writes nothing into the
// repository; fetch them to a scratch directory and point at it.
//
// USAGE
//   node tools/critic/hair-reference.mjs --reference <dir> [--ours <captures/hair-r27-pedestal>]
//                                        [--overlay <dir>]
//
// `--reference <dir>` must contain `overview_character.reference.png` (3200x1841), converted from
// the official-site JPEG with `sips -s format png` — an sRGB->sRGB identity given the embedded
// `sRGB IEC61966-2.1` profile, which is the same conversion hair.md's Appendix records.

import fs from 'node:fs';
import path from 'node:path';

import { decodePng, encodePng } from './png.mjs';
import { encodedLuma, srgbToLinear } from './color.mjs';
import {
  buildGroomMask,
  codesAt,
  isInvertible,
  inverseAces,
  luminance,
  plateToSceneLinear,
  readPlate,
} from './lightpath-probe.mjs';
import { erodeMask } from './hair-lightpath.mjs';

// --- the masks, all in full-resolution pixel coordinates of the named file -------------------

/** §2.1's fringe rect, verbatim. Reproducing its published percentiles is the control. */
const FRINGE_RECT = { name: 'fringe rect §2.1', x0: 1480, y0: 540, x1: 1700, y1: 610 };

/**
 * ⚠️ §2.1's FRINGE RECT IS NOT ALL HAIR, and this changes what its numbers mean. Measured here:
 * of the 771 pixels in its top 5%, 616 lie in x ∈ [1520,1560], 141 in x ∈ [1660,1680] and 14 in
 * x ∈ [1640,1660], and 769 of the 771 lie below y = 570 — two patches of lit FOREHEAD SKIN showing
 * through the fringe tips, visible in a 4x crop. §2.1's own p99 hex `#96757e` is that skin. So the rect's p95 (and
 * therefore its p95/p50 of 4.936) is a skin-to-hair ratio wearing a hair-contrast label.
 *
 * `fringe rect, hair only` is the same rect's TOP 30 ROWS, which contain 2 of those 771 pixels.
 * It is the honest fringe population and its dynamic range is the one to quote.
 */
const FRINGE_HAIR_RECT = { name: 'fringe rect, hair only', x0: 1480, y0: 540, x1: 1700, y1: 570 };

/** §2.2's crown band and the fainter band above it, verbatim. Also controls. */
const CROWN_RECT = { name: 'crown band §2.2', x0: 1400, y0: 380, x1: 1660, y1: 440 };
const SECOND_RECT = { name: 'second band §2.2', x0: 1400, y0: 290, x1: 1660, y1: 350 };

/**
 * THE WHOLE-HAIR MASK, and it is a hand-drawn polygon rather than a colour classifier ON PURPOSE.
 *
 * A colour rule was tried first and it fails on this frame, which is worth recording because the
 * failure is the §0.3 finding showing up as an engineering obstacle: the reference's LIT crown is
 * BLUE-DOMINANT (a pixel at (1530,410) reads R 78, G 82, B 111 — the R lobe wearing the teal
 * practicals' colour), while its SHADOWED fringe is red-dominant (§2.1a's four reads, all R > B).
 * So no single chroma threshold separates this groom from a blue-lit background: the brightest
 * hair in the frame is the same hue as the background it sits against.
 *
 * The polygon traces the contiguous hair CAP — crown, sheen bands, and fringe down to the tips.
 * Vertices were read off a 0.714x view of the crop (1000,150)-(2400,1250) and are eroded by 3 px
 * before use so the silhouette's antialiased edge, which is a mix of hair and background, is
 * excluded rather than counted as dark hair.
 *
 * WHAT IT INCLUDES: the lit crown, both sheen bands, the shadowed fringe, and the fringe tips.
 * WHAT IT EXCLUDES: the two side falls and the ponytail hanging over the background; the wisps
 * over the cheeks; the blue hair ornament at the left temple; the silhouette transition band.
 * It is therefore the groom's INTERIOR, which is the population our own solid-hair mask is too.
 */
const WHOLE_HAIR_POLYGON = [
  [1658, 223], [1756, 237], [1819, 297], [1854, 381], [1871, 472], [1868, 549],
  [1840, 591], [1777, 626], [1700, 640], [1630, 633], [1560, 626], [1497, 612],
  [1420, 598], [1375, 570], [1357, 500], [1361, 416], [1399, 332], [1462, 269],
  [1560, 231],
];

/** Erosion applied to the polygon, in pixels, and the conservative core it is checked against. */
const EROSION = 3;
const EROSION_CONSERVATIVE = 25;

/** Our own frame's crown rect, verbatim from `hair-lightpath.mjs`'s `RECTS['H3 crown mass']`. */
const OUR_CROWN_RECT = { name: 'our crown H3', x0: 250, y0: 80, x1: 290, y1: 120 };

/** `hair-pedestal.mjs`'s own constants — our captures render at this exposure and this cut. */
const OUR_EXPOSURE = 4;
const HAIR_SHADED_MAX = 1.5e-2;

// --- statistics ------------------------------------------------------------------------------

/** Percentiles by nearest-rank on a sorted copy. No interpolation, so a value is always a pixel. */
function stats(values) {
  const sorted = Float64Array.from(values).sort();
  const at = (q) => sorted[Math.min(sorted.length - 1, Math.max(0, Math.round(q * (sorted.length - 1))))];
  let sum = 0;
  for (const v of sorted) sum += v;
  const p50 = at(0.50);
  const p95 = at(0.95);
  return {
    n: sorted.length,
    p05: at(0.05), p25: at(0.25), p50, p75: at(0.75), p95, p99: at(0.99),
    mean: sum / sorted.length,
    range: p95 / Math.max(p50, 1e-12),
  };
}

// --- mask construction -------------------------------------------------------------------------

function rectMask(width, height, rect) {
  const mask = new Uint8Array(width * height);
  for (let y = rect.y0; y < rect.y1; y += 1) {
    for (let x = rect.x0; x < rect.x1; x += 1) mask[y * width + x] = 1;
  }
  return mask;
}

/** Even-odd crossing test, the boring one. */
function polygonMask(width, height, polygon) {
  const mask = new Uint8Array(width * height);
  const xs = polygon.map((p) => p[0]);
  const ys = polygon.map((p) => p[1]);
  const minY = Math.max(0, Math.floor(Math.min(...ys)));
  const maxY = Math.min(height - 1, Math.ceil(Math.max(...ys)));
  const minX = Math.max(0, Math.floor(Math.min(...xs)));
  const maxX = Math.min(width - 1, Math.ceil(Math.max(...xs)));

  for (let y = minY; y <= maxY; y += 1) {
    for (let x = minX; x <= maxX; x += 1) {
      let inside = false;
      for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
        const [xi, yi] = polygon[i];
        const [xj, yj] = polygon[j];
        if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
      }
      if (inside) mask[y * width + x] = 1;
    }
  }
  return mask;
}

function maskIndices(mask) {
  const indices = [];
  for (let k = 0; k < mask.length; k += 1) if (mask[k] === 1) indices.push(k);
  return indices;
}

// --- the two domains ---------------------------------------------------------------------------

/**
 * ENCODED luma: Rec.709 on the sRGB-encoded triple straight out of the file. This is the domain
 * §2.1, §2.2 and §9.2 are in, and `color.mjs`'s header records why the look spec lives here.
 */
function encodedAt(png, k) {
  const i = k * 4;
  return encodedLuma(png.pixels[i], png.pixels[i + 1], png.pixels[i + 2]);
}

/**
 * DISPLAY-LINEAR luma: the sRGB EOTF undone, nothing else. On the reference this is the honest
 * end of the chain — it is what a display emits — and it is NOT radiance, because SHIFT UP's tone
 * curve is still baked in and we do not have it.
 */
function displayLinearAt(png, k) {
  const i = k * 4;
  return 0.2126 * srgbToLinear(png.pixels[i]) + 0.7152 * srgbToLinear(png.pixels[i + 1])
    + 0.0722 * srgbToLinear(png.pixels[i + 2]);
}

/**
 * "AS-IF-OURS" RADIANCE: our own ACES inverted out of the reference's display-linear value.
 *
 * ⚠️ READ THE HEADER. This does not recover SHIFT UP's radiance. It answers a different and still
 * useful question — "what would OUR renderer have to put into ITS tone curve to land on this
 * pixel?" — which is the only footing on which §9.4's radiance rows and the reference can be set
 * beside each other at all. The assumption is that the two tone curves agree, it is false in
 * detail, and `HairMaterial.selftest.mjs` already flags this exact step as the one place in the
 * project that needs it.
 *
 * `exposure` must match the plate: our captures render at `toneMappingExposure` 4, the reference
 * has no such knob and is read at 1.
 */
function radianceAt(png, k, exposure) {
  const i = k * 4;
  const display = [
    srgbToLinear(png.pixels[i]), srgbToLinear(png.pixels[i + 1]), srgbToLinear(png.pixels[i + 2]),
  ];
  return luminance(inverseAces(display, exposure));
}

/** A pixel is dropped from the radiance column when either ACES clamp has eaten its information. */
function invertibleAt(png, k) {
  return isInvertible(codesAt(png, k * 4));
}

// --- reporting ---------------------------------------------------------------------------------

function printTable(title, rows) {
  console.log(`\n${title}`);
  console.log('  mask                          n       p05      p25      p50      p75      p95      p99     mean   p95/p50');
  for (const row of rows) console.log(`  ${row}`);
}

function formatRow(name, s, exponential = false) {
  const f = (v) => (exponential ? v.toExponential(2).padStart(8) : v.toFixed(4).padStart(8));
  return `${name.padEnd(24)} ${String(s.n).padStart(7)} ${f(s.p05)} ${f(s.p25)} ${f(s.p50)} ` +
    `${f(s.p75)} ${f(s.p95)} ${f(s.p99)} ${f(s.mean)} ${s.range.toFixed(3).padStart(8)}`;
}

function measure(png, mask, exposure) {
  const indices = maskIndices(mask);
  const encoded = indices.map((k) => encodedAt(png, k));
  const displayLinear = indices.map((k) => displayLinearAt(png, k));
  const invertible = indices.filter((k) => invertibleAt(png, k));
  const radiance = invertible.map((k) => radianceAt(png, k, exposure));
  return {
    encoded: stats(encoded),
    displayLinear: stats(displayLinear),
    radiance: stats(radiance),
    clamped: indices.length - invertible.length,
  };
}

/** Writes the mask as a red overlay so the polygon can be CHECKED rather than trusted. */
function writeOverlay(png, mask, file) {
  const out = new Uint8Array(png.width * png.height * 4);
  for (let k = 0; k < png.width * png.height; k += 1) {
    const i = k * 4;
    const lit = mask[k] === 1;
    out[i] = Math.min(255, Math.round(png.pixels[i] * 255 * (lit ? 0.4 : 1) + (lit ? 150 : 0)));
    out[i + 1] = Math.round(png.pixels[i + 1] * 255 * (lit ? 0.4 : 1));
    out[i + 2] = Math.round(png.pixels[i + 2] * 255 * (lit ? 0.4 : 1));
    out[i + 3] = 255;
  }
  fs.writeFileSync(file, encodePng(png.width, png.height, out));
}

// --- entry point ---------------------------------------------------------------------------------

function parseArguments(argv) {
  const options = {};
  for (let i = 0; i < argv.length; i += 2) options[argv[i].replace(/^--/, '')] = argv[i + 1];
  return options;
}

function main() {
  const options = parseArguments(process.argv.slice(2));
  if (!options.reference) {
    console.error('usage: node tools/critic/hair-reference.mjs --reference <dir> [--ours <dir>] [--overlay <dir>]');
    process.exit(2);
  }

  // ---- the reference -------------------------------------------------------------------------
  const referenceFile = path.join(options.reference, 'overview_character.reference.png');
  const reference = decodePng(fs.readFileSync(referenceFile));
  console.log(`\nREFERENCE  ${referenceFile}  ${reference.width}x${reference.height}`);

  const rects = [FRINGE_RECT, FRINGE_HAIR_RECT, CROWN_RECT, SECOND_RECT];
  const referenceMasks = rects.map((r) => [r.name, rectMask(reference.width, reference.height, r)]);
  // Two erosions of the same polygon. If the boundary were carrying the result, these two rows
  // would disagree; printing both is cheaper than arguing about where the silhouette starts.
  const rawPolygon = polygonMask(reference.width, reference.height, WHOLE_HAIR_POLYGON);
  referenceMasks.push([
    `whole-hair (-${EROSION}px)`,
    erodeMask(rawPolygon, reference.width, reference.height, EROSION),
  ]);
  referenceMasks.push([
    `whole-hair (-${EROSION_CONSERVATIVE}px)`,
    erodeMask(rawPolygon, reference.width, reference.height, EROSION_CONSERVATIVE),
  ]);

  const referenceResults = referenceMasks.map(([name, mask]) => [name, measure(reference, mask, 1)]);

  printTable('REFERENCE — ENCODED luma (Rec.709 on sRGB codes; the domain §2.1/§2.2/§9.2 are in)',
    referenceResults.map(([name, r]) => formatRow(name, r.encoded)));
  printTable('REFERENCE — DISPLAY-LINEAR luma (sRGB EOTF undone; NOT radiance, their curve is still in it)',
    referenceResults.map(([name, r]) => formatRow(name, r.displayLinear, true)));
  printTable('REFERENCE — "AS-IF-OURS" radiance (OUR ACES inverted at exposure 1; see the header)',
    referenceResults.map(([name, r]) => formatRow(name, r.radiance, true)));
  for (const [name, r] of referenceResults) {
    if (r.clamped > 0) console.log(`  ⚠️ ${name}: ${r.clamped} px dropped from the radiance column — an ACES clamp ate them`);
  }

  // ---- the SECOND reference plate, as a control on the method rather than for its own sake ----
  //
  // §0.3's three ponytail-band rects were measured on `post_ms7/08.jpg`. Reproducing their p50
  // hexes here proves this tool's decode/luma path on a plate it was not tuned on. The bands
  // themselves are not part of this round's comparison; they are the second control.
  const ponytailFile = path.join(options.reference, 'post_ms7_08.reference.png');
  if (fs.existsSync(ponytailFile)) {
    const ponytail = decodePng(fs.readFileSync(ponytailFile));
    console.log(`\nCONTROL  ${ponytailFile}  ${ponytail.width}x${ponytail.height} — §0.3's bands`);
    const bands = [
      { name: 'upper, warm §0.3', x0: 1930, y0: 1638, x1: 2070, y1: 1668, published: '#ab512f' },
      { name: 'upper-left, cool §0.3', x0: 1600, y0: 1643, x1: 1800, y1: 1667, published: '#27403c' },
      { name: 'lower, cool §0.3', x0: 1930, y0: 1828, x1: 2150, y1: 1862, published: '#2e3629' },
    ];
    for (const band of bands) {
      // 🚩 §0.3's "p50 hex" is THE MEDIAN-LUMA PIXEL's colour, not the per-channel median. Both
      // were tried here: the per-channel median misses all three published hexes (#ac5036 against
      // #ab512f, and #383b35 against #27403c — 17 code values out on red), and the median-luma
      // pixel reproduces all three exactly. Recorded because "p50 of a colour" has two meanings
      // and picking the wrong one looks like a decode bug.
      const indices = maskIndices(rectMask(ponytail.width, ponytail.height, band));
      const sorted = indices
        .map((k) => [encodedAt(ponytail, k), k])
        .sort((a, b) => a[0] - b[0]);
      const median = sorted[Math.round(0.5 * (sorted.length - 1))][1] * 4;
      const hex = `#${[0, 1, 2]
        .map((c) => Math.round(ponytail.pixels[median + c] * 255).toString(16).padStart(2, '0'))
        .join('')}`;
      console.log(`  ${band.name.padEnd(24)} p50 ${hex}   published ${band.published}   ` +
        `${hex === band.published ? 'REPRODUCES' : '⚠️ DOES NOT REPRODUCE'}`);
    }
  }

  if (options.overlay) {
    for (const [name, mask] of referenceMasks) {
      const file = path.join(options.overlay, `mask-${name.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.png`);
      writeOverlay(reference, mask, file);
      console.log(`  overlay  ${file}`);
    }
  }

  // ---- our plate -----------------------------------------------------------------------------
  if (!options.ours) return;

  const ours = options.ours;
  const bald = readPlate(path.join(ours, 'mask-bald.png'));
  const haired = readPlate(path.join(ours, 'mask-haired.png'));
  const groom = erodeMask(buildGroomMask(bald, haired), bald.width, bald.height, 2);

  // 🎯 THE MASK IS `hair-pedestal.report.mjs`'s, OPERATION FOR OPERATION, because a comparison
  // whose two sides use different masks is the caveat this tool exists to close. Three filters,
  // and dropping any one of them changes the answer:
  //   1. the eroded groom mask — where the groom is DRAWN, from the `?shadows=0` pair;
  //   2. invertible on the floor plate — an ACES clamp carries no information to invert;
  //   3. the floor plate's radiance below HAIR_SHADED_MAX — a groom-mask pixel whose no-lobe,
  //      no-pedestal value is bright is a pixel where something BEHIND the groom resolved, and
  //      counting it measures the background's dynamic range and calls it hair's.
  // Filter 3 is worth 0.5668 -> 0.1932 on the scatter-0 arm's p95. It is the whole difference
  // between reproducing §9.2 and not.
  const floor = readPlate(path.join(ours, 'floor.png'));
  const solid = new Uint8Array(groom.length);
  for (let k = 0; k < groom.length; k += 1) {
    if (groom[k] !== 1) continue;
    const codes = codesAt(floor, k * 4);
    if (isInvertible(codes) === false) continue;
    if (luminance(plateToSceneLinear(codes, OUR_EXPOSURE)) < HAIR_SHADED_MAX) solid[k] = 1;
  }

  console.log(`\nOURS  ${ours}  ${bald.width}x${bald.height}`);
  console.log(`  eroded groom mask ${maskIndices(groom).length} px -> solid hair-shaded mask ${maskIndices(solid).length} px`);

  // The crown rect intersected with the groom mask, so the sub-population is hair and not the
  // skin the rect's corners would otherwise contribute — the exact contamination §2.1's fringe
  // rect suffers from on the reference side.
  const crownRaw = rectMask(bald.width, bald.height, OUR_CROWN_RECT);
  const crown = new Uint8Array(crownRaw.length);
  for (let k = 0; k < crownRaw.length; k += 1) crown[k] = crownRaw[k] & solid[k];
  console.log(`  crown rect H3 ∩ groom: ${maskIndices(crown).length} px of ${maskIndices(crownRaw).length} in the rect`);

  const plates = fs.readdirSync(ours).filter((f) => /^trapg-s.*\.png$/.test(f)).sort();
  const rows = { encoded: [], radiance: [] };
  for (const file of plates) {
    const png = readPlate(path.join(ours, file));
    const name = file.replace('.png', '');
    for (const [suffix, mask] of [['groom', solid], ['crown', crown]]) {
      const r = measure(png, mask, 4);
      rows.encoded.push(formatRow(`${name} ${suffix}`, r.encoded));
      rows.radiance.push(formatRow(`${name} ${suffix}`, r.radiance, true));
    }
  }
  printTable('OURS, GRADED path — ENCODED luma', rows.encoded);
  printTable('OURS, GRADED path — radiance (our ACES inverted, exposure 4)', rows.radiance);

  // --- the verdict, as arithmetic rather than as prose ----------------------------------------
  //
  // Every cell is `ours / reference` on the SAME statistic in the SAME domain. The row that the
  // round quoted as "3.43x" is the `scatter 1.00` arm over `fringe rect §2.1`; every other cell in
  // that row is the same two plates read on a different reference population, which is exactly the
  // quantity the caveat asked for.
  console.log('\nVERDICT — ours / reference, ENCODED luma. Rows: our GRADED arms. Columns: reference masks.');
  const denominators = referenceResults.map(([name, r]) => [name, r.encoded]);
  console.log(`  ${'arm'.padEnd(18)}${denominators.map(([n]) => n.slice(0, 14).padStart(15)).join('')}`);
  for (const arm of ['trapg-s0', 'trapg-s1', 'trapg-s4']) {
    const png = readPlate(path.join(ours, `${arm}.png`));
    const mine = measure(png, solid, OUR_EXPOSURE).encoded;
    console.log(`  ${`${arm} p50`.padEnd(18)}` +
      denominators.map(([, d]) => `${(mine.p50 / d.p50).toFixed(2)}x`.padStart(15)).join(''));
    console.log(`  ${`${arm} p95/p50`.padEnd(18)}` +
      denominators.map(([, d]) => `${(mine.range / d.range).toFixed(2)}x`.padStart(15)).join(''));
  }
}

main();
