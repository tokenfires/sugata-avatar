// Two real-UI scenarios for Portrait's gradual expression release. Requires the GPU slot.
// node docs/evidence/nonhair-2026-09-26/neutral/probe.mjs <new-output-directory>
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { startProbeServer, launchProbeBrowser } from '../../../../packages/core/src/render/MotionProbe.mjs';

const root = fileURLToPath(new URL('../../../../', import.meta.url));
const out = path.resolve(process.argv[2] ?? '');
if (!process.argv[2] || fs.existsSync(out)) throw new Error('Provide a new evidence directory.');
fs.mkdirSync(out, { recursive: true });
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const sources = ['packages/testbed/src/portrait.js', 'packages/testbed/src/portrait.html',
    'packages/testbed/src/viewer-framing.mjs', 'packages/core/src/Avatar.js',
    'packages/core/src/affect/AffectState.js', 'packages/core/src/affect/ExpressionLayer.js',
    'packages/core/src/motion/AttentionAction.js', 'packages/core/src/render/Scene.js',
    'packages/core/src/render/MotionProbe.mjs', 'assets/figures/figure_g050.glb',
    'assets/hair/bob02/g050.glb', 'docs/evidence/nonhair-2026-09-26/neutral/probe.mjs'];
const hashes = () => Object.fromEntries(sources.map(name => [name, sha(fs.readFileSync(path.join(root, name)))]));
const report = { date: new Date().toISOString(), head: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
    sourceHashes: hashes(), checks: [], cases: [], errors: [],
    limits: ['Two selected native UI scenarios, Warm desktop and Determined mobile with reduced motion.',
        'Expression target release retains the existing emotion and mood clocks. It is not a fresh neutral baseline.',
        'Saved stills and behavior qualify review usability, not determination, emotion recognition, all-motion quality or performance.'] };
const save = () => fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2) + '\n');
const check = name => { report.checks.push(name); console.log('PASS ' + name); save(); };
const zero = { pleasure: 0, arousal: 0, dominance: 0 };
let server, browser, page, scenario;

async function snapshot() {
    return page.evaluate(() => {
        const { avatar, attention, controls, framing } = window.portrait;
        const affect = avatar.affectState;
        return { clock: avatar.clockSeconds, backend: avatar.stage.backendName,
            target: { ...affect.target }, pad: affect.pad, emotion: { ...affect.emotion }, mood: { ...affect.mood },
            face: avatar.expression.faceResult, attention: attention.report(),
            camera: { position: avatar.stage.camera.position.toArray(), quaternion: avatar.stage.camera.quaternion.toArray(),
                target: controls.target.toArray(), zoom: avatar.stage.camera.zoom, aspect: avatar.stage.camera.aspect },
            framing: framing.report(), lighting: avatar.lighting.look,
            selected: [...document.querySelectorAll('[data-expression][aria-pressed="true"]')].map(button => button.dataset.expression),
            paused: document.querySelector('#pause').getAttribute('aria-pressed') === 'true',
            releaseDisabled: document.querySelector('#release-expression').disabled,
            expressionStatus: document.querySelector('#expression-status').textContent,
            attentionStatus: document.querySelector('#attention-status').textContent,
            focused: document.activeElement?.id || document.activeElement?.dataset.expression || null };
    });
}
async function step(count, delta = 1 / 60) {
    await page.evaluate(async ({ count, delta }) => {
        for (let i = 0; i < count; i++) await portrait.step(delta);
    }, { count, delta });
}
async function plate(label) {
    const name = scenario.name + '-' + label;
    const canvas = name + '-canvas.png', ui = name + '-ui.png';
    await page.locator('#stage').screenshot({ path: path.join(out, canvas) });
    await page.screenshot({ path: path.join(out, ui), fullPage: true });
    const state = await snapshot();
    const result = { label, state, canvas, ui, sha256: { [canvas]: sha(fs.readFileSync(path.join(out, canvas))), [ui]: sha(fs.readFileSync(path.join(out, ui))) } };
    scenario.samples.push(result); save();
    return state;
}
async function openCase(name, viewport, reducedMotion) {
    scenario = { name, viewport, reducedMotion, samples: [] }; report.cases.push(scenario);
    page = await browser.newPage({ viewport, deviceScaleFactor: 1, reducedMotion });
    page.on('pageerror', error => report.errors.push({ case: name, error: error.message }));
    page.on('console', message => { if (message.type() === 'error') report.errors.push({ case: name, error: message.text() }); });
    page.on('requestfailed', request => report.errors.push({ case: name, error: request.url() + ' ' + request.failure()?.errorText }));
    page.on('response', response => { if (response.status() >= 400) report.errors.push({ case: name, error: response.status() + ' ' + response.url() }); });
    await page.goto(server.baseUrl + '/src/portrait.html?capture');
    await page.waitForFunction(() => window.portrait || !document.querySelector('#error').hidden, null, { timeout: 120000 });
    assert.equal(await page.locator('#error').textContent(), '');
    await page.evaluate(async () => {
        // Let the real renderer aspect and responsive fit settle without advancing motion.
        for (let i = 0; i < 12; i++) { await new Promise(requestAnimationFrame); await portrait.step(0); }
    });
    const initial = await snapshot();
    assert.equal(initial.backend, 'webgpu');
    assert.deepEqual(initial.target, zero); assert.deepEqual(initial.selected, []);
    assert.equal(initial.paused, reducedMotion === 'reduce');
    scenario.initial = initial; save();
}
async function closeCase() {
    scenario.disposal = await page.evaluate(() => {
        const { avatar, controls, attention } = portrait;
        attention.dispose(); controls.dispose(); avatar.dispose();
        return avatar.report().disposal;
    });
    assert.equal(scenario.disposal.disposed, true);
    assert.deepEqual(scenario.disposal.leaked, []);
    await page.close(); page = null; save();
}
function assertOnlyTargetRelease(before, after) {
    assert.deepEqual(after.target, zero); assert.deepEqual(after.selected, []);
    for (const key of ['pad', 'emotion', 'mood', 'camera', 'framing', 'lighting', 'clock', 'paused', 'attention'])
        assert.deepEqual(after[key], before[key], `${key} changed before a motion step`);
}
function assertDecay(before, after, axes) {
    for (const axis of axes) {
        assert.ok(Math.abs(after.pad[axis]) < Math.abs(before.pad[axis]), `${axis} did not release`);
        assert.ok(Math.abs(after.pad[axis]) > 0, `${axis} was reset instead of gradually released`);
    }
}

try {
    server = await startProbeServer({ port: 5299 }); browser = await launchProbeBrowser();
    await openCase('desktop-warm', { width: 1440, height: 1000 }, 'no-preference');
    await page.locator('[data-expression="joy"]').click();
    assert.deepEqual((await snapshot()).target, { pleasure: .7, arousal: .25, dominance: .35 });
    await step(150);
    await page.locator('#look-toward-me').click(); await step(54);
    await page.evaluate(() => { window.neutralHold = portrait.attention.gazeHold; });
    const warm = await plate('warm-attending');
    assert.equal(warm.attention.phase, 'attending');
    await page.locator('[data-expression="determined"]').focus();
    await page.keyboard.press('Tab');
    assert.equal((await snapshot()).focused, 'release-expression');
    await page.keyboard.press('Enter');
    const released = await snapshot();
    assertOnlyTargetRelease(warm, released);
    assert.equal(await page.evaluate(() => portrait.attention.gazeHold === neutralHold), true);
    check('desktop: keyboard Enter releases only the expression target, preserving current PAD, camera, lighting and owned attention');
    await step(30); const half = await plate('release-0.5s');
    assertDecay(warm, half, ['pleasure', 'arousal', 'dominance']); assert.equal(half.attention.phase, 'attending');
    await step(120); const later = await plate('release-2.5s');
    assertDecay(half, later, ['pleasure', 'arousal', 'dominance']);
    assert.deepEqual(later.camera, warm.camera); assert.equal(later.lighting, warm.lighting);
    check('desktop: Warm visibly sampled over its existing gradual release; viewer settings survive');
    await closeCase();

    await openCase('mobile-determined', { width: 390, height: 844 }, 'reduce');
    await page.locator('[data-expression="curious"]').focus(); await page.keyboard.press('Tab');
    assert.equal((await snapshot()).focused, 'determined');
    await page.keyboard.press('Space');
    const chosen = await snapshot();
    assert.deepEqual(chosen.target, { pleasure: 0, arousal: .4, dominance: .85 });
    assert.deepEqual(chosen.pad, scenario.initial.pad); assert.equal(chosen.paused, true);
    await page.locator('#pause').click(); await step(150); await page.locator('#pause').click();
    const determined = await plate('determined-paused');
    assert.equal(determined.paused, true);
    await page.locator('[data-expression="determined"]').focus(); await page.keyboard.press('Tab');
    assert.equal((await snapshot()).focused, 'release-expression');
    await page.keyboard.press('Space');
    const queued = await snapshot(); assertOnlyTargetRelease(determined, queued);
    assert.match(queued.expressionStatus, /resume/i);
    await step(3, .5); const still = await plate('release-still-paused');
    for (const key of ['pad', 'emotion', 'mood', 'clock', 'camera']) assert.deepEqual(still[key], queued[key]);
    assert.equal(still.paused, true);
    check('mobile: keyboard Space queues neutral while paused; attempted manual steps preserve affect and motion time');
    const layout = await page.evaluate(() => {
        const button = document.querySelector('#release-expression'), rect = button.getBoundingClientRect();
        return { width: innerWidth, scrollWidth: document.documentElement.scrollWidth,
            button: { left: rect.left, right: rect.right, width: rect.width, height: rect.height },
            note: document.querySelector('#expression-status').textContent };
    });
    assert.ok(layout.scrollWidth <= layout.width); assert.ok(layout.button.left >= 0 && layout.button.right <= layout.width);
    assert.ok(layout.button.height >= 44 && layout.button.width >= 44); scenario.layout = layout;
    await page.locator('#pause').click(); await step(150); const resumed = await plate('release-resumed-2.5s');
    assertDecay(determined, resumed, ['arousal', 'dominance']); assert.equal(resumed.paused, false);
    assert.deepEqual(resumed.camera, determined.camera); assert.equal(resumed.lighting, determined.lighting);
    assert.doesNotMatch(resumed.expressionStatus, /resume/i);
    check('mobile: explicit resume advances gradual release; 390px controls fit with native touch-sized targets');
    await closeCase();
    assert.deepEqual(report.errors, []); report.hashesStable = JSON.stringify(hashes()) === JSON.stringify(report.sourceHashes);
    assert.equal(report.hashesStable, true); check('two native Avatar retirements are clean; selected sources stable and browser errors empty');
    report.complete = true; save(); console.log('PASS neutral release: ' + out);
} catch (error) {
    report.error = error.stack; save();
    await page?.screenshot({ path: path.join(out, 'failure.png'), fullPage: true }).catch(() => {});
    throw error;
} finally { await browser?.close(); await server?.close(); }
