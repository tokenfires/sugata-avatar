#!/usr/bin/env node
// Replays the public portrait, reads actual GPU hair centers/vertices, and measures them against
// the same frame's morphed/skinned body. Output cadence is not a frame-time benchmark.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { Matrix4, Vector3 } from 'three';
import { SurfaceGrid } from '../figure-pipeline/hair_geometry.mjs';

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const options = { url:'http://127.0.0.1:5197/src/portrait.html?hair=bob02&capture', out:null,
    groom:null, stimulus:'idle', direction:1, seconds:12, fps:60, stride:60, playwright:process.env.PLAYWRIGHT_MODULE };
for(let i=2;i<process.argv.length;i+=2){
    const key=process.argv[i].slice(2).replace(/-([a-z])/g,(_,s)=>s.toUpperCase());
    if(!(key in options) || process.argv[i+1]===undefined) throw new Error(`Unknown/missing option ${process.argv[i]}`);
    options[key]=['seconds','fps','stride','direction'].includes(key)?Number(process.argv[i+1]):process.argv[i+1];
}
if(!options.out)throw new Error('--out is required; each candidate must have its own evidence directory.');
for(const key of ['seconds','fps','stride'])if(!Number.isFinite(options[key])||options[key]<=0)throw new Error(`Invalid ${key}`);
if(!Number.isInteger(options.stride))throw new Error('--stride must be an integer.');
if(![1,-1].includes(options.direction))throw new Error('--direction must be 1 or -1.');
if(!['idle','shake','nod','tilt'].includes(options.stimulus))throw new Error('--stimulus must be idle, shake, nod or tilt.');
options.out=path.resolve(options.out);
if(fs.existsSync(options.out)&&fs.readdirSync(options.out).length)throw new Error('Evidence directory is not empty; use a new --out.');
fs.mkdirSync(options.out,{recursive:true});
const cache=path.join(os.homedir(),'.npm/_npx');
const candidates=[options.playwright,'playwright',...(fs.existsSync(cache)?fs.readdirSync(cache).map(x=>path.join(cache,x,'node_modules/playwright')):[])].filter(Boolean);
let playwright;
for(const candidate of candidates){try{playwright=require(candidate);break;}catch{}}
if(!playwright)throw new Error('Playwright not found; supply --playwright or PLAYWRIGHT_MODULE.');
const browser=await playwright.chromium.launch({channel:'chromium',headless:true,
    args:['--enable-unsafe-webgpu','--ignore-gpu-blocklist','--hide-scrollbars']});
const samples=[],errors=[];
let replacedGroomRequests=0;
const sha=file=>createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const sourceHashes=Object.fromEntries(['packages/core/src/Avatar.js','packages/core/src/motion/HairDynamics.js','packages/core/src/material/HairMaterial.js','packages/testbed/src/portrait.js','tools/critic/portrait-clearance.mjs'].map(file=>[file,sha(path.join(root,file))]));
sourceHashes.groom=sha(options.groom??path.join(root,'assets/hair/bob02/g050.glb'));
let descriptor;
function summary(values){
    if(!values.length)return {count:0,minMm:null,p01Mm:null,medianMm:null,inside:0};
    values.sort((a,b)=>a-b);
    return {count:values.length,minMm:values[0]*1000,p01Mm:values[Math.floor((values.length-1)*.01)]*1000,
        medianMm:values[Math.floor((values.length-1)*.5)]*1000,inside:values.filter(v=>v<-.0001).length};
}
try{
    const page=await browser.newPage({viewport:{width:1200,height:900},deviceScaleFactor:1});
    // Keep Vite source edits in another probe from resetting this fixed-step capture.
    // The portrait has no application WebSocket; local sockets here belong to Vite HMR.
    await page.routeWebSocket(url=>url.host===new URL(options.url).host,()=>{});
    page.on('pageerror',e=>errors.push(e.message));
    page.on('console',message=>{if(message.type()==='error')errors.push(message.text());});
    page.on('requestfailed',request=>errors.push(`${request.url()} ${request.failure()?.errorText}`));
    page.on('response',r=>{if(r.status()>=400)errors.push(`${r.status()} ${r.url()}`);});
    if(options.groom){
        const asset=fs.readFileSync(path.resolve(options.groom));
        await page.route('**/assets/hair/bob02/g050.glb*',route=>{replacedGroomRequests++;return route.fulfill({status:200,contentType:'model/gltf-binary',body:asset});});
    }
    await page.goto(options.url,{waitUntil:'domcontentloaded'});
    await page.waitForFunction(()=>!!window.portrait||!document.querySelector('#error').hidden,null,{timeout:90000});
    const failure=await page.locator('#error').textContent();if(failure)throw new Error(failure);
    if(options.groom&&replacedGroomRequests!==1)throw new Error(`Expected exactly one substituted groom request, got ${replacedGroomRequests}.`);
    if(options.stimulus!=='idle')await page.evaluate(async({root,stimulus,direction})=>{
        const base='/@fs'+root+'/packages/core/src/motion/';
        const [{Layer},{restRotationRelativeToRig,toBoneDeltaFrame}]=await Promise.all([import(base+'Layer.js'),import(base+'Breath.js')]);
        for(const layer of avatar.stack.layers)layer.enabled=false;
        await portrait.step(0);
        const head=avatar.figure.root.getObjectByName('head');
        const rest=restRotationRelativeToRig(head,avatar.figure.root),q=head.quaternion.clone(),delta=q.clone();
        const axis=avatar.focus.clone().fromArray({shake:[0,1,0],nod:[1,0,0],tilt:[0,0,1]}[stimulus]);
        const amplitude=(stimulus==='shake'?.85:.5)*direction;
        class Shake extends Layer{
            constructor(){super({name:'clearanceShake',order:500,boneChannels:['head']});}
            update(dt,context){
                q.setFromAxisAngle(axis,amplitude*Math.sin(2*Math.PI*.6*Math.min(context.time,2)));
                this.contribution.rotateBone('head',toBoneDeltaFrame(q,rest,delta));return this.contribution;
            }
        }
        avatar.stack.add(new Shake());avatar.hairDynamics.reset();await portrait.step(0);
    },{root,stimulus:options.stimulus,direction:options.direction});
    // Warm the render/temporal history without advancing the animation clock.
    for(let warm=0;warm<8;warm++)await page.evaluate(()=>portrait.step(0));
    descriptor=await page.evaluate(()=>{
        const d=avatar.hairDynamics,g=d.groom;
        let hairGeometry;avatar.hairRoot.traverse(o=>{if(o.isSkinnedMesh)hairGeometry=o.geometry;});
        const allIndices=Array.from(hairGeometry.index.array),cardIndices=[];
        for(let i=0;i<allIndices.length;i+=3)if(allIndices.slice(i,i+3).every(v=>v>=g.cardVertexBase&&v<g.cardVertexBase+g.cardVertexCount))cardIndices.push(...allIndices.slice(i,i+3).map(v=>v-g.cardVertexBase));
        return {chainCount:g.chainCount,pointsPerChain:g.pointsPerChain,cardVertexBase:g.cardVertexBase,
            cardVertexCount:g.cardVertexCount,cardIndices,restCentres:Array.from(g.restCentres),restLengths:Array.from(g.restLengths),report:avatar.report()};
    });
    const steps=Math.round(options.seconds*options.fps);
    for(let frame=0;frame<=steps;frame++){
        if(options.stimulus==='idle'&&frame===Math.round(3*options.fps))await page.locator('[data-expression="joy"]').click();
        if(options.stimulus==='idle'&&frame===Math.round(7*options.fps))await page.locator('[data-expression="curious"]').click();
        if(frame>0)await page.evaluate(dt=>portrait.step(dt),1/options.fps);
        if(frame%options.stride!==0&&frame!==steps)continue;
        const state=await page.evaluate(async()=>{
            const d=avatar.hairDynamics,centers=await d.readCentrelines(),body=avatar.figure.body;
            const p=body.geometry.getAttribute('position'),v=avatar.focus.clone(),positions=new Float32Array(p.count*3);
            body.skeleton.update();
            for(let i=0;i<p.count;i++){body.getVertexPosition(i,v).applyMatrix4(body.matrixWorld);v.toArray(positions,i*3);}
            // Match the renderer's morph and skin normal path. Recomputing normals from the
            // triangle positions can reverse signed-distance classification at body seams.
            const normals=new Float32Array(p.count*3),baseNormal=body.geometry.getAttribute('normal');
            const morphNormals=body.geometry.morphAttributes.normal??[],weights=body.morphTargetInfluences??[];
            const baseWeight=body.geometry.morphTargetsRelative?1:1-weights.reduce((a,b)=>a+b,0);
            const normal4=d.uniforms.skull.value.clone(),delta=v.clone();
            const normalMatrix=body.normalMatrix.clone().getNormalMatrix(body.matrixWorld);
            for(let i=0;i<p.count;i++){
                v.fromBufferAttribute(baseNormal,i);
                if(morphNormals.length){v.multiplyScalar(baseWeight);for(let m=0;m<morphNormals.length;m++)if(weights[m])v.addScaledVector(delta.fromBufferAttribute(morphNormals[m],i),weights[m]);}
                normal4.set(v.x,v.y,v.z,0);body.applyBoneTransform(i,normal4);
                v.set(normal4.x,normal4.y,normal4.z).applyMatrix3(normalMatrix).normalize().toArray(normals,i*3);
            }
            const vertices=typeof d.readVertices==='function'?await d.readVertices():null;
            return {time:avatar.clockSeconds,centers:Array.from(centers.positions),headMatrix:centers.headMatrix,
                skull:centers.skull,steps:centers.steps,vertices:vertices?Array.from(vertices.positions):null,verticesSpace:vertices?.space??null,vertexBase:vertices?.vertexBase??null,
                bodyPositions:Array.from(positions),bodyNormals:Array.from(normals),bodyIndices:Array.from(body.geometry.index.array),report:avatar.report()};
        });
        if(Math.abs(state.time-frame/options.fps)>1e-8*Math.max(1,frame/options.fps))throw new Error('Capture clock reset or drifted; discard this run.');
        const grid=new SurfaceGrid(state.bodyPositions,state.bodyNormals,state.bodyIndices);
        const inverse=new Matrix4().fromArray(state.headMatrix).invert(),point=new Vector3(),restPoint=new Vector3();
        const measure=(positions,isVertices)=>{
            const all=[],face=[],worst=[];
            const start=0,end=positions.length/3;
            if(isVertices&&state.verticesSpace!=='world')throw new Error('Vertex readback must be in world space.');
            for(let i=start;i<end;i++){
                const p=positions.slice(i*3,i*3+3),hit=grid.nearest(p);if(!hit)continue;
                all.push(hit.signed);point.fromArray(p).applyMatrix4(inverse);
                // Explicit geometric selection, not a claim of semantic face segmentation.
                if(point.y>=1.43&&point.y<=1.565&&point.z>=.06){
                    face.push(hit.signed);if(hit.signed<.002)worst.push({index:isVertices?i+state.vertexBase:i,clearanceMm:hit.signed*1000,world:p,headRest:point.toArray()});
                }
            }
            worst.sort((a,b)=>a.clearanceMm-b.clearanceMm);
            return {all:summary(all),face:summary(face),worstFace:worst.slice(0,12)};
        };
        let maxLengthError=0,totalTipLag=0;
        const matrix=new Matrix4().fromArray(state.headMatrix);
        for(let i=0;i<state.centers.length/3;i++){
            point.fromArray(state.centers,i*3);
            if(i%descriptor.pointsPerChain>0){
                restPoint.fromArray(state.centers,(i-1)*3);
                maxLengthError=Math.max(maxLengthError,Math.abs(point.distanceTo(restPoint)-descriptor.restLengths[i]));
            }
            if(i%descriptor.pointsPerChain===descriptor.pointsPerChain-1){
                restPoint.fromArray(descriptor.restCentres,i*3).applyMatrix4(matrix);totalTipLag+=point.distanceTo(restPoint);
            }
        }
        let surfaceSamples=null;
        if(state.vertices){
            const probes=[],indices=descriptor.cardIndices;
            for(let t=0;t<indices.length;t+=3){
                const a=indices[t]*3,b=indices[t+1]*3,c=indices[t+2]*3;
                for(const weights of [[.5,.5,0],[.5,0,.5],[0,.5,.5],[1/3,1/3,1/3]]){
                    const p=[0,1,2].map(k=>state.vertices[a+k]*weights[0]+state.vertices[b+k]*weights[1]+state.vertices[c+k]*weights[2]);
                    point.fromArray(p).applyMatrix4(inverse);
                    if(point.y>=1.43&&point.y<=1.565&&point.z>=.06)probes.push(...p);
                }
            }
            surfaceSamples=measure(probes,false);
        }
        const sample={frame,time:state.time,centers:measure(state.centers,false),surfaceSamples,
            vertices:state.vertices?measure(state.vertices,true):null,maxSegmentErrorMm:maxLengthError*1000,
            meanTipLagMm:totalTipLag/descriptor.chainCount*1000,solverSteps:state.steps};
        samples.push(sample);
        fs.writeFileSync(path.join(options.out,`frame-${String(frame).padStart(4,'0')}.json`),JSON.stringify(state));
        await page.locator('#stage').screenshot({path:path.join(options.out,`frame-${String(frame).padStart(4,'0')}.png`)});
        console.log(JSON.stringify(sample));
    }
    await page.close();
}finally{
    await browser.close();
    fs.writeFileSync(path.join(options.out,'report.json'),JSON.stringify({options,hmrSuppressed:true,sourceHashes,replacedGroomRequests,descriptor,samples,errors,
        limits:['SurfaceGrid signed distance uses the renderer-equivalent morphed/skinned vertex normals of the same frame body; this differs at seams from recomputed geometric normals.','Face region is an explicit axis-aligned box in inverse head-matrix coordinates.','Centers do not certify ribbon edges unless vertex readback is present.','Surface samples are three edge midpoints and one centroid per face-region triangle, not an exhaustive intersection proof; alpha is not sampled.','Fixed-step capture does not measure frame budget.']},null,2));
}
if(errors.length)process.exitCode=1;
