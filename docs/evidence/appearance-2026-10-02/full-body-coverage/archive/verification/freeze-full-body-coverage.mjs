/** Preserve the completed packet with exact byte copies and verified manifest. */
import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';
const root=process.cwd(),raw='captures/full-body-coverage-2026-10-02-v1',doc='docs/evidence/appearance-2026-10-02/full-body-coverage',archive=doc+'/archive';
const read=p=>fs.readFileSync(path.join(root,p)),sha=b=>createHash('sha256').update(b).digest('hex');
const started=new Date().toISOString();assert.ok(Date.now()<Date.parse('2026-10-03T06:16:00Z'));assert.ok(!fs.existsSync(archive));
const report=JSON.parse(read(raw+'/report.json')),independent=JSON.parse(read(doc+'/independent.json'));
assert.equal(report.status,'observed');assert.equal(independent.projectedVertices,29034);
const mappings=[];
function add(src,dst){assert.ok(fs.existsSync(src),src);mappings.push({source:src,file:dst});}
function walk(dir){return fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(dir,e.name)):[path.join(dir,e.name)]);}
let sourceIndex=0;
for(const src of walk(raw))add(src,src.includes('/sources/')?'sources/'+String(sourceIndex++).padStart(2,'0')+'-'+path.basename(src):'capture/'+path.basename(src));
for(const name of ['PLAN.md','PRE-FLIGHT-CRITIQUE.md','PRIMARY-REFERENCE.json','ROOT-DECISION.md','CRITIQUE.md','independent.json','verify-replay.py','review.html'])add(doc+'/'+name,'decision/'+name);
add('docs/evidence/appearance-2026-10-02/NEXT-SLICE-VALUE-CRITIQUE.md','decision/NEXT-SLICE-VALUE-CRITIQUE.md');
for(const name of ['verify-full-body-coverage.mjs','freeze-full-body-coverage.mjs','png.mjs'])add('tools/critic/'+name,'verification/'+name);
add('node_modules/three/LICENSE','sources/three-LICENSE');
const manifest={started,pid:process.pid,scope:'Exact completed replay packet; old measured input paths remain separately pinned and preserved.',files:[],externalInputs:{...report.inputs,'tools/critic/png.mjs':sha(read('tools/critic/png.mjs'))}};
assert.equal(new Set(mappings.map(m=>m.file)).size,mappings.length);
for(const m of mappings){const b=read(m.source),dest=path.join(archive,m.file);fs.mkdirSync(path.dirname(dest),{recursive:true});fs.writeFileSync(dest,b);manifest.files.push({...m,bytes:b.length,sha256:sha(b)});}
for(const[p,h]of Object.entries(manifest.externalInputs))assert.equal(sha(read(p)),h,p);
for(const f of manifest.files)assert.equal(sha(read(archive+'/'+f.file)),f.sha256,f.file);
manifest.finished=new Date().toISOString();manifest.count=manifest.files.length;manifest.bytes=manifest.files.reduce((s,f)=>s+f.bytes,0);
assert.ok(Date.now()<Date.parse('2026-10-03T06:16:00Z'));fs.writeFileSync(archive+'/archive-manifest.json',JSON.stringify(manifest,null,2)+'\n');
for(const p of [...walk(raw),...walk(archive),...mappings.filter(m=>!m.source.startsWith(raw)&&!m.source.startsWith('node_modules/')).map(m=>m.source)])fs.chmodSync(p,fs.statSync(p).mode&~0o222);
console.log(JSON.stringify({started,finished:manifest.finished,pid:process.pid,files:manifest.count,bytes:manifest.bytes,externalPins:Object.keys(manifest.externalInputs).length,manifestSha256:sha(read(archive+'/archive-manifest.json'))}));
