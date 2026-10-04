import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const inputs = [
  {key:'body',path:'assets/wardrobe/body/g050.glb',bytes:11916776,sha256:'fc4445c95ed3f423734ff272ee78ebb44d762a8f16edb94b26039de7a8a96b3a',color:0xc6a48b},
  {key:'bra',path:'assets/wardrobe/foundation_bra/g050.glb',bytes:921176,sha256:'4a3366377087bbfb2d5779ba4d6f5de09735e1810ae4ea9b6a22e11d3aee0d79',color:0x368f98},
  {key:'briefs',path:'assets/wardrobe/foundation_briefs/g050.glb',bytes:529028,sha256:'53f81630df24817f89bd7f8b59d58977b180855adc54d7f439f54a23f2757747',color:0x8767aa}
];
const record = {started:new Date().toISOString(),threeRevision:THREE.REVISION,inputs,sources:[],comparisons:[],draws:[],disposals:[],status:'loading',limits:'Source reference only; CPU bounds frame views. No garment or posed/runtime qualification.'};
const status = document.querySelector('#status'), output = document.querySelector('#observed-record'), download = document.querySelector('#download');
const resources = new Set(), disposed = new Set(), roots = [], meshes = [], scene = new THREE.Scene();
let renderer, cameras, width, height, blobURL, finished = false;
const finite = a => a.every(Number.isFinite);
function publish(){
  const text=JSON.stringify(record,null,2); output.textContent=text;
  if(blobURL) URL.revokeObjectURL(blobURL);
  blobURL=URL.createObjectURL(new Blob([text],{type:'application/json'})); download.href=blobURL;
}
function register(resource){if(resource?.dispose) resources.add(resource);}
function collect(root){root.traverse(o=>{
  register(o.geometry); register(o.skeleton);
  for(const m of Array.isArray(o.material)?o.material:[o.material]) if(m){register(m);for(const v of Object.values(m)) if(v?.isTexture) register(v);}
});}
function cleanup(reason){
  finished=true; record.cleanupReason=reason;
  for(const resource of resources) if(!disposed.has(resource)){
    disposed.add(resource); const row={type:resource.type||resource.constructor.name,uuid:resource.uuid||null,attempted:true};
    try{resource.dispose();row.returned=true;}catch(e){row.error=String(e);}record.disposals.push(row);
  }
  if(renderer && !disposed.has(renderer)){disposed.add(renderer);const row={type:'WebGLRenderer',attempted:true};try{renderer.dispose();row.returned=true;}catch(e){row.error=String(e);}record.disposals.push(row);}
  document.querySelectorAll('[data-mode]').forEach(b=>b.disabled=true);publish();
}
document.querySelector('#finish').addEventListener('click',()=>{record.finished=new Date().toISOString();cleanup('explicit Finish reference');status.textContent='Reference finished; observations preserved';});
window.addEventListener('pagehide',()=>cleanup('pagehide'));
function fail(error){record.status='refused';record.error=String(error);record.refused=new Date().toISOString();status.textContent='Source reference refused';cleanup('refusal');}
function snapshot(gltf,key){
  const source={key,rawDocument:gltf.parser.json,nodes:[],meshes:[]};record.sources.push(source);
  gltf.scene.updateMatrixWorld(true);
  gltf.scene.traverse(o=>{
    const association=gltf.parser.associations.get(o)||{};
    const node={name:o.name,type:o.type,uuid:o.uuid,association,position:o.position.toArray(),quaternion:o.quaternion.toArray(),scale:o.scale.toArray(),matrix:o.matrix.toArray(),world:o.matrixWorld.toArray()};
    if(!finite([...node.position,...node.quaternion,...node.scale,...node.matrix,...node.world])) throw Error('Nonfinite node '+key+':'+o.name);
    source.nodes.push(node);
    if(o.isMesh){
      const item={name:o.name,uuid:o.uuid,association,skinned:!!o.isSkinnedMesh,vertexCount:o.geometry.attributes.position?.count,originalMorphInfluences:o.morphTargetInfluences?.slice()||[],zeroMorphInfluences:[],bind:o.bindMatrix?.toArray()||null,bindInverse:o.bindMatrixInverse?.toArray()||null,bones:[]};
      if(o.morphTargetInfluences) o.morphTargetInfluences.fill(0);
      item.zeroMorphInfluences=o.morphTargetInfluences?.slice()||[];
      if(!finite([...item.originalMorphInfluences,...item.zeroMorphInfluences,...(item.bind||[]),...(item.bindInverse||[])])) throw Error('Nonfinite mesh '+key+':'+o.name);
      if(o.isSkinnedMesh){
        o.skeleton.update();
        item.bones=o.skeleton.bones.map((bone,i)=>({name:bone.name,uuid:bone.uuid,association:gltf.parser.associations.get(bone)||{},world:bone.matrixWorld.toArray(),inverseBind:o.skeleton.boneInverses[i]?.toArray()||null}));
        for(const b of item.bones) if(!b.name || !b.inverseBind || !finite([...b.world,...b.inverseBind])) throw Error('Missing/nonfinite bone '+key+':'+b.name);
      }
      source.meshes.push(item);meshes.push({key,object:o,record:item});o.frustumCulled=false;
    }
  });return source;
}
function delta(a,b){return {translation:Math.hypot(a[12]-b[12],a[13]-b[13],a[14]-b[14]),linear:Math.max(...[0,1,2,4,5,6,8,9,10].map(i=>Math.abs(a[i]-b[i])))};}
function compare(){
  record.skinnedOwners=Object.fromEntries(inputs.map(input=>[input.key,meshes.filter(m=>m.key===input.key && m.object.isSkinnedMesh).map(m=>({uuid:m.record.uuid,name:m.record.name,association:m.record.association}))]));
  record.missingSourceOwners=inputs.filter(input=>!record.skinnedOwners[input.key].length).map(input=>input.key);
  publish();
  if(record.missingSourceOwners.length) throw Error('Missing skinned source authority: '+record.missingSourceOwners.join(', '));
  const eligible=meshes.filter(m=>m.key==='body' && m.object.isSkinnedMesh && m.record.originalMorphInfluences.length);
  record.bodyEligible=eligible.map(m=>({uuid:m.record.uuid,name:m.record.name,association:m.record.association}));
  if(!eligible.length) throw Error('No morphed body SkinnedMesh reference');
  const reference=eligible[0].record;record.referenceUUID=reference.uuid;
  const referenceMap=new Map(reference.bones.map(b=>[b.name,b]));
  if(referenceMap.size!==reference.bones.length) throw Error('Duplicate body reference names');
  record.literalJoints=['neck_01','pelvis','hand_r','hand_l'].map(name=>{const b=referenceMap.get(name);if(!b)throw Error('Missing literal joint '+name);return {name,world:b.world,origin:b.world.slice(12,15),inverseBind:b.inverseBind};});
  let mismatch=false;
  for(const m of meshes.filter(m=>m.object.isSkinnedMesh)){
    const map=new Map(m.record.bones.map(b=>[b.name,b])), missing=[...referenceMap.keys()].filter(n=>!map.has(n)), extra=[...map.keys()].filter(n=>!referenceMap.has(n));
    const row={key:m.key,meshUUID:m.record.uuid,missing,extra,unique:map.size===m.record.bones.length,bones:[]};
    for(const [name,b] of map) if(referenceMap.has(name)){
      const r=referenceMap.get(name),world=delta(b.world,r.world),inverseBind=delta(b.inverseBind,r.inverseBind);
      const pass=world.translation<=.001 && inverseBind.translation<=.001 && world.linear<=1e-6 && inverseBind.linear<=1e-6;
      row.bones.push({name,world,inverseBind,pass});if(!pass)mismatch=true;
    }
    row.pass=row.unique&&!missing.length&&!extra.length&&row.bones.every(b=>b.pass);if(!row.pass)mismatch=true;record.comparisons.push(row);
  }
  publish();if(mismatch) throw Error('Named source skeleton-world/inverse-bind gate mismatch');
}
function configure(){
  const bounds=new THREE.Box3(),point=new THREE.Vector3();let count=0;
  for(const m of meshes){for(let i=0;i<m.object.geometry.attributes.position.count;i++){m.object.getVertexPosition(i,point).applyMatrix4(m.object.matrixWorld);if(!finite(point.toArray()))throw Error('Nonfinite framing surface');bounds.expandByPoint(point);count++;}}
  const size=bounds.getSize(new THREE.Vector3()),center=bounds.getCenter(new THREE.Vector3());
  if(!count||!finite([...size.toArray(),...center.toArray()])||size.y<=0) throw Error('Missing source framing bounds');
  const canvas=document.querySelector('#view');width=Math.floor(canvas.getBoundingClientRect().width);height=620;if(width<2)throw Error('Missing viewport');
  const aspect=Math.floor(width/2)/height,half=.60*Math.max(size.y,Math.hypot(size.x,size.z)/aspect),span=Math.max(size.x,size.y,size.z),eye=3*span;
  record.framing={bounds:{min:bounds.min.toArray(),max:bounds.max.toArray()},vertexCount:count,width,height,panelAspect:aspect,half,near:.01,far:20*span,eyeDistance:eye};
  cameras=[new THREE.Vector3(0,0,1),new THREE.Vector3(1,0,1).normalize()].map(direction=>{const c=new THREE.OrthographicCamera(-half*aspect,half*aspect,half,-half,.01,20*span);c.position.copy(center).addScaledVector(direction,eye);c.lookAt(center);c.updateMatrixWorld(true);return c;});
  record.cameras=cameras.map(c=>({position:c.position.toArray(),quaternion:c.quaternion.toArray(),matrixWorld:c.matrixWorld.toArray(),projection:c.projectionMatrix.toArray(),target:center.toArray()}));
  scene.background=new THREE.Color(0x171d25);scene.add(new THREE.HemisphereLight(0xeaf3ff,0x635044,2.2));const light=new THREE.DirectionalLight(0xffffff,2.3);light.position.set(2,4,5);scene.add(light);
  for(const input of inputs){const material=new THREE.MeshStandardMaterial({color:input.color,side:THREE.DoubleSide,roughness:1,metalness:0});register(material);for(const m of meshes.filter(m=>m.key===input.key))m.object.material=material;}
  renderer=new THREE.WebGLRenderer({canvas,antialias:true,preserveDrawingBuffer:true});renderer.setPixelRatio(1);renderer.setSize(width,height,false);renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;
}
function draw(mode){
  if(finished||!renderer) return;
  roots.forEach(({key,root})=>root.visible=mode==='Composite'||(mode==='Body'?key==='body':key!=='body'));
  const left=Math.floor(width/2);renderer.setScissorTest(true);
  cameras.forEach((camera,i)=>{const x=i?left:0,w=i?width-left:left;renderer.setViewport(x,0,w,height);renderer.setScissor(x,0,w,height);renderer.render(scene,camera);});
  record.draws.push({utc:new Date().toISOString(),mode,rendererInfo:{calls:renderer.info.render.calls,triangles:renderer.info.render.triangles},rootVisibility:roots.map(({key,root})=>({key,visible:root.visible}))});record.status='ready';publish();status.textContent='Ready — '+mode;
}
async function main(){
  const loader=new GLTFLoader();
  for(const input of inputs){
    if(finished) throw Error('Ended before fetch');const response=await fetch('/'+input.path);record.inputs.find(v=>v.key===input.key).httpStatus=response.status;if(!response.ok)throw Error('Fetch failed '+input.key);
    const bytes=await response.arrayBuffer(),hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),b=>b.toString(16).padStart(2,'0')).join('');
    input.observedBytes=bytes.byteLength;input.observedSHA256=hash;publish();if(bytes.byteLength!==input.bytes||hash!==input.sha256)throw Error('Input pin mismatch '+input.key);
    if(finished)throw Error('Ended before parse');input.parseStarted=new Date().toISOString();const gltf=await loader.parseAsync(bytes,'/');input.parseCompleted=new Date().toISOString();collect(gltf.scene);if(finished){cleanup('late parse');throw Error('Ended during parse');}
    snapshot(gltf,input.key);roots.push({key:input.key,root:gltf.scene});scene.add(gltf.scene);scene.updateMatrixWorld(true);publish();
  }
  compare();configure();publish();draw('Body');document.querySelectorAll('[data-mode]').forEach(b=>{b.disabled=false;b.addEventListener('click',()=>{try{draw(b.dataset.mode);}catch(e){fail(e);}});});
}
publish();main().catch(fail);
