from pathlib import Path
import json,hashlib,datetime,os,subprocess
r=Path('/Users/robault/GitHub/sugata-avatar');p=r/'docs/evidence/nonhair-2026-10-04/portrait-outfit-final';src=r/'packages/testbed/src'
s=datetime.datetime.now(datetime.timezone.utc).isoformat()
d=json.loads((p/'ROOT-FINAL.json').read_text());stop=json.loads((p/'STOP.json').read_text())
assert d['decision'].startswith('B complete') and d['knownClosedTab']==stop['tabId']=='15'
assert stop['knownClosed'] and stop['viewportReset']
b=(r/d['critic']['path']).read_bytes();assert len(b)==d['critic']['bytes'] and hashlib.sha256(b).hexdigest()==d['critic']['sha256']
assert not (p/'ADOPTED-SOURCE.json').exists()
pairs=[('portrait.html','original-portrait.html.source'),('portrait.js','original-portrait.js.source'),
       ('portrait-outfit-final-candidate.html','candidate-portrait.html.source'),('portrait-outfit-final-candidate.js','candidate-portrait.js.source'),
       ('portrait-outfit.mjs','portrait-outfit.mjs.source')]
for a,b in pairs:assert (src/a).read_bytes()==(p/b).read_bytes()
pins=[]
for a,b in pairs[2:]:
    relative='packages/testbed/src/'+a
    q=subprocess.run(['git','ls-files','--error-unmatch',relative],cwd=r,text=True,capture_output=True)
    assert q.returncode==1 and not q.stdout
    data=(src/a).read_bytes();pins.append({'path':relative,'bytes':len(data),'sha256':hashlib.sha256(data).hexdigest(),'retainedSnapshot':b})
for a,b in pairs[2:]:(src/a).unlink()
for a,b in pairs[:2]:assert (src/a).read_bytes()==(p/b).read_bytes()
out={'pid':os.getpid(),'started':s,'finished':datetime.datetime.now(datetime.timezone.utc).isoformat(),
     'command':'python3 docs/evidence/nonhair-2026-10-04/portrait-outfit-final/archive.py',
     'removedOnlyExactOwnedUntrackedClosedSources':pins,'acceptedOriginalsExact':True,'knownTabClosed':'15','privateLifetimeUnexposed':True,'adoptNeverExecuted':True}
(p/'ARCHIVE.json').write_text(json.dumps(out,indent=2)+'\n');print(json.dumps(out))
