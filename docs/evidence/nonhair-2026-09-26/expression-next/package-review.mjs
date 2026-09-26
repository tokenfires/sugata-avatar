// Verify a completed comparison, then produce neutral-ID local review copies. Never print the key.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash, randomInt } from 'node:crypto';
import { gzipSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { decodePng } from '../../../../tools/critic/png.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const input = process.argv[2] && path.resolve(process.argv[2]);
assert.ok(input, 'Pass completed comparison directory');
const output = path.join(input, 'review');
assert.ok(!fs.existsSync(output), 'Refuse to replace an existing blind review');
const reportBytes = fs.readFileSync(input + '/report.json'), r = JSON.parse(reportBytes);
assert.equal(r.completed, true); assert.equal(r.smoke, false); assert.equal(r.cases.length, 6);
assert.deepEqual(r.errors, []); assert.deepEqual(r.finalSources, r.sources);
const sha = b => createHash('sha256').update(b).digest('hex');
let sourceCount = 0, pngCount = 0;
for (const [p, h] of Object.entries(r.sources)) if (!p.startsWith('assets/')) {
    assert.equal(sha(fs.readFileSync(path.join(input, 'source', p))), h, 'Frozen source: ' + p); sourceCount++;
}
const seen = new Set();
for (const c of r.cases) {
    assert.equal(c.completed, true); assert.equal(c.retirement.disposal.disposed, true);
    assert.deepEqual(c.retirement.disposal.leaked, []); assert.equal(c.retirement.noStudyLayers, true);
    assert.equal(c.setup.identity.bake, 'figure_g050'); assert.equal(c.setup.hair, 'bob02');
    assert.equal(c.setup.scene.id, 'studio');
    assert.equal(c.setup.camera.position[0], c.setup.camera.target[0]);
    assert.equal(c.setup.camera.position[1], c.setup.camera.target[1]);
    assert.deepEqual(c.beforeStart, r.cases[0].beforeStart, 'All six fresh pre-intervention states');
    if (c.speech) {
        assert.equal(c.retirement.outcome.outcome, 'finished');
        assert.equal(c.retirement.outcome.timelineSupplied, true);
    }
    assert.equal(seen.has(c.name), false); seen.add(c.name);
    assert.equal(c.samples[0].step, 0); assert.equal(c.samples.at(-1).step, 270);
    if (c.arm !== 'A') {
        assert.equal(c.samples.at(-1).state.owner.phase, 'idle');
        assert.equal(c.samples.at(-1).state.owner.retirementReason, 'complete');
        assert.equal(c.samples.at(-1).state.owner.holdsGaze, false);
    }
    if (c.arm === 'C') assert.ok(c.samples.some(p => p.state.owner.channels.eyeWideLeft.actualAdmitted < 0), 'C must actually attenuate');
    if (c.arm === 'B') {
        assert.equal(c.action.owner.holdsGaze, true);
        assert.equal(c.samples.find(p => p.step === 156).state.owner.holdsGaze, true);
        assert.equal(c.samples.find(p => p.step === 156).state.owner.envelope, 1);
    }
    for (const p of c.samples) {
        const bytes = fs.readFileSync(path.join(input, p.file)); assert.equal(sha(bytes), p.sha256);
        const decoded = decodePng(bytes); assert.equal(decoded.width, p.width); assert.equal(decoded.height, p.height);
        assert.equal(decoded.width, c.canvas.width); assert.equal(decoded.height, c.canvas.height);
        let low = 1, high = 0;
        for (let i = 0; i < decoded.pixels.length; i += 4) { low = Math.min(low, decoded.pixels[i]); high = Math.max(high, decoded.pixels[i]); }
        assert.ok(high - low > .1, 'Uniform frame: ' + p.file); pngCount++;
    }
}
fs.mkdirSync(output);
const shuffled = ['A', 'B', 'C'];
for (let i = 2; i > 0; i--) { const j = randomInt(i + 1); [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]; }
fs.writeFileSync(input + '/review-blind-KEY.json', JSON.stringify({ reportSha256: sha(reportBytes), views: Object.fromEntries(shuffled.map((arm, i) => ['view-' + (i + 1), arm])) }, null, 2) + '\n');
const manifest = { title: 'Three expression studies', scope: 'Isolated experiment on one fixed character and view. Native simulation at 60Hz; images at 15Hz plus explicit endpoints. Speech uses a saved synthetic mouth timeline, with no audio. No change to the shipped expression behavior or broad perceptual qualification.', groups: [] };
for (const speech of [false, true]) {
    const id = speech ? 'speech' : 'quiet';
    const reference = r.cases.find(c => c.speech === speech && c.arm === 'A');
    const group = { id, label: speech ? 'With mouth motion' : 'Quiet',
        samples: reference.samples.map(p => ({ step: p.step, time: p.actionTime })), arms: [] };
    for (let i = 0; i < shuffled.length; i++) {
        const c = r.cases.find(c => c.speech === speech && c.arm === shuffled[i]), view = 'view-' + (i + 1);
        assert.deepEqual(c.sampleSteps, reference.sampleSteps);
        const images = c.samples.map(p => {
            const neutral = `${id}-${view}-${String(p.step).padStart(4, '0')}.png`, dest = path.join(output, neutral);
            fs.copyFileSync(path.join(input, p.file), dest);
            return { step: p.step, src: '/@fs' + dest };
        });
        group.arms.push({ id: view, label: 'View ' + (i + 1), images });
    }
    manifest.groups.push(group);
}
const manifestPath = path.join(here, 'review-manifest.json');
assert.ok(!fs.existsSync(manifestPath), 'Refuse to overwrite a published review manifest');
fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
const compact = path.join(here, 'comparison-report.json.gz');
assert.ok(!fs.existsSync(compact)); fs.writeFileSync(compact, gzipSync(reportBytes));
const receipt = { createdAt: new Date().toISOString(), input, reportSha256: sha(reportBytes),
    compressedReportSha256: sha(fs.readFileSync(compact)), manifestSha256: sha(fs.readFileSync(manifestPath)),
    sourceCount, pngCount, cases: 6, allSpeechOutcomes: 'finished', errors: [],
    scope: 'Exact retained-source/image verification and control evidence. Neutral view IDs are for independent visual review; the answer key remains separate and ignored. PNG copies are local capture artifacts, not tracked product assets.' };
fs.writeFileSync(path.join(here, 'review-receipt.json'), JSON.stringify(receipt, null, 2) + '\n');
console.log('Verified ' + pngCount + ' images and ' + sourceCount + ' frozen sources; neutral review manifest ready.');
