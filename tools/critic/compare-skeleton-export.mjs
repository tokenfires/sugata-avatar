// Actual accepted GLB vs the frozen native-neutral skeleton; read-only inputs.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {gunzipSync,gzipSync} from 'node:zlib';
import {fileURLToPath} from 'node:url';
const ROOT=fileURLToPath(new URL('../../',import.meta.url));
const out=path.join(ROOT,'captures/skeleton-export-bridge-2026-09-30-v1');
assert.ok(!fs.existsSync(out));fs.mkdirSync(out,{recursive:true});
const sha=b=>crypto.createHash('sha256').update(b).digest('hex'), read=p=>fs.readFileSync(path.resolve(ROOT,p)), hash=p=>sha(read(p));
const I=[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1], C=[1,0,0,0,0,0,1,0,0,-1,0,0,0,0,0,1];
const report={started:new Date().toISOString(),pid:process.pid,node:process.version,status:'running',errors:[],inputs:{},comparisons:{},corruptions:{},artifacts:[],scope:'One accepted neutral GLB coordinate and rest-bind bridge; no posed skin, body range, runtime integration or visual qualification.'};
const save=()=>fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');
function bind(p,copy=false){report.inputs[p]=hash(p);if(copy){const dest=path.join(out,'source',p);fs.mkdirSync(path.dirname(dest),{recursive:true});fs.copyFileSync(path.join(ROOT,p),dest);}}
function decode(dir,a){const b=read(path.join(dir,a.file));assert.equal(sha(b),a.sha256);const raw=gunzipSync(b);assert.equal(sha(raw),a.decodedSHA256);return JSON.parse(raw);}
function archive(name,value){const raw=Buffer.from(JSON.stringify(value)+'\n'),b=gzipSync(raw);fs.writeFileSync(path.join(out,name),b);const a={file:name,sha256:sha(b),decodedSHA256:sha(raw),bytes:b.length};report.artifacts.push(a);return a;}
const sub=(a,b)=>a.map((v,i)=>v-b[i]), norm=a=>Math.hypot(...a), dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0);
const normalized=a=>{const n=norm(a);assert.ok(n>0);return a.map(v=>v/n);};
function mul(a,b){return Array.from({length:16},(_,i)=>[0,1,2,3].reduce((s,k)=>s+a[Math.floor(i/4)*4+k]*b[k*4+i%4],0));}
function at(m,p){return [0,1,2].map(i=>[0,1,2].reduce((s,j)=>s+m[i*4+j]*p[j],m[i*4+3]));}
function transpose(a){return Array.from({length:16},(_,i)=>a[(i%4)*4+Math.floor(i/4)]);}
function nodeMatrix(n){
    if(n.matrix){assert.ok(!n.translation&&!n.rotation&&!n.scale);return transpose(n.matrix);}
    const [x,y,z,w]=n.rotation??[0,0,0,1],[sx,sy,sz]=n.scale??[1,1,1],t=n.translation??[0,0,0];
    // Match local three Matrix4.compose: preserve stored quaternion, do not renormalize it.
    assert.ok(Math.abs(norm([x,y,z,w])-1)<1e-6);
    return [(1-2*(y*y+z*z))*sx,2*(x*y-z*w)*sy,2*(x*z+y*w)*sz,t[0],
        2*(x*y+z*w)*sx,(1-2*(x*x+z*z))*sy,2*(y*z-x*w)*sz,t[1],
        2*(x*z-y*w)*sx,2*(y*z+x*w)*sy,(1-2*(x*x+y*y))*sz,t[2],0,0,0,1];
}
function metric(actual,expected,gateMm){
    assert.equal(actual.length,expected.length);assert.equal(actual.length%3,0);
    let maxMm=-1,sum=0,exact=0,worst;const residuals=[];
    for(let i=0;i<actual.length/3;i++){
        const a=actual.slice(i*3,i*3+3),e=expected.slice(i*3,i*3+3);assert.ok([...a,...e].every(Number.isFinite));
        const mm=norm(sub(a,e))*1000;sum+=mm*mm;if(mm===0)exact++;const row={vertex:i,actual:a,expected:e,mm};residuals.push(row);if(mm>maxMm){maxMm=mm;worst=row;}
    }
    return {summary:{passed:maxMm<gateMm,strict:true,gateMm,vertices:actual.length/3,maxMm,rmsMm:Math.sqrt(sum/(actual.length/3)),exact,worst},residuals};
}
function matricesMetric(predicted,expected,bones){
    const residuals=[];let maxMm=-1,maxComponent=0,maxAxisRadians=0,worst;
    for(const n of Object.keys(bones).sort()){
        const a=predicted[n],e=expected[n],length=norm(sub(bones[n].tail,bones[n].head));
        const points={origin:[0,0,0],tail:[0,length,0],basisX:[1,0,0],basisY:[0,1,0],basisZ:[0,0,1]};
        const component=Math.max(...a.map((v,i)=>Math.abs(v-e[i])));maxComponent=Math.max(component,maxComponent);
        const angles=[0,1,2].map(c=>{const u=normalized([a[c],a[4+c],a[8+c]]),v=normalized([e[c],e[4+c],e[8+c]]);const cross=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]];return Math.atan2(norm(cross),dot(u,v));});maxAxisRadians=Math.max(maxAxisRadians,...angles);
        const witnesses=Object.entries(points).map(([point,p])=>{const actual=at(a,p),expected=at(e,p),mm=norm(sub(actual,expected))*1000;if(mm>maxMm){maxMm=mm;worst={bone:n,point,actual,expected,mm};}return {point,actual,expected,mm};});
        residuals.push({bone:n,component,axisRadians:angles,witnesses});
    }
    return {summary:{passed:maxMm<.1,strict:true,gateMm:.1,bones:residuals.length,witnesses:residuals.length*5,maxMm,maxComponent,maxAxisRadians,worst},residuals};
}
function parseGLB(bytes){
    assert.equal(bytes.readUInt32LE(0),0x46546c67);assert.equal(bytes.readUInt32LE(4),2);assert.equal(bytes.readUInt32LE(8),bytes.length);
    const chunks=[];for(let p=12;p<bytes.length;){const size=bytes.readUInt32LE(p),type=bytes.readUInt32LE(p+4);assert.equal(size%4,0);assert.ok(p+8+size<=bytes.length);chunks.push({type,data:bytes.subarray(p+8,p+8+size)});p+=8+size;}
    assert.deepEqual(chunks.map(c=>c.type),[0x4e4f534a,0x004e4942]);
    const json=JSON.parse(chunks[0].data.toString('utf8')),binary=chunks[1].data;assert.equal(json.buffers.length,1);assert.ok(!json.buffers[0].uri);assert.ok(json.buffers[0].byteLength<=binary.length);
    function accessor(id){
        const a=json.accessors[id],view=json.bufferViews[a.bufferView];assert.ok(!a.sparse&&!a.normalized);assert.equal(view.buffer,0);
        const dims={VEC3:3,VEC4:4,MAT4:16}[a.type],spec={5121:[1,'readUInt8'],5123:[2,'readUInt16LE'],5125:[4,'readUInt32LE'],5126:[4,'readFloatLE']}[a.componentType];assert.ok(dims&&spec);
        const [size,method]=spec,stride=view.byteStride??size*dims,offset=(view.byteOffset??0)+(a.byteOffset??0);assert.ok(stride>=size*dims);
        assert.ok((a.byteOffset??0)+(a.count-1)*stride+size*dims<=view.byteLength);assert.ok((view.byteOffset??0)+view.byteLength<=json.buffers[0].byteLength);
        return Array.from({length:a.count},(_,i)=>Array.from({length:dims},(_,c)=>binary[method](offset+i*stride+c*size)));
    }
    return {json,accessor};
}
function skin(positions,joints,weights,matrices,inverses,jointNames){
    const transforms=jointNames.map((n,i)=>mul(matrices[n],inverses[i]));
    return positions.flatMap((p,i)=>{const v=[0,0,0];for(let k=0;k<4;k++){const j=joints[i][k],w=weights[i][k];assert.ok(Number.isInteger(j)&&j>=0&&j<transforms.length&&Number.isFinite(w)&&w>=0);const q=at(transforms[j],p);for(let c=0;c<3;c++)v[c]+=w*q[c];}return v;});
}
try{
    for(const p of ['tools/critic/compare-skeleton-export.mjs','docs/evidence/wardrobe-2026-09-30/skeleton-export-bridge/PLAN.md',
        'assets/figures/figure_g050.glb','assets/identity/figure-vertex-map.json','assets/identity/figure-vertex-map.bin',
        'node_modules/three/examples/jsm/loaders/GLTFLoader.js','node_modules/three/src/objects/SkinnedMesh.js','node_modules/three/src/math/Matrix4.js'])bind(p,true);
    assert.equal(hash('assets/figures/figure_g050.glb'),'b56115d0cb52edb72af7e725bf479d81253b660c298bd95ff9e89456d671ec14');
    const nr='captures/skeleton-native-oracle-2026-09-30-v1',or='captures/skeleton-orientation-2026-09-30-v1';
    bind(nr+'/report.json');bind(or+'/report.json');assert.equal(hash(nr+'/report.json'),'0802b23b4bdbee05fbc232f9851aeeb7cc4a67fe14227bb16b645c06cac61472');assert.equal(hash(or+'/report.json'),'caecc9a7678e5ebc5d15af9979905a1c674d063f3df8d697cdc48ce8880065ed');
    const nativeReport=JSON.parse(read(nr+'/report.json')),orientation=JSON.parse(read(or+'/report.json'));assert.ok(orientation.passed);
    const native=decode(nr,nativeReport.cases.find(c=>c.weight===0&&c.mode==='refit').artifact), predicted=decode(or,orientation.cases.find(c=>c.weight===0).artifact);
    const {json,accessor}=parseGLB(read('assets/figures/figure_g050.glb'));
    const scene=json.scenes[json.scene??0],world={},parents={};
    function visit(id,parentMatrix,parent,ancestors=new Set()){
        assert.ok(!ancestors.has(id)&&!world[id]);const n=json.nodes[id];world[id]=mul(parentMatrix,nodeMatrix(n));parents[id]=parent;
        for(const child of n.children??[])visit(child,world[id],id,new Set([...ancestors,id]));
    }
    for(const id of scene.nodes)visit(id,I,null);
    const candidates=json.nodes.map((n,i)=>({n,i})).filter(({n})=>n.mesh!==undefined&&json.meshes[n.mesh].name==='base.001');assert.equal(candidates.length,1);
    const {n:body,i:bodyId}=candidates[0];assert.deepEqual(world[bodyId],I);const mesh=json.meshes[body.mesh];assert.equal(mesh.primitives.length,1);
    const primitive=mesh.primitives[0];assert.ok(!('JOINTS_1' in primitive.attributes)&&!('WEIGHTS_1' in primitive.attributes));
    const morphWeights=body.weights??mesh.weights??[];assert.ok(morphWeights.every(w=>w===0));
    report.morphAdmission={targets:primitive.targets?.length??0,defaultWeights:morphWeights,allZero:true};
    const positions=accessor(primitive.attributes.POSITION),joints=accessor(primitive.attributes.JOINTS_0),weights=accessor(primitive.attributes.WEIGHTS_0);
    assert.equal(positions.length,14517);assert.equal(joints.length,positions.length);assert.equal(weights.length,positions.length);
    const s=json.skins[body.skin],jointNames=s.joints.map(i=>json.nodes[i].name);assert.equal(jointNames.length,53);assert.equal(new Set(jointNames).size,53);assert.deepEqual([...jointNames].sort(),Object.keys(native.bones).sort());
    const inverses=accessor(s.inverseBindMatrices).map(transpose);assert.equal(inverses.length,53);for(const m of inverses)assert.ok(m.slice(12).every((v,i)=>v===[0,0,0,1][i]));
    const exported={},converted={},constructed={};
    for(const [i,name] of jointNames.entries()){
        const id=s.joints[i],p=parents[id],parentName=s.joints.includes(p)?json.nodes[p].name:'';assert.equal(parentName,native.bones[name].parent);
        if(parentName==='')assert.deepEqual(p===null?I:world[p],I);
        exported[name]=world[id];converted[name]=mul(C,native.bones[name].matrixLocal.flat());constructed[name]=mul(C,predicted.sdkMatrices[name]);
    }
    const metadata=JSON.parse(read('assets/identity/figure-vertex-map.json'));assert.equal(metadata.groundingY,0);assert.equal(metadata.positionCount,14517);assert.equal(metadata.elementType,'uint16');
    const mapBytes=read('assets/identity/figure-vertex-map.bin');assert.equal(mapBytes.length,14517*2);const vertexMap=Array.from({length:14517},(_,i)=>mapBytes.readUInt16LE(i*2));assert.equal(new Set(vertexMap).size,13380);assert.ok(vertexMap.every(i=>i<13380));
    const nativeMapped=vertexMap.flatMap(i=>at(C,native.bodyPositions.slice(i*3,i*3+3))),original=positions.flat();
    const normalizedWeights=weights.map(row=>{const sum=row.reduce((a,b)=>a+Math.abs(b),0);assert.ok(sum>0);const scale=1/sum;return row.map(w=>Math.fround(w*scale));});
    report.weightSums={rawMin:Math.min(...weights.map(r=>r.reduce((a,b)=>a+b,0))),rawMax:Math.max(...weights.map(r=>r.reduce((a,b)=>a+b,0))),normalizedMin:Math.min(...normalizedWeights.map(r=>r.reduce((a,b)=>a+b,0))),normalizedMax:Math.max(...normalizedWeights.map(r=>r.reduce((a,b)=>a+b,0)))};
    archive('parsed-asset.json.gz',{nodes:json.nodes,scene,bodyId,skin:s,jointNames,world,parents,positions,joints,weights,normalizedWeights,inverses,vertexMap,converted,constructed});
    const matrixResults={nativeVersusExport:matricesMetric(converted,exported,native.bones),constructedVersusExport:matricesMetric(constructed,exported,native.bones)};
    for(const [name,result] of Object.entries(matrixResults)){report.comparisons[name]=result.summary;archive(name+'.json.gz',result);}
    const mapped=metric(original,nativeMapped,.001);report.comparisons.mappedBody=mapped.summary;archive('mapped-body.json.gz',mapped);
    for(const [label,matrices] of Object.entries({exported,converted,constructed}))for(const [kind,w] of Object.entries({raw:weights,normalized:normalizedWeights})){
        const values=skin(positions,joints,w,matrices,inverses,jointNames),result=metric(values,original,.342),name=label+'-'+kind;
        report.comparisons[name]=result.summary;archive(name+'.json.gz',{positions:values,result});
    }
    const wrongAxis=Object.fromEntries(jointNames.map(n=>[n,native.bones[n].matrixLocal.flat()]));
    const shifted=structuredClone(exported);for(const m of Object.values(shifted))m[3]+=.005;
    for(const [name,matrices,parentName] of [['wrongGlobalAxis',wrongAxis,'converted-normalized'],['fiveMillimetresWithStaleBinds',shifted,'exported-normalized']]){
        const values=skin(positions,joints,normalizedWeights,matrices,inverses,jointNames),result=metric(values,original,.342),parent=report.comparisons[parentName];
        const cleanMatrices=name==='wrongGlobalAxis'?converted:exported;
        const changed=jointNames.some(n=>matrices[n].some((v,i)=>v!==cleanMatrices[n][i]));
        report.corruptions[name]={...result.summary,cleanParent:parentName,cleanParentResult:parent,changed,interpretable:parent.passed};
        archive(name+'.json.gz',{matrices,positions:values,result});assert.ok(changed&&!result.summary.passed);
    }
    for(const [p,h] of Object.entries(report.inputs))assert.equal(hash(p),h,p);
    report.passed=Object.values(report.comparisons).every(c=>c.passed)&&Object.values(report.corruptions).every(c=>c.interpretable&&c.changed&&!c.passed);report.status='compared';
}catch(e){report.status='failed';report.errors.push(e.stack);throw e;}
finally{report.finished=new Date().toISOString();save();console.log(JSON.stringify({out,status:report.status,passed:report.passed,comparisons:Object.keys(report.comparisons).length}));}
