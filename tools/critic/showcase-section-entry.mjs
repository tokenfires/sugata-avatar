// Observe linked entry into the actual customization sections, without editing a look.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { ROOT, collectSourceHashes, hashFile, sha256 } from '../figure-pipeline/collar_replacement_manifest.mjs';
import { launchProbeBrowser } from '../../packages/core/src/render/MotionProbe.mjs';

const out = path.resolve(ROOT, process.argv[2]);
const workspace = path.resolve(process.argv[3] ?? ROOT);
const verify = process.argv[4] === 'verify';
assert.ok(out.startsWith(path.join(ROOT, 'captures') + path.sep));
assert.ok(!fs.existsSync(out));
fs.mkdirSync(out, { recursive: true });
const sources = collectSourceHashes(workspace);
const report = { started: new Date().toISOString(), pid: process.pid, status: 'running', workspace, verify, sources,
    instrumentSHA256: hashFile(new URL(import.meta.url)), states: [], assets: [], errors: [], warnings: [] };
const save = () => fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2) + '\n');
for (const file of ['packages/testbed/src/showcase.html', 'packages/testbed/src/showcase.js',
    'packages/testbed/src/showcase-hair-colours.mjs', 'packages/testbed/src/showcase-colour-controls.mjs']) {
    const target = path.join(out, 'source', file); fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.copyFileSync(path.join(workspace, file), target);
}
fs.copyFileSync(new URL(import.meta.url), path.join(out, 'instrument.mjs'));
save();
let browser, server;
const reads = [];
try {
    let baseUrl = 'http://localhost:5173';
    if (workspace !== ROOT) {
        process.chdir(workspace);
        const probe = await import(pathToFileURL(path.join(workspace, 'packages/core/src/render/MotionProbe.mjs')).href);
        server = await probe.startProbeServer({ port: 5301 });
        baseUrl = server.baseUrl;
    }
    report.baseUrl = baseUrl;
    const baseline = verify ? JSON.parse(fs.readFileSync(path.join(ROOT, 'captures/showcase-section-entry-baseline-2026-09-30-v1/report.json'))) : null;
    if (baseline) report.baselineSHA256 = hashFile(path.join(ROOT, 'captures/showcase-section-entry-baseline-2026-09-30-v1/report.json'));
    browser = await launchProbeBrowser();
    for (const [width, height, label] of [[1440, 1000, 'desktop'], [390, 844, 'mobile']]) {
        for (const fragment of [...['mix-colours', 'hair-colours'], ...(verify && label === 'desktop' ? [''] : [])]) {
            const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1, reducedMotion: 'reduce' });
            const state = { label, width, height, fragment };
            page.on('pageerror', error => report.errors.push(error.message));
            page.on('console', message => {
                if (message.type() === 'error') report.errors.push(message.text());
                if (message.type() === 'warning') report.warnings.push(message.text());
            });
            page.on('response', response => {
                if (response.status() >= 400) report.errors.push(`${response.status()} ${response.url()}`);
                const url = new URL(response.url());
                if (response.ok() && url.pathname.endsWith('.glb') && !url.searchParams.has('import')) {
                    reads.push(response.body().then(bytes => {
                        const index = url.pathname.indexOf('/assets/'); assert.ok(index >= 0);
                        const file = url.pathname.slice(index + 1), digest = sha256(bytes);
                        assert.equal(digest, sources[file]); report.assets.push({ file, sha256: digest });
                    }).catch(error => report.errors.push(error.stack)));
                }
            });
            try {
                const framing = fragment === 'mix-colours' ? 'body' : 'portrait';
                await page.goto(`${baseUrl}/src/showcase.html?frame=${framing}&capture=${fragment ? '#' + fragment : ''}`, { waitUntil: 'domcontentloaded' });
                await page.waitForFunction(() => window.showcase || !document.querySelector('#error').hidden, null, { timeout: 120000 });
                assert.equal(await page.locator('#error').textContent(), '');
                state.clock = await page.evaluate(async () => {
                    const avatar = showcase.avatar, frame = avatar.stage.renderer._nodes.nodeFrame;
                    avatar.stage.renderer._animation.stop();
                    frame.frameId = 0; frame.time = 0; frame.deltaTime = 0; frame.lastTime = undefined;
                    avatar.stage.temporal?.resetFrameEpoch();
                    showcase.controls.enableDamping = false; showcase.controls.update();
                    for (let i = 0; i < 98; i++) { frame.update(); frame.time = 0; frame.deltaTime = 0; await showcase.step(0); }
                    frame.update(); frame.time = 0; frame.deltaTime = 0; avatar.stage.draw();
                    return { frame: frame.frameId, time: frame.time, delta: frame.deltaTime };
                });
                assert.deepEqual(state.clock, { frame: 99, time: 0, delta: 0 });
                state.entry = await page.evaluate(fragment => {
                    const panel = document.getElementById(fragment), rect = panel?.getBoundingClientRect();
                    return { url: location.href, open: panel?.open ?? null,
                        active: { tag: document.activeElement?.tagName, id: document.activeElement?.id,
                            parent: document.activeElement?.parentElement?.id },
                        panels: ['mix-colours', 'hair-colours'].map(id => ({ id, open: document.getElementById(id).open })),
                        scrollY, rect: rect ? { x: rect.x, y: rect.y, width: rect.width, height: rect.height } : null,
                        overflow: document.documentElement.scrollWidth > innerWidth,
                        configuration: showcase.configuration(), backend: showcase.avatar.stage.backendName };
                }, fragment);
                state.fieldsVisible = fragment ? await page.locator(`#${fragment} fieldset`).isVisible() : null;
                assert.equal(state.entry.backend, 'webgpu'); assert.equal(state.entry.overflow, false);
                if (verify && fragment) {
                    assert.equal(state.entry.open, true); assert.equal(state.fieldsVisible, true);
                    assert.equal(state.entry.active.tag, 'SUMMARY'); assert.equal(state.entry.active.parent, fragment);
                    assert.deepEqual(state.entry.configuration, baseline.states.find(s => s.label === label && s.fragment === fragment).entry.configuration);
                    const first = page.locator(fragment === 'mix-colours' ? '[data-colour-part=top] [type=checkbox]' : '#hair-shade');
                    const box = await first.boundingBox(); state.firstField = box;
                    assert.ok(box && box.y >= 0 && box.y + box.height <= height, 'First editable control is within the viewport');
                    await page.keyboard.press('Tab');
                    assert.equal(await first.evaluate(element => document.activeElement === element), true);
                    await page.keyboard.press('Shift+Tab');
                } else if (verify) {
                    assert.ok(state.entry.panels.every(panel => !panel.open));
                    assert.equal(state.entry.active.tag, 'BODY');
                }
                state.file = `${label}-${fragment || 'ordinary'}.png`;
                await page.screenshot({ path: path.join(out, state.file) });
                state.sha256 = hashFile(path.join(out, state.file));
                if (verify && label === 'desktop' && fragment === 'mix-colours') {
                    state.transitions = [];
                    await page.locator('[data-colour-part=top] [type=checkbox]').check();
                    await page.locator('[data-colour-part=top] [type=text]').fill('#123456');
                    const before = await page.evaluate(() => {
                        window.__entryOwner = showcase.avatar;
                        return { configuration: showcase.configuration(), clock: showcase.avatar.clockSeconds,
                            camera: showcase.avatar.stage.camera.matrixWorld.toArray(), frame: showcase.avatar.stage.renderer._nodes.nodeFrame.frameId };
                    });
                    // Manual collapse remains respected until another supported fragment entry.
                    await page.locator('#mix-colours summary').click();
                    assert.equal(await page.locator('#mix-colours').evaluate(e => e.open), false);
                    for (const hash of ['#unknown-editor', '#%E0%A4%A', '#hair-colours', '#mix-colours']) {
                        const observation = await page.evaluate(async hash => {
                            await new Promise(resolve => { addEventListener('hashchange', resolve, { once: true }); location.hash = hash; });
                            return { hash: location.hash, sameOwner: showcase.avatar === window.__entryOwner,
                                configuration: showcase.configuration(), clock: showcase.avatar.clockSeconds,
                                camera: showcase.avatar.stage.camera.matrixWorld.toArray(), frame: showcase.avatar.stage.renderer._nodes.nodeFrame.frameId,
                                draft: document.querySelector('[data-colour-part=top] [type=text]').value,
                                enabled: document.querySelector('[data-colour-part=top] [type=checkbox]').checked,
                                panels: ['mix-colours', 'hair-colours'].map(id => ({ id, open: document.getElementById(id).open })),
                                active: { tag: document.activeElement?.tagName, parent: document.activeElement?.parentElement?.id } };
                        }, hash);
                        assert.equal(observation.hash, hash); assert.equal(observation.sameOwner, true);
                        for (const key of ['configuration', 'clock', 'camera', 'frame']) assert.deepEqual(observation[key], before[key]);
                        assert.equal(observation.draft, '#123456'); assert.equal(observation.enabled, true);
                        if (hash === '#hair-colours' || hash === '#mix-colours') {
                            assert.equal(observation.panels.find(p => p.id === hash.slice(1)).open, true);
                            assert.equal(observation.active.tag, 'SUMMARY'); assert.equal(observation.active.parent, hash.slice(1));
                        } else assert.ok(observation.panels.every(panel => !panel.open));
                        state.transitions.push(observation);
                    }
                    // Native history traversal changes only the requested disclosure/focus too.
                    await page.goBack({ waitUntil: 'domcontentloaded' });
                    await page.waitForFunction(() => location.hash === '#hair-colours' && document.activeElement?.parentElement?.id === 'hair-colours');
                    state.historyBack = await page.evaluate(() => ({ hash: location.hash, sameOwner: showcase.avatar === window.__entryOwner,
                        draft: document.querySelector('[data-colour-part=top] [type=text]').value, configuration: showcase.configuration() }));
                    assert.equal(state.historyBack.sameOwner, true); assert.equal(state.historyBack.draft, '#123456');
                    assert.deepEqual(state.historyBack.configuration, before.configuration);
                }
            } finally {
                try {
                    state.disposal = await page.evaluate(() => {
                        showcase.attention.dispose(); showcase.controls.dispose(); showcase.avatar.dispose();
                        return showcase.avatar.report().disposal;
                    });
                    assert.equal(state.disposal.disposed, true); assert.deepEqual(state.disposal.leaked, []);
                } finally { report.states.push(state); save(); await page.close(); }
            }
        }
    }
    await Promise.all(reads);
    assert.deepEqual(report.errors, []);
    assert.deepEqual(collectSourceHashes(workspace), sources);
    assert.equal(hashFile(new URL(import.meta.url)), report.instrumentSHA256);
    report.status = 'observed';
} catch (error) { report.status = 'failed'; report.errors.push(error.stack); process.exitCode = 1; }
finally { await browser?.close(); await server?.close(); process.chdir(ROOT); report.finished = new Date().toISOString(); save(); }
console.log(JSON.stringify({ status: report.status, reportSHA256: hashFile(path.join(out, 'report.json')) }));
