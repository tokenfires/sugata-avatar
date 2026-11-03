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

const directory='docs/evidence/ember-2026-11-02-hair-v123/';
const sourceFile='tools/ember-hair/ember-waves-v123.json';
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
  'tools/ember-hair/card-frames-v011.mjs','tools/ember-hair/run-v123.py','tools/ember-hair/sample-adaptive-v003.mjs',
  'docs/evidence/ember-2026-10-31-hair-v001/preflight.json',
  'docs/evidence/ember-2026-10-31-hair-sampler-check/report.json',
  'docs/evidence/ember-2026-10-31-hair-sampler-check/review-receipt.json','tools/lut-bake/glb.mjs','tools/critic/png.mjs',
  'docs/evidence/ember-2026-11-02-hair-v123/gap-location.json','docs/evidence/ember-2026-11-02-hair-v123/crown-location.json','docs/evidence/ember-2026-11-02-hair-v123/fit-measurement.json','docs/evidence/ember-2026-11-02-hair-v123/upper-location.json','docs/evidence/ember-2026-11-02-hair-v123/adjacent-location.json','docs/evidence/ember-2026-11-02-hair-v123/corner-boundary.json','docs/evidence/ember-2026-11-02-hair-v123/notch-location.json','docs/evidence/ember-2026-11-02-hair-v123/seam-location.json','docs/evidence/ember-2026-11-02-hair-v123/wave-location.json','docs/evidence/ember-2026-11-02-hair-v123/strand-spacing.json','docs/evidence/ember-2026-11-02-hair-v123/neck-channel-location.json','docs/evidence/ember-2026-11-02-hair-v123/lower-channel-location.json','docs/evidence/ember-2026-11-02-hair-v123/opposite-channel-location.json','docs/evidence/ember-2026-11-02-hair-v123/bend-location.json','docs/evidence/ember-2026-11-02-hair-v123/notch-transition-location.json','docs/evidence/ember-2026-11-02-hair-v123/arch-location.json','docs/evidence/ember-2026-11-02-hair-v123/arch-adjacent-location.json','docs/evidence/ember-2026-11-02-hair-v123/opposite-arch-location.json','docs/evidence/ember-2026-11-02-hair-v123/visible-rim-location.json','docs/evidence/ember-2026-11-02-hair-v123/edge-config.json','docs/evidence/ember-2026-11-02-hair-v123/quarter-rim-location.json','docs/evidence/ember-2026-11-02-hair-v123/quarter-edge-config.json','docs/evidence/ember-2026-11-02-hair-v123/quarter-arch-location.json','docs/evidence/ember-2026-11-02-hair-v123/mid-rim-location.json','docs/evidence/ember-2026-11-02-hair-v123/mid-edge-config.json','docs/evidence/ember-2026-11-02-hair-v123/mid-rear-location.json','docs/evidence/ember-2026-11-02-hair-v123/slot-rim-location.json','docs/evidence/ember-2026-11-02-hair-v123/slot-edge-config.json','docs/evidence/ember-2026-11-02-hair-v123/upper-slot-location.json','docs/evidence/ember-2026-11-02-hair-v123/tab-location.json','docs/evidence/ember-2026-11-02-hair-v123/taper-edge-config.json','docs/evidence/ember-2026-11-02-hair-v123/opposite-slot-location.json','docs/evidence/ember-2026-11-02-hair-v123/opposite-slot-rim.json','docs/evidence/ember-2026-11-02-hair-v123/opposite-slot-config.json','docs/evidence/ember-2026-11-02-hair-v123/neck-triangle-location.json','docs/evidence/ember-2026-11-02-hair-v123/neck-triangle-rim.json','docs/evidence/ember-2026-11-02-hair-v123/neck-triangle-config.json','docs/evidence/ember-2026-11-02-hair-v123/quarter-slot-location.json','docs/evidence/ember-2026-11-02-hair-v123/quarter-slot-rim.json','docs/evidence/ember-2026-11-02-hair-v123/quarter-slot-config.json','docs/evidence/ember-2026-11-02-hair-v123/rear-arch-rim.json','docs/evidence/ember-2026-11-02-hair-v123/rear-arch-hits.json','docs/evidence/ember-2026-11-02-hair-v123/rear-arch-alpha-probe.json','docs/evidence/ember-2026-11-02-hair-v123/rear-arch-config.json','docs/evidence/ember-2026-11-02-hair-v123/rear-arch-rim.json','docs/evidence/ember-2026-11-02-hair-v123/rear-arch-hits.json','docs/evidence/ember-2026-11-02-hair-v123/upper-crown-rim.json','docs/evidence/ember-2026-11-02-hair-v123/upper-crown-hits.json','docs/evidence/ember-2026-11-02-hair-v123/upper-crown-alpha-probe.json','docs/evidence/ember-2026-11-02-hair-v123/quarter-patch-config.json','docs/evidence/ember-2026-11-02-hair-v123/quarter-patch-rim.json','docs/evidence/ember-2026-11-02-hair-v123/quarter-patch-hits.json','docs/evidence/ember-2026-11-02-hair-v123/opposite-crown-config.json','docs/evidence/ember-2026-11-02-hair-v123/opposite-crown-rim.json','docs/evidence/ember-2026-11-02-hair-v123/opposite-crown-hits.json','docs/evidence/ember-2026-11-02-hair-v123/rear-crown-rim.json','docs/evidence/ember-2026-11-02-hair-v123/rear-crown-hits.json','docs/evidence/ember-2026-11-02-hair-v123/rear-alpha-probe.json','docs/evidence/ember-2026-11-02-hair-v123/crown-opening-config.json','docs/evidence/ember-2026-11-02-hair-v123/crown-opening-rim.json','docs/evidence/ember-2026-11-02-hair-v123/crown-opening-hits.json','docs/evidence/ember-2026-11-02-hair-v123/adjacent-quarter-rim.json','docs/evidence/ember-2026-11-02-hair-v123/adjacent-quarter-config.json','docs/evidence/ember-2026-11-02-hair-v123/neck-strip-location.json','docs/evidence/ember-2026-11-02-hair-v123/neck-strip-rim.json','docs/evidence/ember-2026-11-02-hair-v123/neck-strip-config.json','docs/evidence/ember-2026-11-02-hair-v123/neck-alpha-location.json','docs/evidence/ember-2026-11-02-hair-v123/lower-return-location.json','docs/evidence/ember-2026-11-02-hair-v123/neck-strand-spacing.json','docs/evidence/ember-2026-11-02-hair-v123/neck-upper-location.json','docs/evidence/ember-2026-11-02-hair-v123/neck-upper-rim.json','docs/evidence/ember-2026-11-02-hair-v123/neck-upper-config.json','docs/evidence/ember-2026-11-02-hair-v123/neck-middle-location.json','docs/evidence/ember-2026-11-02-hair-v123/neck-middle-rim.json','docs/evidence/ember-2026-11-02-hair-v123/neck-middle-config.json','docs/evidence/ember-2026-11-02-hair-v123/mid-opening-location.json','docs/evidence/ember-2026-11-02-hair-v123/mid-opening-rim.json','docs/evidence/ember-2026-11-02-hair-v123/mid-opening-config.json','docs/evidence/ember-2026-11-02-hair-v123/adjacent-slot-location.json','docs/evidence/ember-2026-11-02-hair-v123/adjacent-slot-rim.json','docs/evidence/ember-2026-11-02-hair-v123/adjacent-slot-config.json','packages/testbed/ember-hair-v123.html','packages/testbed/src/ember-hair-v123.js',
  'packages/testbed/src/ember-hair-v123-component.js','packages/testbed/src/ember-hair-v047-motion.js','package-lock.json'];
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
  const atlas=atlasCheck();guard();write('preflight.json',{inputs,limits,atlas,guides:spec.guides.length+spec.coverageBands.length+1,ribbons:spec.guides.reduce((n,g)=>n+g.ribbons.length,0)+spec.coverageBands.length+1,
    scope:'Source/atlas preflight only; no geometry compilation or camera/identity solve'},limits.reportBytes);
  console.log(JSON.stringify({preflight:true,guides:spec.guides.length+spec.coverageBands.length+1,ribbons:spec.guides.reduce((n,g)=>n+g.ribbons.length,0)+spec.coverageBands.length+1,atlasRootConventionVerified:true}));
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
  // Reallocate the original 42 vertices into two seven-row, three-column
  // sections. All other buffers keep their vertex addresses and correspondence.
  const scalpSplit={sourceGuide:spec.scalpSplit.sourceGuide,sections:[],originalVertices:42,
    finalVertices:42,lowerAtlasRestore:spec.scalpSplit.lowerAtlasRestore,maxRearExtensionM:0,maxDepthFitM:0,maxTriangleCorrectionM:0,
    triangleSamples:0,triangleConstraints:0,rayMisses:0,preservedAnchors:[],
    qualification:'Two-section resampling trial. Original adaptive centreline tolerance does not qualify these final resampled sections.'};
  {const cfg=spec.scalpSplit,mi=mapping.findIndex(m=>m.guide===cfg.sourceGuide),old=mapping[mi];
    requireThat(old&&old.vertexCount===42,'Split source correspondence');
    const sourceRows=old.parameters.map((t,row)=>[0,1,2].map(c=>new Vector3().fromArray(position,(old.vertexStart+row*3+c)*3)));
    const sourceRoots=roots.filter(a=>a.guide===cfg.sourceGuide);
    requireThat(sourceRoots.length===3,'Split source anchors');
    function rowAt(t){let hi=old.parameters.findIndex(v=>v>=t);if(hi===0)return sourceRows[0].map(p=>p.clone());
      if(hi<0)hi=old.parameters.length-1;const lo=hi-1,w=(t-old.parameters[lo])/(old.parameters[hi]-old.parameters[lo]);
      return sourceRows[lo].map((p,c)=>p.clone().lerp(sourceRows[hi][c],w));}
    function acrossRow(row,u){const c=u<=.5?0:1,w=u<=.5?u*2:(u-.5)*2;return row[c].clone().lerp(row[c+1],w);}
    function rearBoundary(y){let z=Infinity;for(const {tri,box}of sideRayTriangles){if(y<box.min.y||y>box.max.y)continue;
      for(const [a,b]of [[tri.a,tri.b],[tri.b,tri.c],[tri.c,tri.a]]){
        if((y-a.y)*(y-b.y)>0||Math.abs(b.y-a.y)<1e-10)continue;const w=(y-a.y)/(b.y-a.y);
        if(w>=0&&w<=1)z=Math.min(z,a.z+(b.z-a.z)*w);
      }}return z;}
    const oldIndex=index.filter((_,i)=>{const start=i-i%3;return !index.slice(start,start+3).every(v=>v>=old.vertexStart&&v<old.vertexStart+old.vertexCount);});
    index.length=0;index.push(...oldIndex);
    for(let i=roots.length-1;i>=0;i--)if(roots[i].guide===cfg.sourceGuide)roots.splice(i,1);
    const newMapping=[],movable=new Set();
    for(let section=0;section<2;section++){
      const part=cfg.sections[section],parameters=part.parameters,base=old.vertexStart+section*21;
      requireThat(parameters.length===7&&parameters[0]===0&&parameters[6]===1,'Split row budget');
      for(let row=0;row<7;row++){
        const t=parameters[row],points=rowAt(t),original=points.map(p=>p.clone());
        const extension=smooth((t-cfg.extension.start)/(cfg.extension.full-cfg.extension.start))
          *(1-smooth((t-cfg.extension.fade)/(cfg.extension.end-cfg.extension.fade)));
        const desired=Math.max(0,points[0].z-cfg.extension.targetRearZ)*extension;
        requireThat(desired<=cfg.extension.maxRearwardM,'Split extension ceiling');
        points[0].z-=desired;
        if(extension>0){const rear=rearBoundary(points[0].y);requireThat(Number.isFinite(rear),'Split rear boundary missing');
          points[0].z=Math.min(original[0].z,Math.max(points[0].z,rear+cfg.extension.surfaceInsetM));}
        scalpSplit.maxRearExtensionM=Math.max(scalpSplit.maxRearExtensionM,original[0].z-points[0].z);
        // Move the interior division across the widened footprint, preserving
        // root/end cross sections and the original exterior row boundaries.
        points[1].lerp(points[0].clone().lerp(points[2],.5),extension);
        const active=smooth(t/cfg.rootBlendEnd)*(1-smooth((t-cfg.endBlendStart)/(1-cfg.endBlendStart)));
        const overlap=cfg.overlapFraction*active;
        const span=section===0?[0,.5+overlap]:[.5-overlap,1];
        for(let cross=0;cross<3;cross++){
          const u=span[0]+(span[1]-span[0])*cross/2,vertex=base+row*3+cross,p=acrossRow(points,u);
          if(row===0){let anchorData;
            if(u===0||u===.5||u===1){const c=Math.round(u*2);p.copy(sourceRows[0][c]);anchorData={...sourceRoots[c]};
              scalpSplit.preservedAnchors.push({oldVertex:sourceRoots[c].vertex,newVertex:vertex});}
            else {const fitted=radialScalp(p,cfg.rootOffsetM);p.copy(fitted.position);anchorData=fitted.record;}
            roots.push({...anchorData,vertex,guide:part.id,ribbon:0,cross});
          }else if(row<6){const sx=sideSurfaceX(p);
            if(Number.isFinite(sx)){const dx=(sx-cfg.surfaceOffsetM-p.x)*active;
              requireThat(Math.abs(dx)<=cfg.maxDepthFitM,'Split depth fit ceiling');p.x+=dx;
              scalpSplit.maxDepthFitM=Math.max(scalpSplit.maxDepthFitM,Math.abs(dx));}
            else scalpSplit.rayMisses++;
            movable.add(vertex);
          }
          p.toArray(position,vertex*3);
          expectedNormals[vertex]=nearest(headTree,p).normal.clone();
          // Each section gets the same existing strand atlas and dense-core
          // profile; the overlap prevents coincident alpha-feather boundaries.
          const atlasRestore=smooth((t-cfg.lowerAtlasRestore.start)/(cfg.lowerAtlasRestore.full-cfg.lowerAtlasRestore.start));
          const atlasU=cross/2+(u-cross/2)*atlasRestore;
          uv[vertex*2]=old.strip/8+1/1024+atlasU*(1/8-2/1024);uv[vertex*2+1]=t;
          uv1[vertex*2]=(old.lockGroup+.5)/16;uv1[vertex*2+1]=0;
          if(row<6&&cross<2){const a=base+row*3+cross,b=a+3;index.push(a,b,b+1,a,b+1,a+1);}
        }
      }
      const m={...old,guide:part.id,vertexStart:base,vertexCount:21,segments:6,parameters,
        sampling:{method:'staggered seven-row section resampling',parameters,continuousBoundCertified:false,finalSurfaceQualified:false}};
      newMapping.push(m);scalpSplit.sections.push({guide:part.id,vertexStart:base,vertexCount:21,parameters});
    }
    mapping.splice(mi,1,...newMapping);
    // One non-iterative outward constraint pass: sample triangle interiors,
    // sharing the correction across movable vertices and keeping roots/ends fixed.
    const shifts=new Map();
    for(let i=0;i<index.length;i+=3){const vi=index.slice(i,i+3);if(!vi.every(v=>v>=old.vertexStart&&v<old.vertexStart+42))continue;guard();
      const pts=vi.map(v=>new Vector3().fromArray(position,v*3)),n=cfg.subdivisions;
      for(let a=0;a<=n;a++)for(let b=0;b<=n-a;b++){
        const bary=[a/n,b/n,1-(a+b)/n],weight=vi.reduce((sum,v,k)=>sum+(movable.has(v)?bary[k]:0),0);if(weight<1e-6)continue;
        const p=new Vector3();pts.forEach((q,k)=>p.addScaledVector(q,bary[k]));const sx=sideSurfaceX(p);
        scalpSplit.triangleSamples++;if(!Number.isFinite(sx))continue;
        const correction=(p.x-sx+cfg.triangleMarginM)/weight;if(correction<=0)continue;
        requireThat(correction<=cfg.maxTriangleCorrectionM,'Split triangle correction ceiling '+JSON.stringify({triangle:i/3,correction}));
        scalpSplit.triangleConstraints++;
        for(const v of vi)if(movable.has(v))shifts.set(v,Math.max(shifts.get(v)??0,correction));
      }
    }
    for(const [v,dx]of shifts){position[v*3]-=dx;scalpSplit.maxTriangleCorrectionM=Math.max(scalpSplit.maxTriangleCorrectionM,dx);}
    // All original terminal positions remain represented at the two new ends.
    const end0=old.vertexStart+18,end1=old.vertexStart+39;
    for(const [oldCross,newVertex]of [[0,end0],[1,end0+2],[1,end1],[2,end1+2]])
      requireThat(new Vector3().fromArray(position,newVertex*3).distanceTo(sourceRows.at(-1)[oldCross])<1e-12,'Split terminal target drift');
  }

  const returnJoin={guide:spec.returnJoin.guide,vertices:[],maxOutwardM:0,triangleSamples:0,triangleConstraints:0};
  {const cfg=spec.returnJoin,m=mapping.find(m=>m.guide===cfg.guide),movable=new Set();
    requireThat(m&&cfg.row>0&&cfg.row<m.vertexCount/3-1,'Return join row correspondence');
    for(let cross=0;cross<3;cross++){
      const backward=cfg.backwardByColumnM[cross];if(!backward)continue;
      const vertex=m.vertexStart+cfg.row*3+cross,p=new Vector3().fromArray(position,vertex*3),before=p.clone();
      p.z-=backward;const sx=sideSurfaceX(p);if(Number.isFinite(sx))p.x=Math.min(p.x,sx-cfg.surfaceOffsetM);
      requireThat(before.x-p.x<=cfg.maxOutwardM,'Return join outward ceiling');
      p.toArray(position,vertex*3);movable.add(vertex);
      returnJoin.vertices.push({vertex,row:cfg.row,cross,before:before.toArray(),backwardM:backward,outwardM:before.x-p.x});
      returnJoin.maxOutwardM=Math.max(returnJoin.maxOutwardM,before.x-p.x);
    }
    const shifts=new Map();
    for(let i=0;i<index.length;i+=3){const vi=index.slice(i,i+3);if(!vi.some(v=>movable.has(v)))continue;guard();
      const pts=vi.map(v=>new Vector3().fromArray(position,v*3)),n=cfg.subdivisions;
      for(let a=0;a<=n;a++)for(let b=0;b<=n-a;b++){
        const bary=[a/n,b/n,1-(a+b)/n],weight=vi.reduce((sum,v,k)=>sum+(movable.has(v)?bary[k]:0),0);if(weight<1e-6)continue;
        const p=new Vector3();pts.forEach((q,k)=>p.addScaledVector(q,bary[k]));const sx=sideSurfaceX(p);
        returnJoin.triangleSamples++;if(!Number.isFinite(sx))continue;
        const correction=(p.x-sx+cfg.triangleMarginM)/weight;if(correction<=0)continue;
        requireThat(correction<=cfg.maxOutwardM,'Return join triangle correction ceiling');returnJoin.triangleConstraints++;
        for(const v of vi)if(movable.has(v))shifts.set(v,Math.max(shifts.get(v)??0,correction));
      }
    }
    for(const [v,dx]of shifts){const move=returnJoin.vertices.find(q=>q.vertex===v);
      requireThat(move.outwardM+dx<=cfg.maxOutwardM,'Return join combined correction ceiling');
      position[v*3]-=dx;move.outwardM+=dx;returnJoin.maxOutwardM=Math.max(returnJoin.maxOutwardM,move.outwardM);}
  }
  // Carry the neighboring wave's existing cross-section into the measured gap.
  // Only the inner edge moves; centreline/opposite edge and both terminal rows stay fixed.
  const waveEdgeReshape={guide:spec.waveEdgeReshape.guide,vertices:[],maxDisplacementM:0,
    maxBackwardM:0,maxOutwardM:0,qualification:spec.waveEdgeReshape.qualification};
  {const cfg=spec.waveEdgeReshape,m=mapping.find(m=>m.guide===cfg.guide&&m.ribbon===cfg.ribbon);
    requireThat(m&&m.vertexCount===123,'Descending wave correspondence');
    for(let row=1;row<m.vertexCount/3-1;row++){
      const t=m.parameters[row],weight=smooth((t-cfg.start)/(cfg.full-cfg.start))*(1-smooth((t-cfg.fade)/(cfg.end-cfg.fade)));
      if(!weight)continue;
      const vertex=m.vertexStart+row*3+cfg.crossColumn,p=new Vector3().fromArray(position,vertex*3),before=p.clone(),
        centre=new Vector3().fromArray(position,(m.vertexStart+row*3+1)*3),
        extension=p.clone().sub(centre).multiplyScalar(cfg.additionalHalfWidthScale*weight);
      requireThat(extension.length()<=cfg.maxDisplacementM,'Wave edge displacement ceiling');
      requireThat(extension.x<=0&&extension.z<0,'Wave edge must extend outward and toward measured gap');
      p.add(extension).toArray(position,vertex*3);
      waveEdgeReshape.maxDisplacementM=Math.max(waveEdgeReshape.maxDisplacementM,extension.length());
      waveEdgeReshape.maxBackwardM=Math.max(waveEdgeReshape.maxBackwardM,-extension.z);
      waveEdgeReshape.maxOutwardM=Math.max(waveEdgeReshape.maxOutwardM,-extension.x);
      waveEdgeReshape.vertices.push({vertex,row,cross:cfg.crossColumn,t,weight,before:before.toArray(),after:p.toArray(),extension:extension.toArray()});
    }
    requireThat(waveEdgeReshape.vertices.length>0,'No wave edge extension');
  }
  // Fill the upper neck-side channel with an existing inner rear wave.
  // The centreline, opposite edge and root/end rows remain unchanged.
  const neckChannelReshape={guide:spec.neckChannelReshape.guide,vertices:[],maxDisplacementM:0,
    maxForwardM:0,maxOutwardM:0,qualification:spec.neckChannelReshape.qualification};
  {const cfg=spec.neckChannelReshape,m=mapping.find(m=>m.guide===cfg.guide&&m.ribbon===cfg.ribbon);
    requireThat(m&&m.vertexCount===120,'Neck channel wave correspondence');
    for(let row=1;row<m.vertexCount/3-1;row++){
      const t=m.parameters[row],weight=smooth((t-cfg.start)/(cfg.full-cfg.start))*(1-smooth((t-cfg.fade)/(cfg.end-cfg.fade)));
      if(!weight)continue;
      const vertex=m.vertexStart+row*3+cfg.crossColumn,p=new Vector3().fromArray(position,vertex*3),before=p.clone(),
        centre=new Vector3().fromArray(position,(m.vertexStart+row*3+1)*3),extension=p.clone().sub(centre).multiplyScalar(cfg.additionalHalfWidthScale*weight);
      requireThat(extension.length()<=cfg.maxDisplacementM,'Neck channel edge displacement ceiling');
      requireThat(extension.x>=0&&extension.z>0,'Neck channel edge must extend outward toward the opening');
      p.add(extension).toArray(position,vertex*3);
      neckChannelReshape.maxDisplacementM=Math.max(neckChannelReshape.maxDisplacementM,extension.length());
      neckChannelReshape.maxForwardM=Math.max(neckChannelReshape.maxForwardM,extension.z);
      neckChannelReshape.maxOutwardM=Math.max(neckChannelReshape.maxOutwardM,extension.x);
      neckChannelReshape.vertices.push({vertex,row,cross:cfg.crossColumn,t,weight,before:before.toArray(),after:p.toArray(),extension:extension.toArray()});
    }
    requireThat(neckChannelReshape.vertices.length>0,'No neck channel edge extension');
  }
  // Continue the retained width into the lower S-bend without lowering any edge.
  const neckChannelLower={guide:spec.neckChannelLower.guide,vertices:[],maxAdditionalDisplacementM:0,
    maxForwardM:0,maxOutwardM:0,upperFixedThroughRow:spec.neckChannelLower.upperFixedThroughRow};
  {const cfg=spec.neckChannelLower,m=mapping.find(m=>m.guide===cfg.guide&&m.ribbon===cfg.ribbon);
    requireThat(m&&m.vertexCount===120,'Lower neck channel correspondence');
    for(let row=cfg.upperFixedThroughRow+1;row<m.vertexCount/3-1;row++){
      const t=m.parameters[row],lowerWeight=smooth((t-cfg.start)/(cfg.full-cfg.start))*(1-smooth((t-cfg.fade)/(cfg.end-cfg.fade))),
        retained=neckChannelReshape.vertices.find(v=>v.row===row),oldWeight=retained?.weight??0,addedWeight=Math.max(0,lowerWeight-oldWeight);
      if(!addedWeight)continue;
      const vertex=m.vertexStart+row*3+cfg.crossColumn,p=new Vector3().fromArray(position,vertex*3),before=p.clone(),
        original=retained?new Vector3().fromArray(retained.before):p.clone(),centre=new Vector3().fromArray(position,(m.vertexStart+row*3+1)*3),
        extension=original.sub(centre).multiplyScalar(spec.neckChannelReshape.additionalHalfWidthScale*addedWeight);
      extension.y=0;
      requireThat(extension.length()<=cfg.maxAdditionalDisplacementM,'Lower channel additional displacement ceiling');
      requireThat(extension.x>=0&&extension.z>0,'Lower channel must widen outward toward gap');
      p.add(extension).toArray(position,vertex*3);
      neckChannelLower.maxAdditionalDisplacementM=Math.max(neckChannelLower.maxAdditionalDisplacementM,extension.length());
      neckChannelLower.maxForwardM=Math.max(neckChannelLower.maxForwardM,extension.z);
      neckChannelLower.maxOutwardM=Math.max(neckChannelLower.maxOutwardM,extension.x);
      neckChannelLower.vertices.push({vertex,row,cross:cfg.crossColumn,t,oldWeight,lowerWeight,addedWeight,before:before.toArray(),after:p.toArray(),extension:extension.toArray()});
    }
    requireThat(neckChannelLower.vertices.length>0,'No lower channel extension');
  }
  // Widen an existing inner rear wave toward the opposite neck-side opening.
  // All heights, centreline, opposite edge and original root/end rows stay fixed.
  const oppositeChannelReshape={guide:spec.oppositeChannelReshape.guide,vertices:[],maxDisplacementM:0,
    maxRearwardM:0,maxMedialM:0,qualification:spec.oppositeChannelReshape.qualification};
  {const cfg=spec.oppositeChannelReshape,m=mapping.find(m=>m.guide===cfg.guide&&m.ribbon===cfg.ribbon);
    requireThat(m&&m.vertexCount===114,'Opposite neck channel wave correspondence');
    for(let row=1;row<m.vertexCount/3-1;row++){
      const t=m.parameters[row],originalWeight=smooth((t-cfg.start)/(cfg.full-cfg.start))*(1-smooth((t-cfg.fade)/(cfg.end-cfg.fade))),
        bend=cfg.bendTaper,bendWeight=smooth((t-bend.start)/(bend.full-bend.start))*(1-smooth((t-bend.fade)/(bend.end-bend.fade))),
        retainedFraction=1-(1-bend.retainedFraction)*bendWeight,weight=originalWeight*retainedFraction;
      if(!weight)continue;
      const vertex=m.vertexStart+row*3+cfg.crossColumn,p=new Vector3().fromArray(position,vertex*3),before=p.clone(),
        centre=new Vector3().fromArray(position,(m.vertexStart+row*3+1)*3),extension=p.clone().sub(centre).multiplyScalar(cfg.additionalHalfWidthScale*weight);
      extension.y=0;
      requireThat(extension.length()<=cfg.maxDisplacementM,'Opposite neck channel edge displacement ceiling');
      requireThat(extension.x>0&&extension.z<0,'Opposite neck channel edge must extend medially and rearward toward opening');
      p.add(extension).toArray(position,vertex*3);
      oppositeChannelReshape.maxDisplacementM=Math.max(oppositeChannelReshape.maxDisplacementM,extension.length());
      oppositeChannelReshape.maxRearwardM=Math.max(oppositeChannelReshape.maxRearwardM,-extension.z);
      oppositeChannelReshape.maxMedialM=Math.max(oppositeChannelReshape.maxMedialM,extension.x);
      oppositeChannelReshape.vertices.push({vertex,row,cross:cfg.crossColumn,t,originalWeight,bendWeight,retainedFraction,weight,before:before.toArray(),after:p.toArray(),extension:extension.toArray()});
    }
    requireThat(oppositeChannelReshape.vertices.length>0,'No opposite neck channel edge extension');
  }
  // Extend an existing inner wave into the upper-rear arch, preserving its heights.
  const archEdgeReshape={guide:spec.archEdgeReshape.guide,vertices:[],maxDisplacementM:0,
    qualification:spec.archEdgeReshape.qualification};
  {const cfg=spec.archEdgeReshape,m=mapping.find(m=>m.guide===cfg.guide&&m.ribbon===cfg.ribbon);
    requireThat(m&&m.vertexCount===114,'Upper-rear arch wave correspondence');
    for(let row=1;row<m.vertexCount/3-1;row++){
      const t=m.parameters[row],weight=smooth((t-cfg.start)/(cfg.full-cfg.start))*(1-smooth((t-cfg.fade)/(cfg.end-cfg.fade)));
      if(!weight)continue;
      const vertex=m.vertexStart+row*3+cfg.crossColumn,p=new Vector3().fromArray(position,vertex*3),before=p.clone(),
        extension=new Vector3(0,0,-cfg.rearwardM*weight);
      requireThat(extension.length()<=cfg.maxDisplacementM,'Upper-rear arch displacement ceiling');
      p.add(extension).toArray(position,vertex*3);
      archEdgeReshape.maxDisplacementM=Math.max(archEdgeReshape.maxDisplacementM,extension.length());
      archEdgeReshape.vertices.push({vertex,row,cross:cfg.crossColumn,t,weight,before:before.toArray(),after:p.toArray(),extension:extension.toArray()});
    }
    requireThat(archEdgeReshape.vertices.length>0,'No upper-rear arch edge extension');
  }
  // Overlap the upper-rear fill with a staggered neighboring inner wave.
  const archAdjacentReshape={guide:spec.archAdjacentReshape.guide,vertices:[],maxDisplacementM:0,
    qualification:spec.archAdjacentReshape.qualification};
  {const cfg=spec.archAdjacentReshape,m=mapping.find(m=>m.guide===cfg.guide&&m.ribbon===cfg.ribbon);
    requireThat(m&&m.vertexCount===111,'Adjacent upper-rear arch wave correspondence');
    for(let row=1;row<m.vertexCount/3-1;row++){
      const t=m.parameters[row],weight=smooth((t-cfg.start)/(cfg.full-cfg.start))*(1-smooth((t-cfg.fade)/(cfg.end-cfg.fade)));
      if(!weight)continue;
      const vertex=m.vertexStart+row*3+cfg.crossColumn,p=new Vector3().fromArray(position,vertex*3),before=p.clone(),
        extension=new Vector3(0,0,-cfg.rearwardM*weight);
      requireThat(extension.length()<=cfg.maxDisplacementM,'Adjacent upper-rear arch displacement ceiling');
      p.add(extension).toArray(position,vertex*3);
      archAdjacentReshape.maxDisplacementM=Math.max(archAdjacentReshape.maxDisplacementM,extension.length());
      archAdjacentReshape.vertices.push({vertex,row,cross:cfg.crossColumn,t,weight,before:before.toArray(),after:p.toArray(),extension:extension.toArray()});
    }
    requireThat(archAdjacentReshape.vertices.length>0,'No adjacent upper-rear arch edge extension');
  }
  // Fill beneath the opposite arch using an existing wave's upper boundary.
  const oppositeArchReshape={guide:spec.oppositeArchReshape.guide,vertices:[],maxDisplacementM:0,
    qualification:spec.oppositeArchReshape.qualification};
  {const cfg=spec.oppositeArchReshape,m=mapping.find(m=>m.guide===cfg.guide&&m.ribbon===cfg.ribbon);
    requireThat(m&&m.vertexCount===114,'Opposite upper-rear arch wave correspondence');
    for(let row=1;row<m.vertexCount/3-1;row++){
      const t=m.parameters[row],weight=smooth((t-cfg.start)/(cfg.full-cfg.start))*(1-smooth((t-cfg.fade)/(cfg.end-cfg.fade)));
      if(!weight)continue;
      const vertex=m.vertexStart+row*3+cfg.crossColumn,p=new Vector3().fromArray(position,vertex*3),before=p.clone(),
        extension=new Vector3(0,0,-cfg.rearwardM*weight);
      requireThat(extension.length()<=cfg.maxDisplacementM,'Opposite upper-rear arch displacement ceiling');
      p.add(extension).toArray(position,vertex*3);
      oppositeArchReshape.maxDisplacementM=Math.max(oppositeArchReshape.maxDisplacementM,extension.length());
      oppositeArchReshape.vertices.push({vertex,row,cross:cfg.crossColumn,t,weight,before:before.toArray(),after:p.toArray(),extension:extension.toArray()});
    }
    requireThat(oppositeArchReshape.vertices.length>0,'No opposite upper-rear arch edge extension');
  }
  // Widen the visible inner rim of the outer occipital arch into its opening.
  const visibleRimReshape={guide:spec.visibleRimReshape.guide,vertices:[],maxDisplacementM:0,
    qualification:spec.visibleRimReshape.qualification};
  {const cfg=spec.visibleRimReshape,m=mapping.find(m=>m.guide===cfg.guide&&m.ribbon===cfg.ribbon);
    requireThat(m&&m.vertexCount===117,'Visible rim wave correspondence');
    for(let row=1;row<m.vertexCount/3-1;row++){
      const t=m.parameters[row],weight=smooth((t-cfg.start)/(cfg.full-cfg.start))*(1-smooth((t-cfg.fade)/(cfg.end-cfg.fade)));
      if(!weight)continue;
      const vertex=m.vertexStart+row*3+cfg.crossColumn,p=new Vector3().fromArray(position,vertex*3),before=p.clone(),
        extension=new Vector3(0,0,cfg.forwardM*weight);
      requireThat(extension.length()<=cfg.maxDisplacementM,'Visible rim displacement ceiling');
      p.add(extension).toArray(position,vertex*3);
      visibleRimReshape.maxDisplacementM=Math.max(visibleRimReshape.maxDisplacementM,extension.length());
      visibleRimReshape.vertices.push({vertex,row,cross:cfg.crossColumn,t,weight,before:before.toArray(),after:p.toArray(),extension:extension.toArray()});
    }
    requireThat(visibleRimReshape.vertices.length>0,'No visible rim edge extension');
  }
  // Widen the visible inner rim of the outer occipital arch into its opening.
  const quarterRimReshape={guide:spec.quarterRimReshape.guide,vertices:[],maxDisplacementM:0,
    qualification:spec.quarterRimReshape.qualification};
  {const cfg=spec.quarterRimReshape,m=mapping.find(m=>m.guide===cfg.guide&&m.ribbon===cfg.ribbon);
    requireThat(m&&m.vertexCount===123,'Quarter-view rim wave correspondence');
    for(let row=1;row<m.vertexCount/3-1;row++){
      const t=m.parameters[row],weight=smooth((t-cfg.start)/(cfg.full-cfg.start))*(1-smooth((t-cfg.fade)/(cfg.end-cfg.fade)));
      if(!weight)continue;
      const vertex=m.vertexStart+row*3+cfg.crossColumn,p=new Vector3().fromArray(position,vertex*3),before=p.clone(),
        extension=new Vector3(0,0,cfg.forwardM*weight);
      requireThat(extension.length()<=cfg.maxDisplacementM,'Quarter-view rim displacement ceiling');
      p.add(extension).toArray(position,vertex*3);
      quarterRimReshape.maxDisplacementM=Math.max(quarterRimReshape.maxDisplacementM,extension.length());
      quarterRimReshape.vertices.push({vertex,row,cross:cfg.crossColumn,t,weight,before:before.toArray(),after:p.toArray(),extension:extension.toArray()});
    }
    requireThat(quarterRimReshape.vertices.length>0,'No quarter-view rim edge extension');
  }
  // Widen the visible inner rim of the outer occipital arch into its opening.
  const midRearReshape={guide:spec.midRearReshape.guide,vertices:[],maxDisplacementM:0,
    qualification:spec.midRearReshape.qualification};
  {const cfg=spec.midRearReshape,m=mapping.find(m=>m.guide===cfg.guide&&m.ribbon===cfg.ribbon);
    requireThat(m&&m.vertexCount===117,'Mid-rear wave wave correspondence');
    for(let row=1;row<m.vertexCount/3-1;row++){
      const t=m.parameters[row],weight=smooth((t-cfg.start)/(cfg.full-cfg.start))*(1-smooth((t-cfg.fade)/(cfg.end-cfg.fade)));
      if(!weight)continue;
      const vertex=m.vertexStart+row*3+cfg.crossColumn,p=new Vector3().fromArray(position,vertex*3),before=p.clone(),
        extension=new Vector3(0,0,cfg.forwardM*weight);
      requireThat(extension.length()<=cfg.maxDisplacementM,'Mid-rear wave displacement ceiling');
      p.add(extension).toArray(position,vertex*3);
      midRearReshape.maxDisplacementM=Math.max(midRearReshape.maxDisplacementM,extension.length());
      midRearReshape.vertices.push({vertex,row,cross:cfg.crossColumn,t,weight,before:before.toArray(),after:p.toArray(),extension:extension.toArray()});
    }
    requireThat(midRearReshape.vertices.length>0,'No mid-rear wave edge extension');
  }
  // Widen the visible inner rim of the outer occipital arch into its opening.
  const upperSlotReshape={guide:spec.upperSlotReshape.guide,vertices:[],maxDisplacementM:0,
    qualification:spec.upperSlotReshape.qualification};
  {const cfg=spec.upperSlotReshape,m=mapping.find(m=>m.guide===cfg.guide&&m.ribbon===cfg.ribbon);
    requireThat(m&&m.vertexCount===123,'Upper slot ribbon correspondence');
    for(let row=1;row<m.vertexCount/3-1;row++){
      const t=m.parameters[row],weight=smooth((t-cfg.start)/(cfg.full-cfg.start))*(1-smooth((t-cfg.fade)/(cfg.end-cfg.fade)));
      if(!weight)continue;
      const vertex=m.vertexStart+row*3+cfg.crossColumn,p=new Vector3().fromArray(position,vertex*3),before=p.clone(),
        extension=new Vector3(0,0,-cfg.rearwardM*weight);
      requireThat(extension.length()<=cfg.maxDisplacementM,'Upper slot displacement ceiling');
      p.add(extension).toArray(position,vertex*3);
      upperSlotReshape.maxDisplacementM=Math.max(upperSlotReshape.maxDisplacementM,extension.length());
      upperSlotReshape.vertices.push({vertex,row,cross:cfg.crossColumn,t,weight,before:before.toArray(),after:p.toArray(),extension:extension.toArray()});
    }
    requireThat(upperSlotReshape.vertices.length>0,'No upper slot edge extension');
  }
  // Fill the opposite upper slot along its existing wave, tapering both returns.
  const oppositeSlotReshape={guide:spec.oppositeSlotReshape.guide,vertices:[],maxDisplacementM:0,
    qualification:spec.oppositeSlotReshape.qualification};
  {const cfg=spec.oppositeSlotReshape,m=mapping.find(m=>m.guide===cfg.guide&&m.ribbon===cfg.ribbon);
    requireThat(m&&m.vertexCount===120,'Opposite upper slot correspondence');
    for(let row=1;row<m.vertexCount/3-1;row++){
      const t=m.parameters[row],weight=smooth((t-cfg.start)/(cfg.full-cfg.start))*(1-smooth((t-cfg.fade)/(cfg.end-cfg.fade)));
      if(!weight)continue;
      const vertex=m.vertexStart+row*3+cfg.crossColumn,p=new Vector3().fromArray(position,vertex*3),before=p.clone(),
        extension=new Vector3(0,0,cfg.forwardM*weight);
      requireThat(extension.length()<=cfg.maxDisplacementM,'Opposite slot displacement ceiling');
      p.add(extension).toArray(position,vertex*3);
      oppositeSlotReshape.maxDisplacementM=Math.max(oppositeSlotReshape.maxDisplacementM,extension.length());
      oppositeSlotReshape.vertices.push({vertex,row,cross:cfg.crossColumn,t,weight,before:before.toArray(),after:p.toArray(),extension:extension.toArray()});
    }
    requireThat(oppositeSlotReshape.vertices.length>0,'No opposite slot extension');
  }
  // Overlap the adjacent slot with a staggered return on its existing inner wave.
  const adjacentSlotReshape={guide:spec.adjacentSlotReshape.guide,vertices:[],maxDisplacementM:0,
    qualification:spec.adjacentSlotReshape.qualification};
  {const cfg=spec.adjacentSlotReshape,m=mapping.find(m=>m.guide===cfg.guide&&m.ribbon===cfg.ribbon);
    requireThat(m&&m.vertexCount===120,'Adjacent upper slot correspondence');
    for(let row=1;row<m.vertexCount/3-1;row++){
      const t=m.parameters[row],weight=smooth((t-cfg.start)/(cfg.full-cfg.start))*(1-smooth((t-cfg.fade)/(cfg.end-cfg.fade)));
      if(!weight)continue;
      const vertex=m.vertexStart+row*3+cfg.crossColumn,p=new Vector3().fromArray(position,vertex*3),before=p.clone(),
        extension=new Vector3(0,0,cfg.forwardM*weight);
      requireThat(extension.length()<=cfg.maxDisplacementM,'Adjacent slot displacement ceiling');
      p.add(extension).toArray(position,vertex*3);
      adjacentSlotReshape.maxDisplacementM=Math.max(adjacentSlotReshape.maxDisplacementM,extension.length());
      adjacentSlotReshape.vertices.push({vertex,row,cross:cfg.crossColumn,t,weight,before:before.toArray(),after:p.toArray(),extension:extension.toArray()});
    }
    requireThat(adjacentSlotReshape.vertices.length>0,'No adjacent slot extension');
  }
  // Overlap the middle opening with its existing descending wave and a gradual return.
  const midOpeningReshape={guide:spec.midOpeningReshape.guide,vertices:[],maxDisplacementM:0,
    qualification:spec.midOpeningReshape.qualification};
  {const cfg=spec.midOpeningReshape,m=mapping.find(m=>m.guide===cfg.guide&&m.ribbon===cfg.ribbon);
    requireThat(m&&m.vertexCount===114,'Mid-rear opening correspondence');
    for(let row=1;row<m.vertexCount/3-1;row++){
      const t=m.parameters[row],weight=smooth((t-cfg.start)/(cfg.full-cfg.start))*(1-smooth((t-cfg.fade)/(cfg.end-cfg.fade)));
      if(!weight)continue;
      const vertex=m.vertexStart+row*3+cfg.crossColumn,p=new Vector3().fromArray(position,vertex*3),before=p.clone(),
        extension=new Vector3(0,0,cfg.forwardM*weight);
      requireThat(extension.length()<=cfg.maxDisplacementM,'Mid-rear opening displacement ceiling');
      p.add(extension).toArray(position,vertex*3);
      midOpeningReshape.maxDisplacementM=Math.max(midOpeningReshape.maxDisplacementM,extension.length());
      midOpeningReshape.vertices.push({vertex,row,cross:cfg.crossColumn,t,weight,before:before.toArray(),after:p.toArray(),extension:extension.toArray()});
    }
    requireThat(midOpeningReshape.vertices.length>0,'No mid-rear opening extension');
  }
  // Overlap the neck-side channel with the adjacent backing wave middle edge.
  const neckMiddleReshape={guide:spec.neckMiddleReshape.guide,vertices:[],maxDisplacementM:0,
    qualification:spec.neckMiddleReshape.qualification};
  {const cfg=spec.neckMiddleReshape,m=mapping.find(m=>m.guide===cfg.guide&&m.ribbon===cfg.ribbon);
    requireThat(m&&m.vertexCount===120,'Neck-middle correspondence');
    for(let row=1;row<m.vertexCount/3-1;row++){
      const t=m.parameters[row],weight=smooth((t-cfg.start)/(cfg.full-cfg.start))*(1-smooth((t-cfg.fade)/(cfg.end-cfg.fade)));
      if(!weight)continue;
      const vertex=m.vertexStart+row*3+cfg.crossColumn,p=new Vector3().fromArray(position,vertex*3),before=p.clone(),
        extension=new Vector3(0,0,-cfg.rearwardM*weight);
      requireThat(extension.length()<=cfg.maxDisplacementM,'Neck-middle displacement ceiling');
      p.add(extension).toArray(position,vertex*3);
      neckMiddleReshape.maxDisplacementM=Math.max(neckMiddleReshape.maxDisplacementM,extension.length());
      neckMiddleReshape.vertices.push({vertex,row,cross:cfg.crossColumn,t,weight,before:before.toArray(),after:p.toArray(),extension:extension.toArray()});
    }
    requireThat(neckMiddleReshape.vertices.length>0,'No neck-middle extension');
  }
  // Overlap the upper neck-side slit with its bordering curved side lock.
  const neckUpperReshape={guide:spec.neckUpperReshape.guide,vertices:[],maxDisplacementM:0,
    qualification:spec.neckUpperReshape.qualification};
  {const cfg=spec.neckUpperReshape,m=mapping.find(m=>m.guide===cfg.guide&&m.ribbon===cfg.ribbon);
    requireThat(m&&m.vertexCount===111,'Neck-upper correspondence');
    for(let row=1;row<m.vertexCount/3-1;row++){
      const t=m.parameters[row],weight=smooth((t-cfg.start)/(cfg.full-cfg.start))*(1-smooth((t-cfg.fade)/(cfg.end-cfg.fade)));
      if(!weight)continue;
      const vertex=m.vertexStart+row*3+cfg.crossColumn,p=new Vector3().fromArray(position,vertex*3),before=p.clone(),
        extension=new Vector3(0,0,cfg.forwardM*weight);
      requireThat(extension.length()<=cfg.maxDisplacementM,'Neck-upper displacement ceiling');
      p.add(extension).toArray(position,vertex*3);
      neckUpperReshape.maxDisplacementM=Math.max(neckUpperReshape.maxDisplacementM,extension.length());
      neckUpperReshape.vertices.push({vertex,row,cross:cfg.crossColumn,t,weight,before:before.toArray(),after:p.toArray(),extension:extension.toArray()});
    }
    requireThat(neckUpperReshape.vertices.length>0,'No neck-upper extension');
  }
  // Overlap the straight neck strip with the nearest existing curved backing edge.
  const neckStripOverlap={guide:spec.neckStripOverlap.guide,vertices:[],maxDisplacementM:0,
    qualification:spec.neckStripOverlap.qualification};
  {const cfg=spec.neckStripOverlap,m=mapping.find(m=>m.guide===cfg.guide&&m.ribbon===cfg.ribbon);
    requireThat(m&&m.vertexCount===120,'Neck-strip correspondence');
    for(let row=1;row<m.vertexCount/3-1;row++){
      const t=m.parameters[row],weight=smooth((t-cfg.start)/(cfg.full-cfg.start))*(1-smooth((t-cfg.fade)/(cfg.end-cfg.fade)));
      if(!weight)continue;
      const vertex=m.vertexStart+row*3+cfg.crossColumn,p=new Vector3().fromArray(position,vertex*3),before=p.clone(),
        extension=new Vector3(0,0,cfg.forwardM*weight);
      requireThat(extension.length()<=cfg.maxDisplacementM,'Neck-strip displacement ceiling');
      p.add(extension).toArray(position,vertex*3);
      neckStripOverlap.maxDisplacementM=Math.max(neckStripOverlap.maxDisplacementM,extension.length());
      neckStripOverlap.vertices.push({vertex,row,cross:cfg.crossColumn,t,weight,before:before.toArray(),after:p.toArray(),extension:extension.toArray()});
    }
    requireThat(neckStripOverlap.vertices.length>0,'No neck-strip extension');
  }
  // Overlap the triangular opening above the neck fill with its bordering curved edge.
  const neckTriangleOverlap={guide:spec.neckTriangleOverlap.guide,vertices:[],maxDisplacementM:0,
    qualification:spec.neckTriangleOverlap.qualification};
  {const cfg=spec.neckTriangleOverlap,m=mapping.find(m=>m.guide===cfg.guide&&m.ribbon===cfg.ribbon);
    requireThat(m&&m.vertexCount===120,'Neck-strip correspondence');
    for(let row=1;row<m.vertexCount/3-1;row++){
      const t=m.parameters[row],weight=smooth((t-cfg.start)/(cfg.full-cfg.start))*(1-smooth((t-cfg.fade)/(cfg.end-cfg.fade)));
      if(!weight)continue;
      const vertex=m.vertexStart+row*3+cfg.crossColumn,p=new Vector3().fromArray(position,vertex*3),before=p.clone(),
        extension=new Vector3(0,0,cfg.forwardM*weight);
      requireThat(extension.length()<=cfg.maxDisplacementM,'Neck-strip displacement ceiling');
      p.add(extension).toArray(position,vertex*3);
      neckTriangleOverlap.maxDisplacementM=Math.max(neckTriangleOverlap.maxDisplacementM,extension.length());
      neckTriangleOverlap.vertices.push({vertex,row,cross:cfg.crossColumn,t,weight,before:before.toArray(),after:p.toArray(),extension:extension.toArray()});
    }
    requireThat(neckTriangleOverlap.vertices.length>0,'No neck-strip extension');
  }
  // Taper one backing edge through the elongated opening behind the outer waves.
  const quarterBackingOverlap={guide:spec.quarterBackingOverlap.guide,vertices:[],maxDisplacementM:0,
    qualification:spec.quarterBackingOverlap.qualification};
  {const cfg=spec.quarterBackingOverlap,m=mapping.find(m=>m.guide===cfg.guide&&m.ribbon===cfg.ribbon);
    requireThat(m&&m.vertexCount===114,'Quarter backing correspondence');
    for(let row=1;row<m.vertexCount/3-1;row++){
      const t=m.parameters[row],weight=smooth((t-cfg.start)/(cfg.full-cfg.start))*(1-smooth((t-cfg.fade)/(cfg.end-cfg.fade)));
      if(!weight)continue;
      const vertex=m.vertexStart+row*3+cfg.crossColumn,p=new Vector3().fromArray(position,vertex*3),before=p.clone(),
        extension=new Vector3(0,0,cfg.forwardM*weight);
      requireThat(extension.length()<=cfg.maxDisplacementM,'Quarter backing displacement ceiling');
      p.add(extension).toArray(position,vertex*3);
      quarterBackingOverlap.maxDisplacementM=Math.max(quarterBackingOverlap.maxDisplacementM,extension.length());
      quarterBackingOverlap.vertices.push({vertex,row,cross:cfg.crossColumn,t,weight,before:before.toArray(),after:p.toArray(),extension:extension.toArray()});
    }
    requireThat(quarterBackingOverlap.vertices.length>0,'No quarter backing extension');
  }
  // Fill the residual quarter-view opening from an adjacent internal wave edge.
  const adjacentBackingOverlap={guide:spec.adjacentBackingOverlap.guide,vertices:[],maxDisplacementM:0,
    qualification:spec.adjacentBackingOverlap.qualification};
  {const cfg=spec.adjacentBackingOverlap,m=mapping.find(m=>m.guide===cfg.guide&&m.ribbon===cfg.ribbon);
    requireThat(m&&m.vertexCount===123,'Adjacent backing correspondence');
    for(let row=1;row<m.vertexCount/3-1;row++){
      const t=m.parameters[row],weight=smooth((t-cfg.start)/(cfg.full-cfg.start))*(1-smooth((t-cfg.fade)/(cfg.end-cfg.fade)));
      if(!weight)continue;
      const vertex=m.vertexStart+row*3+cfg.crossColumn,p=new Vector3().fromArray(position,vertex*3),before=p.clone(),
        extension=new Vector3(cfg.transverseM*weight,0,0);
      requireThat(extension.length()<=cfg.maxDisplacementM,'Adjacent backing displacement ceiling');
      p.add(extension).toArray(position,vertex*3);
      adjacentBackingOverlap.maxDisplacementM=Math.max(adjacentBackingOverlap.maxDisplacementM,extension.length());
      adjacentBackingOverlap.vertices.push({vertex,row,cross:cfg.crossColumn,t,weight,before:before.toArray(),after:p.toArray(),extension:extension.toArray()});
    }
    requireThat(adjacentBackingOverlap.vertices.length>0,'No adjacent backing extension');
  }
  // Fill the internal crown opening while holding the front-view boundary fixed.
  const crownOpeningOverlap={guide:spec.crownOpeningOverlap.guide,vertices:[],maxDisplacementM:0,
    qualification:spec.crownOpeningOverlap.qualification};
  {const cfg=spec.crownOpeningOverlap,m=mapping.find(m=>m.guide===cfg.guide&&m.ribbon===cfg.ribbon),camera=new Vector3(...cfg.frontCamera);
    requireThat(m&&m.vertexCount===54,'Crown opening correspondence');
    for(let row=1;row<m.vertexCount/3-1;row++){
      const t=m.parameters[row],weight=smooth((t-cfg.start)/(cfg.full-cfg.start))*(1-smooth((t-cfg.fade)/(cfg.end-cfg.fade)));
      if(!weight)continue;
      const vertex=m.vertexStart+row*3+cfg.crossColumn,p=new Vector3().fromArray(position,vertex*3),before=p.clone(),
        extension=before.clone().sub(camera).multiplyScalar(cfg.rearwardM*weight/(camera.z-before.z));
      requireThat(extension.length()<=cfg.maxDisplacementM,'Crown opening displacement ceiling');
      p.add(extension).toArray(position,vertex*3);
      crownOpeningOverlap.maxDisplacementM=Math.max(crownOpeningOverlap.maxDisplacementM,extension.length());
      crownOpeningOverlap.vertices.push({vertex,row,cross:cfg.crossColumn,t,weight,before:before.toArray(),after:p.toArray(),extension:extension.toArray()});
    }
    requireThat(crownOpeningOverlap.vertices.length===7,'Crown opening changed-row count');
  }
  // Taper the inner wave across the opposite rear-quarter scalp opening.
  const oppositeCrownOverlap={guide:spec.oppositeCrownOverlap.guide,vertices:[],maxDisplacementM:0,
    qualification:spec.oppositeCrownOverlap.qualification};
  {const cfg=spec.oppositeCrownOverlap,m=mapping.find(m=>m.guide===cfg.guide&&m.ribbon===cfg.ribbon);
    requireThat(m&&m.vertexCount===117,'Opposite crown correspondence');
    for(let row=1;row<m.vertexCount/3-1;row++){
      const t=m.parameters[row],weight=smooth((t-cfg.start)/(cfg.full-cfg.start))*(1-smooth((t-cfg.fade)/(cfg.end-cfg.fade)));
      if(!weight)continue;
      const vertex=m.vertexStart+row*3+cfg.crossColumn,p=new Vector3().fromArray(position,vertex*3),before=p.clone(),extension=new Vector3(0,0,-cfg.rearwardM*weight);
      requireThat(extension.length()<=cfg.maxDisplacementM,'Opposite crown displacement ceiling');
      p.add(extension).toArray(position,vertex*3);
      oppositeCrownOverlap.maxDisplacementM=Math.max(oppositeCrownOverlap.maxDisplacementM,extension.length());
      oppositeCrownOverlap.vertices.push({vertex,row,cross:cfg.crossColumn,t,weight,before:before.toArray(),after:p.toArray(),extension:extension.toArray()});
    }
    requireThat(oppositeCrownOverlap.vertices.length===8,'Opposite crown changed-row count');
  }
  // Taper the inner wave across the opposite rear-quarter scalp opening.
  const quarterPatchOverlap={guide:spec.quarterPatchOverlap.guide,vertices:[],maxDisplacementM:0,
    qualification:spec.quarterPatchOverlap.qualification};
  {const cfg=spec.quarterPatchOverlap,m=mapping.find(m=>m.guide===cfg.guide&&m.ribbon===cfg.ribbon);
    requireThat(m&&m.vertexCount===117,'Opposite crown correspondence');
    for(let row=1;row<m.vertexCount/3-1;row++){
      const t=m.parameters[row],weight=smooth((t-cfg.start)/(cfg.full-cfg.start))*(1-smooth((t-cfg.fade)/(cfg.end-cfg.fade)));
      if(!weight)continue;
      const vertex=m.vertexStart+row*3+cfg.crossColumn,p=new Vector3().fromArray(position,vertex*3),before=p.clone(),extension=new Vector3(0,0,-cfg.rearwardM*weight);
      requireThat(extension.length()<=cfg.maxDisplacementM,'Opposite crown displacement ceiling');
      p.add(extension).toArray(position,vertex*3);
      quarterPatchOverlap.maxDisplacementM=Math.max(quarterPatchOverlap.maxDisplacementM,extension.length());
      quarterPatchOverlap.vertices.push({vertex,row,cross:cfg.crossColumn,t,weight,before:before.toArray(),after:p.toArray(),extension:extension.toArray()});
    }
    requireThat(quarterPatchOverlap.vertices.length===8,'Opposite crown changed-row count');
  }
  // Taper the inner wave across the opposite rear-quarter scalp opening.
  const rearArchOverlap={guide:spec.rearArchOverlap.guide,vertices:[],maxDisplacementM:0,
    qualification:spec.rearArchOverlap.qualification};
  {const cfg=spec.rearArchOverlap,m=mapping.find(m=>m.guide===cfg.guide&&m.ribbon===cfg.ribbon);
    requireThat(m&&m.vertexCount===114,'Opposite crown correspondence');
    for(let row=1;row<m.vertexCount/3-1;row++){
      const t=m.parameters[row],weight=smooth((t-cfg.start)/(cfg.full-cfg.start))*(1-smooth((t-cfg.fade)/(cfg.end-cfg.fade)));
      if(!weight)continue;
      const vertex=m.vertexStart+row*3+cfg.crossColumn,p=new Vector3().fromArray(position,vertex*3),before=p.clone(),extension=new Vector3(0,0,-cfg.rearwardM*weight);
      requireThat(extension.length()<=cfg.maxDisplacementM,'Opposite crown displacement ceiling');
      p.add(extension).toArray(position,vertex*3);
      rearArchOverlap.maxDisplacementM=Math.max(rearArchOverlap.maxDisplacementM,extension.length());
      rearArchOverlap.vertices.push({vertex,row,cross:cfg.crossColumn,t,weight,before:before.toArray(),after:p.toArray(),extension:extension.toArray()});
    }
    requireThat(rearArchOverlap.vertices.length===8,'Opposite crown changed-row count');
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
  const report={version:'ember-hair-v123',guideSourceVersion:spec.version,samplingMethod:'adaptive-seven-probes-v123',inputs,output,guides:spec.guides.length+spec.coverageBands.length+1,ribbons:mapping.length,vertices:position.length/3,triangles:index.length/3,
    maxChordErrorM:maxChord,chordErrorQualification:'Authored guide centreline samples before root laying; coverage sampler reports precede the two-section resampling. Split scalp section approximation is unqualified. No continuous or final surface bound.',minFrameTangentDot:minFrameDot,minTriangleAreaM2:minArea,minFaceAgreement,correctedWindingFaces,laidRootVertices,maxRootLayDisplacementM,coverageMaxSampledChordM,coverageWorst,radialFallbacks,coverageBands:spec.coverageBands.length+1,degenerateFacesRemoved,projectedVertices,maxProjectionM,scalpTriangles:scalp.length,scalpAllowlist:allow,
    roots,mapping,controlAnchors,headBindMatrix:headBind.toArray(),headJoint,bindReconstructionErrorM:restError,maxRootResidualM:maxRootResidual,
    cardFrame:frames.report,clearance,collisionPairs,atlas:pre.atlas,material:spec.material,limits,rearCoverageCore:spec.rearCoverageCore,bridgeShaping:spec.bridgeShaping,sideCoverage:spec.sideCoverage,earBridge:spec.earBridge,sideSurfaceFit,triangleSideClearance,innerSideReshape,crownEdgeReshape,upperSideReshape,scalpSplit,returnJoin,waveEdgeReshape,neckChannelReshape,neckChannelLower,oppositeChannelReshape,archEdgeReshape,archAdjacentReshape,oppositeArchReshape,visibleRimReshape,quarterRimReshape,midRearReshape,upperSlotReshape,oppositeSlotReshape,adjacentSlotReshape,midOpeningReshape,neckMiddleReshape,neckUpperReshape,neckStripOverlap,neckTriangleOverlap,quarterBackingOverlap,adjacentBackingOverlap,crownOpeningOverlap,oppositeCrownOverlap,quarterPatchOverlap,rearArchOverlap,rearArchAtlasFill:spec.rearArchAtlasFill,upperCrownAtlasFill:spec.upperCrownAtlasFill,rearCrownAtlasFill:spec.rearCrownAtlasFill,waveAtlasFill:spec.waveAtlasFill,neckAtlasFill:spec.neckAtlasFill,
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
