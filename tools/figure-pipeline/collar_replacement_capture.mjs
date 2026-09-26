// New manifest-bound qualification. Historical captures and installed assets stay untouched.
// node tools/figure-pipeline/collar_replacement_capture.mjs MANIFEST FRESH_OUT --preflight|--smoke|--smoke-vest|--capture
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { gzipSync } from 'node:zlib';
import { execFileSync } from 'node:child_process';
import { createServer } from 'vite';
import { launchProbeBrowser } from '../../packages/core/src/render/MotionProbe.mjs';
import { readGlb, readPrimitive } from '../lut-bake/glb.mjs';
import { ROOT, PROFILES, CAMERA, SPEECH_PLAN, NATIVE_BAKE_NAME, FOUNDATION_PATHS, sha256, hashFile,
    verifyCaptureInputs, baseSnapshotSteps, addSchedulePeaks, captureCases, comparePoseFamilies } from './collar_replacement_manifest.mjs';

assert.equal(process.argv.length, 5, 'Usage: node collar_replacement_capture.mjs MANIFEST FRESH_OUT --preflight|--smoke|--smoke-vest|--capture');
const [manifestPath, outputPath, mode] = process.argv.slice(2);
assert.ok(['--preflight', '--smoke', '--smoke-vest', '--capture'].includes(mode), 'explicit mode required');
const out = path.resolve(outputPath), manifestBytes = fs.readFileSync(manifestPath);
const manifest = JSON.parse(manifestBytes), manifestSHA256 = sha256(manifestBytes);
// All input validation precedes creation of a server, browser or output folder.
const assets = verifyCaptureInputs(manifest);
const smokeFoundation = mode === '--smoke' ? 'foundation_bra' : mode === '--smoke-vest' ? 'foundation_vest' : null;
const plannedCases = captureCases(manifest, smokeFoundation);
const foundationTopology = Object.fromEntries(manifest.foundations.map(id => {
    const assetPath = FOUNDATION_PATHS[id], file = path.join(ROOT, assetPath), primitive = readPrimitive(readGlb(file), id);
    return [id, { assetPath, sha256: hashFile(file), vertices: primitive.positions.length / 3,
        indices: Array.from(primitive.indices), fullIndicesSHA256: sha256(JSON.stringify(Array.from(primitive.indices))) }];
}));
assert.equal(fs.existsSync(out), false, 'output directory already exists');
fs.mkdirSync(out, { recursive: true });
const disk = fs.statfsSync(out), availableBytes = Number(disk.bavail) * Number(disk.bsize);
const report = { version: 2, qualificationId: manifest.qualificationId, historicalReplay: false,
    createdAt: new Date().toISOString(), completed: false, mode: mode.slice(2),
    head: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT, encoding: 'utf8' }).trim(),
    manifestSHA256, manifest, sourceHashes: manifest.sourceHashes, disk: { availableBytes, minimumCaptureFreeBytes: 4 * 1024 ** 3 },
    sourceFreeze: [], runs: [], plannedCases, qualificationCaptureComplete: false,
    foundationSources: Object.fromEntries(Object.entries(foundationTopology).map(([id, { indices, ...metadata }]) => [id, { ...metadata, fullTriangles: indices.length / 3 }])),
    smokeSlice: smokeFoundation ? `Only accepted-installed/bob02/mild/${smokeFoundation}. Tests adapter mechanics, not the full comparison.` : null,
    timing: { nativeUpdatesHz: 60, imageSamplingHz: 20, numericalEverySteps: 30, densePeakOffsets: [-2, -1, 0, 1, 2],
        fixedAnchors: [98, 99, 270, 720], commandBoundary: 'Commands are issued after rendering the named step and before its snapshot; geometry changes on the next native update.' },
    apiRecipe: { expressive: { text: 'Closer, then farther.', speechPlan: SPEECH_PLAN,
        calls: ['feel(label,1)', 'feel(pad)', 'say(text,{speechPlan})', 'feel(label,1)', 'feel(pad)'] },
        mild: { lookSelector: '#look-toward-me', releaseSelector: '#release-attention', expression: 'neutral' },
        foundation: { beforeCaptureClock: true, calls: ["wardrobeAssets.foundation.prefer('TORSO',foundation)", "dress(['female_casualsuit01','shoes01'])"] } },
    scope: 'New current-runtime qualification, not recovery of historical mild poses or masks. Exact manifest GLB bytes pass through the real native wardrobe loader. Native 60Hz updates, 20Hz ordinary images and discrete CPU-skinned geometry snapshots during WebGPU rendering. No continuous collision proof, numerical fit, asset export, mask change, hair change or promotion.' };
const save = () => fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2) + '\n');
fs.writeFileSync(path.join(out, 'manifest.json'), manifestBytes, { flag: 'wx' });
save();
if (mode === '--preflight') {
    report.completed = true; report.preflightOnly = true; save();
    console.log(JSON.stringify({ preflight: true, qualificationId: manifest.qualificationId, assets: assets.map(({ role, assetPath, sha256 }) => ({ role, assetPath, sha256 })), availableBytes }));
    process.exit(0);
}
assert.ok(availableBytes >= report.disk.minimumCaptureFreeBytes, 'Insufficient free disk for the bounded capture; inspect preflight disk report');
for (const file of Object.keys(manifest.sourceHashes).filter(file => !file.startsWith('assets/'))) {
    const destination = path.join(out, 'source', file);
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.copyFileSync(path.join(ROOT, file), destination, fs.constants.COPYFILE_EXCL);
    assert.equal(hashFile(destination), manifest.sourceHashes[file]);
    report.sourceFreeze.push({ file: 'source/' + file, sha256: manifest.sourceHashes[file] });
}
const server = await createServer({ configFile: path.join(ROOT, 'vite.config.js'),
    server: { host: '127.0.0.1', port: 5359, strictPort: true, hmr: false, watch: { ignored: ['**'] }, fs: { allow: [ROOT] } }, logLevel: 'error' });
let browser;
try {
    await server.listen(); browser = await launchProbeBrowser();
    for (const { hair, sequence, foundation, role } of plannedCases) {
        const asset = assets.find(asset => asset.role === role);
        verifyCaptureInputs(manifest);
        assert.equal(hashFile(manifestPath), manifestSHA256, 'manifest changed during capture');
        const profile = PROFILES[sequence], name = `${hair}-${sequence}-${foundation}-${asset.role}`, directory = path.join(out, name);
        fs.mkdirSync(directory);
        const rec = { name, hair, sequence, foundation, asset: { assetPath: asset.assetPath, sha256: asset.sha256, role: asset.role },
            errors: [], loadedAssets: [], loadedFoundations: [], routeFulfillments: [], images: [], geometry: [], states: [], commands: [] };
        report.runs.push(rec); save();
        const reads = [], page = await browser.newPage({ viewport: CAMERA.viewport, deviceScaleFactor: CAMERA.deviceScaleFactor, reducedMotion: 'no-preference' });
        const routePattern = /\/assets\/wardrobe\/female_casualsuit01\/g050\.glb(?:\?.*)?$/;
        page.on('pageerror', error => rec.errors.push({ kind: 'pageerror', message: String(error) }));
        page.on('console', message => { if (message.type() === 'error') rec.errors.push({ kind: 'console', message: message.text() }); });
        page.on('requestfailed', request => rec.errors.push({ kind: 'requestfailed', url: request.url(), message: request.failure()?.errorText }));
        page.on('response', response => {
            if (response.status() >= 400) rec.errors.push({ kind: 'http', status: response.status(), url: response.url() });
            if (response.ok() && routePattern.test(response.url()) && !new URL(response.url()).searchParams.has('import'))
                reads.push(response.body().then(bytes => rec.loadedAssets.push({ url: response.url(), sha256: sha256(bytes), bytes: bytes.length })));
            const foundationMatch = response.url().match(/\/assets\/wardrobe\/(foundation_bra|foundation_vest)\/g050\.glb(?:\?.*)?$/);
            if (response.ok() && foundationMatch && !new URL(response.url()).searchParams.has('import'))
                reads.push(response.body().then(bytes => rec.loadedFoundations.push({ id: foundationMatch[1], url: response.url(), sha256: sha256(bytes), bytes: bytes.length })));
        });
        await page.route(routePattern, async route => {
            if (new URL(route.request().url()).searchParams.has('import')) return route.continue();
            assert.equal(sha256(asset.bytes), asset.sha256, 'frozen response buffer changed');
            rec.routeFulfillments.push({ url: route.request().url(), sha256: asset.sha256 });
            await route.fulfill({ status: 200, contentType: 'model/gltf-binary', body: asset.bytes });
        });
        const state = () => page.evaluate(async () => ({ physical: await helper.physical(avatar),
            bones: Array.from(avatar.figure.body.skeleton.boneMatrices), morphs: Array.from(avatar.figure.body.morphTargetInfluences),
            poseMeshes: Object.fromEntries([['body', avatar.figure.body], ['female_casualsuit01', avatar.wardrobe.wornMeshes.get('female_casualsuit01')]].map(([id, mesh]) =>
                [id, { bones: Array.from(mesh.skeleton.boneMatrices), morphs: Array.from(mesh.morphTargetInfluences ?? []) }])),
            rendererFrame: avatar.stage.renderer._nodes.nodeFrame.frameId, affect: avatar.report().affect,
            gesture: avatar.gesture.report(), attention: showcase.attention.report() }));
        try {
            const preset = hair === 'bob02' ? 'casual' : 'elegant';
            rec.url = `http://127.0.0.1:5359/src/showcase.html?preset=${preset}&outfit=casual&style=ecru&frame=portrait&capture=`;
            await page.goto(rec.url);
            await page.waitForFunction(() => window.showcase || !document.querySelector('#error').hidden, null, { timeout: 120000 });
            assert.equal(await page.locator('#error').textContent(), '');
            await Promise.all(reads);
            assert.equal(rec.loadedAssets.length, 1, 'exactly one actual garment response required');
            assert.equal(rec.routeFulfillments.length, 1, 'exactly one actual garment route required');
            assert.equal(rec.loadedAssets[0].sha256, asset.sha256, 'native loader received different garment bytes');
            rec.foundationPreparation = await page.evaluate(async foundation => {
                const a = showcase.avatar, before = { clock: a.clockSeconds, foundation: a.report().wardrobe.foundation };
                a.wardrobeAssets.foundation.prefer('TORSO', foundation);
                await a.dress(['female_casualsuit01', 'shoes01']);
                const actualIds = [...a.wardrobe.wornMeshes.keys()].sort();
                const expectedIds = [foundation, 'foundation_briefs', 'female_casualsuit01', 'shoes01'].sort();
                if (JSON.stringify(actualIds) !== JSON.stringify(expectedIds)) throw Error('Wrong actual native foundation/outfit set: ' + actualIds);
                const after = { clock: a.clockSeconds, foundation: a.report().wardrobe.foundation };
                if (before.clock !== after.clock) throw Error('Dressing advanced the capture simulation');
                return { before, after, actualIds, apis: ["wardrobeAssets.foundation.prefer('TORSO',foundation)", "dress(['female_casualsuit01','shoes01'])"] };
            }, foundation);
            await Promise.all(reads);
            const selectedResponses = rec.loadedFoundations.filter(item => item.id === foundation);
            assert.equal(selectedResponses.length, 1, 'one selected native foundation response required');
            assert.equal(selectedResponses[0].sha256, foundationTopology[foundation].sha256, 'native foundation bytes drift');
            rec.setup = await page.evaluate(async ({ root, hair, role, foundation, camera, seed, nativeBakeName }) => {
                window.avatar = showcase.avatar;
                window.helper = await import('/@fs' + root + '/tools/figure-pipeline/collar_capture_browser.mjs');
                const a = avatar, inner = a.wardrobe.fragments.get('female_casualsuit01').interior;
                if (a.stage.backendName !== 'webgpu') throw Error('Native WebGPU required');
                if (a.report().hair.loadedStyle !== hair) throw Error('Wrong current hair preset');
                if (a.report().identity.bake !== nativeBakeName) throw Error('Only native ' + nativeBakeName + ' is qualified');
                if (role === 'accepted-installed' ? inner !== null : !inner || inner.fullTriangles !== 140) throw Error('Unexpected interior ownership');
                if (a.report().wardrobe.foundation.TORSO !== foundation) throw Error('Selected native foundation required');
                showcase.controls.target.copy(a.focus); showcase.controls.target.y += .045;
                window.probe = await helper.setup(a, { arm: 'owned', motion: 'natural', yaw: camera.initialYawDegrees });
                const c = a.stage.camera, target = a.focus.clone(); target.y += camera.focusYOffsetMetres;
                const radius = Math.hypot(c.position.x - target.x, c.position.z - target.z) * camera.horizontalRadiusScale;
                const angle = camera.yawDegrees * Math.PI / 180;
                c.position.set(target.x + Math.sin(angle) * radius, target.y + camera.cameraHeightAboveTargetMetres, target.z + Math.cos(angle) * radius); c.lookAt(target);
                showcase.controls.target.copy(target); showcase.controls.minDistance = radius * .7; showcase.controls.maxDistance = radius * 1.5;
                showcase.controls.update(); showcase.controls.saveState();
                for (let i = 0; i < 128; i++) await helper.draw(a);
                if (a.report().motion.seed !== seed) throw Error('Unexpected native seed');
                const adapter = await navigator.gpu.requestAdapter(), info = adapter.info;
                return { seed, identity: a.report().identity, quality: a.report().quality, configuration: showcase.configuration(), foundation: a.report().wardrobe.foundation,
                    interiorTriangles: inner?.fullTriangles ?? 0, capture: probe.setupReport,
                    camera: { position: c.position.toArray(), quaternion: c.quaternion.toArray(), projection: c.projectionMatrix.toArray(), target: target.toArray() },
                    gpu: { vendor: info.vendor, architecture: info.architecture, device: info.device, description: info.description,
                        isFallbackAdapter: info.isFallbackAdapter ?? adapter.isFallbackAdapter ?? null } };
            }, { root: ROOT, hair, role: asset.role, foundation, camera: CAMERA, seed: manifest.seed, nativeBakeName: NATIVE_BAKE_NAME });
            const snapshotSteps = baseSnapshotSteps(sequence);
            for (let step = 0; step <= profile.steps; step++) {
                if (step) await page.evaluate(() => helper.step(avatar, 1 / 60));
                const phase = profile.phases?.find(phase => phase.step === step);
                if (phase) {
                    const actual = await page.evaluate(async ({ phase, speechPlan }) => {
                        avatar.feel(phase.label, 1); avatar.feel(phase.pad);
                        await avatar.say('Closer, then farther.', { speechPlan });
                        avatar.feel(phase.label, 1); avatar.feel(phase.pad);
                        return { schedule: structuredClone(avatar.gesture.schedule), clock: avatar.clockSeconds,
                            target: { ...avatar.affectState.target }, attention: showcase.attention.report() };
                    }, { phase, speechPlan: SPEECH_PLAN });
                    const peaks = addSchedulePeaks(snapshotSteps, actual.schedule, step, profile.steps);
                    rec.commands.push({ ...phase, apis: ['feel(label,1)', 'feel(pad)', 'say(text,{speechPlan})', 'feel(label,1)', 'feel(pad)'], actual, snapshotPeaks: peaks });
                }
                for (const action of profile.actions?.filter(action => action.step === step) ?? []) {
                    const before = await page.evaluate(() => ({ clock: avatar.clockSeconds, attention: showcase.attention.report(), target: { ...avatar.affectState.target } }));
                    await page.locator('#' + action.action).click();
                    const after = await page.evaluate(() => ({ clock: avatar.clockSeconds, attention: showcase.attention.report(), target: { ...avatar.affectState.target } }));
                    assert.deepEqual(after.target, { pleasure: 0, arousal: 0, dominance: 0 }, 'mild attention changed neutral affect target');
                    assert.equal(after.clock, before.clock, 'UI action advanced simulation clock');
                    if (action.action === 'look-toward-me') { assert.equal(after.attention.phase, 'attending'); assert.equal(after.attention.expression, 'neutral'); }
                    if (action.action === 'release-attention') assert.equal(after.attention.phase, 'releasing', 'actual explicit release did not enter releasing');
                    rec.commands.push({ ...action, nativeUI: true, before, after });
                }
                if (step % profile.imageEvery === 0) {
                    const file = `${name}/frame-${String(step).padStart(4, '0')}.png`, bytes = await page.locator('#stage').screenshot();
                    fs.writeFileSync(path.join(out, file), bytes, { flag: 'wx' });
                    rec.images.push({ step, file, sha256: sha256(bytes) }); rec.states.push({ step, ...await state() });
                }
                if (snapshotSteps.has(step)) {
                    const geometry = await page.evaluate(foundation => {
                        const result = helper.snapshot(avatar), inner = avatar.wardrobe.fragments.get('female_casualsuit01').interior?.mesh;
                        for (const id of ['body', foundation, 'female_casualsuit01'])
                            if (!result.meshes.some(mesh => mesh.id === id)) throw Error('Missing capture mesh: ' + id);
                        if (inner) {
                            inner.updateMatrixWorld(true); inner.skeleton?.update();
                            const vertex = avatar.focus.clone(), positions = new Float32Array(inner.geometry.attributes.position.count * 3);
                            for (let i = 0; i < positions.length / 3; i++) inner.getVertexPosition(i, vertex).applyMatrix4(inner.matrixWorld).toArray(positions, i * 3);
                            const { start, count } = inner.geometry.drawRange;
                            result.lining = { positions: Array.from(positions), indices: Array.from(inner.geometry.index.array.slice(start, start + count)) };
                        }
                        result.telemetry = { affect: avatar.report().affect, gesture: avatar.gesture.report(), attention: showcase.attention.report() };
                        return result;
                    }, foundation);
                    const actualFoundation = geometry.meshes.find(mesh => mesh.id === foundation), expectedFoundation = foundationTopology[foundation];
                    assert.equal(actualFoundation.positions.length / 3, expectedFoundation.vertices, 'native foundation vertex count changed');
                    assert.deepEqual(actualFoundation.fullIndices, expectedFoundation.indices, 'native foundation full topology changed');
                    geometry.capture = { qualificationId: manifest.qualificationId, manifestSHA256, asset: rec.asset, foundation, foundationSource: report.foundationSources[foundation], sequence, hair, step, nominalSeconds: step / 60 };
                    const file = `${name}/meshes-${step}.json.gz`, raw = JSON.stringify(geometry), bytes = gzipSync(raw);
                    fs.writeFileSync(path.join(out, file), bytes, { flag: 'wx' });
                    const pose = { clock: geometry.time, rigSHA256: sha256(JSON.stringify(geometry.rig)), meshes: {} };
                    for (const id of ['body', 'female_casualsuit01']) {
                        const mesh = geometry.meshes.find(mesh => mesh.id === id);
                        pose.meshes[id] = { positionsSHA256: sha256(JSON.stringify(mesh.positions)), fullIndicesSHA256: sha256(JSON.stringify(mesh.fullIndices)) };
                    }
                    rec.geometry.push({ step, time: geometry.time, file, sha256: sha256(bytes), decodedSHA256: sha256(raw), pose });
                }
                if (step % 60 === 0) save();
            }
            assert.deepEqual(rec.geometry.map(item => item.step), [...snapshotSteps].sort((a, b) => a - b), 'snapshot cadence incomplete');
            assert.equal(rec.images.length, profile.steps / profile.imageEvery + 1);
            assert.deepEqual(rec.errors, []);
            const programs = await page.evaluate(() => helper.programs(avatar));
            const shaderFile = `${name}/programs.json.gz`, shaderBytes = gzipSync(JSON.stringify(programs));
            fs.writeFileSync(path.join(out, shaderFile), shaderBytes, { flag: 'wx' }); rec.programs = { file: shaderFile, sha256: sha256(shaderBytes), count: programs.length };
        } catch (error) { rec.failure = error.stack; throw error; }
        finally {
            try {
                rec.disposal = await page.evaluate(() => {
                    const a = window.avatar ?? window.showcase?.avatar;
                    if (!a) return null;
                    const renderer = a.stage.renderer; showcase.attention.dispose(); showcase.controls.dispose();
                    if (window.probe) helper.dispose(a, probe); else a.dispose();
                    return { memory: structuredClone(renderer.info.memory), leaks: a.leakedHandles() };
                });
            } finally { await page.close(); save(); }
        }
        assert.ok(Object.values(rec.disposal.memory).every(value => value === 0)); assert.deepEqual(rec.disposal.leaks, []);
        assert.deepEqual(rec.errors, [], 'late browser error during final sampling or disposal');
        verifyCaptureInputs(manifest);
        rec.completed = true;
        console.log(`Completed ${name}: ${rec.images.length} images, ${rec.geometry.length} discrete snapshots`);
    }
    // The compared garment must not alter the native physical inputs, motion or schedule.
    if (mode === '--capture') for (const hair of manifest.hairs) for (const sequence of manifest.sequences) for (const foundation of manifest.foundations) {
        const runs = report.runs.filter(run => run.hair === hair && run.sequence === sequence && run.foundation === foundation);
        const control = runs.find(run => run.asset.role === 'accepted-installed');
        const others = runs.filter(run => run !== control);
        for (const other of others) { assert.deepEqual(other.states, control.states, 'paired native physical/affect/attention state drift'); assert.deepEqual(other.commands, control.commands, 'paired actual schedule/action drift'); }
    }
    report.foundationPoseComparisons = [];
    if (mode === '--capture') for (const hair of manifest.hairs) for (const sequence of manifest.sequences) for (const asset of assets) {
        const runs = report.runs.filter(run => run.hair === hair && run.sequence === sequence && run.asset.role === asset.role);
        const bra = runs.find(run => run.foundation === 'foundation_bra'), vest = runs.find(run => run.foundation === 'foundation_vest');
        report.foundationPoseComparisons.push({ hair, sequence, assetRole: asset.role, ...comparePoseFamilies(bra, vest) });
    }
    assert.equal(report.runs.length, plannedCases.length, 'planned run subset incomplete');
    verifyCaptureInputs(manifest); assert.equal(hashFile(manifestPath), manifestSHA256, 'manifest drift');
    report.qualificationCaptureComplete = mode === '--capture';
    report.completed = true;
} catch (error) { report.failure = error.stack; process.exitCode = 1; }
finally { save(); await browser?.close(); await server.close(); console.log(JSON.stringify({ completed: report.completed, failure: report.failure })); }
