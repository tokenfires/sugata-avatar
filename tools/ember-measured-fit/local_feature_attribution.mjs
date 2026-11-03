// One read-only local-field/correspondence inspection. No solver, rendering or asset mutation.
import fs from 'node:fs';
import crypto from 'node:crypto';
import { readGlb, readAccessor } from '../lut-bake/glb.mjs';
import { IdentityCatalogue } from '../../packages/core/src/figure/IdentityCatalogue.js';
import { IdentityTargets } from '../../packages/core/src/figure/IdentityTargets.js';

const out='docs/evidence/ember-2026-10-31-local-feature-attribution/';
const fit='docs/evidence/ember-2026-10-31-measured-fit/';
const glbPath='docs/evidence/ember-2026-10-31-eye-bridge/candidate.glb';
const cache='tools/figure-pipeline/.cache/ember-source/';
const parts=[['eyes','eyes/high-poly/high-poly.mhclo'],['brows','eyebrows/eyebrow001/eyebrow001.mhclo'],['lashes','eyelashes/eyelashes01/eyelashes01.mhclo'],['teeth','teeth/teeth_base/teeth_base.mhclo'],['tongue','tongue/tongue01/tongue01.mhclo']];
const ids=['cheek/cheek-volume-decr-incr','chin/chin-width-decr-incr','chin/chin-cleft-decr-incr','mouth/mouth-lowerlip-height-decr-incr','mouth/mouth-lowerlip-volume-decr-incr'];
const inputs=[import.meta.filename,'tools/lut-bake/glb.mjs','packages/core/src/figure/IdentityCatalogue.js','packages/core/src/figure/IdentityTargets.js','assets/identity/catalogue.json','assets/identity/figure-vertex-map.bin',...['cheek','chin','mouth'].map(x=>`assets/identity/targets/${x}.bin`),fit+'candidate-correction-v001.json',fit+'candidate-correction-v001-positions.f32',fit+'observations-correction-v001.json',glbPath,...parts.map(x=>cache+x[1]),'packages/testbed/src/ember-brow-only-v002.js','packages/testbed/src/ember-ocular-v003-material.js'];
const limits={cpuSeconds:60,rssBytes:512*1024**2,outputBytes:10*1024**2};
const sha=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const cpu0=process.cpuUsage(),wall0=performance.now();
function guard(){const c=process.cpuUsage(cpu0);if(c.user+c.system>limits.cpuSeconds*1e6||process.memoryUsage().rss>limits.rssBytes)throw Error('Resource cap reached');}
function write(name,value){const text=JSON.stringify(value,null,2)+'\n';if(Buffer.byteLength(text)>limits.outputBytes)throw Error('Output cap');fs.writeFileSync(out+name,text,{flag:'wx'});}
const inv=Object.fromEntries(inputs.map(p=>[p,{bytes:fs.statSync(p).size,sha256:sha(p)}]));
if(Object.values(inv).reduce((s,x)=>s+x.bytes,0)>32*1024**2)throw Error('Input budget changed');
if(inv[glbPath].sha256!=='bcb87a95d76ad252d2681c614c8d9f34d2f51a87a10077298323066fc9ebcdef')throw Error('Frozen geometry changed');
fs.mkdirSync(out,{recursive:true});
if(process.argv[2]==='--preflight'){
 write('preflight.json',{inputs:inv,limits,scope:'Five existing local controls; raw endpoint supports, six direction samples at 0.1, frozen-body correspondence and five attached-part descriptors. No candidate, no solver, no oral intersections.',fieldCount:6,sliderIds:ids});
 console.log(JSON.stringify({preflight:true,inputs:inputs.length,inputBytes:Object.values(inv).reduce((s,x)=>s+x.bytes,0),limits}));
}else if(process.argv[2]==='--run'){
 const pre=JSON.parse(fs.readFileSync(out+'preflight.json'));if(JSON.stringify(pre.inputs)!==JSON.stringify(inv))throw Error('Inputs differ from preflight');
 write('STARTED.json',{utc:new Date().toISOString(),pid:process.pid,limits});
 try{
 const cat=JSON.parse(fs.readFileSync('assets/identity/catalogue.json')),catalogue=new IdentityCatalogue(cat);
 const targets=new IdentityTargets(cat,{baseUrl:new URL('../../assets/identity/',import.meta.url).href,fetchBytes:async url=>{const b=fs.readFileSync(new URL(url));return b.buffer.slice(b.byteOffset,b.byteOffset+b.length);}});
 await targets.loadRegions(['cheek','chin','mouth']);
 const f32=p=>{const b=fs.readFileSync(p);return new Float32Array(b.buffer,b.byteOffset,b.byteLength/4);};
 const mapBytes=fs.readFileSync('assets/identity/figure-vertex-map.bin'),sourceMap=new Uint16Array(mapBytes.buffer,mapBytes.byteOffset,mapBytes.length/2);
 const fitted=f32(fit+'candidate-correction-v001-positions.f32');
 if(fitted.length!==sourceMap.length*3||sourceMap.length!==14517)throw Error('Unexpected frozen mapping size');
 const nativePositions=new Map();let duplicateSpread=0;
 for(let i=0;i<sourceMap.length;i++){const p=Array.from(fitted.subarray(i*3,i*3+3)),old=nativePositions.get(sourceMap[i]);if(old)duplicateSpread=Math.max(duplicateSpread,Math.hypot(...p.map((x,k)=>x-old[k])));else nativePositions.set(sourceMap[i],p);}
 const g=readGlb(glbPath),body=g.json.meshes.find(m=>m.name==='base.001'),p=body?.primitives[0];
 if(!p||body.primitives.length!==1)throw Error('Unexpected body layout');
 const bodyPos=readAccessor(g,p.attributes.POSITION).data;
 const cell=1e-5,buckets=new Map(),key=p=>p.map(v=>Math.floor(v/cell)).join(',');
 for(const [id,p]of nativePositions){const k=key(p);if(!buckets.has(k))buckets.set(k,[]);buckets.get(k).push([id,p]);}
 const nativeByGlb=[],failures=[];let maxMatch=0;
 for(let i=0;i<bodyPos.length/3;i++){
  const q=Array.from(bodyPos.subarray(i*3,i*3+3)),xyz=q.map(v=>Math.floor(v/cell)),hits=[];
  for(let x=-1;x<=1;x++)for(let y=-1;y<=1;y++)for(let z=-1;z<=1;z++)for(const [id,p]of buckets.get([xyz[0]+x,xyz[1]+y,xyz[2]+z].join(','))??[]){const d=Math.hypot(...q.map((v,k)=>v-p[k]));if(d<=2e-6)hits.push({id,d});}
  if(hits.length!==1){failures.push({glbVertex:i,matches:hits.length});nativeByGlb.push(null);}else{nativeByGlb.push(hits[0].id);maxMatch=Math.max(maxMatch,hits[0].d);}
  if(i%1000===0)guard();
 }
 const correspondence={glbBodyVertices:bodyPos.length/3,knownNativeVertices:nativePositions.size,matched:nativeByGlb.filter(x=>x!==null).length,failures:failures.slice(0,20),failureCount:failures.length,maxDistanceMetres:maxMatch,sourceDuplicateSpreadMetres:duplicateSpread,method:'Coordinate equality within 2 micrometres to the frozen fitted source; no optimization. UV-split copies share one native source.'};
 const identity=JSON.parse(fs.readFileSync(fit+'candidate-correction-v001.json')).identity;
 const anchors=JSON.parse(fs.readFileSync(fit+'observations-correction-v001.json')).anchors;
 function descriptor(name,rel){const rows=[],scales={};let active=false;
  for(const line of fs.readFileSync(cache+rel,'utf8').split(/\r?\n/)){const s=line.trim();if(!s||s.startsWith('#'))continue;const t=s.split(/\s+/);if(/^[xyz]_scale$/.test(t[0]))scales[t[0]]={indices:t.slice(1,3).map(Number),reference:Number(t[3])};if(t[0]==='verts'){active=true;continue;}if(active){if(!/^\d+$/.test(t[0]))break;if(t.length===1)rows.push({ids:[+t[0]],weights:[1],offset:[0,0,0]});else if(t.length===9)rows.push({ids:t.slice(0,3).map(Number),weights:t.slice(3,6).map(Number),offset:t.slice(6,9).map(Number)});else throw Error('Unexpected descriptor row '+rel);}}
  if(!rows.length)throw Error('Empty descriptor '+rel);return {name,path:cache+rel,rows,scales};}
 const descriptors=parts.map(([n,r])=>descriptor(n,r));
 const norm=v=>Math.hypot(...v),vec=(field,id)=>Array.from(field.subarray(id*3,id*3+3));
 const weighted=(field,ids,weights)=>[0,1,2].map(k=>ids.reduce((s,id,n)=>s+field[id*3+k]*weights[n],0));
 function bounds(rows){if(!rows.length)return null;return {min:[0,1,2].map(k=>Math.min(...rows.map(p=>p[k]))),max:[0,1,2].map(k=>Math.max(...rows.map(p=>p[k])))};}
 const endpointSupport=ids.map(id=>{const s=catalogue.slider(id),view=targets.regionBytes.get(s.region);return {id,baseline:identity[id]??0,endpoints:Object.entries(s.ends).map(([end,e])=>{let visible=0,helpers=0,nonzero=0;for(let i=0;i<e.count;i++){const at=(e.offset>>2)+i*4,index=view.index[at];if(Math.hypot(view.offset[at+1],view.offset[at+2],view.offset[at+3])>1e-12){nonzero++;if(index<13380)visible++;else helpers++;}}return {end,target:e.target,records:e.count,nonzero,visible,helpers};})};});
 const specs=[['cheek-reduce-current-positive',ids[0],-.1],['chin-narrow-current-positive',ids[1],-.1],['cleft-positive',ids[2],.1],['cleft-negative',ids[2],-.1],['lower-lip-height-decrease',ids[3],-.1],['lower-lip-volume-decrease',ids[4],-.1]];
 const fields=[];
 for(const [name,id,change]of specs){
  const before=identity[id]??0,after=before+change;
  const stack=[...catalogue.resolve({[id]:after}),...catalogue.resolve({[id]:before}).map(s=>({...s,weight:-s.weight}))];
  const field=new Float64Array(cat.library.basemeshVertexCount*3);targets.apply(field,stack);
  const moved=[],helpers=[],coords=[];let maximum={magnitudeMm:0};
  for(let v=0;v<field.length/3;v++){const d=vec(field,v),mm=norm(d)*1000;if(mm<=1e-8)continue;if(v<13380){moved.push(v);coords.push(nativePositions.get(v));}else helpers.push(v);if(mm>maximum.magnitudeMm)maximum={nativeVertex:v,magnitudeMm:mm,deltaMm:d.map(x=>x*1000),positionMetres:nativePositions.get(v)??null};}
  if(coords.some(x=>!x))throw Error('Source support lacks native correspondence');
  const partResponses=descriptors.map(d=>{
   const responses=d.rows.map((r,index)=>({index,delta:weighted(field,r.ids,r.weights),ids:r.ids}));
   const touched=responses.filter(r=>norm(r.delta)>1e-11).sort((a,b)=>norm(b.delta)-norm(a.delta));
   const scaleResponses=Object.entries(d.scales).map(([axis,s])=>{const k={x_scale:0,y_scale:1,z_scale:2}[axis],difference=field[s.indices[0]*3+k]-field[s.indices[1]*3+k];return {axis,...s,endpointDeltasMm:s.indices.map(v=>vec(field,v).map(x=>x*1000)),axisSeparationDeltaMm:difference*1000};});
   return {name:d.name,descriptorVertices:d.rows.length,barycentricMoved:touched.length,maxBarycentricDeltaMm:touched.length?norm(touched[0].delta)*1000:0,largestWitnesses:touched.slice(0,3).map(r=>({...r,deltaMm:r.delta.map(x=>x*1000),delta:undefined})),scaleResponses,scaleAxisChanges:scaleResponses.some(s=>Math.abs(s.axisSeparationDeltaMm)>1e-8),limit:'Descriptor source indices, not exported part indices. If scale axes change, barycentric displacement is incomplete; offset-scale and rig/expression refit remain unqualified.'};
  });
  fields.push({name,slider:id,before,after,change,visibleMoved:moved.length,helpersMoved:helpers.length,helperIds:helpers,visibleBoundsMetres:bounds(coords),maximum,affectedNativeIds:moved,anchorResponses:anchors.map(a=>({name:a.name,vertices:a.vertices,weights:a.weights,status:a.status,deltaMm:weighted(field,a.vertices,a.weights).map(x=>x*1000)})),parts:partResponses});guard();
 }
 const afterHashes=Object.fromEntries(inputs.map(p=>[p,sha(p)]));for(const [p,h]of Object.entries(afterHashes))if(h!==inv[p].sha256)throw Error('Input changed during report '+p);
 const cpu=process.cpuUsage(cpu0),report={scope:'One source-only local-field/correspondence inspection; six 0.1-unit direction samples are response witnesses, not selected candidate settings or an identity solve.',correspondence,endpointSupport,fields,inputsUnchanged:true,resources:{cpuSeconds:(cpu.user+cpu.system)/1e6,wallSeconds:(performance.now()-wall0)/1000,rssBytes:process.memoryUsage().rss},limits:['No appearance or fit acceptance. No output geometry or modified source asset.','Anchors retain their provisional semantics: lower-lip-mid is not a verified vermilion boundary; mouth-seam/lid rims are provisional surface picks.','No oral intersections or additional mouth-clearance probes. Existing defects remain unqualified.','Part descriptor zero response is source coupling evidence only; full animated rig/expression safety is not established.']};
 guard();write('source-report.json',report);write('process-result.json',{ok:true,utc:new Date().toISOString(),resources:report.resources,reportBytes:fs.statSync(out+'source-report.json').size});
 console.log(JSON.stringify({ok:true,correspondence,fields:fields.map(f=>({name:f.name,visibleMoved:f.visibleMoved,helpersMoved:f.helpersMoved,maximum:f.maximum,parts:f.parts.map(p=>({name:p.name,barycentricMoved:p.barycentricMoved,maxDeltaMm:p.maxBarycentricDeltaMm,scaleAxisChanges:p.scaleAxisChanges}))})),resources:report.resources}));
 }catch(error){write('process-result.json',{ok:false,utc:new Date().toISOString(),error:error.stack});throw error;}
}else throw Error('Use --preflight or --run');
