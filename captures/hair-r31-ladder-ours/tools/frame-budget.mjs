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

// 🔴 P0 IS NOT A CLOCK-STATE PROBLEM, AND THE DIAGNOSIS THAT SAID IT WAS IS WITHDRAWN.
//
// `docs/CHECKPOINT.md` §17 recorded that this harness "needs the ladder's timing method, not a
// patch", on the reasoning that a bare 720x900 gate page cannot share a DVFS state with 1080x1920
// deferred arms. That reasoning is sound and it is NOT what was producing the non-physical result
// — ribbon arms reading FASTER than no hair at all. It was reached by elimination without ever
// asking the cheaper question first: IS EACH ARM RENDERING WHAT IT CLAIMS?
//
// Nothing here could answer that. `arm.info` collected `trackTimestamp`, `width`, `height` and
// `pixelRatio` — every property of the RENDERER and not one property of the PICTURE — while
// `alive.js` had been publishing `sugata.report().hair` with a full ribbon census the whole time
// and no consumer.
//
// Measured once the census was read, and it is worse than a timing artefact:
//
//   🔴 THE `hair` ARM — THE CARD BASELINE THE WHOLE PRIMITIVE DECISION IS COMPARED AGAINST —
//      ATTACHES NO GROOM ON THIS SERVER. `hairEnabled` true, `hairRequest` set, `report().hair`
//      null after 600 s, one 404 on the page and no warning from `attachHair`. So `hair` and
//      `no-hair` were rendering the SAME PICTURE, and the ribbon arms sit on the same code path.
//      A delta between identical frames is noise, and noise is exactly what it looked like.
//
// ⚠️ WHAT IS NOT YET NAMED IS WHICH RESOURCE 404s. `/assets/hair/bob01/g050.glb` serves 200 with
// its full 3,326,956 bytes under this config, so the groom itself is reachable and the failure is
// something else on the attach path. That is the open thread; the finding above does not depend on
// it, because a bald arm is a bald arm whatever made it bald.
//
// FOUR READINESS DEFECTS WERE FIXED ON THE WAY TO IT, EACH SILENT — see `assertArmRenders` and the
// wait loop in `main`. The one worth reading twice: `waitForFunction` with an ASYNC predicate never
// waits, because an async arrow returns a Promise and a Promise is truthy on the first poll.
// `tools/critic/hair-lightpath.mjs`'s `waitForFigure` — the function whose own docstring warns that
// `__SUGATA_STEP__` exists before the figure does — is written that way and has been winning the
// race rather than waiting for it.

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
        // 🔴 ONE RESOLVE PER FRAME ON THIS PAGE, AND THE FIRST VERSION OF THIS FILE GOT IT WRONG
        // IN A WAY WORTH RECORDING. Burst-then-resolve — which is correct on `strand-spike.html` —
        // reported 315 ms for the no-hair arm. It was not a slow frame: 315.686 / 24 = 13.15 ms,
        // exactly the magnitude `alive.js`'s own header records. `resolveQueriesAsync` groups
        // passes by the frame id in each context's uid and returns the LAST frame's total, and on
        // this page a burst's twenty-four steps landed in ONE such group, so the "frame" it
        // returned was twenty-four of them summed. The strand page does not do this (its burst and
        // its per-frame designs agree to 3%), which is why the divergence had to be found here
        // rather than assumed away.
        //
        // Resolving every frame is safe here for the reason it was NOT safe there: these frames
        // are ~13 ms, so the resolve's own round trip is a few percent of the period rather than
        // half of it, and the GPU never falls off its clock between them.
        const renderer = globalThis.sugata.stage.renderer;
        for (let frame = 0; frame < burst; frame += 1) {
          await globalThis.__SUGATA_STEP__(0);
          await renderer.resolveTimestampsAsync('render');
          out.push(renderer.info.render.timestamp);
        }
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
  console.log(
    `\nTODAY'S CARDS COST   Δp05 ${(hair.p05Ms - control.p05Ms).toFixed(3)}  ` +
    `Δp50 ${(hair.p50Ms - control.p50Ms).toFixed(3)}  ` +
    `Δp95 ${(hair.p95Ms - control.p95Ms).toFixed(3)} ms`
  );
  console.log(
    `HEADROOM AGAINST ${BUDGET_MS} ms   with hair: ` +
    `p50 ${(BUDGET_MS - hair.p50Ms).toFixed(3)}  p95 ${(BUDGET_MS - hair.p95Ms).toFixed(3)} ms   ` +
    `| no hair: p50 ${(BUDGET_MS - control.p50Ms).toFixed(3)}  ` +
    `p95 ${(BUDGET_MS - control.p95Ms).toFixed(3)} ms`
  );
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
