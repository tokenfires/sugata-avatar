"""One fixed longitudinal source evaluation and discrete mesh qualification only."""
from pathlib import Path
import sys,json,hashlib,datetime,time,math
sys.dont_write_bytecode=True
import numpy as np
P=Path(__file__).resolve().parent;E=json.loads((P/'EXEC.json').read_text());T0=time.monotonic()
R={'started':datetime.datetime.now(datetime.timezone.utc).isoformat(),'pid':__import__('os').getpid(),'passed':False,'scope':'GEOMETRY ONLY','physical':'UNKNOWN','appearance':'UNKNOWN','checks':[]}
def check(v,label,evidence=None):
 if not v:
  R['refusal']={'label':label,'witness':evidence};raise RuntimeError(label)
 R['checks'].append(label)
def sha(b):return hashlib.sha256(b).hexdigest()
def write(n,v):
 b=(json.dumps(v,indent=2)+'\n').encode();check(len(b)<=8388608,'JSON cap '+n)
 with (P/n).open('xb') as f:f.write(b)
def clock():check(time.monotonic()-T0<55 and datetime.datetime.now(datetime.timezone.utc)<datetime.datetime.fromisoformat(E['finish_by']),'Fresh worker clock')
def pins():
 for r in E['pins']:
  b=Path(r['path']).read_bytes();check(len(b)==r['bytes'] and sha(b)==r['sha256'],'Pin '+r['path'])
def unit(v):
 check(np.shape(v)==(3,) and np.isfinite(v).all(),'Finite source vector',{'vector':np.asarray(v).tolist()});n=float(np.linalg.norm(v));check(math.isfinite(n) and n>0,'Nonzero source vector',{'vector':v.tolist(),'norm':n});return v/n
def H(q,p0,p1,d0,d1):
 if q==0:return p0.copy()
 if q==1:return p1.copy()
 return (2*q**3-3*q*q+1)*p0+(q**3-2*q*q+q)*d0+(-2*q**3+3*q*q)*p1+(q**3-q*q)*d1

def rail(s,knots,D):
 if s==0:return knots[0].copy()
 if s==.5:return knots[1].copy()
 if s==1:return knots[2].copy()
 k=0 if s<.5 else 1;q=2*s-k;return H(q,knots[k],knots[k+1],D[k],D[k+1])
def bez(t,c):
 if t==0:return c[0].copy()
 if t==1:return c[3].copy()
 return (1-t)**3*c[0]+3*(1-t)**2*t*c[1]+3*(1-t)*t*t*c[2]+t**3*c[3]
def patch(s,t,data,piece):
 F,B,D,arches=data['F'],data['B'],data['D'],data['arches'][piece]
 L,RR=(F,B) if piece=='upper' else (B,F)
 if t==0:return rail(s,L,D)
 if t==1:return rail(s,RR,D)
 if s==0:return bez(t,arches[0])
 if s==1:return bez(t,arches[1])
 return (1-t)*rail(s,L,D)+t*rail(s,RR,D)+(1-s)*bez(t,arches[0])+s*bez(t,arches[1])-((1-s)*(1-t)*L[0]+s*(1-t)*L[2]+(1-s)*t*RR[0]+s*t*RR[2])
def topology(v,tri):
 edge={};incident=[[] for _ in v];adj=[set() for _ in v]
 for fi,(a,b,c) in enumerate(tri.tolist()):
  check(len({a,b,c})==3 and min(a,b,c)>=0 and max(a,b,c)<len(v),'Triangle index eligibility')
  for u,w in [(a,b),(b,c),(c,a)]:edge.setdefault((min(u,w),max(u,w)),[]).append((u,w,fi));adj[u].add(w);adj[w].add(u)
  for u in (a,b,c):incident[u].append(fi)
 badedge=[(k,x) for k,x in edge.items() if len(x)!=2 or x[0][:2]!=x[1][:2][::-1]]
 check(not badedge,'Every edge two opposed incidences',{'bad_count':len(badedge),'first':badedge[0] if badedge else None})
 badlink=[]
 for u,faces in enumerate(incident):
  link={}
  for fi in faces:
   a,b=[int(x) for x in tri[fi] if x!=u];link.setdefault(a,set()).add(b);link.setdefault(b,set()).add(a)
  todo=[next(iter(link))] if link else [];seen=set()
  while todo:
   x=todo.pop()
   if x not in seen:seen.add(x);todo.extend(link[x]-seen)
  if not link or seen!=set(link) or any(len(x)!=2 for x in link.values()):badlink.append(u)
 check(not badlink,'Every vertex closed connected link',{'bad_count':len(badlink),'first_vertex':badlink[0] if badlink else None,'incident_faces':incident[badlink[0]] if badlink else None})
 comps=[];remaining=set(range(len(v)))
 while remaining:
  seen=set();todo=[min(remaining)]
  while todo:
   u=todo.pop()
   if u not in seen:seen.add(u);todo.extend(adj[u]-seen)
  remaining-=seen;fs=sum(1 for row in tri if int(row[0]) in seen);es=sum(1 for u,w in edge if u in seen);comps.append({'vertices':len(seen),'edges':es,'triangles':fs,'euler':len(seen)-es+fs})
 R['topology_observed']={'edges':len(edge),'components':comps,'bad_edges':len(badedge),'bad_links':len(badlink)};check(len(comps)==2 and all(x['euler']==0 and x['vertices']==6240 and x['triangles']==12480 for x in comps),'Two expected closed material tube components',R['topology_observed'])
 return {'edges':len(edge),'components':comps,'bad_edges':len(badedge),'bad_links':len(badlink)}
try:
 clock();pins();R['runtime']={'python_version':sys.version,'numpy_version':np.__version__,'numpy_entry':str(Path(np.__file__).resolve()),'limit':'Entry/version/binary only, full transitive/compiled runtime unqualified'};write('RUNTIME-OBSERVED.json',R['runtime']);check(all(R['runtime'][k]==E['runtime'][k] for k in ['python_version','numpy_version','numpy_entry']),'Runtime identity',R['runtime']);check(str(Path(sys.executable).resolve())==E['python'],'Exact interpreter');S=json.loads(Path(E['recipe']).read_text());check(S['future_mesh_requirements']['longitudinal_intervals']==64 and S['future_mesh_requirements']['cross_panel_intervals']==24,'Exact interval recipe')
 vertices=[];owners=[];lookup={};triangles=[];roles=[];sides=[];pieces=[];grids={};source={};requests=0;reused=0
 def addowner(key,point,meta):
  global requests,reused
  requests+=1;check(np.shape(point)==(3,) and np.isfinite(point).all(),'Finite evaluated point',{'key':key,'point':np.asarray(point).tolist(),'meta':meta})
  if key in lookup:
   reused+=1;idx=lookup[key];check(np.asarray(vertices[idx]).tobytes()==point.tobytes(),'Exact canonical owner reuse',{'key':key,'index':idx,'existing':vertices[idx],'incoming':point.tolist()});return idx
  check(len(vertices)<20000,'Vertex cap');idx=len(vertices);lookup[key]=idx;vertices.append(point.tolist());owners.append({'key':key,**meta});return idx
 def face(a,b,c,role,side,piece):
  check(len(triangles)<50000,'Triangle cap');triangles.append([a,b,c]);roles.append(role);sides.append(side);pieces.append(piece)
 for sr in S['references']:
  side=sr['side'];si=0 if side=='r' else 1;P0,P1,P2=[np.asarray(sr[k]['coordinate'],dtype=np.float64) for k in ['P0_reference','P1_reference','P2_reference']]
  A=unit(P1-P0);B=unit(np.asarray(sr['cuff_plane_normal'],dtype=np.float64));N=[A,unit(A+B),B];Q=[P0-.040*A,P1,P2];L0=float(np.linalg.norm(P1-P0));L1=float(np.linalg.norm(P2-P1));D=[.60*L0*A,.60*min(L0,L1)*N[1],.60*L1*B];U=[];W=[]
  for n in N:
   front=np.array([0.,-1.,0.]);u=unit(front-np.dot(front,n)*n);vp=np.cross(n,u);check(np.isfinite(vp).all() and np.dot(vp,[0,0,1])*sr['upper_piece_frame_sign']>0,'Declared upper frame sign',{'side':side,'node':len(U),'N':n.tolist(),'U':u.tolist(),'V':vp.tolist(),'expected_sign':sr['upper_piece_frame_sign']});U.append(u);W.append(sr['upper_piece_frame_sign']*vp)
  check(all(np.max(np.abs(np.stack([u,np.cross(n,u),n])@np.stack([u,np.cross(n,u),n]).T-np.eye(3)))<1e-12 for u,n in zip(U,N)),'Proper orthonormal node frames')
  source[side]={'P':[x.tolist() for x in [P0,P1,P2]],'N':[x.tolist() for x in N],'Q':[x.tolist() for x in Q],'U':[x.tolist() for x in U],'W':[x.tolist() for x in W],'D':[x.tolist() for x in D],'layers':{}}
  for layer,profile in S['profiles'].items():
   F=np.array([q+w*u for q,w,u in zip(Q,profile['front_width'],U)]);BK=np.array([q-w*u for q,w,u in zip(Q,profile['back_width'],U)]);arches={'upper':[],'under':[]}
   for k,i in enumerate([0,2]):
    hu=profile['upper_arch_handle'][k];hd=profile['under_arch_handle'][k];f,b=F[i],BK[i]
    arches['upper'].append(np.array([f,f+(b-f)/3+hu*W[i],b-(b-f)/3+hu*W[i],b]));arches['under'].append(np.array([b,b+(f-b)/3-hd*W[i],f-(f-b)/3-hd*W[i],f]))
   data={'F':F,'B':BK,'D':D,'arches':arches};source[side]['layers'][layer]={'F':F.tolist(),'B':BK.tolist(),'arches':{k:[a.tolist() for a in v] for k,v in arches.items()}}
   for piece,pi in [('upper',0),('under',1)]:
    grid=np.empty((65,25),dtype=np.int32)
    for i in range(65):
     clock()
     for j in range(25):
      seam=('F' if (piece=='upper' and j==0) or (piece=='under' and j==24) else 'B') if j in [0,24] else None;key=f'{side}|{layer}|'+(f'{seam}|{i}' if seam else f'{piece}|{i}|{j}')
      grid[i,j]=addowner(key,patch(i/64,j/24,data,piece),{'side':side,'layer':layer,'seam':seam,'piece':None if seam else piece,'i':i,'j':None if seam else j})
    grids[side+'_'+layer+'_'+piece]=grid
    winding=sr['outer_chart_winding'] if layer=='O' else sr['inner_material_chart_winding']
    for i in range(64):
     for j in range(24):
      a,b,c,d=int(grid[i,j]),int(grid[i+1,j]),int(grid[i+1,j+1]),int(grid[i,j+1]);pairs=[(a,b,c),(a,c,d)]
      for x,y,z in pairs:face(x,y,z,0 if layer=='O' else 1,si,pi) if winding==1 else face(x,z,y,0 if layer=='O' else 1,si,pi)
 write('FRAMES-PANELS.json',source);write('OWNERS-PANELS.json',{'vertices':owners,'stage':'eight finite panel grids before rim incidence guards','requests':requests,'reused':reused})
 with (P/'panels-reached.npz').open('xb') as f:np.savez_compressed(f,world64=np.asarray(vertices,np.float64),world32=np.asarray(vertices,np.float64).astype(np.float32),triangles=np.asarray(triangles,np.int32),face_role=np.asarray(roles,np.uint8),side=np.asarray(sides,np.uint8),panel=np.asarray(pieces,np.uint8),**grids)
 check((P/'panels-reached.npz').stat().st_size<=8388608,'Reached panel NPZ cap');R['finite_panels_preserved']=True
 outeredges={}
 for fi,row in enumerate(triangles):
  if roles[fi]!=0:continue
  for u,v in zip(row,row[1:]+row[:1]):outeredges.setdefault((min(u,v),max(u,v)),[]).append((u,v))
 boundary=[x[0] for x in outeredges.values() if len(x)==1];R['outer_boundary_count']=len(boundary);check(len(boundary)==192,'Exact outer cap/wrist boundary count',{'observed':len(boundary),'expected':192,'first_edges':boundary[:4]})
 for u,v in boundary:
  ou,ov=owners[u],owners[v];check(ou['side']==ov['side'] and ou['i']==ov['i'] and ou['i'] in [0,64],'Owned exterior end edge',{'edge':[u,v],'owner_u':ou,'owner_v':ov});iu=lookup[ou['key'].replace('|O|','|I|')];iv=lookup[ov['key'].replace('|O|','|I|')];side=0 if ou['side']=='r' else 1;role=2 if ou['i']==0 else 3;face(v,u,iu,role,side,255);face(v,iu,iv,role,side,255)
 v64=np.asarray(vertices,dtype=np.float64);v32=v64.astype(np.float32);tri=np.asarray(triangles,dtype=np.int32);role=np.asarray(roles,np.uint8);sid=np.asarray(sides,np.uint8);piece=np.asarray(pieces,np.uint8)
 check(len(v64)<=20000 and len(tri)<=50000 and np.isfinite(v64).all() and np.isfinite(v32).all(),'Finite bounded mesh buffers')
 arrays={'world64':v64,'world32':v32,'triangles':tri,'face_role':role,'side':sid,'panel':piece,**grids};write('SOURCE-EVALUATED.json',source);write('OWNERS.json',{'vertices':owners,'canonical_requests':requests,'canonical_reuses':reused,'rim_rule':'exterior u→v maps quad[v,u,Iu,Iv]','scope':'Declared mesh ownership only, no body association query'})
 with (P/'mesh.npz').open('xb') as f:np.savez_compressed(f,**arrays)
 check((P/'mesh.npz').stat().st_size<=8388608,'NPZ cap');R['arrays']={k:{'shape':list(a.shape),'dtype':str(a.dtype),'raw_sha256':sha(np.ascontiguousarray(a).tobytes())} for k,a in arrays.items()};R.update({'vertices':len(v64),'triangles':len(tri),'canonical_requests':requests,'canonical_reuses':reused,'role_counts':{str(k):int(np.count_nonzero(role==k)) for k in [0,1,2,3]},'cast_error':float(np.max(np.abs(v64-v32.astype(float))))});write('OBSERVED.json',R)
 with (P/'sleeves.obj').open('x') as f:
  f.write('# UNQUALIFIED standalone neutral sleeves; body/self/coverage/pose/appearance UNKNOWN\n')
  for x,y,z in v32:f.write(f'v {float(x):.9g} {float(y):.9g} {float(z):.9g}\n')
  for i,(a,b,c) in enumerate(tri):f.write(f'g side{int(sid[i])}_role{int(role[i])}_panel{int(piece[i])}\nf {a+1} {b+1} {c+1}\n')
 check((P/'sleeves.obj').stat().st_size<=8388608,'OBJ cap');R['raw_geometry_preserved']=True
 check(len(v64)==12480 and len(tri)==24960 and requests==13000 and reused==520,'Expected exact grid/welding counts');check(np.all(np.bincount(tri.ravel(),minlength=len(v64))>0),'All vertices used')
 R['minimum_twice_area']={}
 for name,v in [('F64',v64),('F32',v32.astype(float))]:
  vec=np.cross(v[tri[:,1]]-v[tri[:,0]],v[tri[:,2]]-v[tri[:,0]]);areas=np.linalg.norm(vec,axis=1);R['minimum_twice_area'][name]=float(areas.min());bad=np.flatnonzero(~np.isfinite(areas)|(areas<=0));check(not len(bad),'Positive represented triangle areas '+name,{'first_triangle':int(bad[0]) if len(bad) else None,'minimum':float(areas.min()),'indices':tri[bad[0]].tolist() if len(bad) else None})
 R['topology']=topology(v32,tri);clock();pins();R['passed']=True;R['post_pins']=True
except Exception as ex:
 R['error']={'type':type(ex).__name__,'message':str(ex)}
 try:
  if 'vertices' in globals() and vertices:
   partial=np.asarray(vertices,np.float64);check(len(partial)<=20000 and np.isfinite(partial).all(),'Bounded finite failure geometry')
   with (P/'failure-reached.npz').open('xb') as f:np.savez_compressed(f,world64=partial,world32=partial.astype(np.float32),triangles=np.asarray(triangles,np.int32).reshape(-1,3),face_role=np.asarray(roles,np.uint8),side=np.asarray(sides,np.uint8),panel=np.asarray(pieces,np.uint8))
   check((P/'failure-reached.npz').stat().st_size<=8388608,'Failure NPZ cap');write('FAILURE-REACHED.json',{'stage':'reached finite geometry on refusal; may lack rims/complete chart','owners':owners,'frames':source,'requests':requests,'reuse':reused,'original_error':R['error']});R['failure_geometry_preserved']=True
 except Exception as failure:R['failure_persistence_error']={'type':type(failure).__name__,'message':str(failure)}

finally:
 R['finished']=datetime.datetime.now(datetime.timezone.utc).isoformat();R['elapsed']=time.monotonic()-T0;R['limits']='Discrete eligibility only; source-body/field archives never decoded. No body/self/lining contact/separation/solid/coverage/torso/pose/appearance/finish acceptance.';write('RESULT.json',R);print(json.dumps({k:v for k,v in R.items() if k not in ['checks','arrays']}),flush=True)
 if not R['passed']:raise SystemExit(1)
