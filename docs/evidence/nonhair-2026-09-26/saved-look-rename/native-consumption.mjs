// Read-only, exact-source admission for the existing default casual/ecru loading paths.
import assert from 'node:assert/strict';
export const CONSUMPTION_SOURCE_PINS=Object.freeze({
 'packages/core/src/wardrobe/WardrobeStyles.js':'b896ec3978130374a04760e576d61d1f049abc32a4cc9f592ad7f57fba75ee5a',
 'node_modules/three/src/loaders/FileLoader.js':'e3f730f2fdefdd4e9285883fb2eb7ca40e13d58ea96e969a669d3eaacd7d0c03',
 'node_modules/three/examples/jsm/loaders/GLTFLoader.js':'97642d720f16cc9a0c9844934198e4d0c023bea8e89576d0f7545d03b2d103d2'
});
export const CONSUMPTION_BUILD_PINS=Object.freeze({
 'assets/three.core-BmqiN6YQ.js':'5546cfea638409f2e8aa278e559a998b14ac0ba50e3368620f9f33f689f4093c',
 'assets/WardrobeStyles-CV2rj9hg.js':'8d070e4e682e07739048a84275383cbc86df3d80e9d7c779acd14300b08b8a37',
 'assets/GLTFLoader-CdTfRvUe.js':'e19d3d543ec63a1f1d4a33b1b74c0134dd9ea56e34559bf82a31dbc8cf804780'
});
const paths=[['assets/wardrobe/body/g050.glb','file-loader'],['assets/wardrobe/female_casualsuit01/g050.glb','styled-fragment'],['assets/wardrobe/shoes01/g050.glb','styled-fragment'],['assets/wardrobe/foundation_bra/g050.glb','file-loader'],['assets/wardrobe/foundation_briefs/g050.glb','file-loader'],['assets/hair/bob02/g050.glb','file-loader']];
export function classifyNativeConsumption(observed,{sources,built,assets,origin}){
 for(const[f,h]of Object.entries(CONSUMPTION_SOURCE_PINS))assert.equal(sources[f],h,'Native consumption source changed: '+f);
 for(const[f,h]of Object.entries(CONSUMPTION_BUILD_PINS))assert.equal(built[f],h,'Native consumption bundle changed: '+f);
 assert.deepEqual(assets.map(a=>a.asset),paths.map(([p])=>p),'Exact default six-GLB family required');
 assert.equal(observed.status,'restored');assert.deepEqual(observed.errors,[]);assert.equal(observed.restoration.length,5);assert.ok(observed.restoration.every(r=>r.restored===true));
 const calls=observed.calls,buffers=calls.filter(c=>c.kind==='response-arrayBuffer');assert.equal(buffers.length,6,'Exactly six observed GLB consumption calls');
 const core=origin+'/assets/three.core-BmqiN6YQ.js:1:',style=origin+'/assets/WardrobeStyles-CV2rj9hg.js:1:1626';
 const reads=calls.filter(c=>c.kind==='reader-read');assert.ok(reads.every(c=>c.stack.includes(core)),'Unexpected reader path');
 const groups=[...new Set(reads.map(c=>c.receiverID))].map(id=>{const rows=reads.filter(c=>c.receiverID===id);assert.ok(rows.every(c=>c.outcome==='returned'&&c.settlement==='fulfilled'),'Incomplete or failed native read');assert.equal(rows.filter(c=>c.done===true).length,1);assert.equal(rows.at(-1).done,true);assert.ok(rows.slice(0,-1).every(c=>c.done===false&&Number.isSafeInteger(c.byteLength)&&c.byteLength>0));assert.equal(rows.at(-1).byteLength,0);return{receiverID:id,calls:rows.length,bytes:rows.reduce((n,c)=>n+c.byteLength,0),firstReadAt:rows[0].at,doneAt:rows.at(-1).settledAt};});
 assert.equal(groups.length,4,'Four native FileLoader streams; styled fragments use direct Response.arrayBuffer');
 const nativeConsumption=paths.map(([asset,route],i)=>{const expected=assets[i];assert.equal(expected.sha256,sources[asset]);assert.ok(Number.isSafeInteger(expected.bytes)&&expected.bytes>0);
  const matches=buffers.filter(c=>c.sha256===expected.sha256);assert.equal(matches.length,1,'Unique exact native ArrayBuffer for '+asset);const call=matches[0];assert.equal(call.outcome,'returned');assert.equal(call.settlement,'fulfilled');assert.equal(call.byteLength,expected.bytes);assert.equal(call.prefixHex?.slice(0,16),'676c544602000000');assert.equal(call.argumentCount,0);assert.ok(call.settledAt>=call.at&&call.hashAt>=call.settledAt);
  assert.ok(call.stack.includes(route==='file-loader'?core+'194540':style),'Source-bound '+route+' callsite for '+asset);
  let reader=null;if(route==='file-loader'){const matches=groups.filter(g=>g.bytes===expected.bytes);assert.equal(matches.length,1,'Unique byte-total association for '+asset);reader=matches[0];assert.ok(reader.firstReadAt<=call.at&&reader.doneAt<=call.settledAt,'Observed read-done precedes buffer settlement');}
  return{asset,route,sha256:expected.sha256,bytes:expected.bytes,call,reader,readerAssociation:reader?'Unique exact byte-total and same-clock interval, not direct reader/Response identity instrumentation':null};
 });
 assert.deepEqual(groups.map(g=>g.bytes).sort((a,b)=>a-b),nativeConsumption.filter(c=>c.route==='file-loader').map(c=>c.bytes).sort((a,b)=>a-b));
 return{nativeConsumption,readerGroups:groups,explicitCancellationCalls:calls.filter(c=>['abort','stream-cancel','reader-cancel'].includes(c.kind)),scope:'Exact observed native arrayBuffer results; direct parser forwarding is source-derived, not a separate parse-argument hook. No inference about browser-internal cancellation or prior runs.'};
}
// Collect functional evidence despite recorded transport accounting failures only.
// This never admits transport or suppresses its raw failures.
const fatalErrors=errors=>errors.filter(e=>!(['requestfailed','cdp-loading-failed'].includes(e.type)||(e.type==='response'&&e.admissionStage==='original-body-read')));
export function assertNoFatalCaptureErrors(errors){assert.deepEqual(fatalErrors(errors),[],'Fatal runtime/source/observer error');}
export function resultAdmission({checks,expectedChecks=9,failure,cleanupFailure,bindingFailure,observerFailure,sourcesStable,errors,finalNetworkSettled,blobParentAdmission}){
 const functionalChecksCompleted=checks===expectedChecks&&!failure&&!cleanupFailure&&!bindingFailure&&!observerFailure&&sourcesStable===true&&fatalErrors(errors).length===0;
 const transportAdmitted=finalNetworkSettled===true&&blobParentAdmission===true&&errors.length===0;
 return{functionalChecksCompleted,transportAdmitted,completed:functionalChecksCompleted&&transportAdmitted};
}
