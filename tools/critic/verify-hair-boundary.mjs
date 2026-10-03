/** Separate root arithmetic for captured triangle corners and screen projections. No browser. */
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readGlb,readAccessor,readMorphTargets} from '../lut-bake/glb.mjs';
const dir='captures/hair-boundary-2026-10-02-v1';
const hash=p=>createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const report=JSON.parse(fs.readFileSync(dir+'/report.json'));
assert.equal(report.status,'captured');assert.deepEqual(report.errors,[]);
assert.deepEqual(report.cleanup,{page:'closed',browser:'closed',server:'closed'});assert.equal(report.explicitAvatarRetired,true);
for(const [p,h]of Object.entries(report.sourceHashes))assert.equal(hash(p),h,p);
const glb=readGlb('assets/figures/figure_g050.glb'),mesh=glb.json.meshes.find(m=>m.name==='base.001'),primitive=mesh.primitives[0];
const attrs=Object.fromEntries(Object.entries(primitive.attributes).map(([n,i])=>[n,readAccessor(glb,i)]));
const morphs=readMorphTargets(glb,'base.001');
const inputs=report.setup.poseInputs;assert.equal(inputs.morphTargetsRelative,true);
const actual=new Map(inputs.vertices.map(v=>[v.index,v]));
// JSON recordings normalize signed zero. Compare numerical equality, with no tolerance.
function same(a,b){assert.equal(a.length,b.length);a.forEach((x,i)=>assert.ok(x===b[i],`value mismatch at${i}`));}
let maximumWeightDifference=0;
for(const v of actual.values()){
 same(v.position,Array.from(attrs.POSITION.data.slice(v.index*3,v.index*3+3)));
 same(v.joints,Array.from(attrs.JOINTS_0.data.slice(v.index*4,v.index*4+4)));
 const weights=Array.from(attrs.WEIGHTS_0.data.slice(v.index*4,v.index*4+4));
 const l1=weights.reduce((s,x)=>s+Math.abs(x),0);assert.ok(l1>0);
 const normalized=weights.map(x=>Math.fround(x/l1));same(v.weights,normalized);
 maximumWeightDifference=Math.max(maximumWeightDifference,...weights.map((x,i)=>Math.abs(x-v.weights[i])));
 for(const m of v.morphs){const source=morphs.get(m.name);assert.ok(source,m.name);same(m.delta,Array.from(source.slice(v.index*3,v.index*3+3)));}
}
const mul=(m,v)=>[0,1,2,3].map(row=>[0,1,2,3].reduce((s,col)=>s+m[col*4+row]*v[col],0));
const point=(m,p)=>{const q=mul(m,[...p,1]);assert.ok(q[3]!==0);return q.slice(0,3).map(x=>x/q[3]);};
function pose(v,state){
 const p=v.position.slice();for(const m of v.morphs){const w=state.morphs[m.index];for(let k=0;k<3;k++)p[k]+=m.delta[k]*w;}
 const bound=point(state.bindMatrix,p),sum=[0,0,0];
 v.joints.forEach((j,i)=>{if(v.weights[i]===0)return;const p=point(state.bones[j].matrix,point(state.boneInverses[j],bound));for(let k=0;k<3;k++)sum[k]+=p[k]*v.weights[i];});
 return point(state.bodyMatrix,point(state.bindMatrixInverse,sum));
}
let maximumCornerMetres=0,maximumAnchorMetres=0,maximumPixelError=0,anchors=0;
const diff=(a,b)=>Math.hypot(...a.map((x,i)=>x-b[i]));
for(const view of report.views){
 same(view.state.morphs,report.setup.state.morphs);assert.deepEqual(view.state.bones,report.setup.state.bones);
 if(view.view==='front-bare')assert.deepEqual(view.state.camera,report.views[0].state.camera);
 assert.equal(hash(dir+'/'+view.beauty.file),view.beauty.sha256);
 for(const annotation of view.annotations){
  assert.equal(hash(dir+'/'+annotation.file),annotation.sha256);assert.equal(annotation.unoccluded,true);
  for(const key of ['opening','part'])for(const a of annotation.projected[key]){
   const sourceIds=Array.from(readAccessor(glb,primitive.indices).data.slice(a.bodyTriangle*3,a.bodyTriangle*3+3));same(a.indices,sourceIds);
   const corners=a.indices.map(i=>pose(actual.get(i),view.state));
   corners.forEach((p,i)=>maximumCornerMetres=Math.max(maximumCornerMetres,diff(p,a.worldCorners[i])));
   const world=[0,1,2].map(k=>corners.reduce((s,p,i)=>s+p[k]*a.bary[i],0));maximumAnchorMetres=Math.max(maximumAnchorMetres,diff(world,a.world));
   const camera=point(view.state.camera.inverse,world),q=mul(view.state.camera.projection,[...camera,1]);
   const ndc=q.slice(0,3).map(x=>x/q[3]),pixel=[(ndc[0]+1)*view.state.canvas[0]/2,(1-ndc[1])*view.state.canvas[1]/2];
   maximumPixelError=Math.max(maximumPixelError,diff(pixel,a.pixel));anchors++;
  }
 }
}
assert.equal(anchors,96);assert.ok(maximumCornerMetres<1e-9&&maximumAnchorMetres<1e-9&&maximumPixelError<1e-6);
const result={created:new Date().toISOString(),pid:process.pid,captureReportSha256:hash(dir+'/report.json'),verifierSha256:hash('tools/critic/verify-hair-boundary.mjs'),actualCornerInputs:actual.size,anchors,maximumWeightDifference,maximumCornerMetres,maximumAnchorMetres,maximumPixelError,
 limits:'Pose registration, raw runtime input correspondence and preservation only; no visibility/coverage/continuous boundary/hairstyle acceptance. GPU adapter fields serialized empty; hardware identity not asserted.'};
fs.writeFileSync(dir+'/root-verification.json',JSON.stringify(result,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify(result));
