// Discrete CPU coverage at the four completed native expressive step-98 controls.
// A partial parent matrix is allowed, but each selected run must be completed.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { gzipSync, gunzipSync } from 'node:zlib';
import { runCoverage, PROTOCOL } from '../../../../tools/figure-pipeline/collar_coverage_v2.mjs';

const ROOT = fileURLToPath(new URL('../../../../', import.meta.url));
const [captureArg, outArg, summaryArg] = process.argv.slice(2);
assert.ok(captureArg && outArg && summaryArg, 'Usage: node probe-current-witnesses.mjs CAPTURE_DIR FRESH_OUTPUT_DIR NEW_SUMMARY_JSON');
const captureDir = path.resolve(captureArg), out = path.resolve(outArg), summaryPath = path.resolve(summaryArg);
assert.ok(!fs.existsSync(out) && !fs.existsSync(summaryPath), 'Fresh output and summary required');
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const hashFile = file => sha(fs.readFileSync(file));
const relative = file => path.relative(ROOT, file);
const reportPath = path.join(captureDir, 'report.json'), reportBytes = fs.readFileSync(reportPath);
const capture = JSON.parse(reportBytes), manifestPath = path.join(captureDir, 'manifest.json');
assert.equal(capture.version, 2); assert.equal(capture.historicalReplay, false);
assert.equal(hashFile(manifestPath), capture.manifestSHA256);
const manifest = JSON.parse(fs.readFileSync(manifestPath));
for (const [file, expected] of Object.entries(manifest.sourceHashes)) assert.equal(hashFile(path.join(ROOT, file)), expected, `Source drift: ${file}`);
const runs = capture.runs.filter(run => run.hair === 'bob02' && run.sequence === 'expressive' && run.completed);
assert.equal(runs.length, 4, 'Require both exact garment roles and actual foundations');
assert.equal(new Set(runs.map(run => `${run.asset.role}/${run.foundation}`)).size, 4);
for (const foundation of ['foundation_bra', 'foundation_vest']) {
    const pair = runs.filter(run => run.foundation === foundation);
    assert.equal(pair.length, 2);
    assert.deepEqual(pair.map(run => run.asset.role).sort(), ['accepted-installed', 'frozen-interior']);
    assert.deepEqual(pair[0].states, pair[1].states, 'Paired native physical state drift');
    assert.deepEqual(pair[0].commands, pair[1].commands, 'Paired command drift');
}
const sourceFiles = ['tools/figure-pipeline/collar_coverage_v2.mjs', relative(fileURLToPath(import.meta.url))];
const sourceHashes = Object.fromEntries(sourceFiles.map(file => [file, hashFile(path.join(ROOT, file))]));
fs.mkdirSync(out, { recursive: true });
// Freeze the observed parent report so later archival or an unfinished parent cannot alter provenance.
fs.writeFileSync(path.join(out, 'capture-report-observed.json.gz'), gzipSync(reportBytes, { level: 9 }), { flag: 'wx' });
const summary = { protocol: PROTOCOL.id, sourceHashes,
    captureReport: { file: relative(reportPath), sha256: sha(reportBytes), matrixCompleted: capture.completed, frozenCopy: relative(path.join(out, 'capture-report-observed.json.gz')) },
    captureManifest: { file: relative(manifestPath), sha256: capture.manifestSHA256 }, rows: [],
    limits: ['Only four completed bob02 expressive native controls at step98 are evaluated.',
        'The parent matrix may be partial; this does not qualify the remaining poses or bob01.',
        'Additional-mask projected coverage is distinct from retained-foundation clearance, appearance, continuous motion and historical replay.'] };
for (const run of runs) {
    assert.deepEqual(run.errors, []);
    const outerPath = path.join(ROOT, run.asset.assetPath);
    assert.equal(hashFile(outerPath), run.asset.sha256);
    assert.ok(run.loadedAssets.some(asset => asset.sha256 === run.asset.sha256));
    const geometry = run.geometry.find(item => item.step === 98);
    assert.ok(geometry, 'Missing exact step98');
    const snapshotPath = path.resolve(captureDir, geometry.file);
    assert.ok(snapshotPath.startsWith(captureDir + path.sep), 'Snapshot path escape');
    const encoded = fs.readFileSync(snapshotPath), decoded = gunzipSync(encoded), snapshot = JSON.parse(decoded);
    assert.equal(sha(encoded), geometry.sha256); assert.equal(sha(decoded), geometry.decodedSHA256);
    assert.equal(snapshot.time, geometry.time); assert.equal(snapshot.capture.step, 98);
    assert.equal(snapshot.capture.manifestSHA256, capture.manifestSHA256);
    assert.deepEqual(snapshot.capture.asset, run.asset);
    for (const key of ['hair', 'sequence', 'foundation']) assert.equal(snapshot.capture[key], run[key]);
    const outputPath = path.join(out, `${run.name}-98.json`);
    const result = runCoverage({ outerPath, outerSha256: run.asset.sha256, snapshotPath,
        snapshotSha256: geometry.sha256, foundationIds: [run.foundation], outputPath });
    const raw = fs.readFileSync(outputPath), packed = gzipSync(raw, { level: 9 });
    assert.deepEqual(gunzipSync(packed), raw);
    fs.writeFileSync(outputPath + '.gz', packed, { flag: 'wx' });
    const foundation = result.foundations[0];
    summary.rows.push({ run: run.name, asset: run.asset, foundation: run.foundation, step: 98,
        input: { file: relative(snapshotPath), encodedSha256: sha(encoded), decodedSha256: sha(decoded) },
        selected: foundation.selected, passed: foundation.passed, failed: foundation.failed,
        maximumUncoveredArea: foundation.maximumUncoveredArea,
        failedTriangles: foundation.rows.filter(row => !row.pass).map(row => ({ id: row.foundationTriangle, uncoveredArea: row.uncoveredArea })),
        output: { file: relative(outputPath + '.gz'), encodedSha256: sha(packed), decodedSha256: sha(raw) } });
}
for (const [file, expected] of Object.entries(sourceHashes)) assert.equal(hashFile(path.join(ROOT, file)), expected);
assert.equal(hashFile(manifestPath), capture.manifestSHA256);
summary.completed = true;
summary.totalFootprintEvaluations = summary.rows.reduce((total, row) => total + row.selected, 0);
summary.pass = summary.rows.every(row => row.failed === 0);
fs.mkdirSync(path.dirname(summaryPath), { recursive: true });
fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify(summary.rows.map(({run, selected, failed, maximumUncoveredArea}) => ({run, selected, failed, maximumUncoveredArea})), null, 2));
