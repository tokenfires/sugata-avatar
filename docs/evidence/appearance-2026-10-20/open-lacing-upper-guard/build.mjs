// Original unitless artist construction; execution requires the separate source/workload gate.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {add,sub,mul,dot,cross,norm,lerp,mean,Mesh,checkMesh,checkLace,checkCrossings,renderPacket} from './mesh-tools.mjs';
const BASE=path.dirname(fileURLToPath(import.meta.url));
const OUT=path.join(BASE,'output');
const ORIGINAL=path.resolve(BASE,'../../appearance-2026-10-05/boot-artist-first-view/export/mesh.json');
const ORIGINAL_SHA='798002bbe3c6e05d90a156d99403ff22066c0c38a8150410ebb47fde7713a0c5';
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const need=(v,s)=>{if(!v)throw new Error('REFUSE: '+s);};
need(!fs.existsSync(OUT),'output directory must not preexist; one invocation only');
fs.mkdirSync(OUT);
let stage='input';
const status=(state,extra={})=>fs.writeFileSync(path.join(OUT,'STATUS.json'),JSON.stringify({UTC:new Date().toISOString(),pid:process.pid,state,stage,...extra},null,2)+'\n');
status('running');
try {
 const raw=fs.readFileSync(ORIGINAL);need(raw.length===760165&&sha(raw)===ORIGINAL_SHA,'original master identity');
 const old=JSON.parse(raw);
 need(old.units==='unitless'&&old.pair.left_offset_x===-.62&&old.positions.length===2720&&old.triangles.length===5288,'bound source frame/structure');
 const mesh=new Mesh();const retained=[];
 for(const id of ['left.nominal','left.sole','left.heel']){
  const p=old.parts.find(p=>p.id===id);need(p,'retained source ID '+id);
  const q=mesh.part(id,p.role,p.color,p.visible);const map=new Map();
  for(const v of p.vertex_ids){const n=mesh.vertex(q,'original:'+v,old.positions[v].slice());map.set(v,n);}
  for(const f of p.face_ids){need(old.face_parts[f]===id,'source face owner');mesh.triangle(q,...old.triangles[f].map(v=>{need(map.has(v),'source face operand');return map.get(v);}));}
  q.interfaces=Object.fromEntries(Object.entries(p.named_interfaces).map(([key,val])=>[key,val]));
  q.originalVertexIds=p.vertex_ids.slice();q.originalFaceIds=p.face_ids.slice();q.interfaceIndexSpace='original master IDs, not new mesh IDs';
  for(const [v,n] of map)need(JSON.stringify(mesh.positions[n])===JSON.stringify(old.positions[v]),'immutable ingredient values');
  retained.push({id,vertices:p.vertex_ids.length,faces:p.face_ids.length,sourceSHA256:ORIGINAL_SHA});
 }
 stage='new-upper';
 // New artist chart; these explicit shape choices reuse only the coarse silhouette vocabulary.
 // No original producer import, no body/fit/measurement source, no original upper behind ports.
 const SHAPE=[[.14,.40,-.55,1.30],[.22,.42,-.56,1.29],[.36,.41,-.55,1.18],[.52,.35,-.53,.92],[.69,.27,-.51,.40],[.84,.235,-.50,.20],[1.01,.24,-.49,.21],[1.20,.25,-.47,.23]];
 const THETA=[-Math.PI,-2.75,-2.4,-2.05,-1.7,-1.3,-.9,-.4,0,.4,.9,1.3,1.7,2.05,2.4,2.75,Math.PI];
 const Y=[.14,.22,.36,.52,.62,.72,.82,.92,1.02,1.12,1.20];
 const C=THETA.length-1;
 function shape(y){for(let j=0;j<SHAPE.length-1;j++){const a=SHAPE[j],b=SHAPE[j+1];if(y>=a[0]-1e-9&&y<=b[0]+1e-9){const t=(y-a[0])/(b[0]-a[0]);return a.map((v,k)=>v+(b[k]-v)*t);}}throw new Error('REFUSE: shape range');}
 function surface(theta,y,inner=false){let [_,w,rear,toe]=shape(y);if(inner){w-=.035;rear+=.03;toe-=.03;}
  const yy=inner&&y<.22?y+.03*(.22-y)/.08:y;
  return [-.62+w*Math.sin(theta)*(1+.10*Math.cos(theta)),yy,(rear+toe)/2+(toe-rear)/2*Math.cos(theta)];}
 function normal(theta,y){const e=1e-5;const yl=Math.max(.14,y-e),yr=Math.min(1.2,y+e);return norm(cross(sub(surface(theta+e,y),surface(theta-e,y)),sub(surface(theta,yr),surface(theta,yl))));}
 const upper=mesh.part('new.upper','perforated_upper','#67442f');const keys=new Map(),paired=new Map();
 const gridPoint=(u,v,inner)=>{
  const u0=Math.floor(u),v0=Math.min(Y.length-2,Math.floor(v));const ut=u-u0,vt=v-v0;
  const theta=u===C?THETA[C]:THETA[u0]+(THETA[u0+1]-THETA[u0])*ut;
  const y=Y[v0]+(Y[v0+1]-Y[v0])*vt;return surface(theta,y,inner);
 };
 function gv(u,v,inner){const key=(inner?'i:':'o:')+(u===C?0:u)+':'+v;
  if(!keys.has(key))keys.set(key,mesh.vertex(upper,key,gridPoint(u,v,inner)));return keys.get(key);}
 function pair(a,b){paired.set(a,b);}
 const boundaryUV=[[0,0],[.5,0],[1,0],[1,.5],[1,1],[.5,1],[0,1],[0,.5]];
 const ports=[];const outerFaces=[];
 for(let j=0;j<Y.length-1;j++)for(let i=0;i<C;i++){
  if(j>=3&&i>=7&&i<=8)continue; // Actual U-shaped lacing channel, no hidden cover.
  const B=boundaryUV.map(([u,v])=>gv(i+u,j+v,false));const I=boundaryUV.map(([u,v])=>gv(i+u,j+v,true));B.forEach((a,k)=>pair(a,I[k]));
  const isPort=j>=3&&j<=8&&(i===6||i===9);
  let H,HI;
  if(isPort){const theta=(THETA[i]+THETA[i+1])/2,y=(Y[j]+Y[j+1])/2;
   H=[];HI=[];
   for(let k=0;k<8;k++){const a=5*Math.PI/4+k*Math.PI/4;const t=theta+.16*Math.cos(a),yy=y+.032*Math.sin(a);
    H.push(mesh.vertex(upper,`port.${i}.${j}.outer.${k}`,surface(t,yy)));HI.push(mesh.vertex(upper,`port.${i}.${j}.inner.${k}`,surface(t,yy,true)));pair(H[k],HI[k]);}
   ports.push({id:`port.${i}.${j}`,theta,y,outer:H,inner:HI,boundary:B,innerBoundary:I,normal:normal(theta,y),wallFaces:[],row:j-3,side:i===6?'negativeX':'positiveX'});
  }else{
   const o=mesh.vertex(upper,`cell.${i}.${j}.center.outer`,gridPoint(i+.5,j+.5,false));
   const n=mesh.vertex(upper,`cell.${i}.${j}.center.inner`,gridPoint(i+.5,j+.5,true));
   for(let k=0;k<8;k++){outerFaces.push(mesh.triangle(upper,o,B[k],B[(k+1)%8]));mesh.triangle(upper,n,I[(k+1)%8],I[k]);}
  }
  if(isPort)for(let k=0;k<8;k++){const n=(k+1)%8;outerFaces.push(...mesh.quad(upper,B[k],B[n],H[n],H[k]));mesh.quad(upper,I[k],HI[k],HI[n],I[n]);}
 }
 // Derive every material rim from authored outer skin boundary, with exact paired IDs.
 const edges=new Map();
 for(const f of outerFaces){const t=mesh.triangles[f];for(let k=0;k<3;k++){const a=t[k],b=t[(k+1)%3],key=Math.min(a,b)+':'+Math.max(a,b);const e=edges.get(key);if(e)e.n++;else edges.set(key,{a,b,n:1});}}
 const bottomOuter=[],bottomInner=[];
 for(const {a,b,n} of edges.values())if(n===1){need(paired.has(a)&&paired.has(b),'all material boundary vertices paired');
  if(mesh.positions[a][1]===.14&&mesh.positions[b][1]===.14)continue;
  const made=mesh.quad(upper,b,a,paired.get(a),paired.get(b));
  const port=ports.find(p=>p.outer.includes(a)&&p.outer.includes(b));if(port)port.wallFaces.push(...made);
 }
 for(let i=0;i<C;i++)for(const u of [i,i+.5]){bottomOuter.push(gv(u,0,false));bottomInner.push(gv(u,0,true));}
 const ob=mesh.vertex(upper,'outer.floor.center',[-.62,.14,.375]),ib=mesh.vertex(upper,'inner.floor.center',[-.62,.17,.375]);
 for(let k=0;k<bottomOuter.length;k++){const n=(k+1)%bottomOuter.length;mesh.triangle(upper,ob,bottomOuter[n],bottomOuter[k]);mesh.triangle(upper,ib,bottomInner[k],bottomInner[n]);}
 upper.interfaces={channel:{theta:[-.4,.4],fromY:.52,toY:1.20,removedCells:[7,8]},ports:ports.map(p=>({id:p.id,row:p.row,side:p.side,outer:p.outer,inner:p.inner,wallFaces:p.wallFaces})),bottomOuter,bottomInner};
 need(ports.length===12,'twelve real upper ports');
 stage='eyelets';
 for(const p of ports){const q=mesh.part('new.eyelet.'+p.id,'eyelet_sleeve','#ad8e56');
  p.outerCenter=mean(p.outer.map(v=>mesh.positions[v]));p.innerCenter=mean(p.inner.map(v=>mesh.positions[v]));
  const loops=[[],[],[],[],[],[]];
  for(let k=0;k<8;k++){
   const h=mesh.positions[p.outer[k]],hi=mesh.positions[p.inner[k]],b=mesh.positions[p.boundary[k]],bi=mesh.positions[p.innerBoundary[k]],n=p.normal;
   const points=[add(lerp(h,b,.18),mul(n,.006)),add(lerp(p.outerCenter,h,.72),mul(n,.006)),sub(lerp(p.innerCenter,hi,.72),mul(n,.006)),sub(lerp(hi,bi,.18),mul(n,.006)),hi,h];
   for(let l=0;l<6;l++)loops[l].push(mesh.vertex(q,`ring.${l}.${k}`,points[l].slice()));
  }
  // Closed annular cross-section B,C,D,E,F,A; lumen C-D stays empty.
  const contactFaces=[];for(let l=0;l<6;l++)for(let k=0;k<8;k++){const n=(k+1)%8;const made=mesh.quad(q,loops[l][k],loops[l][n],loops[(l+1)%6][n],loops[(l+1)%6][k]);if(l===4)contactFaces.push(...made);}
  q.interfaces={upperPort:p.id,outerLumen:loops[1],innerLumen:loops[2],materialContactLoops:[loops[4],loops[5]],materialContactFaces:contactFaces,upperContactFaces:p.wallFaces,notPhysicalFastenerQualification:true};p.hardwarePart=q.id;
 }
 stage='tongue';
 const tongue=mesh.part('new.tongue','separate_tongue','#392c24');const ty=[.505,.52,.62,.69,.72,.82,.84,.92,1.01,1.02,1.12,1.18],tRows=[];
 for(let j=0;j<ty.length;j++){
  const y=ty[j],half=.075,z=surface(0,y)[2]-.15;
  tRows.push([[-half-.62,y,z],[half-.62,y,z],[half-.62,y,z-.018],[-half-.62,y,z-.018]].map((v,k)=>mesh.vertex(tongue,`row.${j}.${k}`,v)));
 }
 for(let j=0;j<tRows.length-1;j++)for(let k=0;k<4;k++){const n=(k+1)%4;mesh.quad(tongue,tRows[j][k],tRows[j][n],tRows[j+1][n],tRows[j+1][k]);}
 mesh.quad(tongue,...tRows[0].slice().reverse());mesh.quad(tongue,...tRows.at(-1));
 tongue.interfaces={bottomAttachmentIntent:'seated below throatY.52; separate component, not stitched/manufacturing proof',frontOffsetZ:.15,thicknessZ:.018,halfWidth:.075};
 stage='continuous-lace';
 const radius=.0045,route=[],visits=[];
 const push=(v,tag)=>{route.push(v);return route.length-1;};
 const ordered=[];for(let r=0;r<6;r++)ordered.push(ports.find(p=>p.row===r&&p.side==='negativeX'),ports.find(p=>p.row===r&&p.side==='positiveX'));
 push(add(ordered[0].outerCenter,mul(ordered[0].normal,.10)),'start');
 for(let r=0;r<6;r++){
  const a=ordered[r*2],b=ordered[r*2+1];
  const entry=push(add(a.outerCenter,mul(a.normal,.025)));
  push(a.outerCenter);push(a.innerCenter);const exit=push(sub(a.innerCenter,mul(a.normal,.025)));visits.push({port:a.id,entry,exit,direction:'outer-to-inner'});
  for(let k=1;k<12;k++){const t=k/12,theta=a.theta+(b.theta-a.theta)*t;push(sub(surface(theta,a.y,true),mul(normal(theta,a.y),.025)));}
  const be=push(sub(b.innerCenter,mul(b.normal,.025)));push(b.innerCenter);push(b.outerCenter);const bx=push(add(b.outerCenter,mul(b.normal,.025)));visits.push({port:b.id,entry:be,exit:bx,direction:'inner-to-outer'});
  if(r<5){const c=ordered[(r+1)*2];
   push(add(b.outerCenter,mul(b.normal,.065)));
   for(let k=1;k<12;k++){const t=k/12,theta=b.theta+(c.theta-b.theta)*t,y=b.y+(c.y-b.y)*t;push(add(surface(theta,y),mul(normal(theta,y),.065)));}
   push(add(c.outerCenter,mul(c.normal,.065)));
  }
 }
 push(add(ordered.at(-1).outerCenter,mul(ordered.at(-1).normal,.10)));
 need(route.length<256&&visits.length===12,'bounded lace route');
 const lace=mesh.part('new.lace','continuous_lace','#dbc49b');const lr=[];
 for(let j=0;j<route.length;j++){
  const tangent=norm(sub(route[Math.min(j+1,route.length-1)],route[Math.max(0,j-1)]));const ref=Math.abs(tangent[1])<.9?[0,1,0]:[1,0,0];const u=norm(cross(tangent,ref)),v=cross(tangent,u);
  lr.push(Array.from({length:8},(_,k)=>mesh.vertex(lace,`route.${j}.${k}`,add(route[j],add(mul(u,radius*Math.cos(k*Math.PI/4)),mul(v,radius*Math.sin(k*Math.PI/4)))))));
 }
 for(let j=0;j<lr.length-1;j++)for(let k=0;k<8;k++){const n=(k+1)%8;mesh.quad(lace,lr[j][k],lr[j][n],lr[j+1][n],lr[j+1][k]);}
 for(const [j,reverse] of [[0,true],[lr.length-1,false]]){const c=mesh.vertex(lace,'cap.'+j,route[j].slice());for(let k=0;k<8;k++){const n=(k+1)%8;mesh.triangle(lace,c,lr[j][reverse?n:k],lr[j][reverse?k:n]);}}
 lace.interfaces={radius,route,visits,endpoints:[route[0],route.at(-1)],style:'single continuous serpentine; exposed top/bottom endpoints, no tied knot or secure wearable closure claim'};
 stage='integrity';
 need(mesh.positions.length<12000&&mesh.triangles.length<24000,'finite mesh size');
 const integrity=checkMesh(mesh);
 fs.writeFileSync(path.join(OUT,'CHECKS.json'),JSON.stringify({integrity},null,2)+'\n');
 need(integrity.pass,'mesh integrity: '+JSON.stringify(integrity.failures));
 for(const q of integrity.parts){const expected=q.id==='new.upper'?-22:q.id.startsWith('new.eyelet.')?0:2;need(q.euler===expected,'authored part Euler '+q.id);}
 need(ports.every(p=>p.wallFaces.length===16),'every port owns8sidewall quads');
 const laceCheck=checkLace(mesh,lace,route,radius);
 fs.writeFileSync(path.join(OUT,'CHECKS.json'),JSON.stringify({integrity,laceCheck},null,2)+'\n');
 need(laceCheck.pass,'lace clearance: '+JSON.stringify(laceCheck));
 const crossings=checkCrossings(mesh);
 fs.writeFileSync(path.join(OUT,'CHECKS.json'),JSON.stringify({integrity,laceCheck,crossings},null,2)+'\n');
 need(crossings.pass,'proper crossings: '+JSON.stringify(crossings));
 stage='exports';
 const result={title:'Original open-lacing material upper — isolated artist candidate',units:'unitless',axes:old.axes,positions:mesh.positions,vertex_labels:mesh.labels,triangles:mesh.triangles,face_parts:mesh.faceParts,parts:mesh.parts,source:{original:ORIGINAL,sha256:ORIGINAL_SHA,retained,producer:sha(fs.readFileSync(fileURLToPath(import.meta.url))),tools:sha(fs.readFileSync(path.join(BASE,'mesh-tools.mjs')))},contract:{newPartIds:mesh.parts.filter(p=>p.id.startsWith('new.')).map(p=>p.id),oldUpperFacingLacesRetained:false,fit:'Not evaluated; retained invisible fictional reference only',contacts:['sole-upper artist seating atY.14, separate floor','retained heel/sole historical seating overlap.005','eyelet outer barrel shares actual material port loop coordinates; flange adjacency intended','tongue base seating belowY.52 only, no manufacturing join'],limits:['Original unitless artist source, not an anatomical or continuous fit model','Finite lace capsules vs visible material/hardware/tongue and route self-separation only; no complete all-surface intersection/manufacturing proof','No finished leather/strength/secure knot/rig/motion/AAA qualification']}};
 function write(name,data){const b=Buffer.isBuffer(data)?data:Buffer.from(data);need(b.length<8*1024*1024,'single output8MiB cap');fs.writeFileSync(path.join(OUT,name),b);}
 write('mesh.json',JSON.stringify(result,null,2)+'\n');
 const obj=['# Original unitless editable artist source','mtllib materials.mtl',...mesh.positions.map(p=>'v '+p.map(x=>x.toFixed(9)).join(' '))];let last='';
 for(let f=0;f<mesh.triangles.length;f++){const id=mesh.faceParts[f];if(id!==last){obj.push('g '+id,'usemtl '+id);last=id;}obj.push('f '+mesh.triangles[f].map(v=>v+1).join(' '));}write('boot.obj',obj.join('\n')+'\n');
 write('materials.mtl',mesh.parts.map(p=>{const rgb=p.color.match(/\w\w/g).map(h=>parseInt(h,16)/255);return 'newmtl '+p.id+'\nKd '+rgb.join(' ')+'\nd 1\n';}).join('\n'));
 write('CHECKS.json',JSON.stringify({UTC:new Date().toISOString(),retained,integrity,laceCheck,crossings,partCount:mesh.parts.length,vertices:mesh.positions.length,triangles:mesh.triangles.length,ports:ports.length,visits:visits.length,limits:result.contract.limits},null,2)+'\n');
 stage='first-fixed-observation';write('first-packet.png',renderPacket(mesh));
 const files=fs.readdirSync(OUT).filter(n=>n!=='STATUS.json').map(name=>{const b=fs.readFileSync(path.join(OUT,name));return {name,bytes:b.length,sha256:sha(b)};});
 need(files.reduce((a,b)=>a+b.bytes,0)<16*1024*1024,'total output16MiB cap');stage='complete';status('complete-unqualified-images',{files,rssBytes:process.memoryUsage().rss});
 console.log(JSON.stringify({state:'complete-unqualified-images',vertices:mesh.positions.length,triangles:mesh.triangles.length,files}));
}catch(error){status(error.message.startsWith('REFUSE:')?'refused':'unexpected-error',{message:String(error),stack:String(error.stack).slice(0,4000)});console.error(String(error));process.exitCode=error.message.startsWith('REFUSE:')?20:30;}
