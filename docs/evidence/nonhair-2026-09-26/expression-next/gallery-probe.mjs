import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { launchProbeBrowser } from '../../../../packages/core/src/render/MotionProbe.mjs';

const here = path.dirname(fileURLToPath(import.meta.url)), out = process.argv[2] && path.resolve(process.argv[2]);
assert.ok(out && !fs.existsSync(out), 'Fresh gallery output directory required'); fs.mkdirSync(out, { recursive: true });
const sha = b => createHash('sha256').update(b).digest('hex');
const files = ['review.html', 'review.js', 'review.css', 'review-manifest.json', 'gallery-probe.mjs'];
const hashes = () => Object.fromEntries(files.map(p => [p, sha(fs.readFileSync(here + '/' + p))]));
const report = { startedAt: new Date().toISOString(), sourceHashes: hashes(), checks: [], images: [], errors: [], completed: false };
const save = () => fs.writeFileSync(out + '/report.json', JSON.stringify(report, null, 2) + '\n');
let browser, page;
async function ready() { await page.waitForFunction(() => document.querySelectorAll('.image img').length === 3 && [...document.querySelectorAll('.image img')].every(i => i.complete && i.naturalWidth > 0) && !document.querySelector('#play').disabled); }
async function state() {
    const s = await page.evaluate(() => ({ time: document.querySelector('#time').textContent,
        status: document.querySelector('#status').textContent, error: document.querySelector('#error').hidden ? null : document.querySelector('#error-message').textContent,
        pressed: [...document.querySelectorAll('#groups button[aria-pressed="true"]')].map(b => b.dataset.group),
        play: document.querySelector('#play').textContent, viewport: { width: innerWidth, scrollWidth: document.documentElement.scrollWidth },
        strip: { width: document.querySelector('.comparison-scroll').clientWidth, scrollWidth: document.querySelector('.comparison-scroll').scrollWidth },
        images: [...document.querySelectorAll('.image img')].map(i => ({ src: i.src, alt: i.alt, width: i.naturalWidth, height: i.naturalHeight, objectFit: getComputedStyle(i).objectFit })) }));
    assert.equal(s.images.length, 3); const steps = s.images.map(i => /-(\d{4})\.png$/.exec(i.src)?.[1]);
    assert.ok(steps.every(v => v && v === steps[0]), 'All gallery views must display the same native step');
    assert.ok(s.images.every(i => i.objectFit === 'contain' && i.width > 0 && i.height > 0));
    assert.equal(s.error, null); assert.ok(s.viewport.scrollWidth <= s.viewport.width); return s;
}
async function plate(name) { const file = name + '.png'; await page.screenshot({ path: out + '/' + file, fullPage: true });
    report.images.push({ file, sha256: sha(fs.readFileSync(out + '/' + file)), state: await state() }); save(); }
try {
    browser = await launchProbeBrowser(); page = await browser.newPage({ viewport: { width: 1440, height: 1100 }, deviceScaleFactor: 1 });
    page.on('pageerror', e => report.errors.push({ kind: 'pageerror', message: e.message }));
    page.on('console', m => { if (m.type() === 'error') report.errors.push({ kind: 'console', message: m.text() }); });
    page.on('requestfailed', r => report.errors.push({ kind: 'network', url: r.url(), error: r.failure()?.errorText }));
    page.on('response', r => { if (r.status() >= 400) report.errors.push({ kind: 'http', status: r.status(), url: r.url() }); });
    await page.goto('http://127.0.0.1:5173/@fs' + here + '/review.html'); await ready(); await plate('desktop-quiet-start');
    await page.getByRole('button', { name: 'Show matched sample nearest 0.85 seconds', exact: true }).click();
    await page.waitForFunction(() => document.querySelector('#time').textContent === '0.85 s'); await plate('desktop-quiet-hold');
    await page.locator('#play').click();
    await page.waitForFunction(() => parseFloat(document.querySelector('#time').textContent) > 1.4);
    await page.locator('#play').click(); const paused = await state(); assert.equal(paused.play, 'Play');
    await page.waitForTimeout(250); assert.deepEqual(await state(), paused);
    report.checks.push('Real common playback advances matched images, then pause retains all three at one time');
    await page.locator('[data-group="speech"]').click(); await page.waitForFunction(() => document.querySelector('#time').textContent === '0.00 s' && document.querySelectorAll('.image img').length === 3); await ready();
    assert.deepEqual((await state()).pressed, ['speech']);
    await page.getByRole('button', { name: 'Show matched sample nearest 2.60 seconds', exact: true }).click();
    await page.waitForFunction(() => document.querySelector('#time').textContent === '2.60 s'); await plate('desktop-speech-hold');
    await page.locator('#next').focus(); await page.keyboard.press('Enter');
    await page.waitForFunction(() => parseFloat(document.querySelector('#time').textContent) > 2.6); await state();
    report.checks.push('Quiet/speech switches reset all views together; endpoint and keyboard frame controls work');
    await page.setViewportSize({ width: 390, height: 844 }); await plate('mobile-speech');
    const mobile = await state(); assert.ok(mobile.strip.scrollWidth > mobile.strip.width);
    await page.locator('.comparison-scroll').evaluate(el => { el.scrollLeft = el.scrollWidth; });
    await page.locator('.comparison-scroll').scrollIntoViewIfNeeded(); await plate('mobile-third-view');
    report.checks.push('Desktop/mobile keep complete images; narrow screen uses contained horizontal review strip');
    assert.deepEqual(report.errors, []); report.finalSourceHashes = hashes(); assert.deepEqual(report.finalSourceHashes, report.sourceHashes);
    report.completed = true; save(); console.log('PASS static gallery:3 groups,5 plates');
} catch (e) { report.failure = e.stack; save(); throw e; }
finally { await browser?.close(); }
