/** Native Wardrobe scene switch + saved-settings gate. No substitute assets.
 * node packages/testbed/src/showcase-scenes.gpu.selftest.mjs --out=/tmp/wardrobe-scenes-new
 * Add --production after npm run build:pages to exercise the built review page.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { startProbeServer, launchProbeBrowser } from '../../core/src/render/MotionProbe.mjs';
const root = fileURLToPath(new URL('../../../', import.meta.url)), production = process.argv.includes('--production');
const out = process.argv.find(a => a.startsWith('--out='))?.slice(6) ?? fs.mkdtempSync(path.join(os.tmpdir(), 'sugata-wardrobe-scenes-'));
if (fs.existsSync(path.join(out, 'report.json'))) throw new Error('Use a fresh evidence directory.');
fs.mkdirSync(out, { recursive: true });
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const sources = ['packages/testbed/src/showcase.html', 'packages/testbed/src/showcase.js', 'packages/testbed/src/showcase-presets.mjs',
    'packages/testbed/src/showcase-settings.mjs', 'packages/testbed/src/viewer-scenes.mjs', 'packages/testbed/src/viewer-framing.mjs',
    'packages/testbed/src/showcase-scenes.gpu.selftest.mjs', 'packages/core/src/Avatar.js', 'packages/core/src/render/Scene.js',
    'packages/core/src/render/InteriorEnvironment.js', 'assets/wardrobe/female_casualsuit01/g050.glb',
    'assets/wardrobe/female_elegantsuit01/g050.glb', 'assets/wardrobe/shoes01/g050.glb',
    'assets/wardrobe/foundation_bra/g050.glb', 'assets/wardrobe/foundation_briefs/g050.glb', 'assets/hair/bob01/g050.glb', 'assets/hair/bob02/g050.glb'];
const hashes = () => Object.fromEntries(sources.map(name => [name, sha(fs.readFileSync(root + name))]));
const report = { date: new Date().toISOString(), production, sourceHashes: hashes(), checks: [], errors: [], screenshots: [], downloads: [], states: {},
    limits: ['Functional evidence for the current two g050 studies only; no fit, hair, motion or other-body acceptance.',
        'Kitchen uses the existing native scene exposure and lighting; the chooser adds no core scene or asset changes.',
        'Scene changes and settings restore start a new Avatar and viewing clock; orbit, attention and motion time are not saved.'] };
const save = () => fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2) + '\n');
const check = name => { report.checks.push(name); console.log('PASS ' + name); save(); };
let server, browser, page;
async function ready() {
    await page.waitForFunction(() => window.showcase || !document.querySelector('#error').hidden, null, { timeout: 120000 });
    assert.equal(await page.locator('#error').textContent(), '');
    await page.evaluate(async () => { for (let i = 0; i < 8; i++) { await new Promise(requestAnimationFrame); await showcase.step(0); } });
    const sizing = await page.evaluate(() => ({ aspect: showcase.avatar.stage.camera.aspect,
        canvas: document.querySelector('#stage').clientWidth / document.querySelector('#stage').clientHeight }));
    assert.ok(Math.abs(sizing.aspect - sizing.canvas) < .002, 'Camera aspect must settle to the current canvas');
}
async function state(name, expected) {
    const actual = await page.evaluate(() => ({ configuration: showcase.configuration(), url: location.href,
        choices: Object.fromEntries(['outfit', 'style', 'frame', 'light', 'scene'].map(key => [key, document.querySelector(`[data-${key}][aria-pressed="true"]`).dataset[key]])),
        preset: document.querySelector('[data-preset][aria-current="true"]').dataset.preset,
        cut: document.querySelector('#cut-label').textContent, lightingHidden: document.querySelector('#lighting-controls').hidden,
        scene: showcase.avatar.report().scene, resolvedLighting: showcase.avatar.lighting,
        nativeExposure: showcase.avatar.scene.exposure, foundation: showcase.avatar.report().wardrobe.foundation,
        attention: showcase.attention.phase, noHorizontalOverflow: document.documentElement.scrollWidth <= innerWidth }));
    assert.deepEqual(actual.configuration, expected);
    assert.equal(actual.choices.scene, expected.scene); assert.equal(actual.scene.id, expected.scene);
    assert.equal(actual.lightingHidden, expected.scene === 'kitchen');
    assert.equal(actual.choices.light, expected.lighting ?? 'studio'); assert.equal(actual.resolvedLighting.look, expected.lighting ?? 'studio');
    assert.equal(actual.resolvedLighting.exposure, expected.scene === 'kitchen' ? actual.nativeExposure : 1);
    assert.equal(actual.scene.lighting.exposure, .85 * actual.resolvedLighting.exposure);
    if (expected.scene === 'kitchen') {
        assert.notEqual(actual.nativeExposure, 1, 'Kitchen exposure must distinguish native lighting from an explicit Studio override');
        assert.equal(Object.hasOwn(expected, 'lighting'), false);
        assert.equal(actual.scene.kind, 'interior'); assert.equal(actual.scene.environment.attached, true);
    }
    assert.equal(actual.preset, expected.hair === 'bob02' ? 'casual' : 'elegant');
    assert.equal(actual.choices.outfit, expected.wardrobe.outfit.includes('female_casualsuit01') ? 'casual' : 'elegant');
    assert.equal(actual.choices.style, expected.wardrobe.style ?? 'original'); assert.equal(actual.choices.frame, expected.frame);
    assert.deepEqual(actual.foundation, expected.wardrobe.foundation);
    assert.equal(actual.cut, expected.hair === 'bob02' ? 'Chin-length bob' : 'Long bob');
    assert.equal(actual.noHorizontalOverflow, true); report.states[name] = actual; save(); return actual;
}
async function screenshot(name) {
    await page.evaluate(() => scrollTo(0, 0));
    const file = name + '.png'; await page.screenshot({ path: path.join(out, file), fullPage: true });
    report.screenshots.push({ file, sha256: sha(fs.readFileSync(path.join(out, file))) }); save();
}
async function exportFile(name) {
    const event = page.waitForEvent('download'); await page.locator('#save').click();
    const download = await event, filename = path.join(out, name + '.json'); await download.saveAs(filename);
    assert.deepEqual(JSON.parse(fs.readFileSync(filename)), await page.evaluate(() => showcase.configuration()));
    report.downloads.push({ file: path.basename(filename), sha256: sha(fs.readFileSync(filename)) }); save(); return filename;
}
async function choose(file) {
    const event = page.waitForEvent('filechooser'); await page.locator('#open-settings').click(); await (await event).setFiles(file);
}
async function switchScene(scene) {
    await Promise.all([page.waitForEvent('domcontentloaded'), page.locator(`[data-scene="${scene}"]`).click()]); await ready();
}
try {
    if (production) {
        const { preview } = await import('vite');
        const previewServer = await preview({ configFile: root + 'vite.pages.config.js', preview: { host: '127.0.0.1', port: 5301, strictPort: false }, logLevel: 'error' });
        server = { baseUrl: previewServer.resolvedUrls.local[0].replace(/\/$/, ''), close: () => new Promise((resolve, reject) => previewServer.httpServer.close(error => error ? reject(error) : resolve())) };
        report.builtHtmlSha256 = sha(fs.readFileSync(root + 'dist-pages/src/showcase.html'));
    } else server = await startProbeServer({ port: 5301 });
    browser = await launchProbeBrowser(); page = await browser.newPage({ viewport: { width: 1440, height: 1080 }, deviceScaleFactor: 1 });
    page.on('pageerror', error => report.errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') report.errors.push(message.text()); });
    page.on('requestfailed', request => report.errors.push(request.url() + ' ' + request.failure()?.errorText));
    page.on('response', response => { if (response.status() >= 400) report.errors.push(response.status() + ' ' + response.url()); });
    await page.goto(server.baseUrl + '/src/showcase.html?preset=casual&outfit=elegant&style=charcoal&frame=portrait&light=warm&capture='); await ready();
    const studio = await page.evaluate(() => showcase.configuration()), studioFile = await exportFile('studio-warm-mixed');
    await state('studio-warm-desktop', studio); await screenshot('studio-warm-desktop');
    check('existing Studio mixed warm portrait exports unchanged, with light controls and complete attached UI state');
    await page.locator('#look-toward-me').click();
    assert.equal(await page.evaluate(() => showcase.attention.phase), 'attending');
    await switchScene('kitchen');
    const kitchen = { ...studio, scene: 'kitchen' }; delete kitchen.lighting;
    const kitchenState = await state('kitchen-mixed-desktop', kitchen);
    assert.equal(new URL(kitchenState.url).searchParams.has('light'), false); assert.equal(kitchenState.attention, 'idle');
    assert.equal(await page.locator('[data-preset="elegant"]').evaluate(node => new URL(node.href).searchParams.get('scene')), 'kitchen');
    const kitchenFile = await exportFile('kitchen-mixed'); await screenshot('kitchen-mixed-desktop');
    check('scene button preserves mixed look and framing, clears Studio light, starts fresh attention and uses native Kitchen exposure');
    await page.evaluate(() => { window.retainedLook = { avatar: showcase.avatar, configuration: JSON.stringify(showcase.configuration()), url: location.href }; });
    for (const lighting of ['studio', 'warm']) {
        await choose({ name: 'invalid-kitchen.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify({ ...kitchen, lighting })) });
        await page.waitForFunction(() => !document.querySelector('#settings-error').hidden);
        assert.match(await page.locator('#settings-error').textContent(), /current look is retained/);
        assert.equal(await page.evaluate(() => retainedLook.avatar === showcase.avatar && retainedLook.configuration === JSON.stringify(showcase.configuration()) && retainedLook.url === location.href), true);
        assert.equal(await page.locator('#open-settings').isEnabled(), true);
    }
    await screenshot('kitchen-invalid-settings-desktop');
    check('unsupported explicit Kitchen lighting is refused accessibly with owner, complete look and URL retained');
    await switchScene('studio');
    await state('studio-default-after-kitchen', { ...studio, lighting: 'studio' });
    assert.equal(new URL(page.url()).searchParams.has('light'), false);
    await choose(kitchenFile); await page.waitForURL(/scene=kitchen/); await ready(); await state('reopened-kitchen-mixed', kitchen);
    check('back-switch restores Studio controls and default light; actual downloaded Kitchen settings reopen with native lighting');
    await Promise.all([page.waitForEvent('domcontentloaded'), page.locator('[data-style="original"]').click()]); await ready();
    const original = { ...kitchen, wardrobe: { ...kitchen.wardrobe } }; delete original.wardrobe.style;
    await state('kitchen-original-desktop', original); const originalFile = await exportFile('kitchen-original');
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(server.baseUrl + '/src/showcase.html?preset=elegant&capture='); await ready();
    await choose(originalFile); await page.waitForURL(/scene=kitchen/); await ready();
    await state('reopened-kitchen-original-mobile', original); await screenshot('kitchen-original-mobile');
    check('fresh mobile file chooser restores Kitchen plus omitted Original style, mixed outfit, portrait framing and all pressed controls');
    await page.locator('[data-frame="body"]').click(); await ready();
    const fullBody = { ...original, frame: 'body' }; await state('kitchen-original-body-mobile', fullBody); await screenshot('kitchen-body-mobile');
    await switchScene('studio'); await state('studio-original-body-mobile', { ...fullBody, scene: 'studio', lighting: 'studio' });
    await screenshot('studio-body-mobile');
    check('mobile full-look framing and room switch preserve Original fabrics and expose usable Studio lighting controls');
    await page.setViewportSize({ width: 1440, height: 1080 });
    await page.goto(server.baseUrl + '/src/showcase.html?scene=kitchen&preset=elegant&capture='); await ready();
    const elegant = await page.evaluate(() => showcase.configuration()); await state('kitchen-elegant-body-desktop', elegant); await screenshot('kitchen-elegant-body-desktop');
    await choose(studioFile); await page.waitForURL(/light=warm/); await ready(); await state('legacy-studio-reopened', studio);
    check('second authored study loads in Kitchen; legacy Studio warm settings restore from Kitchen with faithful scene and light');
    assert.deepEqual(report.errors, []); assert.deepEqual(hashes(), report.sourceHashes);
    check('browser page, console and network errors are empty and all recorded source/asset hashes remain exact');
    report.passed = true; save(); console.log(`PASS ${report.checks.length} Wardrobe scene browser groups; ${out}`);
} catch (error) {
    report.error = error.stack; save(); await page?.screenshot({ path: path.join(out, 'failure.png'), fullPage: true }).catch(() => {}); throw error;
} finally { await browser?.close(); await server?.close(); }
