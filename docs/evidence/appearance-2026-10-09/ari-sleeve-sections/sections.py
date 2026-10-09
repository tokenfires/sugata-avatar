"""Sole4distal contour/16meridian association query; no garment geometry."""
import sys
sys.dont_write_bytecode=True
from pathlib import Path
from collections import defaultdict
import ast,json,hashlib,datetime,os,math
import numpy as np
HERE=Path(__file__).resolve().parent
RESULT={'started_utc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'pid':os.getpid(),'sections':[],'passed':False,'garment_geometry':False,'artist_role':'PENDING separatefirstchart','fit_clearance_motion':'UNKNOWN'}
def pins():
 for p in json.loads((HERE/'EXEC-QUERY.json').read_text())['pins']:
  b=Path(p['path']).read_bytes()
  if len(b)!=p['bytes'] or hashlib.sha256(b).hexdigest()!=p['sha256']:raise RuntimeError('Pin changed: '+p['path'])
# Execute only six frozen predicate/contour definitions; no old producer/top-level or old stations.
inputs=json.loads((HERE/'INPUTS.json').read_text());find=lambda suffix:next(Path(p['path']) for p in inputs if p['path'].endswith(suffix))
helper=find('/ari-bomber-sections/sections.py');tree=ast.parse(helper.read_text());names={'Refusal','require','cross','contour_checks','extract','sha'};nodes=[n for n in tree.body if isinstance(n,(ast.FunctionDef,ast.ClassDef)) and n.name in names];assert {n.name for n in nodes}==names
exec(compile(ast.Module(body=nodes,type_ignores=[]),str(helper),'exec'),globals())
def meridians(section,world,triangles):
 normal=np.array(section['normal']);origin=np.array(section['origin']);front=np.array([0.,-1.,0.]);u=front-normal*np.dot(front,normal);require(np.linalg.norm(u)>1e-12,'Projectedfront basis degenerate',section['name']);u/=np.linalg.norm(u);v=np.cross(normal,u)
 if v[2]>0:v=-v
 require(v[2]<-1e-9 and np.max(np.abs(np.array([u,v,normal])@np.array([u,v,normal]).T-np.eye(3)))<1e-12,'Orthonormalfront/down basis',section['name']);hand=float(np.dot(np.cross(u,v),normal));require(abs(abs(hand)-1)<1e-12,'Meridian handedness',section['name']);section['meridian_basis']={'u_front':u.tolist(),'v_down':v.tolist(),'normal':normal.tolist(),'handedness':hand}
 loop=section['components'][section['selected_component']];edges=list(map(tuple,loop['ordered_edges']));lookup={tuple(r['edge']):r for r in section['source_crossings']};xyz=np.array([lookup[e]['point'] for e in edges]);q=np.column_stack(((xyz-origin)@u,(xyz-origin)@v));segment_tri={frozenset(map(tuple,r['edges'])):r['triangle'] for r in section['source_segments']};section['meridian_samples']=[]
 for k in range(16):
  angle=2*math.pi*k/16;direction=np.array([math.cos(angle),math.sin(angle)]);sample={'index':k,'angle_radians':angle,'direction_2d':direction.tolist(),'candidate_hits':[]};section['meridian_samples'].append(sample);groups={}
  for i,(a,b) in enumerate(zip(q,np.roll(q,-1,axis=0))):
   delta=b-a;den=float(cross(direction,delta))
   if abs(den)<=1e-12:
    col=abs(float(cross(a,direction)))<=1e-12
    require(not (col and max(float(np.dot(a,direction)),float(np.dot(b,direction)))>1e-9),'Positivecollinear meridian segment',{'station':section['name'],'ray':k,'segment':i,'points_2d':[a.tolist(),b.tolist()]});continue
   ray_t=float(cross(a,delta)/den);fraction=float(cross(a,direction)/den)
   if ray_t<=1e-9 or fraction< -1e-12 or fraction>1+1e-12:continue
   e1,e2=edges[i],edges[(i+1)%len(edges)];endpoint=None
   if abs(fraction)<=1e-12:fraction=0.;endpoint=e1
   elif abs(fraction-1)<=1e-12:fraction=1.;endpoint=e2
   point2=a+fraction*delta;require(np.linalg.norm(point2-ray_t*direction)<=1e-10,'Meridian solve consistency',{'station':section['name'],'ray':k,'segment':i});tid=segment_tri[frozenset([e1,e2])];tri=triangles[tid];weights={int(j):0. for j in tri}
   for factor,e in [(1-fraction,e1),(fraction,e2)]:
    row=lookup[e];ia,ib=e;require(ia in weights and ib in weights,'Source segment triangle membership');weights[ia]+=factor*(1-row['fraction']);weights[ib]+=factor*row['fraction']
   bary=np.array([weights[int(j)] for j in tri]);point=(1-fraction)*np.array(lookup[e1]['point'])+fraction*np.array(lookup[e2]['point']);require(np.isfinite(point).all() and np.isfinite(bary).all() and abs(float(bary.sum())-1)<1e-12 and (bary>=-1e-12).all() and (bary<=1+1e-12).all() and np.max(np.abs(bary@world[tri]-point))<1e-12,'Exact meridian trianglebary association',{'station':section['name'],'ray':k,'triangle':int(tid)})
   hit={'segment':i,'source_edges':[list(e1),list(e2)],'segment_fraction':fraction,'ray_distance':ray_t,'triangle':int(tid),'triangle_vertex_ids':tri.tolist(),'barycentric_weights':bary.tolist(),'point':point.tolist(),'point_2d':point2.tolist(),'endpoint_source_edge':None if endpoint is None else list(endpoint)};sample['candidate_hits'].append(hit)
   key=('endpoint',endpoint) if endpoint is not None else ('segment',i)
   if key in groups:require(np.linalg.norm(np.array(groups[key][0]['point'])-point)<=1e-10,'Endpointduplicate physicalpoint mismatch',{'station':section['name'],'ray':k,'key':str(key)})
   groups.setdefault(key,[]).append(hit)
  sample['physical_hit_groups']=[{'kind':key[0],'endpoint_edge':list(key[1]) if key[0]=='endpoint' else None,'candidate_triangles':[h['triangle'] for h in group]} for key,group in groups.items()];require(len(groups)==1,'Meridian doesnot ownexactlyonephysicalpositive hit',{'station':section['name'],'ray':k,'groups':sample['physical_hit_groups'],'hits':sample['candidate_hits']})
  group=next(iter(groups.values()));primary=min(group,key=lambda h:(h['triangle'],h['segment']));sample['primary_association']=primary;sample['all_incident_associations']=group;sample['accepted_source_sample']=True
 section['accepted_meridian_reference']=True
try:
 require(not (HERE/'RESULT.json').exists(),'Exclusivefirstquery');pins();policy=json.loads((HERE/'POLICY.json').read_text());cold=json.loads(find('/COLD.json').read_text())['geometry']['Human'];mapping=json.loads(find('/SOURCE-MAP.json').read_text());bones={b['name']:b for b in mapping['rig_object']['rig']['bones']};require(mapping['facts']['body_rig_world_identity'],'Recorded worldframe identity')
 with np.load(find('/after-geometry.npz'),allow_pickle=False) as z:raw=z['Human_world'];triangles=z['Human_triangles']
 require(raw.dtype==np.float32 and raw.shape==(13380,3) and triangles.dtype==np.int32 and triangles.shape==(26756,3),'Literal source domains');require(sha(raw)==cold['world_sha256'] and sha(triangles)==cold['triangles_sha256'],'Exact source SHA');require(np.isfinite(raw).all() and triangles.min()>=0 and triangles.max()<len(raw),'Finiteindexedfullsource');world=raw.astype(float);areas=np.linalg.norm(np.cross(world[triangles[:,1]]-world[triangles[:,0]],world[triangles[:,2]]-world[triangles[:,0]]),axis=1);bad=np.flatnonzero(~np.isfinite(areas)|(areas<=0));require(not len(bad),'Fullsource triangleeligibility',None if not len(bad) else int(bad[0]));RESULT['source']={'world_sha256':sha(raw),'triangles_sha256':sha(triangles),'vertices':len(raw),'triangles':len(triangles),'minimum_twice_triangle_area':float(areas.min())};RESULT['frozen_helper_functions']=sorted(names)
 for station in policy['stations']:
  side=station['side'];bone=bones['lowerarm_'+side];expected=np.array(bone['tail_local'])-bone['head_local'];expected/=np.linalg.norm(expected);origin=bone['head_local'] if station['role']=='elbow' else bones['hand_'+side]['head_local'];require(np.array_equal(station['origin'],origin) and np.max(np.abs(expected-station['normal']))<1e-12,'Literal fixedstation source refs');extract(world,triangles,station);meridians(RESULT['sections'][-1],world,triangles)
 require(len(RESULT['sections'])==4 and all(len(s['meridian_samples'])==16 and s['accepted_meridian_reference'] for s in RESULT['sections']),'Complete4x16 source association');RESULT['passed']=True
except Refusal as e:print('REFUSED',str(e))
except Exception as e:RESULT['unexpected_error']={'type':type(e).__name__,'message':str(e)};print('ERROR',str(e))
finally:
 try:pins();RESULT['post_pins_exact']=True
 except Exception as e:RESULT['post_pin_error']=str(e);RESULT['passed']=False
 RESULT['finished_utc']=datetime.datetime.now(datetime.timezone.utc).isoformat();b=json.dumps(RESULT,indent=2).encode()+b'\n'
 if len(b)>2097152:raise RuntimeError('2MiBresult cap')
 with (HERE/'RESULT.json').open('xb') as f:f.write(b)
 print(json.dumps({'passed':RESULT['passed'],'stations_reached':len(RESULT['sections']),'bytes':len(b),'refusal':RESULT.get('refusal'),'unexpected_error':RESULT.get('unexpected_error')}));sys.exit(0 if RESULT['passed'] else 1)
