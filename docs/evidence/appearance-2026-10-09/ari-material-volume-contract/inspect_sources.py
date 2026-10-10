import datetime as dt
import hashlib
import json
from pathlib import Path
import re
import signal
import time
import numpy as np

root=Path(__file__).resolve().parent
def stop(signum,frame): raise TimeoutError('30s inspection cap')
signal.signal(signal.SIGALRM,stop);signal.alarm(30)
start=time.monotonic()
assert dt.datetime.now(dt.timezone.utc)<dt.datetime.fromisoformat('2026-10-10T00:20:00+00:00')
inputs=json.loads((root/'INPUTS.json').read_text())['files']
for item in inputs:
    b=Path(item['path']).read_bytes()
    assert len(b)==item['bytes'] and hashlib.sha256(b).hexdigest()==item['sha256']
geometry=Path(inputs[2]['path']);fields=Path(inputs[3]['path'])
with np.load(geometry,allow_pickle=False) as archive:
    world=archive['Human_world'];tri=archive['Human_triangles']
with np.load(fields,allow_pickle=False) as archive:
    left=archive['l_arm_faces'];right=archive['r_arm_faces']
members=[('Human_world',world),('Human_triangles',tri),('l_arm_faces',left),('r_arm_faces',right)]
assert sum(a.nbytes for _,a in members)<=2*1024*1024
assert world.dtype==np.dtype('float32') and world.shape==(13380,3) and np.isfinite(world).all()
assert tri.dtype==np.dtype('int32') and tri.shape==(26756,3) and tri.min()>=0 and tri.max()<len(world)
assert hashlib.sha256(world.tobytes()).hexdigest()=='22022ad54de179f76350c0213e4c3ed017c76e3673ae77974976c58aee32c11c'
assert hashlib.sha256(tri.tobytes()).hexdigest()=='d0ff552960bba88368a96a0ac207ca15ec0b8b3c857c1d47db440cb0874cb8f4'
def ids(a):
    assert a.ndim==1
    if a.dtype==np.dtype('bool'):
        assert len(a)==len(tri);result=np.flatnonzero(a)
    else:
        assert a.dtype.kind in 'iu';result=a
    assert len(result)==4221 and len(set(map(int,result)))==4221 and result.min()>=0 and result.max()<len(tri)
    return set(map(int,result))
li,ri=ids(left),ids(right);assert not li&ri
source=json.loads(Path(inputs[4]['path']).read_text());wrists=json.loads(Path(inputs[5]['path']).read_text())
matches=[]
def walk(value,path):
    if isinstance(value,dict):
        if any(isinstance(x,str) and re.fullmatch(r'neck|spine[0-9_]*|pelvis',x,re.I) for x in value.values()):
            matches.append({'path':path,'record':value})
        for key,item in value.items():
            if re.fullmatch(r'neck|spine[0-9_]*|pelvis',key,re.I):matches.append({'path':path+'/'+key,'record':item})
            walk(item,path+'/'+key)
    elif isinstance(value,list):
        for index,item in enumerate(value):walk(item,path+'/'+str(index))
walk(source,'')
result={'utc':dt.datetime.now(dt.timezone.utc).isoformat(),'member_count':4,'decoded_bytes':sum(a.nbytes for _,a in members),
        'members':[{'name':name,'dtype':a.dtype.str,'shape':list(a.shape),'bytes':a.nbytes,'raw_sha256':hashlib.sha256(a.tobytes()).hexdigest()} for name,a in members],
        'body_bounds':np.stack([world.min(0),world.max(0)]).astype(float).tolist(),
        'regions':{'left_count':len(li),'right_count':len(ri),'disjoint':True,'definition':'Numeric source components, not anatomical or garment certification'},
        'source_map_keys':list(source),'wrist_reference_keys':list(wrists),'selected_joint_metadata':matches,
        'elapsed_seconds':time.monotonic()-start,'source_scope':'Four readonly members and existing metadata only; no distance/degree/contact/grid/constructor/native',
        'all_input_bytes_unchanged':True}
for item in inputs:
    b=Path(item['path']).read_bytes();assert len(b)==item['bytes'] and hashlib.sha256(b).hexdigest()==item['sha256']
assert result['elapsed_seconds']<30
with (root/'SOURCE-INSPECTION.json').open('x') as out:json.dump(result,out,indent=2);out.write('\n')
signal.alarm(0)
print(json.dumps(result))
