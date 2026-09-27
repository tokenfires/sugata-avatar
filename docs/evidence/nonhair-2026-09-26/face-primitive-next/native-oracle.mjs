// Independent source-array reconstruction of native CPU-skinned body readback.
import assert from 'node:assert/strict';
import {Matrix4,Vector3,Vector4} from 'three';
import {inspectPatchLayout} from './TipWidthCandidate.mjs';
import {readAccessor} from '../../../../tools/lut-bake/glb.mjs';
export function createNativeBodyOracle(originalBytes){
 const {glb,primitive}=inspectPatchLayout(originalBytes),mesh=glb.json.meshes.find(m=>m.name==='base.001');
 const skinIndices=readAccessor(glb,primitive.attributes.JOINTS_0).data,weights=readAccessor(glb,primitive.attributes.WEIGHTS_0).data;
 const morphs=primitive.targets.map(t=>readAccessor(glb,t.POSITION).data),names=mesh.extras.targetNames;
 return function reconstruct(positions,geometry,inputReceipt){
  const body=geometry.meshes.find(m=>m.id==='body'),source=inputReceipt.rows.find(m=>m.body);assert.ok(body&&source);assert.equal(source.relative,true);assert.equal(source.boneInverses.length,geometry.rig.length);
  const matrices=geometry.rig.map((b,i)=>new Matrix4().multiplyMatrices(new Matrix4().fromArray(b.world),new Matrix4().fromArray(source.boneInverses[i]))),bind=new Matrix4().fromArray(source.bind),inverseBind=new Matrix4().fromArray(source.inverseBind),world=new Matrix4().fromArray(body.world);
  const active=names.map((n,i)=>({weight:body.morphs[n],array:morphs[i]})).filter(x=>x.weight!==0);assert.ok(active.every(x=>Number.isFinite(x.weight)));
  const p=new Vector3(),delta=new Vector3(),t=new Vector3(),base=new Vector4(),weighted=new Vector4(),out=new Float32Array(positions.length);
  for(let i=0;i<positions.length/3;i++){
   p.fromArray(positions,3*i);delta.set(0,0,0);for(const m of active)delta.addScaledVector(t.fromArray(m.array,3*i),m.weight);p.add(delta);
   base.set(p.x,p.y,p.z,1).applyMatrix4(bind);p.set(0,0,0);
   for(let k=0;k<4;k++){const w=weights[4*i+k];if(w!==0)p.addScaledVector(weighted.copy(base).applyMatrix4(matrices[skinIndices[4*i+k]]),w);}
   p.applyMatrix4(inverseBind).applyMatrix4(world).toArray(out,3*i);
  }
  assert.equal(body.positions.length,out.length);for(let i=0;i<out.length;i++)assert.ok(Object.is(out[i],body.positions[i]),'Native body reconstruction mismatch at component '+i);
  return {components:out.length,exact:true,method:'Pinned original morph/skin arrays plus declared candidate rest positions and observed native double rig/inverse-bind/world matrices; exact Float32 native getVertexPosition readback equality.'};
 };
}
// JSON cannot otherwise retain signed zero. No nonfinite numeric state is admitted.
export function encodeState(value){return JSON.stringify(value,(_,x)=>{if(x===undefined)return {__tipUndefined:true};if(typeof x==='number'){assert.ok(Number.isFinite(x),'Nonfinite archived state');if(Object.is(x,-0))return {__tipNegativeZero:true};}return x;});}
export function decodeState(text){const restore=x=>{if(x&&typeof x==='object'){if(Object.keys(x).length===1&&x.__tipNegativeZero===true)return -0;if(Object.keys(x).length===1&&x.__tipUndefined===true)return undefined;for(const k of Object.keys(x))x[k]=restore(x[k]);}return x;};return restore(JSON.parse(text));}
