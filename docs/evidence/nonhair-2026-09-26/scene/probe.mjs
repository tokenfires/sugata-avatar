// Serial scene probe using the existing, unchanged L1-L5 clauses and geometry-mask path.
// node docs/evidence/nonhair-2026-09-26/scene/probe.mjs <new-output-directory> [wall-hex]
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { startProbeServer, launchProbeBrowser } from '../../../../packages/core/src/render/MotionProbe.mjs';
import { runScene } from '../../../../tools/critic/scene-gates.mjs';
import { SCENES } from '../../../../packages/core/src/render/Scene.js';

const repo = fileURLToPath(new URL('../../../../', import.meta.url));
const out = path.resolve(process.argv[2] ?? '');
if (!process.argv[2] || fs.existsSync(out)) throw new Error('Provide a new evidence directory.');
const wall = process.argv[3];
if (wall !== undefined && !/^[0-9a-fA-F]{6}$/.test(wall)) throw new Error('wall must be six hex digits.');
fs.mkdirSync(out, { recursive: true });
const sources = ['packages/core/src/render/Scene.js', 'packages/core/src/render/InteriorEnvironment.js',
    'packages/core/src/Avatar.js', 'packages/core/src/render/LightingRig.js',
    'tools/critic/scene-gates.mjs', 'tools/critic/avatar-plate.html', 'tools/critic/GeometryMask.js',
    'assets/figures/figure_g050.glb'];
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const hashes = () => Object.fromEntries(sources.map(name => [name, sha(fs.readFileSync(path.join(repo, name)))]));
const report = { date: new Date().toISOString(), head: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: repo, encoding: 'utf8' }).trim(),
    sourceHashes: hashes(), wallOverride: wall ?? null, cases: [], errors: [],
    limits: ['Bald diagnostic portrait at 900x1200, fixed seed 1, frozen single simulation step.',
        'No complete clothed character, motion, alternate view or performance acceptance.',
        'A wall override changes the actual room and its environment bake; kitchen lighting is not held identical.'] };
const save = () => fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2) + '\n');
let server, browser;
try {
    server = await startProbeServer({ port: 5298 });
    browser = await launchProbeBrowser();
    // Each scene-gates arm owns its context. Observe every page without altering its rendering.
    const nativeNewContext = browser.newContext.bind(browser);
    browser.newContext = async (...args) => {
        const context = await nativeNewContext(...args);
        context.on('page', page => {
            page.on('pageerror', error => report.errors.push(error.message));
            page.on('console', message => { if (message.type() === 'error') report.errors.push(message.text()); });
            page.on('requestfailed', request => report.errors.push(request.url() + ' ' + request.failure()?.errorText));
            page.on('response', response => { if (response.status() >= 400) report.errors.push(response.status() + ' ' + response.url()); });
        });
        return context;
    };
    const url = server.baseUrl + '/@fs' + repo + 'tools/critic/avatar-plate.html';
    report.url = url;
    const cases = wall === undefined ? [{ scene: 'studio', label: 'studio' }, { scene: 'kitchen', label: 'kitchen' }]
        : [{ scene: 'kitchen', label: 'kitchen-wall-' + wall, extra: '&sceneover=' + encodeURIComponent(JSON.stringify({ room: { ...SCENES.kitchen.room, wall: parseInt(wall, 16) } })) }];
    for (const arm of cases) {
        report.cases.push(await runScene(browser, url, out, arm.scene, { ...arm, overlays: true }));
        save();
    }
    report.hashesStable = JSON.stringify(hashes()) === JSON.stringify(report.sourceHashes);
    report.images = Object.fromEntries(fs.readdirSync(out).filter(name => name.endsWith('.png')).map(name => [name, sha(fs.readFileSync(path.join(out, name)))]));
    report.complete = report.errors.length === 0 && report.hashesStable;
    save();
    if (!report.complete) throw new Error('Probe errors or source drift; inspect report.');
    console.log(JSON.stringify(report.cases.map(c => ({ scene: c.scene, clauses: c.clauses.map(x => ({ id: x.id, value: x.value, status: x.status })) }))));
} catch (error) { report.error = error.stack; save(); throw error; }
finally { await browser?.close(); await server?.close(); }
