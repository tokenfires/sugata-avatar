// Independent exact controls for the predeclared group-boundary packet; no image tolerance.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';

const roots = ['captures/root-coverage-2026-10-02-beauty-v1', 'captures/root-coverage-2026-10-02-tagged-v1'];
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const read = file => JSON.parse(fs.readFileSync(file));
const reports = roots.map(root => read(`${root}/report.json`));
const checks = [], rows = [];
function check(name, action) {
    try { action(); checks.push({ name, passed: true }); }
    catch (error) { checks.push({ name, passed: false, error: error.message }); }
}
const [beauty, tagged] = reports;
check('completed reports', () => {
    for (const r of reports) { assert.equal(r.status, 'captured'); assert.deepEqual(r.errors, []); assert.equal(r.cases.length, 3); }
    assert.equal(beauty.identityMode, 'off'); assert.equal(tagged.identityMode, 'root-boundary');
    assert.equal(beauty.candidate, tagged.candidate);
    assert.equal(tagged.sourceHashes[tagged.candidate], '8c458428551ca546d2aac511dec3b516067d53050de9663a563b9884a4ae5fe7');
    assert.equal(tagged.sourceHashes['captures/bob-side-envelope-v3/candidate-report.json'], 'dcbc7350777000eaba71c102214a4d1239179956a33684ff47000f68ef79fded');
});
check('common source pins and preserved copies', () => {
    for (const [file, hash] of Object.entries(beauty.sourceHashes)) assert.equal(tagged.sourceHashes[file], hash, file);
    for (const [root, report] of roots.map((root, i) => [root, reports[i]])) for (const [file, hash] of Object.entries(report.sourceHashes)) {
        assert.equal(sha(fs.readFileSync(file)), hash, file);
        if (!file.startsWith('assets/')) assert.equal(sha(fs.readFileSync(`${root}/source/${file}`)), hash, file);
    }
});
const prior = read('captures/bob-front-layers-v1/report.json');
for (const c of tagged.cases) {
    const b = beauty.cases.find(x => x.view === c.view), old = prior.cases.find(x => x.view === c.view);
    const row = { view: c.view };
    check(`${c.view}: recorded controls`, () => {
        assert.ok(b); assert.deepEqual(c.fixedState, b.fixedState);
        for (const key of ['clock', 'applied', 'lightingChanges', 'hidden', 'size', 'backend', 'adapter', 'angle']) assert.deepEqual(c[key], b[key], key);
        assert.equal(c.backend, 'webgpu'); assert.deepEqual(c.size, [900, 868]);
        assert.equal(c.candidateLoads, 1); assert.equal(b.candidateLoads, 1); assert.equal(b.identity, null);
        assert.deepEqual(c.hidden, { cards: Array.from({ length: 34 }, (_, i) => 462 + i), caps: false, removedTriangles: 1088 });
        assert.deepEqual(c.identity.legend, { cap: '808080', protectedRoots: '2858ff', editableRoots: 'ff3030', otherCards: 'b0b0b0' });
        const selected = read('captures/bob-side-envelope-v3/candidate-report.json').selected;
        assert.deepEqual(c.identity.protectedCards, selected);
        assert.deepEqual(c.identity.protectedRoots, Array.from({ length: 78 }, (_, i) => i).filter(i => selected.includes(i)));
        assert.deepEqual(c.identity.editableRoots, Array.from({ length: 78 }, (_, i) => i).filter(i => !selected.includes(i)));
        assert.equal(c.identity.protectedRoots.length, 52); assert.equal(c.identity.editableRoots.length, 26);
        // Admit the historical target rectangles only under unchanged projection/camera/canvas.
        for (const key of ['camera', 'quaternion', 'projection', 'target', 'canvas']) assert.deepEqual(c.fixedState[key], old.fixedState[key], key);
        row.recordedControlsExact = true;
    });
    check(`${c.view}: complete exported geometry`, () => {
        const files = reports.map(r => r.geometryFiles.find(g => g.view === c.view));
        const geometries = files.map((file, i) => {
            assert.equal(sha(fs.readFileSync(`${roots[i]}/${file.filename}`)), file.sha256);
            return read(`${roots[i]}/${file.filename}`);
        });
        assert.deepEqual(geometries[0], geometries[1]);
        for (const attribute of ['position', 'normal', 'uv', 'uv1', 'skinIndex', 'skinWeight']) assert.ok(geometries[1].authoredAttributes[attribute], attribute);
        assert.ok(geometries[1].skin.boneInverses.length > 0);
        row.completeExportedGeometryExact = true;
        row.geometrySHA256 = files[1].sha256;
    });
    check(`${c.view}: original image hashes`, () => {
        for (const [root, item] of [[roots[0], b], [roots[1], c]]) assert.equal(sha(fs.readFileSync(`${root}/${item.filename}`)), item.imageSha256);
        row.beautyImageSHA256 = b.imageSha256; row.taggedImageSHA256 = c.imageSha256;
    });
    rows.push(row);
}
const result = { status: checks.every(c => c.passed) ? 'exact recorded controls pass' : 'controls failed',
    generated: new Date().toISOString(), sourceSHA256: sha(fs.readFileSync('tools/critic/audit-root-coverage.mjs')),
    reports: roots.map(root => ({ file: `${root}/report.json`, sha256: sha(fs.readFileSync(`${root}/report.json`)) })), checks, rows,
    limits: ['Diagnostic RGB changes the hair colour binding and RGB-sensitive temporal inputs.',
        'Equal geometry and recorded controls do not prove equal final pixels.', 'Images support group-level appearance evidence, not card/pixel ownership, absence, contact, motion or promotion.'] };
const output = `${roots[1]}/paired-controls.json`;
assert.ok(!fs.existsSync(output)); fs.writeFileSync(output, JSON.stringify(result, null, 2) + '\n', { flag: 'wx' });
fs.copyFileSync('tools/critic/audit-root-coverage.mjs', `${roots[1]}/audit-root-coverage.mjs`, fs.constants.COPYFILE_EXCL);
console.log(JSON.stringify({ status: result.status, passed: checks.filter(c => c.passed).length, failed: checks.filter(c => !c.passed), outputSHA256: sha(fs.readFileSync(output)) }));
if (checks.some(c => !c.passed)) process.exitCode = 1;
