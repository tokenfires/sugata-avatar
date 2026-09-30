// Read-only source calculation of the geometry-wide median used by runtime stiffness.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {BufferGeometry,BufferAttribute} from 'three';
import {deriveCardGroom} from '../../packages/core/src/motion/HairDynamics.js';
import {readGlb,readPrimitive} from '../lut-bake/glb.mjs';
const output='captures/lower-head-v1/derived-compliance.json';assert.ok(!fs.existsSync(output));
const sha=b=>createHash('sha256').update(b).digest('hex');
const assets=[['captures/bob-side-envelope-v3/candidate.glb','bbed05d0ce51eccc84fbfb1a9baca9f4e9a36ac2b3176869d2e7bfda27fa8ad9'],['captures/bob-lower-curve-v1/candidate.glb','2b0c68c05802d0f515aa84b7e505fd325735befbc0159a50bd37cc887e274802']];
const arms=assets.map(([file,hash])=>{
  assert.equal(sha(fs.readFileSync(file)),hash);
  const p=readPrimitive(readGlb(file),'hair_bob02');
  const geometry=new BufferGeometry().setAttribute('position',new BufferAttribute(new Float32Array(p.positions),3));
  geometry.setIndex(new BufferAttribute(new Uint32Array(p.indices),1));
  const groom=deriveCardGroom(geometry),arcs=[...groom.arcLengths],ordered=[...arcs].sort((a,b)=>a-b);
  const median=Math.max(ordered[Math.floor(ordered.length/2)],1e-6);
  const compliance=Array.from(new Float32Array(arcs.map(v=>Math.min(Math.max(median/Math.max(v,1e-6),.3),3))));
  geometry.dispose();return {file,sha256:hash,cardCount:arcs.length,medianArcMetres:median,arcs,compliance};
});
assert.equal(arms[0].cardCount,496);assert.equal(arms[1].cardCount,496);
const authoring=JSON.parse(fs.readFileSync('captures/bob-lower-curve-v1/candidate-report.json'));
const changed=new Set(authoring.affectedCards);
const untouched=arms[0].arcs.map((_,card)=>card).filter(c=>!changed.has(c));
assert.ok(untouched.every(c=>arms[0].arcs[c]===arms[1].arcs[c]));
const rows=untouched.map(card=>({card,arcMetres:arms[0].arcs[card],baselineCompliance:arms[0].compliance[card],candidateCompliance:arms[1].compliance[card]}));
const sourcePaths=['tools/critic/audit-bob-lower-compliance.mjs','packages/core/src/motion/HairDynamics.js','tools/lut-bake/glb.mjs'];
const result={status:'derived runtime input difference; causal motion ablation not performed',generated:new Date().toISOString(),arms,untouchedCards:rows,
  changedUntouchedComplianceCount:rows.filter(r=>r.baselineCompliance!==r.candidateCompliance).length,fringe494:rows.find(r=>r.card===494),
  sourceHashes:Object.fromEntries(sourcePaths.map(p=>[p,sha(fs.readFileSync(p))])),
  limits:['Uses the actual deriveCardGroom export and the explicit median/Float32 formula at HairDynamics.js524–533.','Demonstrates a shared runtime-input change despite untouched geometry. It does not prove this input alone causes the measured fringe difference or that the difference is visible.','No stiffness or simulation setting was modified.']};
for(const file of sourcePaths){const target=`captures/lower-head-v1/compliance-source/${file}`;fs.mkdirSync(target.slice(0,target.lastIndexOf('/')),{recursive:true});fs.copyFileSync(file,target,fs.constants.COPYFILE_EXCL);}
fs.writeFileSync(output,JSON.stringify(result,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({medians:arms.map(a=>a.medianArcMetres),changedUntouchedComplianceCount:result.changedUntouchedComplianceCount,fringe494:result.fringe494}));
