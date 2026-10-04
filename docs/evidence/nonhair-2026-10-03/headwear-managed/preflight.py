import datetime,hashlib,json,os,pathlib,re
root=pathlib.Path('/Users/robault/GitHub/sugata-avatar');folder=pathlib.Path(__file__).resolve().parent
started=datetime.datetime.now(datetime.timezone.utc).isoformat()
assert datetime.datetime.now(datetime.timezone.utc)<datetime.datetime.fromisoformat('2026-10-04T03:11:00+00:00')
previous=root/'docs/evidence/nonhair-2026-10-03/headwear-sdk'
source=json.loads((previous/'SOURCE.json').read_text());pins=[]
for pin in source['pins']:
 d=(root/pin['file']).read_bytes();assert hashlib.sha256(d).hexdigest()==pin['sha256'];assert len(d)==pin['bytes'];pins.append(pin)
assert (folder/'SDK-OPTIONS.json').read_bytes()==(previous/'SDK-OPTIONS.json').read_bytes()
critic=(folder/'CRITIC-SOURCE.md').read_text()
critic_pins=re.findall(r'^\| ([^|]+?) \| ([0-9a-f]{64}) \|$',critic,re.M);assert len(critic_pins)==9
for name,expected in critic_pins:
 p=(root/name) if name.startswith('packages/') else (folder/name)
 assert hashlib.sha256(p.read_bytes()).hexdigest()==expected,name
for name in ['PLAN.md','CRITIC-WORTH.md','CRITIC-SOURCE.md','preview.html','preview.mjs','SDK-OPTIONS.json','brixton-reference.jpg','PRIMARY-SEARCH.json','preflight.py']:
 d=(folder/name).read_bytes();pins.append(dict(file=str((folder/name).relative_to(root)),bytes=len(d),sha256=hashlib.sha256(d).hexdigest()))
out=dict(command='python3 docs/evidence/nonhair-2026-10-03/headwear-managed/preflight.py',pid=os.getpid(),started=started,ended=datetime.datetime.now(datetime.timezone.utc).isoformat(),pins=pins,criticPins=critic_pins,optionsEqualClosedLiteral=True,scope='FS preflight only; complete critic source note read by root separately before native open. No served bytes/runtime/appearance proof.')
with (folder/'PREFLIGHT.json').open('x') as h:json.dump(out,h,indent=2);h.write('\n')
print(json.dumps(dict(pid=out['pid'],started=started,ended=out['ended'],pins=len(pins))))
