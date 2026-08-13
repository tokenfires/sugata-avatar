#!/usr/bin/env node
//
// hair_opacity.mjs — how much of what is BEHIND the groom still reaches the camera.
//
// ## Why this exists when `verify_glb.mjs` already passes the groom
//
// A blind critic on the composed portrait: *"Neither hair nor a wig — a stocking. My first read was
// 'she's got a dark nylon pulled over her head'… You can see the bald skull's silhouette through
// it, you can see her far-side ear through it, and from a rear three-quarter you can read her nose
// and eye socket."* Every clause in `verify_glb.mjs` was green over the top of that, and none of
// them could have caught it: they measure the exported FILE — card counts, UV strips, clearance,
// cranium coverage through the cutout — and a groom's opacity is a property of the rendered frame.
// Even the cranium-coverage clause, which is the nearest thing to this, casts rays at the SCALP and
// is structurally blind to the two thirds of the groom that hang below the hairline.
//
// So this measures the picture, on `alive.html`, at the two framings the critic named.
//
// ## 🎯 The measurement, and why it is a transmittance rather than a difference
//
// A bald-plate difference — hair on against hair off — cannot separate "the hair is opaque" from
// "the hair happens to be the same colour as the skin behind it". What this does instead is put a
// STEP into everything that is not hair and watch how much of the step survives the groom:
//
//     T(pixel) = ( hair-on with the step − hair-on without ) / ( hair-off with − hair-off without )
//
// both differences taken in LINEAR light off the screenshot's own luma. The denominator is the
// same step measured with the groom hidden, so T is the share of the light from behind that gets
// through: 1.0 is glass, 0.0 is paint. The step is `material.emissive` on every non-hair mesh in
// the scene — the body, the eyes, the lashes, the brows AND the backdrop — so the statistic covers
// hair over skin and hair over background with one number and one mask.
//
// 🚩 **THE MASK IS A RASTER OF THE GROOM'S OWN TRIANGLES, NOT A THRESHOLD ON THE PICTURE.** Standing
// rule 4, and this project has paid for it before: a mask taken as "pixels where the hair plate
// differs from the bald plate" contains only the pixels where the hair is ALREADY opaque, so the
// transmittance measured over it would improve as the groom got worse. The mask here is the hair
// mesh projected with the live camera and the live skinning, rasterised on the CPU, and it contains
// every pixel the groom covers whatever its alpha does. `inFront` counts only the hair triangles
// NEARER than the closest non-hair surface, because a card behind the skull is not something a
// viewer can see through.
//
// ## The clauses, and the liveness control on each
//
//   C1  mean T over the hair's screen footprint
//   C2  the share of that footprint with T > 0.5 — "you can read what is behind it here"
//   C3  mean T where the groom is three or more cards deep — THE MASS, as opposed to its outline
//   L0  every mask above has to hold pixels at all. See MINIMUM_MASK_PIXELS.
//
// ⚠️ **C3 WAS `T AT ONE CARD CROSSING` FOR ONE ROUND AND THAT CLAUSE WAS MEASURING THE WRONG
// THING.** A pixel with exactly one card in front of it is at the silhouette, and the card there is
// carrying `hair_texture`'s wisp strips, whose whole job is to be mostly transparent so that the
// outline of a card is the outline of a few hairs. Measured: fixing the mass moved one-crossing
// transmittance 0.8229 -> 0.7306 on the portrait and 0.8394 -> 0.8244 on the rear three-quarter,
// while the same change moved the mass at three crossings 0.4240 -> 0.2468 and 0.4257 -> 0.3316.
// A clause on the first pair would have failed the fix and passed the defect; the per-crossing
// table is still printed, because it is the diagnosis, and it is not gated.
//   L1  T outside the footprint must be 1.0. If it is not, the probe is not measuring a step.
//   L2  T over the footprint with the GROOM HIDDEN must be 1.0. If it is not, the mask is not
//       where the hair is.
//
// 🚩 L1 and L2 are the answer to §1.25g. C1–C3 are all ratios against the same denominator, so a
// probe that silently stopped stepping anything would make numerator and denominator agree at 0/0
// and could be read as any number at all; L1 and L2 are computed from the same two plates and go
// red the moment the step stops being a step. They are asserted rather than reported.
//
//   node tools/figure-pipeline/hair_opacity.mjs
//   node tools/figure-pipeline/hair_opacity.mjs --out captures/hair-opacity --steps 24
//   node tools/figure-pipeline/hair_opacity.mjs --defect glass    # the red proof, see DEFECTS
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
 * The two framings the critic named, as a yaw applied to the FIGURE rather than to the camera.
 *
 * Turning the figure keeps `alive.js`'s own portrait framing, its own camera and its own
 * camera-relative lighting rig exactly as shipped; orbiting the camera instead would light the back
 * of the head from the front and measure a picture nobody will ever see.
 */
const VIEWS = [
  { name: 'portrait', yaw: 0 },
  { name: 'rear34', yaw: 145 }
];

/**
 * The emissive step, in the material's own units. Far enough apart that the denominator clears the
 * floor below over the whole frame, small enough that the high plate is not clipped white — a
 * clipped denominator would read as an opaque groom, which is the direction that flatters.
 */
const STEP_LOW = 0.0;
const STEP_HIGH = 0.75;

/** Denominator floor. Below this the pixel is not carrying the step and is not measured. */
const DENOMINATOR_FLOOR = 0.01;

/**
 * The ceilings, every one of them read off a run in this table and none of them chosen.
 *
 * Measured on `alive.html` at 900x1200 dpr 1, 24 converged steps of `?bare&freeze&capture&seed=1&
 * grain=0&hair=1&shadows=0&grade=0`, portrait / rear three-quarter:
 *
 *   |            | shipped groom (the defect) | `--defect oneside` |   as fixed   | ceiling |
 *   |------------|---------------------------:|-------------------:|-------------:|--------:|
 *   | C1 mean T  |         0.3989 / 0.1735    |   0.2750 / 0.1984  | 0.2488/0.0950|    0.28 |
 *   | C2 T > 0.5 |         37.17% / 15.38%    |   26.99% / 19.92%  | 24.30%/9.40% |     28% |
 *   | C3 the mass|         0.2476 / 0.0692    |   0.1071 / 0.1209  | 0.0807/0.0228|    0.10 |
 *
 * 🎯 **C3 IS THE LOAD-BEARING CLAUSE AND THE OTHER TWO ARE NOT, AND THAT IS THE TABLE SAYING SO.**
 * Read the columns: C3 crosses its ceiling under BOTH red proofs and on BOTH views — 0.2476 for
 * the shipped groom's portrait, 0.1071 and 0.1209 for `oneside` — while the fix sits under it at
 * 0.0807 and 0.0228. C1 and C2 cross only on the portrait and only for the shipped groom; halving
 * the mass moves them (0.2488 -> 0.2750, 24.30% -> 26.99%) and does not take them over.
 *
 * ⚠️ **AND C3's PORTRAIT MARGIN IS NARROW: 0.0807 UNDER A CEILING A HALVED GROOM REACHES AT
 * 0.1071.** A third of the mass is all the headroom there is on that view, so a future change to
 * the style that trades interior coverage for anything else will trip this and should. It is
 * written down rather than widened, because widening it to a comfortable number would put the
 * ceiling above what `oneside` produces and the clause would stop being able to fail.
 *
 * The reason is in what the footprint contains. C1 and C2 are taken over EVERY hair pixel, and a
 * third of those are the silhouette fringe and the ends, which are one wisp card deep and which
 * are supposed to transmit — that is what a hair outline is. Their transmittance dominates the
 * mean and it barely responds to anything done to the interior. C3's mask is the pixels where the
 * groom is three or more cards deep, which is the mass a critic said they could see a skull
 * through, and it responds to exactly the thing this file is about.
 *
 * ⚠️ So C1 and C2 are gated at 0.28 — above the fix, below the shipped groom's portrait — as a
 * catch for a wholesale collapse, and they are NOT claimed to be sensitive. Neither of them is
 * proven live on the rear three-quarter by either red proof, and that is written here rather than
 * left for a reader to discover: on that view the verdict rests on C3.
 */
const CEILINGS = {
  meanTransmittance: 0.28,
  shareOverHalf: 0.28,
  massTransmittance: 0.10
};

/** Crossings at or above which the groom is a MASS rather than an outline. See C3's note. */
const MASS_CROSSINGS = 3;

/** How near 1.0 a liveness control has to read. */
const LIVENESS_FLOOR = 0.97;

/**
 * The smallest mask any clause is allowed to be computed over.
 *
 * 🚩 **THIS IS HERE BECAUSE `--defect nostep` GOT PAST L1 ON THE PORTRAIT.** With the emissive step
 * removed the denominator floor throws almost every pixel away, and the run came back with C1
 * −0.0794, C2 1.14% and C3 −0.0424 — three green clauses over a footprint of 3,035 px — and an L1
 * of 1.0000 computed over FIVE pixels. Five pixels can agree about anything. The rear three-quarter
 * happened to reach zero and went red on NaN, so half of one red proof caught what the other half
 * missed; the floor is what makes it not depend on that. Standing rule 4 in one constant: a
 * statistic over a mask that holds nothing is not a green, it is an absence.
 *
 * 20,000 px is under a twentieth of the 400,000–600,000 px every real mask in this file measures
 * and two orders over what a collapsed one does, so it separates the two without being a second
 * threshold on the groom.
 */
const MINIMUM_MASK_PIXELS = 20000;

/**
 * The red proofs, and each one breaks the picture at a DIFFERENT point in the chain so that a
 * clause staying green under one of them means something.
 *
 *   `oneside` the groom is drawn `FrontSide` instead of double sided, so every card the camera
 *             sees from behind stops covering anything. That is a genuine halving of the mass with
 *             no other change — the geometry, the atlas, the lighting and the framing are the
 *             groom's own — and it is the defect this file exists to catch, arriving through the
 *             one property of the hair draw that is raster state rather than shader.
 *   `nostep`  the emissive step is not applied. Nothing is being measured. C1–C3 read whatever
 *             0/0 happens to give and L1/L2 are what must catch it.
 *   `maskall` the footprint mask is every pixel in the frame rather than the groom's own. The
 *             statistic is then mostly backdrop, which transmits perfectly — the standing-rule-4
 *             failure, planted.
 *
 * 🚩 **`material.alphaTest` IS NOT A HANDLE ON THIS GROOM, AND THE FIRST VERSION OF `oneside` WAS
 * ONE.** Setting `hair.material.alphaTest = 0.995` — which should discard almost every hair
 * fragment — produced a run byte-comparable to the clean one: C1 0.2062 / C2 20.17% / C3 0.0526 on
 * the portrait, identical to four decimal places. `HairOIT`'s shipped `stochastic` arm makes the
 * coverage decision in its own node and clears `alphaTest`, which that file's own header records
 * for three of its four arms. A red proof that changes nothing looks exactly like a gate that
 * cannot fail; this one is kept in the header rather than deleted, because the next person to
 * reach for `alphaTest` here will reach for it for the same reason.
 */
const DEFECTS = ['none', 'oneside', 'nostep', 'maskall'];

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
  const url = `${options.url ?? `${server.origin}/alive.html`}` +
    '?bare&freeze&capture&seed=1&grain=0&hair=1&shadows=0&grade=0';

  const browser = await playwright.chromium.launch({
    channel: 'chromium',
    headless: true,
    args: ['--enable-unsafe-webgpu', '--ignore-gpu-blocklist', '--hide-scrollbars']
  });

  const failures = [];

  try {
    const page = await openPage(browser, url);
    await installProbe(page, options.defect);

    for (const view of VIEWS) {
      const measured = await measureView(page, view, options);
      failures.push(...report(view, measured));
    }
  } finally {
    await browser.close();
    if (server !== null) server.stop();
  }

  console.log('');
  if (failures.length > 0) {
    for (const failure of failures) console.log(`FAIL ${failure}`);
    console.log(`\nFAIL — ${failures.length} clause(s) red.`);
    process.exitCode = 1;
    return;
  }
  console.log('PASS — the groom is opaque at both framings.');
}

// --- the measurement -----------------------------------------------------------------------------

async function measureView(page, view, options) {
  await page.evaluate((yaw) => globalThis.__hairOpacity.setYaw(yaw), view.yaw);

  // The picture a human looks at, taken before anything is stepped so the file on disk is the
  // groom rather than the probe.
  await page.evaluate(() => globalThis.__hairOpacity.restore());
  await page.evaluate(() => globalThis.__hairOpacity.setHairVisible(true));
  await converge(page, options.steps);
  await screenshot(page, path.join(options.out, `${view.name}-hair.png`));
  await page.evaluate(() => globalThis.__hairOpacity.setHairVisible(false));
  await converge(page, options.steps);
  await screenshot(page, path.join(options.out, `${view.name}-bald.png`));
  await page.evaluate(() => globalThis.__hairOpacity.setHairVisible(true));

  const raster = await page.evaluate(() => globalThis.__hairOpacity.raster());
  const { width, height } = raster;
  const pixels = width * height;
  const inFront = Buffer.from(raster.inFront, 'base64');
  const total = Buffer.from(raster.total, 'base64');

  const plates = {};
  for (const hairOn of [true, false]) {
    for (const step of [STEP_LOW, STEP_HIGH]) {
      await page.evaluate((request) => {
        globalThis.__hairOpacity.setHairVisible(request.hairOn);
        globalThis.__hairOpacity.setStep(request.step);
      }, { hairOn, step });
      await converge(page, options.steps);
      plates[`${hairOn ? 'hair' : 'bald'}${step === STEP_LOW ? 'Low' : 'High'}`] =
        linearLuma(await screenshot(page, null));
    }
  }
  await page.evaluate(() => globalThis.__hairOpacity.restore());

  const numerator = new Float64Array(pixels);
  const denominator = new Float64Array(pixels);
  for (let index = 0; index < pixels; index += 1) {
    numerator[index] = plates.hairHigh[index] - plates.hairLow[index];
    denominator[index] = plates.baldHigh[index] - plates.baldLow[index];
  }

  const carriesStep = new Uint8Array(pixels);
  for (let index = 0; index < pixels; index += 1) {
    carriesStep[index] = denominator[index] > DENOMINATOR_FLOOR ? 1 : 0;
  }

  const footprint = new Uint8Array(pixels);
  const outside = new Uint8Array(pixels);
  for (let index = 0; index < pixels; index += 1) {
    const covered = options.defect === 'maskall' ? 1 : (inFront[index] > 0 ? 1 : 0);
    footprint[index] = covered && carriesStep[index] ? 1 : 0;
    outside[index] = total[index] === 0 && carriesStep[index] ? 1 : 0;
  }

  // L2's mask is the footprint with the groom hidden, which is the SAME pixels measured against a
  // frame the hair never reached: numerator and denominator are then the same plate pair and the
  // ratio is 1 by construction unless the mask has drifted off the hair.
  const hidden = new Float64Array(pixels);
  for (let index = 0; index < pixels; index += 1) {
    hidden[index] = denominator[index] === 0 ? 0 : denominator[index] / denominator[index];
  }

  const mass = new Uint8Array(pixels);
  for (let index = 0; index < pixels; index += 1) {
    mass[index] = footprint[index] && inFront[index] >= MASS_CROSSINGS ? 1 : 0;
  }

  writeHeatmap(path.join(options.out, `${view.name}-transmittance.png`),
    width, height, footprint, numerator, denominator);

  return {
    footprintPixels: countOf(footprint),
    all: summarise(footprint, numerator, denominator),
    mass: summarise(mass, numerator, denominator),
    outside: summarise(outside, denominator, denominator),
    hidden: summarise(footprint, hidden, new Float64Array(pixels).fill(1)),
    byCrossing: byCrossing(footprint, inFront, numerator, denominator)
  };
}

function summarise(mask, numerator, denominator) {
  const values = [];
  for (let index = 0; index < mask.length; index += 1) {
    if (mask[index]) values.push(numerator[index] / denominator[index]);
  }
  values.sort((a, b) => a - b);
  const quantile = (at) =>
    (values.length === 0 ? NaN : values[Math.min(values.length - 1, Math.floor(at * values.length))]);
  const share = (above) => values.filter((value) => value > above).length / values.length;

  return {
    pixels: values.length,
    mean: values.reduce((total, value) => total + value, 0) / values.length,
    median: quantile(0.5),
    p90: quantile(0.9),
    overHalf: share(0.5)
  };
}

/** Mean T for pixels crossed by exactly `k` cards, which is the per-card alpha stated as a curve. */
function byCrossing(mask, inFront, numerator, denominator) {
  const bins = new Map();
  for (let index = 0; index < mask.length; index += 1) {
    if (mask[index] === 0) continue;
    const crossings = inFront[index];
    if (bins.has(crossings) === false) bins.set(crossings, []);
    bins.get(crossings).push(numerator[index] / denominator[index]);
  }

  return [...bins.keys()].sort((a, b) => a - b).filter((k) => k >= 1 && k <= 4)
    .map((crossings) => {
      const values = bins.get(crossings);
      const mean = values.reduce((total, value) => total + value, 0) / values.length;
      return {
        crossings,
        pixels: values.length,
        mean,
        // What one card's alpha would have to be for k of them to transmit this much.
        impliedAlpha: 1 - Math.pow(Math.max(mean, 1e-6), 1 / crossings)
      };
    });
}

function report(view, measured) {
  const failures = [];
  const clause = (ok, line) => console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${line}`);

  console.log('');
  console.log(`--- ${view.name} (figure yawed ${view.yaw}°) ---`);
  console.log(`  --   footprint         ${measured.footprintPixels.toLocaleString()} px of hair in ` +
    'front of a surface that carries the step');

  // L0 first, because every clause under it is a statistic over one of these masks.
  const smallest = Math.min(measured.all.pixels, measured.mass.pixels, measured.outside.pixels);
  const l0 = smallest >= MINIMUM_MASK_PIXELS;
  clause(l0, `L0 masks hold pixels  smallest of footprint/mass/outside is ` +
    `${smallest.toLocaleString()} px (floor ${MINIMUM_MASK_PIXELS.toLocaleString()})`);
  if (l0 === false) {
    failures.push(`${view.name} liveness L0: a clause below is computed over ` +
      `${smallest.toLocaleString()} px, under the ${MINIMUM_MASK_PIXELS.toLocaleString()} floor — ` +
      'the mask holds nothing and its greens mean nothing');
  }

  const c1 = measured.all.mean <= CEILINGS.meanTransmittance;
  clause(c1, `C1 mean transmittance ${measured.all.mean.toFixed(4)} ` +
    `(median ${measured.all.median.toFixed(4)}, p90 ${measured.all.p90.toFixed(4)}, ` +
    `ceiling ${CEILINGS.meanTransmittance})`);
  if (c1 === false) {
    failures.push(`${view.name} mean transmittance ${measured.all.mean.toFixed(4)} over the ` +
      `${CEILINGS.meanTransmittance} ceiling — the mass is not opaque`);
  }

  const c2 = measured.all.overHalf <= CEILINGS.shareOverHalf;
  clause(c2, `C2 share over T>0.5   ${(measured.all.overHalf * 100).toFixed(2)}% of the footprint ` +
    `(ceiling ${(CEILINGS.shareOverHalf * 100).toFixed(0)}%) — where a viewer reads what is behind`);
  if (c2 === false) {
    failures.push(`${view.name} has ${(measured.all.overHalf * 100).toFixed(2)}% of its hair ` +
      `footprint transmitting over half, past the ${(CEILINGS.shareOverHalf * 100).toFixed(0)}% ceiling`);
  }

  const c3 = measured.mass.mean <= CEILINGS.massTransmittance;
  clause(c3, `C3 the mass proper    T ${measured.mass.mean.toFixed(4)} where the groom is ` +
    `${MASS_CROSSINGS}+ cards deep, over ${measured.mass.pixels.toLocaleString()} px ` +
    `(ceiling ${CEILINGS.massTransmittance})`);
  if (c3 === false) {
    failures.push(`${view.name} transmits ${measured.mass.mean.toFixed(4)} where it is ` +
      `${MASS_CROSSINGS}+ cards deep, past the ${CEILINGS.massTransmittance} ceiling — the mass ` +
      'itself is see-through, not just its outline');
  }

  for (const row of measured.byCrossing) {
    console.log(`  --   ${row.crossings} crossing(s)      T ${row.mean.toFixed(4)} over ` +
      `${row.pixels.toLocaleString()} px, implied card alpha ${row.impliedAlpha.toFixed(4)}`);
  }

  const l1 = measured.outside.mean >= LIVENESS_FLOOR;
  clause(l1, `L1 step is live       T ${measured.outside.mean.toFixed(4)} outside the footprint ` +
    `over ${measured.outside.pixels.toLocaleString()} px (floor ${LIVENESS_FLOOR}) — a pixel with ` +
    'no hair in front of it must pass the whole step');
  if (l1 === false) {
    failures.push(`${view.name} liveness L1: outside the hair the step only reads ` +
      `${measured.outside.mean.toFixed(4)} of itself, so C1–C3 are ratios against nothing`);
  }

  const l2 = measured.hidden.mean >= LIVENESS_FLOOR;
  clause(l2, `L2 mask is on the hair T ${measured.hidden.mean.toFixed(4)} over the footprint with ` +
    `the groom hidden (floor ${LIVENESS_FLOOR}) — the mask must contain pixels the step reaches`);
  if (l2 === false) {
    failures.push(`${view.name} liveness L2: with the groom hidden the footprint only reads ` +
      `${measured.hidden.mean.toFixed(4)}, so the mask is not where the hair is`);
  }

  return failures;
}

// --- the page ------------------------------------------------------------------------------------

/**
 * Everything the probe needs, installed on the live page and reading `window.sugata`.
 *
 * ⚠️ **NOTHING HERE EDITS `alive.js`, AND THAT IS A CONSTRAINT RATHER THAN A STYLE.** That file
 * belongs to another agent. What this does is read the scene graph the page already publishes and
 * set two things on it that are restored before the next plate: `visible` on the hair mesh, and
 * `emissive` on everything else. Both are read back to `restore()`'s saved copy at the end of every
 * view, so the plates written to disk are of the groom and not of the instrument.
 */
async function installProbe(page, defect) {
  await page.evaluate((plantedDefect) => {
    const stage = globalThis.sugata.stage;

    let hair = null;
    const behind = [];
    stage.scene.traverse((object) => {
      if (object.isMesh !== true) return;
      if (object.material?.name === 'sugata.hair') hair = object;
      else behind.push(object);
    });
    if (hair === null) throw new Error('hair_opacity: no mesh carries the `sugata.hair` material.');

    const saved = behind.map((mesh) => ({
      mesh,
      hex: mesh.material.emissive === undefined ? null : mesh.material.emissive.getHex(),
      intensity: mesh.material.emissiveIntensity
    }));

    // 🚩 The `oneside` defect: half the groom's coverage removed and nothing else touched. `side`
    // is pipeline state, so it survives whatever the OIT arm does to the shader — see the note on
    // `alphaTest` at DEFECTS.
    if (plantedDefect === 'oneside') {
      hair.material.side = 0; // THREE.FrontSide, without importing three into this page
      hair.material.needsUpdate = true;
    }

    globalThis.__hairOpacity = {
      setYaw: (degrees) => {
        globalThis.sugata.session.figure.root.rotation.y = degrees * Math.PI / 180;
        globalThis.sugata.session.figure.root.updateMatrixWorld(true);
      },
      setHairVisible: (on) => { hair.visible = on; },
      setStep: (value) => {
        if (plantedDefect === 'nostep') return;
        for (const mesh of behind) {
          if (mesh.material.emissive === undefined) continue;
          mesh.material.emissive.setScalar(value);
          mesh.material.emissiveIntensity = 1;
        }
      },
      restore: () => {
        for (const entry of saved) {
          if (entry.hex !== null) entry.mesh.material.emissive.setHex(entry.hex);
          entry.mesh.material.emissiveIntensity = entry.intensity;
        }
      },

      /**
       * The groom's own screen footprint and its depth complexity, rasterised on the CPU from the
       * live camera and the live skinning.
       *
       * `total` counts every hair triangle over the pixel; `inFront` counts only those nearer than
       * the closest non-hair surface, which is the number that decides what a viewer can see
       * through. The z-buffer of everything else is built first, from the same projection.
       */
      raster: () => {
        const camera = globalThis.sugata.stage.camera;
        const Vector3 = camera.position.constructor;
        const Matrix4 = camera.matrixWorld.constructor;
        camera.updateMatrixWorld(true);
        camera.updateProjectionMatrix();

        const canvas = globalThis.sugata.stage.renderer.domElement;
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

        const behindZ = new Float32Array(width * height).fill(Infinity);
        for (const mesh of behind) {
          // The ground plane is under the figure and behind nothing; rasterising it would only
          // cost time.
          if (mesh.name === 'ground') continue;
          const screen = project(mesh);
          rasterise(screen, mesh, (index, z) => { if (z < behindZ[index]) behindZ[index] = z; });
        }

        const total = new Uint8Array(width * height);
        const inFront = new Uint8Array(width * height);
        rasterise(project(hair), hair, (index, z) => {
          if (total[index] < 255) total[index] += 1;
          if (z < behindZ[index] && inFront[index] < 255) inFront[index] += 1;
        });

        const encode = (bytes) => {
          let binary = '';
          const chunk = 32768;
          for (let at = 0; at < bytes.length; at += chunk) {
            binary += String.fromCharCode.apply(null, bytes.subarray(at, at + chunk));
          }
          return btoa(binary);
        };

        return { width, height, total: encode(total), inFront: encode(inFront) };
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

/**
 * Steps the frozen page `count` times at zero seconds, which is what the temporal resolve needs to
 * converge on a still. `?freeze` means nothing in the scene moves, so every step is another sample
 * of the same picture — and the stochastic alpha test the groom is drawn through is exactly the
 * thing that has to be averaged before a transmittance means anything.
 */
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

const srgbToLinear = (value) =>
  (value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);

/** Rec.709 luma in LINEAR light. The plates are differenced here and nowhere else. */
function linearLuma(image) {
  const pixels = image.width * image.height;
  const luma = new Float64Array(pixels);
  for (let index = 0; index < pixels; index += 1) {
    luma[index] = 0.2126 * srgbToLinear(image.pixels[index * 4])
      + 0.7152 * srgbToLinear(image.pixels[index * 4 + 1])
      + 0.0722 * srgbToLinear(image.pixels[index * 4 + 2]);
  }
  return luma;
}

function countOf(mask) {
  let count = 0;
  for (let index = 0; index < mask.length; index += 1) count += mask[index];
  return count;
}

/** Green where the groom is paint, red where it is glass, and neutral where it was not measured. */
function writeHeatmap(file, width, height, mask, numerator, denominator) {
  const rgba = Buffer.alloc(width * height * 4);
  for (let index = 0; index < width * height; index += 1) {
    if (mask[index] === 0) {
      rgba[index * 4] = 24; rgba[index * 4 + 1] = 24; rgba[index * 4 + 2] = 30;
      rgba[index * 4 + 3] = 255;
      continue;
    }
    const transmittance = Math.max(0, Math.min(1, numerator[index] / denominator[index]));
    rgba[index * 4] = Math.round(255 * transmittance);
    rgba[index * 4 + 1] = Math.round(255 * (1 - transmittance));
    rgba[index * 4 + 2] = 40;
    rgba[index * 4 + 3] = 255;
  }
  fs.writeFileSync(file, encodePng(width, height, rgba));
}

// --- plumbing ----------------------------------------------------------------------------------

function parseArguments(argv) {
  const options = {
    out: path.join(REPO_ROOT, 'captures', 'hair-opacity'),
    url: null,
    steps: 24,
    defect: 'none'
  };
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === '--out') options.out = path.resolve(argv[index + 1]);
    if (argv[index] === '--url') options.url = argv[index + 1];
    if (argv[index] === '--steps') options.steps = Number(argv[index + 1]);
    if (argv[index] === '--defect') options.defect = argv[index + 1];
  }
  return options;
}

/** Starts the repo's own vite and waits for it to say which port it took. Same as hair_shots.mjs. */
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
