// Artist-only WebGL material. No UV, displacement, fibre, thickness or fit claim.
export const SETTINGS=Object.freeze({columns:64,rows:88,height:0.0012,blend:[0.24,0.40]});
const glsl=/* glsl */`
varying vec3 vKnitPosition;
varying vec3 vKnitNormal;
float knitLoop(vec2 coordinates) {
  vec2 q=coordinates*vec2(64.0,88.0);
  float footprint=max(length(dFdx(q)),length(dFdy(q)));
  float filterWeight=1.0-smoothstep(0.25,0.70,footprint);
  vec2 cell=fract(q);
  float t=cell.y;
  float w=0.04+0.34*t-0.055*sin(3.14159265*t);
  float slope=0.34-0.055*3.14159265*cos(3.14159265*t);
  float d=abs(abs(cell.x-0.5)-w)/sqrt(1.0+slope*slope);
  float ends=smoothstep(0.0,0.10,t)*(1.0-smoothstep(0.90,1.0,t));
  return exp(-pow(d/0.055,2.0))*ends*filterWeight;
}
float knitHeight(vec3 p,vec3 n) {
  vec3 weights=pow(abs(normalize(n)),vec3(8.0));
  weights/=max(weights.x+weights.y+weights.z,0.00001);
  // Torso: wales +Y on front/rear and sides; +Z on shoulder/underside.
  float torso=dot(weights,vec3(knitLoop(p.zy),knitLoop(p.xz),knitLoop(p.xy)));
  // Arms: wales outward along |X| on their broad surfaces. Axial end chart Y.
  float sleeve=dot(weights,vec3(knitLoop(p.zy),knitLoop(vec2(p.z,abs(p.x))),knitLoop(vec2(p.y,abs(p.x)))));
  float arm=smoothstep(0.24,0.40,abs(p.x));
  return 0.0012*mix(torso,sleeve,arm);
}
vec3 knitPerturb(vec3 position,vec3 n,float height,float face) {
  vec3 dx=dFdx(position),dy=dFdy(position);
  vec3 r1=cross(dy,n),r2=cross(n,dx);
  float determinant=dot(dx,r1)*face;
  if(abs(determinant)<1e-12)return n;
  vec3 gradient=sign(determinant)*(dFdx(height)*r1+dFdy(height)*r2);
  return normalize(abs(determinant)*n-gradient);
}
`;
function replaceOnce(text,needle,value){
  if(text.split(needle).length!==2)throw new Error(`Shader marker changed: ${needle}`);
  return text.replace(needle,value);
}
export function installKnit(material){
  material.customProgramCacheKey=()=> 'sugata-knit-surface-v1-185';
  material.onBeforeCompile=shader=>{
    shader.vertexShader=replaceOnce(shader.vertexShader,'#include <common>','#include <common>\nvarying vec3 vKnitPosition;\nvarying vec3 vKnitNormal;');
    shader.vertexShader=replaceOnce(shader.vertexShader,'#include <begin_vertex>','#include <begin_vertex>\nvKnitPosition=position;\nvKnitNormal=normal;');
    shader.fragmentShader=replaceOnce(shader.fragmentShader,'#include <common>','#include <common>\n'+glsl);
    shader.fragmentShader=replaceOnce(shader.fragmentShader,'#include <normal_fragment_maps>','#include <normal_fragment_maps>\nnormal=knitPerturb(-vViewPosition,normal,knitHeight(vKnitPosition,vKnitNormal),faceDirection);');
  };
  return material;
}
