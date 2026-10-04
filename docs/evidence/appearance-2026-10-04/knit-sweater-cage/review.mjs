import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const canvas=document.querySelector('#canvas'),status=document.querySelector('#state');
const buttons=[...document.querySelectorAll('button[data-view]')],wireButton=document.querySelector('#wire');
const sourceBody='/assets/wardrobe/body/g050.glb',expectedBody='fc4445c95ed3f423734ff272ee78ebb44d762a8f16edb94b26039de7a8a96b3a';
const scenes=[],objects=[],resources=new Set();let renderer,geometry,wireMaterial,current='front',ready=false,closed=false;
const sourceLimit='Unrigged artist blockout; no fit/coverage or AAA qualification.';
const assert=(value,message)=>{if(!value)throw new Error(message);};
function release(){if(closed)return;closed=true;for(const r of resources)r.dispose?.();renderer?.dispose();}
window.addEventListener('pagehide',release,{once:true});
const camera=new THREE.OrthographicCamera(-1,1,.475,-.475,.01,10);
function render(){
  if(!ready||closed)return;
  const box=canvas.getBoundingClientRect(),width=Math.round(box.width),height=Math.round(box.height),half=Math.floor(width/2);
  renderer.setSize(width,height,false);renderer.setScissorTest(true);
  camera.left=-.475*(half/height);camera.right=.475*(half/height);camera.updateProjectionMatrix();
  const target=new THREE.Vector3(0,1.115,.025),views={front:[0,0,3],side:[3,0,0],rear:[0,0,-3],quarter:[2.2,.2,2.2]};
  camera.position.copy(target).add(new THREE.Vector3(...views[current]));camera.lookAt(target);camera.updateMatrixWorld();
  for(let i=0;i<2;i++){renderer.setViewport(i*half,0,half,height);renderer.setScissor(i*half,0,half,height);renderer.render(scenes[i],camera);}
}
try{
  const response=await fetch(sourceBody);assert(response.ok,'Body fetch failed');const bytes=await response.arrayBuffer();
  const digest=[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(x=>x.toString(16).padStart(2,'0')).join('');assert(digest===expectedBody,'Body source hash changed');
  const meshResponse=await fetch('./sweater.json');assert(meshResponse.ok,'New source mesh missing');const model=await meshResponse.json();
  assert(model.positions.flat().every(Number.isFinite)&&Object.keys(model.boundaries).length===4,'Invalid isolated model');
  const gltf=await new GLTFLoader().parseAsync(bytes,'/assets/wardrobe/body/');gltf.scene.updateMatrixWorld(true);
  const context=[];
  gltf.scene.traverse(o=>{
    if(!o.isMesh)return;
    const association=gltf.parser.associations.get(o),primitive=gltf.parser.json.meshes[association.meshes].primitives[association.primitives];
    assert(o.geometry.index?.count===gltf.parser.json.accessors[primitive.indices].count,'Context indices changed');
    assert(Object.values(o.morphTargetDictionary??{}).every(i=>o.morphTargetInfluences[i]===0),'Nonzero context morph');
    context.push({name:o.name,mesh:association.meshes,primitive:association.primitives,vertices:o.geometry.attributes.position.count,indices:o.geometry.index.count});
    resources.add(o.geometry);for(const m of Array.isArray(o.material)?o.material:[o.material]){resources.add(m);for(const value of Object.values(m))if(value?.isTexture)resources.add(value);}
    o.material=new THREE.MeshStandardMaterial({color:0x777b7f,roughness:.9,metalness:0});resources.add(o.material);
  });
  assert(context.length>0,'No full context meshes');
  geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(model.positions.flat(),3));
  geometry.setAttribute('normal',new THREE.Float32BufferAttribute(model.normals.flat(),3));geometry.setIndex(model.triangles.flat());resources.add(geometry);
  for(let i=0;i<model.triangles.length;i++)geometry.addGroup(i*3,3,model.zones[Math.floor(i/2)]==='rib'?1:0);
  const materials=[new THREE.MeshStandardMaterial({color:0x9bb7ce,roughness:.94,metalness:0,side:THREE.FrontSide}),new THREE.MeshStandardMaterial({color:0x779ab8,roughness:.96,metalness:0,side:THREE.FrontSide})];for(const m of materials)resources.add(m);
  wireMaterial=new THREE.MeshBasicMaterial({color:0x234352,wireframe:true,transparent:true,opacity:.26,depthWrite:false});resources.add(wireMaterial);
  for(let i=0;i<2;i++){
    const scene=new THREE.Scene();scene.background=new THREE.Color(0xe8e8e4);scene.add(new THREE.HemisphereLight(0xffffff,0x747781,2));
    const key=new THREE.DirectionalLight(0xffffff,2.6);key.position.set(-2,3,4);scene.add(key);const fill=new THREE.DirectionalLight(0xffffff,1);fill.position.set(2,2,-3);scene.add(fill);
    scene.add(new THREE.Mesh(geometry,materials));const wire=new THREE.Mesh(geometry,wireMaterial);wire.visible=false;scene.add(wire);objects.push(wire);scenes.push(scene);
  }
  scenes[0].add(gltf.scene);
  renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:false});renderer.setPixelRatio(1);renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1;
  for(const b of buttons)b.addEventListener('click',()=>{current=b.dataset.view;for(const x of buttons)x.setAttribute('aria-pressed',String(x===b));status.textContent=`Ready · ${current} · full body context / garment alone · ${sourceLimit}`;render();});
  wireButton.addEventListener('click',()=>{const visible=wireButton.getAttribute('aria-pressed')!=='true';wireButton.setAttribute('aria-pressed',String(visible));for(const o of objects)o.visible=visible;render();});
  window.addEventListener('resize',render);ready=true;for(const b of [...buttons,wireButton])b.disabled=false;
  status.textContent=`Ready · front · full body context / garment alone · ${sourceLimit}`;
  window.sweaterCageObservation={bodySha256:digest,context,vertexCount:model.positions.length,triangles:model.triangles.length,limits:model.limits};
  render();
}catch(e){status.textContent='Stopped: '+e.message;console.error(e);release();}
