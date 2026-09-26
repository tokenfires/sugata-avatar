// Focused native review-room UI gate. Owns no production source or lighting overrides.
// node docs/evidence/nonhair-2026-09-26/rooms/portrait-probe.mjs FRESH_OUTPUT
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { startProbeServer, launchProbeBrowser } from '../../../../packages/core/src/render/MotionProbe.mjs';

const root = fileURLToPath(new URL('../../../../', import.meta.url)), out = path.resolve(process.argv[2] ?? '');
assert.ok(process.argv[2] && !fs.existsSync(out), 'Fresh output directory required');
fs.mkdirSync(out, { recursive: true });
const sha = value => createHash('sha256').update(value).digest('hex');
const walk = directory => fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const file = path.join(directory, entry.name); return entry.isDirectory() ? walk(file) : [path.relative(root, file)];
});
const sources = [...new Set([
    'docs/evidence/nonhair-2026-09-26/rooms/portrait-probe.mjs', 'packages/testbed/src/portrait.js',
    'packages/testbed/src/portrait.html', 'packages/testbed/src/portrait-selection.mjs',
    'packages/testbed/src/viewer-framing.mjs', 'packages/testbed/src/viewer-scenes.mjs',
    'tools/critic/png.mjs', 'package.json', 'package-lock.json', 'vite.config.js', 'node_modules/three/package.json',
    ...walk(path.join(root, 'packages/core/src')), ...walk(path.join(root, 'assets'))
])].sort();
const hashes = () => Object.fromEntries(sources.map(file => [file, sha(fs.readFileSync(path.join(root, file)))]));
const report = { startedAt: new Date().toISOString(), head: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
    sourceHashes: hashes(), sourceScope: 'This helper, Portrait/shared viewer files, core, assets and package metadata. Parallel Wardrobe page sources deliberately excluded.',
    cases: [], checks: [], errors: [], completed: false,
    scope: 'Four fresh native UI cases, both current bobs on desktop and reduced-motion mobile. Eight neutral views with paired canvas/UI PNGs. No lighting override, asset edit, hair fix or all-motion appearance claim.' };
const save = () => fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2) + '\n');
const zero = { pleasure: 0, arousal: 0, dominance: 0 };
let server, browser, page, rec;
async function state() {
    return page.evaluate(() => {
        const { avatar: a, attention, controls, framing } = portrait, r = a.report(), camera = a.stage.camera;
        const bounds = { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity };
        for (const point of framing.points) {
            const p = point.clone().project(camera);
            bounds.minX = Math.min(bounds.minX, p.x); bounds.maxX = Math.max(bounds.maxX, p.x);
            bounds.minY = Math.min(bounds.minY, p.y); bounds.maxY = Math.max(bounds.maxY, p.y);
        }
        const canvas = document.querySelector('#stage'), w = canvas.clientWidth, h = canvas.clientHeight;
        return { url: location.href, documentId: window.roomDocumentId, clock: a.clockSeconds,
            backend: a.stage.backendName, identity: r.identity, hair: r.hair.loadedStyle,
            scene: r.scene, lighting: { ...a.lighting }, target: { ...a.affectState.target }, pad: a.affectState.pad,
            selectedExpressions: [...document.querySelectorAll('[data-expression][aria-pressed="true"]')].map(el => el.dataset.expression),
            attention: attention.report(), paused: document.querySelector('#pause').getAttribute('aria-pressed') === 'true',
            selectedRooms: [...document.querySelectorAll('[data-scene][aria-pressed="true"]')].map(el => el.dataset.scene),
            lightHidden: document.querySelector('#light-controls').hidden,
            camera: { position: camera.position.toArray(), quaternion: camera.quaternion.toArray(), target: controls.target.toArray(), zoom: camera.zoom, aspect: camera.aspect },
            framing: framing.report(), neutralHeadNDC: bounds,
            neutralHeadGutters: { left: (1 + bounds.minX) * w / 2, right: (1 - bounds.maxX) * w / 2,
                top: (1 - bounds.maxY) * h / 2, bottom: (1 + bounds.minY) * h / 2 },
            viewport: { width: innerWidth, height: innerHeight, scrollWidth: document.documentElement.scrollWidth, canvasWidth: w, canvasHeight: h },
            bones: Array.from(a.figure.body.skeleton.boneMatrices), morphs: Array.from(a.figure.body.morphTargetInfluences),
            expressionStatus: document.querySelector('#expression-status').textContent };
    });
}
async function step(count, delta = 1 / 60) { await page.evaluate(async ({ count, delta }) => {
    for (let i = 0; i < count; i++) await portrait.step(delta);
}, { count, delta }); }
async function ready() {
    await page.waitForFunction(() => window.portrait || !document.querySelector('#error').hidden, null, { timeout: 120000 });
    assert.equal(await page.locator('#error').textContent(), '');
    await page.evaluate(async () => {
        window.roomDocumentId = crypto.randomUUID();
        // Register after the existing production handler; read its actual retirement outcome.
        const a = portrait.avatar, renderer = a.stage.renderer, documentId = roomDocumentId, url = location.href;
        addEventListener('pagehide', event => {
            const entries = JSON.parse(sessionStorage.getItem('portrait-room-retirements') ?? '[]');
            entries.push({ documentId, url, persisted: event.persisted, disposal: a.report().disposal,
                memory: structuredClone(renderer.info.memory) });
            sessionStorage.setItem('portrait-room-retirements', JSON.stringify(entries));
        });
        for (let i = 0; i < 4; i++) { await new Promise(requestAnimationFrame); await portrait.step(0); }
        for (let i = 0; i < 64; i++) await portrait.step(0);
    });
}
function assertFresh(s, room, hair, initial = null) {
    assert.equal(s.backend, 'webgpu'); assert.equal(s.scene.id, room);
    assert.equal(s.scene.lighting.exposure, room === 'studio' ? .85 : 2.04);
    assert.equal(s.hair, hair); assert.equal(s.identity.bake, 'figure_g050');
    assert.equal(s.clock, 0); assert.deepEqual(s.target, zero); assert.deepEqual(s.pad, zero);
    assert.deepEqual(s.selectedExpressions, []); assert.equal(s.attention.phase, 'idle');
    assert.deepEqual(s.selectedRooms, [room]); assert.equal(s.lightHidden, room === 'kitchen');
    const url = new URL(s.url); assert.equal(url.searchParams.get('hair'), hair);
    assert.equal(url.searchParams.get('bake'), 'g050'); assert.equal(url.searchParams.get('capture'), 'rooms');
    assert.ok(s.viewport.scrollWidth <= s.viewport.width, 'horizontal page overflow');
    for (const [edge, gutter] of Object.entries(s.neutralHeadGutters)) assert.ok(gutter >= 15, `${edge} neutral head gutter ${gutter}`);
    if (initial) { assert.deepEqual(s.identity, initial.identity); assert.deepEqual(s.bones, initial.bones); assert.deepEqual(s.morphs, initial.morphs); }
}
async function plate(label, s) {
    await page.evaluate(() => scrollTo(0, 0));
    const canvas = `${rec.name}-${label}-canvas.png`, ui = `${rec.name}-${label}-ui.png`;
    await page.locator('#stage').screenshot({ path: path.join(out, canvas) });
    await page.screenshot({ path: path.join(out, ui), fullPage: true });
    rec.plates.push({ label, state: s, canvas, ui,
        hashes: { [canvas]: sha(fs.readFileSync(path.join(out, canvas))), [ui]: sha(fs.readFileSync(path.join(out, ui))) } }); save();
}
async function sameRoom(room) {
    const before = await state(); await page.locator(`[data-scene="${room}"]`).click();
    await page.evaluate(async () => { await new Promise(requestAnimationFrame); await new Promise(requestAnimationFrame); });
    const after = await state();
    assert.equal(after.documentId, before.documentId); assert.equal(after.clock, before.clock);
    assert.deepEqual(after.target, before.target); assert.deepEqual(after.camera, before.camera);
    rec.sameRoom.push({ room, documentId: after.documentId, clockBefore: before.clock, clockAfter: after.clock });
}
async function navigate(room, key) {
    const before = await state(); await page.locator(`[data-scene="${room}"]`).focus();
    await Promise.all([page.waitForURL(url => url.searchParams.get('scene') === room), page.keyboard.press(key)]);
    await ready(); const after = await state(); assert.notEqual(after.documentId, before.documentId);
    rec.navigation.push({ room, key, beforeDocument: before.documentId, afterDocument: after.documentId }); return after;
}
async function exerciseControls(expression) {
    if ((await state()).paused) await page.locator('#pause').click();
    await page.locator(`[data-expression="${expression}"]`).click(); await step(90);
    const feeling = await state(); assert.ok(Object.values(feeling.pad).some(value => value !== 0));
    await page.locator('#release-expression').focus(); await page.keyboard.press('Enter');
    const released = await state(); assert.deepEqual(released.target, zero); assert.deepEqual(released.pad, feeling.pad);
    await step(30); assert.ok(Math.abs((await state()).pad.arousal) < Math.abs(feeling.pad.arousal));
    await page.locator('#look-toward-me').click(); await step(30); assert.equal((await state()).attention.phase, 'attending');
    await page.locator('#release-attention').click(); assert.equal((await state()).attention.phase, 'releasing');
    await page.locator('#pause').click(); const paused = await state(); assert.equal(paused.paused, true);
    await step(5); assert.equal((await state()).clock, paused.clock); await page.locator('#pause').click();
    const canonical = await state(); await page.locator('#stage').scrollIntoViewIfNeeded();
    const box = await page.locator('#stage').boundingBox();
    await page.mouse.move(box.x + box.width * .5, box.y + box.height * .5); await page.mouse.down();
    await page.mouse.move(box.x + box.width * .65, box.y + box.height * .53, { steps: 8 }); await page.mouse.up();
    await step(8, 0); assert.notDeepEqual((await state()).camera.quaternion, canonical.camera.quaternion);
    await page.locator('#reset-view').click(); await step(2, 0); const reset = await state();
    for (const field of ['position', 'quaternion', 'target']) for (let i = 0; i < canonical.camera[field].length; i++)
        assert.ok(Math.abs(reset.camera[field][i] - canonical.camera[field][i]) < 1e-12, 'orbit reset differs: ' + field);
    assert.equal(reset.scene.lighting.exposure, canonical.scene.lighting.exposure);
    rec.controls = { expression, feeling, released, paused, reset }; save();
}
try {
    server = await startProbeServer({ port: 5362 }); browser = await launchProbeBrowser(); report.browserVersion = browser.version(); save();
    for (const hair of ['bob02', 'bob01']) for (const mobile of [false, true]) {
        rec = { name: `${hair}-${mobile ? 'mobile' : 'desktop'}`, hair, mobile, viewport: mobile ? { width: 390, height: 844 } : { width: 1440, height: 1000 },
            reducedMotion: mobile ? 'reduce' : 'no-preference', plates: [], navigation: [], sameRoom: [] }; report.cases.push(rec); save();
        page = await browser.newPage({ viewport: rec.viewport, deviceScaleFactor: 1, reducedMotion: rec.reducedMotion });
        const name = rec.name;
        page.on('pageerror', error => report.errors.push({ case: name, kind: 'pageerror', message: error.message }));
        page.on('console', message => { if (message.type() === 'error') report.errors.push({ case: name, kind: 'console', message: message.text() }); });
        page.on('requestfailed', request => report.errors.push({ case: name, kind: 'requestfailed', url: request.url(), message: request.failure()?.errorText }));
        page.on('response', response => { if (response.status() >= 400) report.errors.push({ case: name, kind: 'http', status: response.status(), url: response.url() }); });
        await page.goto(`${server.baseUrl}/src/portrait.html?hair=${hair}&bake=g050&capture=rooms&scene=studio`); await ready();
        const studio = await state(); assertFresh(studio, 'studio', hair); assert.equal(studio.paused, mobile); await plate('studio', studio); await sameRoom('studio');
        if (studio.paused) await page.locator('#pause').click();
        await page.locator('[data-expression="joy"]').click(); await step(30); await page.locator('#look-toward-me').click();
        rec.beforeKitchen = await state();
        const kitchen = await navigate('kitchen', mobile ? 'Space' : 'Enter'); assertFresh(kitchen, 'kitchen', hair, studio);
        assert.equal(kitchen.paused, mobile); await plate('kitchen', kitchen); await sameRoom('kitchen');
        if ((hair === 'bob02' && !mobile) || (hair === 'bob01' && mobile)) await exerciseControls(mobile ? 'determined' : 'joy');
        const returned = await navigate('studio', mobile ? 'Enter' : 'Space'); assertFresh(returned, 'studio', hair, studio); rec.returned = returned;
        rec.pagehide = await page.evaluate(() => JSON.parse(sessionStorage.getItem('portrait-room-retirements') ?? '[]'));
        assert.equal(rec.pagehide.length, 2);
        for (const retired of rec.pagehide) if (!retired.persisted) {
            assert.equal(retired.disposal.disposed, true); assert.deepEqual(retired.disposal.leaked, []);
            assert.ok(Object.values(retired.memory).every(value => value === 0));
        }
        rec.finalRetirement = await page.evaluate(() => {
            const { avatar: a, controls, attention } = portrait, renderer = a.stage.renderer;
            attention.dispose(); controls.dispose(); a.dispose();
            return { disposal: a.report().disposal, memory: structuredClone(renderer.info.memory) };
        });
        assert.equal(rec.finalRetirement.disposal.disposed, true); assert.deepEqual(rec.finalRetirement.disposal.leaked, []);
        assert.ok(Object.values(rec.finalRetirement.memory).every(value => value === 0));
        await page.close(); page = null; rec.completed = true; save(); console.log('PASS native room case ' + rec.name);
    }
    page = await browser.newPage();
    await page.goto(server.baseUrl + '/src/portrait.html?capture=rooms&scene=studio&scene=kitchen');
    await page.waitForFunction(() => !document.querySelector('#error').hidden);
    report.invalid = await page.evaluate(() => ({ message: document.querySelector('#error').textContent, avatarCreated: !!window.avatar,
        loadingHidden: document.querySelector('#loading').hidden, status: document.querySelector('#status').textContent }));
    assert.match(report.invalid.message, /Duplicate scene selection/); assert.equal(report.invalid.avatarCreated, false); assert.equal(report.invalid.loadingHidden, true);
    await page.close(); page = null;
    assert.deepEqual(report.errors, []); report.finalSourceHashes = hashes(); assert.deepEqual(report.finalSourceHashes, report.sourceHashes);
    report.checks = ['Four native Studio baselines at exposure0.85, selected identity/hair and fresh neutral state',
        'Keyboard Enter/Space Studio-Kitchen-Studio navigation preserves hair/bake/capture and refreshes pose/expression',
        'Kitchen native exposure2.04, selected Room, hidden Light and no lighting override',
        'Eight same-Room activations preserve document, simulation clock, target and camera',
        'Eight settled neutral views preserve measured head gutters and responsive layout; sixteen canvas/UI PNGs',
        'Two focused post-load mood/neutral/attention/pause/orbit-reset scenarios work',
        'Eight observed pagehide outcomes plus four actual final retirements; bfcache outcomes reported without invented disposal',
        'Duplicate scene URL fails cleanly before Avatar creation; selected source hashes stable and browser errors empty'];
    report.completed = true; save(); console.log('PASS portrait rooms:8 groups,8 paired views,16 PNGs');
} catch (error) {
    report.failure = error.stack; save(); await page?.screenshot({ path: path.join(out, 'failure.png'), fullPage: true }).catch(() => {}); throw error;
} finally { await browser?.close(); await server?.close(); }
