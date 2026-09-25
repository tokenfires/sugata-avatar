import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readGlb } from '../lut-bake/glb.mjs';
import { replaceHairAtlas } from './hair_atlas.mjs';

const repo = fileURLToPath(new URL('../../', import.meta.url));
const source = path.join(repo, 'assets/hair/bob01/g050.glb');
const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'sugata-atlas-'));
try {
  const original = readGlb(source);
  const images = new Set(original.json.images.map(image => image.bufferView));
  const preserved = original.json.bufferViews.map(view => Buffer.from(original.bin.subarray(
    view.byteOffset ?? 0, (view.byteOffset ?? 0) + view.byteLength)));
  // Change payload lengths as well as contents; simply overwriting the old offsets cannot pass.
  const replacement = { albedo: Buffer.from('atlas-albedo-with-a-new-length'), normal: Buffer.from('normal') };
  const result = replaceHairAtlas(readGlb(source), replacement);
  const file = path.join(directory, 'candidate.glb');
  fs.writeFileSync(file, result);
  const updated = readGlb(file);
  for (const [index, view] of updated.json.bufferViews.entries()) {
    const bytes = updated.bin.subarray(view.byteOffset ?? 0, (view.byteOffset ?? 0) + view.byteLength);
    assert.equal(view.byteOffset % 4, 0, `alignment ${index}`);
    if (!images.has(index)) assert.deepEqual(bytes, preserved[index], `non-image buffer ${index}`);
  }
  assert.deepEqual(updated.json.accessors, original.json.accessors);
  assert.deepEqual(updated.json.skins, original.json.skins);
  assert.deepEqual(updated.json.meshes, original.json.meshes);
  assert.deepEqual(replaceHairAtlas(readGlb(file), replacement), result, 'idempotent repacking');
  const material = updated.json.materials[0];
  for (const [texture, expected] of [[material.pbrMetallicRoughness.baseColorTexture, replacement.albedo],
    [material.normalTexture, replacement.normal]]) {
    const view = updated.json.bufferViews[updated.json.images[updated.json.textures[texture.index].source].bufferView];
    assert.deepEqual(updated.bin.subarray(view.byteOffset, view.byteOffset + view.byteLength), expected);
  }
  console.log('PASS — atlas replacement preserves all geometry, skinning and accessor bytes; payloads, alignment and idempotence verified.');
} finally {
  fs.rmSync(directory, { recursive: true, force: true });
}
