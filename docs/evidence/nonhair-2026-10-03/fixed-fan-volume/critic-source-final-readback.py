from pathlib import Path
import hashlib,json,datetime,os,sys
p=Path('docs/evidence/nonhair-2026-10-03/fixed-fan-volume')
sha=lambda b:hashlib.sha256(b).hexdigest()
started=datetime.datetime.now(datetime.timezone.utc).isoformat()
history=p/'preflight-history'
for name,out in [('CRITIC-SOURCE.md','critic-source-pre-event.md'),('CRITIC-SOURCE-READBACK.json','critic-source-readback-pre-event.json')]:
 with (history/out).open('xb') as f:f.write((p/name).read_bytes())
initial=json.loads((p/'CRITIC-SOURCE-READBACK.json').read_text())
before=(history/'build-before-disposal-ledger.mjs').read_bytes()
assert sha(before)=='2086694c01405cfae70d901c6cc1dff820851ef0b9c3b4af78b04736049deaf5'
expected=before.decode().replace('geometry=new BufferGeometry();geometry.setAttribute',"geometry=new BufferGeometry();report.geometryUUID=geometry.uuid;report.geometryDisposalEvents=[];geometry.addEventListener('dispose',()=>report.geometryDisposalEvents.push({uuid:geometry.uuid,observed:new Date().toISOString()}));geometry.setAttribute").replace('report.geometryDisposed=!!geometry;',"report.geometryCreated=!!geometry;report.geometryDisposed=!!geometry&&report.geometryDisposalEvents.length===1&&report.geometryDisposalEvents[0].uuid===geometry.uuid;")
assert (p/'build.mjs').read_text()==expected
assert sha((p/'build.mjs').read_bytes())=='1fa10d60635565d025cfdb7a58efdd070d12be90bfb054479bc78cd05668677b'
for name,digest in initial['pins'].items():
 if name!=str(p/'build.mjs'):assert sha(Path(name).read_bytes())==digest,name
correction=json.loads((p/'CPU-DISPOSAL-CORRECTION.json').read_text())
assert correction['beforeSHA256']==sha(before)
assert correction['afterSHA256']==sha((p/'build.mjs').read_bytes())
observed=datetime.datetime.now(datetime.timezone.utc).isoformat()
note=(history/'critic-source-pre-event.md').read_text().replace('`2086694c01405cfae70d901c6cc1dff820851ef0b9c3b4af78b04736049deaf5`','`1fa10d60635565d025cfdb7a58efdd070d12be90bfb054479bc78cd05668677b`')
note+='\n## Final event-ledger readback\n\n'
note+='Final current-source GO recorded '+observed+'. Read the revised entire build.mjs. Only the two declared disposal-ledger replacements differ from the byte-preserved initial build. Final build SHA256 is `1fa10d60635565d025cfdb7a58efdd070d12be90bfb054479bc78cd05668677b`; every other admitted source hash remains exact. The earlier prepare outputs and saved diffs describe the historical prepared version, not this later correction. Initial critic note/readback remain byte-preserved in preflight-history/critic-source-pre-event.md and critic-source-readback-pre-event.json.\n\n'
note+='Actual witness: revised build line 61 watches its own BufferGeometry dispose event with exact UUID/time; line 73 retains geometryCreated and sets geometryDisposed only from one matching event. This resolves the ownership/invocation ambiguity before execution. Alternative A (selected) adds this inexpensive actual event receipt without changing formulas, arrays, topology or geometric gates. Alternative B would retain the invocation flag with an explicit weaker limit, avoiding the source change. An event is resource evidence, not GPU release or fault-injection qualification; forced termination still cannot attest inner disposal. Final CPU/native admission and first-failure/hard-stop rules are unchanged.\n\n'
note+='Final static command: `python3 docs/evidence/nonhair-2026-10-03/fixed-fan-volume/critic-source-final-readback.py`; exact source was saved before execution. The final readback records this command, PID, start/end, interpreter/version, source SHA256 and all current pins. No root checker, source author, evaluator, geometry or native operation was executed.\n'
(p/'CRITIC-SOURCE.md').write_text(note)
names=list(initial['pins'])+[str(p/'record-cpu-disposal.py'),str(p/'CPU-DISPOSAL-CORRECTION.json'),str(p/'critic-source-final-readback.py'),str(p/'CRITIC-SOURCE.md')]
r={'pid':os.getpid(),'command':'python3 '+str(p/'critic-source-final-readback.py'),'started':started,'finished':datetime.datetime.now(datetime.timezone.utc).isoformat(),'interpreter':sys.executable,'pythonVersion':sys.version,'scope':'Static source/hash readback and preservation only; no evaluator/geometry/project imports/browser/GPU','exactTwoEventOnlyReplacements':True,'allOtherInitialPinsUnchanged':True,'historicalPrepareOutputsAndDiffsPreserved':True,'sourceSHA256':sha(Path(__file__).read_bytes()),'pins':{n:sha(Path(n).read_bytes()) for n in names},'initialNoteSHA256':sha((history/'critic-source-pre-event.md').read_bytes()),'initialReceiptSHA256':sha((history/'critic-source-readback-pre-event.json').read_bytes())}
with (p/'CRITIC-SOURCE-READBACK.json').open('w') as f:json.dump(r,f,indent=2);f.write('\n')
print(json.dumps({'pid':r['pid'],'started':r['started'],'finished':r['finished'],'sourceSHA256':r['sourceSHA256'],'noteSHA256':sha((p/'CRITIC-SOURCE.md').read_bytes()),'receiptSHA256':sha((p/'CRITIC-SOURCE-READBACK.json').read_bytes()),'status':'final exact-source GO; static only'},indent=2))
