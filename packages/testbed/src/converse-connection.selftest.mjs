import assert from 'node:assert/strict';
import { discoverModels } from './converse-connection.mjs';
let checks = 0;
const check = async (name, fn) => { await fn(); checks++; console.log('PASS ' + name); };
await check('discovery only reads the model list and preserves exact IDs without selecting a default', async () => {
 let observed;
 const result = await discoverModels({endpoint:'/lmstudio/',fetchImpl:async (url, options) => {observed={url,options};return {ok:true,json:async()=>({data:[{id:'chat/a'},{id:'chat/b'},{id:'chat/a'},{id:''},{no:'id'}]})};}});
 assert.deepEqual(result,{ok:true,models:['chat/a','chat/b']});assert.equal(observed.url,'/lmstudio/v1/models');assert.equal(observed.options.method,undefined);assert.equal(observed.options.body,undefined);
});
await check('reachable empty server is distinct from an unavailable server', async()=>{
 assert.deepEqual(await discoverModels({endpoint:'/lmstudio',fetchImpl:async()=>({ok:true,json:async()=>({data:[]})})}),{ok:true,models:[]});
 const r=await discoverModels({endpoint:'/lmstudio',fetchImpl:async()=>({ok:false,status:503})});assert.equal(r.reason,'http');assert.equal(r.detail,'HTTP 503');
});
await check('HTML gateway and malformed JSON cannot be presented as a successful model list',async()=>{
 for(const json of [async()=>{throw Error('Unexpected HTML');},async()=>({choices:[]})]) {const r=await discoverModels({endpoint:'/lmstudio',fetchImpl:async()=>({ok:true,json})});assert.equal(r.ok,false);}
});
await check('a failed local connection is recoverable',async()=>{
 const r=await discoverModels({endpoint:'/lmstudio',fetchImpl:async()=>{throw Error('connection refused');}});assert.equal(r.reason,'transport');
});
await check('the discovery deadline aborts an unresponsive fetch',async()=>{
 const r=await discoverModels({endpoint:'/lmstudio',timeoutMs:5,fetchImpl:async(_,{signal})=>new Promise((resolve,reject)=>signal.addEventListener('abort',()=>reject(new DOMException('Aborted','AbortError'))))});assert.equal(r.reason,'timeout');
});
console.log(`PASS ${checks} connection behavior groups`);
