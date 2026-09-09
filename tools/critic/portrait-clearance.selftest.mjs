#!/usr/bin/env node
// Capture selection/provenance guards. No browser, ignored captures or offloaded files required.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {parseCaptureOptions,captureTarget,captureAssetHashes,matchesGroomRequest,
    validateCaptureRuntime,validateLoadedAssets,CAPTURE_REGION} from './portrait-clearance.mjs';
import { portraitSelection, PORTRAIT_BAKES } from '../../packages/testbed/src/portrait-selection.mjs';
import { verifyCalibrationAssets, captureAnatomy, calibrationForBake, validateBodyTopology } from './portrait-calibration.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const parse=args=>parseCaptureOptions(['--out','/tmp/sugata-capture-selection-test',...args],{});
let count=0;const check=(name,fn)=>{fn();console.log(`PASS ${++count} - ${name}`);};
check('existing default selects bob02/g050 and manual capture',()=>{
    const o=parse([]),t=captureTarget(o),u=new URL(o.url);
    assert.equal(o.hair,'bob02');assert.equal(o.bake,'g050');assert.equal(u.searchParams.get('hair'),'bob02');assert.ok(u.searchParams.has('capture'));
    assert.equal(t.groomFile,path.join(root,'assets/hair/bob02/g050.glb'));assert.equal(CAPTURE_REGION.minY,1.43);assert.equal(CAPTURE_REGION.maxY,1.565);assert.equal(CAPTURE_REGION.minZ,.06);
});
check('explicit bob01 and legacy URL-only bob01 select their own source and request path',()=>{
    for(const o of [parse(['--hair','bob01']),parse(['--url','http://127.0.0.1:5198/src/portrait.html?hair=bob01&capture'])]){
        const t=captureTarget(o);assert.equal(o.hair,'bob01');assert.equal(t.groomFile,path.join(root,'assets/hair/bob01/g050.glb'));assert.equal(t.groomRequestPath,'/assets/hair/bob01/g050.glb');
        assert.equal(new URL(o.url).searchParams.get('hair'),'bob01');
    }
});
check('URL/CLI disagreement and ambiguous or unsupported hair selections fail closed',()=>{
    assert.throws(()=>parse(['--hair','bob01','--url','http://localhost/src/portrait.html?hair=bob02']),/contradicts/);
    assert.throws(()=>parse(['--hair','bob03']),/bob01 or bob02/);
    assert.throws(()=>parse(['--url','http://localhost/src/portrait.html?hair=bob01&hair=bob02']),/Duplicate URL/);
    assert.throws(()=>parse(['--hair','bob01','--hair','bob02']),/duplicate/);
});
check('all five CLI and URL body selections resolve exact authored genders and asset paths',()=>{
    for(const [bake,gender] of Object.entries(PORTRAIT_BAKES))for(const args of [['--bake',bake],['--url',`http://localhost/?bake=${bake}`],['--url',`http://localhost/?gender=${gender}`]]){
        const o=parse(['--hair','bob01',...args]),t=captureTarget(o),u=new URL(o.url);assert.equal(o.bake,bake);assert.equal(t.gender,gender);
        assert.equal(u.searchParams.get('bake'),bake);assert.equal(Number(u.searchParams.get('gender')),gender);
        assert.ok(t.groomFile.endsWith(`/bob01/${bake}.glb`));assert.ok(t.bodyFile.endsWith(`/figure_${bake}.glb`));
        assert.equal(captureAssetHashes(t).body,calibrationForBake(bake).hashes.file);
        validateCaptureRuntime({identity:{gender,bake:t.figureBake},hair:{style:'bob01',loadedStyle:'bob01',bake:t.figureBake,attached:true,solver:{chains:1}}},t);
    }
});
check('contradictory, ambiguous and uncalibrated body selections fail before browser creation',()=>{
    for(const args of [['--bake','g999'],['--bake','g000','--url','http://localhost/?bake=g100'],['--bake','g000','--url','http://localhost/?gender=.5'],['--url','http://localhost/?bake=g100&gender=0'],['--url','http://localhost/?gender='],['--url','http://localhost/?gender=.6'],['--url','http://localhost/?gender=NaN'],['--url','http://localhost/?bake=g000&bake=g000']])assert.throws(()=>parse(args),/Unsupported|contradicts|authored value|Duplicate/);
    assert.deepEqual(portraitSelection(new URLSearchParams()),{bake:'g050',gender:.5});
    assert.throws(()=>captureTarget({hair:'bob01',bake:'g999'}),/Unsupported/);
    assert.throws(()=>parse(['--bake','g000']),/bob02 is authored only/);
});
check('portable calibration reproduces exact source hashes, skin correspondence and mapped surface bounds',()=>{
    const result=verifyCalibrationAssets();assert.equal(result.length,5);
    for(const b of result){assert.equal(b.facePatchTriangles,5714);assert.equal(b.headPatchTriangles,7678);assert.equal(b.neckPatchTriangles,1872);assert.equal(b.neckPatchVertices,1069);assert.equal(captureAnatomy(b.bake).bodySha256,b.bodySha256);}
});
check('semantic triangle IDs require exact calibrated topology before any pose query',()=>{
    const b=calibrationForBake('g000');assert.throws(()=>validateBodyTopology([0,1,2],b.vertexCount*3,'g000'),/topology/);
});
check('substitution predicate cannot replace another style, bake or similarly named resource',()=>{
    const t=captureTarget(parse(['--hair','bob01']));
    assert.ok(matchesGroomRequest('http://localhost/assets/hair/bob01/g050.glb?x=1',t));
    assert.ok(matchesGroomRequest('http://localhost/@fs/repo/assets/hair/bob01/g050.glb',t));
    for(const u of ['http://localhost/assets/hair/bob02/g050.glb','http://localhost/assets/hair/bob01/g075.glb','http://localhost/assets/hair/bob01/g050.glb.png'])assert.equal(matchesGroomRequest(u,t),false);
});
check('actual source hashes follow bob01 and a mismatched override mesh is rejected',()=>{
    const t=captureTarget(parse(['--hair','bob01'])),hashes=captureAssetHashes(t);
    const hash=f=>createHash('sha256').update(fs.readFileSync(f)).digest('hex');
    assert.equal(hashes.groom,hash(path.join(root,'assets/hair/bob01/g050.glb')));
    assert.notEqual(hashes.groom,hash(path.join(root,'assets/hair/bob02/g050.glb')));
    assert.equal(hashes.body,hash(path.join(root,'assets/figures/figure_g050.glb')));
    const wrong=captureTarget(parse(['--hair','bob01','--groom',path.join(root,'assets/hair/bob02/g050.glb')]));
    assert.throws(()=>captureAssetHashes(wrong),/hair_bob01/);
});
const target=captureTarget(parse(['--hair','bob01']));
const live=()=>({identity:{gender:.5,bake:'figure_g050'},hair:{style:'bob01',loadedStyle:'bob01',bake:'figure_g050',attached:true,solver:{chains:294}}});
check('runtime must attest requested style, loaded style, body bake and a live solver',()=>{
    validateCaptureRuntime(live(),target);
    for(const [group,key,value] of [['hair','loadedStyle','bob02'],['hair','style','bob02'],['hair','bake','figure_g075'],['hair','attached',false],['hair','solver',null],['identity','bake','figure_g000'],['identity','gender',.25]]){
        const r=live();r[group][key]=value;assert.throws(()=>validateCaptureRuntime(r,target),/runtime selection disagrees/);
    }
    const r=live();r.hair.solver.chains=NaN;assert.throws(()=>validateCaptureRuntime(r,target),/runtime selection disagrees/);
});
check('recorded provenance must match exactly one real loaded groom and body response',()=>{
    const hashes={groom:'a'.repeat(64),body:'b'.repeat(64)},g={url:'g.glb',sha256:hashes.groom},b={url:'b.glb',sha256:hashes.body};
    validateLoadedAssets([g,b],hashes);
    for(const assets of [[g],[b],[g,g,b],[g,b,b],[{...g,sha256:'wrong'},b]])assert.throws(()=>validateLoadedAssets(assets,hashes),/exactly one loaded/);
});
check('cadence and option validation preserve controlled-motion inputs',()=>{
    assert.equal(parse(['--direction','-1','--stimulus','tilt']).direction,-1);
    assert.throws(()=>parse(['--direction','0']),/direction/);assert.throws(()=>parse(['--stride','1.5']),/integer/);
    assert.throws(()=>parse(['--fps','0']),/Invalid fps/);assert.throws(()=>parse(['--unknown','x']),/Unknown/);
});
console.log(`${count}/${count} portrait capture selection/provenance groups passed`);
