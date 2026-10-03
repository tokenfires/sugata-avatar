/** Independent readback of actual closed run and exact restoration; no evaluator/browser replay. */
import fs from 'node:fs';import assert from 'node:assert/strict';import {execFileSync} from 'node:child_process';
import {ROOT,collectSourceHashes,hashFile} from '../../../../tools/figure-pipeline/collar_replacement_manifest.mjs';
const p=ROOT+'/docs/evidence/nonhair-2026-10-03/hair-draft-reset',raw=ROOT+'/captures/hair-draft-reset-2026-10-03-v1';
const started=new Date().toISOString(),r=JSON.parse(fs.readFileSync(raw+'/report.json')),s=JSON.parse(fs.readFileSync(p+'/supervisor-v1.json'));
const baseline=JSON.parse(fs.readFileSync(p+'/BASELINE.json')),edit=JSON.parse(fs.readFileSync(p+'/EDIT.json')),restore=JSON.parse(fs.readFileSync(p+'/RESTORE.json'));
assert.equal(r.pid,s.childPID);assert.equal(r.status,'failed');assert.equal(s.status,'failed');assert.equal(s.exitCode,1);assert.equal(s.forced,false);
assert.equal(r.cases.length,1);assert.equal(r.images.length,0);assert.equal(r.cases[0].states.length,2);
assert.match(r.errors[0].text,/no Reset navigation/);assert.match(r.errors[0].text,/3 !== 1/);
assert.equal(r.failedResources.length,48);assert.ok(r.failedResources.every(x=>x.failure.errorText==='net::ERR_ABORTED'));
assert.equal(r.warnings.length,4);assert.equal(r.finalPinsUnchanged,true);assert.equal(s.pinsUnchanged,true);
assert.deepEqual(s.finalLiveRecordedIdentities,[]);assert.deepEqual(s.finalObservedGroupMembers,[]);assert.deepEqual(s.survivors,[]);assert.deepEqual(s.observedGroupRemainders,[]);
assert.equal(r.retirements.length,1);assert.deepEqual(r.retirements[0].attempts.map(x=>[x.name,x.status]),[['attention','returned'],['controls','returned'],['avatar','returned']]);
assert.deepEqual(r.retirements[0].errors,[]);assert.equal(r.retirements[0].disposal.disposed,true);assert.deepEqual(r.retirements[0].disposal.leaked,[]);
assert.equal(r.cleanup['partial-final'],'page closed');assert.equal(r.cleanup.browserIsConnected,false);
const [before,dirty]=r.cases[0].states;for(const k of ['configuration','url','storage','attached','clock','paused'])assert.deepEqual(dirty[k],before[k]);
assert.equal(dirty.ownerSame,true);assert.equal(dirty.backend,'webgpu');assert.equal(dirty.webGPU,true);assert.equal(before.applyDisabled,true);assert.equal(before.resetDisabled,true);assert.equal(dirty.applyDisabled,false);assert.equal(dirty.resetDisabled,false);
const actual=collectSourceHashes(ROOT),prior=JSON.parse(fs.readFileSync(ROOT+'/captures/ink-denim-look-2026-10-03-v1/report.json'));
assert.deepEqual(actual,prior.sources);for(const[q,h]of Object.entries(r.sources)){
    const n=q.split('/').at(-1);assert.equal(hashFile(edit.files[q]?p+'/'+n+'.candidate':ROOT+'/'+q),h,q);
}
for(const[q,h]of Object.entries(baseline.pins))assert.equal(hashFile(ROOT+'/'+q),h);
for(const[q,h]of Object.entries(restore.files))assert.equal(actual[q],h);
for(const[n,h]of Object.entries(r.inputs))assert.equal(hashFile(p+'/'+n),h);
for(const[n,h]of Object.entries(s.inputs))assert.equal(hashFile(p+'/'+n),h);
assert.equal(hashFile(p+'/capture.mjs'),r.instrumentSHA256);for(const a of r.assets)assert.equal(hashFile(ROOT+'/'+a.file),a.sha256);
assert.deepEqual(fs.readdirSync(raw),['report.json']);
let live='';try{live=execFileSync('ps',['-p',Object.keys(s.owned).join(','),'-o','pid='],{encoding:'utf8'}).trim();}catch(e){assert.equal(e.status,1);assert.equal(String(e.stdout).trim(),'');}
assert.equal(live,'');const review=execFileSync('lsof',['-nP','-iTCP:5173','-sTCP:LISTEN'],{encoding:'utf8'});assert.match(review,/node\s+1023\s/);
const out={pid:process.pid,started,finished:new Date().toISOString(),command:'node '+p+'/root-postflight.mjs',status:'actual refusal/restoration independently verified',
    nativeReportSHA256:hashFile(raw+'/report.json'),supervisorSHA256:hashFile(p+'/supervisor-v1.json'),restoreSHA256:hashFile(p+'/RESTORE.json'),sourceCount:Object.keys(actual).length,assets:r.assets.length,
    initialStatePreservation:['configuration','url','storage','attached identity/colour','owner reference','paused clocks'],notExercised:['Reset','Brown','custom zero/nonzero','mobile','seven UI images'],
    recordedOwnedAbsent:Object.keys(s.owned).map(Number),reviewRetained:true,
    attributionLimit:'navCount not saved at baseline nor event URLs/times/document IDs; 48 aborts have no timestamp/document attribution. Exact event/abort cause unproved.'};
fs.writeFileSync(p+'/ROOT-POSTFLIGHT.json',JSON.stringify(out,null,2)+'\n');console.log(JSON.stringify({...out,recordedOwnedAbsent:out.recordedOwnedAbsent.length,sha256:hashFile(p+'/ROOT-POSTFLIGHT.json')}));
