import datetime,hashlib,json,os,pathlib,re
folder=pathlib.Path(__file__).resolve().parent;repo=pathlib.Path('/Users/robault/GitHub/sugata-avatar');started=datetime.datetime.now(datetime.timezone.utc).isoformat()
note=(folder/'CRITIC-WORTH.md').read_bytes();assert hashlib.sha256(note).hexdigest()=='5d6b0e02d2a1ab61fb8f244dfdcea8e0a5ce5517aac102c5c15ca9b565b23de9'
hashes=re.findall(r'`([a-f0-9]{64})`',note.decode());pins=[]
for file in ['packages/testbed/src/wardrobe.js','packages/testbed/src/wardrobe.html','packages/testbed/src/showcase-settings.mjs','packages/testbed/src/showcase-presets.mjs','assets/wardrobe/manifest.json']:
 data=(repo/file).read_bytes();digest=hashlib.sha256(data).hexdigest();assert digest in hashes,file;pins.append(dict(file=file,bytes=len(data),sha256=digest))
assert len(hashes)==len(pins)
out=dict(command='python3 docs/evidence/nonhair-2026-10-03/headwear-worth/root-close.py',pid=os.getpid(),started=started,ended=datetime.datetime.now(datetime.timezone.utc).isoformat(),readerSha256=hashlib.sha256(pathlib.Path(__file__).read_bytes()).hexdigest(),pins=pins,decision='B for current diagnostic/Showcase route; no hat appearance defect inferred',scope='Full critic note and5 source hashes independently reconciled; existing setup/strict settings independently read; no asset parse/runtime')
with (folder/'ROOT-CLOSED.json').open('x') as h:json.dump(out,h,indent=2);h.write('\n')
print(json.dumps({k:out[k] for k in ['pid','started','ended','readerSha256','decision']}))
