"""Independent saved raw mesh check: BFS edge graph and exact scaled dyadic integers."""
import collections,datetime,hashlib,json,math,os,pathlib,signal,sys,traceback
D=pathlib.Path(__file__).resolve().parent
now=lambda:datetime.datetime.now(datetime.timezone.utc).isoformat()
def pin(p):
 b=p.read_bytes();return {'path':str(p),'bytes':len(b),'sha256':hashlib.sha256(b).hexdigest()}
def main():
 job={'pid':os.getpid(),'started':now(),'source':pin(pathlib.Path(__file__)),'wallLimitSeconds':60}
 with (D/'ROOT-CHECK-JOB.json').open('x') as f:json.dump(job,f,indent=2)
 signal.alarm(60);result={};status='refused'
 try:
  run=json.loads((D/'RUN.json').read_text());assert run['status']=='refused' and run['exitCode']==1
  mapping=json.loads((D/'RETURN-METADATA-MAPPING.json').read_text())['mapping']
  for row in run['outputs']:
   p=pathlib.Path(row['path']);p=D/mapping[p.name] if p.name in mapping else p
   actual=pin(p);assert all(actual[k]==row[k] for k in ('bytes','sha256')),(row,actual)
  mesh=json.loads((D/'EXTRACTED.json').read_text());vs=mesh['vertices'];fs=mesh['faces']
  assert len(mesh['vertexProvenance'])==len(vs) and len(mesh['faceProvenance'])==len(fs)
  assert all(len(p)==3 and all(math.isfinite(x) for x in p) for p in vs)
  ratios=[[x.as_integer_ratio() for x in p] for p in vs];scale=max(b for p in ratios for a,b in p)
  assert scale&(scale-1)==0
  ps=[[a*(scale//b) for a,b in p] for p in ratios]
  edges={};used=set();faceset=set();volumes=[];minimum=None
  for i,f in enumerate(fs):
   assert len(f)==3 and len(set(f))==3 and all(0<=j<len(vs) for j in f),(i,f)
   key=tuple(sorted(f));assert key not in faceset;faceset.add(key);used.update(f)
   a,b,c=[ps[j] for j in f];u=[b[k]-a[k] for k in range(3)];v=[c[k]-a[k] for k in range(3)]
   cross=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]]
   a2=sum(x*x for x in cross);assert a2*10**36>4*scale**4,('area',i,a2)
   if minimum is None or a2<minimum[0]:minimum=(a2,i)
   volumes.append(a[0]*(b[1]*c[2]-b[2]*c[1])+a[1]*(b[2]*c[0]-b[0]*c[2])+a[2]*(b[0]*c[1]-b[1]*c[0]))
   for j in range(3):
    x,y=f[j],f[(j+1)%3];edges.setdefault(tuple(sorted((x,y))),[]).append((x,y,i))
  assert used==set(range(len(vs)))
  graph=[[] for f in fs]
  for e,rows in edges.items():
   assert len(rows)==2,(e,rows);a,b=rows;assert a[0]==b[1] and a[1]==b[0],(e,rows)
   graph[a[2]].append(b[2]);graph[b[2]].append(a[2])
  unseen=set(range(len(fs)));components=[]
  while unseen:
   start=min(unseen);unseen.remove(start);queue=collections.deque([start]);ids=[]
   while queue:
    i=queue.popleft();ids.append(i)
    for j in graph[i]:
     if j in unseen:unseen.remove(j);queue.append(j)
   ids.sort();vertices=sorted({v for i in ids for v in fs[i]});es={tuple(sorted((fs[i][j],fs[i][(j+1)%3]))) for i in ids for j in range(3)}
   xyz=[vs[i] for i in vertices];num=sum(volumes[i] for i in ids);den=6*scale**3
   components.append({'firstFace':start,'faces':len(ids),'vertices':len(vertices),'edges':len(es),'Euler':len(vertices)-len(es)+len(ids),'exactSignedVolume':{'n':str(num),'d':str(den)},'signedVolumeMetresCubedObserver':num/den,'bounds':[[min(p[k] for p in xyz) for k in range(3)],[max(p[k] for p in xyz) for k in range(3)]],'faceIDs':ids if len(ids)<=100 else {'first':ids[0],'last':ids[-1],'sha256':hashlib.sha256(json.dumps(ids).encode()).hexdigest()},'vertexIDs':vertices if len(vertices)<=100 else {'count':len(vertices)},'actualFaces':[[i,fs[i],mesh['faceProvenance'][i]] for i in ids] if len(ids)<=100 else None})
  refusal=json.loads((D/'REFUSAL.json').read_text())['operands'][0]
  assert len(fs)-components[0]['faces']==refusal['multipleComponents']
  assert min(c['firstFace'] for c in components[1:])==refusal['firstUnseen']
  result={'meshPin':pin(D/'EXTRACTED.json'),'V':len(vs),'F':len(fs),'E':len(edges),'allRawAreaIndexUniquenessUseClosedOpposedEdgeChecksPass':True,'minimumExactSquaredCross':{'n':str(minimum[0]),'d':str(scale**4),'face':minimum[1]},'components':components,'actualComponentCount':len(components),'unreachedFaceCount':len(fs)-components[0]['faces'],'refusalReproduced':True,'decision':'B original one-component source gate; no cuts/export/native/fit/appearance. Distinct shells verified, cause not diagnosed.'}
  status='complete'
 except BaseException as e:result={'exception':repr(e),'traceback':traceback.format_exc()}
 finally:
  signal.alarm(0);job.update(status=status,fullReturn=now());(D/'ROOT-CHECK.json').write_text(json.dumps({'job':job,'result':result},indent=2)+'\n');(D/'ROOT-CHECK-JOB.json').write_text(json.dumps(job,indent=2)+'\n')
  print(json.dumps({'status':status,'pid':job['pid'],'fullReturn':job['fullReturn'],'actualComponents':result.get('actualComponentCount'),'unreachedFaces':result.get('unreachedFaceCount')}))
 return 0 if status=='complete' else 1
if __name__=='__main__':raise SystemExit(main())
