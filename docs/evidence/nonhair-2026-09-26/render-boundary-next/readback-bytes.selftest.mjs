import assert from 'node:assert/strict';
import {packReadback} from './readback-bytes.mjs';
let count=0;
const test=(name,fn)=>{fn();count++;console.log('PASS '+name);};
test('Three short rows retain every logical byte and exclude exactly the documented padding',()=>{
 const raw=new Uint8Array(515).fill(199);raw.set([1,2,3],0);raw.set([4,5,6],256);raw.set([7,8,9],512);
 const p=packReadback(raw,{format:'r8unorm',width:3,height:3});
 assert.deepEqual([...p.pixels],[1,2,3,4,5,6,7,8,9]);assert.equal(p.layout.paddingBytes,506);assert.equal(raw[3],199);
});
test('Aligned rows and a one-row image have no padding',()=>{
 for(const [width,height]of[[64,2],[3,1]]){const a=Uint8Array.from({length:width*height*4},(_,i)=>i%251),p=packReadback(a,{format:'rgba8unorm',width,height});assert.deepEqual(p.pixels,a);assert.equal(p.layout.paddingBytes,0);}
});
test('Half-float values including signed zero, infinities and NaN payload keep exact words',()=>{
 const raw=new Uint16Array(132).fill(0xaaaa);raw.set([0,0x8000,0x7c00,0xfc00],0);raw.set([0x7e01,0x0001,0x3c00,0xffff],128);
 const p=packReadback(raw,{format:'rgba16float',width:1,height:2});assert.deepEqual([...new Uint16Array(p.pixels.buffer)],[0,0x8000,0x7c00,0xfc00,0x7e01,1,0x3c00,0xffff]);
});
test('Readback subview offsets are respected and returned logical storage is owned',()=>{
 const b=Uint8Array.from([77,1,2,3,4,88]),p=packReadback(b.subarray(1,5),{format:'rgba8unorm',width:1,height:1});b[1]=42;assert.deepEqual([...p.pixels],[1,2,3,4]);
});
test('No implicit decoding, coercion, depth, compressed, unknown or prototype format admission',()=>{
 for(const format of['depth32float','bc7-rgba-unorm','rgba32float','__proto__','toString',''])assert.throws(()=>packReadback(new Uint8Array(4),{format,width:1,height:1}));
 assert.throws(()=>packReadback(new Float32Array(4),{format:'rgba16float',width:1,height:1}));
 assert.throws(()=>packReadback(new DataView(new ArrayBuffer(4)),{format:'rgba8unorm',width:1,height:1}));
});
test('Malformed dimensions and unexpected extra or missing bytes fail',()=>{
 for(const [width,height]of[[0,1],[1,-1],[1.5,1],[NaN,1],[Infinity,1],[Number.MAX_SAFE_INTEGER,2]])assert.throws(()=>packReadback(new Uint8Array(4),{format:'rgba8unorm',width,height}));
 for(const size of[3,5,8,256,263])assert.throws(()=>packReadback(new Uint8Array(size),{format:'rgba8unorm',width:1,height:2}));
});
console.log(JSON.stringify({groups:count,passed:true}));
