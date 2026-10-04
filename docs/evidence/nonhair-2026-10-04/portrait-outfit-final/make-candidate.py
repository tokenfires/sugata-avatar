from pathlib import Path
import datetime, difflib, hashlib, json, os
r=Path('/Users/robault/GitHub/sugata-avatar')
old=r/'docs/evidence/nonhair-2026-10-04/portrait-outfit-recovery'
p=r/'docs/evidence/nonhair-2026-10-04/portrait-outfit-final'
src=r/'packages/testbed/src'
s=datetime.datetime.now(datetime.timezone.utc).isoformat()
manifest=json.loads((old/'FROZEN-MANIFEST.json').read_text())
for e in manifest['files']:
    b=(old/e['file']).read_bytes();assert len(b)==e['bytes'] and hashlib.sha256(b).hexdigest()==e['sha256']
for a in ['portrait.html','portrait.js']:
    assert (src/a).read_bytes()==(old/('original-'+a+'.source')).read_bytes()
for a in ['portrait-outfit-final-candidate.html','portrait-outfit-final-candidate.js','portrait-outfit.mjs']:
    assert not (src/a).exists(),a
helper=(old/'portrait-outfit.mjs.source').read_text()
before="throw new Error('Choose No outfit or Ink outfit.');"
after="throw new Error('The requested outfit is not recognized.');"
assert helper.count(before)==1;helper=helper.replace(before,after,1)
html=(old/'candidate-portrait.html.source').read_text()
assert html.count('./portrait-outfit-recovery-candidate.js')==1
html=html.replace('./portrait-outfit-recovery-candidate.js','./portrait-outfit-final-candidate.js',1)
js=(old/'candidate-portrait.js.source').read_text()
assert len(js.encode())==12890 and hashlib.sha256(js.encode()).hexdigest()=='6185813893b9cf0e12f64f3ca61b750bcf8d07af898ac713b3673ee97754b22f'
payloads={'original-portrait.html.source':(src/'portrait.html').read_text(),
          'original-portrait.js.source':(src/'portrait.js').read_text(),
          'candidate-portrait.html.source':html,'candidate-portrait.js.source':js,
          'portrait-outfit.mjs.source':helper,'outfit-check.mjs':(old/'outfit-check.mjs').read_text()}
for name,data in payloads.items():
    assert not (p/name).exists();(p/name).write_text(data)
for name,data in [('portrait-outfit-final-candidate.html',html),('portrait-outfit-final-candidate.js',js),('portrait-outfit.mjs',helper)]:
    (src/name).write_text(data)
diffs={}
for kind in ['html','js','helper']:
    name='portrait-outfit.mjs.source' if kind=='helper' else 'candidate-portrait.'+kind+'.source'
    current=helper if kind=='helper' else html if kind=='html' else js
    diffs[kind+'FromRecovery']=''.join(difflib.unified_diff((old/name).read_text().splitlines(True),current.splitlines(True),fromfile='recovery/'+kind,tofile='final/'+kind))
    if kind!='helper':
        diffs[kind+'FromAccepted']=''.join(difflib.unified_diff((src/('portrait.'+kind)).read_text().splitlines(True),current.splitlines(True),fromfile='accepted/'+kind,tofile='final/'+kind))
(p/'DIFFS.json').write_text(json.dumps(diffs,indent=2)+'\n')
pins=[]
for name in payloads:
    b=(p/name).read_bytes();pins.append({'path':str((p/name).relative_to(r)),'bytes':len(b),'sha256':hashlib.sha256(b).hexdigest()})
result={'pid':os.getpid(),'started':s,'finished':datetime.datetime.now(datetime.timezone.utc).isoformat(),
        'command':'python3 docs/evidence/nonhair-2026-10-04/portrait-outfit-final/make-candidate.py',
        'priorFrozenPayloadsVerified':len(manifest['files']),'acceptedOriginalsExact':True,'snapshots':pins,
        'delta':'One exact generic helper terminal message plus HTML module entry; JS exact unchanged.'}
(p/'CANDIDATE-SOURCE.json').write_text(json.dumps(result,indent=2)+'\n')
print(json.dumps(result))
