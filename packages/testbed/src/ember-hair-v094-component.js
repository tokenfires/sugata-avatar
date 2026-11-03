import {BufferGeometry, Float32BufferAttribute, Uint32BufferAttribute, Mesh, Matrix4, Matrix3,
  Vector3, TextureLoader} from 'three/webgpu';
import {attribute,float,vec2,vec4,varying,modelViewMatrix,uv,fract,floor,sin,smoothstep,mix,fwidth,texture} from 'three/tsl';
import {createHairMaterial,installHairCardFrame} from '../../core/src/material/HairMaterial.js';

const base='/@fs/Users/robault/GitHub/sugata-avatar/';
const evidence='docs/evidence/ember-2026-11-01-hair-v094/';
const digest=async bytes=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),b=>b.toString(16).padStart(2,'0')).join('');
async function json(path){const r=await fetch(base+path);if(!r.ok)throw Error('Hair report unavailable '+path);return r.json();}
async function bytes(path,expected){const r=await fetch(base+path);if(!r.ok)throw Error('Hair source unavailable '+path);
  const b=await r.arrayBuffer();if(b.byteLength!==expected.bytes||await digest(b)!==expected.sha256)throw Error('Hair hash mismatch '+path);return b;}

export async function attachEmberHair({figure,rig,body,renderer}){
  const report=await json(evidence+'build-result.json'),complete=await json(evidence+'COMPLETE.json');
  if(!complete.renderable||report.vertices>24000||report.triangles>32000||renderer.samples!==4)throw Error('Hair preflight mismatch');
  const geometry=new BufferGeometry();
  for(const [name,size]of [['position',3],['normal',3],['uv',2],['uv1',2],['along',3],['across',3],['rootDistance',1]]){
    const b=await bytes(evidence+name+'.bin',report.output[name]);geometry.setAttribute(name,new Float32BufferAttribute(new Float32Array(b),size));}
  const densityIds=['inner-backing-heavy-01','inner-backing-heavy-02','inner-backing-light-01','inner-backing-light-02'];
  const densityTags=new Float32Array(report.vertices*3);let taggedVertices=0,taggedRibbons=0;
  for(const row of report.mapping){if(densityIds.includes(row.guide)){
    for(let i=row.vertexStart;i<row.vertexStart+row.vertexCount;i++)densityTags[i*3]=1;taggedVertices+=row.vertexCount;taggedRibbons++;}}
  if(taggedRibbons!==4||taggedVertices!==360)throw Error('Unexpected backing-density scope');
  // Pack both scope flags into one buffer to stay within the GPU's eight-buffer limit.
  let coreVertices=0,coreRibbons=0,sideCoreVertices=0,sideCoreRibbons=0;
  for(const row of report.mapping){if(row.guide==='rear-slot-bridge-01'){
    for(let i=row.vertexStart;i<row.vertexStart+row.vertexCount;i++)densityTags[i*3+1]=1;
    coreVertices+=row.vertexCount;coreRibbons++;}}
  if(coreRibbons!==1||coreVertices>213||coreVertices!==78)throw Error('Unexpected rear-core scope');
  for(const row of report.mapping){if(report.sideCoverage.guides.includes(row.guide)){
    for(let i=row.vertexStart;i<row.vertexStart+row.vertexCount;i++)densityTags[i*3+1]=1;
    sideCoreVertices+=row.vertexCount;sideCoreRibbons++;}}
  if(sideCoreRibbons!==report.sideCoverage.guides.length||sideCoreVertices>135||sideCoreVertices!==report.vertices-23865)throw Error('Unexpected side coverage scope');
  // Third packed channel scopes the local atlas study without adding a GPU buffer.
  const atlasCfg=report.waveAtlasFill;let waveAtlasVertices=0,waveAtlasRibbons=0;
  for(const row of report.mapping){if(row.guide===atlasCfg.guide&&row.ribbon===atlasCfg.ribbon){
    for(let i=row.vertexStart;i<row.vertexStart+row.vertexCount;i++)densityTags[i*3+2]=1;
    waveAtlasVertices+=row.vertexCount;waveAtlasRibbons++;}}
  if(waveAtlasRibbons!==1||waveAtlasVertices!==123)throw Error('Unexpected wave atlas scope');
  geometry.setAttribute('backingStudy',new Float32BufferAttribute(densityTags,3));
  const index=await bytes(evidence+'index.bin',report.output.index);geometry.setIndex(new Uint32BufferAttribute(new Uint32Array(index),1));
  if(geometry.attributes.position.count!==report.vertices||geometry.index.count!==report.triangles*3)throw Error('Hair geometry correspondence');
  for(const name of ['albedo','flow','depth']){const p='assets/hair/bob01/'+name+'.png';await bytes(p,report.inputs[p]);}
  const alpha=await new TextureLoader().loadAsync(base+'assets/hair/bob01/albedo.png');alpha.flipY=false;alpha.needsUpdate=true;
  if(alpha.image.width!==1024||alpha.image.height!==1024)throw Error('Hair alpha dimensions');
  const material=await createHairMaterial({alphaMap:alpha,flowMapUrl:base+'assets/hair/bob01/flow.png',
    depthMapUrl:base+'assets/hair/bob01/depth.png',baseColourHex:0x4d3226,multisampled:true,defect:'none',cardRoots:{capStripEnd:1/8,fadeLength:.055}});
  // The isolated scene has a HemisphereLight but no main-rig indirect composite.
  // Use a conservative pigment-weighted diffuse proxy for this study only.
  // It is not a fibre multiple-scattering or environment-specular solution.
  let indirectBuilds=0;
  const originalLightingModel=material.setupLightingModel.bind(material);
  material.setupLightingModel=function(){
    const model=originalLightingModel();
    model.indirect=function(builder){
      const {irradiance,reflectedLight,ambientOcclusion}=builder.context;
      if(!irradiance||!reflectedLight||!ambientOcclusion)throw Error('Missing hair indirect context');
      reflectedLight.indirectDiffuse.addAssign(
        irradiance.mul(this.colour).mul(1/Math.PI).mul(this.occlusion).mul(ambientOcclusion));
      indirectBuilds++;
    };
    return model;
  };
  // Short, physically sized root transition; no card/anchor movement.
  // Different strand starts break a broad common edge. Fade unresolved variation
  // to its mean, so it cannot become shimmering pixel noise.
  const rootM=attribute('rootDistance','float');
  const u=fract(uv().x.mul(8)).sub(8/1024).div(1-16/1024).clamp(0,1);
  const seed=attribute('uv1','vec2').x.mul(97.1).add(floor(uv().x.mul(8)).mul(19.7));
  const phase=u.mul(11).add(seed),cell=floor(phase);
  const hash=x=>fract(sin(x.mul(127.1).add(311.7)).mul(43758.5453));
  const noise=mix(hash(cell),hash(cell.add(1)),smoothstep(0,1,fract(phase)));
  const resolved=float(1).sub(smoothstep(.22,.48,fwidth(phase)));
  const startM=mix(.0005,.0045,mix(.5,noise,resolved));
  const rootFade=smoothstep(startM,startM.add(.008),rootM);
  const halfWidth=mix(.16,.53,smoothstep(0,.014,rootM));
  const taper=smoothstep(-.015,.015,halfWidth.sub(u.sub(.5).abs()));
  // Local infill preserves existing coverage and the retained root/edge/tip treatment.
  const originalAtlasAlpha=texture(alpha).a;
  // Fixed atlas translation keeps added strand paths continuous along V.
  // Composite into gaps only; the original alpha is never reduced or remapped.
  const waveWindow=smoothstep(atlasCfg.start,atlasCfg.full,uv().y)
    .mul(float(1).sub(smoothstep(atlasCfg.fade,atlasCfg.end,uv().y)));
  const offsetUV=vec2(uv().x.add(atlasCfg.offsetTexels/1024),uv().y);
  const localBlend=attribute('backingStudy','vec3').z.mul(waveWindow)
    .mul(smoothstep(atlasCfg.edgeBlend[0],atlasCfg.edgeBlend[1],u))
    .mul(float(1).sub(smoothstep(atlasCfg.centreBlend[0],atlasCfg.centreBlend[1],u)));
  const extraAlpha=texture(alpha,offsetUV).a.mul(localBlend).mul(atlasCfg.contribution);
  const atlasAlpha=originalAtlasAlpha.add(float(1).sub(originalAtlasAlpha).mul(extraAlpha));
  // Retained partial-coverage lift for the four separate inner backing locks.
  const denseAlpha=atlasAlpha.mul(float(2).sub(atlasAlpha));
  const densityWindow=attribute('backingStudy','vec3').x.mul(smoothstep(.15,.28,uv().y))
    .mul(float(1).sub(smoothstep(.63,.86,uv().y)));
  // Continuous interior support only. The original edge strips and terminal atlas
  // remain atlas-driven outside the core; existing ribbons keep their exact coverage.
  const coreWindow=attribute('backingStudy','vec3').y.mul(smoothstep(.22,.35,uv().y))
    .mul(float(1).sub(smoothstep(.75,.90,uv().y)))
    .mul(smoothstep(.03,.15,u)).mul(float(1).sub(smoothstep(.85,.97,u)));
  const retainedAlpha=mix(atlasAlpha,denseAlpha,densityWindow);
  const coreAlpha=retainedAlpha.max(coreWindow.mul(.96));
  material.colorNode=vec4(material.hair.baseColour,coreAlpha.mul(rootFade).mul(taper));
  // Apply retained neutral shadow transmission to the resulting coverage mask.
  // This is a neutral transmission proxy, not multi-layer fibre scattering.
  material.castShadowNode=vec4(.28,.28,.28,1);
  // HairMaterial computes smoothstep(0, rootOcclusionLength, uv.y). This ratio
  // makes that ramp equivalent to smoothstep(0, .012 metres, rootM) away from 0.
  material.hair.rootOcclusionLength=uv().y.mul(.012).div(rootM.max(.000001)).max(.000001);
  for(const key of ['flowMap','depthMap']){const texture=material.hair[key]?.value;if(texture?.image&&(texture.image.width!==1024||texture.image.height!==1024))throw Error('Hair sidecar dimensions');}
  figure.updateMatrixWorld(true);const head=rig.rawBones.get('head');if(!head)throw Error('Head attachment missing');
  const headInFigure=new Matrix4().multiplyMatrices(figure.matrixWorld.clone().invert(),head.matrixWorld),inverse=headInFigure.clone().invert();
  if(headInFigure.elements.some((x,i)=>Math.abs(x-report.headBindMatrix[i])>1e-5))throw Error('CPU/browser head bind mismatch');
  geometry.applyMatrix4(inverse);geometry.computeBoundingBox();geometry.computeBoundingSphere();
  // These baked vectors have magnitude in metres per atlas UV unit. Transform
  // by the linear bind matrix without normalization, then interpolate in view space.
  const linear=new Matrix3().setFromMatrix4(inverse),vector=new Vector3();
  for(const name of ['along','across']){
    const a=geometry.attributes[name];
    for(let i=0;i<a.count;i++){vector.fromBufferAttribute(a,i).applyMatrix3(linear);a.setXYZ(i,vector.x,vector.y,vector.z);}
    a.needsUpdate=true;
  }
  installHairCardFrame(material,{enabled:float(1),inCard:float(1),
    along:varying(modelViewMatrix.mul(vec4(attribute('along','vec3'),0)).xyz,'emberHairAlong'),
    across:varying(modelViewMatrix.mul(vec4(attribute('across','vec3'),0)).xyz,'emberHairAcross')});
  const mesh=new Mesh(geometry,material);mesh.name='Ember_original_waves_v094';mesh.frustumCulled=false;mesh.castShadow=true;mesh.receiveShadow=true;head.add(mesh);
  const anchors=report.roots.map(a=>({...a,localNormal:new Vector3().fromArray(a.normal).transformDirection(inverse)}));
  let maxRootResidualM=0;
  function verify(){
    maxRootResidualM=0;const expected=new Vector3(),actual=new Vector3(),point=new Vector3();
    for(const a of anchors){expected.set(0,0,0);for(let k=0;k<3;k++){
      body.getVertexPosition(a.vertices[k],point);body.localToWorld(point);expected.addScaledVector(point,a.bary[k]);}
      expected.addScaledVector(a.localNormal.clone().transformDirection(head.matrixWorld),a.offsetM);
      actual.fromBufferAttribute(geometry.attributes.position,a.vertex);mesh.localToWorld(actual);maxRootResidualM=Math.max(maxRootResidualM,actual.distanceTo(expected));}
    if(maxRootResidualM>.0005)throw Error('Hair root attachment drift '+maxRootResidualM);
  }
  function boundsVisible(camera){let cropped=0;for(let i=0;i<geometry.attributes.position.count;i++){
    const p=new Vector3().fromBufferAttribute(geometry.attributes.position,i);mesh.localToWorld(p);p.project(camera);
    if(Math.abs(p.x)>1||Math.abs(p.y)>1||Math.abs(p.z)>1)cropped++;}return {croppedVertices:cropped,complete:cropped===0};}
  return {verify,boundsVisible,setCastShadow:enabled=>{mesh.castShadow=Boolean(enabled);},describe:()=>({version:'v094',guides:report.guides,ribbons:report.ribbons,vertices:report.vertices,triangles:report.triangles,
    cardFrame:{...report.cardFrame,mode:'interpolated per vertex',headLocal:true},maxRootResidualM,atlas:report.atlas,material:{waveAtlasFill:{...atlasCfg,taggedVertices:waveAtlasVertices,taggedRibbons:waveAtlasRibbons,geometry:"alpha-fill target unchanged relative to v082",sidecars:"unchanged"},sideCoverage:{...report.sideCoverage,taggedVertices:sideCoreVertices,taggedRibbons:sideCoreRibbons},rearCoverageCore:{...report.rearCoverageCore,taggedVertices:coreVertices,taggedRibbons:coreRibbons},baseColourHex:'4d3226',cap:false,indirect:{model:'pigment-weighted hemisphere diffuse proxy',gain:1,builds:indirectBuilds},castShadow:mesh.castShadow,receiveShadow:mesh.receiveShadow,shadowTransmission:{model:'nearest-occluder neutral colour proxy',linearRGB:[.28,.28,.28],alphaMultiplier:1,layeredOcclusionCertified:false},rootTransition:{coverageCompleteM:.014,occlusionRampM:.012,anchors:'unchanged'},alphaToCoverage:material.alphaToCoverage,backingDensity:{ribbons:taggedRibbons,taggedVertices,alphaRemap:'1-(1-a)^2',startFade:[.15,.28],endFade:[.63,.86],geometry:'unchanged'}},
    sourceClearance:report.clearance,correctedWindingFaces:report.correctedWindingFaces,structuralChecks:complete.structuralChecks,qualification:'First original hair candidate; likeness, finish and full motion unaccepted'})};
}
