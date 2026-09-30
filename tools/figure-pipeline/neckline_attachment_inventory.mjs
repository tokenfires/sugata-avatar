// Read-only topological obstruction closure on accepted geometry in an exact saved pose.
import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';import {gunzipSync,gzipSync} from 'node:zlib';
import {ROOT,ACCEPTED_PATH,ACCEPTED_SHA256,hashFile,sha256} from './collar_replacement_manifest.mjs';
import {readGlb,readPrimitive,readAccessor} from '../lut-bake/glb.mjs';
import {compare,topology,winding,rayParity,segmentDistance,selftest} from './collar_clearance_review.mjs';
import {closestPointOnTriangle} from './hair_geometry.mjs';
const out=path.join(ROOT,'captures/neckline-attachment-2026-09-30-v1');assert.ok(!fs.existsSync(out));fs.mkdirSync(out,{recursive:true});
const sourceFiles=['tools/figure-pipeline/neckline_attachment_inventory.mjs','tools/figure-pipeline/collar_replacement_manifest.mjs','tools/lut-bake/glb.mjs','tools/figure-pipeline/collar_clearance_review.mjs','tools/figure-pipeline/hair_geometry.mjs','tools/figure-pipeline/hair_surface.mjs','docs/evidence/wardrobe-2026-09-30/neckline-attachment/PLAN.md'];
sourceFiles.push('tools/figure-pipeline/casual_trouser_fit.mjs','tools/figure-pipeline/casual_trouser_cuff.mjs','tools/figure-pipeline/hair_fall.mjs','packages/core/src/motion/HairDynamics.js','tools/critic/png.mjs','package.json','package-lock.json','node_modules/three/package.json','node_modules/three/build/three.module.js','node_modules/three/build/three.core.js','node_modules/three/build/three.tsl.js','node_modules/three/build/three.webgpu.js');
const inputs=['captures/neckline-shape-2026-09-30-v2/report.json','captures/neckline-shape-2026-09-30-v2/accepted-0-state.json.gz','captures/neckline-construction-2026-09-30-v1/report.json','captures/neutral-studio-2026-09-30-v2/report.json','captures/neutral-studio-2026-09-30-v2/feature-casual-portrait-neutral-state.json.gz','captures/neckline-boundary-check-2026-09-30-v1/report.json',ACCEPTED_PATH,'assets/figures/figure_g050.glb'];
const pins=Object.fromEntries([...sourceFiles,...inputs].map(p=>[p,hashFile(path.join(ROOT,p))]));
for(const p of sourceFiles){const dest=path.join(out,'source',p);fs.mkdirSync(path.dirname(dest),{recursive:true});fs.copyFileSync(path.join(ROOT,p),dest);}
const report={started:new Date().toISOString(),pid:process.pid,status:'running',pins,numericalGuardMetres:1e-6,iterations:[],classification:[],errors:[],limits:['One exact saved pose; floating-point predicates, not interval proof.','One monotone closure from the declared seed, not an exhaustive search for every possible cycle.','No connecting surface, opening coverage, appearance, motion or asset promotion qualification.']};
const save=()=>fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');save();
const point=(a,i)=>Array.from(a.slice(3*i,3*i+3)),sub=(a,b)=>a.map((v,k)=>v-b[k]),dot=(a,b)=>a.reduce((s,v,k)=>s+v*b[k],0),cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],dist=(a,b)=>Math.hypot(...sub(a,b)),bounds=v=>({min:[0,1,2].map(k=>Math.min(...v.map(p=>p[k]))),max:[0,1,2].map(k=>Math.max(...v.map(p=>p[k])))}),boxDistance2=(a,b)=>[0,1,2].reduce((s,k)=>s+Math.max(0,a.min[k]-b.max[k],b.min[k]-a.max[k])**2,0);
const directions=[[1,.371,.127],[-.217,1,.413],[.319,-.173,1],[1,-.731,.229],[-.617,.331,-1]];
const read=p=>JSON.parse(fs.readFileSync(path.join(ROOT,p))),snapshot=(p,row)=>{const bytes=fs.readFileSync(path.join(ROOT,p));assert.equal(sha256(bytes),row.compressedStateSHA256);const raw=gunzipSync(bytes);assert.equal(sha256(raw),row.stateSHA256);return JSON.parse(raw).snapshot;};
const triangles=m=>Array.from({length:m.indices.length/3},(_,id)=>{const ids=m.indices.slice(id*3,id*3+3),vertices=Array.from(ids,i=>point(m.positions,i));return{id,indices:Array.from(ids),vertices,...bounds(vertices)};});
function segmentTriangle(a,b,tri){
 let best={distance:Infinity};const keep=x=>{if(x.distance<best.distance)best=x;};
 for(const p of [a,b]){const q=closestPointOnTriangle(p,...tri).closest;keep({distance:dist(p,q),a:p,b:q,kind:'endpoint-face'});}
 for(let j=0;j<3;j++)keep({...segmentDistance(a,b,tri[j],tri[(j+1)%3]),kind:'edge-edge'});
 const d=sub(b,a),e1=sub(tri[1],tri[0]),e2=sub(tri[2],tri[0]),h=cross(d,e2),det=dot(e1,h);
 if(Math.abs(det)>1e-20){const s=sub(a,tri[0]),u=dot(s,h)/det,q=cross(s,e1),v=dot(d,q)/det,t=dot(e2,q)/det;if(u>=0&&v>=0&&u+v<=1&&t>=0&&t<=1){const p=a.map((x,k)=>x+t*d[k]);keep({distance:0,a:p,b:p,kind:'segment-face'});}}
 return best;
}
try{
 report.helperControls=selftest();
 const tri=[[0,0,0],[1,0,0],[0,1,0]];
 const controls=[
  ['transverse face crossing',[.2,.2,-1],[.2,.2,1],0],
  ['coplanar crossing',[-1,.2,0],[1,.2,0],0],
  ['parallel separation',[.2,.2,.003],[.3,.3,.003],.003],
  ['endpoint at face',[.2,.2,0],[.2,.2,1],0],
  ['outside nearest corner',[2,0,0],[3,0,0],1],
  ['zero length above face',[.2,.2,.004],[.2,.2,.004],.004]
 ];
 report.segmentControls=controls.map(([name,a,b,expected])=>{const result=segmentTriangle(a,b,tri);assert.ok(Math.abs(result.distance-expected)<1e-14);return{name,expected,...result};});
 assert.equal(hashFile(path.join(ROOT,ACCEPTED_PATH)),ACCEPTED_SHA256);
 const old=read(inputs[0]),current=read(inputs[3]),recipe=read(inputs[2]);assert.equal(old.status,'captured');assert.equal(current.status,'captured');assert.equal(recipe.inputSHA256,ACCEPTED_SHA256);
 const snap=snapshot(inputs[1],old.arms.find(r=>r.key==='accepted-0')),neutral=snapshot(inputs[4],current.arms.find(r=>r.key==='feature-casual-portrait-neutral'));
 const ids=['body','female_casualsuit01','foundation_bra','foundation_briefs'];for(const id of ids)assert.deepEqual(snap.meshes.find(m=>m.id===id),neutral.meshes.find(m=>m.id===id));assert.deepEqual(snap.rig,neutral.rig);report.currentCorrespondence={exactMeshes:ids,rigExact:true};
 const cloth=snap.meshes.find(m=>m.id==='female_casualsuit01'),body=snap.meshes.find(m=>m.id==='body'),glb=readGlb(path.join(ROOT,ACCEPTED_PATH)),p=readPrimitive(glb,'female_casualsuit01'),attributes=glb.json.meshes.find(m=>m.name==='female_casualsuit01').primitives[0].attributes;
 assert.deepEqual(cloth.fullIndices,Array.from(p.indices));const bodySource=readPrimitive(readGlb(path.join(ROOT,'assets/figures/figure_g050.glb')),'base.001');assert.deepEqual(body.fullIndices,Array.from(bodySource.indices));
 report.bodyTopology=topology({positions:body.positions,indices:body.fullIndices},bodySource.positions);assert.equal(report.bodyTopology.boundaryEdges,0);assert.equal(report.bodyTopology.nonmanifoldEdges,0);assert.equal(report.bodyTopology.orientationErrors,0);assert.equal(report.bodyTopology.components,1);assert.ok(report.bodyTopology.maxWeldSeparation<1e-7);
 const groups=[],lookup=new Map(),groupOf=[],joint=readAccessor(glb,attributes.JOINTS_0).data,weight=readAccessor(glb,attributes.WEIGHTS_0).data;
 for(let i=0;i<p.vertexCount;i++){const key=point(p.positions,i).map(v=>Math.round(v/1e-7)).join(':');if(!lookup.has(key)){lookup.set(key,groups.length);groups.push({id:groups.length,vertices:[],faces:new Set()});}const g=lookup.get(key);groupOf[i]=g;groups[g].vertices.push(i);}
 let maxWeldSeparation=0;for(const g of groups)for(const i of g.vertices){for(const a of [joint,weight])assert.deepEqual(a.slice(4*i,4*i+4),a.slice(4*g.vertices[0],4*g.vertices[0]+4));maxWeldSeparation=Math.max(maxWeldSeparation,dist(point(cloth.positions,i),point(cloth.positions,g.vertices[0])));}
 assert.ok(maxWeldSeparation<1e-7);const faces=triangles({positions:cloth.positions,indices:cloth.fullIndices}),edges=new Map();
 for(const f of faces){f.groups=f.indices.map(i=>groupOf[i]);assert.equal(new Set(f.groups).size,3);for(const g of f.groups)groups[g].faces.add(f.id);for(let k=0;k<3;k++){const a=f.groups[k],b=f.groups[(k+1)%3],key=[a,b].sort((a,b)=>a-b).join(':');if(!edges.has(key))edges.set(key,{key,a:Math.min(a,b),b:Math.max(a,b),uses:[]});edges.get(key).uses.push({face:f.id,a,b});}}
 for(const e of edges.values()){assert.ok(e.uses.length<=2);if(e.uses.length===2)assert.equal(e.uses[0].a,e.uses[1].b);}
 const adjacency=faces.map(()=>new Set());for(const e of edges.values())if(e.uses.length===2){const [a,b]=e.uses.map(u=>u.face);adjacency[a].add(b);adjacency[b].add(a);}
 const component=(seed,allowed=null)=>{const found=new Set([seed]),queue=[seed];for(let j=0;j<queue.length;j++)for(const k of adjacency[queue[j]])if((!allowed||allowed.has(k))&&!found.has(k)){found.add(k);queue.push(k);}return found;};
 const vertexLinks=faceSet=>{
  const links=new Map();
  for(const id of faceSet)for(let k=0;k<3;k++){
   const g=faces[id].groups[k],a=faces[id].groups[(k+1)%3],b=faces[id].groups[(k+2)%3];
   if(!links.has(g))links.set(g,[]);links.get(g).push([a,b]);
  }
  const failures=[];let paths=0,cycles=0;
  for(const [group,pairs]of links){
   const adjacent=new Map(),unique=new Set();let repeated=false;
   for(const [a,b]of pairs){const key=[a,b].sort((x,y)=>x-y).join(':');if(unique.has(key))repeated=true;unique.add(key);for(const [x,y]of [[a,b],[b,a]]){if(!adjacent.has(x))adjacent.set(x,new Set());adjacent.get(x).add(y);}}
   const queue=[adjacent.keys().next().value],visited=new Set(queue);
   for(let k=0;k<queue.length;k++)for(const n of adjacent.get(queue[k]))if(!visited.has(n)){visited.add(n);queue.push(n);}
   const degrees=[...adjacent.values()].map(n=>n.size),ends=degrees.filter(n=>n===1).length;
   const valid=!repeated&&visited.size===adjacent.size&&degrees.every(n=>n===1||n===2)&&(ends===0||ends===2);
   if(!valid)failures.push({group,pairs,repeated,componentsConnected:visited.size===adjacent.size,degrees});else if(ends===2)paths++;else cycles++;
  }
  return{vertices:links.size,paths,cycles,failures,pass:failures.length===0};
 };
 const neckGroups=new Set(recipe.rimGroups),neckEdges=[...edges.values()].filter(e=>e.uses.length===1&&neckGroups.has(e.a)&&neckGroups.has(e.b));assert.equal(neckEdges.length,20);assert.equal(neckGroups.size,20);
 const shirt=component(neckEdges[0].uses[0].face);assert.ok([...shirt].every(i=>faces[i].indices.every(v=>v<1427)));report.shirtVertexLinks=vertexLinks(shirt);assert.ok(report.shirtVertexLinks.pass);const otherOpenings=[...edges.values()].filter(e=>e.uses.length===1&&shirt.has(e.uses[0].face)&&!neckEdges.includes(e));
 const targets=[{id:'body',mesh:{positions:body.positions,indices:body.fullIndices},solid:true},...['foundation_bra','foundation_briefs'].map(id=>{const m=snap.meshes.find(m=>m.id===id);return{id,mesh:{positions:m.positions,indices:m.drawnIndices},solid:false};})];const bodyTris=triangles(targets[0].mesh);
 report.targets=targets.map(t=>({id:t.id,triangles:t.mesh.indices.length/3,solid:t.solid,applicability:t.mesh.indices.length?'nonempty':'empty',minimumDistance:t.mesh.indices.length?undefined:null}));
 const targetResult=(patch,t)=>t.mesh.indices.length?{id:t.id,solid:t.solid,applicability:'nonempty',result:compare(patch,t.mesh,{gridSteps:1,globalInside:t.solid})}:{id:t.id,solid:t.solid,applicability:'empty',triangleCount:0,minimumDistance:null};

 report.topology={rawVertices:p.vertexCount,weldedVertices:groups.length,maxWeldSeparation,shirtFaces:shirt.size,neckEdges:neckEdges.map(e=>e.key),nonNeckOpeningEdges:otherOpenings.map(e=>e.key)};
 const witnessPoint=point(cloth.positions,312),priorControl={vertex:312,world:witnessPoint,winding:winding(witnessPoint,bodyTris),parity:directions.map(d=>rayParity(witnessPoint,d,bodyTris))};assert.ok(Math.abs(priorControl.winding)>.5&&priorControl.parity.every(p=>!p.ambiguous&&p.inside));report.rejectionControl=priorControl;
 const region=new Set([...recipe.affected.map(f=>f.triangle),...groups[groupOf[312]].faces]);assert.equal(recipe.affected.length,234);assert.ok([...region].every(f=>shirt.has(f)));assert.equal(component([...region][0],region).size,region.size);assert.ok(neckEdges.every(e=>region.has(e.uses[0].face)));report.seedFaces=[...region].sort((a,b)=>a-b);
 const cache=new Map();
 const classify=ids=>{const unknown=ids.filter(i=>!cache.has(i)).sort((a,b)=>a-b);if(!unknown.length)return;const patch=unknown.map(i=>faces[i]),byTarget=targets.map(t=>targetResult(patch,t));for(let j=0;j<unknown.length;j++){const row={face:unknown[j],targets:{},admissible:true,reasons:[]};for(const t of byTarget){if(t.applicability==='empty'){row.targets[t.id]={applicability:'empty',triangleCount:0,minimumDistance:null};continue;}const r=t.result.rows[j];row.targets[t.id]=r;if(!(r.minimum.distance>report.numericalGuardMetres)){row.admissible=false;row.reasons.push(t.id+': crossing/contact/near contact');}if(t.solid&&!(Math.abs(r.winding)<.5&&r.parity.every(p=>!p.ambiguous&&p.inside===false))){row.admissible=false;row.reasons.push(t.id+': inside/ambiguous/inconsistent containment');}}cache.set(row.face,row);report.classification.push(row);}save();};
 let boundary,strip,boundaryGroups,termination;
 for(let iteration=0;iteration<=shirt.size;iteration++){
  if(otherOpenings.some(e=>region.has(e.uses[0].face))||region.size===shirt.size){termination='reached-non-neck-opening-or-exhausted-shirt';break;}
  boundary=[...edges.values()].filter(e=>e.uses.length===2&&e.uses.filter(u=>region.has(u.face)).length===1);boundaryGroups=new Set(boundary.flatMap(e=>[e.a,e.b]));strip=[...new Set([...boundaryGroups].flatMap(g=>[...groups[g].faces].filter(f=>!region.has(f))))].sort((a,b)=>a-b);classify(strip);
  const bad=strip.filter(f=>!cache.get(f).admissible),add=new Set();for(const f of bad){add.add(f);for(const g of faces[f].groups)if(boundaryGroups.has(g))for(const x of groups[g].faces)add.add(x);}for(const f of region)add.delete(f);
  report.iterations.push({iteration,regionFaces:region.size,boundaryEdges:boundary.length,stripFaces:strip.length,inadmissibleFaces:bad,addedFaces:[...add].sort((a,b)=>a-b)});save();console.log(`closure ${iteration}: ${region.size} faces, ${bad.length} obstructing retained faces, ${add.size} additions`);
  if(!bad.length){termination='clear-fixed-side-strip';break;}assert.ok(add.size>0);for(const f of add){assert.ok(shirt.has(f));region.add(f);}
 }
 report.termination=termination;report.regionFaces=[...region].sort((a,b)=>a-b);
 if(termination==='clear-fixed-side-strip'){
  const v=new Set([...region].flatMap(f=>faces[f].groups)),patchEdges=[...edges.values()].filter(e=>e.uses.some(u=>region.has(u.face))),degrees=new Map();for(const e of boundary)for(const g of [e.a,e.b]){if(!degrees.has(g))degrees.set(g,[]);degrees.get(g).push(g===e.a?e.b:e.a);}
  const allCycles=[];const unseen=new Set(degrees.keys());let simple=[...degrees.values()].every(n=>n.length===2);
  if(simple)while(unseen.size){const start=[...unseen].sort((a,b)=>a-b)[0],cycle=[start];let prev=null,current=start,closed=false;for(let n=0;n<=boundary.length;n++){unseen.delete(current);const next=degrees.get(current).find(g=>g!==prev);if(next===start){closed=true;break;}if(cycle.includes(next)){simple=false;break;}cycle.push(next);prev=current;current=next;}if(!closed)simple=false;allCycles.push(cycle);if(!simple)break;}
  const kept=new Set([...shirt].filter(f=>!region.has(f))),connected=component([...region][0],region).size===region.size,keptConnected=kept.size>0&&component([...kept][0],kept).size===kept.size,euler=v.size-patchEdges.length+region.size,originalPhysicalBoundary=patchEdges.filter(e=>e.uses.length===1);
  report.boundary={simple,cycles:allCycles,cycleCount:allCycles.length,euler,connected,keptConnected,neckOnlyPhysicalBoundary:originalPhysicalBoundary.length===20&&originalPhysicalBoundary.every(e=>neckEdges.includes(e)),vertex312Interior:!boundaryGroups.has(groupOf[312]),groups:[...boundaryGroups].sort((a,b)=>a-b).map(g=>({group:g,rawVertices:groups[g].vertices,joints:Array.from(joint.slice(groups[g].vertices[0]*4,groups[g].vertices[0]*4+4)),weights:Array.from(weight.slice(groups[g].vertices[0]*4,groups[g].vertices[0]*4+4)),world:point(cloth.positions,groups[g].vertices[0])})),edges:boundary.map(e=>({key:e.key,groups:[e.a,e.b],regionFace:e.uses.find(u=>region.has(u.face)).face,retainedFace:e.uses.find(u=>!region.has(u.face)).face})),retainedStripFaces:strip};
  report.regionVertexLinks=vertexLinks(region);report.retainedVertexLinks=vertexLinks(kept);
  report.admissibleCycle=report.regionVertexLinks.pass&&report.retainedVertexLinks.pass&&simple&&allCycles.length===1&&euler===0&&connected&&keptConnected&&report.boundary.neckOnlyPhysicalBoundary&&report.boundary.vertex312Interior;
  report.finalStripAudit=targets.map(t=>targetResult(strip.map(i=>faces[i]),t));
  report.edgeAudit=boundary.map(e=>{const a=point(cloth.positions,groups[e.a].vertices[0]),b=point(cloth.positions,groups[e.b].vertices[0]),mid=a.map((x,k)=>(x+b[k])/2),edgeBox=bounds([a,b]);return{edge:e.key,targets:targets.map(t=>{if(!t.mesh.indices.length)return{id:t.id,applicability:'empty',triangleCount:0,distance:null};let best={distance:Infinity};for(const tri of triangles(t.mesh)){if(boxDistance2(edgeBox,tri)>best.distance**2)continue;const r=segmentTriangle(a,b,tri.vertices);if(r.distance<best.distance)best={...r,targetTriangle:tri.id};}return{id:t.id,applicability:'nonempty',...best};}),bodyMidpointWinding:winding(mid,bodyTris),bodyMidpointParity:directions.map(d=>rayParity(mid,d,bodyTris))};});
  for(const e of report.edgeAudit)if(e.targets.some(t=>t.applicability!=='empty'&&!(t.distance>report.numericalGuardMetres))||!(Math.abs(e.bodyMidpointWinding)<.5&&e.bodyMidpointParity.every(r=>!r.ambiguous&&!r.inside)))report.admissibleCycle=false;
  for(const t of report.finalStripAudit)for(const r of t.result?.rows??[])if(!(r.minimum.distance>report.numericalGuardMetres)||(t.id==='body'&&!(Math.abs(r.winding)<.5&&r.parity.every(p=>!p.ambiguous&&p.inside===false))))report.admissibleCycle=false;
 }else report.admissibleCycle=false;
 report.status=report.admissibleCycle?'admissible-boundary-in-recorded-pose':'no-admissible-cycle-under-declared-closure';
 for(const[p,h]of Object.entries(pins))assert.equal(hashFile(path.join(ROOT,p)),h);fs.writeFileSync(path.join(out,'snapshot.json.gz'),gzipSync(Buffer.from(JSON.stringify(snap)+'\n')));report.savedSnapshotSHA256=hashFile(path.join(out,'snapshot.json.gz'));
}catch(e){report.status='failed';report.errors.push(e.stack);throw e;}finally{report.finished=new Date().toISOString();save();}
console.log(JSON.stringify({status:report.status,iterations:report.iterations.length,classifiedFaces:report.classification.length,regionFaces:report.regionFaces?.length,boundaryEdges:report.boundary?.edges.length,reportSHA256:hashFile(path.join(out,'report.json'))}));
