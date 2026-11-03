import { WebGPURenderer, Scene, Color, PerspectiveCamera, HemisphereLight, DirectionalLight,
  Group, Vector3, MeshStandardMaterial, NoToneMapping } from 'three/webgpu';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { Skeleton } from '../../core/src/figure/Skeleton.js';
const root='/@fs/Users/robault/GitHub/sugata-avatar/';
const $=id=>document.getElementById(id);
const fit=await(await fetch(root+'docs/evidence/ember-2026-10-31-measured-fit/candidate-correction-v001.json')).json();
const renderer=new WebGPURenderer({canvas:$('portrait'),antialias:true});renderer.setPixelRatio(1);renderer.setSize(512,512,false);renderer.toneMapping=NoToneMapping;
const scene=new Scene();scene.background=new Color('#bdc5b8');scene.add(new HemisphereLight('#ffffff','#7b8274',2));
const key=new DirectionalLight('#ffffff',2.2);key.position.set(-3,5,6);scene.add(key);
const camera=new PerspectiveCamera(28,1,.01,10),poseRoot=new Group();scene.add(poseRoot);
const clay=new MeshStandardMaterial({color:'#b4a799',roughness:.75}),meshes=[];
let rig,body,stock,view='front',frame='reference',draws=0,playing=false,stockOn=false,busy=false,pending=false;
let weights={},headYaw=0,lastSequence=null;
function setFrame(name){
 frame=name;weights={};headYaw=0;
 if(name==='reference')weights={mouthSmileLeft:fit.views[view].smile,mouthSmileRight:fit.views[view].smile};
 if(name==='half-blink'||name==='blink')weights={eyeBlinkLeft:name==='blink'?1:.5,eyeBlinkRight:name==='blink'?1:.5};
 if(name==='gaze-left')weights={eyeLookOutLeft:.6,eyeLookInRight:.6};
 if(name==='gaze-right')weights={eyeLookInLeft:.6,eyeLookOutRight:.6};
 if(name==='jaw')weights={jawOpen:.45};
 if(name==='smile')weights={mouthSmileLeft:.65,mouthSmileRight:.65,cheekSquintLeft:.12,cheekSquintRight:.12};
 if(name==='head')headYaw=.24;
}
async function render(){
 if(!body)return;if(busy){pending=true;return;}busy=true;
 try{
  const c=fit.views[view].camera;poseRoot.rotation.set(c[1],c[0],c[2],'ZYX');poseRoot.position.set(c[4],c[5],0);
  camera.position.set(0,0,Math.exp(c[3]));camera.lookAt(0,0,0);camera.updateMatrixWorld(true);
  body.material=stockOn?stock:clay;rig.reset();rig.rotationOf('neck').setFromAxisAngle(new Vector3(0,1,0),headYaw*.35);rig.rotationOf('head').setFromAxisAngle(new Vector3(0,1,0),headYaw*.65);rig.update();
  for(const m of meshes){if(!m.morphTargetInfluences)continue;m.morphTargetInfluences.fill(0);for(const [name,value]of Object.entries(weights)){const index=m.morphTargetDictionary[name];if(index!==undefined)m.morphTargetInfluences[index]=value;}}
  scene.updateMatrixWorld(true);for(const m of meshes)if(m.isSkinnedMesh)m.skeleton.update();
  await renderer.renderAsync(scene,camera);draws++;
  $('status').textContent=`${view} · ${frame} · fitted independent parts · ${stockOn?'stock skin':'clay skin'} · frame ${draws} · UNACCEPTED component test`;
  $('report').value=JSON.stringify({view,frame,draws,weights,headYaw,playing,lastSequence,components:meshes.map(m=>({name:m.name,vertices:m.geometry.attributes.position.count,skinned:!!m.isSkinnedMesh,active:Object.entries(weights).filter(([k])=>m.morphTargetDictionary?.[k]!==undefined)}))},null,2);
  document.body.dataset.ready='true';
 }finally{busy=false;if(pending){pending=false;void render();}}
}
function reference(){$('reference').src=root+`reference/ember/portraits/face-reference-${view==='front'?2:1}.png`;$('ref-title').textContent=view==='front'?'Original portrait 2 · facial authority':'Original portrait 1 · angle and hair authority';}
for(const b of document.querySelectorAll('[data-view]'))b.onclick=()=>{playing=false;view=b.dataset.view;for(const x of document.querySelectorAll('[data-view]'))x.setAttribute('aria-pressed',String(x===b));reference();setFrame($('pose').value);void render();};
$('pose').onchange=()=>{playing=false;setFrame($('pose').value);void render();};
$('stock').onclick=()=>{stockOn=!stockOn;$('stock').setAttribute('aria-pressed',String(stockOn));void render();};
$('stop').onclick=()=>{playing=false;void render();};
$('play').onclick=async()=>{
 if(playing||!body)return;playing=true;const start=performance.now();let frames=0;
 while(playing&&frames<180){
  const t=(performance.now()-start)/1000;if(t>=6)break;
  frame='six-second sequence';headYaw=.24*Math.sin(t*Math.PI/3);
  const blink=Math.max(0,1-Math.abs(t-1.2)/.16),gaze=.5*Math.sin(t*Math.PI/2);
  weights={eyeBlinkLeft:blink,eyeBlinkRight:blink,jawOpen:.25*Math.max(0,Math.sin((t-3)*Math.PI)),mouthSmileLeft:.35,mouthSmileRight:.35,
   eyeLookOutLeft:Math.max(0,gaze),eyeLookInRight:Math.max(0,gaze),eyeLookInLeft:Math.max(0,-gaze),eyeLookOutRight:Math.max(0,-gaze)};
  await render();frames++;
  // Cap at 30 fps so the 180-frame guard does not truncate six seconds on a fast display.
  await new Promise(resolve=>setTimeout(()=>requestAnimationFrame(resolve),Math.max(0,frames*1000/30-(performance.now()-start))));
 }
 lastSequence={frames,seconds:(performance.now()-start)/1000,completed:playing};
 playing=false;setFrame($('pose').value);await render();
};
async function main(){
 await renderer.init();const gltf=await new GLTFLoader().loadAsync(root+'docs/evidence/ember-2026-10-31-eye-bridge/candidate.glb');
 poseRoot.add(gltf.scene);gltf.scene.position.fromArray(fit.center).negate();rig=new Skeleton(gltf.scene);
 gltf.scene.traverse(m=>{if(!m.isMesh)return;meshes.push(m);m.frustumCulled=false;if(m.geometry.attributes.position.count>10000){if(body)throw Error('Ambiguous body');body=m;stock=m.material;}});
 if(!body||meshes.length!==7||!rig.has('head')||!rig.has('neck'))throw Error('Incomplete integration asset');
 const required=['eyeBlinkLeft','eyeBlinkRight','eyeLookOutLeft','eyeLookInRight','jawOpen','mouthSmileLeft'];
 for(const name of required)if(body.morphTargetDictionary[name]===undefined)throw Error('Missing '+name);
 reference();setFrame(frame);await render();
}
main().catch(e=>{$('status').textContent='Component test unavailable: '+e.message;document.body.dataset.error=e.message;console.error(e);});
