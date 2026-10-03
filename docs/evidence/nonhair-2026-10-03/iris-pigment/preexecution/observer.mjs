/** Sole isolated Original/Blue iris appearance packet; no accepted source/asset mutation. */
import fs from 'node:fs'; import assert from 'node:assert/strict';
import { ROOT, collectSourceHashes, hashFile } from '../figure-pipeline/collar_replacement_manifest.mjs';
import { launchProbeBrowser } from '../../packages/core/src/render/MotionProbe.mjs';
const started = new Date().toISOString(), stop = '2026-10-03T17:19:00Z', observeStop = Date.parse(stop) - 20000;
const packet = 'docs/evidence/nonhair-2026-10-03/iris-pigment', raw = ROOT + '/captures/iris-pigment-2026-10-03-v1';
assert.ok(Date.now() < Date.parse('2026-10-03T17:09:00Z')); assert.ok(!fs.existsSync(raw)); fs.mkdirSync(raw, { recursive: true });
const names = ['PLAN.md', 'candidate.json', 'preview.html', 'preview.mjs', 'PreviewEyeMaterial.mjs', 'COPY-DIFF.patch', 'COPY-RECIPE.json', 'source-check.mjs', 'SOURCE-CHECK.json', 'CRITIC-PREFLIGHT.md'];
const paths = names.map(n => packet + '/' + n).concat(['looks/sage-lavender-chin.json', 'docs/evidence/nonhair-2026-10-03/iris-pigment-design/CRITIC-DESIGN.md', 'docs/evidence/nonhair-2026-10-03/iris-pigment-design/ROOT-DESIGN.md', 'docs/evidence/nonhair-2026-10-03/iris-pigment-design/PRIMARY-REFERENCE.md', 'docs/evidence/nonhair-2026-10-03/iris-pigment-design/epic-iris-example.jpg']);
const inputs = Object.fromEntries(paths.map(p => [p, hashFile(ROOT + '/' + p)]));
const colour = JSON.parse(fs.readFileSync(ROOT + '/' + packet + '/SOURCE-CHECK.json'));
const report = { pid: process.pid, started, stop, command: 'node tools/critic/iris-pigment.mjs', status: 'running', instrumentSHA256: hashFile(new URL(import.meta.url)), sources: collectSourceHashes(ROOT), inputs, images: [], errors: [], warnings: [], failedResources: [], limits: ['One authored Blue; original uses actual unmodified globe, candidate swaps only isolated donor globe.', 'Static public step(0) then draw/frame sync only; no clocks/history/phase/pixel oracle/interception.', 'No default/API/schema/chooser/physical/spectral/moving/AAA qualification.'] };
const save = () => fs.writeFileSync(raw + '/report.json', JSON.stringify(report, null, 2) + '\n');
fs.copyFileSync(new URL(import.meta.url), raw + '/instrument.mjs'); save();
const fixed = s => {
    const { arm, view, camera, ...rest } = s, { activeGlobe, ...eyes } = s.eyes;
    const bindings = s.bindings.map(q => q.mesh === eyes.globeMesh ? { ...q, materials: ['declared-active-globe'] } : q);
    return { ...rest, eyes, bindings };
};
async function bounded(fn, label, cleanup = false) {
    let timer; try { return await Promise.race([fn(), new Promise((_, reject) => { timer = setTimeout(() => reject(Error(label + ' timed out')), cleanup ? 5000 : Math.max(1, observeStop - Date.now())); })]); }
    finally { clearTimeout(timer); }
}
function check(s, arm, view) {
    assert.equal(s.arm, arm); assert.equal(s.view, view); assert.equal(s.backend, 'webgpu'); assert.equal(s.webGPU, true);
    assert.equal(s.camera.fov, 26); assert.deepEqual(s.camera.position, view === 'front' ? [0, 1.55, .88] : [.4235, 1.55, .7665]);
    assert.deepEqual(s.recipe, JSON.parse(fs.readFileSync(ROOT + '/looks/sage-lavender-chin.json'))); assert.deepEqual(s.actualConfiguration, s.recipe);
    const e = s.eyes; assert.equal(e.originalOwnerUnchanged, true); assert.equal(e.donorAttached, false); assert.equal(e.borrowedSourceSame, true); assert.equal(e.borrowedMapSame, true);
    assert.equal(e.actualCornea, e.originalCornea); assert.equal(e.activeGlobe, arm === 'original' ? e.originalGlobe : e.donorGlobe);
    assert.deepEqual(e.originalGeometry, e.donorGeometry); assert.deepEqual(e.originalFrames, e.donorFrames); assert.deepEqual(e.originalUniforms, e.donorUniforms); assert.deepEqual(e.originalOptics, e.donorOptics);
    assert.equal(e.blue, colour.blue); assert.deepEqual(e.chromaticity, colour.chromaticity); assert.deepEqual(e.linear, colour.linear); assert.equal(e.luma, colour.luma);
    assert.deepEqual(e.donorDisposals, []); assert.equal(e.borrowedMapDisposed, 0);
    const binding = s.bindings.filter(q => q.mesh === e.globeMesh); assert.equal(binding.length, 1); assert.deepEqual(binding[0].materials, [e.activeGlobe]);
}
let browser, page, error;
try { await bounded(async () => {
    browser = await launchProbeBrowser(); page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 }); page.setDefaultTimeout(30000);
    page.on('pageerror', e => report.errors.push(e.stack ?? e.message)); page.on('console', m => { if (m.type() === 'error') report.errors.push(m.text()); if (m.type() === 'warning') report.warnings.push(m.text()); });
    page.on('response', r => { if (r.status() >= 400) report.failedResources.push({ url: r.url(), status: r.status() }); }); page.on('requestfailed', r => report.failedResources.push({ url: r.url(), failure: r.failure() }));
    await page.goto('http://127.0.0.1:5173/@fs/' + ROOT.replace(/^\//, '') + '/' + packet + '/preview.html', { waitUntil: 'domcontentloaded', timeout: 120000 });
    await page.waitForFunction(() => window.irisPigment || window.irisPigmentFailure, null, { timeout: 120000 }); assert.equal(await page.locator('#error').textContent(), ''); assert.ok(await page.evaluate(() => !!window.irisPigment)); await page.waitForTimeout(1000);
    let baseline;
    for (const [arm, view] of [['original', 'front'], ['candidate', 'front'], ['candidate', 'oblique'], ['original', 'oblique']]) {
        await page.locator('#' + arm).click(); await page.locator('#' + view).click(); await page.waitForTimeout(350);
        const before = await page.evaluate(() => irisPigment.state()); check(before, arm, view); baseline ??= fixed(before); assert.deepEqual(fixed(before), baseline);
        const file = arm + '-' + view + '.png', requested = new Date().toISOString(); await page.screenshot({ path: raw + '/' + file, fullPage: true });
        const after = await page.evaluate(() => irisPigment.state()); assert.deepEqual(after, before);
        report.images.push({ file, requested, finished: new Date().toISOString(), sha256: hashFile(raw + '/' + file), before, after }); save();
    }
    assert.deepEqual(report.errors, []); assert.deepEqual(report.failedResources, []); report.status = 'observed';
}, 'whole setup and observation'); } catch (e) { error = e; report.errors.push(e.stack ?? String(e)); report.status = 'failed'; }
finally {
    report.cleanup = {};
    try { if (page && !page.isClosed()) report.retirement = await bounded(() => page.evaluate(() => window.irisPigment?.dispose() ?? null), 'owned restore/donor/Avatar disposal', true); }
    catch (e) { report.errors.push(e.message); error ??= e; }
    for (const [name, o] of [['page', page], ['browser', browser]]) try { if (o) await bounded(() => o.close(), name + ' close', true); report.cleanup[name] = o ? 'closed' : 'not-created'; }
    catch (e) { report.errors.push(e.message); report.cleanup[name] = 'failed'; error ??= e; }
    try {
        assert.deepEqual(collectSourceHashes(ROOT), report.sources); for (const [p, h] of Object.entries(inputs)) assert.equal(hashFile(ROOT + '/' + p), h); assert.equal(hashFile(new URL(import.meta.url)), report.instrumentSHA256);
        const r = report.retirement; assert.equal(r?.restored.eyes.activeGlobe, r?.restored.eyes.originalGlobe); assert.equal(r.snapshotError, undefined); assert.deepEqual(r.retirementErrors, []);
        const e = r.restored.eyes; assert.deepEqual(r.donorDisposals, Object.entries(e.donorResources).map(([name, uuid]) => ({ name, uuid }))); assert.equal(r.mapDisposedByDonor, 0);
        assert.equal(r.disposal.disposed, true); assert.deepEqual(r.disposal.leaked, []); assert.deepEqual(report.errors, []); assert.deepEqual(report.failedResources, []); assert.ok(Date.now() < Date.parse(stop)); report.finalPinsUnchanged = true;
    } catch (e) { report.errors.push(e.message); error ??= e; }
    if (error || report.errors.length) report.status = 'failed'; report.finished = new Date().toISOString(); report.borrowedReviewServerRetained = true; save();
    console.log(JSON.stringify({ pid: process.pid, started, finished: report.finished, status: report.status, images: report.images.length, errors: report.errors.length, warnings: report.warnings.length, cleanup: report.cleanup, reportSHA256: hashFile(raw + '/report.json') }));
}
if (error || report.errors.length) throw error ?? Error('Final recorded failure');
