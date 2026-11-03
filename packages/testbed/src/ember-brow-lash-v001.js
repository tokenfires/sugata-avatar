import { WebGPURenderer, Scene, Color, PerspectiveCamera, HemisphereLight,
  DirectionalLight, Group, Vector3, ACESFilmicToneMapping, Box3, MeshPhysicalNodeMaterial } from 'three/webgpu';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { texture, uv, vec2, vec3, vec4, float, positionGeometry,
  sin, dot, fract, floor, smoothstep, mix, exp, pow, step, max } from 'three/tsl';
import { Skeleton } from '../../core/src/figure/Skeleton.js';
import { createSkinMaterial } from '../../core/src/material/SkinMaterial.js';
import { EyeMaterial } from './ember-ocular-v003-material.js';

const root='/@fs/Users/robault/GitHub/sugata-avatar/';
const $=id=>document.getElementById(id);
const fit=await(await fetch(root+'docs/evidence/ember-2026-10-31-measured-fit/candidate-correction-v001.json')).json();
const source='docs/evidence/ember-2026-10-31-eye-bridge/candidate.glb';
const sourceHash='bcb87a95d76ad252d2681c614c8d9f34d2f51a87a10077298323066fc9ebcdef';
const renderer=new WebGPURenderer({canvas:$('portrait'),antialias:true});
renderer.setPixelRatio(1);renderer.setSize(512,512,false);
renderer.toneMapping=ACESFilmicToneMapping;renderer.toneMappingExposure=.95;
const scene=new Scene();scene.background=new Color('#b9beb5');
const ambient=new HemisphereLight('#efeee9','#7c8173',1.4);
const key=new DirectionalLight('#fff1df',2.8),fill=new DirectionalLight('#e4e9e9',.65);
key.position.set(-.6,.6,.8);fill.position.set(.7,.2,.45);scene.add(ambient,key,fill);
const camera=new PerspectiveCamera(28,1,.01,10),poseRoot=new Group();scene.add(poseRoot);
const meshes=[];let rig,body,eyes,view='front',frame='reference',draws=0,busy=false;
let weights={},headYaw=0,neutralLight=false,eyeY,eyeFront;
const cardReport=[];
const rgb=hex=>vec3(...new Color(hex).toArray());

async function correctBrowAndLashCards(){
  if(renderer.samples!==4)throw Error('Expected four-sample MSAA for card coverage');
  const positions=await(await fetch(root+'docs/evidence/ember-2026-10-31-brow-lash-v001/brow-positions.f32')).arrayBuffer();
  const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',positions)),b=>b.toString(16).padStart(2,'0')).join('');
  if(hash!=='d7e204c19fd76a10d06ac2545956d0d939127608d3342663dcec6a7136234247')throw Error('Brow correction hash changed');
  for(const mesh of meshes){
    if(!/eyebrow|eyelash/i.test(mesh.name))continue;
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
    card.metalness=0;card.specularIntensity=0;card.alphaTest=.1;card.alphaToCoverage=true;
    mesh.material=card;
    const report={mesh:mesh.name,brow,alphaTest:.1,alphaToCoverage:true,msaaSamples:renderer.samples,
      placement:brow?'2mm upward query; projected rise .773–2.101mm; same frozen-skin signed gap':'unchanged'};
    mesh.onBeforeRender=()=>{report.drawSamples=renderer.currentSamples;
      if(report.drawSamples!==4)throw Error('Card draw is not four-sample MSAA');};
    cardReport.push(report);
  }
  if(cardReport.length!==2)throw Error('Expected exactly two cards');
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
    const c=fit.views[view].camera;poseRoot.rotation.set(c[1],c[0],c[2],'ZYX');poseRoot.position.set(c[4],c[5],0);
    camera.position.set(0,0,Math.exp(c[3]));camera.lookAt(0,0,0);camera.updateMatrixWorld(true);
    rig.reset();rig.rotationOf('neck').setFromAxisAngle(new Vector3(0,1,0),headYaw*.35);
    rig.rotationOf('head').setFromAxisAngle(new Vector3(0,1,0),headYaw*.65);rig.update();
    for(const m of meshes){if(!m.morphTargetInfluences)continue;m.morphTargetInfluences.fill(0);
      for(const [name,value]of Object.entries(weights)){const i=m.morphTargetDictionary[name];if(i!==undefined)m.morphTargetInfluences[i]=value;}}
    scene.updateMatrixWorld(true);for(const m of meshes)if(m.isSkinnedMesh)m.skeleton.update();eyes.update();
    key.color.set(neutralLight?'#ffffff':'#fff1df');fill.color.set(neutralLight?'#ffffff':'#e4e9e9');ambient.color.set(neutralLight?'#ffffff':'#efeee9');
    eyes.keyLightDirectionUniform.value.copy(key.position).normalize();
    await renderer.renderAsync(scene,camera);draws++;
    $('status').textContent=`${view} · ${frame} · ${neutralLight?'neutral':'warm'} light · brow/lash correction v001 · frame ${draws} · NOT ACCEPTED`;
    $('report').value=JSON.stringify({source,sourceHash,view,frame,draws,weights,headYaw,neutralLight,
      ocularCorrection:{version:'v003',scleraChroma:0,irisInput:'lighter procedural hazel using frozen source fibres',postAlbedoLift:false},
      cards:cardReport,geometry:'frozen head, eyes, lashes and morphs; brow-card positions corrected only',maps:{curvature:null,region:null,cavity:null},eyeY,eyeFront,
      eyeGeometry:eyes.describe(),oralClearance:'failed witnessed crossings; no repair in this study',
      limits:'no face identity edit, animation loop, native build or new source texture'},null,2);
    document.body.dataset.ready='true';
  }catch(e){fail(e);}finally{busy=false;}
}
function reference(){
  $('reference').src=root+`reference/ember/portraits/face-reference-${view==='front'?2:1}.png`;
  $('ref-title').textContent=view==='front'?'Portrait 2 · face authority':'Portrait 1 · angle and hair authority';
}
function fail(e){$('status').textContent='Appearance study stopped: '+e.message;document.body.dataset.error=e.message;console.error(e);}
for(const b of document.querySelectorAll('[data-view]'))b.onclick=()=>{view=b.dataset.view;
  for(const x of document.querySelectorAll('[data-view]'))x.setAttribute('aria-pressed',String(x===b));
  reference();setFrame($('pose').value);void render();};
$('pose').onchange=()=>{setFrame($('pose').value);void render();};
$('light').onclick=()=>{neutralLight=!neutralLight;$('light').setAttribute('aria-pressed',String(neutralLight));void render();};

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
  poseRoot.add(gltf.scene);gltf.scene.position.fromArray(fit.center).negate();
  reference();setFrame(frame);await render();
}
main().catch(fail);
