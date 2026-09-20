#!/usr/bin/env node
/** Reproduce the frozen local collar fit and its explicitly authored zero-thickness interior. */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {readGlb,readPrimitive} from '../lut-bake/glb.mjs';
import {encodeGlb} from './hair_fall.mjs';
import {transformCasualTrouserFit} from './casual_trouser_fit.mjs';
import {collarBand} from './collar_lining_topology.mjs';

const recipePath=fileURLToPath(new URL('./fixtures/casual-collar-v2-patch.json',import.meta.url));
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
export const CASUAL_COLLAR_FIT=Object.freeze({id:'g050-casual-collar-interior-v1',garment:'female_casualsuit01',
    sourceSHA256:'44ebc3eb3a09408a3563d369ae74be15a5bc4beb8040bc43c2c5446d6e65c783',
    geometrySHA256:'ca65319add5a41147df9d894aebe6441a9ab6f5131ee639dd49c3bef74861e5e',
    outputSHA256:'d81a6730bde9d8fee4641e18d6f9f0e3922af420bb68eea3f44b661896aeec3a',
    bandWidthMetres:.035});

function writeAttribute(glb,index,values){
    const a=glb.json.accessors[index],view=glb.json.bufferViews[a.bufferView];
    assert.equal(a.componentType,5126);assert.equal(a.type,'VEC3');assert.ok(!a.sparse);
    const base=(view.byteOffset??0)+(a.byteOffset??0),stride=view.byteStride??12,min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];
    for(let i=0;i<a.count;i++)for(let k=0;k<3;k++){
        const v=values[i*3+k];assert.ok(Number.isFinite(v));glb.bin.writeFloatLE(v,base+i*stride+k*4);
        min[k]=Math.min(min[k],v);max[k]=Math.max(max[k],v);
    }
    if(a.min)a.min=min;if(a.max)a.max=max;
}

export function transformCasualCollarFit({input,interior=true}={}){
    const cfg=CASUAL_COLLAR_FIT,recipe=JSON.parse(fs.readFileSync(recipePath));
    assert.equal(recipe.sourceSHA256,cfg.sourceSHA256);assert.equal(recipe.geometrySHA256,cfg.geometrySHA256);
    let temporary=null;
    try {
        if(!input){
            // Reconstruct the accepted trousers from their immutable existing fixture. No new
            // duplicate 11 MB fixture is required, and no mutable installed garment is trusted.
            const prior=transformCasualTrouserFit();temporary=fs.mkdtempSync(path.join(os.tmpdir(),'sugata-collar-source-'));
            input=path.join(temporary,'source.glb');fs.writeFileSync(input,prior.bytes,{flag:'wx'});
        }
        assert.equal(sha(fs.readFileSync(input)),cfg.sourceSHA256,'Unqualified collar source');
        const glb=readGlb(input),source=readPrimitive(glb,cfg.garment),positions=Float32Array.from(source.positions),normals=Float32Array.from(source.normals);
        for(const change of recipe.changes){
            assert.deepEqual(Array.from(source.positions.slice(change.i*3,change.i*3+3)),change.old);
            positions.set(change.position,change.i*3);
        }
        for(const change of recipe.normalChanges)normals.set(change.normal,change.i*3);
        const mesh=glb.json.meshes.find(m=>m.name===cfg.garment),attributes=mesh.primitives[0].attributes;
        writeAttribute(glb,attributes.POSITION,positions);writeAttribute(glb,attributes.NORMAL,normals);
        const geometryBytes=encodeGlb(glb);assert.equal(sha(geometryBytes),cfg.geometrySHA256,'Frozen collar geometry changed');
        const band=collarBand(source.positions,source.indices,{width:cfg.bandWidthMetres});
        assert.equal(band.triangles.length,140);
        if(interior){
            assert.equal(mesh.extras,undefined,'Unexpected source mesh metadata');
            mesh.extras={sugataInterior:{version:1,kind:'collar-band',sourceVertexCount:source.vertexCount,
                sourceTriangleCount:source.triangleCount,triangles:band.triangles}};
        }
        const bytes=interior?encodeGlb(glb):geometryBytes;
        assert.equal(sha(bytes),interior?cfg.outputSHA256:cfg.geometrySHA256,'Qualified collar output changed');
        return {bytes,geometryBytes,report:{id:cfg.id,sourceSHA256:cfg.sourceSHA256,geometrySHA256:cfg.geometrySHA256,
            outputSHA256:sha(bytes),interior,interiorTriangles:interior?band.triangles.length:0,
            movedVertices:recipe.changes.length,changedNormals:recipe.normalChanges.length,
            bandWidthMetres:cfg.bandWidthMetres,recipeSHA256:sha(fs.readFileSync(recipePath)),
            limits:['The interior adds visible back faces only; no thickness or rounded seam.','A fixed local fit, not a general-purpose clothes solver.']}};
    }finally{if(temporary)fs.rmSync(temporary,{recursive:true});}
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
    const args=process.argv.slice(2),options={};
    for(let i=0;i<args.length;i++){
        if(args[i]==='--geometry-only')options.interior=false;
        else if(['--input','--output'].includes(args[i])){
            const key=args[i].slice(2),value=args[++i];
            if(!value||value.startsWith('--'))throw Error('Missing path for --'+key);
            options[key]=value;
        }
        else throw Error('Use --output NEW.glb [--input accepted.glb] [--geometry-only]');
    }
    if(!options.output)throw Error('An explicit new --output path is required');
    const result=transformCasualCollarFit(options);fs.writeFileSync(options.output,result.bytes,{flag:'wx'});
    console.log(JSON.stringify(result.report,null,2));
}
