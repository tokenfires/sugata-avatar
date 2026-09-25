import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { decodePng } from '../../../tools/critic/png.mjs';
import { startProbeServer, launchProbeBrowser } from '../../../packages/core/src/render/MotionProbe.mjs';
import { patch, innerValue } from './candidate.mjs';

// Focused replay of HairOIT's C1-C3 protocol. The other order/motion gates are not run here.
const out = 'tmp/hair-sep25/pattern-phase/phase-controls';
fs.mkdirSync(out, {recursive: true});
const server = await startProbeServer({port: 5187});
let browser;
const report = {frames: 128, phase: 977, plates: [], checks: {}};
const sha = data => createHash('sha256').update(data).digest('hex');
const value = (image, i) => 255 * (0.2126 * image.pixels[i * 4] +
  0.7152 * image.pixels[i * 4 + 1] + 0.0722 * image.pixels[i * 4 + 2]);
try {
  browser = await launchProbeBrowser();
  async function capture(arm, phase = 0, defect = null) {
    const context = await browser.newContext({viewport: {width: 900, height: 1200}, deviceScaleFactor: 1});
    try {
      const page = await context.newPage(), errors = [];
      let routes = 0;
      page.on('pageerror', error => errors.push(error.message));
      page.on('console', message => {if (message.type() === 'error' && !message.text().startsWith('Failed to load resource')) errors.push(message.text());});
      page.on('response', response => {if (response.status() >= 400 && !response.url().endsWith('/favicon.ico')) errors.push(response.status() + ' ' + response.url());});
      if (arm === 'candidate') await page.route(/\/HairOIT\.js(?:\?|$)/, async route => {
        const response = await route.fetch();
        routes++;
        await route.fulfill({response, body: patch(await response.text(), 'candidate')});
      });
      const query = '?bare&freeze&seed=1&grain=0&capture' + (arm === 'bald' ? '' : '&hair=1&hairoit=stochastic');
      await page.goto(server.baseUrl + '/alive.html' + query, {waitUntil: 'domcontentloaded'});
      await page.waitForFunction(() => typeof globalThis.__SUGATA_STEP__ === 'function', null, {timeout: 180000, polling: 200});
      if (arm !== 'bald') await page.evaluate(({phase, defect}) => {
        sugata.session.hairMaterial.hairDitherPhase = phase;
        sugata.session.hairMaterial.hairDitherStep = defect;
      }, {phase, defect});
      const uniforms = [];
      for (let i = 0; i < 128; i++) {
        const state = await page.evaluate(async () => {
          await globalThis.__SUGATA_STEP__(0);
          const m = sugata.session.hairMaterial;
          return {inner: m?.hairDitherInnerOffset?.value ?? null,
            outer: m?.hairDitherOffset?.value ?? null};
        });
        uniforms.push(state);
      }
      const actual = await page.evaluate(async () => {
        const adapter = await navigator.gpu.requestAdapter();
        return {stats: sugata.stage.stats, backend: sugata.stage.renderer.backend?.isWebGPUBackend,
          arm: globalThis.__patternPhaseArm ?? 'baseline',
          adapter: {vendor: adapter.info.vendor, architecture: adapter.info.architecture, description: adapter.info.description}};
      });
      assert.equal(actual.backend, true);
      assert.equal(actual.stats.temporalAA, 'taau');
      assert.equal(actual.stats.resolutionScale, 0.66);
      assert.equal(routes, arm === 'candidate' ? 1 : 0);
      if (arm === 'candidate') {
        assert.equal(actual.arm, arm);
        assert.ok(uniforms.every(x => Number.isFinite(x.inner) && x.inner >= 0 && x.inner < 1));
        if (defect === 'frozen-dither') {
          assert.ok(uniforms.every(x => x.inner === innerValue(0, phase, defect)));
          assert.equal(new Set(uniforms.map(x => x.outer)).size, 1);
        } else assert.equal(new Set(uniforms.map(x => x.inner)).size, 128);
      }
      const name = `${arm}-${defect ?? 'normal'}-${phase}.png`;
      const png = await page.screenshot({path: path.join(out, name)});
      assert.deepEqual(errors, []);
      report.plates.push({name, arm, phase, defect, sha256: sha(png), actual, uniforms});
      console.log('Captured ' + name);
      return decodePng(png);
    } finally {await context.close();}
  }
  const bald = await capture('bald');
  const baseline = await capture('baseline');
  const baselineOther = await capture('baseline', 977);
  const mask = Array.from({length: baseline.width * baseline.height}, (_, i) => i)
    .filter(i => Math.abs(value(baseline, i) - value(bald, i)) > 2);
  assert.ok(mask.length > 0);
  report.mask = {pixels: mask.length, rule: 'Existing C protocol: baseline hair minus bald >2 code values; fixed for all arms.'};
  function difference(a, b) {
    let sum = 0, max = 0, overTwo = 0;
    for (const i of mask) {
      const d = Math.abs(value(a, i) - value(b, i));
      sum += d * d; max = Math.max(max, d); if (d > 2) overTwo++;
    }
    return {rms: Math.sqrt(sum / mask.length), max, overTwoPercent: 100 * overTwo / mask.length};
  }
  report.baseline = difference(baseline, baselineOther);
  for (const defect of [null, 'frozen-dither', 'white-dither']) {
    const a = await capture('candidate', 0, defect);
    const b = await capture('candidate', 977, defect);
    report[defect ?? 'candidate'] = difference(a, b);
  }
  report.checks = {
    baselineC1: report.baseline.rms < 8,
    candidateC1: report.candidate.rms < 8,
    candidateC2: report['frozen-dither'].rms > 10 && report['frozen-dither'].rms > 3 * report.candidate.rms,
    candidateC3: report['white-dither'].rms > 1.15 * report.candidate.rms
  };
  console.log(JSON.stringify({baseline: report.baseline, candidate: report.candidate,
    frozen: report['frozen-dither'], white: report['white-dither'], checks: report.checks}, null, 2));
  if (Object.values(report.checks).includes(false)) process.exitCode = 1;
} finally {
  if (browser) await browser.close();
  await server.close();
  fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2) + '\n');
}
