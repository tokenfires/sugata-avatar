#!/usr/bin/env node
//
// interior-probe.mjs — is there a PLACE behind the figure, and does it move when the sun does?
// Punch-list 11.4.
//
// Two questions, and the first one is the flagship complaint against the exteriors:
//
//   THE BACKDROP.  `docs/CHECKPOINT.md` §14: *"a blind judge could not name either exterior at
//   portrait framing"* and *"the two exterior portrait backdrops are the same picture — mean |Δ|
//   2.42 code values over a sky-only rect."* A smooth gradient with no structure is not a place. So
//   the statistic here is a SPATIAL RANGE over several masked background rects, not a mean over
//   one: `--backdrop` reports every rect's own mean and the span between the brightest and the
//   darkest, in code values and as a ratio.
//
//   THE SUN.  11.4's gate is that moving `sun.elevationDegrees` ALONE moves the interior's light
//   AND its key. `--sun` sweeps the elevation through `?sceneover`, holding the room, and reports
//   the window pane, the wall, the face and the derived key side by side.
//
// ## ⚠️ EVERY STATISTIC HERE IS MASKED, AND THAT IS NOT STYLE
//
// Six of this project's eight structurally blind statistics were whole-frame means. A whole-frame
// mean cannot answer either question above: at portrait framing the figure owns most of the pixels,
// so a backdrop that changed completely would move the frame mean by a fraction of what it moved,
// and a face that changed would swamp a wall that did too. Every rect below was drawn on a plate
// and LOOKED AT with `--rects` before it was trusted, which is the rule this repo wrote after a
// chest rect chosen by projection read 0.219103 in an arm where the subject is supposed to be black.
//
// ## The tone curve is inverted before anything is summed
//
// `lightpath-probe.mjs` owns the inverse of `Stage`'s ACES + sRGB, it is validated two ways in its
// own `--selftest`, and it is IMPORTED here rather than re-derived. Two copies of a tone-curve
// inverse is two claims and one gate. Code values are ALSO reported, because the complaint this
// tool answers was filed in code values and a repair has to be quotable in the same unit.
//
// ## Usage
//
//   node tools/critic/interior-probe.mjs --selftest
//   node tools/critic/interior-probe.mjs --url-base <origin+path> --out <dir> --rects
//   node tools/critic/interior-probe.mjs --url-base … --out … --backdrop --scene kitchen
//   node tools/critic/interior-probe.mjs --url-base … --out … --backdrop --scene beach   (the control)
//   node tools/critic/interior-probe.mjs --url-base … --out … --between --scenes studio,beach,park,kitchen
//   node tools/critic/interior-probe.mjs --url-base … --out … --sun --scene kitchen
//   node tools/critic/interior-probe.mjs --url-base … --out … --exposure --scene kitchen
//   node tools/critic/interior-probe.mjs --url-base … --out … --red --scene kitchen

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { decodePng } from './png.mjs';
import { codesAt, loadPlaywright, luminance, plateToSceneLinear } from './lightpath-probe.mjs';

/**
 * 🚩 `scene-probe.mjs` IS IMPORTED DYNAMICALLY AND `--selftest` IS SCRUBBED OFF `process.argv`
 * FIRST, AND BOTH HALVES ARE LOAD-BEARING RATHER THAN FUSSY.
 *
 * That module ends in a top-level `if ( process.argv.includes( '--selftest' ) ) process.exit( … )`.
 * A STATIC import of it is hoisted and evaluated before a single line here runs, so
 * `interior-probe.mjs --selftest` ran the OTHER tool's selftest, printed four green clauses that
 * belong to another file, and exited 0 — a gate reporting on code it does not test, which is this
 * project's own §1.2 in the instrument rather than in the render. Caught by reading the output and
 * noticing the clause names were not the ones written here.
 *
 * The three helpers below are imported rather than copied because a second copy of a masked-mean
 * operator would be two claims with one gate on it — the same rule that keeps the tone-curve
 * inverse in `lightpath-probe.mjs` alone.
 */
const SELFTEST = process.argv.includes( '--selftest' );

const { PROBES, frameLuminance, probeLuminance, usableRect } = await importQuietly();

/**
 * The import, with `process.argv` held empty across it and its one line of usage text swallowed.
 *
 * ⚠️ BOTH ARE NECESSARY AND FOR DIFFERENT REASONS. With `--selftest` visible it exits the process
 * on the other tool's clauses; with `--url-base` visible it LAUNCHES A BROWSER, runs none of its
 * own arms because none of its flags are set, and closes it again. Neither is a bug in that file —
 * it is a script that happens to be importable — and the containment belongs here rather than as a
 * change to a tool this round does not own.
 */
async function importQuietly() {

    const argv = process.argv;
    const log = console.log;

    process.argv = [ argv[ 0 ], argv[ 1 ] ];
    console.log = () => {};

    try {

        return await import( './scene-probe.mjs' );

    } finally {

        process.argv = argv;
        console.log = log;

    }

}

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..', '..');
const WIDTH = 900;
const HEIGHT = 1200;
const READY_TIMEOUT_MS = 180_000;

/**
 * The background rects, in 900x1200 portrait pixels on `tools/critic/avatar-plate.html`.
 *
 * 🚩 ALL FIVE ARE CLEAR OF THE FIGURE AT PORTRAIT FRAMING AND ALL FIVE WERE LOOKED AT. The figure's
 * silhouette runs from about x=60 to x=560 at the head and fills the lower third, so the readable
 * background is the upper-right quadrant and two narrow strips. That is not a limitation of this
 * tool — it is what a portrait frame IS, and it is why the span between these rects is the only
 * honest way to ask whether the backdrop has structure in it.
 */
export const BACKDROP_RECTS = {
  'bg-top-right': [700, 60, 170, 130],
  'bg-mid-right': [700, 430, 170, 150],
  'bg-low-right': [700, 700, 170, 120],
  'bg-top-left': [8, 40, 60, 150],
  'bg-upper-mid': [600, 120, 90, 90],
};

/** The face rects the exposure anchor is read on. `forehead` is CHECKPOINT §7's own probe. */
export const FACE_RECTS = {
  forehead: PROBES.forehead,
  'jaw-underside': PROBES['jaw-underside'],
  cheek: [300, 420, 90, 70],
};

// --- the statistic, and it is validated before it is pointed at a render ---------------------------

/**
 * The backdrop's SPATIAL SPAN: the brightest masked rect over the darkest, and the code-value
 * difference between them.
 *
 * 🎯 WHY A SPAN AND NOT A MEAN. The filed defect is *"the two exterior portrait backdrops are the
 * same picture"* — a statistic that averages a backdrop cannot tell a flat card from a room, because
 * a flat card and a room can have the same mean. A span asks whether anything VARIES across the
 * frame, which is the property a judge is actually reading when it names a place.
 *
 * ⚠️ It is a necessary condition and not a sufficient one, and saying so is the point: a linear
 * gradient scores well here and is still not a kitchen. The span is what rules OUT the flat card;
 * naming the place is 11.6's blind judge and this tool cannot stand in for it.
 */
export function backdropSpan(png, rects) {
  const rows = [];
  for (const [label, rect] of Object.entries(rects)) {
    const { set, clipped, total } = usableRect(rect, png.width, [png]);
    if (set.length < 30) {
      rows.push({ label, rect, usable: set.length, total, skipped: true });
      continue;
    }
    rows.push({
      label,
      rect,
      usable: set.length,
      total,
      clipped,
      linear: probeLuminance(png, set),
      codes: meanCodes(png, set),
    });
  }
  const scored = rows.filter((r) => r.skipped !== true);
  const bright = scored.reduce((a, b) => (b.linear > a.linear ? b : a));
  const dark = scored.reduce((a, b) => (b.linear < a.linear ? b : a));
  return {
    rows,
    bright,
    dark,
    ratio: bright.linear / dark.linear,
    codeSpan: meanAbsoluteCodeDifference(bright.codes, dark.codes),
  };
}

/** Mean sRGB code value per channel over an index list. The unit the complaint was filed in. */
export function meanCodes(png, pixelSet) {
  const sum = [0, 0, 0];
  for (const k of pixelSet) {
    const codes = codesAt(png, k * 4);
    for (let c = 0; c < 3; c += 1) sum[c] += codes[c];
  }
  return sum.map((v) => v / pixelSet.length);
}

/** Mean |Δ| across the three channels, which is exactly the form the 2.42 figure was quoted in. */
export function meanAbsoluteCodeDifference(a, b) {
  return (Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2])) / 3;
}

// --- the browser side ------------------------------------------------------------------------------

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

/** One arm: open, step the frozen clock once, screenshot, read `report()` back. */
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

/** A `?sceneover=` query fragment. The public schema, so an arm cannot reach past the API. */
function over(object) {
  return `sceneover=${encodeURIComponent(JSON.stringify(object))}`;
}

// --- the runs ---------------------------------------------------------------------------------------

async function runBackdrop(browser, urlBase, out, scene) {
  const a = await arm(browser, urlBase, `scene=${scene}`, `${out}/${scene}-backdrop.png`);
  const span = backdropSpan(a.png, BACKDROP_RECTS);

  console.log(`\n=== BACKDROP STRUCTURE — scene '${scene}', ${WIDTH}x${HEIGHT}, 1 step, seed 1`);
  console.log('    rect            px      mean code (R,G,B)          scene-linear Y');
  for (const row of span.rows) {
    if (row.skipped === true) {
      console.log(`    ${row.label.padEnd(14)} only ${row.usable}/${row.total} usable — not reported`);
      continue;
    }
    console.log(
      `    ${row.label.padEnd(14)} ${String(row.usable).padStart(5)}   ` +
        `(${row.codes.map((c) => c.toFixed(2).padStart(6)).join(', ')})   ${row.linear.toExponential(4)}`
    );
  }
  console.log(
    `\n    SPAN  brightest '${span.bright.label}' / darkest '${span.dark.label}' = ` +
      `${span.ratio.toFixed(4)}x,  mean |Δ| ${span.codeSpan.toFixed(2)} code values`
  );
  console.log(
    '    ⚠️ the filed complaint against the two exteriors is 2.42 code values BETWEEN SCENES over a ' +
      'sky-only rect; this is WITHIN one plate, which is the harder question and the right one'
  );
}

/**
 * 🎯 **THE FILED COMPLAINT, IN ITS OWN UNIT.** `docs/CHECKPOINT.md` §14 does not say the exteriors
 * are flat — a sky HAS a gradient and `--backdrop` measures a large one. It says the two exteriors
 * are *"the same picture"*: **mean |Δ| 2.42 code values BETWEEN them** over a background rect, against
 * 150.12 against `studio`. So the question an interior has to answer is not "does my backdrop vary"
 * but "is my backdrop a DIFFERENT PICTURE from the ones that already exist", and that is a pairwise
 * statistic over the same masked rects rather than a property of one plate.
 */
async function runBetween(browser, urlBase, out, scenes) {
  const plates = {};
  for (const scene of scenes) {
    plates[scene] = await arm(browser, urlBase, `scene=${scene}`, `${out}/between-${scene}.png`);
  }

  const codesFor = (png) => {
    const parts = [];
    for (const rect of Object.values(BACKDROP_RECTS)) {
      const { set } = usableRect(rect, png.width, [png]);
      if (set.length > 30) parts.push({ codes: meanCodes(png, set), n: set.length });
    }
    const total = parts.reduce((a, b) => a + b.n, 0);
    return [0, 1, 2].map((c) => parts.reduce((a, b) => a + b.codes[c] * b.n, 0) / total);
  };

  console.log(`\n=== 🎯 IS IT A DIFFERENT PICTURE — pairwise mean |Δ| over the backdrop rects, code values`);
  console.log('    scene      mean code (R,G,B)');
  const codes = {};
  for (const scene of scenes) {
    codes[scene] = codesFor(plates[scene].png);
    console.log(`    ${scene.padEnd(9)}  (${codes[scene].map((c) => c.toFixed(2).padStart(7)).join(', ')})`);
  }

  console.log('\n    pair                     mean |Δ| code values');
  for (let i = 0; i < scenes.length; i += 1) {
    for (let j = i + 1; j < scenes.length; j += 1) {
      const label = `${scenes[i]} vs ${scenes[j]}`;
      console.log(
        `    ${label.padEnd(24)} ${meanAbsoluteCodeDifference(codes[scenes[i]], codes[scenes[j]]).toFixed(2).padStart(8)}`
      );
    }
  }
}

async function runSun(browser, urlBase, out, scene, elevations) {
  console.log(`\n=== ONE SUN, FOUR CONSUMERS — scene '${scene}', elevation swept ALONE`);
  console.log(
    '    elev  admit   key irr (rig)  key colour  |  near wall Y     far wall Y    forehead Y    frame Y'
  );

  const base = (await import('../../packages/core/src/render/Scene.js')).SCENES[scene];
  if (base === undefined) throw new Error(`no scene '${scene}'`);

  for (const elevation of elevations) {
    const a = await arm(
      browser,
      urlBase,
      `scene=${scene}&${over({ sun: { ...base.sun, elevationDegrees: elevation } })}`,
      `${out}/sun-${elevation}.png`
    );

    const env = a.report.scene.environment;
    const far = maskedLinear(a.png, BACKDROP_RECTS['bg-mid-right']);
    const near = maskedLinear(a.png, BACKDROP_RECTS['bg-top-left']);
    const face = maskedLinear(a.png, FACE_RECTS.forehead);

    console.log(
      `    ${String(elevation).padStart(4)}  ${env.windowAdmittance.toFixed(4)}  ` +
        `${env.keyIrradianceInRigUnits.toFixed(4).padStart(12)}  #${env.sunColour.toString(16).padStart(6, '0')}   |  ` +
        `${near.toExponential(4)}   ${far.toExponential(4)}   ${face.toExponential(4)}   ${frameLuminance(a.png).toExponential(4)}`
    );
  }
}

/**
 * 🚩 THE TWO WALL RECTS ARE THE SUN SWEEP'S REAL EVIDENCE AND THEY ARE ON OPPOSITE SIDES OF THE
 * ROOM. `bg-top-left` is the window's OWN wall, seen at grazing incidence at the frame's left edge
 * and carrying the enclosure's ambient; `bg-mid-right` is the far wall, 2.6 m from the aperture and
 * carrying the point-source term. They move together when the sun moves and they move by different
 * amounts, which is what a single number for "the room got brighter" could not have shown.
 *
 * ⚠️ THERE IS NO WINDOW PANE RECT, and that is a measurement rather than an omission: at a 26° field
 * of view 0.9 m out the portrait frame sees about 1.2 m of the far wall and NOTHING of a side wall
 * past its first few centimetres, so no window on any wall of a domestic room is in a portrait
 * frame. `InteriorEnvironment.js`'s ROUND NOTE carries that arithmetic.
 */

/** Mean code values over a rect, as a printable triple. Never NaN — see the block in `runRed`. */
function rectCodes(png, [x0, y0, w, h]) {
  const sum = [0, 0, 0];
  for (let y = y0; y < y0 + h; y += 1) {
    for (let x = x0; x < x0 + w; x += 1) {
      const codes = codesAt(png, (y * png.width + x) * 4);
      for (let c = 0; c < 3; c += 1) sum[c] += codes[c];
    }
  }
  return `(${sum.map((v) => (v / (w * h)).toFixed(1).padStart(5)).join(',')})`;
}

/** Mean code value over the whole frame. The control that shows a masked rect was necessary. */
function frameCodes(png) {
  let sum = 0;
  for (let k = 0; k < png.width * png.height; k += 1) {
    const codes = codesAt(png, k * 4);
    sum += (codes[0] + codes[1] + codes[2]) / 3;
  }
  return (sum / (png.width * png.height)).toFixed(2);
}

function maskedLinear(png, rect) {
  const { set } = usableRect(rect, png.width, [png]);
  return set.length < 20 ? NaN : probeLuminance(png, set);
}

async function runExposure(browser, urlBase, out, scene, ladder) {
  const control = await arm(browser, urlBase, 'scene=studio', `${out}/studio-control.png`);
  const controlFace = maskedLinear(control.png, FACE_RECTS.forehead);
  const controlCheek = maskedLinear(control.png, FACE_RECTS.cheek);

  console.log(`\n=== EXPOSURE LADDER — scene '${scene}', anchored on the 'studio' control`);
  console.log(
    `    studio control: forehead ${controlFace.toExponential(4)}   cheek ${controlCheek.toExponential(4)}`
  );
  console.log('    exposure   forehead Y      x control    cheek Y        wall Y        wall:face');

  const base = (await import('../../packages/core/src/render/Scene.js')).SCENES[scene];

  for (const exposure of ladder) {
    const a = await arm(
      browser,
      urlBase,
      `scene=${scene}&${over({ exposure })}`,
      `${out}/exposure-${exposure}.png`
    );
    const face = maskedLinear(a.png, FACE_RECTS.forehead);
    const cheek = maskedLinear(a.png, FACE_RECTS.cheek);
    const wall = maskedLinear(a.png, BACKDROP_RECTS['bg-mid-right']);
    console.log(
      `    ${exposure.toFixed(2).padStart(8)}   ${face.toExponential(4)}   ${(face / controlFace).toFixed(4).padStart(8)}   ` +
        `${cheek.toExponential(4)}   ${wall.toExponential(4)}   ${(wall / face).toFixed(4)}`
    );
  }
  void base;
}

async function runRed(browser, urlBase, out, scene) {
  const base = (await import('../../packages/core/src/render/Scene.js')).SCENES[scene];

  const shipped = await arm(browser, urlBase, `scene=${scene}`, `${out}/red-shipped.png`);
  const noEnv = await arm(browser, urlBase, `scene=${scene}&noenv`, `${out}/red-noenv.png`);
  // 🚩 TWO `?noroom` ARMS AND THE PAIR IS THE POINT. On the shipped tier the room is ALSO the
  // geometry the occlusion pass needs, so removing it reproduces the measured whole-frame blackout
  // and says nothing about the background. On `balanced` there is no occlusion pass, so the same
  // injection isolates the room's role as the BACKDROP. One arm would have conflated two findings.
  const noRoom = await arm(browser, urlBase, `scene=${scene}&noroom`, `${out}/red-noroom.png`);
  const noRoomBalanced = await arm(
    browser, urlBase, `scene=${scene}&noroom&quality=balanced`, `${out}/red-noroom-balanced.png`);
  const shippedBalanced = await arm(
    browser, urlBase, `scene=${scene}&quality=balanced`, `${out}/red-balanced.png`);
  const noFixture = await arm(
    browser,
    urlBase,
    `scene=${scene}&${over({ room: { ...base.room, fixtures: [] } })}`,
    `${out}/red-nofixture.png`
  );
  const walled = await arm(
    browser,
    urlBase,
    `scene=${scene}&${over({ room: { ...base.room, window: { ...base.room.window, transmission: 0 } } })}`,
    `${out}/red-walled.png`
  );

  console.log(`\n=== 🔴 RED PROOFS — scene '${scene}'`);
  console.log(
    '    arm                     forehead code   far-wall code    near-wall code   frame mean code'
  );

  const rows = [
    ['shipped', shipped],
    ['?noenv (no IBL)', noEnv],
    ['?noroom, shipped tier', noRoom],
    ['balanced tier', shippedBalanced],
    ['?noroom on balanced', noRoomBalanced],
    ['no fixtures', noFixture],
    ['window transmission 0', walled],
  ];

  // ⚠️ CODE VALUES AND NOT SCENE-LINEAR, AND THE REASON IS A FLOOR RATHER THAN A PREFERENCE.
  // `lightpath-probe.mjs`'s `isInvertible` rejects any channel below code 1, because the ACES
  // inverse is not defined there — and two of these four arms deliberately take a region to BLACK,
  // which is the result. A statistic that returns NaN on the very arm it was written to measure is
  // not a statistic, so the red proofs are quoted in the unit that survives a zero.
  for (const [label, a] of rows) {
    console.log(
      `    ${label.padEnd(22)} ${rectCodes(a.png, FACE_RECTS.forehead)}   ` +
        `${rectCodes(a.png, BACKDROP_RECTS['bg-mid-right'])}   ` +
        `${rectCodes(a.png, BACKDROP_RECTS['bg-top-left'])}   ${frameCodes(a.png)}`
    );
  }

  console.log(
    `    key irradiance: shipped ${shipped.report.scene.environment.keyIrradianceInRigUnits.toFixed(4)} → ` +
      `walled ${walled.report.scene.environment.keyIrradianceInRigUnits.toFixed(4)}`
  );
}

/** Draws every rect on a plate so they can be LOOKED at rather than trusted. */
function drawRects(sourceFile, targetFile) {
  const png = decodePng(fs.readFileSync(sourceFile));
  const out = Buffer.alloc(png.width * png.height * 3);
  for (let k = 0; k < png.width * png.height; k += 1) {
    for (let c = 0; c < 3; c += 1) out[k * 3 + c] = Math.round(png.pixels[k * 4 + c] * 255);
  }
  const all = [
    ...Object.entries(BACKDROP_RECTS).map(([l, r]) => [l, r, [0, 255, 0]]),
    ...Object.entries(FACE_RECTS).map(([l, r]) => [l, r, [255, 0, 0]]),
    ['window-pane-body', WINDOW_PANE_RECT_BODY, [0, 128, 255]],
  ];
  for (const [, [x0, y0, w, h], colour] of all) {
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
  const target = targetFile.replace(/\.png$/, '.ppm');
  fs.writeFileSync(target, Buffer.concat([Buffer.from(`P6\n${png.width} ${png.height}\n255\n`), out]));
  console.log(`  rect overlay -> ${target}`);
}

// --- selftest -----------------------------------------------------------------------------------
//
// 🎯 VALIDATED AGAINST A CASE WHOSE ANSWER IS ARITHMETIC BEFORE IT IS POINTED AT A RENDER. The
// standing rule in this repo, and it is not ceremony: `backdropSpan` is a NEW statistic and eight
// statistics here have been structurally blind to the defect they were aimed at.

/** The flat code value whose scene-linear luminance is a given target. Bisection, 40 steps. */
function solveCodeForLuminance(target) {
  let low = 0;
  let high = 255;
  for (let i = 0; i < 40; i += 1) {
    const mid = (low + high) / 2;
    if (luminance(plateToSceneLinear([mid, mid, mid])) < target) low = mid;
    else high = mid;
  }
  return (low + high) / 2;
}

function selftest() {
  let failures = 0;
  const say = (ok, label, detail) => {
    if (!ok) failures += 1;
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}  ${detail}`);
  };

  const W = 900;
  const H = 1200;
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

  // 1. A FLAT backdrop. Every rect reads the same, so the span must be exactly 1 and 0 codes —
  //    which is the studio card, and the thing this statistic exists to separate a room from.
  const flat = field(() => 90);
  const flatSpan = backdropSpan(flat, BACKDROP_RECTS);
  say(
    Math.abs(flatSpan.ratio - 1) < 1e-12 && flatSpan.codeSpan < 1e-9,
    'a FLAT backdrop scores exactly 1.0000x and 0.00 codes',
    `${flatSpan.ratio.toFixed(6)}x, ${flatSpan.codeSpan.toExponential(2)} codes`
  );

  // 2. A backdrop painted so that two named rects carry two known codes. The span must be the
  //    arithmetic ratio of their scene-linear luminances and their exact code difference.
  const [bx] = BACKDROP_RECTS['bg-top-right'];
  const painted = field((x) => (x >= bx ? 160 : 70));
  const paintedSpan = backdropSpan(painted, BACKDROP_RECTS);
  const expectedRatio =
    luminance(plateToSceneLinear([160, 160, 160])) / luminance(plateToSceneLinear([70, 70, 70]));

  say(
    Math.abs(paintedSpan.ratio - expectedRatio) / expectedRatio < 1e-5,
    'the SPAN is the arithmetic ratio of the two painted patches',
    `${paintedSpan.ratio.toFixed(5)}x against the arithmetic ${expectedRatio.toFixed(5)}x`
  );
  say(
    Math.abs(paintedSpan.codeSpan - 90) < 1e-4,
    'the code span is the exact painted difference',
    `${paintedSpan.codeSpan.toFixed(4)} against 90`
  );

  // 3. 🔴 THE RED PROOF FOR THE INSTRUMENT ITSELF. The same two-patch picture read as a WHOLE-FRAME
  //    MEAN against the flat one: the mean moves, but it cannot say whether the movement is a
  //    brighter flat card or a room, which is the entire question. Two pictures, one mean.
  const framePainted = frameLuminance(painted);

  // The decoy's code is SOLVED for rather than typed, so the clause stays exact if a rect ever
  // moves. A number typed to match a measurement once is a number that stops matching it silently.
  const decoyCode = solveCodeForLuminance(framePainted);
  const decoy = field(() => decoyCode);
  const spanOfDecoy = backdropSpan(decoy, BACKDROP_RECTS);
  const frameDecoy = frameLuminance(decoy);

  say(
    Math.abs(frameDecoy - framePainted) / framePainted < 1e-4 &&
      spanOfDecoy.ratio < 1.0001 &&
      paintedSpan.ratio > 3,
    '🔴 RED PROOF: a FLAT card and a STRUCTURED backdrop with the SAME frame mean are told apart ' +
      'by the span and NOT by the mean',
    `frame means ${frameDecoy.toExponential(6)} vs ${framePainted.toExponential(6)} (matched to ` +
      `${(Math.abs(frameDecoy - framePainted) / framePainted).toExponential(1)}); ` +
      `spans ${spanOfDecoy.ratio.toFixed(4)}x vs ${paintedSpan.ratio.toFixed(4)}x`
  );

  // 4. NULL CONTROL: a change entirely inside the figure's own area must not move any rect.
  const elsewhere = field((x, y) => (x > 200 && x < 560 && y > 200 && y < 900 ? 250 : 90));
  const nullSpan = backdropSpan(elsewhere, BACKDROP_RECTS);
  say(
    Math.abs(nullSpan.ratio - 1) < 1e-12,
    'NULL CONTROL: a change confined to the figure reads exactly zero in every backdrop rect',
    `${nullSpan.ratio.toFixed(6)}x`
  );

  // 5. The rects do not overlap each other, because an overlapping pair would make the span a
  //    statement about one region twice.
  const entries = Object.entries(BACKDROP_RECTS);
  let overlaps = 0;
  for (let i = 0; i < entries.length; i += 1) {
    for (let j = i + 1; j < entries.length; j += 1) {
      const [ax, ay, aw, ah] = entries[i][1];
      const [cx, cy, cw, ch] = entries[j][1];
      if (ax < cx + cw && cx < ax + aw && ay < cy + ch && cy < ay + ah) overlaps += 1;
    }
  }
  say(overlaps === 0, 'the backdrop rects are disjoint', `${overlaps} overlapping pairs`);

  console.log(failures === 0 ? '\nall clauses green' : `\n${failures} FAILED`);
  return failures;
}

// --- entry --------------------------------------------------------------------------------------

function flag(name, fallback = null) {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? fallback : process.argv[i + 1];
}

if (SELFTEST) process.exit(selftest() === 0 ? 0 : 1);

const urlBase = flag('url-base');
const out = path.resolve(flag('out', path.join(REPO, 'captures', 'interior-probe')));
const scene = flag('scene', 'kitchen');

if (urlBase === null) {
  console.log(
    'pass --selftest, or --url-base <origin+path-to-avatar-plate.html> --out <dir> plus one of ' +
      '--backdrop / --sun / --exposure / --red / --rects'
  );
  process.exit(1);
}

const { chromium } = await loadPlaywright();
const browser = await chromium.launch({ channel: 'chromium', args: GPU_ARGS() });

function GPU_ARGS() {
  return [
    '--enable-unsafe-webgpu',
    '--enable-features=Vulkan',
    '--use-angle=default',
    '--use-gl=angle',
    '--ignore-gpu-blocklist',
    '--enable-gpu-rasterization',
  ];
}

try {
  if (process.argv.includes('--backdrop')) await runBackdrop(browser, urlBase, out, scene);
  if (process.argv.includes('--sun')) {
    const list = (flag('elevations', '4,10,15,22,30,45,60') ?? '').split(',').map(Number);
    await runSun(browser, urlBase, out, scene, list);
  }
  if (process.argv.includes('--exposure')) {
    const list = (flag('ladder', '1,1.6,2.4,3.4,4.6') ?? '').split(',').map(Number);
    await runExposure(browser, urlBase, out, scene, list);
  }
  if (process.argv.includes('--between')) {
    await runBetween(browser, urlBase, out, (flag('scenes', 'studio,beach,park,kitchen') ?? '').split(','));
  }
  if (process.argv.includes('--red')) await runRed(browser, urlBase, out, scene);
  if (process.argv.includes('--rects')) {
    const a = await arm(browser, urlBase, `scene=${scene}`, `${out}/${scene}-rects.png`);
    drawRects(a.file, a.file);
  }
} finally {
  await browser.close();
}
