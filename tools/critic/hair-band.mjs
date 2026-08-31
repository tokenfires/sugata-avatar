#!/usr/bin/env node
//
// hair-band.mjs — R38: does the tangent smear explain both the mud and the missing band?
//
// THE REGISTRATION IS `docs/superpowers/specs/2026-08-31-r38-tangent-smear.md`, committed before
// any arm below was rendered, with the predictions falsifiable in both directions:
//
//   P1  over the jitter sweep, warm saturation AND radiance p95/p50 are both monotone DECREASING
//       in jitter — or the tangent-smear hypothesis is refuted.
//   P2  the weight-half decoy presents as SCALE (mass-mean luma moves ≥10%) while every jitter arm
//       presents as SHAPE (mass-mean within 10%) — or "shape" is the wrong frame by its own control.
//
//   node tools/critic/hair-band.mjs --masks
//   node tools/critic/hair-band.mjs --arms
//   node tools/critic/hair-band.mjs --report

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { codesAt, isInvertible, readPlate, plateToSceneLinear, luminance, plate } from './lightpath-probe.mjs';
import { BASE_QUERY, HEIGHT, STEPS, WIDTH, loadMasks, withPage } from './hair-lightpath.mjs';
import { measureSigned } from './hair-pedestal-depth.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..', '..');
const OUT = path.join(REPO, 'captures', 'hair-r38-band');

/** Registered constants. Changing any after a capture is renegotiation. */
export const GATE_DRIFT_SAT = 0.005;
export const GATE_DRIFT_RATIO = 0.02;
export const SHAPE_MASS_WINDOW = 0.10;

/** The jitter sweep, in the shipped unit (radians SD). 0.2403 IS the shipped value. */
const JITTER_ARMS = [
  { key: 'j000', jitter: 0 },
  { key: 'j006', jitter: 0.06 },
  { key: 'j012', jitter: 0.12 },
  { key: 'full', jitter: 0.2403, query: 'hair=1' },
  { key: 'j036', jitter: 0.36 },
];

const ARMS = [
  ...JITTER_ARMS.map((arm) => ({
    key: arm.key,
    query: arm.query ?? `hair=1&hairjitter=${arm.jitter}`,
  })),
  // 🚩 THE DECOY — the wrong lever. The hypothesis says SHAPE, not weight; this must present as a
  // scale change (mass-mean moves) or the frame is wrong by its own control.
  { key: 'weight-half', query: 'hair=1&hairweightr=0.5' },
  // Drift control, identical configuration, second spelling, captured LAST.
  { key: 'full-2', query: 'hair=1&hairscatter=1' },
];

const MASK_ARMS = [
  ['C-hairoff-noshadows.png', `${BASE_QUERY}&shadows=0`],
  ['D-hairon-noshadows.png', `${BASE_QUERY}&shadows=0&hair=1`],
];
const FLOOR_FILE = path.join('lobes', 'nothing-indirect-only-.png');

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
  await withPage(port, `${BASE_QUERY}&hair=1&hairlobes=&hairscatter=0`, async (page, url) => {
    await page.evaluate(() => { window.sugata.stage.renderer.toneMappingExposure = 4; });
    await plate(page, path.join(OUT, FLOOR_FILE), STEPS);
    console.log(`  ${FLOOR_FILE}  <- ${url}`);
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

// --- operators -----------------------------------------------------------------------------

/** SAT (the R35 signed operator, via measureSigned), plus BAND (p95/p50 luma) and mass-mean luma. */
export function measureArm(png, pixels) {
  const signed = measureSigned(png, pixels);
  const lumas = [];
  let massSum = 0;
  for (const k of pixels) {
    const codes = codesAt(png, k * 4);
    if (isInvertible(codes) === false) continue;
    const linear = plateToSceneLinear(codes, 1);
    const mass = luminance(linear);
    lumas.push(mass);
    massSum += mass;
  }
  lumas.sort((a, b) => a - b);
  const q = (p) => lumas[Math.min(lumas.length - 1, Math.floor(lumas.length * p))];
  return {
    sat: signed.sat,
    band: q(0.95) / Math.max(q(0.5), 1e-12),
    massMean: massSum / Math.max(lumas.length, 1),
    n: lumas.length,
  };
}

/** Strict monotone-decreasing check over (x, y) pairs, with ties allowed inside `floorTie`. */
export function monotoneDecreasing(pairs, floorTie) {
  const ordered = [...pairs].sort((a, b) => a.x - b.x);
  for (let i = 1; i < ordered.length; i += 1) {
    if (ordered[i].y > ordered[i - 1].y + floorTie) return false;
  }
  return true;
}

function hairPixels() {
  const { hairShaded, gate } = loadMasks(OUT);
  if (gate === null) return null;
  const hair = [];
  for (let k = 0; k < WIDTH * HEIGHT; k += 1) if (hairShaded[k] === 1) hair.push(k);
  return { hair, gate };
}

// --- report --------------------------------------------------------------------------------

function report() {
  const masks = hairPixels();
  if (masks === null) {
    console.log('\n🔴 THE MASK IS UNGATED — run --masks first.\n');
    return 1;
  }
  const { hair, gate } = masks;
  console.log(`\n  GATE  ${gate.inside} px in the eroded groom mask: ${gate.kept} shaded `
    + `(${((gate.kept / gate.inside) * 100).toFixed(2)}%)`);

  const missing = ARMS.filter((arm) => fs.existsSync(path.join(OUT, `${arm.key}.png`)) === false);
  if (missing.length > 0) {
    console.log(`\n🔴 missing plates: ${missing.map((arm) => arm.key).join(', ')} — run --arms.\n`);
    return 1;
  }

  const m = new Map(ARMS.map((arm) => [arm.key, measureArm(readPlate(path.join(OUT, `${arm.key}.png`)), hair)]));
  const full = m.get('full');

  console.log('\n  --- the sweep (hair mask, scene linear) ------------------------------------\n');
  console.log('      arm          jitter     SAT      BAND p95/p50   mass-mean    Δmass%');
  for (const arm of ARMS) {
    const s = m.get(arm.key);
    const jitter = JITTER_ARMS.find((j) => j.key === arm.key)?.jitter;
    const dm = (s.massMean - full.massMean) / full.massMean;
    console.log(`      ${arm.key.padEnd(12)} ${(jitter === undefined ? '—' : jitter.toFixed(4)).padStart(6)} `
      + `${s.sat.toFixed(4).padStart(8)} ${s.band.toFixed(3).padStart(12)} `
      + `${s.massMean.toExponential(3).padStart(12)} ${((dm >= 0 ? '+' : '') + (dm * 100).toFixed(1)).padStart(8)}%`);
  }

  // --- gates and predictions ----------------------------------------------------------------
  const drift = m.get('full-2');
  const driftSat = Math.abs(drift.sat - full.sat);
  const driftRatio = Math.abs(drift.band - full.band) / full.band;

  console.log('\n  --- gates and registered predictions ---------------------------------------\n');
  let pass = true;
  const line = (name, ok, detail) => {
    if (!ok) pass = false;
    console.log(`      ${ok ? '✅' : '🔴'} ${name.padEnd(9)} ${detail}`);
  };

  line('G-DRIFT', driftSat <= GATE_DRIFT_SAT && driftRatio <= GATE_DRIFT_RATIO,
    `|Δsat| ${driftSat.toFixed(4)} (≤${GATE_DRIFT_SAT}), |Δband| ${(driftRatio * 100).toFixed(2)}% (≤${GATE_DRIFT_RATIO * 100}%)`);

  const sweep = JITTER_ARMS.map((j) => ({ x: j.jitter, satY: m.get(j.key).sat, bandY: m.get(j.key).band }));
  const satMono = monotoneDecreasing(sweep.map((s) => ({ x: s.x, y: s.satY })), GATE_DRIFT_SAT);
  const bandMono = monotoneDecreasing(sweep.map((s) => ({ x: s.x, y: s.bandY })), full.band * GATE_DRIFT_RATIO);
  line('P1-SAT', satMono, `SAT monotone decreasing in jitter: ${sweep.map((s) => s.satY.toFixed(3)).join(' → ')}`);
  line('P1-BAND', bandMono, `BAND monotone decreasing in jitter: ${sweep.map((s) => s.bandY.toFixed(3)).join(' → ')}`);

  const decoyMass = Math.abs(m.get('weight-half').massMean - full.massMean) / full.massMean;
  const jitterMassMax = Math.max(...JITTER_ARMS.map((j) => Math.abs(m.get(j.key).massMean - full.massMean) / full.massMean));
  line('P2-DECOY', decoyMass >= SHAPE_MASS_WINDOW && jitterMassMax < SHAPE_MASS_WINDOW,
    `weight-half mass-mean moves ${(decoyMass * 100).toFixed(1)}% (must be ≥${SHAPE_MASS_WINDOW * 100}%); `
    + `jitter arms max ${(jitterMassMax * 100).toFixed(1)}% (must be <${SHAPE_MASS_WINDOW * 100}%)`);

  console.log(`\n  ${pass
    ? '✅ H STANDS: the tangent smear moves the mud and the band TOGETHER, and the decoy separates.'
    : '🔴 A registered clause failed — H is refuted or the instrument is unfit. The registration owns it.'}\n`);

  fs.mkdirSync(path.join(OUT, 'data'), { recursive: true });
  fs.writeFileSync(path.join(OUT, 'data', 'report.json'), `${JSON.stringify({
    tool: 'tools/critic/hair-band.mjs',
    registration: 'docs/superpowers/specs/2026-08-31-r38-tangent-smear.md',
    generatedAt: new Date().toISOString(),
    constants: { GATE_DRIFT_SAT, GATE_DRIFT_RATIO, SHAPE_MASS_WINDOW },
    arms: Object.fromEntries([...m].map(([k, v]) => [k, v])),
    verdict: { pass, satMono, bandMono, driftSat, driftRatio, decoyMass, jitterMassMax },
  }, null, 2)}\n`);
  console.log(`  report    ${path.relative(REPO, path.join(OUT, 'data', 'report.json'))}\n`);
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
  console.log(`vite      ${server.resolvedUrls.local[0]}`);
  return { server, port: Number(new URL(server.resolvedUrls.local[0]).port) };
}

async function main() {
  const flags = new Set(process.argv.slice(2));
  if (flags.has('--report')) { process.exitCode = report(); return; }
  const { server, port } = await startVite();
  try {
    if (flags.has('--masks')) await captureMasks(port);
    if (flags.has('--arms')) await captureArms(port);
  } finally {
    await server.close();
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main();
}
