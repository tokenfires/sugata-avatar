// INERT until complete source review and fresh root CPU admission.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {performance} from 'node:perf_hooks';

const entered = performance.now();
const leaf = path.dirname(fileURLToPath(import.meta.url));
const hash = b => crypto.createHash('sha256').update(b).digest('hex');
const assert = (x, message) => { if (!x) throw new Error(message); };
const sub = (a,b) => a.map((v,i)=>v-b[i]);
const add = (a,b) => a.map((v,i)=>v+b[i]);
const mul = (a,s) => a.map(v=>v*s);
const dot = (a,b) => a.reduce((s,v,i)=>s+v*b[i],0);
const cross = (a,b) => [a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const length = a => Math.hypot(...a);
const unit = a => { const n=length(a); assert(n>1e-12,'zero normal'); return mul(a,1/n); };
let design;
const checkpoint = () => assert(performance.now()-entered<design.caps.soft_post_import_ms,'soft checked time exceeded');
const edgeKey = (a,b) => a<b ? `${a},${b}` : `${b},${a}`;

function edgesOf(faces) {
  const edges=new Map();
  faces.forEach((f,fi)=>{
    for(let i=0;i<3;i++) {
      const a=f.v[i], b=f.v[(i+1)%3], key=edgeKey(a,b);
      if(!edges.has(key)) edges.set(key,[]);
      edges.get(key).push({fi,a,b});
    }
  });
  return edges;
}

function orient(vertices, faces, closed) {
  const edges=edgesOf(faces), adjacency=faces.map(()=>[]);
  for(const es of edges.values()) {
    assert(es.length<=2 && (!closed||es.length===2),'nonmanifold or missing edge');
    if(es.length===2) {
      const [a,b]=es, xor=a.a===b.a;
      adjacency[a.fi].push([b.fi,xor]); adjacency[b.fi].push([a.fi,xor]);
    }
  }
  const flips=faces.map(()=>null), queue=[0]; flips[0]=false;
  for(let qi=0;qi<queue.length;qi++) {
    const f=queue[qi];
    for(const [n,xor] of adjacency[f]) {
      const target=flips[f]!==xor;
      if(flips[n]===null) { flips[n]=target;queue.push(n); }
      else assert(flips[n]===target,'orientation contradiction');
    }
  }
  assert(queue.length===faces.length,'disconnected surface component');
  faces.forEach((f,i)=>{if(flips[i]) [f.v[1],f.v[2]]=[f.v[2],f.v[1]];});
  let sign;
  if(closed) {
    sign=faces.reduce((s,f)=>s+dot(vertices[f.v[0]],cross(vertices[f.v[1]],vertices[f.v[2]]))/6,0);
    assert(Math.abs(sign)>1e-6,'zero material volume');
  } else {
    const [a,b,c]=faces[0].v.map(i=>vertices[i]); sign=cross(sub(b,a),sub(c,a))[2];
    assert(Math.abs(sign)>1e-6,'no front orientation witness');
  }
  if(sign<0) faces.forEach(f=>{[f.v[1],f.v[2]]=[f.v[2],f.v[1]];});
  return Math.abs(sign);
}

function boundaryLoops(faces) {
  const es=[...edgesOf(faces).values()].filter(x=>x.length===1).map(x=>x[0]);
  const outgoing=new Map(), incoming=new Map();
  for(const e of es) {
    assert(!outgoing.has(e.a)&&!incoming.has(e.b),'branching boundary');
    outgoing.set(e.a,e.b);incoming.set(e.b,e.a);
  }
  const pending=new Set(outgoing.keys()), loops=[];
  while(pending.size) {
    const start=pending.values().next().value, loop=[];let a=start;
    do { assert(pending.has(a),'broken boundary');pending.delete(a);loop.push(a);a=outgoing.get(a); } while(a!==start);
    loops.push(loop);
  }
  return loops;
}

function compact(vertices,faces,record) {
  const used=[...new Set(faces.flatMap(f=>f.v))].sort((a,b)=>a-b), map=new Map(used.map((v,i)=>[v,i]));
  return {vertices:used.map(i=>vertices[i]),faces:faces.map(f=>({...f,v:f.v.map(i=>map.get(i))})),record,oldToNew:map};
}

function normals(vertices,faces) {
  const result=vertices.map(()=>[0,0,0]);
  for(const f of faces) {
    const [a,b,c]=f.v.map(i=>vertices[i]), n=cross(sub(b,a),sub(c,a));
    assert(length(n)>1e-10,'degenerate triangle');
    for(const i of f.v) result[i]=add(result[i],n);
  }
  return result.map(unit);
}

function materialShell(vertices, faces, innerVertices, id, rimMaterial) {
  orient(vertices,faces,false);
  const loops=boundaryLoops(faces), n=vertices.length;
  const all=[...vertices,...innerVertices];
  const ff=[...faces.map(f=>({...f,v:[...f.v]})),...faces.map(f=>({v:[f.v[0]+n,f.v[2]+n,f.v[1]+n],material:'inside'}))];
  for(const loop of loops) for(let j=0;j<loop.length;j++) {
    const a=loop[j],b=loop[(j+1)%loop.length], material=rimMaterial(a,b);
    ff.push({v:[a,a+n,b+n],material},{v:[a,b+n,b],material});
  }
  const materialVolume=orient(all,ff,true);
  return {id,vertices:all,faces:ff,materialVolume,openSurfaceBoundaryLoops:loops};
}

function mainSurface() {
  const b=design.body, ns=b.angular_segments, nr=b.rows_y.length;
  const vertices=[], faces=[], grid=[], provenance=[];
  for(let r=0;r<nr;r++) {
    const row=[];
    for(let j=0;j<=ns;j++) {
      const theta=b.front_gap_radians+(2*Math.PI-2*b.front_gap_radians)*j/ns;
      const frontBand=Math.max(0,1-Math.min(j,ns-j)/2), napeBand=Math.max(0,(r-(nr-3))/2);
      const relief=b.band_relief*Math.max(frontBand,napeBand)+b.hem_relief*Math.max(0,1-r);
      row.push(vertices.length);vertices.push([(b.half_width[r]+relief)*Math.sin(theta),b.rows_y[r],(b.half_depth[r]+relief)*Math.cos(theta)]);
      provenance.push({kind:'body',row:r,col:j});
    }
    grid.push(row);
  }
  for(let r=0;r<nr-1;r++) for(let j=0;j<ns;j++) {
    if(b.holes.some(h=>r>=h.row0&&r<h.row1&&j>=h.col0&&j<h.col1)) continue;
    const a=grid[r][j],bb=grid[r][j+1],c=grid[r+1][j+1],d=grid[r+1][j];
    const material=(j<2||j>=ns-2||r>=nr-2)?'band':r===0?'rib':'body';
    faces.push({v:[a,bb,c],material},{v:[a,c,d],material});
  }
  const sleeveInterfaces=[];
  for(const h of b.holes) {
    const ring=[];
    for(let j=h.col0;j<=h.col1;j++) ring.push(grid[h.row0][j]);
    for(let r=h.row0+1;r<=h.row1;r++) ring.push(grid[r][h.col1]);
    for(let j=h.col1-1;j>=h.col0;j--) ring.push(grid[h.row1][j]);
    for(let r=h.row1-1;r>h.row0;r--) ring.push(grid[r][h.col0]);
    assert(ring.length===20 && new Set(ring).size===20,'armhole loop ownership');
    const points=ring.map(i=>vertices[i]), center=[0,1,2].map(k=>points.reduce((s,p)=>s+p[k],0)/points.length);
    const ry=(Math.max(...points.map(p=>p[1]))-Math.min(...points.map(p=>p[1])))/2;
    const rz=(Math.max(...points.map(p=>p[2]))-Math.min(...points.map(p=>p[2])))/2;
    const angles=points.map(p=>Math.atan2((p[1]-center[1])/ry,(p[2]-center[2])/rz));
    let prev=ring;
    for(const [ti,t] of design.sleeves.new_ring_t.entries()) {
      const s=design.sleeves, phi=s.cross_section_tilt_radians*t;
      const cy=center[1]-s.drop*t, cx=center[0]+h.sign*(s.outward_travel*t+s.outward_bulge*Math.sin(Math.PI*t)), cz=center[2]-s.back_shift*t;
      const relief=t>=s.cuff_start_t?s.cuff_relief:0;
      const ay=ry+(s.wrist_y_radius-ry)*t+relief, az=rz+(s.wrist_z_radius-rz)*t+relief;
      const next=[];
      for(let k=0;k<ring.length;k++) {
        const theta=angles[k], dy=ay*Math.sin(theta);
        next.push(vertices.length);vertices.push([cx+h.sign*Math.sin(phi)*dy,cy+Math.cos(phi)*dy,cz+az*Math.cos(theta)]);
        provenance.push({kind:h.id,ring:ti,t});
      }
      for(let k=0;k<ring.length;k++) {
        const k1=(k+1)%ring.length, material=t>=0.94?'rib':'body';
        faces.push({v:[prev[k],prev[k1],next[k1]],material},{v:[prev[k],next[k1],next[k]],material});
      }
      prev=next;
    }
    sleeveInterfaces.push({id:h.id,sharedBodyRing: ring,terminalCuffRing:prev,ringVertices:20,mode:'shared vertex bridge, no cap or internal shoulder plate'});
    checkpoint();
  }
  const c=compact(vertices,faces,{grid,provenance,sleeveInterfaces});
  orient(c.vertices,c.faces,false);
  const loops=boundaryLoops(c.faces);
  assert(JSON.stringify(loops.map(x=>x.length).sort((a,b)=>a-b))===JSON.stringify(design.expected.body_outer_boundary_loops),'unexpected garment opening boundary');
  assert(c.vertices.length===design.expected.body_outer_vertices&&c.faces.length===design.expected.body_outer_triangles,'outer count mismatch');
  const nn=normals(c.vertices,c.faces), inner=c.vertices.map((p,i)=>sub(p,mul(nn[i],b.thickness)));
  const shell=materialShell(c.vertices,c.faces,inner,'continuous_body_and_sleeves',(a,bb)=>{
    const pa=provenance[[...c.oldToNew.entries()].find(x=>x[1]===a)[0]], pb=provenance[[...c.oldToNew.entries()].find(x=>x[1]===bb)[0]];
    if(pa.kind!=='body'||pb.kind!=='body') return 'rib';
    return pa.row===0&&pb.row===0?'rib':'band';
  });
  assert(shell.vertices.length===design.expected.main_vertices&&shell.faces.length===design.expected.main_triangles,'main material count mismatch');
  shell.interfaces=sleeveInterfaces.map(s=>({...s,sharedBodyRing:s.sharedBodyRing.map(i=>c.oldToNew.get(i)),terminalCuffRing:s.terminalCuffRing.map(i=>c.oldToNew.get(i))}));
  shell.openingMeaning='One continuous neckline/front/hem boundary and two cuff boundaries; material-thickness rims close material edges only, not garment voids.';
  return {shell,originalVertices:vertices,grid};
}

function pocketSurface(p, body) {
  const ps=design.pocket_shell, vertices=[], inner=[], faces=[], attachments=[];
  const rows=p.row1-p.row0, cols=p.col1-p.col0, index=(r,j)=>r*(cols+1)+j;
  for(let r=0;r<=rows;r++) for(let j=0;j<=cols;j++) {
    const base=body.originalVertices[body.grid[p.row0+r][p.col0+j]];
    const u=j/cols,v=r/rows,gap=ps.max_mouth_gap_z*v*Math.sin(Math.PI*u);
    const a=add(base,[0,0,ps.thickness_z+gap]),b=add(base,[0,0,gap]);
    vertices.push(a);inner.push(b);
    if(r===0||j===0||j===cols) {
      assert(length(sub(b,base))<1e-10,'pocket attachment gap');
      attachments.push({pocketVertex:index(r,j),bodyGridVertex:body.grid[p.row0+r][p.col0+j],distance:length(sub(b,base))});
    }
    assert(gap>=-1e-12,'negative pocket gap');
  }
  for(let r=0;r<rows;r++) for(let j=0;j<cols;j++) {
    const a=index(r,j),b=index(r,j+1),c=index(r+1,j+1),d=index(r+1,j);
    faces.push({v:[a,b,c],material:'pocket'},{v:[a,c,d],material:'pocket'});
  }
  // Outer surface faces +Z on both front pockets; maintain correspondence with inner vertices.
  orient(vertices,faces,false);
  const shell=materialShell(vertices,faces,inner,p.id,()=> 'pocket');
  assert(shell.vertices.length===design.expected.pocket_vertices_each&&shell.faces.length===design.expected.pocket_triangles_each,'pocket count mismatch');
  const topMid=index(rows,cols/2),base=body.originalVertices[body.grid[p.row1][p.col0+cols/2]];
  const mouthGap=inner[topMid][2]-base[2];assert(Math.abs(mouthGap-ps.max_mouth_gap_z)<1e-10,'pocket mouth gap');
  shell.attachmentWitnesses=attachments;shell.topMouthCenterGapZ=mouthGap;
  shell.interfaces='Separate closed thin patch shell. Inner side/bottom vertices/edges contact the identical body grid triangles. Top lip has material thickness but leaves a gap to the body back wall. No welded stitching, bag or collision-free claim.';
  return shell;
}

function validatePart(part) {
  assert(part.vertices.every(p=>p.length===3&&p.every(Number.isFinite)),'nonfinite vertex');
  let minArea=Infinity;
  for(const f of part.faces) {
    assert(new Set(f.v).size===3&&f.v.every(i=>Number.isInteger(i)&&i>=0&&i<part.vertices.length),'invalid face');
    const [a,b,c]=f.v.map(i=>part.vertices[i]),area=length(cross(sub(b,a),sub(c,a)))/2;
    assert(area>1e-10,'degenerate material triangle');minArea=Math.min(area,minArea);
    assert(design.materials[f.material],'unknown material');
  }
  const edges=edgesOf(part.faces);
  for(const es of edges.values()) assert(es.length===2&&es[0].a===es[1].b&&es[0].b===es[1].a,'unclosed or unoriented material edge');
  const links=part.vertices.map(()=>new Map());
  for(const f of part.faces) for(let k=0;k<3;k++) {
    const a=f.v[k],b=f.v[(k+1)%3],c=f.v[(k+2)%3],m=links[a];
    if(!m.has(b))m.set(b,new Set());if(!m.has(c))m.set(c,new Set());m.get(b).add(c);m.get(c).add(b);
  }
  for(const m of links) {
    assert(m.size>=3&&[...m.values()].every(x=>x.size===2),'invalid vertex link degree');
    const seen=new Set(),q=[m.keys().next().value];
    for(let j=0;j<q.length;j++) {const v=q[j];if(seen.has(v))continue;seen.add(v);for(const n of m.get(v))if(!seen.has(n))q.push(n);}
    assert(seen.size===m.size,'split vertex link');
  }
  return {vertices:part.vertices.length,triangles:part.faces.length,edges:edges.size,euler:part.vertices.length-edges.size+part.faces.length,minTriangleArea:minArea,materialVolume:part.materialVolume};
}

function run() {
  const raw=fs.readFileSync(path.join(leaf,'design.json'));
  assert(process.argv.length===3&&process.argv[2]===hash(raw),'exact design hash argument required');
  design=JSON.parse(raw);checkpoint();
  const body=mainSurface(), parts=[body.shell,...design.pockets.map(p=>pocketSurface(p,body))];
  const partChecks=parts.map(p=>({id:p.id,...validatePart(p)}));
  const counts={parts:parts.length,vertices:parts.reduce((s,p)=>s+p.vertices.length,0),triangles:parts.reduce((s,p)=>s+p.faces.length,0)};
  assert(counts.parts===design.expected.parts&&counts.vertices===design.expected.all_vertices&&counts.triangles===design.expected.all_triangles,'complete design count mismatch');
  assert(counts.parts<=design.caps.parts&&counts.vertices<=design.caps.vertices&&counts.triangles<=design.caps.triangles,'geometry cap');
  const model={schema:'original-standalone-cardigan-mesh-v1',designSha256:hash(raw),units:design.units,frame:design.frame,materials:design.materials,parts,checks:partChecks,counts,limits:design.limits,interfaces:design.pocket_shell.attachment};
  const modelText=JSON.stringify(model)+'\n', lines=['# Original unitless artist cardigan; no body/fit/cloth/rig authority','mtllib model.mtl'];let offset=1;
  for(const p of parts) {
    lines.push(`o ${p.id}`);for(const v of p.vertices)lines.push(`v ${v.map(x=>x.toFixed(8)).join(' ')}`);
    let material=null;
    for(const f of p.faces) {if(f.material!==material){material=f.material;lines.push(`usemtl ${material}`);}lines.push(`f ${f.v.map(i=>i+offset).join(' ')}`);}
    offset+=p.vertices.length;
  }
  const obj=lines.join('\n')+'\n';
  const mtl=Object.entries(design.materials).map(([name,hex])=>{
    const rgb=[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)/255);return `newmtl ${name}\nKd ${rgb.map(x=>x.toFixed(8)).join(' ')}\nKa 0.05 0.05 0.05\nKs 0 0 0\nNs 8\nd 1\nillum 2\n`;
  }).join('\n');
  const outputs=[['model.json',modelText,design.caps.json_bytes],['model.obj',obj,design.caps.obj_bytes],['model.mtl',mtl,design.caps.mtl_bytes]];
  for(const [name,text,cap]of outputs)assert(Buffer.byteLength(text)<=cap,`${name} byte cap`);
  checkpoint();const out=path.join(leaf,'out');fs.mkdirSync(out);
  const pins=[];for(const [name,text]of outputs){const file=path.join(out,name);fs.writeFileSync(file,text,{flag:'wx'});pins.push({path:file,bytes:Buffer.byteLength(text),sha256:hash(text)});}
  checkpoint();
  const result={schema:'one-cardigan-build-result-v1',status:'complete',utc:new Date().toISOString(),pid:process.pid,argv:process.argv,designSha256:hash(raw),counts,partChecks,outputs:pins,checkedPostImportMs:performance.now()-entered,rssSampleBytes:process.memoryUsage().rss,limits:'Checked elapsed excludes imports/OS startup and is cooperative, RSS sample is not peak/hard cap. Data/manifold/interface evidence is not appearance, collision-free, fit, cloth or runtime qualification.'};
  fs.writeFileSync(path.join(leaf,'BUILD-RESULT.json'),JSON.stringify(result,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify(result));
}
try {run();} catch(e) {console.error(JSON.stringify({status:'failed',utc:new Date().toISOString(),pid:process.pid,error:String(e),stack:e.stack,checkedPostImportMs:performance.now()-entered}));process.exitCode=1;}
