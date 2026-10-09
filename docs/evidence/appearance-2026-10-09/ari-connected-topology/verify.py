"""Independent literal-symbol face census and closed-star permutation proof."""
from pathlib import Path
from collections import Counter, defaultdict
import json,hashlib,datetime
P=Path(__file__).resolve().parent
T=json.loads((P/'TOPOLOGY.json').read_text());R=json.loads((P/'RESULT.json').read_text())
V=list(map(tuple,T['vertex_symbols'])); ids={s:i for i,s in enumerate(V)}
assert len(ids)==len(V)==806
grid=set()
for y in range(12):
 for x in range(24):
  if y in range(6,10) and (x in range(4,8) or x in range(16,20)):continue
  grid.update(('torso',a,b) for a,b in [(x,y),(x+1,y),(x+1,y+1),(x,y+1)])
symbols=grid|{('sleeve',s,k,j) for s in ['left','right'] for k in range(1,4) for j in range(16)}
assert set(V)==symbols|{('inner',)+s for s in symbols}
assert set(V[:403])==symbols and V[403:]==[('inner',)+s for s in V[:403]]
def canon(t):return min(tuple(t[i:]+t[:i]) for i in range(3))
expected=[];owners=[]
def quad(syms,owner):
 a,b,c,d=[ids[s] for s in syms]
 expected.extend([[a,b,c],[a,c,d]]);owners.extend([owner,owner])
for y in range(12):
 for x in range(24):
  if y in range(6,10) and (x in range(4,8) or x in range(16,20)):continue
  quad([('torso',a,b) for a,b in [(x,y),(x+1,y),(x+1,y+1),(x,y+1)]],'outer-torso')
holes={}
for side,x in [('left',4),('right',16)]:
 h=[('torso',a,6) for a in range(x+4,x-1,-1)]+[('torso',x,b) for b in range(7,11)]+[('torso',a,10) for a in range(x+1,x+5)]+[('torso',x+4,b) for b in range(9,6,-1)]
 assert len(h)==16
 k=min(range(16),key=lambda j:ids[h[j]]);h=h[k:]+h[:k];holes[side]=h
 rings=[h]+[[('sleeve',side,k,j) for j in range(16)] for k in range(1,4)]
 for prev,curr in zip(rings,rings[1:]):
  for j in range(16):
   n=(j+1)%16;quad([prev[n],prev[j],curr[j],curr[n]],'outer-sleeve-'+side)
 assert T['armhole_attachments'][['left','right'].index(side)]['all_outer_rings']==[[ids[s] for s in ring] for ring in rings]
outer=[t[:] for t in expected];outer_owners=owners[:]
expected.extend([[v+403 for v in t[::-1]] for t in outer]);owners.extend(s.replace('outer-','lining-',1) for s in outer_owners)
boundary=[]
for x in range(24):
 boundary.extend([(('torso',x,0),('torso',x+1,0),'hem'),(('torso',x+1,12),('torso',x,12),'neckline')])
for y in range(12):
 boundary.extend([(('torso',0,y+1),('torso',0,y),'front-left'),(('torso',24,y),('torso',24,y+1),'front-right')])
for side in ['left','right']:
 for j in range(16):boundary.append((('sleeve',side,3,j),('sleeve',side,3,(j+1)%16),'wrist-'+side))
for a,b,role in boundary:quad([b,a,('inner',)+a,('inner',)+b],'rim-'+role)
actual=T['triangles'];actual_owners=T['triangle_owners']
assert len(actual)==1616 and Counter(zip(map(canon,actual),actual_owners))==Counter(zip(map(canon,expected),owners))
assert Counter(map(canon,actual[:704]))==Counter(map(canon,outer))
assert len(T['external_boundary_edges'])==104
assert Counter((tuple(e['outer_edge']),tuple(e['inner_edge']),e['role']) for e in T['external_boundary_edges'])==Counter(((ids[a],ids[b]),(ids[b]+403,ids[a]+403),role) for a,b,role in boundary)
E=defaultdict(list);stars=[{} for _ in V];parents=list(range(1616))
def find(a):
 while parents[a]!=a:parents[a]=parents[parents[a]];a=parents[a]
 return a
for fi,t in enumerate(actual):
 assert all(type(v)==int and 0<=v<806 for v in t) and len(set(t))==3
 for j,v in enumerate(t):
  a,b=t[(j+1)%3],t[(j+2)%3]
  assert a not in stars[v];stars[v][a]=b
 for j,a in enumerate(t):
  b=t[(j+1)%3];E[min(a,b),max(a,b)].append((a,b,fi))
for inc in E.values():
 assert len(inc)==2 and inc[0][:2]==inc[1][:2][::-1]
 a,b=map(find,[inc[0][2],inc[1][2]]);parents[a]=b
assert len(E)==2424 and len({find(a) for a in range(1616)})==1
for star in stars:
 assert star and set(star)==set(star.values())
 start=min(star);seen=set();v=start
 while v not in seen:seen.add(v);v=star[v]
 assert v==start and seen==set(star)
for a in T['armhole_attachments']:
 side=a['side'];h=[ids[s] for s in holes[side]]
 assert a['outer_shared_ring']==h and a['inner_shared_ring']==[v+403 for v in h]
 for edge in a['shared_edge_faces']:
  inc=E[tuple(sorted(edge['edge']))]
  assert edge['triangles']==[r[2] for r in inc]
  assert Counter(actual_owners[r[2]] for r in inc)==Counter(['outer-torso','outer-sleeve-'+side])
  inner=E[tuple(sorted(v+403 for v in edge['edge']))]
  assert Counter(actual_owners[r[2]] for r in inner)==Counter(['lining-torso','lining-sleeve-'+side])
assert 806-len(E)+1616==-2
b=(P/'TOPOLOGY.json').read_bytes();assert len(b)==R['topology_bytes'] and hashlib.sha256(b).hexdigest()==R['topology_sha256']
for r in json.loads((P/'EXEC.json').read_text()):
 b=Path(r['path']).read_bytes();assert len(b)==r['bytes'] and hashlib.sha256(b).hexdigest()==r['sha256']
result={'utc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'independent_literal_faces':1616,'closed_vertex_star_cycles':806,'opposite_edges':2424,'components':1,'shared_outer_and_inner_edges':64,'rim_edges':104,'euler':-2,'coordinates':'NONE/symbolic only','decision':'PASS topology only; global 3D registration/embedding/fit still required'}
with (P/'ROOT-RESULT.json').open('x') as f:json.dump(result,f,indent=2);f.write('\n')
print(json.dumps(result))
