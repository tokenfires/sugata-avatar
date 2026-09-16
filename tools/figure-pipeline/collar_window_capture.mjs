// Bounded, matched-clock GPU still/motion study of the exact collar candidate and local lining.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {gzipSync} from 'node:zlib';
import {createServer} from 'vite';
import {launchProbeBrowser} from '../../packages/core/src/render/MotionProbe.mjs';
import {readGlb, readPrimitive} from '../lut-bake/glb.mjs';
import {collarBand} from './collar_lining_topology.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const ARCHIVE = ROOT + '/captures/collar-clearance-paused-2026-09-13';
const OUT = path.resolve(process.argv[2]), mode = process.argv[3] || 'still';
assert.ok(['still','motion'].includes(mode)); assert.equal(fs.existsSync(OUT), false); fs.mkdirSync(OUT, {recursive:true});
const sha = b => createHash('sha256').update(b).digest('hex');
const hashFile = p => sha(fs.readFileSync(p));
const candidateSHA256 = hashFile(ARCHIVE + '/casual-collar-v2.glb');
assert.equal(candidateSHA256, 'ca65319add5a41147df9d894aebe6441a9ab6f5131ee639dd49c3bef74861e5e');
const source = readPrimitive(readGlb(ROOT+'/assets/wardrobe/female_casualsuit01/g050.glb'),'female_casualsuit01');
const candidate = readPrimitive(readGlb(ARCHIVE+'/casual-collar-v2.glb'),'female_casualsuit01');
const band = collarBand(source.positions, source.indices, {width:.035});
fs.writeFileSync(OUT+'/band.json', JSON.stringify(band,null,2));
const frozen = JSON.parse(fs.readFileSync(ROOT+'/docs/evidence/collar-opening-2026-09-16.json')).sourceHashes;
const sources = () => Object.fromEntries(Object.keys(frozen).map(p => [p,hashFile(ROOT+'/'+p)]));
assert.deepEqual(sources(),frozen);
const toolNames=['collar_window_capture.mjs','collar_lining_topology.mjs','collar_lining_browser.mjs'];
for(const name of toolNames) fs.copyFileSync(ROOT+'/tools/figure-pipeline/'+name,OUT+'/'+name);
const report = {completed:false,mode,candidateSHA256,sourceHashes:sources(),
    toolHashes:Object.fromEntries(toolNames.map(n=>[n,hashFile(OUT+'/'+n)])),bandHash:hashFile(OUT+'/band.json'),
    scope:'Matched renderer frame epoch and native pose; zero-thickness local inside band, exact original vertex IDs and skinning. No shipping changes.',runs:[]};
const server=await createServer({configFile:ROOT+'/vite.config.js',server:{host:'127.0.0.1',port:5357,strictPort:true,hmr:false,watch:{ignored:['**']},fs:{allow:[ROOT]}},logLevel:'error'});
let browser;
const save=()=>fs.writeFileSync(OUT+'/report.json',JSON.stringify(report,null,2));
try {
    await server.listen(); browser=await launchProbeBrowser();
    const hairs=mode==='motion'?['bob02','bob01']:['bob02'];
    const arms=mode==='motion'?['candidate','lining']:['candidate','double','lining'];
    for(const hair of hairs) for(const arm of arms) {
        const name=hair+'-'+arm,dir=OUT+'/'+name; fs.mkdirSync(dir);
        const rec={name,hair,arm,errors:[],images:[],states:[],geometry:[]};report.runs.push(rec);save();
        const page=await browser.newPage({viewport:{width:1280,height:1050},deviceScaleFactor:1,reducedMotion:'no-preference'});
        page.on('pageerror',e=>rec.errors.push(String(e)));page.on('console',m=>{if(m.type()==='error')rec.errors.push(m.text());});
        try {
            // The existing elegant preset supplies bob01; its independent outfit selection keeps the tee.
            const preset=hair==='bob02'?'casual':'elegant';
            await page.goto('http://127.0.0.1:5357/src/showcase.html?preset='+preset+'&outfit=casual&frame=portrait&capture=');
            await page.waitForFunction(()=>window.showcase,null,{timeout:120000});
            rec.setup=await page.evaluate(async({ROOT,ARCHIVE,source,candidate,band,arm,hair})=>{
                window.avatar=showcase.avatar;window.helper=await import('/@fs'+ARCHIVE+'/browser.mjs');
                const a=avatar,outer=a.wardrobe.wornMeshes.get('female_casualsuit01');
                if(a.report().hair.loadedStyle!==hair)throw Error('Unexpected hair preset: '+a.report().hair.loadedStyle);
                if(!outer.geometry.attributes.position.array.every((v,i)=>v===source[i]))throw Error('Source geometry mismatch');
                const g=outer.geometry;g.attributes.position.array.set(candidate.positions);g.attributes.normal.array.set(candidate.normals);
                g.attributes.position.needsUpdate=true;g.attributes.normal.needsUpdate=true;g.computeBoundingBox();g.computeBoundingSphere();outer.computeBoundingSphere();
                if(arm==='double'){outer.material.side=2;outer.material.needsUpdate=true;}
                if(arm==='lining'){
                    const {installCollarLining}=await import('/@fs'+ROOT+'/tools/figure-pipeline/collar_lining_browser.mjs');
                    window.lining=installCollarLining(outer,band);
                }
                showcase.controls.target.copy(a.focus);showcase.controls.target.y+=.045;
                window.probe=await helper.setup(a,{arm:'owned',motion:'natural',yaw:12});
                for(let i=0;i<128;i++)await helper.draw(a);
                const adapter=await navigator.gpu.requestAdapter();
                return {configuration:showcase.configuration(),lining:window.lining?.report(),
                    gpu:{vendor:adapter.info.vendor,architecture:adapter.info.architecture,device:adapter.info.device,description:adapter.info.description,isFallbackAdapter:adapter.info.isFallbackAdapter??adapter.isFallbackAdapter},capture:probe.setupReport};
            },{ROOT,ARCHIVE,source:Array.from(source.positions),candidate:{positions:Array.from(candidate.positions),normals:Array.from(candidate.normals)},band,arm,hair});
            const state=()=>page.evaluate(async()=>({physical:await helper.physical(avatar),bones:Array.from(avatar.figure.body.skeleton.boneMatrices),morphs:Array.from(avatar.figure.body.morphTargetInfluences),rendererFrame:avatar.stage.renderer._nodes.nodeFrame.frameId}));
            const shot=async(label)=>{const bytes=await page.locator('#stage').screenshot();fs.writeFileSync(dir+'/'+label+'.png',bytes);rec.images.push({label,sha256:sha(bytes)});};
            await page.locator('#look-toward-me').click();
            const steps=mode==='motion'?270:90;
            for(let step=0;step<=steps;step++) {
                if(step)await page.evaluate(()=>helper.step(avatar,1/60));
                if(mode==='motion'&&step%3===0){await shot('frame-'+String(step).padStart(3,'0'));rec.states.push({step,...await state()});}
                if(mode==='motion'&&step%30===0){
                    const geometry=await page.evaluate(async ROOT=>{
                        const {snapshot}=await import('/@fs'+ROOT+'/captures/tee-neckline-2026-09-13/mesh-snapshot.mjs');
                        const result=snapshot(avatar);
                        if(window.lining){
                            const v=avatar.focus.clone(),m=lining.mesh;
                            m.updateMatrixWorld(true);const positions=new Float32Array(m.geometry.attributes.position.count*3);
                            for(let i=0;i<positions.length/3;i++)m.getVertexPosition(i,v).applyMatrix4(m.matrixWorld).toArray(positions,i*3);
                            result.lining={positions:Array.from(positions),indices:Array.from(m.geometry.index.array)};
                        }
                        return result;
                    },ROOT);
                    const file=name+'/meshes-'+step+'.json.gz',bytes=gzipSync(JSON.stringify(geometry));
                    fs.writeFileSync(OUT+'/'+file,bytes);rec.geometry.push({step,file,sha256:sha(bytes)});
                }
            }
            if(mode==='still') {
                rec.states.push({step:90,...await state()});await shot('front-native');
                for(const yaw of [12,-45,45,135,180]){
                    await page.evaluate(yaw=>helper.view(avatar,yaw),yaw);
                    for(let i=0;i<128;i++)await page.evaluate(()=>helper.draw(avatar));
                    await shot('yaw-'+yaw);rec.states.push({yaw,...await state()});
                }
            } else {
                // Posed positions are read after the actual GPU run, at its final native state.
                rec.finalLining=await page.evaluate(async()=>{
                    if(!window.lining)return null;
                    const v=avatar.focus.clone(),outer=avatar.wardrobe.wornMeshes.get('female_casualsuit01'),inner=lining.mesh;
                    outer.updateMatrixWorld(true);inner.updateMatrixWorld(true);
                    let max=0;for(const i of new Set(Array.from(inner.geometry.index.array))){const a=outer.getVertexPosition(i,v).applyMatrix4(outer.matrixWorld).clone();const b=inner.getVertexPosition(i,v).applyMatrix4(inner.matrixWorld);max=Math.max(max,a.distanceTo(b));}
                    return {maxOuterInnerPositionError:max,report:lining.report()};
                });
            }
            assert.deepEqual(rec.errors,[]);
        } catch(error){rec.failure=error.stack;throw error;}
        finally {
            try {rec.disposal=await page.evaluate(()=>{
                const a=window.avatar;if(!a)return null;const r=a.stage.renderer;
                window.lining?.dispose();showcase.attention.dispose();showcase.controls.dispose();
                if(window.probe)helper.dispose(a,probe);else a.dispose();
                return {memory:structuredClone(r.info.memory),leaks:a.leakedHandles()};
            });}finally{await page.close();save();}
        }
        assert.ok(Object.values(rec.disposal.memory).every(v=>v===0));assert.deepEqual(rec.disposal.leaks,[]);
        console.log('Completed '+name+' ('+rec.images.length+' frames)');save();
    }
    for(const hair of [...new Set(report.runs.map(r=>r.hair))]){
        const runs=report.runs.filter(r=>r.hair===hair),base=runs[0];
        for(const run of runs.slice(1))assert.deepEqual(run.states,base.states,'Matched physical states and renderer epochs');
    }
    assert.deepEqual(sources(),frozen);report.completed=true;
}catch(error){report.failure=error.stack;process.exitCode=1;}
finally{save();await browser?.close();await server.close();console.log(JSON.stringify({completed:report.completed,failure:report.failure}));}
