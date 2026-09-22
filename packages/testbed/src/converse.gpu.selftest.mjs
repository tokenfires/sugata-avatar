/** Real WebGPU/UI with controlled LM Studio responses. Never sends inference to a real model. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {startProbeServer,launchProbeBrowser} from '../../core/src/render/MotionProbe.mjs';
const root=fileURLToPath(new URL('../../../',import.meta.url));
const out=process.argv.find(a=>a.startsWith('--out='))?.slice(6)??path.join(root,'captures/converse-resume-2026-09-13');
fs.mkdirSync(out,{recursive:true});
const report={date:new Date().toISOString(),checks:[],errors:[],requests:[],views:[],limits:['Real Avatar and WebGPU rendering; all completion responses are controlled fixtures, not evidence of live model quality or latency.','Initial model discovery uses the actual local read-only proxy. Subsequent outage, selection and reply cases use controlled server responses.','No real speech audio, microphone or lip-sync alignment is implemented.']};
const save=()=>fs.writeFileSync(path.join(out,'browser-report.json'),JSON.stringify(report,null,2)+'\n');
const check=(name,fn)=>{fn();report.checks.push(name);save();console.log('PASS '+name);};
let browser,server,page,mode='normal';
const liveDiscovery=process.argv.includes('--live-discovery');
report.liveDiscovery=liveDiscovery;
report.limits[1]=liveDiscovery ? report.limits[1] : 'All model discovery and completion responses use controlled local fixtures; no LM Studio service is needed.';
try{
 server=await startProbeServer({port:5291});browser=await launchProbeBrowser();page=await browser.newPage({viewport:{width:1440,height:960},deviceScaleFactor:1});
 page.on('pageerror',e=>report.errors.push(e.message));
 page.on('console',m=>{if(m.type()==='error'&&!m.text().includes('status of 503'))report.errors.push(m.text());});
 await page.route('**/v1/chat/completions',async route=>{
  const req=route.request().postDataJSON();report.requests.push({model:req.model,schema:req.response_format?.json_schema?.name,lastMessage:req.messages.at(-1)?.content});
  if(mode==='reply-failure')return route.fulfill({status:503,contentType:'application/json',body:'{"error":"controlled unavailability"}'});
  const schema=req.response_format.json_schema.name;
  if(mode==='invalid-response-'+schema)return route.fulfill({status:200,contentType:'text/plain',body:'PRIVATE SERVER BODY SENTINEL'});
  if(mode==='invalid-value-'+schema)return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({choices:[{finish_reason:'stop',message:{reasoning_content:JSON.stringify(schema==='reply'?{reply:{analysis:'PRIVATE REASONING SENTINEL'}}:{pleasure:.8,arousal:.6,dominance:.3,primary:'PRIVATE REASONING SENTINEL',intensity:.8})}}]})});

  if(mode==='timeout-'+schema){await new Promise(resolve=>setTimeout(resolve,4500));await route.abort().catch(()=>{});return;}
  if(mode==='http-grammar'||mode==='http-model'||mode==='markup-error')return route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:{message:mode==='http-grammar'?'The selected model cannot use this JSON grammar.':mode==='http-model'?'Selected model is unavailable.':'<img src=x onerror="window.__DIAGNOSTIC_INJECTION__=true">'}})});
  if(mode==='truncated-'+schema)return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({choices:[{finish_reason:'length',message:{content:JSON.stringify(schema==='reply'?{reply:'A valid but cutoff reply.'}:{pleasure:.8,arousal:.6,dominance:.3,primary:'joy',intensity:.8})}}],usage:{completion_tokens:req.max_tokens,completion_tokens_details:{reasoning_tokens:req.max_tokens}}})});
  if(mode==='reasoning-prose'&&schema==='reply')return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({choices:[{finish_reason:'stop',message:{reasoning_content:'PRIVATE REASONING SENTINEL'}}]})});

  const value=req.response_format.json_schema.name==='reply'?{reply:'That sounds wonderful, and I am happy to hear it.'}:mode==='invalid-affect'?{unsupported:'not an affect vector'}:{pleasure:.8,arousal:.6,dominance:.3,primary:'joy',intensity:.8};
  await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({choices:[{finish_reason:'stop',message:{[mode==='reasoning-json'?'reasoning_content':'content']:JSON.stringify(value)}}],usage:{completion_tokens:20}})});
 });
 if(!liveDiscovery)await page.route('**/v1/models',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({data:[{id:'fixture-chat-a'},{id:'fixture-chat-b'}]})}));
 await page.goto(server.baseUrl+'/src/converse.html?model=qwen%2Fqwen3.6-35b-a3b');
 await page.waitForFunction(()=>window.__SUGATA_CONVERSE__?.ready,null,{timeout:120000});
 await page.waitForFunction(()=>!document.querySelector('#refresh').disabled);
 const initial=await page.evaluate(()=>({status:document.querySelector('#connection-status').textContent,selected:document.querySelector('#model').value,models:[...document.querySelector('#model').options].map(o=>o.value).filter(Boolean),mouth:document.querySelector('#mouth').checked,sendDisabled:document.querySelector('#send').disabled,avatar:__SUGATA_CONVERSE__.avatar.report()}));
 report.initial=initial;
 check('page boot renders the accepted clothed g050 avatar and sends no inference',()=>{assert.equal(report.requests.length,0);assert.equal(initial.avatar.identity.bake,'figure_g050');assert.equal(initial.avatar.hair.loadedStyle,'bob02');assert.equal(initial.avatar.wardrobe.attached,true);assert.equal(initial.avatar.wardrobe.appearance.attached,true);assert.equal(initial.avatar.wardrobe.appearance.style,'ecru');assert.equal(initial.sendDisabled,true);assert.equal(initial.mouth,false);});
 check('missing requested model stays unselected with an actionable explanation',()=>{assert.equal(initial.selected,'');assert.match(initial.status,/no longer listed/);assert.ok(initial.models.length>0);});
 const shot=async name=>{await page.screenshot({path:path.join(out,name+'.png'),fullPage:true});report.views.push(name+'.png');save();};
 await shot('discovered-desktop');
 let listMode='models';
 await page.route('**/v1/models',route=>route.fulfill({status:listMode==='offline'?503:200,contentType:'application/json',body:JSON.stringify(listMode==='malformed'?{wrong:[]}:{data:listMode==='empty'?[]:[{id:'fixture-chat-a'},{id:'fixture-chat-b'}]})}));
 for(const [next,pattern,state] of [['offline',/Cannot read the model list/,'unavailable'],['empty',/lists no models/,'empty'],['malformed',/Cannot read the model list/,'unavailable'],['models',/no longer listed/,'selection']]){
  listMode=next;await page.locator('#refresh').click();await page.waitForFunction(s=>document.querySelector('#connection-status').dataset.state===s,state);
  const message=await page.locator('#connection-status').textContent();check('model-list recovery: '+next,()=>assert.match(message,pattern));assert.equal(await page.locator('#send').isDisabled(),true);
 }
 await page.locator('#model').selectOption('fixture-chat-a');assert.equal(report.requests.length,0);await page.locator('#connect').click();
 await page.waitForFunction(()=>document.querySelector('#connection-status').dataset.state==='ready');
 check('only explicit Connect warms both schemas with the selected exact model',()=>{assert.equal(report.requests.length,2);assert.ok(report.requests.every(r=>r.model==='fixture-chat-a'));assert.deepEqual(report.requests.map(r=>r.schema).sort(),['affect','reply']);});
 assert.equal(await page.locator('#send').isEnabled(),true);
 await page.locator('#say').fill('I am happy and excited about this!');await page.locator('#send').click();
 await page.waitForFunction(()=>__SUGATA_CONVERSE__.session.turns===1&&!__SUGATA_CONVERSE__.session.busy);
 report.turn=await page.evaluate(()=>({tier:__SUGATA_CONVERSE__.session.tier,transcript:document.querySelector('#transcript').textContent,history:__SUGATA_CONVERSE__.conversation.history,pad:__SUGATA_CONVERSE__.avatar.report().affect.pad}));
 check('controlled reply reaches transcript and tier 2 follows the reply through the real avatar',()=>{assert.equal(report.turn.tier,2);assert.match(report.turn.transcript,/That sounds wonderful/);assert.equal(report.turn.history.length,2);assert.deepEqual(report.requests.slice(-2).map(r=>r.schema),['reply','affect']);});
 await shot('connected-desktop');
 mode='reply-failure';await page.locator('#say').fill('Can you hear me?');await page.locator('#send').click();await page.waitForFunction(()=>__SUGATA_CONVERSE__.session.turns===2&&!__SUGATA_CONVERSE__.session.busy);
 assert.match(await page.locator('#transcript').textContent(),/No reply\. LM Studio rejected/);assert.equal(await page.locator('#send').isEnabled(),true);
 check('failed reply provides retry guidance and releases the composer',()=>{});
 mode='normal';await page.locator('#say').fill('I am happy to try again.');await page.locator('#send').click();
 await page.waitForFunction(()=>__SUGATA_CONVERSE__.session.turns===3&&!__SUGATA_CONVERSE__.session.busy);
 assert.equal(await page.locator('#connection-status').getAttribute('data-state'),'ready');
 assert.match(await page.locator('#connection-status').textContent(),/Connected to fixture-chat-a/);
 check('successful retry clears the prior failure status without reconnecting',()=>{});
 mode='reply-failure';
 await page.locator('#model').selectOption('fixture-chat-b');assert.equal(await page.locator('#send').isDisabled(),true);
 await page.locator('#connect').click();await page.waitForFunction(()=>!document.querySelector('#connect').disabled);assert.equal(await page.locator('#send').isDisabled(),true);
 check('failed connection does not enable turns or substitute another model',()=>assert.equal(report.requests.at(-1).model,'fixture-chat-b'));
 mode='normal';await page.locator('#connect').click();await page.waitForFunction(()=>document.querySelector('#connection-status').dataset.state==='ready');
 assert.equal(await page.evaluate(()=>__SUGATA_CONVERSE__.conversation.history.length),0);
 check('retry connects the newly selected model as an explicit new conversation',()=>{});
 mode='invalid-affect';await page.locator('#connect').click();await page.waitForFunction(()=>!document.querySelector('#connect').disabled);
 assert.match(await page.locator('#connection-status').textContent(),/Expression interpretation is experimental/);
 await page.locator('#say').fill('I feel happy about this.');await page.locator('#send').click();await page.waitForFunction(()=>__SUGATA_CONVERSE__.session.turns===4&&!__SUGATA_CONVERSE__.session.busy);
 assert.equal(await page.locator('#connection-status').getAttribute('data-state'),'degraded');
 assert.match(await page.locator('#connection-status').textContent(),/kept its local response/);
 assert.equal(await page.evaluate(()=>__SUGATA_CONVERSE__.conversation.tier2.report().refusals.schema),1);
 check('HTTP-successful affect warm-up does not certify expression; invalid appraisal reports local-response fallback',()=>{});

 const diagnosticState=()=>page.evaluate(()=>({status:document.querySelector('#connection-status').textContent,state:document.querySelector('#connection-status').dataset.state,detail:document.querySelector('#request-detail-text').textContent,hidden:document.querySelector('#request-details').hidden,transcript:document.querySelector('#transcript').textContent,sendEnabled:!document.querySelector('#send').disabled,history:__SUGATA_CONVERSE__.conversation?.history.length??null}));
 const nextTurn=async text=>{const n=await page.evaluate(()=>__SUGATA_CONVERSE__.session.turns);await page.locator('#say').fill(text);await page.locator('#send').click();await page.waitForFunction(n=>__SUGATA_CONVERSE__.session.turns===n+1&&!__SUGATA_CONVERSE__.session.busy,n);return diagnosticState();};
 report.diagnostics=[];
 for(const test of [
  ['truncated-reply',/output limit/,/Output tokens: 300/,'unavailable'],
  ['invalid-response-reply',/response Converse could not read/,/Server status: HTTP 200/,'unavailable'],
  ['invalid-value-reply',/did not meet Converse/,/reply field must contain text/,'unavailable'],
  ['invalid-response-affect',/kept its local response/,/Server status: HTTP 200/,'degraded'],
  ['invalid-value-affect',/kept its local response/,/unknown-primary/,'degraded'],
  ['timeout-reply',/within 4 seconds/,/Request time limit: 4 seconds/,'unavailable'],
  ['reasoning-prose',/format Converse could not read/,/reasoning_content channel/,'unavailable'],
  ['truncated-affect',/kept its local response/,/Output tokens: 200/,'degraded'],
  ['timeout-affect',/kept its local response/,/Request time limit: 4 seconds/,'degraded']
 ]){
  mode=test[0];const observed=await nextTurn('I am happy to try this.');report.diagnostics.push({mode,...observed});
  check('request diagnostic reaches UI and preserves recovery: '+mode,()=>{assert.match(observed.status,test[1]);assert.match(observed.detail,test[2]);assert.equal(observed.state,test[3]);assert.equal(observed.hidden,false);assert.equal(observed.sendEnabled,true);assert.equal((observed.transcript+observed.detail).includes('PRIVATE REASONING SENTINEL'),false);assert.equal((observed.transcript+observed.detail).includes('PRIVATE SERVER BODY SENTINEL'),false);});
 }
 await page.locator('#request-details').evaluate(el=>el.open=true);await shot('expression-timeout-details');
 for(const [next,detail] of [['http-grammar',/cannot use this JSON grammar/],['http-model',/Selected model is unavailable/],['truncated-affect',/Expression setup: truncated/]]){
  mode=next;await page.locator('#connect').click();await page.waitForFunction(()=>!document.querySelector('#connect').disabled);const observed=await diagnosticState();report.diagnostics.push({mode,...observed});
  check('Connect retains the actual failed schema and server detail: '+mode,()=>{assert.match(observed.detail,detail);assert.equal(observed.state,'unavailable');assert.equal(observed.sendEnabled,false);});
 }
 mode='markup-error';await page.locator('#connect').click();await page.waitForFunction(()=>!document.querySelector('#connect').disabled);
 await page.locator('#request-details').evaluate(el=>el.open=true);
 const escaped=await page.evaluate(()=>({text:document.querySelector('#request-detail-text').textContent,images:document.querySelector('#request-detail-text').querySelectorAll('img').length,injected:window.__DIAGNOSTIC_INJECTION__===true}));
 check('server error markup is displayed as literal text and never executed',()=>{assert.match(escaped.text,/<img/);assert.equal(escaped.images,0);assert.equal(escaped.injected,false);});
 mode='reasoning-json';await page.locator('#connect').click();await page.waitForFunction(()=>document.querySelector('#connection-status').dataset.state==='ready');
 const recovered=await nextTurn('I am happy to reconnect.');
 check('JSON in reasoning channel still connects and speaks; success clears stale failure details',()=>{assert.equal(recovered.state,'ready');assert.equal(recovered.hidden,true);assert.equal(recovered.detail,'');assert.equal(recovered.history,2);});
 mode='truncated-reply';await nextTurn('Check the visible explanation.');await page.locator('#request-details').evaluate(el=>el.open=true);await shot('truncation-details-desktop');
 await page.setViewportSize({width:390,height:844});await shot('truncation-details-mobile');
 check('expanded failure details fit the mobile width',()=>{});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 mode='normal';await nextTurn('I feel happy after trying again.');
 await page.setViewportSize({width:390,height:844});await shot('connected-mobile');
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 check('mobile layout retains readable controls without horizontal overflow',()=>{});
 await page.goto(server.baseUrl+'/src/converse.html?ownclock&bare');
 await page.waitForFunction(()=>window.__SUGATA_CONVERSE__?.ready&&__SUGATA_CONVERSE__.avatar.clockSeconds>.1,null,{timeout:120000});
 const retired=await page.evaluate(async()=>{const a=__SUGATA_CONVERSE__.avatar;window.dispatchEvent(new PageTransitionEvent('pagehide',{persisted:false}));const before=a.clockSeconds;await new Promise(resolve=>setTimeout(resolve,350));return{disposed:a.disposed,before,after:a.clockSeconds};});
 check('leaving an own-clock preview retires its avatar and stops subsequent frame work',()=>{assert.equal(retired.disposed,true);assert.equal(retired.after,retired.before);});
 await page.goto(server.baseUrl+'/');await page.waitForFunction(()=>document.querySelectorAll('main a[href$=".html"]').length>0);await shot('hub-mobile');
 await page.setViewportSize({width:1440,height:960});await shot('hub-desktop');
 const links=await page.locator('a').evaluateAll(as=>as.filter(a=>a.getAttribute('href')?.endsWith('.html')).map(a=>a.getAttribute('href')));
 check('hub contains all 17 distinct page destinations',()=>assert.equal(new Set(links).size,17));
 check('no unexpected JavaScript or GPU console errors',()=>assert.deepEqual(report.errors,[]));
 report.sourceHashes=Object.fromEntries(['packages/testbed/src/converse.js','packages/testbed/src/converse.html','packages/testbed/src/converse-connection.mjs','packages/core/src/affect/CompletionDiagnostics.js','packages/core/src/affect/LMStudioClient.js','packages/core/src/affect/AppraisalAffect.js','packages/testbed/index.html','packages/testbed/pages.js'].map(f=>[f,createHash('sha256').update(fs.readFileSync(path.join(root,f))).digest('hex')]));
 report.passed=true;save();console.log('PASS '+report.checks.length+' browser groups; '+out);
}catch(error){report.error=error.stack;await page?.screenshot({path:path.join(out,'failure.png'),fullPage:true}).catch(()=>{});save();throw error;}
finally{await browser?.close();await server?.close();}
