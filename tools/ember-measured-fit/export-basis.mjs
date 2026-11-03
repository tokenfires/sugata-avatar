import fs from 'node:fs';
import path from 'node:path';
import { readGlb, readAccessor } from '../lut-bake/glb.mjs';
const out='docs/evidence/ember-2026-10-31-measured-fit';
const glb=readGlb('assets/figures/figure_g000.glb');
const mesh=glb.json.meshes[0],p=mesh.primitives[0];
if(mesh.name!=='base.001')throw Error('Unexpected body');
const positions=readAccessor(glb,p.attributes.POSITION).data;
if(positions.length!==14517*3)throw Error('Unexpected position count');
function bin(name,data){const a=new Float32Array(data);fs.writeFileSync(path.join(out,name),Buffer.from(a.buffer));}
bin('native-positions.f32',positions);
const names=mesh.extras.targetNames;
const groups={smile:['mouthSmileLeft','mouthSmileRight'],squint:['eyeSquintLeft','eyeSquintRight'],cheekSquint:['cheekSquintLeft','cheekSquintRight']};
for(const [name,channels]of Object.entries(groups)){const d=new Float64Array(positions.length);for(const c of channels){let i=names.indexOf(c);if(i<0)throw Error('Missing '+c);let values=readAccessor(glb,p.targets[i].POSITION).data;for(let j=0;j<d.length;j++)d[j]+=values[j];}bin(`native-${name}.f32`,d);}
fs.writeFileSync(path.join(out,'native-basis.json'),JSON.stringify({source:'assets/figures/figure_g000.glb',mesh:mesh.name,count:positions.length/3,axis:'gltf-y-up-metres',expressionGroups:groups,limits:'Identity application does not automatically refit separate eyes or teeth. Source export only; no fitting or appearance conclusion.'},null,2)+'\n');
console.log('Exported one body position buffer and three existing expression delta groups; no mesh mutation.');
