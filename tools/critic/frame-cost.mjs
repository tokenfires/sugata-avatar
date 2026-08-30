#!/usr/bin/env node
//
// frame-cost.mjs — what a groom costs, measured as a SELF-difference, by an instrument that must
// prove it can read zero before it is allowed to read anything else.
//
// Registered at `docs/superpowers/specs/2026-08-23-frame-cost-preregistration.md`, committed before
// the first sample. The five constants below are that registration; moving them after a run voids
// the run.
//
//   node tools/critic/frame-cost.mjs --ticks 200
//   node tools/critic/frame-cost.mjs --arms ribbons --ticks 150
//
// ================================================================================================
// 🔴 WHY THIS EXISTS RATHER THAN A PATCH TO `frame-budget.mjs`
// ================================================================================================
//
// Five timing claims in two days, every one of them stated as measured, every one wrong:
//
//   "cards cost −3.974 ms"                  non-physical — a mixture of two clock states
//   "P0 is a DVFS problem"                  withdrawn on a defect, then reinstated; the withdrawal
//                                           was the error, not the diagnosis
//   "the hair arm attaches no groom"        it attaches a full groom; the guard read `report().hair`,
//                                           a key that does not exist
//   "P0 has a 404"                          every asset serves 200
//   "the cards arm closes at +0.461 ms"     one draw from a swing reading −1.570 / +1.191 / +0.501
//
// Four of the five share ONE root: the cost of a groom was computed by DIFFERENCING TWO PAGES, which
// confounds *what is drawn* with *which page is asked*. That confound is not a small bias. It
// produced a sign error — a card groom timing 3.99 ms FASTER than an empty head.
//
// 🎯 SO THE PRIMITIVE CHANGES. One page, loaded once, warmed once, sampled twice inside a single
// tick: groom visible, groom hidden. Page, GPU context, pipeline cache, resident set and clock state
// are identical BY CONSTRUCTION, because it is the same page one frame apart. Cross-page
// differencing is not corrected here. It is gone.
//
// ⚠️ AND `visible = false` IS NOT AN APPROXIMATION OF ABSENCE. The groom's meshes carry
// `castShadow = true` (`alive.js:2560-2566`) and three culls an invisible mesh from EVERY pass, so
// the toggle drops the G-buffer draw and the shadow draw together. That claim is not taken on
// trust either — gate N1 measures the hidden groom against a page that never had one, and the
// round is void if they differ.

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';

const REPOSITORY_ROOT = fileURLToPath(new URL('../..', import.meta.url));
const GPU_FLAGS = ['--enable-unsafe-webgpu', '--ignore-gpu-blocklist', '--hide-scrollbars'];

/** `alive.js`'s own timing header states this framing for every arm already in the record. */
const VIEWPORT = { width: 1080, height: 1920 };

// 🔴 `hairmotion=0` IS EXPLICIT. `?hairmotion` DEFAULTS ON, and its absence once made the arms
// unequal: the card arm ran `HairDynamics` while every ribbon arm had it refused, because
// `alive.js` will not let the solver and the ribbon expansion both write `material.positionNode`.
// The solver is ~0.018 ms and cannot explain any delta seen — this is a correctness fix, not an
// explanation — but a comment claiming parity that does not hold is the defect this repo has caught
// ten times.
const BASE_QUERY = 'bare&freeze&seed=1&frame=body&capture&gputime=1&hairmotion=0';

// ================================================================================================
// THE REGISTRATION. Five constants, exported so the selftest reads the same numbers the run does.
// ================================================================================================

/**
 * Paired |p50| ceiling for every null, in milliseconds.
 *
 * Derived from the DECISION, not from null data: the rule this instrument serves is "parity with
 * today's cards", and today's cards are a ~1.2-2.4 ms object. An instrument whose null is a quarter
 * of the smallest effect it must resolve cannot adjudicate parity. 0.25 ms is 10-20% of the effect.
 */
export const NULL_MAX_MS = 0.25;

/**
 * Sign-test ceiling for every null, in standard errors of a fair coin at the run's own n.
 *
 * 🔴 THE SECOND HALF OF THE GATE, AND THE HALF A MAGNITUDE BOUND CANNOT DO. A null can fail by being
 * NOISY or by being SMALL-BUT-CONSISTENTLY-SIGNED, and the second is the dangerous one: a 0.05 ms
 * bias landing on 100% of ticks passes any magnitude bound and contaminates every real arm with its
 * sign. That is the exact shape of the position effect `frame-budget.mjs` measured at +1.77 ms
 * between two captures of ONE configuration.
 */
export const NULL_SIGN_Z = 3.0;

/**
 * Two costs are comparable only if their reference (groom-hidden) frames agree within this.
 *
 * 🎯 THE CLOCK IS MEASURED, NOT FOUGHT. Three prior runs of this identical toggle on this identical
 * groom read 1.233, 2.337 and 2.390 ms — a 94% spread — against bald frames of 8.424, 13.062 and
 * 13.087. Fixed work in milliseconds scales with the clock it runs at, so a cost quoted without its
 * clock state is not a number.
 *
 * The hidden condition IS a clock probe and is already being sampled, so the yardstick costs
 * nothing. Tested against those three runs BEFORE adoption: it pairs run 2 with run 3 (references
 * 0.19% apart, costs 2.3% apart) and REFUSES run 1 (reference 35% away) rather than averaging it in.
 */
export const REFERENCE_TOLERANCE = 0.02;

/** When two arms ARE comparable by the rule above, their costs must agree within this. */
export const REPLICATE_TOLERANCE = 0.10;

/** Bootstrap resamples for the CI on the paired median. Seeded; the seed is recorded. */
export const BOOTSTRAP_RESAMPLES = 10_000;

/**
 * Significance level for the permutation drift test. Amendment 2 to the registration.
 *
 * 🔴 A NEW CONSTANT, NOT A LOOSENED ONE, AND THE DISTINCTION IS THE WHOLE POINT. N4 was registered
 * as "hidden p50 of the first third against the last third", gated at `REFERENCE_TOLERANCE`. That
 * operator cannot see drift: shuffling the tick labels destroys every time relationship while
 * preserving the distribution exactly, and the gate STILL fails 9-15% of the time in the run's
 * STABLE region — where the reference varies 0.9% end to end — and up to 38% in its unstable one.
 * A p50 of thirteen samples from a bimodal distribution is not a stable location estimate, so
 * comparing two of them detects its own sampling noise.
 *
 * `REFERENCE_TOLERANCE` is a tolerance on a RATIO OF TWO CLOCK STATES and was never a sampling
 * distribution. It keeps its value and keeps gating comparability; it simply stops being asked a
 * question it cannot answer.
 */
export const DRIFT_ALPHA = 0.05;
export const DRIFT_PERMUTATIONS = 2000;

// ================================================================================================
// v2 (docs/superpowers/specs/2026-08-24-frame-cost-v2-preregistration.md). v1 closed VOID: three
// runs, three refusals, no cost reported. Its premise — that the machine reaches a clock state and
// holds it — is measurably false. 41 state changes in 240 ticks, fast runs 2-4 ticks long, 17.5%
// fast at 7.212 ms against 13.059 slow. No warm-up prevents that and no run length averages it out.
//
// 🎯 SO v2 STOPS HOLDING THE CLOCK STILL AND MEASURES INSIDE IT. What a paired design needs is not a
// stable reference — it is both members of a pair in the SAME state, which reads 95.4% on real
// samples. That is the property, it was never gated because it was never named, and the median was
// quietly relying on it the whole time.
// ================================================================================================

/**
 * The fraction of pairs whose two members share a clock state. REPORTED, NOT GATED — v3.
 *
 * 🔴 v2 GATED ON THIS AND THE GATE MEASURED THE EFFECT. Agreement falls monotonically as the real
 * cost grows — 62.5% at +3.275 ms, 57.5% at +5.182, 45.5% at +7.513 — because a groom that costs
 * enough pushes its own frame across the state-bin boundary, and the bin read that as a broken
 * pair. ρ = −0.835 (p < 5×10⁻⁶) over 81 pairs, while identical-workload pairs hold 81-89%
 * regardless of arm. So the bigger the effect, the more confidently the gate voided the run.
 *
 * What G1 was guarding is gated better by the nulls, adjudicated pooled AND per state: an
 * end-to-end proof the paired channel reads zero on pairs that are zero, straddle contamination
 * included. The constant survives only so the diagnostic printout can annotate low agreement.
 */
export const PAIR_INTEGRITY_MIN = 0.85;

/**
 * Retained pairs a state needs before its cost is reported at all.
 *
 * 🚩 `frame-budget.mjs` printed a "slow mode" mean computed from ONE sample and then differenced it
 * to three decimals. Its own separation test could not catch that — separation is LARGE when the
 * lone outlier sits far away, which is exactly the case that must be refused.
 */
export const STATE_MIN_PAIRS = 30;

/**
 * How far apart two fitted "clock states" must be, as a ratio, before they are believed.
 *
 * 🔴 SEPARATION IN STANDARD DEVIATIONS CANNOT DO THIS JOB, AND MEASURING IT IS WHY. A 2-means split
 * of a UNIMODAL sample already yields separation 2.6 (gaussian), 3.4 (uniform), 3.4 (skewed) — so a
 * separation floor of 2 admits pure artefacts. And the REAL captured run scores only 4.40, because
 * real modes carry wide within-mode spread. The two populations overlap on that axis.
 *
 * 🎯 THE RATIO SEPARATES THEM CLEANLY, AND IT IS THE PHYSICALLY MEANINGFUL QUANTITY: two GPU clock
 * states differ by a frequency factor, not by a few percent. Measured, unimodal artefacts top out at
 * **1.08**; real states read **1.79** here and **1.33-2.22** across everything in the record. 1.25
 * sits in that gap, biased toward refusing.
 *
 * Both floors apply: the ratio says "these are two clocks", the separation says "and they are
 * resolvable".
 */
export const CLOCK_RATIO_MIN = 1.25;

// ================================================================================================
// PURE STATISTICS — no page, no GPU, no clock. Everything below is exercised by the selftest
// against distributions whose answer is known before the function runs.
// ================================================================================================

export function quantile(values, q) {
  const sorted = [...values].sort((a, b) => a - b);
  if (sorted.length === 0) return null;
  const index = (sorted.length - 1) * q;
  const low = Math.floor(index);
  const high = Math.ceil(index);
  if (low === high) return sorted[low];
  return sorted[low] + (sorted[high] - sorted[low]) * (index - low);
}

export function mean(values) {
  return values.length === 0 ? null : values.reduce((sum, x) => sum + x, 0) / values.length;
}

/** A seeded LCG, so a bootstrap is reproducible and a reader can check it. */
export function makeRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x1_0000_0000;
  };
}

/**
 * Differences of two conditions PAIRED BY TICK — `b` minus `a`, one value per tick both were read.
 *
 * 🔴 THIS IS THE REPAIR, AND IT IS ONE LINE OF ARITHMETIC. The prior instrument computed a
 * difference of medians. Every arm on this page is bimodal — two GPU clock states 1.33x to 2.22x
 * apart — and the MIX differs per arm, so two medians came from DIFFERENT STATES and a card groom
 * read 3.99 ms faster than an empty head.
 *
 * 🎯 Inside one tick both members of a pair sit at the SAME clock, so the mixture cancels in the
 * subtraction rather than being conditioned on afterwards. `frame-budget.mjs` tried conditioning —
 * a pooled boundary and a per-mode table — and its own control still spread ±0.4 ms, the size of
 * the effect. You cannot recover a cost from a state that is entangled with the workload. You can
 * decline to let them entangle.
 */
export function pairedByTick(samplesA, samplesB) {
  const byTickA = new Map(samplesA.map((row) => [row.tick, row]));
  const differences = [];
  for (const row of samplesB) {
    const other = byTickA.get(row.tick);
    if (other !== undefined) differences.push(row.ms - other.ms);
  }
  return differences;
}

/**
 * The fraction of pairs where the difference is positive, and how many standard errors that is from
 * a coin flip.
 *
 * ⚠️ MODE-FREE ON PURPOSE. This statistic does not care what the distribution looks like — not its
 * shape, not its modality, not its variance — only whether the groom lands on the expensive side of
 * its OWN pair. Every failure this instrument replaces was a failure of a location statistic on a
 * mixture. A sign test cannot have that failure.
 */
export function signTest(differences) {
  const n = differences.length;
  if (n === 0) return { n: 0, fraction: null, z: null };
  const positive = differences.filter((x) => x > 0).length;
  const fraction = positive / n;
  return { n, positive, fraction, z: Math.abs(fraction - 0.5) / (0.5 / Math.sqrt(n)) };
}

/** Percentile bootstrap CI on the paired median. Seeded, so two readers get the same interval. */
export function bootstrapMedianCI(differences, resamples = BOOTSTRAP_RESAMPLES, seed = 20260823) {
  if (differences.length < 8) return null;
  const random = makeRandom(seed);
  const medians = [];
  for (let draw = 0; draw < resamples; draw += 1) {
    const resample = new Array(differences.length);
    for (let i = 0; i < differences.length; i += 1) {
      resample[i] = differences[Math.floor(random() * differences.length)];
    }
    medians.push(quantile(resample, 0.5));
  }
  return { low: quantile(medians, 0.025), high: quantile(medians, 0.975), resamples, seed };
}

/**
 * A paired comparison, with everything a reader needs to disbelieve it.
 *
 * `spansZero` is load-bearing: §5 of the registration refuses to report a point estimate for an
 * effect whose interval includes no effect at all.
 */
export function summarisePair(differences) {
  const ci = bootstrapMedianCI(differences);
  return {
    n: differences.length,
    p50: quantile(differences, 0.5),
    mean: mean(differences),
    sign: signTest(differences),
    ci,
    spansZero: ci === null ? null : (ci.low <= 0 && ci.high >= 0),
  };
}

/**
 * Adjudicate one null against BOTH halves of the registered gate.
 *
 * `censusDeltas` is the set of distinct (draws, triangles) differences seen across the paired ticks.
 * A null is only a null if the two conditions drew the SAME PICTURE, and that is measured rather
 * than assumed — the defect this replaces asserted the stimulus against a field that did not exist
 * and reported a fully attached groom as absent.
 */
export function evaluateNull(label, differences, censusDeltas) {
  const summary = summarisePair(differences);
  const reasons = [];

  const identical = censusDeltas.every((delta) => delta.draws === 0 && delta.triangles === 0);
  if (identical === false) {
    reasons.push(`the two conditions did not draw the same picture: ${JSON.stringify(censusDeltas)}`);
  }
  if (summary.n === 0) {
    reasons.push('no paired samples');
  } else {
    if (Math.abs(summary.p50) > NULL_MAX_MS) {
      reasons.push(`|p50| ${Math.abs(summary.p50).toFixed(4)} > ${NULL_MAX_MS} ms — too NOISY to `
        + 'resolve the effect it is meant to license');
    }
    if (summary.sign.z > NULL_SIGN_Z) {
      reasons.push(`sign ${(summary.sign.fraction * 100).toFixed(1)}% is ${summary.sign.z.toFixed(2)}σ `
        + `> ${NULL_SIGN_Z}σ from a coin — a one-sided BIAS, which a magnitude bound cannot see`);
    }
  }

  return { label, ...summary, censusDeltas, passed: reasons.length === 0, reasons };
}

/**
 * Whether two arms measured against different reference frames may be differenced at all.
 *
 * ⚠️ THIS REFUSES RATHER THAN CORRECTS. Rescaling one cost by a clock ratio would be a model of the
 * hardware, and this project has spent three rounds paying for models of the hardware that were
 * reached by elimination. Two arms at different clocks are simply not comparable, and saying so is
 * the honest output.
 */
export function comparable(referenceA, referenceB) {
  if (referenceA === null || referenceB === null) return { ok: false, gap: null };
  const gap = Math.abs(referenceA - referenceB) / Math.min(referenceA, referenceB);
  return { ok: gap <= REFERENCE_TOLERANCE, gap };
}

/**
 * The clock-state boundary, fitted ONCE on every sample the run collected.
 *
 * 🔴 ONE BOUNDARY, POOLED, APPLIED TO EVERY ARM — AND FITTING IT PER ARM IS A MEASURED DEFECT.
 * k-means puts the cut wherever that arm's own samples fall, so each arm's "fast mode" becomes a
 * different slice of the clock's range and the means cannot be differenced. With per-arm boundaries
 * `frame-budget.mjs`'s CONTROL — two captures of ONE configuration — read −0.353 ms in the fast mode
 * and +0.449 in the slow, the same magnitude as the effect being looked for. The clock states belong
 * to the MACHINE, not to the arm, so the boundary does too.
 *
 * Seeded at the deciles so a re-fit of the same data gives the same split, and it REFUSES rather
 * than splitting a unimodal sample down the middle — k-means will happily do that and report two
 * meaningless numbers with a straight face.
 */
export function fitClockBoundary(allSamples) {
  const xs = [...allSamples].sort((a, b) => a - b);
  if (xs.length < 32) return null;

  let low = xs[Math.floor(xs.length * 0.1)];
  let high = xs[Math.floor(xs.length * 0.9)];
  let fastSide = [];
  let slowSide = [];

  for (let iteration = 0; iteration < 100; iteration += 1) {
    fastSide = xs.filter((x) => Math.abs(x - low) <= Math.abs(x - high));
    slowSide = xs.filter((x) => Math.abs(x - low) > Math.abs(x - high));
    if (fastSide.length === 0 || slowSide.length === 0) return null;
    const nextLow = mean(fastSide);
    const nextHigh = mean(slowSide);
    if (Math.abs(nextLow - low) < 1e-9 && Math.abs(nextHigh - high) < 1e-9) break;
    low = nextLow;
    high = nextHigh;
  }

  const spread = (values, centre) => Math.sqrt(
    values.reduce((sum, x) => sum + (x - centre) ** 2, 0) / Math.max(1, values.length - 1));
  const pooled = Math.sqrt(
    (spread(fastSide, low) ** 2 * (fastSide.length - 1) + spread(slowSide, high) ** 2 * (slowSide.length - 1))
    / Math.max(1, fastSide.length + slowSide.length - 2));
  const separation = pooled > 0 ? (high - low) / pooled : Infinity;

  // ⚠️ BOTH FLOORS, AND NEITHER ALONE IS ENOUGH. k-means will split any sample into two halves and
  // report them with a straight face; conditioning on states that are really two halves of ONE
  // distribution would manufacture exactly the signal being looked for. Separation alone admits
  // unimodal artefacts (measured at 2.6-3.4) and would reject the real run (4.40). See
  // `CLOCK_RATIO_MIN`.
  const ratio = high / low;
  if (separation < 2 || ratio < CLOCK_RATIO_MIN) return null;

  return { threshold: (low + high) / 2, fast: low, slow: high, separation, ratio };
}

/**
 * Pair by tick AND by clock state, dropping pairs whose members straddle a state change.
 *
 * 🎯 THIS IS v2'S WHOLE ADDITION. The machine switches state every few ticks, so 4.6% of pairs have
 * one member each side of a switch. Such a pair's difference carries roughly the STATE GAP — about
 * 6 ms against a ~2 ms effect — and no statistic removes that; a median merely survives it. Here
 * they are detected exactly and dropped exactly, and the drop rate is itself a gate (G1).
 */
export function pairedByTickAndState(samplesA, samplesB, boundary) {
  const stateOf = (ms) => (boundary === null ? 'all' : (ms <= boundary.threshold ? 'fast' : 'slow'));
  const byTickA = new Map(samplesA.map((row) => [row.tick, row]));
  const kept = { fast: [], slow: [], all: [] };
  let straddled = 0;
  let considered = 0;

  for (const row of samplesB) {
    const other = byTickA.get(row.tick);
    if (other === undefined) continue;
    considered += 1;
    const state = stateOf(other.ms);
    if (state !== stateOf(row.ms)) { straddled += 1; continue; }
    const difference = row.ms - other.ms;
    kept.all.push(difference);
    if (state !== 'all') kept[state].push(difference);
  }

  return {
    ...kept,
    considered,
    straddled,
    integrity: considered === 0 ? null : (considered - straddled) / considered,
  };
}

/**
 * Two-sample Kolmogorov-Smirnov statistic: the largest gap between two empirical CDFs.
 *
 * Rank-based, so a bimodal distribution does not degrade it, and sensitive to a change in SHAPE or
 * MIXTURE rather than only in location — which is what the tick-140 event on this machine actually
 * is. Its p50 barely moved there; its minimum fell from 12.73 to 4.04 ms.
 */
export function kolmogorovSmirnov(a, b) {
  if (a.length === 0 || b.length === 0) return null;
  const sortedA = [...a].sort((x, y) => x - y);
  const sortedB = [...b].sort((x, y) => x - y);
  let i = 0;
  let j = 0;
  let largest = 0;
  while (i < sortedA.length && j < sortedB.length) {
    const value = Math.min(sortedA[i], sortedB[j]);
    while (i < sortedA.length && sortedA[i] <= value) i += 1;
    while (j < sortedB.length && sortedB[j] <= value) j += 1;
    largest = Math.max(largest, Math.abs(i / sortedA.length - j / sortedB.length));
  }
  return largest;
}

/**
 * Drift as a PERMUTATION TEST: is the first half of a block distributed like the second half?
 *
 * 🎯 THE FALSE-POSITIVE RATE IS 5% BY CONSTRUCTION, WHICH IS THE ENTIRE REASON FOR THE CHANGE. The
 * null is built from this block's OWN samples with their time order destroyed, so "how often does
 * this fire when nothing is happening" is not an assumption — it is what a p-value means. The
 * replaced operator's rate had to be discovered empirically, and it was 15%.
 *
 * ⚠️ `(count + 1) / (permutations + 1)` rather than `count / permutations`, so a p-value can never
 * be exactly 0. An impossible-looking certainty from 2000 draws is an artefact of 2000 draws.
 */
export function driftByPermutation(samples, permutations = DRIFT_PERMUTATIONS, seed = 20260823) {
  if (samples.length < 24) return null;
  const ordered = [...samples].sort((a, b) => a.tick - b.tick).map((row) => row.ms);
  const half = Math.floor(ordered.length / 2);
  const observed = kolmogorovSmirnov(ordered.slice(0, half), ordered.slice(half));

  const random = makeRandom(seed);
  const pool = [...ordered];
  let atLeastAsExtreme = 0;
  for (let draw = 0; draw < permutations; draw += 1) {
    for (let i = pool.length - 1; i > 0; i -= 1) {
      const j = Math.floor(random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    if (kolmogorovSmirnov(pool.slice(0, half), pool.slice(half)) >= observed) atLeastAsExtreme += 1;
  }

  const p = (atLeastAsExtreme + 1) / (permutations + 1);
  return {
    statistic: observed,
    p,
    permutations,
    // The head/tail medians are still REPORTED, because a reader wants to know which way it moved.
    // They are simply no longer what DECIDES.
    head: quantile(ordered.slice(0, half), 0.5),
    tail: quantile(ordered.slice(half), 0.5),
    passed: p >= DRIFT_ALPHA,
  };
}

// ================================================================================================
// MEASUREMENT
// ================================================================================================

/**
 * One frame on one page, with the groom's visibility set first and the census differenced across it.
 *
 * ⚠️ `info.render.drawCalls` AND `.triangles` ARE CUMULATIVE ON THIS PAGE. Under `?capture`,
 * `takeOverFrameLoop` stops the animation loop, and `Animation.js:75` is the only caller of
 * `info.reset()` — so nothing ever clears them and reading them raw yields a running total. They
 * are read before and after ONE step and differenced. (The same freeze is why `info.frame` is
 * constant, which is why a burst's passes all land in one timestamp group.)
 */
/**
 * Every condition an arm needs this tick, in ONE `page.evaluate`, as back-to-back frames.
 *
 * 🔴 ONE ROUND TRIP PER ARM, NOT ONE PER SAMPLE, AND THE DIFFERENCE IS PAIR INTEGRITY. A pair's two
 * members must sit in the same GPU clock state for the pairing to buy anything, and this machine
 * switches state every few ticks. With a separate `evaluate` per sample, the two members of a pair
 * are separated by a full Node↔browser round trip; batched, they are adjacent frames on the page.
 *
 * ⚠️ Measured before the change: 82.9% integrity against an 85% floor, on a run whose fast state
 * held ~45% of samples (an earlier run at 17.5% fast read 95.4%). The more the machine switches, the
 * more the gap between a pair's two reads costs — so the gap is what shrinks.
 *
 * The census is still differenced across each individual step; `info.render.drawCalls` and
 * `.triangles` are CUMULATIVE on this page, because `?capture` stops the animation loop and
 * `Animation.js:75` is the only caller of `info.reset()`.
 */
async function sampleSequence(page, visibilities) {
  return page.evaluate(async (wanted) => {
    const renderer = globalThis.sugata.stage.renderer;
    const meshes = globalThis.sugata.session?.hair?.meshes ?? [];
    const out = [];

    for (const visible of wanted) {
      if (visible !== null) for (const mesh of meshes) mesh.visible = visible;

      const drawsBefore = renderer.info.render.drawCalls;
      const trianglesBefore = renderer.info.render.triangles;

      await globalThis.__SUGATA_STEP__(0);
      await renderer.resolveTimestampsAsync('render');

      out.push({
        ms: renderer.info.render.timestamp,
        draws: renderer.info.render.drawCalls - drawsBefore,
        triangles: renderer.info.render.triangles - trianglesBefore,
      });
    }

    return out;
  }, visibilities);
}

/**
 * Open a page and wait for the thing that is about to be ASSERTED, which for a hair arm is the
 * groom and not the body.
 *
 * 🔴 THREE SILENT READINESS DEFECTS ARE CLOSED HERE AND EVERY ONE COST A WRONG NUMBER.
 *
 *   1. Waiting for `typeof __SUGATA_STEP__ === 'function'`. It EXISTS before the figure does and
 *      returns `false` until it does; `hair-lightpath.mjs` once produced four uniform RGB(10,10,12)
 *      plates from exactly this.
 *   2. Waiting with an ASYNC PREDICATE. `waitForFunction` tests the return value for TRUTHINESS and
 *      an async arrow returns a Promise, which is truthy on the FIRST POLL whatever it resolves to.
 *      So the wait returns instantly and reports success. `page.evaluate` DOES await, so the poll
 *      below is driven from Node.
 *   3. Waiting for the FIGURE on a hair arm. `attachHair` is awaited further down the same async
 *      chain (`alive.js:2016`) and sets `session.hair` at its very end, so a page steps true with no
 *      groom in it — measured.
 */
async function openArm(context, arm) {
  const page = await context.newPage();
  page.setDefaultTimeout(600_000);
  page.on('pageerror', (error) => console.error(`PAGEERROR ${arm.key}`, error.message));
  page.on('requestfailed', (request) => console.error(
    `REQFAILED ${arm.key} ${request.url().slice(-70)} ${request.failure()?.errorText}`));
  page.on('response', (response) => {
    if (response.status() >= 400) console.error(`HTTP${response.status()} ${arm.key} ${response.url().slice(-70)}`);
  });

  await page.goto(arm.url, { waitUntil: 'load' });

  const deadline = Date.now() + Number(process.env.FC_READY_MS ?? 600_000);
  for (;;) {
    const ready = await page.evaluate(async (needsGroom) => {
      if (typeof globalThis.__SUGATA_STEP__ !== 'function') return false;
      if ((await globalThis.__SUGATA_STEP__(0)) !== true) return false;
      if (needsGroom !== true) return true;
      return (globalThis.sugata?.subsystems?.()?.hair ?? null) !== null;
    }, arm.wantsHair);
    if (ready === true) break;
    if (Date.now() > deadline) {
      const seen = await page.evaluate(() => ({
        step: typeof globalThis.__SUGATA_STEP__,
        hair: (globalThis.sugata?.subsystems?.()?.hair ?? null) === null ? 'null' : 'present',
        search: String(location.search),
      })).catch((error) => ({ probeFailed: error.message }));
      throw new Error(`arm "${arm.key}" never became ready\n  url  ${arm.url}\n  page ${JSON.stringify(seen)}`);
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  // 🔴 THE CENSUS COMES FROM `subsystems()`, NOT `report()`. `alive.js:1434`'s `report()` has no
  // `hair` key at all — the census is `censusOfShading` at `alive.js:3548`. Reading the wrong one
  // yields `undefined`, `?? null` turns that into `null`, and a fully attached groom is reported as
  // absent. That mistake stood for a day and caused a correct diagnosis to be withdrawn.
  const census = await page.evaluate(() => {
    const hair = globalThis.sugata?.subsystems?.()?.hair ?? null;
    return {
      hair: hair === null ? null : {
        groomMeshes: hair.groomMeshes ?? null,
        strandCount: hair.ribbons?.strandCount ?? null,
        triangles: hair.ribbons?.triangles ?? null,
      },
      togglableMeshes: globalThis.sugata?.session?.hair?.meshes?.length ?? 0,
    };
  });

  assertArmMatchesItsLabel(arm, census);
  console.log(`arm       ${arm.key.padEnd(20)} ${JSON.stringify(census)}`);
  return { page, census };
}

/**
 * An arm proves what it is DRAWING before any of its samples count.
 *
 * 🚩 THE REPO HAS ALREADY BEEN BITTEN BY THE SILENT VERSION OF THIS. `HairDynamics` and the ribbon
 * expansion both write `material.positionNode`; the solver won, every ribbon collapsed to zero
 * width, and the plate came back BALD RATHER THAN ERRORING. A timing harness with no census times
 * that happily and reports a number.
 */
function assertArmMatchesItsLabel(arm, census) {
  const fail = (why) => {
    throw new Error(
      `ARM "${arm.key}" IS NOT RENDERING WHAT IT CLAIMS: ${why}\n`
      + `  url    ${arm.url}\n  census ${JSON.stringify(census)}\n`
      + '  A timing taken on this arm would be a measurement of the wrong picture.');
  };

  if (arm.wantsHair === false) {
    if (census.hair !== null) fail('expected NO groom, and the page reports one');
    return;
  }

  if (census.hair === null) fail('expected a groom, and the page reports none');
  if (census.togglableMeshes === 0) fail('a groom with no meshes to toggle — the primitive here is '
    + 'the visibility toggle, so an arm with nothing to toggle would time as a perfect null');

  if (arm.wantsRibbons === false && census.hair.strandCount !== null) {
    fail(`expected CARDS, and the page reports ${census.hair.strandCount} ribbon strands`);
  }
  if (arm.wantsRibbons === true) {
    if (census.hair.strandCount === null) {
      fail('expected RIBBONS and the page reports a card groom — the .tfx did not load, and this arm '
        + 'would have timed the card path under a ribbon label');
    }
    if (census.hair.strandCount !== arm.strands) {
      fail(`expected ${arm.strands} strands, the page built ${census.hair.strandCount}`);
    }
    if (!(census.hair.triangles > 0)) {
      fail(`built ${census.hair.strandCount} strands but ${census.hair.triangles} triangles — this is `
        + 'the zero-width collapse, which renders BALD and does not throw');
    }
  }
}

/**
 * The per-tick condition sequence, carrying the bias controls.
 *
 * 🔴 THE ARM ORDER IS SHUFFLED PER TICK, NOT ROTATED, AND ROTATION WAS A MEASURED DEFECT.
 *
 * The first version used `arms[(index + tick) % arms.length]`. That does spread each arm evenly over
 * the positions in the cycle — mean global frame index came out 4.20-4.70 for all five conditions —
 * so it looked like it worked. **But a rotation preserves ADJACENCY exactly.** Reconstructing all
 * 200 ticks: every arm had exactly TWO possible predecessors, fixed by its index, in an 80/20 split,
 * in every tick of every run:
 *
 *     bald     <- bob11408 160 / bob4960  39
 *     cards    <- bald     160 / bob11408 40
 *     crop8832 <- cards    160 / bald     40      …and so on
 *
 * 🚩 SO PAGE IDENTITY AND PREDECESSOR IDENTITY WERE PERFECTLY CONFOUNDED, and the confound is worth
 * more than the effect. The natural experiment is in the record: between two runs, `crop8832`'s
 * predecessor changed from a ONE-condition arm to a THREE-condition arm, and it is the one page
 * whose hidden-frame cost moved 30 points while every other page moved 4-8. A whole finding —
 * "the same picture costs 30% more depending on which page draws it" — rested on that confound and
 * did not survive it.
 *
 * A seeded per-tick shuffle gives every arm every predecessor, so the confound becomes noise the
 * ticks average out. Deterministic in the tick, so a run is reproducible and a reader can rebuild
 * the exact schedule.
 *
 * ⚠️ WITHIN AN ARM the order still alternates by tick parity, exactly as before: `shown` and
 * `hidden` each occupy the first-after-the-gap slot half the time. That control was never the
 * problem — measured on `frame-budget.mjs`, a FIXED within-arm order was worth +1.77 ms between two
 * captures of one configuration.
 */
export function tickSchedule(arms, tick) {
  const order = arms.slice();
  const random = makeRandom(tick * 2654435761 + 1);
  for (let i = order.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  return order.map((arm) => {
    const conditions = arm.conditions.slice();
    if (tick % 2 === 1) conditions.reverse();
    return { arm: arm.key, steps: conditions.map((condition) => ({ ...condition })) };
  });
}

async function main() {
  const options = parseArguments(process.argv.slice(2));

  const playwright = await loadPlaywright();
  const server = await startViteServer(options.tfxDirectory);
  const browser = await playwright.chromium.launch({ channel: 'chromium', headless: true, args: GPU_FLAGS });
  console.log('chromium  headless (channel=chromium)');

  const context = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: 1 });
  const alive = (extra = '') => `${server.baseUrl}/packages/testbed/alive.html?${BASE_QUERY}${extra}`;

  // The arm set. `bald` and `cardsB` are not optional extras — they ARE nulls N1 and N2, and the
  // registration voids the round without them.
  // 🎯 `all` EXISTS BECAUSE PARITY CANNOT BE ASKED ACROSS TWO RUNS. Measured: a cards run sat at a
  // reference of 9.1-11.2 ms and a ribbon run at 6.7-7.2, which `REFERENCE_TOLERANCE` correctly
  // refuses to difference — the machine was in a different clock state on each night. The decision
  // rule is "parity with today's cards", so cards and ribbons have to share one clock, which means
  // one run and one fitted boundary.
  //
  // ⚠️ It costs six resident 1080x1920 WebGPU pages. That is the contention the ladder's own gate
  // measured at 67% spread, and it is accepted here deliberately: contention is common-mode inside
  // a tick, and a comparable parity figure is worth more than an uncontended incomparable one.
  const definitions = options.arms === 'all'
    ? [
      // 🔴 TWO CONDITIONS, BECAUSE A ONE-CONDITION ARM CANNOT BE SLOT-MATCHED TO ANY OTHER — and
      // `bald` is the denominator of every cross-page comparison. With one frame it is the only
      // condition whose read ALWAYS follows a page switch, while a three-condition arm's middle read
      // never does. That is a systematic difference between the two ends of the comparison, and it
      // was never controlled.
      { key: 'bald', url: alive(), wantsHair: false,
        conditions: [{ key: 'bald', visible: null }, { key: 'bald-bis', visible: null }] },
      { key: 'cards', url: alive('&hair=1'), wantsHair: true, wantsRibbons: false,
        conditions: [
          { key: 'cards+', visible: true },
          { key: 'cards-', visible: false },
          { key: 'cards-bis', visible: false },
        ] },
      ...RIBBON_ARMS.map((ribbon) => ({
        key: ribbon.key,
        url: alive(`&hair=1&hairribbons=/tfx/${ribbon.file}`),
        wantsHair: true, wantsRibbons: true, strands: ribbon.strands,
        conditions: [
          { key: `${ribbon.key}+`, visible: true },
          { key: `${ribbon.key}-`, visible: false },
        ],
      })),
    ]
    : options.arms === 'ribbons'
    ? [
      { key: 'bald', url: alive(), wantsHair: false,
        conditions: [{ key: 'bald', visible: null }, { key: 'bald-bis', visible: null }] },
      ...RIBBON_ARMS.map((ribbon) => ({
        key: ribbon.key,
        url: alive(`&hair=1&hairribbons=/tfx/${ribbon.file}`),
        wantsHair: true, wantsRibbons: true, strands: ribbon.strands,
        conditions: [
          { key: `${ribbon.key}+`, visible: true },
          { key: `${ribbon.key}-`, visible: false },
        ],
      })),
    ]
    : [
      { key: 'bald', url: alive(), wantsHair: false,
        conditions: [{ key: 'bald', visible: null }, { key: 'bald-bis', visible: null }] },
      { key: 'cardsA', url: alive('&hair=1'), wantsHair: true, wantsRibbons: false,
        conditions: [
          { key: 'cardsA+', visible: true },
          { key: 'cardsA-', visible: false },
          // N3's second read of the SAME hidden state — pure instrument noise, nothing physical
          // between the two. The cost pairs against `cardsA-`; this one only ever feeds the null.
          { key: 'cardsA-bis', visible: false },
        ] },
      { key: 'cardsB', url: alive('&hair=1'), wantsHair: true, wantsRibbons: false,
        conditions: [
          { key: 'cardsB+', visible: true },
          { key: 'cardsB-', visible: false },
        ] },
    ];

  try {
    for (const arm of definitions) {
      const opened = await openArm(context, arm);
      arm.page = opened.page;
      arm.census = opened.census;
    }

    // 🔴 THE WARM-UP IS ADAPTIVE, BECAUSE A FIXED ONE LET A CLOCK CHANGE LAND INSIDE THE SAMPLES.
    //
    // Measured on the 240-tick run: ticks 0-139 held a reference p50 of 12.97-13.09 with the
    // minimum pinned at 12.64-12.76, and from tick 140 the minimum collapsed to 4.04 ms and the
    // spread tripled. The GPU was BOOSTING, not throttling — sustained load finally raised the
    // clock, a hundred ticks after a 40-tick warm-up had declared the machine ready.
    //
    // So the warm-up stops when the machine says so rather than when a constant does: sample in
    // windows of 20 ticks and continue until two CONSECUTIVE windows agree within
    // `REFERENCE_TOLERANCE` — the constant already registered for deciding whether two reference
    // frames are the same clock state, used here for exactly that.
    const probe = definitions.find((arm) => arm.key === 'bald') ?? definitions[0];
    const probeCondition = probe.conditions.find((condition) => condition.key.endsWith('-'))
      ?? probe.conditions[0];
    let previousWindow = null;
    let warmed = 0;
    let settled = false;

    for (let window = 0; window * WARMUP_WINDOW_TICKS < options.warmupCap; window += 1) {
      const readings = [];
      for (let tick = 0; tick < WARMUP_WINDOW_TICKS; tick += 1) {
        for (const group of tickSchedule(definitions, warmed + tick)) {
          const values = await sampleSequence(pageOfDefinition(definitions, group.arm),
            group.steps.map((step) => step.visible));
          group.steps.forEach((step, index) => {
            if (step.key === probeCondition.key) readings.push(values[index].ms);
          });
        }
      }
      warmed += WARMUP_WINDOW_TICKS;
      const reference = quantile(readings, 0.5);
      const agreement = previousWindow === null ? null : comparable(previousWindow, reference);
      console.log(`warmup    ${String(warmed).padStart(3)} ticks  ${probeCondition.key} p50 `
        + `${reference.toFixed(3)}`
        + (agreement === null ? '' : `  ${(agreement.gap * 100).toFixed(2)}% vs previous`));
      if (agreement !== null && agreement.ok) { settled = true; break; }
      previousWindow = reference;
    }

    if (settled === false) {
      throw new Error(
        `the machine never settled: ${warmed} warm-up ticks and two consecutive windows still `
        + `disagree by more than ${(REFERENCE_TOLERANCE * 100).toFixed(0)}%.\n`
        + '  Sampling now would straddle two clock states, which is the defect this warm-up exists '
        + 'to prevent. Raise --warmup-cap, or take the machine off whatever else it is doing.');
    }

    const byCondition = new Map();

    for (let tick = 0; tick < options.ticks; tick += 1) {
      for (const group of tickSchedule(definitions, tick)) {
        const values = await sampleSequence(pageOfDefinition(definitions, group.arm),
          group.steps.map((step) => step.visible));
        group.steps.forEach((step, index) => {
          if (byCondition.has(step.key) === false) byCondition.set(step.key, []);
          byCondition.get(step.key).push({ tick, ...values[index] });
        });
      }
      if ((tick + 1) % 25 === 0) console.log(`          tick ${tick + 1}/${options.ticks}`);
    }

    options.warmedTicks = warmed;
    const report = adjudicate(byCondition, definitions, options);

    // 🔴 WRITE BEFORE PRINTING, AND A CRASH IN `print` IS WHY. A null in one statistic threw inside
    // the report formatter, `writeFileSync` never ran, and forty minutes of samples were destroyed
    // by a `toFixed`. The samples are the expensive, irreplaceable part; the table is a view of them
    // that can be regenerated from the file. Ordering them the other way round makes every future
    // formatting bug a lost capture.
    //
    // 🚩 The filename is also stamped with the arm set AND the sha, because a capture that
    // overwrites its own predecessor cannot support a claim quoted from the predecessor — four
    // figures in R34's machine characterisation were quoted from a run this tool had already
    // overwritten, and none of them could be checked.
    const stamp = options.headSha === null ? 'nosha' : options.headSha;
    const file = path.join(options.outDirectory, `frame-cost-${options.arms}-${stamp}.json`);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, `${JSON.stringify(report, null, 2)}\n`);
    console.log(`\nreport    ${path.relative(REPOSITORY_ROOT, file)}`);

    print(report);
    process.exitCode = report.calibration.passed ? 0 : 1;
  } finally {
    await browser.close();
    await server.close();
  }
}

/** Warm-up is measured in windows of this many ticks; two agreeing windows end it. */
const WARMUP_WINDOW_TICKS = 20;

const pageOfDefinition = (definitions, key) => definitions.find((arm) => arm.key === key).page;

const RIBBON_ARMS = [
  { key: 'crop8832', file: 'crop01_g050_d23.tfx', strands: 8832 },
  { key: 'bob4960', file: 'bob01_g050_d10.tfx', strands: 4960 },
  { key: 'bob11408', file: 'bob01_g050_d23.tfx', strands: 11408 },
];

/**
 * Everything the registration promised, in the order it promised it: stimulus, then calibration,
 * then — only if calibration held — cost.
 */
export function adjudicate(byCondition, definitions, options) {
  const samplesFor = (key) => byCondition.get(key) ?? [];
  const censusDeltasBetween = (a, b) => {
    const byTick = new Map(samplesFor(a).map((row) => [row.tick, row]));
    const seen = new Map();
    for (const row of samplesFor(b)) {
      const other = byTick.get(row.tick);
      if (other === undefined) continue;
      const delta = { draws: row.draws - other.draws, triangles: row.triangles - other.triangles };
      seen.set(`${delta.draws}/${delta.triangles}`, delta);
    }
    return [...seen.values()];
  };

  // 🔴 ONE BOUNDARY, FITTED ON EVERY SAMPLE THE RUN COLLECTED. See `fitClockBoundary` for the
  // measured reason it is not fitted per arm.
  const boundary = fitClockBoundary([...byCondition.values()].flat().map((row) => row.ms));

  /** A pair of conditions, adjudicated pooled AND inside each clock state. G0. */
  const evaluateAcrossStates = (label, a, b) => {
    const split = pairedByTickAndState(samplesFor(a), samplesFor(b), boundary);
    const census = censusDeltasBetween(a, b);
    const pooled = evaluateNull(label, split.all, census);
    const states = {};
    for (const state of ['fast', 'slow']) {
      if (split[state].length >= STATE_MIN_PAIRS) {
        states[state] = evaluateNull(`${label} · ${state}`, split[state], census);
      }
    }
    return {
      ...pooled,
      integrity: split.integrity,
      straddled: split.straddled,
      states,
      // A null passes only if it passes POOLED AND in every state populated enough to judge.
      passedEverywhere: pooled.passed && Object.values(states).every((entry) => entry.passed),
    };
  };

  const nulls = [];
  const hidden = [...byCondition.keys()].filter((key) => key.endsWith('-'));
  if (byCondition.has('bald')) {
    for (const key of hidden) nulls.push(evaluateAcrossStates(`N1 ${key} vs bald`, 'bald', key));
  }
  for (let i = 0; i < hidden.length; i += 1) {
    for (let j = i + 1; j < hidden.length; j += 1) {
      nulls.push(evaluateAcrossStates(`N2 ${hidden[j]} vs ${hidden[i]}`, hidden[i], hidden[j]));
    }
  }
  // ⚠️ THE STEM IS NOT ALWAYS `X-`. A `-bis` condition repeats whatever its arm's base condition is
  // called, and `bald`'s base is `bald`, not `bald-`. Deriving the stem by string surgery alone
  // yielded a name no condition has, which paired to n=0 and crashed the report. Resolve against the
  // conditions that actually exist.
  for (const key of [...byCondition.keys()].filter((k) => k.endsWith('-bis'))) {
    const stem = [key.replace(/-bis$/, '-'), key.replace(/-bis$/, '')]
      .find((candidate) => byCondition.has(candidate));
    if (stem === undefined) continue;
    nulls.push(evaluateAcrossStates(`N3 ${key} vs ${stem}`, stem, key));
  }

  // --- the costs -------------------------------------------------------------------------------
  const costs = [];
  for (const arm of definitions) {
    const shown = arm.conditions.find((condition) => condition.key.endsWith('+'));
    const hiddenCondition = arm.conditions.find((condition) => condition.key.endsWith('-'));
    if (shown === undefined || hiddenCondition === undefined) continue;

    const reference = samplesFor(hiddenCondition.key);
    const split = pairedByTickAndState(reference, samplesFor(shown.key), boundary);
    const stimulus = censusDeltasBetween(hiddenCondition.key, shown.key);
    const referenceIn = (state) => quantile(
      reference.filter((row) => boundary === null || (row.ms <= boundary.threshold) === (state === 'fast'))
        .map((row) => row.ms), 0.5);

    const states = {};
    for (const state of ['fast', 'slow']) {
      states[state] = split[state].length < STATE_MIN_PAIRS
        ? { available: false, n: split[state].length }
        : { available: true, reference: referenceIn(state), ...summarisePair(split[state]) };
    }

    costs.push({
      arm: arm.key,
      census: arm.census,
      integrity: split.integrity,
      straddled: split.straddled,
      considered: split.considered,
      states,
      // Reported last and labelled: the mixture is a property of this run's fast share, not of the
      // groom. It is here because the record has always quoted one number and a reader needs to see
      // it beside the two that supersede it.
      pooled: { reference: quantile(reference.map((row) => row.ms), 0.5), ...summarisePair(split.all) },
      stimulus,
      stimulusOk: stimulus.length > 0 && stimulus.every((delta) => delta.draws > 0 && delta.triangles > 0),
    });
  }

  // ⚠️ DRIFT IS REPORTED, NOT GATED, AND v2 §2 SAYS WHY. The machine switches state every few ticks
  // indefinitely, so a drift gate on the reference refuses every run it will ever produce. The
  // detector is kept because it is validated and a reader wants to know whether the run moved — it
  // simply no longer decides. What decides is pair integrity, the property that actually threatens
  // a paired measurement.
  const drift = [...hidden, ...(byCondition.has('bald') ? ['bald'] : [])]
    .map((key) => ({ key, ...(driftByPermutation(samplesFor(key)) ?? { p: null }) }))
    .filter((entry) => entry.p !== null);

  const integrityFloor = Math.min(...costs.map((entry) => entry.integrity ?? 1), 1);
  // Physicality: an impossible answer means the instrument is at fault. v3 extends this to the
  // POOLED cost as the registration states. Negative-inside-the-noise is NOT RESOLVED rather than
  // void — a point estimate inside the noise is not evidence either way.
  const nonPhysical = costs.flatMap((entry) => [
    ...['fast', 'slow']
      .filter((state) => entry.states[state].available
        && entry.states[state].p50 < 0 && entry.states[state].spansZero === false)
      .map((state) => `${entry.arm} · ${state}: ${entry.states[state].p50.toFixed(3)} ms with a CI excluding zero`),
    ...(entry.pooled.p50 !== null && entry.pooled.p50 < 0 && entry.pooled.spansZero === false
      ? [`${entry.arm} · pooled: ${entry.pooled.p50.toFixed(3)} ms with a CI excluding zero`] : []),
  ]);

  const calibration = {
    // 🎯 v3: THE NULLS DECIDE, PLUS PHYSICALITY AND THE FITTED BOUNDARY. Pair integrity is reported
    // below but gates nothing — see PAIR_INTEGRITY_MIN for the measured reason.
    passed: nulls.every((entry) => entry.passedEverywhere)
      && nonPhysical.length === 0
      && boundary !== null,
    boundary,
    nulls,
    drift,
    integrityFloor,
    nonPhysical,
    constants: {
      NULL_MAX_MS, NULL_SIGN_Z, REFERENCE_TOLERANCE, REPLICATE_TOLERANCE,
      PAIR_INTEGRITY_MIN, STATE_MIN_PAIRS, BOOTSTRAP_RESAMPLES,
    },
  };

  return {
    tool: 'tools/critic/frame-cost.mjs',
    registration: 'docs/superpowers/specs/2026-08-24-frame-cost-v3-preregistration.md',
    generatedAt: new Date().toISOString(),
    headSha: options.headSha,
    viewport: VIEWPORT,
    ticks: options.ticks,
    warmupTicks: options.warmedTicks ?? null,
    armSet: options.arms,
    calibration,
    costs,
    samples: Object.fromEntries([...byCondition].map(([key, rows]) => [key, rows])),
  };
}

function print(report) {
  const { calibration, costs } = report;
  const { boundary } = calibration;

  console.log(`\n${'='.repeat(100)}`);
  if (boundary === null) {
    console.log('🔴 NO CLOCK STATES COULD BE FITTED — the samples are unimodal, or too few.');
    console.log('   v2 conditions on state, so without states it has nothing to condition on.');
    return;
  }

  console.log(`CLOCK STATES, fitted ONCE on every sample in the run: fast ${boundary.fast.toFixed(3)} / `
    + `slow ${boundary.slow.toFixed(3)} ms  (${boundary.ratio.toFixed(2)}×, separation `
    + `${boundary.separation.toFixed(1)} SD, boundary ${boundary.threshold.toFixed(3)})\n`);

  console.log('CALIBRATION — every null pooled AND inside each state (G0).\n');
  console.log(`registered: |p50| <= ${NULL_MAX_MS} ms   sign within ${NULL_SIGN_Z}σ   `
    + `a state needs ${STATE_MIN_PAIRS} pairs   (v3: nulls + physicality decide; integrity is reported)\n`);
  console.log('null                            state      n      p50    sign      z   census  verdict');
  console.log('-'.repeat(100));
  for (const entry of calibration.nulls) {
    const row = (label, state, item) => console.log(
      `${label.padEnd(30)} ${state.padEnd(7)} ${String(item.n).padStart(4)} ${signed(item.p50)} `
      + `${item.sign.fraction === null ? '     —' : `${(item.sign.fraction * 100).toFixed(1)}%`.padStart(6)} `
      + `${item.sign.z === null ? '     —' : item.sign.z.toFixed(2).padStart(6)} `
      + `${item.censusDeltas.map((d) => `${d.draws}/${d.triangles}`).join(',').padStart(7)}  `
      + `${item.passed ? '✅' : '🔴 FAIL'}`);
    row(entry.label, 'pooled', entry);
    for (const [state, item] of Object.entries(entry.states)) row('', state, item);
    for (const reason of entry.reasons) console.log(`      ${reason}`);
    for (const item of Object.values(entry.states)) {
      for (const reason of item.reasons) console.log(`      ${item.label}: ${reason}`);
    }
  }

  console.log(`\npair integrity (REPORTED, not gated — v3 §1): worst ${(calibration.integrityFloor * 100).toFixed(1)}% `
    + `of pairs share a clock state${calibration.integrityFloor < PAIR_INTEGRITY_MIN
      ? ' — low: the machine is switching faster than the pair span, so per-STATE rows carry the clean reading'
      : ''}`);
  for (const reason of calibration.nonPhysical) console.log(`🔴 NON-PHYSICAL: ${reason}`);
  console.log('reference drift (REPORTED, not gated — v2 §2): '
    + calibration.drift.map((entry) => `${entry.key} p=${entry.p.toFixed(3)}`).join('  '));

  if (calibration.passed === false) {
    console.log(`\n${'='.repeat(100)}`);
    console.log('🔴 THE ROUND IS VOID. No costs printed — §6 of the v2 registration registered this');
    console.log('   refusal in advance.');
    return;
  }

  console.log(`\n${'='.repeat(100)}`);
  console.log('COST OF THE GROOM — paired within tick AND within clock state.\n');
  console.log('arm          state      n       p50           95% CI        sign   reference   integrity');
  console.log('-'.repeat(100));
  for (const entry of costs) {
    for (const state of ['fast', 'slow']) {
      const item = entry.states[state];
      if (item.available === false) {
        console.log(`${entry.arm.padEnd(12)} ${state.padEnd(6)} ${String(item.n).padStart(4)}   `
          + `⚪ UNAVAILABLE — ${item.n} retained pairs, ${STATE_MIN_PAIRS} required`);
        continue;
      }
      console.log(
        `${entry.arm.padEnd(12)} ${state.padEnd(6)} ${String(item.n).padStart(4)} ${signed(item.p50)} `
        + `${`[${item.ci.low.toFixed(3)}, ${item.ci.high.toFixed(3)}]`.padStart(18)} `
        + `${(item.sign.fraction * 100).toFixed(1).padStart(6)}% ${item.reference.toFixed(3).padStart(9)} `
        + `${(entry.integrity * 100).toFixed(1).padStart(9)}%`
        + `${item.spansZero ? '  ⚪ NOT RESOLVED' : ''}`);
    }
    // ⚠️ THE MIXTURE IS A PROPERTY OF THIS RUN, NOT OF THE GROOM. Quoted because the record has
    // always quoted one number, and superseded by the two rows above it.
    console.log(`${''.padEnd(12)} ${'(mix)'.padEnd(6)} ${String(entry.pooled.n).padStart(4)} `
      + `${signed(entry.pooled.p50)} ${`[${entry.pooled.ci.low.toFixed(3)}, ${entry.pooled.ci.high.toFixed(3)}]`.padStart(18)} `
      + `${(entry.pooled.sign.fraction * 100).toFixed(1).padStart(6)}% ${entry.pooled.reference.toFixed(3).padStart(9)}`
      + '   ⚠️ a mixture of the two rows above, weighted by this run\'s fast share');
    console.log(`${''.padEnd(12)} stimulus ${entry.stimulus.map((d) => `+${d.draws} draws +${d.triangles} tris`).join(', ')}`
      + ` ${entry.stimulusOk ? '' : '🔴'}  ·  ${entry.straddled} of ${entry.considered} pairs dropped as straddling`);
  }

  // 🎯 v3: WITHIN ONE RUN, CROSS-ARM DELTAS ARE LICENSED BY N2, NOT BY A POOLED-REFERENCE RULE.
  // Two arms here share their clock context by construction — same ticks, interleaved, one machine —
  // and N2 is the PAIRED test of exactly the question "are these two pages' hidden frames the
  // same". The old rule compared pooled medians of a MIXTURE: across five identical pictures the
  // pooled spread was 29.7% while the slow-state spread was 0.8%, and the ordering tracked fast
  // share exactly. It refused what the paired null licenses. This block prints only when
  // calibration passed, and calibration includes every N2 — so a failed N2 already silenced it.
  console.log('\nCROSS-ARM DELTAS within this run — licensed by N2 passing (v3 §1); pooled paired costs:\n');
  for (let i = 0; i < costs.length; i += 1) {
    for (let j = i + 1; j < costs.length; j += 1) {
      const a = costs[i];
      const b = costs[j];
      if (a.pooled.p50 === null || b.pooled.p50 === null) continue;
      const delta = b.pooled.p50 - a.pooled.p50;
      console.log(`  ${b.arm} − ${a.arm}: ${delta >= 0 ? '+' : ''}${delta.toFixed(3)} ms`);
    }
  }
}

const signed = (value) => (value === null ? '     —' : `${value >= 0 ? '+' : ''}${value.toFixed(3)}`.padStart(8));

// ================================================================================================
// PLUMBING
// ================================================================================================

async function startViteServer(tfxDirectory) {
  const { createServer } = await import('vite');

  const mountTfx = {
    name: 'sugata-frame-cost-tfx',
    configureServer(server) {
      server.middlewares.use('/tfx', (request, response, next) => {
        const name = (request.url ?? '').replace(/^\//, '').split('?')[0];
        const file = path.join(tfxDirectory, name);
        if (name === '' || fs.existsSync(file) === false) return next();
        response.setHeader('Content-Type', 'application/octet-stream');
        response.setHeader('Content-Length', String(fs.statSync(file).size));
        fs.createReadStream(file).pipe(response);
      });
    },
  };

  // 🚩 `open: false` IS NOT COSMETIC. `vite.spikes.config.js` once ended with
  // `server: { open: '/tools/spikes/' }`, which is right for a human typing `npm run spikes` and
  // wrong for anything programmatic — `createServer` inherits it, so a headless timing run launched
  // Chrome at a bare directory with no `index.html` in the OWNER'S REAL BROWSER, on every run. Fixed
  // at the config, and stated here because any tool that starts a config programmatically owns this.
  const server = await createServer({
    configFile: path.join(REPOSITORY_ROOT, 'vite.spikes.config.js'),
    plugins: [mountTfx],
    server: { port: 5196, strictPort: false, hmr: false, watch: { ignored: ['**'] }, open: false },
    logLevel: 'warn',
  });

  await server.listen();
  server.baseUrl = server.resolvedUrls.local[0].replace(/\/$/, '');
  console.log(`vite      ${server.baseUrl}`);
  return server;
}

async function loadPlaywright() {
  const candidates = ['playwright'];
  const cache = path.join(process.env.HOME ?? '', '.npm', '_npx');
  if (fs.existsSync(cache)) {
    candidates.push(...fs.readdirSync(cache)
      .map((entry) => path.join(cache, entry, 'node_modules', 'playwright'))
      .filter((candidate) => fs.existsSync(candidate)));
  }
  const require = createRequire(import.meta.url);
  for (const candidate of candidates) {
    try {
      const namespace = await import(pathToFileURL(require.resolve(candidate)).href);
      if (namespace?.chromium) return namespace;
      if (namespace?.default?.chromium) return namespace.default;
    } catch { /* next */ }
  }
  throw new Error('playwright not resolvable');
}

function parseArguments(argv) {
  const options = {
    outDirectory: path.join(REPOSITORY_ROOT, 'captures', 'hair-r34-frame-cost', 'data'),
    // Where `tools/figure-pipeline/build-tfx.sh` leaves its exports. Ignored by git — the ribbon
    // arms are timed against the file on disk rather than a copy, for `strand-spike.mjs`'s reason:
    // a plate of a stale duplicate is a plate of the wrong thing.
    tfxDirectory: path.join(REPOSITORY_ROOT, 'tmp', 'tfx'),
    ticks: 240,
    warmupCap: 600,
    arms: 'cards',
    headSha: null,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const flag = argv[index];
    const value = argv[index + 1];
    switch (flag) {
      case '--out': options.outDirectory = path.resolve(value); index += 1; break;
      case '--tfx': options.tfxDirectory = path.resolve(value); index += 1; break;
      case '--ticks': options.ticks = Number(value); index += 1; break;
      case '--warmup-cap': options.warmupCap = Number(value); index += 1; break;
      case '--arms': options.arms = value; index += 1; break;
      case '--sha': options.headSha = value; index += 1; break;
      default: throw new Error(`unknown argument '${flag}'`);
    }
  }

  if (['cards', 'ribbons', 'all'].includes(options.arms) === false) {
    throw new Error(`--arms must be 'cards', 'ribbons' or 'all', got '${options.arms}'`);
  }
  return options;
}

// Importable for the selftest; only runs the browser when invoked as a script.
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main();
}
