import {BufferGeometry, Float32BufferAttribute, Uint32BufferAttribute, Mesh, Matrix4,
  Vector3, TextureLoader} from 'three/webgpu';
import {uv,attribute,float,fract,floor,sin,smoothstep,mix,fwidth,texture,vec4} from 'three/tsl';
import {createHairMaterial} from '../../core/src/material/HairMaterial.js';

const base='/@fs/Users/robault/GitHub/sugata-avatar/';
const evidence='docs/evidence/ember-2026-11-01-hair-v010/';
const digest=async bytes=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),b=>b.toString(16).padStart(2,'0')).join('');
async function json(path){const r=await fetch(base+path);if(!r.ok)throw Error('Hair report unavailable '+path);return r.json();}
async function bytes(path,expected){const r=await fetch(base+path);if(!r.ok)throw Error('Hair source unavailable '+path);
  const b=await r.arrayBuffer();if(b.byteLength!==expected.bytes||await digest(b)!==expected.sha256)throw Error('Hair hash mismatch '+path);return b;}

export async function attachEmberHair({figure,rig,body,renderer}){
  const report=await json(evidence+'build-result.json'),complete=await json(evidence+'COMPLETE.json');
  if(!complete.renderable||report.vertices>24000||report.triangles>32000||renderer.samples!==4)throw Error('Hair preflight mismatch');
  const geometry=new BufferGeometry();
  for(const [name,size]of [['position',3],['normal',3],['uv',2],['uv1',2]]){
    const b=await bytes(evidence+name+'.bin',report.output[name]);geometry.setAttribute(name,new Float32BufferAttribute(new Float32Array(b),size));}
  const index=await bytes(evidence+'index.bin',report.output.index);geometry.setIndex(new Uint32BufferAttribute(new Uint32Array(index),1));
  if(geometry.attributes.position.count!==report.vertices||geometry.index.count!==report.triangles*3)throw Error('Hair geometry correspondence');
  for(const name of ['albedo','flow','depth']){const p='assets/hair/bob01/'+name+'.png';await bytes(p,report.inputs[p]);}
  const alpha=await new TextureLoader().loadAsync(base+'assets/hair/bob01/albedo.png');alpha.flipY=false;alpha.needsUpdate=true;
  if(alpha.image.width!==1024||alpha.image.height!==1024)throw Error('Hair alpha dimensions');
  const material=await createHairMaterial({alphaMap:alpha,flowMapUrl:base+'assets/hair/bob01/flow.png',
    depthMapUrl:base+'assets/hair/bob01/depth.png',baseColourHex:0x57301e,multisampled:true,defect:'none',settings:{lockSpread:.24,strandPitch:.001},cardRoots:{capStripEnd:1/8,fadeLength:.055}});
  // Local trial: keep the v008 geometry and pigment; remove the v009 layer palette.
  // Noise varies across fibres, with only a small slow drift along them. Both detail
  // bands fade before the pixel sampling limit. There is no frame/time seed.
  const layer=attribute('uv1','vec2');
  const u=fract(uv().x.mul(8)).sub(8/1024).div(1-16/1024).clamp(0,1);
  const seed=layer.x.mul(129.7).add(floor(uv().x.mul(8)).mul(23.1));
  const hash=x=>fract(sin(x.mul(127.1).add(311.7)).mul(43758.5453));
  const noise=x=>mix(hash(floor(x)),hash(floor(x).add(1)),smoothstep(0,1,fract(x)));
  const drift=sin(uv().y.mul(8).add(seed)).mul(.10);
  const phase=u.mul(11).add(seed).add(drift),fine=u.mul(31).add(seed.mul(3.1)).add(drift);
  const fade=p=>float(1).sub(smoothstep(.22,.48,fwidth(p)));
  const variation=float(1).add(noise(phase).sub(.5).mul(.30).mul(fade(phase)))
    .add(noise(fine).sub(.5).mul(.16).mul(fade(fine)));
  const edgeDistance=u.min(float(1).sub(u));
  const edgeWidth=mix(.035,.08,smoothstep(.15,.65,layer.y));
  const edgeWander=noise(uv().y.mul(14).add(seed)).sub(.5).mul(.018);
  const feather=smoothstep(.002,edgeWidth,edgeDistance.add(edgeWander));
  const defaultDescription=material.describe();
  material.hair.baseColour=material.hair.baseColour.mul(variation);
  material.colorNode=vec4(material.hair.baseColour,
    texture(alpha).a.mul(smoothstep(0,.055,uv().y)).mul(feather));
  material.describe=()=>({...defaultDescription,localTreatment:'filtered irregular fibres and narrow edge feather; v008 geometry'});
  for(const key of ['flowMap','depthMap']){const texture=material.hair[key]?.value;if(texture?.image&&(texture.image.width!==1024||texture.image.height!==1024))throw Error('Hair sidecar dimensions');}
  figure.updateMatrixWorld(true);const head=rig.rawBones.get('head');if(!head)throw Error('Head attachment missing');
  const headInFigure=new Matrix4().multiplyMatrices(figure.matrixWorld.clone().invert(),head.matrixWorld),inverse=headInFigure.clone().invert();
  if(headInFigure.elements.some((x,i)=>Math.abs(x-report.headBindMatrix[i])>1e-5))throw Error('CPU/browser head bind mismatch');
  geometry.applyMatrix4(inverse);geometry.computeBoundingBox();geometry.computeBoundingSphere();
  const mesh=new Mesh(geometry,material);mesh.name='Ember_original_waves_v010';mesh.frustumCulled=false;head.add(mesh);
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
  return {verify,boundsVisible,describe:()=>({version:'v010',guides:report.guides,ribbons:report.ribbons,vertices:report.vertices,triangles:report.triangles,
    maxRootResidualM,atlas:report.atlas,material:{baseColourHex:'57301e',cap:false,localTreatment:'filtered irregular fibres and narrow edge feather; v008 geometry',lockSpread:.24,strandPitchM:.001,alphaToCoverage:material.alphaToCoverage},
    sourceClearance:report.clearance,correctedWindingFaces:report.correctedWindingFaces,structuralChecks:complete.structuralChecks,qualification:'First original hair candidate; likeness, finish and full motion unaccepted'})};
}
