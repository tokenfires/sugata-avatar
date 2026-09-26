// Serial native scroll gate; baseline records the existing crop, candidate requires its closure.
// node docs/evidence/nonhair-2026-09-26/review-scroll/probe.mjs --mode=baseline --out=FRESH_DIR
// node docs/evidence/nonhair-2026-09-26/review-scroll/probe.mjs --mode=candidate --baseline=BASE/report.json --out=FRESH_DIR [--production]
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { startProbeServer, launchProbeBrowser } from '../../../../packages/core/src/render/MotionProbe.mjs';
import { decodePng } from '../../../../tools/critic/png.mjs';

const root = fileURLToPath(new URL('../../../../', import.meta.url));
const arg = key => process.argv.find(value => value.startsWith(`--${key}=`))?.slice(key.length + 3);
const mode = arg('mode'), out = arg('out') && path.resolve(arg('out')), production = process.argv.includes('--production');
assert.ok(['baseline', 'candidate'].includes(mode), 'Choose --mode=baseline or candidate');
assert.ok(out && !fs.existsSync(out), 'Choose a fresh --out directory');
const baseline = mode === 'candidate' ? JSON.parse(fs.readFileSync(arg('baseline'))) : null;
if (baseline) assert.ok(baseline.completed && baseline.mode === 'baseline', 'Candidate requires a completed baseline');
fs.mkdirSync(out, { recursive: true });
const sha = value => createHash('sha256').update(value).digest('hex');
const walk = directory => fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const file = path.join(directory, entry.name); return entry.isDirectory() ? walk(file) : [path.relative(root, file)];
});
const sources = [...new Set([
    'docs/evidence/nonhair-2026-09-26/review-scroll/probe.mjs', 'packages/testbed/src/portrait.html', 'packages/testbed/src/portrait.js',
    'packages/testbed/src/showcase.html', 'packages/testbed/src/showcase.js', 'packages/testbed/src/showcase-presets.mjs',
    'packages/testbed/src/showcase-settings.mjs', 'packages/testbed/src/portrait-selection.mjs', 'packages/testbed/src/viewer-framing.mjs',
    'packages/testbed/src/viewer-scenes.mjs', 'tools/critic/png.mjs', 'package.json', 'package-lock.json', 'vite.config.js',
    'node_modules/three/examples/jsm/controls/OrbitControls.js', ...walk(root + 'packages/core/src'), ...walk(root + 'assets')
])].sort();
const hashes = files => Object.fromEntries(files.map(file => [file, sha(fs.readFileSync(root + file))]));
const report = { mode, production, startedAt: new Date().toISOString(), sourceHashes: hashes(sources),
    baseline: baseline ? { file: path.resolve(arg('baseline')), sha256: sha(fs.readFileSync(arg('baseline'))) } : null,
    cases: [], checks: [], errors: [], completed: false,
    scope: 'Scroll usability on existing g050 views. Native renderer, real sidebar/gutter wheel and keyboard focus, pinned canvas drag/dolly and one room switch/PNG export. No hair, fit, motion or image-quality acceptance.' };
if (baseline) for (const [file, hash] of Object.entries(baseline.sourceHashes))
    if (!['packages/testbed/src/portrait.html', 'packages/testbed/src/showcase.html'].includes(file))
        assert.equal(report.sourceHashes[file], hash, `Non-CSS source changed since baseline: ${file}`);
const save = () => fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2) + '\n');
const check = name => { report.checks.push(name); console.log('PASS ' + name); save(); };
let server, browser, page, rec;
async function settle(count = 8) {
    await page.evaluate(async count => {
        const api = window.portrait ?? window.showcase;
        for (let i = 0; i < count; i++) { await new Promise(requestAnimationFrame); await api.step(0); }
    }, count);
}
async function ready() {
    await page.waitForFunction(() => window.portrait || window.showcase || !document.querySelector('#error').hidden, null, { timeout: 120000 });
    assert.equal(await page.locator('#error').textContent(), ''); await settle();
}
async function settleScroll() {
    await page.evaluate(async () => {
        const start = performance.now(); let previous = '', stable = 0;
        do {
            await new Promise(requestAnimationFrame); await (window.portrait ?? window.showcase).step(0);
            const preview = document.querySelector('.portrait, .viewport').getBoundingClientRect(), footer = document.querySelector('footer').getBoundingClientRect();
            const signature = [scrollY, preview.y, footer.y, visualViewport.offsetTop, visualViewport.pageTop].join(':');
            stable = signature === previous ? stable + 1 : 0; previous = signature;
            // DOM can be stationary during compositor-only elastic scroll. See settled-1024-v1.
            if (performance.now() - start >= 1000 && stable >= 12) return;
        } while (performance.now() - start < 5000);
        throw new Error('Scroll layout did not settle');
    });
}
async function state() {
    return page.evaluate(() => {
        const api = window.portrait ?? window.showcase, a = api.avatar, camera = a.stage.camera, canvas = document.querySelector('#stage');
        const rect = selector => { const node = document.querySelector(selector); if (!node) return null;
            const r = node.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height, bottom: r.bottom, right: r.right }; };
        const selector = window.portrait ? '.portrait' : '.viewport', preview = rect(selector);
        const head = { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity };
        for (const point of api.framing.points) { const p = point.clone().project(camera);
            head.minX = Math.min(head.minX, p.x); head.maxX = Math.max(head.maxX, p.x); head.minY = Math.min(head.minY, p.y); head.maxY = Math.max(head.maxY, p.y); }
        const attention = api.attention.report();
        return { scrollY, viewport: { width: innerWidth, height: innerHeight, scrollWidth: document.documentElement.scrollWidth },
            cssPosition: getComputedStyle(document.querySelector(selector)).position, preview, canvas: rect('#stage'), main: rect('main'), footer: rect('footer'),
            room: rect('#scene-controls'), lower: rect(window.portrait ? '#reset-view' : '#open-settings'), active: document.activeElement?.id,
            visibleHeight: Math.max(0, Math.min(innerHeight, preview.bottom) - Math.max(0, preview.y)),
            dimensions: { width: canvas.clientWidth, height: canvas.clientHeight, bufferWidth: canvas.width, bufferHeight: canvas.height },
            camera: { position: camera.position.toArray(), quaternion: camera.quaternion.toArray(), target: api.controls.target.toArray(),
                zoom: camera.zoom, aspect: camera.aspect, effectiveFov: camera.getEffectiveFOV(), radius: camera.position.distanceTo(api.controls.target) },
            headNDC: head, clock: a.clockSeconds, attention: { phase: attention.phase, target: attention.target, expression: attention.expression, holdsGaze: attention.holdsGaze },
            scene: a.report().scene.id, configuration: window.showcase ? showcase.configuration() : null, backend: a.stage.backendName };
    });
}
function near(actual, expected, label, tolerance = 1e-12) {
    if (Array.isArray(expected)) expected.forEach((value, i) => near(actual[i], value, `${label}[${i}]`, tolerance));
    else if (expected && typeof expected === 'object') for (const [key, value] of Object.entries(expected)) near(actual[key], value, `${label}.${key}`, tolerance);
    else if (typeof expected === 'number') assert.ok(Math.abs(actual - expected) <= tolerance, `${label}: ${actual} != ${expected}`);
    else assert.deepEqual(actual, expected, label);
}
function invariant(before, after) {
    assert.deepEqual(after.dimensions, before.dimensions); near(after.camera, before.camera, 'camera'); near(after.headNDC, before.headNDC, 'head projection');
    assert.equal(after.clock, before.clock); assert.deepEqual(after.attention, before.attention); assert.deepEqual(after.configuration, before.configuration);
}
function assertSticky(s) {
    assert.equal(s.cssPosition, 'sticky');
    // A sticky item may move upward when its containing main ends; never allow it across that boundary.
    const expectedTop = Math.min(16, s.main.bottom - s.preview.height);
    assert.ok(Math.abs(s.preview.y - expectedTop) <= 1, `sticky top ${s.preview.y}, expected ${expectedTop}`);
    assert.ok(s.preview.y >= 0, 'Pinned preview extends above the viewport');
    assert.ok(Math.abs(s.visibleHeight - s.preview.height) <= 1, 'Pinned preview is not completely visible');
    assert.ok(s.preview.bottom <= s.viewport.height - 15, 'Pinned preview extends below usable viewport');
    assert.ok(s.preview.right <= s.room.x - 1, 'Preview overlaps sidebar');
    assert.ok(s.preview.bottom <= s.main.bottom + 1, 'Preview extends beyond containing main');
}
async function plate(label, s = null) {
    await settleScroll(); const current = await state();
    if (s) assert.deepEqual(current, s, 'State changed before settled screenshot');
    const file = `${rec.name}-${label}.png`; await page.screenshot({ path: path.join(out, file), fullPage: false });
    const after = await state(); assert.deepEqual(after, current, 'State changed during screenshot');
    const image = decodePng(fs.readFileSync(path.join(out, file)));
    assert.equal(image.width, current.viewport.width); assert.equal(image.height, current.viewport.height);
    rec.plates.push({ file, sha256: sha(fs.readFileSync(path.join(out, file))), state: current, after }); save(); return current;
}
async function wheel(delta, gutter = false) {
    const point = await page.evaluate(gutter => { const r = document.querySelector('aside').getBoundingClientRect();
        return { x: gutter ? innerWidth - 5 : r.x + r.width / 2, y: Math.min(innerHeight - 40, 350) }; }, gutter);
    await page.mouse.move(point.x, point.y);
    let left = Math.abs(delta), sign = Math.sign(delta), iterations = 0;
    while (left > 0 && iterations++ < 40) {
        const available = await page.evaluate(sign => sign > 0 ? document.scrollingElement.scrollHeight - innerHeight - scrollY : scrollY, sign);
        const amount = Math.min(160, left, Math.max(0, available)); if (amount <= 0) break;
        await page.mouse.wheel(0, sign * amount); await settleScroll(); left -= amount;
    }
    assert.ok(iterations < 40, 'Bounded wheel did not reach its target');
}
async function top() { await page.evaluate(() => scrollTo(0, 0)); await settle(4); }
function pngReceipt(file) {
    const bytes = fs.readFileSync(file), decoded = decodePng(bytes); let low = Infinity, high = -Infinity;
    for (let i = 0; i < decoded.pixels.length; i += 4) { low = Math.min(low, decoded.pixels[i]); high = Math.max(high, decoded.pixels[i]); }
    assert.ok(high - low > .1, 'PNG is empty or uniform');
    return { file: path.basename(file), sha256: sha(bytes), width: decoded.width, height: decoded.height, redRange: [low, high] };
}
async function instrumentPng() {
    const data = await page.evaluate(async () => { const api = window.portrait ?? window.showcase; api.avatar.stage.draw();
        const blob = await new Promise(resolve => document.querySelector('#stage').toBlob(resolve, 'image/png'));
        return Array.from(new Uint8Array(await blob.arrayBuffer())); });
    const file = path.join(out, `${rec.name}-initial-canvas.png`); fs.writeFileSync(file, Buffer.from(data)); return pngReceipt(file);
}
async function nativePng() {
    const event = page.waitForEvent('download'); await page.locator('#save-image').click(); const download = await event;
    const file = path.join(out, `${rec.name}-pinned-native-export.png`); await download.saveAs(file); return pngReceipt(file);
}
async function responsive() {
    const canonical = await state(); rec.responsive = [];
    for (const variant of [{ name: 'mobile', width: 390, height: 844 }, { name: 'short', width: 1440, height: rec.page === 'portrait' ? 600 : 700 }]) {
        await page.setViewportSize({ width: variant.width, height: variant.height }); await top(); await settle(); const before = await state();
        assert.equal(before.cssPosition, 'relative'); assert.ok(before.viewport.scrollWidth <= before.viewport.width);
        await wheel(240, true); const after = await state(); invariant(before, after);
        assert.ok(after.scrollY > before.scrollY + 100); assert.ok(Math.abs(after.preview.y - before.preview.y + after.scrollY - before.scrollY) < 1);
        if (baseline) {
            const reference = baseline.cases.find(item => item.name === rec.name).responsive.find(item => item.name === variant.name);
            assert.deepEqual(before.dimensions, reference.before.dimensions); near(before.camera, reference.before.camera, 'responsive baseline camera');
        }
        rec.responsive.push({ name: variant.name, before, after }); await plate(variant.name, after);
    }
    await page.setViewportSize(rec.viewport); await top(); await settle(); const returned = await state();
    invariant(canonical, returned); assert.equal(returned.cssPosition, mode === 'candidate' ? 'sticky' : 'relative');
    check(`${rec.name}: mobile and short windows keep ordinary scrolling; desktop round trip preserves view`);
}
async function nativeInput(canonical) {
    await wheel(500); const pinned = await state(); assertSticky(pinned);
    const x = pinned.canvas.x + pinned.canvas.width * .5, y = pinned.canvas.y + pinned.canvas.height * .5;
    await page.mouse.move(x, y); await page.mouse.down(); await page.mouse.move(x + 45, y + 10, { steps: 8 }); await page.mouse.up(); await settle();
    const dragged = await state(); assert.notDeepEqual(dragged.camera.quaternion, pinned.camera.quaternion); assert.notEqual(dragged.attention.phase, 'attending');
    await page.mouse.move(x, y); await page.mouse.wheel(0, 120); await settle(); const dollied = await state();
    assert.ok(dollied.camera.radius > dragged.camera.radius); assert.equal(dollied.scrollY, dragged.scrollY);
    rec.input = { pinned, dragged, dollied };
    if (rec.page === 'portrait') {
        await page.locator('#reset-view').click(); await settle(); const reset = await state(); near(reset.camera, canonical.camera, 'native reset');
        rec.input.reset = reset;
        await Promise.all([page.waitForEvent('domcontentloaded'), page.locator('[data-scene="kitchen"]').click()]); await ready(); await wheel(500);
        const room = await state(); assert.equal(room.scene, 'kitchen'); assertSticky(room);
        assert.equal(await page.evaluate(() => portrait.avatar.report().scene.lighting.exposure), 2.04);
        rec.input.room = room; await plate('pinned-kitchen', room);
    }
    check(`${rec.name}: native drag/dolly work at pinned screen position${rec.page === 'portrait' ? ', reset and one room switch remain usable' : ''}`);
}
try {
    if (production) {
        const { preview } = await import('vite'); const previewServer = await preview({ configFile: root + 'vite.pages.config.js', preview: { host: '127.0.0.1', port: 5371, strictPort: false }, logLevel: 'error' });
        server = { baseUrl: previewServer.resolvedUrls.local[0].replace(/\/$/, ''), close: () => new Promise((resolve, reject) => previewServer.httpServer.close(error => error ? reject(error) : resolve())) };
        report.builtHashes = hashes(walk(root + 'dist-pages').filter(file => /\.(html|js|css)$/.test(file)));
    } else server = await startProbeServer({ port: 5371 });
    browser = await launchProbeBrowser(); report.browserVersion = browser.version(); save();
    for (const item of [{ page: 'portrait', width: 1440, height: 1000 }, { page: 'showcase', width: 1440, height: 1000 }, { page: 'showcase', width: 1024, height: 800 }]) {
        rec = { name: `${item.page}-${item.width}x${item.height}`, page: item.page, viewport: { width: item.width, height: item.height }, plates: [] }; report.cases.push(rec);
        page = await browser.newPage({ viewport: rec.viewport, deviceScaleFactor: 1 });
        const name = rec.name;
        page.on('pageerror', error => report.errors.push({ name, kind: 'page', message: error.message }));
        page.on('console', message => { if (message.type() === 'error') report.errors.push({ name, kind: 'console', message: message.text() }); });
        page.on('requestfailed', request => report.errors.push({ name, kind: 'request', url: request.url(), message: request.failure()?.errorText }));
        page.on('response', response => { if (response.status() >= 400) report.errors.push({ name, status: response.status(), url: response.url() }); });
        await page.goto(`${server.baseUrl}/src/${item.page}.html?capture=scroll${item.page === 'showcase' ? '&frame=portrait' : ''}`); await ready();
        await page.locator('#look-toward-me').click(); await settle(2); await top(); const initial = await state(); rec.initial = initial;
        assert.equal(initial.backend, 'webgpu'); assert.equal(initial.attention.phase, 'attending'); assert.equal(initial.scrollY, 0);
        assert.equal(initial.cssPosition, mode === 'candidate' ? 'sticky' : 'relative');
        if (baseline) { const previous = baseline.cases.find(entry => entry.name === rec.name).initial; invariant(previous, initial); }
        await plate('initial', initial);
        if (item.page === 'showcase' && item.width === 1440) rec.initialPng = await instrumentPng();
        await wheel(500); const scrolled = await state(); invariant(initial, scrolled); assert.ok(scrolled.scrollY > 100);
        if (mode === 'candidate') assertSticky(scrolled); else assert.ok(scrolled.visibleHeight < initial.visibleHeight - 100, 'Baseline must witness preview loss');
        rec.scrolled = scrolled; await plate('sidebar-wheel', scrolled);
        await page.locator(item.page === 'portrait' ? '#pause' : '#copy').focus(); await page.keyboard.press('Tab'); await settle(4);
        const focused = await state(); invariant(initial, focused); assert.equal(focused.active, item.page === 'portrait' ? 'reset-view' : 'open-settings');
        if (mode === 'candidate') assertSticky(focused); rec.focused = focused; await plate('lower-keyboard-focus', focused);
        if (mode === 'candidate' && item.page === 'showcase' && item.width === 1440) {
            rec.exportPng = await nativePng(); assert.equal(rec.exportPng.width, rec.initialPng.width); assert.equal(rec.exportPng.height, rec.initialPng.height);
            invariant(initial, await state()); check('native PNG at pinned export control preserves fixed-clock canvas dimensions, camera projection and configuration');
        }
        await wheel(5000, true); const end = await state(); invariant(initial, end);
        if (mode === 'candidate') assertSticky(end); rec.end = end; await plate('document-end', end);
        await wheel(-5000, true); const returned = await state(); invariant(initial, returned); assert.equal(returned.scrollY, 0); assert.equal(returned.preview.y, initial.preview.y);
        check(`${rec.name}: real sidebar wheel, lower-control keyboard focus and document-end scrolling ${mode === 'baseline' ? 'record preview crop' : 'retain complete preview'} without changing camera/canvas/attention`);
        if (item.width === 1440) await responsive();
        if (mode === 'candidate' && item.width === 1440) await nativeInput(initial);
        await page.close(); page = null;
    }
    assert.deepEqual(report.errors, []); assert.deepEqual(hashes(sources), report.sourceHashes);
    if (report.builtHashes) assert.deepEqual(hashes(Object.keys(report.builtHashes)), report.builtHashes);
    check('native pages have no console/page/network errors and bound source/assets/build outputs stay exact');
    report.completed = true; report.completedAt = new Date().toISOString(); save();
} catch (error) {
    report.error = error.stack; save(); await page?.screenshot({ path: path.join(out, 'failure.png'), fullPage: false }).catch(() => {}); throw error;
} finally { await page?.close(); await browser?.close(); await server?.close(); }
