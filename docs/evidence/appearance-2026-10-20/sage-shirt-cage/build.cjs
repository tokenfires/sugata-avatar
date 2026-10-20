'use strict';
// New literal garment cage only. No old producer, model, renderer or body input.
const fs=require('node:fs'), path=require('node:path'), crypto=require('node:crypto');
const base=__dirname, started=Date.now();
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const need=(v,s)=>{if(!v)throw Error(s);};
const avg=a=>[0,1,2].map(k=>a.reduce((s,p)=>s+p[k],0)/a.length);
const add=(a,b)=>a.map((v,k)=>v+b[k]);
const mul=(a,s)=>a.map(v=>v*s);
const sub=(a,b)=>a.map((v,k)=>v-b[k]);
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const norm=a=>Math.hypot(...a);
const unit=a=>{const n=norm(a);need(n>1e-10,'zero normal');return mul(a,1/n);};
const key=(a,b)=>a<b?`${a}:${b}`:`${b}:${a}`;
const canonical=a=>{
  const candidates=[];
  for(const row of [a,[...a].reverse()])for(let i=0;i<row.length;i++)candidates.push([...row.slice(i),...row.slice(0,i)].join(','));
  return candidates.sort()[0];
};
const timer=setTimeout(()=>{console.error(JSON.stringify({status:'cooperative-timeout',pid:process.pid,elapsedMS:Date.now()-started}));process.exit(124);},19000);
timer.unref();

function topology(m){
  need(m.v.length<=20000&&m.q.length<=20000,'mesh cap');
  need(m.v.every(p=>p.length===3&&p.every(Number.isFinite)),'nonfinite coordinate');
  const em=new Map(),neighbors=m.v.map(()=>new Set()),incident=m.v.map(()=>[]),links=m.v.map(()=>new Map()),seen=new Set();
  const link=(v,a,b)=>{if(!links[v].has(a))links[v].set(a,new Set());links[v].get(a).add(b);};
  m.q.forEach((f,fi)=>{
    need(f.v.length===4&&new Set(f.v).size===4&&f.v.every(v=>Number.isInteger(v)&&v>=0&&v<m.v.length),'invalid quad');
    const signature=[...f.v].sort((a,b)=>a-b).join(',');need(!seen.has(signature),'duplicate quad');seen.add(signature);
    f.v.forEach((a,i)=>{
      const b=f.v[(i+1)%4],p=f.v[(i+3)%4],k=key(a,b);
      if(!em.has(k))em.set(k,{a:Math.min(a,b),b:Math.max(a,b),uses:[]});
      em.get(k).uses.push({fi,a,b});neighbors[a].add(b);neighbors[b].add(a);incident[a].push(fi);link(a,p,b);link(a,b,p);
    });
  });
  const edges=[...em.values()],boundary=m.v.map(()=>[]);
  for(const e of edges){
    need(e.uses.length===1||e.uses.length===2,'nonmanifold edge');
    if(e.uses.length===2)need(e.uses[0].a===e.uses[1].b&&e.uses[0].b===e.uses[1].a,'orientation conflict');
    else{boundary[e.a].push(e.b);boundary[e.b].push(e.a);}
  }
  m.v.forEach((p,v)=>{
    need(incident[v].length>0&&neighbors[v].size<=16,'orphan or valence cap');
    need(boundary[v].length===0||boundary[v].length===2,'branching boundary');
    const graph=links[v],queue=[graph.keys().next().value],visited=new Set(queue);
    for(let i=0;i<queue.length;i++)for(const n of graph.get(queue[i]))if(!visited.has(n)){visited.add(n);queue.push(n);}
    need(visited.size===graph.size,'disconnected vertex fan');
    const degrees=[...graph.values()].map(s=>s.size);
    need(boundary[v].length?degrees.filter(n=>n===1).length===2&&degrees.every(n=>n===1||n===2):degrees.every(n=>n===2),'invalid vertex link');
  });
  const all=new Set([0]),queue=[0];
  for(let i=0;i<queue.length;i++)for(const n of neighbors[queue[i]])if(!all.has(n)){all.add(n);queue.push(n);}
  need(all.size===m.v.length,'disconnected main surface');
  const left=new Set(boundary.flatMap((a,v)=>a.length?[v]:[])),cycles=[];
  while(left.size){
    const start=left.values().next().value,row=[];let prev=-1,cur=start;
    do{need(left.has(cur),'boundary walk conflict');left.delete(cur);row.push(cur);const n=boundary[cur].find(x=>x!==prev);prev=cur;cur=n;need(row.length<=m.v.length,'boundary cycle cap');}while(cur!==start);
    cycles.push(row);
  }
  need(cycles.length===4&&m.v.length-edges.length+m.q.length===-2,'four-opening genus-zero gate');
  for(const [a,b]of m.hard)need(em.has(key(a,b))&&em.get(key(a,b)).uses.length===2,'invalid interior hard edge');
  // Fixed diagonal, tested both as authored doubles and renderer-facing Float32 values.
  let minimumCross=Infinity;
  for(const f of m.q)for(const tri of [[f.v[0],f.v[1],f.v[2]],[f.v[0],f.v[2],f.v[3]]]){
    for(const fp32 of [false,true]){
      const p=tri.map(i=>m.v[i].map(x=>fp32?Math.fround(x):x));const n=norm(cross(sub(p[1],p[0]),sub(p[2],p[0])));
      need(Number.isFinite(n)&&n>1e-9,'degenerate triangle');minimumCross=Math.min(minimumCross,n);
    }
  }
  return{edges,neighbors,incident,boundary,cycles,minimumCross,counts:[m.v.length,edges.length,m.q.length]};
}

function refine(m,t){
  const facePoints=m.q.map(f=>avg(f.v.map(i=>m.v[i]))),edgeIndex=new Map();
  const hard=new Set(m.hard.map(([a,b])=>key(a,b)));
  t.edges.forEach((e,i)=>{edgeIndex.set(key(e.a,e.b),m.v.length+i);if(e.uses.length===1)hard.add(key(e.a,e.b));});
  const points=m.v.map((p,i)=>{
    const sharp=[...t.neighbors[i]].filter(n=>hard.has(key(i,n)));
    if(sharp.length>=3)return[...p];
    if(sharp.length===2)return add(mul(p,.75),mul(add(m.v[sharp[0]],m.v[sharp[1]]),.125));
    const n=t.neighbors[i].size;need(n===t.incident[i].length,'smooth vertex valence');
    // Selected smooth mask: (n-2)/n self plus neighbor and face-center weights1/n².
    return add(mul(p,(n-2)/n),mul(add(t.incident[i].reduce((s,f)=>add(s,facePoints[f]),[0,0,0]),[...t.neighbors[i]].reduce((s,v)=>add(s,m.v[v]),[0,0,0])),1/(n*n)));
  });
  for(const e of t.edges)points.push(hard.has(key(e.a,e.b))?avg([m.v[e.a],m.v[e.b]]):avg([m.v[e.a],m.v[e.b],facePoints[e.uses[0].fi],facePoints[e.uses[1].fi]]));
  const faceBase=points.length;points.push(...facePoints);const quads=[];
  m.q.forEach((f,fi)=>f.v.forEach((v,i)=>quads.push({v:[v,edgeIndex.get(key(v,f.v[(i+1)%4])),faceBase+fi,edgeIndex.get(key(f.v[(i+3)%4],v))],feature:f.feature,origin:f.origin})));
  const nextHard=m.hard.flatMap(([a,b])=>{const e=edgeIndex.get(key(a,b));return[[a,e],[e,b]];});
  return{v:points,q:quads,hard:nextHard};
}

function triangleList(q){return q.flatMap(f=>[[f.v[0],f.v[1],f.v[2]],[f.v[0],f.v[2],f.v[3]]]);}
function button(m,parent,spec){
  const faces=m.q.filter(f=>f.origin===parent);need(faces.length===16,'button parent coverage');
  const centre=avg(faces.map(f=>avg(f.v.map(i=>m.v[i]))));
  const n=unit(faces.reduce((s,f)=>add(s,cross(sub(m.v[f.v[1]],m.v[f.v[0]]),sub(m.v[f.v[2]],m.v[f.v[0]]))),[0,0,0]));
  need(n[2]>.5,'button front orientation');const c=add(centre,mul(n,spec.normalOffset)),u=unit(cross([0,1,0],n)),v=cross(n,u),positions=[c],triangles=[];
  for(let i=0;i<spec.segments;i++){const a=2*Math.PI*i/spec.segments;positions.push(add(c,add(mul(u,spec.radius*Math.cos(a)),mul(v,spec.radius*Math.sin(a)))));}
  for(let i=0;i<spec.segments;i++)triangles.push([0,1+i,1+(i+1)%spec.segments]);
  return{name:'button-'+parent,feature:'buttons',positions,triangles,parent,relation:spec.relation};
}

(async()=>{
  const ab=fs.readFileSync(path.join(base,'CPU-ADMISSION.json')),a=JSON.parse(ab),issued=Date.parse(a.issuedUTC),deadline=Date.parse(a.deadlineUTC);
  need(a.contract==='sage-shirt-cage-first-cpu-v1'&&a.allowance===1&&Number.isFinite(issued)&&Number.isFinite(deadline)&&Date.now()>=issued&&Date.now()-issued<120000&&Date.now()<deadline,'no finite fresh CPU admission');
  for(const p of a.pins){const b=fs.readFileSync(p.path);need(b.length===p.bytes&&sha(b)===p.sha256,'changed CPU input:'+p.path);}
  const used=fs.openSync(path.join(base,'CPU-ADMISSION.used'),'wx');try{fs.writeFileSync(used,JSON.stringify({at:new Date().toISOString(),pid:process.pid,admissionSHA256:sha(ab)})+'\n');fs.fsyncSync(used);}finally{fs.closeSync(used);}
  const cb=fs.readFileSync(path.join(base,'cage.json'));need(cb.length<32768,'cage byte cap');const c=JSON.parse(cb);
  need(c.schema==='original-sage-shirt-cage-1'&&c.refinements===2,'wrong cage schema');
  const names=Object.keys(c.vertices),id=new Map(names.map((n,i)=>[n,i]));need(names.length===102&&c.faces.length===87,'literal cage count');
  need(new Set(c.faces.map(f=>f[0])).size===87,'duplicate face owner');
  let m={v:names.map(n=>c.vertices[n]),q:c.faces.map(([origin,feature,v])=>({origin,feature,v:v.map(n=>{need(id.has(n),'missing literal vertex');return id.get(n);})})),hard:c.hardEdges.map(e=>e.map(n=>id.get(n)))};
  const stages=[];
  for(let s=0;s<=2;s++){
    const t=topology(m);need(t.counts.every((v,i)=>v===c.expectedStages[s][i]),'stage count mismatch');
    const lengths=t.cycles.map(v=>v.length).sort((a,b)=>a-b);need(JSON.stringify(lengths)===JSON.stringify([4,4,10,16].map(n=>n*2**s).sort((a,b)=>a-b)),'boundary length mismatch');
    if(s===0)need(JSON.stringify(t.cycles.map(canonical).sort())===JSON.stringify(Object.values(c.boundaries).map(row=>canonical(row.map(n=>id.get(n)))).sort()),'named boundary mismatch');
    stages.push({step:s,counts:t.counts,boundaryLengths:lengths,minimumTriangleCross:t.minimumCross,hardInteriorEdges:m.hard.length});
    if(s<2)m=refine(m,t);
  }
  const features=[...new Set(m.q.map(f=>f.feature))];need(features.every(f=>/^#[0-9a-f]{6}$/i.test(c.palette[f])),'unknown material owner');
  // Shared positions are serialized once for the surface; markers own their own disc arrays.
  const model={schema:'sage-shirt-artist-mesh-1',sourceSHA256:sha(cb),units:c.units,scope:c.scope,stages,palette:c.palette,positions:m.v,quads:m.q,hardEdges:m.hard,buttons:c.buttons.parentFaces.map(p=>button(m,p,c.buttons))};
  need(model.buttons.length===4&&model.buttons.every(p=>p.positions.flat().every(Number.isFinite)),'marker scope');
  let obj='# Original unfitted sage shirt artist mid-surface\nmtllib shirt.mtl\no shirt-surface\n';
  for(const v of m.v)obj+='v '+v.join(' ')+'\n';
  for(const feature of features){obj+='g '+feature+'\nusemtl '+feature+'\n';for(const tri of triangleList(m.q.filter(f=>f.feature===feature)))obj+='f '+tri.map(i=>i+1).join(' ')+'\n';}
  let offset=m.v.length+1;
  for(const p of model.buttons){
    obj+='o '+p.name+'\nusemtl '+p.feature+'\n';for(const v of p.positions)obj+='v '+v.join(' ')+'\n';for(const tri of p.triangles)obj+='f '+tri.map(i=>i+offset).join(' ')+'\n';offset+=p.positions.length;
  }
  const mtl=Object.entries(c.palette).map(([name,hex])=>'newmtl '+name+'\nKd '+[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)/255).join(' ')+'\n').join('\n');
  const buffers={'model.json':Buffer.from(JSON.stringify(model)+'\n'),'shirt.obj':Buffer.from(obj),'shirt.mtl':Buffer.from(mtl)};
  const sum=Object.values(buffers).reduce((s,b)=>s+b.length,0);need(sum<1800000,'output byte cap');
  need(Date.now()-started<20000&&process.resourceUsage().maxRSS<=1048576,'observed CPU resource refusal');
  const output=path.join(base,'trial-001');fs.mkdirSync(output);
  const artifacts=[];
  for(const [name,b]of Object.entries(buffers)){const fd=fs.openSync(path.join(output,name),'wx');try{fs.writeFileSync(fd,b);fs.fsyncSync(fd);}finally{fs.closeSync(fd);}artifacts.push({name,bytes:b.length,sha256:sha(b)});}
  const receipt={status:'CPU_DATA_ONLY',at:new Date().toISOString(),pid:process.pid,sourceSHA256:sha(cb),stages,surfaceQuads:m.q.length,surfaceTriangles:m.q.length*2,decorativeDiscs:4,globalIntersectionOrPhysicalFit:false,artifacts,elapsedMS:Date.now()-started,maxRSSKiB:process.resourceUsage().maxRSS,limits:'Finite source/topology/Float32 support only; no actual3D image, assembled closure, fitted body, native GPU release or complete avatar qualification.'};
  const rb=Buffer.from(JSON.stringify(receipt,null,2)+'\n');need(sum+rb.length<2097152,'total output cap');const fd=fs.openSync(path.join(output,'BUILD-RESULT.json'),'wx');try{fs.writeFileSync(fd,rb);fs.fsyncSync(fd);}finally{fs.closeSync(fd);}
  need(Date.now()-started<20000&&process.resourceUsage().maxRSS<=1048576,'final observed CPU resource refusal');
  console.log(JSON.stringify({status:'complete',pid:process.pid,sourceSHA256:sha(cb),receiptSHA256:sha(rb),artifacts:artifacts.concat({name:'BUILD-RESULT.json',bytes:rb.length,sha256:sha(rb)}),elapsedMS:Date.now()-started,maxRSSKiB:process.resourceUsage().maxRSS}));
})().catch(e=>{console.error(JSON.stringify({status:'failed',pid:process.pid,error:String(e),elapsedMS:Date.now()-started}));process.exitCode=1;}).finally(()=>clearTimeout(timer));
