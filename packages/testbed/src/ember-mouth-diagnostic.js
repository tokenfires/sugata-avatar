import {WebGPURenderer,Scene,Color,Group,PerspectiveCamera,MeshBasicMaterial,NoToneMapping} from 'three/webgpu';
import {GLTFLoader}from'three/addons/loaders/GLTFLoader.js';
const root='/@fs/Users/robault/GitHub/sugata-avatar/', $=id=>document.getElementById(id);
const fit=await(await fetch(root+'docs/evidence/ember-2026-10-31-measured-fit/candidate-correction-v001.json')).json();
const renderer=new WebGPURenderer({canvas:$('mouth'),antialias:true});renderer.setSize(512,512,false);renderer.setPixelRatio(1);renderer.toneMapping=NoToneMapping;
const scene=new Scene();scene.background=new Color('#202521');const group=new Group();scene.add(group);
const camera=new PerspectiveCamera(28,1,.01,10);let view='front',draws=0;
await renderer.init();const g=await new GLTFLoader().loadAsync(root+'docs/evidence/ember-2026-10-31-eye-bridge/candidate.glb');group.add(g.scene);g.scene.position.fromArray(fit.center).negate();
const meshes=[];g.scene.traverse(m=>{if(!m.isMesh)return;meshes.push(m);m.frustumCulled=false;m.material=new MeshBasicMaterial({color:m.name==='Humanteeth_base'?'#00ffff':m.name==='Humantongue01'?'#ff00ff':'#888888'});if(m.morphTargetInfluences){m.morphTargetInfluences.fill(0);const i=m.morphTargetDictionary.jawOpen;if(i!==undefined)m.morphTargetInfluences[i]=.45;}});
if(!meshes.some(m=>m.name==='Humanteeth_base')||!meshes.some(m=>m.name==='Humantongue01'))throw Error('Missing named mouth part');
async function render(){const c=fit.views[view].camera;group.rotation.set(c[1],c[0],c[2],'ZYX');group.position.set(c[4],c[5],0);camera.position.set(0,0,Math.exp(c[3]));camera.lookAt(0,0,0);camera.setViewOffset(512,512,view==='front'?190:200,view==='front'?270:220,160,160);camera.updateMatrixWorld(true);scene.updateMatrixWorld(true);for(const m of meshes)if(m.isSkinnedMesh)m.skeleton.update();await renderer.renderAsync(scene,camera);$('status').textContent=`${view} · jawOpen 0.45 · frame ${++draws}`;$('report').value=JSON.stringify({view,camera:c,crop:camera.view,expression:{jawOpen:.45},colours:{Humanteeth_base:'cyan',Humantongue01:'magenta',other:'grey'},geometry:'candidate.glb bcb87a95d76ad252d2681c614c8d9f34d2f51a87a10077298323066fc9ebcdef'},null,2);}
for(const b of document.querySelectorAll('[data-view]'))b.onclick=()=>{view=b.dataset.view;void render();};await render();
