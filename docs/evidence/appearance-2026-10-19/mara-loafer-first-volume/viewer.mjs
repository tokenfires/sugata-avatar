// Fresh actual client of the tested owner. No GPU exists until the sole button.
import * as THREE from './lib/three.module.js';
import { createPreviewLifetime, PreviewClosedError } from '../../../../tools/artist-preview-lifetime.mjs';

const ID='mara-original-cage-loafer-first-volume-v1',STOP=Date.parse('2026-10-19T19:37:55.992117+00:00');
const W=570,H=340,encoder=new TextEncoder();
const button=document.querySelector('#begin'),finishButton=document.querySelector('#finish');
const status=document.querySelector('#status'),recordNode=document.querySelector('#record');
let started=false,finished=false,pageLive=true,host=null,gpu=null,startedAt=0;
const record={schema:ID,status:'UNSTARTED',frames:[],acquisitions:[],cleanup:[],rendererAPIs:[],dataBytes:0,typedArrayBytes:0,pngBytes:0,limits:'Controlled actual client API observations; no private-constructor/physical release, peak process memory, performance, fit, manufacturing or AAA qualification.'};
window.__maraLoaferRecord=record;
const check=(ok,message)=>{if(!ok)throw Error(message);};
const errorText=e=>String(e?.stack??e);
const snapshot=owner=>owner?{...owner.inspect(),failures:owner.inspect().failures.map(f=>({...f,error:errorText(f.error)}))}:null;
function diagnostic(message) {
    // Host diagnostic channel outlives the preview, but never paints after pagehide.
    // It publishes metadata only, with no image/scene/resource allocation.
    record.host=snapshot(host);record.gpu=snapshot(gpu);
    if(pageLive){status.textContent=message;recordNode.textContent=JSON.stringify(record,null,2);}
}
function active() {
    check(host!==null,'Host owner exists');host.checkpoint();
    if(finished||Date.now()>=STOP||performance.now()-startedAt>=60000){host.close('preview stop');host.checkpoint();}
}
function owned(owner,label,factory,dispose) {
    active();
    return owner.create(()=>{record.acquisitions.push({label,stage:'factory-enter'});const value=factory();record.acquisitions.push({label,stage:'returned'});return value;},value=>{
        const row={label,status:'attempted'};record.cleanup.push(row);
        try{dispose(value);row.status='returned';}catch(error){row.status='failed';row.error=errorText(error);throw error;}
    },label);
}
async function bytes(url,max) {
    active();const response=await host.waitData(fetch(url,{signal:host.signal,cache:'no-store'}));active();check(response.ok,'HTTP '+response.status+' '+url);
    const length=response.headers.get('content-length');if(length!==null)check(Number.isFinite(+length)&&+length<=max,'Reported response length');
    const data=await host.waitData(response.arrayBuffer());active();check(data.byteLength<=max,'Actual response byte ceiling');record.dataBytes+=data.byteLength;check(record.dataBytes<=2162688,'Admission+model data budget');return data;
}
async function digest(data) {
    active();const result=await host.waitData(crypto.subtle.digest('SHA-256',data));active();return [...new Uint8Array(result)].map(b=>b.toString(16).padStart(2,'0')).join('');
}
function rendererRelease(renderer) {
    const errors=[];
    for(const name of ['dispose','forceContextLoss']) {
        const row={method:name,status:'attempted'};record.rendererAPIs.push(row);
        try{renderer[name]();row.status='returned';}catch(error){row.status='failed';row.error=errorText(error);errors.push(error);}
    }
    if(errors.length)throw new AggregateError(errors,'Renderer release attempts failed');
}
function closeGPU(reason) {
    if(!gpu)return;
    const result=gpu.close(reason);record.gpu=snapshot(gpu);
    check(result.pendingReleases===0,'All known GPU release attempts completed');
    check(result.failures.length===0,'Known GPU release errors: '+result.failures.map(f=>errorText(f.error)).join('; '));
}
function closeHost(reason) {
    const result=host?.close(reason);record.host=snapshot(host);record.gpu=snapshot(gpu);
    if(result&&result.failures.length)record.closeErrors=result.failures.map(f=>errorText(f.error));
}
function finish(reason) {
    if(finished)return;finished=true;button.disabled=true;finishButton.disabled=true;
    closeHost(reason);record.status=record.status==='READY'?'FINISHED':record.status==='FAILED'?'FAILED_CLOSED':'CLOSED';diagnostic(record.status+' — owned release attempts recorded.');
}
window.addEventListener('pagehide',()=>{pageLive=false;finish('pagehide');},{once:true});
finishButton.addEventListener('click',()=>finish('finish-button'));

const views=[
    {id:'high-front',position:[-3.8,3.1,6],up:[0,1,0],halfHeight:1.82,inside:false},
    {id:'lateral',position:[-7,1.6,.2],up:[0,1,0],halfHeight:1.82,inside:false},
    {id:'rear',position:[.2,2,-6],up:[0,1,0],halfHeight:1.82,inside:false},
    {id:'top',position:[0,7,.25],up:[0,0,-1],halfHeight:2.6,inside:false},
    {id:'underside',position:[0,-7,.25],up:[0,0,1],halfHeight:2.6,inside:false},
    {id:'inside-selection',position:[-2.3,5.4,3.4],up:[0,1,0],halfHeight:2.6,inside:true}
];
function validateFloat32(position,index) {
    for(let i=0;i<index.length;i+=3){
        if(i%768===0)active();const a=index[i]*3,b=index[i+1]*3,c=index[i+2]*3;
        const ux=position[b]-position[a],uy=position[b+1]-position[a+1],uz=position[b+2]-position[a+2];
        const vx=position[c]-position[a],vy=position[c+1]-position[a+1],vz=position[c+2]-position[a+2];
        check(Math.hypot(uy*vz-uz*vy,uz*vx-ux*vz,ux*vy-uy*vx)>1e-10,'Nondegenerate Float32 triangle');
    }
}
async function begin() {
    if(started||finished)return;started=true;button.disabled=true;startedAt=performance.now();record.status='STARTED';record.startedUTC=new Date().toISOString();
    try {
        host=createPreviewLifetime({limit:16});diagnostic('Validating the single root admission.');
        const expected=document.querySelector('#admission').value.trim();check(/^[0-9a-f]{64}$/.test(expected),'Exact root admission SHA256 required');
        const admissionData=await bytes('./GPU-ADMISSION.json',65536),admissionSHA=await digest(admissionData);check(admissionSHA===expected,'Admission identity');
        const admission=JSON.parse(new TextDecoder().decode(admissionData));
        check(admission.status==='ADMITTED_ONE_FIXED_GPU_PACKET'&&admission.contract===ID,'Root GPU contract');
        check(admission.absolute_stop_utc==='2026-10-19T19:37:55.992117+00:00'&&Date.now()<Date.parse(admission.expires_utc),'Fresh GPU admission');
        check(admission.width===W&&admission.height===H&&admission.frames===6,'Fixed frame dimensions/count');
        const modelData=await bytes('./out/model.json',2097152),modelSHA=await digest(modelData);check(modelSHA===admission.model.sha256&&modelData.byteLength===admission.model.bytes,'Actual model identity');
        const model=JSON.parse(new TextDecoder().decode(modelData));check(model.schema==='mara-loafer-original-cage-volume-v1'&&model.parts.length===9,'Original cage model');
        check(model.parts.reduce((n,p)=>n+p.positions.length,0)<=8192&&model.parts.reduce((n,p)=>n+p.triangles.length,0)<=16000,'Actual model workload');active();
        check(Date.now()<Date.parse(admission.expires_utc),'Fresh admission at resource creation');
        record.admissionSHA=admissionSHA;record.modelSHA=modelSHA;record.modelBytes=modelData.byteLength;record.threeRevision=THREE.REVISION;
        gpu=owned(host,'gpu-owner',()=>createPreviewLifetime({parentSignal:host.signal,limit:48}),child=>{
            const result=child.close('host-close');if(result.failures.length)throw new AggregateError(result.failures.map(f=>f.error),'Child release failures');
        });
        const canvas=owned(gpu,'canvas',()=>document.createElement('canvas'),value=>value.remove());
        const renderer=owned(gpu,'renderer',()=>new THREE.WebGLRenderer({canvas,antialias:true,alpha:false,preserveDrawingBuffer:true}),rendererRelease);
        active();renderer.setPixelRatio(1);renderer.setSize(W,H,false);renderer.setClearColor('#f3eee5',1);
        const scene=owned(gpu,'scene',()=>new THREE.Scene(),value=>value.clear());
        const camera=owned(gpu,'camera',()=>new THREE.OrthographicCamera(-3.05,3.05,1.82,-1.82,.1,40),value=>value.removeFromParent());
        const hemi=owned(gpu,'hemisphere',()=>new THREE.HemisphereLight('#ffffff','#d4c8b8',2.2),value=>value.removeFromParent());
        const ambient=owned(gpu,'ambient',()=>new THREE.AmbientLight('#ffffff',.7),value=>value.removeFromParent());
        const keyLight=owned(gpu,'key-light',()=>new THREE.DirectionalLight('#ffffff',2.2),value=>value.removeFromParent());
        gpu.publish(()=>scene.add(hemi,ambient,keyLight));
        const materials=model.materials.map((m,i)=>owned(gpu,'material-'+i,()=>new THREE.MeshStandardMaterial({color:m.colour,roughness:m.roughness,metalness:0,side:m.id==='cream'?THREE.DoubleSide:THREE.FrontSide}),value=>value.dispose()));
        const meshes=model.parts.map((part,pi)=>{
            active();const position=new Float32Array(part.positions.flat()),index=new Uint16Array(part.triangles.flat());
            check([...position].every(Number.isFinite),'Finite Float32 positions');validateFloat32(position,index);
            record.typedArrayBytes+=position.byteLength+index.byteLength+position.byteLength;check(record.typedArrayBytes<=1048576,'Position/index/normal array budget');
            const geometry=owned(gpu,'geometry-'+pi,()=>new THREE.BufferGeometry(),value=>value.dispose());
            active();geometry.setAttribute('position',new THREE.BufferAttribute(position,3));geometry.setIndex(new THREE.BufferAttribute(index,1));
            let start=0;for(let i=1;i<=part.materials.length;i++)if(i===part.materials.length||part.materials[i]!==part.materials[start]){geometry.addGroup(start*3,(i-start)*3,part.materials[start]);start=i;}
            geometry.computeVertexNormals();
            const mesh=owned(gpu,'mesh-'+pi,()=>new THREE.Mesh(geometry,materials),value=>value.removeFromParent());
            gpu.publish(()=>scene.add(mesh));return {part,mesh};
        });
        check(gpu.inspect().created<=48,'Known resource identity capacity');
        for(let vi=0;vi<views.length;vi++) {
            active();const view=views[vi];
            for(const {part,mesh}of meshes)mesh.visible=!view.inside||['upper-with-inward-lining','brown-midsole','dark-forepart','low-stacked-heel','dark-heel-patch','cream-footbed'].includes(part.id);
            materials.forEach((m,i)=>{m.visible=!view.inside||[2,3,4].includes(i);});
            camera.left=-view.halfHeight*W/H;camera.right=view.halfHeight*W/H;camera.top=view.halfHeight;camera.bottom=-view.halfHeight;
            camera.position.set(...view.position);camera.up.set(...view.up);camera.lookAt(0,.40,.25);camera.updateProjectionMatrix();
            keyLight.position.copy(camera.position).add(new THREE.Vector3(3,3,2));keyLight.target.position.set(0,.3,.25);keyLight.target.updateMatrixWorld();
            gpu.publish(()=>renderer.render(scene,camera));active();
            const png=gpu.publish(()=>canvas.toDataURL('image/png'));check(png.startsWith('data:image/png;base64,'),'PNG URI');
            const native=Uint8Array.from(atob(png.slice(png.indexOf(',')+1)),c=>c.charCodeAt(0));check(native.byteLength<=2097152,'One PNG byte limit');
            record.pngBytes+=native.byteLength;check(record.pngBytes<=16777216,'Total native PNG budget');const pngSHA=await digest(native);active();
            const image=owned(host,'frame-image-'+vi,()=>document.createElement('img'),value=>{value.remove();value.removeAttribute('src');});
            host.publish(()=>{image.alt='Mara original loafer / '+view.id;image.width=W;image.height=H;image.src=png;});
            await host.waitData(image.decode());active();check(image.naturalWidth===W&&image.naturalHeight===H,'Actual decoded frame dimensions');
            const frame={role:view.id,width:W,height:H,bytes:native.byteLength,sha256:pngSHA,position:view.position,up:view.up,frustum:[camera.left,camera.right,camera.top,camera.bottom],keyLight:keyLight.position.toArray(),visibleParts:meshes.filter(v=>v.mesh.visible).map(v=>v.part.id),visibleMaterials:materials.flatMap((m,i)=>m.visible?[model.materials[i].id]:[]),calls:renderer.info.render.calls,triangles:renderer.info.render.triangles};
            host.publish(()=>{document.querySelector('#frame-'+vi).replaceChildren(image);record.frames.push(frame);});
        }
        active();closeGPU('six-frames-complete');active();
        check(record.frames.length===6,'Six completed frames');record.status='READY';record.completedUTC=new Date().toISOString();record.packetMs=performance.now()-startedAt;
        diagnostic('Ready — six fixed views; GPU release attempts recorded, images retained until Finish.');
    } catch(error) {
        record.status='FAILED';record.error=errorText(error);record.closedError=error instanceof PreviewClosedError;closeHost('packet-failure');diagnostic('Failed — retain this exact packet and cleanup record.');
    }
}
button.addEventListener('click',()=>{void begin();});
