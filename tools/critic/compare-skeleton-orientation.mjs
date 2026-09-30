// One geometric rest-orientation hypothesis against frozen native matrices.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {gunzipSync, gzipSync} from 'node:zlib';
import {fileURLToPath} from 'node:url';
const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const nativeRoot = path.join(ROOT, 'captures/skeleton-native-oracle-2026-09-30-v1');
const endpointRoot = path.join(ROOT, 'captures/skeleton-native-comparison-2026-09-30-v1');
const out = path.join(ROOT, 'captures/skeleton-orientation-2026-09-30-v1');
assert.ok(!fs.existsSync(out)); fs.mkdirSync(out, {recursive: true});
const sha = b => crypto.createHash('sha256').update(b).digest('hex');
const read = p => fs.readFileSync(path.resolve(ROOT,p));
const hash = p => sha(read(p));
const report = {started: new Date().toISOString(), pid: process.pid, node: process.version, status: 'running', errors: [], inputs: {}, cases: [], corruptions: {}, artifacts: [], scope: 'Three retained native rest-matrix sets; no exported/runtime hierarchy, skinning, range or appearance pass.'};
const save = () => fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');
function bind(p, copy=false) {report.inputs[p]=hash(p);if(copy){const dest=path.join(out,'source',p);fs.mkdirSync(path.dirname(dest),{recursive:true});fs.copyFileSync(path.join(ROOT,p),dest);}}
function decode(dir,a){const b=fs.readFileSync(path.join(dir,a.file));assert.equal(sha(b),a.sha256);const raw=gunzipSync(b);assert.equal(sha(raw),a.decodedSHA256);return JSON.parse(raw);}
function archive(name,value){const raw=Buffer.from(JSON.stringify(value)+'\n'),b=gzipSync(raw);fs.writeFileSync(path.join(out,name),b);const a={file:name,sha256:sha(b),decodedSHA256:sha(raw),bytes:b.length};report.artifacts.push(a);return a;}
const sub=(a,b)=>a.map((v,i)=>v-b[i]);
const dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0);
const norm=a=>Math.hypot(...a);
const distance=(a,b)=>norm(sub(a,b));
const normalized=a=>{const l=norm(a);assert.ok(l>0);return a.map(v=>v/l);};
function mul(a,b){return Array.from({length:16},(_,i)=>[0,1,2,3].reduce((s,k)=>s+a[Math.floor(i/4)*4+k]*b[k*4+i%4],0));}
function at(m,p){return [0,1,2].map(i=>[0,1,2].reduce((s,j)=>s+m[i*4+j]*p[j],m[i*4+3]));}
function invertRigid(m){const r=[m[0],m[4],m[8],0,m[1],m[5],m[9],0,m[2],m[6],m[10],0,0,0,0,1];const t=[m[3],m[7],m[11]];for(let i=0;i<3;i++)r[i*4+3]=-dot(r.slice(i*4,i*4+3),t);return r;}
function construct(head,tail,roll){
    assert.ok([...head,...tail,roll].every(Number.isFinite));
    const dir=normalized(sub(tail,head));assert.ok(1+dir[1]>1e-8,'Unqualified antiparallel direction');
    const s=normalized([dir[2],0,-dir[0],1+dir[1]]), c=Math.cos(roll/2), v=Math.sin(roll/2);
    // Shortest +Y-to-direction rotation followed by roll about local +Y.
    const [x,y,z,w]=normalized([s[0]*c-s[2]*v,s[3]*v,s[2]*c+s[0]*v,s[3]*c]);
    const m=[1-2*(y*y+z*z),2*(x*y-z*w),2*(x*z+y*w),head[0],
        2*(x*y+z*w),1-2*(x*x+z*z),2*(y*z-x*w),head[1],
        2*(x*z-y*w),2*(y*z+x*w),1-2*(x*x+y*y),head[2],0,0,0,1];
    const axes=[0,1,2].map(c=>[m[c],m[4+c],m[8+c]]);
    for(let i=0;i<3;i++)for(let j=0;j<3;j++)assert.ok(Math.abs(dot(axes[i],axes[j])-(i===j?1:0))<1e-12);
    const det=m[0]*(m[5]*m[10]-m[6]*m[9])-m[1]*(m[4]*m[10]-m[6]*m[8])+m[2]*(m[4]*m[9]-m[5]*m[8]);assert.ok(Math.abs(det-1)<1e-12);
    return m;
}
function compare(predicted,bones){
    const rows=[];let maxMm=0,maxEndpointMm=0,maxComponent=0,maxAxisRadians=0,worst;
    for(const n of Object.keys(bones).sort()){
        const b=bones[n],actual=b.matrixLocal.flat(),m=predicted[n];
        const length=distance(b.head,b.tail),points={origin:[0,0,0],tail:[0,length,0],basisX:[1,0,0],basisY:[0,1,0],basisZ:[0,0,1]};
        const witnesses=Object.entries(points).map(([point,p])=>{const predicted=at(m,p),expected=at(actual,p);const mm=distance(predicted,expected)*1000;return {point,predicted,expected,mm};});
        const component=Math.max(...m.map((v,i)=>Math.abs(v-actual[i])));
        const angles=[0,1,2].map(c=>{
            const p=normalized([m[c],m[4+c],m[8+c]]),a=normalized([actual[c],actual[4+c],actual[8+c]]);
            // atan2 gives a stable small-angle result without acos cancellation.
            const cross=[p[1]*a[2]-p[2]*a[1],p[2]*a[0]-p[0]*a[2],p[0]*a[1]-p[1]*a[0]];
            return Math.atan2(norm(cross),dot(p,a));
        });
        for(const w of witnesses){if(w.mm>=maxMm){maxMm=w.mm;worst={bone:n,...w};}if(w.point==='origin'||w.point==='tail')maxEndpointMm=Math.max(maxEndpointMm,w.mm);}
        maxComponent=Math.max(maxComponent,component);maxAxisRadians=Math.max(maxAxisRadians,...angles);
        rows.push({bone:n,component,axisRadians:angles,witnesses});
    }
    return {summary:{passed:maxMm<.1,strict:true,gateMm:.1,bones:rows.length,witnesses:rows.length*5,maxMm,maxEndpointMm,maxComponent,maxAxisRadians,worst},rows};
}
function relativeAndRecompose(matrices,table){
    const local={},world={};
    for(const n of Object.keys(table)){const parent=table[n].parent;local[n]=parent?mul(invertRigid(matrices[parent]),matrices[n]):matrices[n];}
    function place(n,chain=new Set()){assert.ok(!chain.has(n),'Cycle');if(world[n])return world[n];const chainNext=new Set([...chain,n]);const p=table[n].parent;return world[n]=p?mul(place(p,chainNext),local[n]):local[n];}
    for(const n of Object.keys(table))place(n);return {local,world};
}
try{
    const np=path.relative(ROOT,path.join(nativeRoot,'report.json')), ep=path.relative(ROOT,path.join(endpointRoot,'report.json'));
    bind(np);bind(ep);assert.equal(hash(np),'0802b23b4bdbee05fbc232f9851aeeb7cc4a67fe14227bb16b645c06cac61472');assert.equal(hash(ep),'b7096610aac66ab73830d1ca1ff09232cb0ec92cd6caa0380750bd2531ef4a0a');
    bind('tools/critic/compare-skeleton-orientation.mjs',true);bind('docs/evidence/wardrobe-2026-09-30/skeleton-placement/ORIENTATION-PLAN.md',true);
    const native=JSON.parse(read(np)),endpoint=JSON.parse(read(ep));assert.ok(endpoint.passed);
    const table=decode(nativeRoot,native.rigTable), names=Object.keys(table).sort();assert.equal(names.length,53);
    let full;
    for(const weight of [0,.25,1]){
        const n=decode(nativeRoot,native.cases.find(c=>c.weight===weight&&c.mode==='refit').artifact);
        const sdk=decode(endpointRoot,endpoint.cases.find(c=>c.weight===weight).artifact);
        const nativeMatrices={},sdkMatrices={};
        for(const [i,name] of names.entries()){
            const roll=table[name].roll;assert.equal(roll,n.bones[name].roll);
            nativeMatrices[name]=construct(n.bones[name].head,n.bones[name].tail,roll);
            sdkMatrices[name]=construct(sdk.sdkMeans.slice(i*6,i*6+3).map(Math.fround),sdk.sdkMeans.slice(i*6+3,i*6+6).map(Math.fround),roll);
        }
        const hierarchy=relativeAndRecompose(sdkMatrices,table);
        const comparisons={nativeEndpoints:compare(nativeMatrices,n.bones),sdkEndpoints:compare(sdkMatrices,n.bones),sdkRecomposed:compare(hierarchy.world,n.bones)};
        const r={weight,comparisons:Object.fromEntries(Object.entries(comparisons).map(([k,v])=>[k,v.summary]))};r.passed=Object.values(r.comparisons).every(c=>c.passed);r.interpretableAfterNeutral=weight===0||report.cases[0].passed;
        r.artifact=archive(`case-${String(weight).replace('.','_')}.json.gz`,{weight,nativeMatrices,sdkMatrices,hierarchy,comparisons});report.cases.push(r);save();
        if(weight===1)full={n,sdkMatrices,r};
    }
    const twisted=structuredClone(full.sdkMatrices), b=full.n.bones.clavicle_l;
    // Retain the clean prediction's head and local direction for a roll-only mutation.
    const clean=full.sdkMatrices.clavicle_l, head=at(clean,[0,0,0]), tail=at(clean,[0,distance(b.head,b.tail),0]);
    twisted.clavicle_l=construct(head,tail,table.clavicle_l.roll+Math.PI/2);
    const transposed=structuredClone(full.sdkMatrices);
    for(const m of Object.values(transposed)){const before=Array.from(m);for(let i=0;i<3;i++)for(let j=0;j<3;j++)m[i*4+j]=before[j*4+i];}
    for(const [name,matrices] of Object.entries({clavicleRoll90Degrees:twisted,transposedRotations:transposed})){
        const result=compare(matrices,full.n.bones),parent=full.r.comparisons.sdkEndpoints;
        const changed=names.some(n=>matrices[n].some((v,i)=>v!==full.sdkMatrices[n][i]));
        report.corruptions[name]={...result.summary,cleanParentResult:parent,changed,interpretable:parent.passed&&full.r.interpretableAfterNeutral};
        archive(name+'.json.gz',{matrices,result});assert.ok(changed&&!result.summary.passed);
        if(name==='clavicleRoll90Degrees')assert.ok(result.summary.maxEndpointMm<.1,'Roll-only witness unexpectedly fails endpoint check');
    }
    for(const [p,h] of Object.entries(report.inputs))assert.equal(hash(p),h,p);
    report.passed=report.cases.every(c=>c.passed&&c.interpretableAfterNeutral)&&Object.values(report.corruptions).every(c=>c.interpretable&&!c.passed&&c.changed);report.status='compared';
}catch(e){report.status='failed';report.errors.push(e.stack);throw e;}
finally{report.finished=new Date().toISOString();save();console.log(JSON.stringify({out,status:report.status,passed:report.passed,cases:report.cases.length}));}
