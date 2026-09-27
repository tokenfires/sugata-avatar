// CPU-only actual native motion owners over source g050 bones. No Avatar loading/GPU claim.
import fs from 'node:fs';
import {Bone,Object3D} from 'three';
import {Avatar} from '../../../../packages/core/src/Avatar.js';
import {MotionStack} from '../../../../packages/core/src/motion/MotionStack.js';
import {AttentionAction} from '../../../../packages/core/src/motion/AttentionAction.js';
import {Skeleton} from '../../../../packages/core/src/figure/Skeleton.js';
import {RestPose} from '../../../../packages/core/src/figure/RestPose.js';
import {readGlb} from '../../../../tools/lut-bake/glb.mjs';
import {REQUIRED_SOURCE_HASHES} from '../hand-clearance/HandAttributionArm.mjs';
import {sha} from './TipWidthCandidate.mjs';
const rootURL=new URL('../../../../',import.meta.url);
const glb=readGlb(new URL('assets/wardrobe/body/g050.glb',rootURL).pathname),json=glb.json;
export const fixturePins=Object.fromEntries(Object.keys(REQUIRED_SOURCE_HASHES).map(p=>[p,sha(fs.readFileSync(new URL(p,rootURL)))]));
export function fixture(){
 const jointIDs=new Set(json.skins.flatMap(s=>s.joints));
 const nodes=json.nodes.map((d,i)=>{const n=jointIDs.has(i)?new Bone():new Object3D();n.name=d.name??'';if(d.matrix){n.matrix.fromArray(d.matrix);n.matrix.decompose(n.position,n.quaternion,n.scale);}else{if(d.translation)n.position.fromArray(d.translation);if(d.rotation)n.quaternion.fromArray(d.rotation);if(d.scale)n.scale.fromArray(d.scale);}return n;});
 json.nodes.forEach((d,i)=>(d.children??[]).forEach(c=>nodes[i].add(nodes[c])));const root=new Object3D();for(const i of json.scenes[json.scene??0].nodes)root.add(nodes[i]);root.updateMatrixWorld(true);
 const skeleton=new Skeleton(root);RestPose.load('relaxed-standing').applyTo(skeleton);skeleton.update();root.updateMatrixWorld(true);
 const names=json.meshes.find(m=>m.name==='base.001').extras.targetNames,values=names.map(()=>0),lookup=new Map(names.map((n,i)=>[n,i]));
 const target={hasMorph:n=>lookup.has(n),setMorph(n,v){if(lookup.has(n))values[lookup.get(n)]=v;},getMorph:n=>values[lookup.get(n)]??0,getBone:n=>root.getObjectByName(n)??null};
 const stack=new MotionStack({seed:20260807});stack.bind(target);
 const body={name:'CPU body state witness',morphTargetInfluences:values,skeleton:{bones:json.skins[0].joints.map(i=>nodes[i]),boneMatrices:new Float32Array(json.skins[0].joints.length*16)}};
 const a={stack,target,seed:20260807,clockSeconds:0,autoStart:false,disposed:false,figure:{root,body,meshes:[body]},wardrobe:{wornMeshes:new Map()},affectEnabled:true,teardownCalls:0,
  stage:{draw(){},renderer:{_nodes:{nodeFrame:{frameId:50,time:0,deltaTime:0,renderId:8,lastTime:undefined}}},temporal:{frameEpoch:()=>({frame:1})}},
  report(){return {affect:{pad:{...this.affectState.pad},target:{...this.affectState.target}}};},
  setIdentity(){throw Error('Fixture must not rebind');},dress(){throw Error('Fixture must not dress');},
  dispose(){this.teardownCalls++;this.disposed=true;this.stack.dispose();this.stack=null;this.figure=this.target=this.posture=this.gesture=null;}};
 Avatar.prototype.buildLayers.call(a);for(const l of Object.values(a.layers))stack.add(l);
 Avatar.prototype.assertFingerClaimCanResolve.call(a);Avatar.prototype.attachAffect.call(a);Avatar.prototype.attachSpeech.call(a);
 const attention=new AttentionAction(a);
 return {a,stack,attention,root,firstFrame(){stack.update(0);root.updateMatrixWorld(true);}};
}
