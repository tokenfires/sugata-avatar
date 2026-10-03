"""Independent readback of saved source authority and actual static render states."""
from pathlib import Path
import json,hashlib,struct,math,datetime,os
root=Path.cwd();packet=root/'docs/evidence/nonhair-2026-10-03/top-control-owned';raw=root/'captures/top-control-owned-2026-10-03-v1'
started=datetime.datetime.now(datetime.timezone.utc).isoformat();sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
r=json.loads((raw/'report.json').read_text());s=json.loads((packet/'supervisor-v1.json').read_text());c=json.loads((raw/'control.json').read_text())
assert r['status']==s['status']=='observed' and r['finalPinsUnchanged'] and s['pinsUnchanged'] and not s['forced']
assert s['exitCode']==0 and s['childPID']==r['pid'] and s['nativeReportSha256']==sha(raw/'report.json')
assert s['finalLiveRecordedIdentities']==s['finalObservedGroupMembers']==[]
assert r['cleanup']['pageIsClosed'] and not r['cleanup']['browserIsConnected'] and r['cleanup']['server']=='closed'
assert r['errors']==r['resources']==[] and len(r['images'])==4 and r['cleanup']['readsDrained']==1
assert r['retirement']['disposed'] and r['retirement']['geometryEvents']==r['retirement']['materialEvents']==1 and r['retirement']['errors']==[]
pins={**r['sources'],**r['inputs'],**r['protectedInputs']}
for name,h in pins.items():assert sha(root/name)==h,name
for name,h in s['inputs'].items():assert sha(packet/name)==h,name
assert sha(packet/'capture.mjs')==r['instrumentSHA256']
assert c['sourceSHA256']==sha(root/c['sourcePath'])==r['control']['sourceSHA256'] and sha(raw/'control.json')==r['control']['sha256']==r['reads'][0]['sha256']
p=[];uv=[];faces=[];lines=[]
for ln,line in enumerate((root/c['sourcePath']).read_text().splitlines(),1):
    w=line.split()
    if not w:continue
    if w[0]=='v':p.append(list(map(float,w[1:])))
    if w[0]=='vt':uv.append(list(map(float,w[1:])))
    if w[0]=='f':faces.append([tuple(int(x)-1 for x in v.split('/')) for v in w[1:]]);lines.append(ln)
assert len(p)==2136 and len(faces)==2060 and len(c['sourceVertices'])==1250 and len(c['faces'])==1204
ids=[v['sourceVertex'] for v in c['sourceVertices']];assert ids==sorted(set(ids))
neighbors=[set() for _ in p]
for f in faces:
    for k,(v,t) in enumerate(f):
        w=f[(k+1)%4][0];neighbors[v].add(w);neighbors[w].add(v)
seen=set();pending=[max(range(len(p)),key=lambda i:p[i][1])]
while pending:
    v=pending.pop()
    if v not in seen:seen.add(v);pending.extend(neighbors[v]-seen)
assert seen==set(ids) and max(p[i][1] for i in seen)-max(p[i][1] for i in set(range(len(p)))-seen)>=.5
for v in c['sourceVertices']:assert v['xyz']==p[v['sourceVertex']]
for t,v in zip(c['sourceUVIds'],c['sourceUV']):assert uv[t]==v
assert c['originalBounds']=={'minimum':[min(p[i][a] for i in ids) for a in range(3)],'maximum':[max(p[i][a] for i in ids) for a in range(3)]}
chosen=[i for i,f in enumerate(faces) if f[0][0] in set(ids)];assert chosen==[f['sourceFace'] for f in c['faces']]
position=[];texture=[];owners=[]
f32=lambda v:struct.unpack('<f',struct.pack('<f',v))[0]
for f in c['faces']:
    assert f['sourceLine']==lines[f['sourceFace']]
    mapped=[(ids[v],c['sourceUVIds'][t]) for v,t in f['corners']];assert mapped==faces[f['sourceFace']]
    for fan in ((0,1,2),(0,2,3)):
        for k in fan:
            v,t=mapped[k];position.extend(map(f32,p[v]));texture.extend(map(f32,uv[t]));owners.append(dict(sourceFace=f['sourceFace'],sourceVertex=v,sourceUV=t,corner=k))
def cross(a,b):return [a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]]
def dot(a,b):return sum(x*y for x,y in zip(a,b))
def unit(a):n=math.sqrt(dot(a,a));assert n>0;return [v/n for v in a]
normals=[]
for k in range(0,len(position),9):
    a,b,d=position[k:k+3],position[k+3:k+6],position[k+6:k+9]
    n=unit(cross([b[i]-a[i] for i in range(3)],[d[i]-a[i] for i in range(3)]));normals.extend(n*3)
center=[(a+b)/2 for a,b in zip(c['originalBounds']['minimum'],c['originalBounds']['maximum'])]
directions=[[0,0,1],[0,0,-1],[1,.35,1],[-1,.35,-1]];labels=['plus-Z','minus-Z','plus-X-plus-Z-oblique','minus-X-minus-Z-oblique']
normalResidual=0;cameraResidual=0;images=[]
for row,direction,label in zip(r['images'],directions,labels):
    b=(raw/row['file']).read_bytes();assert hashlib.sha256(b).hexdigest()==row['sha256'] and len(b)==row['bytes']
    assert b[:8]==b'\x89PNG\r\n\x1a\n' and struct.unpack('>II',b[16:24])==(900,900)
    state=row['state'];g=state['geometry'];cam=state['camera'];assert state['label']==label and state['direction']==direction
    assert g['positions']==position and g['uv']==texture and g['owners']==owners and g['index'] is None
    assert len(g['normals'])==len(normals);nr=max(abs(a-b) for a,b in zip(g['normals'],normals));assert nr<1e-6;normalResidual=max(normalResidual,nr)
    assert state['modelMatrix']==[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1] and cam['center']==center and cam['near']==.1 and cam['far']==100 and cam['zoom']==1
    assert state['draw']['triangles']==2408 and state['draw']['calls']==1 and state['environment']['version'].startswith('WebGL 2')
    assert state['material']==dict(colour='8d96a2',roughness=1,metalness=0,side=2,flatShading=True,map=None)
    z=unit(direction);x=unit(cross([0,1,0],z));y=cross(z,x);eye=[center[a]+30*z[a] for a in range(3)]
    world=x+[0]+y+[0]+z+[0]+eye+[1];cr=max(abs(a-b) for a,b in zip(world,cam['matrixWorld']));assert cr<1e-12;cameraResidual=max(cameraResidual,cr)
    cp=[]
    for k in range(0,len(position),3):
        v=[position[k+a]-eye[a] for a in range(3)];cp.append([dot(v,x),dot(v,y),dot(v,z)])
    half=1.1*max(abs(v[a]) for v in cp for a in (0,1));assert abs(half-cam['half'])<1e-12
    ndc=[[v[0]/half,v[1]/half,(-2*v[2]-100.1)/99.9] for v in cp]
    minimum=[min(v[a] for v in ndc) for a in range(3)];maximum=[max(v[a] for v in ndc) for a in range(3)]
    assert max(abs(v[a]) for v in ndc for a in (0,1))<=1/1.1+1e-6 and max(abs(v[2]) for v in ndc)<1
    assert max(abs(a-b) for a,b in zip(minimum+maximum,state['ndc']['minimum']+state['ndc']['maximum']))<1e-12
    images.append(dict(file=row['file'],sha256=row['sha256'],half=half,wholeSourceInFrame=True))
out=dict(pid=os.getpid(),started=started,finished=datetime.datetime.now(datetime.timezone.utc).isoformat(),command='python3 docs/evidence/nonhair-2026-10-03/top-control-owned/root-readback.py',scriptSha256=sha(Path(__file__)),reportSha256=sha(raw/'report.json'),supervisorSha256=sha(packet/'supervisor-v1.json'),pins=len(pins),selectedVertices=len(ids),quads=len(chosen),triangles=2408,renderedCornerRecords=len(owners),normalResidual=normalResidual,cameraResidual=cameraResidual,images=images,decision='Saved source/corners/Float32 buffers/cameras and observed ownership/retirement agree; appearance still requires actual image inspection.',limits='No renderer/author replay, physical/native/body fit, global process absence or continuous movement proof.')
with (packet/'ROOT-READBACK.json').open('x') as f:json.dump(out,f,indent=2);f.write('\n')
print(json.dumps(out))
