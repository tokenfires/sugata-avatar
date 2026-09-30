// Finite posed-skin arithmetic. Full native and matched four-influence gates stay separate.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {gunzipSync,gzipSync} from 'node:zlib';
import {fileURLToPath} from 'node:url';
const ROOT=fileURLToPath(new URL('../../',import.meta.url));
const OUT=path.join(ROOT,'captures/skeleton-posed-comparison-2026-09-30-v1');
assert.ok(!fs.existsSync(OUT));fs.mkdirSync(OUT,{recursive:true});
const sha=b=>crypto.createHash('sha256').update(b).digest('hex'),read=p=>fs.readFileSync(path.resolve(ROOT,p)),hash=p=>sha(read(p));
const I=[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1], C=[1,0,0,0,0,0,1,0,0,-1,0,0,0,0,0,1];
const COMMANDS={identity:{},elbow:{lowerarm_l:{axis:[1,0,0],radians:.6}},coupled:{pelvis:{axis:[0,0,1],radians:.08},spine_02:{axis:[1,0,0],radians:.15},upperarm_l:{axis:[0,0,1],radians:-.35},lowerarm_l:{axis:[1,0,0],radians:.6},thigh_r:{axis:[1,0,0],radians:-.35},calf_r:{axis:[1,0,0],radians:.65},head:{axis:[0,1,0],radians:.2}}};
const report={started:new Date().toISOString(),pid:process.pid,node:process.version,status:'running',errors:[],inputs:{},cases:[],corruptions:{},artifacts:[],scope:'Three body cases and three commanded poses; native-full vs explicit export-four controls retained separately. No product, GPU or appearance qualification.'};
const save=()=>fs.writeFileSync(path.join(OUT,'report.json'),JSON.stringify(report,null,2)+'\n');
function bind(p,copy=false){report.inputs[p]=hash(p);if(copy){const dest=path.join(OUT,'source',p);fs.mkdirSync(path.dirname(dest),{recursive:true});fs.copyFileSync(path.join(ROOT,p),dest);}}
function decode(dir,a){const b=read(path.join(dir,a.file));assert.equal(sha(b),a.sha256);const raw=gunzipSync(b);assert.equal(sha(raw),a.decodedSHA256);return JSON.parse(raw);}
function archive(name,value){const raw=Buffer.from(JSON.stringify(value)+'\n'),b=gzipSync(raw);fs.writeFileSync(path.join(OUT,name),b);const a={file:name,sha256:sha(b),decodedSHA256:sha(raw),bytes:b.length};report.artifacts.push(a);return a;}
const norm=a=>Math.hypot(...a),sub=(a,b)=>a.map((v,i)=>v-b[i]);
function mul(a,b){return Array.from({length:16},(_,i)=>[0,1,2,3].reduce((s,k)=>s+a[Math.floor(i/4)*4+k]*b[k*4+i%4],0));}
function at(m,p){return [0,1,2].map(i=>[0,1,2].reduce((s,j)=>s+m[i*4+j]*p[j],m[i*4+3]));}
function inverse(m){
    assert.ok(m.length===16&&m.every(Number.isFinite));
    const a=Array.from({length:4},(_,i)=>[...m.slice(i*4,i*4+4),...I.slice(i*4,i*4+4)]);
    for(let c=0;c<4;c++){
        let pivot=c;for(let i=c+1;i<4;i++)if(Math.abs(a[i][c])>Math.abs(a[pivot][c]))pivot=i;
        assert.ok(Math.abs(a[pivot][c])>1e-12);[a[c],a[pivot]]=[a[pivot],a[c]];
        const d=a[c][c];for(let k=0;k<8;k++)a[c][k]/=d;
        for(let i=0;i<4;i++)if(i!==c){const f=a[i][c];for(let k=0;k<8;k++)a[i][k]-=f*a[c][k];}
    }
    return a.flatMap(r=>r.slice(4));
}
function basis(command){
    if(!command)return I;
    const axis=command.axis,len=norm(axis);assert.ok(len>0&&Number.isFinite(command.radians));
    const s=Math.sin(command.radians/2)/len,[x,y,z]=axis.map(v=>v*s),w=Math.cos(command.radians/2);
    return [1-2*(y*y+z*z),2*(x*y-z*w),2*(x*z+y*w),0,2*(x*y+z*w),1-2*(x*x+z*z),2*(y*z-x*w),0,2*(x*z-y*w),2*(y*z+x*w),1-2*(x*x+y*y),0,0,0,0,1];
}
function propagate(rest,bases,bones){
    const result={},inverses=Object.fromEntries(Object.entries(rest).map(([n,m])=>[n,inverse(m)]));
    function place(n,chain=new Set()){
        assert.ok(!chain.has(n));if(result[n])return result[n];
        const p=bones[n].parent,next=new Set([...chain,n]);
        return result[n]=mul(p?mul(mul(place(p,next),inverses[p]),rest[n]):rest[n],bases[n]);
    }
    for(const n of Object.keys(rest))place(n);return result;
}
function metric(actual,expected,gateMm){
    assert.equal(actual.length,expected.length);assert.equal(actual.length%3,0);let maxMm=-1,sum=0,exact=0,worst;const residuals=[];
    for(let i=0;i<actual.length/3;i++){const a=actual.slice(i*3,i*3+3),e=expected.slice(i*3,i*3+3);assert.ok([...a,...e].every(Number.isFinite));const mm=norm(sub(a,e))*1000;sum+=mm*mm;if(mm===0)exact++;const row={vertex:i,actual:a,expected:e,mm};residuals.push(row);if(mm>maxMm){maxMm=mm;worst=row;}}
    return {summary:{passed:maxMm<gateMm,strict:true,gateMm,vertices:actual.length/3,maxMm,rmsMm:Math.sqrt(sum/(actual.length/3)),exact,worst},residuals};
}
function matrixMetric(predicted,expected,bones){
    const rows=[];let maxMm=-1,worst,maxComponent=0;
    for(const n of Object.keys(bones).sort()){
        const a=predicted[n],e=expected[n],length=norm(sub(bones[n].head,bones[n].tail));
        const component=Math.max(...a.map((v,i)=>Math.abs(v-e[i])));maxComponent=Math.max(maxComponent,component);
        const points={origin:[0,0,0],tail:[0,length,0],basisX:[1,0,0],basisY:[0,1,0],basisZ:[0,0,1]};
        const witnesses=Object.entries(points).map(([point,p])=>{const actual=at(a,p),expected=at(e,p),mm=norm(sub(actual,expected))*1000;if(mm>maxMm){maxMm=mm;worst={bone:n,point,actual,expected,mm};}return {point,actual,expected,mm};});rows.push({bone:n,component,witnesses});
    }
    return {summary:{passed:maxMm<.1,strict:true,gateMm:.1,bones:rows.length,witnesses:rows.length*5,maxMm,maxComponent,worst},rows};
}
function nativeSkin(coords,weights,pose,rest){
    const transforms=Object.fromEntries(Object.keys(rest).map(n=>[n,mul(pose[n],inverse(rest[n]))]));
    assert.equal(weights.length,coords.length/3);
    return weights.flatMap((row,i)=>{
        assert.ok(row.length>0);const total=row.reduce((s,[,w])=>s+w,0);assert.ok(total>0);
        const p=coords.slice(i*3,i*3+3),v=[0,0,0];for(const [name,w]of row){assert.ok(w>0&&Number.isFinite(w));const q=at(transforms[name],p);for(let c=0;c<3;c++)v[c]+=(w/total)*q[c];}return v;
    });
}
function exportedSkin(positions,asset,pose,restForBind){
    const transforms=Object.fromEntries(asset.jointNames.map(n=>[n,mul(pose[n],inverse(restForBind[n]))]));
    return positions.flatMap((p,i)=>{const v=[0,0,0];for(let k=0;k<4;k++){const name=asset.jointNames[asset.joints[i][k]],w=asset.normalizedWeights[i][k],q=at(transforms[name],p);for(let c=0;c<3;c++)v[c]+=w*q[c];}return v;});
}
const inGltf=matrices=>Object.fromEntries(Object.entries(matrices).map(([n,m])=>[n,mul(C,m)]));
try{
    const nr='captures/skeleton-native-pose-2026-09-30-v1',br='captures/skeleton-export-bridge-2026-09-30-v1',or='captures/skeleton-orientation-2026-09-30-v1',er='captures/skeleton-native-comparison-2026-09-30-v1';
    const pins={[nr]:'226a55bc568bec712c847b5a12b91b6c7a019170d91dd26c2d56e60c140f2be1',[br]:'a1c1ec374c41f2fd1c197d666a6b25d7c0f11bf52b796c4a5b02cc03270ed3e9',[or]:'caecc9a7678e5ebc5d15af9979905a1c674d063f3df8d697cdc48ce8880065ed',[er]:'b7096610aac66ab73830d1ca1ff09232cb0ec92cd6caa0380750bd2531ef4a0a'};
    for(const [p,h]of Object.entries(pins)){bind(p+'/report.json');assert.equal(hash(p+'/report.json'),h);}
    bind('tools/critic/compare-skeleton-posed.mjs',true);bind('docs/evidence/wardrobe-2026-09-30/skeleton-posed-skin/PLAN.md',true);
    const native=JSON.parse(read(nr+'/report.json')),bridge=JSON.parse(read(br+'/report.json')),orientation=JSON.parse(read(or+'/report.json')),endpoint=JSON.parse(read(er+'/report.json'));
    assert.equal(native.status,'observed-awaiting-independent-comparison');assert.ok(bridge.passed&&orientation.passed&&endpoint.passed);assert.deepEqual(native.poses,COMMANDS);assert.equal(native.observations.length,18);assert.deepEqual(native.bodies.map(c=>c.weight),[0,.25,1]);
    for(const [p,h]of Object.entries(native.sourceHashes))assert.equal(hash(p),h,p);
    for(const a of native.artifacts)decode(nr,a);
    const asset=decode(br,bridge.artifacts.find(a=>a.file==='parsed-asset.json.gz'));
    const names=[...asset.jointNames].sort(),mapBody=coords=>asset.vertexMap.flatMap(i=>at(C,coords.slice(i*3,i*3+3)));
    const neutralRest=inGltf(decode(or,orientation.cases[0].artifact).sdkMatrices);
    let negativeData={};
    for(const weight of [0,.25,1]){
        const body=decode(nr,native.bodies.find(c=>c.weight===weight).artifact),orient=decode(or,orientation.cases.find(c=>c.weight===weight).artifact),deltas=decode(er,endpoint.cases.find(c=>c.weight===weight).artifact);
        const bones=body.restBones,rest=Object.fromEntries(names.map(n=>[n,bones[n].matrixLocal.flat()])),constructedRest=orient.sdkMatrices;
        assert.deepEqual(Object.keys(rest).sort(),names);
        const shaped=asset.positions.map((p,i)=>{const id=asset.vertexMap[i],d=at(C,deltas.sdkDelta.slice(id*3,id*3+3));return p.map((v,c)=>v+d[c]);});
        const observation=(arm,pose)=>{const found=native.observations.filter(c=>c.weight===weight&&c.arm===arm&&c.pose===pose);assert.equal(found.length,1);const row=found[0];return {data:decode(nr,row.artifact),weights:decode(nr,row.weights)};};
        for(const poseName of Object.keys(COMMANDS)){
            const full=observation('native-full',poseName),four=observation('export-four',poseName),commands=COMMANDS[poseName];
            for(const row of [full,four]){assert.deepEqual(row.data.commands,commands);assert.equal(row.data.space,'blender-z-up-metres');assert.deepEqual(Object.keys(row.data.poseBones).sort(),names);}
            const actualPose=Object.fromEntries(names.map(n=>[n,full.data.poseBones[n].evaluatedMatrix.flat()]));
            for(const n of names)assert.deepEqual(full.data.poseBones[n],four.data.poseBones[n]);
            const actualBases=Object.fromEntries(names.map(n=>[n,full.data.poseBones[n].basis.flat()])),commandBases=Object.fromEntries(names.map(n=>[n,basis(commands[n])]));
            const nativePropagation=propagate(rest,actualBases,bones),constructedPose=propagate(constructedRest,commandBases,bones);
            const comparisons={
                observedBasisPropagation:matrixMetric(nativePropagation,actualPose,bones),
                constructedCommandPropagation:matrixMetric(constructedPose,actualPose,bones),
                nativeFullLinear:metric(nativeSkin(body.bodyPositions,full.weights,actualPose,rest),full.data.bodyPositions,.342),
                nativeFourLinear:metric(nativeSkin(body.bodyPositions,four.weights,actualPose,rest),four.data.bodyPositions,.342),
            };
            const exportedPose=inGltf(constructedPose),exportedRest=inGltf(constructedRest),proposed=exportedSkin(shaped,asset,exportedPose,exportedRest);
            comparisons.proposedVersusNativeFour=metric(proposed,mapBody(four.data.bodyPositions),.342);
            comparisons.proposedVersusNativeFull=metric(proposed,mapBody(full.data.bodyPositions),.342);
            comparisons.nativeFourVersusNativeFull=metric(mapBody(four.data.bodyPositions),mapBody(full.data.bodyPositions),.342);
            const r={weight,pose:poseName,comparisons:Object.fromEntries(Object.entries(comparisons).map(([k,v])=>[k,v.summary]))};
            r.matchedRepresentationPassed=['observedBasisPropagation','constructedCommandPropagation','nativeFullLinear','nativeFourLinear','proposedVersusNativeFour'].every(k=>r.comparisons[k].passed);
            r.unmodifiedNativePassed=r.comparisons.proposedVersusNativeFull.passed;
            const requiredControls=report.cases.filter(c=>(weight!==0&&c.weight===0&&c.pose===poseName)||(poseName!=='identity'&&c.weight===weight&&c.pose==='identity'));
            assert.equal(requiredControls.length,(weight!==0?1:0)+(poseName!=='identity'?1:0));
            r.interpretableAfterControls=requiredControls.every(c=>c.matchedRepresentationPassed&&c.interpretableAfterControls);
            r.fullReferenceInterpretableAfterControls=requiredControls.every(c=>c.unmodifiedNativePassed&&c.fullReferenceInterpretableAfterControls);
            r.artifact=archive(`case-${String(weight).replace('.','_')}-${poseName}.json.gz`,{weight,pose:poseName,nativePropagation,constructedRest,constructedPose,commandBases,shapedPositions:shaped,proposedPositions:proposed,comparisons});report.cases.push(r);save();
            if(weight===1&&['elbow','coupled'].includes(poseName))negativeData[poseName]={r,shaped,exportedPose,exportedRest,constructedRest,bones,expected:mapBody(four.data.bodyPositions),proposed};
        }
    }
    const stale=negativeData.coupled,elbow=negativeData.elbow;
    const noElbowBases=Object.fromEntries(names.map(n=>[n,I])),noElbow=inGltf(propagate(elbow.constructedRest,noElbowBases,elbow.bones));
    const controls={staleNeutralInverseBinds:{parent:stale,positions:exportedSkin(stale.shaped,asset,stale.exportedPose,neutralRest)},omittedElbowPropagation:{parent:elbow,positions:exportedSkin(elbow.shaped,asset,noElbow,elbow.exportedRest)}};
    for(const [name,{parent,positions}]of Object.entries(controls)){
        const result=metric(positions,parent.expected,.342),mutation=metric(positions,parent.proposed,.342),clean=parent.r.comparisons.proposedVersusNativeFour;
        report.corruptions[name]={...result.summary,cleanParent:{weight:parent.r.weight,pose:parent.r.pose,result:clean},mutationMaxMm:mutation.summary.maxMm,changed:mutation.summary.maxMm>0,interpretable:clean.passed&&parent.r.interpretableAfterControls};
        archive(name+'.json.gz',{positions,result,mutation});
    }
    for(const [p,h]of Object.entries(report.inputs))assert.equal(hash(p),h,p);
    for(const [p,h]of Object.entries(native.sourceHashes))assert.equal(hash(p),h,p);
    report.matchedRepresentationPassed=report.cases.every(c=>c.matchedRepresentationPassed&&c.interpretableAfterControls);
    report.unmodifiedNativePassed=report.cases.every(c=>c.unmodifiedNativePassed&&c.fullReferenceInterpretableAfterControls);
    report.negativeControlsPassed=Object.values(report.corruptions).every(c=>c.interpretable&&c.changed&&!c.passed);
    report.passed=report.matchedRepresentationPassed&&report.unmodifiedNativePassed&&report.negativeControlsPassed;
    report.status='compared';
}catch(e){report.status='failed';report.errors.push(e.stack);throw e;}
finally{report.finished=new Date().toISOString();save();console.log(JSON.stringify({out:OUT,status:report.status,passed:report.passed,matchedRepresentationPassed:report.matchedRepresentationPassed,unmodifiedNativePassed:report.unmodifiedNativePassed,cases:report.cases.length}));}
