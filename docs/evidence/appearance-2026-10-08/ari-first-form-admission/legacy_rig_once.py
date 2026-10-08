from pathlib import Path
import json,hashlib,datetime,os,math
HERE=Path(__file__).resolve().parent
KIT=HERE.parent.parent/'appearance-2026-10-07/ari-neutral-native-source'
q=KIT/'work/mpfb/data/rigs/standard/rig.game_engine.json';b=q.read_bytes()
assert hashlib.sha256(b).hexdigest()=='b324ddb4b707721c19630bfadb87c3e3b38eed3b6e4590bb3cead43ea918f799'
r={'started_utc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'pid':os.getpid(),'file':str(q.resolve()),'file_sha256':hashlib.sha256(b).hexdigest(),'passed':False,'schema':'legacyflat','native_jobs':0}
try:
 d=json.loads(b);assert 'bones' not in d and len(d)==53
 cold=json.loads((KIT/'COLD-RESULT.json').read_text())['scene'];body=next(o for o in cold['objects'] if o['name']=='Human');groups=set(body['mesh']['vertex_group_names'])
 counts={'CUBE':0,'MEAN':0};roots=[]
 for name,info in d.items():
  assert isinstance(info,dict) and math.isfinite(info['roll']) and info.get('roll_strategy') is None
  parent=info.get('parent');assert not parent or parent in d
  if not parent:roots.append(name)
  seen={name};current=parent
  while current:
   assert current not in seen;seen.add(current);current=d[current].get('parent')
  for which in ['head','tail']:
   e=info[which];s=e['strategy'];assert s in counts,(name,which,s);counts[s]+=1
   assert len(e['default_position'])==3 and all(math.isfinite(v) for v in e['default_position'])
   if s=='CUBE':assert e['cube_name'] in groups,(name,which,e['cube_name'])
   else:assert e['vertex_indices'] and all(isinstance(i,int) and 0<=i<19158 for i in e['vertex_indices'])
   if 'offset' in e:assert len(e['offset'])==3 and all(math.isfinite(v) for v in e['offset'])
 assert roots==['Root'],roots
 r.update(passed=True,document=d,strategies=counts,root_names=roots,missing_group_names=[],roll_policy='53literal finite rolls, no roll_strategy; native legacy upgrade separate',cube_nonempty_membership='Actual native prevalidation required; stored groupnames only')
except Exception as e:r['exception']=repr(e)
r['finished_utc']=datetime.datetime.now(datetime.timezone.utc).isoformat()
(HERE/'RIG-RESULT.json').write_text(json.dumps(r,indent=2)+'\n')
print(json.dumps({k:v for k,v in r.items() if k not in ['document']}))
