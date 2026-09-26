// CPU --preflight is safe. --primary-only/--views-only require an explicitly granted GPU slot.
// node .../hand-attribution-capture.mjs MANIFEST FRESH_OUT --preflight|--primary-only|--views-only [SEALED_PRIMARY_DIR]
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { gzipSync, gunzipSync } from 'node:zlib';
import { isDeepStrictEqual } from 'node:util';
import { execFileSync } from 'node:child_process';
import { ROOT, DIRECTORY, BASE, CASE, ARMS, PHASES, TIMING, VIEWS, CAMERA, SPEECH_PLAN, CAPTURE_ASSETS, hashFile, sha256, validate, baseline, baseSteps, scheduleSampling } from './hand-attribution-manifest.mjs';
const [manifestPath, outputPath, mode, primaryPath] = process.argv.slice(2);
assert.ok(['--preflight', '--primary-only', '--views-only'].includes(mode), 'explicit capture mode required');
assert.equal(process.argv.length, mode === '--views-only' ? 6 : 5);
const manifestBytes = fs.readFileSync(manifestPath), manifest = validate(JSON.parse(manifestBytes)), manifestSHA256 = sha256(manifestBytes);
const out = path.resolve(outputPath); assert.equal(fs.existsSync(out), false, 'Fresh output only');
const old = baseline(), oldRun = old.run, oldSnapshots = new Map(TIMING.oldGeometrySteps.map(step => {
    const item = oldRun.geometry.find(x => x.step === step), bytes = fs.readFileSync(path.join(ROOT, BASE, item.file)), raw = gunzipSync(bytes);
    assert.equal(sha256(bytes), item.sha256); assert.equal(sha256(raw), item.decodedSHA256); return [step, JSON.parse(raw)];
}));
const recordRaw = (file, value) => { const raw = JSON.stringify(value), bytes = gzipSync(raw); fs.mkdirSync(path.dirname(path.join(out, file)), { recursive: true }); fs.writeFileSync(path.join(out, file), bytes, { flag: 'wx' }); return { file, sha256: sha256(bytes), decodedSHA256: sha256(raw) }; };
const readBound = (directory, item) => { const bytes = fs.readFileSync(path.join(directory, item.file)); assert.equal(sha256(bytes), item.sha256, item.file); const raw = gunzipSync(bytes); assert.equal(sha256(raw), item.decodedSHA256); return JSON.parse(raw); };
const pose = geometry => ({ time: geometry.time, rig: geometry.rig, meshes: geometry.meshes });
const digestPose = geometry => ({ clock: geometry.time, rigSHA256: sha256(JSON.stringify(geometry.rig)), meshes: Object.fromEntries(geometry.meshes.map(m => [m.id, {
    positionsSHA256: sha256(JSON.stringify(m.positions)), fullIndicesSHA256: sha256(JSON.stringify(m.fullIndices)), drawnIndicesSHA256: sha256(JSON.stringify(m.drawnIndices)) }])) });
let primary = null; const primaryStates = new Map();
if (mode === '--views-only') {
    const seal = JSON.parse(fs.readFileSync(path.join(primaryPath, 'seal.json'))), bytes = fs.readFileSync(path.join(primaryPath, 'report.json'));
    assert.equal(sha256(bytes), seal.reportSHA256, 'primary report is not its sealed version'); primary = JSON.parse(bytes);
    assert.equal(primary.mode, 'primary'); assert.equal(primary.completed, true); assert.equal(primary.manifestSHA256, manifestSHA256);
    assert.deepEqual(primary.runs.map(r => r.arm), ARMS); assert.ok(primary.runs.every(r => r.completed));
    assert.deepEqual(primary.sourceHashes, manifest.sourceHashes);
    for (const run of primary.runs) { primaryStates.set(run.arm, readBound(primaryPath, run.states)); for (const item of run.geometry) readBound(primaryPath, item); }
}
fs.mkdirSync(out, { recursive: true }); fs.writeFileSync(path.join(out, 'manifest.json'), manifestBytes, { flag: 'wx' });
const free = fs.statfsSync(out), freeBytes = Number(free.bavail) * Number(free.bsize);
const report = { version: 1, studyId: manifest.studyId, createdAt: new Date().toISOString(), mode: mode === '--views-only' ? 'views' : mode === '--primary-only' ? 'primary' : 'preflight',
    completed: false, head: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT, encoding: 'utf8' }).trim(), manifestSHA256, sourceHashes: manifest.sourceHashes,
    baseline: manifest.baseline, sourceFreeze: [], disk: { freeBytes, minimumFreeBytes: 4 * 1024 ** 3 }, runs: [],
    primaryBinding: primary ? { directory: primaryPath, reportSHA256: hashFile(path.join(primaryPath, 'report.json')) } : null,
    scope: 'New A/B/C prefix attribution only. Primary preserves historical camera/draw history; views are separate fresh passes with discrete pose/owner parity. No solver, fit/clearance approval, owner-causality conclusion, continuous collision or hair qualification.' };
const save = () => fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2) + '\n'); save();
if (mode === '--preflight') { report.completed = true; report.preflightOnly = true; report.planned = manifest.planned; save(); console.log(JSON.stringify({ preflight: true, sourceFiles: Object.keys(manifest.sourceHashes).length, numericalSamples: manifest.planned.count, intervals: manifest.planned.intervals, freeBytes })); process.exit(0); }
assert.ok(freeBytes >= report.disk.minimumFreeBytes, 'insufficient capture disk');
// Archive every pinned project/Three source and asset, plus exact old reproduction inputs.
for (const [file, hash] of Object.entries({ ...manifest.sourceHashes, ...manifest.baseline.inputHashes })) {
    const destination = path.join(out, 'source', file); fs.mkdirSync(path.dirname(destination), { recursive: true }); fs.copyFileSync(path.join(ROOT, file), destination, fs.constants.COPYFILE_EXCL);
    assert.equal(hashFile(destination), hash, file); report.sourceFreeze.push({ file: 'source/' + file, sha256: hash });
}
save();
const { createServer } = await import('vite');
const { launchProbeBrowser } = await import('../../../../packages/core/src/render/MotionProbe.mjs');
const server = await createServer({ configFile: path.join(ROOT, 'vite.config.js'), server: { host: '127.0.0.1', port: 5369, strictPort: true, hmr: false, watch: { ignored: ['**'] }, fs: { allow: [ROOT] } }, logLevel: 'error' });
let browser;
try {
    await server.listen(); browser = await launchProbeBrowser();
    for (const arm of ARMS) {
        validate(manifest); assert.equal(hashFile(manifestPath), manifestSHA256);
        const name = `${arm}-${report.mode}`, directory = path.join(out, name); fs.mkdirSync(directory);
        const rec = { arm, name, completed: false, loadedAssets: [], routeFulfillments: [], errors: [], commands: [], intervals: [], geometry: [], images: [], oldReproduction: [], viewParity: [] };
        report.runs.push(rec); save();
        const states = [], steps = baseSteps(), imageSteps = new Set(Array.from({ length: 181 }, (_, i) => i * 4)), viewSteps = new Set([0]);
        const prior = primary?.runs.find(r => r.arm === arm), priorStates = primaryStates.get(arm), reads = [];
        const context = await browser.newContext({ viewport: CAMERA.viewport, deviceScaleFactor: 1, reducedMotion: 'no-preference' }), page = await context.newPage();
        const assetPath = url => { const u = new URL(url); if (u.searchParams.has('import')) return null; const decoded = decodeURIComponent(u.pathname), at = decoded.indexOf('/assets/'); return at >= 0 && /\.(?:glb|png|jpg|hdr|bin)$/.test(decoded) ? decoded.slice(at + 1) : null; };
        page.on('pageerror', error => rec.errors.push({ kind: 'pageerror', message: String(error) }));
        page.on('console', m => { if (m.type() === 'error') rec.errors.push({ kind: 'console', message: m.text() }); });
        page.on('requestfailed', q => rec.errors.push({ kind: 'requestfailed', url: q.url(), message: q.failure()?.errorText }));
        page.on('response', response => {
            if (response.status() >= 400) rec.errors.push({ kind: 'http', status: response.status(), url: response.url() });
            const file = assetPath(response.url()); if (file && response.ok()) reads.push(response.body().then(bytes => { assert.equal(sha256(bytes), manifest.sourceHashes[file], file + ' actual response'); rec.loadedAssets.push({ file, sha256: sha256(bytes), bytes: bytes.length }); }));
        });
        await page.route(/\/assets\/.*\.(?:glb|png|jpg|hdr|bin)(?:\?.*)?$/, async route => {
            const file = assetPath(route.request().url()); if (!file) return route.continue();
            assert.ok(manifest.sourceHashes[file], 'unpinned native asset: ' + file);
            const bytes = fs.readFileSync(path.join(out, 'source', file)); assert.equal(sha256(bytes), manifest.sourceHashes[file]);
            rec.routeFulfillments.push({ file, sha256: sha256(bytes) });
            const type = file.endsWith('.glb') ? 'model/gltf-binary' : file.endsWith('.png') ? 'image/png' : file.endsWith('.jpg') ? 'image/jpeg' : 'application/octet-stream';
            await route.fulfill({ status: 200, contentType: type, body: bytes });
        });
        try {
            rec.url = 'http://127.0.0.1:5369/src/showcase.html?preset=casual&outfit=casual&style=ecru&frame=portrait&capture=';
            await page.goto(rec.url); await page.waitForFunction(() => window.showcase || !document.querySelector('#error').hidden, null, { timeout: 120000 });
            assert.equal(await page.locator('#error').textContent(), '');
            rec.setup = await page.evaluate(async ({ root, arm, manifest }) => { window.handRuntime = await import('/@fs' + root + '/docs/evidence/nonhair-2026-09-26/hand-clearance/hand-attribution-runtime.mjs'); return handRuntime.prepare(arm, manifest); }, { root: ROOT, arm, manifest });
            if (report.mode === 'views') rec.visualBase = await page.evaluate(view => handRuntime.setVisualBase(view), VIEWS[0]);
            await Promise.all(reads);
            for (const file of CAPTURE_ASSETS) assert.equal(rec.loadedAssets.filter(x => x.file === file).length, 1, 'one actual response: ' + file);
            for (let step = 0; step <= TIMING.steps; step++) {
                if (step) await page.evaluate(() => handRuntime.step());
                const phase = PHASES.find(p => p.step === step);
                if (phase) {
                    const actual = await page.evaluate(({ phase, speechPlan }) => handRuntime.command(phase, speechPlan), { phase, speechPlan: SPEECH_PLAN });
                    const sampling = scheduleSampling(actual.schedule, step); sampling.steps.forEach(n => { steps.add(n); imageSteps.add(n); }); rec.intervals.push(...sampling.intervals);
                    if (step === 360) sampling.intervals.forEach(i => viewSteps.add(i.center));
                    assert.ok(steps.size <= TIMING.numericalCap, 'actual sample plan exceeds approved cap');
                    assert.ok(imageSteps.size <= TIMING.imageTimeCap, 'actual image plan exceeds approved cap');
                    const command = { ...phase, actual, sampling }; rec.commands.push(command);
                    assert.deepEqual(actual, oldRun.commands.find(p => p.step === step).actual, 'native command/schedule differs from retained prefix');
                }
                const state = await page.evaluate(() => handRuntime.semantic()); states.push({ step, ...state });
                const rendering = await page.evaluate(() => handRuntime.renderState());
                if (report.mode === 'primary') assert.equal(rendering.rendererFrame, 1000257 + step, 'primary render history drift');
                if (steps.has(step)) {
                    const geometry = await page.evaluate(() => handRuntime.snapshot());
                    geometry.capture = { arm, step, studyId: manifest.studyId, manifestSHA256, mode: report.mode };
                    if (report.mode === 'primary') {
                        const entry = recordRaw(`${name}/meshes-${step}.json.gz`, geometry); rec.geometry.push({ step, time: geometry.time, ...entry, pose: digestPose(geometry), physical: await page.evaluate(() => handRuntime.physical()) });
                        if (arm === 'A' && oldSnapshots.has(step)) { assert.deepEqual(pose(geometry), pose(oldSnapshots.get(step)), 'A exact old pose mismatch at' + step); rec.oldReproduction.push({ step, exact: 'time/rig/all mesh positions/full+drawn indices', passed: true }); }
                    } else {
                        const entry = prior.geometry.find(e => e.step === step); assert.ok(entry, 'missing primary geometry'); const expected = readBound(primaryPath, entry);
                        assert.deepEqual(pose(geometry), pose(expected), 'visual pass native pose drift'); assert.deepEqual(state, priorStates.find(s => s.step === step) && (({ step: ignored, ...s }) => s)(priorStates.find(s => s.step === step)), 'visual pass native owner telemetry drift');
                        const physical = await page.evaluate(() => handRuntime.physical());
                        for (const key of ['hairPositions', 'hairVelocities', 'head', 'clock', 'steps']) assert.deepEqual(physical[key], entry.physical[key], 'visual/primary physical guard differs: ' + key);
                        rec.viewParity.push({ step, primaryDecodedSHA256: entry.decodedSHA256, pose: digestPose(geometry), semanticEqual: true, rendering, physical,
                            invariantFields: ['hairPositions', 'hairVelocities', 'head', 'clock', 'steps'],
                            observedProjectionDependentDifferences: ['hairVertices', 'cards', 'projection', 'view', 'camera'].filter(key => !isDeepStrictEqual(physical[key], entry.physical[key])) });
                    }
                }
                if (arm === 'A' && report.mode === 'primary' && TIMING.oldPhysicalSteps.includes(step)) {
                    const physical = await page.evaluate(() => handRuntime.physical());
                    if (report.mode === 'primary') { const expected = oldRun.states.find(s => s.step === step); assert.ok(expected); assert.deepEqual(physical, expected.physical, 'A retained physical mismatch at' + step); rec.oldReproduction.push({ step, exact: 'full helper physical including camera, centrelines, GPU vertices, cards, clock', passed: true, rendererFrame: rendering.rendererFrame }); }
                }
                if (report.mode === 'views' && (imageSteps.has(step) || viewSteps.has(step))) {
                    const before = await page.evaluate(() => handRuntime.physical()), unchanged = await page.evaluate(() => handRuntime.semantic());
                    const fullFile = `${name}/${VIEWS[0].id}-${String(step).padStart(4, '0')}.png`, fullBytes = await page.locator('#stage').screenshot(); fs.writeFileSync(path.join(out, fullFile), fullBytes, { flag: 'wx' });
                    const plates = [{ view: VIEWS[0].id, file: fullFile, sha256: sha256(fullBytes), rendering }];
                    for (const view of viewSteps.has(step) ? VIEWS.slice(1) : []) {
                        const beforeDraw = await page.evaluate(() => handRuntime.renderState()), during = await page.evaluate(view => handRuntime.beginView(view), view);
                        const file = `${name}/${view.id}-${String(step).padStart(4, '0')}.png`, bytes = await page.locator('#stage').screenshot(); fs.writeFileSync(path.join(out, file), bytes, { flag: 'wx' });
                        const restored = await page.evaluate(() => handRuntime.endView());
                        plates.push({ view: view.id, file, sha256: sha256(bytes), beforeDraw, during, restored });
                    }
                    const after = await page.evaluate(() => handRuntime.physical());
                    for (const key of ['hairPositions', 'hairVelocities', 'head', 'clock', 'steps']) assert.deepEqual(after[key], before[key], 'zero-delta view changed ' + key);
                    assert.deepEqual(await page.evaluate(() => handRuntime.semantic()), unchanged, 'zero-delta view updated native owners');
                    rec.images.push({ step, plates, zeroDeltaPhysicalGuard: ['hairPositions', 'hairVelocities', 'head', 'clock', 'steps'], semanticUnchanged: true });
                }
                if (step % 60 === 0) { save(); console.log(`${name} step${step}/${TIMING.steps}`); }
            }
            assert.deepEqual(rec.intervals.map(i => i.center), [98, 270, 455, 637], 'actual derived centers drift');
            for (const interval of rec.intervals) {
                const actual = states.filter(s => s.step >= interval.phaseStep && s.step < interval.phaseStep + 360 && s.gesture.applied.activation === 1 && s.step >= interval.boundaries[0] && s.step <= interval.boundaries.at(-1));
                assert.equal(actual[0].step, interval.first); assert.equal(actual.at(-1).step, interval.last);
                for (const anchor of [interval.first, interval.center, interval.last]) for (const offset of TIMING.denseOffsets) assert.ok(steps.has(anchor + offset));
                interval.observed = { first: actual[0].step, last: actual.at(-1).step, returnedSamples: actual.length };
            }
            assert.deepEqual(rec.commands.map(c => c.step), [0, 360]);
            assert.equal(states.length, 721); rec.states = { ...recordRaw(`${name}/states.json.gz`, states), count: states.length };
            rec.plannedNumericalSteps = [...steps].sort((a, b) => a - b);
            if (report.mode === 'primary') assert.deepEqual(rec.geometry.map(g => g.step), rec.plannedNumericalSteps);
            else { assert.deepEqual(rec.viewParity.map(g => g.step), rec.plannedNumericalSteps); assert.deepEqual(rec.commands, prior.commands);
                assert.deepEqual(rec.images.map(i => i.step), [...imageSteps].sort((a, b) => a - b)); }
            await Promise.all(reads); assert.deepEqual(rec.errors, []);
        } catch (error) { rec.failure = error.stack; throw error; }
        finally {
            try { rec.disposal = await page.evaluate(async () => {
                if (window.handRuntime) return handRuntime.teardown();
                const a = window.showcase?.avatar; if (!a) return { notConstructed: true };
                const renderer = a.stage.renderer; a.dispose(); return { disposed: a.disposed, memory: structuredClone(renderer.info.memory), leaks: a.leakedHandles() };
            }); }
            catch (error) { rec.disposalFailure = error.stack; throw error; }
            finally { await context.close(); save(); }
        }
        assert.equal(rec.disposal.disposed, true); assert.ok(Object.values(rec.disposal.memory).every(v => v === 0)); assert.deepEqual(rec.disposal.leaks, []);
        assert.deepEqual(rec.disposal.instrument?.cleanup?.lost ?? [], []); assert.deepEqual(rec.errors, []); validate(manifest); rec.completed = true; save();
        console.log(`Completed ${name}; ${rec.plannedNumericalSteps.length} numerical samples, ${rec.images.length} image times`);
    }
    if (report.mode === 'primary') {
        const control = readBound(out, report.runs[0].states); report.ownerComparisons = [];
        for (const run of report.runs.slice(1)) {
            const data = readBound(out, run.states), differences = new Map();
            for (let i = 0; i < data.length; i++) {
                assert.deepEqual(data[i].schedule, control[i].schedule); assert.equal(data[i].clock, control[i].clock);
                for (const name of ['posture', 'gesture']) assert.deepEqual(data[i].instrument.samples[name].raw, control[i].instrument.samples[name].raw, 'filtered owner raw prescription changed');
                for (const owner of data[i].instrument.owners) {
                    const other = control[i].instrument.owners.find(x => x.name === owner.name); assert.ok(other);
                    if (!isDeepStrictEqual(owner, other)) { const item = differences.get(owner.name) ?? { owner: owner.name, frames: 0, firstStep: i, fields: Object.keys(owner).filter(k => !isDeepStrictEqual(owner[k], other[k])) }; item.frames++; differences.set(owner.name, item); }
                }
            }
            report.ownerComparisons.push({ arm: run.arm, against: 'A', differences: [...differences.values()], classification: 'Recorded differences, including downstream pose dependencies; no global unaffected-output equality is assumed. Raw posture/gesture prescriptions and actual schedules are required equal.' });
        }
    }
    validate(manifest); assert.equal(hashFile(manifestPath), manifestSHA256); report.completed = true;
} catch (error) { report.failure = error.stack; process.exitCode = 1; }
finally { save(); await browser?.close(); await server.close(); if (report.completed) fs.writeFileSync(path.join(out, 'seal.json'), JSON.stringify({ reportSHA256: hashFile(path.join(out, 'report.json')), manifestSHA256, mode: report.mode }, null, 2) + '\n', { flag: 'wx' }); console.log(JSON.stringify({ completed: report.completed, failure: report.failure, output: out })); }
