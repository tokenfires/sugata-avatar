"""Root stdlib stored-result verification; no Blender or construction/replay."""
from pathlib import Path
from array import array
import json,zipfile,struct,ast,hashlib,math,datetime,stat
P=Path(__file__).resolve().parent
def read(n):return json.loads((P/n).read_text())
def npy(z,name):
 b=z.read(name+'.npy');assert b[:6]==b'\x93NUMPY';major=b[6];start=10 if major==1 else 12;size=struct.unpack('<H' if major==1 else '<I',b[8:start])[0];h=ast.literal_eval(b[start:start+size].decode().strip());assert not h['fortran_order'];payload=b[start+size:];a=array({'<f4':'f','<i4':'i'}[h['descr']]);a.frombytes(payload);assert len(a)==math.prod(h['shape']) and all(math.isfinite(x) for x in a);return a,h['shape'],hashlib.sha256(payload).hexdigest()
r=read('RESULT.json');job=read('JOB.json');e=read('EXEC-PLAN.json');cr=read('CURVE.json');paths=read('PATHS.json');geo=read('GEOMETRY.json');w=read('WARM.json');reopen=read('REOPEN.json');clean=read('CLEANUP.json');baseline=json.loads(Path(e['warm']).read_text());assert r['passed'] and job['exit_code']==0 and not job['timed_out']
for pin in e['pins']:
 b=Path(pin['path']).read_bytes();assert len(b)==pin['bytes'] and hashlib.sha256(b).hexdigest()==pin['sha256']
assert cr==w['curve']==reopen['curve']==clean['curve'];assert w['scene']==reopen['old_scene']==clean['scene'];assert w['extras']==reopen['extras']==clean['extras'];assert w['metadata']==reopen['metadata']==clean['metadata']==baseline['full_native_key_metadata'];assert geo==reopen['evaluated']==r['geometry'];assert len(cr['splines'])==27 and cr['total_controls']==1755
old=baseline['scene'];names={x['name'] for x in old['objects']};mats={x['name'] for x in old['materials']};imgs={x['name'] for x in old['images']};subset={k:[x for x in w['scene'][k] if x['name'] in ids] for k,ids in [('objects',names),('materials',mats),('images',imgs)]};subset['scene_names']=w['scene']['scene_names'];assert subset==old
with zipfile.ZipFile(P/'work/actual-curve.npz') as z:
 count=0
 for i,s in enumerate(cr['splines']):
  for field,record in s['arrays'].items():
   a,shape,h=npy(z,str(i)+'_'+field);assert list(shape)==record['shape'] and h==record['sha256'];count+=1
   if field=='co':assert list(a)==[x for point in paths[i]['controls'] for x in point]
   if field=='radius':assert list(a)==paths[i]['radii']
with zipfile.ZipFile(P/'work/actual-static-geometry.npz') as z:
 geometry={}
 for owner,record in geo.items():
  geometry[owner]={}
  for suffix,field,width in [('world','vertices',3),('triangles','triangles',3),('edges','edges',2)]:
   a,shape,h=npy(z,owner+'_'+suffix);assert shape==(record[field],width) and h==record[suffix+'_sha256'];geometry[owner][suffix]=a
  assert all(0<=i<record['vertices'] for i in geometry[owner]['triangles']) and all(0<=i<record['vertices'] for i in geometry[owner]['edges'])
contact=read('CONTACT.json');assert contact==r['static_contact'] and contact['first_hit'] is None and contact['ray_tests']==geo['AriSparseOriginalGroups']['edges']==21384 and contact['degenerate_edges']==0
nearest=contact['nearest_witness'];verts=geometry['AriSparseOriginalGroups']['world'];human=geometry['Human']['world'];tris=geometry['Human']['triangles'];assert list(verts[nearest['vertex']*3:nearest['vertex']*3+3])==nearest['point'];ids=list(tris[nearest['triangle']*3:nearest['triangle']*3+3]);assert ids==nearest['indices'] and [list(human[i*3:i*3+3]) for i in ids]==nearest['triangle_coordinates'];distance=math.dist(nearest['point'],nearest['closest']);assert abs(distance-nearest['distance_m'])<1e-8
recipe=read('RECIPE.json');tube=geometry['AriSparseOriginalGroups'];vt=tube['world'];tt=tube['triangles'];ear_count=fore_count=0
for off in range(0,len(tt),3):
 pts=[vt[i*3:i*3+3] for i in tt[off:off+3]];lo=[min(p[j] for p in pts) for j in range(3)];hi=[max(p[j] for p in pts) for j in range(3)]
 for box in recipe['ear_intent_boxes'].values():ear_count+=1;assert not all(hi[j]>=box['min'][j] and lo[j]<=box['max'][j] for j in range(3))
 gate=recipe['forehead_gate'];fore_count+=1;assert not(lo[1]<gate['front_y'] and lo[2]<gate['min_z'])
env=read('ENVELOPE.json');assert env==r['envelope'] and env['ear_tests']==ear_count and env['forehead_triangle_tests']==fore_count and env['first_refusal'] is None
for pin in r['buffers']:
 f=Path(pin['path']);b=f.read_bytes();assert len(b)==pin['bytes'] and hashlib.sha256(b).hexdigest()==pin['sha256'] and stat.S_IMODE(f.stat().st_mode)==0o444
for out in r['outputs']:
 f=Path(out['path']);b=f.read_bytes();assert len(b)==out['bytes'] and hashlib.sha256(b).hexdigest()==out['sha256'];assert b[:8]==b'\x89PNG\r\n\x1a\n' and struct.unpack('>II',b[16:24])==(768,768);assert stat.S_IMODE(f.stat().st_mode)==0o444 and all(.04<=out['projection'][k]<=.96 for k in ['minx','maxx','miny','maxy'])
f=Path(r['source']);b=f.read_bytes();assert len(b)==r['source_bytes'] and hashlib.sha256(b).hexdigest()==r['source_sha256'] and stat.S_IMODE(f.stat().st_mode)==0o444
matrix=cr['matrix_world'];residual=max(abs(matrix[i][j]-(1 if i==j else 0)) for i in range(4) for j in range(4))
assert residual<=1e-6
result={'utc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'passed_stored_receipt':True,'execution_pins':len(e['pins']),'curve_point_arrays':count,'declared_co_radius_exact':True,'geometry_array_hashes':6,'indices_in_bounds':True,'old_seven_scene_exact':True,'all252meta_exact':True,'warm_reopen_cleanup_exact':True,'same_process_reopen_only':True,'worldidentity_residual':residual,'nearest_witness_independent_distance_m':distance,'artist_ear_triangle_tests':ear_count,'forehead_triangle_tests':fore_count,'BVH_observed_edge_nohit_attributed_to_native':21384,'BVH_not_rerun':True,'physical_source_png_buffers_exact_readonly':True,'appearance':'rootactual3originals refuse extendingstalk/Swirelanguage; independent reviewpending','limits':'No native freshdecode/independentcoldprocess/solidoccupancy/physicalclearance/allanatomy/selfcontact/motion/AAA qualification'}
(P/'ROOT-RESULT.json').write_text(json.dumps(result,indent=2)+'\n');print(json.dumps(result,indent=2))
