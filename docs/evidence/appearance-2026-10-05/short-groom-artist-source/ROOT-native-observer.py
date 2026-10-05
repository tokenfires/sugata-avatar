from pathlib import Path
import json,math,datetime,hashlib
D=Path(__file__).resolve().parent
raw=(D/'NATIVE.READY.json').read_bytes();a=json.loads(raw);r=a['record'];m=json.loads((D/'export/mesh.json').read_text());e=json.loads((D/'export/expected.json').read_text())
def require(ok,label):
 if not ok:raise RuntimeError(label)
def near(a,b):return abs(a-b)<1e-9
def arrays(a,b):return len(a)==len(b) and all(near(x,y) for x,y in zip(a,b))
require(a['url']=='http://127.0.0.1:5173/@fs/Users/robault/GitHub/sugata-avatar/docs/evidence/appearance-2026-10-05/short-groom-artist-source/index.html','exact URL')
require(r['ready'] is True and r['error'] is None and r['draws']==4 and r['lifetime']=={'closed':False,'reason':None,'attempts':[]},'first draw lifetime')
require(r['meshSha']==e['meshSha'] and r['positionSha']==e['positionSha'],'actual source and Float32 buffer bytes')
require(r['id']==m['id'] and r['schema']==m['schema'] and r['vertices']==e['vertices'] and r['triangles']==e['triangles'] and r['roots']==16 and r['scalpFaces']==724,'identity and counts')
require(len(r['parts'])==22,'complete part records')
for p,ep,ap in zip(m['parts'],e['parts'],r['parts']):
 require(ap=={'id':p['id'],'kind':p['kind'],'color':p['color'],'vertices':ep['vertices'],'triangles':ep['triangles'],'indexCount':ep['triangles']*3,'indexSha':ep['indexSha'],'positionSha':e['positionSha']},'actual original part '+p['id'])
require(r['bounds']==e['bounds'],'actual original bounds')
w,h=r['stage'];require(w>0 and h>0 and a['stage']['width']==w and a['stage']['height']==h and a['overflow']==0,'actual unmodified stage framing')
pw,ph=w//2,h//2;center=[(x+y)/2 for x,y in zip(e['bounds']['min'],e['bounds']['max'])];half=max(y-x for x,y in zip(e['bounds']['min'],e['bounds']['max']))*.63
views=[('front',[0,0,5],[0,1,0]),('profile',[5,0,0],[0,1,0]),('rear',[0,0,-5],[0,1,0]),('top',[0,5,0],[0,0,-1])]
def cross(a,b):return [a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]]
def unit(a):n=math.sqrt(sum(x*x for x in a));return [x/n for x in a]
projection=[1/(half*(pw/ph)),0,0,0,0,1/half,0,0,0,0,-2/11.9,0,0,0,-12.1/11.9,1]
require(len(r['views'])==4,'all four cameras');framing=[]
for i,(name,delta,up) in enumerate(views):
 v=r['views'][i];pos=[x+y for x,y in zip(center,delta)];back=unit(delta);right=unit(cross(up,back));cup=cross(back,right);world=right+[0]+cup+[0]+back+[0]+pos+[1]
 vp=[i%2*pw,ph if i<2 else 0,w-pw if i%2 else pw,h-ph if i<2 else ph]
 require(v['name']==name and v['viewport']==vp and arrays(v['position'],pos) and arrays(v['up'],up) and arrays(v['target'],center) and near(v['halfVertical'],half) and v['near']==.1 and v['far']==12,'camera pose '+name)
 require(arrays(v['matrixWorld'],world) and arrays(v['projectionMatrix'],projection),'camera actual matrices '+name)
 extent=[0,0,0]
 for p in m['positions']:
  d=[x-y for x,y in zip(p,pos)];cs=[sum(x*y for x,y in zip(d,axis)) for axis in [right,cup,back]];ndc=[cs[0]*projection[0],cs[1]*projection[5],cs[2]*projection[10]+projection[14]]
  for j in range(3):extent[j]=max(extent[j],abs(ndc[j]))
 require(all(x<1 for x in extent),'whole original source framed '+name)
 framing.append({'view':name,'all_original_vertices_NDC_abs_max':extent,'viewport':vp})
resources=[];colors=set()
for p in m['parts']:
 if p['color'] not in colors:colors.add(p['color']);resources.append('material '+p['color'])
 resources.append('geometry '+p['id'])
resources.append('renderer')
result={'verified_utc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'decision':'A actual exact source/buffers/22part graph identity and four fixed cameras/all-original-vertex frustum bounds; appearance awaits sole original image','record_sha256':hashlib.sha256(raw).hexdigest(),'stage':[w,h],'actual_viewport':a['viewport'],'framing':framing,'expected_owned_disposal_names':resources,'expected_owned_disposal_count':len(resources),'limits':'Actual original rendered image required for appearance. NDC complete vertex framing supports whole mesh frame, no occlusion/appearance/continuous clearance/physical attachment/material/motion/AAA proof. Browser DOM record reflects observed source/render setup; GPU retirement unobserved.'}
(D/'ROOT-NATIVE-GATE.json').write_text(json.dumps(result,indent=2)+'\n');print(json.dumps(result,indent=2))
