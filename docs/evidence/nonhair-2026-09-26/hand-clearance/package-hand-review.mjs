// CPU-only packaging. No output exists until completed, sealed, matched native captures verify.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { gunzipSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url)), ROOT = path.resolve(HERE, '../../../..');
const ARMS = ['A', 'B', 'C'], CLOSE_STEPS = [0, 455, 637];
const LABELS = { A: 'Native', B: 'Suppress inward-posture delta only', C: 'Suppress gesture arm delta only' };
const NOTES = { A: 'Unfiltered native motion.', B: 'Only inward upper-arm deltas returned by posture are suppressed. Native posture updates and shared bookkeeping remain active.',
    C: 'Only returned gesture rotations for the upper and lower arms are suppressed. Native gesture updates and schedules remain active.' };
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
function within(directory, relative) {
    assert.equal(typeof relative, 'string'); assert.ok(relative && !path.isAbsolute(relative));
    const resolved = path.resolve(directory, relative);
    assert.ok(resolved.startsWith(path.resolve(directory) + path.sep), 'Capture path escapes its directory: ' + relative);
    return resolved;
}
function sealed(directory, mode) {
    const bytes = fs.readFileSync(path.join(directory, 'report.json'));
    const seal = JSON.parse(fs.readFileSync(path.join(directory, 'seal.json'))), report = JSON.parse(bytes);
    assert.equal(hash(bytes), seal.reportSHA256, mode + ' report seal'); assert.equal(seal.mode, mode);
    assert.equal(report.mode, mode); assert.equal(report.completed, true); assert.equal(report.failure, undefined);
    const manifestBytes = fs.readFileSync(path.join(directory, 'manifest.json')), manifest = JSON.parse(manifestBytes);
    assert.equal(hash(manifestBytes), seal.manifestSHA256); assert.equal(report.manifestSHA256, seal.manifestSHA256);
    assert.deepEqual(report.sourceHashes, manifest.sourceHashes);
    assert.deepEqual(report.runs.map(r => r.arm), ARMS);
    for (const r of report.runs) {
        assert.equal(r.completed, true); assert.equal(r.failure, undefined); assert.deepEqual(r.errors, []);
        assert.equal(r.disposal.disposed, true); assert.deepEqual(r.disposal.leaks, []);
        assert.ok(Object.values(r.disposal.memory).every(n => n === 0));
        assert.deepEqual(r.disposal.instrument.cleanup.lost, []);
    }
    return { report, manifest, reportSHA256: hash(bytes), sealSHA256: hash(fs.readFileSync(path.join(directory, 'seal.json'))) };
}
function boundJSON(directory, entry) {
    const bytes = fs.readFileSync(within(directory, entry.file)); assert.equal(hash(bytes), entry.sha256, entry.file);
    const raw = gunzipSync(bytes); assert.equal(hash(raw), entry.decodedSHA256, entry.file + ' decoded'); return JSON.parse(raw);
}
function png(directory, plate) {
    const bytes = fs.readFileSync(within(directory, plate.file)); assert.equal(hash(bytes), plate.sha256, plate.file);
    assert.equal(bytes.subarray(0, 8).toString('hex'), '89504e470d0a1a0a', 'PNG signature');
    assert.equal(bytes.subarray(12, 16).toString(), 'IHDR');
    const width = bytes.readUInt32BE(16), height = bytes.readUInt32BE(20); assert.ok(width > 0 && height > 0);
    return { bytes, width, height };
}
export function inspectSealedViews(input) {
    const views = sealed(input, 'views'), r = views.report, m = views.manifest;
    assert.equal(m.promotion, false); assert.equal(m.seed, 20260807); assert.equal(m.body, 'figure_g050'); assert.equal(m.hair, 'bob02');
    assert.equal(m.kind, 'new-disposable-prefix-attribution'); assert.deepEqual(m.arms, ARMS);
    assert.deepEqual(m.outfit, ['female_casualsuit01', 'shoes01']); assert.deepEqual(m.foundation, {TORSO: 'foundation_bra', HIPS: 'foundation_briefs'});
    assert.deepEqual(m.phases.map(p => [p.step, p.label]), [[0, 'happy'], [360, 'angry']]);
    assert.equal(m.timing.fps, 60); assert.equal(m.timing.steps, 720);
    const primaryPath = path.resolve(ROOT, r.primaryBinding.directory), primary = sealed(primaryPath, 'primary');
    assert.equal(primary.reportSHA256, r.primaryBinding.reportSHA256); assert.equal(primary.report.manifestSHA256, r.manifestSHA256);
    assert.deepEqual(primary.report.sourceHashes, r.sourceHashes);
    let sourceCount = 0;
    for (const [file, expected] of Object.entries(m.sourceHashes)) {
        assert.equal(hash(fs.readFileSync(within(input, 'source/' + file))), expected, 'frozen views source: ' + file); sourceCount++;
    }
    const fullSteps = m.planned.visualImageSteps, numericalSteps = m.planned.numericalSteps;
    assert.equal(fullSteps.length, 244); assert.equal(numericalSteps.length, 109);
    assert.equal(fullSteps[0], 0); assert.equal(fullSteps.at(-1), 720);
    assert.ok(fullSteps.every((n, i) => Number.isInteger(n) && (!i || n > fullSteps[i - 1])));
    assert.ok(CLOSE_STEPS.every(n => fullSteps.includes(n) && numericalSteps.includes(n)));
    const copies = [], controls = [];
    for (const run of r.runs) {
        const prior = primary.report.runs.find(p => p.arm === run.arm);
        const states = boundJSON(input, run.states), priorStates = boundJSON(primaryPath, prior.states);
        assert.equal(states.length, 721); assert.equal(priorStates.length, 721);
        assert.deepEqual(states.map(s => s.step), Array.from({length: 721}, (_, i) => i));
        assert.deepEqual(run.images.map(p => p.step), fullSteps);
        assert.deepEqual(run.viewParity.map(p => p.step), numericalSteps);
        assert.deepEqual(prior.geometry.map(p => p.step), numericalSteps);
        assert.ok(run.retainedComparisons.length > 0, 'Retained comparison receipts required');
        assert.ok(run.retainedComparisons.filter(p => !p.label.startsWith('observed projection field')).every(p => p.equal === true));
        for (const parity of run.viewParity) {
            const expected = prior.geometry.find(p => p.step === parity.step);
            assert.equal(parity.primaryDecodedSHA256, expected.decodedSHA256); assert.equal(parity.semanticEqual, true);
            assert.deepEqual(parity.pose, expected.pose);
            assert.deepEqual(parity.invariantFields, ['hairPositions', 'hairVelocities', 'head', 'clock', 'steps']);
            boundJSON(primaryPath, expected);
        }
        const control = { id: run.arm, label: LABELS[run.arm], note: NOTES[run.arm], fullBody: [], close: [] };
        let dimensions = null;
        for (const sample of run.images) {
            assert.equal(sample.semanticUnchanged, true);
            assert.deepEqual(sample.zeroDeltaPhysicalGuard, ['hairPositions', 'hairVelocities', 'head', 'clock', 'steps']);
            const expectedViews = CLOSE_STEPS.includes(sample.step) ? ['front-full-body', 'left-hand-hip', 'right-hand-hip'] : ['front-full-body'];
            assert.deepEqual(sample.plates.map(p => p.view), expectedViews);
            for (const plate of sample.plates) {
                const image = png(input, plate); dimensions ??= [image.width, image.height]; assert.deepEqual([image.width, image.height], dimensions);
                const src = `images/${run.arm}-${plate.view}-${String(sample.step).padStart(4, '0')}.png`;
                copies.push({ input: plate.file, output: src, sha256: plate.sha256 });
                const item = { step: sample.step, time: sample.step / 60, src, sha256: plate.sha256, width: image.width, height: image.height };
                if (plate.view === 'front-full-body') control.fullBody.push(item); else control.close.push({...item, side: plate.view === 'left-hand-hip' ? 'Left' : 'Right'});
            }
        }
        assert.equal(control.close.length, 6); controls.push(control);
    }
    const native = primary.report.runs[0];
    for (const step of [0, 637, 720]) assert.ok(native.oldReproduction.some(p => p.step === step && p.passed && p.exact.startsWith('time/rig/')));
    for (const step of [0, 636, 639, 720]) assert.ok(native.oldReproduction.some(p => p.step === step && p.passed && p.exact.startsWith('full helper physical')));
    assert.equal(copies.length, 750);
    return { manifest: { version: 1, title: 'Hand-motion diagnostic review', fps: 60,
        scope: 'Three disposable diagnostic controls on the same accepted g050 character and outfit. These are not proposed fixes. Pose and owner parity against sealed primary captures is a prerequisite for this gallery.',
        limit: 'Geometry-selected intersections are contact witnesses, not penetration severity or a clearance approval. This discrete happy-to-angry trace does not establish continuous coverage, sole-writer causality or behavior across other characters/outfits. Hair is unchanged and outside this review.',
        samples: fullSteps.map(step => ({step, time: step / 60})), closeSteps: CLOSE_STEPS, controls,
        provenance: { viewsReportSHA256: views.reportSHA256, primaryReportSHA256: primary.reportSHA256, manifestSHA256: r.manifestSHA256 } }, copies,
        verification: { sourceCount, pngCount: copies.length, viewsSealSHA256: views.sealSHA256, primarySealSHA256: primary.sealSHA256,
            primaryDirectory: primaryPath, geometrySamplesPerArm: numericalSteps.length, fullBodySamplesPerArm: fullSteps.length, closePlatesPerArm: 6 } };
}
export function packageReview(input, output) {
    input = path.resolve(input); output = path.resolve(output);
    assert.equal(fs.existsSync(output), false, 'Fresh gallery output only');
    const verified = inspectSealedViews(input); // All validations precede even mkdir.
    fs.mkdirSync(output, {recursive: true}); fs.mkdirSync(path.join(output, 'images'));
    const generated = [];
    for (const [source, dest] of [['hand-review.html', 'index.html'], ['hand-review.mjs', 'review.mjs'], ['hand-review.css', 'review.css']]) {
        const bytes = fs.readFileSync(path.join(HERE, source)); fs.writeFileSync(path.join(output, dest), bytes, {flag: 'wx'}); generated.push({file: dest, sha256: hash(bytes)});
    }
    for (const copy of verified.copies) { const bytes = fs.readFileSync(within(input, copy.input)); assert.equal(hash(bytes), copy.sha256); fs.writeFileSync(within(output, copy.output), bytes, {flag: 'wx'}); }
    const bytes = Buffer.from(JSON.stringify(verified.manifest, null, 2) + '\n'); fs.writeFileSync(path.join(output, 'review-manifest.json'), bytes, {flag: 'wx'});
    const receipt = { version: 1, completed: true, input, output, createdAt: new Date().toISOString(),
        ...verified.verification, ...verified.manifest.provenance, manifestSHA256: hash(bytes), captureManifestSHA256: verified.manifest.provenance.manifestSHA256,
        generatorSHA256: hash(fs.readFileSync(fileURLToPath(import.meta.url))), generated, images: verified.copies,
        timing: 'Intervals are differences between actual native steps divided by 60; irregular extra images are not treated as uniform 15 fps. Buffering pauses all three views together.',
        qualification: 'Source/image/record verification only; no browser or visual acceptance performed by this generator.' };
    fs.writeFileSync(path.join(output, 'receipt.json'), JSON.stringify(receipt, null, 2) + '\n', {flag: 'wx'});
    return receipt;
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    assert.equal(process.argv.length, 4, 'Usage: node package-hand-review.mjs SEALED_VIEWS_DIR FRESH_OUTPUT_DIR');
    const receipt = packageReview(process.argv[2], process.argv[3]);
    console.log(JSON.stringify({completed: receipt.completed, output: receipt.output, images: receipt.pngCount, sources: receipt.sourceCount}));
}
