#!/usr/bin/env node
/** Replace embedded hair atlases without changing geometry or retaining unused image payloads. */
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { readGlb } from '../lut-bake/glb.mjs';
import { encodeGlb } from './hair_fall.mjs';

export function replaceHairAtlas(glb, { albedo, normal }) {
  const replacements = new Map();
  for (const material of glb.json.materials ?? []) {
    for (const [texture, bytes] of [
      [material.pbrMetallicRoughness?.baseColorTexture, albedo],
      [material.normalTexture, normal]
    ]) {
      if (!texture) continue;
      const image = glb.json.images[glb.json.textures[texture.index].source];
      if (image.mimeType !== 'image/png' || image.bufferView === undefined) {
        throw new Error('Hair atlas replacement requires embedded PNG images.');
      }
      replacements.set(image.bufferView, bytes);
    }
  }
  if (replacements.size !== 2) throw new Error(`Expected two embedded atlases, found ${replacements.size}.`);
  const chunks = [];
  let offset = 0;
  for (const [index, view] of glb.json.bufferViews.entries()) {
    if (view.buffer !== 0) throw new Error('Only a single GLB buffer is supported.');
    const bytes = replacements.get(index) ?? glb.bin.subarray(view.byteOffset ?? 0,
      (view.byteOffset ?? 0) + view.byteLength);
    view.byteOffset = offset;
    view.byteLength = bytes.length;
    chunks.push(bytes);
    const padding = (4 - bytes.length % 4) % 4;
    chunks.push(Buffer.alloc(padding));
    offset += bytes.length + padding;
  }
  glb.bin = Buffer.concat(chunks);
  glb.json.buffers[0].byteLength = glb.bin.length;
  return encodeGlb(glb);
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const [input, atlas, output] = process.argv.slice(2);
  if (!input || !atlas || !output) throw new Error('Usage: hair_atlas.mjs input.glb atlas-directory output.glb');
  const result = replaceHairAtlas(readGlb(input), {
    albedo: fs.readFileSync(path.join(atlas, 'albedo.png')),
    normal: fs.readFileSync(path.join(atlas, 'normal.png'))
  });
  fs.writeFileSync(output, result);
}
