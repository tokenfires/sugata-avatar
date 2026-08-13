#!/usr/bin/env node
//
// hair_tips.mjs — the two artefacts a critic named that are about the COVERAGE PATH rather than
// about where the cards are, and the reading of what that path actually is on the shipped page.
//
// ## The three claims this file exists to turn into numbers
//
//   1. *"the tips are dither confetti"*
//   2. *"there is a circuit-board texture artifact sitting on the cheek at portrait range"*
//   3. read off the page's own HUD: *"NO MSAA — a2c inert, which means the alpha-to-coverage path
//      the groom was presumably authored for is silently doing nothing, leaving a naked alpha test
//      with no coverage AA."*
//
// `hair_opacity.mjs` next door answers "how much of what is behind the groom reaches the camera",
// which is a question about WHERE THE CARDS ARE. None of the three above is that question: a groom
// can be perfectly opaque and still resolve its edges into salt and pepper. So this measures the
// second derivative of the picture — how a pixel differs from its neighbours — where that one
// measures the picture against a step.
//
// ## 🎯 The statistic, and why it is a high-pass residual rather than an edge count
//
// Confetti, stipple, dither and moiré are all the same thing to a viewer: ENERGY AT THE PIXEL
// SCALE THAT THE SURFACE UNDERNEATH DOES NOT HAVE. So every number below is computed off
//
//     r(pixel) = luma255(pixel) − mean(luma255 over the 3x3 around it)
//
// which is zero on any smooth ramp — a soft resolved hair edge included — and large wherever a
// pixel disagrees with its own neighbourhood. `speckle` is the share of a region over |r| >
// SPECKLE_THRESHOLD, and it is the number that says "confetti" or does not.
//
// 🚩 **AND A HIGH-PASS ALONE CANNOT TELL A DITHER FROM A TEXTURE, WHICH IS WHY `grid` IS HERE
// TOO.** A circuit board is not noise: it is a REGULAR pattern, and the word the critic reached
// for is about right angles. `grid` is the normalised autocorrelation of r along rows and along
// columns at lags 2..GRID_MAX_LAG, maximised over the lag — near 0 for white noise (which is what
// an interleaved-gradient dither resolves to), positive and large for anything periodic and
// axis-aligned. The pair separates the two artefacts the critic reported as one.
//
// ## 🚩 What the masks contain — standing rule 4, and this file has three masks
//
// Every region below is cut from a CPU RASTER of the meshes' own triangles under the live camera
// and the live skinning, never from a threshold on the picture. A "tip" mask thresholded on the
// rendered frame would contain only the pixels the dither happened to KEEP, so its speckle share
// would fall as the confetti got worse. The raster is the same construction `hair_opacity.mjs`
// documents at length and it is reproduced here rather than imported, because that file runs
// `main()` at module load and is a gate; the duplication is the projection and the half-space
// walk, and the two are checked against each other by RASTER_AGREEMENT below.
//
//   tips     hair over the BACKDROP at 1 crossing — the fringe and the strand ends, which is what
//            the critic was looking at. Over the backdrop rather than over skin because a tip
//            against the body is a tip against a lit surface and its contrast is the body's.
//   mass     hair at 3+ crossings over the head. The interior, as a scale reference: whatever the
//            resolve does to a hair pixel, it does here too, minus the silhouette.
//   skin     visible skin with NO hair over it. Where the circuit board was reported, and the
//            control that says whether the number is the groom's at all.
//   backdrop the flat backdrop with nothing in front of it. THE LIVENESS FLOOR — a region with no
//            geometry in it must read no speckle and no grid, or the statistic is measuring the
//            instrument.
//
// ## 🚩 What the coverage path IS, read off the built objects rather than off the HUD
//
// The critic's third complaint quotes `alive.js`'s HUD — *"NO MSAA — a2c inert"* — and concludes
// the groom is *"a naked alpha test with no coverage AA"*. **The HUD line is accurate and the
// conclusion is wrong, and the two halves belong to different meshes.** `coveragePath()` reads the
// live material; measured on the shipped page at `?hairoit=stochastic`:
//
//     multisampled false · rendererSamples 0 · alphaToCoverage false
//     alphaTest 0 · alphaHash false · alphaTestNode PRESENT · transparent false · depthWrite true
//
// So the groom has no alpha test at all: its coverage decision is `hairDitherThresholdNode`, a
// screen-space dither integrated by the temporal resolve. `a2c inert` is true and intended.
//
// The HUD's subject is `session.cards` — the BROW AND LASH cards, which `installCardShading` gives
// `alphaTest = 0.1` and `alphaToCoverage = multisampled`, i.e. false. Those two meshes really are a
// naked alpha test with no coverage AA, and it shows: with `?cards=0` against `?cards=1`, all else
// equal, the residual rms on the four highest-energy bare-skin tiles falls 8.764 -> 5.902 at
// (320,288), 12.346 -> 7.969 at (352,352), 12.114 -> 8.572 at (128,288) and 10.100 -> 8.038 at
// (352,320) — a third of the pixel-scale energy at the brow and lash line is that path. ⚠️ It is at
// the BROW LINE and not on the cheek, and it is not this file's to fix.
//
// ⚠️ **AND "TURN MSAA ON" IS THE WRONG ANSWER, MEASURED TWICE.** Punch-list 3.12 found the temporal
// resolve antialiases cutout cards BETTER than alpha-to-coverage does — single-pixel silhouette
// transitions 27.1% TAAU against 44.5% MSAA+a2c — and `alive.js` refuses the pair anyway: the
// stochastic arm cannot run with `alphaToCoverage`, so `?aa=msaa` silently falls the groom back to
// `cutout`, which the table below measures as worse than `blend` in every region that has hair in
// it. The coverage the tips need is softer, not multisampled.
//
// ## The arms
//
// `?hairoit=` selects the transparency arm on the page, so the same framing can be captured
// through each one and the artefact attributed. `stochastic` ships. `cutout` is the naked alpha
// test — the thing the HUD line above claims the page has fallen back to — and `blend` is sorted
// alpha, which has no coverage decision at all and is therefore the floor a soft edge would read.
//
//   node tools/figure-pipeline/hair_tips.mjs
//   node tools/figure-pipeline/hair_tips.mjs --arms stochastic,cutout,blend --steps 24
//   node tools/figure-pipeline/hair_tips.mjs --defect flat     # the red proof, see DEFECTS
//
// Exits non-zero on any red clause.

import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

// 🚩 fileURLToPath, never string surgery on `import.meta.url`: this repository's own path carries a
// space and a non-ASCII character. `hair_shots.mjs` records the same trap.
const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, '..', '..');

const { decodePng, encodePng } = await import(
  pathToFileURL(path.join(REPO_ROOT, 'tools', 'critic', 'png.mjs')).href);

/**
 * The code-value residual above which a pixel disagrees with its own neighbourhood.
 *
 * 8/255 rather than a smaller number because the shipped page carries things that are legitimately
 * at the pixel scale and are not this defect: `Grade.js`'s film grain is σ 1.5/255 (turned off here
 * by `?grain=0`, but the tone curve's own quantisation is not), and the temporal resolve leaves a
 * 0.1176/255 residual on flat skin that `alive.js` measures and records. Both are an order below
 * this. A kept-or-discarded coverage decision on a dark groom against a dark backdrop moves a pixel
 * by tens of code values, which is the population this is meant to count.
 */
const SPECKLE_THRESHOLD = 8;

/** Autocorrelation lags searched for a periodic, axis-aligned pattern. See `grid`. */
const GRID_MIN_LAG = 2;
const GRID_MAX_LAG = 12;

/** The smallest region any statistic is allowed to be computed over. `hair_opacity`'s reason. */
const MINIMUM_MASK_PIXELS = 4000;

/** The arm the page ships. T1 and T2 are clauses on this one and readings on the others. */
const SHIPPED_ARM = 'stochastic';

/** How far above the empty backdrop's own residual a region has to read for L1 to call it live. */
const FLOOR_MARGIN = 1.5;

/**
 * The ceilings, every one of them read off a run in this table.
 *
 * Portrait, `alive.html` 900x1200 dpr 1, 24 converged steps of
 * `?bare&freeze&capture&seed=1&grain=0&hair=1&shadows=0&grade=0&hairoit=<arm>`, all masks
 * intersected with `geometricallyStable`:
 *
 *   |                        |  tips  | curtain |  mass  |  skin  | backdrop |
 *   |------------------------|-------:|--------:|-------:|-------:|---------:|
 *   | `stochastic`, ships    | 5.00%  | 16.02%  | 6.56%  | 1.20%  |   0.31%  |
 *   | `cutout`               | 2.57%  | 12.47%  | 4.66%  | 1.20%  |   0.31%  |
 *   | `blend`                | 1.15%  |  4.08%  | 1.12%  | 1.20%  |   0.31%  |
 *   | `--defect flat`        | 3.81%  | 10.47%  | 3.69%  | 1.21%  |   0.40%  |
 *   | `--defect maskall`     | 3.67%  |  3.67%  | 3.67%  | 3.67%  |   3.67%  |
 *   | `--defect checker`     | 74.61% | 78.85%  | 82.01% | 95.97% |  99.93%  |
 *
 * mask sizes, identical on every row but `maskall`: tips 11,539 px, curtain 115,377, mass 195,885,
 * skin 314,590, backdrop 225,478. `maskall` is 1,080,000 five times over, which is the whole frame.
 *
 * 🎯 **AND `grid` SAYS IT IS NOT A CIRCUIT BOARD, WHICH IS WORTH KNOWING BECAUSE THAT IS THE WORD
 * THE CRITIC USED.** Edge-discounted (see `gridScore`), the shipped arm reads 0.1015 over the tips,
 * 0.0138 over the curtain, 0.0609 over the mass and exactly 0.0000 over skin and backdrop, while
 * the planted 4 px checkerboard control reads 0.59 to 0.98 at lag 4 over every one of them. There
 * is no lattice and no repeating period anywhere in the picture. The artefact is APERIODIC blocky
 * mottle, and "circuit board" is what an aperiodic axis-aligned stipple looks like to a reader
 * rather than a description of its structure. The distinction matters because a periodic artefact
 * would point at the atlas's strand lattice and this one points at the per-pixel coverage decision.
 *
 * 🎯 **READ THE `skin` COLUMN FIRST: 1.20% ON ALL THREE ARMS, TO THREE FIGURES.** Bare skin with no
 * hair over it does not care which transparency arm the groom is drawn through, which is exactly
 * what it should do and is the control that makes the other columns mean something. Whatever the
 * numbers in the hair columns are, they are the coverage path's.
 *
 * 🚩 **AND THE SHIPPED ARM IS THE WORST OF THE THREE EVERYWHERE HAIR IS.** 5.00% against `blend`'s
 * 1.15% at the tips and 6.56% against 1.12% in the mass — the arm chosen for its temporal
 * behaviour leaves four to six times the pixel-scale disagreement of sorted alpha on the same
 * geometry at the same framing after the same 24 converged steps. That is the critic's "dither
 * confetti", and the mass number says it is not only at the tips.
 *
 * ⚠️ **AND THE WORST REGION IS NOT THE TIPS.** The critic's sentence is about the tips, and the
 * tips are the smallest of the three hair masks and the second-mildest of them. The CURTAIN — the
 * one-to-two-card layer lying over the cheek and the jaw, 115,377 px of the portrait, the same
 * region `hair_opacity.mjs`'s C4 gates for transparency — reads 16.02%, a fifth higher than the
 * tips even under sorted alpha and four times higher under the arm that ships. Crop it at 6x from
 * the two plates and the two artefacts the critic reported separately turn out to be one thing:
 * under `blend` the card over the cheek reads as clean diagonal strand stripes, and under
 * `stochastic` the same stripes are quantised into an axis-aligned dot pattern. That is "circuit
 * board on the cheek", and "dither confetti" is the same mechanism where the card is thinnest.
 *
 * 🚩 **`--defect flat` SAYS THE COVERAGE PATH IS NOT ALL OF IT, AND THAT IS A NEGATIVE RESULT WORTH
 * KEEPING.** With the atlas gone and the groom fully opaque the curtain still reads 10.47% and the
 * tips 3.81% — two thirds and three quarters of the shipped numbers. So a third of the curtain's
 * speckle is the CARDS THEMSELVES: their edges, their shading and their overlap at portrait
 * magnification, none of which a transparency arm can fix. The clean attribution is the ARM
 * comparison, which holds geometry and atlas fixed: 16.02% -> 4.08% is 12 points, and it is the
 * coverage decision's.
 *
 * ⚠️ THE CEILINGS BELOW SIT BETWEEN `cutout` AND `stochastic`, WHICH MEANS **THEY ARE RED ON THE
 * SHIPPED BUILD AND ARE MEANT TO BE.** This round measured the defect and did not fix it — the fix
 * is in `packages/core/src/render/HairOIT.js`, which this round does not own. A ceiling placed
 * above the defect so the suite goes green would be the gate agreeing with the picture nobody
 * likes. `blend` at 1.15% and `cutout` at 2.57% are what say the ceiling is reachable rather than
 * aspirational; the run prints that line itself. See `docs/RED-GATES.md`.
 */
const CEILINGS = {
  tipSpeckle: 0.030,
  curtainSpeckle: 0.030
};

/**
 * The red proofs, each breaking the picture at a different point.
 *
 *   `flat`   the groom is drawn with a flat opaque albedo — no atlas, no coverage variation at all.
 *            Every statistic over the tip mask must collapse, because there is nothing left at the
 *            pixel scale for the high-pass to find. This is the control that says the numbers are
 *            the COVERAGE's and not the mask's.
 *   `checker` a 4 px-period checkerboard of ±10 cv is ADDED TO THE DECODED PLATE before the
 *            high-pass runs. ⚠️ **THIS ONE IS A CONTROL ON THE DETECTOR AND NOT ON THE PICTURE,
 *            AND IT IS LABELLED THAT WAY RATHER THAN COUNTED AS A SOURCE RED.** `grid` is a
 *            claim that a periodic axis-aligned pattern is visible to this statistic, and nothing
 *            reachable from a `NodeMaterial` handle on this page plants one — emissive, opacity
 *            and colour are all uniform over a fragment. So the known signal is injected at the
 *            one place a known signal can be: `grid` must come back near 1.0 at lag 4, on both
 *            axes, or the clause it feeds cannot see a circuit board and is not a clause.
 *   `maskall` every mask becomes the whole frame. Mostly backdrop, which has no pixel-scale energy
 *            at all, so every statistic collapses toward zero — the standing-rule-4 failure,
 *            planted, in the direction that FLATTERS.
 */
const DEFECTS = ['none', 'flat', 'checker', 'maskall'];

const URL_QUERY = '?bare&freeze&capture&seed=1&grain=0&hair=1&shadows=0&grade=0';

async function main() {
  const options = parseArguments(process.argv.slice(2));
  if (DEFECTS.includes(options.defect) === false) {
    throw new Error(`--defect must be one of ${DEFECTS.join(', ')} — got '${options.defect}'.`);
  }
  fs.mkdirSync(options.out, { recursive: true });

  if (options.defect !== 'none') {
    console.log(`🚩 DEFECT PLANTED — --defect ${options.defect}. This run is a red proof and its ` +
      'numbers are not the groom\'s.');
  }

  const playwright = await loadPlaywright();
  const server = options.url === null ? await startVite() : null;
  const origin = options.url ?? `${server.origin}/alive.html`;

  const browser = await playwright.chromium.launch({
    channel: 'chromium',
    headless: true,
    args: ['--enable-unsafe-webgpu', '--ignore-gpu-blocklist', '--hide-scrollbars']
  });

  const measured = [];

  try {
    for (const arm of options.arms) {
      // One page load per arm: `?hairoit` is read when the bake is built and is not a runtime
      // switch, so reusing the page would measure the first arm five times.
      const page = await openPage(browser, `${origin}${URL_QUERY}&hairoit=${arm}`);
      measured.push(await measureArm(page, arm, options));
      await page.context().close();
    }
  } finally {
    await browser.close();
    if (server !== null) server.stop();
  }

  const failures = report(measured, options);

  console.log('');
  if (failures.length > 0) {
    for (const failure of failures) console.log(`FAIL ${failure}`);
    console.log(`\nFAIL — ${failures.length} clause(s) red.`);
    process.exitCode = 1;
    return;
  }
  console.log('PASS');
}

// --- the measurement -----------------------------------------------------------------------------

async function measureArm(page, arm, options) {
  await installProbe(page, options.defect);

  const path_ = await page.evaluate(() => globalThis.__hairTips.coveragePath());

  await converge(page, options.steps);
  const image = await screenshot(page, path.join(options.out, `${arm}.png`));
  const luma = luma255(image);
  if (options.defect === 'checker') plantChecker(luma, image.width, image.height);

  const raster = await page.evaluate(() => globalThis.__hairTips.raster());
  const { width, height } = raster;
  const pixels = width * height;
  const inFront = Buffer.from(raster.inFront, 'base64');
  const behind = Buffer.from(raster.behind, 'base64');

  // `behind`: 0 nothing / 1 the backdrop / 2 the figure. The raster writes whichever is NEAREST,
  // so a pixel where the shoulder wins over the backdrop is figure and is not a tip.
  const stable = geometricallyStable(inFront, behind, width, height);

  const tips = new Uint8Array(pixels);
  const curtain = new Uint8Array(pixels);
  const mass = new Uint8Array(pixels);
  const skin = new Uint8Array(pixels);
  const backdrop = new Uint8Array(pixels);
  for (let index = 0; index < pixels; index += 1) {
    const all = options.defect === 'maskall';
    const keep = all || stable[index] === 1;
    const depth = inFront[index];
    tips[index] = keep && (all || (depth === 1 && behind[index] !== 2)) ? 1 : 0;
    curtain[index] = keep && (all || (depth >= 1 && depth <= 2 && behind[index] === 2)) ? 1 : 0;
    mass[index] = keep && (all || (depth >= 3 && behind[index] === 2)) ? 1 : 0;
    skin[index] = keep && (all || (depth === 0 && behind[index] === 2)) ? 1 : 0;
    backdrop[index] = keep && (all || (depth === 0 && behind[index] !== 2)) ? 1 : 0;
  }

  const residual = highPass(luma, width, height);
  writeResidual(path.join(options.out, `${arm}-residual.png`), width, height, residual);

  const regions = { tips, curtain, mass, skin, backdrop };
  const summary = {};
  for (const [name, mask] of Object.entries(regions)) {
    summary[name] = {
      pixels: countOf(mask),
      speckle: speckleShare(mask, residual),
      rms: residualRms(mask, residual),
      grid: gridScore(mask, residual, width, height)
    };
  }

  const worst = worstTiles(residual, width, height, inFront, behind);

  // The two pictures a reader needs to tell a dither from a texture: the worst tile with hair in
  // it, and the worst tile with none. Both at 8x, because the artefact is at the pixel scale and a
  // 32 px crop shown at 32 px is not something anybody can look at.
  const worstHair = worst.find((tile) => tile.hairShare > 0.9);
  const worstSkin = worst.find((tile) => tile.hairShare === 0);
  if (worstHair !== undefined) {
    writeZoom(path.join(options.out, `${arm}-worst-hair.png`), image, worstHair, 8);
  }
  if (worstSkin !== undefined) {
    writeZoom(path.join(options.out, `${arm}-worst-skin.png`), image, worstSkin, 8);
  }

  return { arm, path: path_, width, height, summary, worst };
}

/**
 * 1 where the 3x3 around a pixel is the SAME POPULATION as the pixel: same hair-or-not, same thing
 * behind. Every mask is intersected with it.
 *
 * 🚩 **STANDING RULE 4, AND IT COST THIS FILE A RED.** Without it the `backdrop` control — which
 * is supposed to be an empty region with no pixel-scale energy at all — read 0.43% speckle at 1.575
 * cv rms on all three arms, and the reason was not the instrument. The mask is cut from a CPU
 * raster that owns a pixel or does not; the renderer half-covers the pixels along the figure's
 * silhouette. So the "empty backdrop" contained a few thousand pixels of the figure's own outline,
 * where a large residual is an EDGE and not a defect. The same leak was in the other three masks,
 * flattering none of them consistently.
 *
 * A pixel at a genuine geometric boundary is supposed to disagree with its neighbours; that is what
 * an edge is. This statistic is about pixels that disagree where the geometry says they should not.
 */
function geometricallyStable(inFront, behind, width, height) {
  const stable = new Uint8Array(width * height);
  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const index = y * width + x;
      const hair = inFront[index] > 0 ? 1 : 0;
      let same = 1;
      for (let dy = -1; dy <= 1 && same; dy += 1) {
        for (let dx = -1; dx <= 1; dx += 1) {
          const neighbour = index + dy * width + dx;
          if ((inFront[neighbour] > 0 ? 1 : 0) !== hair || behind[neighbour] !== behind[index]) {
            same = 0;
            break;
          }
        }
      }
      stable[index] = same;
    }
  }
  return stable;
}

/** r = luma − mean of the 3x3 around it. Zero on any smooth ramp; large on a lone pixel. */
function highPass(luma, width, height) {
  const residual = new Float64Array(width * height);
  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      let total = 0;
      for (let dy = -1; dy <= 1; dy += 1) {
        for (let dx = -1; dx <= 1; dx += 1) total += luma[(y + dy) * width + x + dx];
      }
      residual[y * width + x] = luma[y * width + x] - total / 9;
    }
  }
  return residual;
}

function speckleShare(mask, residual) {
  let inside = 0;
  let over = 0;
  for (let index = 0; index < mask.length; index += 1) {
    if (mask[index] === 0) continue;
    inside += 1;
    if (Math.abs(residual[index]) > SPECKLE_THRESHOLD) over += 1;
  }
  return inside === 0 ? 0 : over / inside;
}

function residualRms(mask, residual) {
  let inside = 0;
  let total = 0;
  for (let index = 0; index < mask.length; index += 1) {
    if (mask[index] === 0) continue;
    inside += 1;
    total += residual[index] * residual[index];
  }
  return inside === 0 ? 0 : Math.sqrt(total / inside);
}

/**
 * The strongest axis-aligned PERIODICITY in the residual over a mask, with the lag that produced
 * it. Both members of a lagged pair must be inside the mask, so the number is about the region and
 * not about its boundary.
 *
 * 🚩 **IT IS `acf(lag) − acf(1)` AND NOT `acf(lag)`, BECAUSE A STRAIGHT EDGE IS NOT A CIRCUIT
 * BOARD AND THE FIRST VERSION COULD NOT TELL THEM APART.** Measured: the tile at (320, 288) — plain
 * forehead skin with the top edge of an EYEBROW crossing its bottom two rows — scored 0.9887 at
 * lag 2 on the raw autocorrelation, the highest in the frame, on all three arms and on `--defect
 * flat` alike. An axis-aligned edge correlates with itself at every lag along that axis, so the
 * raw statistic ranked the one thing in the picture that is supposed to be a hard line.
 *
 * A period-p pattern reverses: `acf(1)` is negative where `acf(p)` is positive. An edge does not:
 * both are high and the difference collapses. So the subtraction is the discriminator, and the
 * `checker` control is what proves it still finds a real grid — see DEFECTS.
 */
function gridScore(mask, residual, width, height) {
  const best = { score: 0, lag: 0, axis: 'none' };
  let variance = 0;
  let inside = 0;
  for (let index = 0; index < mask.length; index += 1) {
    if (mask[index] === 0) continue;
    variance += residual[index] * residual[index];
    inside += 1;
  }
  if (inside === 0 || variance === 0) return best;
  variance /= inside;

  const autocorrelation = (lag, axis) => {
    let total = 0;
    let count = 0;
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const bx = axis === 'x' ? x + lag : x;
        const by = axis === 'y' ? y + lag : y;
        if (bx >= width || by >= height) continue;
        const a = y * width + x;
        const b = by * width + bx;
        if (mask[a] === 0 || mask[b] === 0) continue;
        total += residual[a] * residual[b];
        count += 1;
      }
    }
    // 200 rather than a share of the mask: a 32 px tile is 1,024 px and a lag of 12 leaves ~640
    // pairs, so a floor near the mask size would silently return 0 for every tile. It did.
    return count < 200 ? null : (total / count) / variance;
  };

  for (const axis of ['x', 'y']) {
    const adjacent = autocorrelation(1, axis);
    if (adjacent === null) continue;
    for (let lag = GRID_MIN_LAG; lag <= GRID_MAX_LAG; lag += 1) {
      const value = autocorrelation(lag, axis);
      if (value === null) continue;
      const score = value - adjacent;
      if (score > best.score) {
        best.score = score;
        best.lag = lag;
        best.axis = axis;
      }
    }
  }
  return best;
}

/**
 * The frame in 32 px tiles, ranked by how much PERIODIC AXIS-ALIGNED energy each holds, with no
 * assumption about where the artefact is. A tile is reported with what the raster says is in it, so
 * "on the cheek" is a reading rather than a claim.
 *
 * ⚠️ **RANKED BY `grid × rms` AND NOT BY `rms`, BECAUSE `rms` FINDS CONTRAST AND CONTRAST IS NOT
 * THE DEFECT.** The first version ranked on rms alone and its top tile, on every arm, was (352,352)
 * — which is an EYELASH. Looked at at 8x it is a lid, a lash line and a catchlight, and every one
 * of those is supposed to have pixel-scale energy in it. A circuit board is not "busy"; it is
 * REGULAR, and the product is what says so.
 */
function worstTiles(residual, width, height, inFront, behind) {
  const size = 32;
  const tiles = [];
  for (let ty = 0; ty + size <= height; ty += size) {
    for (let tx = 0; tx + size <= width; tx += size) {
      let total = 0;
      let hair = 0;
      let figure = 0;
      for (let y = ty; y < ty + size; y += 1) {
        for (let x = tx; x < tx + size; x += 1) {
          const index = y * width + x;
          total += residual[index] * residual[index];
          if (inFront[index] > 0) hair += 1;
          if (behind[index] === 2) figure += 1;
        }
      }
      const area = size * size;
      const rms = Math.sqrt(total / area);
      const grid = tileGrid(residual, width, tx, ty, size);
      tiles.push({
        x: tx, y: ty,
        rms,
        grid,
        // The rank. A tile is a circuit board when it is BOTH regular and visible; either alone is
        // a smooth ramp or an eyelash.
        score: rms * Math.max(0, grid.score),
        hairShare: hair / area,
        figureShare: figure / area
      });
    }
  }
  tiles.sort((a, b) => b.score - a.score);
  return tiles.slice(0, 8);
}

/**
 * `gridScore` inside one tile, without allocating a frame-sized mask for each of a thousand.
 *
 * Same `acf(lag) − acf(1)` as `gridScore`, and for the same reason — the tile that made that
 * subtraction necessary was found by THIS function.
 */
function tileGrid(residual, width, tx, ty, size) {
  let variance = 0;
  for (let y = ty; y < ty + size; y += 1) {
    for (let x = tx; x < tx + size; x += 1) {
      const value = residual[y * width + x];
      variance += value * value;
    }
  }
  variance /= size * size;
  const best = { score: 0, lag: 0, axis: 'none' };
  if (variance === 0) return best;

  const autocorrelation = (lag, axis) => {
    let total = 0;
    let count = 0;
    for (let y = ty; y < ty + size - (axis === 'y' ? lag : 0); y += 1) {
      for (let x = tx; x < tx + size - (axis === 'x' ? lag : 0); x += 1) {
        const a = y * width + x;
        const b = (axis === 'y' ? y + lag : y) * width + (axis === 'x' ? x + lag : x);
        total += residual[a] * residual[b];
        count += 1;
      }
    }
    return count < 200 ? null : (total / count) / variance;
  };

  for (const axis of ['x', 'y']) {
    const adjacent = autocorrelation(1, axis);
    if (adjacent === null) continue;
    for (let lag = GRID_MIN_LAG; lag <= GRID_MAX_LAG; lag += 1) {
      const value = autocorrelation(lag, axis);
      if (value === null) continue;
      const score = value - adjacent;
      if (score > best.score) {
        best.score = score;
        best.lag = lag;
        best.axis = axis;
      }
    }
  }
  return best;
}

function report(measured, options) {
  const failures = [];

  for (const arm of measured) {
    console.log(`\n=== ?hairoit=${arm.arm} ===`);
    console.log('  coverage path as the page built it:');
    for (const [key, value] of Object.entries(arm.path)) {
      console.log(`    ${key.padEnd(22)} ${value}`);
    }

    console.log('  region                 px      speckle    rms cv    grid (lag, axis)');
    for (const [name, entry] of Object.entries(arm.summary)) {
      console.log(`    ${name.padEnd(10)} ${String(entry.pixels).padStart(9)}` +
        `   ${(entry.speckle * 100).toFixed(2).padStart(7)}%` +
        `   ${entry.rms.toFixed(3).padStart(7)}` +
        `   ${entry.grid.score.toFixed(4).padStart(7)} (${entry.grid.lag}, ${entry.grid.axis})`);
    }

    console.log('  worst 32 px tiles by rms x grid — regular AND visible:');
    for (const tile of arm.worst) {
      console.log(`    (${String(tile.x).padStart(4)},${String(tile.y).padStart(4)})` +
        `  score ${tile.score.toFixed(2).padStart(6)}` +
        `  rms ${tile.rms.toFixed(3).padStart(7)}` +
        `  hair ${(tile.hairShare * 100).toFixed(0).padStart(3)}%` +
        `  figure ${(tile.figureShare * 100).toFixed(0).padStart(3)}%` +
        `  grid ${tile.grid.score.toFixed(4)} (${tile.grid.lag}, ${tile.grid.axis})`);
    }

    // L0 — a statistic over a mask that holds nothing is an absence, not a green.
    for (const [name, entry] of Object.entries(arm.summary)) {
      if (entry.pixels >= MINIMUM_MASK_PIXELS) continue;
      failures.push(`${arm.arm} liveness L0: the ${name} mask is ${entry.pixels} px, under the ` +
        `${MINIMUM_MASK_PIXELS} floor, so every number over it says nothing`);
    }

    // L1 — the floor. Every statistic here is a residual, and the page has one even where there is
    // no geometry: `backdrop` reads 1.40 cv rms and 0.31% speckle on all three arms. That is the
    // instrument, and a region under test has to clear it by a factor or its number IS the floor.
    const floor = arm.summary.backdrop;
    // `checker` raises the floor everywhere by construction, so L1 is a reading on that run and a
    // clause on every other one — the same shape as `hair_opacity.mjs`'s `curtain: false` view.
    const live = arm.summary.tips.rms >= floor.rms * FLOOR_MARGIN;
    console.log(`  ${options.defect !== 'none' ? '--  ' : (live ? 'ok  ' : 'FAIL')} ` +
      `L1 above the floor  tips rms ${
      arm.summary.tips.rms.toFixed(3)} against the empty backdrop's ${floor.rms.toFixed(3)} ` +
      `(needs ${FLOOR_MARGIN}x)`);
    if (options.defect === 'none' && live === false) {
      failures.push(`${arm.arm} liveness L1: the tips read ${arm.summary.tips.rms.toFixed(3)} cv ` +
        `rms against an empty backdrop's ${floor.rms.toFixed(3)} — under ${FLOOR_MARGIN}x the ` +
        'floor, so T1 is measuring the instrument rather than the coverage path');
    }

    if (arm.arm !== SHIPPED_ARM) continue;

    const t1 = arm.summary.tips.speckle <= CEILINGS.tipSpeckle;
    console.log(`  ${t1 ? 'ok  ' : 'FAIL'} T1 the tips        speckle ${
      (arm.summary.tips.speckle * 100).toFixed(2)}% over ${
      arm.summary.tips.pixels.toLocaleString()} px (ceiling ${
      (CEILINGS.tipSpeckle * 100).toFixed(2)}%)`);
    if (t1 === false) {
      failures.push(`${arm.arm} leaves ${(arm.summary.tips.speckle * 100).toFixed(2)}% of the ` +
        'tip fringe disagreeing with its own neighbourhood by more than ' +
        `${SPECKLE_THRESHOLD} cv, past the ${(CEILINGS.tipSpeckle * 100).toFixed(2)}% ceiling — ` +
        'that is the confetti a critic named');
    }

    const t2 = arm.summary.curtain.speckle <= CEILINGS.curtainSpeckle;
    console.log(`  ${t2 ? 'ok  ' : 'FAIL'} T2 the cheek       speckle ${
      (arm.summary.curtain.speckle * 100).toFixed(2)}% where the groom is 1-2 cards deep over the ` +
      `figure, over ${arm.summary.curtain.pixels.toLocaleString()} px (ceiling ${
      (CEILINGS.curtainSpeckle * 100).toFixed(2)}%)`);
    if (t2 === false) {
      failures.push(`${arm.arm} leaves ${(arm.summary.curtain.speckle * 100).toFixed(2)}% of the ` +
        'hair-over-skin curtain as pixels disagreeing with their neighbourhood — the ' +
        'circuit-board mottle on the cheek');
    }
  }

  // 🚩 STANDING RULE 5, THE OTHER DIRECTION: a ceiling nothing can reach is not a ceiling, it is a
  // permanent red dressed as a clause. This says whether any arm measured in this run clears it.
  const clears = measured.filter((entry) => entry.summary.tips.speckle <= CEILINGS.tipSpeckle);
  console.log(`\n  --   T1 is satisfiable: ${clears.length === 0
    ? 'NO ARM IN THIS RUN clears the ceiling — re-run with --arms including blend before trusting it'
    : `${clears.map((entry) => `${entry.arm} ${(entry.summary.tips.speckle * 100).toFixed(2)}%`)
      .join(', ')} under ${(CEILINGS.tipSpeckle * 100).toFixed(2)}%`}`);

  return failures;
}

// --- the page side -------------------------------------------------------------------------------

/**
 * Installs `globalThis.__hairTips`, which reads the coverage path off the built material and
 * rasterises the groom and the figure from the live camera.
 *
 * The raster is `hair_opacity.mjs`'s, narrowed: this file needs the hair's crossing count and
 * whether the nearest thing behind a pixel is the FIGURE or the BACKDROP, and does not need the
 * head-bone tag or the strip bits that C4 is built on.
 */
async function installProbe(page, defect) {
  await page.evaluate((plantedDefect) => {
    const stage = globalThis.sugata.stage;

    let hair = null;
    const behindMeshes = [];
    stage.scene.traverse((object) => {
      if (object.isMesh !== true) return;
      if (object.material?.name === 'sugata.hair') hair = object;
      else behindMeshes.push(object);
    });
    if (hair === null) throw new Error('hair_tips: no mesh carries the `sugata.hair` material.');

    // 🚩 `flat`: the atlas stops deciding coverage. `colorNode` is what `HairMaterial` built and
    // `HairOIT` reads, so overwriting the map alone would leave the node graph sampling it.
    if (plantedDefect === 'flat') {
      hair.material.colorNode = null;
      hair.material.map = null;
      hair.material.alphaMap = null;
      hair.material.transparent = false;
      hair.material.alphaTest = 0;
      hair.material.needsUpdate = true;
    }

    // `checker` is planted on the decoded plate rather than here — see DEFECTS for why, and for
    // what that costs it as a proof.

    globalThis.__hairTips = {
      /**
       * What the coverage path IS, read off the objects the page built rather than off the URL.
       * This is the answer to the HUD line: `alphaToCoverage` is a request that needs a
       * multisampled target, and `samples` is whether there is one.
       */
      coveragePath: () => {
        const renderer = stage.renderer;
        return {
          hairOITMode: stage.hairOIT?.mode ?? '(no hairOIT on the stage)',
          multisampled: String(globalThis.sugata.session?.multisampled),
          rendererSamples: String(renderer.samples ?? '(unset)'),
          materialAlphaToCoverage: String(hair.material.alphaToCoverage),
          materialAlphaTest: String(hair.material.alphaTest),
          materialAlphaHash: String(hair.material.alphaHash),
          materialTransparent: String(hair.material.transparent),
          materialDepthWrite: String(hair.material.depthWrite),
          hasAlphaTestNode: String(hair.material.alphaTestNode !== null
            && hair.material.alphaTestNode !== undefined),
          hasColorNode: String(hair.material.colorNode !== null
            && hair.material.colorNode !== undefined)
        };
      },

      raster: () => {
        const camera = stage.camera;
        const Vector3 = camera.position.constructor;
        const Matrix4 = camera.matrixWorld.constructor;
        camera.updateMatrixWorld(true);
        camera.updateProjectionMatrix();

        const canvas = stage.renderer.domElement;
        const width = canvas.clientWidth || canvas.width;
        const height = canvas.clientHeight || canvas.height;
        const viewProjection = new Matrix4().multiplyMatrices(
          camera.projectionMatrix, camera.matrixWorldInverse);

        const project = (mesh) => {
          mesh.updateMatrixWorld(true);
          const position = mesh.geometry.attributes.position;
          const screen = new Float32Array(position.count * 3);
          const point = new Vector3();
          const matrix = new Matrix4().multiplyMatrices(viewProjection, mesh.matrixWorld);
          for (let index = 0; index < position.count; index += 1) {
            point.fromBufferAttribute(position, index);
            if (mesh.isSkinnedMesh === true) mesh.applyBoneTransform(index, point);
            point.applyMatrix4(matrix);
            screen[index * 3] = (point.x * 0.5 + 0.5) * width;
            screen[index * 3 + 1] = (1 - (point.y * 0.5 + 0.5)) * height;
            screen[index * 3 + 2] = point.z;
          }
          return screen;
        };

        const rasterise = (screen, mesh, visit) => {
          const indices = mesh.geometry.index;
          const triangles = indices
            ? indices.count / 3
            : mesh.geometry.attributes.position.count / 3;
          for (let triangle = 0; triangle < triangles; triangle += 1) {
            const a = indices ? indices.getX(triangle * 3) : triangle * 3;
            const b = indices ? indices.getX(triangle * 3 + 1) : triangle * 3 + 1;
            const c = indices ? indices.getX(triangle * 3 + 2) : triangle * 3 + 2;
            const ax = screen[a * 3], ay = screen[a * 3 + 1], az = screen[a * 3 + 2];
            const bx = screen[b * 3], by = screen[b * 3 + 1], bz = screen[b * 3 + 2];
            const cx = screen[c * 3], cy = screen[c * 3 + 1], cz = screen[c * 3 + 2];
            const minX = Math.max(0, Math.floor(Math.min(ax, bx, cx)));
            const maxX = Math.min(width - 1, Math.ceil(Math.max(ax, bx, cx)));
            const minY = Math.max(0, Math.floor(Math.min(ay, by, cy)));
            const maxY = Math.min(height - 1, Math.ceil(Math.max(ay, by, cy)));
            if (minX > maxX || minY > maxY) continue;
            const area = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
            if (area === 0) continue;
            for (let y = minY; y <= maxY; y += 1) {
              for (let x = minX; x <= maxX; x += 1) {
                const px = x + 0.5, py = y + 0.5;
                const w0 = ((bx - px) * (cy - py) - (by - py) * (cx - px)) / area;
                const w1 = ((cx - px) * (ay - py) - (cy - py) * (ax - px)) / area;
                const w2 = 1 - w0 - w1;
                if (w0 < 0 || w1 < 0 || w2 < 0) continue;
                visit(y * width + x, w0 * az + w1 * bz + w2 * cz);
              }
            }
          }
        };

        // 0 nothing, 1 the backdrop, 2 the figure — whichever is NEAREST at the pixel.
        const behindZ = new Float32Array(width * height).fill(Infinity);
        const behind = new Uint8Array(width * height);
        for (const mesh of behindMeshes) {
          if (mesh.name === 'ground') continue;
          const kind = mesh.name === 'backdrop' ? 1 : 2;
          rasterise(project(mesh), mesh, (index, z) => {
            if (z >= behindZ[index]) return;
            behindZ[index] = z;
            behind[index] = kind;
          });
        }

        const inFront = new Uint8Array(width * height);
        rasterise(project(hair), hair, (index, z) => {
          if (z < behindZ[index] && inFront[index] < 255) inFront[index] += 1;
        });

        const encode = (bytes) => {
          let binary = '';
          for (let index = 0; index < bytes.length; index += 1) {
            binary += String.fromCharCode(bytes[index]);
          }
          return btoa(binary);
        };

        return { width, height, inFront: encode(inFront), behind: encode(behind) };
      }
    };
  }, defect);
}

async function openPage(browser, url) {
  const context = await browser.newContext({
    viewport: { width: 900, height: 1200 },
    deviceScaleFactor: 1,
    colorScheme: 'dark',
    reducedMotion: 'no-preference'
  });
  const page = await context.newPage();
  const problems = [];
  page.on('pageerror', (error) => problems.push(error.message));

  console.log(url);
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof globalThis.__SUGATA_STEP__ === 'function', null,
    { timeout: 120000, polling: 200 }).catch(() => {
    throw new Error(`page never exposed __SUGATA_STEP__.${problems.length > 0
      ? ` page errors: ${problems.join('; ')}` : ''}`);
  });
  await page.evaluate(() => globalThis.__SUGATA_STEP__(0));

  return page;
}

/** `hair_opacity.mjs`'s converge, and for its reason: the stochastic arm has to be averaged. */
async function converge(page, count) {
  for (let step = 0; step < count; step += 1) {
    await page.evaluate(() => globalThis.__SUGATA_STEP__(0));
  }
}

async function screenshot(page, file) {
  const png = await page.screenshot({ timeout: 60000 });
  if (file !== null) fs.writeFileSync(file, png);
  return decodePng(png);
}

// --- arithmetic ------------------------------------------------------------------------------------

/**
 * Rec.709 luma in the frame's OWN encoding, 0..255.
 *
 * ⚠️ Not linearised, and that is the opposite of `hair_opacity.mjs`'s choice for a reason. That
 * file differences two plates and needs light to add up. This one asks whether a pixel differs
 * VISIBLY from its neighbours, and visibility is a property of the display encoding — a 10 cv step
 * in the shadows is the same step to the eye as one in the highlights, which is what the sRGB
 * curve is for and what linear light would throw away.
 *
 * ⚠️ `decodePng` hands back a Float32Array NORMALISED TO 0..1, not bytes — `expandToRgba` divides
 * by the bit depth's maximum. The 255 here is what turns it back into the code values every
 * threshold in this file is written in, and leaving it out is not a scale error that cancels: it
 * put `SPECKLE_THRESHOLD` 255x out of reach and every speckle share read exactly 0.00%.
 */
function luma255(image) {
  const pixels = image.width * image.height;
  const luma = new Float64Array(pixels);
  for (let index = 0; index < pixels; index += 1) {
    luma[index] = 255 * (0.2126 * image.pixels[index * 4]
      + 0.7152 * image.pixels[index * 4 + 1]
      + 0.0722 * image.pixels[index * 4 + 2]);
  }
  return luma;
}

/**
 * The `checker` control's known signal: ±10 cv on a 4 px period, in both axes. See DEFECTS.
 *
 * 4 rather than 2 because a 2 px checker is at Nyquist and the 3x3 high-pass below partly cancels
 * it — the control would then be testing the filter's null rather than the detector's reach.
 */
function plantChecker(luma, width, height) {
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const sign = ((x % 4 < 2) === (y % 4 < 2)) ? 1 : -1;
      luma[y * width + x] += sign * 10;
    }
  }
}

function countOf(mask) {
  let count = 0;
  for (let index = 0; index < mask.length; index += 1) count += mask[index];
  return count;
}

/** |r| as a grey, so the confetti can be looked at rather than only counted. */
function writeResidual(file, width, height, residual) {
  const rgba = Buffer.alloc(width * height * 4);
  for (let index = 0; index < width * height; index += 1) {
    const value = Math.min(255, Math.round(Math.abs(residual[index]) * 6));
    rgba[index * 4] = value;
    rgba[index * 4 + 1] = value;
    rgba[index * 4 + 2] = value;
    rgba[index * 4 + 3] = 255;
  }
  fs.writeFileSync(file, encodePng(width, height, rgba));
}

/** A 32 px tile of the plate at `scale`x, nearest neighbour, so the pixel grid stays a pixel grid. */
function writeZoom(file, image, tile, scale) {
  const size = 32;
  const out = size * scale;
  const rgba = Buffer.alloc(out * out * 4);
  for (let y = 0; y < out; y += 1) {
    for (let x = 0; x < out; x += 1) {
      const source = ((tile.y + Math.floor(y / scale)) * image.width
        + tile.x + Math.floor(x / scale)) * 4;
      const target = (y * out + x) * 4;
      for (let channel = 0; channel < 3; channel += 1) {
        rgba[target + channel] = Math.round(255 * image.pixels[source + channel]);
      }
      rgba[target + 3] = 255;
    }
  }
  fs.writeFileSync(file, encodePng(out, out, rgba));
}

// --- plumbing ----------------------------------------------------------------------------------

function parseArguments(argv) {
  const options = {
    out: path.join(REPO_ROOT, 'captures', 'hair-tips'),
    url: null,
    steps: 24,
    defect: 'none',
    arms: ['stochastic']
  };
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === '--out') options.out = path.resolve(argv[index + 1]);
    if (argv[index] === '--url') options.url = argv[index + 1];
    if (argv[index] === '--steps') options.steps = Number(argv[index + 1]);
    if (argv[index] === '--defect') options.defect = argv[index + 1];
    if (argv[index] === '--arms') options.arms = argv[index + 1].split(',');
  }
  return options;
}

/** Starts the repo's own vite and waits for it to say which port it took. `hair_shots.mjs`'s. */
function startVite() {
  return new Promise((resolve, reject) => {
    const child = spawn('npx', ['vite', '--port', '0', '--strictPort=false'], {
      cwd: REPO_ROOT,
      stdio: ['ignore', 'pipe', 'pipe']
    });

    const stop = () => child.kill('SIGTERM');
    const timer = setTimeout(() => {
      stop();
      reject(new Error('vite did not report a URL within 60 s'));
    }, 60000);

    child.stdout.setEncoding('utf8');
    child.stdout.on('data', (chunk) => {
      const match = /(http:\/\/localhost:\d+)/.exec(chunk);
      if (match !== null) {
        clearTimeout(timer);
        resolve({ origin: match[1], stop });
      }
    });
    child.on('error', reject);
  });
}

async function loadPlaywright() {
  const candidates = ['playwright'];
  const cache = path.join(process.env.HOME ?? '', '.npm', '_npx');
  if (fs.existsSync(cache)) {
    for (const entry of fs.readdirSync(cache)) {
      const candidate = path.join(cache, entry, 'node_modules', 'playwright');
      if (fs.existsSync(candidate)) candidates.push(candidate);
    }
  }

  const require = createRequire(import.meta.url);
  for (const candidate of candidates) {
    try {
      const namespace = await import(pathToFileURL(require.resolve(candidate)).href);
      return namespace.chromium ? namespace : namespace.default;
    } catch {
      // next candidate; only the last failure matters
    }
  }

  throw new Error('playwright not resolvable. See tools/critic/capture.mjs --playwright.');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
