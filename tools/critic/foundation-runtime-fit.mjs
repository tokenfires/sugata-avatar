// Read-only source-to-pose reconstruction of the independently verified contact.
import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';import {gunzipSync,gzipSync} from 'node:zlib';
import {Bone,Skeleton,Mesh,SkinnedMesh,BufferGeometry,BufferAttribute,Matrix4,Vector3,Quaternion} from 'three';
import {ROOT,hashFile,sha256} from '../figure-pipeline/collar_replacement_manifest.mjs';
import {readGlb,readAccessor} from '../lut-bake/glb.mjs';
import {triangleDistance,selftest} from '../figure-pipeline/collar_clearance_review.mjs';
const base='captures/foundation-domain-motion-2026-09-30-v1',auditBase='captures/foundation-domain-motion-clearance-2026-09-30-v1';
const captureFile=path.join(ROOT,base,'report.json'),auditFile=path.join(ROOT,auditBase,'report.json');
assert.equal(hashFile(captureFile),'24071200867f77630521e51202fe3c9de6069173cee905d0a5ecda713176953b');assert.equal(hashFile(auditFile),'1e22fbe045b34606fdcced937b2442eb9b8785ece4da5d3e7497193019fe5e0f');
const capture=JSON.parse(fs.readFileSync(captureFile)),audit=JSON.parse(fs.readFileSync(auditFile)),run=capture.runs.find(r=>r.key==='band-foundation');assert.ok(run.completed);assert.equal(audit.allFourStatesExterior,false);
const out=path.join(ROOT,'captures/foundation-runtime-fit-2026-09-30-v1');assert.ok(!fs.existsSync(out));fs.mkdirSync(out,{recursive:true});
const sources=['tools/critic/foundation-runtime-fit.mjs','docs/evidence/wardrobe-2026-09-30/foundation-runtime-fit/PLAN.md','tools/lut-bake/glb.mjs','tools/figure-pipeline/collar_clearance_review.mjs','tools/figure-pipeline/hair_geometry.mjs','tools/figure-pipeline/hair_surface.mjs','tools/figure-pipeline/collar_replacement_manifest.mjs','packages/core/src/wardrobe/Wardrobe.js','node_modules/three/package.json','node_modules/three/build/three.core.js','node_modules/three/build/three.module.js','node_modules/three/src/objects/SkinnedMesh.js','node_modules/three/src/objects/Mesh.js','node_modules/three/examples/jsm/loaders/GLTFLoader.js','package-lock.json','assets/wardrobe/body/g050.glb',`${base}/band.glb`,`${base}/report.json`,`${auditBase}/report.json`,...run.geometry.map(g=>`${base}/${g.file}`)];
const pins=Object.fromEntries(sources.map(p=>[p,hashFile(path.join(ROOT,p))]));for(const p of sources){const dest=path.join(out,'source',p);fs.mkdirSync(path.dirname(dest),{recursive:true});fs.copyFileSync(path.join(ROOT,p),dest);}
assert.equal(pins['assets/wardrobe/body/g050.glb'],'fc4445c95ed3f423734ff272ee78ebb44d762a8f16edb94b26039de7a8a96b3a');assert.equal(pins[`${base}/band.glb`],capture.arms.band.sha256);
const report={started:new Date().toISOString(),pid:process.pid,status:'running',pins,reconstructions:[],observations:[],artifacts:[],errors:[],scope:'Exact four-state CPU reconstruction followed by one fixed contact-pair attribution. No GPU readback, changed asset, general fit or production skinning qualification.'};
const save=()=>fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');
const archive=(file,value)=>{const raw=Buffer.from(JSON.stringify(value)+'\n'),bytes=gzipSync(raw);fs.writeFileSync(path.join(out,file),bytes);const rec={file,sha256:sha256(bytes),decodedSHA256:sha256(raw)};report.artifacts.push(rec);return rec;};
const identity=new Matrix4(),v=new Vector3(),kept=[];
function mesh(glb,index,bodyJointNames){
  const def=glb.json.meshes[index];assert.equal(def.primitives.length,1);const p=def.primitives[0],node=glb.json.nodes.find(n=>n.mesh===index),skin=glb.json.skins[node.skin],jointNames=skin.joints.map(i=>glb.json.nodes[i].name),geometry=new BufferGeometry();
  const get=(name)=>readAccessor(glb,p.attributes[name]).data;
  geometry.setAttribute('position',new BufferAttribute(Float32Array.from(get('POSITION')),3));
  const joints=Array.from(get('JOINTS_0')),remap=jointNames.map(n=>{const i=bodyJointNames.indexOf(n);assert.ok(i>=0,n);return i;});
  geometry.setAttribute('skinIndex',new BufferAttribute(Uint16Array.from(joints,i=>remap[i]),4));geometry.setAttribute('skinWeight',new BufferAttribute(Float32Array.from(get('WEIGHTS_0')),4));
  const indices=Array.from(readAccessor(glb,p.indices).data);geometry.setIndex(new BufferAttribute(Uint32Array.from(indices),1));
  const targets=p.targets??[],names=def.extras?.targetNames??[];assert.equal(targets.length,names.length);
  if(targets.length){geometry.morphAttributes.position=targets.map((t,i)=>{const values=t.POSITION===undefined?new Float32Array(geometry.attributes.position.count*3):Float32Array.from(readAccessor(glb,t.POSITION).data),a=new BufferAttribute(values,3);a.name=names[i];return a;});geometry.morphTargetsRelative=true;}
  const object=new SkinnedMesh(geometry);kept.push(object);object.normalizeSkinWeights();object.matrixWorld.identity();
  return{object,indices,jointNames,remap,names,sourceJoints:joints,sourceWeights:Array.from(get('WEIGHTS_0'))};
}
function positions(m,skin=true){const data=new Float32Array(m.geometry.attributes.position.count*3);for(let i=0;i<data.length/3;i++){if(skin)m.getVertexPosition(i,v);else Mesh.prototype.getVertexPosition.call(m,i,v);v.applyMatrix4(m.matrixWorld).toArray(data,i*3);}return Array.from(data);}
function residual(actual,expected){assert.equal(actual.length,expected.length);let max=0,changedComponents=0,worst=null;const nonfinite=[];for(let i=0;i<actual.length;i++){if(!Number.isFinite(actual[i])||!Number.isFinite(expected[i])){nonfinite.push({vertex:Math.floor(i/3),component:i%3,actual:String(actual[i]),expected:String(expected[i])});continue;}const d=Math.abs(actual[i]-expected[i]);if(d){changedComponents++;if(d>max){max=d;worst={vertex:Math.floor(i/3),component:i%3,actual:actual[i],expected:expected[i]};}}}return{exact:nonfinite.length===0&&changedComponents===0,nonfinite,changedComponents,maximumComponentMetres:max,worst};}
const tri=(positions,indices,id)=>indices.slice(id*3,id*3+3).map(i=>positions.slice(i*3,i*3+3));
try{
  save();report.controls=selftest();assert.equal(report.controls.pass,true);
  report.nonfiniteControls=[residual([NaN,0,0],[0,0,0]),residual([0,0,0],[Infinity,0,0])];assert.ok(report.nonfiniteControls.every(r=>!r.exact&&r.nonfinite.length===1));
  const bodyGlb=readGlb(path.join(ROOT,'assets/wardrobe/body/g050.glb')),bandGlb=readGlb(path.join(ROOT,base,'band.glb')),bi=bodyGlb.json.meshes.findIndex(m=>m.name==='base.001');assert.ok(bi>=0);
  let nodeIndex=bodyGlb.json.nodes.findIndex(n=>n.mesh===bi);report.sourceMeshAncestors=[];
  while(nodeIndex>=0){const n=bodyGlb.json.nodes[nodeIndex],matrix=n.matrix?new Matrix4().fromArray(n.matrix):new Matrix4().compose(new Vector3().fromArray(n.translation??[0,0,0]),new Quaternion().fromArray(n.rotation??[0,0,0,1]),new Vector3().fromArray(n.scale??[1,1,1]));report.sourceMeshAncestors.push({index:nodeIndex,name:n.name,matrix:matrix.toArray()});save();assert.deepEqual(matrix.toArray(),identity.toArray(),'Unsupported nonidentity source body ancestor');nodeIndex=bodyGlb.json.nodes.findIndex(n=>n.children?.includes(nodeIndex));}
  const bodyNode=bodyGlb.json.nodes.find(n=>n.mesh===bi),skin=bodyGlb.json.skins[bodyNode.skin],names=skin.joints.map(i=>bodyGlb.json.nodes[i].name),inverseData=readAccessor(bodyGlb,skin.inverseBindMatrices).data;
  const bones=names.map(name=>{const b=new Bone();b.name=name;return b;}),inverses=names.map((_,i)=>new Matrix4().fromArray(inverseData,i*16)),skeleton=new Skeleton(bones,inverses);
  const body=mesh(bodyGlb,bi,names),band=mesh(bandGlb,0,names);body.object.bind(skeleton,identity);band.object.bind(skeleton,identity);
  report.jointNames=names;report.morphNames=body.names;report.bandJointRemap=band.remap;
  const states=[];
  for(const step of [0,240,480,720]){
    const g=run.geometry.find(g=>g.step===step),bytes=fs.readFileSync(path.join(ROOT,base,g.file));assert.equal(sha256(bytes),g.sha256);const raw=gunzipSync(bytes);assert.equal(sha256(raw),g.decodedSHA256);const saved=JSON.parse(raw),state=run.states.find(s=>s.step===step);
    assert.deepEqual(Object.keys(saved.rig).sort(),[...names].sort());for(let i=0;i<bones.length;i++)bones[i].matrixWorld.fromArray(saved.rig[names[i]]);
    assert.equal(state.morphs.length,body.names.length);body.object.morphTargetInfluences=[...state.morphs];
    const expectedBody=saved.meshes.find(m=>m.id==='body'),expectedBand=saved.meshes.find(m=>m.id==='foundation_bra');assert.deepEqual(body.indices,expectedBody.fullIndices);assert.deepEqual(band.indices,expectedBand.fullIndices);
    const a=positions(body.object),b=positions(band.object),row={step,time:saved.time,body:residual(a,expectedBody.positions),band:residual(b,expectedBand.positions)};
    row.artifact=archive(`reconstructed-${step}.json.gz`,{step,body:a,band:b});report.reconstructions.push(row);states.push({step,saved,state,a,b});save();
  }
  report.exactReconstruction=report.reconstructions.every(r=>r.body.exact&&r.band.exact);save();assert.ok(report.exactReconstruction,'Exact source-to-capture gate failed; no counterfactual accepted');
  const sourceBody=Array.from(body.object.geometry.attributes.position.array),sourceBand=Array.from(band.object.geometry.attributes.position.array);
  report.sourceRestPair={body:tri(sourceBody,body.indices,2215),band:tri(sourceBand,band.indices,26)};report.sourceRestPair.distance=triangleDistance(report.sourceRestPair.band,report.sourceRestPair.body);
  body.object.morphTargetInfluences=[...states[0].state.morphs];const unskinnedBody=positions(body.object,false),unskinnedBand=positions(band.object,false);
  report.omittedSkinControl={body:residual(unskinnedBody,states[0].a),band:residual(unskinnedBand,states[0].b),morphsPreserved:states[0].state.morphs,artifact:archive('omitted-skin-control.json.gz',{body:unskinnedBody,band:unskinnedBand})};assert.equal(report.omittedSkinControl.body.exact,false);assert.equal(report.omittedSkinControl.band.exact,false);
  const witness=(m,ids,source,posed)=>ids.map(i=>({vertex:i,source:source.slice(i*3,i*3+3),posed:posed.slice(i*3,i*3+3),weights:Array.from({length:4},(_,k)=>{const at=i*4+k;return{sourceJoint:m.jointNames[m.sourceJoints[at]],runtimeJoint:names[m.object.geometry.attributes.skinIndex.array[at]],sourceWeight:m.sourceWeights[at],normalizedWeight:m.object.geometry.attributes.skinWeight.array[at]};})}));
  for(const s of states){
    for(let i=0;i<bones.length;i++)bones[i].matrixWorld.fromArray(s.saved.rig[names[i]]);body.object.morphTargetInfluences=Array(body.names.length).fill(0);const noMorph=positions(body.object);
    const bt=tri(s.b,band.indices,26),ordinary=tri(s.a,body.indices,2215),zero=tri(noMorph,body.indices,2215),row={step:s.step,ordinaryPair:triangleDistance(bt,ordinary),zeroMorphPair:triangleDistance(bt,zero),bodyMorphContribution:residual(s.a,noMorph),contactBodyCoordinatesExactWithoutMorphs:JSON.stringify(ordinary)===JSON.stringify(zero),body:witness(body,[1519,1530,1520],sourceBody,s.a),band:witness(band,[1950,11,1225],sourceBand,s.b),actualRig:s.saved.rig};
    row.zeroMorphArtifact=archive(`zero-morph-${s.step}.json.gz`,{positions:noMorph});report.observations.push(row);save();
  }
  for(const[p,h]of Object.entries(pins))assert.equal(hashFile(path.join(ROOT,p)),h,p);report.status='observed';
}catch(error){report.status='failed';report.errors.push(error.stack);process.exitCode=1;}
finally{for(const m of kept){m.geometry.dispose();m.material.dispose();}report.finished=new Date().toISOString();save();console.log(JSON.stringify({status:report.status,pid:process.pid,exact:report.exactReconstruction,reconstructions:report.reconstructions,observations:report.observations.map(o=>({step:o.step,ordinary:o.ordinaryPair,zeroMorph:o.zeroMorphPair,witnessUnchanged:o.contactBodyCoordinatesExactWithoutMorphs})),errors:report.errors}));}
