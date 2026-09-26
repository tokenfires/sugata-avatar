// Capture-local ownership only. This does not change production startup or any material.
export const BOOT_FRAME = 999999; // The existing static capture subsequently resets to 1000000.
const fail = (ok, message) => { if (!ok) throw new Error(`Showcase boot hold: ${message}`); };
const clone = value => structuredClone(value);
const sameDescriptor = (a,b) => a === b || Boolean(a && b && Reflect.ownKeys(a).length === Reflect.ownKeys(b).length && Reflect.ownKeys(a).every(k=>a[k]===b[k]));
const frame = stage => {
 const r=stage.renderer,n=r._nodes.nodeFrame;
 return {frameId:n.frameId,renderId:n.renderId,time:n.time,deltaTime:n.deltaTime,rendererFrame:r.info.frame,
  temporal:stage.temporal?.frameEpoch()??null,callbackCleared:r._animation.getAnimationLoop()===null,animationStopped:r._animation._requestId===null};
};
/** Install before the original Showcase entry executes. Exactly one fresh native owner per page.
 * admitReady restores owned descriptors before another capture instrument can install its draw hook.
 * The native factory owns construction rejection; a resolved but still unpublished owner is retired if this wrapper rejects it.
 */
export function installShowcaseBootHold({Stage,Avatar}) {
 fail(typeof Stage==='function'&&typeof Avatar==='function','actual native constructors required');
 const stageDescriptor=Object.getOwnPropertyDescriptor(Stage.prototype,'create');
 const avatarDescriptor=Object.getOwnPropertyDescriptor(Avatar,'create');
 const nativeDispose=Object.getOwnPropertyDescriptor(Avatar.prototype,'dispose')?.value;
 fail(typeof nativeDispose==='function','native Avatar disposal method required');
 fail(typeof stageDescriptor?.value==='function'&&stageDescriptor.writable&&stageDescriptor.configurable,'Stage.create descriptor changed');
 fail(typeof avatarDescriptor?.value==='function'&&avatarDescriptor.writable&&avatarDescriptor.configurable,'Avatar.create descriptor changed');
 fail(stageDescriptor.value.length===1&&avatarDescriptor.value.length===0,'native create signature changed');
 const receipt={kind:'capture-only-showcase-no-boot-beauty-v1',bootFrame:BOOT_FRAME,phase:'installed',draws:[],stage:null,avatar:null,ready:null,restorations:[],failure:null,
  scope:'Stage.draw census only. Native PMREM/offscreen initialization remains outside this census. No production cadence or total GPU-submission claim.'};
 let stage=null,avatar=null,drawDescriptor,drawWrapper,avatarEntered=false,stageEntered=false,closed=false,unpublishedNativeOwner=false,unpublishedRetirementAttempted=false;
 const owned=[];
 function own(object,key,descriptor){Object.defineProperty(object,key,descriptor);owned.push({object,key,descriptor,original:key==='create'?(object===Avatar?avatarDescriptor:stageDescriptor):drawDescriptor});}
 function restore(){
  const errors=[];
  for(const item of [...owned].reverse()){
   if(item.restored)continue;
   if(!sameDescriptor(Object.getOwnPropertyDescriptor(item.object,item.key),item.descriptor)){errors.push(new Error(`Owned ${item.key} descriptor changed; refusing to overwrite`));continue;}
   try{if(item.original)Object.defineProperty(item.object,item.key,item.original);else delete item.object[item.key];item.restored=true;receipt.restorations.push(item.object===Avatar?'Avatar.create':item.object===Stage.prototype?'Stage.create':'owned Stage.draw');}catch(e){errors.push(e);}
  }
  if(errors.length)throw new AggregateError(errors,'Showcase boot hold restoration failed');
  closed=true;
 }
 function failed(error){receipt.failure=String(error);receipt.phase='failed';try{restore();}catch(cleanup){throw new AggregateError([error,cleanup],'Showcase boot hold and restoration failed');}throw error;}
 async function createStage(canvas,...rest){
  const args=Array.from(arguments);
  try{
   fail(!closed&&avatarEntered&&!stageEntered,'one Stage inside the owned Avatar.create required');
   stageEntered=true;stage=this;fail(this instanceof Stage,'foreign Stage receiver');
   fail(args[0]===receiptCanvas,'Stage canvas differs from native Avatar request');
   drawDescriptor=Object.getOwnPropertyDescriptor(this,'draw');
   const draw=this.draw;fail(typeof draw==='function'&&draw.length===0,'native Stage.draw signature changed');
   drawWrapper=function(...drawArgs){fail(this===stage,'foreign draw receiver');receipt.draws.push({frame:frame(stage),avatarPublished:avatar!==null,clock:avatar?.clockSeconds??null});return Reflect.apply(draw,this,drawArgs);};
   own(this,'draw',{value:drawWrapper,writable:true,configurable:true,enumerable:drawDescriptor?.enumerable??false});
   const result=await Reflect.apply(stageDescriptor.value,this,args);
   fail(result===this,'native Stage.create return changed');
   fail(receipt.draws.length===0,'Stage.draw occurred before the startup hold');
   const r=this.renderer,n=r?._nodes?.nodeFrame;
   fail(r?._initialized===true&&n&&typeof r._animation?.stop==='function','initialized native renderer clock required');
   receipt.stage={before:frame(this)};
   // setAnimationLoop clears its callback synchronously on this already initialized renderer.
   // Stop the underlying RAF immediately, before the await can yield to later application work.
   const clear=r.setAnimationLoop(null);r._animation.stop();await clear;
   fail(r._animation.getAnimationLoop()===null&&r._animation._requestId===null,'native callback/RAF stop failed');
   fail(Number.isInteger(n.frameId)&&n.frameId>=0&&n.frameId<BOOT_FRAME,'unexpected pre-capture node epoch');
   n.frameId=BOOT_FRAME;n.time=0;n.deltaTime=0;n.lastTime=undefined;r.info.frame=BOOT_FRAME;
   receipt.stage.held=frame(this);receipt.phase='stage-held';
   return result;
  }catch(error){return failed(error);}
 }
 let receiptCanvas;
 function retireUnpublished(){
  if(!unpublishedNativeOwner||unpublishedRetirementAttempted)return;
  unpublishedRetirementAttempted=true;
  const r=avatar?.stage?.renderer;
  const retired=receipt.unpublishedRetirement={attempted:true,alreadyDisposed:avatar?.disposed===true,disposed:false,error:null};
  try{
   fail(avatar instanceof Avatar,'resolved foreign owner cannot be retired as a native Avatar');
   if(!retired.alreadyDisposed)Reflect.apply(nativeDispose,avatar,[]);
   fail(avatar.disposed===true,'unpublished native owner was not disposed');
  }catch(error){retired.error=String(error);throw error;}
  finally{retired.disposed=avatar?.disposed===true;retired.memory=r?.info?.memory?clone(r.info.memory):null;}
 }
 async function createAvatar(...args){
  try{
   fail(!closed&&!avatarEntered,'one fresh Avatar.create required');
   fail(args[0]?.autoStart===false,'explicit native autoStart:false required');
   avatarEntered=true;receiptCanvas=args[0].canvas;
   const result=await Reflect.apply(avatarDescriptor.value,this,args);
   avatar=result;unpublishedNativeOwner=true;
   fail(stageEntered&&result?.stage===stage,'native Avatar/Stage ownership mismatch');
   avatar=result;fail(!avatar.disposed&&avatar.clockSeconds===0,'fresh native Avatar clock required');
   fail(receipt.draws.length===0,'Stage.draw occurred before native Avatar.create resolved');
   fail(stage.draw===drawWrapper,'owned draw observer replaced during construction');
   const observed=frame(stage);fail(observed.callbackCleared&&observed.animationStopped,'startup restarted renderer animation');
   fail(observed.frameId===BOOT_FRAME&&observed.time===0&&observed.deltaTime===0,'startup advanced the held node clock');
   receipt.avatar={draws:0,clock:avatar.clockSeconds,frame:observed};receipt.phase='avatar-ready';
   unpublishedNativeOwner=false;return result;
  }catch(error){
   if(unpublishedNativeOwner)receipt.nativePostcheckFailure=String(error);
   let primary=error;try{retireUnpublished();}catch(cleanup){primary=new AggregateError([error,cleanup],'Showcase boot postcheck and unpublished native retirement failed');}
   return failed(primary);
  }
 }
 try{
  own(Stage.prototype,'create',{...stageDescriptor,value:createStage});
  own(Avatar,'create',{...avatarDescriptor,value:createAvatar});
 }catch(error){return failed(error);}
 return Object.freeze({
  receipt:()=>clone(receipt),
  admitReady(showcase){
   try{
    fail(!closed&&receipt.phase==='avatar-ready','native Avatar must resolve before ready admission');
    fail(showcase?.avatar===avatar&&avatar.stage===stage&&!avatar.disposed,'published Showcase owner differs');
    fail(receipt.draws.length===1,'exactly one original Showcase ready Stage.draw required');
    fail(receipt.draws[0].avatarPublished&&receipt.draws[0].clock===0,'ready draw must follow native Avatar.create with zero motion time');
    fail(avatar.clockSeconds===0,'Showcase ready step advanced motion time');
    const observed=frame(stage);fail(observed.frameId===BOOT_FRAME&&observed.time===0&&observed.deltaTime===0&&observed.callbackCleared&&observed.animationStopped,'ready page changed held renderer clock');
    const ready={draws:1,clock:avatar.clockSeconds,frame:observed};restore();receipt.ready=ready;receipt.phase='admitted';return clone(receipt);
   }catch(error){return failed(error);}
  },
  restoreForRetirement(){restore();if(receipt.phase!=='admitted'&&receipt.phase!=='failed')receipt.phase='retired';return clone(receipt);}
 });
}
