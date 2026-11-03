// One deterministic CPU compilation of explicitly authored Ember guides. No renderer or solver.
import fs from 'node:fs';
import crypto from 'node:crypto';
import {Vector3, Matrix4, Quaternion, Triangle, Ray, Line3, Box3, Bone, Group,
  CatmullRomCurve3, BufferGeometry, Float32BufferAttribute} from 'three';
import {readGlb, readAccessor} from '../lut-bake/glb.mjs';
import {decodePng} from '../critic/png.mjs';
import {cardFrames} from './card-frames-v011.mjs';
import {sampleAdaptive} from './sample-adaptive-v003.mjs';
import {Skeleton} from '../../packages/core/src/figure/Skeleton.js';

const directory='docs/evidence/ember-2026-11-01-hair-v068/';
const sourceFile='tools/ember-hair/ember-waves-v068.json';
const spec=JSON.parse(fs.readFileSync(sourceFile));
const limits=spec.limits, start=process.cpuUsage(), wall=performance.now();
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
let outputBytes=0, collisionPairs=0;
const guard=()=>{const c=process.cpuUsage(start);if((c.user+c.system)/1e6>limits.cpuSeconds||
  (performance.now()-wall)/1000>limits.wallSeconds||process.memoryUsage().rss>limits.rssBytes)throw Error('Compilation resource ceiling');};
const write=(name,b,cap)=>{if(!Buffer.isBuffer(b))b=Buffer.from(JSON.stringify(b,null,2)+'\n');
  outputBytes+=b.length;if(b.length>cap||outputBytes>limits.totalOutputBytes)throw Error('Output ceiling');
  fs.writeFileSync(directory+name,b,{flag:'wx'});return {bytes:b.length,sha256:hash(b)};};
const requireThat=(condition,message)=>{if(!condition)throw Error(message);};
const vec=a=>new Vector3().fromArray(a);
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const smooth=t=>{t=clamp(t,0,1);return t*t*(3-2*t);};
const profile=(a,t)=>{const v=clamp(t,0,1)*(a.length-1),i=Math.min(a.length-2,Math.floor(v));return a[i]+(a[i+1]-a[i])*(v-i);};
const sourcePaths=[...Object.keys(spec.inputs),sourceFile,import.meta.filename,
  'tools/ember-hair/card-frames-v011.mjs','tools/ember-hair/run-v068.py','tools/ember-hair/sample-adaptive-v003.mjs',
  'docs/evidence/ember-2026-10-31-hair-v001/preflight.json',
  'docs/evidence/ember-2026-10-31-hair-sampler-check/report.json',
  'docs/evidence/ember-2026-10-31-hair-sampler-check/review-receipt.json','tools/lut-bake/glb.mjs','tools/critic/png.mjs',
  'docs/evidence/ember-2026-11-01-hair-v068/gap-location.json','docs/evidence/ember-2026-11-01-hair-v068/crown-location.json','docs/evidence/ember-2026-11-01-hair-v068/fit-measurement.json','docs/evidence/ember-2026-11-01-hair-v068/upper-location.json','packages/testbed/ember-hair-v068.html','packages/testbed/src/ember-hair-v068.js',
  'packages/testbed/src/ember-hair-v068-component.js','packages/testbed/src/ember-hair-v047-motion.js','package-lock.json'];
const manifest=()=>Object.fromEntries(sourcePaths.map(p=>[p,{bytes:fs.statSync(p).size,sha256:hash(fs.readFileSync(p))}]));
const inputs=manifest();
for(const [p,v] of Object.entries(spec.inputs))requireThat(inputs[p].sha256===v.sha256,'Protected input changed '+p);
requireThat(spec.guides.length===102&&new Set(spec.guides.map(g=>g.id)).size===102,'Guide identity/count');
requireThat(spec.guides.reduce((n,g)=>n+g.ribbons.length,0)===182,'Ribbon count');
requireThat(fs.statSync(sourceFile).size<=300*1024,'Guide source size');
for(const g of spec.guides){requireThat(g.points.length>=8&&g.points.length<=12,'Explicit control count '+g.id);
  requireThat(g.points.flat().every(Number.isFinite)&&g.lockGroup>=0&&g.lockGroup<16&&Number.isInteger(g.lockGroup),'Guide fields '+g.id);
  for(const r of g.ribbons)requireThat(r.strip>=1&&r.strip<=7&&Number.isInteger(r.strip)&&r.widthM>=.008&&r.widthM<=.028,'Ribbon fields '+g.id);}

function atlasCheck(){
  const alpha=decodePng(fs.readFileSync('assets/hair/bob01/albedo.png'));
  const flow=decodePng(fs.readFileSync('assets/hair/bob01/flow.png'));
  requireThat(alpha.width===1024&&alpha.height===1024&&flow.width===1024&&flow.height===1024,'Atlas dimensions');
  const strips=[];
  const used=[...new Set(spec.guides.flatMap(g=>g.ribbons.map(r=>r.strip)))].sort();
  for(const strip of used){
    const rows=[0,128,256,512,768,960].map(y=>{const values=[];for(let x=strip*128+1;x<(strip+1)*128-1;x++){
      const i=(y*1024+x)*4;if(alpha.pixels[i+3]>.5)values.push(flow.pixels[i+2]);}
      values.sort((a,b)=>a-b);return {y,n:values.length,medianRootToTip:values.length?values[values.length>>1]:null};});
    // Existing atlas strands end at different v values. Empty terminal rows are intentional.
    requireThat(rows.slice(0,5).every(r=>r.n>0),'Missing atlas core coverage');
    requireThat(rows[0].medianRootToTip<.1&&rows[2].medianRootToTip>.2&&rows[2].medianRootToTip<.3&&
      rows[3].medianRootToTip>.45&&rows[3].medianRootToTip<.55&&rows[4].medianRootToTip>.6,'Atlas root-v convention differs');
    strips.push({strip,rows});
  }
  return {width:1024,height:1024,rootV:0,tipV:1,capStripExcluded:0,strips};
}

if(process.argv[2]==='--preflight'){
  const atlas=atlasCheck();guard();write('preflight.json',{inputs,limits,atlas,guides:spec.guides.length+spec.coverageBands.length,ribbons:spec.guides.reduce((n,g)=>n+g.ribbons.length,0)+spec.coverageBands.length,
    scope:'Source/atlas preflight only; no geometry compilation or camera/identity solve'},limits.reportBytes);
  console.log(JSON.stringify({preflight:true,guides:spec.guides.length+spec.coverageBands.length,ribbons:spec.guides.reduce((n,g)=>n+g.ribbons.length,0)+spec.coverageBands.length,atlasRootConventionVerified:true}));
}else if(process.argv[2]==='--run'){
  const pre=JSON.parse(fs.readFileSync(directory+'preflight.json'));
  requireThat(JSON.stringify(inputs)===JSON.stringify(pre.inputs),'Source changed after preflight');
  write('STARTED.json',{utc:new Date().toISOString(),pid:process.pid,limits},limits.reportBytes);
  try{compile(pre);}catch(error){write('failure.json',{utc:new Date().toISOString(),error:error.stack,collisionPairs,
    resources:{cpu:process.cpuUsage(start),rss:process.memoryUsage().rss,wallSeconds:(performance.now()-wall)/1000},
    candidateAccepted:false,automaticRetry:false},limits.reportBytes);throw error;}
}else throw Error('Use --preflight or --run');

function compile(pre){
  const glb=readGlb('docs/evidence/ember-2026-10-31-eye-bridge/candidate.glb'),j=glb.json;
  const primitive=j.meshes[0].primitives[0],attr=primitive.attributes;
  const bindPositions=readAccessor(glb,attr.POSITION).data,bindNormals=readAccessor(glb,attr.NORMAL).data;
  const points=Array.from({length:bindPositions.length/3},(_,i)=>new Vector3().fromArray(bindPositions,i*3));
  requireThat(points.length===14517,'Frozen body correspondence');
  const ids=readAccessor(glb,primitive.indices).data,ji=readAccessor(glb,attr.JOINTS_0).data,
    jw=readAccessor(glb,attr.WEIGHTS_0).data,skin=j.skins[0],inverse=readAccessor(glb,skin.inverseBindMatrices).data;
  const jointSet=new Set(skin.joints),nodes=j.nodes.map((n,i)=>{const o=jointSet.has(i)?new Bone():new Group();o.name=n.name??'';
    if(n.matrix)new Matrix4().fromArray(n.matrix).decompose(o.position,o.quaternion,o.scale);
    else{if(n.translation)o.position.fromArray(n.translation);if(n.rotation)o.quaternion.fromArray(n.rotation);if(n.scale)o.scale.fromArray(n.scale);}return o;});
  j.nodes.forEach((n,i)=>(n.children??[]).forEach(k=>nodes[i].add(nodes[k])));
  const figure=new Group();for(const i of j.scenes[j.scene??0].nodes)figure.add(nodes[i]);figure.updateMatrixWorld(true);
  const rig=new Skeleton(figure),head=rig.rawBones.get('head');requireThat(head&&rig.has('neck'),'Head chain');
  const headJoint=skin.joints.findIndex(i=>nodes[i]===head),headBind=head.matrixWorld.clone(),headInverse=headBind.clone().invert();
  const inv=skin.joints.map((_,i)=>new Matrix4().fromArray(inverse,i*16));
  const meshNode=j.nodes.findIndex(n=>n.mesh===0);requireThat(nodes[meshNode].matrixWorld.equals(new Matrix4()),'Body bind transform must be identity');
  function posedBody(){figure.updateMatrixWorld(true);const matrices=skin.joints.map((n,i)=>new Matrix4().multiplyMatrices(nodes[n].matrixWorld,inv[i]));
    return points.map((p,i)=>{const v=new Vector3();for(let k=0;k<4;k++){const w=jw[i*4+k];if(w)v.addScaledVector(p.clone().applyMatrix4(matrices[ji[i*4+k]]),w);}return v;});}
  const restPosed=posedBody(),restError=Math.max(...points.map((p,i)=>p.distanceTo(restPosed[i])));
  requireThat(restError<.00001,'Unexpected skin bind reconstruction '+restError);
  const headWeight=i=>{let s=0;for(let k=0;k<4;k++)if(ji[i*4+k]===headJoint)s+=jw[i*4+k];return s;};
  const allow=spec.scalpAllowlist;
  const scalpPoint=p=>p.y>=allow.topMinY||
    (p.y>=allow.templeMinY&&Math.abs(p.x)>=allow.templeMinAbsX&&Math.abs(p.x)<=allow.templeMaxAbsX&&p.z<=allow.templeMaxZ)||
    (p.y>=allow.rearMinY&&p.z<=allow.rearMaxZ&&Math.abs(p.x)<=allow.rearMaxAbsX);
  const scalp=[];
  for(let i=0;i<ids.length;i+=3){const vi=Array.from(ids.slice(i,i+3));if(!vi.every(k=>headWeight(k)>=.999&&scalpPoint(points[k])))continue;
    const triangle=new Triangle(...vi.map(k=>points[k])),normal=triangle.getNormal(new Vector3()),centre=triangle.getMidpoint(new Vector3());
    if(normal.dot(centre.clone().sub(new Vector3(0,1.50,.04)).normalize())>.1)scalp.push({triangle,normal,vertices:vi,triangleIndex:i/3});}
  requireThat(scalp.length>100,'Scalp allowlist unexpectedly empty');
  function anchor(seed,offsetM=allow.rootOffsetM,maxDistanceM=allow.rootSeedMaxDistanceM){let best=null,d2=Infinity;for(const t of scalp){const p=t.triangle.closestPointToPoint(seed,new Vector3()),d=p.distanceToSquared(seed);
      if(d<d2){d2=d;best={...t,point:p};}}
    requireThat(d2<maxDistanceM**2,'Authored seed outside eligible scalp '+seed.toArray());
    const bary=best.triangle.getBarycoord(best.point,new Vector3());
    requireThat(Math.min(...bary.toArray())>=-1e-6,'Invalid root barycentrics');
    const position=best.point.clone().addScaledVector(best.normal,offsetM);
    return {position,normal:best.normal.clone(),record:{vertices:best.vertices,bary:bary.toArray(),normal:best.normal.toArray(),offsetM,triangleIndex:best.triangleIndex,seedDistanceM:Math.sqrt(d2)}};
  }
  function guideRoot(g){
    if(!g.explicitRootSite)return anchor(vec(g.rootSeed));
    const site=g.explicitRootSite,t=scalp.find(t=>t.triangleIndex===site.triangleIndex);
    requireThat(t&&JSON.stringify(t.vertices)===JSON.stringify(site.vertices),'Explicit nape root correspondence');
    const surface=new Vector3();t.vertices.forEach((v,k)=>surface.addScaledVector(points[v],site.bary[k]));
    requireThat(surface.distanceTo(vec(site.surfacePoint))<1e-8,'Explicit nape root moved');
    requireThat(t.normal.distanceTo(vec(site.normal))<1e-8,'Explicit nape normal moved');
    return {position:surface.clone().addScaledVector(t.normal,allow.rootOffsetM),normal:t.normal.clone(),
      record:{vertices:t.vertices,bary:site.bary,normal:t.normal.toArray(),offsetM:allow.rootOffsetM,triangleIndex:t.triangleIndex,seedDistanceM:0,explicit:true}};
  }
  const scalpOrigin=new Vector3(0,1.50,.04),coverageSurface=[];
  for(let i=0;i<ids.length;i+=3){const vi=Array.from(ids.slice(i,i+3));
    if(!vi.every(k=>headWeight(k)>=.999&&points[k].y>=1.40))continue;
    const triangle=new Triangle(...vi.map(k=>points[k])),normal=triangle.getNormal(new Vector3());
    if(triangle.getArea()>1e-12&&normal.dot(triangle.getMidpoint(new Vector3()).sub(scalpOrigin).normalize())>.05)
      coverageSurface.push({triangle,normal,vertices:vi,triangleIndex:i/3});}
  let radialFallbacks=0;
  function radialScalp(seed,offsetM){
    const direction=seed.clone().sub(scalpOrigin).normalize(),ray=new Ray(scalpOrigin,direction);let best=null,distance=Infinity;
    for(const t of coverageSurface){const hit=ray.intersectTriangle(t.triangle.a,t.triangle.b,t.triangle.c,false,new Vector3());
      if(hit&&hit.distanceTo(scalpOrigin)<distance){distance=hit.distanceTo(scalpOrigin);best={...t,point:hit};}}
    if(!best){radialFallbacks++;return anchor(seed,offsetM,.15);}
    const bary=best.triangle.getBarycoord(best.point,new Vector3()),normal=new Vector3();
    best.vertices.forEach((v,k)=>normal.addScaledVector(new Vector3().fromArray(bindNormals,v*3),bary.getComponent(k)));normal.normalize();
    return {position:best.point.clone().addScaledVector(normal,offsetM),normal,
      record:{vertices:best.vertices,bary:bary.toArray(),normal:normal.toArray(),offsetM,triangleIndex:best.triangleIndex,seedDistanceM:seed.distanceTo(best.point)}};
  }
  const position=[],uv=[],uv1=[],index=[],roots=[],mapping=[],controlAnchors=[],expectedNormals=[];let maxChord=0,minFrameDot=1;
  for(const g of spec.guides){guard();const centreRoot=guideRoot(g),controls=g.points.map(vec);controls[0]=centreRoot.position;
    if(g.surfaceControls){const cfg=g.surfaceControls;for(const ci of cfg.indices){
      const a=anchor(controls[ci],cfg.offsetM,cfg.maxSeedDistanceM);controls[ci]=a.position;controlAnchors.push({guide:g.id,controlIndex:ci,...a.record});}}
    const curve=new CatmullRomCurve3(controls,false,'centripetal');
    for(let ri=0;ri<g.ribbons.length;ri++){
      const r=g.ribbons[ri],base=position.length/3,end=r.endFraction??[.97,1,.94][ri];let previousT=null,transport=null,rootRow=null;
      let sampling;
      try{sampling=sampleAdaptive(curve,controls.length,end,spec.interpolation.maxMidpointChordErrorM,guard);}
      catch(error){throw Error('Guide '+g.id+' ribbon '+ri+': '+error.message,{cause:error});}
      const parameters=sampling.parameters,segments=parameters.length-1;
      maxChord=Math.max(maxChord,sampling.maxSampledErrorM);
      for(let s=0;s<=segments;s++){
        const q=parameters[s],t=q/end,centre=curve.getPoint(q),tangent=curve.getTangent(q).normalize();
        requireThat(tangent.lengthSq()>.99,'Degenerate guide tangent');
        if(!previousT){transport=vec(g.acrossHint).addScaledVector(tangent,-vec(g.acrossHint).dot(tangent));
          requireThat(transport.lengthSq()>1e-5,'Parallel initial frame '+g.id);transport.normalize();
          if(new Vector3().crossVectors(tangent,transport).dot(centreRoot.normal)<0)transport.negate();
        }else{const d=previousT.dot(tangent);minFrameDot=Math.min(minFrameDot,d);requireThat(d>.05,'Guide frame reversal '+g.id);
          transport.applyQuaternion(new Quaternion().setFromUnitVectors(previousT,tangent));transport.addScaledVector(tangent,-transport.dot(tangent)).normalize();}
        previousT=tangent.clone();
        const radial=new Vector3(centre.x,Math.max(0,centre.y-1.50),centre.z-.04).normalize();
        const outwardAcross=new Vector3().crossVectors(radial,tangent).normalize();
        const across=(g.surfaceFacing&&outwardAcross.lengthSq()>.99?outwardAcross:transport.clone())
          .applyAxisAngle(tangent,profile(g.rollDegrees,q)*Math.PI/180);
        const normal=new Vector3().crossVectors(tangent,across).normalize();
        const width=r.widthM*profile(r.widthProfile,t),blend=smooth(t/spec.interpolation.rootBlendFraction);
        const cfg=g.surfaceControls,inner=cfg?1-smooth((q*(controls.length-1)-2)/(cfg.blendOutControlIndex-2)):0;
        const layerScale=cfg?1-(1-cfg.layerDepthScale)*inner:1;
        for(let c=0;c<3;c++){
          const side=(c-1)*.5,regular=centre.clone().addScaledVector(across,r.offsetAcross+side*width)
            .addScaledVector(normal,layerScale*(r.offsetOut*blend+spec.interpolation.camberM*(1-(side*2)**2)*Math.sin(Math.PI*t)));
          if(s===0){rootRow??=[];const a=anchor(regular);a.delta=a.position.clone().sub(regular);rootRow.push(a);roots.push({vertex:base+c,guide:g.id,ribbon:ri,cross:c,...a.record});regular.copy(a.position);}
          else if(blend<1)regular.addScaledVector(rootRow[c].delta,1-blend);
          position.push(...regular.toArray());expectedNormals.push(normal.clone());uv.push(r.strip/8+1/1024+c/2*(1/8-2/1024),t);uv1.push((g.lockGroup+.5)/16,0);
          if(s<segments&&c<2){const a=base+s*3+c,b=a+3;index.push(a,b,b+1,a,b+1,a+1);}
        }
      }
      mapping.push({guide:g.id,ribbon:ri,vertexStart:base,vertexCount:(segments+1)*3,segments,parameters,sampling,strip:r.strip,lockGroup:g.lockGroup,endFraction:end});
    }
  }
  // Lay the root transitions against the scalp. Keep exact anchored roots and all terminal rows.
  let laidRootVertices=0,maxRootLayDisplacementM=0;
  for(const m of mapping)for(let row=1;row<m.vertexCount/3-1;row++){
    const t=m.parameters[row]/m.endFraction,weight=1-smooth((t-.10)/.20);if(weight===0)continue;
    for(let cross=0;cross<3;cross++){
      const vi=m.vertexStart+row*3+cross,p=new Vector3().fromArray(position,vi*3);
      const target=radialScalp(p,allow.rootOffsetM+.008*smooth(t/.10)).position;
      const laid=p.clone().lerp(target,weight);maxRootLayDisplacementM=Math.max(maxRootLayDisplacementM,p.distanceTo(laid));
      laid.toArray(position,vi*3);laidRootVertices++;}}
  let coverageMaxSampledChordM=0,coverageWorst=null;
  for(const band of spec.coverageBands){
    guard();const controls=band.points.map(vec);if(band.freePath)controls[0]=radialScalp(controls[0],band.baseOffsetM??.0006).position;
    const curve=new CatmullRomCurve3(controls,false,'centripetal'),base=position.length/3,rootDelta=[];
    function offsetAt(t){return (band.baseOffsetM??.0006)+band.liftM*Math.sin(Math.PI*t);}
    function centreAt(t){const p=curve.getPoint(t);return band.freePath?p:radialScalp(p,offsetAt(t)).position;}
    let sampling;
    try{sampling=sampleAdaptive({getPoint:centreAt},controls.length,1,.00035,guard);}catch(e){throw Error('Coverage '+band.id+': '+e.message);}
    const parameters=sampling.parameters,n=parameters.length-1;
    if(sampling.maxSampledErrorM>coverageMaxSampledChordM){coverageMaxSampledChordM=sampling.maxSampledErrorM;coverageWorst={band:band.id,...sampling.worst};}
    for(let row=0;row<=n;row++){
      const t=parameters[row],centre=centreAt(t),lo=centreAt(Math.max(0,t-.001)),hi=centreAt(Math.min(1,t+.001));
      const tangent=hi.distanceTo(lo)>1e-8?hi.clone().sub(lo).normalize():curve.getTangent(t).normalize(),surface=band.freePath&&band.facingNormal?{normal:vec(band.facingNormal).normalize()}:radialScalp(curve.getPoint(t),0);
      const facing=band.facingNormal?vec(band.facingNormal).normalize():surface.normal;
      const across=new Vector3().crossVectors(facing,tangent).normalize();
      requireThat(across.lengthSq()>.99,'Degenerate coverage ribbon '+band.id);
      const taper=band.freePath?(.4+.6*smooth(t/.12))*(1-.92*smooth((t-.84)/.16)):.75+.25*Math.sin(Math.PI*t),width=band.widthM*taper*(band.widthProfile?profile(band.widthProfile,t):1);
      for(let cross=0;cross<3;cross++){
        const side=band.crossSpan?band.crossSpan[0]+(band.crossSpan[1]-band.crossSpan[0])*cross/2:(cross-1)*.5,outer=centre.clone().addScaledVector(across,side*width);
        if(band.edgeOverlap&&(band.edgeOverlap.crossWeights?.[cross]??(cross===band.edgeOverlap.cross?1:0))>0){
          const edge=band.edgeOverlap,weight=smooth((t-edge.start)/(edge.full-edge.start))
            *(1-smooth((t-edge.fade)/(edge.end-edge.fade)));
          outer.addScaledVector(vec(edge.direction),edge.maxM*weight*(edge.crossWeights?.[cross]??1));
        }
        let point,normal=surface.normal;
        if(band.freePath){point=outer.clone();
          if(row===0){const a=radialScalp(outer,band.baseOffsetM??.0006);rootDelta[cross]=a.position.clone().sub(outer);point=a.position;
            roots.push({vertex:base+cross,guide:band.id,ribbon:0,cross,...a.record});}
          else {point.addScaledVector(rootDelta[cross],1-smooth(t/.12));
            if(band.camberM)point.addScaledVector(new Vector3().crossVectors(tangent,across).normalize(),band.camberM*(1-(side*2)**2)*Math.sin(Math.PI*t));}
        }else{const a=radialScalp(outer,offsetAt(t));point=a.position;normal=a.normal;
          if(row===0)roots.push({vertex:base+cross,guide:band.id,ribbon:0,cross,...a.record});}
        position.push(...point.toArray());expectedNormals.push(band.facingNormal?new Vector3().crossVectors(tangent,across).normalize():normal);
        uv.push(band.strip/8+1/1024+(side+.5)*(1/8-2/1024),t);uv1.push((band.lockGroup+.5)/16,0);
        if(row<n&&cross<2){const i=base+row*3+cross,j=i+3;index.push(i,j,j+1,i,j+1,i+1);}}
    }
    mapping.push({guide:band.id,ribbon:0,vertexStart:base,vertexCount:(n+1)*3,segments:n,parameters,sampling,strip:band.strip,lockGroup:band.lockGroup,endFraction:1,coverageBand:true});
  }
  const headTriangles=[];
  for(let i=0;i<ids.length;i+=3){const vi=Array.from(ids.slice(i,i+3));
    if(!vi.every(k=>headWeight(k)>=.999&&points[k].y>=1.43))continue;
    const tri=new Triangle(...vi.map(k=>points[k]));if(tri.getArea()>1e-12)headTriangles.push({tri,
      box:new Box3().setFromPoints([tri.a,tri.b,tri.c]),normal:tri.getNormal(new Vector3())});}
  const headTree=buildTree(headTriangles);let projectedVertices=0,maxProjectionM=0;
  for(const m of mapping)for(let row=1;row<m.vertexCount/3-1;row++)for(let cross=0;cross<3;cross++){
    const vi=m.vertexStart+row*3+cross,p=new Vector3().fromArray(position,vi*3);if(p.y<1.43)continue;
    const n=nearest(headTree,p);if(n.signed<.0015&&n.distance<.022){
      const moved=p.clone().addScaledVector(n.normal,.002-n.signed);maxProjectionM=Math.max(maxProjectionM,p.distanceTo(moved));
      moved.toArray(position,vi*3);projectedVertices++;}}
  // Fit only the new connector across its width to the actual side surface.
  // This uses complete body triangles (including mixed head/neck weights),
  // avoiding the fully-head-weighted radial fallback discontinuity near the ear.
  const sideSurfaceTriangles=[];
  for(let i=0;i<ids.length;i+=3){const vi=Array.from(ids.slice(i,i+3));
    if(vi.every(k=>points[k].y>1.35))sideSurfaceTriangles.push(new Triangle(...vi.map(k=>points[k])));}
  const sideSurfaceFit={vertices:0,maxDisplacementM:0,misses:0};
  for(const band of spec.coverageBands){if(!band.sideSurfaceFit)continue;
    const cfg=band.sideSurfaceFit,m=mapping.find(m=>m.guide===band.id);
    for(let row=1;row<m.vertexCount/3-1;row++)for(let cross=0;cross<3;cross++){
      const t=m.parameters[row],vi=m.vertexStart+row*3+cross,p=new Vector3().fromArray(position,vi*3);
      let weight=smooth((t-cfg.rootBlendStart)/(cfg.rootBlendEnd-cfg.rootBlendStart))
        *smooth((p.y-cfg.lowerBlendStartY)/(cfg.lowerBlendEndY-cfg.lowerBlendStartY));
      const edge=band.edgeOverlap;
      if(edge?.fullSurfaceFit&&(edge.crossWeights?.[cross]??(cross===edge.cross?1:0))>0){
        const overlap=smooth((t-edge.start)/(edge.full-edge.start))*(1-smooth((t-edge.fade)/(edge.end-edge.fade)));
        weight=Math.max(weight,overlap);
      }
      if(weight===0)continue;
      const ray=new Ray(new Vector3(-.30,p.y,p.z),new Vector3(1,0,0));let outerX=Infinity;
      for(const tri of sideSurfaceTriangles){const hit=ray.intersectTriangle(tri.a,tri.b,tri.c,false,new Vector3());
        if(hit&&hit.x<outerX)outerX=hit.x;}
      if(!Number.isFinite(outerX)){sideSurfaceFit.misses++;continue;}
      const targetX=outerX-cfg.offsetM,dx=(targetX-p.x)*weight;
      sideSurfaceFit.maxDisplacementM=Math.max(sideSurfaceFit.maxDisplacementM,Math.abs(dx));
      p.x+=dx;p.toArray(position,vi*3);sideSurfaceFit.vertices++;
    }}
  // A single bounded constraint pass prevents wide faces from cutting across
  // the curved side surface even when their vertices are individually outside.
  // Only extended front-edge vertices may move, and only outward along negative X.
  const triangleSideClearance={samples:0,constraints:0,correctedVertices:[],maxCorrectionM:0};
  const sideRayTriangles=sideSurfaceTriangles.map(tri=>({tri,box:new Box3().setFromPoints([tri.a,tri.b,tri.c])}));
  function sideSurfaceX(p){const ray=new Ray(new Vector3(-.30,p.y,p.z),new Vector3(1,0,0));let outerX=Infinity;
    for(const {tri,box} of sideRayTriangles){if(p.y<box.min.y||p.y>box.max.y||p.z<box.min.z||p.z>box.max.z)continue;
      const hit=ray.intersectTriangle(tri.a,tri.b,tri.c,false,new Vector3());if(hit&&hit.x<outerX)outerX=hit.x;}
    return outerX;}
  for(const band of spec.coverageBands){if(!band.triangleSideClearance)continue;
    const cfg=band.triangleSideClearance,edge=band.edgeOverlap,m=mapping.find(m=>m.guide===band.id),movable=new Set(),shifts=new Map();
    for(let row=1;row<m.vertexCount/3-1;row++){const t=m.parameters[row];
      if(t>edge.start&&t<edge.end)for(let cross=0;cross<3;cross++)if((edge.crossWeights?.[cross]??(cross===edge.cross?1:0))>0)movable.add(m.vertexStart+row*3+cross);}
    for(let i=0;i<index.length;i+=3){const vi=index.slice(i,i+3);if(!vi.some(v=>movable.has(v)))continue;guard();
      const pts=vi.map(v=>new Vector3().fromArray(position,v*3)),n=cfg.subdivisions;
      for(let a=0;a<=n;a++)for(let b=0;b<=n-a;b++){
        const bary=[a/n,b/n,1-(a+b)/n],weight=vi.reduce((sum,v,k)=>sum+(movable.has(v)?bary[k]:0),0);
        if(weight<1e-6)continue;
        const p=new Vector3();pts.forEach((q,k)=>p.addScaledVector(q,bary[k]));
        const skinX=sideSurfaceX(p);triangleSideClearance.samples++;if(!Number.isFinite(skinX))continue;
        const correction=(p.x-skinX+cfg.marginM)/weight;if(correction<=0)continue;
        requireThat(correction<=cfg.maxCorrectionM,'Connector triangle clearance correction ceiling '+JSON.stringify({triangle:i/3,vertices:vi,bary,point:p.toArray(),skinX,correction,weight}));
        triangleSideClearance.constraints++;
        for(const v of vi)if(movable.has(v))shifts.set(v,Math.max(shifts.get(v)??0,correction));
      }}
    for(const [v,dx]of shifts){position[v*3]-=dx;
      triangleSideClearance.maxCorrectionM=Math.max(triangleSideClearance.maxCorrectionM,dx);
      triangleSideClearance.correctedVertices.push({vertex:v,correctionM:dx});}
  }
  // Extend only the gap-facing edge; retain the centreline and opposite boundary.
  // Apply after unchanged v060 construction so every other ribbon stays exact.
  const innerSideReshape={guide:spec.innerSideReshape.guide,vertices:[],maxForwardM:0,maxOutwardM:0,triangleSamples:0,triangleConstraints:0};
  {const cfg=spec.innerSideReshape,m=mapping.find(m=>m.guide===cfg.guide);
    requireThat(m&&m.ribbon===0,'Inner reshape target missing');
    const movable=new Set();
    function positiveSideX(p){const ray=new Ray(new Vector3(.30,p.y,p.z),new Vector3(-1,0,0));let outerX=-Infinity;
      for(const {tri,box} of sideRayTriangles){if(p.y<box.min.y||p.y>box.max.y||p.z<box.min.z||p.z>box.max.z)continue;
        const hit=ray.intersectTriangle(tri.a,tri.b,tri.c,false,new Vector3());if(hit&&hit.x>outerX)outerX=hit.x;}
      return outerX;}
    for(let row=1;row<m.vertexCount/3-1;row++){const t=m.parameters[row];
      const weight=smooth((t-cfg.start)/(cfg.full-cfg.start))*(1-smooth((t-cfg.fade)/(cfg.end-cfg.fade)));
      if(!weight)continue;
      for(const cross of [cfg.crossColumn]){const vertex=m.vertexStart+row*3+cross,p=new Vector3().fromArray(position,vertex*3),before=p.clone();
        p.z+=cfg.forwardM*weight;const skinX=positiveSideX(p);
        if(Number.isFinite(skinX))p.x=Math.max(p.x,skinX+cfg.surfaceOffsetM);
        requireThat(p.x-before.x<=cfg.maxOutwardM,'Inner side outward fit ceiling '+JSON.stringify({vertex,row,cross,required:p.x-before.x}));
        p.toArray(position,vertex*3);movable.add(vertex);
        innerSideReshape.maxForwardM=Math.max(innerSideReshape.maxForwardM,p.z-before.z);
        innerSideReshape.maxOutwardM=Math.max(innerSideReshape.maxOutwardM,p.x-before.x);
        innerSideReshape.vertices.push({vertex,row,cross,t,forwardM:p.z-before.z,outwardM:p.x-before.x});
      }}
    const shifts=new Map();
    for(let i=0;i<index.length;i+=3){const vi=index.slice(i,i+3);if(!vi.some(v=>movable.has(v)))continue;guard();
      const pts=vi.map(v=>new Vector3().fromArray(position,v*3)),n=cfg.subdivisions;
      for(let a=0;a<=n;a++)for(let b=0;b<=n-a;b++){
        const bary=[a/n,b/n,1-(a+b)/n],weight=vi.reduce((sum,v,k)=>sum+(movable.has(v)?bary[k]:0),0);if(weight<1e-6)continue;
        const p=new Vector3();pts.forEach((q,k)=>p.addScaledVector(q,bary[k]));const skinX=positiveSideX(p);
        innerSideReshape.triangleSamples++;if(!Number.isFinite(skinX))continue;
        const dx=(skinX+cfg.triangleMarginM-p.x)/weight;if(dx<=0)continue;
        requireThat(dx<=cfg.maxOutwardM,'Inner side triangle correction ceiling '+JSON.stringify({triangle:i/3,vi,bary,point:p.toArray(),skinX,dx,weight}));innerSideReshape.triangleConstraints++;
        for(const v of vi)if(movable.has(v))shifts.set(v,Math.max(shifts.get(v)??0,dx));
      }}
    for(const [v,dx]of shifts){const item=innerSideReshape.vertices.find(x=>x.vertex===v);
      requireThat(item.outwardM+dx<=cfg.maxOutwardM,'Inner side combined correction ceiling');
      position[v*3]+=dx;item.outwardM+=dx;innerSideReshape.maxOutwardM=Math.max(innerSideReshape.maxOutwardM,item.outwardM);}
  }
  // Extend only the gap-facing edge; retain the centreline and opposite boundary.
  // Applied after retained side fill; only the measured inner crown edge changes.
  const crownEdgeReshape={guide:spec.crownEdgeReshape.guide,vertices:[],maxForwardM:0,maxOutwardM:0,triangleSamples:0,triangleConstraints:0};
  {const cfg=spec.crownEdgeReshape,m=mapping.find(m=>m.guide===cfg.guide);
    requireThat(m&&m.ribbon===0,'Crown reshape target missing');
    const movable=new Set();
    function positiveSideX(p){const ray=new Ray(new Vector3(.30,p.y,p.z),new Vector3(-1,0,0));let outerX=-Infinity;
      for(const {tri,box} of sideRayTriangles){if(p.y<box.min.y||p.y>box.max.y||p.z<box.min.z||p.z>box.max.z)continue;
        const hit=ray.intersectTriangle(tri.a,tri.b,tri.c,false,new Vector3());if(hit&&hit.x>outerX)outerX=hit.x;}
      return outerX;}
    for(let row=1;row<m.vertexCount/3-1;row++){const t=m.parameters[row];
      const weight=smooth((t-cfg.start)/(cfg.full-cfg.start))*(1-smooth((t-cfg.fade)/(cfg.end-cfg.fade)));
      if(!weight)continue;
      for(const cross of [cfg.crossColumn]){const vertex=m.vertexStart+row*3+cross,p=new Vector3().fromArray(position,vertex*3),before=p.clone();
        p.z+=cfg.forwardM*weight;const skinX=positiveSideX(p);
        if(Number.isFinite(skinX))p.x=Math.max(p.x,skinX+cfg.surfaceOffsetM);
        requireThat(p.x-before.x<=cfg.maxOutwardM,'Crown edge outward fit ceiling '+JSON.stringify({vertex,row,cross,required:p.x-before.x}));
        p.toArray(position,vertex*3);movable.add(vertex);
        crownEdgeReshape.maxForwardM=Math.max(crownEdgeReshape.maxForwardM,p.z-before.z);
        crownEdgeReshape.maxOutwardM=Math.max(crownEdgeReshape.maxOutwardM,p.x-before.x);
        crownEdgeReshape.vertices.push({vertex,row,cross,t,forwardM:p.z-before.z,outwardM:p.x-before.x});
      }}
    const shifts=new Map();
    for(let i=0;i<index.length;i+=3){const vi=index.slice(i,i+3);if(!vi.some(v=>movable.has(v)))continue;guard();
      const pts=vi.map(v=>new Vector3().fromArray(position,v*3)),n=cfg.subdivisions;
      for(let a=0;a<=n;a++)for(let b=0;b<=n-a;b++){
        const bary=[a/n,b/n,1-(a+b)/n],weight=vi.reduce((sum,v,k)=>sum+(movable.has(v)?bary[k]:0),0);if(weight<1e-6)continue;
        const p=new Vector3();pts.forEach((q,k)=>p.addScaledVector(q,bary[k]));const skinX=positiveSideX(p);
        crownEdgeReshape.triangleSamples++;if(!Number.isFinite(skinX))continue;
        const dx=(skinX+cfg.triangleMarginM-p.x)/weight;if(dx<=0)continue;
        requireThat(dx<=cfg.maxOutwardM,'Crown edge triangle correction ceiling '+JSON.stringify({triangle:i/3,vi,bary,point:p.toArray(),skinX,dx,weight}));crownEdgeReshape.triangleConstraints++;
        for(const v of vi)if(movable.has(v))shifts.set(v,Math.max(shifts.get(v)??0,dx));
      }}
    for(const [v,dx]of shifts){const item=crownEdgeReshape.vertices.find(x=>x.vertex===v);
      requireThat(item.outwardM+dx<=cfg.maxOutwardM,'Crown edge combined correction ceiling');
      position[v*3]+=dx;item.outwardM+=dx;crownEdgeReshape.maxOutwardM=Math.max(crownEdgeReshape.maxOutwardM,item.outwardM);}
  }
  // Extend only the rear boundary of the retained inner scalp band.
  const upperSideReshape={guide:spec.upperSideReshape.guide,vertices:[],maxBackwardM:0,maxOutwardM:0,triangleSamples:0,triangleConstraints:0};
  {const cfg=spec.upperSideReshape,m=mapping.find(m=>m.guide===cfg.guide);
    requireThat(m&&m.ribbon===0,'Upper side reshape target missing');
    const movable=new Set();
    for(let row=1;row<m.vertexCount/3-1;row++){const t=m.parameters[row];
      const weight=smooth((t-cfg.start)/(cfg.full-cfg.start))*(1-smooth((t-cfg.fade)/(cfg.end-cfg.fade)));
      if(!weight)continue;
      for(const cross of [cfg.crossColumn]){const vertex=m.vertexStart+row*3+cross,p=new Vector3().fromArray(position,vertex*3),before=p.clone();
        p.z-=cfg.backwardM*weight;const skinX=sideSurfaceX(p);
        if(Number.isFinite(skinX))p.x=Math.min(p.x,skinX-cfg.surfaceOffsetM);
        requireThat(before.x-p.x<=cfg.maxOutwardM,'Upper side edge outward fit ceiling '+JSON.stringify({vertex,row,cross,required:before.x-p.x}));
        p.toArray(position,vertex*3);movable.add(vertex);
        upperSideReshape.maxBackwardM=Math.max(upperSideReshape.maxBackwardM,before.z-p.z);
        upperSideReshape.maxOutwardM=Math.max(upperSideReshape.maxOutwardM,before.x-p.x);
        upperSideReshape.vertices.push({vertex,row,cross,t,backwardM:before.z-p.z,outwardM:before.x-p.x});
      }}
    const shifts=new Map();
    for(let i=0;i<index.length;i+=3){const vi=index.slice(i,i+3);if(!vi.some(v=>movable.has(v)))continue;guard();
      const pts=vi.map(v=>new Vector3().fromArray(position,v*3)),n=cfg.subdivisions;
      for(let a=0;a<=n;a++)for(let b=0;b<=n-a;b++){
        const bary=[a/n,b/n,1-(a+b)/n],weight=vi.reduce((sum,v,k)=>sum+(movable.has(v)?bary[k]:0),0);if(weight<1e-6)continue;
        const p=new Vector3();pts.forEach((q,k)=>p.addScaledVector(q,bary[k]));const skinX=sideSurfaceX(p);
        upperSideReshape.triangleSamples++;if(!Number.isFinite(skinX))continue;
        const dx=(p.x-skinX+cfg.triangleMarginM)/weight;if(dx<=0)continue;
        requireThat(dx<=cfg.maxOutwardM,'Upper side edge triangle correction ceiling '+JSON.stringify({triangle:i/3,vi,bary,point:p.toArray(),skinX,dx,weight}));upperSideReshape.triangleConstraints++;
        for(const v of vi)if(movable.has(v))shifts.set(v,Math.max(shifts.get(v)??0,dx));
      }}
    for(const [v,dx]of shifts){const item=upperSideReshape.vertices.find(x=>x.vertex===v);
      requireThat(item.outwardM+dx<=cfg.maxOutwardM,'Upper side edge combined correction ceiling');
      position[v*3]-=dx;item.outwardM+=dx;upperSideReshape.maxOutwardM=Math.max(upperSideReshape.maxOutwardM,item.outwardM);}
  }
  requireThat(position.length/3<=limits.maxVertices&&index.length/3<=limits.maxTriangles,'Geometry ceiling');
  requireThat([...position,...uv,...uv1].every(Number.isFinite),'Non-finite geometry');
  const hairPoints=Array.from({length:position.length/3},(_,i)=>new Vector3().fromArray(position,i*3));
  let minArea=Infinity,minFaceAgreement=1,correctedWindingFaces=0;
  for(let i=0;i<index.length;i+=3){const vi=index.slice(i,i+3),t=new Triangle(...vi.map(k=>hairPoints[k]));minArea=Math.min(minArea,t.getArea());
    const expected=vi.reduce((v,k)=>v.add(expectedNormals[k]),new Vector3()).normalize();
    const agreement=t.getNormal(new Vector3()).dot(expected);minFaceAgreement=Math.min(minFaceAgreement,agreement);
    // Projection onto the scalp can reverse a root-row triangle. Match its winding to the authored ribbon frame.
    if(agreement<0){[index[i+1],index[i+2]]=[index[i+2],index[i+1]];correctedWindingFaces++;}}
  const keptIndices=[];let degenerateFacesRemoved=0;
  for(let i=0;i<index.length;i+=3){const tri=new Triangle(...index.slice(i,i+3).map(k=>hairPoints[k]));
    if(tri.getArea()<=1e-12)degenerateFacesRemoved++;else keptIndices.push(index[i],index[i+1],index[i+2]);}
  index.length=0;index.push(...keptIndices);
  requireThat(degenerateFacesRemoved<=64,'Too many collapsed scalp-row faces '+degenerateFacesRemoved);
  const geometry=new BufferGeometry().setAttribute('position',new Float32BufferAttribute(position,3));geometry.setIndex(index);geometry.computeVertexNormals();
  const normals=geometry.attributes.normal.array;requireThat([...normals].every(Number.isFinite),'Non-finite normals');
  const clearance=[];let maxRootResidual=0;
  for(const state of ['bind','head']){
    guard();rig.reset();if(state==='head'){rig.rotationOf('neck').setFromAxisAngle(new Vector3(0,1,0),.24*.35);rig.rotationOf('head').setFromAxisAngle(new Vector3(0,1,0),.24*.65);}rig.update();figure.updateMatrixWorld(true);
    const body=posedBody(),delta=new Matrix4().multiplyMatrices(head.matrixWorld,headInverse),hp=hairPoints.map(p=>p.clone().applyMatrix4(delta));
    for(const a of roots){const expected=new Vector3();a.vertices.forEach((v,k)=>expected.addScaledVector(body[v],a.bary[k]));
      expected.addScaledVector(vec(a.normal).transformDirection(delta),a.offsetM);
      maxRootResidual=Math.max(maxRootResidual,expected.distanceTo(hp[a.vertex]));}
    requireThat(maxRootResidual<=.0005,'Root attachment drift');
    const triangles=[];for(let i=0;i<ids.length;i+=3){const vi=Array.from(ids.slice(i,i+3));if(vi.every(k=>body[k].y<1.20))continue;
      const tri=new Triangle(...vi.map(k=>body[k]));if(tri.getArea()>1e-12)triangles.push({tri,box:new Box3().setFromPoints([tri.a,tri.b,tri.c]),normal:tri.getNormal(new Vector3())});}
    const tree=buildTree(triangles),result=checkClearance(tree,hp,index);
    for(const w of result.crossingWitnesses){const m=mapping.find(m=>w.vertices[0]>=m.vertexStart&&w.vertices[0]<m.vertexStart+m.vertexCount);w.guide=m?.guide;w.ribbon=m?.ribbon;}
    clearance.push({state,...result});
    // Retain failed clearance as a visible draft defect; it must not masquerade as a qualified groom.
  }
  guard();requireThat(JSON.stringify(inputs)===JSON.stringify(manifest()),'Source modified during compilation');
  const arrays={position:new Float32Array(position),normal:new Float32Array(normals),uv:new Float32Array(uv),uv1:new Float32Array(uv1),index:new Uint32Array(index)};
  const frames=cardFrames(arrays.position,arrays.uv,mapping);guard();
  arrays.along=frames.along;arrays.across=frames.across;
  // Physical arc distance along each final ribbon centreline; roots stay at zero.
  arrays.rootDistance=new Float32Array(arrays.position.length/3);
  for(const m of mapping){let distance=0;const rows=m.vertexCount/3;
    for(let row=0;row<rows;row++){
      const centre=m.vertexStart+row*3+1;
      if(row>0){const previous=centre-3;
        distance+=Math.hypot(...[0,1,2].map(k=>arrays.position[centre*3+k]-arrays.position[previous*3+k]));}
      for(let cross=0;cross<3;cross++)arrays.rootDistance[m.vertexStart+row*3+cross]=distance;
    }
    requireThat(distance>.014,'Ribbon shorter than root transition '+m.guide);
  }
  guard();
  const output={};for(const [name,a]of Object.entries(arrays))output[name]=write(name+'.bin',Buffer.from(a.buffer,a.byteOffset,a.byteLength),limits.meshBytes);
  const report={version:'ember-hair-v068',guideSourceVersion:spec.version,samplingMethod:'adaptive-seven-probes-v068',inputs,output,guides:spec.guides.length+spec.coverageBands.length,ribbons:mapping.length,vertices:position.length/3,triangles:index.length/3,
    maxChordErrorM:maxChord,chordErrorQualification:'Authored guide centreline samples before root laying; final coverage centreline samples reported separately. No continuous or final surface bound.',minFrameTangentDot:minFrameDot,minTriangleAreaM2:minArea,minFaceAgreement,correctedWindingFaces,laidRootVertices,maxRootLayDisplacementM,coverageMaxSampledChordM,coverageWorst,radialFallbacks,coverageBands:spec.coverageBands.length,degenerateFacesRemoved,projectedVertices,maxProjectionM,scalpTriangles:scalp.length,scalpAllowlist:allow,
    roots,mapping,controlAnchors,headBindMatrix:headBind.toArray(),headJoint,bindReconstructionErrorM:restError,maxRootResidualM:maxRootResidual,
    cardFrame:frames.report,clearance,collisionPairs,atlas:pre.atlas,material:spec.material,limits,rearCoverageCore:spec.rearCoverageCore,bridgeShaping:spec.bridgeShaping,sideCoverage:spec.sideCoverage,earBridge:spec.earBridge,sideSurfaceFit,triangleSideClearance,innerSideReshape,crownEdgeReshape,upperSideReshape,
    resources:{cpuSeconds:(process.cpuUsage(start).user+process.cpuUsage(start).system)/1e6,rssBytes:process.memoryUsage().rss,wallSeconds:(performance.now()-wall)/1000},
    qualification:'Rendered development draft. Clearance and corrected root winding are reported defects, not waived acceptance criteria. No appearance, motion or complete-character acceptance.'};
  write('build-result.json',report,limits.reportBytes);write('COMPLETE.json',{utc:new Date().toISOString(),output,renderable:true,structuralChecks:clearance.every(c=>c.penetratingVertices===0&&c.triangleCrossings===0)&&correctedWindingFaces===0&&degenerateFacesRemoved===0,appearanceAccepted:false},limits.reportBytes);
  console.log(JSON.stringify({complete:true,vertices:report.vertices,triangles:report.triangles,clearance,collisionPairs,resources:report.resources}));
}

function buildTree(items){const box=new Box3();for(const t of items)box.union(t.box);if(items.length<=8)return {box,items};
  const size=box.getSize(new Vector3()),axis=size.x>size.y?(size.x>size.z?'x':'z'):(size.y>size.z?'y':'z');
  items.sort((a,b)=>(a.box.min[axis]+a.box.max[axis])-(b.box.min[axis]+b.box.max[axis]));const mid=items.length>>1;
  return {box,left:buildTree(items.slice(0,mid)),right:buildTree(items.slice(mid))};}

function nearest(tree,p,best={distance:Infinity,signed:Infinity}){
  if(tree.box.distanceToPoint(p)>best.distance)return best;
  if(tree.items){for(const t of tree.items){const q=t.tri.closestPointToPoint(p,new Vector3()),d=q.distanceTo(p);if(d<best.distance){best.distance=d;best.signed=p.clone().sub(q).dot(t.normal);best.point=q.clone();best.normal=t.normal.clone();}}}
  else{const a=tree.left.box.distanceToPoint(p),b=tree.right.box.distanceToPoint(p);nearest(a<b?tree.left:tree.right,p,best);nearest(a<b?tree.right:tree.left,p,best);}return best;
}
function overlap(tree,box,visit){if(!tree.box.intersectsBox(box))return;if(tree.items){for(const t of tree.items)if(t.box.intersectsBox(box))visit(t.tri);}else{overlap(tree.left,box,visit);overlap(tree.right,box,visit);}}
function crosses(a,b){
  for(const [one,two]of [[a,b],[b,a]])for(const [p,q]of [[one.a,one.b],[one.b,one.c],[one.c,one.a]]){
    const d=q.clone().sub(p),len=d.length();if(len<1e-10)continue;const ray=new Ray(p,d.divideScalar(len)),hit=ray.intersectTriangle(two.a,two.b,two.c,false,new Vector3());
    if(hit&&hit.distanceTo(p)>1e-7&&hit.distanceTo(p)<len-1e-7)return true;
  }return false;
}
function checkClearance(tree,points,indices){let penetratingVertices=0,triangleCrossings=0,minSignedM=Infinity;const witnesses=[],crossingWitnesses=[];
  for(let i=0;i<points.length;i++){if(i%128===0)guard();const n=nearest(tree,points[i]);minSignedM=Math.min(minSignedM,n.signed);
    if(n.signed<-.00005){penetratingVertices++;if(witnesses.length<8)witnesses.push({vertex:i,signedM:n.signed,nearestDistanceM:n.distance});}}
  for(let i=0;i<indices.length;i+=3){if(i%384===0)guard();const tri=new Triangle(...indices.slice(i,i+3).map(k=>points[k])),box=new Box3().setFromPoints([tri.a,tri.b,tri.c]);
    overlap(tree,box,other=>{collisionPairs++;requireThat(collisionPairs<=limits.collisionPairs,'Collision workload ceiling');if(crosses(tri,other)){triangleCrossings++;if(crossingWitnesses.length<24)crossingWitnesses.push({hairTriangle:i/3,vertices:indices.slice(i,i+3)});}});}
  return {penetratingVertices,triangleCrossings,minSignedM,witnesses,crossingWitnesses};
}
