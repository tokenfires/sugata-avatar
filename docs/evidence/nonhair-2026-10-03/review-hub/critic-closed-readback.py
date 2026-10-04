import datetime,hashlib,json,os,pathlib,platform,subprocess,sys
started=datetime.datetime.now(datetime.timezone.utc).isoformat()
root=pathlib.Path('/Users/robault/GitHub/sugata-avatar');packet=root/'docs/evidence/nonhair-2026-10-03/review-hub'
def pin(p):
 b=p.read_bytes();return {'file':str(p.relative_to(root)),'bytes':len(b),'sha256':hashlib.sha256(b).hexdigest()}
source=json.loads((packet/'SOURCE.json').read_text());worth=json.loads((packet.parent/'review-hub-value/CRITIC-VALUE-PINS.json').read_text())
accepted=[]
for name,sha in source['acceptedSources'].items():
 r=pin(root/name);assert r['sha256']==sha;accepted.append(r)
assert len(accepted)==380
worthpins=[]
for r in worth['pins']:
 current=pin(root/r['file']);assert current['sha256']==r['sha256'];worthpins.append(current)
assert len(worthpins)==19
for r in source['media']+source['links']:
 assert pin(root/r['file'])['sha256']==r['sha256']
candidate=root/'docs/evidence/nonhair-2026-10-03/review.candidate.html'
assert pin(candidate)['sha256']=='ece0c3aeab74e61bfb84556130d708a575cb8c7bc82c92758b13fcb63b7f147a'
target=root/'docs/evidence/nonhair-2026-10-03/review.html'
head=subprocess.run(['git','show','HEAD:docs/evidence/nonhair-2026-10-03/review.html'],cwd=root,check=True,capture_output=True).stdout
assert target.read_bytes()==head and len(head)==7633
blob=hashlib.sha1(b'blob '+str(len(head)).encode()+b'\0'+head).hexdigest()
assert blob=='a94d177e3f610ee513267f44cc4f7c11ff20292f'
absent=[packet/f for f in ['ADOPTION.json','REVIEWED.html.source','shortcut.before.js.source']]
assert all(not p.exists() for p in absent)
native=json.loads((packet/'native/NATIVE.json').read_text());images=[]
for c,s in zip(native['captures'],native['states']):
 r=pin(pathlib.Path(c['file']));assert r['bytes']==c['bytes'] and r['sha256']==c['sha256'];images.append(r)
 assert json.loads((packet/'native'/f"{s['name']}.json").read_text())==s
assert len(images)==4 and native['closed'] and native['viewportReset']
files=['PLAN.md','adopt.py','SOURCE.json','CRITIC-SOURCE.md','CRITIC-SOURCE-PINS.json','CRITIC-UI.md','CRITIC-UI-PINS.json','ROOT-UI-HANDOFF.json','CRITIC-CLOSED.md','critic-closed-readback.py']
pins=[pin(packet/f) for f in files]+[pin(packet/'native/NATIVE.json'),pin(candidate),pin(target),pin(root/'docs/evidence/nonhair-2026-10-03/current-review/ROOT-DECISION.md'),pin(root/'docs/evidence/nonhair-2026-10-03/current-review/CHECKPOINT.md')]
receipt={'scope':'FS/Git-readback only; no adopter/build/browser/SDK/guard execution','command':'python3 docs/evidence/nonhair-2026-10-03/review-hub/critic-closed-readback.py','gitReadCommand':['git','show','HEAD:docs/evidence/nonhair-2026-10-03/review.html'],'pid':os.getpid(),'interpreter':sys.executable,'pythonVersion':platform.python_version(),'started':started,'ended':datetime.datetime.now(datetime.timezone.utc).isoformat(),'status':'passed','accepted':accepted,'worthPins':worthpins,'pins':pins,'images':images,'existingTarget':pin(target),'headTargetSha256':hashlib.sha256(head).hexdigest(),'gitBlob':blob,'headEqualsCurrent':True,'absent':[str(p.relative_to(root)) for p in absent],'candidateQualifiedOnlyFor':'finite native presentation, not adoption or old chapter','sourceSha256':pin(pathlib.Path(__file__))['sha256'],'noteSha256':pin(packet/'CRITIC-CLOSED.md')['sha256']}
dest=packet/'CRITIC-CLOSED-PINS.json'
with dest.open('x') as f:json.dump(receipt,f,indent=2);f.write('\n')
print(json.dumps({'status':'passed','pid':receipt['pid'],'started':started,'ended':receipt['ended'],'accepted':len(accepted),'worthPins':len(worthpins),'existingTargetSha256':receipt['existingTarget']['sha256'],'headEqualsCurrent':True,'sourceSha256':receipt['sourceSha256'],'noteSha256':receipt['noteSha256'],'receiptSha256':pin(dest)['sha256']}))
