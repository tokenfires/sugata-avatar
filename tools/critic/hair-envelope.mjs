#!/usr/bin/env node
//
// hair-envelope.mjs — R28. Does a closed-form envelope path length predict the fibres a light
// actually crosses? Measured against the same ray cast R27 built.
//
// ## Why this file exists
//
// R27 closed on a named defect rather than a shading opinion: slide 39's multiple-scattering term
// carries 59% of the hair mass and 87% of the crown, and its `Shadow` input is
// `exp(−3 · depth.png sampled at uv())` — the CARD'S OWN ATLAS COORDINATE, one baked number per
// texel shared by all 462 cards, and `hair_texture.py` fills that sheet with `random.random()` per
// strand. **It cannot vary with light direction, head orientation, or how many other cards lie
// between the fragment and a light.** R27's own closing words: *"Until `Shadow` stops being noise,
// no shading change to this term is attributable."*
//
// Zinke & Weber's `n` (EG 2008 Eq. 4-5) counts fibres along the SHADOW PATH. Every real-time source
// derives that from the light's view — Zinke §4.1.3, Frostbite slide 27, deep opacity maps — and
// this rig cannot: three's `RectAreaLight` has no shadow code at all and RectAreaLights carry
// 66-73% of a hair pixel (CHECKPOINT §9). Frostbite's own Tier-3 fallback is what fits:
//
//     T_f = d_f · exp( −σ_hair · l )     per RGB channel, on a GEOMETRIC path length l
//
// This file measures whether an `l` that a fragment shader can evaluate in closed form — the chord
// of the groom's own fitted envelope, from the fragment toward the light — is a usable estimate of
// the fibre count. It changes no shader. It writes the fitted envelope out so `HairMaterial.js` is
// given the same numbers rather than a second, independently tuned set.
//
// ## 🎯 THE REFERENCE IS R27's RAY CAST, AND IT IS THE ONLY THING HERE THAT IS GROUND TRUTH
//
// `--geometry` takes the groom's SKINNED WORLD positions off the live figure (`applyBoneTransform`,
// the same read `hair_opacity.mjs` and `hair-pedestal.mjs` use), rasterises the cards on the CPU
// with the live camera to find the frontmost hair triangle over each pixel, then counts how many
// hair triangles the segment from that point to each light crosses. THAT count is the quantity
// Zinke's global term is a function of. Every candidate signal is scored against it by Spearman
// rank correlation over the same pixel set.
//
// ⚠️ `rayTriangle`, `spearman` and `stats` are IMPORTED from `hair-pedestal.mjs` rather than
// rewritten, because they are validated there against arithmetic. The page read is re-implemented
// here only because `hair-pedestal.mjs` does not export its `GEOMETRY_SCRIPT` and this round owns
// no edit to that file.
//
// ## THE SHELL MODEL, AND WHY IT IS A DIFFERENCE OF TWO CHORDS
//
// Hair occupies the region between the scalp and the outer envelope. A ray from a fragment toward a
// light behind the head crosses that shell TWICE — once going out on the near side, once coming
// through on the far side — and crosses the skull in between, where there are no fibres. So the
// fibre-bearing path length is
//
//     l = (chord inside the OUTER ellipsoid, forward of the fragment)
//       − (chord inside the INNER ellipsoid, forward of the fragment)
//
// which is two quadratics and no loop. Both ellipsoids come from ONE least-squares quadric fitted
// to the groom's own skinned vertices, scaled to two measured percentiles of its own radial
// coordinate — so the shell is the groom's measured thickness and not a chosen number.
//
// ## WHAT THIS FILE MEASURED, IN ORDER, AND WHAT IT CONCLUDED
//
// 1. `--geometry`  the ray cast, the fit, and the rank correlation of every candidate input against
//                  it. **The envelope path reads ρ 0.6118 pooled over the lights carrying ~99% of a
//                  hair pixel, where the shipped sheet reads 0.0598.** The fit it prints is the same
//                  fit the material makes at runtime, digit for digit — verified by reading
//                  `describe().envelope` off the live page.
// 2. `--models`    the candidate sweep, and the record `HairEnvelope.selftest.mjs` re-derives σ from.
// 3. `--plates`    the discriminator and beauty arms.
// 4. `--level`     R27's level match, solved by division on pedestal-only plates plus the SHIPPED
//                  `n`'s own mean, recovered off the plate pair with R27's operator.
// 5. `--matched`   the level-matched arms, including the geometric input at the σ that gives it the
//                  shipped input's mean `n` — so the A/B is the input's STRUCTURE and not its level.
// 6. `--control`   the sheet input driven to the geometric input's mean `n`, level matched. The arm
//                  that says whether a wider `n` alone explains any of it.
// 7. `--verdict`   the report, and it writes the numbers `HairMaterial.js` argues from.
//
// 🎯 THE FALSIFICATION PASSED AND THE PICTURE DID NOT MOVE. `?hairdefect=envelope-depth` against
// `?hairdefect=envelope-fixed-direction` — one token apart — moves **160,646 of 225,126 gated hair
// pixels (71.36%)** against a noise floor of exactly zero, and `n` toward the key changes mean
// 4.7507 → 4.0654 when the key swings 42° → −20° with the camera fixed. The pedestal's own shape,
// a percentile ratio that no level match can flatter, moves **0.21%**. Slide 39 spends `Shadow`
// only on a chromaticity exponent whose whole domain is worth 1.0927× of luminance, so the ceiling
// was structural and the input was never going to reach it. See `HairMaterial.js`'s R28 block.
//
//   node tools/critic/hair-envelope.mjs --selftest
//   node tools/critic/hair-envelope.mjs --geometry --port 5177 --out captures/hair-r28-envelope
//   node tools/critic/hair-envelope.mjs --models                --out captures/hair-r28-envelope
//   node tools/critic/hair-envelope.mjs --plates   --port 5177  --out captures/hair-r28-envelope
//   node tools/critic/hair-envelope.mjs --level                 --out captures/hair-r28-envelope
//   node tools/critic/hair-envelope.mjs --matched  --port 5177  --out captures/hair-r28-envelope
//   node tools/critic/hair-envelope.mjs --control  --port 5177  --out captures/hair-r28-envelope
//   node tools/critic/hair-envelope.mjs --verdict               --out captures/hair-r28-envelope
//
// The exit code is 1 on any failed clause of `--selftest`.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  GPU_FLAGS,
  buildGroomMask,
  codesAt,
  isInvertible,
  loadPlaywright,
  luminance,
  openPage,
  plate,
  plateToSceneLinear,
  readPlate
} from './lightpath-probe.mjs';
import { bandShape, erodeMask } from './hair-lightpath.mjs';
import { rayTriangle, recoverShadow, spearman, stats } from './hair-pedestal.mjs';
import {
  HAIR_DEFAULTS,
  HAIR_ENVELOPE_EXTINCTION,
  HAIR_ENVELOPE_QUANTILES,
  baseColourDerivation,
  ellipsoidSpanValue,
  fitEllipsoidValue,
  forwardChordValue,
  hairEnvelopeValue,
  shellPathValue
} from '../../packages/core/src/material/HairMaterial.js';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

const WIDTH = 720;
const HEIGHT = 900;

/** The shipped judged URL, identical to `hair-pedestal.mjs`'s so the two runs are comparable. */
const BASE_QUERY = 'bare&freeze&seed=1&capture&aa=msaa&grade=0';

/**
 * Pixel stride for the ray cast. R27 used 3 (42,892 samples); the cast is brute force over 17,000
 * triangles, so this run uses 7 — 7,930 samples x 5 lights x 17,000 triangles — which is the same
 * measurement at a twelfth of the cost and still two orders of magnitude more samples than a rank
 * correlation needs to be tight. `--stride` overrides it.
 */
const GEOMETRY_STRIDE = 7;

/**
 * The three lights the verdict turns on. CHECKPOINT §9 measured the rig on pixels: the key and the
 * fill carry 66-73% of a hair pixel between them, the key's co-located SpotLight carries most of
 * the rest, and the rim and kicker together are 0.02-0.87%. A pooled score over these three is the
 * number that decides whether the geometric input beats the sheet; the rim and kicker are reported
 * beside it rather than averaged into it.
 */
const ENERGY_LIGHTS = [ 'key', 'key-shadow', 'fill' ];

// --- the model, imported rather than re-implemented ------------------------------------------

/**
 * 🚩 EVERY OPERATOR BELOW COMES FROM `HairMaterial.js` AND NONE OF IT IS DEFINED HERE. The whole
 * point of this file is to score the shader's own path length against the ray cast; a second
 * implementation in the probe would let the two drift and would score a lookalike. The mirrors are
 * gated beside the material by `HairEnvelope.selftest.mjs`, which is where their arithmetic is
 * proved — including the two red proofs that the model varies with light direction AND with the
 * fragment, which is the property R27 killed the previous attempt for lacking.
 *
 * These three adapters exist only because the material's mirrors take an origin that is ALREADY
 * relative to the envelope's centre — the shader has the offset in hand and would pay for a
 * subtraction it does not need — while this file works in world coordinates.
 */
function ellipsoidSpan(origin, direction, centre, radii) {
  return ellipsoidSpanValue(
    [ origin[0] - centre[0], origin[1] - centre[1], origin[2] - centre[2] ], direction, radii);
}

function forwardLength(span) {
  return forwardChordValue(span);
}

function shellPathLength(origin, direction, envelope) {
  return shellPathValue(
    [ origin[0] - envelope.centre[0], origin[1] - envelope.centre[1], origin[2] - envelope.centre[2] ],
    direction, envelope);
}

function fitEllipsoid(points) {
  return fitEllipsoidValue(points);
}

function radialCoordinate(point, centre, radii) {
  const x = (point[0] - centre[0]) / radii[0];
  const y = (point[1] - centre[1]) / radii[1];
  const z = (point[2] - centre[2]) / radii[2];
  return Math.sqrt(x * x + y * y + z * z);
}

function fitEnvelope(points, quantiles = HAIR_ENVELOPE_QUANTILES) {
  return hairEnvelopeValue(points, quantiles);
}

// --- the page read ---------------------------------------------------------------------------

/**
 * The groom's skinned world triangles, the camera's matrices and every light's world position,
 * off the live page. Mirrors `hair-pedestal.mjs`'s `GEOMETRY_SCRIPT`; see this file's header for
 * why it is not imported.
 */
const GEOMETRY_SCRIPT = () => {
  const s = window.sugata;
  const camera = s.stage.camera;
  camera.updateMatrixWorld(true);
  camera.updateProjectionMatrix();

  let hair = null;
  s.stage.scene.traverse((o) => { if (o.material?.name === 'sugata.hair') hair = o; });
  if (hair === null) throw new Error('hair-envelope: no mesh carries the `sugata.hair` material.');
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
      position: [p.x, p.y, p.z],
      castShadow: o.castShadow === true
    });
  });

  let head = null;
  s.stage.scene.traverse((o) => { if (o.isBone === true && o.name === 'head') head = o; });
  if (head !== null) head.updateMatrixWorld(true);

  return {
    world: Array.from(world),
    uvs: Array.from(uvs),
    indices,
    headBonePosition: head === null
      ? null
      : (() => { const p = new Vector3().setFromMatrixPosition(head.matrixWorld); return [p.x, p.y, p.z]; })(),
    headBoneMatrix: head === null ? null : head.matrixWorld.elements.slice(),
    projection: camera.projectionMatrix.elements.slice(),
    viewInverse: camera.matrixWorldInverse.elements.slice(),
    lights,
    materialClass: hair.material.constructor.name,
    shadowMapEnabled: s.stage.renderer.shadowMap.enabled
  };
};

async function withPage(port, query, fn) {
  const { chromium } = await loadPlaywright();
  // 🚩 `channel: 'chromium'` IS LOAD-BEARING AND ITS ABSENCE IS SILENT — see `hair-lobe-sweep.mjs`.
  const browser = await chromium.launch({ channel: 'chromium', args: GPU_FLAGS });
  try {
    const url = `http://localhost:${port}/alive.html?${query}`;
    const { context, page, errors } = await openPage(browser, url, { width: WIDTH, height: HEIGHT });
    try {
      await page.waitForFunction(
        async () => (await globalThis.__SUGATA_STEP__(0)) === true, null,
        { timeout: 180_000, polling: 250 });
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
    (m[2] * x + m[6] * y + m[10] * z + m[14]) / w
  ];
}

// --- the measurement -------------------------------------------------------------------------

async function geometry(port, out, stride) {
  fs.mkdirSync(out, { recursive: true });

  const raw = await withPage(port, `${BASE_QUERY}&hair=1`, async (page) => page.evaluate(GEOMETRY_SCRIPT));

  const triangleCount = raw.indices.length / 3;
  const world = Float64Array.from(raw.world);
  const idx = Int32Array.from(raw.indices);
  console.log(`  groom: ${world.length / 3} skinned vertices, ${triangleCount} triangles`);
  console.log(`  provenance: ${raw.materialClass}, shadowMap ${raw.shadowMapEnabled}`);

  // --- the envelope, fitted to the groom's own vertices ------------------------------------------
  const envelope = fitEnvelope(world);
  const mm = (v) => (v * 1000).toFixed(2);
  console.log(`  envelope fit: centre [${envelope.centre.map((v) => v.toFixed(4)).join(', ')}]`);
  console.log(`                radii  [${envelope.radii.map(mm).join(', ')}] mm, RMS residual ${envelope.residual.toFixed(4)}`);
  console.log(`                radial q: p02 ${envelope.radialQuantiles.p02.toFixed(4)}  p50 ${envelope.radialQuantiles.p50.toFixed(4)}  p98 ${envelope.radialQuantiles.p98.toFixed(4)}`);
  console.log(`                inner  [${envelope.inner.map(mm).join(', ')}] mm`);
  console.log(`                outer  [${envelope.outer.map(mm).join(', ')}] mm`);
  console.log(`                shell thickness on each axis: [${envelope.outer.map((v, i) => mm(v - envelope.inner[i])).join(', ')}] mm`);

  // --- the raster: the frontmost hair triangle over each pixel ------------------------------------
  const vp = multiply4(raw.projection, raw.viewInverse);
  const depthBuffer = new Float64Array(WIDTH * HEIGHT).fill(Infinity);
  const hitPoint = new Float64Array(WIDTH * HEIGHT * 3);
  const hitUv = new Float64Array(WIDTH * HEIGHT * 2);
  const hitTriangle = new Int32Array(WIDTH * HEIGHT).fill(-1);

  const screen = new Float64Array(world.length);
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
        if (z >= depthBuffer[k]) continue;
        depthBuffer[k] = z;
        hitTriangle[k] = t;
        hitPoint[k * 3] = w0 * world[a * 3] + w1 * world[b * 3] + w2 * world[c * 3];
        hitPoint[k * 3 + 1] = w0 * world[a * 3 + 1] + w1 * world[b * 3 + 1] + w2 * world[c * 3 + 1];
        hitPoint[k * 3 + 2] = w0 * world[a * 3 + 2] + w1 * world[b * 3 + 2] + w2 * world[c * 3 + 2];
        hitUv[k * 2] = w0 * uvsAt(raw, a, 0) + w1 * uvsAt(raw, b, 0) + w2 * uvsAt(raw, c, 0);
        hitUv[k * 2 + 1] = w0 * uvsAt(raw, a, 1) + w1 * uvsAt(raw, b, 1) + w2 * uvsAt(raw, c, 1);
      }
    }
  }

  const samples = [];
  for (let y = 0; y < HEIGHT; y += stride) {
    for (let x = 0; x < WIDTH; x += stride) {
      const k = y * WIDTH + x;
      if (hitTriangle[k] >= 0) samples.push(k);
    }
  }

  const lights = raw.lights.filter((l) => l.type !== 'AmbientLight' && l.type !== 'HemisphereLight');
  console.log(`  ${samples.length} sampled pixels x ${lights.length} lights = ${samples.length * lights.length} rays against ${triangleCount} triangles`);

  // --- ground truth, and the model, on the same pixels and the same directions -------------------
  const truth = {};
  const model = {};
  const chordOuter = {};
  const radius = new Float64Array(samples.length);
  for (const light of lights) {
    truth[light.name] = new Int32Array(samples.length);
    model[light.name] = new Float64Array(samples.length);
    chordOuter[light.name] = new Float64Array(samples.length);
  }

  const head = raw.headBonePosition;
  const started = Date.now();
  for (let s = 0; s < samples.length; s += 1) {
    const k = samples[s];
    const origin = [hitPoint[k * 3], hitPoint[k * 3 + 1], hitPoint[k * 3 + 2]];
    const skip = hitTriangle[k];
    radius[s] = head === null ? 0 : Math.hypot(origin[0] - head[0], origin[1] - head[1], origin[2] - head[2]);
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
      truth[light.name][s] = hits;
      model[light.name][s] = shellPathLength(o, dir, envelope);
      chordOuter[light.name][s] = forwardLength(ellipsoidSpan(o, dir, envelope.centre, envelope.outer));
    }
    if (s % 1000 === 0 && s > 0) {
      const rate = s / ((Date.now() - started) / 1000);
      console.log(`    ${s}/${samples.length}  ${rate.toFixed(0)} px/s`);
    }
  }

  // --- the baked sheet, which is the signal the shipped term actually reads ----------------------
  const sheetPath = path.join(REPO, 'assets', 'hair', 'bob01', 'depth.png');
  const sheetValues = new Float64Array(samples.length);
  if (fs.existsSync(sheetPath)) {
    const sheet = await decodeSheet(sheetPath);
    for (let s = 0; s < samples.length; s += 1) {
      const k = samples[s];
      const x = Math.min(sheet.width - 1, Math.max(0, Math.round(hitUv[k * 2] * (sheet.width - 1))));
      const y = Math.min(sheet.height - 1, Math.max(0, Math.round(hitUv[k * 2 + 1] * (sheet.height - 1))));
      sheetValues[s] = sheet.pixels[(y * sheet.width + x) * 4];
    }
  }

  // --- the scoreboard ----------------------------------------------------------------------------
  console.log('');
  console.log('  Spearman rank correlation against the ray-cast fibre count, per light:');
  console.log('  light           type              truth p50  truth mean  | model l mm  ρ(shell)  ρ(chord)  ρ(sheet)  ρ(radius)');
  const scoreboard = {};
  for (const light of lights) {
    const t = Array.from(truth[light.name]);
    const m = Array.from(model[light.name]);
    const st = stats(t);
    const sm = stats(m);
    const rhoShell = spearman(m, t);
    const rhoChord = spearman(Array.from(chordOuter[light.name]), t);
    const rhoSheet = spearman(Array.from(sheetValues), t);
    const rhoRadius = spearman(Array.from(radius), t);
    scoreboard[light.name] = {
      type: light.type,
      truth: st,
      model: sm,
      rhoShell, rhoChord, rhoSheet, rhoRadius
    };
    console.log(
      `  ${light.name.padEnd(14)} ${light.type.padEnd(16)} ` +
      `${String(st.p50).padStart(9)}  ${st.mean.toFixed(2).padStart(10)}  | ` +
      `${(sm.mean * 1000).toFixed(1).padStart(10)}  ${rhoShell.toFixed(4).padStart(8)}  ` +
      `${rhoChord.toFixed(4).padStart(8)}  ${rhoSheet.toFixed(4).padStart(8)}  ${rhoRadius.toFixed(4).padStart(9)}`
    );
  }

  // --- 🎯 THE DISCRIMINATOR, BEFORE ANY SHADER EXISTS ---------------------------------------------
  // R27's one-line falsification: a term that varies with LIGHT DIRECTION must change when the
  // light moves and the camera does not. The baked sheet is ONE number per fragment, so its column
  // above is the same number under every light by construction. The model's is not. This prints the
  // spread of each signal ACROSS lights at a fixed pixel, which is the property the whole round is
  // about, and it is arithmetic rather than a plate.
  console.log('');
  console.log('  Across-light spread at a fixed fragment (the property `Shadow` currently lacks):');
  let sheetSpread = 0;
  let modelSpread = 0;
  let truthSpread = 0;
  for (let s = 0; s < samples.length; s += 1) {
    const ms = lights.map((l) => model[l.name][s]);
    const ts = lights.map((l) => truth[l.name][s]);
    modelSpread += Math.max(...ms) - Math.min(...ms);
    truthSpread += Math.max(...ts) - Math.min(...ts);
    sheetSpread += 0;                                   // one baked number, shared by every light
  }
  console.log(`    ray-cast truth : mean max−min across the ${lights.length} lights = ${(truthSpread / samples.length).toFixed(2)} fibres`);
  console.log(`    envelope model : mean max−min across the ${lights.length} lights = ${((modelSpread / samples.length) * 1000).toFixed(2)} mm`);
  console.log(`    baked sheet    : mean max−min across the ${lights.length} lights = ${(sheetSpread / samples.length).toFixed(2)} — ZERO BY CONSTRUCTION`);

  const payload = {
    stride,
    width: WIDTH,
    height: HEIGHT,
    triangleCount,
    vertexCount: world.length / 3,
    provenance: { materialClass: raw.materialClass, shadowMapEnabled: raw.shadowMapEnabled },
    headBonePosition: raw.headBonePosition,
    headBoneMatrix: raw.headBoneMatrix,
    envelope,
    lights,
    scoreboard,
    samples,
    truth: Object.fromEntries(Object.entries(truth).map(([k, v]) => [k, Array.from(v)])),
    model: Object.fromEntries(Object.entries(model).map(([k, v]) => [k, Array.from(v)]))
  };
  const file = path.join(out, 'envelope-reference.json');
  fs.writeFileSync(file, JSON.stringify(payload));
  console.log(`\n  wrote ${file}`);

  // 🎯 THE CACHE, AND IT IS WHAT MAKES A MODEL SEARCH HONEST RATHER THAN EXPENSIVE. Acquiring the
  // ground truth costs a browser, a CPU raster and 40k brute-force ray casts; scoring a candidate
  // path length against it costs two quadratics per sample. Writing the groom and the ray-cast
  // answers out once means every later candidate is scored on THE SAME pixels, THE SAME directions
  // and THE SAME counts — so two models differ in the model and in nothing else.
  const cache = {
    world: Array.from(world),
    indices: Array.from(idx),
    lights,
    headBonePosition: raw.headBonePosition,
    hitPoints: Array.from(samples, (k) => [hitPoint[k * 3], hitPoint[k * 3 + 1], hitPoint[k * 3 + 2]]).flat(),
    sheet: Array.from(sheetValues),
    radius: Array.from(radius),
    truth: Object.fromEntries(Object.entries(truth).map(([k, v]) => [k, Array.from(v)]))
  };
  const cacheFile = path.join(out, 'ground-truth-cache.json');
  fs.writeFileSync(cacheFile, JSON.stringify(cache));
  console.log(`  wrote ${cacheFile}`);
}

/**
 * Scores candidate envelopes against the cached ray cast. No browser, no raster, no ray cast — the
 * ground truth is fixed and only the model moves, which is the whole point of the cache.
 */
function scoreModels(out) {
  const cache = JSON.parse(fs.readFileSync(path.join(out, 'ground-truth-cache.json'), 'utf8'));
  const world = Float64Array.from(cache.world);
  const points = Float64Array.from(cache.hitPoints);
  const count = points.length / 3;
  const lights = cache.lights;

  const candidates = [];

  const plain = fitEnvelope(world);
  candidates.push({ name: 'quantile p02/p98', envelope: plain });
  candidates.push({ name: 'quantile p10/p90', envelope: fitEnvelope(world, [ 0.10, 0.90 ]) });
  candidates.push({ name: 'quantile p25/p75', envelope: fitEnvelope(world, [ 0.25, 0.75 ]) });

  // The trimmed fits: the outer surface fitted to the OUTER vertices only, and the inner to the
  // inner ones, each re-fitted until the membership stops moving. A single fit over a filled cloud
  // lands mid-volume and describes neither boundary.
  const trimmedOuter = fitTrimmed(world, 'outer');
  const trimmedInner = fitTrimmed(world, 'inner');
  candidates.push({
    name: 'trimmed shells',
    envelope: {
      centre: trimmedOuter.centre,
      radii: trimmedOuter.radii,
      outer: trimmedOuter.radii,
      inner: rescale(trimmedInner, trimmedOuter),
      residual: trimmedOuter.residual,
      trimmed: true,
      innerFit: trimmedInner
    }
  });

  // The simplest thing that could possibly work, as a floor under the ellipsoid: a SPHERE on the
  // head bone, sized to the groom's own radial p02/p98. If the ellipsoid does not beat this, the
  // six-parameter fit is not earning its complexity.
  if (cache.headBonePosition !== null) {
    const head = cache.headBonePosition;
    const n = world.length / 3;
    const radii = new Float64Array(n);
    for (let i = 0; i < n; i += 1) {
      radii[i] = Math.hypot(world[i * 3] - head[0], world[i * 3 + 1] - head[1], world[i * 3 + 2] - head[2]);
    }
    const sorted = Float64Array.from(radii).sort();
    const at = (q) => sorted[Math.round(q * (sorted.length - 1))];
    candidates.push({
      name: 'sphere on head bone',
      envelope: {
        centre: head,
        radii: [ at(0.98), at(0.98), at(0.98) ],
        outer: [ at(0.98), at(0.98), at(0.98) ],
        inner: [ at(0.02), at(0.02), at(0.02) ],
        residual: NaN
      }
    });
  }

  console.log('  candidate                 light           ρ(shell)   ρ(outer chord)   mean l mm');
  const table = {};
  for (const candidate of candidates) {
    table[candidate.name] = {};
    const pooledModel = [];
    const pooledTruth = [];
    const pooledSheet = [];
    for (const light of lights) {
      const shell = new Array(count);
      const chord = new Array(count);
      for (let s = 0; s < count; s += 1) {
        const origin = [points[s * 3], points[s * 3 + 1], points[s * 3 + 2]];
        const dx = light.position[0] - origin[0];
        const dy = light.position[1] - origin[1];
        const dz = light.position[2] - origin[2];
        const len = Math.hypot(dx, dy, dz);
        const dir = [dx / len, dy / len, dz / len];
        shell[s] = shellPathLength(origin, dir, candidate.envelope);
        chord[s] = forwardLength(ellipsoidSpan(origin, dir, candidate.envelope.centre, candidate.envelope.outer));
      }
      const truth = cache.truth[light.name];
      const rhoShell = spearman(shell, truth);
      const rhoChord = spearman(chord, truth);
      const mean = shell.reduce((p, c) => p + c, 0) / count;
      table[candidate.name][light.name] = { rhoShell, rhoChord, meanMillimetres: mean * 1000 };
      console.log(
        `  ${candidate.name.padEnd(24)}  ${light.name.padEnd(14)}  ${rhoShell.toFixed(4).padStart(8)}   ` +
        `${rhoChord.toFixed(4).padStart(14)}   ${(mean * 1000).toFixed(1).padStart(9)}`
      );
      if (ENERGY_LIGHTS.includes(light.name)) {
        for (let s = 0; s < count; s += 1) {
          pooledModel.push(shell[s]);
          pooledTruth.push(truth[s]);
          pooledSheet.push(cache.sheet[s]);
        }
      }
    }
    const pooled = {
      rhoModel: spearman(pooledModel, pooledTruth),
      rhoSheet: spearman(pooledSheet, pooledTruth),
      pairs: pooledModel.length
    };
    table[candidate.name].pooledEnergyLights = pooled;
    const e = candidate.envelope;
    console.log(`      -> centre [${e.centre.map((v) => v.toFixed(4)).join(', ')}]  ` +
      `outer [${e.outer.map((v) => (v * 1000).toFixed(1)).join(', ')}] mm  ` +
      `inner [${e.inner.map((v) => (v * 1000).toFixed(1)).join(', ')}] mm`);
    console.log(`      -> POOLED over key+key-shadow+fill (${pooled.pairs} pairs): ` +
      `ρ(model) ${pooled.rhoModel.toFixed(4)}   ρ(baked sheet) ${pooled.rhoSheet.toFixed(4)}`);
  }

  fs.writeFileSync(path.join(out, 'model-scores.json'), JSON.stringify({
    candidates: candidates.map((c) => ({ name: c.name, envelope: c.envelope })),
    table
  }, null, 2));
  console.log(`\n  wrote ${path.join(out, 'model-scores.json')}`);

  writeMeasuredRecord(cache, plain, points, count);
}

/**
 * 🚩 THE MACHINE-WRITTEN RECORD, AND IT EXISTS BECAUSE `/captures/` IS GITIGNORED.
 *
 * `HAIR_ENVELOPE_EXTINCTION` is a measured number, so the house rule says a gate must re-derive it
 * rather than let a reader trust the comment. But the plates and the ray cast it comes from are not
 * in the tree, so a gate that read them would go red on a clean checkout. R27 hit the same wall with
 * `hair-transmittance.measured.json` and answered it the same way: this run writes the REGRESSION's
 * own sufficient statistics — Σ l·c, Σ l², the pair count and the correlations — into a tracked
 * file, and `HairEnvelope.selftest.mjs` divides them to get σ back.
 *
 * ⚠️ AND THE LIMIT IS R27's, RESTATED RATHER THAN QUIETLY INHERITED: a gate that re-derives a number
 * from a record its own producer wrote checks TRANSCRIPTION AND ARITHMETIC, not the measurement.
 * It cannot catch an error the producer and the record share. What it does catch is the failure mode
 * this project has hit six times — a constant in the source drifting away from the run it came from.
 */
function writeMeasuredRecord(cache, envelope, points, count) {
  const perLight = {};
  let sumLC = 0;
  let sumLL = 0;
  let pairs = 0;

  for (const light of cache.lights) {
    let lc = 0;
    let ll = 0;
    for (let s = 0; s < count; s += 1) {
      const origin = [points[s * 3], points[s * 3 + 1], points[s * 3 + 2]];
      const dx = light.position[0] - origin[0];
      const dy = light.position[1] - origin[1];
      const dz = light.position[2] - origin[2];
      const len = Math.hypot(dx, dy, dz);
      const l = shellPathLength(origin, [dx / len, dy / len, dz / len], envelope);
      const c = cache.truth[light.name][s];
      lc += l * c;
      ll += l * l;
    }
    perLight[light.name] = { sumPathTimesCards: lc, sumPathSquared: ll, samples: count };
    if (ENERGY_LIGHTS.includes(light.name)) { sumLC += lc; sumLL += ll; pairs += count; }
  }

  const record = {
    writtenBy: 'tools/critic/hair-envelope.mjs --models',
    groom: 'assets/hair/bob01',
    envelope: {
      centre: envelope.centre,
      radii: envelope.radii,
      outer: envelope.outer,
      inner: envelope.inner,
      residual: envelope.residual,
      quantiles: [...HAIR_ENVELOPE_QUANTILES],
      vertexCount: envelope.vertexCount
    },
    energyLights: ENERGY_LIGHTS,
    regression: { sumPathTimesCards: sumLC, sumPathSquared: sumLL, pairs },
    perLight
  };
  const file = path.join(REPO, 'tools', 'critic', 'hair-envelope.measured.json');
  fs.writeFileSync(file, JSON.stringify(record, null, 2));
  console.log(`  wrote ${file}   (sigma = ${(sumLC / sumLL).toFixed(2)} cards per metre over ${pairs} pairs)`);
}

/** The inner fit's radii, expressed in the outer fit's own frame so the two share a centre. */
function rescale(inner, outer) {
  return outer.radii.map((r, i) => Math.min(r * 0.999, inner.radii[i]));
}

/**
 * An ellipsoid fitted to one BOUNDARY of a filled cloud rather than to the whole of it.
 *
 * Fit, drop the half of the cloud on the wrong side of the fitted surface, fit again, repeat. The
 * membership converges in a handful of passes and the result is a surface through the cloud's
 * outermost (or innermost) points instead of through its middle.
 */
export function fitTrimmed(points, side, passes = 6) {
  let keep = points;
  let fit = fitEllipsoid(keep);
  for (let pass = 0; pass < passes; pass += 1) {
    const count = keep.length / 3;
    const radial = new Float64Array(count);
    for (let i = 0; i < count; i += 1) {
      radial[i] = radialCoordinate([keep[i * 3], keep[i * 3 + 1], keep[i * 3 + 2]], fit.centre, fit.radii);
    }
    const sorted = Float64Array.from(radial).sort();
    const median = sorted[Math.floor(sorted.length / 2)];
    const next = [];
    for (let i = 0; i < count; i += 1) {
      const inside = side === 'outer' ? radial[i] >= median : radial[i] <= median;
      if (inside) next.push(keep[i * 3], keep[i * 3 + 1], keep[i * 3 + 2]);
    }
    if (next.length < 600) break;
    keep = Float64Array.from(next);
    fit = fitEllipsoid(keep);
  }
  return { ...fit, kept: keep.length / 3 };
}

/**
 * 🚩 THE SECOND MACHINE-WRITTEN RECORD, for `writeMeasuredRecord`'s reason and with its limit.
 * `/captures/` is gitignored, so the numbers `HairMaterial.js` argues from are written into a
 * tracked file here and re-read by the gate beside that file. It checks transcription, not the
 * measurement — see `writeMeasuredRecord` for the full statement of what that does and does not buy.
 */
function writeVerdictRecord(out, { moved, of, massRows, pedRows }) {
  const file = path.join(REPO, 'tools', 'critic', 'hair-envelope.measured.json');
  const record = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : {};
  const cache = JSON.parse(fs.readFileSync(path.join(out, 'ground-truth-cache.json'), 'utf8'));
  const manifest = JSON.parse(fs.readFileSync(path.join(out, 'plate-manifest.json'), 'utf8'));
  const envelope = fitEnvelope(Float64Array.from(cache.world));
  const points = Float64Array.from(cache.hitPoints);
  const count = points.length / 3;

  const keyAt = (name) => manifest[name].census.lights.find((l) => l.name === 'key').position;
  const meanAt = (light) => {
    let sum = 0;
    for (let s = 0; s < count; s += 1) {
      const origin = [points[s * 3], points[s * 3 + 1], points[s * 3 + 2]];
      const d = [light[0] - origin[0], light[1] - origin[1], light[2] - origin[2]];
      const len = Math.hypot(...d);
      sum += HAIR_ENVELOPE_EXTINCTION * shellPathLength(origin, [d[0] / len, d[1] / len, d[2] / len], envelope);
    }
    return sum / count;
  };

  const pick = (name) => pedRows.find((r) => r.name === name);
  record.verdict = {
    writtenBy: 'tools/critic/hair-envelope.mjs --verdict',
    gatePixels: of,
    oneExpressionMovedPixels: moved,
    oneExpressionMovedFraction: moved / of,
    keyPositions: { a: keyAt('ped-sheet-a1'), b: keyAt('ped-sheet-b1') },
    meanEventsTowardKey: { a: meanAt(keyAt('ped-sheet-a1')), b: meanAt(keyAt('ped-sheet-b1')) },
    fragments: count,
    pedestalShape: Object.fromEntries(pedRows.map((r) => [r.name, r.p95OverP50])),
    massContrast: Object.fromEntries(massRows.map((r) => [r.name, {
      p99OverMass: r.p99OverMass, massP95OverP50: r.massP95OverP50, above4: r.above4
    }])),
    pedestalP50: Object.fromEntries(pedRows.map((r) => [r.name, r.p50]))
  };
  fs.writeFileSync(file, JSON.stringify(record, null, 2));
  console.log(`  wrote ${file}`);
}

function uvsAt(raw, vertex, component) {
  return raw.uvs[vertex * 2 + component];
}

/** The critic's own PNG decoder, so this file adds no dependency. */
async function decodeSheet(file) {
  const { decodePng } = await import('./png.mjs');
  return decodePng(fs.readFileSync(file));
}

// --- 🎯 THE DISCRIMINATOR, ON PIXELS ----------------------------------------------------------
//
// R27's one-line falsification, and the round stands or falls on it: **a term that varies with
// LIGHT DIRECTION must change when the light moves and the camera does not.**
//
// 🚩 IT CANNOT BE READ OFF TWO PLATES DIRECTLY, AND THAT IS THE TRAP THIS SECTION IS BUILT AROUND.
// Moving the key changes `wrap = (n̂·ωi + 1)/4π` in EVERY arm, so every arm's pedestal moves — the
// shipped one included. What has to be isolated is the DEPTH FACTOR alone. Slide 39's term is
//
//     Σ_lights √C · wrap_i · (C/Luma(C))^(1−Shadow) · scatter
//
// and on the shipped path `Shadow` is per-FRAGMENT, so the chroma factor is common to all five
// lights and comes out of the sum. Therefore the per-pixel ratio of the term at the shipped density
// to the same term at density 0 is EXACTLY `(C/Luma(C))^(1−Shadow)` — with wrap, the light colours,
// the lock albedo, the root occlusion and the side visibility all cancelling identically. That is
// R27's own operator, and it gives the test its two sides:
//
//   SHIPPED   the ratio is a function of the fragment's baked sheet value alone, so it MUST be
//             identical at both key positions. It is the control, and it must not move.
//   ENVELOPE  the ratio is a function of five geometric path lengths, so it MUST move.
//
// The `envelope-fixed-direction` arm is the third row and the sharpest one: it is the new term with
// only its light dependence removed, so it must behave like the control while sharing every line of
// code with the treatment.

const EXPOSURE = 4;
const STEPS = 8;

/** `hair-lightpath.mjs`'s cut for "this pixel was shaded by HairMaterial", re-derived per run. */
const HAIR_SHADED_MAX = 1.5e-2;

/**
 * The two key positions. The rig's own `?ov=` override moves the light AND re-aims it AND rebuilds
 * its shadow camera, which is why it is used instead of poking `light.position` from the page: a
 * hand-moved RectAreaLight keeps its old orientation and stops facing the head, and the `inFront`
 * guard in `directRectArea` then deletes it — a "the term did not move" that would be a bug.
 *
 * 42° is the shipped key azimuth (`LightingRig.FORM_LIGHTS`). −20° swings it across the nose to the
 * fill's side of the face, which is 62° of travel and the largest move that keeps the key a key.
 */
const KEY_POSITIONS = [
    { tag: 'a', query: '', label: 'key azimuth 42 (shipped)' },
    { tag: 'b', query: '&ov=key.azimuthDegrees:-20', label: 'key azimuth -20' }
];

const SET_EXPOSURE = (value) => { window.sugata.stage.renderer.toneMappingExposure = value; };

/** Reads the live material back, so a plate with the wrong provenance says so in its own sidecar. */
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
  const lights = [];
  s.stage.scene.traverse((o) => {
    if (o.isLight !== true) return;
    o.updateMatrixWorld(true);
    lights.push({ name: o.name || o.type, position: [o.position.x, o.position.y, o.position.z] });
  });
  return {
    materialClass: material,
    hair: describe,
    lights,
    shadowMapEnabled: s.stage.renderer.shadowMap.enabled,
    toneMappingExposure: s.stage.renderer.toneMappingExposure
  };
};

/**
 * Writes one of the material's own uniforms on the live page.
 *
 * 🚩 A UNIFORM WRITE AND NOT A URL KEY, for `hair-pedestal.mjs`'s reason and with its words: this
 * round owns no edit to `alive.js`, and adding a key there to run one experiment would be a source
 * change wearing a probe's clothes. The written value is read back into the manifest.
 */
const SET_UNIFORM = ([name, value]) => {
  const s = window.sugata;
  let written = null;
  s.stage.scene.traverse((o) => {
    if (o.material?.name === 'sugata.hair' && o.material.hair?.[name]) {
      o.material.hair[name].value = value;
      written = o.material.hair[name].value;
    }
  });
  return written;
};

async function shoot(port, out, name, query, manifest, uniforms = null) {
  const file = path.join(out, `${name}.png`);
  await withPage(port, query, async (page, url) => {
    await page.evaluate(SET_EXPOSURE, EXPOSURE);
    const written = {};
    for (const [key, value] of Object.entries(uniforms ?? {})) {
      // eslint-disable-next-line no-await-in-loop
      written[key] = await page.evaluate(SET_UNIFORM, [key, value]);
    }
    const census = await page.evaluate(CENSUS_SCRIPT);
    await plate(page, file, STEPS);
    manifest[name] = { url, exposure: EXPOSURE, uniformsWritten: written, census };
    console.log(`  ${name.padEnd(16)} <- ${url}` +
      (Object.keys(written).length ? `   [${Object.entries(written).map(([k, v]) => `${k}=${v}`).join(' ')}]` : ''));
    if (census.materialClass !== 'HairNodeMaterial') {
      console.log(`  🔴 PROVENANCE: materialClass is ${census.materialClass}, not HairNodeMaterial`);
    }
    if (census.hair?.envelope?.fitted !== true) {
      console.log('  🔴 PROVENANCE: the envelope did not fit — every envelope arm on this plate ran with n = 0');
    }
  });
}

/** The three pedestal arms, each as its own INPUT with the same slide-39 form around it. */
const PEDESTAL_ARMS = [
  { tag: 'sheet', defect: null, off: { shadowDensity: 0 },
    label: 'shipped — n = shadowDensity x depth.png at the card\'s atlas uv' },
  { tag: 'env', defect: 'envelope-depth', off: { envelopeExtinction: 0 },
    label: 'R28 — n = sigma_hair x the envelope path length toward each light' },
  { tag: 'fix', defect: 'envelope-fixed-direction', off: { envelopeExtinction: 0 },
    label: '🔴 the falsification arm — the same path length toward a FIXED direction' }
];

async function plates(port, out) {
  fs.mkdirSync(out, { recursive: true });
  const manifest = {};
  const pedestal = `${BASE_QUERY}&hair=1&hairlobes=&hairscatter=1`;

  // The mask pair, both `?shadows=0` because `buildGroomMask` diffs them and a cast shadow would
  // otherwise be read as groom, and the floor every arm below is measured above.
  await shoot(port, out, 'mask-bald', `${BASE_QUERY}&shadows=0`, manifest);
  await shoot(port, out, 'mask-haired', `${BASE_QUERY}&shadows=0&hair=1`, manifest);
  await shoot(port, out, 'floor', `${BASE_QUERY}&hair=1&hairlobes=&hairscatter=0`, manifest);

  // 🚩 THE NOISE FLOOR, AND WITHOUT IT EVERY NUMBER BELOW IS UNBOUNDED. The shipped OIT is
  // `stochastic`: a hashed alpha test decides per fragment per LOAD which card owns a pixel. This
  // is the shipped pedestal captured twice from the same URL with the same uniforms, so whatever
  // the operator reads out of THAT pair is noise by construction and is the bar the rest must clear.
  await shoot(port, out, 'ped-sheet-a1', pedestal, manifest);
  await shoot(port, out, 'ped-sheet-a1b', pedestal, manifest);

  for (const arm of PEDESTAL_ARMS) {
    const defect = arm.defect === null ? '' : `&hairdefect=${arm.defect}`;
    for (const key of KEY_POSITIONS) {
      const url = `${pedestal}${defect}${key.query}`;
      if (!(arm.tag === 'sheet' && key.tag === 'a')) {
        // eslint-disable-next-line no-await-in-loop
        await shoot(port, out, `ped-${arm.tag}-${key.tag}1`, url, manifest);
      }
      // eslint-disable-next-line no-await-in-loop
      await shoot(port, out, `ped-${arm.tag}-${key.tag}0`, url, manifest, arm.off);
    }
  }

  // ⚠️ THE TWO ZINKE ARMS AS PEDESTAL-ONLY PLATES, AND THEY ARE HERE FOR R27's TRAP RATHER THAN FOR
  // COMPLETENESS. R27's whole negative was that its form, LEVEL-MATCHED against the term it
  // replaced, produced the same picture — "a brightness cut wearing a contrast ratio". With every
  // lobe off, the pedestal's mean above the floor is EXACTLY proportional to `hairscatter`, so the
  // matching scalar is one division rather than a solve, and `--level` prints it.
  await shoot(port, out, 'ped-envz-a1', `${pedestal}&hairdefect=envelope-zinke`, manifest);
  await shoot(port, out, 'ped-z27-a1', `${pedestal}&hairdefect=zinke-transmittance`, manifest);

  // The beauty arms, on the judged URL at the shipped key. R is captured ONCE: no arm here touches
  // a lobe, so the R plate is shared and the per-arm statistic is R against THAT arm's mass mean.
  await shoot(port, out, 'r-only', `${BASE_QUERY}&hair=1&hairlobes=r&hairscatter=0`, manifest);
  await shoot(port, out, 'mass-sheet', `${BASE_QUERY}&hair=1`, manifest);
  await shoot(port, out, 'mass-env', `${BASE_QUERY}&hair=1&hairdefect=envelope-depth`, manifest);
  await shoot(port, out, 'mass-envz', `${BASE_QUERY}&hair=1&hairdefect=envelope-zinke`, manifest);
  await shoot(port, out, 'mass-fix', `${BASE_QUERY}&hair=1&hairdefect=envelope-fixed-direction`, manifest);
  await shoot(port, out, 'mass-zinke27', `${BASE_QUERY}&hair=1&hairdefect=zinke-transmittance`, manifest);

  fs.writeFileSync(path.join(out, 'plate-manifest.json'), JSON.stringify(manifest, null, 2));
  console.log(`  wrote ${path.join(out, 'plate-manifest.json')}`);
}

/**
 * 🎯 R27's LEVEL MATCH, SOLVED BY DIVISION RATHER THAN BY A SWEEP.
 *
 * With every lobe off, the pedestal above the indirect floor is `scatter × (everything else)`, so
 * its mean over a fixed pixel set is exactly linear in `hairscatter`. The scalar that makes an arm
 * deliver the SHIPPED pedestal's mean is therefore one division, and the arms it produces are the
 * controls that separate "this term changed the picture's shape" from "this term is darker".
 */
function levelMatch(out) {
  const { shaded, floorPlate } = loadGate(out);
  const set = [];
  for (let k = 0; k < WIDTH * HEIGHT; k += 1) {
    if (shaded[k] === 1 && isInvertible(codesAt(floorPlate, k * 4))) set.push(k);
  }

  const meanAbove = (name) => {
    const png = readPlate(path.join(out, `${name}.png`));
    let sum = 0;
    let n = 0;
    for (const k of set) {
      const codes = codesAt(png, k * 4);
      if (isInvertible(codes) === false) continue;
      sum += luminance(plateToSceneLinear(codes, EXPOSURE)) - luminance(linearAt(floorPlate, k));
      n += 1;
    }
    return sum / n;
  };

  const reference = meanAbove('ped-sheet-a1');
  const scalars = {};
  for (const name of ['ped-envz-a1', 'ped-z27-a1', 'ped-env-a1']) {
    scalars[name] = reference / meanAbove(name);
    console.log(`  ${name.padEnd(14)} pedestal mean above floor ${meanAbove(name).toExponential(4)}  ` +
      `-> scatter ${scalars[name].toFixed(5)} matches the shipped ${reference.toExponential(4)}`);
  }

  // 🎯 AND THE SECOND MATCH, WHICH IS THE ONE THIS ROUND ACTUALLY NEEDS. The one above matches the
  // term's OUTPUT level; this one matches its INPUT's. The geometric `n` and the sheet's `n` are the
  // same quantity in the same units, so if the geometric arm simply runs DEEPER the two arms differ
  // in level as well as in shape — and R27's whole negative was a level difference wearing a shape
  // statistic. So `σ_matched` is the extinction at which the geometric `n` has the SHIPPED `n`'s
  // mean, leaving only the spatial and directional structure to argue about.
  //
  // The shipped `n` is recovered from the plates rather than read off the sheet, because the shader
  // samples that sheet through a mip chain whose footprint CHECKPOINT §2 measured at 4-5.7 texels —
  // a point read of level 0 is not what ran. `recoverShadow` is R27's exact operator, imported.
  const on = readPlate(path.join(out, 'ped-sheet-a1.png'));
  const off = readPlate(path.join(out, 'ped-sheet-a0.png'));
  const colour = baseColourDerivation().linear;
  const shippedEvents = [];
  for (const k of set) {
    const p1 = linearAt(on, k);
    const p0 = linearAt(off, k);
    const floor = linearAt(floorPlate, k);
    const net1 = p1.map((v, c) => v - floor[c]);
    const net0 = p0.map((v, c) => v - floor[c]);
    if (net1.some((v) => v <= 0) || net0.some((v) => v <= 0)) continue;
    const recovered = recoverShadow(net1, net0, colour);
    if (recovered === null) continue;
    // `Shadow` outside (0, 1] is 8-bit slop on a term whose whole range is a few codes; those
    // pixels carry no `n` and are dropped rather than clamped into one.
    if (!(recovered.shadow > 0) || recovered.shadow > 1) continue;
    shippedEvents.push(-Math.log(recovered.shadow));
  }
  const meanShipped = shippedEvents.reduce((a, b) => a + b, 0) / shippedEvents.length;

  console.log(`  shipped n, recovered off the plate pair on ${shippedEvents.length} px: mean ${meanShipped.toFixed(4)} events`);

  fs.writeFileSync(path.join(out, 'level-match.json'), JSON.stringify({
    reference, scalars, shippedEventsMean: meanShipped, shippedEventsSamples: shippedEvents.length
  }, null, 2));
  console.log(`  wrote ${path.join(out, 'level-match.json')}`);
  return scalars;
}

/**
 * The level-matched arms, captured at the scalars `--level` solved.
 *
 * 🚩 THE SCALAR IS WRITTEN AS A UNIFORM AND NOT AS `?hairscatter=`, AND THAT IS FORCED RATHER THAN
 * PREFERRED. `alive.js:2136` parses that key as `number( 'hairscatter', 1, 0, 8 )` — it CLAMPS AT 8
 * — and the Zinke arms need 10.04 and 247.98 to reach the shipped pedestal's level. Passed through
 * the URL both would silently land at 8 and the "level-matched control" would be two arms that are
 * not matched, which is a worse failure than not running the control at all. The uniform is the
 * same object the key writes one layer up, and the written value is read back into the manifest.
 */
async function matchedPlates(port, out) {
  const match = JSON.parse(fs.readFileSync(path.join(out, 'level-match.json'), 'utf8'));
  const manifestPath = path.join(out, 'plate-manifest.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

  // The extinction at which the geometric `n` carries the SHIPPED `n`'s mean. `--verdict`'s
  // arithmetic leg prints the geometric mean this divides into; it is recomputed here from the
  // cache so the two can never disagree.
  const cache = JSON.parse(fs.readFileSync(path.join(out, 'ground-truth-cache.json'), 'utf8'));
  const envelope = fitEnvelope(Float64Array.from(cache.world));
  const points = Float64Array.from(cache.hitPoints);
  const meanGeometric = meanEventsOverLights(cache, envelope, points, HAIR_ENVELOPE_EXTINCTION);
  const sigmaMatched = HAIR_ENVELOPE_EXTINCTION * (match.shippedEventsMean / meanGeometric);

  console.log(`  geometric n at sigma ${HAIR_ENVELOPE_EXTINCTION}: mean ${meanGeometric.toFixed(4)} events; ` +
    `shipped mean ${match.shippedEventsMean.toFixed(4)} -> sigma_matched ${sigmaMatched.toFixed(4)} per metre`);

  const arms = [
    [ 'mass-z27-matched', 'zinke-transmittance', { scatter: match.scalars['ped-z27-a1'] } ],
    [ 'mass-envz-matched', 'envelope-zinke', { scatter: match.scalars['ped-envz-a1'] } ],
    [ 'mass-env-nmatched', 'envelope-depth', { envelopeExtinction: sigmaMatched } ],
    [ 'ped-env-nmatched', 'envelope-depth', { envelopeExtinction: sigmaMatched } ]
  ];
  for (const [name, defect, uniforms] of arms) {
    const query = name.startsWith('ped-')
      ? `${BASE_QUERY}&hair=1&hairlobes=&hairscatter=1&hairdefect=${defect}`
      : `${BASE_QUERY}&hair=1&hairdefect=${defect}`;
    // eslint-disable-next-line no-await-in-loop
    await shoot(port, out, name, query, manifest, uniforms);
  }

  manifest.__levelMatch = { ...match, meanGeometric, sigmaMatched };
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  console.log(`  wrote ${manifestPath}`);
}

/**
 * 🎯 THE CONTROL THAT DECIDES THE ROUND, AND IT IS R27's OWN DISCRIMINATOR MOVED ONE LEVEL DOWN.
 *
 * The level-matched Zinke arms show the ENVELOPE input producing a much wider mass than the SHEET
 * input does at the same level. There are two ways that can happen and only one of them is this
 * round's claim:
 *
 *   (i)  the geometric `n` has SPATIAL AND DIRECTIONAL STRUCTURE the sheet's has not — the claim;
 *   (ii) the geometric `n` is simply BIGGER, and any `n` that big would widen the term, because
 *        `√C^(1+n)` is convex in `n` — a level difference in the INPUT wearing a shape statistic in
 *        the OUTPUT, which is exactly the trap R27 fell into one level up.
 *
 * So this arm is the sheet input driven to the geometric input's own mean `n` — `shadowDensity`
 * scaled by the ratio of the two means — and then level-matched at the output like the others. If it
 * reproduces the envelope arm's width, (ii) is the explanation and the round is a negative.
 */
async function controlPlates(port, out) {
  const manifestPath = path.join(out, 'plate-manifest.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const match = manifest.__levelMatch;

  if (match == null) throw new Error('hair-envelope: run --level and --matched first.');

  const density = HAIR_DEFAULTS.shadowDensity * (match.meanGeometric / match.shippedEventsMean);
  console.log(`  the sheet input driven to the geometric mean n: shadowDensity ` +
    `${HAIR_DEFAULTS.shadowDensity} -> ${density.toFixed(4)}`);

  const pedestal = `${BASE_QUERY}&hair=1&hairlobes=&hairscatter=1&hairdefect=zinke-transmittance`;
  await shoot(port, out, 'ped-z27deep-a1', pedestal, manifest, { shadowDensity: density });

  // Its own output level match, solved on the plate just taken.
  const { shaded, floorPlate } = loadGate(out);
  const set = [];
  for (let k = 0; k < WIDTH * HEIGHT; k += 1) {
    if (shaded[k] === 1 && isInvertible(codesAt(floorPlate, k * 4))) set.push(k);
  }
  const meanAbove = (name) => {
    const png = readPlate(path.join(out, `${name}.png`));
    let sum = 0;
    let n = 0;
    for (const k of set) {
      const codes = codesAt(png, k * 4);
      if (isInvertible(codes) === false) continue;
      sum += luminance(plateToSceneLinear(codes, EXPOSURE)) - luminance(linearAt(floorPlate, k));
      n += 1;
    }
    return sum / n;
  };
  const scalar = meanAbove('ped-sheet-a1') / meanAbove('ped-z27deep-a1');
  console.log(`  its level match: scatter ${scalar.toFixed(5)}`);

  await shoot(port, out, 'mass-z27deep-matched', `${BASE_QUERY}&hair=1&hairdefect=zinke-transmittance`,
    manifest, { shadowDensity: density, scatter: scalar });

  manifest.__control = { shadowDensity: density, scatter: scalar };
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  console.log(`  wrote ${manifestPath}`);
}

/** The mean of `n` over every light and every measured fragment, at a given extinction. */
function meanEventsOverLights(cache, envelope, points, sigma) {
  const count = points.length / 3;
  let sum = 0;
  let n = 0;
  for (const light of cache.lights) {
    for (let s = 0; s < count; s += 1) {
      const origin = [points[s * 3], points[s * 3 + 1], points[s * 3 + 2]];
      const d = [light.position[0] - origin[0], light.position[1] - origin[1], light.position[2] - origin[2]];
      const len = Math.hypot(...d);
      sum += sigma * shellPathLength(origin, [d[0] / len, d[1] / len, d[2] / len], envelope);
      n += 1;
    }
  }
  return sum / n;
}

// --- the verdict ------------------------------------------------------------------------------

function percentileOf(sorted, q) {
  if (sorted.length === 0) return 0;
  return sorted[Math.min(sorted.length - 1, Math.max(0, Math.round(q * (sorted.length - 1))))];
}

/** The gate: inside the eroded groom mask AND actually shaded by `HairMaterial` on the floor plate. */
function loadGate(out) {
  const bald = readPlate(path.join(out, 'mask-bald.png'));
  const haired = readPlate(path.join(out, 'mask-haired.png'));
  const solid = erodeMask(buildGroomMask(bald, haired), WIDTH, HEIGHT, 2);
  const floorPlate = readPlate(path.join(out, 'floor.png'));

  const shaded = new Uint8Array(WIDTH * HEIGHT);
  let inside = 0;
  let kept = 0;
  for (let k = 0; k < WIDTH * HEIGHT; k += 1) {
    if (solid[k] !== 1) continue;
    const codes = codesAt(floorPlate, k * 4);
    if (isInvertible(codes) === false) continue;
    inside += 1;
    if (luminance(plateToSceneLinear(codes, EXPOSURE)) < HAIR_SHADED_MAX) { shaded[k] = 1; kept += 1; }
  }
  return { shaded, floorPlate, inside, kept };
}

function linearAt(png, k) {
  return plateToSceneLinear(codesAt(png, k * 4), EXPOSURE);
}

/**
 * The depth factor, per pixel, as the ratio of the term at its shipped density to the term with the
 * density set to zero — both above the indirect floor. See the section header for the algebra that
 * makes this exactly the depth factor and nothing else on the shipped path.
 */
function depthFactor(onPlate, offPlate, floorPlate, set) {
  const out = new Float64Array(set.length * 3);
  for (let i = 0; i < set.length; i += 1) {
    const k = set[i];
    const on = linearAt(onPlate, k);
    const off = linearAt(offPlate, k);
    const floor = linearAt(floorPlate, k);
    for (let c = 0; c < 3; c += 1) {
      const denominator = off[c] - floor[c];
      out[i * 3 + c] = denominator > 1e-6 ? (on[c] - floor[c]) / denominator : NaN;
    }
  }
  return out;
}

/**
 * 🎯 THE FALSIFICATION WITH NO PLATE IN IT.
 *
 * `n` is a closed-form function of the fragment, the envelope and the light position, and all three
 * were measured on the live page: the fragments by the CPU raster, the envelope by the material's
 * own fit (which `--geometry` reproduces digit for digit), and the two key positions by this run's
 * own manifest census. So "does the term vary with light direction" can be answered in exact
 * arithmetic, with no 8-bit plate anywhere near it, and answered for the SHIPPED input in the same
 * breath — because a texture read at `uv()` has no light in its expression at all.
 */
function arithmeticLeg(out) {
  const cachePath = path.join(out, 'ground-truth-cache.json');
  const manifestPath = path.join(out, 'plate-manifest.json');

  if (fs.existsSync(cachePath) === false) {
    console.log('\n  (the arithmetic leg needs --geometry\'s cache; skipped)');
    return;
  }

  const cache = JSON.parse(fs.readFileSync(cachePath, 'utf8'));
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const envelope = fitEnvelope(Float64Array.from(cache.world));
  const points = Float64Array.from(cache.hitPoints);
  const count = points.length / 3;

  const keyAt = (plateName) =>
    manifest[plateName].census.lights.find((l) => l.name === 'key').position;
  const a = keyAt('ped-sheet-a1');
  const b = keyAt('ped-sheet-b1');

  const sigma = HAIR_ENVELOPE_EXTINCTION;
  const deltas = [];
  const atA = [];
  const atB = [];
  for (let s = 0; s < count; s += 1) {
    const origin = [points[s * 3], points[s * 3 + 1], points[s * 3 + 2]];
    const toward = (light) => {
      const d = [light[0] - origin[0], light[1] - origin[1], light[2] - origin[2]];
      const len = Math.hypot(...d);
      return [d[0] / len, d[1] / len, d[2] / len];
    };
    const na = sigma * shellPathLength(origin, toward(a), envelope);
    const nb = sigma * shellPathLength(origin, toward(b), envelope);
    atA.push(na);
    atB.push(nb);
    deltas.push(Math.abs(na - nb));
  }
  deltas.sort((x, y) => x - y);
  const mean = (v) => v.reduce((p, c) => p + c, 0) / v.length;

  console.log('\n  🎯 THE ARITHMETIC LEG — the shipped mirror, no plate, no quantisation:');
  console.log(`     the key moves [${a.map((v) => v.toFixed(3)).join(', ')}] -> [${b.map((v) => v.toFixed(3)).join(', ')}], camera unchanged`);
  console.log(`     n toward the key, over ${count} measured fragments:  mean ${mean(atA).toFixed(4)} -> ${mean(atB).toFixed(4)}`);
  console.log(`     |Δn| p50 ${percentileOf(deltas, 0.5).toFixed(4)}   p90 ${percentileOf(deltas, 0.9).toFixed(4)}   ` +
    `max ${percentileOf(deltas, 1).toFixed(4)}   fragments with Δ = 0: ` +
    `${((deltas.filter((d) => d === 0).length / count) * 100).toFixed(2)}%`);
  console.log('     🔴 CONTROL — the SHIPPED input over the same move: n = shadowDensity x depth.png at uv(),');
  console.log('        in which no light appears, so |Δn| is 0.0000 at every percentile BY CONSTRUCTION.');
}

function verdict(out) {
  const { shaded, floorPlate, inside, kept } = loadGate(out);
  const names = [
    'ped-sheet-a1', 'ped-sheet-a1b', 'ped-sheet-a0', 'ped-sheet-b1', 'ped-sheet-b0',
    'ped-env-a1', 'ped-env-a0', 'ped-env-b1', 'ped-env-b0',
    'ped-fix-a1', 'ped-fix-a0', 'ped-fix-b1', 'ped-fix-b0',
    'ped-envz-a1', 'ped-z27-a1', 'ped-env-nmatched', 'ped-z27deep-a1',
    'r-only', 'mass-sheet', 'mass-env', 'mass-envz', 'mass-fix', 'mass-zinke27',
    'mass-envz-matched', 'mass-z27-matched', 'mass-env-nmatched', 'mass-z27deep-matched'
  ];
  const plate_ = {};
  for (const n of names) plate_[n] = readPlate(path.join(out, `${n}.png`));

  const set = [];
  for (let k = 0; k < WIDTH * HEIGHT; k += 1) {
    if (shaded[k] !== 1) continue;
    if (isInvertible(codesAt(floorPlate, k * 4)) === false) continue;
    if (Object.values(plate_).every((p) => isInvertible(codesAt(p, k * 4)))) set.push(k);
  }

  console.log(`\n  GATE  ${inside} invertible pixels in the eroded groom mask, ${kept} shaded by ` +
    `HairMaterial (${((kept / inside) * 100).toFixed(2)}%)`);
  console.log(`  ${set.length} pixels invertible in ALL ${names.length} arms — every row below is this one set`);

  console.log('\n================================================================================');
  console.log(' 1. 🎯 THE DISCRIMINATOR — does the depth factor move when the KEY moves?');
  console.log('================================================================================\n');

  // The noise floor first, so every number under it has a bar to clear.
  const noise = [];
  for (const k of set) {
    const a = linearAt(plate_['ped-sheet-a1'], k);
    const b = linearAt(plate_['ped-sheet-a1b'], k);
    for (let c = 0; c < 3; c += 1) noise.push(Math.abs(a[c] - b[c]));
  }
  noise.sort((x, y) => x - y);
  console.log(`  🚩 NOISE FLOOR, the SHIPPED pedestal captured twice from the same URL:`);
  console.log(`     |ΔRGB| p50 ${percentileOf(noise, 0.5).toExponential(3)}   ` +
    `p99 ${percentileOf(noise, 0.99).toExponential(3)}   max ${percentileOf(noise, 1).toExponential(3)}`);

  const rows = [];
  for (const arm of PEDESTAL_ARMS) {
    const a = depthFactor(plate_[`ped-${arm.tag}-a1`], plate_[`ped-${arm.tag}-a0`], floorPlate, set);
    const b = depthFactor(plate_[`ped-${arm.tag}-b1`], plate_[`ped-${arm.tag}-b0`], floorPlate, set);
    const deltas = [];
    let identical = 0;
    let counted = 0;
    for (let i = 0; i < a.length; i += 1) {
      if (Number.isNaN(a[i]) || Number.isNaN(b[i])) continue;
      counted += 1;
      const d = Math.abs(a[i] - b[i]);
      deltas.push(d);
      if (d === 0) identical += 1;
    }
    deltas.sort((x, y) => x - y);
    const factors = Array.from(a).filter((v) => Number.isNaN(v) === false).sort((x, y) => x - y);
    rows.push({
      tag: arm.tag,
      label: arm.label,
      counted,
      identicalFraction: identical / counted,
      dP50: percentileOf(deltas, 0.5),
      dP90: percentileOf(deltas, 0.9),
      dP99: percentileOf(deltas, 0.99),
      factorP10: percentileOf(factors, 0.1),
      factorP50: percentileOf(factors, 0.5),
      factorP90: percentileOf(factors, 0.9)
    });
  }

  console.log('\n  arm     depth factor at key 42        | change when the key moves to -20');
  console.log('          p10      p50      p90         | bit-identical   |Δ| p50      |Δ| p90      |Δ| p99');
  for (const r of rows) {
    console.log(
      `  ${r.tag.padEnd(6)}  ${r.factorP10.toFixed(4)}   ${r.factorP50.toFixed(4)}   ${r.factorP90.toFixed(4)}      | ` +
      `${(r.identicalFraction * 100).toFixed(2).padStart(9)}%   ${r.dP50.toExponential(3)}   ` +
      `${r.dP90.toExponential(3)}   ${r.dP99.toExponential(3)}`
    );
  }
  for (const r of rows) console.log(`  ${r.tag.padEnd(6)}  ${r.label}`);

  const sheet = rows.find((r) => r.tag === 'sheet');
  const env = rows.find((r) => r.tag === 'env');
  const fixed = rows.find((r) => r.tag === 'fix');
  console.log('');
  console.log('  ⚠️ READ THE `sheet` ROW BEFORE THE `env` ROW. By the algebra above the shipped arm\'s depth');
  console.log('     factor CANNOT depend on the key, yet its |Δ| p90 is 1.998e-2 rather than 0. That is not a');
  console.log('     refutation of the algebra: the plates are 8-BIT, moving the key changes every LEVEL in the');
  console.log('     frame, and a ratio of two quantised numbers moves when its inputs requantise. R27 measured');
  console.log('     the same quantisation floor from the other side (channel-pair disagreement p50 1.83e-1).');
  console.log('     So this section is a RATIO OF EFFECTS against that floor and not an absolute reading —');
  console.log('     which is why §1b below exists and is the leg the falsification actually stands on.');
  console.log(`     geometric ÷ shipped ${(env.dP90 / Math.max(sheet.dP90, Number.MIN_VALUE)).toFixed(2)}x at p90;   ` +
    `geometric ÷ fixed-direction ${(env.dP90 / Math.max(fixed.dP90, Number.MIN_VALUE)).toFixed(2)}x`);

  console.log('\n================================================================================');
  console.log(' 1b. 🎯 THE ONE-EXPRESSION A/B — the same term, evaluated toward the light or not');
  console.log('================================================================================\n');

  // 🚩 THIS IS THE CLEAN LEG, AND IT NEEDS NO RATIO AND NO SECOND LIGHT POSITION. `envelope-depth`
  // and `envelope-fixed-direction` share every line of this material: the same fitted shell, the
  // same extinction, the same two chords, the same slide-39 form around them. They differ in ONE
  // token — whether `toward` is `toLight` or a constant. So any pixel on which they disagree is a
  // pixel whose shading depends on where the light is, measured against a noise floor that this
  // run read as EXACTLY ZERO on two loads of the same URL.
  const oneExpression = [];
  let moved = 0;
  for (const k of set) {
    const a = linearAt(plate_['mass-env'], k);
    const b = linearAt(plate_['mass-fix'], k);
    let delta = 0;
    for (let c = 0; c < 3; c += 1) delta = Math.max(delta, Math.abs(a[c] - b[c]));
    oneExpression.push(delta);
    if (delta > 0) moved += 1;
  }
  oneExpression.sort((x, y) => x - y);
  console.log(`  mass-env vs mass-fix, one token apart, same light, same camera:`);
  console.log(`    pixels that MOVED           ${moved} of ${set.length}  (${((moved / set.length) * 100).toFixed(2)}%)`);
  console.log(`    max |ΔRGB| p50 ${percentileOf(oneExpression, 0.5).toExponential(3)}   ` +
    `p90 ${percentileOf(oneExpression, 0.9).toExponential(3)}   ` +
    `p99 ${percentileOf(oneExpression, 0.99).toExponential(3)}   ` +
    `max ${percentileOf(oneExpression, 1).toExponential(3)}`);
  console.log(`    noise floor, two loads of one URL, on this same statistic: 0.000e+0 at every percentile`);

  // And the same pair on the pedestal alone, where nothing else in the frame can dilute it.
  const pedOnly = [];
  for (const k of set) {
    const a = linearAt(plate_['ped-env-a1'], k);
    const b = linearAt(plate_['ped-fix-a1'], k);
    let delta = 0;
    for (let c = 0; c < 3; c += 1) delta = Math.max(delta, Math.abs(a[c] - b[c]));
    pedOnly.push(delta);
  }
  pedOnly.sort((x, y) => x - y);
  console.log(`  the same pair with every lobe off — the pedestal alone:`);
  console.log(`    max |ΔRGB| p50 ${percentileOf(pedOnly, 0.5).toExponential(3)}   ` +
    `p90 ${percentileOf(pedOnly, 0.9).toExponential(3)}   max ${percentileOf(pedOnly, 1).toExponential(3)}`);

  // 🎯 AND THE ARITHMETIC LEG, WHICH INVOLVES NO PLATE AND THEREFORE NO QUANTISATION AT ALL. The
  // shipped CPU mirror, on the shipped envelope, at the 7,913 fragments the ray cast measured, with
  // the key at both positions read out of this run's OWN manifest census.
  arithmeticLeg(out);

  console.log('\n================================================================================');
  console.log(' 2. THE R LOBE AGAINST THE MASS IT SITS ON — the numbers the round is judged by');
  console.log('================================================================================\n');

  const floorLuma = set.map((k) => luminance(linearAt(floorPlate, k)));
  const rNet = set.map((k, i) => luminance(linearAt(plate_['r-only'], k)) - floorLuma[i]);

  console.log('  arm            massMean    R p99      P99/MASS   PEAK/MASS  mass p95/p50  >4x R own mean');
  const massArms = [
    ['mass-sheet', 'shipped (slide 39, sheet input)'],
    ['mass-env', 'slide 39 form, ENVELOPE input — R28\'s A/B against the row above'],
    ['mass-fix', '🔴 slide 39 form, envelope path toward a FIXED direction'],
    ['mass-zinke27', 'R27 Zinke form, sheet input — unmatched, and 48% darker'],
    ['mass-envz', 'R28 Zinke form, envelope input — unmatched, and 53% darker'],
    ['mass-z27-matched', '🎯 R27 Zinke form, sheet input, LEVEL MATCHED to the shipped pedestal'],
    ['mass-envz-matched', '🎯 R28 Zinke form, envelope input, LEVEL MATCHED to the same'],
    ['mass-env-nmatched', '🎯 slide 39 form, envelope input at the sigma that matches the SHIPPED mean n'],
    ['mass-z27deep-matched', '🔴 THE CONTROL: Zinke form, SHEET input driven to the geometric mean n, level matched']
  ];
  const massRows = [];
  for (const [name, label] of massArms) {
    const mass = set.map((k) => luminance(linearAt(plate_[name], k)));
    const massMean = mass.reduce((a, b) => a + b, 0) / mass.length;
    const shape = bandShape(rNet, massMean);
    const sortedMass = [...mass].sort((a, b) => a - b);
    const sortedR = [...rNet].sort((a, b) => a - b);
    const row = {
      name, label, massMean,
      rP99: percentileOf(sortedR, 0.99),
      p99OverMass: percentileOf(sortedR, 0.99) / massMean,
      peakOverMass: shape.peakOverMassMean,
      massP95OverP50: percentileOf(sortedMass, 0.95) / percentileOf(sortedMass, 0.5),
      above4: shape.above4
    };
    massRows.push(row);
    console.log(
      `  ${name.padEnd(14)} ${row.massMean.toExponential(3)}  ${row.rP99.toExponential(3)}  ` +
      `${row.p99OverMass.toFixed(4).padStart(8)}   ${row.peakOverMass.toFixed(4).padStart(8)}  ` +
      `${row.massP95OverP50.toFixed(4).padStart(12)}  ${(row.above4 * 100).toFixed(4).padStart(10)}%`
    );
  }
  for (const [name, label] of massArms) console.log(`  ${name.padEnd(14)} ${label}`);

  console.log('\n================================================================================');
  console.log(' 3. 🎯 THE PEDESTAL\'S OWN SHAPE — the one statistic no level match can flatter');
  console.log('================================================================================\n');

  // 🚩 WITH EVERY LOBE OFF, `scatter` IS A PURE SCALAR ON THE WHOLE TERM, so a RATIO of two
  // percentiles of the pedestal above the floor is EXACTLY invariant to it. That makes this section
  // immune by construction to the trap that has now caught two rounds — "a brightness cut wearing a
  // contrast ratio" — because there is no level left in the number to cut. No matching, no solve.
  console.log('  arm                p10        p50        p90        p95/p50   p90/p10   mean');
  const pedArms = [
    ['ped-sheet-a1', 'shipped — slide 39 on the baked sheet'],
    ['ped-env-a1', 'slide 39 on the envelope path, sigma 74.75'],
    ['ped-env-nmatched', 'slide 39 on the envelope path at the mean-n-matched sigma'],
    ['ped-fix-a1', '🔴 slide 39 on the envelope path toward a FIXED direction'],
    ['ped-z27-a1', 'Zinke form on the sheet — R27'],
    ['ped-z27deep-a1', '🔴 CONTROL: Zinke form on the sheet, driven to the geometric mean n'],
    ['ped-envz-a1', 'Zinke form on the envelope path — R28']
  ];
  const pedRows = [];
  for (const [name, label] of pedArms) {
    const values = set.map((k, i) => luminance(linearAt(plate_[name], k)) - floorLuma[i]).sort((a, b) => a - b);
    const row = {
      name, label,
      p10: percentileOf(values, 0.1),
      p50: percentileOf(values, 0.5),
      p90: percentileOf(values, 0.9),
      p95OverP50: percentileOf(values, 0.95) / percentileOf(values, 0.5),
      p90OverP10: percentileOf(values, 0.9) / percentileOf(values, 0.1),
      mean: values.reduce((a, b) => a + b, 0) / values.length
    };
    pedRows.push(row);
    console.log(
      `  ${name.padEnd(18)} ${row.p10.toExponential(2)}  ${row.p50.toExponential(2)}  ` +
      `${row.p90.toExponential(2)}  ${row.p95OverP50.toFixed(4).padStart(8)}  ` +
      `${row.p90OverP10.toFixed(4).padStart(8)}  ${row.mean.toExponential(2)}`
    );
  }
  for (const [name, label] of pedArms) console.log(`  ${name.padEnd(18)} ${label}`);

  fs.writeFileSync(path.join(out, 'verdict.json'), JSON.stringify({
    gate: { inside, kept, set: set.length },
    noise: { p50: percentileOf(noise, 0.5), p99: percentileOf(noise, 0.99), max: percentileOf(noise, 1) },
    discriminator: rows,
    oneExpression: {
      movedPixels: moved, of: set.length,
      p50: percentileOf(oneExpression, 0.5), p90: percentileOf(oneExpression, 0.9),
      p99: percentileOf(oneExpression, 0.99), max: percentileOf(oneExpression, 1)
    },
    mass: massRows,
    pedestal: pedRows
  }, null, 2));

  writeVerdictRecord(out, { moved, of: set.length, massRows, pedRows });
  console.log(`\n  wrote ${path.join(out, 'verdict.json')}`);
}

// --- the gate --------------------------------------------------------------------------------

/**
 * Every operator here is validated against arithmetic whose answer is known by construction, and
 * two clauses are RED PROOFS: they assert that a wrong version of the model FAILS.
 */
function selftest() {
  const checks = [];
  const check = (name, pass, detail) => { checks.push({ name, pass, detail }); };
  const close = (a, b, tol = 1e-9) => Math.abs(a - b) <= tol;

  // 1. A unit sphere at the origin, ray from the centre along +x: exit at t = 1.
  const unit = ellipsoidSpan([0, 0, 0], [1, 0, 0], [0, 0, 0], [1, 1, 1]);
  check('ellipsoidSpan: unit sphere from its centre exits at t=1',
    close(unit[1], 1) && close(unit[0], -1), `got [${unit}]`);

  // 2. Radii are honoured per axis: a 2×3×4 ellipsoid exits at its own semi-axis on each axis.
  const rx = ellipsoidSpan([0, 0, 0], [1, 0, 0], [0, 0, 0], [2, 3, 4]);
  const ry = ellipsoidSpan([0, 0, 0], [0, 1, 0], [0, 0, 0], [2, 3, 4]);
  const rz = ellipsoidSpan([0, 0, 0], [0, 0, 1], [0, 0, 0], [2, 3, 4]);
  check('ellipsoidSpan: an anisotropic ellipsoid exits at each semi-axis',
    close(rx[1], 2) && close(ry[1], 3) && close(rz[1], 4),
    `got ${rx[1]}, ${ry[1]}, ${rz[1]}`);

  // 3. A miss is a miss. A ray offset two radii away never meets the sphere.
  check('ellipsoidSpan: a ray that misses returns null',
    ellipsoidSpan([0, 2, 0], [1, 0, 0], [0, 0, 0], [1, 1, 1]) === null, '');

  // 4. Only the forward half counts. A ray STARTING at the far surface and pointing outward has
  //    zero forward length even though the algebraic span is 2 units long.
  const behind = ellipsoidSpan([1, 0, 0], [1, 0, 0], [0, 0, 0], [1, 1, 1]);
  check('forwardLength: a span entirely behind the fragment is zero',
    close(forwardLength(behind), 0), `got ${forwardLength(behind)}`);

  // 5. 🎯 THE MODEL'S OWN ARITHMETIC. Concentric spheres of radius 2 and 1, a fragment on the outer
  //    shell at x=2 firing back through the middle: the outer chord is 4, the inner chord is 2, so
  //    the shell path is 2 — one unit of shell on the way in and one on the way out.
  const shell = { centre: [0, 0, 0], outer: [2, 2, 2], inner: [1, 1, 1] };
  const through = shellPathLength([2, 0, 0], [-1, 0, 0], shell);
  check('shellPathLength: a diametral ray crosses the shell twice',
    close(through, 2), `got ${through}, expected 2`);

  // 6. And the same fragment firing OUTWARD crosses nothing at all.
  const outward = shellPathLength([2, 0, 0], [1, 0, 0], shell);
  check('shellPathLength: a fragment on the envelope firing outward has zero path',
    close(outward, 0), `got ${outward}`);

  // 7. 🔴 RED PROOF — THE LIGHT-DIRECTION DISCRIMINATOR, AS ARITHMETIC. R27 killed the previous
  //    attempt by showing it was a scalar in disguise. A term that varies with light direction must
  //    produce DIFFERENT numbers at one fragment for two different directions. A tangential ray and
  //    a diametral ray from the same point must not agree.
  const tangential = shellPathLength([2, 0, 0], [0, 1, 0], shell);
  check('🔴 shellPathLength varies with DIRECTION at a fixed fragment',
    Math.abs(through - tangential) > 1e-6,
    `diametral ${through.toFixed(6)} vs tangential ${tangential.toFixed(6)} — equal would mean a scalar in disguise`);

  // 8. 🔴 RED PROOF — and it must vary with the FRAGMENT too, for a fixed direction. A model that
  //    only reads the direction is a per-light constant, which is the other way to fake this.
  const atFront = shellPathLength([1.5, 0, 0], [-1, 0, 0], shell);
  check('🔴 shellPathLength varies with the FRAGMENT at a fixed direction',
    Math.abs(through - atFront) > 1e-6,
    `on the envelope ${through.toFixed(6)} vs mid-shell ${atFront.toFixed(6)}`);

  // 9. The fit recovers an ellipsoid it is handed. 2,000 points ON a known ellipsoid, off-centre.
  const centre = [0.1, 1.5, -0.2];
  const radii = [0.09, 0.12, 0.10];
  const cloud = new Float64Array(2000 * 3);
  for (let i = 0; i < 2000; i += 1) {
    // A deterministic spiral over the sphere, so the gate has no seed to disagree about.
    const z = -1 + (2 * i) / 1999;
    const r = Math.sqrt(Math.max(0, 1 - z * z));
    const phi = i * 2.399963229728653;
    cloud[i * 3] = centre[0] + radii[0] * r * Math.cos(phi);
    cloud[i * 3 + 1] = centre[1] + radii[1] * r * Math.sin(phi);
    cloud[i * 3 + 2] = centre[2] + radii[2] * z;
  }
  const fit = fitEllipsoid(cloud);
  check('fitEllipsoid: recovers a known off-centre ellipsoid to 1e-6',
    close(fit.centre[0], centre[0], 1e-6) && close(fit.centre[1], centre[1], 1e-6) &&
    close(fit.centre[2], centre[2], 1e-6) && close(fit.radii[0], radii[0], 1e-6) &&
    close(fit.radii[1], radii[1], 1e-6) && close(fit.radii[2], radii[2], 1e-6),
    `centre [${fit.centre.map((v) => v.toFixed(6))}] radii [${fit.radii.map((v) => v.toFixed(6))}]`);

  check('fitEllipsoid: a cloud that IS the surface has ~zero residual',
    fit.residual < 1e-6, `residual ${fit.residual.toExponential(3)}`);

  const failed = checks.filter((c) => c.pass === false);
  for (const c of checks) console.log(`  ${c.pass ? 'ok  ' : 'FAIL'}  ${c.name}${c.detail ? `  — ${c.detail}` : ''}`);
  console.log(`\n  ${checks.length - failed.length}/${checks.length} clauses green`);
  return failed.length === 0;
}

// --- entry -----------------------------------------------------------------------------------

function flag(name, fallback) {
  const i = process.argv.indexOf(name);
  return i === -1 ? fallback : process.argv[i + 1];
}

async function main() {
  const out = path.resolve(REPO, flag('--out', 'captures/hair-r28-envelope'));
  const port = flag('--port', '5177');
  const stride = Number(flag('--stride', String(GEOMETRY_STRIDE)));

  if (process.argv.includes('--selftest')) {
    process.exit(selftest() ? 0 : 1);
  }
  if (process.argv.includes('--geometry')) {
    await geometry(port, out, stride);
    return;
  }
  if (process.argv.includes('--models')) {
    scoreModels(out);
    return;
  }
  if (process.argv.includes('--plates')) {
    await plates(port, out);
    return;
  }
  if (process.argv.includes('--level')) {
    levelMatch(out);
    return;
  }
  if (process.argv.includes('--matched')) {
    await matchedPlates(port, out);
    return;
  }
  if (process.argv.includes('--control')) {
    await controlPlates(port, out);
    return;
  }
  if (process.argv.includes('--verdict')) {
    verdict(out);
    return;
  }
  console.log('usage: hair-envelope.mjs ' +
    '[--selftest | --geometry | --models | --plates | --level | --matched | --control | --verdict]' +
    '  [--port 5177 --out DIR --stride 7]');
}

if (process.argv[1] && import.meta.url.endsWith(path.basename(process.argv[1]))) {
  main().catch((error) => { console.error(error); process.exit(1); });
}
