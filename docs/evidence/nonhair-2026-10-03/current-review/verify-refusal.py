import json, hashlib, pathlib, struct, os, sys, datetime
root=pathlib.Path('/Users/robault/GitHub/sugata-avatar')
start=datetime.datetime.now(datetime.timezone.utc).isoformat()
folder=root/'docs/evidence/nonhair-2026-10-03/current-review'
raw=root/'captures/october3-review-2026-10-03-v1'
def sha(p): return hashlib.sha256(p.read_bytes()).hexdigest()
r=json.loads((raw/'report.json').read_text())
assert sha(raw/'report.json')=='20e2e393aee864766fe347b6ec5773fde6f5db337e7b35bc56eaec3dffaaaf5d'
assert r['status']=='failed' and len(r['views'])==0 and len(r['linkedResponses'])==0
assert len(r['errors'])==1 and 'ENOENT' in r['errors'][0] and not r['warnings']
assert r['cleanup']=={'page':'closed','browser':'closed'}
assert 'finalPinsUnchanged' not in r and 'postCleanupDeadlinePassed' not in r
assert r['borrowedReviewServerRetained'] is True
pins={}
for p,h in r['preservationPins'].items():
 assert sha(root/p)==h,p
 pins[p]=h
for p,h in r['imageInputHashes'].items():
 assert sha(root/p)==h,p
 pins[p]=h
for p,h in r['sourceHashes'].items():
 assert sha(raw/'sources'/p)==h,p
 if p!='packages/testbed/today-review.js': assert sha(root/p)==h,p
 pins[p]=h
rest=json.loads((folder/'RESTORE-RECEIPT.json').read_text())
assert sha(root/rest['restored'])==rest['restoredSHA256']==sha(folder/'before-today-review.js')
assert sha(root/rest['candidateCopy'])==rest['candidateSHA256']==r['sourceHashes'][rest['restored']]
pngs=[]
for p in raw.glob('*.png'):
 b=p.read_bytes();assert b[:8]==b'\x89PNG\r\n\x1a\n';w,h=struct.unpack('>II',b[16:24]);pngs.append({'file':p.name,'sha256':sha(p),'dimensions':[w,h]})
assert len(pngs)==1 and pngs[0]['file']=='desktop-hub.png' and pngs[0]['dimensions']==[1440,1000]
image=next(iter(r['imageInputHashes']))
actual_path='/@fs/'+str(root/image).lstrip('/')
wrong=actual_path[5:]
correct=actual_path[4:]
assert wrong in r['errors'][0] and not pathlib.Path(wrong).is_absolute()
assert correct==str(root/image) and pathlib.Path(correct).is_file()
receipt={'command':'python3 docs/evidence/nonhair-2026-10-03/current-review/verify-refusal.py','interpreter':sys.executable,'version':sys.version,'pid':os.getpid(),'started':start,'finished':datetime.datetime.now(datetime.timezone.utc).isoformat(),'status':'passed-narrow-refusal-audit','verifierSHA256':sha(pathlib.Path(__file__)),'reportSHA256':sha(raw/'report.json'),'sourceSnapshotCount':len(r['sourceHashes']),'preservationPinCount':len(r['preservationPins']),'imageInputCount':len(r['imageInputHashes']),'uniqueRuntimePinCount':len(pins),'currentRuntimeSourcesMatching':6,'intentionalCurrentSourceRestoration':rest,'pngInventory':pngs,'actualFailurePath':wrong,'absolutePathRequired':correct,'completedViews':0,'reviewPNGs':0,'errors':1,'warnings':0,'cleanup':r['cleanup'],'noFinalAcceptanceGatesRecorded':True,'limits':['No browser, network, Avatar, native recapture or runtime renderer work performed.','Byte audit and source control flow do not qualify new destination layout or media delivery.','Hub PNG is unindexed in report; its existence is inventoried independently.']}
(folder/'independent.json').write_text(json.dumps(receipt,indent=2)+'\n')
print(json.dumps({'status':receipt['status'],'pid':os.getpid(),'pins':len(pins),'hub':pngs[0],'receiptSHA256':sha(folder/'independent.json')}))
