import * as T from 'three/webgpu';
import {Avatar} from '../../../../packages/core/src/Avatar.js';
import {buildProposal} from './proposal.mjs';
const parameters=await fetch(new URL('./parameters.json',import.meta.url)).then(r=>{if(!r.ok)throw Error('Parameters unavailable');return r.json();});
const recipe=await fetch(new URL('../../../../looks/sage-lavender-chin.json',import.meta.url)).then(r=>{if(!r.ok)throw Error('Recipe unavailable');return r.json();});
let avatar,proposal,frame,disposed=false;
try{
 avatar=await Avatar.create({canvas:document.querySelector('#stage'),...recipe,autoStart:false});await avatar.step(0);
 const head=avatar.figure.bone('head');if(!head||!avatar.hairRoot)throw Error('Named head/original groom unavailable');
 avatar.figure.root.updateMatrixWorld(true);const rootWorld=avatar.figure.root.matrixWorld.clone(),headWorld=head.matrixWorld.clone();
 if(!rootWorld.elements.every(Number.isFinite)||!headWorld.elements.every(Number.isFinite)||Math.abs(rootWorld.determinant())<1e-10||Math.abs(headWorld.determinant())<1e-10)throw Error('Attachment transform unavailable');
 const sourceToHead=headWorld.clone().invert().multiply(rootWorld);proposal=buildProposal(parameters,T);
 for(const mesh of proposal.group.children)mesh.geometry.applyMatrix4(sourceToHead);head.add(proposal.group);proposal.group.visible=false;
 const attachment={head:head.name,figureRootWorld:rootWorld.toArray(),constructionHeadWorld:headWorld.toArray(),sourceToHead:sourceToHead.toArray(),role:'Construction-pose figure-root points to rigid head-local; no rest-bind/export-helper or moving fit qualification'};
 const setView=id=>{avatar.stage.camera.fov=26;avatar.stage.camera.position.set(...(id==='front'?[0,1.55,.88]:[.4235,1.55,.7665]));avatar.stage.camera.lookAt(0,1.55,.033);avatar.stage.camera.updateProjectionMatrix();view=id;};let view='front',arm='original';setView('front');
 const setArm=id=>{arm=id;avatar.hairRoot.visible=id==='original';proposal.group.visible=id==='proposal';document.querySelector('#status').textContent=id==='original'?'Original accepted hair':'Rigid modelling proposal — no strand/fit/motion pass';};
 for(const id of ['original','proposal'])document.querySelector('#'+id).onclick=()=>setArm(id);
 for(const id of ['front','oblique'])document.querySelector('#'+id).onclick=()=>setView(id);
 window.blockout={avatar,recipe,parameters,attachment,records:proposal.records,state:()=>({arm,view,originalVisible:avatar.hairRoot.visible,proposalVisible:proposal.group.visible,camera:{position:avatar.stage.camera.position.toArray(),quaternion:avatar.stage.camera.quaternion.toArray(),fov:avatar.stage.camera.fov},headWorld:head.matrixWorld.toArray(),recipe,attachment,records:proposal.records,backend:avatar.stage.backendName,webGPU:avatar.stage.renderer.backend.isWebGPUBackend}),dispose:()=>{if(disposed)return;disposed=true;cancelAnimationFrame(frame);proposal.dispose();avatar.dispose();return avatar.report().disposal;}};
 setArm('original');const draw=()=>{if(disposed)return;avatar.stage.draw();frame=requestAnimationFrame(draw);};draw();
}catch(e){document.querySelector('#error').textContent=e.stack??e.message;window.blockoutFailure=e.message;proposal?.dispose();avatar?.dispose();}
addEventListener('pagehide',()=>window.blockout?.dispose(),{once:true});
