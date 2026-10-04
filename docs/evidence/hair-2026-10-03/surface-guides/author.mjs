import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {Triangle,Vector3} from 'three';
import {readGlb,readAccessor} from '../../../../tools/lut-bake/glb.mjs';
const folder=path.dirname(fileURLToPath(import.meta.url)),root=path.resolve(folder,'../../../..'),started=new Date().toISOString();
const file='assets/figures/figure_g050.glb',bytes=fs.readFileSync(path.join(root,file)),sha=createHash('sha256').update(bytes).digest('hex');
if(sha!=='b56115d0cb52edb72af7e725bf479d81253b660c298bd95ff9e89456d671ec14')throw Error('Exact artist body source changed');
const glb=readGlb(path.join(root,file)),mesh=glb.json.meshes.find(m=>m.name==='base.001');if(!mesh||mesh.primitives.length!==1)throw Error('Native body primitive unavailable');
const primitive=mesh.primitives[0],positions=readAccessor(glb,primitive.attributes.POSITION).data,indices=readAccessor(glb,primitive.indices).data;
const vec=i=>new Vector3().fromArray(positions,i*3),triangle=new Triangle(),point=new Vector3(),guides=[];
const xs=[-.065,-.045,-.025,-.005,.025,.055],zs=[-.015,.012,.039,.066,.093,.113];
for(let zi=0;zi<zs.length;zi++)for(let xi=0;xi<xs.length;xi++){
 const x=xs[xi],z=zs[zi],wanted=new Vector3(x,1.659-2.4*x*x-2.5*(z-.05)**2,z);let best=null;
 for(let ordinal=0;ordinal<indices.length/3;ordinal++){
  const ids=Array.from(indices.slice(ordinal*3,ordinal*3+3));triangle.set(...ids.map(vec));triangle.closestPointToPoint(wanted,point);const squared=point.distanceToSquared(wanted);
  if(best===null||squared<best.squared){const normal=triangle.getNormal(new Vector3()),bary=triangle.getBarycoord(point,new Vector3());best={ordinal,ids,squared,root:point.toArray(),normal:normal.toArray(),bary:bary?.toArray()};}
 }
 if(!best.bary||!best.root.every(Number.isFinite)||!best.normal.every(Number.isFinite)||best.root[1]<1.59||Math.abs(best.root[0])>.09||best.normal[1]<=0)throw Error('Authored root outside declared upper-head domain '+zi+'/'+xi);
 const rootPoint=new Vector3(...best.root),normal=new Vector3(...best.normal),side=best.root[0]>=-.018?1:-1,v=(z+.015)/.128,heavy=side===1;
 const controls=[rootPoint.clone().addScaledVector(normal,.0025).toArray(),rootPoint.clone().addScaledVector(normal,.0135).add(new Vector3(side*.019,0,0)).toArray(),[side*(.083+.012*v),1.636-.008*(1-v),z*.85+.012],[side*(.119+(heavy?.006:0)),1.53+.014*(1-v),z*.82+.013+(heavy?.01:-.007)],[side*(.113+(heavy?.006:0)),1.464+.015*(1-v),z*.82+.016+(heavy?.012:-.013)],[side*(.094+(heavy?.009:0)),1.427+.018*(1-v)+(xi%2)*.0015,z*.80+.014+(heavy?.011:-.013)]];
 const first=new Vector3(...controls[1]).sub(new Vector3(...controls[0])).normalize().toArray(),last=new Vector3(...controls.at(-1)).sub(new Vector3(...controls.at(-2))).normalize().toArray();
 const maxWidth=.016+(xi%3)*.0008+(heavy?.001:0);
 guides.push({id:`crown-${zi}-${xi}`,wanted:wanted.toArray(),root:{triangle:best.ordinal,indices:best.ids,bary:best.bary,position:best.root,normal:best.normal,projectionMm:Math.sqrt(best.squared)*1000,standOff:.0025},curve:{type:'centripetal-catmull-rom',controls,tangents:{first,last},samples:49},section:{widthProfile:[[0,.009],[.18,maxWidth],[.45,maxWidth*.97],[.80,maxWidth*.72],[1,.0007]],rollProfile:[[0,0],[1,0]],frame:'parallel transport from root normal cross first tangent; angles radians, full width metres'},role:z>.082?'forehead-side sweep':z>.01?'crown-to-cheek side flow':'rearward crown flow',tip:'jaw-level inward turn',depth:heavy?'heavier positiveX cheek framing':'lighter negativeX swept-back temple'});
}
const pins=['PLAN.md','author.mjs'].map(name=>{const b=fs.readFileSync(path.join(folder,name));return {file:name,bytes:b.length,sha256:createHash('sha256').update(b).digest('hex')};});
const artifact={createdAt:new Date().toISOString(),source:{file,mesh:'base.001',sha256:sha,positions:positions.length/3,triangles:indices.length/3},orientation:'A, negativeX part; one artistic study, no user side preference selected',attachment:'Declared PLAN per-root rest/posed orthonormal triangle frames; static named-head parenting, no moving fit',backing:'No opaque cap. Literal overlapping visible locks own only their actual crown/side coverage. Gaps and exposed scalp remain rejectable.',material:{purpose:'Opaque modelling shape only, no fine-strand/atlas/pigment qualification',colour:'#665048',roughness:.62,metalness:0,side:'double'},guides,limits:['New independent artist geometry, accepted original source assets unchanged.','Root selection is direct exported body topology, not anatomical scalp-group classification.','No interpolation/meshing/SDK/runtime/render/clearance/skin/dynamics/production qualification in authoring stage.']};
fs.writeFileSync(path.join(folder,'GUIDES.json'),JSON.stringify(artifact,null,2)+'\n',{flag:'wx'});
const output=fs.readFileSync(path.join(folder,'GUIDES.json')),receipt={command:'node docs/evidence/hair-2026-10-03/surface-guides/author.mjs',pid:process.pid,started,ended:new Date().toISOString(),pins,source:artifact.source,output:{file:'GUIDES.json',bytes:output.length,sha256:createHash('sha256').update(output).digest('hex')},guides:guides.length,rootProjectionMm:{min:Math.min(...guides.map(g=>g.root.projectionMm)),max:Math.max(...guides.map(g=>g.root.projectionMm))},scope:'One source parse and exact authored native triangle/bary/normal/curve/section/profile dataset. No guide curve evaluation, mesh construction or native job.'};
fs.writeFileSync(path.join(folder,'AUTHOR.json'),JSON.stringify(receipt,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify(receipt));
