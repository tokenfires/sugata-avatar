// One frozen native candidate capture. Completion means evidence collected, never fit or appearance acceptance.
import fs from 'node:fs'; import path from 'node:path'; import assert from 'node:assert/strict';
import { gzipSync, gunzipSync } from 'node:zlib';
import { ROOT, CAPTURE_ASSETS, hashFile, sha256, validate } from '../hand-clearance/hand-attribution-manifest.mjs';
import {readGlb} from '../../../../tools/lut-bake/glb.mjs';
import {compareCandidateMorphs,DEPENDENT_MORPHS} from './candidate-morph-policy.mjs';
import {compareCandidateOwnerStatus,GESTURE_STATUS_SOURCE_HASHES} from './candidate-gesture-status.mjs';
import { compareRetained, POLICY } from '../hand-clearance/retained-json-comparison.mjs';
const HERE='docs/evidence/nonhair-2026-09-26/hand-candidate';
const BASE='docs/evidence/nonhair-2026-09-26/hand-clearance/hand-attribution-manifest-v4.json';
const REF='captures/hand-attribution-2026-09-26/primary-v4';
const OWN=['AcceptedPoseControl.mjs','AcceptedPoseControl.selftest.mjs','accepted-control-runtime.mjs','accepted-control-capture.mjs',
 'candidate-gesture-status.mjs','candidate-gesture-status.selftest.mjs','candidate-morph-policy.mjs','candidate-morph-policy.selftest.mjs','candidate-runtime.mjs','candidate-capture.mjs','pose-proposal/CandidatePoseControl.mjs','pose-proposal/CandidatePoseControl.selftest.mjs',
 'pose-proposal/authoring-v1.json','pose-proposal/author-family.mjs','pose-proposal/inspect-family.mjs','pose-proposal/family.diff',
 'feasibility/proposal-receipt-v1.json','feasibility/rig-world-v1.json','feasibility/placement-v1.json','feasibility/placement-boundary-v1.json',
 'feasibility/recorded-skinning.mjs','feasibility/verify-rig-world.mjs','feasibility/measure-placement.mjs','feasibility/measure-placement-boundary.mjs','feasibility/summarize-feasibility.mjs',
 ...['relaxed-standing','weight-left','weight-right'].map(n=>'pose-proposal/family/'+n+'.json')].map(f=>HERE+'/'+f);
const {CANDIDATE_POSE_HASHES,CANDIDATE_BUDGET}=await import('./pose-proposal/CandidatePoseControl.mjs');
const CONTROL=HERE+'/native-control-v1/receipt.json';const control=JSON.parse(fs.readFileSync(path.join(ROOT,CONTROL)));
assert.equal(control.reportSHA256,'25d1aa1e845090fac55b4e74465b583b77d128cd6674993d3a38a5aae45551b6');
assert.equal(control.manifestSHA256,'1eeda6f9cb06b300289a62ef658f1b87026b63fc7cfe965044df43d82807eefa');
assert.equal(control.geometrySamples,109);assert.equal(control.ownerStateSamples,721);assert.equal(control.retirementCompleted,true);
const controlGzip=fs.readFileSync(path.join(ROOT,HERE,'native-control-v1/report.json.gz'));assert.equal(sha256(controlGzip),control.gzipSHA256);
const controlRaw=gunzipSync(controlGzip);assert.equal(sha256(controlRaw),control.reportSHA256);const controlReport=JSON.parse(controlRaw);
assert.equal(controlReport.completed,true);assert.equal(controlReport.geometry.length,109);assert.equal(controlReport.states.count,721);
for(const [file,h] of Object.entries(controlReport.sourceHashes))assert.equal(hashFile(path.join(ROOT,file)),h,'Preserve qualified control source '+file);

for(const [name,h] of Object.entries(CANDIDATE_POSE_HASHES))assert.equal(hashFile(path.join(ROOT,HERE,'pose-proposal/family',name+'.json')),h);
const rawBase=fs.readFileSync(path.join(ROOT,BASE));assert.equal(sha256(rawBase),'fc0e017fba7da12f6c511b53e705b2441b440fa8cb8731bd65f36a839514793d');
const base=validate(JSON.parse(rawBase)), refBytes=fs.readFileSync(path.join(ROOT,REF,'report.json')), ref=JSON.parse(refBytes), refSeal=JSON.parse(fs.readFileSync(path.join(ROOT,REF,'seal.json')));
assert.equal(sha256(refBytes),'bb12301ca0fd0db5097ad8fe6221498228612c2fcd314dac4377ca686d22a74e');assert.equal(refSeal.reportSHA256,sha256(refBytes));assert.equal(refSeal.manifestSHA256,sha256(rawBase));assert.equal(ref.completed,true);
const reference=ref.runs.find(r=>r.arm==='A');assert.equal(reference.completed,true);assert.deepEqual(reference.geometry.map(e=>e.step),base.planned.numericalSteps);assert.equal(reference.states.count,721);
function buildManifest(){return {version:1,kind:'frozen-rest-budget-candidate',promotion:false,baseManifestSHA256:sha256(rawBase),baseManifest:base,
 candidateControlProof:{file:CONTROL,sha256:hashFile(path.join(ROOT,CONTROL)),reportSHA256:control.reportSHA256},
 candidate:{poseHashes:CANDIDATE_POSE_HASHES,budget:CANDIDATE_BUDGET},
 gestureStatusPolicy:{sourceHashes:GESTURE_STATUS_SOURCE_HASHES,exception:'Only a native Gesture return-status difference exactly reproduced by the pinned native negligible-angle equation for both sides; all other owner statuses remain exact.'},
 morphDependencyPolicy:{owners:DEPENDENT_MORPHS,allOtherOwnerAndFinalMorphs:'exact under retained JSON convention; no numerical tolerance',basis:'Native Sway whole-body mass response changes committed head motion; Gaze VOR and FacialIdle lid/up-brow follow read that motion.'},
 reference:{directory:REF,reportSHA256:sha256(refBytes),sealSHA256:hashFile(path.join(ROOT,REF,'seal.json'))},
 sourceHashes:{...base.sourceHashes,...Object.fromEntries(OWN.map(f=>[f,hashFile(path.join(ROOT,f))]))},
 intervention:'One exact source-bound authored pose family through native RestPose.load and common reduced native inward budget; original Showcase initialization and native owners. No output filtering.'};}
if(process.argv[2]==='--write-manifest'){assert.equal(process.argv.length,4);fs.writeFileSync(process.argv[3],JSON.stringify(buildManifest(),null,2)+'\n',{flag:'wx'});console.log('Wrote frozen candidate manifest');process.exit(0);}
const [manifestPath,output,mode]=process.argv.slice(2);assert.equal(process.argv.length,5);assert.ok(['--preflight','--run'].includes(mode));
const manifestBytes=fs.readFileSync(manifestPath), manifest=JSON.parse(manifestBytes);assert.deepEqual(manifest,buildManifest());
const out=path.resolve(output);assert.equal(fs.existsSync(out),false);const manifestHash=sha256(manifestBytes);
const readBound=(entry)=>{const bytes=fs.readFileSync(path.join(ROOT,REF,entry.file));assert.equal(sha256(bytes),entry.sha256);const raw=gunzipSync(bytes);assert.equal(sha256(raw),entry.decodedSHA256);return JSON.parse(raw);};
const morphNames=readGlb(path.join(ROOT,'assets/wardrobe/body/g050.glb')).json.meshes.find(m=>m.name==='base.001').extras.targetNames;
const priorStates=readBound(reference.states);assert.equal(priorStates.length,721);reference.geometry.forEach(readBound);
fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'manifest.json'),manifestBytes,{flag:'wx'});
const report={version:1,kind:manifest.kind,completed:false,manifestSHA256:manifestHash,reference:manifest.reference,sourceHashes:manifest.sourceHashes,
 comparisonPolicy:POLICY,createdAt:new Date().toISOString(),sourceFreeze:[],loadedAssets:[],routeFulfillments:[],errors:[],commands:[],geometry:[],comparisons:[],morphDifferences:[],gestureStatusDifferences:[],states:null,
 scope:'One disposable authored candidate evidence trace only. Geometry, owner and physical differences require separate audit; completion is not clearance, appearance or lifecycle-reuse qualification.'};
const save=()=>fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');
const record=(file,value)=>{const raw=JSON.stringify(value),bytes=gzipSync(raw);fs.writeFileSync(path.join(out,file),bytes,{flag:'wx'});return {file,sha256:sha256(bytes),decodedSHA256:sha256(raw)};};
if(mode==='--preflight'){report.completed=true;report.preflightOnly=true;save();console.log(JSON.stringify({preflight:true,sources:Object.keys(manifest.sourceHashes).length,geometry:reference.geometry.length,states:priorStates.length}));process.exit(0);}
assert.ok(Number(fs.statfsSync(out).bavail)*Number(fs.statfsSync(out).bsize)>4*1024**3);
for(const [file,h] of Object.entries(manifest.sourceHashes)){const dest=path.join(out,'source',file);fs.mkdirSync(path.dirname(dest),{recursive:true});fs.copyFileSync(path.join(ROOT,file),dest,fs.constants.COPYFILE_EXCL);assert.equal(hashFile(dest),h);report.sourceFreeze.push({file:'source/'+file,sha256:h});}
save();
const {createServer}=await import('vite');const {launchProbeBrowser}=await import('../../../../packages/core/src/render/MotionProbe.mjs');
const server=await createServer({configFile:path.join(ROOT,'vite.config.js'),server:{host:'127.0.0.1',port:5371,strictPort:true,hmr:false,watch:{ignored:['**']},fs:{allow:[ROOT]}},logLevel:'error'});
let browser,context,page;const states=[];const reads=[];let lastObservation=null,attemptedLoopStep=null;
const assetPath=url=>{const u=new URL(url);if(u.searchParams.has('import'))return null;const s=decodeURIComponent(u.pathname),i=s.indexOf('/assets/');return i>=0&&/\.(?:glb|png|jpg|hdr|bin)$/.test(s)?s.slice(i+1):null;};
try{
 await server.listen();browser=await launchProbeBrowser();context=await browser.newContext({viewport:base.camera.viewport,deviceScaleFactor:1,reducedMotion:'no-preference'});page=await context.newPage();
 page.on('pageerror',e=>report.errors.push({kind:'pageerror',message:String(e)}));page.on('console',m=>{if(m.type()==='error')report.errors.push({kind:'console',message:m.text()});});page.on('requestfailed',q=>report.errors.push({kind:'requestfailed',url:q.url(),message:q.failure()?.errorText}));
 page.on('response',r=>{if(r.status()>=400)report.errors.push({kind:'http',status:r.status(),url:r.url()});const file=assetPath(r.url());if(file&&r.ok())reads.push(r.body().then(bytes=>{assert.equal(sha256(bytes),manifest.sourceHashes[file]);report.loadedAssets.push({file,sha256:sha256(bytes),bytes:bytes.length});}));});
 await page.route(/\/assets\/.*\.(?:glb|png|jpg|hdr|bin)(?:\?.*)?$/,async route=>{const file=assetPath(route.request().url());if(!file)return route.continue();assert.ok(manifest.sourceHashes[file]);const bytes=fs.readFileSync(path.join(out,'source',file));assert.equal(sha256(bytes),manifest.sourceHashes[file]);report.routeFulfillments.push({file,sha256:sha256(bytes)});await route.fulfill({status:200,contentType:file.endsWith('.glb')?'model/gltf-binary':file.endsWith('.png')?'image/png':file.endsWith('.jpg')?'image/jpeg':'application/octet-stream',body:bytes});});
 const originalHTML=fs.readFileSync(path.join(out,'source/packages/testbed/src/showcase.html'),'utf8');const tag='<script type="module" src="./showcase.js"></script>';assert.equal(originalHTML.split(tag).length,2);
 const deferredHTML=originalHTML.replace(tag,'<!-- Frozen-candidate bootstrap defers the original module only. -->');
 report.bootstrap={originalHTMLSHA256:sha256(originalHTML),deferredHTMLSHA256:sha256(deferredHTML),change:'Remove exactly one original module tag; controller imports original showcase.js after installing construction interposer.'};
 fs.writeFileSync(path.join(out,'deferred-showcase.html'),deferredHTML,{flag:'wx'});
 await page.route('**/src/showcase.html?*',r=>r.fulfill({status:200,contentType:'text/html',body:deferredHTML}));
 await page.goto('http://127.0.0.1:5371/src/showcase.html?preset=casual&outfit=casual&style=ecru&frame=portrait&capture=');
 const poseFiles=Object.fromEntries(['relaxed-standing','weight-left','weight-right'].map(n=>[n,fs.readFileSync(path.join(out,'source',HERE,'pose-proposal/family',n+'.json'),'utf8')]));
 await page.evaluate(async({root,poseFiles,sourceHashes,manifest})=>{window.candidateRuntime=await import('/@fs'+root+'/docs/evidence/nonhair-2026-09-26/hand-candidate/candidate-runtime.mjs');return candidateRuntime.begin({poseFiles,sourceHashes,manifest});},{root:ROOT,poseFiles,sourceHashes:manifest.sourceHashes,manifest:base});
 await page.waitForFunction(()=>window.candidateControlReady||window.candidateControlError,null,{timeout:120000});
 report.setup=await page.evaluate(()=>({ready:window.candidateControlReady??null,error:window.candidateControlError??null}));assert.equal(report.setup.error,null);assert.deepEqual(report.setup.ready.configuration,reference.setup.preFilter.configuration);assert.deepEqual(report.setup.ready.morphNames,morphNames);assert.deepEqual(report.setup.ready.nativeGesture,{amplitude:1,yieldToPosture:true,sagittalShare:.75,dominanceDrivesAmplitude:true});await Promise.all(reads);
 for(const file of CAPTURE_ASSETS)assert.equal(report.loadedAssets.filter(x=>x.file===file).length,1,'one actual response: '+file);
 const retained=(a,b,label)=>compareRetained(a,b,{label,audit:report.comparisons});
 for(let step=0;step<=720;step++){
  attemptedLoopStep=step;
  if(step)await page.evaluate(()=>candidateRuntime.native.step());
  const command=base.phases.find(p=>p.step===step);if(command){const actual=await page.evaluate(({phase,speechPlan})=>candidateRuntime.native.command(phase,speechPlan),{phase:command,speechPlan:base.speechPlan});retained(actual,reference.commands.find(c=>c.step===step).actual,'Native command '+step);report.commands.push({step,actual});}
  const state=await page.evaluate(()=>candidateRuntime.native.semantic()), old=priorStates[step];
  lastObservation={step,...state};states.push(lastObservation);
  const statusComparison=compareCandidateOwnerStatus(state,old,{step,sourceHashes:manifest.sourceHashes});
  if(statusComparison.changed)report.gestureStatusDifferences.push(statusComparison);
  const morphChanges=compareCandidateMorphs(state,old,morphNames,{step,audit:report.comparisons});
  if(morphChanges.owners.length||morphChanges.final.length)report.morphDifferences.push(morphChanges);
  for(const key of ['clock','stackTime','stackFrame','schedule'])retained(state[key],old[key],'Unchanged '+key+' '+step);
  assert.equal(state.instrument.arm,'A');assert.equal(state.instrument.status,'active');assert.equal(state.instrument.failure,null);
  // The status comparator above has already checked exact owner metadata and all non-Gesture statuses.
  for(const owner of state.instrument.owners)if(owner.status==='returned-output')retained(owner.raw,owner.effective,'No filtered output '+owner.name+' '+step);
  for(let i=0;i<state.instrument.owners.length;i++)retained(state.instrument.owners[i].randomAfterFrame,old.instrument.owners[i].randomAfterFrame,'Owner PRNG '+state.instrument.owners[i].name+' '+step);
  assert.equal(state.bones.length,old.bones.length);assert.ok(state.bones.every(Number.isFinite));
  const rendering=await page.evaluate(()=>candidateRuntime.native.renderState());assert.equal(rendering.rendererFrame,1000257+step);
  const prior=reference.geometry.find(e=>e.step===step);if(prior){
   const geometry=await page.evaluate(()=>candidateRuntime.native.snapshot()),expected=readBound(prior);
   retained(Object.keys(geometry.rig),Object.keys(expected.rig),'Rig identities '+step);
   assert.ok(Object.values(geometry.rig).every(m=>m.length===16&&m.every(Number.isFinite)));
   retained(geometry.time,expected.time,'Geometry clock '+step);retained(geometry.meshes.map(m=>m.id),expected.meshes.map(m=>m.id),'Five mesh IDs '+step);
   for(let i=0;i<geometry.meshes.length;i++){const m=geometry.meshes[i],p=expected.meshes[i];
    assert.equal(m.positions.length,p.positions.length);assert.ok(m.positions.every(Number.isFinite));
    retained(m.fullIndices,p.fullIndices,'Unchanged full topology '+m.id+' '+step);retained(m.drawnIndices,p.drawnIndices,'Unchanged mask '+m.id+' '+step);
   }
   const physical=await page.evaluate(()=>candidateRuntime.native.physical());
   for(const key of ['camera','projection','view','clock','steps'])retained(physical[key],prior.physical[key],'Fixed primary physical '+key+' '+step);
   geometry.capture={candidate:'D',step,manifestSHA256:manifestHash,kind:manifest.kind};
   report.geometry.push({step,time:geometry.time,...record('meshes-'+step+'.json.gz',geometry),referenceSHA256:prior.decodedSHA256,physical});
  }
  if(step%60===0){save();console.log('Frozen candidate step'+step+'/720');}
 }
 report.states={...record('states.json.gz',states),count:states.length};assert.equal(states.length,721);assert.equal(report.geometry.length,109);await Promise.all(reads);assert.deepEqual(report.errors,[]);
}catch(error){
 report.failure=error.stack;process.exitCode=1;
 if(lastObservation){
  report.failureState={step:lastObservation.step,...record('failure-state.json.gz',lastObservation)};
  report.states={...record('partial-states.json.gz',states),count:states.length,partial:true};
  try{report.failurePhysical={attemptedLoopStep,lastRetainedSemanticStep:lastObservation.step,semanticCorrespondence:attemptedLoopStep===lastObservation.step?'same loop iteration, no subsequent simulation step':'unverified after a later step or command failure',rendering:await page.evaluate(()=>candidateRuntime.native.renderState()),physical:await page.evaluate(()=>candidateRuntime.native.physical()),note:'Read at failure without an added simulation step or draw; not a planned accepted sample.'};}catch(observeError){report.failureObservationError=String(observeError);}
 }
}
finally{
 if(page){let timer;try{report.finish=await Promise.race([page.evaluate(()=>window.candidateRuntime?candidateRuntime.finish():null),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('Native cleanup timed out after30s')),30000);})]);assert.ok(report.finish?.result);assert.equal(report.finish.error,null);assert.equal(report.finish.result.receipt.completed,true);assert.deepEqual(report.finish.result.receipt.cleanup.lost,[]);const d=report.finish.disposal;assert.equal(d.disposed,true);assert.deepEqual(d.leaks,[]);assert.ok(Object.values(d.memory).every(n=>n===0));assert.ok(Object.values(report.finish.memory).every(n=>n===0));}catch(error){report.cleanupFailure=error.stack;process.exitCode=1;}finally{clearTimeout(timer);}}
 try{for(const [file,h] of Object.entries(manifest.sourceHashes))assert.equal(hashFile(path.join(ROOT,file)),h,file);assert.equal(hashFile(manifestPath),manifestHash);}catch(error){report.sourceFailure=error.stack;process.exitCode=1;}
 report.completed=!report.failure&&!report.cleanupFailure&&!report.sourceFailure&&report.geometry.length===109&&states.length===721&&report.errors.length===0;
 save();await context?.close();await browser?.close();await server.close();if(report.completed)fs.writeFileSync(path.join(out,'seal.json'),JSON.stringify({reportSHA256:hashFile(path.join(out,'report.json')),manifestSHA256:manifestHash,kind:manifest.kind},null,2)+'\n',{flag:'wx'});
 console.log(JSON.stringify({completed:report.completed,failure:report.failure,cleanupFailure:report.cleanupFailure,output:out}));
}
