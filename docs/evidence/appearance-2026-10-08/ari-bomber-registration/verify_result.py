"""Root stored verification with independent sum/ordering and complete incidence."""
from pathlib import Path
import json,hashlib,datetime
import numpy as np
H=Path(__file__).resolve().parent
r=json.loads((H/'RESULT.json').read_text());policy=json.loads((H/'POLICY.json').read_text());inputs=json.loads((H/'INPUTS.json').read_text())
for pin in json.loads((H/'EXEC-QUERY.json').read_text())['pins']:
 b=Path(pin['path']).read_bytes();assert len(b)==pin['bytes'] and hashlib.sha256(b).hexdigest()==pin['sha256']
with np.load(next(p['path'] for p in inputs if p['path'].endswith('/after-geometry.npz')),allow_pickle=False) as z:raw=z['Human_world'];t=z['Human_triangles']
assert raw.dtype==np.float32 and raw.shape==(13380,3) and t.dtype==np.int32 and t.shape==(26756,3) and np.isfinite(raw).all() and t.min()>=0 and t.max()<len(raw)
sha=lambda a:hashlib.sha256(a.tobytes()).hexdigest()
assert sha(raw)==r['source']['world_sha256'] and sha(t)==r['source']['triangles_sha256'];w=raw.astype(float)
a=w[t[:,1]]-w[t[:,0]];b=w[t[:,2]]-w[t[:,0]];gram=np.sum(a*a,axis=1)*np.sum(b*b,axis=1)-np.sum(a*b,axis=1)**2;assert np.isfinite(gram).all() and (gram>0).all()
mapping=json.loads(next(Path(x['path']).read_text() for x in inputs if x['path'].endswith('/SOURCE-MAP.json')));bones={b['name']:b for b in mapping['rig_object']['rig']['bones']}
checks=[];used=set()
for k,row in enumerate(r['anchors']):
 side='l' if k<4 else 'r';sign=1 if k<4 else -1;role=policy['roles_fixed_order'][k%4];assert row['side']==side and row['role']==role
 target=np.array(policy['targets_positive_x'][role]);target[0]*=sign;assert np.array_equal(target,row['target']);squared=np.sum((w-target)**2,axis=1);order=np.argsort(squared,kind='stable');minimum=float(squared[order[0]]);ids=np.flatnonzero(squared<=minimum+policy['tie_squared_band'])
 assert ids.tolist()==row['candidate_vertex_ids'] and np.array_equal(raw[ids],row['candidate_points']) and abs(minimum-row['minimum_squared_distance'])<=1e-14 and abs(np.sqrt(minimum)-row['target_gap'])<=1e-14
 if row.get('accepted_source_association'):
  assert len(ids)==1;i=int(ids[0]);assert i==row['source_vertex'] and np.array_equal(raw[i],row['source_point']) and row['target_gap']<=.06 and raw[i,0]*sign>0 and bones['lowerarm_'+side]['head_local'][2]<raw[i,2]<bones['neck_01']['head_local'][2] and i not in used;used.add(i)
  expected=[j for j,tri in enumerate(t) if i in tri];assert expected==[tri['triangle'] for tri in row['incident_triangles']]
  for record in row['incident_triangles']:
   j=record['triangle'];assert np.array_equal(t[j],record['vertex_ids']) and np.array_equal(raw[t[j]],record['points'])
  neighbors=sorted({int(v) for j in expected for v in t[j] if v!=i});assert neighbors==[n['vertex'] for n in row['neighbors']]
  for n in row['neighbors']:assert np.array_equal(raw[n['vertex']],n['point'])
  checks.append({'side':side,'role':role,'vertex':i,'point':raw[i].tolist(),'target_gap':row['target_gap'],'incident_triangles':len(expected),'neighbors':len(neighbors),'next_squared_distance_gap':float(squared[order[1]]-minimum)})
 else:checks.append({'side':side,'role':role,'first_refusal_witness_independently_matched':True,'candidates':ids.tolist(),'target_gap':row['target_gap']})
if r['passed']:assert len(used)==8 and r['original_attachment_intent']==policy['planned_original_topology'] and r['planned_control_order']==policy['planned_seam_control_order']
out={'utc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'verified':True,'source_query_passed':r['passed'],'method':'Full literal rawsource+Gram-area eligibility, independent sum/stable ordering for allnearest/tie/gap decisions, complete triangle incidence/neighbor membership','anchors':checks,'artist_role':'PENDING actual point atlas','continuous_seam_path':'UNAUTHORED_REQUIRED','garment_geometry':False,'physical_clearance_fit_motion':'UNKNOWN'}
with (H/'ROOT-RESULT.json').open('x') as f:json.dump(out,f,indent=2);f.write('\n')
print(json.dumps(out))
