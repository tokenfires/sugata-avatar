/** One literal CPU tessellation and refusal gate; no accepted assets or renderer. */
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {BufferGeometry,BufferAttribute} from 'three';
import {readGlb,readPrimitive} from '../../../../tools/lut-bake/glb.mjs';
import {intersectTriangles,measureHairSurface} from '../../../../tools/figure-pipeline/hair_surface.mjs';
import {Worker,isMainThread,threadId} from 'node:worker_threads';
function execute(){
const packet='docs/evidence/nonhair-2026-10-03/fixed-fan-volume';
const input='docs/evidence/nonhair-2026-10-03/shared-boundary-interface/interface.json';
const topologyPath='docs/evidence/nonhair-2026-10-03/cell-fan-contract/topology.json';
const sha=x=>createHash('sha256').update(x).digest('hex'),hash=p=>sha(fs.readFileSync(p));
const started=new Date().toISOString(),cpuStop=Math.min(Date.now()+120000,Date.parse('2026-10-03T19:43:00Z'));
assert.ok(Date.now()<Date.parse('2026-10-03T19:41:00Z'),'Builder admission cutoff');
assert.ok(!fs.existsSync(packet+'/mesh.json'),'One proposal only');
const pins={[topologyPath]:'c057cc38b0e6cca4eb6d1d955f31b4b5263daf01260bfb65a21c218e93b4eeeb',[input]:'e734947c8e594b7396bf5f4359c0979b569d9ead92554a9b9a3d656b69248c2c','assets/figures/figure_g050.glb':'b56115d0cb52edb72af7e725bf479d81253b660c298bd95ff9e89456d671ec14','tools/figure-pipeline/hair_surface.mjs':'9afeedd9d9c120d1d6abb8c0dcaf98bc940269227b9c1451e461a39414a85794'};
for(const[p,h]of Object.entries(pins))assert.equal(hash(p),h,p);
for(const p of [packet+'/build.mjs',packet+'/preview.mjs',packet+'/preview.html',packet+'/world-gate-worker.mjs','tools/critic/fixed-fan-volume.mjs',packet+'/PLAN.md',packet+'/CRITIC-VALUE.md',packet+'/CRITIC-SOURCE.md','tools/lut-bake/glb.mjs','node_modules/three/package.json','node_modules/three/build/three.module.js','node_modules/three/build/three.core.js','node_modules/three/build/three.webgpu.js'])pins[p]=hash(p);
const net=JSON.parse(fs.readFileSync(input)),topology=JSON.parse(fs.readFileSync(topologyPath)),N=10,EPS=1e-9,keys=topology.vertices.map(v=>v.key),edgeCache=topology.canonicalEdgeCache,patchRows=topology.patches;
const patches=new Map(Object.values(net.panels).flatMap(panel=>panel.patches).map(q=>[q.id,q]));
let P,I;
const report={pid:process.pid,threadId,command:'node '+packet+'/build.mjs (sole supervised CPU worker)',started,pins,status:'building',checks:[],limits:['Static raw POSITION proposal only; artist controls unchanged.','Shared-vertex triangle pairs omitted from self-crossing predicate; adjacent fold/regularity and containment remain unqualified.','Existing floating-point prism predicate epsilon1e-9m includes boundary/coplanar contacts; no exact arithmetic or positive clearance guarantee.','No native images, fit/motion/fibre/material or AAA qualification.']};
const limit=()=>assert.ok(Date.now()<cpuStop,'Two-minute CPU stop; no retry');
const curve=(e,t)=>{if(t===0)return net.nodes[e.endpoints[0]];if(t===1)return net.nodes[e.endpoints[1]];const a=net.nodes[e.endpoints[0]],b=net.nodes[e.endpoints[1]],h=[2*t**3-3*t*t+1,-2*t**3+3*t*t,t**3-2*t*t+t,t**3-t*t];return a.map((v,k)=>h[0]*v+h[1]*b[k]+h[2]*e.M0[k]+h[3]*e.M1[k]);};
const sample=(ref,t)=>curve(net.edges[ref.id],ref.orientation===1?t:1-t);
function surface(q,u,v){const s=sample(q.south,u),n=sample(q.north,u),w=sample(q.west,v),e=sample(q.east,v),c=q.corners;return s.map((x,k)=>(1-v)*x+v*n[k]+(1-u)*w[k]+u*e[k]-((1-u)*(1-v)*net.nodes[c.P00][k]+u*(1-v)*net.nodes[c.P10][k]+(1-u)*v*net.nodes[c.P01][k]+u*v*net.nodes[c.P11][k]));}
const point=i=>Array.from(P.slice(i*3,i*3+3));
const sub=(a,b)=>a.map((x,k)=>x-b[k]),cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const check=(name,pass,witness={})=>{report.checks.push({name,pass,witness});if(!pass)throw Error(name);};
let geometry;
function binary(name,array){const bytes=Buffer.alloc(array.length*4);array.forEach((x,i)=>name.endsWith('.u32')?bytes.writeUInt32LE(x,i*4):bytes.writeFloatLE(x,i*4));fs.writeFileSync(packet+'/'+name,bytes,{flag:'wx'});return{name,sha256:sha(bytes),bytes:bytes.length};}
try{
 check('exact symbolic source instance',topology.sourceInterface.path===input&&topology.sourceInterface.sha256===pins[input]&&topology.N===N&&topology.vertices.length===8091&&topology.faces.length===16000);
 const positions=[];report.evaluations={canonicalNode:0,canonicalCurve:0,CoonsPatch:0,CoonsCellCentre:0};
 for(let id=0;id<topology.vertices.length;id++){
  limit();const record=topology.vertices[id],e=record.evaluation;let value;
  if(e.kind==='canonicalNode')value=net.nodes[e.node];
  else if(e.kind==='canonicalCurve')value=curve(net.edges[e.edge],e.t[0]/e.t[1]);
  else if(e.kind==='CoonsPatch'||e.kind==='CoonsCellCentre')value=surface(patches.get(e.patch),e.u[0]/e.u[1],e.v[0]/e.v[1]);
  else throw Error('Unknown symbolic evaluator: '+e.kind);
  check('finite Float64 evaluation '+id,value?.length===3&&value.every(Number.isFinite),{id,key:record.key,evaluation:e,value});
  positions.push(...value);report.evaluations[e.kind]++;
 }
 P=new Float32Array(positions);I=new Uint32Array(topology.faces.flat());
 check('fixed exact cache/grid/centre size',P.length/3===8091&&I.length/3===16000&&keys.length===8091,{vertices:P.length/3,triangles:I.length/3,nodes:Object.keys(net.nodes).length,curves:Object.keys(edgeCache).length,patches:patchRows.length,centres:report.evaluations.CoonsCellCentre});
 check('exact declared integer faces',topology.faces.every(f=>f.length===3&&f.every(Number.isInteger))&&topology.faces.every((f,t)=>f.every((v,k)=>v===I[t*3+k])));

 check('finite Float32 positions',Array.from(P).every(Number.isFinite));
 const edgeUses=new Map(),triangles=[],triKeys=new Set(),vertexAdj=Array.from({length:P.length/3},()=>new Set());let minimumArea=Infinity,minWitness;
 for(let t=0;t<I.length;t+=3){limit();const ids=Array.from(I.slice(t,t+3)),v=ids.map(point);check('triangle index/distinct '+t/3,ids.every(x=>x<P.length/3)&&new Set(ids).size===3);
  const a=Math.hypot(...cross(sub(v[1],v[0]),sub(v[2],v[0])));if(a<minimumArea){minimumArea=a;minWitness={triangle:t/3,ids,vertices:v,doubleArea:a};}check('nondegenerate triangle '+t/3,a>1e-12,{triangle:t/3,ids,keys:ids.map(i=>keys[i]),vertices:v,doubleArea:a});
  const tk=[...ids].sort((a,b)=>a-b).join(':');check('unique triangle '+t/3,!triKeys.has(tk));triKeys.add(tk);
  for(let k=0;k<3;k++){const a=ids[k],b=ids[(k+1)%3],key=[a,b].sort((a,b)=>a-b).join(':');if(!edgeUses.has(key))edgeUses.set(key,[]);edgeUses.get(key).push([a,b,t/3]);vertexAdj[a].add(b);vertexAdj[b].add(a);}
  triangles.push({id:t/3,ids,v,min:[0,1,2].map(k=>Math.min(...v.map(p=>p[k]))),max:[0,1,2].map(k=>Math.max(...v.map(p=>p[k])))});
 }
 report.minimumDoubleArea=minWitness;
 const outer=[],boundaryAdj=new Map();for(const[key,use]of edgeUses){check('oriented manifold '+key,use.length===1||(use.length===2&&use[0][0]===use[1][1]&&use[0][1]===use[1][0]),{key,use});if(use.length===1){outer.push(use[0]);const[a,b]=use[0];for(const[x,y]of[[a,b],[b,a]]){if(!boundaryAdj.has(x))boundaryAdj.set(x,new Set());boundaryAdj.get(x).add(y);}}}
 const reach=(start,adj)=>{const seen=new Set(),todo=[start];while(todo.length){const n=todo.pop();if(seen.has(n))continue;seen.add(n);todo.push(...adj[n]??adj.get(n));}return seen;};
 check('connected disk and one180edge boundary',P.length/3-edgeUses.size+I.length/3===1&&outer.length===180&&boundaryAdj.size===180&&[...boundaryAdj.values()].every(a=>a.size===2)&&reach(0,vertexAdj).size===P.length/3&&reach(outer[0][0],boundaryAdj).size===180,{vertices:P.length/3,edges:edgeUses.size,faces:I.length/3,outerEdges:outer.length});
 geometry=new BufferGeometry();report.geometryUUID=geometry.uuid;report.geometryDisposalEvents=[];geometry.addEventListener('dispose',()=>report.geometryDisposalEvents.push({uuid:geometry.uuid,observed:new Date().toISOString()}));geometry.setAttribute('position',new BufferAttribute(P,3));geometry.setIndex(new BufferAttribute(I,1));geometry.computeVertexNormals();const normals=geometry.attributes.normal.array;
 check('finite nonzero area-weighted normals',Array.from(normals).every(Number.isFinite)&&Array.from({length:P.length/3},(_,i)=>Math.hypot(...normals.slice(i*3,i*3+3))).every(n=>Math.abs(n-1)<1e-5));
 report.buffers=[binary('positions.f32',P),binary('indices.u32',I),binary('normals.f32',normals)];
 fs.writeFileSync(packet+'/mesh.json',JSON.stringify({vertices:P.length/3,triangles:I.length/3,subdivisions:N,interfaceSHA256:pins[input],topologySHA256:pins[topologyPath],pointDefinitions:topology.vertices,buffers:report.buffers,keys,edgeCache,patches:patchRows},null,2)+'\n',{flag:'wx'});report.meshSHA256=hash(packet+'/mesh.json');
 const ordered=[...triangles].sort((a,b)=>a.min[0]-b.min[0]);let tested=0,omittedAdjacent=0;
 for(let i=0;i<ordered.length;i++){limit();const a=ordered[i];for(let j=i+1;j<ordered.length&&ordered[j].min[0]<=a.max[0]+EPS;j++){const b=ordered[j];if(a.min.some((x,k)=>x>b.max[k]+EPS||a.max[k]<b.min[k]-EPS))continue;if(a.ids.some(id=>b.ids.includes(id))){omittedAdjacent++;continue;}tested++;const h=intersectTriangles(a.v,b.v,EPS);check('nonadjacent self-crossing',!h,{a:a.id,b:b.id,aIDs:a.ids,bIDs:b.ids,aVertices:a.v,bVertices:b.v,intersection:h});}}
 report.selfPairs={tested,omittedAdjacent,pass:true};
 const body=readPrimitive(readGlb('assets/figures/figure_g050.glb'),'base.001'),all={min:[-Infinity,-Infinity,-Infinity],max:[Infinity,Infinity,Infinity]};
 report.rawBodyCrossings=measureHairSurface({positions:P,indices:I},body,{headBounds:all,faceBounds:all,epsilon:EPS,exampleLimit:10});limit();
 check('all raw body triangle crossings zero',report.rawBodyCrossings.head.pairs===0,report.rawBodyCrossings.head);
 report.status='CPU passed; native/appearance not admitted by this result';
}catch(e){report.status='refused';report.error=e.stack??String(e);process.exitCode=2;}
finally{if(geometry)geometry.dispose();for(const[p,h]of Object.entries(pins))assert.equal(hash(p),h,p);report.finished=new Date().toISOString();report.geometryCreated=!!geometry;report.geometryDisposed=!!geometry&&report.geometryDisposalEvents.length===1&&report.geometryDisposalEvents[0].uuid===geometry.uuid;report.outputHashes=Object.fromEntries(['mesh.json','positions.f32','indices.u32','normals.f32'].filter(n=>fs.existsSync(packet+'/'+n)).map(n=>[n,hash(packet+'/'+n)]));fs.writeFileSync(packet+'/BUILD-RECEIPT.json',JSON.stringify(report,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify({pid:process.pid,started,finished:report.finished,status:report.status,error:report.error,vertices:P?.length/3||0,triangles:I?.length/3||0,reportSHA256:hash(packet+'/BUILD-RECEIPT.json')}));}
}
if(!isMainThread)execute();
else{
 const p='docs/evidence/nonhair-2026-10-03/fixed-fan-volume',receipt=p+'/SUPERVISOR-RECEIPT.json';
 const r={pid:process.pid,command:'node '+p+'/build.mjs',started:new Date().toISOString(),sourceSHA256:createHash('sha256').update(fs.readFileSync(new URL(import.meta.url))).digest('hex'),status:'pending CPU worker',timedOut:false,errors:[],limits:['One CPU-only worker, no native/GPU job. Forced worker retirement cannot attest an inner geometry disposal event.']};
 assert.ok(!fs.existsSync(receipt),'Preserve sole supervisor receipt');
 const save=()=>fs.writeFileSync(receipt,JSON.stringify(r,null,2)+'\n');save();
 let worker,timer;
 try{
  assert.ok(Date.now()<Date.parse('2026-10-03T19:41:00Z'),'Builder admission cutoff');
  worker=new Worker(new URL(import.meta.url));r.workerThreadId=worker.threadId;r.status='CPU worker active';save();
  timer=setTimeout(()=>{r.timedOut=true;r.status='CPU time limit; terminating owned worker';save();worker.terminate().catch(e=>{r.errors.push(e.stack??String(e));save();});},Math.max(1,Math.min(120000,Date.parse('2026-10-03T19:43:00Z')-Date.now())));
  worker.on('error',e=>{r.errors.push(e.stack??String(e));save();});
  worker.on('exit',code=>{clearTimeout(timer);r.workerExitCode=code;r.workerRetired=true;r.finished=new Date().toISOString();try{r.innerReceipt=fs.existsSync(p+'/BUILD-RECEIPT.json')?createHash('sha256').update(fs.readFileSync(p+'/BUILD-RECEIPT.json')).digest('hex'):null;const inner=r.innerReceipt?JSON.parse(fs.readFileSync(p+'/BUILD-RECEIPT.json')):null;r.pass=!r.timedOut&&r.errors.length===0&&code===0&&inner?.status==='CPU passed; native/appearance not admitted by this result';}catch(e){r.errors.push(e.stack??String(e));r.pass=false;}r.status=r.pass?'CPU worker passed; retired':'refused; CPU worker retired';save();if(!r.pass)process.exitCode=2;console.log(JSON.stringify(r));});
 }catch(e){clearTimeout(timer);r.errors.push(e.stack??String(e));r.pass=false;r.status='refused before worker admission';r.finished=new Date().toISOString();save();process.exitCode=2;console.log(JSON.stringify(r));}
}
