// Replays the sealed compact data without either ZIP cache, current assets or Blender.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { gunzipSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { compactBody, fitMhclo, applyCompactDetails } from './cpu-refit.mjs';
const HERE=path.dirname(fileURLToPath(import.meta.url)),ROOT=path.resolve(HERE,'../../../..');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const reportBytes=fs.readFileSync(path.join(HERE,'proof-v1/report.json'));
const REPORT_SHA='4a3e861e3b744929c5f664c81787c59dd2b84de090bab468b45e3b08aae09277';
assert.equal(sha(reportBytes),REPORT_SHA);const report=JSON.parse(reportBytes);assert.equal(report.completed,true);
const kernelPath='docs/evidence/nonhair-2026-09-26/wardrobe-coupling/cpu-refit.mjs';
assert.equal(sha(fs.readFileSync(path.join(ROOT,kernelPath))),report.inputSources.find(s=>s.path===kernelPath).sha256);
const data=new Map();
for(const entry of report.artifacts) {
    const raw=fs.readFileSync(path.join(ROOT,entry.path));assert.equal(sha(raw),entry.sha256);
    const decoded=gunzipSync(raw);assert.equal(sha(decoded),entry.decodedSHA256);
    data.set(path.basename(entry.path),JSON.parse(decoded));
}
const packet=data.get('portable-inputs.json.gz'),baseline=data.get('baseline.json.gz');
assert.deepEqual(compactBody(baseline.positions,packet.indices).positions,Float64Array.from(packet.baseline));
const body={indices:packet.indices,positions:packet.baseline};
const checks=[];
for(const weight of [0,.25,1]) {
    const actual=applyCompactDetails(body,packet.detailTargets,[weight,weight]);
    const expected=data.get('case-'+String(weight).replace('.','_')+'.json.gz');
    assert.deepEqual(Array.from(actual.positions),expected.bodyDependencyPositions);
    const fitted=fitMhclo(packet.model,actual);
    assert.deepEqual(Array.from(fitted.positions),expected.garmentPositions);
    assert.deepEqual(fitted.scale,expected.scale);
    checks.push({weight,bodyComponentsExact:actual.positions.length,garmentComponentsExact:fitted.positions.length});
}
const actual=applyCompactDetails(body,packet.detailTargets,[1,1]);
const expected=fitMhclo(packet.model,actual).positions;
function deviation(values) {
    let maxMm=-1,worst=-1;
    for(let i=0;i<values.length/3;i++){
        const mm=Math.hypot(...[0,1,2].map(c=>values[3*i+c]-expected[3*i+c]))*1000;
        if(mm>maxMm){maxMm=mm;worst=i;}
    }
    assert.ok(maxMm>.1,'Hostile corruption did not exceed the declared future oracle threshold');
    return {maxMm,worst,reference:Array.from(expected.slice(worst*3,worst*3+3)),corrupted:Array.from(values.slice(worst*3,worst*3+3))};
}
const missingHelper=structuredClone(packet.detailTargets);
for(const t of missingHelper)t.records=t.records.filter(r=>r[0]<13380);
const wrongAxis=structuredClone(packet.model);for(const r of wrongAxis.rules)r.offsets[1]*=-1;
const wrongIndex=structuredClone(packet.model);wrongIndex.rules[0].indices[0]=wrongIndex.rules[0].indices[1];
const normalized=structuredClone(packet.model);for(const r of normalized.rules){const s=r.weights.reduce((a,b)=>a+b,0);r.weights=r.weights.map(w=>Math.max(0,w/s));}
const controls={
    omittedHelperTargetDeltas:deviation(fitMhclo(packet.model,applyCompactDetails(body,missingHelper,[1,1])).positions),
    reversedOffsetAxis:deviation(fitMhclo(wrongAxis,actual).positions),
    validButWrongHelperIndex:deviation(fitMhclo(wrongIndex,actual).positions),
    clampedAndNormalizedWeights:deviation(fitMhclo(normalized,actual).positions),
};
const output={protocol:'cached-portable-replay-v1',passed:true,proofReportSHA256:REPORT_SHA,
    kernelSHA256:sha(fs.readFileSync(path.join(ROOT,kernelPath))),verifierSHA256:sha(fs.readFileSync(fileURLToPath(import.meta.url))),
    checks,controls,limitations:['Exact matches are packet/full-CPU consistency, not a native MPFB oracle.',
        'Corruptions are detected against the source-bound CPU output, not independent native geometry.',
        'No proof of helper correctness, installed corrected garment mapping or fit quality.']};
if(process.argv[2]) {
    const destination=path.resolve(HERE,process.argv[2]);assert.ok(destination.startsWith(HERE+path.sep));
    fs.writeFileSync(destination,JSON.stringify(output,null,2)+'\n',{flag:'wx'});
}
console.log(JSON.stringify(output,null,2));
