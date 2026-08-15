#!/usr/bin/env node
//
// hair-pedestal.mjs — R27. What slide 39's multiple-scattering fake is a function of, measured.
//
// ## Why this file exists
//
// R26 closed with a named target: the Karis/Epic SIGGRAPH 2016 slide-39 multiple-scattering FAKE
// is 59.03% of the hair mass and 87.39% on the crown, the primary R lobe carries 39.36%, and R's
// p99 over 207,947 hair pixels is 6.80e-2 against a mass mean of 6.78e-2 — a ratio of 1.00. No
// lobe can peak through a pedestal that tall. Two hypotheses were tabled:
//
//   (A) the pedestal is FLAT where physics says it must be depth-dependent (Zinke & Weber's dual
//       scattering, EG 2008, makes the global term a function of the fibres between the shading
//       point and the light);
//   (B) `sqrt(albedo)` is qualitatively backwards for saturation.
//
// This file measures (A) on pixels and inventories the depth signals that already exist per
// fragment. It changes no shader. It owns nothing but itself.
//
// ## 🎯 THE OPERATOR THAT MAKES THIS ROUND POSSIBLE, AND IT IS EXACT RATHER THAN A CORRELATION
//
// The term, verbatim from `HairMaterial.js:2294-2299`:
//
//     luma    = C · (0.2126, 0.7152, 0.0722)
//     wrap    = (fakeNormal · ωi + 1) / 4π
//     scatter = √C · wrap · (C / luma)^(1 − Shadow) · scatterScalar
//
// summed over the five lights, then × `visibility` × `occlusion`. `Shadow` is slide 44's
// exponential, `exp(−shadowDensity · depth)`, and `depth` is `depthMap.sample( uv() ).r`.
//
// Set `shadowDensity` to 0 and `Shadow` becomes exp(0) = 1, so the exponent `1 − Shadow` is 0 and
// the chromaticity factor collapses to (1,1,1) — EXACTLY, by arithmetic, with nothing else in the
// expression touched. Every other factor in the term is either per-channel-constant (√C) or
// channel-independent (wrap, the light colours, visibility, occlusion, the scalar). So for the
// pedestal-alone plates P₃ (shipped density 3) and P₀ (density 0), taken over the same pixel and
// with the indirect floor subtracted from both,
//
//     P₃[c] / P₀[c] = (C[c] / luma)^(1 − Shadow)      for each channel c
//
// and therefore, for any two channels a and b,
//
//     1 − Shadow  =  ( ln(P₃[a]/P₀[a]) − ln(P₃[b]/P₀[b]) ) / ( ln(C[a]/luma) − ln(C[b]/luma) )
//
// which recovers `Shadow` PER PIXEL from two plates, with the whole five-light sum, the lock
// albedo field, the root occlusion and the side visibility cancelling out of it identically. The
// lock field is a SCALAR on C (`HairMaterial.js:2114`), and C/luma is invariant to a scalar, so it
// cancels too. Three channel pairs give three independent estimates of the same number; `--report`
// prints all three and their spread is the operator's own error bar.
//
// `--selftest` validates it against synthesised plates whose Shadow is known by construction.
//
// ## THE DEPTH REFERENCE IS GEOMETRIC AND IT IS BUILT FROM THE LIVE PAGE
//
// "Does the pedestal vary with depth into the mass" needs a depth into the mass. `--geometry`
// takes the groom's SKINNED WORLD positions off the live figure (`applyBoneTransform`, the same
// read `hair_opacity.mjs` uses), rasterises the cards on the CPU with the live camera to find the
// frontmost hair triangle over each pixel, and then counts how many hair triangles the segment
// from that point to each light crosses. That count IS the quantity Zinke & Weber's global term is
// a function of, measured rather than proxied, and every candidate signal is then scored against
// it by Spearman rank correlation over the same pixel set.
//
//   node tools/critic/hair-pedestal.mjs --selftest
//   node tools/critic/hair-pedestal.mjs --geometry --port 5177 --out captures/hair-r27-pedestal
//   node tools/critic/hair-pedestal.mjs --capture  --port 5177 --out captures/hair-r27-pedestal
//   node tools/critic/hair-pedestal.mjs --report                --out captures/hair-r27-pedestal

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

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
import { erodeMask } from './hair-lightpath.mjs';
import { decodePng, encodePng } from './png.mjs';

const WIDTH = 720;
const HEIGHT = 900;
const STEPS = 8;

/** Identical to `hair-lobe-sweep.mjs`'s and `hair-lightpath.mjs`'s, so every round is comparable. */
const BASE_QUERY = 'bare&freeze&seed=1&capture&aa=msaa&grade=0';

/** See `hair-lobe-sweep.mjs`'s header: one lobe on a #1A0E0C fibre is unreadable at exposure 1. */
const EXPOSURE = 4;

/** `hair-lightpath.mjs`'s cut for "this pixel was drawn by HairMaterial", re-derived per run. */
const HAIR_SHADED_MAX = 1.5e-2;

/** Every third pixel in each axis. 207k mask pixels -> ~23k rays, which is minutes not hours. */
const GEOMETRY_STRIDE = 3;

// --- operators, all validated in `--selftest` ----------------------------------------------------

/**
 * Slide 44's `Shadow`, recovered per pixel from the pedestal at two shadow densities.
 *
 * @param {number[]} p3 - linear RGB of the pedestal ALONE (floor subtracted) at density 3.
 * @param {number[]} p0 - the same pixel with `shadowDensity` 0, so `Shadow` is exactly 1.
 * @param {number[]} colour - the material's linear base colour C. Any positive scalar multiple of
 *   it gives the same answer, which is why the lock field does not need to be known.
 * @returns {?{shadow: number, spread: number, perPair: number[]}} null when a channel is at or
 *   below the 8-bit floor in either plate, where the log is not defined.
 */
export function recoverShadow(p3, p0, colour) {

  const luma = 0.2126 * colour[0] + 0.7152 * colour[1] + 0.0722 * colour[2];
  const lnChroma = colour.map((c) => Math.log(c / luma));

  const lnRatio = [];
  for (let c = 0; c < 3; c += 1) {
    if (!(p3[c] > 0) || !(p0[c] > 0)) return null;
    lnRatio.push(Math.log(p3[c] / p0[c]));
  }

  const pairs = [[0, 1], [0, 2], [1, 2]];
  const estimates = [];
  for (const [a, b] of pairs) {
    const denominator = lnChroma[a] - lnChroma[b];
    // A base colour with two equal chromaticity channels carries no information in that pair.
    if (Math.abs(denominator) < 1e-6) continue;
    estimates.push(1 - (lnRatio[a] - lnRatio[b]) / denominator);
  }
  if (estimates.length === 0) return null;

  const mean = estimates.reduce((a, b) => a + b, 0) / estimates.length;
  const spread = Math.max(...estimates) - Math.min(...estimates);
  return { shadow: mean, spread, perPair: estimates };

}

/**
 * Spearman's rank correlation. Ties are given their average rank, which is what makes it usable on
 * a signal that is CONSTANT over most of its support — and several of the candidates are.
 */
export function spearman(xs, ys) {

  if (xs.length !== ys.length) throw new Error('spearman: length mismatch');
  if (xs.length < 2) return 0;

  const rank = (values) => {
    const order = values.map((v, i) => [v, i]).sort((a, b) => a[0] - b[0]);
    const ranks = new Float64Array(values.length);
    let i = 0;
    while (i < order.length) {
      let j = i;
      while (j + 1 < order.length && order[j + 1][0] === order[i][0]) j += 1;
      const average = (i + j) / 2 + 1;
      for (let k = i; k <= j; k += 1) ranks[order[k][1]] = average;
      i = j + 1;
    }
    return ranks;
  };

  const rx = rank(xs);
  const ry = rank(ys);
  const n = xs.length;
  let mx = 0;
  let my = 0;
  for (let i = 0; i < n; i += 1) { mx += rx[i]; my += ry[i]; }
  mx /= n; my /= n;
  let num = 0;
  let dx = 0;
  let dy = 0;
  for (let i = 0; i < n; i += 1) {
    const a = rx[i] - mx;
    const b = ry[i] - my;
    num += a * b; dx += a * a; dy += b * b;
  }
  if (dx === 0 || dy === 0) return 0;
  return num / Math.sqrt(dx * dy);

}

/** Möller–Trumbore, returning the ray parameter t or null. Two-sided: cards are double-sided. */
export function rayTriangle(origin, direction, a, b, c) {

  const e1x = b[0] - a[0], e1y = b[1] - a[1], e1z = b[2] - a[2];
  const e2x = c[0] - a[0], e2y = c[1] - a[1], e2z = c[2] - a[2];
  const px = direction[1] * e2z - direction[2] * e2y;
  const py = direction[2] * e2x - direction[0] * e2z;
  const pz = direction[0] * e2y - direction[1] * e2x;
  const det = e1x * px + e1y * py + e1z * pz;
  if (Math.abs(det) < 1e-12) return null;
  const inv = 1 / det;
  const tx = origin[0] - a[0], ty = origin[1] - a[1], tz = origin[2] - a[2];
  const u = (tx * px + ty * py + tz * pz) * inv;
  if (u < 0 || u > 1) return null;
  const qx = ty * e1z - tz * e1y;
  const qy = tz * e1x - tx * e1z;
  const qz = tx * e1y - ty * e1x;
  const v = (direction[0] * qx + direction[1] * qy + direction[2] * qz) * inv;
  if (v < 0 || u + v > 1) return null;
  const t = (e2x * qx + e2y * qy + e2z * qz) * inv;
  return t > 0 ? t : null;

}

function percentile(sorted, q) {
  if (sorted.length === 0) return 0;
  const i = Math.min(sorted.length - 1, Math.max(0, Math.round(q * (sorted.length - 1))));
  return sorted[i];
}

function stats(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const mean = values.reduce((a, b) => a + b, 0) / Math.max(1, values.length);
  return {
    n: values.length,
    mean,
    min: sorted[0] ?? 0,
    p10: percentile(sorted, 0.10),
    p50: percentile(sorted, 0.50),
    p90: percentile(sorted, 0.90),
    p95: percentile(sorted, 0.95),
    p99: percentile(sorted, 0.99),
    max: sorted[sorted.length - 1] ?? 0,
  };
}

// --- page plumbing -------------------------------------------------------------------------------

async function waitForFigure(page) {
  await page.waitForFunction(
    async () => (await globalThis.__SUGATA_STEP__(0)) === true,
    null,
    { timeout: 180_000, polling: 250 }
  );
}

async function withPage(port, query, fn) {
  const { chromium } = await loadPlaywright();
  // 🚩 `channel: 'chromium'` IS LOAD-BEARING AND ITS ABSENCE IS SILENT — see `hair-lobe-sweep.mjs`.
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

const SET_EXPOSURE = (value) => { window.sugata.stage.renderer.toneMappingExposure = value; };

/** See `hair-lobe-sweep.mjs`: a plate whose provenance is wrong must say so in its own sidecar. */
const CENSUS_SCRIPT = () => {
  const s = window.sugata;
  let material = null;
  let describe = null;
  s.stage.scene.traverse((o) => {
    if (o.material?.name === 'sugata.hair') {
      material = o.material.constructor.name;
      describe = o.material.describe ? o.material.describe() : null;
    }
  });
  return {
    materialClass: material,
    hair: describe,
    shadowMapEnabled: s.stage.renderer.shadowMap.enabled,
    toneMappingExposure: s.stage.renderer.toneMappingExposure,
  };
};

/**
 * Overwrites `shadowDensity` on the live material.
 *
 * 🚩 THIS IS A UNIFORM WRITE AND NOT A URL KEY, DELIBERATELY. `alive.html` has no
 * `?hairshadowdensity=`, this round owns no file outside `tools/critic/`, and adding a key to
 * `alive.js` to run one experiment would be a source change wearing a probe's clothes. The uniform
 * is the same object `createHairMaterial` built (`HairMaterial.js:2535`); writing `.value` is what
 * every `?hair*` key does one layer up. The written value is read back into the manifest.
 */
const SET_SHADOW_DENSITY = (value) => {
  const s = window.sugata;
  let written = null;
  s.stage.scene.traverse((o) => {
    if (o.material?.name === 'sugata.hair' && o.material.hair?.shadowDensity) {
      o.material.hair.shadowDensity.value = value;
      written = o.material.hair.shadowDensity.value;
    }
  });
  return written;
};

async function shoot(port, out, name, query, manifest, { shadowDensity = null } = {}) {
  const file = path.join(out, `${name}.png`);
  await withPage(port, query, async (page, url) => {
    await page.evaluate(SET_EXPOSURE, EXPOSURE);
    let density = null;
    if (shadowDensity !== null) density = await page.evaluate(SET_SHADOW_DENSITY, shadowDensity);
    const census = await page.evaluate(CENSUS_SCRIPT);
    await plate(page, file, STEPS);
    manifest[name] = { url, exposure: EXPOSURE, shadowDensityWritten: density, census };
    console.log(`  ${name.padEnd(22)} <- ${url}${density === null ? '' : `   [shadowDensity=${density}]`}`);
    if (census.materialClass !== 'HairNodeMaterial') {
      console.log(`  🔴 PROVENANCE: materialClass is ${census.materialClass}, not HairNodeMaterial`);
    }
    if (census.shadowMapEnabled !== true && query.includes('shadows=0') === false) {
      console.log('  🔴 PROVENANCE: renderer.shadowMap.enabled is false on a shadows-on arm');
    }
  });
}

/** The graded-path variant, at the renderer's own exposure. See the trap section in `capture`. */
async function shootAtExposure(port, out, name, query, manifest, exposure) {
  const file = path.join(out, `${name}.png`);
  await withPage(port, query, async (page, url) => {
    await page.evaluate(SET_EXPOSURE, exposure);
    const census = await page.evaluate(CENSUS_SCRIPT);
    await plate(page, file, STEPS);
    manifest[name] = { url, exposure, shadowDensityWritten: null, census };
    console.log(`  ${name.padEnd(22)} <- ${url}   [exposure=${exposure}]`);
    if (census.materialClass !== 'HairNodeMaterial') {
      console.log(`  🔴 PROVENANCE: materialClass is ${census.materialClass}, not HairNodeMaterial`);
    }
  });
}

/** The scatter-scalar arms for the OPPOSITE-DIRECTIONS trap, refreshed on the current tree. */
const TRAP_ARMS = [0, 0.125, 0.25, 0.5, 1, 2, 4];

async function capture(port, out) {
  fs.mkdirSync(out, { recursive: true });
  const manifestPath = path.join(out, 'manifest.json');
  const manifest = fs.existsSync(manifestPath)
    ? JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
    : {};

  // Mask pair, both `?shadows=0` because `buildGroomMask` diffs them.
  await shoot(port, out, 'mask-bald', `${BASE_QUERY}&shadows=0`, manifest);
  await shoot(port, out, 'mask-haired', `${BASE_QUERY}&shadows=0&hair=1`, manifest);

  // The floor — no lobe, no pedestal. Everything below is measured against this.
  await shoot(port, out, 'floor', `${BASE_QUERY}&hair=1&hairlobes=&hairscatter=0`, manifest);

  // THE PEDESTAL ALONE, at the shipped density and at zero. The pair is the exact operator.
  await shoot(port, out, 'ped-d3', `${BASE_QUERY}&hair=1&hairlobes=&hairscatter=1`, manifest);
  await shoot(port, out, 'ped-d0', `${BASE_QUERY}&hair=1&hairlobes=&hairscatter=1`, manifest,
    { shadowDensity: 0 });
  // Two more densities, so "what would this term do if its input had range" is a measured curve.
  await shoot(port, out, 'ped-d12', `${BASE_QUERY}&hair=1&hairlobes=&hairscatter=1`, manifest,
    { shadowDensity: 12 });
  // 🚩 THE NOISE FLOOR, AND WITHOUT IT EVERY PER-PIXEL NUMBER IN §2 IS UNBOUNDED. The shipped OIT
  // is `stochastic`: a hashed alpha test decides per fragment per LOAD which card owns a pixel, so
  // two identical URLs do not agree pixel for pixel. `ped-d3b` is `ped-d3` again, same query, same
  // uniform, second page load. Whatever the operator reads out of THAT pair is noise by
  // construction, and it is the bar every recovered `Shadow` has to clear.
  await shoot(port, out, 'ped-d3b', `${BASE_QUERY}&hair=1&hairlobes=&hairscatter=1`, manifest);

  // The shipped mass and R alone, both at the shipped β, for the pedestal's share.
  await shoot(port, out, 'mass', `${BASE_QUERY}&hair=1`, manifest);
  await shoot(port, out, 'r-only', `${BASE_QUERY}&hair=1&hairlobes=r&hairscatter=0`, manifest);

  // --- the depth-signal inventory, each as a pair whose ratio IS the signal -----------------------
  // The key SpotLight's shadow map: the shipped mass against the same mass with shadows off.
  await shoot(port, out, 'mass-noshadow', `${BASE_QUERY}&hair=1&shadows=0`, manifest);
  // GTAO's visibility, as its own intermediate.
  await shoot(port, out, 'gtao-ao', `${BASE_QUERY}&hair=1&gtaoview=ao`, manifest);
  // Root occlusion, as the pedestal with it removed. Its ratio to `ped-d3` is the term itself.
  await shoot(port, out, 'ped-norootao', `${BASE_QUERY}&hair=1&hairlobes=&hairscatter=1&hairrootao=0`, manifest);
  // Side visibility, same construction.
  await shoot(port, out, 'ped-novis', `${BASE_QUERY}&hair=1&hairlobes=&hairscatter=1&hairvis=0`, manifest);

  // --- the trap ---------------------------------------------------------------------------------
  // ⚠️ TWO SETS, AND THE SECOND IS THE ONE CHECKPOINT §2's TABLE IS COMPARABLE WITH.
  // §2's numbers were taken in ENCODED luma on the SHIPPED GRADED PATH at exposure 1; this file's
  // other arms are radiance on `?grade=0` at exposure 4. Refreshing the trap on the wrong path
  // would produce a table that disagrees with §2 for a reason that has nothing to do with the
  // tree having changed, so both are captured and `--report` prints both.
  for (const s of TRAP_ARMS) {
    // eslint-disable-next-line no-await-in-loop
    await shoot(port, out, `trap-s${String(s).replace('.', 'p')}`, `${BASE_QUERY}&hair=1&hairscatter=${s}`, manifest);
  }
  for (const s of TRAP_ARMS) {
    // eslint-disable-next-line no-await-in-loop
    await shootAtExposure(port, out, `trapg-s${String(s).replace('.', 'p')}`,
      `bare&freeze&seed=1&capture&aa=msaa&hair=1&hairscatter=${s}`, manifest, 1);
  }

  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  console.log(`  wrote ${manifestPath}`);
}

// --- the geometric depth reference ---------------------------------------------------------------

/**
 * Pulls the groom's skinned world-space triangles, the camera's view-projection and every light's
 * world position off the live page. Same `applyBoneTransform` read as `hair_opacity.mjs`.
 */
const GEOMETRY_SCRIPT = () => {
  const s = window.sugata;
  const camera = s.stage.camera;
  camera.updateMatrixWorld(true);
  camera.updateProjectionMatrix();

  let hair = null;
  s.stage.scene.traverse((o) => { if (o.material?.name === 'sugata.hair') hair = o; });
  if (hair === null) throw new Error('hair-pedestal: no mesh carries the `sugata.hair` material.');
  hair.updateMatrixWorld(true);

  const Vector3 = camera.position.constructor;
  const position = hair.geometry.attributes.position;
  const point = new Vector3();
  const world = new Float64Array(position.count * 3);
  for (let i = 0; i < position.count; i += 1) {
    point.fromBufferAttribute(position, i);
    if (hair.isSkinnedMesh === true) hair.applyBoneTransform(i, point);
    point.applyMatrix4(hair.matrixWorld);
    world[i * 3] = point.x; world[i * 3 + 1] = point.y; world[i * 3 + 2] = point.z;
  }

  const index = hair.geometry.index;
  const indices = index
    ? Array.from(index.array)
    : Array.from({ length: position.count }, (_, i) => i);

  // The card's own atlas UV — the ONLY coordinate slide 44's shadow is a function of.
  const uvAttribute = hair.geometry.attributes.uv;
  const uvs = new Float64Array(uvAttribute.count * 2);
  for (let i = 0; i < uvAttribute.count; i += 1) {
    uvs[i * 2] = uvAttribute.getX(i);
    uvs[i * 2 + 1] = uvAttribute.getY(i);
  }

  const lights = [];
  s.stage.scene.traverse((o) => {
    if (o.isLight !== true) return;
    o.updateMatrixWorld(true);
    const p = new Vector3().setFromMatrixPosition(o.matrixWorld);
    lights.push({
      name: o.name || o.type,
      type: o.type,
      intensity: o.intensity,
      colour: o.color ? [o.color.r, o.color.g, o.color.b] : null,
      position: [p.x, p.y, p.z],
      castShadow: o.castShadow === true,
    });
  });

  const canvas = s.stage.renderer.domElement;
  return {
    width: canvas.clientWidth || canvas.width,
    height: canvas.clientHeight || canvas.height,
    world: Array.from(world),
    uvs: Array.from(uvs),
    indices,
    headBonePosition: (() => {
      let head = null;
      s.stage.scene.traverse((o) => { if (o.isBone === true && o.name === 'head') head = o; });
      if (head === null) return null;
      head.updateMatrixWorld(true);
      const p = new Vector3().setFromMatrixPosition(head.matrixWorld);
      return [p.x, p.y, p.z];
    })(),
    projection: camera.projectionMatrix.elements.slice(),
    viewInverse: camera.matrixWorldInverse.elements.slice(),
    cameraPosition: [camera.position.x, camera.position.y, camera.position.z],
    lights,
    materialClass: hair.material.constructor.name,
    shadowMapEnabled: s.stage.renderer.shadowMap.enabled,
  };
};

function multiply4(a, b) {
  const out = new Float64Array(16);
  for (let c = 0; c < 4; c += 1) {
    for (let r = 0; r < 4; r += 1) {
      let sum = 0;
      for (let k = 0; k < 4; k += 1) sum += a[k * 4 + r] * b[c * 4 + k];
      out[c * 4 + r] = sum;
    }
  }
  return out;
}

function project(m, x, y, z) {
  const w = m[3] * x + m[7] * y + m[11] * z + m[15];
  return [
    (m[0] * x + m[4] * y + m[8] * z + m[12]) / w,
    (m[1] * x + m[5] * y + m[9] * z + m[13]) / w,
    (m[2] * x + m[6] * y + m[10] * z + m[14]) / w,
  ];
}

async function geometry(port, out) {
  fs.mkdirSync(out, { recursive: true });

  const raw = await withPage(port, `${BASE_QUERY}&hair=1`, async (page) => {
    await page.evaluate(SET_EXPOSURE, EXPOSURE);
    return page.evaluate(GEOMETRY_SCRIPT);
  });

  const triangleCount = raw.indices.length / 3;
  console.log(`  groom: ${raw.world.length / 3} skinned vertices, ${triangleCount} triangles`);
  console.log(`  provenance: ${raw.materialClass}, shadowMap ${raw.shadowMapEnabled}`);
  console.log(`  lights: ${raw.lights.map((l) => `${l.name}:${l.type}`).join(', ')}`);

  const vp = multiply4(raw.projection, raw.viewInverse);
  const world = Float64Array.from(raw.world);
  const idx = Int32Array.from(raw.indices);

  // Frontmost hair triangle per pixel, with its world position. Same barycentric raster as
  // `hair_opacity.mjs`, run here so the world point comes out rather than only a count.
  const depthBuffer = new Float64Array(WIDTH * HEIGHT).fill(Infinity);
  const hitPoint = new Float64Array(WIDTH * HEIGHT * 3);
  const hitUv = new Float64Array(WIDTH * HEIGHT * 2);
  const hitTriangle = new Int32Array(WIDTH * HEIGHT).fill(-1);
  // 🚩 THE CAVEAT THIS COUNTER EXISTS TO MAKE MEASURABLE. The reference below counts cards from the
  // FRONTMOST hair triangle, but the shipped OIT is `stochastic` — the pixel may resolve to a card
  // further back, which is DEEPER than the frontmost. So the reference is a LOWER BOUND on depth,
  // and this is how much room there is under it: the whole depth complexity of the view ray.
  const rayComplexity = new Int32Array(WIDTH * HEIGHT);
  const uvs = Float64Array.from(raw.uvs);

  const screen = new Float64Array((world.length / 3) * 3);
  for (let i = 0; i < world.length / 3; i += 1) {
    const [x, y, z] = project(vp, world[i * 3], world[i * 3 + 1], world[i * 3 + 2]);
    screen[i * 3] = (x * 0.5 + 0.5) * WIDTH;
    screen[i * 3 + 1] = (1 - (y * 0.5 + 0.5)) * HEIGHT;
    screen[i * 3 + 2] = z;
  }

  for (let t = 0; t < triangleCount; t += 1) {
    const a = idx[t * 3], b = idx[t * 3 + 1], c = idx[t * 3 + 2];
    const ax = screen[a * 3], ay = screen[a * 3 + 1], az = screen[a * 3 + 2];
    const bx = screen[b * 3], by = screen[b * 3 + 1], bz = screen[b * 3 + 2];
    const cx = screen[c * 3], cy = screen[c * 3 + 1], cz = screen[c * 3 + 2];
    const minX = Math.max(0, Math.floor(Math.min(ax, bx, cx)));
    const maxX = Math.min(WIDTH - 1, Math.ceil(Math.max(ax, bx, cx)));
    const minY = Math.max(0, Math.floor(Math.min(ay, by, cy)));
    const maxY = Math.min(HEIGHT - 1, Math.ceil(Math.max(ay, by, cy)));
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
        const z = w0 * az + w1 * bz + w2 * cz;
        const k = y * WIDTH + x;
        rayComplexity[k] += 1;
        if (z >= depthBuffer[k]) continue;
        depthBuffer[k] = z;
        hitTriangle[k] = t;
        hitPoint[k * 3] = w0 * world[a * 3] + w1 * world[b * 3] + w2 * world[c * 3];
        hitPoint[k * 3 + 1] = w0 * world[a * 3 + 1] + w1 * world[b * 3 + 1] + w2 * world[c * 3 + 1];
        hitPoint[k * 3 + 2] = w0 * world[a * 3 + 2] + w1 * world[b * 3 + 2] + w2 * world[c * 3 + 2];
        hitUv[k * 2] = w0 * uvs[a * 2] + w1 * uvs[b * 2] + w2 * uvs[c * 2];
        hitUv[k * 2 + 1] = w0 * uvs[a * 2 + 1] + w1 * uvs[b * 2 + 1] + w2 * uvs[c * 2 + 1];
      }
    }
  }

  let covered = 0;
  for (let k = 0; k < WIDTH * HEIGHT; k += 1) if (hitTriangle[k] >= 0) covered += 1;
  console.log(`  raster: ${covered} pixels covered by the groom (${((covered / (WIDTH * HEIGHT)) * 100).toFixed(2)}% of frame)`);

  // A uniform grid over the triangles, so 23k rays against ~6k triangles is seconds not hours.
  let lo = [Infinity, Infinity, Infinity];
  let hi = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < world.length / 3; i += 1) {
    for (let d = 0; d < 3; d += 1) {
      lo[d] = Math.min(lo[d], world[i * 3 + d]);
      hi[d] = Math.max(hi[d], world[i * 3 + d]);
    }
  }
  console.log(`  groom bounds: [${lo.map((v) => v.toFixed(3)).join(', ')}] .. [${hi.map((v) => v.toFixed(3)).join(', ')}]`);

  const lights = raw.lights.filter((l) => l.type !== 'AmbientLight' && l.type !== 'HemisphereLight');

  // Rays. One per sampled covered pixel per light.
  const samples = [];
  for (let y = 0; y < HEIGHT; y += GEOMETRY_STRIDE) {
    for (let x = 0; x < WIDTH; x += GEOMETRY_STRIDE) {
      const k = y * WIDTH + x;
      if (hitTriangle[k] < 0) continue;
      samples.push(k);
    }
  }
  console.log(`  ${samples.length} sampled pixels x ${lights.length} lights = ${samples.length * lights.length} rays against ${triangleCount} triangles`);

  const counts = {};
  for (const light of lights) counts[light.name] = new Int32Array(samples.length);

  const started = Date.now();
  for (let s = 0; s < samples.length; s += 1) {
    const k = samples[s];
    const origin = [hitPoint[k * 3], hitPoint[k * 3 + 1], hitPoint[k * 3 + 2]];
    const skip = hitTriangle[k];
    for (const light of lights) {
      const dx = light.position[0] - origin[0];
      const dy = light.position[1] - origin[1];
      const dz = light.position[2] - origin[2];
      const len = Math.hypot(dx, dy, dz);
      const dir = [dx / len, dy / len, dz / len];
      // Lift off the originating surface by a hair's width so the source card is not self-counted.
      const o = [origin[0] + dir[0] * 1e-4, origin[1] + dir[1] * 1e-4, origin[2] + dir[2] * 1e-4];
      let hits = 0;
      for (let t = 0; t < triangleCount; t += 1) {
        if (t === skip) continue;
        const a = idx[t * 3], b = idx[t * 3 + 1], c = idx[t * 3 + 2];
        const hit = rayTriangle(
          o, dir,
          [world[a * 3], world[a * 3 + 1], world[a * 3 + 2]],
          [world[b * 3], world[b * 3 + 1], world[b * 3 + 2]],
          [world[c * 3], world[c * 3 + 1], world[c * 3 + 2]]
        );
        if (hit !== null && hit < len) hits += 1;
      }
      counts[light.name][s] = hits;
    }
    if (s % 2000 === 0 && s > 0) {
      const rate = s / ((Date.now() - started) / 1000);
      console.log(`    ${s}/${samples.length}  ${rate.toFixed(0)} px/s`);
    }
  }

  // --- the per-sample signals that need no plate ---------------------------------------------------
  // The atlas UV at the visible fragment, the depth SHEET value there (bilinear, level 0 — the mip
  // the scene pass actually reads is wider, and `--report` says what that costs), and the radial
  // standoff from the head bone, which is the geometric "how far out in the cloud is this card".
  const sheet = decodePng(fs.readFileSync(path.join(REPO, 'assets', 'hair', 'bob01', 'depth.png')));
  const sampleAt = (u, v) => {
    // `map.flipY = false` in `loadDataSheet`, so v runs the same way as the sheet's rows.
    const x = Math.min(sheet.width - 1, Math.max(0, Math.round(u * (sheet.width - 1))));
    const y = Math.min(sheet.height - 1, Math.max(0, Math.round(v * (sheet.height - 1))));
    return sheet.pixels[(y * sheet.width + x) * 4];
  };

  const head = raw.headBonePosition;
  // 🎯 AND THE SAME SHEET THROUGH A BOX OF THE WIDTH THE SCENE PASS ACTUALLY SAMPLES AT.
  // `loadDataSheet` sets `generateMipmaps = true`, and CHECKPOINT §2 measured the trilinear
  // footprint on this groom at 4–5.7 texels. A point sample of level 0 is NOT what the shader
  // reads, and §2 of the report cross-checks the plate-recovered `Shadow` against this column
  // rather than against the point sample.
  const boxAt = (u, v, width) => {
    const cx = Math.round(u * (sheet.width - 1));
    const cy = Math.round(v * (sheet.height - 1));
    const half = Math.floor(width / 2);
    let sum = 0;
    let count = 0;
    for (let dy = -half; dy <= half; dy += 1) {
      for (let dx = -half; dx <= half; dx += 1) {
        const x = Math.min(sheet.width - 1, Math.max(0, cx + dx));
        const y = Math.min(sheet.height - 1, Math.max(0, cy + dy));
        sum += sheet.pixels[(y * sheet.width + x) * 4];
        count += 1;
      }
    }
    return sum / count;
  };

  const sampleUv = new Float64Array(samples.length * 2);
  const sampleSheet = new Float64Array(samples.length);
  const sampleSheetBox5 = new Float64Array(samples.length);
  const sampleRadius = new Float64Array(samples.length);
  for (let s = 0; s < samples.length; s += 1) {
    const k = samples[s];
    sampleUv[s * 2] = hitUv[k * 2];
    sampleUv[s * 2 + 1] = hitUv[k * 2 + 1];
    sampleSheet[s] = sampleAt(hitUv[k * 2], hitUv[k * 2 + 1]);
    sampleSheetBox5[s] = boxAt(hitUv[k * 2], hitUv[k * 2 + 1], 5);
    sampleRadius[s] = head === null ? 0 : Math.hypot(
      hitPoint[k * 3] - head[0], hitPoint[k * 3 + 1] - head[1], hitPoint[k * 3 + 2] - head[2]);
  }

  const payload = {
    stride: GEOMETRY_STRIDE,
    uv: Array.from(sampleUv),
    sheet: Array.from(sampleSheet),
    sheetBox5: Array.from(sampleSheetBox5),
    radius: Array.from(sampleRadius),
    complexity: Array.from(samples, (k) => rayComplexity[k]),
    headBonePosition: head,
    width: WIDTH,
    height: HEIGHT,
    triangleCount,
    vertexCount: world.length / 3,
    provenance: { materialClass: raw.materialClass, shadowMapEnabled: raw.shadowMapEnabled },
    lights,
    samples,
    counts: Object.fromEntries(Object.entries(counts).map(([k2, v]) => [k2, Array.from(v)])),
  };
  const file = path.join(out, 'depth-reference.json');
  fs.writeFileSync(file, JSON.stringify(payload));
  console.log(`  wrote ${file}`);

  for (const light of lights) {
    const c = Array.from(counts[light.name]);
    const st = stats(c);
    console.log(
      `  ${light.name.padEnd(14)} ${light.type.padEnd(16)} cards to light: ` +
      `p10 ${st.p10}  p50 ${st.p50}  p90 ${st.p90}  max ${st.max}  mean ${st.mean.toFixed(2)}`
    );
  }
}

export { stats, percentile, WIDTH, HEIGHT, EXPOSURE, HAIR_SHADED_MAX, BASE_QUERY, TRAP_ARMS, REPO };

// --- entry ---------------------------------------------------------------------------------------

function flag(name, fallback) {
  const i = process.argv.indexOf(name);
  return i === -1 ? fallback : process.argv[i + 1];
}

/**
 * The pictures. Rule 5 of the brief: every operator gets validated against arithmetic AND against a
 * crop somebody looked at. A ray count that is arithmetically perfect and geometrically nonsense
 * looks exactly like a ray count that is right, until it is drawn.
 */
function figures(out) {

  const reference = JSON.parse(fs.readFileSync(path.join(out, 'depth-reference.json'), 'utf8'));
  const stride = reference.stride;

  const write = (name, valueOf, highest) => {
    const rgba = new Uint8Array(WIDTH * HEIGHT * 4).fill(0);
    for (let i = 0; i < rgba.length; i += 4) rgba[i + 3] = 255;
    reference.samples.forEach((k, i) => {
      const t = Math.min(1, Math.max(0, valueOf(i) / highest));
      // Blue -> cyan -> yellow -> red. Enough steps that a gradient reads as one.
      const r = Math.round(255 * Math.min(1, Math.max(0, t * 2 - 0.6)));
      const g = Math.round(255 * Math.min(1, Math.max(0, 1.4 - Math.abs(t - 0.45) * 2.6)));
      const b = Math.round(255 * Math.min(1, Math.max(0, 1 - t * 2.2)));
      const x = k % WIDTH;
      const y = Math.floor(k / WIDTH);
      for (let dy = 0; dy < stride; dy += 1) {
        for (let dx = 0; dx < stride; dx += 1) {
          if (x + dx >= WIDTH || y + dy >= HEIGHT) continue;
          const j = ((y + dy) * WIDTH + (x + dx)) * 4;
          rgba[j] = r; rgba[j + 1] = g; rgba[j + 2] = b;
        }
      }
    });
    const file = path.join(out, `${name}.png`);
    fs.writeFileSync(file, encodePng(WIDTH, HEIGHT, Buffer.from(rgba)));
    console.log(`  wrote ${file}`);
  };

  write('fig-depth-key', (i) => reference.counts.key[i], 32);
  write('fig-depth-rim', (i) => reference.counts.rim[i], 91);
  write('fig-sheet', (i) => reference.sheetBox5[i], 1);
  write('fig-radius', (i) => (reference.radius[i] - 0.09) / 0.09, 1);
  write('fig-complexity', (i) => reference.complexity[i], 90);

}

/**
 * 🚩 NOT A TOP-LEVEL AWAIT, AND THAT IS LOAD-BEARING. `--selftest` and `--report` both live in
 * sibling modules that import THIS one, so a top-level `await import(...)` deadlocks: node cannot
 * finish evaluating this module until the sibling resolves, and the sibling cannot resolve until
 * this module has finished evaluating. Running the CLI from a detached promise lets evaluation
 * complete first, which is what makes the circle legal.
 */
async function main() {
  const out = path.resolve(flag('--out', path.join(REPO, 'captures', 'hair-r27-pedestal')));
  const port = Number(flag('--port', '5177'));
  if (process.argv.includes('--selftest')) {
    const { selftest } = await import('./hair-pedestal.selftest.mjs');
    process.exit(selftest() === 0 ? 0 : 1);
  } else if (process.argv.includes('--geometry')) {
    await geometry(port, out);
  } else if (process.argv.includes('--capture')) {
    await capture(port, out);
  } else if (process.argv.includes('--figures')) {
    figures(out);
  } else if (process.argv.includes('--report')) {
    const { report } = await import('./hair-pedestal.report.mjs');
    report(out);
  } else {
    console.log('pass --selftest | --geometry | --capture | --report, with --out and --port.');
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  main().catch((error) => { console.error(error); process.exit(1); });
}
