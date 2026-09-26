// CPU-only comparison at the exact previously qualified geometry samples. No asset writes.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {decodePng} from '../../../../../tools/critic/png.mjs';
import {sampleLinear,summarizeSamples} from '../albedo-sampling.mjs';
const HERE=path.dirname(fileURLToPath(import.meta.url)),ROOT=path.resolve(HERE,'../../../../..'),sha=b=>createHash('sha256').update(b).digest('hex'),hash=p=>sha(fs.readFileSync(p)),json=x=>JSON.stringify(x,null,2)+'\n';
const baselinePath=path.join(HERE,'../albedo-v2.json'),inventoryPath=path.join(HERE,'inventory-v1.json');
assert.equal(hash(baselinePath),'edc36c6f034c90edf89ebae9b840ec8d6be46a42502617e215fab705488b9ff0');assert.equal(hash(inventoryPath),'157b32a1a0a3622f18bc6acac6928474221c17745c53e7f864e4e48db6839e1c');
const baseline=JSON.parse(fs.readFileSync(baselinePath)),inventory=JSON.parse(fs.readFileSync(inventoryPath));
assert.equal(baseline.completed,true);for(const[f,h]of Object.entries(baseline.sources))assert.equal(hash(path.join(ROOT,f)),h,'Prior qualified source drift: '+f);
assert.equal(hash(inventory.archive),inventory.archiveSHA256);assert.equal(hash(path.join(HERE,'inventory.py')),inventory.scriptSHA256);
const textures=inventory.items.map(item=>{assert.equal(hash(item.extractedPath),item.pngSHA256);const image=decodePng(fs.readFileSync(item.extractedPath));assert.deepEqual([image.width,image.height,image.bitDepth],[2048,2048,8]);let alphaNonOpaque=0;for(let i=3;i<image.pixels.length;i+=4)if(image.pixels[i]!==1)alphaNonOpaque++;assert.equal(alphaNonOpaque,0);return {...item,image,alphaNonOpaque};});
const [current,alternate]=textures;assert.equal(current.pngSHA256,baseline.image.sha256);
const regions={};
for(const[name,region]of Object.entries(baseline.regions)){
 const repeated=region.samples.map(sample=>({...sample,linearRGB:sampleLinear(current.image,...sample.uv)}));
 for(let i=0;i<repeated.length;i++)assert.deepEqual(repeated[i].linearRGB,region.samples[i].linearRGB,'Exact current-image scalar replay');
 const currentSummary=summarizeSamples(repeated),expected={...region};delete expected.samples;delete expected.definition;assert.deepEqual(currentSummary,expected,'Exact original region summary');
 const changed=region.samples.map(sample=>({...sample,linearRGB:sampleLinear(alternate.image,...sample.uv)})),alternateSummary=summarizeSamples(changed);
 regions[name]={definition:region.definition,current:currentSummary,alternate:alternateSummary,difference:{redChromaticity:alternateSummary.redChromaticity-currentSummary.redChromaticity,meanLinearRGB:alternateSummary.meanLinearRGB.map((v,i)=>v-currentSummary.meanLinearRGB[i]),encodedMeanRGB:alternateSummary.encodedMeanRGB.map((v,i)=>v-currentSummary.encodedMeanRGB[i])},samples:region.samples.map((s,i)=>({triangle:s.triangle,vertexIds:s.vertexIds,centroid:s.centroid,normal:s.normal,axisFraction:s.axisFraction,uv:s.uv,area:s.area,currentLinearRGB:s.linearRGB,alternateLinearRGB:changed[i].linearRGB}))};
}
const contrasts={};for(const side of ['l','r']){contrasts[side]={};for(const role of ['current','alternate']){const k=regions[side+'-knee'][role],s=regions[side+'-midShin'][role];contrasts[side][role]={kneeMinusShinRedChromaticity:k.redChromaticity-s.redChromaticity,kneeMinusShinLinearRGB:k.meanLinearRGB.map((v,i)=>v-s.meanLinearRGB[i])};}}
let changedPixels=0,absolute=0,max=0;const w=current.image.width,h=current.image.height;for(let p=0;p<w*h;p++){let changed=false;for(let k=0;k<3;k++){const i=p*4+k,d=Math.round(alternate.image.pixels[i]*255)-Math.round(current.image.pixels[i]*255);if(d)changed=true;absolute+=Math.abs(d);max=Math.max(max,Math.abs(d));}if(changed)changedPixels++;}
const report={kind:'unchanged-geometry-current-versus-cached-alternate-diffuse',completed:true,baselineSHA256:hash(baselinePath),inventorySHA256:hash(inventoryPath),sources:{...baseline.sources,[path.relative(ROOT,fileURLToPath(import.meta.url))]:hash(fileURLToPath(import.meta.url)),[path.relative(ROOT,path.join(HERE,'inventory.py'))]:hash(path.join(HERE,'inventory.py'))},images:textures.map(({image,mhmatText,...item})=>({...item,width:image.width,height:image.height,bitDepth:image.bitDepth,colorType:image.colorType})),sampler:baseline.image.sampler,landmarks:baseline.landmarks,regions,contrasts,wholeAtlas:{scope:'Entire stored atlas including unused padding and hidden body areas, not visible surface or face-region weighting.',pixels:w*h,changedRGBPixels:changedPixels,changedFraction:changedPixels/(w*h),meanAbsoluteRGBCodeDifference:absolute/(w*h*3),maxAbsoluteRGBCodeDifference:max},scope:baseline.scope,limits:[...baseline.limits,'Existing208 selected geometry samples are reused exactly; this is not a new anatomical segmentation.','Whole texture replacement changes face, scalp, neck, torso, hands and legs together. Relative knee contrast alone cannot establish a better appearance.','MakeHuman mhmat metadata is provenance only; none of its shader/material parameters are applied.']};
const out=path.join(HERE,'comparison-v1.json');fs.writeFileSync(out,json(report),{flag:'wx'});console.log(json({out,sha256:hash(out),regions:Object.fromEntries(Object.entries(regions).map(([k,{samples,...v}])=>[k,v])),contrasts,wholeAtlas:report.wholeAtlas}));
