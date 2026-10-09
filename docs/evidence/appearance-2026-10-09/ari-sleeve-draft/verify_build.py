"""Independent raw-source/Hermite sections/topology/linear-system contact readback."""
from pathlib import Path
import json,hashlib,datetime,math,time
import numpy as np
H=Path(__file__).resolve().parent
sha=lambda a:hashlib.sha256(a.tobytes()).hexdigest()
cfg=json.loads((H/'CONTRACT.json').read_text());r=json.loads((H/'RESULT.json').read_text());require=lambda ok,msg:None if ok else (_ for _ in ()).throw(AssertionError(msg))
require(r['passed'] and r['geometry_qualified'],'Constructor geometry pass required')
for p in json.loads((H/'EXEC-BUILD.json').read_text())['pins']:
 q=Path(p['path'])
 with q.open('rb') as f:d=hashlib.file_digest(f,'sha256').hexdigest()
 require(q.stat().st_size==p['bytes'] and d==p['sha256'],'Exact source pin: '+str(q))
inputs=json.loads((H/'INPUTS.json').read_text());get=lambda suffix:next(p['path'] for p in inputs if p['path'].endswith(suffix))
with np.load(get('/after-geometry.npz'),allow_pickle=False) as z:world=z['Human_world'];body=z['Human_triangles']
refs=json.loads(Path(get('/ATTACHMENT-MANIFEST.json')).read_text());dist=json.loads(Path(get('/DISTAL-MANIFEST.json')).read_text())
require(sha(world)==r['source']['world_sha256'] and sha(body)==r['source']['triangles_sha256'],'Exact raw source arrays')
b=(H/'geometry.npz').read_bytes();require(len(b)==r['archive']['bytes'] and hashlib.sha256(b).hexdigest()==r['archive']['sha256'],'Exact produced archive')
with np.load(H/'geometry.npz',allow_pickle=False) as z:a={k:z[k] for k in z.files}
require(set(a)=={s+'_'+k for s in ['l','r'] for k in ['vertices','triangles','loop_uv','material_ids']},'Only eight owned finite buffers')
sections=[];maxerror=0
for side,rec in zip(['l','r'],r['components']):
 v=a[side+'_vertices'];t=a[side+'_triangles'];uv=a[side+'_loop_uv'];m=a[side+'_material_ids'];require(v.dtype==uv.dtype==np.float32 and t.dtype==m.dtype==np.int32,'Literal owned buffer dtypes')
 require(v.shape==(320,3) and t.shape==(640,3) and uv.shape==(640,3,2) and m.shape==(640,),'Literal owned domain sizes')
 for key,x in [('vertices',v),('triangles',t),('loop_uv',uv),('material_ids',m)]:require(sha(x)==rec['geometry_sha256'][key],'Exact stored logical hash: '+key)
 ref=next(s for s in refs['sides'] if s['side']==side);ids=[ref['anchor_ids'][k] for k in [1,2,3,0]];p=world[ids].astype(float);center=p.mean(axis=0);shoulder=[]
 # Hermite form instead of producer's expanded uniform Catmull polynomial.
 for j in range(32):
  k=j//8;x=(j%8)/8;p0,p1,p2,p3=[p[i%4] for i in [k-1,k,k+1,k+2]];v0=(p2-p0)/2;v1=(p3-p1)/2
  point=(2*x**3-3*x*x+1)*p1+(x**3-2*x*x+x)*v0+(-2*x**3+3*x*x)*p2+(x**3-x*x)*v1
  d=point-center;shoulder.append(point+cfg['shoulder_ease']*d/np.linalg.norm(d))
 shoulder=np.array(shoulder);rings=[]
 for role,ease in [('elbow',cfg['elbow_ease']),('cuff',cfg['cuff_start_ease']),('cuff',cfg['cuff_end_ease'])]:
  s=next(s for s in dist['sections'] if s['name']==role+'-'+side);original=[]
  for sm in s['samples']:
   q=sm['primary_association'];original.append(np.array(q['barycentric_weights'])@world[body[q['triangle']]].astype(float))
  original=np.array(original);u=np.array(s['meridian_basis']['u_front']);vv=np.array(s['meridian_basis']['v_down']);points=[]
  for j in range(32):
   x=j/2;lo=int(x);base=original[lo] if j%2==0 else (original[lo]+original[(lo+1)%16])/2;theta=j*math.pi/16;points.append(base+ease*(np.cos(theta)*u+np.sin(theta)*vv))
  points=np.array(points)
  if role=='cuff' and ease==cfg['cuff_start_ease']:points-=cfg['cuff_length']*np.array(s['normal'])
  rings.append(points)
 middle=shoulder*(1-cfg['upper_middle_fraction'])+rings[0]*cfg['upper_middle_fraction'];outer=np.array([shoulder,middle,*rings]);centers=np.array(rec['ring_centers']);radial=outer-centers[:,None];inner=outer-cfg['inner_inset']*radial/np.linalg.norm(radial,axis=2)[:,:,None]
 expected=np.concatenate([outer.reshape(-1,3),inner.reshape(-1,3)]);err=float(np.max(np.abs(v.astype(float)-expected)));require(err<1e-7,'Raw-source-derived original sections and lining');maxerror=max(maxerror,err)
 pp=v.astype(float)[t];cross=np.cross(pp[:,1]-pp[:,0],pp[:,2]-pp[:,0]);require(np.isfinite(cross).all() and (np.linalg.norm(cross,axis=1)>0).all(),'Positive all source-derived garment triangle areas')
 directed=np.concatenate([t[:,[0,1]],t[:,[1,2]],t[:,[2,0]]]);canonical=np.sort(directed,axis=1);keys,inv,counts=np.unique(canonical,axis=0,return_inverse=True,return_counts=True);sign=np.where(directed[:,0]<directed[:,1],1,-1);require(len(keys)==960 and (counts==2).all() and (np.bincount(inv,weights=sign)==0).all(),'Full sorted opposite edge incidence')
 parent=np.arange(320)
 def find(i):
  while parent[i]!=i:parent[i]=parent[parent[i]];i=parent[i]
  return int(i)
 for e in keys:parent[find(e[0])]=find(e[1])
 require(len({find(i) for i in range(320)})==1,'Independent union-find connectivity')
 volume=float(np.sum(np.einsum('ij,ij->i',pp[:,0],np.cross(pp[:,1],pp[:,2])))/6);require(volume>0 and abs(volume-rec['geometry']['signed_volume'])<1e-12,'Independent origin-based signed volume')
 require(np.isfinite(uv).all() and {int(k):int(np.count_nonzero(m==k)) for k in range(4)}=={0:192,1:256,2:64,3:128},'Explicit outer/lining/cuff/rim material face membership')
 sections.append({'side':side,'max_raw_source_section_error':err,'euler_characteristic':320-960+640,'signed_material_volume':volume,'limits':'Topology and signed volume do not prove self-clearance or inside/outside.'})
# Complete contact pair classification via independently solved linear systems.
vv=np.concatenate([a['l_vertices'],a['r_vertices']]).astype(float);tt=np.concatenate([a['l_triangles'],a['r_triangles']+320]);g=vv[tt];b=world.astype(float)[body];bmin=b.min(axis=1);bmax=b.max(axis=1);cfgc=cfg['contact'];eps=cfgc['barycentric_and_segment_epsilon'];pad=cfgc['bbox_padding'];counts={'candidate_pairs':0,'strict_transverse_pairs':0,'boundary_ambiguous_pairs':0,'coplanar_ambiguous_pairs':0};stop=r['contact']['reached_garment_triangles'];started=time.monotonic()
for gid,tri in enumerate(g[:stop]):
 require(time.monotonic()-started<120,'Independent contact verification effort cap')
 ids=np.flatnonzero(((tri.max(axis=0)+pad>=bmin)&(tri.min(axis=0)-pad<=bmax)).all(axis=1));n=len(ids);counts['candidate_pairs']+=n
 if not n:continue
 target=b[ids];strict=np.zeros(n,bool);boundary=np.zeros(n,bool);cop=np.zeros(n,bool)
 for direction in [0,1]:
  for edge in range(3):
   if direction==0:p0=np.broadcast_to(tri[edge],(n,3));p1=np.broadcast_to(tri[(edge+1)%3],(n,3));dest=target
   else:p0=target[:,edge];p1=target[:,(edge+1)%3];dest=np.broadcast_to(tri,(n,3,3))
   e=dest[:,1]-dest[:,0];f=dest[:,2]-dest[:,0];d=p1-p0;A=np.stack([e,f,-d],axis=2);det=np.linalg.det(A);valid=np.abs(det)>cfgc['determinant_epsilon'];x=np.zeros((n,3));x[valid]=np.linalg.solve(A[valid],(p0-dest[:,0])[valid,:,None])[:,:,0];u=x[:,0];v=x[:,1];tseg=x[:,2]
   closed=valid&(u>=-eps)&(v>=-eps)&(u+v<=1+eps)&(tseg>=-eps)&(tseg<=1+eps);ss=closed&(u>eps)&(v>eps)&(u+v<1-eps)&(tseg>eps)&(tseg<1-eps);strict|=ss;boundary|=closed&~ss
   normal=np.cross(e,f);normal/=np.linalg.norm(normal,axis=1)[:,None];cop|=(~valid)&(np.abs(np.einsum('ij,ij->i',p0-dest[:,0],normal))<=cfgc['coplanar_plane_distance'])&(np.abs(np.einsum('ij,ij->i',p1-dest[:,0],normal))<=cfgc['coplanar_plane_distance'])
 counts['strict_transverse_pairs']+=int(strict.sum());counts['boundary_ambiguous_pairs']+=int((boundary&~strict).sum());counts['coplanar_ambiguous_pairs']+=int((cop&~strict&~boundary).sum())
require(counts==r['contact']['counts'],'Full reached contact classes independently match')
for label,w in r['contact']['first_witnesses'].items():
 require(np.array_equal(g[w['garment_triangle']],w['garment_triangle_points']) and np.array_equal(b[w['body_triangle']],w['body_triangle_points']),'First witness raw source triangles exact')
 if w['point'] is not None:
  owner=g[w['garment_triangle']] if w['edge_owner']=='garment' else b[w['body_triangle']];target=b[w['body_triangle']] if w['edge_owner']=='garment' else g[w['garment_triangle']];k=w['edge_local_index'];pt=owner[k]+w['segment_fraction']*(owner[(k+1)%3]-owner[k]);pt2=np.array(w['target_barycentric_weights'])@target;require(np.max(np.abs(pt-pt2))<1e-10 and np.max(np.abs(pt-w['point']))<1e-10,'Independent first segment/barycentric witness')
result={'utc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'passed':True,'sections':sections,'max_source_section_error':maxerror,'full_reached_contact_linear_solve_classes':counts,'contact_complete':r['contact']['complete'],'fit':r['fit'],'limits':'Original geometry/source association only. Neither finite contact classes nor closed material topology qualify global clearance, body occupancy, complete coverage, sleeve self-contact, garment fit, appearance or motion.'}
(H/'ROOT-RESULT.json').write_text(json.dumps(result,indent=2)+'\n');print(json.dumps(result))
