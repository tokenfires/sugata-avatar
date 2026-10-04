import datetime,hashlib,json,os,pathlib,re,struct
root=pathlib.Path('/Users/robault/GitHub/sugata-avatar');p=pathlib.Path(__file__).resolve().parent;started=datetime.datetime.now(datetime.timezone.utc).isoformat()
d=(p/'WORTH.md').read_bytes();assert hashlib.sha256(d).hexdigest()=='3879dc0e385c74134dc916f4f9ca0e5598a2cf08d82ea7ea334ed3545fbf9c5f'
rows=re.findall(r'^\| ([^|]+) \| ([a-f0-9]{64}) \|$',d.decode(),re.M);assert len(rows)==10
paths=['packages/testbed/src/showcase.html','packages/testbed/src/showcase-presets.mjs','packages/testbed/src/showcase-settings.mjs','packages/testbed/src/showcase.js','packages/testbed/src/showcase-palette-references.mjs','looks/README.md','looks/INK-DENIM.md','looks/ink-denim-review.html','docs/PRODUCT-ROADMAP.md','docs/evidence/nonhair-2026-10-03/ink-denim-look/archive/capture/neutral-body.png'];pins=[]
for file,(_,sha) in zip(paths,rows):
 b=(root/file).read_bytes();assert hashlib.sha256(b).hexdigest()==sha,file;pins.append(dict(file=file,bytes=len(b),sha256=sha))
image=(root/paths[-1]).read_bytes();assert struct.unpack('>II',image[16:24])==(900,868)
out=dict(command='python3 docs/evidence/nonhair-2026-10-03/outfit-suggestion-worth/root-close.py',pid=os.getpid(),started=started,ended=datetime.datetime.now(datetime.timezone.utc).isoformat(),pins=pins,criticSha256=hashlib.sha256(d).hexdigest(),decision='B: root full handoff/source-guides read and actual accepted original viewed; static card duplicates guided choice. No product/helper/runtime job or suitability claim.')
with (p/'ROOT-CLOSE.json').open('x') as h:json.dump(out,h,indent=2);h.write('\n')
print(json.dumps({k:out[k] for k in ['pid','started','ended','decision']}))
