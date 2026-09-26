// Native browser-local saved looks gate; run serially with other GPU work.
// node packages/testbed/src/showcase-collection.gpu.selftest.mjs --out=FRESH_DIR [--production]
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { startProbeServer, launchProbeBrowser } from '../../core/src/render/MotionProbe.mjs';
import { SAVED_LOOKS_KEY } from './showcase-collection.mjs';
const root = fileURLToPath(new URL('../../../', import.meta.url));
const out = process.argv.find(value => value.startsWith('--out='))?.slice(6), production = process.argv.includes('--production');
assert.ok(out && !fs.existsSync(out), 'Use a fresh --out directory'); fs.mkdirSync(out, { recursive: true });
const sha = value => createHash('sha256').update(value).digest('hex');
const files = ['showcase.html', 'showcase.js', 'showcase-presets.mjs', 'showcase-settings.mjs', 'showcase-collection.mjs', 'showcase-collection.selftest.mjs', 'showcase-collection.gpu.selftest.mjs', 'viewer-scenes.mjs', 'viewer-framing.mjs'].map(file => 'packages/testbed/src/' + file);
files.push('packages/core/src/Avatar.js', 'packages/core/src/motion/AttentionAction.js', 'assets/wardrobe/manifest.json',
    ...['female_casualsuit01', 'female_elegantsuit01', 'shoes01', 'foundation_bra', 'foundation_briefs'].map(id => `assets/wardrobe/${id}/g050.glb`), 'assets/hair/bob01/g050.glb', 'assets/hair/bob02/g050.glb');
const hashes = () => Object.fromEntries(files.map(file => [file, sha(fs.readFileSync(root + file))]));
const builtHashes = () => Object.fromEntries(fs.readdirSync(root + 'dist-pages', { recursive: true }).filter(file => /\.(?:html|js|json)$/.test(file)).sort().map(file => [file, sha(fs.readFileSync(root + 'dist-pages/' + file))]));
const report = { startedAt: new Date().toISOString(), production, sourceHashes: hashes(), checks: [], screenshots: [], errors: [], states: {},
    scope: 'Named local look persistence and recovery on the current g050 studies. No fit, appearance, hair, performance or concurrent-write atomicity claim.',
    storageFailure: 'Controlled localStorage accessor exception; the second-tab mutations use a lightweight same-origin writer document and real browser storage events.' };
const save = () => fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2) + '\n');
const check = message => { report.checks.push(message); console.log('PASS ' + message); save(); };
let server, browser, context, page, writer;
async function settle(count = 16) { await page.evaluate(async count => { for (let i = 0; i < count; i++) { await new Promise(requestAnimationFrame); await showcase.step(0); } }, count); }
async function ready() {
    await page.waitForFunction(() => window.showcase || !document.querySelector('#error').hidden, null, { timeout: 120000 });
    assert.equal(await page.locator('#error').textContent(), ''); await settle(32);
}
async function expand() { if (await page.locator('#saved-looks').getAttribute('open') === null) await page.locator('#saved-looks summary').click(); }
async function configuration() { return page.evaluate(() => showcase.configuration()); }
async function collection() { return page.evaluate(key => JSON.parse(localStorage.getItem(key)), SAVED_LOOKS_KEY); }
async function saveNamed(name, keyboard = false) {
    await expand(); await page.getByLabel('Name this look', { exact: true }).fill(name);
    if (keyboard) {
        await page.locator('#saved-look-name').press('Tab');
        assert.equal(await page.locator('#save-local-look').evaluate(node => node === document.activeElement), true);
        await page.locator('#save-local-look').press('Enter');
    } else await page.locator('#save-local-look').click();
    await page.waitForFunction(() => document.querySelector('#collection-status').textContent.includes('is saved in this browser'));
    return (await collection()).looks.find(item => item.name === name);
}
async function openEntry(id) {
    await expand(); await Promise.all([page.waitForEvent('domcontentloaded'), page.locator(`[data-open-look="${id}"]`).click()]); await ready();
}
async function owner() {
    return page.evaluate(() => {
        window.libraryOwner ??= { avatar: showcase.avatar, renderer: showcase.avatar.stage.renderer };
        const camera = showcase.avatar.stage.camera;
        return { sameOwner: libraryOwner.avatar === showcase.avatar && libraryOwner.renderer === showcase.avatar.stage.renderer,
            configuration: showcase.configuration(), position: camera.position.toArray(), quaternion: camera.quaternion.toArray(), target: showcase.controls.target.toArray(),
            zoom: camera.zoom, clock: showcase.avatar.clockSeconds, attention: showcase.attention.report(), url: location.href };
    });
}
async function screenshot(name, fullPage = false) {
    if (fullPage) await page.evaluate(() => scrollTo(0, 0)); else await page.locator('#saved-looks').evaluate(node => node.scrollIntoView({ block: 'end' }));
    await settle(32); const file = name + '.png'; await page.screenshot({ path: path.join(out, file), fullPage });
    report.screenshots.push({ file, sha256: sha(fs.readFileSync(path.join(out, file))) }); save();
}
async function writeCollection(raw) { await writer.evaluate(({ key, raw }) => localStorage.setItem(key, raw), { key: SAVED_LOOKS_KEY, raw }); }
async function ui(expected) {
    const actual = await page.evaluate(() => ({ configuration: showcase.configuration(), choices: Object.fromEntries(['outfit', 'style', 'frame', 'scene', 'light'].map(key => [key, document.querySelector(`[data-${key}][aria-pressed="true"]`).dataset[key]])),
        preset: document.querySelector('[data-preset][aria-current="true"]').dataset.preset, cutLabel: document.querySelector('#cut-label').textContent,
        lightHidden: document.querySelector('#lighting-controls').hidden, exposure: showcase.avatar.report().scene.lighting.exposure,
        noOverflow: document.documentElement.scrollWidth <= innerWidth }));
    assert.deepEqual(actual.configuration, expected); assert.equal(actual.choices.style, expected.wardrobe.style ?? 'original');
    assert.equal(actual.choices.scene, expected.scene); assert.equal(actual.choices.frame, expected.frame);
    assert.equal(actual.choices.outfit, expected.wardrobe.outfit.includes('female_elegantsuit01') ? 'elegant' : 'casual');
    assert.equal(actual.choices.light, expected.lighting ?? 'studio'); assert.equal(actual.lightHidden, expected.scene === 'kitchen');
    assert.equal(actual.preset, expected.hair === 'bob02' ? 'casual' : 'elegant'); assert.equal(actual.cutLabel, expected.hair === 'bob02' ? 'Chin-length bob' : 'Long bob');
    assert.equal(actual.exposure, expected.scene === 'kitchen' ? 2.04 : .85); assert.equal(actual.noOverflow, true); return actual;
}
try {
    if (production) {
        const { preview } = await import('vite'); const previewServer = await preview({ configFile: root + 'vite.pages.config.js', preview: { host: '127.0.0.1', port: 5373, strictPort: false }, logLevel: 'error' });
        server = { baseUrl: previewServer.resolvedUrls.local[0].replace(/\/$/, ''), close: () => new Promise((resolve, reject) => previewServer.httpServer.close(error => error ? reject(error) : resolve())) };
        report.builtHtmlSha256 = sha(fs.readFileSync(root + 'dist-pages/src/showcase.html'));
        report.builtFileHashes = builtHashes();
    } else server = await startProbeServer({ port: 5373 });
    browser = await launchProbeBrowser(); context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 }); page = await context.newPage();
    page.on('pageerror', error => report.errors.push(error.message)); page.on('console', message => { if (message.type() === 'error') report.errors.push(message.text()); });
    page.on('requestfailed', request => report.errors.push(request.url() + ' ' + request.failure()?.errorText));
    page.on('response', response => { if (response.status() >= 400) report.errors.push(response.status() + ' ' + response.url()); });
    await page.goto(server.baseUrl + '/src/showcase.html?preset=casual&outfit=elegant&style=charcoal&frame=portrait&light=warm&capture=collection'); await ready();
    await page.locator('#look-toward-me').click(); await settle(2); const beforeSave = await owner(); assert.equal(beforeSave.attention.phase, 'attending');
    const first = await saveNamed('Quiet morning', true); assert.deepEqual(first.configuration, beforeSave.configuration); assert.deepEqual(await owner(), beforeSave);
    const rawBeforeDuplicate = await page.evaluate(key => localStorage.getItem(key), SAVED_LOOKS_KEY);
    await page.locator('#saved-look-name').fill('quiet MORNING'); await page.locator('#save-local-look').click();
    await page.waitForFunction(() => !document.querySelector('#collection-error').hidden);
    assert.match(await page.locator('#collection-error').textContent(), /already saved/);
    assert.equal(await page.evaluate(key => localStorage.getItem(key), SAVED_LOOKS_KEY), rawBeforeDuplicate); assert.deepEqual(await owner(), beforeSave);
    check('native naming saves actual mixed Warm settings; duplicate refusal preserves stored bytes and live owner/camera/clock/attention');
    await Promise.all([page.waitForEvent('domcontentloaded'), page.locator('[data-scene="kitchen"]').click()]); await ready();
    await Promise.all([page.waitForEvent('domcontentloaded'), page.locator('[data-style="original"]').click()]); await ready();
    await page.locator('[data-frame="body"]').click(); await settle(); const second = await saveNamed('Kitchen afternoon');
    assert.equal(Object.hasOwn(second.configuration, 'lighting'), false); assert.equal(Object.hasOwn(second.configuration.wardrobe, 'style'), false);
    await page.reload(); await ready(); await expand(); assert.equal((await collection()).looks.length, 2);
    assert.equal(await page.locator('#saved-look-list li').count(), 2); await screenshot('two-saved-looks-desktop');
    await openEntry(first.id); report.states.studioRestored = await ui(first.configuration);
    const downloadEvent = page.waitForEvent('download'); await page.locator('#save').click(); const downloaded = await downloadEvent;
    const file = path.join(out, 'plain-avatar-options.json'); await downloaded.saveAs(file);
    assert.deepEqual(JSON.parse(fs.readFileSync(file)), first.configuration); report.download = { file: path.basename(file), sha256: sha(fs.readFileSync(file)) };
    check('two named looks survive reload; Open reconstructs attached Studio settings and existing JSON export stays plain Avatar options');
    await page.setViewportSize({ width: 390, height: 844 }); await page.goto(server.baseUrl + '/src/showcase.html?preset=elegant&capture=collection'); await ready();
    await openEntry(second.id); report.states.kitchenRestoredMobile = await ui(second.configuration); await expand();
    await page.locator('#look-toward-me').click(); await settle(2); const beforeRemove = await owner(); assert.equal(beforeRemove.attention.phase, 'attending');
    await page.locator(`[data-remove-look="${second.id}"]`).click(); assert.equal((await collection()).looks.length, 1); assert.deepEqual(await owner(), beforeRemove);
    await page.locator('#undo-look').click(); assert.equal((await collection()).looks.length, 2); assert.deepEqual(await owner(), beforeRemove);
    await screenshot('saved-looks-mobile', true);
    check('fresh mobile navigation opens Original Kitchen with faithful UI; Remove/Undo preserves the live view and restores exact settings');
    writer = await context.newPage(); await writer.route('**/collection-writer', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><title>Storage event witness</title>' }));
    await writer.goto(server.baseUrl + '/collection-writer');
    await page.locator(`[data-remove-look="${first.id}"]`).click(); assert.equal(await page.locator('#undo-look').isVisible(), true);
    let data = await collection(); data.looks.push({ id: 'other-tab', name: '<b>From tab</b>', configuration: first.configuration }); await writeCollection(JSON.stringify(data));
    await page.waitForFunction(() => document.querySelector('[data-open-look="other-tab"]'));
    assert.equal(await page.locator('#undo-look').isHidden(), true); assert.deepEqual(await owner(), beforeRemove);
    const literal = page.locator('#saved-look-list li').filter({ has: page.locator('[data-open-look="other-tab"]') });
    assert.equal(await literal.locator('strong').textContent(), '<b>From tab</b>'); assert.equal(await literal.locator('b').count(), 0);
    check('real second-tab storage event refreshes plain-text names and retires stale Undo without changing the current avatar');
    data.looks.push({ id: 'unsupported', name: 'Older look', configuration: { hair: 'unsupported' } }); await writeCollection(JSON.stringify(data));
    await page.waitForFunction(() => document.querySelector('[data-open-look="unsupported"]'));
    assert.equal(await page.locator('[data-open-look="unsupported"]').isDisabled(), true);
    assert.match(await page.locator('#saved-description-unsupported').textContent(), /Unavailable/); assert.deepEqual(await owner(), beforeRemove);
    const validRaw = JSON.stringify(data); await writeCollection('{"version":2,"looks":[]}');
    await page.waitForFunction(() => document.querySelector('#collection-controls').disabled);
    assert.match(await page.locator('#collection-error').textContent(), /unavailable.*stored data was kept/);
    assert.equal(await page.locator('#save').isEnabled(), true); assert.deepEqual(await owner(), beforeRemove);
    assert.equal(await writer.evaluate(key => localStorage.getItem(key), SAVED_LOOKS_KEY), '{"version":2,"looks":[]}');
    await writeCollection(validRaw); await page.waitForFunction(() => !document.querySelector('#collection-controls').disabled);
    await page.evaluate(key => { window.originalStorageDescriptor = Object.getOwnPropertyDescriptor(window, 'localStorage'); Object.defineProperty(window, 'localStorage', { configurable: true, get() { throw new Error('Controlled storage access failure'); } }); dispatchEvent(new StorageEvent('storage', { key })); }, SAVED_LOOKS_KEY);
    report.states.storageFailure = await page.evaluate(() => ({ fieldsetDisabled: document.querySelector('#collection-controls').disabled,
        nameDisabled: document.querySelector('#saved-look-name').matches(':disabled'), error: document.querySelector('#collection-error').textContent }));
    assert.equal(report.states.storageFailure.fieldsetDisabled, true); assert.equal(report.states.storageFailure.nameDisabled, true);
    assert.equal(await page.locator('#saved-look-name').isDisabled(), true); assert.equal(await page.locator('#save').isEnabled(), true);
    assert.match(await page.locator('#collection-error').textContent(), /unavailable in this browser/); assert.deepEqual(await owner(), beforeRemove);
    await screenshot('storage-unavailable-mobile', true);
    await page.evaluate(key => { Object.defineProperty(window, 'localStorage', originalStorageDescriptor); dispatchEvent(new StorageEvent('storage', { key })); }, SAVED_LOOKS_KEY);
    await page.waitForFunction(() => !document.querySelector('#collection-controls').disabled);
    assert.equal(await page.evaluate(key => localStorage.getItem(key), SAVED_LOOKS_KEY), validRaw);
    check('unsupported saved options remain visibly unavailable; malformed collection and storage-access failures keep data and live viewer usable');
    const busy = await page.evaluate(async () => {
        let reject; const reading = new Promise((resolve, no) => { reject = no; }); const pending = showcase.openLook({ size: 20, text: () => reading });
        dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true }));
        const disabled = document.querySelector('#collection-controls').disabled; reject(new Error('Controlled pending file read')); await pending;
        return { disabled, recovered: !document.querySelector('#collection-controls').disabled };
    });
    assert.deepEqual(busy, { disabled: true, recovered: true }); assert.deepEqual(await owner(), beforeRemove);
    check('persisted-page refresh preserves pending file-read ownership and keeps collection controls disabled until the read recovers');
    assert.deepEqual(report.errors, []); assert.deepEqual(hashes(), report.sourceHashes);
    if (production) assert.deepEqual(builtHashes(), report.builtFileHashes);
    check('browser errors are empty and all recorded source/asset hashes stayed exact'); report.passed = true; save();
} catch (error) { report.error = error.stack; save(); await page?.screenshot({ path: path.join(out, 'failure.png'), fullPage: true }).catch(() => {}); throw error; }
finally { await context?.close(); await browser?.close(); await server?.close(); }
