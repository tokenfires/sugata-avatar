import { WebGPURenderer, Scene, Color, PerspectiveCamera, HemisphereLight,
    DirectionalLight, Box3, Vector3, ACESFilmicToneMapping } from 'three/webgpu';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { texture, uv, vec2, vec3, vec4, float, uniform, positionWorld,
    sin, dot, fract, floor, smoothstep, mix, exp, pow, step } from 'three/tsl';
import { createSkinMaterial } from '../../core/src/material/SkinMaterial.js';
import { EyeMaterial } from '../../core/src/material/EyeMaterial.js';

const canvas = document.getElementById('portrait');
const status = document.getElementById('status');
const frame = document.getElementById('stage');
const version = new URLSearchParams(location.search).get('version') ?? '001';
if (!['001','002'].includes(version)) throw new Error('Unknown facial study');
document.getElementById('version').textContent = `Facial study ${version}`;
const scene = new Scene();
scene.background = new Color('#b9beb5');
const camera = new PerspectiveCamera(29,1,0.01,20);
const renderer = new WebGPURenderer({canvas,antialias:true});
renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));
renderer.toneMapping = ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.95;
const ambient = new HemisphereLight('#efeee9','#7c8173',1.4);
const key = new DirectionalLight('#fff1df',2.8);
const fill = new DirectionalLight('#e4e9e9',0.65);
scene.add(ambient,key,fill);
let focus;
let eyes;
const freckleAmount=uniform(1);
let draws=0;
async function render(){
    if(!focus) return;
    eyes?.update();
    await renderer.renderAsync(scene,camera);
    document.body.dataset.ready='true';
    document.body.dataset.draws=String(++draws);
}
function setView(view){
    const angle=view==='angle'?Math.PI/6:0;
    const distance=0.84;
    camera.position.copy(focus).add(new Vector3(Math.sin(angle)*distance,0.005,Math.cos(angle)*distance));
    camera.lookAt(focus);
    document.querySelectorAll('[data-view]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.view===view)));
    document.body.dataset.view=view;
    return render();
}
function setLight(light){
    key.color.set(light==='warm'?'#fff1df':'#ffffff');
    fill.color.set(light==='warm'?'#e4e9e9':'#ffffff');
    ambient.color.set(light==='warm'?'#efeee9':'#ffffff');
    document.querySelectorAll('[data-light]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.light===light)));
    document.body.dataset.light=light;
    return render();
}
function resize(){
    renderer.setSize(frame.clientWidth,frame.clientHeight,false);
    camera.aspect=frame.clientWidth/frame.clientHeight;
    camera.updateProjectionMatrix();
    void render();
}
async function main(){
    await renderer.init();
    const url=`/@fs/Users/robault/GitHub/sugata-avatar/docs/evidence/ember-2026-10-30/candidate-v${version}/ember.glb`;
    const gltf=await new GLTFLoader().loadAsync(url);
    scene.add(gltf.scene);
    gltf.scene.updateMatrixWorld(true);
    let body;
    gltf.scene.traverse(o=>{if(o.isMesh && (!body || o.geometry.attributes.position.count>body.geometry.attributes.position.count)) body=o;});
    if(!body) throw new Error('Facial mesh missing');
    const bounds=new Box3().setFromObject(body);
    eyes=new EyeMaterial({figure:gltf.scene,catchlightIntensity:8,scleraBrightness:1.1});
    eyes.attach();
    const eyeBounds=new Box3().setFromObject(eyes.globeMesh);
    const eyeY=eyeBounds.getCenter(new Vector3()).y;
    const front=eyeBounds.max.z;
    focus=new Vector3(0,bounds.max.y-0.145,0.015);
    key.position.copy(focus).add(new Vector3(-0.6,0.6,0.8));
    fill.position.copy(focus).add(new Vector3(0.7,0.2,0.45));
    const albedoMap=body.material.map;
    const skin=await createSkinMaterial({albedoMap,curvatureMapUrl:null,regionMapUrl:null,cavityMapUrl:null,
        settings:{roughness:0.52,secondLobeWeight:0.10}});
    // Sparse millimetre-scale pigment, limited to the nose/upper cheeks. These are
    // new shader marks, not edits to an original reference or to the source albedo.
    const p=vec2(positionWorld.x,positionWorld.y).mul(1000);
    const id=floor(p);
    const h=fract(sin(dot(id,vec2(127.1,311.7))).mul(43758.5453));
    const centre=vec2(h,fract(h.mul(37.31)));
    const d=fract(p).sub(centre).length();
    const dots=smoothstep(0.32,0.12,d).mul(step(0.83,h));
    const band=exp(pow(positionWorld.y.sub(eyeY-0.027).div(0.017),2).negate());
    const side=smoothstep(0.073,0.047,positionWorld.x.abs());
    const facing=smoothstep(front-0.045,front-0.015,positionWorld.z);
    const freckles=dots.mul(band).mul(side).mul(facing).mul(freckleAmount).mul(0.32);
    skin.colorNode=vec4(mix(texture(albedoMap,uv()).rgb,vec3(0.22,0.092,0.041),freckles),1);
    body.material=skin;
    document.body.dataset.model=url;
    document.body.dataset.eyeY=String(eyeY);
    document.body.dataset.hair='pending';
    document.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>void setView(b.dataset.view));
    document.querySelectorAll('[data-light]').forEach(b=>b.onclick=()=>void setLight(b.dataset.light));
    document.getElementById('freckles').onclick=()=>{
        freckleAmount.value=1-freckleAmount.value;
        document.getElementById('freckles').setAttribute('aria-pressed',String(freckleAmount.value===1));
        void render();
    };
    new ResizeObserver(resize).observe(frame);
    resize();
    await setView('front');
    status.textContent=`Facial study ${version} · hair unfinished · likeness under review`;
}
main().catch(error=>{
    status.textContent=`Study could not open: ${error.message}`;
    document.body.dataset.error=error.message;
    console.error(error);
});
