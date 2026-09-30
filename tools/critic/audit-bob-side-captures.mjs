// Compare each new side candidate with the frozen posterior control in matched held views.
import fs from 'node:fs';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';
const arg=(n,d)=>process.argv.find(a=>a.startsWith(`--${n}=`))?.slice(n.length+3)??d;
const root=arg('directory','captures/bob-side-envelope-v1');assert.ok(/^captures\/bob-side-envelope-v[123]$/.test(root));
const read=p=>JSON.parse(fs.readFileSync(p));const sha=v=>createHash('sha256').update(v).digest('hex');
const candidateReport=read(`${root}/candidate-report.json`);const selected=new Set(candidateReport.changedFromPosteriorCards??read('captures/bob-side-envelope-v1/candidate-report.json').selected),c=read(`${root}/neutral/report.json`);assert.equal(c.status,'captured');assert.deepEqual(c.errors,[]);
const rows=[];
for(const item of c.cases){
 const controlDir=item.view==='left-profile'?'captures/bob-side-envelope-v1/control-opposite':'captures/bob-posterior-envelope-v3/neutral';const b=read(`${controlDir}/report.json`);assert.equal(b.status,'captured');assert.deepEqual(b.errors,[]);const base=b.cases.find(v=>v.view===item.view&&v.colour.id===item.colour.id);assert.ok(base);
 const strip=s=>Object.fromEntries(Object.entries(s).filter(([k])=>!['positions','velocities','vertices'].includes(k)));
 assert.deepEqual(strip(item.fixedState),strip(base.fixedState));for(const k of ['clock','applied','lightingChanges','hidden','identity','size'])assert.deepEqual(item[k],base[k],k);
 for(const [dir,x]of[[`${root}/neutral`,item],[controlDir,base]])assert.equal(sha(fs.readFileSync(`${dir}/${x.filename}`)),x.imageSha256);
 const a=read(`${controlDir}/casual-${item.view}-geometry.json`),d=read(`${root}/neutral/casual-${item.view}-geometry.json`);assert.deepEqual(a.headMatrix,d.headMatrix);assert.deepEqual(a.indices,d.indices);assert.deepEqual(a.uv,d.uv);assert.deepEqual(a.uv1,d.uv1);
 let changedComponents=0,maxComponentMm=0,maxVertexMm=0,witness=null;
 for(let v=0;v<a.liveVertices.length/3;v++){if(selected.has(Math.floor(v/34)))continue;let sum=0;for(let k=0;k<3;k++){let i=v*3+k;assert.equal(a.restVertices[i],d.restVertices[i]);const delta=(d.liveVertices[i]-a.liveVertices[i])*1000;sum+=delta*delta;if(delta!==0)changedComponents++;maxComponentMm=Math.max(maxComponentMm,Math.abs(delta));}const distance=Math.sqrt(sum);if(distance>maxVertexMm){maxVertexMm=distance;witness={card:Math.floor(v/34),ring:Math.floor(v%34/2),side:v%2};}}
 rows.push({view:item.view,controlDir,recordedControlsExact:true,candidateLoads:item.candidateLoads,maximumNonselectedVertexDeltaMm:maxVertexMm,maximumNonselectedComponentDeltaMm:maxComponentMm,nonselectedChangedComponents:changedComponents,witness});
}
const result={status:'complete',candidate:c.candidate,candidateSha256:c.sourceHashes[c.candidate],rows,limits:['All authored nonselected card vertices are exact relative to frozen posteriorv3; live effects are measured separately.','Held controls only; no motion, garment or appearance acceptance.','Cap vertices are absent from the per-card live readback arrays.'],sourceSha256:sha(fs.readFileSync('tools/critic/audit-bob-side-captures.mjs'))};
fs.writeFileSync(`${root}/paired-captures.json`,JSON.stringify(result,null,2)+'\n',{flag:'wx'});fs.copyFileSync('tools/critic/audit-bob-side-captures.mjs',`${root}/audit-bob-side-captures.mjs`);console.log(JSON.stringify(result,null,2));
