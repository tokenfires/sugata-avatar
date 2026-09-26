// CPU-only strengthening of the actual v1 scroll capture; this does not rerender a page.
// node docs/evidence/nonhair-2026-09-26/review-scroll/verify-retained.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
const root = fileURLToPath(new URL('../../../../', import.meta.url));
const directory = 'docs/evidence/nonhair-2026-09-26/review-scroll/';
const sha = value => createHash('sha256').update(value).digest('hex');
const read = file => fs.readFileSync(root + file), json = file => JSON.parse(read(file));
const baselineFile = directory + 'baseline-v1/report.json', candidateFile = directory + 'candidate-v1/report.json';
const baseline = json(baselineFile), candidate = json(candidateFile);
assert.ok(baseline.completed && candidate.completed); assert.deepEqual(baseline.errors, []); assert.deepEqual(candidate.errors, []);
const harness = directory + 'probe.mjs', archivedHarness = directory + 'captured-instrument-v1/probe.mjs';
const strengthenedHarness = directory + 'strengthened-instrument-v2/probe.mjs';
assert.equal(sha(read(archivedHarness)), candidate.sourceHashes[harness]);
assert.equal(candidate.sourceHashes[harness], baseline.sourceHashes[harness]);
const addedAssertions = "    assert.ok(s.preview.y >= 0, 'Pinned preview extends above the viewport');\n    assert.ok(Math.abs(s.visibleHeight - s.preview.height) <= 1, 'Pinned preview is not completely visible');\n";
assert.equal(read(strengthenedHarness).toString().replace(addedAssertions, ''), read(archivedHarness).toString(), 'Archived v2 may only add the two explicit full-visibility assertions');
for (const [file, hash] of Object.entries(candidate.sourceHashes)) if (file !== harness) assert.equal(sha(read(file)), hash, file);
for (const [file, hash] of Object.entries(baseline.sourceHashes))
    if (!['packages/testbed/src/portrait.html', 'packages/testbed/src/showcase.html'].includes(file)) assert.equal(candidate.sourceHashes[file], hash, file);
for (const [file, hash] of Object.entries(candidate.builtHashes)) assert.equal(sha(read(file)), hash, file);
const outputs = {};
for (const [folder, report] of [['baseline-v1', baseline], ['candidate-v1', candidate]]) for (const c of report.cases) {
    for (const output of [...c.plates, c.initialPng, c.exportPng].filter(Boolean)) {
        const file = directory + folder + '/' + output.file; assert.equal(sha(read(file)), output.sha256, file); outputs[file] = output.sha256;
    }
}
const cases = [];
for (const c of candidate.cases) {
    const b = baseline.cases.find(item => item.name === c.name), witnesses = [];
    for (const phase of ['scrolled', 'focused', 'end']) {
        const state = c[phase], visible = Math.max(0, Math.min(state.viewport.height, state.preview.bottom) - Math.max(0, state.preview.y));
        assert.equal(state.cssPosition, 'sticky'); assert.equal(state.preview.y, 16);
        assert.ok(state.preview.y >= 0); assert.equal(visible, state.preview.height); assert.equal(state.visibleHeight, visible);
        assert.ok(state.preview.bottom <= state.viewport.height - 16); assert.ok(state.preview.bottom <= state.main.bottom);
        assert.ok(state.preview.right < state.room.x); assert.deepEqual(state.dimensions, c.initial.dimensions);
        witnesses.push({ phase, top: state.preview.y, bottom: state.preview.bottom, visibleHeight: visible, previewHeight: state.preview.height,
            baselineVisibleHeight: b[phase].visibleHeight, recoveredPixels: visible - b[phase].visibleHeight });
    }
    cases.push({ name: c.name, witnesses });
}
const receipt = { verifiedAt: new Date().toISOString(), method: 'Post-capture CPU assertion on retained exact-hash geometry; no additional candidate rendering or pixel-equality claim.',
    baseline: { file: baselineFile, sha256: sha(read(baselineFile)) }, candidate: { file: candidateFile, sha256: sha(read(candidateFile)) },
    capturedHarness: { file: archivedHarness, sha256: sha(read(archivedHarness)) },
    strengthenedHarness: { file: strengthenedHarness, sha256: sha(read(strengthenedHarness)), change: 'Only adds explicit nonnegative-top and full-visible-height assertions; used by baseline-v2.' },
    reusableHarness: { file: harness, sha256: sha(read(harness)), change: 'Also adopts bounded wheel increments, compositor settling and screenshot-adjacent states from the successful focused follow-up; this full reusable version has not been rerun.' },
    verifier: { file: directory + 'verify-retained.mjs', sha256: sha(read(directory + 'verify-retained.mjs')) },
    verifiedCandidateSourceCount: Object.keys(candidate.sourceHashes).length - 1,
    verifiedBuildOutputCount: Object.keys(candidate.builtHashes).length, outputs, cases,
    note: 'baseline-v2 was already running when repeat candidate rendering was stopped. It is retained as supplemental baseline evidence, but is not needed for this v1 before/after proof.',
    limit: 'DOM-only verification: candidate-v1/showcase-1024x800-document-end.png is rejected for screenshot-layout correspondence. The separately hash-bound settled-1024-v1 follow-up checks unchanged CSS with before/after screenshot state and independent footer/canvas pixels.' };
fs.writeFileSync(root + directory + 'verification-v1.json', JSON.stringify(receipt, null, 2) + '\n');
console.log(`PASS ${cases.length * 3} complete-visibility witnesses; ${Object.keys(outputs).length} exact-hash PNGs; all bound current candidate sources/build outputs verified`);
