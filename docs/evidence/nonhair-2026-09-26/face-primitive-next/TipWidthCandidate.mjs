// Offline, source-pinned diagnostic. No file writes, scene objects or public Avatar API.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readAccessor} from '../../../../tools/lut-bake/glb.mjs';
import {IdentityCatalogue} from '../../../../packages/core/src/figure/IdentityCatalogue.js';
import {IdentityTargets,AXIS_GLTF} from '../../../../packages/core/src/figure/IdentityTargets.js';
import {transportLocalNormals,checkLocalSelfIntersection} from './local-normal.mjs';
export const SOURCE_PINS=Object.freeze({
    bodyBytes:'fc4445c95ed3f423734ff272ee78ebb44d762a8f16edb94b26039de7a8a96b3a',
    mapBytes:'f6ce5044e74a31094f11642f822df6ebdb2efb37c730a8765a60e67b346e01ff',
    catalogueBytes:'b8ac339c591a52cd454eb3dc82c564a1798714e34ca4c1e714fec40d36d3a176',
    noseBytes:'172dc716c51be189045f1de6209cf655dd01fe9eafae031fd4232dde7c94ca17'
});
export const TARGET_ID='nose/nose-point-width-decr-incr';
export const sha=b=>createHash('sha256').update(b).digest('hex');
function bytes(value) {assert.ok(value instanceof Uint8Array,'Expected byte array');return Buffer.from(value);}
export function inspectPatchLayout(input) {
    const b=bytes(input);assert.ok(b.length>=28);assert.equal(b.readUInt32LE(0),0x46546c67);assert.equal(b.readUInt32LE(4),2);assert.equal(b.readUInt32LE(8),b.length,'GLB length');
    const j=b.readUInt32LE(12);assert.equal(b.readUInt32LE(16),0x4e4f534a);assert.ok(20+j+8<=b.length);assert.equal(b.readUInt32LE(24+j),0x004e4942);
    const offset=28+j,binLength=b.readUInt32LE(20+j);assert.equal(offset+binLength,b.length,'Unexpected GLB chunks');
    const json=JSON.parse(b.subarray(20,20+j).toString('utf8'));assert.equal(json.buffers.length,1);assert.ok(!json.buffers[0].uri);assert.ok(json.buffers[0].byteLength<=binLength);
    const mesh=json.meshes.find(m=>m.name==='base.001');assert.ok(mesh);assert.equal(mesh.primitives.length,1);const primitive=mesh.primitives[0];
    assert.equal(primitive.mode??4,4);assert.equal(primitive.attributes.TANGENT,undefined,'Tangent ownership is unsupported; do not preserve stale tangents');
    assert.ok(!primitive.extensions,'Unsupported primitive extension');
    const locations={};
    for(const name of ['POSITION','NORMAL']) {
        const i=primitive.attributes[name],a=json.accessors[i];assert.ok(a);assert.equal(a.type,'VEC3');assert.equal(a.componentType,5126);assert.ok(!a.sparse&&!a.normalized,'Unsupported writable accessor');
        const view=json.bufferViews[a.bufferView];assert.ok(view);assert.equal(view.buffer??0,0);const stride=view.byteStride??12;assert.ok(stride>=12&&stride%4===0);
        const start=offset+(view.byteOffset??0)+(a.byteOffset??0),end=start+(a.count-1)*stride+12;
        assert.ok(a.count>0&&start%4===0&&end<=offset+(view.byteOffset??0)+view.byteLength&&end<=b.length);
        for(let k=0;k<json.accessors.length;k++)if(k!==i) {const other=json.accessors[k];assert.notEqual(other.bufferView,a.bufferView,'Writable buffer view aliases another accessor');if(other.sparse){assert.notEqual(other.sparse.indices.bufferView,a.bufferView);assert.notEqual(other.sparse.values.bufferView,a.bufferView);}}
        for(let k=0;k<json.bufferViews.length;k++)if(k!==a.bufferView) {const v=json.bufferViews[k],lo=offset+(v.byteOffset??0),hi=lo+v.byteLength;assert.ok(end<=lo||start>=hi,'Writable range aliases another buffer view');}
        locations[name]={accessor:i,start,stride,count:a.count,offsets:Array.from({length:a.count},(_,p)=>[0,1,2].map(c=>start+p*stride+c*4)).flat()};
    }
    assert.equal(locations.POSITION.count,locations.NORMAL.count);
    const glb={json,bin:b.subarray(offset)};
    return {glb,primitive,locations,position:Float32Array.from(readAccessor(glb,primitive.attributes.POSITION).data),normal:Float32Array.from(readAccessor(glb,primitive.attributes.NORMAL).data),indices:Uint32Array.from(readAccessor(glb,primitive.indices).data),tangents:'absent'};
}
const arrayBytes=a=>Buffer.from(a.buffer,a.byteOffset,a.byteLength);
function bounds(p) {return [0,1,2].map(c=>{let lo=Infinity,hi=-Infinity;for(let i=c;i<p.length;i+=3){lo=Math.min(lo,p[i]);hi=Math.max(hi,p[i]);}return [lo,hi]});}
export function verifyAllowedByteChanges(original,candidate,allowedFloatOffsets) {
    assert.equal(original.length,candidate.length,'Changed GLB length');const permitted=new Set(allowedFloatOffsets.flatMap(at=>[at,at+1,at+2,at+3]));let changes=0;
    for(let i=0;i<original.length;i++)if(original[i]!==candidate[i]) {assert.ok(permitted.has(i),`Nonselected byte changed at ${i}`);changes++;}
    return {changedBytes:changes,allowedFloatSlots:allowedFloatOffsets.length,allOtherBytesExact:true};
}
export async function createTipWidthOperator(inputs) {
    assert.deepEqual(Object.keys(inputs).sort(),Object.keys(SOURCE_PINS).sort(),'Unexpected source input keys');
    const source={};for(const [name,pin] of Object.entries(SOURCE_PINS)){source[name]=bytes(inputs[name]);assert.equal(sha(source[name]),pin,`${name} source drift`);}
    const {glb,primitive,locations,position,normal,indices,tangents}=inspectPatchLayout(source.bodyBytes);assert.equal(position.length,14517*3);assert.equal(primitive.targets.length,89);
    assert.equal(source.mapBytes.length,14517*2);const mapping=Uint16Array.from({length:14517},(_,i)=>source.mapBytes.readUInt16LE(i*2));assert.equal(new Set(mapping).size,13380);
    const catalogue=new IdentityCatalogue(JSON.parse(source.catalogueBytes)),targets=new IdentityTargets(catalogue,{baseUrl:'file:///',fetchBytes:async u=>{assert.equal(u,'file:///targets/nose.bin');const b=source.noseBytes;return b.buffer.slice(b.byteOffset,b.byteOffset+b.length)}});
    await targets.loadRegions(['nose']);targets.useVertexMap(mapping);
    const sourceBounds=bounds(position);
    const candidate=weight=>{
        assert.ok([-1,0,1].includes(weight),'Only diagnostic endpoints -1, 0, +1 are admitted');
        if(weight===0)return {bytes:Buffer.from(source.bodyBytes),positions:position.slice(),normals:normal.slice(),receipt:{weight:0,sourcePins:SOURCE_PINS,zeroBypass:true,tangents,byteIdentity:true,geometryGate:'Baseline scoped geometry is checked alongside each nonzero endpoint.'}};
        const p=position.slice(),displacement=new Float64Array(position.length),stack=catalogue.resolve({[TARGET_ID]:weight});targets.apply(displacement,stack,{axis:AXIS_GLTF});
        const stats=targets.apply(p,stack,{axis:AXIS_GLTF});
        for(let i=0;i<p.length;i++)if(displacement[i]===0)assert.ok(Object.is(p[i],position[i]),'Zero-displacement POSITION changed');
        assert.deepEqual(bounds(p),sourceBounds,'Changed global accessor bounds need explicit metadata ownership');
        const transported=transportLocalNormals({positions:position,normals:normal,displaced:p,indices,mapping});
        const baseline=checkLocalSelfIntersection({positions:position,indices,mapping,affectedFaces:transported.affectedFaces});
        const geometry=checkLocalSelfIntersection({positions:p,indices,mapping,affectedFaces:transported.affectedFaces});
        assert.ok(baseline.passed,`Baseline self-intersection: ${JSON.stringify(baseline.witnesses.slice(0,3))}`);
        assert.ok(geometry.passed,`Candidate self-intersection: ${JSON.stringify(geometry.witnesses.slice(0,3))}`);
        const out=Buffer.from(source.bodyBytes),allowed=[];
        for(const [name,array,ids] of [['POSITION',p,transported.changedPositions],['NORMAL',transported.normals,transported.changedNormals]])for(const id of ids)for(let c=0;c<3;c++) {
            const at=locations[name].start+id*locations[name].stride+c*4;out.writeFloatLE(array[3*id+c],at);allowed.push(at);
        }
        const byteGate=verifyAllowedByteChanges(source.bodyBytes,out,allowed);
        const reread=inspectPatchLayout(out);assert.deepEqual(arrayBytes(reread.position),arrayBytes(p));assert.deepEqual(arrayBytes(reread.normal),arrayBytes(transported.normals));
        return {bytes:out,positions:p,normals:transported.normals,receipt:{weight,target:TARGET_ID,sourcePins:SOURCE_PINS,zeroBypass:false,tangents,stats,stack,changedPositionIDs:transported.changedPositions,changedNormalIDs:transported.changedNormals,normalSources:transported.normalSources,affectedFaces:transported.affectedFaces,completeStarFaces:transported.completeStarFaces,faceMetrics:transported.faceMetrics,maxGeometricNormalRotationDegrees:transported.maxRotationDegrees,baselineSelfIntersection:baseline,selfIntersection:geometry,byteGate,geometryBoundsUnchanged:true,candidateSHA256:sha(out),positionsSHA256:sha(arrayBytes(p)),normalsSHA256:sha(arrayBytes(transported.normals))}};
    };
    return Object.freeze({candidate,sourcePins:SOURCE_PINS});
}
