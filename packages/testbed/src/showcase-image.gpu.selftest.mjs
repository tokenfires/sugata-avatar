/** Actual WebGPU PNG export: no routed assets or core changes.
 * node packages/testbed/src/showcase-image.gpu.selftest.mjs --out=/tmp/showcase-image
 * Frozen ?capture cases compare PNG pixels to a same-task canvas snapshot, and exact physical
 * arrays before/after. A real rAF case holds the encoder callback to exercise clock ownership.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { startProbeServer, launchProbeBrowser } from '../../core/src/render/MotionProbe.mjs';
import { decodePng } from '../../../tools/critic/png.mjs';
const root = fileURLToPath(new URL('../../../', import.meta.url));
const out = process.argv.find(a => a.startsWith('--out='))?.slice(6) ?? fs.mkdtempSync(path.join(os.tmpdir(), 'sugata-showcase-image-'));
fs.mkdirSync(out, { recursive: true });
const sha = data => createHash('sha256').update(data).digest('hex');
const sources = ['packages/core/src/wardrobe/WardrobeStyles.js', 'packages/core/src/wardrobe/WardrobeStyleOptions.js', 'packages/testbed/src/showcase.html', 'packages/testbed/src/showcase.js', 'packages/testbed/src/showcase-presets.mjs', 'packages/core/src/Avatar.js', 'packages/core/src/render/Stage.js', 'packages/core/src/wardrobe/AvatarWardrobe.js', 'packages/core/src/wardrobe/Wardrobe.js', 'packages/core/src/motion/HairDynamics.js', 'packages/core/src/motion/HairBodyContact.js', 'packages/core/src/motion/HairBodyContactForest.js', 'packages/core/src/motion/HairBodyContactCalibration.data.js', 'packages/core/src/material/SkinMaterial.js', 'packages/core/src/material/HairMaterial.js', 'assets/hair/bob01/g050.glb', 'assets/hair/bob02/g050.glb', 'assets/wardrobe/manifest.json'];
const hashes = () => Object.fromEntries(sources.map(f => [f, sha(fs.readFileSync(root + f))]));
const report = { date: new Date().toISOString(), sourceHashes: hashes(), checks: [], errors: [], images: [], limits: ['PNG captures the current canvas resolution and current temporal sample; no supersampling, motion advance, or AA settling is performed.', 'This gate checks rendered state and download ownership, not garment fit or aesthetic quality.'] };
const save = () => fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2) + '\n');
const check = (name, fn) => { fn(); report.checks.push(name); console.log('PASS ' + name); save(); };
let server, browser, page;
async function ready() {
    await page.waitForFunction(() => window.showcase || !document.querySelector('#error').hidden, null, { timeout: 120000 });
    assert.equal(await page.locator('#error').textContent(), '');
}
async function settle() { await page.evaluate(async () => { for (let i = 0; i < 16; i++) { await new Promise(requestAnimationFrame); await showcase.step(0); } }); }
async function instrument() {
    await page.evaluate(() => {
        const canvas = document.querySelector('#stage');
        window.imageProbe = { created: [], revoked: [], calls: 0, nativeToBlob: canvas.toBlob, reference: null };
        const create = URL.createObjectURL.bind(URL), revoke = URL.revokeObjectURL.bind(URL);
        URL.createObjectURL = blob => { const url = create(blob); imageProbe.created.push({ url, type: blob.type, size: blob.size }); return url; };
        URL.revokeObjectURL = url => { imageProbe.revoked.push(url); return revoke(url); };
        canvas.toBlob = function(callback, type) {
            imageProbe.calls++;
            imageProbe.nativeToBlob.call(this, callback, type);
            // AFTER the unmodified toBlob call: the witness must not flush the frame for the action.
            imageProbe.reference = this.toDataURL('image/png');
        };
        window.imageState = async () => {
            const a = showcase.avatar, c = await a.hairDynamics.readCentrelines(), v = await a.hairDynamics.readVertices();
            return { clock: a.clockSeconds, steps: c.steps, positions: Array.from(c.positions), velocities: Array.from(c.velocities), vertices: Array.from(v.positions), camera: a.stage.camera.position.toArray(), quaternion: a.stage.camera.quaternion.toArray(), projection: a.stage.camera.projectionMatrix.toArray(), target: showcase.controls.target.toArray(), focus: a.focus.toArray(), options: showcase.configuration(), pause: document.querySelector('#pause').textContent };
        };
    });
}
async function exportPng(name) {
    const before = await page.evaluate(() => imageState());
    const downloadEvent = page.waitForEvent('download'); await page.locator('#save-image').click();
    const download = await downloadEvent, file = path.join(out, name + '.png'); await download.saveAs(file);
    await page.waitForFunction(() => !document.querySelector('#save-image').disabled);
    const after = await page.evaluate(() => imageState()); assert.deepEqual(after, before, 'PNG must not change physical/camera/configuration state');
    const reference = await page.evaluate(() => imageProbe.reference), refBytes = Buffer.from(reference.split(',')[1], 'base64');
    const png = decodePng(fs.readFileSync(file)), ref = decodePng(refBytes);
    assert.equal(png.width, ref.width); assert.equal(png.height, ref.height); assert.deepEqual(png.pixels, ref.pixels, 'Downloaded RGBA must equal the current same-task rendered canvas');
    const canvasSize = await page.evaluate(() => [document.querySelector('#stage').width, document.querySelector('#stage').height]);
    assert.deepEqual([png.width, png.height], canvasSize);
    let lo = Infinity, hi = -Infinity; for (let i = 0; i < png.pixels.length; i += 4) { const y = png.pixels[i] + png.pixels[i + 1] + png.pixels[i + 2]; lo = Math.min(lo, y); hi = Math.max(hi, y); }
    assert.ok(hi - lo > .6, 'PNG must contain a nonblank actual avatar');
    const record = { name, filename: download.suggestedFilename(), sha256: sha(fs.readFileSync(file)), width: png.width, height: png.height, configuration: before.options, stateSha256: sha(JSON.stringify(before)), sameTaskPixelsExact: true, physicalCameraClockExact: true };
    report.images.push(record); save(); return { record, png };
}
try {
    server = await startProbeServer({ port: 5294 }); browser = await launchProbeBrowser();
    page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1, reducedMotion: 'no-preference' });
    page.on('pageerror', e => report.errors.push(e.message)); page.on('console', m => { if (m.type() === 'error') report.errors.push(m.text()); });
    page.on('requestfailed', r => report.errors.push(r.url() + ' ' + r.failure()?.errorText)); page.on('response', r => { if (r.status() >= 400) report.errors.push(r.status() + ' ' + r.url()); });
    await page.goto(server.baseUrl + '/src/showcase.html?preset=casual&capture='); await ready(); await settle(); await instrument();
    assert.match(await page.locator('#save-image').textContent(), /Save image \(PNG\)/); assert.match(await page.locator('#save').textContent(), /Save settings \(JSON\)/);
    check('PNG action and JSON settings are visibly distinct', () => {});
    const casual = await exportPng('casual-body'); assert.equal(casual.record.configuration.hair, 'bob02'); assert.ok(casual.record.configuration.wardrobe.outfit.includes('female_casualsuit01'));
    check('casual PNG is nonblank, current canvas pixels, and exactly preserves camera/centers/velocities/time/settings', () => {});
    await page.evaluate(() => { window.imageOwner = { avatar: showcase.avatar, renderer: showcase.avatar.stage.renderer, hair: showcase.avatar.hairDynamics }; });
    assert.equal(await page.evaluate(() => showcase.changeOutfit('elegant')), true); await settle();
    const elegant = await exportPng('elegant-body'); assert.ok(elegant.record.configuration.wardrobe.outfit.includes('female_elegantsuit01'));
    let changed = 0; for (let i = 0; i < casual.png.pixels.length; i += 4) if (Math.abs(casual.png.pixels[i] - elegant.png.pixels[i]) > .1) changed++;
    assert.ok(changed > 1000, 'Clothing switch must change actual exported pixels');
    assert.equal(await page.evaluate(() => imageOwner.avatar === showcase.avatar && imageOwner.renderer === showcase.avatar.stage.renderer && imageOwner.hair === showcase.avatar.hairDynamics), true);
    check('same-owner dressing exports the attached new outfit rather than the prior image', () => {});
    await page.locator('[data-frame="portrait"]').click(); await page.locator('[data-angle="90"]').click(); await settle();
    const portrait = await exportPng('elegant-portrait-side'); assert.equal(portrait.record.configuration.frame, 'portrait');
    check('portrait orbit/framing PNG uses current canvas size and leaves the camera and physical arrays exact', () => {});
    const settings = await page.evaluate(() => showcase.configuration()), settingsEvent = page.waitForEvent('download'); await page.locator('#save').click();
    const settingsDownload = await settingsEvent; await settingsDownload.saveAs(path.join(out, 'settings.json')); assert.deepEqual(JSON.parse(fs.readFileSync(path.join(out, 'settings.json'))), settings);
    await page.waitForFunction(() => imageProbe.created.every(c => imageProbe.revoked.includes(c.url)));
    check('JSON settings remain valid and all completed PNG/JSON download URLs are revoked', () => {});
    const refusal = await page.evaluate(async () => {
        const canvas = document.querySelector('#stage'), normal = canvas.toBlob, count = imageProbe.created.length, outcomes = [];
        for (const kind of ['null', 'throw', 'wrong-type']) {
            canvas.toBlob = cb => { if (kind === 'throw') throw new Error('controlled encoder refusal'); cb(kind === 'null' ? null : new Blob(['bad'], { type: 'text/plain' })); };
            outcomes.push({ kind, ok: await showcase.saveImage(), status: document.querySelector('#status').textContent, enabled: !document.querySelector('#save-image').disabled, orbit: showcase.controls.enabled });
        }
        canvas.toBlob = normal; return { outcomes, created: imageProbe.created.length - count };
    });
    assert.equal(refusal.created, 0); for (const item of refusal.outcomes) { assert.equal(item.ok, false); assert.match(item.status, /Image could not be saved/); assert.equal(item.enabled, true); assert.equal(item.orbit, true); }
    report.encoderRefusal = refusal;
    check('null, thrown and wrong-type encoding failures restore controls without a false download', () => {});
    const drawFailure = await page.evaluate(async () => { const a = showcase.avatar, original = a.stage.draw, count = imageProbe.calls; a.stage.draw = () => { throw new Error('controlled draw refusal'); }; try { return { ok: await showcase.saveImage(), status: document.querySelector('#status').textContent, encodeCalls: imageProbe.calls - count, enabled: !document.querySelector('#save-image').disabled }; } finally { a.stage.draw = original; } });
    assert.equal(drawFailure.ok, false); assert.match(drawFailure.status, /controlled draw refusal/); assert.equal(drawFailure.encodeCalls, 0); assert.equal(drawFailure.enabled, true);
    check('draw failure reports failure before encoding and restores controls', () => {});
    const clickFailure = await page.evaluate(async () => { const original = HTMLAnchorElement.prototype.click, count = imageProbe.created.length; HTMLAnchorElement.prototype.click = function() { if (this.download) throw new Error('controlled download refusal'); return original.call(this); }; try { const ok = await showcase.saveImage(), urls = imageProbe.created.slice(count); return { ok, status: document.querySelector('#status').textContent, urls, revoked: imageProbe.revoked, anchors: document.querySelectorAll('a[download]').length }; } finally { HTMLAnchorElement.prototype.click = original; } });
    assert.equal(clickFailure.ok, false); assert.match(clickFailure.status, /controlled download refusal/); assert.equal(clickFailure.anchors, 0); assert.equal(clickFailure.urls.length, 1); assert.ok(clickFailure.revoked.includes(clickFailure.urls[0].url));
    check('download dispatch failure removes its link, revokes its URL and reports failure', () => {});
    await page.goto(server.baseUrl + '/src/showcase.html?preset=elegant&capture='); await ready(); await settle(); await instrument();
    const longBob = await exportPng('elegant-long-bob'); assert.equal(longBob.record.configuration.hair, 'bob01');
    await page.screenshot({ path: path.join(out, 'lookbook-png-action.png'), fullPage: true });
    check('the long-bob starting look also exports its real current canvas with exact physical state', () => {});
    // A real animation loop runs; only the encoder callback is held, not the draw or physics implementation.
    await page.goto(server.baseUrl + '/src/showcase.html?preset=casual'); await ready(); await page.waitForFunction(() => showcase.avatar.clockSeconds > .1); await instrument();
    const live = await page.evaluate(async () => {
        const canvas = document.querySelector('#stage'); canvas.toBlob = function(cb, type) { imageProbe.nativeToBlob.call(this, blob => { window.finishImage = () => cb(blob); }, type); };
        const a = showcase.avatar, before = a.clockSeconds, steps = a.hairDynamics.stepsTaken, pause = document.querySelector('#pause').textContent;
        window.pendingImage = showcase.saveImage();
        const centers = await a.hairDynamics.readCentrelines();
        for (let i = 0; i < 4; i++) await new Promise(requestAnimationFrame);
        const afterCenters = await a.hairDynamics.readCentrelines();
        return { before, after: a.clockSeconds, steps, afterSteps: a.hairDynamics.stepsTaken, positions: Array.from(centers.positions), afterPositions: Array.from(afterCenters.positions), velocities: Array.from(centers.velocities), afterVelocities: Array.from(afterCenters.velocities), pause, pauseAfter: document.querySelector('#pause').textContent, overlapping: await showcase.saveImage(), dress: await showcase.changeOutfit('elegant'), disabled: ['save-image', 'save', 'copy', 'pause', 'outfit-controls', 'framing-controls', 'style-controls'].every(id => document.getElementById(id).disabled), orbit: showcase.controls.enabled };
    });
    assert.equal(live.before, live.after); assert.ok(live.steps > 0); assert.equal(live.steps, live.afterSteps); assert.deepEqual(live.positions, live.afterPositions); assert.deepEqual(live.velocities, live.afterVelocities); assert.equal(live.pause, live.pauseAfter); assert.equal(live.overlapping, false); assert.equal(live.dress, false); assert.equal(live.disabled, true); assert.equal(live.orbit, false);
    report.liveHold = { clock: live.before, steps: live.steps, unchangedPositions: true, unchangedVelocities: true, pause: live.pause };
    const liveDownloadEvent = page.waitForEvent('download'); await page.waitForFunction(() => typeof finishImage === 'function'); assert.equal(await page.evaluate(async () => { finishImage(); return await pendingImage; }), true);
    const liveDownload = await liveDownloadEvent; await liveDownload.saveAs(path.join(out, 'live-motion.png')); await page.waitForFunction(clock => showcase.avatar.clockSeconds > clock, live.after);
    const livePng = decodePng(fs.readFileSync(path.join(out, 'live-motion.png')));
    let liveLow = Infinity, liveHigh = -Infinity; for (let i = 0; i < livePng.pixels.length; i += 4) { const y = livePng.pixels[i] + livePng.pixels[i + 1] + livePng.pixels[i + 2]; liveLow = Math.min(liveLow, y); liveHigh = Math.max(liveHigh, y); }
    assert.ok(liveHigh - liveLow > .6, 'Real toBlob without a toDataURL witness must still be nonblank');
    report.liveHold.unassistedPngNonblank = true;
    check('PNG temporarily holds the actual rAF clock, rejects overlapping work, then resumes the prior motion mode', () => {});
    await page.locator('#pause').click(); await page.evaluate(() => { document.querySelector('#stage').toBlob = imageProbe.nativeToBlob; });
    const pausedBefore = await page.evaluate(() => showcase.avatar.clockSeconds), pausedDownloadEvent = page.waitForEvent('download');
    await page.locator('#save-image').click(); const pausedDownload = await pausedDownloadEvent; await pausedDownload.saveAs(path.join(out, 'paused-motion.png'));
    await page.waitForFunction(() => !document.querySelector('#save-image').disabled);
    const pausedAfter = await page.evaluate(async () => { for (let i = 0; i < 4; i++) await new Promise(requestAnimationFrame); return { clock: showcase.avatar.clockSeconds, label: document.querySelector('#pause').textContent }; });
    assert.equal(pausedAfter.clock, pausedBefore); assert.equal(pausedAfter.label, 'Resume motion');
    check('saving an already-paused real view does not resume its simulation clock', () => {});
    await page.waitForFunction(() => imageProbe.created.every(c => imageProbe.revoked.includes(c.url)));
    // Pending encoding may finish after page retirement, but it must not publish or restart its owner.
    const retired = await page.evaluate(async () => {
        const canvas = document.querySelector('#stage'); canvas.toBlob = cb => { window.finishRetiredImage = () => cb(new Blob(['unused'], { type: 'image/png' })); };
        const count = imageProbe.created.length, a = showcase.avatar, pending = showcase.saveImage();
        window.dispatchEvent(new PageTransitionEvent('pagehide', { persisted: false })); finishRetiredImage();
        const ok = await pending; return { ok, disposed: a.disposed, created: imageProbe.created.length - count, liveUrls: imageProbe.created.filter(c => !imageProbe.revoked.includes(c.url)).length };
    });
    assert.deepEqual(retired, { ok: false, disposed: true, created: 0, liveUrls: 0 });
    check('retirement during encoding suppresses stale download and leaves no owned URL', () => {});
    assert.deepEqual(hashes(), report.sourceHashes); assert.deepEqual(report.errors, []);
    check('core/page/asset source hashes remain stable and browser errors stay empty', () => {});
    report.passed = true; save(); console.log(`PASS ${report.checks.length} image export groups; ${out}`);
} catch (error) { report.error = error.stack; save(); await page?.screenshot({ path: path.join(out, 'failure.png'), fullPage: true }).catch(() => {}); throw error; }
finally { await browser?.close(); await server?.close(); }
