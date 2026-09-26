import assert from 'node:assert/strict';
import fs from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { createHandGeometryAudit } from './geometry-audit.mjs';

const root = fileURLToPath(new URL('../../../../', import.meta.url));
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const receiptBytes = fs.readFileSync(new URL('./retained-witness.json', import.meta.url));
assert.equal(sha(receiptBytes), '39639e07c9cb47c07bad6ed8a8a0502d7aeafade3478b51d83218968e364f377');
const receipt = JSON.parse(receiptBytes);
const audit = createHandGeometryAudit({ bodyPath: root + 'assets/figures/figure_g050.glb',
    garmentPath: root + 'assets/wardrobe/female_casualsuit01/g050.glb' });
for (const [path, hash] of Object.entries(audit.sources)) assert.equal(hash, receipt.sourceHashes[path.slice(root.length)]);
assert.deepEqual(audit.components, receipt.components);
for (const pose of receipt.poses) {
    const bytes = fs.readFileSync(root + pose.file); assert.equal(sha(bytes), pose.sha256);
    const raw = gunzipSync(bytes); assert.equal(sha(raw), pose.decodedSha256);
    const snapshot = JSON.parse(raw), before = sha(JSON.stringify(snapshot));
    const actual = audit.analyze(snapshot);
    assert.equal(actual.time, pose.time); assert.deepEqual(actual.sides, pose.sides);
    assert.equal(sha(JSON.stringify(snapshot)), before, 'Audit must not mutate retained geometry');
    console.log('PASS exact retained counts, witnesses and input preservation at step ' + pose.step);
    if (pose.step === 637) {
        // Move only the entire garment far away: anatomical contacts must persist, garment
        // contacts must vanish. This distinguishes the two target families and tests broadphase.
        const moved = structuredClone(snapshot), garment = moved.meshes.find(m => m.id === 'female_casualsuit01');
        garment.positions = garment.positions.map((v, i) => i % 3 === 0 ? v + 10 : v);
        const clear = audit.analyze(moved);
        for (const side of ['l', 'r']) {
            assert.equal(clear.sides[side].trousers.pairs, 0);
            assert.deepEqual(clear.sides[side].lowerBody, actual.sides[side].lowerBody);
        }
        console.log('PASS displaced-garment negative control retains anatomical witnesses');
        const invalid = structuredClone(snapshot); invalid.meshes[0].positions[0] = NaN;
        assert.throws(() => audit.analyze(invalid), /Invalid posed positions/);
        invalid.meshes[0].positions[0] = snapshot.meshes[0].positions[0]; invalid.meshes[0].fullIndices[0] += 1;
        assert.throws(() => audit.analyze(invalid), /Exact source topology/);
        console.log('PASS invalid geometry and topology refuse measurement');
    }
}
