/** Actual saved-settings UI and attachment gate, with the native file chooser and downloads.
 * npm run build:pages
 * node packages/testbed/src/showcase-settings.gpu.selftest.mjs --production --out=/tmp/showcase-settings
 * No substitute assets. Screenshots document controls and restored looks; no aesthetic/fit claim.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { startProbeServer, launchProbeBrowser } from '../../core/src/render/MotionProbe.mjs';
const root = fileURLToPath(new URL('../../../', import.meta.url)), production = process.argv.includes('--production');
const out = process.argv.find(a => a.startsWith('--out='))?.slice(6) ?? fs.mkdtempSync(path.join(os.tmpdir(), 'sugata-showcase-settings-'));
fs.mkdirSync(out, { recursive: true });
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const sources = ['packages/testbed/src/showcase.html', 'packages/testbed/src/showcase.js', 'packages/testbed/src/showcase-presets.mjs',
    'packages/testbed/src/showcase-settings.mjs', 'packages/testbed/src/showcase-settings.gpu.selftest.mjs',
    'assets/wardrobe/female_casualsuit01/g050.glb', 'assets/wardrobe/female_elegantsuit01/g050.glb', 'assets/wardrobe/shoes01/g050.glb'];
const hashes = () => Object.fromEntries(sources.map(name => [name, sha(fs.readFileSync(root + name))]));
const report = { date: new Date().toISOString(), production, sourceHashes: hashes(), checks: [], errors: [], screenshots: [],
    limits: ['Restores the two current g050 wardrobe studies; other body fits, alternate foundation or seed values are explicitly refused.',
        'Screenshots and configuration checks establish restoration and UI behavior, not garment fit, character quality, motion acceptance or performance.'] };
const save = () => fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2) + '\n');
const check = (name, fn = () => {}) => { fn(); report.checks.push(name); console.log('PASS ' + name); save(); };
let server, browser, page;
async function ready() {
    await page.waitForFunction(() => window.showcase || !document.querySelector('#error').hidden, null, { timeout: 120000 });
    assert.equal(await page.locator('#error').textContent(), '');
    await page.evaluate(async () => { for (let i = 0; i < 8; i++) { await new Promise(requestAnimationFrame); await showcase.step(0); } });
    const sizing = await page.evaluate(() => ({ aspect: showcase.avatar.stage.camera.aspect,
        canvas: document.querySelector('#stage').clientWidth / document.querySelector('#stage').clientHeight }));
    assert.ok(Math.abs(sizing.aspect - sizing.canvas) < .002, 'Rendered camera must match the current canvas aspect after resize');
}
async function choose(payload) {
    const chooserEvent = page.waitForEvent('filechooser'); await page.locator('#open-settings').click();
    await (await chooserEvent).setFiles(payload);
}
async function snapshot(name) {
    const file = name + '.png'; await page.screenshot({ path: path.join(out, file), fullPage: true });
    report.screenshots.push({ file, sha256: sha(fs.readFileSync(path.join(out, file))) }); save();
}
async function exportedFile(name) {
    const event = page.waitForEvent('download'); await page.locator('#save').click();
    const download = await event, filename = path.join(out, name + '.json'); await download.saveAs(filename);
    assert.deepEqual(JSON.parse(fs.readFileSync(filename)), await page.evaluate(() => showcase.configuration()));
    return filename;
}
async function assertUi(configuration) {
    const actual = await page.evaluate(() => ({ configuration: showcase.configuration(), preset: document.querySelector('[data-preset][aria-current="true"]').dataset.preset,
        choices: Object.fromEntries(['outfit', 'style', 'frame', 'light'].map(key => [key, document.querySelector(`[data-${key}][aria-pressed="true"]`).dataset[key]])),
        cut: document.querySelector('#cut-label').textContent, title: document.querySelector('#view-name').textContent,
        foundation: showcase.avatar.report().wardrobe.foundation }));
    assert.deepEqual(actual.configuration, configuration);
    assert.equal(actual.preset, configuration.hair === 'bob02' ? 'casual' : 'elegant');
    assert.equal(actual.choices.outfit, configuration.wardrobe.outfit.includes('female_casualsuit01') ? 'casual' : 'elegant');
    assert.equal(actual.choices.style, configuration.wardrobe.style ?? 'original'); assert.equal(actual.choices.frame, configuration.frame);
    assert.equal(actual.choices.light, configuration.lighting); assert.deepEqual(actual.foundation, configuration.wardrobe.foundation);
    assert.equal(actual.cut, configuration.hair === 'bob02' ? 'Chin-length bob' : 'Long bob');
    return actual;
}
try {
    if (production) {
        const { preview } = await import('vite');
        const previewServer = await preview({ configFile: root + 'vite.pages.config.js', preview: { host: '127.0.0.1', port: 5296, strictPort: false }, logLevel: 'error' });
        server = { baseUrl: previewServer.resolvedUrls.local[0].replace(/\/$/, ''), close: () => new Promise((resolve, reject) => previewServer.httpServer.close(error => error ? reject(error) : resolve())) };
        report.builtHtmlSha256 = sha(fs.readFileSync(root + 'dist-pages/src/showcase.html'));
    } else server = await startProbeServer({ port: 5296 });
    browser = await launchProbeBrowser(); page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });
    page.on('pageerror', error => report.errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') report.errors.push(message.text()); });
    page.on('requestfailed', request => report.errors.push(request.url() + ' ' + request.failure()?.errorText));
    page.on('response', response => { if (response.status() >= 400) report.errors.push(response.status() + ' ' + response.url()); });
    await page.goto(server.baseUrl + '/src/showcase.html?preset=casual&capture='); await ready();
    await page.locator('[data-outfit="elegant"]').click(); await page.waitForFunction(() => !document.querySelector('#save').disabled);
    await page.locator('[data-frame="portrait"]').click(); await page.locator('[data-light="warm"]').click();
    await Promise.all([page.waitForURL(/style=charcoal/), page.locator('[data-style="charcoal"]').click()]); await ready();
    const mixed = await page.evaluate(() => showcase.configuration()), mixedFile = await exportedFile('saved-mixed-look');
    check('native JSON download captures the attached mixed charcoal/warm portrait look');
    await page.evaluate(() => { window.settingsOwner = { avatar: showcase.avatar, renderer: showcase.avatar.stage.renderer, configuration: JSON.stringify(showcase.configuration()), url: location.href }; });
    for (let attempt = 0; attempt < 2; attempt++) {
        await choose({ name: 'retry.json', mimeType: 'application/json', buffer: Buffer.from('{invalid') });
        await page.waitForFunction(() => !document.querySelector('#settings-error').hidden);
        assert.match(await page.locator('#settings-error').textContent(), /not valid JSON.*current look is retained/);
        assert.equal(await page.locator('#open-settings').isEnabled(), true); assert.equal(await page.locator('#settings-file').inputValue(), '');
    }
    await snapshot('invalid-settings-desktop');
    const refused = await page.evaluate(async () => {
        window.fileGate = new Promise((resolve, reject) => { window.rejectFile = reject; });
        const pending = showcase.openLook({ size: 20, text: () => fileGate });
        const disabled = ['open-settings', 'save', 'copy', 'save-image', 'outfit-controls'].every(id => document.getElementById(id).disabled);
        const overlapping = await showcase.openLook({ size: 2, text: async () => '{}' });
        rejectFile(new Error('Controlled file read failure')); const result = await pending;
        return { result, disabled, overlapping, retained: settingsOwner.avatar === showcase.avatar && settingsOwner.renderer === showcase.avatar.stage.renderer &&
            settingsOwner.configuration === JSON.stringify(showcase.configuration()) && settingsOwner.url === location.href,
            enabled: !document.querySelector('#open-settings').disabled, error: document.querySelector('#settings-error').textContent };
    });
    assert.deepEqual({ result: refused.result, disabled: refused.disabled, overlapping: refused.overlapping, retained: refused.retained, enabled: refused.enabled },
        { result: false, disabled: true, overlapping: false, retained: true, enabled: true });
    assert.match(refused.error, /Controlled file read failure/); report.refused = refused;
    check('malformed same-file retries and asynchronous read failure retain the exact owner/options/URL and recover controls');
    for (const [name, settings] of [['unsupported-body', { ...mixed, identity: { gender: 0, mode: 'nearest' } }], ['unsupported-seed', { ...mixed, seed: mixed.seed + 1 }]]) {
        await choose({ name: name + '.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(settings)) });
        await page.waitForFunction(() => !document.querySelector('#settings-error').hidden);
        assert.deepEqual(await page.evaluate(() => showcase.configuration()), mixed); assert.equal(await page.locator('#save').isEnabled(), true);
    }
    check('unsupported complete configurations fail accessibly before replacing the current look');
    await page.goto(server.baseUrl + '/src/showcase.html?preset=elegant&capture='); await ready();
    await choose(mixedFile); await page.waitForURL(/preset=casual/); await ready();
    report.restoredMixed = await assertUi(mixed); assert.match(report.restoredMixed.title, /Your combination/);
    assert.equal(await page.locator('#settings-error').isHidden(), true); await snapshot('restored-mixed-desktop');
    await page.setViewportSize({ width: 390, height: 844 });
    await ready();
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    await snapshot('restored-mixed-mobile');
    check('native file chooser restores the saved mixed look and every pressed/current label matches its attached report on desktop/mobile');
    await page.setViewportSize({ width: 1440, height: 1000 });
    await Promise.all([page.waitForURL(/style=original/), page.locator('[data-style="original"]').click()]); await ready();
    const original = await page.evaluate(() => showcase.configuration()), originalFile = await exportedFile('saved-original-look');
    assert.equal(Object.hasOwn(original.wardrobe, 'style'), false);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(server.baseUrl + '/src/showcase.html?preset=elegant&capture='); await ready();
    await choose(originalFile); await page.waitForURL(/style=original/); await ready(); report.restoredOriginal = await assertUi(original);
    await snapshot('restored-original-mobile'); await page.setViewportSize({ width: 1440, height: 1000 }); await ready();
    await snapshot('restored-original-desktop'); check('Original exports with omitted wardrobe.style reopen through the mobile file chooser with original fabrics selected and attached');
    assert.deepEqual(report.errors, []); assert.deepEqual(hashes(), report.sourceHashes);
    check('browser console, page and network errors are empty and all recorded source/asset hashes stayed stable');
    report.passed = true; save(); console.log(`PASS ${report.checks.length} showcase settings browser groups; ${out}`);
} catch (error) {
    report.error = error.stack; save(); await page?.screenshot({ path: path.join(out, 'failure.png'), fullPage: true }).catch(() => {}); throw error;
} finally { await browser?.close(); await server?.close(); }
