// Inert until separate admission. Reads ORIGINAL independently; never imports
// reader.py or trusts its source definitions, matrices, bounds or status.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { BufferGeometry } from '../../../../node_modules/three/src/core/BufferGeometry.js';
import { BufferAttribute } from '../../../../node_modules/three/src/core/BufferAttribute.js';
import { Object3D } from '../../../../node_modules/three/src/core/Object3D.js';
import { Bone } from '../../../../node_modules/three/src/objects/Bone.js';
import { Mesh } from '../../../../node_modules/three/src/objects/Mesh.js';
import { SkinnedMesh } from '../../../../node_modules/three/src/objects/SkinnedMesh.js';
import { Skeleton } from '../../../../node_modules/three/src/objects/Skeleton.js';
import { Line } from '../../../../node_modules/three/src/objects/Line.js';
import { LineLoop } from '../../../../node_modules/three/src/objects/LineLoop.js';
import { LineSegments } from '../../../../node_modules/three/src/objects/LineSegments.js';
import { Points } from '../../../../node_modules/three/src/objects/Points.js';
import { Matrix4 } from '../../../../node_modules/three/src/math/Matrix4.js';
import { Vector3 } from '../../../../node_modules/three/src/math/Vector3.js';
import { Vector4 } from '../../../../node_modules/three/src/math/Vector4.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../../../..');
const source = path.join(root, 'assets/figures/figure_g100.glb');
const sourceSha = 'c2a21d403636a81aff77969c0089c91379172c8764aabb14d1cb7de47c685811';
const tolerance = 1e-9, jsonCap = 64 * 1024 * 1024, totalCap = 256 * 1024 * 1024;
const fail = (yes, witness) => { if (!yes) throw new Error(witness); };
const sha = b => crypto.createHash('sha256').update(b).digest('hex');
const out = path.resolve(process.argv[2] ?? '');
fail(process.argv.length === 3 && out === path.join(here, 'output'), 'fixed output argument');
const warnings = [];
console.warn = (...args) => warnings.push(args.map(String).join(' '));
console.error = (...args) => warnings.push(args.map(String).join(' '));
const original = fs.readFileSync(source);
fail(original.length === 11567784 && sha(original) === sourceSha, 'original source pin');
fail(original.readUInt32LE(0) === 0x46546c67 && original.readUInt32LE(4) === 2 && original.readUInt32LE(8) === original.length, 'original GLB header');
const chunks = [];
for (let offset = 12; offset < original.length;) {
  fail(offset + 8 <= original.length, 'chunk header');
  const bytes = original.readUInt32LE(offset), type = original.readUInt32LE(offset+4);
  fail(bytes % 4 === 0 && offset+8+bytes <= original.length, 'chunk span');
  chunks.push({type, offset: offset+8, bytes, sha256: sha(original.subarray(offset+8, offset+8+bytes))});
  offset += 8 + bytes;
}
fail(chunks.length >= 2 && chunks[0].type === 0x4e4f534a && chunks[1].type === 0x004e4942, 'JSON/BIN ownership');
fail(chunks.filter(x => x.type === 0x4e4f534a).length === 1 && chunks.filter(x => x.type === 0x004e4942).length === 1, 'unique chunks');
const rawJson = original.subarray(chunks[0].offset, chunks[0].offset+chunks[0].bytes);
const doc = JSON.parse(new TextDecoder('utf-8', {fatal: true}).decode(rawJson));
fail(doc.asset?.version === '2.0' && (doc.asset.minVersion ?? '2.0') === '2.0', 'original glTF version');
fail(doc.buffers?.length === 1 && doc.buffers[0].uri === undefined, 'embedded buffer');
const bin = original.subarray(chunks[1].offset, chunks[1].offset+doc.buffers[0].byteLength);
const view = new DataView(bin.buffer, bin.byteOffset, bin.byteLength);
const types = {
  5120: [Int8Array, 1, 'getInt8'], 5121: [Uint8Array, 1, 'getUint8'],
  5122: [Int16Array, 2, 'getInt16'], 5123: [Uint16Array, 2, 'getUint16'],
  5125: [Uint32Array, 4, 'getUint32'], 5126: [Float32Array, 4, 'getFloat32']
};
const shapes = {SCALAR:[1,1], VEC2:[2,1], VEC3:[3,1], VEC4:[4,1], MAT2:[2,2], MAT3:[3,3], MAT4:[4,4]};
const normalized = (v, ct) => ct === 5120 ? Math.max(v/127, -1) : ct === 5121 ? v/255 :
  ct === 5122 ? Math.max(v/32767, -1) : ct === 5123 ? v/65535 : v;
let totalScalars = 0;
const accessors = (doc.accessors ?? []).map((a, ai) => {
  fail(types[a.componentType] && shapes[a.type], `accessor${ai} type`);
  const [Typed, width, getter] = types[a.componentType], [rows, cols] = shapes[a.type];
  const size = rows*cols, colStride = cols > 1 ? Math.ceil(rows*width/4)*4 : rows*width;
  fail(Number.isInteger(a.count) && a.count > 0 && a.count*size <= 2000000, 'accessor scalar cap');
  totalScalars += a.count*size; fail(totalScalars <= 16000000, 'total scalar cap');
  const offsets = Array.from({length:size}, (_, c) => Math.floor(c/rows)*colStride+(c%rows)*width);
  const raw = Array.from({length:a.count}, () => new Array(size).fill(0));
  const readRows = (vi, offset, count, stride, componentGetter = getter, componentWidth = width, components = offsets) => {
    const bv = doc.bufferViews[vi]; fail(bv && bv.buffer === 0, 'original view reference');
    fail(offset >= 0 && offset+(count-1)*stride+Math.max(...components)+componentWidth <= bv.byteLength, 'original accessor extent');
    return Array.from({length:count}, (_, k) => components.map(c => view[componentGetter]((bv.byteOffset??0)+offset+k*stride+c, true)));
  };
  if (a.bufferView !== undefined) {
    const bv = doc.bufferViews[a.bufferView];
    const base = readRows(a.bufferView, a.byteOffset??0, a.count, bv.byteStride??colStride*cols);
    for (let i=0; i<a.count; i++) raw[i] = base[i];
  }
  let sparse = null;
  if (a.sparse) {
    const s = a.sparse, it = types[s.indices.componentType];
    fail([5121,5123,5125].includes(s.indices.componentType) && s.count <= a.count, 'sparse original indices');
    const ids = readRows(s.indices.bufferView, s.indices.byteOffset??0, s.count, it[1], it[2], it[1], [0]).map(x=>x[0]);
    const vals = readRows(s.values.bufferView, s.values.byteOffset??0, s.count, colStride*cols);
    ids.forEach((id,k) => { fail(id < a.count && (k === 0 || ids[k-1] < id), 'sparse ordered range'); raw[id] = vals[k]; });
    sparse = {indices: ids, values: vals, source: s};
  }
  fail(raw.flat().every(Number.isFinite), 'finite original accessor');
  const decoded = raw.map(row => row.map(v => a.normalized ? normalized(v,a.componentType) : v));
  return {source:a, raw, decoded, sparse, size, Typed};
});

function json(name) {
  const b = fs.readFileSync(path.join(out,name)); fail(b.length <= jsonCap, 'JSON input cap '+name);
  return JSON.parse(b.toString('utf8'));
}
const packet = json('accessors.json'), ownership = json('ownership.json'), expected = json('world.json');
fail(fs.readFileSync(path.join(out,'source.glb')).equals(original), 'complete editable source equality');
fail(fs.readFileSync(path.join(out,'source.json')).equals(rawJson), 'raw original JSON equality');
// Python preserves insertion order. Definitions originate in the same original
// JSON; structural recursion below avoids depending on object property order.
function same(a,b,w) {
  if (a === null || b === null || typeof a !== 'object' || typeof b !== 'object') {
    fail(Object.is(a,b), w); return;
  }
  fail(Array.isArray(a) === Array.isArray(b), w+' array kind');
  const ka = Object.keys(a), kb = Object.keys(b);
  fail(ka.length === kb.length && ka.every(k=>Object.hasOwn(b,k)), w+' keys');
  ka.forEach(k=>same(a[k],b[k],w+'.'+k));
}
fail(packet.length === accessors.length, 'all original accessor count');
let checkedRaw = 0, checkedDecoded = 0;
accessors.forEach((a,i) => {
  same(packet[i].source,a.source,'original accessor definition'+i);
  same(packet[i].raw,a.raw,'every original raw component'+i);
  same(packet[i].decoded,a.decoded,'every normalized component'+i);
  same(packet[i].sparse,a.sparse,'original sparse overlays'+i);
  fail(packet[i].index === i && packet[i].count === a.source.count && packet[i].itemSize === a.size, 'accessor identity/count');
  checkedRaw += a.source.count*a.size; checkedDecoded += a.source.count*a.size;
});
same(ownership.chunks,chunks,'complete original chunks');
for (const name of ['buffers','bufferViews','accessors','scenes','nodes','meshes','skins','materials','images','textures','samplers','animations','cameras']) {
  same(ownership.allDefinitions[name],doc[name]??[], 'all original '+name+' definitions');
}

const attrs = {POSITION:'position', NORMAL:'normal', TANGENT:'tangent', TEXCOORD_0:'uv', TEXCOORD_1:'uv1', TEXCOORD_2:'uv2', TEXCOORD_3:'uv3', COLOR_0:'color', JOINTS_0:'skinIndex', WEIGHTS_0:'skinWeight'};
function attribute(ai) {
  const a=accessors[ai]; fail(a, 'attribute accessor');
  return new BufferAttribute(new a.Typed(a.raw.flat()),a.size,a.source.normalized===true);
}
const jointIds = new Set((doc.skins??[]).flatMap(s=>s.joints));
const nodes = (doc.nodes??[]).map((n,i)=> {
  const obj = jointIds.has(i) ? new Bone() : new Object3D();
  if (n.matrix) obj.applyMatrix4(new Matrix4().fromArray(n.matrix));
  else {
    obj.position.fromArray(n.translation??[0,0,0]);
    obj.quaternion.fromArray(n.rotation??[0,0,0,1]);
    obj.scale.fromArray(n.scale??[1,1,1]);
  }
  obj.userData.originalNode=i;
  return obj;
});
const parents = new Array(nodes.length).fill(null);
(doc.nodes??[]).forEach((n,i) => (n.children??[]).forEach(c=>{
  fail(Number.isInteger(c) && nodes[c] && parents[c] === null && c!==i,'forest child');
  parents[c]=i; nodes[i].add(nodes[c]);
}));
const sceneRoot = new Object3D();
nodes.forEach((n,i)=> { if (parents[i] === null) sceneRoot.add(n); });
sceneRoot.updateMatrixWorld(true);
fail(expected.localMatrices.length === nodes.length && expected.worldMatrices.length === nodes.length, 'all original matrix counts');
const maxMatrix={value:0,node:null,kind:null,component:null};
function matrixCompare(actual,wanted,node,kind) {
  fail(Array.isArray(wanted) && wanted.length===16,'matrix extent');
  for(let c=0;c<16;c++) {
    fail(Number.isFinite(actual[c]) && Number.isFinite(wanted[c]), 'finite matrix');
    const e=Math.abs(actual[c]-wanted[c]);
    if(e>maxMatrix.value) Object.assign(maxMatrix,{value:e,node,kind,component:c});
    fail(e<=tolerance,`matrix criterion node${node}/${kind}/${c}/${e}`);
  }
}
nodes.forEach((n,i)=> { matrixCompare(n.matrix.elements,expected.localMatrices[i],i,'local'); matrixCompare(n.matrixWorld.elements,expected.worldMatrices[i],i,'world'); });
same(ownership.parents,parents,'original parent identity');
const invBinds=(doc.skins??[]).map(s => s.joints.map((_,j)=>new Matrix4().fromArray(s.inverseBindMatrices===undefined ? [1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1] : accessors[s.inverseBindMatrices].raw[j])));
invBinds.forEach((mats,si)=>mats.forEach((m,j)=>same(m.elements,expected.inverseBinds[si][j], 'all original inverse bind'+si+'/'+j)));
const byKey=new Map(expected.instances.map(x=>[`${x.node}/${x.mesh}/${x.primitive}`,x]));
fail(byKey.size===expected.instances.length,'duplicate expected instance');
const results=[], maxPosition={value:0,node:null,mesh:null,primitive:null,vertex:null,axis:null};
const maxIdealShaderLedgerError={value:0,node:null,mesh:null,primitive:null,vertex:null,axis:null};
let countPoints=0, countWeights=0;
(doc.nodes??[]).forEach((n,ni)=> {
  if(n.mesh===undefined) return;
  const def=doc.meshes[n.mesh]; fail(def && Array.isArray(def.primitives),'original mesh reference');
  def.primitives.forEach((p,pi)=> {
    const key=`${ni}/${n.mesh}/${pi}`, wanted=byKey.get(key); fail(wanted,'missing original instance '+key);
    const geom=new BufferGeometry();
    for(const [semantic,ai] of Object.entries(p.attributes)) if(attrs[semantic]) geom.setAttribute(attrs[semantic],attribute(ai));
    for(const [sem,kind] of [['POSITION','position'],['NORMAL','normal'],['COLOR_0','color']]) {
      if((p.targets??[]).some(t=>t[sem]!==undefined)) {
        geom.morphAttributes[kind]=(p.targets??[]).map(t=>t[sem]===undefined ? geom.attributes[kind] : attribute(t[sem]));
      }
    }
    geom.morphTargetsRelative=true;
    const mode=p.mode??4;
    let mesh;
    if([4,5,6].includes(mode)) mesh=n.skin===undefined ? new Mesh(geom) : new SkinnedMesh(geom);
    else mesh=new ({0:Points,1:LineSegments,2:LineLoop,3:Line})[mode](geom);
    // A clone of one source primitive receives the same one-normalization
    // result. Conflicting original creation/attribute aliases are refused by
    // the producer and independently checked by the coverage checker.
    if(mesh.isSkinnedMesh) {
      mesh.normalizeSkinWeights();
      const skin=doc.skins[n.skin]; fail(skin,'skin original identity');
      const skeleton=new Skeleton(skin.joints.map(j=>nodes[j]),invBinds[n.skin]);
      mesh.bind(skeleton,new Matrix4());
    }
    if(mesh.morphTargetInfluences) mesh.morphTargetInfluences.fill(0);
    nodes[ni].add(mesh);
    sceneRoot.updateMatrixWorld(true);
    fail(mesh.type===wanted.class, 'actual installed class '+key);
    const pos=geom.attributes.position;
    fail(pos.count<=1000000 && wanted.positionAccessor===p.attributes.POSITION && wanted.points.length===pos.count,'full original position coverage');
    fail(wanted.selectedMorphWeights.length===(p.targets??[]).length && wanted.selectedMorphWeights.every(w=>w===0),'selected zero morphs');
    same(wanted.sourceDefaultMorphWeights,n.weights??def.weights??new Array((p.targets??[]).length).fill(0),'original weight precedence');
    const vertex=new Vector3(); let localMaximum=0;
    for(let vi=0;vi<pos.count;vi++) {
      if(mesh.isMesh) mesh.getVertexPosition(vi,vertex); else vertex.fromBufferAttribute(pos,vi);
      vertex.applyMatrix4(mesh.matrixWorld);
      const actual=vertex.toArray(), want=wanted.points[vi]; fail(want?.length===3,'point extent');
      for(let axis=0;axis<3;axis++) {
        fail(Number.isFinite(actual[axis]) && Number.isFinite(want[axis]),'finite point');
        const e=Math.abs(actual[axis]-want[axis]); localMaximum=Math.max(localMaximum,e);
        if(e>maxPosition.value) Object.assign(maxPosition,{value:e,node:ni,mesh:n.mesh,primitive:pi,vertex:vi,axis});
        fail(e<=tolerance,`point criterion ${key}/${vi}/${axis}/${e}`);
      }
      if(mesh.isSkinnedMesh) {
        const w=geom.attributes.skinWeight, wantw=wanted.effectiveWeights[vi];
        fail(wantw?.length===4,'effective weight extent');
        for(let c=0;c<4;c++) { fail(Object.is(w.getComponent(vi,c),wantw[c]),`exact installed typed weight ${key}/${vi}/${c}`); countWeights++; }
      }
      let ideal=actual;
      if(mesh.isSkinnedMesh) {
        const sum=new Vector4(0,0,0,0), base=new Vector4(pos.getX(vi),pos.getY(vi),pos.getZ(vi),1).applyMatrix4(mesh.bindMatrix);
        const skin=doc.skins[n.skin], weights=geom.attributes.skinWeight, joints=geom.attributes.skinIndex;
        for(let c=0;c<4;c++) {
          const weight=weights.getComponent(vi,c), ji=joints.getComponent(vi,c);
          if(weight!==0) {
            const boneMatrix=new Matrix4().multiplyMatrices(nodes[skin.joints[ji]].matrixWorld,invBinds[n.skin][ji]);
            sum.addScaledVector(base.clone().applyMatrix4(boneMatrix),weight);
          }
        }
        sum.applyMatrix4(mesh.bindMatrixInverse);
        ideal=new Vector3(sum.x,sum.y,sum.z).applyMatrix4(mesh.matrixWorld).toArray();
      }
      fail(wanted.idealShaderPoints[vi]?.length===3,'ideal shader ledger extent');
      for(let axis=0;axis<3;axis++) {
        const error=Math.abs(ideal[axis]-wanted.idealShaderPoints[vi][axis]);
        fail(Number.isFinite(error) && error<=tolerance,'ideal source shader equation ledger criterion');
        if(error>maxIdealShaderLedgerError.value) Object.assign(maxIdealShaderLedgerError,{value:error,node:ni,mesh:n.mesh,primitive:pi,vertex:vi,axis});
      }
      countPoints++; fail(countPoints<=4000000,'total point cap');
    }
    results.push({node:ni,mesh:n.mesh,primitive:pi,class:mesh.type,points:pos.count,maxAbsoluteError:localMaximum});
    byKey.delete(key);
  });
});
fail(byKey.size===0 && countPoints===expected.totalPoints,'no extra/omitted source instances');
fail(warnings.length===0,'installed source warnings '+JSON.stringify(warnings));
const report={verdict:'A complete original-value/instance installed CPU comparison only',source:{bytes:original.length,sha256:sha(original)},
  accessorCount:accessors.length,checkedRawScalars:checkedRaw,checkedDecodedScalars:checkedDecoded,nodeMatrices:nodes.length,
  checkedPoints:countPoints,checkedIdealShaderLedgerPoints:countPoints,checkedEffectiveWeightComponents:countWeights,instances:results,maxMatrix,maxPosition,maxIdealShaderLedgerError,tolerance,warnings,
  scope:'original independently decoded and installed CPU evaluated; no GLTFLoader/image/pixel/renderer/GPU/rig/anatomy/appearance/motion proof'};
const reportBytes=Buffer.from(JSON.stringify(report)+'\n'); fail(reportBytes.length<=jsonCap,'oracle JSON cap');
let aggregate=reportBytes.length;
for(const name of fs.readdirSync(out)) { const p=path.join(out,name); fail(fs.statSync(p).isFile(),'output file only'); aggregate+=fs.statSync(p).size; }
fail(aggregate<=totalCap,'aggregate output cap');
fail(!fs.existsSync(path.join(out,'oracle.json')),'one new oracle output');
fs.writeFileSync(path.join(out,'oracle.json'),reportBytes,{flag:'wx'});
process.stdout.write(JSON.stringify({oracle:'complete original CPU comparison',points:countPoints,maxPosition:maxPosition.value,maxMatrix:maxMatrix.value})+'\n');
