/** One read-only cap-prefix baseline audit; no guide metrics or candidate. */
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {Worker, isMainThread, parentPort, threadId} from 'node:worker_threads';
import {Matrix4, Quaternion, Vector3, Triangle} from 'three';
import {readGlb, readPrimitive, readAccessor} from '../lut-bake/glb.mjs';
import {connectedComponents, SurfaceGrid} from '../figure-pipeline/hair_geometry.mjs';
import {measureHairSurface} from '../figure-pipeline/hair_surface.mjs';
import {decodePng} from './png.mjs';

const out='captures/cap-baseline-2026-10-02-v1', hairPath='captures/bob-lower-fallback-v1/candidate.glb', bodyPath='assets/figures/figure_g050.glb';
const hash=b=>createHash('sha256').update(b).digest('hex');
let auditContext={stage:'before audit'};
const pins={[hairPath]:'8c458428551ca546d2aac511dec3b516067d53050de9663a563b9884a4ae5fe7',[bodyPath]:'b56115d0cb52edb72af7e725bf479d81253b660c298bd95ff9e89456d671ec14'};
const sources=[...Object.keys(pins),'assets/hair/bob02/flow.png','assets/hair/bob02/depth.png','tools/critic/audit-cap-baseline.mjs','tools/lut-bake/glb.mjs','tools/figure-pipeline/hair_geometry.mjs','tools/figure-pipeline/hair_surface.mjs','tools/critic/png.mjs','packages/core/src/Avatar.js','packages/core/src/material/HairMaterial.js','packages/core/src/render/HairCardFrame.js','docs/evidence/appearance-2026-10-02/front-design/CAP-PLAN.md','package-lock.json'];
sources.push('node_modules/three/package.json','node_modules/three/build/three.module.js','node_modules/three/build/three.core.js');
if(isMainThread){
 if(fs.existsSync(out)) throw new Error('Preserve prior output; no retry.');
 const started=new Date().toISOString(), sourceHashes=Object.fromEntries(sources.map(p=>[p,hash(fs.readFileSync(p))]));
 fs.mkdirSync(out,{recursive:true});
 for(const p of sources.filter(p=>!Object.hasOwn(pins,p))){const target=`${out}/sources/${p}`;fs.mkdirSync(target.slice(0,target.lastIndexOf('/')),{recursive:true});fs.copyFileSync(p,target,fs.constants.COPYFILE_EXCL);}
 console.log(JSON.stringify({status:'one read-only cap baseline audit',pid:process.pid,started,out,sourceHashes}));
 const worker=new Worker(new URL(import.meta.url)); let settled=false,latestCheckpoint=null;
 const finish=(result,exitCode)=>{if(settled)return;settled=true;clearTimeout(timer);const finished=new Date().toISOString();const unchanged=sources.every(p=>hash(fs.readFileSync(p))===sourceHashes[p]);if(!unchanged){result.status='refused source drift';exitCode=2;}const report={pid:process.pid,started,finished,sourceHashes,sourcesUnchanged:unchanged,...result};fs.writeFileSync(`${out}/report.json`,JSON.stringify(report,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify({status:report.status,finished,exitCode,reportSha256:hash(fs.readFileSync(`${out}/report.json`)),out}));process.exitCode=exitCode;};
 const timer=setTimeout(async()=>{finish({status:'refused CPU time bound',limitMs:300000,latestCheckpoint,limit:'Incomplete computation; only last delivered checkpoint retained.'},2);await worker.terminate();},300000);
 worker.on('message',result=>{if(result.kind==='checkpoint'){latestCheckpoint=result.context;return;}finish(result,result.status==='measured baseline eligible'?0:2);});
 worker.on('error',error=>finish({status:'refused instrument error',latestCheckpoint,error:error.stack},2));
 worker.on('exit',code=>{if(!settled)finish({status:'refused worker exit without receipt',latestCheckpoint,workerExit:code},2);});
}else{
 try{parentPort.postMessage(audit());}catch(error){parentPort.postMessage({status:'refused instrument error',workerThread:threadId,completedContext:auditContext,error:error.stack,limit:'Only completed observations retained; remaining predicates unexecuted.'});}
}
function audit(){
 const checks=[], add=(name,pass,witness)=>checks.push({name,pass,witness});
 auditContext={stage:'input and ownership checks',checks};
 for(const[p,expected]of Object.entries(pins))add(`exact input ${p}`,hash(fs.readFileSync(p))===expected,{expected,actual:hash(fs.readFileSync(p))});
 const hg=readGlb(hairPath), bg=readGlb(bodyPath), h=readPrimitive(hg,'hair_bob02'), b=readPrimitive(bg,'base.001');
 const invalidBodyNormals=[];for(let v=0;v<b.vertexCount;v++){const normal=Array.from(b.normals.slice(v*3,v*3+3));if(!normal.every(Number.isFinite)||Math.hypot(...normal)<=1e-9)invalidBodyNormals.push({vertex:v,normal});}
 add('finite body positions and valid source normals for signing',Array.from(b.positions).every(Number.isFinite)&&invalidBodyNormals.length===0,{normalLengthFloor:1e-9,invalidBodyNormals});
 const hp=hg.json.meshes.find(m=>m.name==='hair_bob02').primitives[0], bp=bg.json.meshes.find(m=>m.name==='base.001').primitives[0];
 add('expected vertex count',h.vertexCount===17516,{actual:h.vertexCount});
 const nodeData=(g,meshName)=>{
  const parents=new Map();g.json.nodes.forEach((n,i)=>(n.children??[]).forEach(c=>parents.set(c,i)));
  const memo=new Map(),world=i=>{if(memo.has(i))return memo.get(i);const n=g.json.nodes[i];const local=n.matrix?new Matrix4().fromArray(n.matrix):new Matrix4().compose(new Vector3(...(n.translation??[0,0,0])),new Quaternion(...(n.rotation??[0,0,0,1])),new Vector3(...(n.scale??[1,1,1])));const matrix=parents.has(i)?world(parents.get(i)).clone().multiply(local):local;memo.set(i,matrix);return matrix;};
  const mi=g.json.meshes.findIndex(m=>m.name===meshName),ni=g.json.nodes.findIndex(n=>n.mesh===mi),skin=g.json.skins[g.json.nodes[ni].skin],ib=readAccessor(g,skin.inverseBindMatrices).data;
  return{node:ni,meshWorld:world(ni),joints:skin.joints.map((i,k)=>({name:g.json.nodes[i].name,world:world(i),bind:world(i).clone().multiply(new Matrix4().fromArray(ib,k*16))}))};
 };
 const hn=nodeData(hg,'hair_bob02'),bn=nodeData(bg,'base.001'),identity=new Matrix4(),err=(a,c)=>Math.max(...a.elements.map((v,i)=>Math.abs(v-c.elements[i])));
 const bind={hairMeshIdentityError:err(hn.meshWorld,identity),bodyMeshIdentityError:err(bn.meshWorld,identity),hairBindIdentityError:Math.max(...hn.joints.map(j=>err(j.bind,identity))),bodyBindIdentityError:Math.max(...bn.joints.map(j=>err(j.bind,identity))),jointNamesEqual:JSON.stringify(hn.joints.map(j=>j.name))===JSON.stringify(bn.joints.map(j=>j.name)),jointWorldMaximumError:hn.joints.length===bn.joints.length?Math.max(...hn.joints.map((j,i)=>err(j.world,bn.joints[i].world))):Infinity,skinJoint44:hn.joints[44]?.name};
 auditContext.bind=bind;
 add('shared raw bind space',Object.entries(bind).filter(([k])=>k.endsWith('Error')).every(([,v])=>v<=1e-5)&&bind.jointNamesEqual,{...bind,tolerance:1e-5});
 const capIndices=[],originalTriangles=[],mixed=[];for(let t=0;t<h.indices.length;t+=3){const ids=Array.from(h.indices.slice(t,t+3));if(ids.every(v=>v<652)){capIndices.push(...ids);originalTriangles.push(t/3);}else if(ids.some(v=>v<652))mixed.push({triangle:t/3,ids});}
 add('no mixed cap/card triangles',mixed.length===0,mixed);
 const components=connectedComponents(Uint32Array.from(capIndices),652).map(c=>({vertices:c.vertices,triangles:c.triangles}));
 add('two cap components, all652 used',components.length===2&&components.every(c=>c.vertices.length===326)&&new Set(capIndices).size===652,{components:components.map(c=>({first:c.vertices[0],last:c.vertices.at(-1),vertices:c.vertices.length,triangles:c.triangles.length})),used:new Set(capIndices).size});
 add('finite cap positions/normals/UV0',Array.from(h.positions.slice(0,652*3)).every(Number.isFinite)&&Array.from(h.normals.slice(0,652*3)).every(Number.isFinite)&&Array.from(h.uvs.slice(0,652*2)).every(Number.isFinite),{});
 const uv1=readAccessor(hg,hp.attributes.TEXCOORD_1).data,joints=readAccessor(hg,hp.attributes.JOINTS_0).data,weights=readAccessor(hg,hp.attributes.WEIGHTS_0).data;
 const uvFailures=[],skinFailures=[];for(let v=0;v<652;v++){const uv=Array.from(h.uvs.slice(v*2,v*2+2));if(!(uv[0]>=0&&uv[0]<.125&&uv.every(Number.isFinite)))uvFailures.push({vertex:v,uv});if(![0,1,2,3].every(k=>joints[v*4+k]===(k===0?44:0)&&weights[v*4+k]===(k===0?1:0)))skinFailures.push({vertex:v,joints:Array.from(joints.slice(v*4,v*4+4)),weights:Array.from(weights.slice(v*4,v*4+4))});}
 add('cap UV0 within original cap strip',uvFailures.length===0,uvFailures);add('cap UV1 finite',Array.from(uv1.slice(0,652*2)).every(Number.isFinite),{});add('cap rigid head skin',skinFailures.length===0&&bind.skinJoint44==='head',skinFailures);
 const uvDegenerate=[];let minimumAbsUvDet=Infinity;for(let t=0;t<capIndices.length;t+=3){const ids=capIndices.slice(t,t+3),uv=ids.map(v=>Array.from(h.uvs.slice(v*2,v*2+2)));const det=(uv[1][0]-uv[0][0])*(uv[2][1]-uv[0][1])-(uv[2][0]-uv[0][0])*(uv[1][1]-uv[0][1]);minimumAbsUvDet=Math.min(minimumAbsUvDet,Math.abs(det));if(Math.abs(det)<=1e-12)uvDegenerate.push({capTriangle:t/3,originalTriangle:originalTriangles[t/3],ids,uv,det});}
 add('finite cap UV determinants',Number.isFinite(minimumAbsUvDet),{minimumAbsUvDet,observationThreshold:1e-12,nearDegenerateObservations:uvDegenerate,limit:'Counts are observations, not a new geometry admission threshold or proof of strand-frame quality.'});
 const texInfo=hg.json.materials[hp.material].pbrMetallicRoughness.baseColorTexture,tex=hg.json.textures[texInfo.index],im=hg.json.images[tex.source],view=hg.json.bufferViews[im.bufferView];
 add('embedded alpha uses UV0 without transform',im.mimeType==='image/png'&&(texInfo.texCoord??0)===0&&!texInfo.extensions?.KHR_texture_transform,{texInfo,image:im,sampler:hg.json.samplers?.[tex.sampler]});
 const png=decodePng(hg.bin.subarray(view.byteOffset??0,(view.byteOffset??0)+view.byteLength));
 const sidecars=Object.fromEntries(['flow','depth'].map(role=>{const file=`assets/hair/bob02/${role}.png`,bytes=fs.readFileSync(file),decoded=decodePng(bytes);return[role,{file,sha256:hash(bytes),width:decoded.width,height:decoded.height,bindingSource:'Avatar.js:560–561,594–595,3457–3458',limit:'Source-resolved bob02 binding, not a new live texture fetch or shader observation.'}];}));
 const material={atlas:{width:png.width,height:png.height,imageSha256:hash(hg.bin.subarray(view.byteOffset??0,(view.byteOffset??0)+view.byteLength))},sidecars,UV1Range:[0,1].map(k=>({min:Math.min(...Array.from({length:652},(_,v)=>uv1[v*2+k])),max:Math.max(...Array.from({length:652},(_,v)=>uv1[v*2+k]))})),semantics:'Shared first-mesh alpha; capU<1/8 bypasses root fade but not atlas alpha. Avatar supplies sidecar flow/depth; those fields and UV1 need separate visual qualification. No opacity/coverage calculation.'};
 auditContext.material=material;
 if(checks.some(c=>!c.pass))return{status:'refused cap structure/ownership',workerThread:threadId,checks,bind,material};
 auditContext.stage='signed cap samples';parentPort.postMessage({kind:'checkpoint',context:auditContext});
 const grid=new SurfaceGrid(b.positions,b.normals,b.indices),point=v=>Array.from(h.positions.slice(v*3,v*3+3)),samples=[],sampleFailures=[];
 auditContext.sampleFailures=sampleFailures;
 const sample=(p,at)=>{const hit=grid.nearest(p);if(!hit||!Number.isFinite(hit.signed))throw new Error('No finite body hit');const ids=Array.from(b.indices.slice(hit.triangle,hit.triangle+3)),corners=ids.map(v=>new Vector3().fromArray(b.positions,v*3)),bary=new Triangle(...corners).getBarycoord(new Vector3(...hit.closest),new Vector3());if(!bary)throw new Error('Degenerate closest body face for signing');const normal=new Vector3();ids.forEach((v,k)=>normal.addScaledVector(new Vector3().fromArray(b.normals,v*3),bary.getComponent(k)));if(!Number.isFinite(normal.length())||normal.length()<=1e-9){auditContext.invalidSignWitness={...at,point:p,bodyTriangle:hit.triangle/3,bodyBary:bary.toArray(),normal:normal.toArray()};throw new Error('Invalid interpolated closest-face normal for signing');}const r={...at,point:p,signedMm:hit.signed*1000,bodyTriangle:hit.triangle/3,closest:hit.closest,bodyBary:bary.toArray(),signNormalLength:normal.length()};samples.push(r);if(hit.signed<=0)sampleFailures.push(r);auditContext.samplesCompleted=samples.length;if(!auditContext.minimumSample||r.signedMm<auditContext.minimumSample.signedMm)auditContext.minimumSample=r;};
 for(let v=0;v<652;v++)sample(point(v),{vertex:v});
 for(let t=0;t<capIndices.length;t+=3){const ids=capIndices.slice(t,t+3),corners=ids.map(point);for(let i=0;i<=4;i++)for(let j=0;j<=4-i;j++){const bary=[i/4,j/4,1-(i+j)/4],p=[0,1,2].map(k=>corners.reduce((sum,c,l)=>sum+c[k]*bary[l],0));sample(p,{capTriangle:t/3,originalTriangle:originalTriangles[t/3],ids,bary});}}
 auditContext.stage='full cap/body shell crossings';parentPort.postMessage({kind:'checkpoint',context:auditContext});
 const bounds={min:[-Infinity,-Infinity,-Infinity],max:[Infinity,Infinity,Infinity]},crossings=measureHairSurface({...h,positions:h.positions.slice(0,652*3),indices:Uint32Array.from(capIndices)},b,{headBounds:bounds,faceBounds:bounds,epsilon:1e-9,exampleLimit:100000});
 crossings.witnessLimit=100000;crossings.allHeadWitnessesRetained=crossings.head.examples.length===crossings.head.pairs;auditContext.crossings=crossings;
 add('all fixed cap signed samples >0',sampleFailures.length===0,{minimum:samples.reduce((m,s)=>s.signedMm<m.signedMm?s:m),sampleCount:samples.length,failedSamples:sampleFailures});add('full cap/body zero shell crossings',crossings.head.pairs===0,crossings);
 return{status:checks.every(c=>c.pass)?'measured baseline eligible':'refused unchanged cap rest fit',workerThread:threadId,checks,bind,material,capOriginalTriangles:originalTriangles,components:components.map(c=>({vertices:c.vertices,originalTriangles:c.triangles.map(t=>originalTriangles[t])})),limits:['Finite signed sampling uses interpolated body normals for side, not a global inside/outside proof.','Full shell intersection uses floating-point epsilon1e-9m; zero cannot exclude wholly internal triangles.','Raw bind-space only, no morph/pose/motion, scalp-coverage, shader/image or target-design qualification.','No cap guide solver metrics, new candidate or asset changes.']};
}
