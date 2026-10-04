import datetime,hashlib,json,os,pathlib
root=pathlib.Path('/Users/robault/GitHub/sugata-avatar');p=pathlib.Path(__file__).resolve().parent;started=datetime.datetime.now(datetime.timezone.utc).isoformat()
bindings={'CRITIC-RESULT.md':'090ae3b7606c4a2d3e2c22e6898d8d062fbf1c3457960678630515d9759a5820','critic-result-readback.py':'5487036eae4078e2028b649d657a8d8f5e9ce36577e27a8ebc56bff0dba4afe5','CRITIC-RESULT-READBACK.json':'0f69c1ea47e91de35b06a8674f2b98e18bd706be025b2c68e0eb1ba3a30636ac'}
for name,sha in bindings.items():assert hashlib.sha256((p/name).read_bytes()).hexdigest()==sha
checked=[]
for v in json.loads((p/'ROOT-RESULT.json').read_text())['pins']:
 d=(root/v['file']).read_bytes();assert len(d)==v['bytes'] and hashlib.sha256(d).hexdigest()==v['sha256'];checked.append(v)
c=json.loads((p/'CRITIC-RESULT-READBACK.json').read_text())
for name,v in c['pins'].items():
 d=(p/name).read_bytes();assert len(d)==v['bytes'] and hashlib.sha256(d).hexdigest()==v['sha256']
assert c['images']==c['states']==3 and c['highPortraitPresent'] is False and c['bodyCameraEquality'] is True
out=dict(command='python3 docs/evidence/nonhair-2026-10-03/ink-ao/root-close.py',pid=os.getpid(),started=started,ended=datetime.datetime.now(datetime.timezone.utc).isoformat(),bindings=bindings,rootRowsVerified=len(checked),criticRowsVerified=len(c['pins']),decision='B confirmed: root full critic/checker/metadata read, three whole images viewed, all handoff bytes independently reconciled. No SDK recommendation or native retry.')
with (p/'ROOT-CLOSE.json').open('x') as h:json.dump(out,h,indent=2);h.write('\n')
print(json.dumps(out))
