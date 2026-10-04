import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {BufferGeometry} from '../../../../node_modules/three/src/core/BufferGeometry.js';
import {Float32BufferAttribute,Uint8BufferAttribute} from '../../../../node_modules/three/src/core/BufferAttribute.js';
import {SkinnedMesh} from '../../../../node_modules/three/src/objects/SkinnedMesh.js';
import {Skeleton} from '../../../../node_modules/three/src/objects/Skeleton.js';
import {Bone} from '../../../../node_modules/three/src/objects/Bone.js';
import {Matrix4} from '../../../../node_modules/three/src/math/Matrix4.js';
import {Vector3} from '../../../../node_modules/three/src/math/Vector3.js';

const here=path.dirname(fileURLToPath(import.meta.url)), root=path.resolve(here,'../../../..');
const utc=()=>new Date().toISOString(), sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const read=n=>JSON.parse(fs.readFileSync(path.join(here,n),'utf8'));
const write=(n,x)=>fs.writeFileSync(path.join(here,n),JSON.stringify(x,null,2)+'\n');
const must=(ok,msg)=>{if(!ok)throw Error(msg);};
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const exactArray=(a,b,msg)=>{must(a.length===b.length,msg+' length');for(let i=0;i<a.length;i++)must(a[i]===b[i],msg+' row '+i);};
const deepEqual=(a,b)=>{
  if(a===b)return true;
  if(a===null||b===null||typeof a!=='object'||typeof b!=='object')return false;
  const ka=Object.keys(a).sort(),kb=Object.keys(b).sort();
  return same(ka,kb)&&ka.every(k=>deepEqual(a[k],b[k]));
};
const extent=ps=>({min:[0,1,2].map(k=>Math.min(...ps.map(p=>p[k]))),max:[0,1,2].map(k=>Math.max(...ps.map(p=>p[k])))});
const output={started:utc(),route:'current installed unmodified Three CPU normalization/getVertexPosition/world; original binary inputs','owners':[]};
const job={pid:process.pid,started:output.started,nodeVersion:process.version,executable:process.execPath,command:process.argv,maximumInvocations:1};
let exitCode=1;

function decodeGLB(blob){
  must(blob.readUInt32LE(0)===0x46546c67&&blob.readUInt32LE(4)===2&&blob.readUInt32LE(8)===blob.length,'original GLB header');
  let p=12,doc=null,bin=null,chunks=[];
  while(p<blob.length){
    must(p+8<=blob.length,'GLB chunk header extent');
    const n=blob.readUInt32LE(p),type=blob.readUInt32LE(p+4),a=p+8;
    must(n%4===0&&a+n<=blob.length,'GLB chunk range');chunks.push(type);
    if(type===0x4e4f534a)doc=JSON.parse(blob.subarray(a,a+n).toString('utf8'));
    else if(type===0x004e4942)bin=blob.subarray(a,a+n);
    p=a+n;
  }
  must(same(chunks,[0x4e4f534a,0x004e4942])&&doc&&bin,'JSON/BIN exact authority');
  must(doc.buffers.length===1&&!doc.buffers[0].uri&&doc.buffers[0].byteLength<=bin.length&&bin.length-doc.buffers[0].byteLength<=3,'one embedded original buffer');
  return {doc,bin:bin.subarray(0,doc.buffers[0].byteLength)};
}
function originalArray(d,bin,id,type,component){
  const a=d.accessors[id],view=d.bufferViews[a.bufferView];
  must(a.type===type&&a.componentType===component&&!a.normalized&&!a.sparse&&!a.extensions&&view.buffer===0&&!view.extensions,'selected original encoding');
  const count={VEC3:3,VEC4:4,MAT4:16,SCALAR:1}[type],width=component===5121?1:component===5123?2:4;
  const stride=view.byteStride??count*width,offset=a.byteOffset??0,start=view.byteOffset??0;
  must(a.count>0&&stride>=count*width&&stride%width===0&&offset>=0&&offset%width===0&&start>=0&&start%width===0,'original accessor stride/alignment');
  must(start+view.byteLength<=bin.length&&offset+(a.count-1)*stride+count*width<=view.byteLength,'original accessor range');
  const rows=[];
  for(let i=0;i<a.count;i++){
    const row=[];
    for(let k=0;k<count;k++){
      const p=start+offset+i*stride+k*width;
      row.push(component===5121?bin.readUInt8(p):component===5123?bin.readUInt16LE(p):bin.readFloatLE(p));
    }
    must(row.every(Number.isFinite),'original nonfinite');rows.push(row);
  }
  return rows;
}

try{
  const c=read('CONTRACT.json');must(Date.now()<Date.parse(c.oracleGateUTC),'oracle gate expired');
  for(const [rel,pin] of Object.entries(c.inputs)){
    const b=fs.readFileSync(path.resolve(root,rel));must(b.length===pin.bytes&&sha(b)===pin.sha256,'current original/engine pin '+rel);
  }
  const processRecord=read('RUN-PROCESS.json');must(processRecord.childExit===0&&!processRecord.late&&!processRecord.timedOut&&!processRecord.recordingErrors.length,'primary process/accounting refused');
  const ledgerBytes=fs.readFileSync(path.join(here,'LEDGER.json'));must(ledgerBytes.length===processRecord.actualFiles['LEDGER.json'].bytes&&sha(ledgerBytes)===processRecord.actualFiles['LEDGER.json'].sha256,'primary ledger actual bytes');
  const ledger=JSON.parse(ledgerBytes),obs=JSON.parse(fs.readFileSync(path.resolve(root,c.observationPath),'utf8'));
  must(ledger.owners.length===9&&ledger.vertexCount===39546,'complete primary source roles');output.ledgerSHA256=sha(ledgerBytes);output.inputs=c.inputs;
  const originals=new Map();let cursor=0,total=0,maximum=0;
  for(const source of obs.sources){
    const input=obs.inputs.find(a=>a.key===source.key),blob=fs.readFileSync(path.resolve(root,input.path));
    must(blob.length===input.bytes&&sha(blob)===input.sha256,'original source bytes');
    const {doc,bin}=decodeGLB(blob),marked=structuredClone(doc);
    for(const skin of marked.skins)for(const id of skin.joints)marked.nodes[id].isBone=true;
    for(const node of marked.nodes)if(node.mesh!==undefined&&node.skin!==undefined)marked.meshes[node.mesh].isSkinnedMesh=true;
    must(deepEqual(marked,source.rawDocument),'complete original JSON authority');originals.set(source.key,sha(blob));
    for(const saved of source.meshes){
      const o=ledger.owners[cursor++],a=saved.association;
      must(o.key===source.key&&o.name===saved.name&&deepEqual(o.association,a)&&deepEqual(o.sourceMeshRecord,saved),'nine original owner identity');
      const owners=source.nodes.filter(n=>n.uuid===saved.uuid);must(owners.length===1&&deepEqual(o.sourceNodeRecord,owners[0]),'original source node authority');
      const prim=doc.meshes[a.meshes].primitives[a.primitives],skin=doc.skins[doc.nodes[a.nodes].skin];
      must((prim.mode??4)===4&&saved.skinned&&saved.zeroMorphInfluences.every(x=>x===0)&&saved.originalMorphInfluences.every(x=>x===0)&&saved.zeroMorphInfluences.length===(prim.targets??[]).length,'zero-morph primitive route');
      const attrs=prim.attributes,positions=originalArray(doc,bin,attrs.POSITION,'VEC3',5126),joints=originalArray(doc,bin,attrs.JOINTS_0,'VEC4',5121),weights=originalArray(doc,bin,attrs.WEIGHTS_0,'VEC4',5126),ids=originalArray(doc,bin,prim.indices,'SCALAR',5123).flat(),ibms=originalArray(doc,bin,skin.inverseBindMatrices,'MAT4',5126);
      must(positions.length===saved.vertexCount&&positions.length===joints.length&&positions.length===weights.length&&ids.length%3===0&&ibms.length===53,'source array counts');
      must(deepEqual(positions,o.basePositions)&&deepEqual(joints,o.jointIndices)&&deepEqual(weights,o.rawWeights)&&deepEqual(ibms,o.inverseBindMatrices),'all original portable arrays');
      must(deepEqual(saved.bones.map(b=>b.inverseBind),ibms)&&deepEqual(saved.bones.map(b=>b.association.nodes),skin.joints),'53 original joint/bind order');
      exactArray(o.vertexIDs,positions.map((_,i)=>i),'original vertex IDs');exactArray(o.triangleIDs,Array.from({length:ids.length/3},(_,i)=>i),'original triangle IDs');exactArray(o.triangles.flat(),ids,'original triangles');
      must(o.worldPositions.length===positions.length&&o.loaderNormalizedFloat32Weights.length===positions.length,'all portable transformed rows');
      const g=new BufferGeometry();g.setAttribute('position',new Float32BufferAttribute(positions.flat(),3));g.setAttribute('skinIndex',new Uint8BufferAttribute(joints.flat(),4));g.setAttribute('skinWeight',new Float32BufferAttribute(weights.flat(),4));
      const mesh=new SkinnedMesh(g);mesh.normalizeSkinWeights();
      const bones=saved.bones.map(b=>{const x=new Bone();x.name=b.name;x.matrixWorld.fromArray(b.world);return x;});
      mesh.skeleton=new Skeleton(bones,ibms.map(m=>new Matrix4().fromArray(m)));mesh.bindMatrix.fromArray(saved.bind);mesh.bindMatrixInverse.fromArray(saved.bindInverse);mesh.matrixWorld.fromArray(owners[0].world);
      const result={key:source.key,name:saved.name,association:a,vertexCount:positions.length,triangleCount:ids.length/3,engineWorldPositions:[],maximumPointResidualMetres:0,worstPoint:null};output.owners.push(result);
      const v=new Vector3(),normalized=mesh.geometry.attributes.skinWeight.array;
      for(let i=0;i<positions.length;i++){
        result.currentVertex=i;result.currentNormalizedWeights=Array.from(normalized.subarray(i*4,i*4+4));exactArray(result.currentNormalizedWeights,o.loaderNormalizedFloat32Weights[i],'installed normalized weight '+i);
        const actual=mesh.getVertexPosition(i,v).applyMatrix4(mesh.matrixWorld).toArray();must(actual.every(Number.isFinite),'installed nonfinite point');result.engineWorldPositions.push(actual);
        const residual=Math.max(...actual.map((x,k)=>Math.abs(x-o.worldPositions[i][k])));
        if(result.worstPoint===null||residual>result.maximumPointResidualMetres){result.maximumPointResidualMetres=residual;result.worstPoint={vertexID:i,base:positions[i],portable:o.worldPositions[i],installed:actual,residualMetres:residual};}
        must(residual<=c.oracleToleranceMetres,'fixed pointwise oracle refusal '+source.key+'/'+saved.name+'/'+i);
      }
      result.bounds=extent(result.engineWorldPositions);total+=positions.length;maximum=Math.max(maximum,result.maximumPointResidualMetres);
      g.dispose();mesh.material.dispose();mesh.skeleton.dispose();write('CPU-ORACLE-PARTIAL.json',output);
    }
  }
  must(cursor===9&&total===39546,'complete installed point union');
  output.originalSHA256=Object.fromEntries(originals);output.vertexCount=total;output.maximumPointResidualMetres=maximum;
  output.bounds=extent(output.owners.flatMap(o=>o.engineWorldPositions));output.observedBounds=obs.framing.bounds;
  output.maximumNativeBoundResidualMetres=Math.max(...['min','max'].flatMap(s=>[0,1,2].map(k=>Math.abs(output.bounds[s][k]-obs.framing.bounds[s][k]))));
  write('CPU-ORACLE.json',output);
  must(output.maximumNativeBoundResidualMetres<=c.boundToleranceMetres,'fixed native union bounds refusal');must(Date.now()<Date.parse(c.oracleGateUTC),'late installed oracle result');
  job.status='A original CPU surface correspondence only; independent critic pending';job.vertices=total;job.maximumPointResidualMetres=maximum;job.maximumNativeBoundResidualMetres=output.maximumNativeBoundResidualMetres;exitCode=0;
}catch(e){job.status='B installed oracle; no dependent work';job.exception=e.message;job.exceptionStack=e.stack;try{write('CPU-ORACLE-PARTIAL.json',output);}catch(w){job.partialWriteError=w.message;}}
job.completed=utc();
try{write('CPU-ORACLE-JOB.json',job);}catch(e){job.jobWriteError=e.message;exitCode=1;}
console.log(JSON.stringify(job));process.exitCode=exitCode;
