"""One symbolic fan complex. No positions, curves, Coons interiors or geometry evaluated."""
from pathlib import Path
import json,hashlib,datetime,os,collections
p=Path('docs/evidence/nonhair-2026-10-03/cell-fan-contract');source=Path('docs/evidence/nonhair-2026-10-03/shared-boundary-interface/interface.json');start=datetime.datetime.now(datetime.timezone.utc).isoformat();sha=lambda q:hashlib.sha256(q.read_bytes()).hexdigest()
receipt={'pid':os.getpid(),'command':'python3 docs/evidence/nonhair-2026-10-03/cell-fan-contract/author.py','started':start,'authorSHA256':sha(Path(__file__)),'status':'pending symbolic authorship','limits':['No P/M/S/curve/interior/position/normal/contact/body/attachment/native/appearance evaluation.','Combinatorial disk/vertex links do not prove regular embedding, area, nonintersection or fit.']}
assert not(p/'AUTHOR-RECEIPT.json').exists();(p/'AUTHOR-RECEIPT.json').write_text(json.dumps(receipt,indent=2)+'\n')
try:
 assert start<'2026-10-03T19:09:00' and sha(source)=='e734947c8e594b7396bf5f4359c0979b569d9ead92554a9b9a3d656b69248c2c'
 pins={str(source):sha(source),'docs/evidence/nonhair-2026-10-03/whole-head-volume/BUILD-RECEIPT.json':'2c3523941089801e9130740721c153ff3bc1eaee017b9fa3b5ae945064ddd271',str(p/'PLAN.md'):sha(p/'PLAN.md'),str(p/'CRITIC-VALUE.md'):'b0742cb7545145fc5eda25a8818680f52c9442c5a7d9f95c9ec1a2d150d6151e'}
 for f,h in pins.items():assert sha(Path(f))==h,f
 net=json.loads(source.read_text());assert len(net['nodes'])==50 and len(net['edges'])==89 and list(net['panels'])==['minusX','plusX'];N=10;vertices=[];cache={};edges={};patches=[];faces=[]
 def add(key,rule):
  if key in cache:return cache[key]
  index=len(vertices);cache[key]=index;vertices.append({'key':key,'evaluation':rule});return index
 for eid,e in net['edges'].items():
  row=[]
  for k in range(N+1):
   if k in[0,N]:
    node=e['endpoints'][0 if k==0 else 1];assert node in net['nodes'];key='node:'+node;rule={'kind':'canonicalNode','node':node}
   else:key=eid+':'+str(k);rule={'kind':'canonicalCurve','edge':eid,'t':[k,N]}
   row.append(add(key,rule))
  edges[eid]=row
 assert len(vertices)==851
 def edge(ref,k):assert ref['orientation']in[-1,1];return edges[ref['id']][k if ref['orientation']==1 else N-k]
 for side,panel in net['panels'].items():
  assert panel['futureOrientationSign']==(1 if side=='minusX'else -1) and len(panel['patches'])==20
  for q in panel['patches']:
   grid=[]
   for j in range(N+1):
    row=[]
    for i in range(N+1):
     border=[]
     for cond,name,k in[(j==0,'south',i),(j==N,'north',i),(i==0,'west',j),(i==N,'east',j)]:
      if cond:border.append(edge(q[name],k))
     if border:assert all(x==border[0]for x in border);index=border[0]
     else:index=add(q['id']+':'+str(j)+':'+str(i),{'kind':'CoonsPatch','patch':q['id'],'u':[i,N],'v':[j,N]})
     row.append(index)
    grid.append(row)
   patches.append({'id':q['id'],'side':side,'orientation':panel['futureOrientationSign'],'grid':grid,'centres':[]})
 assert len(vertices)==4091
 for q in patches:
  for j in range(N):
   row=[]
   for i in range(N):
    m=add('centre:'+q['id']+':'+str(j)+':'+str(i),{'kind':'CoonsCellCentre','patch':q['id'],'cell':[j,i],'u':[2*i+1,2*N],'v':[2*j+1,2*N]});row.append(m)
    a,b,c,d=q['grid'][j][i],q['grid'][j][i+1],q['grid'][j+1][i+1],q['grid'][j+1][i];assert len({a,b,c,d,m})==5
    fan=[[a,b,m],[b,c,m],[c,d,m],[d,a,m]]if q['orientation']==1 else[[a,m,b],[b,m,c],[c,m,d],[d,m,a]]
    faces.extend(fan)
   q['centres'].append(row)
 assert len(vertices)==8091 and len(faces)==16000
 uses=collections.defaultdict(list);adj=collections.defaultdict(set);linkEdges=collections.defaultdict(list);seen=set();centreUses=collections.Counter()
 for ordinal,face in enumerate(faces):
  assert len(set(face))==3 and all(0<=v<len(vertices)for v in face);key=tuple(sorted(face));assert key not in seen;seen.add(key)
  centres=[v for v in face if vertices[v]['evaluation']['kind']=='CoonsCellCentre'];assert len(centres)==1;centreUses[centres[0]]+=1
  for k in range(3):
   a,b,c=face[k],face[(k+1)%3],face[(k+2)%3];uses[tuple(sorted([a,b]))].append((a,b));adj[a].add(b);adj[b].add(a);linkEdges[a].append(tuple(sorted([b,c])))
 assert len(centreUses)==4000 and set(centreUses.values())=={4}
 boundary=collections.defaultdict(set);boundaryEdgeCount=0
 for key,occ in uses.items():
  assert len(occ)in[1,2]
  if len(occ)==2:assert occ[0]==tuple(reversed(occ[1]))
  else:a,b=key;boundary[a].add(b);boundary[b].add(a);boundaryEdgeCount+=1
 def reach(adj,start):
  done=set();todo=[start]
  while todo:
   v=todo.pop()
   if v not in done:done.add(v);todo.extend(adj[v]-done)
  return done
 assert len(uses)==24090 and len(vertices)-len(uses)+len(faces)==1 and len(reach(adj,0))==len(vertices)
 assert boundaryEdgeCount==len(boundary)==180 and all(len(a)==2 for a in boundary.values())and len(reach(boundary,next(iter(boundary))))==180
 links=collections.Counter();linkRange=[]
 for vertex,elist in linkEdges.items():
  assert len(elist)==len(set(elist));L=collections.defaultdict(set)
  for a,b in elist:L[a].add(b);L[b].add(a)
  assert len(reach(L,next(iter(L))))==len(L)
  degrees=[len(a)for a in L.values()]
  if vertex in boundary:assert degrees.count(1)==2 and all(d in[1,2]for d in degrees);links['boundaryPaths']+=1
  else:assert all(d==2 for d in degrees);links['interiorCycles']+=1
  linkRange.append(len(L))
 assert links=={'boundaryPaths':180,'interiorCycles':7911}
 contract={'kind':'symbolic cell-owned four-fan source contract; no numeric embedding','sourceInterface':{'path':str(source),'sha256':pins[str(source)]},'N':N,'vertices':vertices,'canonicalEdgeCache':edges,'patches':patches,'faces':faces,'evaluationPolicy':'Canonical endpoints return original node P. Canonical edge samples evaluated once per stored curve/t, one Float32 record reused by index. Patch grid interiors and cell centres evaluate unchanged exact Coons formula from source interface at declared rational u/v, once Float64 then Float32. No evaluation occurred in this source contract.','winding':'minusX faces (a,b,m),(b,c,m),(c,d,m),(d,a,m); plusX reverses each, (a,m,b),(b,m,c),(c,m,d),(d,m,a)','futureConditions':['Finite/nonzero Float32 geometry, normals and full actual intersections/attachment/source/config/pose/lifecycle/native original-image qualification required separately.','Logical point uniqueness does not promise distinct positions, regularity, C1 or absence of adjacent folds/containment.']}
 assert datetime.datetime.now(datetime.timezone.utc).isoformat()<'2026-10-03T19:09:00'
 (p/'topology.json').write_text(json.dumps(contract,separators=(',',':'))+'\n')
 receipt.update({'status':'symbolic complete oriented disk/fan ownership/vertex links passed; no geometry admission','pins':pins,'topologySHA256':sha(p/'topology.json'),'vertices':len(vertices),'faces':len(faces),'edges':len(uses),'outerEdges':boundaryEdgeCount,'centreOwners':len(centreUses),'links':dict(links),'linkNodeRange':[min(linkRange),max(linkRange)],'allSortedFaceTriplesUnique':True,'allInternalEdgesOpposed':True,'connectedComplexAndBoundary':True,'everyCentreOwnsFourFaces':True})
except Exception as e:receipt.update({'status':'refused symbolic contract','error':repr(e)});raise
finally:receipt['finished']=datetime.datetime.now(datetime.timezone.utc).isoformat();(p/'AUTHOR-RECEIPT.json').write_text(json.dumps(receipt,indent=2)+'\n');print(json.dumps(receipt))
