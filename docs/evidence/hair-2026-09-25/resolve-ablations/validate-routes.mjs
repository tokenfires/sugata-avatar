import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {patch,fields} from './route.mjs';
const dir='tmp/hair-sep25/resolve-ablations/'+(process.argv[2]??'captures');
const original=fs.readFileSync(dir+'/original-served.js','utf8');
assert.equal(original,fs.readFileSync('docs/evidence/hair-2026-09-25/resolve-stages/original-served.js','utf8'));
for(const arm of ['identity',...Object.keys(fields)])assert.equal(patch(original,arm),fs.readFileSync(`${dir}/${arm}-served.js`,'utf8'));
for(const source of [original,fs.readFileSync('node_modules/three/examples/jsm/tsl/display/TAAUNode.js','utf8')]){
 assert.equal(patch(source,'identity'),source);assert.throws(()=>patch(source,'invalid'));
 for(const arm of Object.keys(fields)){
  const changed=patch(source,arm);
  assert.equal(changed.split('\n').length,source.split('\n').length);
  const before=source.split('\n'),after=changed.split('\n');
  assert.equal(before.filter((line,i)=>line!==after[i]).length,1);
  assert.throws(()=>patch(changed,arm));
  // The two interventions cannot be stacked accidentally.
  for(const other of Object.keys(fields))assert.throws(()=>patch(changed,other));
 }
}
console.log('PASS: exact served modules contain one expression change per ablation; source and bundled forms agree. Original is byte-identical to prior audit. Unknown/repeated/combined patches rejected.');
console.log('Original served SHA256 '+createHash('sha256').update(original).digest('hex'));
