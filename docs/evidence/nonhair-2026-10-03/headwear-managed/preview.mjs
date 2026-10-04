import {Avatar} from '../../../../packages/core/src/Avatar.js';
const canvas=document.querySelector('canvas'),status=document.querySelector('#status'),state=document.querySelector('#state');
const controls=['body','front','left','right'].map(id=>document.getElementById(id));
const log={createdAt:new Date().toISOString(),options:null,states:[],failure:null,retirement:null,limits:['One unchanged g050/bob02/Fedora/Neutral composition, four static camera views.','No served-byte census, exhaustive network, allocator, motion, hidden-contact or Showcase-import proof.','32 zero-delta public steps are fixed samples, not temporal convergence.']};
let owner=null,busy=false,stopped=false,created=false,pngUrl=null,receiptUrl=null;
function receipt(){
 state.textContent=JSON.stringify(log,null,2);
 if(receiptUrl)URL.revokeObjectURL(receiptUrl);
 receiptUrl=URL.createObjectURL(new Blob([JSON.stringify(log,null,2)+'\n'],{type:'application/json'}));
 const a=document.querySelector('#receipt');a.href=receiptUrl;a.download='headwear-receipt.json';a.hidden=false;
}
function retire(reason){
 if(stopped)return;
 stopped=true;controls.forEach(b=>b.disabled=true);document.querySelector('#create').disabled=true;document.querySelector('#png').hidden=true;
 log.retirement={reason,at:new Date().toISOString(),pendingAtRetirement:busy,ownerReturned:owner!==null,disposal:null,error:null};
 try{if(owner){owner.dispose();log.retirement.disposal=owner.report().disposal;owner=null;}}
 catch(e){log.retirement.error=String(e.stack??e);}
 status.textContent='Retired';receipt();
}
addEventListener('pagehide',()=>retire('pagehide'),{once:true});
document.querySelector('#retire').addEventListener('click',()=>retire('manual'));
function requireActive(){if(stopped)throw Error('Preview retired during pending work');}
function validate(r,frame){
 const equal=(a,b,label)=>{if(JSON.stringify(a)!==JSON.stringify(b))throw Error(label+' mismatch');};
 equal(r.quality.backend,'webgpu','backend');equal(r.quality.backendMismatch,false,'quality backend');
 equal(r.quality.requested,'balanced','quality request');equal(owner.clockSeconds,0,'static clock');
 equal(r.identity.bake,'figure_g050','identity bake');equal(r.identity.gender,.5,'gender');equal(r.hair.attached,true,'hair attachment');equal(r.hair.loadedStyle,'bob02','loaded hair');
 equal(r.hair.colour.applied,log.options.hairColour,'hair colour');equal(r.hair.colour.matchesAttached,true,'colour attachment');
 equal(r.hair.colour.requestedTint,null,'requested tint');equal(r.hair.colour.appliedTint,null,'applied tint');equal(r.hair.colour.resolved,log.options.hairColour,'resolved colour');
 equal(r.wardrobe.attached,true,'wardrobe attachment');equal(r.wardrobe.pendingCandidates,0,'pending wardrobe');equal(r.wardrobe.lastError,null,'wardrobe error');
 equal([...r.wardrobe.state.worn].sort(),['female_casualsuit01','shoes01','fedora01','foundation_bra','foundation_briefs'].sort(),'worn IDs');
 equal(r.wardrobe.appearance.style,'ecru','style');equal(r.wardrobe.appearance.attached,true,'appearance attachment');equal(r.wardrobe.appearance.colours,log.options.wardrobe.colours,'colours');
 equal(r.framing.mode,frame,'framing');equal(r.scene.id,'studio','scene request');equal(r.scene.lighting.look,'neutral','lighting');equal(r.motion.seed,20260807,'seed');equal(r.disposal.disposed,false,'live owner');
}
async function view(name,frame,angle){
 requireActive();const a=owner;a.setFraming(frame);
 const focus=a.focus,radius=a.stage.camera.position.distanceTo(focus),rad=angle*Math.PI/180;
 a.stage.camera.position.set(focus.x+radius*Math.sin(rad),focus.y,focus.z+radius*Math.cos(rad));a.stage.camera.lookAt(focus);
 for(let i=0;i<32;i++){requireActive();await a.step(0);}
 requireActive();const r=a.report();
 const observed={name,frame,angle,at:new Date().toISOString(),report:r,camera:{position:a.stage.camera.position.toArray(),matrix:a.stage.camera.matrixWorld.toArray(),projection:a.stage.camera.projectionMatrix.toArray()},canvas:{width:canvas.width,height:canvas.height},clockSeconds:a.clockSeconds,complete:false};
 log.states.push(observed);receipt();validate(r,frame);
 a.stage.draw();const image=canvas.toDataURL('image/png');
 observed.complete=true;
 // The data URL is read in the same task as the ordinary draw, then exposed as a normal download.
 pngUrl=image;const link=document.querySelector('#png');link.href=pngUrl;link.download=name+'.png';link.hidden=false;
 status.textContent='Ready: '+name;receipt();
}
async function run(fn){
 if(busy||stopped)return;busy=true;controls.forEach(b=>b.disabled=true);
 try{await fn();}
 catch(e){log.failure={at:new Date().toISOString(),message:String(e.stack??e)};retire('failure');status.textContent='Stopped: '+e.message;receipt();}
 finally{busy=false;if(!stopped&&owner)controls.forEach(b=>b.disabled=false);receipt();}
}
document.querySelector('#create').addEventListener('click',()=>run(async()=>{
 if(created)return;created=true;document.querySelector('#create').disabled=true;status.textContent='Creating';
 const response=await fetch('./SDK-OPTIONS.json');requireActive();if(!response.ok)throw Error('Options HTTP '+response.status);
 log.options=await response.json();requireActive();receipt();
 const returned=await Avatar.create({...log.options,canvas,autoStart:false});
 if(stopped){returned.dispose();log.retirement.lateDisposal=returned.report().disposal;receipt();return;}
 owner=returned;await view('front-body','body',0);
}));
for(const [id,name,frame,angle]of[['body','front-body','body',0],['front','front-portrait','portrait',0],['left','left-portrait','portrait',-35],['right','right-portrait','portrait',35]])document.getElementById(id).addEventListener('click',()=>run(()=>view(name,frame,angle)));
receipt();
