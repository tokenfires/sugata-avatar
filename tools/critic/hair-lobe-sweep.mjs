// tools/critic/hair-lobe-sweep.mjs — R26. The contrast budget of the hair BSDF, swept on pixels.
//
// ## Why this file exists
//
// R26's decomposition established that every light in the rig reaches the groom — `directRectArea`
// is implemented and the four panels deliver 66-73% of a hair pixel exactly as they deliver 62-66%
// of the skin pixel 105 px away — and that the primary specular lobe is nevertheless invisible:
// over 207,947 gated hair pixels R's 99th percentile is 6.80e-2 against a shipped mass mean of
// 6.78e-2, a ratio of 1.00. The specular term's bright end lands on the AVERAGE brightness of the
// mass it is meant to sit on top of.
//
// That diagnosis named three numbers as the contrast budget — `roughnessR`, `weightR` and
// `scatter` — and could not sweep any of them, because `alive.html` had no key for them. R26 added
// `?hairbeta=`, `?hairweightr=` and a scalar `?hairscatter=`. This is the sweep.
//
// ## 🚩 THE UNIT ERROR THIS FILE EXISTS TO NOT REPEAT
//
// The diagnosis that commissioned it reported `HAIR_DEFAULTS.roughnessR` as "0.26 rad = 14.9°
// against Marschner's β_R of 5-10°". That comparison is wrong and the material's own header says
// why: M_p's argument in Karis' form is `sinθi + sinθr` and not Marschner's half-angle, so a width
// converts as **β_K = 2 β_M**. The shipped 0.26 is β_M = 0.130000 rad = **7.4485°**, which is the
// MIDDLE of Marschner's measured 5-10°, and the file's own docstring already said "mid-band of
// 0.1745…0.3491". Reading β_K as if it were β_M is a factor of two, and it turned "the shipped
// lobe sits mid-band" into "the shipped lobe is 50% wider than the paper's widest".
//
// So the sweep's ARM LABELS carry both variables, and the band is drawn from the source rather
// than from the previous round's prose. Marschner, Jensen, Cammarano, Worley, Hanrahan, SIGGRAPH
// 2003, Table 1 p8: β_R 5°…10°, which is 0.174533…0.349066 in the variable this material stores.
//
// ## What is measured, and the two gates it inherits
//
// Every arm is one page load of the judged URL plus its own keys, rendered at
// `toneMappingExposure` 4 and inverted at 4 — a single lobe on a #1A0E0C fibre lands at code 2-12
// and the 8-bit invertibility floor would otherwise throw away most of the groom. Both gates come
// from `hair-lightpath.mjs` and are re-derived here on this run's own plates rather than assumed:
//
//   1. THE GROOM MASK is `buildGroomMask` on a `?shadows=0` hair-on/hair-off pair, eroded twice, so
//      no antialiased card edge is read as hair.
//   2. THE HAIR-SHADED GATE. The shipped OIT is `stochastic`, so interior pixels of the mass
//      resolve to the scalp or the cheek behind and 17.56% of the mask is not drawn by
//      `HairMaterial` at all. The discriminator is the arm with every lobe and the scatter fake
//      off: that plate is bimodal with a measured empty band, and the cut sits in the hole. It is
//      not circular — the cut is made where every lobe is OFF, so it cannot select for pixels
//      where a lobe is strong.
//
// ## THE STATISTIC IS `bandShape`, IMPORTED RATHER THAN REWRITTEN
//
// It is validated in `hair-lightpath.mjs --selftest` against three synthetic fields whose answers
// are arithmetic, and the third is the red proof: isotropic noise carrying the SAME added energy as
// a real band reads peak/mean 1.1935 and 0.0000% above 2x, against the band's 4.0323 and 6.0000%,
// at identical means. R25's `coherentLock` died of exactly the failure that clause tests for, and
// re-implementing the operator here would have thrown the validation away.
//
//   node tools/critic/hair-lobe-sweep.mjs --capture --port 5177 --out captures/hair-r26-sweep
//   node tools/critic/hair-lobe-sweep.mjs --report --out captures/hair-r26-sweep
//   node tools/critic/hair-lobe-sweep.mjs --selftest

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
} from './lightpath-probe.mjs';
import { bandShape, erodeMask } from './hair-lightpath.mjs';

const WIDTH = 720;
const HEIGHT = 900;
const STEPS = 8;

/** The shipped judged URL. Identical to `hair-lightpath.mjs`'s, so the two runs are comparable. */
const BASE_QUERY = 'bare&freeze&seed=1&capture&aa=msaa&grade=0';

/** See the header: a single lobe on a dark fibre is unreadable at exposure 1. */
const EXPOSURE = 4;

/** `hair-lightpath.mjs`'s cut, re-derived on this run's own floor plate by `--report`. */
const HAIR_SHADED_MAX = 1.5e-2;

const DEG = Math.PI / 180;

/**
 * Marschner 2003 Table 1 β_R, in the variable THIS MATERIAL STORES.
 *
 * The paper measures 5°…10° in its own half-angle variable; `β_K = 2 β_M` converts it into the
 * `sinθi + sinθr` form Karis uses and `HAIR_DEFAULTS.roughnessR` holds. Written as the expression
 * so a reader can see the factor of two that the round's own diagnosis dropped.
 */
const BETA_BAND = [2 * 5 * DEG, 2 * 10 * DEG];

/**
 * The β arms. Four inside Marschner's band, two outside it and LABELLED as outside.
 *
 * The two outside arms are not candidates — nothing in either source licenses a lobe narrower than
 * 5° — they are there so the curve has a shape rather than four points, and so "the narrow end of
 * the band is the best available" is a statement about a measured trend instead of an assertion.
 */
const BETA_ARMS = [
  ['b-wide', BETA_BAND[1], 'Marschner β_R = 10°, the WIDE end of Table 1'],
  ['b-mid', 0.26, 'the SHIPPED value through R25 — β_M 7.4485°, mid-band'],
  ['b-020', 0.2, 'β_M 5.730°, inside the band'],
  ['b-narrow', BETA_BAND[0], 'Marschner β_R = 5°, the NARROW end of Table 1'],
  ['b-012', 0.12, '⚠️ OUTSIDE the band — β_M 3.438°, narrower than any sample in Table 1'],
  ['b-008', 0.08, '⚠️ OUTSIDE the band — β_M 2.292°, shape-of-the-curve only'],
];

/** The other two knobs the diagnosis named, at the shipped β, so the round can say why not them. */
const OTHER_ARMS = [
  ['s-050', 'hairscatter=0.5', 'slide 39\'s pedestal at half'],
  ['s-025', 'hairscatter=0.25', 'slide 39\'s pedestal at a quarter'],
  ['w-2', 'hairweightr=2', 'R doubled'],
  ['w-4', 'hairweightr=4', 'R quadrupled'],
];

// --- capture -------------------------------------------------------------------------------------

async function waitForFigure(page) {
  await page.waitForFunction(
    async () => (await globalThis.__SUGATA_STEP__(0)) === true,
    null,
    { timeout: 180_000, polling: 250 }
  );
}

async function withPage(port, query, fn) {
  const { chromium } = await loadPlaywright();
  // 🚩 `channel: 'chromium'` IS LOAD-BEARING AND ITS ABSENCE IS SILENT — Playwright's default
  // headless build has no GPU and every plate comes back a uniform RGB(10,10,12) while the page
  // still reports a WebGPUBackend. `hair-lightpath.mjs` and `capture.mjs` carry the same line.
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

/**
 * 🚩 THE PROVENANCE READ, AND IT IS THE POINT OF THE `&& ` CHAIN RATHER THAN A CONVENIENCE.
 *
 * A control was invalidated this week because its plates came from `hair.html`, which has
 * `renderer.shadowMap.enabled` false and no `LightingRig`. Every arm here reads back the material
 * CLASS NAME, the live `describe()` and the renderer's shadow flag, and the manifest carries them
 * beside the URL — so a plate whose provenance is wrong says so in its own sidecar.
 */
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

async function shoot(port, out, name, query, manifest) {
  const file = path.join(out, `${name}.png`);
  await withPage(port, query, async (page, url) => {
    await page.evaluate(SET_EXPOSURE, EXPOSURE);
    const census = await page.evaluate(CENSUS_SCRIPT);
    await plate(page, file, STEPS);
    manifest[name] = { url, exposure: EXPOSURE, census };
    console.log(`  ${name.padEnd(20)} <- ${url}`);
    if (census.materialClass !== 'HairNodeMaterial') {
      console.log(`  🔴 PROVENANCE: materialClass is ${census.materialClass}, not HairNodeMaterial`);
    }
  });
}

async function capture(port, out) {
  fs.mkdirSync(out, { recursive: true });
  const manifest = {};

  // The two mask plates, and the floor. `?shadows=0` on both halves of the mask pair because
  // `buildGroomMask` diffs them and a cast shadow would be read as groom.
  await shoot(port, out, 'mask-bald', `${BASE_QUERY}&shadows=0`, manifest);
  await shoot(port, out, 'mask-haired', `${BASE_QUERY}&shadows=0&hair=1`, manifest);
  await shoot(port, out, 'floor', `${BASE_QUERY}&hair=1&hairlobes=&hairscatter=0`, manifest);

  // Per β: the R lobe alone, and the whole shipped mass at the same β. The mass arm is what makes
  // `peak/mass-mean` a statement about THAT arm rather than about last round's plate.
  for (const [name, beta] of BETA_ARMS) {
    // eslint-disable-next-line no-await-in-loop
    await shoot(port, out, `${name}-R`, `${BASE_QUERY}&hair=1&hairlobes=r&hairscatter=0&hairbeta=${beta}`, manifest);
    // eslint-disable-next-line no-await-in-loop
    await shoot(port, out, `${name}-mass`, `${BASE_QUERY}&hair=1&hairbeta=${beta}`, manifest);
  }

  for (const [name, extra] of OTHER_ARMS) {
    // eslint-disable-next-line no-await-in-loop
    await shoot(port, out, `${name}-R`, `${BASE_QUERY}&hair=1&hairlobes=r&hairscatter=0&${extra}`, manifest);
    // eslint-disable-next-line no-await-in-loop
    await shoot(port, out, `${name}-mass`, `${BASE_QUERY}&hair=1&${extra}`, manifest);
  }

  fs.writeFileSync(path.join(out, 'manifest.json'), JSON.stringify(manifest, null, 2));
  console.log(`  wrote ${path.join(out, 'manifest.json')}`);
}

// --- report --------------------------------------------------------------------------------------

function percentile(sorted, q) {
  if (sorted.length === 0) return 0;
  const i = Math.min(sorted.length - 1, Math.max(0, Math.round(q * (sorted.length - 1))));
  return sorted[i];
}

function loadGate(out) {
  const bald = readPlate(path.join(out, 'mask-bald.png'));
  const haired = readPlate(path.join(out, 'mask-haired.png'));
  const solid = erodeMask(buildGroomMask(bald, haired), WIDTH, HEIGHT, 2);
  const floorPlate = readPlate(path.join(out, 'floor.png'));

  const hairShaded = new Uint8Array(WIDTH * HEIGHT);
  let inside = 0;
  let kept = 0;
  let band = 0;
  for (let k = 0; k < WIDTH * HEIGHT; k += 1) {
    if (solid[k] !== 1) continue;
    const codes = codesAt(floorPlate, k * 4);
    if (isInvertible(codes) === false) continue;
    inside += 1;
    const v = luminance(plateToSceneLinear(codes, EXPOSURE));
    if (v > 1.0e-2 && v < 2.5e-2) band += 1;
    if (v < HAIR_SHADED_MAX) { hairShaded[k] = 1; kept += 1; }
  }
  return { hairShaded, floorPlate, gate: { inside, kept, leaked: inside - kept, band } };
}

function luminancesAt(png, set) {
  return set.map((k) => luminance(plateToSceneLinear(codesAt(png, k * 4), EXPOSURE)));
}

function report(out) {
  const { hairShaded, floorPlate, gate } = loadGate(out);
  const arms = [
    ...BETA_ARMS.map(([name, beta, why]) => ({ name, label: `β_K ${beta.toFixed(6)}`, beta, why })),
    ...OTHER_ARMS.map(([name, extra, why]) => ({ name, label: extra, beta: null, why })),
  ];

  // Every arm must be read over the IDENTICAL pixel set or the comparison is between populations.
  const plates = {};
  for (const arm of arms) {
    plates[`${arm.name}-R`] = readPlate(path.join(out, `${arm.name}-R.png`));
    plates[`${arm.name}-mass`] = readPlate(path.join(out, `${arm.name}-mass.png`));
  }
  const all = [floorPlate, ...Object.values(plates)];

  const set = [];
  for (let k = 0; k < WIDTH * HEIGHT; k += 1) {
    if (hairShaded[k] !== 1) continue;
    if (all.every((p) => isInvertible(codesAt(p, k * 4)))) set.push(k);
  }

  console.log(
    `\n  GATE  ${gate.inside} invertible pixels inside the eroded groom mask: ${gate.kept} shaded by ` +
    `HairMaterial (${((gate.kept / gate.inside) * 100).toFixed(2)}%), ${gate.leaked} resolving to ` +
    `something behind (${((gate.leaked / gate.inside) * 100).toFixed(2)}%), ${gate.band} in the ` +
    `separating band [1.0e-2, 2.5e-2] the cut sits in`
  );
  console.log(`  ${set.length} pixels invertible in ALL ${all.length} arms — every row below is this one set\n`);

  const floor = luminancesAt(floorPlate, set);
  const rows = [];

  console.log('=== THE R LOBE AGAINST THE MASS IT SITS ON, both measured on the SAME arm');
  console.log(
    '    arm        β_M deg   R mean      R p99      R max      massMean   R/mass  ' +
    'P99/MASS  PEAK/MASS  >2x own  >4x own'
  );
  for (const arm of arms) {
    const rNet = luminancesAt(plates[`${arm.name}-R`], set).map((v, i) => v - floor[i]);
    const mass = luminancesAt(plates[`${arm.name}-mass`], set);
    const massMean = mass.reduce((a, b) => a + b, 0) / mass.length;
    const shape = bandShape(rNet, massMean);
    const sorted = [...rNet].sort((a, b) => a - b);
    const p99 = percentile(sorted, 0.99);
    const row = {
      name: arm.name,
      why: arm.why,
      beta: arm.beta,
      betaMarschnerDeg: arm.beta === null ? null : (arm.beta / 2) / DEG,
      rMean: shape.mean,
      rP99: p99,
      rMax: shape.max,
      massMean,
      p99OverMass: p99 / massMean,
      peakOverMass: shape.peakOverMassMean,
      above2: shape.above2,
      above4: shape.above4,
    };
    rows.push(row);
    console.log(
      `    ${arm.name.padEnd(10)} ${(row.betaMarschnerDeg === null ? '     -' : row.betaMarschnerDeg.toFixed(3)).padStart(7)}   ` +
      `${row.rMean.toExponential(3)}  ${row.rP99.toExponential(3)}  ${row.rMax.toExponential(3)}  ` +
      `${row.massMean.toExponential(3)}  ${(row.rMean / row.massMean * 100).toFixed(1).padStart(5)}%  ` +
      `${row.p99OverMass.toFixed(3).padStart(7)}   ${row.peakOverMass.toFixed(3).padStart(7)}   ` +
      `${(row.above2 * 100).toFixed(3).padStart(6)}%  ${(row.above4 * 100).toFixed(4).padStart(7)}%`
    );
  }
  for (const arm of arms) console.log(`    ${arm.name.padEnd(10)} ${arm.why}`);

  fs.writeFileSync(path.join(out, 'sweep.json'), JSON.stringify({ set: set.length, gate, rows }, null, 2));
  console.log(`\n  wrote ${path.join(out, 'sweep.json')}`);
}

/**
 * The two JUDGED plates — exposure 1, the shipped grade, the URL a critic is handed — through the
 * same gate.
 *
 * 🎯 EVERY NUMBER ABOVE IS TAKEN AT EXPOSURE 4 AND THAT IS A LIMIT, NOT A CHOICE. A single lobe on
 * a #1A0E0C fibre lands at code 2-12 at exposure 1 and the 8-bit invertibility floor would discard
 * most of the groom, so the decomposition has to be lifted. The plate a judge actually looks at is
 * not lifted, and a change that is large in a lifted decomposition and invisible in the shipped
 * frame would be a real finding about the round rather than a reason to keep quoting the lifted
 * number. This is the check that they agree.
 *
 * The mask and the hair-shaded gate come from the sweep's own capture directory — same 720x900,
 * same camera, same `frameFigure` — so the pixel set is the identical one every row above uses.
 */
function judged(out, plates) {
  const { hairShaded } = loadGate(out);
  const loaded = plates.map(([label, file]) => [label, readPlate(file)]);

  const set = [];
  for (let k = 0; k < WIDTH * HEIGHT; k += 1) {
    if (hairShaded[k] !== 1) continue;
    if (loaded.every(([, p]) => isInvertible(codesAt(p, k * 4)))) set.push(k);
  }
  console.log(`\n=== THE JUDGED PLATES, exposure 1, ${set.length} gated hair pixels`);
  console.log('    arm                        mean       p50        p95        p99        max        p95/p50  p99/mean  max/mean');
  for (const [label, png] of loaded) {
    const v = set.map((k) => luminance(plateToSceneLinear(codesAt(png, k * 4), 1)));
    const sorted = [...v].sort((a, b) => a - b);
    const mean = v.reduce((a, b) => a + b, 0) / v.length;
    const p50 = percentile(sorted, 0.5);
    const p95 = percentile(sorted, 0.95);
    const p99 = percentile(sorted, 0.99);
    const max = sorted[sorted.length - 1];
    console.log(
      `    ${label.padEnd(26)} ${mean.toExponential(3)}  ${p50.toExponential(3)}  ${p95.toExponential(3)}  ` +
      `${p99.toExponential(3)}  ${max.toExponential(3)}  ${(p95 / p50).toFixed(4).padStart(7)}  ` +
      `${(p99 / mean).toFixed(4).padStart(8)}  ${(max / mean).toFixed(4).padStart(8)}`
    );
  }
}

// --- selftest ------------------------------------------------------------------------------------

/**
 * Two clauses, and both are arithmetic rather than a re-run of the imported operator's own tests.
 *
 * `bandShape` and `erodeMask` are validated in `hair-lightpath.mjs --selftest`, which is where they
 * live; repeating that here would certify a copy. What is checked here is the thing THIS file
 * introduces — the Marschner band in Karis' variable, which is the exact quantity the round's own
 * diagnosis got wrong by a factor of two.
 */
function selftest() {
  let failures = 0;
  const say = (ok, label, detail) => {
    console.log(`${ok ? '  ok  ' : '  FAIL'} ${label}${detail === undefined ? '' : `\n      ${detail}`}`);
    if (ok === false) failures += 1;
  };

  // 🎯 THE PRODUCER LINES FOR `tools/quoted-numbers.mjs`, AND THEY ARE PRINTED WHETHER THE CLAUSES
  // PASS OR FAIL. A number a gate only prints on failure cannot be the thing a tagged claim in
  // another file is compared against, and this round's whole subject is a number that reached prose
  // wrong. The wording is kept free of digits inside words — no "R25", no "5-10" — because the tag
  // selects the n-th numeric literal on the line and a digit in a label would shift the index.
  const NARROW = BETA_BAND[0];
  const WIDE = BETA_BAND[1];
  const MID = (NARROW + WIDE) / 2;
  console.log(`  derived  band in Karis variable   ${NARROW.toFixed(6)}   ${WIDE.toFixed(6)}   midpoint ${MID.toFixed(6)}`);
  console.log(`  derived  shipped width in Marschner degrees   ${((NARROW / 2) / DEG).toFixed(4)}   and the previous midpoint   ${((0.26 / 2) / DEG).toFixed(4)}`);
  console.log(`  derived  peak ratio, previous midpoint over shipped width   ${(0.26 / NARROW).toFixed(4)}`);

  say(
    Math.abs(BETA_BAND[0] - 0.174533) < 1e-6 && Math.abs(BETA_BAND[1] - 0.349066) < 1e-6,
    'the Marschner band converts to 0.174533…0.349066 in Karis\' variable',
    `got ${BETA_BAND[0].toFixed(6)}…${BETA_BAND[1].toFixed(6)}`
  );

  // 🎯 THE CLAUSE THAT WOULD HAVE CAUGHT THE DIAGNOSIS. The shipped 0.26 is mid-band when read as
  // β_K and 50% ABOVE the widest sample when read as β_M — the two readings disagree about whether
  // the material is inside its own source, which is why the variable has to be named every time.
  const shippedAsMarschnerDegrees = (0.26 / 2) / DEG;
  say(
    Math.abs(shippedAsMarschnerDegrees - 7.4485) < 5e-4 &&
      shippedAsMarschnerDegrees > 5 && shippedAsMarschnerDegrees < 10,
    'β_K 0.26 is β_M 7.4485° — INSIDE Table 1\'s 5-10°, not the 14.9° the diagnosis reported',
    `got ${shippedAsMarschnerDegrees.toFixed(4)}°; 0.26 rad read as β_M would be ${(0.26 / DEG).toFixed(4)}°`
  );

  say(
    Math.abs(0.26 / BETA_BAND[0] - 1.4897) < 5e-4,
    'narrowing from the shipped 0.26 to the band\'s narrow end raises M_p\'s peak by 1.4897x',
    `got ${(0.26 / BETA_BAND[0]).toFixed(4)}x — M_p normalises by 1/(β√2π), so peak ∝ 1/β`
  );

  console.log(failures === 0 ? '\n  all clauses green' : `\n  ${failures} FAILED`);
  return failures;
}

// --- entry ---------------------------------------------------------------------------------------

const args = process.argv.slice(2);
const flag = (name, fallback = null) => {
  const i = args.indexOf(name);
  return i === -1 || i + 1 >= args.length ? fallback : args[i + 1];
};

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  const out = path.resolve(flag('--out', 'captures/hair-r26-sweep'));
  const port = flag('--port', '5177');
  if (args.includes('--selftest')) process.exit(selftest() === 0 ? 0 : 1);
  else if (args.includes('--capture')) await capture(port, out);
  else if (args.includes('--report')) report(out);
  else if (args.includes('--judged')) {
    judged(out, [
      ['A side  ?hairdefect=wide-lobe', 'captures/hair-r26-before/portrait.png'],
      ['B side  shipped β_R 0.174533', 'captures/hair-r26-after/portrait.png'],
    ]);
  } else console.log('pass --selftest | --capture | --report | --judged');
}
