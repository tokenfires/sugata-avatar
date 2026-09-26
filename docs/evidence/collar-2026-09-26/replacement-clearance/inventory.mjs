// CPU inventory only: no asset transform, solver or export. Keep old review code unchanged.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {gzipSync,gunzipSync} from 'node:zlib';
import {Matrix4,Vector3,Triangle} from 'three';
import {readGlb,readPrimitive,readAccessor} from '../../../../tools/lut-bake/glb.mjs';
import {compare,topology,selftest} from '../../../../tools/figure-pipeline/collar_clearance_review.mjs';
import {deriveFitSupport} from '../../../../tools/figure-pipeline/collar_fit_support.mjs';
const ROOT=fileURLToPath(new URL('../../../../',import.meta.url));
const [captureArg,runName,stepArg,foundationId,outArg]=process.argv.slice(2),step=Number(stepArg);
assert.ok(captureArg&&runName&&Number.isInteger(step)&&['foundation_bra','foundation_vest'].includes(foundationId)&&outArg,'Usage: inventory.mjs CAPTURE_DIR RUN STEP FOUNDATION_ID FRESH_OUTPUT_DIR');
const captureDir=path.resolve(captureArg),out=path.resolve(outArg);assert.ok(!fs.existsSync(out),'Fresh output directory required');
const sha=b=>createHash('sha256').update(b).digest('hex'),fileHash=f=>sha(fs.readFileSync(f)),rel=f=>path.relative(ROOT,f);
const readAsset=(file,id,expected)=>{assert.equal(fileHash(file),expected,`Asset digest mismatch ${id}`);const glb=readGlb(file);return{file,id,sha256:expected,glb,primitive:readPrimitive(glb,id==='body'?'base.001':id)};};
const point=(p,i)=>Array.from(p.slice(i*3,i*3+3)),sub=(a,b)=>a.map((v,k)=>v-b[k]);
const patch=(mesh,ids)=>ids.map(id=>{const indices=Array.from(mesh.fullIndices.slice(id*3,id*3+3)),vertices=indices.map(i=>point(mesh.positions,i));return{id,indices,vertices,min:[0,1,2].map(k=>Math.min(...vertices.map(v=>v[k]))),max:[0,1,2].map(k=>Math.max(...vertices.map(v=>v[k])))};});
const recordBytes=fs.readFileSync(path.join(captureDir,'report.json')),capture=JSON.parse(recordBytes),run=capture.runs.find(r=>r.name===runName);
assert.ok(run?.completed,'Only a completed run may be inventoried');assert.deepEqual(run.errors,[]);
assert.equal(fileHash(path.join(captureDir,'manifest.json')),capture.manifestSHA256);
assert.ok(run.loadedAssets.some(r=>r.sha256===run.asset.sha256),'Missing real loader response hash');
for(const entry of capture.sourceFreeze){assert.equal(fileHash(path.join(captureDir,entry.file)),entry.sha256,`Frozen capture source changed: ${entry.file}`);}
const entry=run.geometry.find(g=>g.step===step);assert.ok(entry,'Missing discrete pose');
const snapshotFile=path.resolve(captureDir,entry.file);assert.ok(snapshotFile.startsWith(captureDir+path.sep));
const encoded=fs.readFileSync(snapshotFile),decoded=gunzipSync(encoded);assert.equal(sha(encoded),entry.sha256);assert.equal(sha(decoded),entry.decodedSHA256);
const snapshot=JSON.parse(decoded);assert.equal(snapshot.capture.manifestSHA256,capture.manifestSHA256);assert.deepEqual(snapshot.capture.asset,run.asset);assert.equal(snapshot.capture.step,step);
const source=readAsset(path.join(ROOT,'assets/wardrobe/female_casualsuit01/g050.glb'),'female_casualsuit01','44ebc3eb3a09408a3563d369ae74be15a5bc4beb8040bc43c2c5446d6e65c783');
const interior=readAsset(path.join(ROOT,'captures/collar-stress-2026-09-22/gpu-v1/assets/collar-interior.glb'),'female_casualsuit01','d81a6730bde9d8fee4641e18d6f9f0e3922af420bb68eea3f44b661896aeec3a');
const actual=readAsset(path.join(ROOT,run.asset.assetPath),'female_casualsuit01',run.asset.sha256);
const body=readAsset(path.join(ROOT,'assets/wardrobe/body/g050.glb'),'body',capture.sourceHashes['assets/wardrobe/body/g050.glb']);
const foundation=readAsset(path.join(ROOT,`assets/wardrobe/${foundationId}/g050.glb`),foundationId,capture.sourceHashes[`assets/wardrobe/${foundationId}/g050.glb`]);
const supportFile=path.join(ROOT,'docs/evidence/collar-2026-09-26/support.json'),supportRecord=JSON.parse(fs.readFileSync(supportFile)),support=supportRecord.support;
const def=source.glb.json.meshes.find(m=>m.name===source.id).primitives[0],joints=readAccessor(source.glb,def.attributes.JOINTS_0).data,weights=readAccessor(source.glb,def.attributes.WEIGHTS_0).data;
assert.deepEqual(deriveFitSupport(source.primitive,joints,weights,interior.glb.json.meshes.find(m=>m.name===interior.id).extras.sugataInterior.triangles),support);
assert.deepEqual(source.primitive.indices,interior.primitive.indices);assert.deepEqual(actual.primitive.indices,source.primitive.indices);
const moved=new Set(Array.from({length:source.primitive.vertexCount},(_,i)=>i).filter(i=>[0,1,2].some(k=>source.primitive.positions[i*3+k]!==interior.primitive.positions[i*3+k]))),rear=new Set(support.rearGuard.vertices),originalFaces=[],rearFaces=[];
for(let t=0;t<source.primitive.indices.length/3;t++){const ids=Array.from(source.primitive.indices.slice(t*3,t*3+3));if(ids.some(i=>moved.has(i)))originalFaces.push(t);if(ids.some(i=>rear.has(i)))rearFaces.push(t);}
assert.equal(moved.size,96);assert.equal(originalFaces.length,180);assert.equal(rearFaces.length,25);
const union=[...new Set([...support.incidentTriangles,...originalFaces,...rearFaces])].sort((a,b)=>a-b);assert.equal(union.length,180);
const get=asset=>{const ms=snapshot.meshes.filter(m=>m.id===asset.id);assert.equal(ms.length,1);const m=ms[0];assert.equal(m.positions.length,asset.primitive.positions.length);assert.ok(m.positions.every(Number.isFinite));assert.deepEqual(m.fullIndices,Array.from(asset.primitive.indices));return m;};
const bm=get(body),fm=get(foundation),cloth=get(actual);
assert.ok(!snapshot.meshes.some(m=>m.id===(foundationId==='foundation_bra'?'foundation_vest':'foundation_bra')),'Unexpected second torso foundation');
const fdef=foundation.glb.json.meshes.find(m=>m.name===foundationId).primitives[0],mask=readAccessor(foundation.glb,fdef.attributes._UNDER_FEMALE_CASUALSUIT01).data;
const retained=[],retainedIds=[];
for(let t=0;t<fm.fullIndices.length/3;t++){const ids=fm.fullIndices.slice(t*3,t*3+3);if(ids.every(i=>mask[i]<=.5)){retained.push(...ids);retainedIds.push(t);}}
assert.deepEqual(fm.drawnIndices,retained,'Actually drawn foundation differs from frozen any-corner mask');
const bodyMesh={positions:bm.positions,indices:bm.fullIndices},foundationMesh={positions:fm.positions,indices:retained};
const bodyTopology=topology(bodyMesh,body.primitive.positions);assert.equal(bodyTopology.boundaryEdges,0);assert.equal(bodyTopology.nonmanifoldEdges,0);assert.equal(bodyTopology.orientationErrors,0);
const sources=[rel(fileURLToPath(import.meta.url)),'tools/figure-pipeline/collar_clearance_review.mjs','tools/figure-pipeline/collar_fit_support.mjs','tools/figure-pipeline/hair_geometry.mjs','tools/figure-pipeline/hair_surface.mjs','tools/lut-bake/glb.mjs'];
const sourceHashes=Object.fromEntries(sources.map(f=>[f,fileHash(path.join(ROOT,f))]));
const controls=selftest(),triangles=patch(cloth,union);
const resultBody=compare(triangles,bodyMesh,{gridSteps:4,globalInside:true});
const resultFoundation=compare(triangles,foundationMesh,{gridSteps:4,globalInside:false});
for(const result of [resultBody,resultFoundation])for(const row of result.rows)assert.ok(Number.isFinite(row.minimum.distance)&&row.minimum.a.every(Number.isFinite)&&row.minimum.b.every(Number.isFinite),'Nonfinite clearance result');
const bodyFailure=r=>r.minimum.distance===0||Math.abs(r.winding)>.5||r.parity.some(p=>p.ambiguous||p.inside);
const foundationFailure=r=>r.minimum.distance===0||(foundationId==='foundation_bra'&&support.seeds.includes(r.teeTriangle)&&r.minimum.distance<support.minimumSeedBraSeparationMetres);
const witnesses=[];
for(const [target,result,failed] of [['body',resultBody,bodyFailure],[foundationId,resultFoundation,foundationFailure]])for(const row of result.rows.filter(failed)){
    const tee=triangles.find(t=>t.id===row.teeTriangle),targetId=target==='body'?row.minimum.targetTriangle:retainedIds[row.minimum.targetTriangle],mesh=target==='body'?bm:fm;
    const targetWorld=patch(mesh,[targetId])[0].vertices;
    const bary=Triangle.getBarycoord(new Vector3(...row.minimum.a),...tee.vertices.map(p=>new Vector3(...p)),new Vector3()).toArray();
    assert.ok(bary.every(Number.isFinite),'Invalid contact barycentrics');
    witnesses.push({target,teeTriangle:tee.id,targetOriginalTriangle:targetId,minimum:row.minimum,
        winding:row.winding,parity:row.parity,teeWorld:tee.vertices,targetWorld,barycentricAtTeeWitness:bary,
        movableTerms:tee.indices.map((vertex,k)=>({vertex,weight:bary[k],group:support.movingGroups.find(g=>g.vertices.includes(vertex))?.group??null})),
        seed:support.seeds.includes(tee.id),rearGuard:rearFaces.includes(tee.id),support:support.incidentTriangles.includes(tee.id)});
}
// Prospective derivative prerequisite: body-skeleton world matrices × body inverse bind.
// Verify the independent LBS map reproduces this actually loaded outer before describing its Jacobian.
const skin=actual.glb.json.skins[actual.glb.json.nodes.find(n=>n.mesh===actual.glb.json.meshes.findIndex(m=>m.name===actual.id)).skin];
const actualDef=actual.glb.json.meshes.find(m=>m.name===actual.id).primitives[0];
const aj=readAccessor(actual.glb,actualDef.attributes.JOINTS_0).data,aw=readAccessor(actual.glb,actualDef.attributes.WEIGHTS_0).data;
const bodySkin=body.glb.json.skins[0],inverse=readAccessor(body.glb,bodySkin.inverseBindMatrices).data;
const inverseByName=new Map(bodySkin.joints.map((j,i)=>[body.glb.json.nodes[j].name,new Matrix4().fromArray(inverse,i*16)]));
const matrices=skin.joints.map(j=>{const name=actual.glb.json.nodes[j].name;assert.ok(snapshot.rig[name]&&inverseByName.has(name));return new Matrix4().fromArray(snapshot.rig[name]).multiply(inverseByName.get(name));});
let maxLbsError=0;
for(let i=0;i<actual.primitive.vertexCount;i++){const p=new Vector3(...point(actual.primitive.positions,i)),q=new Vector3();let sum=0;for(let k=0;k<4;k++)sum+=aw[i*4+k];assert.ok(sum>0);for(let k=0;k<4;k++)q.addScaledVector(p.clone().applyMatrix4(matrices[aj[i*4+k]]),aw[i*4+k]/sum);for(let k=0;k<3;k++)maxLbsError=Math.max(maxLbsError,Math.abs(q.getComponent(k)-cloth.positions[i*3+k]));}
assert.ok(maxLbsError<1e-6,'Independent pose/LBS map does not reproduce actual outer');
const report={version:1,kind:'prospective-constraint-inventory',provisional:!capture.completed,noCandidateSolvedOrExported:true,
    capture:{directory:rel(captureDir),reportSha256:sha(recordBytes),completedAtRead:capture.completed,manifestSHA256:capture.manifestSHA256,run:runName,step,time:snapshot.time,asset:run.asset,verifiedFrozenSourceFiles:capture.sourceFreeze.length},
    snapshot:{file:rel(snapshotFile),sha256:sha(encoded),decodedSHA256:sha(decoded)},sourceHashes,supportReport:{file:rel(supportFile),sha256:fileHash(supportFile)},
    analyticControls:controls,support,faceInventory:{support:support.incidentTriangles,originalChanged:originalFaces,rearIncident:rearFaces,union},
    actualRetainedFoundation:{id:foundationId,triangles:retainedIds.length,originalTriangleIds:retainedIds,drawnIndicesExactlyMatchMask:true},
    bodyTopology,foundationTopology:topology(foundationMesh,foundation.primitive.positions),independentLbsMaxErrorMetres:maxLbsError,
    fullBody:resultBody,retainedFoundation:resultFoundation,witnesses,
    limits:['Full body global tests require the verified closed, oriented target; open foundations have unsigned separation only.',
        'Legacy dense belowSolverTolerance counters inside compare are diagnostics and are not the new fit thresholds.',
        'No trial or paired native d81 no-regression baseline is asserted here. Shape and displacement constraints remain pending.',
        'CPU-skinned discrete snapshot measurements are not continuous collision or GPU-vertex proof.']};
fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'capture-record.json.gz'),gzipSync(recordBytes),{flag:'wx'});
const raw=Buffer.from(JSON.stringify(report,null,2)+'\n'),packed=gzipSync(raw,{level:9});fs.writeFileSync(path.join(out,'inventory.json.gz'),packed,{flag:'wx'});
const summary={...report,fullBody:undefined,retainedFoundation:undefined,witnesses:undefined,support:undefined,faceInventory:{support:91,originalChanged:180,rearIncident:25,union:180},actualRetainedFoundation:{id:foundationId,triangles:retainedIds.length},
    body:{minimum:resultBody.minimum,crossings:resultBody.crossingTriangles,winding:resultBody.winding,parity:resultBody.rayParity},
    foundation:{minimum:resultFoundation.minimum,crossings:resultFoundation.crossingTriangles},witnesses:witnesses.map(({teeWorld,targetWorld,barycentricAtTeeWitness,movableTerms,...w})=>w),
    inventory:{file:rel(path.join(out,'inventory.json.gz')),encodedSHA256:sha(packed),decodedSHA256:sha(raw)}};
for(const [file,expected] of Object.entries(sourceHashes))assert.equal(fileHash(path.join(ROOT,file)),expected,'Inventory source changed');
assert.equal(fileHash(snapshotFile),entry.sha256,'Snapshot changed');
fs.writeFileSync(path.join(out,'summary.json'),JSON.stringify(summary,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({provisional:report.provisional,run:runName,step,body:summary.body,foundation:summary.foundation,witnesses:witnesses.length,maxLbsError,output:rel(out)},null,2));
