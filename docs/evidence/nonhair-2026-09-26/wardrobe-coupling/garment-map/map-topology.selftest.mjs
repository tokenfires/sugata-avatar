import assert from 'node:assert/strict';
import {parseOBJ,sourceUV,establishMap,validateMap} from './map-topology.mjs';
const text=`v 0 0 0
v 1 0 0
v 1 1 0
v 0 1 0
vt 0 0
vt 1 0
vt 1 1
vt 0 1
f 1/1 2/2 3/3 4/4
`;
const obj=()=>parseOBJ(text),uv=()=>Float32Array.from(obj().texcoords.flatMap(sourceUV));
let count=0;function test(name,fn){fn();count++;console.log('PASS '+name);}
test('unique source IDs come solely from UV and cover either valid diagonal',()=>{
    for(const tris of [[0,1,2,0,2,3],[0,1,3,1,2,3]]){
        const p=establishMap(obj(),uv(),tris);assert.equal(p.status,'unique');assert.deepEqual(p.map,[0,1,2,3]);assert.deepEqual(p.triangleSourceFace,[0,0]);}
    const changed=parseOBJ(text.replace('v 0 0 0','v 999 999 999'));
    assert.deepEqual(establishMap(changed,uv(),[0,1,2,0,2,3]).map,[0,1,2,3]);
});
test('ambiguous same-UV source IDs remain unresolved without positional guessing',()=>{
    const o=obj();o.texcoords[1]=o.texcoords[0];
    const p=establishMap(o,Float32Array.from(o.texcoords.flatMap(sourceUV)),[0,1,2,0,2,3]);
    assert.equal(p.status,'unresolved');assert.deepEqual(p.unresolved[0].candidateSourceVertices,[0,1]);
});
test('missing UV, malformed indices and reversed winding deny',()=>{
    const missing=uv();missing[0]=.25;assert.equal(establishMap(obj(),missing,[0,1,2,0,2,3]).status,'unresolved');
    for(const tri of [[0,2,1,0,2,3],[0,1,2,0,1,2],[0,1,2,0,2,4],[0,1,2]])assert.throws(()=>establishMap(obj(),uv(),tri));
    assert.throws(()=>parseOBJ(text.replace('f 1/1','f 0/1')));assert.throws(()=>parseOBJ(text.replace('vt 0 0','vt NaN 0')));
});
test('valid but corrupted source-ID permutation is rejected',()=>{
    assert.throws(()=>validateMap([1,0,2,3],obj(),uv(),[0,1,2,0,2,3]));
});
test('equivalent source vt IDs do not invent vertex ambiguity',()=>{
    const o=obj();o.texcoords.push([0,0]);o.faces[0][0].uv=4;
    assert.deepEqual(establishMap(o,uv(),[0,1,2,0,2,3]).map,[0,1,2,3]);
});
console.log(count+' mapping CPU groups passed; no native/refit/fit claim.');
