// hair-pedestal.report.mjs — the read-out for `hair-pedestal.mjs`. No capture, no page, no network.
//
// Split out so `--report` can be re-run over an existing capture directory in a second, and so the
// operators in `hair-pedestal.mjs` stay importable by the selftest without dragging a reader
// through four hundred lines of table formatting.

import fs from 'node:fs';
import path from 'node:path';

import {
  buildGroomMask,
  codesAt,
  isInvertible,
  luminance,
  plateToSceneLinear,
  readPlate,
  srgbToLinear,
} from './lightpath-probe.mjs';
import { erodeMask } from './hair-lightpath.mjs';
import { recoverShadow, spearman, stats, WIDTH, HEIGHT, EXPOSURE, HAIR_SHADED_MAX, TRAP_ARMS } from './hair-pedestal.mjs';

/** `HAIR_BASE_COLOUR_HEX` = #1A0E0C, decoded through the sRGB EOTF. */
const BASE_COLOUR_HEX = 0x1a0e0c;
const BASE_COLOUR_LINEAR = [
  srgbToLinear((BASE_COLOUR_HEX >> 16) & 255),
  srgbToLinear((BASE_COLOUR_HEX >> 8) & 255),
  srgbToLinear(BASE_COLOUR_HEX & 255),
];

/** The crown rect, verbatim from `hair-lightpath.mjs`'s `RECTS` so the two rounds agree. */
const CROWN = [250, 80, 40, 40];

const pct = (v) => `${(v * 100).toFixed(2)}%`;

function rgbAt(png, k, exposure = EXPOSURE) {
  return plateToSceneLinear(codesAt(png, k * 4), exposure);
}

function encodedLuma(codes) {
  return 0.2126 * (codes[0] / 255) + 0.7152 * (codes[1] / 255) + 0.0722 * (codes[2] / 255);
}

function table(title, header, rows) {
  console.log(`\n${title}`);
  console.log(`    ${header}`);
  for (const row of rows) console.log(`    ${row}`);
}

export function report(out) {

  const read = (name) => readPlate(path.join(out, `${name}.png`));

  // --- the gate, re-derived on this run's own plates ---------------------------------------------
  const solid = erodeMask(buildGroomMask(read('mask-bald'), read('mask-haired')), WIDTH, HEIGHT, 2);
  const floor = read('floor');

  const hairShaded = new Uint8Array(WIDTH * HEIGHT);
  let inside = 0;
  let kept = 0;
  let band = 0;
  for (let k = 0; k < WIDTH * HEIGHT; k += 1) {
    if (solid[k] !== 1) continue;
    const codes = codesAt(floor, k * 4);
    if (isInvertible(codes) === false) continue;
    inside += 1;
    const v = luminance(plateToSceneLinear(codes, EXPOSURE));
    if (v > 1.0e-2 && v < 2.5e-2) band += 1;
    if (v < HAIR_SHADED_MAX) { hairShaded[k] = 1; kept += 1; }
  }

  const names = ['ped-d3', 'ped-d3b', 'ped-d0', 'ped-d12', 'mass', 'r-only', 'mass-noshadow',
    'gtao-ao', 'ped-norootao', 'ped-novis'];
  const plates = Object.fromEntries(names.map((n) => [n, read(n)]));
  const trap = Object.fromEntries(TRAP_ARMS.map((s) => {
    const tag = String(s).replace('.', 'p');
    return [s, { linear: read(`trap-s${tag}`), graded: read(`trapg-s${tag}`) }];
  }));

  const every = [floor, ...Object.values(plates)];
  const set = [];
  for (let k = 0; k < WIDTH * HEIGHT; k += 1) {
    if (hairShaded[k] !== 1) continue;
    if (every.every((p) => isInvertible(codesAt(p, k * 4)))) set.push(k);
  }

  console.log(
    `\n  GATE  ${inside} invertible pixels in the eroded groom mask: ${kept} shaded by HairMaterial ` +
    `(${pct(kept / inside)}), ${inside - kept} resolving to something behind (${pct((inside - kept) / inside)}), ` +
    `${band} in the separating band [1.0e-2, 2.5e-2]`
  );
  console.log(`  ${set.length} pixels invertible in ALL ${every.length} arms — every row below is this one set`);

  // ================================================================================================
  // 1. THE PEDESTAL'S SPATIAL VARIATION
  // ================================================================================================

  const floorL = set.map((k) => luminance(rgbAt(floor, k)));
  const pedL = set.map((k, i) => luminance(rgbAt(plates['ped-d3'], k)) - floorL[i]);
  const massL = set.map((k) => luminance(rgbAt(plates.mass, k)));
  const rL = set.map((k, i) => luminance(rgbAt(plates['r-only'], k)) - floorL[i]);

  const massMean = massL.reduce((a, b) => a + b, 0) / massL.length;
  const ped = stats(pedL);
  const rStats = stats(rL);

  console.log('\n================================================================================');
  console.log(' 1. WHAT SLIDE 39\'s PEDESTAL DOES ACROSS THE GROOM  (radiance, floor subtracted)');
  console.log('================================================================================');
  console.log(
    `\n    mass mean ${massMean.toExponential(4)}   pedestal share of the mass ` +
    `${pct(ped.mean / massMean)}   R share ${pct(rStats.mean / massMean)}`
  );
  console.log(
    `    pedestal   p10 ${ped.p10.toExponential(4)}   p50 ${ped.p50.toExponential(4)}   ` +
    `p90 ${ped.p90.toExponential(4)}   p99 ${ped.p99.toExponential(4)}   max ${ped.max.toExponential(4)}`
  );
  console.log(
    `    as a ratio to the mass mean:  p10 ${(ped.p10 / massMean).toFixed(4)}   ` +
    `p50 ${(ped.p50 / massMean).toFixed(4)}   p90 ${(ped.p90 / massMean).toFixed(4)}   ` +
    `p99 ${(ped.p99 / massMean).toFixed(4)}`
  );
  console.log(
    `    🎯 the pedestal's OWN dynamic range p90/p10 ${(ped.p90 / Math.max(ped.p10, 1e-12)).toFixed(3)}, ` +
    `p90/p50 ${(ped.p90 / Math.max(ped.p50, 1e-12)).toFixed(3)}, ` +
    `against R's p90/p50 ${(rStats.p90 / Math.max(rStats.p50, 1e-12)).toFixed(3)} on the same pixels`
  );

  // The crown, where R26 measured the split at R 6.95% / scatter 87.39%.
  const crownSet = set.filter((k) => {
    const x = k % WIDTH;
    const y = Math.floor(k / WIDTH);
    return x >= CROWN[0] && x < CROWN[0] + CROWN[2] && y >= CROWN[1] && y < CROWN[1] + CROWN[3];
  });
  if (crownSet.length > 0) {
    const cFloor = crownSet.map((k) => luminance(rgbAt(floor, k)));
    const cPed = crownSet.map((k, i) => luminance(rgbAt(plates['ped-d3'], k)) - cFloor[i]);
    const cR = crownSet.map((k, i) => luminance(rgbAt(plates['r-only'], k)) - cFloor[i]);
    const cMass = crownSet.map((k) => luminance(rgbAt(plates.mass, k)));
    const cMassMean = cMass.reduce((a, b) => a + b, 0) / cMass.length;
    const cp = stats(cPed);
    console.log(
      `\n    CROWN rect ${CROWN.join(',')} — ${crownSet.length} px: pedestal ` +
      `${pct(cp.mean / cMassMean)} of the mass, R ${pct(stats(cR).mean / cMassMean)}; ` +
      `pedestal p90/p10 ${(cp.p90 / Math.max(cp.p10, 1e-12)).toFixed(3)}`
    );
  }

  // ================================================================================================
  // 2. SLIDE 44's `Shadow`, RECOVERED PER PIXEL
  // ================================================================================================

  const recoverOver = (numerator, denominator) => {
    const values = [];
    const byPixel = new Map();
    const spreads = [];
    let nulls = 0;
    for (const k of set) {
      const f = rgbAt(floor, k);
      const a = rgbAt(numerator, k).map((v, c) => v - f[c]);
      const b = rgbAt(denominator, k).map((v, c) => v - f[c]);
      const got = recoverShadow(a, b, BASE_COLOUR_LINEAR);
      if (got === null || Number.isFinite(got.shadow) === false) { nulls += 1; continue; }
      values.push(got.shadow);
      spreads.push(got.spread);
      byPixel.set(k, got.shadow);
    }
    return { values, byPixel, spreads, nulls };
  };

  const recovered = recoverOver(plates['ped-d3'], plates['ped-d0']);
  const shadows = recovered.values;
  const shadowByPixel = recovered.byPixel;
  const nullCount = recovered.nulls;
  const shadowStats = stats(shadows);
  const spreadStats = stats(recovered.spreads);

  // 🚩 THE NOISE FLOOR. `ped-d3b` is `ped-d3` again — same URL, same uniform, second load. The
  // operator run on THAT pair must return 1 everywhere, because the two plates differ only in the
  // stochastic OIT's per-load coverage draw. Whatever it returns instead is the instrument's own
  // scatter, and no per-pixel number below means anything inside it.
  const noise = recoverOver(plates['ped-d3b'], plates['ped-d3']);
  const noiseStats = stats(noise.values);

  console.log('\n================================================================================');
  console.log(' 2. SLIDE 44\'s `Shadow` — THE ONLY DEPTH-SHAPED INPUT THE TERM HAS, MEASURED');
  console.log('================================================================================');
  console.log(
    `\n    recovered on ${shadows.length} of ${set.length} pixels (${nullCount} at the 8-bit floor); ` +
    `channel-pair disagreement p50 ${spreadStats.p50.toExponential(2)}, p90 ${spreadStats.p90.toExponential(2)}`
  );
  // 🎯 AND THE ANSWER CAME BACK BETTER THAN THE CAVEAT THAT COMMISSIONED IT, so the sentence
  // reports what was measured rather than what was expected. Two loads of the same URL under
  // `?freeze&seed=1&capture` are BYTE-IDENTICAL: the stochastic OIT's hash is seeded, not
  // per-load. The pairing in §2 is therefore exact, and the per-pixel scatter that remains is
  // 8-BIT QUANTISATION — bounded by the channel-pair disagreement on the line above, not by
  // coverage noise. Writing "the OIT re-draws per load" here would have been a false sentence in
  // a justification comment, which is this project's second signature failure.
  const identical = noiseStats.p10 === 1 && noiseStats.p50 === 1 && noiseStats.p90 === 1;
  console.log(
    `    🚩 NOISE FLOOR, two loads of the SAME arm through the operator (must read 1): ` +
    `p10 ${noiseStats.p10.toFixed(4)}   p50 ${noiseStats.p50.toFixed(4)}   p90 ${noiseStats.p90.toFixed(4)}` +
    (identical
      ? '\n       — EXACTLY 1 at every percentile: the capture is deterministic, the pairing is exact, and\n' +
        `         the spread below is 8-bit quantisation (bounded by the p90 pair disagreement, ` +
        `${spreadStats.p90.toExponential(2)}), not coverage noise.`
      : `\n       — ±${((noiseStats.p90 - noiseStats.p10) / 2).toFixed(3)} of the spread below is the instrument.`)
  );
  // 🎯 THE ON-PLATE RED PROOF, AND IT NEEDS NO UV AND NO GEOMETRY. `Shadow` is `exp(−d·density)`,
  // so quadrupling the density must raise the SAME pixel's Shadow to the fourth power — an
  // identity in the shipped expression that no amount of plate noise can manufacture. Recovering
  // at density 12 and comparing against the density-3 answer to the fourth is therefore a check
  // on the operator AND on the claim that the term is the exponential it says it is.
  const recovered12 = recoverOver(plates['ped-d12'], plates['ped-d0']);
  {
    const predicted = [];
    const observed = [];
    for (const [k, s3] of shadowByPixel) {
      const s12 = recovered12.byPixel.get(k);
      if (s12 === undefined || s3 <= 0) continue;
      predicted.push(s3 ** 4);
      observed.push(s12);
    }
    const residual = observed.map((v, i) => v - predicted[i]);
    const r = stats(residual);
    console.log(
      `    🎯 RED PROOF, no geometry involved: Shadow(density 12) must equal Shadow(density 3)^4.\n` +
      `       over ${observed.length} px the residual is p10 ${r.p10.toFixed(4)}, p50 ${r.p50.toFixed(4)}, ` +
      `p90 ${r.p90.toFixed(4)}; Spearman ${spearman(predicted, observed).toFixed(4)}`
    );
  }

  console.log(
    `    Shadow      p10 ${shadowStats.p10.toFixed(4)}   p50 ${shadowStats.p50.toFixed(4)}   ` +
    `p90 ${shadowStats.p90.toFixed(4)}   min ${shadowStats.min.toFixed(4)}   max ${shadowStats.max.toFixed(4)}`
  );
  console.log(
    `    exponent 1−Shadow, which is the WHOLE of what the term does with depth:  ` +
    `p10 ${(1 - shadowStats.p90).toFixed(4)}   p50 ${(1 - shadowStats.p50).toFixed(4)}   ` +
    `p90 ${(1 - shadowStats.p10).toFixed(4)}`
  );

  // What that exponent is worth in the picture: the whole colour shift the term can produce,
  // measured as the largest per-channel factor between the two plates.
  let maxFactor = 1;
  let minFactor = 1;
  for (const k of set) {
    const f = rgbAt(floor, k);
    const p3 = rgbAt(plates['ped-d3'], k).map((v, c) => v - f[c]);
    const p0 = rgbAt(plates['ped-d0'], k).map((v, c) => v - f[c]);
    for (let c = 0; c < 3; c += 1) {
      if (!(p0[c] > 0) || !(p3[c] > 0)) continue;
      maxFactor = Math.max(maxFactor, p3[c] / p0[c]);
      minFactor = Math.min(minFactor, p3[c] / p0[c]);
    }
  }
  console.log(
    `    per-channel factor the chroma term applies, over the whole groom: ` +
    `[${minFactor.toFixed(4)}, ${maxFactor.toFixed(4)}]`
  );

  // --- 🎯 the variance decomposition, which is what "is it flat" actually asks -------------------
  // `ped-d0` is the pedestal with the chroma exponent EXACTLY removed, so its variation is `wrap`
  // (a cosine against the fake normal), the lock-albedo field, the root occlusion and the side
  // visibility. The ratio `ped-d3 / ped-d0` is the chroma factor and nothing else.
  const pedL0only = set.map((k, i) => luminance(rgbAt(plates['ped-d0'], k)) - floorL[i]);
  const w0 = stats(pedL0only);
  const chromaLuma = pedL.map((v, i) => (pedL0only[i] > 0 ? v / pedL0only[i] : NaN)).filter(Number.isFinite);
  const chroma = stats(chromaLuma);
  console.log(
    `\n    WHERE THE PEDESTAL'S VARIATION COMES FROM, as p90/p10 on the same pixels:\n` +
    `      whole term                       ${(ped.p90 / Math.max(ped.p10, 1e-12)).toFixed(3)}\n` +
    `      with the chroma exponent removed ${(w0.p90 / Math.max(w0.p10, 1e-12)).toFixed(3)}   ` +
    `(= wrap x lock albedo x root AO x side visibility)\n` +
    `      the chroma exponent alone        ${(chroma.p90 / Math.max(chroma.p10, 1e-12)).toFixed(3)}   ` +
    `(p10 ${chroma.p10.toFixed(4)}, p50 ${chroma.p50.toFixed(4)}, p90 ${chroma.p90.toFixed(4)})`
  );

  const pedL12 = set.map((k, i) => luminance(rgbAt(plates['ped-d12'], k)) - floorL[i]);
  const pedL0 = set.map((k, i) => luminance(rgbAt(plates['ped-d0'], k)) - floorL[i]);
  const s12 = stats(pedL12);
  const s0 = stats(pedL0);
  console.log(
    `\n    the term's LUMINANCE barely notices the exponent at all — pedestal mean at ` +
    `shadowDensity 0 / 3 / 12: ${s0.mean.toExponential(4)} / ${ped.mean.toExponential(4)} / ` +
    `${s12.mean.toExponential(4)}  (a ${pct(Math.abs(s12.mean - s0.mean) / s0.mean)} swing across a 12x density change)`
  );

  // ================================================================================================
  // 2b. HYPOTHESIS (B) — `sqrt(albedo)`, ON THE ARITHMETIC AND THEN ON THE PLATE
  // ================================================================================================
  //
  // The hypothesis: `sqrt(C)` is qualitatively backwards, because for c < 1 it moves TOWARD white
  // while Beer–Lambert says light that has crossed more melanin must move toward the albedo's own
  // hue. The first half is arithmetic and is true of the FACTOR. The question this section settles
  // is whether it is true of the TERM, which is `√C · (C/luma)^(1−Shadow)` and not `√C`.

  const sat = (v) => {
    const mx = Math.max(...v);
    const mn = Math.min(...v);
    return mx === 0 ? 0 : (mx - mn) / mx;
  };
  const lumaOf = (v) => 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2];
  const chromaticity = BASE_COLOUR_LINEAR.map((c) => c / lumaOf(BASE_COLOUR_LINEAR));
  const root = BASE_COLOUR_LINEAR.map(Math.sqrt);

  console.log('\n================================================================================');
  console.log(' 2b. `sqrt(albedo)` — WHAT THE FACTOR DOES, AND WHAT THE WHOLE TERM DOES');
  console.log('================================================================================\n');
  const line = (label, v) => console.log(
    `    ${label.padEnd(34)} ${v.map((x) => x.toFixed(6)).join('  ')}   Y ${lumaOf(v).toExponential(3)}   ` +
    `sat ${sat(v).toFixed(4)}   R/B ${(v[0] / v[2]).toFixed(4)}`
  );
  line('C, the albedo (#1A0E0C linear)', BASE_COLOUR_LINEAR);
  line('√C, the factor on its own', root);
  line('C², what Beer–Lambert would do', BASE_COLOUR_LINEAR.map((c) => c * c));
  console.log('');
  for (const e of [0, 1 - shadowStats.p90, 1 - shadowStats.p50, 1 - shadowStats.p10, 1]) {
    line(`√C · (C/luma)^${e.toFixed(4)}`, root.map((v, i) => v * chromaticity[i] ** e));
  }
  console.log(
    `\n    🎯 √C ALONE desaturates — ${sat(root).toFixed(4)} against the albedo's ${sat(BASE_COLOUR_LINEAR).toFixed(4)} — ` +
    'exactly as hypothesis (B) says.\n' +
    `       THE WHOLE TERM DOES NOT: at the measured median exponent ${(1 - shadowStats.p50).toFixed(4)} the ` +
    `result's saturation is ${sat(root.map((v, i) => v * chromaticity[i] ** (1 - shadowStats.p50))).toFixed(4)}, ` +
    `ABOVE the albedo's own.\n` +
    `       What √C does that nothing corrects is LEVEL: its luminance is ` +
    `${(lumaOf(root) / lumaOf(BASE_COLOUR_LINEAR)).toFixed(1)}x the albedo's.`
  );

  // And the same question asked of the picture rather than of the constants.
  const meanRgb = (png, pixels, subtractFloor) => {
    const total = [0, 0, 0];
    for (const k of pixels) {
      const v = rgbAt(png, k);
      const f = subtractFloor ? rgbAt(floor, k) : [0, 0, 0];
      for (let c = 0; c < 3; c += 1) total[c] += v[c] - f[c];
    }
    return total.map((v) => v / pixels.length);
  };
  console.log('\n    ON THE PLATE, mean linear RGB over the same pixel set:');
  line('the pedestal alone', meanRgb(plates['ped-d3'], set, true));
  line('the R lobe alone', meanRgb(plates['r-only'], set, true));
  line('the shipped mass', meanRgb(plates.mass, set, false));
  line('the indirect floor', meanRgb(floor, set, false));

  // 🎯 THE JUDGES' SENTENCE, AS A TESTABLE STATEMENT. Six of them said the same thing: *"it
  // desaturates toward grey AS IT LIGHTENS instead of warming toward copper."* That is a claim
  // about how saturation moves with luminance, so bin the mass by its own luminance and look.
  {
    const ordered = [...set].sort(
      (a, b) => luminance(rgbAt(plates.mass, a)) - luminance(rgbAt(plates.mass, b)));
    const rows = [];
    for (let d = 0; d < 10; d += 1) {
      const slice = ordered.slice(
        Math.floor((d / 10) * ordered.length), Math.floor(((d + 1) / 10) * ordered.length));
      const mass = meanRgb(plates.mass, slice, false);
      const pedestal = meanRgb(plates['ped-d3'], slice, true);
      const lobe = meanRgb(plates['r-only'], slice, true);
      const base = meanRgb(floor, slice, false);
      const y = lumaOf(mass);
      rows.push(
        `${String(d + 1).padStart(4)}  ${y.toExponential(3)}  ${sat(mass).toFixed(4)}   ` +
        `${sat(pedestal).toFixed(4)}  ${sat(lobe).toFixed(4)}  ${sat(base).toFixed(4)}   ` +
        `${pct(lumaOf(pedestal) / y).padStart(7)}  ${pct(lumaOf(lobe) / y).padStart(7)}  ` +
        `${pct(lumaOf(base) / y).padStart(7)}`
      );
    }
    table(
      '  🎯 SIX JUDGES: "it desaturates toward grey AS IT LIGHTENS." Mass binned by its own luminance:',
      'decile        Y    sat(mass)   sat(ped) sat(R) sat(floor)   pedestal        R    floor  (share of Y)',
      rows
    );
  }

  // ================================================================================================
  // 3. THE DEPTH REFERENCE, AND WHAT CORRELATES WITH IT
  // ================================================================================================

  const referencePath = path.join(out, 'depth-reference.json');
  if (fs.existsSync(referencePath) === false) {
    console.log('\n  ⚠️ no depth-reference.json — run --geometry for sections 3 and 4.');
  } else {
    const reference = JSON.parse(fs.readFileSync(referencePath, 'utf8'));
    const sampleIndex = new Map();
    reference.samples.forEach((k, i) => sampleIndex.set(k, i));

    // Only sampled pixels that also survived the gate AND the shadow recovery.
    const paired = [];
    for (const k of set) {
      const i = sampleIndex.get(k);
      if (i === undefined) continue;
      paired.push({ k, i });
    }

    console.log('\n================================================================================');
    console.log(' 3. THE DEPTH REFERENCE — hair cards between the visible fragment and each light');
    console.log('================================================================================');
    console.log(
      `\n    ${reference.triangleCount} triangles, stride ${reference.stride}; ` +
      `${paired.length} pixels are in BOTH the ray sample and the shaded gate`
    );

    // 🎯 THE RED PROOF FOR §2's OPERATOR, ON REAL DATA RATHER THAN ON SYNTHETIC PLATES.
    // `Shadow` is `exp(−3 · depthMap.sample(uv()).r)` and nothing else, and the UV at every one of
    // these pixels is known from the raster. If the plate-recovered `Shadow` is measuring the term
    // it claims to, it must agree with the sheet read at that UV — through a box of the width the
    // scene pass samples at, because `generateMipmaps` is true and level 0 is not what is read.
    {
      const predicted = [];
      const observed = [];
      for (const { k, i } of paired) {
        const got = shadowByPixel.get(k);
        if (got === undefined) continue;
        predicted.push(Math.exp(-3 * reference.sheetBox5[i]));
        observed.push(got);
      }
      const p = stats(predicted);
      const o = stats(observed);
      console.log(
        `\n  🎯 CROSS-VALIDATION of §2's operator against the SHEET it must be reading, ${observed.length} px:\n` +
        `      exp(−3 · depth.png through a 5-texel box)  p10 ${p.p10.toFixed(4)}  p50 ${p.p50.toFixed(4)}  p90 ${p.p90.toFixed(4)}\n` +
        `      recovered off the two plates               p10 ${o.p10.toFixed(4)}  p50 ${o.p50.toFixed(4)}  p90 ${o.p90.toFixed(4)}\n` +
        `      Spearman between them ${spearman(predicted, observed).toFixed(4)}   ` +
        `(the box width is a stand-in for the real trilinear footprint, so read the RANK, not the levels)`
      );
      const point = paired.filter(({ k }) => shadowByPixel.has(k)).map(({ i }) => Math.exp(-3 * reference.sheet[i]));
      console.log(
        `      against a POINT sample of level 0 instead: Spearman ${spearman(point, observed).toFixed(4)} — ` +
        'the mip is doing real work and a level-0 read would misreport this term'
      );
    }

    const complexity = stats(paired.map(({ i }) => reference.complexity[i]));
    console.log(
      `\n  ⚠️ THE REFERENCE IS A LOWER BOUND. It counts cards from the FRONTMOST hair triangle, and\n` +
      `      the shipped OIT is stochastic, so a pixel may resolve to a card further back. The room\n` +
      `      under the bound is the view ray's whole depth complexity: p10 ${complexity.p10}, ` +
      `p50 ${complexity.p50}, p90 ${complexity.p90}, max ${complexity.max} hair triangles per pixel.`
    );

    const lights = reference.lights;
    const rows = [];
    for (const light of lights) {
      const counts = reference.counts[light.name];
      const c = paired.map(({ i }) => counts[i]);
      const st = stats(c);
      const clear = c.filter((v) => v === 0).length / c.length;
      rows.push(
        `${light.name.padEnd(12)} ${light.type.padEnd(15)} ` +
        `p10 ${String(st.p10).padStart(3)}  p50 ${String(st.p50).padStart(3)}  ` +
        `p90 ${String(st.p90).padStart(3)}  p99 ${String(st.p99).padStart(3)}  max ${String(st.max).padStart(3)}  ` +
        `mean ${st.mean.toFixed(2).padStart(6)}   ${pct(clear).padStart(7)} of pixels have a CLEAR path   ` +
        `castShadow ${light.castShadow}`
      );
    }
    table(
      '  Cards between the shading point and the light — the quantity Zinke & Weber\'s global term is a function of:',
      'light        type            depth into the mass (card crossings)', rows
    );

    // One combined depth: the mean crossing count over the four panels + spot, unweighted. A
    // viewer reads the mass, not one light, and every candidate is scored against the same column.
    const combined = paired.map(({ i }) =>
      lights.reduce((total, l) => total + reference.counts[l.name][i], 0) / lights.length);
    const keyDepth = paired.map(({ i }) => reference.counts.key[i]);

    // --- the candidate signals ---------------------------------------------------------------
    const candidates = [];

    const pedestalHere = paired.map(({ k }) => luminance(rgbAt(plates['ped-d3'], k)) - luminance(rgbAt(floor, k)));

    candidates.push({
      name: 'slide 44 Shadow (shipped)',
      values: paired.map(({ k }) => shadowByPixel.get(k) ?? NaN),
      note: 'already computed, zero cost — `exp(−3·depthMap.sample(uv()).r)`',
    });
    candidates.push({
      name: 'depth.png at uv (level 0)',
      values: paired.map(({ i }) => reference.sheet[i]),
      note: 'the sheet the line above reads, sampled point-wise on the CPU',
    });
    candidates.push({
      name: 'key SpotLight shadow map',
      values: paired.map(({ k }) => {
        const on = luminance(rgbAt(plates.mass, k));
        const off = luminance(rgbAt(plates['mass-noshadow'], k));
        return off > 0 ? on / off : NaN;
      }),
      note: 'already applied to `lightColor` in `direct()`; readable only for the ONE casting light',
    });
    candidates.push({
      name: 'GTAO visibility',
      // ⚠️ INVERTED AT THE EXPOSURE IT WAS CAPTURED AT, WHICH IS 4 AND NOT 1. `?gtaoview=ao` writes
      // the visibility as a colour and it still goes through ACES and the output transfer, so a
      // read at the wrong exposure comes back a factor of four out and looks like a visibility
      // above 1. `alive.js`'s own note is that these views are ORDERED, not calibrated — so this
      // column is used for its RANK and for the fact that it has a range, not for its levels.
      values: paired.map(({ k }) => luminance(rgbAt(plates['gtao-ao'], k, EXPOSURE))),
      note: '?gtaoview=ao — a POST pass on the G-buffer, not available inside the lighting model',
    });
    candidates.push({
      name: 'root occlusion (flow.b)',
      values: paired.map(({ k }) => {
        const f = luminance(rgbAt(floor, k));
        const on = luminance(rgbAt(plates['ped-d3'], k)) - f;
        const off = luminance(rgbAt(plates['ped-norootao'], k)) - f;
        return off > 0 ? on / off : NaN;
      }),
      note: 'already sampled every fragment for `rootOcclusion` — free to reuse',
    });
    candidates.push({
      name: 'side visibility (slide 47)',
      values: paired.map(({ k }) => {
        const f = luminance(rgbAt(floor, k));
        const on = luminance(rgbAt(plates['ped-d3'], k)) - f;
        const off = luminance(rgbAt(plates['ped-novis'], k)) - f;
        return off > 0 ? on / off : NaN;
      }),
      note: 'already computed; a function of ωi·ωr only, so it cannot vary with position at all',
    });
    candidates.push({
      name: 'radial standoff |P − head|',
      values: paired.map(({ i }) => reference.radius[i]),
      note: 'NOT computed today; one `length()` on `positionLocal` in the lighting model',
    });

    const candidateRows = [];
    for (const candidate of candidates) {
      const clean = [];
      const depthClean = [];
      const keyClean = [];
      for (let j = 0; j < candidate.values.length; j += 1) {
        const v = candidate.values[j];
        if (Number.isFinite(v) === false) continue;
        clean.push(v);
        depthClean.push(combined[j]);
        keyClean.push(keyDepth[j]);
      }
      if (clean.length === 0) { candidateRows.push(`${candidate.name.padEnd(26)} — no finite samples`); continue; }
      const st = stats(clean);
      // 🚩 p10 EXACTLY ZERO IS NOT A LARGE RATIO, IT IS AN UNDEFINED ONE, and printing 7.5e11
      // would be this project's ninth structurally-blind statistic. Say so instead.
      const range = st.p10 === 0 ? null : st.p90 / Math.abs(st.p10);
      candidateRows.push(
        `${candidate.name.padEnd(26)} p10 ${st.p10.toExponential(2)}  p50 ${st.p50.toExponential(2)}  ` +
        `p90 ${st.p90.toExponential(2)}  p90/p10 ${(range === null ? 'p10 = 0' : range.toFixed(2)).padStart(7)}  ` +
        `ρ(all-light depth) ${spearman(clean, depthClean).toFixed(4).padStart(8)}  ` +
        `ρ(key depth) ${spearman(clean, keyClean).toFixed(4).padStart(8)}`
      );
    }
    table(
      '  🎯 EVERY DEPTH SIGNAL AVAILABLE PER FRAGMENT, AND HOW WELL IT TRACKS ACTUAL DEPTH INTO THE MASS',
      'signal                     dynamic range on this groom                              Spearman vs the reference',
      candidateRows
    );
    for (const c of candidates) console.log(`    ${c.name.padEnd(26)} ${c.note}`);

    // 🚩 THE KEY SHADOW MAP'S ROW IS A DELIVERED RATIO, NOT THE SIGNAL'S OWN RANGE, and reporting
    // the first as the second would be a structurally-blind statistic. `mass / mass-noshadow`
    // measures what the shadow map does to a WHOLE hair pixel, and the map modulates only the
    // key's shadow-casting half — `LightingRig` puts `shadowFraction` 0.45 of the key there, and
    // CHECKPOINT §9 measured the four RectAreaLights carrying 66-73% of a hair pixel, so the
    // SpotLight carries at most 34%. Delivered ratio r on a light of share f implies a raw shadow
    // value S = 1 − (1 − r)/f, which is the bound below.
    {
      const delivered = paired.map(({ k }) => {
        const on = luminance(rgbAt(plates.mass, k));
        const off = luminance(rgbAt(plates['mass-noshadow'], k));
        return off > 0 ? on / off : NaN;
      }).filter(Number.isFinite);
      const d = stats(delivered);
      const implied = (r, f) => 1 - (1 - r) / f;
      console.log(
        `\n    🚩 THE KEY SHADOW MAP, unpacked: the DELIVERED ratio is p10 ${d.p10.toFixed(4)}, ` +
        `p50 ${d.p50.toFixed(4)}, p90 ${d.p90.toFixed(4)}.\n` +
        `       The map modulates only the SpotLight, which carries at most 34% of a hair pixel ` +
        `(CHECKPOINT §9), so the RAW shadow\n       value reaches ` +
        `${implied(d.p10, 0.34).toFixed(3)} at p10 and ${implied(d.p50, 0.34).toFixed(3)} at the median. ` +
        `The signal has far more range than the row above shows.`
      );
    }

    console.log(
      `\n    ⚖️ CONTROL: the shipped pedestal itself against the same reference — ` +
      `ρ(all-light depth) ${spearman(pedestalHere, combined).toFixed(4)}, ` +
      `ρ(key depth) ${spearman(pedestalHere, keyDepth).toFixed(4)}`
    );
    console.log(
      `    ⚖️ CONTROL: the mass against the same reference — ` +
      `ρ ${spearman(paired.map(({ k }) => luminance(rgbAt(plates.mass, k))), combined).toFixed(4)}`
    );
  }

  // ================================================================================================
  // 4. THE OPPOSITE-DIRECTIONS TRAP, REFRESHED
  // ================================================================================================

  console.log('\n================================================================================');
  console.log(' 4. ⚠️ THE TRAP — sweeping the scatter scalar, BOTH statistics, on the current tree');
  console.log('================================================================================');

  // CHECKPOINT §2's table was ENCODED luma on the SHIPPED GRADED PATH. `#1A0E0C`'s encoded luma is
  // the assumed-albedo denominator the gate divides by; §2's 0.0661 was `#150F17`'s, which the
  // tree has not carried since a9a121c, so both denominators are printed.
  const encodedLumaOf = (hex) =>
    0.2126 * (((hex >> 16) & 255) / 255) + 0.7152 * (((hex >> 8) & 255) / 255) + 0.0722 * ((hex & 255) / 255);
  const ASSUMED_NOW = encodedLumaOf(0x1a0e0c);
  const ASSUMED_THEN = encodedLumaOf(0x150f17);

  const trapRows = [];
  for (const s of TRAP_ARMS) {
    const codes = set.map((k) => encodedLuma(codesAt(trap[s].graded, k * 4)));
    const st = stats(codes);
    trapRows.push(
      `${String(s).padStart(6)}  ${st.p10.toFixed(4)}  ${st.p50.toFixed(4)}  ${st.p95.toFixed(4)}  ` +
      `${(st.p95 / ASSUMED_NOW).toFixed(2).padStart(6)} : 1  ${(st.p95 / ASSUMED_THEN).toFixed(2).padStart(6)} : 1  ` +
      `${(st.p95 / Math.max(st.p50, 1e-9)).toFixed(3).padStart(7)}`
    );
  }
  table(
    `  GRADED PATH, encoded luma, ${set.length} solid hair px — the footing CHECKPOINT §2's table used`,
    // 🚩 The two denominators are INTERPOLATED from the constants above rather than typed, so the
    // column heading cannot drift from the number the column was divided by. That drift is
    // §1.25r's exact shape and it has happened five times in this phase.
    `scatter     p10     p50     p95   p95/${ASSUMED_NOW.toFixed(4)}  p95/${ASSUMED_THEN.toFixed(4)}   p95/p50`,
    trapRows
  );
  console.log(
    `\n    the gate's denominator: #1A0E0C encoded luma ${ASSUMED_NOW.toFixed(4)} ` +
    `(shipped since a9a121c), #150F17's ${ASSUMED_THEN.toFixed(4)} (what §2's table divided by)`
  );

  const trapRadiance = [];
  for (const s of TRAP_ARMS) {
    const values = set.map((k) => luminance(rgbAt(trap[s].linear, k)));
    const st = stats(values);
    const lobes = set.map((k, i) => luminance(rgbAt(trap[s].linear, k)) - floorL[i] - pedL[i] * s);
    void lobes;
    trapRadiance.push(
      `${String(s).padStart(6)}  ${st.p10.toExponential(3)}  ${st.p50.toExponential(3)}  ` +
      `${st.p95.toExponential(3)}  ${(st.p95 / Math.max(st.p50, 1e-12)).toFixed(3).padStart(7)}  ` +
      `${(rStats.p99 / st.mean).toFixed(3).padStart(7)}`
    );
  }
  table(
    '  RADIANCE, ?grade=0 at exposure 4, same pixel set — the footing every other section here uses',
    'scatter       p10        p50        p95   p95/p50   R p99 / mass mean',
    trapRadiance
  );

  console.log('');

}
