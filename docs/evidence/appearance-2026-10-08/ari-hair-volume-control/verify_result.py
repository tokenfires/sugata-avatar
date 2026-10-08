"""Root stdlib stored-result verification; no Blender or construction/replay."""
from pathlib import Path
from array import array
import json,zipfile,struct,ast,hashlib,math,datetime,stat
P=Path(__file__).resolve().parent
def read(n):return json.loads((P/n).read_text())
def npy(z,name):
 b=z.read(name+'.npy');assert b[:6]==b'\x93NUMPY';major=b[6];start=10 if major==1 else 12;size=struct.unpack('<H' if major==1 else '<I',b[8:start])[0];h=ast.literal_eval(b[start:start+size].decode().strip());assert not h['fortran_order'];payload=b[start+size:];a=array({'<f4':'f','<i4':'i'}[h['descr']]);a.frombytes(payload);assert len(a)==math.prod(h['shape']) and all(math.isfinite(x) for x in a);return a,h['shape'],hashlib.sha256(payload).hexdigest()
r=read('RESULT.json');job=read('JOB.json');e=read('EXEC-PLAN.json');m=read('MASS.json');n=read('NATIVE.json');geo=read('GEOMETRY.json')
assert not r['strict_forehead_passed'] and not r['candidate_promotion']
for pin in e['pins']:
 b=Path(pin['path']).read_bytes();assert len(b)==pin['bytes'] and hashlib.sha256(b).hexdigest()==pin['sha256']
assert n['vertices']==m['vertices'] and n['faces']==m['faces']
codes={'outer':0,'base':1,'wall':2};assert n['actual_role_attribute']==[codes[x] for x in m['face_roles']]
with zipfile.ZipFile(P/'work/actual-static-geometry.npz') as z:
 geometry={}
 for owner,record in geo.items():
  geometry[owner]={}
  for suffix,field,width in [('world','vertices',3),('triangles','triangles',3),('edges','edges',2)]:
   a,shape,h=npy(z,owner+'_'+suffix);assert shape==(record[field],width) and h==record[suffix+'_sha256'];geometry[owner][suffix]=a
  assert all(0<=i<record['vertices'] for i in geometry[owner]['triangles']) and all(0<=i<record['vertices'] for i in geometry[owner]['edges'])
t=geometry['AriTemporaryVolume'];v=t['world'];tr=t['triangles'];er=read('ROLE-TRANSPORT.json');evr=read('EVALUATED-ROLES.json')
assert evr['polygon_role_values']==n['actual_role_attribute'] and evr['triangle_polygon']==er['triangle_polygon']
assert evr['triangle_role_values']==[codes[x] for x in er['triangle_role']]
fore=[];ears=[]
for ti in range(len(tr)//3):
 ids=list(tr[ti*3:ti*3+3]);pts=[list(v[i*3:i*3+3]) for i in ids];lo=[min(x[j] for x in pts) for j in range(3)];hi=[max(x[j] for x in pts) for j in range(3)]
 role=er['triangle_role'][ti];poly=er['triangle_polygon'][ti];gate=m['artist_forehead_gate']
 if lo[1]<gate['front_y'] and lo[2]<gate['min_z']:fore.append((ti,poly,role))
 for side,box in m['artist_ear_boxes'].items():
  if all(hi[j]>=box['min'][j] and lo[j]<=box['max'][j] for j in range(3)):ears.append((ti,poly,role,side))
en=read('ENVELOPE.json');assert fore==[(x['triangle'],x['polygon'],x['role']) for x in en['forehead_overlaps']];assert ears==[(x['triangle'],x['polygon'],x['role'],x['side']) for x in en['ear_overlaps']]
assert sorted({p for _,p,role in fore if role=='outer'})==[128,532] and not any(x[2]=='outer' for x in ears)
edge_roles={}
for face,role in zip(m['faces'],m['face_roles']):
 for a,b in zip(face,face[1:]+face[:1]):edge_roles.setdefault(tuple(sorted((a,b))),set()).add(role)
ct=read('CONTACT.json');counts={};hitcounts={};hv=geometry['Human']['world'];ht=geometry['Human']['triangles']
for off in range(0,len(t['edges']),2):
 ed=tuple(sorted(t['edges'][off:off+2]));role='outer' if 'outer' in edge_roles[ed] else 'base_or_wall';counts[role]=counts.get(role,0)+1
assert counts==ct['edge_role_counts'] and sum(counts.values())==1354 and ct['ray_tests']+ct['degenerate_edges']==1354
for w in ct['hit_witnesses']:
 ids=list(t['edges'][w['edge']*2:w['edge']*2+2]);assert ids==w['indices'];pts=[list(v[i*3:i*3+3]) for i in ids];assert max(abs(pts[0][j]-w['start'][j]) for j in range(3))<1e-7 and max(abs(pts[1][j]-w['end'][j]) for j in range(3))<1e-7
 hids=list(ht[w['Human_triangle']*3:w['Human_triangle']*3+3]);assert hids==w['triangle_indices'] and [list(hv[i*3:i*3+3]) for i in hids]==w['triangle_coordinates']
 assert abs(math.dist(w['start'],w['hit'])-w['distance_m'])<1e-6 and -1e-7<=w['distance_m']<=w['length_m']+1e-7
 hitcounts[w['responsibility']]=hitcounts.get(w['responsibility'],0)+1
assert hitcounts==ct['edge_hit_counts']
if r['execution_passed']:
 assert job['exit_code']==0 and not job['timed_out'] and ct['first_outer_hit'] is None
 w=read('WARM.json');c=read('REOPEN.json');cl=read('CLEANUP.json');base=json.loads(Path(e['warm']).read_text())
 assert w['owned']==c['owned']==cl['owned']==n and w['scene']==c['scene']==cl['scene'] and w['extras']==c['extras']==cl['extras'] and w['metadata']==c['metadata']==cl['metadata']==base['full_native_key_metadata']
 assert c['geometry']==w['geometry']==geo==r['geometry'] and c['evaluated_roles']['polygon_role_values']==n['actual_role_attribute'] and c['evaluated_roles']['triangle_polygon']==er['triangle_polygon']
 old=base['scene'];names={x['name'] for x in old['objects']};mats={x['name'] for x in old['materials']};imgs={x['name'] for x in old['images']};sub={k:[x for x in w['scene'][k] if x['name'] in ids] for k,ids in [('objects',names),('materials',mats),('images',imgs)]};sub['scene_names']=w['scene']['scene_names'];assert sub==old
 for out in r['outputs']:
  f=Path(out['path']);b=f.read_bytes();assert len(b)==out['bytes'] and hashlib.sha256(b).hexdigest()==out['sha256'] and struct.unpack('>II',b[16:24])==(768,768) and stat.S_IMODE(f.stat().st_mode)==0o444
 f=Path(r['source']);b=f.read_bytes();assert len(b)==r['source_bytes'] and hashlib.sha256(b).hexdigest()==r['source_sha256'] and stat.S_IMODE(f.stat().st_mode)==0o444
for pin in r['buffers']:
 f=Path(pin['path']);b=f.read_bytes();assert len(b)==pin['bytes'] and hashlib.sha256(b).hexdigest()==pin['sha256'] and stat.S_IMODE(f.stat().st_mode)==0o444
result={'utc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'stored_receipt_verified':True,'execution_passed':r['execution_passed'],'strict_forehead_passed':False,'candidate_promotion':False,'geometry_hashes':6,'pins':len(e['pins']),'forehead_outer_polygons':[128,532],'edge_role_counts':counts,'hit_counts':hitcounts,'all_hit_witnesses_bound':len(ct['hit_witnesses']),'BVH_not_rerun':True,'limits':'Stored verification only; observed BVH rays not occupancy or clearance; same-process saved reopen only; actual image review separate.'}
(P/'ROOT-RESULT.json').write_text(json.dumps(result,indent=2)+'\n');print(json.dumps(result,indent=2))
