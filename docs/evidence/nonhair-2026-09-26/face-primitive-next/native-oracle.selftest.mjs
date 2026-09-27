import assert from 'node:assert/strict';import fs from 'node:fs';import {fileURLToPath} from 'node:url';
import {SkinnedMesh,BufferGeometry,BufferAttribute,MeshBasicMaterial,Bone,Skeleton,Matrix4,Vector3} from 'three';
import {inspectPatchLayout,createTipWidthOperator} from './TipWidthCandidate.mjs';import {readAccessor} from '../../../../tools/lut-bake/glb.mjs';
import {createNativeBodyOracle,encodeState,decodeState} from './native-oracle.mjs';
const root=new URL('../../../../',import.meta.url),input=Object.fromEntries(Object.entries({bodyBytes:'assets/wardrobe/body/g050.glb',mapBytes:'assets/identity/figure-vertex-map.bin',catalogueBytes:'assets/identity/catalogue.json',noseBytes:'assets/identity/targets/nose.bin'}).map(([k,p])=>[k,fs.readFileSync(new URL(p,root))]));
const op=await createTipWidthOperator(input),layout=inspectPatchLayout(input.bodyBytes),oracle=createNativeBodyOracle(input.bodyBytes),names=layout.glb.json.meshes.find(m=>m.name==='base.001').extras.targetNames;
const read=i=>readAccessor(layout.glb,i).data,bones=Array.from({length:53},(_,i)=>{const b=new Bone();b.name='fixture'+i;b.matrixWorld.makeRotationZ(i/170).setPosition(i/100,-i/200,i/300);return b;}),inverses=bones.map((_,i)=>new Matrix4().makeRotationX(i/210).setPosition(-i/500,i/600,0));
let count=0;for(const weight of [-1,0,1]){
 const candidate=op.candidate(weight),g=new BufferGeometry();g.setAttribute('position',new BufferAttribute(candidate.positions,3));g.setAttribute('skinIndex',new BufferAttribute(Uint16Array.from(read(layout.primitive.attributes.JOINTS_0)),4));g.setAttribute('skinWeight',new BufferAttribute(Float32Array.from(read(layout.primitive.attributes.WEIGHTS_0)),4));
 g.morphAttributes.position=layout.primitive.targets.map((t,i)=>{const a=new BufferAttribute(Float32Array.from(read(t.POSITION)),3);a.name=names[i];return a;});g.morphTargetsRelative=true;
 const mesh=new SkinnedMesh(g,new MeshBasicMaterial());mesh.skeleton=new Skeleton(bones,inverses);mesh.bindMatrix.makeRotationY(.17).setPosition(.2,-.1,.05);mesh.bindMatrixInverse.copy(mesh.bindMatrix).invert();mesh.matrixWorld.makeRotationX(.21).setPosition(.03,.07,-.09);
 for(const[name,w]of [['viseme_aa',.6],['mouthSmileLeft',.28],['noseSneerRight',.75]])mesh.morphTargetInfluences[mesh.morphTargetDictionary[name]]=w;
 const p=new Float32Array(candidate.positions.length),v=new Vector3();for(let i=0;i<p.length/3;i++)mesh.getVertexPosition(i,v).applyMatrix4(mesh.matrixWorld).toArray(p,i*3);
 const geometry={meshes:[{id:'body',positions:Array.from(p),world:mesh.matrixWorld.toArray(),morphs:Object.fromEntries(names.map((n,i)=>[n,mesh.morphTargetInfluences[i]]))}],rig:bones.map(b=>({world:b.matrixWorld.toArray()}))};
 const receipt={rows:[{body:true,relative:true,boneInverses:inverses.map(m=>m.toArray()),bind:mesh.bindMatrix.toArray(),inverseBind:mesh.bindMatrixInverse.toArray()}]};
 assert.equal(oracle(candidate.positions,geometry,receipt).exact,true);geometry.meshes[0].positions[0]+=1e-4;assert.throws(()=>oracle(candidate.positions,geometry,receipt),/mismatch/);count++;g.dispose();mesh.material.dispose();mesh.skeleton.dispose();
}
const roundtrip={zero:0,negative:-0,undefined,values:[-0,undefined,null,2]};assert.deepEqual(decodeState(encodeState(roundtrip)),roundtrip);assert.throws(()=>encodeState({bad:NaN}));assert.throws(()=>encodeState({bad:Infinity}));
console.log(JSON.stringify({passed:true,exactSourceArrayCases:count,negativeReadbackCases:count,losslessPrimitiveRoundtrip:true,scope:'Actual Three CPU skinning with source g050 attributes/morphs and synthetic nontrivial matrices; native initialized pose remains separately gated.'}));
