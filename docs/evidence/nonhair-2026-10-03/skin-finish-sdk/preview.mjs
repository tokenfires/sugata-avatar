import { Avatar } from '../../../../packages/core/src/Avatar.js';
const canvas=document.querySelector('canvas'),status=document.querySelector('#status'),state=document.querySelector('#state');
const log={createdAt:new Date().toISOString(),recipe:null,recipeSHA256:null,states:[],retirements:[],rebuild:null,failure:null,complete:false,limits:['One literal original and reduced-sheen SDK creation; one same-bake rebuild.','Public request/report/step/setIdentity drive the result; UUID and dispose event are read-only source instruments.','Static Neutral Studio only; no room/motion/body breadth, preference across scenes, physical calibration, allocator/network/served-byte or in-pass jitter proof.']};
let owner=null,busy=false,stopped=false,runUsed=false;
const publish=()=>state.textContent=JSON.stringify(log,null,2);
const same=(a,b,label)=>{if(JSON.stringify(a)!==JSON.stringify(b))throw Error(label+' mismatch');};
const active=()=>{if(stopped)throw Error('Study retired during pending acquisition');};
function retireOwner(reason){
 const a=owner;if(!a)return;owner=null;
 const record={reason,at:new Date().toISOString(),error:null,disposal:null,skinAfter:null};log.retirements.push(record);
 try{a.dispose();}catch(e){record.error=String(e.stack??e);}
 record.disposal=a.report().disposal;record.skinAfter=a.report().skin;publish();
 if(record.error||!record.disposal.disposed||record.disposal.leaked.length||record.skinAfter.attached||record.skinAfter.clearcoat!==null)throw Error('Owner retirement failed');
}
function stop(reason){
 if(stopped)return;stopped=true;document.querySelector('#run').disabled=true;
 try{retireOwner(reason);}catch(e){log.retirementFailure=String(e.stack??e);}
 status.textContent=log.failure?'Stopped: '+log.failure.message:'Retired';publish();
}
addEventListener('pagehide',()=>stop('pagehide'),{once:true});document.querySelector('#retire').addEventListener('click',()=>stop('manual'));
function validate(r,finish){
 same(r.quality.backend,'webgpu','backend');same(r.quality.backendMismatch,false,'backend compatibility');same(r.quality.requested,'balanced','quality request');same(r.quality.tier,'balanced','quality');
 same(owner.clockSeconds,0,'static clock');same(r.identity.bake,'figure_g050','bake');same(r.identity.gender,.5,'gender');
 same(r.hair.attached,true,'hair owner');same(r.hair.loadedStyle,'bob02','hair');same(r.hair.colour.applied,log.recipe.hairColour,'base');same(r.hair.colour.matchesAttached,true,'base owner');same(r.hair.colour.requestedTint,log.recipe.hairTint,'requested tint');same(r.hair.colour.appliedTint,log.recipe.hairTint,'tint owner');
 same(r.wardrobe.attached,true,'wardrobe');same(r.wardrobe.pendingCandidates,0,'wardrobe pending');same(r.wardrobe.lastError,null,'wardrobe error');
 same([...r.wardrobe.state.worn].sort(),[...log.recipe.wardrobe.outfit,...Object.values(log.recipe.wardrobe.foundation)].sort(),'worn IDs');
 same(r.wardrobe.appearance.attached,true,'wardrobe appearance owner');same(r.wardrobe.appearance.style,log.recipe.wardrobe.style,'wardrobe style');same(r.wardrobe.appearance.colours,log.recipe.wardrobe.colours,'wardrobe colours');
 same(r.framing.mode,'portrait','framing');same(r.scene.id,'studio','scene');same(r.scene.lighting.look,'neutral','lighting');same(r.scene.lighting.calibrated,false,'calibration exclusion');same(r.motion.seed,20260807,'seed');same(r.disposal.disposed,false,'live owner');
 same(r.skin,{requestedFinish:finish,attached:true,clearcoat:finish==='original'?.34:.12,clearcoatRoughness:.24,settings:{secondLobeWeight:finish==='original'?.34:.12,secondLobeRoughness:.24}},'actual skin owner/fields/settings');
}
async function capture(name,finish){
 active();const a=owner;
 for(let i=0;i<32;i++){active();await a.step(0);}
 active();const before=a.report();
 const camera={position:a.stage.camera.position.toArray(),matrix:a.stage.camera.matrixWorld.toArray(),projection:a.stage.camera.projectionMatrix.toArray()};
 const item={name,at:new Date().toISOString(),before,after:null,clockSeconds:a.clockSeconds,camera,canvas:{width:canvas.width,height:canvas.height},skinUUID:a.skin?.uuid??null,bodyMaterialUUID:a.figure?.body?.material?.uuid??null,complete:false};log.states.push(item);publish();validate(before,finish);
 const data=canvas.toDataURL('image/png');item.after=a.report();validate(item.after,finish);same(item.after.skin,before.skin,'skin before/after encoding');
 const link=document.querySelector('#'+name);link.href=data;link.download=name+'.png';link.hidden=false;item.complete=true;publish();
}
async function create(finish){
 active();const options={...log.recipe,canvas,autoStart:false,...(finish==='original'?{}:{skinFinish:finish})};
 log.requests??=[];log.requests.push({at:new Date().toISOString(),options:{...log.recipe,autoStart:false,...(finish==='original'?{}:{skinFinish:finish})}});publish();
 const returned=await Avatar.create(options);
 if(stopped){
  const row={reason:'late-return',at:new Date().toISOString(),disposal:null,error:null};log.retirements.push(row);
  try{returned.dispose();row.disposal=returned.report().disposal;}catch(e){row.error=String(e.stack??e);}publish();return false;
 }
 owner=returned;const report=owner.report();log.creations??=[];log.creations.push({at:new Date().toISOString(),finish,report,skinUUID:owner.skin?.uuid??null,bodyMaterialUUID:owner.figure?.body?.material?.uuid??null});publish();validate(report,finish);return true;
}
document.querySelector('#run').addEventListener('click',async()=>{
 if(busy||stopped||runUsed)return;busy=true;runUsed=true;document.querySelector('#run').disabled=true;status.textContent='Running serialized SDK proof';
 try{
  const response=await fetch('../../../../looks/sage-lavender-chin.json');active();if(!response.ok)throw Error('Recipe HTTP '+response.status);
  const bytes=await response.arrayBuffer();active();log.recipeSHA256=[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(x=>x.toString(16).padStart(2,'0')).join('');active();
  same(log.recipeSHA256,'09c1220b64c291935088ed731f68315b44557d4b323a38d6417403c863e1e978','literal recipe bytes');log.recipe=JSON.parse(new TextDecoder().decode(bytes));publish();
  if(!await create('original'))return;await capture('original','original');retireOwner('before-reduced');
  if(!await create('reduced-sheen'))return;await capture('reduced','reduced-sheen');
  active();const old=owner.skin;let disposedEvents=0;const disposed=()=>disposedEvents++;old.addEventListener('dispose',disposed);
  log.rebuild={startedAt:new Date().toISOString(),beforeSkinUUID:old.uuid,before:owner.report(),disposeEvents:0,after:null,complete:false};publish();
  try{await owner.setIdentity({gender:.5,mode:'nearest'});}finally{old.removeEventListener('dispose',disposed);log.rebuild.disposeEvents=disposedEvents;publish();}
  active();log.rebuild.after=owner.report();log.rebuild.afterSkinUUID=owner.skin.uuid;validate(log.rebuild.after,'reduced-sheen');
  same(disposedEvents,1,'old skin disposal event');if(owner.skin.uuid===old.uuid)throw Error('Same-bake rebuild did not replace material');
  log.rebuild.complete=true;await capture('rebuilt','reduced-sheen');retireOwner('proof-complete');
  active();log.complete=true;status.textContent='Complete: three SDK portraits, all owners retired';publish();
 }catch(e){log.failure={at:new Date().toISOString(),message:String(e.stack??e)};stop('failure');}
 finally{busy=false;log.pending=false;publish();}
});publish();
