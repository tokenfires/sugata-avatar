/**
 * hair_alpha.selftest.mjs — a card must be many strands with gaps, not a slab with a soft edge.
 *
 * ## The defect this exists for, in the words that found it and the numbers that confirmed it
 *
 * A blind critic on the shipped groom: *"a flat mauve board has been leaned against half of this
 * woman's face … one opaque, evenly-lit sheet with painterly vertical smudges brushed into it"*,
 * and *"in the 3/4 pose the entire right eye and brow are simply gone behind an unbroken
 * grey-lavender field"*. Its number one was to give each card a real multi-strand alpha.
 *
 * Every number the sheet had ever been judged by was green over the top of that, because every one
 * of them was about COVERAGE. `hair_texture.py` printed mean alpha per strip; `verify_glb.mjs`
 * checks the border and the cutout; `hair_opacity.mjs` measures transmittance. A filled rectangle
 * and a picket fence with the same coverage are the same number to all three. Measured off the
 * sheet those clauses passed, strip 1 — the strip the coverage layers carry, the one that lies
 * across the cheek — crossed **1.15 separate strand runs per row** at the lod the camera samples.
 * One run. The board, as a statistic.
 *
 * ## The three clauses, and what each one refuses
 *
 *   A  RUNS AT THE SAMPLED LOD. How many separate strands a row crosses at the scale the camera
 *      reads, which is the only scale anybody sees. This is the clause the slab fails.
 *      🚩 **AND IT IS RED AT HEAD**, because `hair_alpha.SAMPLED_LOD` was corrected this round from
 *      1.492 to 1.925 — the old figure took its Jacobian in CSS pixels and the page ships TAAU at
 *      0.66. The sheet did not move; the scale it is read at did. Declared in `docs/RED-GATES.md`,
 *      with the reason and the mutation that pins it under MIN_RUNS_AT_LOD below.
 *   B  GAPS IN THE INTERIOR. A run count can be bought with a border wisp, so this asks whether the
 *      middle of the card is open anywhere. ⚠️ Standing rule 4 and the reason the inset exists:
 *      14.635% of the shipped strip 1 was under alpha 0.15 and **0.911% of its interior was**.
 *      The transparency was almost entirely border.
 *   C  NO STRIP IS ONE RUN. A ceiling on the mean width of a run at the sampled lod, so that a
 *      strip cannot satisfy A with one hair and a fringe.
 *
 * ## What is NOT gated here, deliberately
 *
 * MEAN ALPHA. It is a transmittance and `hair_opacity.mjs` owns it — two files gating one number
 * from different sides is how a threshold gets re-derived to clear a red. What this file must not
 * do is let a sheet buy a run count by going transparent, and clause B's inset plus C's ceiling are
 * what stop that; the mean is PRINTED beside every strip so the trade is visible in one read.
 *
 *     node tools/figure-pipeline/hair_alpha.selftest.mjs
 *     node tools/figure-pipeline/hair_alpha.selftest.mjs --atlas /tmp/sheet/albedo.png
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

// 🚩 fileURLToPath, never string surgery on `import.meta.url`: this repository's own path carries a
// space and a non-ASCII character.
const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, '..', '..');

const { decodePng } = await import(
  pathToFileURL(path.join(REPO_ROOT, 'tools', 'critic', 'png.mjs')).href);

const {
  INTERIOR_INSET, SAMPLED_LOD, areaResample, gapShare, meanAlpha, midBandShare,
  runsPerRow, strandTexels, stripReport
} = await import(pathToFileURL(path.join(HERE, 'hair_alpha.mjs')).href);

/** `hair_texture.STRIP_COLUMNS`, and `hair_texture.CAP_STRIP`. */
const STRIPS = 8;
const CAP_STRIP = 0;

/**
 * 🎯 **CLAUSE A's FLOOR, AND IT IS RED AT HEAD.** See `docs/RED-GATES.md`; the reason is one line of
 * arithmetic and it is not a regression in the sheet. `hair_alpha.SAMPLED_LOD` was 1.492 for two
 * rounds, taken from a Jacobian measured in CSS PIXELS while the page ships TAAU at
 * `resolutionScale` 0.66 — so the gate was reading the atlas 0.599 of a mip FINER than the hardware
 * does, which flatters the exact statistic this clause exists to refuse. Corrected, the same sheet
 * that read 3.96 at its worst strip reads 1.90.
 *
 * Runs per row at `SAMPLED_LOD`, off `assets/hair/bob01/albedo.png`, which is unchanged this round —
 * the two rows are ONE SHEET read at two scales, so every difference between them is the constant:
 *
 *   | strip                       |    0 |    1 |    2 |    3 |    4 |    5 |    6 |        7 |
 *   |-----------------------------|-----:|-----:|-----:|-----:|-----:|-----:|-----:|---------:|
 *   | at lod 1.492, as it was read | 1.00 | 4.13 | 5.54 | 4.90 | 6.61 | 7.26 | 5.70 | **3.96** |
 *   | at lod 1.925, as it is read  | 1.00 | 3.58 | 3.84 | 3.36 | 4.42 | 5.47 | 3.53 | **1.90** |
 *
 * 🚩 **AND WHAT THE RED NAMES IS THE WISP STRIP, WHICH IS THE OPPOSITE OF WHAT THE CLAUSE WAS
 * WRITTEN FOR.** Strip 7 is 88.4% transparent and its runs are 1.12 texels wide at the sampled lod;
 * the board this clause was written against was 96.4% opaque in 33.55-texel runs. Both read "few
 * runs per row" and only one of them is a defect. Clause C is what separates them and it says so:
 * the widest run on the sheet is strip 1's at 5.97 against a ceiling of 20. ⚠️ **THAT IS AN
 * OBSERVATION AND NOT A LICENCE TO EXEMPT THE WISPS.** Re-deriving this clause to clear its own red
 * is the failure mode the threshold exists to prevent, so the red is declared and carried, and the
 * re-derivation — if it is the right answer — belongs to a round that can red-prove the replacement
 * against a wisp strip AND against a board.
 *
 * 🚩 **PINNED BY MUTATION IN BOTH DIRECTIONS, WHICH IS THE ONLY WAY A BOUND IS PINNED.** Moved and
 * re-run, this session, one edit at a time and the file restored byte-identically after each
 * (`shasum -a 256` confirmed):
 *
 *   floor 1.85, 1.89   green      floor 1.90, 1.91, 1.95   RED (strip 7, whose own figure is 1.90)
 *
 * So the sheet goes green only at 1.89 or below, and the shipped floor of 3.0 is 1.58× above that —
 * there is no width of slack in which this red could be hiding a second defect, and nothing under
 * 1.90 could refuse the board at 1.15 that the clause was written for.
 */
const MIN_RUNS_AT_LOD = 3.0;

/**
 * Clause B's floor. Share of a strip's interior — inside `INTERIOR_INSET` texels of each edge —
 * that is genuinely open, measured at mip 0 where a gap either exists in the file or does not.
 *
 *   | strip                    |    1 |    2 |    3 |    4 |    5 |    6 |    7 |
 *   |--------------------------|-----:|-----:|-----:|-----:|-----:|-----:|-----:|
 *   | as the critic saw it     | **0.911%** | 29.07 | 32.97 | 40.63 | 49.82 | 74.73 | 84.45 |
 *   | this round               | **16.95%** | 26.92 | 30.22 | 37.52 | 48.04 | 72.12 | 83.35 |
 *
 * 12% is 29% under the worst strip that has to pass and thirteen times the defect. Pinned by
 * mutation, same discipline as clause A, re-run this session with the file restored byte-identically
 * after each edit: **green at 16.9%, RED at 17.0%** — 17.0% is strip 1's own 16.95% — so the live
 * range is 0.92% to 16.9% and there is 1.41× of slack.
 *
 * ⚠️ **THIS CLAUSE IS MEASURED AT MIP 0 AND IS THEREFORE THE ONE THING IN THIS FILE THE `SAMPLED_LOD`
 * CORRECTION DID NOT MOVE.** A gap either exists in the file or it does not; whether the sampler can
 * resolve it is clause A's question. Both figures above are unchanged from the round before.
 */
const MIN_GAP_SHARE = 0.12;

/**
 * Clause C's ceiling: the mean width of one above-cutoff run at the sampled lod, in texels. A card
 * strip is 128 texels, so 33.7 at the sampled lod — a run of 29 of them is the board, and the cap
 * strip on this very sheet measures exactly that (clause L).
 *
 *   | strip                       |     1 |    2 |    3 |    4 |    5 |    6 |    7 |
 *   |-----------------------------|------:|-----:|-----:|-----:|-----:|-----:|-----:|
 *   | at lod 1.492, as it was read | **7.04** | 4.79 | 5.05 | 3.22 | 2.41 | 1.35 | 1.11 |
 *   | at lod 1.925, as it is read  | **5.97** | 5.20 | 5.52 | 3.60 | 2.40 | 1.25 | 1.12 |
 *
 * ⚠️ **THE CORRECTION MOVED THIS CLAUSE THE SAFE WAY AND THAT IS WORTH READING TWICE.** A coarser
 * filter makes runs FEWER (clause A, red) and, on this sheet, slightly NARROWER at the cutoff, so
 * clause C got easier at the same moment clause A got harder. A ceiling that eases when the reading
 * is corrected is a ceiling that was never the binding constraint; do not read C's green as evidence
 * about A's red.
 *
 * 20 texels is 59% of a strip at this lod and it is the number a run has to be UNDER. Pinned by
 * mutation this session, file restored byte-identically after each edit: **green at 5.98, RED at
 * 5.96** — 5.97 is strip 1's own figure — so the live range is 5.98 to 29.42, where the top of the
 * range is the cap strip that clause L requires to fail, and 20 sits near the middle of it in the
 * log. It must stay well above 6, because a run five texels wide at the sampled lod is a LOCK and
 * locks are what a card carries: this is a refusal of the board, not a second frequency clause.
 */
const MAX_STRAND_TEXELS_AT_LOD = 20.0;

let checks = 0;
let failures = 0;

function report(ok, what, detail = '') {
  checks += 1;
  if (ok !== true) failures += 1;
  console.log(`${ok === true ? 'PASS' : 'FAIL'}  ${what}${detail ? `\n        ${detail}` : ''}`);
}

function near(actual, expected, tolerance, what) {
  report(Math.abs(actual - expected) <= tolerance, what,
    `expected ${expected.toFixed(6)} ± ${tolerance}, measured ${actual.toFixed(6)}`);
}

// --- the shapes the instrument is checked against ------------------------------------------------
//
// 🎯 **EVERY ANSWER BELOW IS KNOWN ON PAPER, WHICH IS THE POINT.** `cornea_geometry.selftest.mjs`
// checks a signed distance against a SPHERE and `hair_geometry.selftest.mjs` checks a transmittance
// against a stack of known alphas, for the same reason: a statistic that has only ever been run on
// the asset it judges has no way to be wrong out loud.

/** A filled rectangle with a transparent border — the defect, drawn deliberately. */
function slab(width, height, border) {
  const values = new Float64Array(width * height);
  for (let row = 0; row < height; row += 1) {
    for (let column = border; column < width - border; column += 1) values[row * width + column] = 1;
  }
  return { values, width, height };
}

/** A picket fence: `period` texels, the first `bar` of them opaque. Runs and widths are exact. */
function comb(width, height, period, bar) {
  const values = new Float64Array(width * height);
  for (let row = 0; row < height; row += 1) {
    for (let column = 0; column < width; column += 1) {
      values[row * width + column] = (column % period) < bar ? 1 : 0;
    }
  }
  return { values, width, height };
}

// --- the instrument, against those answers -------------------------------------------------------

const board = slab(128, 256, 3);
near(runsPerRow(board), 1, 0, 'a filled rectangle crosses exactly one run per row');
near(strandTexels(board), 122, 0, 'and that run is the whole rectangle, 128 less its 3-texel borders');
near(gapShare(board), 0, 0, 'and its interior, inside the border inset, is nowhere open');
near(meanAlpha(board), 122 / 128, 1e-12, 'its mean alpha is the share of it that is filled');
near(midBandShare(board), 0, 0, 'a hard-edged shape has no mid band at all — which is why the mid band alone cannot find this defect');

const fence = comb(128, 256, 8, 4);
near(runsPerRow(fence), 16, 0, 'a period-8 fence crosses 128/8 runs per row');
near(strandTexels(fence), 4, 0, 'and each run is its bar width');
near(gapShare(fence), 0.5, 1e-12, 'and half its interior is open');

// 🎯 **THE CALIBRATION OF THE "TWO TEXELS AT THE SAMPLED LOD" RULE THE WHOLE SHEET IS AUTHORED
// AGAINST, ON SHAPES WHOSE ANSWER IS KNOWN.** A ladder of fences of increasing bar width, each one
// resampled to the lod the camera reads, and what the mid band does as the bar crosses two texels.
// Re-measured this session at the corrected `SAMPLED_LOD` of 1.925 (÷3.80):
//
//   bar at mip 0      2     3     4     5     6     8    12    16
//   bar at the lod   0.53  0.79  1.05  1.32  1.58  2.11  3.16  4.21
//   mid band       100.0% 88.2% 64.7% 50.0% 44.1% 29.4% 20.6% 11.8%
//
// ⚠️ A 20-texel rung was tried and DROPPED: it reads 11.8% too, so the fall is strictly monotonic
// only up to 16 and a ladder that ties there would have needed the clause below relaxed to `<=`.
// The floor is the resample's own quantisation — the strip is 34 output texels wide at this lod —
// and a rung that measures the instrument's floor rather than the filter is not a known answer.
//
// 🚩 **THE LADDER GREW TWO RUNGS WHEN THE CONSTANT WAS CORRECTED, AND THAT IS NOT A THRESHOLD BEING
// MOVED TO CLEAR A RED.** Every rung is a bar width in MIP-0 texels and every claim below is about
// a bar width AT THE LOD, so a coarser lod slides the whole ladder left: the 12-texel rung that used
// to be 4.27 texels at the lod is 3.16 now, and asserting "4 texels arrives with its edges" against
// it would be asserting it against 3.16 texels. The 16-texel rung is 4.21 at the lod, which is what
// the old 12 was, and it is what the clause below reads. The CLAIM is unchanged; only which fence
// embodies it has moved, because the fences are quoted in the units the sheet is drawn in.
//
// ⚠️ **AND THE RUN COUNT IS NOT THE STATISTIC THAT SEES THIS, WHICH IS WORTH KNOWING BEFORE ANYONE
// USES IT ALONE.** A perfectly periodic fence keeps its runs all the way down to a half-texel bar,
// because the resample's integer footprints keep landing wholly inside a bar and the pattern is in
// phase with itself on every row. It is the MID BAND that reports the wash, monotonically, and it
// crosses 30% at almost exactly two texels — which is where the rule came from. Clause A finds the
// board and this finds the smear; neither one does the other's job. 🎯 **IT IS ALSO WHY COARSENING
// A STRIP DOES NOT SHOW UP AS A RUN COUNT**: measured this session on candidate sheets, strip 5 at
// 24 lanes and at 14 lanes read 4.41 and 4.29 runs at the lod — indistinguishable — while their mid
// band read 40.8% and 31.8%. A round that judges a coarsening by clause A will conclude it bought
// nothing.
const LADDER_BARS = [2, 3, 4, 5, 6, 8, 12, 16];
const FOUR_TEXELS_AT_LOD = 7; // the 16-texel rung: 4.21 texels once minified
const ladder = LADDER_BARS.map((bar) =>
  midBandShare(areaResample(comb(128, 256, bar * 2, bar), 2 ** SAMPLED_LOD)));
report(ladder.every((share, index) => index === 0 || share < ladder[index - 1]),
  'the mid band at the sampled lod falls monotonically as a bar widens',
  ladder.map((share) => `${(share * 100).toFixed(1)}%`).join(' > '));
report(ladder[0] > 0.8,
  `a bar ${(LADDER_BARS[0] / 2 ** SAMPLED_LOD).toFixed(2)} texels wide at the sampled lod arrives as a wash`,
  `${(ladder[0] * 100).toFixed(1)}% mid band, from 0.0% at mip 0 where it is a hard-edged fence`);
report(ladder[FOUR_TEXELS_AT_LOD] < 0.2,
  `and a bar ${(LADDER_BARS[FOUR_TEXELS_AT_LOD] / 2 ** SAMPLED_LOD).toFixed(2)} texels wide arrives with its edges`,
  `${(ladder[FOUR_TEXELS_AT_LOD] * 100).toFixed(1)}% mid band`);

// And a coarse fence keeps its runs through the same resample, which is what the sheet aims at.
const coarse = areaResample(comb(128, 256, 24, 12), 2 ** SAMPLED_LOD);
report(runsPerRow(coarse) >= MIN_RUNS_AT_LOD, 'a period-24 fence clears clause A after minification',
  `${runsPerRow(coarse).toFixed(3)} runs per row at lod ${SAMPLED_LOD}, floor ${MIN_RUNS_AT_LOD}`);

// The resample itself. ⚠️ NOT exactly mean-preserving at a fractional scale, and that is arithmetic
// rather than a bug: the footprints are integer partitions of unequal size and their means are
// averaged unweighted, so a 3-into-2 split weights a 1-texel cell like a 2-texel one. It IS exact
// at an integer scale, which is the case a box mip chain covers and the case round 17 measured.
const noisy = { values: Float64Array.from({ length: 256 * 256 }, (_, i) => ((i * 2654435761) % 1024) / 1023), width: 256, height: 256 };
near(meanAlpha(areaResample(noisy, 2)), meanAlpha(noisy), 1e-12,
  'the resample conserves the mean exactly at an integer scale — a box mip chain, by another name');
near(meanAlpha(areaResample(noisy, 2 ** SAMPLED_LOD)), meanAlpha(noisy), 0.01,
  'and to within a hundredth at the fractional scale the camera samples at');

// --- the sheet ------------------------------------------------------------------------------------

const atlasArgument = process.argv.indexOf('--atlas');
const atlases = atlasArgument >= 0
  ? [process.argv[atlasArgument + 1]]
  : fs.existsSync(path.join(REPO_ROOT, 'assets', 'hair'))
    ? fs.readdirSync(path.join(REPO_ROOT, 'assets', 'hair'))
      .map((style) => path.join(REPO_ROOT, 'assets', 'hair', style, 'albedo.png'))
      .filter((file) => fs.existsSync(file))
    : [];

report(atlases.length > 0, 'there is a strand atlas to measure',
  atlases.length > 0 ? atlases.map((file) => path.relative(REPO_ROOT, file)).join(', ')
    : 'no assets/hair/*/albedo.png — build one with tools/figure-pipeline/build.sh --hair bob01');

for (const file of atlases) {
  const image = decodePng(fs.readFileSync(file));
  console.log(`\n--- ${path.relative(REPO_ROOT, file)} — ${image.width}x${image.height}, ` +
    `${STRIPS} strips, sampled at lod ${SAMPLED_LOD} (÷${(2 ** SAMPLED_LOD).toFixed(2)}) ---\n`);
  console.log('  strip   mean   mid@0   mid@lod   runs@0  runs@lod  strandTx@lod  gap(interior)');

  const reports = [];
  for (let strip = 0; strip < STRIPS; strip += 1) {
    const measured = stripReport(image, strip, STRIPS);
    reports.push(measured);
    console.log(`  ${strip === CAP_STRIP ? 'cap ' : `s${strip}  `}  ` +
      `${measured.mean.toFixed(4)}  ${(measured.midBand * 100).toFixed(2).padStart(6)}% ` +
      `${(measured.midBandAtLod * 100).toFixed(2).padStart(7)}%  ${measured.runs.toFixed(2).padStart(7)} ` +
      `${measured.runsAtLod.toFixed(2).padStart(8)}  ${measured.strandTexelsAtLod.toFixed(2).padStart(11)} ` +
      `${(measured.gapShare * 100).toFixed(2).padStart(11)}%`);
  }
  console.log('');

  // 🚩 THE CAP IS EXEMPT FROM ALL THREE AND IT HAS TO BE. `hair_texture.CAP_STRIP` is deliberately
  // an edge-to-edge opaque texel — `hair_cards.cap_uv` tiles it around the whorl, so a gap there is
  // a transparent radial seam repeated twelve times across the crown — and `hair_cards.py` never
  // gives a CARD that strip. It is gated from the other side, by CAP_STRIP_MIN_COVERAGE, which
  // fails a build whose cap does NOT cover.
  const cards = reports.filter((measured) => measured.strip !== CAP_STRIP);

  const thin = cards.filter((measured) => measured.runsAtLod < MIN_RUNS_AT_LOD);
  report(thin.length === 0,
    `A — every card strip is many strands at the lod the camera samples (floor ${MIN_RUNS_AT_LOD})`,
    thin.length === 0
      ? `worst strip ${cards.reduce((low, m) => m.runsAtLod < low.runsAtLod ? m : low).strip} at ` +
        `${Math.min(...cards.map((m) => m.runsAtLod)).toFixed(2)} runs per row`
      : thin.map((m) => `strip ${m.strip} crosses ${m.runsAtLod.toFixed(2)} runs per row at lod ` +
        `${SAMPLED_LOD} — a card carrying it is a board, not a bundle`).join('; '));

  const shut = cards.filter((measured) => measured.gapShare < MIN_GAP_SHARE);
  report(shut.length === 0,
    `B — every card strip is genuinely open in its interior (floor ${(MIN_GAP_SHARE * 100).toFixed(0)}%, ` +
    `inside ${INTERIOR_INSET} texels of each edge)`,
    shut.length === 0
      ? `worst strip ${cards.reduce((low, m) => m.gapShare < low.gapShare ? m : low).strip} at ` +
        `${(Math.min(...cards.map((m) => m.gapShare)) * 100).toFixed(2)}% open`
      : shut.map((m) => `strip ${m.strip} has ${(m.gapShare * 100).toFixed(3)}% of its interior ` +
        'open — whatever transparency it has is at its border').join('; '));

  const wide = cards.filter((measured) => measured.strandTexelsAtLod > MAX_STRAND_TEXELS_AT_LOD);
  report(wide.length === 0,
    `C — no card strip is one run (ceiling ${MAX_STRAND_TEXELS_AT_LOD} texels at the sampled lod)`,
    wide.length === 0
      ? `widest strip ${cards.reduce((high, m) => m.strandTexelsAtLod > high.strandTexelsAtLod ? m : high).strip} at ` +
        `${Math.max(...cards.map((m) => m.strandTexelsAtLod)).toFixed(2)} texels per run`
      : wide.map((m) => `strip ${m.strip} averages ${m.strandTexelsAtLod.toFixed(2)} texels per run ` +
        'at the sampled lod — that is the card, painted').join('; '));

  // L — the liveness control on the whole file, and it is the cap. Standing rule 4: every clause
  // above is a floor, and a floor over an empty or a uniform mask reads as anything at all. The cap
  // strip is a KNOWN board on this very sheet, so if the instrument has stopped measuring, the one
  // strip that must fail A and C will pass them.
  const cap = reports[CAP_STRIP];
  report(cap.runsAtLod < MIN_RUNS_AT_LOD && cap.strandTexelsAtLod > MAX_STRAND_TEXELS_AT_LOD,
    'L — the instrument still finds a board when there is one: the cap strip fails A and C',
    `cap crosses ${cap.runsAtLod.toFixed(2)} runs per row (floor ${MIN_RUNS_AT_LOD}) in runs of ` +
    `${cap.strandTexelsAtLod.toFixed(2)} texels (ceiling ${MAX_STRAND_TEXELS_AT_LOD}) — it is ` +
    'edge-to-edge opaque on purpose and no card carries it');
}

console.log(`\n${failures === 0 ? 'PASS' : 'FAIL'} — ${checks - failures} of ${checks}.`);
process.exit(failures === 0 ? 0 : 1);
