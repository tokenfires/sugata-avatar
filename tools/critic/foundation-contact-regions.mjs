// Retained contact witnesses and at most two predeclared body self-contact faces.
import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';import {gunzipSync} from 'node:zlib';
import {ROOT,hashFile,sha256} from '../figure-pipeline/collar_replacement_manifest.mjs';import {readGlb,readAccessor} from '../lut-bake/glb.mjs';
import {triangleDistance,winding,rayParity,selftest} from '../figure-pipeline/collar_clearance_review.mjs';
const auditRoot='captures/foundation-domain-motion-clearance-2026-09-30-v1',motionRoot='captures/foundation-domain-motion-2026-09-30-v1',fitRoot='captures/foundation-runtime-fit-2026-09-30-v1';
const expected={[`${auditRoot}/report.json`]:'1e22fbe045b34606fdcced937b2442eb9b8785ece4da5d3e7497193019fe5e0f',[`${motionRoot}/report.json`]:'24071200867f77630521e51202fe3c9de6069173cee905d0a5ecda713176953b',[`${fitRoot}/report.json`]:'cc39d179e1c3c1943da54dbeff33294ec7fa22d5895bdd1bcf971678b0375ee9','assets/wardrobe/body/g050.glb':'fc4445c95ed3f423734ff272ee78ebb44d762a8f16edb94b26039de7a8a96b3a'};
for(const[p,h]of Object.entries(expected))assert.equal(hashFile(path.join(ROOT,p)),h,p);
const read=p=>JSON.parse(fs.readFileSync(path.join(ROOT,p))),audit=read(`${auditRoot}/report.json`),motion=read(`${motionRoot}/report.json`),fit=read(`${fitRoot}/report.json`);assert.equal(fit.exactReconstruction,true);assert.equal(fit.status,'observed');assert.equal(audit.allFourStatesExterior,false);
const run=motion.runs.find(r=>r.key==='band-foundation');const out=path.join(ROOT,'captures/foundation-contact-regions-2026-09-30-v1');assert.ok(!fs.existsSync(out));fs.mkdirSync(out,{recursive:true});
const sources=[...Object.keys(expected),'tools/critic/foundation-contact-regions.mjs','docs/evidence/wardrobe-2026-09-30/foundation-runtime-fit/REGION-PLAN.md','tools/lut-bake/glb.mjs','tools/figure-pipeline/collar_clearance_review.mjs','tools/figure-pipeline/hair_geometry.mjs','tools/figure-pipeline/hair_surface.mjs','tools/figure-pipeline/collar_replacement_manifest.mjs',...run.geometry.map(g=>`${motionRoot}/${g.file}`)];
const pins=Object.fromEntries(sources.map(p=>[p,hashFile(path.join(ROOT,p))]));for(const p of sources){const dest=path.join(out,'source',p);fs.mkdirSync(path.dirname(dest),{recursive:true});fs.copyFileSync(path.join(ROOT,p),dest);}
const report={started:new Date().toISOString(),pid:process.pid,status:'running',pins,states:[],selfContact:[],errors:[],scope:'Stored target per crossing band triangle, mean joint descriptors, one winding/parity disagreement and at most two body faces. Not all contact pairs, anatomical segmentation, global self-collision or any repair/qualification.'};const save=()=>fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');
const directions=[[1,.371,.127],[-.217,1,.413],[.319,-.173,1],[1,-.731,.229],[-.617,.331,-1]];
const face=(m,id)=>{const indices=m.fullIndices.slice(id*3,id*3+3);assert.equal(indices.length,3);const vertices=indices.map(i=>m.positions.slice(i*3,i*3+3));return{id,indices,vertices,min:[0,1,2].map(k=>Math.min(...vertices.map(p=>p[k]))),max:[0,1,2].map(k=>Math.max(...vertices.map(p=>p[k])))};};
function load(g){const bytes=fs.readFileSync(path.join(ROOT,motionRoot,g.file));assert.equal(sha256(bytes),g.sha256);const raw=gunzipSync(bytes);assert.equal(sha256(raw),g.decodedSHA256);return JSON.parse(raw);}
try{
  save();report.controls=selftest();assert.equal(report.controls.pass,true);
  const glb=readGlb(path.join(ROOT,'assets/wardrobe/body/g050.glb')),meshIndex=glb.json.meshes.findIndex(m=>m.name==='base.001'),p=glb.json.meshes[meshIndex].primitives[0],node=glb.json.nodes.find(n=>n.mesh===meshIndex),names=glb.json.skins[node.skin].joints.map(i=>glb.json.nodes[i].name);
  const rest={positions:Array.from(readAccessor(glb,p.attributes.POSITION).data),fullIndices:Array.from(readAccessor(glb,p.indices).data)},joints=Array.from(readAccessor(glb,p.attributes.JOINTS_0).data),weights=Float32Array.from(readAccessor(glb,p.attributes.WEIGHTS_0).data);
  for(let i=0;i<weights.length;i+=4){const sum=Math.abs(weights[i])+Math.abs(weights[i+1])+Math.abs(weights[i+2])+Math.abs(weights[i+3]);assert.ok(Number.isFinite(sum)&&sum>0);const scale=1/sum;for(let k=0;k<4;k++)weights[i+k]*=scale;}
  const descriptor=id=>{const ids=rest.fullIndices.slice(id*3,id*3+3),sum=new Map();for(const i of ids)for(let k=0;k<4;k++){const name=names[joints[i*4+k]],w=weights[i*4+k];assert.ok(name&&Number.isFinite(w));if(w)sum.set(name,(sum.get(name)??0)+w/3);}const mean=[...sum].map(([joint,weight])=>({joint,weight})).sort((a,b)=>b.weight-a.weight||a.joint.localeCompare(b.joint));return{bodyTriangle:id,indices:ids,dominantJoint:mean[0].joint,meanWeights:mean};};
  const snapshots=[];
  for(const state of audit.states){
    const snapshot=load(run.geometry.find(g=>g.step===state.step)),body=snapshot.meshes.find(m=>m.id==='body'),band=snapshot.meshes.find(m=>m.id==='foundation_bra');assert.deepEqual(body.fullIndices,rest.fullIndices);snapshots.push({step:state.step,body,band});
    const rows=state.rows.filter(r=>r.minimum.distance===0).map(r=>({bandTriangle:r.teeTriangle,kind:r.minimum.kind,target:descriptor(r.minimum.targetTriangle),point:r.minimum.a})),byDominantJoint={};
    for(const r of rows)byDominantJoint[r.target.dominantJoint]=(byDominantJoint[r.target.dominantJoint]??0)+1;
    const disagreements=state.rows.filter(r=>(Math.abs(r.winding)>.5)!==r.parity.some(p=>p.inside===true)).map(r=>({bandTriangle:r.teeTriangle,winding:r.winding,parity:r.parity,target:descriptor(r.minimum.targetTriangle)}));
    assert.equal(rows.length,state.summary.crossingTriangles);report.states.push({step:state.step,crossings:rows.length,byDominantJoint,rows,disagreements});save();
  }
  const zero=snapshots.find(s=>s.step===0),state=audit.states.find(s=>s.step===0),selected=state.rows.find(r=>Math.abs(r.winding)>1.5&&r.parity.every(p=>!p.ambiguous&&p.inside===false));
  const all=Array.from({length:zero.body.fullIndices.length/3},(_,i)=>face(zero.body,i));
  if(selected){const triangle=face(zero.band,selected.teeTriangle),centroid=[0,1,2].map(k=>triangle.vertices.reduce((s,v)=>s+v[k],0)*(1/3));report.disagreement={row:selected,triangle,centroid,recomputedWinding:winding(centroid,all),recomputedParity:directions.map(d=>rayParity(centroid,d,all))};assert.deepEqual(report.disagreement.recomputedParity,selected.parity);}
  else report.disagreement=null;
  const welded=[],byPosition=new Map();for(let i=0;i<rest.positions.length/3;i++){const key=rest.positions.slice(i*3,i*3+3).join(',');if(!byPosition.has(key))byPosition.set(key,byPosition.size);welded.push(byPosition.get(key));}report.neighbourExclusion={rule:'Any shared exact source-rest position, regardless of exported vertex ID',uniqueSourcePositions:byPosition.size,pairEvaluation:'All nonadjacent faces evaluated by the bound triangleDistance predicate; no additional AABB filter'};
  const targets=[...new Set([2215,...(selected?[selected.minimum.targetTriangle]:[])])];assert.ok(targets.length<=2);report.selectedBodyTriangles=targets;
  for(const id of targets){const a=all[id],own=new Set(a.indices.map(i=>welded[i])),row={triangle:a,descriptor:descriptor(id),excludedSharedVertex:0,comparedNonadjacent:0,pairs:[]};
    for(const b of all){if(b.indices.some(i=>own.has(welded[i]))){row.excludedSharedVertex++;continue;}row.comparedNonadjacent++;const distance=triangleDistance(a.vertices,b.vertices);if(distance.distance===0){const restA=face(rest,id),restB=face(rest,b.id);row.pairs.push({target:b,descriptor:descriptor(b.id),distance,sourceRestDistance:triangleDistance(restA.vertices,restB.vertices)});}}
    assert.equal(row.excludedSharedVertex+row.comparedNonadjacent,all.length);report.selfContact.push(row);save();
  }
  for(const[p,h]of Object.entries(pins))assert.equal(hashFile(path.join(ROOT,p)),h,p);report.status='observed';
}catch(error){report.status='failed';report.errors.push(error.stack);process.exitCode=1;}
finally{report.finished=new Date().toISOString();save();console.log(JSON.stringify({status:report.status,pid:process.pid,states:report.states.map(s=>({step:s.step,crossings:s.crossings,byDominantJoint:s.byDominantJoint,disagreements:s.disagreements.length})),selected:report.selectedBodyTriangles,selfContact:report.selfContact.map(s=>({bodyTriangle:s.triangle.id,pairs:s.pairs.length})),errors:report.errors}));}
