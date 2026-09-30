// Matched report and raw geometry comparison. Different hair response is measured, not assumed absent.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { gunzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
const arg = key => process.argv.find(x => x.startsWith(`--${key}=`))?.slice(key.length + 3);
const dirs = [arg('baseline'), arg('candidate')], output = arg('output');
assert.ok([...dirs, output].every(x => x?.startsWith('captures/'))); assert.ok(!fs.existsSync(output));
const reports = dirs.map(dir => JSON.parse(fs.readFileSync(`${dir}/report.json`)));
for (const r of reports) { assert.equal(r.status, 'captured'); assert.deepEqual(r.errors, []); }
const [a,b] = reports, sha = bytes => createHash('sha256').update(bytes).digest('hex');
const same = (x,y) => JSON.stringify(x) === JSON.stringify(y);
assert.equal(a.samples.length,b.samples.length); assert.equal(a.geometryStride,1); assert.equal(b.geometryStride,1);
const setupEquality = Object.fromEntries(Object.keys(a.setup).filter(k => k !== 'descriptor').map(k => [k,same(a.setup[k],b.setup[k])]));
const descriptorEquality = Object.fromEntries(['selectedCards','selectedIndices','bodyIndices','otherCards'].map(k => [k,same(a.setup.descriptor[k],b.setup.descriptor[k])]));
assert.ok(Object.values(descriptorEquality).every(Boolean));
for (let arm=0;arm<2;arm++) for (const image of reports[arm].images) assert.equal(sha(fs.readFileSync(`${dirs[arm]}/${image.file}`)),image.sha256);
const rows=[], maxOther={millimetres:0,witness:null}, radiusDeltas=[], centreDeltas=[];
let retainedOtherFrames=0;
for (let i=0;i<a.samples.length;i++) {
  const raws=reports.map((r,arm)=>{const s=r.samples[i],bytes=fs.readFileSync(`${dirs[arm]}/${s.geometryFile}`);assert.equal(sha(bytes),s.geometrySha256);const raw=JSON.parse(gunzipSync(bytes));assert.deepEqual(raw.hashes,s.hashes);assert.equal(raw.frame,i);return raw;});
  const [x,y]=raws;
  const row={frame:i,timeEqual:x.time===y.time,clockEqual:same(x.clock,y.clock),headEqual:same(x.headMatrix,y.headMatrix),degreesEqual:same(x.degrees,y.degrees),stepsEqual:x.steps===y.steps,bodyEqual:same(x.bodyPositions,y.bodyPositions),bodyNormalsEqual:same(x.bodyNormals,y.bodyNormals),rigEqual:x.hashes.rig===y.hashes.rig,otherVerticesHashEqual:x.hashes.otherVertices===y.hashes.otherVertices,capsulesEqual:['capsuleA','capsuleB','capsuleRadius'].every(k=>same(x.colliders[k],y.colliders[k]))};
  radiusDeltas.push((y.colliders.skull[3]-x.colliders.skull[3])*1000);
  centreDeltas.push(Math.hypot(...x.colliders.skull.slice(0,3).map((v,k)=>v-y.colliders.skull[k]))*1000);
  if(x.otherVertices&&y.otherVertices) {
    const other=a.setup.descriptor.otherCards;assert.ok(other);assert.equal(x.otherVertices.length,other.length*102);assert.equal(x.otherVertices.length,y.otherVertices.length);
    assert.equal(sha(new Float32Array(x.otherVertices)),x.hashes.otherVertices);assert.equal(sha(new Float32Array(y.otherVertices)),y.hashes.otherVertices);
    let maximum=0,witness=null;retainedOtherFrames++;
    for(let v=0;v<x.otherVertices.length;v+=3){const delta=Math.hypot(...[0,1,2].map(k=>x.otherVertices[v+k]-y.otherVertices[v+k]))*1000;if(delta>maximum){maximum=delta;witness={frame:i,card:other[Math.floor(v/102)],ring:Math.floor(v%102/6),side:Math.floor(v%6/3)};}}
    row.maximumOtherVertexDeltaMm=maximum;row.otherWitness=witness;
    if(maximum>maxOther.millimetres){maxOther.millimetres=maximum;maxOther.witness=witness;}
  }
  rows.push(row);
}
const equalityKeys=Object.keys(rows[0]).filter(k=>k.endsWith('Equal'));
const result={status:'complete',generated:new Date().toISOString(),pid:process.pid,reports:dirs.map((dir,i)=>({file:`${dir}/report.json`,sha256:sha(fs.readFileSync(`${dir}/report.json`)),arm:reports[i].arm})),candidateSha256:b.candidateSha256,sourceHashesEqual:same(a.sourceHashes,b.sourceHashes),setupEquality,descriptorEquality,frameCount:rows.length,mismatchCounts:Object.fromEntries(equalityKeys.map(k=>[k,rows.filter(r=>!r[k]).length])),colliderDifference:{minimumSkullRadiusDeltaMm:Math.min(...radiusDeltas),maximumSkullRadiusDeltaMm:Math.max(...radiusDeltas),maximumSkullCentreDeltaMm:Math.max(...centreDeltas)},otherVertices:{retainedFrames:retainedOtherFrames,...(retainedOtherFrames?{maximumDelta:maxOther}:{magnitude:'unquantified; coordinates not retained'})},rows,
  limits:['A difference in other-card geometry is a measured runtime consequence, not automatically a visible defect.','Body and normal equality establishes this matched pose comparison, not general motion coverage.','Image hashes establish preservation; actual visual inspection is still required.'],sourceSha256:sha(fs.readFileSync('tools/critic/audit-envelope-pair.mjs'))};
fs.writeFileSync(output,JSON.stringify(result,null,2)+'\n',{flag:'wx'});fs.copyFileSync('tools/critic/audit-envelope-pair.mjs',path.join(path.dirname(output),'audit-envelope-pair.mjs'));
console.log(JSON.stringify({frameCount:result.frameCount,setupEquality,mismatchCounts:result.mismatchCounts,colliderDifference:result.colliderDifference,otherVertices:result.otherVertices}));
