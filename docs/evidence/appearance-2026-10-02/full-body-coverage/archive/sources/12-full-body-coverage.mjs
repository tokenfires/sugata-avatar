/** Static replay of pinned observations, not an eight-influence compute run. */
import * as THREE from 'three/webgpu';
import {storage,vertexIndex} from 'three/tsl';
const response=await fetch(new URLSearchParams(location.search).get('data'));
if(!response.ok)throw Error('Replay input HTTP '+response.status);
const data=await response.json(),count=data.vertexCount;
if(innerWidth!==1200||innerHeight!==1000||count!==14517)throw Error('Declared viewport/body required');
const errors=[],renderer=new THREE.WebGPURenderer({antialias:true});
renderer.setPixelRatio(1);renderer.setSize(innerWidth,innerHeight);renderer.setClearColor(0x24282d);
renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1;
document.body.append(renderer.domElement);
let device,outputAttr,geometry,nativeMaterial,gpuMaterial,mesh,disposed=false;
window.disposeProbe=async()=>{
 if(disposed)return{disposed,errors:[...errors]};
 await device?.queue.onSubmittedWorkDone();mesh?.removeFromParent();geometry?.dispose();nativeMaterial?.dispose();gpuMaterial?.dispose();
 if(outputAttr)renderer._attributes.delete(outputAttr);renderer.dispose();disposed=true;
 return{disposed,privateStorageAttributesReleased:outputAttr?1:0,errors:[...errors]};
};
await renderer.init();device=renderer.backend.device;
device.addEventListener('uncapturederror',e=>errors.push(e.error.message));
if(!renderer.backend.isWebGPUBackend)throw Error('Actual WebGPU required');
const info=renderer.backend.adapter?.info??device.adapterInfo;
const adapter={vendor:info?.vendor??null,architecture:info?.architecture??null,device:info?.device??null,description:info?.description??null};
if(/swiftshader|llvmpipe|software/i.test(JSON.stringify(adapter)))throw Error('Hardware adapter required');
const raw=new Float32Array(count*4);
for(let i=0;i<count;i++)raw.set([...data.gpu.slice(i*3,i*3+3),1],i*4);
outputAttr=new THREE.StorageBufferAttribute(raw,4);
const scene=new THREE.Scene();scene.add(new THREE.HemisphereLight(0xffffff,0x4c5060,2));
const key=new THREE.DirectionalLight(0xffffff,3);key.position.set(-3,4,4);scene.add(key);
const fill=new THREE.DirectionalLight(0xd3e1ff,1);fill.position.set(3,1,-2);scene.add(fill);
geometry=new THREE.BufferGeometry();geometry.setIndex(data.indices);geometry.setAttribute('position',new THREE.Float32BufferAttribute(data.native,3));
nativeMaterial=new THREE.MeshStandardNodeMaterial({color:0xb9b9b9,roughness:.7,metalness:0});
gpuMaterial=nativeMaterial.clone();gpuMaterial.positionNode=storage(outputAttr,'vec4',count).toReadOnly().element(vertexIndex).xyz;
mesh=new THREE.Mesh(geometry,nativeMaterial);scene.add(mesh);
const c=data.camera,camera=new THREE.OrthographicCamera(-c.halfSpan*c.aspect,c.halfSpan*c.aspect,c.halfSpan,-c.halfSpan,.01,20);
camera.position.fromArray(c.position);camera.up.set(0,1,0);camera.lookAt(new THREE.Vector3(...c.target));
camera.coordinateSystem=renderer.coordinateSystem;camera.updateProjectionMatrix();camera.updateMatrixWorld(true);
const common={camera:camera.toJSON(),viewMatrix:camera.matrixWorldInverse.toArray(),projectionMatrix:camera.projectionMatrix.toArray(),target:c.target,
 viewport:[1200,1000],pixelRatio:renderer.getPixelRatio(),backend:'webgpu',adapter,three:THREE.REVISION,coordinateSystem:camera.coordinateSystem,reversedDepth:camera.reversedDepth,
 lights:[{type:'hemisphere',sky:0xffffff,ground:0x4c5060,intensity:2},{type:'directional',color:0xffffff,position:key.position.toArray(),intensity:3},{type:'directional',color:0xd3e1ff,position:fill.position.toArray(),intensity:1}],
 material:{color:0xb9b9b9,roughness:.7,metalness:0},colorSpace:renderer.outputColorSpace,toneMapping:renderer.toneMapping,exposure:renderer.toneMappingExposure,clearColor:0x24282d,
 normals:'recomputed-from-each-retained-surface',triangles:geometry.index.count/3,replay:true,computeRuns:0};
window.drawCoverage=async arm=>{
 if(disposed||!['native','gpu'].includes(arm))throw Error('Invalid arm/state');
 const points=data[arm];geometry.attributes.position.array.set(points);geometry.attributes.position.needsUpdate=true;geometry.computeVertexNormals();geometry.computeBoundingSphere();
 mesh.material=arm==='native'?nativeMaterial:gpuMaterial;
 const label=`${arm==='native'?'Native full reference':'Retained eight-influence GPU positions'} · body target 1 · coupled\nComplete-body supplementary replay · shared camera\nSeptember 30 retained positions · geometric normals · no displacement amplification`;
 const labelElement=document.querySelector('#label');labelElement.textContent=label;
 device.pushErrorScope('validation');
 await renderer.renderAsync(scene,camera);await device.queue.onSubmittedWorkDone();
 const validation=await device.popErrorScope();if(validation)throw Error(validation.message);
 const projections=[];
 for(let i=0;i<count;i++){const p=new THREE.Vector3(...points.slice(i*3,i*3+3)).project(camera);projections.push([(p.x+1)*600,(1-p.y)*500,p.z]);}
 let uploaded=null;
 if(arm==='gpu'){
  const actual=new Float32Array(await renderer.getArrayBufferAsync(outputAttr));
  if(actual.length!==raw.length||actual.some((v,i)=>v!==raw[i]))throw Error('Storage replay differs from retained positions');
  uploaded={stride:4,vertices:count,exactFloat32XYZAndW:true};
 }
 if(errors.length)throw Error(errors.join('; '));
 const r=labelElement.getBoundingClientRect();
 return{arm,label,labelRect:{x:r.x,y:r.y,width:r.width,height:r.height,bottom:r.bottom},positionNode:arm==='gpu'?'retained-observed-storage':'geometry-attribute',uploaded,projections,common};
};
window.captureReady=true;
