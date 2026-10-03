/** One finite vertex-edge authoring attempt on exact exported g050 topology. No GLB writer. */
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {Worker,isMainThread,parentPort} from 'node:worker_threads';
import {readGlb,readPrimitive,readAccessor,readMorphTargets} from '../lut-bake/glb.mjs';
import {SurfaceGrid,closestPointOnTriangle} from '../figure-pipeline/hair_geometry.mjs';
const out='captures/hair-surface-domain-2026-10-02-v1';
const base='docs/evidence/appearance-2026-10-02/front-design/';
const bodyFile='assets/figures/figure_g050.glb',hairFile='captures/bob-lower-fallback-v1/candidate.glb';
const pins={[bodyFile]:'b56115d0cb52edb72af7e725bf479d81253b660c298bd95ff9e89456d671ec14',
 [base+'boundary-landmarks.json']:'4df88cf6fda7f0633127b62cda3ad5ab0e2801acb8b5558437e1959af48b3bd8',
 [hairFile]:'8c458428551ca546d2aac511dec3b516067d53050de9663a563b9884a4ae5fe7'};
const sources=[...Object.keys(pins),base+'SURFACE-PLAN.md','tools/critic/author-hair-surface-domain.mjs','tools/lut-bake/glb.mjs','tools/figure-pipeline/hair_geometry.mjs'];
const hash=p=>createHash('sha256').update(fs.readFileSync(p)).digest('hex');
let context={stage:'not started',checks:[]};
if(isMainThread){
 if(fs.existsSync(out))throw new Error('Preserve first attempt; no retry.');
 const started=new Date().toISOString(),sourceHashes=Object.fromEntries(sources.map(p=>[p,hash(p)]));
 fs.mkdirSync(out,{recursive:true});
 for(const p of sources.filter(p=>!Object.hasOwn(pins,p))){const dest=out+'/sources/'+p;fs.mkdirSync(dest.slice(0,dest.lastIndexOf('/')),{recursive:true});fs.copyFileSync(p,dest,fs.constants.COPYFILE_EXCL);}
 console.log(JSON.stringify({pid:process.pid,started,out,sourceHashes}));
 let settled=false,latestCheckpoint=null;
 const finish=(result)=>{if(settled)return;settled=true;clearTimeout(timer);const sourcesUnchanged=sources.every(p=>hash(p)===sourceHashes[p]);
  const report={pid:process.pid,started,finished:new Date().toISOString(),sourceHashes,sourcesUnchanged,...result};
  if(!sourcesUnchanged)report.status='refused source drift';
  fs.writeFileSync(out+'/report.json',JSON.stringify(report,null,2)+'\n',{flag:'wx'});
  process.exitCode=report.status==='constructed domain pending images'?0:2;
  console.log(JSON.stringify({status:report.status,pid:process.pid,finished:report.finished,reportSha256:hash(out+'/report.json'),exitCode:process.exitCode}));};
 const worker=new Worker(new URL(import.meta.url));
 const timer=setTimeout(async()=>{finish({status:'refused sixty-second CPU bound',latestCheckpoint,limitMs:60000});await worker.terminate();},60000);
 worker.on('message',m=>m.kind==='checkpoint'?(latestCheckpoint=m.context):finish(m));
 worker.on('error',e=>finish({status:'refused instrument error',latestCheckpoint,error:e.stack}));
 worker.on('exit',code=>{if(!settled)finish({status:'refused worker without result',latestCheckpoint,workerExit:code});});
}else{
 try{parentPort.postMessage(construct());}catch(e){parentPort.postMessage({status:'refused instrument error',context,error:e.stack});}
}
function construct(){
 const checks=context.checks,add=(name,pass,witness)=>checks.push({name,pass,witness});
 const stop=reason=>({status:'refused '+reason,...context,limits:['One construction; no retry or tolerance changes.','No asset or appearance qualification. Unexecuted gates stay unexecuted.']});
 const checkpoint=stage=>{context.stage=stage;parentPort.postMessage({kind:'checkpoint',context});};
 for(const[p,h]of Object.entries(pins))add('exact source '+p,hash(p)===h,{expected:h,actual:hash(p)});
 if(checks.some(c=>!c.pass))return stop('input pin');
 const glb=readGlb(bodyFile),body=readPrimitive(glb,'base.001'),old=JSON.parse(fs.readFileSync(base+'boundary-landmarks.json'));
 const xyz=v=>Array.from(body.positions.slice(v*3,v*3+3)),distance=(a,b)=>Math.hypot(...a.map((x,k)=>x-b[k]));
 const map=new Map(),aliases=[],points=[],quotient=new Uint32Array(body.vertexCount);
 for(let v=0;v<body.vertexCount;v++){const p=xyz(v),key=p.join(',');let q=map.get(key);if(q===undefined){q=points.length;map.set(key,q);points.push(p);aliases.push([]);}quotient[v]=q;aliases[q].push(v);}
 const key=(a,b)=>a<b?a+','+b:b+','+a,faces=[],edges=new Map(),incident=points.map(()=>[]),neighbors=points.map(()=>new Set());
 const collapsed=[],zeroArea=[],duplicate=[],seenFace=new Map();
 for(let t=0;t<body.indices.length;t+=3){const face=Array.from(body.indices.slice(t,t+3),v=>quotient[v]);faces.push(face);const id=t/3;
  if(new Set(face).size!==3)collapsed.push({face:id,vertices:face});
  const[a,b,c]=face.map(v=>points[v]),u=b.map((x,k)=>x-a[k]),w=c.map((x,k)=>x-a[k]);
  if(Math.hypot(u[1]*w[2]-u[2]*w[1],u[2]*w[0]-u[0]*w[2],u[0]*w[1]-u[1]*w[0])===0)zeroArea.push({face:id,vertices:face});
  const fk=face.slice().sort((a,b)=>a-b).join(',');if(seenFace.has(fk))duplicate.push({face:id,previous:seenFace.get(fk),vertices:face});else seenFace.set(fk,id);
  for(const v of new Set(face))incident[v].push(id);
  for(let i=0;i<3;i++){const a=face[i],b=face[(i+1)%3],ek=key(a,b);if(!edges.has(ek))edges.set(ek,[]);edges.get(ek).push(id);neighbors[a].add(b);neighbors[b].add(a);}
 }
 const invalidEdges=[...edges].filter(([,f])=>f.length!==2).map(([edge,incidentFaces])=>({edge,incidentFaces}));
 add('no collapsed quotient faces',collapsed.length===0,collapsed);add('no zero-area quotient faces',zeroArea.length===0,zeroArea);add('no duplicate quotient faces',duplicate.length===0,duplicate);add('every quotient edge has two incident faces',invalidEdges.length===0,invalidEdges);
 const linkFailures=[];
 for(let v=0;v<points.length;v++){const link=new Map();for(const f of incident[v]){const other=faces[f].filter(x=>x!==v);if(other.length!==2)continue;for(let k=0;k<2;k++){if(!link.has(other[k]))link.set(other[k],new Set());link.get(other[k]).add(other[1-k]);}}
  const unseen=new Set(link.keys()),groups=[];while(unseen.size){const stack=[unseen.values().next().value];unseen.delete(stack[0]);let n=0;while(stack.length){const a=stack.pop();n++;for(const b of link.get(a)){if(unseen.delete(b))stack.push(b);}}groups.push(n);}
  const degrees=[...link].filter(([,n])=>n.size!==2).map(([vertex,n])=>({vertex,degree:n.size}));if(groups.length!==1||degrees.length)linkFailures.push({vertex:v,aliases:aliases[v],linkComponents:groups,degrees});
 }
 const unseen=new Set(points.map((_,i)=>i)),bodyComponents=[];while(unseen.size){const stack=[unseen.values().next().value];unseen.delete(stack[0]);let n=0;while(stack.length){const a=stack.pop();n++;for(const b of neighbors[a])if(unseen.delete(b))stack.push(b);}bodyComponents.push(n);}
 add('connected circular vertex links',linkFailures.length===0,linkFailures);add('one quotient body component',bodyComponents.length===1,bodyComponents);
 context.topology={exportedVertices:body.vertexCount,quotientVertices:points.length,faces:faces.length,edges:edges.size,euler:points.length-edges.size+faces.length,aliasGroups:aliases.filter(a=>a.length>1).length};
 checkpoint('global exact-position topology');if(checks.some(c=>!c.pass))return stop('global quotient topology');
 const grid=new SurfaceGrid(body.positions,body.normals,body.indices),project=wanted=>{const h=grid.nearest(wanted);if(!h)throw new Error('No body projection');const indices=Array.from(body.indices.slice(h.triangle,h.triangle+3)),r=closestPointOnTriangle(wanted,...indices.map(xyz));return{wanted,bodyTriangle:h.triangle/3,indices,bary:r.bary,restSurface:r.closest,projectionDistanceMm:distance(wanted,r.closest)*1000};};
 const primitive=glb.json.meshes.find(m=>m.name==='base.001').primitives[0],joints=readAccessor(glb,primitive.attributes.JOINTS_0).data,weights=readAccessor(glb,primitive.attributes.WEIGHTS_0).data,morphs=readMorphTargets(glb,'base.001');
 const fields=v=>{const w=Array.from(weights.slice(v*4,v*4+4)),l1=w.reduce((s,x)=>s+Math.abs(x),0);return{joints:Array.from(joints.slice(v*4,v*4+4)),weights:l1?w.map(x=>Math.fround(x/l1)):[1,0,0,0],morphs:[...morphs].map(([name,d])=>[name,Array.from(d.slice(v*3,v*3+3))])};};
 const checkedAliases=new Set(),aliasFailures=[];
 function checkAliases(q){if(checkedAliases.has(q))return;checkedAliases.add(q);const ref=JSON.stringify(fields(aliases[q][0]));for(const v of aliases[q].slice(1))if(JSON.stringify(fields(v))!==ref)aliasFailures.push({quotientVertex:q,aliases:aliases[q],different:v});}
 const closure=[[.078,1.552,.055],[.078,1.542,.005],[.057,1.527,-.055],[0,1.512,-.080],[-.057,1.527,-.055],[-.078,1.542,.005],[-.078,1.552,.055]];
 const orientations={};context.orientations=orientations;
 function shortest(start,end,segment){
  const allow=points.map(p=>p[1]>=1.485&&segmentDistance(p,...segment)<=.012),dist=new Float64Array(points.length).fill(Infinity),prev=new Int32Array(points.length).fill(-1),heap=[];
  const less=(a,b)=>a[0]<b[0]||(a[0]===b[0]&&a[1]<b[1]);
  const push=a=>{heap.push(a);let i=heap.length-1;while(i){const p=(i-1)>>1;if(!less(heap[i],heap[p]))break;[heap[i],heap[p]]=[heap[p],heap[i]];i=p;}};
  const pop=()=>{const r=heap[0],last=heap.pop();if(heap.length){heap[0]=last;let i=0;for(;;){let c=i*2+1;if(c>=heap.length)break;if(c+1<heap.length&&less(heap[c+1],heap[c]))c++;if(!less(heap[c],heap[i]))break;[heap[c],heap[i]]=[heap[i],heap[c]];i=c;}}return r;};
  if(!allow[start]||!allow[end])return null;dist[start]=0;push([0,start]);
  while(heap.length){const[d,v]=pop();if(d!==dist[v])continue;if(v===end)break;for(const n of [...neighbors[v]].sort((a,b)=>a-b)){if(!allow[n])continue;const nd=d+distance(points[v],points[n]);if(nd<dist[n]){dist[n]=nd;prev[n]=v;push([nd,n]);}}}
  if(!Number.isFinite(dist[end]))return null;const path=[end];while(path.at(-1)!==start){const p=prev[path.at(-1)];if(p<0)throw new Error('Broken path');path.push(p);}return{vertices:path.reverse(),lengthMm:dist[end]*1000,allowedVertices:allow.filter(Boolean).length};
 }
 for(const[name,sign]of [['A',1],['B',-1]]){
  const controls=[...old.orientations[name].opening,...closure.map(p=>project([p[0]*sign,p[1],p[2]]))].map((p,i)=>{const choices=p.indices.map(v=>({exportedVertex:v,q:quotient[v],distanceMm:distance(xyz(v),p.restSurface)*1000})).sort((a,b)=>a.distanceMm-b.distanceMm||a.exportedVertex-b.exportedVertex);return{...p,index:i,...choices[0],snapped:xyz(choices[0].exportedVertex)};});
  const record={controls,segments:[]};orientations[name]=record;
  add(name+' fixed projection and snap bounds',controls.every(p=>p.projectionDistanceMm<=20&&p.restSurface[1]>=1.485&&p.distanceMm<=8),controls.map(p=>({index:p.index,projectionDistanceMm:p.projectionDistanceMm,snapDistanceMm:p.distanceMm,y:p.restSurface[1],triangle:p.bodyTriangle,vertex:p.exportedVertex})));
  add(name+' distinct snapped controls',new Set(controls.map(p=>p.q)).size===controls.length,{vertices:controls.map(p=>p.q)});
  if(checks.some(c=>!c.pass))return stop('control bounds');
  let cycle=[];for(let i=0;i<controls.length;i++){const a=controls[i],b=controls[(i+1)%controls.length],path=shortest(a.q,b.q,[a.snapped,b.snapped]);record.segments.push({from:i,to:(i+1)%controls.length,path});if(!path){add(name+' reachable segment '+i,false,{a,b,corridorMm:12});return stop('fixed corridor unreachable');}cycle.push(...path.vertices.slice(0,-1));}
  record.cycle=cycle;add(name+' simple vertex cycle',cycle.length>=3&&new Set(cycle).size===cycle.length,{count:cycle.length,unique:new Set(cycle).size,repeated:cycle.filter((v,i)=>cycle.indexOf(v)!==i)});
  if(checks.some(c=>!c.pass))return stop('nonsimple cycle');
  const cut=new Set(cycle.map((v,i)=>key(v,cycle[(i+1)%cycle.length]))),dual=faces.map(()=>[]);for(const[k,[a,b]]of edges)if(!cut.has(k)){dual[a].push(b);dual[b].push(a);}
  const labels=new Int32Array(faces.length).fill(-1),components=[];for(let t=0;t<faces.length;t++)if(labels[t]===-1){const label=components.length,stack=[t],members=[];labels[t]=label;while(stack.length){const v=stack.pop();members.push(v);for(const n of dual[v])if(labels[n]===-1){labels[n]=label;stack.push(n);}}components.push(members.sort((a,b)=>a-b));}
  add(name+' cycle separates exactly two components',components.length===2,{sizes:components.map(x=>x.length)});if(checks.some(c=>!c.pass))return stop('nonseparating cycle');
  const cycleSet=new Set(cycle);
  const classify=(p,validateAliases=true)=>{const face=faces[p.bodyTriangle],active=face.filter((v,i)=>p.bary[i]>1e-10);let fs;if(active.length===1)fs=incident[active[0]];else if(active.length===2)fs=edges.get(key(...active));else fs=[p.bodyTriangle];if(validateAliases)for(const v of active)checkAliases(v);const roles=[...new Set(fs.map(f=>labels[f]))].sort();const onBoundary=active.length===1?cycleSet.has(active[0]):active.length===2?cut.has(key(...active)):false;return{...p,incidentFaces:fs,components:roles,onBoundary};};
  const crown=classify(project(xyz(942))),brows=[[-.009306550025939941,1.561933994293213,.1416451632976532],[.009306550025939941,1.5619341135025024,.1416451632976532]].map(p=>classify(project(p))),lower=classify(project([0,1.485,-.080]));
  const crownLabel=crown.components.length===1&&!crown.onBoundary?crown.components[0]:null;
  const part=old.orientations[name].part.slice(1).map((p,i)=>({partIndex:i+1,...classify(p)}));
  record.seeds={crown,brows,lower,part,crownLabel};
  add(name+' crown/face side seed consensus',crownLabel!==null&&[...brows,lower].every(p=>!p.onBoundary&&p.components.length===1&&p.components[0]!==crownLabel),record.seeds);
  add(name+' part1 through4 crown side or boundary',part.every(p=>p.onBoundary||(p.components.length===1&&p.components[0]===crownLabel)),part);
  cycle.forEach(checkAliases);add(name+' used exact-position aliases pose-coincident',aliasFailures.length===0,{checked:checkedAliases.size,morphTargets:morphs.size,failures:aliasFailures});
  if(checks.some(c=>!c.pass))return stop('side or pose alias predicates');
  record.crownFaces=components[crownLabel];record.faceSideFaces=components[1-crownLabel];record.cyclePositions=cycle.map(q=>points[q]);record.cycleExportedVertices=cycle.map(q=>aliases[q][0]);
  record.capObservations=[];const hair=readPrimitive(readGlb(hairFile),'hair_bob02');
  for(let v=0;v<652;v++){const p=Array.from(hair.positions.slice(v*3,v*3+3)),h=project(p),minimum=h.projectionDistanceMm/1000,ties=[];
   for(let t=0;t<faces.length;t++){const ids=Array.from(body.indices.slice(t*3,t*3+3)),r=closestPointOnTriangle(p,...ids.map(xyz));if(Math.abs(distance(p,r.closest)-minimum)<=1e-10)ties.push(classify({bodyTriangle:t,indices:ids,bary:r.bary,restSurface:r.closest},false));}
   record.capObservations.push({vertex:v,point:p,distanceMm:h.projectionDistanceMm,ties,roles:[...new Set(ties.flatMap(t=>t.components.map(c=>c===crownLabel?'crown':'outside')))],onBoundary:ties.some(t=>t.onBoundary)});
  }
  record.capSummary={crownOnly:record.capObservations.filter(x=>!x.onBoundary&&x.roles.length===1&&x.roles[0]==='crown').length,outsideOnly:record.capObservations.filter(x=>!x.onBoundary&&x.roles.length===1&&x.roles[0]==='outside').length,boundaryOrAmbiguous:record.capObservations.filter(x=>x.onBoundary||x.roles.length!==1).length};
  checkpoint('orientation '+name+' constructed');
 }
 return{status:'constructed domain pending images',...context,limits:['Vertex-edge artist boundary; original barycentric illustration is separate.','No cap opacity, groom, hairstyle or motion qualification.','No asset rewrite or runtime/interface release.']};
}
function segmentDistance(p,a,b){const d=b.map((x,k)=>x-a[k]),den=d.reduce((s,x)=>s+x*x,0),t=den?Math.max(0,Math.min(1,p.reduce((s,x,k)=>s+(x-a[k])*d[k],0)/den)):0;return Math.hypot(...p.map((x,k)=>x-a[k]-t*d[k]));}
