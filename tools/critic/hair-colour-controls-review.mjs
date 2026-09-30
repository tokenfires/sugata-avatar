import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { startProbeServer, launchProbeBrowser } from '../../packages/core/src/render/MotionProbe.mjs';
import { HAIR_COLOURS, hexToHsl, hslToHex } from '../../packages/testbed/src/showcase-hair-colours.mjs';
import { resolveHairColour } from '../../packages/core/src/material/HairColourOptions.js';
import { optionsForShowcase, resolveShowcaseSelection } from '../../packages/testbed/src/showcase-presets.mjs';
import { selectionFromConfiguration, showcaseSettingsUrl } from '../../packages/testbed/src/showcase-settings.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
const output = path.join(root, process.argv.find(x => x.startsWith('--out='))?.slice(6) ?? 'captures/hair-colour-controls/ui-v1');
fs.mkdirSync(output, { recursive: true });
assert.ok(!fs.existsSync(path.join(output, 'report.json')));
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const sources = ['tools/critic/hair-colour-controls-review.mjs', 'packages/core/src/Avatar.js',
    'packages/core/src/material/HairMaterial.js', 'packages/core/src/material/HairColourOptions.js',
    'packages/testbed/src/showcase.js', 'packages/testbed/src/showcase.html',
    'packages/testbed/src/showcase-hair-colours.mjs', 'packages/testbed/src/showcase-hair-colours.css',
    'packages/testbed/src/showcase-settings.mjs', 'packages/testbed/src/showcase-presets.mjs', 'packages/testbed/src/showcase-collection.mjs'];
const hashes = () => Object.fromEntries(sources.map(p => [p, sha(fs.readFileSync(path.join(root, p)))]));
const report = { started: new Date().toISOString(), pid: process.pid, status: 'running', sourceHashes: hashes(), checks: [], images: [], states: [], errors: [] };
const save = () => fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify(report, null, 2) + '\n');
for (const p of sources) { const dest = path.join(output, 'source', p); fs.mkdirSync(path.dirname(dest), { recursive: true }); fs.copyFileSync(path.join(root, p), dest); }
function check(name, callback) { callback(); report.checks.push(name); save(); }
check('Strict input normalization and invalid-value rejection', () => {
    assert.equal(resolveHairColour(undefined), null); assert.equal(resolveHairColour('#AbCdEf'), '#abcdef');
    for (const v of [null, '', '#fff', 'red', 0x765344, {}, '#123456ff', ' #123456', '#00000g']) assert.throws(() => resolveHairColour(v));
    for (const query of ['hairColour=x', 'hairColour=%23765344&hairColour=%23000000', 'hairColour='])
        assert.throws(() => resolveShowcaseSelection(new URLSearchParams(query)));
});
check('All starting shades round-trip through strict settings and URLs, preserving omission', () => {
    for (const preset of ['casual', 'elegant']) for (const hex of [undefined, ...HAIR_COLOURS.map(c => c.hex), '#000000', '#ffffff', '#7654ba']) {
        const selection = resolveShowcaseSelection(new URLSearchParams({preset, ...(hex ? {hairColour: hex} : {})}));
        const config = optionsForShowcase(selection), reopened = selectionFromConfiguration(config);
        assert.deepEqual(optionsForShowcase(reopened), config);
        assert.deepEqual(resolveShowcaseSelection(showcaseSettingsUrl(reopened, 'http://localhost/src/showcase.html').searchParams), selection);
        assert.equal(Object.hasOwn(config, 'hairColour'), hex !== undefined);
        if (hex) assert.equal(hslToHex(hexToHsl(hex)), hex);
    }
});
let server, browser, page;
const errors = [];
async function ready() {
    await page.waitForFunction(() => window.showcase || !document.querySelector('#error').hidden, null, { timeout: 120000 });
    assert.equal(await page.locator('#error').textContent(), '');
    await page.evaluate(() => {
        const a = showcase.avatar, dispose = a.dispose.bind(a);
        a.dispose = () => {
            dispose();
            const old = JSON.parse(sessionStorage.getItem('hair-review-disposals') ?? '[]');
            old.push({ url: location.href, disposal: a.report().disposal });
            sessionStorage.setItem('hair-review-disposals', JSON.stringify(old));
        };
    });
}
async function state(label) {
    const value = await page.evaluate(() => ({ configuration: showcase.configuration(), colour: showcase.avatar.report().hair.colour,
        url: location.href, backend: showcase.avatar.stage.backendName }));
    assert.equal(value.backend, 'webgpu'); assert.equal(value.colour.matchesAttached, true);
    report.states.push({ label, ...value }); save(); return value;
}
async function screenshot(label, mobile = false) {
    await page.evaluate(async () => {
        const a = showcase.avatar, f = a.stage.renderer._nodes.nodeFrame;
        a.stage.renderer._animation.stop(); f.frameId = 0; f.time = 0; f.deltaTime = 0; f.lastTime = undefined;
        a.stage.temporal?.resetFrameEpoch();
        for (let i = 0; i < 98; i++) { f.update(); f.time = 0; f.deltaTime = 0; await showcase.step(0); }
    });
    const file = `${label}.png`; await page.screenshot({ path: path.join(output, file), fullPage: true });
    report.images.push({file, sha256: sha(fs.readFileSync(path.join(output, file))), mobile}); save();
}
async function apply() {
    await Promise.all([page.waitForNavigation({ waitUntil: 'domcontentloaded' }), page.locator('#apply-hair-colour').click()]);
    await ready();
}
async function openColours() { await page.locator('#hair-colours').evaluate(e => { e.open = true; }); }
try {
    server = await startProbeServer({ port: 5298 }); browser = await launchProbeBrowser();
    page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1, reducedMotion: 'reduce' });
    page.on('pageerror', e => errors.push(e.message));
    page.on('response', r => { if (r.status() >= 400) errors.push(`${r.status()} ${r.url()}`); });
    const initial = `${server.baseUrl}/src/showcase.html?preset=casual&outfit=elegant&style=charcoal&frame=portrait&light=warm&capture=`;
    await page.goto(initial, { waitUntil: 'domcontentloaded' }); await ready(); await openColours();
    const original = await state('Original');
    assert.equal(Object.hasOwn(original.configuration, 'hairColour'), false);
    const derived = await page.evaluate(async root => (await import(`/@fs/${root}packages/core/src/material/HairMaterial.js`)).baseColourDerivation().linear, root);
    assert.deepEqual(original.colour.linear, derived);
    assert.equal(await page.locator('#hair-tint-controls').isVisible(), false);
    await screenshot('desktop-original');
    await page.locator('#hair-shade').selectOption(HAIR_COLOURS.find(c => c.label === 'Brown').hex);
    assert.equal(await page.locator('#hair-tint-controls').isVisible(), true);
    assert.deepEqual((await state('Brown draft unapplied')).configuration, original.configuration);
    await page.locator('#hair-lightness').focus(); await page.locator('#hair-lightness').press('Home');
    for (let i = 0; i < 11; i++) await page.locator('#hair-lightness').press('ArrowRight');
    assert.equal(await page.locator('#hair-lightness').inputValue(), '11');
    // Keyboard End followed by left arrows proves the lightness control responds without a synthetic input.
    await page.locator('#hair-lightness').press('End');
    for (let i = 0; i < 45; i++) await page.locator('#hair-lightness').press('ArrowLeft');
    assert.equal(await page.locator('#hair-lightness').inputValue(), '55');
    const custom = await page.locator('#hair-colour').inputValue();
    await screenshot('desktop-draft'); await apply(); await openColours();
    const applied = await state('Lightness applied');
    assert.deepEqual(applied.configuration, { ...original.configuration, hairColour: custom });
    assert.equal(await page.locator('#hair-shade').inputValue(), 'custom');
    await screenshot('desktop-applied');
    const downloadPromise = page.waitForEvent('download'); await page.locator('#save').click();
    const download = await downloadPromise; await download.saveAs(path.join(output, 'saved-look.json'));
    assert.deepEqual(JSON.parse(fs.readFileSync(path.join(output, 'saved-look.json'))), applied.configuration);
    await page.locator('#saved-looks').evaluate(e => { e.open = true; });
    await page.locator('#saved-look-name').fill('Light brown overnight'); await page.locator('#save-local-look').click();
    assert.equal(await page.locator('[data-open-look]').count(), 1);
    const local = await page.evaluate(() => JSON.parse(localStorage.getItem('sugata:showcase:saved-looks:v1')));
    assert.deepEqual(local.looks[0].configuration, applied.configuration);
    await Promise.all([page.waitForNavigation({waitUntil:'domcontentloaded'}), page.locator('[data-preset=elegant]').click()]); await ready();
    assert.equal((await state('Other haircut')).configuration.hairColour, custom);
    assert.equal((await state('Other haircut attached')).configuration.hair, 'bob01');
    await Promise.all([page.waitForNavigation({waitUntil:'domcontentloaded'}), page.locator('#settings-file').setInputFiles(path.join(output, 'saved-look.json'))]); await ready();
    assert.deepEqual((await state('JSON reopened')).configuration, applied.configuration);
    await openColours(); await page.locator('#hair-shade').selectOption('original'); await apply(); await openColours();
    const restored = await state('Original restored'); assert.deepEqual(restored.configuration, original.configuration); assert.deepEqual(restored.colour.linear, derived);
    await page.locator('#saved-looks').evaluate(e => { e.open = true; });
    await Promise.all([page.waitForNavigation({waitUntil:'domcontentloaded'}), page.locator('[data-open-look]').click()]); await ready();
    assert.deepEqual((await state('Named look reopened')).configuration, applied.configuration);
    await openColours();
    await page.locator('#hair-shade').selectOption('custom');
    await page.locator('#hair-colour').fill('#365a78');
    assert.equal(await page.locator('#hair-colour-value').textContent(), '#365a78');
    assert.deepEqual((await state('Picker draft unapplied')).configuration, applied.configuration);
    await apply(); await openColours();
    const tinted = await state('Picker applied'); assert.equal(tinted.configuration.hairColour, '#365a78');
    await Promise.all([page.waitForNavigation({waitUntil:'domcontentloaded'}), page.locator('[data-scene=kitchen]').click()]); await ready();
    assert.equal((await state('Kitchen preserved colour')).configuration.hairColour, '#365a78');
    await page.locator('[data-outfit=casual]').click();
    await page.waitForFunction(() => document.querySelector('[data-outfit=casual]').getAttribute('aria-pressed') === 'true' && !document.querySelector('#outfit-controls').disabled);
    assert.equal((await state('Outfit preserved colour')).configuration.hairColour, '#365a78');
    await page.setViewportSize({width:390,height:844}); await openColours(); await screenshot('mobile-applied', true);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    const invalid = await page.evaluate(async root => {
        const {Avatar} = await import(`/@fs/${root}packages/core/src/Avatar.js`); const values = [];
        for (const options of [{hair:false,hairColour:'#765344'}, {hair:'bob02',hairColour:'red'}]) {
            try { const a = await Avatar.create({canvas:document.createElement('canvas'),...options}); a.dispose(); values.push('unexpected-success'); }
            catch(e) { values.push(e.message); }
        }
        return values;
    }, root);
    assert.match(invalid[0], /requires a hair style/); assert.match(invalid[1], /six-digit/); report.invalidSdk = invalid;
    report.nonUniform = await page.evaluate(() => {
        const a = showcase.avatar, original = a.hairMaterial.hair.baseColour;
        try {
            a.hairMaterial.hair.baseColour = {isNode: true};
            const colour = a.report().hair.colour;
            let exportError = null; try { showcase.configuration(); } catch (error) { exportError = error.message; }
            return {colour, exportError};
        } finally { a.hairMaterial.hair.baseColour = original; }
    });
    assert.equal(report.nonUniform.colour.linear, null); assert.equal(report.nonUniform.colour.matchesAttached, false);
    assert.match(report.nonUniform.exportError, /attached hair colour/);
    await page.evaluate(() => showcase.avatar.dispose());
    report.disposals = await page.evaluate(() => JSON.parse(sessionStorage.getItem('hair-review-disposals')));
    assert.ok(report.disposals.every(d => d.disposal.disposed));
    report.checks.push('Native draft, keyboard lightness, Apply, exact Original restore, both cuts, JSON download/open, named look save/open, mobile overflow and SDK rejection');
    assert.deepEqual(errors, []); assert.deepEqual(hashes(), report.sourceHashes);
    report.status = 'captured';
} catch (error) { report.status = 'failed'; report.errors.push(error.stack); throw error; }
finally { report.browserErrors = errors; report.finished = new Date().toISOString(); save(); await browser?.close(); await server?.close(); }
