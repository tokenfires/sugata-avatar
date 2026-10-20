// Generic math, component topology and PNG helpers adapted as declared in DESIGN. No old producer, geometry, lace predicates or camera packet.
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
function crc32(buf){let crc=0xffffffff;for(const b of buf){crc^=b;for(let j=0;j<8;j++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}return (crc^0xffffffff)>>>0;}
function png(rgb,w,h){const raw=Buffer.alloc((w*3+1)*h);for(let y=0;y<h;y++){raw[y*(w*3+1)]=0;rgb.copy(raw,y*(w*3+1)+1,y*w*3,(y+1)*w*3);}const chunk=(name,data)=>{const n=Buffer.from(name),b=Buffer.alloc(data.length+12);b.writeUInt32BE(data.length,0);n.copy(b,4);data.copy(b,8);b.writeUInt32BE(crc32(Buffer.concat([n,data])),data.length+8);return b;};const ihdr=Buffer.alloc(13);ihdr.writeUInt32BE(w,0);ihdr.writeUInt32BE(h,4);ihdr[8]=8;ihdr[9]=2;return Buffer.concat([Buffer.from('89504e470d0a1a0a','hex'),chunk('IHDR',ihdr),chunk('IDAT',zlib.deflateSync(raw,{level:6})),chunk('IEND',Buffer.alloc(0))]);}

export {png};
