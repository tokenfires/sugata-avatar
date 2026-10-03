/** One finite CPU-only URL/file admission; no network/browser or old observer edit. */
import fs from 'node:fs';import path from 'node:path';import vm from 'node:vm';import assert from 'node:assert/strict';import{createHash}from'node:crypto';import{fileURLToPath}from'node:url';
import{qualifyDeclaredViteResource}from'./vite-declared-resource.mjs';
const root=fileURLToPath(new URL('../../',import.meta.url)),base=path.join(root,'docs/evidence/nonhair-2026-10-03/url-admission');
const stop='2026-10-03T11:01:00Z',started=new Date().toISOString();
const sha=p=>createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const fixture=JSON.parse(fs.readFileSync(base+'/FIXTURES.json')),pins=JSON.parse(fs.readFileSync(base+'/INPUT-PINS.json'));
const options={origin:fixture.origin,repoRoot:fixture.repoRoot,devRoot:fixture.devRoot};
assert.equal(options.repoRoot,root.replace(/\/$/,''));assert.equal(options.devRoot,path.join(root,'packages/testbed'));
const output=base+'/AUDIT.json';assert.ok(!fs.existsSync(output),'One finite audit only');
const report={started,pid:process.pid,status:'running',stop,command:'node tools/critic/qualify-vite-declared-resource.mjs',inputPins:pins,fixtureSHA256:sha(base+'/FIXTURES.json'),helperSHA256:sha(new URL('./vite-declared-resource.mjs',import.meta.url)),instrumentSHA256:sha(new URL(import.meta.url)),observed:[],synthetic:[],refusals:[],limits:['Offline declared URL/file identity only; no HTTP bytes, fragment target, browser or appearance qualification.','Current POSIX/macOS Vite8.2.1 routes only; no Windows/public/plugin/proxy/symlink equivalence.','Old closed observer and product unchanged.']};
const save=()=>fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');
const deadline=()=>assert.ok(Date.now()<Date.parse(stop),'Fixed CPU deadline');save();
let error;
try{
 deadline();for(const[p,h]of Object.entries(pins))assert.equal(sha(path.join(root,p)),h,p);
 assert.equal(JSON.parse(fs.readFileSync(path.join(root,'node_modules/vite/package.json'))).version,'8.2.1');
 const source=fs.readFileSync(path.join(root,'node_modules/vite/dist/node/chunks/node.js'),'utf8');
 const names=['normalizePath','fsPathFromId','getHtmlFilename'];
 const excerpts=names.map(name=>{const match=source.match(new RegExp('function '+name+'\\([^)]*\\) \\{\\n[\\s\\S]*?\\n\\}'));assert.ok(match,name);return match[0];});
 assert.ok(source.includes('rtn = path.posix.join(FS_PREFIX, id)'));
 assert.ok(source.includes('const newUrl = url + "index.html"'));
 const oracle=vm.runInNewContext('const VOLUME_RE=/^[A-Z]:/i;'+excerpts.join('\n')+'\ngetHtmlFilename',{path,isWindows:false,FS_PREFIX:'/@fs/'});
 report.installedOracleExcerpts=Object.fromEntries(names.map((n,i)=>[n,excerpts[i]]));
 const prior=JSON.parse(fs.readFileSync(path.join(root,'captures/current-review-2026-10-02-v1/report.json')));
 const get=(o,key)=>key.replace(/\[(\d+)\]/g,'.$1').split('.').reduce((v,k)=>v[k],o);
 for(const c of fixture.cases){deadline();const witness=get(prior,c.witness);assert.equal(typeof witness==='string'?witness:witness.url,c.url);assert.equal(sha(path.join(root,c.file)),c.sha256);assert.equal(sha(path.join(root,c.snapshot)),c.sha256);
  const result=qualifyDeclaredViteResource(c.url,c.absoluteFile,options),u=new URL(c.url),oracleInput=u.pathname==='/'?'/index.html':u.pathname;
  assert.equal(oracle(oracleInput,{config:{root:options.devRoot}}),c.absoluteFile);assert.equal(result.file,c.absoluteFile);assert.equal(result.fragment,u.hash);assert.equal(result.query,u.search);
  report.observed.push({...c,result});
 }
 assert.equal(report.observed.length,19);
 const failureFile=path.join(root,'docs/evidence/nonhair-2026-10-03/mobile-body-jitter/archive/capture/page.png');
 const synthetic=[
  {label:'Reconstructed failure URL, not a retained DOM URL',url:fixture.origin+path.posix.join('/@fs/',failureFile),file:failureFile},
  {label:'Double slash filesystem spelling, offline codec only',url:fixture.origin+'/@fs/'+failureFile,file:failureFile},
  {label:'Space filename, synthetic and not a served file',url:fixture.origin+path.posix.join('/@fs/',options.repoRoot+'/fixture%20with%20space.png'),file:options.repoRoot+'/fixture with space.png'},
  {label:'Query/fragment metadata on known dev file',url:fixture.origin+'/src/showcase.html?topColor=%23617a70#saved-looks',file:path.join(options.devRoot,'src/showcase.html')}
 ];
 for(const c of synthetic){deadline();const result=qualifyDeclaredViteResource(c.url,c.file,options),u=new URL(c.url);assert.equal(result.file,c.file);assert.equal(oracle(u.pathname,{config:{root:options.devRoot}}),c.file);report.synthetic.push({...c,result});}
 const expected=fixture.cases[0].absoluteFile;
 const negatives=[
  {label:'Wrong declared identity',url:fixture.cases[0].url,file:path.join(options.devRoot,'src/showcase.html')},
  {label:'Foreign origin',url:fixture.cases[0].url.replace(fixture.origin,'http://127.0.0.1:9999'),file:expected},
  {label:'Virtual client route',url:fixture.origin+'/@vite/client',file:expected},
  {label:'Malformed percent encoding',url:fixture.origin+'/@fs/%zz',file:expected},
  {label:'Encoded separator outside scope',url:fixture.origin+'/@fs/%2FUsers/example.png',file:expected},
  {label:'Second percent decoding outside scope',url:fixture.origin+'/@fs/%2520',file:expected}
 ];
 for(const c of negatives){deadline();let caught;try{qualifyDeclaredViteResource(c.url,c.file,options);}catch(e){caught=e;}assert.ok(caught,c.label);report.refusals.push({...c,error:caught.message});}
 for(const[p,h]of Object.entries(pins))assert.equal(sha(path.join(root,p)),h,p);
 assert.equal(sha(base+'/FIXTURES.json'),report.fixtureSHA256);assert.equal(sha(new URL('./vite-declared-resource.mjs',import.meta.url)),report.helperSHA256);deadline();report.status='passed';
}catch(e){error=e;report.status='failed';report.error=e.stack??String(e);}
finally{report.finished=new Date().toISOString();save();console.log(JSON.stringify({pid:process.pid,status:report.status,observed:report.observed.length,synthetic:report.synthetic.length,refusals:report.refusals.length,reportSHA256:sha(output)}));}
if(error)throw error;
