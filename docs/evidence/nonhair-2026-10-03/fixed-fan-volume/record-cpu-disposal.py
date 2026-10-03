"""Source preflight correction only; preserves first source and no evaluation."""
from pathlib import Path
import hashlib,json,datetime,os
p=Path('docs/evidence/nonhair-2026-10-03/fixed-fan-volume');s=p/'build.mjs'
sha=lambda b:hashlib.sha256(b).hexdigest()
old=s.read_bytes();assert sha(old)=='2086694c01405cfae70d901c6cc1dff820851ef0b9c3b4af78b04736049deaf5'
h=p/'preflight-history';h.mkdir();(h/'build-before-disposal-ledger.mjs').write_bytes(old)
t=old.decode();a='geometry=new BufferGeometry();geometry.setAttribute'
b="geometry=new BufferGeometry();report.geometryUUID=geometry.uuid;report.geometryDisposalEvents=[];geometry.addEventListener('dispose',()=>report.geometryDisposalEvents.push({uuid:geometry.uuid,observed:new Date().toISOString()}));geometry.setAttribute"
assert a in t;t=t.replace(a,b)
a='report.geometryDisposed=!!geometry;'
b="report.geometryCreated=!!geometry;report.geometryDisposed=!!geometry&&report.geometryDisposalEvents.length===1&&report.geometryDisposalEvents[0].uuid===geometry.uuid;"
assert a in t;t=t.replace(a,b);s.write_text(t)
r={'pid':os.getpid(),'command':'python3 '+str(p/'record-cpu-disposal.py'),'recorded':datetime.datetime.now(datetime.timezone.utc).isoformat(),'beforeSHA256':sha(old),'afterSHA256':sha(s.read_bytes()),'witness':'CPU finally geometryDisposed was !!geometry after dispose; it recorded ownership/invocation rather than event','selected':'A retain geometry UUID and actual dispose event; B would retain invocation flag with explicit limit, weaker evidence but less source change','limits':'No evaluator/geometry/native execution or formula/array/topology/gate/artist change; final source review still required'}
(p/'CPU-DISPOSAL-CORRECTION.json').write_text(json.dumps(r,indent=2)+'\n');print(json.dumps(r))
