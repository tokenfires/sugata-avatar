// Serial six-arm native study. A fresh --out is required; existing evidence is never overwritten.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { startProbeServer, launchProbeBrowser } from '../../../../packages/core/src/render/MotionProbe.mjs';
import { decodePng } from '../../../../tools/critic/png.mjs';

const root = fileURLToPath(new URL('../../../../', import.meta.url));
const arg = key => process.argv.find(v => v.startsWith(`--${key}=`))?.slice(key.length + 3);
const out = arg('out') && path.resolve(arg('out')), smoke = process.argv.includes('--smoke');
assert.ok(out && !fs.existsSync(out), 'Fresh --out required'); fs.mkdirSync(out, { recursive: true });
const sha = b => createHash('sha256').update(b).digest('hex');
const walk = d => fs.readdirSync(d, { withFileTypes: true }).flatMap(e => {
    const p = path.join(d, e.name); return e.isDirectory() ? walk(p) : [path.relative(root, p)];
});
const selected = [...new Set([
    ...walk(path.join(root, 'packages/core/src')), ...walk(path.join(root, 'assets')),
    ...['portrait.js', 'portrait.html', 'portrait-selection.mjs', 'viewer-scenes.mjs', 'viewer-framing.mjs'].map(n => 'packages/testbed/src/' + n),
    ...['native-capture.mjs', 'capture-runtime.mjs', 'ExpressionStudyArm.mjs'].map(n => 'docs/evidence/nonhair-2026-09-26/expression-next/' + n),
    'tools/figure-pipeline/collar_capture_browser.mjs', 'tools/critic/png.mjs', 'package.json', 'package-lock.json', 'vite.config.js',
    'node_modules/three/package.json', 'node_modules/three/examples/jsm/controls/OrbitControls.js'
])].sort();
const hashes = () => Object.fromEntries(selected.map(p => [p, sha(fs.readFileSync(root + p))]));
const report = { startedAt: new Date().toISOString(), smoke, sources: hashes(), cases: [], errors: [], checks: [], completed: false,
    scope: 'Native g050/bob02 fixed Studio Portrait. 60Hz simulation, 15Hz images plus named endpoints. Experimental owners only; no production behavior or hair/asset changes. Synthetic speech timing; no audio or perception certification.' };
// Keep exact local instruments/runtime sources even if the working study later changes.
// Asset bytes stay in their accepted tracked locations and remain SHA-bound in this report.
for (const p of selected.filter(p => !p.startsWith('assets/'))) {
    const dest = path.join(out, 'source', p); fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(root + p, dest);
}
const save = () => fs.writeFileSync(out + '/report.json', JSON.stringify(report, null, 2) + '\n');
let browser, server, page, rec;
async function open() {
    page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1, reducedMotion: 'no-preference' });
    const name = rec.name;
    page.on('pageerror', e => report.errors.push({ case: name, kind: 'pageerror', message: e.message }));
    page.on('console', m => { if (m.type() === 'error') report.errors.push({ case: name, kind: 'console', message: m.text() }); });
    page.on('requestfailed', r => report.errors.push({ case: name, kind: 'network', url: r.url(), error: r.failure()?.errorText }));
    page.on('response', r => { if (r.status() >= 400) report.errors.push({ case: name, kind: 'http', status: r.status(), url: r.url() }); });
    await page.goto(server.baseUrl + '/src/portrait.html?capture=expression-study&bake=g050&hair=bob02&scene=studio');
    await page.waitForFunction(() => window.portrait || !document.querySelector('#error').hidden, null, { timeout: 120000 });
    assert.equal(await page.locator('#error').textContent(), '');
    await page.evaluate(async () => { window.studyCapture = await import('/@fs' + '/Users/robault/GitHub/sugata-avatar/docs/evidence/nonhair-2026-09-26/expression-next/capture-runtime.mjs'); });
    rec.setup = await page.evaluate(() => studyCapture.setup());
    rec.canvas = await page.evaluate(() => { const c = document.querySelector('#stage'); return { width: c.width, height: c.height }; }); save();
}
async function imageAt(step, state) {
    const file = `${rec.name}/frame-${String(step).padStart(4, '0')}.png`;
    const bytes = Buffer.from(await page.evaluate(() => studyCapture.png())); fs.writeFileSync(out + '/' + file, bytes);
    const png = decodePng(bytes);
    assert.equal(png.width, rec.canvas.width); assert.equal(png.height, rec.canvas.height);
    let low = 1, high = 0;
    for (let i = 0; i < png.pixels.length; i += 4) { low = Math.min(low, png.pixels[i]); high = Math.max(high, png.pixels[i]); }
    assert.ok(high - low > .1, 'Empty/uniform native capture');
    rec.samples.push({ step, actionTime: step / 60, file, sha256: sha(bytes), width: png.width, height: png.height, state }); save();
}
function equalUnaffected(a, c, label) {
    for (const name of ['time', 'frame', 'renderFrame', 'pad', 'target', 'expression', 'ovr', 'ovrMesh', 'speaking', 'visemeSampleClock', 'gaze', 'bones', 'camera'])
        assert.deepEqual(c[name], a[name], `${label}: ${name}`);
    for (const name of ['hairPositions', 'hairVelocities', 'head', 'clock', 'steps', 'projection', 'view', 'camera'])
        assert.deepEqual(c.physical[name], a.physical[name], `${label}: physical.${name}`);
    assert.equal(c.physical.cards.length, a.physical.cards.length);
    a.physical.cards.forEach((card, i) => {
        assert.equal(c.physical.cards[i].name, card.name);
        assert.equal(c.physical.cards[i].boneMatrices, card.boneMatrices, `${label}: card bones`);
    });
    // All non-eyeWide mesh weights are checked below, including card meshes. Vertex hashes
    // are retained but not assumed identical: authored eyeWide targets can move several meshes.
    const eyes = new Set(['eyeWideLeft', 'eyeWideRight']);
    for (const [name, channel] of Object.entries(a.channels)) if (!eyes.has(name))
        assert.deepEqual(c.channels[name], channel, `${label}: channel ${name}`);
    assert.equal(c.meshes.length, a.meshes.length);
    a.meshes.forEach((mesh, i) => { assert.equal(c.meshes[i].name, mesh.name);
        for (const [name, value] of Object.entries(mesh.morphs)) if (!eyes.has(name))
            assert.equal(c.meshes[i].morphs[name], value, `${label}: mesh ${i}/${name}`);
    });
    for (const name of eyes) {
        const actual = c.channels[name], original = a.channels[name];
        assert.deepEqual(actual.writers.filter(w => w.owner !== 'expressionStudyEyeWide'), original.writers, `${label}: preserved other eye writers`);
        const expected = Math.min(1, Math.max(0, actual.writers.reduce((sum, w) => sum + w.value, 0)));
        assert.equal(actual.committed, expected, `${label}: native clamp`);
        const instrument = c.owner.channels[name];
        assert.equal(instrument.actualAdmitted, instrument.expectedAdmitted, `${label}: actual admitted correction`);
    }
}
try {
    server = await startProbeServer({ port: 5384 }); browser = await launchProbeBrowser(); report.browser = browser.version(); save();
    for (const speech of (smoke ? [false] : [false, true])) for (const arm of (smoke ? ['A'] : ['A', 'B', 'C'])) {
        rec = { name: `${speech ? 'speech' : 'quiet'}-${arm}`, arm, speech, samples: [] }; report.cases.push(rec);
        fs.mkdirSync(out + '/' + rec.name); await open();
        await page.locator('[data-expression="determined"]').click();
        await page.evaluate(() => studyCapture.step(150));
        rec.beforeStart = await page.evaluate(() => studyCapture.snapshot());
        rec.action = await page.evaluate(({ arm, speech }) => studyCapture.start(arm, speech), { arm, speech });
        const samples = new Set([0, 15, 51, 156, 204, 270]);
        for (let s = 0; s <= 270; s += 4) samples.add(s);
        // Avatar samples the viseme clock BEFORE incrementing clockSeconds in advanceFrame.
        // Thus key-time quantization needs one additional step; retain both clocks in state.
        if (speech) for (const k of rec.action.speech.keys) for (const field of ['onset', 'peak', 'releaseStart', 'end'])
            samples.add(Math.max(0, 1 + Math.ceil((k[field] - rec.action.speech.leadSeconds) * 60 - 1e-10)));
        rec.sampleSteps = [...samples].filter(s => s <= 270).sort((a, b) => a - b);
        let previous = 0;
        for (const s of rec.sampleSteps) {
            if (s > previous) await page.evaluate(n => studyCapture.step(n), s - previous);
            const state = await page.evaluate(() => studyCapture.snapshot());
            assert.ok(Math.abs(state.time - rec.beforeStart.time - s / 60) < 1e-12);
            await imageAt(s, state); previous = s;
        }
        if (speech) {
            for (const k of rec.action.speech.keys) {
                const s = 1 + Math.ceil((k.peak - rec.action.speech.leadSeconds) * 60 - 1e-10);
                const peak = rec.samples.find(p => p.step === s).state;
                assert.ok(Math.abs(peak.time - peak.visemeSampleClock - 1 / 60) < 1e-12);
                assert.equal(peak.speaking, true); assert.ok(peak.ovr[k.viseme] > .5, `${k.viseme} actual committed peak`);
            }
        }
        rec.retirement = await page.evaluate(() => studyCapture.finish());
        assert.equal(rec.retirement.noStudyLayers, true); assert.equal(rec.retirement.disposal.disposed, true);
        assert.deepEqual(rec.retirement.disposal.leaked, []); assert.ok(Object.values(rec.retirement.memory).every(v => v === 0));
        rec.completed = true; save(); await page.close(); page = null; console.log('PASS ' + rec.name);
    }
    if (!smoke) for (const speech of [false, true]) {
        const a = report.cases.find(c => c.speech === speech && c.arm === 'A'), c = report.cases.find(c => c.speech === speech && c.arm === 'C');
        assert.deepEqual(c.beforeStart, a.beforeStart, 'Fresh arm state before intervention');
        assert.equal(a.samples.length, c.samples.length);
        a.samples.forEach((p, i) => { assert.equal(p.step, c.samples[i].step); if (p.step > 0) equalUnaffected(p.state, c.samples[i].state, `${speech}/${p.step}`); });
        const b = report.cases.find(c => c.speech === speech && c.arm === 'B');
        b.samples.forEach((p, i) => assert.deepEqual(p.state.ovr, a.samples[i].state.ovr, 'B preserves native OVR speech'));
        report.checks.push(`${speech ? 'speech' : 'quiet'} A/C matched unaffected states and committed channels; B preserves all OVR values`);
    }
    assert.deepEqual(report.errors, []); report.finalSources = hashes(); assert.deepEqual(report.finalSources, report.sources);
    report.completed = true; report.finishedAt = new Date().toISOString(); save();
} catch (e) { report.failure = e.stack; save(); throw e; }
finally { await browser?.close(); await server?.close(); }
