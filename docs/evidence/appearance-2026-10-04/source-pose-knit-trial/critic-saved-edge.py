"""Read saved operands only; never import author, decode assets or emit geometry."""
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path
import hashlib
import json
import math
import os

here = Path(__file__).resolve().parent
root = here.parents[3]
started = datetime.now(timezone.utc).isoformat()
raw = json.loads((here/'RAW.json').read_text())
job = json.loads((here/'AUTHOR-JOB.json').read_text())
process = json.loads((here/'RUN-PROCESS.json').read_text())
artist = json.loads((here/'ARTIST.json').read_text())
assert raw['artist'] == artist
assert job == json.loads((here/'STDOUT.txt').read_text())
assert (here/'STDERR.txt').read_bytes() == b''
assert job['refused'] == raw['refused'] == 'closed exterior edge manifold'
assert job['witness'] == raw['witness']
assert process['childExit'] == 1 and process['childReaped'] and not process['timedOut']
assert not process['late'] and not process['recordingErrors']
for name,pin in json.loads((here/'INPUTS.json').read_text())['files'].items():
    content = (root/name).read_bytes()
    assert len(content) == pin['bytes'] and hashlib.sha256(content).hexdigest() == pin['sha256'], name
for name,pin in process['actualFiles'].items():
    path = here/name
    assert path.exists() == pin['exists'], name
    if pin['exists']:
        content = path.read_bytes()
        assert len(content) == pin['bytes'] and hashlib.sha256(content).hexdigest() == pin['sha256']
assert not (here/'mesh.json').exists() and not (here/'sweater.obj').exists()
assert not any(k in raw for k in ['closedCheck','cutPoints','cutFaces','smoothPoints','smoothFaces'])
g = artist['grid']; counts = g['counts']; origin = g['origin']; h = g['spacing']
bits = raw['fieldBitsIJKOrder']; cells = {tuple(c) for c in raw['insideCells']}
def bit_at(c):
    return int(bits[(c[0]*counts[1]+c[1])*counts[2]+c[2]],16)
assert len(bits) == math.prod(counts) == 115200
observed_inside = {tuple((i,j,k)) for i in range(counts[0]) for j in range(counts[1]) for k in range(counts[2]) if bit_at((i,j,k)) & 7 and not bit_at((i,j,k)) & 8}
assert observed_inside == cells and len(cells) == len(raw['insideCells']) == 19022
assert len(raw['points']) == len(raw['gridVertexKeys']) == 6616
assert len(raw['closedFaces']) == len(raw['faceOperands']) == 6624
assert len({tuple(k) for k in raw['gridVertexKeys']}) == 6616
for point,key in zip(raw['points'],raw['gridVertexKeys']):
    assert all(math.isfinite(v) for v in point)
    assert point == [origin[i]+h*key[i] for i in range(3)]
incidence = defaultdict(list); faces_seen = set()
for fi,(face,row) in enumerate(zip(raw['closedFaces'],raw['faceOperands'])):
    assert len(face) == len(set(face)) == 4 and all(0 <= v < 6616 for v in face)
    cell = tuple(row['cell']); axis = tuple(row['axis']); neighbor = tuple(a+b for a,b in zip(cell,axis))
    assert cell in cells and neighbor not in cells
    assert sum(abs(v) for v in axis) == 1
    assert row['outsideCentre'] == [origin[i]+h*(neighbor[i]+.5) for i in range(3)]
    assert row['outsideBits'] == bit_at(neighbor)
    assert (cell,axis) not in faces_seen
    faces_seen.add((cell,axis))
    normal_axis = next(i for i,v in enumerate(axis) if v)
    keys = [raw['gridVertexKeys'][v] for v in face]
    for i in range(3):
        assert {k[i] for k in keys} == ({cell[i]+int(axis[i]>0)} if i == normal_axis else {cell[i],cell[i]+1})
    for a,b in zip(face,face[1:]+face[:1]):
        incidence[tuple(sorted((a,b)))].append([fi,a,b])
expected_boundary = sum(1 for c in cells for a in [(1,0,0),(-1,0,0),(0,1,0),(0,-1,0),(0,0,1),(0,0,-1)] if tuple(x+y for x,y in zip(c,a)) not in cells)
assert expected_boundary == len(faces_seen) == 6624
edge = tuple(job['witness']['edge']); rows = incidence[edge]
assert edge == (432,433) and rows == job['witness']['rows'] and len(rows) == 4
assert [row[0] for row in rows] == [408,409,485,486]
keys = [raw['gridVertexKeys'][v] for v in edge]
assert keys == [[16,20,11],[16,20,12]]
touching = [(15,19,11),(15,20,11),(16,19,11),(16,20,11)]
def analytic_bits(point):
    x,y,z = point
    torso = False
    for a,b in zip(artist['torso']['sections'],artist['torso']['sections'][1:]):
        if a[0] <= y <= b[0]:
            t=(y-a[0])/(b[0]-a[0]); width,back,front=[a[i]+t*(b[i]-a[i]) for i in (1,2,3)]
            torso=y <= artist['torso']['yMax']-artist['torso']['shoulderSlope']*abs(x) and (x/width)**2+((z-(back+front)/2)/((front-back)/2))**2 <= 1
            break
    sleeves=[]
    for sign in [-1,1]:
        controls=[[sign*c[0],c[1],c[2]] for c in artist['positiveSleeve']['centres']]
        inside=False
        for si,(a,b) in enumerate(zip(controls,controls[1:])):
            d=[bb-aa for aa,bb in zip(a,b)]; v=[pp-aa for pp,aa in zip(point,a)]
            t=sum(vv*dd for vv,dd in zip(v,d))/sum(dd*dd for dd in d)
            radius=(1-t)*artist['positiveSleeve']['radii'][si]+t*artist['positiveSleeve']['radii'][si+1]
            if 0 <= t <= 1 and sum((vv-t*dd)**2 for vv,dd in zip(v,d)) <= radius**2: inside=True
        sleeves.append(inside)
    n=artist['neckVoid']; neck=y>=n['yMin'] and ((x-n['centerXZ'][0])/n['radiiXZ'][0])**2+((z-n['centerXZ'][1])/n['radiiXZ'][1])**2<=1
    return int(torso)+2*int(sleeves[0])+4*int(sleeves[1])+8*int(neck)
neighborhood=[]
for cell in touching:
    point=[origin[i]+h*(cell[i]+.5) for i in range(3)]
    value=analytic_bits(point)
    assert value == bit_at(cell)
    neighborhood.append({'cell':cell,'centre':point,'bits':value,'occupied':cell in cells})
assert [r['occupied'] for r in neighborhood] == [True,False,False,True]
assert all(raw['faceOperands'][fi]['cutRoles'] == [] for fi,_,_ in rows)
result={'pid':os.getpid(),'startedUTC':started,'completedUTC':datetime.now(timezone.utc).isoformat(),'decision':'B closed-exterior topology; no exported garment or appearance evidence','checkedInputPins':14,'savedFieldBits':115200,'savedOccupiedCells':19022,'savedClosedPoints':6616,'savedClosedQuads':6624,'edge':edge,'gridKeys':keys,'points':[raw['points'][v] for v in edge],'incidence':rows,'neighborhood':neighborhood,'offendingFaces':[{'ordinal':fi,'face':raw['closedFaces'][fi],'operands':raw['faceOperands'][fi]} for fi,_,_ in rows],'limits':'No author import/rerun, GLB decode, surface reconstruction, new mesh or native. Analytic membership checked at four existing neighboring cell centres only.'}
for name in ['RAW.json','AUTHOR-JOB.json','RUN-PROCESS.json','STDOUT.txt','STDERR.txt','PLAN.md','ARTIST.json','INPUTS.json','author.py','runner.py','SURFACE-CONTRACT.md']:
    content=(here/name).read_bytes()
    result.setdefault('pins',{})[name]={'bytes':len(content),'sha256':hashlib.sha256(content).hexdigest()}
content=Path(__file__).read_bytes();result['readerSHA256']=hashlib.sha256(content).hexdigest()
(here/'CRITIC-SAVED-EDGE.json').write_text(json.dumps(result,indent=2)+'\n')
print(json.dumps(result))
