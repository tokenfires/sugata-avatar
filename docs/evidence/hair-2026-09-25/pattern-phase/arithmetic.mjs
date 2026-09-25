import assert from 'node:assert/strict';
import fs from 'node:fs';
import { innerValue, patch } from './candidate.mjs';
import { hairDitherOffsetValue as outer } from '../../../packages/core/src/render/HairOIT.js';

const frac = x => x - Math.floor(x);
const screenSeeds = [0, 0.5, 1.5, 13.5, 255.5, 593.5, 791.5].map((x, i) =>
  x * 0.06711056 + (i * 131 + 0.5) * 0.00583715);
const threshold = (seed, frame, phase, inner) =>
  Math.max(1e-6, frac(frac(52.9829189 * frac(seed + inner)) + outer(frame, phase)));
const metrics = samples => {
  const sorted = [...samples].sort((a, b) => a - b);
  return {maxGap: Math.max(sorted[0] + 1 - sorted.at(-1),
    ...sorted.slice(1).map((v, i) => v - sorted[i])),
    ks: Math.max(...sorted.map((v, i) => Math.max((i + 1) / sorted.length - v, v - i / sorted.length)))};
};
const rows = [];
for (const start of [0, 60000, 1000000000]) {
  for (const phase of [0, 977]) {
    for (const seed of screenSeeds) {
      for (const n of [16, 24, 64, 128, 256, 4096]) {
        const values = arm => Array.from({length: n}, (_, i) => {
          const frame = start + i;
          const inner = arm === 'candidate' ? innerValue(frame, phase) : 0;
          const value = threshold(seed, frame, phase, inner);
          assert.ok(Number.isFinite(value) && value > 0 && value <= 1);
          assert.equal(threshold(seed, frame, phase, 0),
            Math.max(1e-6, frac(frac(52.9829189 * frac(seed)) + outer(frame, phase))));
          return value;
        });
        rows.push({start, phase, seed, n, baseline: metrics(values('baseline')), candidate: metrics(values('candidate'))});
      }
    }
  }
}
for (const phase of [0, 977]) {
  assert.equal(new Set(Array.from({length: 32}, (_, f) => innerValue(f, phase, 'frozen-dither'))).size, 1);
}
assert.notEqual(innerValue(0, 0, 'frozen-dither'), innerValue(0, 977, 'frozen-dither'));
const source = fs.readFileSync('packages/core/src/render/HairOIT.js', 'utf8');
for (const arm of ['zero', 'candidate']) {
  fs.writeFileSync(new URL(`./HairOIT-${arm}.js`, import.meta.url), patch(source, arm));
}
const summary = [16, 24, 64, 128, 256, 4096].map(n => ({n,
  baselineMaxGap: Math.max(...rows.filter(r => r.n === n).map(r => r.baseline.maxGap)),
  candidateMaxGap: Math.max(...rows.filter(r => r.n === n).map(r => r.candidate.maxGap)),
  baselineMaxKS: Math.max(...rows.filter(r => r.n === n).map(r => r.baseline.ks)),
  candidateMaxKS: Math.max(...rows.filter(r => r.n === n).map(r => r.candidate.ks))}));
fs.writeFileSync(new URL('./arithmetic.json', import.meta.url), JSON.stringify({
  note: 'Double-precision diagnostic, not a GPU precision or unbiased-estimator proof. Existing outer-offset D2 bound is not a bound on this changed threshold.',
  rows, summary}, null, 2) + '\n');
console.log('PASS: finite/range, zero-phase identity, frozen/phase CPU controls; exact source replacements.');
console.table(summary);
