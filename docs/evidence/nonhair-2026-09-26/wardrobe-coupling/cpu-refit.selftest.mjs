import assert from 'node:assert/strict';
import { parseOBJPositions, reconstructBaseline, mappedResidual, parseMhclo, requiredIndices,
    compactBody, fitMhclo, applyCompactDetails, SCALE } from './cpu-refit.mjs';

const text=`name analytic
x_scale 0 1 2
y_scale 0 1 6
z_scale 0 1 4
verts 0
0 1 2 -0.5 0.25 1.5 0.25 0.75 0.5
delete_verts
0 - 2
`;
const model=()=>parseMhclo(text,{bodyCount:3,garmentCount:1});
const body=()=>({indices:[0,1,2],positions:Float64Array.from([0,0,0,2,4,6,1,2,3])});
const copy=x=>structuredClone(x);
let groups=0;
function test(name,fn){fn();groups++;console.log('PASS '+name);}

test('signed unnormalized weights and MakeHuman offset axis conversion',()=>{
    const m=model();assert.deepEqual(m.rules[0].weights,[-.5,.25,1.5]);
    assert.deepEqual(m.rules[0].offsets,[.25,-.5,.75]);
    assert.deepEqual(Array.from(fitMhclo(m,body()).positions),[2.25,3.5,6.75]);
    const bad=model();bad.rules[0].weights=bad.rules[0].weights.map(x=>Math.max(0,x));
    const moved=body();moved.positions[0]=8;
    assert.notDeepEqual(fitMhclo(m,moved).positions,fitMhclo(bad,moved).positions);
    const normalized=model();normalized.rules[0].weights=normalized.rules[0].weights.map(x=>x/1.25);
    assert.notDeepEqual(fitMhclo(m,body()).positions,fitMhclo(normalized,body()).positions);
});
test('case-dependent x/z/y scales; non-unit sums retain translation effect',()=>{
    const b=body();b.positions=b.positions.map((x,i)=>x*[2,3,4][i%3]);
    const r=fitMhclo(model(),b);assert.deepEqual(r.scale,{x:2,y:4,z:3});
    assert.deepEqual(Array.from(r.positions),[4.5,10.5,27]);
    const moved=body();moved.positions=moved.positions.map(x=>x+8);
    const q=fitMhclo(model(),moved);assert.deepEqual(Array.from(q.positions),[12.25,13.5,16.75]);
});
test('float32 vector storage remains observable and double is labeled reference',()=>{
    const m=model(),b=body();m.rules[0].weights=[.1,.2,.70001];
    const a=fitMhclo(m,b),d=fitMhclo(m,b,{arithmetic:'float64-reference'});
    assert.notDeepEqual(a.positions,d.positions);assert.equal(d.arithmetic,'float64-reference');
    assert.ok([...a.positions].every(x=>Math.fround(x)===x));
    assert.throws(()=>fitMhclo(m,b,{arithmetic:'native'}));
});
test('parser rejects duplicate/invalid scale, malformed rows and unsafe indices',()=>{
    const parse=s=>parseMhclo(s,{bodyCount:3,garmentCount:1});
    for(const s of [text.replace('x_scale 0 1 2','x_scale 0 1 0'),text.replace('x_scale 0 1 2','x_scale 0 1 NaN'),
        text.replace('x_scale 0 1 2','x_scale 0 3 2'),text.replace('0 1 2 -0.5','0 1 3 -0.5'),
        text.replace('0 1 2 -0.5','0 1 2 NaN'),text.replace('0 1 2 -0.5','-1 1 2 -0.5'),
        text.replace('0 1 2 -0.5','0 1 2 -0.5 3'),text.replace('verts 0','x_scale 0 1 2\nverts 0')]) assert.throws(()=>parse(s));
    const direct=parse(text.replace('0 1 2 -0.5 0.25 1.5 0.25 0.75 0.5','2'));
    assert.deepEqual(Array.from(fitMhclo(direct,body()).positions),[1,2,3]);
});
test('missing helpers, repeated mapping, collapsed scale and overflow fail closed',()=>{
    const b=body();b.indices[2]=1;assert.throws(()=>fitMhclo(model(),b));
    assert.throws(()=>fitMhclo(model(),{indices:[0,1],positions:body().positions.slice(0,6)}));
    const c=body();c.positions.fill(0);assert.throws(()=>fitMhclo(model(),c));
    for(const value of [NaN,Infinity,1e100]) {const q=body();q.positions[3]=value;assert.throws(()=>fitMhclo(model(),q));}
    const m=model();m.rules[0].weights[0]=1e100;assert.throws(()=>fitMhclo(m,body()));
});
test('baseline grounding excludes low helpers and operates on evaluated target mix',()=>{
    const obj=Float64Array.from([0,-4,0,2,-2,0,1,-100,0]);
    const source=obj.slice(),target={weight:1,records:[[0,2,2,3]]};
    const a=reconstructBaseline(obj,[target],{bodyCount:2}),b=reconstructBaseline(obj,[],{bodyCount:2});
    assert.deepEqual(obj,source);assert.ok(a.grounding.translationZ<b.grounding.translationZ);
    assert.ok(a.grounding.translationZ<1);assert.ok(a.positions[8]<-9);
    assert.ok(Math.abs(a.positions[0]-2*SCALE)<1e-7);assert.ok(Math.abs(a.positions[1]+3*SCALE)<1e-7);
    assert.throws(()=>reconstructBaseline(obj,[{weight:1,records:[[3,0,0,0]]}],{bodyCount:2}));
    assert.throws(()=>reconstructBaseline(obj,[{weight:1,records:[[0,0,0,0],[0,1,1,1]]}],{bodyCount:2}));
    assert.throws(()=>parseOBJPositions('v 0 NaN 0',1));
});
test('mapped gate keeps exact axes, duplicates and strict original threshold',()=>{
    const b=Float64Array.from([1,2,3]),g=Float64Array.from([1,3,-2,1,3,-2]),map=[0,0];
    assert.equal(mappedResidual(b,g,map).maxMm,0);assert.equal(mappedResidual(b,g,map).uniqueSources,1);
    g[3]+=0.000002;assert.equal(mappedResidual(b,g,map).passed,false);
    const wrong=Float64Array.from([1,2,3,1,2,3]);assert.equal(mappedResidual(b,wrong,map).passed,false);
    assert.throws(()=>mappedResidual(b,g,[0,1]));
});
test('portable dependency target path preserves axes and float32 packed units',()=>{
    const b=body(),source=copy(b),t=[{records:[[2,1,2,3]]}];
    const r=applyCompactDetails(b,t,[.25]);assert.deepEqual(b,source);
    assert.deepEqual(Array.from(r.delta.slice(6)),[Math.fround(SCALE)*.25,-Math.fround(3*SCALE)*.25,Math.fround(2*SCALE)*.25]);
    assert.deepEqual(requiredIndices(model()),[0,1,2]);
    assert.deepEqual(compactBody(b.positions,[2,0]).indices,[2,0]);
    assert.throws(()=>applyCompactDetails({indices:[0,1],positions:b.positions.slice(0,6)},t,[1]));
    assert.throws(()=>applyCompactDetails(b,t,[NaN]));assert.throws(()=>applyCompactDetails(b,t,[2]));
    assert.throws(()=>compactBody(b.positions,[0,0]));
});
test('valid wrong helper mapping and reversed offset are detected by analytic witnesses',()=>{
    const expected=[2.25,3.5,6.75],wrong=model();wrong.rules[0].indices[2]=1;
    assert.notDeepEqual(Array.from(fitMhclo(wrong,body()).positions),expected);
    const axes=model();axes.rules[0].offsets[1]*=-1;
    assert.notDeepEqual(Array.from(fitMhclo(axes,body()).positions),expected);
    const baseline=fitMhclo(model(),body()).positions,corrupt=baseline.slice();corrupt[0]+=.0002;
    assert.ok(Math.hypot(...corrupt.map((x,i)=>x-baseline[i]))*1000>.1);
});
console.log(`${groups} focused CPU groups passed; no native MPFB or fit claim.`);
