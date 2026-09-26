// Measure actual scene defaults against the reviewed clothed override, without a scene override.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { startProbeServer, launchProbeBrowser } from '../../../../packages/core/src/render/MotionProbe.mjs';
import { SCENES } from '../../../../packages/core/src/render/Scene.js';
import { decodePng } from '../../../../tools/critic/png.mjs';
const out = path.resolve(process.argv[2] ?? '');
if (!process.argv[2] || fs.existsSync(out)) throw new Error('Provide a new evidence directory.');
const previousPath = 'docs/evidence/nonhair-2026-09-26/scene/clothed-b4ac9f/report.json';
const previous = JSON.parse(fs.readFileSync(previousPath));
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const sources = [...Object.keys(previous.sourceHashes), 'docs/evidence/nonhair-2026-09-26/scene/bind-default.mjs'];
const hashes = () => Object.fromEntries(sources.map(f => [f, sha(fs.readFileSync(f))]));
const before = hashes();
for (const [file, expected] of Object.entries(previous.sourceHashes))
    if (file !== 'packages/core/src/render/Scene.js') assert.equal(before[file], expected, file);
assert.equal(SCENES.kitchen.room.wall, 0xb4ac9f);
fs.mkdirSync(out, { recursive: true });
const report = { date: new Date().toISOString(), sourceHashes: before, previousReportHash: sha(fs.readFileSync(previousPath)),
    cases: [], errors: [], limits: ['Native recipe/state equality and measured pixel differences at four fixed clothed views.',
        'PNG byte equality is reported, not assumed. Non-identical images require independent visual review.',
        'No pixel tolerance gate is defined or relaxed. This does not establish all-motion appearance.'] };
const save = () => fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2) + '\n');
let server, browser;
try {
    server = await startProbeServer({ port: 5298 }); browser = await launchProbeBrowser();
    for (const look of ['casual', 'elegant']) for (const frame of ['portrait', 'body']) {
        const label = `${look}-${frame}`;
        const page = await browser.newPage({ viewport: { width: 900, height: 1200 }, deviceScaleFactor: 1 });
        page.on('console', m => { if (m.type() === 'error') report.errors.push({ label, message: m.text() }); });
        page.on('pageerror', e => report.errors.push({ label, message: e.message }));
        page.on('requestfailed', r => report.errors.push({ label, message: r.url() + ' ' + r.failure()?.errorText }));
        page.on('response', r => { if (r.status() >= 400) report.errors.push({ label, message: r.status() + ' ' + r.url() }); });
        const query = new URLSearchParams({ scene: 'kitchen', look, frame, freeze: '', seed: '1', capture: '' });
        const url = server.baseUrl + '/@fs' + process.cwd() + '/tools/critic/avatar-plate.html?' + query;
        await page.goto(url, { waitUntil: 'domcontentloaded' });
        await page.waitForFunction(() => typeof __SUGATA_STEP__ === 'function' || !document.querySelector('#failure').hidden, null, { timeout: 120000 });
        assert.equal(await page.locator('#failure').textContent(), '');
        await page.evaluate(async () => { for (let i = 0; i < 24; i++) await __SUGATA_STEP__(0); });
        const native = await page.evaluate(() => avatar.report());
        assert.ok(native.hair.history.valid && native.hair.cardFrame.available && native.hair.solver.steps > 0);
        const image = label + '.png'; await page.screenshot({ path: path.join(out, image) });
        const actual = sha(fs.readFileSync(path.join(out, image)));
        const control = previous.cases.find(c => c.label === label + '-wallb4ac9f'), expected = control.sha256;
        for (const field of ['scene', 'motion', 'affect', 'hair', 'identity', 'quality'])
            assert.deepEqual(native[field], control.native.report[field], `${label} ${field}`);
        const camera = await page.evaluate(() => ({ position: avatar.stage.camera.position.toArray(),
            quaternion: avatar.stage.camera.quaternion.toArray(), fov: avatar.stage.camera.fov, aspect: avatar.stage.camera.aspect }));
        assert.deepEqual(camera, control.native.camera, `${label} camera`);
        const a = decodePng(fs.readFileSync(path.join(path.dirname(previousPath), control.image)));
        const b = decodePng(fs.readFileSync(path.join(out, image)));
        assert.equal(a.width, b.width); assert.equal(a.height, b.height);
        let changedPixels = 0, maxCodeDifference = 0, totalCodeDifference = 0;
        for (let i = 0; i < a.pixels.length; i += 4) {
            let changed = false;
            for (let c = 0; c < 3; c++) {
                const delta = Math.round(Math.abs(a.pixels[i + c] - b.pixels[i + c]) * 255);
                changed ||= delta !== 0; maxCodeDifference = Math.max(maxCodeDifference, delta); totalCodeDifference += delta;
            }
            if (changed) changedPixels++;
        }
        report.cases.push({ label, url, image, sha256: actual, expected, identical: actual === expected, native, camera,
            nativeStateEqual: true, difference: { changedPixels, totalPixels: a.width * a.height, maxCodeDifference, totalCodeDifference } }); save();
        await page.close();
    }
    report.hashesStable = JSON.stringify(hashes()) === JSON.stringify(before);
    assert.ok(report.hashesStable); assert.deepEqual(report.errors, []);
    report.allImagesByteIdentical = report.cases.every(c => c.identical);
    report.visualReviewRequired = true;
    report.complete = true; save(); console.log('Captured four default views with native state equality; inspect measured differences and review images.');
} catch (error) { report.error = error.stack; save(); throw error; }
finally { await browser?.close(); await server?.close(); }
