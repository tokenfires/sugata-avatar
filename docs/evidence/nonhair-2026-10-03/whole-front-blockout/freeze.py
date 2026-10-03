"""Preserve exact completed packet; no geometry, browser or image operation."""
import pathlib, hashlib, json, os, datetime, stat
root=pathlib.Path.cwd(); packet=root/'docs/evidence/nonhair-2026-10-03/whole-front-blockout'; value=root/'docs/evidence/nonhair-2026-10-03/next-appearance-value'; raw=root/'captures/whole-front-blockout-2026-10-03-v1'
started=datetime.datetime.now(datetime.timezone.utc).isoformat()
def sha(p): return hashlib.sha256(p.read_bytes()).hexdigest()
report=json.loads((raw/'report.json').read_text()); pins=report['sources']|report['inputs']
for p,h in pins.items(): assert sha(root/p)==h,p
assert sha(root/'tools/critic/whole-front-blockout.mjs')==report['instrumentSHA256']
assert sha(packet/'CRITIQUE.md')=='f9a44c312c46a0954c9db14db9942e25127a78c194970bc33d02ce067cfcbe52'
copies=json.loads((packet/'NATIVE-COPY.json').read_text())['files']
for row in copies:
 assert sha(root/row['source'])==row['sha256']; assert sha(root/row['copy'])==row['sha256']; assert (root/row['copy']).stat().st_size==row['bytes']
automation=pathlib.Path('/Users/robault/.codex/automations/advance-sugata-avatar-visual-quality/automation.toml')
assert sha(automation)=='5469ab3fcbcd20719bc40c1703e36db43625ae639ecd75035bb30e6f101a7a9e'
paths=sorted(p for base in [packet,value] for p in base.rglob('*') if p.is_file() and p.name!='FREEZE.json')
files={str(p.relative_to(root)):{'sha256':sha(p),'bytes':p.stat().st_size} for p in paths}
for p in paths+list(raw.iterdir()): p.chmod(stat.S_IMODE(p.stat().st_mode)&~0o222)
out=packet/'FREEZE.json'; assert not out.exists()
receipt={'pid':os.getpid(),'started':started,'finished':datetime.datetime.now(datetime.timezone.utc).isoformat(),'command':'python3 docs/evidence/nonhair-2026-10-03/whole-front-blockout/freeze.py','status':'preserved; native and artistic proposal remain refused','files':files,'totalBytes':sum(v['bytes'] for v in files.values()),'externalPins':pins,'rawCopies':copies,'automationSHA256':sha(automation),'limits':['Post15:24 preservation only; no repair or investigation.','Native final success flag absent; separate completed root readback confirms retained pins.','No product/assets/default changes.']}
out.write_text(json.dumps(receipt,indent=2)+'\n'); out.chmod(0o444)
for p in paths:
 row=files[str(p.relative_to(root))];assert sha(p)==row['sha256'];assert not stat.S_IMODE(p.stat().st_mode)&0o222
print(json.dumps({'pid':receipt['pid'],'started':started,'finished':receipt['finished'],'files':len(files),'totalBytes':receipt['totalBytes'],'externalPins':len(pins),'rawCopies':len(copies),'manifestSHA256':sha(out)}))
