// One measured distal-envelope probe. Frozen v1, accepted assets and root ring stay intact.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {BufferGeometry,BufferAttribute,Vector3} from 'three';
import {readGlb,readPrimitive} from '../lut-bake/glb.mjs';
import {encodeGlb,sha256,updateMovedFrames} from '../figure-pipeline/hair_fall.mjs';
const input='captures/hair-colour-2026-09-29/nape-guide-v1/candidate.glb';
const witness='captures/nape-motion-v2/candidate-rear-oblique-brown/distal-contact-witness.json';
const output='captures/nape-distal-v1/candidate.glb';
assert.ok(!fs.existsSync(output));
assert.equal(sha256(fs.readFileSync(input)),'dc6d17fbd6b98facd81e420ee24b46e28c2514243e065446e30ab2ef6de27427');
const evidence=JSON.parse(fs.readFileSync(witness));
assert.equal(evidence.frame,255);assert.deepEqual(evidence.rows.map(r=>r.vertex),[26,31,33]);
const direction=new Vector3();for(const row of evidence.rows)direction.add(new Vector3().fromArray(row.directionInAuthoredSpace));direction.normalize();
const displacement=direction.clone().multiplyScalar(.007);
const glb=readGlb(input),original=readPrimitive(glb,'hair_bob02'),positions=new Float32Array(original.positions);
const moved=[];
for(let ring=1;ring<17;ring++)for(let side=0;side<2;side++){
  const vertex=652+(281*17+ring)*2+side;
  new Vector3().fromArray(positions,vertex*3).addScaledVector(displacement,(ring/16)**3).toArray(positions,vertex*3);moved.push(vertex);
}
const geometry=new BufferGeometry().setAttribute('position',new BufferAttribute(positions,3));
geometry.setIndex(new BufferAttribute(new Uint32Array(original.indices),1));
const normals=updateMovedFrames(geometry,original,moved).normals;
const attrs=glb.json.meshes.find(m=>m.name==='hair_bob02').primitives[0].attributes;
assert.equal(attrs.TANGENT,undefined);
for(const [name,values] of [['POSITION',positions],['NORMAL',normals]]){
  const accessor=glb.json.accessors[attrs[name]],view=glb.json.bufferViews[accessor.bufferView];
  assert.equal(accessor.componentType,5126);assert.equal(accessor.type,'VEC3');assert.ok(!accessor.sparse);
  const start=(view.byteOffset??0)+(accessor.byteOffset??0),stride=view.byteStride??12;
  for(let v=0;v<accessor.count;v++)for(let k=0;k<3;k++)glb.bin.writeFloatLE(values[v*3+k],start+v*stride+k*4);
  accessor.min=[0,1,2].map(k=>Math.min(...Array.from({length:accessor.count},(_,v)=>values[v*3+k])));
  accessor.max=[0,1,2].map(k=>Math.max(...Array.from({length:accessor.count},(_,v)=>values[v*3+k])));
}
const report={experiment:'nape-distal-v1',status:'unqualified',input,inputSha256:sha256(fs.readFileSync(input)),witness,witnessSha256:sha256(fs.readFileSync(witness)),
  card:281,movedVertices:moved.length,tipDisplacementMetres:displacement.toArray(),magnitudeMm:7,weight:'(ring/16)^3',
  rationale:'The three inside vertices at frame255 have consistent outward directions. Seven millimetres at the tip exceeds the measured3.864mm depth by a chosen3.136mm probe margin, not a qualified safety envelope.',
  prediction:'Reduce the distal neck intersection in the fixed upward tilt, retaining the short silhouette, root ring and all authored width-axis vectors. No root-frame tuning.',
  rejectOn:['remaining selected contact in the sampled sequence','new visible gap, blunt ledge, outward hook or local fold','unexplained other-card or shared-collider change'],
  limits:['One witness-driven contour experiment; sampled and unsampled motion remain unqualified.','A translation of both edges preserves width vectors up to Float32 rounding; live reconstruction still needs measurement.']};
glb.json.asset.extras.sugataUnqualifiedExperiment=report;
const bytes=encodeGlb(glb);report.outputSha256=sha256(bytes);
fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,bytes,{flag:'wx'});
fs.writeFileSync(path.join(path.dirname(output),'candidate-report.json'),JSON.stringify(report,null,2)+'\n',{flag:'wx'});
fs.copyFileSync(new URL(import.meta.url),path.join(path.dirname(output),'bob-nape-distal-candidate.mjs'));
console.log(JSON.stringify(report,null,2));
