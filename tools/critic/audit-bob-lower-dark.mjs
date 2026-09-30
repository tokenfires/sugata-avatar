// Verify the three original-dark held comparisons. This is not a motion audit.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
const root='captures/bob-lower-curve-v1';
const read=p=>JSON.parse(fs.readFileSync(p));
const sha=b=>createHash('sha256').update(b).digest('hex');
const a=read(`${root}/dark-control/report.json`),b=read(`${root}/dark/report.json`),authoring=read(`${root}/candidate-report.json`);
for(const r of[a,b]){assert.equal(r.status,'captured');assert.deepEqual(r.errors,[]);}
assert.equal(a.sourceHashes[a.candidate],authoring.inputSha256);
assert.equal(b.sourceHashes[b.candidate],authoring.outputSha256);
const shared=r=>Object.fromEntries(Object.entries(r.sourceHashes).filter(([p])=>p!==r.candidate));
assert.deepEqual(shared(a),shared(b));
const rows=[];
for(const c of b.cases){
 const base=a.cases.find(v=>v.view===c.view&&v.colour.id===c.colour.id);assert.ok(base);
 const strip=s=>Object.fromEntries(Object.entries(s).filter(([k])=>!['positions','velocities','vertices'].includes(k)));
 assert.deepEqual(strip(c.fixedState),strip(base.fixedState));
 for(const k of['clock','applied','lightingChanges','hidden','identity','size','backend','adapter','exactDefault'])assert.deepEqual(c[k],base[k],k);
 assert.equal(c.candidateLoads,1);assert.equal(base.candidateLoads,1);
 for(const[dir,v]of[['dark-control',base],['dark',c]])assert.equal(sha(fs.readFileSync(`${root}/${dir}/${v.filename}`)),v.imageSha256);
 rows.push({view:c.view,recordedControlsExact:true,commonSourceHashesExact:true,baselineImageSha256:base.imageSha256,candidateImageSha256:c.imageSha256});
}
assert.equal(rows.length,3);
const source='tools/critic/audit-bob-lower-dark.mjs';
const result={status:'complete',baselineSha256:authoring.inputSha256,candidateSha256:authoring.outputSha256,rows,sourceSha256:sha(fs.readFileSync(source)),limits:['Recorded held controls only; no moving, garment, whole-groom or natural-colour-fidelity acceptance.','Original Studio chromatic lighting remains an appearance condition, not a neutral colour measurement.']};
fs.writeFileSync(`${root}/dark-controls.json`,JSON.stringify(result,null,2)+'\n',{flag:'wx'});fs.copyFileSync(source,`${root}/audit-bob-lower-dark.mjs`);console.log(JSON.stringify(result,null,2));
