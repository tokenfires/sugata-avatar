import datetime, hashlib, json, os, pathlib, sys
root=pathlib.Path('/Users/robault/GitHub/sugata-avatar'); packet=root/'docs/evidence/nonhair-2026-10-03/ink-entry'
start=datetime.datetime.now(datetime.timezone.utc).isoformat(); sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
c=json.loads((packet/'CRITIC-CLOSED-PINS.json').read_text())
assert c['sourceSha256']==sha(packet/'critic-closed-readback.py')=='a2c68644717c8fd941ba9b00387c4b4a4633ef0235331fee1746a836d4802461'
assert len(c['accepted'])==380 and len(c['packetPins'])==15 and len(c['outputs'])==172 and len(c['html'])==19
for item in c['accepted']+c['packetPins']+c['outputs']+[c['isolatedRouteAtReadback']]:
    p=root/item['file']; assert p.stat().st_size==item['bytes'] and sha(p)==item['sha256'],item['file']
assert sha(packet/'CRITIC-CLOSED.md')=='3e4dc663e88a591952330b2af15a1ddf81116c12addc4a1c6804dac0264d75af'
assert all(not (root/p).exists() for p in c['absent'])
for item in c['html']:
    assert item['inkEntryMarker'] is False
    assert 'try-ink-denim' not in (root/'dist-ink-entry-candidate'/item['file']).read_text()
source=root/'dist-ink-entry-candidate'; archive=pathlib.Path('/Users/robault/.codex/artifacts/sugata-ink-entry-build-2026-10-03')
assert source.is_dir() and not source.is_symlink() and not archive.exists()
archive.parent.mkdir(parents=True,exist_ok=True); source.rename(archive)
for item in c['outputs']:
    relative=pathlib.Path(item['file']).relative_to('dist-ink-entry-candidate'); p=archive/relative
    assert p.stat().st_size==item['bytes'] and sha(p)==item['sha256']; p.chmod(0o444)
route=root/c['isolatedRouteAtReadback']['file']; assert route.read_bytes()==(packet/'showcase.candidate.html.source').read_bytes()
route.unlink()
for item in c['accepted']: assert sha(root/item['file'])==item['sha256'],item['file']
result={'scope':'Post-stop independent readback and guarded owned-output preservation/removal only; no build/browser/API replay','command':'python3 docs/evidence/nonhair-2026-10-03/ink-entry/close-owned.py','pid':os.getpid(),'interpreter':sys.executable,'started':start,'ended':datetime.datetime.now(datetime.timezone.utc).isoformat(),'sourceSha256':sha(pathlib.Path(__file__)),'criticReceiptSha256':sha(packet/'CRITIC-CLOSED-PINS.json'),'metadata':{k:v for k,v in c.items() if k not in ['accepted','packetPins','outputs','html','isolatedRouteAtReadback']},'acceptedPins':380,'packetPins':15,'outputCount':172,'outputBytes':141437131,'archive':str(archive),'archiveExact':True,'ownedRouteRemoved':str(route),'htmlCount':19,'candidateMarkerAbsentFromAllHtml':True,'currentProductAndGuideUnchanged':True}
(packet/'ROOT-HANDOFF.json').write_text(json.dumps(result,indent=2)+'\n');print(json.dumps(result,indent=2))
