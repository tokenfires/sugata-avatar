from pathlib import Path
import json,math,struct,hashlib,datetime,os,time
from collections import Counter,defaultdict
D=Path(__file__).resolve().parent
start=time.monotonic(); failures=[]
def gate(ok,label,witness=None):
 if not ok: failures.append({'gate':label,'witness':witness})
def sha(b): return hashlib.sha256(b).hexdigest()
def pin(p):
 b=p.read_bytes();return {'path':str(p),'bytes':len(b),'sha256':sha(b)}
mesh=(D/'export/mesh.json').read_bytes();m=json.loads(mesh);e=json.loads((D/'export/expected.json').read_text());P=m['positions'];F=m['triangles'];parts=m['parts'];roots=m['roots'];S=set(m['scalp']['head_face_ids'])
gate(len(P)==9580 and len(F)==19072 and len(parts)==22 and len(roots)==16 and len(S)==724,'actual counts')
gate(all(len(p)==3 and all(isinstance(x,(float,int)) and math.isfinite(x) for x in p) for p in P),'finite positions')
gate(all(len(f)==3 and len(set(f))==3 and all(type(v) is int and 0<=v<len(P) for v in f) for f in F),'valid indices')
gate(len({p['id'] for p in parts})==22,'unique parts')
gate(Counter(v for p in parts for v in p['vertex_ids'])==Counter(range(len(P))),'complete unique vertex partition')
gate(Counter(f for p in parts for f in p['face_ids'])==Counter(range(len(F))),'complete unique face partition')
def cross(a,b):return [a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]]
def dot(a,b):return sum(x*y for x,y in zip(a,b))
report=[]
for part in parts:
 V=set(part['vertex_ids']); ids=part['face_ids'];edges=defaultdict(list);adj=defaultdict(set);used=set();vol=0;area=math.inf
 for fi in ids:
  f=F[fi];gate(set(f)<=V,'face ownership',[part['id'],fi]);used.update(f)
  a,b,c=[P[v] for v in f];vol+=dot(a,cross(b,c))/6
  cr=cross([b[i]-a[i] for i in range(3)],[c[i]-a[i] for i in range(3)]);area=min(area,math.sqrt(dot(cr,cr))/2)
  for u,v in zip(f,f[1:]+f[:1]): edges[tuple(sorted((u,v)))].append((u,v));adj[u].add(v);adj[v].add(u)
 bad=[(k,us) for k,us in edges.items() if len(us)!=2 or us[0]!=(us[1][1],us[1][0])]
 gate(not bad,'two opposite uses',[part['id'],bad[:3]])
 seen=set();todo=[next(iter(V))]
 while todo:
  x=todo.pop()
  if x not in seen:seen.add(x);todo.extend(adj[x]-seen)
 chi=len(V)-len(edges)+len(ids)
 gate(seen==V==used,'connected and all used',part['id']);gate(chi==2 and vol>0 and area>1e-12,'Euler oriented volume area',[part['id'],chi,vol,area])
 ix=[v for fi in ids for v in F[fi]]; h=sha(struct.pack('<'+'I'*len(ix),*ix)); exp=e['parts'][len(report)]
 gate(exp=={'id':part['id'],'indexSha':h,'vertices':len(V),'triangles':len(ids)},'expected part bytes/counts',part['id'])
 report.append({'id':part['id'],'V':len(V),'T':len(ids),'E':len(edges),'chi':chi,'signed_volume':vol,'min_area':area,'indexSha':h})
head=parts[0];HV=set(head['vertex_ids']);HF=set(head['face_ids']);gate(S<=HF,'scalp face ownership')
gate({r['lock'] for r in roots}=={p['id'] for p in parts if p['kind']=='hair-lock'},'root-lock ownership')
for r in roots:
 part=next(p for p in parts if p['id']==r['lock']);anchor=r['head_vertex'];inc=[i for i in sorted(S) if anchor in F[i]];ctl=r['centers']
 gate(anchor in HV and r['root']==P[anchor] and r['scalp_incident_faces']==inc and bool(inc),'root/source face identity',r['lock'])
 gate(len(ctl)==5 and all(len(c)==3 and all(math.isfinite(x) for x in c) for c in ctl),'owned five finite centres',r['lock'])
 for key,ci in [('first_section_center_vertex',0),('tip_center_vertex',-1)]: gate(r[key] in part['vertex_ids'] and P[r[key]]==ctl[ci],'end-centre identity',[r['lock'],key])
 gate(r['samples']==25 and r['cross_section_sides']==12 and r['halfwidth']>0 and r['halfthickness']>0 and r['root_lift']==.145,'section declarations',r['lock'])
hair=[v for p in parts if p['kind'].startswith('hair') for v in p['vertex_ids']];minq=min((sum(((P[v][j]-m['head']['center'][j])/m['head']['radii'][j])**2 for j in range(3)),v) for v in hair);gate(minq[0]>=1-1e-10,'finite hair vertex ellipsoid',minq)
OV=[];OF=[];groups=[];rootcomments=[]
for line in (D/'export/groom.obj').read_text().splitlines():
 a=line.split()
 if not a:continue
 if a[0]=='v':OV.append([float(x) for x in a[1:]])
 elif a[0]=='g':groups.append({'id':a[1],'faces':[]})
 elif a[0]=='f':f=[int(x)-1 for x in a[1:]];OF.append(f);groups[-1]['faces'].append(f)
 elif line.startswith('# root '):rootcomments.append(line)
gate(OV==P and OF==F,'whole original OBJ numeric roundtrip')
gate(groups==[{'id':p['id'],'faces':[F[i] for i in p['face_ids']]} for p in parts],'all original groups and faces')
gate(rootcomments==[f"# root {r['lock']} head_vertex {r['head_vertex']+1} first_center {r['first_section_center_vertex']+1} tip {r['tip_center_vertex']+1}" for r in roots],'all original root comments')
flat=[x for p in P for x in p];positionSha=sha(struct.pack('<'+'f'*len(flat),*flat));bounds={'min':[min(p[j] for p in P) for j in range(3)],'max':[max(p[j] for p in P) for j in range(3)]}
gate(e['meshSha']==sha(mesh) and e['positionSha']==positionSha and e['bounds']==bounds,'exact saved JSON Float32 bounds')
job=json.loads((D/'CPU-JOB.json').read_text());req=json.loads((D/'CPU-JOB.requested.json').read_text());gate([c['command'] for c in job['children']]==req['commands'] and all(c['exit_code']==0 and c['reaped'] and not c['timeout'] for c in job['children']),'actual owned CPU commands/exits')
for c in job['children']:
 for k in ['stdout','stderr']:gate((D/c[k+'_file']).stat().st_size==c[k+'_bytes'],'full stdio byte counts',c['pid'])
report={'observed_utc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'observer_pid':os.getpid(),'elapsed_seconds':time.monotonic()-start,'decision':'A actual finite saved-data predicates; native requires separate critic/root admission' if not failures else 'B first data gate failure, no native','inputs':[pin(D/n) for n in ['export/mesh.json','export/groom.obj','export/expected.json','CPU-JOB.json','CHECK.json','CPU-build.stdout.txt','CPU-build.stderr.txt','CPU-check.stdout.txt','CPU-check.stderr.txt']],'counts':{'V':len(P),'T':len(F),'parts':len(parts),'roots':len(roots),'scalp_faces':len(S),'hair_vertices':len(hair)},'parts':report,'meshSha':sha(mesh),'positionSha':positionSha,'bounds':bounds,'hair_vertex_ellipsoid_norm2_min':minq,'failures':failures,'observer_error_recovery':'Initial metadata print e2e71a had wrong field name scalp_face_ids and returned1, no source replay or data judgement. Actual saved field scalp.head_face_ids used here.','limits':'No producer/checker/controller import/replay. Complete saved graph/OBJ traversed, no geometry generated. No general vertex-link/embedding/self-intersection/Boolean union/root-mass overlap/continuous clearance/anatomy/skin/morph/runtime/strand/visual/motion/AAA proof.'}
(D/'ROOT-DATA.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps(report,indent=2));raise SystemExit(bool(failures))
