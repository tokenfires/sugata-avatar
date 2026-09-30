// Matched held captures of one lower-curve probe, including its protected upper vertices.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
const root = 'captures/bob-lower-curve-v1';
const controlDir = 'captures/bob-side-envelope-v3/neutral';
const read = file => JSON.parse(fs.readFileSync(file));
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const authoring = read(`${root}/candidate-report.json`);
const a = read(`${controlDir}/report.json`), b = read(`${root}/neutral/report.json`);
for (const report of [a, b]) { assert.equal(report.status, 'captured'); assert.deepEqual(report.errors, []); }
assert.equal(sha(fs.readFileSync(`${root}/candidate.glb`)), authoring.outputSha256);
assert.equal(a.sourceHashes[a.candidate], authoring.inputSha256);
assert.equal(b.sourceHashes[b.candidate], authoring.outputSha256);
const commonSources = report => Object.fromEntries(Object.entries(report.sourceHashes).filter(([p]) => p !== report.candidate));
assert.deepEqual(commonSources(a), commonSources(b));
const records = new Map(authoring.records.map(r => [r.card, r]));
const rows = [];
for (const item of b.cases) {
  const baseline = a.cases.find(v => v.view === item.view && v.colour.id === item.colour.id);
  assert.ok(baseline);
  const strip = state => Object.fromEntries(Object.entries(state).filter(([key]) => !['positions', 'velocities', 'vertices'].includes(key)));
  assert.deepEqual(strip(item.fixedState), strip(baseline.fixedState));
  for (const key of ['clock', 'applied', 'lightingChanges', 'hidden', 'identity', 'size', 'backend', 'adapter']) assert.deepEqual(item[key], baseline[key], key);
  assert.equal(item.candidateLoads, 1); assert.equal(baseline.candidateLoads, 1);
  const geometry = [];
  for (const [dir, report, record] of [[controlDir, a, baseline], [`${root}/neutral`, b, item]]) {
    assert.equal(sha(fs.readFileSync(`${dir}/${record.filename}`)), record.imageSha256);
    const g = report.geometryFiles.find(v => v.view === record.view);
    assert.equal(sha(fs.readFileSync(`${dir}/${g.filename}`)), g.sha256);
    geometry.push(read(`${dir}/${g.filename}`));
  }
  const [before, after] = geometry;
  for (const key of ['headMatrix', 'indices', 'uv', 'uv1', 'chainCount', 'pointsPerChain', 'vertexBase', 'steps']) assert.deepEqual(before[key], after[key], key);
  const metrics = {protected: {vertices: 0, changedComponents: 0, maximumVertexDeltaMm: 0, witness: null},
    otherCards: {vertices: 0, changedComponents: 0, maximumVertexDeltaMm: 0, witness: null}};
  for (let v = 0; v < before.liveVertices.length / 3; v++) {
    const card = Math.floor(v / 34), ring = Math.floor(v % 34 / 2), side = v % 2;
    const record = records.get(card);
    if (record && ring >= record.firstMovedRing) continue;
    let squared = 0, changedComponents = 0;
    for (let k = 0; k < 3; k++) {
      const i = v * 3 + k;
      assert.equal(before.restVertices[i], after.restVertices[i], `protected authored vertex ${v}`);
      const delta = (after.liveVertices[i] - before.liveVertices[i]) * 1000;
      squared += delta * delta;
      if (delta !== 0) changedComponents++;
    }
    for (const key of record ? ['protected'] : ['protected', 'otherCards']) {
      const m = metrics[key], distance = Math.sqrt(squared);
      m.vertices++; m.changedComponents += changedComponents;
      if (distance > m.maximumVertexDeltaMm) { m.maximumVertexDeltaMm = distance; m.witness = {card, ring, side}; }
    }
  }
  assert.equal(metrics.protected.vertices, 11962);
  assert.equal(metrics.otherCards.vertices, 5440);
  rows.push({view: item.view, recordedControlsExact: true, commonSourceHashesExact: true,
    protectedAuthoredVerticesExact: true, metrics});
}
assert.equal(rows.length, 5);
const source = 'tools/critic/audit-bob-lower-captures.mjs';
const result = {status: 'complete', baseline: a.candidate, baselineSha256: authoring.inputSha256,
  candidate: b.candidate, candidateSha256: authoring.outputSha256, rows, sourceSha256: sha(fs.readFileSync(source)),
  limits: ['Held controls and authored isolation do not establish moving or visual acceptance.',
    'Protected live response is measured separately; exact authored upper vertices do not imply exact simulated coordinates.',
    'Cap vertices are not in the per-card live readback arrays.']};
fs.writeFileSync(`${root}/paired-captures.json`, JSON.stringify(result, null, 2) + '\n', {flag: 'wx'});
fs.copyFileSync(source, `${root}/audit-bob-lower-captures.mjs`);
console.log(JSON.stringify(result, null, 2));
