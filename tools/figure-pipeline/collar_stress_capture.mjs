// A bounded supported-API motion extension, with the previous accepted asset as a control.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {gzipSync} from 'node:zlib';
import {createServer} from 'vite';
import {launchProbeBrowser} from '../../packages/core/src/render/MotionProbe.mjs';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const OUT=path.resolve(process.argv[2]);assert.equal(fs.existsSync(OUT),false);fs.mkdirSync(OUT,{recursive:true});
const WINDOW=ROOT+'/captures/collar-window-2026-09-16';
const ARCHIVE=ROOT+'/captures/collar-clearance-paused-2026-09-13';
const sha=bytes=>createHash('sha256').update(bytes).digest('hex'),hashFile=file=>sha(fs.readFileSync(file));
const previousBytes=fs.readFileSync(WINDOW+'/accepted-before-install.glb');
const candidatePath=WINDOW+'/casual-collar-interior-v1.glb',candidateBytes=fs.readFileSync(candidatePath);
const previousSHA256=sha(previousBytes),candidateSHA256=sha(candidateBytes);
assert.equal(previousSHA256,'44ebc3eb3a09408a3563d369ae74be15a5bc4beb8040bc43c2c5446d6e65c783');
assert.equal(candidateSHA256,'d81a6730bde9d8fee4641e18d6f9f0e3922af420bb68eea3f44b661896aeec3a');
const phases=[
    {label:'happy',pad:{pleasure:.8,arousal:.8,dominance:1}},
    {label:'angry',pad:{pleasure:-.8,arousal:.8,dominance:1}},
    {label:'fearful',pad:{pleasure:-.8,arousal:.8,dominance:-1}}
];
const paths=[...new Set([
    ...Object.keys(JSON.parse(fs.readFileSync(WINDOW+'/owned-motion-v1/report.json')).sourceHashes),
    ...JSON.parse(fs.readFileSync(WINDOW+'/accepted-preservation-after.json')).files.map(f=>f.file),
    'packages/core/src/affect/AffectState.js','packages/core/src/affect/PostureLayer.js',
    'packages/core/src/affect/ExpressionLayer.js','packages/core/src/motion/Gesture.js',
    'tools/figure-pipeline/collar_stress_capture.mjs'
])];
const sources=()=>Object.fromEntries(paths.map(p=>[p,hashFile(ROOT+'/'+p)]));
const tools=['tools/figure-pipeline/collar_stress_capture.mjs',
    'captures/collar-clearance-paused-2026-09-13/browser.mjs',
    'captures/tee-neckline-2026-09-13/mesh-snapshot.mjs'];
const report={completed:false,mode:'expressive-stress',previousSHA256,candidateSHA256,candidatePath,assetLoading:'Both frozen assets routed into the real loader; installed default is unchanged.',phases,sourceHashes:sources(),
    toolHashes:Object.fromEntries(tools.map(p=>[p,hashFile(ROOT+'/'+p)])),runs:[],
    scope:'Supported feel/say APIs, native layers/clamps, synthetic gesture timing with no audio or model. Discrete CPU snapshots during real GPU rendering; no continuous collision proof.'};
fs.copyFileSync(fileURLToPath(import.meta.url),OUT+'/collar_stress_capture.mjs');
const save=()=>fs.writeFileSync(OUT+'/report.json',JSON.stringify(report,null,2));
const server=await createServer({configFile:ROOT+'/vite.config.js',server:{host:'127.0.0.1',port:5357,strictPort:true,hmr:false,watch:{ignored:['**']},fs:{allow:[ROOT]}},logLevel:'error'});
let browser;
try{
    await server.listen();browser=await launchProbeBrowser();
    for(const hair of ['bob02','bob01'])for(const arm of ['previous','owned']){
        const name=hair+'-'+arm,dir=OUT+'/'+name;fs.mkdirSync(dir);
        const rec={name,hair,arm,assetSHA256:arm==='owned'?candidateSHA256:previousSHA256,errors:[],loadedAssets:[],images:[],bodyImages:[],states:[],geometry:[],phases:[]};
        report.runs.push(rec);save();const reads=[];
        const page=await browser.newPage({viewport:{width:1280,height:1050},deviceScaleFactor:1,reducedMotion:'no-preference'});
        page.on('pageerror',e=>rec.errors.push(String(e)));page.on('console',m=>{if(m.type()==='error')rec.errors.push(m.text());});
        page.on('response',r=>{if(r.ok()&&/\/assets\/wardrobe\/female_casualsuit01\/g050\.glb(?:\?.*)?$/.test(r.url()))reads.push(r.body().then(b=>rec.loadedAssets.push({url:r.url(),sha256:sha(b)})));});
        await page.route(/\/assets\/wardrobe\/female_casualsuit01\/g050\.glb(?:\?.*)?$/,async route=>{
            if(new URL(route.request().url()).searchParams.has('import'))return route.continue();
            await route.fulfill({status:200,contentType:'model/gltf-binary',body:arm==='previous'?previousBytes:candidateBytes});
        });
        const draw=(count=128)=>page.evaluate(async count=>{for(let i=0;i<count;i++)await helper.draw(avatar);},count);
        const state=()=>page.evaluate(async()=>({physical:await helper.physical(avatar),bones:Array.from(avatar.figure.body.skeleton.boneMatrices),morphs:Array.from(avatar.figure.body.morphTargetInfluences),rendererFrame:avatar.stage.renderer._nodes.nodeFrame.frameId,
            affect:avatar.report().affect,gesture:avatar.gesture.report()}));
        const shot=async(label,body=false)=>{
            const bytes=await page.locator('#stage').screenshot();fs.writeFileSync(dir+'/'+label+'.png',bytes);
            (body?rec.bodyImages:rec.images).push({label,sha256:sha(bytes)});
        };
        const snapshot=async step=>{
            const geometry=await page.evaluate(async ROOT=>{
                const {snapshot}=await import('/@fs'+ROOT+'/captures/tee-neckline-2026-09-13/mesh-snapshot.mjs');const result=snapshot(avatar);
                const inner=avatar.wardrobe.fragments.get('female_casualsuit01').interior?.mesh;
                if(inner){inner.updateMatrixWorld(true);const v=avatar.focus.clone(),positions=new Float32Array(inner.geometry.attributes.position.count*3);
                    for(let i=0;i<positions.length/3;i++)inner.getVertexPosition(i,v).applyMatrix4(inner.matrixWorld).toArray(positions,i*3);
                    result.lining={positions:Array.from(positions),indices:Array.from(inner.geometry.index.array.slice(0,inner.geometry.drawRange.count))};}
                result.telemetry={affect:avatar.report().affect,gesture:avatar.gesture.report()};return result;
            },ROOT);
            const file=name+'/meshes-'+step+'.json.gz',bytes=gzipSync(JSON.stringify(geometry));fs.writeFileSync(OUT+'/'+file,bytes);rec.geometry.push({step,file,sha256:sha(bytes)});
        };
        try{
            await page.goto('http://127.0.0.1:5357/src/showcase.html?preset='+(hair==='bob02'?'casual':'elegant')+'&outfit=casual&style=ecru&frame=portrait&capture=');
            await page.waitForFunction(()=>window.showcase,null,{timeout:120000});await Promise.all(reads);
            assert.equal(rec.loadedAssets.length,1);assert.equal(rec.loadedAssets[0].sha256,rec.assetSHA256);
            rec.setup=await page.evaluate(async({ARCHIVE,hair,arm})=>{
                window.avatar=showcase.avatar;window.helper=await import('/@fs'+ARCHIVE+'/browser.mjs');
                const a=avatar,inner=a.wardrobe.fragments.get('female_casualsuit01').interior;
                if(a.report().hair.loadedStyle!==hair)throw Error('Wrong hair');
                if(arm==='owned'?!inner||inner.fullTriangles!==140:inner!==null)throw Error('Unexpected interior owner');
                showcase.controls.target.copy(a.focus);showcase.controls.target.y+=.045;
                window.probe=await helper.setup(a,{arm:'owned',motion:'natural',yaw:12});
                const c=a.stage.camera,t=a.focus.clone();t.y-=.03;
                const radius=Math.hypot(c.position.x-t.x,c.position.z-t.z)*1.25,r=25*Math.PI/180;
                c.position.set(t.x+Math.sin(r)*radius,t.y+.04,t.z+Math.cos(r)*radius);c.lookAt(t);
                showcase.controls.target.copy(t);showcase.controls.minDistance=radius*.7;showcase.controls.maxDistance=radius*1.5;showcase.controls.update();showcase.controls.saveState();
                for(let i=0;i<128;i++)await helper.draw(a);
                if(a.report().motion.seed!==20260807)throw Error('Unexpected motion seed');
                return{seed:a.report().motion.seed,configuration:showcase.configuration(),interiorTriangles:inner?.fullTriangles??0,capture:probe.setupReport};
            },{ARCHIVE,hair,arm});
            const snapshotSteps=new Set([1080]),bodySteps=new Set();
            for(let step=0;step<=1080;step++){
                if(step)await page.evaluate(()=>helper.step(avatar,1/60));
                if(step<1080&&step%360===0){
                    const phase=phases[step/360];
                    const schedule=await page.evaluate(async phase=>{
                        const a=avatar;a.feel(phase.label,1);a.feel(phase.pad);
                        await a.say('Closer, then farther.',{speechPlan:{synthetic:true,durationSeconds:6,words:[
                            {text:'closer',startTime:1.5,endTime:1.9,stressed:true,contrastGroup:'span'},
                            {text:'farther',startTime:4.5,endTime:4.9,stressed:true,contrastGroup:'span'}]}});
                        a.feel(phase.label,1);a.feel(phase.pad);
                        return structuredClone(a.gesture.schedule);
                    },phase);
                    assert.equal(schedule.gestures.length,2);assert.ok(schedule.gestures.every(g=>g.hand==='both'));
                    const peaks=schedule.gestures.map(g=>step+Math.ceil((g.strokeStart+.5*g.strokeSeconds)*60));
                    for(const offset of [0,36,156,330])snapshotSteps.add(step+offset);
                    for(const peak of peaks)snapshotSteps.add(peak);bodySteps.add(peaks[1]);
                    rec.phases.push({step,...phase,schedule,snapshotPeaks:peaks});
                }
                if(step%3===0){await shot('frame-'+String(step).padStart(4,'0'));rec.states.push({step,...await state()});}
                if(snapshotSteps.has(step))await snapshot(step);
                if(bodySteps.has(step)){
                    await page.evaluate(()=>{
                        const a=avatar,c=a.stage.camera,controls=showcase.controls;
                        window.savedView={position:c.position.clone(),quaternion:c.quaternion.clone(),target:controls.target.clone(),min:controls.minDistance,max:controls.maxDistance};
                        a.setFraming('body');controls.target.copy(a.focus);const d=c.position.distanceTo(a.focus);controls.minDistance=d*.7;controls.maxDistance=d*1.5;controls.update();
                    });await draw();await shot('body-'+step,true);
                    rec.bodyImages.at(-1).state=await state();
                    await page.evaluate(()=>{
                        const a=avatar,c=a.stage.camera,controls=showcase.controls;a.setFraming('portrait');
                        c.position.copy(savedView.position);c.quaternion.copy(savedView.quaternion);c.updateMatrixWorld(true);
                        controls.target.copy(savedView.target);controls.minDistance=savedView.min;controls.maxDistance=savedView.max;controls.update();controls.saveState();
                    });await draw();
                }
                if(step%60===0)save();
            }
            assert.deepEqual(rec.errors,[]);assert.equal(rec.geometry.length,19);
        }catch(error){rec.failure=error.stack;throw error;}
        finally{
            try{rec.disposal=await page.evaluate(()=>{
                const a=window.avatar;if(!a)return null;const r=a.stage.renderer;showcase.attention.dispose();showcase.controls.dispose();
                if(window.probe)helper.dispose(a,probe);else a.dispose();return{memory:structuredClone(r.info.memory),leaks:a.leakedHandles()};
            });}finally{await page.close();save();}
        }
        assert.ok(Object.values(rec.disposal.memory).every(v=>v===0));assert.deepEqual(rec.disposal.leaks,[]);
        console.log('Completed '+name+' ('+rec.images.length+' frames, '+rec.geometry.length+' geometry snapshots)');
    }
    for(const hair of ['bob02','bob01']){
        const [previous,owned]=report.runs.filter(r=>r.hair===hair);
        assert.deepEqual(previous.states,owned.states,'Paired source/owned physical state, telemetry and renderer clocks');
        assert.deepEqual(previous.phases,owned.phases);
        assert.deepEqual(previous.bodyImages.map(i=>i.state),owned.bodyImages.map(i=>i.state));
    }
    assert.deepEqual(sources(),report.sourceHashes);report.completed=true;
}catch(error){report.failure=error.stack;process.exitCode=1;}
finally{save();await browser?.close();await server.close();console.log(JSON.stringify({completed:report.completed,failure:report.failure}));}
