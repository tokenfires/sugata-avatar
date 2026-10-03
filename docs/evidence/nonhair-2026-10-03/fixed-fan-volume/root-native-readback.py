"""Saved failed native packet/retirement/input audit; no capture/evaluation."""
from pathlib import Path
import json,hashlib,os,datetime
p=Path('docs/evidence/nonhair-2026-10-03/fixed-fan-volume');out=Path('captures/fixed-fan-volume-2026-10-03-v1');start=datetime.datetime.now(datetime.timezone.utc).isoformat()
sha=lambda q:hashlib.sha256(Path(q).read_bytes()).hexdigest()
r=json.loads((out/'report.json').read_text());assert r['status']=='failed'and r['images']==[]and not r['failedResources']and len(r['errors'])==2
assert 'fixed-fan-volume.mjs:27:100' in r['errors'][0]and r['errors'][0].startswith('AssertionError')
assert 'fixed-fan-volume.mjs:50:613'in r['errors'][1]
assert sorted(x.name for x in out.iterdir())==['instrument.mjs','report.json']
assert r['cleanup']=={'worldWorker':'not-created','page':'closed','browser':'closed'}
for n,h in (r['sources']|r['inputs']).items():assert sha(n)==h,n
assert sha(out/'instrument.mjs')==sha('tools/critic/fixed-fan-volume.mjs')==r['instrumentSHA256']
d=r['retirement'];assert d['restored']=={'originalVisible':True,'expected':True,'proposalVisible':False}and not d['errors']and d['disposal']['disposed']and not d['disposal']['leaked']
assert sorted(e['name']for e in d['ownedDisposals'])==['geometry','material']
for e in d['ownedDisposals']:assert e['uuid']==d[e['name']]
wardrobe=Path('packages/core/src/wardrobe/Wardrobe.js');s=wardrobe.read_text()
assert 'this.fullIndex = index.array.slice();'in s and 'const target = index.array;'in s and 'rebuildIndex( geometry, this.fullIndex, hidden );'in s and 'geometry.setDrawRange( 0, written );'in s
receipt={'pid':os.getpid(),'command':'python3 '+str(p/'root-native-readback.py'),'started':start,'finished':datetime.datetime.now(datetime.timezone.utc).isoformat(),'sourceSHA256':sha(p/'root-native-readback.py'),'reportSHA256':sha(out/'report.json'),'instrumentSHA256':sha(out/'instrument.mjs'),'sourcePinsExact':len(r['sources']),'inputPinsExact':len(r['inputs']),'images':0,'firstFailure':'observer27:100 assumes runtime body.geometry.index.array equals pinned raw source body indices','secondaryError':'final error-list guard re-reports the existing first assertion; no separate rendering failure proved','fullWorldArraysOrFrameStatesSaved':False,'worldWorkerCreated':False,'proposalAdmitted':False,'retirementExact':True,'originalRestored':True,'geometryAndMaterialUUIDEventsExact':True,'AvatarDisposedNoReportedLeaks':True,'pageBrowserClosed':True,'WardrobeSourceSHA256':sha(wardrobe),'status':'native validation assumption refused; trial closed; no image/volume/world-contact verdict','limits':['Wardrobe fullIndex preservation/in-place hide-mask rewrite explains why raw/runtime index identity cannot be presumed; actual full mask/index/state arrays were not saved, so complete cause/count attribution is unqualified.','No world gate, pose/bind numeric qualification or actual appearance images; CPU gates remain narrowly retained.','No native/geometry/observer repair or rerun.']}
(p/'ROOT-NATIVE-READBACK.json').write_text(json.dumps(receipt,indent=2)+'\n');print(json.dumps(receipt))
