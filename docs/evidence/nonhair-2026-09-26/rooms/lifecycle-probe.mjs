// Actual room handler + HTTP204 retained document + synthetic persisted transition events.
// This qualifies handler state, NOT actual browser back-forward-cache admission.
// node docs/evidence/nonhair-2026-09-26/rooms/lifecycle-probe.mjs FRESH_OUTPUT baseline|fixed
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {startProbeServer, launchProbeBrowser} from '../../../../packages/core/src/render/MotionProbe.mjs';
const root=fileURLToPath(new URL('../../../../',import.meta.url)),out=path.resolve(process.argv[2]??''),mode=process.argv[3];
assert.ok(process.argv[2]&&!fs.existsSync(out),'Fresh output required');assert.ok(['baseline','fixed'].includes(mode));fs.mkdirSync(out,{recursive:true});
const sha=value=>createHash('sha256').update(value).digest('hex');
const sources=['docs/evidence/nonhair-2026-09-26/rooms/lifecycle-probe.mjs','packages/testbed/src/portrait.js','packages/testbed/src/portrait.html',
    'packages/testbed/src/showcase.js','packages/testbed/src/showcase.html','packages/testbed/src/showcase-presets.mjs','packages/testbed/src/showcase-settings.mjs',
    'packages/testbed/src/viewer-scenes.mjs','packages/testbed/src/viewer-framing.mjs','packages/core/src/Avatar.js','packages/core/src/render/Scene.js',
    'packages/core/src/render/MotionProbe.mjs','packages/core/src/motion/AttentionAction.js','assets/figures/figure_g050.glb','assets/hair/bob02/g050.glb',
    'assets/wardrobe/female_casualsuit01/g050.glb'];
const hashes=()=>Object.fromEntries(sources.map(file=>[file,sha(fs.readFileSync(path.join(root,file)))]));
const report={startedAt:new Date().toISOString(),mode,completed:false,sourceHashes:hashes(),cases:[],errors:[],
    scope:'Real native pages and actual Room handlers. Target navigation receives204 to retain the old document, then PageTransitionEvent persisted:true fixtures exercise existing handlers. No actual BFcache admission/eviction or cross-browser lifecycle claim.'};
const save=()=>fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');
for(const file of sources){const destination=path.join(out,'source',file);fs.mkdirSync(path.dirname(destination),{recursive:true});fs.copyFileSync(path.join(root,file),destination,fs.constants.COPYFILE_EXCL);}save();
let server,browser,page,rec;
async function state(){return page.evaluate(()=>{
    const v=window.portrait??window.showcase,a=v.avatar,camera=a.stage.camera;
    return {documentId:window.lifecycleDocumentId,ownerUnchanged:a===window.lifecycleOriginalOwner,url:location.href,clock:a.clockSeconds,
        identity:a.report().identity,disposed:a.disposed,backend:a.stage.backendName,attention:v.attention.report(),
        paused:document.querySelector('#pause').getAttribute('aria-pressed')==='true',
        camera:{position:camera.position.toArray(),quaternion:camera.quaternion.toArray(),target:v.controls.target.toArray(),zoom:camera.zoom},
        controls:[...document.querySelectorAll('fieldset,[data-angle],#pause,#reset-view,#save-image,#save,#copy,#open-settings')].map(el=>({id:el.id||el.dataset.angle,disabled:el.disabled})),
        attentionButtons:[...document.querySelectorAll('#look-toward-me,#look-with-smile,#release-attention')].map(el=>({id:el.id,disabled:el.disabled})),
        status:document.querySelector('#status').textContent,attentionStatus:document.querySelector('#attention-status').textContent,
        raf:window.lifecycleRafSnapshot(),rendererMemory:structuredClone(a.stage.renderer.info.memory)};
});}
function preserved(before,after,{clock=true}={}){for(const key of ['documentId','ownerUnchanged','url',...(clock?['clock']:[]),'identity','disposed','backend','paused','camera'])assert.deepEqual(after[key],before[key],`${key} changed through retained restore`);}
async function plate(label){const file=`${rec.name}-${label}.png`;await page.screenshot({path:path.join(out,file),fullPage:true});rec.plates.push({label,file,sha256:sha(fs.readFileSync(path.join(out,file)))});save();}
try{
    server=await startProbeServer({port:5364});browser=await launchProbeBrowser();
    const cases=['portrait','showcase'].flatMap(kind=>[true,false].map(captured=>({kind,captured,running:false})));
    if(mode==='fixed')cases.push({kind:'portrait',captured:false,running:true});
    for(const {kind,captured,running} of cases){
        rec={name:`${kind}-${captured?'capture':running?'live-running':'live-paused'}`,kind,captured,running,plates:[],intercepted:[],fixtureNetworkEvents:[]};report.cases.push(rec);save();
        page=await browser.newPage({viewport:{width:1280,height:1000},deviceScaleFactor:1,reducedMotion:captured||running?'no-preference':'reduce'});
        await page.addInitScript(()=>{
            const nativeRequest=requestAnimationFrame.bind(window),nativeCancel=cancelAnimationFrame.bind(window),pending=new Map();
            const counts={requested:0,invoked:0,canceled:0};
            window.requestAnimationFrame=callback=>{let id;id=nativeRequest(time=>{pending.delete(id);if(callback.name==='animate')counts.invoked++;callback(time);});
                pending.set(id,callback.name);if(callback.name==='animate')counts.requested++;return id;};
            window.cancelAnimationFrame=id=>{if(pending.get(id)==='animate')counts.canceled++;pending.delete(id);return nativeCancel(id);};
            window.lifecycleRafSnapshot=()=>({...counts,pendingAnimate:[...pending.values()].filter(name=>name==='animate').length});
        });
        page.on('pageerror',error=>report.errors.push({case:rec.name,kind:'pageerror',message:error.message}));
        page.on('console',message=>{if(message.type()==='error')report.errors.push({case:rec.name,kind:'console',message:message.text()});});
        page.on('requestfailed',request=>{
            const entry={url:request.url(),error:request.failure()?.errorText};
            if(request.isNavigationRequest()&&new URL(request.url()).searchParams.get('scene')==='kitchen')rec.fixtureNetworkEvents.push(entry);
            else report.errors.push({case:rec.name,kind:'requestfailed',...entry});
        });
        page.on('response',response=>{if(response.status()>=400)report.errors.push({case:rec.name,kind:'http',url:response.url(),status:response.status()});});
        const query=kind==='portrait'?'hair=bob02&bake=g050':'preset=casual&outfit=casual&frame=portrait';
        await page.goto(`${server.baseUrl}/src/${kind}.html?${query}&scene=studio${captured?'&capture=lifecycle':''}`);
        await page.waitForFunction(()=>window.portrait||window.showcase||!document.querySelector('#error').hidden,null,{timeout:120000});
        assert.equal(await page.locator('#error').textContent(),'');
        await page.evaluate(async captured=>{
            const v=window.portrait??window.showcase;window.lifecycleOriginalOwner=v.avatar;window.lifecycleDocumentId=crypto.randomUUID();
            for(let i=0;i<4;i++)await new Promise(requestAnimationFrame);
            if(captured)for(let i=0;i<64;i++)await v.step(0);
        },captured);
        rec.initial=await state();assert.equal(rec.initial.paused,!captured&&!running);assert.equal(rec.initial.raf.pendingAnimate,captured?0:1);
        if(captured||running){await page.locator('#look-toward-me').click();assert.equal((await state()).attention.phase,'attending');}
        await plate('before');
        await page.route('**/*',async route=>{
            const request=route.request(),url=new URL(request.url());
            if(request.isNavigationRequest()&&request.frame()===page.mainFrame()&&url.searchParams.get('scene')==='kitchen'){
                rec.intercepted.push({url:request.url(),status:204});await route.fulfill({status:204});
            }else await route.continue();
        });
        await page.locator('[data-scene="kitchen"]').click({noWaitAfter:true});
        await page.waitForFunction(()=>document.querySelector('#status').textContent.startsWith('Preparing'));
        rec.pending=await state();preserved(rec.initial,rec.pending,{clock:!running});assert.ok(rec.pending.controls.some(c=>c.disabled));
        assert.equal(rec.pending.attention.phase,'idle');assert.equal(rec.pending.attention.holdsGaze,false);
        await page.waitForFunction(()=>performance.getEntriesByType('navigation').length===1);
        // Yield normal browser tasks so204 is observed; this does not advance captured or paused motion.
        await page.evaluate(async()=>{for(let i=0;i<4;i++)await new Promise(requestAnimationFrame);});
        assert.equal(rec.intercepted.length,1,'actual room navigation was not intercepted exactly once');
        rec.hiddenAndRestored=await page.evaluate(()=>{
            const v=window.portrait??window.showcase,a=v.avatar;
            const before={clock:a.clockSeconds,paused:document.querySelector('#pause').getAttribute('aria-pressed')};
            dispatchEvent(new PageTransitionEvent('pagehide',{persisted:true}));
            const hidden={raf:lifecycleRafSnapshot(),disposed:lifecycleOriginalOwner.disposed,clock:a.clockSeconds};
            dispatchEvent(new PageTransitionEvent('pageshow',{persisted:true}));
            return {before,hidden,shown:{raf:lifecycleRafSnapshot(),disposed:lifecycleOriginalOwner.disposed,clock:a.clockSeconds,paused:document.querySelector('#pause').getAttribute('aria-pressed')}};
        });
        rec.restored=await state();preserved(rec.pending,rec.restored,{clock:!running});
        assert.equal(rec.hiddenAndRestored.before.clock,rec.hiddenAndRestored.hidden.clock);assert.equal(rec.hiddenAndRestored.before.clock,rec.hiddenAndRestored.shown.clock);
        assert.equal(rec.hiddenAndRestored.before.paused,rec.hiddenAndRestored.shown.paused);
        assert.equal(rec.hiddenAndRestored.hidden.raf.pendingAnimate,0);assert.equal(rec.hiddenAndRestored.hidden.disposed,false);
        assert.equal(rec.restored.raf.pendingAnimate,captured?0:1,'duplicate/missing page animation loop');
        assert.equal(rec.restored.attention.phase,'idle');assert.equal(rec.restored.attention.holdsGaze,false);
        rec.restorationDefect={disabledControls:rec.restored.controls.filter(c=>c.disabled),statusStuckPreparing:/Preparing/.test(rec.restored.status)};
        if(mode==='baseline'){
            assert.ok(rec.restorationDefect.disabledControls.length>0);assert.equal(rec.restorationDefect.statusStuckPreparing,true);
        }else{
            assert.deepEqual(rec.restored.controls,rec.initial.controls);assert.equal(rec.restorationDefect.statusStuckPreparing,false);
            assert.deepEqual(rec.restored.attentionButtons,rec.initial.attentionButtons);
            // Another valid hide/show cycle must retain one live RAF (or none in capture mode).
            await page.evaluate(()=>{dispatchEvent(new PageTransitionEvent('pagehide',{persisted:true}));dispatchEvent(new PageTransitionEvent('pageshow',{persisted:true}));});
            rec.secondRestore=await state();preserved(rec.restored,rec.secondRestore,{clock:!running});assert.equal(rec.secondRestore.raf.pendingAnimate,captured?0:1);
            if(running){await page.waitForFunction(clock=>portrait.avatar.clockSeconds>clock+.05,rec.secondRestore.clock);rec.resumed=await state();assert.equal(rec.resumed.raf.pendingAnimate,1);}
        }
        await plate('restored');
        if(mode==='fixed'&&kind==='showcase'&&captured){
            rec.nonNavigationBusy={before:await state()};
            await page.evaluate(()=>{
                const file=new File(['{}'],'unsupported-settings.json',{type:'application/json'});
                file.text=()=>new Promise(resolve=>{window.lifecycleResolveFile=resolve;});
                window.lifecycleOpenPromise=showcase.openLook(file);
            });
            rec.nonNavigationBusy.pending=await state();assert.equal(rec.nonNavigationBusy.pending.status,'Reading settings…');
            rec.nonNavigationBusy.configurationWhilePending=await page.evaluate(()=>{try{return{value:showcase.configuration()};}catch(error){return{error:error.message};}});
            assert.match(rec.nonNavigationBusy.configurationWhilePending.error,/Wait for the look/);
            await page.evaluate(()=>{dispatchEvent(new PageTransitionEvent('pagehide',{persisted:true}));dispatchEvent(new PageTransitionEvent('pageshow',{persisted:true}));});
            rec.nonNavigationBusy.restored=await state();preserved(rec.nonNavigationBusy.pending,rec.nonNavigationBusy.restored);
            assert.deepEqual(rec.nonNavigationBusy.restored.controls,rec.nonNavigationBusy.pending.controls);assert.equal(rec.nonNavigationBusy.restored.status,'Reading settings…');
            rec.nonNavigationBusy.configurationAfterRestore=await page.evaluate(()=>{try{return{value:showcase.configuration()};}catch(error){return{error:error.message};}});
            assert.match(rec.nonNavigationBusy.configurationAfterRestore.error,/Wait for the look/);
            rec.nonNavigationBusy.result=await page.evaluate(async()=>{lifecycleResolveFile('{}');return await lifecycleOpenPromise;});
            assert.equal(rec.nonNavigationBusy.result,false);rec.nonNavigationBusy.finished=await state();
            assert.deepEqual(rec.nonNavigationBusy.finished.controls,rec.initial.controls);assert.equal(rec.nonNavigationBusy.finished.status,'Settings not opened');
            rec.nonNavigationBusy.feedback=await page.locator('#settings-error').textContent();assert.match(rec.nonNavigationBusy.feedback,/current look is retained/);
        }
        if(mode==='fixed'&&kind==='portrait'&&captured){
            rec.normalForward={before:await state()};await page.unroute('**/*');
            await page.evaluate(()=>{
                const a=portrait.avatar,renderer=a.stage.renderer;
                addEventListener('pagehide',event=>sessionStorage.setItem('normal-forward-retirement',JSON.stringify({persisted:event.persisted,disposal:a.report().disposal,memory:renderer.info.memory})));
            });
            await Promise.all([page.waitForURL(url=>url.searchParams.get('scene')==='kitchen'),page.locator('[data-scene="kitchen"]').click()]);
            await page.waitForFunction(()=>window.portrait||!document.querySelector('#error').hidden,null,{timeout:120000});assert.equal(await page.locator('#error').textContent(),'');
            await page.evaluate(async()=>{window.lifecycleOriginalOwner=portrait.avatar;window.lifecycleDocumentId=crypto.randomUUID();for(let i=0;i<4;i++){await new Promise(requestAnimationFrame);await portrait.step(0);}for(let i=0;i<64;i++)await portrait.step(0);});
            rec.normalForward.after=await state();assert.notEqual(rec.normalForward.after.documentId,rec.normalForward.before.documentId);assert.equal(rec.normalForward.after.clock,0);
            rec.normalForward.native=await page.evaluate(()=>({scene:portrait.avatar.report().scene,identity:portrait.avatar.report().identity,hair:portrait.avatar.report().hair.loadedStyle,lightHidden:document.querySelector('#light-controls').hidden,
                retirement:JSON.parse(sessionStorage.getItem('normal-forward-retirement'))}));
            assert.equal(rec.normalForward.native.scene.id,'kitchen');assert.equal(rec.normalForward.native.scene.lighting.exposure,2.04);assert.equal(rec.normalForward.native.lightHidden,true);
            assert.deepEqual(rec.normalForward.native.identity,rec.initial.identity);assert.equal(rec.normalForward.native.hair,'bob02');
            if(!rec.normalForward.native.retirement.persisted){assert.equal(rec.normalForward.native.retirement.disposal.disposed,true);assert.deepEqual(rec.normalForward.native.retirement.disposal.leaked,[]);assert.ok(Object.values(rec.normalForward.native.retirement.memory).every(value=>value===0));}
        }
        rec.retirement=await page.evaluate(()=>{
            dispatchEvent(new PageTransitionEvent('pagehide',{persisted:true}));
            const v=window.portrait??window.showcase,a=v.avatar,renderer=a.stage.renderer;
            v.attention.dispose();v.controls.dispose();a.dispose();return{disposal:a.report().disposal,memory:structuredClone(renderer.info.memory),raf:lifecycleRafSnapshot()};
        });
        assert.equal(rec.retirement.disposal.disposed,true);assert.deepEqual(rec.retirement.disposal.leaked,[]);
        assert.ok(Object.values(rec.retirement.memory).every(value=>value===0));assert.equal(rec.retirement.raf.pendingAnimate,0);
        await page.close();page=null;rec.completed=true;save();console.log(`PASS ${mode} handler fixture ${rec.name}`);
    }
    assert.deepEqual(report.errors,[]);report.finalSourceHashes=hashes();assert.deepEqual(report.finalSourceHashes,report.sourceHashes);
    report.completed=true;save();console.log(`PASS ${mode}:${report.cases.length} native retained-document handler fixtures; actual BFcache not claimed`);
}catch(error){report.failure=error.stack;save();await page?.screenshot({path:path.join(out,'failure.png'),fullPage:true}).catch(()=>{});throw error;}
finally{await browser?.close();await server?.close();}
