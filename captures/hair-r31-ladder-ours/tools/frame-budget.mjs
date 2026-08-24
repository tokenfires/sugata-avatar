#!/usr/bin/env node
//
// frame-budget.mjs — what the SHIPPED build costs today, with and without its card groom.
//
// The strand ladder next door answers "what would the new primitive cost". This answers the two
// questions it has to be judged against, and both of them are currently quoted in the record from
// measurements that no longer reproduce:
//
//   1. WHAT DO TODAY'S CARDS COST? The decision rule's clause is "parity with today's cards". Its
//      number has been 2.03 ms and then 1.46-1.71 ms; the rule is applied at whatever this
//      measures, because a rule that says parity cannot be applied at a stale parity.
//   2. HOW MUCH HEADROOM IS THERE ACTUALLY? The 2.6 ms in the record is headroom on the NO-HAIR
//      plate. The number that matters is the shipped frame WITH hair against 16.6 ms.
//
// Both arms are `alive.html` — the shipped page, the shipped groom, the shipped OIT default — and
// they are round-robined inside one browser process with the SAME fixed contention gate the strand
// ladder uses (`strand-spike.html` at 4,960 strands / 720x900), so a row here and a row there can
// be read against one yardstick.
//
// 🔴 THE SAMPLER IS BURST-THEN-RESOLVE FOR THE REASON `strand-time.mjs` documents at length: a
// harness that awaits a `mapAsync` between frames leaves the GPU idle half the time, it sits at
// its base clock, and the rare boost lands on one arm and not another. Frames are submitted back
// to back and the timestamps resolved once at the end of the burst.
//
//   node captures/hair-r31-ladder-ours/tools/frame-budget.mjs --out captures/hair-r31-ladder-ours
//

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';

// 🎯 WHAT P0 ACTUALLY WAS, after two wrong diagnoses of my own — read this before changing the
// sampler, because both wrong turns are cheap to repeat.
//
// 1. ~~"The hair arm attaches no groom."~~ RETRACTED. `alive.js:1434`'s `report()` has NO `hair`
//    key — the census lives on `subsystems()`, `censusOfShading()` at `alive.js:3548`. The guard
//    below read `report().hair`, got `undefined`, coerced it with `?? null`, and reported a fully
//    attached groom as absent. Every asset serves 200; there is no 404. The guard written to catch
//    "nothing asserted the stimulus" asserted it against a field that does not exist.
//
// 2. ~~"P0 is not a clock-state problem."~~ ALSO RETRACTED — that withdrawal was made on the
//    strength of defect 1. It IS a clock-state problem, and `strand-time.mjs:321-325` named the
//    mechanism before this file existed: *"a harness that idles between frames is measuring its own
//    latency's effect on the clock."*
//
// 🔴 THE MEASURED FORM. Over 384 samples an arm, every arm here is BIMODAL — two clock states
// 1.33x to 2.22x apart — and the MIX differs per arm because a LIGHTER ARM IDLES MORE between
// submissions and drops to base clock more often. `no-hair` put 33.6% of its samples in the fast
// state against the cards arm's 58.9%, so their medians came from different states and cards read
// 3.99 ms FASTER than an empty head. Within each state the sign is physical: +0.247 ms fast,
// +1.728 ms slow. The per-mode figure also reproduces where the percentile does not — two captures
// of one configuration agree to 0.0% in the slow mode.
//
// ⚠️ SO A PERCENTILE OF A MIXTURE IS NOT A COST, AND NO OTHER PERCENTILE FIXES IT.
//
// BOTH HALVES OF THE REPAIR ARE NOW IN, AND THE SECOND ONE IS WHAT WORKED.
//
//   (a) `print` reports PER MODE, with the clock boundary fitted ONCE on the pooled samples rather
//       than per arm. That made the reporting honest — it flags "negative in a mode" instead of
//       hiding it — but it did NOT close P0: the control's own per-mode spread was ±0.4 ms, the
//       same size as the card groom's cost, and the ribbon slow-mode deltas did not track strand
//       count. Conditioning on the state cannot recover a cost when the state is entangled with
//       the workload.
//
//   (b) 🎯 `takeSample` NOW BURSTS AND DIVIDES, and that removes the mixture at source instead of
//       correcting for it. Measured immediately after the change: `no-hair` collapsed to a single
//       tight mode (min 11.314, p50 13.112, p95 13.304), the two controls agreed to **0.08%**
//       (13.112 against 13.122), and Δp50 went from −3.974 ms to **+0.557 ms — positive and
//       physical**. That figure also agrees with an INDEPENDENT one: `HairMaterial.selftest.mjs`
//       measures the groom at 0.738 ms p50 by a different route entirely.
//
// The per-mode table is kept because it is the instrument that DIAGNOSED this, and because an arm
// that starts mixing again should say so out loud rather than quietly returning a median.
//
// Four silent readiness defects died on the way here — see `assertArmRenders` and the wait loop in
// `main`. The reusable one: `waitForFunction` with an ASYNC predicate NEVER WAITS, because an async
// arrow returns a Promise and a Promise is truthy on the first poll.

const REPOSITORY_ROOT = fileURLToPath(new URL('../../..', import.meta.url));
const GPU_FLAGS = ['--enable-unsafe-webgpu', '--ignore-gpu-blocklist', '--hide-scrollbars'];

/** The frame budget the whole decision is against: 60 Hz with a little in hand. */
const BUDGET_MS = 16.6;

/** `alive.js`'s own timing header states this framing for the arms already in the record. */
const VIEWPORT = { width: 1080, height: 1920 };

// 🔴 `hairmotion=0` IS EXPLICIT, AND ITS ABSENCE MADE THE ARMS UNEQUAL. `?hairmotion` DEFAULTS ON,
// so the CARD arm ran `HairDynamics` while every ribbon arm had it refused — `alive.js` will not let
// the solver and the ribbon expansion both write `material.positionNode`. The comment beside the
// ribbon arms claimed "MOTION IS OFF ON EVERY ARM" and it was false: motion was off on the ribbons
// and ON for the cards, so the card arm was carrying a compute pass the others were not.
//
// ⚠️ The solver is ~0.018 ms and CANNOT account for the deltas seen — this is a correctness fix, not
// the explanation. Recorded because a false claim in a comment beside a measurement is the defect
// this project has caught ten times, and writing one while hunting a different bug is how eleven
// happens.
const BASE_QUERY = 'bare&freeze&seed=1&frame=body&capture&gputime=1&hairmotion=0';

/**
 * The ribbon arms, named by the file `tools/figure-pipeline/build-tfx.sh` writes.
 *
 * `crop01` at 8,832 is the count the primitive decision's parity figure was measured at; the two
 * `bob01` densities are the fork the round could not settle — one document reads 4,960 as adequate
 * bob silhouette and another reads it as thin at the crown, and NEITHER NOTICES THE DISAGREEMENT.
 * Both are timed here so the cost side of that fork is at least closed.
 */
const RIBBON_ARMS = [
  { key: 'ribbons-crop-8832', file: 'crop01_g050_d23.tfx', strands: 8832 },
  { key: 'ribbons-bob-4960', file: 'bob01_g050_d10.tfx', strands: 4960 },
  { key: 'ribbons-bob-11408', file: 'bob01_g050_d23.tfx', strands: 11408 },
];

async function main() {
  const options = parseArguments(process.argv.slice(2));

  const playwright = await loadPlaywright();
  const server = await startViteServer(options.gateTfx);
  const browser = await launchBrowser(playwright);

  const arms = [
    { key: 'gate', kind: 'gate', page: null,
      url: `${server.baseUrl}/tools/spikes/strand-spike.html?strands=4960&w=720&h=900&aa=off&gputime=1&frames=1`,
      step: 'strand' },
    { key: 'no-hair', kind: 'frame', url: `${server.baseUrl}/packages/testbed/alive.html?${BASE_QUERY}`, step: 'alive',
      expect: { hair: false } },
    { key: 'hair', kind: 'frame', url: `${server.baseUrl}/packages/testbed/alive.html?${BASE_QUERY}&hair=1`, step: 'alive',
      expect: { hair: true, ribbons: false } },
    // The control repeated at the far end of the arm order. `alive.js`'s own header measured the
    // no-hair arm twice for this reason and reported the pair; a single control cannot show drift.

    // 🎯 R31's P0. The SAME page, the SAME deferred stack, the SAME material — one query parameter
    // apart from the card arm. That is the whole point: every strand figure on the record before
    // this was raster-and-shade on a bare page with no G-buffer, no resolve, no OIT composite and
    // no skinning, compared against a card cost that is a whole-frame delta. These arms close that.
    //
    // ⚠️ Motion is held off on EVERY arm by `BASE_QUERY`'s explicit `hairmotion=0` — see the note
    // there for why that had to become explicit rather than assumed.
    ...RIBBON_ARMS.map((arm) => ({
      key: arm.key,
      kind: 'frame',
      url: `${server.baseUrl}/packages/testbed/alive.html?${BASE_QUERY}&hair=1`
        + `&hairribbons=/tfx/${arm.file}`,
      step: 'alive',
      expect: { hair: true, ribbons: true, strandCount: arm.strands },
    })),

    { key: 'no-hair-2', kind: 'frame', url: `${server.baseUrl}/packages/testbed/alive.html?${BASE_QUERY}`, step: 'alive',
      expect: { hair: false } },
  ];

  // ⚠️ `arms.slice()`, NOT `arms`. With no filter the two were the SAME ARRAY, so the
  // `arms.length = 0` below emptied the very list being spread back in and the run executed ZERO
  // arms — completing all fifteen rounds in seconds and then throwing on a missing gate row. A
  // silent no-op that looks like a fast success is the worst shape a harness bug can take, and this
  // one was caught only because the report needed a row that was not there.
  const selected = options.only === null
    ? arms.slice()
    : arms.filter((a) => options.only.includes(a.key));

  if (selected.length !== arms.length) {
    console.log(`arms      ${selected.length} of ${arms.length}: ${selected.map((a) => a.key).join(', ')}`);
  }

  if (selected.length === 0) {
    throw new Error(`--only matched no arms. Known: ${arms.map((a) => a.key).join(', ')}`);
  }

  arms.length = 0;
  arms.push(...selected);

  const context = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: 1 });

  try {
    for (const arm of arms) {
      arm.page = await context.newPage();
      arm.page.setDefaultTimeout(600_000);
      arm.page.on('pageerror', (error) => console.error(`PAGEERROR ${arm.key}`, error.message));
      arm.page.on('requestfailed', (r) => console.error(`REQFAILED ${arm.key} ${r.url().slice(-70)} ${r.failure()?.errorText}`));
      arm.page.on('response', (r) => { if (r.status() >= 400) console.error(`HTTP${r.status()} ${arm.key} ${r.url().slice(-70)}`); });
      arm.page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') console.error(`PAGE-${m.type().toUpperCase()} ${arm.key}: ${m.text().slice(0, 200)}`); });

      await arm.page.goto(arm.url, { waitUntil: 'load' });

      if (arm.step === 'alive') {
        // 🔴 THE RETURN VALUE, NOT THE FUNCTION'S EXISTENCE, AND THE DIFFERENCE IS THE WHOLE OF P0.
        //
        // This used to wait for `typeof globalThis.__SUGATA_STEP__ === 'function'`.
        // `tools/critic/hair-lightpath.mjs` records what that is worth in as many words:
        // *"`__SUGATA_STEP__` EXISTS BEFORE THE FIGURE DOES, AND IT RETURNS `false` UNTIL IT DOES"* —
        // it once produced four uniform RGB(10,10,12) plates from exactly this mistake, and
        // `capture.mjs:718` treats the same `false` as a hard error.
        //
        // 🎯 SO THE HARNESS BEGAN WARMING UP AND SAMPLING AGAINST PAGES THAT HAD NOT FINISHED
        // BUILDING, AND THE ARMS DO NOT ALL TAKE THE SAME TIME TO BUILD. A ribbon arm has to fetch a
        // .tfx, parse it, build ribbon geometry and skin it to the head bone; `no-hair` has none of
        // that to do. An arm still building renders LESS, so it times FASTER — which is precisely
        // the non-physical result this file produced and could not explain: ribbon arms reading
        // faster than no hair at all. Adding geometry cannot make a frame cheaper; starting the
        // clock before the geometry exists can.
        //
        // ⚠️ THIS WAS DIAGNOSED AS A DVFS PROBLEM AND THAT DIAGNOSIS WAS WRONG. `docs/CHECKPOINT.md`
        // §17 says P0 "needs the ladder's timing method, not a patch", reasoning that a 720x900 gate
        // page cannot share a clock state with 1080x1920 arms. That reasoning is still true and it
        // is not what was breaking this. The clock-state argument was reached by elimination without
        // ever asking the cheaper question — IS EACH ARM RENDERING WHAT IT CLAIMS — which no part of
        // this harness could answer, because nothing here had ever read the census.
        // 🔴 POLLED FROM NODE WITH `evaluate`, NOT HANDED TO `waitForFunction` AS AN ASYNC
        // PREDICATE, AND THAT DISTINCTION IS A SECOND SILENT DEFECT FOUND ON THE WAY TO THE FIRST.
        //
        // The obvious repair is `waitForFunction(async () => (await __SUGATA_STEP__(0)) === true)`.
        // It does not work and it does not fail either: `waitForFunction` tests the predicate's
        // return value for TRUTHINESS, and an async arrow returns a Promise, which is truthy on the
        // first poll whatever it would eventually resolve to. So the wait returns instantly and
        // reports success. Measured: with that predicate the census still read
        // `typeof __SUGATA_STEP__ === 'undefined'` immediately afterwards, and the page's own
        // "Figure: this rig has no jaw..." warning arrived AFTER the census line rather than before.
        //
        // `page.evaluate` DOES await a returned promise, so the loop below asks the real question.
        // ⚠️ `tools/critic/hair-lightpath.mjs`'s `waitForFigure` uses the async-predicate form and
        // therefore carries the same defect — it has been winning the race rather than waiting.
        // 🔴 AND `__SUGATA_STEP__( 0 ) === true` IS STILL NOT THE RIGHT QUESTION FOR A HAIR ARM.
        // It means the FIGURE is renderable. `attachHair` is awaited further down the same async
        // chain (`alive.js:2016`) and sets `session.hair` at its very end, so a page can step true
        // with no groom in it — measured: `report().hair` was null on `?hair=1` with the step
        // already returning true and no warning anywhere. WAIT FOR THE THING YOU ARE ABOUT TO
        // ASSERT, which for a hair arm is the groom and not the body.
        const wantsHair = arm.expect?.hair === true;
        const deadline = Date.now() + Number(process.env.FB_READY_MS ?? 600_000);
        for (;;) {
          const ready = await arm.page.evaluate(async (needsGroom) => {
            if (typeof globalThis.__SUGATA_STEP__ !== 'function') return false;
            if ((await globalThis.__SUGATA_STEP__(0)) !== true) return false;
            if (needsGroom !== true) return true;
            return (globalThis.sugata?.subsystems?.()?.hair ?? null) !== null;
          }, wantsHair);
          if (ready === true) break;
          if (Date.now() > deadline) {
            // 🚩 THE TIMEOUT CARRIES WHAT THE PAGE ACTUALLY CONTAINED. `tools/critic/hair-plates.mjs`
            // spent a session reporting "Timeout 120000ms exceeded" with the real TypeError sitting
            // unread beside it; a readiness timeout that cannot say what it was waiting on is a
            // second bug on top of the first.
            const seen = await arm.page.evaluate(() => {
              const sess = globalThis.sugata?.session ?? null;
              return {
                step: typeof globalThis.__SUGATA_STEP__,
                sugata: typeof globalThis.sugata,
                hairEnabled: sess?.hairEnabled ?? null,
                hairRequest: sess?.hairRequest === undefined ? 'undefined' : (sess?.hairRequest === null ? 'null' : 'set'),
                hair: (globalThis.sugata?.subsystems?.()?.hair ?? null) === null ? 'null' : 'present',
                search: String(location.search),
              };
            }).catch((error) => ({ probeFailed: error.message }));
            throw new Error(
              `arm "${arm.key}": ${wantsHair ? 'no GROOM' : 'no figure'} before the deadline\n` +
              `  url  ${arm.url}\n` +
              `  page ${JSON.stringify(seen)}`
            );
          }
          await new Promise((resolve) => setTimeout(resolve, 250));
        }
      } else {
        await arm.page.waitForFunction(
          () => window.__STRAND_READY__ === true || window.__STRAND_ERROR__ !== undefined,
          null, { timeout: 600_000 }
        );
      }

      arm.info = await arm.page.evaluate((step) => {
        if (step === 'strand') return { strandGate: true };
        const renderer = globalThis.sugata?.stage?.renderer;
        const canvas = renderer?.domElement;
        // 🔴 `subsystems()`, NOT `report()`, AND READING THE WRONG ONE COST A WHOLE DIAGNOSIS.
        // `alive.js:1434`'s `report()` returns defects / nudgeMillimetres / affect /
        // affectPostureDegrees / identity / foundation — it has NO `hair` key at all
        // (`'hair' in report()` is false). The hair census lives on `subsystems()`, which is
        // `censusOfShading( session, stage )` at `alive.js:3548`. Reading `report().hair` yields
        // `undefined`, `?? null` turns that into `null`, and the guard below then reports a fully
        // attached groom as absent. See the retraction in `docs/CHECKPOINT.md` §18.
        const hair = globalThis.sugata?.subsystems?.()?.hair ?? null;
        return {
          trackTimestamp: renderer?.trackTimestamp,
          width: canvas?.width,
          height: canvas?.height,
          pixelRatio: renderer?.getPixelRatio?.(),

          // 🔴 WHAT THE ARM IS ACTUALLY DRAWING, WHICH THIS HARNESS NEVER ASKED FOR — see
          // `assertArmRenders` for the defect that cost.
          hair: hair === null ? null : {
            groomMeshes: hair.groomMeshes ?? null,
            strandCount: hair.ribbons?.strandCount ?? null,
            skinnedPoints: hair.ribbons?.skinnedPoints ?? null,
            triangles: hair.ribbons?.triangles ?? null,
          },
        };
      }, arm.step);

      console.log(`arm       ${arm.key.padEnd(18)} ${JSON.stringify(arm.info)}`);
      assertArmRenders(arm);
      arm.samples = [];
    }

    for (let pass = 0; pass < options.warmup; pass += 1) {
      for (const arm of arms) await takeSample(arm, options.batch, 1);
    }
    for (const arm of arms) arm.samples = [];

    // 🔴 THE ARM ORDER IS SHUFFLED EVERY ROUND, AND A FIXED ORDER WAS BIASING THE RESULT.
    //
    // The round-robin exists so that drift is common-mode. It was not: with a FIXED order inside
    // each round, an arm inherits whatever GPU state the arm before it left, and that position
    // effect is systematic rather than random. Measured on the first P0 run, where `no-hair` and
    // `no-hair-2` are the SAME URL and differ only in cycle position — first against last:
    //
    //     min                 1.406  against  1.646   (+0.24)
    //     fast-mode median   10.778  against 12.548   (+1.77)
    //
    // Every ribbon arm sat AFTER the card arm, so part of their apparent extra cost was position.
    // A per-round shuffle turns that from a bias into noise the rounds average out, and the two
    // no-hair arms become a real control on whether it worked: they should now converge.
    //
    // ⚠️ Deterministic by default so a run is reproducible. `--seed` changes it; the seed is
    // recorded in the report, because a shuffle nobody can reproduce is a shuffle nobody can check.
    let seed = options.seed;
    const nextRandom = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 0x100000000;
    };

    for (let round = 0; round < options.rounds; round += 1) {

      const order = arms.slice();
      for (let i = order.length - 1; i > 0; i -= 1) {
        const j = Math.floor(nextRandom() * (i + 1));
        [ order[i], order[j] ] = [ order[j], order[i] ];
      }

      for (const arm of order) await takeSample(arm, options.batch, options.perVisit);
      if ((round + 1) % 5 === 0) console.log(`          round ${round + 1}/${options.rounds}`);
    }

    const rows = arms.map((arm) => ({
      key: arm.key,
      kind: arm.kind,
      url: arm.url,
      info: arm.info,
      samples: arm.samples.length,
      minMs: Math.min(...arm.samples),
      p05Ms: quantile(arm.samples, 0.05),
      p50Ms: quantile(arm.samples, 0.5),
      p95Ms: quantile(arm.samples, 0.95),
      maxMs: Math.max(...arm.samples),
      samplesMs: arm.samples,
    }));

    print(rows);

    const file = path.join(options.outDirectory, 'data', 'frame-budget.json');
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, `${JSON.stringify({
      tool: 'captures/hair-r31-ladder-ours/tools/frame-budget.mjs',
      generatedAt: new Date().toISOString(),
      headSha: options.headSha,
      budgetMs: BUDGET_MS,
      viewport: VIEWPORT,
      rounds: options.rounds,
      burstFramesPerSample: options.batch,
      samplesPerVisit: options.perVisit,
      armOrderSeed: options.seed,
      rows,
    }, null, 2)}\n`);
    console.log(`\nreport    ${path.relative(REPOSITORY_ROOT, file)}`);
  } finally {
    await browser.close();
    await server.close();
  }
}

/**
 * Every arm proves what it is DRAWING before any of its samples count.
 *
 * 🔴 THE DEFECT THIS CLOSES IS THAT THERE WAS NO SUCH CHECK AT ALL, AND THE HARNESS HAD ALREADY
 * PRODUCED A NON-PHYSICAL RESULT — ribbon arms reading FASTER than the no-hair arm. Adding geometry
 * cannot make a frame cheaper, so either the timing was wrong or the arms were not rendering what
 * their URLs claimed, and nothing in this file could tell those two apart. `arm.info` collected
 * `trackTimestamp`, `width`, `height` and `pixelRatio` — every property of the RENDERER and not one
 * property of the PICTURE.
 *
 * 🚩 AND THE REPO HAD ALREADY BEEN BITTEN BY EXACTLY THIS, ONE ROUND EARLIER. `HairDynamics` and the
 * ribbon expansion both write `material.positionNode`; the solver won, every ribbon collapsed to
 * zero width, and the plate came back BALD RATHER THAN ERRORING. A silent wrong picture that looks
 * like a placement bug is the most expensive shape a defect can take, and a timing harness with no
 * census will time it happily and report a number.
 *
 * The census it reads is not new — `alive.js`'s `sugata.report().hair.ribbons` has carried
 * `strandCount`, `skinnedPoints` and `triangles` since the ribbon arm landed. Nothing consumed it.
 *
 * ⚠️ THROWS RATHER THAN WARNS. A warning in a scrolling log beside fifteen rounds of timings is a
 * warning nobody reads, and the whole point is that a mis-rendering arm must not be able to
 * contribute a sample.
 */
function assertArmRenders(arm) {

  if (arm.expect === undefined) return;

  const seen = arm.info?.hair ?? null;
  const wants = arm.expect;
  const fail = (why) => {
    throw new Error(
      `ARM "${arm.key}" IS NOT RENDERING WHAT IT CLAIMS: ${why}\n` +
      `  url    ${arm.url}\n` +
      `  census ${JSON.stringify(seen)}\n` +
      '  A timing taken on this arm would be a measurement of the wrong picture.'
    );
  };

  if (wants.hair === false) {
    if (seen !== null) fail('expected NO hair, and the page reports a groom');
    return;
  }

  if (seen === null) fail('expected a groom, and the page reports none');

  if (wants.ribbons === false && seen.strandCount !== null) {
    fail(`expected CARDS, and the page reports ${seen.strandCount} ribbon strands`);
  }

  if (wants.ribbons === true) {
    if (seen.strandCount === null) {
      fail('expected RIBBONS, and the page reports a card groom — the .tfx did not load, and this '
        + 'arm would have timed the card path under a ribbon label');
    }
    if (seen.strandCount !== wants.strandCount) {
      fail(`expected ${wants.strandCount} strands, the page built ${seen.strandCount}`);
    }
    if (!(seen.triangles > 0)) {
      fail(`built ${seen.strandCount} strands but ${seen.triangles} triangles — this is the `
        + 'zero-width collapse, which renders BALD and does not throw');
    }
  }

}

async function takeSample(arm, burst, perVisit) {
  const values = await arm.page.evaluate(async ({ burst, perVisit, step }) => {
    const out = [];

    for (let visit = 0; visit < perVisit; visit += 1) {
      if (step === 'alive') {
        // 🎯 BURST, THEN RESOLVE ONCE, THEN DIVIDE BY THE BURST. The previous version resolved every
        // frame, and its own comment explains why — burst-then-resolve reported 315 ms because
        // `resolveQueriesAsync` groups passes by frame id and a burst's twenty-four steps land in
        // ONE group, so the value is their SUM.
        //
        // 🔴 THAT COMMENT COMPUTED THE FIX AND THEN DISCARDED IT: "315.686 / 24 = 13.15 ms, exactly
        // the magnitude `alive.js`'s own header records." The sum was never a bug. It is 24 frames
        // of continuous work, and dividing by 24 is a per-frame MEAN taken at sustained clock —
        // which is precisely what the strand ladder does and what this page needed.
        //
        // ⚠️ AND THE PER-FRAME DESIGN WAS NOT MERELY REDUNDANT, IT WAS THE DEFECT.
        // `strand-time.mjs:321-325`: *"a harness that idles between frames is measuring its own
        // latency's effect on the clock."* An `await resolveTimestampsAsync` between every
        // submission is a `mapAsync` round trip, so a LIGHTER arm idles a larger share of its period
        // and drops to base clock more often. That is how a card groom came to read 3.99 ms FASTER
        // than an empty head. The old claim that "the resolve's round trip is a few percent of the
        // period" is withdrawn — measured, it moved the arms into different clock states.
        //
        // 🚩 THE DIVISION IS VERIFIED, NOT ASSUMED. Bursts of 1 / 4 / 8 / 16 / 24 on both arms give
        // value/N converging (no-hair 10.311 / 13.438 / 13.147 / 13.221 / 12.243), so the resolved
        // value really does scale with the burst and the group really is the whole burst. The
        // cards-minus-no-hair gap also narrows from −2.797 ms at N=1 to −1.046 at N=16, which is the
        // duty-cycle mechanism receding as the GPU is held busy.
        const renderer = globalThis.sugata.stage.renderer;
        for (let frame = 0; frame < burst; frame += 1) await globalThis.__SUGATA_STEP__(0);
        await renderer.resolveTimestampsAsync('render');
        out.push(renderer.info.render.timestamp / burst);
      } else {
        for (let frame = 0; frame < burst; frame += 1) await window.__STRAND_RENDER__();
        out.push(await window.__STRAND_GPU_MS__());
      }
    }

    return out;
  }, { burst, perVisit, step: arm.step });

  for (const value of values) {
    if (typeof value === 'number' && Number.isFinite(value) && value > 0) arm.samples.push(value);
  }
}

/**
 * The two GPU clock states an arm's samples fall into, and how many landed in each.
 *
 * 🔴 WHY THIS EXISTS: A PERCENTILE OF A MIXTURE IS NOT A COST. Measured 2026-08-23 over 384 samples
 * an arm, every arm on this page is BIMODAL — two clock states 1.33x to 2.22x apart — and the MIX
 * differs per arm. `no-hair` put 33.6% of its samples in the fast state and the cards arm 58.9%, so
 * their medians were drawn from DIFFERENT STATES and cards read 3.99 ms FASTER than an empty head.
 * Within each state the sign is physical: cards costs +0.247 ms in the fast state and +1.728 ms in
 * the slow one.
 *
 * 🎯 AND THE PER-MODE FIGURE IS THE REPRODUCIBLE ONE. The two captures of the SAME configuration at
 * either end of the shuffled arm order agree to **0.0%** in the slow mode — 13.473 against 13.474 —
 * and 2.5% in the fast, while their mixes differ (28.9% against 33.6%). The cost is stable; the
 * mixture is what wanders.
 *
 * `strand-time.mjs:317` already said minima across arms quote different clock states. This says the
 * median does too, so no percentile fixes it — the fix is to condition on the state.
 */
function clockModes(samples) {
  const xs = [...samples].sort((a, b) => a - b);
  if (xs.length < 8) return null;

  // Deterministic seeds at the deciles, so a re-run of the same data gives the same split.
  let a = xs[Math.floor(xs.length * 0.1)];
  let b = xs[Math.floor(xs.length * 0.9)];
  let lo = [];
  let hi = [];

  for (let i = 0; i < 100; i += 1) {
    lo = xs.filter((x) => Math.abs(x - a) <= Math.abs(x - b));
    hi = xs.filter((x) => Math.abs(x - a) > Math.abs(x - b));
    if (lo.length === 0 || hi.length === 0) return null;
    const na = lo.reduce((s, x) => s + x, 0) / lo.length;
    const nb = hi.reduce((s, x) => s + x, 0) / hi.length;
    if (Math.abs(na - a) < 1e-9 && Math.abs(nb - b) < 1e-9) { a = na; b = nb; break; }
    a = na; b = nb;
  }

  // ⚠️ SEPARATION IS ASSERTED, NOT ASSUMED. k-means will split a perfectly unimodal sample into two
  // halves and report them with a straight face, which would turn one number into two meaningless
  // ones. The distance between the means must be large against the spread INSIDE them before this
  // is allowed to call itself a mode.
  const sd = (v, m) => Math.sqrt(v.reduce((s, x) => s + (x - m) ** 2, 0) / Math.max(1, v.length - 1));
  const pooled = Math.sqrt((sd(lo, a) ** 2 * (lo.length - 1) + sd(hi, b) ** 2 * (hi.length - 1))
    / Math.max(1, lo.length + hi.length - 2));
  const separation = pooled > 0 ? (b - a) / pooled : Infinity;

  return {
    fast: a, fastN: lo.length, slow: b, slowN: hi.length,
    fastShare: lo.length / xs.length, ratio: b / a, separation,
    bimodal: separation >= 2,
  };
}

/**
 * 🔴 ONE BOUNDARY, FITTED ON THE POOLED SAMPLES, APPLIED TO EVERY ARM.
 *
 * Fitting `clockModes` per arm was the first version of this and it is NOT COMPARABLE. k-means puts
 * the cut wherever that arm's own samples fall, so each arm's "fast mode" is a different slice of
 * the clock's range and the means cannot be differenced. Measured: with per-arm boundaries the
 * CONTROL — two captures of ONE configuration — read −0.353 ms in the fast mode and +0.449 in the
 * slow, which is the same magnitude as the effect being looked for. That is a statistic
 * manufacturing its own signal, and it is the defect `brief-the-property-not-the-operator` is about.
 *
 * The clock states belong to the MACHINE, not to the arm, so the boundary does too.
 */
function pooledBoundary(frames) {
  const fit = clockModes(frames.flatMap((row) => row.samplesMs));
  return fit === null ? null : { threshold: (fit.fast + fit.slow) / 2, fit };
}

function splitAt(samples, threshold) {
  const lo = samples.filter((x) => x <= threshold);
  const hi = samples.filter((x) => x > threshold);
  const mean = (v) => (v.length === 0 ? null : v.reduce((s, x) => s + x, 0) / v.length);
  return {
    fast: mean(lo), fastN: lo.length, slow: mean(hi), slowN: hi.length,
    fastShare: lo.length / samples.length,
  };
}

function printClockModes(rows) {
  const frames = rows.filter((row) => row.kind === 'frame' && (row.samplesMs || []).length >= 8);
  if (frames.length === 0) return;

  const pooled = pooledBoundary(frames);
  if (pooled === null) return;

  const modes = new Map();
  for (const row of frames) {
    const at = splitAt(row.samplesMs, pooled.threshold);
    if (at.fast === null || at.slow === null) continue;

    // 🚩 A MODE NEEDS A POPULATION. Found by using this instrument on a run where burst-and-divide
    // had already collapsed the mixture: `no-hair` landed 47 of 48 samples on one side, and the
    // table happily printed a "slow mode" mean computed from the single remaining sample, then
    // differenced it. `clockModes`' own separation test does not catch it — separation is LARGE
    // when the lone outlier sits far away, which is exactly the case that must be refused.
    at.populated = Math.min(at.fastN, at.slowN) >= 5
      && Math.min(at.fastShare, 1 - at.fastShare) >= 0.10;
    const own = clockModes(row.samplesMs);
    modes.set(row.key, {
      ...at,
      ratio: at.slow / at.fast,
      separation: own === null ? 0 : own.separation,
      bimodal: own !== null && own.bimodal,
    });
  }
  if (modes.size === 0) return;

  console.log(
    `CLOCK BOUNDARY fitted ONCE on ${frames.reduce((n, r) => n + r.samplesMs.length, 0)} pooled ` +
    `samples: ${pooled.threshold.toFixed(3)} ms ` +
    `(states ${pooled.fit.fast.toFixed(3)} / ${pooled.fit.slow.toFixed(3)}, ` +
    `separation ${pooled.fit.separation.toFixed(1)})\n`
  );
  console.log('PER CLOCK MODE — a percentile of a mixture is not a cost; see `clockModes`.\n');
  console.log('arm                    fast     n     slow     n   % fast  slow/fast  separation');
  for (const row of frames) {
    const m = modes.get(row.key);
    if (m === undefined) continue;
    console.log(
      `${row.key.padEnd(20)} ${m.fast.toFixed(3).padStart(7)} ${String(m.fastN).padStart(5)} ` +
      `${m.slow.toFixed(3).padStart(8)} ${String(m.slowN).padStart(5)} ` +
      `${(m.fastShare * 100).toFixed(1).padStart(7)}% ${m.ratio.toFixed(2).padStart(9)}x ` +
      `${m.separation.toFixed(1).padStart(10)}` +
      `${m.populated ? (m.bimodal ? '' : '  ⚠️ NOT BIMODAL') : '  ⚪ SINGLE MODE — mixture gone'}`
    );
  }

  const base = modes.get('no-hair');
  if (base === undefined) return;

  console.log('\nCOST AGAINST no-hair, WITHIN each clock state — this is the comparable number:\n');
  console.log('arm                   Δ fast    Δ slow    (naive Δp50, NOT comparable)');
  for (const row of frames) {
    const m = modes.get(row.key);
    if (m === undefined || row.key === 'no-hair') continue;
    const naive = row.p50Ms - rows.find((r) => r.key === 'no-hair').p50Ms;

    // Refuse to difference an unpopulated mode against a populated one — that is comparing a mean
    // of 47 samples with a mean of 1 and printing it to three decimals.
    if (m.populated === false || base.populated === false) {
      console.log(
        `${row.key.padEnd(20)} ${'—'.padStart(6)}    ${'—'.padStart(6)}    ` +
        `${(naive >= 0 ? '+' : '') + naive.toFixed(3)}   ⚪ one mode; read the naive column`
      );
      continue;
    }

    const df = m.fast - base.fast;
    const ds = m.slow - base.slow;
    const sign = (df >= 0 && ds >= 0) ? '' : '  🔴 NEGATIVE IN A MODE';
    console.log(
      `${row.key.padEnd(20)} ${(df >= 0 ? '+' : '') + df.toFixed(3)}`.padEnd(30) +
      `${(ds >= 0 ? '+' : '') + ds.toFixed(3)}`.padEnd(10) +
      `${(naive >= 0 ? '+' : '') + naive.toFixed(3)}${sign}`
    );
  }

  const end = modes.get('no-hair-2');
  if (end !== undefined) {
    console.log(
      `\nCONTROL, per mode: fast ${base.fast.toFixed(3)} vs ${end.fast.toFixed(3)} ` +
      `(${(Math.abs(base.fast - end.fast) / base.fast * 100).toFixed(1)}%), ` +
      `slow ${base.slow.toFixed(3)} vs ${end.slow.toFixed(3)} ` +
      `(${(Math.abs(base.slow - end.slow) / base.slow * 100).toFixed(1)}%) — ` +
      `mixes ${(base.fastShare * 100).toFixed(1)}% vs ${(end.fastShare * 100).toFixed(1)}% fast`
    );
  }
}

function print(rows) {
  const control = rows.find((row) => row.key === 'no-hair');
  const controlEnd = rows.find((row) => row.key === 'no-hair-2');
  const hair = rows.find((row) => row.key === 'hair');
  const gate = rows.find((row) => row.kind === 'gate');

  console.log(`\n${'='.repeat(88)}`);
  console.log(
    `CONTENTION GATE (the strand ladder's own fixed 4,960-strand render at 720x900, ` +
    `in this round-robin): min ${gate.minMs.toFixed(4)}  p50 ${gate.p50Ms.toFixed(4)}  ` +
    `p95 ${gate.p95Ms.toFixed(4)} ms`
  );
  console.log('arm            n     min      p05      p50      p95      max');
  console.log('-'.repeat(88));
  for (const row of rows) {
    console.log(
      `${row.key.padEnd(12)} ${String(row.samples).padStart(4)} ` +
      `${row.minMs.toFixed(3).padStart(8)} ${row.p05Ms.toFixed(3).padStart(8)} ` +
      `${row.p50Ms.toFixed(3).padStart(8)} ${row.p95Ms.toFixed(3).padStart(8)} ` +
      `${row.maxMs.toFixed(3).padStart(8)}`
    );
  }

  console.log(
    `\nCONTROL REPRODUCIBILITY (no-hair measured at both ends of the arm order): ` +
    `p05 ${control.p05Ms.toFixed(3)} vs ${controlEnd.p05Ms.toFixed(3)}, ` +
    `p50 ${control.p50Ms.toFixed(3)} vs ${controlEnd.p50Ms.toFixed(3)}, ` +
    `p95 ${control.p95Ms.toFixed(3)} vs ${controlEnd.p95Ms.toFixed(3)}`
  );
  // ⚠️ QUOTED, AND NOT THE ANSWER. Every figure on this line is a percentile of a MIXTURE of two
  // clock states whose proportions differ per arm, which is how a card groom came to read 3.99 ms
  // FASTER than an empty head. Kept because it is what the record has always quoted and a reader
  // needs to see it change; superseded by the per-mode table below.
  console.log(
    `\nTODAY'S CARDS COST (percentiles of a MIXTURE — see PER CLOCK MODE below)   ` +
    `Δp05 ${(hair.p05Ms - control.p05Ms).toFixed(3)}  ` +
    `Δp50 ${(hair.p50Ms - control.p50Ms).toFixed(3)}  ` +
    `Δp95 ${(hair.p95Ms - control.p95Ms).toFixed(3)} ms`
  );
  console.log(
    `HEADROOM AGAINST ${BUDGET_MS} ms   with hair: ` +
    `p50 ${(BUDGET_MS - hair.p50Ms).toFixed(3)}  p95 ${(BUDGET_MS - hair.p95Ms).toFixed(3)} ms   ` +
    `| no hair: p50 ${(BUDGET_MS - control.p50Ms).toFixed(3)}  ` +
    `p95 ${(BUDGET_MS - control.p95Ms).toFixed(3)} ms`
  );

  printClockModes(rows);
}

function quantile(values, q) {
  const sorted = [...values].sort((a, b) => a - b);
  const index = (sorted.length - 1) * q;
  const low = Math.floor(index);
  const high = Math.ceil(index);
  if (low === high) return sorted[low];
  return sorted[low] + (sorted[high] - sorted[low]) * (index - low);
}

async function startViteServer(gateTfx) {
  const { createServer } = await import('vite');

  const mountTfx = {
    name: 'sugata-frame-budget-tfx',
    configureServer(server) {
      // Serves the gate's own file AND any export the ribbon arms name, resolved against the
      // directory `--tfx` points at. Files rather than a copy, for `strand-spike.mjs`'s reason:
      // the plate is then of the file on disk and not of a stale duplicate.
      server.middlewares.use('/tfx', (request, response, next) => {
        const name = (request.url ?? '').replace(/^\//, '').split('?')[0];
        const file = /^strands-4960\.tfx$/.test(name)
          ? gateTfx
          : path.join(path.dirname(gateTfx), name);
        if (name === '' || fs.existsSync(file) === false) return next();
        response.setHeader('Content-Type', 'application/octet-stream');
        response.setHeader('Content-Length', String(fs.statSync(file).size));
        fs.createReadStream(file).pipe(response);
      });
    },
  };

  // 🚩 `vite.spikes.config.js`, NOT `vite.config.js`, AND R31's PAGE MOVE IS WHY. The main config
  // roots vite at `packages/testbed`, which served `/src/strand-spike.html` — and the spike page
  // moved to `tools/spikes/` when `pages.selftest.mjs` correctly went red over a prototype sitting
  // in the SHIPPING page set. Under the main root that URL no longer resolves and the contention
  // gate would 404 silently. The spikes config roots at the repo, so both pages are reachable by
  // their real paths and the gate keeps working.
  // 🚩 `open: false` IS NOT COSMETIC — WITHOUT IT THIS HARNESS OPENS A TAB IN THE OWNER'S REAL
  // BROWSER ON EVERY RUN. `vite.spikes.config.js` ends with `server: { open: '/tools/spikes/' }`,
  // which is correct for a human typing `npm run spikes` and wrong for anything programmatic:
  // `createServer` inherits it from the config file, so a headless timing run launches Chrome or
  // Safari at a bare directory with no `index.html`, which renders nothing.
  //
  // Reported by the owner, who reasonably wondered whether the blank tabs were something being
  // measured. They are not — every measurement here drives its own Playwright Chromium and never
  // touches that window, so the tabs were pure side effect. Any other tool that starts this config
  // programmatically needs the same line.
  const server = await createServer({
    configFile: path.join(REPOSITORY_ROOT, 'vite.spikes.config.js'),
    plugins: [mountTfx],
    server: { port: 5195, strictPort: false, hmr: false, watch: { ignored: ['**'] }, open: false },
    logLevel: 'warn',
  });

  await server.listen();
  server.baseUrl = server.resolvedUrls.local[0].replace(/\/$/, '');
  console.log(`vite      ${server.baseUrl}`);
  return server;
}

async function launchBrowser(playwright) {
  const browser = await playwright.chromium.launch({
    channel: 'chromium', headless: true, args: GPU_FLAGS,
  });
  console.log('chromium  headless (channel=chromium)');
  return browser;
}

async function loadPlaywright() {
  const candidates = ['playwright'];
  const cache = path.join(process.env.HOME ?? '', '.npm', '_npx');
  if (fs.existsSync(cache)) {
    candidates.push(
      ...fs.readdirSync(cache)
        .map((entry) => path.join(cache, entry, 'node_modules', 'playwright'))
        .filter((candidate) => fs.existsSync(candidate))
    );
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
    outDirectory: path.join(REPOSITORY_ROOT, 'captures', 'hair-r31-ladder-ours'),
    gateTfx: null,
    rounds: 15,
    batch: 24,
    perVisit: 4,
    warmup: 2,
    headSha: null,
    only: null,
    seed: 20260822,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const flag = argv[index];
    const value = argv[index + 1];
    switch (flag) {
      case '--out': options.outDirectory = path.resolve(value); index += 1; break;
      case '--gate-tfx': options.gateTfx = path.resolve(value); index += 1; break;
      case '--rounds': options.rounds = Number(value); index += 1; break;
      case '--batch': options.batch = Number(value); index += 1; break;
      case '--pervisit': options.perVisit = Number(value); index += 1; break;
      case '--warmup': options.warmup = Number(value); index += 1; break;
      case '--sha': options.headSha = value; index += 1; break;

      // 🎯 THE RESIDENT-SET KNOB, AND IT EXISTS TO TEST A HYPOTHESIS RATHER THAN TO TUNE ONE.
      // Every arm's page is opened up front and held live for the whole round-robin, so a seven-arm
      // run keeps seven 1080x1920 WebGPU contexts resident. The strand ladder used the identical
      // protocol and held its contention gate to ~1%; this held it to 67%, and the difference
      // between them is page weight. `--only` runs a named subset so the gate's spread can be read
      // against the number of live pages and the cause CONFIRMED before anything is rebuilt.
      case '--only': options.only = value.split(',').map((k) => k.trim()); index += 1; break;
      case '--seed': options.seed = Number(value); index += 1; break;
      default: throw new Error(`unknown argument '${flag}'`);
    }
  }

  if (options.gateTfx === null) throw new Error('--gate-tfx is required (the 4,960-strand export)');

  return options;
}

await main();
