/** Sole root UI run: local compound draft discard, not hair appearance qualification. */
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { ROOT, collectSourceHashes, hashFile, sha256 } from '../../../../tools/figure-pipeline/collar_replacement_manifest.mjs';
import { launchProbeBrowser } from '../../../../packages/core/src/render/MotionProbe.mjs';
const packet = ROOT + '/docs/evidence/nonhair-2026-10-03/hair-draft-reset';
const out = ROOT + '/captures/hair-draft-reset-2026-10-03-v1';
assert.ok(Date.now() < Date.parse('2026-10-04T00:02:00Z'), 'sole launch cutoff');
assert.ok(!fs.existsSync(out), 'fresh sole output');
fs.mkdirSync(out, {recursive:true});
const names = ['PLAN.md','BASELINE.json','EDIT.json','CRITIC-VALUE.md','CRITIC-SOURCE.md','ROOT-PREFLIGHT.json'];
const inputs = Object.fromEntries(names.map(n => [n,hashFile(packet+'/'+n)]));
const r = {pid:process.pid,started:new Date().toISOString(),command:'node '+packet+'/capture.mjs',status:'running',
    sources:collectSourceHashes(ROOT),inputs,instrumentSHA256:hashFile(new URL(import.meta.url)),
    cases:[],images:[],assets:[],errors:[],warnings:[],failedResources:[],retirements:[],cleanup:{},
    limits:['Real editor controls/configuration/native backend and sampled UI readability only, no new hair appearance/material/motion/fit/AAA qualification.',
        'DOM range/colour input edits plus real checkbox/mouse/keyboard Reset; no Apply/reload/callback substitution or source instrumentation.',
        'Capture mode paused; initial48 zero-delta public steps are fixed warmup, not convergence. Screenshots do not imply pixel identity.',
        'Busy/saving/failure inheritance is source-backed native fieldset semantics; no new induced failure/export job.']};
const save = () => fs.writeFileSync(out+'/report.json',JSON.stringify(r,null,2)+'\n');
save();let browser,page,failure;const reads=[];let navCount=0;
const snapshot = label => page.evaluate(label => {
    const a=showcase.avatar,report=a.report(),q=id=>document.querySelector('#'+id);
    const fields=Object.fromEntries(['hair-shade','hair-colour','hair-lightness','hair-tint-enabled','hair-tint-colour','hair-tint-amount'].map(id=>{
        const e=q(id);return [id,{value:e.value,checked:e.type==='checkbox'?e.checked:null,disabled:e.matches(':disabled')}];}));
    return {label,utc:new Date().toISOString(),fields,
        outputs:Object.fromEntries(['hair-lightness-value','hair-tint-amount-value','hair-colour-value','hair-colour-status'].map(id=>[id,q(id).textContent])),
        hidden:{base:q('hair-tint-controls').hidden,tint:q('hair-tint-mix').hidden},
        applyDisabled:q('apply-hair-colour').matches(':disabled'),resetDisabled:q('reset-hair-colour').matches(':disabled'),
        configuration:showcase.configuration(),url:location.href,storage:{local:{...localStorage},session:{...sessionStorage}},
        ownerSame:a===window.__hairResetOwner,attached:{identity:report.identity,hair:report.hair===null?null:{
            style:report.hair.style,loadedStyle:report.hair.loadedStyle,bake:report.hair.bake,attached:report.hair.attached,colour:report.hair.colour}},
        rawHair:report.hair,
        clock:{motion:report.motion.timeSeconds,utterance:a.clockSeconds},paused:q('pause').getAttribute('aria-pressed'),
        backend:a.stage.backendName,webGPU:a.stage.renderer.backend.isWebGPUBackend};
},label);
function preserve(before,after){
    for(const k of ['configuration','url','storage','attached','clock','paused']) assert.deepEqual(after[k],before[k],k);
    assert.equal(after.ownerSame,true);assert.equal(after.backend,'webgpu');assert.equal(after.webGPU,true);assert.equal(navCount,1,'no Reset navigation');
}
function resetEqual(before,after){preserve(before,after);for(const k of ['fields','outputs','hidden','applyDisabled','resetDisabled'])assert.deepEqual(after[k],before[k],k);}
async function record(row,label){const s=await snapshot(label);row.states.push(s);save();return s;}
async function edit(id,value){await page.locator('#'+id).evaluate((e,v)=>{e.value=String(v);e.dispatchEvent(new Event('input',{bubbles:true}));},value);}
async function reset(row,base,label,keyboard=false){
    assert.equal(await page.locator('#reset-hair-colour').isEnabled(),true,'dirty Reset enabled');
    if(keyboard){await page.locator('#reset-hair-colour').focus();assert.equal(await page.locator('#reset-hair-colour').evaluate(e=>e===document.activeElement),true);await page.keyboard.press('Enter');}
    else await page.locator('#reset-hair-colour').click();
    const s=await record(row,label);resetEqual(base,s);assert.equal(s.applyDisabled,true);assert.equal(s.resetDisabled,true);
}
async function shot(row,label){
    const el=page.locator('#hair-colours');await el.scrollIntoViewIfNeeded();
    await page.evaluate(()=>showcase.avatar.stage.draw());
    const geometry=await el.evaluate(e=>{const box=n=>{const b=n.getBoundingClientRect();return{x:b.x,y:b.y,width:b.width,height:b.height};};return{
        panel:box(e),buttons:[...e.querySelectorAll('.hair-colour-actions button')].map(b=>({text:b.textContent,...box(b)})),
        overflow:document.documentElement.scrollWidth>innerWidth,viewport:[innerWidth,innerHeight],open:e.open};});
    assert.equal(geometry.overflow,false);assert.equal(geometry.open,true);
    for(const b of geometry.buttons){assert.ok(b.height>=44);assert.ok(b.x>=0&&b.x+b.width<=geometry.viewport[0]);}
    const file=label+'.png';await el.screenshot({path:out+'/'+file});
    const image={file,sha256:hashFile(out+'/'+file),bytes:fs.statSync(out+'/'+file).size,geometry,case:row.name};r.images.push(image);save();
}
async function retire(label){
    if(!page)return;
    try {const observed=await page.evaluate(()=>{
        if(!window.showcase)return {attempts:[],errors:[],disposal:null};
        const attempts=[],errors=[];
        for(const [name,owner]of [['attention',showcase.attention],['controls',showcase.controls],['avatar',showcase.avatar]])
            try{owner.dispose();attempts.push({name,status:'returned'});}catch(e){attempts.push({name,status:'threw'});errors.push({name,text:e.stack??String(e)});}
        let disposal=null;try{disposal=showcase.avatar.report().disposal;}catch(e){errors.push({name:'report',text:e.stack??String(e)});}
        return {attempts,errors,disposal};
    });
        r.retirements.push({label,...observed});save();assert.deepEqual(observed.errors,[]);
        if(observed.disposal){assert.equal(observed.disposal.disposed,true);assert.deepEqual(observed.disposal.leaked,[]);}}
    finally {await page.close();assert.equal(page.isClosed(),true);r.cleanup[label]='page closed';page=null;save();}
}
try{
    browser=await launchProbeBrowser();
    const cases=[{name:'original'},{name:'brown',base:'#413934'},{name:'custom-zero',base:'#765344',tint:0},{name:'custom-nonzero',base:'#765344',tint:.25}];
    for(const c of cases){
        assert.ok(Date.now()<Date.parse('2026-10-04T00:18:00Z'),'work stop');
        const row={...c,states:[]};r.cases.push(row);save();
        page=await browser.newPage({viewport:{width:1440,height:1000},deviceScaleFactor:1,reducedMotion:'reduce'});page.setDefaultTimeout(15000);navCount=0;
        page.on('framenavigated',f=>{if(f===page.mainFrame())navCount++;});
        page.on('pageerror',e=>r.errors.push({case:c.name,text:e.stack??e.message}));
        page.on('console',m=>{if(m.type()==='error')r.errors.push({case:c.name,text:m.text()});if(m.type()==='warning')r.warnings.push({case:c.name,text:m.text()});});
        page.on('requestfailed',req=>r.failedResources.push({case:c.name,url:req.url(),failure:req.failure()}));
        page.on('response',res=>{if(res.status()>=400)r.errors.push({case:c.name,status:res.status(),url:res.url()});
            const u=new URL(res.url());if(res.ok()&&u.pathname.endsWith('.glb')&&!u.searchParams.has('import'))reads.push(res.body().then(b=>{
                const file=u.pathname.slice(u.pathname.indexOf('/assets/')+1);assert.equal(sha256(b),r.sources[file]);r.assets.push({case:c.name,file,sha256:sha256(b)});
            }).catch(e=>r.errors.push({case:c.name,text:e.stack??String(e)})));});
        const params=new URLSearchParams({preset:'casual',frame:'portrait',light:'neutral',capture:''});if(c.base)params.set('hairColour',c.base);
        if(c.tint!==undefined){params.set('hairTintColour','#8063ac');params.set('hairTintAmount',String(c.tint));}
        row.requestedURL='http://127.0.0.1:5173/src/showcase.html?'+params+'#hair-colours';
        await page.goto(row.requestedURL,{waitUntil:'domcontentloaded',timeout:45000});
        await page.waitForFunction(()=>window.showcase||!document.querySelector('#error').hidden,null,{timeout:45000});
        assert.equal(await page.locator('#error').textContent(),'');await page.waitForLoadState('networkidle',{timeout:15000});await Promise.all(reads);
        await page.evaluate(async()=>{window.__hairResetOwner=showcase.avatar;for(let i=0;i<48;i++)await showcase.step(0);showcase.avatar.stage.draw();});
        const base=await record(row,'loaded');assert.equal(base.ownerSame,true);assert.equal(base.applyDisabled,true);assert.equal(base.resetDisabled,true);
        assert.equal(base.configuration.hairColour??null,c.base??null);assert.equal(base.backend,'webgpu');assert.equal(base.webGPU,true);assert.equal(base.paused,'true');
        assert.equal(base.fields['hair-shade'].value,c.base?(c.name==='brown'?c.base:'custom'):'original');
        assert.equal(base.fields['hair-tint-enabled'].checked,c.tint!==undefined);
        if(c.tint!==undefined){assert.deepEqual(base.configuration.hairTint,{colour:'#8063ac',amount:c.tint});assert.equal(base.fields['hair-tint-amount'].value,String(c.tint*100));}
        if(c.name==='brown'){
            await page.locator('#hair-tint-enabled').check();await edit('hair-tint-colour','#224466');await edit('hair-tint-amount',63);await shot(row,'brown-dirty');
            await page.locator('#hair-tint-enabled').uncheck();const off=await record(row,'edited-tint-off');preserve(base,off);assert.equal(off.applyDisabled,true);assert.equal(off.resetDisabled,false);
            await page.locator('#hair-tint-enabled').check();const on=await record(row,'ordinary-toggle-retains-edits');assert.equal(on.fields['hair-tint-colour'].value,'#224466');assert.equal(on.fields['hair-tint-amount'].value,'63');
            await page.locator('#hair-tint-enabled').uncheck();await reset(row,base,'reset-inactive-memory');
            await page.locator('#hair-tint-enabled').check();const restored=await record(row,'reset-memory-then-enable');assert.equal(restored.fields['hair-tint-colour'].value,base.fields['hair-tint-colour'].value);assert.equal(restored.fields['hair-tint-amount'].value,base.fields['hair-tint-amount'].value);await reset(row,base,'reset-enabled-proposal');
        }else{
            await page.locator('#hair-shade').selectOption(c.name==='original'?'#413934':'original');
            if(c.name==='original'){await edit('hair-lightness',61);await page.locator('#hair-tint-enabled').check();await edit('hair-tint-colour','#224466');await edit('hair-tint-amount',63);}
            const dirty=await record(row,'compound-dirty');preserve(base,dirty);assert.equal(dirty.applyDisabled,false);assert.equal(dirty.resetDisabled,false);
            await reset(row,base,'reset-compound');
        }
        await shot(row,c.name+'-reset');
        // Restore exact underlying HSL/proposal: identical real next-range-key behaviour after two resets.
        if(c.name==='original')await page.locator('#hair-shade').selectOption('custom');
        await page.locator('#hair-lightness').focus();await page.keyboard.press('ArrowRight');const first=await record(row,'first-next-lightness');
        await reset(row,base,'reset-next-lightness');
        if(c.name==='original')await page.locator('#hair-shade').selectOption('custom');
        await page.locator('#hair-lightness').focus();await page.keyboard.press('ArrowRight');const second=await record(row,'second-next-lightness');
        for(const k of ['fields','outputs','hidden','applyDisabled','resetDisabled'])assert.deepEqual(second[k],first[k],k+' next-edit parity');preserve(base,second);
        await reset(row,base,'reset-second-lightness');
        if(c.name==='brown'){
            await page.setViewportSize({width:390,height:844});await page.locator('#hair-tint-enabled').check();await edit('hair-lightness',61);await edit('hair-tint-amount',63);await record(row,'mobile-dirty');await shot(row,'mobile-dirty');
            await reset(row,base,'mobile-keyboard-reset',true);await shot(row,'mobile-reset');
        }
        assert.deepEqual(r.errors,[]);assert.deepEqual(r.failedResources,[]);await Promise.all(reads);await retire(c.name);
    }
    assert.equal(r.cases.length,4);assert.equal(r.images.length,7);assert.equal(r.retirements.length,4);assert.deepEqual(r.errors,[]);assert.deepEqual(r.failedResources,[]);r.status='observed';
}catch(e){failure=e;r.status='failed';r.errors.push({text:e.stack??String(e)});}
finally{
    try{await Promise.all(reads);await retire('partial-final');}catch(e){failure??=e;r.errors.push({text:e.stack??String(e)});}
    try{if(browser){await browser.close();r.cleanup.browserIsConnected=browser.isConnected();assert.equal(r.cleanup.browserIsConnected,false);}else r.cleanup.browser='not-created';}catch(e){failure??=e;r.errors.push({text:e.stack??String(e)});}
    try{assert.deepEqual(collectSourceHashes(ROOT),r.sources);for(const[n,h]of Object.entries(inputs))assert.equal(hashFile(packet+'/'+n),h);assert.equal(hashFile(new URL(import.meta.url)),r.instrumentSHA256);r.finalPinsUnchanged=true;assert.deepEqual(r.errors,[]);assert.deepEqual(r.failedResources,[]);}catch(e){failure??=e;r.errors.push({text:e.stack??String(e)});}
    if(failure)r.status='failed';r.finished=new Date().toISOString();save();
    console.log(JSON.stringify({pid:r.pid,started:r.started,finished:r.finished,status:r.status,cases:r.cases.length,images:r.images.length,errors:r.errors.length,failedResources:r.failedResources.length,warnings:r.warnings.length,cleanup:r.cleanup,reportSHA256:hashFile(out+'/report.json')}));
}
if(failure)throw failure;
