// Read sealed native primary output and measure the retained diagnostic face selections.
// node .../analyze-attribution.mjs --capture=/absolute/native-directory --out=/fresh/directory
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { gunzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { createHandGeometryAudit } from './geometry-audit.mjs';

const root = fileURLToPath(new URL('../../../../', import.meta.url));
const arg = name => process.argv.find(s => s.startsWith('--' + name + '='))?.slice(name.length + 3);
const capture = arg('capture') && path.resolve(arg('capture')), out = arg('out') && path.resolve(arg('out'));
assert.ok(capture && out && !fs.existsSync(out), 'A captured primary directory and fresh output directory are required');
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const hash = p => sha(fs.readFileSync(p));
const reportPath = path.join(capture, 'report.json'), rawReport = fs.readFileSync(reportPath), sourceReport = JSON.parse(rawReport);
const rawSeal = fs.readFileSync(path.join(capture, 'seal.json')), seal = JSON.parse(rawSeal);
assert.equal(seal.reportSHA256, sha(rawReport)); assert.equal(seal.mode, 'primary');
assert.equal(seal.manifestSHA256, sourceReport.manifestSHA256);
assert.equal(sourceReport.version, 1); assert.equal(sourceReport.mode, 'primary'); assert.equal(sourceReport.completed, true);
assert.deepEqual(sourceReport.errors ?? [], []); assert.ok(!sourceReport.failure);
const manifestPath = path.join(capture, 'manifest.json'), rawManifest = fs.readFileSync(manifestPath), manifest = JSON.parse(rawManifest);
// This postprocessor admits the reviewed v4 protocol, not any self-resealed subset.
assert.equal(sha(rawManifest), 'fc0e017fba7da12f6c511b53e705b2441b440fa8cb8731bd65f36a839514793d');
assert.equal(sha(rawManifest), sourceReport.manifestSHA256);
assert.equal(sourceReport.studyId, manifest.studyId); assert.equal(manifest.studyId, 'hand-attribution-2026-09-26-v1');
assert.deepEqual(sourceReport.sourceHashes, manifest.sourceHashes);
assert.deepEqual(manifest.arms, ['A', 'B', 'C']); assert.deepEqual(sourceReport.runs.map(r => r.arm), manifest.arms);
assert.equal(manifest.timing.steps, 720); assert.equal(manifest.timing.fps, 60);
const expectedSteps = manifest.planned.numericalSteps;
assert.equal(expectedSteps.length, 109); assert.equal(manifest.planned.count, 109);
const inside = file => { const p = path.resolve(capture, file); assert.ok(p.startsWith(capture + path.sep), 'Record must be inside capture'); return p; };
const stateBindings = [];
for (const run of sourceReport.runs) {
    assert.equal(run.completed, true); assert.deepEqual(run.errors, []); assert.ok(!run.failure && !run.disposalFailure);
    assert.deepEqual(run.plannedNumericalSteps, expectedSteps, 'Run must retain all 109 planned steps');
    assert.deepEqual(run.geometry.map(g => g.step), expectedSteps, 'Geometry must retain all 109 planned steps');
    assert.equal(run.disposal.disposed, true); assert.deepEqual(run.disposal.leaks, []);
    assert.ok(Object.keys(run.disposal.memory).length > 0 && Object.values(run.disposal.memory).every(v => v === 0));
    assert.equal(run.disposal.instrument.status, 'disposed'); assert.equal(run.disposal.instrument.failure, null);
    assert.deepEqual(run.disposal.instrument.cleanup.lost, []);
    assert.deepEqual(run.commands.map(c => c.step), [0, 360]);
    assert.equal(run.states.count, 721);
    const raw = fs.readFileSync(inside(run.states.file)); assert.equal(sha(raw), run.states.sha256);
    const decoded = gunzipSync(raw); assert.equal(sha(decoded), run.states.decodedSHA256);
    const states = JSON.parse(decoded); assert.equal(states.length, 721);
    states.forEach((state, step) => { assert.equal(state.step, step); assert.equal(state.instrument.arm, run.arm);
        assert.equal(state.instrument.status, 'active'); assert.equal(state.instrument.failure, null); });
    stateBindings.push({ arm: run.arm, ...run.states });
}
const reproduction = sourceReport.runs[0].oldReproduction;
const geometryGate = 'time/rig/all mesh positions/full+drawn indices under recorded JSON signed-zero policy';
const physicalGate = 'full helper physical including camera, centrelines, GPU vertices, cards, clock under recorded JSON signed-zero policy';
assert.equal(reproduction.length, 7);
for (const [steps, exact] of [[manifest.timing.oldGeometrySteps, geometryGate], [manifest.timing.oldPhysicalSteps, physicalGate]]) {
    for (const step of steps) { const hits = reproduction.filter(r => r.step === step && r.exact === exact);
        assert.equal(hits.length, 1); assert.equal(hits[0].passed, true); }
}
const auditFiles = ['docs/evidence/nonhair-2026-09-26/hand-clearance/analyze-attribution.mjs',
    'docs/evidence/nonhair-2026-09-26/hand-clearance/geometry-audit.mjs', 'tools/lut-bake/glb.mjs',
    'tools/figure-pipeline/hair_surface.mjs', 'assets/wardrobe/body/g050.glb', 'assets/wardrobe/female_casualsuit01/g050.glb'];
const sourceHashes = Object.fromEntries(auditFiles.map(p => [p, hash(root + p)]));
// Native-loaded sources must match the capture. The intersection predicate is a
// separately hash-bound analysis dependency; it is never loaded by the native run.
for (const p of [auditFiles[2], auditFiles[4], auditFiles[5]]) assert.equal(sourceHashes[p], sourceReport.sourceHashes[p], 'Captured geometry source differs: ' + p);
assert.equal(sourceHashes[auditFiles[3]], '9afeedd9d9c120d1d6abb8c0dcaf98bc940269227b9c1451e461a39414a85794', 'Reviewed intersection predicate changed');
const audit = createHandGeometryAudit({ bodyPath: root + auditFiles[4], garmentPath: root + auditFiles[5] });
const retained = JSON.parse(fs.readFileSync(new URL('./retained-witness.json', import.meta.url)));
assert.equal(hash(fileURLToPath(new URL('./retained-witness.json', import.meta.url))), '39639e07c9cb47c07bad6ed8a8a0502d7aeafade3478b51d83218968e364f377');
const result = { version: 1, createdAt: new Date().toISOString(), completed: false,
    captureDirectory: capture, captureReportSHA256: sha(rawReport), captureSealSHA256: sha(rawSeal), manifestSHA256: sourceReport.manifestSHA256,
    sourceHashes, stateBindings, method: audit.method, components: audit.components, runs: [], comparisons: [],
    scope: 'Diagnostic attribution from sealed CPU-skinned native snapshots and actual loaded wardrobe-body source. Same selected hand/trouser/lower-body regions as retained receipt. Pair counts are not severity or positive clearance; no production correction qualified.' };
fs.mkdirSync(out, { recursive: true });
const save = () => fs.writeFileSync(path.join(out, 'analysis.json'), JSON.stringify(result, null, 2) + '\n');
save();
try {
    for (const run of sourceReport.runs) {
        assert.equal(run.completed, true); assert.deepEqual(run.errors ?? [], []); assert.ok(!run.failure);
        const rec = { arm: run.arm, poses: [] }; result.runs.push(rec);
        let previous = -1;
        for (const entry of run.geometry) {
            assert.ok(Number.isInteger(entry.step) && entry.step > previous && entry.step <= 720); previous = entry.step;
            const p = path.resolve(capture, entry.file); assert.ok(p.startsWith(capture + path.sep), 'Snapshot must be inside captured directory');
            const bytes = fs.readFileSync(p); assert.equal(sha(bytes), entry.sha256);
            const decoded = gunzipSync(bytes); assert.equal(sha(decoded), entry.decodedSHA256);
            const snapshot = JSON.parse(decoded);
            assert.equal(snapshot.capture.arm, run.arm); assert.equal(snapshot.capture.step, entry.step);
            assert.equal(snapshot.capture.manifestSHA256, result.manifestSHA256); assert.equal(snapshot.capture.mode, 'primary');
            assert.equal(snapshot.time, entry.time);
            const measured = audit.analyze(snapshot);
            if (run.arm === 'A' && [0, 637, 720].includes(entry.step)) {
                const old = retained.poses.find(p => p.step === entry.step);
                assert.deepEqual(measured.sides, old.sides, 'A must reproduce exact retained counts/witnesses at ' + entry.step);
            }
            rec.poses.push({ step: entry.step, time: measured.time, file: entry.file,
                sha256: entry.sha256, decodedSHA256: entry.decodedSHA256, sides: measured.sides });
        }
        for (const step of [0, 637, 720]) assert.ok(rec.poses.some(p => p.step === step));
        save(); console.log(`Measured ${run.arm}: ${rec.poses.length} discrete snapshots`);
    }
    const control = result.runs.find(r => r.arm === 'A');
    for (const candidate of result.runs.filter(r => r.arm !== 'A')) {
        assert.deepEqual(candidate.poses.map(p => p.step), control.poses.map(p => p.step), 'Matched discrete sampling required');
        const comparison = { arm: candidate.arm, samples: [] };
        for (let i = 0; i < control.poses.length; i++) {
            const a = control.poses[i], b = candidate.poses[i]; assert.equal(a.time, b.time);
            const sides = {};
            for (const side of ['l', 'r']) sides[side] = Object.fromEntries(['trousers', 'lowerBody'].map(target =>
                [target, { controlPairs: a.sides[side][target].pairs, candidatePairs: b.sides[side][target].pairs,
                    deltaPairs: b.sides[side][target].pairs - a.sides[side][target].pairs }]));
            comparison.samples.push({ step: a.step, time: a.time, sides });
        }
        result.comparisons.push(comparison);
    }
    assert.equal(hash(reportPath), result.captureReportSHA256, 'Capture report changed during analysis');
    assert.equal(hash(path.join(capture, 'seal.json')), result.captureSealSHA256, 'Capture seal changed during analysis');
    assert.equal(hash(manifestPath), result.manifestSHA256, 'Capture manifest changed during analysis');
    for (const entry of stateBindings) assert.equal(hash(inside(entry.file)), entry.sha256, 'State archive changed during analysis');
    for (const [p, expected] of Object.entries(sourceHashes)) assert.equal(hash(root + p), expected, 'Analysis input changed: ' + p);
    const csv = ['arm,step,time,left_trouser_pairs,right_trouser_pairs,left_lowerbody_pairs,right_lowerbody_pairs'];
    for (const r of result.runs) for (const p of r.poses) csv.push([r.arm, p.step, p.time, p.sides.l.trousers.pairs,
        p.sides.r.trousers.pairs, p.sides.l.lowerBody.pairs, p.sides.r.lowerBody.pairs].join(','));
    const bytes = csv.join('\n') + '\n'; fs.writeFileSync(path.join(out, 'selected-pair-counts.csv'), bytes);
    result.csv = { file: 'selected-pair-counts.csv', sha256: sha(bytes) }; result.completed = true;
    result.finishedAt = new Date().toISOString(); save();
} catch (error) { result.failure = error.stack; save(); throw error; }
