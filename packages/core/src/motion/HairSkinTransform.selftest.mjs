import assert from 'node:assert/strict';
import { Bone, BufferAttribute, BufferGeometry, Group, Matrix4, Skeleton, SkinnedMesh, Vector3 } from 'three';
import { createHairSkinTransform, assertRigidHairTransform } from './HairSkinTransform.js';
const geometry=new BufferGeometry();geometry.setAttribute('position',new BufferAttribute(new Float32Array([.2,1.5,.03]),3));geometry.setAttribute('skinIndex',new BufferAttribute(new Uint16Array([0,0,0,0]),4));geometry.setAttribute('skinWeight',new BufferAttribute(new Float32Array([1,0,0,0]),4));
const root=new Group(),head=new Bone(),mesh=new SkinnedMesh(geometry);head.name='head';root.add(head,mesh);root.updateMatrixWorld(true);mesh.bind(new Skeleton([head]),new Matrix4());
const update=createHairSkinTransform(mesh,head,mesh.skeleton.boneInverses[0]);let groups=0;
function test(name,run){run();groups++;console.log('PASS '+name);}
function reset(){root.position.set(0,0,0);root.rotation.set(0,0,0);root.scale.set(1,1,1);head.scale.set(1,1,1);mesh.bindMatrix.identity();root.updateMatrixWorld(true);}
try{
 test('identity bindings preserve original solver operands and stable return matrices exactly',()=>{
  reset();const value=update({requireRigid:true});assert.deepEqual(value.headBoneMatrixWorld.elements,head.matrixWorld.elements);assert.deepEqual(value.headBoneInverse.elements,mesh.skeleton.boneInverses[0].elements);
  const next=update({requireRigid:true});assert.equal(next,value);assert.equal(next.worldMatrix,value.worldMatrix);
 });
 test('attached-mode common translation and rotation match native world vertices and reject old doubled transform',()=>{
  for(const mode of ['translation','rotation']){reset();if(mode==='translation')root.position.set(.1,.2,.3);else root.rotation.y=.4;root.updateMatrixWorld(true);
   const native=mesh.getVertexPosition(0,new Vector3()).applyMatrix4(mesh.matrixWorld),rest=new Vector3().fromBufferAttribute(geometry.getAttribute('position'),0),actual=update({requireRigid:true});
   assert.ok(rest.clone().applyMatrix4(actual.worldMatrix).distanceTo(native)<1e-12);
   const old=new Matrix4().copy(mesh.matrixWorld).multiply(head.matrixWorld).multiply(mesh.skeleton.boneInverses[0]);assert.ok(rest.applyMatrix4(old).distanceTo(native)>.01);
  }
 });
 test('valid nonidentity rigid bind matrix is included, not refused solely for being nonidentity',()=>{
  reset();mesh.bindMatrix.makeRotationX(.2).setPosition(.05,-.07,.11);const native=mesh.getVertexPosition(0,new Vector3()).applyMatrix4(mesh.matrixWorld),rest=new Vector3().fromBufferAttribute(geometry.getAttribute('position'),0);
  assert.ok(rest.applyMatrix4(update({requireRigid:true}).worldMatrix).distanceTo(native)<1e-12);
 });
 test('current full skin map detects mesh-parent and animated-head scale at every update',()=>{
  reset();update({requireRigid:true});root.scale.set(2,1,1);root.updateMatrixWorld(true);assert.throws(()=>update({requireRigid:true}),/scale and shear/);
  reset();update({requireRigid:true});head.scale.set(1,2,1);root.updateMatrixWorld(true);assert.throws(()=>update({requireRigid:true}),/scale and shear/);
 });
 test('proper unit-rigid gate refuses shear, reflection, nonfinite and projective transforms',()=>{
  const shear=new Matrix4();shear.elements[4]=.2;assert.throws(()=>assertRigidHairTransform(shear),/scale and shear/);
  assert.throws(()=>assertRigidHairTransform(new Matrix4().makeScale(-1,1,1)),/reflection/);
  const invalid=new Matrix4();invalid.elements[12]=NaN;assert.throws(()=>assertRigidHairTransform(invalid),/finite/);
  const projective=new Matrix4();projective.elements[3]=.1;assert.throws(()=>assertRigidHairTransform(projective),/affine/);
  assert.doesNotThrow(()=>assertRigidHairTransform(new Matrix4().makeRotationZ(.7).setPosition(10,-3,5)));
 });
 console.log(groups+' head skin transform CPU groups passed');
}finally{geometry.dispose();mesh.skeleton.dispose();}
