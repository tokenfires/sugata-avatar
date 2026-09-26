// Focused integration witness. CPU preparation is separate; only --run launches a browser.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {decodePng} from '../../../../tools/critic/png.mjs';
const HERE=path.dirname(fileURLToPath(import.meta.url)),ROOT=path.resolve(HERE,'../../../..');
const sha=x=>createHash('sha256').update(x).digest('hex'),hash=p=>sha(fs.readFileSync(p)),json=x=>JSON.stringify(x,null,2)+'\n';
const KIND='integrated-palette-chooser-ui-v1',STYLES=['ecru','charcoal','original'];
const OWN=path.relative(ROOT,fileURLToPath(import.meta.url));
const productionFiles=['packages/testbed/src/showcase-palette-references.mjs','packages/testbed/src/showcase-palette-references.css'];
function walk(dir){return fs.readdirSync(dir,{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name)).flatMap(e=>{const p=path.join(dir,e.name);assert.equal(e.isSymbolicLink(),false,'Source symlink requires binding: '+p);return e.isDirectory()?walk(p):e.isFile()?[p]:[];});}
function files(){return [...new Set(['packages/core/src','packages/testbed/src','assets','node_modules/three/src','node_modules/three/build','node_modules/three/examples/jsm','node_modules/vite/dist'].flatMap(p=>walk(path.join(ROOT,p))).concat([OWN,'package.json','package-lock.json','vite.config.js','tools/critic/png.mjs','node_modules/three/package.json','node_modules/vite/package.json'].map(p=>path.join(ROOT,p))))].sort().map(p=>path.relative(ROOT,p));}
function references(directory){
 const dir=path.resolve(directory),reportFile=path.join(dir,'report.json'),sealFile=path.join(dir,'seal.json');
 const report=JSON.parse(fs.readFileSync(reportFile)),seal=JSON.parse(fs.readFileSync(sealFile));
 assert.equal(seal.reportSHA256,hash(reportFile));assert.equal(report.completed,true);assert.equal(report.kind,'unchanged-showcase-palette-references-v1');assert.equal(report.cases.length,6);
 const entries=[];
 for(const outfit of ['casual','elegant'])for(const style of STYLES){
  const c=report.cases.find(c=>c.preset===outfit&&c.style===style);assert.ok(c?.completed&&c.image?.nativeSaveImage&&c.image.unmodifiedBytes&&c.exportStateExact);
  const original=path.join(dir,c.image.file),file=`packages/testbed/src/palette-references/${outfit}-${style}.png`;
  assert.equal(hash(original),c.image.sha256);assert.equal(hash(path.join(ROOT,file)),c.image.sha256,'Installed thumbnail must be the unchanged qualified PNG');
  const image=decodePng(fs.readFileSync(original));assert.deepEqual([image.width,image.height],[c.image.width,c.image.height]);
  entries.push({outfit,style,file,original,sha256:c.image.sha256,width:image.width,height:image.height});
 }
 return {directory:dir,reportSHA256:hash(reportFile),sealSHA256:hash(sealFile),entries};
}
function createManifest(referenceDir){for(const f of productionFiles)assert.ok(fs.existsSync(path.join(ROOT,f)),'Integrate before freeze: '+f);
 return {version:1,kind:KIND,createdAt:new Date().toISOString(),reference:references(referenceDir),
  desktop:{width:1440,height:1000},mobile:{width:390,height:844},deviceScaleFactor:1,settleDraws:64,
  sources:Object.fromEntries(files().map(f=>[f,hash(path.join(ROOT,f))])),
  scope:'Focused native chooser interaction, actual image bytes, configuration continuity and cleanup. No new palette/fit/hair/performance or all-combinations qualification.'};}
function verify(m){assert.equal(m.version,1);assert.equal(m.kind,KIND);assert.deepEqual(m.desktop,{width:1440,height:1000});assert.deepEqual(m.mobile,{width:390,height:844});assert.equal(m.deviceScaleFactor,1);assert.equal(m.settleDraws,64);
 assert.deepEqual(Object.keys(m.sources),files());for(const[f,h]of Object.entries(m.sources))assert.equal(hash(path.join(ROOT,f)),h,'Source drift: '+f);
 assert.deepEqual(references(m.reference.directory),m.reference);
}
async function bounded(p,label,ms=30000){let t;try{return await Promise.race([p,new Promise((_,reject)=>{t=setTimeout(()=>reject(Error(label+' timed out')),ms);})]);}finally{clearTimeout(t);}}
const [mode,arg1,arg2]=process.argv.slice(2);
if(mode==='--write-manifest'){assert.equal(process.argv.length,5,'ui-probe.mjs --write-manifest completed-reference-directory fresh-manifest.json');const m=createManifest(arg1);verify(m);fs.writeFileSync(arg2,json(m),{flag:'wx'});console.log(json({manifest:arg2,sha256:hash(arg2),files:Object.keys(m.sources).length}));process.exit(0);}
assert.ok(['--preflight','--run'].includes(mode),'ui-probe.mjs --preflight|--run manifest.json fresh-output-directory');assert.equal(process.argv.length,5);
const manifestBytes=fs.readFileSync(arg1),manifest=JSON.parse(manifestBytes);verify(manifest);
const out=path.resolve(arg2);assert.equal(fs.existsSync(out),false,'Fresh output required');fs.mkdirSync(out,{recursive:true});
const write=(file,value)=>{const dest=path.join(out,file);fs.mkdirSync(path.dirname(dest),{recursive:true});fs.writeFileSync(dest,Buffer.isBuffer(value)||typeof value==='string'?value:json(value),{flag:'wx'});};
write('manifest.json',manifestBytes);
const report={version:1,kind:KIND,completed:false,manifestSHA256:sha(manifestBytes),sourceHashes:manifest.sources,scope:manifest.scope,checks:[],states:{},images:[],referenceImages:[],readyPages:[],responses:[],retirements:[],warnings:[],errors:[],injectedFailures:[]};
const save=()=>fs.writeFileSync(path.join(out,'report.json'),json(report));
if(mode==='--preflight'){report.preflightOnly=true;report.completed=true;save();console.log(json({preflight:true,images:manifest.reference.entries.length,files:Object.keys(manifest.sources).length}));process.exit(0);}
const {startProbeServer,launchProbeBrowser}=await import('../../../../packages/core/src/render/MotionProbe.mjs');
let server,browser,context,page;const reads=[];let phase='setup';
const RETIRED='sugata:palette-ui:retirements';
const visibleGroup=()=>page.locator('.palette-reference-group:not([hidden])');
const referenceButton=style=>visibleGroup().locator(`[data-reference-style="${style}"]`);
function check(name,detail){report.checks.push({name,passed:true,...(detail?{detail}:{})});save();console.log('PASS '+name);}
async function drain(){await bounded(Promise.all(reads),'Response hashes');assert.deepEqual(report.errors,[]);}
async function collectRetirements(){const r=await page.evaluate(key=>JSON.parse(sessionStorage.getItem(key)??'[]'),RETIRED);
 for(const item of r){assert.equal(item.persisted,false,'No false disposal claim for a bfcache-held owner');assert.equal(item.disposed,true);assert.deepEqual(item.leaks,[]);assert.ok(Object.values(item.memory).every(v=>v===0));}
 report.retirements=r;return r;
}
async function settle(count=64){await bounded(page.evaluate(async count=>{for(let i=0;i<count;i++){await new Promise(requestAnimationFrame);await showcase.step(0);}await showcase.avatar.stage.renderer.backend.device.queue.onSubmittedWorkDone();},count),'Native settle',120000);}
async function ready(){
 await page.waitForFunction(()=>window.showcase?.avatar||!document.querySelector('#error').hidden,null,{timeout:120000});assert.equal(await page.locator('#error').isVisible(),false);
 assert.equal(await page.locator('[data-style]').count(),3);assert.equal(await page.locator('[data-reference-style]').count(),6);
 await page.evaluate(key=>{
  const a=showcase.avatar,renderer=a.stage.renderer;
  window.paletteUIOwner={avatar:a,renderer,id:crypto.randomUUID()};
  // Registered after the original page's handler: observe actual cleanup, do not replace it.
  addEventListener('pagehide',event=>{const all=JSON.parse(sessionStorage.getItem(key)??'[]');all.push({id:paletteUIOwner.id,url:location.href,persisted:event.persisted,synthetic:!event.isTrusted,disposed:a.disposed,leaks:a.leakedHandles(),memory:structuredClone(renderer.info.memory)});sessionStorage.setItem(key,JSON.stringify(all));});
 },RETIRED);
 await settle(manifest.settleDraws);await page.waitForLoadState('networkidle');await collectRetirements();await drain();
 assert.equal(await page.evaluate(()=>showcase.avatar.stage.backendName),'webgpu');
 const r=await page.evaluate(()=>showcase.avatar.report());assert.equal(r.identity.bake,'figure_g050');assert.equal(r.wardrobe.appearance.attached,true);assert.equal(r.hair.attached,true);
 report.readyPages.push({phase,...await page.evaluate(()=>({documentId:paletteUIOwner.id,url:location.href,configuration:showcase.configuration(),report:showcase.avatar.report()}))});save();
}
async function owner(){const result=await page.evaluate(()=>{const a=showcase.avatar,c=a.stage.camera;
 return {documentId:paletteUIOwner.id,sameOwner:paletteUIOwner.avatar===a&&paletteUIOwner.renderer===a.stage.renderer,configuration:showcase.configuration(),clock:a.clockSeconds,
  camera:{position:c.position.toArray(),quaternion:c.quaternion.toArray(),projection:c.projectionMatrix.toArray(),target:showcase.controls.target.toArray(),focus:a.focus.toArray()},attention:showcase.attention.report(),paused:document.querySelector('#pause').getAttribute('aria-pressed'),url:location.href};});assert.equal(result.sameOwner,true);return result;}
async function openComparison(key='Enter'){const details=page.locator('.palette-references');if(await details.getAttribute('open')===null){await details.locator('summary').focus();await page.keyboard.press(key);}assert.notEqual(await details.getAttribute('open'),null);
 await bounded(visibleGroup().locator('img').evaluateAll(images=>Promise.all(images.map(image=>image.decode()))),'Visible reference decoding');await drain();}
async function navigate(action){const id=(await owner()).documentId;await Promise.all([page.waitForEvent('domcontentloaded'),action()]);await ready();assert.notEqual((await owner()).documentId,id);}
function expectedPalette(configuration,style){const c=structuredClone(configuration);if(style==='original')delete c.wardrobe.style;else c.wardrobe.style=style;return c;}
async function imageWitnesses(outfit){await openComparison();assert.equal(await visibleGroup().count(),1);
 const caption=await visibleGroup().locator('.palette-reference-caption').textContent();assert.match(caption,outfit==='casual'?/Tee \+ denim.*Everyday.*chin-length/:/Blouse \+ skirt.*After hours.*long/);
 const images=visibleGroup().locator('img');assert.equal(await images.count(),3);
 for(let i=0;i<3;i++){
  const image=images.nth(i);await image.scrollIntoViewIfNeeded();await image.evaluate(el=>el.decode());
  const value=await image.evaluate(el=>{const r=el.getBoundingClientRect(),p=el.closest('button').getBoundingClientRect(),style=getComputedStyle(el);return {src:el.currentSrc,naturalWidth:el.naturalWidth,naturalHeight:el.naturalHeight,alt:el.alt,fit:style.objectFit,rect:{x:r.x,y:r.y,width:r.width,height:r.height},button:{x:p.x,y:p.y,width:p.width,height:p.height},style:el.closest('button').dataset.referenceStyle};});
  const expected=manifest.reference.entries.find(e=>e.outfit===outfit&&e.style===value.style);assert.ok(expected);assert.deepEqual([value.naturalWidth,value.naturalHeight],[expected.width,expected.height]);assert.equal(value.fit,'contain');assert.ok(value.alt.length>0);
  assert.ok(value.rect.width>0&&value.rect.height>0);assert.ok(value.rect.x>=value.button.x&&value.rect.y>=value.button.y&&value.rect.x+value.rect.width<=value.button.x+value.button.width+.1&&value.rect.y+value.rect.height<=value.button.y+value.button.height+.1,'Entire image element lies inside its card');
  // Browser fetched bytes are independently hashed by the response hook; no image fetch is invented here.
  await drain();assert.ok(report.responses.some(r=>r.url===value.src&&r.sha256===expected.sha256),'Actual reference response must match the qualified PNG');
  report.referenceImages.push({phase,outfit,...value,sha256:expected.sha256});
 }
 const layout=await page.evaluate(()=>({width:innerWidth,scrollWidth:document.documentElement.scrollWidth}));assert.ok(layout.scrollWidth<=layout.width,'No horizontal page overflow');return {caption,layout};
}
async function screenshot(file,fullPage=true){await settle();await page.screenshot({path:path.join(out,file),fullPage});report.images.push({file,sha256:hash(path.join(out,file))});save();}
async function pressed(style){assert.equal(await page.locator('[data-style][aria-pressed="true"]').count(),1);assert.equal(await page.locator('[data-style][aria-pressed="true"]').getAttribute('data-style'),style);assert.equal(await visibleGroup().locator('[data-reference-style][aria-pressed="true"]').count(),1);assert.equal(await visibleGroup().locator('[data-reference-style][aria-pressed="true"]').getAttribute('data-reference-style'),style);}
async function finalRetirement(){if(!page||page.isClosed())return;const published=await page.evaluate(()=>!!window.showcase?.avatar);if(published){await page.evaluate(()=>{if(!showcase.avatar.disposed)dispatchEvent(new PageTransitionEvent('pagehide',{persisted:false}));});await collectRetirements();}else await page.evaluate(()=>dispatchEvent(new PageTransitionEvent('pagehide',{persisted:false})));}
try{
 for(const[f,h]of Object.entries(manifest.sources).filter(([f])=>!f.startsWith('assets/'))){const bytes=fs.readFileSync(path.join(ROOT,f));assert.equal(sha(bytes),h);write('source/'+f,bytes);}
 server=await startProbeServer({port:5394});browser=await launchProbeBrowser();report.browserVersion=browser.version();
 context=await browser.newContext({viewport:manifest.desktop,deviceScaleFactor:1,colorScheme:'dark',reducedMotion:'no-preference',acceptDownloads:true});page=await context.newPage();
 page.on('pageerror',e=>report.errors.push({phase,type:'pageerror',message:String(e)}));page.on('console',m=>{if(m.type()==='error')report.errors.push({phase,type:'console',message:m.text()});if(m.type()==='warning')report.warnings.push({phase,message:m.text()});});
 page.on('requestfailed',r=>report.errors.push({phase,type:'requestfailed',url:r.url(),message:r.failure()?.errorText}));
 page.on('response',r=>{const responsePhase=phase;if(r.status()>=400)report.errors.push({phase:responsePhase,type:'http',status:r.status(),url:r.url()});
  const u=new URL(r.url()),pathname=decodeURIComponent(u.pathname),moduleRequest=u.searchParams.has('import')||u.searchParams.has('url'),
   reference=moduleRequest?null:manifest.reference.entries.find(e=>pathname.endsWith('/src/palette-references/'+path.basename(e.file)));
  const assetIndex=pathname.indexOf('/assets/'),asset=assetIndex<0||u.searchParams.has('import')||u.searchParams.has('url')?null:pathname.slice(assetIndex+1);
  if(!reference&&!asset)return;
  reads.push(r.body().then(bytes=>{const digest=sha(bytes);if(reference)assert.equal(digest,reference.sha256,'Actual displayed reference bytes');if(asset){assert.ok(Object.hasOwn(manifest.sources,asset));assert.equal(digest,manifest.sources[asset],'Actual native asset bytes');}
   report.responses.push({phase:responsePhase,url:r.url(),status:r.status(),sha256:digest,bytes:bytes.length,asset,reference:reference?.file??null});
  }).catch(e=>report.errors.push({phase:responsePhase,type:'response-binding',message:String(e)})));
 });
 phase='desktop-disclosure';await page.goto(server.baseUrl+'/src/showcase.html?preset=casual&style=ecru&capture=palette-ui');await ready();
 assert.equal(await page.locator('.palette-references').getAttribute('open'),null);await page.locator('#look-toward-me').click();await page.evaluate(async()=>{for(let i=0;i<8;i++)await showcase.step(1/60);});
 const before=await owner();assert.equal(before.attention.phase,'attending');await openComparison('Enter');assert.deepEqual(await owner(),before);
 await page.locator('.palette-references summary').focus();await page.keyboard.press('Space');assert.equal(await page.locator('.palette-references').getAttribute('open'),null);assert.deepEqual(await owner(),before);
 await openComparison('Space');assert.deepEqual(await owner(),before);report.states.disclosure=before;
 check('Keyboard disclosure preserves the exact live owner, clock, camera, attention and configuration; canonical palette selectors stay unique');
 phase='desktop-references';await imageWitnesses('casual');await pressed('ecru');await screenshot('desktop-casual-comparison.png');
 const oldOwner=(await owner()).documentId;await page.locator('[data-outfit="elegant"]').click();await page.waitForFunction(()=>!document.querySelector('#outfit-controls').disabled&&showcase.configuration().wardrobe.outfit.includes('female_elegantsuit01'));await settle();
 assert.equal((await owner()).documentId,oldOwner);assert.equal((await owner()).configuration.hair,'bob02');await imageWitnesses('elegant');await screenshot('desktop-mixed-elegant-comparison.png');
 const noOp=await owner();await referenceButton('ecru').focus();await page.keyboard.press('Enter');await page.evaluate(()=>new Promise(requestAnimationFrame));assert.deepEqual(await owner(),noOp);
 check('All six unchanged references load with qualified hashes/dimensions; actual mixed outfit changes the group; active palette is a native no-op');
 phase='kitchen-palette';await page.locator('[data-frame="portrait"]').click();await settle();await navigate(()=>page.locator('[data-scene="kitchen"]').click());await openComparison();
 const kitchenBefore=(await owner()).configuration;assert.equal(kitchenBefore.scene,'kitchen');assert.equal(kitchenBefore.frame,'portrait');assert.equal(kitchenBefore.hair,'bob02');assert.equal(Object.hasOwn(kitchenBefore,'lighting'),false);
 await navigate(()=>referenceButton('charcoal').click());const saved=(await owner()).configuration;assert.deepEqual(saved,expectedPalette(kitchenBefore,'charcoal'));await openComparison();await pressed('charcoal');
 report.states.kitchenPalette=saved;check('Reference apply retains the mixed outfit, accepted cut and Kitchen/portrait configuration through the existing navigation');
 // One saved object, one JSON export/import and one named restore. No settings cross-product.
 await page.locator('#saved-looks summary').click();await page.getByLabel('Name this look',{exact:true}).fill('Palette reference check');await page.locator('#saved-look-name').press('Tab');await page.keyboard.press('Enter');
 await page.waitForFunction(()=>document.querySelector('#collection-status').textContent.includes('is saved in this browser'));
 const savedEntry=await page.evaluate(()=>JSON.parse(localStorage.getItem('sugata:showcase:saved-looks:v1')).looks[0]);assert.deepEqual(savedEntry.configuration,saved);
 const [download]=await Promise.all([page.waitForEvent('download'),page.locator('#save').click()]);const savedFile=path.join(out,'saved-look.json');await download.saveAs(savedFile);assert.deepEqual(JSON.parse(fs.readFileSync(savedFile)),saved);
 report.saved={id:savedEntry.id,name:savedEntry.name,configuration:saved,jsonSHA256:hash(savedFile)};save();
 phase='studio-warm-palette';await navigate(()=>page.locator('[data-scene="studio"]').click());await page.locator('[data-light="warm"]').click();await openComparison();
 const studioBefore=(await owner()).configuration;assert.equal(studioBefore.scene,'studio');assert.equal(studioBefore.lighting,'warm');await navigate(()=>referenceButton('original').click());assert.deepEqual((await owner()).configuration,expectedPalette(studioBefore,'original'));
 report.states.studioPalette=(await owner()).configuration;check('Reference apply also preserves Studio/Warm, portrait, mixed clothes and the current cut');
 phase='mobile-json-restore';await page.setViewportSize(manifest.mobile);await page.emulateMedia({reducedMotion:'reduce'});
 await navigate(()=>page.locator('#settings-file').setInputFiles(savedFile));assert.deepEqual((await owner()).configuration,saved);await imageWitnesses('elegant');await pressed('charcoal');
 const focus=referenceButton('original');await focus.focus();await page.keyboard.press('Tab');await page.keyboard.press('Shift+Tab');
 const focused=await focus.evaluate(el=>{const s=getComputedStyle(el),r=el.getBoundingClientRect();return {active:document.activeElement===el,visible:el.matches(':focus-visible'),outline:s.outlineStyle,width:parseFloat(s.outlineWidth),rect:{x:r.x,y:r.y,width:r.width,height:r.height},viewport:{width:innerWidth,height:innerHeight}};});
 assert.equal(focused.active,true);assert.equal(focused.visible,true);assert.notEqual(focused.outline,'none');assert.ok(focused.width>0);assert.ok(focused.rect.x>=0&&focused.rect.x+focused.rect.width<=focused.viewport.width&&focused.rect.y>=0&&focused.rect.y+focused.rect.height<=focused.viewport.height);
 report.states.mobileFocus=focused;await screenshot('mobile-comparison.png');check('Mobile shows uncropped contained references, no horizontal overflow and native keyboard-visible focus; one JSON import restores exact settings');
 phase='controlled-thumbnail-failure';const image=referenceButton('ecru').locator('img');const steady=await owner();
 const injected=await image.evaluate(async el=>{const prior=el.currentSrc,bad='data:image/png;base64,AAAA';const error=new Promise(resolve=>el.addEventListener('error',()=>resolve(true),{once:true}));el.src=bad;await error;return {prior,injected:bad,naturalWidth:el.naturalWidth,hidden:el.hidden,fallbackVisible:!el.parentElement.querySelector('.palette-reference-missing').hidden};});
 report.injectedFailures.push({phase,kind:'one invalid data URI decoded by the real img element; no network/asset source changed',...injected});assert.equal(injected.hidden,true);assert.equal(injected.fallbackVisible,true);assert.deepEqual(await owner(),steady);
 assert.equal(await page.locator('[data-style="original"]').isEnabled(),true);assert.equal(await page.locator('#error').isVisible(),false);await screenshot('mobile-thumbnail-fallback.png');
 await navigate(()=>page.locator('[data-style="original"]').click());assert.deepEqual((await owner()).configuration,expectedPalette(saved,'original'));
 check('One real thumbnail decode failure stays local and canonical palette navigation remains usable');
 phase='named-look-restore';await page.locator('#saved-looks summary').click();await navigate(()=>page.locator(`[data-open-look="${savedEntry.id}"]`).click());assert.deepEqual((await owner()).configuration,saved);await openComparison();await pressed('charcoal');
 check('One named look reopens the same supported configuration after another palette; collection/JSON contracts are unchanged');
 await drain();await finalRetirement();verify(manifest);assert.equal(hash(arg1),report.manifestSHA256);assert.deepEqual(report.errors,[]);report.sourcesStable=true;check('All observed navigation/final owners retire cleanly; source/reference bytes stay bound and browser errors remain empty');
}catch(error){report.failure=error.stack;process.exitCode=1;save();if(page&&!page.isClosed())try{await page.screenshot({path:path.join(out,'failure.png'),fullPage:true});report.images.push({file:'failure.png',sha256:hash(path.join(out,'failure.png'))});}catch(e){report.failureScreenshot=String(e);}}
finally{
 try{await finalRetirement();await drain();}catch(e){report.cleanupFailure=e.stack;process.exitCode=1;}
 try{verify(manifest);assert.equal(hash(arg1),report.manifestSHA256);for(const[f,h]of Object.entries(manifest.sources))if(!f.startsWith('assets/'))assert.equal(hash(path.join(out,'source',f)),h);report.sourcesStable=true;}catch(e){report.bindingFailure=e.stack;process.exitCode=1;}
 for(const[name,close]of [['context',()=>context?.close()],['browser',()=>browser?.close()],['server',()=>server?.close()]])try{await bounded(close(),'Close '+name);}catch(e){report.errors.push({type:'close-'+name,message:String(e)});process.exitCode=1;}
 report.completed=!report.failure&&!report.cleanupFailure&&!report.bindingFailure&&report.sourcesStable&&report.errors.length===0&&report.checks.length===8;save();if(report.completed)write('seal.json',{reportSHA256:hash(path.join(out,'report.json')),manifestSHA256:report.manifestSHA256});
 console.log(json({completed:report.completed,checks:report.checks.length,retirements:report.retirements.length,errors:report.errors.length,out,failure:report.failure}));
}
