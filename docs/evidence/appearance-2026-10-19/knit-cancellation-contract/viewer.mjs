import * as THREE from 'three';
import {installKnit,SETTINGS} from './material.mjs';
import {prepareInputs,assertOpen} from './prepare.mjs';
const button=document.querySelector('#render'),status=document.querySelector('#status');
const packet=document.querySelector('#packet'),record=document.querySelector('#observed-record');
const canvas=document.querySelector('canvas');
let renderer,geometry,control,candidate,context,pendingImage,timer,fetchTimer;
let started=false,closed=false;
const requestOwner=new AbortController();
const observed={schema:'knit-cancellation-first-packet-v1',revision:THREE.REVISION,settings:SETTINGS,requestedRenders:0,draws:[],cleanup:[],error:null};
const open=()=>assertOpen(()=>closed);
function publish(){record.textContent=JSON.stringify(observed);}
function cleanup(reason){
  if(closed)return;closed=true;clearTimeout(timer);clearTimeout(fetchTimer);observed.closeReason=reason;
  requestOwner.abort();observed.fetchAbortRequested=true;
  if(pendingImage){pendingImage.removeAttribute('src');pendingImage=null;}
  for(const [name,owner] of [['geometry',geometry],['control',control],['candidate',candidate],['renderer',renderer]]){
    const row={name,present:!!owner,error:null};try{owner?.dispose();}catch(e){row.error=String(e);}observed.cleanup.push(row);
  }
  if(context){try{const extension=context.getExtension('WEBGL_lose_context');observed.contextLossAvailable=!!extension;if(extension){extension.loseContext();observed.contextLossRequested=true;}}catch(e){observed.contextLossError=String(e);}}
  publish();
}
function stop(error){
  if(!observed.error)observed.error=String(error);
  status.textContent=`Study stopped: ${error.message}`;cleanup('error');publish();
}
async function checked(promise){const value=await promise;open();return value;}
async function fetchOwned(url){
  open();fetchTimer=setTimeout(()=>requestOwner.abort(),15000);
  try{return await checked(fetch(url,{signal:requestOwner.signal}));}finally{clearTimeout(fetchTimer);}
}
addEventListener('pagehide',()=>cleanup('pagehide'),{once:true});
canvas.addEventListener('webglcontextlost',()=>{if(!closed)stop(new Error('Unexpected context loss'));});
const sha=async bytes=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(x=>x.toString(16).padStart(2,'0')).join('');
button.addEventListener('click',async()=>{
  if(started||closed)return;started=true;button.disabled=true;observed.startedUtc=new Date().toISOString();
  timer=setTimeout(()=>stop(new Error('60 second packet lifetime exceeded')),60000);
  try{
    open();if(THREE.REVISION!=='185')throw new Error('Renderer revision changed');
    const admissionResponse=await fetchOwned('./ADMISSION.json');open();
    if(!admissionResponse.ok)throw new Error('Root GPU admission absent');
    const admission=await checked(admissionResponse.json());open();
    const expires=Date.parse(admission.expiresUtc);
    if(admission.allow!=='one-fixed-six-frame-packet'||!Number.isFinite(expires)||Date.now()>expires)throw new Error('Admission expired or wrong');
    const response=await fetchOwned('../../appearance-2026-10-04/whole-knit-serving/mesh.json');open();
    if(!response.ok)throw new Error(`Mesh retrieval ${response.status}`);
    const bytes=await checked(response.arrayBuffer());open();
    const prepared=await checked(prepareInputs(bytes,sha,()=>closed));open();
    observed.meshSha=prepared.meshSha;
    observed.geometry={vertices:1102,quads:1056,triangles:2112,uv:false,positionSha:prepared.positionSha,indexSha:prepared.indexSha};
    // Atomic GPU-owner acquisition: no await until every owner has been registered.
    geometry=new THREE.BufferGeometry();
    geometry.setAttribute('position',new THREE.BufferAttribute(prepared.positions,3));geometry.setIndex(new THREE.BufferAttribute(prepared.indices,1));geometry.computeVertexNormals();
    const shared={color:0x9dacc4,roughness:1,metalness:0,side:THREE.DoubleSide};
    control=new THREE.MeshStandardMaterial(shared);candidate=new THREE.MeshStandardMaterial(shared);installKnit(candidate);
    observed.materials={shared,onlyCandidateAddition:'installKnit normal contribution'};
    const scene=new THREE.Scene();scene.background=new THREE.Color(0x192b32);
    const mesh=new THREE.Mesh(geometry,control);scene.add(mesh);
    scene.add(new THREE.HemisphereLight(0xe5edf5,0x56696c,2.1));
    const key=new THREE.DirectionalLight(0xfff1dc,3.2);key.position.set(-1,2,3);scene.add(key);
    const fill=new THREE.DirectionalLight(0xc8dfff,1.1);fill.position.set(1,1,-2);scene.add(fill);
    // Explicit raw context ownership also covers a throwing renderer constructor.
    const attributes={alpha:true,depth:true,stencil:false,antialias:true,premultipliedAlpha:true,preserveDrawingBuffer:true,powerPreference:'default',failIfMajorPerformanceCaveat:false};
    context=canvas.getContext('webgl2',attributes);if(!context)throw new Error('WebGL2 context unavailable');
    observed.contextAttributes=context.getContextAttributes();
    renderer=new THREE.WebGLRenderer({canvas,context,antialias:true,alpha:false,preserveDrawingBuffer:true});
    renderer.debug.checkShaderErrors=true;renderer.debug.onShaderError=()=>{throw new Error('Shader compilation failed');};
    renderer.setPixelRatio(1);renderer.setSize(570,340,false);
    renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1;
    observed.renderer={type:'WebGL2',size:[570,340],pixelRatio:1,antialias:true,preserveDrawingBuffer:true,output:'sRGB',toneMapping:'ACESFilmic',exposure:1};
    const aspect=570/340,camera=new THREE.OrthographicCamera(-.60*aspect,.60*aspect,.60,-.60,.1,10);
    for(const [view,position] of [['Front',[0,.375,3]],['Oblique',[2,.85,2]],['Rear',[0,.375,-3]]]){
      open();const heading=document.createElement('h2');heading.textContent=view;packet.append(heading);
      const pair=document.createElement('div');pair.className='pair';packet.append(pair);
      camera.position.set(...position);camera.lookAt(0,.375,0);camera.updateMatrixWorld();
      for(const [name,material] of [['Control',control],['Candidate',candidate]]){
        open();if(observed.requestedRenders>=6)throw new Error('Render count exceeded');
        mesh.material=material;observed.requestedRenders++;renderer.render(scene,camera);
        const dataUrl=canvas.toDataURL('image/png');
        pendingImage=document.createElement('img');pendingImage.width=570;pendingImage.height=340;pendingImage.alt=`${view} · ${name}`;pendingImage.src=dataUrl;
        const image=pendingImage;await checked(image.decode());open();
        const pngSha=await checked(sha(Uint8Array.from(atob(dataUrl.split(',')[1]),c=>c.charCodeAt(0))));open();
        const figure=document.createElement('figure'),caption=document.createElement('figcaption');caption.textContent=name;figure.append(caption,image);pair.append(figure);pendingImage=null;
        observed.draws.push({view,name,camera:position,target:[0,.375,0],verticalHalfExtent:.60,near:.1,far:10,width:570,height:340,pngSha,calls:renderer.info.render.calls,triangles:renderer.info.render.triangles});publish();
      }
    }
    open();observed.completedUtc=new Date().toISOString();cleanup('six frames complete');status.textContent='Six fixed views complete · rendering cleanup recorded.';publish();
  }catch(error){stop(error);}
});
publish();
