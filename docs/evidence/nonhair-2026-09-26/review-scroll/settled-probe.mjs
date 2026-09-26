// Bounded follow-up for the Wardrobe1024 end-scroll image/DOM discrepancy. CSS unchanged.
// node docs/evidence/nonhair-2026-09-26/review-scroll/settled-probe.mjs FRESH_OUTPUT
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { launchProbeBrowser } from '../../../../packages/core/src/render/MotionProbe.mjs';
import { decodePng } from '../../../../tools/critic/png.mjs';
const root = fileURLToPath(new URL('../../../../', import.meta.url)), base = 'docs/evidence/nonhair-2026-09-26/review-scroll/';
const out = process.argv[2] && path.resolve(process.argv[2]); assert.ok(out && !fs.existsSync(out), 'Fresh output required');
const sha = value => createHash('sha256').update(value).digest('hex');
const previous = JSON.parse(fs.readFileSync(root + base + 'candidate-v1/report.json'));
const sourceHashes = Object.fromEntries(Object.keys(previous.sourceHashes).filter(file => file !== base + 'probe.mjs').map(file => [file, sha(fs.readFileSync(root + file))]));
for (const [file, hash] of Object.entries(sourceHashes)) assert.equal(hash, previous.sourceHashes[file], file);
const helper = base + 'settled-probe.mjs'; sourceHashes[helper] = sha(fs.readFileSync(root + helper));
for (const [file, hash] of Object.entries(previous.builtHashes)) assert.equal(sha(fs.readFileSync(root + file)), hash, file);
fs.mkdirSync(out, { recursive: true });
const report = { scope: 'One unchanged production Wardrobe1024x800 page; bound real-wheel increments plus compositor settling and screenshot-adjacent state. No new product changes.',
    oldReportSha256: sha(fs.readFileSync(root + base + 'candidate-v1/report.json')), sourceHashes, builtHashes: previous.builtHashes,
    startedAt: new Date().toISOString(), plates: [], errors: [], completed: false };
const save = () => fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2) + '\n');
let server, browser, page;
async function state() { return page.evaluate(() => {
    const canvas = document.querySelector('#stage'), camera = showcase.avatar.stage.camera;
    const rect = selector => { const r = document.querySelector(selector).getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height, bottom: r.bottom }; };
    return { scrollY, maxScroll: document.scrollingElement.scrollHeight - innerHeight, viewport: { width: innerWidth, height: innerHeight },
        visualViewport: { offsetTop: visualViewport.offsetTop, pageTop: visualViewport.pageTop, height: visualViewport.height },
        canvas: rect('#stage'), preview: rect('.viewport'), footer: rect('footer'), main: rect('main'), room: rect('#scene-controls'),
        camera: { position: camera.position.toArray(), quaternion: camera.quaternion.toArray(), target: showcase.controls.target.toArray(), zoom: camera.zoom, aspect: camera.aspect },
        dimensions: [canvas.clientWidth, canvas.clientHeight, canvas.width, canvas.height], clock: showcase.avatar.clockSeconds,
        attention: showcase.attention.report(), configuration: showcase.configuration() };
}); }
async function settleScroll() {
    return page.evaluate(async () => {
        const start = performance.now(); let previous = '', stable = 0, frames = 0;
        do {
            await new Promise(requestAnimationFrame); await showcase.step(0); frames++;
            const preview = document.querySelector('.viewport').getBoundingClientRect(), footer = document.querySelector('footer').getBoundingClientRect();
            const signature = [scrollY, preview.y, footer.y, visualViewport.offsetTop, visualViewport.pageTop].join(':');
            stable = signature === previous ? stable + 1 : 0; previous = signature;
            // DOM can be stable during compositor-only elastic overscroll; include a settling interval.
            if (performance.now() - start >= 1000 && stable >= 12) return { milliseconds: performance.now() - start, frames, stable, signature };
        } while (performance.now() - start < 5000);
        throw new Error('Scroll layout did not settle');
    });
}
async function boundedWheel(amount) {
    let left = Math.abs(amount), sign = Math.sign(amount), iterations = 0;
    while (left > 0 && iterations++ < 30) {
        const s = await state(), available = sign > 0 ? s.maxScroll - s.scrollY : s.scrollY;
        const delta = Math.min(160, left, Math.max(0, available)); if (delta <= 0) break;
        await page.mouse.move(1000, 350); await page.mouse.wheel(0, sign * delta); await settleScroll(); left -= delta;
    }
    assert.ok(iterations < 30, 'Bounded wheel did not reach its target');
}
function invariant(a, b) {
    for (const key of ['camera', 'dimensions', 'clock', 'attention', 'configuration']) assert.deepEqual(b[key], a[key], key);
}
function pixelWitness(image, s) {
    const pixel = (x, y) => Array.from(image.pixels.slice((y * image.width + x) * 4, (y * image.width + x) * 4 + 3), value => Math.round(value * 255));
    const body = [16, 17, 16], border = [53, 58, 50], expectedFooter = s.footer.y;
    const footerRows = [];
    if (expectedFooter >= 0 && expectedFooter < image.height) {
        for (let y = Math.max(0, Math.floor(expectedFooter) - 2); y <= Math.min(image.height - 1, Math.ceil(expectedFooter) + 2); y++)
            if (pixel(0, y).every((value, i) => Math.abs(value - border[i]) <= 1)) footerRows.push(y);
        assert.ok(footerRows.length, `Footer border pixels do not match recorded y${expectedFooter}`);
    }
    const x = Math.ceil(s.canvas.x) + 10, top = Math.round(s.canvas.y), bottom = Math.round(s.canvas.bottom);
    const edges = { x, topOutside: pixel(x, top - 2), topInside: pixel(x, top + 2), bottomInside: pixel(x, bottom - 2), bottomOutside: pixel(x, bottom + 2) };
    assert.deepEqual(edges.topOutside, body); assert.deepEqual(edges.bottomOutside, body);
    assert.notDeepEqual(edges.topInside, body); assert.notDeepEqual(edges.bottomInside, body);
    return { expectedFooter, footerRows, edges };
}
async function plate(label, canonical) {
    const settling = await settleScroll(), before = await state(); invariant(canonical, before);
    assert.equal(before.preview.y, 16); assert.equal(before.preview.height, 700); assert.equal(before.preview.bottom, 716);
    assert.ok(before.preview.bottom <= before.viewport.height - 16);
    const file = label + '.png'; await page.screenshot({ path: path.join(out, file), fullPage: false }); const after = await state();
    assert.deepEqual(after, before, 'Screenshot state changed during capture');
    const bytes = fs.readFileSync(path.join(out, file)), image = decodePng(bytes);
    assert.equal(image.width, 1024); assert.equal(image.height, 800);
    report.plates.push({ file, sha256: sha(bytes), settling, before, after, pixels: pixelWitness(image, before) }); save();
}
try {
    const { preview } = await import('vite'); server = await preview({ configFile: root + 'vite.pages.config.js', preview: { host: '127.0.0.1', port: 5372, strictPort: false }, logLevel: 'error' });
    browser = await launchProbeBrowser(); page = await browser.newPage({ viewport: { width: 1024, height: 800 }, deviceScaleFactor: 1 });
    page.on('pageerror', error => report.errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') report.errors.push(message.text()); });
    page.on('requestfailed', request => report.errors.push(request.url() + ' ' + request.failure()?.errorText));
    page.on('response', response => { if (response.status() >= 400) report.errors.push(response.status() + ' ' + response.url()); });
    await page.goto(server.resolvedUrls.local[0] + 'src/showcase.html?capture=scroll&frame=portrait');
    await page.waitForFunction(() => window.showcase || !document.querySelector('#error').hidden, null, { timeout: 120000 });
    assert.equal(await page.locator('#error').textContent(), ''); await settleScroll();
    await page.locator('#look-toward-me').click(); await settleScroll(); await page.evaluate(() => scrollTo(0, 0)); await settleScroll();
    const canonical = await state(); report.initial = canonical;
    await boundedWheel(500); await plate('sidebar-wheel', canonical);
    await page.locator('#copy').focus(); await page.keyboard.press('Tab'); await plate('lower-keyboard-focus', canonical);
    await boundedWheel(10000); const end = await state(); assert.equal(end.scrollY, end.maxScroll); await plate('settled-document-end', canonical);
    for (const [file, hash] of Object.entries(sourceHashes)) assert.equal(sha(fs.readFileSync(root + file)), hash, file);
    for (const [file, hash] of Object.entries(report.builtHashes)) assert.equal(sha(fs.readFileSync(root + file)), hash, file);
    assert.deepEqual(report.errors, []); report.completed = true; report.completedAt = new Date().toISOString(); save();
    console.log('PASS unchanged CSS: settled sidebar/focus/end plates agree with before/after DOM, canvas edges and footer pixels');
} catch (error) { report.error = error.stack; save(); throw error; }
finally { await page?.close(); await browser?.close(); await new Promise((resolve, reject) => server ? server.httpServer.close(error => error ? reject(error) : resolve()) : resolve()); }
