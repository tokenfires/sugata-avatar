import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {performance} from 'node:perf_hooks';

// New original geometry. No old garment, producer, body or native pipeline imports.
const here=path.dirname(fileURLToPath(import.meta.url)),out=path.join(here,'out');
const start=performance.now(),sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const plus=(a,b)=>a.map((v,k)=>v+b[k]),minus=(a,b)=>a.map((v,k)=>v-b[k]);
const times=(a,s)=>a.map(v=>v*s),dot=(a,b)=>a.reduce((s,v,k)=>s+v*b[k],0);
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const unit=a=>{const q=Math.hypot(...a);if(!(q>1e-12))throw Error('zero normal');return times(a,1/q);};
const mix=(a,b,t)=>plus(times(a,1-t),times(b,t));
const need=(v,s)=>{if(!v)throw Error(s);};
const key=(a,b)=>a<b?`${a}:${b}`:`${b}:${a}`;
const json=x=>JSON.stringify(x,null,2)+'\n';
const stamp=()=>({utc:new Date().toISOString(),pid:process.pid});
let d,admission,phase='entry',partial,registered=[];
function guard(){
  need(d&&admission,'missing guards');
  need(performance.now()-start<d.caps.checked_cpu_ms,'cooperative post-import CPU ceiling');
  need(process.memoryUsage().rss<d.caps.sampled_rss_bytes,'sampled RSS ceiling');
  need(Date.now()<Date.parse(d.absolute_stop_utc)&&Date.now()<Date.parse(admission.absolute_deadline_utc),'absolute deadline');
}
function stage(s){phase=s;guard();partial={...stamp(),phase:s,status:'IN_PROGRESS',registered:[...registered]};fs.writeFileSync(path.join(out,'PARTIAL.json'),json(partial));}
function pin(p){const b=fs.readFileSync(p);return {path:p,bytes:b.length,sha256:sha(b)};}
function triangle(v,material,role,owner){return {v,material,role,owner};}
function quad(f,a,b,c,e,material,role,owner){f.push(triangle([a,b,c],material,role,owner),triangle([a,c,e],material,role,owner));}
function edgeMap(f){const e=new Map();f.forEach((t,i)=>{for(let k=0;k<3;k++){const a=t.v[k],b=t.v[(k+1)%3],s=key(a,b);if(!e.has(s))e.set(s,[]);e.get(s).push({a,b,i});}});return e;}
function boundaries(f){
  const next=new Map(),incoming=new Set();
  for(const uses of edgeMap(f).values()){
    need(uses.length<=2,'more than two edge uses');
    if(uses.length===2)need(uses[0].a===uses[1].b&&uses[0].b===uses[1].a,'edge directions');
    else{const {a,b}=uses[0];need(!next.has(a)&&!incoming.has(b),'branching boundary');next.set(a,b);incoming.add(b);}
  }
  need(next.size===incoming.size&&[...next.keys()].every(i=>incoming.has(i)),'incomplete boundary');
  const left=new Set(next.keys()),loops=[];
  while(left.size){const first=left.values().next().value,loop=[];let p=first;while(left.has(p)){loop.push(p);left.delete(p);p=next.get(p);}need(p===first,'nonclosing boundary');loops.push(loop);}
  return loops;
}
function compact(v,f){const used=[...new Set(f.flatMap(t=>t.v))].sort((a,b)=>a-b),map=new Map(used.map((x,i)=>[x,i]));return {v:used.map(i=>v[i]),f:f.map(t=>({...t,v:t.v.map(i=>map.get(i))})),map};}
function folded(q,weight){if(q===d.pleat.hinge_sample)return [d.pleat.hinge_dx*d.pleat.scale*weight,d.pleat.hinge_dz*d.pleat.scale*weight];if(q===d.pleat.lip_sample)return [d.pleat.lip_dx*d.pleat.scale*weight,d.pleat.lip_dz*d.pleat.scale*weight];return [0,0];}
function legPoint(sign,row,j){
  const [y,c,rx,fd,bd,crease]=row,N=d.leg_samples,t=2*Math.PI*j/N;
  const cosine=j===0?1:j===N/2?-1:Math.cos(t),sine=j===0||j===N/2?0:Math.sin(t);
  const q=sign>0?j:N/2-j;
  return [sign*c+rx*cosine,y,(sine>=0?fd:bd)*sine+(q===d.pleat.lip_sample?crease:0)];
}
function originalSurface(){
  const v=[],f=[],N=d.leg_samples,M=2*N,legs={};let saddle;
  for(const sign of [1,-1]){
    const rows=[];
    for(let i=0;i<d.leg_rows.length;i++){
      const ring=[];
      for(let j=0;j<N;j++){
        const shared=i===d.leg_rows.length-1&&((sign>0&&j===N/2)||(sign<0&&j===0));
        if(shared&&saddle!==undefined)ring.push(saddle);
        else{ring.push(v.length);if(shared)saddle=v.length;v.push(legPoint(sign,d.leg_rows[i],j));}
      }
      if(i)for(let j=0;j<N;j++)quad(f,rows[i-1][j],ring[j],ring[(j+1)%N],rows[i-1][(j+1)%N],i===1?'band':'cloth',i===1?'hem':'leg',`leg:${sign}:${i}:${j}`);
      rows.push(ring);
    }
    legs[sign]=rows;
  }
  need(saddle!==undefined&&v[saddle][0]===0&&v[saddle][2]===0,'explicit saddle');
  const positive=legs[1].at(-1),negative=legs[-1].at(-1);
  const combined=[...positive.slice(0,N/2),...negative,...positive.slice(N/2)];
  need(combined.length===M&&combined[N/2]===combined[3*N/2],'figure-eight shared saddle');
  const grid=[combined];
  for(let i=0;i<d.pelvis_rows.length;i++){
    const [y,rx,fd,bd,blend,fold,pocketShift,crease]=d.pelvis_rows[i],ring=[];
    for(let j=0;j<M;j++){
      const t=2*Math.PI*j/M,s=Math.sin(t),c=Math.cos(t),base=[rx*c,y,(s>=0?fd:bd)*s];
      const q=j<=N?Math.min(j,N-j):-1,side=j<N/2?1:-1;
      const p=mix([v[combined[j]][0],y,v[combined[j]][2]],base,blend),delta=folded(q,fold);
      p[0]+=side*delta[0];p[2]+=delta[1]+(q===d.pleat.lip_sample?crease:0);
      const mouthWeight=q>=1&&q<=9?Math.min(1,(q-1)/2,(9-q)/2):0;p[0]+=side*pocketShift*mouthWeight;
      if(y>=d.rear_gather.start_y&&j>N){const wave=d.rear_gather.amplitude*Math.sin((j-N)/N*Math.PI*d.rear_gather.cycles);p[0]+=wave*c;p[2]+=wave*s;}
      ring.push(v.length);v.push(p);
    }
    grid.push(ring);
  }
  const inRect=(r,j,rs,cs)=>r>=rs[0]&&r<rs[1]&&j>=cs[0]&&j<cs[1];
  for(let r=0;r<grid.length-1;r++)for(let j=0;j<M;j++){
    if(inRect(r,j,d.pockets.upper_grid_rows,d.pockets.positive_side_columns)||inRect(r,j,d.pockets.upper_grid_rows,d.pockets.negative_side_columns)||inRect(r,j,d.fly.notch_rows,d.fly.notch_columns))continue;
    const jj=(j+1)%M,material=r>=6?'band':'cloth';
    quad(f,grid[r][j],grid[r+1][j],grid[r+1][jj],grid[r][jj],material,r>=6?(j<N?'front-band':'rear-band'):'pelvis',`pelvis:${r}:${j}`);
  }
  const mouthLoops=boundaries(f),mouths=[];
  for(const [id,sign,cols] of [['L',1,d.pockets.positive_side_columns],['R',-1,d.pockets.negative_side_columns]]){
    const rs=d.pockets.upper_grid_rows,set=new Set();
    for(let r=rs[0];r<=rs[1];r++)for(let j=cols[0];j<=cols[1];j++)if(r===rs[0]||r===rs[1]||j===cols[0]||j===cols[1])set.add(grid[r][j]);
    const mouth=mouthLoops.find(a=>a.length===14&&a.every(x=>set.has(x)));need(mouth,'14-node literal shell mouth');
    const center=times(mouth.reduce((a,i)=>plus(a,v[i]),[0,0,0]),1/mouth.length);let prev=mouth;
    const added=[];
    for(let k=0;k<d.pockets.new_rings.length;k++){
      const [scale,dx,dy,dz]=d.pockets.new_rings[k],ring=mouth.map(i=>{const p=plus(center,times(minus(v[i],center),scale));p[0]+=sign*dx;p[1]+=dy;p[2]+=dz;const n=v.length;v.push(p);added.push(n);return n;});
      // Reverse the existing boundary direction so each shared mouth edge opposes its shell use.
      for(let j=0;j<14;j++){const jj=(j+1)%14;quad(f,prev[jj],prev[j],ring[j],ring[jj],'bag',`bag-${id}`,`bag:${id}:${k}:${j}`);}prev=ring;
    }
    const p=times(prev.reduce((a,i)=>plus(a,v[i]),[0,0,0]),1/14);p[1]-=d.pockets.cap_extra_drop;const cap=v.length;v.push(p);added.push(cap);
    for(let j=0;j<14;j++)f.push(triangle([prev[(j+1)%14],prev[j],cap],'bag',`bag-${id}`,`bag:${id}:floor`));
    mouths.push({id,mouth,added});
  }
  const c=compact(v,f),map=c.map;
  return {...c,saddle:map.get(saddle),grid:grid.map(a=>a.map(i=>map.get(i))),mouths:mouths.map(m=>({id:m.id,mouth:m.mouth.map(i=>map.get(i)),added:m.added.map(i=>map.get(i))}))};
}
function thicken(name,v,f,width){
  guard();const loops=boundaries(f),n=v.map(()=>[0,0,0]);
  for(const t of f){const [a,b,c]=t.v.map(i=>v[i]),q=cross(minus(b,a),minus(c,a));for(const i of t.v)n[i]=plus(n[i],q);}
  const normals=n.map(unit),V=[...v.map(p=>[...p]),...v.map((p,i)=>minus(p,times(normals[i],width)))],F=f.map(t=>({...t,v:[...t.v],side:'outer'}));
  for(const t of f)F.push({...t,v:[t.v[0]+v.length,t.v[2]+v.length,t.v[1]+v.length],material:t.role.startsWith('bag-')?'bag':'inside',side:'inner'});
  for(let k=0;k<loops.length;k++){const ring=loops[k];for(let j=0;j<ring.length;j++){const a=ring[j],b=ring[(j+1)%ring.length];const start=F.length;quad(F,a,a+v.length,b+v.length,b,'inside','opening-rim',`${name}:rim:${k}:${j}`);F[start].side=F[start+1].side='rim';}}
  return {name,positions:V,triangles:F,source:{outer_vertices:v.length,outer_triangles:f.length,normal_offset:width,boundary_cycles:loops,area_weighted_normals:normals}};
}
function stripSurface(rows,name,material){const v=rows.flatMap(row=>row.map(p=>[...p])),f=[];for(let i=0;i<rows.length-1;i++)quad(f,2*i,2*i+2,2*i+3,2*i+1,material,name,`${name}:${i}`);return {v,f};}
function extraLayers(s,main){
  const overlap=[],underlap=[],range=[];
  for(let r=d.fly.notch_rows[0];r<=d.fly.notch_rows[1];r++){
    const a=s.grid[r][d.fly.overlap_root_column],b=s.grid[r][d.fly.guard_root_column],center=s.grid[r][32];
    // The centre vertex is deliberately absent above the notch floor; use the mean of owned two edges.
    const front=center===undefined?(main.positions[a][2]+main.positions[b][2])/2:main.positions[center][2];
    const A=main.positions[a],B=main.positions[b];
    overlap.push([[...A],[d.fly.overlap_free_x,A[1],front+d.fly.overlap_forward]]);
    underlap.push([[d.fly.guard_free_x,B[1],front+d.fly.guard_forward],[...B]]);
    range.push({r,a,b});
  }
  const a=stripSurface(overlap,'overlap','cloth'),b=stripSurface(underlap,'guard','cloth');
  const O=thicken('overlap',a.v,a.f,d.fly.thickness),G=thicken('guard',b.v,b.f,d.fly.thickness);
  const ot=overlap.map(row=>{const p=row[1];return [[p[0]+d.fly.tape_width,p[1],p[2]+d.fly.tape_forward],[...p]];});
  const gt=underlap.map(row=>{const p=row[0];return [[...p],[p[0]-d.fly.tape_width,p[1],p[2]+d.fly.tape_forward]];});
  const c=stripSurface(ot,'overlap-tape','tape'),e=stripSurface(gt,'guard-tape','tape');
  const OT=thicken('overlap-tape',c.v,c.f,d.fly.tape_thickness),GT=thicken('guard-tape',e.v,e.f,d.fly.tape_thickness),contacts=[];
  range.forEach((x,i)=>{
    contacts.push({a:['shell',x.a],b:['overlap',2*i],intent:'wearer-left notch root'}, {a:['shell',x.b],b:['guard',2*i+1],intent:'wearer-right guard root'}, {a:['overlap',2*i+1],b:['overlap-tape',2*i+1],intent:'static overlap tape root'}, {a:['guard',2*i],b:['guard-tape',2*i],intent:'static guard tape root'});
  });
  return {parts:[O,G,OT,GT],contacts};
}
function validate(p){
  guard();const v=p.positions,f=p.triangles,E=edgeMap(f),adj=f.map(()=>[]),links=v.map(()=>new Map());let volume=0,minArea=Infinity,minF32=Infinity;
  need(v.length<d.caps.vertices&&f.length<d.caps.triangles,'per part workload');
  for(const q of v)need(q.length===3&&q.every(Number.isFinite),'nonfinite position');
  f.forEach((t,index)=>{
    need(t.v.length===3&&new Set(t.v).size===3&&t.v.every(i=>Number.isInteger(i)&&i>=0&&i<v.length),'triangle indices');need(d.materials[t.material],'material missing');
    const [a,b,c]=t.v.map(i=>v[i]),area=Math.hypot(...cross(minus(b,a),minus(c,a)));need(area>1e-12,'zero area');minArea=Math.min(minArea,area);volume+=dot(a,cross(b,c))/6;
    const [a32,b32,c32]=[a,b,c].map(q=>q.map(Math.fround)),af=Math.hypot(...cross(minus(b32,a32),minus(c32,a32)));need(af>1e-12,'predicted Float32 collapse');minF32=Math.min(minF32,af);
    for(let k=0;k<3;k++){const at=t.v[k],x=t.v[(k+1)%3],y=t.v[(k+2)%3];if(!links[at].has(x))links[at].set(x,new Set());if(!links[at].has(y))links[at].set(y,new Set());links[at].get(x).add(y);links[at].get(y).add(x);}
    if(index%512===0)guard();
  });
  for(const uses of E.values()){need(uses.length===2,'closed part edge multiplicity');const [a,b]=uses;need(a.a===b.b&&a.b===b.a,'closed orientation');adj[a.i].push(b.i);adj[b.i].push(a.i);}
  const seen=new Set([0]),todo=[0];while(todo.length){for(const i of adj[todo.pop()])if(!seen.has(i)){seen.add(i);todo.push(i);}}need(seen.size===f.length,'disconnected part');
  for(const link of links){need(link.size>2&&[...link.values()].every(a=>a.size===2),'vertex link degree');const a=link.keys().next().value,seen=new Set([a]),todo=[a];while(todo.length)for(const q of link.get(todo.pop()))if(!seen.has(q)){seen.add(q);todo.push(q);}need(seen.size===link.size,'disconnected vertex link');}
  need(volume>0,'positive oriented volume');return {vertices:v.length,triangles:f.length,edges:E.size,euler:v.length-E.size+f.length,signed_volume:volume,min_doubled_area:minArea,min_predicted_float32_doubled_area:minF32,scope:'Finite closed graph/area/vertexlinks only; no globalintersection/clearance/physicalfit.'};
}
function save(name,b,cap){guard();need(b.length<=cap,'output byte ceiling '+name);const p=path.join(out,name);fs.writeFileSync(p,b,{flag:'wx'});const item=pin(p);registered.push(item);need(registered.reduce((n,x)=>n+x.bytes,0)<d.caps.total_output_bytes,'total export ceiling');return item;}
try{
  fs.writeFileSync(path.join(here,'ENTRY.json'),json({...stamp(),argv:process.argv,source:pin(fileURLToPath(import.meta.url)),status:'ONE_ENTRY_CONSUMED'}),{flag:'wx'});
  admission=JSON.parse(fs.readFileSync(path.join(here,'CPU-ADMISSION.json'),'utf8'));const raw=fs.readFileSync(path.join(here,'design.json'));
  need(process.argv.length===3&&sha(raw)===process.argv[2],'design argument identity');d=JSON.parse(raw);guard();
  need(admission.status==='ADMITTED_ONE_CPU'&&Array.isArray(admission.inputs),'admission missing');for(const x of admission.inputs){const a=pin(x.path);need(a.bytes===x.bytes&&a.sha256===x.sha256,'admission drift '+x.path);guard();}
  need(d.leg_samples===64&&d.leg_rows.length===9&&d.pelvis_rows.length===7,'fixed finite workload');
  fs.mkdirSync(out);stage('new original outer surface');const s=originalSurface();const outerLoops=boundaries(s.f);
  need(s.v.length===d.forecast.outer_used_vertices&&s.f.length===d.forecast.outer_triangles,'outer source forecast');
  need(outerLoops.length===3&&outerLoops.reduce((n,a)=>n+a.length,0)===d.forecast.outer_boundary_edges,'outer boundary forecast');
  stage('complete inward faces and layer parts');const shell=thicken('shell',s.v,s.f,d.thickness),extra=extraLayers(s,shell),parts=[shell,...extra.parts];
  const proofs=parts.map(validate),vertices=proofs.reduce((n,p)=>n+p.vertices,0),triangles=proofs.reduce((n,p)=>n+p.triangles,0);
  need(parts.length===d.forecast.parts&&vertices===d.forecast.closed_vertices&&triangles===d.forecast.closed_triangles,'full source forecast');
  need(extra.contacts.length===d.forecast.contacts,'contact forecast');const lookup=new Map(parts.map(p=>[p.name,p]));
  const contacts=extra.contacts.map(c=>{const a=lookup.get(c.a[0]).positions[c.a[1]],b=lookup.get(c.b[0]).positions[c.b[1]],distance=Math.hypot(...minus(a,b));need(distance===0,'noncoincident declared contact');return {...c,distance};});
  stage('serialize exact artist exports');
  const model={schema:'sugata-original-ari-trouser-mesh-v1',...stamp(),design_sha256:sha(raw),coordinates:d.coordinates,parts,proofs,mouths:s.mouths,saddle:s.saddle,contacts,totals:{parts:parts.length,vertices,triangles},materials:d.materials,limits:d.limits};
  const modelPin=save('model.json',Buffer.from(json(model)),d.caps.model_bytes);
  let obj='# Original unitless Ari trouser artist volume. No physical fit.\nmtllib trousers.mtl\n',offset=1;
  for(const p of parts){obj+='o '+p.name+'\n';for(const q of p.positions)obj+='v '+q.map(x=>x.toFixed(8)).join(' ')+'\n';let material='';for(const t of p.triangles){if(t.material!==material){obj+='usemtl '+t.material+'\n';material=t.material;}obj+='f '+t.v.map(i=>i+offset).join(' ')+'\n';}offset+=p.positions.length;}
  const objPin=save('trousers.obj',Buffer.from(obj),d.caps.obj_bytes);let mtl='# Original artist colour intent; roughness stored in JSON.\n';
  for(const [name,m] of Object.entries(d.materials)){const rgb=[1,3,5].map(k=>parseInt(m.color.slice(k,k+2),16)/255);mtl+=`newmtl ${name}\nKd ${rgb.map(x=>x.toFixed(8)).join(' ')}\nKa 0 0 0\nKs 0 0 0\nillum 1\n\n`;}
  const mtlPin=save('trousers.mtl',Buffer.from(mtl),d.caps.mtl_bytes);stage('complete');
  const result={...stamp(),status:'COMPLETE',phase:'complete',post_import_elapsed_ms:performance.now()-start,sampled_rss_bytes:process.memoryUsage().rss,totals:model.totals,proofs,contacts:contacts.length,exports:[modelPin,objPin,mtlPin],partial:pin(path.join(out,'PARTIAL.json')),limits:'Internal cooperative time/RSS samples only, not OS startup/peak/failure-path tests. Result excludes its own impossible self hash; root must independently inventory all actual entries. No appearance/physicalclearance/fit/runtime qualification.'};
  fs.writeFileSync(path.join(out,'RESULT.json'),json(result),{flag:'wx'});console.log(json({...result,exports:result.exports.map(x=>({bytes:x.bytes,sha256:x.sha256,path:x.path}))}));
}catch(error){
  const failure={...stamp(),status:'FAILED',phase,error:String(error?.stack||error),registered,post_import_elapsed_ms:performance.now()-start,limits:'Best effort failure receipt. Root must inventory actual outputs and collect the actual process result; this list is not exhaustive filesystem proof.'};
  try{fs.writeFileSync(path.join(here,'BUILD-FAILED.json'),json(failure),{flag:'wx'});}catch(recordError){console.error('failure receipt write failed',String(recordError));}
  console.error(json(failure));process.exitCode=1;
}
