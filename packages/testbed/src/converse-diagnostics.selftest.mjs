/** Offline response-contract cases, including the failures from the real September 13 probes. */
import assert from 'node:assert/strict';
import {LMStudioClient} from '../../core/src/affect/LMStudioClient.js';
import {completionDiagnostic,httpErrorDetail} from '../../core/src/affect/CompletionDiagnostics.js';
import {requestReply,createConversation} from './converse.js';
import {connectionHelp,formatRequestDiagnostic} from './converse-connection.mjs';
import {ANCHOR_SETS} from '../../core/src/affect/ExpressionMap.js';
const primaries=Object.keys(ANCHOR_SETS), good={pleasure:.8,arousal:.6,dominance:.3,primary:'joy',intensity:.8};
const client=(fetchImpl,timeoutMs=4000)=>new LMStudioClient({model:'fixture',primaries,fetchImpl,timeoutMs});
const reply=(fetchImpl,timeoutMs=4000)=>requestReply({endpoint:'/fixture',model:'fixture',messages:[{role:'user',content:'Hello.'}],fetchImpl,timeoutMs});
const envelope=(value,{finish='stop',channel='content',tokens=20,reasoning=0}={})=>({choices:[{finish_reason:finish,message:{[channel]:JSON.stringify(value)}}],usage:{completion_tokens:tokens,completion_tokens_details:{reasoning_tokens:reasoning}}});
let checks=0;
const check=async(name,fn)=>{await fn();checks++;console.log('PASS '+name);};
await check('both paths refuse length before parsing even a valid object, and retain token evidence',async()=>{
 for(const [call,value,limit] of [[f=>client(f).appraise('Hello'),good,200],[reply,{reply:'Hello'},300]]){
  const r=await call(async()=>Response.json(envelope(value,{finish:'length',tokens:limit,reasoning:limit})));
  assert.equal(r.reason,'truncated');assert.equal(r.diagnostic.completionTokens,limit);assert.equal(r.diagnostic.reasoningTokens,limit);assert.equal(r.diagnostic.finishReason,'length');assert.equal(r.diagnostic.tokenLimit,limit);assert.match(connectionHelp(r),/output limit/);
 }
});
await check('content and JSON-in-reasoning remain accepted; arbitrary reasoning prose is never in failure details',async()=>{
 for(const channel of ['content','reasoning_content']){
  assert.equal((await reply(async()=>Response.json(envelope({reply:'Hello'},{channel})))).channel,channel);
  assert.equal((await client(async()=>Response.json(envelope(good,{channel}))).appraise('Hello')).channel,channel);
 }
 const prose='PRIVATE REASONING SENTINEL';
 for(const call of [f=>client(f).appraise('Hello'),reply]){
  const r=await call(async()=>Response.json({choices:[{finish_reason:'stop',message:{reasoning_content:prose}}]}));
  assert.equal(r.reason,'unparseable');assert.equal(JSON.stringify(r).includes(prose),false);
 }
});
await check('distinct 400 bodies survive both paths and warm-up without becoming successful setup',async()=>{
 for(const message of ['Selected model is unavailable.','This model cannot use the requested JSON grammar.']){
  const fetchImpl=async()=>Response.json({error:{message}},{status:400});
  for(const call of [f=>client(f).appraise('Hello'),reply]){
   const r=await call(fetchImpl);assert.equal(r.reason,'http');assert.equal(r.diagnostic.httpStatus,400);assert.match(r.detail,new RegExp(message.replaceAll('.','\\.')));
  }
  const c=createConversation({state:{push(){}},model:'fixture',warmOnConstruction:false,fetchImpl});
  const warm=await c.warmBothSchemas();assert.equal(warm.warmed,false);assert.ok(warm.replyFailure.detail.includes(message));assert.ok(warm.affectFailure.detail.includes(message));
 }
});
await check('truncated affect warm-up is refused and its diagnosis reaches expression fallback without changing state',async()=>{
 const c=createConversation({state:{push(){throw Error('Bad affect must never be applied')}},model:'fixture',warmOnConstruction:false,fetchImpl:async(_,o)=>{
  const name=JSON.parse(o.body).response_format.json_schema.name;
  return Response.json(envelope(name==='reply'?{reply:'Hello'}:good,{finish:name==='reply'?'stop':'length',tokens:200,reasoning:200}));
 }});
 const warm=await c.warmBothSchemas();assert.equal(warm.warmed,false);assert.equal(warm.replyFailure,null);assert.equal(warm.affectFailure.reason,'truncated');
 const a=await c.appraise('Hello');assert.equal(a.applied,false);assert.equal(a.diagnostic.reasoningTokens,200);assert.equal(c.tier2.report().refusals.truncated,1);
});
await check('deadlines actually abort both fetches and preserve the time limit',async()=>{
 let aborted=0;
 const fetchImpl=async(_,o)=>new Promise((resolve,reject)=>o.signal.addEventListener('abort',()=>{aborted++;reject(new DOMException('Aborted','AbortError'));},{once:true}));
 for(const call of [f=>client(f,20).appraise('Hello'),f=>reply(f,20)]){
  const r=await call(fetchImpl);assert.equal(r.reason,'timeout');assert.equal(r.diagnostic.timeoutMs,20);assert.match(connectionHelp(r),/0.02 seconds/);
 }
 assert.equal(aborted,2);
});
await check('error-body read is bounded and cancelled; malformed and unreadable bodies preserve HTTP status',async()=>{
 let reads=0,cancelled=false;
 const body=new ReadableStream({pull(c){reads++;c.enqueue(new TextEncoder().encode('x'.repeat(4096)));},cancel(){cancelled=true;}});
 const detail=await httpErrorDetail(new Response(body,{status:503}));assert.ok(detail.length<=330);assert.equal(cancelled,true);assert.ok(reads<=2);
 for(const text of ['<html>gateway</html>','{"error":',JSON.stringify({unrelated:'secret'})])assert.equal(await httpErrorDetail(new Response(text,{status:400})),'HTTP 400');
 assert.equal(await httpErrorDetail({status:500,text:async()=>{throw Error('Body unavailable')}}),'HTTP 500');
 assert.equal(await httpErrorDetail(Response.json({error:{message:'x'.repeat(2000)}},{status:400})), 'HTTP 400: '+'x'.repeat(320));
});
await check('missing or invalid usage stays unknown; details show finite fields and plain bounded server text',async()=>{
 assert.deepEqual(completionDiagnostic({usage:{completion_tokens:-1,completion_tokens_details:{reasoning_tokens:'200'}}}),{finishReason:null,completionTokens:null,reasoningTokens:null});
 assert.equal(formatRequestDiagnostic({reason:'no-channel',diagnostic:completionDiagnostic({})}).includes('tokens:'),false);
 const markup='<img src=x onerror=alert(1)>';
 const r=await reply(async()=>Response.json({error:markup},{status:400}));assert.ok(formatRequestDiagnostic(r).includes(markup)); // UI must use textContent.
});
await check('schemas, output ceilings, temperature policy, and deadlines remain unchanged',async()=>{
 const requests=[];const fetchImpl=async(_,o)=>{const b=JSON.parse(o.body);requests.push(b);return Response.json(envelope(b.response_format.json_schema.name==='reply'?{reply:'Hello'}:good));};
 const a=await client(fetchImpl).appraise('Hello'),r=await reply(fetchImpl);
 assert.equal(a.ok,true);assert.equal(r.ok,true);assert.equal(a.diagnostic.timeoutMs,4000);assert.equal(r.diagnostic.timeoutMs,4000);
 assert.deepEqual(requests.map(r=>[r.response_format.type,r.response_format.json_schema.strict,r.max_tokens]),[['json_schema',true,200],['json_schema',true,300]]);
 assert.equal(requests[0].temperature,.2);assert.equal('reasoning' in requests[0],false);assert.equal('reasoning' in requests[1],false);
});
await check('known HTTP rejection survives an error-body deadline and remains visible',async()=>{
 for(const call of [f=>client(f,20).appraise('Hello'),f=>reply(f,20)]){
  let aborted=false;
  const r=await call(async(_,options)=>new Response(new ReadableStream({start(c){options.signal.addEventListener('abort',()=>{aborted=true;c.error(new DOMException('Body deadline','AbortError'));},{once:true});}}),{status:503}));
  assert.equal(aborted,true);assert.equal(r.reason,'http');assert.equal(r.diagnostic.httpStatus,503);assert.match(formatRequestDiagnostic(r),/HTTP 503/);assert.match(connectionHelp(r),/rejected/);
 }
});
await check('schema and unknown-primary failures never reproduce invalid model values from either channel',async()=>{
 const sentinel='SYNTHETIC REASONING SENTINEL';
 for(const channel of ['content','reasoning_content'])for(const [call,value] of [[reply,{reply:{analysis:sentinel}}],[f=>client(f).appraise('Hello'),{...good,pleasure:sentinel}],[f=>client(f).appraise('Hello'),{...good,primary:sentinel}]]){
  const r=await call(async()=>Response.json(envelope(value,{channel})));assert.equal(r.ok,false);assert.equal(JSON.stringify(r).includes(sentinel),false);assert.equal(formatRequestDiagnostic(r).includes(sentinel),false);
 }
});
await check('malformed HTTP-200 envelopes are distinct from socket failures and do not expose body text',async()=>{
 for(const call of [f=>client(f).appraise('Hello'),reply]){
  const r=await call(async()=>new Response('SYNTHETIC SERVER BODY',{status:200}));assert.equal(r.reason,'invalid-response');assert.equal(r.diagnostic.httpStatus,200);assert.equal(JSON.stringify(r).includes('SYNTHETIC SERVER BODY'),false);assert.doesNotMatch(connectionHelp(r),/Cannot reach/);
  const socket=await call(async()=>{throw new TypeError('Connection refused')});assert.equal(socket.reason,'transport');
 }
});
console.log(`PASS ${checks} diagnostic contract groups`);
