// Independent affine sign certificates for each source triangle in the fixed height slab.
import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';import{gunzipSync}from'node:zlib';
import{ROOT,hashFile,sha256}from'../figure-pipeline/collar_replacement_manifest.mjs';
const base='captures/foundation-domain-feasibility-2026-09-30-v1',native='captures/foundation-cut-band-2026-09-30-v3';
const out=path.join(ROOT,'captures/foundation-domain-certificates-2026-09-30-v1');assert.ok(!fs.existsSync(out));fs.mkdirSync(out,{recursive:true});
const files=[`${base}/report.json`,`${base}/domain-construction.json.gz`,`${base}/domain-topology.json.gz`,`${native}/upper-after-cut.json.gz`,`${native}/report.json`,'tools/critic/foundation-domain-certificates.mjs','docs/evidence/wardrobe-2026-09-30/foundation-domain/CERTIFICATES.md'];
const pins=Object.fromEntries(files.map(f=>[f,hashFile(path.join(ROOT,f))]));assert.equal(pins[`${base}/report.json`],'509f4028c385d730e005a5d33aa11c2033aa6a7e862e8ab6a58e23a6bd77ef0a');
for(const f of files){const dest=path.join(out,'source',f);fs.mkdirSync(path.dirname(dest),{recursive:true});fs.copyFileSync(path.join(ROOT,f),dest);}
const r={started:new Date().toISOString(),pid:process.pid,pins,status:'running',triangles:[],degenerateWitnesses:[],errors:[]};const save=()=>fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(r,null,2)+'\n');
const torso=new Set(['spine_01','spine_02','spine_03','clavicle_l','clavicle_r']);
const area=([a,b,c])=>{const u=b.map((v,k)=>v-a[k]),v=c.map((v,k)=>v-a[k]);return Math.hypot(u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0])/2;};
try{save();const m=JSON.parse(gunzipSync(fs.readFileSync(path.join(ROOT,native,'upper-after-cut.json.gz')))),p=JSON.parse(fs.readFileSync(path.join(ROOT,native,'report.json'))),planes=p.boundaryConstruction.effective;
 const positions=Array.from({length:m.positions.length/3},(_,i)=>m.positions.slice(i*3,i*3+3)),weights=m.weights.map(Object.fromEntries);
 const names=[...new Set(m.weights.flat().map(v=>v[0]))],ts=names.filter(n=>torso.has(n)),ns=names.filter(n=>!torso.has(n));
 const maximum=(i,names)=>Math.max(0,...names.map(n=>weights[i][n]??0));
 for(let id=0;id<m.triangles.length;id++){const tri=m.triangles[id];if(!tri.every(i=>positions[i][2]>=planes[0]&&positions[i][2]<=planes[1]))continue;
  const d=tri.map(i=>maximum(i,ts)-maximum(i,ns)),positive=d.every(x=>x>0),negative=d.every(x=>x<0);let cert=null;
  if(positive||negative){const candidates=positive?ts:ns,opposition=positive?ns:ts;for(const n of candidates){const margins=tri.map(i=>(weights[i][n]??0)-maximum(i,opposition));if(margins.every(v=>v>0)){cert={bone:n,opposition,margins};break;}}}
  else{const t=ts.filter(n=>tri.every(i=>(weights[i][n]??0)===maximum(i,ts))),n=ns.filter(n=>tri.every(i=>(weights[i][n]??0)===maximum(i,ns)));if(t.length&&n.length)cert={torso:t,other:n};}
  r.triangles.push({triangle:id,indices:tri,kind:positive?'inside':negative?'outside':'mixed',d,certificate:cert});
 }
 r.summary={triangles:r.triangles.length,uncertified:r.triangles.filter(t=>!t.certificate).map(t=>t.triangle),kinds:Object.fromEntries(['inside','outside','mixed'].map(k=>[k,r.triangles.filter(t=>t.kind===k).length]))};
 const f=JSON.parse(fs.readFileSync(path.join(ROOT,base,'report.json'))),d=JSON.parse(gunzipSync(fs.readFileSync(path.join(ROOT,base,'domain-construction.json.gz')))),top=JSON.parse(gunzipSync(fs.readFileSync(path.join(ROOT,base,'domain-topology.json.gz'))));
 const origins=d.sourceStates.flatMap(s=>Array(s.polygon.length-2).fill(s));
 for(const id of f.output.degenerateTriangles){const state=origins[id],source=m.triangles[state.sourceTriangle],actual=top.triangles[id];r.degenerateWitnesses.push({outputTriangle:id,sourceTriangle:state.sourceTriangle,source,actual,sourceArea:area(source.map(i=>positions[i])),outputArea:area(actual.map(i=>d.points[i])),activePair:state.activePair,exactOriginalIndices:JSON.stringify(source)===JSON.stringify(actual)});}
 r.allZeroAreasInherited=r.degenerateWitnesses.every(w=>w.sourceArea===0&&w.outputArea===0&&w.exactOriginalIndices&&w.activePair===null);
 r.status=r.summary.uncertified.length===0&&r.allZeroAreasInherited?'finite-sign-and-source-witnesses-confirmed':'certificate-failed';for(const[f,h]of Object.entries(pins))assert.equal(hashFile(path.join(ROOT,f)),h);
}catch(error){r.status='failed';r.errors.push({message:error.message,stack:error.stack});process.exitCode=1;}
finally{r.finished=new Date().toISOString();save();console.log(JSON.stringify({status:r.status,pid:process.pid,summary:r.summary,allZeroAreasInherited:r.allZeroAreasInherited,errors:r.errors}));}
