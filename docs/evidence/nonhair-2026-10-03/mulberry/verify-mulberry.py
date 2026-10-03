"""Read-only independent audit of the first-control refusal, not a six-pair verifier."""
import datetime, hashlib, json, math, os, pathlib, sys
start=datetime.datetime.now(datetime.timezone.utc).isoformat(); pid=os.getpid()
root=pathlib.Path(__file__).resolve().parents[4]; out=root/'captures/mulberry-look-2026-10-03-v1'
def sha(p): return hashlib.sha256(p.read_bytes()).hexdigest()
r=json.loads((out/'report.json').read_bytes()); assert sha(out/'report.json')=='22ffa377a4a11c014fc50c8678448d6c12441a375cb9bd87dc907788da54184d'
assert r['status']=='failed' and len(r['cases'])==1 and r['images']==[]
assert len(r['errors'])==1 and 'actual active color dbd5c6' in r['errors'][0] and '0 !== 1' in r['errors'][0]
assert r.get('reopened') is None and r['navigationRetirements']==[]
assert r['failureRetirement']=={'disposed':True,'leaked':[]} and r['pageClosed'] and r['browserClosed'] and r['finalPinsUnchanged']
assert not list(out.glob('*.png'))
pins={**r['sources'],**r['dependencies'],**r['helpers']}
for p,h in pins.items(): assert sha(root/p)==h,p
copies=[]
for p in (out/'source').rglob('*'):
 if p.is_file():
  rel=p.relative_to(out/'source').as_posix(); assert rel in pins and sha(p)==pins[rel],rel; copies.append(rel)
assert sha(root/'tools/critic/mulberry-look.mjs')==r['instrumentSHA256']==sha(out/'instrument.mjs')
recipe=root/'docs/evidence/nonhair-2026-10-03/mulberry/sugata-mulberry-ink.json'
assert sha(recipe)==r['recipeSHA256']==sha(out/'sugata-mulberry-ink.json')
candidate=json.loads(recipe.read_bytes()); assert candidate==r['candidate']
assert candidate['wardrobe']['colours']=={'top':'#754453'}
control=json.loads(json.dumps(candidate)); del control['wardrobe']['colours']; assert control==r['control']
assert len(r['assets'])==6
for a in r['assets']: assert sha(root/a['file'])==a['sha256']==r['sources'][a['file']]
c=r['cases'][0];s=c['state'];assert c['arm']=='ecru' and c['context']=='body' and not c.get('completed') and not c.get('paired')
assert s['configuration']==control and s['paused']=='true' and s['storage']=={}
assert s['normalClocks']['motion']==s['normalClocks']['utterance']==s['normalClocks']['resetEpoch']==0
assert s['backend']=={'isWebGPU':True,'temporalAA':'taau','resolutionScale':.66}
assert s['canvas']['client']==s['canvas']['buffer']==[900,868]
assert all(not w['interior'] for w in s['worn'])
# Separate installed-coefficient arithmetic, not Three Color or the observer's kind predicate.
def linear(hexvalue):
 vals=[int(hexvalue[i:i+2],16)/255 for i in (0,2,4)]
 return [v*.0773993808 if v<.04045 else (v*.9478672986+.0521327014)**2.4 for v in vals]
def follow(g,properties):
 i=0;ids=[i]
 for prop in properties:
  e=[e for e in g[i]['edges'] if e['property']==prop and e['index'] is None];assert len(e)==1
  i=e[0]['to'];ids.append(i)
 return g[i],ids
worn={w['id']:w for w in s['worn']}; witnesses=[]; maxcol=0
for ident,props,hexvalue in [('female_casualsuit01',['elseNode','node','aNode','node'],'dbd5c6'),('female_casualsuit01',['ifNode','node','aNode','node'],'26364c'),('shoes01',['elseNode','node','aNode','node'],'49342b'),('shoes01',['ifNode','node','aNode','node'],'34363b')]:
 g=worn[ident]['colorGraph'];assert all(n['id']==i for i,n in enumerate(g))
 seen=set();pending=[0]
 while pending:
  i=pending.pop()
  if i in seen:continue
  seen.add(i)
  for edge in g[i]['edges']:
   assert 0<=edge['to']<len(g);pending.append(edge['to'])
 assert len(seen)==len(g)
 node,ids=follow(g,props);assert node['type']=='ConstNode' and node['nodeType']=='vec3' and node['value']['kind']=='vector'
 observed=node['value']['data'];err=max(abs(a-b) for a,b in zip(observed,linear(hexvalue)));assert err<1e-14;maxcol=max(maxcol,err)
 count=sum(n.get('value',{}).get('kind')=='color' and n.get('value',{}).get('hex')==hexvalue for n in g if isinstance(n.get('value'),dict))
 assert count==0
 witnesses.append({'owner':ident,'hex':hexvalue,'propertyPath':'.'.join(props),'ids':ids,'vector':observed,'maxLinearError':err,'observerColorKindMatches':count})
assert s['ground']['constructorAlbedo']==0x968c34 and len(s['ground']['colors'])==1
assert max(abs(a-b) for a,b in zip(s['ground']['colors'][0]['linear'],linear('968c34')))<1e-14
# Independent one nominal-camera check; no mesh visibility, native-pixel or candidate proof.
cam=s['camera'];f=cam['zoom']/math.tan(math.radians(cam['fov']/2));near=cam['near'];far=cam['far'];assert cam['coordinateSystem']==2001
p=[f/cam['aspect'],0,0,0,0,f,0,0,0,0,far/(near-far),-1,0,0,far*near/(near-far),0]
proj=max(abs(a-b) for a,b in zip(p,cam['projection']));assert proj<1e-13
pos=cam['position'];t=cam['target']
def norm(a):
 l=math.sqrt(sum(x*x for x in a));return [x/l for x in a]
def cross(a,b):return [a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]]
z=norm([a-b for a,b in zip(pos,t)]);x=norm(cross([0,1,0],z));y=cross(z,x)
world=[*x,0,*y,0,*z,0,*pos,1];worlderr=max(abs(a-b) for a,b in zip(world,s['physical']['camera']));assert worlderr<1e-13
assert s['physical']['projection']==cam['projection'] and s['physical']['clock']==0
result={'status':'independent refusal audit passed; no candidate appearance or JSON navigation admission','started':start,'finished':datetime.datetime.now(datetime.timezone.utc).isoformat(),'pid':pid,'interpreter':sys.executable,'python':sys.version,'command':f'{sys.executable} docs/evidence/nonhair-2026-10-03/mulberry/verify-mulberry.py > docs/evidence/nonhair-2026-10-03/mulberry/independent.json','verifierSHA256':sha(pathlib.Path(__file__)),'reportSHA256':sha(out/'report.json'),'sourcePins':len(r['sources']),'dependencyPins':len(r['dependencies']),'helperPins':len(r['helpers']),'uniquePins':len(pins),'sourceCopies':copies,'servedAssetPins':len(r['assets']),'images':0,'completeCases':0,'firstControlGraphWitnesses':witnesses,'maxColourError':maxcol,'maxProjectionError':proj,'maxCameraWorldError':worlderr,'normalClocks':s['normalClocks'],'scope':'Completed first-control source/material inputs and nominal camera only. No pixel evidence, candidate Avatar, paired invariant, file-input reopening or complete-look acceptance.'}
print(json.dumps(result,indent=2))
