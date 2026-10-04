import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { Matrix4, Vector3, Quaternion } from 'three';
import { readGlb, readAccessor } from '../../../../tools/lut-bake/glb.mjs';

const root = fileURLToPath(new URL('../../../../', import.meta.url));
const out = fileURLToPath(new URL('./', import.meta.url));
assert.ok(!fs.existsSync(out + 'BODY.json'), 'One fresh inventory only');
const hash = p => crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const job = {pid:process.pid, started:new Date().toISOString(), node:process.version, status:'running',
  inputs:Object.fromEntries(['assets/wardrobe/body/g050.glb','tools/lut-bake/glb.mjs',
    'node_modules/three/package.json','docs/evidence/appearance-2026-10-04/knit-sweater-cage/inventory.mjs'].map(p=>[p,hash(root+p)]))};
try {
  const g = readGlb(root + 'assets/wardrobe/body/g050.glb');
  const nodes = g.json.nodes;
  const worlds = new Map(), parents = new Map();
  for(let i=0;i<nodes.length;i++) for(const c of nodes[i].children ?? []) {
    assert.ok(!parents.has(c),'Multiple node parents'); parents.set(c,i);
  }
  function world(i, trail=new Set()) {
    if(worlds.has(i))return worlds.get(i);
    assert.ok(!trail.has(i),'Node cycle'); const next=new Set([...trail,i]),n=nodes[i];
    const local=n.matrix ? new Matrix4().fromArray(n.matrix) : new Matrix4().compose(
      new Vector3(...(n.translation??[0,0,0])),new Quaternion(...(n.rotation??[0,0,0,1])),new Vector3(...(n.scale??[1,1,1])));
    const w=parents.has(i)?world(parents.get(i),next).clone().multiply(local):local;
    worlds.set(i,w);return w;
  }
  const mi=g.json.meshes.findIndex(m=>m.name==='base.001'); assert.ok(mi>=0);
  const owners=nodes.flatMap((n,i)=>n.mesh===mi?[i]:[]);assert.equal(owners.length,1);
  const ni=owners[0],p=g.json.meshes[mi].primitives; assert.equal(p.length,1);
  const primitive=p[0]; assert.equal(primitive.mode??4,4);
  const positions=readAccessor(g,primitive.attributes.POSITION).data;
  const indices=Array.from(readAccessor(g,primitive.indices).data);
  const meshWorld=world(ni),skin=g.json.skins[nodes[ni].skin];assert.ok(skin);
  const weightsAccessor=g.json.accessors[primitive.attributes.WEIGHTS_0];assert.equal(weightsAccessor.componentType,5126);
  const weights=readAccessor(g,primitive.attributes.WEIGHTS_0).data,joints=readAccessor(g,primitive.attributes.JOINTS_0).data;
  const ib=readAccessor(g,skin.inverseBindMatrices).data;
  const skinMatrices=skin.joints.map((j,i)=>world(j).clone().multiply(new Matrix4().fromArray(ib,i*16)));
  let deviation=0, weightError=0;
  const points=[];
  for(let v=0;v<positions.length/3;v++){
    const local=new Vector3().fromArray(positions,v*3),plain=local.clone().applyMatrix4(meshWorld),posed=new Vector3();let sum=0;
    for(let k=0;k<4;k++){const w=weights[v*4+k];sum+=w;assert.ok(w>=0 && Number.isFinite(w));
      if(w>0){assert.ok(skinMatrices[joints[v*4+k]]);posed.addScaledVector(local.clone().applyMatrix4(skinMatrices[joints[v*4+k]]),w);}}
    weightError=Math.max(weightError,Math.abs(sum-1));deviation=Math.max(deviation,posed.distanceTo(plain));points.push(posed.toArray());
  }
  assert.ok(weightError<1e-5,'Weights not unit-sum');assert.ok(deviation<1e-5,'Rest skin differs from mesh-world coordinates');
  assert.ok(points.flat().every(Number.isFinite));assert.ok(indices.every(i=>Number.isInteger(i)&&i>=0&&i<points.length));
  const bounds=pts=>({min:[0,1,2].map(k=>Math.min(...pts.map(p=>p[k]))),max:[0,1,2].map(k=>Math.max(...pts.map(p=>p[k])))});
  const b=bounds(points),slabs=[];
  for(let y=b.min[1];y<b.max[1];y+=.1){const pts=points.filter(p=>p[1]>=y&&p[1]<y+.1);if(pts.length)slabs.push({y,count:pts.length,...bounds(pts)});}
  const body={source:'assets/wardrobe/body/g050.glb',sha256:job.inputs['assets/wardrobe/body/g050.glb'],mesh:'base.001',
    meshNode:ni,meshWorld:meshWorld.toArray(),vertexCount:points.length,triangleCount:indices.length/3,
    restSkinMaxDeviation:deviation,maxWeightSumError:weightError,bounds:b,slabs,
    jointWorldPositions:skin.joints.map(i=>({node:i,name:nodes[i].name,position:new Vector3().setFromMatrixPosition(world(i)).toArray()})),
    contextPolicy:'All original meshes/full indices, no _HIDE_* masks, no animation/morph changes, glTF rest scene. Static context only; no fit or anatomy acceptance.'};
  fs.writeFileSync(out+'BODY.json',JSON.stringify(body,null,2)+'\n');
  job.status='passed';job.output={file:'BODY.json',sha256:hash(out+'BODY.json')};
}catch(e){job.status='failed';job.error=e.stack;process.exitCode=1;}
job.finished=new Date().toISOString();fs.writeFileSync(out+'INVENTORY-JOB.json',JSON.stringify(job,null,2)+'\n');
console.log(JSON.stringify(job));
