// CPU reconstruction of source-native getVertexPosition. No asset or runtime mutation.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { gunzipSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { Bone, Skeleton, SkinnedMesh, BufferGeometry, Float32BufferAttribute, Uint16BufferAttribute, Matrix4, Vector3 } from 'three';
import { readGlb, readPrimitive, readAccessor } from '../../../../../tools/lut-bake/glb.mjs';
export const ROOT = fileURLToPath(new URL('../../../../../', import.meta.url));
export const BASE = path.join(ROOT, 'captures/hand-attribution-2026-09-26/primary-v4');
export const sha = x => createHash('sha256').update(x).digest('hex');
export const read = x => fs.readFileSync(x);
export const json = x => JSON.parse(read(x));
export const report = json(path.join(BASE, 'report.json'));
assert.equal(report.completed, true);
assert.equal(sha(read(path.join(BASE, 'report.json'))), 'bb12301ca0fd0db5097ad8fe6221498228612c2fcd314dac4377ca686d22a74e');
export const sourceHashes = {};
for (const rel of ['tools/lut-bake/glb.mjs', 'node_modules/three/build/three.core.js', 'node_modules/three/build/three.module.js']) {
 sourceHashes[rel] = sha(read(path.join(ROOT, rel))); assert.equal(sourceHashes[rel], report.sourceHashes[rel]);
}
export const sources = {};
for (const id of ['body', 'foundation_bra', 'foundation_briefs', 'female_casualsuit01', 'shoes01']) {
 const rel = `assets/wardrobe/${id}/g050.glb`, file = path.join(BASE, 'source', rel);
 sourceHashes[rel] = sha(read(file)); assert.equal(sourceHashes[rel], report.sourceHashes[rel]);
 const glb = readGlb(file), primitive = glb.json.meshes[0].primitives[0];
 const source = readPrimitive(glb, id === 'body' ? 'base.001' : id);
 const meshNode = glb.json.nodes.find(n => n.mesh === 0);
 assert.ok(!meshNode.matrix && !meshNode.translation && !meshNode.rotation && !meshNode.scale, 'Identity source mesh required');
 const skin = glb.json.skins[0];
 sources[id] = { glb, primitive, source, skin, names: skin.joints.map(i => glb.json.nodes[i].name) };
}
const bs = sources.body;
const inverse = readAccessor(bs.glb, bs.skin.inverseBindMatrices).data;
export const bones = bs.names.map(name => { const bone = new Bone(); bone.name = name; return bone; });
export const skeleton = new Skeleton(bones, bones.map((_, i) => new Matrix4().fromArray(inverse, i * 16)));
export const meshes = {};
for (const [id, s] of Object.entries(sources)) {
 const g = new BufferGeometry();
 g.setAttribute('position', new Float32BufferAttribute(s.source.positions, 3));
 const ix = readAccessor(s.glb, s.primitive.attributes.JOINTS_0).data;
 const remapped = Array.from(ix, i => bs.names.indexOf(s.names[i])); assert.ok(remapped.every(i => i >= 0));
 g.setAttribute('skinIndex', new Uint16BufferAttribute(remapped, 4));
 g.setAttribute('skinWeight', new Float32BufferAttribute(readAccessor(s.glb, s.primitive.attributes.WEIGHTS_0).data, 4));
 if (s.primitive.targets) {
  g.morphAttributes.position = s.primitive.targets.map(t => new Float32BufferAttribute(readAccessor(s.glb, t.POSITION).data, 3));
  g.morphTargetsRelative = true;
 }
 const mesh = new SkinnedMesh(g); mesh.normalizeSkinWeights(); mesh.bind(skeleton, new Matrix4()); mesh.updateMatrixWorld(true); meshes[id] = mesh;
}
export function snapshot(arm, step) {
 const entry = report.runs.find(r => r.arm === arm).geometry.find(g => g.step === step);
 assert.ok(entry); const raw = read(path.join(BASE, entry.file)); assert.equal(sha(raw), entry.sha256);
 const decoded = gunzipSync(raw); assert.equal(sha(decoded), entry.decodedSHA256);
 return { entry, value: JSON.parse(decoded) };
}
export function reconstruct(s, transform = null) {
 for (const bone of bones) { bone.matrixWorld.fromArray(s.rig[bone.name]); if (transform) transform(bone, s); }
 meshes.body.morphTargetInfluences = [...s.telemetry.morphs];
 const v = new Vector3();
 return s.meshes.map(record => {
  const mesh = meshes[record.id], positions = new Float32Array(record.positions.length);
  for (let i = 0; i < positions.length / 3; i++) mesh.getVertexPosition(i, v).applyMatrix4(mesh.matrixWorld).toArray(positions, i * 3);
  return { id: record.id, positions: Array.from(positions), fullIndices: record.fullIndices, drawnIndices: record.drawnIndices };
 });
}
export function verifyExact(s, reconstructed) {
 return s.meshes.map((original, m) => {
  const result = reconstructed[m]; assert.equal(result.id, original.id);
  let differences = 0, maximumError = 0, first = null;
  original.positions.forEach((v, i) => { if (v !== result.positions[i]) { differences++; maximumError = Math.max(maximumError, Math.abs(v - result.positions[i])); first ??= { component: i, native: v, reconstructed: result.positions[i] }; } });
  return { id: original.id, components: original.positions.length, differences, maximumError, first, reconstructedPositionsSHA256: sha(JSON.stringify(result.positions)) };
 });
}
