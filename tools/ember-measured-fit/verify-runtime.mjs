import fs from 'node:fs';
import { IdentityCatalogue } from '../../packages/core/src/figure/IdentityCatalogue.js';
import { IdentityTargets } from '../../packages/core/src/figure/IdentityTargets.js';
const dir='docs/evidence/ember-2026-10-31-measured-fit/';
const study=process.argv[2]??'candidate-v001';
if(!['candidate-v001','candidate-correction-v001'].includes(study))throw Error('Unknown candidate');
const data=JSON.parse(fs.readFileSync(dir+study+'.json'));

const catalogue=JSON.parse(fs.readFileSync('assets/identity/catalogue.json'));
const c=new IdentityCatalogue(catalogue);
const targets=new IdentityTargets(catalogue,{baseUrl:new URL('../../assets/identity/',import.meta.url).href,fetchBytes:async url=>{const b=fs.readFileSync(new URL(url));return b.buffer.slice(b.byteOffset,b.byteOffset+b.length);}});
const stack=c.resolve(data.identity);await targets.loadRegions([...new Set(stack.map(s=>s.region))]);
const mapBytes=fs.readFileSync('assets/identity/figure-vertex-map.bin');targets.useVertexMap(new Uint16Array(mapBytes.buffer,mapBytes.byteOffset,mapBytes.length/2));
function f32(name){const b=fs.readFileSync(dir+name);return new Float32Array(b.buffer,b.byteOffset,b.length/4);}
const positions=new Float64Array(f32('native-positions.f32'));const stats=targets.apply(positions,stack);const output=f32(study+'-positions.f32');
let worst=0;for(let i=0;i<positions.length;i++)worst=Math.max(worst,Math.abs(positions[i]-output[i]));
const result={pass:worst<2e-7,worstCoordinateDifferenceMetres:worst,source:'Actual existing Sugata IdentityCatalogue.resolve + IdentityTargets.apply',stats,limit:'Arithmetic parity only; not appearance/rig fit acceptance.'};
fs.writeFileSync(dir+(study==='candidate-v001'?'runtime-parity.json':'correction-runtime-parity.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));if(!result.pass)process.exitCode=1;
