"""Independent stored-result consumer: scalar frames and de Casteljau curves."""
from pathlib import Path
import json,math,hashlib,collections,datetime
import numpy as np
P=Path(__file__).resolve().parent;E=json.loads((P/'EXEC.json').read_text());S=json.loads(Path(E['recipe']).read_text());R=json.loads((P/'RESULT.json').read_text());J=json.loads((P/'JOB.json').read_text())
assert R['passed'] and J['exit_code']==0 and J['worker_passed'] and all(J['timing'].values())
A=np.load(P/'mesh.npz',allow_pickle=False);O=json.loads((P/'OWNERS.json').read_text());V=A['world64'];T=A['triangles'];assert len(V)==12480 and T.shape==(24960,3)
for name,a in A.items():assert R['arrays'][name]=={'shape':list(a.shape),'dtype':str(a.dtype),'raw_sha256':hashlib.sha256(np.ascontiguousarray(a).tobytes()).hexdigest()}
assert A['world32'].tobytes()==V.astype(np.float32).tobytes();assert O['canonical_requests']==13000 and O['canonical_reuses']==520

def add(a,b):return tuple(x+y for x,y in zip(a,b))
def sub(a,b):return tuple(x-y for x,y in zip(a,b))
def mul(a,k):return tuple(x*k for x in a)
def dot(a,b):return math.fsum(x*y for x,y in zip(a,b))
def norm(a):return math.sqrt(dot(a,a))
def unit(a):return mul(a,1/norm(a))
def cross(a,b):return (a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0])
def mix(a,b,t):return add(mul(a,1-t),mul(b,t))
def casteljau(ctrl,t):
 if t==0:return ctrl[0]
 if t==1:return ctrl[-1]
 row=list(ctrl)
 while len(row)>1:row=[mix(row[i],row[i+1],t) for i in range(len(row)-1)]
 return row[0]
def rr(s,k,D):
 if s in [0,.5,1]:return k[int(s*2)]
 i=0 if s<.5 else 1;q=2*s-i;ctrl=[k[i],add(k[i],mul(D[i],1/3)),sub(k[i+1],mul(D[i+1],1/3)),k[i+1]];return casteljau(ctrl,q)
def pp(s,t,data,piece):
 F,B,D,ar=data['F'],data['B'],data['D'],data['arches'][piece];L,RR=(F,B) if piece=='upper' else (B,F)
 if t==0:return rr(s,L,D)
 if t==1:return rr(s,RR,D)
 if s==0:return casteljau(ar[0],t)
 if s==1:return casteljau(ar[1],t)
 return add(mix(rr(s,L,D),rr(s,RR,D),t),add(mul(sub(casteljau(ar[0],t),mix(L[0],RR[0],t)),1-s),mul(sub(casteljau(ar[1],t),mix(L[2],RR[2],t)),s)))
source={}
for sr in S['references']:
 p0,p1,p2=[tuple(sr[k]['coordinate']) for k in ['P0_reference','P1_reference','P2_reference']];n0=unit(sub(p1,p0));n2=unit(tuple(sr['cuff_plane_normal']));ns=[n0,unit(add(n0,n2)),n2];qs=[sub(p0,mul(n0,.040)),p1,p2];u=[unit(sub((0.,-1.,0.),mul(n,dot((0.,-1.,0.),n)))) for n in ns];w=[mul(cross(n,a),sr['upper_piece_frame_sign']) for n,a in zip(ns,u)];l0,l1=norm(sub(p1,p0)),norm(sub(p2,p1));D=[mul(n0,.60*l0),mul(ns[1],.60*min(l0,l1)),mul(n2,.60*l1)]
 for layer,profile in S['profiles'].items():
  F=[add(q,mul(a,b)) for q,a,b in zip(qs,u,profile['front_width'])];B=[sub(q,mul(a,b)) for q,a,b in zip(qs,u,profile['back_width'])];ar={'upper':[],'under':[]}
  for idx,node in enumerate([0,2]):
   f,b=F[node],B[node];step=mul(sub(b,f),1/3);ar['upper'].append([f,add(add(f,step),mul(w[node],profile['upper_arch_handle'][idx])),add(sub(b,step),mul(w[node],profile['upper_arch_handle'][idx])),b]);step=mul(sub(f,b),1/3);ar['under'].append([b,sub(add(b,step),mul(w[node],profile['under_arch_handle'][idx])),sub(sub(f,step),mul(w[node],profile['under_arch_handle'][idx])),f])
  source[sr['side'],layer]={'F':F,'B':B,'D':D,'arches':ar}
maxdelta=0
for idx,o in enumerate(O['vertices']):
 d=source[o['side'],o['layer']];s=o['i']/64
 q=rr(s,d[o['seam']],d['D']) if o['seam'] else pp(s,o['j']/24,d,o['piece'])
 maxdelta=max(maxdelta,max(abs(a-b) for a,b in zip(q,V[idx])))
assert maxdelta<=1e-12
expected=[];role=[];side=[];piece=[]
for sr in S['references']:
 si=0 if sr['side']=='r' else 1
 for layer in ['O','I']:
  wind=sr['outer_chart_winding'] if layer=='O' else sr['inner_material_chart_winding']
  for pn,pi in [('upper',0),('under',1)]:
   g=A[sr['side']+'_'+layer+'_'+pn]
   for i in range(64):
    for j in range(24):
     a,b,c,d=[int(x) for x in [g[i,j],g[i+1,j],g[i+1,j+1],g[i,j+1]]]
     for tr in [(a,b,c),(a,c,d)]:expected.append(tr if wind==1 else (tr[0],tr[2],tr[1]));role.append(0 if layer=='O' else 1);side.append(si);piece.append(pi)
assert np.array_equal(T[:24576],np.array(expected,np.int32)) and np.array_equal(A['face_role'][:24576],role) and np.array_equal(A['side'][:24576],side) and np.array_equal(A['panel'][:24576],piece)
assert collections.Counter(map(int,A['face_role']))=={0:12288,1:12288,2:192,3:192}
for sr in S['references']:
 for layer in ['O','I']:
  u=A[sr['side']+'_'+layer+'_upper'];d=A[sr['side']+'_'+layer+'_under'];assert np.array_equal(u[:,0],d[:,24]) and np.array_equal(u[:,24],d[:,0])
# Independent sorted edge table and union-find, then local link-cycle walks.
edges=collections.defaultdict(list);parent=list(range(len(V)));links=[collections.defaultdict(list) for _ in V]
def find(x):
 while parent[x]!=x:parent[x]=parent[parent[x]];x=parent[x]
 return x
for fi,row in enumerate(T.tolist()):
 assert len(set(row))==3 and min(row)>=0 and max(row)<len(V)
 for i in range(3):
  u,v=row[i],row[(i+1)%3];edges[tuple(sorted((u,v)))].append((u,v));parent[find(v)]=find(u)
  other=[row[(i+1)%3],row[(i+2)%3]];links[u][other[0]].append(other[1]);links[u][other[1]].append(other[0])
assert len(edges)==37440 and all(len(x)==2 and x[0]==x[1][::-1] for x in edges.values())
for link in links:
 assert all(len(n)==2 for n in link.values());start=next(iter(link));prev=None;at=start;visited=set()
 while at not in visited:
  visited.add(at);n=link[at];nxt=n[0] if n[0]!=prev else n[1];prev,at=at,nxt
 assert at==start and len(visited)==len(link)
comps=collections.Counter(find(i) for i in range(len(V)));assert sorted(comps.values())==[6240,6240]
mins={}
for name,v in [('F64',V),('F32',A['world32'].astype(float))]:
 a=v[T[:,1]]-v[T[:,0]];b=v[T[:,2]]-v[T[:,0]];aa=np.einsum('ij,ij->i',a,a);bb=np.einsum('ij,ij->i',b,b);ab=np.einsum('ij,ij->i',a,b);gram=aa*bb-ab*ab;assert (gram>0).all();mins[name]=float(np.sqrt(gram).min())
lines=(P/'sleeves.obj').read_text().splitlines();verts=[];faces=[];groups=[];group=None
for line in lines:
 if line.startswith('v '):verts.append([float(x) for x in line.split()[1:]])
 elif line.startswith('g '):group=line[2:]
 elif line.startswith('f '):faces.append([int(x)-1 for x in line.split()[1:]]);groups.append(group)
assert np.asarray(verts,np.float32).tobytes()==A['world32'].tobytes() and np.asarray(faces,np.int32).tobytes()==T.tobytes()
assert all(g==f'side{int(A["side"][i])}_role{int(A["face_role"][i])}_panel{int(A["panel"][i])}' for i,g in enumerate(groups))
for r in E['pins']:
 b=Path(r['path']).read_bytes();assert len(b)==r['bytes'] and hashlib.sha256(b).hexdigest()==r['sha256']
(P/'ROOT-RESULT.json').write_text(json.dumps({'utc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'passed':True,'alternate_scalar_decasteljau_all12480owners_maxdelta':maxdelta,'triangles_roles_side_panel_obj_seams_exact':True,'edges':len(edges),'components':list(comps.values()),'vertex_links_allclosed':True,'positive_gram_min_twice_area':mins,'all_execution_pins_exact':True,'limits':'Stored discrete geometry only. No body/fields archive decode, body/self contact/solid/coverage/torso/pose/appearance qualification.'},indent=2)+'\n');print('ROOT STORED RESULT PASS',maxdelta)
