import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { ROOT, collectSourceHashes, hashFile, sha256 } from '../../../../tools/figure-pipeline/collar_replacement_manifest.mjs';
import { startProbeServer, launchProbeBrowser } from '../../../../packages/core/src/render/MotionProbe.mjs';
const packet = path.dirname(fileURLToPath(import.meta.url)), raw = ROOT + '/captures/top-control-owned-2026-10-03-v1';
const stop = Date.parse('2026-10-03T23:25:00Z'), started = Date.now(), workEnd = Math.min(stop - 20000, started + 100000);
assert.ok(started < Date.parse('2026-10-03T23:13:00Z'), 'sole launch cutoff'); assert.ok(!fs.existsSync(raw), 'fresh single capture root');
const inputNames = ['PLAN.md', 'view.js', 'view.html', 'CRITIC-SOURCE.md', 'ROOT-PREFLIGHT.json'];
const inputs = Object.fromEntries(inputNames.map(n => [path.relative(ROOT, packet + '/' + n), hashFile(packet + '/' + n)]));
const protectedInputs = JSON.parse(fs.readFileSync(ROOT + '/docs/evidence/nonhair-2026-10-03/relaxed-top-source/INPUTS.json'));
for (const [n, h] of Object.entries(protectedInputs)) assert.equal(hashFile(ROOT + '/' + n), h, 'protected input ' + n);
fs.mkdirSync(raw, { recursive: true });
const source = fileURLToPath(import.meta.url), report = { pid: process.pid, started: new Date(started).toISOString(),
    command: 'node docs/evidence/nonhair-2026-10-03/top-control-owned/capture.mjs', stop: new Date(stop).toISOString(),
    status: 'running', instrumentSHA256: hashFile(source), sources: collectSourceHashes(ROOT), inputs, protectedInputs, images: [], reads: [], resources: [], errors: [], warnings: [], requests: [], cleanup: {},
    limits: 'Unchanged source-space form only; no new shape, texture/graphic/fabric, outward/thickness, native registration, Avatar, rig, full-body fit, motion or shipping appearance.' };
const save = () => fs.writeFileSync(raw + '/report.json', JSON.stringify(report, null, 2) + '\n');
for (const n of ['capture.mjs', 'view.js', 'view.html', 'PLAN.md']) fs.copyFileSync(packet + '/' + n, raw + '/' + n); save();
let timer, browser, server, page, failure; const reads = [];
const remaining = () => Math.max(1, workEnd - Date.now());
async function bounded(operation, label, cleanup = false) {
    // Sequential ownership: no cancellation race with a live acquisition.
    if (!cleanup) assert.ok(Date.now() < workEnd, label + ' work bound');
    const result = await operation();
    if (!cleanup) assert.ok(Date.now() < workEnd, label + ' completed beyond work bound');
    return result;
}
function controlSource() {
    const name = 'docs/evidence/nonhair-2026-10-03/capsule-source/inputs/male_casualsuit02/male_casualsuit02.obj';
    assert.equal(hashFile(ROOT + '/' + name), 'e07cbd1a43d21bd700e6598f01f74341a9dd66eac4e035c8be8de2650eac380f');
    const points = [], uv = [], faces = [];
    for (const [line, text] of fs.readFileSync(ROOT + '/' + name, 'utf8').split(/\r?\n/).entries()) {
        const w = text.trim().split(/\s+/);
        if (w[0] === 'v') { const p = w.slice(1).map(Number); assert.equal(p.length, 3); assert.ok(p.every(Number.isFinite)); points.push(p); }
        if (w[0] === 'vt') { const p = w.slice(1).map(Number); assert.equal(p.length, 2); assert.ok(p.every(Number.isFinite)); uv.push(p); }
        if (w[0] === 'f') {
            assert.equal(w.length, 5); const corners = w.slice(1).map(s => { const c = s.split('/').map(Number); assert.equal(c.length, 2); assert.ok(c.every(n => Number.isInteger(n) && n > 0)); return c.map(n => n - 1); });
            assert.equal(new Set(corners.map(c => c[0])).size, 4); faces.push({ sourceFace: faces.length, sourceLine: line + 1, corners });
        }
    }
    assert.equal(points.length, 2136); assert.equal(faces.length, 2060);
    const parent = points.map((_, i) => i), used = new Set();
    function find(v) { while (parent[v] !== v) { parent[v] = parent[parent[v]]; v = parent[v]; } return v; }
    for (const f of faces) for (const [v, t] of f.corners) { assert.ok(v < points.length && t < uv.length); used.add(v); parent[find(v)] = find(f.corners[0][0]); }
    assert.equal(used.size, points.length);
    const groups = new Map(); for (let i = 0; i < points.length; i++) { const root = find(i); if (!groups.has(root)) groups.set(root, []); groups.get(root).push(i); }
    const components = [...groups.values()].map(ids => ({ ids, maxY: Math.max(...ids.map(i => points[i][1])) })).sort((a, b) => b.maxY - a.maxY);
    assert.ok(components.length >= 2 && components[0].maxY - components[1].maxY >= .5); const ids = components[0].ids;
    assert.equal(ids.length, 1250); const selected = new Map(ids.map((id, i) => [id, i]));
    const chosen = faces.filter(f => selected.has(f.corners[0][0])); assert.equal(chosen.length, 1204);
    const textureIds = [...new Set(chosen.flatMap(f => f.corners.map(c => c[1])))].sort((a, b) => a - b), textureMap = new Map(textureIds.map((t, i) => [t, i]));
    const out = { sourcePath: name, sourceSHA256: hashFile(ROOT + '/' + name), components: components.map(c => ({ vertices: c.ids.length, maxY: c.maxY })),
        sourceVertices: ids.map(i => ({ sourceVertex: i, xyz: points[i] })), sourceUVIds: textureIds, sourceUV: textureIds.map(t => uv[t]),
        originalBounds: { minimum: [0, 1, 2].map(a => Math.min(...ids.map(i => points[i][a]))), maximum: [0, 1, 2].map(a => Math.max(...ids.map(i => points[i][a]))) },
        faces: chosen.map(f => ({ sourceFace: f.sourceFace, sourceLine: f.sourceLine, corners: f.corners.map(([v, t]) => { assert.ok(selected.has(v)); return [selected.get(v), textureMap.get(t)]; }) })) };
    fs.writeFileSync(raw + '/control.json', JSON.stringify(out) + '\n'); report.control = { file: 'control.json', sha256: hashFile(raw + '/control.json'), vertices: ids.length, quads: chosen.length, sourceSHA256: out.sourceSHA256 }; save();
    assert.deepEqual(JSON.parse(fs.readFileSync(raw + '/control.json')), out, 'saved source-control exact readback');
}
try {
    await bounded(async () => {
        controlSource(); server = await startProbeServer({ port: 5311 }); report.serverAcquiredUTC = new Date().toISOString(); save(); assert.ok(Date.now() < workEnd, 'server returned before work deadline'); assert.ok(new URL(server.baseUrl).port === '5311', 'declared isolated server');
        report.baseURL = server.baseUrl; save(); browser = await launchProbeBrowser(); report.browserAcquiredUTC = new Date().toISOString(); save(); assert.ok(Date.now() < workEnd, 'browser returned before work deadline'); page = await browser.newPage({ viewport: { width: 1000, height: 1000 }, deviceScaleFactor: 1 }); report.pageAcquiredUTC = new Date().toISOString(); save(); assert.ok(Date.now() < workEnd, 'page returned before work deadline');
        page.setDefaultTimeout(Math.min(30000, remaining()));
        const stamp = row => ({ ...row, utc: new Date().toISOString() });
        page.on('pageerror', e => { report.errors.push(stamp({ kind: 'pageerror', message: e.stack ?? e.message })); save(); });
        page.on('console', m => { if (m.type() === 'error') report.errors.push(stamp({ kind: 'console', message: m.text() })); if (m.type() === 'warning') report.warnings.push(stamp({ message: m.text() })); save(); });
        page.on('request', r => { report.requests.push(stamp({ url: r.url(), method: r.method() })); save(); });
        page.on('requestfailed', r => { report.resources.push(stamp({ url: r.url(), failure: r.failure() })); save(); });
        page.on('response', r => {
            if (r.status() >= 400) { report.resources.push(stamp({ url: r.url(), status: r.status() })); save(); }
            if (new URL(r.url()).pathname.endsWith('/control.json')) reads.push((async () => { const bytes = await r.body(); const row = stamp({ url: r.url(), status: r.status(), sha256: sha256(bytes), bytes: bytes.length }); report.reads.push(row); save(); assert.equal(row.sha256, report.control.sha256, 'actual served control bytes'); })().catch(e => { report.errors.push(stamp({ kind: 'control response', message: e.stack })); save(); }));
        });
        const url = server.baseUrl + '/@fs' + packet + '/view.html?' + new URLSearchParams({ data: '/@fs' + raw + '/control.json' }); report.requestedURL = url; save();
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: remaining() });
        await page.waitForFunction(() => window.__TOP_READY || window.__TOP_ERROR, null, { timeout: remaining() }); assert.equal(await page.evaluate(() => window.__TOP_ERROR ?? null), null);
        await page.waitForLoadState('networkidle', { timeout: remaining() }); await Promise.all(reads); assert.equal(report.reads.length, 1); assert.deepEqual(report.errors, []); assert.deepEqual(report.resources, []);
        for (let i = 0; i < 4; i++) {
            assert.ok(Date.now() < workEnd, 'capture work bound'); const { png, ...state } = await page.evaluate(i => window.__TOP.capture(i), i);
            const bytes = Buffer.from(png.split(',')[1], 'base64'), name = state.label + '.png'; fs.writeFileSync(raw + '/' + name, bytes);
            report.images.push({ file: name, sha256: sha256(bytes), bytes: bytes.length, state, encoding: 'one ordinary static render and same-task PNG' }); save();
            assert.equal(state.size.width, 900); assert.equal(state.size.height, 900); assert.equal(state.draw.triangles, 2408); assert.equal(state.draw.calls, 1);
            assert.deepEqual(state.modelMatrix, [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]); assert.deepEqual(report.errors, []); assert.deepEqual(report.resources, []);
        }
        assert.equal(report.images.length, 4); report.status = 'observed'; save();
    }, 'sole source/browser attempt');
} catch (e) { failure = e; report.errors.push({ kind: 'assertion', message: e.stack, utc: new Date().toISOString() }); report.status = 'failed'; save(); }
finally {
    try { if (page && !page.isClosed()) { report.retirement = await bounded(() => page.evaluate(() => window.__TOP_OWNER?.dispose() ?? null), 'source owner dispose', true); save(); } }
    catch (e) { failure ??= e; report.errors.push({ kind: 'retirement', message: e.stack }); }
    for (const [name, owner] of [['page', page], ['browser', browser], ['server', server]]) {
        try { if (owner) await bounded(() => owner.close(), name + ' close', true); report.cleanup[name] = owner ? 'closed' : 'not-created'; if (name === 'page' && owner) report.cleanup.pageIsClosed = owner.isClosed(); if (name === 'browser' && owner) report.cleanup.browserIsConnected = owner.isConnected(); save(); }
        catch (e) { failure ??= e; report.cleanup[name] = 'failed'; report.errors.push({ kind: 'cleanup', message: e.stack }); }
    }
    try { await bounded(() => Promise.all(reads), 'source reads drain', true); report.cleanup.readsDrained = reads.length; }
    catch (e) { failure ??= e; report.errors.push({ kind: 'read cleanup', message: e.stack }); }
    try {
        assert.deepEqual(collectSourceHashes(ROOT), report.sources); assert.equal(hashFile(source), report.instrumentSHA256);
        for (const [n, h] of Object.entries({ ...inputs, ...protectedInputs })) assert.equal(hashFile(ROOT + '/' + n), h, 'final input ' + n);
        assert.equal(report.retirement?.disposed, true); assert.equal(report.retirement.geometryEvents, 1); assert.equal(report.retirement.materialEvents, 1); assert.equal(report.retirement.sceneHasMesh, false); assert.deepEqual(report.retirement.errors, []); assert.equal(report.cleanup.pageIsClosed, true); assert.equal(report.cleanup.browserIsConnected, false);
        assert.deepEqual(report.errors, []); assert.deepEqual(report.resources, []); assert.equal(report.images.length, 4); assert.ok(Date.now() < stop); report.finalPinsUnchanged = true;
    } catch (e) { failure ??= e; report.errors.push({ kind: 'final gate', message: e.stack }); }
    report.artifacts = Object.fromEntries(fs.readdirSync(raw).filter(n => n !== 'report.json').map(n => [n, { sha256: hashFile(raw + '/' + n), bytes: fs.statSync(raw + '/' + n).size }]));
    if (failure || report.errors.length || report.resources.length) report.status = 'failed'; report.finished = new Date().toISOString(); save();
    console.log(JSON.stringify({ pid: process.pid, started: report.started, finished: report.finished, status: report.status, images: report.images.length, errors: report.errors.length, resources: report.resources.length, warnings: report.warnings.length, retirement: report.retirement, cleanup: report.cleanup, reportSHA256: hashFile(raw + '/report.json') }));
}
if (failure) throw failure;
