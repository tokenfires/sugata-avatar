from pathlib import Path
import json, hashlib, os, datetime, difflib
d=Path(__file__).resolve().parent;old=d.parent/'knit-sweater-cage'
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
started=datetime.datetime.now(datetime.timezone.utc).isoformat()
assert sha(d/'PLAN.md')=='876e3cbbac94c94b958d4229234e1bb7e13a798dba952cda5f8dc9f798976662'
assert sha(d/'WORTH.md')=='190ae4cb5f7453ea0b6bec401809a7b27079f605a66c1314c587f8b9f6d7cb46'
assert sha(old/'author.mjs')=='b23b8340ff6f1e754914a174cf3f04839647fac9f4311f6697c5944ad22fada1'
assert sha(old/'SOURCE.md')=='f1b42fc10ddb0bc87023502b650176cd27f487cd23c1316d67561615bb5c1fd6'
assert not (d/'author.mjs').exists()
original=(old/'author.mjs').read_text();s=original
def replace(a,b):
 global s
 assert s.count(a)==1,a;s=s.replace(a,b)
replace("['author.mjs','cage.json','BODY.json','PLAN.md']", "['author.mjs','cage.json','BODY.json','PLAN.md','CONSTRUCTION.md','INVENTORY-JOB.json','WORTH.md','SOURCE.md']")
replace("const vec=p=>new Vector3(...p),mod=(j,n)=>(j+n)%n;", """const vec=p=>new Vector3(...p),mod=(j,n)=>(j+n)%n;
const witness=(stage,operands)=>{job.witness={stage,...operands};};
function finalGate(stage){
  const pins=Object.fromEntries(Object.keys(job.inputs).map(p=>[p,hash(dir+p)]));
  witness(stage,{pins,expected:job.inputs,now:new Date().toISOString(),stop:'2026-10-04T11:10:00Z'});
  for(const p of Object.keys(pins))assert.equal(pins[p],job.inputs[p],`Input changed: ${p}`);
  assert.ok(new Date()<new Date('2026-10-04T11:10:00Z'),'Hard stop before emission/pass');
}""")
replace("  assert.ok(new Date()<new Date('2026-10-04T11:10:00Z'),'Hard stop');", """  witness('initial guards',{now:new Date().toISOString(),stop:'2026-10-04T11:10:00Z',outputs:['sweater.json','sweater.obj'].map(p=>({file:p,exists:fs.existsSync(dir+p)}))});
  assert.ok(['sweater.json','sweater.obj'].every(p=>!fs.existsSync(dir+p)),'Fresh outputs required');
  assert.ok(new Date()<new Date('2026-10-04T11:10:00Z'),'Hard stop');""")
replace("  assert.equal(body.sha256", "  witness('body/cage inputs',{body,cage:c});\n  assert.equal(body.sha256")
replace("const add=p=>{assert.ok(p.every(Number.isFinite));", "const add=p=>{witness('point',{ordinal:points.length,point:p});assert.ok(p.every(Number.isFinite));")
replace("    const next=new Map();", "    witness('boundary edges',{edges:[...edges]});\n    const next=new Map();")
replace("if(es.length===1){assert.ok(!next.has(es[0][0]));", "if(es.length===1){witness('boundary outgoing',{edge:es,next:[...next]});assert.ok(!next.has(es[0][0]));")
replace("      do{assert.ok(next.has(at)", "      do{witness('boundary walk',{first,at,loop,next:[...next]});assert.ok(next.has(at)")
replace("    const sign=Math.sign(center.x);assert.ok(sign!==0);", "    const sign=Math.sign(center.x);witness('port center',{port,points:port.map(i=>points[i]),center:center.toArray(),sign});assert.ok(sign!==0);")
replace("assert.ok(u.length()>.99);", "witness('sleeve frame',{tangent:d.toArray(),projectedUp:u.toArray()});assert.ok(u.length()>.99);")
replace("    assert.ok(deltas.every", "    witness('port correspondence',{port,points:port.map(i=>points[i]),center:center.toArray(),frame:{u:initial.u.toArray(),v:initial.v.toArray()},angles,deltas});\n    assert.ok(deltas.every")
replace("    assert.ok(area>c.gate.minimumTriangleAreaVector", "    witness('triangle',{face:f,triangle:tris.length,indices:tri,points:tri.map(i=>ps[i]),areaVector:normal.toArray(),area,expected:expected[f],dot,thresholds:c.gate});\n    assert.ok(area>c.gate.minimumTriangleAreaVector")
replace("for(const es of edges.values()){assert.ok", "for(const es of edges.values()){witness('edge incidence/winding',{edge:es});assert.ok")
replace("  assert.ok(connected(new Map(adj.map", "  witness('shell connectedness',{adjacency:adj.map(s=>[...s])});\n  assert.ok(connected(new Map(adj.map")
replace("    assert.ok(connected(graph),`Pinched vertex", "    witness('vertex link',{vertex:v,boundary:boundaryVertices.has(v),link:[...graph].map(([i,s])=>[i,[...s]])});\n    assert.ok(connected(graph),`Pinched vertex")
replace("  assert.equal(loops.length,c.gate.boundaryCount);", "  witness('named boundaries/Euler',{loops,namedMapped,vertices:ps.length,edges:edges.size,triangles:tris.length,euler:ps.length-edges.size+tris.length,expected:c.gate});\n  assert.equal(loops.length,c.gate.boundaryCount);")
replace("const ns=normals.map((v,i)=>{assert.ok", "const ns=normals.map((v,i)=>{witness('vertex normal',{vertex:i,normal:v.toArray(),length:v.length()});assert.ok")
replace("  fs.writeFileSync(dir+'sweater.json',mesh);fs.writeFileSync(dir+'sweater.obj',obj);", """  finalGate('before emission');
  witness('emission',{files:['sweater.json','sweater.obj'],intendedBytes:[Buffer.byteLength(mesh),Buffer.byteLength(obj)]});
  fs.writeFileSync(dir+'sweater.json',mesh);fs.writeFileSync(dir+'sweater.obj',obj);
  finalGate('before pass');""")
replace("  job.outputs=['sweater.json','sweater.obj'].map(p=>({file:p,bytes:fs.statSync(dir+p).size,sha256:hash(dir+p)}));", "  // Actual emitted-file inventory runs for both success and failure below.")
replace("job.finished=new Date().toISOString();fs.writeFileSync", """for(const p of ['sweater.json','sweater.obj'])if(fs.existsSync(dir+p)){
  try{job.outputs.push({file:p,bytes:fs.statSync(dir+p).size,sha256:hash(dir+p),qualification:job.status==='passed'?'source gates only; appearance pending':'unqualified partial output'});}
  catch(e){job.status='failed';process.exitCode=1;job.outputs.push({file:p,inventoryError:e.stack,qualification:'unqualified inventory failure'});}
}
if(job.status==='passed'&&new Date()>=new Date('2026-10-04T11:10:00Z')){job.status='failed';job.error='Final job inventory completed after hard stop';process.exitCode=1;}
if(job.status!=='passed')for(const o of job.outputs)o.qualification='unqualified retained output';
job.finished=new Date().toISOString();fs.writeFileSync""")
for name in ['cage.json','BODY.json','INVENTORY-JOB.json','review.html','review.mjs']:
 assert not (d/name).exists();(d/name).write_bytes((old/name).read_bytes());assert sha(d/name)==sha(old/name)
(d/'author.mjs').write_text(s)
doc=(old/'CONSTRUCTION.md').read_text().replace('Any failure writes AUTHOR-JOB.json with source bindings/error, zero candidate output, then stops without a rerun.', 'A geometric/source-gate refusal emits zero mesh files and records its actual stage/operands. Export/I/O failures may leave partial bytes; every actually present owned output is inventoried on both success and failure and retained unqualified on any failure. No delete/repair/rerun.')
doc+='\nFresh build contract additionally verifies output absence, all recorded input hashes and deadline immediately before emission/pass. Original unrun source stop is preserved; no cage coordinates/ports/frames/fixed triangle construction changed.\n'
(d/'CONSTRUCTION.md').write_text(doc)
diff=''.join(difflib.unified_diff(original.splitlines(True),s.splitlines(True),fromfile='preserved-unrun-author.mjs',tofile='instrumented-author.mjs'))
(d/'INSTRUMENTATION.diff').write_text(diff)
job={'pid':os.getpid(),'started':started,'finished':datetime.datetime.now(datetime.timezone.utc).isoformat(),'rootWorthFullRead':'b8f961','decision':'GO instrumentation only; full source admission still required','preservedOriginalAuthor':sha(old/'author.mjs'),'exactCopies':{n:sha(d/n) for n in ['cage.json','BODY.json','INVENTORY-JOB.json','review.html','review.mjs']},'newAuthor':sha(d/'author.mjs'),'diff':sha(d/'INSTRUMENTATION.diff'),'plan':sha(d/'PLAN.md'),'worth':sha(d/'WORTH.md')}
(d/'INSTRUMENTATION-JOB.json').write_text(json.dumps(job,indent=2)+'\n');print(json.dumps(job))
