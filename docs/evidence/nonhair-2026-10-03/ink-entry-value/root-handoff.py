import datetime, hashlib, json, os, pathlib, sys
root=pathlib.Path('/Users/robault/GitHub/sugata-avatar'); packet=root/'docs/evidence/nonhair-2026-10-03/ink-entry-value'
started=datetime.datetime.now(datetime.timezone.utc).isoformat()
sha=lambda p: hashlib.sha256(p.read_bytes()).hexdigest()
record=json.loads((packet/'CRITIC-PINS.json').read_text())
assert record['readerSha256']==sha(packet/'critic-pins.py')=='6ed4d63959b89a3876cf7e27ee24569d0d27a6dcecb7535c1fadd0516ed4582f'
assert record['pid']==28132 and len(record['pins'])==15 and len(record['images'])==3
for pin in record['pins']:
    path=root/pin['path']; assert path.stat().st_size==pin['bytes'] and sha(path)==pin['sha256'], pin['path']
for image in record['images']:
    data=(root/image['path']).read_bytes()
    assert sha(root/image['path'])==image['sha256']
    if image['format']=='PNG':
        assert data[:8]==b'\x89PNG\r\n\x1a\n' and int.from_bytes(data[16:20],'big')==image['width']==900 and int.from_bytes(data[20:24],'big')==image['height']==868
    else:
        assert data[:2]==b'\xff\xd8' and image['width']==1280 and image['height']==1439
helper=json.loads((packet/'ROOT-OPTIONS.json').read_text())
assert record['rootHelper']['url']==helper['relativeUrl'] and record['rootHelper']['pid']==15212 and helper['exactRecipe'] is True
assert sha(packet/'CRITIC-VALUE.md')=='d6e4b1323fff7273eb64bbd6774b1ccc7efc44967afd62968e09f9ea19bdf179'
result=dict(scope='Independent filesystem/JSON/header readback only, no browser/Avatar/API replay',command='python3 docs/evidence/nonhair-2026-10-03/ink-entry-value/root-handoff.py',pid=os.getpid(),interpreter=sys.executable,started=started,ended=datetime.datetime.now(datetime.timezone.utc).isoformat(),sourceSha256=sha(pathlib.Path(__file__)),criticReceiptSha256=sha(packet/'CRITIC-PINS.json'),checkedPins=15,images=3,criticMetadata={k:v for k,v in record.items() if k not in ['pins','images']},decision='A worthwhile; separate literal implementation/source/native UI/export contract required')
(packet/'ROOT-HANDOFF.json').write_text(json.dumps(result,indent=2)+'\n'); print(json.dumps(result,indent=2))
