import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { gzipSync,gunzipSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { readGlb,readAccessor } from '../../../../../tools/lut-bake/glb.mjs';
import { parseOBJ,establishMap,validateMap } from './map-topology.mjs';

const HERE=path.dirname(fileURLToPath(import.meta.url)),ROOT=path.resolve(HERE,'../../../../..'),PARENT=path.dirname(HERE);
const sha=b=>crypto.createHash('sha256').update(b).digest('hex'),read=p=>fs.readFileSync(path.join(ROOT,p));
const inventoryBytes=fs.readFileSync(path.join(PARENT,'inventory-v1.json'));
assert.equal(sha(inventoryBytes),'a5efb4f0882a47fa3276b4b059427a85d008fad28c4177030a17c358387e99f0');
const inventory=JSON.parse(inventoryBytes),archive=inventory.archives.find(a=>a.path.includes('system_assets'));
const objMember=archive.members.find(m=>m.path.endsWith('.obj'));
assert.equal(sha(read(archive.path)),archive.sha256);
const objBytes=execFileSync('python3',['-c','import sys,zipfile;sys.stdout.buffer.write(zipfile.ZipFile(sys.argv[1]).read(sys.argv[2]))',path.join(ROOT,archive.path),objMember.path],{maxBuffer:8*1024*1024});
assert.equal(sha(objBytes),objMember.sha256);
const obj=parseOBJ(objBytes.toString('utf8'));
const originalPath='tools/figure-pipeline/fixtures/casual-g050-original.glb',acceptedPath='assets/wardrobe/female_casualsuit01/g050.glb';
const inputPaths=[originalPath,acceptedPath,'tools/lut-bake/glb.mjs',
    ...['map-topology.mjs','map-topology.selftest.mjs','prove-map.mjs'].map(n=>path.relative(ROOT,path.join(HERE,n)))];
for(const p of [originalPath,acceptedPath])assert.equal(sha(read(p)),inventory.files.find(f=>f.path===p).sha256);
const inputSources=inputPaths.map(p=>({path:p,sha256:sha(read(p))}));
const original=readGlb(path.join(ROOT,originalPath)),accepted=readGlb(path.join(ROOT,acceptedPath));
function primitive(glb){assert.equal(glb.json.meshes.length,1);assert.equal(glb.json.meshes[0].name,'female_casualsuit01');assert.equal(glb.json.meshes[0].primitives.length,1);return glb.json.meshes[0].primitives[0];}
function attribute(glb,name){return readAccessor(glb,primitive(glb).attributes[name]).data;}
function indices(glb){return readAccessor(glb,primitive(glb).indices).data;}
function attributeBytes(glb,id){
    const a=glb.json.accessors[id],v=glb.json.bufferViews[a.bufferView];assert.ok(!a.sparse);
    const elements={SCALAR:1,VEC2:2,VEC3:3,VEC4:4}[a.type],bytes={5121:1,5123:2,5125:4,5126:4}[a.componentType];assert.ok(elements&&bytes);
    const start=(v.byteOffset??0)+(a.byteOffset??0),length=elements*bytes,stride=v.byteStride??length;
    return Buffer.concat(Array.from({length:a.count},(_,i)=>glb.bin.subarray(start+i*stride,start+i*stride+length)));
}
const preserved={};
for(const name of ['TEXCOORD_0','JOINTS_0','WEIGHTS_0']){
    const a=attributeBytes(original,primitive(original).attributes[name]),b=attributeBytes(accepted,primitive(accepted).attributes[name]);assert.deepEqual(a,b);preserved[name]={bytes:a.length,sha256:sha(a)};
}
const aIndex=attributeBytes(original,primitive(original).indices),bIndex=attributeBytes(accepted,primitive(accepted).indices);assert.deepEqual(aIndex,bIndex);preserved.indices={bytes:aIndex.length,sha256:sha(aIndex)};
assert.deepEqual(original.json.nodes,accepted.json.nodes);assert.deepEqual(original.json.skins,accepted.json.skins);assert.deepEqual(original.json.materials,accepted.json.materials);
const uv=attribute(original,'TEXCOORD_0'),triangles=indices(original),mapping=establishMap(obj,uv,triangles);
const destination=path.resolve(HERE,process.argv[2]??'proof-v1');assert.ok(destination.startsWith(HERE+path.sep));assert.ok(!fs.existsSync(destination));fs.mkdirSync(destination);
const outputs=[];
function save(name,data){const decoded=Buffer.from(JSON.stringify(data)+'\n'),encoded=gzipSync(decoded,{level:9}),p=path.join(destination,name+'.json.gz');fs.writeFileSync(p,encoded,{flag:'wx'});outputs.push({path:path.relative(ROOT,p),bytes:encoded.length,sha256:sha(encoded),decodedBytes:decoded.length,decodedSHA256:sha(decoded)});}
save('map',mapping);
assert.equal(mapping.status,'unique','Unresolved mapping retained; do not guess');
assert.equal(mapping.map.length,2377);assert.equal(new Set(mapping.map).size,2197);
validateMap(mapping.map,obj,attribute(accepted,'TEXCOORD_0'),indices(accepted));
// Coordinates are introduced only AFTER the unique discrete map has been established.
const old=attribute(original,'POSITION'),now=attribute(accepted,'POSITION'),oldNormals=attribute(original,'NORMAL'),newNormals=attribute(accepted,'NORMAL');
const baselineReportBytes=fs.readFileSync(path.join(PARENT,'proof-v1/report.json'));
assert.equal(sha(baselineReportBytes),'4a3e861e3b744929c5f664c81787c59dd2b84de090bab468b45e3b08aae09277');
const baselineReport=JSON.parse(baselineReportBytes),caseEntry=baselineReport.artifacts.find(a=>a.path.endsWith('/case-0.json.gz'));
const caseBytes=read(caseEntry.path);assert.equal(sha(caseBytes),caseEntry.sha256);const caseDecoded=gunzipSync(caseBytes);assert.equal(sha(caseDecoded),caseEntry.decodedSHA256);
const case0=JSON.parse(caseDecoded),source=case0.garmentPositions;
const residuals=[],splitDeltas=new Map(),splitOriginalPositions=new Map();let sumSq=0,maxMm=-1,worst=null,normalChanges=0;
for(let i=0;i<mapping.map.length;i++){
    const sourceID=mapping.map[i],p=source.slice(sourceID*3,sourceID*3+3),predicted=[p[0],p[2],-p[1]],before=Array.from(old.slice(i*3,i*3+3)),after=Array.from(now.slice(i*3,i*3+3));
    const mm=Math.hypot(...predicted.map((x,c)=>x-before[c]))*1000;sumSq+=mm*mm;if(mm>maxMm){maxMm=mm;worst={gltfVertex:i,sourceVertex:sourceID,predicted,original:before};}
    const delta=after.map((x,c)=>x-before[c]);
    if(splitDeltas.has(sourceID))assert.deepEqual(delta,splitDeltas.get(sourceID),'One source vertex has conflicting accepted correction across splits');else splitDeltas.set(sourceID,delta);
    if(splitOriginalPositions.has(sourceID))assert.deepEqual(before,splitOriginalPositions.get(sourceID),'Mapped source split positions differ');else splitOriginalPositions.set(sourceID,before);
    if(delta.some(x=>x!==0))residuals.push({gltfVertex:i,sourceVertex:sourceID,original:before,accepted:after,deltaM:delta,distanceMm:Math.hypot(...delta)*1000});
    if([0,1,2].some(c=>oldNormals[i*3+c]!==newNormals[i*3+c]))normalChanges++;
}
const baselineAgreement={positions:mapping.map.length,maxMm,rmsMm:Math.sqrt(sumSq/mapping.map.length),worst,
    comparison:'source-derived CPU neutral mhclo output vs hash-bound original exported GLB, after map established without positions',
    nativeOracle:false,limit:'No new native helper or deformed-identity oracle; does not qualify accepted corrective or fit.'};
assert.ok(maxMm<.1,'Original garment baseline comparison exceeds existing planned0.1mm bar');
const movedSources=[...new Set(residuals.map(r=>r.sourceVertex))].sort((a,b)=>a-b),maxResidual=residuals.reduce((a,b)=>a.distanceMm>b.distanceMm?a:b);
assert.equal(residuals.length,205);assert.ok(residuals.every(r=>r.original[1]<.35));
save('accepted-residuals',{rows:residuals,movedSourceVertices:movedSources,normalChangedGLTFVertices:normalChanges,
    exactPerSourceDeltaAcrossSplits:true,limits:'Rest accessor differences only, not a body-dependent corrective rule or runtime coupling.'});
const controls=[];
const wrong=mapping.map.slice();wrong[0]=mapping.map.find(v=>v!==wrong[0]);assert.throws(()=>validateMap(wrong,obj,uv,triangles));controls.push({name:'valid but wrong mapped source ID',gltfVertex:0,correct:mapping.map[0],corrupt:wrong[0],rejected:true});
const corruptIndices=triangles.slice();[corruptIndices[0],corruptIndices[1]]=[corruptIndices[1],corruptIndices[0]];assert.throws(()=>establishMap(obj,uv,corruptIndices));controls.push({name:'actual first triangle winding reversed',rejected:true});
const badUV=uv.slice();badUV[0]=2;assert.equal(establishMap(obj,badUV,triangles).status,'unresolved');controls.push({name:'actual GLB UV changed to absent pair',gltfVertex:0,rejected:true});
const ambiguousObj=structuredClone(obj);ambiguousObj.texcoords.push([...obj.texcoords[obj.faces[0][0].uv]]);ambiguousObj.faces[0][1].uv=ambiguousObj.texcoords.length-1;
const ambiguity=establishMap(ambiguousObj,uv,triangles);assert.equal(ambiguity.status,'unresolved');save('ambiguous-control',{status:ambiguity.status,unresolved:ambiguity.unresolved});controls.push({name:'actual source UV assigned to a different source vertex',unresolvedVertices:ambiguity.unresolved.length,rejected:true});
for(const input of inputSources)assert.equal(sha(read(input.path)),input.sha256);
assert.equal(sha(read(archive.path)),archive.sha256);
const report={protocol:'casual-discrete-source-map-v1',completed:true,inputSources,archive:{path:archive.path,sha256:archive.sha256,member:objMember},
    inventorySHA256:sha(inventoryBytes),baselineReportSHA256:sha(baselineReportBytes),case0:caseEntry,outputs,
    primaryEvidence:{method:'Unique exact transformed float32 UV bit pairs, then one source quad per GLB triangle, oriented2triangle tiling per quad.',
        sourceUVConvention:'u=float32(raw u), v=float32(1-float32(raw v)); no UV/position tolerance and no nearest-point search.',
        indices:'All retained IDs zero-based; source OBJ1-based IDs converted once.',counts:mapping.counts,ambiguities:0,unmatched:0},
    originalToAcceptedPreserved:preserved,bodyBaselineAgreement:baselineReport.correspondence,garmentBaselineAgreement:baselineAgreement,
    acceptedResiduals:{changedGLTFVertices:residuals.length,changedSourceVertices:movedSources.length,maxMm:maxResidual.distanceMm,worst:maxResidual,
        originalYRangeM:[Math.min(...residuals.map(r=>r.original[1])),Math.max(...residuals.map(r=>r.original[1]))],
        normalChangedGLTFVertices:normalChanges,exactPerSourceDeltaAcrossSplits:true,allUnchangedPositionsExact:true},controls,
    limits:['Map belongs only to pinned source OBJ and original/accepted GLBs; different assets require fresh proof.',
        'Duplicate source vt record IDs may remain equivalent; garment vertex IDs are fully unique.',
        'Accepted-minus-original residuals are characterized, not applied or generalized to identities.',
        'No Blender install/GPU/asset export/new native MPFB oracle/fit or motion qualification.']};
fs.writeFileSync(path.join(destination,'report.json'),JSON.stringify(report,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({destination:path.relative(ROOT,destination),counts:mapping.counts,baselineAgreement,acceptedResiduals:report.acceptedResiduals,controls,outputs},null,2));
