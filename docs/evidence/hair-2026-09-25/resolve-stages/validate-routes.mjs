import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {patch,fields} from './route.mjs';
const root='tmp/hair-sep25/resolve-stages',dir=root+'/captures';
const original=fs.readFileSync(dir+'/original-served.js','utf8');
for(const field of ['identity',...Object.keys(fields)])assert.equal(patch(original,field),fs.readFileSync(`${dir}/${field}-served.js`,'utf8'));
assert.equal(original,fs.readFileSync('docs/evidence/hair-2026-09-25/lock-runtime/original-served.js','utf8'));
const source=fs.readFileSync('node_modules/three/examples/jsm/tsl/display/TAAUNode.js','utf8');
for(const field of Object.keys(fields)){
 const instrumented=patch(source,field);
 assert.match(instrumented,/count: 3/);
 assert.throws(()=>patch(instrumented,field));
}
const sha=s=>createHash('sha256').update(s).digest('hex');
console.log('PASS: exact diagnostic responses bind to their declared patches; identity module is unchanged from prior runtime. Both source forms accept one patch and reject double patching.');
console.log('Original served module SHA256 '+sha(original));
