/** One isolated front-flow prototype. GLB coordinates, frozen roots/suffixes, no production writes. */
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {Vector3, Quaternion, BufferGeometry, BufferAttribute} from 'three';
import {readGlb, readPrimitive, readAccessor} from '../lut-bake/glb.mjs';
import {encodeGlb, sha256, updateMovedFrames} from '../figure-pipeline/hair_fall.mjs';
import {SurfaceGrid} from '../figure-pipeline/hair_geometry.mjs';
import {measureHairSurface} from '../figure-pipeline/hair_surface.mjs';
const started=new Date().toISOString(),out='captures/bob-front-flow-v1';
const input='captures/bob-side-envelope-v3/candidate.glb',inputSha256='bbed05d0ce51eccc84fbfb1a9baca9f4e9a36ac2b3176869d2e7bfda27fa8ad9';
const bodyPath='assets/figures/figure_g050.glb',bodySha256='b56115d0cb52edb72af7e725bf479d81253b660c298bd95ff9e89456d671ec14';
assert.ok(!fs.existsSync(out));assert.equal(sha256(fs.readFileSync(input)),inputSha256);assert.equal(sha256(fs.readFileSync(bodyPath)),bodySha256);
const read=f=>JSON.parse(fs.readFileSync(f));
const protectedCards=read('captures/bob-side-envelope-v3/candidate-report.json').selected,protectedSet=new Set(protectedCards);assert.equal(protectedCards.length,338);
const originalGlb=readGlb(input),glb=readGlb(input),original=readPrimitive(originalGlb,'hair_bob02'),body=readPrimitive(readGlb(bodyPath),'base.001');
const geo=new BufferGeometry().setAttribute('position',new BufferAttribute(new Float32Array(original.positions),3));geo.setIndex(new BufferAttribute(new Uint32Array(original.indices),1));
const positions=geo.attributes.position.array;
const vertex=(c,r,s)=>652+c*34+r*2+s;
const edge=(c,r,s,p=original.positions)=>new Vector3().fromArray(p,vertex(c,r,s)*3);
const centre=(c,r,p=original.positions)=>edge(c,r,0,p).add(edge(c,r,1,p)).multiplyScalar(.5);
const width=(c,r)=>edge(c,r,1).sub(edge(c,r,0));
const cards=Array.from({length:496},(_,c)=>c).filter(c=>!protectedSet.has(c));assert.equal(cards.length,158);
const longs=cards.filter(c=>c>=78&&c<462),shorts=cards.filter(c=>c<78||c>=462);assert.equal(longs.length,98);assert.equal(shorts.length,60);
const params={authoringPlaneY:1.55,shortRootMaximumEndY:1.52,fringeMaximumEndY:1.50,rootTempleAbsX:.086,fringeTempleAbsX:.097,templeZ:.108,
  upperHandleDrop:.008,shortEndVerticalHandleFraction:.28,
  boundary:'Keep ring0 and fixed suffix starting one ring before sustained GLB-Y<=1.55 crossing. Skip early below-plane samples and crossing<3.',
  sweep:'Short-card side inferred from inverse-distance weighted endpoint signs of four nearest original long-card roots. Long-card side follows its fixed endpoint.',
  widths:'Original lengths with parallel transport and smooth endpoint frame correction; no pointwise skin projection.'};
const records=[],skipped=[],moved=[];
const smooth=t=>t*t*(3-2*t);
function bezier(p,t){let u=1-t;return p[0].clone().multiplyScalar(u*u*u).addScaledVector(p[1],3*u*u*t).addScaledVector(p[2],3*u*t*t).addScaledVector(p[3],t*t*t);}
function recipe(card){
 const points=Array.from({length:17},(_,r)=>centre(card,r)),p0=points[0].clone();
 if(longs.includes(card)){
  const join=points.findIndex((p,r)=>r>0&&points.slice(r).every(q=>q.y<=params.authoringPlaneY));
  if(join<3||points.slice(0,join).some(p=>p.y<params.authoringPlaneY)){skipped.push({card,join,reason:join<3?'no feasible prefix':'earlier below-plane sample'});return null;}
  const end=join-1,p3=points[end].clone(),suffixTangent=points[end+1].clone().sub(p3).normalize();
  const distance=p3.distanceTo(p0),side=Math.sign(p3.x)||Math.sign(p0.x)||1;
  const p1=new Vector3(p0.x+side*distance*.35,p0.y-Math.min(params.upperHandleDrop,distance*.15),p0.z+(p3.z-p0.z)*.35);
  const p2=p3.clone().addScaledVector(suffixTangent,-distance/3);
  return {card,kind:'long-upper',end,fixedSuffixFrom:end,join,control:[p0,p1,p2,p3],side};
 }
 const neighbours=longs.map(c=>({card:c,d:centre(c,0).distanceTo(p0),tip:centre(c,16)})).sort((a,b)=>a.d-b.d).slice(0,4);
 const vote=neighbours.reduce((s,n)=>s+(Math.sign(n.tip.x)||1)/Math.max(.001,n.d)**2,0),side=Math.sign(vote)||Math.sign(p0.x)||1;
 const fringe=card>=462,endY=Math.min(points[16].y,fringe?params.fringeMaximumEndY:params.shortRootMaximumEndY);
 const p3=new Vector3(side*(fringe?params.fringeTempleAbsX:params.rootTempleAbsX),endY,params.templeZ);
 const distance=p0.distanceTo(p3);
 const p1=new Vector3(p0.x+(p3.x-p0.x)*.58,p0.y-Math.min(params.upperHandleDrop,distance*.15),p0.z+(p3.z-p0.z)*.25);
 const p2=p3.clone().add(new Vector3(0,distance*params.shortEndVerticalHandleFraction,0));
 return {card,kind:fringe?'fringe-sweep':'root-sweep',end:16,fixedSuffixFrom:null,control:[p0,p1,p2,p3],side,neighbours:neighbours.map(n=>({card:n.card,distanceMm:n.d*1000,endpointSign:Math.sign(n.tip.x)}))};
}
for(const card of cards){
 const r=recipe(card);if(!r)continue;
 const pts=Array.from({length:r.end+1},(_,i)=>bezier(r.control,i/r.end));
 const tangents=pts.map((p,i)=>pts[Math.min(r.end,i+1)].clone().sub(pts[Math.max(0,i-1)]).normalize());
 const axes=[];let axis=width(card,0).normalize();axis.addScaledVector(tangents[0],-axis.dot(tangents[0])).normalize();assert.ok(axis.length()>.9);
 for(let i=0;i<=r.end;i++){
  if(i){axis.applyQuaternion(new Quaternion().setFromUnitVectors(tangents[i-1],tangents[i]));axis.addScaledVector(tangents[i],-axis.dot(tangents[i])).normalize();}
  axes.push(axis.clone());
 }
 let twist=0;
 if(r.fixedSuffixFrom!==null){
  const target=width(card,r.end).normalize(),t=tangents[r.end];target.addScaledVector(t,-target.dot(t)).normalize();
  twist=Math.atan2(t.dot(axes[r.end].clone().cross(target)),axes[r.end].dot(target));
 }
 for(let i=1;i<=r.end;i++){
  if(r.fixedSuffixFrom!==null&&i>=r.fixedSuffixFrom)continue;
  const t=i/r.end,axis=axes[i].clone().applyAxisAngle(tangents[i],twist*smooth(t)),half=width(card,i).length()/2;
  for(let s=0;s<2;s++){const v=vertex(card,i,s);pts[i].clone().addScaledVector(axis,s?half:-half).toArray(positions,v*3);moved.push(v);}
 }
 records.push({...r,control:r.control.map(p=>p.toArray()),endTwistDegrees:twist*180/Math.PI});
}
assert.ok(records.length>60&&records.length<=158);const movedSet=new Set(moved),frames=updateMovedFrames(geo,original,moved);
const prim=glb.json.meshes.find(m=>m.name==='hair_bob02').primitives[0],oldPrim=originalGlb.json.meshes.find(m=>m.name==='hair_bob02').primitives[0];assert.equal(prim.attributes.TANGENT,undefined);
for(const [name,values] of [['POSITION',positions],['NORMAL',frames.normals]]){
 const a=glb.json.accessors[prim.attributes[name]],b=glb.json.bufferViews[a.bufferView];assert.equal(a.componentType,5126);assert.ok(!a.sparse);
 const start=(b.byteOffset??0)+(a.byteOffset??0),stride=b.byteStride??12;
 for(const v of moved)for(let k=0;k<3;k++){assert.ok(Number.isFinite(values[v*3+k]));glb.bin.writeFloatLE(values[v*3+k],start+v*stride+k*4);}
 a.min=[0,1,2].map(k=>Math.min(...Array.from({length:a.count},(_,v)=>values[v*3+k])));a.max=[0,1,2].map(k=>Math.max(...Array.from({length:a.count},(_,v)=>values[v*3+k])));
}
const attributes={};for(const name of Object.keys(oldPrim.attributes)){
 const before=readAccessor(originalGlb,oldPrim.attributes[name]),after=readAccessor(glb,prim.attributes[name]);assert.equal(before.count,after.count);let changed=0;
 for(let v=0;v<before.count;v++)if(Array.from({length:before.components},(_,k)=>before.data[v*before.components+k]!==after.data[v*before.components+k]).some(Boolean)){assert.ok(movedSet.has(v)&&['POSITION','NORMAL'].includes(name),`protected ${name} ${v}`);changed++;}
 attributes[name]={changedRecords:changed};
}
assert.deepEqual(readAccessor(originalGlb,oldPrim.indices).data,readAccessor(glb,prim.indices).data);for(const k of ['nodes','skins','scenes','materials','textures','images'])assert.deepEqual(originalGlb.json[k],glb.json[k]);
const result=readPrimitive(glb,'hair_bob02'),selected=new Set(cards),indices=[];
for(let i=0;i<original.indices.length;i+=3)if([0,1,2].every(k=>original.indices[i+k]>=652&&selected.has(Math.floor((original.indices[i+k]-652)/34))))indices.push(...original.indices.slice(i,i+3));assert.equal(indices.length/3,158*32);
let maxWidthErrorMm=0,maxRootErrorMm=0;const joins=[];
for(const card of cards)for(let r=0;r<17;r++){
 maxWidthErrorMm=Math.max(maxWidthErrorMm,Math.abs(edge(card,r,1,result.positions).distanceTo(edge(card,r,0,result.positions))-width(card,r).length())*1000);
 if(r===0)maxRootErrorMm=Math.max(maxRootErrorMm,centre(card,r,result.positions).distanceTo(centre(card,r))*1000);
}
assert.equal(maxRootErrorMm,0);assert.ok(maxWidthErrorMm<.001);
for(const record of records.filter(r=>r.fixedSuffixFrom!==null)){
 const c=record.card,j=record.fixedSuffixFrom;for(let r=j;r<17;r++)for(let s=0;s<2;s++)assert.deepEqual(edge(c,r,s,result.positions).toArray(),edge(c,r,s).toArray());
 const a=centre(c,j,result.positions).sub(centre(c,j-1,result.positions)).normalize(),b=centre(c,j+1,result.positions).sub(centre(c,j,result.positions)).normalize();joins.push({card:c,fixedSuffixFrom:j,angleDegrees:a.angleTo(b)*180/Math.PI});
}
console.log(JSON.stringify({status:'authored; measuring158frontcards at source rest',pid:process.pid,started,records:records.length,skipped:skipped.length}));
const bounds={min:[-Infinity,-Infinity,-Infinity],max:[Infinity,Infinity,Infinity]},crossings=measureHairSurface({...result,indices},body,{headBounds:bounds,faceBounds:bounds});
const grid=new SurfaceGrid(body.positions,body.normals,body.indices);let min=Infinity,witness=null,negativeVertices=0;
for(const card of cards)for(let v=652+card*34;v<652+(card+1)*34;v++){const p=Array.from(result.positions.slice(v*3,v*3+3)),mm=grid.nearest(p).signed*1000;if(mm<0)negativeVertices++;if(mm<min){min=mm;witness={card,vertex:v,point:p,signedMm:mm};}}
const report={status:'unqualified front-flow prototype',started,finished:new Date().toISOString(),pid:process.pid,input,inputSha256,bodyPath,bodySha256,parameters:params,protectedCards,selected:cards,records,skipped,movedVertices:moved.length,attributes,protectedRecordsExact:true,capExact:true,rootRecordsExact:true,lowerSuffixExact:true,maxWidthErrorMm,maxRootErrorMm,joins,
 restTriangleBodyPairs:crossings.head.pairs,restContactCards:crossings.head.cards.map(c=>cards[c]),crossings,minimumSelectedVertexClearanceMm:min,clearanceWitness:witness,negativeVertices,
 limits:['One shared front-flow probe against side-v3, not the separate lower-fallback candidate.','No motion inheritance, final styling or promotion claim. Root, cap and all338side/posterior authored records remain exact; shared live colliders/compliance may change.','Discrete join angles are reported; continuous cubic endpoint tangent does not prove sampled normal or silhouette continuity.','Body audit covers all158front cards at source rest only; garments,hair-hair,alpha/occlusion and live motion are outside this check.']};
glb.json.asset.extras??={};glb.json.asset.extras.sugataUnqualifiedExperiment={status:report.status,parameters:params};const bytes=encodeGlb(glb);report.outputSha256=sha256(bytes);report.sourceSha256=sha256(fs.readFileSync('tools/critic/bob-front-flow.mjs'));
fs.mkdirSync(out,{recursive:true});fs.writeFileSync(`${out}/candidate.glb`,bytes,{flag:'wx'});fs.writeFileSync(`${out}/candidate-report.json`,JSON.stringify(report,null,2)+'\n',{flag:'wx'});fs.copyFileSync('tools/critic/bob-front-flow.mjs',`${out}/bob-front-flow.mjs`);
console.log(JSON.stringify({...report,protectedCards:protectedCards.length,selected:cards.length,records:records.length,skipped,joins:joins.sort((a,b)=>b.angleDegrees-a.angleDegrees).slice(0,5),crossings:undefined},null,2));
