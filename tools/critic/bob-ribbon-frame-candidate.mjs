/** One-variable ribbon-frame diagnostic. Keeps the rejected cluster's centres and widths.
 * Card449 alone receives a root-seeded parallel-transported transverse frame.
 * This tests folding, not coverage, final appearance, or motion qualification.
 */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { BufferGeometry, BufferAttribute, Vector3, Quaternion } from 'three';
import { readGlb, readPrimitive } from '../lut-bake/glb.mjs';
import { deriveCardGroom } from '../../packages/core/src/motion/HairDynamics.js';
import { encodeGlb, sha256, updateMovedFrames } from '../figure-pipeline/hair_fall.mjs';

const input = 'captures/hair-colour-2026-09-29/posterior-cluster-v1/candidate.glb';
const output = 'captures/hair-colour-2026-09-29/ribbon-frame-v1/candidate.glb';
assert.ok(!fs.existsSync(output), 'Keep previous candidate bytes.');
assert.equal(sha256(fs.readFileSync(input)), 'de567a6307eea68731a6ad25467bf1c5c7840c4635941aec7dd9e6a8842155d4');
const glb = readGlb(input), original = readPrimitive(glb, 'hair_bob02');
const geom = new BufferGeometry().setAttribute('position', new BufferAttribute(new Float32Array(original.positions), 3));
geom.setIndex(new BufferAttribute(new Uint32Array(original.indices), 1));
const groom = deriveCardGroom(geom), card = 449;
assert.equal(groom.chainCount, 496); assert.equal(groom.cardVertexBase, 652); assert.equal(groom.pointsPerChain, 17);
const at = r => new Vector3().fromArray(groom.restCentres, (card * 17 + r) * 3);
const offsetAt = r => new Vector3().fromArray(groom.restOffsets, (card * 17 + r) * 3);
const tangents = Array.from({ length: 17 }, (_, r) => at(Math.min(16, r + 1)).sub(at(Math.max(0, r - 1))).normalize());
const widthAxis = offsetAt(0).normalize(), moved = [];
for (let r = 1; r < 17; r++) {
    // Transport the previous frame, rather than importing each ring's original twist.
    widthAxis.applyQuaternion(new Quaternion().setFromUnitVectors(tangents[r - 1], tangents[r])).normalize();
    const offset = widthAxis.clone().multiplyScalar(offsetAt(r).length());
    for (let side = 0; side < 2; side++) {
        const v = 652 + (card * 17 + r) * 2 + side;
        at(r).addScaledVector(offset, side === 0 ? -1 : 1).toArray(geom.attributes.position.array, v * 3);
        moved.push(v);
    }
}
const frames = updateMovedFrames(geom, original, moved);
const attributes = glb.json.meshes.find(m => m.name === 'hair_bob02').primitives[0].attributes;
assert.equal(attributes.TANGENT, undefined);
for (const [name, values] of [['POSITION', geom.attributes.position.array], ['NORMAL', frames.normals]]) {
    const a = glb.json.accessors[attributes[name]], view = glb.json.bufferViews[a.bufferView];
    assert.equal(a.componentType, 5126); assert.equal(a.type, 'VEC3'); assert.ok(!a.sparse);
    const start = (view.byteOffset ?? 0) + (a.byteOffset ?? 0), stride = view.byteStride ?? 12;
    for (let v = 0; v < a.count; v++) for (let k = 0; k < 3; k++) {
        assert.ok(Number.isFinite(values[v * 3 + k]));
        glb.bin.writeFloatLE(values[v * 3 + k], start + v * stride + k * 4);
    }
    a.min = [0, 1, 2].map(k => Math.min(...Array.from({length:a.count}, (_, v) => values[v*3+k])));
    a.max = [0, 1, 2].map(k => Math.max(...Array.from({length:a.count}, (_, v) => values[v*3+k])));
}
const changed = deriveCardGroom(geom), rings = [];
for (let r = 0; r < 17; r++) {
    const nextOffset = new Vector3().fromArray(changed.restOffsets, (card * 17 + r) * 3);
    const previousOffset = r ? new Vector3().fromArray(changed.restOffsets, (card * 17 + r - 1) * 3) : nextOffset;
    rings.push({ ring: r, centreDifferenceMm: at(r).distanceTo(new Vector3().fromArray(changed.restCentres, (card * 17 + r) * 3)) * 1000,
        widthDifferenceMm: Math.abs(offsetAt(r).length() - nextOffset.length()) * 2000,
        originalAxisTurnDegrees: r ? offsetAt(r - 1).angleTo(offsetAt(r)) * 180 / Math.PI : 0,
        candidateAxisTurnDegrees: previousOffset.angleTo(nextOffset) * 180 / Math.PI });
}
assert.ok(rings.every(r => r.centreDifferenceMm < .001 && r.widthDifferenceMm < .001));
const report = { experiment: 'ribbon-frame-v1', status: 'diagnostic only', source: input,
    sourceSha256: sha256(fs.readFileSync(input)), card, movedVertices: moved.length, rings,
    limits: ['Only the transverse frame is intentionally changed; centres and width magnitudes differ only by float quantization.',
        'The rejected five-card coverage and shortened paths remain. No improved complete hairstyle or motion qualification is claimed.',
        'The root ring and all other cards remain exact. Updated normals follow the changed ribbon geometry.'] };
glb.json.asset.extras.sugataUnqualifiedExperiment = report;
const bytes = encodeGlb(glb); report.outputSha256 = sha256(bytes);
fs.mkdirSync(path.dirname(output), {recursive:true});
fs.writeFileSync(output, bytes, {flag:'wx'});
fs.writeFileSync(path.join(path.dirname(output), 'candidate-report.json'), JSON.stringify(report, null, 2) + '\n', {flag:'wx'});
fs.copyFileSync(new URL(import.meta.url), path.join(path.dirname(output), 'bob-ribbon-frame-candidate.mjs'));
console.log(JSON.stringify({ output, ...report }, null, 2));
