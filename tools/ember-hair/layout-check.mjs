// One admitted source-only check of the unresolved guides. Never imports a compiler or first-guide job.
import fs from 'node:fs';
import crypto from 'node:crypto';
import {Vector3,Triangle,Line3,CatmullRomCurve3} from 'three';
import {readGlb,readAccessor} from '../lut-bake/glb.mjs';

const out='docs/evidence/ember-2026-10-31-hair-layout-check/';
const contract=JSON.parse(fs.readFileSync(out+'contract.json'));
const limits=contract.limits,method=contract.method,start=process.cpuUsage(),wall=performance.now();
let evaluations=0,requests=0,activeGuide=null,activeRibbon=null;const results=[];
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const need=(ok,message)=>{if(!ok)throw Error(message);};
function resources(){const c=process.cpuUsage(start);return {cpuSeconds:(c.user+c.system)/1e6,observedRssBytes:process.memoryUsage().rss,wallSeconds:(performance.now()-wall)/1000};}
function guard(){const r=resources();need(r.cpuSeconds<=limits.cpuSeconds&&r.wallSeconds<=limits.wallSeconds&&r.observedRssBytes<=limits.rssBytes,'Resource ceiling');}
function write(name,value){const b=Buffer.from(JSON.stringify(value,null,2)+'\n');
  const existing=fs.readdirSync(out).reduce((n,p)=>n+fs.statSync(out+p).size,0);
  need(b.length<=limits.reportBytes&&existing+b.length<=limits.totalOutputBytes,'Output ceiling');
  fs.writeFileSync(out+name,b,{flag:'wx'});}
const preBytes=fs.readFileSync(out+'preflight.json'),pre=JSON.parse(preBytes);
function verifyInputs(){for(const [p,v] of Object.entries(pre.inputs)){const b=fs.readFileSync(p);
  need(b.length===v.bytes&&sha(b)===v.sha256,'Frozen input changed '+p);guard();}}
need(process.argv[2]==='--run','Only explicitly admitted --run is supported');
need(!fs.existsSync(out+'STARTED.json'),'This check is consumed');
const review=JSON.parse(fs.readFileSync(out+'source-review.json'));
need(review.admitSingleCheck===true&&review.preflightSha256===sha(preBytes),'Exact independent/root admission required');
verifyInputs();write('STARTED.json',{utc:new Date().toISOString(),pid:process.pid,limits});
try{run();}catch(error){write('failure.json',{utc:new Date().toISOString(),error:error.stack,activeGuide,activeRibbon,
  completedGuides:results,requests,evaluations,resources:resources(),automaticRetry:false});throw error;}

function run(){
  const spec=JSON.parse(fs.readFileSync(contract.source));
  need(spec.guides.length===40&&spec.guides[0].id==='crown-sweep-01','Guide layout correspondence');
  // Exclude the consumed guide BEFORE root attachment, curve construction or any evaluator call.
  const selected=spec.guides.slice(1);
  need(selected.length===39&&new Set(selected.map(g=>g.id)).size===39&&
    JSON.stringify(selected.map(g=>g.id))===JSON.stringify(contract.selectedGuideIds)&&
    selected.every(g=>g.id!==contract.excludedGuide)&&selected.reduce((n,g)=>n+g.ribbons.length,0)===117,'Exact unresolved-guide selection');
  need(method.thresholdM===.00035&&method.maxSegments===40&&!method.postValidationRefinement,'Fixed sampler limits');
  need(JSON.stringify(method.allocationProbes)==='[0.125,0.25,0.375,0.5,0.625,0.75,0.875]'&&
    JSON.stringify(method.heldOutProbes)==='[0.0625,0.1875,0.3125,0.4375,0.5625,0.6875,0.8125,0.9375]','Fixed probes');
  const first=JSON.parse(fs.readFileSync(contract.reuse.firstGuideReport));
  need(first.guide===contract.excludedGuide&&first.curveChanged===false,'Frozen first-guide witness');
  const failure=JSON.parse(fs.readFileSync(contract.reuse.failedBuild));
  need(failure.error.includes('Guide crown-sweep-02 ribbon 1:'),'Frozen v002 failure');
  const glbPath='docs/evidence/ember-2026-10-31-eye-bridge/candidate.glb';
  need(fs.statSync(glbPath).size<16*1024**2,'Input size ceiling');
  const glb=readGlb(glbPath),j=glb.json,p=j.meshes[0].primitives[0],a=p.attributes;
  const raw=fs.readFileSync('docs/evidence/ember-2026-10-31-local-feature-v001/positions.f32');
  need(raw.length===14517*12,'Frozen body correspondence');
  const points=Array.from({length:14517},(_,i)=>new Vector3(raw.readFloatLE(i*12),raw.readFloatLE(i*12+4),raw.readFloatLE(i*12+8)));
  const ids=readAccessor(glb,p.indices).data,ji=readAccessor(glb,a.JOINTS_0).data,jw=readAccessor(glb,a.WEIGHTS_0).data;
  const headNode=j.nodes.findIndex(n=>n.name==='head'),headJoint=j.skins[0].joints.indexOf(headNode);need(headJoint===44,'Head joint correspondence');
  const allow=spec.scalpAllowlist;
  const headWeight=i=>{let s=0;for(let k=0;k<4;k++)if(ji[i*4+k]===headJoint)s+=jw[i*4+k];return s;};
  const scalpPoint=p=>p.y>=allow.topMinY||
    (p.y>=allow.templeMinY&&Math.abs(p.x)>=allow.templeMinAbsX&&Math.abs(p.x)<=allow.templeMaxAbsX&&p.z<=allow.templeMaxZ)||
    (p.y>=allow.rearMinY&&p.z<=allow.rearMaxZ&&Math.abs(p.x)<=allow.rearMaxAbsX);
  const scalp=[];
  for(let i=0;i<ids.length;i+=3){if(i%768===0)guard();const vi=Array.from(ids.slice(i,i+3));
    if(!vi.every(k=>headWeight(k)>=.999&&scalpPoint(points[k])))continue;
    const triangle=new Triangle(...vi.map(k=>points[k])),normal=triangle.getNormal(new Vector3()),centre=triangle.getMidpoint(new Vector3());
    if(normal.dot(centre.clone().sub(new Vector3(0,1.50,.04)).normalize())>.1)scalp.push({triangle,normal,vertices:vi,triangleIndex:i/3});
  }
  need(scalp.length>100,'Scalp allowlist unexpectedly empty');
  function anchor(seed,offsetM=allow.rootOffsetM,maxDistanceM=allow.rootSeedMaxDistanceM){
    let best=null,d2=Infinity;
    for(let i=0;i<scalp.length;i++){if(i%128===0)guard();const t=scalp[i],point=t.triangle.closestPointToPoint(seed,new Vector3()),d=point.distanceToSquared(seed);
      if(d<d2){d2=d;best={...t,point};}}
    need(best&&d2<maxDistanceM**2,'Authored seed outside eligible scalp '+activeGuide);
    const bary=best.triangle.getBarycoord(best.point,new Vector3());need(Math.min(...bary.toArray())>=-1e-6,'Invalid anchor barycentrics');
    const position=best.point.clone().addScaledVector(best.normal,offsetM);
    return {position,record:{vertices:best.vertices,bary:bary.toArray(),normal:best.normal.toArray(),offsetM,
      triangleIndex:best.triangleIndex,seedDistanceM:Math.sqrt(d2),position:position.toArray()}};
  }
  for(const g of selected){
    guard();activeGuide=g.id;activeRibbon=null;
    need(g.points.length>=8&&g.points.length<=12&&g.points.flat().every(Number.isFinite)&&g.ribbons.length===3,'Guide source fields');
    const controls=g.points.map(a=>new Vector3().fromArray(a)),root=anchor(new Vector3().fromArray(g.rootSeed)),inner=[];
    controls[0]=root.position;
    if(g.surfaceControls){const cfg=g.surfaceControls;for(const ci of cfg.indices){
      const resolved=anchor(controls[ci],cfg.offsetM,cfg.maxSeedDistanceM);controls[ci]=resolved.position;inner.push({controlIndex:ci,...resolved.record});}}
    const curve=new CatmullRomCurve3(controls,false,'centripetal'),ribbons=[];
    for(let ri=0;ri<g.ribbons.length;ri++){
      activeRibbon=ri;const end=g.ribbons[ri].endFraction??[.97,1,.94][ri];
      ribbons.push({ribbon:ri,endFraction:end,...sample(curve,controls.length,end)});
    }
    results.push({guide:g.id,root:root.record,innerControlAnchors:inner,resolvedControls:controls.map(v=>v.toArray()),ribbons});
  }
  guard();verifyInputs();const ribbons=results.flatMap(g=>g.ribbons.map(r=>({guide:g.guide,...r})));
  const summary={guides:results.length,ribbons:ribbons.length,allocationPass:ribbons.filter(r=>r.allocationPass).length,
    heldOutPass:ribbons.filter(r=>r.heldOutPass).length,sampledPass:ribbons.filter(r=>r.sampledPass).length,
    failures:ribbons.filter(r=>!r.sampledPass).map(r=>({guide:r.guide,ribbon:r.ribbon,segments:r.segments,
      allocationErrorM:r.allocationMaxErrorM,heldOutErrorM:r.heldOutMaxErrorM})),
    maxAllocationErrorM:Math.max(...ribbons.map(r=>r.allocationMaxErrorM)),maxHeldOutErrorM:Math.max(...ribbons.map(r=>r.heldOutMaxErrorM))};
  write('report.json',{utc:new Date().toISOString(),preflightSha256:sha(preBytes),method,limits,summary,results,
    reusedFirstGuide:{path:contract.reuse.firstGuideReport,sha256:sha(fs.readFileSync(contract.reuse.firstGuideReport)),
      guide:first.guide,priorMethod:first.method,priorResults:first.adaptive.map(r=>({endFraction:r.endFraction,segments:r.segments,maxErrorM:r.validation.maxErrorM})),
      evaluatedThisRun:false,newMethodQualified:false},savedFailure:{path:contract.reuse.failedBuild,sha256:sha(fs.readFileSync(contract.reuse.failedBuild))},
    requests,evaluations,resources:resources(),continuousBoundCertified:false,fullLayoutNewMethodQualified:false,
    geometryGenerated:false,appearanceAccepted:false,limitsOfInference:contract.resultLimits});
  write('COMPLETE.json',{utc:new Date().toISOString(),sourceOnly:true,reportSha256:sha(fs.readFileSync(out+'report.json')),
    automaticBuildAdmission:false,automaticRetry:false});
  console.log(JSON.stringify({complete:true,sourceOnly:true,summary,evaluations,resources:resources()}));
}

function sample(curve,controlCount,end){
  need(Number.isFinite(end)&&end>0&&end<=1,'Ribbon endpoint');let localEvaluations=0;const cache=new Map();
  function at(q){requests++;need(Number.isFinite(q)&&q>=0&&q<=end,'Curve parameter');
    if(cache.has(q))return cache.get(q);
    need(++localEvaluations<=limits.evaluationsPerRibbon&&++evaluations<=limits.evaluationsTotal,'Sampling evaluation ceiling');guard();
    const point=curve.getPoint(q);need(point.toArray().every(Number.isFinite),'Non-finite curve');cache.set(q,point);return point;
  }
  function interval(lo,hi,probes){const chord=new Line3(at(lo),at(hi));let maxErrorM=-1,worst=null;
    for(const fraction of probes){const q=lo+(hi-lo)*fraction,point=at(q),nearest=chord.closestPointToPoint(point,true,new Vector3()),error=point.distanceTo(nearest);
      need(Number.isFinite(error),'Non-finite error');if(error>maxErrorM){maxErrorM=error;worst={q,fraction,point:point.toArray(),chordPoint:nearest.toArray()};}}
    return {lo,hi,maxErrorM,worst};}
  const knots=[0];for(let k=1;k<controlCount-1;k++){const q=k/(controlCount-1);if(q<end)knots.push(q);}knots.push(end);
  const intervals=knots.slice(0,-1).map((lo,i)=>interval(lo,knots[i+1],method.allocationProbes));let subdivisions=0;
  for(;;){guard();let wi=0;for(let i=1;i<intervals.length;i++)if(intervals[i].maxErrorM>intervals[wi].maxErrorM)wi=i;
    if(intervals[wi].maxErrorM<=method.thresholdM||intervals.length>=method.maxSegments)break;
    const {lo,hi}=intervals[wi],mid=(lo+hi)/2;intervals.splice(wi,1,interval(lo,mid,method.allocationProbes),interval(mid,hi,method.allocationProbes));subdivisions++;
  }
  const parameters=[intervals[0].lo,...intervals.map(i=>i.hi)];
  need(parameters[0]===0&&parameters.at(-1)===end&&parameters.length-1<=40&&parameters.every((q,i)=>i===0||q>parameters[i-1]),'Invalid parameters');
  let allocationWorst=null,heldOutWorst=null;
  for(let i=0;i<intervals.length;i++){
    if(allocationWorst===null||intervals[i].maxErrorM>allocationWorst.maxErrorM)allocationWorst={index:i,...intervals[i]};
    const v=interval(parameters[i],parameters[i+1],method.heldOutProbes);
    if(heldOutWorst===null||v.maxErrorM>heldOutWorst.maxErrorM)heldOutWorst={index:i,...v};
  }
  const allocationPass=allocationWorst.maxErrorM<=method.thresholdM,heldOutPass=heldOutWorst.maxErrorM<=method.thresholdM;
  return {segments:intervals.length,subdivisions,parameters,evaluations:localEvaluations,allocationPass,heldOutPass,
    sampledPass:allocationPass&&heldOutPass,allocationMaxErrorM:allocationWorst.maxErrorM,heldOutMaxErrorM:heldOutWorst.maxErrorM,
    allocationWorst,heldOutWorst,continuousBoundCertified:false};
}
