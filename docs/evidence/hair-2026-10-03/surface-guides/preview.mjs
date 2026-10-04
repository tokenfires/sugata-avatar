import * as T from 'three/webgpu';
import {Avatar} from '../../../../packages/core/src/Avatar.js';
import {buildModel} from './model.mjs';
import {configurationFromReport} from '../../../../packages/testbed/src/showcase-presets.mjs';
const canvas=document.querySelector('canvas'),status=document.querySelector('#status'),state=document.querySelector('#state'),next=document.querySelector('#next'),link=document.querySelector('#image');
const sequence=[['original','front'],['proposal','front'],['proposal','left'],['proposal','right']],cameras={front:[0,1.55,.92],left:[-.449,1.55,.79],right:[.449,1.55,.79]},deadline=Date.parse('2026-10-04T05:10:00Z');
const log={createdAt:new Date().toISOString(),options:null,inputs:{},attachment:null,records:null,states:[],failure:null,retirement:null};let owner=null,model=null,busy=false,stopped=false,created=false,index=-1;
const publish=()=>state.textContent=JSON.stringify(log,null,2);
function retire(reason){
 if(stopped)return;stopped=true;next.disabled=true;document.querySelector('#create').disabled=true;link.hidden=true;clearTimeout(expiry);
 log.retirement={reason,at:new Date().toISOString(),pendingAtRetirement:busy,ownerReturned:owner!==null,modelDisposed:false,modelDisposal:null,disposal:null,errors:[]};
 try{log.retirement.modelDisposal=model?.dispose()??null;log.retirement.modelDisposed=log.retirement.modelDisposal?.disposed??false;model=null;}catch(e){log.retirement.errors.push('model: '+String(e.stack??e));}
 try{if(owner){owner.dispose();log.retirement.disposal=owner.report().disposal;owner=null;}}catch(e){log.retirement.errors.push('Avatar: '+String(e.stack??e));}
 status.textContent='Retired';publish();
}
const expiry=setTimeout(()=>retire('fixed deadline'),Math.max(0,deadline-Date.now()));addEventListener('pagehide',()=>retire('pagehide'),{once:true});document.querySelector('#retire').addEventListener('click',()=>retire('manual'));
const active=()=>{if(stopped||Date.now()>=deadline)throw Error('Study stopped or deadline reached');};
async function exactJson(url,expected){const r=await fetch(url);active();if(!r.ok)throw Error('Input HTTP '+r.status);const bytes=await r.arrayBuffer();active();const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),b=>b.toString(16).padStart(2,'0')).join('');active();if(hash!==expected)throw Error('Input bytes changed '+url);log.inputs[url]={bytes:bytes.byteLength,sha256:hash};return JSON.parse(new TextDecoder().decode(bytes));}
function validate(){const r=owner.report(),equal=(a,b,label)=>{if(JSON.stringify(a)!==JSON.stringify(b))throw Error(label+' mismatch');};equal(r.quality.backend,'webgpu','backend');equal(r.quality.backendMismatch,false,'compatibility');equal(r.quality.tier,'balanced','tier');equal(owner.clockSeconds,0,'clock');equal(r.identity.bake,'figure_g050','body');equal(r.hair.loadedStyle,'bob02','original hair');equal(r.hair.attached,true,'hair');equal(r.wardrobe.attached,true,'wardrobe');equal(r.wardrobe.pendingCandidates,0,'wardrobe pending');equal(r.wardrobe.lastError,null,'wardrobe error');equal(r.wardrobe.appearance.colours,log.options.wardrobe.colours,'colours');equal(r.scene.id,'studio','scene');equal(r.scene.lighting.look,'neutral','lighting');equal(r.disposal.disposed,false,'live owner');equal(configurationFromReport(r),log.options,'actual attached Ink recipe');return r;}
async function view(){
 active();const [arm,view]=sequence[index];owner.hairRoot.visible=arm==='original';model.group.visible=arm==='proposal';
 for(let i=0;i<32;i++){active();await owner.step(0);}active();const report=validate(),camera=owner.stage.camera;camera.fov=26;camera.position.set(...cameras[view]);camera.lookAt(0,1.55,.04);camera.updateProjectionMatrix();camera.updateMatrixWorld(true);model.group.updateMatrixWorld(true);
 if(camera.coordinateSystem!==T.WebGPUCoordinateSystem)throw Error('Camera is not using WebGPU depth coordinates');
 const bounds={min:[Infinity,Infinity,Infinity],max:[-Infinity,-Infinity,-Infinity],vertices:0,coordinateSystem:camera.coordinateSystem,clipDepth:[0,1]};
 for(const mesh of model.group.children)for(let i=0;i<mesh.geometry.attributes.position.count;i++){const p=new T.Vector3().fromBufferAttribute(mesh.geometry.attributes.position,i).applyMatrix4(mesh.matrixWorld).project(camera);if(!p.toArray().every(Number.isFinite))throw Error('Projection nonfinite');p.toArray().forEach((v,k)=>{bounds.min[k]=Math.min(bounds.min[k],v);bounds.max[k]=Math.max(bounds.max[k],v);});bounds.vertices++;}
 const observed={name:arm+'-'+view,at:new Date().toISOString(),arm,view,report,originalVisible:owner.hairRoot.visible,proposalVisible:model.group.visible,camera:{position:camera.position.toArray(),quaternion:camera.quaternion.toArray(),matrix:camera.matrixWorld.toArray(),projection:camera.projectionMatrix.toArray(),fov:camera.fov,aspect:camera.aspect},bounds,canvas:{width:canvas.width,height:canvas.height},complete:false};log.states.push(observed);publish();
 if(bounds.min[0]<-.94||bounds.max[0]>.94||bounds.min[1]<-.94||bounds.max[1]>.94||bounds.min[2]<0||bounds.max[2]>1)throw Error('Actual modelling geometry outside fixed frame');
 owner.stage.draw();link.href=canvas.toDataURL('image/png');active();link.download=observed.name+'.png';link.hidden=false;observed.complete=true;status.textContent='Ready: '+observed.name;publish();
}
async function run(fn){if(busy||stopped)return;busy=true;next.disabled=true;try{await fn();}catch(e){log.failure={at:new Date().toISOString(),message:String(e.stack??e)};retire('failure');status.textContent='Stopped: '+e.message;publish();}finally{busy=false;if(!stopped&&owner&&index<sequence.length-1)next.disabled=false;publish();}}
document.querySelector('#create').addEventListener('click',()=>run(async()=>{
 if(created)return;created=true;document.querySelector('#create').disabled=true;status.textContent='Creating';if(Date.now()>=Date.parse('2026-10-04T04:50:00Z'))throw Error('First Create cutoff');
 log.options=await exactJson('../../../../looks/ink-denim.json','80562c5d8584fb75c127afd5dc240470fdf46c1a9f964d9075cbe38de3f07407');
 const guides=await exactJson('./GUIDES.json','d457064a69b3fc9547c569f8a8f874e104d0b81c2b8d9a35e17fd09314d9c304'),source=await exactJson('./SOURCE-TRIANGLES.json','221ee2c48efbde4dcf66e9d2835d9c7b702ed00ac76d950dfd64a5ac81a256ba');publish();
 const returned=await Avatar.create({...log.options,canvas,autoStart:false});if(stopped){try{returned.dispose();log.retirement.lateDisposal=returned.report().disposal;}catch(e){log.retirement.errors.push('late: '+String(e.stack??e));}publish();return;}owner=returned;active();
 for(let i=0;i<32;i++){active();await owner.step(0);}validate();model=buildModel(guides,source,owner,T);log.attachment=model.attachment;log.records=model.records;index=0;await view();
}));
next.addEventListener('click',()=>run(async()=>{if(index<0||index>=sequence.length-1)throw Error('No next view');index++;await view();}));publish();
