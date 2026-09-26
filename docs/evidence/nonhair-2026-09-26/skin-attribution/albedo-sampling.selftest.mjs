import assert from 'node:assert/strict';
import {sampleLinear,summarizeSamples} from './albedo-sampling.mjs';
import {srgbToLinear} from '../../../../tools/critic/color.mjs';
const image={width:2,height:2,pixels:Float32Array.from([
    1,0,0,1, 0,1,0,1,
    0,0,1,1, .5,.5,.5,1
])};
assert.deepEqual(sampleLinear(image,.25,.25),[1,0,0]);
assert.deepEqual(sampleLinear(image,.25,.75),[0,0,1]);
assert.deepEqual(sampleLinear(image,1.25,-.75),[1,0,0]);
const half=sampleLinear(image,.5,.25);assert.deepEqual(half,[.5,.5,0]);
assert.deepEqual(sampleLinear(image,.75,.75),Array(3).fill(srgbToLinear(.5)));
const result=summarizeSamples([{area:1,linearRGB:[1,0,0]},{area:3,linearRGB:[0,1,0]}]);
assert.deepEqual(result.meanLinearRGB,[.25,.75,0]);assert.equal(result.redChromaticity,.25);
assert.throws(()=>sampleLinear(image,NaN,0));assert.throws(()=>summarizeSamples([]));
console.log('PASS 4 groups: UV origin/repeat, linear filtering, sRGB decode, physical-area weighting and invalid input');
