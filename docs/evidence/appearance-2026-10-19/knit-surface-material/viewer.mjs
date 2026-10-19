import * as THREE from 'three';
import {installKnit,SETTINGS} from './material.mjs';
const button=document.querySelector('#render'),status=document.querySelector('#status');
const packet=document.querySelector('#packet'),record=document.querySelector('#observed-record');
const canvas=document.querySelector('canvas');
let renderer,geometry,control,candidate,timer;
let started=false,closed=false;
const observed={schema:'knit-surface-first-packet-v1',revision:THREE.REVISION,settings:SETTINGS,draws:[],cleanup:[],error:null};
function publish(){record.textContent=JSON.stringify(observed);}
function cleanup(reason){
  if(closed)return;closed=true;clearTimeout(timer);observed.closeReason=reason;
  for(const [name,owner] of [['geometry',geometry],['control',control],['candidate',candidate],['renderer',renderer]]){
    const row={name,present:!!owner,error:null};try{owner?.dispose();}catch(e){row.error=String(e);}observed.cleanup.push(row);
  }
  if(renderer){try{renderer.forceContextLoss();observed.contextLossRequested=true;}catch(e){observed.contextLossError=String(e);}}
  publish();
}
function stop(error){observed.error=String(error);status.textContent=`Study stopped: ${error.message}`;cleanup('error');publish();}
addEventListener('pagehide',()=>cleanup('pagehide'),{once:true});
canvas.addEventListener('webglcontextlost',()=>{if(!closed)stop(new Error('Unexpected context loss'));});
const sha=async bytes=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(x=>x.toString(16).padStart(2,'0')).join('');
button.addEventListener('click',async()=>{
  if(started)return;started=true;button.disabled=true;observed.startedUtc=new Date().toISOString();
  timer=setTimeout(()=>stop(new Error('60 second packet lifetime exceeded')),60000);
  try{
    if(THREE.REVISION!=='185')throw new Error('Renderer revision changed');
    const admissionResponse=await fetch('./ADMISSION.json',{signal:AbortSignal.timeout(15000)});
    if(!admissionResponse.ok)throw new Error('Root source admission absent');
    const admission=await admissionResponse.json();
    if(admission.allow!=='one-fixed-six-frame-packet'||Date.now()>Date.parse(admission.expiresUtc))throw new Error('Admission expired or wrong');
    const response=await fetch('../../appearance-2026-10-04/whole-knit-serving/mesh.json',{signal:AbortSignal.timeout(15000)});
    if(!response.ok)throw new Error(`Mesh retrieval ${response.status}`);
    const bytes=await response.arrayBuffer();observed.meshSha=await sha(bytes);
    if(observed.meshSha!=='0e0460f465cd7c4570abd4510be9a8ba45cb0c3fc7983fa8e22e3e7e56e67fb1')throw new Error('Mesh bytes changed');
    if(closed)throw new Error('Closed during input load');
    const source=JSON.parse(new TextDecoder().decode(bytes));
    if(source.positions.length!==1102||source.quads.length!==1056)throw new Error('Mesh count changed');
    geometry=new THREE.BufferGeometry();
    geometry.setAttribute('position',new THREE.Float32BufferAttribute(source.positions.flat(),3));
    geometry.setIndex(source.quads.flatMap(q=>[q[0],q[1],q[2],q[0],q[2],q[3]]));
    geometry.computeVertexNormals();
    observed.geometry={vertices:1102,quads:1056,triangles:2112,uv:false,positionSha:await sha(geometry.attributes.position.array),indexSha:await sha(geometry.index.array)};
    const shared={color:0x9dacc4,roughness:1,metalness:0,side:THREE.DoubleSide};
    control=new THREE.MeshStandardMaterial(shared);candidate=installKnit(new THREE.MeshStandardMaterial(shared));
    observed.materials={shared,onlyCandidateAddition:'installKnit normal contribution'};
    const scene=new THREE.Scene();scene.background=new THREE.Color(0x192b32);
    const mesh=new THREE.Mesh(geometry,control);scene.add(mesh);
    scene.add(new THREE.HemisphereLight(0xe5edf5,0x56696c,2.1));
    const key=new THREE.DirectionalLight(0xfff1dc,3.2);key.position.set(-1,2,3);scene.add(key);
    const fill=new THREE.DirectionalLight(0xc8dfff,1.1);fill.position.set(1,1,-2);scene.add(fill);
    renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:false,preserveDrawingBuffer:true});
    renderer.debug.checkShaderErrors=true;renderer.debug.onShaderError=()=>{throw new Error('Shader compilation failed');};
    renderer.setPixelRatio(1);renderer.setSize(570,340,false);
    renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1;
    observed.renderer={type:'WebGL2',size:[570,340],pixelRatio:1,antialias:true,preserveDrawingBuffer:true,output:'sRGB',toneMapping:'ACESFilmic',exposure:1};
    const aspect=570/340,camera=new THREE.OrthographicCamera(-.60*aspect,.60*aspect,.60,-.60,.1,10);
    for(const [view,position] of [['Front',[0,.375,3]],['Oblique',[2,.85,2]],['Rear',[0,.375,-3]]]){
      const heading=document.createElement('h2');heading.textContent=view;packet.append(heading);
      const pair=document.createElement('div');pair.className='pair';packet.append(pair);
      camera.position.set(...position);camera.lookAt(0,.375,0);camera.updateMatrixWorld();
      for(const [name,material] of [['Control',control],['Candidate',candidate]]){
        if(closed||observed.draws.length>=6)throw new Error('Packet lifetime/count exceeded');
        mesh.material=material;renderer.render(scene,camera);
        const dataUrl=canvas.toDataURL('image/png');
        const image=document.createElement('img');image.width=570;image.height=340;image.alt=`${view} · ${name}`;image.src=dataUrl;await image.decode();
        const figure=document.createElement('figure'),caption=document.createElement('figcaption');caption.textContent=name;figure.append(caption,image);pair.append(figure);
        observed.draws.push({view,name,camera:position,target:[0,.375,0],verticalHalfExtent:.60,near:.1,far:10,width:570,height:340,pngSha:await sha(Uint8Array.from(atob(dataUrl.split(',')[1]),c=>c.charCodeAt(0))),calls:renderer.info.render.calls,triangles:renderer.info.render.triangles});publish();
      }
    }
    cleanup('six frames complete');observed.completedUtc=new Date().toISOString();status.textContent='Six fixed views complete · rendering resources released.';publish();
  }catch(error){stop(error);}
});
publish();
