import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { startProbeServer, launchProbeBrowser } from '../../../../packages/core/src/render/MotionProbe.mjs';
import { runNativeLifecycle } from './native-lifecycle.mjs';

const root = fileURLToPath(new URL('../../../../', import.meta.url)), out = process.argv[2] && path.resolve(process.argv[2]);
assert.ok(out && !fs.existsSync(out), 'Fresh output directory required'); fs.mkdirSync(out, { recursive: true });
const sha = b => createHash('sha256').update(b).digest('hex');
const walk = d => fs.readdirSync(d, { withFileTypes: true }).flatMap(e => { const f = path.join(d, e.name); return e.isDirectory() ? walk(f) : [path.relative(root, f)]; });
const files = [...walk(root + 'packages/core/src'), ...walk(root + 'assets'),
    ...['portrait.html', 'portrait.js', 'portrait-selection.mjs', 'viewer-framing.mjs', 'viewer-scenes.mjs'].map(p => 'packages/testbed/src/' + p),
    ...['run-native-lifecycle.mjs', 'native-lifecycle.mjs', 'capture-runtime.mjs', 'ExpressionStudyArm.mjs'].map(p => 'docs/evidence/nonhair-2026-09-26/expression-next/' + p),
    'tools/figure-pipeline/collar_capture_browser.mjs', 'node_modules/three/package.json', 'package.json', 'package-lock.json', 'vite.config.js'];
const hashes = () => Object.fromEntries(files.sort().map(p => [p, sha(fs.readFileSync(root + p))]));
const report = { startedAt: new Date().toISOString(), sources: hashes(), errors: [], completed: false };
const save = () => fs.writeFileSync(out + '/report.json', JSON.stringify(report, null, 2) + '\n');
let browser, server;
try {
    server = await startProbeServer({ port: 5384 }); browser = await launchProbeBrowser(); report.browser = browser.version();
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1, reducedMotion: 'no-preference' });
    page.on('pageerror', e => report.errors.push({ kind: 'pageerror', message: e.message }));
    page.on('console', m => { if (m.type() === 'error') report.errors.push({ kind: 'console', message: m.text() }); });
    page.on('requestfailed', r => report.errors.push({ kind: 'network', url: r.url(), error: r.failure()?.errorText }));
    page.on('response', r => { if (r.status() >= 400) report.errors.push({ kind: 'http', status: r.status(), url: r.url() }); });
    await page.goto(server.baseUrl + '/src/portrait.html?capture=expression-lifecycle&bake=g050&hair=bob02&scene=studio');
    await page.waitForFunction(() => window.portrait || !document.querySelector('#error').hidden, null, { timeout: 120000 });
    assert.equal(await page.locator('#error').textContent(), '');
    report.result = await runNativeLifecycle(page); save();
    assert.equal(report.result.completed, true, JSON.stringify(report.result.error));
    assert.equal(report.result.noStudyLayers, true); assert.equal(report.result.final.disposal.disposed, true);
    assert.deepEqual(report.result.final.disposal.leaked, []); assert.ok(Object.values(report.result.final.memory).every(v => v === 0));
    assert.deepEqual(report.errors, []); report.finalSources = hashes(); assert.deepEqual(report.finalSources, report.sources);
    report.completed = true; save(); console.log('PASS native expression lifecycle: ' + report.result.checks.length + ' groups');
} catch (e) { report.failure = e.stack; save(); throw e; }
finally { await browser?.close(); await server?.close(); }
