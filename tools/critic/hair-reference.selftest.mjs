#!/usr/bin/env node
//
// hair-reference.selftest.mjs — the gate `hair-reference.mjs` shipped without.
//
// ## Why this file exists
//
// `hair-reference.mjs` landed in R31 carrying the round's headline correction — that our hair is
// 1.03x the reference's brightness on matched masks rather than the 3.43x a mismatched pair implied
// — and it shipped with NO SELFTEST, unlike `band-power`, `hair-pedestal`, `hair-transmittance`,
// `lock-coherence`, `heatmap` and `scene-gates`. So nothing gated its polygon fill, its erosion, its
// percentile operator or either transfer chain. It also shipped THREE FALSE NUMBERS in its comments,
// two of which were load-bearing for a conclusion. That combination is not a coincidence: a
// measurement tool with no gate is a tool whose prose is the only record of what it does.
//
// ## The split, and it is forced by the licence rather than by taste
//
// The reference plates are copyrighted by SHIFT UP / Sony Interactive Entertainment and `.gitignore`
// carries `/reference/`, `*.reference.jpg` and `*.reference.png`. They are fetched to a scratchpad
// and never committed, so a clause that needs one CANNOT be a hard gate on a clean clone.
//
//   - OPERATOR clauses run ALWAYS, on synthetic input whose answer is arithmetic written down here
//     before the call. These are the ones that catch a broken fill or an off-by-one erosion.
//   - CLAIM clauses re-derive the `@claim` figures in `hair-reference.mjs`'s comments and STAND DOWN
//     WITH A REASON when their artefact is absent, in `verify_glb.mjs`'s idiom. A stood-down clause
//     is reported, never silently skipped, and the count is printed — because "0 failed" over a
//     roster that mostly did not run is the shape of a gate that cannot go red.
//
// ## Usage
//
//   node tools/critic/hair-reference.selftest.mjs
//   node tools/critic/hair-reference.selftest.mjs --reference <dir>   # to run the CLAIM clauses

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { decodePng } from './png.mjs';
import { encodedLuma } from './color.mjs';
import {
  buildGroomMask, codesAt, isInvertible, luminance, plateToSceneLinear, readPlate,
} from './lightpath-probe.mjs';
import { erodeMask } from './hair-lightpath.mjs';
import {
  FRINGE_RECT, HAIR_SHADED_MAX, OUR_EXPOSURE, maskIndices, polygonMask, rectMask, stats,
} from './hair-reference.mjs';

// 🚩 `fileURLToPath`, NOT `.pathname`. This repository's path contains a space and a non-ASCII
// character, so `import.meta.url` arrives percent-encoded and `.pathname` yields a directory that
// does not exist — which makes an artefact-gated clause STAND DOWN on an artefact that is right
// there. Caught on this file's first run, one file after writing the same warning into
// `hair-reference.mjs`'s own entry guard. `blind_ab.mjs` records the trap too.
const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

let passed = 0;
let failed = 0;
let stoodDown = 0;

function check(id, label, expected, actual, note, tolerance = 0) {
  const ok = typeof expected === 'number' && typeof actual === 'number'
    ? Math.abs(expected - actual) <= tolerance
    : String(expected) === String(actual);
  if (ok) passed += 1; else failed += 1;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${id}  ${label}`);
  console.log(`        expected ${expected}`);
  console.log(`        actual   ${actual}`);
  if (note) console.log(`        ${note}`);
}

function standDown(id, label, reason) {
  stoodDown += 1;
  console.log(`--    ${id}  ${label}`);
  console.log(`        STOOD DOWN: ${reason}`);
}

const count = (mask) => maskIndices(mask).length;

// --- OPERATORS. Always run. Expected values are arithmetic, written before the call. ------------

console.log('\n--- operators, on synthetic input with analytic answers ------------------------\n');

// O1. The percentile operator is NEAREST-RANK (`Math.round(q·(n−1))`), not interpolating. On
// 0..100 the two agree exactly, which is why this input is chosen: it pins the VALUE without
// asserting the convention, and O2 pins the convention separately.
{
  const s = stats(Array.from({ length: 101 }, (_, i) => i));
  check('O1a', 'stats p50 of 0..100', 50, s.p50, 'n = 101, so the median is the 51st element');
  check('O1b', 'stats p95 of 0..100', 95, s.p95, null);
  check('O1c', 'stats mean of 0..100', 50, s.mean, 'the closed form n/2 for a 0..n ramp');
  check('O1d', 'stats range = p95/p50', 95 / 50, s.range, null, 1e-12);
}

// O2. 🚩 THE CONVENTION, PINNED. On an even-length ramp the nearest-rank and the interpolating
// definitions DISAGREE, and this clause exists so that swapping one for the other goes red rather
// than quietly moving every published figure. 0..99 has n = 100; 0.95·99 = 94.05, which rounds to
// index 94 and interpolates to 94.05.
{
  const s = stats(Array.from({ length: 100 }, (_, i) => i));
  check('O2', 'stats is NEAREST-RANK, not interpolating', 94, s.p95,
    'an interpolating p95 would read 94.05 here — this is the clause that tells them apart');
}

// O3. rectMask is half-open in both axes, so its area is exactly (x1−x0)·(y1−y0).
{
  const m = rectMask(200, 200, { x0: 10, y0: 20, x1: 60, y1: 90 });
  check('O3', 'rectMask area is half-open (x1−x0)(y1−y0)', 50 * 70, count(m), null);
}

// O4. polygonMask on an axis-aligned rectangle must agree with rectMask EXACTLY. Even-odd with the
// test point at integer (x, y) and a strict `x <` puts the same pixels in the set — derived, then
// checked, because a fill that is off by one row or column is invisible on a 168,968 px mask and
// changes every percentile downstream.
{
  const rect = { x0: 10, y0: 20, x1: 60, y1: 90 };
  const poly = polygonMask(200, 200, [[10, 20], [60, 20], [60, 90], [10, 90]]);
  check('O4', 'polygonMask on a rectangle == rectMask', count(rectMask(200, 200, rect)), count(poly),
    'the two mask builders must not disagree about the same shape');
}

// O5. A CONCAVE polygon, because a fill that is right on convex shapes can still be wrong here and
// the real hair mask is a 19-vertex concave outline. An L of two rectangles: 40x60 plus 30x20.
{
  const l = polygonMask(200, 200, [[10, 10], [50, 10], [50, 70], [80, 70], [80, 90], [10, 90]]);
  check('O5', 'polygonMask fills a CONCAVE outline correctly', 40 * 60 + 70 * 20, count(l),
    'L-shape: the 40x60 upper arm plus the full 70x20 foot');
}

// O6. Erosion by k takes a W x H rectangle to (W−2k) x (H−2k). The conservative mask erodes by 25,
// and an off-by-one there moves p50 by more than the effect being measured.
{
  const m = rectMask(200, 200, { x0: 20, y0: 20, x1: 120, y1: 140 });
  for (const k of [1, 3, 25]) {
    const e = erodeMask(m, 200, 200, k);
    check(`O6@${k}`, `erodeMask by ${k} shrinks a rectangle by 2k in each axis`,
      (100 - 2 * k) * (120 - 2 * k), count(e), null);
  }
}

// O7. ⚠️ ANTI-VACUITY. O6 would pass if erodeMask were "return a smaller rectangle" for any input,
// so this pins the degenerate end: eroding past half the short axis must leave NOTHING. A clause
// that only ever checks non-empty answers cannot see an operator that never empties.
{
  const m = rectMask(200, 200, { x0: 20, y0: 20, x1: 120, y1: 140 });
  check('O7', 'erodeMask past half the short axis leaves an EMPTY mask', 0,
    count(erodeMask(m, 200, 200, 60)), 'the 100 px axis cannot survive a 60 px erosion');
}

// --- CLAIMS. The `@claim` figures in hair-reference.mjs's comments, re-derived. ------------------

console.log('\n--- claims, re-derived from the artefacts they name ---------------------------\n');

const referenceDir = (() => {
  const i = process.argv.indexOf('--reference');
  return i >= 0 ? process.argv[i + 1] : null;
})();

const referenceFile = referenceDir === null
  ? null
  : ['overview_character.reference.png', 'overview_character.png']
    .map((n) => path.join(referenceDir, n)).find((f) => fs.existsSync(f)) ?? null;

if (referenceFile === null) {
  const why = referenceDir === null
    ? 'no --reference <dir> given. The plates are SHIFT UP / SIE copyright and .gitignore refuses '
      + 'them, so this cannot be a hard gate on a clean clone — fetch per hair.md\'s Appendix and '
      + 'pass --reference to run these.'
    : `no overview_character.reference.png under ${referenceDir}`;
  standDown('C1', 'fringe top-5% y split is 60 below / 710 at-or-above y=570', why);
  standDown('C2', 'fringe top-5% x concentration is 616 in x [1520,1560]', why);
  standDown('C3', '§2.1\'s published fringe percentiles reproduce', why);
} else {
  const img = decodePng(fs.readFileSync(referenceFile));
  const px = [];
  for (let y = FRINGE_RECT.y0; y < FRINGE_RECT.y1; y += 1) {
    for (let x = FRINGE_RECT.x0; x < FRINGE_RECT.x1; x += 1) {
      const k = (y * img.width + x) * 4;
      px.push({ x, y, l: encodedLuma(img.pixels[k], img.pixels[k + 1], img.pixels[k + 2]) });
    }
  }
  px.sort((a, b) => b.l - a.l);
  const top = px.slice(0, Math.round(px.length * 0.05));

  const below = top.filter((p) => p.y < 570).length;
  check('C1a', 'fringe top-5% BELOW y=570', 60, below,
    'the comment once said 769 — inverted. The contamination is in X, not Y.');
  check('C1b', 'fringe top-5% AT OR ABOVE y=570', 710, top.length - below, null);
  check('C2', 'fringe top-5% in x ∈ [1520,1560]', 616,
    top.filter((p) => p.x >= 1520 && p.x < 1560).length,
    'this IS where the skin is, and it is why cutting the rect in Y does not exclude it');

  // ⚠️ NO /255 HERE, AND THE ASYMMETRY IS REAL. `decodePng().pixels` is 0..1 FLOATS while
  // `readPlate`/`codesAt` below hand back 0..255 CODES, so the same `encodedLuma` call needs a
  // different scaling depending on which reader produced its input. Dividing here read 2.086e-4
  // against §2.1's 0.0532 — exactly a factor of 255, which is how the mistake announced itself.
  const s = stats(px.map((p) => p.l));
  check('C3', '§2.1\'s published fringe p50 reproduces', 0.0532, s.p50,
    'the control that says the decode, the rect and the luma definition are all right', 5e-4);
}

const pedestal = path.join(REPO, 'captures', 'hair-r27-pedestal');
if (!fs.existsSync(path.join(pedestal, 'trapg-s0.png'))) {
  standDown('C4', 'filter 3 is worth 0.5719 -> 0.2854 on the scatter-0 arm\'s p95',
    `captures/hair-r27-pedestal is absent — /captures/** is gitignored and these plates are local.`);
} else {
  const bald = readPlate(path.join(pedestal, 'mask-bald.png'));
  const haired = readPlate(path.join(pedestal, 'mask-haired.png'));
  const groom = erodeMask(buildGroomMask(bald, haired), bald.width, bald.height, 2);
  const floor = readPlate(path.join(pedestal, 'floor.png'));
  const plate = readPlate(path.join(pedestal, 'trapg-s0.png'));

  const withFilter = new Uint8Array(groom.length);
  const without = new Uint8Array(groom.length);
  for (let k = 0; k < groom.length; k += 1) {
    if (groom[k] !== 1) continue;
    const codes = codesAt(floor, k * 4);
    if (isInvertible(codes) === false) continue;
    without[k] = 1;
    if (luminance(plateToSceneLinear(codes, OUR_EXPOSURE)) < HAIR_SHADED_MAX) withFilter[k] = 1;
  }
  const p95 = (mask) => stats(maskIndices(mask).map((k) => {
    const c = codesAt(plate, k * 4);
    return encodedLuma(c[0], c[1], c[2]) / 255;
  })).p95;

  check('C4a', 'scatter-0 p95 WITHOUT filter 3', 0.5719, p95(without), null, 5e-4);
  check('C4b', 'scatter-0 p95 WITH filter 3', 0.2854, p95(withFilter),
    'the comment once said 0.1932 — which is §9.2\'s value from a DIFFERENT capture', 5e-4);
}

console.log('');
console.log(`${passed} passed, ${failed} failed, ${stoodDown} stood down with a reason.`);
if (stoodDown > 0) {
  console.log('⚠️  A roster with stood-down clauses is a PARTIAL verdict. "0 failed" over clauses');
  console.log('    that did not run is the shape of a gate that cannot go red.');
}

process.exitCode = failed === 0 ? 0 : 1;
