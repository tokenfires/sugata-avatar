// Projected overlap shortlist, not alpha/occlusion ownership. Uses unchanged hidden-fringe geometry.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
const root='captures/bob-front-layers-v1',read=p=>JSON.parse(fs.readFileSync(p)),sha=b=>createHash('sha256').update(b).digest('hex');
const report=read(`${root}/report.json`),protectedCards=new Set(read('captures/bob-side-envelope-v3/candidate-report.json').selected);
assert.equal(report.status,'captured');assert.equal(report.sourceHashes[report.candidate],'bbed05d0ce51eccc84fbfb1a9baca9f4e9a36ac2b3176869d2e7bfda27fa8ad9');
const layer=c=>c<0?'cap':c<78?'root':c<178?'mass':c<248?'underlayer':c<296?'body':c<344?'surface':c<372?'flyaway':c<462?'veil':'fringe';
const regions=[{name:'forehead-stubs',view:'front',box:[310,185,520,305]},
 {name:'crown-front',view:'front',box:[305,60,520,150]},
 {name:'crown-slit-right',view:'front-right',box:[210,105,350,155]},
 {name:'forehead-stubs-right',view:'front-right',box:[110,175,240,305]},
 {name:'long-cheek-left',view:'front-left',box:[605,360,670,650]}];
function clip(poly,axis,edge,sign){
 const out=[];for(let i=0;i<poly.length;i++){
  const a=poly[i],b=poly[(i+1)%poly.length],ia=sign*(a[axis]-edge)>=0,ib=sign*(b[axis]-edge)>=0;
  if(ia)out.push(a);if(ia!==ib){const t=(edge-a[axis])/(b[axis]-a[axis]);out.push([a[0]+t*(b[0]-a[0]),a[1]+t*(b[1]-a[1])]);}
 }return out;
}
function overlap(tri,[x0,y0,x1,y1]){
 let p=tri;for(const[axis,edge,sign]of[[0,x0,1],[0,x1,-1],[1,y0,1],[1,y1,-1]])p=clip(p,axis,edge,sign);
 let a=0;for(let i=0;i<p.length;i++)a+=p[i][0]*p[(i+1)%p.length][1]-p[(i+1)%p.length][0]*p[i][1];return Math.abs(a)/2;
}
const rows=[];
for(const roi of regions){
 const entry=report.geometryFiles.find(g=>g.view===roi.view),file=`${root}/${entry.filename}`;assert.equal(sha(fs.readFileSync(file)),entry.sha256);const g=read(file),cards=new Map();
 for(let i=0;i<g.indices.length;i+=3){
  const idx=g.indices.slice(i,i+3),c=idx[0]<652?-1:Math.floor((idx[0]-652)/34);
  if(c<0)continue; // cap has no projected vertices in the per-card export
  assert.ok(idx.every(v=>Math.floor((v-652)/34)===c));
  const points=idx.map(v=>g.liveVerticesScreen.slice((v-652)*3,(v-652)*3+3));
  if(points.some(p=>p[2]<-1||p[2]>1))continue;
  const area=overlap(points.map(p=>p.slice(0,2)),roi.box);if(area<=0)continue;
  const record=cards.get(c)??{card:c,layer:layer(c),protected:protectedCards.has(c),projectedTriangleAreaPx2:0,triangles:[],root:g.restCentres.slice(c*51,c*51+3),tip:g.restCentres.slice(c*51+48,c*51+51)};
  record.projectedTriangleAreaPx2+=area;record.triangles.push({triangle:i/3,areaPx2:area});cards.set(c,record);
 }
 const records=[...cards.values()].sort((a,b)=>b.projectedTriangleAreaPx2-a.projectedTriangleAreaPx2);
 rows.push({...roi,geometryFile:file,geometrySha256:entry.sha256,records});
}
const geometry=read(`${root}/${report.geometryFiles[0].filename}`);
const unprotected=Array.from({length:496},(_,c)=>c).filter(c=>!protectedCards.has(c)).map(card=>({card,layer:layer(card),root:geometry.restCentres.slice(card*51,card*51+3),tip:geometry.restCentres.slice(card*51+48,card*51+51)}));
const source='tools/critic/inventory-bob-front-boundary.mjs';
const result={status:'read-only projected boundary inventory',generated:new Date().toISOString(),asset:report.candidate,assetSha256:report.sourceHashes[report.candidate],reportSha256:sha(fs.readFileSync(`${root}/report.json`)),protectedCards:[...protectedCards],unprotected,rows,sourceSha256:sha(fs.readFileSync(source)),limits:['Triangle overlap is a shortlist only: no depth ordering, back-face test, alpha coverage or pixel ownership is inferred.','Area sums may overlap; they are not visible area fractions.','Cap is excluded because the diagnostic per-card projection has no cap vertices; actual layer images retain the cap.','Protected means already in the338-card side/posterior region, not a general acceptance label.']};
fs.writeFileSync(`${root}/front-boundary-v2.json`,JSON.stringify(result,null,2)+'\n',{flag:'wx'});fs.copyFileSync(source,`${root}/inventory-bob-front-boundary-v2.mjs`,fs.constants.COPYFILE_EXCL);
console.log(JSON.stringify(rows.map(r=>({name:r.name,top:r.records.slice(0,15).map(({card,layer,protected:keep,projectedTriangleAreaPx2:area})=>({card,layer,protected:keep,area:Math.round(area)}))})),null,2));
