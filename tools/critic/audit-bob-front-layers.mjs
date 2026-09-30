// Source-group colours only: compare against the physically identical hidden-fringe beauty views.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
const root='captures/bob-front-layers-v1',base='captures/bob-fringe-ablation-v1/hidden';
const read=p=>JSON.parse(fs.readFileSync(p)),sha=b=>createHash('sha256').update(b).digest('hex');
const a=read(`${base}/report.json`),b=read(`${root}/report.json`);
for(const r of[a,b]){assert.equal(r.status,'captured');assert.deepEqual(r.errors,[]);assert.equal(r.cases.length,3);}
assert.deepEqual(a.sourceHashes,b.sourceHashes);assert.equal(a.identityMode,'off');assert.equal(b.identityMode,'layers');
assert.equal(b.sourceHashes[b.candidate],'bbed05d0ce51eccc84fbfb1a9baca9f4e9a36ac2b3176869d2e7bfda27fa8ad9');
const rows=[];
for(const c of b.cases){
 const v=a.cases.find(x=>x.view===c.view&&x.colour.id===c.colour.id);assert.ok(v);
 assert.deepEqual(c.fixedState,v.fixedState);for(const k of['clock','applied','lightingChanges','hidden','size','backend','adapter','exactDefault'])assert.deepEqual(c[k],v[k],k);
 assert.equal(c.candidateLoads,1);assert.equal(v.candidateLoads,1);assert.equal(v.identity,null);
 assert.deepEqual(c.identity.layers.map(x=>[x.name,x.start,x.end,x.hex]),[['cap',-1,0,'808080'],['root',0,78,'ff3030'],['mass',78,178,'f0d020'],['underlayer',178,248,'30d060'],['body',248,296,'20d8e8'],['surface',296,344,'2858ff'],['flyaway',344,372,'ad40f0'],['veil',372,462,'ff9828'],['fringe',462,496,'f040b0']]);
 const gs=[];for(const[dir,r,item]of[[base,a,v],[root,b,c]]){
  assert.equal(sha(fs.readFileSync(`${dir}/${item.filename}`)),item.imageSha256);
  const g=r.geometryFiles.find(x=>x.view===item.view);assert.equal(sha(fs.readFileSync(`${dir}/${g.filename}`)),g.sha256);gs.push(read(`${dir}/${g.filename}`));
 }
 assert.deepEqual(gs[0],gs[1]);rows.push({view:c.view,allRecordedStateExact:true,allExportedGeometryExact:true,beautyImageSha256:v.imageSha256,identityImageSha256:c.imageSha256});
}
for(const[dir,r]of[[base,a],[root,b]])for(const[p,h]of Object.entries(r.sourceHashes))if(p.startsWith('tools/')||p.startsWith('packages/'))assert.equal(sha(fs.readFileSync(`${dir}/source/${p}`)),h);
const source='tools/critic/audit-bob-front-layers.mjs';
const result={status:'complete',generated:new Date().toISOString(),reports:[base,root].map(d=>({file:`${d}/report.json`,sha256:sha(fs.readFileSync(`${d}/report.json`))})),rows,sourceSha256:sha(fs.readFileSync(source)),limits:['Layer colours alter hair scattering/grade and are group attribution, not beauty or strand texture qualification.','Original alpha and visibility selection are retained; projection or a coloured pixel alone does not establish exact card ownership.','Names follow the calibrated496-card source ordering; no motion or modified-asset acceptance.']};
fs.writeFileSync(`${root}/paired-controls.json`,JSON.stringify(result,null,2)+'\n',{flag:'wx'});fs.copyFileSync(source,`${root}/audit-bob-front-layers.mjs`,fs.constants.COPYFILE_EXCL);console.log(JSON.stringify(result,null,2));
