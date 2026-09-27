// Diagnostic only: auxiliary handlers preserve original promise identity but can
// alter unhandled-rejection bookkeeping. No stream/controller/signal retention.
export function installTransportObserver(scope=globalThis){
 const ensure=(yes,message)=>{if(!yes)throw Error(message);},message=e=>{try{return String(e);}catch{return 'Unstringifiable failure';}},same=(a,b)=>a&&b&&Reflect.ownKeys(a).length===Reflect.ownKeys(b).length&&Reflect.ownKeys(a).every(k=>Object.is(a[k],b[k]));
 const state={status:'active',calls:[],errors:[],restoration:[]},pending=[],ids=new WeakMap();let nextID=0;
 const now=()=>scope.performance.now(),subtle=scope.crypto.subtle,digest=subtle.digest,id=value=>{if((typeof value!=='object'||value===null)&&typeof value!=='function')return null;if(!ids.has(value))ids.set(value,++nextID);return ids.get(value);};
 const specs=[['abort',scope.AbortController.prototype,'abort'],['stream-cancel',scope.ReadableStream.prototype,'cancel'],['reader-cancel',scope.ReadableStreamDefaultReader.prototype,'cancel'],['reader-read',scope.ReadableStreamDefaultReader.prototype,'read'],['response-arrayBuffer',scope.Response.prototype,'arrayBuffer']].map(([kind,owner,key])=>{const original=Object.getOwnPropertyDescriptor(owner,key);ensure(typeof original?.value==='function'&&original.value.length===0&&original.configurable,'Unexpected native method: '+kind);return{kind,owner,key,original};});
 const error=(kind,e)=>state.errors.push({kind,message:message(e)});
 for(const spec of specs){spec.proxy=new Proxy(spec.original.value,{apply(target,receiver,args){
  const record={kind:spec.kind,receiverID:id(receiver),at:now(),argumentCount:args.length,stack:new Error('Transport call').stack};state.calls.push(record);
  let result;try{result=Reflect.apply(target,receiver,args);}catch(e){record.outcome='threw';record.error=message(e);throw e;}
  record.returnedAt=now();record.outcome='returned';
  if(spec.kind==='abort')return result;
  try{ensure(result&&typeof result.then==='function','Native method did not return a promise');
   // Helper arguments deliberately contain no receiver/stream/controller/signal.
   observe(result,record);
  }catch(e){error('attach-observation',e);}
  return result;
 }});spec.installed={...spec.original,value:spec.proxy};}
 function observe(promise,record){const job=promise.then(value=>{
  record.settledAt=now();record.settlement='fulfilled';
  if(record.kind==='reader-read'){record.done=value.done;record.byteLength=value.value===undefined?0:value.value.byteLength;ensure(typeof record.done==='boolean'&&Number.isSafeInteger(record.byteLength)&&record.byteLength>=0,'Unclassifiable reader result');}
  if(record.kind==='response-arrayBuffer'){ensure(value instanceof scope.ArrayBuffer,'Native arrayBuffer result type changed');record.byteLength=value.byteLength;record.prefixHex=Array.from(new Uint8Array(value,0,Math.min(12,value.byteLength)),x=>x.toString(16).padStart(2,'0')).join('');return Reflect.apply(digest,subtle,['SHA-256',value]).then(hash=>{record.sha256=Array.from(new Uint8Array(hash),x=>x.toString(16).padStart(2,'0')).join('');record.hashAt=now();});}
 },e=>{record.settledAt=now();record.settlement='rejected';record.error=message(e);}).catch(e=>error('result-observation',e));pending.push(job);}
 const installed=[];try{for(const spec of specs){Object.defineProperty(spec.owner,spec.key,spec.installed);installed.push(spec);}}catch(e){for(const spec of installed.reverse())if(same(Object.getOwnPropertyDescriptor(spec.owner,spec.key),spec.installed))Object.defineProperty(spec.owner,spec.key,spec.original);throw e;}
 const report=()=>structuredClone(state);
 async function finish(){if(state.status==='restored')return report();ensure(state.status==='active','Transport observer already lost ownership');let n;do{n=pending.length;await Promise.all(pending);}while(n!==pending.length);let lost=false;
  for(const spec of specs){if(!same(Object.getOwnPropertyDescriptor(spec.owner,spec.key),spec.installed)){lost=true;state.restoration.push({kind:spec.kind,restored:false});error('restore','Changed '+spec.kind+' owner');continue;}Object.defineProperty(spec.owner,spec.key,spec.original);const restored=same(Object.getOwnPropertyDescriptor(spec.owner,spec.key),spec.original);state.restoration.push({kind:spec.kind,restored});if(!restored){lost=true;error('restore','Descriptor mismatch '+spec.kind);}}
  state.status=lost?'ownership-lost':'restored';ensure(!lost,'Transport observer lost method ownership');return report();
 }
 return Object.freeze({report,finish});
}
