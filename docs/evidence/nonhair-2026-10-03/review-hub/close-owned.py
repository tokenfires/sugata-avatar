import datetime,hashlib,json,os,pathlib,platform,subprocess,sys
root=pathlib.Path('/Users/robault/GitHub/sugata-avatar');packet=root/'docs/evidence/nonhair-2026-10-03/review-hub'
started=datetime.datetime.now(datetime.timezone.utc).isoformat()
m=json.loads((packet/'CRITIC-CLOSED-PINS.json').read_text())
assert m['status']=='passed' and m['noteSha256']=='ab2310b4dac96f540d9db008f2f7e4535c980be2b37cbe6cb9a0563da325da19'
assert [len(m[k]) for k in ['accepted','worthPins','pins','images']]==[380,19,15,4]
seen={}
for key in ['accepted','worthPins','pins','images']:
    for row in m[key]:
        b=(root/row['file']).read_bytes();assert len(b)==row['bytes'] and hashlib.sha256(b).hexdigest()==row['sha256'],row['file'];seen[row['file']]=row['sha256']
assert all(not (root/p).exists() for p in m['absent'])
target=root/m['existingTarget']['file']
head=subprocess.run(['git','show','HEAD:'+m['existingTarget']['file']],cwd=root,check=True,capture_output=True).stdout
assert target.read_bytes()==head and hashlib.sha256(head).hexdigest()==m['headTargetSha256']
assert hashlib.sha1(b'blob '+str(len(head)).encode()+b'\0'+head).hexdigest()==m['gitBlob']
native=json.loads((packet/'native/NATIVE.json').read_text())
assert native['closed'] and native['viewportReset'] and native['logs']==[]
for state in native['states']:assert json.loads((packet/'native'/f"{state['name']}.json").read_text())==state
candidate=packet.parent/'review.candidate.html';b=candidate.read_bytes()
assert hashlib.sha256(b).hexdigest()=='ece0c3aeab74e61bfb84556130d708a575cb8c7bc82c92758b13fcb63b7f147a'
untracked=subprocess.run(['git','ls-files','--error-unmatch',str(candidate.relative_to(root))],cwd=root,capture_output=True)
assert untracked.returncode==1 and not (packet/'candidate.html.source').exists()
with (packet/'candidate.html.source').open('xb') as f:f.write(b)
assert (packet/'candidate.html.source').read_bytes()==b and candidate.read_bytes()==b
candidate.unlink();(packet/'candidate.html.source').chmod(0o444)
receipt={'command':'python3 docs/evidence/nonhair-2026-10-03/review-hub/close-owned.py','pid':os.getpid(),'interpreter':sys.executable,'pythonVersion':platform.python_version(),'started':started,'ended':datetime.datetime.now(datetime.timezone.utc).isoformat(),'status':'passed','pins':seen,'criticReceiptSha256':hashlib.sha256((packet/'CRITIC-CLOSED-PINS.json').read_bytes()).hexdigest(),'readerSha256':hashlib.sha256(pathlib.Path(__file__).read_bytes()).hexdigest(),'candidateArchive':'docs/evidence/nonhair-2026-10-03/review-hub/candidate.html.source','archiveEqualOriginal':True,'candidateRouteRemoved':not candidate.exists(),'existingTargetEqualsHEAD':target.read_bytes()==head,'decision':'preserve finite native evidence; no adoption/build/presentation replay','qualification':'Old target stays unpromoted; accepted Ink gallery remains current authority; all380+19 inputs unchanged'}
with (packet/'ROOT-CLOSED.json').open('x') as f:json.dump(receipt,f,indent=2);f.write('\n')
print(json.dumps({k:receipt[k] for k in ['pid','started','ended','status','readerSha256','criticReceiptSha256','candidateRouteRemoved','existingTargetEqualsHEAD']}))
