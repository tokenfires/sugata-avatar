// One curve-level fit. Fixed centres/tips/width magnitudes; edge orientation is audited separately.
import fs from 'node:fs';import assert from 'node:assert/strict';
import {Vector3,Quaternion,BufferGeometry,BufferAttribute} from 'three';
import {readGlb,readPrimitive} from '../lut-bake/glb.mjs';
import {encodeGlb,sha256,updateMovedFrames} from '../figure-pipeline/hair_fall.mjs';
import {SurfaceGrid} from '../figure-pipeline/hair_geometry.mjs';
import {measureHairSurface} from '../figure-pipeline/hair_surface.mjs';
import {deriveCardGroom} from '../../packages/core/src/motion/HairDynamics.js';
const input='captures/bob-posterior-envelope-v1/candidate.glb',out='captures/bob-posterior-envelope-v2';assert.equal(sha256(fs.readFileSync(input)),'c61424dca1635f518053f436a94c9831b3ba3ec301c561d5eb21aa739cbb9e1d');assert.ok(!fs.existsSync(out));fs.mkdirSync(out,{recursive:true});
const prior=JSON.parse(fs.readFileSync('captures/bob-posterior-envelope-v1/candidate-report.json'));
const glb=readGlb(input),p=readPrimitive(glb,'hair_bob02'),accepted=readPrimitive(readGlb('assets/hair/bob02/g050.glb'),'hair_bob02'),body=readPrimitive(readGlb('assets/figures/figure_g050.glb'),'base.001');
const ag=new BufferGeometry().setAttribute('position',new BufferAttribute(new Float32Array(accepted.positions),3));ag.setIndex(new BufferAttribute(new Uint32Array(accepted.indices),1));const groom=deriveCardGroom(ag),grid=new SurfaceGrid(body.positions,body.normals,body.indices);
const geometry=new BufferGeometry().setAttribute('position',new BufferAttribute(new Float32Array(p.positions),3));geometry.setIndex(new BufferAttribute(new Uint32Array(p.indices),1));
const parameters={floorMetres:.0035,triangleSampleOrder:4,coarseStepMetres:.004,maximumLiftMetres:.040,refinementSteps:7};
const localTriangles=card=>{const list=[],start=652+card*34;for(let i=0;i<p.indices.length;i+=3)if([0,1,2].every(k=>p.indices[i+k]>=start&&p.indices[i+k]<start+34))list.push(Array.from(p.indices.slice(i,i+3),v=>v-start));assert.equal(list.length,32);return list;};
function makeCard(record,lift){
 const controls=record.controlPoints.map(v=>new Vector3().fromArray(v)),direction=controls[1].clone().sub(new Vector3(0,controls[1].y,prior.parameters.centreZ)).normalize();controls[1].addScaledVector(direction,lift);
 const points=Array.from({length:17},(_,r)=>{const t=r/16,u=1-t;return controls[0].clone().multiplyScalar(u**3).addScaledVector(controls[1],3*u*u*t).addScaledVector(controls[2],3*u*t*t).addScaledVector(controls[3],t**3);});
 const tangents=points.map((v,r)=>points[Math.min(16,r+1)].clone().sub(points[Math.max(0,r-1)]).normalize());let across=new Vector3(-Math.sin(record.theta),0,Math.cos(record.theta));across.addScaledVector(tangents[0],-across.dot(tangents[0])).normalize();const axis=new Vector3().fromArray(groom.restOffsets,record.card*17*3);if(across.dot(axis)<0)across.negate();const data=new Float32Array(102);
 for(let r=0;r<17;r++){if(r){across.applyQuaternion(new Quaternion().setFromUnitVectors(tangents[r-1],tangents[r]));across.addScaledVector(tangents[r],-across.dot(tangents[r])).normalize();}for(let side=0;side<2;side++)points[r].clone().addScaledVector(across,(side?1:-1)*record.widths[r]/2).toArray(data,(r*2+side)*3);}
 return data;
}
function assess(data,triangles){
 let minimum=Infinity,witness=null;const check=(p,at)=>{const value=grid.nearest(p).signed;if(value<minimum){minimum=value;witness={...at,point:p,signedMm:value*1000};}};
 for(let v=0;v<34;v++)check(Array.from(data.slice(v*3,v*3+3)),{vertex:v});
 const n=parameters.triangleSampleOrder;
 for(let t=0;t<triangles.length;t++){const corners=triangles[t].map(v=>Array.from(data.slice(v*3,v*3+3)));for(let i=0;i<=n;i++)for(let j=0;j<=n-i;j++){const weights=[i/n,j/n,1-(i+j)/n];const point=[0,1,2].map(k=>corners.reduce((s,p,c)=>s+p[k]*weights[c],0));check(point,{triangle:t,barycentric:weights});}}
 return{minimumMm:minimum*1000,witness,pass:minimum>=parameters.floorMetres};
}
const fits=[],moved=[],failed=[];
for(const record of prior.records){
 const card=record.card,start=(652+card*34)*3,original=new Float32Array(p.positions.slice(start,start+102)),reproduced=makeCard(record,0);assert.deepEqual(reproduced,original,'Zero lift must exactly reconstruct frozen prototype');const triangles=localTriangles(card),initial=assess(original,triangles);if(initial.pass)continue;
 const probes=[{liftMm:0,...initial}];let lo=0,hi=null,chosen=null;
 for(let lift=parameters.coarseStepMetres;lift<=parameters.maximumLiftMetres+1e-10;lift+=parameters.coarseStepMetres){const data=makeCard(record,lift),value=assess(data,triangles);probes.push({liftMm:lift*1000,...value});if(value.pass){hi=lift;chosen=data;break;}lo=lift;}
 if(hi===null){failed.push({card,initial,probes});continue;}
 for(let i=0;i<parameters.refinementSteps;i++){const lift=(lo+hi)/2,data=makeCard(record,lift),value=assess(data,triangles);probes.push({liftMm:lift*1000,...value});if(value.pass){hi=lift;chosen=data;}else lo=lift;}
 const final=assess(chosen,triangles);assert.ok(final.pass);geometry.attributes.position.array.set(chosen,start);for(let v=0;v<34;v++)moved.push(652+card*34+v);
 const edgeDelta=r=>Math.max(...[0,1].map(side=>{const o=(r*2+side)*3;return Math.hypot(...[0,1,2].map(k=>chosen[o+k]-original[o+k]))*1000;}));
 fits.push({card,liftMm:hi*1000,initial,final,rootEdgeMaxDeltaMm:edgeDelta(0),tipEdgeMaxDeltaMm:edgeDelta(16),probes});
 console.log(`card ${card}: ${initial.minimumMm.toFixed(3)} -> ${final.minimumMm.toFixed(3)}mm; control lift ${(hi*1000).toFixed(3)}mm`);
}
const frames=updateMovedFrames(geometry,p,moved),attributes=glb.json.meshes[0].primitives[0].attributes;
for(const [name,values]of[['POSITION',geometry.attributes.position.array],['NORMAL',frames.normals]]){const a=glb.json.accessors[attributes[name]],b=glb.json.bufferViews[a.bufferView];const start=(b.byteOffset??0)+(a.byteOffset??0),stride=b.byteStride??12;assert.equal(a.componentType,5126);for(const v of moved)for(let k=0;k<3;k++)glb.bin.writeFloatLE(values[v*3+k],start+v*stride+k*4);a.min=[0,1,2].map(k=>Math.min(...Array.from({length:a.count},(_,v)=>values[v*3+k])));a.max=[0,1,2].map(k=>Math.max(...Array.from({length:a.count},(_,v)=>values[v*3+k])));}
const selected=new Set(prior.selected),indices=[];for(let i=0;i<p.indices.length;i+=3)if([0,1,2].every(k=>p.indices[i+k]>=652&&selected.has(Math.floor((p.indices[i+k]-652)/34))))indices.push(...p.indices.slice(i,i+3));const bounds={min:[-Infinity,-Infinity,-Infinity],max:[Infinity,Infinity,Infinity]};const crossings=measureHairSurface({...p,positions:geometry.attributes.position.array,normals:frames.normals,indices},body,{headBounds:bounds,faceBounds:bounds});
const report={status:'unqualified fitted posterior prototype',input,inputSha256:sha256(fs.readFileSync(input)),parameters,fits,failed,changedCards:fits.map(f=>f.card),selected:prior.selected,movedVertices:moved.length,restTriangleBodyPairs:crossings.head.pairs,crossings,limits:['Only first cubic control points move outward. The recorded passing fit is not proof of a globally minimal lift or monotone clearance response.','Dense order4 triangle samples plus an independent exact triangle-intersection audit; neither is an all-motion qualification.','All failed fits remain unchanged and block promotion. Root/tip centres and widths stay fixed; regenerated edge orientations are measured separately.']};glb.json.asset.extras.sugataUnqualifiedExperiment={status:report.status,parameters};const bytes=encodeGlb(glb);report.outputSha256=sha256(bytes);fs.writeFileSync(`${out}/candidate.glb`,bytes,{flag:'wx'});fs.writeFileSync(`${out}/candidate-report.json`,JSON.stringify(report,null,2)+'\n',{flag:'wx'});fs.copyFileSync('tools/critic/bob-envelope-clearance.mjs',`${out}/bob-envelope-clearance.mjs`);console.log(JSON.stringify({hash:report.outputSha256,fits:fits.length,failed:failed.length,pairs:crossings.head.pairs,maxLiftMm:Math.max(...fits.map(f=>f.liftMm)),maxRootEdgeDeltaMm:Math.max(...fits.map(f=>f.rootEdgeMaxDeltaMm)),maxTipEdgeDeltaMm:Math.max(...fits.map(f=>f.tipEdgeMaxDeltaMm))}));
