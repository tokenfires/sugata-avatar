"""Independent root source/receipt/hash reconciliation only, no evaluator."""
from pathlib import Path
import hashlib,json,datetime,os,difflib
p=Path('docs/evidence/nonhair-2026-10-03/fixed-fan-volume')
start=datetime.datetime.now(datetime.timezone.utc).isoformat()
h=lambda q:hashlib.sha256(Path(q).read_bytes()).hexdigest()
r=json.loads((p/'PREPARE-RECEIPT.json').read_text());c=json.loads((p/'CRITIC-SOURCE-READBACK.json').read_text());fix=json.loads((p/'CPU-DISPOSAL-CORRECTION.json').read_text())
for n,s in r['inputPins'].items():assert h(n)==s,n
for n,s in r['outputHashes'].items():assert h(p/'preflight-history/build-before-disposal-ledger.mjs'if n==str(p/'build.mjs')else n)==s,n
old=Path('docs/evidence/nonhair-2026-10-03/whole-head-volume')
for name in ['build.mjs','preview.mjs','preview.html','world-gate-worker.mjs','observer.mjs']:
 a=Path('tools/critic/whole-head-volume.mjs')if name=='observer.mjs'else old/name
 b=Path('tools/critic/fixed-fan-volume.mjs')if name=='observer.mjs'else p/'preflight-history/build-before-disposal-ledger.mjs'if name=='build.mjs'else p/name
 # Historical diff labels retain the original prepared destination, not archive path.
 label=str(Path('tools/critic/fixed-fan-volume.mjs')if name=='observer.mjs'else p/name)
 assert ''.join(difflib.unified_diff(a.read_text().splitlines(True),b.read_text().splitlines(True),fromfile=str(a),tofile=label))==(p/(name+'.diff')).read_text(),name
before=(p/'preflight-history/build-before-disposal-ledger.mjs').read_text();after=(p/'build.mjs').read_text()
assert h(p/'preflight-history/build-before-disposal-ledger.mjs')==fix['beforeSHA256']
assert h(p/'build.mjs')==fix['afterSHA256']=='1fa10d60635565d025cfdb7a58efdd070d12be90bfb054479bc78cd05668677b'
changed=[(a,b)for a,b in zip(before.splitlines(),after.splitlines())if a!=b];assert len(before.splitlines())==len(after.splitlines())and len(changed)==2
assert 'geometryDisposalEvents' in changed[0][1]and 'geometryDisposed=!!geometry&&report.geometryDisposalEvents.length===1' in changed[1][1]
for prefix in ['const curve=','const sample=','function surface(']:assert next(l for l in after.splitlines()if l.startswith(prefix))==next(l for l in (old/'build.mjs').read_text().splitlines()if l.startswith(prefix))
assert 'I=new Uint32Array(topology.faces.flat())'in after and 'const record=topology.vertices[id],e=record.evaluation' in after
for n,s in c['pins'].items():assert h(n)==s,n
assert h(p/'preflight-history/critic-source-pre-event.md')==c['initialNoteSHA256']
assert h(p/'preflight-history/critic-source-readback-pre-event.json')==c['initialReceiptSHA256']
receipt={'pid':os.getpid(),'command':'python3 '+str(p/'root-source-readback.py'),'started':start,'finished':datetime.datetime.now(datetime.timezone.utc).isoformat(),'sourceSHA256':h(p/'root-source-readback.py'),'prepareInputsExact':len(r['inputPins']),'completeHistoricalDiffsExact':5,'eventOnlyChangedLines':2,'unchangedLiteralCurveSampleCoons':True,'finalCriticPinsExact':len(c['pins']),'criticSourceSHA256':h(p/'CRITIC-SOURCE.md'),'criticReadbackSHA256':h(p/'CRITIC-SOURCE-READBACK.json'),'status':'complete final source/critic handoff reconciled independently; no evaluator/geometry/native execution'}
(p/'ROOT-SOURCE-READBACK.json').write_text(json.dumps(receipt,indent=2)+'\n');print(json.dumps(receipt))
