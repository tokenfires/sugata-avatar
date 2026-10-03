"""Independent postflight: union-find topology and decimal triangle witness. No authorship replay."""
from collections import Counter
from decimal import Decimal, localcontext
from pathlib import Path
import datetime, hashlib, json, os

p=Path('docs/evidence/nonhair-2026-10-03/relaxed-top-source')
start=datetime.datetime.now(datetime.timezone.utc).isoformat()
h=lambda path:hashlib.sha256(Path(path).read_bytes()).hexdigest()
report=json.loads((p/'run-v1.json').read_bytes())
assert report['ok'] is False and report['stage']=='triangle orientation'
assert report['emittedFiles']=={} and not list((p/'artifacts-v1').iterdir())
pins=json.loads((p/'INPUTS.json').read_bytes())
for path,expected in pins.items():assert h(path)==expected,path
assert h(p/'author.py')==report['scriptSha256']=='ba7083de4a19d44b56a67a2fc6ce3b8cc024beb28969a3ac22f661c575809165'
source=Path('docs/evidence/nonhair-2026-10-03/capsule-source/inputs/male_casualsuit02/male_casualsuit02.obj')
vertices=[];faces=[]
for no,line in enumerate(source.read_text().splitlines(),1):
    w=line.split()
    if w and w[0]=='v':vertices.append(tuple(map(float,w[1:])))
    if w and w[0]=='f':faces.append((no,tuple(int(c.split('/')[0])-1 for c in w[1:])))
parent=list(range(len(vertices)))
def find(v):
    while parent[v]!=v:parent[v]=parent[parent[v]];v=parent[v]
    return v
for line,ids in faces:
    for v in ids[1:]:parent[find(v)]=find(ids[0])
components={}
for v in range(len(vertices)):components.setdefault(find(v),[]).append(v)
components=sorted(components.values(),key=lambda ids:max(vertices[v][1] for v in ids),reverse=True)
top=set(components[0]);selected=[i for i,(line,ids) in enumerate(faces) if ids[0] in top]
edges=Counter(tuple(sorted((ids[k],ids[(k+1)%4]))) for i in selected for ids in [faces[i][1]] for k in range(4))
assert len(top)==1250 and len(selected)==1204 and len(edges)==2456
assert len(top)-len(edges)+len(selected)==-2
assert sorted(len(c) for c in components)==[886,1250]
assert all(count in (1,2) for count in edges.values())
w=report['gateWitness'];fid=w['sourceFace'];tri=tuple(w['sourceVertices']);line,ids=faces[fid]
assert fid==1040 and tri in ((ids[0],ids[1],ids[2]),(ids[0],ids[2],ids[3]))
assert [list(vertices[v]) for v in tri]==w['originalXYZ']
with localcontext() as ctx:
    ctx.prec=50
    def vector(x):return [Decimal(str(a)) for a in x]
    def area(rows):
        a,b,c=map(vector,rows);u=[b[k]-a[k] for k in range(3)];v=[c[k]-a[k] for k in range(3)]
        return [u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]]
    original=area(w['originalXYZ']);authored=area(w['authoredXYZ'])
    orientation=sum(a*b for a,b in zip(original,authored));area_length=sum(a*a for a in authored).sqrt()
    assert orientation<0 and area_length>Decimal('1e-10')
    assert abs(orientation-Decimal(str(w['orientationDot'])))<Decimal('1e-14')
    for computed,recorded in zip(original,w['originalAreaVector']):assert abs(computed-Decimal(str(recorded)))<Decimal('1e-14')
    for computed,recorded in zip(authored,w['authoredAreaVector']):assert abs(computed-Decimal(str(recorded)))<Decimal('1e-14')
r=dict(pid=os.getpid(),started=start,finished=datetime.datetime.now(datetime.timezone.utc).isoformat(),
       scriptSha256=h(__file__),reportSha256=h(p/'run-v1.json'),protectedInputs=len(pins),
       sourceComponents=[len(c) for c in components],topVertices=len(top),topFaces=len(selected),topEdges=len(edges),
       sourceFace=fid,sourceLine=line,sourceQuad=ids,sourceTriangle=tri,
       decimalOrientationDot=str(orientation),decimalAuthoredAreaLength=str(area_length),emittedFiles=0,
       decision='Corroborated original-relative orientation refusal; no collapse, self-intersection, body-fit or appearance finding.',
       limits='No source deformation replay, selection repair, native import/render or new garment output.')
(p/'ROOT-READBACK.json').write_text(json.dumps(r,indent=2)+'\n');print(json.dumps(r))
