// Read-only continuous torso/arm weight-domain contour on frozen native loop triangles.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {gunzipSync,gzipSync} from 'node:zlib';
import {ROOT,hashFile,sha256} from '../figure-pipeline/collar_replacement_manifest.mjs';
import {topology} from '../figure-pipeline/collar_clearance_review.mjs';
const base='captures/foundation-cut-band-2026-09-30-v3';
const out=path.join(ROOT,'captures/foundation-domain-feasibility-2026-09-30-v1');
assert.ok(!fs.existsSync(out));fs.mkdirSync(out,{recursive:true});
const files=[`${base}/upper-after-cut.json.gz`,`${base}/report.json`,
 'tools/critic/foundation-domain-feasibility.mjs','docs/evidence/wardrobe-2026-09-30/foundation-domain/PLAN.md',
 'tools/figure-pipeline/collar_replacement_manifest.mjs','tools/figure-pipeline/collar_clearance_review.mjs',
 'tools/figure-pipeline/hair_geometry.mjs','tools/figure-pipeline/hair_surface.mjs'];
const pins=Object.fromEntries(files.map(f=>[f,hashFile(path.join(ROOT,f))]));
assert.equal(pins[`${base}/upper-after-cut.json.gz`],'c1a74bc80e1e38d1054e77ba2a153fe4699b001173c32e2343955132d842d218');
assert.equal(pins[`${base}/report.json`],'839835a1d9fae340c2d11e6f0f193cdfcc011a3bc113c39e6342484891afed21');
for(const f of files){const to=path.join(out,'source',f);fs.mkdirSync(path.dirname(to),{recursive:true});fs.copyFileSync(path.join(ROOT,f),to);}
const report={started:new Date().toISOString(),pid:process.pid,status:'running',pins,errors:[],scope:'Read-only domain contour; no final garment, skin, clearance, coverage or appearance qualification.'};
const save=()=>fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');
const archive=(name,data)=>{const raw=Buffer.from(JSON.stringify(data)+'\n'),b=gzipSync(raw);fs.writeFileSync(path.join(out,name),b);return{file:name,sha256:sha256(b),decodedSHA256:sha256(raw),bytes:b.length};};
const torso=new Set(['spine_01','spine_02','spine_03','clavicle_l','clavicle_r']);
const winner=rows=>rows.reduce((a,r)=>r[1]>a[1]?r:a,['none',0]);
const sub=(a,b)=>a.map((x,k)=>x-b[k]);
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const cycleKey=a=>a.map((_,i)=>a.slice(i).concat(a.slice(0,i)).join(':')).sort()[0];
try{
 save();const m=JSON.parse(gunzipSync(fs.readFileSync(path.join(ROOT,base,'upper-after-cut.json.gz'))));
 const parent=JSON.parse(fs.readFileSync(path.join(ROOT,base,'report.json'))),planes=parent.boundaryConstruction.effective;
 const points=Array.from({length:m.positions.length/3},(_,i)=>m.positions.slice(i*3,i*3+3));
 const weights=m.weights.map(rows=>Object.fromEntries(rows));
 const labels=m.weights.map(rows=>{const t=winner(rows.filter(r=>torso.has(r[0]))),n=winner(rows.filter(r=>!torso.has(r[0])));return{torso:t,other:n,d:t[1]-n[1]};});
 const masks=Object.fromEntries(Object.entries(m.attributes).map(([n,arr])=>[n,arr.slice()]));
 const originalCount=points.length,cutMap=new Map(),cuts=[],polygons=[],sourceStates=[],cornerUVs=[];
 const classifyHeight=tri=>{const z=tri.map(i=>points[i][2]);if(z.every(v=>v>=planes[0]&&v<=planes[1]))return'inside';if(z.every(v=>v<=planes[0])||z.every(v=>v>=planes[1]))return'outside';return'unsplit';};
 const getCut=(a,b)=>{
  const edge=[a,b].sort((x,y)=>x-y),key=edge.join(':');if(cutMap.has(key))return cutMap.get(key);
  const [u,v]=edge,du=labels[u].d,dv=labels[v].d,t=du/(du-dv);assert.ok(t>0&&t<1);
  const expected=points[u].map((x,k)=>x+t*(points[v][k]-x)),position=expected.map(Math.fround);
  const keys=new Set([...Object.keys(weights[u]),...Object.keys(weights[v])]);
  const ew=Object.fromEntries([...keys].map(n=>[n,(weights[u][n]??0)+t*((weights[v][n]??0)-(weights[u][n]??0))]));
  const w=Object.fromEntries(Object.entries(ew).map(([n,x])=>[n,Math.fround(x)]));
  const id=points.length;points.push(position);weights.push(w);labels.push({d:0,intersection:true});
  const em={},am={};for(const[n,rows]of Object.entries(masks)){em[n]=rows[u]+t*(rows[v]-rows[u]);am[n]=Math.fround(em[n]);rows.push(am[n]);}
  const tw=winner(Object.entries(w).filter(r=>torso.has(r[0]))),nw=winner(Object.entries(w).filter(r=>!torso.has(r[0])));
  cuts.push({vertex:id,edge,t,expectedPosition:expected,position,expectedWeights:ew,weights:w,expectedMasks:em,masks:am,storedWinningWeightDifference:tw[1]-nw[1]});cutMap.set(key,id);return id;
 };
 let mixed=0,inside=0,outside=0;const invalidPairs=[],heightCrossings=[];
 for(let face=0;face<m.triangles.length;face++){
  const tri=m.triangles[face],height=classifyHeight(tri);if(height==='unsplit'){heightCrossings.push(face);continue;}if(height==='outside'){outside++;continue;}inside++;
  const ds=tri.map(i=>labels[i].d),positive=ds.some(d=>d>0),negative=ds.some(d=>d<0);
  if(positive&&negative){mixed++;const pairs=new Set(tri.map(i=>labels[i].torso[0]+':'+labels[i].other[0]));if(pairs.size!==1){invalidPairs.push({face,tri,labels:tri.map(i=>labels[i])});continue;}}
  const output=[];
  for(let k=0;k<3;k++){const a=tri[k],b=tri[(k+1)%3],da=labels[a].d,db=labels[b].d;if(da>=0)output.push(a);if(da*db<0)output.push(getCut(a,b));}
  if(output.length<3)continue;assert.equal(new Set(output).size,output.length);
  const loops=m.triangleLoops[face],uv={};
  for(const[name,rows]of Object.entries(m.uvLayers))uv[name]=output.map(id=>{const direct=tri.indexOf(id);if(direct>=0)return rows.slice(loops[direct]*2,loops[direct]*2+2);const cut=cuts[id-originalCount],a=tri.indexOf(cut.edge[0]),b=tri.indexOf(cut.edge[1]);assert.ok(a>=0&&b>=0);return [0,1].map(k=>Math.fround(rows[loops[a]*2+k]+cut.t*(rows[loops[b]*2+k]-rows[loops[a]*2+k])));});
  polygons.push(output);sourceStates.push({sourceTriangle:face,source:tri,polygon:output,activePair:positive&&negative?[labels[tri[0]].torso[0],labels[tri[0]].other[0]]:null});cornerUVs.push(uv);
 }
 report.input={vertices:originalCount,triangles:m.triangles.length,planes,insideHeightTriangles:inside,outsideHeightTriangles:outside,heightCrossings,mixedTriangles:mixed,invalidPairs,exactSourceTies:labels.slice(0,originalCount).map((x,i)=>({i,d:x.d})).filter(x=>x.d===0).map(x=>x.i)};
 report.raw=archive('domain-construction.json.gz',{points,weights,masks,cuts,polygons,sourceStates,cornerUVs});save();assert.deepEqual(heightCrossings,[]);assert.deepEqual(invalidPairs,[]);
 const used=[...new Set(polygons.flat())].sort((a,b)=>a-b),dense=new Map(used.map((v,i)=>[v,i]));
 const triangles=[];for(const poly of polygons)for(let i=1;i<poly.length-1;i++)triangles.push([poly[0],poly[i],poly[i+1]]);
 const p={positions:new Float32Array(used.flatMap(i=>points[i])),indices:new Uint32Array(triangles.flatMap(t=>t.map(i=>dense.get(i)))),vertexCount:used.length};
 report.topology=topology(p);const edgeMap=new Map(),stars=new Map();let minArea=Infinity;const degenerates=[];
 for(let f=0;f<triangles.length;f++){const tri=triangles[f],area=Math.hypot(...cross(sub(points[tri[1]],points[tri[0]]),sub(points[tri[2]],points[tri[0]])))/2;minArea=Math.min(minArea,area);if(area===0)degenerates.push(f);for(let k=0;k<3;k++){const a=tri[k],b=tri[(k+1)%3],c=tri[(k+2)%3],key=[a,b].sort((x,y)=>x-y).join(':');if(!edgeMap.has(key))edgeMap.set(key,[]);edgeMap.get(key).push([a,b]);if(!stars.has(a))stars.set(a,[]);stars.get(a).push([b,c]);}}
 const linkFailures=[];for(const[v,es]of stars){const adj=new Map(),unique=new Set();let repeated=false;for(const[a,b]of es){const key=[a,b].sort((x,y)=>x-y).join(':');if(unique.has(key))repeated=true;unique.add(key);for(const[x,y]of [[a,b],[b,a]]){if(!adj.has(x))adj.set(x,new Set());adj.get(x).add(y);}}const queue=[adj.keys().next().value],seen=new Set(queue);for(let i=0;i<queue.length;i++)for(const n of adj.get(queue[i]))if(!seen.has(n)){seen.add(n);queue.push(n);}const degrees=[...adj.values()].map(v=>v.size),ends=degrees.filter(n=>n===1).length;if(repeated||seen.size!==adj.size||degrees.some(n=>n<1||n>2)||![0,2].includes(ends))linkFailures.push(v);}
 const boundary=[...edgeMap.values()].filter(r=>r.length===1).map(r=>r[0]),adj=new Map(),boundaryRows=[];
 for(const[a,b]of boundary){for(const[x,y]of [[a,b],[b,a]]){if(!adj.has(x))adj.set(x,new Set());adj.get(x).add(y);}const plane=planes.find(z=>points[a][2]===z&&points[b][2]===z)??null,domain=labels[a].d===0&&labels[b].d===0;boundaryRows.push({edge:[a,b],plane,domain,accounted:plane!==null||domain});}
 const seen=new Set(),loops=[];for(const v of adj.keys())if(!seen.has(v)){const queue=[v];seen.add(v);for(let i=0;i<queue.length;i++)for(const n of adj.get(queue[i]))if(!seen.has(n)){seen.add(n);queue.push(n);}const ids=new Set(queue),edges=boundaryRows.filter(r=>ids.has(r.edge[0]));loops.push({vertices:queue.length,nonTwoDegree:queue.filter(i=>adj.get(i).size!==2),heightMin:Math.min(...queue.map(i=>points[i][2])),heightMax:Math.max(...queue.map(i=>points[i][2])),planeEdges:edges.filter(r=>r.plane!==null).length,domainEdges:edges.filter(r=>r.domain).length,unaccounted:edges.filter(r=>!r.accounted)});}
 report.output={vertices:used.length,triangles:triangles.length,cutVertices:cuts.length,minTriangleArea:minArea,degenerateTriangles:degenerates,vertexLinkFailures:linkFailures,loops,boundaryEdges:boundary.length,unaccountedBoundaryEdges:boundaryRows.filter(r=>!r.accounted),maxStoredWeightBoundaryResidual:Math.max(...cuts.map(c=>Math.abs(c.storedWinningWeightDifference)))};
 report.topologyArtifact=archive('domain-topology.json.gz',{used,triangles,boundary:boundaryRows,loops});
 report.pass=report.topology.components===1&&report.topology.eulerCharacteristic===0&&report.topology.nonmanifoldEdges===0&&report.topology.orientationErrors===0&&report.topology.weldedVertices===used.length&&degenerates.length===0&&linkFailures.length===0&&loops.length===2&&loops.every(l=>l.nonTwoDegree.length===0&&l.unaccounted.length===0);
 report.status=report.pass?'finite-domain-contour-feasible':'domain-contour-failed';for(const[f,h]of Object.entries(pins))assert.equal(hashFile(path.join(ROOT,f)),h);
}catch(error){report.status='failed';report.errors.push({message:error.message,stack:error.stack});process.exitCode=1;}
finally{report.finished=new Date().toISOString();save();console.log(JSON.stringify({status:report.status,pid:process.pid,input:report.input,output:report.output,errors:report.errors}));}
