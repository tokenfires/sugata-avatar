"""Sole fixed artist target-to-source-vertex association; no surface/garment construction."""
import sys
sys.dont_write_bytecode=True
from pathlib import Path
import json,hashlib,datetime,os
import numpy as np
H=Path(__file__).resolve().parent
R={'started_utc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'pid':os.getpid(),'passed':False,'anchors':[],'artist_role':'PENDING actual point atlas','continuous_seam_path':'UNAUTHORED_REQUIRED','garment_geometry':False,'fit_clearance_motion':'UNKNOWN'}
class Refusal(Exception):pass
def require(ok,label,witness=None):
 if not ok:R['refusal']={'reason':label,'witness':witness};raise Refusal(label)
def sha(a):return hashlib.sha256(a.tobytes()).hexdigest()
def pins():
 for p in json.loads((H/'EXEC-QUERY.json').read_text())['pins']:
  b=Path(p['path']).read_bytes();require(len(b)==p['bytes'] and hashlib.sha256(b).hexdigest()==p['sha256'],'Exact physical input',p['path'])
try:
 require(not (H/'RESULT.json').exists(),'Exclusive first query output');pins();inputs=json.loads((H/'INPUTS.json').read_text());policy=json.loads((H/'POLICY.json').read_text())
 source=next(x['path'] for x in inputs if x['path'].endswith('/after-geometry.npz'));cold=json.loads(next(Path(x['path']).read_text() for x in inputs if x['path'].endswith('/COLD.json')))['geometry']['Human'];mapping=json.loads(next(Path(x['path']).read_text() for x in inputs if x['path'].endswith('/SOURCE-MAP.json')));bones={b['name']:b for b in mapping['rig_object']['rig']['bones']}
 require(mapping['facts']['body_rig_world_identity'],'Recorded source-map world frame identity')
 require(Path(source).stat().st_size<=1048576,'Encoded source archive cap')
 with np.load(source,allow_pickle=False) as z:world=z['Human_world'];triangles=z['Human_triangles']
 require(world.shape==(13380,3) and world.dtype==np.float32 and triangles.shape==(26756,3) and triangles.dtype==np.int32,'Exact two literal source domains');require(sha(world)==cold['world_sha256'] and sha(triangles)==cold['triangles_sha256'],'Exact source hashes');require(np.isfinite(world).all() and triangles.min()>=0 and triangles.max()<len(world),'Finite indexed full source')
 w=world.astype(np.float64);areas=np.linalg.norm(np.cross(w[triangles[:,1]]-w[triangles[:,0]],w[triangles[:,2]]-w[triangles[:,0]]),axis=1);bad=np.flatnonzero(~np.isfinite(areas)|(areas<=0));require(not len(bad),'Full source triangle eligibility',None if not len(bad) else int(bad[0]))
 R['source']={'world_sha256':sha(world),'triangles_sha256':sha(triangles),'vertices':len(world),'triangles':len(triangles),'minimum_twice_triangle_area':float(areas.min())};selected=set()
 for side,sign in [('l',1),('r',-1)]:
  for role in policy['roles_fixed_order']:
   target=np.array(policy['targets_positive_x'][role],dtype=np.float64);target[0]*=sign;require(target.shape==(3,) and np.isfinite(target).all(),'Finite literal artist target',role)
   squared=np.einsum('ij,ij->i',w-target,w-target);minimum=float(squared.min());ids=np.flatnonzero(squared<=minimum+policy['tie_squared_band']);record={'side':side,'role':role,'target':target.tolist(),'minimum_squared_distance':minimum,'target_gap':float(np.sqrt(minimum)),'tie_squared_band':policy['tie_squared_band'],'candidate_vertex_ids':ids.tolist(),'candidate_points':world[ids].tolist()};R['anchors'].append(record)
   require(len(ids)==1,'Artist target has ambiguous nearest source vertex',record);i=int(ids[0]);point=world[i];record.update(source_vertex=i,source_point=point.tolist());require(record['target_gap']<=policy['max_target_gap'],'Artist target gap exceeds fixed bound',record);require(float(point[0])*sign>0,'Source anchor wrong X side',record);require(bones['lowerarm_'+side]['head_local'][2]<float(point[2])<bones['neck_01']['head_local'][2],'Source anchor outside authored elbow/neck interval',record);require(i not in selected,'Duplicate artist source anchor',record);selected.add(i)
   incident=np.flatnonzero(np.any(triangles==i,axis=1));require(len(incident)>0,'Source anchor without triangle incidence',record);neighbors=sorted({int(v) for tri in triangles[incident] for v in tri if int(v)!=i});record['incident_triangles']=[{'triangle':int(tid),'vertex_ids':triangles[tid].tolist(),'points':world[triangles[tid]].tolist()} for tid in incident];record['neighbors']=[{'vertex':j,'point':world[j].tolist()} for j in neighbors];record['accepted_source_association']=True
 require(len(selected)==8,'Exactly8 original artist anchor associations');R['original_attachment_intent']=policy['planned_original_topology'];R['planned_control_order']=policy['planned_seam_control_order'];R['passed']=True
except Refusal as e:print('REFUSED',str(e))
except Exception as e:R['unexpected_error']={'type':type(e).__name__,'message':str(e)};print('ERROR',str(e))
finally:
 try:pins();R['post_pins_exact']=True
 except Exception as e:R['post_pin_error']=str(e);R['passed']=False
 R['finished_utc']=datetime.datetime.now(datetime.timezone.utc).isoformat();b=json.dumps(R,indent=2).encode()+b'\n';require(len(b)<=1048576,'Result cap1MiB')
 with (H/'RESULT.json').open('xb') as f:f.write(b)
 print(json.dumps({'passed':R['passed'],'anchors_reached':len(R['anchors']),'bytes':len(b),'refusal':R.get('refusal'),'unexpected_error':R.get('unexpected_error')}));sys.exit(0 if R['passed'] else 1)
