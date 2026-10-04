import datetime,hashlib,json,os,pathlib,platform,struct,sys
root=pathlib.Path('/Users/robault/GitHub/sugata-avatar')
packet=root/'docs/evidence/nonhair-2026-10-03/review-hub'
started=datetime.datetime.now(datetime.timezone.utc)
assert started < datetime.datetime(2026,10,4,1,43,tzinfo=datetime.timezone.utc)
m=json.loads((packet/'CRITIC-SOURCE-PINS.json').read_text())
assert m['status']=='passed' and m['sections']==2 and not m['scripts'] and not m['inlineEvents']
assert m['noteSha256']=='c8433ed1ce4c7d3e100a7318373c1711b9953d5b01b75fb4d52a6135caa5efb8'
assert [len(m[k]) for k in ['accepted','worthPins','packetPins','links','media']]==[380,19,6,15,4]
baseline=json.loads((root/'docs/evidence/nonhair-2026-10-03/ink-denim-look/archive/capture/report.json').read_text())['sources']
assert {r['file']:r['sha256'] for r in m['accepted']}==baseline
seen={}
for key in ['accepted','worthPins','packetPins','links','media']:
    for r in m[key]:
        b=(root/r['file']).read_bytes()
        assert len(b)==r['bytes'] and hashlib.sha256(b).hexdigest()==r['sha256'],r['file']
        if 'dimensions' in r:
            assert b[:8]==b'\x89PNG\r\n\x1a\n' and list(struct.unpack('>II',b[16:24]))==r['dimensions']
        seen[r['file']]=r['sha256']
for r in m['copyEqualities']:
    assert r['equalBytes'] and (root/r['archive']).read_bytes()==(root/r['raw']).read_bytes()
end=datetime.datetime.now(datetime.timezone.utc)
assert end < datetime.datetime(2026,10,4,1,43,tzinfo=datetime.timezone.utc)
receipt={'command':'python3 docs/evidence/nonhair-2026-10-03/review-hub/root-preflight.py','pid':os.getpid(),'interpreter':sys.executable,'pythonVersion':platform.python_version(),'started':started.isoformat(),'ended':end.isoformat(),'status':'passed','pins':seen,'criticReceiptSha256':hashlib.sha256((packet/'CRITIC-SOURCE-PINS.json').read_bytes()).hexdigest(),'readerSha256':hashlib.sha256(pathlib.Path(__file__).read_bytes()).hexdigest(),'decision':'Proceed exact candidate to finite static Cua review; no adoption/new Avatar/appearance claim'}
with (packet/'ROOT-PREFLIGHT.json').open('x') as f: json.dump(receipt,f,indent=2);f.write('\n')
print(json.dumps({k:receipt[k] for k in ['pid','started','ended','status','readerSha256','criticReceiptSha256']}))
