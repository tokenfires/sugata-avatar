// Additional discrete geometry only. Replay the sealed candidate exactly; no images or new pose.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { gzipSync, gunzipSync } from 'node:zlib';
import { ROOT, CAPTURE_ASSETS, hashFile, sha256 } from '../hand-clearance/hand-attribution-manifest.mjs';
import { compareRetained, POLICY } from '../hand-clearance/retained-json-comparison.mjs';

const HERE = 'docs/evidence/nonhair-2026-09-26/hand-candidate';
const SELF = HERE + '/candidate-dense-window.mjs';
const PRIMARY = 'captures/hand-candidate-2026-09-26/candidate-primary-v3';
const PRIMARY_MANIFEST = 'a4bd27fcef48d9efb2cdcd71d7df3c2523d4e2b2416e6002a834c56efa382515';
const PRIMARY_REPORT = '34305cf143306ae7818c159159e2eb7aa1514992da696cc8a27b948467b0b877';
const KIND = 'frozen-rest-budget-candidate-dense-window';
const WINDOW = Array.from({ length: 21 }, (_, i) => 585 + i);
const read = (directory, file) => fs.readFileSync(path.join(ROOT, directory, file));
const primaryBytes = read(PRIMARY, 'report.json'), primary = JSON.parse(primaryBytes);
const primaryManifestBytes = read(PRIMARY, 'manifest.json'), primaryManifest = JSON.parse(primaryManifestBytes);
const primarySealBytes = read(PRIMARY, 'seal.json'), primarySeal = JSON.parse(primarySealBytes);
assert.equal(sha256(primaryBytes), PRIMARY_REPORT);
assert.equal(sha256(primaryManifestBytes), PRIMARY_MANIFEST);
assert.equal(primarySeal.reportSHA256, PRIMARY_REPORT);
assert.equal(primarySeal.manifestSHA256, PRIMARY_MANIFEST);
assert.equal(primary.completed, true);
assert.equal(primary.preflightOnly, undefined);
for (const key of ['failure', 'cleanupFailure', 'sourceFailure']) assert.equal(primary[key], undefined, key);
assert.deepEqual(primary.errors, []);
assert.deepEqual(primary.sourceHashes, primaryManifest.sourceHashes);
assert.deepEqual(primary.sourceFreeze, Object.entries(primary.sourceHashes).map(([file, sha256]) => ({ file: 'source/' + file, sha256 })));
assert.equal(primary.states.count, 721);
assert.equal(primary.states.partial, undefined);
const base = primaryManifest.baseManifest;
assert.deepEqual(primary.geometry.map(g => g.step), base.planned.numericalSteps);
assert.equal(primary.geometry.length, 109);
assert.deepEqual(primaryManifest.candidate.budget, { commonRadians: 0 });
function cleanFinish(finish, expectedFrames) {
    assert.ok(Number.isInteger(expectedFrames) && expectedFrames >= 0 && expectedFrames <= 721);
    assert.equal(finish.error, null);
    const receipt = finish.result.receipt;
    assert.equal(receipt.completed, true);
    assert.equal(receipt.disposed, true);
    assert.deepEqual(receipt.poseHashes, primaryManifest.candidate.poseHashes);
    assert.deepEqual(receipt.budget, primaryManifest.candidate.budget);
    assert.deepEqual(receipt.cleanup, { restored: ['bindArmBudget', 'load'], lost: [] });
    for (const key of ['cleanupErrors', 'retireError', 'fallbackRetirement', 'retireSkipped']) assert.equal(receipt[key], undefined, key);
    assert.equal(receipt.budgetCalls.length, 1);
    assert.equal(receipt.budgetCalls[0].stackFrame, 0);
    assert.equal(receipt.budgetCalls[0].stackTime, 0);
    assert.deepEqual(receipt.budgetCalls[0].effective, { leftUpperArm: 0, rightUpperArm: 0 });
    for (const name of ['leftUpperArm', 'rightUpperArm']) assert.ok(Number.isFinite(receipt.budgetCalls[0].native[name]) && receipt.budgetCalls[0].native[name] >= 0);
    assert.deepEqual(receipt.poseCalls.map(p => p.name), ['relaxed-standing', 'weight-left', 'weight-right', 'relaxed-standing']);
    for (const p of receipt.poseCalls) assert.equal(p.sha256, primaryManifest.candidate.poseHashes[p.name]);
    assert.equal(receipt.candidateTelemetry.failure, null);
    assert.deepEqual(receipt.candidateTelemetry.frames, Array.from({ length: expectedFrames }, (_, i) => i + 2));
    assert.equal(receipt.retirement.status, 'disposed');
    assert.equal(receipt.retirement.failure, null);
    assert.equal(receipt.retirement.completedFrames, expectedFrames);
    assert.deepEqual(receipt.retirement.cleanup.lost, []);
    for (const d of [finish.disposal, receipt.retireResult]) {
        assert.equal(d.disposed, true); assert.deepEqual(d.leaks, []);
        assert.ok(Object.values(d.memory).every(v => v === 0));
        assert.equal(d.instrument.status, 'disposed'); assert.equal(d.instrument.failure, null);
        assert.deepEqual(d.instrument.cleanup.lost, []); assert.equal(d.instrument.completedFrames, expectedFrames);
    }
    assert.ok(Object.values(finish.memory).every(v => v === 0));
}
cleanFinish(primary.finish, 721);
for (const [file, hash] of Object.entries(primary.sourceHashes)) {
    assert.equal(hashFile(path.join(ROOT, PRIMARY, 'source', file)), hash, 'Frozen primary source ' + file);
    assert.equal(hashFile(path.join(ROOT, file)), hash, 'Live native source ' + file);
}
function readBound(entry) {
    const bytes = read(PRIMARY, entry.file); assert.equal(sha256(bytes), entry.sha256, entry.file);
    const raw = gunzipSync(bytes); assert.equal(sha256(raw), entry.decodedSHA256, entry.file + ' decoded');
    return JSON.parse(raw);
}
const priorStates = readBound(primary.states); assert.equal(priorStates.length, 721);
for (let i = 0; i <= 720; i++) assert.equal(priorStates[i].step, i);
const overlap = primary.geometry.filter(g => WINDOW.includes(g.step));
assert.deepEqual(overlap.map(g => g.step), [590, 591, 592, 600]);
// Native OrbitControls.update() settles its matrix numerically after initialization. Bind the
// actual retained camera in this window, never assume step0's matrix remains bit-identical.
for (const sample of overlap) for (const key of ['camera', 'projection', 'view'])
    assert.deepEqual(sample.physical[key], overlap[0].physical[key], 'Retained window camera ' + key);
const template = readBound(primary.geometry[0]);
const primarySamples = new Map([[0, template]]);
// physical.steps is HairDynamics' submitted 1/120 s solver substeps. The reset owes
// one initial substep; every native 1/60 s update then submits exactly two. This is
// source-derived and independently checked against all109 sealed primary samples.
const expectedPhysicalSteps = step => 1 + 2 * step;
const primaryStructuralComparisons = [];
const retainedCheck = (actual, expected, label) => compareRetained(actual, expected, { label, audit: primaryStructuralComparisons });
function admitGeometry(geometry, state, step, retain = retainedCheck) {
    retain(geometry.telemetry, state, 'Snapshot same native frame ' + step);
    retain(Object.keys(geometry.rig), Object.keys(template.rig), 'Rig identities ' + step);
    assert.ok(Object.values(geometry.rig).every(matrix => matrix.length === 16 && matrix.every(Number.isFinite)));
    assert.equal(geometry.time, state.clock);
    retain(geometry.meshes.map(m => m.id), template.meshes.map(m => m.id), 'Five native meshes ' + step);
    for (let i = 0; i < geometry.meshes.length; i++) {
        const mesh = geometry.meshes[i], expected = template.meshes[i];
        assert.equal(mesh.positions.length, expected.positions.length);
        assert.ok(mesh.positions.every(Number.isFinite));
        retain(mesh.fullIndices, expected.fullIndices, 'Fixed full topology ' + mesh.id + ' ' + step);
        retain(mesh.drawnIndices, expected.drawnIndices, 'Fixed drawn mask ' + mesh.id + ' ' + step);
    }
}
function admitPhysical(physical, state, step, previous = null) {
    assert.equal(physical.clock, state.clock);
    assert.equal(physical.steps, expectedPhysicalSteps(step), 'Submitted fixed solver substeps ' + step);
    if (previous) assert.equal(physical.steps - previous.steps, 2 * (step - previous.step), 'Observed solver counter delta ' + step);
}
function admitRenderer(rendering, step) {
    assert.equal(rendering.rendererFrame, 1000257 + step, 'No extra draw at ' + step);
}
// Run the SAME structural/time/counter admissions on every available sealed fixture,
// not just the four window overlaps. Camera equality stays scoped to the actual window.
const primaryAdmissionChecks = [];
let previousPrimaryPhysical = null;
for (const entry of primary.geometry) {
    const geometry = entry.step === 0 ? template : readBound(entry);
    const { step, ...state } = priorStates[entry.step];
    assert.equal(step, entry.step); assert.equal(entry.time, state.clock);
    admitGeometry(geometry, state, step);
    admitPhysical(entry.physical, state, step, previousPrimaryPhysical);
    previousPrimaryPhysical = { step, steps: entry.physical.steps };
    if (WINDOW.includes(step)) primarySamples.set(step, geometry);
    primaryAdmissionChecks.push({ step, sha256: entry.sha256, decodedSHA256: entry.decodedSHA256,
        clock: state.clock, solverSubsteps: entry.physical.steps, expectedSolverSubsteps: expectedPhysicalSteps(step) });
}
admitRenderer(primary.setup.ready, 0);
const primaryController = fs.readFileSync(path.join(ROOT, PRIMARY, 'source', HERE, 'candidate-capture.mjs'), 'utf8');
assert.ok(primaryController.includes('assert.equal(rendering.rendererFrame,1000257+step)'));

const reference = {
    directory: PRIMARY, manifestSHA256: PRIMARY_MANIFEST, reportSHA256: PRIMARY_REPORT,
    sealSHA256: sha256(primarySealBytes), states: primary.states,
    overlapSteps: overlap.map(g => g.step), cameraReferenceStep: overlap[0].step,
    geometryInputs: primary.geometry.map(({step, file, sha256, decodedSHA256}) => ({step, file, sha256, decodedSHA256}))
};
function buildManifest() {
    return {
        version: 1, kind: KIND, promotion: false,
        baseManifestSHA256: primaryManifest.baseManifestSHA256, baseManifest: base,
        candidate: primaryManifest.candidate, reference,
        sourceHashes: { ...primary.sourceHashes, [SELF]: hashFile(path.join(ROOT, SELF)) },
        windowSteps: WINDOW,
        timing: { steps: 720, fps: 60, semanticSamples: 721, geometrySamples: 21, extraImageDraws: 0 },
        intervention: 'None: exact own-primary candidate replay; only additional discrete geometry observations at585..605.',
        comparison: 'All721 complete semantic states exact under retained JSON signed-zero convention; full geometry and physical equality at590/591/592/600. No allowed owner/morph/status differences from own primary.',
        limit: 'Twenty-one native 60Hz geometry samples around one narrow gap; no continuous-time guarantee, new margin, all-motion qualification or promotion.'
    };
}
if (process.argv[2] === '--write-manifest') {
    assert.equal(process.argv.length, 4);
    fs.writeFileSync(process.argv[3], JSON.stringify(buildManifest(), null, 2) + '\n', { flag: 'wx' });
    console.log(JSON.stringify({ wrote: process.argv[3], sources: Object.keys(primary.sourceHashes).length + 1, windowSteps: WINDOW }));
    process.exit(0);
}
const [manifestPath, output, mode] = process.argv.slice(2);
assert.equal(process.argv.length, 5, 'usage: candidate-dense-window.mjs MANIFEST FRESH_OUTPUT --preflight|--run');
assert.ok(['--preflight', '--run'].includes(mode));
const manifestBytes = fs.readFileSync(manifestPath), manifest = JSON.parse(manifestBytes);
assert.deepEqual(manifest, buildManifest());
const manifestHash = sha256(manifestBytes), out = path.resolve(output);
assert.equal(fs.existsSync(out), false, 'Fresh output required');
fs.mkdirSync(out, { recursive: true });
fs.writeFileSync(path.join(out, 'manifest.json'), manifestBytes, { flag: 'wx' });
const report = {
    version: 1, kind: KIND, completed: false, manifestSHA256: manifestHash,
    reference, sourceHashes: manifest.sourceHashes, windowSteps: WINDOW,
    comparisonPolicy: POLICY, createdAt: new Date().toISOString(), sourceFreeze: [],
    loadedAssets: [], routeFulfillments: [], errors: [], commands: [], geometry: [], comparisons: [], states: null,
    scope: manifest.limit
};
const save = () => fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2) + '\n');
const record = (file, value) => {
    const raw = JSON.stringify(value), bytes = gzipSync(raw);
    fs.writeFileSync(path.join(out, file), bytes, { flag: 'wx' });
    return { file, sha256: sha256(bytes), decodedSHA256: sha256(raw) };
};
if (mode === '--preflight') {
    fs.writeFileSync(path.join(out, 'controller-source.mjs'), fs.readFileSync(path.join(ROOT, SELF)), { flag: 'wx' });
    report.completed = true; report.preflightOnly = true;
    report.preflight = { verifiedPrimarySourceFiles: primary.sourceFreeze.length, verifiedPrimaryStates: 721,
        verifiedPrimaryGeometryInputs: reference.geometryInputs, structuralAndCounterAdmissions: primaryAdmissionChecks,
        structuralComparisons: primaryStructuralComparisons,
        physicalCounter: { meaning: 'Submitted HairDynamics fixed solver substeps', initial: 1, perNativeStep: 2, formula: '1 + 2 * step', exactObservedDeltaChecks: primaryAdmissionChecks.length - 1 },
        rendererAdmission: { observedInitializationFrame: primary.setup.ready.rendererFrame, expectedFormula: '1000257 + step',
            sealedPrimaryControllerChecksEveryFrame: true, rawPerFrameRendererRecordsRetainedInPrimary: false },
        plannedWindow: WINDOW, overlapSteps: reference.overlapSteps, cameraReferenceStep: reference.cameraReferenceStep };
    save(); console.log(JSON.stringify({ preflight: true, sources: Object.keys(manifest.sourceHashes).length, geometry: 21, states: 721, overlapSteps: reference.overlapSteps }));
    process.exit(0);
}
assert.ok(Number(fs.statfsSync(out).bavail) * Number(fs.statfsSync(out).bsize) > 4 * 1024 ** 3, 'At least4GiB free required');
for (const [file, hash] of Object.entries(manifest.sourceHashes)) {
    const source = file === SELF ? path.join(ROOT, file) : path.join(ROOT, PRIMARY, 'source', file);
    const dest = path.join(out, 'source', file); fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(source, dest, fs.constants.COPYFILE_EXCL); assert.equal(hashFile(dest), hash);
    report.sourceFreeze.push({ file: 'source/' + file, sha256: hash });
}
save();
const { createServer } = await import('vite');
const { launchProbeBrowser } = await import('../../../../packages/core/src/render/MotionProbe.mjs');
const server = await createServer({ configFile: path.join(ROOT, 'vite.config.js'), server: {
    host: '127.0.0.1', port: 5377, strictPort: true, hmr: false, watch: { ignored: ['**'] }, fs: { allow: [ROOT] }
}, logLevel: 'error' });
let browser, context, page, lastObservation = null, attemptedLoopStep = null;
const states = [], reads = [];
const assetPath = url => {
    const u = new URL(url); if (u.searchParams.has('import')) return null;
    const s = decodeURIComponent(u.pathname), i = s.indexOf('/assets/');
    return i >= 0 && /\.(?:glb|png|jpg|hdr|bin)$/.test(s) ? s.slice(i + 1) : null;
};
const retained = (actual, expected, label) => compareRetained(actual, expected, { label, audit: report.comparisons });
try {
    await server.listen(); browser = await launchProbeBrowser();
    context = await browser.newContext({ viewport: base.camera.viewport, deviceScaleFactor: 1, reducedMotion: 'no-preference' });
    page = await context.newPage();
    page.on('pageerror', e => report.errors.push({ kind: 'pageerror', message: String(e) }));
    page.on('console', m => { if (m.type() === 'error') report.errors.push({ kind: 'console', message: m.text() }); });
    page.on('requestfailed', q => report.errors.push({ kind: 'requestfailed', url: q.url(), message: q.failure()?.errorText }));
    page.on('response', response => {
        if (response.status() >= 400) report.errors.push({ kind: 'http', status: response.status(), url: response.url() });
        const file = assetPath(response.url());
        if (file && response.ok()) reads.push(response.body().then(bytes => {
            assert.equal(sha256(bytes), manifest.sourceHashes[file], 'Actual loaded response ' + file);
            report.loadedAssets.push({ file, sha256: sha256(bytes), bytes: bytes.length });
        }).catch(error => { report.errors.push({ kind: 'asset-binding', file, message: String(error) }); }));
    });
    await page.route(/\/assets\/.*\.(?:glb|png|jpg|hdr|bin)(?:\?.*)?$/, async route => {
        const file = assetPath(route.request().url()); if (!file) return route.continue();
        assert.ok(manifest.sourceHashes[file]);
        const bytes = fs.readFileSync(path.join(out, 'source', file)); assert.equal(sha256(bytes), manifest.sourceHashes[file]);
        report.routeFulfillments.push({ file, sha256: sha256(bytes) });
        await route.fulfill({ status: 200, contentType: file.endsWith('.glb') ? 'model/gltf-binary' : file.endsWith('.png') ? 'image/png' : file.endsWith('.jpg') ? 'image/jpeg' : 'application/octet-stream', body: bytes });
    });
    const originalHTML = fs.readFileSync(path.join(out, 'source/packages/testbed/src/showcase.html'), 'utf8');
    const tag = '<script type="module" src="./showcase.js"></script>'; assert.equal(originalHTML.split(tag).length, 2);
    const deferredHTML = originalHTML.replace(tag, '<!-- Frozen-candidate bootstrap defers the original module only. -->');
    report.bootstrap = { originalHTMLSHA256: sha256(originalHTML), deferredHTMLSHA256: sha256(deferredHTML), change: primary.bootstrap.change };
    assert.deepEqual(report.bootstrap, primary.bootstrap);
    fs.writeFileSync(path.join(out, 'deferred-showcase.html'), deferredHTML, { flag: 'wx' });
    await page.route('**/src/showcase.html?*', route => route.fulfill({ status: 200, contentType: 'text/html', body: deferredHTML }));
    await page.goto('http://127.0.0.1:5377/src/showcase.html?preset=casual&outfit=casual&style=ecru&frame=portrait&capture=');
    const poseFiles = Object.fromEntries(['relaxed-standing', 'weight-left', 'weight-right'].map(name => [name, fs.readFileSync(path.join(out, 'source', HERE, 'pose-proposal/family', name + '.json'), 'utf8')]));
    await page.evaluate(async ({ root, poseFiles, sourceHashes, manifest }) => {
        window.candidateRuntime = await import('/@fs' + root + '/docs/evidence/nonhair-2026-09-26/hand-candidate/candidate-runtime.mjs');
        return candidateRuntime.begin({ poseFiles, sourceHashes, manifest });
    }, { root: ROOT, poseFiles, sourceHashes: manifest.sourceHashes, manifest: base });
    await page.waitForFunction(() => window.candidateControlReady || window.candidateControlError, null, { timeout: 120000 });
    report.setup = await page.evaluate(() => ({ ready: window.candidateControlReady ?? null, error: window.candidateControlError ?? null }));
    assert.equal(report.setup.error, null);
    for (const key of ['configuration', 'morphNames', 'nativeGesture', 'rendererFrame']) retained(report.setup.ready[key], primary.setup.ready[key], 'Original initialization ' + key);
    await Promise.all(reads); assert.deepEqual(report.errors, []);
    for (const file of CAPTURE_ASSETS) assert.equal(report.loadedAssets.filter(x => x.file === file).length, 1, 'One actual response: ' + file);
    const expectedCamera = overlap[0].physical;
    let previousWindowPhysical = null;
    for (let step = 0; step <= 720; step++) {
        attemptedLoopStep = step;
        if (step) await page.evaluate(() => candidateRuntime.native.step());
        const phase = base.phases.find(p => p.step === step);
        if (phase) {
            const actual = await page.evaluate(({ phase, speechPlan }) => candidateRuntime.native.command(phase, speechPlan), { phase, speechPlan: base.speechPlan });
            retained(actual, primary.commands.find(c => c.step === step).actual, 'Own-primary command ' + step);
            report.commands.push({ step, actual });
        }
        const state = await page.evaluate(() => candidateRuntime.native.semantic());
        lastObservation = { step, ...state }; states.push(lastObservation);
        retained(lastObservation, priorStates[step], 'Complete own-primary semantic state ' + step);
        const rendering = await page.evaluate(() => candidateRuntime.native.renderState());
        admitRenderer(rendering, step);
        if (WINDOW.includes(step)) {
            const geometry = await page.evaluate(() => candidateRuntime.native.snapshot());
            admitGeometry(geometry, state, step, retained);
            const physical = await page.evaluate(() => candidateRuntime.native.physical());
            for (const key of ['camera', 'projection', 'view']) retained(physical[key], expectedCamera[key], 'Original primary camera ' + key + ' ' + step);
            admitPhysical(physical, state, step, previousWindowPhysical);
            previousWindowPhysical = { step, steps: physical.steps };
            const prior = primary.geometry.find(g => g.step === step);
            if (prior) {
                const { capture, ...expected } = primarySamples.get(step);
                retained(geometry, expected, 'Full own-primary overlap geometry ' + step);
                retained(physical, prior.physical, 'Full own-primary overlap physical ' + step);
            }
            retained(await page.evaluate(() => candidateRuntime.native.semantic()), state, 'Observation changed no semantic state ' + step);
            retained(await page.evaluate(() => candidateRuntime.native.renderState()), rendering, 'Observation changed no renderer state ' + step);
            geometry.capture = { candidate: 'D', step, manifestSHA256: manifestHash, kind: KIND, referenceManifestSHA256: PRIMARY_MANIFEST };
            report.geometry.push({ step, time: geometry.time, ...record('meshes-' + step + '.json.gz', geometry),
                referenceSHA256: prior?.decodedSHA256 ?? null, physical });
        }
        if (step % 60 === 0) { save(); console.log('Dense-window candidate step' + step + '/720'); }
    }
    report.states = { ...record('states.json.gz', states), count: states.length };
    assert.equal(states.length, 721); assert.deepEqual(report.geometry.map(g => g.step), WINDOW);
    await Promise.all(reads); assert.deepEqual(report.errors, []);
    const assetIndex = entries => entries.map(({ file, sha256, bytes }) => ({ file, sha256, bytes })).sort((a, b) => a.file.localeCompare(b.file));
    assert.deepEqual(assetIndex(report.loadedAssets), assetIndex(primary.loadedAssets), 'Same actual loaded source assets');
} catch (error) {
    report.failure = error.stack; process.exitCode = 1;
    if (lastObservation) {
        report.failureState = { step: lastObservation.step, ...record('failure-state.json.gz', lastObservation) };
        report.states = { ...record('partial-states.json.gz', states), count: states.length, partial: true };
        try { report.failurePhysical = { attemptedLoopStep, lastRetainedSemanticStep: lastObservation.step,
            semanticCorrespondence: attemptedLoopStep === lastObservation.step ? 'same loop iteration, no subsequent simulation step' : 'unverified after a later step or command failure',
            rendering: await page.evaluate(() => candidateRuntime.native.renderState()), physical: await page.evaluate(() => candidateRuntime.native.physical()),
            note: 'Read at failure without an added simulation step or draw; not a planned accepted sample.' }; }
        catch (observationError) { report.failureObservationError = String(observationError); }
    }
} finally {
    if (page) {
        let timer;
        try {
            report.finish = await Promise.race([page.evaluate(() => window.candidateRuntime ? candidateRuntime.finish() : null),
                new Promise((_, reject) => { timer = setTimeout(() => reject(Error('Native cleanup timed out after30s')), 30000); })]);
            const observedFrames = report.finish?.result?.receipt?.retirement?.completedFrames;
            cleanFinish(report.finish, report.failure ? observedFrames : states.length);
        } catch (error) { report.cleanupFailure = error.stack; process.exitCode = 1; }
        finally { clearTimeout(timer); }
    }
    try {
        for (const [file, hash] of Object.entries(manifest.sourceHashes)) {
            assert.equal(hashFile(path.join(ROOT, file)), hash, 'End live source ' + file);
            assert.equal(hashFile(path.join(out, 'source', file)), hash, 'End frozen source ' + file);
        }
        assert.equal(hashFile(manifestPath), manifestHash);
        assert.equal(hashFile(path.join(ROOT, PRIMARY, 'report.json')), PRIMARY_REPORT);
        assert.equal(hashFile(path.join(ROOT, PRIMARY, 'manifest.json')), PRIMARY_MANIFEST);
        assert.equal(hashFile(path.join(ROOT, PRIMARY, 'seal.json')), reference.sealSHA256);
    } catch (error) { report.sourceFailure = error.stack; process.exitCode = 1; }
    report.completed = !report.failure && !report.cleanupFailure && !report.sourceFailure &&
        report.geometry.length === 21 && states.length === 721 && report.errors.length === 0 && !!report.finish;
    save(); await context?.close(); await browser?.close(); await server.close();
    if (report.completed) fs.writeFileSync(path.join(out, 'seal.json'), JSON.stringify({ reportSHA256: hashFile(path.join(out, 'report.json')), manifestSHA256: manifestHash, kind: KIND }, null, 2) + '\n', { flag: 'wx' });
    console.log(JSON.stringify({ completed: report.completed, failure: report.failure, cleanupFailure: report.cleanupFailure, output: out }));
}
