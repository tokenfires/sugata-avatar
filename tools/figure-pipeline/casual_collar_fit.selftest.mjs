import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {transformCasualCollarFit,CASUAL_COLLAR_FIT} from './casual_collar_fit.mjs';
import {transformCasualTrouserFit} from './casual_trouser_fit.mjs';
import {readGlb,readPrimitive} from '../lut-bake/glb.mjs';
import {collarBand} from './collar_lining_topology.mjs';

const directory=fs.mkdtempSync(path.join(os.tmpdir(),'sugata-collar-test-')),sha=b=>createHash('sha256').update(b).digest('hex');
const checks=[];
function check(name,run){run();checks.push(name);console.log('PASS '+name);}
try {
    const prior=transformCasualTrouserFit(),basePath=path.join(directory,'prior.glb');fs.writeFileSync(basePath,prior.bytes);
    const result=transformCasualCollarFit(),file=path.join(directory,'collar.glb');fs.writeFileSync(file,result.bytes);
    const geometryFile=path.join(directory,'geometry.glb');fs.writeFileSync(geometryFile,result.geometryBytes);
    const source=readGlb(basePath),geometry=readGlb(geometryFile),candidate=readGlb(file);
    check('reproduces exact geometry and lining descriptor from immutable trouser fixture',()=>{
        assert.equal(sha(result.bytes),CASUAL_COLLAR_FIT.outputSHA256);
        assert.equal(sha(result.geometryBytes),CASUAL_COLLAR_FIT.geometrySHA256);
        assert.equal(sha(transformCasualCollarFit({input:basePath}).bytes),sha(result.bytes));
        assert.equal(sha(transformCasualCollarFit({interior:false}).bytes),sha(result.geometryBytes));
    });
    check('lining candidate changes only metadata relative to reviewed geometry',()=>{
        assert.deepEqual(candidate.bin,geometry.bin);
        const definition=candidate.json.meshes[0].extras.sugataInterior;
        const stripped=structuredClone(candidate.json);delete stripped.meshes[0].extras;assert.deepEqual(stripped,geometry.json);
        const p=readPrimitive(source,CASUAL_COLLAR_FIT.garment),band=collarBand(p.positions,p.indices,{width:.035});
        assert.deepEqual(definition,{version:1,kind:'collar-band',sourceVertexCount:p.vertexCount,sourceTriangleCount:p.triangleCount,triangles:band.triangles});
        assert.equal(band.triangles.length,140);assert.equal(new Set(band.triangles).size,140);
        assert.ok(band.uniqueVertices.every(i=>i<1427));assert.equal(band.boundaryEdges,20);
    });
    check('all original attributes except collar positions/normals remain exact, including trousers',()=>{
        const attrs=source.json.meshes[0].primitives[0].attributes,allowed=new Uint8Array(source.bin.length);
        for(const key of ['POSITION','NORMAL']){
            const a=source.json.accessors[attrs[key]],v=source.json.bufferViews[a.bufferView];
            for(let i=0;i<a.count;i++){const start=(v.byteOffset??0)+(a.byteOffset??0)+i*(v.byteStride??12);allowed.fill(1,start,start+12);}
        }
        for(let i=0;i<source.bin.length;i++)if(!allowed[i])assert.equal(geometry.bin[i],source.bin[i]);
        const p=readPrimitive(source,CASUAL_COLLAR_FIT.garment),q=readPrimitive(candidate,CASUAL_COLLAR_FIT.garment);
        for(let i=0;i<p.vertexCount;i++)if(p.positions[i*3+1]<1.32)assert.deepEqual(q.positions.slice(i*3,i*3+3),p.positions.slice(i*3,i*3+3));
        assert.deepEqual(q.indices,p.indices);assert.deepEqual(q.uvs,p.uvs);
    });
    check('unqualified and already-transformed sources are refused',()=>{
        assert.throws(()=>transformCasualCollarFit({input:file}),/Unqualified collar source/);
        const bad=path.join(directory,'changed.glb'),bytes=Buffer.from(prior.bytes);bytes[bytes.length-1]^=1;fs.writeFileSync(bad,bytes);
        assert.throws(()=>transformCasualCollarFit({input:bad}),/Unqualified collar source/);
    });
    check('too narrow band refuses omitted slit witnesses; malformed topology refuses early',()=>{
        const p=readPrimitive(source,CASUAL_COLLAR_FIT.garment);
        assert.throws(()=>collarBand(p.positions,p.indices,{width:.025}),/omits/);
        assert.throws(()=>collarBand(p.positions,p.indices,{width:0}),/width/);
        assert.throws(()=>collarBand(p.positions,new Uint32Array()),/20-edge/);
    });
    check('CLI protects existing output and refuses incomplete options',()=>{
        const executable=fileURLToPath(new URL('./casual_collar_fit.mjs',import.meta.url));
        const before=fs.readFileSync(file),run=spawnSync(process.execPath,[executable,'--output',file],{encoding:'utf8'});
        assert.notEqual(run.status,0);assert.match(run.stderr,/EEXIST/);assert.deepEqual(fs.readFileSync(file),before);
        const invalid=spawnSync(process.execPath,[executable,'--input'],{encoding:'utf8'});assert.notEqual(invalid.status,0);assert.match(invalid.stderr,/Missing path/);
    });
    console.log('PASS '+checks.length+'/'+checks.length+' collar asset groups');
}finally{fs.rmSync(directory,{recursive:true});}
