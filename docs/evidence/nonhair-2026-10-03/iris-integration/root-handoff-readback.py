from pathlib import Path
import json,hashlib,struct,datetime,os,collections
p=Path('docs/evidence/nonhair-2026-10-03/iris-integration');raw=Path('captures/iris-integration-2026-10-03-v1');start=datetime.datetime.now(datetime.timezone.utc).isoformat()
h=lambda q:hashlib.sha256(Path(q).read_bytes()).hexdigest()
r=json.loads((raw/'report.json').read_text());c=json.loads((p/'critic-native-readback.json').read_text());restore=json.loads((p/'RESTORATION.json').read_text());pins={}
assert h(p/'CRITIC-POSTFLIGHT.md')=='d41d2dc3886e15ad2a9747bb641e1d02f12fb7121376febf6aea2f4f04837ca4'
assert h(p/'critic-native-readback.py')==c['readerSHA256'];assert h(raw/'report.json')==c['reportSHA256'];assert h(raw/'instrument.mjs')==c['instrumentSHA256']
for item in c['sourcePins']:
 q=item['witness'];q=restore['candidateSourceRenames'].get(q,{}).get('path',q);assert h(q)==item['sha256']==r['sources'][item['path']];pins[q]=h(q)
for q,v in r['inputs'].items():assert h(q)==v;pins[q]=v
for q,v in restore['restored'].items():assert h(q)==v;pins[q]=v
for q in restore['removedOnlyOwnedCandidateFiles']:assert not Path(q).exists()
for q,v in json.loads((p/'CANDIDATE-SNAPSHOT.json').read_text())['outputs'].items():assert h(q)==v;pins[q]=v
res=0
for s in r['states']:
 for f in s['frames'].values():
  a,b=f['eyeToWorld'],f['worldToEye']
  for col in range(3):
   for row in range(3):res=max(res,abs(sum(a[3*k+row]*b[3*col+k] for k in range(3))-(col==row)))
assert res==c['maxInverseResidual']==2.220446049250313e-16
for a,b in zip(c['images'],r['images']):
 q=raw/a['file'];assert h(q)==a['sha256']==b['sha256'];assert struct.unpack('>II',q.read_bytes()[16:24])==(a['width'],a['height']);pins[str(q)]=h(q)
ids=[uuid for x in r['retirements'] for uuid in x['resources'].values()];assert len(ids)==len(set(ids))==c['uniqueResourceEvents']==18
assert c['warnings']==dict(collections.Counter(r['warnings']));assert c['failedResources']==r['failedResources'];assert c['sequence']==r['sequence'];assert c['cleanup']==r['cleanup']=={'page':'closed','browser':'closed'};assert len(r['states'])==26;assert c['inputPins']==11;assert len(c['sourcePins'])==382
assert r['status']=='failed' and len(r['errors'])==2 and len(r['failedResources'])==31 and 'finalPinsUnchanged' not in r
out=dict(pid=os.getpid(),started=start,finished=datetime.datetime.now(datetime.timezone.utc).isoformat(),command='python3 '+str(p/'root-handoff-readback.py'),sourceSHA256=h(__file__),criticSHA256=h(p/'CRITIC-POSTFLIGHT.md'),criticReceiptSHA256=h(p/'critic-native-readback.json'),pins=pins,maxInverseResidual=res,status='complete critic handoff independently reconciled after exact production rollback; REFUSE adoption',scope='bytes, PNG headers and recorded matrix arithmetic only; no native/test/shader/evaluator rerun')
(p/'ROOT-HANDOFF.json').write_text(json.dumps(out,indent=2)+'\n');print(json.dumps({k:out[k] for k in ['pid','started','finished','status','maxInverseResidual']}));print('pins',len(pins),'receipt',h(p/'ROOT-HANDOFF.json'))
