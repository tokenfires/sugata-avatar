// Held comparisons of the exact inner-card restoration; no motion or visual pass inferred.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
const root='captures/bob-lower-fallback-v1',read=p=>JSON.parse(fs.readFileSync(p));
const sha=b=>createHash('sha256').update(b).digest('hex');
const authoring=read(`${root}/candidate-report.json`),restored=new Set(authoring.restoredCards);
assert.equal(sha(fs.readFileSync(`${root}/candidate.glb`)),authoring.outputSha256);
const groups=[
 {name:'neutral-side',a:'captures/bob-side-envelope-v3/neutral',b:`${root}/neutral`,hash:authoring.controlSha256,count:5},
 {name:'neutral-lower',a:'captures/bob-lower-curve-v1/neutral',b:`${root}/neutral`,hash:authoring.inputSha256,count:5},
 {name:'studio-side',a:`${root}/studio-control`,b:`${root}/studio`,hash:authoring.controlSha256,count:3},
];
const rows=[];
for(const group of groups){
 const reports=[group.a,group.b].map(dir=>read(`${dir}/report.json`));
 for(let n=0;n<2;n++){
  const r=reports[n],dir=[group.a,group.b][n];assert.equal(r.status,'captured');assert.deepEqual(r.errors,[]);
  assert.equal(r.sourceHashes[r.candidate],n?authoring.outputSha256:group.hash);
  for(const[p,h]of Object.entries(r.sourceHashes)){
   assert.equal(sha(fs.readFileSync(p)),h,p);
   if(p.startsWith('tools/')||p.startsWith('packages/'))assert.equal(sha(fs.readFileSync(`${dir}/source/${p}`)),h,p);
  }
 }
 const [a,b]=reports,common=r=>Object.fromEntries(Object.entries(r.sourceHashes).filter(([p])=>p!==r.candidate));
 assert.deepEqual(common(a),common(b));assert.equal(b.cases.length,group.count);
 for(const c of b.cases){
  const base=a.cases.find(v=>v.view===c.view&&v.colour.id===c.colour.id);assert.ok(base);
  const strip=s=>Object.fromEntries(Object.entries(s).filter(([k])=>!['positions','velocities','vertices'].includes(k)));
  assert.deepEqual(strip(c.fixedState),strip(base.fixedState));
  for(const k of['clock','applied','lightingChanges','hidden','identity','size','backend','adapter','exactDefault'])assert.deepEqual(c[k],base[k],k);
  assert.equal(c.candidateLoads,1);assert.equal(base.candidateLoads,1);
  const geometry=[];
  for(const[dir,r,v]of[[group.a,a,base],[group.b,b,c]]){
   assert.equal(sha(fs.readFileSync(`${dir}/${v.filename}`)),v.imageSha256);
   const g=r.geometryFiles.find(x=>x.view===v.view);assert.ok(g);assert.equal(sha(fs.readFileSync(`${dir}/${g.filename}`)),g.sha256);
   geometry.push(read(`${dir}/${g.filename}`));
  }
  const[x,y]=geometry;
  for(const k of['headMatrix','indices','uv','uv1','chainCount','pointsPerChain','vertexBase','steps'])assert.deepEqual(x[k],y[k],k);
  const metrics={vertices:0,changedComponents:0,maximumDeltaMm:0,witness:null};
  if(group.name==='neutral-lower')for(let v=0;v<x.liveVertices.length/3;v++){
   const card=Math.floor(v/34);if(restored.has(card))continue;
   const d=[];
   for(let k=0;k<3;k++){const i=v*3+k;assert.equal(x.restVertices[i],y.restVertices[i]);d.push((y.liveVertices[i]-x.liveVertices[i])*1000);if(d[k]!==0)metrics.changedComponents++;}
   const delta=Math.hypot(...d);metrics.vertices++;if(delta>metrics.maximumDeltaMm){metrics.maximumDeltaMm=delta;metrics.witness={card,ring:Math.floor(v%34/2),side:v%2};}
  }
  if(group.name==='neutral-lower')assert.equal(metrics.vertices,(496-19)*34);
  rows.push({comparison:group.name,view:c.view,recordedControlsExact:true,commonSourceHashesExact:true,
   baselineImageSha256:base.imageSha256,candidateImageSha256:c.imageSha256,
   ...(group.name==='neutral-lower'?{unchangedAuthoredVerticesExact:true,unchangedLiveVertices:metrics}:{})});
 }
}
const source='tools/critic/audit-bob-lower-fallback-static.mjs';
const result={status:'complete',generated:new Date().toISOString(),candidateSha256:authoring.outputSha256,groups:groups.map(g=>({...g,reports:[g.a,g.b].map(d=>({file:`${d}/report.json`,sha256:sha(fs.readFileSync(`${d}/report.json`))}))})),rows,sourceSha256:sha(fs.readFileSync(source)),limits:['Recorded held-state controls and preserved source/geometry only; no moving, garment, alpha-visibility or style acceptance.','Original Studio is chromatic, not a hair-colour fidelity measurement.','Per-card readback excludes cap geometry.']};
fs.writeFileSync(`${root}/paired-static.json`,JSON.stringify(result,null,2)+'\n',{flag:'wx'});fs.copyFileSync(source,`${root}/audit-bob-lower-fallback-static.mjs`);
console.log(JSON.stringify({status:result.status,comparisons:rows.length,unchangedLive:rows.filter(r=>r.unchangedLiveVertices).map(r=>({view:r.view,...r.unchangedLiveVertices}))}));
