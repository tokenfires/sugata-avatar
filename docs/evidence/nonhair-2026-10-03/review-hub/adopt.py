import datetime,hashlib,json,os,pathlib,platform,sys
root=pathlib.Path('/Users/robault/GitHub/sugata-avatar'); packet=root/'docs/evidence/nonhair-2026-10-03/review-hub'
started=datetime.datetime.now(datetime.timezone.utc)
assert started < datetime.datetime(2026,10,4,2,0,tzinfo=datetime.timezone.utc)
assert json.loads((packet/'ROOT-UI-HANDOFF.json').read_text())['decision']=='adopt exact candidate, then normal build and native hub navigation'
candidate=packet.parent/'review.candidate.html'; target=packet.parent/'review.html'
b=candidate.read_bytes(); assert hashlib.sha256(b).hexdigest()=='ece0c3aeab74e61bfb84556130d708a575cb8c7bc82c92758b13fcb63b7f147a'
shortcut=root/'packages/testbed/today-review.js'; old=shortcut.read_bytes()
assert hashlib.sha256(old).hexdigest()=='4794f9646867e5b359d05a976ac63230d53b35abc9cd264a5bb231c1e44c28cc'
new=old.replace(b'Latest work \xc2\xb7 October 2',b'Latest work \xc2\xb7 October 3').replace(b'../../docs/evidence/appearance-2026-10-02/review.html',b'../../docs/evidence/nonhair-2026-10-03/review.html')
assert old.count(b'Latest work \xc2\xb7 October 2')==1 and old.count(b'../../docs/evidence/appearance-2026-10-02/review.html')==1
assert new.replace(b'Latest work \xc2\xb7 October 3',b'Latest work \xc2\xb7 October 2').replace(b'../../docs/evidence/nonhair-2026-10-03/review.html',b'../../docs/evidence/appearance-2026-10-02/review.html')==old
source=json.loads((packet/'SOURCE.json').read_text())
for name,sha in source['acceptedSources'].items(): assert hashlib.sha256((root/name).read_bytes()).hexdigest()==sha,name
for r in source['media']+source['links']:
    assert hashlib.sha256((root/r['file']).read_bytes()).hexdigest()==r['sha256'],r['file']
assert not target.exists() and not (packet/'REVIEWED.html.source').exists() and not (packet/'shortcut.before.js.source').exists()
with (packet/'REVIEWED.html.source').open('xb') as f:f.write(b)
with (packet/'shortcut.before.js.source').open('xb') as f:f.write(old)
with target.open('xb') as f:f.write(b)
shortcut.write_bytes(new)
assert target.read_bytes()==b and shortcut.read_bytes()==new and candidate.read_bytes()==b
candidate.unlink()
receipt={'command':'python3 docs/evidence/nonhair-2026-10-03/review-hub/adopt.py','pid':os.getpid(),'interpreter':sys.executable,'pythonVersion':platform.python_version(),'started':started.isoformat(),'ended':datetime.datetime.now(datetime.timezone.utc).isoformat(),'status':'exact bytes adopted; standard build/native hub route pending','page':str(target.relative_to(root)),'pageSha256':hashlib.sha256(b).hexdigest(),'shortcutOldSha256':hashlib.sha256(old).hexdigest(),'shortcutNewSha256':hashlib.sha256(new).hexdigest(),'acceptedSourceCount':len(source['acceptedSources']),'candidateRouteRemoved':not candidate.exists(),'authorSha256':hashlib.sha256(pathlib.Path(__file__).read_bytes()).hexdigest()}
with (packet/'ADOPTION.json').open('x') as f:json.dump(receipt,f,indent=2);f.write('\n')
print(json.dumps(receipt))
