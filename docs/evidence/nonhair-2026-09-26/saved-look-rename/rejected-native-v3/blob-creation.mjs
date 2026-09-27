// Capture-local observer. No fetch, URL replacement/revocation or loader mutation.
// Self-contained function is installed before the original page module.
export function installBlobCreationObserver(scope=globalThis){
 const ensure=(yes,message)=>{if(!yes)throw Error(message);},owner=scope.URL,descriptor=Object.getOwnPropertyDescriptor(owner,'createObjectURL'),original=descriptor?.value;
 ensure(typeof original==='function'&&original.length===1&&descriptor.configurable,'Unexpected native createObjectURL descriptor');
 const proto=scope.Blob.prototype,arrayBuffer=Object.getOwnPropertyDescriptor(proto,'arrayBuffer')?.value,size=Object.getOwnPropertyDescriptor(proto,'size')?.get,type=Object.getOwnPropertyDescriptor(proto,'type')?.get,subtle=scope.crypto.subtle,digest=subtle.digest;
 ensure(typeof arrayBuffer==='function'&&typeof size==='function'&&typeof type==='function'&&typeof digest==='function','Missing Blob/hash intrinsics');
 const state={status:'active',records:[],errors:[]},pending=[];
 const same=(a,b)=>a&&b&&Reflect.ownKeys(a).length===Reflect.ownKeys(b).length&&Reflect.ownKeys(a).every(k=>Object.is(a[k],b[k]));
 const message=error=>{try{return String(error);}catch{return 'Unstringifiable observer/native failure';}};
 const recordError=(kind,error)=>state.errors.push({kind,message:message(error)});
 function createObjectURL(object){
  let result;try{result=Reflect.apply(original,this,arguments);}catch(error){state.records.push({nativeOutcome:'threw',message:message(error)});recordError('native-create',error);throw error;}
  const record={nativeOutcome:'returned',url:result,argumentCount:arguments.length,stack:new Error('Blob creation witness').stack,read:'pending'};state.records.push(record);
  try{record.size=Reflect.apply(size,object,[]);record.type=Reflect.apply(type,object,[]);
   const read=Reflect.apply(arrayBuffer,object,[]);
   pending.push(Promise.resolve(read).then(async bytes=>{ensure(bytes.byteLength===record.size,'Blob read length changed');record.byteLength=bytes.byteLength;const hash=await Reflect.apply(digest,subtle,['SHA-256',bytes]);record.sha256=Array.from(new Uint8Array(hash),x=>x.toString(16).padStart(2,'0')).join('');record.read='complete';}).catch(error=>{record.read='failed';recordError('blob-read',error);}));
  }catch(error){record.read='failed';recordError('blob-observe',error);}
  return result;
 }
 const installed={...descriptor,value:createObjectURL};Object.defineProperty(owner,'createObjectURL',installed);
 const report=()=>structuredClone(state);
 async function finish(){if(state.status==='restored')return report();ensure(state.status==='active','Blob observer already lost ownership');
  let n;do{n=pending.length;await Promise.all(pending);}while(n!==pending.length);
  if(!same(Object.getOwnPropertyDescriptor(owner,'createObjectURL'),installed)){state.status='ownership-lost';recordError('restore','createObjectURL owner/descriptor changed');throw Error('Cannot restore changed createObjectURL owner');}
  Object.defineProperty(owner,'createObjectURL',descriptor);ensure(same(Object.getOwnPropertyDescriptor(owner,'createObjectURL'),descriptor),'Original descriptor was not restored');state.status='restored';return report();
 }
 return Object.freeze({report,finish});
}
