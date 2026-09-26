// CPU diagnostic: level-zero diffuse sampling, never a rendered appearance prediction.
import assert from 'node:assert/strict';
import {srgbToLinear,linearToSrgb} from '../../../../tools/critic/color.mjs';

export function sampleLinear(image,u,v) {
    assert.ok(Number.isFinite(u)&&Number.isFinite(v));
    // GLTFLoader keeps flipY=false; glTF UV (0,0) addresses the PNG's top left.
    // The shipped sampler omits wrapS/wrapT, hence native RepeatWrapping.
    const x=u*image.width-.5,y=v*image.height-.5,ix=Math.floor(x),iy=Math.floor(y);
    const wrap=(a,n)=>(a%n+n)%n,fx=x-ix,fy=y-iy,out=[0,0,0];
    for(const[dx,dy,w]of [[0,0,(1-fx)*(1-fy)],[1,0,fx*(1-fy)],[0,1,(1-fx)*fy],[1,1,fx*fy]]) {
        const at=4*(wrap(iy+dy,image.height)*image.width+wrap(ix+dx,image.width));
        for(let c=0;c<3;c++)out[c]+=srgbToLinear(image.pixels[at+c])*w;
    }
    return out;
}

export function summarizeSamples(samples) {
    assert.ok(samples.length>0);let area=0;const mean=[0,0,0];
    for(const s of samples){assert.ok(s.area>0);area+=s.area;for(let c=0;c<3;c++)mean[c]+=s.linearRGB[c]*s.area;}
    for(let c=0;c<3;c++)mean[c]/=area;
    const sum=mean.reduce((a,b)=>a+b,0);
    return {triangles:samples.length,surfaceAreaM2:area,meanLinearRGB:mean,
        encodedMeanRGB:mean.map(linearToSrgb),redChromaticity:mean[0]/sum,
        redMinusGreenLinear:mean[0]-mean[1],blueMinusGreenLinear:mean[2]-mean[1]};
}
