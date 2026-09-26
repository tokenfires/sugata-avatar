// Read-only archive verification and compact receipt. No browser, GPU or asset writes.
// node docs/evidence/collar-2026-09-26/replacement-capture/verify-capture.mjs ARCHIVE FRESH_RECEIPT.json [--partial]
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { gunzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';

assert.ok([4, 5].includes(process.argv.length), 'ARCHIVE FRESH_RECEIPT.json [--partial] required');
const partial = process.argv[4] === '--partial';
if (process.argv.length === 5) assert.equal(partial, true, 'unknown mode');
const archive = path.resolve(process.argv[2]), output = path.resolve(process.argv[3]);
assert.equal(fs.existsSync(output), false, 'receipt already exists');
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const reportBytes = fs.readFileSync(path.join(archive, 'report.json'));
const report = JSON.parse(reportBytes);
assert.equal(report.completed, !partial, 'explicit --partial required for incomplete capture');
if (partial) assert.equal(report.qualificationCaptureComplete, false);
else assert.equal(report.failure, undefined);
assert.equal(report.manifestSHA256, hash(fs.readFileSync(path.join(archive, 'manifest.json'))));
assert.deepEqual(JSON.parse(fs.readFileSync(path.join(archive, 'manifest.json'))), report.manifest);
assert.equal(report.qualificationId, 'collar-replacement-2026-09-26-v1');
assert.equal(report.historicalReplay, false);
const manifest = report.manifest;
assert.equal(manifest.version, 2);
assert.deepEqual(manifest.foundations, ['foundation_bra', 'foundation_vest']);
let artifactFiles = 0, decodedSnapshots = 0;
function readBound(entry) {
    const file = path.resolve(archive, entry.file);
    assert.ok(file.startsWith(archive + path.sep), 'archive path escape');
    const bytes = fs.readFileSync(file);
    assert.equal(hash(bytes), entry.sha256, 'artifact digest mismatch: ' + entry.file);
    artifactFiles++;
    return bytes;
}
for (const entry of report.sourceFreeze) {
    assert.equal(entry.sha256, manifest.sourceHashes[entry.file.replace(/^source\//, '')]);
    readBound(entry);
}
assert.equal(report.sourceFreeze.length, Object.keys(manifest.sourceHashes).filter(file => !file.startsWith('assets/')).length);
const runs = [], complete = report.runs.filter(run => run.completed);
for (const run of complete) {
    assert.equal(run.completed, true, 'run incomplete: ' + run.name);
    assert.equal(run.failure, undefined);
    assert.deepEqual(run.errors, []);
    assert.deepEqual(run.disposal.leaks, []);
    assert.ok(Object.values(run.disposal.memory).every(value => value === 0));
    assert.deepEqual(run.asset, manifest.assets.find(asset => asset.role === run.asset.role));
    assert.equal(run.loadedAssets.length, 1);
    assert.equal(run.loadedAssets[0].sha256, run.asset.sha256);
    const selected = run.loadedFoundations.filter(item => item.id === run.foundation);
    assert.equal(selected.length, 1);
    assert.equal(selected[0].sha256, report.foundationSources[run.foundation].sha256);
    assert.deepEqual(run.foundationPreparation.actualIds, [run.foundation, 'foundation_briefs', 'female_casualsuit01', 'shoes01'].sort());
    assert.equal(run.foundationPreparation.before.clock, run.foundationPreparation.after.clock);
    assert.equal(run.setup.foundation.TORSO, run.foundation);
    const profile = manifest.profiles[run.sequence];
    assert.equal(run.images.length, profile.steps / profile.imageEvery + 1);
    assert.deepEqual(run.images.map(image => image.step), Array.from({ length: run.images.length }, (_, i) => i * profile.imageEvery));
    for (const entry of run.images) readBound(entry);
    readBound(run.programs);
    const snapshots = [];
    for (const entry of run.geometry) {
        const raw = gunzipSync(readBound(entry));
        assert.equal(hash(raw), entry.decodedSHA256);
        const snapshot = JSON.parse(raw); decodedSnapshots++;
        assert.equal(snapshot.capture.manifestSHA256, report.manifestSHA256);
        assert.equal(snapshot.capture.step, entry.step);
        assert.equal(snapshot.capture.foundation, run.foundation);
        assert.deepEqual(snapshot.capture.asset, run.asset);
        const foundation = snapshot.meshes.find(mesh => mesh.id === run.foundation);
        assert.equal(foundation.positions.length / 3, report.foundationSources[run.foundation].vertices);
        assert.equal(hash(JSON.stringify(foundation.fullIndices)), report.foundationSources[run.foundation].fullIndicesSHA256);
        assert.equal(snapshot.meshes.some(mesh => mesh.id === (run.foundation === 'foundation_bra' ? 'foundation_vest' : 'foundation_bra')), false);
        const pose = { clock: snapshot.time, rigSHA256: hash(JSON.stringify(snapshot.rig)), meshes: {} };
        for (const id of ['body', 'female_casualsuit01']) {
            const mesh = snapshot.meshes.find(mesh => mesh.id === id);
            pose.meshes[id] = { positionsSHA256: hash(JSON.stringify(mesh.positions)), fullIndicesSHA256: hash(JSON.stringify(mesh.fullIndices)) };
        }
        assert.deepEqual(pose, entry.pose, 'posed comparison digest does not match saved geometry');
        snapshots.push({ ...entry, meshCounts: snapshot.meshes.map(mesh => ({ id: mesh.id, vertices: mesh.positions.length / 3,
            fullTriangles: mesh.fullIndices.length / 3, drawnTriangles: mesh.drawnIndices.length / 3 })) });
    }
    runs.push({ name: run.name, hair: run.hair, sequence: run.sequence, foundation: run.foundation, asset: run.asset,
        completed: run.completed, loadedAssets: run.loadedAssets, loadedFoundations: run.loadedFoundations,
        foundationPreparation: run.foundationPreparation, setup: run.setup, commands: run.commands,
        imageCount: run.images.length, images: run.images, snapshotCount: snapshots.length, snapshots,
        finalAttention: run.states.at(-1).attention, disposal: run.disposal, errors: run.errors });
}
if (!partial) assert.equal(report.runs.length, report.plannedCases.length);
const completeDecodedSnapshots = decodedSnapshots;
const retainedInterruptedRuns = report.runs.filter(run => !run.completed).map(run => {
    for (const entry of run.images) readBound(entry);
    for (const entry of run.geometry) { assert.equal(hash(gunzipSync(readBound(entry))), entry.decodedSHA256); decodedSnapshots++; }
    if (run.programs) readBound(run.programs);
    return { name: run.name, hair: run.hair, sequence: run.sequence, foundation: run.foundation,
        asset: run.asset, images: run.images, geometry: run.geometry, stateCount: run.states.length,
        lastImageStep: run.images.at(-1)?.step, lastSnapshotStep: run.geometry.at(-1)?.step,
        failure: run.failure, errors: run.errors, disposal: run.disposal ?? null,
        acceptanceInput: false, scope: 'Interrupted partial run retained exactly; successful disposal not established. Artifact hashes alone do not complete this case.' };
});
const pairedNativeStates = [], foundationPoseComparisons = [];
for (const control of complete.filter(run => run.asset.role === 'accepted-installed')) {
    for (const other of complete.filter(run => run.hair === control.hair && run.sequence === control.sequence && run.foundation === control.foundation && run !== control)) {
        assert.deepEqual(other.states, control.states, 'paired native state drift');
        assert.deepEqual(other.commands, control.commands, 'paired actual command drift');
        pairedNativeStates.push({ hair: control.hair, sequence: control.sequence, foundation: control.foundation,
            controlRole: control.asset.role, comparedRole: other.asset.role, equal: true, stateSamples: control.states.length });
    }
}
for (const bra of complete.filter(run => run.foundation === 'foundation_bra')) {
    const vest = complete.find(run => run.foundation === 'foundation_vest' && run.hair === bra.hair && run.sequence === bra.sequence && run.asset.role === bra.asset.role);
    if (!vest) continue;
    assert.equal(bra.states.length, vest.states.length); assert.equal(bra.geometry.length, vest.geometry.length);
    const differences = [];
    for (let i = 0; i < bra.states.length; i++) {
        const select = state => ({ step: state.step, clock: state.physical.clock, rendererFrame: state.rendererFrame,
            bones: state.bones, morphs: state.morphs, poseMeshes: state.poseMeshes });
        if (!isDeepStrictEqual(select(bra.states[i]), select(vest.states[i]))) differences.push({ kind: 'state', step: bra.states[i].step });
    }
    for (let i = 0; i < bra.geometry.length; i++) if (!isDeepStrictEqual(
        { step: bra.geometry[i].step, pose: bra.geometry[i].pose }, { step: vest.geometry[i].step, pose: vest.geometry[i].pose }))
        differences.push({ kind: 'geometry', step: bra.geometry[i].step });
    foundationPoseComparisons.push({ hair: bra.hair, sequence: bra.sequence, assetRole: bra.asset.role,
        classification: differences.length ? 'separate-actual-pose-families' : 'matched-sampled-poses',
        sameSampledPose: differences.length === 0, stateSamples: bra.states.length, geometrySamples: bra.geometry.length,
        differenceCount: differences.length, firstDifferences: differences.slice(0, 25),
        excludes: ['foundation geometry', 'drawn masks', 'foundation visibility', 'unsampled continuous poses'] });
}
const notStartedCases = report.plannedCases.filter(item => !report.runs.some(run => run.hair === item.hair && run.sequence === item.sequence && run.foundation === item.foundation && run.asset.role === item.role));
const receipt = { version: 2, verifiedAt: new Date().toISOString(), qualificationId: report.qualificationId,
    archivePath: path.relative(process.cwd(), archive), reportSHA256: hash(reportBytes), manifestSHA256: report.manifestSHA256,
    completed: report.completed, archiveVerificationCompleted: true, qualificationCaptureComplete: report.qualificationCaptureComplete, mode: report.mode,
    scope: 'Exact archive and loader receipts verified. Discrete native poses only; no continuous collision proof, coverage pass, fit improvement or candidate promotion.',
    foundationSources: report.foundationSources, foundationPoseComparisons, pairedNativeStates,
    timing: report.timing, plannedCases: report.plannedCases, notStartedCases, retainedInterruptedRuns,
    stopFailure: report.failure ?? null, verified: { artifactFiles, decodedSnapshots, completeDecodedSnapshots,
        completedRuns: complete.length, interruptedRuns: retainedInterruptedRuns.length, notStartedRuns: notStartedCases.length,
        frozenSourceFiles: report.sourceFreeze.length, manifestSourceFiles: Object.keys(manifest.sourceHashes).length }, runs };
fs.writeFileSync(output, JSON.stringify(receipt, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify({ receipt: output, qualificationCaptureComplete: receipt.qualificationCaptureComplete,
    runs: runs.length, images: runs.reduce((n, run) => n + run.imageCount, 0), ...receipt.verified }));
