#!/usr/bin/env node
//
// frame-cost.selftest.mjs — proves the calibration gate can FAIL, and proves the paired statistic
// survives the exact distribution that broke its predecessor.
//
// docs/LEARNINGS.md §1.1: *"A gate that has never failed is not known to work."* That applies with
// unusual force here, because `frame-cost.mjs`'s entire claim is that it refuses to speak when it
// cannot read zero. A refusal that has never fired is a decoration.
//
// ================================================================================================
// 🎯 THE CENTRAL GATE IS §3, AND IT IS BUILT FROM THE REAL FAILURE
// ================================================================================================
//
// The numbers in `testTheHistoricalFailureIsFixed` are not invented. They are the recorded modes
// from `captures/hair-r31-ladder-ours/data/no-hair-anomaly-2026-08-23.md`, measured over 384 samples
// an arm:
//
//     no-hair   fast 6.613 (33.6% of samples)   slow 13.473
//     cards     fast 6.860 (58.9% of samples)   slow 15.201
//
// Cards costs MORE in both states — +0.247 fast, +1.728 slow — and the difference of medians reads
// −3.974 ms, because the two medians are drawn from different clock states. That is the failure this
// tool exists to fix, so the fix is gated against a reconstruction of it rather than against a
// well-behaved gaussian.
//
// ================================================================================================
// WHAT THIS FILE CANNOT PROVE
// ================================================================================================
//
// Synthetic samples are not a GPU. These gates prove the ARITHMETIC and the REFUSALS: that a biased
// null is rejected, that a paired median survives a mixture, that an interval spanning zero is
// reported as unresolved, that the schedule is balanced. They cannot prove `visible = false` removes
// the groom's cost on real hardware — only null N1 can, and it runs on the machine.

import {
  NULL_MAX_MS, NULL_SIGN_Z, REFERENCE_TOLERANCE, REPLICATE_TOLERANCE,
  quantile, mean, makeRandom, pairedByTick, signTest, bootstrapMedianCI, summarisePair,
  evaluateNull, comparable, driftAcrossRun, tickSchedule,
} from './frame-cost.mjs';

const gates = [];
const record = (label, ok, detail) => gates.push({ label, ok, detail });
const close = (a, b, tolerance = 1e-9) => Math.abs(a - b) <= tolerance;

/** Samples in the shape the tool collects them: one row per tick. */
const ticked = (values) => values.map((ms, tick) => ({ tick, ms, draws: 0, triangles: 0 }));
const IDENTICAL = [{ draws: 0, triangles: 0 }];

// ================================================================================================
// §1 — the arithmetic, against answers derived rather than observed
// ================================================================================================

function testQuantileAndMean() {
  const xs = [1, 2, 3, 4];
  record('quantile interpolates', close(quantile(xs, 0.5), 2.5), 'p50 of [1,2,3,4] = 2.5');
  record('quantile at the ends', quantile(xs, 0) === 1 && quantile(xs, 1) === 4, 'min 1, max 4');
  record('mean', close(mean(xs), 2.5), '2.5');
  record('empty is null, not NaN', quantile([], 0.5) === null && mean([]) === null,
    'a statistic of nothing must refuse, not return NaN and print as a number');
}

function testSignTestArithmetic() {
  // 60 positive of 100: p̂ = 0.6, SE = 0.5/10 = 0.05, z = 0.1/0.05 = 2.0 exactly.
  const differences = [...Array(60).fill(1), ...Array(40).fill(-1)];
  const result = signTest(differences);
  record('sign fraction', close(result.fraction, 0.6), '60/100 = 0.600');
  record('sign z is exact', close(result.z, 2.0),
    'p̂=0.6, n=100 -> SE 0.05, z = 2.00 — derived, not fitted');

  // A tie is not a win. 0 is neither side, and counting it as positive would flatter every null.
  const withTies = signTest([1, -1, 0, 0]);
  record('zero is not positive', close(withTies.fraction, 0.25),
    '1 positive of 4 — a tie counted as a win would flatter every null toward its effect');
}

function testBootstrapIsDeterministicAndSeeded() {
  const differences = ticked(Array.from({ length: 64 }, (_, i) => Math.sin(i) * 0.4 + 1.2)).map((r) => r.ms);
  const first = bootstrapMedianCI(differences, 2000, 7);
  const again = bootstrapMedianCI(differences, 2000, 7);
  const other = bootstrapMedianCI(differences, 2000, 8);
  record('bootstrap reproduces under one seed',
    first.low === again.low && first.high === again.high,
    `[${first.low.toFixed(4)}, ${first.high.toFixed(4)}] twice — a CI nobody can reproduce is a CI nobody can check`);
  record('a different seed is a different draw', first.low !== other.low || first.high !== other.high,
    'seeds are doing work, not decorating the output');
  record('bootstrap refuses a tiny sample', bootstrapMedianCI([1, 2, 3], 100, 1) === null,
    'n=3 — 10,000 resamples of three numbers is a confident interval on nothing');

  const random = makeRandom(11);
  const again2 = makeRandom(11);
  record('the PRNG itself is reproducible', random() === again2() && random() === again2(),
    'the LCG is seeded, so the whole bootstrap is');
}

// ================================================================================================
// §2 — the calibration gate must FAIL, in each of its registered ways
// ================================================================================================

function testACleanNullPasses() {
  // Alternating ±0.02 ms: p50 ≈ 0, sign exactly 50%.
  const differences = Array.from({ length: 200 }, (_, i) => (i % 2 === 0 ? 0.02 : -0.02));
  const verdict = evaluateNull('clean', differences, IDENTICAL);
  record('a clean null PASSES', verdict.passed,
    `p50 ${verdict.p50.toFixed(4)}, sign ${(verdict.sign.fraction * 100).toFixed(1)}%, `
    + `z ${verdict.sign.z.toFixed(2)} — the gate is not simply always red`);
}

function testANoisyNullFails() {
  // Alternating, so the SIGN test reads exactly 50% and cannot contribute to the verdict. This
  // isolates the magnitude gate: if it fails, it fails on size alone.
  const differences = Array.from({ length: 200 }, (_, i) => (i % 2 === 0 ? 1.2 : -0.5));
  const verdict = evaluateNull('noisy', differences, IDENTICAL);
  const cited = verdict.reasons.some((reason) => reason.includes('NOISY'));
  record('a NOISY null fails on magnitude alone', verdict.passed === false && cited
    && verdict.sign.z <= NULL_SIGN_Z,
    `p50 ${verdict.p50.toFixed(3)} > ${NULL_MAX_MS} ms, with sign at exactly `
    + `${(verdict.sign.fraction * 100).toFixed(0)}% so only the magnitude gate is firing`);
}

function testASmallButBiasedNullFails() {
  // 🔴 THE GATE THAT MATTERS. Every difference is +0.05 ms — a twentieth of the ceiling, so any
  // magnitude bound waves it through — but it lands on the same side EVERY time. That is a
  // systematic order effect, and it would add its sign to every real arm in the run. `frame-budget`
  // measured exactly this shape at +1.77 ms between two captures of ONE configuration.
  const differences = Array(200).fill(0.05);
  const verdict = evaluateNull('biased', differences, IDENTICAL);
  const withinMagnitude = Math.abs(verdict.p50) <= NULL_MAX_MS;
  const cited = verdict.reasons.some((reason) => reason.includes('BIAS'));
  record('a SMALL BUT BIASED null fails on sign',
    withinMagnitude && verdict.passed === false && cited,
    `p50 ${verdict.p50.toFixed(3)} is INSIDE the ${NULL_MAX_MS} ms ceiling and it still fails — `
    + `sign 100%, z ${verdict.sign.z.toFixed(1)}σ. A magnitude bound alone would have passed this.`);
}

function testTheSignGateHasARealEdge() {
  // At n=200 the standard error is 0.5/√200 = 0.035355, so 3σ is p̂ = 0.60607. A gate whose
  // threshold sits nowhere in particular is a gate nobody can reason about, so both sides are
  // pinned: 60% must pass, 65% must fail.
  const at = (fraction) => {
    const positives = Math.round(200 * fraction);
    return evaluateNull('edge', [...Array(positives).fill(0.05), ...Array(200 - positives).fill(-0.05)], IDENTICAL);
  };
  const lenient = at(0.60);
  const strict = at(0.65);
  record('the sign gate has a located edge',
    lenient.passed === true && strict.passed === false,
    `60% passes (z ${lenient.sign.z.toFixed(2)}), 65% fails (z ${strict.sign.z.toFixed(2)}), `
    + `threshold ${NULL_SIGN_Z}σ = 60.6% at n=200`);
}

function testANullWithADifferentPictureIsRefused() {
  // Two conditions that drew different pictures are not a null, however small their difference is.
  // This is the stimulus check, and its absence is what let a fully attached groom be reported as
  // absent for a day.
  const verdict = evaluateNull('mislabelled', Array(200).fill(0.0),
    [{ draws: 2, triangles: 34_000 }]);
  const cited = verdict.reasons.some((reason) => reason.includes('same picture'));
  record('a "null" that drew a different picture is refused',
    verdict.passed === false && cited,
    'p50 is exactly 0.000 and it STILL fails — identity of the picture is measured, not assumed');
}

function testDriftIsCaught() {
  const steady = ticked(Array.from({ length: 90 }, (_, i) => 13.0 + (i % 3) * 0.01));
  const drifting = ticked(Array.from({ length: 90 }, (_, i) => 13.0 + i * 0.05));
  record('a steady run passes drift', driftAcrossRun(steady).passed,
    `${driftAcrossRun(steady).gap * 100 < 0.5 ? 'gap under 0.5%' : 'gap too wide'}`);
  const moved = driftAcrossRun(drifting);
  record('a drifting run FAILS', moved.passed === false,
    `${moved.head.toFixed(2)} -> ${moved.tail.toFixed(2)} = ${(moved.gap * 100).toFixed(1)}% > `
    + `${REFERENCE_TOLERANCE * 100}% — a run whose own yardstick moved is not one run`);
  record('drift refuses a short run', driftAcrossRun(ticked([1, 2, 3])) === null,
    'n=3 cannot have thirds');
}

// ================================================================================================
// §3 — 🎯 THE HISTORICAL FAILURE, RECONSTRUCTED AND FIXED
// ================================================================================================

function testTheHistoricalFailureIsFixed() {
  // The recorded modes, from data/no-hair-anomaly-2026-08-23.md.
  const NO_HAIR = { fast: 6.613, slow: 13.473, fastShare: 0.336 };
  const CARDS = { fast: 6.860, slow: 15.201, fastShare: 0.589 };
  const TICKS = 400;

  // --- how the OLD instrument sampled: each arm draws its OWN clock state, at its own mix ---------
  const random = makeRandom(4242);
  const unpairedNoHair = [];
  const unpairedCards = [];
  for (let tick = 0; tick < TICKS; tick += 1) {
    unpairedNoHair.push(random() < NO_HAIR.fastShare ? NO_HAIR.fast : NO_HAIR.slow);
    unpairedCards.push(random() < CARDS.fastShare ? CARDS.fast : CARDS.slow);
  }
  const differenceOfMedians = quantile(unpairedCards, 0.5) - quantile(unpairedNoHair, 0.5);

  record('the old statistic reproduces the NON-PHYSICAL result',
    differenceOfMedians < -3,
    `difference of medians = ${differenceOfMedians.toFixed(3)} ms — a card groom timing FASTER than `
    + 'an empty head, from arms that cost MORE in both clock states. ⚠️ More extreme than the '
    + 'recorded −3.974 because these modes carry no within-mode spread, so each median snaps to a '
    + 'mode centre. The SIGN and its cause are the point, not the magnitude.');

  // --- how THIS instrument samples: both members of a pair share the tick's clock state -----------
  //
  // ⚠️ THE CLOCK IS SHARED WITHIN A PAIR, THE JITTER IS NOT — and that is deliberately the hard
  // version of this test. A pure two-point distribution would let the paired median snap exactly to
  // a mode difference and the sign test read a flattering 100%, which proves nothing about a real
  // sample. Here each read carries its own ±0.5 ms of independent jitter on top of the shared state,
  // so the difference is contaminated by TWICE that — comparable to the +0.247 ms fast-mode cost
  // itself. The statistic has to survive that, not a clean signal.
  const jitter = makeRandom(777);
  const noise = () => (jitter() - 0.5) * 1.0;
  const pairedHidden = [];
  const pairedShown = [];
  for (let tick = 0; tick < TICKS; tick += 1) {
    const fast = tick % 2 === 0; // exactly 50/50, so the true mixture cost is derivable below
    pairedHidden.push({ tick, ms: (fast ? NO_HAIR.fast : NO_HAIR.slow) + noise(), draws: 43, triangles: 86_751 });
    pairedShown.push({ tick, ms: (fast ? CARDS.fast : CARDS.slow) + noise(), draws: 45, triangles: 120_751 });
  }
  const paired = summarisePair(pairedByTick(pairedHidden, pairedShown));

  // With the state exactly balanced, half the pairs cost +0.247 and half +1.728, so the population
  // median of the differences sits at their midpoint — (0.247 + 1.728)/2 = 0.9875 ms. Derived from
  // the recorded modes, not read off the tool.
  const TRUE_COST = (0.247 + 1.728) / 2;

  record('🎯 the paired statistic recovers the PHYSICAL sign',
    paired.p50 > 0,
    `paired p50 = +${paired.p50.toFixed(3)} ms on the SAME mixture that read `
    + `${differenceOfMedians.toFixed(3)} unpaired. The mixture cancels in the subtraction.`);

  record('and it recovers the TRUE cost through the jitter',
    Math.abs(paired.p50 - TRUE_COST) < 0.15,
    `+${paired.p50.toFixed(3)} against a derived truth of +${TRUE_COST.toFixed(4)} ms — within `
    + `${Math.abs(paired.p50 - TRUE_COST).toFixed(3)} ms, despite per-read jitter of ±0.5`);

  record('the sign test survives the jitter without being unanimous',
    paired.sign.fraction > 0.8 && paired.sign.fraction < 1.0,
    `${(paired.sign.fraction * 100).toFixed(1)}% of pairs put the groom on the expensive side — high, `
    + 'and NOT 100%, which is what a real sample looks like');

  record('the CI excludes zero', paired.spansZero === false,
    `[${paired.ci.low.toFixed(3)}, ${paired.ci.high.toFixed(3)}]`);
}

function testAnEffectInsideTheNoiseIsNotResolved() {
  // A groom that genuinely costs nothing, sampled through real jitter. The point estimate will be
  // some small non-zero number; the tool must refuse to quote it as the answer.
  const random = makeRandom(99);
  const differences = Array.from({ length: 200 }, () => (random() - 0.5) * 2.0);
  const summary = summarisePair(differences);
  record('an effect inside the noise is NOT RESOLVED', summary.spansZero === true,
    `p50 ${summary.p50.toFixed(3)} with CI [${summary.ci.low.toFixed(3)}, ${summary.ci.high.toFixed(3)}] — `
    + 'reporting the point estimate here is how +0.461 ms got published');
}

// ================================================================================================
// §4 — the comparability rule, against the three runs it was designed on
// ================================================================================================

function testComparabilityAgainstTheRealRuns() {
  // Measured by the verification workflow, three runs of the identical toggle on the identical
  // groom. Reference = the hidden-groom p50; cost = the paired p50.
  const RUNS = [
    { name: 'run1', reference: 8.424, cost: 1.233 },
    { name: 'run2', reference: 13.062, cost: 2.337 },
    { name: 'run3', reference: 13.087, cost: 2.390 },
  ];

  const twoThree = comparable(RUNS[1].reference, RUNS[2].reference);
  const spread = Math.abs(RUNS[2].cost - RUNS[1].cost) / Math.min(RUNS[1].cost, RUNS[2].cost);
  record('🎯 runs at one clock are comparable AND they agree',
    twoThree.ok && spread <= REPLICATE_TOLERANCE,
    `references ${(twoThree.gap * 100).toFixed(2)}% apart -> comparable; costs 2.337 vs 2.390 = `
    + `${(spread * 100).toFixed(1)}% apart, inside the registered ${REPLICATE_TOLERANCE * 100}%`);

  const oneTwo = comparable(RUNS[0].reference, RUNS[1].reference);
  record('🔴 a run at a different clock is REFUSED, not averaged in',
    oneTwo.ok === false,
    `references ${(oneTwo.gap * 100).toFixed(1)}% apart. Its cost (1.233) is 47% below run 2's and `
    + 'averaging the three is how a 94% spread gets published as one number.');

  record('comparability refuses a missing reference', comparable(null, 13.0).ok === false,
    'a cost with no clock state attached is not a number');
}

// ================================================================================================
// §5 — the schedule carries the bias controls it claims to
// ================================================================================================

function testTheScheduleIsBalanced() {
  const arms = [
    { key: 'bald', conditions: [{ key: 'bald', visible: null }] },
    { key: 'cardsA', conditions: [{ key: 'cardsA+', visible: true }, { key: 'cardsA-', visible: false }] },
    { key: 'cardsB', conditions: [{ key: 'cardsB+', visible: true }, { key: 'cardsB-', visible: false }] },
  ];
  const TICKS = 120;

  const firstSlot = new Map();
  const armFirst = new Map();
  const beforeWithinArm = new Map();
  for (let tick = 0; tick < TICKS; tick += 1) {
    const schedule = tickSchedule(arms, tick);
    firstSlot.set(schedule[0].key, (firstSlot.get(schedule[0].key) ?? 0) + 1);
    armFirst.set(schedule[0].arm, (armFirst.get(schedule[0].arm) ?? 0) + 1);
    for (const arm of arms) {
      if (arm.conditions.length < 2) continue;
      const own = schedule.filter((step) => step.arm === arm.key);
      beforeWithinArm.set(own[0].key, (beforeWithinArm.get(own[0].key) ?? 0) + 1);
    }
  }

  // 🔴 WITHIN AN ARM, `shown` AND `hidden` MUST EACH LEAD EXACTLY HALF THE TIME. This is the control
  // on the position effect that read +1.77 ms between two captures of one configuration.
  const shownLeads = beforeWithinArm.get('cardsA+') ?? 0;
  const hiddenLeads = beforeWithinArm.get('cardsA-') ?? 0;
  record('within an arm, shown and hidden each lead exactly half the ticks',
    shownLeads === TICKS / 2 && hiddenLeads === TICKS / 2,
    `cardsA+ leads ${shownLeads}, cardsA- leads ${hiddenLeads} of ${TICKS} — exact, not approximate`);

  // Arm rotation: each arm owns the first position an equal share.
  const counts = [...armFirst.values()];
  record('no arm permanently owns the first position',
    armFirst.size === arms.length && Math.max(...counts) - Math.min(...counts) === 0,
    `${[...armFirst].map(([k, v]) => `${k}:${v}`).join(' ')} of ${TICKS} ticks`);

  // Every condition is sampled exactly once per tick, or the pairing is silently unbalanced.
  const oneTick = tickSchedule(arms, 0);
  const unique = new Set(oneTick.map((step) => step.key));
  record('every condition appears exactly once per tick',
    unique.size === oneTick.length && oneTick.length === 5,
    `${oneTick.length} conditions, ${unique.size} distinct — a duplicate would pair a tick with itself`);
}

function testPairingIgnoresUnmatchedTicks() {
  // An arm that failed to sample on some tick must drop that pair, not shift the alignment.
  const a = ticked([1, 2, 3, 4, 5]);
  const b = [{ tick: 0, ms: 2 }, { tick: 2, ms: 5 }, { tick: 9, ms: 99 }];
  const differences = pairedByTick(a, b);
  record('pairing drops unmatched ticks rather than shifting',
    differences.length === 2 && close(differences[0], 1) && close(differences[1], 2),
    'ticks 0 and 2 pair; tick 9 has no partner and is dropped, not aligned to the next available row');
}

// ================================================================================================

function run() {
  testQuantileAndMean();
  testSignTestArithmetic();
  testBootstrapIsDeterministicAndSeeded();

  testACleanNullPasses();
  testANoisyNullFails();
  testASmallButBiasedNullFails();
  testTheSignGateHasARealEdge();
  testANullWithADifferentPictureIsRefused();
  testDriftIsCaught();

  testTheHistoricalFailureIsFixed();
  testAnEffectInsideTheNoiseIsNotResolved();

  testComparabilityAgainstTheRealRuns();

  testTheScheduleIsBalanced();
  testPairingIgnoresUnmatchedTicks();

  const width = Math.max(...gates.map((gate) => gate.label.length));
  for (const gate of gates) {
    process.stdout.write(`${gate.ok ? 'ok  ' : 'FAIL'}  ${gate.label.padEnd(width)}  ${gate.detail}\n`);
  }
  const failed = gates.filter((gate) => !gate.ok).length;
  process.stdout.write(`\n${gates.length - failed}/${gates.length} gates passed.\n`);
  return failed === 0 ? 0 : 1;
}

process.exitCode = run();
