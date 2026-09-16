#!/usr/bin/env node
/**
 * Requalify the exact September 13 collar candidate against the frozen foundation masks.
 * Uses the original coverage implementation and replay, with only paths/candidate hash changed.
 * No geometry, masks, production files or hash allowlists are written. CPU only.
 * Usage: node tools/figure-pipeline/collar_foundation_review.mjs /tmp/fresh-review-directory
 */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { gunzipSync } from 'node:zlib';
import { execFileSync } from 'node:child_process';
import { readGlb, readAccessor } from '../lut-bake/glb.mjs';
import { originalWardrobeFoundation, transformWardrobeUnderMasks } from './wardrobe_under_masks.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const OUTPUT = process.argv[2] && path.resolve(process.argv[2]);
assert.ok(OUTPUT, 'An explicit fresh output directory is required.');
assert.equal(fs.existsSync(OUTPUT), false, 'Refusing to overwrite an existing review directory.');
fs.mkdirSync(OUTPUT, { recursive: true });
const shaBytes = bytes => createHash('sha256').update(bytes).digest('hex');
const sha = file => shaBytes(fs.readFileSync(file));
const json = file => JSON.parse(fs.readFileSync(file));
const relative = file => path.relative(ROOT, file);
const asset = id => ROOT + '/assets/wardrobe/' + id + '/g050.glb';
const CANDIDATE = ROOT + '/captures/collar-clearance-paused-2026-09-13/casual-collar-v2.glb';
const CANDIDATE_SHA = 'ca65319add5a41147df9d894aebe6441a9ab6f5131ee639dd49c3bef74861e5e';
const CALIBRATION = ROOT + '/tools/figure-pipeline/fixtures/wardrobe-g050-under-masks-v1.json';
const ARCHIVE = ROOT + '/captures/wardrobe-under-masks-2026-09-09';
const REPLAY = ROOT + '/captures/tee-neckline-2026-09-13/independent-calibration/replay.mjs';
const OPENING_REPORT = ROOT + '/captures/collar-opening-2026-09-16/gpu-v3/report.json';
const report = {
    status: 'running', candidateSHA256: CANDIDATE_SHA,
    calibrationSHA256: '13170c7dc4d3561c02b84d9ef38c10260e3e5c3a21670872b9986d44ea523c02',
    historicalReplaySHA256: '338a3c5d2821c9767605f4c7d9e199c21c370acedd4a194cc6690208f1c9fdb2',
    hashes: [], foundations: [], preservation: [],
    limits: [
        'Frozen additional-removal selections only; originally authored mask deletions are not requalified.',
        'Authored and historical native 0/4 s states only, not every current motion or view.',
        'Outward projected cover of 1 mm square-expanded footprints in a centroid-relative [-4,30] mm depth slab.',
        'Coverage is not positive clearance, exclusion of containment, or a visual-quality verdict.',
        'No runtime loading or GPU work is performed by this tool.'
    ]
};
const save = () => fs.writeFileSync(OUTPUT + '/review.json', JSON.stringify(report, null, 2) + '\n');
function pinned(file, expected) {
    const actual = sha(file);
    assert.equal(actual, expected, 'Digest mismatch: ' + relative(file));
    report.hashes.push({ path: relative(file), sha256: actual });
}
function decodeGlb(bytes) {
    assert.equal(bytes.readUInt32LE(0), 0x46546c67);
    assert.equal(bytes.readUInt32LE(4), 2);
    assert.equal(bytes.readUInt32LE(8), bytes.length);
    let json, bin;
    for (let offset = 12; offset < bytes.length;) {
        const length = bytes.readUInt32LE(offset), type = bytes.readUInt32LE(offset + 4);
        const data = bytes.subarray(offset + 8, offset + 8 + length);
        if (type === 0x4e4f534a) json = JSON.parse(data.toString('utf8'));
        if (type === 0x004e4942) bin = data;
        offset += 8 + length;
    }
    assert.ok(json && bin);
    return { json, bin };
}
const primitive = (glb, id) => glb.json.meshes.find(mesh => mesh.name === id).primitives[0];
function replaceOnce(text, before, after) {
    assert.equal(text.split(before).length - 1, 1, 'Replay relocation anchor missing/duplicated: ' + before);
    return text.replace(before, after);
}

try {
    pinned(CANDIDATE, CANDIDATE_SHA);
    pinned(CALIBRATION, report.calibrationSHA256);
    pinned(REPLAY, report.historicalReplaySHA256);
    const calibration = json(CALIBRATION);
    for (const [file, expected] of Object.entries(calibration.proofSha256)) pinned(ARCHIVE + '/' + file, expected);
    const fixturePath = ROOT + '/tools/figure-pipeline/fixtures/' + calibration.fixture.file;
    pinned(fixturePath, calibration.fixture.sha256);
    assert.equal(JSON.parse(gunzipSync(fs.readFileSync(fixturePath))).schema, 'sugata-foundation-originals-v1');
    pinned(asset('body'), calibration.bodySha256);
    pinned(OPENING_REPORT, '20df066dbcaedf4660e30bdb2d97bd51ffbd643f0de3536fb47657386fc0c7c2');
    const openingHashes = json(OPENING_REPORT).sourceHashes;
    for (const [file, expected] of Object.entries(openingHashes)) pinned(ROOT + '/' + file, expected);
    // Both accepted bobs are included explicitly; the opening preview did not bind their bytes.
    pinned(ROOT + '/assets/hair/bob01/g050.glb', 'db3565bb7272dcc82a2892ce042886f23c1a09aed66ea563a9e33cfa7ee1b72b');
    pinned(ROOT + '/assets/hair/bob02/g050.glb', 'd20d65452ae2761a78a3598f7d7bbbb7541bc047f9d63c6b422948ebd686d461');

    for (const entry of calibration.garments) {
        pinned(asset(entry.id), entry.outputSha256);
        const originalBytes = originalWardrobeFoundation(entry.id);
        assert.equal(shaBytes(originalBytes), entry.sourceSha256);
        const original = decodeGlb(originalBytes), current = readGlb(asset(entry.id));
        const op = primitive(original, entry.id), cp = primitive(current, entry.id);
        assert.deepEqual(original.json, current.json, 'Foundation metadata changed');
        assert.deepEqual(readAccessor(original, op.indices).data, readAccessor(current, cp.indices).data);
        const transformed = transformWardrobeUnderMasks(originalBytes, { garmentId: entry.id });
        assert.deepEqual(transformed.bytes, fs.readFileSync(asset(entry.id)), 'Frozen mask transform does not reproduce accepted asset');
        const fields = [];
        for (const field of entry.fields) {
            const oldFlags = readAccessor(original, op.attributes[field.name]).data;
            const newFlags = readAccessor(current, cp.attributes[field.name]).data;
            const addedVertices = [], additionalTriangles = [];
            for (let i = 0; i < oldFlags.length; i++) if (oldFlags[i] !== newFlags[i]) {
                assert.ok(oldFlags[i] <= 0.5 && newFlags[i] === 1);
                addedVertices.push(i);
            }
            assert.deepEqual(addedVertices, field.vertices, 'Additional vertex selection differs');
            const indices = readAccessor(current, cp.indices).data;
            for (let i = 0; i < indices.length; i += 3) {
                const vertices = Array.from(indices.slice(i, i + 3));
                if (!vertices.some(v => oldFlags[v] > 0.5) && vertices.some(v => newFlags[v] > 0.5)) additionalTriangles.push(i / 3);
            }
            assert.deepEqual(additionalTriangles, field.additionallyHiddenTriangles, 'Any-corner removal differs from frozen IDs');
            fields.push({ name: field.name, addedVertices: addedVertices.length, additionalTriangles: additionalTriangles.length, exactSelection: true });
        }
        for (const name of Object.keys(op.attributes).filter(name => !entry.fields.some(f => f.name === name))) {
            assert.deepEqual(readAccessor(original, op.attributes[name]).data, readAccessor(current, cp.attributes[name]).data);
        }
        report.foundations.push({ id: entry.id, sha256: entry.outputSha256, frozenTransformReproducesAsset: true, fields });
    }

    // Run the original replay unchanged except for exact candidate and path literals.
    // Its source reconstruction, coverage, shape-input guards and negative controls stay intact.
    let replay = fs.readFileSync(REPLAY, 'utf8');
    replay = replay.replaceAll('/Users/robault/GitHub/sugata-avatar', ROOT);
    replay = replaceOnce(replay, "O='/private/tmp/sugata-neckline-critic-calibration-v2-2026-09-13'", 'O=' + JSON.stringify(OUTPUT));
    replay = replaceOnce(replay, "C='/private/tmp/sugata-neckline-2026-09-13/casual-neckline-v2.glb'", 'C=' + JSON.stringify(CANDIDATE));
    replay = replaceOnce(replay, 'fd93e0d90a4b723ad84827ffd2a947b74f0d7b9bf4a4606b94299433a38cacac', CANDIDATE_SHA);
    report.relocatedReplaySHA256 = shaBytes(replay);
    fs.writeFileSync(OUTPUT + '/replay.mjs', replay, { flag: 'wx' });
    save();
    const log = fs.openSync(OUTPUT + '/replay.log', 'wx');
    try { execFileSync(process.execPath, [OUTPUT + '/replay.mjs'], { cwd: ROOT, stdio: ['ignore', log, log] }); }
    finally { fs.closeSync(log); }
    const result = json(OUTPUT + '/report.json');
    assert.equal(result.status, 'completed');
    assert.equal(result.candidateSHA256, CANDIDATE_SHA);
    assert.equal(result.candidateCalibrationPass, true);
    assert.equal(result.sourceParity.length, 4);
    assert.equal(result.footprints, 54390);
    const candidateRows = result.replays.filter(r => r.label.endsWith('candidate-full'));
    assert.equal(candidateRows.length, 6);
    assert.equal(candidateRows.reduce((sum, row) => sum + row.count, 0), 23310);
    const negatives = result.replays.filter(r => r.label.endsWith('retained-subset'));
    assert.equal(negatives.length, 2);
    assert.ok(negatives.every(row => row.failed > 0), 'Discarding changed triangles must fail coverage');
    for (const item of report.hashes) {
        assert.equal(sha(ROOT + '/' + item.path), item.sha256, 'Input changed during replay: ' + item.path);
        report.preservation.push(item.path);
    }
    report.result = {
        pass: true, candidateFootprints: 23310, allEvaluations: result.footprints,
        changedVertices: result.changedVertices, changedTriangles: result.changedTriangles,
        sourceParityMaximumErrorMetres: Math.max(...result.sourceParity.map(p => p.maximumErrorMetres)),
        negativeControls: negatives.map(({ foundation, count, failed }) => ({ foundation, count, failed })),
        candidateMaximumUncoveredArea: Math.max(...candidateRows.map(row => row.maxUncoveredArea)),
        reportSHA256: sha(OUTPUT + '/report.json')
    };
    report.status = 'completed';
    save();
    console.log(JSON.stringify(report.result, null, 2));
} catch (error) {
    report.status = 'failed';
    report.failure = error.stack;
    save();
    throw error;
}
