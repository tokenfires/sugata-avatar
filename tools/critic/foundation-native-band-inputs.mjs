// Prepare exact accepted body/mask correspondence for the isolated native construction.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { gzipSync } from 'node:zlib';
import { readGlb, readPrimitive, readAccessor } from '../lut-bake/glb.mjs';
import { ROOT, hashFile, sha256 } from '../figure-pipeline/collar_replacement_manifest.mjs';

const out = path.join(ROOT, 'tmp/foundation-band-sep30/accepted-inputs.json.gz');
assert.ok(!fs.existsSync(out), 'Fresh input receipt required');
const files = ['assets/wardrobe/body/g050.glb', 'assets/wardrobe/foundation_bra/g050.glb',
  'assets/identity/figure-vertex-map.bin', 'assets/identity/figure-vertex-map.json',
  'assets/wardrobe/manifest.json', 'tools/critic/foundation-native-band-inputs.mjs',
  'tools/lut-bake/glb.mjs', 'tools/figure-pipeline/collar_replacement_manifest.mjs',
  'docs/evidence/nonhair-2026-09-26/wardrobe-coupling/inventory-v1.json'];
const pins = Object.fromEntries(files.map(f => [f, hashFile(path.join(ROOT, f))]));
assert.equal(pins[files[0]], 'fc4445c95ed3f423734ff272ee78ebb44d762a8f16edb94b26039de7a8a96b3a');
assert.equal(pins[files[1]], '4a3366377087bbfb2d5779ba4d6f5de09735e1810ae4ea9b6a22e11d3aee0d79');
const glb = readGlb(path.join(ROOT, files[0]));
const body = readPrimitive(glb, 'base.001');
const primitive = glb.json.meshes.find(m => m.name === 'base.001').primitives[0];
const masks = Object.fromEntries(Object.entries(primitive.attributes)
  .filter(([n]) => /^_(HIDE|DECENCY)_/.test(n))
  .map(([n, a]) => {
    assert.equal(glb.json.accessors[a].normalized ?? false, false);
    const value = readAccessor(glb, a); assert.equal(value.components, 1);
    return [n, Array.from(value.data)];
  }));
assert.ok(Object.keys(masks).length > 3);
assert.equal(masks._DECENCY_CHEST.filter(v => v > .5).length, 110);
const map = fs.readFileSync(path.join(ROOT, files[2]));
assert.equal(map.length, 2 * body.vertexCount);
const rows = new Map();
for (let i = 0; i < body.vertexCount; i++) {
  const id = map.readUInt16LE(i * 2);
  const values = {position: Array.from(body.positions.slice(i * 3, i * 3 + 3)),
    masks: Object.fromEntries(Object.entries(masks).map(([n, a]) => [n, a[i]]))};
  if (rows.has(id)) assert.deepEqual(rows.get(id).values, values);
  else rows.set(id, {source: id, values, exported: []});
  rows.get(id).exported.push(i);
}
assert.equal(rows.size, 13380);
const value = {created: new Date().toISOString(), pid: process.pid, pins,
  vertexCount: body.vertexCount, sourceCount: rows.size, maskNames: Object.keys(masks),
  vertices: [...rows.values()].sort((a, b) => a.source - b.source),
  basis: '(native x,native z,-native y)', scope: 'Accepted source correspondence only'};
const raw = Buffer.from(JSON.stringify(value) + '\n');
const encoded = gzipSync(raw, {mtime: 0});
fs.writeFileSync(out, encoded);
const receipt = {path: out, bytes: encoded.length, sha256: sha256(encoded), decodedSHA256: sha256(raw),
  pid: process.pid, created: value.created, sourceCount: rows.size, maskNames: value.maskNames};
fs.writeFileSync(path.join(path.dirname(out), 'input-receipt.json'), JSON.stringify(receipt, null, 2) + '\n');
console.log(JSON.stringify(receipt));
