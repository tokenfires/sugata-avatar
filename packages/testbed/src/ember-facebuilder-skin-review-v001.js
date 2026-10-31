import { WebGPURenderer, Scene, Color, PerspectiveCamera, HemisphereLight,
    DirectionalLight, Box3, Vector3, MeshBasicMaterial, MeshStandardMaterial,
    NoToneMapping } from 'three/webgpu';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { createCoverageStudy } from './ember-facebuilder-skin-v001.js';

const stage=document.getElementById('stage');
const status=document.getElementById('status');
const renderer=new WebGPURenderer({canvas:document.getElementById('portrait'),antialias:true});
renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));
renderer.toneMapping=NoToneMapping;
const scene=new Scene();
scene.background=new Color('#b9beb5');
const camera=new PerspectiveCamera(29,1,0.01,100);
scene.add(new HemisphereLight('#ffffff','#757d73',2));
const key=new DirectionalLight('#ffffff',2.4);
key.position.set(-4,5,7);scene.add(key);
const expression=new URLSearchParams(location.search).get('expression')??'neutral';
if(!['neutral','photo2'].includes(expression))throw new Error('Unknown fitted expression');
const coverage=new URLSearchParams(location.search).get('material');
if(coverage!==null&&coverage!=='skin-v001')throw new Error('Unknown coverage study');
if(coverage&&expression!=='neutral')throw new Error('Coverage study uses the preserved neutral base only');
const filename=expression==='neutral'?'ember-head-projected-v001.glb':'ember-head-photo2-expression-v001.glb';
const url=`/@fs/Users/robault/GitHub/sugata-avatar/reference/ember/authoring/facebuilder/${filename}`;
document.querySelector('header p').textContent=`Photo-fitted head · FaceBuilder / Blender authoring · ${expression==='neutral'?'neutral base':'portrait 2 expression diagnostic'}, unaccepted`;
if(coverage)document.querySelector('header p').textContent='Skin coverage v001 · provisional fallback outside trusted face · unaccepted';
let focus,distance,meshes=[];
let view='front',mode=coverage?'skin':expression==='photo2'?'shape':'photo',draws=0;
async function render(){
    if(!focus)return;
    const angle=({front:0,angle:Math.PI/6,profile:Math.PI/2})[view];
    camera.position.copy(focus).add(new Vector3(Math.sin(angle)*distance,0,Math.cos(angle)*distance));
    camera.lookAt(focus);
    for(const {mesh,photo,shape,skin} of meshes)mesh.material=mode==='photo'?photo:mode==='skin'?skin:shape;
    await renderer.renderAsync(scene,camera);
    Object.assign(document.body.dataset,{ready:'true',view,mode,expression,model:url,draws:String(++draws)});
    status.textContent=mode==='photo'?'First photo projection · hair/neck gaps visible · likeness not accepted':mode==='skin'?'Coverage study only · peripheral skin is provisional · eyes/hair/finish unfinished':'Actual fitted geometry · texture hidden · structure not accepted';
}
function resize(){
    renderer.setSize(stage.clientWidth,stage.clientHeight,false);
    camera.aspect=stage.clientWidth/stage.clientHeight;
    camera.updateProjectionMatrix();
    void render();
}
async function main(){
    await renderer.init();
    const gltf=await new GLTFLoader().loadAsync(url);
    scene.add(gltf.scene);gltf.scene.updateMatrixWorld(true);
    const bounds=new Box3().setFromObject(gltf.scene);
    focus=bounds.getCenter(new Vector3());
    distance=bounds.getSize(new Vector3()).y/(2*Math.tan(camera.fov*Math.PI/360))*1.12;
    gltf.scene.traverse(mesh=>{
        if(!mesh.isMesh)return;
        const study=coverage?createCoverageStudy(mesh):null;
        meshes.push({mesh,photo:new MeshBasicMaterial({map:mesh.material.map}),
            shape:new MeshStandardMaterial({color:'#c8c5bc',roughness:0.7,metalness:0}),skin:study?.material});
        if(study)document.body.dataset.coverageStats=JSON.stringify(study.stats);
    });
    if(!meshes.length)throw new Error('Export contains no head mesh');
    for(const b of document.querySelectorAll('[data-view]'))b.onclick=()=>{
        view=b.dataset.view;
        for(const x of document.querySelectorAll('[data-view]'))x.setAttribute('aria-pressed',String(x===b));
        void render();
    };
    for(const b of document.querySelectorAll('[data-mode]'))b.onclick=()=>{
        mode=b.dataset.mode;
        for(const x of document.querySelectorAll('[data-mode]'))x.setAttribute('aria-pressed',String(x===b));
        void render();
    };
    for(const b of document.querySelectorAll('[data-mode]'))b.setAttribute('aria-pressed',String(b.dataset.mode===mode));
    document.querySelector('[data-mode="skin"]').hidden=!coverage;
    new ResizeObserver(resize).observe(stage);resize();
}
main().catch(error=>{status.textContent=`Head could not open: ${error.message}`;document.body.dataset.error=error.message;console.error(error);});
