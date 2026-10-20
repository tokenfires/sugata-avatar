'use strict';
// Inert until separate source A and a fresh, exact root ADMISSION.
// One foreground CPU mesh authoring + depth raster + PNG encoding job.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const BASE = __dirname;
const ROOT = '/Users/robault/GitHub/sugata-avatar';
const OLD = path.join(ROOT,'docs/evidence/appearance-2026-10-05/overshirt-first-view/export');
const SHARP = '/Users/robault/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp';
const OUT = path.join(BASE,'../overshirt-finish-3d-result');
const WIDTH=1800, HEIGHT=1400, MAX_MS=30000;
const started=Date.now();
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const must=(v,m)=>{if(!v)throw Error(m);};
function budget(){
  must(Date.now()-started < MAX_MS,'elapsed observation exceeded 30s');
  must(process.resourceUsage().maxRSS <= 1048576,'observed peak exceeded 1GiB');
}
function verifyPin(p){
  const st=fs.statSync(p.path);
  must(st.isFile() && st.size===p.bytes,'input size/type changed: '+p.path);
  const h=crypto.createHash('sha256'),buf=Buffer.alloc(65536);
  const fd=fs.openSync(p.path,'r');
  try{let n;while((n=fs.readSync(fd,buf,0,buf.length,null))>0){h.update(buf.subarray(0,n));budget();}}
  finally{fs.closeSync(fd);}
  must(h.digest('hex')===p.sha256,'input digest changed: '+p.path);
}
const add=(a,b)=>a.map((x,i)=>x+b[i]);
const sub=(a,b)=>a.map((x,i)=>x-b[i]);
const mul=(a,s)=>a.map(x=>x*s);
const dot=(a,b)=>a.reduce((n,x,i)=>n+x*b[i],0);
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const norm=a=>{const n=Math.hypot(...a);must(n>1e-12,'zero normal');return mul(a,1/n);};
const mix=(a,b,t)=>a.map((x,i)=>x*(1-t)+b[i]*t);
function writeNew(name,bytes,cap){
  const b=Buffer.isBuffer(bytes)?bytes:Buffer.from(bytes);
  must(b.length<=cap,'output too large: '+name);
  fs.writeFileSync(path.join(OUT,name),b,{flag:'wx',mode:0o644});
  return {file:name,bytes:b.length,sha256:sha(b)};
}
function construct(old){
  must(old.positions.length===215 && old.quads.length===188,'base count changed');
  must(old.vertex_labels.length===215 && old.face_roles.length===188,'base ownership changed');
  const positions=old.positions.map(p=>p.slice()), labels=old.vertex_labels.slice();
  const ids=new Map(labels.map((s,i)=>[s,i]));
  const get=s=>{must(ids.has(s),'unknown literal vertex '+s);return ids.get(s);};
  const newPoint=(label,p)=>{
    must(!ids.has(label) && p.length===3 && p.every(Number.isFinite),'invalid new vertex');
    const i=positions.length;positions.push(p.map(x=>Math.round(x*1e8)/1e8));labels.push(label);ids.set(label,i);return i;
  };
  let faces=[];
  const tri=(a,b,c,owner)=>{must(new Set([a,b,c]).size===3,'repeated face corner');faces.push({v:[a,b,c],owner:{...owner}});};
  const quad=(a,b,c,d,owner)=>{tri(a,b,c,owner);tri(a,c,d,owner);};
  const setKey=q=>q.slice().sort((a,b)=>a-b).join(':');
  const slitFaces=new Set();
  for(const side of ['left','right'])for(const c of [0,1]){
    const n=c+1;
    slitFaces.add(setKey([get(side+'.sleeve.2.'+c),get(side+'.sleeve.2.'+n),
      get(side+'.sleeve.3.'+n),get(side+'.sleeve.3.'+c)]));
  }
  const changed=[];
  old.quads.forEach((q,i)=>{
    const role=old.face_roles[i];
    if(role==='collar_stand'||role==='collar_leaf'||role==='cuff_band'||slitFaces.has(setKey(q))){
      changed.push({oldFace:i,oldRole:role,reason:role.startsWith('collar')?'new layered collar':role==='cuff_band'?'new open/lapped cuff':'real V slit'});return;
    }
    const side=old.vertex_labels[q[0]].startsWith('left.')?'left':old.vertex_labels[q[0]].startsWith('right.')?'right':'body';
    const cuffView=role==='sleeve' && q.some(v=>old.vertex_labels[v].startsWith('left.sleeve.3.'));
    quad(...q,{kind:'retained',oldFace:i,role,side,part:cuffView?'left_cuff':'body'});
  });
  must(changed.length===32,'literal removed face set changed');
  // Replacement collar has the actual retained neck interface, a low stand,
  // and an explicitly chosen larger point/back edge. No old vertex is moved.
  const neck=old.seams.neck;
  must(JSON.stringify(neck)==='[24,112,98,99,100,160,49]','neck interface changed');
  const stand=neck.map((v,i)=>newPoint('finish.stand.'+i,add(positions[v],[0,.055,0])));
  const edge=[[-.34,1.08,.34],[-.34,1.30,.015],[-.30,1.285,-.30],
    [0,1.31,-.31],[.30,1.285,-.30],[.34,1.30,.015],[.34,1.08,.34]]
    .map((p,i)=>newPoint('finish.leaf.'+i,p));
  for(let i=0;i<6;i++){
    quad(neck[i],neck[i+1],stand[i+1],stand[i],{kind:'authored',role:'stand',side:'body',part:'collar'});
    quad(stand[i],stand[i+1],edge[i+1],edge[i],{kind:'authored',role:'upper_collar',side:'body',part:'collar'});
  }
  const splits=new Map();
  function edgePoint(a,b,t,label){
    if(t===0)return a;if(t===1)return b;
    const lo=Math.min(a,b),hi=Math.max(a,b),s=a===lo?t:1-t,key=lo+':'+hi;
    if(!splits.has(key))splits.set(key,{a:lo,b:hi,points:[]});
    const row=splits.get(key),found=row.points.find(x=>Math.abs(x.t-s)<1e-10);
    if(found)return found.id;
    const id=newPoint(label,mix(positions[a],positions[b],t));row.points.push({t:s,id});return id;
  }
  const buttons=[];
  const cuffInterfaces=[];
  for(const [side,sgn] of [['left',-1],['right',1]]){
    const r=c=>get(side+'.sleeve.2.'+c),w=c=>get(side+'.sleeve.3.'+c);
    const tip=r(1),slitA=newPoint(side+'.finish.slitA',add(positions[w(1)],[sgn*.014,.002,0]));
    const slitB=newPoint(side+'.finish.slitB',add(positions[w(1)],[-sgn*.014,-.002,0]));
    const owner={kind:'authored',role:'sleeve_slit',side,part:side+'_cuff'};
    quad(r(0),tip,slitB,w(0),owner);
    quad(tip,r(2),w(2),slitA,owner);
    const top=[slitA,w(2),w(3),w(4),w(5),w(6),w(7),w(0),slitB];
    const angles=[100,45,0,-45,-90,-135,-180,-225,-280];
    const bottom=angles.map((degrees,i)=>{
      const a=degrees*Math.PI/180,rad=i===8?.195:.161;
      return newPoint(side+'.finish.cuffBottom.'+i,
        [sgn*(.90+Math.sin(1.42)*Math.cos(a)*rad),.105+Math.cos(1.42)*Math.cos(a)*rad,Math.sin(a)*rad]);
    });
    let holeChart=null;
    for(let j=0;j<8;j++){
      const own={kind:'authored',role:j===0?'cuff_underlap':j===7?'cuff_overlap':'cuff_band',side,part:side+'_cuff'};
      const a=top[j],b=top[j+1],c=bottom[j+1],d=bottom[j];
      if(j!==7){quad(a,b,c,d,own);continue;}
      const us=[0,.70,.99,1],vs=[0,.51,.61,1],grid=[];
      const chart=(u,v)=>mix(mix(positions[a],positions[b],u),mix(positions[d],positions[c],u),v);
      for(let vi=0;vi<4;vi++){
        const row=[];
        for(let ui=0;ui<4;ui++){
          const u=us[ui],v=vs[vi],label=side+'.finish.holeGrid.'+vi+'.'+ui;
          let id;
          if(v===0)id=edgePoint(a,b,u,label);
          else if(v===1)id=edgePoint(d,c,u,label);
          else if(u===0)id=edgePoint(a,d,v,label);
          else if(u===1)id=edgePoint(b,c,v,label);
          else id=newPoint(label,chart(u,v));
          row.push(id);
        }grid.push(row);
      }
      for(let v=0;v<3;v++)for(let u=0;u<3;u++){
        if(u===1&&v===1)continue; // a real open slot, not a painted line
        quad(grid[v][u],grid[v][u+1],grid[v+1][u+1],grid[v+1][u],own);
      }
      const u=.845,v=.56,center=chart(u,v),eps=.0001;
      let n=norm(cross(sub(chart(u+eps,v),chart(u-eps,v)),sub(chart(u,v+eps),chart(u,v-eps))));
      if(n[2]<0)n=mul(n,-1);
      holeChart={center,normal:n,boundary:[grid[1][1],grid[1][2],grid[2][2],grid[2][1]]};
      buttons.push({side,center,normal:n,part:side+'_cuff'});
    }
    must(holeChart,'missing authored hole');
    cuffInterfaces.push({side,retainedTip:tip,slitA,slitB,top,bottom,hole:holeChart.boundary,
      limits:'lap depth and stem contact are artist choices, not collision/sewing proof'});
  }
  // Insert every registered edge point into both incident triangles. New
  // triangles remain in each original triangle's plane; no T-junction rescue.
  const expanded=[];
  for(const f of faces){
    const boundary=[];
    for(let i=0;i<3;i++){
      const a=f.v[i],b=f.v[(i+1)%3];boundary.push(a);
      const row=splits.get(Math.min(a,b)+':'+Math.max(a,b));
      if(row){const xs=row.points.slice().sort((x,y)=>x.t-y.t);if(a> b)xs.reverse();boundary.push(...xs.map(x=>x.id));}
    }
    if(boundary.length===3){expanded.push(f);continue;}
    const p=boundary.map(i=>positions[i]).reduce((a,b)=>add(a,b),[0,0,0]).map(x=>x/boundary.length);
    const center=newPoint('finish.edgeSplitCenter.'+expanded.length,p);
    for(let i=0;i<boundary.length;i++)expanded.push({v:[center,boundary[i],boundary[(i+1)%boundary.length]],owner:{...f.owner}});
  }
  faces=expanded;
  function incidence(fsx){
    const edges=new Map();
    fsx.forEach((f,i)=>f.v.forEach((a,k)=>{
      const b=f.v[(k+1)%3],key=Math.min(a,b)+':'+Math.max(a,b);
      if(!edges.has(key))edges.set(key,[]);edges.get(key).push({face:i,a,b});
    }));return edges;
  }
  function orient(fsx,expectComponents){
    const edges=incidence(fsx),adj=fsx.map(()=>[]);
    for(const es of edges.values()){
      must(es.length<=2,'nonmanifold edge before shell');
      if(es.length===2){const [a,b]=es,same=a.a===b.a;adj[a.face].push([b.face,same]);adj[b.face].push([a.face,same]);}
    }
    const flip=new Array(fsx.length).fill(null);let components=0;
    for(let first=0;first<fsx.length;first++){
      if(flip[first]!==null)continue;components++;flip[first]=false;const queue=[first];
      for(let qi=0;qi<queue.length;qi++){
        const i=queue[qi];for(const [j,same] of adj[i]){
          const need=Boolean(flip[i]!==same);
          if(flip[j]===null){flip[j]=need;queue.push(j);}else must(flip[j]===need,'nonorientable source');
        }
      }
    }
    must(components===expectComponents,'unexpected surface component count');
    fsx.forEach((f,i)=>{if(flip[i])f.v.reverse();});
    return incidence(fsx);
  }
  const outerEdges=orient(faces,1);
  const boundary=[...outerEdges.values()].filter(x=>x.length===1).map(x=>x[0]);
  const freeAdj=new Map();
  for(const e of boundary)for(const [a,b] of [[e.a,e.b],[e.b,e.a]]){
    if(!freeAdj.has(a))freeAdj.set(a,[]);freeAdj.get(a).push(b);
  }
  for(const ns of freeAdj.values())must(ns.length===2,'branched outer opening');
  const seen=new Set();let loops=0;
  for(const a of freeAdj.keys())if(!seen.has(a)){
    loops++;const queue=[a];seen.add(a);
    for(let qi=0;qi<queue.length;qi++)for(const b of freeAdj.get(queue[qi]))if(!seen.has(b)){seen.add(b);queue.push(b);}
  }
  must(loops===5,'need front/hem/collar, two wrist/slit and two slot loops');
  const outerCount=positions.length,outerFaceCount=faces.length;
  const sums=Array.from({length:outerCount},()=>[0,0,0]),used=new Set();
  for(const f of faces){
    const [a,b,c]=f.v,n=cross(sub(positions[b],positions[a]),sub(positions[c],positions[a]));
    must(Math.hypot(...n)>1e-10,'degenerate outer triangle');
    for(const i of f.v){sums[i]=add(sums[i],n);used.add(i);}
  }
  const inner=new Map();
  for(const i of used){
    const facing=/^(left|right)\.front\.\d\.4$/.test(labels[i]),edge=/^(left|right)\.front\.\d\.3$/.test(labels[i]);
    const thickness=facing?.025:edge?.018:.012;
    inner.set(i,newPoint(labels[i]+'.inside',sub(positions[i],mul(norm(sums[i]),thickness))));
  }
  const outer=faces.slice();
  for(const f of outer){
    const role=f.owner.role==='upper_collar'?'undercollar':
      f.owner.role==='front_facing'?'facing_return':f.owner.role;
    faces.push({v:[inner.get(f.v[2]),inner.get(f.v[1]),inner.get(f.v[0])],
      owner:{...f.owner,role,layer:'inner'}});
    f.owner.layer='outer';
  }
  for(const e of boundary){
    const parent=outer[e.face],face=f=>({...parent.owner,...f});
    const role=parent.owner.role==='front_facing'?'front_edge_turn':parent.owner.part==='collar'?'collar_rim':'opening_rim';
    quad(e.b,e.a,inner.get(e.a),inner.get(e.b),face({kind:'authored',role,layer:'rim'}));
  }
  const garmentFaces=faces.length;
  const closed=orient(faces,1);
  must([...closed.values()].every(es=>es.length===2),'garment shell has an unclosed rim');
  // Two separate closed button solids, with stems through the actual slots.
  for(const b of buttons){
    const n=b.normal,t=norm(cross([0,1,0],n)),v=norm(cross(n,t));
    const profile=[[-.030,.004],[.012,.004],[.012,.018],[.019,.018]];
    const rings=profile.map(([z,r],k)=>Array.from({length:16},(_,i)=>{
      const a=i*Math.PI/8;
      return newPoint(b.side+'.button.'+k+'.'+i,add(add(b.center,mul(n,z)),add(mul(t,r*Math.cos(a)),mul(v,r*Math.sin(a)))));
    }));
    const own={kind:'authored',role:'button',layer:'solid',side:b.side,part:b.part};
    for(let k=0;k<3;k++)for(let i=0;i<16;i++)quad(rings[k][i],rings[k][(i+1)%16],rings[k+1][(i+1)%16],rings[k+1][i],own);
    const low=newPoint(b.side+'.button.foot',add(b.center,mul(n,-.030))),high=newPoint(b.side+'.button.top',add(b.center,mul(n,.019)));
    for(let i=0;i<16;i++){tri(low,rings[0][(i+1)%16],rings[0][i],own);tri(high,rings[3][i],rings[3][(i+1)%16],own);}
  }
  orient(faces,3);
  must([...incidence(faces).values()].every(es=>es.length===2),'final open or nonmanifold solid edge');
  must(positions.length<=5000 && faces.length<=10000,'pre-export geometry budget');
  const links=new Map();
  for(const f of faces)for(let k=0;k<3;k++){
    const v=f.v[k],a=f.v[(k+1)%3],b=f.v[(k+2)%3];
    if(!links.has(v))links.set(v,new Map());const link=links.get(v);
    for(const [x,y]of [[a,b],[b,a]]){if(!link.has(x))link.set(x,new Set());link.get(x).add(y);}
  }
  for(const link of links.values()){
    for(const ns of link.values())must(ns.size===2,'noncyclic closed vertex link');
    const queue=[link.keys().next().value],seen=new Set(queue);
    for(let i=0;i<queue.length;i++)for(const n of link.get(queue[i]))if(!seen.has(n)){seen.add(n);queue.push(n);}
    must(seen.size===link.size,'disconnected closed vertex link');
  }
  const finalUsed=[...new Set(faces.flatMap(f=>f.v))].sort((a,b)=>a-b);
  const remap=new Map(finalUsed.map((oldId,i)=>[oldId,i]));
  const finalPositions=finalUsed.map(i=>positions[i]),finalLabels=finalUsed.map(i=>labels[i]);
  const triangles=faces.map(f=>f.v.map(i=>remap.get(i)));
  must(finalPositions.length<=5000 && triangles.length<=10000,'geometry budget');
  for(const q of triangles){const [a,b,c]=q.map(i=>finalPositions[i]);must(Math.hypot(...cross(sub(b,a),sub(c,a)))>1e-10,'final degenerate triangle');}
  const originalVertexMap={};finalUsed.forEach((i,j)=>{if(i<215)originalVertexMap[i]=j;});
  const interfaces={neck:neck.map(i=>remap.get(i)),cuffs:cuffInterfaces.map(x=>({
    side:x.side,tip:remap.get(x.retainedTip),slitA:remap.get(x.slitA),slitB:remap.get(x.slitB),
    hole:x.hole.map(i=>remap.get(i)),limits:x.limits})),outerOpeningLoops:loops,garmentFaces,outerFaceCount};
  return {positions:finalPositions,labels:finalLabels,triangles,owners:faces.map(f=>f.owner),
    originalVertexMap,removedOldFaces:changed,interfaces,counts:{vertices:finalPositions.length,triangles:triangles.length,components:3,allEdgesTwoFaces:true,closedVertexLinksConnected:true},
    limits:['Unitless authored shell; not a sewing pattern, body fit, cloth or collision proof',
      'Body outer vertices retained; exact changed collar/cuff faces and new inside depth are explicit',
      'Button/underlap stem contact is intentional artist assembly, not mechanical closure simulation',
      'Original coarse shoulder/profile and all other unqualified broad character goals remain']};
}
function material(o){
  if(o.role==='button')return {name:'button',rgb:[218,204,174]};
  if(o.role==='front_edge_turn')return {name:'turn',rgb:[153,104,49]};
  if(o.layer==='rim')return {name:'rim',rgb:[84,93,67]};
  if(o.layer==='inner'&&(o.role==='undercollar'||o.role==='facing_return'||o.role==='stand'||o.role.startsWith('cuff')))return {name:'inside',rgb:[212,199,170]};
  if(o.layer==='inner')return {name:'reverse',rgb:[154,161,133]};
  return {name:'olive',rgb:[108,118,91]};
}
const views=[
 {name:'FRONT / COMPLETE ASSEMBLY',box:[40,175,840,520],target:[0,.75,0],toward:[-.16,.08,1],scale:345,select:()=>true},
 {name:'REAR / COMPLETE ASSEMBLY',box:[920,175,840,520],target:[0,.75,0],toward:[.16,.08,-1],scale:345,select:()=>true},
 {name:'INSIDE / FRONT + COLLAR ONLY',box:[40,790,840,520],target:[0,.75,.1],toward:[.14,.08,-1],scale:385,
  select:o=>o.part==='collar'||(o.layer==='inner'&&['front_panel','front_facing','facing_return','hem_band'].includes(o.role)&&o.side!=='body')||o.role==='front_edge_turn'},
 {name:'LEFT CUFF / SLIT, LAP + REAL SLOT',box:[920,790,840,520],target:[-.90,.255,.03],toward:[.12,.10,1],scale:1400,select:o=>o.part==='left_cuff'}
];
function raster(mesh){
  const pixels=Buffer.alloc(WIDTH*HEIGHT*4),depth=new Float32Array(WIDTH*HEIGHT);
  for(let i=0;i<WIDTH*HEIGHT;i++){pixels[i*4]=240;pixels[i*4+1]=241;pixels[i*4+2]=233;pixels[i*4+3]=255;}
  const stats=[];
  const light=norm([-.35,.7,1]);
  for(const view of views){
    depth.fill(-Infinity);
    const [bx,by,bw,bh]=view.box,cx=bx+bw/2,cy=by+bh/2;
    for(let y=by;y<by+bh;y++)for(let x=bx;x<bx+bw;x++){const i=(y*WIDTH+x)*4;pixels[i]=255;pixels[i+1]=253;pixels[i+2]=248;}
    const toward=norm(view.toward),right=norm(cross([0,1,0],toward)),up=norm(cross(toward,right));
    const p=mesh.positions.map(v=>{const d=sub(v,view.target);return [cx+view.scale*dot(d,right),cy-view.scale*dot(d,up),dot(d,toward)];});
    let selected=0,written=0;
    for(let fi=0;fi<mesh.triangles.length;fi++){
      if((fi&31)===0)budget();
      const owner=mesh.owners[fi];if(!view.select(owner))continue;selected++;
      const q=mesh.triangles[fi],a=p[q[0]],b=p[q[1]],c=p[q[2]];
      const den=(b[1]-c[1])*(a[0]-c[0])+(c[0]-b[0])*(a[1]-c[1]);if(Math.abs(den)<1e-9)continue;
      const n=norm(cross(sub(mesh.positions[q[1]],mesh.positions[q[0]]),sub(mesh.positions[q[2]],mesh.positions[q[0]])));
      const diffuse=.42+.58*Math.abs(dot(n,light)),rgb=material(owner).rgb.map(x=>Math.round(Math.min(255,x*diffuse)));
      const xmin=Math.max(bx,Math.floor(Math.min(a[0],b[0],c[0]))),xmax=Math.min(bx+bw-1,Math.ceil(Math.max(a[0],b[0],c[0])));
      const ymin=Math.max(by,Math.floor(Math.min(a[1],b[1],c[1]))),ymax=Math.min(by+bh-1,Math.ceil(Math.max(a[1],b[1],c[1])));
      for(let y=ymin;y<=ymax;y++){
        if((y&63)===0)budget();
        for(let x=xmin;x<=xmax;x++){
          const xx=x+.5,yy=y+.5;
          const u=((b[1]-c[1])*(xx-c[0])+(c[0]-b[0])*(yy-c[1]))/den;
          const v=((c[1]-a[1])*(xx-c[0])+(a[0]-c[0])*(yy-c[1]))/den,w=1-u-v;
          if(u< -1e-7||v< -1e-7||w< -1e-7)continue;
          const z=u*a[2]+v*b[2]+w*c[2],idx=y*WIDTH+x;
          if(z<=depth[idx])continue;
          depth[idx]=z;const i=idx*4;pixels[i]=rgb[0];pixels[i+1]=rgb[1];pixels[i+2]=rgb[2];written++;
        }
      }
    }
    must(selected>0&&written>0,'empty selected view');stats.push({name:view.name,selectedTriangles:selected,depthWrites:written});
  }
  return {pixels,stats,explicitRawBufferBytes:pixels.length+depth.byteLength};
}
function labelsSVG(){
  return '<svg xmlns="http://www.w3.org/2000/svg" width="1800" height="1400">'+
    '<style>text{font-family:Arial,sans-serif;fill:#26352f}.h{font-size:28px;font-weight:bold}.s{font-size:20px;fill:#53604f}</style>'+
    '<text x="40" y="58" style="font: bold 39px Arial,sans-serif;fill:#26352f">OLIVE OVERSHIRT / EDITABLE 3D FINISHING STUDY</text>'+
    '<text x="42" y="100" class="s">One authored derivative. Original coarse body retained; collar, inside return and opening cuffs developed in depth.</text>'+
    views.map((v,i)=>'<text x="'+v.box[0]+'" y="'+(i<2?152:767)+'" class="h">'+v.name.replace(/&/g,'&amp;')+'</text>').join('')+
    '<text x="42" y="727" class="s">Complete original body/sleeve proportions remain unitless artist choices.</text>'+
    '<text x="922" y="727" class="s">Actual triangle geometry; orthographic CPU depth raster, no native/runtime proof.</text>'+
    '<text x="42" y="1344" class="s">Inside view hides back, sleeves and outer fronts; it does not unfold or move the selected surfaces.</text>'+
    '<text x="42" y="1380" class="s">Original finishing intent. No sewing, body fit, cloth motion, collision or AAA character qualification.</text></svg>';
}
async function main(){
  must(!fs.existsSync(OUT),'sole result leaf already exists');
  const admission=JSON.parse(fs.readFileSync(path.join(BASE,'ADMISSION.json'),'utf8'));
  must(admission.contract==='overshirt-finish-3d-sole-cpu-v1'&&admission.allowance===1,'no exact root admission');
  const age=Date.now()-Date.parse(admission.issuedUTC);
  must(Number.isFinite(age)&&age>=0&&age<=120000&&Date.now()<Date.parse(admission.deadlineUTC),'expired admission');
  must(process.version==='v24.19.0','runtime version changed');
  for(const p of admission.pins)verifyPin(p);
  fs.mkdirSync(OUT);
  writeNew('CLAIM.json',JSON.stringify({contract:admission.contract,pid:process.pid,startedUTC:new Date(started).toISOString(),source:sha(fs.readFileSync(__filename))})+'\n',8192);
  const bytes=fs.readFileSync(path.join(OLD,'mesh.json'));must(bytes.length===30694&&sha(bytes)==='bac92957a37762cc8c2b5b472ed9946f2b3c13882c38cd716f58b393faab86db','changed mesh');
  const old=JSON.parse(bytes);
  const obj=fs.readFileSync(path.join(OLD,'overshirt.obj'));must(obj.length===11321&&sha(obj)==='368844a36162638e7453c57849a64acfcb2b6eb79bbf7a22692d3f56af19a868','changed OBJ');
  const vs=[],qs=[];for(const line of obj.toString('utf8').split('\n')){
    if(line.startsWith('v '))vs.push(line.slice(2).split(/\s+/).map(Number));
    if(line.startsWith('f '))qs.push(line.slice(2).split(/\s+/).map(x=>Number(x)-1));
  }
  must(JSON.stringify(vs)===JSON.stringify(old.positions)&&JSON.stringify(qs)===JSON.stringify(old.quads),'base OBJ/JSON association failed');
  const mesh=construct(old);budget();
  const render=raster(mesh);budget();
  const sharp=require(SHARP);must(sharp.versions.sharp==='0.35.5','renderer version changed');
  sharp.cache(false);sharp.concurrency(1);const warnings=[];
  const png=await sharp(render.pixels,{raw:{width:WIDTH,height:HEIGHT,channels:4},limitInputPixels:2520000,unlimited:false,failOn:'warning'})
    .composite([{input:Buffer.from(labelsSVG()),top:0,left:0,density:72,failOn:'warning',limitInputPixels:2520000}])
    .on('warning',m=>warnings.push(String(m))).png().toBuffer();
  budget();must(!warnings.length,'encoder warning');
  must(png.length<=4194304&&png.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])),'PNG type/size');
  must(png.readUInt32BE(16)===WIDTH&&png.readUInt32BE(20)===HEIGHT,'PNG dimensions');
  const lines=['# Original Cora-authored derivative; unitless artist mesh','mtllib finish.mtl'];
  for(const p of mesh.positions)lines.push('v '+p.map(x=>x.toFixed(8)).join(' '));
  let last='';
  for(let i=0;i<mesh.triangles.length;i++){
    const o=mesh.owners[i],key=o.part+'_'+o.role+'_'+o.layer,m=material(o).name;
    if(last!==key){lines.push('g '+key);last=key;}
    lines.push('usemtl '+m,'f '+mesh.triangles[i].map(x=>x+1).join(' '));
  }
  const materials=[['olive',[108,118,91]],['inside',[212,199,170]],['reverse',[154,161,133]],['turn',[153,104,49]],['rim',[84,93,67]],['button',[218,204,174]]];
  const mtl=materials.map(([name,rgb])=>'newmtl '+name+'\nKd '+rgb.map(x=>(x/255).toFixed(6)).join(' ')+'\n').join('\n');
  const data={title:'Original unitless overshirt3D finishing derivative',units:'unitless',axes:old.axes,sourceMeshSHA256:sha(bytes),sourceOBJsha256:sha(obj),...mesh,views:views.map(({select,...v})=>v),render:render.stats};
  const json=JSON.stringify(data,null,2)+'\n',outOBJ=lines.join('\n')+'\n';
  must(Buffer.byteLength(json)+Buffer.byteLength(outOBJ)+Buffer.byteLength(mtl)+8192<=2097152,'export aggregate limit');
  const outputs=[writeNew('mesh.json',json,1310720),writeNew('finish.obj',outOBJ,524288),writeNew('finish.mtl',mtl,8192),writeNew('finish.png',png,4194304)];
  budget();
  console.log(JSON.stringify({status:'complete',pid:process.pid,node:process.version,sharp:sharp.versions.sharp,elapsedMS:Date.now()-started,maxRSSKiB:process.resourceUsage().maxRSS,
    outputs,counts:mesh.counts,views:render.stats,explicitRawBufferBytes:render.explicitRawBufferBytes,warnings,scope:'Unitless artist3D source and one CPU depth preview only; appearance requires actual image review.'}));
}
const timer=setTimeout(()=>{console.error(JSON.stringify({status:'cooperative-timeout',pid:process.pid,elapsedMS:Date.now()-started}));process.exit(124);},29000);timer.unref();
main().catch(error=>{console.error(JSON.stringify({status:'failed',pid:process.pid,error:String(error),elapsedMS:Date.now()-started}));process.exitCode=1;}).finally(()=>clearTimeout(timer));
