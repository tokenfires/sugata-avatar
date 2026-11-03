import { WebGPURenderer, Scene, Color, PerspectiveCamera, HemisphereLight, DirectionalLight,
  Group, Vector3, Vector2, Raycaster, Triangle, MeshStandardMaterial, NoToneMapping } from 'three/webgpu';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
const root='/@fs/Users/robault/GitHub/sugata-avatar/';
const $=id=>document.getElementById(id);
const study=new URLSearchParams(location.search).get('study')??'baseline';
if(!['baseline','candidate-v001','candidate-correction-v001'].includes(study))throw Error('Unknown measured study');
const evidence=root+'docs/evidence/ember-2026-10-31-measured-fit/';
const boundaryMode=new URLSearchParams(location.search).get('annotations')==='boundaries';
const input=await (await fetch(evidence+(boundaryMode?'observations-boundaries-draft.json':study==='candidate-correction-v001'?'observations-correction-v001.json':'observations-checked-v001.json'))).json();
const anchors=input.anchors;
for(const a of anchors){const o=document.createElement('option');o.value=a.name;o.textContent=`${a.number}. ${a.name}`;$('landmark').append(o);}
const observations=input.observations;
const cameraFit=await (await fetch(evidence+(study==='baseline'?'camera-initialization.json':study+'.json'))).json();
let lastProjected={},compare=false,sourceMaterial=false,originalBodyMaterial,clayBodyMaterial;
let view='front',showMarkers=true,body,map,draws=0,selected=anchors[0],busy=false,pending=false;
const renderer=new WebGPURenderer({canvas:$('portrait'),antialias:true});renderer.setPixelRatio(1);renderer.setSize(512,512,false);renderer.toneMapping=NoToneMapping;
const scene=new Scene();scene.background=new Color('#bdc5b8');
scene.add(new HemisphereLight('#ffffff','#7b8274',2));
const key=new DirectionalLight('#ffffff',2.2);key.position.set(-3,5,6);scene.add(key);
const camera=new PerspectiveCamera(28,1,0.01,10),focus=new Vector3(0,1.48,0.07);
const modelPose=new Group();scene.add(modelPose);
const lookup=new Map(),raycaster=new Raycaster();
function cameraSetup(){const c=cameraFit.views[view].camera;
 if(body&&body.morphTargetDictionary)for(const name of ['mouthSmileLeft','mouthSmileRight'])body.morphTargetInfluences[body.morphTargetDictionary[name]]=cameraFit.views[view].smile??0;
 modelPose.rotation.set(c[1],c[0],c[2],'ZYX');modelPose.position.set(c[4],c[5],0);
 camera.position.set(0,0,Math.exp(c[3]));camera.lookAt(0,0,0);camera.updateMatrixWorld(true);}
function position(a){const p=new Vector3();a.vertices.forEach((id,i)=>{const index=lookup.get(id);if(index===undefined)throw Error(`Missing surface ID ${id}`);const q=new Vector3();body.getVertexPosition(index,q);p.addScaledVector(q,a.weights[i]);});return body.localToWorld(p);}
function dot(ctx,x,y,number,color){ctx.strokeStyle='#102119';ctx.lineWidth=3;ctx.beginPath();ctx.arc(x,y,3,0,2*Math.PI);ctx.stroke();ctx.fillStyle=color;ctx.fill();ctx.font='bold 12px system-ui';ctx.strokeText(number,x+6,y-5);ctx.fillText(number,x+6,y-5);}
function output(){
  $('observations').value=JSON.stringify({schema:1,sourceImages:{front:'reference/ember/portraits/face-reference-2.png',angle:'reference/ember/portraits/face-reference-1.png'},imageSize:[1024,1024],anchors,observations},null,2);
  const ctx=$('reference-marks').getContext('2d');ctx.clearRect(0,0,512,512);if(showMarkers)for(const a of anchors){const p=observations[view][a.name];if(p)dot(ctx,p[0]/2,p[1]/2,a.number,'#ff70d9');if(compare&&p&&lastProjected[a.name]){const q=lastProjected[a.name].pixel;ctx.strokeStyle='#61ffff';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(p[0]/2,p[1]/2);ctx.lineTo(q[0]/2,q[1]/2);ctx.stroke();dot(ctx,q[0]/2,q[1]/2,'','#61ffff');}}
}
async function render(){if(!body)return;if(busy){pending=true;return;}busy=true;
 try{body.material=sourceMaterial?originalBodyMaterial:clayBodyMaterial;cameraSetup();scene.updateMatrixWorld(true);await renderer.renderAsync(scene,camera);
 const ctx=$('model-marks').getContext('2d');ctx.clearRect(0,0,512,512);const projected={};
 for(const a of anchors){if((a.view&&a.view!==view)||!a.vertices.length)continue;const world=position(a),q=world.clone().project(camera);const pixel=[(q.x+1)*512,(1-q.y)*512];projected[a.name]={pixel,world:world.toArray()};if(showMarkers)dot(ctx,pixel[0]/2,pixel[1]/2,a.number,'#61ffff');}
 lastProjected=projected;
 $('projection').value=JSON.stringify({view,draws:++draws,camera:{position:camera.position.toArray(),fit:cameraFit.views[view].camera,center:cameraFit.center,fov:camera.fov,aspect:1},projected},null,2);
 $('status').textContent=`${view} · ${study==='baseline'?'default native geometry':study+' — UNACCEPTED'} · ${anchors.length} provisional source anchors · ${Object.keys(observations[view]).length} photo observations · ${sourceMaterial?'STOCK source skin: boundary aid only':'clay inspection'} · render ${draws}`;
 document.body.dataset.ready='true';output();
 }finally{busy=false;if(pending){pending=false;void render();}}
}
$('landmark').onchange=()=>{selected=anchors.find(a=>a.name===$('landmark').value);};
$('reference').onclick=e=>{const r=e.target.getBoundingClientRect();observations[view][selected.name]=[(e.clientX-r.left)/r.width*1024,(e.clientY-r.top)/r.height*1024];output();$('status').textContent=`Recorded ${selected.name} in ${view}. Original image unchanged.`;};
$('portrait').onclick=e=>{if(!$('pick-surface').checked||!body)return;const r=e.target.getBoundingClientRect();raycaster.setFromCamera(new Vector2((e.clientX-r.left)/r.width*2-1,1-(e.clientY-r.top)/r.height*2),camera);const hit=raycaster.intersectObject(body,false)[0];if(!hit){$('status').textContent='No visible skin hit; anchor unchanged.';return;}
 const ids=[hit.face.a,hit.face.b,hit.face.c],v=ids.map(i=>{const p=new Vector3();body.getVertexPosition(i,p);return p;}),p=body.worldToLocal(hit.point.clone());const w=Triangle.getBarycoord(p,...v,new Vector3());
 selected.vertices=ids.map(i=>map[i]);selected.weights=w.toArray();selected.status='root-surface-pick';void render();};
for(const b of document.querySelectorAll('[data-view]'))b.onclick=()=>{view=b.dataset.view;for(const x of document.querySelectorAll('[data-view]'))x.setAttribute('aria-pressed',String(x===b));setReference();void render();};
$('source-material').onclick=()=>{sourceMaterial=!sourceMaterial;$('source-material').setAttribute('aria-pressed',String(sourceMaterial));void render();};
$('compare').onclick=()=>{compare=!compare;$('compare').setAttribute('aria-pressed',String(compare));output();};
$('markers').onclick=()=>{showMarkers=!showMarkers;$('markers').setAttribute('aria-pressed',String(showMarkers));void render();};
function setReference(){$('reference').src=root+`reference/ember/portraits/face-reference-${view==='front'?2:1}.png`;$('ref-title').textContent=view==='front'?'Original portrait 2 · facial authority':'Original portrait 1 · angle and hair authority';}
async function main(){await renderer.init();const response=await fetch(root+'assets/identity/figure-vertex-map.bin');if(!response.ok)throw Error('Vertex map unavailable');map=new Uint16Array(await response.arrayBuffer());
 const gltf=await new GLTFLoader().loadAsync(root+'assets/figures/figure_g000.glb');modelPose.add(gltf.scene);gltf.scene.position.fromArray(cameraFit.center).negate();
 gltf.scene.traverse(m=>{if(!m.isMesh)return;if(m.geometry.attributes.position.count===map.length){if(body)throw Error('Ambiguous body');body=m;originalBodyMaterial=m.material;clayBodyMaterial=new MeshStandardMaterial({color:'#b4a799',roughness:.75});m.material=clayBodyMaterial;}else if(!m.name.includes('high'))m.visible=false;});
 if(!body)throw Error('Native body not found');
 if(study!=='baseline'){const response=await fetch(evidence+study+'-positions.f32');if(!response.ok)throw Error('Fitted positions unavailable');const fitted=new Float32Array(await response.arrayBuffer());if(fitted.length!==body.geometry.attributes.position.array.length)throw Error('Fitted buffer size mismatch');body.geometry.attributes.position.array.set(fitted);body.geometry.attributes.position.needsUpdate=true;body.geometry.computeVertexNormals();document.querySelector('h1+p').textContent='Measured native geometry candidate · likeness UNACCEPTED · skin, hair, eye fitting and animation qualification still pending.';}
 map.forEach((id,i)=>{if(!lookup.has(id))lookup.set(id,i);});
 setReference();await render();}
main().catch(e=>{$('status').textContent=`Study unavailable: ${e.message}`;document.body.dataset.error=e.message;console.error(e);});
