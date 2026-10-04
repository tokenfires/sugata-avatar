import datetime, hashlib, json, os
from pathlib import Path
p=Path(__file__).resolve().parent;repo=p.parents[3]
started=datetime.datetime.now(datetime.timezone.utc).isoformat()
assert not (p/'FROZEN.json').exists(), 'Packet already frozen'
pins=[]
for file in sorted(p.iterdir()):
 assert file.is_file(), 'Unexpected non-file payload'
 b=file.read_bytes();pins.append({'file':file.name,'bytes':len(b),'sha256':hashlib.sha256(b).hexdigest()})
result={'command':'python3 '+Path(__file__).resolve().relative_to(repo).as_posix(),'pid':os.getpid(),'started':started,'ended':datetime.datetime.now(datetime.timezone.utc).isoformat(),'pins':pins,'scope':'Exact closed evidence packet and mode preservation only. No accepted/frozen/original/reference/unrelated payload mutation.'}
with (p/'FROZEN.json').open('x') as f:json.dump(result,f,indent=2);f.write('\n')
for file in p.iterdir():file.chmod(0o444)
print(json.dumps({'command':result['command'],'pid':result['pid'],'started':started,'ended':result['ended'],'files':len(pins),'bytes':sum(row['bytes'] for row in pins),'manifestSha256':hashlib.sha256((p/'FROZEN.json').read_bytes()).hexdigest()}))
