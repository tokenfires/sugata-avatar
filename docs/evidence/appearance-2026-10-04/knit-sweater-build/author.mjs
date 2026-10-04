import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { Vector3 } from 'three';

const dir=fileURLToPath(new URL('./',import.meta.url));
const hash=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
assert.ok(!fs.existsSync(dir+'AUTHOR-JOB.json'),'Single construction only');
const job={pid:process.pid,started:new Date().toISOString(),node:process.version,status:'running',
  inputs:Object.fromEntries(['author.mjs','cage.json','BODY.json','PLAN.md','CONSTRUCTION.md','INVENTORY-JOB.json','WORTH.md','SOURCE.md'].map(p=>[p,hash(dir+p)])),outputs:[]};
const vec=p=>new Vector3(...p),mod=(j,n)=>(j+n)%n;
const witness=(stage,operands)=>{job.witness={stage,...operands};};
function finalGate(stage){
  const pins=Object.fromEntries(Object.keys(job.inputs).map(p=>[p,hash(dir+p)]));
  witness(stage,{pins,expected:job.inputs,now:new Date().toISOString(),stop:'2026-10-04T11:10:00Z'});
  for(const p of Object.keys(pins))assert.equal(pins[p],job.inputs[p],`Input changed: ${p}`);
  assert.ok(new Date()<new Date('2026-10-04T11:10:00Z'),'Hard stop before emission/pass');
}
try{
  witness('initial guards',{now:new Date().toISOString(),stop:'2026-10-04T11:10:00Z',outputs:['sweater.json','sweater.obj'].map(p=>({file:p,exists:fs.existsSync(dir+p)}))});
  assert.ok(['sweater.json','sweater.obj'].every(p=>!fs.existsSync(dir+p)),'Fresh outputs required');
  assert.ok(new Date()<new Date('2026-10-04T11:10:00Z'),'Hard stop');
  const c=JSON.parse(fs.readFileSync(dir+'cage.json')),body=JSON.parse(fs.readFileSync(dir+'BODY.json'));
  witness('body/cage inputs',{body,cage:c});
  assert.equal(body.sha256,'fc4445c95ed3f423734ff272ee78ebb44d762a8f16edb94b26039de7a8a96b3a');
  const n=c.segments,points=[],quads=[],expected=[],zones=[];
  const add=p=>{witness('point',{ordinal:points.length,point:p});assert.ok(p.every(Number.isFinite));points.push(p);return points.length-1;};
  const face=(q,normal,zone)=>{quads.push(q);expected.push(normal.toArray());zones.push(zone);};
  const rings=c.torso.map(([y,rx,rz,cz])=>Array.from({length:n},(_,j)=>{
    const t=j*2*Math.PI/n;return add([rx*Math.cos(t),y,cz+rz*Math.sin(t)]);
  }));
  for(let r=0;r<rings.length-1;r++)for(let j=0;j<n;j++){
    const side=Math.min(mod(j,n),mod(-j-1,n))<c.ports.halfSectors || Math.abs(j-n/2+.5)<c.ports.halfSectors;
    if(r>=c.ports.firstRow&&r<c.ports.endRow&&side)continue;
    const t=(j+.5)*2*Math.PI/n;
    face([rings[r][j],rings[r+1][j],rings[r+1][mod(j+1,n)],rings[r][mod(j+1,n)]],
      new Vector3(Math.cos(t),0,Math.sin(t)),r<2||r>=rings.length-3?'rib':'knit');
  }
  // Directed single-use quad edges give exact torso ports. No epsilon weld or invented seam vertices.
  function boundaryLoops(qs){
    const edges=new Map();
    for(const q of qs)for(let k=0;k<q.length;k++){
      const a=q[k],b=q[(k+1)%q.length],key=[Math.min(a,b),Math.max(a,b)].join(':');
      const es=edges.get(key)??[];es.push([a,b]);edges.set(key,es);
    }
    witness('boundary edges',{edges:[...edges]});
    const next=new Map();
    for(const es of edges.values())if(es.length===1){witness('boundary outgoing',{edge:es,next:[...next]});assert.ok(!next.has(es[0][0]));next.set(...es[0]);}
    const loops=[];while(next.size){const first=next.keys().next().value,loop=[first];let at=first;
      do{witness('boundary walk',{first,at,loop,next:[...next]});assert.ok(next.has(at),'Boundary not closed');const b=next.get(at);next.delete(at);at=b;if(at!==first)loop.push(at);assert.ok(loop.length<=points.length);}while(at!==first);
      assert.equal(new Set(loop).size,loop.length);loops.push(loop);
    }return loops;
  }
  const ports=boundaryLoops(quads).filter(l=>l.length!==n);assert.equal(ports.length,2);
  const seams=[];const named={hem:rings[0],neck:rings.at(-1)};
  for(const portBoundary of ports){
    // Reverse the torso boundary: the new sleeve consumes every port edge in the opposite direction.
    const port=[...portBoundary].reverse(),center=new Vector3();for(const i of port)center.add(vec(points[i]));center.multiplyScalar(1/port.length);
    const sign=Math.sign(center.x);witness('port center',{port,points:port.map(i=>points[i]),center:center.toArray(),sign});assert.ok(sign!==0);
    const path=c.positiveXSleeve.map(p=>({...p,center:[sign*p.center[0],p.center[1],p.center[2]]}));
    const axis=vec(path[0].center).sub(center).normalize();
    function frame(d){const u=new Vector3(0,1,0).addScaledVector(d,-d.y).normalize();witness('sleeve frame',{tangent:d.toArray(),projectedUp:u.toArray()});assert.ok(u.length()>.99);return {u,v:d.clone().cross(u).normalize()};}
    const initial=frame(axis);
    const angles=port.map(i=>{const p=vec(points[i]).sub(center);return Math.atan2(p.dot(initial.v),p.dot(initial.u));});
    // Strict positive angular traversal, including wrap, catches a pinched port before generating a sleeve.
    const deltas=angles.map((a,i)=>mod(angles[(i+1)%angles.length]-a,2*Math.PI));
    witness('port correspondence',{port,points:port.map(i=>points[i]),center:center.toArray(),frame:{u:initial.u.toArray(),v:initial.v.toArray()},angles,deltas});
    assert.ok(deltas.every(d=>d>1e-6&&d<Math.PI),'Non-monotonic port correspondence');
    assert.ok(Math.abs(deltas.reduce((s,d)=>s+d,0)-2*Math.PI)<1e-8,'Port winding');
    let previous=port,previousFrame=initial;
    for(let r=0;r<path.length;r++){
      const p=path[r],before=r===0?center:vec(path[r-1].center),after=r===path.length-1?vec(p.center):vec(path[r+1].center);
      const tangent=r===path.length-1?vec(p.center).sub(before).normalize():after.clone().sub(before).normalize();
      const f=frame(tangent),pc=vec(p.center);
      const ring=angles.map(a=>add(pc.clone().addScaledVector(f.u,p.radiusU*Math.cos(a)).addScaledVector(f.v,p.radiusV*Math.sin(a)).toArray()));
      for(let j=0;j<ring.length;j++){
        const k=(j+1)%ring.length,a=angles[j]+deltas[j]/2;
        const ref=previousFrame.u.clone().add(f.u).multiplyScalar(Math.cos(a)).add(previousFrame.v.clone().add(f.v).multiplyScalar(Math.sin(a))).normalize();
        face([previous[j],previous[k],ring[k],ring[j]],ref,r>=path.length-2?'rib':'knit');
      }
      previous=ring;previousFrame=f;
    }
    named[sign>0?'positiveXWrist':'negativeXWrist']=previous;
    seams.push({side:sign>0?'positiveX':'negativeX',originalPort:port,firstSleeveRing:path[0],angles});
  }
  // Discard only unused cells of this newly authored parametric grid; no inherited source re-indexing.
  const used=[...new Set(quads.flat())].sort((a,b)=>a-b),map=new Map(used.map((v,i)=>[v,i]));
  const ps=used.map(i=>points[i]),qs=quads.map(q=>q.map(i=>map.get(i))),tris=[];
  let minArea=Infinity,minDot=Infinity;const normals=ps.map(()=>new Vector3());
  for(let f=0;f<qs.length;f++)for(const tri of [[qs[f][0],qs[f][1],qs[f][2]],[qs[f][0],qs[f][2],qs[f][3]]]){
    const [a,b,d]=tri.map(i=>vec(ps[i])),normal=b.sub(a).cross(d.sub(a));
    const area=normal.length(),dot=normal.dot(vec(expected[f]));minArea=Math.min(minArea,area);minDot=Math.min(minDot,dot);
    witness('triangle',{face:f,triangle:tris.length,indices:tri,points:tri.map(i=>ps[i]),areaVector:normal.toArray(),area,expected:expected[f],dot,thresholds:c.gate});
    assert.ok(area>c.gate.minimumTriangleAreaVector,`Degenerate face ${f} triangle ${tris.length}`);
    assert.ok(dot>c.gate.minimumOutwardDot,`Outward orientation failed face ${f} triangle ${tris.length} dot ${dot}`);
    tris.push(tri);for(const i of tri)normals[i].add(normal);
  }
  const edges=new Map(),adj=ps.map(()=>new Set()),links=ps.map(()=>[]);
  for(const [a,b,d] of tris){links[a].push([b,d]);links[b].push([d,a]);links[d].push([a,b]);
    for(const [u,v] of [[a,b],[b,d],[d,a]]){adj[u].add(v);adj[v].add(u);const key=[Math.min(u,v),Math.max(u,v)].join(':');
      const es=edges.get(key)??[];es.push([u,v]);edges.set(key,es);}}
  const boundaryVertices=new Set();
  for(const es of edges.values()){witness('edge incidence/winding',{edge:es});assert.ok(es.length===1||es.length===2,'Nonmanifold edge');
    if(es.length===2)assert.ok(es[0][0]===es[1][1]&&es[0][1]===es[1][0],'Inconsistent winding');else for(const v of es[0])boundaryVertices.add(v);}
  function connected(graph){const visited=new Set(),queue=[graph.keys().next().value];while(queue.length){const v=queue.pop();if(visited.has(v))continue;visited.add(v);for(const w of graph.get(v))queue.push(w);}return visited.size===graph.size;}
  witness('shell connectedness',{adjacency:adj.map(s=>[...s])});
  assert.ok(connected(new Map(adj.map((a,i)=>[i,a]))),'Disconnected shell');
  for(let v=0;v<ps.length;v++){
    const graph=new Map();for(const [a,b] of links[v]){if(!graph.has(a))graph.set(a,new Set());if(!graph.has(b))graph.set(b,new Set());graph.get(a).add(b);graph.get(b).add(a);}
    witness('vertex link',{vertex:v,boundary:boundaryVertices.has(v),link:[...graph].map(([i,s])=>[i,[...s]])});
    assert.ok(connected(graph),`Pinched vertex ${v}`);const degrees=[...graph.values()].map(s=>s.size);
    if(boundaryVertices.has(v))assert.ok(degrees.filter(d=>d===1).length===2&&degrees.every(d=>d===1||d===2),`Boundary vertex link ${v}`);
    else assert.ok(degrees.every(d=>d===2),`Interior vertex link ${v}`);
  }
  const loops=boundaryLoops(qs),namedMapped=Object.fromEntries(Object.entries(named).map(([k,vs])=>[k,vs.map(v=>map.get(v))]));
  witness('named boundaries/Euler',{loops,namedMapped,vertices:ps.length,edges:edges.size,triangles:tris.length,euler:ps.length-edges.size+tris.length,expected:c.gate});
  assert.equal(loops.length,c.gate.boundaryCount);assert.equal(ps.length-edges.size+tris.length,c.gate.euler);
  for(const [name,vs] of Object.entries(namedMapped))assert.ok(loops.some(l=>l.length===vs.length&&l.every(i=>vs.includes(i))),`Wrong ${name} opening`);
  const ns=normals.map((v,i)=>{witness('vertex normal',{vertex:i,normal:v.toArray(),length:v.length()});assert.ok(v.length()>0,`Zero vertex normal ${i}`);return v.normalize().toArray();});
  const model={contract:c.contract,positions:ps,quads:qs,triangles:tris,normals:ns,zones,boundaries:namedMapped,
    sourceGridOrdinals:used,seams:seams.map(s=>({...s,originalPort:s.originalPort.map(v=>map.get(v))})),limits:c.limits};
  const mesh=JSON.stringify(model)+'\n';
  let obj='# New independent unrigged knit sweater cage; meters; identity world transform. Zero thickness.\n';
  obj+=ps.map(p=>'v '+p.join(' ')).join('\n')+'\n'+ns.map(p=>'vn '+p.join(' ')).join('\n')+'\n';
  let zone;for(let f=0;f<qs.length;f++){if(zone!==zones[f]){zone=zones[f];obj+='g '+zone+'\n';}obj+='f '+qs[f].map(v=>`${v+1}//${v+1}`).join(' ')+'\n';}
  // All gates pass before any candidate mesh bytes are emitted.
  finalGate('before emission');
  witness('emission',{files:['sweater.json','sweater.obj'],intendedBytes:[Buffer.byteLength(mesh),Buffer.byteLength(obj)]});
  fs.writeFileSync(dir+'sweater.json',mesh);fs.writeFileSync(dir+'sweater.obj',obj);
  finalGate('before pass');
  job.status='passed';job.topology={vertices:ps.length,edges:edges.size,triangles:tris.length,quads:qs.length,euler:ps.length-edges.size+tris.length,
    boundaryLoops:Object.fromEntries(Object.entries(namedMapped).map(([k,v])=>[k,v.length])),connected:true,orientable:true,vertexLinks:true,genus:0,minAreaVector:minArea,minOutwardDot:minDot};
  // Actual emitted-file inventory runs for both success and failure below.
}catch(e){job.status='failed';job.error=e.stack;process.exitCode=1;}
for(const p of ['sweater.json','sweater.obj'])if(fs.existsSync(dir+p)){
  try{job.outputs.push({file:p,bytes:fs.statSync(dir+p).size,sha256:hash(dir+p),qualification:job.status==='passed'?'source gates only; appearance pending':'unqualified partial output'});}
  catch(e){job.status='failed';process.exitCode=1;job.outputs.push({file:p,inventoryError:e.stack,qualification:'unqualified inventory failure'});}
}
if(job.status==='passed'&&new Date()>=new Date('2026-10-04T11:10:00Z')){job.status='failed';job.error='Final job inventory completed after hard stop';process.exitCode=1;}
if(job.status!=='passed')for(const o of job.outputs)o.qualification='unqualified retained output';
job.finished=new Date().toISOString();fs.writeFileSync(dir+'AUTHOR-JOB.json',JSON.stringify(job,null,2)+'\n');console.log(JSON.stringify(job));
