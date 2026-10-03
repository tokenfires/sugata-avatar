import * as THREE from 'three/webgpu';
import {Fn,storage,instanceIndex,vertexIndex,vec4} from 'three/tsl';

const data=await (await fetch(new URLSearchParams(location.search).get('data'))).json();
const count=data.vertexCount;
const renderer=new THREE.WebGPURenderer({antialias:true});
renderer.setPixelRatio(1);renderer.setSize(innerWidth,innerHeight);renderer.setClearColor(0x24282d);
renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1;
document.body.append(renderer.domElement);await renderer.init();
if(!renderer.backend.isWebGPUBackend)throw Error('Actual WebGPU backend required');
const device=renderer.backend.device;
const errors=[];device.addEventListener('uncapturederror',e=>errors.push(e.error.message));
const info=renderer.backend.adapter?.info??device.adapterInfo;
const adapter={vendor:info?.vendor,architecture:info?.architecture,device:info?.device,description:info?.description};
if(/swiftshader|llvmpipe|software/i.test(JSON.stringify(adapter)))throw Error('Hardware adapter required');

const positionAttr=new THREE.StorageBufferAttribute(new Float32Array(count*4),4);
const jointAttr=new THREE.StorageBufferAttribute(new Uint32Array(count*8),4);
const weightAttr=new THREE.StorageBufferAttribute(new Float32Array(count*8),4);
const matrixAttr=new THREE.StorageBufferAttribute(new Float32Array(53*16),16);
const outputAttr=new THREE.StorageBufferAttribute(new Float32Array(count*4),4);
const positions=storage(positionAttr,'vec4',count).toReadOnly();
const joints=storage(jointAttr,'uvec4',count*2).toReadOnly();
const weights=storage(weightAttr,'vec4',count*2).toReadOnly();
const matrices=storage(matrixAttr,'mat4',53).toReadOnly();
const output=storage(outputAttr,'vec4',count);
const kernel=Fn(()=>{
 const p=positions.element(instanceIndex),sum=vec4(0).toVar();
 for(let group=0;group<2;group++){
  const idx=instanceIndex.mul(2).add(group),j=joints.element(idx),w=weights.element(idx);
  for(const component of ['x','y','z','w'])sum.addAssign(matrices.element(j[component]).mul(p).mul(w[component]));
 }
 output.element(instanceIndex).assign(vec4(sum.xyz,1));
})().compute(count).setName('isolated eight-influence skin');

const scene=new THREE.Scene();scene.add(new THREE.HemisphereLight(0xffffff,0x4c5060,2));
const key=new THREE.DirectionalLight(0xffffff,3);key.position.set(-3,4,4);scene.add(key);
const fill=new THREE.DirectionalLight(0xd3e1ff,1);fill.position.set(3,1,-2);scene.add(fill);
const geometry=new THREE.BufferGeometry();geometry.setIndex(data.indices);
const nativeMaterial=new THREE.MeshStandardNodeMaterial({color:0xb9b9b9,roughness:.7,metalness:0});
const gpuMaterial=nativeMaterial.clone();gpuMaterial.positionNode=storage(outputAttr,'vec4',count).toReadOnly().element(vertexIndex).xyz;
const mesh=new THREE.Mesh(geometry,nativeMaterial);scene.add(mesh);
const camera=new THREE.OrthographicCamera(-1,1,1,-1,.01,20);
let current,result,disposed=false;

window.runCase=async index=>{
 if(disposed)throw Error('Disposed probe');current=data.cases[index];if(!current)throw Error('Unknown case');
 for(let i=0;i<count;i++){positionAttr.array.set([...current.positions[i],1],i*4);}
 jointAttr.array.set(current.joints8??data.joints8);weightAttr.array.set(current.weights8??data.weights8);matrixAttr.array.set(current.matrices);
 for(const a of [positionAttr,jointAttr,weightAttr,matrixAttr])a.needsUpdate=true;
 device.pushErrorScope('validation');await renderer.computeAsync(kernel);await device.queue.onSubmittedWorkDone();
 const validation=await device.popErrorScope();if(validation)throw Error(validation.message);
 const raw=new Float32Array(await renderer.getArrayBufferAsync(outputAttr));
 if(outputAttr.itemSize!==4||raw.length!==count*4)throw Error('Output stride mismatch');
 result=Array.from({length:count},(_,i)=>Array.from(raw.slice(i*4,i*4+3))).flat();
 if(!result.every(Number.isFinite)||errors.length)throw Error('Invalid GPU observation: '+errors.join('; '));
 return {index,name:current.name,positions:result,backend:'webgpu',adapter,three:THREE.REVISION,outputStride:outputAttr.itemSize,errors:[...errors]};
};
window.drawCase=async({arm,close})=>{
 if(!current||!result)throw Error('Run a case first');
 const points=arm==='native'?current.expected:result;
 geometry.setAttribute('position',new THREE.Float32BufferAttribute(points,3));geometry.computeVertexNormals();geometry.computeBoundingSphere();
 mesh.material=arm==='native'?nativeMaterial:gpuMaterial;
 const target=new THREE.Vector3(...(close?current.expected.slice(4561*3,4561*3+3):[0,.94,0]));
 const span=close?.18:1.95,aspect=innerWidth/innerHeight;
 camera.left=-span*aspect/2;camera.right=span*aspect/2;camera.top=span/2;camera.bottom=-span/2;
 camera.position.copy(close?target.clone().add(new THREE.Vector3(-.8,.15,1)):new THREE.Vector3(-2.4,1.5,4));camera.up.set(0,1,0);camera.lookAt(target);camera.updateProjectionMatrix();
 const label=`${arm==='native'?'Native full reference':'Eight-influence GPU candidate'} · body target ${current.weight} · ${current.pose}\n${close?'Waist detail · 180 mm vertical span':'Body context'}\nActual positions · shared geometric normal method · no displacement amplification`;
 document.querySelector('#label').textContent=label;
 await renderer.renderAsync(scene,camera);await device.queue.onSubmittedWorkDone();
 if(errors.length)throw Error(errors.join('; '));
 return {arm,close,label,camera:camera.toJSON(),target:target.toArray(),lights:[{type:'hemisphere',intensity:2},{type:'directional',position:key.position.toArray(),intensity:3},{type:'directional',position:fill.position.toArray(),intensity:1}],positionNode:arm==='gpu'?'actual-output-storage':'geometry-attribute',normals:'recomputed-from-each-observed-surface',triangles:geometry.index.count/3};
};
window.disposeProbe=async()=>{
 if(disposed)return {disposed};disposed=true;await device.queue.onSubmittedWorkDone();scene.remove(mesh);geometry.dispose();nativeMaterial.dispose();gpuMaterial.dispose();kernel.dispose();
 for(const a of [positionAttr,jointAttr,weightAttr,matrixAttr,outputAttr])renderer._attributes.delete(a);
 renderer.dispose();return {disposed,privateStorageAttributesReleased:5,errors:[...errors]};
};
window.captureReady=true;
