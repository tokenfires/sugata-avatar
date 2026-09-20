// Discrete CPU-skinned geometry snapshots taken during the new GPU motion run.
// This checks captured poses, not GPU vertex readback or continuous-time clearance.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {readGlb,readPrimitive,readAccessor} from '../lut-bake/glb.mjs';
import {compare,topology,selftest,reconstructAcceptedSource} from './collar_clearance_review.mjs';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const sha=file=>hash(fs.readFileSync(file));
const point=(p,i)=>Array.from(p.slice(i*3,i*3+3));
function triangles(mesh,ids){return ids.map(id=>{const indices=Array.from(mesh.indices.slice(id*3,id*3+3)),vertices=indices.map(i=>point(mesh.positions,i));return{id,indices,vertices,min:[0,1,2].map(k=>Math.min(...vertices.map(v=>v[k]))),max:[0,1,2].map(k=>Math.max(...vertices.map(v=>v[k])))};});}
function subset(result,selected){const rows=result.rows.filter(r=>selected.includes(r.teeTriangle)),minimum=rows.reduce((best,r)=>r.minimum.distance<best.distance?{teeTriangle:r.teeTriangle,...r.minimum}:best,{distance:Infinity});return{triangleCount:rows.length,minimum,maximumAbsoluteWinding:Math.max(...rows.map(r=>Math.abs(r.winding??0))),parityInside:rows.reduce((s,r)=>s+(r.parity?.filter(p=>p.inside===true).length??0),0),parityAmbiguous:rows.reduce((s,r)=>s+(r.parity?.filter(p=>p.ambiguous).length??0),0)};}

export function runMotionReview(captureDir,outDir){
    const reportFile=path.join(captureDir,'report.json'),capture=JSON.parse(fs.readFileSync(reportFile));
    assert.equal(capture.completed,true,'Wait for the complete motion capture report');assert.equal(capture.mode,'motion');
    assert.equal(capture.candidateSHA256,'ca65319add5a41147df9d894aebe6441a9ab6f5131ee639dd49c3bef74861e5e');
    fs.mkdirSync(outDir,{recursive:true});
    const bandFile=path.join(captureDir,'band.json'),band=JSON.parse(fs.readFileSync(bandFile));assert.equal(sha(bandFile),capture.bandHash);
    for(const[file,expected]of Object.entries(capture.toolHashes))assert.equal(sha(path.join(captureDir,file)),expected);
    const sourceReconstruction=reconstructAcceptedSource(outDir),sourceFile=sourceReconstruction.file,candidateFile=path.join(ROOT,'captures/collar-clearance-paused-2026-09-13/casual-collar-v2.glb');
    assert.equal(sha(sourceFile),capture.sourceHashes['assets/wardrobe/female_casualsuit01/g050.glb']);assert.equal(sha(candidateFile),capture.candidateSHA256);
    const source=readPrimitive(readGlb(sourceFile),'female_casualsuit01'),candidate=readPrimitive(readGlb(candidateFile),'female_casualsuit01'),moved=new Set(),selected=[];
    for(let i=0;i<source.vertexCount;i++)if(point(source.positions,i).some((v,k)=>v!==candidate.positions[i*3+k]))moved.add(i);
    for(let t=0;t<source.indices.length;t+=3)if(Array.from(source.indices.slice(t,t+3)).some(i=>moved.has(i)))selected.push(t/3);
    assert.equal(selected.length,180);assert.ok(band.triangles.every(t=>selected.includes(t)),'Lining added faces outside reviewed patch');
    assert.deepEqual(band.indices,band.triangles.flatMap(t=>Array.from(candidate.indices.slice(t*3,t*3+3))));
    const bodyFile=path.join(ROOT,'assets/wardrobe/body/g050.glb'),braFile=path.join(ROOT,'assets/wardrobe/foundation_bra/g050.glb');
    for(const file of[bodyFile,braFile])assert.equal(sha(file),capture.sourceHashes[path.relative(ROOT,file)]);
    const body=readPrimitive(readGlb(bodyFile),'base.001'),braGlb=readGlb(braFile),bra=readPrimitive(braGlb,'foundation_bra'),braMask=readAccessor(braGlb,braGlb.json.meshes.find(m=>m.name==='foundation_bra').primitives[0].attributes._UNDER_FEMALE_CASUALSUIT01).data,retained=[];
    for(let t=0;t<bra.indices.length;t+=3){const ids=Array.from(bra.indices.slice(t,t+3));if(ids.every(i=>braMask[i]<=.5))retained.push(...ids);}
    const report={version:2,createdAt:new Date().toISOString(),sourceReconstruction,scope:'CPU-skinned geometry snapshots captured during the actual GPU motion run; discrete 0.5 s intervals. No GPU vertex readback or continuous-motion claim.',candidateSHA256:capture.candidateSHA256,captureReport:{file:path.relative(ROOT,reportFile),sha256:sha(reportFile)},selftest:selftest(),lining:{triangleCount:band.triangles.length,bandSHA256:sha(bandFile),subsetOfChangedPatch:true},
        instruments:['tools/figure-pipeline/collar_motion_review.mjs','tools/figure-pipeline/collar_clearance_review.mjs','tools/figure-pipeline/hair_geometry.mjs','tools/figure-pipeline/hair_surface.mjs','tools/lut-bake/glb.mjs'].map(file=>({file,sha256:sha(path.join(ROOT,file))})),inputs:[],states:[],limits:['Only changed-incident 180 triangles and coincident 140-triangle lining.','Twenty discrete captured poses are not proof for intermediate times, all wardrobe states, or other identities.','The bra is an open sheet; only unsigned separation is defined.','Floating-point geometric predicates; global body self-intersections not audited.']};
    const cache=new Map();
    for(const hair of['bob02','bob01']){
        const outerRun=capture.runs.find(r=>r.hair===hair&&r.arm==='candidate'),innerRun=capture.runs.find(r=>r.hair===hair&&r.arm==='lining');
        assert.ok(outerRun&&innerRun);assert.deepEqual(outerRun.errors,[]);assert.deepEqual(innerRun.errors,[]);assert.equal(outerRun.geometry.length,10);assert.equal(innerRun.geometry.length,10);
        assert.deepEqual(outerRun.states,innerRun.states,'Native physical state and renderer epoch mismatch');
        for(let step=0;step<=270;step+=30){
            const load=run=>{const d=run.geometry.find(g=>g.step===step),file=path.join(captureDir,d.file);assert.equal(sha(file),d.sha256);report.inputs.push({file:path.relative(ROOT,file),sha256:d.sha256});return JSON.parse(gunzipSync(fs.readFileSync(file)));};
            const outer=load(outerRun),inner=load(innerRun);assert.deepEqual(outer.rig,inner.rig);assert.equal(outer.time,inner.time);assert.deepEqual(outer.meshes,inner.meshes);
            const tee=outer.meshes.find(m=>m.id==='female_casualsuit01'),b=outer.meshes.find(m=>m.id==='body'),br=outer.meshes.find(m=>m.id==='foundation_bra');
            assert.deepEqual(tee.fullIndices,Array.from(candidate.indices));assert.deepEqual(b.fullIndices,Array.from(body.indices));assert.deepEqual(br.drawnIndices,retained);
            assert.deepEqual(inner.lining.indices,band.indices);assert.deepEqual(inner.lining.positions,tee.positions,'Lining diverged from outer mesh');
            const key=hash(JSON.stringify({tee:tee.positions,body:b.positions,bra:br.positions})),id=`${hair}-native-${step}`;
            let result=cache.get(key),reusedFrom=null;
            if(result)reusedFrom=result.id;
            else {
                const bm={positions:b.positions,indices:b.fullIndices},brm={positions:br.positions,indices:br.drawnIndices},patch=triangles({positions:tee.positions,indices:tee.fullIndices},selected);
                result={id,bodyTopology:topology(bm,body.positions),retainedBraTopology:topology(brm,bra.positions),fullBody:compare(patch,bm,{gridSteps:4,globalInside:true}),retainedBra:compare(patch,brm,{gridSteps:4})};cache.set(key,result);
            }
            const row={...result,id,time:outer.time,step,reusedIdenticalGeometryFrom:reusedFrom,geometryArraySHA256:key,liningPositionsExactlyEqual:true,matchedArmGeometryAndRig:true,
                liningFullBody:subset(result.fullBody,band.triangles),liningRetainedBra:subset(result.retainedBra,band.triangles)};
            report.states.push(row);fs.writeFileSync(path.join(outDir,id+'.json'),JSON.stringify(row,null,2),{flag:'wx'});
            console.log(JSON.stringify({id,time:row.time,bodyMinMm:row.fullBody.minimum.distance*1000,braMinMm:row.retainedBra.minimum.distance*1000,liningBodyMinMm:row.liningFullBody.minimum.distance*1000,liningBraMinMm:row.liningRetainedBra.minimum.distance*1000,parity:row.fullBody.rayParity,reusedFrom}));
        }
    }
    report.distinctGeometryStates=cache.size;fs.writeFileSync(path.join(outDir,'report.json'),JSON.stringify(report,null,2),{flag:'wx'});return report;
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
    if(!process.argv[2]||!process.argv[3])throw Error('Usage: node collar_motion_review.mjs COMPLETE_CAPTURE_DIRECTORY FRESH_OUTPUT_DIRECTORY');
    runMotionReview(path.resolve(process.argv[2]),path.resolve(process.argv[3]));
}
