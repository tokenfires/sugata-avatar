import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const dir=path.dirname(fileURLToPath(import.meta.url));
const input=path.resolve(dir,'../knit-upstream-source/original-fisherman.obj');
const expected='2844465f4e798666a90f631ea4a89ae30d3e526ef045a978d338908750d21d09';
const deadline=Date.parse('2026-10-04T11:45:00Z');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const job={started:new Date().toISOString(),pid:process.pid,command:'node docs/evidence/appearance-2026-10-04/knit-original-control/inventory.mjs',stage:'entry',inputs:{},outputs:[],failure:null};
let vertices=[],uvs=[],normals=[],faces=[],statements=[],comments=[],triangles=[],triangleMap=[];
const fail=(reason,witness={})=>{const e=new Error(reason);e.witness=witness;throw e;};
const assert=(ok,reason,witness)=>{if(!ok)fail(reason,witness);};
const checkTime=()=>assert(Date.now()<deadline,'absolute deadline reached',{now:new Date().toISOString()});
try{
  checkTime();
  for(const name of ['PLAN.md','WORTH.md','inventory.mjs']){job.inputs[name]=sha(fs.readFileSync(path.join(dir,name)));}
  for(const name of ['INVENTORY.json','preview.json','INVENTORY-JOB.json'])assert(!fs.existsSync(path.join(dir,name)),'output already exists',{name});
  const bytes=fs.readFileSync(input);job.inputs.original={path:input,bytes:bytes.length,sha256:sha(bytes)};
  assert(bytes.length===172798 && sha(bytes)===expected,'original bytes differ',job.inputs.original);
  job.stage='strict original decoding';
  const text=new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(bytes);
  let group=[],object=null,material=null,smoothing=null;
  const finite=(tokens,count,line)=>{assert(tokens.length===count,'unsupported numeric arity',{line,tokens,count});const a=tokens.map(Number);assert(a.every(Number.isFinite),'non-finite numeric value',{line,tokens});return a;};
  const idx=(raw,length,line,type)=>{assert(/^-?\d+$/.test(raw),'invalid index spelling',{line,type,raw});const n=Number(raw);assert(Number.isSafeInteger(n)&&n!==0,'invalid index',{line,type,raw});const resolved=n>0?n-1:length+n;assert(resolved>=0&&resolved<length,'unresolved index',{line,type,raw,length,resolved});return resolved;};
  for(const [ordinal,raw] of text.split(/\r?\n/).entries()){
    const line=ordinal+1;const c=raw.indexOf('#');if(c>=0)comments.push({line,text:raw.slice(c+1)});
    const code=(c>=0?raw.slice(0,c):raw).trim();if(!code)continue;
    const [op,...tokens]=code.split(/\s+/);
    if(op==='v'){
      assert(tokens.length===3||tokens.length===4,'unsupported vertex arity',{line,tokens});
      const a=finite(tokens,tokens.length,line);assert(a.length===3||a[3]===1,'non-unit homogeneous vertex',{line,a});vertices.push(a.slice(0,3));
    }else if(op==='vt'){
      assert(tokens.length>=1&&tokens.length<=3,'unsupported UV arity',{line,tokens});uvs.push(finite(tokens,tokens.length,line));
    }else if(op==='vn')normals.push(finite(tokens,3,line));
    else if(op==='f'){
      assert(tokens.length>=3,'face has fewer than three corners',{line,tokens});
      const corners=tokens.map(rawCorner=>{const parts=rawCorner.split('/');assert(parts.length>=1&&parts.length<=3&&parts[0],'invalid corner',{line,rawCorner});return {raw:rawCorner,v:idx(parts[0],vertices.length,line,'v'),vt:parts.length>1&&parts[1]?idx(parts[1],uvs.length,line,'vt'):null,vn:parts.length>2&&parts[2]?idx(parts[2],normals.length,line,'vn'):null};});
      assert(new Set(corners.map(c=>c.v)).size===corners.length,'repeated original face vertex',{line,corners});
      faces.push({ordinal:faces.length,line,corners,group:[...group],object,material,smoothing});
    }else if(['g','o','mtllib','usemtl','s'].includes(op)){
      statements.push({line,op,tokens});if(op==='g')group=tokens;if(op==='o')object=tokens.join(' ');if(op==='usemtl')material=tokens.join(' ');if(op==='s')smoothing=tokens.join(' ');
    }else fail('unsupported original directive',{line,op,tokens});
  }
  assert(vertices.length>0&&faces.length>0,'empty original geometry');
  job.stage='original polygon topology and fixed fan representation';
  const edges=new Map(),links=new Map(),used=new Set();
  const edgeKey=(a,b)=>a<b?`${a}:${b}`:`${b}:${a}`;
  const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
  const sub=(a,b)=>a.map((n,i)=>n-b[i]);
  let minTwiceArea=Infinity,minTriangle=null;
  for(const f of faces){
    const n=f.corners.length;
    for(let i=0;i<n;i++){
      const a=f.corners[i].v,b=f.corners[(i+1)%n].v,prev=f.corners[(i+n-1)%n].v;
      used.add(a);const key=edgeKey(a,b);if(!edges.has(key))edges.set(key,[]);edges.get(key).push({face:f.ordinal,line:f.line,corner:i,a,b});
      if(!links.has(a))links.set(a,[]);links.get(a).push({face:f.ordinal,prev,next:b});
    }
    let firstNormal=null;
    for(let i=1;i<n-1;i++){
      const cornerOrdinals=[0,i,i+1],indices=cornerOrdinals.map(j=>f.corners[j].v),points=indices.map(j=>vertices[j]);
      const normal=cross(sub(points[1],points[0]),sub(points[2],points[0]));const area=Math.hypot(...normal);
      const witness={face:f.ordinal,line:f.line,cornerOrdinals,indices,points,cross:normal,twiceArea:area};
      assert(Number.isFinite(area)&&area>0,'degenerate fixed fan triangle',witness);
      if(firstNormal){const dot=normal.reduce((s,x,j)=>s+x*firstNormal[j],0);assert(dot>0,'ambiguous fan orientation within original polygon',{...witness,firstNormal,dot});}else firstNormal=normal;
      if(area<minTwiceArea){minTwiceArea=area;minTriangle=witness;}
      triangles.push(indices);triangleMap.push({face:f.ordinal,line:f.line,cornerOrdinals});
    }
  }
  const edgeIssues=[],boundary=[];
  for(const [key,incidents] of edges){if(incidents.length>2)edgeIssues.push({key,reason:'more than two incident faces',incidents});else if(incidents.length===2&&!(incidents[0].a===incidents[1].b&&incidents[0].b===incidents[1].a))edgeIssues.push({key,reason:'original directed edge winding conflict',incidents});else if(incidents.length===1)boundary.push(incidents[0]);}
  const boundaryAdj=new Map();for(const e of boundary)for(const [v,neighbor]of[[e.a,e.b],[e.b,e.a]]){if(!boundaryAdj.has(v))boundaryAdj.set(v,[]);boundaryAdj.get(v).push(neighbor);}
  const boundaryIssues=[...boundaryAdj].filter(([,ns])=>ns.length!==2).map(([vertex,neighbors])=>({vertex,neighbors}));
  const walkSet=(start,adj)=>{const seen=new Set([start]),queue=[start];for(let k=0;k<queue.length;k++)for(const next of adj.get(queue[k])??[])if(!seen.has(next)){seen.add(next);queue.push(next);}return seen;};
  const boundaryLoops=[];if(!boundaryIssues.length){const done=new Set();for(const start of boundaryAdj.keys())if(!done.has(start)){const loop=[],seen=new Set();let prev=null,v=start;do{assert(!seen.has(v),'boundary traversal repeats non-start',{start,v,loop});seen.add(v);done.add(v);loop.push(v);const ns=boundaryAdj.get(v);const next=ns[0]===prev?ns[1]:ns[0];prev=v;v=next;}while(v!==start);boundaryLoops.push(loop);}}
  const vertexLinkIssues=[];
  for(const [vertex,pairs]of links){
    const adj=new Map();for(const p of pairs)for(const [v,next]of[[p.prev,p.next],[p.next,p.prev]]){if(!adj.has(v))adj.set(v,[]);adj.get(v).push(next);}
    const degrees=[...adj].map(([v,ns])=>({vertex:v,degree:ns.length}));const connected=walkSet(adj.keys().next().value,adj).size===adj.size;
    const ends=degrees.filter(d=>d.degree===1).length;const boundaryVertex=boundaryAdj.has(vertex);
    const okay=connected&&degrees.every(d=>d.degree===2||(boundaryVertex&&d.degree===1))&&ends===(boundaryVertex?2:0);
    if(!okay)vertexLinkIssues.push({vertex,boundaryVertex,connected,degrees,pairs});
  }
  const faceAdj=new Map();for(const f of faces)faceAdj.set(f.ordinal,[]);for(const incidents of edges.values())for(const a of incidents)for(const b of incidents)if(a.face!==b.face)faceAdj.get(a.face).push(b.face);
  const components=[],seenFaces=new Set();for(const f of faces)if(!seenFaces.has(f.ordinal)){const set=walkSet(f.ordinal,faceAdj);for(const j of set)seenFaces.add(j);components.push([...set]);}
  const bounds={min:[0,1,2].map(i=>Math.min(...vertices.map(v=>v[i]))),max:[0,1,2].map(i=>Math.max(...vertices.map(v=>v[i]))),units:'unknown original source units; no metric/body correspondence'};
  const topology={usedVertices:used.size,unusedVertexOrdinals:vertices.map((_,i)=>i).filter(i=>!used.has(i)),edges:edges.size,polygons:faces.length,triangles:triangles.length,euler:used.size-edges.size+faces.length,components,boundaryLoops,boundaryEdges:boundary.length,edgeIssues,boundaryIssues,vertexLinkIssues,minTwiceArea,minTriangle};
  const coherent=components.length===1&&!edgeIssues.length&&!boundaryIssues.length&&!vertexLinkIssues.length;
  const report={original:job.inputs.original,counts:{vertices:vertices.length,uvs:uvs.length,normals:normals.length,faces:faces.length},bounds,comments,statements,topology,structuralControlEligible:coherent,limits:'Source topology eligibility only. Actual views must decide garment interface/complete-shape usability. No license chain, metric scale, fit, contact, mapping, materials, original normals or motion qualification.'};
  checkTime();job.stage='record original topology';
  const reportBytes=Buffer.from(JSON.stringify(report,null,2)+'\n');fs.writeFileSync(path.join(dir,'INVENTORY.json'),reportBytes);job.outputs.push({file:'INVENTORY.json',bytes:reportBytes.length,sha256:sha(reportBytes)});
  assert(coherent,'original structure withheld from native control',{components:components.length,edgeIssues,boundaryIssues,vertexLinkIssues});
  const preview={original:job.inputs.original,inventorySha256:sha(reportBytes),vertices,uvs,normals,faces,triangles,triangleMap,representation:'Exact original positions/corner references/winding; fixed corner-0 fan, no weld/repair/reindex/shape edit. All original vertices retained. Clay display normals separately labelled.'};
  const previewBytes=Buffer.from(JSON.stringify(preview)+'\n');checkTime();job.stage='write isolated read-only representation';fs.writeFileSync(path.join(dir,'preview.json'),previewBytes);job.outputs.push({file:'preview.json',bytes:previewBytes.length,sha256:sha(previewBytes)});job.stage='complete';
}catch(e){job.failure={message:e.message,witness:e.witness??null};process.exitCode=1;}
finally{job.ended=new Date().toISOString();job.countsAtStop={vertices:vertices.length,uvs:uvs.length,normals:normals.length,faces:faces.length,triangles:triangles.length};job.actualOutputs=fs.readdirSync(dir).filter(n=>['INVENTORY.json','preview.json'].includes(n)).map(file=>{const b=fs.readFileSync(path.join(dir,file));return{file,bytes:b.length,sha256:sha(b)};});fs.writeFileSync(path.join(dir,'INVENTORY-JOB.json'),JSON.stringify(job,null,2)+'\n');console.log(JSON.stringify(job));}
