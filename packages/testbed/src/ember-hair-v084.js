import { WebGPURenderer, Scene, Color, PerspectiveCamera, HemisphereLight,
  DirectionalLight, Group, Vector3, ACESFilmicToneMapping, PCFShadowMap, Box3, MeshPhysicalNodeMaterial } from 'three/webgpu';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { texture, uv, vec2, vec3, vec4, float, positionGeometry,
  sin, dot, fract, floor, smoothstep, mix, exp, pow, step, max, Fn, reference as nodeReference } from 'three/tsl';
import { Skeleton } from '../../core/src/figure/Skeleton.js';
import { createSkinMaterial } from '../../core/src/material/SkinMaterial.js';
import { EyeMaterial } from './ember-ocular-v003-material.js';
import { installTurntable } from './ember-hair-v047-motion.js';
import { attachEmberHair } from './ember-hair-v084-component.js';

const root='/@fs/Users/robault/GitHub/sugata-avatar/';
const $=id=>document.getElementById(id);
const fit=await(await fetch(root+'docs/evidence/ember-2026-10-31-measured-fit/candidate-correction-v001.json')).json();
const source='docs/evidence/ember-2026-10-31-eye-bridge/candidate.glb';
const sourceHash='bcb87a95d76ad252d2681c614c8d9f34d2f51a87a10077298323066fc9ebcdef';
const renderer=new WebGPURenderer({canvas:$('portrait'),antialias:true});
renderer.shadowMap.enabled=true;renderer.shadowMap.type=PCFShadowMap;renderer.shadowMap.transmitted=true;
renderer.setPixelRatio(1);renderer.setSize(512,512,false);
renderer.toneMapping=ACESFilmicToneMapping;renderer.toneMappingExposure=.95;
const scene=new Scene();scene.background=new Color('#b9beb5');
const ambient=new HemisphereLight('#efeee9','#7c8173',1.4);
const key=new DirectionalLight('#fff1df',2.8),fill=new DirectionalLight('#e4e9e9',.65);
key.position.set(-.6,.6,.8);fill.position.set(.7,.2,.45);scene.add(ambient,key,fill);
// Wider fixed PCF avoids pixel-rotated five-sample grain. Only hair receives it.
// Grid weights sum to 81; support is +/-4 texels (2.734 mm per axis here).
// This is a local fixed-kernel study, not a distance-dependent penumbra model.
let shadowFilterBuilds=0;
const hairShadowFilter=Fn(({depthTexture,shadowCoord,shadow,depthLayer})=>{
  const mapSize=nodeReference('mapSize','vec2',shadow);
  let total=float(0);
  for(let y=-2;y<=2;y++)for(let x=-2;x<=2;x++){
    const offset=vec2(x*2,y*2).div(mapSize);
    let sample=texture(depthTexture,shadowCoord.xy.add(offset));
    if(depthTexture.isArrayTexture)sample=sample.depth(depthLayer);
    total=total.add(sample.compare(shadowCoord.z).mul((3-Math.abs(x))*(3-Math.abs(y))));
  }
  shadowFilterBuilds++;
  return total.mul(1/81);
});
// Existing lights gain shadow maps, without changing their illumination settings.
for(const light of [key,fill]){
  light.castShadow=true;light.shadow.mapSize.set(1024,1024);
  light.shadow.filterNode=hairShadowFilter;light.shadow.radius=4;
  light.shadow.bias=-.00003;light.shadow.normalBias=.0004;
  Object.assign(light.shadow.camera,{left:-.35,right:.35,top:.35,bottom:-.35,near:.01,far:2.5});
  light.shadow.camera.updateProjectionMatrix();scene.add(light.target);
}
const camera=new PerspectiveCamera(28,1,.01,10),poseRoot=new Group();scene.add(poseRoot);
const meshes=[];let rig,body,eyes,view='front',frame='reference',draws=0,busy=false;
let weights={},headYaw=0,neutralLight=false,eyeY,eyeFront;
const cardReport=[];
let turntable;
let hairStudy,wideHair=false,witness='front',hairCastsShadows=true;
const rgb=hex=>vec3(...new Color(hex).toArray());


async function correctBrowAndLashCards(){
  if(renderer.samples!==4)throw Error('Expected four-sample MSAA for card coverage');
  const positions=await(await fetch(root+'docs/evidence/ember-2026-10-31-brow-lash-v001/brow-positions.f32')).arrayBuffer();
  const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',positions)),b=>b.toString(16).padStart(2,'0')).join('');
  if(hash!=='d7e204c19fd76a10d06ac2545956d0d939127608d3342663dcec6a7136234247')throw Error('Brow correction hash changed');
  for(const mesh of meshes){
    if(!/eyebrow/i.test(mesh.name))continue;
    const brow=/eyebrow/i.test(mesh.name),previous=mesh.material;
    if(!previous.map||previous.alphaTest<=0)throw Error('Missing masked card input');
    if(brow){
      if(mesh.geometry.attributes.position.count!==124)throw Error('Brow topology changed');
      mesh.geometry=mesh.geometry.clone();
      mesh.geometry.attributes.position.array.set(new Float32Array(positions));
      mesh.geometry.attributes.position.needsUpdate=true;mesh.geometry.computeVertexNormals();
    }
    const sampled=texture(previous.map),card=new MeshPhysicalNodeMaterial();
    card.map=previous.map;card.side=previous.side;card.opacity=previous.opacity;
    const luma=dot(sampled.rgb,vec3(.2126,.7152,.0722));
    const pigment=brow?rgb('#75442f').mul(float(.55).add(pow(luma.div(.015),.5).mul(.45)).clamp(.55,1.35))
      :max(sampled.rgb,rgb('#21150f'));
    card.colorNode=vec4(pigment,sampled.a);card.roughness=previous.roughness;
    card.metalness=0;card.specularIntensity=0;card.alphaTest=previous.alphaTest;card.alphaToCoverage=false;
    mesh.material=card;
    const report={mesh:mesh.name,brow,alphaTest:previous.alphaTest,alphaToCoverage:false,msaaSamples:renderer.samples,
      placement:brow?'2mm upward query; projected rise .773–2.101mm; same frozen-skin signed gap':'unchanged'};
    mesh.onBeforeRender=()=>{report.drawSamples=renderer.currentSamples;
      if(report.drawSamples!==4)throw Error('Card draw is not four-sample MSAA');};
    cardReport.push(report);
  }
  if(cardReport.length!==1)throw Error('Expected exactly one brow card');
}

async function addSkinPigment(){
  const albedo=body.material.map;if(!albedo)throw Error('Missing stock skin albedo');
  const skin=await createSkinMaterial({albedoMap:albedo,curvatureMapUrl:null,
    regionMapUrl:null,cavityMapUrl:null,settings:{roughness:.52,secondLobeWeight:.10,
      microNormalScale:.035,microNormalRepeat:72}});
  // Bind coordinates make new pigment follow the skin through pose and expression.
  // This does not sample either portrait or alter the source texture/geometry.
  const p=positionGeometry;
  const grid=vec2(p.x,p.y).mul(720),cell=floor(grid);
  const h=fract(sin(dot(cell,vec2(127.1,311.7))).mul(43758.5453));
  const centre=vec2(h,fract(h.mul(37.31)));
  const dots=float(1).sub(smoothstep(.10,.26,fract(grid).sub(centre).length())).mul(step(.86,h));
  const band=exp(pow(p.y.sub(eyeY-.027).div(.019),2).negate());
  const side=float(1).sub(smoothstep(.046,.073,p.x.abs()));
  const facing=smoothstep(eyeFront-.045,eyeFront-.015,p.z);
  const freckles=dots.mul(band).mul(side).mul(facing).mul(.26);
  const cheeks=exp(pow(p.x.abs().sub(.036).div(.024),2).negate())
    .mul(exp(pow(p.y.sub(eyeY-.037).div(.027),2).negate())).mul(facing).mul(.08);
  const base=texture(albedo,uv()).rgb.mul(vec3(1.035,1.0,.975));
  const rosy=mix(base,rgb('#b66b64'),cheeks);
  skin.colorNode=vec4(mix(rosy,rgb('#815037'),freckles),1);
  body.material=skin;
}

function setFrame(name){
  frame=name;weights={};headYaw=0;
  if(name==='reference')weights={mouthSmileLeft:fit.views[view].smile,mouthSmileRight:fit.views[view].smile};
  if(name==='blink')weights={eyeBlinkLeft:1,eyeBlinkRight:1};
  if(name==='gaze-left')weights={eyeLookOutLeft:.6,eyeLookInRight:.6};
  if(name==='gaze-right')weights={eyeLookInLeft:.6,eyeLookOutRight:.6};
  if(name==='head')headYaw=.24;
}
async function render(){
  if(!body||busy)return;busy=true;
  try{
    const c=fit.views[view==='rear'?'front':view].camera;
    poseRoot.rotation.set(view==='rear'?0:c[1],view==='rear'?Math.PI:c[0],view==='rear'?0:c[2],'ZYX');
    if(turntable?.active)poseRoot.rotation.set(0,turntable.degrees*Math.PI/180,0,'ZYX');
    poseRoot.position.set(wideHair?0:c[4],wideHair?0:c[5],0);
    const figure=rig.rigRoot;figure.position.fromArray(wideHair?[0,1.45,.045]:fit.center).negate();
    camera.position.set(0,0,wideHair?1.05:Math.exp(c[3]));camera.lookAt(0,0,0);camera.updateMatrixWorld(true);
    rig.reset();rig.rotationOf('neck').setFromAxisAngle(new Vector3(0,1,0),headYaw*.35);
    rig.rotationOf('head').setFromAxisAngle(new Vector3(0,1,0),headYaw*.65);rig.update();
    for(const m of meshes){if(!m.morphTargetInfluences)continue;m.morphTargetInfluences.fill(0);
      for(const [name,value]of Object.entries(weights)){const i=m.morphTargetDictionary[name];if(i!==undefined)m.morphTargetInfluences[i]=value;}}
    scene.updateMatrixWorld(true);for(const m of meshes)if(m.isSkinnedMesh)m.skeleton.update();eyes.update();hairStudy.verify();
    const hairBounds=hairStudy.boundsVisible(camera);if(wideHair&&!hairBounds.complete)throw Error('Fixed full-hair framing clips '+hairBounds.croppedVertices+' vertices');
    key.color.set(neutralLight?'#ffffff':'#fff1df');fill.color.set(neutralLight?'#ffffff':'#e4e9e9');ambient.color.set(neutralLight?'#ffffff':'#efeee9');
    eyes.keyLightDirectionUniform.value.copy(key.position).normalize();
    hairStudy.setCastShadow(hairCastsShadows);
    await renderer.renderAsync(scene,camera);draws++;
    const shadowReceivers=[];scene.traverse(o=>{if(o.isMesh&&o.receiveShadow)shadowReceivers.push(o.name);});
    if(shadowReceivers.length!==1||shadowReceivers[0]!=='Ember_original_waves_v084')throw Error('Unexpected shadow receiver');
    const shadowMaps=[key,fill].map(l=>({width:l.shadow.map?.width,height:l.shadow.map?.height,
      position:l.position.toArray(),colour:l.color.getHexString(),intensity:l.intensity,bias:l.shadow.bias,normalBiasM:l.shadow.normalBias,radiusTexels:l.shadow.radius}));
    if(shadowMaps.some(m=>m.width!==1024||m.height!==1024))throw Error('Shadow maps not rendered');
    if(shadowFilterBuilds<1)throw Error('Hair shadow filter was not built');
    if(hairStudy.describe().material.indirect.builds<1)throw Error('Hair indirect contribution was not built');
    $('status').textContent=`${turntable?.active?'turntable '+turntable.degrees.toFixed(1)+'°':view} · ${frame} · ${neutralLight?'neutral':'warm'} light · retained hair v084 · inspection v084 · hair shadows ${hairCastsShadows?'ON':'OFF'} · frame ${draws} · NOT ACCEPTED`;
    $('report').value=JSON.stringify({inspection:{version:'v084',active:!!turntable?.active,degrees:turntable?.degrees??0,rigidHair:true},source,sourceHash,view,frame,draws,weights,headYaw,neutralLight,witness,wideHair,
      hair:hairStudy.describe(),hairBounds,shadowing:{hairCastsShadows,transmitted:renderer.shadowMap.transmitted,headCasterOpaque:body.material.castShadowNode===null,type:"PCF tent25",samples:25,kernelWeightSum:81,filterBuilds:shadowFilterBuilds,receivers:shadowReceivers,maps:shadowMaps,faceReceivesShadows:false},hemisphere:{sky:ambient.color.getHexString(),ground:ambient.groundColor.getHexString(),intensity:ambient.intensity},
      ocularCorrection:{version:'v003',scleraChroma:0,irisInput:'lighter procedural hazel using frozen source fibres',postAlbedoLift:false},
      cards:cardReport,geometry:'brow-only-v002 body, eyes, brows, lashes, pigment and expression deltas unchanged',maps:{curvature:null,region:null,cavity:null},eyeY,eyeFront,
      eyeGeometry:eyes.describe(),oralClearance:'failed witnessed crossings; no repair in this study',
      limits:'One original layered-card hair candidate; fixed face/eyes/brows. Static witnesses plus one bounded turntable; no geometry compilation or global fit. Full hair dynamics and mouth clearance unqualified.'},null,2);
    document.body.dataset.ready='true';
    return {hairBounds,rootResidualM:hairStudy.describe().maxRootResidualM};
  }catch(e){fail(e);}finally{busy=false;}
}
function reference(){
  $('reference').src=root+`reference/ember/portraits/face-reference-${view==='front'?2:1}.png`;
  $('ref-title').textContent=view==='front'?'Portrait 2 · face authority':'Portrait 1 · angle and hair authority';
}
function fail(e){$('status').textContent='Appearance study stopped: '+e.message;document.body.dataset.error=e.message;console.error(e);}
function chooseWitness(name){
  if(turntable){turntable.stop();turntable.active=false;}
  witness=name;wideHair=name!=='face';view=name==='angle'?'angle':name==='rear'?'rear':'front';
  neutralLight=name==='angle'||name==='rear';
  const pose=name==='head'?'head':name==='rear'?'neutral':'reference';
  setFrame(pose);reference();
  $('ref-title').textContent=view==='front'?'Portrait 2 · face authority':view==='angle'?'Portrait 1 · hair authority':'Portrait 1 · style context; rear anatomy is unreferenced';
  for(const b of document.querySelectorAll('[data-witness]'))b.setAttribute('aria-pressed',String(b.dataset.witness===name));
}
for(const b of document.querySelectorAll('[data-witness]'))b.onclick=()=>{chooseWitness(b.dataset.witness);void render();};
$('hair-shadow-toggle').onclick=()=>{
  if(busy||!hairStudy)return;
  hairCastsShadows=!hairCastsShadows;
  $('hair-shadow-toggle').setAttribute('aria-pressed',String(hairCastsShadows));
  $('hair-shadow-toggle').textContent=hairCastsShadows?'Hair shadows on':'Hair shadows off';
  void render();
};

async function main(){
  await renderer.init();const bytes=await(await fetch(root+source)).arrayBuffer();
  const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),b=>b.toString(16).padStart(2,'0')).join('');
  if(hash!==sourceHash)throw Error('Frozen source hash mismatch');
  const gltf=await new GLTFLoader().parseAsync(bytes,root);rig=new Skeleton(gltf.scene);
  gltf.scene.traverse(m=>{if(!m.isMesh)return;meshes.push(m);m.frustumCulled=false;
    if(m.geometry.attributes.position.count>10000){if(body)throw Error('Ambiguous body');body=m;}});
  if(!body||meshes.length!==7||!rig.has('head')||!rig.has('neck'))throw Error('Incomplete frozen rig');
  eyes=new EyeMaterial({figure:gltf.scene,catchlightIntensity:8,scleraBrightness:1.1,scleraChroma:0});
  const bounds=new Box3().setFromBufferAttribute(eyes.globeMesh.geometry.attributes.position);
  eyeY=bounds.getCenter(new Vector3()).y;eyeFront=bounds.max.z;
  eyes.attach();await addSkinPigment();await correctBrowAndLashCards();
  // Freeze all existing appearance receivers; only the newly attached hair receives.
  gltf.scene.traverse(m=>{if(m.isMesh){m.receiveShadow=false;m.castShadow=m===body;}});
  hairStudy=await attachEmberHair({figure:gltf.scene,rig,body,renderer});
  poseRoot.add(gltf.scene);gltf.scene.position.fromArray(fit.center).negate();
  turntable=installTurntable({canvas:$('portrait'),draw:render,fail,prepare:()=>{
    wideHair=true;view='front';witness='turntable';neutralLight=false;hairCastsShadows=true;
    setFrame('reference');reference();
    $('ref-title').textContent='Portrait 2 · face authority; rear anatomy unreferenced';
    for(const b of document.querySelectorAll('[data-witness]'))b.setAttribute('aria-pressed','false');
    $('hair-shadow-toggle').setAttribute('aria-pressed','true');$('hair-shadow-toggle').textContent='Hair shadows on';
  }});
  chooseWitness('front');await render();
}
main().catch(fail);
