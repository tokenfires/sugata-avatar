import fs from 'node:fs';
import {pathToFileURL} from 'node:url';
import {rayTriangle,connectedComponents,isRibbon,skinVisibleFrom} from '../../../tools/figure-pipeline/hair_geometry.mjs';
const sourceUrl = new URL('../../../tools/figure-pipeline/verify_glb.mjs', import.meta.url);
const names = ['readGlb','readOnlyPrimitive','craniumTarget','scalpSurfaceSamples','albedoAlphaSampler','scalpTransmittance','largestExposedPatch','viewDirection','viewReachFor','SCALP_SAMPLE_SPACING_M','SCALP_PATCH_LINK_M','SCALP_COVERAGE_REACH_M','SCALP_VIEW_ANGLES','SCALP_VIEW_FACING'];
let source = fs.readFileSync(sourceUrl,'utf8').replace(/import\(\s*(["'])(\.[^"']+)\1\)/g, (_,q,url)=>`import(${JSON.stringify(new URL(url,sourceUrl).href)})`).replace('await main();',`export { ${names.join(',')} };`);
fs.writeFileSync(new URL('./verify-module.mjs',import.meta.url),source);
const m=await import('./verify-module.mjs');
const cranium=m.craniumTarget(m.readGlb('assets/figures/figure_g050.glb'));
const samples=m.scalpSurfaceSamples(cranium,m.SCALP_SAMPLE_SPACING_M);
const interpolateUv=(uvs,indices,t,bary)=>[0,1].map(axis=>bary.reduce((sum,w,i)=>sum+w*uvs[indices[t+i]*2+axis],0));
const out=[];
for(const file of process.argv.slice(2)){
 const glb=m.readGlb(file),hair=m.readOnlyPrimitive(glb),alpha=m.albedoAlphaSampler(glb),at=(u,v)=>alpha(u,v)>=.5?1:0;
 const caps=new Set(connectedComponents(hair.indices,hair.vertexCount).filter(c=>!isRibbon(c)).flatMap(c=>c.triangles));
 const direction=m.viewDirection(m.SCALP_VIEW_ANGLES.find(a=>a.name==='side'));
 const visible=skinVisibleFrom(samples,hair,cranium.body,at,direction,m.viewReachFor(hair),m.SCALP_VIEW_FACING);
 const normal=Array.from(m.scalpTransmittance(samples,hair,at,m.SCALP_COVERAGE_REACH_M),t=>t>.5);
 const result={file,normalPatch:m.largestExposedPatch(samples,normal,m.SCALP_PATCH_LINK_M),sidePatch:m.largestExposedPatch(samples,visible,m.SCALP_PATCH_LINK_M),sideSamples:[]};
 for(let i=0;i<visible.length;i++){
  if(!visible[i])continue;
  const point=Array.from(samples.points.slice(i*3,i*3+3)), hits=[];
  for(let t=0;t<hair.indices.length;t+=3){const h=rayTriangle(point,direction,hair.positions,hair.indices,t);if(h&&h.distance<.4){const uv=interpolateUv(hair.uvs,hair.indices,t,h.bary);hits.push({cap:caps.has(t/3),distance:h.distance,alpha:alpha(...uv),uv});}}
  result.sideSamples.push({point,areaMm2:samples.areas[i]*1e6,hits});
 }
 out.push(result);
}
console.log(JSON.stringify(out,null,2));
