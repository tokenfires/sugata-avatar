#!/usr/bin/env node
//
// hair-tf-ceiling.selftest.mjs — the probe's arithmetic, on answers derived before the code runs.
//
// docs/LEARNINGS.md §1.1: a gate that has never failed is not known to work. The three gates that
// matter here: the SIGNED statistic must score a violet gain NEGATIVE (the REQ-063 §6 trap), the
// boundary must be exact, and the decoy machinery must be provably inert exactly when the signal
// carries no structure.

import {
  fibreAxis, saturationTowardFibre, pedestalShipped, pedestalCeiling,
  scoreSamples, shuffledCopy, luma, CEILING_FLOOR, DECOY_MAX_SHARE,
} from './hair-tf-ceiling.mjs';

const gates = [];
const record = (label, ok, detail) => gates.push({ label, ok, detail });
const close = (a, b, tolerance = 1e-9) => Math.abs(a - b) <= tolerance;

// A warm fibre with a derivable axis: R above grey, G/B below.
const FIBRE = [0.0110, 0.0038, 0.0030];

function testTheAxisIsTheFibresOwn() {
  const axis = fibreAxis(FIBRE);
  record('the axis points at the fibre warm', axis[0] > 0 && axis[2] < 0,
    `[${axis.map((v) => v.toFixed(3)).join(', ')}] — R positive, B negative for a warm fibre`);
  record('the axis is unit', close(Math.hypot(...axis), 1, 1e-12), 'norm 1');
}

function testTheStatisticIsSigned() {
  const axis = fibreAxis(FIBRE);
  const warm = [0.20, 0.10, 0.08];
  const violet = [0.10, 0.08, 0.20];
  const grey = [0.10, 0.10, 0.10];
  record('warmer scores POSITIVE', saturationTowardFibre(warm, axis) > 0,
    saturationTowardFibre(warm, axis).toFixed(4));
  // 🔴 THE REQ-063 §6 TRAP. An unsigned chroma statistic scored a violet flood as the round's best
  // arm. This one must score it NEGATIVE, or the probe would repeat the recorded mistake.
  record('🔴 a VIOLET gain scores NEGATIVE', saturationTowardFibre(violet, axis) < 0,
    `${saturationTowardFibre(violet, axis).toFixed(4)} — more colourful, wrong direction, negative`);
  record('grey scores zero', close(saturationTowardFibre(grey, axis), 0, 1e-12), '0');
}

function testTheBoundaryIsExact() {
  // At n = 0 and Shadow = 1 the two forms are the same expression: √C · wrap. Zinke §3.1.1's
  // T_f = 1 at n = 0, already asserted at 1e-15 in hair-transmittance.selftest.mjs — re-checked
  // here through THIS file's own wrappers, because the wrappers divide the mirror's wrap out and a
  // bug there would fail exactly at this boundary.
  const weights = [[1, 1, 1], [0.5, 0.25, 0.25]];
  const shipped = pedestalShipped(weights, FIBRE, 1);
  const ceiling = pedestalCeiling(weights, FIBRE, [0, 0]);
  const gap = Math.max(...shipped.map((v, i) => Math.abs(v - ceiling[i])));
  record('n≡0 boundary equality through the wrappers', gap < 1e-15, `max gap ${gap.toExponential(1)}`);
}

function testDepthSharpensTowardTheFibre() {
  // One white light. √C's channel ratio is √(R/B) = √(0.0110/0.0030) ≈ 1.915 per traversal, so at
  // n = 2 the ceiling's R/B must be ~1.915³ ≈ 7.02 against the boundary's 1.915 — derived from the
  // fibre alone, not read off the function.
  const weights = [[1, 1, 1]];
  const shallow = pedestalCeiling(weights, FIBRE, [0]);
  const deep = pedestalCeiling(weights, FIBRE, [2]);
  const ratioShallow = shallow[0] / shallow[2];
  const ratioDeep = deep[0] / deep[2];
  record('depth sharpens the channel ratio geometrically',
    close(ratioShallow, Math.sqrt(FIBRE[0] / FIBRE[2]), 1e-9)
      && close(ratioDeep, (FIBRE[0] / FIBRE[2]) ** 1.5, 1e-9),
    `R/B ${ratioShallow.toFixed(3)} at n=0 → ${ratioDeep.toFixed(3)} at n=2, against derived `
    + `${Math.sqrt(FIBRE[0] / FIBRE[2]).toFixed(3)} and ${((FIBRE[0] / FIBRE[2]) ** 1.5).toFixed(3)}`);
  record('and depth SPENDS energy while doing it', luma(deep) < luma(shallow),
    `luma ${luma(shallow).toExponential(2)} → ${luma(deep).toExponential(2)} — level and chroma move `
    + 'together, which is the property the shipped isoluminant factor lacks');
}

function testTheProbeSeesAStructuredSignal() {
  // ⚠️ THE FIRST VERSION OF THIS GATE ASSERTED THE SIGN FROM INTUITION AND WAS WRONG — the probe
  // was right. Against a shipped pedestal whose sheet is deep, slide 39's isoluminant factor
  // `(C/luma)^(1−Shadow)` is ALREADY a strong warm boost, while the honest term at shallow paths is
  // plain `√C` — milder. So the sign of the gain depends on the shipped baseline, and the gate now
  // DERIVES both cases instead of assuming one.
  const structured = (shadowSheet) => Array.from({ length: 200 }, (_, i) => ({
    weights: [[1, 1, 1], [1, 1, 1]],
    events: i % 2 === 0 ? [0, 3] : [3, 0],
    shadowSheet,
  }));

  // (a) Shipped sheet EMPTY (Shadow = 1): the chroma factor is ^0 = 1, shipped is bare √C, and any
  // structured depth must read WARMER than that. Positive, derivably.
  const vsBare = scoreSamples(structured(1), FIBRE);
  record('vs a bare-√C shipped baseline, structure reads WARMER', vsBare.relativeGain > 0,
    `relative gain +${(vsBare.relativeGain * 100).toFixed(1)}% against Shadow ≡ 1`);

  // (b) Shipped sheet DEEP (Shadow = e^−1.5): the isoluminant factor is (C/luma)^0.777 — a strong
  // fake warm the honest term does not match at shallow n. Negative, derivably — and this is the
  // property that makes the REAL ceiling a live question rather than a formality: the shipped fake
  // already saturates without paying energy, and the honest term only saturates where light
  // actually traversed depth.
  const vsFake = scoreSamples(structured(Math.exp(-1.5)), FIBRE);
  record('vs the deep-sheet FAKE, honest depth reads LESS warm — and the statistic says so',
    vsFake.relativeGain < 0,
    `relative gain ${(vsFake.relativeGain * 100).toFixed(1)}% — the probe must be able to return a `
    + 'negative ceiling, or G-CEILING could never close the line');

  // 🎯 THE DECOY'S CONTROL CASE: when every sample carries the SAME events, shuffling changes
  // nothing, so the decoy machinery itself must read identically — proving a small share in the
  // real run comes from destroyed STRUCTURE and not from the shuffling code.
  const uniform = structured(Math.exp(-1.5)).map((sample) => ({ ...sample, events: [1, 2] }));
  const orderedUniform = scoreSamples(uniform, FIBRE);
  const decoyUniform = scoreSamples(shuffledCopy(uniform), FIBRE);
  record('shuffling a structureless signal changes nothing',
    close(orderedUniform.relativeGain, decoyUniform.relativeGain, 1e-12),
    'identical to 1e-12 — the decoy measures structure, not the act of shuffling');
}

function testConstantsAreTheRegisteredOnes() {
  record('the registered constants are exported unmodified',
    close(CEILING_FLOOR, 0.095) && close(DECOY_MAX_SHARE, 0.20),
    `floor ${CEILING_FLOOR}, decoy share ${DECOY_MAX_SHARE} — moving them after a run voids the round`);
}

testTheAxisIsTheFibresOwn();
testTheStatisticIsSigned();
testTheBoundaryIsExact();
testDepthSharpensTowardTheFibre();
testTheProbeSeesAStructuredSignal();
testConstantsAreTheRegisteredOnes();

const width = Math.max(...gates.map((gate) => gate.label.length));
for (const gate of gates) {
  process.stdout.write(`${gate.ok ? 'ok  ' : 'FAIL'}  ${gate.label.padEnd(width)}  ${gate.detail}\n`);
}
const failed = gates.filter((gate) => !gate.ok).length;
process.stdout.write(`\n${gates.length - failed}/${gates.length} gates passed.\n`);
process.exitCode = failed === 0 ? 0 : 1;
