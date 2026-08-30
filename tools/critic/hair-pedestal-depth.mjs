#!/usr/bin/env node
//
// hair-pedestal-depth.mjs — R36: the four-constants pedestal on plates, level-matched, gated.
//
// THE REGISTRATION IS `docs/superpowers/specs/2026-08-24-r36-pedestal-lightdepth.md`, committed
// BEFORE any arm below was rendered. Nothing here may move a threshold in it.
//
// WHAT THIS ANSWERS. R35 measured the mechanism in arithmetic: the pedestal — 65.4% of the groom's
// energy — is light-blind, the #0f30ff rim pollutes it through 26 cards of hair, and per-light
// constant depth through the existing zinke form recovers 70% of a +109% fibre-axis saturation
// ceiling. This round asks whether that survives the FULL PIPELINE, level-matched, on the plate.
//
// 🔴 LEVEL-MATCHING IS THE LOAD-BEARING DISCIPLINE. The arm costs 0.68× luma on the term; judged
// raw the A/B is "darker and warmer" against "brighter and muddy" — two variables, the recorded
// eight-round mistake. The arm is bisected on ITS OWN pedestal scalar (`?hairscatter=X`, the same
// term being changed, one free variable) until the hair-mask p50 linear luma matches the shipped
// plate within ±0.5%, and ONLY the matched arm is scored. The bisection reads luma alone — it is
// blind to every colour statistic by the order of operations.
//
// USAGE (the runner starts its own vite; nothing external)
//   node tools/critic/hair-pedestal-depth.mjs --masks
//   node tools/critic/hair-pedestal-depth.mjs --arms
//   node tools/critic/hair-pedestal-depth.mjs --match      # bisect depth AND flat to the base luma
//   node tools/critic/hair-pedestal-depth.mjs --report

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { codesAt, isInvertible, readPlate, plateToSceneLinear, luminance, plate } from './lightpath-probe.mjs';
import { BASE_QUERY, HEIGHT, LOBE_EXPOSURE, RECTS, STEPS, WIDTH, loadMasks, withPage } from './hair-lightpath.mjs';
import { fibreAxis, saturationTowardFibre } from './hair-tf-ceiling.mjs';
import { baseColourDerivation } from '../../packages/core/src/material/HairMaterial.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..', '..');
const OUT = path.join(REPO, 'captures', 'hair-r36-pedestal-depth');

/** Registered gate constants. Changing any of these after a capture is renegotiation. */
export const GATE_LEVEL = 0.005;        // matched arm's hair p50 luma within ±0.5% of shipped
export const GATE_EFFECT = 0.10;        // depth-matched primary relative gain floor
export const GATE_DECOY_SHARE = 0.30;   // flat-matched gain must stay under this share of depth's
export const GATE_DRIFT_SHARE = 0.10;   // shipped-vs-repeat |Δ| under this share of the effect
export const GATE_SKIN_SHARE = 0.20;    // skin's |Δ| under this share of hair's

const ARMS = [
  { key: 'base', label: 'shipped', query: 'hair=1' },
  { key: 'depth', label: 'four-constants pedestal', query: 'hair=1&hairdefect=pedestal-lightdepth' },
  // 🚩 THE DECOY: identical machinery, every constant forced to the mean — light-blind by
  // construction. If this scores like `depth` after the SAME level match, per-light
  // differentiation is not the cause and R35's decomposition is re-opened (registration §7).
  { key: 'flat', label: 'DECOY: light-blind mean', query: 'hair=1&hairdefect=pedestal-lightdepth-flat' },
  // Context, decides nothing: the known ceiling on removing rim pollution (R33: on hair,
  // bit-identical to a full shadow caster).
  { key: 'rim0', label: 'rim deleted (context)', query: 'hair=1&ov=rim.irradiance:0' },
  // The SAME configuration under a second spelling, captured at the far end of the arm order.
  // Its difference from `base` is the run's noise floor.
  { key: 'base-2', label: 'shipped (repeat)', query: 'hair=1&hairscatter=1' },
];

const FLOOR_ARM = { file: path.join('lobes', 'nothing-indirect-only-.png'), query: 'hair=1&hairlobes=&hairscatter=0' };
const MASK_ARMS = [
  ['C-hairoff-noshadows.png', `${BASE_QUERY}&shadows=0`],
  ['D-hairon-noshadows.png', `${BASE_QUERY}&shadows=0&hair=1`],
];

const AXIS = fibreAxis(baseColourDerivation().linear);

// --- capture -------------------------------------------------------------------------------

async function captureMasks(port) {
  fs.mkdirSync(path.join(OUT, 'lobes'), { recursive: true });
  for (const [file, query] of MASK_ARMS) {
    // eslint-disable-next-line no-await-in-loop
    await withPage(port, query, async (page, url) => {
      await plate(page, path.join(OUT, file), STEPS);
      console.log(`  ${file}  <- ${url}`);
    });
  }
  await withPage(port, `${BASE_QUERY}&${FLOOR_ARM.query}`, async (page, url) => {
    await page.evaluate((v) => { window.sugata.stage.renderer.toneMappingExposure = v; }, LOBE_EXPOSURE);
    await plate(page, path.join(OUT, FLOOR_ARM.file), STEPS);
    console.log(`  ${FLOOR_ARM.file}  <- ${url}  (exposure ${LOBE_EXPOSURE})`);
  });
}

async function captureArms(port) {
  fs.mkdirSync(OUT, { recursive: true });
  for (const arm of ARMS) {
    // eslint-disable-next-line no-await-in-loop
    await withPage(port, `${BASE_QUERY}&${arm.query}`, async (page, url) => {
      await plate(page, path.join(OUT, `${arm.key}.png`), STEPS);
      console.log(`  ${arm.key.padEnd(12)} <- ${url}`);
    });
  }
}

// --- the statistic -------------------------------------------------------------------------

/**
 * Signed fibre-axis saturation over a pixel set, in SCENE LINEAR, mass-weighted and p50 —
 * the R35 operator on plate pixels. A violet gain scores NEGATIVE (REQ-063 §6's lesson, gated in
 * `hair-tf-ceiling.selftest.mjs`). p50 luma rides along for the level match.
 */
export function measureSigned(png, pixels) {
  let massSum = 0;
  let satMass = 0;
  const sats = [];
  const lumas = [];

  for (const k of pixels) {
    const codes = codesAt(png, k * 4);
    if (isInvertible(codes) === false) continue;
    const linear = plateToSceneLinear(codes, 1);
    const mass = luminance(linear);
    const sat = saturationTowardFibre(linear, AXIS);
    massSum += mass;
    satMass += sat * mass;
    sats.push(sat);
    lumas.push(mass);
  }

  if (sats.length === 0) throw new Error('measureSigned: no invertible pixels in the mask');
  sats.sort((a, b) => a - b);
  lumas.sort((a, b) => a - b);
  return {
    n: sats.length,
    sat: satMass / Math.max(massSum, 1e-12),
    satP50: sats[Math.floor(sats.length / 2)],
    lumaP50: lumas[Math.floor(lumas.length / 2)],
  };
}

function skinPixels() {
  const out = [];
  for (const spec of Object.values(RECTS)) {
    if (spec.kind !== 'skin') continue;
    const [x0, y0, w, h] = spec.rect;
    for (let y = y0; y < y0 + h; y += 1) for (let x = x0; x < x0 + w; x += 1) out.push(y * WIDTH + x);
  }
  return out;
}

function hairPixels() {
  const { hairShaded, gate } = loadMasks(OUT);
  if (gate === null) return null;
  const hair = [];
  for (let k = 0; k < WIDTH * HEIGHT; k += 1) if (hairShaded[k] === 1) hair.push(k);
  return { hair, gate };
}

// --- the level match -----------------------------------------------------------------------

/**
 * Bisect `?hairscatter=X` on one defect arm until the hair-mask p50 linear luma matches the
 * shipped plate's within GATE_LEVEL. Monotone: the pedestal only adds, so p50 rises with X.
 *
 * ⚠️ READS LUMA ALONE. The colour statistics are computed later, from the saved matched plate, so
 * the match cannot chase them even by accident.
 */
async function matchArm(port, defectQuery, saveAs, targetP50, hair) {
  // ⚠️ `?hairscatter` is CLAMPED to [0, 8] by alive.js:2172 — a bracket outside it would pin
  // silently and the "match" would be the clamp. The bracket honours the clamp, and a match that
  // lands ON the ceiling with the gap still open REFUSES rather than reporting a matched arm.
  let low = 0.25;
  let high = 8;
  let best = null;

  for (let iteration = 0; iteration < 11; iteration += 1) {
    const x = (low + high) / 2;
    const file = path.join(OUT, `${saveAs}-probe.png`);
    // eslint-disable-next-line no-await-in-loop
    await withPage(port, `${BASE_QUERY}&${defectQuery}&hairscatter=${x}`, async (page) => {
      await plate(page, file, STEPS);
    });
    const p50 = measureSigned(readPlate(file), hair).lumaP50;
    const gap = (p50 - targetP50) / targetP50;
    console.log(`  ${saveAs}  X=${x.toFixed(4)}  p50 ${p50.toExponential(4)}  gap ${(gap * 100).toFixed(3)}%`);
    best = { x, gap, file };
    if (Math.abs(gap) <= GATE_LEVEL * 0.6) break; // land comfortably inside the window
    if (gap > 0) high = x; else low = x;
  }

  if (Math.abs(best.gap) > GATE_LEVEL && best.x > 7.9) {
    throw new Error(`${saveAs}: the scalar pinned at the ?hairscatter clamp (X=${best.x.toFixed(3)}) `
      + `with the luma gap still ${(best.gap * 100).toFixed(2)}% — the arm cannot reach the shipped `
      + 'level inside the parameter\'s range, and a pinned match is not a match');
  }
  fs.copyFileSync(best.file, path.join(OUT, `${saveAs}.png`));
  fs.rmSync(best.file);
  fs.writeFileSync(path.join(OUT, `${saveAs}.json`),
    `${JSON.stringify({ scatter: best.x, lumaGap: best.gap }, null, 2)}\n`);
  console.log(`  ${saveAs}: matched at hairscatter=${best.x.toFixed(4)}, luma gap ${(best.gap * 100).toFixed(3)}%`);
  return best;
}

// --- the report ----------------------------------------------------------------------------

function report() {
  const masks = hairPixels();
  if (masks === null) {
    console.log('\n🔴 THE MASK IS UNGATED — run --masks first. Refusing to report.\n');
    return 1;
  }
  const { hair, gate } = masks;
  const skin = skinPixels();
  console.log(`\n  GATE  ${gate.inside} invertible px in the eroded groom mask: ${gate.kept} shaded `
    + `(${((gate.kept / gate.inside) * 100).toFixed(2)}%), ${gate.band} in the separating band`);

  const rows = [...ARMS.map((a) => [a.key, a.label]),
    ['depth-matched', 'depth, LEVEL-MATCHED (judged arm)'],
    ['flat-matched', 'decoy, LEVEL-MATCHED']];
  const missing = rows.filter(([key]) => fs.existsSync(path.join(OUT, `${key}.png`)) === false);
  if (missing.length > 0) {
    console.log(`\n🔴 missing plates: ${missing.map(([key]) => key).join(', ')} — run --arms and --match.\n`);
    return 1;
  }

  const m = new Map();
  const sk = new Map();
  for (const [key] of rows) {
    const png = readPlate(path.join(OUT, `${key}.png`));
    m.set(key, measureSigned(png, hair));
    sk.set(key, measureSigned(png, skin));
  }

  const base = m.get('base');
  console.log('\n  --- signed fibre-axis saturation on the gated hair mask (linear, mass-weighted) ---\n');
  console.log('      arm                                   px      sat       Δ        p50 sat   p50 luma');
  for (const [key, label] of rows) {
    const s = m.get(key);
    console.log(`      ${label.padEnd(34)} ${String(s.n).padStart(6)} ${s.sat.toFixed(4).padStart(8)} `
      + `${((s.sat - base.sat) >= 0 ? '+' : '') + (s.sat - base.sat).toFixed(4)}`.padEnd(10)
      + `${s.satP50.toFixed(4).padStart(8)}  ${s.lumaP50.toExponential(3)}`);
  }

  const effect = m.get('depth-matched').sat - base.sat;
  const relative = effect / Math.max(Math.abs(base.sat), 1e-12);
  const drift = Math.abs(m.get('base-2').sat - base.sat);
  const decoyGain = m.get('flat-matched').sat - base.sat;
  const skinMove = Math.abs(sk.get('depth-matched').sat - sk.get('base').sat);
  const levelGap = Math.abs(m.get('depth-matched').lumaP50 - base.lumaP50) / base.lumaP50;

  console.log('\n  --- the controls, read BEFORE the gates ------------------------------------\n');
  console.log(`      DRIFT   base vs base-2: |Δsat| ${drift.toFixed(4)}`);
  console.log(`      LEVEL   depth-matched luma gap ${(levelGap * 100).toFixed(3)}%`);
  console.log(`      DECOY   flat-matched gain ${decoyGain >= 0 ? '+' : ''}${decoyGain.toFixed(4)} `
    + `against depth-matched's ${effect >= 0 ? '+' : ''}${effect.toFixed(4)}`);

  console.log('\n  --- the registered gates ---------------------------------------------------\n');
  let pass = true;
  const gateLine = (name, ok, detail) => {
    if (!ok) pass = false;
    console.log(`      ${ok ? '✅' : '🔴'} ${name.padEnd(10)} ${detail}`);
  };
  gateLine('G-LEVEL', levelGap <= GATE_LEVEL,
    `${(levelGap * 100).toFixed(3)}% against ±${GATE_LEVEL * 100}% — nothing is scored if this fails`);
  gateLine('G-DRIFT', drift <= GATE_DRIFT_SHARE * Math.abs(effect),
    `drift ${drift.toFixed(4)} against ${(GATE_DRIFT_SHARE * 100).toFixed(0)}% of the effect (${(GATE_DRIFT_SHARE * Math.abs(effect)).toFixed(4)})`);
  gateLine('G-EFFECT', relative >= GATE_EFFECT,
    `relative gain ${(relative * 100).toFixed(1)}% against the ${(GATE_EFFECT * 100).toFixed(0)}% floor`);
  gateLine('G-DECOY', Math.abs(decoyGain) <= GATE_DECOY_SHARE * Math.abs(effect),
    `|decoy| ${Math.abs(decoyGain).toFixed(4)} against ${(GATE_DECOY_SHARE * 100).toFixed(0)}% of the effect `
    + `(${(GATE_DECOY_SHARE * Math.abs(effect)).toFixed(4)})${Math.abs(decoyGain) > GATE_DECOY_SHARE * Math.abs(effect)
      ? ' — per-light differentiation is NOT the cause; R35 decomposition RE-OPENED (registration §7)' : ''}`);
  gateLine('G-SKIN', skinMove <= GATE_SKIN_SHARE * Math.abs(effect),
    `skin |Δsat| ${skinMove.toFixed(4)} against ${(GATE_SKIN_SHARE * 100).toFixed(0)}% of hair's move`);

  console.log(`\n  ${pass
    ? '✅ ALL GATES PASS — the arm proceeds to the blind panel (registration §5).'
    : '🔴 GATES FAILED — the arm does not proceed to judging. The registration owns the consequences.'}\n`);

  const record = {
    tool: 'tools/critic/hair-pedestal-depth.mjs',
    registration: 'docs/superpowers/specs/2026-08-24-r36-pedestal-lightdepth.md',
    generatedAt: new Date().toISOString(),
    constants: { GATE_LEVEL, GATE_EFFECT, GATE_DECOY_SHARE, GATE_DRIFT_SHARE, GATE_SKIN_SHARE },
    axis: AXIS,
    hair: Object.fromEntries([...m].map(([key, value]) => [key, value])),
    skin: Object.fromEntries([...sk].map(([key, value]) => [key, value])),
    verdict: { effect, relative, drift, decoyGain, skinMove, levelGap, pass },
  };
  fs.writeFileSync(path.join(OUT, 'data', 'report.json'), `${JSON.stringify(record, null, 2)}\n`);
  return pass ? 0 : 1;
}

// --- main ----------------------------------------------------------------------------------

async function startVite() {
  const { createServer } = await import('vite');
  const server = await createServer({
    configFile: path.join(REPO, 'vite.config.js'),
    server: { port: 5199, strictPort: false, hmr: false, watch: { ignored: ['**'] }, open: false },
    logLevel: 'warn',
  });
  await server.listen();
  const port = server.config.server.port ?? new URL(server.resolvedUrls.local[0]).port;
  console.log(`vite      ${server.resolvedUrls.local[0]}`);
  return { server, port: Number(new URL(server.resolvedUrls.local[0]).port) };
}

async function main() {
  const flags = new Set(process.argv.slice(2));
  fs.mkdirSync(path.join(OUT, 'data'), { recursive: true });

  if (flags.has('--report')) { process.exitCode = report(); return; }

  const { server, port } = await startVite();
  try {
    if (flags.has('--masks')) await captureMasks(port);
    if (flags.has('--arms')) await captureArms(port);
    if (flags.has('--match')) {
      const masks = hairPixels();
      if (masks === null) throw new Error('run --masks first; the match needs the gated hair mask');
      const target = measureSigned(readPlate(path.join(OUT, 'base.png')), masks.hair).lumaP50;
      console.log(`  target: shipped hair-mask p50 luma ${target.toExponential(4)}`);
      await matchArm(port, 'hair=1&hairdefect=pedestal-lightdepth', 'depth-matched', target, masks.hair);
      await matchArm(port, 'hair=1&hairdefect=pedestal-lightdepth-flat', 'flat-matched', target, masks.hair);
    }
  } finally {
    await server.close();
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main();
}
