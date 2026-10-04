from pathlib import Path
from datetime import datetime,timezone
import hashlib,json,os
root=Path('/Users/robault/GitHub/sugata-avatar');p=root/'docs/evidence/nonhair-2026-10-03/skin-finish-sdk';start=datetime.now(timezone.utc).isoformat();h=lambda f:hashlib.sha256(f.read_bytes()).hexdigest()
c=json.loads((p/'CRITIC-RESULT-PINS.json').read_text());assert c['passed'] and c['exitCode']==0 and c['reportsRead']==8
assert h(p/'critic-result-reader.py')==c['sourceSHA256']=='a12a1eaa9dc09fcddd71e6f1bac5049323a2571cc70a107b1b73ddfa7baef970'
assert h(p/'CRITIC-RESULT.md')=='e52a37685563cd484ef1309037033fde4d750d861b4049ecf00e20bbdd2243f1'
for row in c['pins']:
 f=Path(row['path']);assert h(f)==row['sha256'] and f.stat().st_size==row['bytes']
s=json.loads((p/'NATIVE-STATE.json').read_text());v=json.loads((p/'CRITIC-STATE-READBACK.json').read_text());reports=[]
for x in s['creations']:reports.append(('creation-'+x['finish'],x['report']))
for x in s['states']:
 for when in ['before','after']:reports.append((x['name']+'-'+when,x[when]))
for when in ['before','after']:reports.append(('rebuild-'+when,s['rebuild'][when]))
assert v['firstCompleteReport']==reports[0][1]
def leaves(x,prefix=''):
 if isinstance(x,dict):
  if not x:return {prefix:x}
  out={}
  for k,a in x.items():out.update(leaves(a,prefix+'/'+str(k)))
  return out
 if isinstance(x,list):
  if not x:return {prefix:x}
  out={}
  for i,a in enumerate(x):out.update(leaves(a,prefix+'/'+str(i)))
  return out
 return {prefix:x}
base=leaves(reports[0][1]);assert len(v['allEightReportDifferences'])==8
for (label,r),row in zip(reports,v['allEightReportDifferences']):
 flat=leaves(r);diff={k:{'base':base.get(k),'actual':flat.get(k)} for k in set(base)|set(flat) if base.get(k)!=flat.get(k)}
 assert row['label']==label and row['leafCount']==len(flat) and row['differencesFromFirstCreation']==diff
 assert row['sha256Canonical']==hashlib.sha256(json.dumps(r,sort_keys=True,separators=(',',':')).encode()).hexdigest()
assert not s.get('retirementFailure') and not s['pending']
assert s['states'][0]['camera']==s['states'][1]['camera']
assert s['states'][0]['before']==s['states'][0]['after'] and s['states'][1]['before']==s['states'][1]['after']
r={'command':'python3 '+str(Path(__file__).relative_to(root)),'pid':os.getpid(),'startUTC':start,'endUTC':datetime.now(timezone.utc).isoformat(),'exitCode':0,'passed':True,'criticSHA256':h(p/'CRITIC-RESULT.md'),'criticReaderSHA256':h(p/'critic-result-reader.py'),'criticMetadataSHA256':h(p/'CRITIC-RESULT-PINS.json'),'stateReadbackSHA256':h(p/'CRITIC-STATE-READBACK.json'),'currentPinsVerified':len(c['pins']),'allEightActualReportsReconciled':True,'decision':'B/defer SDK adoption and isolate owned candidate; no repair/replay','limits':'Actual context JPEG only; incomplete returned PNGs are not appearance witnesses. Source count-two explanation is not event call-stack/allocator proof. Current pins are before restoration.','sourceSHA256':h(Path(__file__))}
with (p/'ROOT-HANDOFF.json').open('x') as f:json.dump(r,f,indent=2);f.write('\n')
print(json.dumps(r));print('receiptSHA256',h(p/'ROOT-HANDOFF.json'))
