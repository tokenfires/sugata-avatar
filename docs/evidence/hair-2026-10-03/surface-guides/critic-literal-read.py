import datetime, hashlib, json, math, os, struct
from pathlib import Path
p=Path(__file__).resolve().parent; repo=p.parents[3]
start=datetime.datetime.now(datetime.timezone.utc).isoformat()
sha=lambda data: hashlib.sha256(data).hexdigest()
g=json.loads((p/'GUIDES.json').read_text()); a=json.loads((p/'AUTHOR.json').read_text())
raw=(repo/g['source']['file']).read_bytes()
assert sha(raw)==g['source']['sha256']==a['source']['sha256']
magic,version,length=struct.unpack_from('<III',raw); assert magic==0x46546c67 and version==2 and length==len(raw)
off=12; chunks={}
while off<len(raw):
    n,kind=struct.unpack_from('<II',raw,off); off+=8; chunks[kind]=raw[off:off+n];off+=n
j=json.loads(chunks[0x4e4f534a]); binary=chunks[0x004e4942]
matches=[m for m in j['meshes'] if m.get('name')==g['source']['mesh']]; assert len(matches)==1
m=matches[0]; assert len(m['primitives'])==1; primitive=m['primitives'][0]
def accessor(index):
    x=j['accessors'][index];v=j['bufferViews'][x['bufferView']]
    assert v.get('buffer',0)==0 and not x.get('normalized',False) and 'sparse' not in x
    code,size={5126:('f',4),5125:('I',4),5123:('H',2)}[x['componentType']]
    count={'SCALAR':1,'VEC3':3}[x['type']]; stride=v.get('byteStride',count*size)
    base=v.get('byteOffset',0)+x.get('byteOffset',0)
    return [struct.unpack_from('<'+code*count,binary,base+i*stride) for i in range(x['count'])]
positions=accessor(primitive['attributes']['POSITION']); indices=[v[0] for v in accessor(primitive['indices'])]
assert len(positions)==g['source']['positions']==14517 and len(indices)==g['source']['triangles']*3==26756*3
sub=lambda x,y:[u-v for u,v in zip(x,y)]
norm=lambda x:math.sqrt(sum(v*v for v in x))
unit=lambda x:[v/norm(x) for v in x]
cross=lambda x,y:[x[1]*y[2]-x[2]*y[1],x[2]*y[0]-x[0]*y[2],x[0]*y[1]-x[1]*y[0]]
residuals={'root':0,'normal':0,'projectionMm':0,'controls':0,'tangents':0,'seedCrossMin':1}
same_downstream=[]; seen=set(); xs=[-.065,-.045,-.025,-.005,.025,.055];zs=[-.015,.012,.039,.066,.093,.113]
def compare(expected,actual,key,tolerance=1e-12):
    r=max(abs(x-y) for x,y in zip(expected,actual)); residuals[key]=max(residuals[key],r); assert r<tolerance
assert len(g['guides'])==36
for k,guide in enumerate(g['guides']):
    zi,xi=divmod(k,6);x=xs[xi];z=zs[zi];r=guide['root'];c=guide['curve']['controls']
    assert guide['id']==f'crown-{zi}-{xi}' and guide['id'] not in seen;seen.add(guide['id'])
    assert r['indices']==indices[r['triangle']*3:r['triangle']*3+3]
    verts=[positions[i] for i in r['indices']]
    assert len(set(r['indices']))==3 and min(r['bary'])>=-1e-12 and abs(sum(r['bary'])-1)<1e-12
    point=[sum(r['bary'][i]*verts[i][axis] for i in range(3)) for axis in range(3)]
    compare(point,r['position'],'root')
    n=unit(cross(sub(verts[1],verts[0]),sub(verts[2],verts[0])));compare(n,r['normal'],'normal')
    assert point[1]>=1.59 and abs(point[0])<=.09 and n[1]>0
    wanted=[x,1.659-2.4*x*x-2.5*(z-.05)**2,z]
    assert wanted==guide['wanted']
    compare([norm(sub(wanted,point))*1000],[r['projectionMm']],'projectionMm',1e-9)
    assert r['standOff']==.0025
    side=1 if point[0]>=-.018 else -1; heavy=side==1;v=(z+.015)/.128
    expected=[[point[i]+n[i]*.0025 for i in range(3)], [point[i]+n[i]*.0135+(side*.019 if i==0 else 0) for i in range(3)], [side*(.083+.012*v),1.636-.008*(1-v),z*.85+.012], [side*(.119+(.006 if heavy else 0)),1.53+.014*(1-v),z*.82+.013+(.01 if heavy else -.007)], [side*(.113+(.006 if heavy else 0)),1.464+.015*(1-v),z*.82+.016+(.012 if heavy else -.013)], [side*(.094+(.009 if heavy else 0)),1.427+.018*(1-v)+(xi%2)*.0015,z*.80+.014+(.011 if heavy else -.013)]]
    assert len(c)==6 and all(math.isfinite(t) for row in c for t in row)
    for u,w in zip(expected,c):compare(u,w,'controls')
    first=unit(sub(c[1],c[0]));last=unit(sub(c[-1],c[-2]))
    compare(first,guide['curve']['tangents']['first'],'tangents');compare(last,guide['curve']['tangents']['last'],'tangents')
    seed=norm(cross(n,first));residuals['seedCrossMin']=min(residuals['seedCrossMin'],seed);assert seed>1e-12
    width=.016+(xi%3)*.0008+(.001 if heavy else 0)
    assert guide['section']['widthProfile']==[[0,.009],[.18,width],[.45,width*.97],[.80,width*.72],[1,.0007]]
    assert guide['section']['rollProfile']==[[0,0],[1,0]] and guide['curve']['samples']==49 and guide['curve']['type']=='centripetal-catmull-rom'
    assert guide['role']==('forehead-side sweep' if z>.082 else 'crown-to-cheek side flow' if z>.01 else 'rearward crown flow')
    assert guide['depth']==('heavier positiveX cheek framing' if heavy else 'lighter negativeX swept-back temple') and guide['tip']=='jaw-level inward turn'
    if xi in [2,5]:
        other=g['guides'][k-2]; assert c[2:]==other['curve']['controls'][2:]
        same_downstream.append([other['id'],guide['id']])
assert sha((p/'GUIDES.json').read_bytes())==a['output']['sha256'] and (p/'GUIDES.json').stat().st_size==a['output']['bytes']
pins={}
for name in ['PLAN.md','author.mjs','GUIDES.json','AUTHOR.json','critic-literal-read.py']:
    b=(p/name).read_bytes();pins[name]={'bytes':len(b),'sha256':sha(b)}
for row in a['pins']:assert pins[row['file']]=={'bytes':row['bytes'],'sha256':row['sha256']}
receipt={'status':'PASS-LITERAL-READBACK','command':'python3 docs/evidence/hair-2026-10-03/surface-guides/critic-literal-read.py','pid':os.getpid(),'startUTC':start,'endUTC':datetime.datetime.now(datetime.timezone.utc).isoformat(),'pins':pins,'bodySha256':sha(raw),'guides':36,'residuals':residuals,'exactSharedControlsP2ThroughP5Pairs':same_downstream,'scope':'Independent direct GLB/accessor source-coordinate readback and literal arithmetic. No nearest-global reprojection, Catmull-Rom curve/surface evaluation, model/native activity, coverage/contact or appearance claim.'}
with (p/'CRITIC-LITERAL-READBACK.json').open('x') as f:json.dump(receipt,f,indent=2);f.write('\n')
print(json.dumps(receipt))
