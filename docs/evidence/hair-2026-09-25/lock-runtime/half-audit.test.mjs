import assert from 'node:assert/strict';
import {decodeHalf,auditHalf} from './half-audit.mjs';
for(const [bits,value] of [[0,0],[0x8000,-0],[1,2**-24],[0x3c00,1],[0xbc00,-1],
  [0x7bff,65504],[0x7c00,Infinity],[0xfc00,-Infinity]]) assert.ok(Object.is(decodeHalf(bits),value));
assert.ok(Number.isNaN(decodeHalf(0x7e01)));
// Inject both nonfinite classes inside and outside the ROI so the counter cannot
// silently report a clean finite frame after Uint16Array-to-number conversion.
const input=new Uint16Array([0,0x7c00,0xfc00,0x3c00,0x7e01,0,0,0x3c00,0x3c00,0,0,0x3c00]);
const result=auditHalf(input,3,1,{x0:1,x1:3,y0:0,y1:1});
assert.equal(result.whole.nan,1);assert.equal(result.whole.infinity,2);
assert.equal(result.whole.nonfinitePixels,2);
assert.equal(result.roi.nan,1);assert.equal(result.roi.infinity,0);
assert.equal(result.roi.nonfinitePixels,1);
assert.equal(result.roi.redFinite,1);assert.equal(result.roi.redMean,1);
assert.equal(result.whole.components,12);assert.equal(result.roi.components,8);
assert.throws(()=>auditHalf(new Uint8Array(4),1,1,{x0:0,x1:1,y0:0,y1:1}));
console.log('PASS: binary16 decode sentinels and planted NaN/infinity classification with independent ROI counts.');
