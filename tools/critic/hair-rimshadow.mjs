// hair-rimshadow.mjs — REQ-063 measured against gates registered before it was built.
//
// THE REGISTRATION IS `docs/superpowers/specs/2026-08-23-req-063-preregistration.md`, committed at
// 55f1711 BEFORE any arm below was rendered. Nothing here may move a threshold in it.
//
// WHAT THIS ANSWERS. `captures/hair-r32-glint/rim-shadow.md` found that `?ov=rim.shadowFraction:1`
// is worth +2.492 codes of hair chroma, hair-specific, with luma FALLING. That killed REQ-078's
// recolour and revived this entry. It is not enough to ship, for three registered reasons:
//
//   1. 🔴 `shadowFraction > 0` BUILDS A SECOND SHADOW CASTER, and `LightingRig.selftest.mjs` prices
//      one at 2.62 ms at 1920x1080 — MORE THAN THE WHOLE GROOM COSTS (1.870 ms).
//   2. 🎯 DIMMING THE RIM IS FREE AND ALSO REMOVES THE WASH. So the deciding question is not "does
//      shadowing help" but "does it beat dimming to the SAME LUMA COST" — gate 1.
//   3. ⚠️ REQ-063'S ASK IS A PAIR. Its own text says `sideVisibility` goes to 0 with a rim shadow,
//      and `LightingRig.js` adds "the two changes have to land together or neither is measurable".
//      `?hairvis=0` removes it. The 2x2 is the experiment; the lead measured one cell.
//
// THE STATISTIC IS MASS-MEAN CHROMA over the gated hair mask, not REQ-064's top decile, and the
// reason is mechanical rather than preferential: the defect is a WASH over the whole groom, not a
// highlight. A decile would be the wrong population for this mechanism in exactly the way a
// whole-face mean was the wrong population for a local curtain shadow (CHECKPOINT §5).
//
// USAGE
//   npx vite --port 5176 &
//   node tools/critic/hair-rimshadow.mjs --masks     # mask plates + the lobes-off floor
//   node tools/critic/hair-rimshadow.mjs --arms      # the sweep, the 2x2, the null, the ceiling
//   node tools/critic/hair-rimshadow.mjs --dim <E>   # one matched-luma dim arm at irradiance E
//   node tools/critic/hair-rimshadow.mjs --report
//   node tools/critic/hair-rimshadow.mjs --selftest

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { chromaInCodes, cielabChroma } from './color.mjs';
import { codesAt, isInvertible, readPlate, plateToSceneLinear, luminance, plate } from './lightpath-probe.mjs';
import { BASE_QUERY, HEIGHT, LOBE_EXPOSURE, RECTS, STEPS, WIDTH, loadMasks, withPage } from './hair-lightpath.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..', '..');

/** Registered gate constants. Changing any of these after the data is in is renegotiation. */
export const GATE_BEATS_FREE = 2.0;      // winning arm's gain / matched-luma dim's gain
export const GATE_VISIBILITY = 1.0;      // codes of mass-mean chroma; the 8-bit quantisation floor
export const GATE_SKIN_RATIO = 0.5;      // skin must move less than half what hair moves
export const GATE_COST_MS = 2.62;        // the measured cost of the caster the rig already pays for
export const DECOY_RATIO = 0.5;          // decoy must move less than half the winning arm

const ARMS = [
  { key: 'base', label: 'shipped', query: 'hair=1' },
  // The SAME configuration captured twice. Their difference is the run's noise floor and every gate
  // delta below has to clear it — `frame-budget.mjs`'s `no-hair-2` plays the same role.
  { key: 'base-2', label: 'shipped (repeat)', query: 'hair=1&hairweightr=1' },

  { key: 'sf025', label: 'shadowFraction 0.25', query: 'hair=1&ov=rim.shadowFraction:0.25' },
  { key: 'sf050', label: 'shadowFraction 0.50', query: 'hair=1&ov=rim.shadowFraction:0.5' },
  { key: 'sf075', label: 'shadowFraction 0.75', query: 'hair=1&ov=rim.shadowFraction:0.75' },
  { key: 'sf100', label: 'shadowFraction 1.00', query: 'hair=1&ov=rim.shadowFraction:1' },

  // REQ-063's OTHER HALF, and the pair. `?hairvis=0` removes Karis' saturate(wi.wr + 1), which
  // exists only to discard an unshadowed rim.
  { key: 'vis0', label: 'sideVisibility 0 alone', query: 'hair=1&hairvis=0' },
  { key: 'sf100-vis0', label: 'shadow + sideVis 0', query: 'hair=1&ov=rim.shadowFraction:1&hairvis=0' },

  // 🚩 THE NULL. Same code path — a SpotLight, a 4096 map, the same energy split — on a light
  // authored at irradiance 0.07, which is 0.4% of the rim's 16 and cannot be the wash.
  { key: 'decoy', label: 'NULL: kicker shadowed', query: 'hair=1&ov=kicker.shadowFraction:1' },

  // The ceiling: what deleting the rim entirely buys. Bounds every possible rim intervention.
  { key: 'rim0', label: 'rim deleted (ceiling)', query: 'hair=1&ov=rim.irradiance:0' },
];

const FLOOR_ARM = { file: path.join('lobes', 'nothing-indirect-only-.png'), query: 'hair=1&hairlobes=&hairscatter=0' };
const MASK_ARMS = [
  ['C-hairoff-noshadows.png', `${BASE_QUERY}&shadows=0`],
  ['D-hairon-noshadows.png', `${BASE_QUERY}&shadows=0&hair=1`],
];

// --- capture -------------------------------------------------------------------------------

async function captureMasks(port, out) {
  fs.mkdirSync(path.join(out, 'lobes'), { recursive: true });
  for (const [file, query] of MASK_ARMS) {
    // eslint-disable-next-line no-await-in-loop
    await withPage(port, query, async (page, url) => {
      await plate(page, path.join(out, file), STEPS);
      console.log(`  ${file}  <- ${url}`);
    });
  }
  await withPage(port, `${BASE_QUERY}&${FLOOR_ARM.query}`, async (page, url) => {
    await page.evaluate((v) => { window.sugata.stage.renderer.toneMappingExposure = v; }, LOBE_EXPOSURE);
    await plate(page, path.join(out, FLOOR_ARM.file), STEPS);
    console.log(`  ${FLOOR_ARM.file}  <- ${url}  (exposure ${LOBE_EXPOSURE})`);
  });
}

async function captureArms(port, out, arms = ARMS) {
  fs.mkdirSync(out, { recursive: true });
  for (const arm of arms) {
    // eslint-disable-next-line no-await-in-loop
    await withPage(port, `${BASE_QUERY}&${arm.query}`, async (page, url) => {
      await plate(page, path.join(out, `${arm.key}.png`), STEPS);
      console.log(`  ${arm.key.padEnd(12)} <- ${url}`);
    });
  }
}

// --- the statistic -------------------------------------------------------------------------

/** Mass-mean chroma, top-decile chroma, R/B and p50 linear luma over a fixed pixel set. */
export function measure(png, pixels) {
  const rows = [];
  let r = 0;
  let g = 0;
  let b = 0;

  for (const k of pixels) {
    const codes = codesAt(png, k * 4);
    if (isInvertible(codes) === false) continue;
    r += codes[0]; g += codes[1]; b += codes[2];
    rows.push({
      chroma: chromaInCodes(...codes),
      lab: cielabChroma(codes[0] / 255, codes[1] / 255, codes[2] / 255),
      luma: luminance(plateToSceneLinear(codes, 1)),
    });
  }

  if (rows.length === 0) throw new Error('measure: no invertible pixels in the mask');

  const n = rows.length;
  const byLuma = [...rows].sort((a, c) => a.luma - c.luma);
  const decile = byLuma.slice(Math.floor(n * 0.9));

  return {
    n,
    chroma: rows.reduce((s, row) => s + row.chroma, 0) / n,
    lab: rows.reduce((s, row) => s + row.lab, 0) / n,
    decileChroma: decile.reduce((s, row) => s + row.chroma, 0) / decile.length,
    p50: byLuma[Math.floor(n * 0.5)].luma,
    rb: r / b,
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

// --- the report ----------------------------------------------------------------------------

function report(out, dimE) {
  const { hairShaded, gate } = loadMasks(out);
  if (gate === null) {
    console.log('\n🔴 THE MASK IS UNGATED — no lobes-off floor plate. Run --masks. Refusing to report.\n');
    return 1;
  }

  const hair = [];
  for (let k = 0; k < WIDTH * HEIGHT; k += 1) if (hairShaded[k] === 1) hair.push(k);
  const skin = skinPixels();

  console.log(
    `\n  GATE  ${gate.inside} invertible px in the eroded groom mask: ${gate.kept} shaded by ` +
    `HairMaterial (${((gate.kept / gate.inside) * 100).toFixed(2)}%), ${gate.band} in the separating band`
  );

  const present = ARMS.filter((a) => fs.existsSync(path.join(out, `${a.key}.png`)));
  if (present.length !== ARMS.length) {
    console.log(`\n🔴 missing ${ARMS.length - present.length} arm plate(s) — run --arms first.\n`);
    return 1;
  }

  const m = new Map();
  for (const arm of present) m.set(arm.key, measure(readPlate(path.join(out, `${arm.key}.png`)), hair));
  const skinM = new Map();
  for (const arm of present) skinM.set(arm.key, measure(readPlate(path.join(out, `${arm.key}.png`)), skin));

  const dimFile = path.join(out, 'dim-matched.png');
  const hasDim = fs.existsSync(dimFile);
  if (hasDim) {
    m.set('dim-matched', measure(readPlate(dimFile), hair));
    skinM.set('dim-matched', measure(readPlate(dimFile), skin));
  }

  const base = m.get('base');
  const gainOf = (key) => m.get(key).chroma - base.chroma;

  console.log('\n  --- mass-mean chroma on the gated hair mask -------------------------------\n');
  console.log('      arm                       px    chroma    Δ      decile     R/B     p50 linear');
  const rows = [...present.map((a) => [a.key, a.label]), ...(hasDim ? [['dim-matched', `matched dim (E ${dimE ?? '?'})`]] : [])];
  for (const [key, label] of rows) {
    const s = m.get(key);
    console.log(
      `      ${label.padEnd(24)} ${String(s.n).padStart(6)} ${s.chroma.toFixed(3).padStart(8)} ` +
      `${(s.chroma - base.chroma >= 0 ? '+' : '') + (s.chroma - base.chroma).toFixed(3)}`.padEnd(9) +
      ` ${s.decileChroma.toFixed(3).padStart(8)} ${s.rb.toFixed(3).padStart(7)}  ${s.p50.toExponential(3)}`
    );
  }

  // --- read the controls FIRST -------------------------------------------------------------
  const drift = Math.abs(m.get('base-2').chroma - base.chroma);

  // The winning arm is the shadowFraction arm with the largest gain — chosen by the registered
  // statistic, not by eye.
  const sweep = ['sf025', 'sf050', 'sf075', 'sf100'];
  const winner = sweep.reduce((best, k) => (gainOf(k) > gainOf(best) ? k : best), sweep[0]);
  const win = gainOf(winner);
  const decoyGain = gainOf('decoy');

  console.log('\n  --- the controls, read BEFORE the gates -----------------------------------\n');
  console.log(
    `      DRIFT     one configuration captured twice differs by ${drift.toFixed(4)} codes — ` +
    `every delta below must clear this to mean anything`
  );
  const decoyRatio = win === 0 ? Infinity : Math.abs(decoyGain / win);
  const decoyVoid = decoyRatio > DECOY_RATIO;
  console.log(
    `      NULL      kicker shadowed (E 0.07) moves ${decoyGain.toFixed(4)} against the winner's ` +
    `${win.toFixed(4)} — ratio ${decoyRatio.toFixed(3)}  ` +
    `${decoyVoid ? '🔴 VOID: the statistic reads "a shadow map was added"' : '✅ the statistic reads the RIM'}`
  );

  if (decoyVoid) {
    console.log('\n  🔴 VOID. A caster on a light at 0.4% of the rim\'s irradiance cannot be the wash.');
    console.log('     Fix the statistic and RE-REGISTER; do not read the gates.\n');
    return 1;
  }
  if (win <= drift) {
    console.log('\n  🔴 VOID. The winning arm\'s gain does not clear the drift floor.\n');
    return 1;
  }

  console.log(`\n  --- the registered gates (winner: ${winner}) -------------------------------\n`);

  let pass = true;

  if (hasDim) {
    const dimGain = m.get('dim-matched').chroma - base.chroma;
    const lumaMatch = Math.abs(m.get('dim-matched').p50 / m.get(winner).p50 - 1) * 100;
    const ratio = dimGain <= 0 ? Infinity : win / dimGain;
    const ok = ratio >= GATE_BEATS_FREE;
    pass = pass && ok;
    console.log(
      `      GATE 1    beats the free alternative: shadow ${win.toFixed(4)} against matched dim ` +
      `${dimGain.toFixed(4)} — ${Number.isFinite(ratio) ? `${ratio.toFixed(3)}x` : 'infinite'}, floor ` +
      `${GATE_BEATS_FREE.toFixed(1)}x  ${ok ? '✅ PASS' : '❌ FAIL'}`
    );
    console.log(`                (luma matched to ${lumaMatch.toFixed(2)}% — registered window is ±0.5%)`);
    if (lumaMatch > 0.5) {
      console.log('                🔴 OUTSIDE THE REGISTERED WINDOW — gate 1 is VOID, not passed.');
      pass = false;
    }
  } else {
    console.log(`      GATE 1    NOT MEASURED — no dim-matched arm. Run --dim <E> after reading the`);
    console.log(`                winner's p50 (${m.get(winner).p50.toExponential(4)}). Gate 1 decides the round.`);
    pass = false;
  }

  const visible = win >= GATE_VISIBILITY;
  pass = pass && visible;
  console.log(
    `      GATE 2    visibility: ${win.toFixed(4)} codes of mass-mean chroma, floor ` +
    `${GATE_VISIBILITY.toFixed(1)}  ${visible ? '✅ PASS' : '❌ FAIL'}`
  );

  const skinMove = Math.abs(skinM.get(winner).chroma - skinM.get('base').chroma);
  const specific = skinMove < Math.abs(win) * GATE_SKIN_RATIO;
  pass = pass && specific;
  console.log(
    `      GATE 3    hair-specific: skin moves ${skinMove.toFixed(4)} against hair's ` +
    `${Math.abs(win).toFixed(4)} — ${(skinMove / Math.abs(win)).toFixed(3)} of it, ceiling ` +
    `${GATE_SKIN_RATIO}  ${specific ? '✅ PASS' : '❌ FAIL'}`
  );

  console.log(
    `      GATE 4    cost: NOT MEASURED BY THIS TOOL. The registered ceiling is ${GATE_COST_MS} ms ` +
    `— the measured cost of\n                the caster the rig already pays for. Run the frame timer.`
  );

  console.log('\n  --- REQ-063\'s 2x2, which the lead never ran -------------------------------\n');
  for (const k of ['base', 'sf100', 'vis0', 'sf100-vis0']) {
    const s = m.get(k);
    console.log(`      ${(ARMS.find((a) => a.key === k).label).padEnd(24)} chroma ${s.chroma.toFixed(3)}  Δ ${(s.chroma - base.chroma >= 0 ? '+' : '')}${(s.chroma - base.chroma).toFixed(3)}  R/B ${s.rb.toFixed(3)}`);
  }
  const pair = gainOf('sf100-vis0');
  const alone = gainOf('sf100');
  const visAlone = gainOf('vis0');
  console.log(
    `\n      the pair buys ${pair.toFixed(4)} against ${alone.toFixed(4)} for the shadow alone and ` +
    `${visAlone.toFixed(4)} for sideVisibility alone.`
  );
  console.log(
    `      ${pair > alone + visAlone ? '🎯 SUPER-ADDITIVE — the two really do need each other, as REQ-063 says.'
      : pair < Math.max(alone, visAlone) ? '🔴 THE PAIR IS WORSE THAN ITS BEST HALF.'
        : '⚠️ MERELY ADDITIVE — "they have to land together" is not supported by this.'}`
  );

  console.log('\n  --- the ceiling, reported and deciding nothing ----------------------------\n');
  console.log(
    `      deleting the rim entirely buys ${gainOf('rim0').toFixed(4)} codes. Every rim intervention ` +
    `is bounded by this.\n`
  );

  return pass ? 0 : 2;
}

// --- selftest ------------------------------------------------------------------------------

function selftest() {
  let failures = 0;
  const check = (ok, label, detail) => {
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}`);
    if (detail) console.log(`      ${detail}`);
    if (ok === false) failures += 1;
  };

  const png = { pixels: new Float32Array(4 * 100), width: 10, height: 10 };
  for (let i = 0; i < 100; i += 1) {
    const v = (i < 90 ? 30 : 210) / 255;
    png.pixels[i * 4] = v; png.pixels[i * 4 + 1] = v; png.pixels[i * 4 + 2] = v; png.pixels[i * 4 + 3] = 1;
  }
  const all = Array.from({ length: 100 }, (_, i) => i);
  const grey = measure(png, all);
  check(grey.chroma < 1e-9 && grey.decileChroma < 1e-9,
    'a grey plate reads ZERO mass-mean and ZERO decile chroma',
    `mass ${grey.chroma.toExponential(2)}, decile ${grey.decileChroma.toExponential(2)} — a statistic that moved here would read brightness`);

  check(Math.abs(grey.rb - 1) < 1e-9, 'a grey plate reads R/B exactly 1', `${grey.rb}`);

  // 🚩 THE POSITIVE CONTROL, AND IT HAD TO BE REBUILT BECAUSE THE FIRST ONE COULD NOT FAIL.
  //
  // The first version added the SAME absolute blue to every pixel and then asserted that the mass
  // sees what the decile under-reports. On a uniform wash both statistics read 16.330 — identical —
  // so the clause passed without discriminating anything. A clause that cannot go red is the exact
  // shape `hair-lightpath.mjs` spent a round discovering about its own shape statistic.
  //
  // The fixture now carries the mechanism's real signature. An unshadowed rim adds roughly constant
  // RADIANCE, and ACES compresses highlights, so the same added radiance moves a DARK pixel's codes
  // much further than a bright one's. The wash therefore lands hardest on the groom's mass and
  // barely touches its top decile — which is precisely why the registration chose the mass, and the
  // check now fails if that ordering is ever lost.
  const washed = { pixels: Float32Array.from(png.pixels), width: 10, height: 10 };
  for (let i = 0; i < 100; i += 1) {
    const add = (i < 90 ? 25 : 4) / 255;      // dark pixels take the wash; bright ones are compressed
    washed.pixels[i * 4 + 2] = Math.min(1, washed.pixels[i * 4 + 2] + add);
  }
  const w = measure(washed, all);
  check(w.chroma > grey.chroma + 1.0 && w.rb < 1,
    'a BLUE WASH raises mass-mean chroma and drops R/B',
    `chroma ${grey.chroma.toFixed(3)} -> ${w.chroma.toFixed(3)}, R/B ${grey.rb.toFixed(3)} -> ${w.rb.toFixed(3)}`);

  check(w.chroma > w.decileChroma * 1.5,
    'the MASS sees a wash the DECILE under-reports — the reason the registration chose it',
    `mass ${w.chroma.toFixed(3)} against decile ${w.decileChroma.toFixed(3)}, ratio ${(w.chroma / w.decileChroma).toFixed(2)}x — a uniform-wash fixture read 1.00x and could not fail`);

  // The registered constants must be the registered values.
  check(GATE_BEATS_FREE === 2.0 && GATE_VISIBILITY === 1.0 && GATE_SKIN_RATIO === 0.5 && GATE_COST_MS === 2.62,
    'the registered gate constants are unchanged',
    `beats-free ${GATE_BEATS_FREE}, visibility ${GATE_VISIBILITY}, skin ${GATE_SKIN_RATIO}, cost ${GATE_COST_MS} ms`);

  check(ARMS.some((a) => a.key === 'decoy') && ARMS.some((a) => a.key === 'base-2'),
    'the null and the drift control are both in the arm list',
    'a round whose controls are optional is a round whose controls do not run');

  console.log(`\n${failures === 0 ? 'PASS' : 'FAIL'}: ${7 - failures}/7 checks green`);
  return failures;
}

// --- entry ---------------------------------------------------------------------------------

const args = process.argv.slice(2);
const flag = (name, fallback = null) => {
  const i = args.indexOf(name);
  return i === -1 ? fallback : args[i + 1];
};

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  const out = path.resolve(flag('--out', path.join(REPO, 'captures', 'hair-r33-rimshadow')));
  const port = flag('--port', '5176');

  if (args.includes('--selftest')) process.exit(selftest() === 0 ? 0 : 1);
  else if (args.includes('--masks')) await captureMasks(port, out);
  else if (args.includes('--arms')) await captureArms(port, out);
  // 🚩 `--report` IS TESTED BEFORE `--dim`, AND THE ORDER IS A BUG FIX. It was the other way round,
  // so `--report --dim 0` — the invocation that reads gate 1, which needs to know the matched E —
  // fell into the CAPTURE branch, re-shot the plate and exited 0. A flag that silently performs a
  // different action and reports success is the shape `frame-budget.mjs`'s `--only` aliasing took.
  else if (args.includes('--report')) process.exit(report(out, flag('--dim')));
  else if (args.includes('--dim')) {
    const e = flag('--dim');
    await captureArms(port, out, [{ key: 'dim-matched', label: `dim E ${e}`, query: `hair=1&ov=rim.irradiance:${e}` }]);
  }
  else console.log('pass --selftest | --masks | --arms | --dim <E> | --report');
}
