import datetime,hashlib,json,os,pathlib
started=datetime.datetime.now(datetime.timezone.utc).isoformat();repo=pathlib.Path('/Users/robault/GitHub/sugata-avatar');folder=pathlib.Path(__file__).resolve().parent
sha=lambda d:hashlib.sha256(d).hexdigest()
critic=json.loads((folder/'CRITIC-SOURCE-PINS.json').read_text())
assert sha((folder/'CRITIC-SOURCE-PINS.json').read_bytes())=='ab0c4a23cc6995d324e4b4c2937d4180d07528b313498f253986c87cc22601b1'
for p in critic['pins']:
 d=(repo/p['file']).read_bytes();assert len(d)==p['bytes'] and sha(d)==p['sha256'],p['file']
source=json.loads((folder/'SOURCE.json').read_text());options=json.loads((folder/'SDK-OPTIONS.json').read_text());ink=json.loads((repo/'looks/ink-denim.json').read_text());ink['wardrobe']['outfit'].append('fedora01');assert ink==options==source['candidate']
assert not (folder/'capture').exists()
assert not (folder/'ROOT-SOURCE.json').exists()
out=dict(command='python3 docs/evidence/nonhair-2026-10-03/headwear-sdk/root-close.py',pid=os.getpid(),started=started,ended=datetime.datetime.now(datetime.timezone.utc).isoformat(),readerSha256=sha(pathlib.Path(__file__).read_bytes()),pins=critic['pins'],criticReceiptSha256=sha((folder/'CRITIC-SOURCE-PINS.json').read_bytes()),decision='Unrun deferral: valid SDK owner/appearance question, capture instrument source admission withheld',findings=['Actual report uses lastError; error assertion cannot pass. Routine guard correction was considered but not applied.','Promise.race leaves async body uncancelled/unjoined; late acquisition could resume after cleanup. Unexecuted architectural path, not observed leak or renderer failure.'],scope='Complete worth/source/checker/24pin metadata read and independent byte/options/no-runtime-output reconciliation. No native launch, code correction, runtime guard, Avatar, browser/GPU or asset parse.')
with (folder/'ROOT-CLOSED.json').open('x')as h:json.dump(out,h,indent=2);h.write('\n')
print(json.dumps({k:out[k]for k in ['pid','started','ended','readerSha256','decision']}))
