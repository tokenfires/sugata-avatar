"""One admitted correction of the retained shared-identity fit. Run only after the recorded visual correspondence gate."""
import json, math, time, resource
import numpy as np
import fit
from fit import ROOT,OUT,base,lookup,vertex_map,points,project,solve
start=time.monotonic()
# Resource guard: one CPU process, 60s internal budget; 120s OS CPU limit.
resource.setrlimit(resource.RLIMIT_CPU,(120,120))
data=json.loads((OUT/'observations-correction-v001.json').read_text())
seed=json.loads((OUT/'candidate-v001.json').read_text())
controls=['head/head-scale-horiz-decr-incr','cheek/cheek-volume-decr-incr','chin/chin-height-decr-incr','chin/chin-width-decr-incr','chin/chin-prominent-decr-incr','eyes/eye-scale-decr-incr','eyes/eye-trans-in-out','eyes/eye-trans-down-up','eyes/eye-corner1-down-up','nose/nose-scale-horiz-decr-incr','nose/nose-scale-vert-decr-incr','nose/nose-scale-depth-decr-incr','nose/nose-trans-down-up','nose/nose-point-down-up','mouth/mouth-scale-horiz-decr-incr','mouth/mouth-trans-down-up','mouth/mouth-scale-depth-decr-incr']
controls += ['eyes/eye-height1-decr-incr','eyes/eye-height3-decr-incr','eyes/eye-corner2-down-up']
cat=json.loads((ROOT/'assets/identity/catalogue.json').read_text()); sliders={s['id']:s for s in cat['sliders']}
record=np.dtype([('index','<u4'),('delta','<f4',(3,))]);bins={}
full_basis=[]
for name in controls:
 s=sliders[name];region=s['region'];bins.setdefault(region,(ROOT/f'assets/identity/targets/{region}.bin').read_bytes());pair=[]
 for sign in ['negative','positive']:
  raw=np.zeros((19158,3))
  for side in (['left','right'] if s['sided'] else ['unsided']):
   end=s['ends'][sign+'-'+side];a=np.frombuffer(bins[region],dtype=record,count=end['count'],offset=end['offset']);np.add.at(raw,a['index'],a['delta'])
  pair.append(raw[vertex_map])
 full_basis.append(pair)
full_basis=np.array(full_basis)
if full_basis.shape!=(20,2,14517,3) or not np.isfinite(full_basis).all():raise ValueError('Invalid control basis')
smile=np.fromfile(OUT/'native-smile.f32',dtype='<f4').astype(float).reshape(-1,3)
views={}
for v in ['front','angle']:
 anchors=[a for a in data['anchors'] if a['name'] in data['observations'][v] and (not a.get('view') or a['view']==v)]
 if not all(a['vertices'] and abs(sum(a['weights'])-1)<1e-6 for a in anchors):raise ValueError('Incomplete anchors')
 views[v]={'anchors':anchors,'base':points(base,anchors),'smile':points(smile,anchors),
 'basis':np.array([[points(branch,anchors) for branch in pair] for pair in full_basis]),
 'target':np.array([data['observations'][v][a['name']] for a in anchors]),
 'sigma':np.array([a['uncertaintyPixels'] for a in anchors])[:,None]}
n=len(controls)
seed_weights=np.array([seed['identity'].get(name,0) for name in controls])
x=np.r_[seed_weights,seed['views']['front']['camera'],seed['views']['front']['smile'],seed['views']['angle']['camera'],seed['views']['angle']['smile']]
lo=np.r_[np.full(n,-.8),[-.18,-.21,-.14,math.log(.3),-.08,-.1,0],[-.6,-.21,-.14,math.log(.4),-.08,-.1,0]]
hi=np.r_[np.full(n,.8),[.18,.21,.14,math.log(.9),.08,.1,1],[-.03,.21,.14,math.log(1.2),.08,.1,1]]
# Weakly observed depth has a stronger prior; no unobserved eyelid/lip-thickness controls.
prior=np.full(n,.25);prior[-3:]=.4
lo[:17]=np.maximum(lo[:17],seed_weights[:17]-.20);hi[:17]=np.minimum(hi[:17],seed_weights[:17]+.20)
for name in ['chin/chin-prominent-decr-incr','nose/nose-scale-depth-decr-incr','mouth/mouth-scale-depth-decr-incr']:prior[controls.index(name)]=.25

def shaped(w,view,smile_weight):
 d=views[view];q=d['base'].copy()
 for j,amount in enumerate(w):q+=abs(amount)*d['basis'][j,1 if amount>=0 else 0]
 return q+smile_weight*d['smile']

def residual(x):
 w=x[:n];r=[]
 for i,v in enumerate(views):
  c=x[n+i*7:n+i*7+6];expression=x[n+i*7+6];d=views[v]
  e=(project(shaped(w,v,expression),c)-d['target'])/d['sigma']
  # Smooth robust residual prevents one uncertain outline/shading point dominating.
  e=np.sign(e)*np.sqrt(2*9*(np.sqrt(1+(e/3)**2)-1))
  r.extend(e.ravel())
  initial=np.array(seed['views'][v]['camera'])
  r.extend((c-initial)/np.array([.06,.05,.04,.08,.02,.02]))
  r.append((expression-seed['views'][v]['smile'])/.35)
 r.extend((w-seed_weights)/prior)
 return np.array(r)

if __name__=='__main__':
 import sys
 if sys.argv[1:]!=['--run-admitted-correction-v001']:raise SystemExit('Explicit admitted candidate flag required')
 dest=OUT/'candidate-correction-v001.json'
 if dest.exists():raise SystemExit('Candidate already exists; refusing to replay/overwrite')
 x,history=solve(residual,x,lo,hi,80)
 result={'stage':'measured-native-geometry-correction-v001-unaccepted','source':'assets/figures/figure_g000.glb','observations':'observations-correction-v001.json','center':fit.CENTER.tolist(),'fov':28,'identity':dict(zip(controls,x[:n].tolist())),'views':{},'history':history,'seconds':time.monotonic()-start,'limits':['Sparse measured fit is not full likeness acceptance.','View-specific surface anchors approximate contours; must remain on visible contour after fitting.','Generated photos and unknown cameras do not uniquely determine 3D anatomy.','Independent eyeballs/teeth and rig have not yet been refitted. Hair and finished skin absent.','Upper lip volume and forehead remain unconstrained. Lid boundary points are provisional; eye fit and expression closure still need testing.']}
 for i,v in enumerate(views):
  c=x[n+i*7:n+i*7+6];expression=x[n+i*7+6];pred=project(shaped(x[:n],v,expression),c);d=views[v]
  result['views'][v]={'camera':c.tolist(),'smile':float(expression),'rmsPixels':float(np.sqrt(np.mean(np.sum((pred-d['target'])**2,axis=1)))),'projected':{a['name']:q.tolist() for a,q in zip(d['anchors'],pred)},'errorsPixels':{a['name']:float(np.linalg.norm(q-t)) for a,q,t in zip(d['anchors'],pred,d['target'])}}
 result['atBounds']=[{'parameter':(controls+['front-'+s for s in ['yaw','pitch','roll','logdistance','tx','ty','smile']]+['angle-'+s for s in ['yaw','pitch','roll','logdistance','tx','ty','smile']])[i],'value':float(v)} for i,v in enumerate(x) if abs(v-lo[i])<1e-6 or abs(v-hi[i])<1e-6]
 dest.write_text(json.dumps(result,indent=2)+'\n')
 final=base.copy()
 for i,w in enumerate(x[:n]):final+=abs(w)*full_basis[i,1 if w>=0 else 0]
 final.astype('<f4').tofile(OUT/'candidate-correction-v001-positions.f32')
 print(json.dumps({'seconds':result['seconds'],'iterations':len(history),'rmsPixels':{v:r['rmsPixels'] for v,r in result['views'].items()},'atBounds':result['atBounds'],'identity':result['identity']}))
