// Isolated storage/CPU arithmetic study. No product asset or renderer changes.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {gunzipSync,gzipSync} from 'node:zlib';
import {fileURLToPath} from 'node:url';
import {Matrix4,Vector3} from 'three';
const ROOT=fileURLToPath(new URL('../../',import.meta.url));
const OUT=path.join(ROOT,'captures/skeleton-full-influences-2026-09-30-v1');
assert.ok(!fs.existsSync(OUT));fs.mkdirSync(OUT,{recursive:true});
const read=p=>fs.readFileSync(path.resolve(ROOT,p)),sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const report={started:new Date().toISOString(),pid:process.pid,node:process.version,status:'running',errors:[],inputs:{},cases:[],corruptions:{},artifacts:[],scope:'Full native body influences and float32 eight-slot CPU storage only; no GPU/runtime/body-range/appearance acceptance.'};
const save=()=>fs.writeFileSync(path.join(OUT,'report.json'),JSON.stringify(report,null,2)+'\n');
function bind(p,copy=false){report.inputs[p]=sha(read(p));if(copy){const dest=path.join(OUT,'source',p);fs.mkdirSync(path.dirname(dest),{recursive:true});fs.copyFileSync(path.resolve(ROOT,p),dest);}}
function decode(dir,a){const p=dir+'/'+a.file;bind(p);const b=read(p);assert.equal(sha(b),a.sha256);const raw=gunzipSync(b);assert.equal(sha(raw),a.decodedSHA256);return JSON.parse(raw);}
function archive(file,data){const raw=Buffer.from(JSON.stringify(data)+'\n'),b=gzipSync(raw);fs.writeFileSync(path.join(OUT,file),b);const a={file,sha256:sha(b),decodedSHA256:sha(raw),bytes:b.length};report.artifacts.push(a);return a;}
const matrix=a=>{assert.equal(a.length,16);assert.ok(a.every(Number.isFinite));return new Matrix4().set(...a);};
const C=matrix([1,0,0,0,0,0,1,0,0,-1,0,0,0,0,0,1]);
function transforms(pose,rest,names){return names.map(n=>{const r=C.clone().multiply(matrix(rest[n]));assert.ok(Math.abs(r.determinant())>1e-12);return C.clone().multiply(matrix(pose[n])).multiply(r.invert());});}
function skin(positions,rows,matrices){return positions.flatMap((p,i)=>{const result=new Vector3();for(const [j,w] of rows[i]){assert.ok(j>=0&&j<matrices.length&&Number.isFinite(w)&&w>=0);if(w!==0)result.addScaledVector(new Vector3(...p).applyMatrix4(matrices[j]),w);}return result.toArray();});}
function metric(actual,expected){assert.equal(actual.length,expected.length);assert.equal(actual.length%3,0);let maxMm=-1,sum=0,worst;const residuals=[];for(let i=0;i<actual.length/3;i++){const a=actual.slice(i*3,i*3+3),e=expected.slice(i*3,i*3+3);assert.ok([...a,...e].every(Number.isFinite));const mm=Math.hypot(...a.map((v,c)=>v-e[c]))*1000;sum+=mm*mm;const r={vertex:i,actual:a,expected:e,mm};if(mm>maxMm){maxMm=mm;worst=r;}residuals.push(r);}return {summary:{passed:maxMm<.342,strict:true,gateMm:.342,vertices:actual.length/3,maxMm,rmsMm:Math.sqrt(sum/(actual.length/3)),worst},residuals};}
try{
 const nr='captures/skeleton-native-pose-2026-09-30-v1',pr='captures/skeleton-posed-comparison-2026-09-30-v1',br='captures/skeleton-export-bridge-2026-09-30-v1';
 for(const [dir,pin]of [[nr,'226a55bc568bec712c847b5a12b91b6c7a019170d91dd26c2d56e60c140f2be1'],[pr,'ea6f19c3cef8e60e5d9bd8f9936cf0c83eeeb0d363bd08d7f7c635897a0a83ef'],[br,'a1c1ec374c41f2fd1c197d666a6b25d7c0f11bf52b796c4a5b02cc03270ed3e9']]){bind(dir+'/report.json',true);assert.equal(report.inputs[dir+'/report.json'],pin);}
 for(const p of ['tools/critic/compare-skeleton-full-influences.mjs','docs/evidence/wardrobe-2026-09-30/skeleton-full-influences/PLAN.md','node_modules/three/package.json','node_modules/three/build/three.core.js','node_modules/three/build/three.module.js'])bind(p,true);
 report.threeResolved=import.meta.resolve('three');assert.equal(fileURLToPath(report.threeResolved),path.join(ROOT,'node_modules/three/build/three.module.js'));
 const native=JSON.parse(read(nr+'/report.json')),parent=JSON.parse(read(pr+'/report.json')),bridge=JSON.parse(read(br+'/report.json'));
 assert.equal(parent.passed,false);assert.ok(parent.matchedRepresentationPassed&&parent.negativeControlsPassed);assert.equal(parent.unmodifiedNativePassed,false);assert.ok(bridge.passed);
 const asset=decode(br,bridge.artifacts.find(a=>a.file==='parsed-asset.json.gz'));
 const names=asset.jointNames;assert.equal(names.length,53);assert.equal(new Set(names).size,names.length);assert.equal(asset.vertexMap.length,14517);
 let referenceWeights,fullRows,packedRows,representation,neutralRest,negative;
 for(const weight of [0,.25,1]){
  const obs=native.observations.filter(o=>o.weight===weight&&o.arm==='native-full');assert.equal(obs.length,3);
  const weights=decode(nr,obs[0].weights);assert.equal(weights.length,19158);
  for(const o of obs)assert.deepEqual(decode(nr,o.weights),weights);
  if(referenceWeights)assert.deepEqual(weights,referenceWeights);else{
   referenceWeights=weights;
   fullRows=asset.vertexMap.map(i=>{assert.ok(i>=0&&i<13380);const row=weights[i];assert.ok(row.length>0&&row.length<=8);const total=row.reduce((s,[,w])=>s+w,0);assert.ok(total>0);return row.map(([n,w])=>{const j=names.indexOf(n);assert.ok(j>=0&&w>0&&Number.isFinite(w));return [j,w/total];});});
   const joints=new Uint8Array(fullRows.length*8),stored=new Float32Array(fullRows.length*8),counts=fullRows.map(r=>r.length);
   for(let i=0;i<fullRows.length;i++)for(let k=0;k<fullRows[i].length;k++){joints[i*8+k]=fullRows[i][k][0];stored[i*8+k]=fullRows[i][k][1];}
   packedRows=fullRows.map((_,i)=>Array.from({length:8},(_,k)=>[joints[i*8+k],stored[i*8+k]]));
   const sums=packedRows.map(r=>r.reduce((s,[,w])=>s+w,0));
   representation={jointNames:names,vertexMap:asset.vertexMap,fullRows,counts,joints8:Array.from(joints),weights8:Array.from(stored),slots:8,weightType:'float32',jointType:'uint8',renormalizeDuringBlending:false};
   report.representation={vertices:fullRows.length,maxInfluences:Math.max(...counts),countDistribution:counts.reduce((a,n)=>(a[n]=(a[n]??0)+1,a),{}),packedSumMin:Math.min(...sums),packedSumMax:Math.max(...sums),maxSumError:Math.max(...sums.map(s=>Math.abs(s-1))),artifact:archive('representation.json.gz',representation)};
  }
  for(const pose of ['identity','elbow','coupled']){
   const previous=parent.cases.find(c=>c.weight===weight&&c.pose===pose);assert.ok(previous.matchedRepresentationPassed&&previous.interpretableAfterControls);
   const input=decode(pr,previous.artifact),nativeCase=decode(nr,obs.find(o=>o.pose===pose).artifact);
   assert.equal(input.weight,weight);assert.equal(input.pose,pose);assert.deepEqual(Object.keys(input.constructedRest).sort(),[...names].sort());assert.equal(input.shapedPositions.length,14517);
   const expected=asset.vertexMap.flatMap(i=>new Vector3(...nativeCase.bodyPositions.slice(i*3,i*3+3)).applyMatrix4(C).toArray());
   const matrices=transforms(input.constructedPose,input.constructedRest,names);
   const full=skin(input.shapedPositions,fullRows,matrices),packed=skin(input.shapedPositions,packedRows,matrices);
   const comparisons={fullVersusNative:metric(full,expected),packedVersusNative:metric(packed,expected),packedVersusFull:metric(packed,full)};
   const controls=report.cases.filter(c=>(weight!==0&&c.weight===0&&c.pose===pose)||(pose!=='identity'&&c.weight===weight&&c.pose==='identity'));
   assert.equal(controls.length,(weight!==0?1:0)+(pose!=='identity'?1:0));
   const row={weight,pose,comparisons:Object.fromEntries(Object.entries(comparisons).map(([n,m])=>[n,m.summary])),controlParents:controls.map(c=>({weight:c.weight,pose:c.pose})),interpretable:controls.every(c=>c.passed&&c.interpretable)};row.passed=Object.values(row.comparisons).every(m=>m.passed);
   row.artifact=archive(`case-${String(weight).replace('.','_')}-${pose}.json.gz`,{weight,pose,parentArtifact:previous.artifact,fullPositions:full,packedPositions:packed,expected,comparisons});report.cases.push(row);save();
   if(weight===0&&pose==='identity')neutralRest=input.constructedRest;
   if(weight===0&&pose==='coupled'){
    const actualFour=asset.joints.map((j,i)=>j.map((index,k)=>[index,asset.normalizedWeights[i][k]]));
    const four=skin(input.shapedPositions,actualFour,matrices),result=metric(four,expected),reproduction=metric(four,input.proposedPositions),mutation=metric(four,full);
    assert.ok(reproduction.summary.maxMm<1e-8);assert.ok(Math.abs(result.summary.maxMm-previous.comparisons.proposedVersusNativeFull.maxMm)<1e-8);
    report.corruptions.restoreAcceptedFour={...result.summary,cleanParent:{weight,pose,passed:row.passed},interpretable:row.passed&&row.interpretable,mutationMaxMm:mutation.summary.maxMm,reproductionMaxMm:reproduction.summary.maxMm};archive('restore-accepted-four.json.gz',{four,result,reproduction,mutation});
   }
   if(weight===1&&pose==='coupled')negative={input,expected,row,full};
  }
 }
 const stale=skin(negative.input.shapedPositions,fullRows,transforms(negative.input.constructedPose,neutralRest,names)),result=metric(stale,negative.expected),mutation=metric(stale,negative.full);
 report.corruptions.staleNeutralBinds={...result.summary,cleanParent:{weight:1,pose:'coupled',passed:negative.row.passed},interpretable:negative.row.passed&&negative.row.interpretable,mutationMaxMm:mutation.summary.maxMm};archive('stale-neutral-binds.json.gz',{stale,result,mutation});
 report.cleanPassed=report.cases.every(c=>c.passed&&c.interpretable);report.negativeControlsPassed=Object.values(report.corruptions).every(c=>c.interpretable&&!c.passed&&c.mutationMaxMm>0);report.passed=report.cleanPassed&&report.negativeControlsPassed;
 for(const [p,h]of Object.entries(report.inputs))assert.equal(sha(read(p)),h,p);report.status='compared';
}catch(e){report.status='failed';report.errors.push(e.stack);throw e;}
finally{report.finished=new Date().toISOString();save();console.log(JSON.stringify({out:OUT,status:report.status,passed:report.passed,cases:report.cases.length,pid:report.pid}));}
