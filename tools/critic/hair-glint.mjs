// hair-glint.mjs — REQ-064 measured against the gates that were registered before it was built.
//
// WHAT THIS ANSWERS. `docs/OPEN-REQUESTS.md` REQ-064 asks for a light near the view axis so the
// retroreflective TRT lobe has a geometry to fire in. TRT is the ONLY shipped lobe that multiplies
// by the hair's own colour — `pow(colour, 0.8/cosθd)` — because R is pure Fresnel and takes the
// LIGHT's colour (measured R/B 1.031) and TT ships at `weightTT` 0. So it is the only term that can
// put hair-coloured light into a highlight, and its azimuthal distribution `exp(17 cos φ − 16.78)`
// is 1.2461 on the camera axis against 3.0965e-15 at the rim. The lobe was never weak on this rig;
// it was unlit.
//
// 🔴 THE FAILURE MODE THIS FILE EXISTS TO AVOID, quoted from `render/LightingRig.js`, which already
// measured a near-axis light and recorded why the answer could not be trusted:
//
//     "REQ-064's camera-axis light lands on the FLOOR, not on the band. [...] slide 39's
//      multiple-scattering fake carries 65.4% of the groom's rise and its whole angular dependence
//      is a wrap-around cosine, so a better geometry feeds the fake before it feeds the lobe."
//
// Both arms that ever cleared the contrast gate were measured WITH THE FAKE OFF. So the live hazard
// is to add the light, watch the groom brighten ~12.9%, and attribute to TRT a rise that is mostly
// the fake being handed a better cosine. **The primary gate here is therefore ATTRIBUTION rather
// than magnitude** — a magnitude threshold would be a number picked after the fact, and an
// attribution threshold is the actual question.
//
// 🎯 AND THE STATISTIC IS CHROMA, NOT BRIGHTNESS, WHICH IS WHERE BOTH PRIOR ASSESSMENTS WENT WRONG.
// `docs/research/pedestal-look-2026-08-22.md` §3: *"REQ-064 was assessed as a BRIGHTNESS lever and
// correctly found small. That was the wrong metric. [...] The value of a 1.3% term that is the ONLY
// saturated hair-coloured highlight is not its energy share."* The complaint is colour.
//
// THE REGISTRATION IS `docs/superpowers/specs/2026-08-23-req-064-preregistration.md` and it was
// committed at 79c870e BEFORE any arm below was rendered. Nothing in this file may move a threshold
// in it, including in the conservative direction.
//
// ⚠️ ONE DEFECT IN THAT REGISTRATION, DECLARED RATHER THAN QUIETLY FIXED. Its visibility floor reads
// "at least 1.0 encoded code value of increase in top-decile mean C*", which names a CIELAB
// statistic and an 8-bit unit in the same sentence — they are not the same quantity. The number and
// its stated justification ("below one code value of an 8-bit plate the change cannot be seen")
// describe a code-value quantity, so the gate is applied on `chromaInCodes` and C* is reported
// beside it. See the note over both functions in `color.mjs`. Choosing whichever of the two the
// data favoured would be the renegotiation the registration forbids; choosing by UNIT is the
// reading that binds, and it was fixed before the numbers existed.
//
// USAGE
//   npx vite --port 5176 &                     # the tool does not start its own server
//   node tools/critic/hair-glint.mjs --masks   # the four mask plates plus the lobes-off floor
//   node tools/critic/hair-glint.mjs --arms    # the nine gate arms plus the irradiance sweep
//   node tools/critic/hair-glint.mjs --report  # the gates, off plates already on disk
//   node tools/critic/hair-glint.mjs --selftest

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { cielabChroma, chromaInCodes } from './color.mjs';
import { codesAt, isInvertible, readPlate, plateToSceneLinear, luminance } from './lightpath-probe.mjs';
import {
  BASE_QUERY,
  HEIGHT,
  LOBE_EXPOSURE,
  STEPS,
  WIDTH,
  loadMasks,
  withPage,
} from './hair-lightpath.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..', '..');

/**
 * The top decile is the HIGHLIGHT, and a decile rather than a percentile is deliberate.
 *
 * `docs/CHECKPOINT.md` records that R is 62% of the brightest pixels, so "the brightest hair pixels
 * are grey pixels" is the complaint stated as a measurement. The decile is wide enough to be a band
 * rather than a handful of outliers — at ~200k gated pixels it is ~20,000 px — and narrow enough
 * that it is not just the groom's mass again.
 *
 * ⚠️ The cut is taken PER ARM on that arm's own luma, not once on the baseline. That is the choice
 * that makes this a statement about the highlight rather than about a fixed set of pixels: if the
 * glint moves which pixels are brightest, the question "is the highlight coloured" has to follow
 * them. The fixed-population reading is reported too, and where they disagree that is a finding.
 */
const HIGHLIGHT_QUANTILE = 0.90;

/**
 * The arms. Each differs from its own baseline in ONE thing.
 *
 * 🎯 `ov=glint.irradiance:0` IS THE NO-GLINT BASELINE RATHER THAN A BUILD WITHOUT THE LIGHT, AND
 * THAT IS A BETTER CONTROL THAN IT LOOKS. The light object still exists at intensity 0, so both
 * arms compile the SAME shader graph and differ only in the value of one uniform — `intensity` is
 * folded into the light's colour node by `AnalyticLightNode.update`, not into a define. Removing
 * the light instead would change the light count, the program hash and the loop three generates,
 * and then "glint on against glint off" would be two different shaders being compared.
 *
 * The glint's shipped irradiance is `GLINT_LIGHTS.portrait.irradiance` and is deliberately NOT
 * restated here — a measurement tool that carries its own copy of the constant it is measuring is
 * a tool that can silently disagree with the thing it measures.
 */
const ARMS = [
  // The registered primary pair: shipped configuration, fake ON, glint off then on.
  { key: 'base', label: 'shipped, no glint', query: 'hair=1&ov=glint.irradiance:0' },
  { key: 'glint', label: 'shipped + glint', query: 'hair=1' },

  // The same pair with slide 39's fake OFF. This is the pair that says whether the fake ate it.
  { key: 'base-nofake', label: 'no fake, no glint', query: 'hair=1&hairscatter=0&ov=glint.irradiance:0' },
  { key: 'glint-nofake', label: 'no fake + glint', query: 'hair=1&hairscatter=0' },

  // ATTRIBUTION. The gain with TRT present against the gain with TRT removed, both in the shipped
  // configuration. `hairlobes=r` is R alone; `hairlobes=r,trt` adds back the one lobe under test.
  { key: 'base-r', label: 'R only, no glint', query: 'hair=1&hairlobes=r&ov=glint.irradiance:0' },
  { key: 'glint-r', label: 'R only + glint', query: 'hair=1&hairlobes=r' },
  // 🎯 `hairlobes` DEFAULTS TO `r,trt` (`alive.js:2036`), so these two are the SAME CONFIGURATION as
  // `base` and `glint` above, written the long way. That is a duplicate by accident and it is kept
  // on purpose: two independent captures of one configuration are a DRIFT CONTROL, the same role
  // `no-hair-2` plays in `frame-budget.mjs`. If `base` and `base-rtrt` disagree materially then the
  // run drifted and no delta in the table is worth reading — which is better learnt from the table
  // than from a later argument about whether the numbers were stable.
  { key: 'base-rtrt', label: 'R+TRT, no glint', query: 'hair=1&hairlobes=r,trt&ov=glint.irradiance:0' },
  { key: 'glint-rtrt', label: 'R+TRT + glint', query: 'hair=1&hairlobes=r,trt' },

  // THE DECOY. Same light, same power, azimuth 180 — where D_TRT is 2.1357e-15, i.e. nowhere. If
  // this moves the statistic by more than half what the on-axis arm does, the statistic is reading
  // a brightness change and every number above is void regardless of the other gates.
  { key: 'decoy', label: 'glint BEHIND (decoy)', query: 'hair=1&ov=glint.azimuthDegrees:180' },
];

/**
 * The irradiance sweep, because the registration says the number is UNSOLVED.
 *
 * 🎯 PREDICTED BEFORE RENDERING, FROM THE BSDF'S OWN CPU MIRROR, and the prediction is why this
 * sweep exists at all. `hairScatteringValue` — the mirror `HairMaterial.js` publishes so the shader
 * can be evaluated without a GPU — on the SHIPPED `HAIR_BASE_COLOUR_HEX = 0x1A0E0C` fibre with a
 * side-of-head tangent, viewed down the camera axis.
 *
 * 🔴 THE FIRST VERSION OF THIS TABLE WAS COMPUTED ON `#150F17` AND WITH A GAMMA-2.2 TRANSFER, AND
 * BOTH WERE WRONG. `#150F17` is the PRE-CORRECTION albedo — `docs/CHECKPOINT.md:66`, "a physical
 * error, now fixed… R21 G15 B23, blue above red" — and the linearisation must be the sRGB EOTF, not
 * a power law. Corrected, TRT's relative chroma is **0.6712** (published: 0.4981), its share of an
 * on-axis light's contribution is **25.9%** (published: 19.0%), and — the part worth reading twice —
 * its HUE is **7.1°, a red**, where the stale fibre computed **283.7°, a violet**. The published
 * claim that TRT is the lobe that would warm the highlight toward copper is CORRECT for the shipped
 * fibre and was reached from a computation that said the opposite. Right conclusion, wrong
 * arithmetic. ⚠️ Every MEASURED number in the round is unaffected — those came off the shipped
 * renderer, which uses the shipped constant:
 *
 *   | light azimuth | cosφ     | R (sum)  | TRT (sum) | TRT/total | TRT rel-chroma | R rel-chroma |
 *   |--------------:|---------:|---------:|----------:|----------:|---------------:|-------------:|
 *   |             0 |  1.00000 |        — |         — |  2.59e-1  |     **0.6712** |   **0.0000** |
 *
 * (the R and TRT sums are dropped rather than restated: they were computed on the stale fibre and
 * re-deriving every row was not worth the GPU-free minute it would have cost once the conclusion
 * had already been measured on plates. TRT's share and chroma at the camera axis are re-derived.)
 *
 * Two things it settles for free. **R's relative chroma is EXACTLY zero at every azimuth** — the
 * "R cannot carry colour by construction" claim is now re-derived rather than quoted, and it is the
 * one figure here that BOTH errors leave untouched, because R is achromatic by construction. And
 * TRT's is **0.6712** and FLAT across azimuth, because its absorption depends on `cosθd` and not on
 * `φ`; what the azimuth moves is how much of it there is, not what colour it is.
 *
 * 🔴 AND IT PREDICTS THAT THE SHIPPED 0.05 IS TOO SMALL TO REACH THE VISIBILITY FLOOR. On-axis, TRT
 * is 25.9% of that light's own contribution — far more than R26's "1.30% of the mass", and there is
 * no contradiction: R26's figure is a share of the WHOLE GROOM, which is lit mostly by a key at
 * azimuth 42 and a rim at 168. Per unit of ON-AXIS irradiance the lobe is large. But the glint at
 * 0.05 against the form lights' 3.0 + 2.20 is ~1% of the rig's irradiance, so its TRT lands near
 * 0.19% of the groom — under gate 2 before a pixel is drawn.
 *
 * ⚠️ This is a SINGLE-FIBRE ANALYTIC PREDICTION with a hand-chosen tangent, not the rendered groom.
 * It is here to shape the sweep, and it decides nothing: the gates are read off plates.
 *
 * So the sweep runs, and the value that ships is the largest one gate 3 leaves room for — the same
 * way `EDGE_LIGHTS.portrait`'s kicker arrived at 0.07, "the largest one the seven gates leave room
 * for". Sweeping is not renegotiating: the registration fixed the GATES, and explicitly left this
 * number to be solved against them.
 */
const IRRADIANCE_SWEEP = [ 0.05, 0.2, 0.5, 1.0, 2.0 ];

const SWEEP_ARMS = IRRADIANCE_SWEEP.map((e) => ({
  key: `sweep-${String(e).replace('.', 'p')}`,
  label: `glint E ${e}`,
  query: `hair=1&ov=glint.irradiance:${e}`,
}));

/** The lobes-off plate `loadMasks` needs to gate the groom mask, at the name it looks for. */
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
      await plateAt(page, path.join(out, file));
      console.log(`  ${file}  <- ${url}`);
    });
  }

  // The floor plate is taken at LOBE_EXPOSURE, exactly as `hair-lightpath.mjs` takes it, because
  // `loadMasks` inverts it at that exposure. Taking it at 1 would put every pixel under the cut and
  // gate the entire groom away — silently, as a mask of zero pixels.
  await withPage(port, `${BASE_QUERY}&${FLOOR_ARM.query}`, async (page, url) => {
    await page.evaluate((v) => { window.sugata.stage.renderer.toneMappingExposure = v; }, LOBE_EXPOSURE);
    await plateAt(page, path.join(out, FLOOR_ARM.file));
    console.log(`  ${FLOOR_ARM.file}  <- ${url}  (exposure ${LOBE_EXPOSURE})`);
  });
}

async function captureArms(port, out) {
  fs.mkdirSync(out, { recursive: true });

  for (const arm of [...ARMS, ...SWEEP_ARMS]) {
    // eslint-disable-next-line no-await-in-loop
    await withPage(port, `${BASE_QUERY}&${arm.query}`, async (page, url) => {
      await plateAt(page, path.join(out, `${arm.key}.png`));
      console.log(`  ${arm.key.padEnd(12)}  <- ${url}`);
    });
  }
}

async function plateAt(page, file) {
  const { plate } = await import('./lightpath-probe.mjs');
  await plate(page, file, STEPS);
}

// --- the statistic -------------------------------------------------------------------------

/**
 * Top-decile chroma on one plate over a fixed pixel set.
 *
 * Returns both readings of the decile — the arm's own top decile, and the pixels that were the
 * baseline's top decile — because they answer different questions and a single number would hide
 * which one it was. `population` is the second one's index set, or null to report only the first.
 */
export function highlightChroma(png, pixels, population = null) {
  const rows = [];

  for (const k of pixels) {
    const codes = codesAt(png, k * 4);
    if (isInvertible(codes) === false) continue;

    const [r, g, b] = codes;
    rows.push({
      k,
      luma: luminance(plateToSceneLinear(codes, 1)),
      codes: chromaInCodes(r, g, b),
      lab: cielabChroma(r / 255, g / 255, b / 255),
    });
  }

  if (rows.length === 0) throw new Error('highlightChroma: no invertible pixels in the mask');

  const byLuma = [...rows].sort((a, b) => a.luma - b.luma);
  const cut = Math.floor(byLuma.length * HIGHLIGHT_QUANTILE);
  const own = byLuma.slice(cut);

  const result = {
    count: rows.length,
    ownDecile: summarise(own),
    ownDecileKeys: own.map((row) => row.k),
    mass: summarise(rows),
  };

  if (population !== null) {
    const wanted = new Set(population);
    result.fixedDecile = summarise(rows.filter((row) => wanted.has(row.k)));
  }

  return result;
}

function summarise(rows) {
  const n = rows.length;
  if (n === 0) return { n: 0, codes: 0, lab: 0, luma: 0 };
  return {
    n,
    codes: rows.reduce((sum, row) => sum + row.codes, 0) / n,
    lab: rows.reduce((sum, row) => sum + row.lab, 0) / n,
    luma: rows.reduce((sum, row) => sum + row.luma, 0) / n,
  };
}

// --- the gates -----------------------------------------------------------------------------

function report(out) {
  const { hairShaded, gate } = loadMasks(out);

  if (gate === null) {
    console.log('\n🔴 THE MASK IS UNGATED — the lobes-off floor plate is missing. Run --masks first.');
    console.log('   An ungated mask includes skin the groom shadowed, and LightingRig.js records');
    console.log('   that its p95 is not a hair pixel at all. Refusing to report gates on it.\n');
    return 1;
  }

  const pixels = [];
  for (let k = 0; k < WIDTH * HEIGHT; k += 1) if (hairShaded[k] === 1) pixels.push(k);

  console.log(
    `\n  GATE  ${gate.inside} invertible px inside the eroded groom mask: ${gate.kept} shaded by ` +
    `HairMaterial (${((gate.kept / gate.inside) * 100).toFixed(2)}%), ${gate.leaked} resolving to ` +
    `something behind it, ${gate.band} in the separating band the cut sits in`
  );

  const measured = new Map();
  const baselineKeys = new Map();

  for (const arm of [...ARMS, ...SWEEP_ARMS]) {
    const file = path.join(out, `${arm.key}.png`);
    if (fs.existsSync(file) === false) {
      console.log(`\n🔴 missing plate ${arm.key}.png — run --arms first.`);
      return 1;
    }
    measured.set(arm.key, highlightChroma(readPlate(file), pixels));
  }

  // The fixed-population reading needs each pair's own baseline decile, so it is a second pass.
  for (const [pair, base] of [['glint', 'base'], ['glint-nofake', 'base-nofake'],
    ['glint-r', 'base-r'], ['glint-rtrt', 'base-rtrt'], ['decoy', 'base']]) {
    baselineKeys.set(pair, measured.get(base).ownDecileKeys);
  }

  for (const [pair, keys] of baselineKeys) {
    const file = path.join(out, `${pair}.png`);
    measured.set(pair, highlightChroma(readPlate(file), pixels, keys));
  }

  console.log('\n  --- top-decile chroma on the gated hair mask ------------------------------\n');
  console.log('      arm                    px      chroma(codes)   C*(CIELAB)   linear luma');
  for (const arm of [...ARMS, ...SWEEP_ARMS]) {
    const m = measured.get(arm.key).ownDecile;
    console.log(
      `      ${arm.label.padEnd(22)} ${String(m.n).padStart(6)}   ` +
      `${m.codes.toFixed(4).padStart(10)}   ${m.lab.toFixed(4).padStart(10)}   ${m.luma.toExponential(3)}`
    );
  }

  const deltaCodes = (a, b) => measured.get(a).ownDecile.codes - measured.get(b).ownDecile.codes;

  const gainShipped = deltaCodes('glint', 'base');
  const gainNoFake = deltaCodes('glint-nofake', 'base-nofake');
  const gainWithTrt = deltaCodes('glint-rtrt', 'base-rtrt');
  const gainWithoutTrt = deltaCodes('glint-r', 'base-r');
  const gainDecoy = deltaCodes('decoy', 'base');

  // THE DRIFT CONTROL, read before the gates. `base` and `base-rtrt` are the same configuration
  // captured twice (see the note on the arm), so their difference is the run's own noise floor. A
  // gate delta smaller than this floor is not a measurement, and reporting it as one is how a
  // harness produces a confident number about nothing.
  const driftCodes = Math.abs(
    measured.get('base').ownDecile.codes - measured.get('base-rtrt').ownDecile.codes
  );
  console.log(
    `\n      DRIFT     the same configuration captured twice differs by ${driftCodes.toFixed(4)} codes ` +
    `— this is the floor every delta below must clear to mean anything`
  );

  console.log('\n  --- the registered gates -------------------------------------------------\n');

  // THE DECOY FIRST. If it moves, nothing below means anything, so it is read before the gates
  // rather than after them — a void measurement reported alongside three verdicts reads as one
  // caveat among four findings, which `a-caveat-written-is-not-a-caveat-closed` is exactly about.
  const decoyRatio = gainShipped === 0 ? Infinity : Math.abs(gainDecoy / gainShipped);
  const decoyVoid = decoyRatio > 0.5;

  console.log(
    `      DECOY     on-axis gain ${gainShipped.toFixed(4)} codes, behind-the-head gain ` +
    `${gainDecoy.toFixed(4)} codes — ratio ${decoyRatio.toFixed(3)}  ` +
    `${decoyVoid ? '🔴 VOID: the statistic is reading brightness' : '✅ the statistic tracks geometry'}`
  );

  if (decoyVoid) {
    console.log('\n  🔴 THE MEASUREMENT IS VOID. D_TRT at azimuth 180 is 2.1357e-15, so an arm placed');
    console.log('     there cannot light the lobe under test. A statistic that moves anyway is not');
    console.log('     measuring the lobe. Fix the statistic and RE-REGISTER; do not read the gates.\n');
    return 1;
  }

  const attribution = gainWithoutTrt === 0
    ? (gainWithTrt === 0 ? 0 : Infinity)
    : gainWithTrt / gainWithoutTrt;
  const attributionPass = attribution >= 2;

  console.log(
    `      GATE 1    attribution: gain with TRT ${gainWithTrt.toFixed(4)} against gain without ` +
    `${gainWithoutTrt.toFixed(4)} — ${Number.isFinite(attribution) ? `${attribution.toFixed(3)}x` : 'infinite'}, ` +
    `registered floor 2.0x  ${attributionPass ? '✅ PASS' : '❌ FAIL'}`
  );

  const visibilityPass = gainShipped >= 1.0;
  console.log(
    `      GATE 2    visibility: ${gainShipped.toFixed(4)} codes of top-decile chroma, registered ` +
    `floor 1.0  ${visibilityPass ? '✅ PASS' : '❌ FAIL'}`
  );

  console.log(
    `      GATE 3    cost: the nine-scene table, skin, eye and G2 — NOT MEASURED BY THIS TOOL. ` +
    `Run the scene gates; the registration expects this to be the binding one.`
  );

  console.log('\n  --- what the fake is worth, which is the thing that voided the last attempt --\n');
  console.log(
    `      with slide 39's fake ON  the glint buys ${gainShipped.toFixed(4)} codes of chroma\n` +
    `      with it OFF              the glint buys ${gainNoFake.toFixed(4)} codes of chroma`
  );

  // 🔴 STATED AS A SHARE, NOT A RATIO. An earlier version printed `gainShipped / gainNoFake` and
  // read "the fake does not suppress it" for anything above 1 — technically true and it buries the
  // finding, because the interesting case is not suppression, it is CARRIAGE. The share below is
  // how much of the glint's whole chroma gain disappears when slide 39's fake is taken away, which
  // is the quantity `LightingRig.js` predicted at 65.4%.
  const carriedByFake = gainShipped === 0 ? 0 : 1 - (gainNoFake / gainShipped);
  console.log(
    `      so slide 39's FAKE CARRIES ${(carriedByFake * 100).toFixed(1)}% of the glint's chroma gain ` +
    `— LightingRig.js predicted 65.4% for a near-axis light and named it the reason the last ` +
    `attempt could not be trusted`
  );

  // 🎯 THE FAIR CHALLENGE TO THIS FILE'S OWN STATISTIC, ANSWERED RATHER THAN LEFT OPEN.
  //
  // The gates read a TOP DECILE, and TRT is a narrow retroreflective band — so the obvious
  // objection is that the lobe fires somewhere the decile does not look. That objection cannot be
  // answered by moving the statistic, because the statistic is pre-registered and moving it after
  // the data is in is the renegotiation the registration forbids. It CAN be answered by an extra
  // measurement reported separately, which is what this is: TRT's per-pixel chroma contribution
  // over the WHOLE gated mask, as the difference between the `r,trt` and `r` arms with the glint on.
  //
  // If even the best single pixel in the groom cannot reach one code value, the decile was never
  // the limit.
  console.log('\n  --- where TRT actually lands, over the whole mask (a DIAGNOSTIC, not a gate) ---\n');

  const withTrt = readPlate(path.join(out, 'glint-rtrt.png'));
  const noTrt = readPlate(path.join(out, 'glint-r.png'));
  let seen = 0;
  let best = 0;
  let total = 0;
  let overFloor = 0;

  for (const k of pixels) {
    const a = codesAt(withTrt, k * 4);
    const b = codesAt(noTrt, k * 4);
    if (isInvertible(a) === false || isInvertible(b) === false) continue;
    const delta = chromaInCodes(...a) - chromaInCodes(...b);
    seen += 1;
    total += delta;
    if (delta > best) best = delta;
    if (delta >= 1.0) overFloor += 1;
  }

  console.log(
    `      over ${seen.toLocaleString()} px: mean ${(total / seen).toFixed(5)} codes, ` +
    `best single pixel ${best.toFixed(5)}, ` +
    `${overFloor.toLocaleString()} px (${((overFloor / seen) * 100).toFixed(4)}%) reach the 1.0-code floor`
  );

  console.log('\n  --- brightness, reported and deciding NOTHING -----------------------------\n');
  const lumaRise = measured.get('glint').mass.luma / measured.get('base').mass.luma;
  console.log(
    `      the groom's mass mean luma moves ${((lumaRise - 1) * 100).toFixed(2)}% ` +
    `(R26 measured 12.9% for a near-axis KEY, which is a far larger light).`
  );
  console.log('      This is NOT a ship criterion. The registration says so and it is repeated');
  console.log('      here because a number in a report is quoted whether or not it was a gate.\n');

  return (attributionPass && visibilityPass) ? 0 : 2;
}

// --- selftest ------------------------------------------------------------------------------

function selftest() {
  let failures = 0;
  const check = (ok, label, detail) => {
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}`);
    if (detail) console.log(`      ${detail}`);
    if (ok === false) failures += 1;
  };

  // The chroma statistic must be blind to brightness, which is the entire reason it replaced luma.
  const greyDark = chromaInCodes(10, 10, 10);
  const greyBright = chromaInCodes(240, 240, 240);
  check(greyDark === 0 && greyBright === 0,
    'chromaInCodes is zero for grey at both ends of the range',
    `dark ${greyDark}, bright ${greyBright} — a statistic that moved here would read brightness`);

  const labDark = cielabChroma(10 / 255, 10 / 255, 10 / 255);
  const labBright = cielabChroma(240 / 255, 240 / 255, 240 / 255);
  check(labDark < 1e-4 && labBright < 1e-4,
    'cielabChroma is zero for grey at both ends of the range',
    `dark ${labDark.toExponential(2)}, bright ${labBright.toExponential(2)}`);

  // sRGB red's C* is a published value; reproducing it is the control on the Lab conversion.
  const red = cielabChroma(1, 0, 0);
  check(Math.abs(red - 104.55) < 0.1,
    'cielabChroma reproduces sRGB red\'s published C*',
    `${red.toFixed(3)} against 104.55 — the whole Lab path is wrong if this is wrong`);

  // The registered floor must sit above a single-channel code step, or it is not a floor.
  const oneStep = chromaInCodes(129, 128, 128);
  check(oneStep < 1.0,
    'the registered 1.0-code floor is ABOVE a one-channel quantisation step',
    `a single code of departure measures ${oneStep.toFixed(4)}, so the floor is conservative rather than under it`);

  // 🚩 THE POSITIVE CONTROL. A statistic nobody has seen respond is a statistic nobody can trust —
  // `hair-lightpath.mjs` records a whole round spent discovering its shape statistic had no arm
  // that produced a band for it to find. Here the answer is arithmetic: a warm tint on a grey ramp
  // must raise both chroma readings monotonically with the tint.
  const ramp = [];
  for (let tint = 0; tint <= 40; tint += 10) {
    ramp.push({ tint, codes: chromaInCodes(128 + tint, 128, 128 - tint) });
  }
  const monotone = ramp.every((row, i) => i === 0 || row.codes > ramp[i - 1].codes);
  check(monotone,
    'a warm tint on a mid grey raises chroma monotonically',
    ramp.map((r) => `+${r.tint}:${r.codes.toFixed(2)}`).join('  '));

  // The decile cut must select the BRIGHT end. An off-by-one that took the dark decile would
  // produce a plausible table of numbers about entirely the wrong pixels.
  // `png.mjs` decodes to FLOATS in 0..1 on `pixels`, and `codesAt` multiplies by 255. Building the
  // fixture as bytes on `data` is the shape a reader assumes and it is the wrong one — it threw
  // here rather than producing quiet nonsense, which is the good outcome.
  const png = { pixels: new Float32Array(4 * 100), width: 10, height: 10 };
  for (let i = 0; i < 100; i += 1) {
    const v = (i < 90 ? 20 : 200) / 255;  // 90 dark, 10 bright
    png.pixels[i * 4] = v; png.pixels[i * 4 + 1] = v; png.pixels[i * 4 + 2] = v; png.pixels[i * 4 + 3] = 1;
  }
  const all = Array.from({ length: 100 }, (_, i) => i);
  const stat = highlightChroma(png, all);
  const decileIsBright = stat.ownDecile.n === 10
    && stat.ownDecile.luma > stat.mass.luma;
  check(decileIsBright,
    'the top decile selects the BRIGHT pixels, not the dark ones',
    `decile n=${stat.ownDecile.n} at luma ${stat.ownDecile.luma.toExponential(3)} against the mass' ${stat.mass.luma.toExponential(3)}`);

  console.log(`\n${failures === 0 ? 'PASS' : 'FAIL'}: ${6 - failures}/6 checks green`);
  return failures;
}

// --- entry ---------------------------------------------------------------------------------

const args = process.argv.slice(2);
const flag = (name, fallback = null) => {
  const i = args.indexOf(name);
  return i === -1 ? fallback : args[i + 1];
};

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  const out = path.resolve(flag('--out', path.join(REPO, 'captures', 'hair-r32-glint')));
  const port = flag('--port', '5176');

  if (args.includes('--selftest')) process.exit(selftest() === 0 ? 0 : 1);
  else if (args.includes('--masks')) await captureMasks(port, out);
  else if (args.includes('--arms')) await captureArms(port, out);
  else if (args.includes('--report')) process.exit(report(out));
  else console.log('pass --selftest | --masks | --arms | --report');
}
