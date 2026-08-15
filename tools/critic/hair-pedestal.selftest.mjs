#!/usr/bin/env node
//
// hair-pedestal.selftest.mjs — every operator in `hair-pedestal.mjs` against an answer that is
// arithmetic, before it is pointed at a plate.
//
// This project's first signature failure is EIGHT structurally-blind statistics, the most recent
// found in the round that wrote it. The rule that catches them is: construct a field whose answer
// is known on paper, and include at least one field the operator is SUPPOSED to reject.
//
//   node tools/critic/hair-pedestal.selftest.mjs
//   node tools/critic/hair-pedestal.mjs --selftest

import { recoverShadow, spearman, rayTriangle, stats } from './hair-pedestal.mjs';

let failures = 0;
let checks = 0;

function ok(name, condition, detail = '') {
  checks += 1;
  if (condition) {
    console.log(`  ✅ ${name}${detail === '' ? '' : `   ${detail}`}`);
  } else {
    failures += 1;
    console.log(`  🔴 ${name}${detail === '' ? '' : `   ${detail}`}`);
  }
}

function close(a, b, tolerance) {
  return Math.abs(a - b) <= tolerance;
}

/**
 * The shipped base colour, `#1A0E0C` decoded through the sRGB EOTF. Any positive multiple of it
 * must give the same recovered Shadow, and clause 3 is that statement.
 */
const C = [
  ((26 / 255 + 0.055) / 1.055) ** 2.4,
  ((14 / 255 + 0.055) / 1.055) ** 2.4,
  ((12 / 255 + 0.055) / 1.055) ** 2.4,
];

/** The term as `HairMaterial.js:2294-2299` writes it, on the CPU, for a synthetic pixel. */
function pedestal(colour, shadow, lightColour, channelIndependent) {
  const luma = 0.2126 * colour[0] + 0.7152 * colour[1] + 0.0722 * colour[2];
  return colour.map((c, i) =>
    Math.sqrt(c) * ((c / luma) ** (1 - shadow)) * lightColour[i] * channelIndependent);
}

export function selftest() {

  console.log('\n=== recoverShadow — the exact operator, against a Shadow known by construction\n');

  // 1. The identity. Shadow = 1 makes the exponent 0, so P3 and P0 are the same plate.
  {
    const p0 = pedestal(C, 1, [1, 1, 1], 1);
    const got = recoverShadow(p0, p0, C);
    ok('Shadow 1 recovers as 1 from two identical plates',
      close(got.shadow, 1, 1e-9), `got ${got.shadow.toFixed(12)}`);
  }

  // 2. The real case. A known Shadow, the same P0 the probe captures, and NO other factor equal.
  for (const shadow of [0.0, 0.05, 0.2233, 0.5, 0.9, 0.99]) {
    const p0 = pedestal(C, 1, [1, 1, 1], 1);
    const p3 = pedestal(C, shadow, [1, 1, 1], 1);
    const got = recoverShadow(p3, p0, C);
    ok(`Shadow ${shadow} recovered exactly`,
      close(got.shadow, shadow, 1e-9), `got ${got.shadow.toFixed(12)}, pair spread ${got.spread.toExponential(2)}`);
  }

  // 3. 🎯 THE CANCELLATION CLAUSE, and it is the one that makes the operator usable on a real
  //    plate. Five lights of DIFFERENT colours, a lock-albedo scalar on C, a root-occlusion
  //    scalar and a side-visibility scalar — every one of them present in the shipped term and
  //    none of them known per pixel. The recovered Shadow must not move.
  {
    const lockScalar = 0.6137;
    const lit = C.map((c) => c * lockScalar);
    const lights = [
      [1.00, 0.96, 0.90],   // key
      [0.92, 0.95, 1.00],   // fill
      [0.06, 0.19, 1.00],   // rim, the #0f30ff panel
      [1.00, 0.72, 0.35],   // kicker
      [1.00, 1.00, 1.00],   // the spot half of the key
    ];
    const occlusion = 0.135;
    const visibility = 0.4;
    const sum = (shadow) => {
      const total = [0, 0, 0];
      for (const L of lights) {
        // `wrap` differs per light and is channel-independent, which is the property under test.
        const wrap = 0.02 + Math.random() * 0.05;
        const one = pedestal(lit, shadow, L, wrap * occlusion * visibility);
        for (let i = 0; i < 3; i += 1) total[i] += one[i];
      }
      return total;
    };
    // 🚩 The SAME wrap draws must be used in both plates, because in the real capture the two
    //    plates are the same geometry and the same lights. Seeded by replaying with a fixed list.
    const wraps = [0.031, 0.047, 0.012, 0.058, 0.026];
    const sumFixed = (shadow) => {
      const total = [0, 0, 0];
      lights.forEach((L, i) => {
        const one = pedestal(lit, shadow, L, wraps[i] * occlusion * visibility);
        for (let c = 0; c < 3; c += 1) total[c] += one[c];
      });
      return total;
    };
    void sum;
    const shadow = 0.2233;
    const got = recoverShadow(sumFixed(shadow), sumFixed(1), C);
    ok('five coloured lights + lock scalar + root AO + visibility all cancel',
      close(got.shadow, shadow, 1e-9),
      `got ${got.shadow.toFixed(12)} against ${shadow}, pair spread ${got.spread.toExponential(2)}`);

    // And the base colour handed in may be ANY positive multiple: C/luma is scale-invariant.
    const scaled = recoverShadow(sumFixed(shadow), sumFixed(1), C.map((c) => c * 17.3));
    ok('the operator is invariant to the scale of the base colour it is given',
      close(scaled.shadow, got.shadow, 1e-12),
      `${scaled.shadow.toFixed(12)} vs ${got.shadow.toFixed(12)}`);
  }

  // 4. 🔴 THE REJECTION CLAUSE. A field where the two plates differ by a per-channel scalar that is
  //    NOT the chromaticity power — i.e. the light rig changed between them — must not read as a
  //    plausible Shadow. If the operator cannot tell those apart it is measuring nothing.
  {
    const p0 = pedestal(C, 1, [1, 1, 1], 1);
    const wrong = pedestal(C, 1, [1.0, 0.5, 0.25], 1);   // a colour change with Shadow still 1
    const got = recoverShadow(wrong, p0, C);
    ok('a per-channel change that is NOT the chroma power reads far from 1',
      Math.abs(got.shadow - 1) > 0.5,
      `got ${got.shadow.toFixed(4)} — the operator would have reported this as depth if it were blind`);
  }

  // 5. The floor. A channel at zero has no logarithm and must return null rather than NaN.
  {
    ok('a zero channel returns null rather than NaN', recoverShadow([0, 1, 1], [1, 1, 1], C) === null);
    ok('a zero channel in the reference plate returns null too',
      recoverShadow([1, 1, 1], [1, 0, 1], C) === null);
  }

  console.log('\n=== spearman — rank correlation, against answers that are arithmetic\n');

  {
    const xs = [1, 2, 3, 4, 5, 6, 7, 8];
    ok('a strictly increasing map reads +1', close(spearman(xs, xs.map((v) => v ** 3)), 1, 1e-12));
    ok('a strictly decreasing map reads −1', close(spearman(xs, xs.map((v) => -v)), -1, 1e-12));
    // 🚩 THE CLAUSE THAT MATTERS FOR THIS ROUND: a CONSTANT candidate is not a weak signal, it is
    //    no signal, and it must read 0 rather than something that can be mistaken for a trend.
    ok('a constant signal reads 0, not a small positive number',
      spearman(xs, xs.map(() => 0.5)) === 0);
    // Ties handled by average rank: two-value data must not blow up.
    ok('a two-valued signal correlates without exploding',
      close(spearman([0, 0, 1, 1], [0, 0, 1, 1]), 1, 1e-12));
  }

  console.log('\n=== rayTriangle — Möller–Trumbore, against intersections known on paper\n');

  {
    const a = [0, 0, 1], b = [1, 0, 1], c = [0, 1, 1];
    ok('a ray down +z through the centroid hits at t = 1',
      close(rayTriangle([0.25, 0.25, 0], [0, 0, 1], a, b, c), 1, 1e-12));
    ok('a ray that misses the triangle returns null',
      rayTriangle([0.9, 0.9, 0], [0, 0, 1], a, b, c) === null);
    ok('a ray pointing away returns null (t must be positive)',
      rayTriangle([0.25, 0.25, 0], [0, 0, -1], a, b, c) === null);
    // 🎯 CARDS ARE DOUBLE-SIDED IN THIS GROOM (`material.side` is DoubleSide on the shipped arm),
    //    so a back-facing hit is still a card between the point and the light and MUST count.
    ok('a BACK-facing hit still counts — the groom is double-sided',
      close(rayTriangle([0.25, 0.25, 2], [0, 0, -1], a, b, c), 1, 1e-12));
    ok('a degenerate triangle returns null rather than dividing by zero',
      rayTriangle([0, 0, 0], [0, 0, 1], [0, 0, 1], [0, 0, 1], [0, 0, 1]) === null);
  }

  console.log('\n=== stats — percentiles against a list whose answers can be counted\n');

  {
    const s = stats([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    ok('p50 of 0..10 is 5', s.p50 === 5, `got ${s.p50}`);
    ok('p10 of 0..10 is 1', s.p10 === 1, `got ${s.p10}`);
    ok('p90 of 0..10 is 9', s.p90 === 9, `got ${s.p90}`);
    ok('mean of 0..10 is 5', close(s.mean, 5, 1e-12));
    ok('min/max are the ends', s.min === 0 && s.max === 10);
  }

  console.log(`\n  ${checks - failures}/${checks} clauses green, ${failures} red\n`);
  return failures;

}

if (process.argv[1] && process.argv[1].endsWith('hair-pedestal.selftest.mjs')) {
  process.exit(selftest() === 0 ? 0 : 1);
}
