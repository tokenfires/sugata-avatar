// Actual GLTFLoader/Wardrobe adoption of the qualified metadata asset, before promotion.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { createServer } from 'vite';
import { launchProbeBrowser } from '../../packages/core/src/render/MotionProbe.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const ARCHIVE = ROOT + '/captures/collar-clearance-paused-2026-09-13';
const ASSET = ROOT + '/captures/collar-window-2026-09-16/casual-collar-interior-v1.glb';
const OUT = path.resolve(process.argv[2]), mode = process.argv[3] || 'views';
assert.ok(['views', 'motion', 'wardrobe', 'rear'].includes(mode));
assert.equal(fs.existsSync(OUT), false); fs.mkdirSync(OUT, {recursive:true});
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const hashFile = file => sha(fs.readFileSync(file));
const assetBytes = fs.readFileSync(ASSET);
const candidateSHA256 = sha(assetBytes);
assert.equal(candidateSHA256, 'd81a6730bde9d8fee4641e18d6f9f0e3922af420bb68eea3f44b661896aeec3a');
const paths = [...new Set([
    ...Object.keys(JSON.parse(fs.readFileSync(ROOT+'/docs/evidence/collar-opening-2026-09-16.json')).sourceHashes),
    'packages/core/src/wardrobe/GarmentInterior.js', 'packages/core/src/wardrobe/WardrobeStyles.js',
    'tools/figure-pipeline/collar_owned_capture.mjs'
])];
const sources = () => Object.fromEntries(paths.map(p=>[p,hashFile(ROOT+'/'+p)]));
const report = {completed:false, mode, candidateSHA256, sourceHashes:sources(), runs:[],
    scope:'Actual loader and owned interior. Only the casual GLB response is replaced; installed asset is preserved. Matched clocks, no geometry mutation.'};
fs.copyFileSync(fileURLToPath(import.meta.url), OUT+'/collar_owned_capture.mjs');
const save = () => fs.writeFileSync(OUT+'/report.json',JSON.stringify(report,null,2));
const server = await createServer({configFile:ROOT+'/vite.config.js', server:{host:'127.0.0.1',port:5357,strictPort:true,hmr:false,watch:{ignored:['**']},fs:{allow:[ROOT]}},logLevel:'error'});
let browser;
try {
    await server.listen(); browser = await launchProbeBrowser();
    const specs = mode==='views'
        ? ['ecru','charcoal','original'].flatMap(style=>['control','owned'].map(arm=>({style,arm})))
        : mode==='rear'
            ? ['control','owned','double'].map(arm=>({style:'ecru',arm}))
        : mode==='motion'
            ? [-60,60].flatMap(yaw=>['control','owned'].map(arm=>({style:'ecru',arm,yaw})))
            : [{style:'ecru',arm:'owned'}];
    for(const spec of specs) {
        const name = spec.style+'-'+spec.arm+(spec.yaw===undefined?'':'-'+spec.yaw);
        const dir = OUT+'/'+name;fs.mkdirSync(dir);
        const rec = {name,...spec,errors:[],assetResponses:[],images:[],states:[],wardrobe:[]};report.runs.push(rec);save();
        const page = await browser.newPage({viewport:{width:1280,height:1050},deviceScaleFactor:1,reducedMotion:'no-preference'});
        page.on('pageerror',e=>rec.errors.push(String(e)));
        page.on('console',m=>{if(m.type()==='error')rec.errors.push(m.text());});
        await page.route(/\/assets\/wardrobe\/female_casualsuit01\/g050\.glb(?:\?.*)?$/,async route=>{
            const url=route.request().url();
            if(new URL(url).searchParams.has('import')) return route.continue();
            rec.assetResponses.push({url,sha256:candidateSHA256,bytes:assetBytes.length});
            await route.fulfill({status:200,contentType:'model/gltf-binary',body:assetBytes});
        });
        const draw = async(count=128)=>page.evaluate(async count=>{for(let i=0;i<count;i++)await helper.draw(avatar);},count);
        const state = ()=>page.evaluate(async()=>({physical:await helper.physical(avatar),bones:Array.from(avatar.figure.body.skeleton.boneMatrices),morphs:Array.from(avatar.figure.body.morphTargetInfluences),rendererFrame:avatar.stage.renderer._nodes.nodeFrame.frameId}));
        const shot = async label=>{const bytes=await page.locator('#stage').screenshot();fs.writeFileSync(dir+'/'+label+'.png',bytes);rec.images.push({label,sha256:sha(bytes)});rec.states.push({label,...await state()});save();};
        const view = async(yaw,pitch,body=false)=>page.evaluate(({yaw,pitch,body})=>{
            const a=avatar,c=a.stage.camera,t=a.focus.clone();
            if(body) { a.setFraming('body');t.copy(a.focus); }
            else t.y-=.06;
            const radius=body?Math.hypot(c.position.x-t.x,c.position.z-t.z):window.portraitRadius;
            const r=yaw*Math.PI/180;
            c.position.set(t.x+Math.sin(r)*radius,t.y+Math.tan(pitch*Math.PI/180)*radius,t.z+Math.cos(r)*radius);
            c.lookAt(t);c.updateMatrixWorld(true);showcase.controls.target.copy(t);
            const distance=c.position.distanceTo(t);showcase.controls.minDistance=distance*.7;showcase.controls.maxDistance=distance*1.5;
            showcase.controls.update();showcase.controls.saveState();
        },{yaw,pitch,body});
        try {
            await page.goto('http://127.0.0.1:5357/src/showcase.html?preset=casual&outfit=casual&frame=portrait&capture=&style='+spec.style);
            await page.waitForFunction(()=>window.showcase,null,{timeout:120000});
            assert.equal(rec.assetResponses.length,1,'exact candidate must pass through real loader');
            rec.setup=await page.evaluate(async({ARCHIVE,arm,style})=>{
                window.avatar=showcase.avatar;window.helper=await import('/@fs'+ARCHIVE+'/browser.mjs');
                const a=avatar,f=a.wardrobe.fragments.get('female_casualsuit01'),outer=a.wardrobe.wornMeshes.get('female_casualsuit01');
                const inside=f.interior;
                if(!inside||inside.fullTriangles!==140||inside.mesh.parent!==outer||inside.mesh.skeleton!==outer.skeleton||inside.mesh.material.side!==1||outer.material.side!==0)throw Error('Owned interior adoption mismatch');
                const digest=async array=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',array.buffer.slice(array.byteOffset,array.byteOffset+array.byteLength)))).map(v=>v.toString(16).padStart(2,'0')).join('');
                const geometry={position:await digest(outer.geometry.attributes.position.array),normal:await digest(outer.geometry.attributes.normal.array),index:await digest(outer.geometry.index.array)};
                const owned={fullTriangles:inside.fullTriangles,drawnTriangles:inside.drawnTriangles,sourceTriangles:inside.sourceTriangles,material:inside.mesh.material.type,castShadow:inside.mesh.castShadow,receiveShadow:inside.mesh.receiveShadow,positionNode:!!inside.mesh.material.positionNode};
                if(arm!=='owned'){inside.dispose();f.interior=null;}
                if(arm==='double'){outer.material.side=2;outer.material.needsUpdate=true;}
                window.portraitRadius=Math.hypot(a.stage.camera.position.x-a.focus.x,a.stage.camera.position.z-a.focus.z);
                showcase.controls.target.copy(a.focus);showcase.controls.target.y+=.045;
                window.probe=await helper.setup(a,{arm:'owned',motion:'natural',yaw:12});
                for(let i=0;i<128;i++)await helper.draw(a);
                const adapter=await navigator.gpu.requestAdapter();
                return {configuration:showcase.configuration(),geometry,owned,style,
                    gpu:{vendor:adapter.info.vendor,architecture:adapter.info.architecture,isFallbackAdapter:adapter.info.isFallbackAdapter??adapter.isFallbackAdapter},capture:probe.setupReport};
            },{ARCHIVE,arm:spec.arm,style:spec.style});
            await page.locator('#look-toward-me').click();
            if(mode==='motion') {
                await view(spec.yaw,20);await draw();
                for(let step=0;step<=270;step++){
                    if(step)await page.evaluate(()=>helper.step(avatar,1/60));
                    if(step%3===0)await shot('frame-'+String(step).padStart(3,'0'));
                }
            } else {
                await page.evaluate(async()=>{for(let i=0;i<90;i++)await helper.step(avatar,1/60);});
                await shot('native-front');
                if(mode==='views'||mode==='rear'){
                    for(const [label,yaw,pitch,body] of [
                        ['elevated-left',-60,20,false],['elevated-right',60,20,false],['elevated-rear',135,25,false],
                        ['body-front',0,0,true],['body-rear',180,0,true]
                    ]){
                        if(mode==='rear'&&body)continue;
                        await view(yaw,pitch,body);await draw();await shot(label);
                        if(mode==='rear'&&spec.arm==='control'&&label==='elevated-rear'){
                            const points=[];for(let y=385;y<=402;y++)for(let x=488;x<=512;x++)points.push({label:'rear',x:x+.5,y:y+.5});
                            const rays=await page.evaluate(async({ROOT,points})=>{const picker=await import('/@fs'+ROOT+'/tools/figure-pipeline/collar_opening_browser.mjs');return picker.pick(avatar,points);},{ROOT,points});
                            fs.writeFileSync(dir+'/rays.json',JSON.stringify(rays));rec.raysSHA256=hashFile(dir+'/rays.json');
                        }
                    }
                } else {
                    await view(0,0,true);await draw();await shot('casual-body');
                    rec.wardrobe.push(await page.evaluate(async()=>{
                        const a=avatar,w=a.wardrobe,f=w.fragments.get('female_casualsuit01');window.originalInterior=f.interior;
                        window.disposedCounts={geometry:0,material:0,skeleton:0};
                        f.interior.mesh.geometry.addEventListener('dispose',()=>disposedCounts.geometry++);
                        f.interior.mesh.material.addEventListener('dispose',()=>disposedCounts.material++);
                        const skeleton=a.figure.body.skeleton,disposeSkeleton=skeleton.dispose;
                        skeleton.dispose=function(){disposedCounts.skeleton++;return disposeSkeleton.call(this);};
                        await a.dress(['female_elegantsuit01','shoes01']);
                        if(f.interior!==originalInterior||f.mesh?.parent||w.wornMeshes.has('female_casualsuit01'))throw Error('Unexpected cached owner state');
                        return {state:'elegant',stats:w.stats(),ownerAttachedToOuter:originalInterior.mesh.parent!==null};
                    }));
                    await draw();await shot('elegant');
                    rec.wardrobe.push(await page.evaluate(async()=>{
                        await avatar.dress(['female_casualsuit01','shoes01']);
                        if(avatar.wardrobe.fragments.get('female_casualsuit01').interior!==originalInterior)throw Error('Cached owner replaced');
                        return {state:'cached-return',stats:avatar.wardrobe.stats(),sameInterior:true};
                    }));
                    await draw();await shot('cached-return');
                    for(const torso of ['foundation_bra','foundation_vest'])for(const hips of ['foundation_briefs','foundation_boxer_brief']){
                        const label=torso+'-'+hips;
                        rec.wardrobe.push(await page.evaluate(async({torso,hips})=>{
                            const a=avatar;a.wardrobeAssets.foundation.prefer('TORSO',torso);a.wardrobeAssets.foundation.prefer('HIPS',hips);
                            await a.dress([]);const stats=a.wardrobe.stats();
                            if(stats.worn.length!==2||!stats.worn.includes(torso)||!stats.worn.includes(hips))throw Error('Wrong foundation floor');
                            return {state:torso+'-'+hips+'-floor',stats};
                        },{torso,hips}));
                        await draw();await shot(label+'-floor');
                        rec.wardrobe.push(await page.evaluate(async()=>{await avatar.dress(['female_casualsuit01','shoes01']);return{state:'redressed',stats:avatar.wardrobe.stats()};}));
                        await draw();await shot(label+'-dressed');
                    }
                    for(let cycle=0;cycle<3;cycle++){
                        const result=await page.evaluate(async cycle=>{
                            const a=avatar,w=a.wardrobe;const previous=w.fragments.get('female_casualsuit01').interior;
                            await a.dress([]);if(!w.release('female_casualsuit01'))throw Error('Release failed');
                            if(previous.mesh.parent!==null)throw Error('Released interior still attached');
                            await a.dress(['female_casualsuit01','shoes01']);
                            const current=w.fragments.get('female_casualsuit01').interior;
                            if(!current||current===previous||current.fullTriangles!==140)throw Error('Interior reload failed');
                            return{cycle,disposedCounts:{...disposedCounts},stats:w.stats()};
                        },cycle);
                        await draw();result.memory=await page.evaluate(()=>structuredClone(avatar.stage.renderer.info.memory));
                        rec.wardrobe.push(result);await shot('reload-'+cycle);
                    }
                    assert.equal(rec.assetResponses.length,4);
                    const cycles=rec.wardrobe.filter(v=>v.cycle!==undefined);
                    for(const cycle of cycles){assert.deepEqual(cycle.disposedCounts,{geometry:1,material:1,skeleton:0});assert.deepEqual(cycle.memory,cycles[0].memory);}
                }
            }
            rec.finalState=await page.evaluate(()=>({stats:avatar.wardrobe.stats(),memory:structuredClone(avatar.stage.renderer.info.memory)}));
            assert.deepEqual(rec.errors,[]);
        } catch(error){rec.failure=error.stack;throw error;}
        finally {
            try{rec.disposal=await page.evaluate(()=>{
                const a=window.avatar;if(!a)return null;const r=a.stage.renderer;
                showcase.attention.dispose();showcase.controls.dispose();if(window.probe)helper.dispose(a,probe);else a.dispose();
                return{memory:structuredClone(r.info.memory),leaks:a.leakedHandles()};
            });}finally{await page.close();save();}
        }
        assert.ok(Object.values(rec.disposal.memory).every(v=>v===0));assert.deepEqual(rec.disposal.leaks,[]);
        console.log('Completed '+name+' ('+rec.images.length+' images)');save();
    }
    if(mode!=='wardrobe')for(const run of report.runs.filter(r=>r.arm!=='control')){
        const control=report.runs.find(r=>r.arm==='control'&&r.style===run.style&&r.yaw===run.yaw);
        assert.deepEqual(run.states,control.states,'Matched physical states and renderer clocks');
        assert.deepEqual(run.setup.geometry,control.setup.geometry);
    }
    assert.deepEqual(sources(),report.sourceHashes);report.completed=true;
}catch(error){report.failure=error.stack;process.exitCode=1;}
finally{save();await browser?.close();await server.close();console.log(JSON.stringify({completed:report.completed,failure:report.failure}));}
