// Preserve the exact scope of the final static prototype. No appearance assertion.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readGlb, readAccessor } from '../lut-bake/glb.mjs';

const root = process.argv.find(x=>x.startsWith('--directory='))?.slice(12) ?? 'captures/bob-side-envelope-v1';
assert.ok(/^captures\/bob-side-envelope-v[13]$/.test(root));
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const read = file => JSON.parse(fs.readFileSync(file));
const report = read(`${root}/candidate-report.json`);
if(root.endsWith('v3')){report.input='captures/bob-posterior-envelope-v3/candidate.glb';report.inputSha256='d477f9079577f1205b706941a789b608a3dbb6974a022a6888251737abb26146';report.selected=report.changedFromPosteriorCards;}
assert.equal(sha(fs.readFileSync(`${root}/candidate.glb`)), report.outputSha256);
assert.equal(sha(fs.readFileSync(report.input)), report.inputSha256);
const selected = new Set(report.selected);
const a = readGlb(report.input), b = readGlb(`${root}/candidate.glb`);
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

const result={status:'complete',candidateSha256:report.outputSha256,inputSha256:report.inputSha256,attributes,topologyExact:true,rigAndMaterialMetadataExact:true,sourceSha256:sha(fs.readFileSync('tools/critic/audit-bob-side-static.mjs')),limits:['Authored isolation only; runtime collider and other-card response can change.','Only the declared selected cards extend the frozen posterior. No visual or motion claim.']};
fs.writeFileSync(`${root}/static-isolation.json`,JSON.stringify(result,null,2)+'\n',{flag:'wx'});fs.copyFileSync('tools/critic/audit-bob-side-static.mjs',`${root}/audit-bob-side-static.mjs`);console.log(JSON.stringify({attributes:Object.fromEntries(Object.entries(attributes).map(([k,v])=>[k,v.changedRecords])),topologyExact:true}));
