import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
const dir=new URL('./native-warmup-v2/',import.meta.url),read=p=>fs.readFileSync(new URL(p,dir)),sha=b=>createHash('sha256').update(b).digest('hex');
const receipt=JSON.parse(read('receipt.json')),decoded={};
for(const [name,item] of Object.entries(receipt.files)){
 const bytes=read(item.file);assert.equal(sha(bytes),item.sha256,name);
 if(item.decodedSHA256){const raw=gunzipSync(bytes);assert.equal(sha(raw),item.decodedSHA256,name);decoded[name]=JSON.parse(raw);}
}
const r=decoded['report.json'],m=decoded['manifest.json'],seal=decoded['seal.json'];
assert.equal(seal.reportSHA256,receipt.files['report.json'].decodedSHA256);assert.equal(seal.manifestSHA256,receipt.files['manifest.json'].decodedSHA256);
for(const [path,item] of Object.entries(decoded.sources)){assert.equal(sha(Buffer.from(item.text)),item.sha256);assert.equal(item.sha256,m.sources[path]);}
assert.equal(r.completed,true);assert.equal(r.diagnosticCompleted,true);assert.equal(r.measurementCompleted,false);assert.deepEqual(r.errors,[]);assert.equal(r.sourcesStable,true);
let expected=r.ready.orbit;
for(const [i,row] of r.warmupDiagnostic.records.entries()){assert.equal(row.step,i+1);assert.deepEqual(row.before,expected);assert.deepEqual(row.after,row.expected.state);assert.equal(row.exactOrbitReplay,true);expected=row.after;}
assert.equal(r.warmupDiagnostic.records.length,20);assert.equal(r.retirement.completed,true);assert.equal(r.warnings.length,6);assert.equal(r.endPNG.sha256,receipt.files['end.png'].sha256);
console.log(JSON.stringify({verified:true,receiptSHA256:sha(read('receipt.json')),recordedInBrowserPredictions:20,archivedSources:Object.keys(decoded.sources).length,scope:'Exact archived receipt verification; no offline cross-runtime replay and no timing claim.'}));
