#!/usr/bin/env node
//
// scene-probe.mjs — what does a SCENE actually put on the subject? Punch-list 11.2 and 11.3.
//
// Two questions, and neither of them can be answered by one frame:
//
//   11.2  `docs/CHECKPOINT.md` §7 decomposed a forehead pixel term by term and measured **IBL at
//         0.00%**, because `scene.environment` was null. With a sky attached, what share does it
//         take? The only way to know is to REMOVE it and read the difference.
//
//   11.3  The underside of the jaw is most of what says "outdoors" and all of what says "beach" —
//         it is the one place a ground bounce lands and a key never reaches. Does it track the
//         ground's albedo, monotonically, and does it stop tracking it when the ground is taken
//         out of the environment?
//
// ## ⚠️ EVERY STATISTIC HERE IS MASKED, AND THAT IS NOT STYLE
//
// This project has shipped eight statistics that were structurally blind to the defect they were
// aimed at and SIX OF THEM WERE WHOLE-FRAME MEANS. A whole-frame mean cannot see a jaw underside:
// the jaw is ~0.6% of a portrait plate and the sky behind the figure is ~40% of it, so a ground
// albedo sweep that moves the jaw by 12% moves the frame mean by a tenth of that and moves the sky
// not at all. The `--ground` run reports BOTH numbers side by side for exactly that reason — the
// frame mean is printed as the control that shows the masked one was necessary.
//
// ## The tone curve is inverted before anything is summed
//
// Light transport is additive in linear radiance and a plate is not linear: `Stage` sets
// ACES + sRGB and both are applied at every quality. `lightpath-probe.mjs` owns the inverse, it is
// validated two ways in its own `--selftest` (arithmetic round-trip, and additivity on real
// pixels), and it is IMPORTED here rather than re-derived. Two copies of a tone-curve inverse is
// two claims and one gate.
//
// ## Usage
//
//   node tools/critic/scene-probe.mjs --selftest
//   node tools/critic/scene-probe.mjs --url-base <origin+path> --out captures/scene --rects
//   node tools/critic/scene-probe.mjs --url-base … --out … --ibl    --scene beach
//   node tools/critic/scene-probe.mjs --url-base … --out … --ground --scene beach
//   node tools/critic/scene-probe.mjs --url-base … --out … --report --scene beach

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { decodePng } from './png.mjs';
import {
  GPU_FLAGS,
  codesAt,
  isInvertible,
  loadPlaywright,
  luminance,
  plateToSceneLinear,
} from './lightpath-probe.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..', '..');
const WIDTH = 900;
const HEIGHT = 1200;
const READY_TIMEOUT_MS = 180_000;

/**
 * The two probe rects, in 900x1200 portrait pixels on `tools/critic/avatar-plate.html`.
 *
 * 🚩 BOTH WERE DRAWN ON THE PLATE AND LOOKED AT BEFORE THEY WERE TRUSTED — `--rects` writes the
 * overlay, and this project's own history is the reason: a chest rect chosen by projection rather
 * than by looking read 0.219103 in an arm where the subject is supposed to be black, because the
 * rectangle overhung the torso and was collecting sky.
 *
 * `jaw-underside` is the shelf of neck DIRECTLY beneath the mandible and BELOW the rim's own edge
 * line — the first choice sat on the front of the chin, which is lit by the key like any other
 * forward-facing skin and would have measured the key rather than the bounce. It is chosen because
 * it is the one skin in a portrait that no light in the rig reaches from above: the key sits at +18° to +52° of elevation in every scene this repository ships, the
 * fill at +2°, and the rim and kicker are behind. What lands there comes from below, and outdoors
 * what is below is the ground.
 *
 * `forehead` is CHECKPOINT §7's own probe region — the flat of the brow — so the IBL share this
 * tool reports is stated on the same skin the 0.00% was.
 */
export const PROBES = {
  'jaw-underside': [232, 750, 108, 44],
  forehead: [250, 196, 120, 46],
};

/** A rect's pixel indices, restricted to pixels every supplied plate can invert. */
export function usableRect(rect, width, plates) {
  const [x0, y0, w, h] = rect;
  const set = [];
  let clipped = 0;
  for (let y = y0; y < y0 + h; y += 1) {
    for (let x = x0; x < x0 + w; x += 1) {
      const k = y * width + x;
      if (plates.every((png) => isInvertible(codesAt(png, k * 4)))) set.push(k);
      else clipped += 1;
    }
  }
  return { set, clipped, total: w * h };
}

/** Mean scene-linear luminance over an index list. The one number every arm is compared on. */
export function probeLuminance(png, pixelSet) {
  let sum = 0;
  for (const k of pixelSet) sum += luminance(plateToSceneLinear(codesAt(png, k * 4)));
  return sum / pixelSet.length;
}

/** Mean scene-linear luminance over the WHOLE frame — the control that shows the mask was needed. */
export function frameLuminance(png) {
  let sum = 0;
  let n = 0;
  for (let k = 0; k < png.width * png.height; k += 1) {
    const codes = codesAt(png, k * 4);
    if (isInvertible(codes) === false) continue;
    sum += luminance(plateToSceneLinear(codes));
    n += 1;
  }
  return sum / n;
}

// --- the browser side ---------------------------------------------------------------------------

async function open(browser, url) {
  const context = await browser.newContext({
    viewport: { width: WIDTH, height: HEIGHT },
    deviceScaleFactor: 1,
    colorScheme: 'dark',
    reducedMotion: 'no-preference',
  });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  try {
    await page.waitForFunction(() => typeof globalThis.__SUGATA_STEP__ === 'function', null, {
      timeout: READY_TIMEOUT_MS,
      polling: 200,
    });
  } catch (error) {
    const shown = await page.evaluate(() => document.getElementById('failure')?.textContent ?? '');
    throw new Error(`page never came up: ${shown || error.message}`);
  }
  return { context, page, errors };
}

/**
 * One arm: open, step the frozen clock, screenshot, and read `report()` back.
 *
 * `steps` is 1 by the same argument the plate rule makes — `?freeze` holds under capture and a
 * temporal resolve at N steps is not the picture at M steps, so every arm here uses the same one.
 */
async function arm(browser, urlBase, query, file) {
  const url = `${urlBase}?${query}&freeze&seed=1&capture`;
  const { context, page, errors } = await open(browser, url);
  await page.evaluate(() => globalThis.__SUGATA_STEP__(1 / 60));
  fs.mkdirSync(path.dirname(file), { recursive: true });
  await page.screenshot({ path: file, animations: 'disabled' });
  const report = await page.evaluate(() => globalThis.avatar.report());
  await context.close();
  if (errors.length > 0) console.warn(`  ⚠️ page errors: ${errors.join(' | ')}`);
  return { file, report, png: decodePng(fs.readFileSync(file)) };
}

// --- the runs -----------------------------------------------------------------------------------

/** 11.2: what share of a skin pixel is the image-based light? */
async function runIbl(browser, urlBase, out, scene) {
  const base = await arm(browser, urlBase, `scene=${scene}`, `${out}/${scene}-base.png`);
  const noEnv = await arm(browser, urlBase, `scene=${scene}&noenv`, `${out}/${scene}-noenv.png`);

  console.log(`\n=== IBL SHARE — scene '${scene}', ${WIDTH}x${HEIGHT}, 1 step, seed 1`);
  console.log(
    `    environment: ${JSON.stringify(base.report.scene.environment?.environmentIntensity ?? null)} intensity, ` +
      `cube ${base.report.scene.environment?.cubeSize}, ${base.report.scene.environment?.bakes} bakes; ` +
      `noenv arm reports environment.attached=${noEnv.report.scene.environment?.attached}`
  );

  for (const [label, rect] of Object.entries(PROBES)) {
    const { set, clipped, total } = usableRect(rect, base.png.width, [base.png, noEnv.png]);
    if (set.length < 30) {
      console.log(`    ${label}: only ${set.length} of ${total} usable — not reported rather than reported badly`);
      continue;
    }
    const withEnv = probeLuminance(base.png, set);
    const without = probeLuminance(noEnv.png, set);
    console.log(
      `    ${label.padEnd(14)} rect ${rect.join(',')}  ${set.length}/${total} usable (${clipped} clipped)\n` +
        `      total ${withEnv.toExponential(4)}   without env ${without.toExponential(4)}   ` +
        `IBL share ${(((withEnv - without) / withEnv) * 100).toFixed(2)}%`
    );
  }

  const frameWith = frameLuminance(base.png);
  const frameWithout = frameLuminance(noEnv.png);
  console.log(
    `    🔴 RED PROOF (frame): ${frameWith.toExponential(4)} → ${frameWithout.toExponential(4)}, ` +
      `${(((frameWith - frameWithout) / frameWith) * 100).toFixed(2)}% — removing the PMREM changes the frame`
  );
}

/** 11.3: does the jaw underside track the ground's albedo, and stop when the ground leaves the bake? */
async function runGround(browser, urlBase, out, scene) {
  // Three albedos plus the shipped one, spanning a factor of ~7 in linear reflectance. Stated as
  // linear so the expected DIRECTION is arithmetic before anything renders: brighter ground, more
  // bounce, brighter jaw.
  const albedos = [
    ['0x1a1a18', 'near-black basalt'],
    ['0x6b6459', 'wet sand'],
    ['0xa89f8d', 'dry sand (shipped)'],
    ['0xe4dccb', 'white sand'],
  ];

  const rect = PROBES['jaw-underside'];
  const rows = [];

  for (const [hex, label] of albedos) {
    const over = JSON.stringify({ ground: { enabled: true, albedo: Number(hex), roughness: 0.95 } });
    const lit = await arm(
      browser,
      urlBase,
      `scene=${scene}&sceneover=${encodeURIComponent(over)}`,
      `${out}/ground-${hex}.png`
    );
    const nul = await arm(
      browser,
      urlBase,
      `scene=${scene}&sceneover=${encodeURIComponent(over)}&noenvground`,
      `${out}/ground-${hex}-null.png`
    );
    rows.push({ hex, label, lit, nul });
  }

  const plates = rows.flatMap((r) => [r.lit.png, r.nul.png]);
  const { set, clipped, total } = usableRect(rect, WIDTH, plates);

  console.log(`\n=== GROUND BOUNCE — scene '${scene}', jaw-underside rect ${rect.join(',')}`);
  console.log(`    ${set.length}/${total} usable pixels (${clipped} clipped in at least one arm)\n`);
  console.log('    ground albedo          linear Y   jaw (env has ground)   jaw (NULL: no ground in bake)   whole frame');

  for (const row of rows) {
    const linear = luminance(
      [16, 8, 0].map((shift) => {
        const c = (Number(row.hex) >> shift) & 255;
        const v = c / 255;
        return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
      })
    );
    row.linear = linear;
    row.jaw = probeLuminance(row.lit.png, set);
    row.jawNull = probeLuminance(row.nul.png, set);
    row.frame = frameLuminance(row.lit.png);
    console.log(
      `    ${row.hex} ${row.label.padEnd(20)} ${linear.toFixed(4)}   ` +
        `${row.jaw.toExponential(4)}              ${row.jawNull.toExponential(4)}                  ${row.frame.toExponential(4)}`
    );
  }

  const monotone = rows.every((r, i) => i === 0 || r.jaw > rows[i - 1].jaw);
  const span = rows[rows.length - 1].jaw / rows[0].jaw;
  const nullSpan = rows[rows.length - 1].jawNull / rows[0].jawNull;
  const frameSpan = rows[rows.length - 1].frame / rows[0].frame;

  console.log(
    `\n    MONOTONE in albedo: ${monotone ? 'YES' : 'NO'}   jaw span ${span.toFixed(4)}x ` +
      `over a ${(rows[rows.length - 1].linear / rows[0].linear).toFixed(2)}x albedo range`
  );
  console.log(
    `    🔴 NULL CONTROL (ground out of the bake, plane kept): span ${nullSpan.toFixed(4)}x — ` +
      'the same sweep with no path from the albedo to the jaw'
  );
  console.log(
    `    ⚠️ WHOLE-FRAME MEAN over the same sweep: ${frameSpan.toFixed(4)}x — this is what a ` +
      'statistic without the mask would have reported'
  );
}

/** `report()` for one arm, so a claim about the scene can be quoted rather than recalled. */
async function runReport(browser, urlBase, out, scene, extra = '') {
  const a = await arm(browser, urlBase, `scene=${scene}${extra}`, `${out}/${scene}-report.png`);
  console.log(JSON.stringify({ scene: a.report.scene, quality: a.report.quality }, null, 2));
}

/** Draws the probe rects on a plate so they can be LOOKED at rather than trusted. */
function drawRects(sourceFile, targetFile) {
  const png = decodePng(fs.readFileSync(sourceFile));
  const out = Buffer.alloc(png.width * png.height * 3);
  for (let k = 0; k < png.width * png.height; k += 1) {
    out[k * 3] = Math.round(png.pixels[k * 4] * 255);
    out[k * 3 + 1] = Math.round(png.pixels[k * 4 + 1] * 255);
    out[k * 3 + 2] = Math.round(png.pixels[k * 4 + 2] * 255);
  }
  for (const [label, [x0, y0, w, h]] of Object.entries(PROBES)) {
    const colour = label === 'forehead' ? [0, 255, 0] : [255, 0, 0];
    for (let x = x0; x < x0 + w; x += 1) {
      for (const y of [y0, y0 + h - 1]) {
        const k = (y * png.width + x) * 3;
        out[k] = colour[0];
        out[k + 1] = colour[1];
        out[k + 2] = colour[2];
      }
    }
    for (let y = y0; y < y0 + h; y += 1) {
      for (const x of [x0, x0 + w - 1]) {
        const k = (y * png.width + x) * 3;
        out[k] = colour[0];
        out[k + 1] = colour[1];
        out[k + 2] = colour[2];
      }
    }
  }
  fs.writeFileSync(targetFile.replace(/\.png$/, '.ppm'), Buffer.concat([
    Buffer.from(`P6\n${png.width} ${png.height}\n255\n`),
    out,
  ]));
  console.log(`  rect overlay -> ${targetFile.replace(/\.png$/, '.ppm')}`);
}

// --- selftest ------------------------------------------------------------------------------------
//
// 🎯 VALIDATED AGAINST A CASE WHOSE ANSWER IS ARITHMETIC BEFORE IT IS POINTED AT A RENDER, because
// "a statistic that cannot see the defect is worse than none" and this file's whole job is a
// difference between two means.

function selftest() {
  let failures = 0;
  const say = (ok, label, detail) => {
    if (!ok) failures += 1;
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}  ${detail}`);
  };

  const W = 200;
  const H = 100;
  const field = (paint) => {
    const px = new Float32Array(W * H * 4);
    for (let y = 0; y < H; y += 1) {
      for (let x = 0; x < W; x += 1) {
        const i = (y * W + x) * 4;
        const v = paint(x, y) / 255;
        px[i] = v;
        px[i + 1] = v;
        px[i + 2] = v;
        px[i + 3] = 1;
      }
    }
    return { width: W, height: H, pixels: px };
  };

  // A 20x20 patch that MOVES and a background that does not. The masked statistic must see the
  // patch's own step; the whole-frame mean must see it diluted by exactly the area ratio.
  const inPatch = (x, y) => x >= 10 && x < 30 && y >= 10 && y < 30;
  const before = field((x, y) => (inPatch(x, y) ? 120 : 60));
  const after = field((x, y) => (inPatch(x, y) ? 140 : 60));

  const rect = [10, 10, 20, 20];
  const { set } = usableRect(rect, W, [before, after]);

  const maskedBefore = probeLuminance(before, set);
  const maskedAfter = probeLuminance(after, set);
  const frameBefore = frameLuminance(before);
  const frameAfter = frameLuminance(after);

  const maskedMove = (maskedAfter - maskedBefore) / maskedBefore;
  const frameMove = (frameAfter - frameBefore) / frameBefore;

  say(
    set.length === 400,
    'the rect resolves to its own pixels and nothing else',
    `${set.length} of 400`
  );

  // Arithmetic: code 120 -> 140 in scene-linear luminance, over the patch alone.
  const expected =
    (luminance(plateToSceneLinear([140, 140, 140])) - luminance(plateToSceneLinear([120, 120, 120]))) /
    luminance(plateToSceneLinear([120, 120, 120]));

  say(
    // 1e-5 relative and not 1e-9: `decodePng` decodes into a Float32Array as byte/255, so a code
    // value survives the round trip to about seven significant figures and not to fifteen. Stated
    // rather than widened silently — the quantisation floor is a property of the decoder, and
    // `lightpath-probe.mjs --selftest` reports the same floor for the same reason.
    Math.abs(maskedMove - expected) / expected < 1e-5,
    'the MASKED mean reads the painted step exactly',
    `${(maskedMove * 100).toFixed(4)}% against the arithmetic ${(expected * 100).toFixed(4)}%`
  );

  // 🔴 THE RED PROOF FOR THE INSTRUMENT ITSELF. The patch is 400 of 20 000 pixels — 2% of the frame
  // — so a whole-frame mean dilutes the same change by a factor the mask does not. This is the
  // shape of six of this project's eight structurally blind statistics, reproduced on demand.
  say(
    frameMove < maskedMove / 10,
    '🔴 RED PROOF: the same change read WITHOUT the mask is diluted past usefulness',
    `frame ${(frameMove * 100).toFixed(4)}% against masked ${(maskedMove * 100).toFixed(4)}% — ` +
      `a factor of ${(maskedMove / frameMove).toFixed(1)} on a patch that is 2.00% of the frame`
  );

  // And a null control: a change OUTSIDE the rect must read exactly zero inside it.
  const elsewhere = field((x, y) => (inPatch(x, y) ? 120 : 90));
  say(
    Math.abs(probeLuminance(elsewhere, set) - maskedBefore) < 1e-12,
    'NULL CONTROL: a change outside the rect reads exactly zero inside it',
    `${probeLuminance(elsewhere, set).toExponential(6)} against ${maskedBefore.toExponential(6)}`
  );

  console.log(failures === 0 ? '\nall clauses green' : `\n${failures} FAILED`);
  return failures;
}

// --- entry ---------------------------------------------------------------------------------------

function flag(name, fallback = null) {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? fallback : process.argv[i + 1];
}

if (process.argv.includes('--selftest')) process.exit(selftest() === 0 ? 0 : 1);

const urlBase = flag('url-base');
const out = path.resolve(flag('out', path.join(REPO, 'captures', 'scene-probe')));
const scene = flag('scene', 'beach');

if (urlBase === null) {
  console.log('pass --selftest, or --url-base <origin+path-to-avatar-plate.html> --out <dir> plus one of --ibl / --ground / --report / --rects');
} else {
  const { chromium } = await loadPlaywright();
  const browser = await chromium.launch({ headless: true, channel: 'chromium', args: GPU_FLAGS });
  try {
    if (process.argv.includes('--ibl')) await runIbl(browser, urlBase, out, scene);
    if (process.argv.includes('--ground')) await runGround(browser, urlBase, out, scene);
    if (process.argv.includes('--report')) await runReport(browser, urlBase, out, scene);
    if (process.argv.includes('--rects')) {
      const a = await arm(browser, urlBase, `scene=${scene}`, `${out}/${scene}-rects.png`);
      drawRects(a.file, `${out}/${scene}-rects-overlay.png`);
    }
  } finally {
    await browser.close();
  }
}
