// New source-owned utilities, no old renderer/geometry imports or dependencies.
import zlib from 'node:zlib';
export const add=(a,b)=>a.map((x,k)=>x+b[k]),sub=(a,b)=>a.map((x,k)=>x-b[k]),mul=(a,s)=>a.map(x=>x*s),dot=(a,b)=>a.reduce((s,x,k)=>s+x*b[k],0);
export const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
export const norm=a=>{const l=Math.hypot(...a);if(!(l>1e-12))throw new Error('REFUSE: zero vector');return mul(a,1/l);};
export const lerp=(a,b,t)=>add(mul(a,1-t),mul(b,t)),mean=a=>mul(a.reduce((s,v)=>add(s,v),[0,0,0]),1/a.length);
export class Mesh{
 constructor(){this.positions=[];this.labels=[];this.triangles=[];this.faceParts=[];this.parts=[];}
 part(id,role,color,visible=true){if(this.parts.some(p=>p.id===id))throw new Error('REFUSE: duplicate part');const p={id,role,color,visible,vertex_ids:[],face_ids:[],interfaces:{}};this.parts.push(p);return p;}
 vertex(p,name,v){const id=this.positions.length;this.positions.push(v);this.labels.push(p.id+':'+name);p.vertex_ids.push(id);return id;}
 triangle(p,a,b,c){const id=this.triangles.length;this.triangles.push([a,b,c]);this.faceParts.push(p.id);p.face_ids.push(id);return id;}
 quad(p,a,b,c,d){return [this.triangle(p,a,b,c),this.triangle(p,a,c,d)];}
}
export function checkMesh(m){
 const failures=[],parts=[];const seenLabels=new Set();
 for(let i=0;i<m.positions.length;i++){if(m.positions[i].length!==3||!m.positions[i].every(Number.isFinite))failures.push('nonfinite position'+i);if(seenLabels.has(m.labels[i]))failures.push('duplicate label');seenLabels.add(m.labels[i]);}
 for(const p of m.parts){const vertices=new Set(p.vertex_ids),edges=new Map(),fans=new Map(),faceAdj=new Map();let volume=0,minArea=Infinity;
  for(const f of p.face_ids){const t=m.triangles[f];if(new Set(t).size!==3||!t.every(v=>vertices.has(v)))failures.push(p.id+' face indices');const [a,b,c]=t.map(v=>m.positions[v]);const area=Math.hypot(...cross(sub(b,a),sub(c,a)))/2;minArea=Math.min(minArea,area);volume+=dot(a,cross(b,c))/6;
   for(let k=0;k<3;k++){const a=t[k],b=t[(k+1)%3],key=Math.min(a,b)+':'+Math.max(a,b),dir=a<b?1:-1;if(!edges.has(key))edges.set(key,[]);edges.get(key).push({f,dir});if(!fans.has(a))fans.set(a,[]);fans.get(a).push(f);}
  }
  let badEdges=0;for(const list of edges.values()){if(list.length!==2||list[0].dir+list[1].dir!==0){badEdges++;continue;}const [a,b]=list.map(e=>e.f);if(!faceAdj.has(a))faceAdj.set(a,[]);if(!faceAdj.has(b))faceAdj.set(b,[]);faceAdj.get(a).push(b);faceAdj.get(b).push(a);}
  let badFans=0;for(const fs of fans.values()){const allowed=new Set(fs),seen=new Set(),todo=[fs[0]];while(todo.length){const f=todo.pop();if(seen.has(f))continue;seen.add(f);for(const g of faceAdj.get(f)||[])if(allowed.has(g)&&!seen.has(g))todo.push(g);}if(seen.size!==fs.length)badFans++;}
  const todo=[p.face_ids[0]],seen=new Set();while(todo.length){const f=todo.pop();if(seen.has(f))continue;seen.add(f);todo.push(...(faceAdj.get(f)||[]).filter(g=>!seen.has(g)));}
  const isolated=p.vertex_ids.filter(v=>!fans.has(v)).length;
  if(badEdges||badFans||isolated||seen.size!==p.face_ids.length||!(minArea>1e-12)||!(volume>1e-10))failures.push(p.id+' topology/orientation');
  parts.push({id:p.id,vertices:p.vertex_ids.length,faces:p.face_ids.length,edges:edges.size,euler:p.vertex_ids.length-edges.size+p.face_ids.length,badEdges,badFans,isolated,faceComponentsConnected:seen.size===p.face_ids.length,minArea,signedVolume:volume});
 }
 return {pass:failures.length===0,failures,parts,limits:'Closed opposed edges, connected cyclic vertex links, nondegenerate faces and positive orientation only; not general all-surface embeddedness or fit.'};
}
function pointTriangle2(p,a,b,c){
 // Exact closest-point regions on a triangle (Ericson), squared distance.
 const ab=sub(b,a),ac=sub(c,a),ap=sub(p,a),d1=dot(ab,ap),d2=dot(ac,ap);
 if(d1<=0&&d2<=0)return dot(ap,ap);
 const bp=sub(p,b),d3=dot(ab,bp),d4=dot(ac,bp);if(d3>=0&&d4<=d3)return dot(bp,bp);
 const vc=d1*d4-d3*d2;if(vc<=0&&d1>=0&&d3<=0){const q=lerp(a,b,d1/(d1-d3));return dot(sub(p,q),sub(p,q));}
 const cp=sub(p,c),d5=dot(ab,cp),d6=dot(ac,cp);if(d6>=0&&d5<=d6)return dot(cp,cp);
 const vb=d5*d2-d1*d6;if(vb<=0&&d2>=0&&d6<=0){const q=lerp(a,c,d2/(d2-d6));return dot(sub(p,q),sub(p,q));}
 const va=d3*d6-d5*d4;if(va<=0&&(d4-d3)>=0&&(d5-d6)>=0){const q=lerp(b,c,(d4-d3)/((d4-d3)+(d5-d6)));return dot(sub(p,q),sub(p,q));}
 const den=1/(va+vb+vc),q=add(a,add(mul(ab,vb*den),mul(ac,vc*den)));return dot(sub(p,q),sub(p,q));
}
function segment2(p1,q1,p2,q2){
 const d1=sub(q1,p1),d2=sub(q2,p2),r=sub(p1,p2),a=dot(d1,d1),e=dot(d2,d2),f=dot(d2,r);const clamp=x=>Math.max(0,Math.min(1,x));let s=0,t=0;
 if(a<=1e-20&&e<=1e-20)return dot(r,r);
 if(a<=1e-20)t=clamp(f/e);else{const c=dot(d1,r);if(e<=1e-20)s=clamp(-c/a);else{const b=dot(d1,d2),den=a*e-b*b;s=Math.abs(den)>1e-20?clamp((b*f-c*e)/den):0;t=(b*s+f)/e;if(t<0){t=0;s=clamp(-c/a);}else if(t>1){t=1;s=clamp((b-c)/a);}}}
 const d=sub(lerp(p1,q1,s),lerp(p2,q2,t));return dot(d,d);
}
function segmentTriangle2(p,q,a,b,c){
 const d=sub(q,p),e1=sub(b,a),e2=sub(c,a),h=cross(d,e2),det=dot(e1,h);
 if(Math.abs(det)>1e-14){const inv=1/det,s=sub(p,a),u=dot(s,h)*inv,v=dot(d,cross(s,e1))*inv,t=dot(e2,cross(s,e1))*inv;if(u>=0&&v>=0&&u+v<=1&&t>=0&&t<=1)return 0;}
 return Math.min(pointTriangle2(p,a,b,c),pointTriangle2(q,a,b,c),segment2(p,q,a,b),segment2(p,q,b,c),segment2(p,q,c,a));
}
function boxDistance2(a,b,tri){let sum=0;for(let k=0;k<3;k++){const lo=Math.min(a[k],b[k]),hi=Math.max(a[k],b[k]),tl=Math.min(...tri.map(v=>v[k])),th=Math.max(...tri.map(v=>v[k]));const d=Math.max(0,lo-th,tl-hi);sum+=d*d;}return sum;}
export function checkLace(m,lace,route,radius){
 const clearance=radius+.0005,limit2=clearance*clearance;let min2=Infinity,witness=null,comparisons=0;
 const obstacles=m.parts.filter(p=>p.visible&&p.id!==lace.id).flatMap(p=>p.face_ids.map(f=>({part:p.id,f,tri:m.triangles[f].map(v=>m.positions[v])})));
 // Every straight route segment capsule covers the interpolated tube surface because all ring radii<=radius.
 for(let j=0;j<route.length-1;j++)for(const o of obstacles){const lower=boxDistance2(route[j],route[j+1],o.tri);if(lower>min2&&lower>limit2)continue;comparisons++;const d=segmentTriangle2(route[j],route[j+1],...o.tri);if(d<min2){min2=d;witness={segment:j,part:o.part,face:o.f};}}
 // Nonlocal route separation only; nearby connected bends are not an embeddedness proof.
 let self2=Infinity,selfPair=null;for(let a=0;a<route.length-1;a++)for(let b=a+4;b<route.length-1;b++){const d=segment2(route[a],route[a+1],route[b],route[b+1]);if(d<self2){self2=d;selfPair=[a,b];}}
 return {pass:min2>=limit2&&self2>=(2*radius+.0005)**2,minimumObstacleDistance:Math.sqrt(min2),requiredObstacleDistance:clearance,witness,comparisons,minimumNonlocalRouteDistance:Math.sqrt(self2),selfPair,requiredNonlocalDistance:2*radius+.0005,limits:'Exact straight-segment/triangle capsule and separated route segment distances with floating arithmetic; adjacent three segments excluded from self-distance, local bend tube embeddedness and all non-lace inter-part relationships unproved. No physical-fastener/fit proof.'};
}
function strictSegmentHit(p,q,a,b,c){
 const d=sub(q,p),e1=sub(b,a),e2=sub(c,a),h=cross(d,e2),det=dot(e1,h);if(Math.abs(det)<1e-12)return false;
 const inv=1/det,s=sub(p,a),u=dot(s,h)*inv,v=dot(d,cross(s,e1))*inv,t=dot(e2,cross(s,e1))*inv;
 return u>1e-8&&v>1e-8&&u+v<1-1e-8&&t>1e-8&&t<1-1e-8;
}
function coplanarAreaOverlap(a,b,n){
 const drop=n.map(Math.abs).indexOf(Math.max(...n.map(Math.abs))),keep=[0,1,2].filter(k=>k!==drop),P=a.map(v=>keep.map(k=>v[k])),Q=b.map(v=>keep.map(k=>v[k]));
 const orient=(a,b,c)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
 const inside=(p,t)=>{const o=t.map((v,k)=>orient(v,t[(k+1)%3],p));return o.every(x=>x>1e-10)||o.every(x=>x< -1e-10);};
 if(P.some(p=>inside(p,Q))||Q.some(p=>inside(p,P)))return true;
 // Centroids catch coincident faces with all vertices on the other boundary.
 const c=t=>[t.reduce((s,v)=>s+v[0],0)/3,t.reduce((s,v)=>s+v[1],0)/3];if(inside(c(P),Q)||inside(c(Q),P))return true;
 for(let i=0;i<3;i++)for(let j=0;j<3;j++)if(orient(P[i],P[(i+1)%3],Q[j])*orient(P[i],P[(i+1)%3],Q[(j+1)%3])< -1e-18&&orient(Q[j],Q[(j+1)%3],P[i])*orient(Q[j],Q[(j+1)%3],P[(i+1)%3])< -1e-18)return true;
 return false;
}
export function checkCrossings(m){
 const parts=new Map(m.parts.map(p=>[p.id,p])),faces=[];let tested=0,exempt=0;
 for(let f=0;f<m.triangles.length;f++){const part=m.faceParts[f];if(!part.startsWith('new.'))continue;const ids=m.triangles[f],tri=ids.map(v=>m.positions[v]);faces.push({f,part,ids,tri,lo:[0,1,2].map(k=>Math.min(...tri.map(v=>v[k]))),hi:[0,1,2].map(k=>Math.max(...tri.map(v=>v[k])))});}
 faces.sort((a,b)=>a.lo[0]-b.lo[0]);const witnesses=[];
 for(let i=0;i<faces.length;i++)for(let j=i+1;j<faces.length&&faces[j].lo[0]<=faces[i].hi[0]+1e-10;j++){
  const a=faces[i],b=faces[j];if(a.part===b.part&&a.ids.some(v=>b.ids.includes(v)))continue;
  if([1,2].some(k=>a.hi[k]<b.lo[k]-1e-10||b.hi[k]<a.lo[k]-1e-10))continue;
  const contact=(u,h)=>h.part.startsWith('new.eyelet.')&&u.part==='new.upper'&&parts.get(h.part).interfaces.materialContactFaces.includes(h.f)&&parts.get(h.part).interfaces.upperContactFaces.includes(u.f);
  if(contact(a,b)||contact(b,a)){exempt++;continue;}
  tested++;if(tested>2000000)throw new Error('REFUSE: crossing-pair2million cap');
  let hit=false;for(let k=0;k<3;k++)if(strictSegmentHit(a.tri[k],a.tri[(k+1)%3],...b.tri)||strictSegmentHit(b.tri[k],b.tri[(k+1)%3],...a.tri))hit=true;
  if(!hit){const n=cross(sub(a.tri[1],a.tri[0]),sub(a.tri[2],a.tri[0]));const len=Math.hypot(...n);if(b.tri.every(p=>Math.abs(dot(sub(p,a.tri[0]),n))/len<1e-9))hit=coplanarAreaOverlap(a.tri,b.tri,n);}
  if(hit&&witnesses.length<12)witnesses.push({firstFace:a.f,firstPart:a.part,secondFace:b.f,secondPart:b.part});
 }
 return {pass:witnesses.length===0,tested,declaredPortWallContactPairsExempt:exempt,witnesses,limits:'Proper triangle-interior crossings and coplanar positive-area overlap on all new parts. Shared-index same-part neighbors and exact declared metal-barrel/upper-port-wall contact pairs excluded. General tangent/coincident-boundary clearance and retained sole/heel/reference intersection/fit not proved.'};
}
function crc32(buf){let crc=0xffffffff;for(const b of buf){crc^=b;for(let j=0;j<8;j++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}return (crc^0xffffffff)>>>0;}
function png(rgb,w,h){const raw=Buffer.alloc((w*3+1)*h);for(let y=0;y<h;y++){raw[y*(w*3+1)]=0;rgb.copy(raw,y*(w*3+1)+1,y*w*3,(y+1)*w*3);}const chunk=(name,data)=>{const n=Buffer.from(name),b=Buffer.alloc(data.length+12);b.writeUInt32BE(data.length,0);n.copy(b,4);data.copy(b,8);b.writeUInt32BE(crc32(Buffer.concat([n,data])),data.length+8);return b;};const ihdr=Buffer.alloc(13);ihdr.writeUInt32BE(w,0);ihdr.writeUInt32BE(h,4);ihdr[8]=8;ihdr[9]=2;return Buffer.concat([Buffer.from('89504e470d0a1a0a','hex'),chunk('IHDR',ihdr),chunk('IDAT',zlib.deflateSync(raw,{level:6})),chunk('IEND',Buffer.alloc(0))]);}
export function renderPacket(m){
 const W=1440,H=1040,SW=720,SH=520,rgb=Buffer.alloc(W*H*3);for(let y=0;y<H;y++)for(let x=0;x<W;x++){const shade=246-Math.floor((y%SH)/SH*10),o=(y*W+x)*3;rgb[o]=shade;rgb[o+1]=shade-2;rgb[o+2]=shade-5;}
 // Fixed before execution: front, elevated three-quarter, lateral whole boot, frontal upper detail.
 const views=[{name:'FRONT',eye:[0,.35,3],target:[-.62,.62,.34],scale:330,offset:[0,0]},
 {name:'THREE QUARTER',eye:[2.5,1.65,3],target:[-.62,.62,.35],scale:290,offset:[SW,0]},
 {name:'SIDE',eye:[3,.7,0],target:[-.62,.62,.35],scale:300,offset:[0,SH]},
 {name:'PORT DETAIL',eye:[.15,.3,3],target:[-.62,.85,.23],scale:760,offset:[SW,SH]}];
 const partById=new Map(m.parts.map(p=>[p.id,p]));const vertexNormals=m.positions.map(()=>[0,0,0]);
 for(let f=0;f<m.triangles.length;f++){const t=m.triangles[f],[a,b,c]=t.map(v=>m.positions[v]),n=cross(sub(b,a),sub(c,a));for(const v of t)vertexNormals[v]=add(vertexNormals[v],n);}
 const ns=vertexNormals.map(n=>Math.hypot(...n)>1e-12?norm(n):[0,1,0]);const light=norm([-.5,1,1]);
 for(const view of views){const forward=norm(view.eye),right=norm(cross([0,1,0],forward)),up=cross(forward,right),depth=new Float64Array(SW*SH);depth.fill(-Infinity);
  const projected=m.positions.map(p=>{const v=sub(p,view.target);return [SW/2+dot(v,right)*view.scale,SH/2-dot(v,up)*view.scale,dot(v,forward)];});
  for(let f=0;f<m.triangles.length;f++){
   const part=partById.get(m.faceParts[f]);if(!part.visible)continue;
   const ids=m.triangles[f],[a,b,c]=ids.map(v=>projected[v]);const den=(b[1]-c[1])*(a[0]-c[0])+(c[0]-b[0])*(a[1]-c[1]);if(Math.abs(den)<1e-9)continue;
   const minX=Math.max(8,Math.floor(Math.min(a[0],b[0],c[0]))),maxX=Math.min(SW-9,Math.ceil(Math.max(a[0],b[0],c[0]))),minY=Math.max(8,Math.floor(Math.min(a[1],b[1],c[1]))),maxY=Math.min(SH-9,Math.ceil(Math.max(a[1],b[1],c[1])));
   const color=part.color.match(/\w\w/g).map(h=>parseInt(h,16));const metal=part.role==='eyelet_sleeve';
   for(let y=minY;y<=maxY;y++)for(let x=minX;x<=maxX;x++){
    const px=x+.5,py=y+.5,u=((b[1]-c[1])*(px-c[0])+(c[0]-b[0])*(py-c[1]))/den,v=((c[1]-a[1])*(px-c[0])+(a[0]-c[0])*(py-c[1]))/den,w=1-u-v;
    if(u<0||v<0||w<0)continue;const z=u*a[2]+v*b[2]+w*c[2],index=y*SW+x;if(z<=depth[index])continue;depth[index]=z;
    let n=norm(add(add(mul(ns[ids[0]],u),mul(ns[ids[1]],v)),mul(ns[ids[2]],w)));if(dot(n,forward)<0)n=mul(n,-1);
    const diffuse=.32+.68*Math.max(0,dot(n,light)),half=norm(add(light,forward)),spec=Math.pow(Math.max(0,dot(n,half)),metal?36:24)*(metal?100:12),o=((y+view.offset[1])*W+x+view.offset[0])*3;
    for(let k=0;k<3;k++)rgb[o+k]=Math.max(0,Math.min(255,Math.round(color[k]*diffuse+spec)));
   }
  }
  // Thin panel separators are source-owned framing, never draw over mesh details.
  for(let x=0;x<SW;x++)for(let k=0;k<3;k++)rgb[((view.offset[1])*W+x+view.offset[0])*3+k]=216;
 }
 return png(rgb,W,H);
}
