// Read one explicitly hash-bound sealed candidate. Completion is measurement, not promotion.
import fs from 'node:fs'; import path from 'node:path'; import assert from 'node:assert/strict';
import {createHash} from 'node:crypto'; import {gunzipSync} from 'node:zlib'; import {fileURLToPath} from 'node:url';
import {createHandGeometryAudit} from '../hand-clearance/geometry-audit.mjs';
import {triangles,projectedIndex,certifyLateralCorridor} from './distal-corridor.mjs';
import {positiveMarginBound} from './distal-margin-bound.mjs';
const ROOT=fileURLToPath(new URL('../../../../',import.meta.url)),HERE=path.dirname(fileURLToPath(import.meta.url));
const [captureArg,outArg,expectedManifest]=process.argv.slice(2);assert.equal(process.argv.length,5);
assert.match(expectedManifest,/^[0-9a-f]{64}$/,'Explicit reviewed manifest SHA required');
const capture=path.resolve(captureArg),out=path.resolve(outArg);assert.ok(!fs.existsSync(out),'Fresh output required');
const read=p=>fs.readFileSync(p),sha=b=>createHash('sha256').update(b).digest('hex'),hash=p=>sha(read(p));
const inside=file=>{const p=path.resolve(capture,file);assert.ok(p.startsWith(capture+path.sep),'Capture record escapes directory');return p;};
const load=file=>JSON.parse(read(inside(file)));
const raw=read(inside('report.json')),report=JSON.parse(raw),seal=load('seal.json'),manifest=load('manifest.json');
assert.equal(sha(raw),seal.reportSHA256);assert.equal(hash(inside('manifest.json')),expectedManifest);
assert.equal(report.manifestSHA256,expectedManifest);assert.equal(seal.manifestSHA256,expectedManifest);
assert.equal(report.kind,'frozen-rest-budget-candidate');assert.equal(seal.kind,report.kind);assert.equal(manifest.kind,report.kind);
assert.equal(manifest.baseManifestSHA256,'fc0e017fba7da12f6c511b53e705b2441b440fa8cb8731bd65f36a839514793d');
assert.equal(report.completed,true);assert.deepEqual(report.errors,[]);assert.ok(!report.failure&&!report.cleanupFailure&&!report.sourceFailure);
assert.deepEqual(report.sourceHashes,manifest.sourceHashes);assert.equal(manifest.promotion,false);
assert.deepEqual(report.sourceFreeze,Object.entries(manifest.sourceHashes).map(([file,sha256])=>({file:'source/'+file,sha256})));
for(const entry of report.sourceFreeze)assert.equal(hash(inside(entry.file)),entry.sha256,'Frozen capture source bytes');
const rawBase=read(path.join(HERE,'../hand-clearance/hand-attribution-manifest-v4.json'));assert.equal(sha(rawBase),manifest.baseManifestSHA256);assert.deepEqual(manifest.baseManifest,JSON.parse(rawBase));
const base=manifest.baseManifest,steps=base.planned.numericalSteps;assert.equal(steps.length,109);assert.equal(base.timing.steps,720);assert.equal(base.timing.fps,60);
assert.deepEqual(report.geometry.map(g=>g.step),steps);assert.deepEqual(report.commands.map(c=>c.step),[0,360]);assert.equal(report.states.count,721);
const finish=report.finish;assert.equal(finish.error,null);assert.equal(finish.result.receipt.completed,true);
assert.deepEqual(finish.result.receipt.cleanup.lost,[]);assert.equal(finish.disposal.disposed,true);assert.deepEqual(finish.disposal.leaks,[]);
for(const memory of [finish.memory,finish.disposal.memory])assert.ok(Object.keys(memory).length&&Object.values(memory).every(v=>v===0));
assert.equal(finish.disposal.instrument.status,'disposed');assert.equal(finish.disposal.instrument.failure,null);assert.deepEqual(finish.disposal.instrument.cleanup.lost,[]);
function bound(entry){const raw=read(inside(entry.file));assert.equal(sha(raw),entry.sha256);const decoded=gunzipSync(raw);assert.equal(sha(decoded),entry.decodedSHA256);return JSON.parse(decoded);}
const states=bound(report.states);assert.equal(states.length,721);
assert.equal(finish.result.receipt.budgetCalls.length,1,'Original native construction binds one posture budget');
const effective=finish.result.receipt.budgetCalls.at(-1).effective;assert.deepEqual(Object.keys(effective).sort(),['leftUpperArm','rightUpperArm']);
assert.equal(effective.leftUpperArm,manifest.candidate.budget.commonRadians);
assert.equal(effective.leftUpperArm,effective.rightUpperArm);assert.ok(Number.isFinite(effective.leftUpperArm)&&effective.leftUpperArm>=0);
for(const call of finish.result.receipt.budgetCalls)for(const side of ['leftUpperArm','rightUpperArm']){assert.equal(call.effective[side],effective[side]);assert.ok(call.effective[side]<=call.native[side]);}
for(const [step,state] of states.entries()){
 assert.equal(state.step,step);assert.equal(state.instrument.arm,'A');assert.equal(state.instrument.status,'active');assert.equal(state.instrument.failure,null);
 for(const owner of state.instrument.owners)if(owner.status==='returned-output')assert.deepEqual(owner.raw,owner.effective,'No diagnostic filtering');
 for(const side of ['leftUpperArm','rightUpperArm'])assert.ok(Number.isFinite(state.sharedPosture.appliedArmRadians[side])&&state.sharedPosture.appliedArmRadians[side]>=-effective[side]);
 assert.equal(state.sharedPosture.appliedArmRadians.leftUpperArm,state.sharedPosture.appliedArmRadians.rightUpperArm);
}
const regionFile=path.join(HERE,'distal-regions-v1.json'),targetFile=path.join(HERE,'ipsilateral-corridor-v3.json');
assert.equal(hash(regionFile),'4fcd74bdf3478895ee538dd38f0f67c53f28434401d417a4f4990b285fedd933');
assert.equal(hash(targetFile),'40f1047e3c81fb7c783529c17376db51e0a1203c6f6626e981b5d26fab5c0602');
const regions=JSON.parse(read(regionFile)),profile=JSON.parse(read(targetFile));
const boundaryFile=path.join(HERE,'feasibility/placement-boundary-v1.json');assert.equal(hash(boundaryFile),'9b56ac8d97b86158fd072ea169a31e51d1da23b1748c3f5c98763050a01084df');
const handBoundary=JSON.parse(read(boundaryFile)).handBoundaryRegions;
for(const side of ['l','r']){assert.equal(handBoundary.faceIds[side].length,3389);assert.ok(regions.legacy[side].every(f=>handBoundary.faceIds[side].includes(f)));assert.ok(handBoundary.faceIds[side].every(f=>regions.distal[side].includes(f)));}
const body='assets/wardrobe/body/g050.glb',garment='assets/wardrobe/female_casualsuit01/g050.glb';
const deps=['docs/evidence/nonhair-2026-09-26/hand-candidate/candidate-analyze.mjs','docs/evidence/nonhair-2026-09-26/hand-candidate/distal-corridor.mjs',
 'docs/evidence/nonhair-2026-09-26/hand-candidate/distal-margin-bound.mjs','docs/evidence/nonhair-2026-09-26/hand-clearance/geometry-audit.mjs',
 'tools/lut-bake/glb.mjs','tools/figure-pipeline/hair_surface.mjs',body,garment];
const sourceHashes=Object.fromEntries(deps.map(f=>[f,hash(path.join(ROOT,f))]));
for(const [file,h] of Object.entries({
 'docs/evidence/nonhair-2026-09-26/hand-clearance/geometry-audit.mjs':'c299eb5c346d795dd7541c106e8415a323d3a9a450b4865173665ed79dfa0ded',
 'docs/evidence/nonhair-2026-09-26/hand-candidate/distal-corridor.mjs':'1326c14c10aef045de0b674cf6feba6d2259b8d70f52c3fb0b790974d76bc9b9',
 'docs/evidence/nonhair-2026-09-26/hand-candidate/distal-margin-bound.mjs':'74cb3a397a214596668de53d3803b6af2a2d1b2909b81b868472bce81bb4c7cf'}))assert.equal(sourceHashes[file],h,'Reviewed operator bytes');
for(const f of ['tools/lut-bake/glb.mjs',body,garment])assert.equal(sourceHashes[f],manifest.sourceHashes[f]);
assert.equal(sourceHashes['tools/figure-pipeline/hair_surface.mjs'],'9afeedd9d9c120d1d6abb8c0dcaf98bc940269227b9c1451e461a39414a85794');
const audit=createHandGeometryAudit({bodyPath:path.join(ROOT,body),garmentPath:path.join(ROOT,garment)});
const result={version:1,completed:false,createdAt:new Date().toISOString(),captureDirectory:capture,reportSHA256:sha(raw),manifestSHA256:expectedManifest,
 sourceHashes,regionSHA256:hash(regionFile),targetProfileSHA256:hash(targetFile),handBoundarySourceSHA256:hash(boundaryFile),handBoundary,stateBinding:report.states,effectiveBudget:effective,
 method:audit.method,components:audit.components,poses:[],corridors:[],
 scope:'Discrete candidate evidence only. Pair counts are not severity, clearance or containment. Directional certificates cover unchanged declared source regions, with mixed-torso exclusions and sleeve-inside clothing limits. No motion appearance, all-motion or promotion qualification.'};
fs.mkdirSync(out,{recursive:true});const save=()=>fs.writeFileSync(path.join(out,'analysis.json'),JSON.stringify(result,null,2)+'\n');save();
function corridor(query,index,side){const certificate=certifyLateralCorridor(query,index,{side,marginMetres:0});return {certificate,positiveBound:certificate.status==='certified-for-selected-triangle-sets'?positiveMarginBound(query,index,certificate):null};}
try{
 for(const entry of report.geometry){
  const s=bound(entry);assert.deepEqual(s.capture,{candidate:'D',step:entry.step,manifestSHA256:expectedManifest,kind:manifest.kind});assert.equal(s.time,entry.time);
  const measured=audit.analyze(s);result.poses.push({step:entry.step,time:s.time,file:entry.file,sha256:entry.sha256,decodedSHA256:entry.decodedSHA256,sides:measured.sides});
  {
   const selectedWitness=[0,98,270,455,637,720].includes(entry.step);
   const all=Object.fromEntries(s.meshes.map(m=>[m.id,triangles(m)])),worn=projectedIndex(Object.entries(all).filter(([id])=>id!=='body').flatMap(([,v])=>v)),sides={};
   for(const side of ['l','r']){
    const omitted=new Set(profile.excludedFaceIds.sourceHalfSpace[side]),bodyIndex=projectedIndex(all.body.filter(t=>!omitted.has(t.face))),distal=regions.distal[side].map(f=>all.body[f]),legacy=regions.legacy[side].map(f=>all.body[f]);
    sides[side]={declaredBodyDistal:corridor(distal,bodyIndex,side),allWornPositiveHandBoundary:corridor(handBoundary.faceIds[side].map(f=>all.body[f]),worn,side)};
    if(selectedWitness){sides[side].allWornDistal=corridor(distal,worn,side);sides[side].allWornLegacyHand=corridor(legacy,worn,side);}
   }
   result.corridors.push({step:entry.step,sha256:entry.sha256,selectedWitness,sides});
   if(selectedWitness||entry.step%60===0){save();console.log('Measured candidate geometry '+entry.step);}
  }
 }
 const csv=['step,time,left_trouser_pairs,right_trouser_pairs,left_lowerbody_pairs,right_lowerbody_pairs',...result.poses.map(p=>[p.step,p.time,p.sides.l.trousers.pairs,p.sides.r.trousers.pairs,p.sides.l.lowerBody.pairs,p.sides.r.lowerBody.pairs].join(','))].join('\n')+'\n';
 fs.writeFileSync(path.join(out,'selected-pair-counts.csv'),csv,{flag:'wx'});result.csv={file:'selected-pair-counts.csv',sha256:sha(csv)};
 for(const [file,h] of Object.entries(sourceHashes))assert.equal(hash(path.join(ROOT,file)),h);
 assert.equal(hash(inside('report.json')),result.reportSHA256);assert.equal(hash(inside('manifest.json')),expectedManifest);
 assert.equal(result.poses.length,109);assert.equal(result.corridors.length,109);
 result.completed=true;save();console.log(JSON.stringify({completed:true,poses:result.poses.length,corridors:result.corridors.length,analysisSHA256:hash(path.join(out,'analysis.json'))}));
}catch(error){result.failure=error.stack;save();throw error;}
