from pathlib import Path
import hashlib,json,datetime,os,copy
root=Path('/Users/robault/GitHub/sugata-avatar');p=root/'docs/evidence/nonhair-2026-10-03/iris-pigment';raw=root/'captures/iris-pigment-2026-10-03-v1'
started=datetime.datetime.now(datetime.timezone.utc).isoformat();h=lambda f:hashlib.sha256(f.read_bytes()).hexdigest();r=json.loads((raw/'report.json').read_text())
for path,digest in {**r['sources'],**r['inputs'],'tools/critic/iris-pigment.mjs':r['instrumentSHA256']}.items():assert h(root/path)==digest,path
assert h(p/'CRITIC-APPEARANCE.md')=='f31723adef9c970d6917b38c84d51aa8ba24d57a103ed7d946945d05cf5a8a66'
assert h(p/'critic-readback.py')=='fec675db3b513ea2eedcdea9ad5c100fe8a45341a1ad15c9e2715cac2cc977cb'
assert h(p/'CRITIC-READBACK.json')=='c0d34fe9c2360861b6b83f039c84abd0a7367ddca0c6827d1bc47b5af8dab3fb'
def normalize(s):
 n=copy.deepcopy(s)
 for k in ['arm','view','camera']:n.pop(k)
 n['eyes'].pop('activeGlobe')
 for row in n['bindings']:
  if row['mesh']==n['eyes']['globeMesh']:row['materials']=['declared-globe']
 return n
assert normalize(r['retirement']['restored'])==normalize(r['images'][0]['before'])
a=json.loads((p/'ARCHIVE-RECEIPT.json').read_text())
for x in a['copies']:assert h(root/x['source'])==h(root/x['archive'])==x['sha256']
files=[x for x in sorted(p.rglob('*')) if x.is_file() and x.name!='PRESERVATION.json']
files +=[x for x in sorted(raw.iterdir()) if x.is_file()]
rows=[{'path':str(x.relative_to(root)),'bytes':x.stat().st_size,'sha256':h(x)}for x in files]
for x in files:x.chmod(x.stat().st_mode&~0o222)
result={'pid':os.getpid(),'command':'python3 docs/evidence/nonhair-2026-10-03/iris-pigment/freeze.py','started':started,'finished':datetime.datetime.now(datetime.timezone.utc).isoformat(),'files':rows,'bytes':sum(x['bytes']for x in rows),'externalPins':{**r['sources'],**r['inputs'],'tools/critic/iris-pigment.mjs':r['instrumentSHA256']},'rawArchiveCopies':a['copies'],'restoreCompleteNormalizedStateEqual':True,'criticHandoffIndependentlyReadAndPinned':True,'readonly':'own packet/raw only; original refs/accepted source/unrelated worktrees unchanged','status':'preserved exact bytes; no render/appearance retest'}
f=p/'PRESERVATION.json';f.write_text(json.dumps(result,indent=2)+'\n');f.chmod(0o444)
print(json.dumps({'pid':result['pid'],'started':started,'finished':result['finished'],'files':len(rows),'bytes':result['bytes'],'externalPins':len(result['externalPins']),'copies':len(a['copies']),'manifestSHA256':h(f)}))
