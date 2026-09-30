/** Focused, read-only measurements for an isolated bob02 asset and its captured held pose.
 * --directory=captures/... --cards=... Requires neutral/casual-back-geometry.json.
 * This is scoped evidence, not an all-motion or whole-groom acceptance gate.
 */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { BufferGeometry, BufferAttribute } from 'three';
import { readGlb, readPrimitive, readAccessor } from '../lut-bake/glb.mjs';
import { measureHairSurface } from '../figure-pipeline/hair_surface.mjs';
import { deriveCardGroom } from '../../packages/core/src/motion/HairDynamics.js';

const arg = key => process.argv.find(x => x.startsWith(`--${key}=`))?.slice(key.length + 3);
const directory = arg('directory'), cards = arg('cards')?.split(',').map(Number);
assert.ok(directory?.startsWith('captures/') && cards?.length && cards.every(c => Number.isInteger(c) && c >= 0 && c < 496));
const output = path.join(directory, 'numerical-checks.json');
assert.ok(!fs.existsSync(output), 'Keep the previous audit.');
const source = arg('baseline') ?? 'assets/hair/bob02/g050.glb', candidate = path.join(directory, 'candidate.glb');
const before = readGlb(source), after = readGlb(candidate);
const a = readPrimitive(before, 'hair_bob02'), b = readPrimitive(after, 'hair_bob02');
const attrs = before.json.meshes[0].primitives[0].attributes;
for (const k of ['TEXCOORD_0', 'TEXCOORD_1', 'JOINTS_0', 'WEIGHTS_0']) assert.deepEqual(readAccessor(before, attrs[k]).data, readAccessor(after, attrs[k]).data);
assert.deepEqual(a.indices, b.indices);
const selected = new Set(cards), moved = [], normals = [];
for (let v = 0; v < a.vertexCount; v++) {
    if ([0, 1, 2].some(k => a.positions[v * 3 + k] !== b.positions[v * 3 + k])) moved.push(v);
    if ([0, 1, 2].some(k => a.normals[v * 3 + k] !== b.normals[v * 3 + k])) normals.push(v);
}
assert.equal(moved.length, cards.length * 32);
assert.ok(moved.every(v => v >= 652 && selected.has(Math.floor((v - 652) / 34)) && (v - 652) % 34 >= 2));
assert.ok(normals.every(v => moved.includes(v)));
const indices = [];
for (let i = 0; i < b.indices.length; i += 3) if (b.indices[i] >= 652 && selected.has(Math.floor((b.indices[i] - 652) / 34))) indices.push(...b.indices.slice(i, i + 3));
const bodyFile = 'assets/figures/figure_g050.glb', body = readPrimitive(readGlb(bodyFile), 'base.001');
const bounds = { min: [-Infinity, -Infinity, -Infinity], max: [Infinity, Infinity, Infinity] };
const crossings = measureHairSurface({ ...b, indices }, body, { headBounds: bounds, faceBounds: bounds });
const baseGeometry = arg('baseline-geometry') ?? 'captures/hair-colour-2026-09-29/attribution-v1/casual-back-geometry.json';
const candidateGeometry = path.join(directory, 'neutral/casual-back-geometry.json');
const bg = JSON.parse(fs.readFileSync(baseGeometry)), cg = JSON.parse(fs.readFileSync(candidateGeometry));
assert.equal(bg.liveVertices.length, cg.liveVertices.length);
let nonCandidateMax = 0, liveVsRestMax = 0;
for (let v = 0; v < cg.liveVertices.length / 3; v++) {
    const distance = (p, q) => Math.hypot(...[0, 1, 2].map(k => p[v * 3 + k] - q[v * 3 + k]));
    if (!selected.has(Math.floor(v / 34))) nonCandidateMax = Math.max(nonCandidateMax, distance(bg.liveVertices, cg.liveVertices));
    liveVsRestMax = Math.max(liveVsRestMax, distance(cg.liveVertices, cg.restVertices));
}
const medianArc = primitive => {
    const geo = new BufferGeometry().setAttribute('position', new BufferAttribute(new Float32Array(primitive.positions), 3));
    geo.setIndex(new BufferAttribute(primitive.indices, 1));
    const arcs = Array.from(deriveCardGroom(geo).arcLengths).sort((x, y) => x - y);
    return arcs[Math.floor(arcs.length / 2)];
};
const summary = { source, candidate, baseGeometry, cards, movedVertices: moved, changedNormalVertices: normals,
    unchanged: ['indices', 'TEXCOORD_0', 'TEXCOORD_1', 'JOINTS_0', 'WEIGHTS_0', 'root rings', 'other cards', 'cap'],
    cardTriangles: indices.length / 3, restTriangleBodyPairs: crossings.head.pairs,
    nonCandidateLiveVertexMaxMm: nonCandidateMax * 1000, candidateLiveVsRestMaxMm: liveVsRestMax * 1000,
    medianArcBeforeMm: medianArc(a) * 1000, medianArcAfterMm: medianArc(b) * 1000,
    limits: ['Only selected cards checked for rest triangle-body intersections; no moving contact or full-groom qualification.'] };
const hash = file => createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const sources = Object.fromEntries([source, candidate, bodyFile, baseGeometry, candidateGeometry,
    'tools/critic/audit-bob-candidate.mjs', 'tools/figure-pipeline/hair_surface.mjs'].map(file => [file, hash(file)]));
fs.writeFileSync(output, JSON.stringify({ summary, sources, crossings }, null, 2) + '\n', { flag: 'wx' });
fs.copyFileSync(new URL(import.meta.url), path.join(directory, 'audit-bob-candidate.mjs'));
console.log(JSON.stringify({ ...summary, movedVertices: moved.length, changedNormalVertices: normals.length }, null, 2));
