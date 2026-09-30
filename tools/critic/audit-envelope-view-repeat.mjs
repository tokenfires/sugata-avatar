// Confirm that a new camera observes the same physical witness on each arm.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
const rear='captures/envelope-head-v1',front='captures/envelope-head-front-v1';
const output=`${front}/view-repeat.json`;assert.ok(!fs.existsSync(output));
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const arms=[];
for(const arm of ['baseline','candidate']){
  const dirs=[`${rear}/${arm}-rear-oblique-brown`,`${front}/${arm}-front-brown`];
  const reports=dirs.map(d=>JSON.parse(fs.readFileSync(`${d}/report.json`)));
  for(const report of reports){assert.equal(report.status,'captured');assert.equal(report.samples.length,556);}
  for(const key of ['seed','layers','originalLayers','protocol','keys','retainOtherVertices','configuration','canvas','lights','lightingChanges','material','backend','parameters','clock','descriptor'])assert.deepEqual(reports[0].setup[key],reports[1].setup[key],key);
  const rows=[];
  for(let frame=0;frame<=555;frame++){
    const raws=reports.map((r,i)=>{const s=r.samples[frame],bytes=fs.readFileSync(`${dirs[i]}/${s.geometryFile}`);assert.equal(sha(bytes),s.geometrySha256);return JSON.parse(gunzipSync(bytes));});
    const row={frame,exact:{},maximumAbsoluteComponentDifference:{}};
    for(const key of ['headMatrix','degrees','clock','steps','colliders','hashes'])row.exact[key]=JSON.stringify(raws[0][key])===JSON.stringify(raws[1][key]);
    for(const key of ['selectedVertices','selectedCentres','otherVertices','bodyPositions','bodyNormals']){
      const a=raws[0][key],b=raws[1][key];assert.equal(a.length,b.length);let maximum=0;
      for(let i=0;i<a.length;i++)maximum=Math.max(maximum,Math.abs(a[i]-b[i]));
      row.exact[key]=maximum===0;row.maximumAbsoluteComponentDifference[key]=maximum;
    }
    rows.push(row);
  }
  const keys=Object.keys(rows[0].exact);arms.push({arm,reportHashes:dirs.map(d=>sha(fs.readFileSync(`${d}/report.json`))),mismatchCounts:Object.fromEntries(keys.map(k=>[k,rows.filter(r=>!r.exact[k]).length])),rows});
}
const result={status:'complete',generated:new Date().toISOString(),pid:process.pid,arms,limits:['Camera and projection are intentionally not equality requirements between views; each camera is retained in its own report.','Absolute component differences use original units: metres for positions, dimensionless for normals.','Physical replay equality does not by itself establish a visible appearance defect or acceptance.'],sourceSha256:sha(fs.readFileSync('tools/critic/audit-envelope-view-repeat.mjs'))};
fs.writeFileSync(output,JSON.stringify(result,null,2)+'\n',{flag:'wx'});fs.copyFileSync('tools/critic/audit-envelope-view-repeat.mjs',`${front}/audit-envelope-view-repeat.mjs`);console.log(JSON.stringify(arms.map(({arm,mismatchCounts})=>({arm,mismatchCounts}))));
