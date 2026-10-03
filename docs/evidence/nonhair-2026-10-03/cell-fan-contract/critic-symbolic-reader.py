"""Validate actual symbolic output via definitions and directed vertex links; no P/M/S evaluation."""
from pathlib import Path
import json, hashlib, datetime, os, sys, collections
p=Path(__file__).parent;start=datetime.datetime.now(datetime.UTC).isoformat()
sha=lambda f:hashlib.sha256(Path(f).read_bytes()).hexdigest()
receipt=json.loads((p/'AUTHOR-RECEIPT.json').read_text());t=json.loads((p/'topology.json').read_text())
assert sha(p/'author.py')==receipt['authorSHA256']=='9c042becbab1312a2589fedb349a49f771194b736c55f109121cb67bcc219fe8'
assert sha(p/'topology.json')==receipt['topologySHA256']=='c057cc38b0e6cca4eb6d1d955f31b4b5263daf01260bfb65a21c218e93b4eeeb'
for f,h in receipt['pins'].items():assert sha(f)==h
net=json.loads(Path(t['sourceInterface']['path']).read_text())
assert sha(t['sourceInterface']['path'])==t['sourceInterface']['sha256']
assert t['N']==10 and len(t['vertices'])==8091 and len(t['faces'])==16000
sourcepatch={q['id']:(side,panel['futureOrientationSign'],q) for side,panel in net['panels'].items() for q in panel['patches']}
vertices=t['vertices'];bykey={v['key']:i for i,v in enumerate(vertices)};assert len(bykey)==len(vertices)
kinds=collections.Counter()
for v in vertices:
 assert set(v)=={'key','evaluation'};e=v['evaluation'];kind=e['kind'];kinds[kind]+=1
 if kind=='canonicalNode':
  assert set(e)=={'kind','node'} and e['node'] in net['nodes'] and v['key']=='node:'+e['node']
 elif kind=='canonicalCurve':
  assert set(e)=={'kind','edge','t'} and e['edge'] in net['edges'] and e['t'][1]==10 and e['t'][0] in range(1,10)
  assert v['key']==e['edge']+':'+str(e['t'][0])
 elif kind in ('CoonsPatch','CoonsCellCentre'):
  assert e['patch'] in sourcepatch
  if kind=='CoonsPatch':
   assert set(e)=={'kind','patch','u','v'} and e['u'][1]==e['v'][1]==10 and e['u'][0] in range(1,10) and e['v'][0] in range(1,10)
   assert v['key']==e['patch']+':'+str(e['v'][0])+':'+str(e['u'][0])
  else:
   assert set(e)=={'kind','patch','cell','u','v'};r,c=e['cell'];assert r in range(10) and c in range(10)
   assert e['u']==[2*c+1,20] and e['v']==[2*r+1,20]
   assert v['key']==f"centre:{e['patch']}:{r}:{c}"
 else:raise AssertionError(kind)
assert kinds=={'canonicalNode':50,'canonicalCurve':801,'CoonsPatch':3240,'CoonsCellCentre':4000}
assert set(t['canonicalEdgeCache'])==set(net['edges'])
for eid,row in t['canonicalEdgeCache'].items():
 assert len(row)==11 and len(set(row))==11
 for k,index in enumerate(row):
  expected='node:'+net['edges'][eid]['endpoints'][0 if k==0 else 1] if k in (0,10) else eid+':'+str(k)
  assert index==bykey[expected]
patches={q['id']:q for q in t['patches']};assert len(patches)==40 and set(patches)==set(sourcepatch)
facecursor=0;cornerWitness={}
for q in t['patches']:
 side,sign,source=sourcepatch[q['id']];assert q['side']==side and q['orientation']==sign
 assert len(q['grid'])==11 and all(len(row)==11 for row in q['grid'])
 for r,row in enumerate(q['grid']):
  for c,index in enumerate(row):
   borders=[]
   for cond,edge,k in [(r==0,'south',c),(r==10,'north',c),(c==0,'west',r),(c==10,'east',r)]:
    if cond:
     ref=source[edge];borders.append(t['canonicalEdgeCache'][ref['id']][k if ref['orientation']==1 else 10-k])
   assert index==(borders[0] if borders else bykey[f"{q['id']}:{r}:{c}"])
   assert not borders or all(x==index for x in borders)
 assert len(q['centres'])==10 and all(len(row)==10 for row in q['centres'])
 for r in range(10):
  for c in range(10):
   m=q['centres'][r][c];assert m==bykey[f"centre:{q['id']}:{r}:{c}"]
   a,b,z,d=q['grid'][r][c],q['grid'][r][c+1],q['grid'][r+1][c+1],q['grid'][r+1][c]
   assert len({a,b,z,d,m})==5
   expected=[[a,b,m],[b,z,m],[z,d,m],[d,a,m]] if sign==1 else [[a,m,b],[b,m,z],[z,m,d],[d,m,a]]
   assert t['faces'][facecursor:facecursor+4]==expected
   if q['id'] in ('minusX:0:3','plusX:0:3') and [r,c]==[0,9]:cornerWitness[q['id']]={'centre':m,'key':vertices[m]['key'],'firstOrdinal':facecursor,'faces':expected}
   facecursor+=4
assert facecursor==16000
edgeuses=collections.defaultdict(list);successors=collections.defaultdict(dict);predecessors=collections.defaultdict(dict);centreuses=collections.Counter();seen=set();adj=collections.defaultdict(set)
for ordinal,face in enumerate(t['faces']):
 assert all(type(v)==int and 0<=v<8091 for v in face) and len(set(face))==3
 identity=tuple(sorted(face));assert identity not in seen;seen.add(identity)
 centres=[v for v in face if vertices[v]['evaluation']['kind']=='CoonsCellCentre'];assert len(centres)==1;centreuses[centres[0]]+=1
 for k,v in enumerate(face):
  a,b=face[(k+1)%3],face[(k+2)%3]
  assert a not in successors[v] and b not in predecessors[v]
  successors[v][a]=b;predecessors[v][b]=a
  edgeuses[tuple(sorted((v,a)))].append((v,a));adj[v].add(a);adj[a].add(v)
assert len(centreuses)==4000 and set(centreuses.values())=={4}
boundary=collections.defaultdict(set)
for (a,b),uses in edgeuses.items():
 assert len(uses) in (1,2)
 if len(uses)==2:assert uses[0]==uses[1][::-1]
 else:boundary[a].add(b);boundary[b].add(a)
def connected(graph,start):
 seen=set();todo=[start]
 while todo:
  v=todo.pop()
  if v not in seen:seen.add(v);todo.extend(graph[v]-seen)
 return seen
assert len(edgeuses)==24090 and 8091-len(edgeuses)+16000==1
assert len(connected(adj,0))==8091 and len(boundary)==180 and all(len(v)==2 for v in boundary.values())
assert len(connected(boundary,next(iter(boundary))))==180
links=collections.Counter();lengths=[]
for vertex in range(8091):
 successor=successors[vertex];pred=predecessors[vertex];nodes=set(successor)|set(pred);starts=nodes-set(pred);ends=nodes-set(successor)
 if vertex in boundary:
  assert len(starts)==len(ends)==1 and starts|ends==boundary[vertex]
  v=next(iter(starts));walk=[]
  while v in successor:
   assert v not in walk;walk.append(v);v=successor[v]
  walk.append(v);assert v in ends and set(walk)==nodes;links['boundaryPaths']+=1
 else:
  assert not starts and not ends;v=next(iter(nodes));initial=v;walk=[]
  while v not in walk:walk.append(v);v=successor[v]
  assert v==initial and set(walk)==nodes;links['interiorCycles']+=1
 lengths.append(len(nodes))
assert links=={'boundaryPaths':180,'interiorCycles':7911}
assert cornerWitness['minusX:0:3']['centre']==4400 and cornerWitness['plusX:0:3']['centre']==6400
assert set(successors[40])=={39,282,4400,6400}
out={'command':'python3 docs/evidence/nonhair-2026-10-03/cell-fan-contract/critic-symbolic-reader.py','pid':os.getpid(),'started':start,'finished':datetime.datetime.now(datetime.UTC).isoformat(),'interpreter':sys.executable,'pythonVersion':sys.version,'sourceSHA256':sha(__file__),'authorSHA256':sha(p/'author.py'),'topologySHA256':sha(p/'topology.json'),'authorReceiptSHA256':sha(p/'AUTHOR-RECEIPT.json'),'allAuthorPinsUnchanged':len(receipt['pins']),'definitionsByKind':dict(kinds),'all8091DefinitionsAnd89CachesExact':True,'all40Grids4000Centres16000OrientedFanFacesExact':True,'uniqueFaces':len(seen),'edges':len(edgeuses),'outerEdges':180,'Euler':1,'directedLinks':dict(links),'linkNodeRange':[min(lengths),max(lengths)],'formerFailedCorner':cornerWitness,'part4DirectedLink':successors[40],'status':'PASS complete symbolic oriented disk only','limits':'No P/M/curve/Coons position/normal/contact/body/attachment/native/appearance evaluation; no geometry written'}
with (p/'CRITIC-READBACK.json').open('x') as f:json.dump(out,f,indent=2);f.write('\n')
print(json.dumps(out))
