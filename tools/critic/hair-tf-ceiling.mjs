#!/usr/bin/env node
//
// hair-tf-ceiling.mjs — R35: what would the chromatic pedestal buy if its signal were PERFECT?
//
// Registered at `docs/superpowers/specs/2026-08-24-r35-chromatic-pedestal-ceiling.md` before the
// first number. The question, in one line: the pedestal carries 65.4% of the groom's energy; its
// chromatic form (`zinke-transmittance`, `√C^(1+n)` per channel) already exists and was refused in
// R27 for its INPUT — the baked sheet is `random.random()` per strand. A correct input is expensive
// (`render/**` shadow-path plumbing or a re-baked sheet). This probe feeds the form the TRUE
// per-(pixel, light) fibre count from R28's CPU ray cast and measures the ceiling, so the decision
// to build the signal is made on arithmetic instead of hope.
//
//   node tools/critic/hair-tf-ceiling.mjs
//
// 🎯 THE EXPENSIVE HALF WAS ALREADY RUN. `captures/hair-r28-envelope/ground-truth-cache.json`
// carries 7,913 sampled hair pixels × 5 lights of brute-force ray-cast card crossings, hit points,
// and the baked sheet's own value at each sample. "Has this experiment already been run?" is the
// question this project learned to ask first; here the answer was yes.
//
// ⚠️ STALENESS IS CHECKED, NOT ASSUMED. The cache was captured at R28's HEAD. The groom is the
// sha-pinned `bob01` control, but the RIG is not pinned — so this probe opens the live page once,
// reads every light's position/intensity/colour and the camera, and REFUSES to run if the cached
// light positions disagree. `pin-the-revision-a-reader-takes` is the memory this line comes from.

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';

import {
  HAIR_DEFAULTS, scatterValue, baseColourDerivation,
} from '../../packages/core/src/material/HairMaterial.js';

const REPOSITORY_ROOT = fileURLToPath(new URL('../..', import.meta.url));
const CACHE_FILE = path.join(REPOSITORY_ROOT, 'captures', 'hair-r28-envelope', 'ground-truth-cache.json');

// The registered gates. Moving these after a run voids the round (§6 of the registration).
export const CEILING_FLOOR = 0.095;   // one quarter of the named 38% collapse
export const DECOY_MAX_SHARE = 0.20;  // shuffled n must yield <= this share of the ordered signal
export const POSITION_TOLERANCE = 1e-3; // metres; cached lights must sit where the live rig puts them

// ================================================================================================
// PURE ARITHMETIC — everything below is exercised by the selftest on derivable answers.
// ================================================================================================

export const luma = (rgb) => 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2];

/**
 * The fibre's own hue axis: the unit direction of the albedo's departure from its grey.
 *
 * 🔴 THE STATISTIC IS SIGNED, AND REQ-063 §6 IS THE REASON. `chromaInCodes` is unsigned and scored
 * a violet flood as that round's best arm. Projecting onto the FIBRE's axis makes "more saturated,
 * but toward blue" a NEGATIVE number, which is what the complaint "muddy" requires — the muddiness
 * is a loss of the fibre's warm, not a loss of colourfulness in general.
 */
export function fibreAxis(colour) {
  const grey = luma(colour);
  const departure = colour.map((channel) => channel / Math.max(grey, 1e-9) - 1);
  const norm = Math.hypot(...departure);
  return departure.map((component) => component / Math.max(norm, 1e-9));
}

/** Chroma of `rgb` projected onto the fibre's axis. Positive = toward the fibre's own warm. */
export function saturationTowardFibre(rgb, axis) {
  const grey = luma(rgb);
  if (grey <= 1e-9) return 0;
  const departure = rgb.map((channel) => channel / grey - 1);
  return departure[0] * axis[0] + departure[1] * axis[1] + departure[2] * axis[2];
}

/**
 * The pedestal term at one sample, summed over lights, per channel — SHIPPED form.
 *
 * Slide 39: `Σ_i L_i · wrap_i · vis_i · √C · (C/luma C)^(1−Shadow)`. The chroma factor is
 * per-FRAGMENT (the baked sheet knows nothing of lights), so it comes out of the sum — which is
 * exactly R27's isoluminant diagnosis. `weights[i]` carries `L_i · wrap_i · vis_i` per channel.
 */
export function pedestalShipped(weights, colour, shadowSheet) {
  const base = scatterValue(0, colour, shadowSheet, { scatter: 1 });
  // scatterValue bakes in one light's wrap at dotFakeNormalLight = 0 → wrap = 1/4π. Divide it out
  // and apply each light's own weight, so the CPU mirror stays the single source of the formula.
  const wrapUnit = 1 / (4 * Math.PI);
  const summed = [0, 0, 0];
  for (const weight of weights) {
    for (let channel = 0; channel < 3; channel += 1) {
      summed[channel] += weight[channel] * (base[channel] / wrapUnit);
    }
  }
  return summed;
}

/**
 * The pedestal term at one sample — CEILING form: the `zinke-transmittance` branch fed the TRUE
 * per-light fibre count. `√C^(1+n_i)` sits INSIDE the sum, which is the whole point: depth toward
 * the key and depth toward the kicker are different numbers, so the chroma varies per light.
 */
export function pedestalCeiling(weights, colour, eventsPerLight) {
  const wrapUnit = 1 / (4 * Math.PI);
  const summed = [0, 0, 0];
  for (let i = 0; i < weights.length; i += 1) {
    const branch = scatterValue(0, colour, Math.exp(-eventsPerLight[i]),
      { scatter: 1, defect: 'zinke-transmittance' });
    for (let channel = 0; channel < 3; channel += 1) {
      summed[channel] += weights[i][channel] * (branch[channel] / wrapUnit);
    }
  }
  return summed;
}

/**
 * The whole probe over a sample set, both branches, one statistic.
 *
 * `massWeight` is the shipped pedestal's own luma, so a pixel's vote is its visible mass — the
 * registration's "mass-weighted over the hair-body mask".
 */
export function scoreSamples(samples, colour) {
  const axis = fibreAxis(colour);
  let massShipped = 0;
  let massCeiling = 0;
  let satShippedWeighted = 0;
  let satCeilingWeighted = 0;
  const perSample = [];

  for (const sample of samples) {
    const shipped = pedestalShipped(sample.weights, colour, sample.shadowSheet);
    const ceiling = pedestalCeiling(sample.weights, colour, sample.events);
    const massS = luma(shipped);
    const massC = luma(ceiling);
    const satS = saturationTowardFibre(shipped, axis);
    const satC = saturationTowardFibre(ceiling, axis);
    massShipped += massS;
    massCeiling += massC;
    satShippedWeighted += satS * massS;
    satCeilingWeighted += satC * massS; // ⚠️ SAME weight for both, so the statistic is a chroma
    perSample.push({ satS, satC, massS, massC }); //  comparison and not a mass re-ranking.
  }

  const satShipped = satShippedWeighted / Math.max(massShipped, 1e-12);
  const satCeiling = satCeilingWeighted / Math.max(massShipped, 1e-12);
  const deltas = perSample.map((row) => row.satC - row.satS).sort((a, b) => a - b);

  return {
    n: samples.length,
    satShipped,
    satCeiling,
    // The registered primary: relative gain of fibre-axis saturation, mass-weighted.
    relativeGain: (satCeiling - satShipped) / Math.max(Math.abs(satShipped), 1e-12),
    p50Delta: deltas[Math.floor(deltas.length / 2)] ?? 0,
    lumaRatio: massCeiling / Math.max(massShipped, 1e-12),
  };
}

/** One shared permutation across every light — the shipped sheet's own failure mode, synthesised. */
export function shuffledCopy(samples, seed = 20260824) {
  let state = seed >>> 0;
  const random = () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x1_0000_0000;
  };
  const order = samples.map((_, index) => index);
  for (let i = order.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  return samples.map((sample, index) => ({ ...sample, events: samples[order[index]].events }));
}

// ================================================================================================
// THE RUN
// ================================================================================================

async function main() {
  if (fs.existsSync(CACHE_FILE) === false) {
    throw new Error(`no ground-truth cache at ${CACHE_FILE}\n`
      + '  regenerate: node tools/critic/hair-envelope.mjs --models --out captures/hair-r28-envelope');
  }
  const cache = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'));
  console.log(`cache     ${cache.truth.key.length} samples × ${cache.lights.length} lights, `
    + `${cache.indices.length / 3} triangles (R28 ray cast, groom = sha-pinned bob01)`);

  // --- staleness: the live rig must put every light where the cache says it was -------------------
  const live = await readLiveRig();
  for (const cached of cache.lights) {
    const now = live.lights.find((light) => light.name === cached.name);
    if (now === undefined) throw new Error(`stale cache: light "${cached.name}" no longer exists`);
    const gap = Math.hypot(...cached.position.map((v, i) => v - now.position[i]));
    if (gap > POSITION_TOLERANCE) {
      throw new Error(`stale cache: "${cached.name}" moved ${(gap * 1000).toFixed(2)} mm since R28 — `
        + 'the cached crossings are rays toward a light that is not there any more. Regenerate.');
    }
    cached.live = now;
  }
  console.log(`rig       every cached light within ${POSITION_TOLERANCE * 1000} mm of the live rig ✅`
    + `   camera [${live.camera.map((v) => v.toFixed(3)).join(', ')}]`);

  // --- assemble the samples ----------------------------------------------------------------------
  // key + key-shadow are two halves of one key (identical positions, identical truth); merged, so
  // the co-located pair does not vote twice. ⚠️ The SpotLight half's shadow map is NOT modelled —
  // that attenuation multiplies BOTH branches identically per light, so the per-light chroma ratio
  // is untouched; only the cross-light weighting is approximate, and it is stated here.
  const lights = [];
  for (const cached of cache.lights) {
    if (cached.name === 'key-shadow') {
      lights.find((light) => light.name === 'key').intensity += cached.live.intensity;
      continue;
    }
    lights.push({
      name: cached.name,
      position: cached.position,
      intensity: cached.live.intensity,
      colour: cached.live.colour,
      truth: cache.truth[cached.name],
    });
  }

  // 🔴 THE FIBRE COMES FROM THE MATERIAL'S OWN DERIVATION, NOT FROM A PAGE READ — the node
  // material exposes no `.color`, and the first run read back WHITE, degenerated the axis to zero,
  // and printed a page of zeros that LOOKED like a measured null. The guard below is the second
  // half of the fix: a probe whose axis is degenerate must refuse, not report.
  const colour = baseColourDerivation().linear;
  const axisNorm = Math.hypot(...fibreAxis(colour));
  if (!(axisNorm > 0.999)) {
    throw new Error(`the fibre axis is degenerate (norm ${axisNorm.toFixed(4)}) — a grey fibre has `
      + 'no hue axis and every statistic below would be a page of well-formatted zeros');
  }
  console.log(`fibre     linear [${colour.map((v) => v.toFixed(4)).join(', ')}]  `
    + `axis [${fibreAxis(colour).map((v) => v.toFixed(3)).join(', ')}]  (baseColourDerivation)`);

  const head = cache.headBonePosition;
  const samples = [];
  for (let s = 0; s < cache.truth.key.length; s += 1) {
    const hit = [cache.hitPoints[s * 3], cache.hitPoints[s * 3 + 1], cache.hitPoints[s * 3 + 2]];
    const toCamera = normalise(sub(live.camera, hit));
    // Karis' synthesised card normal, approximated as the shell radial — stated in the registration
    // and sensitivity-checked below by re-running with wrap ≡ 1.
    const fakeNormal = normalise(sub(hit, head));
    const weights = [];
    const events = [];
    for (const light of lights) {
      const toLight = normalise(sub(light.position, hit));
      const wrap = (dot(fakeNormal, toLight) + 1) / (4 * Math.PI);
      const visibility = Math.max(0, Math.min(1, dot(toLight, toCamera) + 1));
      weights.push(light.colour.map((channel) => channel * light.intensity * wrap * visibility));
      events.push(light.truth[s]);
    }
    samples.push({ weights, events, shadowSheet: Math.exp(-HAIR_DEFAULTS.shadowDensity * cache.sheet[s]) });
  }

  // --- G-BOUNDARY --------------------------------------------------------------------------------
  const flat = { weights: [[1, 1, 1]], events: [0], shadowSheet: 1 };
  const boundaryShipped = pedestalShipped(flat.weights, colour, 1);
  const boundaryCeiling = pedestalCeiling(flat.weights, colour, [0]);
  const boundaryGap = Math.max(...boundaryShipped.map((v, i) => Math.abs(v - boundaryCeiling[i])));
  console.log(`\nG-BOUNDARY  n≡0, Shadow≡1: max channel gap ${boundaryGap.toExponential(2)}  `
    + `${boundaryGap < 1e-12 ? '✅' : '🔴 FAIL — the two forms disagree where they must be equal'}`);

  // --- the measurement ---------------------------------------------------------------------------
  const ordered = scoreSamples(samples, colour);
  const decoy = scoreSamples(shuffledCopy(samples), colour);
  // 🎯 THE ARM THE DECOY RESULT DEMANDS: the EXISTING baked sheet's own value, through the
  // chromatic form, same n for every light (that is all a per-fragment sheet can do). If the decoy
  // says the marginal is what matters, this arm says whether the marginal ALREADY ON DISK is close
  // enough — i.e. whether the chroma gain is available today, with no plumbing at all.
  const sheetArm = scoreSamples(samples.map((sample) => ({
    ...sample,
    events: sample.events.map(() => -Math.log(Math.max(sample.shadowSheet, 1e-6))),
  })), colour);
  const decoyShare = Math.abs(decoy.relativeGain) / Math.max(Math.abs(ordered.relativeGain), 1e-12);

  // Sensitivity: the fake-normal approximation only enters through wrap. Re-run with wrap ≡ 1.
  const flatWrap = samples.map((sample, s) => ({
    ...sample,
    weights: lights.map((light, i) => {
      const toLight = normalise(sub(light.position, [cache.hitPoints[s * 3], cache.hitPoints[s * 3 + 1], cache.hitPoints[s * 3 + 2]]));
      const toCamera = normalise(sub(live.camera, [cache.hitPoints[s * 3], cache.hitPoints[s * 3 + 1], cache.hitPoints[s * 3 + 2]]));
      const visibility = Math.max(0, Math.min(1, dot(toLight, toCamera) + 1));
      return light.colour.map((channel) => channel * light.intensity * visibility);
    }),
  }));
  const noWrap = scoreSamples(flatWrap, colour);

  console.log('\n================================================================================');
  console.log('THE CEILING — the chromatic pedestal fed the TRUE per-light fibre count.\n');
  console.log(`  fibre-axis saturation, mass-weighted:  shipped ${ordered.satShipped.toFixed(4)}  `
    + `ceiling ${ordered.satCeiling.toFixed(4)}`);
  console.log(`  registered primary — relative gain:    ${(ordered.relativeGain * 100).toFixed(2)}%  `
    + `(floor for opening the plumbing round: ${(CEILING_FLOOR * 100).toFixed(1)}%)`);
  console.log(`  per-sample p50 Δ:                      ${ordered.p50Delta >= 0 ? '+' : ''}${ordered.p50Delta.toFixed(4)}`);
  console.log(`  luma ratio (the level cost):           ${ordered.lumaRatio.toFixed(4)}× the shipped pedestal`);
  console.log(`  wrap-sensitivity (wrap ≡ 1):           gain ${(noWrap.relativeGain * 100).toFixed(2)}% — `
    + `${Math.sign(noWrap.relativeGain) === Math.sign(ordered.relativeGain) ? 'same sign, the normal approximation is not deciding' : '🔴 SIGN FLIPS on the wrap model; NOT RESOLVED'}`);
  // ⚠️ THE SHUFFLE MOVES EACH SAMPLE'S PER-LIGHT VECTOR WHOLE, so it destroys PIXEL placement and
  // preserves LIGHT structure. The registration's parenthetical called this "the shipped sheet's
  // own failure mode" and that was imprecise — the sheet has no light structure at all, and its own
  // arm below is the true test of that null. The two together are what decompose the property.
  console.log(`\nG-DECOY   shuffled n: gain ${(decoy.relativeGain * 100).toFixed(2)}% = `
    + `${(decoyShare * 100).toFixed(1)}% of ordered (ceiling ${DECOY_MAX_SHARE * 100}%)  `
    + `${decoyShare <= DECOY_MAX_SHARE ? '✅ pixel placement is doing the work'
      : '🔴 registered FAIL — pixel placement contributes ~nothing; read it with the sheet arm below'}`);

  // 🎯 THE FIVE-CONSTANTS ARM, demanded by the decoy + sheet results together: pixel placement is
  // worth nothing (shuffle: 103% of the gain survives) and light-blindness is worth nothing (the
  // sheet: 1.5%), so the whole property may be PER-LIGHT AGGREGATE depth — five numbers. Each
  // light's per-sample n is replaced by that light's own MEDIAN true n. If this lands near the
  // ceiling, the shippable change is five uniforms through the existing zinke branch, no signal
  // plumbing at all.
  const medians = lights.map((light) => {
    const sorted = [...light.truth].sort((a, b) => a - b);
    return sorted[Math.floor(sorted.length / 2)];
  });
  const fiveConstants = scoreSamples(samples.map((sample) => ({
    ...sample, events: medians,
  })), colour);
  console.log(`\nFIVE-CONSTANTS ARM  per-light MEDIAN n only [${medians.join(', ')}]: gain `
    + `${(fiveConstants.relativeGain * 100).toFixed(2)}%  luma ${fiveConstants.lumaRatio.toFixed(4)}× — `
    + `${(Math.abs(fiveConstants.relativeGain) / Math.max(Math.abs(ordered.relativeGain), 1e-9) * 100).toFixed(0)}% `
    + 'of the full-signal ceiling, from five numbers');

  console.log(`\nSHEET ARM  the existing random sheet through the chromatic form: gain `
    + `${(sheetArm.relativeGain * 100).toFixed(2)}%  luma ${sheetArm.lumaRatio.toFixed(4)}× — `
    + 'what is available TODAY, with no plumbing, if a plate round confirms it');

  const opens = ordered.relativeGain >= CEILING_FLOOR && decoyShare <= DECOY_MAX_SHARE && boundaryGap < 1e-12;
  console.log('');
  if (decoyShare > DECOY_MAX_SHARE) {
    console.log(`G-CEILING 🎯 THE DECOY IS THE FINDING (registration §6): gain ${(ordered.relativeGain * 100).toFixed(1)}% `
      + `and a pixel-SHUFFLED signal delivers ${(decoyShare * 100).toFixed(0)}% of it, while the `
      + 'light-blind sheet delivers ~1% — so the property is PER-LIGHT AGGREGATE depth, pixel '
      + 'placement is worth nothing, and the per-light-CONSTANTS arm above carries most of the '
      + 'ceiling. The expensive per-pixel plumbing is NOT licensed because it is NOT NEEDED; the '
      + 'successor is a plate round on the constants arm. (The sheet arm CONFIRMS R27: a light-blind '
      + 'random input buys nothing. What R27 could not see is that light-STRUCTURED depth was the '
      + 'missing property, not pixel-structured depth.)');
  } else if (opens) {
    console.log(`G-CEILING ${(ordered.relativeGain * 100).toFixed(2)}% ≥ ${(CEILING_FLOOR * 100).toFixed(1)}% floor `
      + '✅ ABOVE, decoy clean: the signal-plumbing round is licensed.');
  } else {
    console.log(`G-CEILING ${(ordered.relativeGain * 100).toFixed(2)}% against the ${(CEILING_FLOOR * 100).toFixed(1)}% floor — `
      + '🔴 BELOW: the pedestal line CLOSES, the way TT closed — a perfect signal cannot recover a '
      + 'quarter of the named collapse, so no real signal can either.');
  }

  const sha = process.argv.includes('--sha') ? process.argv[process.argv.indexOf('--sha') + 1] : 'nosha';
  const outFile = path.join(REPOSITORY_ROOT, 'captures', 'hair-r35-tf-ceiling', 'data', `ceiling-${sha}.json`);
  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  fs.writeFileSync(outFile, `${JSON.stringify({
    tool: 'tools/critic/hair-tf-ceiling.mjs',
    registration: 'docs/superpowers/specs/2026-08-24-r35-chromatic-pedestal-ceiling.md',
    generatedAt: new Date().toISOString(),
    cache: CACHE_FILE.replace(REPOSITORY_ROOT, ''),
    constants: { CEILING_FLOOR, DECOY_MAX_SHARE, POSITION_TOLERANCE },
    fibreLinear: colour,
    ordered, decoy, decoyShare, sheetArm, fiveConstants, medians, noWrap, boundaryGap, opens,
  }, null, 2)}\n`);
  console.log(`\nreport    ${path.relative(REPOSITORY_ROOT, outFile)}`);
}

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const normalise = (v) => { const l = Math.hypot(...v) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };

/** One page, one evaluate: the live rig's lights, the camera, and the shipped fibre colour. */
async function readLiveRig() {
  const { createServer } = await import('vite');
  const server = await createServer({
    configFile: path.join(REPOSITORY_ROOT, 'vite.spikes.config.js'),
    server: { port: 5198, strictPort: false, hmr: false, watch: { ignored: ['**'] }, open: false },
    logLevel: 'warn',
  });
  await server.listen();
  const baseUrl = server.resolvedUrls.local[0].replace(/\/$/, '');

  const playwright = await loadPlaywright();
  const browser = await playwright.chromium.launch({
    channel: 'chromium', headless: true,
    args: ['--enable-unsafe-webgpu', '--ignore-gpu-blocklist', '--hide-scrollbars'],
  });
  try {
    const page = await browser.newPage({ viewport: { width: 1080, height: 1920 } });
    await page.goto(`${baseUrl}/packages/testbed/alive.html?bare&freeze&seed=1&capture&hair=1`, { waitUntil: 'load' });
    const deadline = Date.now() + 240_000;
    for (;;) {
      const ready = await page.evaluate(async () => typeof globalThis.__SUGATA_STEP__ === 'function'
        && (await globalThis.__SUGATA_STEP__(0)) === true
        && (globalThis.sugata?.subsystems?.()?.hair ?? null) !== null);
      if (ready) break;
      if (Date.now() > deadline) throw new Error('the live page never became ready');
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
    return await page.evaluate(() => {
      const s = globalThis.sugata;
      const lights = [];
      s.stage.scene.traverse((object) => {
        if (object.isLight !== true) return;
        object.updateMatrixWorld(true);
        const e = object.matrixWorld.elements;
        lights.push({
          name: object.name || object.type,
          type: object.type,
          intensity: object.intensity,
          colour: [object.color.r, object.color.g, object.color.b],
          position: [e[12], e[13], e[14]],
        });
      });
      const camera = s.stage.camera;
      camera.updateMatrixWorld(true);
      const ce = camera.matrixWorld.elements;
      const material = s.session.hair.meshes[0].material;
      const c = material?.colorNode?.value ?? material?.color ?? { r: 0, g: 0, b: 0 };
      return { lights, camera: [ce[12], ce[13], ce[14]], fibreLinear: [c.r, c.g, c.b] };
    });
  } finally {
    await browser.close();
    await server.close();
  }
}

async function loadPlaywright() {
  const candidates = ['playwright'];
  const cacheDir = path.join(process.env.HOME ?? '', '.npm', '_npx');
  if (fs.existsSync(cacheDir)) {
    candidates.push(...fs.readdirSync(cacheDir)
      .map((entry) => path.join(cacheDir, entry, 'node_modules', 'playwright'))
      .filter((candidate) => fs.existsSync(candidate)));
  }
  const require = createRequire(import.meta.url);
  for (const candidate of candidates) {
    try {
      const ns = await import(pathToFileURL(require.resolve(candidate)).href);
      if (ns?.chromium) return ns;
      if (ns?.default?.chromium) return ns.default;
    } catch { /* next */ }
  }
  throw new Error('playwright not resolvable');
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main();
}
