import datetime,hashlib,json,os,pathlib,struct
folder=pathlib.Path(__file__).resolve().parent;root=folder.parents[3];started=datetime.datetime.now(datetime.timezone.utc).isoformat()
pre=json.loads((folder/'PREFLIGHT.json').read_text())
for p in pre['pins']:
 d=(root/p['file']).read_bytes();assert len(d)==p['bytes'];assert hashlib.sha256(d).hexdigest()==p['sha256']
before=json.loads((folder/'capture/before-retirement.json').read_text());after=json.loads((folder/'capture/retirement.json').read_text())
assert before['options']==after['options']==json.loads((folder/'SDK-OPTIONS.json').read_text())
assert before['states']==after['states'] and len(after['states'])==1
s=after['states'][0];assert s['name']=='front-body' and s['complete'] and s['clockSeconds']==0
assert s['report']['quality']['backend']=='webgpu' and s['report']['hair']['colour']['appliedTint'] is None
assert sorted(s['report']['wardrobe']['state']['worn'])==sorted(['foundation_bra','foundation_briefs','female_casualsuit01','shoes01','fedora01'])
assert after['failure'] is None
r=after['retirement'];assert r['reason']=='manual' and r['ownerReturned'] and not r['pendingAtRetirement'] and r['error'] is None
assert r['disposal']==dict(disposed=True,leaked=[])
png=(folder/'capture/front-body-offered.png').read_bytes();assert png[:8]==b'\x89PNG\r\n\x1a\n' and struct.unpack('>II',png[16:24])==(1800,2100)
assert hashlib.sha256(png).hexdigest()=='a3074e6e3220489b07ca4cc8ce24311835e941f50500d156aa7529f07a9599b2'
logs=json.loads((folder/'capture/console.json').read_text());assert len(logs)==3 and all(x['level']=='warn' for x in logs)
critic=(folder/'CRITIC-RESULT.md').read_bytes();assert hashlib.sha256(critic).hexdigest()=='6fb3edf230e7781528753f0a8d9755846e2acfae29a6e968958b0562936a6550'
pins=[]
for p in sorted(folder.rglob('*')):
 if p.is_file():
  d=p.read_bytes();pins.append(dict(file=str(p.relative_to(folder)),bytes=len(d),sha256=hashlib.sha256(d).hexdigest()))
out=dict(command='python3 docs/evidence/nonhair-2026-10-03/headwear-managed/root-result.py',pid=os.getpid(),started=started,ended=datetime.datetime.now(datetime.timezone.utc).isoformat(),inputsUnchanged=True,pins=pins,states=1,originals=1,pixelDimensions=[1800,2100],retirement=r,decision='B: incomplete four-view study; first offered image insufficient as recognizable Fedora composition. Download event timeout cause and visible appearance mechanism unproved.',limits='Root actually viewed whole retained original and fully read critic handoff separately. Hash/state/header reconciliation is independent support, not full appearance/served-byte/allocator qualification.')
with (folder/'ROOT-RESULT.json').open('x') as h:json.dump(out,h,indent=2);h.write('\n')
print(json.dumps(dict(pid=out['pid'],started=started,ended=out['ended'],pins=len(pins),states=1,originals=1)))
