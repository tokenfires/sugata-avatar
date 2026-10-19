import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import crypto from 'node:crypto';
import {performance} from 'node:perf_hooks';

// Original artist geometry. No body, Mara model/builder, SVG coordinates or native pipeline import.
const entered=performance.now(),here=path.dirname(fileURLToPath(import.meta.url));
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const fail=s=>{throw Error(s);};
const assert=(x,s)=>{if(!x)fail(s);};
const add=(a,b)=>a.map((x,k)=>x+b[k]),sub=(a,b)=>a.map((x,k)=>x-b[k]);
const mul=(a,s)=>a.map(x=>x*s),dot=(a,b)=>a.reduce((s,x,k)=>s+x*b[k],0);
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const unit=a=>{const n=Math.hypot(...a);return n>1e-12?mul(a,1/n):[0,0,0];};
const mix=(a,b,t)=>add(mul(a,1-t),mul(b,t));
const edgeKey=(a,b)=>a<b?a+':'+b:b+':'+a;
const face=(a,b,c,material,role,owner)=>({v:[a,b,c],material,role,owner});
let d,admission;
function check(){assert(performance.now()-entered<d.caps.checked_cpu_ms,'cooperative post-import time');assert(process.memoryUsage().rss<d.caps.sampled_rss_bytes,'sampled RSS ceiling');assert(Date.now()<Date.parse(admission.absolute_deadline_utc),'absolute work stop');}
function edges(faces){const e=new Map();faces.forEach((f,i)=>{for(let k=0;k<3;k++){const a=f.v[k],b=f.v[(k+1)%3],key=edgeKey(a,b);if(!e.has(key))e.set(key,[]);e.get(key).push({i,a,b});}});return e;}
function orient(v,source,witnessOwner,target){
  const f=source.map(x=>({...x,v:[...x.v]})),e=edges(f),adj=f.map(()=>[]);
  for(const es of e.values()){assert(es.length<=2,'nonmanifold original surface edge');if(es.length===2){const [a,b]=es;const opposite=a.a===b.b;adj[a.i].push([b.i,!opposite]);adj[b.i].push([a.i,!opposite]);}}
  const flips=new Map([[0,false]]),todo=[0];
  while(todo.length){const a=todo.pop();for(const [b,toggle] of adj[a]){const want=flips.get(a)!==toggle;if(flips.has(b))assert(flips.get(b)===want,'nonorientable source');else{flips.set(b,want);todo.push(b);}}}
  assert(flips.size===f.length,'disconnected original surface');
  f.forEach((x,i)=>{if(flips.get(i))[x.v[1],x.v[2]]=[x.v[2],x.v[1]];});
  const wi=f.findIndex(x=>x.owner===witnessOwner);assert(wi>=0,'normal witness owner missing');
  const [a,b,c]=f[wi].v.map(i=>v[i]);if(dot(cross(sub(b,a),sub(c,a)),target)<0)for(const x of f)[x.v[1],x.v[2]]=[x.v[2],x.v[1]];
  return {f,wi};
}
function loops(f){
  const next=new Map(),incoming=new Set();for(const es of edges(f).values())if(es.length===1){const {a,b}=es[0];assert(!next.has(a)&&!incoming.has(b),'branched boundary');next.set(a,b);incoming.add(b);}
  assert(next.size===incoming.size&&[...next.keys()].every(x=>incoming.has(x)),'boundary not cycles');
  const left=new Set(next.keys()),out=[];while(left.size){const start=left.values().next().value,q=[];let a=start;while(left.has(a)){q.push(a);left.delete(a);a=next.get(a);}assert(a===start,'open boundary');out.push(q);}return out;
}
function normals(v,f){const n=v.map(()=>[0,0,0]);for(const x of f){const [a,b,c]=x.v.map(i=>v[i]),q=cross(sub(b,a),sub(c,a));for(const i of x.v)n[i]=add(n[i],q);}return n.map(unit);}
function baseSurface(withMouths){
  const v=[],f=[],meta=[],C=d.columns,R=d.rows.length,index=(i,j)=>i*C+j;
  for(let i=0;i<R;i++)for(let j=0;j<C;j++){
    const r=d.rows[i],theta=r.alpha+(2*Math.PI-2*r.alpha)*j/(C-1);
    const frontDistance=Math.min(theta,2*Math.PI-theta),sign=theta<Math.PI?1:-1;
    const shear=.10*Math.max(-1,Math.min(1,(r.y-24)/8))*Math.exp(-(((frontDistance-.65)/.35)**2))*sign;
    const a=theta+shear;v.push([r.rx*Math.sin(a),r.y,r.rz*Math.cos(a)]);meta.push({kind:'torso',i,j,theta:a});
  }
  const removed=(i,j,rect)=>i>=rect.i0&&i<rect.i1&&j>=rect.j0&&j<rect.j1;
  for(let i=0;i<R-1;i++)for(let j=0;j<C-1;j++){
    if(d.armholes.some(h=>removed(i,j,h))||(withMouths&&d.mouths.some(h=>removed(i,j,h))))continue;
    const m=i===0?'trim':'body',role=i===0?'H':'shell',owner='torso:'+i+':'+j;
    f.push(face(index(i,j),index(i+1,j),index(i+1,j+1),m,role,owner),face(index(i,j),index(i+1,j+1),index(i,j+1),m,role,owner));
  }
  const initial=orient(v,f,'torso:6:24',[0,0,-1]).f,holes=loops(initial),interfaces=[];f.length=0;f.push(...initial);
  for(const h of d.armholes){
    const set=new Set();for(let i=h.i0;i<=h.i1;i++)for(let j=h.j0;j<=h.j1;j++)if(i===h.i0||i===h.i1||j===h.j0||j===h.j1)set.add(index(i,j));
    const root=holes.find(q=>q.length===set.size&&q.every(x=>set.has(x)));assert(root?.length===16,'declared armhole ring');
    const sign=h.id==='L'?1:-1,c0=mul(root.reduce((s,i)=>add(s,v[i]),[0,0,0]),1/root.length),c1=[sign*d.sleeve.end_x,d.sleeve.end_y,d.sleeve.end_z];
    const m0=[sign*d.sleeve.start_tangent_x,d.sleeve.start_tangent_y,0],m1=[sign*d.sleeve.end_tangent_x,d.sleeve.end_tangent_y,0];
    const rootN=unit(m0),rootU=[0,0,1],rootV=unit(cross(rootN,rootU));
    const phis=root.map(i=>Math.atan2(dot(sub(v[i],c0),rootV),dot(sub(v[i],c0),rootU)));let prev=root;
    for(let k=1;k<=d.sleeve.steps;k++){
      const t=k/d.sleeve.steps,t2=t*t,t3=t2*t;
      const c=add(add(mul(c0,2*t3-3*t2+1),mul(m0,t3-2*t2+t)),add(mul(c1,-2*t3+3*t2),mul(m1,t3-t2)));
      const tangent=add(add(mul(c0,6*t2-6*t),mul(m0,3*t2-4*t+1)),add(mul(c1,-6*t2+6*t),mul(m1,3*t2-2*t)));
      const n=unit(tangent),u=[0,0,1],vv=unit(cross(n,u)),radius=d.sleeve.radius_shoulder*(1-t)+d.sleeve.radius_cuff*t,ring=[];
      root.forEach((ri,j)=>{const canonical=add(c,add(mul(u,Math.cos(phis[j])*radius),mul(vv,Math.sin(phis[j])*radius)));const q=t<.2?mix(add(v[ri],sub(c,c0)),canonical,t/.2):canonical;ring.push(v.length);v.push(q);meta.push({kind:'sleeve',id:h.id,t,phi:phis[j]});});
      const material=k===d.sleeve.steps?'trim':'body',role=k===d.sleeve.steps?'C_'+h.id:'sleeve_'+h.id;
      for(let j=0;j<root.length;j++){const z=(j+1)%root.length,owner='sleeve:'+h.id+':'+k+':'+j;f.push(face(prev[j],prev[z],ring[z],material,role,owner),face(prev[j],ring[z],ring[j],material,role,owner));}prev=ring;
    }
    interfaces.push({id:h.id,sharedBodyRing:root,terminalCuffRing:prev});
  }
  return {v,f:orient(v,f,'torso:6:24',[0,0,-1]).f,meta,interfaces,index};
}
function addBags(s){
  const boundary=loops(s.f),n=normals(s.v,s.f),mouths=[];
  for(const m of d.mouths){
    const set=new Set();for(let i=m.i0;i<=m.i1;i++)for(let j=m.j0;j<=m.j1;j++)set.add(s.index(i,j));
    const root=boundary.find(q=>q.length===6&&q.every(i=>set.has(i)));assert(root,'outer pocket mouth missing');
    const dir=unit(root.reduce((a,i)=>add(a,n[i]),[0,0,0]));let prev=root;const bagVertices=[];
    for(let k=0;k<2;k++){
      const ring=root.map(i=>{const q=add(sub(s.v[i],mul(dir,d.bag.depths[k])),[0,-d.bag.drops[k],0]);const id=s.v.length;s.v.push(q);bagVertices.push(id);return id;});
      for(let j=0;j<6;j++){const z=(j+1)%6,role='bag_'+m.id,owner='bag:'+m.id+':'+k+':'+j;s.f.push(face(prev[j],prev[z],ring[z],'bag',role,owner),face(prev[j],ring[z],ring[j],'bag',role,owner));}prev=ring;
    }
    const center=add(mul(prev.reduce((a,i)=>add(a,s.v[i]),[0,0,0]),1/6),[0,-d.bag.apex_extra_drop,0]),apex=s.v.length;s.v.push(center);bagVertices.push(apex);
    for(let j=0;j<6;j++)s.f.push(face(prev[j],prev[(j+1)%6],apex,'bag','bag_'+m.id,'bag:'+m.id+':cap'));
    mouths.push({...m,mouth:root,bagVertices,apex});
  }
  s.f=orient(s.v,s.f,'torso:6:24',[0,0,-1]).f;s.mouths=mouths;
}
function shell(id,rawV,rawF,thickness,witnessOwner,target,innerMaterial){
  const used=[...new Set(rawF.flatMap(x=>x.v))].sort((a,b)=>a-b),map=new Map(used.map((a,i)=>[a,i]));
  const v=used.map(i=>rawV[i]),oriented=orient(v,rawF.map(x=>({...x,v:x.v.map(i=>map.get(i))})),witnessOwner,target),f=oriented.f,norm=normals(v,f),n=v.length;
  assert(norm.every(x=>Math.hypot(...x)>.99),'zero surface normal');const boundary=loops(f),vertices=[...v,...v.map((q,i)=>sub(q,mul(norm[i],thickness)))];
  const faces=f.map(x=>({...x,layer:'outer'}));for(const x of f)faces.push({...x,v:[x.v[0]+n,x.v[2]+n,x.v[1]+n],material:innerMaterial==='inside_shell'&&x.role.startsWith('bag_')?'bag':innerMaterial||x.material,layer:'inner'});
  for(const q of boundary)for(let j=0;j<q.length;j++){const a=q[j],b=q[(j+1)%q.length];faces.push(face(b,a,a+n,innerMaterial||'trim','rim','rim'),face(b,a+n,b+n,innerMaterial||'trim','rim','rim'));}
  return {data:{id,vertices,faces,outerCount:n,thickness,openSurfaceBoundaryLoops:boundary,outwardWitnessFace:oriented.wi},map,n};
}
function checkPart(p){
  check();const v=p.vertices,f=p.faces,n=v.length;assert(n>0&&v.every(q=>q.length===3&&q.every(Number.isFinite)),'nonfinite positions');
  const e=edges(f),adj=f.map(()=>new Set()),links=v.map(()=>new Map());let minArea=Infinity,volume=0;const origin=v[0],seenFaces=new Set();
  for(const x of f){assert(new Set(x.v).size===3&&x.v.every(i=>Number.isInteger(i)&&i>=0&&i<n),'face indices');assert(x.material in d.materials,'material role');const key=[...x.v].sort((a,b)=>a-b).join(':');assert(!seenFaces.has(key),'duplicate triangle');seenFaces.add(key);
    const [a,b,c]=x.v.map(i=>v[i]),area=Math.hypot(...cross(sub(b,a),sub(c,a)))/2;assert(area>1e-10,'degenerate material triangle');minArea=Math.min(minArea,area);volume+=dot(sub(a,origin),cross(sub(b,origin),sub(c,origin)))/6;
    for(let k=0;k<3;k++){const i=x.v[k],b=x.v[(k+1)%3],c=x.v[(k+2)%3];if(!links[i].has(b))links[i].set(b,new Set());if(!links[i].has(c))links[i].set(c,new Set());links[i].get(b).add(c);links[i].get(c).add(b);}
  }
  for(const es of e.values()){assert(es.length===2&&es[0].a===es[1].b&&es[0].b===es[1].a,'material edge not opposite pair');adj[es[0].i].add(es[1].i);adj[es[1].i].add(es[0].i);}
  function connected(a){const first=a.keys().next().value,seen=new Set(),todo=[first];while(todo.length){const x=todo.pop();if(seen.has(x))continue;seen.add(x);for(const y of a.get(x))if(!seen.has(y))todo.push(y);}return seen.size===a.size;}
  assert(connected(new Map(adj.map((x,i)=>[i,x]))),'disconnected material faces');assert(links.every(q=>q.size>=3&&[...q.values()].every(s=>s.size===2)&&connected(q)),'vertex link not single cycle');assert(volume>1e-8,'nonpositive material volume');
  const euler=n-e.size+f.length;assert(euler===(p.id==='shell_with_outer_bags'||p.id==='full_lining_and_facings'?-2:2),'declared topology');p.materialVolume=volume;return{id:p.id,vertices:n,triangles:f.length,edges:e.size,euler,minTriangleArea:minArea,materialVolume:volume};
}
function ribbon(points,widthVector,material,role){const v=points.flatMap(q=>[q,add(q,widthVector(q))]),f=[];for(let i=0;i<points.length-1;i++){const a=i*2,b=a+2,m=i%2===0?material:'zip_mark',owner=role+':'+i;f.push(face(a,b,b+1,m,role,owner),face(a,b+1,a+1,m,role,owner));}return{v,f,witness:role+':0'};}
try{
  assert(process.argv.length===3,'one design SHA argument required');const db=fs.readFileSync(path.join(here,'design.json'));assert(sha(db)===process.argv[2],'design identity');d=JSON.parse(db);
  admission=JSON.parse(fs.readFileSync(path.join(here,'CPU-ADMISSION.json'),'utf8'));assert(Date.now()<Date.parse(admission.expires_utc),'CPU admission expired');assert(admission.design_sha256===sha(db),'admission design mismatch');assert(!fs.existsSync(path.join(here,'out'))&&!fs.existsSync(path.join(here,'BUILD-RESULT.json')),'outputs already exist');check();
  const base=baseSurface(false),outer=baseSurface(true);addBags(outer);
  const main=shell('shell_with_outer_bags',outer.v,outer.f,d.thickness.shell,'torso:6:24',[0,0,-1],'inside_shell'),parts=[main.data],contacts=[];
  const normal=normals(base.v,base.f),boundary=loops(base.f),boundarySet=new Set(boundary.flat()),adj=base.v.map(()=>new Set());for(const x of base.f)for(let k=0;k<3;k++){adj[x.v[k]].add(x.v[(k+1)%3]);adj[x.v[(k+1)%3]].add(x.v[k]);}
  const distance=base.v.map(()=>Infinity),queue=[...boundarySet];for(const i of queue)distance[i]=0;for(let k=0;k<queue.length;k++)for(const j of adj[queue[k]])if(distance[j]===Infinity){distance[j]=distance[queue[k]]+1;queue.push(j);}
  const liningV=base.v.map((q,i)=>{if(!adj[i].size)return q;const m=base.meta[i],front=m.kind==='torso'?Math.max(0,Math.min(1,(Math.cos(m.theta)-.2)/.6)):0,gap=m.kind==='torso'?d.lining_gap.other_torso+(d.lining_gap.front-d.lining_gap.other_torso)*front:d.lining_gap.sleeve;
    if(boundarySet.has(i))return [...main.data.vertices[main.map.get(i)+main.n]];
    let p=sub(q,mul(normal[i],d.thickness.shell+(gap-d.thickness.shell)*Math.min(1,distance[i]/d.lining_gap.release_graph_steps)));
    if(m.kind==='torso'&&m.i>=4&&m.i<=10){const relief=.7*Math.exp(-(((m.j-24)/.85)**2))*Math.sin(Math.PI*(m.i-3)/8);p=add(p,mul(normal[i],relief));}return p;
  });
  const liningF=base.f.map(x=>{const m=base.meta[x.v[0]];let role,material='lining';if(x.owner.startsWith('sleeve:'))role=x.role.startsWith('C_')?x.role:'LS_'+x.owner.split(':')[1];else if(m.i>=11){role='N';material='facing';}else if(m.j<=1||m.j>=46){role=m.j<=1?'F_L':'F_R';material='facing';}else if(m.i===0)role='H';else role=Math.cos(m.theta)>0?(Math.sin(m.theta)>0?'LF_L':'LF_R'):'LB';return{...x,role,material};});
  const lining=shell('full_lining_and_facings',liningV,liningF,d.thickness.lining,'torso:6:24',[0,0,-1]);parts.push(lining.data);
  function contact(a,ai,b,bi,intent){const av=a.data.vertices[ai],bv=b.data.vertices[bi],dist=Math.hypot(...sub(av,bv));assert(dist<1e-12,'published actual contact mismatch');contacts.push({partA:a.data.id,vertexA:ai,partB:b.data.id,vertexB:bi,indexSpace:'named complete part.vertices arrays, zero-based; layers explicit in intent',intent,distance:dist});}
  for(const i of boundarySet)contact(main,main.map.get(i)+main.n,lining,lining.map.get(i),'shell inner termination to lining outer termination; separate contacting material shells');
  const C=d.columns,R=d.rows.length,collarV=[],collarF=[];
  for(let k=0;k<3;k++)for(let j=0;j<C;j++){const q=base.v[base.index(R-1,j)],theta=d.rows[R-1].alpha+(2*Math.PI-2*d.rows[R-1].alpha)*j/(C-1),tip=Math.exp(-Math.min(j,C-1-j)/4);collarV.push(k===0?[...q]:k===1?[9.8*Math.sin(theta),70,7.8*Math.cos(theta)]:[15*Math.sin(theta),64-5*tip,12.3*Math.cos(theta)]);}
  for(let k=0;k<2;k++)for(let j=0;j<C-1;j++){const a=k*C+j,b=(k+1)*C+j,owner='collar:'+k+':'+j;collarF.push(face(a,b,b+1,'collar','collar',owner),face(a,b+1,a+1,'collar','collar',owner));}
  const collar=shell('pointed_collar',collarV,collarF,d.thickness.collar,'collar:0:24',[0,0,-1]);parts.push(collar.data);for(let j=0;j<C;j++)contact(collar,collar.map.get(j),main,main.map.get(base.index(R-1,j)),'collar outer root to shell outer neck edge; contact not sewn union');
  const guardPoints=d.rows.map((_,i)=>liningV[base.index(i,0)]),gr=ribbon(guardPoints,()=>[-2.5,0,-.3],'facing','G_L');gr.f=gr.f.map(x=>({...x,material:'facing'}));const guard=shell('left_guard_G_L',gr.v,gr.f,d.thickness.guard,gr.witness,[0,0,1]);parts.push(guard.data);for(let i=0;i<R;i++)contact(guard,guard.map.get(i*2),lining,lining.map.get(base.index(i,0)),'guard outer root to wearer-left F_L outer edge');
  for(const id of ['R','L']){
    const sign=id==='L'?1:-1,j=id==='L'?0:C-1,points=d.rows.map((_,i)=>base.v[base.index(i,j)]),r=ribbon(points,()=>[-sign*.65,0,.25],'zip','Z_'+id),part=shell('separate_zip_'+id,r.v,r.f,d.thickness.tape,r.witness,[0,0,1]);parts.push(part.data);for(let i=0;i<R;i++)contact(part,part.map.get(i*2),main,main.map.get(base.index(i,j)),'Z_'+id+' tape outer root to shell outer front edge; no engagement');
  }
  for(const m of outer.mouths){
    const points=[];for(let i=m.i0;i<=m.i1;i++)points.push(base.v[base.index(i,m.tape_j)]);const sign=m.id==='L'?1:-1,r=ribbon(points,q=>{const t=unit([q[2],0,-q[0]]);return add(mul(t,-sign*.8),[0,0,.12]);},'zip','P_'+m.id),part=shell('outer_mouth_'+m.id+'_tape',r.v,r.f,d.thickness.tape,r.witness,[0,0,1]);parts.push(part.data);for(let i=0;i<points.length;i++)contact(part,part.map.get(i*2),main,main.map.get(base.index(m.i0+i,m.tape_j)),'P_'+m.id+' tape outer root to original shared outer mouth edge; not a lining-side entry');
  }
  main.data.interfaces=outer.interfaces.map(x=>({id:x.id,sharedBodyRing:x.sharedBodyRing.map(i=>main.map.get(i)),terminalCuffRing:x.terminalCuffRing.map(i=>main.map.get(i))}));
  lining.data.interfaces=base.interfaces.map(x=>({id:x.id,sharedBodyRing:x.sharedBodyRing.map(i=>lining.map.get(i)),terminalCuffRing:x.terminalCuffRing.map(i=>lining.map.get(i))}));
  main.data.mouths=outer.mouths.map(x=>({id:x.id,loop:x.mouth.map(i=>main.map.get(i)),bagVertices:x.bagVertices.map(i=>main.map.get(i)),bagRole:'bag_'+x.id,access:'outer shell only; lining has no corresponding mouth'}));
  for(const [out,obj]of [[main,outer],[lining,base]])out.data.bodyGrid=Array.from({length:R},(_,i)=>Array.from({length:C},(_,j)=>out.map.get(obj.index(i,j))??null));
  const partChecks=parts.map(checkPart),counts={parts:parts.length,vertices:parts.reduce((s,p)=>s+p.vertices.length,0),triangles:parts.reduce((s,p)=>s+p.faces.length,0)};for(const k of Object.keys(counts))assert(counts[k]===d.expected[k]&&counts[k]<=d.caps[k],'declared '+k+' count');assert(contacts.length===246,'all declared actual contact references');
  const model={schema:'Ari-standalone-bomber-artist-mesh-v1',designSha256:sha(db),units:d.units,frame:d.frame,materials:d.materials,counts,parts,contacts,limitations:'Original unitless standalone artist volume. No registered reconstruction, global intersection/fit, sewn union, functional capacity/zip engagement, physical cloth, body/morph/pose, rig, motion, runtime, performance or AAA proof.'};
  const json=JSON.stringify(model)+'\n',obj=['# Original Ari standalone artist source; no UV/normals/sewing/rig','mtllib model.mtl'];let offset=1;
  for(const p of parts){obj.push('o '+p.id);for(const q of p.vertices)obj.push('v '+q.map(x=>x.toFixed(8)).join(' '));let mat;for(const x of p.faces){if(mat!==x.material){mat=x.material;obj.push('usemtl '+mat);}obj.push('f '+x.v.map(i=>i+offset).join(' '));}offset+=p.vertices.length;}
  const mtl=[];for(const [name,hex]of Object.entries(d.materials)){mtl.push('newmtl '+name,'Kd '+[1,3,5].map(i=>(parseInt(hex.slice(i,i+2),16)/255).toFixed(8)).join(' '),'Ka 0.05 0.05 0.05','Ks 0 0 0','Ns 8','d 1','illum 2','');}
  const outputs=[['model.json',json,d.caps.json_bytes],['model.obj',obj.join('\n')+'\n',d.caps.obj_bytes],['model.mtl',mtl.join('\n'),d.caps.mtl_bytes]];for(const [name,s,cap]of outputs)assert(Buffer.byteLength(s)<=cap,name+' bytecap');check();
  const out=path.join(here,'out');fs.mkdirSync(out);for(const [name,s]of outputs)fs.writeFileSync(path.join(out,name),s,{flag:'wx'});
  const result={schema:'Ari-first-bomber-CPU-result-v1',utc:new Date().toISOString(),pid:process.pid,argv:process.argv,designSha256:sha(db),counts,partChecks,contactCount:contacts.length,checkedPostImportMs:performance.now()-entered,sampledRSS:process.memoryUsage().rss,outputs:outputs.map(([name,s])=>({path:path.join(out,name),bytes:Buffer.byteLength(s),sha256:sha(Buffer.from(s))})),scope:'Finite material topology/contact/export checks only; no selfintersection/globalfit, physical layers, cloth/rig/motion/runtime/AAA or appearance proof'};fs.writeFileSync(path.join(here,'BUILD-RESULT.json'),JSON.stringify(result,null,2)+'\n',{flag:'wx'});process.stdout.write(JSON.stringify(result)+'\n');
}catch(e){process.stderr.write(JSON.stringify({status:'failed',pid:process.pid,utc:new Date().toISOString(),error:String(e),checkedPostImportMs:performance.now()-entered,scope:'No retry; preserve all partial outputs and root inventory'})+'\n');process.exitCode=1;}
