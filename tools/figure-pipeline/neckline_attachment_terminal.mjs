// Read-only terminal witness for a completed, failed attachment closure.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { gunzipSync } from 'node:zlib';
import { ROOT, ACCEPTED_PATH, hashFile } from './collar_replacement_manifest.mjs';
import { readGlb, readPrimitive } from '../lut-bake/glb.mjs';
const input = 'captures/neckline-attachment-2026-09-30-v1';
const output = 'captures/neckline-attachment-terminal-2026-09-30-v1';
assert.ok(!fs.existsSync(path.join(ROOT, output)));
const read = p => JSON.parse(fs.readFileSync(path.join(ROOT, p)));
const sourceReport = read(`${input}/report.json`);
assert.equal(sourceReport.status, 'no-admissible-cycle-under-declared-closure');
assert.equal(sourceReport.termination, 'reached-non-neck-opening-or-exhausted-shirt');
for (const [p, h] of Object.entries(sourceReport.pins)) assert.equal(hashFile(path.join(ROOT, p)), h);
assert.equal(hashFile(path.join(ROOT, input, 'snapshot.json.gz')), sourceReport.savedSnapshotSHA256);
const source = readPrimitive(readGlb(path.join(ROOT, ACCEPTED_PATH)), 'female_casualsuit01');
const snapshot = JSON.parse(gunzipSync(fs.readFileSync(path.join(ROOT, input, 'snapshot.json.gz'))));
const cloth = snapshot.meshes.find(m => m.id === 'female_casualsuit01');
const point = (p, i) => Array.from(p.slice(3 * i, 3 * i + 3));
const groups = [], lookup = new Map(), groupOf = [];
for (let i = 0; i < source.vertexCount; i++) {
  const key = point(source.positions, i).map(v => Math.round(v / 1e-7)).join(':');
  if (!lookup.has(key)) { lookup.set(key, groups.length); groups.push([]); }
  const g = lookup.get(key); groupOf[i] = g; groups[g].push(i);
}
const edges = new Map();
for (let i = 0; i < source.indices.length; i += 3) {
  const gs = Array.from(source.indices.slice(i, i + 3), v => groupOf[v]);
  for (let k = 0; k < 3; k++) {
    const pair = [gs[k], gs[(k + 1) % 3]].sort((a, b) => a - b), key = pair.join(':');
    if (!edges.has(key)) edges.set(key, {key, groups: pair, faces: []});
    edges.get(key).faces.push(i / 3);
  }
}
const neck = new Set(sourceReport.topology.neckEdges);
const other = sourceReport.topology.nonNeckOpeningEdges.map(key => edges.get(key));
const region = new Set(sourceReport.regionFaces);
const last = sourceReport.iterations.at(-1);
const touched = other.filter(e => e.faces.some(f => region.has(f)));
assert.ok(touched.length > 0);
assert.ok(sourceReport.regionFaces.length < sourceReport.topology.shirtFaces);
assert.ok(touched.every(e => e.faces.length === 1 && last.addedFaces.includes(e.faces[0])));
const unseen = new Set(other.map(e => e.key)), openings = [];
while (unseen.size) {
  const first = edges.get(unseen.values().next().value), pending = [...first.groups], vertices = new Set(pending), selected = new Set();
  for (let j = 0; j < pending.length; j++) for (const e of other) {
    if (!e.groups.includes(pending[j])) continue;
    selected.add(e.key); unseen.delete(e.key);
    for (const g of e.groups) if (!vertices.has(g)) { vertices.add(g); pending.push(g); }
  }
  const positions = [...vertices].map(g => point(cloth.positions, groups[g][0]));
  openings.push({edges: [...selected].sort(), groups: [...vertices].sort((a,b)=>a-b),
    bounds: {min: [0,1,2].map(k=>Math.min(...positions.map(p=>p[k]))), max: [0,1,2].map(k=>Math.max(...positions.map(p=>p[k])))},
    touchedEdges: touched.filter(e=>selected.has(e.key)).map(e=>e.key)});
}
const witnesses = touched.map(e => ({...e, rawVertices: e.groups.map(g=>groups[g]), world: e.groups.map(g=>point(cloth.positions,groups[g][0]))}));
const counts = {};
for (const row of sourceReport.classification) for (const reason of row.reasons) counts[reason] = (counts[reason] ?? 0) + 1;
const report = {
  created: new Date().toISOString(), pid: process.pid, status: 'terminal-witness-recorded',
  pins: Object.fromEntries([`${input}/report.json`,`${input}/snapshot.json.gz`,ACCEPTED_PATH,'tools/figure-pipeline/neckline_attachment_terminal.mjs'].map(p=>[p,hashFile(path.join(ROOT,p))])),
  iterations: sourceReport.iterations.length, classifiedFaces: sourceReport.classification.length,
  regionFaces: region.size, shirtFaces: sourceReport.topology.shirtFaces, reasonCounts: counts,
  nonNeckOpenings: openings, touchedOpeningEdges: witnesses,
  lastAdditionFaces: last.addedFaces, noExhaustion: true,
  limits: ['This documents the declared closure stop. It does not prove that every other boundary is infeasible.', 'Distances and containment concern the complete body at one recorded pose; these are not visible-defect counts.']
};
fs.mkdirSync(path.join(ROOT,output));
fs.writeFileSync(path.join(ROOT,output,'report.json'),JSON.stringify(report,null,2)+'\n');
fs.copyFileSync(path.join(ROOT,'tools/figure-pipeline/neckline_attachment_terminal.mjs'),path.join(ROOT,output,'source.mjs'));
console.log(JSON.stringify({created:report.created,pid:report.pid,reportSHA256:hashFile(path.join(ROOT,output,'report.json')),openings:openings.map(o=>({edges:o.edges.length,bounds:o.bounds,touched:o.touchedEdges})),touched:witnesses},null,2));
