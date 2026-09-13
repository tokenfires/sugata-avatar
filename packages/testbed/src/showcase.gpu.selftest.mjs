/** Real Avatar lookbook gate. No routed assets or material substitutes.
 * node packages/testbed/src/showcase.gpu.selftest.mjs --out=/tmp/showcase-dev
 * npm run build:pages && node packages/testbed/src/showcase.gpu.selftest.mjs --production --out=/tmp/showcase-built
 * Requires the existing MotionProbe Chromium/WebGPU setup. Screenshots are review evidence,
 * not a clothing intersection or aesthetic-quality assertion. No frame-cost benchmark.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {startProbeServer,launchProbeBrowser} from '../../core/src/render/MotionProbe.mjs';
import {decodePng} from '../../../tools/critic/png.mjs';
import {SHOWCASE_OUTFITS,SHOWCASE_FOUNDATION} from './showcase-presets.mjs';
const root=fileURLToPath(new URL('../../../',import.meta.url)),production=process.argv.includes('--production');
const out=process.argv.find(a=>a.startsWith('--out='))?.slice(6)??fs.mkdtempSync(path.join(os.tmpdir(),'sugata-showcase-'));
fs.mkdirSync(out,{recursive:true});
const sha=b=>createHash('sha256').update(b).digest('hex');
const sources=['packages/core/src/wardrobe/WardrobeStyles.js','packages/core/src/wardrobe/WardrobeStyleOptions.js','packages/testbed/src/showcase.html','packages/testbed/src/showcase.js','packages/testbed/src/showcase-presets.mjs','packages/core/src/Avatar.js','packages/core/src/wardrobe/AvatarWardrobe.js','packages/core/src/wardrobe/Wardrobe.js','packages/core/src/motion/HairDynamics.js','packages/core/src/motion/HairBodyContact.js','packages/core/src/motion/HairBodyContactForest.js','packages/core/src/motion/HairBodyContactCalibration.data.js','packages/core/src/material/SkinMaterial.js','packages/core/src/material/HairMaterial.js','assets/wardrobe/manifest.json','assets/wardrobe/female_casualsuit01/g050.glb','assets/wardrobe/shoes01/g050.glb','assets/hair/bob01/g050.glb','assets/hair/bob02/g050.glb'];
const sourceHashes=()=>Object.fromEntries(sources.map(f=>[f,sha(fs.readFileSync(root+f))]));
const report={date:new Date().toISOString(),production,sourceHashes:sourceHashes(),checks:[],errors:[],loadedAssets:[],views:[],limits:['Two g050 clothing studies with existing stand-in garments only. The casual trouser fit is improved; neckline/skirt fit and visible skirt socks remain. No whole-clothing geometric clearance claim.','A 60-frame fixed-step hair check confirms finite live motion, not stability under every motion or a timing budget.','The configuration export contains supported Avatar creation options; orbit position and current motion clock are deliberately viewing state.']};
const save=()=>fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');
const check=(name,fn)=>{fn();report.checks.push(name);console.log('PASS '+name);save();};
let server,browser,page;const assetReads=[];
async function settle(){await page.evaluate(async()=>{for(let i=0;i<12;i++){await new Promise(requestAnimationFrame);await showcase.step(0);}});}
async function view(name){await settle();const file=name+'.png';await page.screenshot({path:path.join(out,file),fullPage:true});const canvas=await page.locator('#stage').screenshot();const png=decodePng(canvas);let min=Infinity,max=-Infinity;for(let i=0;i<png.pixels.length;i+=4){const v=png.pixels[i]+png.pixels[i+1]+png.pixels[i+2];min=Math.min(min,v);max=Math.max(max,v);}assert.ok(max-min>.6,'Actual canvas must be nonblank');report.views.push({file,canvasSha256:sha(canvas),canvasSize:[png.width,png.height],configuration:await page.evaluate(()=>showcase.configuration())});save();}
async function ready(){await page.waitForFunction(()=>window.showcase||!document.querySelector('#error').hidden,null,{timeout:120000});assert.equal(await page.locator('#error').textContent(),'');await settle();}
try{
 if(production){const {preview}=await import('vite');assert.ok(fs.existsSync(root+'dist-pages/src/showcase.html'),'Build pages before the production gate.');const previewServer=await preview({configFile:root+'vite.pages.config.js',preview:{host:'127.0.0.1',port:5289,strictPort:false},logLevel:'error'});server={baseUrl:previewServer.resolvedUrls.local[0].replace(/\/$/,''),close:()=>new Promise((resolve,reject)=>previewServer.httpServer.close(e=>e?reject(e):resolve()))};report.builtHtmlSha256=sha(fs.readFileSync(root+'dist-pages/src/showcase.html'));}
 else server=await startProbeServer({port:5289});
 browser=await launchProbeBrowser();page=await browser.newPage({viewport:{width:1440,height:1000},deviceScaleFactor:1,reducedMotion:'no-preference'});
 page.on('pageerror',e=>report.errors.push(e.message));page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text());});page.on('requestfailed',r=>report.errors.push(r.url()+' '+r.failure()?.errorText));
 page.on('response',r=>{if(r.status()>=400)report.errors.push(r.status()+' '+r.url());if(r.ok()&&/\.glb(?:\?|$)/.test(r.url()))assetReads.push(r.body().then(b=>report.loadedAssets.push({url:r.url(),sha256:sha(b)})));});
 await page.goto(server.baseUrl+'/src/showcase.html?preset=casual&capture=',{waitUntil:'domcontentloaded'});await ready();
 report.initial=await page.evaluate(()=>({configuration:showcase.configuration(),report:showcase.avatar.report(),canvasCount:document.querySelectorAll('canvas').length}));
 check('casual preset attaches real g050 body, bob02, foundation, suit and shoes on one canvas',()=>{const r=report.initial;assert.equal(r.canvasCount,1);assert.equal(r.report.identity.bake,'figure_g050');assert.equal(r.configuration.hair,'bob02');assert.deepEqual(r.configuration.wardrobe,{style:'ecru',outfit:[...SHOWCASE_OUTFITS.casual.garments],foundation:{...SHOWCASE_FOUNDATION}});assert.equal(r.report.hair.attached,true);assert.equal(r.report.wardrobe.attached,true);});
 await view('casual-desktop');
 // Gate the real dress call, proving that pending export is disabled rather than exporting a request.
 await page.evaluate(()=>{window.savedOwner={avatar:showcase.avatar,renderer:showcase.avatar.stage.renderer,dynamics:showcase.avatar.hairDynamics};const a=showcase.avatar;window.originalDress=a.dress;window.dressGate=new Promise(r=>window.releaseDress=r);a.dress=async function(...args){await dressGate;return originalDress.apply(this,args);};});
 await page.locator('[data-outfit="elegant"]').click();
 assert.equal(await page.locator('#save').isDisabled(),true);assert.equal(await page.locator('#copy').isDisabled(),true);assert.match(await page.evaluate(()=>{try{showcase.configuration();return'no error';}catch(e){return e.message;}}),/finish loading/);
 check('pending outfit change disables saving and refuses programmatic export',()=>{});
 await page.evaluate(()=>releaseDress());await page.waitForFunction(()=>!document.querySelector('#save').disabled);await page.evaluate(()=>{showcase.avatar.dress=originalDress;});
 report.dressed=await page.evaluate(()=>({configuration:showcase.configuration(),sameAvatar:showcase.avatar===savedOwner.avatar,sameRenderer:showcase.avatar.stage.renderer===savedOwner.renderer,sameHair:showcase.avatar.hairDynamics===savedOwner.dynamics}));
 check('dress switches the attached outfit while preserving Avatar, renderer and groom ownership',()=>{assert.equal(report.dressed.sameAvatar,true);assert.equal(report.dressed.sameRenderer,true);assert.equal(report.dressed.sameHair,true);assert.equal(report.dressed.configuration.hair,'bob02');assert.deepEqual(report.dressed.configuration.wardrobe.outfit,[...SHOWCASE_OUTFITS.elegant.garments]);});
 const failedChange=await page.evaluate(async()=>{const a=showcase.avatar,original=a.dress;const before=JSON.stringify(showcase.configuration());a.dress=async()=>{throw new Error('controlled load failure');};try{return {changed:await showcase.changeOutfit('casual'),same:before===JSON.stringify(showcase.configuration()),status:document.querySelector('#status').textContent};}finally{a.dress=original;}});
 check('failed dressing retains attached configuration and restores usable controls',()=>{assert.equal(failedChange.changed,false);assert.equal(failedChange.same,true);assert.match(failedChange.status,/current look is retained/);});assert.equal(await page.locator('#save').isDisabled(),false);
 await page.locator('[data-frame="portrait"]').click();await page.locator('[data-light="warm"]').click();await view('mixed-portrait-warm');
 report.changedView=await page.evaluate(()=>showcase.configuration());
 check('framing and light controls export their actual supported view settings',()=>{assert.equal(report.changedView.frame,'portrait');assert.equal(report.changedView.lighting,'warm');assert.equal(new URL(page.url()).searchParams.get('outfit'),'elegant');});
 await page.evaluate(()=>Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async text=>{window.copiedSettings=text;}}}));await page.locator('#copy').click();await page.waitForFunction(()=>typeof window.copiedSettings==='string');
 assert.deepEqual(await page.evaluate(()=>JSON.parse(copiedSettings)),report.changedView);check('Copy settings serializes the actual attached mixed look',()=>{});
 const downloadPromise=page.waitForEvent('download');await page.locator('#save').click();const download=await downloadPromise;await download.saveAs(path.join(out,'saved-look.json'));assert.deepEqual(JSON.parse(fs.readFileSync(path.join(out,'saved-look.json'))),report.changedView);
 check('Save settings downloads the same supported Avatar configuration',()=>{});
 await page.evaluate(()=>Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async()=>{throw new Error('controlled clipboard refusal');}}}));await page.locator('#copy').click();await page.waitForFunction(()=>document.querySelector('#copy-dialog').open);assert.deepEqual(JSON.parse(await page.locator('#config-text').inputValue()),report.changedView);await page.locator('#dialog-close').click();
 check('clipboard refusal provides selectable JSON and a local save fallback',()=>{});
 // Starting-look navigation uses a fresh document to change hair, as the existing portrait does.
 await Promise.all([page.waitForURL(/preset=elegant/),page.locator('[data-preset="elegant"]').click()]);await ready();
 report.elegant=await page.evaluate(()=>showcase.avatar.report());
 check('After hours navigation really attaches bob01 and its calibrated contact path with elegant clothes',()=>{assert.equal(report.elegant.hair.loadedStyle,'bob01');assert.equal(report.elegant.wardrobe.attached,true);assert.equal(report.elegant.identity.bake,'figure_g050');});
 await view('elegant-desktop');await page.locator('[data-angle="180"]').click();await view('elegant-rear');
 await page.locator('[data-angle="0"]').click();
 report.motion=await page.evaluate(async()=>{const a=showcase.avatar,before=a.clockSeconds;for(let i=0;i<60;i++){await new Promise(requestAnimationFrame);await showcase.step(1/60);}const c=await a.hairDynamics.readCentrelines(),v=await a.hairDynamics.readVertices();return{seconds:a.clockSeconds-before,finite:c.positions.every(Number.isFinite)&&c.velocities.every(Number.isFinite)&&v.positions.every(Number.isFinite),centerValues:c.positions.length,vertexValues:v.positions.length,steps:c.steps,wardrobeAttached:a.report().wardrobe.attached};});
 check('a clothed long bob runs60 fixed motion frames with finite GPU centers, velocities and ribbons',()=>{assert.ok(Math.abs(report.motion.seconds-1)<1e-10);assert.equal(report.motion.finite,true);assert.ok(report.motion.centerValues>0);assert.ok(report.motion.vertexValues>0);assert.equal(report.motion.wardrobeAttached,true);});
 // Palette navigation retains current clothes/view and serializes the actual attached style.
 await page.locator('[data-outfit="casual"]').click();await page.waitForFunction(()=>!document.querySelector('#save').disabled);
 await page.locator('[data-frame="portrait"]').click();await page.locator('[data-light="warm"]').click();
 const beforePalette=await page.evaluate(()=>showcase.configuration());assert.equal(beforePalette.wardrobe.style,'ecru');
 await page.evaluate(()=>{const a=showcase.avatar,r=a.stage.renderer;addEventListener('pagehide',event=>{sessionStorage.setItem('paletteRetirement',JSON.stringify({persisted:event.persisted,disposed:a.disposed,memory:structuredClone(r.info.memory),leaks:a.leakedHandles()}));},{once:true});});
 await Promise.all([page.waitForURL(/style=charcoal/),page.locator('[data-style="charcoal"]').click()]);await ready();
 const charcoal=await page.evaluate(()=>showcase.configuration());assert.deepEqual(charcoal,{...beforePalette,wardrobe:{...beforePalette.wardrobe,style:'charcoal'}});
 assert.equal(await page.locator('[data-style="charcoal"]').getAttribute('aria-pressed'),'true');
 report.paletteRetirement=await page.evaluate(()=>JSON.parse(sessionStorage.getItem('paletteRetirement')));
 assert.equal(report.paletteRetirement.persisted,false);assert.equal(report.paletteRetirement.disposed,true);assert.deepEqual(report.paletteRetirement.leaks,[]);assert.ok(Object.values(report.paletteRetirement.memory).every(v=>v===0));
 check('palette navigation preserves current outfit/framing/light and fully retires the previous Avatar',()=>{});
 await page.locator('[data-outfit="elegant"]').click();await page.waitForFunction(()=>!document.querySelector('#save').disabled);
 report.charcoalElegant=await page.evaluate(()=>showcase.configuration());assert.equal(report.charcoalElegant.wardrobe.style,'charcoal');assert.equal(report.charcoalElegant.wardrobe.outfit[0],'female_elegantsuit01');
 check('the fixed palette follows same-owner outfit switching',()=>{});
 const paletteDownloadEvent=page.waitForEvent('download');await page.locator('#save').click();const paletteDownload=await paletteDownloadEvent;await paletteDownload.saveAs(path.join(out,'charcoal-look.json'));
 assert.deepEqual(JSON.parse(fs.readFileSync(path.join(out,'charcoal-look.json'))),report.charcoalElegant);
 check('saved JSON includes the actual new palette and outfit',()=>{});
 report.paletteReplay=await page.evaluate(async options=>{const old=showcase.avatar,Type=old.constructor;old.dispose();const a=await Type.create({canvas:document.querySelector('#stage'),...options,autoStart:false});await a.step(0);const wardrobe=a.report().wardrobe;const r=a.stage.renderer;a.dispose();return{appearance:wardrobe.appearance,worn:wardrobe.state.worn,memory:structuredClone(r.info.memory),leaks:a.leakedHandles()};},report.charcoalElegant);
 assert.deepEqual(report.paletteReplay.appearance,{style:'charcoal',attached:true});assert.ok(report.paletteReplay.worn.includes('female_elegantsuit01'));assert.deepEqual(report.paletteReplay.leaks,[]);assert.ok(Object.values(report.paletteReplay.memory).every(v=>v===0));
 check('downloaded palette settings reconstruct a real Avatar and retire cleanly',()=>{});
 await page.goto(server.baseUrl+'/src/showcase.html?preset=elegant&style=original&capture=');await ready();assert.equal(await page.evaluate(()=>Object.hasOwn(showcase.configuration().wardrobe,'style')),false);
 await page.locator('[data-outfit="casual"]').click();await page.waitForFunction(()=>!document.querySelector('#save').disabled);assert.equal(await page.evaluate(()=>showcase.avatar.wardrobe.wornMeshes.get('female_casualsuit01').material.isNodeMaterial===true),false);
 assert.equal(await page.locator('[data-style="original"]').getAttribute('aria-pressed'),'true');
 check('Original restores the original material path and backward-compatible settings',()=>{});
 await page.goto(server.baseUrl+'/src/showcase.html?preset=elegant&capture=');await ready();
 await page.setViewportSize({width:390,height:844});await view('elegant-mobile');assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 check('mobile page retains one nonblank canvas and no horizontal overflow',()=>{});
 await page.reload();await ready();await page.locator('[data-angle="0"]').click();await page.evaluate(async()=>{for(let i=0;i<60;i++){await new Promise(requestAnimationFrame);await showcase.step(1/60);}});await view('elegant-mobile-fresh-motion');
 check('fresh mobile control renders the same60-frame sequence without relying on a desktop resize',()=>{});
 await page.evaluate(()=>{window.retiredShowcase=showcase.avatar;window.dispatchEvent(new PageTransitionEvent('pagehide',{persisted:false}));});assert.equal(await page.evaluate(()=>retiredShowcase.disposed),true);
 check('leaving the page retires its actual Avatar',()=>{});
 // Reduced motion has a visible resumable state, and unsupported identity URLs fail before allocation.
 await page.emulateMedia({reducedMotion:'reduce'});await page.goto(server.baseUrl+'/src/showcase.html?preset=casual&capture=');await ready();assert.equal(await page.locator('#pause').textContent(),'Resume motion');await page.locator('#pause').click();assert.equal(await page.locator('#pause').textContent(),'Pause motion');
 check('reduced-motion preference begins paused with an explicit resume control',()=>{});
 report.afterAttachFailure=await page.evaluate(async()=>{const a=showcase.avatar,original=a.step;a.step=async()=>{throw new Error('controlled render failure after attachment');};try{return{changed:await showcase.changeOutfit('elegant'),worn:a.report().wardrobe.state.worn,error:document.querySelector('#error').textContent,saveDisabled:document.querySelector('#save').disabled};}finally{a.step=original;}});
 check('render failure after successful dressing enters an unavailable state without claiming old clothes remain',()=>{const f=report.afterAttachFailure;assert.equal(f.changed,false);assert.ok(f.worn.includes('female_elegantsuit01'));assert.match(f.error,/controlled render failure after attachment/);assert.equal(f.saveDisabled,true);});
 await page.goto(server.baseUrl+'/src/showcase.html?bake=g100&capture=');await page.waitForFunction(()=>!document.querySelector('#error').hidden);assert.match(await page.locator('#error').textContent(),/g050 clothing studies/);assert.equal(await page.evaluate(()=>!!window.showcase),false);
 check('unsupported body selection refuses visibly before publishing an Avatar',()=>{});
 await page.goto(server.baseUrl+'/src/showcase.html?preset=casual');await page.waitForFunction(()=>window.showcase||!document.querySelector('#error').hidden,null,{timeout:120000});assert.equal(await page.locator('#error').textContent(),'');
 const stopped=await page.evaluate(async()=>{const before=showcase.avatar.clockSeconds;for(let i=0;i<3;i++)await new Promise(requestAnimationFrame);return{before,after:showcase.avatar.clockSeconds};});assert.equal(stopped.before,stopped.after);
 await page.locator('#pause').click();await page.waitForFunction(()=>showcase.avatar.clockSeconds>.1);await page.locator('#pause').click();
 const pausedClock=await page.evaluate(async()=>{const before=showcase.avatar.clockSeconds;for(let i=0;i<3;i++)await new Promise(requestAnimationFrame);return{before,after:showcase.avatar.clockSeconds};});
 check('the actual animation loop resumes and pauses its clock under reduced-motion controls',()=>{assert.ok(pausedClock.before>.1);assert.equal(pausedClock.before,pausedClock.after);});
 await Promise.all(assetReads);
 check('actual shipped g050 hair bytes load and browser console/network/page errors remain empty',()=>{for(const hair of ['bob01','bob02'])assert.ok(report.loadedAssets.some(a=>a.sha256===report.sourceHashes[`assets/hair/${hair}/g050.glb`]),hair+' asset digest');for(const id of ['female_casualsuit01','shoes01'])assert.ok(report.loadedAssets.some(a=>a.sha256===report.sourceHashes[`assets/wardrobe/${id}/g050.glb`]),id+' asset digest');assert.deepEqual(report.errors,[]);});
 check('all recorded source and asset hashes remain stable throughout the run',()=>assert.deepEqual(sourceHashes(),report.sourceHashes));
 report.passed=true;save();console.log(`PASS ${report.checks.length} actual showcase groups; evidence ${out}`);
}catch(error){report.error=error.stack;if(page){report.partial=await page.evaluate(()=>({url:location.href,error:document.querySelector('#error')?.textContent,status:document.querySelector('#status')?.textContent})).catch(()=>null);await page.screenshot({path:path.join(out,'failure.png'),fullPage:true}).catch(()=>{});}save();throw error;}
finally{await browser?.close();await server?.close();}
