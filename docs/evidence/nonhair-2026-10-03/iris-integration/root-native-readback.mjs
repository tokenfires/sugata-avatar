import fs from 'node:fs'; import assert from 'node:assert/strict';
import {ROOT,collectSourceHashes,hashFile} from '../../../../tools/figure-pipeline/collar_replacement_manifest.mjs';
const packet=ROOT+'/docs/evidence/nonhair-2026-10-03/iris-integration', raw=ROOT+'/captures/iris-integration-2026-10-03-v1';
const started=new Date().toISOString(), r=JSON.parse(fs.readFileSync(raw+'/report.json'));
assert.equal(r.status,'failed'); assert.equal(r.pid,29981); assert.equal(r.images.length,8); assert.equal(r.states.length,26);
assert.deepEqual(collectSourceHashes(ROOT),r.sources); for(const[p,h]of Object.entries(r.inputs)) assert.equal(hashFile(ROOT+'/'+p),h);
assert.equal(hashFile(raw+'/instrument.mjs'),r.instrumentSHA256);assert.equal(hashFile(ROOT+'/tools/critic/iris-integration.mjs'),r.instrumentSHA256);
const actualInputs=Object.keys(r.sources).length+Object.keys(r.inputs).length+1;
for(const i of r.images) {assert.equal(hashFile(raw+'/'+i.file),i.sha256);const b=r.states[i.before],a=r.states[i.after];assert.deepEqual(a.configuration,b.configuration);assert.deepEqual(a.eyes,b.eyes);assert.deepEqual(a.camera,b.camera);}
for(const s of r.states) {
 for(const k of ['eyeOwnerSame','mapSame','corneaSame','occlusionSame','pupilOwnerSame','gazeOwnerSame','uniformsSame'])assert.equal(s[k],true);
 assert.equal(s.mapDisposals,0);assert.equal(s.eyes.ownerAvailable,true);assert.equal(s.eyes.matchesAttached,true);assert.equal(s.eyes.matchesRequest,true);assert.equal(s.eyes.attached,true);
 assert.equal(s.configuration.eyeColour??null,s.eyes.applied);assert.equal(s.pupilScale,s.uniforms.pupilScaleUniform);
}
const byLabel=Object.fromEntries(r.states.map(s=>[s.label,s]));const original=byLabel['original-initial'].configuration,blue=byLabel['blue-applied'].configuration;
assert.deepEqual(original,r.requestedConfiguration);assert.deepEqual(blue,{...original,eyeColour:'blue'});assert.deepEqual(byLabel['blue-draft'].configuration,original);assert.deepEqual(byLabel['original-restored'].configuration,original);
for(const label of ['JSON-reopened-blue','local-reopened-blue','attention-held','attention-released'])assert.deepEqual(byLabel[label].configuration,blue);
assert.deepEqual(JSON.parse(fs.readFileSync(raw+'/blue-settings.json')),blue);assert.equal(hashFile(raw+'/blue-settings.json'),r.downloadSHA256);assert.deepEqual(r.local.looks[0].configuration,blue);
assert.equal(byLabel['attention-held'].attention.phase,'attending');assert.equal(byLabel['manual-release-start'].attention.phase,'releasing');assert.equal(byLabel['attention-released'].attention.phase,'idle');
assert.notDeepEqual(byLabel['attention-held'].frames,byLabel['attention-before'].frames);assert.notDeepEqual(byLabel['attention-held'].gazeMorphs,byLabel['attention-before'].gazeMorphs);
assert.deepEqual(r.retirements.map(x=>x.requested),[null,'blue',null,'blue',null,'blue']);
for(const x of r.retirements) {assert.deepEqual(x.eye,{borrowedMapDisposals:0,restoredGlobe:true,restoredCornea:true});assert.deepEqual(x.events.map(({name,uuid})=>({name,uuid})),Object.entries(x.resources).map(([name,uuid])=>({name,uuid})));assert.deepEqual(x.disposal,{disposed:true,leaked:[]});}
assert.deepEqual(r.cleanup,{page:'closed',browser:'closed'});assert.equal(r.errors.length,2);assert.equal(r.failedResources.length,31);assert.ok(r.failedResources.every(f=>f.failure?.errorText==='net::ERR_ABORTED'&&!('status'in f)));
assert.ok(r.errors[0].includes('iris-integration.mjs:154:48'));assert.ok(r.errors[1].includes(r.errors[0].split('\n')[0]));assert.equal(r.finalPinsUnchanged,undefined);
const out={pid:process.pid,started,finished:new Date().toISOString(),command:'node docs/evidence/nonhair-2026-10-03/iris-integration/root-native-readback.mjs',readerSHA256:hashFile(new URL(import.meta.url)),reportSHA256:hashFile(raw+'/report.json'),instrumentSHA256:r.instrumentSHA256,images:r.images,sourceInputPinsVerified:actualInputs,states:26,retirements:6,resourceEvents:18,pupilScales:r.sequence.pupilScales,status:'REFUSE adoption after sole failed native resource guard; observed successful feature/state/lifecycle evidence retained separately',firstFailure:'31 aborted module requests at global failedResources guard; timing/active-document context absent, benign unload/HMR or causal source failure not proven',secondError:'Final errors-empty guard repeats first refusal; no independent extra capture/resource failure',limits:['FinalPinsUnchanged absent because errors guard stops assignment; independent readback rehashed every recorded source/input/instrument before rollback.','No additional native launch, observer/resource filter fix or pigment/hue/lighting/phase change.','This reader inspects bytes/state only; actual images require separate root view receipt.']};
fs.writeFileSync(packet+'/ROOT-NATIVE-READBACK.json',JSON.stringify(out,null,2)+'\n');console.log(JSON.stringify({pid:process.pid,pins:actualInputs,images:8,states:26,retirements:6,requests:31,status:'REFUSED adoption'}));
