// CPU-only A/D gallery packaging. Explicit source seals and actual matched image records precede output.
import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';import {gunzipSync} from 'node:zlib';import {fileURLToPath} from 'node:url';
import {inspectSealedViews} from '../hand-clearance/package-hand-review.mjs';
import {compareRetained} from '../hand-clearance/retained-json-comparison.mjs';
import {VIEWS} from '../hand-clearance/hand-attribution-manifest.mjs';
const HERE=path.dirname(fileURLToPath(import.meta.url)),ROOT=path.resolve(HERE,'../../../..');
const comparisons=[];
const [candidateArg,outputArg,expectedManifest]=process.argv.slice(2);assert.equal(process.argv.length,5);
assert.match(expectedManifest,/^[0-9a-f]{64}$/);const candidate=path.resolve(candidateArg),output=path.resolve(outputArg);
assert.equal(fs.existsSync(output),false,'Fresh gallery directory required');
const read=p=>fs.readFileSync(p),hash=b=>createHash('sha256').update(b).digest('hex'),json=p=>JSON.parse(read(p));
const within=(dir,file)=>{assert.equal(typeof file,'string');assert.ok(file&&!path.isAbsolute(file));const p=path.resolve(dir,file);assert.ok(p.startsWith(path.resolve(dir)+path.sep));return p;};
function bound(dir,entry){const bytes=read(within(dir,entry.file));assert.equal(hash(bytes),entry.sha256);const raw=gunzipSync(bytes);assert.equal(hash(raw),entry.decodedSHA256);return JSON.parse(raw);}
function sealed(dir,kind){const raw=read(path.join(dir,'report.json')),r=JSON.parse(raw),s=json(path.join(dir,'seal.json')),mb=read(path.join(dir,'manifest.json')),m=JSON.parse(mb);
 assert.equal(hash(raw),s.reportSHA256);assert.equal(hash(mb),s.manifestSHA256);assert.equal(r.manifestSHA256,s.manifestSHA256);
 assert.equal(r.kind,kind);assert.equal(s.kind,kind);assert.equal(m.kind,kind);assert.equal(r.completed,true);assert.equal(r.preflightOnly,undefined);
 assert.ok(!r.failure&&!r.cleanupFailure&&!r.sourceFailure);assert.deepEqual(r.errors,[]);assert.deepEqual(r.sourceHashes,m.sourceHashes);
 assert.equal(r.finish.error,null);assert.equal(r.finish.result.receipt.completed,true);assert.deepEqual(r.finish.result.receipt.cleanup.lost,[]);
 assert.equal(r.finish.disposal.disposed,true);assert.deepEqual(r.finish.disposal.leaks,[]);
 for(const memory of [r.finish.memory,r.finish.disposal.memory])assert.ok(Object.keys(memory).length&&Object.values(memory).every(x=>x===0));
 for(const [file,sha]of Object.entries(m.sourceHashes))assert.equal(hash(read(within(dir,'source/'+file))),sha,'Frozen source '+file);
 return {r,m,reportSHA256:hash(raw),manifestSHA256:hash(mb),sealSHA256:hash(read(path.join(dir,'seal.json')))};
}
const oldDir=path.join(ROOT,'captures/hand-attribution-2026-09-26/views-v4');
assert.equal(hash(read(path.join(oldDir,'report.json'))),'5fc7296aae2c6f657fb1fac6b4c4830d87f0ce527ce5c06bbf17ee90a4a5e82b');
const old=inspectSealedViews(oldDir),oldManifest=json(path.join(oldDir,'manifest.json')),oldReport=json(path.join(oldDir,'report.json'));
assert.equal(old.manifest.provenance.manifestSHA256,'fc0e017fba7da12f6c511b53e705b2441b440fa8cb8731bd65f36a839514793d');
const v=sealed(candidate,'frozen-rest-budget-candidate-views');assert.equal(v.manifestSHA256,expectedManifest);
assert.equal(v.m.promotion,false);assert.equal(v.m.baseManifestSHA256,old.manifest.provenance.manifestSHA256);assert.deepEqual(v.m.baseManifest,oldManifest);
assert.deepEqual(v.m.views,VIEWS);assert.deepEqual(v.m.imageSteps,old.manifest.samples.map(s=>s.step));assert.deepEqual(v.m.closeSteps,[0,455,637]);
const primaryDir=within(ROOT,v.m.reference.directory),primary=sealed(primaryDir,'frozen-rest-budget-candidate');
assert.equal(primary.manifestSHA256,'a4bd27fcef48d9efb2cdcd71d7df3c2523d4e2b2416e6002a834c56efa382515');
assert.equal(primary.reportSHA256,v.m.reference.reportSHA256);assert.equal(primary.sealSHA256,v.m.reference.sealSHA256);assert.deepEqual(v.r.reference,v.m.reference);
assert.deepEqual(v.m.candidate,primary.m.candidate);assert.deepEqual(v.r.setup.ready.configuration,primary.r.setup.ready.configuration);
for(const [file,sha]of Object.entries(primary.m.sourceHashes))assert.equal(v.m.sourceHashes[file],sha,'Same primary source '+file);
const states=bound(candidate,v.r.states),primaryStates=bound(primaryDir,primary.r.states);assert.equal(states.length,721);assert.equal(primaryStates.length,721);
compareRetained(states,primaryStates,{audit:comparisons,label:'Own primary complete721-state gallery binding'});
const steps=oldManifest.planned.numericalSteps;assert.equal(steps.length,109);assert.deepEqual(v.r.geometry.map(g=>g.step),steps);assert.deepEqual(v.r.viewParity.map(g=>g.step),steps);assert.deepEqual(primary.r.geometry.map(g=>g.step),steps);
for(let i=0;i<steps.length;i++){const g=bound(candidate,v.r.geometry[i]),p=bound(primaryDir,primary.r.geometry[i]);
 const pose=x=>({time:x.time,rig:x.rig,meshes:x.meshes});compareRetained(pose(g),pose(p),{audit:comparisons,label:'Own primary geometry '+steps[i]});
 const q=v.r.viewParity[i];assert.equal(q.primaryDecodedSHA256,primary.r.geometry[i].decodedSHA256);assert.equal(q.geometryEqual,true);assert.equal(q.semanticEqual,true);
}
assert.ok(v.r.comparisons.length>0&&v.r.comparisons.every(c=>c.equal===true));
const oldA=oldReport.runs.find(r=>r.arm==='A');assert.equal(v.r.visualBase.semanticUnchanged,true);assert.equal(oldA.visualBase.semanticUnchanged,true);
for(const phase of ['before','after'])for(const key of ['camera','projection','view'])compareRetained(v.r.visualBase[phase][key],oldA.visualBase[phase][key],{audit:comparisons,label:'Same actual ordinary camera '+phase+' '+key});
compareRetained(v.r.visualBase.rendering.camera,oldA.visualBase.rendering.camera,{audit:comparisons,label:'Same observed ordinary render camera'});
assert.deepEqual(v.r.images.map(s=>s.step),v.m.imageSteps);
const controls=[{...old.manifest.controls[0],label:'Current default',note:'Accepted rest family and native inward allowance; original unfiltered motion.'}],copies=old.copies.filter(c=>c.output.startsWith('images/A-')).map(c=>({...c,directory:oldDir}));
const proposed={id:'D',label:'Fixed placement candidate',note:'Upper-arm rest placement 4° outward on both sides, with native inward allowance 0. Native motion and gesture yield remain active. Experimental; not the default.',fullBody:[],close:[]};
for(const sample of v.r.images){assert.equal(sample.semanticUnchanged,true);assert.deepEqual(sample.zeroDeltaPhysicalGuard,['hairPositions','hairVelocities','head','clock','steps']);
 const matching=oldA.images.find(s=>s.step===sample.step);assert.ok(matching);
 const wanted=[0,455,637].includes(sample.step)?VIEWS.map(v=>v.id):[VIEWS[0].id];assert.deepEqual(sample.plates.map(p=>p.view),wanted);
 for(const plate of sample.plates){const oldPlate=matching.plates.find(p=>p.view===plate.view);assert.ok(oldPlate);
  if(plate.view==='front-full-body')compareRetained(plate.rendering.camera,oldPlate.rendering.camera,{audit:comparisons,label:'A/D full view camera '+sample.step});
  else{compareRetained(plate.during.camera,oldPlate.during.camera,{audit:comparisons,label:'A/D close view camera '+plate.view+' '+sample.step});compareRetained(plate.restored.camera,plate.beforeDraw.camera,{audit:comparisons,label:'Restored camera '+sample.step});}
  const bytes=read(within(candidate,plate.file));assert.equal(hash(bytes),plate.sha256);assert.equal(bytes.subarray(0,8).toString('hex'),'89504e470d0a1a0a');assert.equal(bytes.subarray(12,16).toString(),'IHDR');
  const width=bytes.readUInt32BE(16),height=bytes.readUInt32BE(20),oldBytes=read(within(oldDir,oldPlate.file));assert.equal(width,oldBytes.readUInt32BE(16));assert.equal(height,oldBytes.readUInt32BE(20));
  const src=`images/D-${plate.view}-${String(sample.step).padStart(4,'0')}.png`,item={step:sample.step,time:sample.step/60,src,sha256:plate.sha256,width,height};
  copies.push({directory:candidate,input:plate.file,output:src,sha256:plate.sha256});
  if(plate.view==='front-full-body')proposed.fullBody.push(item);else proposed.close.push({...item,side:plate.view==='left-hand-hip'?'Left':'Right'});
 }
}
assert.equal(proposed.fullBody.length,244);assert.equal(proposed.close.length,6);assert.equal(copies.length,500);controls.push(proposed);
const manifest={version:1,title:'Hand-placement candidate review',fps:60,samples:old.manifest.samples,closeSteps:[0,455,637],controls,
 scope:'Current default and one fixed rest-placement candidate on the same g050 character, casual outfit and happy-to-angry trace. The candidate is isolated and does not change the default.',
 limit:'This matched, sampled 12-second trace is a review aid. Neither a completed replay nor zero selected intersections establishes continuous clearance, perceptual quality, other outfits or other bodies. Hair is unchanged and outside this review. Numerical and visual decisions are documented separately.',
 provenance:{acceptedViewsReportSHA256:old.manifest.provenance.viewsReportSHA256,acceptedPrimaryReportSHA256:old.manifest.provenance.primaryReportSHA256,candidateViewsReportSHA256:v.reportSHA256,candidatePrimaryReportSHA256:primary.reportSHA256,candidateManifestSHA256:v.manifestSHA256}};
fs.mkdirSync(path.join(output,'images'),{recursive:true});const generated=[];
for(const [source,dest]of [['candidate-review.html','index.html'],['candidate-review.mjs','review.mjs'],['candidate-review.css','review.css']]){const bytes=read(path.join(HERE,source));fs.writeFileSync(path.join(output,dest),bytes,{flag:'wx'});generated.push({file:dest,sha256:hash(bytes)});}
for(const copy of copies){const bytes=read(within(copy.directory,copy.input));assert.equal(hash(bytes),copy.sha256);fs.writeFileSync(within(output,copy.output),bytes,{flag:'wx'});}
const manifestBytes=Buffer.from(JSON.stringify(manifest,null,2)+'\n');fs.writeFileSync(path.join(output,'review-manifest.json'),manifestBytes,{flag:'wx'});
const receipt={completed:true,createdAt:new Date().toISOString(),...manifest.provenance,manifestSHA256:hash(manifestBytes),generatorSHA256:hash(read(fileURLToPath(import.meta.url))),comparisons,generated,copies,imageCount:500,fullBodySamplesPerControl:244,closePlatesPerControl:6,scope:'Verified evidence packaging only; browser operation and visual acceptance require independent review.'};
fs.writeFileSync(path.join(output,'receipt.json'),JSON.stringify(receipt,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify({completed:true,output,images:500}));
