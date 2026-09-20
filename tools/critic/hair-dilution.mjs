#!/usr/bin/env node
//
// hair-dilution.mjs — R37: the saturation budget of a hair pixel, term by term.
//
// THE REGISTRATION IS `docs/superpowers/specs/2026-08-31-r37-dilution-audit.md`, committed before
// any arm below was rendered. This round RANKS — it makes no ship decision — so its gates are
// instrument gates: drift, additivity, mask, positivity. A failed additivity gate is the finding
// (the decomposition model is wrong), not something to patch silently.
//
// WHAT IT ANSWERS. R36 closed every chroma-pump route to "muddy" and left one suspect: achromatic
// DILUTION — R (achromatic by construction) and the grey indirect composite pouring unsaturated
// light over a warm base. This measures it: each term isolated over the indirect floor for its own
// chroma, and removed from the full pixel for its marginal effect on aggregate warm saturation.
// **Negative marginal = the term dilutes.**
//
//   node tools/critic/hair-dilution.mjs --masks
//   node tools/critic/hair-dilution.mjs --arms
//   node tools/critic/hair-dilution.mjs --report

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { codesAt, isInvertible, readPlate, plateToSceneLinear, luminance, plate } from './lightpath-probe.mjs';
import { BASE_QUERY, HEIGHT, LOBE_EXPOSURE, STEPS, WIDTH, loadMasks, withPage } from './hair-lightpath.mjs';
import { fibreAxis, saturationTowardFibre } from './hair-tf-ceiling.mjs';
import { measureSigned } from './hair-pedestal-depth.mjs';
import { baseColourDerivation } from '../../packages/core/src/material/HairMaterial.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..', '..');
const OUT = path.join(REPO, 'captures', 'hair-r37-dilution');

/** Registered instrument gates. Changing any of these after a capture is renegotiation. */
export const GATE_DRIFT = 0.005;
export const GATE_ADDITIVITY = 0.05;

const ARMS = [
  { key: 'full', query: 'hair=1' },
  { key: 'floor', query: 'hair=1&hairlobes=&hairscatter=0' },
  { key: 'only-r', query: 'hair=1&hairlobes=r&hairscatter=0' },
  { key: 'only-trt', query: 'hair=1&hairlobes=trt&hairscatter=0' },
  { key: 'only-scatter', query: 'hair=1&hairlobes=&hairscatter=1' },
  { key: 'no-r', query: 'hair=1&hairlobes=trt' },
  { key: 'no-trt', query: 'hair=1&hairlobes=r' },
  { key: 'no-scatter', query: 'hair=1&hairscatter=0' },
  // ⚠️ `gtao=0` removes AO AND the ambient split-sum together — the leave-one-out is of that
  // bundle, and every table below labels it so.
  { key: 'no-indirect', query: 'hair=1&gtao=0' },
  // Drift control: identical configuration, second spelling, captured LAST.
  { key: 'full-2', query: 'hair=1&hairscatter=1' },
];

const FLOOR_FILE = path.join('lobes', 'nothing-indirect-only-.png');
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
  // The mask's lobes-off floor plate, at the critic's fixed exposure — same recipe as R33/R36.
  await withPage(port, `${BASE_QUERY}&hair=1&hairlobes=&hairscatter=0`, async (page, url) => {
    await page.evaluate((v) => { window.sugata.stage.renderer.toneMappingExposure = v; }, LOBE_EXPOSURE);
    await plate(page, path.join(OUT, FLOOR_FILE), STEPS);
    console.log(`  ${FLOOR_FILE}  <- ${url}  (exposure ${LOBE_EXPOSURE})`);
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

// --- the statistics ------------------------------------------------------------------------

/**
 * Per-pixel linear triples for a plate over a pixel set, keyed by pixel index — the working form
 * for plate ALGEBRA, where a term is the difference of two plates and additivity is a gate.
 */
export function linearField(png, pixels) {
  const field = new Map();
  for (const k of pixels) {
    const codes = codesAt(png, k * 4);
    if (isInvertible(codes) === false) continue;
    field.set(k, plateToSceneLinear(codes, 1));
  }
  return field;
}

/**
 * Signed fibre-axis saturation of a DIFFERENCE field (`a − b`, clamped at 0 per channel):
 * the chroma a term carries on its own, mass-weighted by the term's own luma.
 */
export function measureTerm(fieldA, fieldB) {
  let massSum = 0;
  let satMass = 0;
  let negativeMass = 0;
  let n = 0;
  for (const [k, a] of fieldA) {
    const b = fieldB.get(k);
    if (b === undefined) continue;
    const raw = [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
    const term = raw.map((v) => Math.max(0, v));
    // G-POSITIVITY's input: how much mass the clamp discarded. A term that goes NEGATIVE against
    // its own floor is a decomposition error, and it is measured rather than hidden by the clamp.
    negativeMass += luminance([Math.max(0, -raw[0]), Math.max(0, -raw[1]), Math.max(0, -raw[2])]);
    const mass = luminance(term);
    if (mass <= 0) { n += 1; continue; }
    massSum += mass;
    satMass += saturationTowardFibre(term, AXIS) * mass;
    n += 1;
  }
  return {
    n,
    sat: massSum > 0 ? satMass / massSum : 0,
    mass: massSum,
    negativeMass,
  };
}

/** Mass-weighted relative additivity error: |full − (floor + Σ terms)| / full, on luma. */
export function additivityError(fullField, floorField, termFields) {
  let errorMass = 0;
  let fullMass = 0;
  for (const [k, full] of fullField) {
    const floor = floorField.get(k);
    if (floor === undefined) continue;
    let ok = true;
    const sum = [...floor];
    for (const term of termFields) {
      const a = term.only.get(k);
      const b = term.floor.get(k);
      if (a === undefined || b === undefined) { ok = false; break; }
      for (let c = 0; c < 3; c += 1) sum[c] += Math.max(0, a[c] - b[c]);
    }
    if (!ok) continue;
    errorMass += Math.abs(luminance(full) - luminance(sum));
    fullMass += luminance(full);
  }
  return errorMass / Math.max(fullMass, 1e-12);
}

function hairPixels() {
  const { hairShaded, gate } = loadMasks(OUT);
  if (gate === null) return null;
  const hair = [];
  for (let k = 0; k < WIDTH * HEIGHT; k += 1) if (hairShaded[k] === 1) hair.push(k);
  return { hair, gate };
}

// --- the report ----------------------------------------------------------------------------

function report() {
  const masks = hairPixels();
  if (masks === null) {
    console.log('\n🔴 THE MASK IS UNGATED — run --masks first. Refusing to report.\n');
    return 1;
  }
  const { hair, gate } = masks;
  console.log(`\n  GATE  ${gate.inside} invertible px in the eroded groom mask: ${gate.kept} shaded `
    + `(${((gate.kept / gate.inside) * 100).toFixed(2)}%), ${gate.band} in the separating band`);

  const missing = ARMS.filter((arm) => fs.existsSync(path.join(OUT, `${arm.key}.png`)) === false);
  if (missing.length > 0) {
    console.log(`\n🔴 missing plates: ${missing.map((arm) => arm.key).join(', ')} — run --arms.\n`);
    return 1;
  }

  const png = new Map(ARMS.map((arm) => [arm.key, readPlate(path.join(OUT, `${arm.key}.png`))]));
  const agg = new Map(ARMS.map((arm) => [arm.key, measureSigned(png.get(arm.key), hair)]));
  const field = new Map(ARMS.map((arm) => [arm.key, linearField(png.get(arm.key), hair)]));

  const full = agg.get('full');
  console.log('\n  --- aggregate signed fibre-axis saturation per arm (hair mask, linear) ------\n');
  console.log('      arm            px      sat        p50 sat   p50 luma');
  for (const arm of ARMS) {
    const s = agg.get(arm.key);
    console.log(`      ${arm.key.padEnd(12)} ${String(s.n).padStart(6)} ${s.sat.toFixed(4).padStart(8)} `
      + `${s.satP50.toFixed(4).padStart(9)}  ${s.lumaP50.toExponential(3)}`);
  }

  // --- the controls ------------------------------------------------------------------------
  const drift = Math.abs(agg.get('full-2').sat - full.sat);
  const termDefs = [
    { key: 'r', only: field.get('only-r'), floor: field.get('floor') },
    { key: 'trt', only: field.get('only-trt'), floor: field.get('floor') },
    { key: 'scatter', only: field.get('only-scatter'), floor: field.get('floor') },
  ];
  const additivity = additivityError(field.get('full'), field.get('floor'), termDefs);

  console.log('\n  --- instrument gates -------------------------------------------------------\n');
  let pass = true;
  const gateLine = (name, ok, detail) => {
    if (!ok) pass = false;
    console.log(`      ${ok ? '✅' : '🔴'} ${name.padEnd(14)} ${detail}`);
  };
  gateLine('G-DRIFT', drift <= GATE_DRIFT, `|Δsat| ${drift.toFixed(4)} against ${GATE_DRIFT}`);
  gateLine('G-ADDITIVITY', additivity <= GATE_ADDITIVITY,
    `mass-weighted |full − (floor + Σ terms)| = ${(additivity * 100).toFixed(2)}% against ${GATE_ADDITIVITY * 100}%`);

  if (!pass) {
    console.log('\n  🔴 INSTRUMENT GATES FAILED — the ledger is not read (registration §4).\n');
    return 1;
  }

  // --- the ledger --------------------------------------------------------------------------
  console.log('\n  --- THE DILUTION LEDGER ----------------------------------------------------\n');
  console.log('      term          own sat   mass share   marginal Δsat   verdict');
  const fullMass = [...field.get('full').values()].reduce((s, v) => s + luminance(v), 0);
  const rows = [];
  for (const def of termDefs) {
    const iso = measureTerm(def.only, def.floor);
    const marginal = full.sat - agg.get(`no-${def.key}`).sat;
    rows.push({ key: def.key, iso, marginal, share: iso.mass / fullMass });
  }
  // The indirect bundle: its isolation IS the floor plate itself; its marginal is no-indirect.
  const floorIso = measureTerm(field.get('floor'), new Map([...field.get('floor')].map(([k]) => [k, [0, 0, 0]])));
  rows.push({
    key: 'indirect(+AO)',
    iso: floorIso,
    marginal: full.sat - agg.get('no-indirect').sat,
    share: floorIso.mass / fullMass,
  });

  rows.sort((a, b) => a.marginal - b.marginal);
  for (const row of rows) {
    console.log(`      ${row.key.padEnd(13)} ${row.iso.sat.toFixed(4).padStart(7)} `
      + `${(row.share * 100).toFixed(1).padStart(9)}% `
      + `${(row.marginal >= 0 ? '+' : '') + row.marginal.toFixed(4)}`.padStart(14)
      + `   ${row.marginal < -GATE_DRIFT ? '🔴 DILUTES — removing it raises warm saturation'
        : row.marginal > GATE_DRIFT ? '🎨 buys warmth' : '⚪ neutral at the drift floor'}`);
  }

  console.log('\n      (marginal Δsat = sat(full) − sat(without the term); the indirect row is the');
  console.log('       gtao=0 BUNDLE — AO and ambient split-sum together, as registered.)');
  console.log('\n      Reference clause: STANDS DOWN — the copyright plate is not on this machine.');
  console.log('      Context: the recorded gap is a 38% collapse vs reference (OPEN-REQUESTS:3054).\n');

  fs.mkdirSync(path.join(OUT, 'data'), { recursive: true });
  fs.writeFileSync(path.join(OUT, 'data', 'report.json'), `${JSON.stringify({
    tool: 'tools/critic/hair-dilution.mjs',
    registration: 'docs/superpowers/specs/2026-08-31-r37-dilution-audit.md',
    generatedAt: new Date().toISOString(),
    constants: { GATE_DRIFT, GATE_ADDITIVITY },
    aggregates: Object.fromEntries([...agg].map(([k, v]) => [k, v])),
    ledger: rows,
    controls: { drift, additivity },
  }, null, 2)}\n`);
  console.log(`  report    ${path.relative(REPO, path.join(OUT, 'data', 'report.json'))}\n`);
  return 0;
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
