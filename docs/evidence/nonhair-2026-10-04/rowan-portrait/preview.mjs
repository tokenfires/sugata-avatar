import { Avatar } from '../../../../packages/core/src/Avatar.js';
const canvas=document.querySelector('canvas'),status=document.querySelector('#status'),state=document.querySelector('#state');
const create=document.querySelector('#create'),quarter=document.querySelector('#quarter');
const log={createdAt:new Date().toISOString(),recipe:null,recipeSHA256:null,creation:null,composition:null,views:[],failure:null,retirement:null,pending:false,limits:['Fixed g100/Long bob portrait screening, no endpoint wardrobe or body-axis qualification.','No endpoint hair/body-contact calibration or motion/fit/AAA/human-attractiveness claim.','Native page JPEGs qualify only actual captured static context; no PNG/export, pixel/phase/served-byte/allocator or convergence claim.']};
let owner=null,used=false,quarterUsed=false,busy=false,stopped=false;
const publish=()=>state.textContent=JSON.stringify(log,null,2);
const active=()=>{if(stopped)throw Error('Portrait retired during pending work');};
function retire(reason){
 if(stopped)return;stopped=true;create.disabled=true;quarter.disabled=true;
 log.retirement={reason,at:new Date().toISOString(),pendingAtRetirement:busy,error:null,disposal:null};
 try{if(owner){const a=owner;owner=null;a.dispose();log.retirement.disposal=a.report().disposal;}}
 catch(e){log.retirement.error=String(e.stack??e);}
 status.textContent=log.failure?'Stopped: '+log.failure.message:'Retired';publish();
}
addEventListener('pagehide',()=>retire('pagehide'),{once:true});
document.querySelector('#retire').addEventListener('click',()=>retire('manual'));
function validate(r){
 const same=(a,b,name)=>{if(JSON.stringify(a)!==JSON.stringify(b))throw Error(name+' mismatch');};
 same(r.quality.backend,'webgpu','backend');same(r.quality.backendMismatch,false,'backend compatibility');
 same(r.quality.requested,'balanced','requested quality');same(r.quality.tier,'balanced','resolved quality');
 same(r.identity.gender,1,'gender');same(r.identity.bake,'figure_g100','body bake');
 same(r.hair?.attached,true,'hair owner');same(r.hair?.loadedStyle,'bob01','groom');same(r.hair?.bake,'figure_g100','groom bake');
 same(r.hair?.colour.applied,'#2f251f','applied colour');same(r.hair?.colour.matchesAttached,true,'colour owner');
 same(r.hair?.colour.requestedTint,null,'requested tint');same(r.hair?.colour.appliedTint,null,'applied tint');
 same(r.wardrobe,null,'explicit wardrobe off');same(r.framing.mode,'portrait','framing');same(r.framing.heightMetres,.55,'portrait height');
 same(r.scene.id,'studio','scene');same(r.scene.lighting.look,'neutral','lighting');same(r.motion.seed,20260807,'seed');
 same(owner.clockSeconds,0,'static clock');same(r.disposal.disposed,false,'live owner');
}
async function view(name,degrees){
 active();const a=owner,target=a.focus.clone();target.y+=.045;
 const distance=log.composition.distanceMetres,angle=degrees*Math.PI/180;
 a.stage.camera.position.set(target.x+Math.sin(angle)*distance,target.y,target.z+Math.cos(angle)*distance);
 a.stage.camera.lookAt(target);
 for(let i=0;i<32;i++){active();await a.step(0);}
 active();const r=a.report();
 const row={name,degrees,at:new Date().toISOString(),report:r,clockSeconds:a.clockSeconds,canvas:{width:canvas.width,height:canvas.height,cssWidth:canvas.clientWidth,cssHeight:canvas.clientHeight},camera:{target:target.toArray(),position:a.stage.camera.position.toArray(),matrix:a.stage.camera.matrixWorld.toArray(),projection:a.stage.camera.projectionMatrix.toArray()},complete:false};
 log.views.push(row);publish();validate(r);row.complete=true;status.textContent='Ready: '+name;publish();
}
async function run(fn){
 if(busy||stopped)return;busy=true;log.pending=true;quarter.disabled=true;publish();
 try{await fn();}catch(e){log.failure={at:new Date().toISOString(),message:String(e.stack??e)};retire('failure');}
 finally{busy=false;log.pending=false;if(owner&&!stopped&&!quarterUsed)quarter.disabled=false;publish();}
}
create.addEventListener('click',()=>run(async()=>{
 if(used)return;used=true;create.disabled=true;status.textContent='Creating one owner';
 const response=await fetch('./ROWAN.json');active();if(!response.ok)throw Error('Recipe HTTP '+response.status);
 const bytes=await response.arrayBuffer();active();log.recipe=JSON.parse(new TextDecoder().decode(bytes));
 log.recipeSHA256=[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(x=>x.toString(16).padStart(2,'0')).join('');active();publish();
 const a=await Avatar.create({...log.recipe,canvas});
 if(stopped){
  const late={at:new Date().toISOString(),error:null,disposal:null};log.lateRetirement=late;
  try{a.dispose();late.disposal=a.report().disposal;}catch(e){late.error=String(e.stack??e);}publish();return;
 }
 owner=a;log.creation={at:new Date().toISOString(),report:a.report(),camera:{position:a.stage.camera.position.toArray(),matrix:a.stage.camera.matrixWorld.toArray(),projection:a.stage.camera.projectionMatrix.toArray(),target:a.focus.toArray()},canvas:{width:canvas.width,height:canvas.height,cssWidth:canvas.clientWidth,cssHeight:canvas.clientHeight}};
 log.composition={sourceFocus:a.focus.toArray(),distanceMetres:a.stage.camera.position.distanceTo(a.focus),offsetY:.045,anglesDegrees:[0,35]};
 publish();validate(log.creation.report);await view('front',0);
}));
quarter.addEventListener('click',()=>run(async()=>{if(quarterUsed)return;quarterUsed=true;await view('three-quarter',35);}));
publish();
