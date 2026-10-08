"""One pinned SVD + Three mathematical reconstruction; no rig or serializer."""
from pathlib import Path
import datetime
import hashlib
import json
import subprocess
import numpy as np
HERE=Path(__file__).resolve().parent
plan=json.loads((HERE/'FACTOR-PLAN.json').read_text())
assert not (HERE/'FACTOR-RESULT.json').exists() and not (HERE/'FACTOR-INPUT.json').exists()
for p in plan['pins']:
    f=Path(p['path']);b=f.read_bytes();assert len(b)==p['bytes'] and hashlib.sha256(b).hexdigest()==p['sha256']
src=json.loads(Path(plan['input']['path']).read_text());assert src['complete'] and len(src['records'])==53
C=np.asarray(src['input']['C']);rw=np.asarray(src['input']['rig_world']);rig_global=C@rw@np.linalg.inv(C)
raw={r['bone']:C@rw@np.asarray(r['input_rest']) for r in src['records']};records=[]
for r in src['records']:
    parent=raw[r['parent']] if r['parent'] else rig_global
    local=np.linalg.inv(parent)@raw[r['bone']];u,s,v=np.linalg.svd(local[:3,:3])
    assert np.isfinite(local).all() and (s>1e-12).all()
    du=1 if np.linalg.det(u)>0 else -1;dv=1 if np.linalg.det(v)>0 else -1
    u[:,2]*=du;v[2,:]*=dv;s[2]*=du*dv
    assert abs(np.linalg.det(u)-1)<1e-12 and abs(np.linalg.det(v)-1)<1e-12
    U=np.eye(4);U[:3,:3]=u;V=np.eye(4);V[:3,:3]=v
    inverse=np.linalg.inv(raw[r['bone']])
    records.append({'bone':r['bone'],'parent':r['parent'],'raw_local':local.tolist(),'legacy_local':(C@np.asarray(r['local'])@np.linalg.inv(C)).tolist(),
        'raw_global':raw[r['bone']].tolist(),'raw_inverse':inverse.tolist(),'float32_inverse':inverse.astype(np.float32).astype(float).tolist(),
        'U4':U.tolist(),'Vt4':V.tolist(),'scale':s.tolist(),'translation':local[:3,3].tolist(),'signs':[du,dv]})
data={'input':plan['input'],'rig_global':rig_global.tolist(),'records':records}
with (HERE/'FACTOR-INPUT.json').open('x') as f:json.dump(data,f,indent=2,allow_nan=False);f.write('\n')
started=datetime.datetime.now(datetime.timezone.utc).isoformat()
p=subprocess.run([plan['node']['path'],str(HERE/'factor_math.mjs')],input=json.dumps(data,allow_nan=False),text=True,capture_output=True,timeout=30)
with (HERE/'factor.log').open('x') as f:f.write(p.stderr)
assert p.returncode==0,p.stderr
result=json.loads(p.stdout);result['execution']={'started_utc':started,'finished_utc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'exit_code':p.returncode,'node':plan['node'],'numpy':np.__version__}
with (HERE/'FACTOR-RESULT.json').open('x') as f:json.dump(result,f,indent=2,allow_nan=False);f.write('\n')
print(json.dumps({'nominated':result['nominated'],'summary':result['summary']},indent=2))
