// Paired full-character visual review. No metric thresholds or accepted assets are edited.
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { startProbeServer, launchProbeBrowser } from '../../../../packages/core/src/render/MotionProbe.mjs';
import { SCENES } from '../../../../packages/core/src/render/Scene.js';
const out = path.resolve(process.argv[2] ?? '');
if (!process.argv[2] || fs.existsSync(out)) throw new Error('Provide a new evidence directory.');
const wallHex = process.argv[3] ?? '928b80';
if (!/^[0-9a-fA-F]{6}$/.test(wallHex)) throw new Error('Wall must be six hex digits.');
fs.mkdirSync(out, { recursive: true });
const sha = b => createHash('sha256').update(b).digest('hex');
const files = ['packages/core/src/render/Scene.js', 'packages/core/src/Avatar.js', 'packages/core/src/render/InteriorEnvironment.js',
    'packages/testbed/src/showcase-presets.mjs', 'tools/critic/avatar-plate.html',
    'docs/evidence/nonhair-2026-09-26/scene/clothed.mjs',
    'assets/wardrobe/female_casualsuit01/g050.glb', 'assets/wardrobe/female_elegantsuit01/g050.glb',
    'assets/wardrobe/shoes01/g050.glb', 'assets/hair/bob01/g050.glb', 'assets/hair/bob02/g050.glb'];
const hashes = () => Object.fromEntries(files.map(f => [f, sha(fs.readFileSync(f))]));
const report = { date: new Date().toISOString(), wallHex, sourceHashes: hashes(), cases: [], errors: [],
    limits: ['Existing g050 outfits only. Fixed-pose visual scene comparison, not motion or fit qualification.',
        'Wall material changes include a real IBL rebake. No claim of unchanged kitchen illumination.'] };
const save = () => fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2) + '\n');
let server, browser;
try {
    server = await startProbeServer({ port: 5298 }); browser = await launchProbeBrowser();
    for (const look of ['casual', 'elegant']) for (const frame of ['portrait', 'body']) for (const candidate of [false, true]) {
        const label = `${look}-${frame}-${candidate ? 'wall' + wallHex : 'original'}`;
        const page = await browser.newPage({ viewport: { width: 900, height: 1200 }, deviceScaleFactor: 1 });
        page.on('console', m => { if (m.type() === 'error') report.errors.push({ label, message: m.text() }); });
        page.on('pageerror', e => report.errors.push({ label, message: e.message }));
        page.on('requestfailed', r => report.errors.push({ label, message: r.url() + ' ' + r.failure()?.errorText }));
        page.on('response', r => { if (r.status() >= 400) report.errors.push({ label, message: r.status() + ' ' + r.url() }); });
        const query = new URLSearchParams({ scene: 'kitchen', look, frame, freeze: '', seed: '1', capture: '' });
        if (candidate) query.set('sceneover', JSON.stringify({ room: { ...SCENES.kitchen.room, wall: parseInt(wallHex, 16) } }));
        const url = server.baseUrl + '/@fs' + process.cwd() + '/tools/critic/avatar-plate.html?' + query;
        await page.goto(url, { waitUntil: 'domcontentloaded' });
        await page.waitForFunction(() => typeof __SUGATA_STEP__ === 'function' || !document.querySelector('#failure').hidden, null, { timeout: 120000 });
        const failure = await page.locator('#failure').textContent(); if (failure) throw new Error(failure);
        await page.evaluate(async () => { for (let i = 0; i < 24; i++) await __SUGATA_STEP__(0); });
        const native = await page.evaluate(() => ({ report: avatar.report(), resolvedLighting: avatar.lighting,
            clockSeconds: avatar.clockSeconds, camera: { position: avatar.stage.camera.position.toArray(),
            quaternion: avatar.stage.camera.quaternion.toArray(), fov: avatar.stage.camera.fov, aspect: avatar.stage.camera.aspect } }));
        const { wardrobe, hair, scene, motion } = native.report;
        const checks = { attached: wardrobe.attached && hair.attached,
            nativeCardsReady: hair.solver?.steps > 0 && hair.history?.valid === true && hair.cardFrame?.available === true,
            sceneLighting: scene.id === 'kitchen' && native.resolvedLighting.exposure === SCENES.kitchen.exposure
                && JSON.stringify(native.resolvedLighting.scales) === JSON.stringify(SCENES.kitchen.scales),
            environmentBaked: scene.environment.attached && scene.environment.bakes === 1,
            heldSimulation: native.clockSeconds === 0 && motion.timeSeconds === 0 };
        if (!Object.values(checks).every(Boolean)) {
            report.cases.push({ label, url, native, checks });
            throw new Error('Clothed capture readiness failed: ' + JSON.stringify(checks));
        }
        const image = label + '.png'; await page.screenshot({ path: path.join(out, image) });
        report.cases.push({ label, url, native, checks, image, sha256: sha(fs.readFileSync(path.join(out, image))) }); save();
        await page.close();
    }
    report.hashesStable = JSON.stringify(hashes()) === JSON.stringify(report.sourceHashes);
    report.complete = report.errors.length === 0 && report.hashesStable; save();
    if (!report.complete) throw new Error('Capture errors or source drift.');
    console.log(`Captured ${report.cases.length} real clothed scene views with no errors.`);
} catch (error) { report.error = error.stack; save(); throw error; }
finally { await browser?.close(); await server?.close(); }
