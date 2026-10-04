from pathlib import Path
import json, hashlib, datetime, os, subprocess
r=Path('/Users/robault/GitHub/sugata-avatar')
p=r/'docs/evidence/nonhair-2026-10-04/portrait-outfit-recovery'
s=datetime.datetime.now(datetime.timezone.utc).isoformat()
final=json.loads((p/'ROOT-FINAL.json').read_text())
assert final['decision'].startswith('B source refusal') and final['nativeOpened'] is False
critic=(r/final['critic']['path']).read_bytes()
assert len(critic)==final['critic']['bytes'] and hashlib.sha256(critic).hexdigest()==final['critic']['sha256']
pairs=[('portrait.html','original-portrait.html.source'),('portrait.js','original-portrait.js.source'),
       ('portrait-outfit-recovery-candidate.html','candidate-portrait.html.source'),
       ('portrait-outfit-recovery-candidate.js','candidate-portrait.js.source'),
       ('portrait-outfit.mjs','portrait-outfit.mjs.source')]
for a,b in pairs: assert (r/'packages/testbed/src'/a).read_bytes()==(p/b).read_bytes()
pins=[]
for a,b in pairs[2:]:
    relative='packages/testbed/src/'+a
    q=subprocess.run(['git','ls-files','--error-unmatch',relative],cwd=r,text=True,capture_output=True)
    assert q.returncode==1 and not q.stdout
    data=(r/relative).read_bytes()
    pins.append({'path':relative,'bytes':len(data),'sha256':hashlib.sha256(data).hexdigest(),'snapshot':b})
for a,b in pairs[2:]: (r/'packages/testbed/src'/a).unlink()
for a,b in pairs[:2]: assert (r/'packages/testbed/src'/a).read_bytes()==(p/b).read_bytes()
out={'pid':os.getpid(),'started':s,'finished':datetime.datetime.now(datetime.timezone.utc).isoformat(),
     'command':'python3 docs/evidence/nonhair-2026-10-04/portrait-outfit-recovery/archive-candidate.py',
     'removedOnlyExactOwnedUntracked':pins,'noNativeOpened':True,'acceptedOriginalsExact':True}
(p/'ARCHIVE.json').write_text(json.dumps(out,indent=2)+'\n')
print(json.dumps(out))
