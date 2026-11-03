// Finite source-only diagnosis of crown-sweep-01. Never imports or invokes the hair compiler.
import fs from 'node:fs';
import crypto from 'node:crypto';
import {Vector3, Triangle, Line3, CatmullRomCurve3} from 'three';
import {readGlb, readAccessor} from '../lut-bake/glb.mjs';

const out='docs/evidence/ember-2026-10-31-hair-sampler-check/';
const prior='docs/evidence/ember-2026-10-31-hair-v001/';
const source='tools/ember-hair/ember-waves-v001.json';
const limits={curveEvaluations:20000,cpuSeconds:10,wallSeconds:15,rssBytes:512*1024**2,outputBytes:2*1024**2,maxSegments:40,toleranceM:.00035};
const start=process.cpuUsage(),wall=performance.now();let evaluations=0,requests=0,outputBytes=0;
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const need=(ok,message)=>{if(!ok)throw Error(message);};
const guard=()=>{const cpu=process.cpuUsage(start);need((cpu.user+cpu.system)/1e6<=limits.cpuSeconds&&
  (performance.now()-wall)/1000<=limits.wallSeconds&&process.memoryUsage().rss<=limits.rssBytes,'Resource ceiling');};
const write=(name,value)=>{const b=Buffer.from(JSON.stringify(value,null,2)+'\n');outputBytes+=b.length;
  need(outputBytes<=limits.outputBytes,'Report output ceiling');fs.writeFileSync(out+name,b,{flag:'wx'});};
const frozen=JSON.parse(fs.readFileSync(prior+'preflight.json'));
const paths=[...Object.keys(frozen.inputs),prior+'preflight.json',prior+'failure.json',prior+'process-result.json',
  import.meta.filename,'tools/ember-hair/sampler-check-run.py'];
const manifest=()=>Object.fromEntries(paths.map(p=>[p,{bytes:fs.statSync(p).size,sha256:sha(fs.readFileSync(p))}]));
const inputs=manifest();
for(const [p,v]of Object.entries(frozen.inputs))need(inputs[p].sha256===v.sha256,'Frozen v001 input changed '+p);
const spec=JSON.parse(fs.readFileSync(source)),guide=spec.guides[0];
need(guide.id==='crown-sweep-01'&&guide.surfaceControls===null,'Only unchanged first guide admitted');
need(guide.ribbons.length===3&&guide.ribbons.map(r=>r.endFraction).join(',')==='.97,1,.94'.replaceAll('.97','0.97').replaceAll('.94','0.94'),'Endpoint fractions changed');
const failure=JSON.parse(fs.readFileSync(prior+'failure.json'));
const match=failure.error.match(/Chord error exceeds fixed limit: crown-sweep-01 ([\d.e+-]+)/);
need(match,'Expected exact sampling failure missing');const witnessedError=Number(match[1]);

if(process.argv[2]==='--preflight'){
  need(!fs.existsSync(out+'STARTED.json'),'Diagnostic already consumed');
  write('preflight.json',{inputs,limits,guide:guide.id,endpointFractions:guide.ribbons.map(r=>r.endFraction),
    scope:'Only root reconstruction and curve sampling. No mesh, other guide, renderer, image or compiler invocation.',
    method:'One deterministic worst-interval midpoint bisection, initialized at control knots and scored at quarter/mid/three-quarter points. Final seven-eighth-grid interior samples include held-out eighth points.',
    expectedUniform40MidpointErrorM:witnessedError});
  console.log(JSON.stringify({preflight:true,guide:guide.id,inputs:Object.keys(inputs).length,limits}));
}else if(process.argv[2]==='--run'){
  const pre=JSON.parse(fs.readFileSync(out+'preflight.json')),review=JSON.parse(fs.readFileSync(out+'source-review.json'));
  need(JSON.stringify(inputs)===JSON.stringify(pre.inputs),'Diagnostic source changed after preflight');
  need(review.admitSingleCheck===true&&review.preflightSha256===sha(fs.readFileSync(out+'preflight.json')),'Exact independent/root review required');
  write('STARTED.json',{utc:new Date().toISOString(),pid:process.pid,limits});
  try{run();}catch(error){write('failure.json',{utc:new Date().toISOString(),error:error.stack,evaluations,requests,
    resources:resources(),automaticRetry:false});throw error;}
}else throw Error('Use --preflight or --run');

function resources(){const c=process.cpuUsage(start);return {cpuSeconds:(c.user+c.system)/1e6,observedRssBytes:process.memoryUsage().rss,wallSeconds:(performance.now()-wall)/1000};}

function run(){
  const glbPath='docs/evidence/ember-2026-10-31-eye-bridge/candidate.glb';need(fs.statSync(glbPath).size<16*1024**2,'Input size ceiling');
  const glb=readGlb(glbPath),j=glb.json,p=j.meshes[0].primitives[0],a=p.attributes;
  const raw=fs.readFileSync('docs/evidence/ember-2026-10-31-local-feature-v001/positions.f32');
  need(raw.length===14517*12,'Frozen body correspondence');
  const points=Array.from({length:14517},(_,i)=>new Vector3(raw.readFloatLE(i*12),raw.readFloatLE(i*12+4),raw.readFloatLE(i*12+8)));
  const ids=readAccessor(glb,p.indices).data,ji=readAccessor(glb,a.JOINTS_0).data,jw=readAccessor(glb,a.WEIGHTS_0).data;
  const headNode=j.nodes.findIndex(n=>n.name==='head'),headJoint=j.skins[0].joints.indexOf(headNode);need(headJoint===44,'Head joint correspondence');
  const allow=spec.scalpAllowlist;
  // Reproduce v001's exact allowed triangle order and strict-less-than nearest-point tie handling.
  const headWeight=i=>{let s=0;for(let k=0;k<4;k++)if(ji[i*4+k]===headJoint)s+=jw[i*4+k];return s;};
  const scalpPoint=p=>p.y>=allow.topMinY||
    (p.y>=allow.templeMinY&&Math.abs(p.x)>=allow.templeMinAbsX&&Math.abs(p.x)<=allow.templeMaxAbsX&&p.z<=allow.templeMaxZ)||
    (p.y>=allow.rearMinY&&p.z<=allow.rearMaxZ&&Math.abs(p.x)<=allow.rearMaxAbsX);
  const seed=new Vector3().fromArray(guide.rootSeed);let best=null,d2=Infinity,eligible=0;
  for(let i=0;i<ids.length;i+=3){if(i%768===0)guard();const vi=Array.from(ids.slice(i,i+3));
    if(!vi.every(k=>headWeight(k)>=.999&&scalpPoint(points[k])))continue;
    const triangle=new Triangle(...vi.map(k=>points[k])),normal=triangle.getNormal(new Vector3()),centre=triangle.getMidpoint(new Vector3());
    if(normal.dot(centre.clone().sub(new Vector3(0,1.50,.04)).normalize())<=.1)continue;
    eligible++;const point=triangle.closestPointToPoint(seed,new Vector3()),distance=point.distanceToSquared(seed);
    if(distance<d2){d2=distance;best={triangle,normal,point,vertices:vi,triangleIndex:i/3};}
  }
  need(best&&d2<allow.rootSeedMaxDistanceM**2,'First root outside allowed scalp');
  const bary=best.triangle.getBarycoord(best.point,new Vector3()),root=best.point.clone().addScaledVector(best.normal,allow.rootOffsetM);
  const controls=guide.points.map(v=>new Vector3().fromArray(v));controls[0]=root;
  const curve=new CatmullRomCurve3(controls,false,'centripetal'),cache=new Map();
  function at(q){requests++;need(Number.isFinite(q)&&q>=0&&q<=1,'Curve parameter outside range');
    if(cache.has(q))return cache.get(q);evaluations++;need(evaluations<=limits.curveEvaluations,'Curve evaluation ceiling');guard();
    const v=curve.getPoint(q);need(v.toArray().every(Number.isFinite),'Non-finite curve');cache.set(q,v);return v;}
  function interval(lo,hi,fractions){
    const chord=new Line3(at(lo),at(hi));let maxErrorM=-1,worst=null;
    for(const fraction of fractions){const q=lo+(hi-lo)*fraction,point=at(q),nearest=chord.closestPointToPoint(point,true,new Vector3()),error=point.distanceTo(nearest);
      if(error>maxErrorM){maxErrorM=error;worst={q,fraction,point:point.toArray(),chordPoint:nearest.toArray()};}}
    return {lo,hi,maxErrorM,worst};
  }
  const probes=[.125,.25,.375,.5,.625,.75,.875],scoreProbes=[.25,.5,.75];
  function measure(parameters,probes){const intervals=[];let worst=null;
    for(let i=0;i<parameters.length-1;i++){const value=interval(parameters[i],parameters[i+1],probes);intervals.push(value);
      if(worst===null||value.maxErrorM>worst.maxErrorM)worst={index:i,...value};}
    return {segments:parameters.length-1,maxErrorM:worst.maxErrorM,worst,parameters,intervals};
  }
  const uniform=[];
  for(const ribbon of guide.ribbons)for(const n of [32,40]){
    const end=ribbon.endFraction,parameters=Array.from({length:n+1},(_,i)=>end*i/n);
    uniform.push({endFraction:end,midpoint:measure(parameters,[.5]),validation:measure(parameters,probes)});
  }
  const reproduced=Math.max(...uniform.filter(v=>v.midpoint.segments===40).map(v=>v.midpoint.maxErrorM));
  need(Math.abs(reproduced-witnessedError)<1e-12,'Exact v001 first-guide result did not reproduce');
  const adaptive=[];
  for(const ribbon of guide.ribbons){
    const end=ribbon.endFraction,knots=[0];for(let k=1;k<controls.length-1;k++){const q=k/(controls.length-1);if(q<end)knots.push(q);}knots.push(end);
    const intervals=knots.slice(0,-1).map((lo,i)=>interval(lo,knots[i+1],scoreProbes));let subdivisions=0;
    for(;;){guard();let wi=0;for(let k=1;k<intervals.length;k++)if(intervals[k].maxErrorM>intervals[wi].maxErrorM)wi=k;
      if(intervals[wi].maxErrorM<=limits.toleranceM||intervals.length>=limits.maxSegments)break;
      const {lo,hi}=intervals[wi],mid=(lo+hi)/2;intervals.splice(wi,1,interval(lo,mid,scoreProbes),interval(mid,hi,scoreProbes));subdivisions++;
    }
    const parameters=[intervals[0].lo,...intervals.map(i=>i.hi)];
    const validation=measure(parameters,probes),selectedMaxErrorM=Math.max(...intervals.map(i=>i.maxErrorM));
    adaptive.push({endFraction:end,segments:intervals.length,subdivisions,selectedMaxErrorM,validation,
      sampledToleranceMet:validation.maxErrorM<=limits.toleranceM,continuousBoundCertified:false});
  }
  guard();need(JSON.stringify(inputs)===JSON.stringify(manifest()),'Input modified during source-only check');
  write('report.json',{utc:new Date().toISOString(),guide:guide.id,inputs,limits,eligibleScalpTriangles:eligible,
    anchor:{headJoint,triangleIndex:best.triangleIndex,vertices:best.vertices,bary:bary.toArray(),skinPoint:best.point.toArray(),normal:best.normal.toArray(),outwardOffsetM:allow.rootOffsetM,resolvedRoot:root.toArray(),seedDistanceM:Math.sqrt(d2)},
    authoredControls:guide.points,resolvedControls:controls.map(p=>p.toArray()),endpointFractions:guide.ribbons.map(r=>r.endFraction),
    reproducedUniform40MidpointErrorM:reproduced,witnessedFailureErrorM:witnessedError,
    uniform,adaptive,method:'Worst-interval midpoint bisection from control knots; score quarter/mid/three-quarter; ties choose earliest interval; validate seven fixed interior samples; no post-validation refinement.',
    curveChanged:false,endpointsChanged:false,evaluations,requests,resources:resources(),
    result:adaptive.every(a=>a.sampledToleranceMet)?'All three endpoint fractions meet the sampled tolerance within40 segments':'At least one endpoint fraction does not meet the sampled tolerance within40 segments',
    limitsOfInference:['Sampled validation is not a continuous error certificate.','Only first-guide centre curve was checked, not ribbon surfaces, other guides, frames, clearance or appearance.','A useful result does not admit another compilation automatically.']});
  write('COMPLETE.json',{utc:new Date().toISOString(),sourceOnly:true,evaluations,reportSha256:sha(fs.readFileSync(out+'report.json')),automaticBuildAdmission:false});
  console.log(JSON.stringify({sourceOnlyComplete:true,evaluations,reproducedUniform40MidpointErrorM:reproduced,
    adaptive:adaptive.map(a=>({endFraction:a.endFraction,segments:a.segments,maxSampledErrorM:a.validation.maxErrorM,meets:a.sampledToleranceMet})),resources:resources()}));
}
