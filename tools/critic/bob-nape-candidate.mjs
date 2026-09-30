/** One-card authoring experiment. Never overwrites an accepted asset.
 * Replaces the confirmed sideways hook with a short downward/inward nape guide.
 * This is an appearance candidate; no motion/contact qualification is implied.
 */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { BufferGeometry, BufferAttribute, Vector3, Quaternion } from 'three';
import { readGlb, readPrimitive } from '../lut-bake/glb.mjs';
import { deriveCardGroom } from '../../packages/core/src/motion/HairDynamics.js';
import { encodeGlb, sha256, updateMovedFrames } from '../figure-pipeline/hair_fall.mjs';
import { SurfaceGrid } from '../figure-pipeline/hair_geometry.mjs';

const input = 'assets/hair/bob02/g050.glb';
const output = 'captures/hair-colour-2026-09-29/nape-guide-v1/candidate.glb';
assert.ok(!fs.existsSync(output), 'Keep previous candidate bytes.');
const glb = readGlb(input), original = readPrimitive(glb, 'hair_bob02');
const geom = new BufferGeometry();
geom.setAttribute('position', new BufferAttribute(new Float32Array(original.positions), 3));
geom.setIndex(new BufferAttribute(new Uint32Array(original.indices), 1));
const groom = deriveCardGroom(geom), card = 281;
assert.equal(groom.chainCount, 496); assert.equal(groom.cardVertexBase, 652); assert.equal(groom.pointsPerChain, 17);
const at = r => new Vector3().fromArray(groom.restCentres, (card * 17 + r) * 3);
const origin = at(0), control0 = origin.clone();
const control1 = origin.clone().add(new Vector3(-.004, -.008, -.005));
const control2 = origin.clone().add(new Vector3(-.006, -.020, -.006));
const control3 = origin.clone().add(new Vector3(-.006, -.030, .002));
const guide = Array.from({ length: 17 }, (_, r) => {
    const t = r / 16, s = 1 - t;
    return control0.clone().multiplyScalar(s ** 3).addScaledVector(control1, 3 * s * s * t)
        .addScaledVector(control2, 3 * s * t * t).addScaledVector(control3, t ** 3);
});
const moved = [];
for (let r = 1; r < 17; r++) {
    const lo = Math.max(0, r - 1), hi = Math.min(16, r + 1);
    const before = at(hi).sub(at(lo)).normalize(), after = guide[hi].clone().sub(guide[lo]).normalize();
    const rotation = new Quaternion().setFromUnitVectors(before, after);
    const offset = new Vector3().fromArray(groom.restOffsets, (card * 17 + r) * 3).applyQuaternion(rotation);
    for (let side = 0; side < 2; side++) {
        const v = groom.cardVertexBase + (card * 17 + r) * 2 + side;
        guide[r].clone().addScaledVector(offset, side === 0 ? -1 : 1).toArray(geom.attributes.position.array, v * 3);
        moved.push(v);
    }
}
const frames = updateMovedFrames(geom, original, moved);
const attributes = glb.json.meshes.find(m => m.name === 'hair_bob02').primitives[0].attributes;
assert.equal(attributes.TANGENT, undefined, 'Handle tangent rebaking explicitly for a new source layout.');
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
const body = readPrimitive(readGlb('assets/figures/figure_g050.glb'), 'base.001');
const grid = new SurfaceGrid(body.positions, body.normals, body.indices);
const clearance = moved.map(v => ({ vertex: v, signedMm: grid.nearest(Array.from(geom.attributes.position.array.slice(v * 3, v * 3 + 3))).signed * 1000 }));
const changed = deriveCardGroom(geom);
const report = { experiment: 'nape-guide-v1', status: 'unqualified', sourceSha256: sha256(fs.readFileSync(input)),
    card, movedVertices: moved.length, controlPoints: [control0, control1, control2, control3].map(p => p.toArray()),
    originalArcMm: groom.arcLengths[card] * 1000, candidateArcMm: changed.arcLengths[card] * 1000,
    clearance, minMovedVertexClearanceMm: Math.min(...clearance.map(x => x.signedMm)),
    limits: ['One held-pose appearance experiment; motion and triangle-body contacts not qualified.',
        'The card count, UVs, widths, cap, and all other cards remain unchanged. Root ring remains byte identical.',
        'Earlier accepted correction stamps describe the source history only; this experimental output has modified geometry.'] };
glb.json.asset.extras.sugataUnqualifiedExperiment = { ...report, clearance: undefined };
const bytes = encodeGlb(glb); report.outputSha256 = sha256(bytes);
fs.mkdirSync(path.dirname(output), {recursive:true});
fs.writeFileSync(output, bytes, {flag:'wx'});
fs.writeFileSync(path.join(path.dirname(output), 'candidate-report.json'), JSON.stringify(report, null, 2) + '\n', {flag:'wx'});
fs.copyFileSync(new URL(import.meta.url), path.join(path.dirname(output), 'bob-nape-candidate.mjs'));
console.log(JSON.stringify({ output, ...report, clearance: undefined }, null, 2));
