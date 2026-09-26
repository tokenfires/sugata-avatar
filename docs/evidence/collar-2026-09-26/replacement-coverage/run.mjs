// CPU-only proof recipe for the new operator. Does not create/modify an asset or render.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {gzipSync} from 'node:zlib';
import {readGlb,readPrimitive} from '../../../../tools/lut-bake/glb.mjs';
import {runCoverage,PROTOCOL} from '../../../../tools/figure-pipeline/collar_coverage_v2.mjs';

const ROOT=fileURLToPath(new URL('../../../../',import.meta.url));
const OUT=path.resolve(process.argv[2]??'');
assert.ok(process.argv[2]&&!fs.existsSync(OUT),'Usage: node run.mjs FRESH_OUTPUT_DIRECTORY');
fs.mkdirSync(OUT,{recursive:true});
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const fileHash=file=>hash(fs.readFileSync(file));
const write=(name,value)=>fs.writeFileSync(path.join(OUT,name),JSON.stringify(value,null,2)+'\n',{flag:'wx'});
const sourceFiles=['tools/figure-pipeline/collar_coverage_v2.mjs','tools/figure-pipeline/collar_coverage_v2.selftest.mjs',path.relative(ROOT,fileURLToPath(import.meta.url))];
const sourceHashes=Object.fromEntries(sourceFiles.map(f=>[f,fileHash(path.join(ROOT,f))]));
const log=execFileSync(process.execPath,['tools/figure-pipeline/collar_coverage_v2.selftest.mjs'],{cwd:ROOT,encoding:'utf8'});
fs.writeFileSync(path.join(OUT,'selftest.log'),log,{flag:'wx'});
const accepted=path.join(ROOT,'assets/wardrobe/female_casualsuit01/g050.glb');
const interior=path.join(ROOT,'captures/collar-stress-2026-09-22/gpu-v1/assets/collar-interior.glb');
const ACCEPTED='44ebc3eb3a09408a3563d369ae74be15a5bc4beb8040bc43c2c5446d6e65c783';
const INTERIOR='d81a6730bde9d8fee4641e18d6f9f0e3922af420bb68eea3f44b661896aeec3a';
const a=runCoverage({outerPath:accepted,outerSha256:ACCEPTED,outputPath:path.join(OUT,'authored-accepted.json')});
const b=runCoverage({outerPath:interior,outerSha256:INTERIOR,outputPath:path.join(OUT,'authored-interior.json')});
const source=readPrimitive(readGlb(accepted),'female_casualsuit01'),candidate=readPrimitive(readGlb(interior),'female_casualsuit01');
assert.deepEqual(source.indices,candidate.indices);
const changedVertices=new Set(Array.from({length:source.vertexCount},(_,i)=>i).filter(i=>[0,1,2].some(k=>source.positions[i*3+k]!==candidate.positions[i*3+k])));
const removed=[];
for(let t=0;t<source.indices.length/3;t++)if(Array.from(source.indices.slice(t*3,t*3+3)).some(i=>changedVertices.has(i)))removed.push(t);
assert.equal(removed.length,180);
write('removed-cover-selection.json',{rule:'All source triangles incident to any exact POSITION change from44 to d81',sourceSha256:ACCEPTED,interiorSha256:INTERIOR,triangles:removed});
const negative=runCoverage({outerPath:interior,outerSha256:INTERIOR,excludedOuterTriangles:removed,outputPath:path.join(OUT,'removed-cover-negative.json')});
assert.ok(negative.foundations.every(f=>f.failed>0),'Removed-cover negative control did not fail');

// Independent point witness: intersect a normal-directed line with every original 3D
// outer triangle; use barycentric edge signs. No polygon clipping/subtraction or BVH.
const add=(a,b)=>a.map((x,k)=>x+b[k]),sub=(a,b)=>a.map((x,k)=>x-b[k]),mul=(a,s)=>a.map(x=>x*s);
const dot=(a,b)=>a.reduce((s,x,k)=>s+x*b[k],0),cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const witnesses=[];
for(const f of a.foundations)for(const row of f.rows.filter(r=>!r.pass)){
    const largest=[...row.uncoveredFragments].sort((x,y)=>area(y)-area(x))[0];
    const xy=largest.reduce((s,p)=>add(s,p),[0,0]).map(x=>x/largest.length);
    const c=row.chart,origin=add(c.origin,add(mul(c.u,xy[0]),mul(c.v,xy[1]))),covering=[];
    for(let t=0;t<source.indices.length/3;t++){
        const p=Array.from(source.indices.slice(t*3,t*3+3),i=>Array.from(source.positions.slice(i*3,i*3+3)));
        const normal=cross(sub(p[1],p[0]),sub(p[2],p[0])),denominator=dot(normal,c.n);
        if(!(denominator>0))continue;
        const depth=dot(normal,sub(p[0],origin))/denominator;
        if(depth<-.004||depth>.03)continue;
        const hit=add(origin,mul(c.n,depth));
        if(p.every((v,i)=>dot(cross(sub(p[(i+1)%3],v),sub(hit,v)),normal)>=0))covering.push(t);
    }
    assert.equal(covering.length,0,'An independently tested cloth triangle covers the alleged hole point');
    witnesses.push({foundation:f.id,triangle:row.foundationTriangle,uncoveredArea:row.uncoveredArea,chart:c,
        ...row.failureWitness,independentRayWitness:{pointChart:xy,pointWorld:origin,coveringTriangles:covering,testedOuterTriangles:source.indices.length/3}});
}
write('accepted-independent-hole-witnesses.json',{method:'Uncovered-fragment centroid tested by independent exhaustive 3D line/triangle intersection, strictly outward + inclusive depth slab',witnesses});

// This is deliberately an authored-position adapter fixture, NOT a runtime or GPU capture.
const snapshot={time:0,telemetry:{provenance:'CPU-authored-position adapter selftest; not runtime evidence'},meshes:[]};
for(const id of ['body','foundation_bra','foundation_vest','female_casualsuit01']){
    const p=id==='female_casualsuit01'?candidate:readPrimitive(readGlb(path.join(ROOT,`assets/wardrobe/${id}/g050.glb`)),id==='body'?'base.001':id);
    snapshot.meshes.push({id,positions:Array.from(p.positions),fullIndices:Array.from(p.indices),drawnIndices:Array.from(p.indices)});
}
const snapshotBytes=gzipSync(JSON.stringify(snapshot)),snapshotPath=path.join(OUT,'authored-adapter-fixture.json.gz');
fs.writeFileSync(snapshotPath,snapshotBytes,{flag:'wx'});
const adapted=runCoverage({outerPath:interior,outerSha256:INTERIOR,snapshotPath,snapshotSha256:hash(snapshotBytes),outputPath:path.join(OUT,'authored-adapter-result.json')});
assert.deepEqual(adapted.foundations,b.foundations,'Snapshot adapter changed equivalent geometry results');
assert.throws(()=>runCoverage({outerPath:interior,outerSha256:'0'.repeat(64),outputPath:path.join(OUT,'invalid-hash.json')}),/hash mismatch/);
assert.throws(()=>runCoverage({outerPath:interior,outerSha256:INTERIOR,snapshotPath,snapshotSha256:'0'.repeat(64),outputPath:path.join(OUT,'invalid-snapshot.json')}),/hash mismatch/);
assert.throws(()=>runCoverage({outerPath:interior,outerSha256:INTERIOR,outputPath:path.join(OUT,'authored-interior.json')}),/overwrite/);
const altered=structuredClone(snapshot);altered.meshes[0].fullIndices[0]^=1;
const alteredPath=path.join(OUT,'invalid-topology-fixture.json.gz'),alteredBytes=gzipSync(JSON.stringify(altered));
fs.writeFileSync(alteredPath,alteredBytes,{flag:'wx'});
assert.throws(()=>runCoverage({outerPath:interior,outerSha256:INTERIOR,snapshotPath:alteredPath,snapshotSha256:hash(alteredBytes),outputPath:path.join(OUT,'invalid-topology-result.json')}),/topology mismatch/);
for(const [f,expected] of Object.entries(sourceHashes))assert.equal(fileHash(path.join(ROOT,f)),expected,'Proof source changed');
const summary={protocol:PROTOCOL.id,sourceHashes,analyticGroups:14,adapterChecks:5,
    accepted:a.foundations.map(({id,selected,failed,maximumUncoveredArea})=>({id,selected,failed,maximumUncoveredArea})),
    interior:b.foundations.map(({id,selected,failed,maximumUncoveredArea})=>({id,selected,failed,maximumUncoveredArea})),
    removedCover:negative.foundations.map(({id,selected,failed,maximumUncoveredArea})=>({id,selected,failed,maximumUncoveredArea})),
    independentHoleWitnesses:witnesses.length,allViewOrMotionQualified:false,historicalReplayEquivalent:false,
    outputs:Object.fromEntries(fs.readdirSync(OUT).map(name=>[name,fileHash(path.join(OUT,name))]))};
write('summary.json',summary);console.log(JSON.stringify(summary,null,2));

function area(p){let s=0;for(let i=1;i+1<p.length;i++){const a=sub(p[i],p[0]),b=sub(p[i+1],p[0]);s+=a[0]*b[1]-a[1]*b[0];}return s/2;}
