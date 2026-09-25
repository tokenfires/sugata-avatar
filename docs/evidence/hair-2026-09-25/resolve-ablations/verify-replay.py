from pathlib import Path
import json,gzip,hashlib
p=Path('tmp/hair-sep25/resolve-ablations');read=lambda x:json.loads(x.read_text());sha=lambda x:hashlib.sha256(x).hexdigest()
base=read(p/'captures/report.json');again=read(p/'replay/report.json')
assert again['sourceSHA256']==base['sourceSHA256'] and len(again['results'])==3
def name(r):
 c=r['config'];return f"{c['diagnostic']}-taau-{c['name']}-p{c['phase']}"
by={name(r):r for r in base['results']}
for r in again['results']:
 b=by[name(r)]
 for key in ['actual','projected','bounds','maskPixels','frames','checkpoints','temporalMean','final']:assert r[key]==b[key],(name(r),key)
 assert read(p/'replay'/(name(r)+'.json'))['pixelMeans']==read(p/'captures'/(name(r)+'.json'))['pixelMeans']
 for c in r['checkpoints']:
  assert sha((p/'replay'/f'{name(r)}-n{c["count"]}.png').read_bytes())==c['imageSHA256']
(p/'replay-records.jsonl.gz').write_bytes(gzip.compress((''.join(json.dumps(r,separators=(',',':'))+'\n' for r in again['results'])).encode(),mtime=0))
print('PASS: no-clip half-pair phases 0/977 and opaque control reproduce all 512 native hashes, frame records, pixel means and nine plates exactly. The opaque-control failure reproduces.')
