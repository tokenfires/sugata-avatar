from pathlib import Path
import json,gzip
root=Path('tmp/hair-sep25/resolve-stages');p=root/'pilot-fixed'
r=json.loads((p/'report.json').read_text());assert len(r['results'])==48
by={f"{x['config']['diagnostic']}-{x['config']['name']}-p{x['config']['phase']}":x for x in r['results']}
fields=('frameId','mean','min','max','spatialSD','temporalRMS','offsets','counters','oracleMismatches','resolve')
for x in r['results']:
 c=x['config'];key=f"{c['name']}-p{c['phase']}";control=by['identity-'+key]
 assert [[f[k] for k in fields] for f in x['frames']]==[[f[k] for k in fields] for f in control['frames']],c
 assert x['checkpoints'][0]['imageSHA256']==control['checkpoints'][0]['imageSHA256']
prior={f"{x['config']['name']}-p{x['config']['phase']}":x for x in map(json.loads,gzip.decompress(Path('docs/evidence/hair-2026-09-25/counter-coverage/case-records.jsonl.gz').read_bytes()).decode().splitlines()) if x['config']['temporal']=='taau'}
for key,x in by.items():
 if not key.startswith('identity-'):continue
 prev=prior[key.removeprefix('identity-')]
 for a,b in zip(x['frames'],prev['frames']):assert {k:a[k] for k in b}==b
 assert x['checkpoints']==prev['checkpoints'][:1]
print('PASS: all 48 pilots preserve 24-frame full native color hashes, measurements and checkpoint images; 8 identities reproduce preceding fixture.')
for case in ('shared-half-p0','counter-half-p0','counter-half-p977','counter-quarter-p0'):
 print(case,{k:sum(f['diagnostic']['values']['roi']['redMean'] for f in by[k+'-'+case]['frames'][-8:])/8 for k in ('current','mean','history','clipped','locked')},'output',sum(f['resolve']['values']['roi']['redMean'] for f in by['identity-'+case]['frames'][-8:])/8)
