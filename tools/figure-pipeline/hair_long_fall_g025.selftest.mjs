#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readGlb, readPrimitive, readAccessor } from '../lut-bake/glb.mjs';
import { encodeGlb, sha256 } from './hair_fall.mjs';
import { measureHairSurface } from './hair_surface.mjs';
import { calibrationForBake, decodeBounds } from '../critic/portrait-calibration.mjs';
import { G025_RECIPE as C, G025_ORIGINAL, G025_BODY, transformHairLongFallG025, writeG025Rest } from './hair_long_fall_g025.mjs';

const root = path.resolve( path.dirname( fileURLToPath( import.meta.url ) ), '../..' );
const temp = fs.mkdtempSync( path.join( os.tmpdir(), 'sugata-g025-rest-test-' ) );
const floatHash = values => sha256( Buffer.from( new Float32Array( values ).buffer ) );
const attrs = glb => glb.json.meshes.find( mesh => mesh.name === 'hair_bob01' ).primitives[0].attributes;
const center = ( p, card, ring ) => { const i = (652 + card*34 + ring*2)*3; return [0,1,2].map(k => (p[i+k] + p[i+k+3])/2); };
const save = ( name, glb ) => { const file = path.join(temp,name); fs.writeFileSync(file,encodeGlb(glb)); return file; };
function changeFloat( glb, attribute ) {
    const a = glb.json.accessors[attrs(glb)[attribute]], v = glb.json.bufferViews[a.bufferView];
    const offset = (v.byteOffset ?? 0) + (a.byteOffset ?? 0);
    glb.bin.writeFloatLE(glb.bin.readFloatLE(offset)+.01,offset);
}
let groups = 0;
const check = (name, run) => { run(); console.log(`PASS ${++groups} - ${name}`); };
try {
    const sourceBytes = fs.readFileSync(G025_ORIGINAL), bodyBytes = fs.readFileSync(G025_BODY);
    assert.equal(sha256(sourceBytes),C.originalSha256,'Fetch the immutable Git LFS fixture; never substitute a mutable shipping groom.');
    const before = readGlb(G025_ORIGINAL), original = readPrimitive(before,'hair_bob01');
    let result; const reads = [], read = fs.readFileSync;
    try {
        fs.readFileSync = function(file,...args) { reads.push(String(file)); return read.call(this,file,...args); };
        result = transformHairLongFallG025();
    } finally { fs.readFileSync = read; }
    const output = path.join(temp,'composed.glb'); fs.writeFileSync(output,result.bytes);
    const after = readGlb(output), corrected = readPrimitive(after,'hair_bob01');

    check('default original replay reproduces all seven stage gates and exact complete GLB/BIN without captures',() => {
        assert.equal(sha256(result.bytes),C.outputSha256); assert.equal(sha256(after.bin),C.outputBinSha256);
        assert.equal(floatHash(corrected.positions),C.stages.composition.positionSha256);
        assert.equal(floatHash(corrected.normals),C.stages.composition.normalSha256);
        assert.deepEqual(result.report.stages.map(x=>x.name),Object.keys(C.stages));
        for(const row of result.report.stages) {
            assert.equal(row.positionSha256,C.stages[row.name].positionSha256);
            assert.equal(row.normalSha256,C.stages[row.name].normalSha256);
        }
        assert.ok(reads.length>=4); assert.ok(reads.every(p=>!p.includes('/captures/')&&!p.startsWith('/tmp/')));
        assert.ok(reads.includes(G025_ORIGINAL)); assert.ok(reads.includes(G025_BODY));
    });
    check('original full-triangle defect is rejected; composed curtains pass while all root failures remain explicit',() => {
        const body = readPrimitive(readGlb(G025_BODY),'base.001');
        const old = measureHairSurface(original,body,{headBounds:{min:[-2,-2,-2],max:[2,3,2]},faceBounds:decodeBounds(calibrationForBake('g025').proposed.face),exampleLimit:100000});
        assert.ok(old.face.pairs>0); assert.ok(old.head.examples.some(x=>x.card>=78&&x.card<462));
        const surface = result.report.surface;
        assert.equal(surface.face.pairs,0); assert.equal(surface.movableCurtainPairs,0);
        assert.equal(surface.allBody.pairs,251); assert.deepEqual(surface.allBody.cards,[2,3,50,66]);
        assert.equal(surface.strictAllBodyPass,false);
        console.log(JSON.stringify({original:{face:old.face.pairs,allBody:old.head.pairs},composed:{face:0,curtains:0,rootPairs:251}}));
    });
    check('caps, fringe, anchored ring0, Y cut and full-width vectors survive original-to-composed replay',() => {
        let maxWidthError = 0;
        for(let v=0;v<original.vertexCount;v++) {
            const card = Math.floor((v-652)/34), ring = Math.floor(((v-652)%34)/2);
            assert.equal(corrected.positions[v*3+1],original.positions[v*3+1]);
            if(v<652||card>=462||ring===0) for(let k=0;k<3;k++) assert.equal(corrected.positions[v*3+k],original.positions[v*3+k]);
            if(v<652||card>=462) for(let k=0;k<3;k++) assert.equal(corrected.normals[v*3+k],original.normals[v*3+k]);
        }
        for(let card=0;card<496;card++) for(let ring=0;ring<17;ring++) {
            const i = (652+card*34+ring*2)*3;
            maxWidthError = Math.max(maxWidthError,Math.hypot(...[0,1,2].map(k=>(corrected.positions[i+k+3]-corrected.positions[i+k])-(original.positions[i+k+3]-original.positions[i+k]))));
        }
        assert.ok(maxWidthError<1e-7); assert.equal(result.report.preservation.other495Exact,true);
    });
    check('side-fall preserves each own upper prefix and replaces actual wrong-side lower tips',() => {
        for(const [card,start] of [[80,10],[423,10],[113,9],[173,10]]) {
            const anchor = center(original.positions,card,start), oldTip = center(original.positions,card,16), tip = center(corrected.positions,card,16);
            assert.ok(anchor[0]*oldTip[0]<0,`Source card ${card} must reproduce its wrong-side tip.`);
            assert.ok(anchor[0]*tip[0]>0); assert.equal(tip[1],oldTip[1]);
            for(let ring=0;ring<=start;ring++) for(let side=0;side<2;side++) for(let k=0;k<3;k++) {
                const i = (652+card*34+ring*2+side)*3+k;
                assert.equal(corrected.positions[i],original.positions[i]);
            }
        }
        for(let ring=0;ring<=10;ring++) for(let side=0;side<2;side++) for(let k=0;k<3;k++) {
            const i = (652+131*34+ring*2+side)*3+k;
            assert.equal(corrected.positions[i],original.positions[i]);
            if(ring<10) assert.equal(corrected.normals[i],original.normals[i]);
        }
    });
    check('all UV, skin, indices, embedded textures and nongeometry bytes remain exact',() => {
        const attributes = attrs(before), mask = new Uint8Array(before.bin.length);
        for(const name of ['TEXCOORD_0','TEXCOORD_1','JOINTS_0','WEIGHTS_0']) assert.deepEqual(readAccessor(after,attributes[name]).data,readAccessor(before,attributes[name]).data);
        assert.deepEqual(corrected.indices,original.indices); assert.equal(after.bin.length,before.bin.length);
        for(const name of ['POSITION','NORMAL']) {
            const a = before.json.accessors[attributes[name]],v = before.json.bufferViews[a.bufferView];
            for(let i=0;i<a.count;i++) { const offset = (v.byteOffset??0)+(a.byteOffset??0)+i*(v.byteStride??12); mask.fill(1,offset,offset+12); }
        }
        for(let i=0;i<mask.length;i++) if(!mask[i]) assert.equal(after.bin[i],before.bin[i]);
        const left = structuredClone(before.json),right = structuredClone(after.json);
        delete left.asset.extras; delete right.asset.extras;
        for(const json of [left,right]) for(const name of ['POSITION','NORMAL']) { delete json.accessors[attributes[name]].min; delete json.accessors[attributes[name]].max; }
        assert.deepEqual(left,right); assert.deepEqual(after.json.asset.extras.sugataHairG025Composition,C.stamp);
    });
    check('connector composition preserves the whole-groom median and fits while reporting its actual arc/compliance change',() => {
        const s = result.report.solver;
        assert.equal(s.medianArcsMm[1],s.medianArcsMm[2]); assert.deepEqual(s.fits[1],s.fits[2]);
        assert.ok(Math.abs((s.card131[2].arcMm-s.card131[1].arcMm)-22.780686616897583)<1e-9);
        assert.ok(Math.abs((s.card131[2].compliance/s.card131[1].compliance-1)*100+7.65221045693546)<1e-9);
        assert.ok(s.card131[2].arcMm>s.card131[1].arcMm);
    });
    check('exact composed replay is byte-idempotent and leaves original/body inputs untouched',() => {
        const again = transformHairLongFallG025(output);
        assert.equal(again.report.alreadyApplied,true); assert.deepEqual(again.bytes,result.bytes);
        assert.deepEqual(fs.readFileSync(G025_ORIGINAL),sourceBytes); assert.deepEqual(fs.readFileSync(G025_BODY),bodyBytes);
    });
    check('other bodies/bakes, changed original attributes and forged or altered composed payloads are refused',() => {
        assert.throws(()=>transformHairLongFallG025(G025_ORIGINAL,path.join(root,'assets/figures/figure_g050.glb')),/Wrong g025 body/);
        assert.throws(()=>transformHairLongFallG025(path.join(root,'tools/figure-pipeline/fixtures/bob01-g050-original.glb')),/neither immutable/);
        for(const input of [G025_ORIGINAL,output]) for(const change of [g=>changeFloat(g,'POSITION'),g=>changeFloat(g,'NORMAL'),g=>changeFloat(g,'WEIGHTS_0'),g=>{g.json.asset.generator='changed';},g=>{attrs(g).TANGENT=attrs(g).NORMAL;}]) {
            const g = readGlb(input); change(g);
            assert.throws(()=>transformHairLongFallG025(save('tampered.glb',g)),/neither immutable/);
        }
        for(const change of [g=>{delete g.json.asset.extras;},g=>{g.json.asset.extras.sugataHairG025Composition.status='accepted';}]) {
            const g = readGlb(output); change(g); assert.throws(()=>transformHairLongFallG025(save('forged.glb',g)),/neither immutable/);
        }
    });
    check('writer refuses source/body aliases and existing evidence, and publishes into new directories',() => {
        const options = {input:output,output:path.join(temp,'new.glb'),report:path.join(temp,'new.json')};
        assert.throws(()=>writeG025Rest({...options,output}),/Separate/);
        assert.throws(()=>writeG025Rest({...options,report:G025_BODY}),/Separate/);
        for(const kind of ['sym','hard']) {
            const alias = path.join(temp,kind+'.glb'); if(kind==='sym')fs.symlinkSync(output,alias); else fs.linkSync(output,alias);
            assert.throws(()=>writeG025Rest({...options,output:alias}),/Separate/);
        }
        const sentinel = path.join(temp,'sentinel'); fs.writeFileSync(sentinel,'preserve');
        assert.throws(()=>writeG025Rest({...options,report:sentinel}),/existing/); assert.equal(fs.readFileSync(sentinel,'utf8'),'preserve');
        const destination = path.join(temp,'nested','out.glb'), report = path.join(temp,'reports','out.json');
        writeG025Rest({...options,output:destination,report}); assert.deepEqual(fs.readFileSync(destination),result.bytes);
        assert.equal(JSON.parse(fs.readFileSync(report)).outputSha256,C.outputSha256);
    });
    check('staging and publication failures clean only owned output and preserve unrelated files',() => {
        const blocked = path.join(temp,'not-a-directory'); fs.writeFileSync(blocked,'preserve');
        const outputPath = path.join(temp,'staging','out.glb');
        assert.throws(()=>writeG025Rest({input:output,output:outputPath,report:path.join(blocked,'report.json')}));
        assert.equal(fs.existsSync(outputPath),false); assert.deepEqual(fs.readdirSync(path.dirname(outputPath)),[]);
        assert.equal(fs.readFileSync(blocked,'utf8'),'preserve');
        const real = path.join(temp,'real'),alias = path.join(temp,'alias'); fs.mkdirSync(real);fs.symlinkSync(real,alias);
        const sentinel = path.join(real,'.g025-rest-reserved.tmp'); fs.writeFileSync(sentinel,'preserve');
        assert.throws(()=>writeG025Rest({input:output,output:path.join(real,'same.glb'),report:path.join(alias,'same.glb')}),/EEXIST/);
        assert.deepEqual(fs.readdirSync(real),[path.basename(sentinel)]); assert.equal(fs.readFileSync(sentinel,'utf8'),'preserve');
    });
    console.log(`${groups}/${groups} portable bob01/g025 composition groups passed`);
} finally { fs.rmSync(temp,{recursive:true,force:true}); }
