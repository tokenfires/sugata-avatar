// Native saved-list observation: same old summary, different actual colour recipes.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { ROOT, collectSourceHashes, hashFile, sha256 } from '../figure-pipeline/collar_replacement_manifest.mjs';
import { launchProbeBrowser } from '../../packages/core/src/render/MotionProbe.mjs';

const phase = process.argv[2];
assert.ok(['baseline', 'candidate'].includes(phase));
const version = process.argv[3] ?? 'v1';
assert.ok(['v1', 'v2'].includes(version));
const out = path.join(ROOT, `captures/saved-colour-recipe-2026-10-02-${phase}-${version}`);
assert.ok(!fs.existsSync(out));
fs.mkdirSync(out, { recursive: true });
const sources = collectSourceHashes(ROOT);
const report = { phase, started: new Date().toISOString(), pid: process.pid, sources,
    instrumentSHA256: hashFile(new URL(import.meta.url)), status: 'running', errors: [], warnings: [],
    assets: [], states: [], images: [], retirements: [] };
const save = () => fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2) + '\n');
fs.copyFileSync(new URL(import.meta.url), path.join(out, 'instrument.mjs'));
for (const file of ['showcase.js', 'showcase.html', 'showcase-saved-colours.mjs', 'showcase-saved-colours.css']) {
    const source = path.join(ROOT, 'packages/testbed/src', file);
    if (fs.existsSync(source)) fs.copyFileSync(source, path.join(out, file));
}
save();
let browser, page;
const reads = [];
async function ready() {
    await page.waitForFunction(() => window.showcase || !document.querySelector('#error').hidden, null, { timeout: 120000 });
    assert.equal(await page.locator('#error').textContent(), '');
    await page.evaluate(async () => {
        const a = showcase.avatar, frame = a.stage.renderer._nodes.nodeFrame;
        a.stage.renderer._animation.stop();
        frame.frameId = 0; frame.time = 0; frame.deltaTime = 0; frame.lastTime = undefined;
        a.stage.temporal?.resetFrameEpoch();
        showcase.controls.enableDamping = false;
        for (let i = 0; i < 98; i++) { frame.update(); frame.time = 0; frame.deltaTime = 0; await showcase.step(0); }
        frame.update(); frame.time = 0; frame.deltaTime = 0; a.stage.draw();
    });
}
async function shot(label) {
    await page.locator('#saved-look-list').scrollIntoViewIfNeeded();
    const file = label + '.png';
    await page.screenshot({ path: path.join(out, file) });
    report.images.push({ file, sha256: hashFile(path.join(out, file)), viewport: page.viewportSize() }); save();
}
try {
    browser = await launchProbeBrowser();
    page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1, reducedMotion: 'reduce' });
    page.on('pageerror', e => report.errors.push(e.message));
    page.on('console', m => { if (m.type() === 'error') report.errors.push(m.text()); if (m.type() === 'warning') report.warnings.push(m.text()); });
    page.on('response', response => {
        if (response.status() >= 400) report.errors.push(`${response.status()} ${response.url()}`);
        const url = new URL(response.url());
        if (response.ok() && url.pathname.endsWith('.glb') && !url.searchParams.has('import')) reads.push(response.body().then(bytes => {
            const file = url.pathname.slice(url.pathname.indexOf('/assets/') + 1);
            assert.equal(sha256(bytes), sources[file]); report.assets.push({ file, sha256: sha256(bytes) });
        }).catch(e => report.errors.push(e.stack)));
    });
    const params = new URLSearchParams({ preset: 'casual', frame: 'portrait', light: 'neutral', hairColour: '#413934',
        hairTintColour: '#8063ac', hairTintAmount: '.35', topColor: '#617a70', shoesColor: '#252a30', capture: '' });
    await page.goto(`http://127.0.0.1:5173/src/showcase.html?${params}`, { waitUntil: 'domcontentloaded' });
    await ready();
    const current = await page.evaluate(() => showcase.configuration());
    // Seed realistic old v1 records through the browser storage envelope, then use actual storage events/UI.
    const variants = [
        ['Sage violet', current],
        ['Rose teal', { ...current, hairTint: { colour: '#239c88', amount: .35 }, wardrobe: { ...current.wardrobe, colours: { top: '#b78383', shoes: '#623c28' } } }],
        ['Zero tint', { ...current, hairColour: '#765344', hairTint: { colour: '#ffffff', amount: 0 }, wardrobe: { ...current.wardrobe, colours: { bottom: '#444c69' } } }],
        ['Original', (() => { const c = { ...current, wardrobe: { ...current.wardrobe } }; delete c.hairColour; delete c.hairTint; delete c.wardrobe.colours; return c; })()],
        ['Future look', { ...current, future: true }]
    ];
    await page.evaluate(variants => {
        localStorage.setItem('sugata:showcase:saved-looks:v1', JSON.stringify({ version: 1, looks: variants.map(([name, configuration], i) => ({ id: `recipe-${i}`, name, configuration })) }));
        dispatchEvent(new StorageEvent('storage', { key: 'sugata:showcase:saved-looks:v1', storageArea: localStorage }));
        document.querySelector('#saved-looks').open = true;
        window.__recipeOwner = showcase.avatar;
    }, variants);
    const stored = await page.evaluate(() => localStorage.getItem('sugata:showcase:saved-looks:v1'));
    const rows = await page.locator('#saved-look-list > li').evaluateAll(rows => rows.map(row => ({ name: row.querySelector('strong').textContent,
        description: row.querySelector('small').textContent, recipe: row.querySelector('.saved-colour-recipe')?.textContent ?? null,
        chips: [...row.querySelectorAll('.saved-colour-chip')].map(c => ({ text: c.textContent, background: c.querySelector('.saved-colour-swatch').style.backgroundColor,
            decorative: c.querySelector('.saved-colour-swatch').getAttribute('aria-hidden') })), openDisabled: row.querySelector('[data-open-look]').disabled,
        openDescription: row.querySelector('[data-open-look]').getAttribute('aria-describedby')?.split(' ').map(id => document.getElementById(id)?.textContent).join(' ') })));
    assert.equal(rows.length, 5); assert.equal(rows[4].openDisabled, true);
    if (phase === 'baseline') assert.equal(rows[0].description, rows[1].description);
    else {
        assert.notEqual(rows[0].recipe, rows[1].recipe);
        for (const hex of ['#617a70', '#252a30', '#413934', '#8063ac']) assert.ok(rows[0].recipe.includes(hex));
        for (const hex of ['#b78383', '#623c28', '#239c88']) assert.ok(rows[1].recipe.includes(hex));
        assert.match(rows[2].recipe, /#765344/); assert.match(rows[2].recipe, /0%/); assert.match(rows[2].recipe, /#ffffff/);
        assert.equal(rows[3].recipe, null); assert.equal(rows[4].recipe, null);
        for (const row of rows) for (const chip of row.chips) assert.equal(chip.decorative, 'true');
        if (version === 'v2') for (const row of rows) if (row.recipe) assert.ok(row.openDescription.includes(row.recipe));
    }
    report.states.push({ label: 'desktop collection', rows, storedSHA256: sha256(stored), configuration: current });
    await shot('desktop-recipes');
    await page.setViewportSize({ width: 390, height: 844 });
    await shot('mobile-recipes');
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await page.locator('[data-open-look="recipe-0"]').focus();
    await page.keyboard.press('Tab');
    assert.equal(await page.locator('[data-rename-look="recipe-0"]').evaluate(e => e === document.activeElement), true);
    const unchanged = await page.evaluate(() => ({ owner: showcase.avatar === window.__recipeOwner, stored: localStorage.getItem('sugata:showcase:saved-looks:v1'), configuration: showcase.configuration() }));
    assert.equal(unchanged.owner, true); assert.equal(unchanged.stored, stored); assert.deepEqual(unchanged.configuration, current);
    const retirement = await page.evaluate(() => { showcase.attention.dispose(); showcase.controls.dispose(); showcase.avatar.dispose(); return showcase.avatar.report().disposal; });
    report.retirements.push(retirement); assert.equal(retirement.disposed, true); assert.deepEqual(retirement.leaked, []);
    await page.goto(`http://127.0.0.1:5173/src/showcase.html?capture`, { waitUntil: 'domcontentloaded' }); await ready();
    await page.evaluate(() => { document.querySelector('#saved-looks').open = true; });
    await Promise.all([page.waitForNavigation({ waitUntil: 'domcontentloaded' }), page.locator('[data-open-look="recipe-1"]').click()]);
    await ready();
    assert.deepEqual(await page.evaluate(() => showcase.configuration()), variants[1][1]);
    assert.equal(await page.evaluate(() => localStorage.getItem('sugata:showcase:saved-looks:v1')), stored);
    report.states.push({ label: 'saved Open roundtrip', configuration: await page.evaluate(() => showcase.configuration()) });
    await Promise.all(reads); assert.deepEqual(report.errors, []); assert.deepEqual(collectSourceHashes(ROOT), sources);
    report.status = 'passed';
} catch (e) { report.status = 'failed'; report.errors.push(e.stack); throw e; }
finally {
    if (page && !page.isClosed()) try { report.retirements.push(await page.evaluate(() => { showcase?.attention.dispose(); showcase?.controls.dispose(); showcase?.avatar.dispose(); return showcase?.avatar.report().disposal; })); } catch (e) { report.errors.push('Cleanup: ' + e.message); }
    report.finished = new Date().toISOString(); save(); await browser?.close();
}
console.log(JSON.stringify({ phase, status: report.status, reportSHA256: hashFile(path.join(out, 'report.json')) }));
