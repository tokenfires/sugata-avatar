// One owned native probe: direct named-recipe download without changing the preview.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { ROOT, collectSourceHashes, hashFile, sha256 } from '../figure-pipeline/collar_replacement_manifest.mjs';
import { launchProbeBrowser } from '../../packages/core/src/render/MotionProbe.mjs';

const out = path.join(ROOT, 'captures/saved-look-export-2026-10-02-v1');
assert.ok(!fs.existsSync(out), 'Preserve the single-probe output.');
fs.mkdirSync(out, {recursive: true});
const sources = collectSourceHashes(ROOT);
const report = {started: new Date().toISOString(), pid: process.pid, sources, instrumentSHA256: hashFile(new URL(import.meta.url)),
    status: 'running', errors: [], warnings: [], assets: [], states: [], downloads: [], images: [], retirements: []};
const save = () => fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2) + '\n');
fs.copyFileSync(new URL(import.meta.url), path.join(out, 'instrument.mjs'));
for (const file of ['showcase.js', 'showcase.html', 'showcase-collection.mjs', 'showcase-settings.mjs'])
    fs.copyFileSync(path.join(ROOT, 'packages/testbed/src', file), path.join(out, file));
save();
let browser, page, downloadEvents = 0;
const reads = [];
async function ready() {
    await page.waitForFunction(() => window.showcase || !document.querySelector('#error').hidden, null, {timeout: 120000});
    assert.equal(await page.locator('#error').textContent(), '');
    await page.evaluate(async () => {
        const a = showcase.avatar, frame = a.stage.renderer._nodes.nodeFrame;
        a.stage.renderer._animation.stop();
        frame.frameId = 0; frame.time = 0; frame.deltaTime = 0; frame.lastTime = undefined;
        a.stage.temporal?.resetFrameEpoch(); showcase.controls.enableDamping = false;
        for (let i = 0; i < 98; i++) {frame.update(); frame.time = 0; frame.deltaTime = 0; await showcase.step(0);}
        frame.update(); frame.time = 0; frame.deltaTime = 0; a.stage.draw();
    });
}
async function shot(label) {
    await page.locator('#saved-look-list').scrollIntoViewIfNeeded();
    const file = `${label}.png`; await page.screenshot({path: path.join(out, file)});
    report.images.push({file, sha256: hashFile(path.join(out, file)), viewport: page.viewportSize()});
    const listFile = `${label}-complete-list.png`; await page.locator('#saved-look-list').screenshot({path: path.join(out, listFile)});
    report.images.push({file: listFile, sha256: hashFile(path.join(out, listFile)), viewport: page.viewportSize(), region: 'complete saved list'}); save();
}
async function download(id, label) {
    const [result] = await Promise.all([page.waitForEvent('download'), page.locator(`[data-download-look="${id}"]`).click()]);
    assert.equal(await result.failure(), null);
    const file = `${label}.json`; await result.saveAs(path.join(out, file));
    const text = fs.readFileSync(path.join(out, file), 'utf8');
    assert.ok(text.endsWith('\n')); assert.ok(Buffer.byteLength(text) < 16 * 1024);
    report.downloads.push({id, file, suggestedFilename: result.suggestedFilename(), url: result.url(), bytes: Buffer.byteLength(text), sha256: sha256(text), configuration: JSON.parse(text)});
    save(); return report.downloads.at(-1);
}
async function retire() {
    const r = await page.evaluate(() => {showcase.attention.dispose(); showcase.controls.dispose(); showcase.avatar.dispose(); return showcase.avatar.report().disposal;});
    report.retirements.push(r); assert.equal(r.disposed, true); assert.deepEqual(r.leaked, []);
}
try {
    browser = await launchProbeBrowser();
    page = await browser.newPage({viewport: {width: 1440, height: 1000}, deviceScaleFactor: 1, reducedMotion: 'reduce', acceptDownloads: true});
    page.on('download', () => downloadEvents++);
    page.on('pageerror', error => report.errors.push(error.message));
    page.on('console', message => {if (message.type() === 'error') report.errors.push(message.text()); if (message.type() === 'warning') report.warnings.push(message.text());});
    page.on('response', response => {
        if (response.status() >= 400) report.errors.push(`${response.status()} ${response.url()}`);
        const url = new URL(response.url());
        if (response.ok() && url.pathname.endsWith('.glb') && !url.searchParams.has('import')) reads.push(response.body().then(bytes => {
            const file = url.pathname.slice(url.pathname.indexOf('/assets/') + 1);
            assert.equal(sha256(bytes), sources[file]); report.assets.push({file, sha256: sha256(bytes)});
        }).catch(error => report.errors.push(error.stack)));
    });
    const params = new URLSearchParams({preset: 'casual', frame: 'portrait', light: 'neutral', hairColour: '#413934',
        hairTintColour: '#8063ac', hairTintAmount: '.35', topColor: '#617a70', shoesColor: '#252a30', capture: ''});
    await page.goto(`http://127.0.0.1:5173/src/showcase.html?${params}`, {waitUntil: 'domcontentloaded'}); await ready();
    const current = await page.evaluate(() => showcase.configuration()), startingUrl = page.url();
    const rose = {...current, hairTint: {colour: '#239c88', amount: .35}, wardrobe: {...current.wardrobe, colours: {top: '#b78383', shoes: '#623c28'}}};
    const original = {...current, wardrobe: {...current.wardrobe}}; delete original.hairColour; delete original.hairTint; delete original.wardrobe.colours;
    const records = [
        {id: 'sage', name: 'Sage violet', configuration: current},
        {id: 'rose', name: 'Rose teal', configuration: rose},
        {id: 'original', name: 'Original', configuration: original},
        {id: 'portable', name: '日常 / <soft>: "rose" \\ ?* | .', configuration: rose},
        {id: 'future', name: 'Future look', configuration: {...current, future: true}}
    ];
    const stored = JSON.stringify({version: 1, looks: records});
    await page.evaluate(raw => {
        localStorage.setItem('sugata:showcase:saved-looks:v1', raw);
        dispatchEvent(new StorageEvent('storage', {key: 'sugata:showcase:saved-looks:v1', storageArea: localStorage}));
        document.querySelector('#saved-looks').open = true; window.__exportOwner = showcase.avatar;
    }, stored);
    const rows = await page.locator('#saved-look-list > li').evaluateAll(rows => rows.map(row => ({name: row.querySelector('strong').textContent,
        buttons: [...row.querySelectorAll('button')].map(button => ({text: button.textContent, label: button.getAttribute('aria-label'), disabled: button.disabled,
            descriptions: button.getAttribute('aria-describedby')?.split(' ').map(id => document.getElementById(id)?.textContent).join(' ')}))})));
    assert.equal(rows.length, 5); assert.deepEqual(rows[0].buttons.map(button => button.text), ['Open', 'Rename', 'Download JSON', 'Remove']);
    assert.equal(rows[4].buttons[2].disabled, true); assert.equal(rows[1].buttons[2].label, 'Download JSON for saved look Rose teal'); assert.ok(rows[1].buttons[2].descriptions.includes('#239c88'));
    report.states.push({label: 'rendered actions', rows}); await shot('desktop-saved-export');
    await page.setViewportSize({width: 390, height: 844}); await shot('mobile-saved-export');
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    const boxes = await page.locator('#saved-look-list > li:first-child button').evaluateAll(buttons => buttons.map(button => {const r = button.getBoundingClientRect(); return {x: r.x, y: r.y, width: r.width, height: r.height};}));
    assert.equal(boxes[0].y, boxes[1].y); assert.equal(boxes[2].y, boxes[3].y); assert.ok(boxes[2].y > boxes[0].y); assert.ok(boxes.every(box => box.height >= 44 && box.width >= 140));
    await page.locator('[data-open-look="sage"]').focus();
    for (const selector of ['[data-rename-look="sage"]', '[data-download-look="sage"]', '[data-remove-look="sage"]']) {
        await page.keyboard.press('Tab'); assert.equal(await page.locator(selector).evaluate(element => element === document.activeElement), true);
    }
    const exportedRose = await download('rose', 'rose-settings'); assert.equal(exportedRose.suggestedFilename, 'sugata-Rose teal.json'); assert.deepEqual(exportedRose.configuration, rose);
    const exportedOriginal = await download('original', 'original-settings'); assert.deepEqual(exportedOriginal.configuration, original);
    const portable = await download('portable', 'portable-name-settings'); assert.deepEqual(portable.configuration, rose);
    assert.ok(portable.suggestedFilename.startsWith('sugata-日常')); assert.ok(!/[<>:"/\\|?*]/.test(portable.suggestedFilename));
    const unchanged = await page.evaluate(() => ({owner: showcase.avatar === window.__exportOwner, stored: localStorage.getItem('sugata:showcase:saved-looks:v1'), configuration: showcase.configuration()}));
    assert.equal(unchanged.owner, true); assert.equal(unchanged.stored, stored); assert.deepEqual(unchanged.configuration, current); assert.equal(page.url(), startingUrl);
    report.states.push({label: 'three direct downloads preserve preview', ...unchanged, storedSHA256: sha256(stored), url: page.url(), boxes});
    const expectedDownloads = downloadEvents;
    await page.locator('[data-download-look="future"]').evaluate(element => element.click());
    await page.evaluate(() => {
        const key = 'sugata:showcase:saved-looks:v1', data = JSON.parse(localStorage.getItem(key));
        data.looks.find(item => item.id === 'rose').configuration.hairTint.amount = .6; localStorage.setItem(key, JSON.stringify(data));
        // Deliberately no storage event: exercise the stale displayed-record guard.
    });
    const changedRaw = await page.evaluate(() => localStorage.getItem('sugata:showcase:saved-looks:v1'));
    await page.locator('[data-download-look="rose"]').click(); assert.match(await page.locator('#collection-error').textContent(), /changed.*Review it before downloading/);
    assert.equal(await page.evaluate(() => localStorage.getItem('sugata:showcase:saved-looks:v1')), changedRaw);
    await page.evaluate(() => {
        const key = 'sugata:showcase:saved-looks:v1', data = JSON.parse(localStorage.getItem(key)); data.looks = data.looks.filter(item => item.id !== 'original'); localStorage.setItem(key, JSON.stringify(data));
    });
    const removedRaw = await page.evaluate(() => localStorage.getItem('sugata:showcase:saved-looks:v1'));
    await page.locator('[data-download-look="original"]').click(); assert.match(await page.locator('#collection-error').textContent(), /removed/);
    assert.equal(await page.evaluate(() => localStorage.getItem('sugata:showcase:saved-looks:v1')), removedRaw);
    // Handlers complete synchronously; a bounded observation catches any asynchronous download event too.
    const unexpected = await page.waitForEvent('download', {timeout: 750}).catch(error => {if (error.name === 'TimeoutError') return null; throw error;});
    assert.equal(unexpected, null); assert.equal(downloadEvents, expectedDownloads);
    assert.equal(await page.evaluate(() => showcase.avatar === window.__exportOwner), true); assert.deepEqual(await page.evaluate(() => showcase.configuration()), current);
    report.states.push({label: 'unsupported/stale/removed no download', downloadEvents, changedRawSHA256: sha256(changedRaw), removedRawSHA256: sha256(removedRaw), error: await page.locator('#collection-error').textContent()});
    await retire();
    await page.goto('http://127.0.0.1:5173/src/showcase.html?capture', {waitUntil: 'domcontentloaded'}); await ready();
    await Promise.all([page.waitForNavigation({waitUntil: 'domcontentloaded'}), page.locator('#settings-file').setInputFiles(path.join(out, exportedRose.file))]); await ready();
    assert.deepEqual(await page.evaluate(() => showcase.configuration()), rose);
    assert.equal(await page.evaluate(() => localStorage.getItem('sugata:showcase:saved-looks:v1')), removedRaw);
    report.states.push({label: 'downloaded file Open settings roundtrip', configuration: await page.evaluate(() => showcase.configuration())});
    await Promise.all(reads); assert.deepEqual(report.errors, []); assert.deepEqual(collectSourceHashes(ROOT), sources); report.status = 'passed';
} catch (error) {report.status = 'failed'; report.errors.push(error.stack); throw error;}
finally {
    if (page && !page.isClosed()) try {await retire();} catch (error) {report.errors.push('Cleanup: ' + error.message);}
    try {await browser?.close();} catch (error) {report.errors.push('Browser cleanup: ' + error.message);}
    if (report.errors.length) report.status = 'failed';
    report.finished = new Date().toISOString(); save();
}
console.log(JSON.stringify({status: report.status, reportSHA256: hashFile(path.join(out, 'report.json'))}));
if (report.status !== 'passed') process.exitCode = 2;
