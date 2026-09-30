// Check an index-only visibility intervention after the unchanged groom has attached.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
const root='captures/bob-fringe-ablation-v1',dirs=[`${root}/control`,`${root}/hidden`];
const read=p=>JSON.parse(fs.readFileSync(p)),sha=b=>createHash('sha256').update(b).digest('hex');
const asset='captures/bob-side-envelope-v3/candidate.glb',assetSha256='bbed05d0ce51eccc84fbfb1a9baca9f4e9a36ac2b3176869d2e7bfda27fa8ad9';
assert.equal(sha(fs.readFileSync(asset)),assetSha256);
const reports=dirs.map(d=>read(`${d}/report.json`)),[a,b]=reports;
for(const r of reports){assert.equal(r.status,'captured');assert.deepEqual(r.errors,[]);assert.equal(r.candidate,asset);assert.equal(r.sourceHashes[asset],assetSha256);assert.equal(r.cases.length,3);}
assert.deepEqual(a.sourceHashes,b.sourceHashes);assert.deepEqual(a.hideCards,[]);assert.deepEqual(b.hideCards,Array.from({length:34},(_,i)=>462+i));
const rows=[];
for(const c of b.cases){
 const base=a.cases.find(v=>v.view===c.view&&v.colour.id===c.colour.id);assert.ok(base);
 assert.deepEqual(c.fixedState,base.fixedState,'All recorded physical hashes, rendering and pose controls must match');
 for(const k of['clock','applied','lightingChanges','identity','size','backend','adapter','exactDefault'])assert.deepEqual(c[k],base[k],k);
 assert.equal(c.candidateLoads,1);assert.equal(base.candidateLoads,1);
 assert.deepEqual(base.hidden,{cards:[],caps:false,removedTriangles:0});
 assert.deepEqual(c.hidden,{cards:b.hideCards,caps:false,removedTriangles:1088});
 const geometry=[];
 for(const[dir,r,v]of[[dirs[0],a,base],[dirs[1],b,c]]){
  assert.equal(sha(fs.readFileSync(`${dir}/${v.filename}`)),v.imageSha256);
  const g=r.geometryFiles.find(x=>x.view===v.view);assert.ok(g);assert.equal(sha(fs.readFileSync(`${dir}/${g.filename}`)),g.sha256);geometry.push(read(`${dir}/${g.filename}`));
 }
 const [x,y]=geometry;assert.equal(x.chainCount,496);assert.equal(x.pointsPerChain,17);assert.equal(x.vertexBase,652);
 for(const k of Object.keys(x))if(k!=='indices')assert.deepEqual(x[k],y[k],k);
 const kept=[];let removed=0;
 for(let i=0;i<x.indices.length;i+=3){
  const tri=x.indices.slice(i,i+3),cards=tri.map(v=>Math.floor((v-652)/34));
  if(cards[0]>=462){assert.ok(cards.every(c=>c===cards[0]&&c<=495));removed++;}
  else kept.push(...tri);
 }
 assert.equal(removed,1088);assert.deepEqual(kept,y.indices);
 rows.push({view:c.view,allRecordedStateExact:true,allGeometryExceptIndicesExact:true,removedTriangles:removed,baselineImageSha256:base.imageSha256,hiddenImageSha256:c.imageSha256});
}
for(let i=0;i<2;i++)for(const[p,h]of Object.entries(reports[i].sourceHashes))if(p.startsWith('tools/')||p.startsWith('packages/'))assert.equal(sha(fs.readFileSync(`${dirs[i]}/source/${p}`)),h);
const source='tools/critic/audit-bob-fringe-ablation.mjs';
const result={status:'complete; index-only held visibility intervention',generated:new Date().toISOString(),asset,assetSha256,reports:dirs.map(d=>({path:`${d}/report.json`,sha256:sha(fs.readFileSync(`${d}/report.json`))})),rows,sourceSha256:sha(fs.readFileSync(source)),limits:['Ablation attributes visible contribution of the complete fringe group; it does not identify individual-card pixels.','Index removal changes occlusion and shadows too; missing coverage is an observed dependency, not a finished hairstyle.','This held-state proof does not qualify motion, a new GLB without fringe, or all-groom body clearance.']};
fs.writeFileSync(`${root}/paired-controls.json`,JSON.stringify(result,null,2)+'\n',{flag:'wx'});fs.copyFileSync(source,`${root}/audit-bob-fringe-ablation.mjs`,fs.constants.COPYFILE_EXCL);console.log(JSON.stringify(result,null,2));
