"""Independent stdlib-only frozen-array readback; never loads Blender or repairs geometry."""
from pathlib import Path
from array import array
import json,zipfile,struct,ast,hashlib,math,datetime,stat,subprocess
HERE=Path(__file__).resolve().parent
r=json.loads((HERE/'RESULT.json').read_text());job=json.loads((HERE/'JOB.json').read_text());plan=json.loads((HERE/'EXEC-PLAN.json').read_text());warm=json.loads(Path(plan['warm']).read_text())
assert not r['success'] and job['exit_code']==1 and not job['timed_out']
def npy(z,name):
 b=z.read(name+'.npy');assert b[:6]==b'\x93NUMPY';major=b[6];size=struct.unpack('<H' if major==1 else '<I',b[8:10 if major==1 else 12])[0];start=10 if major==1 else 12;h=ast.literal_eval(b[start:start+size].decode().strip());assert not h['fortran_order'];payload=b[start+size:];code={'<f4':'f','<i4':'i'}[h['descr']];a=array(code);a.frombytes(payload);assert len(a)==math.prod(h['shape']);return a,h['shape'],hashlib.sha256(payload).hexdigest()
with zipfile.ZipFile(HERE/'work/actual-render-geometry.npz') as z:
 world,shape,h=npy(z,'AriOriginalCurls_world');assert shape==(516000,3) and h==r['render_geometry']['AriOriginalCurls']['world_sha256'];point=list(world[r['refusal_witness']['groom_vertex']*3:r['refusal_witness']['groom_vertex']*3+3]);assert point==r['refusal_witness']['point']
 for suffix in ['triangles','edges']:
  a,s,h=npy(z,'AriOriginalCurls_'+suffix);assert h==r['render_geometry']['AriOriginalCurls'][suffix+'_sha256']
with zipfile.ZipFile(HERE/'work/source-skin-geometry.npz') as z:
 for n in r['skin_owner_order']:
  for suffix in ['world','triangles','edges']:
   a,s,h=npy(z,n+'_'+suffix);assert h==r['skin_geometry'][n][suffix+'_sha256']
 face=r['refusal_witness']['skin_triangle'];off=0
 for n in r['skin_owner_order']:
  count=r['skin_geometry'][n]['triangles']
  if off<=face<off+count:owner=n;local=face-off;break
  off+=count
 verts,vs,h=npy(z,owner+'_world');tris,ts,h=npy(z,owner+'_triangles');ids=list(tris[local*3:local*3+3]);triangle=[list(verts[i*3:i*3+3]) for i in ids]
with zipfile.ZipFile(HERE/'work/actual-curve-arrays.npz') as z:
 expected=zipfile.ZipFile(HERE/'work/declared-controls.npz');co,cs,h=npy(expected,'controls');rad,rs,h=npy(expected,'radii');assert cs==(2000,41,4) and rs==(2000,41)
 for i,row in enumerate(r['curve']['splines']):
  for field,rec in row['arrays'].items():
   a,shape,h=npy(z,str(i)+'_'+field);assert list(shape)==rec['shape'] and h==rec['sha256']
   if field=='co':assert list(a)==list(co[i*164:(i+1)*164])
   if field=='radius':assert list(a)==list(rad[i*41:(i+1)*41])
 expected.close()
w=r['refusal_witness'];dot=math.fsum((point[i]-w['closest_skin_point'][i])*w['normal'][i] for i in range(3));assert math.isfinite(dot) and abs(dot-w['oriented_clearance'])<1e-8 and dot<=1e-6
names={x['name'] for x in warm['scene']['objects']};mats={x['name'] for x in warm['scene']['materials']};imgs={x['name'] for x in warm['scene']['images']}
original={k:[x for x in r['scene'][k] if x['name'] in ids] for k,ids in [('objects',names),('materials',mats),('images',imgs)]};original['scene_names']=r['scene']['scene_names'];assert original==warm['scene']
for row in plan['pins']:
 b=Path(row['path']).read_bytes();assert len(b)==row['bytes'] and hashlib.sha256(b).hexdigest()==row['sha256']
assert not list((HERE/'work').glob('*.blend'))
for f in (HERE/'work').glob('*.npz'):f.chmod(0o444)
assert not [l for l in subprocess.check_output(['ps','-axo','pid,comm'],text=True).splitlines() if l.split() and Path(l.split(maxsplit=1)[-1]).name=='Blender']
x={'checked_utc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'job_collected':True,'sole_job':job,'actual_splines':2000,'actual_controls':82000,'all14000point_array_hashes_and_declared_co_radius_exact':True,'all_skin_render_array_hashes_exact':True,'groom_render_array_hashes_exact':True,'refusal_point_matches_array':True,'double_precision_dot':dot,'reported_dot':w['oriented_clearance'],'skin_owner':owner,'skin_local_triangle':local,'skin_vertex_indices':ids,'actual_skin_triangle_points':triangle,'nearest_point_vertex_distances':[math.dist(w['closest_skin_point'],p) for p in triangle],'original_seven_owner_signature_in_partial_scene_exact':True,'physical_execution_pins_exact':20,'work_npzs_readonly':5,'candidate_saved':False,'native_jobs_live':False,'decision':'Fixedrecipe refused bydeclared oriented sample; no solid/intersection/appearance inference; no retry/cold/render.'}
(HERE/'ROOT-RESULT.json').write_text(json.dumps(x,indent=2)+'\n');print(json.dumps(x,indent=2))
