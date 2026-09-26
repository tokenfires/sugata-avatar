/** Native WebGPU framing + interaction acceptance. No substitute assets or renderer changes.
 * node packages/testbed/src/viewer-framing.gpu.selftest.mjs --out=/tmp/viewer-framing
 * Numeric bounds cover the neutral skin head and head-region authored cards, not lower tails or all animated poses.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { startProbeServer, launchProbeBrowser } from '../../core/src/render/MotionProbe.mjs';
const root = fileURLToPath(new URL('../../../', import.meta.url));
const out = process.argv.find(arg => arg.startsWith('--out='))?.slice(6) ?? fs.mkdtempSync(path.join(os.tmpdir(), 'sugata-framing-'));
fs.mkdirSync(out, { recursive: true });
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const sources = ['packages/testbed/src/showcase.js', 'packages/testbed/src/showcase.html', 'packages/testbed/src/portrait.js', 'packages/testbed/src/portrait.html',
    'packages/testbed/src/viewer-framing.mjs', 'packages/testbed/src/viewer-framing.gpu.selftest.mjs', 'packages/core/src/Avatar.js', 'packages/core/src/render/Stage.js',
    'assets/hair/bob01/g050.glb', 'assets/hair/bob02/g050.glb'];
const hashes = () => Object.fromEntries(sources.map(name => [name, sha(fs.readFileSync(root + name))]));
const baselinePath = root + 'docs/evidence/nonhair-2026-09-26/framing/baseline/report.json';
const baseline = fs.existsSync(baselinePath) ? JSON.parse(fs.readFileSync(baselinePath)) : null;
const report = { date: new Date().toISOString(), sourceHashes: hashes(), baselineReportSha256: baseline ? sha(fs.readFileSync(baselinePath)) : null, checks: [], views: [], errors: [],
    limits: ['Fits neutral head skin and authored cards at or above the skin head lower extent, including crossing edges. Lower long-bob tails are excluded. Alpha-transparent card borders are conservative; dynamic hair excursions are not qualified.',
        'User orbit and dolly remain free to crop the figure deliberately. No geometry, fit, hair-quality, all-motion or performance acceptance.'] };
const save = () => fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2) + '\n');
const check = (name, fn = () => {}) => { fn(); report.checks.push(name); console.log('PASS ' + name); save(); };
const close = (actual, expected, tolerance = 1e-10) => assert.ok(Math.abs(actual - expected) < tolerance, `${actual} != ${expected}`);
const sameVector = (actual, expected) => actual.forEach((value, index) => close(value, expected[index]));
let server, browser, page;
async function ready() {
    await page.waitForFunction(() => window.portrait || window.showcase || !document.querySelector('#error').hidden, null, { timeout: 120000 });
    assert.equal(await page.locator('#error').textContent(), '');
    await page.evaluate(async () => {
        const viewer = window.portrait ?? window.showcase, zooms = [];
        for (let i = 0; i < 12; i++) { await new Promise(requestAnimationFrame); await viewer.step(0); if (i >= 8) zooms.push(viewer.avatar.stage.camera.zoom); }
        if (Math.max(...zooms) - Math.min(...zooms) > 1e-12) throw new Error('Responsive projection did not stabilize after the renderer aspect settled.');
    });
}
async function measure() {
    return page.evaluate(() => {
        const viewer = window.portrait ?? window.showcase, { avatar, controls, framing } = viewer;
        const camera = avatar.stage.camera, canvas = document.querySelector('#stage');
        const bounds = { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity };
        for (const value of framing.points) {
            const point = value.clone().project(camera);
            bounds.minX = Math.min(bounds.minX, point.x); bounds.maxX = Math.max(bounds.maxX, point.x);
            bounds.minY = Math.min(bounds.minY, point.y); bounds.maxY = Math.max(bounds.maxY, point.y);
        }
        // Independently reread the current skinned body after rendering; a cached fit proxy
        // alone cannot prove that the actual settled head occupies those bounds.
        const body = avatar.figure.body, headIndex = body.skeleton.bones.indexOf(avatar.figure.humanoidBones.head);
        const indices = body.geometry.getAttribute('skinIndex'), weights = body.geometry.getAttribute('skinWeight');
        const skinBounds = { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity, count: 0 }, point = camera.position.clone();
        for (let i = 0; i < body.geometry.attributes.position.count; i++) {
            let weight = 0; for (let j = 0; j < 4; j++) if (indices.getComponent(i, j) === headIndex) weight += weights.getComponent(i, j);
            if (weight < .5) continue;
            body.getVertexPosition(i, point).applyMatrix4(body.matrixWorld).project(camera); skinBounds.count++;
            skinBounds.minX = Math.min(skinBounds.minX, point.x); skinBounds.maxX = Math.max(skinBounds.maxX, point.x);
            skinBounds.minY = Math.min(skinBounds.minY, point.y); skinBounds.maxY = Math.max(skinBounds.maxY, point.y);
        }
        return { position: camera.position.toArray(), target: controls.target.toArray(), quaternion: camera.quaternion.toArray(),
            distance: camera.position.distanceTo(controls.target), minDistance: controls.minDistance, maxDistance: controls.maxDistance,
            fov: camera.fov, aspect: camera.aspect, canvas: [canvas.clientWidth, canvas.clientHeight], backing: [canvas.width, canvas.height],
            framing: framing.report(), bounds, skinBounds, attention: viewer.attention.report(), clock: avatar.clockSeconds,
            identity: avatar.report().identity, hair: avatar.report().hair.loadedStyle };
    });
}
async function screenshot(name) {
    const file = name + '.png'; await page.screenshot({ path: path.join(out, file), fullPage: true });
    return { file, sha256: sha(fs.readFileSync(path.join(out, file))) };
}
async function checkInteractions(kind) {
    await page.setViewportSize({ width: 390, height: 844 }); await ready();
    const initial = await measure();
    await page.locator('#look-with-smile').click();
    await page.evaluate(async () => { const viewer = window.portrait ?? window.showcase; await viewer.step(.6); window.framingHold = viewer.attention.gazeHold; });
    const attentionBefore = await measure(); assert.equal(attentionBefore.attention.phase, 'attending');
    for (let i = 0; i < 2; i++) {
        await page.setViewportSize({ width: 1440, height: 1000 }); await ready();
        const desktop = await measure(); assert.equal(desktop.framing.zoom, 1);
        sameVector(desktop.position, attentionBefore.position); sameVector(desktop.target, attentionBefore.target);
        await page.setViewportSize({ width: 390, height: 844 }); await ready();
        const mobile = await measure(); close(mobile.framing.zoom, initial.framing.zoom);
        sameVector(mobile.position, attentionBefore.position); sameVector(mobile.target, attentionBefore.target);
        assert.equal(mobile.clock, attentionBefore.clock); assert.equal(mobile.attention.phase, 'attending');
        assert.deepEqual(mobile.attention.target, attentionBefore.attention.target);
        assert.equal(mobile.attention.time, attentionBefore.attention.time); assert.equal(mobile.attention.smileWeight, attentionBefore.attention.smileWeight);
        assert.equal(await page.evaluate(() => (window.portrait ?? window.showcase).attention.gazeHold === framingHold), true);
    }
    check(`${kind}: repeated mobile/desktop resize preserves exact camera/target/clock and active sampled attention hold`);
    await page.locator('#stage').scrollIntoViewIfNeeded(); const box = await page.locator('#stage').boundingBox();
    const x = box.x + box.width * .5, y = box.y + box.height * .45;
    await page.mouse.move(x, y); await page.mouse.down(); await page.mouse.move(x + 45, y + 15, { steps: 5 }); await page.mouse.up();
    const dragged = await measure(); assert.ok(Math.abs(dragged.position[0] - initial.position[0]) > .01);
    assert.notEqual(dragged.attention.phase, 'attending');
    if (kind === 'portrait') await page.locator('#reset-view').click(); else await page.locator('[data-frame="portrait"]').click();
    await ready(); const reset = await measure(); sameVector(reset.position, initial.position); sameVector(reset.target, initial.target);
    close(reset.framing.zoom, initial.framing.zoom); const stable = await measure(); await ready(); sameVector((await measure()).position, stable.position);
    check(`${kind}: real drag responds, releases attention and explicit reset clears residual damping at the current responsive projection`);
    await page.locator('#stage').scrollIntoViewIfNeeded(); const wheelBox = await page.locator('#stage').boundingBox();
    await page.mouse.move(wheelBox.x + wheelBox.width * .5, wheelBox.y + wheelBox.height * .45); await page.mouse.wheel(0, -180); await ready();
    const dolly = await measure(); assert.ok(dolly.distance < reset.distance); assert.ok(dolly.distance >= reset.minDistance);
    await page.setViewportSize({ width: 1440, height: 1000 }); await ready(); const wideDolly = await measure(); close(wideDolly.distance, dolly.distance);
    await page.setViewportSize({ width: 390, height: 844 }); await ready(); const narrowDolly = await measure(); close(narrowDolly.distance, dolly.distance);
    close(narrowDolly.minDistance, dolly.minDistance); close(narrowDolly.maxDistance, dolly.maxDistance);
    check(`${kind}: native wheel dolly remains effective and relative user distance/limits survive resize roundtrip`);
    if (kind !== 'portrait') {
        await page.locator('[data-frame="body"]').click(); await ready(); const body = await measure(); assert.equal(body.framing.zoom, 1);
        await page.locator('[data-frame="portrait"]').click(); await ready(); const portrait = await measure(); close(portrait.framing.zoom, initial.framing.zoom);
        sameVector(portrait.position, initial.position); sameVector(portrait.target, initial.target);
        await page.evaluate(() => showcase.controls.rotateLeft(.35)); await page.locator('[data-angle="90"]').click(); await ready();
        const side = await measure(); close(side.position[2], side.target[2]); assert.ok(side.position[0] > side.target[0]);
        check('showcase: body/portrait transitions restore their separate projections and Side is exact even after damped orbit');
    }
    report.interactions ??= []; report.interactions.push({ kind, initial, reset, dolly, attentionBefore }); save();
}
try {
    server = await startProbeServer({ port: 5297 }); browser = await launchProbeBrowser();
    for (const hair of ['bob02', 'bob01']) for (const device of ['desktop', 'mobile']) for (const kind of ['portrait', 'showcase-portrait', ...(hair === 'bob02' ? ['showcase-body'] : [])]) {
        page = await browser.newPage({ viewport: device === 'desktop' ? { width: 1440, height: 1000 } : { width: 390, height: 844 }, deviceScaleFactor: 1, reducedMotion: 'no-preference' });
        page.on('pageerror', error => report.errors.push(error.message)); page.on('console', message => { if (message.type() === 'error') report.errors.push(message.text()); });
        page.on('requestfailed', request => report.errors.push(request.url() + ' ' + request.failure()?.errorText));
        const url = kind === 'portrait' ? `/src/portrait.html?hair=${hair}&capture=` : `/src/showcase.html?preset=${hair === 'bob02' ? 'casual' : 'elegant'}&frame=${kind.endsWith('body') ? 'body' : 'portrait'}&capture=`;
        await page.goto(server.baseUrl + url); await ready(); const measured = await measure();
        report.current = { kind, device, hair, ...measured }; save();
        close(measured.aspect, measured.canvas[0] / measured.canvas[1], .002); assert.equal(measured.hair, hair);
        if (device === 'desktop' || kind.endsWith('body')) assert.equal(measured.framing.zoom, 1, 'Keep accepted desktop/body projection');
        if (!kind.endsWith('body')) {
            const marginX = 1 - 32 / measured.canvas[0], marginY = 1 - 32 / measured.canvas[1];
            assert.ok(measured.bounds.minX >= -marginX - 1e-10 && measured.bounds.maxX <= marginX + 1e-10, 'Head and head-region authored cards need horizontal gutters');
            assert.ok(measured.bounds.minY >= -marginY - 1e-10 && measured.bounds.maxY <= marginY + 1e-10, 'Head and head-region authored cards need vertical gutters');
            assert.ok(measured.skinBounds.count > 0);
            assert.ok(measured.skinBounds.minX >= -marginX - 1e-10 && measured.skinBounds.maxX <= marginX + 1e-10, 'Actual settled skin head needs horizontal gutters');
            assert.ok(measured.skinBounds.minY >= -marginY - 1e-10 && measured.skinBounds.maxY <= marginY + 1e-10, 'Actual settled skin head needs vertical gutters');
        }
        const old = hair === 'bob02' && baseline?.views.find(view => view.device === device && view.kind === kind);
        if (old) { sameVector(measured.position, old.position); sameVector(measured.target, old.target); close(measured.distance, old.distance); close(measured.minDistance, old.orbit.min); close(measured.maxDistance, old.orbit.max); }
        report.views.push({ kind, device, hair, ...await screenshot(`${kind}-${hair}-${device}`), ...measured });
        check(`${kind} ${hair} ${device}: real default bounds fit, camera/aspect are valid and desktop/body composition is retained`);
        if (hair === 'bob02' && device === 'mobile' && !kind.endsWith('body')) await checkInteractions(kind);
        await page.close(); page = null;
    }
    assert.deepEqual(report.errors, []); assert.deepEqual(hashes(), report.sourceHashes);
    check('source/asset hashes stayed stable; browser console, page and network errors are empty'); report.passed = true; save();
    console.log(`PASS ${report.checks.length} viewer framing browser groups; ${out}`);
} catch (error) { report.error = error.stack; save(); await page?.screenshot({ path: path.join(out, 'failure.png'), fullPage: true }).catch(() => {}); throw error; }
finally { await browser?.close(); await server?.close(); }
