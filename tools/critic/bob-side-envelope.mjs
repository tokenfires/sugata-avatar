/** One bounded side continuation of the frozen posterior prototype. Existing roots, widths, material and topology retained.
 * Coherent cubic meridians replace individual lateral guides. Not an accepted groom.
 */
import fs from 'node:fs';import assert from 'node:assert/strict';
import {Vector3,Quaternion,BufferGeometry,BufferAttribute} from 'three';
import {readGlb,readPrimitive,readAccessor} from '../lut-bake/glb.mjs';
import {encodeGlb,sha256,updateMovedFrames} from '../figure-pipeline/hair_fall.mjs';
import {deriveCardGroom} from '../../packages/core/src/motion/HairDynamics.js';
import {SurfaceGrid} from '../figure-pipeline/hair_geometry.mjs';
import {measureHairSurface} from '../figure-pipeline/hair_surface.mjs';
const output='captures/bob-side-envelope-v1';assert.ok(!fs.existsSync(output));fs.mkdirSync(output,{recursive:true});
const input='captures/bob-posterior-envelope-v3/candidate.glb';assert.equal(sha256(fs.readFileSync(input)),'d477f9079577f1205b706941a789b608a3dbb6974a022a6888251737abb26146');const bodyPath='assets/figures/figure_g050.glb';const glb=readGlb(input),original=readPrimitive(glb,'hair_bob02'),body=readPrimitive(readGlb(bodyPath),'base.001');
const geo=new BufferGeometry().setAttribute('position',new BufferAttribute(new Float32Array(original.positions),3));geo.setIndex(new BufferAttribute(new Uint32Array(original.indices),1));const groom=deriveCardGroom(geo);assert.equal(groom.cardVertexBase,652);assert.equal(groom.chainCount,496);assert.equal(groom.pointsPerChain,17);
const layerFor=c=>c<78?'root':c<178?'mass':c<248?'underlayer':c<296?'body':c<344?'surface':c<372?'flyaway':c<462?'veil':'fringe';
const standoff={root:.006,mass:.0135,underlayer:.011,body:.0165,surface:.0225,flyaway:.0285,veil:.020};
const hemOffset={root:.018,mass:0,underlayer:.009,body:.004,surface:0,flyaway:-.003,veil:0};
const parameters={minimumRootZ:.015,maximumRootZ:.060,minimumAbsRootX:.045,centreZ:.03419020026922226,crownY:1.680,fullBodyY:1.555,hemY:1.447,rootClearance:.006,tipTuck:.008,hemScatter:.0025};
// Body-derived horizontal radii include the ears; the visual support is not the nearest skin triangle.
let maxX=0,rearZ=Infinity;for(let v=0;v<body.vertexCount;v++){const [x,y,z]=body.positions.slice(v*3,v*3+3);if(y>=1.48&&y<=1.66){maxX=Math.max(maxX,Math.abs(x));rearZ=Math.min(rearZ,z);}}
parameters.baseRadiusX=maxX+parameters.rootClearance;parameters.baseRadiusZ=parameters.centreZ-rearZ+parameters.rootClearance;
const point=(card,r)=>new Vector3().fromArray(groom.restCentres,(card*17+r)*3);
const smooth=t=>{t=Math.max(0,Math.min(1,t));return t*t*(3-2*t);};
const selected=[],records=[],moved=[];
for(let card=0;card<496;card++){
 const root=point(card,0),layer=layerFor(card);if(layer==='fringe'||root.z<parameters.minimumRootZ||root.z>parameters.maximumRootZ||Math.abs(root.x)<parameters.minimumAbsRootX)continue;
 selected.push(card);const rx=parameters.baseRadiusX+standoff[layer]-.006,rz=parameters.baseRadiusZ+standoff[layer]-.006;
 const theta=Math.atan2((root.z-parameters.centreZ)/rz,root.x/rx);
 const endY=Math.min(root.y-.018,parameters.hemY+hemOffset[layer]+parameters.hemScatter*Math.sin(card*2.399963229728653));
 const distance=root.y-endY;
 const shell=y=>{
  const upper=Math.max(0,(y-parameters.fullBodyY)/(parameters.crownY-parameters.fullBodyY));
  const roundness=Math.sqrt(Math.max(.001,1-upper*upper));
  const tuck=parameters.tipTuck*smooth((1.510-y)/(1.510-parameters.hemY));
  return new Vector3((rx*roundness-tuck)*Math.cos(theta),y,parameters.centreZ+(rz*roundness-tuck)*Math.sin(theta));
 };
 const p0=root.clone(),p1=shell(root.y-distance*.25),p2=shell(endY+distance*.33),p3=shell(endY);
 const points=Array.from({length:17},(_,r)=>{const t=r/16,u=1-t;return p0.clone().multiplyScalar(u*u*u).addScaledVector(p1,3*u*u*t).addScaledVector(p2,3*u*t*t).addScaledVector(p3,t*t*t);});
 const tangents=points.map((p,r)=>points[Math.min(16,r+1)].clone().sub(points[Math.max(0,r-1)]).normalize());
 // Initial circumferential width is transported along the complete guide, avoiding radial-frame flips.
 let across=new Vector3(-Math.sin(theta),0,Math.cos(theta));across.addScaledVector(tangents[0],-across.dot(tangents[0])).normalize();
 const originalAxis=new Vector3().fromArray(groom.restOffsets,(card*17)*3);if(across.dot(originalAxis)<0)across.negate();
 const widths=[];
 for(let r=0;r<17;r++){
  if(r){across.applyQuaternion(new Quaternion().setFromUnitVectors(tangents[r-1],tangents[r]));across.addScaledVector(tangents[r],-across.dot(tangents[r])).normalize();}
  const half=new Vector3().fromArray(groom.restOffsets,(card*17+r)*3).length();widths.push(half*2);
  for(let side=0;side<2;side++){const v=652+(card*17+r)*2+side;points[r].clone().addScaledVector(across,side?half:-half).toArray(geo.attributes.position.array,v*3);moved.push(v);}
 }
 records.push({card,layer,root:root.toArray(),theta,controlPoints:[p0,p1,p2,p3].map(v=>v.toArray()),widths});
}
assert.equal(selected.length,72);assert.deepEqual(selected,JSON.parse(fs.readFileSync('captures/bob-side-attribution-v1/side-sector-inventory-v2.json')).records.map(r=>r.card));const set=new Set(selected);
const frames=updateMovedFrames(geo,original,moved),attributes=glb.json.meshes[0].primitives[0].attributes;assert.equal(attributes.TANGENT,undefined);
for(const [name,values]of[['POSITION',geo.attributes.position.array],['NORMAL',frames.normals]]){const a=glb.json.accessors[attributes[name]],b=glb.json.bufferViews[a.bufferView];assert.equal(a.componentType,5126);assert.ok(!a.sparse);const start=(b.byteOffset??0)+(a.byteOffset??0),stride=b.byteStride??12;for(const v of moved)for(let k=0;k<3;k++)glb.bin.writeFloatLE(values[v*3+k],start+v*stride+k*4);a.min=[0,1,2].map(k=>Math.min(...Array.from({length:a.count},(_,v)=>values[v*3+k])));a.max=[0,1,2].map(k=>Math.max(...Array.from({length:a.count},(_,v)=>values[v*3+k])));}
const grid=new SurfaceGrid(body.positions,body.normals,body.indices),clearances=moved.map(v=>({vertex:v,card:Math.floor((v-652)/34),signedMm:grid.nearest(Array.from(geo.attributes.position.array.slice(v*3,v*3+3))).signed*1000}));
const indices=[];for(let i=0;i<original.indices.length;i+=3)if([0,1,2].every(k=>original.indices[i+k]>=652&&set.has(Math.floor((original.indices[i+k]-652)/34))))indices.push(...original.indices.slice(i,i+3));
const bounds={min:[-Infinity,-Infinity,-Infinity],max:[Infinity,Infinity,Infinity]};const crossings=measureHairSurface({...original,positions:geo.attributes.position.array,normals:frames.normals,indices},body,{headBounds:bounds,faceBounds:bounds});
let maxWidthDelta=0,maxRootCentreDelta=0;for(const c of selected)for(let r=0;r<17;r++){const at=(side)=>new Vector3().fromArray(geo.attributes.position.array,(652+(c*17+r)*2+side)*3),a=at(0),b=at(1);maxWidthDelta=Math.max(maxWidthDelta,Math.abs(a.distanceTo(b)-new Vector3().fromArray(groom.restOffsets,(c*17+r)*3).length()*2));if(r===0)maxRootCentreDelta=Math.max(maxRootCentreDelta,a.add(b).multiplyScalar(.5).distanceTo(point(c,0)));}
const report={status:'unqualified side continuation prototype',input,inputSha256:sha256(fs.readFileSync(input)),bodyPath,bodySha256:sha256(fs.readFileSync(bodyPath)),parameters,selected,records,movedVertices:moved.length,maxWidthDeltaMm:maxWidthDelta*1000,maxRootCentreDeltaMm:maxRootCentreDelta*1000,minimumSelectedVertexClearanceMm:Math.min(...clearances.map(v=>v.signedMm)),negativeVertices:clearances.filter(v=>v.signedMm<0),restTriangleBodyPairs:crossings.head.pairs,crossings,limits:['Single g050 bob02 side continuation; this changed asset does not inherit the frozen posterior motion qualification.','Original UV, lock IDs, widths, material, card count and triangle topology retained. Root centres retained within Float32 rounding; width axes change.','All existing posterior cards, fringe and cards outside the declared side sector remain POSITION/NORMAL byte-identical to frozen v3; changed groom can alter shared fitted colliders and other live response. The sector is a bounded authoring region, not 72 individually proved defects.','No pointwise collision correction is applied to hide unsupported portions; actual rest intersections are reported and block promotion.']};
glb.json.asset.extras??={};glb.json.asset.extras.sugataUnqualifiedExperiment={status:report.status,parameters};const bytes=encodeGlb(glb);report.outputSha256=sha256(bytes);fs.writeFileSync(`${output}/candidate.glb`,bytes,{flag:'wx'});fs.writeFileSync(`${output}/candidate-report.json`,JSON.stringify(report,null,2)+'\n',{flag:'wx'});fs.copyFileSync('tools/critic/bob-side-envelope.mjs',`${output}/bob-side-envelope.mjs`);console.log(JSON.stringify({...report,records:undefined,selected:selected.length,negativeVertices:report.negativeVertices.length,crossings:undefined},null,2));
