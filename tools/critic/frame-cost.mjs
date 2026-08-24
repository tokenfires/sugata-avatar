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
 * Cut a run into consecutive blocks of `blockTicks`, discarding a short tail.
 *
 * 🔴 WHY BLOCKS EXIST, AND THE HONEST VERSION OF IT. The first calibrated run VOIDED ITSELF on the
 * drift gate — a hidden reference ran 13.078 → 12.821 over 200 ticks, 2.00% against a 2% ceiling.
 * Amendment 1 to the registration named a rule in advance to decide whether that gate was
 * mis-specified, and the rule **fired against the hypothesis**: split into thirds, the paired cost
 * moved 40.7% and 15.4% while the reference moved 2.4%, so drift is NOT common-mode and the gate
 * stays. The registered branch for that outcome is a shorter run.
 *
 * ⚠️ AND THAT RULE WAS UNDERPOWERED, WHICH IS RECORDED RATHER THAN USED TO OVERTURN IT. The three
 * thirds' bootstrap intervals all OVERLAP — 0.5-1.2 ms wide against a point spread of 0.646 ms — so
 * a 10% threshold on point estimates at n=66 could not have separated common-mode drift from
 * sampling noise in either direction. The verdict stands because it was registered; the limitation
 * stands because it is true. Both belong to the next registration, not to a re-reading of this one.
 *
 * 🎯 BLOCKING IS NOT A WAY AROUND THE GATE. Between-block drift is not ignored — it is moved from
 * "void the run" to "partition the run by clock state", which is strictly MORE information and is
 * what §3 of the registration already asks for: a cost without its clock state is not a number.
 * Blocks whose references disagree are reported as separate costs at separate clocks, never averaged.
 *
 * Partitioning happens at ADJUDICATION, not at capture, so block size is an analysis parameter and
 * one capture can be read at several. Nothing is re-sampled to make a gate pass.
 */
export function partitionIntoBlocks(ticks, blockTicks) {
  const blocks = [];
  for (let lo = 0; lo + blockTicks <= ticks; lo += blockTicks) {
    blocks.push({ index: blocks.length, loTick: lo, hiTick: lo + blockTicks });
  }
  return blocks;
}

/**
 * Group blocks into clock states: every member within `REFERENCE_TOLERANCE` of the cluster's floor.
 *
 * Deterministic and greedy from the lowest reference upward, so two readers cluster identically.
 * Chaining is refused on purpose — membership is measured against the cluster's FLOOR rather than
 * its neighbour, or a slow monotone drift would chain every block into one cluster spanning far
 * more than the tolerance it claims to enforce.
 */
export function clusterByReference(blocks) {
  const ordered = [...blocks].sort((a, b) => a.reference - b.reference);
  const clusters = [];
  for (const block of ordered) {
    const open = clusters[clusters.length - 1];
    if (open !== undefined && (block.reference - open.floor) / open.floor <= REFERENCE_TOLERANCE) {
      open.blocks.push(block);
      open.ceiling = block.reference;
    } else {
      clusters.push({ floor: block.reference, ceiling: block.reference, blocks: [block] });
    }
  }
  return clusters.sort((a, b) => b.blocks.length - a.blocks.length);
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

/**
 * Drift within one run: the hidden condition's p50 over the first third of ticks against the last.
 *
 * The three prior runs show this happening BETWEEN runs — bald frames of 8.424 against 13.06 — and
 * nothing stops it happening inside one. A run whose own yardstick moved is not one run.
 */
export function driftAcrossRun(samples) {
  if (samples.length < 24) return null;
  const ordered = [...samples].sort((a, b) => a.tick - b.tick);
  const third = Math.floor(ordered.length / 3);
  const head = quantile(ordered.slice(0, third).map((row) => row.ms), 0.5);
  const tail = quantile(ordered.slice(-third).map((row) => row.ms), 0.5);
  const check = comparable(head, tail);
  return { head, tail, gap: check.gap, passed: check.ok };
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
async function sampleOnce(page, visible) {
  return page.evaluate(async (wanted) => {
    const renderer = globalThis.sugata.stage.renderer;
    const meshes = globalThis.sugata.session?.hair?.meshes ?? [];
    if (wanted !== null) for (const mesh of meshes) mesh.visible = wanted;

    const drawsBefore = renderer.info.render.drawCalls;
    const trianglesBefore = renderer.info.render.triangles;

    await globalThis.__SUGATA_STEP__(0);
    await renderer.resolveTimestampsAsync('render');

    return {
      ms: renderer.info.render.timestamp,
      draws: renderer.info.render.drawCalls - drawsBefore,
      triangles: renderer.info.render.triangles - trianglesBefore,
    };
  }, visible);
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
 * The per-tick condition sequence, carrying both bias controls.
 *
 * 🔴 WITHIN-ARM ORDER ALTERNATES BY TICK PARITY so `shown` and `hidden` each occupy the
 * first-after-the-gap slot exactly half the time. A FIXED order is not a small effect: measured on
 * `frame-budget.mjs`, two captures of ONE configuration differing only in cycle position read
 * +1.77 ms apart.
 *
 * ARM ORDER ROTATES BY TICK so no arm permanently owns a position in the cycle either.
 */
export function tickSchedule(arms, tick) {
  const rotated = arms.map((_, index) => arms[(index + tick) % arms.length]);
  const schedule = [];
  for (const arm of rotated) {
    const conditions = arm.conditions.slice();
    if (tick % 2 === 1) conditions.reverse();
    for (const condition of conditions) schedule.push({ arm: arm.key, ...condition });
  }
  return schedule;
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
  const definitions = options.arms === 'ribbons'
    ? [
      { key: 'bald', url: alive(), wantsHair: false,
        conditions: [{ key: 'bald', visible: null }] },
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
        conditions: [{ key: 'bald', visible: null }] },
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
        for (const step of tickSchedule(definitions, warmed + tick)) {
          const reading = await sampleOnce(pageOfDefinition(definitions, step.arm), step.visible);
          if (step.key === probeCondition.key) readings.push(reading.ms);
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
      for (const step of tickSchedule(definitions, tick)) {
        const reading = await sampleOnce(pageOfDefinition(definitions, step.arm), step.visible);
        if (byCondition.has(step.key) === false) byCondition.set(step.key, []);
        byCondition.get(step.key).push({ tick, ...reading });
      }
      if ((tick + 1) % 25 === 0) console.log(`          tick ${tick + 1}/${options.ticks}`);
    }

    options.warmedTicks = warmed;
    const report = adjudicate(byCondition, definitions, options);
    print(report);

    const file = path.join(options.outDirectory, `frame-cost-${options.arms}.json`);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, `${JSON.stringify(report, null, 2)}\n`);
    console.log(`\nreport    ${path.relative(REPOSITORY_ROOT, file)}`);
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

  // --- the nulls ---------------------------------------------------------------------------------
  const nulls = [];
  const hidden = [...byCondition.keys()].filter((key) => key.endsWith('-'));

  if (byCondition.has('bald')) {
    for (const key of hidden) {
      nulls.push(evaluateNull(`N1 ${key} vs bald`, pairedByTick(samplesFor('bald'), samplesFor(key)),
        censusDeltasBetween('bald', key)));
    }
  }
  for (let i = 0; i < hidden.length; i += 1) {
    for (let j = i + 1; j < hidden.length; j += 1) {
      nulls.push(evaluateNull(`N2 ${hidden[j]} vs ${hidden[i]}`,
        pairedByTick(samplesFor(hidden[i]), samplesFor(hidden[j])),
        censusDeltasBetween(hidden[i], hidden[j])));
    }
  }
  for (const key of [...byCondition.keys()].filter((k) => k.endsWith('-bis'))) {
    const base = key.replace(/-bis$/, '-');
    nulls.push(evaluateNull(`N3 ${key} vs ${base}`,
      pairedByTick(samplesFor(base), samplesFor(key)), censusDeltasBetween(base, key)));
  }

  // --- drift, checked PER BLOCK ------------------------------------------------------------------
  //
  // A whole run is not the unit any more. See `partitionIntoBlocks` for why, and for the fact that
  // Amendment 1's rule fired AGAINST the hypothesis that motivated blocking — the branch taken here
  // is the one the registration prescribed for that outcome, not a re-reading of the gate.
  const blocks = partitionIntoBlocks(options.ticks, options.blockTicks);
  const inBlock = (key, block) =>
    samplesFor(key).filter((row) => row.tick >= block.loTick && row.tick < block.hiTick);

  const drifts = [];
  for (const key of [...hidden, ...(byCondition.has('bald') ? ['bald'] : [])]) {
    for (const block of blocks) {
      const drift = driftByPermutation(inBlock(key, block));
      if (drift !== null) drifts.push({ key, block: block.index, ...drift });
    }
  }

  const calibration = {
    passed: nulls.every((entry) => entry.passed) && drifts.every((entry) => entry.passed),
    nulls,
    drifts,
    blockTicks: options.blockTicks,
    blocks: blocks.length,
    constants: { NULL_MAX_MS, NULL_SIGN_Z, REFERENCE_TOLERANCE, REPLICATE_TOLERANCE, BOOTSTRAP_RESAMPLES },
  };

  // --- the costs, which are only computed if the instrument earned the right to compute them ------
  const costs = [];
  for (const arm of definitions) {
    const shown = arm.conditions.find((condition) => condition.key.endsWith('+'));
    const hiddenCondition = arm.conditions.find((condition) => condition.key.endsWith('-'));
    if (shown === undefined || hiddenCondition === undefined) continue;

    const perBlock = blocks.map((block) => {
      const reference = inBlock(hiddenCondition.key, block);
      const differences = pairedByTick(reference, inBlock(shown.key, block));
      return {
        index: block.index,
        reference: quantile(reference.map((row) => row.ms), 0.5),
        differences,
        ...summarisePair(differences),
      };
    }).filter((block) => block.reference !== null && block.n > 0);

    // 🎯 THE CLOCK STATE PARTITIONS THE RUN; IT DOES NOT GET AVERAGED OUT. Blocks whose reference
    // frames agree are one clock state and pool into one cost. Blocks that disagree are a DIFFERENT
    // clock state and are reported separately, because §3 registered that a cost without its clock
    // state is not a number — and because averaging across states is precisely how a 94% spread got
    // published as one figure.
    const clusters = clusterByReference(perBlock);
    const main = clusters[0] ?? null;
    const pooled = main === null ? [] : main.blocks.flatMap((block) => block.differences);
    const stimulus = censusDeltasBetween(hiddenCondition.key, shown.key);

    costs.push({
      arm: arm.key,
      census: arm.census,
      reference: main === null ? null : quantile(main.blocks.map((block) => block.reference), 0.5),
      referenceRange: main === null ? null : { floor: main.floor, ceiling: main.ceiling },
      blocksPooled: main === null ? 0 : main.blocks.length,
      blocksTotal: perBlock.length,
      // Every block's own figure, so a reader can see the spread the pooled number came from rather
      // than taking the pooling on trust.
      perBlock: perBlock.map(({ differences: _ignored, ...rest }) => rest),
      otherClocks: clusters.slice(1).map((cluster) => ({
        floor: cluster.floor,
        ceiling: cluster.ceiling,
        blocks: cluster.blocks.length,
        p50: quantile(cluster.blocks.flatMap((block) => block.differences), 0.5),
      })),
      stimulus,
      // A toggle that changes no draw is not a toggle, and it would time as a perfect null.
      stimulusOk: stimulus.length > 0 && stimulus.every((delta) => delta.draws > 0 && delta.triangles > 0),
      ...summarisePair(pooled),
    });
  }

  return {
    tool: 'tools/critic/frame-cost.mjs',
    registration: 'docs/superpowers/specs/2026-08-23-frame-cost-preregistration.md',
    generatedAt: new Date().toISOString(),
    headSha: options.headSha,
    viewport: VIEWPORT,
    ticks: options.ticks,
    blockTicks: options.blockTicks,
    warmupTicks: options.warmedTicks ?? null,
    armSet: options.arms,
    calibration,
    costs,
    samples: Object.fromEntries([...byCondition].map(([key, rows]) => [key, rows])),
  };
}

function print(report) {
  const { calibration, costs } = report;

  console.log(`\n${'='.repeat(96)}`);
  console.log('CALIBRATION — the instrument reads zero on pairs that ARE zero, or it does not speak.\n');
  console.log(`registered: |p50| <= ${NULL_MAX_MS} ms   sign within ${NULL_SIGN_Z}σ of a coin   `
    + `reference within ${(REFERENCE_TOLERANCE * 100).toFixed(0)}%\n`);
  console.log('null                          n      p50      mean    sign      z   census  verdict');
  console.log('-'.repeat(96));
  for (const entry of calibration.nulls) {
    const census = entry.censusDeltas.map((d) => `${d.draws}/${d.triangles}`).join(',');
    console.log(
      `${entry.label.padEnd(28)} ${String(entry.n).padStart(4)} `
      + `${signed(entry.p50)} ${signed(entry.mean)} `
      + `${(entry.sign.fraction * 100).toFixed(1).padStart(6)}% ${entry.sign.z.toFixed(2).padStart(6)} `
      + `${census.padStart(7)}  ${entry.passed ? '✅' : '🔴 FAIL'}`);
    for (const reason of entry.reasons) console.log(`      ${reason}`);
  }

  console.log(`\ndrift, PERMUTATION TEST per block of ${calibration.blockTicks} ticks `
    + `(KS between halves, null from ${DRIFT_PERMUTATIONS} shuffles, α ${DRIFT_ALPHA}):`);
  const byKey = new Map();
  for (const entry of calibration.drifts) {
    if (byKey.has(entry.key) === false) byKey.set(entry.key, []);
    byKey.get(entry.key).push(entry);
  }
  for (const [key, entries] of byKey) {
    const worst = entries.reduce((a, b) => (b.p < a.p ? b : a));
    const red = entries.filter((entry) => entry.passed === false);
    console.log(`  ${key.padEnd(14)} ${entries.length} blocks, smallest p ${worst.p.toFixed(4)} `
      + `(block ${worst.block}, KS ${worst.statistic.toFixed(3)}, ${worst.head.toFixed(2)} -> ${worst.tail.toFixed(2)})  `
      + (red.length === 0 ? '✅' : `🔴 FAIL in ${red.length}: blocks ${red.map((e) => e.block).join(', ')}`));
  }

  if (calibration.passed === false) {
    console.log(`\n${'='.repeat(96)}`);
    console.log('🔴 THE ROUND IS VOID. An instrument that cannot read zero on a pair it knows is zero');
    console.log('   has not earned the right to report a pair it does not know. No costs printed —');
    console.log('   see §8 of the registration, which registered this refusal in advance.');
    return;
  }

  console.log(`\n${'='.repeat(96)}`);
  console.log('COST OF THE GROOM — paired within tick, so the clock-state mixture cancels.\n');
  console.log('arm            n       p50      mean          95% CI        sign   reference  blocks  stim');
  console.log('-'.repeat(96));
  for (const entry of costs) {
    const ci = entry.ci === null ? '—' : `[${entry.ci.low.toFixed(3)}, ${entry.ci.high.toFixed(3)}]`;
    console.log(
      `${entry.arm.padEnd(13)} ${String(entry.n).padStart(4)} ${signed(entry.p50)} ${signed(entry.mean)} `
      + `${ci.padStart(18)} ${(entry.sign.fraction * 100).toFixed(1).padStart(6)}% `
      + `${entry.reference.toFixed(3).padStart(9)}  ${String(entry.blocksPooled)}/${entry.blocksTotal}`.padEnd(9)
      + `  ${entry.stimulusOk ? 'ok' : '🔴'}`
      + `${entry.spansZero ? '   ⚪ NOT RESOLVED — the interval includes no effect' : ''}`);

    // The blocks the pooled figure is made of, so the spread is visible rather than trusted.
    console.log(`               blocks at this clock: `
      + entry.perBlock
        .filter((block) => block.reference >= entry.referenceRange.floor
          && block.reference <= entry.referenceRange.ceiling)
        .map((block) => `${block.p50 >= 0 ? '+' : ''}${block.p50.toFixed(2)}`).join('  ')
      + `   (reference ${entry.referenceRange.floor.toFixed(2)}-${entry.referenceRange.ceiling.toFixed(2)} ms)`);

    // ⚠️ A DIFFERENT CLOCK IS A DIFFERENT NUMBER, PRINTED SEPARATELY AND NEVER FOLDED IN.
    for (const other of entry.otherClocks) {
      console.log(`               🕐 ALSO at reference ${other.floor.toFixed(2)}-${other.ceiling.toFixed(2)} ms: `
        + `${other.p50 >= 0 ? '+' : ''}${other.p50.toFixed(3)} ms over ${other.blocks} block(s) — a `
        + 'DIFFERENT clock state, reported apart because a cost without its clock is not a number');
    }
  }

  console.log('\nCOMPARABILITY — two costs may be differenced only if their reference frames agree.\n');
  for (let i = 0; i < costs.length; i += 1) {
    for (let j = i + 1; j < costs.length; j += 1) {
      const check = comparable(costs[i].reference, costs[j].reference);
      const delta = costs[j].p50 - costs[i].p50;
      const spread = Math.abs(delta) / Math.min(Math.abs(costs[i].p50), Math.abs(costs[j].p50));
      console.log(
        `  ${costs[j].arm} vs ${costs[i].arm}: references ${(check.gap * 100).toFixed(2)}% apart — `
        + (check.ok
          ? `COMPARABLE. Δ ${signed(delta).trim()} ms (${(spread * 100).toFixed(1)}% apart`
            + `${spread <= REPLICATE_TOLERANCE ? '' : ', 🔴 OUTSIDE the registered 10%'})`
          : '🔴 NOT COMPARABLE — different clock states; no delta printed, by §8.'));
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
    // Blocks are an ANALYSIS parameter — the capture is continuous and partitioned afterwards — so
    // one run can be read at several block sizes without re-sampling anything. 40 ticks is the
    // smallest window `driftAcrossRun` can read thirds of and still clear its 24-sample floor.
    blockTicks: 40,
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
      case '--block': options.blockTicks = Number(value); index += 1; break;
      case '--warmup-cap': options.warmupCap = Number(value); index += 1; break;
      case '--arms': options.arms = value; index += 1; break;
      case '--sha': options.headSha = value; index += 1; break;
      default: throw new Error(`unknown argument '${flag}'`);
    }
  }

  if (['cards', 'ribbons'].includes(options.arms) === false) {
    throw new Error(`--arms must be 'cards' or 'ribbons', got '${options.arms}'`);
  }
  return options;
}

// Importable for the selftest; only runs the browser when invoked as a script.
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main();
}
