from pathlib import Path
import json, hashlib, datetime, os, subprocess
r=Path('/Users/robault/GitHub/sugata-avatar')
p=r/'docs/evidence/nonhair-2026-10-04/portrait-outfit-final'
src=r/'packages/testbed/src'
s=datetime.datetime.now(datetime.timezone.utc)
assert s < datetime.datetime(2026,10,4,8,52,tzinfo=datetime.timezone.utc), s
d=json.loads((p/'ROOT-CANDIDATE-DECISION.json').read_text())
assert d['decision'].startswith('A') and d['candidateTabClosed'] and d['viewportReset']
crit=(r/d['critic']['path']).read_bytes()
assert len(crit)==d['critic']['bytes'] and hashlib.sha256(crit).hexdigest()==d['critic']['sha256']
pairs=[('portrait.html','original-portrait.html.source'),('portrait.js','original-portrait.js.source'),
       ('portrait-outfit-final-candidate.html','candidate-portrait.html.source'),
       ('portrait-outfit-final-candidate.js','candidate-portrait.js.source'),('portrait-outfit.mjs','portrait-outfit.mjs.source')]
for a,b in pairs:assert (src/a).read_bytes()==(p/b).read_bytes()
for a,b in pairs[2:]:
    q=subprocess.run(['git','ls-files','--error-unmatch','packages/testbed/src/'+a],cwd=r,text=True,capture_output=True)
    assert q.returncode==1 and not q.stdout
html=(p/'candidate-portrait.html.source').read_text()
assert html.count('./portrait-outfit-final-candidate.js')==1
html=html.replace('./portrait-outfit-final-candidate.js','./portrait.js',1).encode()
js=(p/'candidate-portrait.js.source').read_bytes()
(p/'adopted-portrait.html.source').write_bytes(html)
(p/'adopted-portrait.js.source').write_bytes(js)
try:
    (src/'portrait.html').write_bytes(html)
    (src/'portrait.js').write_bytes(js)
    assert (src/'portrait.html').read_bytes()==html and (src/'portrait.js').read_bytes()==js
except Exception:
    (src/'portrait.html').write_bytes((p/'original-portrait.html.source').read_bytes())
    (src/'portrait.js').write_bytes((p/'original-portrait.js.source').read_bytes())
    raise
for a,b in pairs[2:4]:(src/a).unlink()
out={'pid':os.getpid(),'started':s.isoformat(),'finished':datetime.datetime.now(datetime.timezone.utc).isoformat(),
     'command':'python3 docs/evidence/nonhair-2026-10-04/portrait-outfit-final/adopt.py',
     'candidateTabClosed':d['tabId'],'removedOnlyClosedExactTemporaryRoutes':2,'helperRetained':True,
     'adopted':[{'path':'packages/testbed/src/'+a,'bytes':len((src/a).read_bytes()),
                 'sha256':hashlib.sha256((src/a).read_bytes()).hexdigest()}
                 for a in ['portrait.html','portrait.js','portrait-outfit.mjs']]}
(p/'ADOPTED-SOURCE.json').write_text(json.dumps(out,indent=2)+'\n')
print(json.dumps(out))
