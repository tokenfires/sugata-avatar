// Frozen construction diagram only. Never imports a compiler, sampler or browser transport.
import fs from 'node:fs';
import crypto from 'node:crypto';
import {Vector3, Triangle, CatmullRomCurve3} from 'three';
import {readGlb, readAccessor} from '../lut-bake/glb.mjs';

const out='docs/evidence/ember-2026-10-31-hair-visual-review/';
const contract=JSON.parse(fs.readFileSync(out+'contract.json'));
const limits=contract.limits,clock=performance.now(),cpu=process.cpuUsage();
let evaluations=0;
const need=(ok,message)=>{if(!ok)throw Error(message);};
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const preBytes=fs.readFileSync(out+'preflight.json'),pre=JSON.parse(preBytes);
function resources(){const c=process.cpuUsage(cpu);return {cpuSeconds:(c.user+c.system)/1e6,wallSeconds:(performance.now()-clock)/1000,observedRssBytes:process.memoryUsage().rss};}
function guard(){const r=resources();need(r.cpuSeconds<=limits.cpuSeconds&&r.wallSeconds<=limits.wallSeconds&&r.observedRssBytes<=limits.rssBytes,'Resource ceiling');}
function verify(){for(const [path,v] of Object.entries(pre.inputs)){const b=fs.readFileSync(path);need(b.length===v.bytes&&sha(b)===v.sha256,'Frozen input changed '+path);guard();}}
function write(name,data,maxBytes=limits.reportBytes){const b=Buffer.from(typeof data==='string'?data:JSON.stringify(data,null,2)+'\n');
  const current=fs.readdirSync(out).reduce((n,p)=>n+fs.statSync(out+p).size,0);
  need(b.length<=maxBytes&&current+b.length<=limits.totalOutputBytes-16384,'Output ceiling');fs.writeFileSync(out+name,b,{flag:'wx'});}
need(process.argv[2]==='--run','Explicit admitted --run required');
const review=JSON.parse(fs.readFileSync(out+'source-review.json'));
need(review.independentSourceReviewed===true&&review.rootSourceReviewed===true&&review.admitSingleVisual===true&&review.preflightSha256===sha(preBytes),'Exact independent/root review and separate admission required');
need(!fs.existsSync(out+'STARTED.json'),'Visual generation already consumed');
verify();write('STARTED.json',{utc:new Date().toISOString(),pid:process.pid,limits});
try {run();} catch(error) {write('failure.json',{utc:new Date().toISOString(),error:error.stack,evaluations,resources:resources(),automaticRetry:false});throw error;}

function run(){
  need(JSON.stringify(contract.selectedGuideIds)==='["crown-sweep-02","crown-sweep-04","side-heavy-01","occipital-02","occipital-03","occipital-04","occipital-05"]','Exact seven-guide scope');
  need(JSON.stringify(contract.unresolvedSeedIds)==='["nape-03","nape-04"]','Exact seed scope');
  const saved=JSON.parse(fs.readFileSync(contract.savedLayout)),spec=JSON.parse(fs.readFileSync(contract.guideSource));
  need(saved.activeGuide==='nape-03'&&saved.completedGuides.length===37,'Saved partial result correspondence');
  const guides=contract.selectedGuideIds.map(id=>{
    const g=saved.completedGuides.find(g=>g.guide===id),source=spec.guides.find(g=>g.id===id);
    need(g&&source&&g.resolvedControls.length===source.points.length&&g.resolvedControls.length>=8&&g.resolvedControls.length<=12,'Guide correspondence '+id);
    need(g.resolvedControls.flat().every(Number.isFinite)&&g.ribbons.length===3&&g.ribbons.some(r=>!r.sampledPass),'Saved selected guide '+id);
    // These are the saved resolved controls. No root projection, curve modification or sampler call.
    const points=g.resolvedControls.map(p=>new Vector3(...p)),curve=new CatmullRomCurve3(points,false,'centripetal');
    const at=q=>{guard();need(++evaluations<=limits.curveEvaluations&&q>=0&&q<=1,'Display evaluation ceiling/parameter');const p=curve.getPoint(q);need(p.toArray().every(Number.isFinite),'Nonfinite display curve');return p;};
    const pieces=[];
    for(let i=0;i<points.length-1;i++){
      const lo=i/(points.length-1),hi=(i+1)/(points.length-1);
      const p0=at(lo),p1=at(hi),u=at(lo+(hi-lo)/3),v=at(lo+2*(hi-lo)/3);
      // A=2*b1+b2, B=b1+2*b2. Algebraic cubic conversion, not a tessellation.
      const a=u.clone().multiplyScalar(27).addScaledVector(p0,-8).sub(p1).multiplyScalar(1/6);
      const b=v.clone().multiplyScalar(27).sub(p0).addScaledVector(p1,-8).multiplyScalar(1/6);
      const b1=a.clone().multiplyScalar(2).sub(b).multiplyScalar(1/3);
      const b2=b.clone().multiplyScalar(2).sub(a).multiplyScalar(1/3);
      need([...b1.toArray(),...b2.toArray()].every(Number.isFinite),'Nonfinite cubic');pieces.push([p0,b1,b2,p1]);
    }
    const endpoints=g.ribbons.map((r,i)=>{need(r.endFraction===(source.ribbons[i].endFraction??[.97,1,.94][i]),'Frozen endpoint');return {ribbon:i,q:r.endFraction,point:at(r.endFraction)};});
    return {...g,points,pieces,endpoints};
  });
  need(evaluations<=329,'Static display evaluation bound');
  const seeds=contract.unresolvedSeedIds.map(id=>{const g=spec.guides.find(g=>g.id===id);need(g&&g.rootSeed.length===3&&g.rootSeed.every(Number.isFinite),'Unresolved seed');return {id,position:g.rootSeed};});
  const glb=readGlb(contract.bodyGlb),j=glb.json,p=j.meshes[0].primitives[0];
  const raw=fs.readFileSync(contract.bodyPositions);need(raw.length===limits.existingBodyVertices*12,'Frozen body correspondence');
  const body=Array.from({length:limits.existingBodyVertices},(_,i)=>{const v=new Vector3(raw.readFloatLE(i*12),raw.readFloatLE(i*12+4),raw.readFloatLE(i*12+8));need(v.toArray().every(Number.isFinite),'Nonfinite body');return v;});
  const ids=readAccessor(glb,p.indices).data,ji=readAccessor(glb,p.attributes.JOINTS_0).data,jw=readAccessor(glb,p.attributes.WEIGHTS_0).data;
  need(ids.length%3===0&&ids.length/3<=limits.existingBodyTriangles&&ji.length===body.length*4&&jw.length===body.length*4,'Body indexing ceiling');
  const head=j.skins[0].joints.indexOf(j.nodes.findIndex(n=>n.name==='head'));need(head===44,'Head joint correspondence');
  const a=spec.scalpAllowlist;
  const weight=i=>{let s=0;for(let k=0;k<4;k++)if(ji[i*4+k]===head)s+=jw[i*4+k];return s;};
  const allowed=v=>v.y>=a.topMinY||(v.y>=a.templeMinY&&Math.abs(v.x)>=a.templeMinAbsX&&Math.abs(v.x)<=a.templeMaxAbsX&&v.z<=a.templeMaxZ)||(v.y>=a.rearMinY&&v.z<=a.rearMaxZ&&Math.abs(v.x)<=a.rearMaxAbsX);
  const triangles=[],scalp=[];
  for(let i=0;i<ids.length;i+=3){if(i%768===0)guard();const vi=Array.from(ids.slice(i,i+3));need(vi.every(k=>k<body.length),'Body index range');
    const corners=vi.map(k=>body[k]);if(corners.some(v=>v.y>=contract.projection.bottomY))triangles.push(corners);
    if(vi.every(k=>weight(k)>=.999&&allowed(body[k]))){const t=new Triangle(...corners),normal=t.getNormal(new Vector3()),centre=t.getMidpoint(new Vector3());
      if(normal.dot(centre.clone().sub(new Vector3(0,1.50,.04)).normalize())>.1)scalp.push(corners);}
  }
  need(scalp.length>100,'Scalp context unexpectedly empty');
  const outputs=[];
  need(JSON.stringify(contract.views)==='[{"id":"front","yawDegrees":0},{"id":"angle","yawDegrees":45},{"id":"rear","yawDegrees":180}]','Exact three fixed projections');
  for(const view of contract.views){guard();need(['front','angle','rear'].includes(view.id)&&[0,45,180].includes(view.yawDegrees),'Fixed view');
    const svg=sheet(view,guides,seeds,triangles,scalp);write(view.id+'.svg',svg,limits.svgBytesEach);outputs.push({view:view.id,bytes:Buffer.byteLength(svg),sha256:sha(svg)});}
  verify();write('display-report.json',{utc:new Date().toISOString(),preflightSha256:sha(preBytes),outputs,evaluations,resources:resources(),
    guides:guides.map(g=>({id:g.guide,controls:g.resolvedControls,cubicPieces:g.pieces.map(c=>c.map(p=>p.toArray())),endpoints:g.endpoints.map(e=>({...e,point:e.point.toArray()})),root:g.root,inner:g.innerControlAnchors})),seeds,
    savedFailures:guides.flatMap(g=>g.ribbons.filter(r=>!r.sampledPass).map(r=>({guide:g.guide,ribbon:r.ribbon,allocation:r.allocationWorst,heldOut:r.heldOutWorst}))),
    bodyContextTriangles:triangles.length,scalpContextTriangles:scalp.length,views:contract.views,projection:contract.projection,
    curveControlsChanged:false,rootLookupPerformed:false,newSamplingExperiment:false,firstGuideEvaluated:false,hairMeshGenerated:false,appearanceAccepted:false,limitsOfInference:contract.inferenceLimits});
  write('COMPLETE.json',{utc:new Date().toISOString(),displayOnly:true,reportSha256:sha(fs.readFileSync(out+'display-report.json')),automaticRetry:false});
  console.log(JSON.stringify({complete:true,displayOnly:true,evaluations,outputs,resources:resources()}));
}

function sheet(view,guides,seeds,body,scalp){
  const p=contract.projection,yaw=view.yawDegrees*Math.PI/180;
  const project=v=>[p.centreX+(v.x*Math.cos(yaw)+(v.z-p.centreZ)*Math.sin(yaw))*p.pixelsPerMetre,p.plotTop+(p.topY-v.y)*p.pixelsPerMetre];
  const xy=v=>project(v).map(n=>n.toFixed(3)).join(' '),vec=a=>new Vector3(...a);
  const circle=(v,r,colour,fill='none')=>`<circle cx="${project(v)[0].toFixed(3)}" cy="${project(v)[1].toFixed(3)}" r="${r}" stroke="${colour}" fill="${fill}"/>`;
  const cross=(v,colour,size=4)=>{const [x,y]=project(v);return `<path d="M${x-size} ${y-size}l${size*2} ${size*2}m${-size*2} 0l${size*2} ${-size*2}" stroke="${colour}" stroke-width="1.5"/>`;};
  // Normalize only SVG winding so front/back projected triangles form a union silhouette,
  // rather than cancel under the nonzero fill rule. Frozen 3D indices/normals stay untouched.
  const trianglePath=ts=>ts.map(t=>{const v=t.map(project);
    if((v[1][0]-v[0][0])*(v[2][1]-v[0][1])-(v[1][1]-v[0][1])*(v[2][0]-v[0][0])<0)[v[1],v[2]]=[v[2],v[1]];
    return 'M'+v.map(a=>a.map(n=>n.toFixed(3)).join(' ')).join('L')+'Z';}).join('');
  const colours=['#2068ae','#c34514','#6e42ad','#16846b','#ba3285','#7a6313','#414b59'];
  for(const g of guides)for(const c of g.pieces)for(const v of c){const [x,y]=project(v);need(x>=50&&x<=590&&y>=80&&y<=620,'Fixed plot would clip selected curve '+g.guide);}
  let s=`<svg xmlns="http://www.w3.org/2000/svg" width="640" height="720" viewBox="0 0 640 720"><title>Construction diagnostic only — ${view.id}</title><rect width="640" height="720" fill="#f8f6f0"/><g font-family="sans-serif" fill="#202936"><text x="24" y="25" font-size="17" font-weight="bold">CONSTRUCTION DIAGNOSTIC · ${view.id.toUpperCase()}</text><text x="24" y="47" font-size="12">Seven frozen centre paths · X-ray · no hair surfaces · yaw ${view.yawDegrees}°</text><text x="24" y="65" font-size="12">Bind pose; orthographic; portrait is not camera registered.</text></g><defs><clipPath id="plot"><rect x="50" y="80" width="540" height="540"/></clipPath></defs><g clip-path="url(#plot)"><path d="${trianglePath(body)}" fill="#d7dce0"/><path d="${trianglePath(scalp)}" fill="#f4cb9c"/>`;
  // All line work is X-ray; do not infer hidden-surface order or actual scalp coverage.
  let witness=0;const witnessLabels=new Map();
  for(let gi=0;gi<guides.length;gi++){const g=guides[gi],colour=colours[gi];
    s+=`<path d="M${g.points.map(xy).join('L')}" fill="none" stroke="${colour}" stroke-opacity=".4" stroke-dasharray="3 3"/>`;
    s+=`<path d="M${xy(g.pieces[0][0])}${g.pieces.map(c=>'C'+c.slice(1).map(xy).join(' ')).join('')}" fill="none" stroke="${colour}" stroke-width="2.2"/>`;
    g.points.forEach((v,ci)=>{s+=circle(v,2,colour,'#fff');const [x,y]=project(v);s+=`<text x="${x+3}" y="${y-3}" font-family="sans-serif" font-size="8" fill="${colour}">${gi+1}.${ci}</text>`;});
    s+=circle(vec(g.root.position),4,colour,colour);for(const a of g.innerControlAnchors)s+=circle(vec(a.position),4,colour);
    for(const e of g.endpoints)s+=circle(e.point,3,colour);
    for(const r of g.ribbons.filter(r=>!r.sampledPass)){
      const n=++witness,ap=vec(r.allocationWorst.worst.point),hp=vec(r.heldOutWorst.worst.point),[x,y]=project(ap);
      s+=`<g><title>W${n}: ${g.guide} ribbon${r.ribbon}; circle allocation, X held-out; stored witnesses only</title>`;
      s+=circle(ap,4,'#d7191c')+cross(hp,'#d7191c',3)+circle(vec(r.allocationWorst.worst.chordPoint),1,'#d7191c');
      const key=[x,y].map(n=>n.toFixed(3)).join(',');
      if(!witnessLabels.has(key))witnessLabels.set(key,{x,y,names:[]});
      witnessLabels.get(key).names.push('W'+n);s+='</g>';
    }
  }
  // Only display labels coalesce at the same rounded screen position; saved witnesses stay separate.
  for(const {x,y,names} of witnessLabels.values())s+=`<text x="${x+5}" y="${y+11}" font-family="sans-serif" font-size="9" fill="#a31318">${names.join('/')}</text>`;
  for(let si=0;si<seeds.length;si++){const seed=seeds[si],v=vec(seed.position);s+=circle(v,.025*p.pixelsPerMetre,'#d7191c')+cross(v,'#d7191c',6);const [x,y]=project(v);s+=`<text x="${x+8}" y="${y+12+si*12}" font-family="sans-serif" font-size="10" fill="#a31318">${seed.id} seed ONLY</text>`;}
  s+='</g><g font-family="sans-serif" font-size="10">';
  guides.forEach((g,i)=>{s+=`<text x="${i<4?24:330}" y="${642+(i<4?i:i-4)*16}" fill="${colours[i]}">${i+1} ${g.guide}</text>`;});
  s+='<text x="330" y="690" fill="#a31318">W: circle allocation / X held-out</text><text x="24" y="713" fill="#333">Orange: eligible scalp context · large rings:25mm seed radius · no clearance pass</text></g></svg>';
  return s;
}
