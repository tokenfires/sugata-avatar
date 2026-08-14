#!/usr/bin/env node
//
// hair-lightpath.mjs — what light actually reaches a HAIR pixel, term by term and lobe by lobe.
//
// ## The question
//
// R25's blind judge answered "one broad band or broken across bundles?" with a third option:
// *there is no lobe*. Two rounds shaded a term that is not rendering. Before any further highlight
// work, something has to establish what a hair fragment RECEIVES — and the leading hypothesis when
// this file was written was that a custom TSL `LightingModel` never sees three's `RectAreaLight`,
// which would strand 77% of the rig's energy outside the hair shader.
//
// That hypothesis is answerable two ways and this tool takes the second, because reading source is
// not evidence:
//
//   1. FROM SOURCE — `LightingModel.directRectArea` is the separate entry point, and
//      `HairLightingModel` either implements it or it does not. Reported by `--entrypoints`,
//      which greps the installed tree and our material rather than restating what a reader
//      remembers.
//   2. FROM PIXELS — zero each light on the LIVE page and read the delta on a hair rect and on a
//      skin rect in the same light, side by side. `--decompose`.
//
// ## Why the lights are zeroed in the page rather than through `?ov=`
//
// `?ov=key.irradiance:0` is the obvious lever and it is CONFOUNDED. `LightingRig.aimAt` sets
// `ambientLight.intensity = irradianceOf('key') * ambientFractionOfKey`, and `describeAmbient()`
// — which is what `render/GTAO.js`'s composite ambient is built from — reads the same product. So
// moving the key's authored irradiance moves the ambient term as well, and a "leave one out" arm
// would be leaving two out. `window.sugata.lights.units` exposes the built `RectAreaLight` and its
// co-located `SpotLight` directly; setting `intensity = 0` on one of them touches exactly one
// light, and `aimAt` is called only on a framing change, so the mutation survives the frame loop.
//
// Every arm is rendered from ONE page load, so the groom, the seed, the skinning and the temporal
// state are shared by construction. `--decompose` verifies that by re-rendering the base arm last
// and requiring it to reproduce.
//
// ## What this tool does not do
//
// It does not re-derive the ACES inverse, the groom mask or the additivity proof. Those live in
// `lightpath-probe.mjs`, they are validated there, and they are imported. This file adds exactly
// two operators — `erodeMask` and `pixelsInMask` — and both are validated below against synthetic
// fields whose answer is arithmetic, and reported by `--selftest`.
//
// ## Usage
//
//   node tools/critic/hair-lightpath.mjs --selftest
//   node tools/critic/hair-lightpath.mjs --entrypoints
//   node tools/critic/hair-lightpath.mjs --masks   --port 5176 --out captures/hair-lightpath
//   node tools/critic/hair-lightpath.mjs --decompose --port 5176 --out captures/hair-lightpath
//   node tools/critic/hair-lightpath.mjs --lobes     --port 5176 --out captures/hair-lightpath

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { decodePng, encodePng } from './png.mjs';
import {
  buildGroomMask,
  codesAt,
  isInvertible,
  loadPlaywright,
  luminance,
  openPage,
  plate,
  plateToSceneLinear,
  readPlate,
  GPU_FLAGS,
  REPO,
} from './lightpath-probe.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));

const WIDTH = 720;
const HEIGHT = 900;
const STEPS = 8;

/** The shipped judged URL. Every plate in `captures/hair-r24-before` and r25 carries this shape. */
const BASE_QUERY = 'bare&freeze&seed=1&capture&aa=msaa&grade=0';

// --- the two new operators ---------------------------------------------------------------------

/**
 * Shrink a mask by one pixel in all eight directions.
 *
 * 🎯 THIS IS THE OPERATOR THAT DECIDES WHETHER A "HAIR" READING IS HAIR. `buildGroomMask` DILATES,
 * because its job is to throw away everything the groom touches so a SKIN mean is clean. Inverting
 * a dilated mask and calling the result "hair" keeps every antialiased card edge — a pixel that is
 * part skin, part card and part background — and a mean over those measures the compositing, not
 * the shading. Eroding the dilated mask by one returns approximately the raw coverage, and eroding
 * twice guarantees the reading is interior.
 *
 * @param {Uint8Array} mask - 1 where the feature is
 * @param {number} width
 * @param {number} height
 * @param {number} [rounds=1]
 * @returns {Uint8Array}
 */
export function erodeMask(mask, width, height, rounds = 1) {
  let current = mask;
  for (let r = 0; r < rounds; r += 1) {
    const next = new Uint8Array(width * height);
    for (let y = 1; y < height - 1; y += 1) {
      for (let x = 1; x < width - 1; x += 1) {
        let all = 1;
        for (let dy = -1; dy <= 1 && all === 1; dy += 1) {
          for (let dx = -1; dx <= 1; dx += 1) {
            if (current[(y + dy) * width + x + dx] === 0) {
              all = 0;
              break;
            }
          }
        }
        next[y * width + x] = all;
      }
    }
    current = next;
  }
  return current;
}

/**
 * The pixels of a rect that are IN a mask (or out of it) and invertible in every supplied plate.
 *
 * The sibling of `lightpath-probe.mjs`'s `usablePixels`, which hard-codes "out of the groom mask"
 * because it only ever measured skin. Returned as an index list for the same reason: every arm
 * must be read over the identical pixel set or the decomposition is comparing two populations.
 */
export function pixelsInMask(rect, width, mask, want, plates) {
  const [x0, y0, w, h] = rect;
  const set = [];
  let rejectedMask = 0;
  let rejectedClipped = 0;
  for (let y = y0; y < y0 + h; y += 1) {
    for (let x = x0; x < x0 + w; x += 1) {
      const k = y * width + x;
      if (mask[k] !== want) {
        rejectedMask += 1;
        continue;
      }
      let ok = true;
      for (const png of plates) {
        if (isInvertible(codesAt(png, k * 4)) === false) {
          ok = false;
          break;
        }
      }
      if (ok === false) {
        rejectedClipped += 1;
        continue;
      }
      set.push(k);
    }
  }
  return { set, rejectedMask, rejectedClipped, total: w * h };
}

/** Mean scene-linear luminance over an index list. Same currency as `lightpath-probe`. */
export function meanLuminance(png, set) {
  let sum = 0;
  for (const k of set) sum += luminance(plateToSceneLinear(codesAt(png, k * 4)));
  return sum / set.length;
}

/** Per-pixel scene-linear luminance over an index list, for peak / percentile work. */
export function luminances(png, set) {
  return set.map((k) => luminance(plateToSceneLinear(codesAt(png, k * 4))));
}

export function percentile(sorted, q) {
  if (sorted.length === 0) return NaN;
  const i = Math.min(sorted.length - 1, Math.max(0, Math.round(q * (sorted.length - 1))));
  return sorted[i];
}

// --- the browser side ---------------------------------------------------------------------------

/**
 * Every light the rig built, as a flat list a page-side mutation can address by index.
 *
 * Read off `window.sugata.lights.units` rather than by walking the scene, because a unit knows
 * which `SpotLight` is the shadow half of which panel and a scene walk does not.
 */
const CENSUS_SCRIPT = `(() => {
  const rig = window.sugata.lights;
  const scene = window.sugata.stage.scene;
  const lights = [];
  scene.traverse((o) => { if (o.isLight) lights.push({
    type: o.type, name: o.name, intensity: o.intensity, castShadow: !!o.castShadow }); });
  return {
    units: rig.units.map((u) => ({
      name: u.placement.name,
      shadowFraction: u.placement.shadowFraction,
      irradiance: u.placement.irradiance,
      areaType: u.area.type,
      areaIntensity: u.area.intensity,
      shadowCaster: u.shadowCaster === null ? null
        : { type: u.shadowCaster.type, intensity: u.shadowCaster.intensity, castShadow: u.shadowCaster.castShadow },
    })),
    describe: rig.describe(),
    // The light directions as the SHADER sees them: unit vectors from the focus to each panel and
    // to each shadow caster, in world space, read off the built objects rather than recomputed
    // from the placement angles. A sweep that guesses an elevation is a sweep about a rig that
    // does not exist — the first draft of this file guessed 34 / 10 / 20 / 20 against the real
    // 18 / 2 / 26 / -6.
    focus: rig.focus.toArray(),
    directions: rig.units.map((u) => ({
      name: u.placement.name,
      area: u.area.position.clone().sub(rig.focus).normalize().toArray(),
      spot: u.shadowCaster === null ? null : u.shadowCaster.position.clone().sub(rig.focus).normalize().toArray(),
    })),
    cameraPosition: window.sugata.stage.camera.position.toArray(),
    ambientLightAttached: rig.ambientLight !== null,
    describeAmbient: rig.describeAmbient(),
    sceneLights: lights,
    environment: scene.environment === null ? null : String(scene.environment.type ?? 'set'),
    environmentNode: scene.environmentNode == null ? null : 'set',
    backgroundNode: scene.backgroundNode == null ? null : 'set',
    shadowMapEnabled: window.sugata.stage.renderer.shadowMap.enabled,
    toneMapping: window.sugata.stage.renderer.toneMapping,
    toneMappingExposure: window.sugata.stage.renderer.toneMappingExposure,
    subsystems: window.sugata.subsystems(),
  };
})()`;

/**
 * Sets light intensities, addressed the way `units` is structured, and READS THEM BACK.
 *
 * 🚩 THE READ-BACK IS NOT DECORATION. The first version of this passed the function as a STRING to
 * `page.evaluate`, the way `CENSUS_SCRIPT` is passed. Playwright evaluates a string as an
 * EXPRESSION and drops the argument, so every arm silently rendered the base rig: the first
 * decomposition run came back with all six probes reading `residual (all off) = 100.00%`, which
 * would have been reported as "no light reaches anything, including skin" — a spectacular false
 * finding, caught only because the skin control said it too. `caller` now passes a real function
 * and this returns the post-write intensity so the caller can assert the write landed.
 */
function setIntensities(spec) {
  const rig = window.sugata.lights;
  const changed = [];
  for (const { name, half, value } of spec) {
    const unit = rig.units.find((u) => u.placement.name === name);
    if (unit === undefined) throw new Error(`no unit ${name}`);
    const light = half === 'area' ? unit.area : unit.shadowCaster;
    if (light === null || light === undefined) throw new Error(`no ${half} half on ${name}`);
    const from = light.intensity;
    light.intensity = value;
    changed.push({ name, half, from, wrote: value, readBack: light.intensity });
  }
  return changed;
}

/** The arms, as a list of `{ label, zero: [[name, half], ...] }`. `zero` is leave-one-out. */
function decompositionArms(units) {
  const arms = [{ label: 'base', zero: [] }];
  for (const unit of units) {
    arms.push({ label: `no-${unit.name}-area`, zero: [[unit.name, 'area']] });
    if (unit.shadowCaster !== null) arms.push({ label: `no-${unit.name}-spot`, zero: [[unit.name, 'spot']] });
  }
  const all = [];
  for (const unit of units) {
    all.push([unit.name, 'area']);
    if (unit.shadowCaster !== null) all.push([unit.name, 'spot']);
  }
  arms.push({ label: 'all-lights-off', zero: all });
  // The base arm again, LAST, so drift over the run is measured rather than assumed.
  arms.push({ label: 'base-repeat', zero: [] });
  return { arms, all };
}

/**
 * 🚩 `__SUGATA_STEP__` EXISTS BEFORE THE FIGURE DOES, AND IT RETURNS `false` UNTIL IT DOES.
 *
 * `lightpath-probe.mjs`'s `openPage` waits for the function and `plate()` ignores its return value,
 * so a plate taken straight after the wait is a screenshot of an empty stage. It is not subtle —
 * the first run of this file produced four uniform RGB(10,10,12) plates — but it is silent, and
 * `capture.mjs:718` treats the same `false` as a hard error for exactly this reason.
 */
async function waitForFigure(page) {
  await page.waitForFunction(
    async () => (await globalThis.__SUGATA_STEP__(0)) === true,
    null,
    { timeout: 180_000, polling: 250 }
  );
}

async function withPage(port, query, fn) {
  const { chromium } = await loadPlaywright();
  // 🚩 `channel: 'chromium'` IS LOAD-BEARING AND ITS ABSENCE IS SILENT. Playwright's default
  // headless build is `headless_shell`, which has no GPU: the page still boots, still reports a
  // `WebGPUBackend` and still returns `true` from `__SUGATA_STEP__`, and every plate comes back a
  // uniform RGB(10,10,12). `capture.mjs:1543` carries the same line and the same reason.
  const browser = await chromium.launch({ channel: 'chromium', args: GPU_FLAGS });
  try {
    const url = `http://localhost:${port}/alive.html?${query}`;
    const { context, page, errors } = await openPage(browser, url, { width: WIDTH, height: HEIGHT });
    try {
      await waitForFigure(page);
      const out = await fn(page, url);
      if (errors.length > 0) console.log(`  page errors: ${errors.join(' | ')}`);
      return out;
    } finally {
      await context.close();
    }
  } finally {
    await browser.close();
  }
}

/** The `?shadows=0` pair the groom mask is built from, plus the base hair-on and hair-off plates. */
async function captureMasks(port, out) {
  fs.mkdirSync(out, { recursive: true });
  const jobs = [
    ['C-hairoff-noshadows.png', `${BASE_QUERY}&shadows=0`],
    ['D-hairon-noshadows.png', `${BASE_QUERY}&shadows=0&hair=1`],
    ['A-hairoff.png', `${BASE_QUERY}`],
    ['B-hairon.png', `${BASE_QUERY}&hair=1`],
  ];
  for (const [file, query] of jobs) {
    // eslint-disable-next-line no-await-in-loop
    await withPage(port, query, async (page, url) => {
      await plate(page, path.join(out, file), STEPS);
      console.log(`  ${file}  <- ${url}`);
    });
  }
}

/** A visual the rect choice is made from: hair mask in red, skin mask in green, rects outlined. */
function writeOverlay(out, rects) {
  const bald = readPlate(path.join(out, 'C-hairoff-noshadows.png'));
  const haired = readPlate(path.join(out, 'D-hairon-noshadows.png'));
  const shipped = readPlate(path.join(out, 'B-hairon.png'));
  const dilated = buildGroomMask(bald, haired);
  const solidHair = loadMasks(out).hairShaded;
  const bytes = new Uint8Array(WIDTH * HEIGHT * 4);
  for (let k = 0; k < WIDTH * HEIGHT; k += 1) {
    const i = k * 4;
    const r = shipped.pixels[i] * 255;
    const g = shipped.pixels[i + 1] * 255;
    const b = shipped.pixels[i + 2] * 255;
    const hair = solidHair[k] === 1;
    const skin = dilated[k] === 0;
    bytes[i] = Math.min(255, r + (hair ? 90 : 0));
    bytes[i + 1] = Math.min(255, g + (skin ? 45 : 0));
    bytes[i + 2] = b;
    bytes[i + 3] = 255;
  }
  for (const [label, rect] of Object.entries(rects)) {
    const [x0, y0, w, h] = rect;
    for (let x = x0; x < x0 + w; x += 1) {
      for (const y of [y0, y0 + h - 1]) {
        const i = (y * WIDTH + x) * 4;
        bytes[i] = 255; bytes[i + 1] = 255; bytes[i + 2] = 0;
      }
    }
    for (let y = y0; y < y0 + h; y += 1) {
      for (const x of [x0, x0 + w - 1]) {
        const i = (y * WIDTH + x) * 4;
        bytes[i] = 255; bytes[i + 1] = 255; bytes[i + 2] = 0;
      }
    }
    void label;
  }
  const file = path.join(out, 'probe-rects.png');
  fs.writeFileSync(file, encodePng(WIDTH, HEIGHT, bytes));
  console.log(`  wrote ${file}`);
}

/** Nearest-neighbour crop, so a rect is looked at as pixels. Same rule as the judge brief. */
function crop(file, rect, scale, dest) {
  const png = decodePng(fs.readFileSync(file));
  const [x0, y0, w, h] = rect;
  const bytes = new Uint8Array(w * scale * h * scale * 4);
  for (let y = 0; y < h * scale; y += 1) {
    for (let x = 0; x < w * scale; x += 1) {
      const src = ((y0 + Math.floor(y / scale)) * png.width + x0 + Math.floor(x / scale)) * 4;
      const dst = (y * w * scale + x) * 4;
      for (let c = 0; c < 4; c += 1) bytes[dst + c] = Math.round(png.pixels[src + c] * 255);
    }
  }
  fs.writeFileSync(dest, encodePng(w * scale, h * scale, bytes));
  return dest;
}

/**
 * The shape statistic, factored out so the selftest can run it on fields whose answer is known.
 *
 * A specular lobe is a SHAPE, not a quantity: a compact locus whose radiance is a large multiple
 * of the mass around it. `peakOverMassMean` and `fractionAbove(4)` are the two numbers that say so,
 * and `--selftest` holds them to three synthetic fields — flat, flat plus a band, and flat plus
 * isotropic noise carrying the SAME added energy as the band. The third is the clause that matters:
 * R25's `coherentLock` was retired because it rose on isotropic noise, and a shape statistic that
 * cannot tell a band from noise of equal energy is the same failure wearing a different name.
 */
export function bandShape(values, massMean) {
  const sorted = [...values].sort((a, b) => a - b);
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const max = sorted[sorted.length - 1];
  return {
    mean,
    max,
    peakOverOwnMean: max / mean,
    peakOverMassMean: max / massMean,
    above2: values.filter((v) => v > 2 * mean).length / values.length,
    above4: values.filter((v) => v > 4 * mean).length / values.length,
    p999: percentile(sorted, 0.999),
  };
}

// --- selftest -----------------------------------------------------------------------------------

function selftest() {
  let failures = 0;
  const say = (ok, label, detail) => {
    if (!ok) failures += 1;
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}  ${detail}`);
  };

  // erodeMask, on a shape whose answer is arithmetic. A solid 10x10 square eroded once is 8x8,
  // eroded twice is 6x6. Nothing about that is a judgement call.
  {
    const W = 40;
    const H = 40;
    const mask = new Uint8Array(W * H);
    for (let y = 10; y < 20; y += 1) for (let x = 10; x < 20; x += 1) mask[y * W + x] = 1;
    const count = (m) => m.reduce((a, b) => a + b, 0);
    say(count(mask) === 100, 'erode: the synthetic square is 10x10', `${count(mask)} px`);
    say(count(erodeMask(mask, W, H, 1)) === 64, 'erode once: 10x10 -> 8x8', `${count(erodeMask(mask, W, H, 1))} px, expected 64`);
    say(count(erodeMask(mask, W, H, 2)) === 36, 'erode twice: 10x10 -> 6x6', `${count(erodeMask(mask, W, H, 2))} px, expected 36`);

    // A one-pixel-wide line has no interior and must vanish. This is the clause that matters for
    // hair: a card seen edge-on IS a one-pixel line, and a mask operator that keeps it would let
    // a partially-covered pixel into a "solid hair" mean.
    const line = new Uint8Array(W * H);
    for (let y = 5; y < 35; y += 1) line[y * W + 20] = 1;
    say(count(erodeMask(line, W, H, 1)) === 0, 'erode: a 1 px line has no interior', `${count(erodeMask(line, W, H, 1))} px, expected 0`);
  }

  // pixelsInMask, against a field whose two populations are painted at known values.
  //
  // RED PROOF: ask for the WRONG population and the mean must land on the other paint. A selector
  // that quietly returned everything would read the average of the two and pass nothing.
  {
    const W = 60;
    const H = 40;
    const field = (paint) => {
      const px = new Float32Array(W * H * 4);
      for (let y = 0; y < H; y += 1) {
        for (let x = 0; x < W; x += 1) {
          const i = (y * W + x) * 4;
          const v = paint(x, y) / 255;
          px[i] = v; px[i + 1] = v; px[i + 2] = v; px[i + 3] = 1;
        }
      }
      return { width: W, height: H, pixels: px };
    };
    const mask = new Uint8Array(W * H);
    for (let y = 10; y < 30; y += 1) for (let x = 10; x < 30; x += 1) mask[y * W + x] = 1;
    const png = field((x, y) => (mask[y * W + x] === 1 ? 40 : 200));
    const rect = [5, 5, 30, 30];

    const inside = pixelsInMask(rect, W, mask, 1, [png]);
    const outside = pixelsInMask(rect, W, mask, 0, [png]);
    const expectIn = luminance(plateToSceneLinear([40, 40, 40]));
    const expectOut = luminance(plateToSceneLinear([200, 200, 200]));
    say(inside.set.length === 400, 'pixelsInMask: want=1 finds exactly the painted square', `${inside.set.length} px, expected 400`);
    say(
      Math.abs(meanLuminance(png, inside.set) - expectIn) / expectIn < 1e-6,
      'pixelsInMask: want=1 reads the dark paint exactly',
      `${meanLuminance(png, inside.set).toExponential(4)} against ${expectIn.toExponential(4)}`
    );
    say(
      Math.abs(meanLuminance(png, outside.set) - expectOut) / expectOut < 1e-6,
      'pixelsInMask: want=0 reads the light paint exactly',
      `${meanLuminance(png, outside.set).toExponential(4)} against ${expectOut.toExponential(4)}`
    );
    const mixed = [];
    for (let y = 5; y < 35; y += 1) for (let x = 5; x < 35; x += 1) mixed.push(y * W + x);
    const mixedMean = meanLuminance(png, mixed);
    say(
      mixedMean > expectIn * 2 && mixedMean < expectOut,
      'RED PROOF: no mask at all reads neither population',
      `${mixedMean.toExponential(4)} sits between ${expectIn.toExponential(4)} and ${expectOut.toExponential(4)} — a rect without a mask measures the mixture`
    );

    // Clipping guard: a plate with a blown channel inside the square must lose those pixels.
    const blown = field((x, y) => (x >= 12 && x < 18 && y >= 12 && y < 18 ? 255 : (mask[y * W + x] === 1 ? 40 : 200)));
    const guarded = pixelsInMask(rect, W, mask, 1, [png, blown]);
    say(
      guarded.set.length === 400 - 36 && guarded.rejectedClipped === 36,
      'pixelsInMask: a clipped pixel in ANY arm is dropped from ALL',
      `${guarded.set.length} px, ${guarded.rejectedClipped} rejected, expected 364 / 36`
    );
  }

  // bandShape, on three fields whose answers are arithmetic — and the third is the red proof.
  //
  // A 200x200 groom at a flat 1.0. Then a 200x12 band at +4.0, which is 6% of the area carrying
  // 24% more energy. Then isotropic noise of the SAME added energy spread over the whole field.
  // A statistic that reports the band and the noise the same way is measuring energy, not shape.
  {
    const N = 200;
    const flat = new Array(N * N).fill(1);
    const massMean = 1;

    const band = flat.map((v, i) => {
      const y = Math.floor(i / N);
      return y >= 100 && y < 112 ? v + 4 : v;
    });

    // Same added energy: 200 x 12 x 4 = 9600, spread over 40000 pixels = +0.24 each, delivered as
    // a two-valued isotropic scatter (half the pixels get +0.48, half get 0) so it has variance
    // rather than being another flat lift.
    const noisy = flat.map((v, i) => (i % 2 === 0 ? v + 0.48 : v));

    const f = bandShape(flat, massMean);
    const b = bandShape(band, massMean);
    const n = bandShape(noisy, massMean);

    say(
      Math.abs(f.peakOverOwnMean - 1) < 1e-12 && f.above2 === 0,
      'bandShape: a flat field has no peak',
      `peak/mean ${f.peakOverOwnMean.toFixed(6)}, above 2x ${(f.above2 * 100).toFixed(4)}%`
    );
    // Arithmetic: the banded field's mean is 1 + 4*12/200 = 1.24, its max is 5, so peak/mean is
    // 5/1.24 = 4.032258, and 6% of the field sits above 2x that mean.
    say(
      Math.abs(b.peakOverOwnMean - 5 / 1.24) < 1e-9 && Math.abs(b.above2 - 0.06) < 1e-9,
      'bandShape: a 6% band at +4 reads its arithmetic peak and extent',
      `peak/mean ${b.peakOverOwnMean.toFixed(6)} against 4.032258, above 2x ${(b.above2 * 100).toFixed(4)}% against 6%`
    );
    say(
      Math.abs(b.peakOverMassMean - 5) < 1e-9,
      'bandShape: peak against the MASS mean is the number a judge would see',
      `${b.peakOverMassMean.toFixed(6)} against the painted 5`
    );
    // RED PROOF. Same added energy, no shape. peak/mean must stay near 1 and nothing above 2x.
    say(
      n.peakOverOwnMean < 1.3 && n.above2 === 0 && Math.abs(n.mean - b.mean) < 1e-9,
      'RED PROOF: isotropic noise of the SAME added energy does not read as a band',
      `noise peak/mean ${n.peakOverOwnMean.toFixed(4)} and above-2x ${(n.above2 * 100).toFixed(4)}% ` +
      `against the band's ${b.peakOverOwnMean.toFixed(4)} / ${(b.above2 * 100).toFixed(4)}% — ` +
      `identical means ${n.mean.toFixed(6)} vs ${b.mean.toFixed(6)}`
    );
  }

  console.log(failures === 0 ? '\nall clauses green' : `\n${failures} FAILED`);
  return failures;
}

// --- entry point sweep of the installed tree ----------------------------------------------------

function entrypoints() {
  const files = {
    'LightingModel (the contract)': 'node_modules/three/src/nodes/core/LightingModel.js',
    AnalyticLightNode: 'node_modules/three/src/nodes/lighting/AnalyticLightNode.js',
    LightsNode: 'node_modules/three/src/nodes/lighting/LightsNode.js',
    RectAreaLightNode: 'node_modules/three/src/nodes/lighting/RectAreaLightNode.js',
    HemisphereLightNode: 'node_modules/three/src/nodes/lighting/HemisphereLightNode.js',
    AmbientLightNode: 'node_modules/three/src/nodes/lighting/AmbientLightNode.js',
    EnvironmentNode: 'node_modules/three/src/nodes/lighting/EnvironmentNode.js',
    IrradianceNode: 'node_modules/three/src/nodes/lighting/IrradianceNode.js',
    HairMaterial: 'packages/core/src/material/HairMaterial.js',
  };
  const patterns = [
    /\bdirect\s*\(/, /\bdirectRectArea\s*\(/, /\bindirect\s*\(/, /\bambientOcclusion\s*\(/,
    /context\.irradiance/, /context\.iblIrradiance/, /context\.radiance/,
    /setupDirect\b/, /setupDirectRectArea\b/, /setupDirectRectAreaLight\b/, /setupDirectLight\b/,
  ];
  for (const [label, rel] of Object.entries(files)) {
    const full = path.join(REPO, rel);
    if (fs.existsSync(full) === false) {
      console.log(`\n${label}  MISSING ${rel}`);
      continue;
    }
    const lines = fs.readFileSync(full, 'utf8').split('\n');
    console.log(`\n=== ${label}  ${rel}`);
    lines.forEach((line, i) => {
      if (line.trimStart().startsWith('*')) return;
      if (patterns.some((p) => p.test(line))) console.log(`  :${i + 1}  ${line.trim()}`);
    });
  }
}

// --- decomposition ------------------------------------------------------------------------------

async function decompose(port, out, rects) {
  fs.mkdirSync(path.join(out, 'arms'), { recursive: true });
  const census = await withPage(port, `${BASE_QUERY}&hair=1`, async (page) => {
    const c = await page.evaluate(CENSUS_SCRIPT);
    fs.writeFileSync(path.join(out, 'census.json'), JSON.stringify(c, null, 2));
    const { arms } = decompositionArms(c.units);
    for (const arm of arms) {
      // Reset every light to its census value, then zero the arm's targets. Reset first so the
      // arms are independent of the order they are rendered in.
      const reset = [];
      for (const u of c.units) {
        reset.push({ name: u.name, half: 'area', value: u.areaIntensity });
        if (u.shadowCaster !== null) reset.push({ name: u.name, half: 'spot', value: u.shadowCaster.intensity });
      }
      // eslint-disable-next-line no-await-in-loop
      await page.evaluate(setIntensities, reset);
      const wanted = arm.zero.map(([name, half]) => ({ name, half, value: 0 }));
      // eslint-disable-next-line no-await-in-loop
      const wrote = await page.evaluate(setIntensities, wanted);
      if (wrote.length !== wanted.length || wrote.some((w) => w.readBack !== 0)) {
        throw new Error(`arm ${arm.label}: the zeroing did not land — ${JSON.stringify(wrote)}`);
      }
      // eslint-disable-next-line no-await-in-loop
      await plate(page, path.join(out, 'arms', `${arm.label}.png`), STEPS);
      console.log(`  arm ${arm.label}`);
    }
    return c;
  });
  reportDecomposition(out, rects, census);
}

/**
 * 🚩 THE GATE THAT SEPARATES "INSIDE THE GROOM" FROM "SHADED BY THE HAIR MATERIAL", AND WITHOUT IT
 * 17.6% OF EVERY HAIR READING IN THIS FILE IS SKIN.
 *
 * The groom mask is a COVERAGE statement: these are the pixels the groom changed. It is not a
 * statement about which material shaded them. The shipped OIT mode is `stochastic`, so an interior
 * pixel of the mass can resolve to whatever is behind it — the scalp under the crown, the cheek
 * under a fall — and a mean over the mask then averages hair with skin. It showed up as a `max`
 * that was IDENTICAL in all six lobe arms including the one with the whole BSDF switched off.
 *
 * The discriminator is that arm: with `?hairlobes=&hairscatter=0` the hair material emits nothing
 * but 3.10's composite indirect, which on a `#1A0E0C` fibre is worth about 2e-3 of scene
 * luminance, while lit skin is worth 3e-1 to 5e-1. THE THRESHOLD IS NOT A TASTE VALUE: over the
 * 288,866 invertible pixels of the eroded mask the histogram of that arm is bimodal with a
 * MEASURED EMPTY BAND — 0 pixels in [1.34e-2, 2.50e-2] — and `--gate` prints the occupancy either
 * side so a reader can check that the cut lands in the hole rather than on a slope.
 *
 * ⚠️ It is not circular for the lobe shares. The cut is made on the arm where every lobe is OFF,
 * so it cannot select for pixels where a particular lobe is strong; it selects for pixels the hair
 * material is drawing at all.
 */
const HAIR_SHADED_MAX = 1.5e-2;

function loadMasks(out) {
  const bald = readPlate(path.join(out, 'C-hairoff-noshadows.png'));
  const haired = readPlate(path.join(out, 'D-hairon-noshadows.png'));
  const dilated = buildGroomMask(bald, haired);
  const solidHair = erodeMask(dilated, WIDTH, HEIGHT, 2);

  // The gate needs the lobes-off plate. When it has not been captured yet the mask is returned
  // ungated and SAYS SO, rather than silently reading skin as hair.
  const floorFile = path.join(out, 'lobes', 'nothing-indirect-only-.png');
  if (fs.existsSync(floorFile) === false) {
    console.log('  ⚠️  no lobes-off plate — the hair mask is UNGATED and will include stochastic leak');
    return { dilated, solidHair, hairShaded: solidHair, gate: null };
  }

  const floorPlate = readPlate(floorFile);
  const hairShaded = new Uint8Array(WIDTH * HEIGHT);
  let inside = 0;
  let kept = 0;
  let leaked = 0;
  let band = 0;
  for (let k = 0; k < WIDTH * HEIGHT; k += 1) {
    if (solidHair[k] !== 1) continue;
    const codes = codesAt(floorPlate, k * 4);
    if (isInvertible(codes) === false) continue;
    inside += 1;
    const v = luminance(plateToSceneLinear(codes, LOBE_EXPOSURE));
    if (v > 1.0e-2 && v < 2.5e-2) band += 1;
    if (v < HAIR_SHADED_MAX) {
      hairShaded[k] = 1;
      kept += 1;
    } else {
      leaked += 1;
    }
  }
  const gate = { inside, kept, leaked, band };
  return { dilated, solidHair, hairShaded, gate };
}

function reportGate(gate) {
  if (gate === null) return;
  console.log(
    `  GATE  ${gate.inside} invertible pixels inside the eroded groom mask: ${gate.kept} shaded by ` +
    `HairMaterial (${((gate.kept / gate.inside) * 100).toFixed(2)}%), ${gate.leaked} resolving to ` +
    `something behind it (${((gate.leaked / gate.inside) * 100).toFixed(2)}%), and ${gate.band} in the ` +
    `separating band [1.0e-2, 2.5e-2] the cut sits in`
  );
}

function reportDecomposition(out, rects, census) {
  const { dilated, hairShaded, gate } = loadMasks(out);
  reportGate(gate);
  const { arms } = decompositionArms(census.units);
  const plates = {};
  for (const arm of arms) plates[arm.label] = readPlate(path.join(out, 'arms', `${arm.label}.png`));

  // 🚩 TWO PIXEL SETS, AND THE REASON IS A REAL BIAS THAT THE FIRST RUN OF THIS FILE HAD.
  //
  // `isInvertible` rejects any pixel that hit code 0 or code 255 in ANY arm, because `saturate` in
  // the tone-mapping shader is not recoverable at either end. On a HAIR rect the `all-lights-off`
  // arm is the ambient term alone on a `#1A0E0C` fibre, and 83% of those pixels quantise a channel
  // to zero — so requiring invertibility in that arm too keeps only the brightest sixth of the
  // rect and every share is then a share of the brightest sixth. The lit arms do not have that
  // problem.
  //
  // So: the per-light shares are read over WIDE — invertible in every arm that has lights in it —
  // and the residual over wide is INFERRED by subtraction. NARROW adds the dark arm, measures the
  // residual directly, and its closure is what licenses the inference. Both counts are printed.
  const litArms = arms.filter((a) => a.label !== 'all-lights-off');
  const litPlates = litArms.map((a) => plates[a.label]);
  const allPlates = arms.map((a) => plates[a.label]);

  for (const [label, spec] of Object.entries(rects)) {
    const mask = spec.kind === 'hair' ? hairShaded : dilated;
    const want = spec.kind === 'hair' ? 1 : 0;
    const wide = pixelsInMask(spec.rect, WIDTH, mask, want, litPlates);
    const narrow = pixelsInMask(spec.rect, WIDTH, mask, want, allPlates);
    console.log(`\n=== ${label}  ${spec.kind}  rect (${spec.rect.join(',')})`);
    console.log(
      `    WIDE ${wide.set.length} of ${wide.total} px (wrong population ${wide.rejectedMask}, clipped in a lit arm ${wide.rejectedClipped})` +
      `   NARROW ${narrow.set.length} px (adds the all-off arm)`
    );
    if (wide.set.length < 30) {
      console.log('    fewer than 30 usable pixels — not reported rather than reported badly');
      continue;
    }
    const base = meanLuminance(plates.base, wide.set);
    const repeat = meanLuminance(plates['base-repeat'], wide.set);
    console.log(`    base ${base.toExponential(4)}   base-repeat ${repeat.toExponential(4)}   drift ${(((repeat - base) / base) * 100).toFixed(3)}%`);
    let lit = 0;
    for (const arm of arms) {
      if (arm.zero.length !== 1) continue;
      const delta = base - meanLuminance(plates[arm.label], wide.set);
      lit += delta;
      console.log(`    ${arm.label.padEnd(18)} ${delta.toExponential(4)}  ${((delta / base) * 100).toFixed(2).padStart(7)}%`);
    }
    console.log(`    ${'ambient (inferred)'.padEnd(18)} ${(base - lit).toExponential(4)}  ${(((base - lit) / base) * 100).toFixed(2).padStart(7)}%   base minus the five leave-one-out deltas`);

    if (narrow.set.length < 30) {
      console.log('    NARROW has too few pixels to close on — the inferred residual stands unchecked here');
      continue;
    }
    const nBase = meanLuminance(plates.base, narrow.set);
    let nSum = meanLuminance(plates['all-lights-off'], narrow.set);
    for (const arm of arms) {
      if (arm.zero.length !== 1) continue;
      nSum += nBase - meanLuminance(plates[arm.label], narrow.set);
    }
    console.log(
      `    CLOSURE on NARROW: measured all-off ${meanLuminance(plates['all-lights-off'], narrow.set).toExponential(4)}, ` +
      `sum ${nSum.toExponential(4)} against base ${nBase.toExponential(4)} — ${(((nSum - nBase) / nBase) * 100).toFixed(2)}%`
    );
  }
}

// --- lobes ---------------------------------------------------------------------------------------

const LOBE_ARMS = [
  ['shipped', 'hairlobes=r,trt'],
  ['R only', 'hairlobes=r&hairscatter=0'],
  ['TRT only', 'hairlobes=trt&hairscatter=0'],
  ['TT only', 'hairlobes=tt&hairscatter=0'],
  ['scatter only', 'hairlobes=&hairscatter=1'],
  ['nothing (indirect only)', 'hairlobes=&hairscatter=0'],
];

/**
 * 🚩 THE LOBE ARMS ARE RENDERED AT `toneMappingExposure` 4 AND INVERTED AT 4, AND THAT IS NOT A
 * COSMETIC CHOICE.
 *
 * A single hair lobe on a `#1A0E0C` fibre lands between code 2 and code 12. `isInvertible` throws
 * away code 0 at the bottom because `saturate` is not recoverable there, and on the first run of
 * this decomposition that cost 83% of the H1 rect and 86% of H3 — leaving a "mean" over whichever
 * sixth of the rect happened to be brightest, which is the shape of failure this project has
 * banked eight times. Multiplying the scene by 4 before the curve and dividing by 4 after it is
 * the same radiance through a better-conditioned part of the transfer function.
 *
 * `plateToSceneLinear(codes, exposure)` already takes the exposure, and `--exposure-check` renders
 * the shipped arm at BOTH exposures and requires the recovered scene radiance to agree. That check
 * is what licenses the choice; without it this would be a premise in a comment.
 */
const LOBE_EXPOSURE = 4;

const SET_EXPOSURE = (value) => { window.sugata.stage.renderer.toneMappingExposure = value; };

async function lobes(port, out, exposure = LOBE_EXPOSURE) {
  fs.mkdirSync(path.join(out, 'lobes'), { recursive: true });
  for (const [label, extra] of LOBE_ARMS) {
    const file = path.join(out, 'lobes', `${label.replace(/[^a-z0-9]+/gi, '-')}.png`);
    // eslint-disable-next-line no-await-in-loop
    await withPage(port, `${BASE_QUERY}&hair=1&${extra}`, async (page, url) => {
      await page.evaluate(SET_EXPOSURE, exposure);
      await plate(page, file, STEPS);
      console.log(`  ${label}  <- ${url}   exposure ${exposure}`);
    });
  }
  // The shipped arm again at exposure 1, so the exposure trick is checked rather than assumed.
  await withPage(port, `${BASE_QUERY}&hair=1&hairlobes=r,trt`, async (page) => {
    await plate(page, path.join(out, 'lobes', 'shipped-exposure1.png'), STEPS);
    console.log('  shipped at exposure 1, for the check');
  });
}

function reportLobes(out, rects, exposure = LOBE_EXPOSURE) {
  const { hairShaded, gate } = loadMasks(out);
  reportGate(gate);
  const plates = {};
  for (const [label] of LOBE_ARMS) {
    plates[label] = readPlate(path.join(out, 'lobes', `${label.replace(/[^a-z0-9]+/gi, '-')}.png`));
  }
  const check = readPlate(path.join(out, 'lobes', 'shipped-exposure1.png'));
  const all = [...Object.values(plates), check];

  for (const [label, spec] of Object.entries(rects)) {
    if (spec.kind !== 'hair') continue;
    const strict = pixelsInMask(spec.rect, WIDTH, hairShaded, 1, all);
    const set = strict.set;
    console.log(`\n=== ${label}  rect (${spec.rect.join(',')})  ${set.length} of ${strict.total} px  (clipped ${strict.rejectedClipped})`);
    if (set.length < 30) {
      console.log('    fewer than 30 usable pixels — not reported rather than reported badly');
      continue;
    }

    const atFour = meanLuminance4(plates.shipped, set, exposure);
    const atOne = meanLuminance4(check, set, 1);
    console.log(
      `    EXPOSURE CHECK  shipped at exposure ${exposure} inverts to ${atFour.toExponential(4)}, ` +
      `at exposure 1 to ${atOne.toExponential(4)} — ${(((atFour - atOne) / atOne) * 100).toFixed(2)}% apart ` +
      `(the 8-bit floor on one reading is 2.33%)`
    );

    const shipped = luminances4(plates.shipped, set, exposure).sort((a, b) => a - b);
    const mean = shipped.reduce((a, b) => a + b, 0) / shipped.length;
    const floor = meanLuminance4(plates['nothing (indirect only)'], set, exposure);
    console.log(
      `    shipped mean ${mean.toExponential(4)}  p50 ${percentile(shipped, 0.5).toExponential(4)}  ` +
      `p95 ${percentile(shipped, 0.95).toExponential(4)}  p99 ${percentile(shipped, 0.99).toExponential(4)}  ` +
      `max ${shipped[shipped.length - 1].toExponential(4)}   max/mean ${(shipped[shipped.length - 1] / mean).toFixed(3)}`
    );
    for (const [name] of LOBE_ARMS) {
      const v = luminances4(plates[name], set, exposure).sort((a, b) => a - b);
      const m = v.reduce((a, b) => a + b, 0) / v.length;
      const net = name === 'nothing (indirect only)' ? m : m - floor;
      const netMax = name === 'nothing (indirect only)' ? v[v.length - 1] : v[v.length - 1] - floor;
      console.log(
        `    ${name.padEnd(24)} mean ${m.toExponential(4)}  NET ${net.toExponential(4)}  ` +
        `${((net / mean) * 100).toFixed(2).padStart(7)}% of shipped   ` +
        `net p99 ${(percentile(v, 0.99) - (name === 'nothing (indirect only)' ? 0 : floor)).toExponential(3)}  ` +
        `net max ${netMax.toExponential(3)}   max/mean ${(netMax / net).toFixed(2)}`
      );
    }
    const sum = LOBE_ARMS.filter(([n]) => n !== 'shipped' && n !== 'TT only')
      .reduce((a, [n]) => a + (n === 'nothing (indirect only)' ? 0 : meanLuminance4(plates[n], set, exposure) - floor), 0);
    console.log(
      `    ADDITIVITY  R + TRT + scatter + indirect = ${(sum + floor).toExponential(4)} against shipped ${mean.toExponential(4)}` +
      ` — ${(((sum + floor - mean) / mean) * 100).toFixed(2)}%   (TT is off in the shipped arm, so it is excluded)`
    );
  }
}

/** Mean scene-linear luminance at a given `toneMappingExposure`. */
export function meanLuminance4(png, set, exposure) {
  let sum = 0;
  for (const k of set) sum += luminance(plateToSceneLinear(codesAt(png, k * 4), exposure));
  return sum / set.length;
}

export function luminances4(png, set, exposure) {
  return set.map((k) => luminance(plateToSceneLinear(codesAt(png, k * 4), exposure)));
}

/**
 * The whole-groom lobe statistic, and the one that answers "IS THERE A LOBE".
 *
 * A specular lobe is not a quantity, it is a SHAPE: a compact locus whose radiance is a large
 * multiple of the mass around it. So this reports, over every gated hair pixel in the frame, the
 * distribution of each lobe's NET contribution — and specifically what fraction of the groom sits
 * above 2x and 4x that lobe's own mean. A real primary band puts a few per cent of the mass far
 * above its mean; a wash puts nothing there.
 *
 * The row profile is the second half of the same question. A band is a LATITUDE — it should show
 * as a peak in a horizontal-strip profile and fall away above and below it.
 */
function reportGroom(out, exposure = LOBE_EXPOSURE) {
  const { hairShaded, gate } = loadMasks(out);
  reportGate(gate);
  const plates = {};
  for (const [label] of LOBE_ARMS) {
    plates[label] = readPlate(path.join(out, 'lobes', `${label.replace(/[^a-z0-9]+/gi, '-')}.png`));
  }
  const all = Object.values(plates);
  const set = [];
  for (let k = 0; k < WIDTH * HEIGHT; k += 1) {
    if (hairShaded[k] !== 1) continue;
    if (all.every((q) => isInvertible(codesAt(q, k * 4)))) set.push(k);
  }
  console.log(`\n=== whole groom, ${set.length} gated hair pixels`);

  const floor = luminances4(plates['nothing (indirect only)'], set, exposure);
  const shipped = luminances4(plates.shipped, set, exposure);
  const massMean = shipped.reduce((a, b) => a + b, 0) / set.length;
  console.log(`    shipped mass mean ${massMean.toExponential(4)}`);

  for (const [name] of LOBE_ARMS) {
    const raw = luminances4(plates[name], set, exposure);
    const net = name === 'nothing (indirect only)' ? raw : raw.map((v, i) => v - floor[i]);
    const mean = net.reduce((a, b) => a + b, 0) / net.length;
    const sorted = [...net].sort((a, b) => a - b);
    const over = (f) => net.filter((v) => v > f * mean).length / net.length;
    console.log(
      `    ${name.padEnd(24)} net mean ${mean.toExponential(4)} = ${((mean / massMean) * 100).toFixed(2).padStart(6)}% of the mass   ` +
      `p99 ${percentile(sorted, 0.99).toExponential(3)}  p999 ${percentile(sorted, 0.999).toExponential(3)}  ` +
      `max ${sorted[sorted.length - 1].toExponential(3)}   max/mean ${(sorted[sorted.length - 1] / mean).toFixed(2)}   ` +
      `above 2x mean ${(over(2) * 100).toFixed(3)}%  above 4x ${(over(4) * 100).toFixed(4)}%   ` +
      `peak vs MASS mean ${(sorted[sorted.length - 1] / massMean).toFixed(2)}x`
    );
  }

  const rNet = luminances4(plates['R only'], set, exposure).map((v, i) => v - floor[i]);
  const rMean = rNet.reduce((a, b) => a + b, 0) / rNet.length;
  console.log('\n    R-lobe profile down the frame (a band would be a peak, not a ramp):');
  for (let y = 0; y < HEIGHT; y += 40) {
    let sum = 0;
    let n = 0;
    for (let i = 0; i < set.length; i += 1) {
      const yy = Math.floor(set[i] / WIDTH);
      if (yy >= y && yy < y + 40) { sum += rNet[i]; n += 1; }
    }
    if (n < 200) continue;
    const m = sum / n;
    console.log(`      y ${String(y).padStart(3)}-${String(y + 39).padStart(3)}  ${String(n).padStart(6)} px  ${m.toExponential(3)}  ${(m / rMean).toFixed(2)}x the R mean  ${'#'.repeat(Math.round((m / rMean) * 20))}`);
  }
}

/**
 * The three levers, each as ONE plate against the same R-only baseline.
 *
 * The lobe decomposition says R is present and is not a lobe. That leaves the question of what is
 * flattening it, and three named candidates are already on file. Each of these arms changes ONE
 * thing and nothing else:
 *
 *   - `hairvis=0` removes Karis' slide-47 `saturate(wi.wr + 1)` occlusion, which is the term
 *     `docs/OPEN-REQUESTS.md` REQ-063 says a rim shadow would retire. R's Fresnel is
 *     `fresnel(sqrt(0.5 + 0.5 wi.wr))` — it is LARGEST for a light opposite the view and smallest
 *     for one on the view axis — so this occlusion and R's own peak want opposite geometries by
 *     construction, and that is what this arm measures rather than argues.
 *   - `ov=key.azimuthDegrees:12` puts the key on the camera axis, which is REQ-064's proposal;
 *     12 is `CAMERA_AZIMUTH_DEGREES`, read from the repo rather than picked.
 *   - both together, because the two are not obviously independent: moving the key toward the view
 *     makes `wi.wr` positive, which is exactly where the occlusion does nothing anyway.
 */
const LEVER_ARMS = [
  ['R baseline', 'hairlobes=r&hairscatter=0'],
  ['R, no slide-47 occlusion', 'hairlobes=r&hairscatter=0&hairvis=0'],
  ['R, key on the camera axis', 'hairlobes=r&hairscatter=0&ov=key.azimuthDegrees:12'],
  ['R, both', 'hairlobes=r&hairscatter=0&hairvis=0&ov=key.azimuthDegrees:12'],
  ['TRT, key on the camera axis', 'hairlobes=trt&hairscatter=0&ov=key.azimuthDegrees:12'],
  ['shipped, key on the camera axis', 'hairlobes=r,trt&ov=key.azimuthDegrees:12'],

  // The fourth group removes one tangent-structure term each. Each is already isolated by
  // `HAIR_DEFECTS`, so the arms differ in one expression.
  //
  // 🔴 `constant-tangent` WAS NOMINATED AS THE POSITIVE CONTROL FOR THE SHAPE STATISTIC AND IT IS
  // NOT ONE. The reasoning was that this material's own rejection proof "welds the highlight to
  // the screen", so it should produce a large obvious band the statistic must find. It measured
  // FLATTER than the shipped arm — max/own-mean 1.77 against 2.51 — and the reason is arithmetic
  // rather than a defect: with one fixed VIEW-space tangent, `sinThetaR` is constant over the
  // whole frame and `sinThetaI` barely moves, so the longitudinal argument `sinThetaI + sinThetaR`
  // is very nearly constant everywhere and the lobe renders as a uniform wash. It is a control for
  // the highlight's ORIENTATION, which is what `HAIR_DEFECTS` claims for it, and not a control for
  // a band's EXISTENCE, which is what this file needed. **The shape statistic's positive control
  // is therefore the synthetic one in `--selftest`, where the answer is arithmetic**, and no arm
  // of this renderer was found that produces a band for it to find on real pixels. That is a
  // stated limit of the evidence, not a silence.
  ['R, constant tangent', 'hairlobes=r&hairscatter=0&hairdefect=constant-tangent'],
  ['R, no per-fragment strand jitter', 'hairlobes=r&hairscatter=0&hairdefect=no-strand-jitter'],
  ['R, no flow sheet', 'hairlobes=r&hairscatter=0&hairdefect=no-flow'],
  ['R, no lock tilt', 'hairlobes=r&hairscatter=0&hairdefect=no-lock-tilt'],
];

async function levers(port, out, exposure = LOBE_EXPOSURE) {
  fs.mkdirSync(path.join(out, 'levers'), { recursive: true });
  for (const [label, extra] of LEVER_ARMS) {
    const file = path.join(out, 'levers', `${label.replace(/[^a-z0-9]+/gi, '-')}.png`);
    // eslint-disable-next-line no-await-in-loop
    await withPage(port, `${BASE_QUERY}&hair=1&${extra}`, async (page, url) => {
      await page.evaluate(SET_EXPOSURE, exposure);
      await plate(page, file, STEPS);
      console.log(`  ${label}  <- ${url}`);
    });
  }
}

function reportLevers(out, exposure = LOBE_EXPOSURE) {
  const { hairShaded, gate } = loadMasks(out);
  reportGate(gate);
  const floorPlate = readPlate(path.join(out, 'lobes', 'nothing-indirect-only-.png'));
  const shippedPlate = readPlate(path.join(out, 'lobes', 'shipped.png'));
  const plates = {};
  for (const [label] of LEVER_ARMS) {
    plates[label] = readPlate(path.join(out, 'levers', `${label.replace(/[^a-z0-9]+/gi, '-')}.png`));
  }
  const all = [floorPlate, shippedPlate, ...Object.values(plates)];
  const set = [];
  for (let k = 0; k < WIDTH * HEIGHT; k += 1) {
    if (hairShaded[k] !== 1) continue;
    if (all.every((q) => isInvertible(codesAt(q, k * 4)))) set.push(k);
  }
  const floor = luminances4(floorPlate, set, exposure);
  const massMean = meanLuminance4(shippedPlate, set, exposure);
  console.log(`\n=== the levers, ${set.length} gated hair pixels   shipped mass mean ${massMean.toExponential(4)}`);
  for (const [label] of LEVER_ARMS) {
    const net = luminances4(plates[label], set, exposure).map((v, i) => v - floor[i]);
    const mean = net.reduce((a, b) => a + b, 0) / net.length;
    const sorted = [...net].sort((a, b) => a - b);
    const over = (f) => net.filter((v) => v > f * mean).length / net.length;
    const p10 = percentile(sorted, 0.1);
    const p50 = percentile(sorted, 0.5);
    const p90 = percentile(sorted, 0.9);
    const p99 = percentile(sorted, 0.99);
    console.log(
      `    ${label.padEnd(26)} mean ${mean.toExponential(3)} = ${((mean / massMean) * 100).toFixed(2).padStart(6)}% of the mass   ` +
      `p10 ${p10.toExponential(2)} p50 ${p50.toExponential(2)} p90 ${p90.toExponential(2)} p99 ${p99.toExponential(2)}  ` +
      `p90/p10 ${(p90 / Math.max(p10, 1e-12)).toFixed(2).padStart(6)}  p99/p50 ${(p99 / Math.max(p50, 1e-12)).toFixed(2)}  ` +
      `max/own-mean ${(sorted[sorted.length - 1] / mean).toFixed(2)}   P99/MASS-MEAN ${(p99 / massMean).toFixed(2)}x   ` +
      `PEAK/MASS-MEAN ${(sorted[sorted.length - 1] / massMean).toFixed(2)}x   above 4x own mean ${(over(4) * 100).toFixed(4)}%`
    );
  }
}

/**
 * What R's dynamic range IS, from the material's own CPU mirror, with the rig's REAL directions.
 *
 * The renders say R varies by a factor of 12.5 between the groom's 10th and 90th percentile and
 * never exceeds the mass mean. That leaves one question a render cannot answer: how much range does
 * the lobe HAVE, so that "the render realises 2.5 of N" is a statement rather than an impression.
 *
 * `hairScatteringValue` is the material's exported CPU twin, held to the TSL by
 * `HairMaterial.selftest.mjs`. This sweeps the fibre direction over the whole sphere at 1x3 degrees
 * and reports R's distribution per light, at the shipped `roughnessR` and at two narrower ones.
 *
 * ⚠️ IT IS AN UPPER BOUND AND NOT A PREDICTION. It sweeps tangents the groom does not present —
 * every strand on a bob runs roughly downward — so the gap between this and the render is
 * "the lobe is wide" AND "the groom never turns into the peak" together, and this file does not
 * separate them. Stated rather than glossed.
 */
async function reportBsdf(out) {
  const censusFile = path.join(out, 'census.json');
  if (fs.existsSync(censusFile) === false) {
    console.log('  no census.json — run --census or --decompose first');
    return;
  }
  const census = JSON.parse(fs.readFileSync(censusFile, 'utf8'));
  const material = await import(pathToFileURL(path.join(REPO, 'packages/core/src/material/HairMaterial.js')).href);
  const { hairScatteringValue, sideVisibilityValue, HAIR_DEFAULTS } = material;

  const camera = census.cameraPosition;
  const focus = census.focus;
  const toView = [camera[0] - focus[0], camera[1] - focus[1], camera[2] - focus[2]];
  const norm = Math.hypot(...toView);
  const view = toView.map((c) => c / norm);
  const colour = [0.0089, 0.0028, 0.0020]; // #1A0E0C decoded to linear; only TT and TRT read it

  console.log(`\n=== R's intrinsic range, CPU mirror, view ${view.map((c) => c.toFixed(3)).join(',')}`);
  console.log(`    shipped roughnessR ${HAIR_DEFAULTS.roughnessR}, shiftR ${HAIR_DEFAULTS.shiftR}`);
  for (const roughness of [HAIR_DEFAULTS.roughnessR, 0.15, 0.08]) {
    for (const unit of census.directions) {
      const values = [];
      for (let t = 0; t < 180; t += 1) {
        for (let ph = 0; ph < 360; ph += 3) {
          const a = (t * Math.PI) / 180;
          const b = (ph * Math.PI) / 180;
          const tangent = [Math.sin(a) * Math.cos(b), Math.sin(a) * Math.sin(b), Math.cos(a)];
          values.push(hairScatteringValue(tangent, unit.area, view, colour, { roughnessR: roughness }).r[0]);
        }
      }
      values.sort((x, y) => x - y);
      const mean = values.reduce((x, y) => x + y, 0) / values.length;
      const dot = unit.area[0] * view[0] + unit.area[1] * view[1] + unit.area[2] * view[2];
      console.log(
        `    roughnessR ${String(roughness).padEnd(5)} ${unit.name.padEnd(7)} mean ${mean.toExponential(3)}  ` +
        `p99 ${percentile(values, 0.99).toExponential(3)}  max ${values[values.length - 1].toExponential(3)}  ` +
        `max/mean ${(values[values.length - 1] / mean).toFixed(2).padStart(6)}   ` +
        `wi.wr ${dot.toFixed(3)} -> slide-47 visibility ${sideVisibilityValue(dot).toFixed(3)}`
      );
    }
  }
}

async function captureCensus(port, out) {
  fs.mkdirSync(out, { recursive: true });
  await withPage(port, `${BASE_QUERY}&hair=1`, async (page) => {
    const c = await page.evaluate(CENSUS_SCRIPT);
    fs.writeFileSync(path.join(out, 'census.json'), JSON.stringify(c, null, 2));
    console.log(`  wrote ${path.join(out, 'census.json')}`);
  });
}

// --- entry ---------------------------------------------------------------------------------------

/**
 * The probe rects, in 720x900 portrait pixels on the shipped judged URL.
 *
 * Both were drawn on `probe-rects.png` — the mask overlay this file writes — cropped at 6x with
 * nearest-neighbour and LOOKED AT before being trusted. See the round report for the crops.
 */
export const RECTS = {
  // Pair 1 and pair 2 are HAIR AND SKIN AT THE SAME IMAGE ROW, 105-110 px apart, one pair on each
  // side of the face. Same row because elevation changes which panel a surface faces; both sides
  // because the key sits at azimuth +42 and the fill at -52, and a decomposition read on one side
  // only cannot tell "this light does not reach hair" from "this light does not reach here".
  'H1 right fall, cheek height': { kind: 'hair', rect: [390, 390, 40, 60] },
  'S1 right cheek, same row as H1': { kind: 'skin', rect: [280, 390, 30, 60] },
  'H2 left fall, cheek height': { kind: 'hair', rect: [80, 390, 40, 60] },
  'S2 left cheek, same row as H2': { kind: 'skin', rect: [185, 392, 30, 44] },
  // Pair 3 is the crown — the one place on this groom where a primary specular band could sit at
  // all, since it is the only large area whose strands run across the key rather than down it.
  'H3 crown mass': { kind: 'hair', rect: [250, 80, 40, 40] },
  'S3 forehead under fringe': { kind: 'skin', rect: [185, 245, 25, 25] },
};

const args = process.argv.slice(2);
const flag = (name, fallback = null) => {
  const i = args.indexOf(name);
  return i === -1 ? fallback : args[i + 1];
};

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  const out = path.resolve(flag('--out', path.join(REPO, 'captures', 'hair-lightpath')));
  const port = flag('--port', '5176');
  if (args.includes('--selftest')) process.exit(selftest() === 0 ? 0 : 1);
  else if (args.includes('--entrypoints')) entrypoints();
  else if (args.includes('--masks')) await captureMasks(port, out).then(() => writeOverlay(out, Object.fromEntries(Object.entries(RECTS).map(([k, v]) => [k, v.rect]))));
  else if (args.includes('--overlay')) writeOverlay(out, Object.fromEntries(Object.entries(RECTS).map(([k, v]) => [k, v.rect])));
  else if (args.includes('--crop')) {
    const rect = flag('--rect').split(',').map(Number);
    crop(flag('--src'), rect, Number(flag('--scale', '6')), flag('--dest'));
  } else if (args.includes('--decompose')) await decompose(port, out, RECTS);
  else if (args.includes('--report')) reportDecomposition(out, RECTS, JSON.parse(fs.readFileSync(path.join(out, 'census.json'), 'utf8')));
  else if (args.includes('--lobes')) await lobes(port, out).then(() => reportLobes(out, RECTS));
  else if (args.includes('--lobereport')) reportLobes(out, RECTS);
  else if (args.includes('--groom')) reportGroom(out);
  else if (args.includes('--levers')) await levers(port, out).then(() => reportLevers(out));
  else if (args.includes('--leverreport')) reportLevers(out);
  else if (args.includes('--census')) await captureCensus(port, out);
  else if (args.includes('--bsdf')) await reportBsdf(out);
  else console.log('pass --selftest | --entrypoints | --masks | --overlay | --decompose | --report | --lobes | --lobereport | --groom');
}

void HERE;
