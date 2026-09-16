// Run from the repository root. Refuses to overwrite evidence or accept another candidate hash.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {createServer} from 'vite';
import {launchProbeBrowser} from '../../packages/core/src/render/MotionProbe.mjs';
import {readGlb, readPrimitive} from '../lut-bake/glb.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const ARCHIVE = ROOT + '/captures/collar-clearance-paused-2026-09-13';
const OUT = path.resolve(process.argv[2] || ROOT + '/captures/collar-opening-2026-09-16');
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const candidateSHA256 = sha(fs.readFileSync(ARCHIVE + '/casual-collar-v2.glb'));
assert.equal(candidateSHA256, 'ca65319add5a41147df9d894aebe6441a9ab6f5131ee639dd49c3bef74861e5e');
assert.equal(fs.existsSync(OUT), false, 'Evidence output already exists');
fs.mkdirSync(OUT, {recursive: true});
const prior = JSON.parse(fs.readFileSync(ARCHIVE + '/preview-v1/report.json'));
const sourceHashes = () => Object.fromEntries(Object.keys(prior.sourceHashes).map(p => [p, sha(fs.readFileSync(ROOT + '/' + p))]));
assert.deepEqual(sourceHashes(), prior.sourceHashes);
const source = readPrimitive(readGlb(ROOT + '/assets/wardrobe/female_casualsuit01/g050.glb'), 'female_casualsuit01');
const candidate = readPrimitive(readGlb(ARCHIVE + '/casual-collar-v2.glb'), 'female_casualsuit01');
assert.deepEqual(candidate.indices, source.indices);
const report = {completed: false, candidateSHA256, sourceHashes: sourceHashes(), created: new Date().toISOString(),
    scope: 'Exact candidate loaded as position/normal arrays; one-factor side and foundation controls, fixed native 1.5 s pose, then oblique views. No shipping asset or body mask edits.', captures: [], errors: []};
const server = await createServer({configFile: ROOT + '/vite.config.js', server: {host: '127.0.0.1', port: 5357,
    strictPort: true, hmr: false, watch: {ignored: ['**']}, fs: {allow: [ROOT]}}, logLevel: 'error'});
let browser, page;
try {
    await server.listen(); browser = await launchProbeBrowser();
    page = await browser.newPage({viewport: {width: 1280, height: 1050}, deviceScaleFactor: 1, reducedMotion: 'no-preference'});
    page.on('pageerror', e => report.errors.push(String(e)));
    page.on('console', m => { if (m.type() === 'error') report.errors.push(m.text()); });
    await page.goto('http://127.0.0.1:5357/src/showcase.html?preset=casual&frame=portrait&capture=');
    await page.waitForFunction(() => window.showcase, null, {timeout: 120000});
    report.setup = await page.evaluate(async ({ROOT, ARCHIVE, source, candidate}) => {
        window.avatar = showcase.avatar;
        window.helper = await import('/@fs' + ARCHIVE + '/browser.mjs');
        window.picker = await import('/@fs' + ROOT + '/tools/figure-pipeline/collar_opening_browser.mjs');
        const a = avatar, m = a.wardrobe.wornMeshes.get('female_casualsuit01'), g = m.geometry;
        if (!g.attributes.position.array.every((p, i) => p === source[i])) throw Error('Runtime source mismatch');
        g.attributes.position.array.set(candidate.positions); g.attributes.normal.array.set(candidate.normals);
        g.attributes.position.needsUpdate = true; g.attributes.normal.needsUpdate = true;
        g.computeBoundingBox(); g.computeBoundingSphere(); m.computeBoundingSphere();
        showcase.controls.target.copy(a.focus); showcase.controls.target.y += .045;
        window.probe = await helper.setup(a, {arm: 'owned', motion: 'natural', yaw: 12});
        for (let i = 0; i < 128; i++) await helper.draw(a);
        const adapter = await navigator.gpu.requestAdapter();
        return {configuration: showcase.configuration(), clothSide: m.material.side,
            gpu: {info: {...adapter.info}, isFallbackAdapter: adapter.info.isFallbackAdapter ?? adapter.isFallbackAdapter}, capture: probe.setupReport};
    }, {ROOT, ARCHIVE, source: Array.from(source.positions), candidate: {positions: Array.from(candidate.positions), normals: Array.from(candidate.normals)}});
    await page.locator('#look-toward-me').click();
    for (let i = 0; i < 90; i++) await page.evaluate(() => helper.step(avatar, 1 / 60));
    const state = () => page.evaluate(async () => ({clock: avatar.clockSeconds, bones: Array.from(avatar.figure.body.skeleton.boneMatrices),
        morphs: Array.from(avatar.figure.body.morphTargetInfluences), physical: await helper.physical(avatar)}));
    const native = await state();
    fs.writeFileSync(OUT + '/state.json', JSON.stringify(native));
    const capture = async (name, converge = true) => {
        if (converge) for (let i = 0; i < 128; i++) await page.evaluate(() => helper.draw(avatar));
        const bytes = await page.locator('#stage').screenshot(); fs.writeFileSync(OUT + '/' + name + '.png', bytes);
        report.captures.push({name, sha256: sha(bytes), state: await state()});
        console.log('Captured ' + name);
    };
    await capture('ordinary-native', false);
    const oldState = JSON.parse(fs.readFileSync(ARCHIVE + '/preview-v1/fit/state.json'));
    // JSON archives normalize -0 to 0; compare numeric values without treating signed zero as a pose change.
    assert.equal(native.bones.length, oldState.bones.length);
    assert.ok(native.bones.every((v, i) => v === oldState.bones[i]));
    assert.equal(native.morphs.length, oldState.morphs.length);
    assert.ok(native.morphs.every((v, i) => v === oldState.morphs[i]));
    assert.deepEqual(JSON.parse(JSON.stringify(native.physical)), oldState.physical);
    report.savedPoseReproduced = true;
    const points = [];
    for (const [label, x0, y0, x1, y1] of [['left', 110, 688, 140, 707], ['right', 440, 672, 478, 697]]) {
        for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) points.push({label, x: x + .5, y: y + .5});
    }
    fs.writeFileSync(OUT + '/rays.json', JSON.stringify(await page.evaluate(points => picker.pick(avatar, points), points)));
    await capture('ordinary-converged');
    await page.evaluate(() => {
        const bra = avatar.wardrobe.wornMeshes.get('foundation_bra'); window.originalBraColor = bra.material.color.clone();
        bra.material.color.setRGB(1, 0, 1);
    });
    await capture('foundation-tag');
    await page.evaluate(() => avatar.wardrobe.wornMeshes.get('foundation_bra').material.color.copy(originalBraColor));
    await page.evaluate(() => {const m = avatar.wardrobe.wornMeshes.get('female_casualsuit01').material; m.side = 2; m.needsUpdate = true;});
    await capture('double-sided');
    await page.evaluate(() => {const m = avatar.wardrobe.wornMeshes.get('female_casualsuit01').material; m.side = 0; m.needsUpdate = true;});
    await capture('ordinary-restored');
    for (const yaw of [-45, 45, 135, 180]) {
        await page.evaluate(yaw => helper.view(avatar, yaw), yaw);
        await capture('ordinary-yaw-' + yaw);
    }
    assert.deepEqual(report.errors, []); assert.deepEqual(sourceHashes(), report.sourceHashes);
    report.completed = true;
} catch (error) { report.failure = error.stack; process.exitCode = 1; }
finally {
    if (page) {
        try {
            report.disposal = await page.evaluate(() => {
                const a = window.avatar; if (!a) return null; const renderer = a.stage.renderer;
                showcase.attention.dispose(); showcase.controls.dispose(); helper.dispose(a, probe);
                return {memory: structuredClone(renderer.info.memory), leaks: a.leakedHandles()};
            });
        } catch (error) { report.disposalError = String(error); }
    }
    fs.writeFileSync(OUT + '/report.json', JSON.stringify(report, null, 2));
    await browser?.close(); await server.close();
    console.log(JSON.stringify({completed: report.completed, failure: report.failure, disposal: report.disposal}));
}
