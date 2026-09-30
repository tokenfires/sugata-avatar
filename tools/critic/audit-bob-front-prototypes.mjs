// Focused evidence checks for two rejected front constructions. No visual qualification inferred.
import fs from 'node:fs';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';
import {readGlb,readPrimitive} from '../lut-bake/glb.mjs';
import {SurfaceGrid} from '../figure-pipeline/hair_geometry.mjs';import {measureHairSurface} from '../figure-pipeline/hair_surface.mjs';
const read=p=>JSON.parse(fs.readFileSync(p)),sha=b=>createHash('sha256').update(b).digest('hex');
const baseDir='captures/bob-fringe-ablation-v1/control',base=read(`${baseDir}/report.json`),body=readPrimitive(readGlb('assets/figures/figure_g050.glb'),'base.001');
const expected='bbed05d0ce51eccc84fbfb1a9baca9f4e9a36ac2b3176869d2e7bfda27fa8ad9';assert.equal(base.sourceHashes[base.candidate],expected);
const baseline=readPrimitive(readGlb(base.candidate),'hair_bob02'),protectedCards=read('captures/bob-side-envelope-v3/candidate-report.json').selected,protectedSet=new Set(protectedCards),selected=Array.from({length:496},(_,c)=>c).filter(c=>!protectedSet.has(c)),set=new Set(selected),indices=[];
for(let i=0;i<baseline.indices.length;i+=3)if([0,1,2].every(k=>baseline.indices[i+k]>=652&&set.has(Math.floor((baseline.indices[i+k]-652)/34))))indices.push(...baseline.indices.slice(i,i+3));
const bounds={min:[-Infinity,-Infinity,-Infinity],max:[Infinity,Infinity,Infinity]},crossings=measureHairSurface({...baseline,indices},body,{headBounds:bounds,faceBounds:bounds}),grid=new SurfaceGrid(body.positions,body.normals,body.indices);
let min=Infinity,negative=0,witness=null;for(const c of selected)for(let v=652+c*34;v<652+(c+1)*34;v++){const p=Array.from(baseline.positions.slice(v*3,v*3+3)),mm=grid.nearest(p).signed*1000;if(mm<0)negative++;if(mm<min){min=mm;witness={card:c,vertex:v,point:p,signedMm:mm};}}
const rows=[];
for(const root of ['captures/bob-front-flow-v1','captures/bob-front-support-v1']){
 const a=read(`${root}/candidate-report.json`),dir=`${root}/neutral`,b=read(`${dir}/report.json`);assert.equal(sha(fs.readFileSync(`${root}/candidate.glb`)),a.outputSha256);assert.equal(a.inputSha256,expected);assert.deepEqual(a.selected,selected);
 const common=r=>Object.fromEntries(Object.entries(r.sourceHashes).filter(([p])=>p!==r.candidate));assert.deepEqual(common(b),common(base));
 for(const [d,r]of [[baseDir,base],[dir,b]]){assert.equal(r.status,'captured');assert.deepEqual(r.errors,[]);for(const [p,h]of Object.entries(r.sourceHashes)){assert.equal(sha(fs.readFileSync(p)),h,p);if(p.startsWith('tools/')||p.startsWith('packages/'))assert.equal(sha(fs.readFileSync(`${d}/source/${p}`)),h,p);}}
 const cases=[];for(const c of b.cases){
  const bc=base.cases.find(x=>x.view===c.view&&x.colour.id===c.colour.id);assert.ok(bc);
  const strip=s=>Object.fromEntries(Object.entries(s).filter(([k])=>!['positions','velocities','vertices'].includes(k)));
  assert.deepEqual(strip(c.fixedState),strip(bc.fixedState));for(const k of ['clock','applied','lightingChanges','hidden','identity','size','backend','adapter','exactDefault'])assert.deepEqual(c[k],bc[k]);
  const geometries=[];for(const[d,r,v]of [[baseDir,base,bc],[dir,b,c]]){assert.equal(sha(fs.readFileSync(`${d}/${v.filename}`)),v.imageSha256);const entry=r.geometryFiles.find(x=>x.view===v.view);assert.equal(sha(fs.readFileSync(`${d}/${entry.filename}`)),entry.sha256);geometries.push(read(`${d}/${entry.filename}`));}
  const [x,y]=geometries;for(const k of ['headMatrix','indices','uv','uv1','chainCount','pointsPerChain','vertexBase','steps'])assert.deepEqual(x[k],y[k]);
  const m={authoredToLiveMaximumMm:0,authoredToLiveWitness:null,protectedLiveMaximumMm:0,protectedLiveWitness:null};
  for(let v=0;v<y.liveVertices.length/3;v++){
   const c=Math.floor(v/34),d=Math.hypot(...[0,1,2].map(k=>(y.liveVertices[v*3+k]-y.restVertices[v*3+k])*1000));
   if(d>m.authoredToLiveMaximumMm){m.authoredToLiveMaximumMm=d;m.authoredToLiveWitness={card:c,ring:Math.floor(v%34/2),side:v%2};}
   if(protectedSet.has(c)){
    for(let k=0;k<3;k++)assert.equal(x.restVertices[v*3+k],y.restVertices[v*3+k]);
    const delta=Math.hypot(...[0,1,2].map(k=>(y.liveVertices[v*3+k]-x.liveVertices[v*3+k])*1000));if(delta>m.protectedLiveMaximumMm){m.protectedLiveMaximumMm=delta;m.protectedLiveWitness={card:c,ring:Math.floor(v%34/2),side:v%2};}
   }
  }
  cases.push({view:c.view,controlsExact:true,...m});
 }
 rows.push({root,candidateSha256:a.outputSha256,reportSha256:sha(fs.readFileSync(`${root}/candidate-report.json`)),restTriangleBodyPairs:a.restTriangleBodyPairs,negativeVertices:a.negativeVertices,minimumSelectedVertexClearanceMm:a.minimumSelectedVertexClearanceMm,cases});
}
const out='captures/bob-front-prototype-audit-v1';assert.ok(!fs.existsSync(out));fs.mkdirSync(out);
const source='tools/critic/audit-bob-front-prototypes.mjs';fs.copyFileSync(source,`${out}/source.mjs`);
const result={status:'complete; both candidates rejected',generated:new Date().toISOString(),baseline:{asset:base.candidate,sha256:expected,selected,triangleBodyPairs:crossings.head.pairs,negativeVertices:negative,minimumVertexClearanceMm:min,witness,crossings},rows,sourceSha256:sha(fs.readFileSync(source)),limits:['Matched fixed controls; rendered static geometry can differ from authored geometry through the existing reset/collision projection.','Protected rest records do not guarantee protected live equality.','Rest body oracle is full158frontcards including unchanged skipped cards, not all-motion or perceptual qualification.']};
fs.writeFileSync(`${out}/summary.json`,JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({...result,baseline:{...result.baseline,selected:selected.length,crossings:undefined}},null,2));
