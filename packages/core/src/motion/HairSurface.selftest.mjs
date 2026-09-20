/** CPU geometry, topology and lifetime gate. No browser/capture directory required.
 * node packages/core/src/motion/HairSurface.selftest.mjs
 * Goldens retain independent frozen-v2 output plus two actual posed-body patches.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { gunzipSync } from 'node:zlib';
import { Bone, BufferAttribute, BufferGeometry, Matrix4, Skeleton, SkinnedMesh, Vector3, Vector4, Matrix3 } from 'three';
import * as runtime from './HairSurface.js';
import { readGlb, readPrimitive } from '../../../../tools/lut-bake/glb.mjs';

const directory = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(directory, '../../../..');
const results = [], metrics = {};
const sha = value => createHash('sha256').update(value).digest('hex');
const fixtureBytes=fs.readFileSync(new URL('./fixtures/hair-surface-v1.json.gz',import.meta.url));
assert.equal(sha(fixtureBytes),'59065083b8a547d6f0e93bd9eec2020087e1389e08eb5511e16ca5da7d3dd578');
const golden=JSON.parse(gunzipSync(fixtureBytes));
function test(name, run) { run(); results.push(name); console.log('PASS ' + name); }
const triangle = { bodyIndices: [0,1,2], sourceTriangleIds: [0],
    sourcePositions: [0,0,0,1,0,0,0,1,0], sourceNormals: [0,0,1,0,0,1,0,0,1] };
const fan = { bodyIndices: [0,2,3,0,1,2,0,3,4], sourceTriangleIds: [0,1,2],
    sourcePositions: [0,0,0,1,0,0,1,1,0,-1,1,0,-1,0,0],
    sourceNormals: Array.from({length:5}, () => [0,0,1]).flat(), leafSize: 1 };
const near = (a,b,epsilon=1e-12) => assert.ok(Math.abs(a-b)<=epsilon, `${a} vs ${b}`);
function hitsEqual(a,b,epsilon=1e-12) {
    assert.equal(Boolean(a),Boolean(b)); if(!a) return;
    for(let k=0;k<3;k++) { near(a.closest[k],b.closest[k],epsilon); near(a.barycentric[k],b.barycentric[k],epsilon); near(a.interpolatedNormal[k],b.interpolatedNormal[k],epsilon); }
    near(a.distance,b.distance,epsilon); near(a.signedDistance,b.signedDistance,epsilon);
    assert.equal(a.sourceBodyTriangle,b.sourceBodyTriangle);
    assert.equal(a.closestOnOpenBoundary,b.closestOnOpenBoundary);
}
function state(p) {
    const h=runtime.motionBuffers(p);
    return {geometry:runtime.serializePatch(p),history:Object.fromEntries(Object.entries(h).map(([k,v])=>[k,ArrayBuffer.isView(v)?Array.from(v):v]))};
}

test('self-contained closest math preserves frozen v2 interior, edge, vertex, degenerate and fan ties', () => {
    for(const {input,queries,hits} of golden.synthetic) {
        const p=runtime.createPatch(input);
        for(let i=0;i<queries.length;i++) hitsEqual(runtime.nearest(p,queries[i]),hits[i]);
    }
    const p=runtime.createPatch(fan),hit=runtime.nearest(p,[0,-1,1]);
    assert.equal(hit.sourceBodyTriangle,0);assert.equal(hit.closestOnOpenBoundary,true);
    assert.equal(runtime.nearest(p,[.5,.5,1]).closestOnOpenBoundary,false);
});

test('construction, malformed queries and packed hydration fail closed; stale bounds are rebuilt', () => {
    for(const changes of [{sourcePositions:[]},{sourceTriangleIds:[]},{sourceTriangleIds:[0,0]},
        {bodyIndices:[-1,1,2]},{bodyIndices:[0,1,3]},{sourcePositions:[NaN,...triangle.sourcePositions.slice(1)]},
        {sourceNormals:[Infinity,...triangle.sourceNormals.slice(1)]},{leafSize:0}]) {
        assert.throws(()=>runtime.createPatch({...triangle,...changes}));
    }
    const p=runtime.createPatch(triangle),serialized=runtime.serializePatch(p);
    for(const changes of [{triangles:[NaN,1,2,0]},{meta:[0,0,1,0]},{boundaryMasks:[0]}]) {
        assert.throws(()=>runtime.hydratePatch({...serialized,...changes}));
    }
    const restored=runtime.hydratePatch({...serialized,boundsMin:[100,100,100,0],boundsMax:[101,101,101,0]});
    near(runtime.nearest(restored,[.25,.25,1],{maxDistance:2}).distance,1);
    for(const q of [[NaN,0,0],[0,0],[0,0,1e100]]) assert.throws(()=>runtime.nearest(p,q));
    for(const maxDistance of [-1,NaN]) assert.throws(()=>runtime.nearest(p,[0,0,0],{maxDistance}));
});

test('current segment crossings and miss/maximum-distance results preserve frozen v2', () => {
    const p=runtime.createPatch(fan);
    for(const {a,b,result} of golden.segmentCases) assert.deepEqual(runtime.segmentIntersection(p,a,b),result);
    assert.equal(runtime.nearest(p,[0,0,10],{maxDistance:1}),null);
});

test('explicit snapshots preserve stable buffers and interpolate a moving triangle at the midpoint', () => {
    const p=runtime.createPatch(triangle),initial=runtime.motionBuffers(p);
    assert.equal(initial.historyValid,false); assert.throws(()=>runtime.nearestAt(p,[.2,.2,0],.5));
    runtime.snapshotPreviousPose(p);
    const next=triangle.sourcePositions.map((x,i)=>x+(i%3===2?2:0));
    const nextNormals=[0,1,0,0,1,0,0,1,0];
    runtime.updateFromCaptured(p,next,nextNormals);
    const buffers=runtime.motionBuffers(p);
    for(const field of ['previousPositions','previousNormals','currentPositions','currentNormals','unionBoundsMin','unionBoundsMax']) assert.equal(buffers[field],initial[field]);
    assert.equal(buffers.historyValid,true);
    const hit=runtime.nearestAt(p,[.2,.2,1.25],.5);
    near(hit.closest[2],1); near(hit.distance,.25); near(hit.interpolatedNormal[1],Math.SQRT1_2); near(hit.interpolatedNormal[2],Math.SQRT1_2);
    near(runtime.nearestAt(p,[.2,.2,1.25],0).closest[2],0);
    near(runtime.nearestAt(p,[.2,.2,1.25],1).closest[2],2);
    const preserved=Array.from(buffers.previousPositions);
    runtime.updateFromCaptured(p,triangle.sourcePositions.map((x,i)=>x+(i%3===2?3:0)),nextNormals);
    assert.deepEqual(Array.from(buffers.previousPositions),preserved); // update never snapshots implicitly
    assert.equal(buffers.unionBoundsMax[2],3);
});

test('union BVH covers every intermediate triangle and matches brute nearest across topology motion', () => {
    const p=runtime.createPatch(fan);runtime.snapshotPreviousPose(p);
    const next=fan.sourcePositions.map((x,i)=>x+Math.sin(i*1.7)*1.3);
    runtime.updateFromCaptured(p,next,fan.sourceNormals);
    const h=runtime.motionBuffers(p);
    for(const alpha of [0,.125,.5,.875,1]) {
        // Every descendant vertex lies in every ancestor's endpoint-union bounds.
        for(let node=0;node<p.meta.length/4;node++) {
            for(let leaf=node;leaf<p.meta[node*4];leaf++) {
                const first=p.meta[leaf*4+1],count=p.meta[leaf*4+2];
                for(let t=first;t<first+count;t++) for(let c=0;c<3;c++) for(let k=0;k<3;k++) {
                    const vi=p.triangles[t*4+c]*4+k;
                    const x=h.previousPositions[vi]+(p.positions[vi]-h.previousPositions[vi])*alpha;
                    assert.ok(x>=h.unionBoundsMin[node*4+k] && x<=h.unionBoundsMax[node*4+k]);
                }
            }
        }
        for(let i=0;i<100;i++) {
            const q=[Math.sin(i*4)*2,Math.cos(i*7)*2,Math.sin(i*9)];
            hitsEqual(runtime.nearestAt(p,q,alpha),runtime.nearestAt(p,q,alpha,{bruteForce:true}));
        }
    }
});

test('reset collapses history, serialization discards it, and invalid alpha fails closed', () => {
    const p=runtime.createPatch(triangle);runtime.snapshotPreviousPose(p);
    runtime.updateFromCaptured(p,triangle.sourcePositions.map((v,i)=>v+(i%3===2?2:0)),triangle.sourceNormals);
    runtime.resetHistory(p);const h=runtime.motionBuffers(p);
    assert.equal(h.historyValid,false);assert.deepEqual(h.previousPositions,p.positions);assert.deepEqual(h.unionBoundsMin,p.boundsMin);assert.deepEqual(h.unionBoundsMax,p.boundsMax);
    assert.throws(()=>runtime.nearestAt(p,[0,0,0],0));assert.equal(runtime.nearestAt(p,[0,0,0],1).distance,2);
    for(const alpha of [-.01,1.01,NaN,Infinity]) assert.throws(()=>runtime.nearestAt(p,[0,0,0],alpha));
    runtime.snapshotPreviousPose(p);const restored=runtime.hydratePatch(runtime.serializePatch(p));
    assert.equal(runtime.motionBuffers(restored).historyValid,false);
});

test('failed captured updates preserve all valid current/history/bounds data', () => {
    const p=runtime.createPatch(triangle);runtime.snapshotPreviousPose(p);const before=state(p);
    for(const [positions,normals] of [[[],[]],[[NaN,...triangle.sourcePositions.slice(1)],triangle.sourceNormals],
        [triangle.sourcePositions.slice(0,6),triangle.sourceNormals.slice(0,6)]]) {
        assert.throws(()=>runtime.updateFromCaptured(p,positions,normals));assert.deepEqual(state(p),before);
        near(runtime.nearestAt(p,[.2,.2,1],.5).distance,1);
    }
});

function skinnedFixture() {
    const geometry=new BufferGeometry();geometry.setIndex(new BufferAttribute(Uint32Array.from(triangle.bodyIndices),1));geometry.setAttribute('position',new BufferAttribute(Float32Array.from(triangle.sourcePositions),3));
    geometry.setAttribute('normal',new BufferAttribute(Float32Array.from(triangle.sourceNormals),3));
    geometry.setAttribute('skinIndex',new BufferAttribute(Uint16Array.from([0,1,2,3,0,1,2,3,0,1,2,3]),4));
    geometry.setAttribute('skinWeight',new BufferAttribute(Float32Array.from([.1,.2,.3,.4,.4,.3,.2,.1,.25,.25,.25,.25]),4));
    geometry.morphTargetsRelative=true;
    geometry.morphAttributes.position=[new BufferAttribute(Float32Array.from([.2,0,.1,0,.2,.3,.1,0,.2]),3)];
    geometry.morphAttributes.normal=[new BufferAttribute(Float32Array.from([0,.2,-.1,.1,.2,-.1,.2,0,-.1]),3)];
    const mesh=new SkinnedMesh(geometry);const bones=Array.from({length:4},()=>new Bone());
    for(const bone of bones)mesh.add(bone);mesh.updateMatrixWorld(true);mesh.bind(new Skeleton(bones));
    bones[0].rotation.x=.2;bones[1].rotation.y=-.4;bones[2].position.z=.6;bones[3].rotation.z=.3;
    mesh.position.set(.5,-.3,.7);mesh.scale.set(1.1,.9,1.2);mesh.morphTargetInfluences[0]=.35;mesh.updateMatrixWorld(true);
    return mesh;
}
function capturedReference(body) {
    const p=new Vector3(),n=new Vector3(),delta=new Vector3(),normal4=new Vector4(),nm=new Matrix3().getNormalMatrix(body.matrixWorld);
    const positions=[],normals=[],normalAttribute=body.geometry.getAttribute('normal');
    body.skeleton.update();
    for(let v=0;v<3;v++) {
        body.getVertexPosition(v,p).applyMatrix4(body.matrixWorld);positions.push(p.x,p.y,p.z);
        n.fromBufferAttribute(normalAttribute,v).addScaledVector(delta.fromBufferAttribute(body.geometry.morphAttributes.normal[0],v),body.morphTargetInfluences[0]);
        normal4.set(n.x,n.y,n.z,0);body.applyBoneTransform(v,normal4);n.set(normal4.x,normal4.y,normal4.z).applyMatrix3(nm).normalize();normals.push(n.x,n.y,n.z);
    }
    return {positions,normals};
}

test('live updater preserves renderer-equivalent four-weight skinning, morphs and normal transforms', () => {
    const body=skinnedFixture(),expected=capturedReference(body),p=runtime.createPatch(triangle),reference=runtime.createPatch(triangle);
    runtime.updateFromCaptured(reference,expected.positions,expected.normals);
    const update=runtime.makeSkinnedUpdater(body,p);update();
    assert.deepEqual(p.positions,reference.positions);assert.deepEqual(p.normals,reference.normals);
    assert.deepEqual(p.boundsMin,reference.boundsMin);assert.deepEqual(p.boundsMax,reference.boundsMax);
});

test('getter/nonfinite live failures are atomic; deferred refit blocks queries and can recover', () => {
    const body=skinnedFixture(),p=runtime.createPatch(triangle),update=runtime.makeSkinnedUpdater(body,p);
    update();runtime.snapshotPreviousPose(p);const before=state(p),original=body.getVertexPosition;
    body.getVertexPosition=function(v,target){if(v===1)throw Error('injected getter failure');return original.call(this,v,target);};
    assert.throws(()=>update(),/injected/);assert.deepEqual(state(p),before);
    body.getVertexPosition=function(v,target){const result=original.call(this,v,target);if(v===2)target.x=NaN;return result;};
    assert.throws(()=>update(),/finite/);assert.deepEqual(state(p),before);
    body.getVertexPosition=original;body.morphTargetInfluences[0]=NaN;
    assert.throws(()=>update(),/Morph weights/);assert.deepEqual(state(p),before);body.morphTargetInfluences[0]=.35;
    body.skeleton.bones[2].position.z+=.1;body.updateMatrixWorld(true);
    update({refitBounds:false});assert.throws(()=>runtime.nearest(p,[0,0,0]));assert.throws(()=>runtime.motionBuffers(p));
    runtime.refit(p);assert.ok(runtime.nearestAt(p,[0,0,0],.5));
});

test('direct invalid refit fails closed; disposal is final and idempotent', () => {
    const p=runtime.createPatch(triangle);p.positions[0]=NaN;assert.throws(()=>runtime.refit(p));assert.throws(()=>runtime.nearest(p,[0,0,0]));
    p.positions[0]=0;runtime.refit(p);near(runtime.nearest(p,[0,0,1]).distance,1);
    const update=runtime.makeSkinnedUpdater(skinnedFixture(),p);runtime.disposePatch(p);runtime.disposePatch(p);
    for(const operation of [()=>runtime.nearest(p,[0,0,0]),()=>runtime.refit(p),()=>runtime.snapshotPreviousPose(p),
        ()=>runtime.motionBuffers(p),()=>runtime.resetHistory(p),()=>runtime.serializePatch(p),()=>update()]) assert.throws(operation);
});

// Independent matrix-blend oracle: explicitly accumulate all four bone matrices, then apply
// bind/world transforms to a separately constructed morphed point/direction. This does not call
// either native skinning method used by HairSurface.
function blendedReference(body, vertex) {
    const geometry=body.geometry, influences=body.morphTargetInfluences??[];
    const morphValue=name=>{
        const base=new Vector3().fromBufferAttribute(geometry.getAttribute(name),vertex),value=base.clone();
        const morphs=geometry.morphAttributes[name]??[];
        for(let m=0;m<morphs.length;m++) {
            const delta=new Vector3().fromBufferAttribute(morphs[m],vertex);
            if(!geometry.morphTargetsRelative)delta.sub(base);
            value.addScaledVector(delta,influences[m]??0);
        }
        return value;
    };
    const blend=new Matrix4();blend.elements.fill(0);
    const joints=geometry.getAttribute('skinIndex'),weights=geometry.getAttribute('skinWeight');
    for(let c=0;c<4;c++) {
        const joint=joints.getComponent(vertex,c),w=weights.getComponent(vertex,c);
        const bone=new Matrix4().multiplyMatrices(body.skeleton.bones[joint].matrixWorld,body.skeleton.boneInverses[joint]);
        for(let i=0;i<16;i++)blend.elements[i]+=bone.elements[i]*w;
    }
    function transform(value,w){
        const p=new Vector4(value.x,value.y,value.z,w).applyMatrix4(body.bindMatrix);
        p.applyMatrix4(blend);p.w=w;p.applyMatrix4(body.bindMatrixInverse);
        return new Vector3(p.x,p.y,p.z);
    }
    return {position:transform(morphValue('position'),1).applyMatrix4(body.matrixWorld),
        normal:transform(morphValue('normal'),0).applyMatrix3(new Matrix3().getNormalMatrix(body.matrixWorld)).normalize()};
}

test('relative and absolute morphs preserve four unequal weights and nonidentity bind/world transforms', () => {
    for(const relative of [true,false]) {
        const body=skinnedFixture();body.geometry.morphTargetsRelative=relative;
        body.bindMatrix.makeRotationY(.17).setPosition(.13,-.06,.21);
        // Keep the inverse supplied by Three's attached bind mode after its world update.
        const p=runtime.createPatch(triangle),update=runtime.makeSkinnedUpdater(body,p);
        update();let fourthWeightContribution=0;
        for(let v=0;v<3;v++) {
            const expected=blendedReference(body,v);
            for(let k=0;k<3;k++) {near(p.positions[v*4+k],expected.position.getComponent(k),2e-7);near(p.normals[v*4+k],expected.normal.getComponent(k),2e-7);}
            const weights=body.geometry.getAttribute('skinWeight'),w=weights.getW(v);weights.setW(v,0);
            fourthWeightContribution=Math.max(fourthWeightContribution,blendedReference(body,v).position.distanceTo(expected.position));weights.setW(v,w);
        }
        assert.ok(fourthWeightContribution>.01,'fourth influence is observably required');
    }
});

test('canonical full topology survives compacted/replaced render indices without ordinal drift', () => {
    const body=skinnedFixture(),fullIndex=Uint32Array.from([0,2,1,0,1,2,2,0,1]);
    const p=runtime.createPatch({...triangle,bodyIndices:fullIndex,sourceTriangleIds:[1]});
    body.geometry.setIndex(new BufferAttribute(Uint32Array.from([2,0,1]),1));
    assert.throws(()=>runtime.makeSkinnedUpdater(body,p),/canonical full topology/);
    const update=runtime.makeSkinnedUpdater(body,p,{sourceIndex:fullIndex});update();const before=runtime.serializePatch(p);
    body.geometry.setIndex(new BufferAttribute(Uint32Array.from([0,0,0]),1));body.geometry.setDrawRange(0,0);update();
    assert.deepEqual(runtime.serializePatch(p),before);assert.equal(p.triangles[3],1);
    assert.deepEqual(Array.from(fullIndex),[0,2,1,0,1,2,2,0,1]);
    assert.throws(()=>runtime.makeSkinnedUpdater(body,p,{sourceIndex:Uint32Array.from([0,1,2,0,2,1])}),/does not match/);
    const geometry=body.geometry;body.geometry=geometry.clone();assert.throws(()=>update(),/geometry or skeleton changed/);body.geometry=geometry;
});

test('submitted pose, refit and history advance together; failed live/captured updates keep the entire old interval', () => {
    const body=skinnedFixture(),p=runtime.createPatch(triangle),update=runtime.makeSkinnedUpdater(body,p);
    update({reset:true});const initial=state(p),stable=runtime.motionBuffers(p);
    const beforePositions=p.positions.slice(),beforeNormals=p.normals.slice();
    body.skeleton.bones[2].position.z+=.2;body.updateMatrixWorld(true);update({advanceHistory:true});
    const current=runtime.motionBuffers(p);assert.equal(current.historyValid,true);
    assert.deepEqual(current.previousPositions,beforePositions);assert.deepEqual(current.previousNormals,beforeNormals);
    for(const field of ['previousPositions','previousNormals','currentPositions','currentNormals','unionBoundsMin','unionBoundsMax'])assert.equal(current[field],stable[field]);
    const before=state(p),original=body.getVertexPosition;
    body.getVertexPosition=function(v,target){if(v===2)throw Error('late vertex failure');return original.call(this,v,target);};
    for(const options of [{advanceHistory:true},{advanceHistory:true,reset:true},{reset:true}]){
        assert.throws(()=>update(options),/late vertex failure/);assert.deepEqual(state(p),before);
    }
    body.getVertexPosition=original;
    assert.throws(()=>runtime.updateFromCaptured(p,[NaN,...triangle.sourcePositions.slice(1)],triangle.sourceNormals,{advanceHistory:true}),/finite/);
    assert.deepEqual(state(p),before);
    assert.throws(()=>update({advanceHistory:true,refitBounds:false}),/requires refitBounds/);assert.deepEqual(state(p),before);
    update({advanceHistory:true,reset:true});const reset=runtime.motionBuffers(p);
    assert.equal(reset.historyValid,false);assert.deepEqual(reset.previousPositions,p.positions);assert.deepEqual(reset.previousNormals,p.normals);
    assert.deepEqual(reset.unionBoundsMin,p.boundsMin);assert.deepEqual(reset.unionBoundsMax,p.boundsMax);
    assert.throws(()=>runtime.nearestAt(p,[0,0,0],.5),/No valid previous/);
    assert.notDeepEqual(state(p).geometry,initial.geometry);
    const a=runtime.createPatch(triangle),b=runtime.createPatch(triangle);
    runtime.snapshotPreviousPose(a);const shifted=triangle.sourcePositions.map((v,i)=>v+(i%3===2?1:0));
    runtime.updateFromCaptured(a,shifted,triangle.sourceNormals);
    runtime.updateFromCaptured(b,shifted,triangle.sourceNormals,{advanceHistory:true});assert.deepEqual(state(a),state(b));
});

test('disposal during a body getter cannot publish staged positions or recreate usable history', () => {
    const body=skinnedFixture(),p=runtime.createPatch(triangle),update=runtime.makeSkinnedUpdater(body,p);
    update({reset:true});const arrays={positions:p.positions.slice(),normals:p.normals.slice(),min:p.boundsMin.slice(),max:p.boundsMax.slice()};
    const original=body.getVertexPosition;body.getVertexPosition=function(v,target){const result=original.call(this,v,target);target.x+=.2;if(v===1)runtime.disposePatch(p);return result;};
    assert.throws(()=>update({advanceHistory:true}),/live patch/);
    assert.deepEqual(p.positions,arrays.positions);assert.deepEqual(p.normals,arrays.normals);assert.deepEqual(p.boundsMin,arrays.min);assert.deepEqual(p.boundsMax,arrays.max);
    for(const operation of [()=>update(),()=>runtime.motionBuffers(p),()=>runtime.resetHistory(p),()=>runtime.refit(p)])assert.throws(operation,/live patch/);
    runtime.disposePatch(p);
});

test('invalid selected skin attributes reject without changing pose or history', () => {
    const body=skinnedFixture(),p=runtime.createPatch(triangle),update=runtime.makeSkinnedUpdater(body,p);update({reset:true});const before=state(p);
    const joints=body.geometry.getAttribute('skinIndex'),weights=body.geometry.getAttribute('skinWeight');
    const first=joints.getX(0);joints.setX(0,99);assert.throws(()=>update({advanceHistory:true}),/skin joint/);assert.deepEqual(state(p),before);joints.setX(0,first);
    const weight=weights.getW(2);weights.setW(2,NaN);assert.throws(()=>update({advanceHistory:true}),/skin joint or weight/);assert.deepEqual(state(p),before);weights.setW(2,weight);
    body.geometry.deleteAttribute('skinWeight');assert.throws(()=>update(),/Four-weight/);assert.deepEqual(state(p),before);body.geometry.setAttribute('skinWeight',weights);
});

test('all five calibrated patches match frozen packed topology and exact static queries', () => {
    const calibrationBytes=fs.readFileSync(path.join(root,'tools/critic/fixtures/portrait-anatomy-v1.json'));
    assert.equal(sha(calibrationBytes),golden.provenance.calibrationSha256);
    const calibration=JSON.parse(calibrationBytes);metrics.bakes=[];
    for(const expected of golden.bakes) {
        const record=calibration.bakes.find(b=>b.bake===expected.bake);
        const file=path.join(root,'assets/figures/figure_'+record.bake+'.glb'),bytes=fs.readFileSync(file);
        assert.equal(sha(bytes),expected.bodySha256);
        const body=readPrimitive(readGlb(file),'base.001');
        const p=runtime.createPatch({bodyIndices:body.indices,sourceTriangleIds:record.neckPatchTriangleIds,sourcePositions:body.positions,sourceNormals:body.normals});
        for(const [field,hash] of Object.entries(expected.packedHashes)) assert.equal(sha(Buffer.from(p[field].buffer)),hash,record.bake+' '+field);
        for(let i=0;i<expected.queries.length;i++) hitsEqual(runtime.nearest(p,expected.queries[i]),expected.hits[i]);
        assert.equal(runtime.byteSizes(p).total,125028);const h=runtime.motionBuffers(p);
        metrics.bakes.push({bake:record.bake,bodySha256:sha(bytes),vertices:p.sourceVertexIds.length,triangles:p.triangles.length/4,nodes:p.meta.length/4,packedBytes:runtime.byteSizes(p).total,historyBytes:h.previousPositions.byteLength+h.previousNormals.byteLength+h.unionBoundsMin.byteLength+h.unionBoundsMax.byteLength});
    }
});

test('captured pose endpoints and animated midpoint preserve independently frozen results', () => {
    const {frames,queries,midpointHits}=golden.captured,raw=frames.map(f=>f.patch);
    assert.deepEqual(raw[0].triangles,raw[1].triangles);
    const p=runtime.hydratePatch(raw[0]);runtime.snapshotPreviousPose(p);
    const count=Math.max(...p.sourceVertexIds)+1,positions=new Float32Array(count*3),normals=new Float32Array(count*3);
    for(let i=0;i<p.sourceVertexIds.length;i++)for(let k=0;k<3;k++){positions[p.sourceVertexIds[i]*3+k]=raw[1].positions[i*4+k];normals[p.sourceVertexIds[i]*3+k]=raw[1].normals[i*4+k];}
    runtime.updateFromCaptured(p,positions,normals);
    let maxMidpointDistanceError=0,maxMidpointClosestError=0;
    for(let i=0;i<queries.length;i++) {
        const q=queries[i];hitsEqual(runtime.nearestAt(p,q,0),frames[0].hits[i]);hitsEqual(runtime.nearestAt(p,q,1),frames[1].hits[i]);
        const actual=runtime.nearestAt(p,q,.5),expected=midpointHits[i];
        maxMidpointDistanceError=Math.max(maxMidpointDistanceError,Math.abs(actual.distance-expected.distance));
        maxMidpointClosestError=Math.max(maxMidpointClosestError,Math.hypot(...actual.closest.map((v,k)=>v-expected.closest[k])));
        near(actual.distance,expected.distance,3e-7);hitsEqual(actual,runtime.nearestAt(p,q,.5,{bruteForce:true}));
    }
    metrics.capturedInterval={frames:['0000','0420'],queries:queries.length,maxMidpointDistanceError,maxMidpointClosestError,limitation:'Materialized midpoint rounds to Float32; nearestAt interpolates endpoint Float32 values in JS double.'};
});

const report={tests:results,metrics,fixtureSha256:sha(fixtureBytes),limits:['CPU correctness/lifecycle; no GPU execution or timing claim.','Union bounds cover linear vertex interpolation, not nonlinear skeletal motion or continuous collision detection.','Open-patch normal sign is not a closed-body inside test.']};
if(process.env.HAIR_SURFACE_REPORT)fs.writeFileSync(process.env.HAIR_SURFACE_REPORT,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({tests:results.length,metrics},null,2));
