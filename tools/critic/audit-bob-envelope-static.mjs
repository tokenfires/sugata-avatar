// Preserve the exact scope of the final static prototype. No appearance assertion.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readGlb, readAccessor } from '../lut-bake/glb.mjs';

const root = 'captures/bob-posterior-envelope-v3';
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const read = file => JSON.parse(fs.readFileSync(file));
const report = read(`${root}/candidate-report.json`);
assert.equal(sha(fs.readFileSync(`${root}/candidate.glb`)), report.outputSha256);
assert.equal(sha(fs.readFileSync(report.accepted)), report.acceptedSha256);
const selected = new Set(report.changedFromAcceptedCards);
const a = readGlb(report.accepted), b = readGlb(`${root}/candidate.glb`);
const ap = a.json.meshes.find(m => m.name === 'hair_bob02').primitives[0];
const bp = b.json.meshes.find(m => m.name === 'hair_bob02').primitives[0];
assert.deepEqual(Object.keys(ap.attributes), Object.keys(bp.attributes));
const attributes = {};
for (const name of Object.keys(ap.attributes)) {
  const av = readAccessor(a, ap.attributes[name]), bv = readAccessor(b, bp.attributes[name]);
  assert.equal(av.count, bv.count); assert.equal(av.components, bv.components);
  let changed = 0;
  const cards = new Set();
  for (let i = 0; i < av.count; i++) {
    if (!Array.from({ length: av.components }, (_, k) => av.data[i * av.components + k] === bv.data[i * av.components + k]).every(Boolean)) {
      changed++;
      const card = Math.floor((i - 652) / 34);
      assert.ok(i >= 652 && selected.has(card), `${name}: unexpected changed vertex ${i}`);
      assert.ok(['POSITION', 'NORMAL'].includes(name), `${name}: protected attribute changed`);
      cards.add(card);
    }
  }
  attributes[name] = { changedRecords: changed, changedCards: [...cards].sort((x, y) => x - y) };
}
assert.deepEqual(readAccessor(a, ap.indices).data, readAccessor(b, bp.indices).data);
for (const key of ['nodes', 'skins', 'scenes', 'materials', 'textures', 'images']) assert.deepEqual(a.json[key], b.json[key], key);
for (const skin of a.json.skins) if (skin.inverseBindMatrices !== undefined) assert.deepEqual(readAccessor(a, skin.inverseBindMatrices).data, readAccessor(b, skin.inverseBindMatrices).data);

const pairs = [];
for (const [controlDir, candidateDir] of [['captures/bob-posterior-envelope-v1/control', `${root}/neutral`], [`${root}/dark-control`, `${root}/dark-candidate`]]) {
  const control = read(`${controlDir}/report.json`), candidate = read(`${candidateDir}/report.json`);
  assert.equal(control.status, 'captured'); assert.equal(candidate.status, 'captured');
  assert.deepEqual(control.errors, []); assert.deepEqual(candidate.errors, []);
  for (const c of candidate.cases) {
    const d = control.cases.find(x => x.view === c.view && x.colour.id === c.colour.id);
    assert.ok(d);
    for (const [dir, item] of [[controlDir, d], [candidateDir, c]]) assert.equal(sha(fs.readFileSync(`${dir}/${item.filename}`)), item.imageSha256);
    const strip = state => Object.fromEntries(Object.entries(state).filter(([key]) => !['positions', 'velocities', 'vertices'].includes(key)));
    assert.deepEqual(strip(c.fixedState), strip(d.fixedState));
    for (const key of ['clock', 'applied', 'lightingChanges', 'hidden', 'identity', 'size']) assert.deepEqual(c[key], d[key], key);
    assert.equal(c.candidateLoads, 1); assert.equal(d.candidateLoads, 0);
    const row = { control: `${controlDir}/${d.filename}`, candidate: `${candidateDir}/${c.filename}`, view: c.view, colour: c.colour.id, controlsExact: true };
    const ag = control.geometryFiles?.find(g => g.view === c.view), bg = candidate.geometryFiles?.find(g => g.view === c.view);
    if (ag && bg) {
      const aa = fs.readFileSync(`${controlDir}/${ag.filename}`), bb = fs.readFileSync(`${candidateDir}/${bg.filename}`);
      assert.equal(sha(aa), ag.sha256); assert.equal(sha(bb), bg.sha256);
      const ga = JSON.parse(aa), gb = JSON.parse(bb); assert.deepEqual(ga.headMatrix, gb.headMatrix);
      let nonselectedComponents = 0, max = 0;
      const examples = [];
      for (let i = 0; i < ga.liveVertices.length; i++) {
        const card = Math.floor(i / 102);
        if (selected.has(card)) continue;
        assert.equal(ga.restVertices[i], gb.restVertices[i]);
        const delta = Math.abs(ga.liveVertices[i] - gb.liveVertices[i]) * 1000;
        if (delta > 0) { nonselectedComponents++; max = Math.max(max, delta); if (examples.length < 8) examples.push({ card, ring: Math.floor((i % 102) / 6), side: Math.floor((i % 6) / 3), axis: i % 3, deltaMm: delta }); }
      }
      Object.assign(row, { nonselectedComponents, maximumNonselectedComponentDeltaMm: max, examples });
    }
    pairs.push(row);
  }
}
const result = { status: 'complete', generated: new Date().toISOString(), acceptedSha256: report.acceptedSha256, candidateSha256: report.outputSha256, attributes, topologyExact: true, rigAndMaterialMetadataExact: true, pairs,
  limits: ['POSITION/NORMAL changes are restricted to the 265 declared cards. Their width axes and paths change.', 'Held-pose numerical equality does not establish moving shared-collider equality or appearance acceptance.', 'Nonselected comparison includes restored card47. Cap live vertices are not present in these per-card GPU arrays.'],
  sourceSha256: sha(fs.readFileSync('tools/critic/audit-bob-envelope-static.mjs')) };
fs.writeFileSync(`${root}/static-isolation.json`, JSON.stringify(result, null, 2) + '\n', { flag: 'wx' });
fs.copyFileSync('tools/critic/audit-bob-envelope-static.mjs', `${root}/audit-bob-envelope-static.mjs`);
console.log(JSON.stringify({ attributes: Object.fromEntries(Object.entries(attributes).map(([k,v]) => [k,v.changedRecords])), pairs: pairs.length, maximumNonselectedComponentDeltaMm: Math.max(...pairs.map(p => p.maximumNonselectedComponentDeltaMm ?? 0)) }));
