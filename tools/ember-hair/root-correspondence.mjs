// Read-only source preparation for two unresolved original root seeds. No curves or compiler.
import fs from 'node:fs';
import crypto from 'node:crypto';
import {Vector3, Triangle} from 'three';
import {readGlb, readAccessor} from '../lut-bake/glb.mjs';

const out='docs/evidence/ember-2026-10-31-hair-authoring-revision/';
const contract=JSON.parse(fs.readFileSync(out+'contract.json')),limits=contract.limits;
const cpu=process.cpuUsage(),wall=performance.now();let pairs=0,activeSeed=null;
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const need=(ok,message)=>{if(!ok)throw Error(message);};
const preBytes=fs.readFileSync(out+'preflight.json'),pre=JSON.parse(preBytes);
function resources(){const c=process.cpuUsage(cpu);return {cpuSeconds:(c.user+c.system)/1e6,wallSeconds:(performance.now()-wall)/1000,observedRssBytes:process.memoryUsage().rss};}
function guard(){const r=resources();need(r.cpuSeconds<=limits.cpuSeconds&&r.wallSeconds<=limits.wallSeconds&&r.observedRssBytes<=limits.rssBytes,'Resource ceiling');}
function verify(){for(const [p,v] of Object.entries(pre.inputs)){const b=fs.readFileSync(p);need(b.length===v.bytes&&sha(b)===v.sha256,'Frozen input changed '+p);guard();}}
function write(name,value){const b=Buffer.from(JSON.stringify(value,null,2)+'\n');const existing=fs.readdirSync(out).reduce((n,p)=>n+fs.statSync(out+p).size,0);
  need(b.length<=limits.reportBytes&&existing+b.length<=limits.totalOutputBytes-16384,'Output ceiling');fs.writeFileSync(out+name,b,{flag:'wx'});}
need(process.argv[2]==='--run','Explicit reviewed source-preparation run required');
const review=JSON.parse(fs.readFileSync(out+'source-review.json'));
need(review.independentSourceReviewed===true&&review.rootSourceReviewed===true&&review.admitSingleCorrespondence===true&&review.preflightSha256===sha(preBytes),'Exact source review and separate root admission required');
need(!fs.existsSync(out+'STARTED.json'),'Two-seed report already consumed');verify();write('STARTED.json',{utc:new Date().toISOString(),pid:process.pid,limits});
try{run();}catch(error){write('failure.json',{utc:new Date().toISOString(),error:error.stack,activeSeed,pairs,resources:resources(),automaticRetry:false});throw error;}

function run(){
  const scope=contract.sourcePreparationSubstep;
  need(JSON.stringify(scope.seedIds)==='["nape-03","nape-04"]'&&limits.seedQueries===2,'Exact two-seed scope');
  const spec=JSON.parse(fs.readFileSync(contract.source)),allow=spec.scalpAllowlist;
  need(allow.rootSeedMaxDistanceM===.025&&allow.rootOffsetM===.0006,'Frozen root gate');
  const seeds=scope.seedIds.map(id=>{const g=spec.guides.find(g=>g.id===id);need(g&&g.rootSeed.length===3&&g.rootSeed.every(Number.isFinite),'Original seed '+id);return {id,seed:new Vector3(...g.rootSeed)};});
  const glb=readGlb(contract.bodyGlb),j=glb.json,p=j.meshes[0].primitives[0];
  const raw=fs.readFileSync(contract.bodyPositions);need(raw.length===limits.bodyVertices*12,'Frozen position correspondence');
  const points=Array.from({length:limits.bodyVertices},(_,i)=>{const v=new Vector3(raw.readFloatLE(i*12),raw.readFloatLE(i*12+4),raw.readFloatLE(i*12+8));need(v.toArray().every(Number.isFinite),'Nonfinite body source');return v;});
  const ids=readAccessor(glb,p.indices).data,ji=readAccessor(glb,p.attributes.JOINTS_0).data,jw=readAccessor(glb,p.attributes.WEIGHTS_0).data;
  need(ids.length%3===0&&ids.length/3<=limits.bodyTriangles&&ji.length===points.length*4&&jw.length===points.length*4,'Topology/resource correspondence');
  const head=j.skins[0].joints.indexOf(j.nodes.findIndex(n=>n.name==='head'));need(head===44,'Head joint correspondence');
  const headWeight=i=>{let total=0;for(let k=0;k<4;k++)if(ji[i*4+k]===head)total+=jw[i*4+k];return total;};
  function regions(p){const r=[];if(p.y>=allow.topMinY)r.push('top');
    if(p.y>=allow.templeMinY&&Math.abs(p.x)>=allow.templeMinAbsX&&Math.abs(p.x)<=allow.templeMaxAbsX&&p.z<=allow.templeMaxZ)r.push('temple');
    if(p.y>=allow.rearMinY&&p.z<=allow.rearMaxZ&&Math.abs(p.x)<=allow.rearMaxAbsX)r.push('rear');return r;}
  const scalp=[];
  for(let i=0;i<ids.length;i+=3){if(i%768===0)guard();const vertices=Array.from(ids.slice(i,i+3));need(vertices.every(v=>v<points.length),'Index correspondence');
    const weights=vertices.map(headWeight),branches=vertices.map(v=>regions(points[v]));
    if(!weights.every(w=>w>=.999)||!branches.every(r=>r.length))continue;
    const corners=vertices.map(v=>points[v]),triangle=new Triangle(...corners),normal=triangle.getNormal(new Vector3()),centre=triangle.getMidpoint(new Vector3());
    const outwardDot=normal.dot(centre.clone().sub(new Vector3(0,1.50,.04)).normalize());
    if(outwardDot>.1)scalp.push({triangle,normal,outwardDot,triangleIndex:i/3,vertices,weights,branches,corners});
  }
  need(scalp.length>100&&scalp.length<=limits.bodyTriangles,'Frozen eligible surface context');
  const results=[];
  for(const {id,seed} of seeds){activeSeed=id;let best=null,d2=Infinity;
    for(const t of scalp){need(++pairs<=limits.nearestPairs,'Nearest-pair ceiling');if(pairs%128===0)guard();
      const point=t.triangle.closestPointToPoint(seed,new Vector3()),d=point.distanceToSquared(seed);
      need(Number.isFinite(d),'Nonfinite correspondence');if(d<d2){d2=d;best={...t,point};}}
    need(best,'No eligible triangle');
    const bary=best.triangle.getBarycoord(best.point,new Vector3());need(bary.toArray().every(Number.isFinite)&&Math.min(...bary.toArray())>=-1e-6,'Invalid barycentric witness');
    results.push({guide:id,originalSeed:seed.toArray(),originalSeedCoordinateBranches:regions(seed),originalSeedDistanceM:Math.sqrt(d2),
      originalSeedMaxDistanceM:allow.rootSeedMaxDistanceM,originalSeedPass:d2<allow.rootSeedMaxDistanceM**2,sourceOutwardOffsetM:allow.rootOffsetM,outwardOffsetApplied:false,
      nearestEligible:{triangleIndex:best.triangleIndex,vertices:best.vertices,cornerPositions:best.corners.map(v=>v.toArray()),cornerHeadWeights:best.weights,cornerCoordinateBranches:best.branches,
        bary:bary.toArray(),surfacePoint:best.point.toArray(),normal:best.normal.toArray(),outwardDot:best.outwardDot},
      rootAccepted:false,proposedNewSeed:null,note:'Closest eligible triangle is source evidence only. An out-of-range original seed remains rejected; no automatic replacement root or altered threshold.'});
  }
  guard();verify();write('correspondence.json',{utc:new Date().toISOString(),preflightSha256:sha(preBytes),eligibleTriangles:scalp.length,pairs,results,resources:resources(),
    originalSeedMutation:false,guideControlsChanged:false,curveEvaluations:0,samplerExecution:false,compilerExecution:false,automaticAuthoringAdmission:false,appearanceAccepted:false});
  write('COMPLETE.json',{utc:new Date().toISOString(),sourceCorrespondenceOnly:true,reportSha256:sha(fs.readFileSync(out+'correspondence.json')),automaticRetry:false});
  console.log(JSON.stringify({complete:true,sourceCorrespondenceOnly:true,pairs,originalSeedResults:results.map(r=>({guide:r.guide,distanceM:r.originalSeedDistanceM,pass:r.originalSeedPass})),resources:resources()}));
}
