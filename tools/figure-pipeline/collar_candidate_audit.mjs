// Byte/geometry audit of the frozen September 13 candidate. Does not certify clearance.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {readGlb, readPrimitive} from '../lut-bake/glb.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const A = ROOT + '/captures/collar-clearance-paused-2026-09-13';
const sourcePath = ROOT + '/assets/wardrobe/female_casualsuit01/g050.glb';
const candidatePath = A + '/casual-collar-v2.glb';
const sha = p => createHash('sha256').update(fs.readFileSync(p)).digest('hex');
assert.equal(sha(sourcePath), '44ebc3eb3a09408a3563d369ae74be15a5bc4beb8040bc43c2c5446d6e65c783');
assert.equal(sha(candidatePath), 'ca65319add5a41147df9d894aebe6441a9ab6f5131ee639dd49c3bef74861e5e');
const source = readGlb(sourcePath), candidate = readGlb(candidatePath);
const attributes = source.json.meshes.find(m => m.name === 'female_casualsuit01').primitives[0].attributes;
const metadata = structuredClone(candidate.json);
for (const attr of ['POSITION', 'NORMAL']) {
    const i = attributes[attr];
    for (const field of ['min', 'max']) {
        if (source.json.accessors[i][field] === undefined) delete metadata.accessors[i][field];
        else metadata.accessors[i][field] = source.json.accessors[i][field];
    }
}
assert.deepEqual(metadata, source.json, 'Unexpected GLB metadata change');
const allowed = new Uint8Array(source.bin.length);
for (const attr of ['POSITION', 'NORMAL']) {
    const a = source.json.accessors[attributes[attr]], view = source.json.bufferViews[a.bufferView];
    assert.equal(a.componentType, 5126); assert.equal(a.type, 'VEC3'); assert.ok(!a.sparse);
    const offset = (view.byteOffset ?? 0) + (a.byteOffset ?? 0), stride = view.byteStride ?? 12;
    for (let i = 0; i < a.count; i++) allowed.fill(1, offset + i * stride, offset + i * stride + 12);
}
assert.equal(candidate.bin.length, source.bin.length);
let changedBytes = 0;
for (let i = 0; i < source.bin.length; i++) if (source.bin[i] !== candidate.bin[i]) {
    assert.equal(allowed[i], 1, 'Unexpected binary change at byte ' + i); changedBytes++;
}
const p = readPrimitive(source, 'female_casualsuit01'), q = readPrimitive(candidate, 'female_casualsuit01');
const recipe = JSON.parse(fs.readFileSync(A + '/solve-v2.json'));
const expectedPosition = Float64Array.from(p.positions), expectedNormal = Float64Array.from(p.normals);
for (const c of recipe.changes) expectedPosition.set(c.position, c.i * 3);
for (const c of recipe.normalChanges) expectedNormal.set(c.normal, c.i * 3);
assert.deepEqual(q.positions, expectedPosition); assert.deepEqual(q.normals, expectedNormal);
const moved = [], normalChanged = [], twins = new Map(); let seamDisagreements = 0, maxMove = 0;
for (let i = 0; i < p.vertexCount; i++) {
    const old = Array.from(p.positions.slice(i * 3, i * 3 + 3)), now = Array.from(q.positions.slice(i * 3, i * 3 + 3));
    const distance = Math.hypot(...old.map((v, k) => now[k] - v));
    if (distance) moved.push(i); maxMove = Math.max(maxMove, distance);
    if (Array.from(p.normals.slice(i * 3, i * 3 + 3)).some((v, k) => v !== q.normals[i * 3 + k])) normalChanged.push(i);
    const key = old.map(v => Math.round(v / 1e-7)).join(':');
    if (twins.has(key) && twins.get(key).some((v, k) => v !== now[k])) seamDisagreements++;
    twins.set(key, now);
}
assert.equal(seamDisagreements, 0);
const cross = (a, b) => [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]];
const face = (positions, ids) => {
    const v = ids.map(i => Array.from(positions.slice(i*3, i*3+3)));
    return cross(v[1].map((x,k)=>x-v[0][k]), v[2].map((x,k)=>x-v[0][k]));
};
const movedSet = new Set(moved); let incidentTriangles = 0, minNormalDot = 1, minAreaRatio = Infinity;
for (let t = 0; t < p.indices.length; t += 3) {
    const ids = Array.from(p.indices.slice(t, t+3)); if (!ids.some(i => movedSet.has(i))) continue;
    incidentTriangles++; const old = face(p.positions, ids), now = face(q.positions, ids);
    minNormalDot = Math.min(minNormalDot, old.reduce((s,v,k)=>s+v*now[k],0)/Math.hypot(...old)/Math.hypot(...now));
    minAreaRatio = Math.min(minAreaRatio, Math.hypot(...now)/Math.hypot(...old));
}
const report = {sourceSHA256: sha(sourcePath), candidateSHA256: sha(candidatePath), changedBytes,
    movedVertices: moved.length, changedNormals: normalChanged.length, maxMoveMillimetres: maxMove*1000,
    lowestChangedOriginalY: Math.min(...moved.map(i=>p.positions[i*3+1])), incidentTriangles, minNormalDot, minAreaRatio,
    seamDisagreements, onlyPositionNormalAndTheirBoundsChanged: true, matchesFrozenRecipe: true,
    unchanged: ['topology', 'UVs', 'skin weights and joints', 'materials and textures', 'mask attributes', 'skeleton', 'lower trouser geometry'],
    limitations: ['Shape ratios do not certify curvature or aesthetic quality.', 'No clearance, containment, motion or foundation-coverage qualification is implied.']};
if (process.argv[2]) fs.writeFileSync(path.resolve(process.argv[2]), JSON.stringify(report, null, 2), {flag: 'wx'});
console.log(JSON.stringify(report, null, 2));
