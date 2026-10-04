import {Avatar} from '../../../../packages/core/src/Avatar.js';
const params=new URLSearchParams(location.search),tier=params.get('tier');
if(params.getAll('tier').length!==1||!['balanced','high'].includes(tier))throw Error('Choose one literal balanced or high tier');
const canvas=document.querySelector('canvas'),status=document.querySelector('#status'),state=document.querySelector('#state'),portrait=document.querySelector('#portrait');
document.querySelector('#tier').textContent='Requested tier: '+tier;
const log={createdAt:new Date().toISOString(),tier,options:null,states:[],failure:null,retirement:null,limits:['One Body/Portrait static sample per fresh owner, fixed32 public zero-delta steps each.','No pixel/physical-state equality, in-pass jitter, convergence, served-byte/network or allocator proof.','No motion/performance/frame-budget/fit/Showcase-import/default qualification.']};
let owner=null,busy=false,stopped=false,created=false,portraitUsed=false;
const publish=()=>state.textContent=JSON.stringify(log,null,2);
function retire(reason){
 if(stopped)return;stopped=true;portrait.disabled=true;document.querySelector('#create').disabled=true;document.querySelector('#image').hidden=true;
 log.retirement={reason,at:new Date().toISOString(),pendingAtRetirement:busy,ownerReturned:owner!==null,disposal:null,error:null};
 try{if(owner){owner.dispose();log.retirement.disposal=owner.report().disposal;owner=null;}}catch(e){log.retirement.error=String(e.stack??e);}
 status.textContent='Retired';publish();
}
addEventListener('pagehide',()=>retire('pagehide'),{once:true});document.querySelector('#retire').addEventListener('click',()=>retire('manual'));
const requireActive=()=>{if(stopped)throw Error('Preview retired during pending work');};
function validate(r,frame){
 const equal=(a,b,label)=>{if(JSON.stringify(a)!==JSON.stringify(b))throw Error(label+' mismatch');};
 equal(r.quality.backend,'webgpu','backend');equal(r.quality.backendMismatch,false,'backend compatibility');equal(r.quality.requested,tier,'request');equal(r.quality.tier,tier,'tier');equal(owner.clockSeconds,0,'static clock');
 equal(r.identity.bake,'figure_g050','bake');equal(r.identity.gender,.5,'gender');equal(r.hair.attached,true,'hair');equal(r.hair.loadedStyle,'bob02','loaded hair');
 equal(r.hair.colour.applied,'#413934','colour');equal(r.hair.colour.matchesAttached,true,'colour attachment');equal(r.hair.colour.requestedTint,null,'requested tint');equal(r.hair.colour.appliedTint,null,'applied tint');equal(r.hair.colour.resolved,'#413934','resolved colour');
 equal(r.wardrobe.attached,true,'wardrobe');equal(r.wardrobe.pendingCandidates,0,'pending wardrobe');equal(r.wardrobe.lastError,null,'wardrobe error');
 equal([...r.wardrobe.state.worn].sort(),['female_casualsuit01','shoes01','foundation_bra','foundation_briefs'].sort(),'worn IDs');
 equal(r.wardrobe.appearance.attached,true,'appearance');equal(r.wardrobe.appearance.style,'ecru','style');equal(r.wardrobe.appearance.colours,log.options.wardrobe.colours,'colours');
 equal(r.framing.mode,frame,'framing');equal(r.scene.id,'studio','scene request');equal(r.scene.lighting.look,'neutral','lighting');equal(r.scene.lighting.ambientAttached,tier==='balanced','hemisphere attachment');
 equal(r.subsystems.ambientOcclusion!==null,tier==='high','AO owner');equal(r.motion.seed,20260807,'seed');equal(r.disposal.disposed,false,'live');
}
async function view(frame){
 requireActive();const a=owner;a.setFraming(frame);
 for(let i=0;i<32;i++){requireActive();await a.step(0);}
 requireActive();const r=a.report(),observed={name:tier+'-'+frame,frame,at:new Date().toISOString(),report:r,clockSeconds:a.clockSeconds,camera:{position:a.stage.camera.position.toArray(),matrix:a.stage.camera.matrixWorld.toArray(),projection:a.stage.camera.projectionMatrix.toArray()},canvas:{width:canvas.width,height:canvas.height},complete:false};
 log.states.push(observed);publish();validate(r,frame);
 a.stage.draw();const image=canvas.toDataURL('image/png');observed.complete=true;
 const link=document.querySelector('#image');link.href=image;link.download=tier+'-'+frame+'.png';link.hidden=false;status.textContent='Ready: '+tier+'-'+frame;publish();
}
async function run(fn){
 if(busy||stopped)return;busy=true;portrait.disabled=true;
 try{await fn();}catch(e){log.failure={at:new Date().toISOString(),message:String(e.stack??e)};retire('failure');status.textContent='Stopped: '+e.message;publish();}
 finally{busy=false;if(!stopped&&owner&&!portraitUsed)portrait.disabled=false;publish();}
}
document.querySelector('#create').addEventListener('click',()=>run(async()=>{
 if(created)return;created=true;document.querySelector('#create').disabled=true;status.textContent='Creating';
 const response=await fetch('./INK-'+tier+'.json');requireActive();if(!response.ok)throw Error('Options HTTP '+response.status);
 log.options=await response.json();requireActive();publish();
 const returned=await Avatar.create({...log.options,canvas,autoStart:false});
 if(stopped){returned.dispose();log.retirement.lateDisposal=returned.report().disposal;publish();return;}
 owner=returned;await view('body');
}));
portrait.addEventListener('click',()=>run(async()=>{if(portraitUsed)return;portraitUsed=true;await view('portrait');}));publish();
